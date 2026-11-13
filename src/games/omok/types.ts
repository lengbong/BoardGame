import type { DuelKind, DuelSeats } from '../common/duel';

export type { DuelAiLevel, DuelKind } from '../common/duel';

/** 0 = 흑 (먼저 둔다, 왼쪽 자리), 1 = 백 */
export type Stone = 0 | 1;

/** -1 = 빈 칸 */
export type Cell = -1 | Stone;

export type BoardSize = 15 | 13;

/**
 * free: 자유 (금수 없음, 여섯 개 이상도 이김)
 * no33: 쌍삼 금지 (흑백 모두 열린 삼 두 개를 한 번에 만들 수 없음)
 * renju: 렌주 (흑만 쌍삼·쌍사·장목 금지, 흑은 정확히 다섯이어야 이김)
 */
export type RuleSet = 'free' | 'no33' | 'renju';

export type Forbidden = '33' | '44' | 'overline';

export interface OmokOptions {
  size: BoardSize;
  rule: RuleSet;
  /** 이길 곳·막을 곳 알려 주기 */
  hints: boolean;
  /** 컴퓨터와 할 때 무르기 */
  undo: boolean;
  /** 돌에 둔 순서 번호 보이기 */
  numbers: boolean;
}

export interface OmokSetup {
  seats: DuelSeats;
  options: OmokOptions;
}

export interface OmokPlayer {
  kind: DuelKind;
  name: string;
}

export type Phase = 'play' | 'gameover';

export type OmokAction = { type: 'place'; index: number };

/** 화면 연출용: 마지막 행동에서 일어난 일들 */
export type GameEvent =
  | { id: number; type: 'place'; player: Stone; index: number }
  | { id: number; type: 'win'; player: Stone; line: number[] }
  | { id: number; type: 'draw' }
  | { id: number; type: 'undo' };

export interface LogEntry {
  id: number;
  side: Stone | null;
  text: string;
}

export interface OmokState {
  size: BoardSize;
  /** 줄 순서로 size × size 칸. index = 줄 × size + 열, 0번 줄이 맨 위 */
  board: Cell[];
  players: [OmokPlayer, OmokPlayer];
  options: OmokOptions;
  current: Stone;
  phase: Phase;
  /** 돌을 놓을 때마다 1씩 늘어난다 */
  turn: number;
  lastMove: number | null;
  /** gameover일 때 이긴 쪽 (null이면 비김: 판이 꽉 참) */
  winner: Stone | null;
  /** 이긴 다섯 줄 */
  winLine: number[] | null;
  /** 지금까지 둔 칸 (흑부터 번갈아). 무르기는 이것을 다시 두어 만든다 */
  moves: number[];
  events: GameEvent[];
  nextEventId: number;
  log: LogEntry[];
  nextLogId: number;
}
