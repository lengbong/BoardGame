import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { DEFAULT_DUEL_SEATS, isDuelSeats } from '../common/duel';
import type { Speed } from '../common/speed';
import { DEFAULT_OPTIONS, replay } from './rules';
import type { OmokOptions, OmokSetup, OmokState } from './types';

const SAVE_KEY = 'family-boardgame.omok.save.v1';
const SETUP_KEY = 'family-boardgame.omok.setup.v1';
export const SETTINGS_KEY = 'family-boardgame.omok.settings.v1';

export interface SavedOmokGame {
  setup: OmokSetup;
  state: OmokState;
  savedAt: number;
}

export const DEFAULT_SETUP: OmokSetup = { seats: DEFAULT_DUEL_SEATS, options: DEFAULT_OPTIONS };

export function parseOptions(v: unknown): OmokOptions {
  const o = (v ?? {}) as Partial<OmokOptions>;
  return {
    size: o.size === 13 ? 13 : 15,
    rule: o.rule === 'free' || o.rule === 'renju' ? o.rule : 'no33',
    hints: typeof o.hints === 'boolean' ? o.hints : DEFAULT_OPTIONS.hints,
    undo: typeof o.undo === 'boolean' ? o.undo : DEFAULT_OPTIONS.undo,
    numbers: typeof o.numbers === 'boolean' ? o.numbers : DEFAULT_OPTIONS.numbers,
  };
}

function isValidSetup(v: unknown): v is OmokSetup {
  const s = v as OmokSetup;
  return !!s && isDuelSeats(s.seats) && typeof s.options === 'object' && s.options !== null;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

function isValidState(v: unknown): v is OmokState {
  const s = v as OmokState;
  return (
    !!s &&
    s.phase === 'play' &&
    Array.isArray(s.players) &&
    s.players.length === 2 &&
    s.players.every((p) => !!p && typeof p.name === 'string' && typeof p.kind === 'string') &&
    Array.isArray(s.moves) &&
    s.moves.every(isInt) &&
    Array.isArray(s.log) &&
    isInt(s.nextEventId) &&
    isInt(s.nextLogId)
  );
}

export function loadSavedOmokGame(): SavedOmokGame | null {
  const saved = loadJson<SavedOmokGame>(SAVE_KEY);
  if (!saved || !isValidSetup(saved.setup) || !isValidState(saved.state)) return null;
  // 판은 둔 수를 처음부터 다시 두어 만든다 (저장이 어긋나도 규칙대로)
  const state = { ...saved.state, options: parseOptions(saved.state.options) };
  const rebuilt = replay(state, state.moves.length);
  if (rebuilt.phase !== 'play' || rebuilt.moves.length !== state.moves.length) return null;
  return { ...saved, state: { ...rebuilt, log: state.log, nextLogId: state.nextLogId, nextEventId: state.nextEventId, events: [] } };
}

export function saveOmokGame(setup: OmokSetup, state: OmokState): void {
  saveJson(SAVE_KEY, { setup, state, savedAt: Date.now() } satisfies SavedOmokGame);
}

export function clearSavedOmokGame(): void {
  removeKey(SAVE_KEY);
}

export function loadOmokSetup(): OmokSetup {
  const s = loadJson<OmokSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  return { seats: s.seats, options: parseOptions(s.options) };
}

export function saveOmokSetup(setup: OmokSetup): void {
  saveJson(SETUP_KEY, setup);
}

/** think: 컴퓨터가 생각하는 시간(최소), place: 돌을 놓는 연출, win: 이긴 줄을 보여 준 뒤 결과까지 */
export const OMOK_DELAYS: Record<Speed, { think: number; place: number; win: number; fx: boolean }> = {
  normal: { think: 650, place: 220, win: 1500, fx: true },
  fast: { think: 300, place: 120, win: 900, fx: true },
  turbo: { think: 40, place: 0, win: 350, fx: false },
};
