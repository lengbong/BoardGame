import type { Rng } from '../../lib/random';
import { ALL_DIGITS, BOX_OF, CELLS, COL_OF, ROW_OF, bitCount } from './grid';

/**
 * 빠른 되추적 풀이기 (비트마스크 + 후보가 가장 적은 칸부터).
 * 해답이 몇 개인지 limit개까지만 세고, rng를 주면 숫자를 무작위 순서로 시도한다 (완성 판 만들기).
 */
class Search {
  readonly g = new Int8Array(CELLS);
  readonly rows = new Int16Array(9);
  readonly cols = new Int16Array(9);
  readonly boxes = new Int16Array(9);
  solutions = 0;
  first: number[] | null = null;
  nodes = 0;

  constructor(
    grid: readonly number[],
    readonly limit: number,
    readonly rng?: Rng,
    readonly maxNodes = Infinity,
  ) {
    for (let i = 0; i < CELLS; i++) this.g[i] = grid[i] | 0;
  }

  /** 주어진 숫자끼리 겹치면 false */
  init(): boolean {
    for (let i = 0; i < CELLS; i++) {
      const v = this.g[i];
      if (!v) continue;
      const b = 1 << (v - 1);
      if ((this.rows[ROW_OF[i]] | this.cols[COL_OF[i]] | this.boxes[BOX_OF[i]]) & b) return false;
      this.rows[ROW_OF[i]] |= b;
      this.cols[COL_OF[i]] |= b;
      this.boxes[BOX_OF[i]] |= b;
    }
    return true;
  }

  run(): void {
    if (this.solutions >= this.limit || this.nodes > this.maxNodes) return;
    this.nodes++;
    const g = this.g;
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < CELLS; i++) {
      if (g[i]) continue;
      const m = ALL_DIGITS & ~(this.rows[ROW_OF[i]] | this.cols[COL_OF[i]] | this.boxes[BOX_OF[i]]);
      const n = bitCount(m);
      if (n === 0) return;
      if (n < bestCount) {
        best = i;
        bestMask = m;
        bestCount = n;
        if (n === 1) break;
      }
    }
    if (best < 0) {
      this.solutions++;
      if (!this.first) this.first = Array.from(g);
      return;
    }
    const digits: number[] = [];
    for (let d = 1; d <= 9; d++) if (bestMask & (1 << (d - 1))) digits.push(d);
    if (this.rng && digits.length > 1) {
      for (let k = digits.length - 1; k > 0; k--) {
        const j = Math.min(k, Math.floor(this.rng() * (k + 1)));
        [digits[k], digits[j]] = [digits[j], digits[k]];
      }
    }
    const r = ROW_OF[best];
    const c = COL_OF[best];
    const bx = BOX_OF[best];
    for (const d of digits) {
      const b = 1 << (d - 1);
      g[best] = d;
      this.rows[r] |= b;
      this.cols[c] |= b;
      this.boxes[bx] |= b;
      this.run();
      g[best] = 0;
      this.rows[r] &= ~b;
      this.cols[c] &= ~b;
      this.boxes[bx] &= ~b;
      if (this.solutions >= this.limit || this.nodes > this.maxNodes) return;
    }
  }
}

/** 해답 개수 (limit개에서 멈춘다). 주어진 숫자가 서로 겹치면 0 */
export function countSolutions(grid: readonly number[], limit = 2): number {
  const s = new Search(grid, limit);
  if (!s.init()) return 0;
  s.run();
  return s.solutions;
}

/** 해답이 하나뿐인지 */
export function hasUniqueSolution(grid: readonly number[]): boolean {
  return countSolutions(grid, 2) === 1;
}

/** 해답 하나 (없으면 null) */
export function solve(grid: readonly number[]): number[] | null {
  const s = new Search(grid, 1);
  if (!s.init()) return null;
  s.run();
  return s.first;
}

/** 무작위로 꽉 찬 완성 판을 만든다 (무작위 순서 되추적) */
export function randomSolvedGrid(rng: Rng): number[] {
  // 첫 줄은 1~9를 섞어서 바로 채우면 더 빠르다.
  const grid = new Array<number>(CELLS).fill(0);
  const first = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let k = 8; k > 0; k--) {
    const j = Math.min(k, Math.floor(rng() * (k + 1)));
    [first[k], first[j]] = [first[j], first[k]];
  }
  for (let c = 0; c < 9; c++) grid[c] = first[c];
  const s = new Search(grid, 1, rng);
  s.init();
  s.run();
  return s.first!;
}
