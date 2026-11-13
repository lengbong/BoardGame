import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import type { DuelAiLevel, DuelKind } from '../common/duel';
import { chooseColumn, decideAction } from './ai';
import { DEFAULT_OPTIONS, applyAction, createGame, legalColumns, winningColumns } from './rules';
import type { FourLineState } from './types';

function play(cols: number[], kinds: [DuelKind, DuelKind] = ['ai-hard', 'ai-hard']): FourLineState {
  let s = createGame({
    seats: [
      { kind: kinds[0], name: '' },
      { kind: kinds[1], name: '' },
    ],
    options: DEFAULT_OPTIONS,
  });
  for (const col of cols) s = applyAction(s, { type: 'drop', col });
  return s;
}

/** 시간 대신 호출 횟수로 흐르는 시계 (테스트가 컴퓨터 속도와 상관없이 늘 같게) */
function fakeClock() {
  let t = 0;
  return () => t++;
}

const LEVELS: DuelAiLevel[] = ['ai-easy', 'ai-normal', 'ai-hard'];
const quick = () => ({ timeMs: 20, now: fakeClock() });

function playOut(kinds: [DuelAiLevel, DuelAiLevel], seed: number, opening: number[] = []): FourLineState {
  const rng = seededRandom(seed);
  let s = play(opening, kinds);
  let guard = 0;
  while (s.phase === 'play' && guard++ < 50) {
    const action = decideAction(s, kinds[s.current], rng, quick());
    expect(legalColumns(s.board)).toContain(action.col);
    s = applyAction(s, action);
  }
  return s;
}

describe('사목 컴퓨터', () => {
  it('모든 수준이 바로 이길 수 있으면 이긴다', () => {
    // 빨강 A1 B1 C1 → D1이면 이김 (노랑은 A2 B2 C2로 같은 위협이 있어 막기보다 이기기가 먼저)
    const s = play([0, 0, 1, 1, 2, 2]);
    for (const level of LEVELS) expect(chooseColumn(s, level, seededRandom(3), quick())).toBe(3);
  });

  it('보통·어려움은 바로 질 자리를 막는다', () => {
    // 노랑 차례, 빨강이 D1 E1 F1 → C1이나 G1 중 하나... 여기서는 한쪽만 열려 있게 만든다
    const s = play([3, 3, 4, 4, 5, 6]);
    // 빨강: D1 E1 F1, 노랑: D2 E2 G1 → 빨강은 C1에 두면 이긴다
    expect(winningColumns(s.board, 0)).toEqual([2]);
    expect(s.current).toBe(0);
    const t = applyAction(s, { type: 'drop', col: 0 }); // 빨강이 딴 데 두면
    expect(chooseColumn(t, 'ai-normal', seededRandom(1))).toBe(2);
    expect(chooseColumn(t, 'ai-hard', seededRandom(1), quick())).toBe(2);
  });

  it('세로 위협도 막는다', () => {
    const s = play([3, 0, 3, 0, 3]);
    expect(winningColumns(s.board, 0)).toEqual([3]);
    expect(chooseColumn(s, 'ai-normal', seededRandom(1))).toBe(3);
    expect(chooseColumn(s, 'ai-hard', seededRandom(1), quick())).toBe(3);
  });

  it('쉬움도 대부분 막는다 (가끔 놓친다)', () => {
    const s = play([3, 0, 3, 0, 3]);
    const picks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seed) => chooseColumn(s, 'ai-easy', seededRandom(seed)));
    expect(picks.filter((c) => c === 3).length).toBeGreaterThanOrEqual(4);
  });

  it('보통·어려움은 상대에게 바로 위 칸을 내주는 수를 피한다', () => {
    // 빨강 A1 C1 G1 G2, 노랑 B1 A2 B2 C2. 빨강이 D1에 두면 노랑이 D2로 이긴다
    const s = play([0, 1, 2, 0, 6, 1, 6, 2]);
    expect(s.current).toBe(0);
    expect(winningColumns(s.board, 0)).toEqual([]);
    expect(winningColumns(s.board, 1)).toEqual([]);
    for (const seed of [1, 2, 3]) {
      expect(chooseColumn(s, 'ai-normal', seededRandom(seed))).not.toBe(3);
      expect(chooseColumn(s, 'ai-hard', seededRandom(seed), quick())).not.toBe(3);
    }
  });

  it('어려움은 두 군데 위협(양쪽 열린 셋)을 만들어 이긴다', () => {
    // 빨강 C1 D1, 노랑은 위에 쌓음. 빨강이 B1이나 E1에 두면 양쪽이 열린 셋이 되어 막을 수 없다
    const s = play([2, 2, 3, 3]);
    const col = chooseColumn(s, 'ai-hard', seededRandom(1), quick());
    expect([1, 4]).toContain(col);
  });

  it('첫 수는 가운데에 둔다 (어려움)', () => {
    const s = play([]);
    expect(chooseColumn(s, 'ai-hard', seededRandom(1), quick())).toBe(3);
  });

  it('꽉 찬 열에는 두지 않는다', () => {
    const s = play([3, 3, 3, 3, 3, 3]);
    for (const level of LEVELS) {
      for (const seed of [1, 2, 3]) expect(chooseColumn(s, level, seededRandom(seed), quick())).not.toBe(3);
    }
  });

  it('어려움은 생각 시간을 지킨다', () => {
    const s = play([3, 2, 3, 4]);
    const t0 = performance.now();
    const col = chooseColumn(s, 'ai-hard', seededRandom(1), { timeMs: 150 });
    const spent = performance.now() - t0;
    expect(legalColumns(s.board)).toContain(col);
    expect(spent).toBeLessThan(150 + 200);
  });

  it('끝난 게임에서는 두지 않는다', () => {
    const s = play([0, 0, 1, 1, 2, 2, 3]);
    expect(chooseColumn(s, 'ai-hard')).toBeNull();
  });
});

describe('사목 컴퓨터끼리 끝까지', () => {
  const pairs: [DuelAiLevel, DuelAiLevel][] = [
    ['ai-easy', 'ai-easy'],
    ['ai-easy', 'ai-normal'],
    ['ai-normal', 'ai-hard'],
    ['ai-hard', 'ai-hard'],
  ];
  for (const pair of pairs) {
    it(`${pair[0]} 대 ${pair[1]}`, () => {
      for (const seed of [1, 2, 3]) {
        const s = playOut(pair, seed);
        expect(s.phase).toBe('gameover');
        if (s.winner !== null) expect(s.winLine!.length).toBeGreaterThanOrEqual(4);
        else expect(s.moves).toHaveLength(42);
      }
    });
  }

  it('어려움은 쉬움과 보통을 이긴다', () => {
    let wins = 0;
    let games = 0;
    for (const seed of [11, 12, 13]) {
      for (const weak of ['ai-easy', 'ai-normal'] as const) {
        const hardFirst = seed % 2 === 1;
        const s = playOut(hardFirst ? ['ai-hard', weak] : [weak, 'ai-hard'], seed);
        games++;
        if (s.winner === (hardFirst ? 0 : 1)) wins++;
      }
    }
    expect(wins).toBeGreaterThanOrEqual(games - 1);
  });

  it('보통은 쉬움을 대체로 이긴다', () => {
    let wins = 0;
    for (const seed of [21, 22, 23, 24]) {
      const normalFirst = seed % 2 === 0;
      const s = playOut(normalFirst ? ['ai-normal', 'ai-easy'] : ['ai-easy', 'ai-normal'], seed);
      if (s.winner === (normalFirst ? 0 : 1)) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(3);
  });
});
