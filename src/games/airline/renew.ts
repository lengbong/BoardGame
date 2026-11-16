import { MODEL, leadTime } from './aircraft';
import { Planner } from './ai';
import { planModelsFor } from './bizmodel';
import { charterPlaneIds } from './charters';
import { CITY, airportClass, dist } from './cities';
import { checkAtOf, condOf, inCheck } from './condition';
import { bestFreq, buyBlocker, idlePlanes, planeById, routeById, sellAmount } from './rules';
import { DEPRECIATION, INSURANCE, MAX_DELIVERIES, WEEK_HOURS, draftsOf, estimateExisting, leaseDeposit, leaseRent, legFreq, legHours, newLeaseFixed, orderPrice, planeAge, planeFixed, planeHours } from './simulate';
import { yearOf } from './time';
import type { AirlineState, Company, Order, Plane } from './types';

/**
 * 낡은 비행기 바꾸기 (비행기 화면의 ‘바꿀 비행기’와 경영 비서가 함께 쓴다).
 *
 * - 열여덟 해가 넘은 비행기를 낡은 비행기로 본다. 많이 닳았거나(점검 시점 아래) 스물다섯 해가 넘으면 급하다.
 * - 바꾸는 방법은 비서가 고른다: 급하면 리스로 바로(한 달에 리스·중고 MAX_DELIVERIES대까지),
 *   돈이 넉넉하면 새 비행기를 주문해 둔다. 주문한 비행기가 오면 낡은 비행기의 노선을 넘겨받고 낡은 비행기는 판다 (rules.ts handOver).
 * - 노선에 넣지 않은 낡은 비행기는 예비기로 둘 몫(날고 있는 비행기의 8%)만 남기고 판다 (리스기는 돌려준다).
 */

/** 이만큼 나이를 먹으면 낡은 비행기 */
export const OLD_AGE = 18;
/** 이만큼 나이를 먹으면 급히 바꾼다 */
export const URGENT_AGE = 25;
/** 바꿔서 달 이익이 이만큼(억)은 늘어야 권한다 */
export const RENEW_MIN = 0.5;
/** 주문은 이만큼 달 안에 오는 기종만 */
const ORDER_LEAD_MAX = 12;
/** 이만큼 날고 있으면 쉬는 비행기를 예비기로 남긴다 (경영 비서와 같은 기준) */
const SPARE_FLEET = 12;
/** 예비기로 남길 몫: 날고 있는 비행기의 이만큼 (spareCover가 그만큼에서 다 찬다) */
const SPARE_SHARE = 0.08;

export const isOld = (state: Pick<AirlineState, 't'>, p: Plane): boolean => planeAge(state, p) >= OLD_AGE;
export const isRetired = (state: Pick<AirlineState, 'q'>, p: Plane): boolean => yearOf(state.q) > MODEL[p.model].end;
/** 기체 상태가 회사가 정한 점검 시점 아래 */
export const isWorn = (c: Company, p: Plane): boolean => condOf(p) < checkAtOf(c);
/** 많이 닳았거나 아주 낡아 급히 바꿀 비행기 */
export const isUrgent = (state: Pick<AirlineState, 't'>, c: Company, p: Plane): boolean => isWorn(c, p) || planeAge(state, p) >= URGENT_AGE;
/** 이 비행기를 바꾸려고 해 둔 주문 */
export const orderFor = (c: Company, planeId: number): Order | undefined => c.orders.find((o) => o.replaces === planeId);

export interface RenewOption {
  plane: number;
  from: string;
  age: number;
  cond: number;
  urgent: boolean;
  /** 새 리스기로 바로 바꿀 때 (gain: 리스료까지 뺀 달 이익 변화) */
  lease: { model: string; gain: number; deposit: number; rent: number } | null;
  /** 새 비행기를 주문해 바꿀 때 (gain: 도착한 뒤 달 이익 변화, net: 값이 깎이는 몫까지 뺀 것) */
  order: { model: string; gain: number; net: number; price: number; lead: number } | null;
  /** 낡은 비행기를 팔 때 받는 돈 (리스기는 보증금 − 위약금) */
  sale: number;
}

/** 기종을 들일 수 있는지만 본다 (돈·이번 달 리스 한도는 빼고): 사업 모델·생산 연도·나라 관계·비행기 수 한도 */
function probeOf(state: AirlineState, ci: number): AirlineState {
  return { ...state, companies: state.companies.map((x, i) => (i === ci ? { ...x, cash: Number.MAX_SAFE_INTEGER, taken: 0 } : x)) };
}

/**
 * 노선을 나는 이 비행기를 무엇으로 바꾸면 좋을지. 비행기가 나는 노선마다 같은 횟수(한 주 비행시간 안에서)로 대 본다.
 * 노선에 없거나, 이미 바꾸려고 주문해 둔 비행기는 null
 */
export function renewOption(state: AirlineState, ci: number, planeId: number, probe: AirlineState = probeOf(state, ci)): RenewOption | null {
  const c = state.companies[ci];
  const p = planeById(c, planeId);
  if (!p || p.legs.length === 0 || orderFor(c, p.id)) return null;
  const year = yearOf(state.q);
  const pm = MODEL[p.model];
  const total = planeHours(c, p);
  const parts = p.legs.flatMap((l) => {
    const r = routeById(c, l.route);
    if (!r || l.freq <= 0) return [];
    const onRoute = c.planes.filter((x) => legFreq(x, r.id) > 0);
    const rest = draftsOf(state, c, r.id).filter((_, i) => onRoute[i]?.id !== p.id);
    const d = dist(r.a, r.b);
    const share = total > 0 ? (2 * legHours(pm, d) * l.freq) / total : 1 / p.legs.length;
    return [{ r, d, freq: l.freq, before: estimateExisting(state, ci, r).profit, rest, share }];
  });
  if (parts.length === 0) return null;
  let lease: RenewOption['lease'] = null;
  let order: RenewOption['order'] = null;
  for (const m of planModelsFor(c, year)) {
    if (pm.seats > 0 && (m.seats < pm.seats * 0.5 || m.seats > pm.seats * 2.5)) continue;
    if (parts.some((x) => m.range < x.d || airportClass(CITY[x.r.a], year) < m.runway || airportClass(CITY[x.r.b], year) < m.runway)) continue;
    if (buyBlocker(probe, ci, m.id, true)) continue;
    let hours = 0;
    const freqs = parts.map((x) => {
      const per = 2 * legHours(m, x.d);
      const f = Math.max(0, Math.min(x.freq, Math.floor((WEEK_HOURS - hours) / per)));
      hours += per * f;
      return f;
    });
    if (freqs.every((f) => f < 1)) continue;
    const gainWith = (fixed: number) =>
      parts.reduce((sum, x, i) => {
        const planes = freqs[i] > 0 ? [...x.rest, { model: m.id, freq: freqs[i], fixed: fixed * x.share }] : x.rest;
        return sum + estimateExisting(state, ci, x.r, { planes }).profit - x.before;
      }, 0);
    const lg = gainWith(newLeaseFixed(state, m));
    if (!lease || lg > lease.gain) lease = { model: m.id, gain: lg, deposit: leaseDeposit(state, m), rent: leaseRent(state, m) };
    const lead = leadTime(m, year);
    if (lead <= ORDER_LEAD_MAX) {
      const price = orderPrice(state, m, c);
      const og = gainWith(m.price * INSURANCE);
      const net = og - (price * DEPRECIATION) / 12;
      if (!order || net > order.net) order = { model: m.id, gain: og, net, price, lead };
    }
  }
  return { plane: p.id, from: p.model, age: planeAge(state, p), cond: condOf(p), urgent: isUrgent(state, c, p), lease, order, sale: sellAmount(state, p) };
}

export type RenewHow = 'lease' | 'order';

export interface RenewBudget {
  cash: number;
  /** 이번 달 더 받을 수 있는 리스·중고 */
  leaseLeft: number;
  /** 주문하고도 남겨 둘 현금 */
  reserve: number;
}

/** 비서가 고르는 바꾸는 방법: 급하면 리스로 바로, 돈이 넉넉하면 주문, 아니면 리스. 둘 다 남는 게 없거나 못 하면 null */
export function pickHow(opt: RenewOption, b: RenewBudget): RenewHow | null {
  const leaseOk = !!opt.lease && opt.lease.gain >= RENEW_MIN && b.leaseLeft > 0 && b.cash > opt.lease.deposit;
  const orderOk = !!opt.order && opt.order.net >= RENEW_MIN && b.cash - opt.order.price > b.reserve;
  if (opt.urgent && leaseOk) return 'lease';
  if (orderOk) return 'order';
  if (leaseOk) return 'lease';
  return null;
}

/** 지난달 비용 합 */
function lastCosts(state: AirlineState, ci: number): number {
  const r = state.report?.companies[ci];
  return r ? r.fuel + r.crew + r.airport + r.service + r.sales + r.lease + r.fleet + r.branch + r.ads + r.interest + r.staff : 0;
}

/** 새 비행기를 주문하고도 남겨 둘 현금 (달 비용 석 달 치 + 200억: 경영 비서의 ‘한 대 주문해 두기’와 같은 기준) */
export function orderReserve(state: AirlineState, ci: number): number {
  return lastCosts(state, ci) * 3 + 200;
}

export function budgetOf(state: AirlineState, ci: number): RenewBudget {
  const c = state.companies[ci];
  return { cash: c.cash, leaseLeft: Math.max(0, MAX_DELIVERIES - c.taken), reserve: orderReserve(state, ci) };
}

export interface RenewItem {
  plane: number;
  from: string;
  /** 바꿀 기종 (팔기면 없다) */
  to?: string;
  how: RenewHow | 'sell';
  /** 달 이익 변화 어림 (주문은 도착한 뒤) */
  gain: number;
  /** 이번 달 현금 변화 (리스: 판 값 − 보증금, 주문: −값, 팔기: +판 값) */
  cash: number;
  /** 주문하면 몇 달 뒤에 오는지 */
  lead?: number;
  urgent?: boolean;
  age: number;
  cond: number;
}

export interface RenewPlan {
  items: RenewItem[];
  /** 달 이익 변화 어림 합 */
  gain: number;
  /** 이번 달 현금 변화 합 */
  cash: number;
  /** 노선을 나는 낡은 비행기 (주문해 둔 것은 빼고) */
  old: number;
  /** 따져 봤지만 지금은 바꾸지 않는 낡은 비행기 (남는 게 없거나, 돈·리스 한도가 모자라서) */
  kept: number;
  /** 아직 따져 보지 않은 낡은 비행기 (다음에 다시 따져 본다) */
  more: number;
}

/** 노선을 나는 낡은 비행기 (주문해 둔 것은 빼고): 급한 것부터, 그다음 나이 많은 것부터 */
export function renewCandidates(state: AirlineState, ci: number): Plane[] {
  const c = state.companies[ci];
  return c.planes
    .filter((p) => p.legs.length > 0 && isOld(state, p) && !orderFor(c, p.id))
    .map((p) => ({ p, u: isUrgent(state, c, p), age: planeAge(state, p) }))
    .sort((x, y) => Number(y.u) - Number(x.u) || y.age - x.age)
    .map((x) => x.p);
}

/**
 * 노선을 나는 낡은 비행기를 바꿀 계획. look대까지 따져 보고, max대까지 고른다.
 * 리스는 이번 달 남은 한도만큼, 주문은 남겨 둘 돈을 넘지 않을 만큼 (고르는 동안 현금을 줄여 가며 센다)
 */
export function fleetRenewPlan(state: AirlineState, ci: number, opts: { look?: number; max?: number; budget?: RenewBudget } = {}): RenewPlan {
  const look = opts.look ?? 12;
  const max = opts.max ?? 12;
  const cands = renewCandidates(state, ci);
  const b = { ...(opts.budget ?? budgetOf(state, ci)) };
  const probe = probeOf(state, ci);
  const items: RenewItem[] = [];
  let looked = 0;
  for (const p of cands) {
    if (looked >= look || items.length >= max) break;
    looked++;
    const opt = renewOption(state, ci, p.id, probe);
    if (!opt) continue;
    const how = pickHow(opt, b);
    if (how === 'lease' && opt.lease) {
      b.leaseLeft--;
      b.cash += opt.sale - opt.lease.deposit;
      items.push({ plane: p.id, from: p.model, to: opt.lease.model, how, gain: opt.lease.gain, cash: opt.sale - opt.lease.deposit, urgent: opt.urgent, age: opt.age, cond: opt.cond });
    } else if (how === 'order' && opt.order) {
      b.cash -= opt.order.price;
      items.push({ plane: p.id, from: p.model, to: opt.order.model, how, gain: opt.order.gain, cash: -opt.order.price, lead: opt.order.lead, urgent: opt.urgent, age: opt.age, cond: opt.cond });
    }
  }
  return { items, gain: sum(items, 'gain'), cash: sum(items, 'cash'), old: cands.length, kept: looked - items.length, more: cands.length - looked };
}

function sum(items: RenewItem[], k: 'gain' | 'cash'): number {
  return items.reduce((s, x) => s + x[k], 0);
}

/** 쉬는 비행기를 팔 때 (gain: 아끼는 리스료·보험료) */
export function sellItem(state: AirlineState, p: Plane): RenewItem {
  return { plane: p.id, from: p.model, how: 'sell', gain: planeFixed(p), cash: sellAmount(state, p), age: planeAge(state, p), cond: condOf(p) };
}

/** 예비기로 남길 쉬는 비행기 수 */
export function spareNeed(c: Company): number {
  const flying = c.planes.filter((p) => p.legs.length > 0).length;
  return flying >= SPARE_FLEET ? Math.max(1, Math.round(flying * SPARE_SHARE)) : 0;
}

export interface IdleOldPlan {
  items: RenewItem[];
  /** 쉬는 낡은 비행기 */
  old: number;
  /** 예비기로 남기는 쉬는 비행기 수 (젊은 내 비행기부터) */
  spare: number;
  need: number;
  gain: number;
  cash: number;
}

/**
 * 노선에 넣지 않은 낡은 비행기 정리: 예비기 몫(날고 있는 비행기의 8%)은 젊은 내 비행기부터 남기고, 나머지 낡은 비행기는 판다.
 * 리스기는 쉬어도 리스료가 나가니 예비기로 남기지 않고 돌려준다. 전세기로 나가거나 점검 중인 비행기는 빼고, skip도 뺀다
 */
export function idleOldPlan(state: AirlineState, ci: number, skip?: ReadonlySet<number>): IdleOldPlan {
  const c = state.companies[ci];
  const chartered = charterPlaneIds(state, ci);
  const idle = idlePlanes(c).filter((p) => !chartered.has(p.id) && !inCheck(p, state.t));
  const need = spareNeed(c);
  const spares = new Set(
    idle
      .filter((p) => !p.leased)
      .sort((x, y) => planeAge(state, x) - planeAge(state, y))
      .slice(0, need)
      .map((p) => p.id),
  );
  const old = idle.filter((p) => isOld(state, p));
  const items = old.filter((p) => !spares.has(p.id) && !skip?.has(p.id)).map((p) => sellItem(state, p));
  return { items, old: old.length, spare: spares.size, need, gain: sum(items, 'gain'), cash: sum(items, 'cash') };
}

// ------------------------------------------------------------------ 적용

/** 적용하다 막힌 까닭 (한 번 적용하는 동안만 쓴다) */
let blocked: string | null = null;

function planner(s: AirlineState, ci: number): Planner {
  const pl = new Planner(s, ci, 'ai-normal', () => 0.5);
  pl.onBlock = (why) => {
    blocked = why;
  };
  return pl;
}

/** 새 리스기를 들여 낡은 비행기의 노선을 넘겨받고 낡은 비행기는 판다. 한 노선도 넘겨받지 못하면 그대로 */
export function leaseReplace(s: AirlineState, ci: number, planeId: number, model: string): AirlineState {
  const pl = planner(s, ci);
  const p = planeById(pl.c, planeId);
  if (!p || p.legs.length === 0) return s;
  const legs = p.legs.map((l) => ({ ...l }));
  if (!pl.act({ type: 'lease', model })) return s;
  const pid = pl.c.planes[pl.c.planes.length - 1].id;
  if (!pl.act({ type: 'sell', plane: planeId })) return s;
  let moved = 0;
  for (const l of legs) {
    const f = Math.min(l.freq, bestFreq(pl.s, ci, pid, l.route));
    if (f >= 1 && pl.act({ type: 'assign', plane: pid, route: l.route, freq: f })) moved++;
  }
  if (moved === 0) {
    if (!blocked) blocked = `새 ${MODEL[model].name}이(가) 노선을 넘겨받을 수 없어요`;
    return s;
  }
  return pl.s;
}

/** 계획 하나를 해 본다. 안 되면 상태는 그대로이고 why에 까닭 */
export function applyRenewItem(s: AirlineState, ci: number, it: RenewItem): { state: AirlineState; why: string | null } {
  blocked = null;
  let next = s;
  if (it.how === 'lease' && it.to) next = leaseReplace(s, ci, it.plane, it.to);
  else if (it.how === 'order' && it.to) {
    const pl = planner(s, ci);
    if (planeById(pl.c, it.plane)) pl.act({ type: 'buy', model: it.to, replaces: it.plane });
    else blocked = '이미 없는 비행기예요';
    next = pl.s;
  } else if (it.how === 'sell') {
    const pl = planner(s, ci);
    pl.act({ type: 'sell', plane: it.plane });
    next = pl.s;
  }
  const why = blocked;
  blocked = null;
  return next === s ? { state: s, why: why ?? '지금은 할 수 없어요' } : { state: next, why: null };
}

/** 여러 계획을 차례로 해 본다 (안 되는 것은 건너뛰고 까닭을 모은다) */
export function applyRenew(s: AirlineState, ci: number, items: readonly RenewItem[]): { state: AirlineState; done: RenewItem[]; failed: { item: RenewItem; why: string }[] } {
  let state = s;
  const done: RenewItem[] = [];
  const failed: { item: RenewItem; why: string }[] = [];
  for (const it of items) {
    const res = applyRenewItem(state, ci, it);
    if (res.why) failed.push({ item: it, why: res.why });
    else {
      state = res.state;
      done.push(it);
    }
  }
  return { state, done, failed };
}

/** 계획 하나를 한 줄로 ('737-200 → A320 리스', '727-200 팔기') */
export function renewItemText(it: RenewItem, leased?: boolean): string {
  const from = MODEL[it.from].name;
  if (it.how === 'sell') return `${from} ${leased ? '돌려주기' : '팔기'}`;
  return `${from} → ${MODEL[it.to!].name} ${it.how === 'lease' ? '리스' : `주문 (${it.lead}달 뒤)`}`;
}
