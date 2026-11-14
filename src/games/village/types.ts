import type { SeatIndex, SeatKind, Seats } from '../common/players';

export type { SeatIndex, SeatKind } from '../common/players';
export type { Rng } from '../../lib/random';

/** 조각의 네 모서리: 0 북(위) · 1 동(오른쪽) · 2 남(아래) · 3 서(왼쪽) */
export type Side = 0 | 1 | 2 | 3;

/** 시계 방향으로 90°씩 돌린 횟수 */
export type Rot = 0 | 1 | 2 | 3;

/** 점수가 나는 지형: 길 · 냇물 · 논 */
export type FeatureKind = 'path' | 'stream' | 'paddy';

/** 모서리의 지형: 길 · 냇물 · 논둑 · 들 (들은 들끼리만 맞는다) */
export type EdgeKind = FeatureKind | 'field';

/**
 * 길이나 냇물이 조각 안에서 끝나는 곳.
 * 길: 초가집 · 원두막 · 장터 · 갈림길 · 빨래터 · 장승 / 냇물: 샘 · 연못
 */
export type EndKind = 'house' | 'hut' | 'market' | 'cross' | 'laundry' | 'jangseung' | 'spring' | 'pond';

/** 조각 그림 좌표 (0~100, 돌리기 전) */
export type Pt = readonly [number, number];

export interface VillageOptions {
  /** 장승 조각을 넣는다 (놓는 순간 이웃 지형 종류만큼 점수) */
  jangseung: boolean;
  /** 한 사람의 깃발 수 */
  flags: 4 | 6;
  /** 손에 드는 조각 수 (1장이면 빠른 게임) */
  hand: 1 | 2;
  /** 고른 조각을 놓을 수 있는 자리를 반짝여 보여 준다 */
  showSpots: boolean;
}

export interface VillageSetup {
  seats: Seats;
  options: VillageOptions;
}

/** 조각 위의 깃발: 그 조각의 몇 번째 지형(seg)에 누가 꽂았는지 */
export interface Flag {
  seg: number;
  player: number;
}

/** 지도에 놓인 조각 */
export interface Placed {
  /** 조각 종류 번호 (TILES의 차례) */
  t: number;
  x: number;
  y: number;
  r: Rot;
  flag: Flag | null;
  /** 놓은 사람 (처음 조각은 null) */
  by: number | null;
}

export interface PlayerStats {
  /** 놓은 조각 수 */
  tiles: number;
  /** 지형마다 얻은 점수 (완성) */
  path: number;
  stream: number;
  paddy: number;
  /** 장승으로 얻은 점수 */
  jangseung: number;
  /** 끝날 때 미완성 지형으로 얻은 점수 */
  final: number;
  /** 점수를 받은 완성 지형 수 */
  completed: number;
  /** 꽂은 깃발 수 */
  flagsPlanted: number;
}

export interface Player {
  seat: SeatIndex;
  kind: Exclude<SeatKind, 'empty'>;
  name: string;
  score: number;
  /** 손에 남은 깃발 */
  flags: number;
  /** 손에 든 조각 (모두에게 보인다) */
  hand: number[];
  stats: PlayerStats;
}

export type VillageAction =
  /** 손의 hand번째 조각을 (x, y)에 r만큼 돌려 놓는다 */
  | { type: 'place'; hand: number; x: number; y: number; r: Rot }
  /** 방금 놓은 조각의 seg번째 지형에 깃발을 꽂는다 */
  | { type: 'flag'; seg: number }
  /** 깃발을 꽂지 않는다 */
  | { type: 'skipFlag' }
  /** 손의 어느 조각도 놓을 곳이 없을 때: hand번째 조각을 버리고 새로 뽑는다 */
  | { type: 'discard'; hand: number };

/** 지형 하나를 이루는 조각 조각들: [지도의 조각 번호, 그 조각의 지형 번호] */
export type Node = readonly [number, number];

/** 화면 연출용: 마지막 행동에서 일어난 일 */
export type GameEvent =
  | { id: number; type: 'start'; first: number }
  | { id: number; type: 'place'; player: number; index: number }
  | { id: number; type: 'jangseung'; player: number; index: number; points: number; kinds: FeatureKind[] }
  | { id: number; type: 'flag'; player: number; index: number; seg: number }
  | { id: number; type: 'skipFlag'; player: number }
  | {
      id: number;
      type: 'complete';
      kind: FeatureKind;
      nodes: Node[];
      tiles: number;
      points: number;
      /** 점수를 받은 사람 (깃발이 없으면 빈 배열) */
      winners: number[];
      /** 돌아간 깃발 */
      returned: { index: number; seg: number; player: number }[];
    }
  | { id: number; type: 'discard'; player: number; t: number }
  | { id: number; type: 'pass'; player: number }
  | { id: number; type: 'final'; kind: FeatureKind; nodes: Node[]; tiles: number; points: number; winners: number[] }
  | { id: number; type: 'gameover'; winners: number[] };

export interface LogEntry {
  id: number;
  seat: SeatIndex | null;
  text: string;
}

/** 바로 앞 사람이 한 일 (차례 요약) */
export interface TurnSummary {
  player: number;
  t: number;
  flag: FeatureKind | null;
  /** 이번 차례에 점수를 얻은 사람들 (장승 포함) */
  gains: { player: number; points: number }[];
}

export type Phase = 'place' | 'flag' | 'gameover';

export interface VillageState {
  players: Player[];
  options: VillageOptions;
  /** 지도에 놓인 조각 (놓은 차례대로, 0번은 처음 조각) */
  board: Placed[];
  /** 뒤집어 쌓은 조각 더미 (배열 끝이 맨 위) */
  stack: number[];
  /** 놓을 곳이 없어서 버린 조각 */
  discarded: number[];
  phase: Phase;
  current: number;
  /** flag 단계: 방금 놓은 조각의 지도 번호 */
  placed: number | null;
  /** 차례가 바뀔 때마다 1씩 는다 (화면에서 고른 것을 지울 때) */
  turn: number;
  /** 지금까지 놓은 조각 수 (처음 조각 빼고) */
  moves: number;
  lastTurn: TurnSummary | null;
  /** 끝났을 때 1등 (같은 점수면 여럿) */
  winners: number[];
  events: GameEvent[];
  nextEventId: number;
  log: LogEntry[];
  nextLogId: number;
}
