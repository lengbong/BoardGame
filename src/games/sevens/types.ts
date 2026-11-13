import type { Card, Suit } from '../common/playingCards';
import type { SeatIndex, SeatKind, Seats } from '../common/players';

export type { Card, Suit } from '../common/playingCards';
export type { SeatIndex, SeatKind } from '../common/players';
export type { Rng } from '../../lib/random';

/** cover: 사람이 2명 이상이면 차례마다 손패를 가린다. open: 모든 손패를 보여 준다 (배우기용). */
export type HandView = 'cover' | 'open';

/** single: 한 판 (모두의 순위), points: 여러 판 점수 모으기 */
export type EndMode = 'single' | 'points';

export interface SevensOptions {
  /** 통과는 한 판에 3번까지. 4번째 통과를 해야 하면 탈락하고 카드를 모두 판에 내려놓는다. */
  passLimit: boolean;
  handView: HandView;
  endMode: EndMode;
  /** endMode가 points일 때 목표 점수 */
  targetScore: number;
}

export interface SevensSetup {
  seats: Seats;
  options: SevensOptions;
}

/** playing: 하는 중, finished: 카드를 다 냄, out: 통과를 다 써서 탈락 */
export type PlayerStatus = 'playing' | 'finished' | 'out';

export interface Player {
  seat: SeatIndex;
  kind: Exclude<SeatKind, 'empty'>;
  name: string;
  hand: Card[];
  /** 이번 판에 통과한 횟수 */
  passes: number;
  status: PlayerStatus;
  /** 탈락할 때 판에 내려놓은 카드 점수 (점수 모으기에서 남은 카드처럼 센다) */
  dumpedPoints: number;
  /** 지금까지 모은 점수 (점수 모으기) */
  score: number;
}

/** 판의 한 칸: 누가 냈는지, 탈락해서 내려놓은 카드인지 */
export interface BoardCell {
  by: number;
  dumped: boolean;
}

/** 무늬마다 길이 14 배열 (0번은 비움, 1~13 = A~K). 비어 있으면 null */
export type Board = Record<Suit, (BoardCell | null)[]>;

export type Phase = 'play' | 'roundover' | 'gameover';

export type SevensAction = { type: 'play'; cardId: number } | { type: 'pass' } | { type: 'nextRound' };

/** 화면 연출용: 마지막 행동에서 일어난 일들 */
export type GameEvent =
  | { id: number; type: 'deal'; starter: number }
  | { id: number; type: 'play'; player: number; card: Card; auto?: boolean }
  | { id: number; type: 'pass'; player: number; count: number }
  | { id: number; type: 'eliminate'; player: number; cards: Card[] }
  | { id: number; type: 'finish'; player: number; place: number }
  | { id: number; type: 'roundEnd'; winner: number; points: number };

export interface RoundResult {
  winner: number;
  /** 이긴 사람이 이번 판에 얻은 점수 */
  points: number;
  /** 사람마다 남은 카드 점수 (탈락한 사람은 내려놓은 카드 점수) */
  handPoints: number[];
  /** 이번 판 순위 */
  order: number[];
}

export interface LogEntry {
  id: number;
  seat: SeatIndex | null;
  text: string;
}

export interface SevensState {
  players: Player[];
  options: SevensOptions;
  board: Board;
  phase: Phase;
  round: number;
  /** 이번 판에 카드를 처음 받은 사람 (다음 판은 그다음 사람부터) */
  dealer: number;
  current: number;
  /** 차례가 바뀔 때마다 1씩 늘어난다 */
  turn: number;
  /** 이번 판에 카드를 다 낸 순서 */
  finishOrder: number[];
  /** 이번 판에 탈락한 순서 */
  outOrder: number[];
  roundResult: RoundResult | null;
  /** gameover일 때 최종 순위 (players 인덱스) */
  rankings: number[];
  events: GameEvent[];
  nextEventId: number;
  log: LogEntry[];
  nextLogId: number;
}
