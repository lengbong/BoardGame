import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, generatePuzzle, getPuzzle, parsePuzzleCode, puzzleCode } from './generator';
import { isValidSolution, parseGrid } from './grid';
import { gradePuzzle } from './logic';
import { countSolutions } from './solver';
import type { Puzzle } from './types';

function checkValid(p: Puzzle) {
  const g = parseGrid(p.givens);
  const s = parseGrid(p.solution);
  expect(isValidSolution(s)).toBe(true);
  g.forEach((v, i) => v && expect(v).toBe(s[i]));
  expect(g.filter(Boolean).length).toBe(p.clues);
  expect(countSolutions(g, 2)).toBe(1);
  expect(gradePuzzle(g).level).toBe(p.level);
  expect(p.id).toBe(puzzleCode(p.difficulty, p.seed));
}

describe('문제 만들기', () => {
  it('쉬움: 해답이 하나뿐이고 single만으로 풀리며 숫자 36~40개', () => {
    for (const seed of [1, 2, 3, 77]) {
      const p = generatePuzzle('easy', seed);
      checkValid(p);
      expect(p.level).toBe(1);
      expect(p.clues).toBeGreaterThanOrEqual(36);
      expect(p.clues).toBeLessThanOrEqual(40);
    }
  });

  it('보통: 2단계 방법(가리키기·짝 숫자)이 필요하고 숫자 26~32개', () => {
    for (const seed of [1, 2, 3]) {
      const p = generatePuzzle('normal', seed);
      checkValid(p);
      expect(p.level).toBe(2);
      expect(p.clues).toBeGreaterThanOrEqual(26);
      expect(p.clues).toBeLessThanOrEqual(32);
    }
  });

  it('어려움: 3단계 방법이 필요하다 (안 되면 2단계 중 가장 적은 숫자로)', () => {
    for (const seed of [1, 2, 3]) {
      const p = generatePuzzle('hard', seed);
      checkValid(p);
      expect(p.level).toBeGreaterThanOrEqual(2);
      expect(p.level).toBeLessThanOrEqual(3);
      expect(p.clues).toBeLessThanOrEqual(29);
    }
    expect([1, 2, 3].map((s) => generatePuzzle('hard', s).level)).toContain(3);
  });

  it('아주 어려움: 풀이기로 못 풀거나 숫자가 아주 적다', () => {
    for (const seed of [1, 2]) {
      const p = generatePuzzle('expert', seed);
      checkValid(p);
      expect(p.level === 4 || (p.level === 3 && p.clues <= 23)).toBe(true);
    }
  });

  it('같은 시드와 난이도면 언제나 같은 문제, 다르면 다른 문제', () => {
    for (const d of DIFFICULTIES.slice(0, 2)) {
      expect(generatePuzzle(d, 4242)).toEqual(generatePuzzle(d, 4242));
    }
    expect(generatePuzzle('easy', 4242).givens).not.toBe(generatePuzzle('easy', 4243).givens);
    expect(generatePuzzle('easy', 4242).givens).not.toBe(generatePuzzle('normal', 4242).givens);
  });

  it('한 번 만든 문제는 기억해 둔다', () => {
    expect(getPuzzle('easy', 9)).toBe(getPuzzle('easy', 9));
  });
});

describe('문제 번호', () => {
  it('난이도 숫자와 다섯 자리 시드로 만들고 다시 읽는다', () => {
    expect(puzzleCode('normal', 4821)).toBe('2-04821');
    expect(puzzleCode('expert', 99999)).toBe('4-99999');
    expect(parsePuzzleCode('2-04821')).toEqual({ difficulty: 'normal', seed: 4821 });
    expect(parsePuzzleCode(' 3 777 ')).toEqual({ difficulty: 'hard', seed: 777 });
    expect(parsePuzzleCode('104821')).toEqual({ difficulty: 'easy', seed: 4821 });
  });

  it('잘못된 번호는 null', () => {
    for (const bad of ['', '5-00001', '2-00000', 'abc', '2-123456', '2-']) expect(parsePuzzleCode(bad)).toBeNull();
  });
});
