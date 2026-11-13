import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { makeCard, type Card } from '../common/playingCards';
import { decideDoubt, decidePlay, holdChance, judgeClaim, truthChance, type AiLevel } from './ai';
import { DEFAULT_OPTIONS, actor, applyAction, createGame } from './rules';
import type { CheatOptions, CheatSetup, CheatState, SeatKind } from './types';

const S = (rank: number) => makeCard('spade', rank);
const H = (rank: number) => makeCard('heart', rank);
const D = (rank: number) => makeCard('diamond', rank);
const C = (rank: number) => makeCard('club', rank);
const ids = (cards: Card[]) => cards.map((c) => c.id);

function setup(kinds: SeatKind[], options: Partial<CheatOptions> = {}): CheatSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: `C${i}` })) as CheatSetup['seats'],
    options: { ...DEFAULT_OPTIONS, ...options },
  };
}

function game(hands: Card[][], options: Partial<CheatOptions> = {}): CheatState {
  const s = createGame(setup(hands.map(() => 'ai-normal' as SeatKind), options), seededRandom(1));
  s.players.forEach((p, i) => (p.hand = hands[i]));
  s.aside = [];
  s.current = 0;
  s.rank = 1;
  return s;
}

/** 컴퓨터끼리 끝까지 해서 이긴 자리를 돌려준다 */
function playOut(kinds: SeatKind[], seed: number): { winner: number; state: CheatState } {
  const rng = seededRandom(seed);
  let s = createGame(setup(kinds), rng);
  let steps = 0;
  while (s.phase !== 'gameover' && steps < 4000) {
    if (s.phase === 'play') s = applyAction(s, { type: 'play', cardIds: decidePlay(s, s.players[s.current].kind as AiLevel, rng) });
    else {
      const who = actor(s);
      s = applyAction(s, { type: decideDoubt(s, who, s.players[who].kind as AiLevel, rng) ? 'doubt' : 'pass', player: who });
    }
    steps++;
  }
  return { winner: s.winner ?? -1, state: s };
}

describe('확률 어림', () => {
  it('초기하 분포: 확률을 모두 더하면 1', () => {
    let sum = 0;
    for (let x = 0; x <= 4; x++) sum += holdChance(39, 4, 13, x);
    expect(sum).toBeCloseTo(1, 6);
    expect(holdChance(39, 4, 13, 5)).toBe(0);
  });

  it('마지막 한 장은 거의 거짓말, 손패가 많을 때 한 장은 대개 진짜', () => {
    expect(truthChance(39, 4, 1, 1)).toBeLessThan(0.2);
    expect(truthChance(39, 4, 13, 1)).toBeGreaterThan(0.6);
    // 내가 그 숫자를 많이 들고 있으면 덜 믿는다
    expect(truthChance(39, 1, 13, 1)).toBeLessThan(truthChance(39, 4, 13, 1));
  });
});

describe('거짓말쟁이 컴퓨터: 의심하기', () => {
  it('내 손패로 보아 확실한 거짓말이면 보통은 꼭 외친다', () => {
    // 0번이 'A 두 장'이라고 했는데 1번이 A를 세 장 들고 있다
    let s = game([[S(9), S(10), S(11)], [H(1), D(1), C(1), S(5)], [S(6)]]);
    s = applyAction(s, { type: 'play', cardIds: ids([S(9), S(10)]) });
    expect(judgeClaim(s, 1).certainLie).toBe(true);
    for (let k = 0; k < 20; k++) expect(decideDoubt(s, 1, 'ai-normal', seededRandom(k))).toBe(true);
  });

  it('내가 더미에 낸 카드도 센다', () => {
    let s = game([[S(9)], [H(1), D(1), S(5)], [S(6)]]);
    s.pile = [{ card: C(1), by: 1 }];
    s = applyAction(s, { type: 'play', cardIds: ids([S(9)]) });
    // 1번은 A를 손에 2장, 더미에 1장 → 남은 A는 1장뿐. 한 장이면 확실하지 않다
    expect(judgeClaim(s, 1)).toMatchObject({ certainLie: false });
    // 남이 낸 더미 카드는 모르는 카드다
    const t = structuredClone(s);
    t.pile[0].by = 2;
    expect(judgeClaim(t, 1).chance).toBeGreaterThan(judgeClaim(s, 1).chance);
  });

  it('몰래 보지 않는다: 낸 카드가 진짜든 거짓말이든 아는 것이 같으면 똑같이 판단한다', () => {
    let a = game([[S(1), S(9), S(4), S(7)], [H(5), D(6), S(8)], [C(2), C(3)]]);
    let b = game([[S(9), S(1), S(4), S(7)], [H(5), D(6), S(8)], [C(2), C(3)]]);
    a = applyAction(a, { type: 'play', cardIds: ids([S(1)]) });
    b = applyAction(b, { type: 'play', cardIds: ids([S(9)]) });
    expect(judgeClaim(a, 1)).toEqual(judgeClaim(b, 1));
    for (let k = 0; k < 10; k++) {
      for (const level of ['ai-easy', 'ai-normal'] as const) {
        expect(decideDoubt(a, 1, level, seededRandom(k))).toBe(decideDoubt(b, 1, level, seededRandom(k)));
      }
    }
  });

  it('모두 공개 모드에서는 보이는 대로 안다', () => {
    let s = game([[S(9), S(4)], [H(5)], [C(2)]], { handView: 'open' });
    s = applyAction(s, { type: 'play', cardIds: ids([S(9)]) });
    expect(judgeClaim(s, 1).certainLie).toBe(true);
  });
});

describe('거짓말쟁이 컴퓨터: 카드 내기', () => {
  it('지금 숫자 카드가 있으면 그 카드를 모두 낸다', () => {
    const s = game([[S(1), H(1), S(7), D(9), C(12)], [H(5)], [C(2)]]);
    for (const level of ['ai-easy', 'ai-normal'] as const) {
      expect(decidePlay(s, level, seededRandom(3)).sort()).toEqual(ids([S(1), H(1)]).sort());
    }
  });

  it('손에 남은 카드가 모두 지금 숫자면 한꺼번에 내서 끝낸다', () => {
    const s = game([[S(1), H(1), D(1)], [H(5)], [C(2)]]);
    expect(decidePlay(s, 'ai-normal', seededRandom(1)).sort()).toEqual(ids([S(1), H(1), D(1)]).sort());
  });

  it('보통: 거짓말할 때는 곧 내 차례에 낼 숫자는 남긴다', () => {
    // 3명, 0번은 지금 A, 다음 차례에 4, 그다음 7을 낸다
    const s = game([[S(4), S(7), S(12)], [H(5)], [C(2)]]);
    for (let k = 0; k < 20; k++) expect(decidePlay(s, 'ai-normal', seededRandom(k))).toEqual([S(12).id]);
  });

  it('언제나 내 손패에서 1~4장을 낸다', () => {
    const rng = seededRandom(5);
    const s = createGame(setup(['ai-normal', 'ai-easy', 'ai-normal']), rng);
    for (let k = 0; k < 30; k++) {
      for (const level of ['ai-easy', 'ai-normal'] as const) {
        const cards = decidePlay(s, level, rng);
        expect(cards.length).toBeGreaterThanOrEqual(1);
        expect(cards.length).toBeLessThanOrEqual(4);
        expect(cards.every((id) => s.players[s.current].hand.some((c) => c.id === id))).toBe(true);
      }
    }
  });
});

describe('실력', () => {
  it('보통은 쉬움보다 자주 이긴다', () => {
    let normal = 0;
    const games = 40;
    for (let g = 0; g < games; g++) {
      const { winner } = playOut(['ai-normal', 'ai-easy', 'ai-normal', 'ai-easy'], 500 + g);
      if (winner === 0 || winner === 2) normal++;
    }
    expect(normal / games).toBeGreaterThan(0.7);
  });

  it('보통끼리 해도 금방 끝난다', () => {
    for (let g = 0; g < 10; g++) {
      const { state } = playOut(['ai-normal', 'ai-normal', 'ai-normal'], 900 + g);
      expect(state.phase).toBe('gameover');
      expect(state.plays).toBeLessThan(400);
    }
  });
});
