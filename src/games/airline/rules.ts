import { withJosa } from '../../lib/korean';
import { MODEL, MODELS, isAvailable } from './aircraft';
import { CHALLENGE, challengeDeadline, checkChallenge } from './challenges';
import { AIRPORT_INFO, CITIES, CITY, REGIONS, airportClass, citySize, dist, pairKey } from './cities';
import { FIXED_EVENTS, FIXED_ICON, rollRandomEvent } from './events';
import {
  adScale,
  branchCost,
  businessCost,
  companyValue,
  computeQuarter,
  creditLimit,
  LEASE_RATE,
  leaseDeposit,
  leaseRent,
  MAX_DELIVERIES,
  maxFreq,
  modelPrice,
  planeValue,
  regionsServed,
  reputationTarget,
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
  Company,
  DistOmit,
  GameEvent,
  GameResult,
  NewsItem,
  QuarterReport,
  RegionId,
  Rng,
  Route,
  SeatIndex,
} from './types';

export const DEFAULT_OPTIONS: AirlineOptions = {
  era: 1983,
  mode: 'years',
  years: 20,
  goalValue: 20000,
  goalRegions: 6,
  money: 'normal',
  challenge: null,
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

/** 지점·노선 수 한도 (화면과 계산이 너무 무거워지지 않게) */
export const MAX_ROUTES = 32;
export const MAX_PLANES = 60;

export const FARE_MIN = -30;
export const FARE_MAX = 30;
export const ADS_MAX = 300;

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

function newCompany(seat: SeatIndex, kind: Company['kind'], name: string, hub: string, cash: number, credit: number): Company {
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
  };
}

function baseState(options: AirlineOptions, year: number, companies: Company[]): AirlineState {
  const q = qOf(year, 1);
  return {
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
  // 사람이 고른 본사부터 정하고, 나머지는 저절로
  const active = setup.seats.map((s, i) => ({ s, i })).filter((x) => x.s.kind !== 'empty');
  const hubs = new Map<number, string>();
  const valid = hubCandidates(year);
  for (const { i } of active) {
    const h = setup.hubs[i];
    if (h && valid.includes(h) && !taken.includes(h)) {
      hubs.set(i, h);
      taken.push(h);
    }
  }
  for (const { i } of active) {
    if (hubs.has(i)) continue;
    const h = autoHub(year, taken, rng);
    hubs.set(i, h);
    taken.push(h);
  }
  const companies = active.map(({ s, i }) =>
    newCompany(i as SeatIndex, s.kind as Company['kind'], companyName(s.name, i), hubs.get(i)!, cash, Math.round(cash * 0.5)),
  );
  let state = baseState(opts, year, companies);
  state = addNews(state, {
    icon: '✈️',
    title: `${year}년, 하늘길 경영을 시작해요`,
    text: `하늘을 두고 겨루는 회사: ${companies.map((c) => `${c.name}(본사 ${CITY[c.hub].name})`).join(', ')}`,
    tone: 'big',
  });
  state = announceYear(state);
  state = { ...state, history: [historyPoint(state, state.q - 1)] };
  return finishStart(state);
}

function createChallenge(setup: AirlineSetup, opts: AirlineOptions, rng: Rng): AirlineState {
  const def = CHALLENGE[opts.challenge!];
  // 도전하는 회사: 사람 자리 (사람이 없으면 첫 자리, 컴퓨터끼리 시험할 때)
  const humanSeat = setup.seats.findIndex((s) => s.kind === 'human');
  const seat = humanSeat >= 0 ? humanSeat : Math.max(0, setup.seats.findIndex((s) => s.kind !== 'empty'));
  const kind = (setup.seats[seat]?.kind === 'empty' ? 'human' : (setup.seats[seat]?.kind ?? 'human')) as Company['kind'];
  const me = newCompany(0, kind, companyName(setup.seats[seat]?.name ?? '', 0), def.hub, def.cash, def.credit ?? Math.round(def.cash * 0.5));
  me.debt = def.debt ?? 0;
  if (def.branches) me.branches = [...new Set([def.hub, ...def.branches])];
  const rivals = def.rivals.map((r, k) => newCompany((k + 1) as SeatIndex, r.kind, DEFAULT_NAMES[k + 1], r.hub, 2500, 1250));
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
        since: state.q - Math.round(f.age * 4),
        route: routeId,
        freq: routeId !== null ? Math.min(f.freq ?? 7, maxFreq(m, dist(f.route![0], f.route![1]))) : 0,
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
    history: [historyPoint(state, state.q - 1)],
  };
  void rng;
  return finishStart(state);
}

function finishStart(state: AirlineState): AirlineState {
  const s = addLog(state, null, `🛫 ${qLabel(state.q)}: ${state.companies.map((c) => c.name).join(', ')} 출발!`);
  return { ...s, events: [{ id: s.nextEventId, type: 'start' }, { id: s.nextEventId + 1, type: 'turn', company: s.order[0] }], nextEventId: s.nextEventId + 2 };
}

// ------------------------------------------------------------------ 기록

export function addLog(state: AirlineState, seat: SeatIndex | null, text: string): AirlineState {
  const log = [...state.log, { id: state.nextLogId, seat, text }];
  return { ...state, log: log.length > 80 ? log.slice(-80) : log, nextLogId: state.nextLogId + 1 };
}

export function addNews(state: AirlineState, item: Omit<NewsItem, 'id' | 'q'>): AirlineState {
  const news = [...state.news, { ...item, id: state.nextId, q: state.q }];
  return { ...state, news: news.length > 60 ? news.slice(-60) : news, nextId: state.nextId + 1 };
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

export function planeById(c: Company, id: number) {
  return c.planes.find((p) => p.id === id);
}

export function routeById(c: Company, id: number) {
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

export function buyBlocker(state: AirlineState, ci: number, modelId: string, lease: boolean): string | null {
  const c = state.companies[ci];
  const m = MODEL[modelId];
  if (!m) return '없는 기종이에요';
  if (!isAvailable(m, yearNow(state))) return yearNow(state) < m.intro ? `${m.intro}년에 나와요` : '생산이 끝난 기종이에요';
  if (c.planes.length >= MAX_PLANES) return `비행기는 ${MAX_PLANES}대까지예요`;
  if (deliveriesThisQuarter(state, ci) >= MAX_DELIVERIES) return `한 분기에 ${MAX_DELIVERIES}대까지만 받을 수 있어요`;
  const cost = lease ? leaseDeposit(state, m) : modelPrice(state, m);
  if (c.cash < cost) return `돈이 모자라요 (${fmtMoney(cost)} 필요)`;
  return null;
}

/** 이번 분기에 새로 받은 비행기 수 */
export function deliveriesThisQuarter(state: AirlineState, ci: number): number {
  return state.companies[ci].planes.filter((p) => p.since === state.q).length;
}

export function sellBlocker(state: AirlineState, ci: number, planeId: number): string | null {
  const c = state.companies[ci];
  const p = planeById(c, planeId);
  if (!p) return '없는 비행기예요';
  if (p.leased && c.cash < p.rent) return `반납 위약금 ${fmtMoney(p.rent)}이 모자라요`;
  return null;
}

/** 이 비행기를 이 노선에 이 횟수로 띄울 수 있는지 */
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
  const max = maxFreq(m, d);
  if (!Number.isInteger(freq) || freq < 1) return '횟수는 1 이상이에요';
  if (freq > max) return `이 노선은 한 주에 ${max}번까지만 왕복할 수 있어요`;
  for (const city of [r.a, r.b]) {
    const left = slotCapacity(state, ci, city) - slotsUsed(c, city, p.id);
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
  let f = maxFreq(m, dist(r.a, r.b));
  for (const city of [r.a, r.b]) f = Math.min(f, slotCapacity(state, ci, city) - slotsUsed(c, city, p.id));
  if (f < 1) return 0;
  return assignBlocker(state, ci, planeId, routeId, f) === null ? f : 0;
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

// ------------------------------------------------------------------ 행동

function cloneCompany(c: Company): Company {
  return {
    ...c,
    branches: [...c.branches],
    routes: c.routes.map((r) => ({ ...r })),
    planes: c.planes.map((p) => ({ ...p })),
    ads: { ...c.ads },
    awareness: { ...c.awareness },
    businesses: c.businesses.map((b) => ({ ...b })),
    stats: { ...c.stats },
  };
}

/** 지금 회사 하나만 바꾼 새 상태 */
function edit(state: AirlineState, ci: number, fn: (c: Company, s: AirlineState) => void): AirlineState {
  const companies = state.companies.slice();
  const c = cloneCompany(companies[ci]);
  companies[ci] = c;
  const s: AirlineState = { ...state, companies, events: [] };
  fn(c, s);
  return s;
}

function pushEvent(s: AirlineState, e: DistOmit<GameEvent, 'id'>): void {
  s.events = [...s.events, { ...e, id: s.nextEventId } as GameEvent];
  s.nextEventId += 1;
}

const near = (v: number) => Math.round(v * 10) / 10;

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
      const s = edit(state, ci, (c, s) => {
        c.cash -= cost;
        c.branches.push(action.city);
        pushEvent(s, { type: 'branch', company: ci, city: action.city });
      });
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
      const s = edit(state, ci, (c, s) => {
        c.routes.push({ id: s.nextId, a: action.a, b: action.b, fare: 0, since: s.q, stats: null });
        s.nextId += 1;
        c.stats.opened += 1;
        pushEvent(s, { type: 'route', company: ci, a: action.a, b: action.b });
      });
      return addLog(s, seat, `${c0.name}: ${CITY[action.a].name}–${CITY[action.b].name} 노선 열기`);
    }
    case 'closeRoute': {
      const r = routeById(c0, action.route);
      if (!r) return state;
      const s = edit(state, ci, (c, s) => {
        c.routes = c.routes.filter((x) => x.id !== r.id);
        for (const p of c.planes) {
          if (p.route === r.id) {
            p.route = null;
            p.freq = 0;
          }
        }
        pushEvent(s, { type: 'closeRoute', company: ci, a: r.a, b: r.b });
      });
      return addLog(s, seat, `${c0.name}: ${CITY[r.a].name}–${CITY[r.b].name} 노선 닫기`);
    }
    case 'buy':
    case 'lease': {
      const lease = action.type === 'lease';
      if (buyBlocker(state, ci, action.model, lease)) return state;
      const m = MODEL[action.model];
      const price = modelPrice(state, m);
      const rent = leaseRent(state, m);
      const deposit = leaseDeposit(state, m);
      const s = edit(state, ci, (c, s) => {
        // 리스는 두 분기 치 리스료를 계약금으로 낸다
        c.cash -= lease ? deposit : price;
        c.planes.push({ id: s.nextId, model: m.id, leased: lease, rent: lease ? rent : 0, since: s.q, route: null, freq: 0 });
        s.nextId += 1;
        c.stats.bought += 1;
        pushEvent(s, { type: 'plane', company: ci, model: m.id, leased: lease });
      });
      return addLog(s, seat, lease ? `${c0.name}: ${m.name} 리스 (계약금 ${fmtMoney(deposit)})` : `${c0.name}: ${m.name} 새로 사기 (−${fmtMoney(price)})`);
    }
    case 'sell': {
      if (sellBlocker(state, ci, action.plane)) return state;
      const p = planeById(c0, action.plane)!;
      const m = MODEL[p.model];
      const amount = p.leased ? -p.rent : sellPrice(state, p);
      const s = edit(state, ci, (c, s) => {
        c.cash += amount;
        c.planes = c.planes.filter((x) => x.id !== p.id);
        pushEvent(s, { type: 'sell', company: ci, model: m.id, amount });
      });
      return addLog(s, seat, p.leased ? `${c0.name}: ${m.name} 리스 반납 (위약금 ${fmtMoney(-amount)})` : `${c0.name}: ${m.name} 팔기 (+${fmtMoney(amount)})`);
    }
    case 'assign': {
      const p = planeById(c0, action.plane);
      if (!p) return state;
      if (action.route === null) {
        return edit(state, ci, (c) => {
          const x = planeById(c, action.plane)!;
          x.route = null;
          x.freq = 0;
        });
      }
      if (assignBlocker(state, ci, action.plane, action.route, action.freq)) return state;
      const r = routeById(c0, action.route)!;
      const s = edit(state, ci, (c, s) => {
        const x = planeById(c, action.plane)!;
        x.route = action.route;
        x.freq = action.freq;
        pushEvent(s, { type: 'assign', company: ci, route: r.id });
      });
      return p.route === action.route
        ? s
        : addLog(s, seat, `${c0.name}: ${MODEL[p.model].name} → ${CITY[r.a].name}–${CITY[r.b].name} 주 ${action.freq}회`);
    }
    case 'setFreq': {
      const p = planeById(c0, action.plane);
      if (!p || p.route === null) return state;
      if (assignBlocker(state, ci, action.plane, p.route, action.freq)) return state;
      return edit(state, ci, (c) => {
        planeById(c, action.plane)!.freq = action.freq;
      });
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
        c.businesses = c.businesses.filter((x) => x !== c.businesses.find((y) => y.city === action.city && y.kind === action.kind));
      });
      return addLog(s, seat, `${c0.name}: ${CITY[action.city].name} ${action.kind === 'hotel' ? '호텔' : '여행사'} 팔기 (+${fmtMoney(refund)})`);
    }
    case 'endTurn':
      return endTurn(state, rng);
  }
  return state;
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
      r.stats = { lf: st.lf, pax: Math.round(st.pax), revenue: st.revenue, profit: st.profit, lossStreak, share: st.share };
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
  });

  for (const ci of bankrupts) {
    const c = companies[ci];
    c.out = true;
    c.planes = [];
    c.routes = [];
    c.businesses = [];
    c.branches = [c.hub];
    c.ads = emptyRegions();
    s = addNews(s, { icon: '💥', title: `${c.name} 파산`, text: `${withJosa(c.name, '이/가')} 두 분기 내내 돈이 모자라서 문을 닫았어요.`, tone: 'bad' });
    s = addLog(s, c.seat, `💥 ${c.name} 파산`);
    pushEvent(s, { type: 'bankrupt', company: ci });
  }

  out.reports.forEach((rep, ci) => {
    rep.value = Math.round(companyValue(s, ci));
    rep.cash = Math.round(companies[ci].cash);
    rep.debt = Math.round(companies[ci].debt);
  });
  const report: QuarterReport = { q, companies: out.reports, routes: out.routes, news: [] };
  const hist = [...s.history, historyPoint(s, q, report)];
  s = { ...s, report, history: hist.length > 200 ? hist.slice(-200) : hist };

  // 결과 기록
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
      return finish({ winners: [], reason: s.companies[ch.company].out ? '회사가 파산했어요' : '기한 안에 목표를 이루지 못했어요', success: false });
    }
    return s;
  }

  const humans = s.companies.map((c, i) => (c.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  if (alive.length === 0) return finish({ winners: [], reason: '모든 회사가 파산했어요' });
  if (alive.length === 1 && s.companies.length > 1) return finish({ winners: alive, reason: `${s.companies[alive[0]].name}만 남았어요` });
  if (humans.length > 0 && humans.every((i) => s.companies[i].out)) return finish({ winners: best(alive), reason: '사람 회사가 모두 파산했어요' });

  if (s.options.mode === 'goal') {
    const goal = s.options.goalValue;
    const need = s.options.goalRegions;
    const done = alive.filter((i) => values[i] >= goal && regionsServed(s.companies[i]).size >= need);
    if (done.length > 0) return finish({ winners: best(done), reason: `${need}개 지역 취항 + 회사 가치 ${fmtMoney(goal)} 목표를 먼저 이뤘어요` });
  }
  if (q >= endQ(s)) return finish({ winners: best(alive), reason: s.options.mode === 'years' ? `${s.options.years}년이 지나 회사 가치 1등이 이겼어요` : '아주 오래 걸려서 회사 가치 1등이 이겼어요' });
  return s;
}

/** 다음 분기를 연다: 시간·유가·사건·뉴스·순서 */
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
    if (ev.effect) s = { ...s, effects: [...s.effects, { ...ev.effect, id: s.nextId } as typeof s.effects[number]], nextId: s.nextId + 1 };
    s = addNews(s, ev.news);
  }
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
      text: fresh.map((m) => `${m.name}(${m.maker}) — ${m.seats}석, ${m.range.toLocaleString()}km. ${m.note}`).join(' / '),
      tone: 'info',
    });
  }
  if (!first) {
    const ended = MODELS.filter((m) => m.end === year - 1);
    if (ended.length > 0) {
      s = addNews(s, {
        icon: '🔚',
        title: `생산 끝: ${ended.map((m) => m.name).join(', ')}`,
        text: '더는 새로 사거나 리스할 수 없어요. 가진 비행기는 계속 날 수 있지만 값이 조금 떨어져요.',
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

/** 회사 가치·현금·노선 수 등 요약 */
export function companySummary(state: AirlineState, ci: number) {
  const c = state.companies[ci];
  return {
    value: companyValue(state, ci),
    planes: c.planes.length,
    routes: c.routes.length,
    flying: c.planes.filter((p) => p.route !== null && p.freq > 0).length,
    regions: regionsServed(c).size,
    limit: creditLimit(state, ci),
  };
}

export function idlePlanes(c: Company) {
  return c.planes.filter((p) => p.route === null || p.freq === 0);
}

export function planeWorth(state: AirlineState, ci: number, planeId: number): number {
  const p = planeById(state.companies[ci], planeId);
  return p ? planeValue(state, p) : 0;
}

export { branchCost, businessCost, creditLimit, companyValue, maxFreq, slotCapacity, slotsUsed, leaseRent, leaseDeposit, modelPrice, sellPrice };
