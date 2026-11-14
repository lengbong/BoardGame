import { fmtMoney } from './rules';

export { fmtMoney };

/** '+12억', '−5억' */
export function signedMoney(v: number): string {
  const r = Math.round(v);
  if (r === 0) return '0억';
  return `${r > 0 ? '+' : '−'}${fmtMoney(Math.abs(r))}`;
}

/** '12.3만 명', '8,500명' */
export function fmtPax(n: number): string {
  const r = Math.round(n);
  if (Math.abs(r) >= 10000) return `${(r / 10000).toFixed(Math.abs(r) >= 1000000 ? 0 : 1)}만 명`;
  return `${r.toLocaleString('ko-KR')}명`;
}

export const pct = (x: number): string => `${Math.round(x * 100)}%`;

export const km = (d: number): string => `${Math.round(d).toLocaleString('ko-KR')}km`;

export const manwon = (v: number): string => `${Math.round(v).toLocaleString('ko-KR')}만 원`;

/** 운임 조정 글: '싸게 −10%', '보통', '비싸게 +20%' */
export function fareText(fare: number): string {
  if (fare === 0) return '보통';
  return fare < 0 ? `싸게 ${fare}%` : `비싸게 +${fare}%`;
}

/** 축 눈금용 짧은 돈 */
export function axisMoney(v: number): string {
  if (Math.abs(v) >= 10000) return `${Math.round(v / 1000) / 10}조`;
  return `${Math.round(v).toLocaleString('ko-KR')}`;
}
