import type { DuelKind, DuelSeats } from '../common/duel';

/** 0 = 흑 (먼저 둔다, 왼쪽 자리), 1 = 백 */
export type Disc = 0 | 1;

/** -1 = 빈 칸 */
export type Cell = -1 | Disc;

/** 8×8 정식 판, 6×6 어린이용 작은 판 */
export type BoardSize = 6 | 8;

export interface ReversiOptions {
  size: BoardSize;
  /** 둘 수 있는 곳을 점으로 보여 준다 */
  hints: boolean;
  /** 컴퓨터와 할 때 무르기 버튼 */
  undo: boolean;
}

export interface ReversiSetup {
  seats: DuelSeats;
  options: ReversiOptions;
}

export interface ReversiPlayer {
  kind: DuelKind;
  name: string;
}

export type Phase = 'play' | 'gameover';

export type ReversiAction = { type: 'place'; index: number };

/** 화면 연출용: 마지막 행동에서 일어난 일들 */
export type GameEvent =
  | { id: number; type: 'place'; player: Disc; index: number; flips: number[] }
  | { id: number; type: 'pass'; player: Disc }
  | { id: number; type: 'end'; winner: Disc | null }
  | { id: number; type: 'undo' };

export interface LogEntry {
  id: number;
  /** 기록 앞에 찍을 돌 색 (null이면 점 없음) */
  side: Disc | null;
  text: string;
}

export interface MoveRecord {
  player: Disc;
  index: number;
}

export interface ReversiState {
  size: BoardSize;
  /** 줄 순서(row-major)로 size×size 칸. 0번 줄이 판의 맨 위(1행) */
  board: Cell[];
  players: [ReversiPlayer, ReversiPlayer];
  options: ReversiOptions;
  current: Disc;
  phase: Phase;
  /** 돌을 놓을 때마다 1씩 늘어난다 */
  turn: number;
  lastMove: number | null;
  /** 지금 판 위의 돌 수 [흑, 백] */
  counts: [number, number];
  /** gameover일 때 이긴 쪽 (null이면 무승부) */
  winner: Disc | null;
  /** 지금까지 놓은 수 (넘김은 규칙대로 저절로 생기므로 적지 않는다). 무르기는 이것을 다시 두어 만든다 */
  moves: MoveRecord[];
  /** 넘긴 횟수 [흑, 백] */
  passes: [number, number];
  events: GameEvent[];
  nextEventId: number;
  log: LogEntry[];
  nextLogId: number;
}

export type Rng = () => number;
