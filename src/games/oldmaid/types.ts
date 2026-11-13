import type { Card } from '../common/playingCards';
import type { SeatIndex, SeatKind, Seats } from '../common/players';

export type { Card } from '../common/playingCards';
export type { SeatIndex, SeatKind } from '../common/players';
export type { Rng } from '../../lib/random';

/** cover: 사람이 2명 이상이면 차례마다 손패를 가린다. open: 모든 손패를 보여 준다 (배우기용). */
export type HandView = 'cover' | 'open';

export interface OldMaidOptions {
  handView: HandView;
}

export interface OldMaidSetup {
  seats: Seats;
  options: OldMaidOptions;
}

export interface Player {
  seat: SeatIndex;
  kind: Exclude<SeatKind, 'empty'>;
  name: string;
  /** 손에 든 순서 그대로 (다른 사람은 이 순서대로 뒷면을 보고 뽑는다) */
  hand: Card[];
  /** 카드를 다 털어서 빠진 순서 (1부터). 아직이면 0 */
  place: number;
}

/** deal: 카드를 나눠 준 직후 (짝 버리기 전), play: 뽑기, gameover: 끝 */
export type Phase = 'deal' | 'play' | 'gameover';

export type OldMaidAction =
  /** 모두 손에 든 짝을 버린다 (나눠 준 직후 한 번) */
  | { type: 'discardPairs' }
  /**
   * 다음 사람 손패의 index번째 카드를 뽑는다.
   * shuffle이면 뽑은 뒤 내 손패를 섞는다 (컴퓨터). jokerSpot(0~1)이 있으면 섞은 뒤 조커를 그 자리쯤에 둔다.
   */
  | { type: 'draw'; index: number; shuffle?: boolean; jokerSpot?: number }
  /** player가 자기 손패를 섞는다 */
  | { type: 'shuffle'; player: number };

/** 화면 연출용: 마지막 행동에서 일어난 일들 */
export type GameEvent =
  | { id: number; type: 'deal'; first: number }
  | { id: number; type: 'pairs'; player: number; cards: Card[] }
  | { id: number; type: 'draw'; player: number; from: number; index: number; card: Card }
  | { id: number; type: 'pair'; player: number; cards: Card[] }
  | { id: number; type: 'shuffle'; player: number }
  | { id: number; type: 'out'; player: number; place: number }
  | { id: number; type: 'thief'; player: number };

export interface LastDraw {
  player: number;
  from: number;
  cardId: number;
  paired: boolean;
}

export interface LogEntry {
  id: number;
  seat: SeatIndex | null;
  text: string;
}

export interface OldMaidState {
  players: Player[];
  options: OldMaidOptions;
  phase: Phase;
  /** 처음 뽑는 사람 */
  first: number;
  current: number;
  /** 차례가 바뀔 때마다 1씩 늘어난다 */
  turn: number;
  /** 버린 짝 (모두 공개). 배열 끝이 맨 위 */
  discard: Card[];
  /** 카드를 다 털어서 빠진 사람 (빠진 순서) */
  finished: number[];
  /** 마지막까지 조커를 든 사람 = 도둑 */
  thief: number | null;
  /**
   * 조커가 지금 누구 손패의 몇 번째에 있는지 '본 것으로' 아는 사람들.
   * 조커를 뽑아 간 자리는 모두가 보므로, 조커를 내준 사람·뽑은 사람과 원래 알던 사람은 계속 안다.
   * 조커를 든 사람이 손패를 섞으면 그 사람만 남는다. (컴퓨터는 이것만 보고 판단한다: 몰래 보지 않기)
   */
  jokerKnownBy: number[];
  /** 사람마다 남의 손패에서 뽑은 위치 기록 [왼쪽, 가운데, 오른쪽] 횟수 (모두가 볼 수 있는 정보) */
  picks: number[][];
  lastDraw: LastDraw | null;
  events: GameEvent[];
  nextEventId: number;
  log: LogEntry[];
  nextLogId: number;
}
