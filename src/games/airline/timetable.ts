import { AIRPORT_INFO, CITY, airportClass, citySize, dist } from './cities';
import { yearOf } from './time';
import type { AirlineState, Company, Route } from './types';

/**
 * 운항 시간표: 노선의 주간 운항을 네 시간대로 나눈다.
 * 아침(06–10)·저녁(16–21)은 사업 손님이, 낮(10–16)은 관광 손님이 좋아하고, 밤(21–02)은 장거리라면 괜찮다.
 * 공항마다 시간대별 슬롯이 따로 있어서 큰 공항은 아침·저녁이 붐비고, 밤 운항을 막는 공항도 있다.
 */

export type Times = [number, number, number, number];

export const BAND_INFO = [
  { name: '아침', hours: '06–10', start: 6, len: 4, icon: '🌅' },
  { name: '낮', hours: '10–16', start: 10, len: 6, icon: '☀️' },
  { name: '저녁', hours: '16–21', start: 16, len: 5, icon: '🌇' },
  { name: '밤', hours: '21–02', start: 21, len: 5, icon: '🌙' },
] as const;

/** 시간대마다 손님이 좋아하는 정도 (사업·관광) */
const BIZ_W = [1.3, 0.75, 1.2, 0.45];
const LEIS_W = [0.9, 1.25, 1, 0.65];
/** 장거리(6,000km 넘게)는 밤에 떠도 괜찮다 (자고 가니까) */
const LONG_BIZ_W = [1.1, 0.85, 1.15, 1.05];
const LONG_LEIS_W = [0.95, 1.05, 1.05, 1];

/** 밤 운항을 막는 공항과 그 기간 (게임용 어림) */
const CURFEW: Record<string, [number, number]> = {
  london: [1900, 2100],
  zurich: [1900, 2100],
  paris: [1968, 2100],
  frankfurt: [2011, 2100],
  sydney: [1995, 2100],
  tokyo: [1978, 2009],
  osaka: [1900, 1993],
  seoul: [1900, 2000],
};

/** 이 공항이 그 해에 밤 운항을 막는지 */
export function curfew(city: string, year: number): boolean {
  const c = CURFEW[city];
  return !!c && year >= c[0] && year <= c[1];
}

/** 두 도시 가운데 하나라도 밤 운항을 막는지 */
export function routeCurfew(a: string, b: string, year: number): boolean {
  return curfew(a, year) || curfew(b, year);
}

/** 비율을 주간 횟수로 나눈다 (가장 큰 나머지부터, 합이 total) */
export function bandCounts(times: readonly number[], total: number): Times {
  const t = Math.max(0, Math.round(total));
  const sum = times.reduce((s, x) => s + Math.max(0, x), 0);
  if (t === 0) return [0, 0, 0, 0];
  if (sum <= 0) return [t, 0, 0, 0];
  const raw = times.map((x) => (Math.max(0, x) / sum) * t);
  const out = raw.map((x) => Math.floor(x)) as Times;
  let left = t - out.reduce((s, x) => s + x, 0);
  const order = raw.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((p, q) => q.r - p.r || p.i - q.i);
  for (const o of order) {
    if (left <= 0) break;
    out[o.i as 0] += 1;
    left--;
  }
  return out;
}

/** 시간대가 손님에게 얼마나 좋은지 (사업·관광, 고르게 나눈 것이 1 안팎) */
export function timeFit(times: readonly number[], d: number): { biz: number; leisure: number } {
  const sum = times.reduce((s, x) => s + Math.max(0, x), 0);
  if (sum <= 0) return { biz: 1, leisure: 1 };
  const long = d > 6000;
  const bw = long ? LONG_BIZ_W : BIZ_W;
  const lw = long ? LONG_LEIS_W : LEIS_W;
  let biz = 0;
  let leisure = 0;
  for (let i = 0; i < 4; i++) {
    const w = Math.max(0, times[i]) / sum;
    biz += w * bw[i];
    leisure += w * lw[i];
  }
  return { biz, leisure };
}

/** 새 노선의 알맞은 시간대 (거리·사업 손님 비율·밤 운항 금지에 맞춰) */
export function defaultTimes(a: string, b: string, year: number): Times {
  const d = dist(a, b);
  const biz = (CITY[a].biz + CITY[b].biz) / 2;
  const night = routeCurfew(a, b, year) ? 0 : 1;
  if (d > 6000) return [2, 2, 3, 2 * night] as Times;
  if (biz >= 0.6) return [4, 2, 4, 0];
  if (biz <= 0.4) return [2, 4, 3, 0];
  return [3, 3, 3, 0];
}

/** 시간대마다 회사가 쓸 수 있는 슬롯 비율 (큰 공항은 아침·저녁이 붐빈다) */
function bandShare(city: string, year: number): Times {
  const big = airportClass(CITY[city], year) >= 4 && citySize(CITY[city], year) >= 7.5;
  const night = curfew(city, year) ? 0 : 0.12;
  return big ? [0.24, 0.38, 0.26, night] : [0.3, 0.3, 0.28, night];
}

/** 이 회사가 이 공항에서 시간대마다 한 주에 쓸 수 있는 운항 횟수 */
export function bandCaps(state: Pick<AirlineState, 'q'>, _ci: number, city: string, total: number): Times {
  const share = bandShare(city, yearOf(state.q));
  return share.map((x) => Math.round(total * x)) as Times;
}

/** 이 회사가 이 공항에서 시간대마다 쓰는 주간 운항 (exceptRoute는 빼고) */
export function bandUsed(c: Company, city: string, routeFreqOf: (routeId: number) => number, exceptRoute?: number): Times {
  const out: Times = [0, 0, 0, 0];
  for (const r of c.routes) {
    if (r.id === exceptRoute || (r.a !== city && r.b !== city)) continue;
    const counts = bandCounts(r.times, routeFreqOf(r.id));
    for (let i = 0; i < 4; i++) out[i] += counts[i];
  }
  return out;
}

/** 밤 운항 금지에 맞게 고친 시간대 (밤 몫은 저녁으로) */
export function legalTimes(r: Pick<Route, 'a' | 'b' | 'times'>, year: number): Times {
  const t = [...r.times] as Times;
  if (routeCurfew(r.a, r.b, year) && t[3] > 0) {
    t[2] += t[3];
    t[3] = 0;
  }
  if (t.every((x) => x <= 0)) return defaultTimes(r.a, r.b, year);
  return t;
}

export { AIRPORT_INFO };
