import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { CLASSIC_RULES } from './rules';
import type { GameSetup, GameState } from './types';

const SAVE_KEY = 'family-boardgame.race.save.v1';
const SETUP_KEY = 'family-boardgame.race.setup.v1';
const SETTINGS_KEY = 'family-boardgame.race.settings.v1';

import { parseSpeed, type Speed } from '../common/speed';

export type { Speed } from '../common/speed';

export interface Settings {
  speed: Speed;
  muted: boolean;
}

export interface SavedGame {
  setup: GameSetup;
  state: GameState;
  savedAt: number;
}

export const DEFAULT_SETUP: GameSetup = {
  seats: [
    { kind: 'human', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'human', name: '' },
    { kind: 'ai-normal', name: '' },
  ],
  rules: CLASSIC_RULES,
};

function isValidSetup(v: unknown): v is GameSetup {
  const s = v as GameSetup;
  return !!s && Array.isArray(s.seats) && s.seats.length === 4 && typeof s.rules === 'object' && s.rules !== null;
}

function isValidState(v: unknown): v is GameState {
  const s = v as GameState;
  return (
    !!s &&
    Array.isArray(s.players) &&
    s.players.length >= 2 &&
    s.players.every((p) => Array.isArray(p.pieces) && p.pieces.length === 4) &&
    typeof s.phase === 'string' &&
    typeof s.current === 'number' &&
    Array.isArray(s.log)
  );
}

export function loadSavedGame(): SavedGame | null {
  const saved = loadJson<SavedGame>(SAVE_KEY);
  if (!saved || !isValidSetup(saved.setup) || !isValidState(saved.state)) return null;
  if (saved.state.phase === 'gameover') return null;
  return saved;
}

export function saveGame(setup: GameSetup, state: GameState): void {
  saveJson(SAVE_KEY, { setup, state, savedAt: Date.now() } satisfies SavedGame);
}

export function clearSavedGame(): void {
  removeKey(SAVE_KEY);
}

export function loadLastSetup(): GameSetup {
  const s = loadJson<GameSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  return { seats: s.seats, rules: { ...CLASSIC_RULES, ...s.rules } };
}

export function saveLastSetup(setup: GameSetup): void {
  saveJson(SETUP_KEY, setup);
}

export function loadSettings(): Settings {
  const s = loadJson<Partial<Settings>>(SETTINGS_KEY);
  return {
    speed: parseSpeed(s?.speed),
    muted: s?.muted === true,
  };
}

export function saveSettings(settings: Settings): void {
  saveJson(SETTINGS_KEY, settings);
}

export const SPEED_DELAYS: Record<Speed, { dice: number; think: number; step: number; pass: number }> = {
  normal: { dice: 600, think: 700, step: 170, pass: 1200 },
  fast: { dice: 300, think: 300, step: 80, pass: 600 },
  turbo: { dice: 40, think: 30, step: 12, pass: 60 },
};
