import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { SEAT_KIND_OPTIONS } from '../common/players';
import { isValidCard } from '../common/playingCards';
import type { Speed } from '../common/speed';
import { DECK_SIZE, DEFAULT_OPTIONS } from './rules';
import type { OldMaidSetup, OldMaidState } from './types';

const SAVE_KEY = 'family-boardgame.oldmaid.save.v1';
const SETUP_KEY = 'family-boardgame.oldmaid.setup.v1';
export const OLDMAID_SETTINGS_KEY = 'family-boardgame.oldmaid.settings.v1';

export interface SavedOldMaidGame {
  setup: OldMaidSetup;
  state: OldMaidState;
  savedAt: number;
}

export const DEFAULT_SETUP: OldMaidSetup = {
  seats: [
    { kind: 'human', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'ai-normal', name: '' },
  ],
  options: DEFAULT_OPTIONS,
};

function isValidSetup(v: unknown): v is OldMaidSetup {
  const s = v as OldMaidSetup;
  return (
    !!s &&
    Array.isArray(s.seats) &&
    s.seats.length === 4 &&
    s.seats.every((seat) => !!seat && typeof seat.name === 'string' && SEAT_KIND_OPTIONS.some((o) => o.value === seat.kind)) &&
    typeof s.options === 'object' &&
    s.options !== null
  );
}

const PHASES = ['deal', 'play', 'gameover'];

function isValidState(v: unknown): v is OldMaidState {
  const s = v as OldMaidState;
  if (!s || !Array.isArray(s.players) || s.players.length < 2 || s.players.length > 4) return false;
  if (!PHASES.includes(s.phase) || !Number.isInteger(s.current) || s.current < 0 || s.current >= s.players.length) return false;
  if (!Array.isArray(s.discard) || !Array.isArray(s.finished) || !Array.isArray(s.log) || !Array.isArray(s.events)) return false;
  if (!Array.isArray(s.jokerKnownBy) || !Array.isArray(s.picks) || s.picks.length !== s.players.length) return false;
  if (!s.players.every((p) => !!p && Array.isArray(p.hand) && p.hand.every(isValidCard) && typeof p.name === 'string')) return false;
  if (!s.discard.every(isValidCard)) return false;
  const ids = [...s.discard, ...s.players.flatMap((p) => p.hand)].map((c) => c.id);
  return ids.length === DECK_SIZE && new Set(ids).size === DECK_SIZE;
}

export function loadSavedOldMaidGame(): SavedOldMaidGame | null {
  const saved = loadJson<SavedOldMaidGame>(SAVE_KEY);
  if (!saved || !isValidSetup(saved.setup) || !isValidState(saved.state) || saved.state.phase === 'gameover') return null;
  return saved;
}

export function saveOldMaidGame(setup: OldMaidSetup, state: OldMaidState): void {
  saveJson(SAVE_KEY, { setup, state, savedAt: Date.now() } satisfies SavedOldMaidGame);
}

export function clearSavedOldMaidGame(): void {
  removeKey(SAVE_KEY);
}

export function loadOldMaidSetup(): OldMaidSetup {
  const s = loadJson<OldMaidSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  return { seats: s.seats, options: { ...DEFAULT_OPTIONS, ...s.options } };
}

export function saveOldMaidSetup(setup: OldMaidSetup): void {
  saveJson(SETUP_KEY, setup);
}

/**
 * think: 컴퓨터가 고르는 시간, fly: 카드가 날아가는 시간, deal: 나눠 줄 때 한 장 간격,
 * suspense: 사람이 카드를 누르고 뒤집기 전 두근두근 시간, hold: 짝을 보여 주는 시간
 */
export const OLDMAID_DELAYS: Record<Speed, { think: number; fly: number; deal: number; suspense: number; hold: number; fx: boolean }> = {
  normal: { think: 1000, fly: 520, deal: 22, suspense: 700, hold: 650, fx: true },
  fast: { think: 450, fly: 320, deal: 10, suspense: 350, hold: 320, fx: true },
  turbo: { think: 60, fly: 0, deal: 0, suspense: 0, hold: 0, fx: false },
};
