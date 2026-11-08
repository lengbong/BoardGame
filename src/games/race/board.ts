import type { Progress, SeatIndex } from './types';

/** 판은 15×15칸. 좌표는 칸 단위이며 칸의 중심은 (열 + 0.5, 행 + 0.5). */
export const BOARD_SIZE = 15;
export const TRACK_LENGTH = 52;
export const LAST_TRACK_PROGRESS = 50;
export const HOME_COLUMN_START = 51;
export const GOAL = 56;
export const YARD = -1;
export const PIECES_PER_PLAYER = 4;

export interface Point {
  x: number;
  y: number;
}

export { SEAT_COLORS } from '../common/players';

const center = (col: number, row: number): Point => ({ x: col + 0.5, y: row + 0.5 });

/** 판 중심을 기준으로 시계 방향 90도 회전 */
function rotate(p: Point, times: number): Point {
  let { x, y } = p;
  for (let i = 0; i < times; i++) {
    [x, y] = [BOARD_SIZE - y, x];
  }
  return { x, y };
}

// 빨강(0번 자리, 왼쪽 위) 기준의 트랙 1/4 구간 (13칸). 나머지 자리는 회전해서 얻는다.
const QUARTER: Point[] = [
  center(1, 6), center(2, 6), center(3, 6), center(4, 6), center(5, 6),
  center(6, 5), center(6, 4), center(6, 3), center(6, 2), center(6, 1), center(6, 0),
  center(7, 0),
  center(8, 0),
];

/** 절대 트랙 칸 0..51의 중심 좌표. 0번 칸이 빨강의 시작칸. */
export const TRACK: Point[] = [0, 1, 2, 3].flatMap((s) => QUARTER.map((p) => rotate(p, s)));

const HOME_COLUMN_RED: Point[] = [center(1, 7), center(2, 7), center(3, 7), center(4, 7), center(5, 7)];
const YARD_SPOTS_RED: Point[] = [
  { x: 2, y: 2 },
  { x: 4, y: 2 },
  { x: 2, y: 4 },
  { x: 4, y: 4 },
];
const GOAL_SPOTS_RED: Point[] = [
  { x: 6.55, y: 7.15 },
  { x: 6.55, y: 7.85 },
  { x: 6.95, y: 7.5 },
  { x: 6.3, y: 7.5 },
];

export function startSquare(seat: SeatIndex): number {
  return seat * 13;
}

/** 공용 트랙 위(0..50)에 있는 말의 절대 칸 번호 */
export function absoluteSquare(seat: SeatIndex, progress: Progress): number {
  return (startSquare(seat) + progress) % TRACK_LENGTH;
}

export const STAR_SQUARES = [8, 21, 34, 47];
export const START_SQUARES = [0, 13, 26, 39];

export function isSafeSquare(abs: number): boolean {
  return START_SQUARES.includes(abs) || STAR_SQUARES.includes(abs);
}

export function homeColumnCells(seat: SeatIndex): Point[] {
  return HOME_COLUMN_RED.map((p) => rotate(p, seat));
}

export function yardSpot(seat: SeatIndex, pieceIndex: number): Point {
  return rotate(YARD_SPOTS_RED[pieceIndex], seat);
}

export function goalSpot(seat: SeatIndex, pieceIndex: number): Point {
  return rotate(GOAL_SPOTS_RED[pieceIndex], seat);
}

/** 말의 진행도를 판 위의 좌표로 변환 */
export function progressToPoint(seat: SeatIndex, pieceIndex: number, progress: Progress): Point {
  if (progress === YARD) return yardSpot(seat, pieceIndex);
  if (progress >= GOAL) return goalSpot(seat, pieceIndex);
  if (progress >= HOME_COLUMN_START) return homeColumnCells(seat)[progress - HOME_COLUMN_START];
  return TRACK[absoluteSquare(seat, progress)];
}

/** 겹친 말을 구분하기 위한 칸 식별자 (대기실·골인은 말마다 자리가 따로 있으므로 개별) */
export function cellKey(seat: SeatIndex, pieceIndex: number, progress: Progress): string {
  if (progress === YARD) return `yard-${seat}-${pieceIndex}`;
  if (progress >= GOAL) return `goal-${seat}-${pieceIndex}`;
  if (progress >= HOME_COLUMN_START) return `home-${seat}-${progress}`;
  return `track-${absoluteSquare(seat, progress)}`;
}

export { rotate };
