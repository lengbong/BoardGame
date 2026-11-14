import { MODEL } from './aircraft';
import { AIRPORT_INFO, CITY, FEE_INFO, REGIONS, SEASON_INFO, airportClass, citySize, dist, pairIndex, pairKey } from './cities';
import { effectMults, fixedEventMult, priceMult } from './events';
import { quarterOf, yearOf } from './time';
import type { AirlineState, Business, Company, CompanyReport, ModelDef, Plane, RegionId, Route, RouteReport } from './types';

/**
 * 하늘길 항공사의 경제 계산. 돈은 모두 억 원(오늘 돈 기준, 물가 오름 없음), 운임은 만 원.
 * 숫자들은 실제와 비슷한 느낌이 나도록 어림한 게임용 값이다.
 */

export const WEEKS = 13;
/** 비행기 한 대가 한 주에 날 수 있는 시간 */
export const WEEK_HOURS = 98;
/** 한 번 날 때마다 더 드는 시간 (지상 이동·손님 타고 내리기) */
export const LEG_OVERHEAD = 0.75;
/** 비행기 한 대의 주간 왕복 수 한도 */
export const MAX_FREQ = 28;
/** 연료 1kg 값 (만 원, 유가 지수 1일 때) */
export const FUEL_PRICE = 0.13;
/** 리스료: 분기마다 새 값의 3.5% (계약할 때 두 분기 치를 계약금으로 낸다) */
export const LEASE_RATE = 0.035;
export const LEASE_DEPOSIT = 2;
/** 보험·관리비: 비행기마다 분기에 새 값의 0.5% */
export const INSURANCE = 0.005;
/** 쉬는 내 비행기 보관·정비비: 분기마다 새 값의 0.4% */
export const IDLE_RATE = 0.004;
/** 한 분기에 새로 받을 수 있는 비행기 수 (사기 + 리스) */
export const MAX_DELIVERIES = 4;
/** 법인세: 분기 이익의 20% */
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
/** 서비스 수준별 손님 1명 서비스비 배수 (1~5) */
export const SERVICE_COST = [0, 0.5, 0.75, 1, 1.4, 1.9];
export const SERVICE_NAMES = ['', '아주 간단', '간단', '보통', '좋음', '최고급'];

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
];

const yearFrac = (q: number) => yearOf(q) + (quarterOf(q) - 1) / 4;

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

/** 한 번 나는 데 걸리는 시간 (지상 시간 포함) */
export function legHours(model: ModelDef, d: number): number {
  return d / model.speed + LEG_OVERHEAD;
}

/** 이 비행기가 이 거리 노선을 한 주에 왕복할 수 있는 최대 횟수 */
export function maxFreq(model: ModelDef, d: number): number {
  return Math.max(0, Math.min(MAX_FREQ, Math.floor(WEEK_HOURS / (2 * legHours(model, d)))));
}

export function planeAge(state: Pick<AirlineState, 'q'>, plane: Plane): number {
  return Math.max(0, (state.q - plane.since) / 4);
}

/** 지금 새로 살 때 값 (박람회 특가 반영) */
export function modelPrice(state: Pick<AirlineState, 'effects'>, model: ModelDef): number {
  return Math.round(model.price * priceMult(state.effects));
}

/** 리스 계약금 (두 분기 치 리스료) */
export function leaseDeposit(state: Pick<AirlineState, 'effects'>, model: ModelDef): number {
  return Math.round(leaseRent(state, model) * LEASE_DEPOSIT * 10) / 10;
}

/** 지금 리스하면 분기마다 내는 돈 */
export function leaseRent(state: Pick<AirlineState, 'effects'>, model: ModelDef): number {
  return Math.round(model.price * LEASE_RATE * priceMult(state.effects) * 10) / 10;
}

/** 내 비행기의 지금 가치 (리스기는 0) */
export function planeValue(state: Pick<AirlineState, 'q'>, plane: Plane): number {
  if (plane.leased) return 0;
  const m = MODEL[plane.model];
  const age = planeAge(state, plane);
  const retired = yearOf(state.q) > m.end ? 0.85 : 1;
  return m.price * Math.max(0.1, 1 - DEPRECIATION * age) * retired;
}

export function sellPrice(state: Pick<AirlineState, 'q'>, plane: Plane): number {
  return Math.round(planeValue(state, plane) * SELL_RATE);
}

export function businessValue(b: Business): number {
  return b.cost * 0.8;
}

/** 회사 가치 = 현금 + 내 비행기·부대사업 가치 − 빚 */
export function companyValue(state: Pick<AirlineState, 'q' | 'companies'>, ci: number): number {
  const c = state.companies[ci];
  if (c.out) return 0;
  let v = c.cash - c.debt;
  for (const p of c.planes) v += planeValue(state, p);
  for (const b of c.businesses) v += businessValue(b);
  return v;
}

/** 은행이 빌려 줄 수 있는 최대 빚 */
export function creditLimit(state: Pick<AirlineState, 'q' | 'companies'>, ci: number): number {
  const c = state.companies[ci];
  let assets = 0;
  for (const p of c.planes) assets += planeValue(state, p);
  for (const b of c.businesses) assets += businessValue(b);
  return Math.max(0, Math.round(c.baseCredit + assets * 0.5));
}

/** 지점을 여는 값 (억) */
export function branchCost(city: string, q: number): number {
  return Math.round(15 + 7 * citySize(CITY[city], yearOf(q)));
}

/** 지점 유지비 (억/분기) */
export function branchUpkeep(city: string, q: number): number {
  return 1.5 + 0.9 * citySize(CITY[city], yearOf(q));
}

export function businessCost(city: string, kind: Business['kind'], q: number): number {
  const c = CITY[city];
  const s = citySize(c, yearOf(q));
  return Math.round(kind === 'hotel' ? 40 + 10 * s + 6 * c.fun : 15 + 4 * s);
}

/** 이 회사가 이 공항에서 한 주에 쓸 수 있는 운항 횟수 */
export function slotCapacity(state: Pick<AirlineState, 'q' | 'slotBoost' | 'companies'>, ci: number, city: string): number {
  const cls = airportClass(CITY[city], yearOf(state.q));
  const hub = state.companies[ci].hub === city ? 2 : 1;
  return Math.round(AIRPORT_INFO[cls].slots * hub * (1 + (state.slotBoost[city] ?? 0)));
}

/** 이 회사가 이 공항에서 지금 쓰는 주간 운항 횟수 (exceptPlane은 빼고 센다) */
export function slotsUsed(company: Company, city: string, exceptPlane?: number): number {
  let used = 0;
  for (const p of company.planes) {
    if (p.route === null || p.id === exceptPlane) continue;
    const r = company.routes.find((x) => x.id === p.route);
    if (r && (r.a === city || r.b === city)) used += p.freq;
  }
  return used;
}

export function routePlanes(company: Company, routeId: number): Plane[] {
  return company.planes.filter((p) => p.route === routeId);
}

/** 운항하는 노선이 닿은 지역들 */
export function regionsServed(company: Company): Set<RegionId> {
  const out = new Set<RegionId>();
  for (const r of company.routes) {
    if (!company.planes.some((p) => p.route === r.id && p.freq > 0)) continue;
    out.add(CITY[r.a].region);
    out.add(CITY[r.b].region);
  }
  return out;
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

/** 두 도시 사이 한 방향 주간 잠재 손님 */
/** 같은 분기·같은 사건 목록이면 다시 셈하지 않는다 (컴퓨터가 후보를 많이 볼 때 빠르게) */
const demandCache = new WeakMap<readonly unknown[], Map<number, PairDemand>>();

export function pairDemand(state: Pick<AirlineState, 'q' | 'effects'>, a: string, b: string, q = state.q): PairDemand {
  let cache = demandCache.get(state.effects);
  if (!cache) {
    cache = new Map();
    demandCache.set(state.effects, cache);
  }
  const key = q * 4096 + pairIndex(a, b);
  const hit = cache.get(key);
  if (hit) return hit;
  const d = computeDemand(state, a, b, q);
  cache.set(key, d);
  return d;
}

function computeDemand(state: Pick<AirlineState, 'q' | 'effects'>, a: string, b: string, q: number): PairDemand {
  const A = CITY[a];
  const B = CITY[b];
  const year = yearOf(q);
  const quarter = quarterOf(q) - 1;
  const sA = citySize(A, year);
  const sB = citySize(B, year);
  const eA = effectMults(state.effects, a);
  const eB = effectMults(state.effects, b);
  const base = DEMAND_K * travelFactor(q) * distanceFactor(dist(a, b)) * (A.region === B.region ? 1.35 : 1) * fixedEventMult(a, q) * fixedEventMult(b, q);
  const biz = BIZ_K * (sA * sB) ** 0.95 * Math.sqrt(A.biz * B.biz) * eA.biz * eB.biz;
  const leisure =
    LEISURE_K *
    (sA ** 1.3 * B.fun * SEASON_INFO[B.season].mult[quarter] * eB.leisure + sB ** 1.3 * A.fun * SEASON_INFO[A.season].mult[quarter] * eA.leisure);
  return { biz: base * biz, leisure: base * leisure };
}

// ------------------------------------------------------------------ 시장 나누기

interface OfferPlane {
  model: ModelDef;
  freq: number;
  age: number;
}

/** 한 회사가 두 도시 사이에 내놓은 운항 */
export interface Offer {
  company: number;
  fare: number;
  planes: OfferPlane[];
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
}

const A0_BIZ = 1.2;
const A0_LEISURE = 1.5;

/** 회사의 매력 (사업·관광) */
function attraction(
  state: AirlineState,
  a: string,
  b: string,
  offer: Offer,
  bestHours: number,
): { biz: number; leisure: number; seats: number; hours: number; premium: number } {
  const c = state.companies[offer.company];
  const d = dist(a, b);
  let freq = 0;
  let seats = 0;
  let comfortSum = 0;
  let hoursSum = 0;
  let premiumSum = 0;
  for (const p of offer.planes) {
    if (p.freq <= 0) continue;
    const cap = p.model.seats * p.freq;
    freq += p.freq;
    seats += cap;
    const comfort = 0.775 + 0.075 * p.model.comfort - Math.min(0.15, 0.008 * p.age);
    comfortSum += comfort * cap;
    hoursSum += legHours(p.model, d) * cap;
    premiumSum += (p.model.body === 'sst' ? SST_PREMIUM : 1) * cap;
  }
  if (freq === 0) return { biz: 0, leisure: 0, seats: 0, hours: 0, premium: 1 };
  const comfort = (comfortSum / seats) * (0.9 + 0.05 * (c.service - 1));
  const hours = hoursSum / seats;
  const premium = premiumSum / seats;
  const speed = bestHours > 0 ? bestHours / hours : 1;
  const rep = 0.8 + (0.4 * c.reputation) / 100;
  const ad = 1 + (0.3 * (c.awareness[CITY[a].region] + c.awareness[CITY[b].region])) / 2;
  const hub = c.hub === a || c.hub === b ? 1.15 : 1;
  let leisureBonus = 1;
  let bizBonus = 1;
  for (const biz of c.businesses) {
    if (biz.city !== a && biz.city !== b) continue;
    if (biz.kind === 'hotel') leisureBonus *= 1.12;
    else {
      leisureBonus *= 1.05;
      bizBonus *= 1.05;
    }
  }
  const p = (1 + offer.fare / 100) * premium;
  const common = rep * ad * hub;
  return {
    biz: freq ** 0.6 * p ** -0.8 * common * comfort ** 1.5 * speed * bizBonus,
    leisure: freq ** 0.5 * p ** -1.8 * common * comfort ** 0.5 * speed ** 0.3 * leisureBonus,
    seats,
    hours,
    premium,
  };
}

/** 두 도시 사이 손님을 회사들이 나눈다 (좌석이 모자라면 남은 손님 절반은 다른 회사로) */
export function splitMarket(state: AirlineState, a: string, b: string, offers: Offer[], demand = pairDemand(state, a, b)): OfferResult[] {
  const d = dist(a, b);
  let bestHours = Infinity;
  for (const o of offers) for (const p of o.planes) if (p.freq > 0) bestHours = Math.min(bestHours, legHours(p.model, d));
  if (!Number.isFinite(bestHours)) bestHours = 0;
  const attrs = offers.map((o) => attraction(state, a, b, o, bestHours));
  const sumB = attrs.reduce((s, x) => s + x.biz, 0);
  const sumL = attrs.reduce((s, x) => s + x.leisure, 0);
  const wantB = attrs.map((x) => (demand.biz * x.biz) / (sumB + A0_BIZ));
  const wantL = attrs.map((x) => (demand.leisure * x.leisure) / (sumL + A0_LEISURE));
  // 사업 손님부터 태운다 (운임이 비싸니까)
  const gotB = attrs.map((x, i) => Math.min(wantB[i], x.seats));
  const gotL = attrs.map((x, i) => Math.min(wantL[i], x.seats - gotB[i]));
  // 못 탄 손님의 절반은 자리가 남은 다른 회사로
  const spillB = wantB.reduce((s, w, i) => s + (w - gotB[i]), 0) * 0.5;
  const spillL = wantL.reduce((s, w, i) => s + (w - gotL[i]), 0) * 0.5;
  if (spillB > 0.01 || spillL > 0.01) {
    const free = attrs.map((x, i) => x.seats - gotB[i] - gotL[i]);
    const wB = attrs.map((x, i) => (free[i] > 0.5 ? x.biz : 0));
    const wL = attrs.map((x, i) => (free[i] > 0.5 ? x.leisure : 0));
    const sB = wB.reduce((s, x) => s + x, 0);
    const sL = wL.reduce((s, x) => s + x, 0);
    for (let i = 0; i < attrs.length; i++) {
      if (free[i] <= 0.5) continue;
      const addB = sB > 0 ? Math.min(free[i], (spillB * wB[i]) / sB) : 0;
      gotB[i] += addB;
      const addL = sL > 0 ? Math.min(free[i] - addB, (spillL * wL[i]) / sL) : 0;
      gotL[i] += addL;
    }
  }
  const total = gotB.reduce((s, x) => s + x, 0) + gotL.reduce((s, x) => s + x, 0);
  const fare = baseFare(d, state.q);
  return offers.map((o, i) => {
    const p = (1 + o.fare / 100) * attrs[i].premium;
    const pax = gotB[i] + gotL[i];
    return {
      company: o.company,
      biz: gotB[i],
      leisure: gotL[i],
      seats: attrs[i].seats,
      share: total > 0 ? pax / total : 0,
      revenue: ((gotB[i] * BIZ_PREMIUM + gotL[i]) * fare * p * 2) / 10000,
    };
  });
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
  lease: number;
  total: number;
}

/** 노선 하나의 분기 비용 (억). paxWeek: 한 방향 주간 손님, revenue: 분기 운임 수입 */
export function routeCost(
  state: Pick<AirlineState, 'q' | 'oil' | 'companies'>,
  ci: number,
  a: string,
  b: string,
  planes: readonly { model: ModelDef; freq: number; age: number; rent: number }[],
  paxWeek: number,
  revenue: number,
): RouteCost {
  const d = dist(a, b);
  const c = state.companies[ci];
  const feeA = FEE_INFO[CITY[a].fee].perLanding;
  const feeB = FEE_INFO[CITY[b].fee].perLanding;
  let fuel = 0;
  let crew = 0;
  let airport = 0;
  let lease = 0;
  for (const p of planes) {
    lease += p.rent + p.model.price * INSURANCE;
    if (p.freq <= 0) continue;
    const trips = p.freq * WEEKS;
    fuel += trips * 2 * d * p.model.burn * (1 + 0.006 * p.age) * FUEL_PRICE * state.oil;
    crew += trips * 2 * (legHours(p.model, d) * CREW_MULT + CYCLE_HOURS) * p.model.hourCost * (1 + 0.025 * p.age);
    airport += trips * (feeA + feeB) * (p.model.seats / 150) ** 0.7;
  }
  const paxQ = paxWeek * 2 * WEEKS;
  airport += paxQ * HANDLING;
  const service = paxQ * (0.3 + 0.00025 * d) * SERVICE_COST[c.service];
  // 만 원 → 억 원
  fuel /= 10000;
  crew /= 10000;
  airport /= 10000;
  const serviceE = service / 10000;
  const sales = revenue * SALES_RATE;
  return { fuel, crew, airport, service: serviceE, sales, lease, total: fuel + crew + airport + serviceE + sales + lease };
}

// ------------------------------------------------------------------ 노선 어림하기 (컴퓨터·화면)

export interface DraftPlane {
  model: string;
  freq: number;
  age?: number;
  leased?: boolean;
  rent?: number;
}

export interface RouteEstimate {
  /** 한 방향 주간 손님 */
  paxWeek: number;
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
}

function offerFromRoute(state: Pick<AirlineState, 'q' | 'companies'>, ci: number, route: Route): Offer {
  const c = state.companies[ci];
  const planes: OfferPlane[] = [];
  for (const p of c.planes) if (p.route === route.id && p.freq > 0) planes.push({ model: MODEL[p.model], freq: p.freq, age: planeAge(state, p) });
  return { company: ci, fare: route.fare, planes };
}

/** 다른 회사들이 이 두 도시 사이에 내놓은 운항 */
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

/** 이 회사가 이 두 도시를 이렇게 날면 이번 분기에 어떻게 될지 (다른 회사는 지금 그대로) */
export function estimateRoute(state: AirlineState, ci: number, a: string, b: string, planes: readonly DraftPlane[], fare: number): RouteEstimate {
  const offers = rivalOffers(state, ci, a, b);
  const mine: Offer = {
    company: ci,
    fare,
    planes: planes.map((p) => ({ model: MODEL[p.model], freq: p.freq, age: p.age ?? 0 })),
  };
  const demand = pairDemand(state, a, b);
  const results = splitMarket(state, a, b, [...offers, mine], demand);
  const r = results[results.length - 1];
  const paxWeek = r.biz + r.leisure;
  const revenue = r.revenue * WEEKS;
  const cost = routeCost(
    state,
    ci,
    a,
    b,
    planes.map((p) => ({ model: MODEL[p.model], freq: p.freq, age: p.age ?? 0, rent: p.leased ? (p.rent ?? 0) : 0 })),
    paxWeek,
    revenue,
  );
  return {
    paxWeek,
    seatsWeek: r.seats,
    lf: r.seats > 0 ? paxWeek / r.seats : 0,
    demandWeek: demand.biz + demand.leisure,
    share: r.share,
    revenue,
    cost,
    profit: revenue - cost.total,
    rivals: offers.length,
  };
}

/** 지금 노선 그대로의 어림 */
export function estimateExisting(state: AirlineState, ci: number, route: Route, override?: { fare?: number; planes?: DraftPlane[] }): RouteEstimate {
  const c = state.companies[ci];
  const planes: DraftPlane[] =
    override?.planes ??
    c.planes.filter((p) => p.route === route.id).map((p) => ({ model: p.model, freq: p.freq, age: planeAge(state, p), leased: p.leased, rent: p.rent }));
  return estimateRoute(state, ci, route.a, route.b, planes, override?.fare ?? route.fare);
}

// ------------------------------------------------------------------ 분기 계산

export interface QuarterOutcome {
  reports: CompanyReport[];
  routes: RouteReport[];
  /** 회사마다 노선 결과 (노선 id → 결과) */
  routeStats: Map<number, { lf: number; pax: number; revenue: number; profit: number; share: number }>[];
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

/** 이번 분기 손님·수입·비용 (상태는 바꾸지 않는다) */
export function computeQuarter(state: AirlineState): QuarterOutcome {
  const n = state.companies.length;
  // 두 도시마다 운항을 모은다
  const pairs = new Map<string, { a: string; b: string; offers: Offer[]; routes: Route[] }>();
  const active = new Set<number>();
  state.companies.forEach((c, ci) => {
    if (c.out) return;
    for (const r of c.routes) {
      const o = offerFromRoute(state, ci, r);
      if (o.planes.length === 0) continue;
      const key = pairKey(r.a, r.b);
      let entry = pairs.get(key);
      if (!entry) {
        entry = { a: r.a, b: r.b, offers: [], routes: [] };
        pairs.set(key, entry);
      }
      entry.offers.push(o);
      entry.routes.push(r);
      active.add(r.id);
    }
  });

  const quarter = quarterOf(state.q) - 1;
  const reports: CompanyReport[] = state.companies.map(() => ({
    ticket: 0,
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
  }));
  const routeReports: RouteReport[] = [];
  const routeStats: QuarterOutcome['routeStats'] = state.companies.map(() => new Map());
  /** 도시마다 회사가 내려 준 관광 손님 (호텔 수입) */
  const arrivals: Map<string, number>[] = state.companies.map(() => new Map());

  for (const { a, b, offers, routes } of pairs.values()) {
    const results = splitMarket(state, a, b, offers);
    results.forEach((res, k) => {
      const ci = res.company;
      const c = state.companies[ci];
      const route = routes[k];
      const planes = c.planes
        .filter((p) => p.route === route.id)
        .map((p) => ({ model: MODEL[p.model], freq: p.freq, age: planeAge(state, p), rent: p.leased ? p.rent : 0 }));
      const paxWeek = res.biz + res.leisure;
      const revenue = res.revenue * WEEKS;
      const cost = routeCost(state, ci, a, b, planes, paxWeek, revenue);
      const pax = paxWeek * 2 * WEEKS;
      const rep = reports[ci];
      rep.ticket += revenue;
      rep.fuel += cost.fuel;
      rep.crew += cost.crew;
      rep.airport += cost.airport;
      rep.service += cost.service;
      rep.sales += cost.sales;
      rep.lease += cost.lease;
      rep.pax += pax;
      rep.seats += res.seats * 2 * WEEKS;
      const ra = CITY[a].region;
      const rb = CITY[b].region;
      rep.regionPax[ra] += pax;
      if (rb !== ra) rep.regionPax[rb] += pax;
      if (isPacific(a, b)) rep.pacificPax += pax;
      if (isResort(a) || isResort(b)) rep.resortPax += pax;
      if (c.hub === a || c.hub === b) rep.hubPax += pax;
      const profit = revenue - cost.total;
      if (planes.some((p) => p.model.body === 'sst')) rep.sstProfit += profit;
      const leisureQ = res.leisure * WEEKS;
      arrivals[ci].set(a, (arrivals[ci].get(a) ?? 0) + leisureQ);
      arrivals[ci].set(b, (arrivals[ci].get(b) ?? 0) + leisureQ);
      routeStats[ci].set(route.id, { lf: res.seats > 0 ? paxWeek / res.seats : 0, pax, revenue, profit, share: res.share });
      routeReports.push({ company: ci, route: route.id, a, b, pax, seats: res.seats * 2 * WEEKS, revenue, cost: cost.total, profit });
    });
  }

  for (let ci = 0; ci < n; ci++) {
    const c = state.companies[ci];
    const rep = reports[ci];
    if (c.out) continue;
    // 쉬는 비행기: 리스료 + 보험 + (내 비행기면) 보관비
    for (const p of c.planes) {
      // 운항 중인 노선에 붙은 비행기의 리스료·보험은 노선 비용에 들어 있다
      if (p.route !== null && active.has(p.route)) continue;
      const price = MODEL[p.model].price;
      rep.fleet += p.rent + price * INSURANCE + (p.leased ? 0 : price * IDLE_RATE);
    }
    for (const city of c.branches) rep.branch += branchUpkeep(city, state.q);
    for (const r of REGIONS) rep.ads += c.ads[r];
    const limit = creditLimit(state, ci);
    const premium = c.debt > limit * 0.8 ? 2 : 0;
    rep.interest = (c.debt * (state.rate + premium)) / 100 / 4;
    for (const biz of c.businesses) {
      const city = CITY[biz.city];
      const arrivalsQ = arrivals[ci].get(biz.city) ?? 0;
      if (biz.kind === 'hotel') rep.side += biz.cost * (0.016 + 0.003 * city.fun) * SEASON_INFO[city.season].mult[quarter] + arrivalsQ * 0.0003;
      else rep.side += biz.cost * 0.02 + arrivalsQ * 0.0001;
    }
    const before =
      rep.ticket + rep.side - rep.fuel - rep.crew - rep.airport - rep.service - rep.sales - rep.lease - rep.fleet - rep.branch - rep.ads - rep.interest;
    rep.tax = Math.max(0, before) * TAX_RATE;
    rep.profit = before - rep.tax;
  }
  return { reports, routes: routeReports, routeStats };
}

/** 비행기들의 좌석 가중 평균 나이 */
export function fleetAge(state: Pick<AirlineState, 'q'>, c: Company): number {
  let seats = 0;
  let sum = 0;
  for (const p of c.planes) {
    const s = MODEL[p.model].seats;
    seats += s;
    sum += s * planeAge(state, p);
  }
  return seats > 0 ? sum / seats : 0;
}

/** 평판이 향하는 값 (서비스·비행기 나이·편안함) */
export function reputationTarget(state: Pick<AirlineState, 'q'>, c: Company): number {
  if (c.planes.length === 0) return 50;
  const age = fleetAge(state, c);
  let comfort = 0;
  let seats = 0;
  for (const p of c.planes) {
    const m = MODEL[p.model];
    comfort += m.comfort * m.seats;
    seats += m.seats;
  }
  comfort /= seats;
  const ageAdj = age < 5 ? 8 : age < 10 ? 2 : age < 16 ? -6 : -14;
  return Math.max(0, Math.min(100, 25 + 9 * c.service + ageAdj + (comfort - 3) * 4));
}

/** 광고가 알려진 정도로 바뀌는 크기 (억/분기) */
export function adScale(q: number): number {
  return 12 * travelFactor(q) ** 0.8;
}
