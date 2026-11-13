import { loadJson, removeKey, saveJson } from '../../lib/storage';
import type { Speed } from '../common/speed';
import { SET_SIZE } from './dominoes';
import { DEFAULT_OPTIONS, TARGET_SCORES } from './rules';
import type { DominoOptions, DominoSetup, DominoState, Tile } from './types';

const SAVE_KEY = 'family-boardgame.domino.save.v1';
const SETUP_KEY = 'family-boardgame.domino.setup.v1';
export const DOMINO_SETTINGS_KEY = 'family-boardgame.domino.settings.v1';

export interface SavedDominoGame {
  setup: DominoSetup;
  state: DominoState;
  savedAt: number;
}

export const DEFAULT_SETUP: DominoSetup = {
  seats: [
    { kind: 'human', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'empty', name: '' },
  ],
  options: DEFAULT_OPTIONS,
};

const KINDS = ['human', 'ai-easy', 'ai-normal', 'empty'];
const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const isPip = (v: unknown): v is number => isInt(v, 0, 6);

function isTile(v: unknown): v is Tile {
  const t = v as Tile;
  return !!t && isInt(t.id, 0, SET_SIZE - 1) && isPip(t.a) && isPip(t.b) && t.a <= t.b;
}

function cleanOptions(v: unknown): DominoOptions {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<DominoOptions>;
  return {
    blockRule: typeof o.blockRule === 'boolean' ? o.blockRule : DEFAULT_OPTIONS.blockRule,
    winnerStarts: typeof o.winnerStarts === 'boolean' ? o.winnerStarts : DEFAULT_OPTIONS.winnerStarts,
    pipColors: typeof o.pipColors === 'boolean' ? o.pipColors : DEFAULT_OPTIONS.pipColors,
    handView: o.handView === 'open' ? 'open' : 'cover',
    endMode: o.endMode === 'points' ? 'points' : 'single',
    targetScore: TARGET_SCORES.includes(o.targetScore as number) ? (o.targetScore as number) : DEFAULT_OPTIONS.targetScore,
  };
}

function isValidSetup(v: unknown): v is DominoSetup {
  const s = v as DominoSetup;
  return (
    !!s &&
    Array.isArray(s.seats) &&
    s.seats.length === 4 &&
    s.seats.every((seat) => !!seat && KINDS.includes(seat.kind) && typeof seat.name === 'string') &&
    typeof s.options === 'object' &&
    s.options !== null
  );
}

/** 저장된 상태를 꼼꼼히 검사한다. 하나라도 이상하면 버린다. */
export function isValidState(v: unknown): v is DominoState {
  const s = v as DominoState;
  if (!s || typeof s !== 'object') return false;
  if (!Array.isArray(s.players) || s.players.length < 2 || s.players.length > 4) return false;
  const n = s.players.length;
  const playersOk = s.players.every(
    (p) =>
      !!p &&
      isInt(p.seat, 0, 3) &&
      (p.kind === 'human' || p.kind === 'ai-easy' || p.kind === 'ai-normal') &&
      typeof p.name === 'string' &&
      Array.isArray(p.hand) &&
      p.hand.every(isTile) &&
      typeof p.score === 'number' &&
      Array.isArray(p.lacks) &&
      p.lacks.every(isPip),
  );
  if (!playersOk) return false;
  if (!Array.isArray(s.line) || !Array.isArray(s.boneyard) || !s.boneyard.every(isTile)) return false;
  const lineOk = s.line.every((p, i) => {
    if (!p || !isTile(p.tile) || !isPip(p.left) || !isPip(p.right) || !isInt(p.player, 0, n - 1)) return false;
    const fits = (p.left === p.tile.a && p.right === p.tile.b) || (p.left === p.tile.b && p.right === p.tile.a);
    return fits && (i === 0 || s.line[i - 1].right === p.left);
  });
  if (!lineOk) return false;
  if (s.line.length > 0 ? !isInt(s.origin, 0, s.line.length - 1) : s.origin !== 0) return false;
  // 패 28개가 빠짐없이 한 번씩
  const ids = [...s.players.flatMap((p) => p.hand.map((t) => t.id)), ...s.line.map((p) => p.tile.id), ...s.boneyard.map((t) => t.id)];
  if (ids.length !== SET_SIZE || new Set(ids).size !== SET_SIZE) return false;
  return (
    (s.phase === 'play' || s.phase === 'roundover') &&
    isInt(s.current, 0, n - 1) &&
    isInt(s.round, 1, 10_000) &&
    typeof s.turn === 'number' &&
    typeof s.turnDraws === 'number' &&
    isInt(s.starter, 0, n - 1) &&
    (s.lastWinner === null || isInt(s.lastWinner, 0, n - 1)) &&
    (s.phase !== 'roundover' || (!!s.roundResult && Array.isArray(s.roundResult.handPips))) &&
    Array.isArray(s.rankings) &&
    Array.isArray(s.events) &&
    Array.isArray(s.log) &&
    typeof s.nextEventId === 'number' &&
    typeof s.nextLogId === 'number' &&
    typeof s.options === 'object' &&
    s.options !== null
  );
}

export function loadSavedDominoGame(): SavedDominoGame | null {
  const saved = loadJson<SavedDominoGame>(SAVE_KEY);
  if (!saved || !isValidSetup(saved.setup) || !isValidState(saved.state)) return null;
  return {
    setup: { seats: saved.setup.seats, options: cleanOptions(saved.setup.options) },
    state: { ...saved.state, options: cleanOptions(saved.state.options) },
    savedAt: typeof saved.savedAt === 'number' ? saved.savedAt : Date.now(),
  };
}

export function saveDominoGame(setup: DominoSetup, state: DominoState): void {
  saveJson(SAVE_KEY, { setup, state, savedAt: Date.now() } satisfies SavedDominoGame);
}

export function clearSavedDominoGame(): void {
  removeKey(SAVE_KEY);
}

export function loadDominoSetup(): DominoSetup {
  const s = loadJson<DominoSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  return { seats: s.seats, options: cleanOptions(s.options) };
}

export function saveDominoSetup(setup: DominoSetup): void {
  saveJson(SETUP_KEY, setup);
}

/** think: 컴퓨터가 생각하는 시간, drawGap: 연달아 뽑을 때 간격, fly: 패가 날아가는 시간, deal: 나눠 줄 때 한 개 간격 */
export const DOMINO_DELAYS: Record<Speed, { think: number; drawGap: number; fly: number; deal: number; fx: boolean }> = {
  normal: { think: 950, drawGap: 430, fly: 480, deal: 45, fx: true },
  fast: { think: 450, drawGap: 230, fly: 300, deal: 22, fx: true },
  turbo: { think: 60, drawGap: 40, fly: 0, deal: 0, fx: false },
};
