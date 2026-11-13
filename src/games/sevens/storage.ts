import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { SEAT_KIND_OPTIONS } from '../common/players';
import { SUITS, isValidCard } from '../common/playingCards';
import type { Speed } from '../common/speed';
import { DEFAULT_OPTIONS, TARGET_SCORES, placedCount } from './rules';
import type { SevensSetup, SevensState } from './types';

const SAVE_KEY = 'family-boardgame.sevens.save.v1';
const SETUP_KEY = 'family-boardgame.sevens.setup.v1';
export const SEVENS_SETTINGS_KEY = 'family-boardgame.sevens.settings.v1';

export interface SavedSevensGame {
  setup: SevensSetup;
  state: SevensState;
  savedAt: number;
}

export const DEFAULT_SETUP: SevensSetup = {
  seats: [
    { kind: 'human', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'ai-normal', name: '' },
  ],
  options: DEFAULT_OPTIONS,
};

function isValidSetup(v: unknown): v is SevensSetup {
  const s = v as SevensSetup;
  return (
    !!s &&
    Array.isArray(s.seats) &&
    s.seats.length === 4 &&
    s.seats.every((seat) => !!seat && typeof seat.name === 'string' && SEAT_KIND_OPTIONS.some((o) => o.value === seat.kind)) &&
    typeof s.options === 'object' &&
    s.options !== null
  );
}

const PHASES = ['play', 'roundover', 'gameover'];
const STATUSES = ['playing', 'finished', 'out'];

function isValidState(v: unknown): v is SevensState {
  const s = v as SevensState;
  if (!s || !Array.isArray(s.players) || s.players.length < 2 || s.players.length > 4) return false;
  if (!PHASES.includes(s.phase) || !Number.isInteger(s.current) || s.current < 0 || s.current >= s.players.length) return false;
  if (!Array.isArray(s.log) || !Array.isArray(s.events) || !Array.isArray(s.finishOrder) || !Array.isArray(s.outOrder)) return false;
  if (!s.board || typeof s.board !== 'object' || !SUITS.every((suit) => Array.isArray(s.board[suit]) && s.board[suit].length === 14)) return false;
  if (!s.players.every((p) => !!p && Array.isArray(p.hand) && p.hand.every(isValidCard) && STATUSES.includes(p.status) && typeof p.score === 'number')) return false;
  const ids = s.players.flatMap((p) => p.hand.map((c) => c.id));
  if (new Set(ids).size !== ids.length) return false;
  // 손패와 판의 카드가 합쳐서 52장 (진행 중일 때)
  return s.phase !== 'play' || ids.length + placedCount(s.board) === 52;
}

export function loadSavedSevensGame(): SavedSevensGame | null {
  const saved = loadJson<SavedSevensGame>(SAVE_KEY);
  if (!saved || !isValidSetup(saved.setup) || !isValidState(saved.state) || saved.state.phase === 'gameover') return null;
  return saved;
}

export function saveSevensGame(setup: SevensSetup, state: SevensState): void {
  saveJson(SAVE_KEY, { setup, state, savedAt: Date.now() } satisfies SavedSevensGame);
}

export function clearSavedSevensGame(): void {
  removeKey(SAVE_KEY);
}

export function loadSevensSetup(): SevensSetup {
  const s = loadJson<SevensSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  const options = { ...DEFAULT_OPTIONS, ...s.options };
  if (!TARGET_SCORES.includes(options.targetScore)) options.targetScore = DEFAULT_OPTIONS.targetScore;
  return { seats: s.seats, options };
}

export function saveSevensSetup(setup: SevensSetup): void {
  saveJson(SETUP_KEY, setup);
}

/** think: 컴퓨터가 생각하는 시간, fly: 카드가 날아가는 시간, deal: 나눠 줄 때 한 장 간격 */
export const SEVENS_DELAYS: Record<Speed, { think: number; fly: number; deal: number; fx: boolean }> = {
  normal: { think: 850, fly: 460, deal: 20, fx: true },
  fast: { think: 380, fly: 280, deal: 9, fx: true },
  turbo: { think: 40, fly: 0, deal: 0, fx: false },
};
