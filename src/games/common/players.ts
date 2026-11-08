/** 여러 게임이 함께 쓰는 자리(플레이어) 정의 */
export type SeatIndex = 0 | 1 | 2 | 3;

export type SeatKind = 'human' | 'ai-easy' | 'ai-normal' | 'empty';

export interface SeatConfig {
  kind: SeatKind;
  name: string;
}

export type Seats = [SeatConfig, SeatConfig, SeatConfig, SeatConfig];

export const SEAT_INDICES: SeatIndex[] = [0, 1, 2, 3];

export const SEAT_COLORS: Record<SeatIndex, { name: string; main: string; dark: string; light: string }> = {
  0: { name: '빨강', main: '#e5484d', dark: '#a52a2f', light: '#fde8e8' },
  1: { name: '초록', main: '#30a46c', dark: '#1d6b45', light: '#e3f6ec' },
  2: { name: '노랑', main: '#f5b400', dark: '#9a6f00', light: '#fff6d6' },
  3: { name: '파랑', main: '#3e63dd', dark: '#25409a', light: '#e6ecfd' },
};

export const SEAT_KIND_OPTIONS: { value: SeatKind; label: string }[] = [
  { value: 'human', label: '사람' },
  { value: 'ai-easy', label: '컴퓨터 (쉬움)' },
  { value: 'ai-normal', label: '컴퓨터 (보통)' },
  { value: 'empty', label: '비움' },
];

export const KIND_LABEL = { human: '사람', 'ai-easy': '컴퓨터 · 쉬움', 'ai-normal': '컴퓨터 · 보통' } as const;

export function activeSeatCount(seats: Seats): number {
  return seats.filter((s) => s.kind !== 'empty').length;
}
