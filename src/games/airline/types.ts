import type { SeatIndex, SeatKind, Seats } from '../common/players';

export type { SeatIndex, SeatKind } from '../common/players';
export type { Rng } from '../../lib/random';

/** 합집합 타입의 각 갈래에서 키를 뺀다 */
export type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** 세계를 여섯 지역으로 나눈다 (광고는 지역마다, '여섯 지역 모두 취항' 목표) */
export type RegionId = 'eastasia' | 'seaoc' | 'southmid' | 'europe' | 'africa' | 'americas';

/**
 * 관광 성수기 모양.
 * flat: 일 년 내내 비슷, summer: 북반구 여름(3분기) 성수기, winter: 따뜻한 곳으로 가는 겨울(1·4분기) 성수기,
 * south: 남반구 여름(1·4분기) 성수기
 */
export type Season = 'flat' | 'summer' | 'winter' | 'south';

/** 도시 명소 그림 종류 (Art.tsx) */
export type Landmark =
  | 'tower'
  | 'lighthouse'
  | 'stone'
  | 'fuji'
  | 'castle'
  | 'gate'
  | 'orb'
  | 'junk'
  | 'tiered'
  | 'lion'
  | 'stupa'
  | 'twin'
  | 'monument'
  | 'church'
  | 'lantern'
  | 'splitgate'
  | 'opera'
  | 'sail'
  | 'surf'
  | 'coconut'
  | 'arch'
  | 'film'
  | 'elephant'
  | 'villa'
  | 'spire'
  | 'dhow'
  | 'peaks'
  | 'clock'
  | 'lattice'
  | 'skyline'
  | 'windmill'
  | 'alps'
  | 'colosseum'
  | 'cathedral'
  | 'basilica'
  | 'palace'
  | 'columns'
  | 'mosque'
  | 'pyramid'
  | 'giraffe'
  | 'gem'
  | 'tablemtn'
  | 'drum'
  | 'horseshoe'
  | 'statue'
  | 'palm'
  | 'bridge'
  | 'skyscraper'
  | 'flamingo'
  | 'maple'
  | 'needle'
  | 'sphere'
  | 'steppyramid'
  | 'coffee'
  | 'sugarloaf'
  | 'obelisk';

/** 도시 하나. 크기·공항은 1960·1970…2030년의 값이고 그 사이 해는 이어서 셈한다 */
export interface CityDef {
  id: string;
  name: string;
  country: string;
  region: RegionId;
  lat: number;
  lon: number;
  /** 경제·인구 크기 1~10 (10년마다 8개: 1960…2030) */
  size: readonly number[];
  /** 사업 손님 비중 0~1 */
  biz: number;
  /** 관광 매력 0~10 */
  fun: number;
  season: Season;
  /** 공항 등급 1~4 (10년마다 8개). 1 작은 공항 … 4 거대 공항 */
  airport: readonly number[];
  /** 공항 이용료 수준 1(싸다)~3(비싸다) */
  fee: 1 | 2 | 3;
  landmark: Landmark;
  desc: string;
}

/** 비행기 옆모습 종류 (Art.tsx에서 이 모양대로 그린다) */
export type BodyType =
  /** 날개 위 프로펠러 */
  | 'prop'
  /** 꼬리에 엔진 둘, T자 꼬리 (작은 제트) */
  | 'rearjet'
  /** 날개 아래 엔진 둘, 한 줄 통로 */
  | 'narrow'
  /** 꼬리에 엔진 셋, T자 꼬리 */
  | 'trijet'
  /** 날개 아래 엔진 넷, 한 줄 통로 */
  | 'quad'
  /** 두 줄 통로 큰 비행기 (엔진 수는 engines) */
  | 'wide'
  /** 두 줄 통로, 날개 둘 + 꼬리 위 엔진 하나 */
  | 'widetri'
  /** 앞쪽이 불룩한 점보 */
  | 'jumbo'
  /** 위아래 2층 */
  | 'double'
  /** 초음속 삼각 날개 */
  | 'sst';

/**
 * 실제 기종 (값은 모두 근삿값). 좌석은 흔한 2등급 배치, 값은 오늘 돈으로 어림한 억 원.
 * burn: 1km 나는 데 드는 연료(kg), hourCost: 1시간 운항에 드는 승무원·정비비(만 원)
 */
export interface ModelDef {
  id: string;
  name: string;
  maker: string;
  body: BodyType;
  engines: number;
  seats: number;
  /** 최대 항속 거리 (km) */
  range: number;
  /** 순항 속도 (km/h) */
  speed: number;
  /** 처음 운항한 해 (이 해부터 살 수 있다) */
  intro: number;
  /** 생산을 마친 해 (이 해까지 살 수 있다) */
  end: number;
  price: number;
  burn: number;
  hourCost: number;
  /** 내릴 수 있는 공항 등급 (이 등급 이상) */
  runway: 1 | 2 | 3 | 4;
  /** 편안함 1~5 */
  comfort: number;
  note: string;
}

/** 우리 회사 비행기 한 대 */
export interface Plane {
  id: number;
  model: string;
  leased: boolean;
  /** 리스기가 분기마다 내는 리스료 (억). 내 비행기는 0 */
  rent: number;
  /** 받은 분기 (q 번호). 나이 = (지금 q − since) / 4 년 */
  since: number;
  /** 배정된 노선 (없으면 null = 쉬는 중) */
  route: number | null;
  /** 한 주에 몇 번 왕복하는지 (노선이 없으면 0) */
  freq: number;
}

/** 노선 지난 분기 결과 (컴퓨터와 화면이 함께 본다) */
export interface RouteStats {
  /** 탑승률 0~1 */
  lf: number;
  /** 분기 손님 (양방향) */
  pax: number;
  revenue: number;
  profit: number;
  /** 적자가 이어진 분기 수 */
  lossStreak: number;
  /** 같은 두 도시를 나는 회사들 가운데 손님 비율 0~1 */
  share: number;
}

export interface Route {
  id: number;
  a: string;
  b: string;
  /** 운임 조정 (%) −30 … +30 */
  fare: number;
  /** 연 분기 */
  since: number;
  stats: RouteStats | null;
}

export type BusinessKind = 'hotel' | 'agency';

export interface Business {
  city: string;
  kind: BusinessKind;
  /** 지은 값 (가치 계산용) */
  cost: number;
}

export interface CompanyStats {
  /** 지금까지 태운 손님 */
  pax: number;
  /** 가장 많이 번 분기 이익 */
  bestProfit: number;
  /** 산 비행기 수 */
  bought: number;
  /** 연 노선 수 */
  opened: number;
  /** 흑자가 이어진 분기 수 */
  profitStreak: number;
}

export interface Company {
  seat: SeatIndex;
  kind: Exclude<SeatKind, 'empty'>;
  name: string;
  hub: string;
  cash: number;
  debt: number;
  /** 은행이 처음부터 믿어 주는 대출 한도 (시작 자금에 따라) */
  baseCredit: number;
  branches: string[];
  routes: Route[];
  planes: Plane[];
  /** 지역마다 분기 광고비 (억) */
  ads: Record<RegionId, number>;
  /** 지역마다 알려진 정도 0~1 (광고가 쌓인다) */
  awareness: Record<RegionId, number>;
  /** 기내 서비스 1~5 */
  service: number;
  /** 평판 0~100 */
  reputation: number;
  businesses: Business[];
  /** 파산해서 빠졌는지 */
  out: boolean;
  /** 돈이 모자란 채로 끝난 분기가 이어진 수 (2가 되면 파산) */
  crisis: number;
  stats: CompanyStats;
}

export type StartEra = 1963 | 1983 | 2003;
export type WinMode = 'goal' | 'years' | 'challenge';
export type MoneyLevel = 'rich' | 'normal' | 'tight';

export interface AirlineOptions {
  era: StartEra;
  mode: WinMode;
  /** 정해진 해까지: 몇 년 뒤에 끝나는지 */
  years: 10 | 20 | 30;
  /** 목표 먼저 이루기: 회사 가치 목표 (억) */
  goalValue: number;
  /** 목표 먼저 이루기: 취항해야 하는 지역 수 */
  goalRegions: number;
  money: MoneyLevel;
  /** 도전 과제 id (mode가 challenge일 때) */
  challenge: string | null;
}

export interface AirlineSetup {
  seats: Seats;
  options: AirlineOptions;
  /** 자리마다 고른 본사(허브) 도시. null이면 저절로 고른다 */
  hubs: (string | null)[];
}

/** 사건의 효과 (기한이 지나면 없어진다) */
export type Effect =
  | { id: number; kind: 'boom' | 'slump'; region: RegionId; mult: number; until: number }
  | { id: number; kind: 'tourism'; city: string; mult: number; until: number }
  | { id: number; kind: 'fair'; city: string; mult: number; until: number }
  | { id: number; kind: 'sale'; mult: number; until: number };

export type NewsTone = 'good' | 'bad' | 'info' | 'big';

export interface NewsItem {
  id: number;
  q: number;
  icon: string;
  title: string;
  text: string;
  tone: NewsTone;
  /** 관련 도시 (지도에서 보여 주기) */
  city?: string;
}

/** 회사 한 곳의 분기 손익 (억) */
export interface CompanyReport {
  ticket: number;
  side: number;
  fuel: number;
  crew: number;
  airport: number;
  service: number;
  /** 표 판매 수수료 */
  sales: number;
  /** 운항 중인 비행기 리스료·보험 */
  lease: number;
  /** 쉬는 비행기 리스료·보험·보관비 */
  fleet: number;
  /** 법인세 */
  tax: number;
  branch: number;
  ads: number;
  interest: number;
  /** 현금 이익 = 수입 − 비용 */
  profit: number;
  pax: number;
  seats: number;
  value: number;
  cash: number;
  debt: number;
  /** 돈이 모자라 저절로 빌린 돈 */
  autoLoan: number;
  /** 이번 분기에 파산했는지 */
  bankrupt: boolean;
  /** 지역마다 태운 손님 (지역에 닿은 노선) */
  regionPax: Record<RegionId, number>;
  /** 태평양을 건넌 손님 (도전 과제) */
  pacificPax: number;
  /** 관광지(관광 매력 8 이상)를 오간 손님 */
  resortPax: number;
  /** 콩코드 노선 이익 (도전 과제) */
  sstProfit: number;
  /** 본사 도시를 오간 손님 */
  hubPax: number;
}

export interface RouteReport {
  company: number;
  route: number;
  a: string;
  b: string;
  pax: number;
  seats: number;
  revenue: number;
  cost: number;
  profit: number;
}

export interface QuarterReport {
  q: number;
  companies: CompanyReport[];
  /** 모든 회사의 노선 결과 (가장 좋은·나쁜 노선 보기) */
  routes: RouteReport[];
  /** 이번 분기에 생긴 뉴스 id */
  news: number[];
}

/** 그래프용 분기 기록 */
export interface HistoryPoint {
  q: number;
  value: number[];
  profit: number[];
  pax: number[];
}

export interface GameResult {
  /** 이긴 회사들 (도전 과제를 실패하면 빈 배열) */
  winners: number[];
  reason: string;
  /** 도전 과제: 성공했는지 */
  success?: boolean;
}

export interface ChallengeProgress {
  id: string;
  /** 도전하는 회사 */
  company: number;
  /** 끝나는 분기 (q) */
  deadline: number;
  /** 지금까지의 진행 글 */
  progress: string;
  /** 0~1 */
  ratio: number;
  /** 흑자·조건이 이어진 분기 수 */
  streak: number;
  /** 시작할 때 회사 가치 */
  startValue: number;
}

export type AirlineAction =
  | { type: 'openBranch'; city: string }
  | { type: 'closeBranch'; city: string }
  | { type: 'openRoute'; a: string; b: string }
  | { type: 'closeRoute'; route: number }
  | { type: 'buy'; model: string }
  | { type: 'lease'; model: string }
  | { type: 'sell'; plane: number }
  /** route가 null이면 쉬게 한다 */
  | { type: 'assign'; plane: number; route: number | null; freq: number }
  | { type: 'setFreq'; plane: number; freq: number }
  | { type: 'setFare'; route: number; fare: number }
  | { type: 'setAds'; region: RegionId; amount: number }
  | { type: 'setService'; level: number }
  | { type: 'borrow'; amount: number }
  | { type: 'repay'; amount: number }
  | { type: 'build'; city: string; kind: BusinessKind }
  | { type: 'sellBusiness'; city: string; kind: BusinessKind }
  | { type: 'endTurn' };

/** 화면 연출용: 마지막 행동에서 일어난 일 */
export type GameEvent =
  | { id: number; type: 'start' }
  | { id: number; type: 'branch'; company: number; city: string }
  | { id: number; type: 'route'; company: number; a: string; b: string }
  | { id: number; type: 'closeRoute'; company: number; a: string; b: string }
  | { id: number; type: 'plane'; company: number; model: string; leased: boolean }
  | { id: number; type: 'sell'; company: number; model: string; amount: number }
  | { id: number; type: 'assign'; company: number; route: number }
  | { id: number; type: 'money'; company: number; amount: number; what: 'borrow' | 'repay' }
  | { id: number; type: 'build'; company: number; city: string; kind: BusinessKind }
  | { id: number; type: 'turn'; company: number }
  | { id: number; type: 'quarter'; q: number }
  | { id: number; type: 'bankrupt'; company: number }
  | { id: number; type: 'gameover' };

export interface LogEntry {
  id: number;
  seat: SeatIndex | null;
  text: string;
}

export type Phase = 'manage' | 'gameover';

export interface AirlineState {
  options: AirlineOptions;
  /** 시작한 해 */
  startYear: number;
  /** 지금 분기 번호 = 해 × 4 + (분기 − 1) */
  q: number;
  /** 시작한 분기 번호 */
  startQ: number;
  phase: Phase;
  companies: Company[];
  /** 이번 분기에 경영하는 순서 (회사 번호) */
  order: number[];
  /** order에서 지금 몇 번째인지 */
  turnPos: number;
  /** 유가 지수 (1이 보통) */
  oil: number;
  /** 대출 금리 (연 %) */
  rate: number;
  effects: Effect[];
  /** 공항 확장으로 늘어난 슬롯 비율 (도시마다, 0.3 = 30%) */
  slotBoost: Record<string, number>;
  news: NewsItem[];
  history: HistoryPoint[];
  report: QuarterReport | null;
  nextId: number;
  result: GameResult | null;
  challenge: ChallengeProgress | null;
  events: GameEvent[];
  nextEventId: number;
  log: LogEntry[];
  nextLogId: number;
}
