import type { SeatIndex, SeatKind, Seats } from '../common/players';

export type { SeatConfig, SeatIndex, SeatKind } from '../common/players';

export type TileColor = 'red' | 'blue' | 'green' | 'black';

export interface Tile {
  id: number;
  /** 조커는 null */
  color: TileColor | null;
  /** 1~13, 조커는 0 */
  value: number;
  joker: boolean;
}

/** 판 위의 줄 하나 */
export interface TableSet {
  id: number;
  tiles: Tile[];
}

export type HandView = 'cover' | 'open';

/** single: 한 판 승부, rounds: 정해진 판 수만큼 해서 점수 합계로 순위 */
export type EndMode = 'single' | 'rounds';

export interface TilesOptions {
  /** 정통 규칙: 판 위의 타일을 뜯어서 다시 조합할 수 있다. 끄면 새 줄 만들기·기존 줄에 붙이기만. */
  rearrange: boolean;
  /** 첫 등록은 내 타일만으로 합 30 이상 */
  initialMeld: boolean;
  /** 한 차례 제한 시간(초). 0이면 없음 */
  turnTime: number;
  handView: HandView;
  endMode: EndMode;
  /** endMode가 rounds일 때 몇 판 */
  rounds: number;
}

export interface TilesSetup {
  seats: Seats;
  options: TilesOptions;
}

export interface Player {
  seat: SeatIndex;
  kind: Exclude<SeatKind, 'empty'>;
  name: string;
  rack: Tile[];
  /** 첫 등록을 마쳤는지 */
  melded: boolean;
  score: number;
}

export type Phase = 'play' | 'roundover' | 'gameover';

export type TilesAction =
  /** 이번 차례에 만든 판 전체를 제출한다 */
  | { type: 'commit'; table: TableSet[] }
  /** 타일을 1개 가져오고 차례를 마친다 (더미가 비었으면 그냥 넘어간다) */
  | { type: 'draw' }
  | { type: 'nextRound' };

export interface RoundResult {
  winner: number;
  /** 아무도 낼 수 없어서 끝났는지 (타일 합이 가장 적은 사람이 이김) */
  blocked: boolean;
  /** 사람마다 이번 판 점수 */
  deltas: number[];
  /** 사람마다 남은 타일 점수 */
  rackPoints: number[];
}

export interface LastMove {
  player: number;
  /** 이번에 판에 낸 타일 id */
  played: number[];
  drew: boolean;
  /** 첫 등록 점수 (첫 등록이었을 때만) */
  meldPoints: number | null;
}

export interface LogEntry {
  id: number;
  seat: SeatIndex | null;
  text: string;
}

export interface TilesState {
  players: Player[];
  options: TilesOptions;
  round: number;
  starter: number;
  current: number;
  /** 가져올 타일 더미. 배열 끝이 맨 위 */
  pool: Tile[];
  table: TableSet[];
  nextSetId: number;
  phase: Phase;
  turn: number;
  /** 더미가 빈 뒤로 연속해서 넘어간 횟수 */
  passesInRow: number;
  lastMove: LastMove | null;
  roundResult: RoundResult | null;
  rankings: number[];
  log: LogEntry[];
  nextLogId: number;
}

export type Rng = () => number;
