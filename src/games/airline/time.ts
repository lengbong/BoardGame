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

// ------------------------------------------------------------------ 달 (한 차례 = 한 달)

/** 달 번호 t = 해 × 12 + (달 − 1) */
export function mOf(year: number, month: number): number {
  return year * 12 + (month - 1);
}

export function yearOfM(t: number): number {
  return Math.floor(t / 12);
}

/** 1~12 */
export function monthOf(t: number): number {
  return (t % 12) + 1;
}

/** 이 달이 든 분기 번호 (q) */
export function qOfM(t: number): number {
  return Math.floor(t / 3);
}

/** 이 분기의 첫 달 */
export function firstMonthOfQ(q: number): number {
  return q * 3;
}

/** 분기의 마지막 달인지 (3·6·9·12월) */
export function isQuarterEnd(t: number): boolean {
  return t % 3 === 2;
}

/** '1983년 3월' */
export function mLabel(t: number): string {
  return `${yearOfM(t)}년 ${monthOf(t)}월`;
}

/** '83.3' (짧게, 그래프 눈금) */
export function mShort(t: number): string {
  return `${String(yearOfM(t) % 100).padStart(2, '0')}.${monthOf(t)}`;
}

/** 'n달' 또는 'n년' (기간 글) */
export function monthsText(n: number): string {
  if (n % 12 === 0) return `${n / 12}년`;
  return `${n}달`;
}

export const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'] as const;
