import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { decideGuess, decideSecret } from './ai';
import { DEFAULT_OPTIONS, applyAction, createGame, isConsistent, isValidCode, randomCode } from './rules';
import type { BaseballOptions, BaseballState, CodeLength, DuelAiLevel } from './types';

/** 컴퓨터 혼자 맞히기를 끝까지 해서 친 횟수를 센다 */
function solve(level: DuelAiLevel, options: Partial<BaseballOptions>, seed: number): { count: number; state: BaseballState } {
  const rng = seededRandom(seed);
  let s = createGame({ seats: [{ kind: 'human', name: '' }, { kind: 'human', name: '' }], options: { ...DEFAULT_OPTIONS, mode: 'solo', helper: false, ...options } }, rng);
  while (s.phase === 'play' && s.players[0].guesses.length < 60) s = applyAction(s, { type: 'guess', digits: decideGuess(s, level, rng) });
  return { count: s.players[0].guesses.length, state: s };
}

function average(level: DuelAiLevel, length: CodeLength, zero: boolean, games: number): number {
  let total = 0;
  for (let k = 0; k < games; k++) total += solve(level, { length, zero }, 1000 + k).count;
  return total / games;
}

describe('숫자야구 컴퓨터', () => {
  it('비밀 숫자와 칠 숫자는 언제나 올바르다', () => {
    const rng = seededRandom(3);
    for (const level of ['ai-easy', 'ai-normal', 'ai-hard'] as DuelAiLevel[]) {
      for (const [length, zero] of [
        [3, false],
        [4, true],
      ] as const) {
        expect(isValidCode(decideSecret({ length, zero }, rng), { length, zero })).toBe(true);
        const { state } = solve(level, { length, zero }, 7);
        expect(state.phase).toBe('gameover');
        expect(state.players[0].guesses.every((g) => isValidCode(g.digits, state.options))).toBe(true);
      }
    }
  });

  it('같은 숫자를 두 번 치지 않는다', () => {
    for (const level of ['ai-easy', 'ai-normal', 'ai-hard'] as DuelAiLevel[]) {
      for (let k = 0; k < 10; k++) {
        const { state } = solve(level, { length: 3, zero: false }, 50 + k);
        const keys = state.players[0].guesses.map((g) => g.digits.join(''));
        expect(new Set(keys).size).toBe(keys.length);
      }
    }
  });

  it('어려움은 언제나 지금까지의 결과와 맞는 숫자를 친다 (마지막 한 수 전까지)', () => {
    for (let k = 0; k < 10; k++) {
      const { state } = solve('ai-hard', { length: 3, zero: false }, 300 + k);
      const gs = state.players[0].guesses;
      const last = gs[gs.length - 1];
      expect(isConsistent(last.digits, gs.slice(0, -1))).toBe(true);
    }
  });

  it('상대의 비밀 숫자를 보지 않는다: 결과가 같으면 비밀 숫자가 달라도 같은 수를 친다', () => {
    const base = createGame({ seats: [{ kind: 'ai-normal', name: '' }, { kind: 'ai-hard', name: '' }], options: DEFAULT_OPTIONS }, seededRandom(1));
    const a = structuredClone(base);
    const b = structuredClone(base);
    a.players[0].guesses = [{ digits: [1, 2, 3], strikes: 1, balls: 0 }];
    b.players[0].guesses = [{ digits: [1, 2, 3], strikes: 1, balls: 0 }];
    a.players[1].secret = [1, 5, 6];
    b.players[1].secret = [7, 2, 9];
    for (const level of ['ai-easy', 'ai-normal', 'ai-hard'] as DuelAiLevel[]) {
      expect(decideGuess(a, level, seededRandom(4))).toEqual(decideGuess(b, level, seededRandom(4)));
    }
  });

  it('어려울수록 적은 횟수로 맞힌다 (3자리 1~9)', () => {
    const easy = average('ai-easy', 3, false, 60);
    const normal = average('ai-normal', 3, false, 60);
    const hard = average('ai-hard', 3, false, 60);
    expect(hard).toBeLessThan(normal);
    expect(normal).toBeLessThan(easy);
    expect(hard).toBeLessThan(5.3);
    expect(easy).toBeGreaterThan(6.5);
  });

  it('어려움은 4자리 0~9도 8번 안에 맞힌다', () => {
    for (let k = 0; k < 6; k++) expect(solve('ai-hard', { length: 4, zero: true }, 500 + k).count).toBeLessThanOrEqual(8);
  });

  it('첫 수는 아무 숫자나', () => {
    const s = createGame({ seats: [{ kind: 'ai-hard', name: '' }, { kind: 'ai-hard', name: '' }], options: DEFAULT_OPTIONS }, seededRandom(2));
    const seen = new Set<string>();
    const rng = seededRandom(8);
    for (let k = 0; k < 20; k++) seen.add(decideGuess(s, 'ai-hard', rng).join(''));
    expect(seen.size).toBeGreaterThan(5);
    expect(randomCode(s.options, rng)).toHaveLength(3);
  });
});
