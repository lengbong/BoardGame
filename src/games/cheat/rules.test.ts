import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { makeCard, type Card } from '../common/playingCards';
import { decideDoubt, decidePlay } from './ai';
import {
  DEFAULT_OPTIONS,
  actor,
  allCards,
  applyAction,
  claimText,
  createGame,
  doubtQueue,
  isLie,
  nextRank,
  rankWithObject,
  rankings,
  upcomingRanks,
} from './rules';
import type { CheatOptions, CheatSetup, CheatState, SeatKind } from './types';

function setup(kinds: SeatKind[], options: Partial<CheatOptions> = {}): CheatSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: `P${i}` })) as CheatSetup['seats'],
    options: { ...DEFAULT_OPTIONS, ...options },
  };
}

const S = (rank: number) => makeCard('spade', rank);
const H = (rank: number) => makeCard('heart', rank);
const D = (rank: number) => makeCard('diamond', rank);
const C = (rank: number) => makeCard('club', rank);

/** 원하는 손패로 게임을 만든다. 0번 사람이 A를 낼 차례 */
function game(hands: Card[][], options: Partial<CheatOptions> = {}): CheatState {
  const s = createGame(setup(hands.map(() => 'human' as SeatKind), options), seededRandom(1));
  s.players.forEach((p, i) => (p.hand = hands[i]));
  s.aside = [];
  s.current = 0;
  s.first = 0;
  s.rank = 1;
  s.events = [];
  return s;
}

const ids = (cards: Card[]) => cards.map((c) => c.id);

describe('나눠 주기', () => {
  it('사람 수마다 정해진 장수를 나누고, 남는 카드는 빼 둔다', () => {
    for (const [n, per] of [
      [2, 18],
      [3, 17],
      [4, 13],
    ] as const) {
      const s = createGame(setup(Array(n).fill('ai-easy')), seededRandom(n));
      expect(s.players.every((p) => p.hand.length === per)).toBe(true);
      expect(s.aside).toHaveLength(52 - per * n);
      const all = allCards(s).map((c) => c.id);
      expect(new Set(all).size).toBe(52);
      expect(s.phase).toBe('play');
      expect(s.rank).toBe(1);
      expect(s.events[0]).toMatchObject({ type: 'deal', first: s.first });
    }
  });

  it('빨리 하기는 조금씩만 나눈다', () => {
    const s = createGame(setup(['human', 'ai-easy', 'ai-easy', 'ai-easy'], { deal: 'quick' }), seededRandom(2));
    expect(s.players.every((p) => p.hand.length === 8)).toBe(true);
    expect(s.aside).toHaveLength(20);
  });

  it('빈 자리는 빼고 2명 이상이어야 한다', () => {
    const s = createGame(setup(['empty', 'human', 'empty', 'ai-normal']), seededRandom(3));
    expect(s.players.map((p) => p.seat)).toEqual([1, 3]);
    expect(() => createGame(setup(['human']))).toThrow();
  });
});

describe('말과 숫자', () => {
  it('K 다음은 A', () => {
    expect(nextRank(1)).toBe(2);
    expect(nextRank(12)).toBe(13);
    expect(nextRank(13)).toBe(1);
  });

  it('말하기', () => {
    expect(claimText(7, 2)).toBe('7 두 장!');
    expect(claimText(1, 1)).toBe('A 한 장!');
    expect(claimText(13, 4)).toBe('K 네 장!');
    expect(rankWithObject(7)).toBe('7을');
    expect(rankWithObject(2)).toBe('2를');
    expect(rankWithObject(1)).toBe('A를');
    expect(rankWithObject(12)).toBe('Q을');
  });

  it('앞으로 내 차례에 낼 숫자', () => {
    const s = game([[S(1)], [S(2)], [S(3)]]);
    expect(upcomingRanks(s, 0, 3)).toEqual([1, 4, 7]);
    expect(upcomingRanks(s, 1, 3)).toEqual([2, 5, 8]);
    expect(upcomingRanks(s, 2, 2)).toEqual([3, 6]);
    s.rank = 12;
    expect(upcomingRanks(s, 1, 2)).toEqual([13, 3]);
  });
});

describe('카드 내기', () => {
  it('1~4장을 지금 숫자라고 말하며 내고, 숫자가 하나 올라간다', () => {
    const s0 = game([[S(1), H(1), S(5)], [D(2)], [C(3)]]);
    const s = applyAction(s0, { type: 'play', cardIds: ids([S(1), H(1)]) });
    expect(s.phase).toBe('doubt');
    expect(s.claim).toMatchObject({ player: 0, rank: 1, count: 2 });
    expect(s.players[0].hand).toEqual([S(5)]);
    expect(s.pile.map((pc) => pc.by)).toEqual([0, 0]);
    expect(s.rank).toBe(2);
    expect(s.doubters).toEqual([1, 2]);
    expect(actor(s)).toBe(1);
    expect(s.events[0]).toMatchObject({ type: 'play', player: 0, count: 2, rank: 1 });
  });

  it('없는 카드, 0장, 5장 이상, 같은 카드 두 번은 낼 수 없다', () => {
    const s = game([[S(1), H(1), D(1), C(1), S(2)], [D(2)]]);
    expect(applyAction(s, { type: 'play', cardIds: [] })).toBe(s);
    expect(applyAction(s, { type: 'play', cardIds: ids([S(1), H(1), D(1), C(1), S(2)]) })).toBe(s);
    expect(applyAction(s, { type: 'play', cardIds: ids([D(2)]) })).toBe(s);
    expect(applyAction(s, { type: 'play', cardIds: [S(1).id, S(1).id] })).toBe(s);
    // 의심 단계에서는 낼 수 없다
    const d = applyAction(s, { type: 'play', cardIds: ids([S(1)]) });
    expect(applyAction(d, { type: 'play', cardIds: ids([D(2)]) })).toBe(d);
  });

  it('거짓말인지는 낸 카드로 정한다', () => {
    expect(isLie({ rank: 7, cards: [S(7), H(7)] })).toBe(false);
    expect(isLie({ rank: 7, cards: [S(7), H(8)] })).toBe(true);
  });

  it('다음 사람만 의심하기 규칙', () => {
    const s = game([[S(1)], [D(2)], [C(3)], [H(4)]], { doubt: 'next' });
    expect(doubtQueue(s, 0)).toEqual([1]);
    expect(doubtQueue(s, 3)).toEqual([0]);
  });
});

describe('의심하기', () => {
  it('모두 믿으면 다음 사람이 다음 숫자를 낸다', () => {
    let s = game([[S(1), S(9)], [D(2)], [C(3)]]);
    s = applyAction(s, { type: 'play', cardIds: ids([S(9)]) });
    expect(applyAction(s, { type: 'pass', player: 2 })).toBe(s); // 차례가 아닌 사람
    s = applyAction(s, { type: 'pass', player: 1 });
    expect(s.phase).toBe('doubt');
    expect(actor(s)).toBe(2);
    s = applyAction(s, { type: 'pass', player: 2 });
    expect(s.phase).toBe('play');
    expect(s.current).toBe(1);
    expect(s.rank).toBe(2);
    expect(s.verdict).toMatchObject({ result: 'accepted', doubter: null });
    expect(s.pile).toHaveLength(1);
  });

  it('거짓말이 들키면 낸 사람이 더미를 모두 가져간다', () => {
    let s = game([[S(1), S(9)], [D(2), H(3)], [C(3)]]);
    s.pile = [{ card: C(13), by: 2 }];
    s = applyAction(s, { type: 'play', cardIds: ids([S(9)]) });
    s = applyAction(s, { type: 'doubt', player: 1 });
    expect(s.phase).toBe('play');
    expect(s.pile).toEqual([]);
    expect(ids(s.players[0].hand).sort()).toEqual(ids([S(1), C(13), S(9)]).sort());
    expect(s.verdict).toMatchObject({ result: 'lie', doubter: 1, taker: 0, taken: 2 });
    expect(s.players[1].stats).toMatchObject({ doubts: 1, rightDoubts: 1 });
    expect(s.players[0].stats).toMatchObject({ plays: 1, lies: 1, caught: 1, pickups: 1 });
    // 다음 사람이 이어서 다음 숫자
    expect(s.current).toBe(1);
    expect(s.rank).toBe(2);
    expect(s.events.map((e) => e.type)).toEqual(['doubt', 'reveal', 'pickup']);
  });

  it('진짜였으면 의심한 사람이 더미를 가져간다', () => {
    let s = game([[S(1), S(9)], [D(2)], [C(3)]]);
    s = applyAction(s, { type: 'play', cardIds: ids([S(1)]) });
    s = applyAction(s, { type: 'pass', player: 1 });
    s = applyAction(s, { type: 'doubt', player: 2 });
    expect(s.players[2].hand).toHaveLength(2);
    expect(s.verdict).toMatchObject({ result: 'truth', doubter: 2, taker: 2, taken: 1 });
    expect(s.current).toBe(1);
  });

  it('마지막 카드를 냈을 때 모두 믿거나 진짜로 밝혀지면 우승', () => {
    let s = game([[S(1)], [D(2)], [C(3)]]);
    s = applyAction(s, { type: 'play', cardIds: ids([S(1)]) });
    s = applyAction(s, { type: 'pass', player: 1 });
    s = applyAction(s, { type: 'pass', player: 2 });
    expect(s.phase).toBe('gameover');
    expect(s.winner).toBe(0);

    let t = game([[S(1)], [D(2)], [C(3)]]);
    t = applyAction(t, { type: 'play', cardIds: ids([S(1)]) });
    t = applyAction(t, { type: 'doubt', player: 1 });
    expect(t.phase).toBe('gameover');
    expect(t.winner).toBe(0);
    expect(rankings(t)[0]).toBe(0);
  });

  it('마지막 카드가 거짓말로 들키면 더미를 가져가고 계속한다', () => {
    let s = game([[S(9)], [D(2)], [C(3)]]);
    s = applyAction(s, { type: 'play', cardIds: ids([S(9)]) });
    s = applyAction(s, { type: 'doubt', player: 1 });
    expect(s.phase).toBe('play');
    expect(s.winner).toBeNull();
    expect(s.players[0].hand).toHaveLength(1);
  });

  it('원래 상태는 바뀌지 않는다', () => {
    const s = game([[S(1), S(9)], [D(2)], [C(3)]]);
    const copy = structuredClone(s);
    applyAction(s, { type: 'play', cardIds: ids([S(9)]) });
    expect(s).toEqual(copy);
  });
});

describe('끝까지', () => {
  it('컴퓨터끼리 하면 언제나 끝나고, 카드 52장이 그대로다', () => {
    for (const n of [2, 3, 4]) {
      for (let seed = 1; seed <= 12; seed++) {
        const kinds = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 'ai-normal' : 'ai-easy')) as SeatKind[];
        const rng = seededRandom(seed * 10 + n);
        let s = createGame(setup(kinds, { deal: seed % 3 === 0 ? 'quick' : 'all' }), rng);
        let steps = 0;
        while (s.phase !== 'gameover' && steps < 5000) {
          if (s.phase === 'play') {
            const p = s.players[s.current];
            s = applyAction(s, { type: 'play', cardIds: decidePlay(s, p.kind as 'ai-easy' | 'ai-normal', rng) });
          } else {
            const who = actor(s);
            const p = s.players[who];
            const yes = decideDoubt(s, who, p.kind as 'ai-easy' | 'ai-normal', rng);
            s = applyAction(s, { type: yes ? 'doubt' : 'pass', player: who });
          }
          steps++;
          expect(new Set(allCards(s).map((c) => c.id)).size).toBe(52);
        }
        expect(s.phase).toBe('gameover');
        expect(s.players[s.winner!].hand).toHaveLength(0);
      }
    }
  });
});
