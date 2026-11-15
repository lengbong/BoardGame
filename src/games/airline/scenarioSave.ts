import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { endKey } from './achievements';
import { SCENARIO, SCENARIOS } from './scenarios';
import type { AirlineState } from './types';

/*
 * 역사 시나리오의 저장 값.
 * - 게임 저장(4판)에 넣는 값은 모두 선택이에요: 없으면(예전 저장·다른 방식 게임) 예전 그대로.
 * - 시나리오마다 가장 좋은 기록은 게임 저장과 따로 이 브라우저에 남는다 (family-boardgame.airline.scenarios.v1).
 */

export const SCENARIO_STORE_KEY = 'family-boardgame.airline.scenarios.v1';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

// ------------------------------------------------------------------ 게임 저장

/** 설정의 시나리오 값 (올바를 때만 키를 둔다: 기본값 위에 펼쳐도 기본값을 지우지 않게) */
export function parseScenarioOption(o: Record<string, unknown>): { scenario?: string } {
  return typeof o.scenario === 'string' && SCENARIO[o.scenario] ? { scenario: o.scenario } : {};
}

/** 게임 상태의 시나리오 진행이 올바른지 (없으면 올바름) */
export function isValidScenarioState(s: AirlineState): boolean {
  const p = s.scenario as unknown;
  if (p === undefined) return true;
  if (!isObj(p) || typeof p.id !== 'string' || !SCENARIO[p.id]) return false;
  const def = SCENARIO[p.id];
  if (!isInt(p.company) || p.company < 0 || p.company >= s.companies.length) return false;
  if (!isInt(p.deadline)) return false;
  if (!Array.isArray(p.done) || p.done.length !== def.stages.length || !p.done.every((d) => d === null || isInt(d))) return false;
  // 단계는 차례대로: 이룬 단계 뒤에만 못 이룬 단계가 온다
  const first = p.done.findIndex((d) => d === null);
  if (first >= 0 && p.done.slice(first).some((d) => d !== null)) return false;
  if (p.stars !== undefined && !(isInt(p.stars) && p.stars >= 0 && p.stars <= 3)) return false;
  if (p.bonus !== undefined && typeof p.bonus !== 'boolean') return false;
  return true;
}

// ------------------------------------------------------------------ 가장 좋은 기록

export interface ScenarioBest {
  /** 가장 많이 받은 별 (0이면 아직 성공 못 함) */
  stars: number;
  /** 성공한 판 가운데 가장 빨리 마친 달 수 (성공 못 했으면 null) */
  months: number | null;
  /** 끝까지 해 본 판 수 */
  plays: number;
  /** 성공한 판 수 */
  wins: number;
  /** 가장 좋은 기록을 낸 날 (Date.now()) */
  at: number;
}

export interface ScenarioStore {
  v: 1;
  best: Record<string, ScenarioBest>;
  /** 이미 센 게임 끝 (같은 끝을 두 번 세지 않게, 최근 것만) */
  seen: string[];
}

export const SCENARIO_SEEN_KEEP = 30;

export function emptyScenarioStore(): ScenarioStore {
  return { v: 1, best: {}, seen: [] };
}

function parseBest(v: unknown): ScenarioBest | null {
  if (!isObj(v)) return null;
  const { stars, months, plays, wins, at } = v;
  if (!isInt(stars) || stars < 0 || stars > 3) return null;
  if (!isInt(plays) || plays < 1 || plays > 1e6 || !isInt(wins) || wins < 0 || wins > plays) return null;
  if (!(typeof at === 'number' && Number.isFinite(at) && at >= 0 && at < 1e14)) return null;
  const m = isInt(months) && months >= 1 && months <= 1200 ? months : null;
  // 별이 있으면 성공한 판과 걸린 달이 있어야 한다
  if (stars > 0 && (wins < 1 || m === null)) return null;
  return { stars, months: stars > 0 ? m : null, plays, wins, at };
}

/** 저장된 기록을 꼼꼼히 읽는다 (모르는 시나리오·망가진 값은 버린다) */
export function parseScenarioStore(raw: unknown): ScenarioStore {
  const out = emptyScenarioStore();
  if (!isObj(raw) || raw.v !== 1) return out;
  if (isObj(raw.best)) {
    for (const def of SCENARIOS) {
      const b = parseBest(raw.best[def.id]);
      if (b) out.best[def.id] = b;
    }
  }
  const seen = Array.isArray(raw.seen) ? raw.seen : [];
  out.seen = [...new Set(seen.filter((k): k is string => typeof k === 'string' && /^[0-9a-z]{2,24}$/.test(k)))].slice(-SCENARIO_SEEN_KEEP);
  return out;
}

/** 끝난 시나리오 게임 하나를 기록에 더한다 (사람 회사가 한 판만, 같은 끝은 한 번만) */
export function addScenarioResult(store: ScenarioStore, state: AirlineState, now: number): ScenarioStore {
  const p = state.scenario;
  if (state.phase !== 'gameover' || !state.result || state.options.mode !== 'scenario' || !p || !SCENARIO[p.id]) return store;
  if (state.companies[p.company]?.kind !== 'human') return store;
  const key = endKey(state);
  if (store.seen.includes(key)) return store;
  const won = !!state.result.success;
  const stars = won ? Math.max(1, Math.min(3, p.stars ?? 1)) : 0;
  const months = state.t - state.startT + 1;
  const old = store.best[p.id];
  const better = !old || stars > old.stars || (stars > 0 && stars === old.stars && (old.months === null || months < old.months));
  const best: ScenarioBest = {
    stars: better ? stars : old.stars,
    months: better ? (stars > 0 ? months : null) : old.months,
    plays: (old?.plays ?? 0) + 1,
    wins: (old?.wins ?? 0) + (won ? 1 : 0),
    at: better ? now : old.at,
  };
  return { ...store, best: { ...store.best, [p.id]: best }, seen: [...store.seen, key].slice(-SCENARIO_SEEN_KEEP) };
}

/** localStorage가 막힌 곳에서도 이 화면이 열려 있는 동안은 기억한다 */
let mem: ScenarioStore | null = null;

export function loadScenarioStore(): ScenarioStore {
  const raw = loadJson<unknown>(SCENARIO_STORE_KEY);
  return raw === null && mem ? mem : parseScenarioStore(raw);
}

/** 게임이 끝났을 때 부른다 (여러 번 불러도 한 번만 센다). 바뀐 기록을 돌려준다 */
export function recordScenarioEnd(state: AirlineState, now = Date.now()): ScenarioStore {
  const before = loadScenarioStore();
  const after = addScenarioResult(before, state, now);
  if (after !== before) {
    mem = after;
    saveJson(SCENARIO_STORE_KEY, after);
  }
  return after;
}

/** 기록을 모두 지운다 (시험용) */
export function resetScenarioStore(): void {
  mem = null;
  removeKey(SCENARIO_STORE_KEY);
}
