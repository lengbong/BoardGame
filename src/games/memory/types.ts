import type { SeatIndex, SeatKind, Seats } from '../common/players';

export type { SeatConfig, SeatIndex, SeatKind } from '../common/players';

/** 판 크기: 가로×세로가 아니라 "줄×칸" (4×6은 4줄 6칸) */
export type BoardSize = '4x4' | '4x6' | '6x6';

/** 카드 그림 묶음. mixed는 세 묶음에서 골고루 섞는다. */
export type ThemeId = 'animals' | 'food' | 'vehicles' | 'mixed';

export interface MemoryOptions {
  size: BoardSize;
  theme: ThemeId;
  /** 짝을 맞히면 한 번 더 */
  extraTurn: boolean;
  /** 시작할 때 몇 초 동안 모든 카드를 보여 준다 (어린아이용) */
  peek: boolean;
  /** 카드 앞면에 그림 이름을 작게 쓴다 */
  showNames: boolean;
}

export interface MemorySetup {
  seats: Seats;
  options: MemoryOptions;
}

export interface MemoryCard {
  /** 카드 번호 = 판 위의 자리 (0부터, 왼쪽 위에서 오른쪽으로) */
  id: number;
  /** 그림 id (예: 'a-rabbit'). 같은 그림이 정확히 두 장 있다. */
  pic: string;
  /** 짝을 찾은 사람 (players 인덱스). 아직이면 null */
  matchedBy: number | null;
}

export interface Player {
  seat: SeatIndex;
  kind: Exclude<SeatKind, 'empty'>;
  name: string;
  /** 모은 짝의 그림 id (찾은 순서대로) */
  pairs: string[];
}

/** 한 번이라도 앞면이 공개된 카드의 기록. 컴퓨터는 이것만 보고 기억한다. */
export interface SeenInfo {
  pic: string;
  /** 몇 번째 공개 때 보았는지 (state.reveals 값). 클수록 최근 */
  at: number;
  /** 시작할 때 잠깐 모두 보여 주기로 슬쩍 본 것 */
  glance?: boolean;
}

/** peek: 처음에 모두 보여 주는 중, play: 뒤집는 중, mismatch: 짝이 아닌 두 장이 잠깐 보이는 중 */
export type Phase = 'peek' | 'play' | 'mismatch' | 'gameover';

export type MemoryAction = { type: 'flip'; cardId: number } | { type: 'hide' } | { type: 'startPlay' };

/** 화면 연출용: 마지막 행동에서 일어난 일들 */
export type GameEvent =
  | { id: number; type: 'deal' }
  | { id: number; type: 'peekEnd' }
  | { id: number; type: 'flip'; player: number; cardId: number; pic: string }
  | { id: number; type: 'match'; player: number; cardIds: [number, number]; pic: string; again: boolean }
  | { id: number; type: 'mismatch'; player: number; cardIds: [number, number] }
  | { id: number; type: 'hide'; cardIds: number[] }
  | { id: number; type: 'turn'; player: number }
  | { id: number; type: 'end' };

export interface LogEntry {
  id: number;
  seat: SeatIndex | null;
  text: string;
}

export interface MemoryState {
  players: Player[];
  options: MemoryOptions;
  rows: number;
  cols: number;
  /** 판 위의 카드 (배열 순서 = 자리) */
  cards: MemoryCard[];
  /** 지금 앞면이 보이는 (아직 짝을 못 찾은) 카드. 0~2장 */
  faceUp: number[];
  /** 공개된 적 있는 카드 기록 (카드 id → 그림, 본 때). 짝을 찾은 카드는 지운다. */
  seen: Record<number, SeenInfo>;
  /** 지금까지 카드가 공개된 횟수 (시간 대신 쓴다) */
  reveals: number;
  current: number;
  phase: Phase;
  /** 차례가 다른 사람에게 넘어갈 때마다 1씩 늘어난다 */
  turn: number;
  /** 두 장 뒤집기를 새로 시작할 때마다 1씩 늘어난다 */
  attempt: number;
  /** 이번 차례에 연달아 맞힌 짝 수 */
  streak: number;
  /** gameover일 때 사람마다 등수 (1부터, 같은 수면 같은 등수) */
  ranks: number[];
  events: GameEvent[];
  nextEventId: number;
  log: LogEntry[];
  nextLogId: number;
}

export type Rng = () => number;
