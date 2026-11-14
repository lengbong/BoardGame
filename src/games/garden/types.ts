import type { SeatIndex, SeatKind, Seats } from '../common/players';

export type { SeatIndex, SeatKind } from '../common/players';
export type { Rng } from '../../lib/random';

/** 네 가지 자원: 물, 햇빛, 씨앗, 거름 */
export type Res = 'water' | 'sun' | 'seed' | 'compost';
/** 텃밭 토큰: 자원 4가지 + 아무 자원 대신 쓰는 꿀벌 */
export type Token = Res | 'bee';

export type ResCount = Record<Res, number>;
export type TokenCount = Record<Token, number>;

/** 식물 종류: 꽃, 채소, 나무, 약초 */
export type Kind = 'flower' | 'veggie' | 'tree' | 'herb';

/** 1 봄 · 2 여름 · 3 가을 */
export type Season = 1 | 2 | 3;

/** 심자마자 한 번 받는 덤: 물뿌리개(💧2), 새집(🐝1), 허수아비(채소마다 1점) */
export type Bonus = 'water2' | 'bee' | 'scarecrow';

/** 식물 그림 모양 (PlantArt.tsx) */
export type ArtShape =
  | 'star'
  | 'bell'
  | 'puff'
  | 'violet'
  | 'tulip'
  | 'daffodil'
  | 'leafy'
  | 'pod'
  | 'sprig'
  | 'blossomTree'
  | 'sunflower'
  | 'hydrangea'
  | 'trumpet'
  | 'rose'
  | 'vine'
  | 'fruitVeg'
  | 'corn'
  | 'spike'
  | 'fruitTree'
  | 'daisy'
  | 'mum'
  | 'spider'
  | 'cabbage'
  | 'root'
  | 'pumpkin'
  | 'roundTree'
  | 'fanTree'
  | 'mapleTree';

export interface PlantArt {
  shape: ArtShape;
  /** 꽃·열매 색 */
  color: string;
  /** 두 번째 색 (꽃술, 잎 끝 등) */
  accent?: string;
}

export interface PlantCard {
  id: number;
  name: string;
  kind: Kind;
  season: Season;
  /** 심는 데 드는 자원 */
  cost: ResCount;
  /** 심은 뒤 영원히 만들어 주는 자원 1개 (다음 식물 값을 1 깎아 준다) */
  produce: Res;
  /** 꽃 점수 */
  points: number;
  bonus?: Bonus;
  art: PlantArt;
}

/** 박람회 상장 */
export type GoalId = 'flowers4' | 'trees3' | 'allKinds' | 'sameRes4' | 'veggieHerb' | 'seasons' | 'autumn3' | 'big7';

export interface Ribbon {
  goal: GoalId;
  /** 처음 이룬 사람 (아직 없으면 null) */
  owner: number | null;
}

/** 텃밭의 줄: 가로 r0~r2, 세로 c0~c2 */
export type LineId = 'r0' | 'r1' | 'r2' | 'c0' | 'c1' | 'c2';

export type TargetScore = 12 | 15 | 18;

export interface GardenOptions {
  /** 이 점수에 먼저 닿으면 그 라운드를 마치고 끝 */
  target: TargetScore;
  /** 시장 끝 두 장은 떨이 (자원 1개 덜 내기) */
  sale: boolean;
  /** 박람회 상장 3개 */
  ribbons: boolean;
}

export interface GardenSetup {
  seats: Seats;
  options: GardenOptions;
}

export interface Player {
  seat: SeatIndex;
  kind: Exclude<SeatKind, 'empty'>;
  name: string;
  tokens: TokenCount;
  /** 심은 식물 (심은 순서) */
  garden: number[];
  /** 온실에 맡겨 둔 식물 (최대 2장, 모두에게 보임) */
  greenhouse: number[];
  /** 허수아비 같은 덤으로 얻은 점수 */
  bonusPoints: number;
}

/** play: 행동 고르기, discard: 바구니가 넘쳐서 돌려놓기, gameover: 끝 */
export type Phase = 'play' | 'discard' | 'gameover';

export type GardenAction =
  /** 텃밭의 가로줄 또는 세로줄 토큰을 모두 가져온다 */
  | { type: 'harvest'; line: LineId }
  /** 꽃시장이나 내 온실의 식물을 심는다. discount: 떨이로 덜 낼 자원 (없으면 가장 좋은 쪽) */
  | { type: 'plant'; cardId: number; discount?: Res }
  /** 꽃시장 식물을 내 온실에 맡기고 꿀벌 1마리를 받는다 */
  | { type: 'reserve'; cardId: number }
  /** 바구니가 10개를 넘으면 넘친 만큼 주머니에 돌려놓는다 */
  | { type: 'discard'; tokens: Partial<TokenCount> }
  /** 할 수 있는 일이 하나도 없을 때만 쉰다 */
  | { type: 'pass' };

/** 화면 연출용: 마지막 행동에서 일어난 일 */
export type GameEvent =
  | { id: number; type: 'harvest'; player: number; line: LineId; cells: number[]; tokens: Token[] }
  | { id: number; type: 'refill'; cells: number[] }
  | { id: number; type: 'plant'; player: number; cardId: number; from: 'market' | 'greenhouse'; slot: number; paid: TokenCount; saleUsed: Res | null }
  | { id: number; type: 'reserve'; player: number; cardId: number; slot: number; bee: boolean }
  | { id: number; type: 'gain'; player: number; tokens: Partial<TokenCount>; reason: 'water2' | 'bee' }
  | { id: number; type: 'points'; player: number; amount: number; reason: 'plant' | 'scarecrow' | 'ribbon' }
  | { id: number; type: 'ribbon'; player: number; goal: GoalId }
  | { id: number; type: 'enter'; cardId: number }
  | { id: number; type: 'wilt'; cardId: number }
  | { id: number; type: 'discard'; player: number; tokens: Partial<TokenCount> }
  | { id: number; type: 'pass'; player: number }
  | { id: number; type: 'endTriggered'; player: number }
  | { id: number; type: 'round'; round: number }
  | { id: number; type: 'gameover'; winners: number[] };

export interface LogEntry {
  id: number;
  seat: SeatIndex | null;
  text: string;
}

export interface GardenState {
  players: Player[];
  options: GardenOptions;
  phase: Phase;
  /** 처음 하는 사람 (라운드는 이 사람부터 시작한다) */
  first: number;
  current: number;
  /** 1부터 */
  round: number;
  /** 행동할 사람이 바뀔 때마다 1씩 늘어난다 */
  turn: number;
  /** 텃밭 3×3 (가로줄 순서, 빈칸 null) */
  field: (Token | null)[];
  /** 주머니에 남은 토큰 수 */
  bag: TokenCount;
  /** 벌통에 남은 꿀벌 */
  hive: number;
  /** 식물 더미 (맨 앞이 맨 위) */
  deck: number[];
  /** 꽃시장 줄: 맨 앞이 들어오는 곳, 맨 끝이 나가는 곳(떨이) */
  market: number[];
  /** 시들어 버린 식물 */
  wilted: number[];
  ribbons: Ribbon[];
  /** 누군가 목표 점수에 닿아서 이번 라운드가 마지막 */
  endTriggered: boolean;
  /** 잇달아 쉰 횟수 (모두 쉬면 끝) */
  passes: number;
  winners: number[];
  events: GameEvent[];
  nextEventId: number;
  log: LogEntry[];
  nextLogId: number;
}
