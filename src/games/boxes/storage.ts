import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { SEAT_KIND_OPTIONS } from '../common/players';
import type { Speed } from '../common/speed';
import { DEFAULT_OPTIONS, boxCount, boxLines, isValidSize, lineCount } from './rules';
import type { BoxesOptions, BoxesSetup, BoxesState } from './types';

const SAVE_KEY = 'family-boardgame.boxes.save.v1';
const SETUP_KEY = 'family-boardgame.boxes.setup.v1';
export const SETTINGS_KEY = 'family-boardgame.boxes.settings.v1';

export interface SavedBoxesGame {
  setup: BoxesSetup;
  state: BoxesState;
  savedAt: number;
}

export const DEFAULT_SETUP: BoxesSetup = {
  seats: [
    { kind: 'human', name: '' },
    { kind: 'ai-normal', name: '' },
    { kind: 'empty', name: '' },
    { kind: 'empty', name: '' },
  ],
  options: DEFAULT_OPTIONS,
};

function isValidOptions(v: unknown): v is BoxesOptions {
  const o = v as BoxesOptions;
  return !!o && typeof o === 'object' && isValidSize(o.size) && typeof o.noExtraTurn === 'boolean' && typeof o.warnings === 'boolean';
}

export function isValidSetup(v: unknown): v is BoxesSetup {
  const s = v as BoxesSetup;
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

/** 저장된 게임이 멀쩡한지 꼼꼼히 본다: 크기, 선·상자 배열, 상자 주인과 네 변, 점수 합 */
export function isValidState(v: unknown): v is BoxesState {
  const s = v as BoxesState;
  if (!s || typeof s !== 'object' || !isValidSize(s.size) || !isValidOptions(s.options) || s.options.size !== s.size) return false;
  if (!Array.isArray(s.players) || s.players.length < 2 || s.players.length > 4) return false;
  const P = s.players.length;
  if (!s.players.every((p) => !!p && isInt(p.seat) && p.seat >= 0 && p.seat <= 3 && ['human', 'ai-easy', 'ai-normal'].includes(p.kind) && typeof p.name === 'string' && isInt(p.score))) {
    return false;
  }
  if (new Set(s.players.map((p) => p.seat)).size !== P) return false;
  const n = s.size;
  if (!Array.isArray(s.lines) || s.lines.length !== lineCount(n) || !s.lines.every((p) => isInt(p) && p >= -1 && p < P)) return false;
  if (!Array.isArray(s.boxes) || s.boxes.length !== boxCount(n) || !s.boxes.every((p) => isInt(p) && p >= -1 && p < P)) return false;
  for (let b = 0; b < s.boxes.length; b++) {
    const full = boxLines(n, b).every((l) => s.lines[l] !== -1);
    if (full !== (s.boxes[b] !== -1)) return false;
  }
  if (!s.players.every((p, i) => p.score === s.boxes.filter((o) => o === i).length)) return false;
  if (!isInt(s.current) || s.current < 0 || s.current >= P || !isInt(s.starter) || s.starter < 0 || s.starter >= P) return false;
  if (s.phase !== 'play' && s.phase !== 'gameover') return false;
  if (!Array.isArray(s.history) || !s.history.every((e) => isInt(e) && e >= 0 && e < s.lines.length)) return false;
  if (!Array.isArray(s.log) || !Array.isArray(s.events) || !Array.isArray(s.rankings) || !Array.isArray(s.ranks)) return false;
  if (!isInt(s.turn) || !isInt(s.nextEventId) || !isInt(s.nextLogId) || typeof s.safeGone !== 'boolean') return false;
  // 아직 진행 중이면 빈 선이 하나는 있어야 한다.
  if (s.phase === 'play' && s.lines.every((p) => p !== -1)) return false;
  return true;
}

export function loadSavedBoxesGame(): SavedBoxesGame | null {
  const saved = loadJson<SavedBoxesGame>(SAVE_KEY);
  if (!saved || !isValidSetup(saved.setup) || !isValidState(saved.state) || saved.state.phase === 'gameover') return null;
  if (typeof saved.savedAt !== 'number') return null;
  return saved;
}

export function saveBoxesGame(setup: BoxesSetup, state: BoxesState): void {
  // 연출용 events는 이어할 때 다시 틀지 않도록 비워서 저장한다.
  saveJson(SAVE_KEY, { setup, state: { ...state, events: [] }, savedAt: Date.now() } satisfies SavedBoxesGame);
}

export function clearSavedBoxesGame(): void {
  removeKey(SAVE_KEY);
}

export function loadBoxesSetup(): BoxesSetup {
  const s = loadJson<BoxesSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  const options = { ...DEFAULT_OPTIONS, ...s.options };
  if (!isValidOptions(options)) return { seats: s.seats, options: DEFAULT_OPTIONS };
  return { seats: s.seats, options };
}

export function saveBoxesSetup(setup: BoxesSetup): void {
  saveJson(SETUP_KEY, setup);
}

/**
 * think: 컴퓨터가 생각하는 시간, chain: 컴퓨터가 상자를 이어서 먹을 때 한 줄 간격,
 * draw: 선이 그려지는 시간, fx: 연출(튀어나오는 글자 등) 켜기
 */
export const BOXES_DELAYS: Record<Speed, { think: number; chain: number; draw: number; fx: boolean }> = {
  normal: { think: 750, chain: 380, draw: 420, fx: true },
  fast: { think: 340, chain: 180, draw: 230, fx: true },
  turbo: { think: 30, chain: 20, draw: 0, fx: false },
};
