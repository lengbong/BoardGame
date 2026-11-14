import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { SEAT_KIND_OPTIONS } from '../common/players';
import type { Speed } from '../common/speed';
import { MODEL } from './aircraft';
import { CHALLENGE } from './challenges';
import { CITY, REGIONS } from './cities';
import { DEFAULT_OPTIONS, GOAL_VALUES } from './rules';
import type { AirlineOptions, AirlineSetup, AirlineState, Choice, Company, GoalKind, ModKind, YearAcc } from './types';

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
};

const ERAS = [1963, 1983, 2003];
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isIndex = (v: unknown, n: number): v is number => isInt(v) && v >= 0 && v < n;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isCity = (v: unknown): v is string => typeof v === 'string' && !!CITY[v];

export function parseOptions(v: unknown): AirlineOptions {
  const o = (isObj(v) ? v : {}) as Partial<AirlineOptions>;
  return {
    era: (ERAS.includes(o.era as number) ? o.era : DEFAULT_OPTIONS.era) as AirlineOptions['era'],
    mode: o.mode === 'goal' || o.mode === 'challenge' || o.mode === 'years' ? o.mode : DEFAULT_OPTIONS.mode,
    years: o.years === 10 || o.years === 30 || o.years === 20 ? o.years : DEFAULT_OPTIONS.years,
    goalValue: (GOAL_VALUES as readonly number[]).includes(o.goalValue as number) ? (o.goalValue as number) : DEFAULT_OPTIONS.goalValue,
    goalRegions: isInt(o.goalRegions) && o.goalRegions >= 3 && o.goalRegions <= 6 ? o.goalRegions : DEFAULT_OPTIONS.goalRegions,
    money: o.money === 'rich' || o.money === 'tight' || o.money === 'normal' ? o.money : DEFAULT_OPTIONS.money,
    challenge: typeof o.challenge === 'string' && CHALLENGE[o.challenge] ? o.challenge : null,
    aiStyle: o.aiStyle === 'relaxed' || o.aiStyle === 'fierce' || o.aiStyle === 'normal' ? o.aiStyle : DEFAULT_OPTIONS.aiStyle,
  };
}

export function isValidSetup(v: unknown): v is AirlineSetup {
  const s = v as AirlineSetup;
  return (
    isObj(s) &&
    Array.isArray(s.seats) &&
    s.seats.length === 4 &&
    s.seats.every((seat) => isObj(seat) && typeof seat.name === 'string' && SEAT_KIND_OPTIONS.some((o) => o.value === seat.kind)) &&
    isObj(s.options) &&
    (s.hubs === undefined || (Array.isArray(s.hubs) && s.hubs.every((h) => h === null || isCity(h))))
  );
}

const MOD_KINDS: ModKind[] = ['crew', 'fuelHedge', 'fuel', 'demand', 'service', 'sales', 'slot', 'discount', 'subsidy'];
const GOAL_KINDS: GoalKind[] = ['lf', 'profit4', 'region', 'routes', 'pax', 'value', 'fleet', 'xfer'];
const ACC_KEYS: (keyof YearAcc)[] = ['year', 'pax', 'seats', 'xfer', 'revenue', 'profit', 'profitQ', 'quarters', 'bought', 'startValue', 'startRegions', 'startRoutes', 'lastPax'];

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
    if (r.stats !== null && !(isObj(r.stats) && isNum(r.stats.lf) && isNum(r.stats.profit) && isInt(r.stats.lossStreak))) return false;
    routeIds.add(r.id);
  }
  if (!Array.isArray(k.planes)) return false;
  for (const p of k.planes) {
    if (!isObj(p) || !isInt(p.id) || p.id >= nextId || typeof p.model !== 'string' || !MODEL[p.model] || typeof p.leased !== 'boolean') return false;
    if (!isNum(p.rent) || !isNum(p.deposit) || !isInt(p.since) || !Array.isArray(p.legs)) return false;
    if (!p.legs.every((l) => isObj(l) && isInt(l.route) && routeIds.has(l.route) && isInt(l.freq) && l.freq >= 1 && l.freq <= 28)) return false;
  }
  if (!Array.isArray(k.orders) || !k.orders.every((o) => isObj(o) && isInt(o.id) && o.id < nextId && typeof o.model === 'string' && !!MODEL[o.model] && isInt(o.due) && isNum(o.price))) return false;
  if (!Array.isArray(k.mods) || !k.mods.every((m) => isObj(m) && isInt(m.id) && MOD_KINDS.includes(m.kind) && isNum(m.value) && isInt(m.until) && typeof m.label === 'string')) return false;
  if (k.choice !== null && !isValidChoice(k.choice)) return false;
  if (!isInt(k.nextChoiceQ) || !isInt(k.lastProposal) || !isInt(k.taken)) return false;
  if (k.partner !== null && !isInt(k.partner)) return false;
  if (!Array.isArray(k.goals) || !k.goals.every((g) => isObj(g) && GOAL_KINDS.includes(g.kind) && isNum(g.target) && typeof g.text === 'string' && isObj(g.reward) && isNum(g.reward.cash) && isNum(g.reward.rep) && (g.done === null || typeof g.done === 'boolean'))) return false;
  if (!isObj(k.acc) || !ACC_KEYS.every((key) => isNum((k.acc as unknown as Record<string, unknown>)[key]))) return false;
  if (!Array.isArray(k.reviews) || !k.reviews.every((r) => isObj(r) && isInt(r.year) && ['S', 'A', 'B', 'C', 'D'].includes(r.grade) && typeof r.text === 'string')) return false;
  if (!isObj(k.ads) || !isObj(k.awareness) || !REGIONS.every((r) => isNum(k.ads[r]) && isNum(k.awareness[r]))) return false;
  if (!isInt(k.service) || k.service < 1 || k.service > 5 || !isNum(k.reputation)) return false;
  if (!Array.isArray(k.businesses) || !k.businesses.every((b) => isObj(b) && isCity(b.city) && (b.kind === 'hotel' || b.kind === 'agency') && isNum(b.cost))) return false;
  if (typeof k.out !== 'boolean' || !isInt(k.crisis) || !isObj(k.stats)) return false;
  return true;
}

/** 저장된 상태를 꼼꼼히 확인한다 (망가졌으면 false) */
export function isValidState(v: unknown): v is AirlineState {
  if (!isObj(v)) return false;
  const s = v as unknown as AirlineState;
  if (s.version !== 2) return false;
  if (!isInt(s.nextId) || !isInt(s.q) || !isInt(s.startQ) || s.startQ > s.q || !isInt(s.startYear)) return false;
  if (s.phase !== 'manage' && s.phase !== 'gameover') return false;
  if (!Array.isArray(s.companies) || s.companies.length < 1 || s.companies.length > 4) return false;
  if (!s.companies.every((c) => isValidCompany(c, s.nextId))) return false;
  const n = s.companies.length;
  if (!Array.isArray(s.order) || s.order.length < 1 || !s.order.every((i) => isIndex(i, n))) return false;
  if (!isIndex(s.turnPos, s.order.length)) return false;
  if (!isNum(s.oil) || !isNum(s.rate)) return false;
  if (!s.companies.every((c) => c.partner === null || (isIndex(c.partner, n) && c.partner !== s.companies.indexOf(c)))) return false;
  if (!Array.isArray(s.market) || !s.market.every((u) => isObj(u) && isInt(u.id) && u.id < s.nextId && typeof u.model === 'string' && !!MODEL[u.model] && isNum(u.age) && isNum(u.price) && isInt(u.listed))) return false;
  if (!Array.isArray(s.priceWars) || !s.priceWars.every((w) => typeof w === 'string')) return false;
  if (!Array.isArray(s.effects) || !isObj(s.slotBoost) || !Array.isArray(s.news) || !Array.isArray(s.history) || !Array.isArray(s.log)) return false;
  if (!s.history.every((h) => isObj(h) && isInt(h.q) && Array.isArray(h.value) && h.value.length === n)) return false;
  if (s.report !== null && !(isObj(s.report) && Array.isArray(s.report.companies) && s.report.companies.length === n && Array.isArray(s.report.routes) && Array.isArray(s.report.xfers))) return false;
  if (s.challenge !== null && !(isObj(s.challenge) && typeof s.challenge.id === 'string' && CHALLENGE[s.challenge.id] && isIndex(s.challenge.company, n))) return false;
  if (s.result !== null && !(isObj(s.result) && Array.isArray(s.result.winners))) return false;
  if (!isInt(s.nextEventId) || !isInt(s.nextLogId)) return false;
  return true;
}

export function parseSaved(v: unknown): SavedAirlineGame | null {
  if (!isObj(v)) return null;
  const saved = v as unknown as SavedAirlineGame;
  if (!isValidSetup(saved.setup) || !isValidState(saved.state)) return null;
  const options = parseOptions(saved.state.options);
  return {
    setup: { ...saved.setup, hubs: saved.setup.hubs ?? [null, null, null, null], options: parseOptions(saved.setup.options) },
    state: { ...saved.state, options, events: [] },
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
  saveJson(SAVE_KEY, { setup, state, savedAt: Date.now() } satisfies SavedAirlineGame);
}

export function clearSavedAirlineGame(): void {
  removeKey(SAVE_KEY);
}

export function loadAirlineSetup(): AirlineSetup {
  const s = loadJson<AirlineSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  return { seats: s.seats, options: parseOptions(s.options), hubs: s.hubs ?? [null, null, null, null] };
}

export function saveAirlineSetup(setup: AirlineSetup): void {
  saveJson(SETUP_KEY, setup);
}

/**
 * think: 컴퓨터가 한 행동마다 쉬는 시간, turn: 차례 알림, sim: 분기 계산 연출(비행기가 나는 시간), fx: 연출을 보여 줄지
 */
export const AIRLINE_DELAYS: Record<Speed, { think: number; step: number; turn: number; sim: number; fx: boolean }> = {
  normal: { think: 700, step: 260, turn: 900, sim: 1800, fx: true },
  fast: { think: 350, step: 110, turn: 600, sim: 1000, fx: true },
  turbo: { think: 30, step: 0, turn: 0, sim: 0, fx: false },
};
