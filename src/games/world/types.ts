import type { SeatIndex, SeatKind, Seats } from '../common/players';

export type EndMode = 'last-standing' | 'first-bankrupt' | 'rounds';

export interface WorldOptions {
  startCash: number;
  salary: number;
  endMode: EndMode;
  /** endMode가 'rounds'일 때 몇 라운드 후 끝낼지 */
  maxRounds: number;
}

export interface WorldSetup {
  seats: Seats;
  options: WorldOptions;
}

export type Region = 'asia' | 'europe' | 'mideast-africa' | 'americas' | 'oceania';

export type SquareKind = 'start' | 'city' | 'card' | 'tax' | 'stuck' | 'festival' | 'plane';

export interface Square {
  index: number;
  kind: SquareKind;
  name: string;
  /** city: 그림 id */
  cityId?: string;
  country?: string;
  region?: Region;
  price?: number;
  /** tax: 내는 돈 */
  tax?: number;
}

/** 도시 칸 소유 상태. level: 0 땅만, 1 집, 2 빌딩, 3 호텔 */
export interface Property {
  owner: number | null;
  level: number;
}

export interface WPlayer {
  seat: SeatIndex;
  kind: Exclude<SeatKind, 'empty'>;
  name: string;
  cash: number;
  position: number;
  /** 여권 분실 칸에서 앞으로 쉬어야 하는 차례 수 */
  stuckTurns: number;
  bankrupt: boolean;
  escapeCards: number;
  freePasses: number;
}

export type CardId =
  | 'lottery'
  | 'photo'
  | 'birthday'
  | 'refund'
  | 'speeding'
  | 'hospital'
  | 'souvenir'
  | 'repair'
  | 'go-start'
  | 'go-plane'
  | 'go-stuck'
  | 'back3'
  | 'next-city'
  | 'escape'
  | 'free-pass'
  | 'festival';

export type Phase = 'rolling' | 'buy' | 'build' | 'card' | 'select-festival' | 'select-plane' | 'gameover';

export interface LogEntry {
  id: number;
  seat: SeatIndex | null;
  text: string;
}

export interface MoveRecord {
  playerIndex: number;
  /** 지나가는 칸 순서 (출발 위치 제외, 도착 칸 포함). 순간이동이면 도착 칸 하나 */
  path: number[];
}

export interface WorldState {
  players: WPlayer[];
  /** 칸 번호 → 소유 상태 (도시가 아닌 칸은 null) */
  properties: (Property | null)[];
  options: WorldOptions;
  current: number;
  phase: Phase;
  dice: [number, number] | null;
  doublesInRow: number;
  /** 이번 행동이 끝나면 같은 사람이 한 번 더 굴리는지 (더블) */
  extraRoll: boolean;
  round: number;
  festivalSquare: number | null;
  pendingCard: CardId | null;
  deck: CardId[];
  deckIndex: number;
  /** 카드 섞기용 난수 상태 (게임을 저장해도 같은 결과가 나오도록) */
  seed: number;
  /** 파산한 순서대로 players 인덱스 */
  bankruptOrder: number[];
  /** 게임이 끝났을 때의 순위 (players 인덱스) */
  rankings: number[];
  log: LogEntry[];
  nextLogId: number;
  lastMove: MoveRecord | null;
}

export type Rng = () => number;

export type WorldAction =
  | { type: 'roll' }
  | { type: 'buy'; levels: number }
  | { type: 'build'; levels: number }
  | { type: 'decline' }
  | { type: 'card' }
  | { type: 'select'; index: number };
