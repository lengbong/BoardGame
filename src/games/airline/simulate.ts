import { MODEL, commonalityMult, launchDiscount } from './aircraft';
import {
  MEAL_COST,
  PITCH_COMFORT,
  cabinStats,
  defaultCabin,
  mealComfort,
  premYield,
  premiumAttraction,
  premiumCostMult,
  type CabinStats,
} from './cabin';
import { MEDIA_INFO, mediaOf } from './ads';
import { ancillaryRate, bizChoiceMult, bizCostMults, bizModelOf, cabinFor, leisureStimulus, turnMult } from './bizmodel';
import { CARGO_MIN_D, RATE_K, cargoDemand, cargoOfferOf, oilCargoMult, splitCargo } from './cargo';
import { allocateClasses, classShares, classSplit, classUnits, seatSpill, type ClassCaps } from './classes';
import { isFreighter, sizeSeats } from './freighters';
import { BUSINESS_INFO, businessMonthSeason } from './business';
import { bizMonthMult, leisureMonthMult, weather } from './calendar';
import { AIRPORT_INFO, CITY, FEE_INFO, REGIONS, airportClass, citySize, dist, pairIndex, pairKey } from './cities';
import { effectMults, fixedEventMult, priceMult, worldMult } from './events';
import { condOf, condRisk, fleetCond, inCheck } from './condition';
import { FUEL_TON, burnFuel, fuelSurcharge, tankWorth } from './fuel';
import { JOINT_BONUS, MILES_PER_MEMBER, allianceGroups, alliesOf } from './alliances';
import { LOUNGE_BIZ, LOUNGE_XFER, TERMINAL_XFER_HOURS, companyCheckCost, facilitiesUpkeep, facilitiesWorth, hasFacility, loungeBiz, loungeRep, terminalSlots } from './facilities';
import { STAFF_SHARE, overtime, payroll, staffCap, staffNeed, strikeChance } from './staff';
import { chargeLoyalty, loyaltyQuality } from './loyalty';
import { bandCaps, bandCounts, bandUsed, defaultTimes, legalTimes, timeFit } from './timetable';
import { monthOf, quarterOf, yearOf } from './time';
import type { WeatherCause } from './calendar';
import type { Rng } from '../../lib/random';
import type {
  AirlineState,
  Business,
  Cabin,
  ClassSplit,
  Company,
  CompanyReport,
  Mod,
  ModKind,
  ModelDef,
  OpsIncident,
  Plane,
  RegionId,
  Route,
  RouteReport,
  TransferReport,
} from './types';

/**
 * 하늘길 항공사의 경제 계산. 돈은 모두 억 원(오늘 돈 기준, 물가 오름 없음), 운임은 만 원.
 * 숫자들은 실제와 비슷한 느낌이 나도록 어림한 게임용 값이다.
 */

/** 한 달은 52/12주 (한 차례 = 한 달) */
export const WEEKS = 52 / 12;
/** 비행기 한 대가 한 주에 날 수 있는 시간 (여러 노선에 나누어 쓴다) */
export const WEEK_HOURS = 98;
/** 한 번 날 때마다 더 드는 시간 (지상 이동·손님 타고 내리기) */
export const LEG_OVERHEAD = 0.75;
/** 비행기 한 대가 한 노선을 한 주에 왕복하는 최대 횟수 */
export const MAX_FREQ = 28;
/** 연료 1kg 값 (만 원, 유가 지수 1일 때) */
export const FUEL_PRICE = 0.13;
/** 리스료: 달마다 새 값의 1.2% 남짓 (분기 3.5%) */
export const LEASE_RATE = 0.035 / 3;
/** 리스 보증금: 여섯 달 치 리스료 (돌려줄 때 돌려받는다) */
export const LEASE_DEPOSIT = 6;
/** 보험·관리비: 비행기마다 달에 새 값의 0.17% (분기 0.5%) */
export const INSURANCE = 0.005 / 3;
/** 쉬는 내 비행기 보관·정비비: 달마다 새 값의 0.13% */
export const IDLE_RATE = 0.004 / 3;
/** 한 달에 바로 받을 수 있는 비행기 수 (리스 + 중고) */
export const MAX_DELIVERIES = 3;
/** 법인세: 달 이익의 20% */
export const TAX_RATE = 0.2;
/** 착륙 한 번마다 드는 정비비 (기종 운항비의 몇 시간 치) */
export const CYCLE_HOURS = 0.6;
/** 사업 손님은 평균 운임의 1.7배를 낸다 */
export const BIZ_PREMIUM = 1.7;
/** 비행기 값이 해마다 줄어드는 비율 */
export const DEPRECIATION = 0.045;
/** 팔 때는 가치의 90% */
export const SELL_RATE = 0.9;
/** 승무원·정비비 배수 (기종표의 hourCost에 곱한다) */
export const CREW_MULT = 1.3;
/** 손님 한 명이 한 번 탈 때마다 드는 지상 조업비 (만 원) */
export const HANDLING = 2;
/** 표를 파는 데 드는 수수료 (운임 수입의 비율) */
export const SALES_RATE = 0.08;
/** 초음속기 표는 이만큼 비싸다 */
export const SST_PREMIUM = 2.8;
/** 갈아타는 손님: 한 번만 갈아타고, 돌아가는 거리가 곧은 거리의 1.6배를 넘지 않는다 */
export const MAX_DETOUR = 1.6;
/** 갈아타는 손님은 곧장 가는 표보다 15% 싸게 산다 */
export const XFER_FARE = 0.85;
/** 갈아타는 데 걸리는 시간 */
export const XFER_HOURS = 2;

/** 연도별 값표에서 사이 값을 셈한다 */
function interp(table: readonly (readonly [number, number])[], t: number): number {
  if (t <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [y1, v1] = table[i];
    if (t <= y1) {
      const [y0, v0] = table[i - 1];
      return v0 + ((v1 - v0) * (t - y0)) / (y1 - y0);
    }
  }
  return table[table.length - 1][1];
}

const TRAVEL: readonly (readonly [number, number])[] = [
  [1960, 0.16],
  [1970, 0.3],
  [1980, 0.48],
  [1990, 0.72],
  [2000, 0.95],
  [2010, 1.25],
  [2020, 1.5],
  [2030, 1.75],
  [2045, 2.0],
  [2060, 2.3],
  [2080, 2.6],
  [2100, 2.8],
];
const FARE: readonly (readonly [number, number])[] = [
  [1960, 3.0],
  [1970, 2.3],
  [1980, 1.6],
  [1990, 1.25],
  [2000, 1.02],
  [2010, 0.92],
  [2020, 0.86],
  [2030, 0.82],
  [2045, 0.8],
  [2100, 0.74],
];

const yearFrac = (q: number) => yearOf(q) + (quarterOf(q) - 1) / 4 + 0.125;

/** 사람들이 비행기를 타는 정도 (2000년 무렵이 1) */
export function travelFactor(q: number): number {
  return interp(TRAVEL, yearFrac(q));
}

/** 옛날일수록 비행기 표가 (오늘 돈으로) 비쌌다 */
export function fareFactor(q: number): number {
  return interp(FARE, yearFrac(q));
}

/** 편도 평균 운임 (만 원, 운임 조정 0%) */
export function baseFare(d: number, q: number): number {
  return 0.0551 * d ** 0.8 * fareFactor(q);
}

/** 기본 운임 + 유류할증 (만 원, 유가가 보통보다 높을 때, fuel.ts): 화물 운임과 한 장 값 보기에 쓴다 */
export function marketFare(state: Pick<AirlineState, 'q' | 't' | 'oil' | 'options' | 'challenge'>, d: number): number {
  return baseFare(d, state.q) + fuelSurcharge(state, d);
}

/** 한 번 나는 데 걸리는 시간 (지상 시간 포함) */
export function legHours(model: ModelDef, d: number): number {
  return d / model.speed + LEG_OVERHEAD;
}

/** 비행기가 노는 시간 없이 이 노선만 날 때 한 주 최대 왕복 수 */
export function maxFreq(model: ModelDef, d: number): number {
  return Math.max(0, Math.min(MAX_FREQ, Math.floor(WEEK_HOURS / (2 * legHours(model, d)))));
}

export function planeAge(state: Pick<AirlineState, 't'>, plane: Plane): number {
  return Math.max(0, (state.t - plane.since) / 12);
}

// ------------------------------------------------------------------ 회사 효과 (결정 사건)

const active = (m: Mod, t: number) => t < m.until;

/** 이 종류의 효과 배수를 모두 곱한다 (t: 지금 달) */
export function modMult(c: Company, kind: ModKind, t: number, match: (m: Mod) => boolean = () => true): number {
  let v = 1;
  for (const m of c.mods) if (m.kind === kind && active(m, t) && match(m)) v *= m.value;
  return v;
}

/** 유가 고정 계약이 있으면 그 값 */
export function hedgedOil(c: Company, t: number, oil: number): number {
  const h = c.mods.find((m) => m.kind === 'fuelHedge' && active(m, t));
  return h ? h.value : oil;
}

/** 이 노선에 걸린 손님 효과 (도시·지역·전체) */
function demandMult(c: Company, a: string, b: string, t: number, seg: 'biz' | 'leisure'): number {
  const ra = CITY[a].region;
  const rb = CITY[b].region;
  return modMult(c, 'demand', t, (m) => {
    if (m.seg && m.seg !== seg) return false;
    if (m.city) return m.city === a || m.city === b;
    if (m.region) return m.region === ra || m.region === rb;
    return true;
  });
}

// ------------------------------------------------------------------ 값·가치

/** 지금 새로 주문할 때 값 (박람회 특가·론치 할인·제작사 할인 반영) */
export function orderPrice(state: Pick<AirlineState, 'effects' | 'q' | 't'>, model: ModelDef, c?: Company): number {
  const year = yearOf(state.q);
  const own = c ? modMult(c, 'discount', state.t, (m) => m.model === model.id) : 1;
  return Math.round(model.price * priceMult(state.effects) * (1 - launchDiscount(model, year)) * own);
}

/** 예전 이름 (화면·테스트): 새로 살 때 값 */
export function modelPrice(state: Pick<AirlineState, 'effects' | 'q' | 't'>, model: ModelDef, c?: Company): number {
  return orderPrice(state, model, c);
}

/** 지금 리스하면 달마다 내는 돈 */
export function leaseRent(state: Pick<AirlineState, 'effects'>, model: ModelDef): number {
  return Math.round(model.price * LEASE_RATE * priceMult(state.effects) * 10) / 10;
}

/** 리스 보증금 (여섯 달 치 리스료, 돌려줄 때 돌려받는다) */
export function leaseDeposit(state: Pick<AirlineState, 'effects'>, model: ModelDef): number {
  return Math.round(leaseRent(state, model) * LEASE_DEPOSIT * 10) / 10;
}

/** 내 비행기의 지금 가치 (리스기는 0) */
export function planeValue(state: Pick<AirlineState, 'q' | 't'>, plane: Plane): number {
  if (plane.leased) return 0;
  const m = MODEL[plane.model];
  const age = planeAge(state, plane);
  const retired = yearOf(state.q) > m.end ? 0.85 : 1;
  return m.price * Math.max(0.1, 1 - DEPRECIATION * age) * retired;
}

/** 팔 때 값: 가치의 90%, 기체 상태가 나쁘면 15%까지 덜 받는다 */
export function sellPrice(state: Pick<AirlineState, 'q' | 't'>, plane: Plane): number {
  return Math.round(planeValue(state, plane) * SELL_RATE * (0.85 + 0.15 * (condOf(plane) / 100)));
}

export function businessValue(b: Business): number {
  return b.cost * 0.8;
}

/** 주식·결산 기록까지 있을 수 있는 상태 (회사 가치·시가 총액 계산) */
export type ValueState = Pick<AirlineState, 'q' | 't' | 'companies'> & Partial<Pick<AirlineState, 'stakes' | 'ledger'>>;

/** 회사 가치 = 자기 자산 가치(baseValue) + 가진 다른 회사 주식의 시가 */
export function companyValue(state: ValueState, ci: number): number {
  const c = state.companies[ci];
  if (c.out) return 0;
  return baseValue(state, ci) + stakesValue(state, ci);
}

/** 지난 열두 달 이익 합 (주가 배수) */
export function yearProfit(state: ValueState, ci: number): number {
  let sum = 0;
  for (const l of (state.ledger ?? []).slice(-12)) sum += l.companies[ci]?.profit ?? 0;
  return sum;
}

/** 주가 배수: 자산 가치에 견준 한 해 이익(자기자본 이익률)이 클수록 높다 (0.6~2) */
export function valuationMult(state: ValueState, ci: number): number {
  const roe = yearProfit(state, ci) / Math.max(50, baseValue(state, ci));
  return Math.max(0.6, Math.min(2, 0.9 + 3 * roe));
}

/** 시가 총액 (억): 자산 가치 × 주가 배수. 운항을 멈춘 회사는 0 */
export function marketCap(state: ValueState, ci: number): number {
  const c = state.companies[ci];
  if (!c || c.out) return 0;
  return Math.max(50, baseValue(state, ci)) * valuationMult(state, ci);
}

/** 이 회사가 가진 다른 회사 주식의 시가 합 */
export function stakesValue(state: ValueState, ci: number): number {
  const st = state.stakes;
  if (!st) return 0;
  let v = 0;
  for (let i = 0; i < st.length; i++) if (i !== ci && (st[i]?.[ci] ?? 0) > 0) v += (st[i][ci] / 100) * marketCap(state, i);
  return v;
}

/** 자기 자산 가치 = 현금 + 내 비행기·주문한 비행기·리스 보증금·부대사업·사 둔 연료·탱크·시설 가치 − 빚 */
export function baseValue(state: Pick<AirlineState, 'q' | 't' | 'companies'>, ci: number): number {
  const c = state.companies[ci];
  if (c.out) return 0;
  let v = c.cash - c.debt;
  for (const p of c.planes) v += planeValue(state, p) + p.deposit;
  for (const o of c.orders) v += o.price;
  for (const b of c.businesses) v += businessValue(b);
  if (c.fuel) v += tankWorth(c);
  if (c.facilities) v += facilitiesWorth(c);
  return v;
}

/** 은행이 빌려 줄 수 있는 최대 빚 */
export function creditLimit(state: Pick<AirlineState, 'q' | 't' | 'companies'>, ci: number): number {
  const c = state.companies[ci];
  let assets = 0;
  for (const p of c.planes) assets += planeValue(state, p);
  for (const o of c.orders) assets += o.price;
  for (const b of c.businesses) assets += businessValue(b);
  return Math.max(0, Math.round(c.baseCredit + assets * 0.5));
}

/** 지점을 여는 값 (억) */
export function branchCost(city: string, q: number): number {
  return Math.round(15 + 7 * citySize(CITY[city], yearOf(q)));
}

/** 지점 유지비 (억/달) */
export function branchUpkeep(city: string, q: number): number {
  return (1.5 + 0.9 * citySize(CITY[city], yearOf(q))) / 3;
}

export function businessCost(city: string, kind: Business['kind'], q: number): number {
  const c = CITY[city];
  return Math.round(BUSINESS_INFO[kind].cost(c, citySize(c, yearOf(q))));
}

// ------------------------------------------------------------------ 비행기 시간과 슬롯

/** 노선 목록 → id로 찾기 (목록이 바뀌면 다시 만든다: 같은 배열에 push하면 길이로 알아챈다) */
const routeById = new WeakMap<readonly Route[], { len: number; map: Map<number, Route> }>();

export function routeOf(c: Company, routeId: number): Route | undefined {
  let hit = routeById.get(c.routes);
  if (!hit || hit.len !== c.routes.length) {
    hit = { len: c.routes.length, map: new Map(c.routes.map((r) => [r.id, r])) };
    routeById.set(c.routes, hit);
  }
  return hit.map.get(routeId);
}

/** 이 비행기가 이 노선을 한 주에 몇 번 왕복하는지 */
export function legFreq(p: Plane, routeId: number): number {
  return p.legs.find((l) => l.route === routeId)?.freq ?? 0;
}

export function isIdle(p: Plane): boolean {
  return !p.legs.some((l) => l.freq > 0);
}

/** 비행기가 한 주에 쓰는 비행시간 (exceptRoute는 빼고 센다) */
export function planeHours(c: Company, p: Plane, exceptRoute?: number): number {
  const m = MODEL[p.model];
  let h = 0;
  for (const l of p.legs) {
    if (l.route === exceptRoute || l.freq <= 0) continue;
    const r = routeOf(c, l.route);
    if (r) h += 2 * legHours(m, dist(r.a, r.b)) * l.freq;
  }
  return h * turnMult(c);
}

/** 비행시간으로 따진 이 비행기의 이 노선 최대 왕복 수 */
export function maxFreqFor(c: Company, p: Plane, routeId: number): number {
  const r = routeOf(c, routeId);
  if (!r) return 0;
  const m = MODEL[p.model];
  const left = WEEK_HOURS - planeHours(c, p, routeId);
  return Math.max(0, Math.min(MAX_FREQ, Math.floor(left / (2 * legHours(m, dist(r.a, r.b)) * turnMult(c)) + 1e-9)));
}

/** 비행시간 사용률 0~1 */
export function utilization(c: Company, p: Plane): number {
  return Math.min(1, planeHours(c, p) / WEEK_HOURS);
}

/** 이 노선의 주간 왕복 수 합 */
export function routeFreq(c: Company, routeId: number): number {
  let f = 0;
  for (const p of c.planes) f += legFreq(p, routeId);
  return f;
}

/** 이 노선을 나는 비행기들 */
export function planesOnRoute(c: Company, routeId: number): Plane[] {
  return c.planes.filter((p) => legFreq(p, routeId) > 0);
}

/** 이 회사가 이 공항에서 한 주에 쓸 수 있는 운항 횟수 */
export function slotCapacity(state: Pick<AirlineState, 'q' | 't' | 'slotBoost' | 'companies'>, ci: number, city: string): number {
  const c = state.companies[ci];
  const cls = airportClass(CITY[city], yearOf(state.q));
  const hub = c.hub === city ? 2 : 1;
  const bought = modMult(c, 'slot', state.t, (m) => m.city === city);
  return Math.round(AIRPORT_INFO[cls].slots * hub * (1 + (state.slotBoost[city] ?? 0)) * bought * terminalSlots(c, city));
}

/** 이 회사가 이 공항에서 지금 쓰는 주간 운항 횟수 (except: 이 비행기의 이 노선 몫은 빼고) */
export function slotsUsed(company: Company, city: string, except?: { plane: number; route: number }): number {
  let used = 0;
  for (const p of company.planes) {
    for (const l of p.legs) {
      if (except && p.id === except.plane && l.route === except.route) continue;
      const r = routeOf(company, l.route);
      if (r && (r.a === city || r.b === city)) used += l.freq;
    }
  }
  return used;
}

/** 운항하는 노선이 닿은 지역들 */
export function regionsServed(company: Company): Set<RegionId> {
  const out = new Set<RegionId>();
  for (const r of company.routes) {
    if (routeFreq(company, r.id) <= 0) continue;
    out.add(CITY[r.a].region);
    out.add(CITY[r.b].region);
  }
  return out;
}

/** 계열마다 비행기 수 */
const familyCache = new WeakMap<readonly Plane[], { n: number; m: Map<string, number> }>();

export function familyCounts(c: Company): Map<string, number> {
  const hit = familyCache.get(c.planes);
  if (hit && hit.n === c.planes.length) return hit.m;
  const m = new Map<string, number>();
  for (const p of c.planes) {
    const f = MODEL[p.model].family;
    m.set(f, (m.get(f) ?? 0) + 1);
  }
  familyCache.set(c.planes, { n: c.planes.length, m });
  return m;
}

/** 달마다 비행기 한 대가 무조건 내는 돈 (리스료 + 보험) */
export function planeFixed(p: Plane): number {
  return p.rent + MODEL[p.model].price * INSURANCE;
}

// ------------------------------------------------------------------ 수요

/** 거리에 따른 손님 배수: 아주 가까우면 기차·차를 타고, 아주 멀면 덜 간다 */
export function distanceFactor(d: number): number {
  const short = Math.min(1, Math.max(0.15, (d - 150) / 750));
  const long = Math.min(1, (2500 / (d + 1500)) ** 0.6);
  return short * long;
}

const DEMAND_K = 32;
const BIZ_K = 1;
const LEISURE_K = 0.25;

export interface PairDemand {
  /** 한 방향 주간 사업 손님 (운임 조정 0%, 다른 탈것 포함한 전체 잠재 수요) */
  biz: number;
  leisure: number;
}

/** 같은 달·같은 사건 목록이면 다시 셈하지 않는다 (컴퓨터가 후보를 많이 볼 때 빠르게) */
const demandCache = new WeakMap<readonly unknown[], Map<number, PairDemand>>();

/** 두 도시 사이 한 방향 주간 잠재 손님 (t: 그 달) */
export function pairDemand(state: Pick<AirlineState, 't' | 'effects'>, a: string, b: string, t = state.t): PairDemand {
  let cache = demandCache.get(state.effects);
  if (!cache) {
    cache = new Map();
    demandCache.set(state.effects, cache);
  }
  const key = t * 4096 + pairIndex(a, b);
  const hit = cache.get(key);
  if (hit) return hit;
  const d = computeDemand(state, a, b, t);
  cache.set(key, d);
  return d;
}

/** 이 달 손님이 한 해 평균보다 얼마나 많은지 (두 도시 사이, 1이 평균) */
export function monthDemandMult(a: string, b: string, month0: number): number {
  const A = CITY[a];
  const B = CITY[b];
  const leisure = (A.fun * leisureMonthMult(b, month0) + B.fun * leisureMonthMult(a, month0)) / Math.max(1, A.fun + B.fun);
  const biz = Math.sqrt(bizMonthMult(a, month0) * bizMonthMult(b, month0));
  const w = (A.biz + B.biz) / 2;
  return biz * w + leisure * (1 - w);
}

function computeDemand(state: Pick<AirlineState, 't' | 'effects'>, a: string, b: string, t: number): PairDemand {
  const A = CITY[a];
  const B = CITY[b];
  const q = Math.floor(t / 3);
  const year = yearOf(q);
  const m0 = monthOf(t) - 1;
  const sA = citySize(A, year);
  const sB = citySize(B, year);
  const eA = effectMults(state.effects, a);
  const eB = effectMults(state.effects, b);
  const base =
    DEMAND_K * travelFactor(q) * distanceFactor(dist(a, b)) * (A.region === B.region ? 1.35 : 1) * fixedEventMult(a, t) * fixedEventMult(b, t) * worldMult(state.effects);
  const biz = BIZ_K * (sA * sB) ** 0.95 * Math.sqrt(A.biz * B.biz) * eA.biz * eB.biz * Math.sqrt(bizMonthMult(a, m0) * bizMonthMult(b, m0));
  const leisure = LEISURE_K * (sA ** 1.3 * B.fun * leisureMonthMult(b, m0) * eB.leisure + sB ** 1.3 * A.fun * leisureMonthMult(a, m0) * eA.leisure);
  return { biz: base * biz, leisure: base * leisure };
}

// ------------------------------------------------------------------ 시장 나누기

interface OfferPlane {
  model: ModelDef;
  freq: number;
  age: number;
  /** 좌석 배치·기내식 요약 (없으면 표준 배치·기내식 3단계) */
  cab?: CabinStats;
}

/** 비행기 한 대의 좌석 요약 */
export function planeCabin(p: Plane): CabinStats {
  return cabinStats(MODEL[p.model], p.cabin, p.meal);
}

const stdCabin = (m: ModelDef, meal = 3) => cabinStats(m, defaultCabin(m), meal);

/** 한 회사가 두 도시 사이에 내놓은 운항 */
export interface Offer {
  company: number;
  fare: number;
  /** 지난달 정시 운항률 (손님이 믿는 정도). 없으면 보통(0.85) */
  rel?: number;
  /** 시간대가 손님에게 맞는 정도 (사업·관광). 없으면 1 */
  fit?: { biz: number; leisure: number };
  planes: OfferPlane[];
  /** 비즈니스석·일등석·화물 운임 조정 (%). 없으면 0 */
  fareC?: number;
  fareF?: number;
  fareK?: number;
}

export interface OfferResult {
  company: number;
  /** 한 방향 주간 손님 */
  biz: number;
  leisure: number;
  /** 한 방향 주간 좌석 */
  seats: number;
  /** 같은 두 도시의 회사들 가운데 손님 비율 */
  share: number;
  /** 주간 운임 수입 (양방향, 억) */
  revenue: number;
  /** 평균 한 번 나는 시간 (갈아타기 계산용) */
  hours: number;
  /** 고급 좌석(일등·비즈니스) 주간 좌석과 손님 (한 방향) */
  premSeats: number;
  premPax: number;
  /** 등급마다 손님·좌석 (한 방향 주간)과 주간 수입 (양방향, 억) */
  cls: ClassSplit;
  /** 화물: 한 방향 주간 톤·실을 수 있는 톤, 주간 수입 (양방향, 억). revenue에 들어 있다 */
  cargoT: number;
  cargoCap: number;
  cargoRev: number;
  /** 저가항공 부가 수입 (주간, 억). revenue에 들어 있다 */
  ancillary: number;
}

const A0_BIZ = 1.2;
const A0_LEISURE = 1.5;

/** 평판·광고로 정해지는 회사의 기본 매력 (광고 매체마다 사업·관광 손님에게 닿는 정도가 다르다) */
function quality(c: Company, a: string, b: string): { biz: number; leisure: number } {
  const rep = 0.8 + (0.4 * c.reputation) / 100;
  const ra = CITY[a].region;
  const rb = CITY[b].region;
  const ma = MEDIA_INFO[mediaOf(c, ra)];
  const mb = MEDIA_INFO[mediaOf(c, rb)];
  const biz = 1 + (0.3 * (c.awareness[ra] * ma.biz + c.awareness[rb] * mb.biz)) / 2;
  const leisure = 1 + (0.3 * (c.awareness[ra] * ma.leisure + c.awareness[rb] * mb.leisure)) / 2;
  return { biz: rep * biz, leisure: rep * leisure };
}

/** 동맹 효과: 동맹 회사도 지점이 있는 도시를 오가면 손님이 조금 더, 동맹 마일리지는 회사 수만큼 */
function allianceBonus(state: AirlineState, ci: number, a: string, b: string): number {
  const allies = alliesOf(state, ci);
  if (allies.length === 0) return 1;
  const c = state.companies[ci];
  const joint = (x: string) => c.branches.includes(x) && allies.some((i) => state.companies[i].branches.includes(x));
  return (joint(a) || joint(b) ? JOINT_BONUS : 1) * (1 + MILES_PER_MEMBER * allies.length);
}

/** 이 도시의 라운지 효과: 내 라운지는 다, 동맹 회사의 라운지는 반쯤 */
function sharedLounge(state: AirlineState, ci: number, city: string): number {
  const own = loungeBiz(state.companies[ci], city);
  if (own > 1) return own;
  const ally = alliesOf(state, ci).some((i) => hasFacility(state.companies[i], city, 'lounge'));
  return ally ? 1 + (LOUNGE_BIZ - 1) / 2 : 1;
}

interface Attraction {
  biz: number;
  leisure: number;
  seats: number;
  /** 고급 좌석 · 일반석 (한 방향 주간). 초음속기 좌석은 prem에 들고 fixed에도 따로 센다 */
  prem: number;
  econ: number;
  first: number;
  fixed: number;
  /** 사업 손님이 고급 좌석에 앉을 때 운임 배수 */
  premYield: number;
  hours: number;
  premium: number;
}

/** 회사의 매력 (사업·관광) */
function attraction(state: AirlineState, a: string, b: string, offer: Offer, bestHours: number): Attraction {
  const c = state.companies[offer.company];
  const d = dist(a, b);
  let freq = 0;
  let seats = 0;
  let prem = 0;
  let econ = 0;
  let premAttr = 0;
  let firstSeats = 0;
  let fixedSeats = 0;
  let yieldSum = 0;
  let comfortSum = 0;
  let hoursSum = 0;
  let premiumSum = 0;
  for (const p of offer.planes) {
    if (p.freq <= 0) continue;
    const cab = p.cab ?? stdCabin(p.model);
    // 화물기는 손님을 태우지 않는다 (화물은 cargo.ts)
    if (cab.seats <= 0) continue;
    const cap = cab.seats * p.freq;
    freq += p.freq;
    if (cab.fixed) fixedSeats += cap;
    seats += cap;
    prem += cab.prem * p.freq;
    econ += cab.econ * p.freq;
    firstSeats += cab.first * p.freq;
    // 초음속기는 한 등급뿐이라 고급 좌석 비율을 표준으로 본다
    premAttr += cab.fixed ? cap * 0.1 : (cab.prem - cab.first + 1.5 * cab.first) * p.freq;
    yieldSum += premYield(cab, d, BIZ_PREMIUM) * cab.prem * p.freq;
    const comfort = (0.775 + 0.075 * p.model.comfort - Math.min(0.15, 0.008 * p.age)) * PITCH_COMFORT[cab.pitch] * mealComfort(cab.meal);
    comfortSum += comfort * cap;
    hoursSum += legHours(p.model, d) * cap;
    premiumSum += (p.model.body === 'sst' ? SST_PREMIUM : 1) * cap;
  }
  if (freq === 0) return { biz: 0, leisure: 0, seats: 0, prem: 0, econ: 0, first: 0, fixed: 0, premYield: 0, hours: 0, premium: 1 };
  // 좌석 간격·기내식은 비행기마다(comfortSum), 조직 만족도가 낮으면 서비스가 덜 친절하다
  const comfort = (comfortSum / seats) * (0.96 + 0.08 * ((c.morale ?? 65) / 100));
  const hours = hoursSum / seats;
  const premium = premiumSum / seats;
  const speed = bestHours > 0 ? bestHours / hours : 1;
  const hub = c.hub === a || c.hub === b ? 1.08 : 1;
  let leisureBonus = 1;
  // 라운지가 있는 도시를 오가면 사업 손님이 우리를 더 고른다 (동맹 회사의 라운지도 반쯤)
  let bizBonus = sharedLounge(state, offer.company, a) * sharedLounge(state, offer.company, b);
  for (const biz of c.businesses) {
    if (biz.city !== a && biz.city !== b) continue;
    leisureBonus *= BUSINESS_INFO[biz.kind].leisure;
    bizBonus *= BUSINESS_INFO[biz.kind].biz;
  }
  const cabinBiz = premiumAttraction(premAttr / seats, d, firstSeats > 0);
  const p = (1 + offer.fare / 100) * premium;
  // 단골 회원·브랜드 힘은 회사 매력에 곱한다 (저장된 값만 읽는다: loyalty.ts)
  const qual = loyaltyQuality(quality(c, a, b), c, a, b, offer.fare);
  const common = hub * allianceBonus(state, offer.company, a, b);
  // 지연·결항이 잦으면 손님(특히 사업 손님)이 덜 고른다
  const rel = Math.max(0.8, Math.min(1.06, 1 + 0.8 * ((offer.rel ?? 0.85) - 0.85)));
  return {
    biz: freq ** 0.6 * p ** -0.8 * common * qual.biz * comfort ** 1.5 * speed * bizBonus * cabinBiz * rel ** 1.5 * (offer.fit?.biz ?? 1) * demandMult(c, a, b, state.t, 'biz') * bizChoiceMult(c),
    leisure: freq ** 0.5 * p ** -1.8 * common * qual.leisure * comfort ** 0.5 * speed ** 0.3 * leisureBonus * rel * (offer.fit?.leisure ?? 1) * demandMult(c, a, b, state.t, 'leisure'),
    seats,
    prem,
    econ,
    first: firstSeats,
    fixed: fixedSeats,
    premYield: prem > 0 ? yieldSum / prem : 0,
    hours,
    premium,
  };
}

export interface SplitResult {
  results: OfferResult[];
  /** 곧장 가는 회사를 고르지 않은 손님 비율 (갈아타기 손님이 노릴 몫) */
  unserved: { biz: number; leisure: number };
}

/**
 * 두 도시 사이 손님을 회사들이 나눈다.
 * 회사마다 끌어온 손님을 등급(일등석·비즈니스석·일반석)으로 나누고, 등급 운임이 비싸거나 자리가 모자라면
 * 아래 등급으로 내려가거나 다른 회사로 간다 (classes.ts). 일반석이 차면 남은 고급 좌석에 일반석 값으로 앉는다.
 * 좌석이 모자라 못 탄 손님 절반은 자리가 남은 다른 회사로 간다. 화물(배 아래 짐칸·화물기)도 함께 나눈다 (cargo.ts).
 */
export function splitMarketFull(state: AirlineState, a: string, b: string, offers: Offer[], demand0 = pairDemand(state, a, b)): SplitResult {
  const d = dist(a, b);
  const year = yearOf(state.q);
  // 저가항공이 날면 싼 표를 찾는 관광 손님이 새로 생긴다 (1978년 규제가 풀린 뒤로 점점)
  const lccHere = offers.some((o) => bizModelOf(state.companies[o.company]) === 'lcc' && o.planes.some((p) => p.freq > 0 && !isFreighter(p.model)));
  const demand = lccHere ? { biz: demand0.biz, leisure: demand0.leisure * leisureStimulus(year) } : demand0;
  let bestHours = Infinity;
  for (const o of offers) for (const p of o.planes) if (p.freq > 0 && !isFreighter(p.model)) bestHours = Math.min(bestHours, legHours(p.model, d));
  if (!Number.isFinite(bestHours)) bestHours = 0;
  const attrs = offers.map((o) => attraction(state, a, b, o, bestHours));
  const sumB = attrs.reduce((s, x) => s + x.biz, 0);
  const sumL = attrs.reduce((s, x) => s + x.leisure, 0);
  const wantB = attrs.map((x) => (demand.biz * x.biz) / (sumB + A0_BIZ));
  const wantL = attrs.map((x) => (demand.leisure * x.leisure) / (sumL + A0_LEISURE));
  // 등급마다 나누기: 고급 좌석 손님은 등급 운임에 따라, 자리가 모자라면 아래 등급으로 (classes.ts)
  const sh = classShares(year, d);
  const caps: ClassCaps[] = attrs.map((x) => ({ first: x.first, business: Math.max(0, x.prem - x.first - x.fixed), econ: x.econ + x.fixed }));
  const cls = offers.map((o, i) => allocateClasses(caps[i], wantB[i], wantL[i], sh, o.fareF ?? 0, o.fareC ?? 0));
  const gotB = cls.map((x) => x.b);
  const gotL = cls.map((x) => x.l);
  // 못 탄 손님의 절반은 자리가 남은 다른 회사로 (일반석 값으로 남은 자리에)
  const spillB = wantB.reduce((s, w, i) => s + Math.max(0, w - gotB[i]), 0) * 0.5;
  const spillL = wantL.reduce((s, w, i) => s + Math.max(0, w - gotL[i]), 0) * 0.5;
  if (spillB > 0.01 || spillL > 0.01) {
    const free = attrs.map((x, i) => x.seats - gotB[i] - gotL[i]);
    const wB = attrs.map((x, i) => (free[i] > 0.5 ? x.biz : 0));
    const wL = attrs.map((x, i) => (free[i] > 0.5 ? x.leisure : 0));
    const sB = wB.reduce((s, x) => s + x, 0);
    const sL = wL.reduce((s, x) => s + x, 0);
    for (let i = 0; i < attrs.length; i++) {
      if (free[i] <= 0.5) continue;
      const addB = sB > 0 ? Math.min(free[i], (spillB * wB[i]) / sB) : 0;
      const addL = sL > 0 ? Math.min(free[i] - addB, (spillL * wL[i]) / sL) : 0;
      seatSpill(cls[i], caps[i], addB, addL);
      gotB[i] += addB;
      gotL[i] += addL;
    }
  }
  const total = gotB.reduce((s, x) => s + x, 0) + gotL.reduce((s, x) => s + x, 0);
  const fare = baseFare(d, state.q);
  // 유가가 보통보다 높으면 손님 한 명마다 거리만큼 유류할증이 똑같이 붙는다 (등급·운임 조정과 상관없이, fuel.ts)
  const surcharge = fuelSurcharge(state, d);
  const extra = (pax: number) => (pax * surcharge * 2) / 10000;
  // 화물: 배 아래 짐칸(저가항공 빼고)과 화물기
  const cargoOffers = offers.map((o) => cargoOfferOf(o.planes, bizModelOf(state.companies[o.company]), o.fareK ?? 0));
  const cargoGot = cargoOffers.some((x) => x.cap > 0) ? splitCargo(cargoDemand(state, a, b) * oilCargoMult(state.oil ?? 1), cargoOffers) : null;
  const rate = cargoGot ? marketFare(state, Math.max(CARGO_MIN_D, d)) * RATE_K : 0;
  const money = (units: number) => (units * fare * 2) / 10000;
  const results = offers.map((o, i) => {
    const x = attrs[i];
    const k = cls[i];
    const u = classUnits(k, d, o.fareF ?? 0, o.fareC ?? 0, (1 + o.fare / 100) * x.premium);
    const rev = { f: money(u.f) + extra(k.f), c: money(u.c) + extra(k.c), y: money(u.y) + extra(k.yB + k.yL) };
    const cargoT = cargoGot ? cargoGot[i] : 0;
    const cargoRev = cargoT > 0 ? (cargoT * rate * (1 + (o.fareK ?? 0) / 100) * 2) / 10000 : 0;
    // 저가항공 부가 수입: 짐·좌석 지정·기내 판매 (요즘일수록 많다)
    const ancillary = bizModelOf(state.companies[o.company]) === 'lcc' ? money((k.yB + k.yL) * ancillaryRate(year)) : 0;
    return {
      company: o.company,
      biz: gotB[i],
      leisure: gotL[i],
      seats: x.seats,
      share: total > 0 ? (gotB[i] + gotL[i]) / total : 0,
      revenue: rev.f + rev.c + rev.y + cargoRev + ancillary,
      hours: x.hours,
      premSeats: caps[i].first + caps[i].business,
      premPax: k.f + k.c + k.upF + k.upC,
      cls: classSplit(k, caps[i], rev),
      cargoT,
      cargoCap: cargoOffers[i].cap,
      cargoRev,
      ancillary,
    };
  });
  return { results, unserved: { biz: A0_BIZ / (sumB + A0_BIZ), leisure: A0_LEISURE / (sumL + A0_LEISURE) } };
}

export function splitMarket(state: AirlineState, a: string, b: string, offers: Offer[], demand = pairDemand(state, a, b)): OfferResult[] {
  return splitMarketFull(state, a, b, offers, demand).results;
}

// ------------------------------------------------------------------ 비용

export interface RouteCost {
  fuel: number;
  crew: number;
  /** 착륙료 + 지상 조업비 */
  airport: number;
  service: number;
  /** 표 판매 수수료 */
  sales: number;
  /** 리스료·보험 (여러 노선을 나는 비행기는 비행시간만큼 나누어) */
  lease: number;
  total: number;
}

export interface CostPlane {
  model: ModelDef;
  freq: number;
  age: number;
  /** 이 노선 몫의 리스료·보험 (분기) */
  fixed: number;
  /** 좌석 배치·기내식 (없으면 표준 배치·회사 기내식 기본값) */
  cab?: CabinStats;
}

/** 회사마다 다른 비용 배수 */
export interface CostCtx {
  oil: number;
  fuelMult: number;
  serviceMult: number;
  salesMult: number;
  crewMult: number;
  families: Map<string, number>;
}

/** 정비 수준(1~5)마다 승무원·정비비 배수 */
export const MAINT_COST = [0, 0.86, 0.93, 1, 1.09, 1.2];
/** 정비 수준마다 지연·결항·기체 점검이 생기는 배수 */
export const MAINT_RISK = [0, 1.7, 1.3, 1, 0.82, 0.68];
export const MAINT_NAMES = ['', '아끼기', '조금 아끼기', '보통', '꼼꼼히', '아주 꼼꼼히'];
/** 예비 승무원(0~2)마다 승무원비 배수와 지연·결항 배수 */
export const RESERVE_COST = [1, 1.04, 1.08];
export const RESERVE_RISK = [1.15, 1, 0.88];
export const RESERVE_NAMES = ['없음', '조금', '넉넉히'];

export function costCtx(state: Pick<AirlineState, 't' | 'oil'>, c: Company): CostCtx {
  // 저가항공은 승무원·서비스·표 판매 비용이 싸다 (bizmodel.ts)
  const lcc = bizCostMults(c, Math.floor(state.t / 12));
  return {
    oil: hedgedOil(c, state.t, state.oil),
    fuelMult: modMult(c, 'fuel', state.t),
    serviceMult: modMult(c, 'service', state.t) * lcc.service,
    salesMult: modMult(c, 'sales', state.t) * lcc.sales,
    crewMult: modMult(c, 'crew', state.t) * (MAINT_COST[c.maint] ?? 1) * (RESERVE_COST[c.crewReserve] ?? 1) * lcc.crew,
    families: familyCounts(c),
  };
}

/** 노선 하나의 달 비용 (억). paxWeek: 한 방향 주간 손님, revenue: 달 운임 수입 */
export function routeCost(
  state: Pick<AirlineState, 'q' | 't' | 'oil' | 'companies'>,
  ci: number,
  a: string,
  b: string,
  planes: readonly CostPlane[],
  paxWeek: number,
  revenue: number,
  ctx: CostCtx = costCtx(state, state.companies[ci]),
): RouteCost {
  const d = dist(a, b);
  const c = state.companies[ci];
  const feeA = FEE_INFO[CITY[a].fee].perLanding;
  const feeB = FEE_INFO[CITY[b].fee].perLanding;
  let fuel = 0;
  let crew = 0;
  let airport = 0;
  let lease = 0;
  // 기내식·서비스비: 비행기마다 기내식 단계와 고급 좌석 비율이 다르다 (좌석 비율로 손님을 나눈다)
  let svcSeats = 0;
  let svcWeighted = 0;
  for (const p of planes) {
    lease += p.fixed;
    if (p.freq <= 0) continue;
    const cab = p.cab ?? stdCabin(p.model, c.service);
    const cap = cab.seats * p.freq;
    svcSeats += cap;
    svcWeighted += cap * MEAL_COST[cab.meal] * premiumCostMult(cab.fixed ? 0.1 : cab.prem / Math.max(1, cab.seats));
    const trips = p.freq * WEEKS;
    fuel += trips * 2 * d * p.model.burn * (1 + 0.006 * p.age) * FUEL_PRICE * ctx.oil * ctx.fuelMult;
    const common = commonalityMult(ctx.families.get(p.model.family) ?? 1);
    crew += trips * 2 * (legHours(p.model, d) * CREW_MULT + CYCLE_HOURS) * p.model.hourCost * (1 + 0.025 * p.age) * common * ctx.crewMult * (1 - STAFF_SHARE);
    airport += trips * (feeA + feeB) * (sizeSeats(p.model) / 150) ** 0.7;
  }
  const paxQ = paxWeek * 2 * WEEKS;
  airport += paxQ * HANDLING;
  const service = paxQ * (0.3 + 0.00025 * d) * (svcSeats > 0 ? svcWeighted / svcSeats : MEAL_COST[c.service]) * ctx.serviceMult;
  // 만 원 → 억 원
  fuel /= 10000;
  crew /= 10000;
  airport /= 10000;
  const serviceE = service / 10000;
  const sales = revenue * SALES_RATE * ctx.salesMult;
  return { fuel, crew, airport, service: serviceE, sales, lease, total: fuel + crew + airport + serviceE + sales + lease };
}

// ------------------------------------------------------------------ 노선 어림하기 (컴퓨터·화면)

export interface DraftPlane {
  model: string;
  freq: number;
  age?: number;
  /** 좌석 배치·기내식 (없으면 표준 배치·회사 기내식 기본값) */
  cabin?: Cabin;
  meal?: number;
  /** 이 노선 몫의 리스료·보험 (분기). 없으면 새 리스기 한 대를 통째로 쓴다고 보고 셈한다 */
  fixed?: number;
}

export interface RouteEstimate {
  /** 한 방향 주간 손님 (갈아타는 손님 포함) */
  paxWeek: number;
  /** 그 가운데 갈아타는 손님 */
  xferWeek: number;
  seatsWeek: number;
  lf: number;
  /** 한 방향 주간 잠재 손님 (모든 회사·다른 탈것 포함) */
  demandWeek: number;
  share: number;
  /** 분기 값 (억) */
  revenue: number;
  cost: RouteCost;
  profit: number;
  /** 같은 두 도시를 나는 다른 회사 수 */
  rivals: number;
  /** 등급마다 손님·좌석 (한 방향 주간)과 달 수입 */
  cls: ClassSplit;
  /** 화물: 한 방향 주간 톤·실을 수 있는 톤, 달 수입 (revenue에 들어 있다) */
  cargoT: number;
  cargoCap: number;
  cargoRev: number;
  /** 달 부가 수입 (revenue에 들어 있다) */
  ancillary: number;
}

/** 운임 조정 묶음: 일반석 y·비즈니스석 c·일등석 f·화물 k */
export interface Fares {
  y: number;
  c: number;
  f: number;
  k: number;
}

export function routeFares(r: Pick<Route, 'fare' | 'fareC' | 'fareF' | 'fareK'>): Fares {
  return { y: r.fare, c: r.fareC ?? 0, f: r.fareF ?? 0, k: r.fareK ?? 0 };
}

/** 노선의 운항 (lost: 결항·기체 점검으로 못 뜬 비율) */
function offerFromRoute(state: Pick<AirlineState, 't' | 'companies'>, ci: number, route: Route, lost = 0): Offer {
  const c = state.companies[ci];
  const planes: OfferPlane[] = [];
  for (const p of c.planes) {
    const f = legFreq(p, route.id);
    if (f > 0) planes.push({ model: MODEL[p.model], freq: f * (1 - lost), age: planeAge(state, p), cab: planeCabin(p) });
  }
  const d = dist(route.a, route.b);
  return {
    company: ci,
    fare: route.fare,
    fareC: route.fareC ?? 0,
    fareF: route.fareF ?? 0,
    fareK: route.fareK ?? 0,
    planes,
    rel: route.stats?.onTime,
    fit: route.times ? timeFit(legalTimes(route, yearOf(Math.floor(state.t / 3))), d) : undefined,
  };
}

/** 회사마다 두 도시 → 노선 (회사 객체가 바뀌지 않으면 다시 만들지 않는다) */
const routeIndexCache = new WeakMap<Company, Map<string, Route>>();

export function routeIndex(c: Company): Map<string, Route> {
  let idx = routeIndexCache.get(c);
  if (!idx) {
    idx = new Map(c.routes.map((r) => [pairKey(r.a, r.b), r]));
    routeIndexCache.set(c, idx);
  }
  return idx;
}

/** 다른 회사들이 이 두 도시 사이에 내놓은 운항 */
export function rivalOffers(state: AirlineState, ci: number, a: string, b: string): Offer[] {
  const key = pairKey(a, b);
  const out: Offer[] = [];
  state.companies.forEach((c, i) => {
    if (i === ci || c.out) return;
    const r = routeIndex(c).get(key);
    if (!r) return;
    const o = offerFromRoute(state, i, r);
    if (o.planes.length > 0) out.push(o);
  });
  return out;
}

/** 새로 리스할 비행기 한 대의 달 고정비 */
export function newLeaseFixed(state: Pick<AirlineState, 'effects'>, model: ModelDef): number {
  return leaseRent(state, model) + model.price * INSURANCE;
}

/**
 * 이 회사가 이 두 도시를 이렇게 날면 이번 분기에 어떻게 될지 (다른 회사는 지금 그대로).
 * extra: 지난 분기처럼 이 노선에 탈 갈아타는 손님 (주간 한 방향, 주간 수입)
 */
export function estimateRoute(
  state: AirlineState,
  ci: number,
  a: string,
  b: string,
  planes: readonly DraftPlane[],
  fare: number,
  extra?: { xfer?: number; xferRev?: number; rel?: number; times?: readonly number[]; fares?: Partial<Fares> },
): RouteEstimate {
  const offers = rivalOffers(state, ci, a, b);
  const models = planes.map((p) => MODEL[p.model]);
  const times = extra?.times ?? defaultTimes(a, b, yearOf(state.q));
  const co = state.companies[ci];
  const meal = co.service;
  const cabs = planes.map((p, i) => cabinStats(models[i], p.cabin ?? cabinFor(co, models[i]), p.meal ?? meal));
  const mine: Offer = {
    company: ci,
    fare,
    fareC: extra?.fares?.c ?? 0,
    fareF: extra?.fares?.f ?? 0,
    fareK: extra?.fares?.k ?? 0,
    planes: planes.map((p, i) => ({ model: models[i], freq: p.freq, age: p.age ?? 0, cab: cabs[i] })),
    rel: extra?.rel,
    fit: timeFit(times, dist(a, b)),
  };
  const demand = pairDemand(state, a, b);
  const results = splitMarket(state, a, b, [...offers, mine], demand);
  const r = results[results.length - 1];
  const local = r.biz + r.leisure;
  // 저가항공은 갈아타는 손님을 받지 않는다
  const room = bizModelOf(co) === 'lcc' ? 0 : Math.max(0, r.seats - local);
  const xfer = extra?.xfer ? Math.min(room, extra.xfer) : 0;
  const xferRev = extra?.xfer && extra.xfer > 0 ? ((extra.xferRev ?? 0) * xfer) / extra.xfer : 0;
  const paxWeek = local + xfer;
  const revenue = (r.revenue + xferRev) * WEEKS;
  const cost = routeCost(
    state,
    ci,
    a,
    b,
    planes.map((p, i) => ({ model: models[i], freq: p.freq, age: p.age ?? 0, fixed: p.fixed ?? newLeaseFixed(state, models[i]), cab: cabs[i] })),
    paxWeek,
    revenue,
  );
  return {
    paxWeek,
    xferWeek: xfer,
    seatsWeek: r.seats,
    // 화물기만 나는 노선은 화물 탑승률
    lf: r.seats > 0 ? paxWeek / r.seats : r.cargoCap > 0 ? r.cargoT / r.cargoCap : 0,
    demandWeek: demand.biz + demand.leisure,
    share: r.share,
    revenue,
    cost,
    profit: revenue - cost.total,
    rivals: offers.length,
    cls: { pax: r.cls.pax, seats: r.cls.seats, rev: r.cls.rev.map((x) => x * WEEKS) as [number, number, number] },
    cargoT: r.cargoT,
    cargoCap: r.cargoCap,
    cargoRev: r.cargoRev * WEEKS,
    ancillary: r.ancillary * WEEKS,
  };
}

/** 이 노선을 나는 비행기들을 어림용으로 (고정비는 비행시간 비율만큼) */
export function draftsOf(state: Pick<AirlineState, 't'>, c: Company, routeId: number): DraftPlane[] {
  const out: DraftPlane[] = [];
  for (const p of c.planes) {
    const f = legFreq(p, routeId);
    if (f <= 0) continue;
    out.push({ model: p.model, freq: f, age: planeAge(state, p), fixed: fixedShare(c, p, routeId), cabin: p.cabin, meal: p.meal });
  }
  return out;
}

/** 여러 노선을 나는 비행기의 고정비 가운데 이 노선 몫 */
export function fixedShare(c: Company, p: Plane, routeId: number): number {
  const total = planeHours(c, p);
  if (total <= 0) return planeFixed(p);
  const own = total - planeHours(c, p, routeId);
  return (planeFixed(p) * own) / total;
}

/** 지금 노선 그대로의 어림 (지난 분기의 갈아타는 손님도 그대로 탄다고 본다) */
export function estimateExisting(
  state: AirlineState,
  ci: number,
  route: Route,
  override?: { fare?: number; fares?: Partial<Fares>; planes?: DraftPlane[]; times?: readonly number[] },
): RouteEstimate {
  const c = state.companies[ci];
  const planes = override?.planes ?? draftsOf(state, c, route.id);
  const times = override?.times ?? legalTimes(route, yearOf(state.q));
  const fares = { ...routeFares(route), ...override?.fares };
  const extra = route.stats ? { xfer: route.stats.xfer, xferRev: route.stats.xferRev, rel: route.stats.onTime, times, fares } : { times, fares };
  return estimateRoute(state, ci, route.a, route.b, planes, override?.fare ?? route.fare, extra);
}

/** 운임 한 칸의 이번 달 어림 */
export interface FarePoint {
  fare: number;
  profit: number;
  lf: number;
}

/**
 * 운임을 min~max 사이에서 step 칸마다 바꿔 본 이번 달 어림 (비행기·시간표는 지금 그대로, 라이벌도 지금 그대로).
 * best: 가장 남는 운임 (이익이 같으면 ‘보통’에 가까운 쪽).
 */
export function fareOutlook(state: AirlineState, ci: number, route: Route, min: number, max: number, step = 5): { points: FarePoint[]; best: number } {
  const points: FarePoint[] = [];
  for (let fare = min; fare <= max; fare += step) {
    const e = estimateExisting(state, ci, route, { fare });
    points.push({ fare, profit: e.profit, lf: e.lf });
  }
  let best = points[0];
  for (const p of points) {
    const gap = p.profit - best.profit;
    if (gap > 1e-9 || (Math.abs(gap) <= 1e-9 && Math.abs(p.fare) < Math.abs(best.fare))) best = p;
  }
  return { points, best: best?.fare ?? 0 };
}

/**
 * 비행기 한 대의 좌석 배치·기내식을 바꾸면 그 비행기가 나는 노선들의 분기 이익이 어떻게 될지 (지금 → 바꾼 뒤).
 * 기내식 비용·편안함과 고급 좌석 운임이 모두 들어간다 (평판 변화는 빼고).
 */
export function cabinOutlook(state: AirlineState, ci: number, planeId: number, cabin: Cabin, meal: number): { now: number; next: number; seatsNow: number; seatsNext: number } {
  const c = state.companies[ci];
  const p0 = c.planes.find((p) => p.id === planeId);
  if (!p0) return { now: 0, next: 0, seatsNow: 0, seatsNext: 0 };
  const m = MODEL[p0.model];
  let now = 0;
  let next = 0;
  for (const l of p0.legs) {
    const route = c.routes.find((r) => r.id === l.route);
    if (!route) continue;
    const drafts = (change: boolean): DraftPlane[] =>
      c.planes
        .filter((q) => legFreq(q, route.id) > 0)
        .map((q) => ({
          model: q.model,
          freq: legFreq(q, route.id),
          age: planeAge(state, q),
          fixed: fixedShare(c, q, route.id),
          cabin: change && q.id === planeId ? cabin : q.cabin,
          meal: change && q.id === planeId ? meal : q.meal,
        }));
    now += estimateExisting(state, ci, route, { planes: drafts(false) }).profit;
    next += estimateExisting(state, ci, route, { planes: drafts(true) }).profit;
  }
  return { now, next, seatsNow: cabinStats(m, p0.cabin, p0.meal).seats, seatsNext: cabinStats(m, cabin, meal).seats };
}

// ------------------------------------------------------------------ 분기 계산

export interface RouteRun {
  ci: number;
  route: Route;
  seats: number;
  biz: number;
  leisure: number;
  share: number;
  /** 주간 운임 수입 (양방향) */
  revenue: number;
  hours: number;
  freq: number;
  xfer: number;
  xferRev: number;
  /** 고급 좌석 (주간 한 방향) */
  premSeats: number;
  premPax: number;
  cls: ClassSplit;
  cargoT: number;
  cargoCap: number;
  /** 주간 화물·부가 수입 (양방향, 억). revenue에 들어 있다 */
  cargoRev: number;
  ancillary: number;
}

export interface RouteMonthStats {
  lf: number;
  pax: number;
  revenue: number;
  profit: number;
  share: number;
  xfer: number;
  xferRev: number;
  onTime: number;
  cancel: number;
  /** 고급 좌석 탑승률 (고급 좌석이 없으면 없음) */
  premLf?: number;
  /** 등급마다 손님·좌석 (한 방향 주간)과 달 수입 */
  cls?: ClassSplit;
  /** 화물: 한 방향 주간 톤·실을 수 있는 톤, 달 수입 */
  cargo?: { t: number; cap: number; rev: number };
}

export interface QuarterOutcome {
  reports: CompanyReport[];
  routes: RouteReport[];
  /** 회사마다 노선 결과 (노선 id → 결과) */
  routeStats: Map<number, RouteMonthStats>[];
  xfers: TransferReport[];
  /** 운항 현장 사건 (노선마다) */
  ops: OpsIncident[];
  /** 날씨로 공항이 하루 이틀 닫힌 도시 */
  closures: { city: string; days: number; cause: WeatherCause }[];
}

const emptyRegion = (): Record<RegionId, number> => ({ eastasia: 0, seaoc: 0, southmid: 0, europe: 0, africa: 0, americas: 0 });

/** 휴양지: 관광 매력이 크고 사업 손님이 적은 도시 */
export function isResort(city: string): boolean {
  const c = CITY[city];
  return c.fun >= 8 && c.biz <= 0.45;
}

const PACIFIC_WEST: readonly RegionId[] = ['eastasia', 'seaoc'];

function isPacific(a: string, b: string): boolean {
  const ra = CITY[a].region;
  const rb = CITY[b].region;
  return (PACIFIC_WEST.includes(ra) && rb === 'americas') || (PACIFIC_WEST.includes(rb) && ra === 'americas');
}

/** 동맹으로 묶인 회사들 (네트워크 하나) */
export function networks(state: AirlineState): number[][] {
  return allianceGroups(state);
}

interface Conn {
  via: string;
  r1: RouteRun;
  r2: RouteRun;
  detour: number;
}

/**
 * 갈아타는 손님: 곧장 가는 노선이 없는(또는 곧장 가는 회사를 고르지 않은) 손님이
 * 한 네트워크(회사 + 제휴 상대) 안에서 한 번 갈아타고 간다. 좌석은 두 구간 모두 차지한다.
 */
function assignTransfers(state: AirlineState, runs: RouteRun[], unserved: Map<number, { biz: number; leisure: number }>): TransferReport[] {
  const byCompany = new Map<number, RouteRun[]>();
  // 저가항공·화물기만 나는 노선은 갈아타는 손님을 받지 않는다
  for (const r of runs) if (r.freq > 0 && r.seats > 0 && bizModelOf(state.companies[r.ci]) !== 'lcc') byCompany.set(r.ci, [...(byCompany.get(r.ci) ?? []), r]);
  /** 출발지–도착지마다 네트워크별 가장 짧은 연결 */
  const options = new Map<number, Conn[]>();
  for (const group of networks(state)) {
    const edges = new Map<string, RouteRun[]>();
    const direct = new Set<number>();
    for (const ci of group) {
      for (const r of byCompany.get(ci) ?? []) {
        edges.set(r.route.a, [...(edges.get(r.route.a) ?? []), r]);
        edges.set(r.route.b, [...(edges.get(r.route.b) ?? []), r]);
        direct.add(pairIndex(r.route.a, r.route.b));
      }
    }
    const best = new Map<number, Conn>();
    for (const [via, list] of edges) {
      if (list.length < 2) continue;
      for (let i = 0; i < list.length; i++) {
        const A = list[i].route.a === via ? list[i].route.b : list[i].route.a;
        for (let j = i + 1; j < list.length; j++) {
          const B = list[j].route.a === via ? list[j].route.b : list[j].route.a;
          if (A === B) continue;
          const key = pairIndex(A, B);
          if (direct.has(key)) continue;
          const dAB = dist(A, B);
          if (dAB < 400) continue;
          const detour = (dist(A, via) + dist(via, B)) / dAB;
          if (detour > MAX_DETOUR) continue;
          const cur = best.get(key);
          if (!cur || detour < cur.detour) best.set(key, { via, r1: list[i], r2: list[j], detour });
        }
      }
    }
    for (const [key, conn] of best) options.set(key, [...(options.get(key) ?? []), conn]);
  }
  if (options.size === 0) return [];

  // 큰 시장부터 좌석을 차지한다
  const markets = [...options.entries()].map(([key, conns]) => {
    const c0 = conns[0];
    const A = c0.r1.route.a === c0.via ? c0.r1.route.b : c0.r1.route.a;
    const B = c0.r2.route.a === c0.via ? c0.r2.route.b : c0.r2.route.a;
    const d = pairDemand(state, A, B);
    return { key, A, B, conns, d, total: d.biz + d.leisure };
  });
  markets.sort((x, y) => y.total - x.total);
  const out: TransferReport[] = [];
  const used = (r: RouteRun) => r.biz + r.leisure + r.xfer;
  for (const m of markets) {
    const uf = unserved.get(m.key) ?? { biz: 1, leisure: 1 };
    const dAB = dist(m.A, m.B);
    const tDirect = dAB / 850 + LEG_OVERHEAD;
    const attrs = m.conns.map((cn) => {
      const f = Math.min(cn.r1.freq, cn.r2.freq);
      const c1 = state.companies[cn.r1.ci];
      const c2 = state.companies[cn.r2.ci];
      const q1 = quality(c1, cn.r1.route.a, cn.r1.route.b);
      const q2 = quality(c2, cn.r2.route.a, cn.r2.route.b);
      // 갈아타는 공항에 우리 전용 터미널이 있으면 갈아타는 시간이 짧고, 라운지가 있으면 사업 손님이 더 고른다
      const terminal = hasFacility(c1, cn.via, 'terminal') || hasFacility(c2, cn.via, 'terminal');
      const lounge = hasFacility(c1, cn.via, 'lounge') || hasFacility(c2, cn.via, 'lounge') ? LOUNGE_XFER : 1;
      const tf = Math.min(1, tDirect / (cn.r1.hours + cn.r2.hours + (terminal ? TERMINAL_XFER_HOURS : XFER_HOURS)));
      const fare = (1 + (cn.r1.route.fare + cn.r2.route.fare) / 200) * XFER_FARE;
      return {
        biz: f ** 0.6 * ((q1.biz + q2.biz) / 2) * tf ** 2 * fare ** -0.8 * 0.75 * lounge,
        leisure: f ** 0.5 * ((q1.leisure + q2.leisure) / 2) * tf * fare ** -1.8 * 0.85,
        fare,
      };
    });
    const sumB = attrs.reduce((s, x) => s + x.biz, 0);
    const sumL = attrs.reduce((s, x) => s + x.leisure, 0);
    m.conns.forEach((cn, k) => {
      const wantB = (m.d.biz * uf.biz * attrs[k].biz) / (sumB + A0_BIZ);
      const wantL = (m.d.leisure * uf.leisure * attrs[k].leisure) / (sumL + A0_LEISURE);
      const room = Math.min(cn.r1.seats - used(cn.r1), cn.r2.seats - used(cn.r2));
      const got = Math.max(0, Math.min(wantB + wantL, room));
      if (got < 0.5) return;
      const gb = Math.min(wantB, got);
      const gl = got - gb;
      const d1 = dist(cn.r1.route.a, cn.r1.route.b);
      const d2 = dist(cn.r2.route.a, cn.r2.route.b);
      // 유류할증은 실제로 나는 두 구간 거리만큼
      const rev = ((gb * BIZ_PREMIUM + gl) * baseFare(dAB, state.q) * attrs[k].fare * 2 + got * fuelSurcharge(state, d1 + d2) * 2) / 10000;
      cn.r1.xfer += got;
      cn.r2.xfer += got;
      cn.r1.xferRev += (rev * d1) / (d1 + d2);
      cn.r2.xferRev += (rev * d2) / (d1 + d2);
      out.push({ via: cn.via, a: m.A, b: m.B, pax: Math.round(got * 2 * WEEKS), companies: [...new Set([cn.r1.ci, cn.r2.ci])] });
    });
  }
  out.sort((x, y) => y.pax - x.pax);
  return out;
}

// ------------------------------------------------------------------ 운항 현장 (지연·결항·회항·기체 점검)

/** 노선 한 달의 지연·결항이 생기는 정도 (기대값) */
export interface OpsRates {
  /** 늦게 뜨는 비율 */
  late: number;
  /** 결항 비율 (날씨로 공항이 닫히는 것은 빼고) */
  cancel: number;
  /** 다른 공항으로 돌아가는 비율 */
  divert: number;
  /** 큰 원인 */
  cause: string;
  /** 날씨가 원인일 때 그 도시 */
  city?: string;
  /** 날씨 배수 (1 보통) */
  weather: number;
}

/** 비행기 한 대가 한 달에 갑작스러운 고장으로 쉬게 될 확률 (나이·기체 상태·정비 수준) */
export function groundingChance(state: Pick<AirlineState, 't'>, c: Company, p: Plane): number {
  const ageF = 1 + 0.035 * planeAge(state, p);
  return Math.min(0.25, 0.012 * ageF ** 0.8 * condRisk(condOf(p)) * (MAINT_RISK[c.maint] ?? 1) ** 1.5);
}

/**
 * 이번 달 C점검으로 쉬는 비행기: 쉬는 비행기(예비기)가 있으면 대신 날고, 없으면 그 비행기가 나는 노선의 횟수가 준다.
 * lost: 노선마다 못 뜨는 주간 왕복 수, spares: 점검을 메우고 남은 예비기 수. busy: 이번 달 전세기로 나가 예비기가 못 되는 비행기
 */
export function checkDowntime(c: Company, t: number, busy?: ReadonlySet<number>): { lost: Map<number, number>; planes: number; spares: number } {
  const lost = new Map<number, number>();
  let spares = c.planes.filter((p) => p.legs.length === 0 && !inCheck(p, t) && !busy?.has(p.id)).length;
  let planes = 0;
  for (const p of c.planes) {
    if (!inCheck(p, t)) continue;
    planes++;
    if (p.legs.length === 0) continue;
    if (spares > 0) {
      spares--;
      continue;
    }
    for (const l of p.legs) lost.set(l.route, (lost.get(l.route) ?? 0) + l.freq);
  }
  return { lost, planes, spares };
}

/** 예비기로 쓸 수 있는 쉬는 비행기가 얼마나 있는지 (0~1: 한 달 기체 점검·결항을 메울 정도) */
export function spareCover(c: Company): number {
  const flying = c.planes.filter((p) => p.legs.length > 0).length;
  if (flying === 0) return 0;
  const spares = c.planes.length - flying;
  return Math.min(1, spares / Math.max(1, flying * 0.08));
}

/** 이 회사 이 노선의 이 달 운항 위험 (t: 그 달). 날씨·비행기 나이·정비·가동률·공항 혼잡·예비기·예비 승무원 */
export function opsRates(state: Pick<AirlineState, 't' | 'q' | 'slotBoost' | 'companies'>, ci: number, routeId: number, extra = 1): OpsRates {
  const c = state.companies[ci];
  const r = routeOf(c, routeId);
  if (!r) return { late: 0, cancel: 0, divert: 0, cause: 'tech', weather: 1 };
  const m0 = monthOf(state.t) - 1;
  let freq = 0;
  let age = 0;
  let util = 0;
  let condF = 0;
  for (const p of c.planes) {
    const f = legFreq(p, routeId);
    if (f <= 0) continue;
    freq += f;
    age += planeAge(state, p) * f;
    util += (planeHours(c, p) / WEEK_HOURS) * f;
    condF += condRisk(condOf(p)) * f;
  }
  if (freq > 0) {
    age /= freq;
    util /= freq;
    condF /= freq;
  } else condF = 1;
  // 공항 혼잡: 이 노선이 뜨는 시간대마다 (큰 공항은 아침·저녁이 붐빈다)
  const year = yearOf(state.q);
  const mine = bandCounts(legalTimes(r, year), freq);
  const freqOf = (id: number) => routeFreq(c, id);
  // 우리 전용 터미널이 있는 공항은 덜 붐빈다
  const ease = (city: string) => (hasFacility(c, city, 'terminal') ? 0.85 : 1);
  let cong = Math.max((slotsUsed(c, r.a) / Math.max(1, slotCapacity(state, ci, r.a))) * ease(r.a), (slotsUsed(c, r.b) / Math.max(1, slotCapacity(state, ci, r.b))) * ease(r.b)) * 0.8;
  for (const city of [r.a, r.b]) {
    const cap = bandCaps(state, ci, city, slotCapacity(state, ci, city));
    const used = bandUsed(c, city, freqOf);
    for (let i = 0; i < 4; i++) if (mine[i] > 0) cong = Math.max(cong, (used[i] / Math.max(1, cap[i])) * ease(city));
  }
  // 일손: 초과 근무가 많거나 만족도가 낮으면 늦고 결항한다
  const need = staffNeed(state, c);
  const staffF = 1 + overtime(need, c) * 2.5 + (Math.max(0, 45 - (c.morale ?? 65)) / 45) * 0.4;
  const wa = weather(r.a, m0);
  const wb = weather(r.b, m0);
  const w = wa.factor >= wb.factor ? wa : wb;
  const ageF = 1 + 0.035 * age;
  const maintF = MAINT_RISK[c.maint] ?? 1;
  const utilF = 1 + Math.max(0, util - 0.75) * 2.4;
  const congF = 1 + Math.max(0, cong - 0.7) * 1.6;
  const crewF = (RESERVE_RISK[c.crewReserve] ?? 1) * extra * staffF;
  const spareF = 1 - 0.45 * spareCover(c);
  const late = Math.min(0.6, 0.075 * ageF * maintF ** 0.6 * condF ** 0.5 * utilF * congF * crewF * w.factor ** 0.9);
  const cancel = Math.min(0.3, 0.0045 * ageF ** 1.2 * maintF * condF ** 0.8 * utilF * congF ** 0.5 * crewF * spareF * w.factor ** 2.2);
  const divert = Math.min(0.05, 0.0012 * w.factor ** 1.6);
  // 큰 원인 고르기
  const parts: [string, number][] = [
    ['tech', (ageF - 1) * 2 + (maintF - 1) * 2 + (condF - 1) * 2],
    ['crew', (crewF / staffF - 1) * 4 + (utilF - 1) * 2],
    ['staff', (staffF - 1) * 4],
    ['congestion', (congF - 1) * 3],
  ];
  if (w.cause) parts.push([w.cause, (w.factor - 1) * 4]);
  parts.sort((x, y) => y[1] - x[1]);
  const cause = parts[0][1] > 0.05 ? parts[0][0] : 'tech';
  return { late, cancel, divert, cause, city: w.cause && cause === w.cause ? (wa.factor >= wb.factor ? r.a : r.b) : undefined, weather: w.factor };
}

/** 푸아송 표본 (평균이 크면 정규 근사) */
function poisson(mean: number, rng: Rng): number {
  if (mean <= 0) return 0;
  if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * (rng() + rng() + rng() - 1.5) * 2));
  const L = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L && k < 200);
  return k - 1;
}

interface RouteOps {
  flights: number;
  late: number;
  cancelled: number;
  diverted: number;
  grounded: number;
  cause: string;
  city?: string;
  /** 못 뜬 비율 (좌석·손님이 준다) */
  lost: number;
}

/**
 * 이번 달 운항 현장 사건을 뽑는다. rng가 없으면 사건 없이 (어림과 같게) 셈한다.
 */
function rollOps(
  state: AirlineState,
  rng: Rng | undefined,
): { byRoute: Map<number, RouteOps>[]; closures: QuarterOutcome['closures']; strikes: boolean[]; checks: ReturnType<typeof checkDowntime>[] } {
  const byRoute: Map<number, RouteOps>[] = state.companies.map(() => new Map());
  const closures: QuarterOutcome['closures'] = [];
  const strikes = state.companies.map(() => false);
  // C점검은 미리 정해 둔 일이라 어림할 때도 셈한다
  const checks = state.companies.map((c, ci) => checkDowntime(c, state.t, charterBusy(state, ci)));
  if (!rng) return { byRoute, closures, strikes, checks };
  const m0 = monthOf(state.t) - 1;
  // 날씨가 아주 나쁜 도시는 하루 이틀 공항이 닫힌다 (노선이 닿은 도시만)
  const cities = new Set<string>();
  for (const c of state.companies) if (!c.out) for (const r of c.routes) if (routeFreq(c, r.id) > 0) cities.add(r.a).add(r.b);
  const closed = new Map<string, number>();
  for (const city of cities) {
    const w = weather(city, m0);
    if (!w.cause || w.factor < 1.5) continue;
    if (rng() < (w.factor - 1.4) * 0.5) {
      const days = 1 + (rng() < 0.4 ? 1 : 0);
      closed.set(city, days);
      closures.push({ city, days, cause: w.cause });
    }
  }
  state.companies.forEach((c, ci) => {
    if (c.out) return;
    // 파업 (조직 만족도가 아주 낮을 때): 한 주쯤 운항이 크게 준다
    const strike = c.planes.length > 0 && rng() < strikeChance(c);
    strikes[ci] = strike;
    // 갑작스러운 고장: 비행기마다 (C점검을 메우고 남은 예비기가 있으면 그 비행기가 대신 난다)
    let spares = checks[ci].spares;
    const lostWeeks = new Map<number, number>();
    const groundedOn = new Map<number, number>();
    for (const p of c.planes) {
      if (p.legs.length === 0 || inCheck(p, state.t)) continue;
      if (rng() >= groundingChance(state, c, p)) continue;
      if (spares > 0) {
        spares--;
        continue;
      }
      const weeks = 0.5 + rng() * 1.5;
      for (const l of p.legs) {
        lostWeeks.set(l.route, (lostWeeks.get(l.route) ?? 0) + l.freq * weeks);
        groundedOn.set(l.route, (groundedOn.get(l.route) ?? 0) + 1);
      }
    }
    for (const r of c.routes) {
      const freq = routeFreq(c, r.id);
      if (freq <= 0) continue;
      const flights = freq * 2 * WEEKS;
      const rates = opsRates(state, ci, r.id);
      const closedDays = Math.max(closed.get(r.a) ?? 0, closed.get(r.b) ?? 0);
      const groundLost = Math.min(flights, Math.round((lostWeeks.get(r.id) ?? 0) * 2));
      const closeLost = (flights * closedDays) / 30;
      const strikeLost = strike ? flights * 0.25 : 0;
      const cancelled = Math.min(flights, Math.round(poisson(flights * rates.cancel, rng) + groundLost + closeLost + strikeLost));
      const flown = flights - cancelled;
      const late = Math.min(flown, poisson(flown * rates.late, rng));
      const diverted = Math.min(flown - late, poisson(flown * rates.divert, rng));
      let cause = rates.cause;
      let city = rates.city;
      if (closedDays > 0) {
        city = (closed.get(r.a) ?? 0) >= (closed.get(r.b) ?? 0) ? r.a : r.b;
        cause = weather(city, m0).cause ?? cause;
      } else if (strike) cause = 'strike';
      else if (groundLost > flights * 0.05) cause = 'tech';
      byRoute[ci].set(r.id, { flights, late, cancelled, diverted, grounded: groundedOn.get(r.id) ?? 0, cause, city, lost: flights > 0 ? cancelled / flights : 0 });
    }
  });
  return { byRoute, closures, strikes, checks };
}

/** 이번 달 손님·수입·비용 (상태는 바꾸지 않는다). rng를 주면 운항 현장 사건도 뽑는다 */
export function computeMonth(state: AirlineState, rng?: Rng): QuarterOutcome {
  const n = state.companies.length;
  const { byRoute, closures, strikes, checks } = rollOps(state, rng);
  // 일손이 모자라면 (초과 근무로도 못 메우면) 그만큼 결항한다
  const needs = state.companies.map((c) => staffNeed(state, c));
  const caps = state.companies.map((c, ci) => (c.out ? 1 : staffCap(needs[ci], c)));
  /** 운항 사건과 C점검으로 못 뜨는 비율 (일손 부족은 빼고) */
  const baseLost = (ci: number, routeId: number) => {
    const ops = byRoute[ci].get(routeId)?.lost ?? 0;
    const down = checks[ci].lost.get(routeId) ?? 0;
    const freq = down > 0 ? routeFreq(state.companies[ci], routeId) : 0;
    const chk = freq > 0 ? Math.min(1, down / freq) : 0;
    return 1 - (1 - ops) * (1 - chk);
  };
  const lostFor = (ci: number, routeId: number) => 1 - (1 - baseLost(ci, routeId)) * caps[ci];
  // 1) 곧장 가는 손님: 두 도시마다 운항을 모아 나눈다
  const pairs = new Map<string, { a: string; b: string; offers: Offer[]; routes: Route[] }>();
  state.companies.forEach((c, ci) => {
    if (c.out) return;
    for (const r of c.routes) {
      const o = offerFromRoute(state, ci, r, lostFor(ci, r.id));
      if (o.planes.length === 0) continue;
      const key = pairKey(r.a, r.b);
      let entry = pairs.get(key);
      if (!entry) {
        entry = { a: r.a, b: r.b, offers: [], routes: [] };
        pairs.set(key, entry);
      }
      entry.offers.push(o);
      entry.routes.push(r);
    }
  });
  const runs: RouteRun[] = [];
  const unserved = new Map<number, { biz: number; leisure: number }>();
  for (const { a, b, offers, routes } of pairs.values()) {
    const split = splitMarketFull(state, a, b, offers);
    unserved.set(pairIndex(a, b), split.unserved);
    split.results.forEach((res, k) => {
      const freq = offers[k].planes.reduce((s, p) => s + p.freq, 0);
      runs.push({
        ci: res.company,
        route: routes[k],
        seats: res.seats,
        biz: res.biz,
        leisure: res.leisure,
        share: res.share,
        revenue: res.revenue,
        hours: res.hours,
        freq,
        xfer: 0,
        xferRev: 0,
        premSeats: res.premSeats,
        premPax: res.premPax,
        cls: res.cls,
        cargoT: res.cargoT,
        cargoCap: res.cargoCap,
        cargoRev: res.cargoRev,
        ancillary: res.ancillary,
      });
    });
  }
  // 2) 갈아타는 손님
  const xfers = assignTransfers(state, runs, unserved);

  // 3) 노선마다 비용과 회사 합계
  const m0 = monthOf(state.t) - 1;
  const reports: CompanyReport[] = state.companies.map(() => emptyReport());
  const routeReports: RouteReport[] = [];
  const routeStats: QuarterOutcome['routeStats'] = state.companies.map(() => new Map());
  const arrivals: Map<string, number>[] = state.companies.map(() => new Map());
  const ctxs = state.companies.map((c) => costCtx(state, c));
  const activeRoutes = new Set<number>();
  const ops: OpsIncident[] = [];

  for (const run of runs) {
    const ci = run.ci;
    const c = state.companies[ci];
    const { a, b } = run.route;
    activeRoutes.add(run.route.id);
    const o0 = byRoute[ci].get(run.route.id);
    const lost = lostFor(ci, run.route.id);
    const keep = 1 - lost;
    const planes: CostPlane[] = [];
    let seatSum = 0;
    let freqSum = 0;
    for (const p of c.planes) {
      const f = legFreq(p, run.route.id);
      if (f <= 0) continue;
      const cab = planeCabin(p);
      planes.push({ model: MODEL[p.model], freq: f * keep, age: planeAge(state, p), fixed: fixedShare(c, p, run.route.id), cab });
      seatSum += cab.seats * f;
      freqSum += f;
    }
    const paxWeek = run.biz + run.leisure + run.xfer;
    const revenue = (run.revenue + run.xferRev) * WEEKS;
    const cost = routeCost(state, ci, a, b, planes, paxWeek, revenue, ctxs[ci]);
    const pax = paxWeek * 2 * WEEKS;
    const rep = reports[ci];
    // 일손 부족 결항을 운항 사건에 더한다
    const allFlights = freqSum * 2 * WEEKS;
    const staffCancel = caps[ci] < 1 ? Math.round(allFlights * (lost - baseLost(ci, run.route.id))) : 0;
    rep.staffCancelled += staffCancel;
    const o: RouteOps | undefined = o0
      ? { ...o0, cancelled: Math.min(o0.flights, o0.cancelled + staffCancel), cause: staffCancel > o0.cancelled ? 'staff' : o0.cause }
      : staffCancel > 0
        ? { flights: allFlights, late: 0, cancelled: staffCancel, diverted: 0, grounded: 0, cause: 'staff', lost }
        : undefined;
    // 지연·결항 보상, 돌아간 비행 비용
    const seatsPer = freqSum > 0 ? seatSum / freqSum : 150;
    const disrupt = o ? o.late * seatsPer * 0.00012 + o.cancelled * seatsPer * 0.0012 + o.diverted * (0.15 + seatsPer * 0.0012) : 0;
    rep.ticket += revenue;
    rep.cargo += run.cargoRev * WEEKS;
    rep.ancillary += run.ancillary * WEEKS;
    rep.cargoT += run.cargoT * 2 * WEEKS;
    rep.cargoCap += run.cargoCap * 2 * WEEKS;
    rep.paxF += run.cls.pax[0] * 2 * WEEKS;
    rep.paxC += run.cls.pax[1] * 2 * WEEKS;
    rep.revF += run.cls.rev[0] * WEEKS;
    rep.revC += run.cls.rev[1] * WEEKS;
    rep.fuel += cost.fuel;
    rep.crew += cost.crew;
    rep.airport += cost.airport;
    rep.service += cost.service;
    rep.sales += cost.sales;
    rep.lease += cost.lease;
    rep.disrupt += disrupt;
    rep.pax += pax;
    rep.seats += run.seats * 2 * WEEKS;
    const flights = o ? o.flights : freqSum * 2 * WEEKS;
    rep.flights += flights;
    if (o) {
      rep.late += o.late;
      rep.cancelled += o.cancelled;
      rep.diverted += o.diverted;
      if (o.late + o.cancelled + o.diverted + o.grounded > 0) ops.push({ company: ci, route: run.route.id, a, b, flights: o.flights, late: o.late, cancelled: o.cancelled, diverted: o.diverted, grounded: o.grounded, cause: o.cause, city: o.city });
    }
    const ra = CITY[a].region;
    const rb = CITY[b].region;
    rep.regionPax[ra] += pax;
    if (rb !== ra) rep.regionPax[rb] += pax;
    if (isPacific(a, b)) rep.pacificPax += pax;
    if (isResort(a) || isResort(b)) rep.resortPax += pax;
    if (c.hub === a || c.hub === b) rep.hubPax += pax;
    const profit = revenue - cost.total - disrupt;
    if (planes.some((p) => p.model.body === 'sst')) rep.sstProfit += profit;
    const leisureM = run.leisure * WEEKS;
    arrivals[ci].set(a, (arrivals[ci].get(a) ?? 0) + leisureM);
    arrivals[ci].set(b, (arrivals[ci].get(b) ?? 0) + leisureM);
    const flown = o ? o.flights - o.cancelled : flights;
    routeStats[ci].set(run.route.id, {
      // 화물기만 나는 노선은 화물 탑승률
      lf: run.seats > 0 ? paxWeek / run.seats : run.cargoCap > 0 ? run.cargoT / run.cargoCap : 0,
      pax,
      revenue,
      profit,
      share: run.share,
      xfer: run.xfer,
      xferRev: run.xferRev,
      onTime: o ? (flown > 0 ? 1 - (o.late + o.diverted) / flown : 0) : expectedOnTime(state, ci, run.route.id),
      cancel: o ? (o.flights > 0 ? o.cancelled / o.flights : 0) : 0,
      premLf: run.premSeats > 0 ? Math.min(1, run.premPax / run.premSeats) : undefined,
      cls: { pax: run.cls.pax, seats: run.cls.seats, rev: run.cls.rev.map((x) => x * WEEKS) as [number, number, number] },
      cargo: run.cargoCap > 0 ? { t: run.cargoT, cap: run.cargoCap, rev: run.cargoRev * WEEKS } : undefined,
    });
    routeReports.push({ company: ci, route: run.route.id, a, b, pax, seats: run.seats * 2 * WEEKS, revenue, cost: cost.total + disrupt, profit });
  }
  for (const x of xfers) for (const ci of x.companies) reports[ci].xferPax += x.pax;

  for (let ci = 0; ci < n; ci++) {
    const c = state.companies[ci];
    const rep = reports[ci];
    if (c.out) continue;
    // 쉬는 비행기: 리스료 + 보험 + (내 비행기면) 보관비
    for (const p of c.planes) {
      if (p.legs.some((l) => l.freq > 0 && activeRoutes.has(l.route))) continue;
      const price = MODEL[p.model].price;
      rep.fleet += planeFixed(p) + (p.leased ? 0 : price * IDLE_RATE);
    }
    // C점검 값 ('운항 수당·정비 부품'에 넣는다)
    if (checks[ci].planes > 0) {
      let cost = 0;
      for (const p of c.planes) if (inCheck(p, state.t)) cost += companyCheckCost(c, p);
      rep.crew += cost;
      rep.checks = checks[ci].planes;
      rep.checkCost = cost;
    }
    for (const city of c.branches) rep.branch += branchUpkeep(city, state.q);
    if (c.facilities) rep.branch += facilitiesUpkeep(c, state.q);
    for (const r of REGIONS) rep.ads += c.ads[r];
    // 단골 프로그램 운영비·마일리지 값 (광고비에 넣고 따로 적는다: loyalty.ts)
    chargeLoyalty(c, rep);
    const limit = creditLimit(state, ci);
    const premium = c.debt > limit * 0.8 ? 2 : 0;
    rep.interest = (c.debt * (state.rate + premium)) / 100 / 12;
    for (const biz of c.businesses) {
      const city = CITY[biz.city];
      const arrivalsM = arrivals[ci].get(biz.city) ?? 0;
      const info = BUSINESS_INFO[biz.kind];
      rep.side += (biz.cost * info.rate(city) * businessMonthSeason(biz.kind, city, m0)) / 3 + arrivalsM * info.perArrival;
    }
    // 노선 보조금 (달마다): 그 도시를 오가는 노선을 날고 있으면
    for (const m of c.mods) {
      if (m.kind !== 'subsidy' || !active(m, state.t) || !m.city) continue;
      if (c.routes.some((r) => (r.a === m.city || r.b === m.city) && routeFreq(c, r.id) > 0)) rep.side += m.value;
    }
    // 전세기: 보수는 부대 수입, 비용은 연료·운항 수당·공항에
    for (const o of state.charters ?? []) {
      if (o.by !== ci || o.t !== state.t || o.plane === undefined) continue;
      const p = c.planes.find((x) => x.id === o.plane);
      if (!p) continue;
      const m = MODEL[p.model];
      const cost = charterCost(state, ci, m, planeAge(state, p), o.a, o.b, Math.ceil(o.pax / m.seats), o.pax);
      rep.side += o.pay;
      rep.fuel += cost.fuel;
      rep.crew += cost.crew;
      rep.airport += cost.airport;
      rep.charters = (rep.charters ?? 0) + 1;
      rep.charterRev = (rep.charterRev ?? 0) + o.pay;
    }
    // 연료: 탱크에 사 둔 연료를 (산 값으로) 먼저 쓰고, 모자라면 그달 값(헤지했으면 고정 값)으로 산다
    const oilNow = ctxs[ci].oil;
    if (rep.fuel > 0 && oilNow > 0) {
      const tons = rep.fuel / (FUEL_TON * oilNow);
      rep.fuelTons = tons;
      if (c.fuel && c.fuel.stock > 0) {
        const burn = burnFuel(c.fuel, tons, oilNow);
        rep.fuel = burn.cost;
        rep.tankUsed = burn.used;
        rep.tankSaved = burn.saved;
      }
    }
    rep.onTime = rep.flights - rep.cancelled > 0 ? 1 - (rep.late + rep.diverted) / (rep.flights - rep.cancelled) : c.onTime;
    rep.staff = payroll(state, c, needs[ci]);
    rep.strike = strikes[ci];
    const before =
      rep.ticket + rep.side - rep.fuel - rep.crew - rep.airport - rep.service - rep.sales - rep.lease - rep.fleet - rep.branch - rep.ads - rep.interest - rep.disrupt - rep.staff;
    rep.tax = Math.max(0, before) * TAX_RATE;
    rep.profit = before - rep.tax;
  }
  ops.sort((x, y) => y.cancelled * 3 + y.late + y.diverted * 4 + y.grounded * 6 - (x.cancelled * 3 + x.late + x.diverted * 4 + x.grounded * 6));
  return { reports, routes: routeReports, routeStats, xfers: xfers.slice(0, 60), ops: ops.slice(0, 80), closures };
}

/** 이번 달 이 회사가 전세기로 보낸 비행기 */
function charterBusy(state: Pick<AirlineState, 'charters' | 't'>, ci: number): Set<number> {
  const out = new Set<number>();
  for (const o of state.charters ?? []) if (o.by === ci && o.t === state.t && o.plane !== undefined) out.add(o.plane);
  return out;
}

/**
 * 전세기 한 건의 비용 (억): 연료·승무원(운항 수당·정비)·공항. 손님을 데려갔다 데려오는 왕복을 trips번.
 * 노선 비용(routeCost)과 같은 셈법이다.
 */
export function charterCost(
  state: Pick<AirlineState, 'oil' | 't' | 'companies'>,
  ci: number,
  model: ModelDef,
  age: number,
  a: string,
  b: string,
  trips: number,
  pax: number,
): { fuel: number; crew: number; airport: number; total: number } {
  const c = state.companies[ci];
  const ctx = costCtx(state, c);
  const d = dist(a, b);
  const fuel = (trips * 2 * d * model.burn * (1 + 0.006 * age) * FUEL_PRICE * ctx.oil * ctx.fuelMult) / 10000;
  const crew = (trips * 2 * (legHours(model, d) * CREW_MULT + CYCLE_HOURS) * model.hourCost * (1 + 0.025 * age) * ctx.crewMult * (1 - STAFF_SHARE)) / 10000;
  const airport = (trips * (FEE_INFO[CITY[a].fee].perLanding + FEE_INFO[CITY[b].fee].perLanding) * (model.seats / 150) ** 0.7 + pax * 2 * HANDLING) / 10000;
  return { fuel, crew, airport, total: fuel + crew + airport };
}

/** 예전 이름: 분기 대신 이번 달 (테스트·화면 어림) */
export const computeQuarter = computeMonth;

/** 운항 사건 없이 셈할 때 쓰는 기대 정시율 */
export function expectedOnTime(state: AirlineState, ci: number, routeId: number): number {
  const r = opsRates(state, ci, routeId);
  return Math.max(0, 1 - r.late - r.divert);
}

/** 빈 결산 한 줄 */
export function emptyReport(): CompanyReport {
  return {
    ticket: 0,
    cargo: 0,
    ancillary: 0,
    cargoT: 0,
    cargoCap: 0,
    paxF: 0,
    paxC: 0,
    revF: 0,
    revC: 0,
    side: 0,
    fuel: 0,
    crew: 0,
    airport: 0,
    service: 0,
    sales: 0,
    lease: 0,
    fleet: 0,
    tax: 0,
    branch: 0,
    ads: 0,
    interest: 0,
    profit: 0,
    pax: 0,
    seats: 0,
    value: 0,
    cash: 0,
    debt: 0,
    autoLoan: 0,
    bankrupt: false,
    regionPax: emptyRegion(),
    pacificPax: 0,
    resortPax: 0,
    sstProfit: 0,
    hubPax: 0,
    xferPax: 0,
    flights: 0,
    late: 0,
    cancelled: 0,
    diverted: 0,
    disrupt: 0,
    staff: 0,
    staffCancelled: 0,
    strike: false,
    onTime: 0,
    fuelTons: 0,
    tankUsed: 0,
    tankSaved: 0,
    checks: 0,
    checkCost: 0,
    charters: 0,
    charterRev: 0,
  };
}

/** 결산 여러 개를 더한다 (분기·해). 돈·손님은 합, 현금·빚·가치는 마지막 값, 정시율은 편수로 다시 셈한다 */
export function sumReports(list: readonly CompanyReport[]): CompanyReport {
  const out = emptyReport();
  if (list.length === 0) return out;
  const add: (keyof CompanyReport)[] = [
    'ticket', 'side', 'fuel', 'crew', 'airport', 'service', 'sales', 'lease', 'fleet', 'tax', 'branch', 'ads', 'interest', 'profit',
    'cargo', 'ancillary', 'cargoT', 'cargoCap', 'paxF', 'paxC', 'revF', 'revC',
    'pax', 'seats', 'autoLoan', 'pacificPax', 'resortPax', 'sstProfit', 'hubPax', 'xferPax', 'flights', 'late', 'cancelled', 'diverted', 'disrupt', 'staff', 'staffCancelled',
  ];
  for (const r of list) {
    for (const k of add) (out[k] as number) += (r[k] as number) ?? 0;
    for (const reg of REGIONS) out.regionPax[reg] += r.regionPax[reg];
    // 나중에 생긴 값 (예전 저장의 결산에는 없을 수 있다)
    out.fuelTons = (out.fuelTons ?? 0) + (r.fuelTons ?? 0);
    out.tankUsed = (out.tankUsed ?? 0) + (r.tankUsed ?? 0);
    out.tankSaved = (out.tankSaved ?? 0) + (r.tankSaved ?? 0);
    out.checks = (out.checks ?? 0) + (r.checks ?? 0);
    out.checkCost = (out.checkCost ?? 0) + (r.checkCost ?? 0);
    out.charters = (out.charters ?? 0) + (r.charters ?? 0);
    out.charterRev = (out.charterRev ?? 0) + (r.charterRev ?? 0);
    out.bankrupt = out.bankrupt || r.bankrupt;
    out.strike = out.strike || r.strike;
  }
  const last = list[list.length - 1];
  out.value = last.value;
  out.cash = last.cash;
  out.debt = last.debt;
  const flown = out.flights - out.cancelled;
  out.onTime = flown > 0 ? 1 - (out.late + out.diverted) / flown : last.onTime;
  return out;
}

/** 비행기들의 좌석 가중 평균 나이 */
export function fleetAge(state: Pick<AirlineState, 't'>, c: Company): number {
  let seats = 0;
  let sum = 0;
  for (const p of c.planes) {
    const s = sizeSeats(MODEL[p.model]);
    seats += s;
    sum += s * planeAge(state, p);
  }
  return seats > 0 ? sum / seats : 0;
}

/** 평판이 향하는 값 (기내식·비행기 나이·편안함·좌석 간격·정시 운항) */
export function reputationTarget(state: Pick<AirlineState, 't'>, c: Company): number {
  if (c.planes.length === 0) return 50;
  const age = fleetAge(state, c);
  let comfort = 0;
  let meal = 0;
  let seats = 0;
  for (const p of c.planes) {
    const m = MODEL[p.model];
    // 일반석이 넓으면 편안함 +0.5, 촘촘하면 −0.5
    const w = sizeSeats(m);
    comfort += (m.comfort + (p.cabin.pitch - 1) * 0.5) * w;
    meal += p.meal * w;
    seats += w;
  }
  comfort /= seats;
  meal /= seats;
  const ageAdj = age < 5 ? 8 : age < 10 ? 2 : age < 16 ? -6 : -14;
  const onTimeAdj = Math.max(-12, Math.min(6, (c.onTime - 0.85) * 80));
  // 기체 상태: 낡고 닳은 실내는 손님 눈에 띈다
  const condAdj = Math.max(-5, Math.min(3, (fleetCond(c) - 70) / 6));
  return Math.max(0, Math.min(100, 25 + 9 * meal + ageAdj + (comfort - 3) * 4 + onTimeAdj + condAdj + loungeRep(c)));
}

/** 광고가 알려진 정도로 바뀌는 크기 (억/분기 기준. 달 광고비는 세 배로 견준다) */
export function adScale(q: number): number {
  return 12 * travelFactor(q) ** 0.8;
}
