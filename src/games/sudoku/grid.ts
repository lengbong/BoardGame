/**
 * 9×9 판의 기본 도구. 칸 번호는 0~80 (가로줄 우선: 칸 = 줄×9 + 열).
 * 숫자 0은 빈칸. 후보 숫자는 9비트 마스크 (숫자 d → 1 << (d-1)).
 */

export const CELLS = 81;
export const ALL_DIGITS = 0x1ff;
export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const ROW_OF: readonly number[] = Array.from({ length: CELLS }, (_, i) => Math.floor(i / 9));
export const COL_OF: readonly number[] = Array.from({ length: CELLS }, (_, i) => i % 9);
export const BOX_OF: readonly number[] = Array.from({ length: CELLS }, (_, i) => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3));

/** 27개 묶음: 0~8 가로줄, 9~17 세로줄, 18~26 3×3 칸. 각 묶음은 칸 번호 9개 */
export const UNITS: readonly (readonly number[])[] = [
  ...Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, b) =>
    Array.from({ length: 9 }, (_, k) => (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3)),
  ),
];

/** 칸마다 속한 묶음 번호 [가로줄, 세로줄, 3×3 칸] */
export const CELL_UNITS: readonly (readonly [number, number, number])[] = Array.from(
  { length: CELLS },
  (_, i) => [ROW_OF[i], 9 + COL_OF[i], 18 + BOX_OF[i]] as const,
);

/** 칸마다 같은 줄·열·3×3 칸에 있는 다른 칸 20개 */
export const PEERS: readonly (readonly number[])[] = Array.from({ length: CELLS }, (_, i) => {
  const set = new Set<number>();
  for (const u of CELL_UNITS[i]) for (const j of UNITS[u]) if (j !== i) set.add(j);
  return [...set].sort((a, b) => a - b);
});

const POPCOUNT = new Uint8Array(512);
for (let m = 1; m < 512; m++) POPCOUNT[m] = POPCOUNT[m >> 1] + (m & 1);

export function bitCount(mask: number): number {
  return POPCOUNT[mask & ALL_DIGITS];
}

export function bit(digit: number): number {
  return 1 << (digit - 1);
}

/** 마스크에 들어 있는 숫자들 (작은 순) */
export function digitsOf(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & (1 << (d - 1))) out.push(d);
  return out;
}

/** 마스크에 숫자가 하나뿐이면 그 숫자 */
export function singleDigit(mask: number): number {
  return bitCount(mask) === 1 ? 31 - Math.clz32(mask) + 1 : 0;
}

export function isPeer(a: number, b: number): boolean {
  return a !== b && (ROW_OF[a] === ROW_OF[b] || COL_OF[a] === COL_OF[b] || BOX_OF[a] === BOX_OF[b]);
}

/** "53..7...." 같은 81글자 → 숫자 배열 (0, '.', 그 밖의 글자는 빈칸) */
export function parseGrid(text: string): number[] {
  const chars = text.replace(/\s+/g, '');
  if (chars.length !== CELLS) throw new Error(`스도쿠 판은 81칸이어야 해요 (${chars.length}칸)`);
  return Array.from(chars, (ch) => (ch >= '1' && ch <= '9' ? Number(ch) : 0));
}

export function gridToString(grid: readonly number[]): string {
  return grid.map((v) => (v >= 1 && v <= 9 ? String(v) : '.')).join('');
}

/** 이 칸에 넣을 수 있는 숫자 마스크 (같은 줄·열·칸에 이미 있는 숫자를 뺀다) */
export function candidatesAt(values: readonly number[], i: number): number {
  let used = 0;
  for (const p of PEERS[i]) if (values[p]) used |= bit(values[p]);
  return ALL_DIGITS & ~used;
}

/** 빈칸마다 후보 숫자 마스크 (채운 칸은 0) */
export function computeCandidates(values: readonly number[]): number[] {
  return values.map((v, i) => (v ? 0 : candidatesAt(values, i)));
}

/** 같은 줄·열·3×3 칸에 같은 숫자가 겹친 칸들 */
export function findConflicts(values: readonly number[]): Set<number> {
  const out = new Set<number>();
  for (const unit of UNITS) {
    const seen = new Map<number, number>();
    for (const i of unit) {
      const v = values[i];
      if (!v) continue;
      const j = seen.get(v);
      if (j === undefined) seen.set(v, i);
      else {
        out.add(i);
        out.add(j);
      }
    }
  }
  return out;
}

export function isFull(values: readonly number[]): boolean {
  return values.every((v) => v >= 1 && v <= 9);
}

/** 81칸이 다 차 있고 규칙에 맞는 완성 판인지 */
export function isValidSolution(values: readonly number[]): boolean {
  if (values.length !== CELLS || !isFull(values)) return false;
  return UNITS.every((unit) => unit.reduce((m, i) => m | bit(values[i]), 0) === ALL_DIGITS);
}

/** 1~9를 줄·열 번호로 부를 때 쓰는 이름 (화면 안내용) */
export function cellName(i: number): string {
  return `${ROW_OF[i] + 1}째 줄 ${COL_OF[i] + 1}째 칸`;
}
