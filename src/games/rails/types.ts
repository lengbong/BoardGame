import type { SeatIndex, SeatKind, Seats } from '../common/players';

export type { SeatIndex, SeatKind } from '../common/players';
export type { Rng } from '../../lib/random';

/** 기차표 여섯 색 */
export type TicketColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';
/** 손에 드는 표: 여섯 색 + 만능 고속열차표 */
export type CardKind = TicketColor | 'wild';
/** 기찻길 색: 여섯 색 + 회색(아무 한 색으로나 깔 수 있음) */
export type RouteColor = TicketColor | 'gray';
/** 표 종류마다 몇 장 들고 있는지 */
export type Hand = Record<CardKind, number>;

export interface CityDef {
  id: string;
  name: string;
  x: number;
  y: number;
  /** 이름표를 도시 점의 어느 쪽에 쓸지 */
  label: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
}

export type StampIcon = 'tower' | 'peak' | 'wave' | 'mask' | 'temple' | 'hanok' | 'beach' | 'volcano';

/** 관광 도장: 그 도시에 처음 기찻길을 이은 사람이 큰 도장을 받는다 */
export interface StampDef {
  city: string;
  name: string;
  icon: StampIcon;
}

export interface RouteDef {
  id: number;
  a: string;
  b: string;
  length: number;
  color: RouteColor;
  /** 배 노선 (제주로 가는 바닷길) */
  sea?: boolean;
  /** 길을 살짝 휘게 그리는 정도 (그림용) */
  bend?: number;
}

export interface PlanDef {
  id: number;
  a: string;
  b: string;
  points: number;
}

/** cover: 사람이 2명 이상이면 차례마다 가린다. open: 모두 공개 (배우기용) */
export type HandView = 'cover' | 'open';
/** kids: 처음 계획 카드를 2장만 보고 1장 이상 가진다. basic: 3장 보고 2장 이상 */
export type PlanStart = 'kids' | 'basic';
export type TrainCount = 30 | 40;

export interface RailsOptions {
  handView: HandView;
  planStart: PlanStart;
  stamps: boolean;
  trains: TrainCount;
}

export interface RailsSetup {
  seats: Seats;
  options: RailsOptions;
}

export interface StampMark {
  city: string;
  /** 그 도시에 가장 먼저 와서 큰 도장(+3)을 받았는지 */
  first: boolean;
}

export interface Player {
  seat: SeatIndex;
  kind: Exclude<SeatKind, 'empty'>;
  name: string;
  hand: Hand;
  /** 가지고 있는 여행 계획 (비밀) */
  plans: number[];
  /** 남은 기차 칸 */
  trains: number;
  /** 깐 기찻길 */
  routes: number[];
  routePoints: number;
  stamps: StampMark[];
  stampPoints: number;
}

/** 여행 계획을 고르는 중 */
export interface PlanOffer {
  player: number;
  plans: number[];
  /** 적어도 몇 장을 가져야 하는지 */
  minKeep: number;
  /** 게임 시작 때 고르는 것인지 */
  initial: boolean;
}

/** 끝났을 때 한 사람의 점수 */
export interface FinalScore {
  player: number;
  routes: number;
  plansDone: number[];
  plansFailed: number[];
  /** 이룬 계획 점수 - 못 이룬 계획 점수 */
  planPoints: number;
  stamps: number;
  /** 가장 큰 기찻길 묶음에 닿은 도시 수 */
  tourCities: number;
  /** 전국 일주 상 (0 또는 TOUR_BONUS) */
  tour: number;
  total: number;
}

/** plans: 여행 계획 고르기, play: 보통 차례, gameover: 끝 */
export type Phase = 'plans' | 'play' | 'gameover';

export type RailsAction =
  /** 보여 준 계획 중 가질 것 */
  | { type: 'keepPlans'; keep: number[] }
  /** 창구(앞면 5장)에서 한 장 */
  | { type: 'take'; from: 'window'; index: number }
  /** 더미 맨 위에서 한 장 */
  | { type: 'take'; from: 'deck' }
  /** 기찻길 깔기: color 표 (length - wilds)장 + 만능표 wilds장 */
  | { type: 'claim'; route: number; color: TicketColor | null; wilds: number }
  | { type: 'drawPlans' }
  /** 아무것도 할 수 없을 때만 */
  | { type: 'pass' };

/** 화면 연출용: 마지막 행동에서 일어난 일들 */
export type GameEvent =
  | { id: number; type: 'deal' }
  | { id: number; type: 'take'; player: number; from: 'window' | 'deck'; index: number; card: CardKind }
  | { id: number; type: 'refill'; index: number; card: TicketColor | null }
  | { id: number; type: 'reshuffle'; count: number }
  | { id: number; type: 'claim'; player: number; route: number; points: number; paid: CardKind[] }
  | { id: number; type: 'stamp'; player: number; city: string; first: boolean; points: number }
  | { id: number; type: 'planDone'; player: number; plan: number }
  | { id: number; type: 'planOffer'; player: number; count: number }
  | { id: number; type: 'planKeep'; player: number; kept: number; returned: number; initial: boolean }
  | { id: number; type: 'finalRound'; player: number }
  | { id: number; type: 'pass'; player: number }
  | { id: number; type: 'gameover'; reason: 'trains' | 'stuck' };

export interface LogEntry {
  id: number;
  seat: SeatIndex | null;
  text: string;
}

export interface RailsState {
  players: Player[];
  options: RailsOptions;
  phase: Phase;
  /** 처음 차례인 사람 */
  first: number;
  /** 지금 차례 (plans 단계면 고르는 사람) */
  current: number;
  /** 표 더미 (0번이 맨 위) */
  deck: CardKind[];
  /** 버린 표 (더미가 비면 섞어서 다시 쓴다) */
  discard: CardKind[];
  /** 창구에 펼쳐 둔 5장 (만능표는 절대 놓이지 않는다) */
  window: (TicketColor | null)[];
  /** 여행 계획 더미 (0번이 맨 위) */
  planDeck: number[];
  offer: PlanOffer | null;
  /** 시작 때 계획을 아직 고르지 않은 사람 수 (자기 포함) */
  setupLeft: number;
  /** 이번 차례에 이미 받은 표 수 (0 또는 1) */
  drawn: number;
  /** 기찻길마다 깐 사람 (없으면 null) */
  owners: (number | null)[];
  /** 도장 도시마다 큰 도장을 받은 사람 */
  stampFirst: Record<string, number | null>;
  /** 마지막 바퀴: 남은 차례 수 (아직이면 null) */
  finalTurns: number | null;
  finalBy: number | null;
  /** 연달아 넘긴 횟수 */
  passes: number;
  /** 더미를 다시 섞을 때 쓰는 난수 씨앗 (상태만으로 다음 일이 정해지게) */
  seed: number;
  /** 행동할 사람이 바뀔 때마다 1씩 (화면에서 차례가 바뀐 것을 알려고) */
  turn: number;
  /** 지금까지 끝난 차례 수 */
  turnsPlayed: number;
  results: FinalScore[] | null;
  winners: number[];
  events: GameEvent[];
  nextEventId: number;
  log: LogEntry[];
  nextLogId: number;
}
