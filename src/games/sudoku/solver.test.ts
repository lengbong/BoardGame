import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { CELL_UNITS, PEERS, UNITS, candidatesAt, digitsOf, findConflicts, gridToString, isValidSolution, parseGrid } from './grid';
import { countSolutions, hasUniqueSolution, randomSolvedGrid, solve } from './solver';

const EASY = '003020600900305001001806400008102900700000008006708200002609500800203009005010300';

describe('판 도구', () => {
  it('묶음 27개는 9칸씩, 칸마다 이웃 20칸, 칸이 속한 묶음은 3개', () => {
    expect(UNITS).toHaveLength(27);
    for (const u of UNITS) expect(new Set(u).size).toBe(9);
    for (let i = 0; i < 81; i++) {
      expect(PEERS[i]).toHaveLength(20);
      expect(PEERS[i]).not.toContain(i);
      for (const u of CELL_UNITS[i]) expect(UNITS[u]).toContain(i);
    }
  });

  it('81글자 문자열과 숫자 배열을 오간다', () => {
    const g = parseGrid(EASY);
    expect(g[2]).toBe(3);
    expect(g[0]).toBe(0);
    expect(gridToString(g)).toBe(EASY.replace(/0/g, '.'));
    expect(() => parseGrid('123')).toThrow();
  });

  it('겹치는 숫자는 같은 줄·열·3×3 칸에서만 찾는다', () => {
    const g = new Array(81).fill(0);
    g[0] = 5;
    g[8] = 5; // 같은 가로줄
    g[30] = 7;
    g[40] = 7; // 같은 3×3 칸 (가운데)
    g[60] = 4;
    g[13] = 4; // 다른 줄·열·칸 → 겹침 아님
    expect([...findConflicts(g)].sort((a, b) => a - b)).toEqual([0, 8, 30, 40]);
  });

  it('후보 숫자는 이웃에 없는 숫자', () => {
    const g = parseGrid(EASY);
    // 0번 칸: 가로줄 3,2,6 / 세로줄 9,7,8 / 칸 9,1 → 4,5만 남는다
    expect(digitsOf(candidatesAt(g, 0))).toEqual([4, 5]);
  });
});

describe('되추적 풀이기', () => {
  it('알려진 문제의 해답을 하나 찾고, 그 해답은 규칙에 맞는다', () => {
    const g = parseGrid(EASY);
    expect(countSolutions(g)).toBe(1);
    const s = solve(g)!;
    expect(isValidSolution(s)).toBe(true);
    g.forEach((v, i) => v && expect(s[i]).toBe(v));
  });

  it('숫자를 너무 많이 지우면 해답이 2개 이상이다 (limit에서 멈춤)', () => {
    const g = parseGrid(EASY);
    const sparse = g.map((v, i) => (i < 27 ? v : 0));
    expect(countSolutions(sparse, 2)).toBe(2);
    expect(hasUniqueSolution(sparse)).toBe(false);
    expect(countSolutions(sparse, 5)).toBe(5);
  });

  it('주어진 숫자끼리 겹치면 해답이 없다', () => {
    const g = parseGrid(EASY);
    g[0] = 3; // 같은 줄에 3이 이미 있다
    expect(countSolutions(g)).toBe(0);
    expect(solve(g)).toBeNull();
  });

  it('빈 판도 풀 수 있다', () => {
    expect(isValidSolution(solve(new Array(81).fill(0))!)).toBe(true);
  });

  it('무작위 완성 판은 올바르고, 같은 시드면 똑같다', () => {
    const a = randomSolvedGrid(seededRandom(7));
    const b = randomSolvedGrid(seededRandom(7));
    const c = randomSolvedGrid(seededRandom(8));
    expect(isValidSolution(a)).toBe(true);
    expect(isValidSolution(c)).toBe(true);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});
