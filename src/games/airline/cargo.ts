import { isFreighter } from './aircraft';
import { CITY, citySize, dist, pairIndex } from './cities';
import { yearOf } from './time';
import type { AirlineState, BizModel, ModelDef } from './types';

/**
 * 화물: 두 도시 사이 짐(톤)은 경제 크기·무역 도시·거리·시대로 정하고, 10~12월에 가장 많다. 기름값이 오르면 조금 준다.
 * 여객기는 배 아래 짐칸(넓은 동체일수록 많이)에, 화물기는 통째로 싣는다. 저가항공은 짐칸 화물을 받지 않는다.
 */

/** 무역·물류 도시 (짐이 많이 오간다) */
const TRADE: Record<string, number> = {
  hongkong: 1,
  frankfurt: 0.9,
  singapore: 0.8,
  dubai: 0.8,
  tokyo: 0.7,
  seoul: 0.7,
  shanghai: 0.7,
  chicago: 0.7,
  amsterdam: 0.7,
  losangeles: 0.6,
  newyork: 0.6,
  miami: 0.6,
  taipei: 0.5,
  paris: 0.5,
  london: 0.5,
  doha: 0.4,
  osaka: 0.4,
  saopaulo: 0.3,
  mexicocity: 0.3,
  johannesburg: 0.3,
};

/** 시대마다 항공 화물 (2000년 무렵이 1, 여객보다 빨리 자랐다) */
const CARGO_ERA: readonly (readonly [number, number])[] = [
  [1960, 0.12],
  [1970, 0.3],
  [1980, 0.5],
  [1990, 0.75],
  [2000, 1],
  [2010, 1.2],
  [2020, 1.35],
  [2040, 1.6],
];

/** 달마다 화물 (연말 성수기) */
export const CARGO_MONTH = [0.86, 0.88, 1.0, 0.98, 0.98, 0.97, 0.95, 0.96, 1.02, 1.1, 1.18, 1.12];

const CARGO_K = 0.07;
/** 1톤 운임 = 이코노미 기본 운임 × RATE_K */
export const RATE_K = 6.5;
/** 1톤 싣고 내리는 값 (만 원) */
export const CARGO_HANDLING = 15;

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

export function tradeOf(city: string): number {
  return 0.3 + CITY[city].biz + (TRADE[city] ?? 0);
}

/** 거리에 따른 화물 배수: 가까우면 트럭·배로, 멀어도 꽤 간다 */
export function cargoDistance(d: number): number {
  return Math.max(0.1, Math.min(1, (d - 300) / 1700)) * (5000 / (d + 3000)) ** 0.35;
}

const cache = new Map<number, number>();

/** 두 도시 사이 한 방향 주간 화물 (톤, 기름값 영향 전) */
export function cargoDemand(state: Pick<AirlineState, 't'>, a: string, b: string, t = state.t): number {
  const key = t * 4096 + pairIndex(a, b);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const year = yearOf(Math.floor(t / 3));
  const m0 = (((t % 12) + 12) % 12) as number;
  const v =
    CARGO_K *
    interp(CARGO_ERA, year) *
    (citySize(CITY[a], year) * citySize(CITY[b], year)) ** 0.85 *
    tradeOf(a) *
    tradeOf(b) *
    cargoDistance(dist(a, b)) *
    CARGO_MONTH[m0] *
    100;
  if (cache.size > 200000) cache.clear();
  cache.set(key, v);
  return v;
}

/** 기름값이 오르면 화물이 조금 준다 */
export function oilCargoMult(oil: number): number {
  return Math.max(0.75, Math.min(1.1, 1.2 - 0.2 * oil));
}

/** 여객기 배 아래 짐칸 (한 편 톤) */
export function bellyT(m: ModelDef): number {
  if (isFreighter(m) || m.body === 'sst') return 0;
  switch (m.body) {
    case 'jumbo':
    case 'double':
      return m.seats * 0.028;
    case 'wide':
    case 'widetri':
      return m.seats * 0.03;
    case 'narrow':
    case 'quad':
    case 'trijet':
      return m.seats * 0.008;
    case 'rearjet':
      return m.seats * 0.006;
    default:
      return m.seats * 0.004;
  }
}

/** 한 편에 싣는 화물 (톤): 화물기는 통째로, 여객기는 짐칸 (저가항공은 안 받는다) */
export function planeCargoT(m: ModelDef, model: BizModel): number {
  if (isFreighter(m)) return m.cargo;
  return model === 'lcc' ? 0 : bellyT(m);
}

export interface CargoOffer {
  /** 한 방향 주간 싣는 톤 */
  cap: number;
  /** 화물 운임 조정 (%) */
  fareK: number;
  /** 그 가운데 화물기 몫 0~1 (화주가 조금 더 반긴다) */
  freighter: number;
}

/** 두 도시 화물을 회사들이 나눈다: 싣는 양·운임으로, 바다·트럭·다른 항공사 몫도 있다. 돌려주는 값은 회사마다 한 방향 주간 톤 */
export function splitCargo(demand: number, offers: readonly CargoOffer[]): number[] {
  if (demand <= 0 || offers.length === 0) return offers.map(() => 0);
  const w = offers.map((o) => (o.cap > 0 ? o.cap ** 0.9 * (1 + o.fareK / 100) ** -1.6 * (1 + 0.15 * o.freighter) : 0));
  const sum = w.reduce((s, x) => s + x, 0);
  const w0 = demand ** 0.9;
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
