import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { SEAT_KIND_OPTIONS } from '../common/players';
import type { Speed } from '../common/speed';
import { DEFAULT_OPTIONS } from './rules';
import { BOARD_SIZES, THEME_IDS, boardDims, pictureInfo } from './themes';
import type { MemoryOptions, MemorySetup, MemoryState } from './types';

const SAVE_KEY = 'family-boardgame.memory.save.v1';
const SETUP_KEY = 'family-boardgame.memory.setup.v1';
export const MEMORY_SETTINGS_KEY = 'family-boardgame.memory.settings.v1';

export interface SavedMemoryGame {
  setup: MemorySetup;
  state: MemoryState;
  savedAt: number;
}

export const DEFAULT_SETUP: MemorySetup = {
  seats: [
    { kind: 'human', name: '' },
    { kind: 'ai-easy', name: '' },
    { kind: 'empty', name: '' },
    { kind: 'empty', name: '' },
  ],
  options: DEFAULT_OPTIONS,
};

function isValidSeats(v: unknown): v is MemorySetup['seats'] {
  return (
    Array.isArray(v) &&
    v.length === 4 &&
    v.every((s) => !!s && typeof s.name === 'string' && SEAT_KIND_OPTIONS.some((o) => o.value === s.kind))
  );
}

function cleanOptions(v: unknown): MemoryOptions {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<MemoryOptions>;
  return {
    size: BOARD_SIZES.some((b) => b.value === o.size) ? o.size! : DEFAULT_OPTIONS.size,
    theme: THEME_IDS.includes(o.theme!) ? o.theme! : DEFAULT_OPTIONS.theme,
    extraTurn: typeof o.extraTurn === 'boolean' ? o.extraTurn : DEFAULT_OPTIONS.extraTurn,
    peek: typeof o.peek === 'boolean' ? o.peek : DEFAULT_OPTIONS.peek,
    showNames: typeof o.showNames === 'boolean' ? o.showNames : DEFAULT_OPTIONS.showNames,
  };
}

/** 저장된 게임이 망가지지 않았는지 꼼꼼히 본다. */
function isValidState(v: unknown): v is MemoryState {
  const s = v as MemoryState;
  if (!s || typeof s !== 'object' || !Array.isArray(s.players) || s.players.length < 2 || s.players.length > 4) return false;
  if (!s.options || !BOARD_SIZES.some((b) => b.value === s.options.size)) return false;
  const { rows, cols } = boardDims(s.options.size);
  if (s.rows !== rows || s.cols !== cols || !Array.isArray(s.cards) || s.cards.length !== rows * cols) return false;
  const n = s.players.length;
  const counts = new Map<string, number>();
  for (let i = 0; i < s.cards.length; i++) {
    const c = s.cards[i];
    if (!c || c.id !== i || typeof c.pic !== 'string' || !pictureInfo(c.pic)) return false;
    if (c.matchedBy !== null && !(Number.isInteger(c.matchedBy) && c.matchedBy >= 0 && c.matchedBy < n)) return false;
    counts.set(c.pic, (counts.get(c.pic) ?? 0) + 1);
  }
  if (![...counts.values()].every((k) => k === 2)) return false;
  if (!s.players.every((p) => p && Array.isArray(p.pairs) && typeof p.name === 'string' && [0, 1, 2, 3].includes(p.seat))) return false;
  if (!['peek', 'play', 'mismatch', 'gameover'].includes(s.phase)) return false;
  if (!Number.isInteger(s.current) || s.current < 0 || s.current >= n) return false;
  if (!Array.isArray(s.faceUp) || s.faceUp.length > 2 || !s.faceUp.every((id) => s.cards[id]?.matchedBy === null)) return false;
  if (s.phase === 'mismatch' && s.faceUp.length !== 2) return false;
  if (!s.seen || typeof s.seen !== 'object' || !Array.isArray(s.log) || !Array.isArray(s.events)) return false;
  return ['reveals', 'turn', 'attempt', 'streak', 'nextEventId', 'nextLogId'].every((k) => Number.isFinite((s as unknown as Record<string, number>)[k]));
}

export function loadSavedMemoryGame(): SavedMemoryGame | null {
  const saved = loadJson<SavedMemoryGame>(SAVE_KEY);
  if (!saved || !saved.setup || !isValidSeats(saved.setup.seats) || !isValidState(saved.state) || saved.state.phase === 'gameover') return null;
  return { ...saved, setup: { seats: saved.setup.seats, options: cleanOptions(saved.setup.options) } };
}

export function saveMemoryGame(setup: MemorySetup, state: MemoryState): void {
  saveJson(SAVE_KEY, { setup, state, savedAt: Date.now() } satisfies SavedMemoryGame);
}

export function clearSavedMemoryGame(): void {
  removeKey(SAVE_KEY);
}

export function loadMemorySetup(): MemorySetup {
  const s = loadJson<MemorySetup>(SETUP_KEY);
  if (!s || !isValidSeats(s.seats)) return DEFAULT_SETUP;
  return { seats: s.seats, options: cleanOptions(s.options) };
}

export function saveMemorySetup(setup: MemorySetup): void {
  saveJson(SETUP_KEY, setup);
}

/**
 * think: 컴퓨터가 한 장 고르는 시간, flip: 카드 뒤집기, hide: 짝이 아닌 두 장을 보여 주는 시간,
 * hold: 짝을 맞힌 두 장을 잠깐 보여 주는 시간, fly: 짝이 내 자리로 날아가는 시간, peek: 처음 보여 주기 배율
 */
export const MEMORY_DELAYS: Record<Speed, { think: number; flip: number; hide: number; hold: number; fly: number; peek: number; fx: boolean }> = {
  normal: { think: 800, flip: 420, hide: 1500, hold: 450, fly: 620, peek: 1, fx: true },
  fast: { think: 420, flip: 300, hide: 950, hold: 260, fly: 460, peek: 0.75, fx: true },
  turbo: { think: 70, flip: 120, hide: 420, hold: 0, fly: 0, peek: 0.4, fx: false },
};

/** 처음에 모두 보여 주는 시간 (밀리초, 속도 배율 전) */
export const PEEK_MS: Record<MemoryOptions['size'], number> = { '4x4': 4000, '4x6': 5500, '6x6': 7000 };
