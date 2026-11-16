import { MODEL } from './aircraft';
import { bestTimes } from './ai';
import { applyFares, recommendFares } from './fares';
import { applyAction } from './rules';
import { applyRenew, fleetRenewPlan, type RenewItem } from './renew';
import { truceFloorFor } from './relations';
import type { Fares } from './simulate';
import type { AirlineState } from './types';

/**
 * 한꺼번에 고치기 (Airline Manager의 일괄 관리처럼): 노선이 많아지면 하나씩 고치기 번거로운 일을 한 번에.
 * 미리 보기(계획)를 만들고, 그대로 적용한다. 어림은 다른 회사가 지금 그대로라고 본 이번 달 이익이다.
 */

export interface BulkPlan<T> {
  items: T[];
  /** 늘어날 달 이익 어림 합 (억) */
  gain: number;
}

/** 운임: 노선마다 추천 운임 (이익이 0.1억 넘게 늘 때만) */
export function farePlan(state: AirlineState, ci: number): BulkPlan<{ route: number; fares: Partial<Fares>; gain: number }> {
  const c = state.companies[ci];
  const items: { route: number; fares: Partial<Fares>; gain: number }[] = [];
  for (const r of c.routes) {
    if (!c.planes.some((p) => p.legs.some((l) => l.route === r.id && l.freq > 0))) continue;
    // 라이벌과 휴전 중인 노선은 건드리지 않는다 (일반석 운임을 내릴 수 없다: relations.ts)
    if (truceFloorFor(state, ci, r) !== null) continue;
    const adv = recommendFares(state, ci, r);
    const gain = adv.profit - adv.now;
    if (gain > 0.1) items.push({ route: r.id, fares: adv.fares, gain });
  }
  return { items, gain: items.reduce((s, x) => s + x.gain, 0) };
}

export function applyFarePlan(state: AirlineState, plan: BulkPlan<{ route: number; fares: Partial<Fares> }>): AirlineState {
  let s = state;
  for (const it of plan.items) s = applyFares(s, it.route, it.fares);
  return s;
}

/** 시간표: 노선마다 가장 좋은 시간대 나누기 */
export function timesPlan(state: AirlineState, ci: number): BulkPlan<{ route: number; times: [number, number, number, number]; gain: number }> {
  const c = state.companies[ci];
  const items: { route: number; times: [number, number, number, number]; gain: number }[] = [];
  for (const r of c.routes) {
    const b = bestTimes(state, ci, r.id);
    if (b && b.gain > 0.1) items.push({ route: r.id, times: b.times, gain: b.gain });
  }
  return { items, gain: items.reduce((s, x) => s + x.gain, 0) };
}

export function applyTimesPlan(state: AirlineState, plan: BulkPlan<{ route: number; times: [number, number, number, number] }>): AirlineState {
  let s = state;
  for (const it of plan.items) s = applyAction(s, { type: 'setTimes', route: it.route, times: it.times });
  return s;
}

/**
 * 낡은 비행기: 노선을 나는 열여덟 해 넘은 비행기를 경영 비서와 같은 방법으로 바꾼다 (renew.ts).
 * 급하면 새 리스기로 바로, 돈이 넉넉하면 새 비행기를 주문해 두고 오면 노선을 넘겨받는다 (많아야 max대)
 */
export function renewPlan(state: AirlineState, ci: number, max = 6): BulkPlan<RenewItem> {
  const plan = fleetRenewPlan(state, ci, { look: max * 2, max });
  return { items: plan.items, gain: plan.gain };
}

export function applyRenewPlan(state: AirlineState, ci: number, plan: BulkPlan<RenewItem>): AirlineState {
  return applyRenew(state, ci, plan.items).state;
}

/** 바꿀 비행기 이름 요약 ('747-100 → 777-300 외 2대') */
export function renewText(plan: BulkPlan<RenewItem>): string {
  if (plan.items.length === 0) return '';
  const first = plan.items[0];
  const orders = plan.items.filter((x) => x.how === 'order').length;
  return `${MODEL[first.from].name} → ${MODEL[first.to ?? first.from].name}${plan.items.length > 1 ? ` 외 ${plan.items.length - 1}대` : ''}${orders ? `, 주문 ${orders}대는 오면 바꿔요` : ''}`;
}
