import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { SEAT_KIND_OPTIONS } from '../common/players';
import type { Speed } from '../common/speed';
import { Grid, cellKey } from './board';
import { DEFAULT_OPTIONS, tilesAccountedFor } from './rules';
import { TILES } from './tiles';
import type { VillageOptions, VillageSetup, VillageState } from './types';

const SAVE_KEY = 'family-boardgame.village.save.v1';
const SETUP_KEY = 'family-boardgame.village.setup.v1';
export const VILLAGE_SETTINGS_KEY = 'family-boardgame.village.settings.v1';

export interface SavedVillageGame {
  setup: VillageSetup;
  state: VillageState;
  savedAt: number;
}

export const DEFAULT_SETUP: VillageSetup = {
  seats: [
    { kind: 'human', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'ai-easy', name: '' },
    { kind: 'empty', name: '' },
  ],
  options: DEFAULT_OPTIONS,
};

export function parseOptions(v: unknown): VillageOptions {
  const o = (v ?? {}) as Partial<VillageOptions>;
  return {
    jangseung: o.jangseung !== false,
    flags: o.flags === 4 ? 4 : 6,
    hand: o.hand === 1 ? 1 : 2,
    showSpots: o.showSpots !== false,
  };
}

function isValidSetup(v: unknown): v is VillageSetup {
  const s = v as VillageSetup;
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
const isTile = (v: unknown): v is number => isInt(v) && v >= 0 && v < TILES.length;

/** 저장된 상태를 꼼꼼히 살핀다 (망가진 저장은 버린다) */
export function isValidState(v: unknown): v is VillageState {
  const s = v as VillageState;
  if (!s || typeof s !== 'object' || !Array.isArray(s.players) || s.players.length < 2 || s.players.length > 4) return false;
  const n = s.players.length;
  const options = parseOptions(s.options);
  if (s.phase !== 'place' && s.phase !== 'flag' && s.phase !== 'gameover') return false;
  if (!isInt(s.current) || s.current < 0 || s.current >= n || !isInt(s.turn) || !isInt(s.moves)) return false;
  if (!Array.isArray(s.board) || s.board.length < 1 || !Array.isArray(s.stack) || !Array.isArray(s.discarded) || !Array.isArray(s.log)) return false;
  if (!s.stack.every(isTile) || !s.discarded.every(isTile)) return false;
  const flagsOnBoard = new Array<number>(n).fill(0);
  const seen = new Set<number>();
  for (const p of s.board) {
    if (!p || !isTile(p.t) || !isInt(p.x) || !isInt(p.y) || Math.abs(p.x) > 400 || Math.abs(p.y) > 400 || ![0, 1, 2, 3].includes(p.r)) return false;
    const k = cellKey(p.x, p.y);
    if (seen.has(k)) return false;
    seen.add(k);
    if (p.flag !== null) {
      if (!p.flag || !isInt(p.flag.player) || p.flag.player < 0 || p.flag.player >= n || !isInt(p.flag.seg) || p.flag.seg < 0 || p.flag.seg >= TILES[p.t].segs.length) return false;
      flagsOnBoard[p.flag.player] += 1;
    }
  }
  // 조각은 서로 맞닿아 있고 모서리가 맞아야 한다
  const grid = new Grid([s.board[0]]);
  for (const p of s.board.slice(1)) {
    if (!grid.fits(p.t, p.x, p.y, p.r)) return false;
    grid.add(p);
  }
  const playersOk = s.players.every(
    (p, i) =>
      !!p &&
      typeof p.name === 'string' &&
      ['human', 'ai-easy', 'ai-normal'].includes(p.kind) &&
      isInt(p.seat) &&
      p.seat >= 0 &&
      p.seat < 4 &&
      isInt(p.score) &&
      isInt(p.flags) &&
      p.flags >= 0 &&
      p.flags + flagsOnBoard[i] === options.flags &&
      Array.isArray(p.hand) &&
      p.hand.length <= options.hand &&
      p.hand.every(isTile) &&
      !!p.stats &&
      typeof p.stats === 'object',
  );
  if (!playersOk) return false;
  if (s.phase === 'flag' && (!isInt(s.placed) || s.placed !== s.board.length - 1)) return false;
  return tilesAccountedFor({ ...s, options });
}

export function loadSavedVillageGame(): SavedVillageGame | null {
  const saved = loadJson<SavedVillageGame>(SAVE_KEY);
  if (!saved || !isValidSetup(saved.setup) || !isValidState(saved.state) || saved.state.phase === 'gameover') return null;
  return { ...saved, state: { ...saved.state, options: parseOptions(saved.state.options), events: [] } };
}

export function saveVillageGame(setup: VillageSetup, state: VillageState): void {
  saveJson(SAVE_KEY, { setup, state, savedAt: Date.now() } satisfies SavedVillageGame);
}

export function clearSavedVillageGame(): void {
  removeKey(SAVE_KEY);
}

export function loadVillageSetup(): VillageSetup {
  const s = loadJson<VillageSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  return { seats: s.seats, options: parseOptions(s.options) };
}

export function saveVillageSetup(setup: VillageSetup): void {
  saveJson(SETUP_KEY, setup);
}

/**
 * think: 컴퓨터가 조각을 놓기 전, flagThink: 깃발을 정하기 전, drop: 조각이 내려앉는 연출,
 * camera: 지도를 맞추는 시간, flash: 완성 반짝임, stagger: 완성이 여럿일 때 사이 간격
 */
export const VILLAGE_DELAYS: Record<Speed, { think: number; flagThink: number; drop: number; camera: number; flash: number; stagger: number; fx: boolean }> = {
  normal: { think: 950, flagThink: 600, drop: 380, camera: 520, flash: 1500, stagger: 420, fx: true },
  fast: { think: 450, flagThink: 280, drop: 260, camera: 340, flash: 950, stagger: 260, fx: true },
  turbo: { think: 60, flagThink: 40, drop: 0, camera: 0, flash: 300, stagger: 60, fx: false },
};
