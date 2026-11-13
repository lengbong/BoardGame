import type { DuelKind, DuelSeats } from '../common/duel';

/** 0 = 빨강 (먼저 둔다, 왼쪽 자리), 1 = 노랑 */
export type Side = 0 | 1;

/** -1 = 빈 칸 */
export type Cell = -1 | Side;

export interface FourLineOptions {
  /** 이길 수 있는 곳·막아야 할 곳을 알려 준다 */
  hints: boolean;
  /** 컴퓨터와 할 때 무르기 버튼 */
  undo: boolean;
}

export interface FourLineSetup {
  seats: DuelSeats;
  options: FourLineOptions;
}

export interface FourLinePlayer {
  kind: DuelKind;
  name: string;
}

export type Phase = 'play' | 'gameover';

export type FourLineAction = { type: 'drop'; col: number };

/** 화면 연출용: 마지막 행동에서 일어난 일들 */
export type GameEvent =
  | { id: number; type: 'drop'; player: Side; col: number; row: number }
  | { id: number; type: 'win'; player: Side; line: number[] }
  | { id: number; type: 'draw' }
  | { id: number; type: 'undo' };

export interface LogEntry {
  id: number;
  side: Side | null;
  text: string;
}

export interface FourLineState {
  /** 줄 순서로 6×7 칸. index = 줄×7 + 열, 0번 줄이 맨 위 */
  board: Cell[];
  players: [FourLinePlayer, FourLinePlayer];
  options: FourLineOptions;
  current: Side;
  phase: Phase;
  /** 돌을 놓을 때마다 1씩 늘어난다 */
  turn: number;
  lastMove: number | null;
  /** gameover일 때 이긴 쪽 (null이면 무승부) */
  winner: Side | null;
  /** 이긴 줄 (넷 이상 이어진 칸들) */
  winLine: number[] | null;
  /** 지금까지 떨어뜨린 열 (빨강부터 번갈아). 무르기는 이것을 다시 두어 만든다 */
  moves: number[];
  events: GameEvent[];
  nextEventId: number;
  log: LogEntry[];
  nextLogId: number;
}

export type Rng = () => number;
