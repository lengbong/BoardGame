import type { DuelKind, DuelSeats } from '../common/duel';

export type { DuelAiLevel, DuelKind } from '../common/duel';

/** 0 이상 1 미만의 수를 돌려주는 난수 함수 */
export type Rng = () => number;

/** 바다 크기: 10×10(기본) 또는 8×8(어린이용, 작은 함대) */
export type SeaSize = 8 | 10;

/** h: 가로(오른쪽으로 뻗음), v: 세로(아래로 뻗음) */
export type Dir = 'h' | 'v';

export type ShipKind = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';

/** 함대를 이루는 배 한 척의 종류 */
export interface ShipSpec {
  id: ShipKind;
  name: string;
  length: number;
}

/** 바다에 놓인 배. (x, y)는 맨 앞(왼쪽 또는 위쪽) 칸 */
export interface PlacedShip {
  id: ShipKind;
  x: number;
  y: number;
  dir: Dir;
}

/** cover: 사람이 2명이면 차례마다 화면을 가린다. open: 상대 배도 흐리게 보여 준다(배우기용). */
export type RevealMode = 'cover' | 'open';

export interface ShipsOptions {
  size: SeaSize;
  /** 배끼리 붙이지 않기 (대각선 포함) */
  noTouch: boolean;
  /** 맞히면 한 번 더 */
  extraTurn: boolean;
  reveal: RevealMode;
}

export interface ShipsSetup {
  seats: DuelSeats;
  options: ShipsOptions;
}

/** 한 칸에 쏜 결과: 0 아직 안 쏨, 1 빗나감(물보라), 2 명중 */
export type Mark = 0 | 1 | 2;
export const UNKNOWN: Mark = 0;
export const MISS: Mark = 1;
export const HIT: Mark = 2;

export type Side = 0 | 1;

export interface ShipsPlayer {
  kind: DuelKind;
  /** 화면에 보일 이름 (비워 두면 편 이름) */
  name: string;
  /** 내 배들 (상대에게는 숨긴 정보). 다 놓기 전에는 빈 배열 */
  fleet: PlacedShip[];
  /** 배를 다 놓았는지 */
  ready: boolean;
  /** 내가 상대 바다에 쏜 결과 (칸 번호 = y × 크기 + x) */
  marks: Mark[];
  /** 내가 쏜 칸들 (순서대로) */
  history: number[];
}

/** place: 사람이 배를 놓는 중, battle: 서로 쏘는 중, gameover: 끝 */
export type Phase = 'place' | 'battle' | 'gameover';

export type ShotResult = 'miss' | 'hit' | 'sunk';

export type ShipsAction = { type: 'place'; player: Side; fleet: PlacedShip[] } | { type: 'fire'; cell: number };

/** 화면 연출용: 마지막 행동에서 일어난 일들 */
export type ShipsEvent =
  | { id: number; type: 'placed'; player: Side }
  | { id: number; type: 'start' }
  | { id: number; type: 'shot'; shooter: Side; cell: number; result: ShotResult; ship: ShipKind | null; cells: number[] }
  | { id: number; type: 'extra'; player: Side }
  | { id: number; type: 'win'; player: Side };

export interface LogEntry {
  id: number;
  side: Side | null;
  text: string;
}

export interface ShipsState {
  options: ShipsOptions;
  players: [ShipsPlayer, ShipsPlayer];
  phase: Phase;
  /** place 단계에서 지금 배를 놓는 사람 */
  placing: Side | null;
  /** battle 단계에서 지금 쏘는 사람 */
  current: Side;
  /** 지금까지 쏜 횟수 (두 사람 합) */
  shots: number;
  winner: Side | null;
  events: ShipsEvent[];
  nextEventId: number;
  log: LogEntry[];
  nextLogId: number;
}

/**
 * 컴퓨터가 쏠 곳을 정할 때 받는 정보: 쏘는 사람이 아는 것만 담는다.
 * 상대 배가 어디 있는지는 들어 있지 않다 (가라앉아서 공개된 배만 있다).
 */
export interface Knowledge {
  size: number;
  noTouch: boolean;
  /** 내가 쏜 결과 (가라앉은 배 칸도 HIT) */
  marks: readonly Mark[];
  /** 가라앉아서 공개된 상대 배: 길이와 칸 */
  sunk: readonly { length: number; cells: readonly number[] }[];
  /** 아직 떠 있는 상대 배들의 길이 (함대 구성은 서로 알고 있다) */
  remaining: readonly number[];
}
