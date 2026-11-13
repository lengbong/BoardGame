import { withJosa } from '../../lib/korean';
import type { Cell, FourLineAction, FourLineOptions, FourLineSetup, FourLineState, GameEvent, Side } from './types';

export const COLS = 7;
export const ROWS = 6;
export const CELLS = COLS * ROWS;

export const SIDE_LABELS: [string, string] = ['빨강', '노랑'];

export const DEFAULT_OPTIONS: FourLineOptions = { hints: false, undo: true };

const MAX_LOG = 60;

/** 네 방향 [줄, 열]: 가로, 세로, 대각선 두 개 */
export const LINE_DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

type EventInput = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'id'> : never) : never;

export function other(side: Side): Side {
  return side === 0 ? 1 : 0;
}

export function playerName(state: Pick<FourLineState, 'players'>, side: Side): string {
  return state.players[side].name.trim() || SIDE_LABELS[side];
}

/** 칸 번호 → "D3" (열은 왼쪽부터 A, 행은 아래에서부터 1) */
export function coordName(index: number): string {
  const r = Math.floor(index / COLS);
  const c = index % COLS;
  return `${String.fromCharCode(65 + c)}${ROWS - r}`;
}

export function emptyBoard(): Cell[] {
  return Array.from({ length: CELLS }, () => -1);
}

/** 열에 떨어뜨리면 멈추는 줄 (꽉 찼으면 -1) */
export function landingRow(board: readonly Cell[], col: number): number {
  if (col < 0 || col >= COLS) return -1;
  for (let r = ROWS - 1; r >= 0; r--) if (board[r * COLS + col] === -1) return r;
  return -1;
}

export function legalColumns(board: readonly Cell[]): number[] {
  const out: number[] = [];
  for (let c = 0; c < COLS; c++) if (board[c] === -1) out.push(c);
  return out;
}

/** index의 돌을 지나 넷 이상 이어진 줄의 칸들 (없으면 빈 배열). 여러 방향이면 모두 합친다 */
export function winningLine(board: readonly Cell[], index: number): number[] {
  const side = board[index];
  if (side === -1) return [];
  const r0 = Math.floor(index / COLS);
  const c0 = index % COLS;
  const found = new Set<number>();
  for (const [dr, dc] of LINE_DIRECTIONS) {
    const line = [index];
    for (const sign of [1, -1]) {
      let r = r0 + dr * sign;
      let c = c0 + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r * COLS + c] === side) {
        line.push(r * COLS + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (line.length >= 4) line.forEach((i) => found.add(i));
  }
  return [...found].sort((a, b) => a - b);
}

/** index를 지나는 넷 이상 줄마다 양 끝 칸 [시작, 끝] (이긴 줄에 선을 긋는 데 쓴다) */
export function winSegments(board: readonly Cell[], index: number): [number, number][] {
  const side = board[index];
  if (side === -1) return [];
  const r0 = Math.floor(index / COLS);
  const c0 = index % COLS;
  const out: [number, number][] = [];
  for (const [dr, dc] of LINE_DIRECTIONS) {
    const ends: number[] = [];
    let length = 1;
    for (const sign of [1, -1]) {
      let r = r0;
      let c = c0;
      while (true) {
        const nr = r + dr * sign;
        const nc = c + dc * sign;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr * COLS + nc] !== side) break;
        r = nr;
        c = nc;
        length++;
      }
      ends.push(r * COLS + c);
    }
    if (length >= 4) out.push([ends[1], ends[0]]);
  }
  return out;
}

/** side가 지금 떨어뜨리면 바로 이기는 열들 */
export function winningColumns(board: readonly Cell[], side: Side): number[] {
  const out: number[] = [];
  const b = [...board];
  for (const c of legalColumns(board)) {
    const r = landingRow(b, c);
    b[r * COLS + c] = side;
    if (winningLine(b, r * COLS + c).length > 0) out.push(c);
    b[r * COLS + c] = -1;
  }
  return out;
}

function addLog(s: FourLineState, side: Side | null, text: string): void {
  s.log = [...s.log, { id: s.nextLogId, side, text }].slice(-MAX_LOG);
  s.nextLogId += 1;
}

function emit(s: FourLineState, event: EventInput): void {
  s.events.push({ ...event, id: s.nextEventId } as GameEvent);
  s.nextEventId += 1;
}

export function createGame(setup: FourLineSetup): FourLineState {
  const s: FourLineState = {
    board: emptyBoard(),
    players: [
      { kind: setup.seats[0].kind, name: setup.seats[0].name.trim() },
      { kind: setup.seats[1].kind, name: setup.seats[1].name.trim() },
    ],
    options: { ...setup.options },
    current: 0,
    phase: 'play',
    turn: 1,
    lastMove: null,
    winner: null,
    winLine: null,
    moves: [],
    events: [],
    nextEventId: 1,
    log: [],
    nextLogId: 1,
  };
  addLog(s, null, s.players[0].name ? `${s.players[0].name}(빨강)부터 시작해요.` : '빨강부터 시작해요.');
  return s;
}

export function applyAction(state: FourLineState, action: FourLineAction): FourLineState {
  if (state.phase !== 'play' || action.type !== 'drop') return state;
  const col = action.col;
  const row = landingRow(state.board, col);
  if (row < 0) return state;

  const me = state.current;
  const index = row * COLS + col;
  const s: FourLineState = { ...state, board: [...state.board], moves: [...state.moves, col], events: [] };
  s.board[index] = me;
  s.lastMove = index;
  s.turn = state.turn + 1;
  emit(s, { type: 'drop', player: me, col, row });
  addLog(s, me, `${playerName(s, me)} ${coordName(index)}`);

  const line = winningLine(s.board, index);
  if (line.length > 0) {
    s.phase = 'gameover';
    s.winner = me;
    s.winLine = line;
    emit(s, { type: 'win', player: me, line });
    addLog(s, me, `${withJosa(playerName(s, me), '이/가')} 넷을 이어서 이겼어요!`);
  } else if (s.moves.length >= CELLS) {
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
export function replay(state: FourLineState, count: number): FourLineState {
  let s = createGame({
    seats: [
      { kind: state.players[0].kind, name: state.players[0].name },
      { kind: state.players[1].kind, name: state.players[1].name },
    ],
    options: state.options,
  });
  for (const col of state.moves.slice(0, count)) s = applyAction(s, { type: 'drop', col });
  return s;
}

/** 무르기로 돌아갈 수: 사람이 마지막으로 둔 수 바로 앞 (없으면 -1) */
function undoPoint(state: FourLineState): number {
  for (let k = state.moves.length - 1; k >= 0; k--) {
    if (state.players[k % 2].kind === 'human') return k;
  }
  return -1;
}

export function canUndo(state: FourLineState): boolean {
  return state.options.undo && undoPoint(state) >= 0;
}

/** 사람이 마지막으로 둔 수(그 뒤 컴퓨터 수까지)를 되돌려 그 사람 차례로 돌아간다 */
export function undo(state: FourLineState): FourLineState {
  const k = undoPoint(state);
  if (k < 0) return state;
  const s = replay(state, k);
  s.nextEventId = state.nextEventId;
  s.events = [];
  emit(s, { type: 'undo' });
  addLog(s, s.current, `${playerName(s, s.current)}: 무르기`);
  return s;
}
