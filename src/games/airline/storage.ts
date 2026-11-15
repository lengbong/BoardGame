import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { SEAT_KIND_OPTIONS } from '../common/players';
import type { Speed } from '../common/speed';
import { MODEL } from './aircraft';
import { MEDIA } from './ads';
import { BUSINESS_KINDS } from './business';
import { cabinBlocker, defaultCabin } from './cabin';
import { migratePartners } from './alliances';
import { AWARD_KINDS } from './awards';
import { CHALLENGE } from './challenges';
import { MAX_TANK } from './fuel';
import { FACILITY_KINDS } from './facilities';
import { isValidV4Company, migrateV3, parseModels } from './migrate4';
import { isValidRightsState, parseRightsOption } from './rightsSave';
import { isValidLoyaltyState } from './loyaltySave';
import { isValidRivalsState, parseRivalsOption } from './relations';
import { isValidScenarioState, parseScenarioOption } from './scenarioSave';
import { CITY, REGIONS } from './cities';
import { REAL_AIRLINE } from './realAirlines';
import { STAFF_GROUPS, emptyStaff, staffNeed } from './staff';
import { defaultTimes } from './timetable';
import { DEFAULT_OPTIONS, GOAL_VALUES } from './rules';
import { emptyReport } from './simulate';
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AirlineOptions, AirlineSetup, AirlineState, Choice, Company, CompanyReport, GoalKind, ModKind, YearAcc } from './types';

const SAVE_KEY = 'family-boardgame.airline.save.v1';
const SETUP_KEY = 'family-boardgame.airline.setup.v1';
export const AIRLINE_SETTINGS_KEY = 'family-boardgame.airline.settings.v1';

export interface SavedAirlineGame {
  setup: AirlineSetup;
  state: AirlineState;
  savedAt: number;
}

export const DEFAULT_SETUP: AirlineSetup = {
  seats: [
    { kind: 'human', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'ai-easy', name: '' },
    { kind: 'empty', name: '' },
  ],
  options: DEFAULT_OPTIONS,
  hubs: [null, null, null, null],
  airlines: [null, null, null, null],
};

const ERAS = [1963, 1983, 2003, 2026];
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isIndex = (v: unknown, n: number): v is number => isInt(v) && v >= 0 && v < n;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isCity = (v: unknown): v is string => typeof v === 'string' && !!CITY[v];

export function parseOptions(v: unknown): AirlineOptions {
  const o = (isObj(v) ? v : {}) as Partial<AirlineOptions>;
  return {
    era: (ERAS.includes(o.era as number) ? o.era : DEFAULT_OPTIONS.era) as AirlineOptions['era'],
    mode: o.mode === 'goal' || o.mode === 'challenge' || o.mode === 'years' || o.mode === 'scenario' ? o.mode : DEFAULT_OPTIONS.mode,
    years: o.years === 10 || o.years === 30 || o.years === 20 || o.years === 50 || o.years === 0 ? o.years : DEFAULT_OPTIONS.years,
    goalValue: (GOAL_VALUES as readonly number[]).includes(o.goalValue as number) ? (o.goalValue as number) : DEFAULT_OPTIONS.goalValue,
    goalRegions: isInt(o.goalRegions) && o.goalRegions >= 3 && o.goalRegions <= 6 ? o.goalRegions : DEFAULT_OPTIONS.goalRegions,
    money: o.money === 'rich' || o.money === 'tight' || o.money === 'normal' ? o.money : DEFAULT_OPTIONS.money,
    challenge: typeof o.challenge === 'string' && CHALLENGE[o.challenge] ? o.challenge : null,
    aiStyle: o.aiStyle === 'relaxed' || o.aiStyle === 'fierce' || o.aiStyle === 'normal' ? o.aiStyle : DEFAULT_OPTIONS.aiStyle,
    names: o.names === 'fictional' || o.names === 'real' ? o.names : DEFAULT_OPTIONS.names,
    history: o.history !== false,
    // 세계 항공사 모드 (없으면 키를 두지 않는다: 예전 방식)
    ...(o.world === true ? { world: true } : {}),
    // 운수권 (없으면 키를 두지 않는다: rightsSave.ts)
    ...parseRightsOption(o as Record<string, unknown>),
    // 라이벌 성격 (없으면 키를 두지 않는다: 켜짐)
    ...parseRivalsOption(o as Record<string, unknown>),
    // 역사 시나리오 (없으면 키를 두지 않는다: scenarioSave.ts)
    ...parseScenarioOption(o as Record<string, unknown>),
  };
}

function parseAirlines(v: unknown): (string | null)[] {
  const list = Array.isArray(v) ? v : [];
  return [0, 1, 2, 3].map((i) => (typeof list[i] === 'string' && REAL_AIRLINE[list[i]] ? (list[i] as string) : null));
}

export function isValidSetup(v: unknown): v is AirlineSetup {
  const s = v as AirlineSetup;
  return (
    isObj(s) &&
    Array.isArray(s.seats) &&
    s.seats.length === 4 &&
    s.seats.every((seat) => isObj(seat) && typeof seat.name === 'string' && SEAT_KIND_OPTIONS.some((o) => o.value === seat.kind)) &&
    isObj(s.options) &&
    (s.hubs === undefined || (Array.isArray(s.hubs) && s.hubs.every((h) => h === null || isCity(h)))) &&
    (s.airlines === undefined || (Array.isArray(s.airlines) && s.airlines.every((a) => a === null || typeof a === 'string')))
  );
}

const MOD_KINDS: ModKind[] = ['crew', 'fuelHedge', 'fuel', 'demand', 'service', 'sales', 'slot', 'discount', 'subsidy'];
const GOAL_KINDS: GoalKind[] = ['lf', 'profit4', 'region', 'routes', 'pax', 'value', 'fleet', 'xfer'];
const ACC_KEYS: (keyof YearAcc)[] = ['year', 'pax', 'seats', 'xfer', 'revenue', 'profit', 'profitQ', 'qProfit', 'quarters', 'bought', 'startValue', 'startRegions', 'startRoutes', 'lastPax'];

function isValidChoice(v: unknown): v is Choice {
  if (!isObj(v)) return false;
  const ch = v as unknown as Choice;
  if (!isInt(ch.id) || typeof ch.title !== 'string' || typeof ch.text !== 'string' || typeof ch.icon !== 'string' || typeof ch.scenario !== 'string') return false;
  if (!Array.isArray(ch.options) || ch.options.length < 1 || ch.options.length > 4) return false;
  return ch.options.every((o) => isObj(o) && typeof o.label === 'string' && typeof o.desc === 'string' && Array.isArray(o.effects) && isNum(o.cost) && isNum(o.ai));
}

function isValidCompany(c: unknown, nextId: number): c is Company {
  if (!isObj(c)) return false;
  const k = c as unknown as Company;
  if (!isIndex(k.seat, 4) || !['human', 'ai-easy', 'ai-normal'].includes(k.kind) || typeof k.name !== 'string' || !isCity(k.hub)) return false;
  if (!isNum(k.cash) || !isNum(k.debt) || k.debt < 0 || !isNum(k.baseCredit)) return false;
  if (!Array.isArray(k.branches) || !k.branches.every(isCity)) return false;
  if (!Array.isArray(k.routes)) return false;
  const routeIds = new Set<number>();
  for (const r of k.routes) {
    if (!isObj(r) || !isInt(r.id) || r.id >= nextId || !isCity(r.a) || !isCity(r.b) || r.a === r.b || !isInt(r.fare) || r.fare < -30 || r.fare > 30 || !isInt(r.since)) return false;
    if (!Array.isArray(r.times) || r.times.length !== 4 || !r.times.every((x) => isNum(x) && x >= 0)) return false;
    if (r.stats !== null && !(isObj(r.stats) && isNum(r.stats.lf) && isNum(r.stats.profit) && isInt(r.stats.lossStreak) && isNum(r.stats.onTime) && isNum(r.stats.cancel) && Array.isArray(r.stats.hist))) return false;
    routeIds.add(r.id);
  }
  if (!Array.isArray(k.planes)) return false;
  for (const p of k.planes) {
    if (!isObj(p) || !isInt(p.id) || p.id >= nextId || typeof p.model !== 'string' || !MODEL[p.model] || typeof p.leased !== 'boolean') return false;
    if (!isNum(p.rent) || !isNum(p.deposit) || !isInt(p.since) || !Array.isArray(p.legs)) return false;
    if (!p.legs.every((l) => isObj(l) && isInt(l.route) && routeIds.has(l.route) && isInt(l.freq) && l.freq >= 1 && l.freq <= 28)) return false;
    // 좌석 배치·기내식 (예전 판 저장에는 없을 수 있다 → 불러올 때 표준 배치)
    if (p.cabin !== undefined && !(isObj(p.cabin) && cabinBlocker(MODEL[p.model], p.cabin) === null)) return false;
    if (p.meal !== undefined && !(isInt(p.meal) && p.meal >= 1 && p.meal <= 5)) return false;
    if (p.got !== undefined && !isInt(p.got)) return false;
    // 기체 상태·C점검 (예전 저장에는 없다)
    if (p.cond !== undefined && !(isNum(p.cond) && p.cond >= 0 && p.cond <= 100)) return false;
    if (p.check !== undefined && !isInt(p.check)) return false;
  }
  if (!Array.isArray(k.orders) || !k.orders.every((o) => isObj(o) && isInt(o.id) && o.id < nextId && typeof o.model === 'string' && !!MODEL[o.model] && isInt(o.due) && isNum(o.price))) return false;
  if (!Array.isArray(k.mods) || !k.mods.every((m) => isObj(m) && isInt(m.id) && MOD_KINDS.includes(m.kind) && isNum(m.value) && isInt(m.until) && typeof m.label === 'string')) return false;
  if (k.choice !== null && !isValidChoice(k.choice)) return false;
  if (!isInt(k.nextChoiceT) || !isInt(k.lastProposal) || !isInt(k.taken)) return false;
  if (!isInt(k.maint) || k.maint < 1 || k.maint > 5 || !isInt(k.crewReserve) || k.crewReserve < 0 || k.crewReserve > 2 || !isNum(k.onTime)) return false;
  if (!isObj(k.staff) || !STAFF_GROUPS.every((g) => isObj(k.staff[g]) && isInt(k.staff[g].have) && k.staff[g].have >= 0 && isNum(k.staff[g].pay) && Array.isArray(k.staff[g].pipe) && k.staff[g].pipe.every((p) => isObj(p) && isInt(p.n) && isInt(p.ready)))) return false;
  if (!isNum(k.morale) || typeof k.academy !== 'boolean' || !isNum(k.shock)) return false;
  if (k.partner !== null && !isInt(k.partner)) return false;
  if (!Array.isArray(k.goals) || !k.goals.every((g) => isObj(g) && GOAL_KINDS.includes(g.kind) && isNum(g.target) && typeof g.text === 'string' && isObj(g.reward) && isNum(g.reward.cash) && isNum(g.reward.rep) && (g.done === null || typeof g.done === 'boolean'))) return false;
  if (!isObj(k.acc) || !ACC_KEYS.every((key) => isNum((k.acc as unknown as Record<string, unknown>)[key]))) return false;
  if (!Array.isArray(k.reviews) || !k.reviews.every((r) => isObj(r) && isInt(r.year) && ['S', 'A', 'B', 'C', 'D'].includes(r.grade) && typeof r.text === 'string')) return false;
  // 실제 항공사·색 (예전 판 저장에는 없을 수 있다)
  if (k.airline !== undefined && k.airline !== null && typeof k.airline !== 'string') return false;
  if (k.color !== undefined && k.color !== null && !(typeof k.color === 'string' && /^#[0-9a-f]{6}$/i.test(k.color))) return false;
  if (k.checkAt !== undefined && !(isNum(k.checkAt) && k.checkAt >= 20 && k.checkAt <= 90)) return false;
  // 공항 시설 (예전 저장에는 없다)
  if (k.facilities !== undefined && !(Array.isArray(k.facilities) && k.facilities.every((f) => isObj(f) && isCity(f.city) && FACILITY_KINDS.includes(f.kind) && isNum(f.cost)))) return false;
  // 연료 탱크 (예전 저장에는 없다)
  if (k.fuel !== undefined && !(isObj(k.fuel) && isInt(k.fuel.level) && k.fuel.level >= 0 && k.fuel.level <= MAX_TANK && isNum(k.fuel.stock) && k.fuel.stock >= 0 && isNum(k.fuel.avg) && k.fuel.avg >= 0 && (k.fuel.auto === null || isNum(k.fuel.auto)))) return false;
  if (!isObj(k.ads) || !isObj(k.awareness) || !REGIONS.every((r) => isNum(k.ads[r]) && isNum(k.awareness[r]))) return false;
  // 광고 매체·캠페인 (예전 판 저장에는 없을 수 있다)
  if (k.adMedia !== undefined && !(isObj(k.adMedia) && REGIONS.every((r) => MEDIA.includes(k.adMedia![r])))) return false;
  if (k.lastCampaign !== undefined && !isInt(k.lastCampaign)) return false;
  if (!isInt(k.service) || k.service < 1 || k.service > 5 || !isNum(k.reputation)) return false;
  if (!Array.isArray(k.businesses) || !k.businesses.every((b) => isObj(b) && isCity(b.city) && BUSINESS_KINDS.includes(b.kind) && isNum(b.cost))) return false;
  if (typeof k.out !== 'boolean' || !isInt(k.crisis) || !isObj(k.stats)) return false;
  // 사업 모델·등급 운임 (4판)
  if (!isValidV4Company(k)) return false;
  return true;
}

/** 저장된 상태를 꼼꼼히 확인한다 (망가졌으면 false) */
export function isValidState(v: unknown): v is AirlineState {
  if (!isObj(v)) return false;
  const s = v as unknown as AirlineState;
  if (s.version !== 4) return false;
  if (!isInt(s.nextId) || !isInt(s.t) || !isInt(s.startT) || s.startT > s.t || s.q !== Math.floor(s.t / 3) || s.startQ !== Math.floor(s.startT / 3) || !isInt(s.startYear)) return false;
  if (s.phase !== 'manage' && s.phase !== 'gameover') return false;
  if (!Array.isArray(s.companies) || s.companies.length < 1 || s.companies.length > (isObj(s.options) && s.options.world === true ? MAX_WORLD_COMPANIES : 4)) return false;
  if (!s.companies.every((c) => isValidCompany(c, s.nextId))) return false;
  if (!s.companies.every((c) => c.rescuedAt === undefined || isInt(c.rescuedAt))) return false;
  if (!s.companies.every((c) => (c.dormant === undefined || typeof c.dormant === 'boolean') && (c.joinYear === undefined || isInt(c.joinYear)) && (c.predicted === undefined || typeof c.predicted === 'boolean') && (!c.dormant || c.out))) return false;
  const n = s.companies.length;
  if (!Array.isArray(s.order) || s.order.length < 1 || !s.order.every((i) => isIndex(i, n))) return false;
  if (!isIndex(s.turnPos, s.order.length)) return false;
  if (!isNum(s.oil) || !isNum(s.rate)) return false;
  if (!s.companies.every((c) => c.partner === null || (isIndex(c.partner, n) && c.partner !== s.companies.indexOf(c)))) return false;
  if (!Array.isArray(s.market) || !s.market.every((u) => isObj(u) && isInt(u.id) && u.id < s.nextId && typeof u.model === 'string' && !!MODEL[u.model] && isNum(u.age) && isNum(u.price) && isInt(u.listed))) return false;
  if (!Array.isArray(s.priceWars) || !s.priceWars.every((w) => typeof w === 'string')) return false;
  if (!Array.isArray(s.effects) || !isObj(s.slotBoost) || !Array.isArray(s.news) || !Array.isArray(s.history) || !Array.isArray(s.log)) return false;
  if (!s.history.every((h) => isObj(h) && isInt(h.q) && Array.isArray(h.value) && h.value.length === n)) return false;
  const okReport = (r: unknown) => r === null || (isObj(r) && Array.isArray((r as { companies: unknown[] }).companies) && (r as { companies: unknown[] }).companies.length === n && Array.isArray((r as { routes: unknown }).routes) && Array.isArray((r as { xfers: unknown }).xfers) && Array.isArray((r as { ops: unknown }).ops));
  if (!okReport(s.report) || !okReport(s.qReport)) return false;
  if (!Array.isArray(s.ledger) || !s.ledger.every(okReport)) return false;
  if (!Array.isArray(s.months) || !s.months.every((m) => isObj(m) && isInt(m.t) && Array.isArray(m.value) && m.value.length === n)) return false;
  if (!Array.isArray(s.years) || !s.years.every((y) => isObj(y) && isInt(y.year) && Array.isArray(y.companies))) return false;
  // 주식 (예전 저장에는 없다): n × n, 0~100%, 한 회사를 남들이 가진 몫 합은 100% 안
  if (s.stakes !== undefined && !(Array.isArray(s.stakes) && s.stakes.length === n && s.stakes.every((row, i) => Array.isArray(row) && row.length === n && row.every((v, j) => isNum(v) && v >= 0 && v <= 100 && (i !== j || v === 0)) && row.reduce((a, b) => a + b, 0) <= 100.001))) return false;
  if (!s.companies.every((c) => (c.mergedInto === undefined || isIndex(c.mergedInto, n)) && (c.lastIssue === undefined || isInt(c.lastIssue)))) return false;
  // 항공 동맹 (예전 저장에는 없다): 회사마다 동맹 하나, 동맹마다 둘~셋
  if (s.alliances !== undefined) {
    if (!Array.isArray(s.alliances)) return false;
    const seen = new Set<number>();
    for (const a of s.alliances) {
      if (!isObj(a) || !isInt(a.id) || typeof a.name !== 'string' || !isInt(a.since) || !Array.isArray(a.members) || a.members.length < 2 || a.members.length > 3) return false;
      for (const m of a.members) {
        if (!isIndex(m, n) || seen.has(m)) return false;
        seen.add(m);
      }
    }
  }
  // 전세기 의뢰 (예전 저장에는 없다)
  if (s.charters !== undefined && !(Array.isArray(s.charters) && s.charters.every((o) => isObj(o) && isInt(o.id) && isCity(o.a) && isCity(o.b) && isInt(o.pax) && o.pax > 0 && isNum(o.pay) && typeof o.title === 'string' && typeof o.icon === 'string' && isInt(o.listed) && isInt(o.expires) && (o.by === undefined || isIndex(o.by, n)) && (o.plane === undefined || isInt(o.plane)) && (o.t === undefined || isInt(o.t))))) return false;
  // 연말 시상식 (예전 저장에는 없다)
  if (s.awards !== undefined && !(Array.isArray(s.awards) && s.awards.every((y) => isObj(y) && isInt(y.year) && Array.isArray(y.items) && y.items.every((a) => isObj(a) && AWARD_KINDS.includes(a.kind) && isIndex(a.company, n) && isNum(a.value) && typeof a.text === 'string')))) return false;
  if (!s.news.every((x) => isObj(x) && isInt(x.t))) return false;
  if (s.challenge !== null && !(isObj(s.challenge) && typeof s.challenge.id === 'string' && CHALLENGE[s.challenge.id] && isIndex(s.challenge.company, n))) return false;
  if (s.result !== null && !(isObj(s.result) && Array.isArray(s.result.winners))) return false;
  if (!isInt(s.nextEventId) || !isInt(s.nextLogId)) return false;
  // 운수권 장부 (예전 저장에는 없다: rightsSave.ts)
  if (!isValidRightsState(s)) return false;
  // 단골 프로그램·브랜드 자리 (예전 저장에는 없다: loyaltySave.ts)
  if (!isValidLoyaltyState(s)) return false;
  // 라이벌 장부 (예전 저장에는 없다: relations.ts)
  if (!isValidRivalsState(s)) return false;
  // 역사 시나리오 진행 (예전 저장에는 없다: scenarioSave.ts)
  if (!isValidScenarioState(s)) return false;
  return true;
}

/**
 * 2판(한 차례 = 한 분기) 저장을 3판(한 차례 = 한 달)으로 바꾼다: 분기는 그 분기의 첫 달로,
 * 분기 값(리스료·광고비)은 달 값으로. 결산은 비우고 그래프 기록은 분기 것만 남긴다.
 */
export function migrateV2(v: unknown): unknown {
  if (!isObj(v) || v.version !== 2) return v;
  const s = JSON.parse(JSON.stringify(v)) as Record<string, any>;
  const m3 = (x: unknown) => (isInt(x) ? x * 3 : x);
  s.version = 3;
  s.t = m3(s.q);
  s.startT = m3(s.startQ);
  for (const c of Array.isArray(s.companies) ? s.companies : []) {
    if (!isObj(c)) continue;
    for (const p of Array.isArray(c.planes) ? c.planes : []) {
      if (!isObj(p)) continue;
      p.since = m3(p.since);
      if (isNum(p.rent)) p.rent = Math.round((p.rent / 3) * 10) / 10;
    }
    for (const r of Array.isArray(c.routes) ? c.routes : []) {
      if (!isObj(r)) continue;
      r.since = m3(r.since);
      if (isObj(r.stats)) {
        const st = r.stats as Record<string, any>;
        r.stats = { ...st, onTime: 0.85, cancel: 0, hist: [], lossStreak: isInt(st.lossStreak) ? st.lossStreak * 3 : 0 };
      }
    }
    for (const m of Array.isArray(c.mods) ? c.mods : []) if (isObj(m)) m.until = m3(m.until);
    for (const o of Array.isArray(c.orders) ? c.orders : []) if (isObj(o)) o.due = m3(o.due);
    c.nextChoiceT = m3(c.nextChoiceQ);
    delete c.nextChoiceQ;
    c.lastProposal = m3(c.lastProposal);
    c.maint = 3;
    c.crewReserve = 1;
    c.onTime = 0.85;
    c.taken = 0;
    if (isObj(c.ads)) for (const k of Object.keys(c.ads)) if (isNum(c.ads[k])) c.ads[k] = Math.round(c.ads[k] / 3);
    if (isObj(c.acc)) c.acc.qProfit = 0;
  }
  for (const e of Array.isArray(s.effects) ? s.effects : []) if (isObj(e)) e.until = m3(e.until);
  for (const u of Array.isArray(s.market) ? s.market : []) if (isObj(u)) u.listed = m3(u.listed);
  for (const nItem of Array.isArray(s.news) ? s.news : []) {
    if (!isObj(nItem)) continue;
    nItem.t = m3(nItem.q);
    delete nItem.q;
  }
  if (isObj(s.challenge) && isInt(s.challenge.deadline)) s.challenge.deadline = s.challenge.deadline * 3 + 2;
  s.report = null;
  s.qReport = null;
  s.ledger = [];
  s.months = [];
  s.years = [];
  s.events = [];
  return s;
}

/** 3·4판 저장에 나중에 생긴 값(직원·시간표)이 없으면 채운다 */
export function fillMissing(v: unknown): unknown {
  if (!isObj(v) || (v.version !== 3 && v.version !== 4) || !Array.isArray(v.companies)) return v;
  const s = JSON.parse(JSON.stringify(v)) as Record<string, any>;
  const year = isInt(s.t) ? Math.floor(s.t / 12) : 2000;
  for (const c of s.companies) {
    if (!isObj(c)) continue;
    for (const r of Array.isArray(c.routes) ? c.routes : []) if (isObj(r) && !Array.isArray(r.times) && isCity(r.a) && isCity(r.b)) r.times = defaultTimes(r.a as string, r.b as string, year);
    if (!isObj(c.staff)) {
      const staff = emptyStaff();
      c.staff = staff;
      try {
        const need = staffNeed(s as unknown as AirlineState, c as unknown as Company);
        for (const g of STAFF_GROUPS) staff[g].have = Math.max(staff[g].have, Math.ceil(need[g] * 1.05));
      } catch {
        /* 모자란 값이 있으면 기본값으로 둔다 */
      }
    }
    if (!isNum(c.morale)) c.morale = 65;
    if (typeof c.academy !== 'boolean') c.academy = false;
    if (!isNum(c.shock)) c.shock = 0;
  }
  for (const m of Array.isArray(s.months) ? s.months : []) if (isObj(m) && !Array.isArray(m.staff)) m.staff = (m.value as unknown[]).map(() => 0);
  return s;
}

/** 세계 항공사 모드의 회사 수 한도 (실제 항공사 + 예측한 미래 항공사 + 사람) */
const MAX_WORLD_COMPANIES = 120;

// ------------------------------------------------------------------ 세계 항공사 모드: 저장을 가볍게

/** 결산 묶음에서 이만큼(최근)은 그대로 두고, 그보다 오래된 라이벌 결산은 요약만 저장한다 */
const FULL_REPORTS = 3;

type Packed = CompanyReport | 0 | number[];

function packReport(r: CompanyReport | undefined | null): Packed {
  if (!r) return 0;
  if (!r.pax && !r.profit && !r.value && !r.cash && !r.debt) return 0;
  return [r.profit, r.pax, r.seats, r.value, r.cash, r.debt, r.ticket + r.cargo + r.ancillary + r.side];
}

function unpackReport(x: unknown): CompanyReport {
  if (isObj(x)) return x as unknown as CompanyReport;
  const r = emptyReport();
  if (!Array.isArray(x)) return r;
  const n = (i: number) => (isNum(x[i]) ? (x[i] as number) : 0);
  return { ...r, profit: n(0), pax: n(1), seats: n(2), value: n(3), cash: n(4), debt: n(5), ticket: n(6) };
}

/**
 * 세계 항공사 모드는 회사가 수십 곳이라 저장이 브라우저 한도(약 5MB)를 넘기 쉽다.
 * 사람 회사가 아닌 회사의 오래된 달·해 결산은 요약(이익·손님·좌석·가치·현금·빚·매출)만 남긴다.
 */
export function packWorldState(state0: AirlineState, lean = false): unknown {
  if (!state0.options.world) return state0;
  // lean: 저장 한도를 넘었을 때 한 번 더 줄인다 (그래프·결산 기록을 최근 것만)
  const state: AirlineState = lean ? { ...state0, ledger: state0.ledger.slice(-6), years: state0.years.slice(-10), months: state0.months.slice(-60), history: state0.history.slice(-60), news: state0.news.slice(-30) } : state0;
  const human = state.companies.map((c) => c.kind === 'human');
  const pack = <T extends { companies: CompanyReport[] }>(list: T[]) =>
    list.map((r, k) => (k >= list.length - FULL_REPORTS ? r : { ...r, companies: r.companies.map((c, ci) => (human[ci] ? c : packReport(c))) }));
  // 노선·환승·운항 기록: 오래된 달은 사람 회사 것만, 최근 결산도 사람 회사 것과 눈에 띄는 것만 남긴다
  const mine = <T extends { company: number }>(list: T[]) => list.filter((x) => human[x.company]);
  const notable = <T extends { company: number; profit: number }>(list: T[]) => {
    if (list.length <= 60) return list;
    const sorted = [...list].sort((a, b) => b.profit - a.profit);
    const pick = new Set([...sorted.slice(0, 20), ...sorted.slice(-20)]);
    return list.filter((x) => human[x.company] || pick.has(x));
  };
  const slim = (r: AirlineState['report']) => (r ? { ...r, routes: notable(r.routes), xfers: r.xfers.slice(0, 80) } : r);
  const ledger = pack(state.ledger).map((r) => ({ ...r, routes: mine(r.routes) }));
  // 라이벌 노선의 지난 열두 달 그래프는 화면에 쓰지 않으니 저장하지 않는다
  const companies = state.companies.map((c, ci) => (human[ci] ? c : { ...c, routes: c.routes.map((r) => (r.stats && r.stats.hist.length ? { ...r, stats: { ...r.stats, hist: [] } } : r)) }));
  return { ...state, companies, ledger, years: pack(state.years), report: slim(state.report), qReport: slim(state.qReport) };
}

function unpackWorldState(v: unknown): unknown {
  if (!isObj(v) || !isObj(v.options) || v.options.world !== true) return v;
  const unpack = (list: unknown) =>
    Array.isArray(list) ? list.map((r) => (isObj(r) && Array.isArray(r.companies) ? { ...r, companies: (r.companies as unknown[]).map(unpackReport) } : r)) : list;
  return { ...v, ledger: unpack(v.ledger), years: unpack(v.years) };
}

/** 소수는 셋째 자리까지만 저장한다 (세계 항공사 모드) */
const round3 = (_k: string, v: unknown) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v);

/** 저장할 글 (세계 항공사 모드는 가볍게 줄여서) */
export function serializeSave(setup: AirlineSetup, state: AirlineState, savedAt = Date.now(), lean = false): string {
  if (!state.options.world) return JSON.stringify({ setup, state, savedAt } satisfies SavedAirlineGame);
  return JSON.stringify({ setup, state: packWorldState(state, lean), savedAt }, round3);
}

export function parseSaved(v: unknown): SavedAirlineGame | null {
  if (!isObj(v)) return null;
  const saved = { ...(v as unknown as SavedAirlineGame) };
  saved.state = unpackWorldState(saved.state) as AirlineState;
  saved.state = migrateV3(fillMissing(migrateV2(saved.state))) as AirlineState;
  if (!isValidSetup(saved.setup) || !isValidState(saved.state)) return null;
  // 예전 1:1 제휴는 동맹으로
  saved.state = migratePartners(saved.state);
  const options = parseOptions(saved.state.options);
  // 항공사 자료가 바뀌어 없어진 항공사는 가상 항공사로 (이름·색은 그대로)
  const companies = saved.state.companies.map((c) => ({
    ...c,
    airline: c.airline && REAL_AIRLINE[c.airline] ? c.airline : null,
    color: c.color ?? null,
    planes: c.planes.map((p) => ({ ...p, cabin: p.cabin ?? defaultCabin(MODEL[p.model]), meal: p.meal ?? c.service })),
  }));
  return {
    setup: { ...saved.setup, hubs: saved.setup.hubs ?? [null, null, null, null], airlines: parseAirlines(saved.setup.airlines), models: parseModels(saved.setup.models), options: parseOptions(saved.setup.options) },
    state: { ...saved.state, companies, options, events: [] },
    savedAt: isNum(saved.savedAt) ? saved.savedAt : Date.now(),
  };
}

/** 저장된 게임을 읽는다. 옛 형식이거나 망가진 저장은 지우고 null */
export function loadSavedAirlineGame(): SavedAirlineGame | null {
  const raw = loadJson<unknown>(SAVE_KEY);
  if (raw === null || raw === undefined) return null;
  const saved = parseSaved(raw);
  if (!saved) removeKey(SAVE_KEY);
  return saved;
}

export function saveAirlineGame(setup: AirlineSetup, state: AirlineState): void {
  try {
    window.localStorage.setItem(SAVE_KEY, serializeSave(setup, state));
  } catch {
    // 세계 항공사 모드의 아주 긴 판: 한도를 넘으면 기록을 더 줄여 다시 저장해 본다. 그래도 안 되면 게임만 계속한다.
    if (!state.options.world) return;
    try {
      window.localStorage.setItem(SAVE_KEY, serializeSave(setup, state, Date.now(), true));
    } catch {
      /* 저장 없이 계속 */
    }
  }
}

export function clearSavedAirlineGame(): void {
  removeKey(SAVE_KEY);
}

export function loadAirlineSetup(): AirlineSetup {
  const s = loadJson<AirlineSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  return { seats: s.seats, options: parseOptions(s.options), hubs: s.hubs ?? [null, null, null, null], airlines: parseAirlines(s.airlines), models: parseModels(s.models) };
}

export function saveAirlineSetup(setup: AirlineSetup): void {
  saveJson(SETUP_KEY, setup);
}

/**
 * think: 컴퓨터가 한 행동마다 쉬는 시간, turn: 차례 알림, sim: 분기 계산 연출(비행기가 나는 시간), fx: 연출을 보여 줄지
 */
export const AIRLINE_DELAYS: Record<Speed, { think: number; step: number; turn: number; sim: number; fx: boolean }> = {
  normal: { think: 380, step: 140, turn: 520, sim: 900, fx: true },
  fast: { think: 160, step: 60, turn: 260, sim: 450, fx: true },
  turbo: { think: 20, step: 0, turn: 0, sim: 0, fx: false },
};
