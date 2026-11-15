import { withJosa } from '../../lib/korean';
import { seededRandom, type Rng } from '../../lib/random';
import { SEAT_COLORS } from '../common/players';
import { CARGO_NAMES, LCC_NAMES, setBizModelAtStart } from './bizmodel';
import { coColors, distinctColors, gameHub, usableColor } from './brand';
import { CITIES, CITY, airportClass, citySize } from './cities';
import { freshAcc, newGoals } from './goals';
import { hash01, strHash } from './personality';
import { polity } from './politics';
import { REAL_AIRLINE, REAL_AIRLINES, airlinesAt, type RealAirline } from './realAirlines';
import { extendRivalBook, fixRivalBook } from './relations';
import { baseValue, companyValue, emptyReport, planeAge, planeValue, yearProfit } from './simulate';
import { buyoutCost } from './stocks';
import { monthOf, mOf, yearOfM } from './time';
import type { AirlineState, BizModel, Choice, Company, IndustryEntry, NewsItem, QuarterReport, RegionId, SeatIndex } from './types';

/*
 * 시장 변화 (업계): 경쟁 항공사가 새로 생기고, 문을 닫고(법정 관리를 거치기도), 다른 회사에 인수된다.
 * - 실제 항공사·실제 역사를 켠 판: 실제 항공사가 실제 해 무렵 위기를 맞아 문을 닫거나 합쳐지고(경영이 튼튼하면 살아남기도),
 *   새 이름으로 바뀌고, 그 해에 생긴 실제 항공사가 경쟁에 뛰어든다.
 * - 그 밖에는 경영 결과로: 돈이 바닥난 컴퓨터 회사는 사람 회사가 사들이거나(인수 제안), 다른 컴퓨터가 싸게 사들이거나,
 *   법정 관리로 한 번 다시 날고, 그래도 안 되면 문을 닫는다. 빈자리가 생기거나 장사가 잘되는 시절이면 새 회사가 생긴다.
 * - 동시에 나는 회사는 MAX_ACTIVE까지. 사람 회사는 역사에 끌려가지 않고 컴퓨터에게 인수되지도 않는다.
 * 라이벌 일처럼 주사위(rng) 대신 판 씨앗(hash01)을 써서 다른 무작위(사건·날씨·운항)의 순서를 바꾸지 않는다.
 */

/** 동시에 날 수 있는 회사 수 */
export const MAX_ACTIVE = 6;
/** 판 하나에 적어 둘 수 있는 회사 수 (문을 닫은 회사도 기록으로 남는다) */
export const MAX_COMPANIES = 12;
/** 실제 역사의 위기는 이만큼 달 전부터 */
export const FATE_LEAD = 18;
/** 위기 동안 손님 배수와 승무원·판매 비용 배수 */
export const FATE_DEMAND = 0.9;
export const FATE_COST = 1.06;
/** 시작하고 이만큼 달 동안은 새 회사가 생기지 않는다 (실제 역사의 창업은 빼고) */
export const ENTRY_GRACE = 24;
/** 돈이 바닥난 회사를 사들이는 값 (보통 인수 값에 견준 비율) */
export const RESCUE_RATE = 0.6;
/** 법정 관리: 남는 빚의 비율, 손님 배수와 그 기간 */
export const PROTECT_DEBT = 0.4;
export const PROTECT_DEMAND = 0.94;
export const PROTECT_MONTHS = 12;
/** 새로 생긴 회사는 이만큼 달 동안 컴퓨터가 주식으로 사들이지 않는다 (창업자가 내놓지 않는다) */
export const YOUNG_MONTHS = 48;
/** 회사를 합친 컴퓨터는 이만큼 달 동안 다른 회사를 사냥하지 않는다 (합친 회사를 소화하는 동안) */
export const DIGEST_MONTHS = 36;
/** 업계 연표 길이 */
const LOG_MAX = 80;

/**
 * 시장 변화를 켠 판인지 (없으면 켜짐). 세계 항공사 모드(world.ts)는 실제 항공사 명단과 해마다의 역사·구조 조정을
 * 따로 가지고 있어서 여기 규칙을 쓰지 않는다.
 */
export const industryOn = (state: Pick<AirlineState, 'options'>) => state.options.industry !== false && !state.options.world;
/** 실제 항공사의 역사를 따르는지: 실제 항공사 이름 + 실제 역사 + 시장 변화 */
export const realHistoryOn = (state: Pick<AirlineState, 'options'>) => industryOn(state) && state.options.names === 'real' && state.options.history !== false;

// ------------------------------------------------------------------ 실제 항공사의 역사 (값은 어림)

export interface AirlineFate {
  /** 실제 항공사 id (realAirlines.ts) */
  id: string;
  year: number;
  month: number;
  /** cease: 문을 닫는다, merge: 다른 회사에 합쳐진다, rename: 이름을 바꾼다 */
  kind: 'cease' | 'merge' | 'rename';
  /** 합친 회사나 새 이름의 실제 항공사 id */
  into?: string;
  /** 목록에 없는 회사에 합쳐졌으면 그 이름 */
  intoName?: string;
  /** 까닭 (실제 역사를 짧게) */
  why: string;
}

export const AIRLINE_FATES: readonly AirlineFate[] = [
  { id: 'boac', year: 1974, month: 4, kind: 'rename', into: 'britishairways', why: '영국유럽항공(BEA)과 합쳐 영국항공이 됐어요.' },
  { id: 'airlanka', year: 1999, month: 1, kind: 'rename', into: 'srilankan', why: '에어랑카가 이름을 스리랑카항공으로 바꿨어요.' },
  { id: 'lan', year: 2016, month: 5, kind: 'rename', into: 'latam', why: '브라질 TAM과 합쳐 라탐항공이 됐어요.' },
  { id: 'panam', year: 1991, month: 12, kind: 'cease', why: '석유 파동과 규제 완화 뒤 빚이 쌓이고, 걸프 전쟁으로 손님이 줄었어요.' },
  { id: 'twa', year: 2001, month: 4, kind: 'merge', into: 'american', why: '오랜 적자와 빚에 시달렸어요.' },
  { id: 'swissair', year: 2001, month: 10, kind: 'cease', why: '다른 항공사 주식을 너무 많이 사들여 빚이 커졌어요.' },
  { id: 'varig', year: 2006, month: 7, kind: 'cease', why: '빚과 경영난이 오래 이어졌어요.' },
  { id: 'northwest', year: 2010, month: 1, kind: 'merge', into: 'delta', why: '9·11 뒤 손님이 줄어 오랫동안 회생 절차를 밟았어요.' },
  { id: 'alitalia', year: 2021, month: 10, kind: 'cease', why: '오랜 적자에 코로나19까지 겹쳤어요.' },
  { id: 'hawaiian', year: 2024, month: 9, kind: 'merge', intoName: '알래스카항공', why: '코로나19 뒤 손님이 늦게 돌아왔어요.' },
  { id: 'asiana', year: 2024, month: 12, kind: 'merge', into: 'korean', why: '코로나19 뒤 빚이 커졌어요.' },
];

export const FATE: Record<string, AirlineFate> = Object.fromEntries(AIRLINE_FATES.map((f) => [f.id, f]));
export const fateT = (f: AirlineFate) => mOf(f.year, f.month);

/** 앞 회사가 판에서 날고 있으면 들어오지 않는 뒤 회사 (이름을 바꾸거나, 문을 닫은 뒤 뒤를 이은 회사) */
export const PREDECESSOR: Record<string, string> = {
  britishairways: 'boac',
  srilankan: 'airlanka',
  latam: 'lan',
  swiss: 'swissair',
  ita: 'alitalia',
};

/** 실제 항공사가 날기 시작한 달 (없으면 그 해 1월) */
export const ENTRY_MONTH: Record<string, number> = {
  airnewzealand: 4,
  korean: 3,
  egyptair: 10,
  singapore: 10,
  malaysia: 10,
  aeromexico: 6,
  gulfair: 1,
  britishairways: 4,
  kenya: 2,
  airlanka: 9,
  emirates: 10,
  asiana: 12,
  airchina: 7,
  chinaeastern: 6,
  vietnam: 4,
  qatar: 1,
  srilankan: 1,
  swiss: 4,
  latam: 5,
  ita: 10,
};
export const entryMonth = (id: string) => ENTRY_MONTH[id] ?? 1;

// ------------------------------------------------------------------ 작은 도움

const fmt = (v: number) => (Math.abs(v) >= 10000 ? `${(v / 10000).toFixed(1).replace(/\.0$/, '')}조` : `${Math.round(v).toLocaleString('ko-KR')}억`);

function addNews(state: AirlineState, item: Omit<NewsItem, 'id' | 't'>): AirlineState {
  const news = [...state.news, { ...item, id: state.nextId, t: state.t }];
  return { ...state, news: news.length > 70 ? news.slice(-70) : news, nextId: state.nextId + 1 };
}

function addLog(state: AirlineState, seat: SeatIndex | null, text: string): AirlineState {
  const log = [...state.log, { id: state.nextLogId, seat, text }];
  return { ...state, log: log.length > 80 ? log.slice(-80) : log, nextLogId: state.nextLogId + 1 };
}

/** 업계 연표에 한 줄 */
export function logIndustry(state: AirlineState, entry: Omit<IndustryEntry, 't'> & { t?: number }): AirlineState {
  const list = [...(state.industry ?? []), { t: state.t, ...entry }];
  return { ...state, industry: list.length > LOG_MAX ? list.slice(-LOG_MAX) : list };
}

function pushEvent(s: AirlineState, company: number, what: 'enter' | 'rescue' | 'rename'): AirlineState {
  return { ...s, events: [...s.events, { id: s.nextEventId, type: 'industry', company, what }], nextEventId: s.nextEventId + 1 };
}

/** 회사 하나를 고친 새 상태 (노선·비행기·효과는 베껴서) */
function editCo(state: AirlineState, ci: number, fn: (c: Company) => void): AirlineState {
  const companies = state.companies.slice();
  const c0 = companies[ci];
  const c: Company = {
    ...c0,
    mods: [...c0.mods],
    routes: c0.routes.map((r) => ({ ...r })),
    planes: c0.planes.map((p) => ({ ...p, legs: p.legs.map((l) => ({ ...l })) })),
    orders: [...c0.orders],
  };
  fn(c);
  companies[ci] = c;
  return { ...state, companies };
}

/** 판 씨앗 (첫 회사의 본사와 시작 달: 회사가 늘거나 이름이 바뀌어도 그대로) */
export function industrySalt(state: Pick<AirlineState, 'startT' | 'companies'>): number {
  return strHash(`industry|${state.startT}|${state.companies[0]?.hub ?? ''}`);
}

export const aliveCount = (state: Pick<AirlineState, 'companies'>) => state.companies.filter((c) => !c.out).length;

/** 이 달에 이 회사가 있었는지 (판 가운데 생긴 회사는 들어온 달부터) */
export function existedAt(c: Pick<Company, 'born'>, t: number): boolean {
  return c.born === undefined || t >= c.born;
}

/** 새로 생긴 지 얼마 안 된 회사인지 */
export function isYoung(state: Pick<AirlineState, 't'>, c: Pick<Company, 'born'>): boolean {
  return c.born !== undefined && state.t - c.born < YOUNG_MONTHS;
}

/** 이 회사가 최근에 다른 회사를 합쳤는지 */
export function recentlyMerged(state: Pick<AirlineState, 't' | 'industry'>, ci: number): boolean {
  return (state.industry ?? []).some((e) => e.kind === 'merge' && e.other === ci && state.t - e.t < DIGEST_MONTHS);
}

/** 판에서 빠진 까닭 한 마디 (결과·순위표) */
export function exitLabel(state: Pick<AirlineState, 'companies'>, c: Company): string {
  if (c.mergedInto !== undefined) return `${state.companies[c.mergedInto]?.name ?? '다른 회사'}에 인수`;
  return c.fate ?? '운항 중단';
}

// ------------------------------------------------------------------ 회사 늘리기

/**
 * 판에 회사를 하나 더한다: 주식 표·운수권·라이벌 장부·그래프 기록·결산의 회사 칸을 모두 한 칸씩 늘리고,
 * 올해 목표와 쌓은 숫자, 첫 결정 사건 날짜를 정한다. (해마다 결산은 늘리지 않는다: 그 해에 없던 회사는 빈칸)
 */
export function addCompany(state: AirlineState, company: Company, seed: number): AirlineState {
  const n = state.companies.length;
  const rivals = extendRivalBook(state, company, seed);
  const padReport = (r: QuarterReport): QuarterReport => ({ ...r, companies: [...r.companies, emptyReport()] });
  const s: AirlineState = {
    ...state,
    companies: [...state.companies, company],
    ...(state.stakes ? { stakes: [...state.stakes.map((row) => [...row, 0]), Array<number>(n + 1).fill(0)] } : {}),
    ...(state.rights ? { rights: { held: [...state.rights.held, []], apps: [...state.rights.apps, []] } } : {}),
    ...(rivals ? { rivals } : {}),
    history: state.history.map((h) => ({ ...h, value: [...h.value, 0], profit: [...h.profit, 0], pax: [...h.pax, 0] })),
    months: state.months.map((m) => ({
      ...m,
      value: [...m.value, 0],
      profit: [...m.profit, 0],
      revenue: [...m.revenue, 0],
      pax: [...m.pax, 0],
      lf: [...m.lf, 0],
      onTime: [...m.onTime, 0],
      staff: [...(m.staff ?? m.value.map(() => 0)), 0],
    })),
    report: state.report ? padReport(state.report) : null,
    qReport: state.qReport ? padReport(state.qReport) : null,
    ledger: state.ledger.map(padReport),
  };
  const rng = seededRandom(seed);
  s.companies[n] = { ...company, born: s.t, nextChoiceT: s.t + 6 + (seed % 5) };
  s.companies[n] = { ...s.companies[n], acc: freshAcc(s, n, yearOfM(s.t), 0), goals: newGoals(s, n, rng) };
  return s;
}

// ------------------------------------------------------------------ 새 회사

/** 새로 생긴 회사가 고를 수 있는 색 (실제 항공사의 칠 색을 빌리지 않는 회사) */
const ENTRANT_COLORS = ['#e8590c', '#8e4ec6', '#12a594', '#d6409f', '#a18072', '#46a758', '#0b84d8', '#c2410c', '#7c3aed', '#0f766e'];

/** 지어낸 새 회사 이름 (실제 항공사 이름은 쓰지 않는다) */
export const NEW_FULL_NAMES = ['새벽항공', '은하수항공', '단풍항공', '물결항공', '별빛항공', '솔바람항공', '무지개항공', '보름달항공'] as const;
export const NEW_LCC_NAMES = [...LCC_NAMES, '참새항공', '풍선항공', '싱싱항공', '두근항공'] as const;
export const NEW_CARGO_NAMES = [...CARGO_NAMES, '꾸러미화물', '황새화물', '상자날개화물', '등짐화물'] as const;

/** 저가항공 바람이 분 지역 (규제가 풀린 해 어림): 미국 1978, 유럽 1993, 아시아·오세아니아 2002 … */
const LCC_READY: Record<RegionId, number> = { americas: 1978, europe: 1993, seaoc: 2001, eastasia: 2004, southmid: 2005, africa: 2008 };

/** 본사가 될 수 있는 도시 (rules.ts hubCandidates와 같은 셈) */
function hubCities(year: number): string[] {
  return CITIES.filter((c) => airportClass(c, year) >= 2 && citySize(c, year) >= 2.5).map((c) => c.id);
}

function weighted<T>(items: readonly T[], weights: readonly number[], r: Rng): T | null {
  const total = weights.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return null;
  let x = r() * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i];
    if (x <= 0) return items[i];
  }
  return items[items.length - 1] ?? null;
}

/** 지어낸 새 회사의 본사: 남이 본사로 쓰지 않는 큰 도시 (저가항공은 관광지·규제가 풀린 지역, 화물은 사업 도시) */
function pickHub(state: AirlineState, year: number, model: BizModel, r: Rng): string | null {
  const alive = state.companies.filter((c) => !c.out);
  const taken = new Set(alive.map((c) => c.hub));
  const regions = new Set(alive.map((c) => CITY[c.hub].region));
  const history = state.options.history !== false;
  const cands = hubCities(year).filter((id) => !taken.has(id));
  const weights = cands.map((id) => {
    const c = CITY[id];
    const size = citySize(c, year);
    const closed = history && year < 1990 && ['중국', '소련', '베트남'].includes(polity(id, year));
    let w = size * size * (size >= 5 ? 1 : 0.3) * (closed ? 0.05 : 1) * (regions.has(c.region) ? 0.6 : 1);
    if (model === 'lcc') w *= (0.5 + c.fun / 10) * (year >= LCC_READY[c.region] ? 1 : 0.08);
    if (model === 'cargo') w *= 0.4 + c.biz;
    return w;
  });
  return weighted(cands, weights, r);
}

/** 새 회사의 자리(지도 모양): 지금 날고 있는 회사들이 덜 쓰는 모양 */
function pickSeat(state: AirlineState, seed: number): SeatIndex {
  const used = [0, 0, 0, 0];
  for (const c of state.companies) if (!c.out) used[c.seat] += 1;
  const min = Math.min(...used);
  const free = ([0, 1, 2, 3] as SeatIndex[]).filter((k) => used[k] === min);
  return free[seed % free.length];
}

/** 다른 회사와 한눈에 다른 색 */
function pickColor(state: AirlineState, airline: string | null): string {
  const others = state.companies.filter((c) => !c.out).map((c) => coColors(c).main);
  const far = (x: string) => others.every((o) => distinctColors(o, x));
  const real = airline ? REAL_AIRLINE[airline] : undefined;
  const own = real ? (real.colors.map(usableColor).filter(Boolean) as string[]) : [];
  const cands = [...own, ...ENTRANT_COLORS, ...[0, 1, 2, 3].map((i) => SEAT_COLORS[i as SeatIndex].main)];
  return cands.find(far) ?? own[0] ?? ENTRANT_COLORS[0];
}

/** 이 판에서 한 번이라도 날았던 실제 항공사 */
const usedAirlines = (state: AirlineState) => new Set(state.companies.map((c) => c.airline).filter((x): x is string => !!x));
const predecessorFlying = (state: AirlineState, id: string) => !!PREDECESSOR[id] && state.companies.some((c) => !c.out && c.airline === PREDECESSOR[id]);

/** 이 달에 날기 시작한 실제 항공사 (판이 시작한 뒤에 생긴 것, 아직 이 판에 없던 것) */
export function foundersAt(state: AirlineState, t: number): RealAirline[] {
  if (!realHistoryOn(state)) return [];
  const year = yearOfM(t);
  const month = monthOf(t);
  const used = usedAirlines(state);
  return REAL_AIRLINES.filter((a) => a.founded === year && a.founded > state.startYear && entryMonth(a.id) === month && !used.has(a.id) && !predecessorFlying(state, a.id));
}

export interface EntrantPlan {
  name: string;
  airline: string | null;
  hub: string;
  model: BizModel;
  cash: number;
  /** history: 실제로 그 해에 생김, real: 다른 하늘에서 날던 실제 항공사, gap: 빈자리를 노림, boom: 장사가 잘됨 */
  why: 'history' | 'real' | 'gap' | 'boom';
}

/** 새 회사가 들어올 자리가 있는지 */
export const roomForEntrant = (state: AirlineState) => aliveCount(state) < MAX_ACTIVE && state.companies.length < MAX_COMPANIES;

/** 지난 열두 달 업계 이익률 (날고 있는 회사 합) */
function industryMargin(state: AirlineState): number {
  let profit = 0;
  let revenue = 0;
  for (const l of state.ledger.slice(-12)) {
    l.companies.forEach((r, i) => {
      if (state.companies[i]?.out) return;
      profit += r.profit;
      revenue += r.ticket + r.side;
    });
  }
  return revenue > 0 ? profit / revenue : 0;
}

/** 이 달에 새 회사가 생길 가능성 (빈자리면 높고, 장사가 잘되는 시절·규제가 풀린 뒤면 조금 더) */
export function entryChance(state: AirlineState, t: number): { p: number; why: 'gap' | 'boom' } {
  if (!industryOn(state) || !roomForEntrant(state) || t - state.startT < ENTRY_GRACE) return { p: 0, why: 'boom' };
  const active = aliveCount(state);
  const initial = state.companies.filter((c) => c.born === undefined).length;
  const exits = (state.industry ?? []).filter((e) => e.kind === 'cease' || e.kind === 'merge');
  const sinceExit = exits.length ? t - exits[exits.length - 1].t : Infinity;
  if (active < initial) {
    if (initial >= 2 && active < 2) return { p: 0.25, why: 'gap' };
    return { p: sinceExit >= 6 ? 0.06 + 0.03 * (initial - active - 1) : 0, why: 'gap' };
  }
  const margin = industryMargin(state);
  const boom = margin >= 0.08 ? 2 : margin >= 0.03 ? 1.2 : margin < 0 ? 0.3 : 0.8;
  const year = yearOfM(t);
  const era = year >= 1995 && year < 2012 ? 1.8 : year >= 1978 && year < 1990 ? 1.4 : 1;
  // 하늘이 붐빌수록 새로 뛰어드는 회사가 적다
  const room = (MAX_ACTIVE - active) / MAX_ACTIVE;
  return { p: 0.006 * boom * era * room, why: 'boom' };
}

/** 실제 항공사 한 곳으로 새 회사 계획 */
function planReal(a: RealAirline, year: number, why: 'history' | 'real', cash: number): EntrantPlan | null {
  const hub = gameHub(a, hubCities(year), []);
  if (!hub) return null;
  return { name: a.name, airline: a.id, hub, model: 'full', cash: Math.round(cash * 0.9), why };
}

/** 이번 달에 생길 새 회사 (없으면 null). startCash: 설정의 시작 자금 */
export function planEntrant(state: AirlineState, t: number, startCash: number): EntrantPlan | null {
  if (!industryOn(state) || !roomForEntrant(state)) return null;
  const year = yearOfM(t);
  const salt = industrySalt(state);
  const founder = foundersAt(state, t)[0];
  if (founder) return planReal(founder, year, 'history', startCash);
  const { p, why } = entryChance(state, t);
  if (!(hash01(salt, t, 501) < p)) return null;
  const r = seededRandom(Math.floor(hash01(salt, t, 502) * 2 ** 31));
  const lcc = year < 1978 ? 0 : year < 1995 ? 0.3 : year < 2005 ? 0.5 : 0.6;
  const cargo = year >= 1980 ? 0.12 : 0;
  const roll = r();
  let model: BizModel = roll < lcc ? 'lcc' : roll < lcc + cargo ? 'cargo' : 'full';
  const names = new Set(state.companies.map((c) => c.name));
  if (model === 'full' && state.options.names === 'real') {
    // 그동안 다른 하늘에서 날던 실제 항공사가 이 판의 경쟁에 뛰어든다 (최근에 생긴 회사·아직 아무도 없는 지역이 먼저)
    const used = usedAirlines(state);
    const regions = new Set(state.companies.filter((c) => !c.out).map((c) => CITY[c.hub].region));
    const pool = airlinesAt(year).filter((a) => !used.has(a.id) && !predecessorFlying(state, a.id) && gameHub(a, hubCities(year), []));
    const pick = weighted(
      pool,
      pool.map((a) => {
        const s = citySize(CITY[a.hub], year);
        return s * s * (year - a.founded <= 10 ? 2 : 1) * (regions.has(a.region) ? 1 : 1.6);
      }),
      r,
    );
    if (pick) return planReal(pick, year, 'real', startCash);
  }
  // 저가항공은 규제가 풀린 지역에만
  let hub = pickHub(state, year, model, r);
  if (hub && model === 'lcc' && year < LCC_READY[CITY[hub].region]) model = 'full';
  if (!hub) hub = pickHub(state, year, 'full', r);
  if (!hub) return null;
  const pool = model === 'lcc' ? NEW_LCC_NAMES : model === 'cargo' ? NEW_CARGO_NAMES : NEW_FULL_NAMES;
  const name = pool.find((x, k) => !names.has(x) && hash01(salt, t, k, 503) < 0.7) ?? pool.find((x) => !names.has(x));
  if (!name) return null;
  const share = model === 'full' ? 0.7 : model === 'lcc' ? 0.55 : 0.5;
  return { name, airline: null, hub, model, cash: Math.round(startCash * share), why };
}

/** 새 회사가 경쟁에 뛰어든 까닭 한 줄 */
function entryWhy(plan: EntrantPlan, year: number): string {
  const real = plan.airline ? REAL_AIRLINE[plan.airline] : undefined;
  if (plan.why === 'history' && real) return `실제 역사에서도 ${year}년에 이 이름으로 날기 시작했어요.${real.note ? ` (${real.note})` : ''}`;
  if (plan.why === 'real' && real) return `그동안 다른 하늘에서 날던 ${withJosa(real.name, '이/가')} 이 판의 경쟁에 뛰어들었어요.`;
  if (plan.model === 'lcc') return '싼 운임과 빠른 회전으로 손님을 모으는 저가항공이에요.';
  if (plan.model === 'cargo') return '화물기로 짐만 나르는 화물 전문 회사예요.';
  return plan.why === 'gap' ? '문을 닫은 회사가 남긴 빈 하늘을 노리고 새로 생겼어요.' : '하늘길 장사가 잘된다는 소식에 새로 생겼어요.';
}

export interface EnterHooks {
  /** 새 회사 틀 (rules.ts newCompany) */
  newCompany: (seat: SeatIndex, kind: Company['kind'], name: string, hub: string, cash: number, credit: number, year: number) => Company;
  /** 설정의 시작 자금 */
  startCash: number;
}

/** 계획대로 새 회사를 들인다 (이번 달 차례 맨 끝에 경영한다) */
export function admitEntrant(state: AirlineState, plan: EntrantPlan, hooks: EnterHooks): AirlineState {
  const t = state.t;
  const year = yearOfM(t);
  const salt = industrySalt(state);
  const seed = Math.floor(hash01(salt, t, state.companies.length, 504) * 2 ** 31);
  const ais = state.companies.filter((c) => c.kind !== 'human' && c.born === undefined);
  const kind: Company['kind'] = ais.length > 0 && ais.every((c) => c.kind === 'ai-easy') ? 'ai-easy' : 'ai-normal';
  const c = hooks.newCompany(pickSeat(state, seed), kind, plan.name, plan.hub, plan.cash, Math.round(plan.cash * 0.5), year);
  c.airline = plan.airline;
  if (plan.model !== 'full') setBizModelAtStart(c, plan.model);
  c.color = pickColor(state, plan.airline);
  let s = addCompany(state, c, seed);
  const ci = s.companies.length - 1;
  const co = s.companies[ci];
  const what = plan.model === 'lcc' ? '저가항공' : plan.model === 'cargo' ? '화물 전문 회사' : '항공사';
  s = addNews(s, {
    icon: plan.model === 'lcc' ? '🎒' : plan.model === 'cargo' ? '📦' : '🆕',
    title: `새 ${what} ${withJosa(co.name, '이/가')} 날기 시작해요`,
    text: `${CITY[co.hub].name}을(를) 본사로 하늘길 경쟁에 뛰어들었어요. ${entryWhy(plan, year)} 처음에는 작지만 금세 노선을 늘릴 거예요.${co.airline ? ' (경영은 게임 속 이야기)' : ''}`,
    tone: 'big',
    city: co.hub,
    company: ci,
  });
  s = addLog(s, co.seat, `🆕 ${co.name} 새로 취항 (본사 ${CITY[co.hub].name})`);
  s = logIndustry(s, { kind: 'enter', company: ci, text: `${co.name} 등장 (${CITY[co.hub].name}${plan.model !== 'full' ? `, ${what}` : ''})` });
  s = pushEvent(s, ci, 'enter');
  return { ...s, order: [...s.order, ci] };
}

/** 자리가 없어 이 판에 들어오지 못한 실제 항공사 창업 소식 */
function worldNews(state: AirlineState, a: RealAirline): AirlineState {
  const s = addNews(state, {
    icon: '🌍',
    title: `세계 소식: ${withJosa(a.name, '이/가')} 날기 시작했어요`,
    text: `${CITY[a.hub]?.name ?? ''}에서 새 항공사가 문을 열었어요. 하늘이 붐벼 이 판의 경쟁에는 아직 들어오지 않아요 — 빈자리가 생기면 들어올지도 몰라요.${a.note ? ` (${a.note})` : ''}`,
    tone: 'info',
  });
  return logIndustry(s, { kind: 'world', text: `${a.name} 창업 (판 밖)` });
}

/** 새 달을 열 때: 실제 역사의 창업, 빈자리·호황의 새 회사 (한 달에 한 곳까지) */
export function enterMarket(state: AirlineState, hooks: EnterHooks): AirlineState {
  if (!industryOn(state) || state.phase === 'gameover') return state;
  const t = state.t;
  let s = state;
  const founders = foundersAt(s, t);
  const plan = planEntrant(s, t, hooks.startCash);
  if (plan) s = admitEntrant(s, plan, hooks);
  for (const a of founders) if (a.id !== plan?.airline) s = worldNews(s, a);
  return s;
}

// ------------------------------------------------------------------ 문 닫기·인수·법정 관리

export interface MergeDeal {
  /** 보통 인수 값에 견준 비율 (cost가 있으면 그 값) */
  rate?: number;
  /** 정해진 값 (억) */
  cost?: number;
  /** world: 세계 항공사 모드의 실제 역사 합병 (값 없이, story가 소식 글) */
  why: 'stock' | 'rescue' | 'history' | 'sale' | 'world';
  /** 소식에 붙일 까닭 */
  note?: string;
  /** 소식 글을 통째로 (세계 항공사 모드) */
  story?: string;
}

export interface ShutHow {
  icon?: string;
  title: string;
  text: string;
  /** 판에서 빠진 까닭 한 마디 (결과·순위표). 없으면 운항 중단 */
  fate?: string;
}

export interface ExitHooks {
  /** j가 i를 합친다 (rules.ts mergeCompanies + 운수권) */
  merge: (s: AirlineState, j: number, i: number, deal: MergeDeal) => AirlineState;
  /** 운항을 멈춘다 (rules.ts shutDown) */
  shutDown: (s: AirlineState, ci: number, t: number, how?: ShutHow) => AirlineState;
  startCash: number;
}

/** 돈이 바닥난 회사를 사들일 때 내는 값 */
export function distressPrice(state: AirlineState, buyer: number, ci: number): number {
  return Math.round(buyoutCost(state, buyer, ci) * RESCUE_RATE * 10) / 10;
}

/** 인수 제안을 받을 사람 회사 (돈이 넉넉하고 정할 일이 없는 사람 가운데 가장 넉넉한 곳, 없으면 −1) */
export function humanBuyer(state: AirlineState, ci: number, price: (j: number) => number): number {
  const target = state.companies[ci];
  if (target.planes.length === 0) return -1;
  let best = -1;
  state.companies.forEach((c, j) => {
    if (j === ci || c.out || c.kind !== 'human' || c.choice) return;
    const need = price(j) + Math.max(0, -target.cash) + 200;
    if (c.cash < need || baseValue(state, ci) < -0.1 * Math.max(500, companyValue(state, j))) return;
    if (best < 0 || c.cash > state.companies[best].cash) best = j;
  });
  return best;
}

/** 돈이 바닥난 회사를 싸게 사들일 컴퓨터 회사 (없으면 −1) */
export function rescueBuyer(state: AirlineState, ci: number): number {
  const target = state.companies[ci];
  let best = -1;
  state.companies.forEach((c, j) => {
    if (j === ci || c.out || c.kind === 'human' || c.crisis > 0 || c.sale) return;
    const cost = distressPrice(state, j, ci);
    if (c.cash - cost + Math.min(0, target.cash) < 300) return;
    if (baseValue(state, ci) < -0.08 * Math.max(500, companyValue(state, j))) return;
    if (best < 0 || c.cash > state.companies[best].cash) best = j;
  });
  return best;
}

const RESCUE_CHANCE = { relaxed: 0.4, normal: 0.6, fierce: 0.85 } as const;

/** 사람 회사에 인수 제안 (결정 사건): 그 회사는 사람이 정할 때까지 한 달 기다린다 */
export function offerSale(state: AirlineState, ci: number, buyer: number, t: number, why: 'history' | 'distress', note = ''): AirlineState {
  const target = state.companies[ci];
  const b = state.companies[buyer];
  const price = distressPrice(state, buyer, ci);
  const fleet = target.planes.reduce((v, p) => v + planeValue(state, p), 0);
  const choice: Choice = {
    id: state.nextId,
    scenario: 'acquire',
    icon: why === 'history' ? '📜' : '🤝',
    title: `${target.name} 인수 제안`,
    text:
      (why === 'history'
        ? `${note} 실제 역사에서는 이 무렵 ${withJosa(target.name, '이/가')} ${b.name}에 합쳐졌어요. `
        : `${withJosa(target.name, '이/가')} 돈이 바닥나 문을 닫기 직전이에요. `) +
      `우리가 사들이면 노선 ${target.routes.length}개와 비행기 ${target.planes.length}대(값 ${fmt(fleet)})를 넘겨받고, 빚 ${fmt(target.debt)}${target.cash < 0 ? `과 모자란 현금 ${fmt(-target.cash)}` : ''}도 함께 떠안아요.`,
    options: [
      { label: '인수해요', desc: `${fmt(price)}을 내고 회사를 합쳐요 (지점·노선·비행기·직원·빚을 모두 넘겨받아요)`, effects: [{ kind: 'acquire', target: ci }], cost: price, ai: 0 },
      { label: '사지 않아요', desc: why === 'history' ? `${withJosa(target.name, '은/는')} 실제 역사처럼 문을 닫아요` : `${withJosa(target.name, '은/는')} 법정 관리를 받거나 문을 닫아요`, effects: [], cost: 0, ai: 1 },
    ],
  };
  let s = { ...state, nextId: state.nextId + 1 };
  s = editCo(s, ci, (c) => (c.sale = { buyer, until: t + 1, price, why }));
  s = editCo(s, buyer, (c) => (c.choice = choice));
  s = addNews(s, {
    icon: choice.icon,
    title: `${withJosa(target.name, '이/가')} ${withJosa(b.name, '을/를')} 찾아왔어요`,
    text: `${withJosa(target.name, '이/가')} 우리에게 회사를 팔고 싶어 해요. 이번 차례에 인수할지 정해요 (결정할 일).`,
    tone: 'big',
    for: [buyer],
    company: ci,
  });
  return s;
}

/** 법정 관리(회생 절차): 빚을 줄이고 손해 보는 노선·쉬는 비행기를 정리해 한 번 더 난다 */
export function protect(state: AirlineState, ci: number, t: number, startCash: number): AirlineState {
  const c0 = state.companies[ci];
  const debtBefore = c0.debt;
  let closed = 0;
  let parked = 0;
  const listings: { model: string; age: number; price: number }[] = [];
  let s = editCo(state, ci, (c) => {
    const losing = new Set(c.routes.filter((r) => r.stats && r.stats.profit < 0).map((r) => r.id));
    closed = losing.size;
    c.routes = c.routes.filter((r) => !losing.has(r.id));
    for (const p of c.planes) p.legs = p.legs.filter((l) => !losing.has(l.route));
    // 쉬는 비행기는 돌려주거나 팔아 빚을 갚는다 (판 비행기는 중고 시장으로)
    let sold = 0;
    for (const p of c.planes) {
      if (p.legs.length > 0) continue;
      parked++;
      if (p.leased) continue;
      const v = planeValue(state, p);
      sold += v * 0.7;
      if (listings.length < 4 && planeAge(state, p) < 25) listings.push({ model: p.model, age: Math.round(planeAge(state, p)), price: Math.max(10, Math.round(v * 0.75)) });
    }
    c.planes = c.planes.filter((p) => p.legs.length > 0);
    // 기다리던 새 비행기 주문은 취소 (낸 돈의 절반은 빚 갚기에)
    sold += c.orders.reduce((v, o) => v + o.price * 0.5, 0);
    c.orders = [];
    c.debt = Math.max(0, Math.round((c.debt - sold) * PROTECT_DEBT));
    c.cash = Math.max(c.cash, Math.round(startCash * 0.08));
    c.crisis = 0;
    c.rescued = t;
    c.sale = undefined;
    c.reputation = Math.max(0, Math.round((c.reputation - 8) * 10) / 10);
    c.morale = Math.max(0, c.morale - 10);
    c.mods.push({ id: state.nextId, kind: 'demand', value: PROTECT_DEMAND, until: t + 1 + PROTECT_MONTHS, label: '⚖️ 법정 관리 중' });
  });
  s = { ...s, nextId: s.nextId + 1 };
  const market = [...s.market];
  for (const l of listings) {
    market.push({ id: s.nextId, ...l, listed: t, from: c0.name });
    s = { ...s, nextId: s.nextId + 1 };
  }
  s = { ...s, market: market.slice(-14) };
  const c = s.companies[ci];
  s = addNews(s, {
    icon: '⚖️',
    title: `${c.name} 법정 관리`,
    text: `돈이 바닥난 ${withJosa(c.name, '이/가')} 법정 관리(회생 절차)에 들어갔어요. 빚을 ${fmt(debtBefore)}에서 ${fmt(c.debt)}(으)로 줄이고${closed ? `, 손해 보는 노선 ${closed}개를 닫고` : ''}${parked ? ` 쉬는 비행기 ${parked}대를 정리해` : ''} 다시 날아요. 한 번 더 무너지면 문을 닫아요.${c.airline ? ' (게임 속 이야기)' : ''}`,
    tone: 'bad',
    company: ci,
  });
  s = addLog(s, c.seat, `⚖️ ${c.name} 법정 관리 (빚 ${fmt(debtBefore)} → ${fmt(c.debt)})`);
  s = logIndustry(s, { kind: 'rescue', company: ci, text: `${c.name} 법정 관리` });
  return pushEvent(s, ci, 'rescue');
}

/**
 * 돈이 바닥난 회사 (CRISIS_MONTHS달 내내 모자람): 사람 회사는 그대로 운항을 멈추고,
 * 컴퓨터 회사는 ① 사람 회사에 인수 제안 ② 다른 컴퓨터가 싸게 인수 ③ 법정 관리(한 번) ④ 운항 중단 순서로.
 */
export function failCompany(state: AirlineState, ci: number, t: number, hooks: ExitHooks): AirlineState {
  let s = state;
  const c = s.companies[ci];
  if (c.out) return s;
  if (c.kind === 'human' || !industryOn(s)) return hooks.shutDown(s, ci, t);
  let offer = true;
  if (c.sale) {
    if (t < c.sale.until) return s;
    // 사람 회사가 사지 않았다
    s = editCo(s, ci, (x) => (x.sale = undefined));
    offer = false;
  }
  const salt = industrySalt(s);
  if (offer) {
    const h = humanBuyer(s, ci, (j) => distressPrice(s, j, ci));
    if (h >= 0 && hash01(salt, t, ci, 7) < 0.7) return offerSale(s, ci, h, t, 'distress');
  }
  const j = rescueBuyer(s, ci);
  if (j >= 0 && hash01(salt, t, ci, 8) < RESCUE_CHANCE[s.options.aiStyle]) return hooks.merge(s, j, ci, { rate: RESCUE_RATE, why: 'rescue' });
  if (s.companies[ci].rescued === undefined) return protect(s, ci, t, hooks.startCash);
  return hooks.shutDown(s, ci, t);
}

// ------------------------------------------------------------------ 실제 역사

const crisisLabel = (f: AirlineFate) => `📉 ${f.year}년 무렵의 위기`;
const outcomeText = (f: AirlineFate) => (f.kind === 'cease' ? '문을 닫았어요' : f.kind === 'merge' ? `${f.intoName ?? REAL_AIRLINE[f.into!]?.name ?? '다른 회사'}에 합쳐졌어요` : `${REAL_AIRLINE[f.into!]?.name ?? '새 이름'}이 됐어요`);

/** 실제 역사의 그 달에 위기를 버티지 못할 만큼 약한지 (돈이 모자라거나, 한 해 적자거나, 이익이 아주 얇으면 반반) */
export function isWeak(state: AirlineState, ci: number, t: number): boolean {
  const c = state.companies[ci];
  const yp = yearProfit(state, ci);
  if (c.crisis > 0 || c.cash < 0 || yp < 0) return true;
  let revenue = 0;
  for (const l of state.ledger.slice(-12)) {
    const r = l.companies[ci];
    if (r) revenue += r.ticket + r.side;
  }
  const margin = revenue > 0 ? yp / revenue : 0;
  return margin < 0.03 && hash01(industrySalt(state), t, ci, 13) < 0.5;
}

/** 위기가 시작된다: 손님이 줄고 비용이 늘어난다 (그 달까지) */
function startCrisis(state: AirlineState, ci: number, f: AirlineFate, t: number): AirlineState {
  const until = fateT(f) + 1;
  let s = editCo(state, ci, (c) => {
    c.mods.push({ id: state.nextId, kind: 'demand', value: FATE_DEMAND, until, label: crisisLabel(f) });
    c.mods.push({ id: state.nextId + 1, kind: 'crew', value: FATE_COST, until, label: crisisLabel(f) });
    c.mods.push({ id: state.nextId + 2, kind: 'sales', value: FATE_COST, until, label: crisisLabel(f) });
  });
  s = { ...s, nextId: s.nextId + 3 };
  const c = s.companies[ci];
  s = addNews(s, {
    icon: '🌧️',
    title: `${c.name}에 먹구름`,
    text: `${f.why} 실제 역사에서는 ${f.year}년 ${f.month}월 ${withJosa(c.name, '이/가')} ${outcomeText(f)}. 이 판에서는 그때까지 손님이 줄고 비용이 늘어요 — 튼튼하게 버티면 살아남을 수도 있어요.`,
    tone: 'info',
    company: ci,
  });
  return logIndustry(s, { t, kind: 'crisis', company: ci, text: `${c.name} 위기 (실제로는 ${f.year}년 ${f.kind === 'cease' ? '문 닫음' : f.kind === 'merge' ? '합병' : '이름 바꿈'})` });
}

/** 이름을 바꾼다 (컴퓨터 회사만): BOAC → 영국항공처럼 */
function rename(state: AirlineState, ci: number, f: AirlineFate): AirlineState {
  const to = REAL_AIRLINE[f.into!];
  if (!to) return state;
  // 이름이 바뀌면 라이벌 성격의 판 씨앗이 바뀌니 장부를 먼저 적어 둔다
  let s = fixRivalBook(state);
  const old = s.companies[ci].name;
  const others = s.companies.filter((c, i) => i !== ci && !c.out).map((c) => coColors(c).main);
  const color = to.colors.map(usableColor).find((x): x is string => !!x && others.every((o) => distinctColors(o, x)));
  s = editCo(s, ci, (c) => {
    c.name = to.name;
    c.airline = to.id;
    if (color) c.color = color;
  });
  s = addNews(s, {
    icon: '🔁',
    title: `${withJosa(old, '이/가')} ${to.name}(으)로 새 출발해요`,
    text: `${f.why} 노선·비행기·직원은 그대로 이어 가요. (실제 역사를 따른 게임 속 이야기)`,
    tone: 'info',
    company: ci,
  });
  s = addLog(s, s.companies[ci].seat, `🔁 ${old} → ${to.name}`);
  s = logIndustry(s, { kind: 'rename', company: ci, text: `${old} → ${to.name}` });
  return pushEvent(s, ci, 'rename');
}

/** 실제 역사의 그 달: 약하면 역사대로, 튼튼하면 살아남는다 */
function resolveFate(state: AirlineState, ci: number, f: AirlineFate, t: number, hooks: ExitHooks): AirlineState {
  let s = state;
  const c = s.companies[ci];
  if (!isWeak(s, ci, t)) {
    s = editCo(s, ci, (x) => (x.mods = x.mods.filter((m) => m.label !== crisisLabel(f))));
    s = addNews(s, {
      icon: '💪',
      title: `${withJosa(c.name, '이/가')} 위기를 넘겼어요`,
      text: `실제 역사에서는 ${f.year}년 ${withJosa(c.name, '이/가')} ${outcomeText(f)}. 하지만 이 판의 ${withJosa(c.name, '은/는')} 돈과 이익이 튼튼해서 계속 날아요 — 역사와 다른 길이에요!`,
      tone: 'good',
      company: ci,
    });
    return logIndustry(s, { kind: 'survive', company: ci, text: `${c.name} 위기 넘김 (실제와 다른 길)` });
  }
  if (f.kind === 'cease') {
    return hooks.shutDown(s, ci, t, {
      icon: '🛬',
      title: `${withJosa(c.name, '이/가')} 실제 역사처럼 문을 닫아요`,
      text: `${f.why} ${f.year}년 ${f.month}월, ${withJosa(c.name, '이/가')} 마지막 비행을 했어요. 비행기는 중고 시장에 나오고 쓰던 공항 슬롯과 노선이 비었어요 — 새 노선을 열 기회예요! (실제 역사를 따른 게임 속 이야기)`,
      fate: `${f.year}년 문을 닫음`,
    });
  }
  // 합병: 합칠 회사가 이 판에 있으면 그 회사로, 사람 회사면 인수 제안, 없으면 판 밖 회사로
  const j = f.into ? s.companies.findIndex((x, k) => k !== ci && !x.out && x.airline === f.into) : -1;
  // (컴퓨터 회사는 돈이 조금 모자라도 합친다: 모자란 돈은 다음 달 저절로 빌린다)
  if (j >= 0 && s.companies[j].kind !== 'human' && s.companies[j].crisis === 0) return hooks.merge(s, j, ci, { rate: RESCUE_RATE, why: 'history', note: f.why });
  if (j >= 0 && s.companies[j].kind === 'human' && humanBuyer(s, ci, (k) => distressPrice(s, k, ci)) === j) return offerSale(s, ci, j, t, 'history', f.why);
  return leaveToOutside(s, ci, f, t, hooks);
}

/** 판 밖 회사에 합쳐져 빠진다 (또는 사들일 회사를 찾지 못해 문을 닫는다) */
function leaveToOutside(state: AirlineState, ci: number, f: AirlineFate, t: number, hooks: ExitHooks): AirlineState {
  const c = state.companies[ci];
  const into = f.intoName ?? (f.into ? REAL_AIRLINE[f.into]?.name : undefined) ?? '다른 회사';
  return hooks.shutDown(state, ci, t, {
    icon: '🤝',
    title: `${withJosa(c.name, '이/가')} ${into}에 합쳐져요`,
    text: `${f.why} 실제 역사처럼 ${withJosa(c.name, '이/가')} ${into}에 합쳐져 이 판에서 빠졌어요. 비행기 일부는 중고 시장에 나오고 쓰던 공항 슬롯과 노선이 비었어요. (실제 역사를 따른 게임 속 이야기)`,
    fate: `${into}에 합쳐짐`,
  });
}

/** 사람 회사: 역사에 끌려가지 않고, 그 달에 한 줄 소식만 */
function humanNote(state: AirlineState, ci: number, f: AirlineFate): AirlineState {
  const c = state.companies[ci];
  return addNews(state, {
    icon: '📜',
    title: `실제 역사 속 ${c.name}`,
    text: `실제 역사에서는 ${f.year}년 ${f.month}월 ${withJosa(REAL_AIRLINE[f.id]?.name ?? c.name, '이/가')} ${outcomeText(f)}. 이 판의 ${withJosa(c.name, '은/는')} 여러분이 이끄는 대로 날아요!`,
    tone: 'info',
    for: [ci],
    company: ci,
  });
}

/** 달 결산에서 실제 항공사의 역사: 위기 시작, 그 달의 결말(문 닫기·합병·이름 바꾸기·살아남기) */
export function historyMonth(state: AirlineState, t: number, hooks: ExitHooks): AirlineState {
  if (!realHistoryOn(state)) return state;
  let s = state;
  for (const f of AIRLINE_FATES) {
    const ft = fateT(f);
    if (t < ft - FATE_LEAD || t > ft) continue;
    const ci = s.companies.findIndex((c) => !c.out && c.airline === f.id);
    if (ci < 0) continue;
    const c = s.companies[ci];
    if (c.kind === 'human') {
      if (t === ft) s = humanNote(s, ci, f);
      continue;
    }
    if (f.kind === 'rename') {
      if (t === ft) s = rename(s, ci, f);
      continue;
    }
    if (t < ft && !c.mods.some((m) => m.label === crisisLabel(f))) s = startCrisis(s, ci, f, t);
    if (t === ft && !s.companies[ci].sale) s = resolveFate(s, ci, f, t, hooks);
  }
  return s;
}

/**
 * 달 결산의 업계 변화 (runMonth가 부른다, t: 결산한 달):
 * 돈이 바닥난 회사, 사람 회사가 사지 않고 기한이 지난 인수 제안, 실제 항공사의 역사.
 */
export function industryMonth(state: AirlineState, t: number, bankrupts: readonly number[], hooks: ExitHooks): AirlineState {
  let s = state;
  for (const ci of bankrupts) s = failCompany(s, ci, t, hooks);
  if (!industryOn(s)) return s;
  for (let ci = 0; ci < s.companies.length; ci++) {
    const c = s.companies[ci];
    if (c.out || !c.sale || t < c.sale.until) continue;
    const buyer = s.companies[c.sale.buyer];
    s = editCo(s, ci, (x) => (x.sale = undefined));
    // 실제 역사의 합병인데 사람 회사가 사지 않았다: 사 줄 회사가 없어 문을 닫는다 (돈이 바닥나 찾아온 회사는 다음 결산에서 정한다)
    const f = c.airline ? FATE[c.airline] : undefined;
    if (c.sale.why === 'history' && f) {
      s = hooks.shutDown(s, ci, t, {
        icon: '🛬',
        title: `${withJosa(c.name, '이/가')} 문을 닫아요`,
        text: `${withJosa(buyer?.name ?? '사려던 회사', '이/가')} 사지 않아 ${withJosa(c.name, '은/는')} 사 줄 회사를 찾지 못하고 운항을 멈췄어요. 비행기는 중고 시장에 나오고 쓰던 공항 슬롯과 노선이 비었어요.${c.airline ? ' (게임 속 이야기)' : ''}`,
        fate: `${f.year}년 문을 닫음`,
      });
    }
  }
  return historyMonth(s, t, hooks);
}
