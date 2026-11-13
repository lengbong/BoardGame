import { ALL_DIGITS, CELLS, CELL_UNITS, PEERS, UNITS, bit, bitCount, candidatesAt, findConflicts, isFull, parseGrid } from './grid';
import { TECHNIQUE_INFO, findLogicalStep, unitName } from './logic';
import type { CellChange, HintInfo, MistakeMode, Puzzle, SudokuAction, SudokuEvent, SudokuState } from './types';

/** 되돌리기 기록은 이만큼만 둔다 (저장 크기 제한) */
export const MAX_HISTORY = 300;

export function createGame(puzzle: Puzzle, mistakeMode: MistakeMode = 'instant'): SudokuState {
  return {
    puzzle,
    values: parseGrid(puzzle.givens),
    notes: new Array<number>(CELLS).fill(0),
    undo: [],
    redo: [],
    mistakeMode,
    hintsUsed: 0,
    mistakes: 0,
    hinted: [],
    elapsedMs: 0,
    status: 'playing',
    showWrong: false,
    lastHint: null,
    events: [],
  };
}

const givenCache = new Map<string, boolean[]>();
/** 처음부터 주어진 칸 (고칠 수 없음) */
export function givenMask(puzzle: Puzzle): boolean[] {
  let m = givenCache.get(puzzle.givens);
  if (!m) {
    m = Array.from(puzzle.givens, (ch) => ch >= '1' && ch <= '9');
    givenCache.set(puzzle.givens, m);
  }
  return m;
}

const solutionCache = new Map<string, number[]>();
export function solutionOf(puzzle: Puzzle): number[] {
  let s = solutionCache.get(puzzle.solution);
  if (!s) {
    s = parseGrid(puzzle.solution);
    solutionCache.set(puzzle.solution, s);
  }
  return s;
}

/** 정답과 다른 숫자를 넣은 칸 */
export function wrongCells(state: Pick<SudokuState, 'puzzle' | 'values'>): Set<number> {
  const sol = solutionOf(state.puzzle);
  const out = new Set<number>();
  state.values.forEach((v, i) => {
    if (v && v !== sol[i]) out.add(i);
  });
  return out;
}

/** 같은 줄·열·3×3 칸에 같은 숫자가 겹친 칸 */
export function conflictCells(state: SudokuState): Set<number> {
  return findConflicts(state.values);
}

/** 숫자마다 판에 놓인 개수 (0번은 안 씀) */
export function digitCounts(values: readonly number[]): number[] {
  const counts = new Array<number>(10).fill(0);
  for (const v of values) if (v) counts[v]++;
  return counts;
}

export function emptyCount(state: SudokuState): number {
  return state.values.filter((v) => !v).length;
}

export function isSolved(state: SudokuState): boolean {
  const sol = solutionOf(state.puzzle);
  return state.values.every((v, i) => v === sol[i]);
}

/** 1, 3, 6, 7, 8, 0은 받침이 있다 (일, 삼, 육, 칠, 팔, 영) */
const hasBatchim = (d: number) => [0, 1, 3, 6, 7, 8].includes(d);

export function digitJosa(d: number, josa: '이/가' | '은/는' | '을/를'): string {
  const [withB, withoutB] = josa.split('/');
  return `${d}${hasBatchim(d) ? withB : withoutB}`;
}

/** "7이에요" / "2예요" */
export function digitIs(d: number): string {
  return `${d}${hasBatchim(d) ? '이에요' : '예요'}`;
}

/** 지금 판에서 줄 수 있는 힌트 하나. prefer: 지금 고른 칸 */
export function findHint(state: SudokuState, prefer = -1): HintInfo | null {
  const sol = solutionOf(state.puzzle);
  const given = givenMask(state.puzzle);
  // 1) 틀린 숫자가 있으면 먼저 고쳐 준다.
  const wrong = [...wrongCells(state)];
  if (wrong.length > 0) {
    const cell = wrong.includes(prefer) ? prefer : wrong[0];
    return {
      cell,
      digit: sol[cell],
      kind: 'fix',
      unit: null,
      message: `여기 넣은 ${digitJosa(state.values[cell], '은/는')} 맞지 않아요. 이 칸은 ${digitIs(sol[cell])}.`,
    };
  }
  const empties = state.values.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (empties.length === 0) return null;
  const preferEmpty = prefer >= 0 && !state.values[prefer] && !given[prefer] ? prefer : -1;
  // 2) 사람의 방법으로 찾을 수 있는 칸
  const step = findLogicalStep(state.values, preferEmpty);
  if (step && step.digit === sol[step.cell]) {
    const d = step.digit;
    const finding =
      step.technique === 'nakedSingle'
        ? `이 칸에는 ${d}만 들어갈 수 있어요.`
        : `이 ${unitName(step.unit!)}에서 ${digitJosa(d, '이/가')} 들어갈 수 있는 곳은 여기뿐이에요.`;
    if (step.via.length === 0) {
      return {
        cell: step.cell,
        digit: d,
        kind: step.technique === 'nakedSingle' ? 'single' : 'hidden',
        unit: step.technique === 'hiddenSingle' ? step.unit! : null,
        message:
          step.technique === 'nakedSingle'
            ? `${finding} 같은 가로줄·세로줄·3×3 칸에 나머지 숫자가 모두 있어요.`
            : finding,
      };
    }
    const names = step.via
      .slice(0, 2)
      .map((t) => `‘${TECHNIQUE_INFO[t].name}’`)
      .join(', ');
    return {
      cell: step.cell,
      digit: d,
      kind: 'advanced',
      unit: step.technique === 'hiddenSingle' ? step.unit! : null,
      message: `${names} 방법으로 후보를 줄이면, ${finding}`,
    };
  }
  // 3) 그냥 알려 준다: 고른 칸, 아니면 후보가 가장 적은 칸
  let cell = preferEmpty;
  if (cell < 0) {
    let best = 10;
    for (const i of empties) {
      const n = bitCount(candidatesAt(state.values, i));
      if (n < best) {
        best = n;
        cell = i;
      }
    }
  }
  const d = sol[cell];
  return {
    cell,
    digit: d,
    kind: 'reveal',
    unit: null,
    message: `이 칸은 ${digitIs(d)}. 지금은 쉬운 방법으로 찾을 수 있는 칸이 없어서 정답을 알려 줬어요.`,
  };
}

/** 칸 변경 목록을 판에 적용한 새 values/notes */
function applyChanges(values: number[], notes: number[], changes: CellChange[], forward: boolean): { values: number[]; notes: number[] } {
  const v = [...values];
  const n = [...notes];
  for (const c of changes) {
    v[c.i] = forward ? c.v1 : c.v0;
    n[c.i] = forward ? c.n1 : c.n0;
  }
  return { values: v, notes: n };
}

/** 칸에 숫자를 놓을 때의 변경: 그 칸의 메모를 지우고, 같은 줄·열·칸 메모에서 그 숫자를 지운다. */
function placementChanges(state: SudokuState, cell: number, digit: number): CellChange[] {
  const changes: CellChange[] = [{ i: cell, v0: state.values[cell], n0: state.notes[cell], v1: digit, n1: 0 }];
  const b = bit(digit);
  for (const p of PEERS[cell]) {
    const n = state.notes[p];
    if (n & b) changes.push({ i: p, v0: state.values[p], n0: n, v1: state.values[p], n1: n & ~b });
  }
  return changes;
}

/** 변경 후 상태를 만들고 완성·확인 여부를 따진다. */
function commit(state: SudokuState, changes: CellChange[], events: SudokuEvent[], extra: Partial<SudokuState> = {}): SudokuState {
  const { values, notes } = applyChanges(state.values, state.notes, changes, true);
  const undo = [...state.undo, { changes }];
  if (undo.length > MAX_HISTORY) undo.splice(0, undo.length - MAX_HISTORY);
  const next: SudokuState = { ...state, ...extra, values, notes, undo, redo: [], events };
  return settle(state, next);
}

/** 판이 바뀐 뒤 공통 처리: 다 채운 묶음, 완성, 다 채운 뒤 확인 */
function settle(before: SudokuState, next: SudokuState): SudokuState {
  const events = [...next.events];
  const changed = new Set<number>();
  for (let i = 0; i < CELLS; i++) if (before.values[i] !== next.values[i]) changed.add(i);
  // 새로 다 채운 묶음 (규칙에 맞게 1~9가 다 있는지만 본다: 정답 여부는 알려 주지 않음)
  const done: number[] = [];
  const checked = new Set<number>();
  for (const i of changed) {
    if (!next.values[i]) continue;
    for (const u of CELL_UNITS[i]) {
      if (checked.has(u)) continue;
      checked.add(u);
      const mask = UNITS[u].reduce((m, j) => m | (next.values[j] ? bit(next.values[j]) : 0), 0);
      if (mask === ALL_DIGITS && UNITS[u].every((j) => next.values[j])) done.push(u);
    }
  }
  if (done.length > 0) events.push({ type: 'unitDone', units: done });

  let status = next.status;
  let showWrong = next.showWrong;
  const wrong = wrongCells(next).size;
  if (isFull(next.values) && wrong === 0) {
    status = 'solved';
    showWrong = false;
    events.push({ type: 'complete' });
  } else if (next.mistakeMode === 'end') {
    if (isFull(next.values) && changed.size > 0) {
      showWrong = true;
      events.push({ type: 'checkFailed', wrong });
    } else if (wrong === 0) showWrong = false;
  } else showWrong = false;
  return { ...next, status, showWrong, events };
}

export function applyAction(state: SudokuState, action: SudokuAction): SudokuState {
  if (action.type === 'tick') {
    if (state.status !== 'playing' || action.ms <= 0) return state;
    return { ...state, elapsedMs: state.elapsedMs + action.ms, events: [] };
  }
  if (action.type === 'setMistakeMode') {
    return { ...state, mistakeMode: action.mode, showWrong: false, events: [] };
  }
  if (state.status === 'solved') return { ...state, events: [{ type: 'blocked', reason: 'solved' }] };
  const given = givenMask(state.puzzle);

  switch (action.type) {
    case 'place': {
      const { cell, digit } = action;
      if (cell < 0 || cell >= CELLS || digit < 1 || digit > 9) return state;
      if (given[cell]) return { ...state, events: [{ type: 'blocked', reason: 'given' }] };
      if (state.values[cell] === digit) return { ...state, events: [] };
      const sol = solutionOf(state.puzzle);
      const wrong = digit !== sol[cell];
      const conflict = PEERS[cell].some((p) => state.values[p] === digit);
      return commit(state, placementChanges(state, cell, digit), [{ type: 'place', cell, digit, wrong, conflict }], {
        mistakes: state.mistakes + (wrong ? 1 : 0),
        lastHint: null,
      });
    }
    case 'note': {
      const { cell, digit } = action;
      if (cell < 0 || cell >= CELLS || digit < 1 || digit > 9) return state;
      if (given[cell]) return { ...state, events: [{ type: 'blocked', reason: 'given' }] };
      if (state.values[cell]) return { ...state, events: [{ type: 'blocked', reason: 'filled' }] };
      const n0 = state.notes[cell];
      const n1 = n0 ^ bit(digit);
      return commit(state, [{ i: cell, v0: 0, n0, v1: 0, n1 }], [{ type: 'note', cell, digit, on: (n1 & bit(digit)) !== 0 }]);
    }
    case 'erase': {
      const { cell } = action;
      if (cell < 0 || cell >= CELLS) return state;
      if (given[cell]) return { ...state, events: [{ type: 'blocked', reason: 'given' }] };
      const v0 = state.values[cell];
      const n0 = state.notes[cell];
      if (!v0 && !n0) return { ...state, events: [] };
      const change: CellChange = v0 ? { i: cell, v0, n0, v1: 0, n1: n0 } : { i: cell, v0, n0, v1: 0, n1: 0 };
      return commit(state, [change], [{ type: 'erase', cell }]);
    }
    case 'fillNotes': {
      const changes: CellChange[] = [];
      state.values.forEach((v, i) => {
        if (v) return;
        const n1 = candidatesAt(state.values, i);
        if (n1 !== state.notes[i]) changes.push({ i, v0: 0, n0: state.notes[i], v1: 0, n1 });
      });
      if (changes.length === 0) return { ...state, events: [] };
      return commit(state, changes, [{ type: 'fillNotes', count: changes.length }]);
    }
    case 'clearNotes': {
      const changes: CellChange[] = [];
      state.notes.forEach((n, i) => {
        if (n) changes.push({ i, v0: state.values[i], n0: n, v1: state.values[i], n1: 0 });
      });
      if (changes.length === 0) return { ...state, events: [] };
      return commit(state, changes, []);
    }
    case 'hint': {
      const hint = findHint(state, action.cell ?? -1);
      if (!hint) return { ...state, events: [] };
      return commit(state, placementChanges(state, hint.cell, hint.digit), [{ type: 'hint', hint }], {
        hintsUsed: state.hintsUsed + 1,
        hinted: state.hinted.includes(hint.cell) ? state.hinted : [...state.hinted, hint.cell],
        lastHint: hint,
      });
    }
    case 'undo': {
      const entry = state.undo[state.undo.length - 1];
      if (!entry) return { ...state, events: [] };
      const { values, notes } = applyChanges(state.values, state.notes, entry.changes, false);
      const next: SudokuState = {
        ...state,
        values,
        notes,
        undo: state.undo.slice(0, -1),
        redo: [...state.redo, entry],
        lastHint: null,
        events: [{ type: 'undo' }],
      };
      return settle(state, next);
    }
    case 'redo': {
      const entry = state.redo[state.redo.length - 1];
      if (!entry) return { ...state, events: [] };
      const { values, notes } = applyChanges(state.values, state.notes, entry.changes, true);
      const next: SudokuState = {
        ...state,
        values,
        notes,
        undo: [...state.undo, entry],
        redo: state.redo.slice(0, -1),
        lastHint: null,
        events: [{ type: 'redo' }],
      };
      return settle(state, next);
    }
    case 'reset': {
      const start = parseGrid(state.puzzle.givens);
      const changes: CellChange[] = [];
      for (let i = 0; i < CELLS; i++) {
        if (state.values[i] !== start[i] || state.notes[i]) changes.push({ i, v0: state.values[i], n0: state.notes[i], v1: start[i], n1: 0 });
      }
      if (changes.length === 0) return { ...state, events: [] };
      return commit(state, changes, [{ type: 'reset' }], { lastHint: null });
    }
  }
}
