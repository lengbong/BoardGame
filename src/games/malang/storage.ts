import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { DEFAULT_DUEL_SEATS, isDuelSeats } from '../common/duel';
import { DEFAULT_OPTIONS } from './engine';
import { H, W } from './types';
import type { MalangOptions, MalangSetup, MalangState } from './types';

const SAVE_KEY = 'family-boardgame.malang.save.v1';
const SETUP_KEY = 'family-boardgame.malang.setup.v1';
const RECORDS_KEY = 'family-boardgame.malang.records.v1';
export const SETTINGS_KEY = 'family-boardgame.malang.settings.v1';

export interface SavedMalangGame {
  setup: MalangSetup;
  state: MalangState;
  savedAt: number;
}

export const DEFAULT_SETUP: MalangSetup = {
  seats: [DEFAULT_DUEL_SEATS[0], { kind: 'ai-easy', name: '' }],
  options: DEFAULT_OPTIONS,
};

export function parseOptions(v: unknown): MalangOptions {
  const o = (v ?? {}) as Partial<MalangOptions>;
  return {
    mode: o.mode === 'solo' ? 'solo' : 'versus',
    colors: o.colors === 5 ? 5 : 4,
    startSpeed: o.startSpeed === 'slow' || o.startSpeed === 'fast' ? o.startSpeed : 'normal',
    ghost: typeof o.ghost === 'boolean' ? o.ghost : DEFAULT_OPTIONS.ghost,
    winsNeeded: o.winsNeeded === 2 ? 2 : 1,
  };
}

function isValidSetup(v: unknown): v is MalangSetup {
  const s = v as MalangSetup;
  return !!s && isDuelSeats(s.seats) && typeof s.options === 'object' && s.options !== null;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const PHASES = ['spawn', 'move', 'settle', 'pop', 'garbage', 'dead'];

function isValidState(v: unknown): v is MalangState {
  const s = v as MalangState;
  if (!s || !Array.isArray(s.players) || s.players.length < 1 || s.players.length > 2) return false;
  if (!['countdown', 'play', 'roundover'].includes(s.phase) || !Array.isArray(s.queue) || !isInt(s.rng)) return false;
  return s.players.every(
    (p) =>
      !!p &&
      Array.isArray(p.grid) &&
      p.grid.length === W * H &&
      p.grid.every((b) => b === null || (isInt(b.id) && isInt(b.c))) &&
      PHASES.includes(p.phase) &&
      isInt(p.queueIndex) &&
      typeof p.name === 'string' &&
      !!p.stats,
  );
}

export function loadSavedMalangGame(): SavedMalangGame | null {
  const saved = loadJson<SavedMalangGame>(SAVE_KEY);
  if (!saved || !isValidSetup(saved.setup) || !isValidState(saved.state)) return null;
  return { ...saved, state: { ...saved.state, options: parseOptions(saved.state.options), events: [] } };
}

export function saveMalangGame(setup: MalangSetup, state: MalangState): void {
  saveJson(SAVE_KEY, { setup, state: { ...state, events: [] }, savedAt: Date.now() } satisfies SavedMalangGame);
}

export function clearSavedMalangGame(): void {
  removeKey(SAVE_KEY);
}

export function loadMalangSetup(): MalangSetup {
  const s = loadJson<MalangSetup>(SETUP_KEY);
  if (!isValidSetup(s)) return DEFAULT_SETUP;
  return { seats: s.seats, options: parseOptions(s.options) };
}

export function saveMalangSetup(setup: MalangSetup): void {
  saveJson(SETUP_KEY, setup);
}

/** 기록: 혼자 하기 최고 점수, 가장 긴 연쇄 (모든 방식), 컴퓨터를 이긴 횟수 */
export interface MalangRecords {
  soloScore: number;
  bestChain: number;
  cpuWins: Record<string, number>;
}

export function loadRecords(): MalangRecords {
  const r = loadJson<Partial<MalangRecords>>(RECORDS_KEY) ?? {};
  return {
    soloScore: isInt(r.soloScore) ? r.soloScore : 0,
    bestChain: isInt(r.bestChain) ? r.bestChain : 0,
    cpuWins: r.cpuWins && typeof r.cpuWins === 'object' ? r.cpuWins : {},
  };
}

export function saveRecords(r: MalangRecords): void {
  saveJson(RECORDS_KEY, r);
}
