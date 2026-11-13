import type { ReactNode } from 'react';

/**
 * 두 사람이 하는 게임(뒤집기, 사목, 만칼라, 배 찾기 등)의 자리 정의.
 * 4인 게임의 SeatKind와 달리 '비움'이 없고, 컴퓨터 '어려움'이 있다.
 */
export type DuelKind = 'human' | 'ai-easy' | 'ai-normal' | 'ai-hard';
export type DuelAiLevel = Exclude<DuelKind, 'human'>;

export interface DuelSeat {
  kind: DuelKind;
  name: string;
}

export type DuelSeats = [DuelSeat, DuelSeat];

/** 자리(편)의 모양: 이름표, 색, 그림 */
export interface DuelSide {
  /** 예: '흑', '백', '빨강', '1번' */
  label: string;
  /** 머리띠 배경색 */
  color: string;
  /** 머리띠 글자색 (기본 흰색) */
  textColor?: string;
  /** 이름표 앞에 붙는 작은 그림 (돌, 말 등) */
  icon?: ReactNode;
}

export const DUEL_KIND_OPTIONS: { value: DuelKind; label: string }[] = [
  { value: 'human', label: '사람' },
  { value: 'ai-easy', label: '컴퓨터 (쉬움)' },
  { value: 'ai-normal', label: '컴퓨터 (보통)' },
  { value: 'ai-hard', label: '컴퓨터 (어려움)' },
];

export const DUEL_KIND_LABEL: Record<DuelKind, string> = {
  human: '사람',
  'ai-easy': '컴퓨터 · 쉬움',
  'ai-normal': '컴퓨터 · 보통',
  'ai-hard': '컴퓨터 · 어려움',
};

export const DEFAULT_DUEL_SEATS: DuelSeats = [
  { kind: 'human', name: '' },
  { kind: 'ai-normal', name: '' },
];

/** 이름을 비워 두면 편 이름(흑, 백 …)으로 부른다. */
export function duelName(seat: DuelSeat, side: DuelSide): string {
  return seat.name.trim() || side.label;
}

export function isDuelSeats(v: unknown): v is DuelSeats {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    v.every((s) => !!s && typeof s.name === 'string' && DUEL_KIND_OPTIONS.some((o) => o.value === s.kind))
  );
}
