import { seededRandom } from '../../lib/random';
import { DIFFICULTIES, randomSeed } from './generator';
import type { Difficulty } from './types';

/**
 * 문제지 인쇄의 쪽 나누기 계산 (화면과 상관없는 순수 함수).
 * A4 세로, 여백 12mm → 내용 영역 186 × 273mm. 반올림 때문에 빈 쪽이 생기지 않도록 높이는 조금 덜 쓴다.
 */

export type PrintDifficulty = Difficulty | 'mixed';
export type PerPage = 1 | 2 | 4 | 6;

export const PER_PAGE_CHOICES: PerPage[] = [1, 2, 4, 6];
export const MAX_PAGES = 20;

export const SHEET_W = 186;
export const SHEET_H = 271;
export const HEADER_H = 17;
export const FOOTER_H = 6;

export interface PrintOptions {
  difficulty: PrintDifficulty;
  perPage: PerPage;
  pages: number;
  answers: boolean;
  /** 맨 위 제목 줄 (이름·날짜 칸) */
  header: boolean;
  title: string;
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  difficulty: 'easy',
  perPage: 4,
  pages: 1,
  answers: true,
  header: true,
  title: '스도쿠 문제지',
};

export function clampPages(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(MAX_PAGES, Math.round(n)));
}

export function parsePerPage(v: unknown): PerPage {
  return PER_PAGE_CHOICES.includes(v as PerPage) ? (v as PerPage) : 4;
}

export interface PuzzleSpec {
  /** 0부터 세는 문제 순서 (화면에는 index + 1번) */
  index: number;
  difficulty: Difficulty;
  seed: number;
}

/**
 * 인쇄할 문제들의 난이도와 시드. baseSeed가 같으면 언제나 같은 묶음이 나온다.
 * 섞어서: 쉬움·보통·어려움·아주 어려움을 돌아가며 고르고, 한 쪽 안에서는 쉬운 것부터 놓는다.
 */
export function puzzleSpecs(opts: Pick<PrintOptions, 'difficulty' | 'perPage' | 'pages'>, baseSeed: number): PuzzleSpec[] {
  const total = opts.perPage * clampPages(opts.pages);
  const rng = seededRandom(baseSeed);
  const seeds = Array.from({ length: total }, () => randomSeed(rng));
  const diffs: Difficulty[] = [];
  for (let start = 0; start < total; start += opts.perPage) {
    const page: Difficulty[] = [];
    for (let k = start; k < Math.min(total, start + opts.perPage); k++) {
      page.push(opts.difficulty === 'mixed' ? DIFFICULTIES[k % DIFFICULTIES.length] : opts.difficulty);
    }
    page.sort((a, b) => DIFFICULTIES.indexOf(a) - DIFFICULTIES.indexOf(b));
    diffs.push(...page);
  }
  return diffs.map((difficulty, index) => ({ index, difficulty, seed: seeds[index] }));
}

/** 문제 쪽에 문제를 놓는 칸 수 */
export function problemLayout(perPage: PerPage): { cols: number; rows: number } {
  switch (perPage) {
    case 1:
      return { cols: 1, rows: 1 };
    case 2:
      return { cols: 1, rows: 2 };
    case 4:
      return { cols: 2, rows: 2 };
    case 6:
      return { cols: 2, rows: 3 };
  }
}

/** 정답 쪽: 문제 수가 적으면 크게, 많으면 한 쪽에 20개까지 작게 */
export function answerLayout(total: number): { cols: number; rows: number; perPage: number } {
  if (total <= 1) return { cols: 1, rows: 1, perPage: 1 };
  if (total <= 4) return { cols: 2, rows: 2, perPage: 4 };
  if (total <= 12) return { cols: 3, rows: 4, perPage: 12 };
  return { cols: 4, rows: 5, perPage: 20 };
}

/** 문제 칸 하나의 크기 (mm): 문제 아래 이름표 자리를 빼고 정사각형으로 */
export function problemGridMm(perPage: PerPage, header: boolean): number {
  const { cols, rows } = problemLayout(perPage);
  const areaH = SHEET_H - FOOTER_H - (header ? HEADER_H : 0);
  const slotW = SHEET_W / cols;
  const slotH = areaH / rows;
  // 문제 아래 이름표와 문제 사이 여백 (위아래로 놓는 2개짜리는 넉넉히)
  const label = perPage === 2 ? 18 : perPage === 1 ? 12 : 10;
  const gap = cols > 1 ? 8 : 0;
  return Math.floor(Math.min(slotW - gap, slotH - label, 168));
}

export function answerGridMm(total: number): number {
  const { cols, rows } = answerLayout(total);
  const areaH = SHEET_H - FOOTER_H - 12;
  const slotW = SHEET_W / cols;
  const slotH = areaH / rows;
  return Math.floor(Math.min(slotW - 6, slotH - 6, 110));
}

export interface SheetPlan {
  kind: 'problems' | 'answers';
  /** 1부터 세는 전체 쪽 번호 */
  page: number;
  /** 이 쪽에 놓을 문제 순서 번호들 */
  indices: number[];
}

/** 문제 쪽을 모두 놓은 뒤에 정답 쪽을 놓는다. */
export function planSheets(total: number, perPage: PerPage, answers: boolean): SheetPlan[] {
  const sheets: SheetPlan[] = [];
  for (let start = 0; start < total; start += perPage) {
    sheets.push({ kind: 'problems', page: sheets.length + 1, indices: range(start, Math.min(total, start + perPage)) });
  }
  if (answers && total > 0) {
    const per = answerLayout(total).perPage;
    for (let start = 0; start < total; start += per) {
      sheets.push({ kind: 'answers', page: sheets.length + 1, indices: range(start, Math.min(total, start + per)) });
    }
  }
  return sheets;
}

function range(a: number, b: number): number[] {
  return Array.from({ length: Math.max(0, b - a) }, (_, k) => a + k);
}

/** 인쇄 줄 굵기 (mm): 판이 작아도 너무 가늘지 않게 */
export function strokeMm(gridMm: number): { thin: number; thick: number } {
  return { thin: Math.max(0.15, gridMm * 0.0021), thick: Math.max(0.5, gridMm * 0.0068) };
}
