import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { DEFAULT_DUEL_SEATS, DUEL_KIND_OPTIONS, isDuelSeats } from '../common/duel';
import type { Speed } from '../common/speed';
import { isValidFleet } from './fleet';
import { DEFAULT_OPTIONS } from './rules';
import type { ShipsOptions, ShipsSetup, ShipsState } from './types';

const SAVE_KEY = 'family-boardgame.ships.save.v1';
const SETUP_KEY = 'family-boardgame.ships.setup.v1';
export const SHIPS_SETTINGS_KEY = 'family-boardgame.ships.settings.v1';

export interface SavedShipsGame {
  setup: ShipsSetup;
  state: ShipsState;
  savedAt: number;
}

export const DEFAULT_SETUP: ShipsSetup = { seats: DEFAULT_DUEL_SEATS, options: DEFAULT_OPTIONS };

function parseOptions(v: unknown): ShipsOptions | null {
  const o = v as Partial<ShipsOptions> | null;
  if (!o || typeof o !== 'object') return null;
  return {
    size: o.size === 8 ? 8 : 10,
    noTouch: o.noTouch === true,
    extraTurn: o.extraTurn === true,
    reveal: o.reveal === 'open' ? 'open' : 'cover',
  };
}

function isValidState(v: unknown): v is ShipsState {
  const s = v as ShipsState;
  if (!s || typeof s !== 'object' || !s.options || !Array.isArray(s.players) || s.players.length !== 2) return false;
  const size = s.options.size;
  if (size !== 8 && size !== 10) return false;
  if (!['place', 'battle', 'gameover'].includes(s.phase)) return false;
  if (s.current !== 0 && s.current !== 1) return false;
  if (s.phase === 'place' && s.placing !== 0 && s.placing !== 1) return false;
  if (!Array.isArray(s.log) || !Array.isArray(s.events) || typeof s.nextLogId !== 'number' || typeof s.nextEventId !== 'number') return false;
  for (const p of s.players) {
    if (!p || typeof p.name !== 'string' || !DUEL_KIND_OPTIONS.some((o) => o.value === p.kind)) return false;
    if (!Array.isArray(p.marks) || p.marks.length !== size * size || !p.marks.every((m) => m === 0 || m === 1 || m === 2)) return false;
    if (!Array.isArray(p.history) || !p.history.every((c) => Number.isInteger(c) && c >= 0 && c < size * size)) return false;
    if (!Array.isArray(p.fleet)) return false;
    if (p.ready && !isValidFleet(p.fleet, size, s.options.noTouch === true)) return false;
  }
  // 전투 중이면 두 사람 모두 배를 다 놓았어야 한다.
  if (s.phase !== 'place' && !s.players.every((p) => p.ready)) return false;
  return true;
}

export function loadSavedShipsGame(): SavedShipsGame | null {
  const saved = loadJson<SavedShipsGame>(SAVE_KEY);
  if (!saved || typeof saved !== 'object' || !isDuelSeats(saved.setup?.seats) || !isValidState(saved.state)) return null;
  if (saved.state.phase === 'gameover') return null;
  const options = parseOptions(saved.state.options);
  if (!options) return null;
  return { setup: { seats: saved.setup.seats, options }, state: { ...saved.state, options }, savedAt: Number(saved.savedAt) || Date.now() };
}

export function saveShipsGame(setup: ShipsSetup, state: ShipsState): void {
  saveJson(SAVE_KEY, { setup, state, savedAt: Date.now() } satisfies SavedShipsGame);
}

export function clearSavedShipsGame(): void {
  removeKey(SAVE_KEY);
}

export function loadShipsSetup(): ShipsSetup {
  const s = loadJson<ShipsSetup>(SETUP_KEY);
  if (!s || !isDuelSeats(s.seats)) return DEFAULT_SETUP;
  return { seats: s.seats, options: parseOptions(s.options) ?? DEFAULT_OPTIONS };
}

export function saveShipsSetup(setup: ShipsSetup): void {
  saveJson(SETUP_KEY, setup);
}

/**
 * think: 컴퓨터가 조준하는 시간, fly: 포탄이 날아가는 시간,
 * miss/hit/sunk: 떨어진 뒤 연출 시간, pass: 사람 둘일 때 화면을 가리기 전 잠깐 보여 주는 시간, fx: 큰 글씨 알림
 */
export const SHIPS_DELAYS: Record<Speed, { think: number; fly: number; miss: number; hit: number; sunk: number; pass: number; fx: boolean }> = {
  normal: { think: 850, fly: 420, miss: 520, hit: 700, sunk: 1300, pass: 700, fx: true },
  fast: { think: 380, fly: 240, miss: 300, hit: 420, sunk: 760, pass: 450, fx: true },
  turbo: { think: 40, fly: 0, miss: 40, hit: 60, sunk: 120, pass: 250, fx: false },
};
