import type { DuelKind, DuelSeats } from '../common/duel';

export type { DuelAiLevel, DuelKind } from '../common/duel';
export type { Rng } from '../../lib/random';

/** 0 = 먼저 치는 편 (초, 왼쪽 자리), 1 = 나중에 치는 편 (말) */
export type Side = 0 | 1;

/** 비밀 숫자 자릿수 */
export type CodeLength = 3 | 4;

/** duel: 둘이서 서로의 숫자 맞히기, solo: 혼자서 컴퓨터가 숨긴 숫자 맞히기 */
export type GameMode = 'duel' | 'solo';

export interface BaseballOptions {
  mode: GameMode;
  length: CodeLength;
  /** 0도 쓸 수 있다 (끄면 1~9만) */
  zero: boolean;
  /** 먼저 친 사람이 맞히면 나중 사람에게도 한 번 더 기회 (둘 다 맞히면 무승부) */
  fairFinish: boolean;
  /** 추리 도우미: 남은 후보 수, 앞 결과와 맞지 않는 숫자 알림, 아웃·홈런 숫자 자동 메모 */
  helper: boolean;
}

export interface BaseballSetup {
  /** solo에서는 0번 자리 이름만 쓴다 */
  seats: DuelSeats;
  options: BaseballOptions;
}

/** 한 번 친 숫자와 결과 */
export interface Guess {
  digits: number[];
  strikes: number;
  balls: number;
}

/** 숫자 메모: 0 모름, 1 있다(○), 2 없다(✕) */
export type NoteMark = 0 | 1 | 2;

export interface BaseballPlayer {
  kind: DuelKind;
  name: string;
  /** 내가 숨긴 숫자 (상대에게는 비밀). 아직 안 정했으면 null. solo의 사람은 늘 null */
  secret: number[] | null;
  /** 내가 상대 숫자를 맞히려고 친 숫자들 (모두에게 공개) */
  guesses: Guess[];
  /** 0~9 숫자 메모 (길이 10) */
  notes: NoteMark[];
}

/** secret: 사람이 비밀 숫자를 정하는 중, play: 번갈아 맞히기, gameover: 끝 */
export type Phase = 'secret' | 'play' | 'gameover';

export type BaseballAction =
  | { type: 'secret'; player: Side; digits: number[] }
  | { type: 'guess'; digits: number[] }
  | { type: 'note'; player: Side; digit: number; mark: NoteMark }
  /** 혼자 맞히기에서 답 보기 */
  | { type: 'giveUp' };

/** 화면 연출용: 마지막 행동에서 일어난 일들 */
export type GameEvent =
  | { id: number; type: 'secret'; player: Side }
  | { id: number; type: 'start' }
  | { id: number; type: 'guess'; player: Side; index: number; strikes: number; balls: number }
  /** 먼저 친 사람이 맞혀서 나중 사람에게 마지막 기회 */
  | { id: number; type: 'lastChance'; player: Side }
  | { id: number; type: 'homerun'; player: Side }
  | { id: number; type: 'end'; winner: Side | null }
  | { id: number; type: 'giveUp' };

export interface LogEntry {
  id: number;
  side: Side | null;
  text: string;
}

export interface BaseballState {
  options: BaseballOptions;
  players: [BaseballPlayer, BaseballPlayer];
  phase: Phase;
  /** secret 단계에서 지금 숫자를 정하는 사람 */
  setting: Side | null;
  /** play 단계에서 지금 치는 사람 (solo는 늘 0) */
  current: Side;
  /** 나중 사람의 마지막 기회 중인지 */
  lastChance: boolean;
  /** 맞힌 사람 (맞힌 순서) */
  hits: Side[];
  /** gameover일 때 이긴 쪽. null이면 무승부 (solo에서 답을 본 경우도 null) */
  winner: Side | null;
  /** solo에서 답 보기를 눌렀다 */
  gaveUp: boolean;
  events: GameEvent[];
  nextEventId: number;
  log: LogEntry[];
  nextLogId: number;
}
