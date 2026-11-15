import { bizModelOf } from './bizmodel';
import { CARGO_FARE_MAX, CARGO_FARE_MIN, CARGO_MIN_D, RATE_K, cargoDemand } from './cargo';
import { CLASS_FARE_MAX, CLASS_FARE_MIN, classLf } from './classes';
import { isFreighter } from './freighters';
import { routeById } from './rules';
import { baseFare, estimateExisting, pairDemand, type Fares } from './simulate';
import type { AirlineAction, AirlineState, Company, ModelDef } from './types';

/**
 * 컴퓨터의 등급 운임·화물 운임과, 사업 모델에 맞춘 노선 고르기 (ai.ts에서 쓴다).
 */

/** 컴퓨터가 쓰는 계획기 (ai.ts Planner의 일부) */
export interface FarePlanner {
  s: AirlineState;
  readonly ci: number;
  readonly normal: boolean;
  readonly c: Company;
  act(a: AirlineAction): boolean;
  /** 지금 노선 그대로의 달 이익 어림 (같은 상태면 다시 셈하지 않는다) */
  estimate(routeId: number): number;
}

/**
 * 등급 운임: 보통 컴퓨터는 몇 노선씩 돌아가며 ±5%를 어림해 보고 이익이 큰 쪽으로,
 * 쉬운 컴퓨터는 자리가 꽉 차면 올리고 많이 비면 내린다 (±15% 안에서).
 */
export function tuneClassFares(p: FarePlanner, routeId: number, deep: boolean): void {
  const r = routeById(p.c, routeId);
  const st = r?.stats;
  if (!r || !st) return;
  const lim = p.normal ? CLASS_FARE_MAX : 15;
  const has: Record<'f' | 'c' | 'k', boolean> = {
    f: (st.cls?.seats[0] ?? 0) > 0,
    c: (st.cls?.seats[1] ?? 0) > 0,
    k: (st.cargo?.cap ?? 0) > 0,
  };
  const cur = (k: 'f' | 'c' | 'k') => (k === 'f' ? (r.fareF ?? 0) : k === 'c' ? (r.fareC ?? 0) : (r.fareK ?? 0));
  const lo = (k: 'f' | 'c' | 'k') => Math.max(k === 'k' ? CARGO_FARE_MIN : CLASS_FARE_MIN, -lim);
  const hi = (k: 'f' | 'c' | 'k') => Math.min(k === 'k' ? CARGO_FARE_MAX : CLASS_FARE_MAX, lim);
  const set = (k: 'f' | 'c' | 'k', v: number) => {
    const x = Math.max(lo(k), Math.min(hi(k), v));
    if (x !== cur(k)) p.act({ type: 'setFare', route: r.id, cls: k, fare: x });
  };
  if (p.normal && deep) {
    // 어림해 보고 고르기 (등급마다 ±5%)
    for (const k of ['c', 'f', 'k'] as const) {
      if (!has[k]) continue;
      const route = routeById(p.c, routeId)!;
      const now = p.estimate(routeId);
      let best = cur(k);
      let bestProfit = now + 0.1;
      for (const v of [cur(k) - 5, cur(k) + 5]) {
        if (v < lo(k) || v > hi(k)) continue;
        const fares: Partial<Fares> = { [k]: v };
        const e = estimateExisting(p.s, p.ci, route, { fares }).profit;
        if (e > bestProfit) {
          bestProfit = e;
          best = v;
        }
      }
      set(k, best);
    }
    return;
  }
  // 자리가 꽉 차면 올리고 많이 비면 내린다
  const lfF = classLf(st.cls, 0);
  const lfC = classLf(st.cls, 1);
  if (lfF !== null) set('f', lfF > 0.97 ? cur('f') + 5 : lfF < 0.5 ? cur('f') - 5 : cur('f'));
  if (lfC !== null) set('c', lfC > 0.97 ? cur('c') + 5 : lfC < 0.5 ? cur('c') - 5 : cur('c'));
  if (has.k && st.cargo) {
    const lf = st.cargo.t / st.cargo.cap;
    set('k', lf > 0.97 ? cur('k') + 5 : lf < 0.55 ? cur('k') - 5 : cur('k'));
  }
}

/** 노선 후보를 대충 견주는 값 (사업 모델마다: 화물 전문은 짐, 저가항공은 관광 손님을 더 쳐 준다) */
export function quickValue(state: AirlineState, c: Company, a: string, b: string, d: number): number {
  const model = bizModelOf(c);
  if (model === 'cargo') return cargoDemand(state, a, b) * 0.6 * RATE_K * baseFare(Math.max(CARGO_MIN_D, d), state.q);
  const dem = pairDemand(state, a, b);
  if (model === 'lcc') return (dem.biz * 0.8 + dem.leisure * 1.3) * baseFare(d, state.q);
  return (dem.biz * 1.7 + dem.leisure) * baseFare(d, state.q);
}

/** 이 회사가 노선 후보로 보지 않는 거리 (저가항공은 먼 노선, 화물 전문은 아주 가까운 노선) */
export function skipDistance(c: Company, d: number): boolean {
  const model = bizModelOf(c);
  return (model === 'lcc' && d > 5000) || (model === 'cargo' && d < 1000);
}

/** 한 편에 싣는 양 (좌석 또는 화물 톤)과 그만큼 채울 만한 한 방향 주간 손님·짐 */
export function reachFor(state: AirlineState, m: ModelDef, a: string, b: string): { unit: number; reach: number } {
  if (isFreighter(m)) return { unit: m.cargo ?? 1, reach: cargoDemand(state, a, b) * 0.55 };
  const dem = pairDemand(state, a, b);
  return { unit: m.seats, reach: (dem.biz + dem.leisure) * 0.7 };
}
