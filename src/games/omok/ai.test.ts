import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { attackValue, decideMove, findVcf } from './ai';
import { DEFAULT_OPTIONS, applyAction, createGame, forbiddenAt } from './rules';
import type { Cell, DuelAiLevel, OmokOptions, OmokState, RuleSet } from './types';

const N = 15;
const at = (r: number, c: number) => r * N + c;

function withStones(black: [number, number][], white: [number, number][], current: 0 | 1, rule: RuleSet = 'free'): OmokState {
  const s = createGame({ seats: [{ kind: 'ai-hard', name: '' }, { kind: 'ai-hard', name: '' }], options: { ...DEFAULT_OPTIONS, rule } });
  for (const [r, c] of black) s.board[at(r, c)] = 0;
  for (const [r, c] of white) s.board[at(r, c)] = 1;
  s.current = current;
  return s;
}

/** 컴퓨터끼리 끝까지 둔다 */
export function playOut(a: DuelAiLevel, b: DuelAiLevel, seed: number, options: Partial<OmokOptions> = {}): OmokState {
  let s = createGame({ seats: [{ kind: a, name: '' }, { kind: b, name: '' }], options: { ...DEFAULT_OPTIONS, ...options } });
  const rng = seededRandom(seed);
  // 첫 몇 수는 조금씩 다르게 시작한다
  s = applyAction(s, { type: 'place', index: at(7, 7) });
  s = applyAction(s, { type: 'place', index: at(6 + Math.floor(rng() * 3), 6 + Math.floor(rng() * 3)) === at(7, 7) ? at(6, 6) : at(6 + Math.floor(rng() * 3), 6 + Math.floor(rng() * 3)) });
  while (s.phase === 'play' && s.moves.length < N * N) {
    const level = (s.current === 0 ? a : b) as DuelAiLevel;
    const next = applyAction(s, { type: 'place', index: decideMove(s, level, rng) });
    if (next === s) throw new Error('컴퓨터가 둘 수 없는 칸을 골랐어요');
    s = next;
  }
  return s;
}

const LEVELS: DuelAiLevel[] = ['ai-easy', 'ai-normal', 'ai-hard'];

describe('오목 컴퓨터: 판단', () => {
  it('바로 이길 수 있으면 이긴다 (보통·어려움)', () => {
    const s = withStones(
      [
        [7, 7],
        [7, 8],
        [7, 9],
        [7, 10],
      ],
      [
        [8, 7],
        [8, 8],
        [8, 9],
      ],
      0,
    );
    for (const level of ['ai-normal', 'ai-hard'] as DuelAiLevel[]) expect([at(7, 6), at(7, 11)]).toContain(decideMove(s, level, seededRandom(1)));
  });

  it('상대가 바로 이기는 곳은 막는다 (보통·어려움)', () => {
    const s = withStones(
      [
        [7, 7],
        [7, 8],
        [7, 9],
        [7, 10],
      ],
      [
        [3, 3],
        [9, 9],
        [10, 10],
      ],
      1,
    );
    s.board[at(7, 6)] = 1; // 한쪽은 이미 막혀 있다
    for (const level of ['ai-normal', 'ai-hard'] as DuelAiLevel[]) expect(decideMove(s, level, seededRandom(2))).toBe(at(7, 11));
  });

  it('상대의 열린 삼은 막는다 (어려움)', () => {
    const s = withStones(
      [
        [7, 6],
        [7, 7],
        [7, 8],
      ],
      [
        [9, 9],
        [10, 3],
      ],
      1,
    );
    const move = decideMove(s, 'ai-hard', seededRandom(3));
    expect([at(7, 5), at(7, 9), at(7, 4), at(7, 10)]).toContain(move);
  });

  it('금수 자리에는 두지 않는다', () => {
    // 흑이 (7,7)에 두면 쌍삼인데, 그 자리가 가장 좋은 자리처럼 보이는 판
    const s = withStones(
      [
        [7, 5],
        [7, 6],
        [5, 7],
        [6, 7],
      ],
      [
        [0, 0],
        [0, 14],
        [14, 0],
        [14, 14],
      ],
      0,
      'no33',
    );
    for (const level of LEVELS) {
      for (let k = 0; k < 5; k++) {
        const m = decideMove(s, level, seededRandom(k));
        expect(forbiddenAt([...s.board] as Cell[], N, m, 0, 'no33')).toBeNull();
      }
    }
  });

  it('모양 점수: 열린 사 > 사 > 열린 삼 > 닫힌 삼', () => {
    const b = withStones(
      [
        [7, 6],
        [7, 7],
        [7, 8],
      ],
      [],
      0,
    ).board;
    expect(attackValue(b, N, at(7, 9), 0, 'free').openFour).toBe(true);
    const closed = b.slice();
    closed[at(7, 5)] = 1;
    expect(attackValue(closed, N, at(7, 9), 0, 'free').fours).toBe(1);
    expect(attackValue(closed, N, at(7, 9), 0, 'free').openFour).toBe(false);
  });

  it('연속 사로 이기는 길을 찾는다', () => {
    // 흑: 사를 두면 백이 막고, 또 사를 두어 쌍사가 되는 모양
    const s = withStones(
      [
        [7, 7],
        [7, 8],
        [7, 9],
        [8, 10],
        [9, 10],
        [10, 10],
      ],
      [
        [7, 6],
        [11, 10],
        [3, 3],
        [3, 4],
        [3, 5],
        [12, 12],
      ],
      0,
    );
    const b = [...s.board] as Cell[];
    const first = findVcf(b, N, 0, 'free');
    expect(first).not.toBeNull();
    expect(decideMove(s, 'ai-hard', seededRandom(4))).not.toBe(-1);
  });

  it('어려움도 한 수를 오래 생각하지 않는다', () => {
    const s = playOut('ai-normal', 'ai-normal', 5);
    // 끝난 판에서 20수째로 돌아가 시간을 잰다
    let t = createGame({ seats: [{ kind: 'ai-hard', name: '' }, { kind: 'ai-hard', name: '' }], options: DEFAULT_OPTIONS });
    for (const m of s.moves.slice(0, Math.min(20, s.moves.length - 1))) t = applyAction(t, { type: 'place', index: m });
    const t0 = performance.now();
    for (let k = 0; k < 3; k++) decideMove(t, 'ai-hard', seededRandom(k));
    expect((performance.now() - t0) / 3).toBeLessThan(1500);
  }, 30_000);
});

describe('오목 컴퓨터: 실력', () => {
  it('언제나 둘 수 있는 칸을 고르고 판이 끝난다', () => {
    for (const rule of ['free', 'no33', 'renju'] as RuleSet[]) {
      const s = playOut('ai-normal', 'ai-easy', 11, { rule });
      expect(s.phase).toBe('gameover');
    }
  }, 60_000);

  it('보통은 쉬움을, 어려움은 보통을 이긴다 (흑백을 바꿔 가며)', () => {
    const duel = (strong: DuelAiLevel, weak: DuelAiLevel, games: number) => {
      let wins = 0;
      for (let g = 0; g < games; g++) {
        const strongBlack = g % 2 === 0;
        const s = playOut(strongBlack ? strong : weak, strongBlack ? weak : strong, 100 + g);
        if (s.winner === (strongBlack ? 0 : 1)) wins++;
      }
      return wins;
    };
    expect(duel('ai-normal', 'ai-easy', 8)).toBeGreaterThanOrEqual(5);
    expect(duel('ai-hard', 'ai-normal', 4)).toBeGreaterThanOrEqual(3);
  }, 120_000);
});
