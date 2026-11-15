import { SEEN_KEEP, endKey, flyingRoutes, isKey, isName, isSeat, isTime, isYear, parseAirlineId, trophies } from './achievements';
import { CHALLENGE } from './challenges';
import { CITY, dist } from './cities';
import { rankings } from './rules';
import { companyValue } from './simulate';
import type { AirlineState, BizModel, WinMode } from './types';

/**
 * 명예의 전당: 끝까지 마친 게임에서 사람 회사의 최종 회사 가치 상위 10개와, 모든 판에 걸친 기록.
 * 게임이 끝났을 때(그만두기는 세지 않는다) 한 번만 더한다.
 */

export const HOF_SIZE = 10;

export interface FameEntry {
  /** 끝난 판의 열쇠 (같은 끝을 두 번 넣지 않게, 결과 화면에서 이 판 찾기) */
  k: string;
  name: string;
  seat: number;
  /** 실제 항공사 id (가상 항공사면 null) */
  airline: string | null;
  hub: string;
  startYear: number;
  /** 한 달 수 */
  months: number;
  mode: WinMode;
  challenge: string | null;
  model: BizModel;
  /** 최종 회사 가치 (억) */
  value: number;
  /** 그 판 순위 */
  place: number;
  won: boolean;
  /** 끝난 날 (Date.now()) */
  at: number;
}

export type RecordKind = 'fleet' | 'yearPax' | 'yearProfit' | 'trophies' | 'network' | 'cities' | 'totalPax';

export const RECORD_KINDS: readonly RecordKind[] = ['fleet', 'yearPax', 'yearProfit', 'trophies', 'network', 'cities', 'totalPax'];

export interface FameRecord {
  value: number;
  name: string;
  seat: number;
  airline: string | null;
  startYear: number;
  /** 한 해 기록이면 그 해 */
  year: number | null;
  at: number;
  k: string;
}

export interface HofStore {
  v: 1;
  games: FameEntry[];
  records: Partial<Record<RecordKind, FameRecord>>;
  seen: string[];
}

export function emptyHof(): HofStore {
  return { v: 1, games: [], records: {}, seen: [] };
}

const MODES: readonly WinMode[] = ['years', 'goal', 'challenge'];
const MODELS: readonly BizModel[] = ['full', 'lcc', 'cargo'];
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e13;

/** 순서: 회사 가치가 큰 순, 같으면 먼저 끝난 판 */
export function compareEntries(a: FameEntry, b: FameEntry): number {
  return b.value - a.value || a.at - b.at || a.seat - b.seat;
}

function parseEntry(v: unknown): FameEntry | null {
  if (!isObj(v)) return null;
  if (!isKey(v.k) || !isName(v.name) || !isSeat(v.seat) || !isYear(v.startYear) || !isTime(v.at)) return null;
  if (!isInt(v.months) || v.months < 1 || v.months > 1200) return null;
  if (!isAmount(v.value) || v.value <= 0) return null;
  if (!isInt(v.place) || v.place < 1 || v.place > 4) return null;
  if (!MODES.includes(v.mode as WinMode)) return null;
  return {
    k: v.k,
    name: v.name,
    seat: v.seat,
    airline: parseAirlineId(v.airline),
    hub: typeof v.hub === 'string' && CITY[v.hub] ? v.hub : '',
    startYear: v.startYear,
    months: v.months,
    mode: v.mode as WinMode,
    challenge: typeof v.challenge === 'string' && CHALLENGE[v.challenge] ? v.challenge : null,
    model: MODELS.includes(v.model as BizModel) ? (v.model as BizModel) : 'full',
    value: Math.round(v.value),
    place: v.place,
    won: v.won === true,
    at: v.at,
  };
}

function parseFameRecord(v: unknown): FameRecord | null {
  if (!isObj(v)) return null;
  if (!isAmount(v.value) || v.value <= 0 || !isName(v.name) || !isSeat(v.seat) || !isYear(v.startYear) || !isTime(v.at) || !isKey(v.k)) return null;
  return { value: v.value, name: v.name, seat: v.seat, airline: parseAirlineId(v.airline), startYear: v.startYear, year: isYear(v.year) ? v.year : null, at: v.at, k: v.k };
}

/** 저장된 명예의 전당을 꼼꼼히 읽는다 (망가진 줄은 버린다) */
export function parseHof(raw: unknown): HofStore {
  const out = emptyHof();
  if (!isObj(raw) || raw.v !== 1) return out;
  const games = (Array.isArray(raw.games) ? raw.games : []).map(parseEntry).filter((e): e is FameEntry => !!e);
  // 같은 판·같은 자리는 하나만
  const seen = new Set<string>();
  out.games = games
    .sort(compareEntries)
    .filter((e) => {
      const id = `${e.k}/${e.seat}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, HOF_SIZE);
  if (isObj(raw.records)) {
    for (const kind of RECORD_KINDS) {
      const r = parseFameRecord(raw.records[kind]);
      if (r) out.records[kind] = r;
    }
  }
  out.seen = [...new Set((Array.isArray(raw.seen) ? raw.seen : []).filter(isKey))].slice(-SEEN_KEEP);
  return out;
}

/** 사람 회사 하나의 기록할 값들 (한 해 기록은 그 해도) */
export function recordValues(state: AirlineState, ci: number): Record<RecordKind, { value: number; year: number | null }> {
  const c = state.companies[ci];
  let yearPax = { value: 0, year: null as number | null };
  let yearProfit = { value: 0, year: null as number | null };
  for (const y of state.years) {
    const r = y.companies[ci];
    if (!r) continue;
    if (r.pax > yearPax.value) yearPax = { value: Math.round(r.pax), year: y.year };
    if (r.profit > yearProfit.value) yearProfit = { value: Math.round(r.profit), year: y.year };
  }
  return {
    fleet: { value: c.planes.length, year: null },
    yearPax,
    yearProfit,
    trophies: { value: trophies(state, ci), year: null },
    network: { value: Math.round(flyingRoutes(c).reduce((s, r) => s + dist(r.a, r.b), 0)), year: null },
    cities: { value: c.out ? 0 : c.branches.length, year: null },
    totalPax: { value: Math.round(c.stats.pax), year: null },
  };
}

export interface HofResult {
  hof: HofStore;
  /** 사람 회사마다 명예의 전당 순위 (못 들었으면 null) */
  ranks: { ci: number; rank: number | null }[];
  /** 이 판에서 새로 세운 기록 */
  records: RecordKind[];
  /** 이미 넣은 끝이라 그대로 */
  already: boolean;
}

/** 게임이 끝났을 때: 사람 회사들을 명예의 전당과 기록에 넣는다 (같은 끝은 한 번만) */
export function recordGameEnd(hof: HofStore, state: AirlineState, now: number): HofResult {
  const humans = state.companies.map((c, i) => (c.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  if (state.phase !== 'gameover' || !state.result || humans.length === 0) return { hof, ranks: [], records: [], already: false };
  const k = endKey(state);
  if (hof.seen.includes(k)) return { hof, ranks: fameRanks(hof, state), records: newRecords(hof, state), already: true };
  const order = rankings(state);
  const months = state.t - state.startT + 1;
  const entries: FameEntry[] = [];
  for (const ci of humans) {
    const c = state.companies[ci];
    const value = Math.round(companyValue(state, ci));
    if (c.out || value <= 0) continue;
    entries.push({
      k,
      name: c.name.slice(0, 40) || '항공사',
      seat: c.seat,
      airline: parseAirlineId(c.airline),
      hub: c.hub,
      startYear: state.startYear,
      months,
      mode: state.options.mode,
      challenge: state.options.mode === 'challenge' ? (state.challenge?.id ?? state.options.challenge) : null,
      model: c.bizModel,
      value,
      place: Math.min(4, order.indexOf(ci) + 1),
      won: state.options.mode === 'challenge' ? !!state.result.success : state.result.winners.includes(ci),
      at: now,
    });
  }
  const games = [...hof.games, ...entries].sort(compareEntries).slice(0, HOF_SIZE);
  const records = { ...hof.records };
  for (const ci of humans) {
    const c = state.companies[ci];
    const vals = recordValues(state, ci);
    for (const kind of RECORD_KINDS) {
      const v = vals[kind];
      const old = records[kind];
      if (v.value <= 0 || (old && old.value >= v.value)) continue;
      records[kind] = { value: v.value, name: c.name.slice(0, 40) || '항공사', seat: c.seat, airline: parseAirlineId(c.airline), startYear: state.startYear, year: v.year, at: now, k };
    }
  }
  const next: HofStore = { v: 1, games, records, seen: [...hof.seen, k].slice(-SEEN_KEEP) };
  return { hof: next, ranks: fameRanks(next, state), records: newRecords(next, state), already: false };
}

/** 이 판의 사람 회사들이 명예의 전당 몇 위인지 (결과 화면) */
export function fameRanks(hof: HofStore, state: AirlineState): { ci: number; rank: number | null }[] {
  const k = endKey(state);
  return state.companies.flatMap((c, ci) => {
    if (c.kind !== 'human') return [];
    const i = hof.games.findIndex((e) => e.k === k && e.seat === c.seat);
    return [{ ci, rank: i >= 0 ? i + 1 : null }];
  });
}

/** 이 판이 세운 기록 */
export function newRecords(hof: HofStore, state: AirlineState): RecordKind[] {
  const k = endKey(state);
  return RECORD_KINDS.filter((kind) => hof.records[kind]?.k === k);
}
