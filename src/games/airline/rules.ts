import { withJosa } from '../../lib/korean';
import { MODEL, MODELS, isAvailable, leadTime } from './aircraft';
import { CAMPAIGN_INFO, MEDIA_INFO, adTarget, mediaOf } from './ads';
import { BUSINESS_INFO } from './business';
import { cabinBlocker, defaultCabin, sameCabin } from './cabin';
import { BIZ_CHANGE_MONTHS, BIZ_INFO, assignBizModels, bizCabinBlocker, bizChangeCost, bizModelBlocker, bizModelFit, bizModelOf, cabinFor, settleBizModel } from './bizmodel';
import { CLASS_FARE_MAX, CLASS_FARE_MIN } from './classes';
import { blockText, branchPolitics, makerPolitics, politicalNews, polity, routePolitics } from './politics';
import { AIRLINE_AWARD_DEMAND, AIRLINE_AWARD_MONTHS, AWARD_INFO, yearAwards } from './awards';
import { charterBlocker, charterPlaneIds, refreshCharters, tripsFor } from './charters';
import { CHALLENGE, challengeDeadline, checkChallenge } from './challenges';
import { CHECK_POLICIES, condOf, dueForCheck, inCheck, monthlyWear, restoredCond, usedCond } from './condition';
import { FACILITY_INFO, FACILITY_REFUND, companyCheckCost, extraCheckSlots, facilityBlocker, facilityCost, wearMult } from './facilities';
import { allianceChoice, allianceScore, makeChoice, nextChoiceGap } from './choices';
import { autoAirline, gameHub, pickColors } from './brand';
import { AIRPORT_INFO, CITIES, CITY, REGIONS, REGION_INFO, airportClass, citySize, dist, pairKey } from './cities';
import { WEATHER_INFO, type WeatherCause } from './calendar';
import { FIXED_EVENTS, FIXED_ICON, fixedEventsAt, historicOil, historyAt, rollRandomEvent } from './events';
import { FUEL_SELL_RATE, TANK_LEVELS, addFuel, autoBuyTons, buyFuelBlocker, fuelCost, sellFuelBlocker, tankBlocker, tankOf } from './fuel';
import { addMonth, closeQuarter, freshAcc, goalMet, gradeYear, newGoals } from './goals';
import { MAX_PLANES, MAX_ROUTES } from './limits';
import { REAL_AIRLINE, airlinesAt } from './realAirlines';
import { ACADEMY_COST, PAY_MAX, PAY_MIN, STAFF_GROUPS, STAFF_INFO, emptyStaff, fireCost, hireCost, hireTime, moraleTarget, staffCap, staffNeed, staffPipe, staffTotal } from './staff';
import { bandCaps, bandCounts, bandUsed, defaultTimes, routeCurfew } from './timetable';
import {
  LEASE_RATE,
  MAX_DELIVERIES,
  adScale,
  branchCost,
  businessCost,
  companyValue,
  computeMonth,
  creditLimit,
  emptyReport,
  sumReports,
  legFreq,
  leaseDeposit,
  leaseRent,
  maxFreq,
  maxFreqFor,
  orderPrice,
  planeAge,
  planeHours,
  planeValue,
  regionsServed,
  reputationTarget,
  routeFreq,
  routeIndex,
  routeOf,
  sellPrice,
  slotCapacity,
  slotsUsed,
} from './simulate';
import { isQuarterEnd, mLabel, mOf, monthOf, qLabel, qOfM, yearOf, yearOfM } from './time';
import type {
  AdMedia,
  AirlineAction,
  AirlineOptions,
  AirlineSetup,
  AirlineState,
  BusinessKind,
  Cabin,
  CampaignKind,
  Choice,
  Company,
  DistOmit,
  Effect,
  GameEvent,
  GameResult,
  NewsItem,
  Plane,
  QuarterReport,
  RegionId,
  Rng,
  Route,
  RouteReport,
  SeatIndex,
  StaffGroup,
} from './types';

export { MAX_PLANES, MAX_ROUTES };

export const DEFAULT_OPTIONS: AirlineOptions = {
  era: 1983,
  mode: 'years',
  years: 20,
  goalValue: 20000,
  goalRegions: 6,
  money: 'normal',
  challenge: null,
  aiStyle: 'normal',
  names: 'real',
  history: true,
};

/** 실제 역사(냉전·국교·큰 사건)를 따르는지 */
export const historyOn = (state: Pick<AirlineState, 'options'>) => state.options.history !== false;

export const START_MONEY: Record<AirlineOptions['money'], { cash: number; name: string }> = {
  rich: { cash: 4000, name: '넉넉하게' },
  normal: { cash: 2500, name: '보통' },
  tight: { cash: 1500, name: '빠듯하게' },
};

export const GOAL_VALUES = [10000, 20000, 50000] as const;

/** 자리마다 정해진 회사 이름 (이름을 비워 두면) */
export const DEFAULT_NAMES = ['노을항공', '바람길항공', '햇살항공', '푸른하늘항공'] as const;

/** 목표 먼저 이루기에서 너무 오래 걸리면 이 해 수가 지나서 가치 1등이 이긴다 */
export const GOAL_YEAR_LIMIT = 40;

export const FARE_MIN = -30;
export const FARE_MAX = 30;
export const ADS_MAX = 100;
/** 주문을 취소하면 낸 값의 70%만 돌려받는다 */
export const CANCEL_REFUND = 0.7;

/** 회사 이름: 비어 있으면 정해진 이름, '항공'으로 끝나지 않으면 붙인다 */
export function companyName(name: string, seat: number): string {
  const n = name.trim();
  if (!n) return DEFAULT_NAMES[seat];
  return n.endsWith('항공') ? n : `${n}항공`;
}

export function emptyRegions(v = 0): Record<RegionId, number> {
  return { eastasia: v, seaoc: v, southmid: v, europe: v, africa: v, americas: v };
}

/** 본사로 고를 수 있는 도시 (그 해 공항이 중간 이상이고 너무 작지 않은 곳) */
export function hubCandidates(year: number): string[] {
  return CITIES.filter((c) => airportClass(c, year) >= 2 && citySize(c, year) >= 2.5).map((c) => c.id);
}

/** 컴퓨터(또는 고르지 않은 사람)의 본사를 고른다: 큰 도시일수록 자주, 남과 같은 지역은 덜 */
export function autoHub(year: number, taken: readonly string[], rng: Rng): string {
  const cands = hubCandidates(year).filter((id) => !taken.includes(id));
  const takenRegions = taken.map((id) => CITY[id].region);
  // 냉전 동안 하늘길이 거의 막힌 곳은 덜 고른다
  const closed = (id: string) => year < 1990 && ['중국', '소련', '베트남'].includes(polity(id, year));
  const weights = cands.map((id) => {
    const c = CITY[id];
    const s = citySize(c, year);
    return s * s * (takenRegions.includes(c.region) ? 0.35 : 1) * (s >= 5 ? 1 : 0.3) * (closed(id) ? 0.1 : 1);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < cands.length; i++) {
    r -= weights[i];
    if (r <= 0) return cands[i];
  }
  return cands[cands.length - 1];
}

function newCompany(seat: SeatIndex, kind: Company['kind'], name: string, hub: string, cash: number, credit: number, year: number): Company {
  const awareness = emptyRegions();
  awareness[CITY[hub].region] = 0.3;
  return {
    seat,
    kind,
    name,
    hub,
    cash,
    debt: 0,
    baseCredit: credit,
    branches: [hub],
    routes: [],
    planes: [],
    ads: emptyRegions(),
    awareness,
    service: 3,
    reputation: 50,
    businesses: [],
    out: false,
    crisis: 0,
    stats: { pax: 0, bestProfit: 0, bought: 0, opened: 0, profitStreak: 0 },
    orders: [],
    mods: [],
    choice: null,
    nextChoiceT: 0,
    partner: null,
    goals: [],
    acc: { year, pax: 0, seats: 0, xfer: 0, revenue: 0, profit: 0, profitQ: 0, qProfit: 0, quarters: 0, bought: 0, startValue: cash, startRegions: 0, startRoutes: 0, lastPax: 0 },
    reviews: [],
    taken: 0,
    lastProposal: -99,
    airline: null,
    color: null,
    maint: 3,
    crewReserve: 1,
    onTime: 0.85,
    staff: emptyStaff(),
    morale: 65,
    academy: false,
    shock: 0,
    bizModel: 'full',
  };
}

function baseState(options: AirlineOptions, year: number, companies: Company[]): AirlineState {
  const t = mOf(year, 1);
  const q = qOfM(t);
  return {
    version: 4,
    options,
    startYear: year,
    t,
    startT: t,
    q,
    startQ: q,
    phase: 'manage',
    companies,
    order: companies.map((_, i) => i),
    turnPos: 0,
    oil: options.history !== false ? historicOil(year) : 1,
    rate: 6,
    effects: [],
    slotBoost: {},
    market: [],
    priceWars: [],
    news: [],
    history: [],
    months: [],
    report: null,
    qReport: null,
    ledger: [],
    years: [],
    nextId: 1,
    result: null,
    challenge: null,
    events: [],
    nextEventId: 1,
    log: [],
    nextLogId: 1,
  };
}

/** 새 게임 */
export function createGame(setup: AirlineSetup, rng: Rng = Math.random): AirlineState {
  const opts: AirlineOptions = { ...DEFAULT_OPTIONS, ...setup.options };
  if (opts.mode === 'challenge' && opts.challenge && CHALLENGE[opts.challenge]) return createChallenge(setup, opts, rng);
  if (opts.mode === 'challenge') opts.mode = 'years';
  const year = opts.era;
  const cash = START_MONEY[opts.money].cash;
  const taken: string[] = [];
  const active = setup.seats.map((s, i) => ({ s, i })).filter((x) => x.s.kind !== 'empty');
  const hubs = new Map<number, string>();
  const airlines = new Map<number, string>();
  const valid = hubCandidates(year);
  const real = opts.names === 'real';
  // 1) 사람이 고른 실제 항공사 (그 해에 날고, 아직 아무도 안 고른 것만)
  if (real) {
    const flying = new Set(airlinesAt(year).map((a) => a.id));
    for (const { i } of active) {
      const id = setup.airlines?.[i];
      if (id && flying.has(id) && ![...airlines.values()].includes(id)) airlines.set(i, id);
    }
  }
  // 2) 사람이 고른 본사, 고른 항공사의 본거지
  for (const { i } of active) {
    const h = setup.hubs[i];
    if (h && valid.includes(h) && !taken.includes(h)) {
      hubs.set(i, h);
      taken.push(h);
    }
  }
  for (const { i } of active) {
    const id = airlines.get(i);
    if (hubs.has(i) || !id) continue;
    const h = gameHub(REAL_AIRLINE[id], valid, taken);
    if (h) {
      hubs.set(i, h);
      taken.push(h);
    }
  }
  // 3) 나머지: 실제 항공사 모드면 항공사와 본거지를 함께, 아니면 본사만
  for (const { i } of active) {
    if (hubs.has(i) && (!real || airlines.has(i))) continue;
    if (real && !airlines.has(i)) {
      const pick = autoAirline(year, valid, [...airlines.values()], hubs.has(i) ? taken.filter((h) => h !== hubs.get(i)) : taken, (c) => citySize(CITY[c], year), rng);
      if (pick) {
        airlines.set(i, pick.airline.id);
        if (!hubs.has(i)) {
          hubs.set(i, pick.hub);
          taken.push(pick.hub);
        }
        continue;
      }
    }
    if (hubs.has(i)) continue;
    const h = autoHub(year, taken, rng);
    hubs.set(i, h);
    taken.push(h);
  }
  const colors = pickColors(active.map(({ i }) => ({ seat: i, airline: airlines.get(i) ?? null })));
  const companies = active.map(({ s, i }, k) => {
    const id = airlines.get(i) ?? null;
    const c = newCompany(i as SeatIndex, s.kind as Company['kind'], id ? REAL_AIRLINE[id].name : companyName(s.name, i), hubs.get(i)!, cash, Math.round(cash * 0.5), year);
    c.airline = id;
    c.color = colors[k];
    return c;
  });
  // 사업 모델 (고른 대로, 가끔 컴퓨터 하나는 저가항공·화물 전문: bizmodel.ts)
  assignBizModels(companies, setup, year, rng);
  let state = baseState(opts, year, companies);
  state = addNews(state, {
    icon: '✈️',
    title: `${year}년, 하늘길 경영을 시작해요`,
    text: `하늘을 두고 겨루는 회사: ${companies.map((c) => `${c.name}(본사 ${CITY[c.hub].name}${c.bizModel !== 'full' ? `, ${BIZ_INFO[c.bizModel].name}` : ''})`).join(', ')}${companies.some((c) => c.airline && c.bizModel !== 'full') ? ' (사업 모델은 게임 속 이야기)' : ''}`,
    tone: 'big',
  });
  state = announceYear(state);
  return finishStart(state, rng);
}

function createChallenge(setup: AirlineSetup, opts: AirlineOptions, rng: Rng): AirlineState {
  const def = CHALLENGE[opts.challenge!];
  // 도전하는 회사: 사람 자리 (사람이 없으면 첫 자리, 컴퓨터끼리 시험할 때)
  const humanSeat = setup.seats.findIndex((s) => s.kind === 'human');
  const seat = humanSeat >= 0 ? humanSeat : Math.max(0, setup.seats.findIndex((s) => s.kind !== 'empty'));
  const kind = (setup.seats[seat]?.kind === 'empty' ? 'human' : (setup.seats[seat]?.kind ?? 'human')) as Company['kind'];
  const me = newCompany(0, kind, companyName(setup.seats[seat]?.name ?? '', 0), def.hub, def.cash, def.credit ?? Math.round(def.cash * 0.5), def.year);
  me.debt = def.debt ?? 0;
  if (def.branches) me.branches = [...new Set([def.hub, ...def.branches])];
  const rivals = def.rivals.map((r, k) => newCompany((k + 1) as SeatIndex, r.kind, DEFAULT_NAMES[k + 1], r.hub, 2500, 1250, def.year));
  // 실제 항공사 모드: 라이벌 본거지에 그 해 날던 실제 항공사가 있으면 그 이름으로
  if (opts.names === 'real') {
    const used: string[] = [];
    for (const rv of rivals) {
      const a = airlinesAt(def.year).find((x) => x.hub === rv.hub && !used.includes(x.id));
      if (!a) continue;
      used.push(a.id);
      rv.airline = a.id;
      rv.name = a.name;
    }
    const colors = pickColors([me, ...rivals].map((c) => ({ seat: c.seat, airline: c.airline })));
    [me, ...rivals].forEach((c, k) => (c.color = colors[k]));
  }
  let state = baseState({ ...opts, era: opts.era }, def.year, [me, ...rivals]);
  // 처음 비행기와 노선
  if (def.fleet) {
    const c = me;
    for (const f of def.fleet) {
      const m = MODEL[f.model];
      let routeId: number | null = null;
      if (f.route) {
        const [a, b] = f.route;
        let r = c.routes.find((x) => pairKey(x.a, x.b) === pairKey(a, b));
        if (!r) {
          r = { id: state.nextId++, a, b, fare: f.fare ?? 0, since: state.t, stats: null, times: defaultTimes(a, b, def.year) };
          c.routes.push(r);
        }
        routeId = r.id;
      }
      c.planes.push({
        id: state.nextId++,
        model: m.id,
        leased: !!f.leased,
        rent: f.leased ? Math.round(m.price * LEASE_RATE * 10) / 10 : 0,
        deposit: 0,
        since: state.t - Math.round(f.age * 12),
        legs: routeId !== null ? [{ route: routeId, freq: Math.min(f.freq ?? 7, maxFreq(m, dist(f.route![0], f.route![1]))) }] : [],
        cabin: defaultCabin(m),
        meal: c.service,
        cond: usedCond(f.age),
      });
    }
  }
  if (def.oil) state.oil = def.oil;
  state = addNews(state, { icon: def.emoji, title: `도전 과제: ${def.title}`, text: `${def.story} 목표: ${def.goal}`, tone: 'big' });
  state = announceYear(state);
  const startValue = Math.round(companyValue(state, 0));
  state = {
    ...state,
    challenge: { id: def.id, company: 0, deadline: challengeDeadline(def) * 3 + 2, progress: '첫 분기 결산을 기다리고 있어요', ratio: 0, streak: 0, startValue },
  };
  return finishStart(state, rng);
}

/** 첫 분기 준비: 올해 목표, 중고 시장, 첫 결정 사건 날짜, 그래프 시작점 */
function finishStart(state: AirlineState, rng: Rng): AirlineState {
  let s = state;
  const year = yearOf(s.q);
  s = {
    ...s,
    companies: s.companies.map((c, ci) => {
      // 비행기를 가지고 시작하는 회사(도전 과제)는 일손도 갖춰 둔다
      const need = staffNeed(s, c);
      const staff = { ...c.staff };
      for (const g of STAFF_GROUPS) staff[g] = { ...staff[g], have: Math.max(staff[g].have, Math.ceil(need[g] * 1.08)) };
      return {
        ...c,
        staff,
        acc: freshAcc(s, ci, year, 0),
        goals: newGoals(s, ci, rng),
        nextChoiceT: s.t + 5 + (ci % 3) * 2,
      };
    }),
  };
  s = refreshMarket(s, rng, true);
  s = { ...s, history: [historyPoint(s, s.q - 1)], months: [monthPoint(s, s.t - 1, null)] };
  s = addLog(s, null, `🛫 ${mLabel(s.t)}: ${s.companies.map((c) => c.name).join(', ')} 출발!`);
  return { ...s, events: [{ id: s.nextEventId, type: 'start' }, { id: s.nextEventId + 1, type: 'turn', company: s.order[0] }], nextEventId: s.nextEventId + 2 };
}

// ------------------------------------------------------------------ 기록

export function addLog(state: AirlineState, seat: SeatIndex | null, text: string): AirlineState {
  const log = [...state.log, { id: state.nextLogId, seat, text }];
  return { ...state, log: log.length > 80 ? log.slice(-80) : log, nextLogId: state.nextLogId + 1 };
}

export function addNews(state: AirlineState, item: Omit<NewsItem, 'id' | 't'>): AirlineState {
  const news = [...state.news, { ...item, id: state.nextId, t: state.t }];
  return { ...state, news: news.length > 70 ? news.slice(-70) : news, nextId: state.nextId + 1 };
}

function historyPoint(state: AirlineState, q: number, report?: QuarterReport) {
  return {
    q,
    value: state.companies.map((_, i) => Math.round(companyValue(state, i))),
    profit: state.companies.map((_, i) => Math.round(report?.companies[i]?.profit ?? 0)),
    pax: state.companies.map((_, i) => Math.round(report?.companies[i]?.pax ?? 0)),
  };
}

// ------------------------------------------------------------------ 조회

/** 지금 경영하는 회사 (끝났으면 −1) */
export function actor(state: AirlineState): number {
  if (state.phase === 'gameover') return -1;
  return state.order[state.turnPos] ?? -1;
}

export function companyOf(state: AirlineState, ci: number): Company {
  return state.companies[ci];
}

export function planeById(c: Company, id: number): Plane | undefined {
  return c.planes.find((p) => p.id === id);
}

export function routeById(c: Company, id: number): Route | undefined {
  return routeOf(c, id);
}

export function hasBranch(c: Company, city: string): boolean {
  return c.branches.includes(city);
}

export function routeOnPair(c: Company, a: string, b: string): Route | undefined {
  return routeIndex(c).get(pairKey(a, b));
}

/** 순위 (회사 가치 순, 파산한 회사는 뒤로) */
export function rankings(state: AirlineState): number[] {
  return state.companies
    .map((c, i) => ({ i, v: c.out ? -Infinity : companyValue(state, i) }))
    .sort((x, y) => y.v - x.v)
    .map((x) => x.i);
}

/** 지금 해 */
export const yearNow = (state: AirlineState) => yearOf(state.q);

/** 끝나는 달 (이 달 결산이 마지막) */
export function endT(state: AirlineState): number {
  if (state.options.mode === 'years') return state.startT + state.options.years * 12 - 1;
  if (state.options.mode === 'challenge' && state.challenge) return state.challenge.deadline;
  return state.startT + GOAL_YEAR_LIMIT * 12 - 1;
}

/** 끝나는 분기 */
export function endQ(state: AirlineState): number {
  return qOfM(endT(state));
}

/** 첫해에는 사람 회사의 리스 보증금을 받지 않는다 (처음 하는 사람 돕기) */
export function firstYearHelp(state: AirlineState, ci: number): boolean {
  return state.companies[ci].kind === 'human' && state.t < state.startT + 12 && state.options.mode !== 'challenge';
}

/** 지금 리스할 때 내는 보증금 */
export function depositFor(state: AirlineState, ci: number, modelId: string): number {
  return firstYearHelp(state, ci) ? 0 : leaseDeposit(state, MODEL[modelId]);
}

// ------------------------------------------------------------------ 할 수 있는지 (못 하면 이유)

export const fmtMoney = (v: number): string => {
  const r = Math.round(v);
  if (Math.abs(r) >= 10000) return `${(r / 10000).toFixed(Math.abs(r) >= 100000 ? 0 : 1).replace(/\.0$/, '')}조`;
  return `${r.toLocaleString('ko-KR')}억`;
};

/** 작은 돈까지 읽기 좋게: '1,040만 원', '2.4억', '120억' */
export function fmtFine(v: number): string {
  const a = Math.abs(v);
  if (a < 1) return `${Math.round(v * 10000).toLocaleString('ko-KR')}만 원`;
  if (a < 10) return `${(Math.round(v * 10) / 10).toLocaleString('ko-KR')}억`;
  return fmtMoney(v);
}

export function branchBlocker(state: AirlineState, ci: number, city: string): string | null {
  const c = state.companies[ci];
  if (!CITY[city]) return '없는 도시예요';
  if (hasBranch(c, city)) return '이미 지점이 있어요';
  const pol = historyOn(state) ? branchPolitics(c.hub, city, yearNow(state)) : null;
  if (pol) return blockText(pol);
  const cost = branchCost(city, state.q);
  if (c.cash < cost) return `돈이 모자라요 (${fmtMoney(cost)} 필요)`;
  return null;
}

export function closeBranchBlocker(state: AirlineState, ci: number, city: string): string | null {
  const c = state.companies[ci];
  if (!hasBranch(c, city)) return '지점이 없어요';
  if (c.hub === city) return '본사는 닫을 수 없어요';
  if (c.routes.some((r) => r.a === city || r.b === city)) return '이 도시를 오가는 노선을 먼저 닫아요';
  if (c.businesses.some((b) => b.city === city)) return '이 도시의 부대사업을 먼저 팔아요';
  if ((c.facilities ?? []).some((f) => f.city === city)) return '이 공항의 시설을 먼저 팔아요';
  return null;
}

/** 지금 살 수 있거나 가진 비행기 가운데 가장 먼 항속 거리 */
export function maxRangeNow(state: AirlineState, ci: number): number {
  const year = yearNow(state);
  let best = 0;
  for (const m of MODELS) if (isAvailable(m, year)) best = Math.max(best, m.range);
  for (const p of state.companies[ci].planes) best = Math.max(best, MODEL[p.model].range);
  return best;
}

export function routeBlocker(state: AirlineState, ci: number, a: string, b: string): string | null {
  const c = state.companies[ci];
  if (!CITY[a] || !CITY[b]) return '없는 도시예요';
  if (a === b) return '같은 도시예요';
  if (!hasBranch(c, a)) return `${CITY[a].name}에 지점이 없어요`;
  if (!hasBranch(c, b)) return `${CITY[b].name}에 지점이 없어요`;
  if (routeOnPair(c, a, b)) return '이미 있는 노선이에요';
  if (c.routes.length >= MAX_ROUTES) return `노선은 ${MAX_ROUTES}개까지예요`;
  const pol = historyOn(state) ? routePolitics(c.hub, a, b, yearNow(state)) : null;
  if (pol) return blockText(pol);
  const d = dist(a, b);
  if (d < 150) return '너무 가까워요';
  if (d > maxRangeNow(state, ci)) return `${d.toLocaleString()}km를 한 번에 날 수 있는 비행기가 없어요`;
  return null;
}

/** 이번 달에 바로 받은 비행기 수 (리스 + 중고) */
export function deliveriesThisQuarter(state: AirlineState, ci: number): number {
  return state.companies[ci].taken;
}

/** 비행기 수 (기다리는 주문 포함) */
export const fleetCount = (c: Company) => c.planes.length + c.orders.length;

/** 좌석 배치를 바꾸는 값: 우리 회사에 온 달에는 공짜, 그 뒤에는 새 비행기 값의 2% (같은 배치면 0) */
export function refitCost(state: Pick<AirlineState, 't'>, p: Plane, cabin: Cabin): number {
  if (sameCabin(p.cabin, cabin)) return 0;
  if ((p.got ?? p.since) === state.t) return 0;
  return Math.max(1, Math.round(MODEL[p.model].price * REFIT_RATE));
}
export const REFIT_RATE = 0.02;

/** 배치를 바꿀 비행기들 (all이면 같은 기종 모두, 이미 같은 배치는 뺀다) */
export function cabinTargets(c: Company, p: Plane, cabin: Cabin, all: boolean): Plane[] {
  return (all ? c.planes.filter((x) => x.model === p.model) : [p]).filter((x) => !sameCabin(x.cabin, cabin));
}

/** 좌석 배치를 바꿀 수 없는 까닭 (바꿀 수 있으면 null) */
export function cabinChangeBlocker(state: AirlineState, ci: number, planeId: number, cabin: Cabin, all = false): string | null {
  const c = state.companies[ci];
  const p = c.planes.find((x) => x.id === planeId);
  if (!p) return '없는 비행기예요';
  const why = cabinBlocker(MODEL[p.model], cabin) ?? bizCabinBlocker(c, cabin);
  if (why) return why;
  const targets = cabinTargets(c, p, cabin, all);
  if (targets.length === 0) return '지금과 같은 배치예요';
  const cost = targets.reduce((sum, x) => sum + refitCost(state, x, cabin), 0);
  if (cost > c.cash) return `돈이 모자라요 (${fmtMoney(cost)} 필요)`;
  return null;
}

/** 이 비행기를 이번 달 C점검에 보낼 수 없는 까닭 */
export function checkBlocker(state: AirlineState, ci: number, planeId: number): string | null {
  const c = state.companies[ci];
  const p = c.planes.find((x) => x.id === planeId);
  if (!p) return '없는 비행기예요';
  if (inCheck(p, state.t)) return '이번 달 이미 점검해요';
  if (condOf(p) >= 92) return '아직 상태가 좋아요';
  const cost = companyCheckCost(c, p);
  if (c.cash < cost) return `돈이 모자라요 (${fmtMoney(cost)} 필요)`;
  return null;
}

/** 캠페인 값 (광고 규모에 따라) */
export function campaignCost(state: Pick<AirlineState, 'q'>, kind: CampaignKind): number {
  return Math.round(CAMPAIGN_INFO[kind].costK * adScale(state.q));
}

/** 캠페인을 벌일 수 없는 까닭 */
export function campaignBlocker(state: AirlineState, ci: number, kind: CampaignKind, region?: RegionId): string | null {
  const c = state.companies[ci];
  const info = CAMPAIGN_INFO[kind];
  if (!info) return '없는 캠페인이에요';
  if (yearNow(state) < info.from) return `${info.from}년부터 할 수 있어요`;
  if (c.lastCampaign !== undefined && qOfM(c.lastCampaign) === state.q) return '캠페인은 한 분기에 하나만 해요';
  if (info.region && (!region || !REGIONS.includes(region))) return '지역을 골라요';
  const cost = campaignCost(state, kind);
  if (c.cash < cost) return `돈이 모자라요 (${fmtMoney(cost)} 필요)`;
  return null;
}

/** 새 비행기 주문(lease=false) 또는 리스(lease=true)를 할 수 있는지 */
export function buyBlocker(state: AirlineState, ci: number, modelId: string, lease: boolean): string | null {
  const c = state.companies[ci];
  const m = MODEL[modelId];
  if (!m) return '없는 기종이에요';
  const fit = bizModelFit(c, m);
  if (fit) return fit;
  if (!isAvailable(m, yearNow(state))) return yearNow(state) < m.intro ? `${m.intro}년에 나와요` : '생산이 끝난 기종이에요';
  if (fleetCount(c) >= MAX_PLANES) return `비행기는 주문까지 ${MAX_PLANES}대까지예요`;
  const pol = historyOn(state) ? makerPolitics(c.hub, m, yearNow(state)) : null;
  if (pol) return pol;
  if (lease && c.taken >= MAX_DELIVERIES) return `리스·중고는 한 달에 ${MAX_DELIVERIES}대까지예요`;
  const cost = lease ? depositFor(state, ci, modelId) : orderPrice(state, m, c);
  if (c.cash < cost) return `돈이 모자라요 (${fmtMoney(cost)} 필요)`;
  return null;
}

export function usedBlocker(state: AirlineState, ci: number, listing: number): string | null {
  const c = state.companies[ci];
  const u = state.market.find((x) => x.id === listing);
  if (!u) return '이미 팔린 비행기예요';
  const fit = bizModelFit(c, MODEL[u.model]);
  if (fit) return fit;
  if (fleetCount(c) >= MAX_PLANES) return `비행기는 주문까지 ${MAX_PLANES}대까지예요`;
  const pol = historyOn(state) ? makerPolitics(c.hub, MODEL[u.model], yearNow(state)) : null;
  if (pol) return pol;
  if (c.taken >= MAX_DELIVERIES) return `리스·중고는 한 달에 ${MAX_DELIVERIES}대까지예요`;
  if (c.cash < u.price) return `돈이 모자라요 (${fmtMoney(u.price)} 필요)`;
  return null;
}

/** 리스기를 돌려줄 때 오가는 돈 (보증금 − 위약금 한 분기 치). 내 비행기는 판 값 */
export function sellAmount(state: AirlineState, p: Plane): number {
  return p.leased ? p.deposit - p.rent : sellPrice(state, p);
}

export function sellBlocker(state: AirlineState, ci: number, planeId: number): string | null {
  const c = state.companies[ci];
  const p = planeById(c, planeId);
  if (!p) return '없는 비행기예요';
  if (charterPlaneIds(state, ci).has(p.id)) return '이번 달 전세기로 나가요';
  const amount = sellAmount(state, p);
  if (amount < 0 && c.cash < -amount) return `반납 위약금 ${fmtMoney(-amount)}이 모자라요`;
  return null;
}

/** 이 비행기를 이 노선에 이 횟수로 띄울 수 있는지 (다른 노선을 나는 시간은 빼고) */
export function assignBlocker(state: AirlineState, ci: number, planeId: number, routeId: number, freq: number): string | null {
  const c = state.companies[ci];
  const p = planeById(c, planeId);
  const r = routeById(c, routeId);
  if (!p) return '없는 비행기예요';
  if (!r) return '없는 노선이에요';
  if (charterPlaneIds(state, ci).has(p.id)) return '이번 달 전세기로 나가요';
  const m = MODEL[p.model];
  const d = dist(r.a, r.b);
  const fit = bizModelFit(c, m);
  if (fit) return fit;
  if (m.range < d) return `항속 거리가 모자라요 (${m.range.toLocaleString()}km < ${d.toLocaleString()}km)`;
  const year = yearNow(state);
  for (const city of [r.a, r.b]) {
    const cls = airportClass(CITY[city], year);
    if (cls < m.runway) return `${CITY[city].name} 공항(${AIRPORT_INFO[cls].name})에는 ${m.name}이 못 내려요`;
  }
  if (!Number.isInteger(freq) || freq < 1) return '횟수는 1 이상이에요';
  const max = maxFreqFor(c, p, routeId);
  if (max < 1) return '이 비행기는 비행시간이 남지 않았어요';
  if (freq > max) return `이 비행기는 남은 비행시간으로 이 노선을 한 주에 ${max}번까지 왕복해요`;
  for (const city of [r.a, r.b]) {
    const left = slotCapacity(state, ci, city) - slotsUsed(c, city, { plane: p.id, route: routeId });
    if (freq > left) return `${CITY[city].name} 슬롯이 모자라요 (남은 ${Math.max(0, left)}회)`;
  }
  return null;
}

/** 이 비행기를 이 노선에 띄울 때 고를 수 있는 가장 큰 횟수 (못 띄우면 0) */
export function bestFreq(state: AirlineState, ci: number, planeId: number, routeId: number): number {
  const c = state.companies[ci];
  const p = planeById(c, planeId);
  const r = routeById(c, routeId);
  if (!p || !r) return 0;
  const m = MODEL[p.model];
  if (m.range < dist(r.a, r.b) || bizModelFit(c, m)) return 0;
  const year = yearNow(state);
  if (airportClass(CITY[r.a], year) < m.runway || airportClass(CITY[r.b], year) < m.runway) return 0;
  let f = maxFreqFor(c, p, routeId);
  if (f < 1) return 0;
  for (const city of [r.a, r.b]) f = Math.min(f, slotCapacity(state, ci, city) - slotsUsed(c, city, { plane: p.id, route: routeId }));
  return f >= 1 ? f : 0;
}

export function borrowBlocker(state: AirlineState, ci: number, amount: number): string | null {
  const c = state.companies[ci];
  if (!(amount > 0)) return '빌릴 돈을 정해요';
  const left = creditLimit(state, ci) - c.debt;
  if (amount > left + 0.001) return `대출 한도를 넘어요 (남은 한도 ${fmtMoney(Math.max(0, left))})`;
  return null;
}

export function repayBlocker(state: AirlineState, ci: number, amount: number): string | null {
  const c = state.companies[ci];
  if (!(amount > 0)) return '갚을 돈을 정해요';
  if (c.debt <= 0) return '갚을 빚이 없어요';
  if (amount > c.debt + 0.001) return '빚보다 많이 갚을 수 없어요';
  if (amount > c.cash + 0.001) return '현금이 모자라요';
  return null;
}

export function buildBlocker(state: AirlineState, ci: number, city: string, kind: BusinessKind): string | null {
  const c = state.companies[ci];
  if (!CITY[city]) return '없는 도시예요';
  if (!hasBranch(c, city)) return '지점이 있는 도시에만 지어요';
  if (!BUSINESS_INFO[kind]) return '없는 사업이에요';
  if (c.businesses.some((b) => b.city === city && b.kind === kind)) return '이미 있어요';
  const why = BUSINESS_INFO[kind].why(CITY[city], citySize(CITY[city], yearNow(state)));
  if (why) return why;
  const cost = businessCost(city, kind, state.q);
  if (c.cash < cost) return `돈이 모자라요 (${fmtMoney(cost)} 필요)`;
  return null;
}

export function hireBlocker(state: AirlineState, ci: number, group: StaffGroup, n: number, fast: boolean): string | null {
  const c = state.companies[ci];
  if (!STAFF_GROUPS.includes(group)) return '없는 직원 그룹이에요';
  if (!Number.isInteger(n) || n < 1 || n > 400) return '1~400명까지 뽑을 수 있어요';
  const cost = hireCost(state, c, group, n, fast);
  if (c.cash < cost) return `돈이 모자라요 (${fmtFine(cost)} 필요)`;
  return null;
}

export function fireBlocker(state: AirlineState, ci: number, group: StaffGroup, n: number): string | null {
  const c = state.companies[ci];
  if (!STAFF_GROUPS.includes(group)) return '없는 직원 그룹이에요';
  if (!Number.isInteger(n) || n < 1) return '1명 넘게 골라요';
  if (n > c.staff[group].have) return '그만큼 일하는 사람이 없어요';
  const cost = fireCost(state, c, group, n);
  if (c.cash < cost) return `돈이 모자라요 (${fmtFine(cost)} 필요)`;
  return null;
}

export function academyBlocker(state: AirlineState, ci: number): string | null {
  const c = state.companies[ci];
  if (c.academy) return '이미 훈련원이 있어요';
  if (c.cash < ACADEMY_COST) return `돈이 모자라요 (${fmtMoney(ACADEMY_COST)} 필요)`;
  return null;
}

/**
 * 노선 시간대를 바꿀 수 있는지: 밤 운항 금지 공항이면 밤은 0, 시간대마다 두 공항 슬롯 안에서.
 */
export function timesBlocker(state: AirlineState, ci: number, routeId: number, times: readonly number[]): string | null {
  const c = state.companies[ci];
  const r = routeById(c, routeId);
  if (!r) return '없는 노선이에요';
  if (times.length !== 4 || times.some((x) => !Number.isFinite(x) || x < 0) || times.every((x) => x <= 0)) return '시간대를 하나 넘게 골라요';
  const year = yearNow(state);
  if (times[3] > 0 && routeCurfew(r.a, r.b, year)) return '밤 운항을 막는 공항이에요';
  const total = routeFreq(c, r.id);
  const counts = bandCounts(times, total);
  const freqOf = (id: number) => routeFreq(c, id);
  for (const city of [r.a, r.b]) {
    const cap = bandCaps(state, ci, city, slotCapacity(state, ci, city));
    const used = bandUsed(c, city, freqOf, r.id);
    for (let i = 0; i < 4; i++) {
      if (counts[i] > 0 && used[i] + counts[i] > cap[i]) return `${CITY[city].name} ${['아침', '낮', '저녁', '밤'][i]} 슬롯이 모자라요 (남은 ${Math.max(0, cap[i] - used[i])}회)`;
    }
  }
  return null;
}

export function proposeBlocker(state: AirlineState, ci: number, to: number): string | null {
  const c = state.companies[ci];
  const t = state.companies[to];
  if (!t || to === ci) return '제휴할 회사를 골라요';
  if (t.out) return '운항을 멈춘 회사예요';
  if (bizModelOf(c) === 'lcc' || bizModelOf(t) === 'lcc') return '저가항공은 제휴(코드셰어)를 하지 않아요';
  if (c.partner !== null) return '이미 제휴한 회사가 있어요';
  if (t.partner !== null) return `${withJosa(t.name, '은/는')} 다른 회사와 제휴 중이에요`;
  if (state.t - c.lastProposal < 3) return '제휴 제안은 석 달에 한 번이에요';
  if (t.kind === 'human' && t.choice) return `${withJosa(t.name, '이/가')} 다른 일을 결정하는 중이에요`;
  return null;
}

/** 컴퓨터 회사가 제휴를 받아들일지 미리 보기 */
export function allianceOutlook(state: AirlineState, from: number, to: number): 'yes' | 'maybe' | 'no' {
  const s = allianceScore(state, from, to);
  return s > 1 ? 'yes' : s > 0 ? 'maybe' : 'no';
}

// ------------------------------------------------------------------ 행동

/**
 * 비행기 한 대를 늘 같은 모양(같은 키, 같은 순서)으로 베낀다. 없는 값은 undefined로 두어 저장(JSON)에는 남지 않는다.
 * 비행기마다 키가 다르거나 키를 지우면(delete) 자바스크립트 엔진이 느린 길로 가서, 컴퓨터 한 차례가 눈에 띄게 느려졌다.
 */
function clonePlane(p: Plane): Plane {
  return {
    id: p.id,
    model: p.model,
    leased: p.leased,
    rent: p.rent,
    deposit: p.deposit,
    since: p.since,
    legs: p.legs.map((l) => ({ route: l.route, freq: l.freq })),
    cabin: p.cabin,
    meal: p.meal,
    got: p.got,
    cond: p.cond,
    check: p.check,
  };
}

function cloneCompany(c: Company): Company {
  return {
    ...c,
    branches: [...c.branches],
    routes: c.routes.map((r) => ({ ...r, times: [...r.times] as [number, number, number, number] })),
    planes: c.planes.map(clonePlane),
    ads: { ...c.ads },
    awareness: { ...c.awareness },
    businesses: c.businesses.map((b) => ({ ...b })),
    stats: { ...c.stats },
    orders: c.orders.map((o) => ({ ...o })),
    mods: [...c.mods],
    goals: c.goals.map((g) => ({ ...g })),
    acc: { ...c.acc },
    reviews: [...c.reviews],
    staff: { pilot: { ...c.staff.pilot, pipe: [...c.staff.pilot.pipe] }, cabin: { ...c.staff.cabin, pipe: [...c.staff.cabin.pipe] }, tech: { ...c.staff.tech, pipe: [...c.staff.tech.pipe] }, ground: { ...c.staff.ground, pipe: [...c.staff.ground.pipe] } },
    ...(c.fuel ? { fuel: { ...c.fuel } } : {}),
    ...(c.facilities ? { facilities: c.facilities.map((f) => ({ ...f })) } : {}),
  };
}

/** 회사 몇 곳을 바꾼 새 상태 */
function editMany(state: AirlineState, cis: number[], fn: (cs: Company[], s: AirlineState) => void): AirlineState {
  const companies = state.companies.slice();
  for (const ci of cis) companies[ci] = cloneCompany(companies[ci]);
  const s: AirlineState = { ...state, companies, events: [] };
  fn(
    cis.map((ci) => companies[ci]),
    s,
  );
  return s;
}

/** 지금 회사 하나만 바꾼 새 상태 */
function edit(state: AirlineState, ci: number, fn: (c: Company, s: AirlineState) => void): AirlineState {
  return editMany(state, [ci], ([c], s) => fn(c, s));
}

function pushEvent(s: AirlineState, e: DistOmit<GameEvent, 'id'>): void {
  s.events = [...s.events, { ...e, id: s.nextEventId } as GameEvent];
  s.nextEventId += 1;
}

const near = (v: number) => Math.round(v * 10) / 10;
const clampRep = (v: number) => Math.max(0, Math.min(100, v));

/** 사람 회사가 끼어 있을 때만 라이벌 소식을 낸다 (컴퓨터끼리 일은 시끄럽지 않게) */
function humansAmong(state: AirlineState, cis: number[]): number[] {
  return cis.filter((i) => state.companies[i]?.kind === 'human' && !state.companies[i].out);
}

export function applyAction(state: AirlineState, action: AirlineAction, rng: Rng = Math.random): AirlineState {
  if (state.phase !== 'manage') return state;
  const ci = actor(state);
  if (ci < 0) return state;
  const c0 = state.companies[ci];
  if (c0.out) return state;
  const seat = c0.seat;

  switch (action.type) {
    case 'openBranch': {
      if (branchBlocker(state, ci, action.city)) return state;
      const cost = branchCost(action.city, state.q);
      let s = edit(state, ci, (c, s) => {
        c.cash -= cost;
        c.branches.push(action.city);
        pushEvent(s, { type: 'branch', company: ci, city: action.city });
      });
      // 다른 회사 본사 지역에 지점이 셋째로 생기면 알린다
      const region = CITY[action.city].region;
      const count = s.companies[ci].branches.filter((b) => CITY[b].region === region).length;
      const watchers = humansAmong(
        s,
        s.companies.map((x, i) => (i !== ci && CITY[x.hub].region === region ? i : -1)).filter((i) => i >= 0),
      );
      if (count === 3 && watchers.length) {
        s = addNews(s, {
          icon: '📍',
          title: `${withJosa(c0.name, '이/가')} ${REGION_INFO[region].name}에 거점을 넓혀요`,
          text: `${withJosa(c0.name, '이/가')} 우리 본사가 있는 ${REGION_INFO[region].name}에 지점을 셋이나 냈어요. 곧 우리 노선에도 들어올지 몰라요.`,
          tone: 'bad',
          city: action.city,
          for: watchers,
          company: ci,
        });
      }
      return addLog(s, seat, `${c0.name}: ${CITY[action.city].name} 지점 열기 (−${fmtMoney(cost)})`);
    }
    case 'closeBranch': {
      if (closeBranchBlocker(state, ci, action.city)) return state;
      const s = edit(state, ci, (c) => {
        c.branches = c.branches.filter((x) => x !== action.city);
      });
      return addLog(s, seat, `${c0.name}: ${CITY[action.city].name} 지점 닫기`);
    }
    case 'openRoute': {
      if (routeBlocker(state, ci, action.a, action.b)) return state;
      let s = edit(state, ci, (c, s) => {
        c.routes.push({ id: s.nextId, a: action.a, b: action.b, fare: 0, since: s.t, stats: null, times: defaultTimes(action.a, action.b, yearOf(s.q)) });
        s.nextId += 1;
        c.stats.opened += 1;
        pushEvent(s, { type: 'route', company: ci, a: action.a, b: action.b });
      });
      const rivals = humansAmong(
        s,
        s.companies.map((x, i) => (i !== ci && routeOnPair(x, action.a, action.b) ? i : -1)).filter((i) => i >= 0),
      );
      if (rivals.length) {
        s = addNews(s, {
          icon: '⚔️',
          title: `${withJosa(c0.name, '이/가')} ${CITY[action.a].name}–${CITY[action.b].name}에 들어왔어요`,
          text: '같은 두 도시를 날게 되어 손님을 나눠 가져야 해요. 운임·횟수·비행기를 살펴보세요.',
          tone: 'bad',
          city: action.a,
          for: rivals,
          company: ci,
        });
      }
      return addLog(s, seat, `${c0.name}: ${CITY[action.a].name}–${CITY[action.b].name} 노선 열기`);
    }
    case 'closeRoute': {
      const r = routeById(c0, action.route);
      if (!r) return state;
      const s = edit(state, ci, (c, s) => {
        c.routes = c.routes.filter((x) => x.id !== r.id);
        for (const p of c.planes) p.legs = p.legs.filter((l) => l.route !== r.id);
        pushEvent(s, { type: 'closeRoute', company: ci, a: r.a, b: r.b });
      });
      return addLog(s, seat, `${c0.name}: ${CITY[r.a].name}–${CITY[r.b].name} 노선 닫기`);
    }
    case 'buy': {
      if (buyBlocker(state, ci, action.model, false)) return state;
      const m = MODEL[action.model];
      const price = orderPrice(state, m, c0);
      const due = state.t + leadTime(m, yearNow(state));
      const s = edit(state, ci, (c, s) => {
        c.cash -= price;
        c.orders.push({ id: s.nextId, model: m.id, due, price });
        s.nextId += 1;
        pushEvent(s, { type: 'order', company: ci, model: m.id, due });
      });
      return addLog(s, seat, `${c0.name}: ${m.name} 주문 (−${fmtMoney(price)}, ${mLabel(due)} 인도)`);
    }
    case 'cancelOrder': {
      const o = c0.orders.find((x) => x.id === action.order);
      if (!o) return state;
      const refund = Math.round(o.price * CANCEL_REFUND);
      const s = edit(state, ci, (c) => {
        c.cash += refund;
        c.orders = c.orders.filter((x) => x.id !== o.id);
      });
      return addLog(s, seat, `${c0.name}: ${MODEL[o.model].name} 주문 취소 (+${fmtMoney(refund)})`);
    }
    case 'lease': {
      if (buyBlocker(state, ci, action.model, true)) return state;
      const m = MODEL[action.model];
      const rent = leaseRent(state, m);
      const deposit = depositFor(state, ci, m.id);
      const s = edit(state, ci, (c, s) => {
        c.cash -= deposit;
        c.planes.push({ id: s.nextId, model: m.id, leased: true, rent, deposit, since: s.t, legs: [], cabin: cabinFor(c, m), meal: c.service, got: s.t, cond: 100 });
        s.nextId += 1;
        c.taken += 1;
        c.stats.bought += 1;
        c.acc.bought += 1;
        pushEvent(s, { type: 'plane', company: ci, model: m.id, leased: true });
      });
      return addLog(s, seat, `${c0.name}: ${m.name} 리스 (보증금 ${fmtMoney(deposit)}, 달 ${fmtMoney(rent)})`);
    }
    case 'buyUsed': {
      if (usedBlocker(state, ci, action.listing)) return state;
      const u = state.market.find((x) => x.id === action.listing)!;
      const s = edit(state, ci, (c, s) => {
        c.cash -= u.price;
        c.planes.push({ id: s.nextId, model: u.model, leased: false, rent: 0, deposit: 0, since: s.t - Math.round(u.age * 12), legs: [], cabin: cabinFor(c, MODEL[u.model]), meal: c.service, got: s.t, cond: usedCond(u.age) });
        s.nextId += 1;
        c.taken += 1;
        c.stats.bought += 1;
        c.acc.bought += 1;
        s.market = s.market.filter((x) => x.id !== u.id);
        pushEvent(s, { type: 'plane', company: ci, model: u.model, leased: false });
      });
      return addLog(s, seat, `${c0.name}: 중고 ${MODEL[u.model].name}(${u.age}년) 사기 (−${fmtMoney(u.price)})`);
    }
    case 'sell': {
      if (sellBlocker(state, ci, action.plane)) return state;
      const p = planeById(c0, action.plane)!;
      const m = MODEL[p.model];
      const amount = sellAmount(state, p);
      const s = edit(state, ci, (c, s) => {
        c.cash += amount;
        c.planes = c.planes.filter((x) => x.id !== p.id);
        pushEvent(s, { type: 'sell', company: ci, model: m.id, amount });
      });
      return addLog(
        s,
        seat,
        p.leased ? `${c0.name}: ${m.name} 리스 반납 (보증금 ${fmtMoney(p.deposit)} − 위약금 ${fmtMoney(p.rent)})` : `${c0.name}: ${m.name} 팔기 (+${fmtMoney(amount)})`,
      );
    }
    case 'assign': {
      const p = planeById(c0, action.plane);
      if (!p) return state;
      if (action.route === null || action.freq === 0) {
        if (action.route === null ? p.legs.length === 0 : legFreq(p, action.route) === 0) return state;
        return edit(state, ci, (c) => {
          const x = planeById(c, action.plane)!;
          x.legs = action.route === null ? [] : x.legs.filter((l) => l.route !== action.route);
        });
      }
      if (assignBlocker(state, ci, action.plane, action.route, action.freq)) return state;
      if (legFreq(p, action.route) === action.freq) return state;
      const r = routeById(c0, action.route)!;
      const fresh = legFreq(p, action.route) === 0;
      const s = edit(state, ci, (c, s) => {
        const x = planeById(c, action.plane)!;
        const leg = x.legs.find((l) => l.route === action.route);
        if (leg) leg.freq = action.freq;
        else x.legs.push({ route: action.route!, freq: action.freq });
        pushEvent(s, { type: 'assign', company: ci, route: r.id });
      });
      return fresh ? addLog(s, seat, `${c0.name}: ${MODEL[p.model].name} → ${CITY[r.a].name}–${CITY[r.b].name} 주 ${action.freq}회`) : s;
    }
    case 'setFare': {
      const r = routeById(c0, action.route);
      const fare = Math.round(action.fare);
      if (action.cls) {
        // 비즈니스석·일등석·화물 운임 (classes.ts)
        const key = action.cls === 'c' ? 'fareC' : action.cls === 'f' ? 'fareF' : action.cls === 'k' ? 'fareK' : null;
        if (!r || !key || !(fare >= CLASS_FARE_MIN && fare <= CLASS_FARE_MAX) || fare === (r[key] ?? 0)) return state;
        return edit(state, ci, (c) => {
          routeById(c, action.route)![key] = fare;
        });
      }
      if (!r || fare < FARE_MIN || fare > FARE_MAX || fare === r.fare) return state;
      return edit(state, ci, (c) => {
        routeById(c, action.route)!.fare = fare;
      });
    }
    case 'setBizModel': {
      if (bizModelBlocker(c0, action.model)) return state;
      if (action.model === bizModelOf(c0)) {
        return addLog(edit(state, ci, (c) => (c.bizModelNext = null)), seat, `${c0.name}: 사업 모델 바꾸기를 그만뒀어요`);
      }
      const cost = bizChangeCost(c0, action.model);
      const s = edit(state, ci, (c, s) => {
        c.cash -= cost;
        c.bizModelNext = { model: action.model, t: s.t + BIZ_CHANGE_MONTHS };
      });
      return addLog(s, seat, `${c0.name}: ${BIZ_INFO[action.model].name}(으)로 바꾸기 시작 (${mLabel(state.t + BIZ_CHANGE_MONTHS)}, −${fmtMoney(cost)})`);
    }
    case 'setAds': {
      const amount = Math.round(action.amount);
      if (!REGIONS.includes(action.region) || amount < 0 || amount > ADS_MAX || amount === c0.ads[action.region]) return state;
      return edit(state, ci, (c) => {
        c.ads[action.region] = amount;
      });
    }
    case 'setMedia': {
      if (!REGIONS.includes(action.region) || !MEDIA_INFO[action.media] || yearNow(state) < MEDIA_INFO[action.media].from || mediaOf(c0, action.region) === action.media) return state;
      return edit(state, ci, (c) => {
        c.adMedia = { ...(c.adMedia ?? Object.fromEntries(REGIONS.map((r) => [r, 'tv']))), [action.region]: action.media } as Record<RegionId, AdMedia>;
      });
    }
    case 'campaign': {
      if (campaignBlocker(state, ci, action.kind, action.region)) return state;
      const info = CAMPAIGN_INFO[action.kind];
      const cost = campaignCost(state, action.kind);
      const s = edit(state, ci, (c, s) => {
        c.cash -= cost;
        c.lastCampaign = s.t;
        if (info.mod) {
          c.mods.push({ id: s.nextId, kind: info.mod.kind, value: info.mod.value, until: s.t + info.mod.months, label: `${info.icon} ${info.name}`, seg: info.mod.seg, ...(info.region && action.region ? { region: action.region } : {}) });
          s.nextId += 1;
        }
        if (info.awareness && action.region) c.awareness[action.region] = Math.min(1, c.awareness[action.region] + info.awareness);
        if (info.rep) c.reputation = clampRep(c.reputation + info.rep);
        pushEvent(s, { type: 'campaign', company: ci, kind: action.kind });
      });
      return addLog(s, seat, `${c0.name}: ${info.icon} ${info.name}${action.region && info.region ? ` (${REGION_INFO[action.region].name})` : ''} (−${fmtMoney(cost)})`);
    }
    case 'setMaint': {
      const level = Math.round(action.level);
      if (level < 1 || level > 5 || level === c0.maint) return state;
      return edit(state, ci, (c) => {
        c.maint = level;
      });
    }
    case 'setCrewReserve': {
      const level = Math.round(action.level);
      if (level < 0 || level > 2 || level === c0.crewReserve) return state;
      return edit(state, ci, (c) => {
        c.crewReserve = level;
      });
    }
    case 'hire': {
      if (hireBlocker(state, ci, action.group, action.n, action.fast)) return state;
      const n = Math.round(action.n);
      const cost = hireCost(state, c0, action.group, n, action.fast);
      const ready = state.t + hireTime(c0, action.group, action.fast);
      const s = edit(state, ci, (c) => {
        c.cash -= cost;
        c.staff = { ...c.staff, [action.group]: { ...c.staff[action.group], pipe: [...c.staff[action.group].pipe, { n, ready }] } };
      });
      return addLog(s, seat, `${c0.name}: ${STAFF_INFO[action.group].name} ${n}명 뽑기 (${mLabel(ready)}부터, −${fmtFine(cost)})`);
    }
    case 'fire': {
      if (fireBlocker(state, ci, action.group, action.n)) return state;
      const n = Math.round(action.n);
      const cost = fireCost(state, c0, action.group, n);
      const total = Math.max(1, staffTotal(c0));
      const s = edit(state, ci, (c) => {
        c.cash -= cost;
        c.staff = { ...c.staff, [action.group]: { ...c.staff[action.group], have: c.staff[action.group].have - n } };
        // 사람을 내보내면 남은 사람들도 서운해한다
        c.shock = Math.min(40, c.shock + 4 + (n / total) * 120);
      });
      return addLog(s, seat, `${c0.name}: ${STAFF_INFO[action.group].name} ${n}명 내보내기 (−${fmtFine(cost)})`);
    }
    case 'setPay': {
      const level = Math.round(action.level * 100) / 100;
      if (!STAFF_GROUPS.includes(action.group) || level < PAY_MIN - 1e-9 || level > PAY_MAX + 1e-9 || level === c0.staff[action.group].pay) return state;
      return edit(state, ci, (c) => {
        c.staff = { ...c.staff, [action.group]: { ...c.staff[action.group], pay: level } };
      });
    }
    case 'buildAcademy': {
      if (academyBlocker(state, ci)) return state;
      const s = edit(state, ci, (c) => {
        c.cash -= ACADEMY_COST;
        c.academy = true;
      });
      return addLog(s, seat, `${c0.name}: 훈련원 세우기 (−${fmtMoney(ACADEMY_COST)})`);
    }
    case 'setTimes': {
      if (timesBlocker(state, ci, action.route, action.times)) return state;
      return edit(state, ci, (c) => {
        const r = c.routes.find((x) => x.id === action.route)!;
        r.times = action.times.map((x) => Math.max(0, Math.round(x))) as [number, number, number, number];
      });
    }
    case 'setService': {
      const level = Math.round(action.level);
      if (level < 1 || level > 5 || (level === c0.service && c0.planes.every((p) => p.meal === level))) return state;
      return edit(state, ci, (c) => {
        c.service = level;
        for (const p of c.planes) p.meal = level;
      });
    }
    case 'setMeal': {
      const level = Math.round(action.level);
      const p0 = c0.planes.find((p) => p.id === action.plane);
      if (!p0 || level < 1 || level > 5) return state;
      const targets = action.all ? c0.planes.filter((p) => p.model === p0.model) : [p0];
      if (targets.every((p) => p.meal === level)) return state;
      const ids = new Set(targets.map((p) => p.id));
      return edit(state, ci, (c) => {
        for (const p of c.planes) if (ids.has(p.id)) p.meal = level;
      });
    }
    case 'setCabin': {
      if (cabinChangeBlocker(state, ci, action.plane, action.cabin, !!action.all)) return state;
      const p0 = c0.planes.find((p) => p.id === action.plane)!;
      const targets = cabinTargets(c0, p0, action.cabin, !!action.all);
      const cost = targets.reduce((sum, p) => sum + refitCost(state, p, action.cabin), 0);
      const ids = new Set(targets.map((p) => p.id));
      const cabin = { first: action.cabin.first, business: action.cabin.business, pitch: action.cabin.pitch };
      const s = edit(state, ci, (c, s) => {
        c.cash -= cost;
        for (const p of c.planes) if (ids.has(p.id)) p.cabin = { ...cabin };
        pushEvent(s, { type: 'cabin', company: ci, plane: p0.id, cost });
      });
      const m = MODEL[p0.model];
      return addLog(s, seat, `${c0.name}: ${m.name}${targets.length > 1 ? ` ${targets.length}대` : ''} 좌석 배치 바꿈${cost > 0 ? ` (−${fmtMoney(cost)})` : ''}`);
    }
    case 'borrow': {
      const amount = Math.round(action.amount);
      if (borrowBlocker(state, ci, amount)) return state;
      const s = edit(state, ci, (c, s) => {
        c.cash += amount;
        c.debt += amount;
        pushEvent(s, { type: 'money', company: ci, amount, what: 'borrow' });
      });
      return addLog(s, seat, `${c0.name}: 은행에서 ${fmtMoney(amount)} 빌리기`);
    }
    case 'repay': {
      const amount = Math.min(Math.round(action.amount * 10) / 10, near(c0.debt));
      if (repayBlocker(state, ci, amount)) return state;
      const s = edit(state, ci, (c, s) => {
        c.cash -= amount;
        c.debt = Math.max(0, near(c.debt - amount));
        pushEvent(s, { type: 'money', company: ci, amount, what: 'repay' });
      });
      return addLog(s, seat, `${c0.name}: 빚 ${fmtMoney(amount)} 갚기`);
    }
    case 'build': {
      if (buildBlocker(state, ci, action.city, action.kind)) return state;
      const cost = businessCost(action.city, action.kind, state.q);
      const s = edit(state, ci, (c, s) => {
        c.cash -= cost;
        c.businesses.push({ city: action.city, kind: action.kind, cost });
        pushEvent(s, { type: 'build', company: ci, city: action.city, kind: action.kind });
      });
      return addLog(s, seat, `${c0.name}: ${CITY[action.city].name}에 ${withJosa(BUSINESS_INFO[action.kind].name, '을/를')} 열기 (−${fmtMoney(cost)})`);
    }
    case 'sellBusiness': {
      const b = c0.businesses.find((x) => x.city === action.city && x.kind === action.kind);
      if (!b) return state;
      const refund = Math.round(b.cost * 0.7);
      const s = edit(state, ci, (c) => {
        c.cash += refund;
        c.businesses = c.businesses.filter((x) => !(x.city === action.city && x.kind === action.kind));
      });
      return addLog(s, seat, `${c0.name}: ${CITY[action.city].name} ${BUSINESS_INFO[action.kind].name} 팔기 (+${fmtMoney(refund)})`);
    }
    case 'buildTank': {
      if (tankBlocker(state, ci)) return state;
      const level = tankOf(c0).level + 1;
      const info = TANK_LEVELS[level];
      const s = edit(state, ci, (c, s) => {
        c.cash -= info.cost;
        c.fuel = { ...tankOf(c), level };
        pushEvent(s, { type: 'fuel', company: ci, tons: 0, what: 'tank' });
      });
      return addLog(s, seat, `${c0.name}: ${withJosa(info.name, '을/를')} 지었어요 (${info.cap.toLocaleString('ko-KR')}톤, −${fmtMoney(info.cost)})`);
    }
    case 'buyFuel': {
      const tons = Math.floor(action.tons);
      if (buyFuelBlocker(state, ci, tons)) return state;
      const cost = fuelCost(state.oil, tons);
      const s = edit(state, ci, (c, s) => {
        c.cash -= cost;
        c.fuel = addFuel(tankOf(c), tons, s.oil);
        pushEvent(s, { type: 'fuel', company: ci, tons, what: 'buy' });
      });
      return addLog(s, seat, `${c0.name}: 연료 ${tons.toLocaleString('ko-KR')}톤 사 두기 (유가 ${state.oil.toFixed(2)}, −${fmtFine(cost)})`);
    }
    case 'sellFuel': {
      const tons = Math.floor(action.tons);
      if (sellFuelBlocker(state, ci, tons)) return state;
      const got = fuelCost(state.oil, tons) * FUEL_SELL_RATE;
      const s = edit(state, ci, (c, s) => {
        c.cash += got;
        const t = tankOf(c);
        const stock = Math.max(0, Math.round((t.stock - tons) * 10) / 10);
        c.fuel = { ...t, stock, avg: stock > 0 ? t.avg : 0 };
        pushEvent(s, { type: 'fuel', company: ci, tons, what: 'sell' });
      });
      return addLog(s, seat, `${c0.name}: 사 둔 연료 ${tons.toLocaleString('ko-KR')}톤 팔기 (+${fmtFine(got)})`);
    }
    case 'setFuelAuto': {
      const ratio = action.ratio === null ? null : Math.round(action.ratio * 100) / 100;
      if (ratio !== null && !(ratio >= 0.5 && ratio <= 1.2)) return state;
      if (tankOf(c0).level === 0 || tankOf(c0).auto === ratio) return state;
      return edit(state, ci, (c) => {
        c.fuel = { ...tankOf(c), auto: ratio };
      });
    }
    case 'charter': {
      if (charterBlocker(state, ci, action.offer, action.plane)) return state;
      const o = state.charters!.find((x) => x.id === action.offer)!;
      const p = planeById(c0, action.plane)!;
      let s = { ...state, charters: state.charters!.map((x) => (x.id === o.id ? { ...x, by: ci, plane: p.id, t: state.t } : x)) };
      s = { ...s, events: [{ id: s.nextEventId, type: 'charter', company: ci, offer: o.id }], nextEventId: s.nextEventId + 1 };
      return addLog(s, seat, `${c0.name}: ${o.icon} ${o.title} ${CITY[o.a].name}⇄${CITY[o.b].name} ${o.pax}명 전세기 맡기 (${MODEL[p.model].name} ${tripsFor(o, p)}번 왕복, 보수 ${fmtMoney(o.pay)})`);
    }
    case 'checkPlane': {
      const p = planeById(c0, action.plane);
      if (!p) return state;
      if (action.on && checkBlocker(state, ci, p.id)) return state;
      if (!action.on && !inCheck(p, state.t)) return state;
      const s = edit(state, ci, (c, s) => {
        const x = planeById(c, action.plane)!;
        if (action.on) x.check = s.t;
        else x.check = undefined;
        pushEvent(s, { type: 'check', company: ci, plane: x.id, on: action.on });
      });
      return addLog(s, seat, action.on ? `${c0.name}: ${MODEL[p.model].name} 이번 달 C점검 (약 ${fmtMoney(companyCheckCost(c0, p))})` : `${c0.name}: ${MODEL[p.model].name} C점검 미루기`);
    }
    case 'buildFacility': {
      if (facilityBlocker(state, ci, action.city, action.kind)) return state;
      const cost = facilityCost(action.city, action.kind, state.q);
      const s = edit(state, ci, (c, s) => {
        c.cash -= cost;
        c.facilities = [...(c.facilities ?? []), { city: action.city, kind: action.kind, cost }];
        pushEvent(s, { type: 'facility', company: ci, city: action.city, kind: action.kind });
      });
      return addLog(s, seat, `${c0.name}: ${CITY[action.city].name}에 ${withJosa(FACILITY_INFO[action.kind].name, '을/를')} 지었어요 (−${fmtMoney(cost)})`);
    }
    case 'sellFacility': {
      const f = (c0.facilities ?? []).find((x) => x.city === action.city && x.kind === action.kind);
      if (!f) return state;
      const refund = Math.round(f.cost * FACILITY_REFUND);
      const s = edit(state, ci, (c) => {
        c.cash += refund;
        c.facilities = (c.facilities ?? []).filter((x) => !(x.city === action.city && x.kind === action.kind));
      });
      return addLog(s, seat, `${c0.name}: ${CITY[action.city].name} ${FACILITY_INFO[action.kind].name} 팔기 (+${fmtMoney(refund)})`);
    }
    case 'setCheckAt': {
      const at = Math.round(action.at);
      if (!CHECK_POLICIES.some((x) => x.at === at) || (c0.checkAt ?? 50) === at) return state;
      return edit(state, ci, (c) => {
        c.checkAt = at;
      });
    }
    case 'choose':
      return applyChoice(state, ci, action.option);
    case 'propose':
      return propose(state, ci, action.to);
    case 'endAlliance': {
      const p = c0.partner;
      if (p === null) return state;
      let s = editMany(state, [ci, p], ([a, b]) => {
        a.partner = null;
        b.partner = null;
      });
      s = addNews(s, { icon: '✂️', title: `${c0.name}·${state.companies[p].name} 제휴 끝`, text: '공동 운항을 끝냈어요. 이제 서로의 노선으로 갈아타는 손님을 함께 태우지 않아요.', tone: 'info', for: humansAmong(s, [ci, p]), company: ci });
      return addLog(s, seat, `${c0.name}: ${withJosa(state.companies[p].name, '와/과')} 제휴 끝`);
    }
    case 'endTurn': {
      // 고르지 않은 결정 사건은 마지막 선택지(대개 '안 해요')로
      if (c0.choice) {
        const s = applyChoice(state, ci, c0.choice.options.length - 1);
        return endTurn(s === state ? edit(state, ci, (c) => (c.choice = null)) : s, rng);
      }
      return endTurn(state, rng);
    }
  }
  return state;
}

/** 결정 사건에서 하나 고르기 */
export function choiceBlocker(state: AirlineState, ci: number, option: number): string | null {
  const c = state.companies[ci];
  const o = c.choice?.options[option];
  if (!c.choice || !o) return '고를 일이 없어요';
  if (o.cost > c.cash) return `돈이 모자라요 (${fmtMoney(o.cost)} 필요)`;
  for (const e of o.effects) {
    if (e.kind === 'alliance') {
      const other = state.companies[e.with];
      if (!other || other.out || other.partner !== null || c.partner !== null || bizModelOf(c) === 'lcc' || bizModelOf(other) === 'lcc') return '이제는 제휴할 수 없어요';
    }
    if (e.kind === 'order' && fleetCount(c) >= MAX_PLANES) return `비행기는 주문까지 ${MAX_PLANES}대까지예요`;
    if (e.kind === 'order' && MODEL[e.model] && bizModelFit(c, MODEL[e.model])) return bizModelFit(c, MODEL[e.model]);
  }
  return null;
}

function applyChoice(state: AirlineState, ci: number, option: number): AirlineState {
  if (choiceBlocker(state, ci, option)) return state;
  const c0 = state.companies[ci];
  const choice = c0.choice as Choice;
  const o = choice.options[option];
  const partnerOf = o.effects.find((e) => e.kind === 'alliance');
  const cis = partnerOf && partnerOf.kind === 'alliance' ? [ci, partnerOf.with] : [ci];
  let s = editMany(state, cis, ([c, other], s) => {
    c.cash -= o.cost;
    for (const e of o.effects) {
      if (e.kind === 'cash') c.cash += e.amount;
      else if (e.kind === 'rep') c.reputation = clampRep(c.reputation + e.amount);
      else if (e.kind === 'mod') {
        c.mods.push({ ...e.mod, id: s.nextId });
        s.nextId += 1;
      } else if (e.kind === 'awareness') c.awareness[e.region] = Math.min(1, c.awareness[e.region] + e.amount);
      else if (e.kind === 'alliance' && other) {
        c.partner = e.with;
        other.partner = ci;
      } else if (e.kind === 'pay') {
        for (const g of ['pilot', 'cabin'] as const) c.staff = { ...c.staff, [g]: { ...c.staff[g], pay: Math.min(PAY_MAX, Math.round((c.staff[g].pay + e.amount) * 100) / 100) } };
      } else if (e.kind === 'morale') {
        c.morale = Math.max(0, Math.min(100, c.morale + e.amount));
        if (e.amount < 0) c.shock = Math.min(40, c.shock - e.amount * 0.5);
      } else if (e.kind === 'academy') {
        c.academy = true;
      } else if (e.kind === 'order') {
        const m = MODEL[e.model];
        c.orders.push({ id: s.nextId, model: m.id, due: s.t + leadTime(m, yearOf(s.q)), price: o.cost });
        s.nextId += 1;
      }
    }
    c.choice = null;
    pushEvent(s, { type: 'choice', company: ci, option });
  });
  if (partnerOf && partnerOf.kind === 'alliance') {
    const other = state.companies[partnerOf.with];
    s = addNews(s, { icon: '🤝', title: `${c0.name}·${other.name} 제휴`, text: '공동 운항(코드셰어)을 시작했어요. 서로의 노선을 이어 갈아타는 손님을 함께 태워요.', tone: 'good', for: humansAmong(s, cis), company: ci });
  }
  return addLog(s, c0.seat, `${c0.name}: ${choice.title} — ${o.label}`);
}

function propose(state: AirlineState, ci: number, to: number): AirlineState {
  if (proposeBlocker(state, ci, to)) return state;
  const c0 = state.companies[ci];
  const t = state.companies[to];
  let s = edit(state, ci, (c) => {
    c.lastProposal = state.t;
  });
  if (t.kind === 'human') {
    s = edit(s, to, (c, s2) => {
      c.choice = { ...allianceChoice(s2, ci, to), id: s2.nextId };
      s2.nextId += 1;
    });
    return addLog(s, c0.seat, `${c0.name}: ${t.name}에 제휴를 제안했어요`);
  }
  const ok = allianceScore(s, ci, to) > 0;
  if (ok) {
    s = editMany(s, [ci, to], ([a, b], s2) => {
      a.partner = to;
      b.partner = ci;
      pushEvent(s2, { type: 'alliance', company: ci, with: to, ok: true });
    });
    s = addNews(s, { icon: '🤝', title: `${c0.name}·${t.name} 제휴`, text: '공동 운항(코드셰어)을 시작했어요. 서로의 노선을 이어 갈아타는 손님을 함께 태워요.', tone: 'good', for: humansAmong(s, [ci, to]), company: ci });
  } else {
    s = { ...s, events: [...s.events, { id: s.nextEventId, type: 'alliance', company: ci, with: to, ok: false }], nextEventId: s.nextEventId + 1 };
  }
  return addLog(s, c0.seat, ok ? `${c0.name}: ${withJosa(t.name, '와/과')} 제휴했어요` : `${c0.name}: ${withJosa(t.name, '이/가')} 제휴를 거절했어요`);
}

/** 다음 회사로. 모두 마치면 분기를 계산한다 */
function endTurn(state: AirlineState, rng: Rng): AirlineState {
  let pos = state.turnPos + 1;
  while (pos < state.order.length && state.companies[state.order[pos]].out) pos++;
  if (pos < state.order.length) {
    const next = state.order[pos];
    return { ...state, turnPos: pos, events: [{ id: state.nextEventId, type: 'turn', company: next }], nextEventId: state.nextEventId + 1 };
  }
  return runMonth(state, rng);
}

// ------------------------------------------------------------------ 달 계산과 다음 달

/** 회사가 운항을 멈추기까지 돈이 모자란 채로 버틸 수 있는 달 수 */
export const CRISIS_MONTHS = 4;

/** 달 결산에서 무거운 노선·연결 목록은 최근 석 달만 들고 있는다 */
function trimLedger(list: QuarterReport[]): QuarterReport[] {
  const keep = list.slice(-24);
  return keep.map((r, k) => (k < keep.length - 3 ? { ...r, routes: [], xfers: [], ops: [] } : r));
}

/** 석 달(또는 열두 달) 결산을 하나로 */
function rollup(months: readonly QuarterReport[], n: number, q: number, t: number, span: number): QuarterReport {
  const companies = Array.from({ length: n }, (_, ci) => sumReports(months.map((m) => m.companies[ci]).filter(Boolean)));
  // 노선: 같은 회사·노선끼리 더한다
  const routes = new Map<string, RouteReport>();
  for (const m of months) {
    for (const r of m.routes) {
      const k = `${r.company}|${r.route}`;
      const cur = routes.get(k);
      if (!cur) routes.set(k, { ...r });
      else {
        cur.pax += r.pax;
        cur.seats += r.seats;
        cur.revenue += r.revenue;
        cur.cost += r.cost;
        cur.profit += r.profit;
      }
    }
  }
  const xfers = new Map<string, QuarterReport['xfers'][number]>();
  for (const m of months) {
    for (const x of m.xfers) {
      const k = `${x.via}|${x.a}|${x.b}`;
      const cur = xfers.get(k);
      if (!cur) xfers.set(k, { ...x, companies: [...x.companies] });
      else cur.pax += x.pax;
    }
  }
  return { q, t, span, companies, routes: [...routes.values()], news: [], xfers: [...xfers.values()].sort((x, y) => y.pax - x.pax).slice(0, 60), ops: [] };
}

function monthPoint(state: AirlineState, t: number, report: QuarterReport | null) {
  const r = (ci: number) => report?.companies[ci];
  return {
    t,
    oil: state.oil,
    value: state.companies.map((_, i) => Math.round(companyValue(state, i))),
    profit: state.companies.map((_, i) => Math.round(r(i)?.profit ?? 0)),
    revenue: state.companies.map((_, i) => Math.round((r(i)?.ticket ?? 0) + (r(i)?.side ?? 0))),
    pax: state.companies.map((_, i) => Math.round(r(i)?.pax ?? 0)),
    lf: state.companies.map((_, i) => {
      const x = r(i);
      return x && x.seats > 0 ? Math.round((x.pax / x.seats) * 1000) / 1000 : 0;
    }),
    onTime: state.companies.map((c, i) => Math.round(((r(i)?.flights ?? 0) > 0 ? r(i)!.onTime : c.onTime) * 1000) / 1000),
    staff: state.companies.map((c) => (c.out ? 0 : staffTotal(c))),
  };
}

/** 이번 달 운항 현장 소식 (사람 회사에 닿은 큰 것만, 한 달에 두셋) */
function opsNews(state: AirlineState, ops: QuarterReport['ops'], closures: { city: string; days: number; cause: WeatherCause }[]): AirlineState {
  let s = state;
  const humans = s.companies.map((c, i) => (c.kind === 'human' && !c.out ? i : -1)).filter((i) => i >= 0);
  let count = 0;
  for (const cl of closures) {
    if (count >= 2) break;
    const hit = ops.filter((o) => (o.a === cl.city || o.b === cl.city) && o.cancelled > 0);
    const who = [...new Set(hit.map((o) => o.company))].filter((ci) => humans.includes(ci));
    if (hit.length === 0) continue;
    const total = hit.reduce((sum, o) => sum + o.cancelled, 0);
    const info = WEATHER_INFO[cl.cause];
    s = addNews(s, {
      icon: info.icon,
      title: `${info.name}으로 ${CITY[cl.city].name} 공항이 ${cl.days === 1 ? '하루' : '이틀'} 문을 닫았어요`,
      text: `${CITY[cl.city].name}을 오가는 항공편 ${total}편이 결항했어요. 날씨가 풀리면 다시 떠요. 손님 모두 안전하게 다른 날로 옮겨 탔어요 (게임 속 이야기).`,
      tone: 'info',
      city: cl.city,
      for: who.length ? who : undefined,
    });
    count++;
  }
  for (const ci of humans) {
    if (count >= 3) break;
    const g = ops.find((o) => o.company === ci && o.grounded > 0);
    if (!g) continue;
    const c = s.companies[ci];
    s = addNews(s, {
      icon: '🔧',
      title: `${c.name}: 정비 점검으로 비행기가 쉬었어요`,
      text: `정기 점검에서 고칠 곳이 나와 ${CITY[g.a].name}–${CITY[g.b].name}을 나는 비행기 ${g.grounded}대가 잠깐 쉬었어요. 그동안 ${g.cancelled}편이 결항했어요. 정비 수준을 높이거나 예비기를 두면 줄어요.${c.airline ? ' (게임 속 이야기)' : ''}`,
      tone: 'bad',
      city: g.a,
      for: [ci],
      company: ci,
    });
    count++;
  }
  return s;
}

/** 이번 달을 계산하고, 분기·해가 끝나면 결산하고, 승리 조건을 보고, 다음 달을 연다 */
export function runMonth(state: AirlineState, rng: Rng = Math.random): AirlineState {
  if (state.phase === 'gameover') return state;
  const out = computeMonth(state, rng);
  const t = state.t;
  const q = state.q;
  const n = state.companies.length;
  const companies = state.companies.map(cloneCompany);
  let s: AirlineState = { ...state, companies, events: [] };
  const newsBefore = s.nextId;
  const bankrupts: number[] = [];
  companies.forEach((c, ci) => {
    const rep = out.reports[ci];
    if (c.out) return;
    c.cash += rep.profit;
    // 돈이 모자라면 남은 대출 한도만큼 저절로 빌린다
    if (c.cash < 0) {
      const left = creditLimit(s, ci) - c.debt;
      const loan = Math.max(0, Math.min(left, -c.cash + 10));
      if (loan > 0) {
        c.debt += loan;
        c.cash += loan;
        rep.autoLoan = loan;
      }
    }
    c.crisis = c.cash < 0 ? c.crisis + 1 : 0;
    if (c.crisis >= CRISIS_MONTHS) {
      rep.bankrupt = true;
      bankrupts.push(ci);
    }
    // 노선 결과
    const stats = out.routeStats[ci];
    for (const r of c.routes) {
      const st = stats.get(r.id);
      if (!st) {
        r.stats = r.stats ? { ...r.stats, hist: [...r.stats.hist, [0, 0] as [number, number]].slice(-12) } : null;
        continue;
      }
      const lossStreak = st.profit < 0 ? (r.stats?.lossStreak ?? 0) + 1 : 0;
      const hist = [...(r.stats?.hist ?? []), [Math.round(st.lf * 1000) / 1000, Math.round(st.profit * 10) / 10] as [number, number]].slice(-12);
      r.stats = {
        lf: st.lf,
        pax: Math.round(st.pax),
        revenue: st.revenue,
        profit: st.profit,
        lossStreak,
        share: st.share,
        xfer: st.xfer,
        xferRev: st.xferRev,
        onTime: st.onTime,
        cancel: st.cancel,
        hist,
        ...(st.premLf !== undefined ? { premLf: st.premLf } : {}),
        ...(st.cls ? { cls: st.cls } : {}),
        ...(st.cargo ? { cargo: st.cargo } : {}),
      };
    }
    // 정시 운항률·평판·광고 (석 달에 걸쳐 천천히)
    if (rep.flights > 0) c.onTime = Math.round((c.onTime * 0.67 + rep.onTime * 0.33) * 1000) / 1000;
    c.reputation = Math.round((c.reputation + (reputationTarget(s, c) - c.reputation) * 0.12) * 10) / 10;
    const scale = adScale(q);
    for (const region of REGIONS) {
      const effect = adTarget(c, region, scale);
      c.awareness[region] = Math.round((c.awareness[region] * 0.887 + effect * 0.113) * 1000) / 1000;
    }
    // 기체 상태: C점검을 마친 비행기는 돌아오고, 날던 비행기는 닳는다
    for (const p of c.planes) {
      const age = planeAge(s, p);
      if (inCheck(p, t)) {
        p.cond = restoredCond(age);
        p.check = undefined;
      } else if (p.legs.length > 0) {
        p.cond = Math.max(0, Math.round((condOf(p) - monthlyWear(planeHours(c, p), age, c.maint) * wearMult(c)) * 10) / 10);
      } else if (p.cond === undefined) p.cond = condOf(p);
    }
    // 탱크에서 쓴 연료를 덜어 낸다
    if (c.fuel && (rep.tankUsed ?? 0) > 0) {
      const stock = Math.max(0, Math.round((c.fuel.stock - rep.tankUsed!) * 10) / 10);
      c.fuel = { ...c.fuel, stock, avg: stock > 0 ? c.fuel.avg : 0 };
    }
    c.stats.pax += Math.round(rep.pax);
    c.acc = addMonth(c.acc, rep);
    // 조직 만족도: 임금·초과 근무·성장·훈련원 쪽으로 천천히. 파업이 끝나면 조금 풀린다
    if (rep.strike) c.shock = Math.max(0, c.shock - 6);
    c.shock = Math.round(c.shock * 0.85 * 10) / 10;
    const mt = moraleTarget(s, c).value;
    c.morale = Math.round(Math.max(0, Math.min(100, c.morale + (mt - c.morale) * 0.2 + (rep.strike ? 8 : 0))) * 10) / 10;
  });
  // 파업 소식 (사람 회사) — 파업 뒤에는 임금 협상이 따라온다
  companies.forEach((c, ci) => {
    if (!out.reports[ci].strike || c.out) return;
    s = addNews(s, {
      icon: '🪧',
      title: `${c.name}: 직원들이 일주일쯤 일을 멈췄어요`,
      text: `조직 만족도가 낮아 조종사·승무원들이 파업했어요. 이번 달 운항이 크게 줄었어요. 임금 수준과 초과 근무를 살펴보세요.${c.airline ? ' (게임 속 이야기)' : ''}`,
      tone: 'bad',
      for: c.kind === 'human' ? [ci] : undefined,
      company: ci,
    });
    if (!c.choice) c.nextChoiceT = Math.min(c.nextChoiceT, t + 1);
  });

  for (const ci of bankrupts) s = shutDown(s, ci, t);

  // 가격 경쟁 알림·운항 현장 소식
  s = priceWarNews(s);
  s = opsNews(s, out.ops, out.closures);

  out.reports.forEach((rep, ci) => {
    rep.value = Math.round(companyValue(s, ci));
    rep.cash = Math.round(companies[ci].cash);
    rep.debt = Math.round(companies[ci].debt);
  });
  const monthReport: QuarterReport = { q, t, span: 1, companies: out.reports, routes: out.routes, news: [], xfers: out.xfers, ops: out.ops };
  s = { ...s, ledger: trimLedger([...s.ledger, monthReport]) };
  const months = [...s.months, monthPoint(s, t, monthReport)];
  s = { ...s, months: months.length > 480 ? months.slice(-480) : months, report: monthReport };

  // 분기가 끝나면: 석 달 결산, 분기 기록, 흑자 분기 세기
  let qReport: QuarterReport | null = null;
  if (isQuarterEnd(t)) {
    qReport = rollup(
      s.ledger.filter((l) => qOfM(l.t) === q),
      n,
      q,
      t,
      3,
    );
    s.companies.forEach((c, ci) => {
      if (c.out) return;
      c.acc = closeQuarter(c.acc);
      c.stats.bestProfit = Math.max(c.stats.bestProfit, Math.round(qReport!.companies[ci].profit));
      c.stats.profitStreak = qReport!.companies[ci].profit > 0 ? c.stats.profitStreak + 1 : 0;
    });
    const hist = [...s.history, historyPoint(s, q, qReport)];
    s = { ...s, qReport, history: hist.length > 200 ? hist.slice(-200) : hist };
  }

  // 해가 끝나면 (12월): 한 해 결산, 연간 목표와 경영 평가
  if (monthOf(t) === 12) {
    const year = yearOfM(t);
    const yr = rollup(
      s.ledger.filter((l) => yearOfM(l.t) === year),
      n,
      q,
      t,
      12,
    );
    s = { ...s, years: [...s.years, { year, companies: yr.companies }].slice(-60) };
    s.companies.forEach((c, ci) => {
      if (c.out) return;
      const goals = c.goals.map((g) => ({ ...g, done: goalMet(s, ci, g) }));
      const review = gradeYear(s, ci, goals);
      for (const g of goals) {
        if (!g.done) continue;
        c.cash += g.reward.cash;
        c.reputation = clampRep(c.reputation + g.reward.rep);
      }
      c.goals = goals;
      c.reviews = [...c.reviews, review].slice(-40);
      if (qReport) {
        qReport.companies[ci].review = review;
        qReport.companies[ci].goals = goals;
      }
      monthReport.companies[ci].review = review;
      monthReport.companies[ci].goals = goals;
    });
    for (const [ci, c] of s.companies.entries()) {
      const r = monthReport.companies[ci].review;
      if (r && !c.out) s = addLog(s, c.seat, `📋 ${c.name} ${r.year}년 경영 평가 ${r.grade} (목표 ${r.met}/${r.total})`);
    }
    // 연말 시상식: 부문마다 상, 받은 회사는 평판이 오르고 올해의 항공사는 한 해 동안 손님이 조금 는다
    const awards = yearAwards(s, year, yr.companies, s.years.find((y) => y.year === year - 1)?.companies);
    if (awards.items.length > 0) {
      s = { ...s, awards: [...(s.awards ?? []), awards].slice(-40) };
      for (const a of awards.items) {
        const c = s.companies[a.company];
        c.reputation = clampRep(c.reputation + AWARD_INFO[a.kind].rep);
        if (a.kind === 'airline') {
          c.mods.push({ id: s.nextId, kind: 'demand', value: AIRLINE_AWARD_DEMAND, until: t + 1 + AIRLINE_AWARD_MONTHS, label: `🏆 ${year}년 올해의 항공사` });
          s.nextId += 1;
        }
        s = addLog(s, c.seat, `${AWARD_INFO[a.kind].icon} ${c.name}: ${year}년 ${AWARD_INFO[a.kind].name} (${a.text})`);
      }
      const winners = humansAmong(s, [...new Set(awards.items.map((a) => a.company))]);
      s = addNews(s, {
        icon: '🏆',
        title: `${year}년 하늘길 시상식`,
        text: awards.items.map((a) => `${AWARD_INFO[a.kind].icon} ${AWARD_INFO[a.kind].name}: ${s.companies[a.company].name} (${a.text})`).join(' · '),
        tone: 'good',
        for: winners.length ? winners : undefined,
        company: awards.items[0].company,
      });
    }
  }

  if (qReport) {
    const ranked = rankings(s);
    const lead = companies[ranked[0]];
    s = addLog(s, null, `📊 ${qLabel(q)} 결산 — 1등 ${lead.name} ${fmtMoney(companyValue(s, ranked[0]))}`);
  }

  // 도전 과제와 승리 조건
  s = checkEnd(s, qReport?.companies ?? null, t);
  const ids = newsIds(s, newsBefore);
  if (s.phase === 'gameover') {
    s.report = { ...monthReport, news: ids };
    if (qReport) s.qReport = { ...qReport, news: ids };
    pushEvent(s, { type: 'month', t });
    if (qReport) pushEvent(s, { type: 'quarter', q });
    pushEvent(s, { type: 'gameover' });
    return s;
  }

  s = startMonth(s, t + 1, rng);
  const ids2 = newsIds(s, newsBefore);
  s.report = { ...monthReport, news: ids2 };
  if (qReport) s.qReport = { ...qReport, news: ids2 };
  const first = s.order[s.turnPos];
  pushEvent(s, { type: 'month', t });
  if (qReport) pushEvent(s, { type: 'quarter', q });
  pushEvent(s, { type: 'turn', company: first });
  return s;
}

/** 예전 이름 (테스트): 석 달을 한꺼번에 (차례 없이) */
export function runQuarter(state: AirlineState, rng: Rng = Math.random): AirlineState {
  let s = state;
  for (let k = 0; k < 3 && s.phase !== 'gameover'; k++) {
    s = runMonth(s, rng);
    if (isQuarterEnd(s.t - 1)) break;
  }
  return s;
}

/** 운항을 멈춘 회사: 내 비행기는 중고 시장으로, 슬롯은 비고, 제휴는 끝난다 */
function shutDown(state: AirlineState, ci: number, t: number): AirlineState {
  let s = state;
  const c = s.companies[ci];
  const listings = c.planes
    .filter((p) => !p.leased && planeAge(s, p) < 25)
    .slice(0, 8)
    .map((p) => ({ id: 0, model: p.model, age: Math.round(planeAge(s, p)), price: Math.max(10, Math.round(planeValue(s, p) * 0.75)), listed: t, from: c.name }));
  const market = [...s.market];
  for (const l of listings) {
    market.push({ ...l, id: s.nextId });
    s = { ...s, nextId: s.nextId + 1 };
  }
  s = { ...s, market: market.slice(-14) };
  if (c.partner !== null) s.companies[c.partner].partner = null;
  c.out = true;
  c.planes = [];
  c.routes = [];
  c.orders = [];
  c.businesses = [];
  c.branches = [c.hub];
  c.ads = emptyRegions();
  c.partner = null;
  c.choice = null;
  delete c.fuel;
  delete c.facilities;
  s = addNews(s, {
    icon: '🛑',
    title: `${c.name} 운항 중단`,
    text: `이 판에서 ${withJosa(c.name, '은/는')} ${CRISIS_MONTHS}달 내내 돈이 모자라 운항을 멈췄어요.${listings.length ? ` 비행기 ${listings.length}대가 중고 시장에 나왔고,` : ''} 쓰던 공항 슬롯과 노선이 비었어요 — 새 노선을 열 기회예요!${c.airline ? ' (게임 속 이야기일 뿐, 실제 회사와는 관계없어요)' : ''}`,
    tone: 'bad',
    company: ci,
  });
  s = addLog(s, c.seat, `🛑 ${c.name} 운항 중단`);
  pushEvent(s, { type: 'bankrupt', company: ci });
  return s;
}

function priceWarNews(state: AirlineState): AirlineState {
  let s = state;
  const active = new Set<string>();
  const byPair = new Map<string, { ci: number; fare: number }[]>();
  s.companies.forEach((c, ci) => {
    if (c.out) return;
    for (const r of c.routes) {
      if (routeFreq(c, r.id) <= 0) continue;
      const k = pairKey(r.a, r.b);
      byPair.set(k, [...(byPair.get(k) ?? []), { ci, fare: r.fare }]);
    }
  });
  for (const [pair, ops] of byPair) {
    if (ops.length < 2) continue;
    for (const x of ops) {
      for (const y of ops) {
        if (x.ci === y.ci || x.fare > y.fare - 15) continue;
        const key = `${x.ci}|${y.ci}|${pair}`;
        active.add(key);
        if (s.priceWars.includes(key) || s.companies[y.ci].kind !== 'human') continue;
        const [a, b] = pair.split('|');
        s = addNews(s, {
          icon: '🏷️',
          title: `${withJosa(s.companies[x.ci].name, '이/가')} ${CITY[a].name}–${CITY[b].name}에서 가격 경쟁`,
          text: `라이벌이 우리보다 ${y.fare - x.fare}%p 싸게 팔아요. 따라 내릴지, 서비스·횟수로 버틸지 정해요.`,
          tone: 'bad',
          city: a,
          for: [y.ci],
        });
      }
    }
  }
  return { ...s, priceWars: [...active] };
}

function newsIds(s: AirlineState, from: number): number[] {
  return s.news.filter((n) => n.id >= from).map((n) => n.id);
}

/** 승리·실패를 확인한다 */
function checkEnd(state: AirlineState, reports: QuarterReport['companies'] | null, t: number): AirlineState {
  let s = state;
  const alive = s.companies.map((c, i) => (c.out ? -1 : i)).filter((i) => i >= 0);
  const values = s.companies.map((_, i) => companyValue(s, i));
  const best = (cands: number[]) => {
    const top = Math.max(...cands.map((i) => values[i]));
    return cands.filter((i) => values[i] === top);
  };
  const finish = (result: GameResult) => ({ ...s, phase: 'gameover' as const, result });

  if (s.options.mode === 'challenge' && s.challenge) {
    const ch = s.challenge;
    const def = CHALLENGE[ch.id];
    // 도전 과제는 분기마다 살핀다 (돈이 모자라 운항을 멈추면 바로 실패)
    if (!reports && !s.companies[ch.company].out) return s;
    const r = checkChallenge(def, s, ch.company, reports ?? s.companies.map(() => emptyReport()), qOfM(t), ch.streak, ch.startValue);
    s = { ...s, challenge: { ...ch, progress: r.progress, ratio: r.ratio, streak: r.streak } };
    if (r.done) {
      s = addNews(s, { icon: '🏆', title: `도전 성공: ${def.title}`, text: r.progress, tone: 'big' });
      return finish({ winners: [ch.company], reason: `${def.emoji} ${def.title} 성공!`, success: true });
    }
    if (r.failed) {
      s = addNews(s, { icon: '⌛', title: `도전 실패: ${def.title}`, text: r.progress, tone: 'bad' });
      return finish({ winners: [], reason: s.companies[ch.company].out ? '회사가 운항을 멈췄어요' : '기한 안에 목표를 이루지 못했어요', success: false });
    }
    return s;
  }

  const humans = s.companies.map((c, i) => (c.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  if (alive.length === 0) return finish({ winners: [], reason: '모든 회사가 운항을 멈췄어요' });
  if (alive.length === 1 && s.companies.length > 1) return finish({ winners: alive, reason: `${s.companies[alive[0]].name}만 남았어요` });
  if (humans.length > 0 && humans.every((i) => s.companies[i].out)) return finish({ winners: best(alive), reason: '사람 회사가 모두 운항을 멈췄어요' });

  if (s.options.mode === 'goal') {
    const goal = s.options.goalValue;
    const need = s.options.goalRegions;
    const done = alive.filter((i) => values[i] >= goal && regionsServed(s.companies[i]).size >= need);
    if (done.length > 0) return finish({ winners: best(done), reason: `${need}개 지역 취항 + 회사 가치 ${fmtMoney(goal)} 목표를 먼저 이뤘어요` });
  }
  if (t >= endT(s)) return finish({ winners: best(alive), reason: s.options.mode === 'years' ? `${s.options.years}년이 지나 회사 가치 1등이 이겼어요` : '아주 오래 걸려서 회사 가치 1등이 이겼어요' });
  return s;
}

/** 중고 시장: 오래된 매물은 빠지고 몇 대가 새로 나온다 */
export function refreshMarket(state: AirlineState, rng: Rng, first = false): AirlineState {
  const year = yearOf(state.q);
  let market = state.market.filter((u) => u.listed >= state.t - 12);
  let nextId = state.nextId;
  const pool = MODELS.filter((m) => m.intro <= year - 3 && m.intro >= year - 24 && m.end >= year - 12);
  // 처음에는 몇 대, 그 뒤로는 달마다 한 대쯤
  const want = first ? 3 + Math.floor(rng() * 2) : rng() < 0.7 ? 1 + (rng() < 0.15 ? 1 : 0) : 0;
  const add = Math.min(10 - market.length, want);
  for (let k = 0; k < add && pool.length; k++) {
    const m = pool[Math.floor(rng() * pool.length)];
    const age = Math.max(2, Math.min(year - m.intro, 3 + Math.floor(rng() * 10)));
    const price = Math.max(10, Math.round(m.price * Math.max(0.12, 1 - 0.045 * age) * 0.82));
    market = [...market, { id: nextId, model: m.id, age, price, listed: state.t }];
    nextId += 1;
  }
  return { ...state, market, nextId };
}

/** 다음 달을 연다: 시간·유가·사건·뉴스·인도·결정 사건·목표·순서 */
function startMonth(state: AirlineState, t: number, rng: Rng): AirlineState {
  const q = qOfM(t);
  let s: AirlineState = { ...state, t, q, effects: state.effects.filter((e) => e.until > t) };
  // 유가는 달마다 조금씩 흔들리며 보통 값 쪽으로 천천히 돌아간다 (기름값 폭풍 과제는 높게)
  const target = oilTarget(s);
  const noise = (rng() - 0.5) * 0.035;
  s.oil = Math.round(Math.max(0.5, Math.min(3, s.oil + (target - s.oil) * 0.035 + noise)) * 100) / 100;
  if (s.challenge?.id === 'oilstorm' && t === mOf(1973, 10)) {
    s.oil = 1.9;
    s = addNews(s, { icon: '⛽', title: '기름값 폭풍!', text: '기름값이 갑자기 거의 두 배로 뛰었어요. 연료를 많이 먹는 비행기는 큰 손해를 봐요.', tone: 'bad' });
  }
  if (monthOf(t) === 1) s = announceYear(s);
  // 올림픽·엑스포
  for (const e of fixedEventsAt(t)) {
    s = addNews(s, {
      icon: FIXED_ICON[e.kind],
      title: `${e.title}가 열려요`,
      text: `${CITY[e.city].name}을 오가는 손님이 크게 늘어요. 노선과 좌석을 늘려 두면 좋아요!`,
      tone: 'big',
      city: e.city,
    });
  }
  // 실제 역사 사건
  if (historyOn(s)) {
    for (const h of historyAt(t)) {
      if (h.oil) s = { ...s, oil: Math.round(Math.max(0.5, Math.min(3, s.oil * h.oil)) * 100) / 100 };
      for (const dm of h.demand ?? []) {
        const until = t + dm.months;
        const add: DistOmit<Effect, 'id'>[] = dm.regions
          ? dm.regions.map((region) => ({ kind: dm.mult >= 1 ? 'boom' : 'slump', region, mult: dm.mult, until }) as DistOmit<Effect, 'id'>)
          : [{ kind: 'world', mult: dm.mult, until }];
        for (const e of add) s = { ...s, effects: [...s.effects, { ...e, id: s.nextId } as Effect], nextId: s.nextId + 1 };
      }
      if (h.aid && s.report) {
        const rep = s.report;
        s = {
          ...s,
          companies: s.companies.map((c, ci) => {
            const r = rep.companies[ci];
            if (c.out || !r) return c;
            const costs = r.fuel + r.crew + r.airport + r.service + r.sales + r.lease + r.fleet + r.branch + r.ads + r.interest + r.staff + r.disrupt;
            return { ...c, cash: c.cash + Math.round(costs * h.aid!) };
          }),
        };
      }
      s = addNews(s, { icon: h.icon, title: h.title, text: h.text, tone: h.tone });
    }
  }
  // 무작위 사건 (석 달에 한 번쯤)
  const activeCities = [...new Set(s.companies.flatMap((c) => c.routes.flatMap((r) => [r.a, r.b])))];
  const rolls = rng() < 0.16 ? (rng() < 0.15 ? 2 : 1) : 0;
  for (let k = 0; k < rolls; k++) {
    const ev = rollRandomEvent({ t, oil: s.oil, rate: s.rate, slotBoost: s.slotBoost, effects: s.effects, activeCities }, rng);
    if (!ev) continue;
    if (ev.oil) s = { ...s, oil: Math.round(Math.max(0.5, Math.min(3, s.oil * ev.oil)) * 100) / 100 };
    if (ev.rate) s = { ...s, rate: Math.round(Math.max(2, Math.min(14, s.rate + ev.rate)) * 10) / 10 };
    if (ev.slot) s = { ...s, slotBoost: { ...s.slotBoost, [ev.slot.city]: Math.round(((s.slotBoost[ev.slot.city] ?? 0) + ev.slot.add) * 100) / 100 } };
    if (ev.effect) s = { ...s, effects: [...s.effects, { ...ev.effect, id: s.nextId } as (typeof s.effects)[number]], nextId: s.nextId + 1 };
    s = addNews(s, ev.news);
  }
  s = refreshMarket(s, rng);
  s = refreshCharters(s, rng);

  // 회사마다: 주문한 비행기 인도, 지난 효과 정리, 결정 사건, 새해 목표
  const year = yearOfM(t);
  const companies = s.companies.map(cloneCompany);
  s = { ...s, companies };
  const oilAim = oilTarget(s);
  companies.forEach((c, ci) => {
    if (c.out) return;
    c.taken = 0;
    c.mods = c.mods.filter((m) => m.until > t);
    // 연료 자동으로 사기: 유가가 정해 둔 만큼 싸면 탱크를 채운다
    const lastRep = s.report?.companies[ci];
    const lastCosts = lastRep ? lastRep.fuel + lastRep.crew + lastRep.airport + lastRep.service + lastRep.sales + lastRep.lease + lastRep.fleet + lastRep.branch + lastRep.ads + lastRep.interest + lastRep.staff + lastRep.disrupt : 0;
    const autoTons = autoBuyTons(c, s.oil, oilAim, lastCosts);
    if (autoTons > 0) {
      const cost = fuelCost(s.oil, autoTons);
      c.cash -= cost;
      c.fuel = addFuel(tankOf(c), autoTons, s.oil);
      s = addLog(s, c.seat, `⛽ ${c.name}: 유가 ${s.oil.toFixed(2)}에 연료 ${autoTons.toLocaleString('ko-KR')}톤 자동으로 사 두기 (−${fmtFine(cost)})`);
    }
    // C점검: 기체 상태가 점검 시점 아래로 내려간 비행기는 이번 달 정비고에 들어간다
    const toCheck = new Set(dueForCheck(c, t, extraCheckSlots(c)));
    if (toCheck.size > 0) {
      const names: string[] = [];
      for (const p of c.planes) {
        if (!toCheck.has(p.id)) continue;
        p.check = t;
        names.push(MODEL[p.model].name);
      }
      if (c.kind === 'human') s = addLog(s, c.seat, `🔧 ${c.name}: C점검 ${names.join(', ')} (이번 달 쉬어요)`);
    }
    // 나라 관계가 막힌 노선은 운항을 멈춘다
    if (historyOn(s)) {
      const blocked = c.routes.map((r) => ({ r, why: routePolitics(c.hub, r.a, r.b, yearOfM(t)) })).filter((x) => x.why);
      if (blocked.length > 0) {
        const ids = new Set(blocked.map((x) => x.r.id));
        c.routes = c.routes.filter((r) => !ids.has(r.id));
        for (const p of c.planes) p.legs = p.legs.filter((l) => !ids.has(l.route));
        s = addNews(s, {
          icon: '🚫',
          title: `${c.name}: ${blocked.map((x) => `${CITY[x.r.a].name}–${CITY[x.r.b].name}`).join(', ')} 운항 중단`,
          text: `${blocked[0].why!.why}. 비행기는 쉬는 상태가 됐어요.`,
          tone: 'bad',
          for: [ci],
          company: ci,
        });
      }
    }
    // 뽑은 사람들이 일을 시작한다
    for (const g of STAFF_GROUPS) {
      const st = c.staff[g];
      const ready = st.pipe.filter((p) => p.ready <= t).reduce((sum, p) => sum + p.n, 0);
      if (ready > 0 || st.pipe.length) c.staff = { ...c.staff, [g]: { ...st, have: st.have + ready, pipe: st.pipe.filter((p) => p.ready > t) } };
    }
    const due = c.orders.filter((o) => o.due <= t);
    for (const o of due) {
      c.planes.push({ id: s.nextId, model: o.model, leased: false, rent: 0, deposit: 0, since: t, legs: [], cabin: cabinFor(c, MODEL[o.model]), meal: c.service, got: t, cond: 100 });
      s.nextId += 1;
      c.stats.bought += 1;
      c.acc.bought += 1;
    }
    c.orders = c.orders.filter((o) => o.due > t);
    // 사업 모델 바꾸기가 끝난 달 (bizmodel.ts)
    const changed = settleBizModel(companies, ci, t);
    if (changed) s = addNews(s, changed);
    if (due.length && c.kind === 'human') {
      s = addNews(s, { icon: '📦', title: `${c.name}: 새 비행기 인도`, text: `주문한 ${due.map((o) => MODEL[o.model].name).join(', ')}이 도착했어요. 노선에 넣어 주세요.`, tone: 'good', for: [ci] });
    }
    if (monthOf(t) === 1) {
      c.acc = freshAcc(s, ci, year, c.acc.pax);
      c.goals = newGoals(s, ci, rng);
    }
    if (!c.choice && t >= c.nextChoiceT) {
      const draft = makeChoice(s, ci, rng);
      if (draft) {
        c.choice = { ...draft, id: s.nextId };
        s.nextId += 1;
      }
      c.nextChoiceT = t + nextChoiceGap(rng);
    }
  });
  // 컴퓨터가 가끔 제휴를 제안한다 (한 해에 한 번쯤)
  companies.forEach((c, ci) => {
    if (c.out || c.kind === 'human' || c.partner !== null || t < s.startT + 18 || rng() > 0.035) return;
    let best = -1;
    let bestScore = 0.5;
    companies.forEach((other, ti) => {
      if (ti === ci || other.out || other.partner !== null) return;
      const sc = allianceScore(s, ci, ti);
      if (sc > bestScore) {
        bestScore = sc;
        best = ti;
      }
    });
    if (best < 0) return;
    const other = companies[best];
    if (other.kind === 'human') {
      if (other.choice) return;
      other.choice = { ...allianceChoice(s, ci, best), id: s.nextId };
      s.nextId += 1;
    } else {
      c.partner = best;
      other.partner = ci;
      s = addNews(s, { icon: '🤝', title: `${c.name}·${other.name} 제휴`, text: '두 회사가 공동 운항을 시작했어요.', tone: 'info', company: ci });
    }
  });
  // 순서는 달마다 한 칸씩 돌린다
  const alive = s.companies.map((c, i) => (c.out ? -1 : i)).filter((i) => i >= 0);
  const shift = (t - s.startT) % Math.max(1, alive.length);
  const order = [...alive.slice(shift), ...alive.slice(0, shift)];
  return { ...s, order, turnPos: 0 };
}

export function oilTarget(state: AirlineState): number {
  if (state.challenge?.id === 'oilstorm' && state.t >= mOf(1973, 10)) return 1.9;
  return historyOn(state) ? historicOil(yearOfM(state.t)) : 1;
}

/** 해가 바뀔 때 뉴스: 새 기종, 생산 끝, 공항이 커짐, 올해 행사 */
function announceYear(state: AirlineState): AirlineState {
  let s = state;
  const year = yearOf(s.q);
  const first = s.t === s.startT;
  if (historyOn(s)) for (const n of politicalNews(year, s.startYear)) s = addNews(s, n);
  const fresh = MODELS.filter((m) => m.intro === year);
  if (fresh.length > 0) {
    s = addNews(s, {
      icon: '🆕',
      title: `새 기종: ${fresh.map((m) => m.name).join(', ')}`,
      text: fresh.map((m) => `${m.name}(${m.maker}) — ${m.seats}석, ${m.range.toLocaleString()}km. ${m.note}. 처음 2년은 15% 싸지만 인도가 오래 걸려요`).join(' / '),
      tone: 'info',
    });
  }
  if (!first) {
    const ended = MODELS.filter((m) => m.end === year - 1);
    if (ended.length > 0) {
      s = addNews(s, {
        icon: '🔚',
        title: `생산 끝: ${ended.map((m) => m.name).join(', ')}`,
        text: '더는 새로 주문하거나 리스할 수 없어요. 가진 비행기는 계속 날 수 있지만 값이 조금 떨어져요.',
        tone: 'info',
      });
    }
    if (year % 10 === 0) {
      const grown = CITIES.filter((c) => airportClass(c, year) > airportClass(c, year - 1));
      for (const c of grown) {
        s = addNews(s, {
          icon: '🛫',
          title: `${c.name} 공항이 커졌어요`,
          text: `${c.name} 공항이 ${AIRPORT_INFO[airportClass(c, year)].name}이 되었어요. 더 큰 비행기가 내리고 슬롯도 늘어요.`,
          tone: 'good',
          city: c.id,
        });
      }
    }
  }
  for (const e of FIXED_EVENTS) {
    if (e.year === year && e.months[0] > 1) {
      s = addNews(s, {
        icon: FIXED_ICON[e.kind],
        title: `올해 ${e.months[0]}월에 ${e.title}`,
        text: `${CITY[e.city].name}에서 ${e.title}가 열려요. 그 무렵 손님이 크게 늘 거예요.`,
        tone: 'info',
        city: e.city,
      });
    }
  }
  return s;
}

// ------------------------------------------------------------------ 자동 진행

/**
 * 자동 진행을 멈출 까닭 (없으면 null). sinceNews: 자동 진행을 시작할 때의 nextId (그 뒤 소식만 본다).
 * 결정할 일, 큰 사건, 돈 걱정, 우리 회사에 닿은 소식(라이벌 진입·가격 경쟁·새 비행기 인도·운항 차질 등)이면 멈춘다.
 */
export function autoStopReason(state: AirlineState, ci: number, sinceNews: number): string | null {
  const c = state.companies[ci];
  if (!c || state.phase !== 'manage') return '게임이 끝났어요';
  if (c.out) return '회사가 운항을 멈췄어요';
  if (c.choice) return `결정할 일: ${c.choice.title}`;
  const rep = state.report?.companies[ci];
  const costs = rep ? rep.fuel + rep.crew + rep.airport + rep.service + rep.sales + rep.lease + rep.fleet + rep.branch + rep.ads + rep.interest + rep.disrupt + rep.staff : 0;
  if (c.crisis > 0 || c.cash < Math.max(20, costs * 0.5)) return '현금이 모자라요';
  const need = staffNeed(state, c);
  if (staffCap(need, c) < 1) return '일손이 모자라 결항이 나요';
  for (const g of ['pilot', 'cabin'] as const) if (need[g] > 0 && c.staff[g].have + staffPipe(c, g) < need[g] * 0.95) return `${STAFF_INFO[g].name}이 곧 모자라요`;
  if (idlePlanes(c).length > 0 && c.planes.length > 0 && idlePlanes(c).length > Math.floor(c.planes.filter((p) => p.legs.length > 0).length * 0.05)) return '쉬는 비행기가 있어요';
  const fresh = state.news.filter((n) => n.id >= sinceNews);
  const big = fresh.find((n) => n.tone === 'big');
  if (big) return `큰 소식: ${big.title}`;
  const mine = fresh.find((n) => n.for?.includes(ci));
  if (mine) return mine.title;
  return null;
}

// ------------------------------------------------------------------ 화면용 요약

/** 쉬는 비행기 (어느 노선도 날지 않는) */
export function idlePlanes(c: Company): Plane[] {
  return c.planes.filter((p) => !p.legs.some((l) => l.freq > 0));
}

export function planeWorth(state: AirlineState, ci: number, planeId: number): number {
  const p = planeById(state.companies[ci], planeId);
  return p ? planeValue(state, p) : 0;
}

export { branchCost, businessCost, creditLimit, companyValue, maxFreq, slotCapacity, slotsUsed, leaseRent, leaseDeposit, orderPrice, sellPrice };
