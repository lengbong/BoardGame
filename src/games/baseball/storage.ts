import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { DEFAULT_DUEL_SEATS, isDuelSeats } from '../common/duel';
import type { Speed } from '../common/speed';
import { DEFAULT_OPTIONS, isValidCode, judge, targetOf } from './rules';
import type { BaseballOptions, BaseballSetup, BaseballState, NoteMark } from './types';

const SAVE_KEY = 'family-boardgame.baseball.save.v1';
const SETUP_KEY = 'family-boardgame.baseball.setup.v1';
const RECORDS_KEY = 'family-boardgame.baseball.records.v1';
export const SETTINGS_KEY = 'family-boardgame.baseball.settings.v1';

export interface SavedBaseballGame {
  setup: BaseballSetup;
  state: BaseballState;
  savedAt: number;
}

export const DEFAULT_SETUP: BaseballSetup = { seats: DEFAULT_DUEL_SEATS, options: DEFAULT_OPTIONS };

export function parseOptions(v: unknown): BaseballOptions {
  const o = (v ?? {}) as Partial<BaseballOptions>;
  return {
    mode: o.mode === 'solo' ? 'solo' : 'duel',
    length: o.length === 4 ? 4 : 3,
    zero: typeof o.zero === 'boolean' ? o.zero : DEFAULT_OPTIONS.zero,
    fairFinish: typeof o.fairFinish === 'boolean' ? o.fairFinish : DEFAULT_OPTIONS.fairFinish,
    helper: typeof o.helper === 'boolean' ? o.helper : DEFAULT_OPTIONS.helper,
  };
}

function isValidSetup(v: unknown): v is BaseballSetup {
  const s = v as BaseballSetup;
  return !!s && isDuelSeats(s.seats) && typeof s.options === 'object' && s.options !== null;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isNote = (v: unknown): v is NoteMark => v === 0 || v === 1 || v === 2;

function isValidState(v: unknown): v is BaseballState {
  const s = v as BaseballState;
  if (!s || !Array.isArray(s.players) || s.players.length !== 2) return false;
  if (s.phase !== 'secret' && s.phase !== 'play') return false;
  if (s.current !== 0 && s.current !== 1) return false;
  if (!Array.isArray(s.log) || !Array.isArray(s.hits) || !isInt(s.nextEventId) || !isInt(s.nextLogId)) return false;
  const options = parseOptions(s.options);
  return s.players.every(
    (p) =>
      !!p &&
      typeof p.name === 'string' &&
      typeof p.kind === 'string' &&
      (p.secret === null || isValidCode(p.secret, options)) &&
      Array.isArray(p.notes) &&
      p.notes.length === 10 &&
      p.notes.every(isNote) &&
      Array.isArray(p.guesses) &&
      p.guesses.every((g) => !!g && isValidCode(g.digits, options)),
  );
}

export function loadSavedBaseballGame(): SavedBaseballGame | null {
  const saved = loadJson<SavedBaseballGame>(SAVE_KEY);
  if (!saved || !isValidSetup(saved.setup) || !isValidState(saved.state)) return null;
  const state: BaseballState = { ...saved.state, options: parseOptions(saved.state.options), events: [] };
  // 결과는 비밀 숫자로 다시 판정한다 (저장이 어긋나도 규칙대로)
  for (const side of [0, 1] as const) {
    const secret = state.players[targetOf(state, side)].secret;
    if (state.players[side].guesses.length > 0 && !secret) return null;
    state.players[side].guesses = state.players[side].guesses.map((g) => ({ digits: g.digits, ...judge(secret ?? [], g.digits) }));
  }
  return { ...saved, state };
}

export function saveBaseballGame(setup: BaseballSetup, state: BaseballState): void {
  saveJson(SAVE_KEY, { setup, state, savedAt: Date.now() } satisfies SavedBaseballGame);
}

export function clearSavedBaseballGame(): void {
  removeKey(SAVE_KEY);
}

export function loadBaseballSetup(): BaseballSetup {
  const s = loadJson<BaseballSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  return { seats: s.seats, options: parseOptions(s.options) };
}

export function saveBaseballSetup(setup: BaseballSetup): void {
  saveJson(SETUP_KEY, setup);
}

/** 혼자 맞히기 최고 기록 (가장 적게 친 횟수): '3-1'(3자리 1~9), '4-0'(4자리 0~9) … */
export type SoloRecords = Record<string, number>;

export function recordKey(options: Pick<BaseballOptions, 'length' | 'zero'>): string {
  return `${options.length}-${options.zero ? 0 : 1}`;
}

export function loadRecords(): SoloRecords {
  const r = loadJson<SoloRecords>(RECORDS_KEY);
  if (!r || typeof r !== 'object') return {};
  const out: SoloRecords = {};
  for (const [k, v] of Object.entries(r)) if (/^[34]-[01]$/.test(k) && isInt(v) && v > 0) out[k] = v;
  return out;
}

/** 기록을 남기고, 최고 기록을 새로 세웠으면 true */
export function saveRecord(options: Pick<BaseballOptions, 'length' | 'zero'>, count: number): boolean {
  const records = loadRecords();
  const key = recordKey(options);
  const best = records[key];
  if (best !== undefined && best <= count) return false;
  saveJson(RECORDS_KEY, { ...records, [key]: count });
  return true;
}

/**
 * think: 컴퓨터가 생각하는 시간, pitch: 공이 날아와 방망이에 맞기까지, lamp: 전광판 불이 하나씩 켜지는 간격,
 * banner: 결과 글자가 떠 있는 시간
 */
export const BASEBALL_DELAYS: Record<Speed, { think: number; pitch: number; lamp: number; banner: number; fx: boolean }> = {
  normal: { think: 1300, pitch: 650, lamp: 230, banner: 1300, fx: true },
  fast: { think: 600, pitch: 380, lamp: 130, banner: 850, fx: true },
  turbo: { think: 80, pitch: 0, lamp: 0, banner: 0, fx: false },
};
