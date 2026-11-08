export type SeatIndex = 0 | 1 | 2 | 3;

export type SeatKind = 'human' | 'ai-easy' | 'ai-normal' | 'empty';

export interface SeatConfig {
  kind: SeatKind;
  name: string;
}

export interface RuleOptions {
  /** 6이 나와야 대기실에서 출발할 수 있다. 끄면 아무 수나 출발. */
  needSixToEnter: boolean;
  /** 6이 나오면 한 번 더 굴린다. */
  bonusOnSix: boolean;
  /** 6이 세 번 연속 나오면 차례가 끝난다. */
  threeSixesEndsTurn: boolean;
  /** 상대 말을 잡거나 내 말이 골인하면 한 번 더 굴린다. */
  bonusOnCaptureOrFinish: boolean;
  /** 시작칸과 별칸에서는 잡히지 않는다. */
  safeSquares: boolean;
  /** 정확한 수가 나와야 골인한다. 끄면 넘쳐도 골인. */
  exactFinish: boolean;
  /** 1등이 나오면 바로 게임을 끝낸다. 끄면 끝까지 순위를 정한다. */
  stopAtFirstWinner: boolean;
}

export interface GameSetup {
  seats: [SeatConfig, SeatConfig, SeatConfig, SeatConfig];
  rules: RuleOptions;
}

/**
 * 말 하나의 진행도.
 * -1: 대기실, 0..50: 공용 트랙, 51..55: 자기 색 결승 통로, 56: 골인
 */
export type Progress = number;

export interface Player {
  seat: SeatIndex;
  kind: Exclude<SeatKind, 'empty'>;
  name: string;
  pieces: Progress[];
}

export interface Capture {
  playerIndex: number;
  pieceIndex: number;
  from: Progress;
}

export interface Move {
  playerIndex: number;
  pieceIndex: number;
  from: Progress;
  to: Progress;
  enters: boolean;
  finishes: boolean;
  captures: Capture[];
}

export type Phase = 'rolling' | 'choosing' | 'passing' | 'gameover';

export interface LogEntry {
  id: number;
  seat: SeatIndex | null;
  text: string;
}

export interface GameState {
  players: Player[];
  rules: RuleOptions;
  /** players 배열의 인덱스 */
  current: number;
  phase: Phase;
  dice: number | null;
  sixesInRow: number;
  /** passing 단계에서 다음 차례가 같은 사람인지 */
  passKeepsTurn: boolean;
  /** 골인한 순서대로 players 인덱스 */
  rankings: number[];
  log: LogEntry[];
  nextLogId: number;
  lastMove: Move | null;
}

export type Rng = () => number;
