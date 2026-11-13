import { withJosa } from '../../lib/korean';
import type { BoardSize, Cell, Disc, GameEvent, ReversiAction, ReversiOptions, ReversiSetup, ReversiState } from './types';

export const SIDE_LABELS: [string, string] = ['흑', '백'];

export const DEFAULT_OPTIONS: ReversiOptions = { size: 8, hints: true, undo: true };

const MAX_LOG = 80;

/** 여덟 방향 [줄, 칸] */
export const DIRECTIONS: [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

type EventInput = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'id'> : never) : never;

export function other(side: Disc): Disc {
  return side === 0 ? 1 : 0;
}

export function playerName(state: Pick<ReversiState, 'players'>, side: Disc): string {
  return state.players[side].name.trim() || SIDE_LABELS[side];
}

/** 칸 번호 → "D3" (열은 A부터, 행은 위에서 1부터) */
export function coordName(index: number, size: number): string {
  const r = Math.floor(index / size);
  const c = index % size;
  return `${String.fromCharCode(65 + c)}${r + 1}`;
}

/** 처음 판: 가운데 네 칸에 흑백을 엇갈려 놓는다 (오른쪽 위·왼쪽 아래가 흑) */
export function initialBoard(size: BoardSize): Cell[] {
  const board: Cell[] = Array.from({ length: size * size }, () => -1);
  const m = size / 2;
  board[(m - 1) * size + (m - 1)] = 1;
  board[m * size + m] = 1;
  board[(m - 1) * size + m] = 0;
  board[m * size + (m - 1)] = 0;
  return board;
}

/**
 * index에 side가 두면 뒤집히는 돌들.
 * 놓은 돌에서 가까운 것부터 차례로 (방향마다 가까운 순서, 전체는 거리순) 돌려준다.
 */
export function flipsFor(board: readonly Cell[], size: number, index: number, side: Disc): number[] {
  if (board[index] !== -1) return [];
  const r0 = Math.floor(index / size);
  const c0 = index % size;
  const opp = other(side);
  const lines: number[][] = [];
  for (const [dr, dc] of DIRECTIONS) {
    const line: number[] = [];
    let r = r0 + dr;
    let c = c0 + dc;
    while (r >= 0 && r < size && c >= 0 && c < size && board[r * size + c] === opp) {
      line.push(r * size + c);
      r += dr;
      c += dc;
    }
    if (line.length > 0 && r >= 0 && r < size && c >= 0 && c < size && board[r * size + c] === side) lines.push(line);
  }
  const out: number[] = [];
  const longest = Math.max(0, ...lines.map((l) => l.length));
  for (let k = 0; k < longest; k++) for (const l of lines) if (k < l.length) out.push(l[k]);
  return out;
}

export function isLegal(board: readonly Cell[], size: number, index: number, side: Disc): boolean {
  return flipsFor(board, size, index, side).length > 0;
}

export function legalMoves(board: readonly Cell[], size: number, side: Disc): number[] {
  const out: number[] = [];
  for (let i = 0; i < board.length; i++) if (board[i] === -1 && isLegal(board, size, i, side)) out.push(i);
  return out;
}

export function countDiscs(board: readonly Cell[]): [number, number] {
  let b = 0;
  let w = 0;
  for (const v of board) {
    if (v === 0) b++;
    else if (v === 1) w++;
  }
  return [b, w];
}

/** 놓은 돌에서 떨어진 거리 (뒤집는 순서 연출용) */
export function distance(a: number, b: number, size: number): number {
  return Math.max(Math.abs(Math.floor(a / size) - Math.floor(b / size)), Math.abs((a % size) - (b % size)));
}

function addLog(s: ReversiState, side: Disc | null, text: string): void {
  s.log = [...s.log, { id: s.nextLogId, side, text }].slice(-MAX_LOG);
  s.nextLogId += 1;
}

function emit(s: ReversiState, event: EventInput): void {
  s.events.push({ ...event, id: s.nextEventId } as GameEvent);
  s.nextEventId += 1;
}

export function createGame(setup: ReversiSetup): ReversiState {
  const size = setup.options.size === 6 ? 6 : 8;
  const board = initialBoard(size);
  const s: ReversiState = {
    size,
    board,
    players: [
      { kind: setup.seats[0].kind, name: setup.seats[0].name.trim() },
      { kind: setup.seats[1].kind, name: setup.seats[1].name.trim() },
    ],
    options: { ...setup.options, size },
    current: 0,
    phase: 'play',
    turn: 1,
    lastMove: null,
    counts: countDiscs(board),
    winner: null,
    moves: [],
    passes: [0, 0],
    events: [],
    nextEventId: 1,
    log: [],
    nextLogId: 1,
  };
  addLog(s, null, s.players[0].name ? `${s.players[0].name}(흑)부터 시작해요.` : '흑부터 시작해요.');
  return s;
}

/** 판이 끝났는지 정하고 기록을 남긴다 */
function finish(s: ReversiState): void {
  const [b, w] = s.counts;
  s.phase = 'gameover';
  s.winner = b === w ? null : b > w ? 0 : 1;
  emit(s, { type: 'end', winner: s.winner });
  if (s.winner === null) addLog(s, null, `${b} 대 ${w}, 비겼어요!`);
  else addLog(s, s.winner, `${b} 대 ${w}, ${withJosa(playerName(s, s.winner), '이/가')} 이겼어요!`);
}

export function applyAction(state: ReversiState, action: ReversiAction): ReversiState {
  if (state.phase !== 'play' || action.type !== 'place') return state;
  const flips = flipsFor(state.board, state.size, action.index, state.current);
  if (flips.length === 0) return state;

  const s: ReversiState = {
    ...state,
    board: [...state.board],
    moves: [...state.moves, { player: state.current, index: action.index }],
    passes: [...state.passes],
    events: [],
  };
  const me = state.current;
  const opp = other(me);
  s.board[action.index] = me;
  for (const f of flips) s.board[f] = me;
  s.counts = countDiscs(s.board);
  s.lastMove = action.index;
  s.turn = state.turn + 1;
  emit(s, { type: 'place', player: me, index: action.index, flips });
  addLog(s, me, `${playerName(s, me)} ${coordName(action.index, s.size)} · ${flips.length}개 뒤집음`);

  if (legalMoves(s.board, s.size, opp).length > 0) {
    s.current = opp;
  } else if (legalMoves(s.board, s.size, me).length > 0) {
    // 상대가 둘 곳이 없으면 저절로 넘어가고 같은 사람이 한 번 더 둔다.
    s.current = me;
    s.passes[opp] += 1;
    emit(s, { type: 'pass', player: opp });
    addLog(s, opp, `${withJosa(playerName(s, opp), '은/는')} 둘 곳이 없어서 넘어가요.`);
  } else {
    finish(s);
  }
  return s;
}

/** 처음부터 moves의 앞 count개를 다시 둔 상태 */
export function replay(state: ReversiState, count: number): ReversiState {
  let s = createGame({
    seats: [
      { kind: state.players[0].kind, name: state.players[0].name },
      { kind: state.players[1].kind, name: state.players[1].name },
    ],
    options: state.options,
  });
  for (const m of state.moves.slice(0, count)) {
    if (s.phase !== 'play' || s.current !== m.player) break;
    s = applyAction(s, { type: 'place', index: m.index });
  }
  return s;
}

/** 무르기로 돌아갈 수: 사람이 마지막으로 둔 수 바로 앞 (없으면 -1) */
function undoPoint(state: ReversiState): number {
  for (let k = state.moves.length - 1; k >= 0; k--) {
    if (state.players[state.moves[k].player].kind === 'human') return k;
  }
  return -1;
}

export function canUndo(state: ReversiState): boolean {
  return state.options.undo && undoPoint(state) >= 0;
}

/** 사람이 마지막으로 둔 수(그 뒤 컴퓨터가 둔 수까지)를 되돌려 그 사람 차례로 돌아간다 */
export function undo(state: ReversiState): ReversiState {
  const k = undoPoint(state);
  if (k < 0) return state;
  const s = replay(state, k);
  s.nextEventId = state.nextEventId;
  s.events = [];
  emit(s, { type: 'undo' });
  addLog(s, s.current, `${playerName(s, s.current)}: 무르기`);
  return s;
}
