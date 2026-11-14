import { withJosa } from '../../lib/korean';
import { MODEL, MODELS, isAvailable, leadTime } from './aircraft';
import { CHALLENGE, challengeDeadline, checkChallenge } from './challenges';
import { allianceChoice, allianceScore, makeChoice, nextChoiceGap } from './choices';
import { autoAirline, gameHub, pickColors } from './brand';
import { AIRPORT_INFO, CITIES, CITY, REGIONS, REGION_INFO, airportClass, citySize, dist, pairKey } from './cities';
import { FIXED_EVENTS, FIXED_ICON, rollRandomEvent } from './events';
import { addQuarter, freshAcc, goalMet, gradeYear, newGoals } from './goals';
import { MAX_PLANES, MAX_ROUTES } from './limits';
import { REAL_AIRLINE, airlinesAt } from './realAirlines';
import {
  LEASE_RATE,
  MAX_DELIVERIES,
  adScale,
  branchCost,
  businessCost,
  companyValue,
  computeQuarter,
  creditLimit,
  legFreq,
  leaseDeposit,
  leaseRent,
  maxFreq,
  maxFreqFor,
  orderPrice,
  planeAge,
  planeValue,
  regionsServed,
  reputationTarget,
  routeFreq,
  routeIndex,
  sellPrice,
  slotCapacity,
  slotsUsed,
} from './simulate';
import { qLabel, qOf, quarterOf, yearOf } from './time';
import type {
  AirlineAction,
  AirlineOptions,
  AirlineSetup,
  AirlineState,
  BusinessKind,
  Choice,
  Company,
  DistOmit,
  GameEvent,
  GameResult,
  NewsItem,
  Plane,
  QuarterReport,
  RegionId,
  Rng,
  Route,
  SeatIndex,
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
};

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
export const ADS_MAX = 300;
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
  const weights = cands.map((id) => {
    const c = CITY[id];
    const s = citySize(c, year);
    return s * s * (takenRegions.includes(c.region) ? 0.35 : 1) * (s >= 5 ? 1 : 0.3);
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
    nextChoiceQ: 0,
    partner: null,
    goals: [],
    acc: { year, pax: 0, seats: 0, xfer: 0, revenue: 0, profit: 0, profitQ: 0, quarters: 0, bought: 0, startValue: cash, startRegions: 0, startRoutes: 0, lastPax: 0 },
    reviews: [],
    taken: 0,
    lastProposal: -99,
    airline: null,
    color: null,
  };
}

function baseState(options: AirlineOptions, year: number, companies: Company[]): AirlineState {
  const q = qOf(year, 1);
  return {
    version: 2,
    options,
    startYear: year,
    q,
    startQ: q,
    phase: 'manage',
    companies,
    order: companies.map((_, i) => i),
    turnPos: 0,
    oil: 1,
    rate: 6,
    effects: [],
    slotBoost: {},
    market: [],
    priceWars: [],
    news: [],
    history: [],
    report: null,
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
  let state = baseState(opts, year, companies);
  state = addNews(state, {
    icon: '✈️',
    title: `${year}년, 하늘길 경영을 시작해요`,
    text: `하늘을 두고 겨루는 회사: ${companies.map((c) => `${c.name}(본사 ${CITY[c.hub].name})`).join(', ')}`,
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
          r = { id: state.nextId++, a, b, fare: f.fare ?? 0, since: state.q, stats: null };
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
        since: state.q - Math.round(f.age * 4),
        legs: routeId !== null ? [{ route: routeId, freq: Math.min(f.freq ?? 7, maxFreq(m, dist(f.route![0], f.route![1]))) }] : [],
      });
    }
  }
  if (def.oil) state.oil = def.oil;
  state = addNews(state, { icon: def.emoji, title: `도전 과제: ${def.title}`, text: `${def.story} 목표: ${def.goal}`, tone: 'big' });
  state = announceYear(state);
  const startValue = Math.round(companyValue(state, 0));
  state = {
    ...state,
    challenge: { id: def.id, company: 0, deadline: challengeDeadline(def), progress: '첫 분기 결산을 기다리고 있어요', ratio: 0, streak: 0, startValue },
  };
  return finishStart(state, rng);
}

/** 첫 분기 준비: 올해 목표, 중고 시장, 첫 결정 사건 날짜, 그래프 시작점 */
function finishStart(state: AirlineState, rng: Rng): AirlineState {
  let s = state;
  const year = yearOf(s.q);
  s = {
    ...s,
    companies: s.companies.map((c, ci) => ({
      ...c,
      acc: freshAcc(s, ci, year, 0),
      goals: newGoals(s, ci, rng),
      nextChoiceQ: s.q + 2 + (ci % 2),
    })),
  };
  s = refreshMarket(s, rng);
  s = { ...s, history: [historyPoint(s, s.q - 1)] };
  s = addLog(s, null, `🛫 ${qLabel(s.q)}: ${s.companies.map((c) => c.name).join(', ')} 출발!`);
  return { ...s, events: [{ id: s.nextEventId, type: 'start' }, { id: s.nextEventId + 1, type: 'turn', company: s.order[0] }], nextEventId: s.nextEventId + 2 };
}

// ------------------------------------------------------------------ 기록

export function addLog(state: AirlineState, seat: SeatIndex | null, text: string): AirlineState {
  const log = [...state.log, { id: state.nextLogId, seat, text }];
  return { ...state, log: log.length > 80 ? log.slice(-80) : log, nextLogId: state.nextLogId + 1 };
}

export function addNews(state: AirlineState, item: Omit<NewsItem, 'id' | 'q'>): AirlineState {
  const news = [...state.news, { ...item, id: state.nextId, q: state.q }];
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
  return c.routes.find((r) => r.id === id);
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

/** 끝나는 분기 (정해진 해까지) */
export function endQ(state: AirlineState): number {
  if (state.options.mode === 'years') return state.startQ + state.options.years * 4 - 1;
  if (state.options.mode === 'challenge' && state.challenge) return state.challenge.deadline;
  return state.startQ + GOAL_YEAR_LIMIT * 4 - 1;
}

/** 첫해에는 사람 회사의 리스 보증금을 받지 않는다 (처음 하는 사람 돕기) */
export function firstYearHelp(state: AirlineState, ci: number): boolean {
  return state.companies[ci].kind === 'human' && state.q < state.startQ + 4 && state.options.mode !== 'challenge';
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

export function branchBlocker(state: AirlineState, ci: number, city: string): string | null {
  const c = state.companies[ci];
  if (!CITY[city]) return '없는 도시예요';
  if (hasBranch(c, city)) return '이미 지점이 있어요';
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
  const d = dist(a, b);
  if (d < 150) return '너무 가까워요';
  if (d > maxRangeNow(state, ci)) return `${d.toLocaleString()}km를 한 번에 날 수 있는 비행기가 없어요`;
  return null;
}

/** 이번 분기에 바로 받은 비행기 수 (리스 + 중고) */
export function deliveriesThisQuarter(state: AirlineState, ci: number): number {
  return state.companies[ci].taken;
}

/** 비행기 수 (기다리는 주문 포함) */
export const fleetCount = (c: Company) => c.planes.length + c.orders.length;

/** 새 비행기 주문(lease=false) 또는 리스(lease=true)를 할 수 있는지 */
export function buyBlocker(state: AirlineState, ci: number, modelId: string, lease: boolean): string | null {
  const c = state.companies[ci];
  const m = MODEL[modelId];
  if (!m) return '없는 기종이에요';
  if (!isAvailable(m, yearNow(state))) return yearNow(state) < m.intro ? `${m.intro}년에 나와요` : '생산이 끝난 기종이에요';
  if (fleetCount(c) >= MAX_PLANES) return `비행기는 주문까지 ${MAX_PLANES}대까지예요`;
  if (lease && c.taken >= MAX_DELIVERIES) return `리스·중고는 한 분기에 ${MAX_DELIVERIES}대까지예요`;
  const cost = lease ? depositFor(state, ci, modelId) : orderPrice(state, m, c);
  if (c.cash < cost) return `돈이 모자라요 (${fmtMoney(cost)} 필요)`;
  return null;
}

export function usedBlocker(state: AirlineState, ci: number, listing: number): string | null {
  const c = state.companies[ci];
  const u = state.market.find((x) => x.id === listing);
  if (!u) return '이미 팔린 비행기예요';
  if (fleetCount(c) >= MAX_PLANES) return `비행기는 주문까지 ${MAX_PLANES}대까지예요`;
  if (c.taken >= MAX_DELIVERIES) return `리스·중고는 한 분기에 ${MAX_DELIVERIES}대까지예요`;
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
  const m = MODEL[p.model];
  const d = dist(r.a, r.b);
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
  if (m.range < dist(r.a, r.b)) return 0;
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
  if (c.businesses.some((b) => b.city === city && b.kind === kind)) return '이미 있어요';
  const cost = businessCost(city, kind, state.q);
  if (c.cash < cost) return `돈이 모자라요 (${fmtMoney(cost)} 필요)`;
  return null;
}

export function proposeBlocker(state: AirlineState, ci: number, to: number): string | null {
  const c = state.companies[ci];
  const t = state.companies[to];
  if (!t || to === ci) return '제휴할 회사를 골라요';
  if (t.out) return '운항을 멈춘 회사예요';
  if (c.partner !== null) return '이미 제휴한 회사가 있어요';
  if (t.partner !== null) return `${withJosa(t.name, '은/는')} 다른 회사와 제휴 중이에요`;
  if (c.lastProposal === state.q) return '이번 분기에는 이미 제안했어요';
  if (t.kind === 'human' && t.choice) return `${withJosa(t.name, '이/가')} 다른 일을 결정하는 중이에요`;
  return null;
}

/** 컴퓨터 회사가 제휴를 받아들일지 미리 보기 */
export function allianceOutlook(state: AirlineState, from: number, to: number): 'yes' | 'maybe' | 'no' {
  const s = allianceScore(state, from, to);
  return s > 1 ? 'yes' : s > 0 ? 'maybe' : 'no';
}

// ------------------------------------------------------------------ 행동

function cloneCompany(c: Company): Company {
  return {
    ...c,
    branches: [...c.branches],
    routes: c.routes.map((r) => ({ ...r })),
    planes: c.planes.map((p) => ({ ...p, legs: p.legs.map((l) => ({ ...l })) })),
    ads: { ...c.ads },
    awareness: { ...c.awareness },
    businesses: c.businesses.map((b) => ({ ...b })),
    stats: { ...c.stats },
    orders: c.orders.map((o) => ({ ...o })),
    mods: [...c.mods],
    goals: c.goals.map((g) => ({ ...g })),
    acc: { ...c.acc },
    reviews: [...c.reviews],
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
        c.routes.push({ id: s.nextId, a: action.a, b: action.b, fare: 0, since: s.q, stats: null });
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
      const due = state.q + leadTime(m, yearNow(state));
      const s = edit(state, ci, (c, s) => {
        c.cash -= price;
        c.orders.push({ id: s.nextId, model: m.id, due, price });
        s.nextId += 1;
        pushEvent(s, { type: 'order', company: ci, model: m.id, due });
      });
      return addLog(s, seat, `${c0.name}: ${m.name} 주문 (−${fmtMoney(price)}, ${qLabel(due)} 인도)`);
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
        c.planes.push({ id: s.nextId, model: m.id, leased: true, rent, deposit, since: s.q, legs: [] });
        s.nextId += 1;
        c.taken += 1;
        c.stats.bought += 1;
        c.acc.bought += 1;
        pushEvent(s, { type: 'plane', company: ci, model: m.id, leased: true });
      });
      return addLog(s, seat, `${c0.name}: ${m.name} 리스 (보증금 ${fmtMoney(deposit)}, 분기 ${fmtMoney(rent)})`);
    }
    case 'buyUsed': {
      if (usedBlocker(state, ci, action.listing)) return state;
      const u = state.market.find((x) => x.id === action.listing)!;
      const s = edit(state, ci, (c, s) => {
        c.cash -= u.price;
        c.planes.push({ id: s.nextId, model: u.model, leased: false, rent: 0, deposit: 0, since: s.q - Math.round(u.age * 4), legs: [] });
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
      if (!r || fare < FARE_MIN || fare > FARE_MAX || fare === r.fare) return state;
      return edit(state, ci, (c) => {
        routeById(c, action.route)!.fare = fare;
      });
    }
    case 'setAds': {
      const amount = Math.round(action.amount);
      if (!REGIONS.includes(action.region) || amount < 0 || amount > ADS_MAX || amount === c0.ads[action.region]) return state;
      return edit(state, ci, (c) => {
        c.ads[action.region] = amount;
      });
    }
    case 'setService': {
      const level = Math.round(action.level);
      if (level < 1 || level > 5 || level === c0.service) return state;
      return edit(state, ci, (c) => {
        c.service = level;
      });
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
      return addLog(s, seat, `${c0.name}: ${CITY[action.city].name}에 ${action.kind === 'hotel' ? '호텔' : '여행사'} 열기 (−${fmtMoney(cost)})`);
    }
    case 'sellBusiness': {
      const b = c0.businesses.find((x) => x.city === action.city && x.kind === action.kind);
      if (!b) return state;
      const refund = Math.round(b.cost * 0.7);
      const s = edit(state, ci, (c) => {
        c.cash += refund;
        c.businesses = c.businesses.filter((x) => !(x.city === action.city && x.kind === action.kind));
      });
      return addLog(s, seat, `${c0.name}: ${CITY[action.city].name} ${action.kind === 'hotel' ? '호텔' : '여행사'} 팔기 (+${fmtMoney(refund)})`);
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
      if (!other || other.out || other.partner !== null || c.partner !== null) return '이제는 제휴할 수 없어요';
    }
    if (e.kind === 'order' && fleetCount(c) >= MAX_PLANES) return `비행기는 주문까지 ${MAX_PLANES}대까지예요`;
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
      } else if (e.kind === 'order') {
        const m = MODEL[e.model];
        c.orders.push({ id: s.nextId, model: m.id, due: s.q + leadTime(m, yearOf(s.q)), price: o.cost });
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
    c.lastProposal = state.q;
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
  return runQuarter(state, rng);
}

// ------------------------------------------------------------------ 분기 계산과 다음 분기

/** 분기를 계산하고, 승리 조건을 보고, 다음 분기를 연다 */
export function runQuarter(state: AirlineState, rng: Rng = Math.random): AirlineState {
  const out = computeQuarter(state);
  const q = state.q;
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
      const loan = Math.max(0, Math.min(left, -c.cash + 20));
      if (loan > 0) {
        c.debt += loan;
        c.cash += loan;
        rep.autoLoan = loan;
      }
    }
    c.crisis = c.cash < 0 ? c.crisis + 1 : 0;
    if (c.crisis >= 2) {
      rep.bankrupt = true;
      bankrupts.push(ci);
    }
    // 노선 결과
    const stats = out.routeStats[ci];
    for (const r of c.routes) {
      const st = stats.get(r.id);
      if (!st) {
        r.stats = null;
        continue;
      }
      const lossStreak = st.profit < 0 ? (r.stats?.lossStreak ?? 0) + 1 : 0;
      r.stats = { lf: st.lf, pax: Math.round(st.pax), revenue: st.revenue, profit: st.profit, lossStreak, share: st.share, xfer: st.xfer, xferRev: st.xferRev };
    }
    // 평판과 광고
    c.reputation = Math.round((c.reputation + (reputationTarget(s, c) - c.reputation) * 0.3) * 10) / 10;
    const scale = adScale(q);
    for (const region of REGIONS) {
      const effect = 1 - Math.exp(-c.ads[region] / scale);
      c.awareness[region] = Math.round((c.awareness[region] * 0.7 + effect * 0.3) * 1000) / 1000;
    }
    c.stats.pax += Math.round(rep.pax);
    c.stats.bestProfit = Math.max(c.stats.bestProfit, Math.round(rep.profit));
    c.stats.profitStreak = rep.profit > 0 ? c.stats.profitStreak + 1 : 0;
    c.acc = addQuarter(c.acc, rep);
  });

  for (const ci of bankrupts) {
    const c = companies[ci];
    // 내 비행기는 중고 시장으로, 슬롯은 비고, 제휴는 끝난다
    const listings = c.planes
      .filter((p) => !p.leased && planeAge(s, p) < 25)
      .slice(0, 8)
      .map((p) => ({ id: 0, model: p.model, age: Math.round(planeAge(s, p)), price: Math.max(10, Math.round(planeValue(s, p) * 0.75)), listed: q, from: c.name }));
    const market = [...s.market];
    for (const l of listings) {
      market.push({ ...l, id: s.nextId });
      s = { ...s, nextId: s.nextId + 1 };
    }
    s = { ...s, market: market.slice(-14) };
    if (c.partner !== null) companies[c.partner].partner = null;
    c.out = true;
    c.planes = [];
    c.routes = [];
    c.orders = [];
    c.businesses = [];
    c.branches = [c.hub];
    c.ads = emptyRegions();
    c.partner = null;
    c.choice = null;
    s = addNews(s, {
      icon: '🛑',
      title: `${c.name} 운항 중단`,
      text: `이 판에서 ${withJosa(c.name, '은/는')} 두 분기 내내 돈이 모자라 운항을 멈췄어요.${listings.length ? ` 비행기 ${listings.length}대가 중고 시장에 나왔고,` : ''} 쓰던 공항 슬롯과 노선이 비었어요 — 새 노선을 열 기회예요!${c.airline ? ' (게임 속 이야기일 뿐, 실제 회사와는 관계없어요)' : ''}`,
      tone: 'bad',
      company: ci,
    });
    s = addLog(s, c.seat, `🛑 ${c.name} 운항 중단`);
    pushEvent(s, { type: 'bankrupt', company: ci });
  }

  // 가격 경쟁 알림: 같은 두 도시에서 라이벌이 15%p 넘게 싸게 팔면
  s = priceWarNews(s);

  // 해가 끝나면 연간 목표와 경영 평가
  if (quarterOf(q) === 4) {
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
      out.reports[ci].review = review;
      out.reports[ci].goals = goals;
    });
    for (const [ci, c] of s.companies.entries()) {
      const r = out.reports[ci].review;
      if (r && !c.out) s = addLog(s, c.seat, `📋 ${c.name} ${r.year}년 경영 평가 ${r.grade} (목표 ${r.met}/${r.total})`);
    }
  }

  out.reports.forEach((rep, ci) => {
    rep.value = Math.round(companyValue(s, ci));
    rep.cash = Math.round(companies[ci].cash);
    rep.debt = Math.round(companies[ci].debt);
  });
  const report: QuarterReport = { q, companies: out.reports, routes: out.routes, news: [], xfers: out.xfers };
  const hist = [...s.history, historyPoint(s, q, report)];
  s = { ...s, report, history: hist.length > 200 ? hist.slice(-200) : hist };

  const ranked = rankings(s);
  const lead = companies[ranked[0]];
  s = addLog(s, null, `📊 ${qLabel(q)} 결산 — 1등 ${lead.name} ${fmtMoney(companyValue(s, ranked[0]))}`);

  // 도전 과제와 승리 조건
  s = checkEnd(s, out.reports, q);
  if (s.phase === 'gameover') {
    s.report = { ...report, news: newsIds(s, newsBefore) };
    pushEvent(s, { type: 'quarter', q });
    pushEvent(s, { type: 'gameover' });
    return s;
  }

  s = startQuarter(s, q + 1, rng);
  s.report = { ...report, news: newsIds(s, newsBefore) };
  const first = s.order[s.turnPos];
  pushEvent(s, { type: 'quarter', q });
  pushEvent(s, { type: 'turn', company: first });
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
function checkEnd(state: AirlineState, reports: QuarterReport['companies'], q: number): AirlineState {
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
    const r = checkChallenge(def, s, ch.company, reports, q, ch.streak, ch.startValue);
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
  if (q >= endQ(s)) return finish({ winners: best(alive), reason: s.options.mode === 'years' ? `${s.options.years}년이 지나 회사 가치 1등이 이겼어요` : '아주 오래 걸려서 회사 가치 1등이 이겼어요' });
  return s;
}

/** 중고 시장: 오래된 매물은 빠지고 몇 대가 새로 나온다 */
export function refreshMarket(state: AirlineState, rng: Rng): AirlineState {
  const year = yearOf(state.q);
  let market = state.market.filter((u) => u.listed >= state.q - 4);
  let nextId = state.nextId;
  const pool = MODELS.filter((m) => m.intro <= year - 3 && m.intro >= year - 24 && m.end >= year - 12);
  const add = Math.min(10 - market.length, 2 + Math.floor(rng() * 2));
  for (let k = 0; k < add && pool.length; k++) {
    const m = pool[Math.floor(rng() * pool.length)];
    const age = Math.max(2, Math.min(year - m.intro, 3 + Math.floor(rng() * 10)));
    const price = Math.max(10, Math.round(m.price * Math.max(0.12, 1 - 0.045 * age) * 0.82));
    market = [...market, { id: nextId, model: m.id, age, price, listed: state.q }];
    nextId += 1;
  }
  return { ...state, market, nextId };
}

/** 다음 분기를 연다: 시간·유가·사건·뉴스·인도·결정 사건·목표·순서 */
function startQuarter(state: AirlineState, q: number, rng: Rng): AirlineState {
  let s: AirlineState = { ...state, q, effects: state.effects.filter((e) => e.until > q) };
  // 유가는 보통 값 쪽으로 천천히 돌아간다 (기름값 폭풍 과제는 높게)
  const target = oilTarget(s);
  const noise = (rng() - 0.5) * 0.06;
  s.oil = Math.round(Math.max(0.5, Math.min(3, s.oil + (target - s.oil) * 0.1 + noise)) * 100) / 100;
  if (s.challenge?.id === 'oilstorm' && q === qOf(1973, 4)) {
    s.oil = 1.9;
    s = addNews(s, { icon: '⛽', title: '기름값 폭풍!', text: '기름값이 갑자기 거의 두 배로 뛰었어요. 연료를 많이 먹는 비행기는 큰 손해를 봐요.', tone: 'bad' });
  }
  if (quarterOf(q) === 1) s = announceYear(s);
  // 올림픽·엑스포
  for (const e of FIXED_EVENTS) {
    if (e.year === yearOf(q) && e.quarters[0] === quarterOf(q)) {
      s = addNews(s, {
        icon: FIXED_ICON[e.kind],
        title: `${e.title}가 열려요`,
        text: `${CITY[e.city].name}을 오가는 손님이 크게 늘어요. 노선과 좌석을 늘려 두면 좋아요!`,
        tone: 'big',
        city: e.city,
      });
    }
  }
  // 무작위 사건
  const activeCities = [...new Set(s.companies.flatMap((c) => c.routes.flatMap((r) => [r.a, r.b])))];
  const rolls = rng() < 0.45 ? (rng() < 0.2 ? 2 : 1) : 0;
  for (let k = 0; k < rolls; k++) {
    const ev = rollRandomEvent({ q, oil: s.oil, rate: s.rate, slotBoost: s.slotBoost, effects: s.effects, activeCities }, rng);
    if (!ev) continue;
    if (ev.oil) s = { ...s, oil: Math.round(Math.max(0.5, Math.min(3, s.oil * ev.oil)) * 100) / 100 };
    if (ev.rate) s = { ...s, rate: Math.round(Math.max(2, Math.min(14, s.rate + ev.rate)) * 10) / 10 };
    if (ev.slot) s = { ...s, slotBoost: { ...s.slotBoost, [ev.slot.city]: Math.round(((s.slotBoost[ev.slot.city] ?? 0) + ev.slot.add) * 100) / 100 } };
    if (ev.effect) s = { ...s, effects: [...s.effects, { ...ev.effect, id: s.nextId } as (typeof s.effects)[number]], nextId: s.nextId + 1 };
    s = addNews(s, ev.news);
  }
  s = refreshMarket(s, rng);

  // 회사마다: 주문한 비행기 인도, 지난 효과 정리, 결정 사건, 새해 목표
  const year = yearOf(q);
  const companies = s.companies.map(cloneCompany);
  s = { ...s, companies };
  companies.forEach((c, ci) => {
    if (c.out) return;
    c.taken = 0;
    c.mods = c.mods.filter((m) => m.until > q);
    const due = c.orders.filter((o) => o.due <= q);
    for (const o of due) {
      c.planes.push({ id: s.nextId, model: o.model, leased: false, rent: 0, deposit: 0, since: q, legs: [] });
      s.nextId += 1;
      c.stats.bought += 1;
      c.acc.bought += 1;
    }
    c.orders = c.orders.filter((o) => o.due > q);
    if (due.length && c.kind === 'human') {
      s = addNews(s, { icon: '📦', title: `${c.name}: 새 비행기 인도`, text: `주문한 ${due.map((o) => MODEL[o.model].name).join(', ')}이 도착했어요. 노선에 넣어 주세요.`, tone: 'good', for: [ci] });
    }
    if (quarterOf(q) === 1) {
      c.acc = freshAcc(s, ci, year, c.acc.pax);
      c.goals = newGoals(s, ci, rng);
    }
    if (!c.choice && q >= c.nextChoiceQ) {
      const draft = makeChoice(s, ci, rng);
      if (draft) {
        c.choice = { ...draft, id: s.nextId };
        s.nextId += 1;
      }
      c.nextChoiceQ = q + nextChoiceGap(rng);
    }
  });
  // 컴퓨터가 가끔 제휴를 제안한다
  companies.forEach((c, ci) => {
    if (c.out || c.kind === 'human' || c.partner !== null || q < s.startQ + 6 || rng() > 0.1) return;
    let best = -1;
    let bestScore = 0.5;
    companies.forEach((t, ti) => {
      if (ti === ci || t.out || t.partner !== null) return;
      const sc = allianceScore(s, ci, ti) + (t.kind === 'human' ? 0 : 0);
      if (sc > bestScore) {
        bestScore = sc;
        best = ti;
      }
    });
    if (best < 0) return;
    const t = companies[best];
    if (t.kind === 'human') {
      if (t.choice) return;
      t.choice = { ...allianceChoice(s, ci, best), id: s.nextId };
      s.nextId += 1;
    } else {
      c.partner = best;
      t.partner = ci;
      s = addNews(s, { icon: '🤝', title: `${c.name}·${t.name} 제휴`, text: '두 회사가 공동 운항을 시작했어요.', tone: 'info', company: ci });
    }
  });
  // 순서는 분기마다 한 칸씩 돌린다
  const alive = s.companies.map((c, i) => (c.out ? -1 : i)).filter((i) => i >= 0);
  const shift = (q - s.startQ) % Math.max(1, alive.length);
  const order = [...alive.slice(shift), ...alive.slice(0, shift)];
  return { ...s, order, turnPos: 0 };
}

export function oilTarget(state: AirlineState): number {
  if (state.challenge?.id === 'oilstorm' && state.q >= qOf(1973, 4)) return 1.9;
  return 1;
}

/** 해가 바뀔 때 뉴스: 새 기종, 생산 끝, 공항이 커짐, 올해 행사 */
function announceYear(state: AirlineState): AirlineState {
  let s = state;
  const year = yearOf(s.q);
  const first = s.q === s.startQ;
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
    if (e.year === year && e.quarters[0] !== 1) {
      s = addNews(s, {
        icon: FIXED_ICON[e.kind],
        title: `올해 ${e.quarters[0]}분기에 ${e.title}`,
        text: `${CITY[e.city].name}에서 ${e.title}가 열려요. 그 무렵 손님이 크게 늘 거예요.`,
        tone: 'info',
        city: e.city,
      });
    }
  }
  return s;
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
