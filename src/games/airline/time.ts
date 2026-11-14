/** 분기 번호 q = 해 × 4 + (분기 − 1) */
export function qOf(year: number, quarter: number): number {
  return year * 4 + (quarter - 1);
}

export function yearOf(q: number): number {
  return Math.floor(q / 4);
}

/** 1~4 */
export function quarterOf(q: number): number {
  return (q % 4) + 1;
}

/** '1983년 2분기' */
export function qLabel(q: number): string {
  return `${yearOf(q)}년 ${quarterOf(q)}분기`;
}

/** '83년 2분기' (짧게) */
export function qShort(q: number): string {
  return `${String(yearOf(q) % 100).padStart(2, '0')}년 ${quarterOf(q)}분기`;
}

export const QUARTER_NAMES = ['겨울', '봄', '여름', '가을'] as const;
