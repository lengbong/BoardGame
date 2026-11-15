import { BIZ_ECON_YIELD, businessYield, firstYield } from './cabin';
import type { ClassSplit } from './types';

/**
 * 등급별 운임과 수요: 회사가 태울 손님(사업·관광)을 일등석·비즈니스석·일반석으로 나눈다.
 *
 * - 고급 좌석을 찾는 손님은 사업 손님일수록, 멀리 갈수록, 요즘일수록 많아요 (관광 손님도 조금씩 늘어요).
 * - 비즈니스석은 1979년 무렵 생겼어요. 그 전에는 고급 좌석 손님이 모두 일등석을 찾고, 일등석이 없으면 비즈니스석에 앉아요.
 *   그 뒤로 일등석은 점점 드물어져요.
 * - 등급마다 운임을 따로 정해요 (일반석 운임에 견준 기본 배수 × (1 + 조정 %)). 일등석 손님은 값에 덜 민감하고,
 *   비즈니스석 손님은 조금 더 민감해요. 너무 비싸면 일부는 아래 등급으로, 일부는 다른 회사로 가요.
 * - 자리가 모자라면 아래 등급으로 내려가고(일등석 → 비즈니스석 → 일반석), 일반석이 차면 남은 고급 좌석에
 *   일반석 값으로 앉아요.
 */

/** 비즈니스석이 생긴 해 */
export const BUSINESS_CLASS_YEAR = 1979;
/** 등급 운임 조정 범위 (%) */
export const CLASS_FARE_MIN = -30;
export const CLASS_FARE_MAX = 30;
/** 등급 운임에 손님이 줄어드는 정도 (일반석은 회사 고르기에서 셈한다) */
export const ELASTIC_F = 1.3;
export const ELASTIC_C = 1.6;
/** 너무 비싸서 안 사는 고급 좌석 손님 가운데 아래 등급으로 내려가는 몫 (나머지는 다른 회사로) */
const DOWN_F = 0.5;
const DOWN_C = 0.6;
/** 자리가 다 차서 아래 등급으로 내려가는 몫 (나머지는 다른 회사로). 그 등급 좌석이 아예 없으면 모두 내려간다 */
const SPILL_DOWN = 0.7;
const spillDown = (cap: number) => (cap > 0 ? SPILL_DOWN : 1);

function interp(table: readonly (readonly [number, number])[], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1];
      const [x1, y1] = table[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** 사업 손님 가운데 고급 좌석(일등·비즈니스)을 찾는 비율 (먼 길 기준) */
const PREM_B: readonly (readonly [number, number])[] = [
  [1960, 0.24],
  [1980, 0.27],
  [2000, 0.32],
  [2020, 0.37],
  [2040, 0.4],
];
/** 관광 손님 가운데 고급 좌석을 찾는 비율 (넉넉한 여행객이 늘어난다) */
const PREM_L: readonly (readonly [number, number])[] = [
  [1960, 0.008],
  [1990, 0.015],
  [2005, 0.03],
  [2020, 0.05],
  [2040, 0.06],
];
/** 고급 좌석 손님 가운데 일등석을 찾는 비율 (비즈니스석이 생기기 전에는 모두) */
const FIRST_FRAC: readonly (readonly [number, number])[] = [
  [1978, 1],
  [1979, 0.75],
  [1982, 0.45],
  [1990, 0.3],
  [2005, 0.17],
  [2020, 0.11],
  [2040, 0.09],
];

/** 등급마다 손님이 찾는 비율 (사업 손님 B·관광 손님 L 가운데 일등석 f·비즈니스석 c) */
export interface ClassShares {
  fB: number;
  cB: number;
  fL: number;
  cL: number;
}

const shareCache = new Map<number, ClassShares>();

/** 그 해·그 거리에서 등급마다 손님이 찾는 비율 */
export function classShares(year: number, d: number): ClassShares {
  const key = Math.round(year) * 100000 + Math.round(d / 50);
  const hit = shareCache.get(key);
  if (hit) return hit;
  const long = clamp01((d - 800) / 7200);
  const pB = interp(PREM_B, year) * (0.45 + 0.55 * long);
  const pL = interp(PREM_L, year) * (0.5 + 0.5 * long);
  // 짧은 노선에는 일등석 손님이 드물다 (비즈니스석이 생긴 뒤)
  const ff = year < BUSINESS_CLASS_YEAR ? 1 : interp(FIRST_FRAC, year) * (0.45 + 0.55 * long);
  const out = { fB: pB * ff, cB: pB * (1 - ff), fL: pL * ff, cL: pL * (1 - ff) };
  if (shareCache.size > 20000) shareCache.clear();
  shareCache.set(key, out);
  return out;
}

/** 일반석 운임에 견준 일등석·비즈니스석 기본 운임 배수 (먼 길일수록 차이가 크다) */
export function classFareMult(d: number): { f: number; c: number } {
  return { f: firstYield(d), c: businessYield(d) };
}

/** 등급 운임 조정에 손님이 늘거나 주는 배수 (너무 싸게 팔아도 한없이 늘지는 않는다) */
export function classPriceK(fare: number, elastic: number): number {
  if (fare === 0) return 1;
  return Math.min(1.35, (1 + fare / 100) ** -elastic);
}

/** 한 회사의 등급별 좌석 (한 방향 주간). 초음속기처럼 한 등급뿐인 좌석은 일반석으로 센다 */
export interface ClassCaps {
  first: number;
  business: number;
  econ: number;
}

/** 등급 나누기 결과 (한 방향 주간 손님) */
export interface ClassResult {
  /** 앉은 사업·관광 손님 */
  b: number;
  l: number;
  /** 일등석·비즈니스석 표를 산 손님 */
  f: number;
  c: number;
  /** 일반석 표를 산 사업·관광 손님 (남은 고급 좌석에 앉은 손님 포함) */
  yB: number;
  yL: number;
  /** 일반석 표로 일등석·비즈니스석에 앉은 손님 */
  upF: number;
  upC: number;
}

/**
 * 회사가 끌어온 손님(wantB 사업·wantL 관광)을 등급 좌석에 나눈다.
 * 등급 운임이 비싸면 일부는 아래 등급으로·일부는 다른 회사로, 자리가 모자라면 아래 등급으로 내려가고,
 * 일반석이 차면 남은 고급 좌석에 일반석 값으로 앉는다. 앉지 못한 손님은 b·l에 들지 않는다.
 */
export function allocateClasses(caps: ClassCaps, wantB: number, wantL: number, sh: ClassShares, fareF: number, fareC: number): ClassResult {
  const kF = classPriceK(fareF, ELASTIC_F);
  const kC = classPriceK(fareC, ELASTIC_C);
  // 등급마다 찾는 손님 (사업 b·관광 l)
  let fb = wantB * sh.fB;
  let fl = wantL * sh.fL;
  let cb = wantB * sh.cB;
  let cl = wantL * sh.cL;
  let yb = Math.max(0, wantB - fb - cb);
  let yl = Math.max(0, wantL - fl - cl);
  // 일등석 운임: 비싸면 일부는 비즈니스석으로 (싸면 비즈니스석 손님 일부가 올라온다)
  const movF = 1 - kF;
  cb = Math.max(0, cb + fb * movF * DOWN_F);
  cl = Math.max(0, cl + fl * movF * DOWN_F);
  fb *= kF;
  fl *= kF;
  // 비즈니스석 운임: 비싸면 일부는 일반석으로
  const movC = 1 - kC;
  yb = Math.max(0, yb + cb * movC * DOWN_C);
  yl = Math.max(0, yl + cl * movC * DOWN_C);
  cb *= kC;
  cl *= kC;
  // 일등석 자리
  const dF = fb + fl;
  const F = Math.min(dF, caps.first);
  const overF = dF - F;
  if (overF > 0 && dF > 0) {
    cb += (overF * spillDown(caps.first) * fb) / dF;
    cl += (overF * spillDown(caps.first) * fl) / dF;
  }
  // 비즈니스석 자리
  const dC = cb + cl;
  const C = Math.min(dC, caps.business);
  const overC = dC - C;
  if (overC > 0 && dC > 0) {
    yb += (overC * spillDown(caps.business) * cb) / dC;
    yl += (overC * spillDown(caps.business) * cl) / dC;
  }
  // 일반석 자리, 넘치면 남은 고급 좌석에 일반석 값으로
  const dY = yb + yl;
  const Y = Math.min(dY, caps.econ);
  const freeC = Math.max(0, caps.business - C);
  const freeF = Math.max(0, caps.first - F);
  const over = dY - Y;
  const upC = Math.min(over, freeC);
  const upF = Math.min(over - upC, freeF);
  const yAll = Y + upC + upF;
  const yBiz = dY > 0 ? (yAll * yb) / dY : 0;
  const fBiz = dF > 0 ? (F * fb) / dF : 0;
  const cBiz = dC > 0 ? (C * cb) / dC : 0;
  return { b: fBiz + cBiz + yBiz, l: F - fBiz + (C - cBiz) + (yAll - yBiz), f: F, c: C, yB: yBiz, yL: yAll - yBiz, upF, upC };
}

/** 다른 회사에서 넘어온 손님(자리가 없거나 비싸서 옮긴 손님)을 남은 자리에 일반석 값으로 앉힌다 */
export function seatSpill(res: ClassResult, caps: ClassCaps, addB: number, addL: number): void {
  const add = addB + addL;
  if (add <= 0) return;
  const inEcon = Math.max(0, caps.econ - (res.yB + res.yL - res.upF - res.upC));
  const toEcon = Math.min(add, inEcon);
  let rest = add - toEcon;
  const upC = Math.min(rest, Math.max(0, caps.business - res.c - res.upC));
  rest -= upC;
  const upF = Math.min(rest, Math.max(0, caps.first - res.f - res.upF));
  res.upC += upC;
  res.upF += upF;
  res.yB += addB;
  res.yL += addL;
  res.b += addB;
  res.l += addL;
}

/**
 * 등급마다 수입 (한 방향 주간 손님 × 운임, 단위는 '일반석 기본 운임' 배수).
 * p: 일반석 운임 배수 (1 + 일반석 조정) × 초음속 웃돈. 일반석 표를 산 사업 손님은 바꿀 수 있는 비싼 표를 산다.
 */
export function classUnits(res: ClassResult, d: number, fareF: number, fareC: number, p: number): { f: number; c: number; y: number } {
  const m = classFareMult(d);
  return {
    f: res.f * m.f * (1 + fareF / 100),
    c: res.c * m.c * (1 + fareC / 100),
    y: (res.yB * BIZ_ECON_YIELD + res.yL) * p,
  };
}

/** 화면용 묶음: 자리별 손님(앉은 곳 기준)·좌석과 등급별 수입 */
export function classSplit(res: ClassResult, caps: ClassCaps, rev: { f: number; c: number; y: number }): ClassSplit {
  return {
    pax: [res.f + res.upF, res.c + res.upC, Math.max(0, res.yB + res.yL - res.upF - res.upC)],
    seats: [caps.first, caps.business, caps.econ],
    rev: [rev.f, rev.c, rev.y],
  };
}

/** 등급 하나의 탑승률 (좌석이 없으면 null) */
export function classLf(split: ClassSplit | undefined, k: 0 | 1 | 2): number | null {
  if (!split || split.seats[k] <= 0) return null;
  return Math.min(1, split.pax[k] / split.seats[k]);
}

export const CLASS_NAMES = ['일등석', '비즈니스석', '일반석'] as const;
