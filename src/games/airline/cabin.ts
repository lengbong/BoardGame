import type { Cabin, ModelDef, Pitch } from './types';

/**
 * 비행기마다 정하는 좌석 배치(일등석·비즈니스석·일반석 간격)와 기내식.
 *
 * 기종표의 좌석 수(seats)는 '표준 2등급 배치'일 때의 수예요. 바닥 넓이를 '보통 간격 일반석 몇 개 자리'로 재고,
 * 일등석·비즈니스석은 한 자리가 일반석 여러 개만큼 넓어서 고급 좌석을 늘리면 전체 좌석은 줄어요.
 */

/** 고급 좌석 한 개가 차지하는 자리 (보통 간격 일반석 = 1) */
export const SEAT_SPACE = { first: 4.2, business: 2.4 } as const;
/** 일반석 간격마다 한 자리 크기: 촘촘 / 보통 / 넓게 */
export const PITCH_SPACE: readonly number[] = [0.86, 1, 1.16];
export const PITCH_NAMES: readonly string[] = ['촘촘', '보통', '넓게'];
/** 화면에 보이는 앞뒤 간격 (인치) */
export const PITCH_INCH: readonly number[] = [29, 31, 34];
/** 일반석 간격이 편안함에 주는 배수 */
export const PITCH_COMFORT: readonly number[] = [0.92, 1, 1.07];
/** 비상구 수 때문에 넘을 수 없는 좌석 수 (표준 배치의 배수) */
export const MAX_SEAT_RATIO = 1.18;

export const MEAL_NAMES: readonly string[] = ['', '음료만', '간식', '기본 식사', '좋은 식사', '셰프 코스'];
export const MEAL_ICONS: readonly string[] = ['', '🥤', '🥪', '🍱', '🍽️', '🥂'];
/** 기내식 단계별 손님 1명 비용 배수 */
export const MEAL_COST: readonly number[] = [0, 0.45, 0.72, 1, 1.45, 2];
/** 기내식이 편안함(손님이 고르는 정도)에 주는 배수: 3단계가 1 */
export const mealComfort = (level: number) => 0.9 + 0.05 * (level - 1);

/** 표준 배치에서 고급 좌석(일등+비즈니스) 비율 */
export const STD_PREMIUM = 0.1;

/** 사업 손님이 고급 좌석에 앉을 때 내는 운임 배수 (먼 길일수록 차이가 크다) */
export function businessYield(d: number): number {
  return 2 + 0.8 * Math.min(1, Math.max(0, d / 8000));
}
export function firstYield(d: number): number {
  return businessYield(d) * 1.65;
}
/** 사업 손님이 일반석(값을 바꿀 수 있는 비싼 표)에 앉을 때 운임 배수 */
export const BIZ_ECON_YIELD = 1.6;

/** 좌석 배치를 바꿀 수 없는 기종 (초음속기는 한 등급뿐) */
export function fixedCabin(m: ModelDef): boolean {
  return m.body === 'sst';
}

/** 일등석을 놓을 수 있는 기종 (넓은 동체 큰 비행기) */
export function canFirst(m: ModelDef): boolean {
  return !fixedCabin(m) && m.seats >= 220;
}

/** 비즈니스석을 놓을 수 있는 기종 (아주 작은 비행기는 한 등급) */
export function canBusiness(m: ModelDef): boolean {
  return !fixedCabin(m) && m.seats >= 44;
}

/** 표준 배치 (기종표 좌석 수와 같다) */
export function defaultCabin(m: ModelDef): Cabin {
  if (fixedCabin(m) || m.seats < 90) return { first: 0, business: 0, pitch: 1 };
  return { first: 0, business: Math.round(m.seats * (m.seats < 230 ? 0.08 : 0.12)), pitch: 1 };
}

/** 바닥 넓이 (보통 간격 일반석 몇 자리) */
export function cabinSpace(m: ModelDef): number {
  const d = defaultCabin(m);
  return m.seats - d.business - d.first + d.business * SEAT_SPACE.business + d.first * SEAT_SPACE.first;
}

/** 이 배치의 일반석 수 */
export function economySeats(m: ModelDef, cab: Cabin): number {
  if (fixedCabin(m)) return m.seats;
  const free = cabinSpace(m) - cab.first * SEAT_SPACE.first - cab.business * SEAT_SPACE.business;
  const y = Math.max(0, Math.floor(free / PITCH_SPACE[cab.pitch] + 1e-9));
  const cap = Math.round(m.seats * MAX_SEAT_RATIO) - cab.first - cab.business;
  return Math.max(0, Math.min(y, cap));
}

/** 이 배치의 전체 좌석 수 */
export function cabinSeats(m: ModelDef, cab: Cabin): number {
  return fixedCabin(m) ? m.seats : cab.first + cab.business + economySeats(m, cab);
}

/** 일등석·비즈니스석 최대 (나머지를 모두 쓴다고 할 때) */
export function maxFirst(m: ModelDef, cab: Cabin): number {
  if (!canFirst(m)) return 0;
  const room = cabinSpace(m) * 0.2;
  const left = cabinSpace(m) - cab.business * SEAT_SPACE.business;
  return Math.max(0, Math.floor(Math.min(room, left) / SEAT_SPACE.first));
}

export function maxBusiness(m: ModelDef, cab: Cabin): number {
  if (!canBusiness(m)) return 0;
  return Math.max(0, Math.floor((cabinSpace(m) - cab.first * SEAT_SPACE.first) / SEAT_SPACE.business));
}

/** 이 배치를 쓸 수 없는 까닭 (쓸 수 있으면 null) */
export function cabinBlocker(m: ModelDef, cab: Cabin): string | null {
  const ints = [cab.first, cab.business].every((x) => Number.isInteger(x) && x >= 0);
  if (!ints || ![0, 1, 2].includes(cab.pitch)) return '좌석 수가 이상해요';
  if (fixedCabin(m)) return cab.first === 0 && cab.business === 0 && cab.pitch === 1 ? null : `${m.name}는 좌석 배치를 바꿀 수 없어요`;
  if (cab.first > 0 && !canFirst(m)) return '일등석은 큰 비행기에만 놓을 수 있어요';
  if (cab.business > 0 && !canBusiness(m)) return '이 비행기는 너무 작아서 비즈니스석을 놓을 수 없어요';
  if (cab.first > maxFirst(m, cab)) return `일등석은 ${maxFirst(m, cab)}석까지예요`;
  if (cab.business > maxBusiness(m, cab)) return `비즈니스석은 ${maxBusiness(m, cab)}석까지예요`;
  if (cabinSeats(m, cab) < Math.min(20, m.seats)) return '좌석이 너무 적어요';
  return null;
}

export const sameCabin = (a: Cabin, b: Cabin) => a.first === b.first && a.business === b.business && a.pitch === b.pitch;

export interface CabinPreset {
  id: 'dense' | 'standard' | 'premium' | 'three';
  name: string;
  desc: string;
  cabin: Cabin;
}

/** 미리 정해 둔 배치 (그 기종에 맞는 것만) */
export function cabinPresets(m: ModelDef): CabinPreset[] {
  if (fixedCabin(m)) return [];
  const std = defaultCabin(m);
  const out: CabinPreset[] = [
    { id: 'dense', name: '일반석만 (촘촘)', desc: '좌석이 가장 많아요. 값싼 관광 노선에 좋아요', cabin: { first: 0, business: 0, pitch: 0 } },
    { id: 'standard', name: '표준', desc: '기종표대로의 흔한 배치', cabin: std },
  ];
  if (canBusiness(m)) {
    const biz = Math.min(maxBusiness(m, { first: 0, business: 0, pitch: 1 }), Math.max(std.business + 4, Math.round(m.seats * (m.seats < 230 ? 0.16 : 0.22))));
    out.push({ id: 'premium', name: '비즈니스 많이', desc: '사업 손님이 많은 먼 노선에 좋아요', cabin: { first: 0, business: biz, pitch: 1 } });
  }
  if (canFirst(m)) {
    const first = Math.min(maxFirst(m, { first: 0, business: 0, pitch: 2 }), m.seats >= 380 ? 14 : 8);
    const biz = Math.round(m.seats * 0.15);
    out.push({ id: 'three', name: '3등급 (일등석까지)', desc: '일등석·비즈니스석·넓은 일반석. 비싸게 팔지만 좌석이 적어요', cabin: { first, business: biz, pitch: 2 } });
  }
  return out;
}

/** 손님 나누기에 쓰는 좌석 요약 (한 번 날 때) */
export interface CabinStats {
  seats: number;
  /** 고급 좌석 (일등 + 비즈니스) */
  prem: number;
  first: number;
  /** 일반석 */
  econ: number;
  pitch: Pitch;
  meal: number;
  /** 초음속기처럼 한 등급뿐 (모든 좌석을 고급 좌석으로 셈) */
  fixed: boolean;
}

export function cabinStats(m: ModelDef, cab: Cabin, meal: number): CabinStats {
  if (fixedCabin(m)) return { seats: m.seats, prem: m.seats, first: 0, econ: 0, pitch: 1, meal, fixed: true };
  const econ = economySeats(m, cab);
  return { seats: cab.first + cab.business + econ, prem: cab.first + cab.business, first: cab.first, econ, pitch: cab.pitch, meal, fixed: false };
}

/** 사업 손님이 고급 좌석에 앉을 때의 평균 운임 배수 */
export function premYield(st: CabinStats, d: number, fixedYield: number): number {
  if (st.prem <= 0) return 0;
  if (st.fixed) return fixedYield;
  const biz = st.prem - st.first;
  return (biz * businessYield(d) + st.first * firstYield(d)) / st.prem;
}

/** 사업 손님이 이 회사를 고르는 정도에 고급 좌석이 주는 배수 (먼 길일수록 크다) */
export function premiumAttraction(premRatio: number, d: number, hasFirst: boolean): number {
  const k = 2 + 6 * Math.min(1, Math.max(0, d / 8000));
  const base = Math.sqrt((1 + premRatio * k) / (1 + STD_PREMIUM * k));
  return base * (hasFirst && d > 3500 ? 1.03 : 1);
}

/** 고급 좌석이 많으면 기내식·서비스비가 더 든다 (표준 배치가 1) */
export function premiumCostMult(premShare: number): number {
  return (1 + 1.5 * premShare) / (1 + 1.5 * STD_PREMIUM);
}

/** 좌석 배치도에 쓰는 한 줄 좌석 수 (동체 폭에 따라) */
export function abreast(m: ModelDef): { first: number; business: number; economy: number } {
  if (m.seats < 60) return { first: 0, business: 2, economy: 4 };
  if (m.seats < 120) return { first: 0, business: 3, economy: 5 };
  if (m.body === 'wide' || m.body === 'widetri' || m.body === 'jumbo' || m.body === 'double') {
    const wide = m.seats >= 380 ? 10 : m.seats >= 290 ? 9 : 8;
    return { first: 4, business: wide >= 9 ? 7 : 6, economy: wide };
  }
  return { first: 4, business: 4, economy: 6 };
}
