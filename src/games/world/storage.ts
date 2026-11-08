import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { parseSpeed, type Speed } from '../common/speed';
import { DEFAULT_OPTIONS } from './rules';
import type { WorldSetup, WorldState } from './types';

const SAVE_KEY = 'family-boardgame.world.save.v1';
const SETUP_KEY = 'family-boardgame.world.setup.v1';
const SETTINGS_KEY = 'family-boardgame.world.settings.v1';

export interface WorldSettings {
  speed: Speed;
  muted: boolean;
}

export interface SavedWorldGame {
  setup: WorldSetup;
  state: WorldState;
  savedAt: number;
}

export const DEFAULT_SETUP: WorldSetup = {
  seats: [
    { kind: 'human', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'human', name: '' },
    { kind: 'ai-normal', name: '' },
  ],
  options: DEFAULT_OPTIONS,
};

function isValidSetup(v: unknown): v is WorldSetup {
  const s = v as WorldSetup;
  return !!s && Array.isArray(s.seats) && s.seats.length === 4 && typeof s.options === 'object' && s.options !== null;
}

function isValidState(v: unknown): v is WorldState {
  const s = v as WorldState;
  return (
    !!s &&
    Array.isArray(s.players) &&
    s.players.length >= 2 &&
    Array.isArray(s.properties) &&
    s.properties.length === 32 &&
    Array.isArray(s.deck) &&
    typeof s.phase === 'string' &&
    typeof s.current === 'number'
  );
}

export function loadSavedWorldGame(): SavedWorldGame | null {
  const saved = loadJson<SavedWorldGame>(SAVE_KEY);
  if (!saved || !isValidSetup(saved.setup) || !isValidState(saved.state) || saved.state.phase === 'gameover') return null;
  return saved;
}

export function saveWorldGame(setup: WorldSetup, state: WorldState): void {
  saveJson(SAVE_KEY, { setup, state, savedAt: Date.now() } satisfies SavedWorldGame);
}

export function clearSavedWorldGame(): void {
  removeKey(SAVE_KEY);
}

export function loadLastWorldSetup(): WorldSetup {
  const s = loadJson<WorldSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  return { seats: s.seats, options: { ...DEFAULT_OPTIONS, ...s.options } };
}

export function saveLastWorldSetup(setup: WorldSetup): void {
  saveJson(SETUP_KEY, setup);
}

export function loadWorldSettings(): WorldSettings {
  const s = loadJson<Partial<WorldSettings>>(SETTINGS_KEY);
  return { speed: parseSpeed(s?.speed), muted: s?.muted === true };
}

export function saveWorldSettings(settings: WorldSettings): void {
  saveJson(SETTINGS_KEY, settings);
}

export const WORLD_DELAYS: Record<Speed, { dice: number; think: number; step: number }> = {
  normal: { dice: 600, think: 900, step: 150 },
  fast: { dice: 300, think: 350, step: 70 },
  turbo: { dice: 40, think: 30, step: 10 },
};
