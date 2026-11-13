import { withJosa } from '../../lib/korean';
import type { BoardSize, Cell, Forbidden, GameEvent, OmokAction, OmokOptions, OmokSetup, OmokState, RuleSet, Stone } from './types';

export const SIDE_LABELS: [string, string] = ['흑', '백'];

export const DEFAULT_OPTIONS: OmokOptions = { size: 15, rule: 'no33', hints: false, undo: true, numbers: false };

export const RULE_NAMES: Record<RuleSet, string> = { free: '자유', no33: '쌍삼 금지', renju: '렌주' };

export const FORBIDDEN_TEXT: Record<Forbidden, string> = {
  '33': '쌍삼(열린 삼 두 개)이라서 둘 수 없어요',
  '44': '쌍사(사 두 개)라서 둘 수 없어요',
  overline: '여섯 개 이상(장목)이 되어서 둘 수 없어요',
};

const MAX_LOG = 80;

/** 네 방향: 가로, 세로, ↘, ↙ */
export const DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

type EventInput = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'id'> : never) : never;

export function other(side: Stone): Stone {
  return side === 0 ? 1 : 0;
}

export function playerName(state: Pick<OmokState, 'players'>, side: Stone): string {
  return state.players[side].name.trim() || SIDE_LABELS[side];
}

/** 칸 번호 → "H8" (열은 왼쪽부터 A, 줄은 아래부터 1) */
export function coordName(index: number, size: number): string {
  const r = Math.floor(index / size);
  const c = index % size;
  return `${String.fromCharCode(65 + c)}${size - r}`;
}

/** 화점(판의 작은 점) 자리 */
export function starPoints(size: BoardSize): number[] {
  const k = size === 15 ? [3, 7, 11] : [3, 6, 9];
  const pts = [k[0], k[2]].flatMap((r) => [k[0], k[2]].map((c) => r * size + c));
  return [...pts, k[1] * size + k[1]];
}

/** 렌주 규칙의 흑은 정확히 다섯이어야 이긴다 */
export function exactFive(rule: RuleSet, side: Stone): boolean {
  return rule === 'renju' && side === 0;
}

function inside(size: number, r: number, c: number): boolean {
  return r >= 0 && r < size && c >= 0 && c < size;
}

/** index에 있는 side 돌에서 (dr, dc) 방향 양쪽으로 이어진 돌 수 */
export function runLength(board: readonly Cell[], size: number, index: number, dr: number, dc: number, side: Stone): number {
  const r0 = Math.floor(index / size);
  const c0 = index % size;
  let n = 1;
  for (const s of [1, -1]) {
    let r = r0 + dr * s;
    let c = c0 + dc * s;
    while (inside(size, r, c) && board[r * size + c] === side) {
      n += 1;
      r += dr * s;
      c += dc * s;
    }
  }
  return n;
}

/** index에 있는 side 돌을 지나는 (dr, dc) 방향 줄의 칸들 */
function runCells(board: readonly Cell[], size: number, index: number, dr: number, dc: number, side: Stone): number[] {
  const r0 = Math.floor(index / size);
  const c0 = index % size;
  const cells = [index];
  for (const s of [1, -1]) {
    let r = r0 + dr * s;
    let c = c0 + dc * s;
    while (inside(size, r, c) && board[r * size + c] === side) {
      cells.push(r * size + c);
      r += dr * s;
      c += dc * s;
    }
  }
  return cells.sort((a, b) => a - b);
}

/**
 * index에 side 돌이 있을 때, 그 방향에서 한 수만 더 두면 index를 지나는 다섯(exact면 정확히 다섯)이 되는 빈칸들.
 * 2개 이상이면 막을 수 없는 열린 사, 1개면 사.
 */
export function fiveSpots(board: Cell[], size: number, index: number, dr: number, dc: number, side: Stone, exact: boolean): number[] {
  const r0 = Math.floor(index / size);
  const c0 = index % size;
  const out: number[] = [];
  for (let k = -4; k <= 4; k++) {
    if (k === 0) continue;
    const r = r0 + dr * k;
    const c = c0 + dc * k;
    if (!inside(size, r, c)) continue;
    const p = r * size + c;
    if (board[p] !== -1) continue;
    board[p] = side;
    const n = runLength(board, size, index, dr, dc, side);
    board[p] = -1;
    if (exact ? n === 5 : n >= 5) out.push(p);
  }
  return out;
}

/** 한 방향의 모양 (index에 side 돌이 놓였다고 보고) */
export interface DirShape {
  run: number;
  five: boolean;
  /** 한 수로 다섯이 되는 빈칸 수 (2 이상 = 열린 사) */
  spots: number;
  /** 한 수로 열린 사가 되는 빈칸이 있다 (열린 삼) */
  openThree: boolean;
  /** 한 수로 사가 되는 빈칸이 있다 (닫힌 삼) */
  closedThree: boolean;
  /** index를 지나는 다섯 칸 창 중 상대 돌·벽이 없고 내 돌이 2개인 창 수 */
  twoWindows: number;
}

export function dirShape(board: Cell[], size: number, index: number, dr: number, dc: number, side: Stone, exact: boolean): DirShape {
  const run = runLength(board, size, index, dr, dc, side);
  const five = exact ? run === 5 : run >= 5;
  const shape: DirShape = { run, five, spots: 0, openThree: false, closedThree: false, twoWindows: 0 };
  if (five) return shape;
  shape.spots = fiveSpots(board, size, index, dr, dc, side, exact).length;
  const r0 = Math.floor(index / size);
  const c0 = index % size;
  if (shape.spots === 0) {
    for (let k = -4; k <= 4 && !shape.openThree; k++) {
      if (k === 0) continue;
      const r = r0 + dr * k;
      const c = c0 + dc * k;
      if (!inside(size, r, c)) continue;
      const p = r * size + c;
      if (board[p] !== -1) continue;
      board[p] = side;
      const n = fiveSpots(board, size, index, dr, dc, side, exact).length;
      board[p] = -1;
      if (n >= 2) shape.openThree = true;
      else if (n === 1) shape.closedThree = true;
    }
  }
  // 둘: 다섯 칸 창 안에 내 돌 2개, 나머지는 빈칸
  const opp = other(side);
  for (let start = -4; start <= 0; start++) {
    let mine = 0;
    let ok = true;
    for (let k = start; k < start + 5; k++) {
      const r = r0 + dr * k;
      const c = c0 + dc * k;
      if (!inside(size, r, c) || board[r * size + c] === opp) {
        ok = false;
        break;
      }
      if (board[r * size + c] === side) mine += 1;
    }
    if (ok && mine === 2) shape.twoWindows += 1;
  }
  return shape;
}

/** side가 index에 두면 다섯이 되는지 (그 칸은 비어 있어야 한다) */
export function makesFive(board: Cell[], size: number, index: number, side: Stone, rule: RuleSet): boolean {
  if (board[index] !== -1) return false;
  const exact = exactFive(rule, side);
  board[index] = side;
  const ok = DIRS.some(([dr, dc]) => {
    const n = runLength(board, size, index, dr, dc, side);
    return exact ? n === 5 : n >= 5;
  });
  board[index] = -1;
  return ok;
}

/**
 * 금수: side가 index에 두면 규칙에 어긋나는지. 다섯이 되는 수는 언제나 둘 수 있다.
 * - 쌍삼 금지: 흑백 모두 열린 삼 두 개를 한 번에 만들 수 없다
 * - 렌주: 흑만 쌍삼·쌍사·장목(여섯 이상) 금지
 */
export function forbiddenAt(board: Cell[], size: number, index: number, side: Stone, rule: RuleSet): Forbidden | null {
  if (board[index] !== -1 || rule === 'free' || (rule === 'renju' && side === 1)) return null;
  const exact = exactFive(rule, side);
  board[index] = side;
  let five = false;
  let overline = false;
  let fours = 0;
  let threes = 0;
  for (const [dr, dc] of DIRS) {
    const s = dirShape(board, size, index, dr, dc, side, exact);
    if (s.five) five = true;
    if (s.run >= 6) overline = true;
    if (s.spots >= 1) fours += 1;
    else if (s.openThree) threes += 1;
  }
  board[index] = -1;
  if (five) return null;
  if (rule === 'renju') {
    if (overline) return 'overline';
    if (fours >= 2) return '44';
  }
  return threes >= 2 ? '33' : null;
}

/** 지금 놓인 돌 index가 이긴 줄을 만들었으면 그 칸들 */
export function winLineAt(board: readonly Cell[], size: number, index: number, rule: RuleSet): number[] | null {
  const side = board[index];
  if (side === -1) return null;
  const exact = exactFive(rule, side);
  for (const [dr, dc] of DIRS) {
    const n = runLength(board, size, index, dr, dc, side);
    if (exact ? n === 5 : n >= 5) return runCells(board, size, index, dr, dc, side);
  }
  return null;
}

/** 돌 근처(두 칸 안)의 빈칸들. 판이 비었으면 가운데 */
export function nearbyEmpty(board: readonly Cell[], size: number, radius = 2): number[] {
  const out: number[] = [];
  let any = false;
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== -1) {
      any = true;
      continue;
    }
    const r = Math.floor(i / size);
    const c = i % size;
    let near = false;
    for (let dr = -radius; dr <= radius && !near; dr++) {
      for (let dc = -radius; dc <= radius && !near; dc++) {
        if ((dr || dc) && inside(size, r + dr, c + dc) && board[(r + dr) * size + c + dc] !== -1) near = true;
      }
    }
    if (near) out.push(i);
  }
  if (!any) out.push(Math.floor(size / 2) * size + Math.floor(size / 2));
  return out;
}

/** 수 알려 주기: side가 바로 이기는 곳, 꼭 막아야 할 곳(상대가 바로 이기는 곳), 조심할 곳(상대가 열린 사를 만드는 곳) */
export function hintSpots(board: Cell[], size: number, side: Stone, rule: RuleSet): { win: number[]; block: number[]; watch: number[] } {
  const opp = other(side);
  const win: number[] = [];
  const block: number[] = [];
  const watch: number[] = [];
  for (const i of nearbyEmpty(board, size, 1)) {
    if (makesFive(board, size, i, side, rule) && !forbiddenAt(board, size, i, side, rule)) win.push(i);
    else if (makesFive(board, size, i, opp, rule) && !forbiddenAt(board, size, i, opp, rule)) block.push(i);
  }
  if (win.length === 0 && block.length === 0) {
    const exact = exactFive(rule, opp);
    for (const i of nearbyEmpty(board, size, 1)) {
      if (forbiddenAt(board, size, i, opp, rule)) continue;
      board[i] = opp;
      const open4 = DIRS.some(([dr, dc]) => fiveSpots(board, size, i, dr, dc, opp, exact).length >= 2);
      board[i] = -1;
      if (open4) watch.push(i);
    }
  }
  return { win, block, watch };
}

function addLog(s: OmokState, side: Stone | null, text: string): void {
  s.log = [...s.log, { id: s.nextLogId, side, text }].slice(-MAX_LOG);
  s.nextLogId += 1;
}

function emit(s: OmokState, event: EventInput): void {
  s.events.push({ ...event, id: s.nextEventId } as GameEvent);
  s.nextEventId += 1;
}

export function createGame(setup: OmokSetup): OmokState {
  const options: OmokOptions = { ...DEFAULT_OPTIONS, ...setup.options };
  const size = options.size;
  const s: OmokState = {
    size,
    board: Array.from({ length: size * size }, () => -1 as Cell),
    players: [
      { kind: setup.seats[0].kind, name: setup.seats[0].name },
      { kind: setup.seats[1].kind, name: setup.seats[1].name },
    ],
    options,
    current: 0,
    phase: 'play',
    turn: 0,
    lastMove: null,
    winner: null,
    winLine: null,
    moves: [],
    events: [],
    nextEventId: 1,
    log: [],
    nextLogId: 1,
  };
  addLog(s, null, `${RULE_NAMES[options.rule]} 규칙 · ${withJosa(playerName(s, 0), '이/가')} 흑으로 먼저 둬요.`);
  return s;
}

export function applyAction(state: OmokState, action: OmokAction): OmokState {
  if (state.phase !== 'play' || action.type !== 'place') return state;
  const i = action.index;
  if (!Number.isInteger(i) || i < 0 || i >= state.board.length || state.board[i] !== -1) return state;
  const board = [...state.board];
  if (forbiddenAt(board, state.size, i, state.current, state.options.rule)) return state;

  const s: OmokState = { ...state, board, moves: [...state.moves, i], events: [] };
  const me = state.current;
  board[i] = me;
  s.lastMove = i;
  s.turn = state.turn + 1;
  emit(s, { type: 'place', player: me, index: i });
  addLog(s, me, `${s.moves.length}. ${playerName(s, me)} ${coordName(i, s.size)}`);

  const line = winLineAt(board, s.size, i, s.options.rule);
  if (line) {
    s.phase = 'gameover';
    s.winner = me;
    s.winLine = line;
    emit(s, { type: 'win', player: me, line });
    addLog(s, me, `🏆 다섯 줄 완성! ${withJosa(playerName(s, me), '이/가')} 이겼어요.`);
  } else if (board.every((c) => c !== -1)) {
    s.phase = 'gameover';
    s.winner = null;
    emit(s, { type: 'draw' });
    addLog(s, null, '판이 꽉 찼어요. 비겼어요!');
  } else {
    s.current = other(me);
  }
  return s;
}

/** 처음부터 moves의 앞 count개를 다시 둔 상태 */
export function replay(state: OmokState, count: number): OmokState {
  let s = createGame({ seats: [state.players[0], state.players[1]], options: state.options });
  for (const m of state.moves.slice(0, count)) {
    const next = applyAction(s, { type: 'place', index: m });
    if (next === s) break;
    s = next;
  }
  return s;
}

/** 무르기로 돌아갈 수: 사람이 마지막으로 둔 수 바로 앞 (없으면 -1) */
function undoPoint(state: OmokState): number {
  for (let k = state.moves.length - 1; k >= 0; k--) {
    if (state.players[k % 2].kind === 'human') return k;
  }
  return -1;
}

export function canUndo(state: OmokState): boolean {
  return state.options.undo && undoPoint(state) >= 0;
}

/** 사람이 마지막으로 둔 수(그 뒤 컴퓨터가 둔 수까지)를 되돌린다 */
export function undo(state: OmokState): OmokState {
  const k = undoPoint(state);
  if (k < 0) return state;
  const s = replay(state, k);
  s.nextEventId = state.nextEventId;
  s.log = state.log;
  s.nextLogId = state.nextLogId;
  s.events = [];
  emit(s, { type: 'undo' });
  addLog(s, s.current, `${playerName(s, s.current)}: 무르기`);
  return s;
}
