import { MODEL, commonalityMult, launchDiscount } from './aircraft';
import { AIRPORT_INFO, CITY, FEE_INFO, REGIONS, SEASON_INFO, airportClass, citySize, dist, pairIndex, pairKey } from './cities';
import { effectMults, fixedEventMult, priceMult } from './events';
import { quarterOf, yearOf } from './time';
import type {
  AirlineState,
  Business,
  Company,
  CompanyReport,
  Mod,
  ModKind,
  ModelDef,
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

export const WEEKS = 13;
/** 비행기 한 대가 한 주에 날 수 있는 시간 (여러 노선에 나누어 쓴다) */
export const WEEK_HOURS = 98;
/** 한 번 날 때마다 더 드는 시간 (지상 이동·손님 타고 내리기) */
export const LEG_OVERHEAD = 0.75;
/** 비행기 한 대가 한 노선을 한 주에 왕복하는 최대 횟수 */
export const MAX_FREQ = 28;
/** 연료 1kg 값 (만 원, 유가 지수 1일 때) */
export const FUEL_PRICE = 0.13;
/** 리스료: 분기마다 새 값의 3.5% */
export const LEASE_RATE = 0.035;
/** 리스 보증금: 두 분기 치 리스료 (돌려줄 때 돌려받는다) */
export const LEASE_DEPOSIT = 2;
/** 보험·관리비: 비행기마다 분기에 새 값의 0.5% */
export const INSURANCE = 0.005;
/** 쉬는 내 비행기 보관·정비비: 분기마다 새 값의 0.4% */
export const IDLE_RATE = 0.004;
/** 한 분기에 바로 받을 수 있는 비행기 수 (리스 + 중고) */
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
/** 갈아타는 손님: 한 번만 갈아타고, 돌아가는 거리가 곧은 거리의 1.6배를 넘지 않는다 */
export const MAX_DETOUR = 1.6;
/** 갈아타는 손님은 곧장 가는 표보다 15% 싸게 산다 */
export const XFER_FARE = 0.85;
/** 갈아타는 데 걸리는 시간 */
export const XFER_HOURS = 2;
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

/** 비행기가 노는 시간 없이 이 노선만 날 때 한 주 최대 왕복 수 */
export function maxFreq(model: ModelDef, d: number): number {
  return Math.max(0, Math.min(MAX_FREQ, Math.floor(WEEK_HOURS / (2 * legHours(model, d)))));
}

export function planeAge(state: Pick<AirlineState, 'q'>, plane: Plane): number {
  return Math.max(0, (state.q - plane.since) / 4);
}

// ------------------------------------------------------------------ 회사 효과 (결정 사건)

const active = (m: Mod, q: number) => q < m.until;

/** 이 종류의 효과 배수를 모두 곱한다 */
export function modMult(c: Company, kind: ModKind, q: number, match: (m: Mod) => boolean = () => true): number {
  let v = 1;
  for (const m of c.mods) if (m.kind === kind && active(m, q) && match(m)) v *= m.value;
  return v;
}

/** 유가 고정 계약이 있으면 그 값 */
export function hedgedOil(c: Company, q: number, oil: number): number {
  const h = c.mods.find((m) => m.kind === 'fuelHedge' && active(m, q));
  return h ? h.value : oil;
}

/** 이 노선에 걸린 손님 효과 (도시·지역·전체) */
function demandMult(c: Company, a: string, b: string, q: number, seg: 'biz' | 'leisure'): number {
  const ra = CITY[a].region;
  const rb = CITY[b].region;
  return modMult(c, 'demand', q, (m) => {
    if (m.seg && m.seg !== seg) return false;
    if (m.city) return m.city === a || m.city === b;
    if (m.region) return m.region === ra || m.region === rb;
    return true;
  });
}

// ------------------------------------------------------------------ 값·가치

/** 지금 새로 주문할 때 값 (박람회 특가·론치 할인·제작사 할인 반영) */
export function orderPrice(state: Pick<AirlineState, 'effects' | 'q'>, model: ModelDef, c?: Company): number {
  const year = yearOf(state.q);
  const own = c ? modMult(c, 'discount', state.q, (m) => m.model === model.id) : 1;
  return Math.round(model.price * priceMult(state.effects) * (1 - launchDiscount(model, year)) * own);
}

/** 예전 이름 (화면·테스트): 새로 살 때 값 */
export function modelPrice(state: Pick<AirlineState, 'effects' | 'q'>, model: ModelDef, c?: Company): number {
  return orderPrice(state, model, c);
}

/** 지금 리스하면 분기마다 내는 돈 */
export function leaseRent(state: Pick<AirlineState, 'effects'>, model: ModelDef): number {
  return Math.round(model.price * LEASE_RATE * priceMult(state.effects) * 10) / 10;
}

/** 리스 보증금 (두 분기 치 리스료, 돌려줄 때 돌려받는다) */
export function leaseDeposit(state: Pick<AirlineState, 'effects'>, model: ModelDef): number {
  return Math.round(leaseRent(state, model) * LEASE_DEPOSIT * 10) / 10;
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

/** 회사 가치 = 현금 + 내 비행기·주문한 비행기·리스 보증금·부대사업 가치 − 빚 */
export function companyValue(state: Pick<AirlineState, 'q' | 'companies'>, ci: number): number {
  const c = state.companies[ci];
  if (c.out) return 0;
  let v = c.cash - c.debt;
  for (const p of c.planes) v += planeValue(state, p) + p.deposit;
  for (const o of c.orders) v += o.price;
  for (const b of c.businesses) v += businessValue(b);
  return v;
}

/** 은행이 빌려 줄 수 있는 최대 빚 */
export function creditLimit(state: Pick<AirlineState, 'q' | 'companies'>, ci: number): number {
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

/** 지점 유지비 (억/분기) */
export function branchUpkeep(city: string, q: number): number {
  return 1.5 + 0.9 * citySize(CITY[city], yearOf(q));
}

export function businessCost(city: string, kind: Business['kind'], q: number): number {
  const c = CITY[city];
  const s = citySize(c, yearOf(q));
  return Math.round(kind === 'hotel' ? 40 + 10 * s + 6 * c.fun : 15 + 4 * s);
}

// ------------------------------------------------------------------ 비행기 시간과 슬롯

export function routeOf(c: Company, routeId: number): Route | undefined {
  return c.routes.find((r) => r.id === routeId);
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
  return h;
}

/** 비행시간으로 따진 이 비행기의 이 노선 최대 왕복 수 */
export function maxFreqFor(c: Company, p: Plane, routeId: number): number {
  const r = routeOf(c, routeId);
  if (!r) return 0;
  const m = MODEL[p.model];
  const left = WEEK_HOURS - planeHours(c, p, routeId);
  return Math.max(0, Math.min(MAX_FREQ, Math.floor(left / (2 * legHours(m, dist(r.a, r.b))) + 1e-9)));
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
export function slotCapacity(state: Pick<AirlineState, 'q' | 'slotBoost' | 'companies'>, ci: number, city: string): number {
  const c = state.companies[ci];
  const cls = airportClass(CITY[city], yearOf(state.q));
  const hub = c.hub === city ? 2 : 1;
  const bought = modMult(c, 'slot', state.q, (m) => m.city === city);
  return Math.round(AIRPORT_INFO[cls].slots * hub * (1 + (state.slotBoost[city] ?? 0)) * bought);
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

/** 분기마다 비행기 한 대가 무조건 내는 돈 (리스료 + 보험) */
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

/** 같은 분기·같은 사건 목록이면 다시 셈하지 않는다 (컴퓨터가 후보를 많이 볼 때 빠르게) */
const demandCache = new WeakMap<readonly unknown[], Map<number, PairDemand>>();

/** 두 도시 사이 한 방향 주간 잠재 손님 */
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
  /** 평균 한 번 나는 시간 (갈아타기 계산용) */
  hours: number;
}

const A0_BIZ = 1.2;
const A0_LEISURE = 1.5;

/** 평판·광고로 정해지는 회사의 기본 매력 */
function quality(c: Company, a: string, b: string): number {
  const rep = 0.8 + (0.4 * c.reputation) / 100;
  const ad = 1 + (0.3 * (c.awareness[CITY[a].region] + c.awareness[CITY[b].region])) / 2;
  return rep * ad;
}

/** 제휴 상대와 둘 다 지점이 있는 도시면 손님이 조금 더 (공동 운항 효과) */
function partnerBonus(state: AirlineState, c: Company, a: string, b: string): number {
  if (c.partner === null) return 1;
  const p = state.companies[c.partner];
  if (!p || p.out || p.partner === null) return 1;
  const joint = (x: string) => c.branches.includes(x) && p.branches.includes(x);
  return joint(a) || joint(b) ? 1.05 : 1;
}

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
  const hub = c.hub === a || c.hub === b ? 1.08 : 1;
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
  const common = quality(c, a, b) * hub * partnerBonus(state, c, a, b);
  return {
    biz: freq ** 0.6 * p ** -0.8 * common * comfort ** 1.5 * speed * bizBonus * demandMult(c, a, b, state.q, 'biz'),
    leisure: freq ** 0.5 * p ** -1.8 * common * comfort ** 0.5 * speed ** 0.3 * leisureBonus * demandMult(c, a, b, state.q, 'leisure'),
    seats,
    hours,
    premium,
  };
}

export interface SplitResult {
  results: OfferResult[];
  /** 곧장 가는 회사를 고르지 않은 손님 비율 (갈아타기 손님이 노릴 몫) */
  unserved: { biz: number; leisure: number };
}

/** 두 도시 사이 손님을 회사들이 나눈다 (좌석이 모자라면 남은 손님 절반은 다른 회사로) */
export function splitMarketFull(state: AirlineState, a: string, b: string, offers: Offer[], demand = pairDemand(state, a, b)): SplitResult {
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
  const results = offers.map((o, i) => {
    const p = (1 + o.fare / 100) * attrs[i].premium;
    const pax = gotB[i] + gotL[i];
    return {
      company: o.company,
      biz: gotB[i],
      leisure: gotL[i],
      seats: attrs[i].seats,
      share: total > 0 ? pax / total : 0,
      revenue: ((gotB[i] * BIZ_PREMIUM + gotL[i]) * fare * p * 2) / 10000,
      hours: attrs[i].hours,
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

export function costCtx(state: Pick<AirlineState, 'q' | 'oil'>, c: Company): CostCtx {
  return {
    oil: hedgedOil(c, state.q, state.oil),
    fuelMult: modMult(c, 'fuel', state.q),
    serviceMult: modMult(c, 'service', state.q),
    salesMult: modMult(c, 'sales', state.q),
    crewMult: modMult(c, 'crew', state.q),
    families: familyCounts(c),
  };
}

/** 노선 하나의 분기 비용 (억). paxWeek: 한 방향 주간 손님, revenue: 분기 운임 수입 */
export function routeCost(
  state: Pick<AirlineState, 'q' | 'oil' | 'companies'>,
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
  for (const p of planes) {
    lease += p.fixed;
    if (p.freq <= 0) continue;
    const trips = p.freq * WEEKS;
    fuel += trips * 2 * d * p.model.burn * (1 + 0.006 * p.age) * FUEL_PRICE * ctx.oil * ctx.fuelMult;
    const common = commonalityMult(ctx.families.get(p.model.family) ?? 1);
    crew += trips * 2 * (legHours(p.model, d) * CREW_MULT + CYCLE_HOURS) * p.model.hourCost * (1 + 0.025 * p.age) * common * ctx.crewMult;
    airport += trips * (feeA + feeB) * (p.model.seats / 150) ** 0.7;
  }
  const paxQ = paxWeek * 2 * WEEKS;
  airport += paxQ * HANDLING;
  const service = paxQ * (0.3 + 0.00025 * d) * SERVICE_COST[c.service] * ctx.serviceMult;
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
}

function offerFromRoute(state: Pick<AirlineState, 'q' | 'companies'>, ci: number, route: Route): Offer {
  const c = state.companies[ci];
  const planes: OfferPlane[] = [];
  for (const p of c.planes) {
    const f = legFreq(p, route.id);
    if (f > 0) planes.push({ model: MODEL[p.model], freq: f, age: planeAge(state, p) });
  }
  return { company: ci, fare: route.fare, planes };
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

/** 새로 리스할 비행기 한 대의 분기 고정비 */
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
  extra?: { xfer: number; xferRev: number },
): RouteEstimate {
  const offers = rivalOffers(state, ci, a, b);
  const models = planes.map((p) => MODEL[p.model]);
  const mine: Offer = { company: ci, fare, planes: planes.map((p, i) => ({ model: models[i], freq: p.freq, age: p.age ?? 0 })) };
  const demand = pairDemand(state, a, b);
  const results = splitMarket(state, a, b, [...offers, mine], demand);
  const r = results[results.length - 1];
  const local = r.biz + r.leisure;
  const room = Math.max(0, r.seats - local);
  const xfer = extra ? Math.min(room, extra.xfer) : 0;
  const xferRev = extra && extra.xfer > 0 ? (extra.xferRev * xfer) / extra.xfer : 0;
  const paxWeek = local + xfer;
  const revenue = (r.revenue + xferRev) * WEEKS;
  const cost = routeCost(
    state,
    ci,
    a,
    b,
    planes.map((p, i) => ({ model: models[i], freq: p.freq, age: p.age ?? 0, fixed: p.fixed ?? newLeaseFixed(state, models[i]) })),
    paxWeek,
    revenue,
  );
  return {
    paxWeek,
    xferWeek: xfer,
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

/** 이 노선을 나는 비행기들을 어림용으로 (고정비는 비행시간 비율만큼) */
export function draftsOf(state: Pick<AirlineState, 'q'>, c: Company, routeId: number): DraftPlane[] {
  const out: DraftPlane[] = [];
  for (const p of c.planes) {
    const f = legFreq(p, routeId);
    if (f <= 0) continue;
    out.push({ model: p.model, freq: f, age: planeAge(state, p), fixed: fixedShare(c, p, routeId) });
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
export function estimateExisting(state: AirlineState, ci: number, route: Route, override?: { fare?: number; planes?: DraftPlane[] }): RouteEstimate {
  const c = state.companies[ci];
  const planes = override?.planes ?? draftsOf(state, c, route.id);
  const extra = route.stats ? { xfer: route.stats.xfer, xferRev: route.stats.xferRev } : undefined;
  return estimateRoute(state, ci, route.a, route.b, planes, override?.fare ?? route.fare, extra);
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
}

export interface QuarterOutcome {
  reports: CompanyReport[];
  routes: RouteReport[];
  /** 회사마다 노선 결과 (노선 id → 결과) */
  routeStats: Map<number, { lf: number; pax: number; revenue: number; profit: number; share: number; xfer: number; xferRev: number }>[];
  xfers: TransferReport[];
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

/** 제휴로 묶인 회사들 (네트워크 하나) */
export function networks(state: AirlineState): number[][] {
  const out: number[][] = [];
  const seen = new Set<number>();
  state.companies.forEach((c, ci) => {
    if (c.out || seen.has(ci)) return;
    seen.add(ci);
    const p = c.partner;
    if (p !== null && state.companies[p] && !state.companies[p].out && state.companies[p].partner === ci) {
      seen.add(p);
      out.push([ci, p]);
    } else out.push([ci]);
  });
  return out;
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
  for (const r of runs) if (r.freq > 0) byCompany.set(r.ci, [...(byCompany.get(r.ci) ?? []), r]);
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
      const q = (quality(c1, cn.r1.route.a, cn.r1.route.b) + quality(c2, cn.r2.route.a, cn.r2.route.b)) / 2;
      const tf = Math.min(1, tDirect / (cn.r1.hours + cn.r2.hours + XFER_HOURS));
      const fare = (1 + (cn.r1.route.fare + cn.r2.route.fare) / 200) * XFER_FARE;
      return {
        biz: f ** 0.6 * q * tf ** 2 * fare ** -0.8 * 0.75,
        leisure: f ** 0.5 * q * tf * fare ** -1.8 * 0.85,
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
      const rev = ((gb * BIZ_PREMIUM + gl) * baseFare(dAB, state.q) * attrs[k].fare * 2) / 10000;
      const d1 = dist(cn.r1.route.a, cn.r1.route.b);
      const d2 = dist(cn.r2.route.a, cn.r2.route.b);
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

/** 이번 분기 손님·수입·비용 (상태는 바꾸지 않는다) */
export function computeQuarter(state: AirlineState): QuarterOutcome {
  const n = state.companies.length;
  // 1) 곧장 가는 손님: 두 도시마다 운항을 모아 나눈다
  const pairs = new Map<string, { a: string; b: string; offers: Offer[]; routes: Route[] }>();
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
    }
  });
  const runs: RouteRun[] = [];
  const unserved = new Map<number, { biz: number; leisure: number }>();
  for (const { a, b, offers, routes } of pairs.values()) {
    const split = splitMarketFull(state, a, b, offers);
    unserved.set(pairIndex(a, b), split.unserved);
    split.results.forEach((res, k) => {
      const freq = offers[k].planes.reduce((s, p) => s + p.freq, 0);
      runs.push({ ci: res.company, route: routes[k], seats: res.seats, biz: res.biz, leisure: res.leisure, share: res.share, revenue: res.revenue, hours: res.hours, freq, xfer: 0, xferRev: 0 });
    });
  }
  // 2) 갈아타는 손님
  const xfers = assignTransfers(state, runs, unserved);

  // 3) 노선마다 비용과 회사 합계
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
    xferPax: 0,
  }));
  const routeReports: RouteReport[] = [];
  const routeStats: QuarterOutcome['routeStats'] = state.companies.map(() => new Map());
  const arrivals: Map<string, number>[] = state.companies.map(() => new Map());
  const ctxs = state.companies.map((c) => costCtx(state, c));
  const activeRoutes = new Set<number>();

  for (const run of runs) {
    const ci = run.ci;
    const c = state.companies[ci];
    const { a, b } = run.route;
    activeRoutes.add(run.route.id);
    const planes: CostPlane[] = [];
    for (const p of c.planes) {
      const f = legFreq(p, run.route.id);
      if (f > 0) planes.push({ model: MODEL[p.model], freq: f, age: planeAge(state, p), fixed: fixedShare(c, p, run.route.id) });
    }
    const paxWeek = run.biz + run.leisure + run.xfer;
    const revenue = (run.revenue + run.xferRev) * WEEKS;
    const cost = routeCost(state, ci, a, b, planes, paxWeek, revenue, ctxs[ci]);
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
    rep.seats += run.seats * 2 * WEEKS;
    const ra = CITY[a].region;
    const rb = CITY[b].region;
    rep.regionPax[ra] += pax;
    if (rb !== ra) rep.regionPax[rb] += pax;
    if (isPacific(a, b)) rep.pacificPax += pax;
    if (isResort(a) || isResort(b)) rep.resortPax += pax;
    if (c.hub === a || c.hub === b) rep.hubPax += pax;
    const profit = revenue - cost.total;
    if (planes.some((p) => p.model.body === 'sst')) rep.sstProfit += profit;
    const leisureQ = run.leisure * WEEKS;
    arrivals[ci].set(a, (arrivals[ci].get(a) ?? 0) + leisureQ);
    arrivals[ci].set(b, (arrivals[ci].get(b) ?? 0) + leisureQ);
    routeStats[ci].set(run.route.id, {
      lf: run.seats > 0 ? paxWeek / run.seats : 0,
      pax,
      revenue,
      profit,
      share: run.share,
      xfer: run.xfer,
      xferRev: run.xferRev,
    });
    routeReports.push({ company: ci, route: run.route.id, a, b, pax, seats: run.seats * 2 * WEEKS, revenue, cost: cost.total, profit });
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
    // 노선 보조금: 그 도시를 오가는 노선을 날고 있으면
    for (const m of c.mods) {
      if (m.kind !== 'subsidy' || !active(m, state.q) || !m.city) continue;
      if (c.routes.some((r) => (r.a === m.city || r.b === m.city) && routeFreq(c, r.id) > 0)) rep.side += m.value;
    }
    const before =
      rep.ticket + rep.side - rep.fuel - rep.crew - rep.airport - rep.service - rep.sales - rep.lease - rep.fleet - rep.branch - rep.ads - rep.interest;
    rep.tax = Math.max(0, before) * TAX_RATE;
    rep.profit = before - rep.tax;
  }
  return { reports, routes: routeReports, routeStats, xfers: xfers.slice(0, 60) };
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
