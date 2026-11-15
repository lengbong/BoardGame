import { CITY, citySize, dist, pairIndex } from './cities';
import { isFreighter } from './freighters';
import type { BizModel, ModelDef } from './types';

/**
 * 화물: 두 도시 사이 짐(톤)은 경제 크기·무역 도시·거리·시대로 정하고, 10~12월(연말 쇼핑철)에 가장 많다.
 * 기름값이 오르면 짐이 조금 줄어 배로 간다.
 * 여객기는 배 아래 짐칸(넓은 동체일수록 많이)에, 화물기는 통째로 싣는다. 저가항공은 짐칸 화물을 받지 않는다.
 * 화물 운임은 싣고 내리는 값을 뺀 값으로 셈한다 (만 원/톤).
 */

/** 무역·물류 도시 (짐이 많이 오간다) */
const TRADE: Record<string, number> = {
  hongkong: 1,
  frankfurt: 0.85,
  singapore: 0.8,
  dubai: 0.75,
  tokyo: 0.7,
  seoul: 0.65,
  shanghai: 0.7,
  chicago: 0.65,
  amsterdam: 0.65,
  losangeles: 0.6,
  newyork: 0.6,
  miami: 0.55,
  taipei: 0.5,
  paris: 0.45,
  london: 0.45,
  doha: 0.4,
  osaka: 0.4,
  bangkok: 0.3,
  saopaulo: 0.3,
  mexicocity: 0.25,
  johannesburg: 0.25,
  nairobi: 0.2,
};

/** 시대마다 항공 화물 (2000년 무렵이 1, 여객보다 빨리 자랐다) */
const CARGO_ERA: readonly (readonly [number, number])[] = [
  [1960, 0.08],
  [1970, 0.22],
  [1980, 0.5],
  [1990, 0.75],
  [2000, 1],
  [2010, 1.2],
  [2020, 1.4],
  [2040, 1.7],
];

/** 달마다 화물 (10~12월 연말 성수기, 설 무렵은 적다) */
export const CARGO_MONTH: readonly number[] = [0.86, 0.86, 1.0, 0.98, 0.98, 0.97, 0.95, 0.95, 1.02, 1.1, 1.18, 1.12];

/** 수요 크기 (한 방향 주간 톤) */
const CARGO_K = 13;
/** 1톤 운임 = 일반석 기본 운임 × RATE_K (가까운 노선도 CARGO_MIN_D만큼은 받는다) */
export const RATE_K = 4.8;
export const CARGO_MIN_D = 2000;
/** 화물 운임 조정 범위 (%) */
export const CARGO_FARE_MIN = -30;
export const CARGO_FARE_MAX = 30;

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

/** 도시가 짐을 만드는 정도 (사업 도시·무역 도시일수록) */
export function tradeOf(city: string): number {
  return 0.3 + CITY[city].biz + (TRADE[city] ?? 0);
}

/** 거리에 따른 화물 배수: 가까우면 트럭·배로 가고, 멀어도 꽤 간다 */
export function cargoDistance(d: number): number {
  return Math.max(0.08, Math.min(1, (d - 300) / 1700)) * (5000 / (d + 3000)) ** 0.35;
}

/** 달마다 두 도시 화물 어림을 기억해 둔다 (최근 몇 달만) */
const cache = new Map<number, Float64Array>();

/** 두 도시 사이 한 방향 주간 화물 (톤, 기름값 영향 전). t: 그 달 */
export function cargoDemand(state: { t: number }, a: string, b: string, t = state.t): number {
  let month = cache.get(t);
  if (!month) {
    if (cache.size > 6) cache.clear();
    month = new Float64Array(4096).fill(-1);
    cache.set(t, month);
  }
  const idx = pairIndex(a, b);
  const hit = month[idx];
  if (hit >= 0) return hit;
  const year = Math.floor(t / 12);
  const m0 = ((t % 12) + 12) % 12;
  const v = CARGO_K * interp(CARGO_ERA, year + (m0 + 0.5) / 12) * (citySize(CITY[a], year) * citySize(CITY[b], year)) ** 0.85 * tradeOf(a) * tradeOf(b) * cargoDistance(dist(a, b)) * CARGO_MONTH[m0];
  month[idx] = v;
  return v;
}

/** 기름값이 오르면 짐이 조금 줄어든다 (배·트럭으로) */
export function oilCargoMult(oil: number): number {
  return Math.max(0.75, Math.min(1.1, 1.2 - 0.2 * oil));
}

/** 여객기 배 아래 짐칸 (한 편 톤, 손님 짐을 싣고 남는 자리) */
export function bellyT(m: ModelDef): number {
  if (isFreighter(m) || m.body === 'sst') return 0;
  switch (m.body) {
    case 'jumbo':
    case 'double':
      return m.seats * 0.032;
    case 'wide':
    case 'widetri':
      return m.seats * 0.035;
    case 'quad':
    case 'trijet':
      return m.seats * 0.012;
    case 'narrow':
      return m.seats * 0.009;
    case 'rearjet':
      return m.seats * 0.006;
    default:
      return m.seats * 0.004;
  }
}

/** 한 편에 싣는 화물 (톤): 화물기는 통째로, 여객기는 짐칸 (저가항공은 받지 않는다) */
export function planeCargoT(m: ModelDef, model: BizModel): number {
  if (isFreighter(m)) return m.cargo ?? 0;
  return model === 'lcc' ? 0 : bellyT(m);
}

export interface CargoOffer {
  /** 한 방향 주간 실을 수 있는 톤 */
  cap: number;
  /** 화물 운임 조정 (%) */
  fareK: number;
  /** 그 가운데 화물기 몫 0~1 (큰 짐을 실을 수 있어 화주가 조금 더 반긴다) */
  freighter: number;
}

/** 한 회사의 운항에서 실을 수 있는 화물 */
export function cargoOfferOf(planes: readonly { model: ModelDef; freq: number }[], model: BizModel, fareK: number): CargoOffer {
  let cap = 0;
  let fcap = 0;
  for (const p of planes) {
    if (p.freq <= 0) continue;
    const t = planeCargoT(p.model, model) * p.freq;
    cap += t;
    if (isFreighter(p.model)) fcap += t;
  }
  return { cap, fareK, freighter: cap > 0 ? fcap / cap : 0 };
}

/**
 * 두 도시 화물을 회사들이 나눈다: 실을 수 있는 양·운임으로. 배·트럭·다른 나라 항공사 몫도 있다.
 * 실을 자리가 모자라면 남은 짐 절반은 자리가 남은 다른 회사로. 돌려주는 값은 회사마다 한 방향 주간 톤.
 */
export function splitCargo(demand: number, offers: readonly CargoOffer[]): number[] {
  if (demand <= 0 || offers.every((o) => o.cap <= 0)) return offers.map(() => 0);
  const w0 = (demand * 0.5) ** 0.9;
  if (offers.length === 1) {
    // 한 회사뿐이면 바로 (넘친 짐을 받을 다른 회사가 없다)
    const o = offers[0];
    const w = o.cap ** 0.9 * (1 + o.fareK / 100) ** -1.6 * (1 + 0.15 * o.freighter);
    return [Math.min(o.cap, (demand * w) / (w + w0))];
  }
  const w = offers.map((o) => (o.cap > 0 ? o.cap ** 0.9 * (1 + o.fareK / 100) ** -1.6 * (1 + 0.15 * o.freighter) : 0));
  const sum = w.reduce((s, x) => s + x, 0);
  const want = w.map((x) => (demand * x) / (sum + w0));
  const got = want.map((x, i) => Math.min(x, offers[i].cap));
  const spill = want.reduce((s, x, i) => s + (x - got[i]), 0) * 0.5;
  if (spill > 0.01) {
    const free = offers.map((o, i) => Math.max(0, o.cap - got[i]));
    const fw = w.map((x, i) => (free[i] > 0.01 ? x : 0));
    const fs = fw.reduce((s, x) => s + x, 0);
    if (fs > 0) for (let i = 0; i < got.length; i++) got[i] += Math.min(free[i], (spill * fw[i]) / fs);
  }
  return got;
}
