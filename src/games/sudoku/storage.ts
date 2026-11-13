import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { DIFFICULTIES, puzzleCode } from './generator';
import { CELLS, isValidSolution, parseGrid } from './grid';
import { DEFAULT_PRINT_OPTIONS, clampPages, parsePerPage, type PrintOptions } from './print';
import type { Difficulty, HistoryEntry, MistakeMode, Puzzle, SudokuSetup, SudokuState } from './types';

export const SETTINGS_KEY = 'family-boardgame.sudoku.settings.v1';
const SAVE_KEY = 'family-boardgame.sudoku.save.v1';
const SETUP_KEY = 'family-boardgame.sudoku.setup.v1';
const RECORDS_KEY = 'family-boardgame.sudoku.records.v1';
const PRINT_KEY = 'family-boardgame.sudoku.print.v1';

export const DEFAULT_SETUP: SudokuSetup = { difficulty: 'easy', mistakeMode: 'instant' };

const isDifficulty = (v: unknown): v is Difficulty => DIFFICULTIES.includes(v as Difficulty);
const isMistakeMode = (v: unknown): v is MistakeMode => v === 'instant' || v === 'end';
const isInt = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

function isValidPuzzle(p: unknown): p is Puzzle {
  const z = p as Puzzle;
  if (!z || typeof z !== 'object' || !isDifficulty(z.difficulty) || !isInt(z.seed, 1, 99999)) return false;
  if (typeof z.givens !== 'string' || typeof z.solution !== 'string' || z.givens.length !== CELLS || z.solution.length !== CELLS) return false;
  if (z.id !== puzzleCode(z.difficulty, z.seed)) return false;
  try {
    const g = parseGrid(z.givens);
    const s = parseGrid(z.solution);
    return isValidSolution(s) && g.every((v, i) => v === 0 || v === s[i]);
  } catch {
    return false;
  }
}

function isValidHistory(h: unknown): h is HistoryEntry[] {
  return (
    Array.isArray(h) &&
    h.every(
      (e: HistoryEntry) =>
        e &&
        Array.isArray(e.changes) &&
        e.changes.every((c) => c && isInt(c.i, 0, 80) && isInt(c.v0, 0, 9) && isInt(c.v1, 0, 9) && isInt(c.n0, 0, 511) && isInt(c.n1, 0, 511)),
    )
  );
}

/** 저장된 게임을 꼼꼼히 검사한다. 망가진 저장은 null */
export function validateState(v: unknown): SudokuState | null {
  const s = v as SudokuState;
  if (!s || typeof s !== 'object' || !isValidPuzzle(s.puzzle)) return null;
  if (!Array.isArray(s.values) || s.values.length !== CELLS || !s.values.every((x) => isInt(x, 0, 9))) return null;
  if (!Array.isArray(s.notes) || s.notes.length !== CELLS || !s.notes.every((x) => isInt(x, 0, 511))) return null;
  const givens = parseGrid(s.puzzle.givens);
  if (!givens.every((g, i) => g === 0 || s.values[i] === g)) return null;
  if (!isValidHistory(s.undo) || !isValidHistory(s.redo)) return null;
  if (!isMistakeMode(s.mistakeMode) || (s.status !== 'playing' && s.status !== 'solved')) return null;
  if (!isInt(s.hintsUsed, 0, 1e6) || !isInt(s.mistakes, 0, 1e6) || typeof s.elapsedMs !== 'number' || !(s.elapsedMs >= 0)) return null;
  const hinted = Array.isArray(s.hinted) ? s.hinted.filter((i) => isInt(i, 0, 80)) : [];
  return { ...s, hinted, showWrong: s.showWrong === true, lastHint: null, events: [] };
}

export interface SavedSudokuGame {
  state: SudokuState;
  savedAt: number;
}

export function loadSavedGame(): SavedSudokuGame | null {
  const saved = loadJson<SavedSudokuGame>(SAVE_KEY);
  if (!saved || typeof saved !== 'object') return null;
  const state = validateState(saved.state);
  if (!state || state.status === 'solved') return null;
  return { state, savedAt: typeof saved.savedAt === 'number' ? saved.savedAt : Date.now() };
}

export function saveGame(state: SudokuState): void {
  const { events: _events, lastHint: _hint, ...rest } = state;
  saveJson(SAVE_KEY, { state: { ...rest, events: [], lastHint: null }, savedAt: Date.now() });
}

export function clearSavedGame(): void {
  removeKey(SAVE_KEY);
}

export function loadSetup(): SudokuSetup {
  const s = loadJson<Partial<SudokuSetup>>(SETUP_KEY);
  return {
    difficulty: isDifficulty(s?.difficulty) ? s.difficulty : DEFAULT_SETUP.difficulty,
    mistakeMode: isMistakeMode(s?.mistakeMode) ? s.mistakeMode : DEFAULT_SETUP.mistakeMode,
  };
}

export function saveSetup(setup: SudokuSetup): void {
  saveJson(SETUP_KEY, setup);
}

/** 난이도별 기록: 다 푼 횟수, 힌트 없이 푼 가장 빠른 시간 */
export interface DifficultyRecord {
  solved: number;
  bestMs: number | null;
}
export type SudokuRecords = Record<Difficulty, DifficultyRecord>;

export function emptyRecords(): SudokuRecords {
  return { easy: { solved: 0, bestMs: null }, normal: { solved: 0, bestMs: null }, hard: { solved: 0, bestMs: null }, expert: { solved: 0, bestMs: null } };
}

export function loadRecords(): SudokuRecords {
  const raw = loadJson<Partial<Record<Difficulty, Partial<DifficultyRecord>>>>(RECORDS_KEY);
  const out = emptyRecords();
  if (!raw || typeof raw !== 'object') return out;
  for (const d of DIFFICULTIES) {
    const r = raw[d];
    if (!r || typeof r !== 'object') continue;
    out[d] = {
      solved: isInt(r.solved, 0, 1e7) ? (r.solved as number) : 0,
      bestMs: typeof r.bestMs === 'number' && r.bestMs > 0 ? r.bestMs : null,
    };
  }
  return out;
}

/** 다 푼 결과를 기록에 넣는다. 새 최고 기록이면 true (힌트를 쓰면 최고 기록에는 안 들어감) */
export function recordSolve(records: SudokuRecords, difficulty: Difficulty, ms: number, hints: number): { records: SudokuRecords; newBest: boolean } {
  const r = records[difficulty];
  const newBest = hints === 0 && (r.bestMs === null || ms < r.bestMs);
  const next = { ...records, [difficulty]: { solved: r.solved + 1, bestMs: newBest ? ms : r.bestMs } };
  return { records: next, newBest };
}

export function saveRecords(records: SudokuRecords): void {
  saveJson(RECORDS_KEY, records);
}

export function loadPrintOptions(): PrintOptions {
  const s = loadJson<Partial<PrintOptions>>(PRINT_KEY);
  if (!s || typeof s !== 'object') return DEFAULT_PRINT_OPTIONS;
  return {
    difficulty: s.difficulty === 'mixed' || isDifficulty(s.difficulty) ? s.difficulty : DEFAULT_PRINT_OPTIONS.difficulty,
    perPage: parsePerPage(s.perPage),
    pages: clampPages(Number(s.pages)),
    answers: s.answers !== false,
    header: s.header !== false,
    title: typeof s.title === 'string' ? s.title.slice(0, 40) : DEFAULT_PRINT_OPTIONS.title,
  };
}

export function savePrintOptions(opts: PrintOptions): void {
  saveJson(PRINT_KEY, opts);
}

/** 1:05 / 12:34 / 1:02:03 */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** "3분 20초" 처럼 읽기 쉬운 시간 */
export function formatTimeKo(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return s > 0 ? `${m}분 ${s}초` : `${m}분`;
  return `${s}초`;
}
