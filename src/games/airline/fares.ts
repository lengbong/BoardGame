import { CARGO_FARE_MAX, CARGO_FARE_MIN } from './cargo';
import { CLASS_FARE_MAX, CLASS_FARE_MIN } from './classes';
import { FARE_MAX, FARE_MIN, applyAction } from './rules';
import { estimateExisting, routeFares, type Fares } from './simulate';
import type { AirlineState, Route } from './types';

/**
 * 추천 운임: 일반석·비즈니스석·일등석·화물 운임을 5%씩 바꿔 가며 이번 달 노선 이익 어림이 가장 큰 값을 찾는다
 * (다른 회사 운임은 지금 그대로라고 본다). 좌석·화물칸이 없는 등급은 그대로 둔다.
 */

export type FareKey = keyof Fares;

export const FARE_RANGE: Record<FareKey, [number, number]> = {
  y: [FARE_MIN, FARE_MAX],
  c: [CLASS_FARE_MIN, CLASS_FARE_MAX],
  f: [CLASS_FARE_MIN, CLASS_FARE_MAX],
  k: [CARGO_FARE_MIN, CARGO_FARE_MAX],
};

/** 이 노선에서 정할 수 있는 운임 (좌석·화물칸이 있는 것만) */
export function fareKeys(state: AirlineState, ci: number, route: Route): FareKey[] {
  const e = estimateExisting(state, ci, route);
  const out: FareKey[] = [];
  if (e.seatsWeek > 0) out.push('y');
  if (e.cls.seats[1] > 0) out.push('c');
  if (e.cls.seats[0] > 0) out.push('f');
  if (e.cargoCap > 0) out.push('k');
  return out;
}

export interface FareAdvice {
  fares: Fares;
  /** 지금 운임·추천 운임의 달 이익 어림 */
  now: number;
  profit: number;
  keys: FareKey[];
}

export function recommendFares(state: AirlineState, ci: number, route: Route): FareAdvice {
  const cur = routeFares(route);
  const est = (f: Fares) => estimateExisting(state, ci, route, { fare: f.y, fares: f }).profit;
  const now = est(cur);
  const keys = fareKeys(state, ci, route);
  let best = { ...cur };
  let bestProfit = now;
  for (let pass = 0; pass < 2; pass++) {
    let moved = false;
    for (const k of keys) {
      const [lo, hi] = FARE_RANGE[k];
      for (let v = lo; v <= hi; v += 5) {
        if (v === best[k]) continue;
        const f = { ...best, [k]: v };
        const p = est(f);
        if (p > bestProfit + 0.01) {
          bestProfit = p;
          best = f;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return { fares: best, now, profit: bestProfit, keys };
}

/** 운임 묶음을 한꺼번에 정한다 (못 바꾼 것은 그대로) */
export function applyFares(state: AirlineState, routeId: number, fares: Partial<Fares>): AirlineState {
  let s = state;
  for (const k of ['y', 'c', 'f', 'k'] as const) {
    const v = fares[k];
    if (v === undefined) continue;
    s = applyAction(s, k === 'y' ? { type: 'setFare', route: routeId, fare: v } : { type: 'setFare', route: routeId, fare: v, cls: k });
  }
  return s;
}
