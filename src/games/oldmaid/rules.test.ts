import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { isJoker, makeCard, makeJoker, type Card } from '../common/playingCards';
import { decideAction } from './ai';
import { DEFAULT_OPTIONS, applyAction, createGame, drawTarget, findPairs, jokerHolder, nextActive, prevActive, rankings } from './rules';
import type { OldMaidOptions, OldMaidSetup, OldMaidState, SeatKind } from './types';

function setup(kinds: SeatKind[], options: Partial<OldMaidOptions> = {}): OldMaidSetup {
  return {
    seats: kinds.map((kind, i) => ({ kind, name: `P${i}` })) as OldMaidSetup['seats'],
    options: { ...DEFAULT_OPTIONS, ...options },
  };
}

const S = (rank: number) => makeCard('spade', rank);
const H = (rank: number) => makeCard('heart', rank);
const D = (rank: number) => makeCard('diamond', rank);
const C = (rank: number) => makeCard('club', rank);
const J = () => makeJoker();

/** 원하는 손패로 '뽑기' 단계의 게임을 만든다. 0번 사람 차례. */
function game(hands: Card[][], options: Partial<OldMaidOptions> = {}): OldMaidState {
  const kinds = (['human', 'human', 'human', 'human'] as SeatKind[]).map((k, i) => (i < hands.length ? k : 'empty')) as SeatKind[];
  const s = createGame(setup(kinds, options), seededRandom(1));
  s.players.forEach((p, i) => (p.hand = hands[i]));
  s.phase = 'play';
  s.current = 0;
  s.first = 0;
  s.events = [];
  s.jokerKnownBy = [jokerHolder(s)].filter((i) => i >= 0);
  return s;
}

function totalCards(s: OldMaidState): number {
  return s.discard.length + s.players.reduce((n, p) => n + p.hand.length, 0);
}

describe('나눠 주기', () => {
  it('53장을 모두 나눠 주고, 사람마다 장수 차이는 1장 이하', () => {
    for (const n of [2, 3, 4]) {
      const kinds = (['ai-easy', 'ai-easy', 'ai-easy', 'ai-easy'] as SeatKind[]).map((k, i) => (i < n ? k : 'empty')) as SeatKind[];
      const s = createGame(setup(kinds), seededRandom(n));
      const sizes = s.players.map((p) => p.hand.length);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(53);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      const ids = s.players.flatMap((p) => p.hand.map((c) => c.id));
      expect(new Set(ids).size).toBe(53);
      expect(s.phase).toBe('deal');
      expect(s.events[0]).toMatchObject({ type: 'deal' });
      // 처음 뽑는 사람이 한 장 더 받는다 (53장)
      expect(s.players[s.first].hand.length).toBe(Math.max(...sizes));
    }
  });

  it('빈 자리는 빼고 2명 이상이어야 한다', () => {
    const s = createGame(setup(['empty', 'human', 'empty', 'ai-normal']), seededRandom(3));
    expect(s.players.map((p) => p.seat)).toEqual([1, 3]);
    expect(() => createGame(setup(['human', 'empty', 'empty', 'empty']))).toThrow();
  });

  it('처음에는 조커를 든 사람만 조커 자리를 안다', () => {
    const s = createGame(setup(['ai-easy', 'ai-easy', 'ai-easy']), seededRandom(9));
    expect(s.jokerKnownBy).toEqual([jokerHolder(s)]);
  });
});

describe('짝 버리기', () => {
  it('같은 숫자 두 장은 버리고, 세 장이면 한 장이 남고, 네 장이면 모두 버린다', () => {
    expect(findPairs([S(7), H(3), D(7)])).toEqual({ kept: [H(3)], pairs: [S(7), D(7)] });
    expect(findPairs([S(7), H(7), D(7)]).kept).toEqual([D(7)]);
    expect(findPairs([S(7), H(7), D(7), C(7)])).toEqual({ kept: [], pairs: [S(7), H(7), D(7), C(7)] });
  });

  it('조커는 짝이 없고, 남은 카드의 순서는 그대로', () => {
    const { kept, pairs } = findPairs([J(), S(2), H(9), S(5), D(2), C(11)]);
    expect(kept).toEqual([J(), H(9), S(5), C(11)]);
    expect(pairs).toEqual([S(2), D(2)]);
  });

  it('처음에 모두 짝을 버리면 손에 같은 숫자가 두 장 남지 않는다', () => {
    const s0 = createGame(setup(['ai-easy', 'ai-easy', 'ai-easy', 'ai-easy']), seededRandom(5));
    const s = applyAction(s0, { type: 'discardPairs' });
    expect(s.phase).toBe('play');
    for (const p of s.players) {
      const ranks = p.hand.filter((c) => !isJoker(c)).map((c) => c.rank);
      expect(new Set(ranks).size).toBe(ranks.length);
    }
    expect(s.discard.length % 2).toBe(0);
    expect(totalCards(s)).toBe(53);
    expect(jokerHolder(s)).toBeGreaterThanOrEqual(0);
    expect(s.events.filter((e) => e.type === 'pairs').length).toBeGreaterThan(0);
  });

  it('짝 버리기는 한 번만 한다', () => {
    const s = applyAction(createGame(setup(['ai-easy', 'ai-easy']), seededRandom(2)), { type: 'discardPairs' });
    expect(applyAction(s, { type: 'discardPairs' })).toBe(s);
  });

  it('짝을 버리고 손이 비면 바로 빠진다', () => {
    const s0 = game([[S(4), H(4)], [J(), S(8)], [H(8), C(2), D(2)]]);
    s0.phase = 'deal';
    const s = applyAction(s0, { type: 'discardPairs' });
    expect(s.finished).toEqual([0]);
    expect(s.players[0].place).toBe(1);
    expect(s.current).toBe(1);
  });
});

describe('카드 뽑기', () => {
  it('다음 사람 손패에서 고른 카드를 뽑아 내 손패 끝에 둔다', () => {
    const s0 = game([[S(2), H(5)], [D(9), J(), C(12)], [S(9)]]);
    expect(drawTarget(s0)).toBe(1);
    const s = applyAction(s0, { type: 'draw', index: 2 });
    expect(s.players[1].hand).toEqual([D(9), J()]);
    expect(s.players[0].hand).toEqual([S(2), H(5), C(12)]);
    expect(s.events[0]).toMatchObject({ type: 'draw', player: 0, from: 1, index: 2 });
    expect(s.current).toBe(1);
    expect(s.turn).toBe(s0.turn + 1);
  });

  it('뽑은 카드가 짝이 맞으면 두 장을 버린다', () => {
    const s0 = game([[S(2), H(5)], [D(5), J()], [S(9), H(9)]]);
    const s = applyAction(s0, { type: 'draw', index: 0 });
    expect(s.players[0].hand).toEqual([S(2)]);
    expect(s.discard.slice(-2)).toEqual([H(5), D(5)]);
    expect(s.events.find((e) => e.type === 'pair')).toMatchObject({ player: 0, cards: [H(5), D(5)] });
    expect(s.lastDraw).toMatchObject({ player: 0, from: 1, paired: true });
  });

  it('없는 자리를 뽑으면 아무 일도 없다', () => {
    const s0 = game([[S(2)], [D(5), J()]]);
    expect(applyAction(s0, { type: 'draw', index: 2 })).toBe(s0);
    expect(applyAction(s0, { type: 'draw', index: -1 })).toBe(s0);
    expect(applyAction(s0, { type: 'draw', index: 0.5 })).toBe(s0);
  });

  it('카드를 다 턴 사람은 건너뛰고 그다음 사람에게서 뽑는다', () => {
    const s0 = game([[S(2), H(6)], [], [D(2), J()], [C(6), H(9)]]);
    s0.finished = [1];
    expect(nextActive(s0, 0)).toBe(2);
    expect(prevActive(s0, 2)).toBe(0);
    const s = applyAction(s0, { type: 'draw', index: 0 });
    expect(s.players[2].hand).toEqual([J()]);
    expect(s.players[0].hand).toEqual([H(6)]);
    expect(s.current).toBe(2);
  });

  it('마지막 카드를 뽑힌 사람이 빠지고, 다음 차례는 그다음 사람', () => {
    const s0 = game([[S(2), H(6)], [D(9)], [J(), C(2)]]);
    const s = applyAction(s0, { type: 'draw', index: 0 });
    expect(s.finished).toEqual([1]);
    expect(s.players[1].place).toBe(1);
    expect(s.events.find((e) => e.type === 'out')).toMatchObject({ player: 1, place: 1 });
    expect(s.current).toBe(2);
  });

  it('한 번에 둘이 빠지면 뽑힌 사람이 먼저 빠진다', () => {
    const s0 = game([[S(2)], [D(2)], [J(), C(9)], [H(9)]]);
    const s = applyAction(s0, { type: 'draw', index: 0 });
    expect(s.finished).toEqual([1, 0]);
    expect(s.players[0].place).toBe(2);
    expect(s.current).toBe(2);
  });

  it('남의 손패를 섞어도, 1장뿐이어도 섞을 수 없다', () => {
    const s0 = game([[S(2)], [D(5), J(), C(3)]]);
    expect(applyAction(s0, { type: 'shuffle', player: 0 })).toBe(s0);
    expect(applyAction(s0, { type: 'shuffle', player: 7 })).toBe(s0);
    const s = applyAction(s0, { type: 'shuffle', player: 1 }, seededRandom(4));
    expect([...s.players[1].hand].sort((a, b) => a.id - b.id)).toEqual([...s0.players[1].hand].sort((a, b) => a.id - b.id));
    expect(s.events[0]).toMatchObject({ type: 'shuffle', player: 1 });
    expect(s.current).toBe(0);
  });

  it('뽑은 위치(왼쪽·가운데·오른쪽)를 기록한다', () => {
    let s = game([[S(2), H(3)], [D(5), J(), C(8), H(11)], [S(9), C(10)]]);
    s = applyAction(s, { type: 'draw', index: 3 });
    expect(s.picks[0]).toEqual([0, 0, 1]);
    s = applyAction(s, { type: 'draw', index: 0 });
    expect(s.picks[1]).toEqual([1, 0, 0]);
  });
});

describe('조커와 도둑', () => {
  it('조커를 마지막까지 든 사람이 도둑이고 꼴찌', () => {
    const s0 = game([[H(5)], [S(5), J()]]);
    const s = applyAction(s0, { type: 'draw', index: 0 });
    expect(s.phase).toBe('gameover');
    expect(s.thief).toBe(1);
    expect(rankings(s)).toEqual([0, 1]);
    expect(s.events.some((e) => e.type === 'thief' && e.player === 1)).toBe(true);
  });

  it('조커를 뽑아 오고 상대가 빠지면 내가 도둑', () => {
    const s0 = game([[S(3)], [J()], [H(3)]]);
    s0.current = 0;
    // 0이 1의 조커를 뽑는다 → 1은 빠짐. 0은 [♠3, 조커], 2는 [♥3]
    let s = applyAction(s0, { type: 'draw', index: 0 });
    expect(s.finished).toEqual([1]);
    expect(s.current).toBe(2);
    // 2가 0에게서 ♠3을 뽑으면 2도 빠지고 0만 남는다
    const idx = s.players[0].hand.findIndex((c) => c.rank === 3);
    s = applyAction(s, { type: 'draw', index: idx });
    expect(s.phase).toBe('gameover');
    expect(s.thief).toBe(0);
    expect(rankings(s)).toEqual([1, 2, 0]);
  });

  it('조커가 옮겨 가는 것을 본 사람은 자리를 알고, 섞으면 든 사람만 안다', () => {
    const s0 = game([[S(2), H(4)], [D(5), J()], [S(9), H(9), C(3)]]);
    s0.jokerKnownBy = [1];
    let s = applyAction(s0, { type: 'draw', index: 1 });
    expect(new Set(s.jokerKnownBy)).toEqual(new Set([0, 1]));
    s = applyAction(s, { type: 'shuffle', player: 0 }, seededRandom(8));
    expect(s.jokerKnownBy).toEqual([0]);
  });

  it('조커 없는 사람이 섞어도 조커를 아는 사람은 그대로', () => {
    const s0 = game([[S(2), H(4)], [D(5), J()], [S(9), H(9), C(3)]]);
    s0.jokerKnownBy = [1, 2];
    const s = applyAction(s0, { type: 'shuffle', player: 0 }, seededRandom(8));
    expect(s.jokerKnownBy).toEqual([1, 2]);
  });

  it('컴퓨터처럼 뽑고 섞으면 손패가 섞이고, jokerSpot 자리에 조커를 둔다', () => {
    const s0 = game([[S(2), H(4), S(6), S(8), S(10)], [D(5), J()], [S(9)]]);
    const s = applyAction(s0, { type: 'draw', index: 1, shuffle: true, jokerSpot: 0 }, seededRandom(3));
    expect(s.players[0].hand[0]).toEqual(J());
    expect(s.players[0].hand).toHaveLength(6);
    expect(s.jokerKnownBy).toEqual([0]);
    const s2 = applyAction(s0, { type: 'draw', index: 1, shuffle: true, jokerSpot: 1 }, seededRandom(3));
    expect(s2.players[0].hand[5]).toEqual(J());
  });
});

describe('컴퓨터끼리 끝까지', () => {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 11, 42];
  for (const n of [2, 3, 4]) {
    it(`${n}명: 여러 시드로 끝까지 진행되고 도둑이 조커를 들고 있다`, () => {
      for (const seed of seeds) {
        const rng = seededRandom(seed * 31 + n);
        const kinds = (['ai-normal', 'ai-easy', 'ai-normal', 'ai-easy'] as SeatKind[]).map((k, i) => (i < n ? k : 'empty')) as SeatKind[];
        let s = createGame(setup(kinds, { handView: seed % 2 === 0 ? 'open' : 'cover' }), rng);
        let steps = 0;
        while (s.phase !== 'gameover' && steps < 2000) {
          const p = s.players[s.current];
          const next = applyAction(s, decideAction(s, p.kind === 'human' ? 'ai-normal' : p.kind, rng), rng);
          expect(next).not.toBe(s);
          s = next;
          expect(totalCards(s)).toBe(53);
          steps += 1;
        }
        expect(s.phase).toBe('gameover');
        expect(s.thief).not.toBeNull();
        expect(s.players[s.thief!].hand).toEqual([J()]);
        expect(s.discard).toHaveLength(52);
        expect(s.finished).toHaveLength(n - 1);
        expect(new Set(rankings(s)).size).toBe(n);
      }
    });
  }
});
