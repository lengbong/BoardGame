import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { SEAT_KIND_OPTIONS } from '../common/players';
import type { Speed } from '../common/speed';
import { CARD_COUNT, GOAL_IDS, TOKENS } from './cards';
import { BAG_BEES, BAG_PER_RES, DEFAULT_OPTIONS, GREENHOUSE_SIZE, HIVE_BEES, MARKET_SIZE, tokenTotal } from './rules';
import type { GardenOptions, GardenSetup, GardenState, TokenCount } from './types';

const SAVE_KEY = 'family-boardgame.garden.save.v1';
const SETUP_KEY = 'family-boardgame.garden.setup.v1';
export const GARDEN_SETTINGS_KEY = 'family-boardgame.garden.settings.v1';

export interface SavedGardenGame {
  setup: GardenSetup;
  state: GardenState;
  savedAt: number;
}

export const DEFAULT_SETUP: GardenSetup = {
  seats: [
    { kind: 'human', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'empty', name: '' },
  ],
  options: DEFAULT_OPTIONS,
};

export function parseOptions(v: unknown): GardenOptions {
  const o = (v ?? {}) as Partial<GardenOptions>;
  return {
    target: o.target === 12 || o.target === 18 ? o.target : 15,
    sale: o.sale !== false,
    ribbons: o.ribbons !== false,
  };
}

function isValidSetup(v: unknown): v is GardenSetup {
  const s = v as GardenSetup;
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
const isCount = (v: unknown, max = 99): v is number => isInt(v) && v >= 0 && v <= max;
const isTokens = (t: unknown): t is TokenCount => !!t && typeof t === 'object' && TOKENS.every((k) => isCount((t as TokenCount)[k]));
const isCardId = (v: unknown) => isInt(v) && v >= 0 && v < CARD_COUNT;

function isValidState(v: unknown): v is GardenState {
  const s = v as GardenState;
  if (!s || !Array.isArray(s.players) || s.players.length < 2 || s.players.length > 4) return false;
  const n = s.players.length;
  if (s.phase !== 'play' && s.phase !== 'discard') return false;
  if (!isCount(s.current, n - 1) || !isCount(s.first, n - 1) || !isInt(s.round) || s.round < 1 || !isInt(s.turn)) return false;
  if (!Array.isArray(s.field) || s.field.length !== 9 || !s.field.every((t) => t === null || TOKENS.includes(t))) return false;
  if (!isTokens(s.bag) || !isCount(s.hive, HIVE_BEES)) return false;
  if (!Array.isArray(s.deck) || !Array.isArray(s.market) || !Array.isArray(s.wilted) || s.market.length > MARKET_SIZE) return false;
  if (!Array.isArray(s.ribbons) || !s.ribbons.every((r) => !!r && GOAL_IDS.includes(r.goal) && (r.owner === null || isCount(r.owner, n - 1)))) return false;
  if (!Array.isArray(s.log) || !Array.isArray(s.winners)) return false;
  for (const p of s.players) {
    if (!p || typeof p.name !== 'string' || !isTokens(p.tokens) || !Array.isArray(p.garden) || !Array.isArray(p.greenhouse) || !isInt(p.bonusPoints)) return false;
    if (p.greenhouse.length > GREENHOUSE_SIZE || !['human', 'ai-easy', 'ai-normal'].includes(p.kind)) return false;
  }
  // 모든 식물 카드는 정확히 한 곳에만 있다
  const ids = [...s.deck, ...s.market, ...s.wilted, ...s.players.flatMap((p) => [...p.garden, ...p.greenhouse])];
  if (ids.length !== CARD_COUNT || !ids.every(isCardId) || new Set(ids).size !== CARD_COUNT) return false;
  // 토큰 수도 맞아야 한다
  const tokens = tokenTotal(s.bag) + s.field.filter((t) => t !== null).length + s.players.reduce((a, p) => a + tokenTotal(p.tokens), 0) + s.hive;
  return tokens === BAG_PER_RES * 4 + BAG_BEES + HIVE_BEES;
}

export function loadSavedGardenGame(): SavedGardenGame | null {
  const saved = loadJson<SavedGardenGame>(SAVE_KEY);
  if (!saved || !isValidSetup(saved.setup) || !isValidState(saved.state)) return null;
  return { ...saved, state: { ...saved.state, options: parseOptions(saved.state.options), events: [] } };
}

export function saveGardenGame(setup: GardenSetup, state: GardenState): void {
  saveJson(SAVE_KEY, { setup, state, savedAt: Date.now() } satisfies SavedGardenGame);
}

export function clearSavedGardenGame(): void {
  removeKey(SAVE_KEY);
}

export function loadGardenSetup(): GardenSetup {
  const s = loadJson<GardenSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  return { seats: s.seats, options: parseOptions(s.options) };
}

export function saveGardenSetup(setup: GardenSetup): void {
  saveJson(SETUP_KEY, setup);
}

/** 저장된 상태를 검사하는 함수 (테스트용) */
export const validateSavedState = isValidState;

/**
 * think: 컴퓨터가 생각하는 시간, fly: 토큰·카드가 날아가는 시간, slide: 시장이 밀리는 시간,
 * pause: 행동 뒤 잠깐 쉬는 시간, fx: 떠오르는 숫자·말풍선 같은 연출을 보일지
 */
export const GARDEN_DELAYS: Record<Speed, { think: number; fly: number; slide: number; pause: number; fx: boolean }> = {
  normal: { think: 950, fly: 560, slide: 420, pause: 260, fx: true },
  fast: { think: 460, fly: 340, slide: 280, pause: 120, fx: true },
  turbo: { think: 60, fly: 0, slide: 0, pause: 0, fx: false },
};
