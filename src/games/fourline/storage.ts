import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { DEFAULT_DUEL_SEATS, isDuelSeats } from '../common/duel';
import type { Speed } from '../common/speed';
import { CELLS, COLS, DEFAULT_OPTIONS, replay } from './rules';
import type { FourLineOptions, FourLineSetup, FourLineState } from './types';

const SAVE_KEY = 'family-boardgame.fourline.save.v1';
const SETUP_KEY = 'family-boardgame.fourline.setup.v1';
export const SETTINGS_KEY = 'family-boardgame.fourline.settings.v1';

export interface SavedFourLineGame {
  setup: FourLineSetup;
  state: FourLineState;
  savedAt: number;
}

export const DEFAULT_SETUP: FourLineSetup = { seats: DEFAULT_DUEL_SEATS, options: DEFAULT_OPTIONS };

function parseOptions(v: unknown): FourLineOptions {
  const o = (v ?? {}) as Partial<FourLineOptions>;
  return {
    hints: typeof o.hints === 'boolean' ? o.hints : DEFAULT_OPTIONS.hints,
    undo: typeof o.undo === 'boolean' ? o.undo : DEFAULT_OPTIONS.undo,
  };
}

function isValidSetup(v: unknown): v is FourLineSetup {
  const s = v as FourLineSetup;
  return !!s && isDuelSeats(s.seats) && typeof s.options === 'object' && s.options !== null;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

function isValidState(v: unknown): v is FourLineState {
  const s = v as FourLineState;
  return (
    !!s &&
    Array.isArray(s.board) &&
    s.board.length === CELLS &&
    s.board.every((c) => c === -1 || c === 0 || c === 1) &&
    Array.isArray(s.players) &&
    s.players.length === 2 &&
    s.players.every((p) => !!p && typeof p.name === 'string' && typeof p.kind === 'string') &&
    s.phase === 'play' &&
    Array.isArray(s.moves) &&
    s.moves.every((c) => isInt(c) && c >= 0 && c < COLS) &&
    Array.isArray(s.log) &&
    isInt(s.nextEventId) &&
    isInt(s.nextLogId)
  );
}

export function loadSavedFourLineGame(): SavedFourLineGame | null {
  const saved = loadJson<SavedFourLineGame>(SAVE_KEY);
  if (!saved || !isValidSetup(saved.setup) || !isValidState(saved.state)) return null;
  // 판은 둔 수를 처음부터 다시 두어 만든다 (저장이 어긋나도 규칙대로)
  const state = { ...saved.state, options: parseOptions(saved.state.options) };
  const rebuilt = replay(state, state.moves.length);
  if (rebuilt.phase !== 'play' || rebuilt.moves.length !== state.moves.length) return null;
  return { ...saved, state: { ...rebuilt, log: state.log, nextLogId: state.nextLogId, nextEventId: state.nextEventId, events: [] } };
}

export function saveFourLineGame(setup: FourLineSetup, state: FourLineState): void {
  saveJson(SAVE_KEY, { setup, state, savedAt: Date.now() } satisfies SavedFourLineGame);
}

export function clearSavedFourLineGame(): void {
  removeKey(SAVE_KEY);
}

export function loadFourLineSetup(): FourLineSetup {
  const s = loadJson<FourLineSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  return { seats: s.seats, options: parseOptions(s.options) };
}

export function saveFourLineSetup(setup: FourLineSetup): void {
  saveJson(SETUP_KEY, setup);
}

/**
 * think: 컴퓨터가 생각하는 시간 (어려움은 탐색 시간만큼 덜 기다린다)
 * fall: 맨 위에서 맨 아래까지 떨어지는 시간 (튀어 오르는 시간은 따로), win: 이긴 줄을 보여 준 뒤 결과까지
 */
export const FOURLINE_DELAYS: Record<Speed, { think: number; fall: number; win: number; fx: boolean }> = {
  normal: { think: 750, fall: 420, win: 1600, fx: true },
  fast: { think: 340, fall: 280, win: 1000, fx: true },
  turbo: { think: 40, fall: 0, win: 450, fx: false },
};

/** 줄(0이 맨 위)까지 떨어지는 데 걸리는 시간과 튀는 시간까지 더한 전체 시간 */
export function dropTiming(fall: number, row: number): { impact: number; total: number } {
  if (fall <= 0) return { impact: 0, total: 0 };
  const impact = Math.round(fall * Math.sqrt((row + 1.4) / 6.4));
  return { impact, total: Math.round(impact / 0.68) };
}
