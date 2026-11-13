import type { Card } from '../common/playingCards';
import type { SeatIndex, SeatKind, Seats } from '../common/players';

export type { Card } from '../common/playingCards';
export type { SeatIndex, SeatKind } from '../common/players';
export type { Rng } from '../../lib/random';

/** cover: 사람이 2명 이상이면 차례마다 손패를 가린다. open: 모든 손패를 보여 준다 (배우기용). */
export type HandView = 'cover' | 'open';

/** anyone: 누구나 차례로 '거짓말!'을 외칠 수 있다. next: 다음 사람만 외칠 수 있다 (화면 넘기기가 적다) */
export type DoubtRule = 'anyone' | 'next';

/** all: 카드를 거의 다 나눈다. quick: 조금씩만 나눠서 빨리 끝난다 */
export type DealSize = 'all' | 'quick';

export interface CheatOptions {
  handView: HandView;
  doubt: DoubtRule;
  deal: DealSize;
}

export interface CheatSetup {
  seats: Seats;
  options: CheatOptions;
}

export interface PlayerStats {
  /** 카드를 낸 횟수 */
  plays: number;
  /** 거짓말로 낸 횟수 (낸 카드 중 하나라도 말한 숫자와 다르면) */
  lies: number;
  /** 거짓말이 들킨 횟수 */
  caught: number;
  /** '거짓말!'을 외친 횟수 */
  doubts: number;
  /** 외쳐서 맞힌 횟수 */
  rightDoubts: number;
  /** 더미를 가져간 횟수 */
  pickups: number;
}

export interface Player {
  seat: SeatIndex;
  kind: Exclude<SeatKind, 'empty'>;
  name: string;
  hand: Card[];
  stats: PlayerStats;
}

/** 더미에 놓인 카드: 누가 냈는지 (각자 자기가 낸 카드는 안다) */
export interface PileCard {
  card: Card;
  by: number;
}

/** 카드를 내면서 한 말: "7 두 장!" */
export interface Claim {
  /** 몇 번째로 낸 것인지 (1부터) */
  id: number;
  player: number;
  rank: number;
  count: number;
  /** 실제로 낸 카드 (뒷면으로 놓여서 아무도 모른다) */
  cards: Card[];
}

/** 마지막으로 낸 것이 어떻게 되었는지 */
export interface Verdict {
  claim: Claim;
  /** accepted: 모두 믿음, lie: 거짓말 들킴, truth: 의심했지만 진짜였음 */
  result: 'accepted' | 'lie' | 'truth';
  /** 의심한 사람 (믿었으면 null) */
  doubter: number | null;
  /** 더미를 가져간 사람 (믿었으면 null) */
  taker: number | null;
  /** 가져간 장수 */
  taken: number;
}

/** play: 카드를 낼 차례, doubt: 방금 낸 카드를 의심할지 정하는 중, gameover: 끝 */
export type Phase = 'play' | 'doubt' | 'gameover';

export type CheatAction =
  /** 지금 차례인 사람이 카드 1~4장을 '지금 숫자'라고 말하며 뒷면으로 낸다 */
  | { type: 'play'; cardIds: number[] }
  /** player가 '거짓말!'을 외친다 (doubters 맨 앞 사람만) */
  | { type: 'doubt'; player: number }
  /** player가 믿고 넘어간다 */
  | { type: 'pass'; player: number };

/** 화면 연출용: 마지막 행동에서 일어난 일들 */
export type GameEvent =
  | { id: number; type: 'deal'; first: number; counts: number[] }
  | { id: number; type: 'play'; player: number; count: number; rank: number; cardIds: number[] }
  | { id: number; type: 'pass'; player: number }
  | { id: number; type: 'accepted'; player: number }
  | { id: number; type: 'doubt'; doubter: number; claimant: number }
  | { id: number; type: 'reveal'; claimant: number; lie: boolean; cards: Card[]; rank: number }
  | { id: number; type: 'pickup'; player: number; count: number }
  | { id: number; type: 'win'; player: number };

export interface LogEntry {
  id: number;
  seat: SeatIndex | null;
  text: string;
}

export interface CheatState {
  players: Player[];
  options: CheatOptions;
  phase: Phase;
  /** 처음 낸 사람 */
  first: number;
  /** play: 낼 사람, doubt: 방금 낸 사람 */
  current: number;
  /** 다음에 내야 할 숫자 (1=A … 13=K). 카드를 낼 때마다 하나씩 올라가고 K 다음은 A */
  rank: number;
  /** 가운데 더미 (배열 끝이 맨 위) */
  pile: PileCard[];
  /** 의심받는 중인 카드 (doubt 단계) */
  claim: Claim | null;
  /** 아직 '거짓말!'을 외칠지 정하지 않은 사람들 (차례대로). 맨 앞 사람이 지금 정한다 */
  doubters: number[];
  /** 바로 앞에 낸 카드의 결말 */
  verdict: Verdict | null;
  /** 아무도 모르게 빼 둔 카드 (2명이거나 빨리 하기일 때) */
  aside: Card[];
  winner: number | null;
  /** 지금까지 낸 횟수 */
  plays: number;
  /** 행동할 사람이 바뀔 때마다 1씩 늘어난다 (화면에서 차례가 바뀐 것을 알려고) */
  turn: number;
  events: GameEvent[];
  nextEventId: number;
  log: LogEntry[];
  nextLogId: number;
}
