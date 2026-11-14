import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { SEAT_KIND_OPTIONS } from '../common/players';
import type { Speed } from '../common/speed';
import { CARDS_PER_COLOR, CARD_KINDS, PLANS, ROUTES, STAMPS, TICKET_COLORS, WILD_CARDS } from './map';
import { DEFAULT_OPTIONS, WINDOW_SIZE, allPlanIds, countCards } from './rules';
import type { RailsOptions, RailsSetup, RailsState } from './types';

const SAVE_KEY = 'family-boardgame.rails.save.v1';
const SETUP_KEY = 'family-boardgame.rails.setup.v1';
export const RAILS_SETTINGS_KEY = 'family-boardgame.rails.settings.v1';

export interface SavedRailsGame {
  setup: RailsSetup;
  state: RailsState;
  savedAt: number;
}

export const DEFAULT_SETUP: RailsSetup = {
  seats: [
    { kind: 'human', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'empty', name: '' },
  ],
  options: DEFAULT_OPTIONS,
};

export function parseOptions(v: unknown): RailsOptions {
  const o = (v ?? {}) as Partial<RailsOptions>;
  return {
    handView: o.handView === 'open' ? 'open' : 'cover',
    planStart: o.planStart === 'kids' ? 'kids' : 'basic',
    stamps: o.stamps !== false,
    trains: o.trains === 40 ? 40 : 30,
  };
}

function isValidSetup(v: unknown): v is RailsSetup {
  const s = v as RailsSetup;
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
const isCount = (v: unknown): v is number => isInt(v) && v >= 0;

/** 저장된 상태를 꼼꼼히 검사한다 (망가진 저장은 버린다) */
export function isValidState(v: unknown): v is RailsState {
  const s = v as RailsState;
  if (!s || typeof s !== 'object' || !Array.isArray(s.players) || s.players.length < 2 || s.players.length > 4) return false;
  const n = s.players.length;
  if (s.phase !== 'plans' && s.phase !== 'play') return false;
  if (!isInt(s.current) || s.current < 0 || s.current >= n || !isInt(s.first) || s.first < 0 || s.first >= n) return false;
  if (!isCount(s.drawn) || s.drawn > 1 || !isCount(s.seed) || !isCount(s.passes) || !isCount(s.setupLeft)) return false;
  if (s.finalTurns !== null && !(isInt(s.finalTurns) && s.finalTurns > 0 && s.finalTurns <= n)) return false;
  if (!Array.isArray(s.deck) || !Array.isArray(s.discard) || !Array.isArray(s.window) || s.window.length !== WINDOW_SIZE) return false;
  if (!s.deck.every((c) => CARD_KINDS.includes(c)) || !s.discard.every((c) => CARD_KINDS.includes(c))) return false;
  if (!s.window.every((c) => c === null || TICKET_COLORS.includes(c))) return false;
  if (!Array.isArray(s.owners) || s.owners.length !== ROUTES.length || !s.owners.every((o) => o === null || (isInt(o) && o >= 0 && o < n))) return false;
  if (!s.stampFirst || typeof s.stampFirst !== 'object' || !STAMPS.every((st) => s.stampFirst[st.city] === null || (isInt(s.stampFirst[st.city]) && s.stampFirst[st.city]! < n)))
    return false;
  if (!Array.isArray(s.planDeck) || !Array.isArray(s.log)) return false;
  for (const [i, p] of s.players.entries()) {
    if (!p || typeof p.name !== 'string' || !p.hand || typeof p.hand !== 'object') return false;
    if (!CARD_KINDS.every((k) => isCount(p.hand[k]))) return false;
    if (!isCount(p.trains) || !Array.isArray(p.plans) || !Array.isArray(p.routes) || !Array.isArray(p.stamps)) return false;
    if (!isCount(p.routePoints) || !isCount(p.stampPoints)) return false;
    if (!p.routes.every((r) => isInt(r) && s.owners[r] === i)) return false;
  }
  if (s.owners.some((o, r) => o !== null && !s.players[o].routes.includes(r))) return false;
  // 표와 계획 카드가 모두 제자리에
  const cards = countCards(s);
  if (!TICKET_COLORS.every((c) => cards[c] === CARDS_PER_COLOR) || cards.wild !== WILD_CARDS) return false;
  const plans = allPlanIds(s);
  if (plans.length !== PLANS.length || new Set(plans).size !== PLANS.length || !plans.every((id) => PLANS.some((p) => p.id === id))) return false;
  if (s.phase === 'plans' && (!s.offer || !Array.isArray(s.offer.plans) || !isInt(s.offer.player) || s.offer.player >= n)) return false;
  if (s.phase === 'play' && s.offer) return false;
  return true;
}

export function loadSavedRailsGame(): SavedRailsGame | null {
  const saved = loadJson<SavedRailsGame>(SAVE_KEY);
  if (!saved || !isValidSetup(saved.setup) || !isValidState(saved.state)) return null;
  return { ...saved, state: { ...saved.state, options: parseOptions(saved.state.options), events: [] } };
}

export function saveRailsGame(setup: RailsSetup, state: RailsState): void {
  saveJson(SAVE_KEY, { setup, state, savedAt: Date.now() } satisfies SavedRailsGame);
}

export function clearSavedRailsGame(): void {
  removeKey(SAVE_KEY);
}

export function loadRailsSetup(): RailsSetup {
  const s = loadJson<RailsSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  return { seats: s.seats, options: parseOptions(s.options) };
}

export function saveRailsSetup(setup: RailsSetup): void {
  saveJson(SETUP_KEY, setup);
}

/**
 * think: 컴퓨터가 생각하는 시간, fly: 표가 날아가는 시간, car: 기차 칸이 하나씩 나타나는 간격,
 * after: 깐 뒤 잠깐 쉬는 시간, fx: 떠오르는 점수 등 연출
 */
export const RAILS_DELAYS: Record<Speed, { think: number; fly: number; car: number; after: number; fx: boolean }> = {
  normal: { think: 850, fly: 420, car: 120, after: 450, fx: true },
  fast: { think: 420, fly: 260, car: 65, after: 220, fx: true },
  turbo: { think: 50, fly: 0, car: 0, after: 0, fx: false },
};
