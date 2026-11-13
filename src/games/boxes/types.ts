import type { SeatIndex, SeatKind, Seats } from '../common/players';

export type { SeatConfig, SeatIndex, SeatKind } from '../common/players';

export type PlayerKind = Exclude<SeatKind, 'empty'>;
export type AiLevel = Exclude<PlayerKind, 'human'>;

export interface BoxesOptions {
  /** 한 변의 상자 수 (3~6). 점은 한 변에 size + 1개 */
  size: number;
  /** 상자를 만들어도 한 번 더 하지 않는다 (어린아이용 간단 규칙) */
  noExtraTurn: boolean;
  /** 사람 차례에 상자의 세 번째 선을 그으려 하면 ⚠로 알려 준다 */
  warnings: boolean;
}

export interface BoxesSetup {
  seats: Seats;
  options: BoxesOptions;
}

export interface Player {
  seat: SeatIndex;
  kind: PlayerKind;
  name: string;
  /** 완성한 상자 수 */
  score: number;
}

export type Phase = 'play' | 'gameover';

/** 선 번호 edge를 긋는다 (번호 매기는 법은 rules.ts의 hLine/vLine) */
export type BoxesAction = { type: 'line'; edge: number };

/** 화면 연출용: 마지막 행동에서 일어난 일들 */
export type GameEvent =
  | { id: number; type: 'line'; player: number; edge: number }
  | { id: number; type: 'box'; player: number; boxes: number[] }
  | { id: number; type: 'again'; player: number }
  | { id: number; type: 'turn'; player: number }
  | { id: number; type: 'end'; winners: number[] };

export interface LogEntry {
  id: number;
  seat: SeatIndex | null;
  text: string;
}

export interface BoxesState {
  /** 한 변의 상자 수 */
  size: number;
  players: Player[];
  options: BoxesOptions;
  /** 먼저 시작한 사람 */
  starter: number;
  current: number;
  /** 선마다 그은 사람 (players 인덱스). 아직 안 그었으면 -1 */
  lines: number[];
  /** 상자마다 주인 (players 인덱스). 아직이면 -1 */
  boxes: number[];
  /** 그은 선 번호를 그은 순서대로 */
  history: number[];
  phase: Phase;
  /** 차례가 다른 사람에게 넘어갈 때마다 1씩 늘어난다 */
  turn: number;
  /** "안전한 선이 다 떨어졌어요" 알림을 이미 했는지 */
  safeGone: boolean;
  /** gameover일 때 순위 순서 (players 인덱스) */
  rankings: number[];
  /** gameover일 때 사람마다 등수 (1부터, 같은 점수는 같은 등수) */
  ranks: number[];
  events: GameEvent[];
  nextEventId: number;
  log: LogEntry[];
  nextLogId: number;
}

export type Rng = () => number;
