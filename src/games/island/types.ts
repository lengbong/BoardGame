import type { SeatIndex, SeatKind, Seats } from '../common/players';

export type { SeatIndex, SeatKind } from '../common/players';
export type { Rng } from '../../lib/random';

/** 자원 네 가지: 나무, 돌, 곡식, 물고기 */
export type Resource = 'wood' | 'stone' | 'grain' | 'fish';

/** 자원마다 몇 개인지 (손에 든 것, 짓는 값 등) */
export type ResourceCount = Record<Resource, number>;

/** 땅 종류: 숲 → 나무, 돌산 → 돌, 밭 → 곡식, 갯벌·어장 → 물고기, 등대 언덕은 아무것도 나지 않는다 */
export type Terrain = 'forest' | 'rock' | 'field' | 'shore' | 'hill';

/** 지을 수 있는 것 */
export type BuildKind = 'road' | 'house' | 'hall' | 'lighthouse';

/** 모서리에 선 건물 (등대는 건물 위에 따로 기록한다) */
export interface Building {
  owner: number;
  type: 'house' | 'hall';
}

export type TargetPoints = 8 | 10 | 12;

export interface IslandOptions {
  /** 이 점수를 먼저 모으면 (자기 차례가 끝날 때) 승리 */
  target: TargetPoints;
  /** 장터: 앞면으로 놓인 자원 4개 중 하나와 차례마다 한 번 바꾸기 */
  market: boolean;
  /** 초보 도움: 지을 수 있는 자리 반짝임, 추천 자리, 모자란 자원 알려 주기 */
  helper: boolean;
  /**
   * 풍년 규칙: 두 눈과 같은 숫자의 땅이 모두 자원을 낸다 (빨리 끝난다).
   * 끄면(기본) 골라 쓰는 주사위: 굴린 사람이 두 눈 중 하나를 골라 그 숫자만 자원을 낸다.
   */
  harvest: boolean;
}

export interface IslandSetup {
  seats: Seats;
  options: IslandOptions;
}

export interface PlayerStats {
  /** 주사위로 얻은 자원 수 */
  produced: number;
  /** 은행·장터에서 바꾼 횟수 */
  trades: number;
  /** 손 제한 때문에 내려놓은 자원 수 */
  discarded: number;
  /** 놓은 길 수 */
  roads: number;
}

export interface Player {
  seat: SeatIndex;
  kind: Exclude<SeatKind, 'empty'>;
  name: string;
  res: ResourceCount;
  stats: PlayerStats;
}

/**
 * setup: 처음 집과 길 놓기 (뱀 순서), roll: 주사위를 굴릴 차례, choose: 두 눈 중 쓸 눈 고르기,
 * main: 짓기·바꾸기, discard: 차례를 마칠 때 9개가 넘어서 내려놓는 중, gameover: 끝
 */
export type Phase = 'setup' | 'roll' | 'choose' | 'main' | 'discard' | 'gameover';

export type IslandAction =
  /** 짓기. setup 단계에서는 집(무료)과 길(무료)을 번갈아 놓는다 */
  | { type: 'build'; kind: BuildKind; at: number }
  /** 주사위 굴리기 (dice가 있으면 그 눈으로: 테스트용) */
  | { type: 'roll'; dice?: [number, number] }
  /** 골라 쓰는 주사위: dice[die]의 숫자만 자원을 낸다 */
  | { type: 'choose'; die: 0 | 1 }
  /** 은행: give를 3개(등대가 있으면 2개) 주고 get 1개 */
  | { type: 'bank'; give: Resource; get: Resource }
  /** 장터: 내 give 1개와 장터 slot번째 자원을 맞바꾼다 (차례마다 한 번) */
  | { type: 'market'; give: Resource; slot: number }
  /** 차례 마치기 */
  | { type: 'endTurn' }
  /** 9개가 넘을 때 내려놓기 (모두 합쳐 discardNeed개) */
  | { type: 'discard'; res: ResourceCount };

/** 자원을 받은 기록: 어느 땅에서 어느 모서리의 누구에게 몇 개 */
export interface Gain {
  hex: number;
  corner: number;
  player: number;
  res: Resource;
  amount: number;
}

/** 화면 연출용: 마지막 행동에서 일어난 일들 */
export type GameEvent =
  | { id: number; type: 'start'; first: number }
  /** hexes: 바로 자원을 내는 칸 (고르기를 기다리면 빈 배열) */
  | { id: number; type: 'roll'; player: number; dice: [number, number]; hexes: number[] }
  | { id: number; type: 'choose'; player: number; die: 0 | 1; number: number; hexes: number[] }
  | { id: number; type: 'produce'; gains: Gain[] }
  | { id: number; type: 'startGain'; player: number; gains: Gain[] }
  | { id: number; type: 'build'; player: number; kind: BuildKind; at: number; points: number }
  | { id: number; type: 'bank'; player: number; give: Resource; count: number; get: Resource }
  | { id: number; type: 'market'; player: number; give: Resource; get: Resource; slot: number }
  | { id: number; type: 'flag'; player: number; from: number | null }
  | { id: number; type: 'discard'; player: number; count: number }
  | { id: number; type: 'turn'; player: number }
  | { id: number; type: 'win'; player: number; byLimit: boolean };

export interface LogEntry {
  id: number;
  seat: SeatIndex | null;
  text: string;
}

export interface IslandState {
  players: Player[];
  options: IslandOptions;
  /** 땅 칸마다 종류 (board.ts의 HEXES 순서) */
  terrain: Terrain[];
  /** 땅 칸마다 숫자 1~6 (등대 언덕은 0) */
  numbers: number[];
  /** 모서리마다 건물 (board.ts의 CORNERS 순서) */
  buildings: (Building | null)[];
  /** 변마다 길 주인 (board.ts의 EDGES 순서) */
  roads: (number | null)[];
  /** 사람마다 등대를 세운 모서리 (없으면 null) */
  lighthouses: (number | null)[];
  /** 장터에 앞면으로 놓인 자원 (장터를 끄면 빈 배열) */
  market: Resource[];
  phase: Phase;
  current: number;
  /** 처음 집·길 놓는 순서 (뱀 순서: 0 1 2 3 3 2 1 0) */
  setupOrder: number[];
  /** setupOrder에서 지금 몇 번째인지 */
  setupStep: number;
  /** 방금 놓은 처음 집 (길은 여기에 붙여야 한다). null이면 집을 놓을 차례 */
  setupHouse: number | null;
  /** 이번 차례에 굴린 주사위 (아직 안 굴렸으면 null) */
  dice: [number, number] | null;
  /** 골라 쓴 눈 (0·1). 같은 눈이거나 풍년 규칙이면 null */
  chosenDie: 0 | 1 | null;
  /** 이번 차례에 장터를 썼는지 */
  marketUsed: boolean;
  /** 이번 차례에 은행과 바꾼 횟수 (컴퓨터가 끝없이 바꾸지 않게) */
  bankTrades: number;
  /** 바다 축제 깃발을 가진 사람 */
  flagHolder: number | null;
  /** discard 단계에서 내려놓아야 하는 수 */
  discardNeed: number;
  winner: number | null;
  /** 차례가 한 바퀴 돌 때마다 1씩 (1부터) */
  round: number;
  /** 행동할 사람이 바뀔 때마다 1씩 늘어난다 */
  turn: number;
  events: GameEvent[];
  nextEventId: number;
  log: LogEntry[];
  nextLogId: number;
}
