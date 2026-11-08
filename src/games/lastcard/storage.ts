import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { parseSpeed, type Speed } from '../common/speed';
import { DEFAULT_OPTIONS } from './rules';
import type { LastCardSetup, LastCardState } from './types';

const SAVE_KEY = 'family-boardgame.lastcard.save.v1';
const SETUP_KEY = 'family-boardgame.lastcard.setup.v1';
const SETTINGS_KEY = 'family-boardgame.lastcard.settings.v1';

export interface LastCardSettings {
  speed: Speed;
  muted: boolean;
  music: boolean;
}

export interface SavedLastCardGame {
  setup: LastCardSetup;
  state: LastCardState;
  savedAt: number;
}

export const DEFAULT_SETUP: LastCardSetup = {
  seats: [
    { kind: 'human', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'ai-normal', name: '' },
  ],
  options: DEFAULT_OPTIONS,
};

function isValidSetup(v: unknown): v is LastCardSetup {
  const s = v as LastCardSetup;
  return !!s && Array.isArray(s.seats) && s.seats.length === 4 && typeof s.options === 'object' && s.options !== null;
}

function isValidState(v: unknown): v is LastCardState {
  const s = v as LastCardState;
  return (
    !!s &&
    Array.isArray(s.players) &&
    s.players.length >= 2 &&
    s.players.every((p) => Array.isArray(p.hand)) &&
    Array.isArray(s.drawPile) &&
    Array.isArray(s.discard) &&
    s.discard.length > 0 &&
    typeof s.phase === 'string' &&
    typeof s.current === 'number' &&
    Array.isArray(s.log)
  );
}

export function loadSavedLastCardGame(): SavedLastCardGame | null {
  const saved = loadJson<SavedLastCardGame>(SAVE_KEY);
  if (!saved || !isValidSetup(saved.setup) || !isValidState(saved.state) || saved.state.phase === 'gameover') return null;
  return saved;
}

export function saveLastCardGame(setup: LastCardSetup, state: LastCardState): void {
  saveJson(SAVE_KEY, { setup, state, savedAt: Date.now() } satisfies SavedLastCardGame);
}

export function clearSavedLastCardGame(): void {
  removeKey(SAVE_KEY);
}

export function loadLastCardSetup(): LastCardSetup {
  const s = loadJson<LastCardSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  return { seats: s.seats, options: { ...DEFAULT_OPTIONS, ...s.options } };
}

export function saveLastCardSetup(setup: LastCardSetup): void {
  saveJson(SETUP_KEY, setup);
}

export function loadLastCardSettings(): LastCardSettings {
  const s = loadJson<Partial<LastCardSettings>>(SETTINGS_KEY);
  return { speed: parseSpeed(s?.speed), muted: s?.muted === true, music: s?.music !== false };
}

export function saveLastCardSettings(settings: LastCardSettings): void {
  saveJson(SETTINGS_KEY, settings);
}

/** think: 컴퓨터가 생각하는 시간, fly: 카드가 날아가는 시간, deal: 나눠 줄 때 한 장 간격 */
export const LASTCARD_DELAYS: Record<Speed, { think: number; fly: number; deal: number; fx: boolean }> = {
  normal: { think: 950, fly: 420, deal: 55, fx: true },
  fast: { think: 420, fly: 260, deal: 25, fx: true },
  turbo: { think: 40, fly: 0, deal: 0, fx: false },
};
