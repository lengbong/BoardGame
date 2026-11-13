import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { SEAT_KIND_OPTIONS } from '../common/players';
import { isValidCard } from '../common/playingCards';
import type { Speed } from '../common/speed';
import { DECK_SIZE, DEFAULT_OPTIONS } from './rules';
import type { CheatOptions, CheatSetup, CheatState } from './types';

const SAVE_KEY = 'family-boardgame.cheat.save.v1';
const SETUP_KEY = 'family-boardgame.cheat.setup.v1';
export const CHEAT_SETTINGS_KEY = 'family-boardgame.cheat.settings.v1';

export interface SavedCheatGame {
  setup: CheatSetup;
  state: CheatState;
  savedAt: number;
}

export const DEFAULT_SETUP: CheatSetup = {
  seats: [
    { kind: 'human', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'ai-normal', name: '' },
  ],
  options: DEFAULT_OPTIONS,
};

export function parseOptions(v: unknown): CheatOptions {
  const o = (v ?? {}) as Partial<CheatOptions>;
  return {
    handView: o.handView === 'open' ? 'open' : 'cover',
    doubt: o.doubt === 'next' ? 'next' : 'anyone',
    deal: o.deal === 'quick' ? 'quick' : 'all',
  };
}

function isValidSetup(v: unknown): v is CheatSetup {
  const s = v as CheatSetup;
  return (
    !!s &&
    Array.isArray(s.seats) &&
    s.seats.length === 4 &&
    s.seats.every((seat) => !!seat && typeof seat.name === 'string' && SEAT_KIND_OPTIONS.some((o) => o.value === seat.kind)) &&
    typeof s.options === 'object' &&
    s.options !== null
  );
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

function isValidState(v: unknown): v is CheatState {
  const s = v as CheatState;
  if (!s || !Array.isArray(s.players) || s.players.length < 2 || s.players.length > 4) return false;
  const n = s.players.length;
  if (s.phase !== 'play' && s.phase !== 'doubt') return false;
  if (!isInt(s.current) || s.current < 0 || s.current >= n || !isInt(s.rank) || s.rank < 1 || s.rank > 13) return false;
  if (!Array.isArray(s.pile) || !Array.isArray(s.aside) || !Array.isArray(s.doubters) || !Array.isArray(s.log)) return false;
  if (!s.players.every((p) => !!p && typeof p.name === 'string' && Array.isArray(p.hand) && p.hand.every(isValidCard) && !!p.stats)) return false;
  if (!s.pile.every((pc) => !!pc && isValidCard(pc.card) && isInt(pc.by) && pc.by >= 0 && pc.by < n) || !s.aside.every(isValidCard)) return false;
  if (!s.doubters.every((d) => isInt(d) && d >= 0 && d < n)) return false;
  if (s.phase === 'doubt' && (!s.claim || s.doubters.length === 0 || !Array.isArray(s.claim.cards))) return false;
  const ids = [...s.aside, ...s.pile.map((pc) => pc.card), ...s.players.flatMap((p) => p.hand)].map((c) => c.id);
  return ids.length === DECK_SIZE && new Set(ids).size === DECK_SIZE && ids.every((id) => id >= 0 && id < DECK_SIZE);
}

export function loadSavedCheatGame(): SavedCheatGame | null {
  const saved = loadJson<SavedCheatGame>(SAVE_KEY);
  if (!saved || !isValidSetup(saved.setup) || !isValidState(saved.state)) return null;
  return { ...saved, state: { ...saved.state, options: parseOptions(saved.state.options), events: [] } };
}

export function saveCheatGame(setup: CheatSetup, state: CheatState): void {
  saveJson(SAVE_KEY, { setup, state, savedAt: Date.now() } satisfies SavedCheatGame);
}

export function clearSavedCheatGame(): void {
  removeKey(SAVE_KEY);
}

export function loadCheatSetup(): CheatSetup {
  const s = loadJson<CheatSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  return { seats: s.seats, options: parseOptions(s.options) };
}

export function saveCheatSetup(setup: CheatSetup): void {
  saveJson(SETUP_KEY, setup);
}

/**
 * think: 컴퓨터가 낼 카드를 고르는 시간, doubtThink: 의심할지 정하는 시간, fly: 카드가 날아가는 시간,
 * claim: 말풍선을 보여 주는 시간, reveal: 뒤집은 카드를 보여 주는 시간, pass: '믿어요' 말풍선
 */
export const CHEAT_DELAYS: Record<Speed, { think: number; doubtThink: number; fly: number; claim: number; reveal: number; pass: number; fx: boolean }> = {
  normal: { think: 1100, doubtThink: 650, fly: 480, claim: 700, reveal: 1500, pass: 380, fx: true },
  fast: { think: 520, doubtThink: 320, fly: 300, claim: 380, reveal: 950, pass: 200, fx: true },
  turbo: { think: 60, doubtThink: 40, fly: 0, claim: 0, reveal: 450, pass: 0, fx: false },
};
