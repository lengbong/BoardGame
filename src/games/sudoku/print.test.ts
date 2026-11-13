import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from './generator';
import {
  FOOTER_H,
  HEADER_H,
  PER_PAGE_CHOICES,
  SHEET_H,
  SHEET_W,
  answerGridMm,
  answerLayout,
  clampPages,
  planSheets,
  problemGridMm,
  problemLayout,
  puzzleSpecs,
} from './print';

describe('인쇄 쪽 나누기', () => {
  it('문제 쪽 수 = 전체 ÷ 한 쪽 문제 수 (올림), 정답 쪽은 문제 쪽 뒤에', () => {
    const sheets = planSheets(24, 4, true);
    const problems = sheets.filter((s) => s.kind === 'problems');
    const answers = sheets.filter((s) => s.kind === 'answers');
    expect(problems).toHaveLength(6);
    expect(answers).toHaveLength(2); // 20개 + 4개
    expect(sheets.map((s) => s.page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(sheets.findIndex((s) => s.kind === 'answers')).toBe(6);
    expect(problems.flatMap((s) => s.indices)).toEqual([...Array(24).keys()]);
    expect(answers.flatMap((s) => s.indices)).toEqual([...Array(24).keys()]);
    expect(answers[0].indices).toHaveLength(20);
  });

  it('정답지를 빼면 문제 쪽만, 문제가 없으면 빈 목록', () => {
    expect(planSheets(6, 6, false)).toEqual([{ kind: 'problems', page: 1, indices: [0, 1, 2, 3, 4, 5] }]);
    expect(planSheets(0, 4, true)).toEqual([]);
  });

  it('정답판 크기: 문제가 적을수록 크게 (1개 → 1칸, 4개까지 2×2, 12개까지 3×4, 그 위는 4×5)', () => {
    expect(answerLayout(1)).toEqual({ cols: 1, rows: 1, perPage: 1 });
    expect(answerLayout(4)).toEqual({ cols: 2, rows: 2, perPage: 4 });
    expect(answerLayout(6).perPage).toBe(12);
    expect(answerLayout(12).perPage).toBe(12);
    expect(answerLayout(13).perPage).toBe(20);
    expect(planSheets(120, 6, true).filter((s) => s.kind === 'answers')).toHaveLength(6);
  });

  it('한 쪽 배치: 1개 1×1, 2개 위아래, 4개 2×2, 6개 2×3', () => {
    expect(PER_PAGE_CHOICES.map((n) => problemLayout(n))).toEqual([
      { cols: 1, rows: 1 },
      { cols: 1, rows: 2 },
      { cols: 2, rows: 2 },
      { cols: 2, rows: 3 },
    ]);
  });

  it('문제판과 정답판은 A4 내용 영역 안에 들어가고, 문제가 적을수록 크다', () => {
    for (const header of [true, false]) {
      let prev = Infinity;
      for (const n of PER_PAGE_CHOICES) {
        const size = problemGridMm(n, header);
        const { cols, rows } = problemLayout(n);
        expect(size * cols).toBeLessThanOrEqual(SHEET_W);
        expect(size * rows + rows * 10 + FOOTER_H + (header ? HEADER_H : 0)).toBeLessThanOrEqual(SHEET_H);
        expect(size).toBeLessThan(prev);
        expect(size).toBeGreaterThanOrEqual(70); // 6개짜리도 칸이 7mm 넘게
        prev = size;
      }
    }
    for (const total of [1, 4, 12, 20]) {
      const { cols, rows } = answerLayout(total);
      const size = answerGridMm(total);
      expect(size * cols).toBeLessThanOrEqual(SHEET_W);
      expect(size * rows).toBeLessThanOrEqual(SHEET_H - FOOTER_H - 12);
    }
    expect(answerGridMm(20)).toBeGreaterThanOrEqual(38);
  });

  it('쪽수는 1~20쪽', () => {
    expect(clampPages(0)).toBe(1);
    expect(clampPages(7.4)).toBe(7);
    expect(clampPages(99)).toBe(20);
    expect(clampPages(Number.NaN)).toBe(1);
  });
});

describe('인쇄할 문제 고르기', () => {
  it('문제 수 = 한 쪽 문제 수 × 쪽수, 같은 시드면 같은 묶음', () => {
    const a = puzzleSpecs({ difficulty: 'normal', perPage: 6, pages: 3 }, 555);
    expect(a).toHaveLength(18);
    expect(a.every((s) => s.difficulty === 'normal')).toBe(true);
    expect(puzzleSpecs({ difficulty: 'normal', perPage: 6, pages: 3 }, 555)).toEqual(a);
    expect(puzzleSpecs({ difficulty: 'normal', perPage: 6, pages: 3 }, 556)).not.toEqual(a);
    expect(new Set(a.map((s) => s.seed)).size).toBe(18);
  });

  it('쪽수를 늘려도 앞의 문제는 그대로 (미리보기에서 다시 만들지 않게)', () => {
    const two = puzzleSpecs({ difficulty: 'mixed', perPage: 4, pages: 2 }, 9);
    const five = puzzleSpecs({ difficulty: 'mixed', perPage: 4, pages: 5 }, 9);
    expect(five.slice(0, 8)).toEqual(two);
  });

  it('섞어서: 네 난이도가 모두 나오고, 한 쪽 안에서는 쉬운 것부터', () => {
    const specs = puzzleSpecs({ difficulty: 'mixed', perPage: 6, pages: 2 }, 1);
    expect(new Set(specs.map((s) => s.difficulty))).toEqual(new Set(DIFFICULTIES));
    for (let p = 0; p < 2; p++) {
      const page = specs.slice(p * 6, p * 6 + 6).map((s) => DIFFICULTIES.indexOf(s.difficulty));
      expect(page).toEqual([...page].sort((x, y) => x - y));
    }
    const four = puzzleSpecs({ difficulty: 'mixed', perPage: 4, pages: 1 }, 1);
    expect(four.map((s) => s.difficulty)).toEqual(DIFFICULTIES);
  });
});
