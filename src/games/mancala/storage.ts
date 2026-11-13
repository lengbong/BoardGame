import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { DEFAULT_DUEL_SEATS, isDuelSeats } from '../common/duel';
import type { Speed } from '../common/speed';
import { CELLS, DEFAULT_OPTIONS, SEED_COUNTS } from './rules';
import type { MancalaOptions, MancalaSetup, MancalaState } from './types';

const SAVE_KEY = 'family-boardgame.mancala.save.v1';
const SETUP_KEY = 'family-boardgame.mancala.setup.v1';
export const SETTINGS_KEY = 'family-boardgame.mancala.settings.v1';

export interface SavedMancalaGame {
  setup: MancalaSetup;
  state: MancalaState;
  savedAt: number;
}

export const DEFAULT_SETUP: MancalaSetup = {
  seats: DEFAULT_DUEL_SEATS,
  options: DEFAULT_OPTIONS,
  hints: true,
};

/** 망가진 옵션은 기본값으로 바꿔 끼운다. */
export function normalizeOptions(v: unknown): MancalaOptions {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<MancalaOptions>;
  return {
    seeds: SEED_COUNTS.includes(o.seeds as never) ? (o.seeds as MancalaOptions['seeds']) : DEFAULT_OPTIONS.seeds,
    captureEmpty: typeof o.captureEmpty === 'boolean' ? o.captureEmpty : DEFAULT_OPTIONS.captureEmpty,
    sweep: o.sweep === 'emptier' || o.sweep === 'owner' ? o.sweep : DEFAULT_OPTIONS.sweep,
    undo: typeof o.undo === 'boolean' ? o.undo : DEFAULT_OPTIONS.undo,
  };
}

export function isValidSetup(v: unknown): v is MancalaSetup {
  const s = v as MancalaSetup;
  return !!s && typeof s === 'object' && isDuelSeats(s.seats) && typeof s.options === 'object' && s.options !== null;
}

const isCount = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0;

/** 저장된 상태를 꼼꼼히 검사한다. 씨앗 수가 맞지 않거나 모양이 다르면 버린다. */
export function isValidState(v: unknown): v is MancalaState {
  const s = v as MancalaState;
  if (!s || typeof s !== 'object') return false;
  if (!Array.isArray(s.board) || s.board.length !== CELLS || !s.board.every(isCount)) return false;
  const opts = s.options;
  if (!opts || !SEED_COUNTS.includes(opts.seeds)) return false;
  const total = s.board.reduce((a, b) => a + b, 0);
  if (total !== opts.seeds * 12) return false;
  if (s.current !== 0 && s.current !== 1) return false;
  if (s.phase !== 'play' && s.phase !== 'gameover') return false;
  if (!Array.isArray(s.players) || s.players.length !== 2 || !isDuelSeats(s.players)) return false;
  if (!Array.isArray(s.stats) || s.stats.length !== 2 || !s.stats.every((st) => st && isCount(st.captures) && isCount(st.captured) && isCount(st.extraTurns)))
    return false;
  if (!Array.isArray(s.events) || !Array.isArray(s.log) || !isCount(s.turn) || !isCount(s.nextEventId) || !isCount(s.nextLogId)) return false;
  if (s.phase === 'play') {
    // 진행 중인데 지금 차례인 편이 둘 곳이 없으면 망가진 상태
    const start = s.current * 7;
    if (s.board.slice(start, start + 6).every((n) => n === 0)) return false;
  }
  return true;
}

export function loadSavedMancalaGame(): SavedMancalaGame | null {
  const saved = loadJson<SavedMancalaGame>(SAVE_KEY);
  if (!saved || !isValidSetup(saved.setup) || !isValidState(saved.state) || saved.state.phase === 'gameover') return null;
  return {
    setup: { ...saved.setup, options: normalizeOptions(saved.setup.options), hints: saved.setup.hints !== false },
    state: { ...saved.state, options: normalizeOptions(saved.state.options) },
    savedAt: typeof saved.savedAt === 'number' ? saved.savedAt : Date.now(),
  };
}

export function saveMancalaGame(setup: MancalaSetup, state: MancalaState): void {
  saveJson(SAVE_KEY, { setup, state, savedAt: Date.now() } satisfies SavedMancalaGame);
}

export function clearSavedMancalaGame(): void {
  removeKey(SAVE_KEY);
}

export function loadMancalaSetup(): MancalaSetup {
  const s = loadJson<MancalaSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  return { seats: s.seats, options: normalizeOptions(s.options), hints: s.hints !== false };
}

export function saveMancalaSetup(setup: MancalaSetup): void {
  saveJson(SETUP_KEY, setup);
}

/**
 * think: 컴퓨터가 생각하는 시간, step: 씨앗 한 알을 옮기는 시간, fly: 가져오기·정리 때 씨앗이 창고로 날아가는 시간,
 * fx: 말풍선 같은 연출을 보여 줄지
 */
export const MANCALA_DELAYS: Record<Speed, { think: number; step: number; fly: number; pause: number; fx: boolean }> = {
  normal: { think: 750, step: 250, fly: 560, pause: 260, fx: true },
  fast: { think: 340, step: 130, fly: 340, pause: 140, fx: true },
  turbo: { think: 30, step: 0, fly: 0, pause: 0, fx: false },
};
