import type { DuelKind, DuelSeats } from '../common/duel';

export type { DuelKind, DuelSeats } from '../common/duel';

/**
 * 판의 칸 번호 (모두 14칸, 씨앗은 번호가 커지는 쪽 = 시계 반대 방향으로 뿌린다)
 *   0~5  : 0번 편(먼저 하는 편)의 구멍, 왼쪽에서 오른쪽
 *   6    : 0번 편의 창고 (오른쪽 끝)
 *   7~12 : 1번 편의 구멍 (1번 편이 보기에 왼쪽에서 오른쪽)
 *   13   : 1번 편의 창고
 */
export type Side = 0 | 1;

export type SeedCount = 3 | 4 | 5 | 6;

/**
 * owner: 남은 씨앗은 그 구멍 주인의 창고로 (정통 규칙)
 * emptier: 남은 씨앗은 모두 구멍이 먼저 빈 쪽 사람의 창고로 (변형)
 */
export type SweepRule = 'owner' | 'emptier';

export interface MancalaOptions {
  /** 처음에 구멍마다 넣는 씨앗 수 */
  seeds: SeedCount;
  /** 내 빈 구멍에서 끝났는데 건너편이 비어 있어도 그 씨앗 한 알을 창고로 가져온다. */
  captureEmpty: boolean;
  sweep: SweepRule;
  /** 컴퓨터와 할 때 무르기 버튼을 보여 준다. */
  undo: boolean;
}

export interface MancalaSetup {
  seats: DuelSeats;
  options: MancalaOptions;
  /** 도움말: 구멍에 마우스를 올리면 마지막 씨앗이 떨어질 곳을 보여 준다. */
  hints: boolean;
}

export interface MancalaPlayer {
  kind: DuelKind;
  name: string;
}

export interface PlayerStats {
  /** 가져오기 횟수 */
  captures: number;
  /** 가져오기로 얻은 씨앗 (내 씨앗 한 알 포함) */
  captured: number;
  /** '한 번 더' 횟수 */
  extraTurns: number;
}

export type MancalaAction = { type: 'sow'; pit: number };

export interface CaptureInfo {
  /** 마지막 씨앗이 떨어진 내 구멍 */
  pit: number;
  /** 건너편 구멍 */
  opposite: number;
  /** 창고로 옮긴 씨앗 수 (건너편 씨앗 + 내 씨앗 한 알) */
  count: number;
}

export interface SweepMove {
  from: number;
  to: number;
  count: number;
}

/** 한 수를 둔 결과 (규칙 엔진과 컴퓨터가 함께 쓴다) */
export interface MoveResult {
  board: number[];
  /** 씨앗이 한 알씩 떨어진 칸 번호 순서 */
  path: number[];
  /** 마지막 씨앗이 떨어진 칸 */
  last: number;
  extra: boolean;
  capture: CaptureInfo | null;
  gameOver: boolean;
  /** 끝났을 때 구멍이 모두 빈 편 (둘 다 비었으면 'both') */
  emptied: Side | 'both' | null;
  /** 끝났을 때 남은 씨앗을 창고로 옮긴 내용 */
  sweep: SweepMove[];
}

export interface LastMove {
  side: Side;
  pit: number;
  last: number;
  extra: boolean;
  capture: CaptureInfo | null;
}

/** 화면 연출용: 마지막 행동에서 일어난 일들 */
export type MancalaEvent =
  | { id: number; type: 'sow'; side: Side; pit: number; count: number; path: number[] }
  | { id: number; type: 'capture'; side: Side; pit: number; opposite: number; count: number }
  | { id: number; type: 'extra'; side: Side }
  | { id: number; type: 'sweep'; moves: SweepMove[] }
  | { id: number; type: 'end'; winner: Side | null };

export interface LogEntry {
  id: number;
  side: Side | null;
  text: string;
}

export type Phase = 'play' | 'gameover';

export interface MancalaResult {
  /** null이면 비김 */
  winner: Side | null;
  scores: [number, number];
  /** 끝날 때 남은 씨앗 정리로 창고에 들어간 수 */
  swept: [number, number];
}

export interface MancalaState {
  board: number[];
  options: MancalaOptions;
  players: [MancalaPlayer, MancalaPlayer];
  current: Side;
  phase: Phase;
  /** 수를 둘 때마다 1씩 늘어난다 */
  turn: number;
  lastMove: LastMove | null;
  stats: [PlayerStats, PlayerStats];
  result: MancalaResult | null;
  events: MancalaEvent[];
  nextEventId: number;
  log: LogEntry[];
  nextLogId: number;
}

export type Rng = () => number;
