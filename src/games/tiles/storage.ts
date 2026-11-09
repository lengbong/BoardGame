import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { parseSpeed, type Speed } from '../common/speed';
import { DEFAULT_OPTIONS } from './rules';
import type { TilesSetup, TilesState } from './types';

const SAVE_KEY = 'family-boardgame.tiles.save.v1';
const SETUP_KEY = 'family-boardgame.tiles.setup.v1';
const SETTINGS_KEY = 'family-boardgame.tiles.settings.v1';

export type SortMode = 'color' | 'number';

export interface TilesSettings {
  speed: Speed;
  muted: boolean;
  music: boolean;
  /** 내 타일 정렬: 색깔순(7 8 9) / 숫자순(7 7 7) */
  sort: SortMode;
}

export interface SavedTilesGame {
  setup: TilesSetup;
  state: TilesState;
  savedAt: number;
}

export const DEFAULT_SETUP: TilesSetup = {
  seats: [
    { kind: 'human', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'empty', name: '' },
  ],
  options: DEFAULT_OPTIONS,
};

function isValidSetup(v: unknown): v is TilesSetup {
  const s = v as TilesSetup;
  return !!s && Array.isArray(s.seats) && s.seats.length === 4 && typeof s.options === 'object' && s.options !== null;
}

function isValidState(v: unknown): v is TilesState {
  const s = v as TilesState;
  return (
    !!s &&
    Array.isArray(s.players) &&
    s.players.length >= 2 &&
    s.players.every((p) => Array.isArray(p.rack)) &&
    Array.isArray(s.pool) &&
    Array.isArray(s.table) &&
    typeof s.phase === 'string' &&
    typeof s.current === 'number' &&
    Array.isArray(s.log)
  );
}

export function loadSavedTilesGame(): SavedTilesGame | null {
  const saved = loadJson<SavedTilesGame>(SAVE_KEY);
  if (!saved || !isValidSetup(saved.setup) || !isValidState(saved.state) || saved.state.phase === 'gameover') return null;
  return saved;
}

export function saveTilesGame(setup: TilesSetup, state: TilesState): void {
  saveJson(SAVE_KEY, { setup, state, savedAt: Date.now() } satisfies SavedTilesGame);
}

export function clearSavedTilesGame(): void {
  removeKey(SAVE_KEY);
}

export function loadTilesSetup(): TilesSetup {
  const s = loadJson<TilesSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  return { seats: s.seats, options: { ...DEFAULT_OPTIONS, ...s.options } };
}

export function saveTilesSetup(setup: TilesSetup): void {
  saveJson(SETUP_KEY, setup);
}

export function loadTilesSettings(): TilesSettings {
  const s = loadJson<Partial<TilesSettings>>(SETTINGS_KEY);
  return { speed: parseSpeed(s?.speed), muted: s?.muted === true, music: s?.music !== false, sort: s?.sort === 'number' ? 'number' : 'color' };
}

export function saveTilesSettings(settings: TilesSettings): void {
  saveJson(SETTINGS_KEY, settings);
}

/** think: 컴퓨터가 생각하는 시간, glow: 방금 놓은 타일을 반짝이는 시간 */
export const TILES_DELAYS: Record<Speed, { think: number; glow: number }> = {
  normal: { think: 1300, glow: 2400 },
  fast: { think: 550, glow: 1300 },
  turbo: { think: 50, glow: 0 },
};
