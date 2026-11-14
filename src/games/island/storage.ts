import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { SEAT_KIND_OPTIONS } from '../common/players';
import type { Speed } from '../common/speed';
import { CORNERS, CORNER_COUNT, EDGE_COUNT } from './board';
import { DEFAULT_OPTIONS, RESOURCES, TARGETS, isFairBoard } from './rules';
import type { IslandOptions, IslandSetup, IslandState, Resource, ResourceCount, Terrain } from './types';

const SAVE_KEY = 'family-boardgame.island.save.v1';
const SETUP_KEY = 'family-boardgame.island.setup.v1';
export const ISLAND_SETTINGS_KEY = 'family-boardgame.island.settings.v1';

export interface SavedIslandGame {
  setup: IslandSetup;
  state: IslandState;
  savedAt: number;
}

export const DEFAULT_SETUP: IslandSetup = {
  seats: [
    { kind: 'human', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'empty', name: '' },
  ],
  options: DEFAULT_OPTIONS,
};

export function parseOptions(v: unknown): IslandOptions {
  const o = (v ?? {}) as Partial<IslandOptions>;
  return {
    target: (TARGETS as readonly number[]).includes(o.target as number) ? (o.target as IslandOptions['target']) : DEFAULT_OPTIONS.target,
    market: o.market !== false,
    helper: o.helper !== false,
    harvest: o.harvest === true,
  };
}

function isValidSetup(v: unknown): v is IslandSetup {
  const s = v as IslandSetup;
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
const isIndex = (v: unknown, n: number): v is number => isInt(v) && v >= 0 && v < n;
const TERRAINS: Terrain[] = ['forest', 'rock', 'field', 'shore', 'hill'];
const isRes = (v: unknown): v is Resource => RESOURCES.includes(v as Resource);
const isCount = (r: unknown): r is ResourceCount =>
  !!r && typeof r === 'object' && RESOURCES.every((k) => isInt((r as ResourceCount)[k]) && (r as ResourceCount)[k] >= 0);

function isValidState(v: unknown): v is IslandState {
  const s = v as IslandState;
  if (!s || !Array.isArray(s.players) || s.players.length < 2 || s.players.length > 4) return false;
  const n = s.players.length;
  if (!['setup', 'roll', 'choose', 'main', 'discard'].includes(s.phase)) return false;
  if (!isIndex(s.current, n)) return false;
  const kinds = ['human', 'ai-easy', 'ai-normal'];
  if (!s.players.every((p) => !!p && typeof p.name === 'string' && kinds.includes(p.kind) && isIndex(p.seat, 4) && isCount(p.res) && !!p.stats && typeof p.stats === 'object')) return false;
  if (!Array.isArray(s.terrain) || !s.terrain.every((t) => TERRAINS.includes(t)) || !Array.isArray(s.numbers) || !isFairBoard(s.terrain, s.numbers)) return false;
  if (!Array.isArray(s.buildings) || s.buildings.length !== CORNER_COUNT) return false;
  if (!s.buildings.every((b) => b === null || (!!b && isIndex(b.owner, n) && (b.type === 'house' || b.type === 'hall')))) return false;
  if (!Array.isArray(s.roads) || s.roads.length !== EDGE_COUNT || !s.roads.every((r) => r === null || isIndex(r, n))) return false;
  if (!Array.isArray(s.lighthouses) || s.lighthouses.length !== n) return false;
  const lightOk = s.lighthouses.every((c, p) => {
    if (c === null) return true;
    if (!isIndex(c, CORNER_COUNT)) return false;
    const b = s.buildings[c];
    return !!b && b.owner === p && CORNERS[c].coastal;
  });
  if (!lightOk) return false;
  if (!Array.isArray(s.market) || !s.market.every(isRes) || (s.market.length !== 0 && s.market.length !== 4)) return false;
  if (!Array.isArray(s.setupOrder) || s.setupOrder.length !== 2 * n || !s.setupOrder.every((i) => isIndex(i, n))) return false;
  if (!isInt(s.setupStep) || s.setupStep < 0 || s.setupStep > 2 * n) return false;
  if (s.setupHouse !== null && !isIndex(s.setupHouse, CORNER_COUNT)) return false;
  if (s.dice !== null && !(Array.isArray(s.dice) && s.dice.length === 2 && s.dice.every((d) => isInt(d) && d >= 1 && d <= 6))) return false;
  if ((s.phase === 'main' || s.phase === 'choose') && s.dice === null) return false;
  if (s.chosenDie !== null && s.chosenDie !== 0 && s.chosenDie !== 1) return false;
  if (typeof s.marketUsed !== 'boolean' || !isInt(s.bankTrades) || !isInt(s.discardNeed) || s.discardNeed < 0) return false;
  if (s.flagHolder !== null && !isIndex(s.flagHolder, n)) return false;
  if (!isInt(s.round) || !isInt(s.turn) || !isInt(s.nextEventId) || !isInt(s.nextLogId) || !Array.isArray(s.log)) return false;
  return true;
}

export function loadSavedIslandGame(): SavedIslandGame | null {
  const saved = loadJson<SavedIslandGame>(SAVE_KEY);
  if (!saved || !isValidSetup(saved.setup) || !isValidState(saved.state)) return null;
  return { ...saved, state: { ...saved.state, options: parseOptions(saved.state.options), chosenDie: saved.state.chosenDie ?? null, winner: null, events: [] } };
}

export function saveIslandGame(setup: IslandSetup, state: IslandState): void {
  saveJson(SAVE_KEY, { setup, state, savedAt: Date.now() } satisfies SavedIslandGame);
}

export function clearSavedIslandGame(): void {
  removeKey(SAVE_KEY);
}

export function loadIslandSetup(): IslandSetup {
  const s = loadJson<IslandSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  return { seats: s.seats, options: parseOptions(s.options) };
}

export function saveIslandSetup(setup: IslandSetup): void {
  saveJson(SETUP_KEY, setup);
}

/**
 * think: 컴퓨터가 한 행동을 고르는 시간, dice: 주사위가 구르는 시간, glow: 숫자 칸이 반짝이는 시간,
 * fly: 자원이 날아가는 시간, stagger: 여러 개가 날아갈 때 사이, banner: 차례 알림
 */
export const ISLAND_DELAYS: Record<Speed, { think: number; dice: number; glow: number; fly: number; stagger: number; banner: number; fx: boolean }> = {
  normal: { think: 750, dice: 900, glow: 450, fly: 650, stagger: 60, banner: 1100, fx: true },
  fast: { think: 380, dice: 600, glow: 280, fly: 430, stagger: 40, banner: 800, fx: true },
  turbo: { think: 40, dice: 0, glow: 0, fly: 0, stagger: 0, banner: 0, fx: false },
};
