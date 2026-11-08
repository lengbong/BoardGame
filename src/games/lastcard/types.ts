import type { SeatIndex, SeatKind, Seats } from '../common/players';

export type { SeatConfig, SeatIndex, SeatKind } from '../common/players';

export type CardColor = 'red' | 'yellow' | 'green' | 'blue';

/** number: 숫자, skip: 건너뛰기, reverse: 방향 바꾸기, draw2: +2, wild: 색 바꾸기, wild4: +4 색 바꾸기 */
export type CardKind = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

export interface Card {
  id: number;
  kind: CardKind;
  /** 색 바꾸기 카드(wild, wild4)는 null */
  color: CardColor | null;
  /** 숫자 카드는 0~9, 나머지는 -1 */
  value: number;
}

/** cover: 사람이 2명 이상이면 차례마다 손패를 가린다. open: 모든 손패를 보여 준다. */
export type HandView = 'cover' | 'open';

/** single: 한 판 승부, points: 목표 점수에 먼저 도달하면 우승 */
export type EndMode = 'single' | 'points';

export interface LastCardOptions {
  /** +2 위에 +2·+4, +4 위에 +4를 이어 내서 다음 사람에게 넘길 수 있다. */
  stacking: boolean;
  /** 카드가 2장일 때 '한 장!'을 외치고 내야 한다. 깜빡하면 2장을 받는다. 끄면 자동으로 외친다. */
  callRule: boolean;
  handView: HandView;
  endMode: EndMode;
  /** endMode가 points일 때 목표 점수 */
  targetScore: number;
}

export interface LastCardSetup {
  seats: Seats;
  options: LastCardOptions;
}

export interface Player {
  seat: SeatIndex;
  kind: Exclude<SeatKind, 'empty'>;
  name: string;
  hand: Card[];
  /** 지금까지 모은 점수 */
  score: number;
}

/** play: 카드를 내거나 뽑는다. drawn: 방금 뽑은 카드를 낼지 고른다. */
export type Phase = 'play' | 'drawn' | 'roundover' | 'gameover';

export type LastCardAction =
  | { type: 'play'; cardId: number; color?: CardColor; call?: boolean }
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'call' }
  | { type: 'nextRound' };

export type DrawReason = 'normal' | 'draw2' | 'wild4' | 'stack' | 'forgot';

/** 화면 연출용: 마지막 행동에서 일어난 일들 */
export type GameEvent =
  | { id: number; type: 'deal' }
  | { id: number; type: 'play'; player: number; card: Card }
  | { id: number; type: 'draw'; player: number; count: number; reason: DrawReason }
  | { id: number; type: 'skip'; player: number }
  | { id: number; type: 'reverse'; direction: 1 | -1 }
  | { id: number; type: 'color'; player: number; color: CardColor }
  | { id: number; type: 'call'; player: number }
  | { id: number; type: 'stack'; player: number; total: number }
  | { id: number; type: 'pass'; player: number }
  | { id: number; type: 'reshuffle' }
  | { id: number; type: 'win'; player: number; points: number };

export interface RoundResult {
  winner: number;
  /** 이긴 사람이 이번 판에 얻은 점수 */
  points: number;
  /** 사람마다 손에 남은 카드 점수 */
  handPoints: number[];
}

export interface LogEntry {
  id: number;
  seat: SeatIndex | null;
  text: string;
}

export interface LastCardState {
  players: Player[];
  options: LastCardOptions;
  round: number;
  /** 이번 판을 시작한 사람 (다음 판은 그다음 사람이 시작) */
  starter: number;
  current: number;
  /** 1: 자리 순서(시계 방향), -1: 반대 방향 */
  direction: 1 | -1;
  /** 뽑을 카드 더미. 배열의 끝이 맨 위 */
  drawPile: Card[];
  /** 버린 카드 더미. 배열의 끝이 맨 위 */
  discard: Card[];
  /** 지금 맞춰야 하는 색 (색 바꾸기 카드로 정한 색 포함) */
  activeColor: CardColor;
  /** +2·+4 누적 규칙에서 쌓여 있는 장수 */
  pendingDraw: number;
  /** drawn 단계에서 방금 뽑은 카드 */
  drawnCardId: number | null;
  /** 이번 차례에 '한 장!'을 외쳤는지 */
  called: boolean;
  phase: Phase;
  /** 차례가 시작될 때마다 1씩 늘어난다 */
  turn: number;
  roundResult: RoundResult | null;
  /** gameover일 때 순위 (players 인덱스) */
  rankings: number[];
  events: GameEvent[];
  nextEventId: number;
  log: LogEntry[];
  nextLogId: number;
}

export type Rng = () => number;
