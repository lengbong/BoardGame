import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import type { DuelAiLevel } from '../common/duel';
import { decideAction, fastMove } from './ai';
import { DEFAULT_OPTIONS, applyAction, createGame, legalMoves, simulateMove } from './rules';
import type { MancalaOptions, MancalaState, SeedCount, Side } from './types';

function game(kinds: [DuelAiLevel, DuelAiLevel] = ['ai-normal', 'ai-normal'], options: Partial<MancalaOptions> = {}): MancalaState {
  return createGame({
    seats: [
      { kind: kinds[0], name: '' },
      { kind: kinds[1], name: '' },
    ],
    options: { ...DEFAULT_OPTIONS, ...options },
    hints: true,
  });
}

function position(pits0: number[], store0: number, pits1: number[], store1: number, current: Side = 0): MancalaState {
  const s = game();
  s.board = [...pits0, store0, ...pits1, store1];
  s.current = current;
  return s;
}

/** 테스트에서는 어려움도 시간 대신 깊이로만 끊어서 결과가 늘 같게 한다. */
const FAST = { timeMs: Infinity, maxDepth: 7 };
const optsFor = (level: DuelAiLevel) => (level === 'ai-hard' ? FAST : {});

function playOut(kinds: [DuelAiLevel, DuelAiLevel], seed: number, options: Partial<MancalaOptions> = {}): MancalaState {
  const rng = seededRandom(seed);
  let s = game(kinds, options);
  const totalSeeds = s.options.seeds * 12;
  for (let guard = 0; s.phase === 'play' && guard < 400; guard++) {
    const level = s.players[s.current].kind as DuelAiLevel;
    const action = decideAction(s, level, rng, optsFor(level));
    expect(legalMoves(s)).toContain(action.pit);
    const next = applyAction(s, action);
    expect(next).not.toBe(s);
    expect(next.board.reduce((a, b) => a + b, 0)).toBe(totalSeeds);
    s = next;
  }
  return s;
}

describe('빠른 계산', () => {
  it('컴퓨터용 빠른 한 수는 규칙 엔진과 결과가 같다 (변형 규칙 포함)', () => {
    const rng = seededRandom(5);
    const out = new Array<number>(14);
    for (let trial = 0; trial < 400; trial++) {
      const board = Array.from({ length: 14 }, (_, i) => (i === 6 || i === 13 ? Math.floor(rng() * 20) : Math.floor(rng() * (trial % 5 === 0 ? 20 : 6))));
      const side: Side = trial % 2 === 0 ? 0 : 1;
      const opts = { captureEmpty: trial % 3 === 0, sweep: trial % 4 === 0 ? ('emptier' as const) : ('owner' as const) };
      for (let k = 0; k < 6; k++) {
        const pit = side * 7 + k;
        if (board[pit] === 0) continue;
        const r = simulateMove(board, side, pit, opts);
        const code = fastMove(board, side, pit, opts, out);
        expect(out).toEqual(r.board);
        expect(code).toBe(r.gameOver ? 2 : r.extra ? 1 : 0);
      }
    }
  });
});

describe('컴퓨터 플레이어', () => {
  it('어느 수준이든 둘 수 있는 구멍만 고른다', () => {
    const rng = seededRandom(11);
    const levels: DuelAiLevel[] = ['ai-easy', 'ai-normal', 'ai-hard'];
    for (let trial = 0; trial < 60; trial++) {
      const s = game();
      s.board = Array.from({ length: 14 }, (_, i) => (i === 6 || i === 13 ? 0 : rng() < 0.4 ? 0 : 1 + Math.floor(rng() * 7)));
      s.current = trial % 2 === 0 ? 0 : 1;
      if (legalMoves(s).length === 0) s.board[s.current * 7 + 2] = 3;
      for (const level of levels) expect(legalMoves(s)).toContain(decideAction(s, level, rng, { timeMs: Infinity, maxDepth: 4 }).pit);
    }
    // 둘 곳이 하나뿐이면 그 구멍을 바로 고른다
    const only = position([0, 0, 0, 5, 0, 0], 10, [1, 1, 1, 1, 1, 1], 10);
    expect(decideAction(only, 'ai-hard', seededRandom(1))).toEqual({ type: 'sow', pit: 3 });
  });

  it('보통·어려움은 뻔한 "한 번 더"를 놓치지 않는다', () => {
    // 3번 구멍(인덱스 2)의 씨앗 4개는 창고에서 끝난다. 다른 수는 아무것도 얻지 못한다.
    const s = position([1, 1, 4, 0, 0, 0], 0, [1, 0, 0, 0, 0, 0], 0);
    for (const level of ['ai-normal', 'ai-hard'] as const) {
      for (let seed = 1; seed <= 3; seed++) expect(decideAction(s, level, seededRandom(seed), optsFor(level)).pit).toBe(2);
    }
  });

  it('보통·어려움은 큰 가져오기를 한다', () => {
    // 1번 구멍(인덱스 0)의 씨앗 1개가 빈 2번 구멍에 떨어지면 건너편 9개를 가져온다.
    const s = position([1, 0, 0, 0, 3, 0], 5, [3, 2, 0, 0, 9, 1], 5);
    for (const level of ['ai-normal', 'ai-hard'] as const) {
      for (let seed = 1; seed <= 3; seed++) expect(decideAction(s, level, seededRandom(seed), optsFor(level)).pit).toBe(0);
    }
  });

  it('한 번 더를 여러 번 이어서 하는 순서를 찾는다 (창고에 가까운 구멍 먼저)', () => {
    // 6번(1알) → 한 번 더, 5번(2알) → 한 번 더, 다시 6번 → 한 번 더, 4번(3알) → 한 번 더 …
    const s = position([0, 0, 0, 3, 2, 1], 0, [4, 4, 4, 4, 4, 4], 0);
    let t = s;
    const picks: number[] = [];
    while (t.phase === 'play' && t.current === 0) {
      const a = decideAction(t, 'ai-hard', seededRandom(3), FAST);
      picks.push(a.pit);
      t = applyAction(t, a);
    }
    expect(picks.slice(0, 4)).toEqual([5, 4, 5, 3]);
  });

  it('상대에게 큰 가져오기를 내주는 수를 피한다', () => {
    // 1번 구멍(0)을 두면 상대가 8번 칸(2알)으로 빈 10번 칸에 끝내 내 4번 구멍(3)의 씨앗 8개를 가져간다.
    // 4번 구멍을 옮기면 잃는 씨앗이 훨씬 적다.
    const s = position([2, 0, 0, 8, 0, 0], 10, [2, 0, 0, 0, 0, 0], 10);
    for (const level of ['ai-normal', 'ai-hard'] as const) {
      for (let seed = 1; seed <= 3; seed++) expect(decideAction(s, level, seededRandom(seed), optsFor(level)).pit).toBe(3);
    }
  });

  it('어려움은 시간 한도를 지킨다', () => {
    const s = game(['ai-hard', 'ai-hard'], { seeds: 6 });
    const start = performance.now();
    const a = decideAction(s, 'ai-hard', seededRandom(4), { timeMs: 80 });
    expect(legalMoves(s)).toContain(a.pit);
    expect(performance.now() - start).toBeLessThan(400);
  });

  it('같은 시드면 같은 수를 둔다', () => {
    const s = game();
    const a = decideAction(s, 'ai-normal', seededRandom(9));
    const b = decideAction(s, 'ai-normal', seededRandom(9));
    expect(a).toEqual(b);
  });
});

describe('컴퓨터끼리 끝까지', () => {
  const pairs: [DuelAiLevel, DuelAiLevel][] = [
    ['ai-easy', 'ai-easy'],
    ['ai-easy', 'ai-normal'],
    ['ai-normal', 'ai-hard'],
    ['ai-hard', 'ai-easy'],
    ['ai-hard', 'ai-hard'],
  ];
  for (const pair of pairs) {
    it(`${pair[0]} 대 ${pair[1]}: 여러 시드·씨앗 수로 끝까지 둔다`, () => {
      for (const [seed, seeds] of [
        [1, 3],
        [2, 4],
        [3, 6],
      ] as [number, SeedCount][]) {
        const s = playOut(pair, seed * 31 + pair[0].length, { seeds, captureEmpty: seed === 2, sweep: seed === 3 ? 'emptier' : 'owner' });
        expect(s.phase).toBe('gameover');
        expect(s.result).not.toBeNull();
        const [a, b] = s.result!.scores;
        expect(a + b).toBe(seeds * 12);
        expect(s.result!.winner).toBe(a === b ? null : a > b ? 0 : 1);
      }
    });
  }

  it('어려움은 쉬움을 거의 항상 이긴다', () => {
    let wins = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const hardFirst = seed % 2 === 0;
      const s = playOut(hardFirst ? ['ai-hard', 'ai-easy'] : ['ai-easy', 'ai-hard'], seed);
      if (s.result!.winner === (hardFirst ? 0 : 1)) wins += 1;
    }
    expect(wins).toBeGreaterThanOrEqual(5);
  });

  it('보통은 쉬움을 대체로 이긴다', () => {
    let wins = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const normalFirst = seed % 2 === 1;
      const s = playOut(normalFirst ? ['ai-normal', 'ai-easy'] : ['ai-easy', 'ai-normal'], 100 + seed);
      if (s.result!.winner === (normalFirst ? 0 : 1)) wins += 1;
    }
    expect(wins).toBeGreaterThanOrEqual(4);
  });
});
