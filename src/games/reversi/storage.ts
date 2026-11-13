import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { DEFAULT_DUEL_SEATS, isDuelSeats } from '../common/duel';
import type { Speed } from '../common/speed';
import { DEFAULT_OPTIONS, countDiscs } from './rules';
import type { ReversiOptions, ReversiSetup, ReversiState } from './types';

const SAVE_KEY = 'family-boardgame.reversi.save.v1';
const SETUP_KEY = 'family-boardgame.reversi.setup.v1';
export const SETTINGS_KEY = 'family-boardgame.reversi.settings.v1';

export interface SavedReversiGame {
  setup: ReversiSetup;
  state: ReversiState;
  savedAt: number;
}

export const DEFAULT_SETUP: ReversiSetup = { seats: DEFAULT_DUEL_SEATS, options: DEFAULT_OPTIONS };

function parseOptions(v: unknown): ReversiOptions {
  const o = (v ?? {}) as Partial<ReversiOptions>;
  return {
    size: o.size === 6 ? 6 : 8,
    hints: typeof o.hints === 'boolean' ? o.hints : DEFAULT_OPTIONS.hints,
    undo: typeof o.undo === 'boolean' ? o.undo : DEFAULT_OPTIONS.undo,
  };
}

function isValidSetup(v: unknown): v is ReversiSetup {
  const s = v as ReversiSetup;
  return !!s && isDuelSeats(s.seats) && typeof s.options === 'object' && s.options !== null;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

function isValidState(v: unknown): v is ReversiState {
  const s = v as ReversiState;
  if (!s || (s.size !== 6 && s.size !== 8)) return false;
  const cells = s.size * s.size;
  return (
    Array.isArray(s.board) &&
    s.board.length === cells &&
    s.board.every((c) => c === -1 || c === 0 || c === 1) &&
    Array.isArray(s.players) &&
    s.players.length === 2 &&
    s.players.every((p) => !!p && typeof p.name === 'string' && typeof p.kind === 'string') &&
    (s.current === 0 || s.current === 1) &&
    s.phase === 'play' &&
    isInt(s.turn) &&
    (s.lastMove === null || (isInt(s.lastMove) && s.lastMove >= 0 && s.lastMove < cells)) &&
    Array.isArray(s.moves) &&
    s.moves.every((m) => !!m && (m.player === 0 || m.player === 1) && isInt(m.index) && m.index >= 0 && m.index < cells) &&
    Array.isArray(s.passes) &&
    Array.isArray(s.events) &&
    Array.isArray(s.log) &&
    isInt(s.nextEventId) &&
    isInt(s.nextLogId) &&
    typeof s.options === 'object' &&
    s.options !== null
  );
}

export function loadSavedReversiGame(): SavedReversiGame | null {
  const saved = loadJson<SavedReversiGame>(SAVE_KEY);
  if (!saved || !isValidSetup(saved.setup) || !isValidState(saved.state)) return null;
  const state = saved.state;
  // 돌 수는 판에서 다시 센다 (저장이 어긋나도 판이 기준)
  return { ...saved, state: { ...state, options: parseOptions(state.options), counts: countDiscs(state.board), events: [] } };
}

export function saveReversiGame(setup: ReversiSetup, state: ReversiState): void {
  saveJson(SAVE_KEY, { setup, state, savedAt: Date.now() } satisfies SavedReversiGame);
}

export function clearSavedReversiGame(): void {
  removeKey(SAVE_KEY);
}

export function loadReversiSetup(): ReversiSetup {
  const s = loadJson<ReversiSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  return { seats: s.seats, options: parseOptions(s.options) };
}

export function saveReversiSetup(setup: ReversiSetup): void {
  saveJson(SETUP_KEY, setup);
}

/**
 * think: 컴퓨터가 생각하는 시간 (어려움은 탐색 시간만큼 덜 기다린다)
 * place: 돌이 내려앉는 시간, step: 뒤집기 한 줄씩 사이 간격, flip: 한 돌이 뒤집히는 시간
 * pass: '넘어가요' 알림을 보여 주는 시간, fx: 연출을 할지
 */
export const REVERSI_DELAYS: Record<Speed, { think: number; place: number; step: number; flip: number; pass: number; fx: boolean }> = {
  normal: { think: 800, place: 220, step: 90, flip: 420, pass: 1700, fx: true },
  fast: { think: 380, place: 140, step: 55, flip: 300, pass: 1100, fx: true },
  turbo: { think: 40, place: 0, step: 0, flip: 0, pass: 650, fx: false },
};
