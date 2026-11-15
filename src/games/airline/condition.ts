import { MODEL } from './aircraft';
import type { Company, Plane } from './types';

/**
 * 비행기마다 기체 상태 (Airline Manager의 A·C 점검, Airline Club의 기체 상태처럼).
 * 상태(0~100%)는 날수록 닳고(오래된 비행기·정비를 아끼면 더 빨리), 낮을수록 지연·결항·고장이 잦다.
 * 상태가 회사가 정한 점검 시점 아래로 내려가면 그달은 C점검(큰 정비)으로 쉬고, 끝나면 상태가 돌아온다.
 * 오래된 비행기일수록 점검해도 덜 돌아온다 (그래서 언젠가는 바꾸는 편이 낫다).
 */

/** 저장에 상태가 없던 비행기 (예전 저장) */
export const DEFAULT_COND = 80;

/** 정비 수준(1~5)마다 닳는 빠르기 */
export const MAINT_WEAR = [0, 1.5, 1.2, 1, 0.85, 0.72];

/** 한 시간 날 때 닳는 상태 (%). 한 주 98시간을 꽉 채워 날면 한 달에 2.5%쯤 */
export const WEAR_PER_HOUR = 0.006;

/** C점검 값: 새 비행기 값의 이만큼 */
export const CHECK_RATE = 0.012;

/** C점검 시점 (상태가 이 아래로 내려가면 점검) */
export const CHECK_POLICIES: readonly { at: number; name: string; desc: string }[] = [
  { at: 35, name: '늦게', desc: '점검이 드물어 돈과 쉬는 날이 줄지만, 닳은 채로 오래 날아 고장이 잦아요' },
  { at: 50, name: '보통', desc: '상태가 절반쯤 되면 점검해요' },
  { at: 65, name: '일찍', desc: '자주 점검해 늘 상태가 좋아요. 돈과 쉬는 날이 늘어요' },
];
export const DEFAULT_CHECK_AT = 50;

export const condOf = (p: Plane): number => p.cond ?? DEFAULT_COND;

export const checkAtOf = (c: Company): number => c.checkAt ?? DEFAULT_CHECK_AT;

/** 이 달에 C점검을 받는지 */
export const inCheck = (p: Plane, t: number): boolean => p.check === t;

/** 상태에 따른 고장·지연 배수: 70%쯤이 보통(1), 새것은 0.55, 다 닳으면 3배 넘게 */
export function condRisk(cond: number): number {
  const x = Math.max(0, Math.min(1, (100 - cond) / 100));
  return 0.55 + 2.7 * x ** 1.5;
}

/** 한 달 동안 닳는 상태 (주간 비행시간 hoursWeek, 나이 age년, 정비 수준 maint) */
export function monthlyWear(hoursWeek: number, age: number, maint: number): number {
  return hoursWeek * (52 / 12) * WEAR_PER_HOUR * (MAINT_WEAR[maint] ?? 1) * (1 + 0.02 * age);
}

/** C점검을 마친 뒤 상태: 새 비행기는 97%, 해마다 1.2%씩 덜 돌아온다 (많아야 30% 덜) */
export function restoredCond(age: number): number {
  return Math.round(97 - Math.min(30, age * 1.2));
}

/** 중고로 산 비행기의 처음 상태 */
export function usedCond(age: number): number {
  return Math.max(45, Math.round(95 - age * 2.2));
}

/** 비행기 한 대의 C점검 값 (억). 정비 기지 같은 할인은 mult */
export function checkCost(p: Plane, mult = 1): number {
  return Math.max(1, Math.round(MODEL[p.model].price * CHECK_RATE * mult * 10) / 10);
}

/** 한 달에 함께 C점검할 수 있는 비행기 수 (정비고 자리) */
export function checkSlots(c: Company, extra = 0): number {
  return Math.max(1, Math.ceil(c.planes.length / 10)) + extra;
}

/**
 * 이번 달에 C점검으로 보낼 비행기: 점검 시점 아래로 내려간 비행기를 상태가 낮은 것부터, 정비고 자리만큼.
 * 이미 이번 달 점검을 받는 비행기도 자리를 차지한다.
 */
export function dueForCheck(c: Company, t: number, extraSlots = 0): number[] {
  const at = checkAtOf(c);
  const busy = c.planes.filter((p) => inCheck(p, t)).length;
  const free = checkSlots(c, extraSlots) - busy;
  if (free <= 0) return [];
  return c.planes
    .filter((p) => !inCheck(p, t) && condOf(p) < at)
    .sort((a, b) => condOf(a) - condOf(b))
    .slice(0, free)
    .map((p) => p.id);
}

/** 노선을 나는 비행기들의 평균 상태 (좌석·횟수 가중이 아니라 비행기 수) */
export function fleetCond(c: Company): number {
  if (c.planes.length === 0) return 100;
  return c.planes.reduce((s, p) => s + condOf(p), 0) / c.planes.length;
}

/** 상태 등급 (화면 색) */
export function condTone(cond: number, at: number): 'good' | 'warn' | 'bad' {
  if (cond < at) return 'bad';
  if (cond < at + 15) return 'warn';
  return 'good';
}

/** 다음 C점검까지 몇 달쯤 남았는지 (닳지 않으면 null) */
export function monthsToCheck(cond: number, at: number, wear: number): number | null {
  if (cond < at) return 0;
  if (wear <= 0.01) return null;
  return Math.max(0, Math.floor((cond - at) / wear));
}
