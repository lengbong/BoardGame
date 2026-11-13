import type { SeatIndex, SeatKind, Seats } from '../common/players';

export type { SeatConfig, SeatIndex, SeatKind } from '../common/players';
export type { Rng } from '../../lib/random';

/** 도미노 패 하나. a ≤ b (예: 3·5 패는 a=3, b=5) */
export interface Tile {
  id: number;
  a: number;
  b: number;
}

/** 줄의 어느 끝에 놓을지. left: 줄의 앞쪽 끝, right: 줄의 뒤쪽 끝 */
export type Side = 'left' | 'right';

/** cover: 사람이 2명 이상이면 차례마다 손패를 가린다. open: 모든 손패를 보여 준다. */
export type HandView = 'cover' | 'open';

/** single: 한 판 승부, points: 목표 점수에 먼저 도달하면 우승 */
export type EndMode = 'single' | 'points';

export interface DominoOptions {
  /** 블록 규칙: 낼 패가 없으면 뽑지 않고 그냥 통과한다. */
  blockRule: boolean;
  /** 두 번째 판부터는 지난 판에 이긴 사람이 아무 패나 내며 시작한다. 끄면 판마다 가장 높은 더블로 시작한다. */
  winnerStarts: boolean;
  /** 숫자마다 점 색을 다르게 그린다 (보기 설정, 규칙에는 영향 없음) */
  pipColors: boolean;
  handView: HandView;
  endMode: EndMode;
  /** endMode가 points일 때 목표 점수 */
  targetScore: number;
}

export interface DominoSetup {
  seats: Seats;
  options: DominoOptions;
}

/** 줄에 놓인 패. left는 줄의 앞쪽(왼쪽 끝 방향) 숫자, right는 뒤쪽(오른쪽 끝 방향) 숫자 */
export interface PlacedTile {
  tile: Tile;
  left: number;
  right: number;
  /** 이번 판에서 몇 번째로 놓였는지 (0부터) */
  order: number;
  /** 놓은 사람 (players 인덱스) */
  player: number;
}

export interface Player {
  seat: SeatIndex;
  kind: Exclude<SeatKind, 'empty'>;
  name: string;
  hand: Tile[];
  /** 지금까지 모은 점수 */
  score: number;
  /**
   * 뽑거나 통과하는 것을 보고 알 수 있는 '이 사람 손에 없는 숫자'.
   * 모두가 지켜볼 수 있는 정보라서 컴퓨터가 막기 작전에 쓴다. 판마다 새로 시작.
   */
  lacks: number[];
}

export type Phase = 'play' | 'roundover' | 'gameover';

export type DominoAction =
  | { type: 'play'; tileId: number; side?: Side }
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'nextRound' };

/** domino: 누군가 패를 다 냈다. blocked: 아무도 낼 수 없어서 막혔다. */
export type RoundEndReason = 'domino' | 'blocked';

/** 화면 연출용: 마지막 행동에서 일어난 일들 */
export type GameEvent =
  | { id: number; type: 'deal' }
  | { id: number; type: 'play'; player: number; tile: Tile; side: Side; auto: boolean }
  | { id: number; type: 'draw'; player: number; tileId: number }
  | { id: number; type: 'pass'; player: number }
  | { id: number; type: 'blocked' }
  | { id: number; type: 'win'; player: number | null; points: number; reason: RoundEndReason };

export interface RoundResult {
  reason: RoundEndReason;
  /** 이긴 사람. 막혔는데 점과 패 수가 똑같으면 null (무승부) */
  winner: number | null;
  /** 무승부일 때 점이 가장 적었던 사람들 */
  tied: number[];
  /** 이긴 사람이 이번 판에 얻은 점수 */
  points: number;
  /** 사람마다 손에 남은 점의 합 */
  handPips: number[];
}

export interface LogEntry {
  id: number;
  seat: SeatIndex | null;
  text: string;
}

export interface DominoState {
  players: Player[];
  options: DominoOptions;
  round: number;
  current: number;
  /** 줄. 배열의 앞이 왼쪽 끝, 뒤가 오른쪽 끝 */
  line: PlacedTile[];
  /** line에서 이번 판 첫 패의 위치 (뱀 모양 배치의 시작점) */
  origin: number;
  /** 뽑는 더미. 배열의 끝이 맨 위 */
  boneyard: Tile[];
  phase: Phase;
  /** 차례가 시작될 때마다 1씩 늘어난다 */
  turn: number;
  /** 이번 차례에 뽑은 개수 */
  turnDraws: number;
  /** 이번 판 첫 패를 낸 사람 */
  starter: number;
  /** 지난 판에 이긴 사람 (다음 판을 시작) */
  lastWinner: number | null;
  roundResult: RoundResult | null;
  /** gameover일 때 순위 (players 인덱스) */
  rankings: number[];
  events: GameEvent[];
  nextEventId: number;
  log: LogEntry[];
  nextLogId: number;
}
