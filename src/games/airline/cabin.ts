import { MODEL, isFreighter } from './aircraft';
import type { BizModel, Cabin, CabinPreset, ModelDef, Plane, SeatClass } from './types';

/**
 * 좌석 등급: 일등석(F)·비즈니스(C)·이코노미(Y).
 * 비행기 안 넓이를 이코노미 좌석으로 세어(기종 좌석 × 1.1) 일등석 한 자리는 3.5석, 비즈니스 한 자리는 2석 넓이를 쓴다.
 * 비즈니스석은 1979년 무렵 생겼다 — 그 전 2등급은 일등석·이코노미.
 * 손님은 등급마다 따로 고른다: 사업 손님일수록, 멀리 갈수록, 옛날일수록 일등석을 많이 찾는다.
 */

export const F_SPACE = 3.5;
export const C_SPACE = 2;
/** 비즈니스석이 생긴 해 */
export const BUSINESS_CLASS_YEAR = 1979;

export const CLASS_INFO: Record<SeatClass, { name: string; short: string; icon: string }> = {
  f: { name: '일등석', short: 'F', icon: '👑' },
  c: { name: '비즈니스', short: 'C', icon: '💼' },
  y: { name: '이코노미', short: 'Y', icon: '💺' },
};

export const PRESETS: readonly CabinPreset[] = ['three', 'two', 'eco', 'dense'];

export const PRESET_INFO: Record<CabinPreset, { name: string; desc: string }> = {
  three: { name: '3등급', desc: '일등석·비즈니스·이코노미 — 넓은 동체 장거리기' },
  two: { name: '2등급', desc: '비즈니스(1979년 전에는 일등석)·이코노미' },
  eco: { name: '모두 이코노미', desc: '한 등급, 보통 간격' },
  dense: { name: '고밀도', desc: '좌석 간격을 좁혀 좌석이 더 많아요 (조금 덜 편해요)' },
};

/** 비행기 안 넓이 (이코노미 좌석 수로) */
export function cabinSpace(m: ModelDef): number {
  return m.seats * 1.1;
}

export function seatsOf(c: Cabin): number {
  return c.f + c.c + c.y;
}

/** 본보기대로 놓은 좌석 */
export function presetCabin(m: ModelDef, preset: CabinPreset, year: number): Cabin {
  if (isFreighter(m) || m.seats <= 0) return { f: 0, c: 0, y: 0 };
  // 초음속기는 한 등급 (값은 초음속 웃돈으로 받는다)
  if (m.body === 'sst') return { f: 0, c: 0, y: m.seats };
  const S = cabinSpace(m);
  switch (preset) {
    case 'dense':
      return { f: 0, c: 0, y: Math.round(S * 1.12) };
    case 'eco':
      return { f: 0, c: 0, y: Math.round(S) };
    case 'two': {
      if (year < BUSINESS_CLASS_YEAR) {
        const f = Math.max(1, Math.round((S * 0.15) / F_SPACE));
        return { f, c: 0, y: Math.round(S - f * F_SPACE) };
      }
      const c = Math.max(1, Math.round((S * 0.18) / C_SPACE));
      return { f: 0, c, y: Math.round(S - c * C_SPACE) };
    }
    case 'three': {
      const f = Math.max(1, Math.round((S * 0.05) / F_SPACE));
      const c = Math.max(1, Math.round((S * 0.16) / C_SPACE));
      return { f, c, y: Math.round(S - f * F_SPACE - c * C_SPACE) };
    }
  }
}

/** 이 본보기를 쓸 수 없는 까닭 (없으면 null) */
export function presetBlocker(m: ModelDef, preset: CabinPreset, year: number, model: BizModel): string | null {
  if (isFreighter(m)) return '화물기에는 좌석이 없어요';
  if (m.body === 'sst') return preset === 'eco' ? null : '초음속기는 한 등급만 둬요';
  if (model === 'lcc' && (preset === 'two' || preset === 'three')) return '저가항공은 한 등급만 둬요';
  if (preset === 'three') {
    if (year < BUSINESS_CLASS_YEAR) return `비즈니스석은 ${BUSINESS_CLASS_YEAR}년부터예요`;
    if (m.seats < 150) return '3등급은 150석 넘는 비행기만 둬요';
  }
  return null;
}

/** 새로 들인 비행기의 좌석 본보기 (사업 모델·크기·시대에 맞춰) */
export function defaultPreset(m: ModelDef, model: BizModel, year: number): CabinPreset {
  if (m.body === 'sst') return 'eco';
  if (model === 'lcc') return 'dense';
  if (m.seats < 60) return 'eco';
  if (m.seats >= 250 && m.range >= 9000 && year >= BUSINESS_CLASS_YEAR) return 'three';
  return 'two';
}

/** 새 비행기의 좌석 */
export function newCabin(modelId: string, model: BizModel, year: number): Cabin {
  const m = MODEL[modelId];
  return presetCabin(m, defaultPreset(m, model, year), year);
}

/** 비행기의 좌석 (저장에 없으면 흔한 2등급) */
export function cabinOf(p: Pick<Plane, 'model' | 'cabin'>): Cabin {
  return p.cabin ?? presetCabin(MODEL[p.model], 'two', 2000);
}

/** 지금 좌석이 어느 본보기와 같은지 (없으면 null) */
export function presetOf(m: ModelDef, cabin: Cabin, year: number): CabinPreset | null {
  for (const p of PRESETS) {
    for (const y of [year, BUSINESS_CLASS_YEAR - 1]) {
      const c = presetCabin(m, p, y);
      if (c.f === cabin.f && c.c === cabin.c && c.y === cabin.y) return p;
    }
  }
  return null;
}

/** 좌석을 바꾸는 값 (기종 값의 2.5%, 억) */
export function refitCost(m: ModelDef): number {
  return Math.round(m.price * 0.025);
}

/** 짧게 쓴 좌석: 'F8 C30 Y250' */
export function cabinText(c: Cabin): string {
  const parts: string[] = [];
  if (c.f > 0) parts.push(`F${c.f}`);
  if (c.c > 0) parts.push(`C${c.c}`);
  parts.push(`Y${c.y}`);
  return parts.join(' ');
}

// ------------------------------------------------------------------ 등급마다 손님

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

/** 사업 손님 가운데 일등석을 찾는 비율 (옛날일수록 많다) */
const F_ERA: readonly (readonly [number, number])[] = [
  [1960, 0.22],
  [1978, 0.16],
  [1990, 0.1],
  [2005, 0.065],
  [2020, 0.045],
];
/** 사업 손님 가운데 비즈니스석을 찾는 비율 (1979년 무렵 생겨 늘었다) */
const C_ERA: readonly (readonly [number, number])[] = [
  [1977, 0],
  [1980, 0.16],
  [1990, 0.3],
  [2000, 0.36],
  [2020, 0.4],
];

export interface ClassShares {
  /** 사업 손님 가운데 일등석·비즈니스 */
  fB: number;
  cB: number;
  /** 관광 손님 가운데 일등석·비즈니스 */
  fL: number;
  cL: number;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** 등급마다 손님 비율 (시대·거리) */
export function classShares(year: number, d: number): ClassShares {
  const long = clamp01((d - 1500) / 6500);
  const fB = interp(F_ERA, year) * (0.35 + 0.65 * long);
  const cB = interp(C_ERA, year) * (0.55 + 0.45 * long);
  return { fB, cB, fL: fB * 0.05, cL: Math.min(0.25, cB * (0.08 + 0.004 * Math.max(0, year - 1990))) };
}

/** 이코노미 운임에 견준 비즈니스·일등석 운임 (멀수록 차이가 크다) */
export function classFareMult(d: number): { c: number; f: number } {
  const long = clamp01(d / 8000);
  const c = 1.9 + 0.8 * long;
  return { c, f: c * 1.6 };
}

/** 이코노미에 탄 사업 손님이 내는 운임 배수 (바꿀 수 있는 비싼 표. 할인표가 드물던 옛날일수록 높다) */
export function yBizMult(year: number): number {
  return interp(
    [
      [1960, 1.5],
      [1980, 1.35],
      [2000, 1.22],
    ],
    year,
  );
}

/** 등급 운임 조정에 손님이 줄어드는 정도 */
const ELASTIC_F = 0.7;
const ELASTIC_C = 1.0;

export interface ClassPax {
  f: number;
  c: number;
  y: number;
  /** 이코노미 손님 가운데 사업 손님 */
  yBiz: number;
}

/**
 * 한 회사가 태울 손님(사업 gotB·관광 gotL)을 등급 좌석(한 방향 주간)에 나눈다.
 * 일등석·비즈니스는 등급 운임에 따라 손님이 줄고(일부는 아래 등급으로), 자리가 없으면 아래 등급으로 내려간다.
 * 남는 윗등급 자리에는 넘치는 이코노미 손님이 이코노미 값에 탄다.
 */
export function allocateClasses(seats: Cabin, gotB: number, gotL: number, sh: ClassShares, fareC: number, fareF: number): ClassPax {
  let dF = gotB * sh.fB + gotL * sh.fL;
  let dC = gotB * sh.cB + gotL * sh.cL;
  let yB = gotB * (1 - sh.fB - sh.cB);
  const yL = gotL * (1 - sh.fL - sh.cL);
  if (fareF !== 0 && dF > 0) {
    const k = (1 + fareF / 100) ** -ELASTIC_F;
    dC += dF * (1 - k) * 0.5;
    dF *= k;
  }
  if (fareC !== 0 && dC > 0) {
    const k = (1 + fareC / 100) ** -ELASTIC_C;
    yB += Math.max(0, dC * (1 - k)) * 0.6;
    dC *= k;
  }
  const F = Math.min(dF, seats.f);
  dC += (dF - F) * 0.7;
  const C = Math.max(0, Math.min(dC, seats.c));
  yB += Math.max(0, dC - C) * 0.7;
  const dY = yB + yL;
  const Y = Math.min(dY, seats.y);
  const up = Math.max(0, Math.min(dY - Y, seats.f - F + seats.c - C));
  const yAll = Y + up;
  return { f: F, c: C, y: yAll, yBiz: dY > 0 ? (yAll * yB) / dY : 0 };
}

/** 사업 손님이 윗등급 좌석을 얼마나 반기는지 (모두 이코노미면 조금 덜 고른다, 멀수록 더) */
export function premiumAppeal(seats: Cabin, d: number): number {
  const total = seatsOf(seats);
  if (total <= 0) return 1;
  const share = (seats.f + seats.c) / total;
  const w = 0.08 + 0.12 * clamp01(d / 8000);
  return 1 - w + w * Math.min(1, share / 0.07);
}
