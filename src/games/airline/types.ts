import type { SeatIndex, SeatKind, Seats } from '../common/players';
import type { RightsAction, RightsBook, RightsEvent, RightsMode } from './rightsTypes';

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
  | 'obelisk'
  | 'onion';

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
  /** 같은 계열 (조종사 자격·부품을 함께 쓴다: 정비·승무원비 할인) */
  family: string;
  note: string;
  /** 화물기 한 편에 싣는 짐 (톤). 여객기는 없음 (배 아래 짐칸은 cargo.ts에서 따로 셈한다) */
  cargo?: number;
  /** 화물기의 바탕이 된 여객기 (그림) */
  base?: string;
}

/** 사업 모델: 풀서비스·저가항공·화물 전문 (bizmodel.ts) */
export type BizModel = 'full' | 'lcc' | 'cargo';

/** 일반석 앞뒤 간격: 0 촘촘, 1 보통, 2 넓게 */
export type Pitch = 0 | 1 | 2;

/** 비행기 한 대의 좌석 배치 (일반석 수는 남은 자리와 간격으로 정해진다: cabin.ts) */
export interface Cabin {
  first: number;
  business: number;
  pitch: Pitch;
}

/** 우리 회사 비행기 한 대 */
export interface Plane {
  id: number;
  model: string;
  leased: boolean;
  /** 리스기가 분기마다 내는 리스료 (억). 내 비행기는 0 */
  rent: number;
  /** 리스 보증금 (억). 돌려줄 때 돌려받는다. 내 비행기는 0 */
  deposit: number;
  /** 받은 달 (t 번호). 나이 = (지금 t − since) / 12 년 */
  since: number;
  /** 띄우는 노선들 (한 대가 비행시간 안에서 여러 노선을 난다). 비면 쉬는 중 */
  legs: Leg[];
  /** 좌석 배치 */
  cabin: Cabin;
  /** 기내식 1~5 */
  meal: number;
  /** 우리 회사에 온 달 (이 달에는 좌석 배치를 공짜로 바꾼다). 없으면 since */
  got?: number;
  /** 기체 상태 0~100% (condition.ts). 없으면 80 (예전 저장) */
  cond?: number;
  /** 이 달(t)에 C점검을 받는다 (그달은 날지 않고, 끝나면 상태가 돌아온다) */
  check?: number;
}

/** 비행기 한 대가 한 노선을 한 주에 몇 번 왕복하는지 */
export interface Leg {
  route: number;
  freq: number;
}

/** 새 비행기 주문 (값은 주문할 때 내고, due 달에 받는다) */
export interface Order {
  id: number;
  model: string;
  due: number;
  price: number;
}

/** 중고 비행기 시장의 매물 */
export interface UsedPlane {
  id: number;
  model: string;
  /** 매물로 나온 때의 나이 (년) */
  age: number;
  price: number;
  /** 매물로 나온 달 */
  listed: number;
  /** 판 회사 (파산한 회사 등) */
  from?: string;
}

/** 회사에만 걸리는 효과 (결정 사건 등). until 달 전까지 */
export type ModKind = 'crew' | 'fuelHedge' | 'fuel' | 'demand' | 'service' | 'sales' | 'slot' | 'discount' | 'subsidy';

export interface Mod {
  id: number;
  kind: ModKind;
  value: number;
  until: number;
  label: string;
  city?: string;
  region?: RegionId;
  model?: string;
  /** demand: 사업·관광 중 하나에만 */
  seg?: 'biz' | 'leisure';
}

export type ChoiceEffect =
  | { kind: 'cash'; amount: number }
  | { kind: 'rep'; amount: number }
  | { kind: 'mod'; mod: Omit<Mod, 'id'> }
  | { kind: 'awareness'; region: RegionId; amount: number }
  | { kind: 'alliance'; with: number }
  | { kind: 'order'; model: string; discount: number }
  /** 운항 인력(조종사·객실 승무원) 임금 수준 더하기 */
  | { kind: 'pay'; amount: number }
  | { kind: 'morale'; amount: number }
  | { kind: 'academy' };

export interface ChoiceOption {
  label: string;
  /** 고르면 생기는 일 (미리 보여 준다) */
  desc: string;
  effects: ChoiceEffect[];
  /** 고르는 데 드는 현금 (모자라면 못 고른다) */
  cost: number;
  /** 컴퓨터가 보는 좋아 보이는 정도 */
  ai: number;
}

/** 회사에 온 결정 사건 */
export interface Choice {
  id: number;
  scenario: string;
  icon: string;
  title: string;
  text: string;
  options: ChoiceOption[];
  /** 제휴 제안을 한 회사 */
  from?: number;
}

export type GoalKind = 'lf' | 'profit4' | 'region' | 'routes' | 'pax' | 'value' | 'fleet' | 'xfer';

/** 연간 목표 */
export interface YearGoal {
  kind: GoalKind;
  target: number;
  text: string;
  reward: { cash: number; rep: number };
  /** null: 아직, true/false: 해가 끝나고 매긴 결과 */
  done: boolean | null;
}

/** 올해 쌓은 숫자 (목표·평가용) */
export interface YearAcc {
  year: number;
  pax: number;
  seats: number;
  xfer: number;
  revenue: number;
  profit: number;
  profitQ: number;
  /** 이번 분기에 쌓은 이익 (분기가 끝나면 profitQ를 센다) */
  qProfit: number;
  quarters: number;
  bought: number;
  startValue: number;
  startRegions: number;
  startRoutes: number;
  /** 지난해 손님 (손님 목표용) */
  lastPax: number;
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface Review {
  year: number;
  grade: Grade;
  text: string;
  met: number;
  total: number;
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
  /** 이 노선에 탄 갈아타는 손님 (한 방향 주간) */
  xfer: number;
  /** 갈아타는 손님에게 받은 주간 수입 (억) */
  xferRev: number;
  /** 고급 좌석(일등·비즈니스) 탑승률 0~1 (고급 좌석이 없으면 없음) */
  premLf?: number;
  /** 제때 뜬 비율 0~1 (결항은 빼고 센다) */
  onTime: number;
  /** 결항 비율 0~1 */
  cancel: number;
  /** 최근 열두 달 [탑승률, 이익] (그래프) */
  hist: [number, number][];
  /** 등급마다 [일등석, 비즈니스석, 일반석]: 한 방향 주간 손님·좌석, 달 수입 (classes.ts) */
  cls?: ClassSplit;
  /** 화물: 한 방향 주간 톤·실을 수 있는 톤, 달 수입 */
  cargo?: { t: number; cap: number; rev: number };
}

/** 등급마다 [일등석, 비즈니스석, 일반석] 손님·좌석(한 방향 주간)과 수입 */
export interface ClassSplit {
  pax: [number, number, number];
  seats: [number, number, number];
  rev: [number, number, number];
}

export interface Route {
  id: number;
  a: string;
  b: string;
  /** 일반석 운임 조정 (%) −30 … +30 */
  fare: number;
  /** 비즈니스석·일등석·화물 운임 조정 (%) −30 … +30 (없으면 0) */
  fareC?: number;
  fareF?: number;
  fareK?: number;
  /** 연 달 */
  since: number;
  stats: RouteStats | null;
  /** 주간 운항을 나누는 시간대 비율 [아침, 낮, 저녁, 밤] (합이 0보다 큰 정수) */
  times: [number, number, number, number];
}

/** 연료 탱크 (fuel.ts) */
export interface FuelTank {
  /** 탱크 단계 0~5 (0: 탱크 없음) */
  level: number;
  /** 사 둔 연료 (톤) */
  stock: number;
  /** 사 둔 연료의 평균 단가 (유가 지수) */
  avg: number;
  /** 자동으로 사기: 유가가 '보통 값' × 이 비율 아래면 채운다 (null: 끄기) */
  auto: number | null;
}

/** 공항 시설 (facilities.ts): 라운지·정비 기지·전용 터미널 */
export type FacilityKind = 'lounge' | 'base' | 'terminal';

export interface Facility {
  city: string;
  kind: FacilityKind;
  /** 지은 값 (가치 계산·되팔기) */
  cost: number;
}

/** 부대사업 (business.ts) */
export type BusinessKind = 'hotel' | 'agency' | 'bus' | 'restaurant' | 'store' | 'resort' | 'ski' | 'park';

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
  /** 지역마다 달 광고비 (억) */
  ads: Record<RegionId, number>;
  /** 지역마다 알려진 정도 0~1 (광고가 쌓인다) */
  awareness: Record<RegionId, number>;
  /** 지역마다 광고 매체 (없으면 TV) */
  adMedia?: Record<RegionId, AdMedia>;
  /** 마지막으로 캠페인을 벌인 달 (한 분기에 하나) */
  lastCampaign?: number;
  /** 기내식 기본값 1~5 (새 비행기에 쓰고, 바꾸면 모든 비행기에 한꺼번에) */
  service: number;
  /** 평판 0~100 */
  reputation: number;
  businesses: Business[];
  /** 파산해서 빠졌는지 */
  out: boolean;
  /** 돈이 모자란 채로 끝난 분기가 이어진 수 (2가 되면 파산) */
  crisis: number;
  stats: CompanyStats;
  /** 주문해서 기다리는 새 비행기 */
  orders: Order[];
  /** 회사에만 걸린 효과 */
  mods: Mod[];
  /** 아직 고르지 않은 결정 사건 */
  choice: Choice | null;
  /** 다음 결정 사건이 올 달 */
  nextChoiceT: number;
  /** 예전 1:1 제휴(코드셰어) 상대. 이제는 동맹(AirlineState.alliances)을 쓰고 늘 null이다 (예전 저장은 불러올 때 옮긴다) */
  partner: number | null;
  /** 올해 목표 */
  goals: YearGoal[];
  /** 올해 쌓은 숫자 */
  acc: YearAcc;
  /** 해마다 받은 경영 평가 */
  reviews: Review[];
  /** 이번 달에 바로 받은 비행기 수 (리스 + 중고) */
  taken: number;
  /** 마지막으로 제휴를 제안한 달 */
  lastProposal: number;
  /** 정비 수준 1~5 (3이 보통). 높을수록 돈이 들지만 지연·결항·기체 점검이 준다 */
  maint: number;
  /** 예비 승무원 0~2 (없음·조금·넉넉). 승무원비가 늘지만 지연·결항이 준다 */
  crewReserve: number;
  /** 최근 석 달 정시 운항률 (평판·손님에 영향) */
  onTime: number;
  /** 직원 (그룹마다) */
  staff: Record<StaffGroup, StaffState>;
  /** 조직 만족도 0~100 */
  morale: number;
  /** 우리 훈련원 (조종사·승무원·정비사 학교) */
  academy: boolean;
  /** 내보내기·파업으로 생긴 서운함 (만족도를 깎고 달마다 줄어든다) */
  shock: number;
  /** 실제 항공사 id (realAirlines.ts). 가상 항공사면 null */
  airline: string | null;
  /** 회사 색 (실제 항공사의 칠 색에서 고른 것). null이면 자리 색 */
  color: string | null;
  /** 연료 탱크 (없으면 탱크 없음) */
  fuel?: FuelTank;
  /** C점검 시점: 기체 상태가 이 아래로 내려가면 점검한다 (없으면 50) */
  checkAt?: number;
  /** 공항 시설 (없으면 없음) */
  facilities?: Facility[];
  /** 마지막으로 증자한 달 */
  lastIssue?: number;
  /** 다른 회사에 인수되어 합쳐졌으면 그 회사 번호 (out도 true) */
  mergedInto?: number;
  /** 사업 모델 (풀서비스·저가항공·화물 전문) */
  bizModel: BizModel;
  /** 바꾸는 중인 사업 모델 (t 달에 바뀐다) */
  bizModelNext?: { model: BizModel; t: number } | null;
}

/** 광고 매체 (ads.ts) */
export type AdMedia = 'tv' | 'newspaper' | 'magazine' | 'radio' | 'internet';
/** 캠페인 (ads.ts) */
export type CampaignKind = 'sale' | 'miles' | 'lucky' | 'star';
/** 직원 그룹: 조종사·객실 승무원·정비사·지상직 */
export type StaffGroup = 'pilot' | 'cabin' | 'tech' | 'ground';

export interface StaffState {
  /** 지금 일하는 사람 */
  have: number;
  /** 임금 수준 (시장 = 1, 0.8~1.3) */
  pay: number;
  /** 뽑는 중 (ready 달부터 일한다) */
  pipe: { n: number; ready: number }[];
}

/** 운항 시간대: 아침(06–10)·낮(10–16)·저녁(16–21)·밤(21–02) */
export type Band = 0 | 1 | 2 | 3;

/** 컴퓨터 성향: 느긋 / 보통 / 치열 */
export type AiStyle = 'relaxed' | 'normal' | 'fierce';

/** 항공사 이름: 실제 항공사 / 가상 항공사 */
export type NameMode = 'real' | 'fictional';

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
  /** 컴퓨터 성향 */
  aiStyle: AiStyle;
  /** 항공사 이름 */
  names: NameMode;
  /** 실제 역사 (냉전·국교·석유 파동·9·11·코로나…). 없으면 켜짐 */
  history?: boolean;
  /** 운수권·항공 협정 (rights.ts). 없으면 끄기 (예전 저장) */
  rights?: RightsMode;
}

export interface AirlineSetup {
  seats: Seats;
  options: AirlineOptions;
  /** 자리마다 고른 본사(허브) 도시. null이면 저절로 고른다 */
  hubs: (string | null)[];
  /** 자리마다 고른 실제 항공사 id (실제 항공사 모드). null이면 저절로 고른다 */
  airlines: (string | null)[];
  /** 자리마다 고른 사업 모델. null이면 풀서비스 (컴퓨터는 저절로) */
  models?: (BizModel | null)[];
}

/** 사건의 효과 (until 달이 되면 없어진다) */
export type Effect =
  | { id: number; kind: 'boom' | 'slump'; region: RegionId; mult: number; until: number }
  | { id: number; kind: 'tourism'; city: string; mult: number; until: number }
  | { id: number; kind: 'fair'; city: string; mult: number; until: number }
  | { id: number; kind: 'sale'; mult: number; until: number }
  /** 온 세계 손님 배수 (9·11·코로나 같은 큰 사건). until 달이 되면 없어진다 */
  | { id: number; kind: 'world'; mult: number; until: number };

export type NewsTone = 'good' | 'bad' | 'info' | 'big';

export interface NewsItem {
  id: number;
  /** 소식이 난 달 */
  t: number;
  icon: string;
  title: string;
  text: string;
  tone: NewsTone;
  /** 관련 도시 (지도에서 보여 주기) */
  city?: string;
  /** 특히 이 회사들에게 중요한 소식 (라이벌 진입 등) */
  for?: number[];
  /** 소식의 주인공 회사 (사진·배지) */
  company?: number;
}

/** 회사 한 곳의 한 기간(달·분기·해) 손익 (억) */
export interface CompanyReport {
  /** 운항 수입 = 여객 운임 + 화물 + 부가 수입 */
  ticket: number;
  /** 그 가운데 화물 수입 (배 아래 짐칸 + 화물기) */
  cargo: number;
  /** 그 가운데 부가 수입 (저가항공의 짐·좌석 지정·기내 판매) */
  ancillary: number;
  /** 실은 화물·실을 수 있던 화물 (톤, 양방향) */
  cargoT: number;
  cargoCap: number;
  /** 일등석·비즈니스석 손님 (양방향)과 그 운임 수입 */
  paxF: number;
  paxC: number;
  revF: number;
  revC: number;
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
  /** 우리 노선에서 갈아탄 손님 (출발지–도착지 기준) */
  xferPax: number;
  /** 뜬 편수 (한 방향 한 번이 한 편) */
  flights: number;
  /** 늦게 뜬 편 */
  late: number;
  /** 결항한 편 */
  cancelled: number;
  /** 다른 공항으로 돌아간 편 */
  diverted: number;
  /** 지연·결항 보상과 돌아간 비행 비용 */
  disrupt: number;
  /** 직원 임금·뽑는 중 사람·초과 근무·훈련원 */
  staff: number;
  /** 일손이 모자라 결항한 편 */
  staffCancelled: number;
  /** 이번 달 파업이 있었는지 */
  strike: boolean;
  /** 쓴 연료 (톤) */
  fuelTons?: number;
  /** 그 가운데 탱크에서 꺼내 쓴 연료 (톤) */
  tankUsed?: number;
  /** 탱크 연료 덕분에 아낀 돈 (그달 값에 견주어, 억. 비싸게 사 두었으면 음수) */
  tankSaved?: number;
  /** C점검을 받은 비행기 수 */
  checks?: number;
  /** C점검 값 (억, '운항 수당·정비 부품'에 들어 있다) */
  checkCost?: number;
  /** 전세기로 다녀온 의뢰 수와 보수 (보수는 부대 수입에 들어 있다) */
  charters?: number;
  charterRev?: number;
  /** 정시 운항률 (결항은 빼고 뜬 편 가운데 제때 뜬 비율) */
  onTime: number;
  /** 경영 평가 (4분기 결산에만) */
  review?: Review;
  /** 연간 목표 결과 (4분기 결산에만) */
  goals?: YearGoal[];
}

/** 갈아타는 손님 기록: 출발지 a에서 via를 거쳐 b로 */
export interface TransferReport {
  via: string;
  a: string;
  b: string;
  /** 분기 손님 (양방향) */
  pax: number;
  /** 두 구간을 나른 회사들 */
  companies: number[];
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

/** 운항 현장 사건 (이번 달, 노선마다) */
export interface OpsIncident {
  company: number;
  route: number;
  a: string;
  b: string;
  flights: number;
  late: number;
  cancelled: number;
  diverted: number;
  /** 기체 점검으로 쉰 비행기 수 */
  grounded: number;
  /** 큰 원인: 날씨(typhoon·snow·monsoon·fog·storm)·tech(기체)·crew(승무원)·congestion(혼잡)·staff(인력 부족) */
  cause: string;
  /** 날씨가 원인일 때 그 도시 */
  city?: string;
}

/** 한 기간(달·분기·해)의 결산 */
export interface QuarterReport {
  /** 그 기간이 든 분기 */
  q: number;
  /** 그 기간의 마지막 달 */
  t: number;
  /** 몇 달 치 (1·3·12) */
  span: number;
  companies: CompanyReport[];
  /** 모든 회사의 노선 결과 (가장 좋은·나쁜 노선 보기) */
  routes: RouteReport[];
  /** 이번 분기에 생긴 뉴스 id */
  news: number[];
  /** 갈아타는 손님이 많은 연결 (많은 순, 일부) */
  xfers: TransferReport[];
  /** 운항 현장 사건 (달 결산에만, 큰 것부터 일부) */
  ops: OpsIncident[];
}

/** 그래프용 달 기록 */
export interface MonthPoint {
  t: number;
  oil: number;
  value: number[];
  profit: number[];
  revenue: number[];
  pax: number[];
  /** 탑승률 */
  lf: number[];
  /** 정시 운항률 */
  onTime: number[];
  /** 직원 수 */
  staff: number[];
}

/** 한 해 결산 (회사마다 열두 달 합) */
export interface YearReport {
  year: number;
  companies: CompanyReport[];
}

/** 항공 동맹 (alliances.ts) */
export interface Alliance {
  id: number;
  name: string;
  /** 회사 번호 (둘~셋) */
  members: number[];
  /** 만든 달 */
  since: number;
}

/** 전세기 의뢰 (charters.ts) */
export interface CharterOffer {
  id: number;
  /** 출발지와 도착지 (왕복) */
  a: string;
  b: string;
  pax: number;
  /** 보수 (억) */
  pay: number;
  title: string;
  icon: string;
  /** 올라온 달 */
  listed: number;
  /** 이 달까지 맡을 수 있다 */
  expires: number;
  /** 맡은 회사·비행기·나는 달 */
  by?: number;
  plane?: number;
  t?: number;
}

/** 연말 시상식 (awards.ts) */
export type AwardKind = 'airline' | 'punctual' | 'service' | 'growth' | 'hub';

export interface Award {
  kind: AwardKind;
  company: number;
  /** 상을 정한 값 (정시율·평판·성장률·환승 손님·점수) */
  value: number;
  /** 짧은 까닭 ('정시 운항률 91%') */
  text: string;
}

export interface AwardYear {
  year: number;
  items: Award[];
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
  /** 끝나는 달 (t, 그 분기의 마지막 달) */
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
  /** 새 비행기 주문 (인도까지 1~4분기) */
  | { type: 'buy'; model: string }
  | { type: 'cancelOrder'; order: number }
  | { type: 'lease'; model: string }
  | { type: 'buyUsed'; listing: number }
  | { type: 'sell'; plane: number }
  /** 이 노선의 주간 왕복 수를 정한다 (0이면 이 노선에서 뺀다). route가 null이면 모든 노선에서 뺀다 */
  | { type: 'assign'; plane: number; route: number | null; freq: number }
  | { type: 'choose'; option: number }
  | { type: 'propose'; to: number }
  | { type: 'endAlliance' }
  /** 운임 조정. cls가 없으면 일반석, c 비즈니스석·f 일등석·k 화물 */
  | { type: 'setFare'; route: number; fare: number; cls?: 'c' | 'f' | 'k' }
  /** 사업 모델 바꾸기 (돈이 들고 몇 달 뒤에 바뀐다. 지금 모델을 고르면 바꾸기를 그만둔다) */
  | { type: 'setBizModel'; model: BizModel }
  | { type: 'setAds'; region: RegionId; amount: number }
  | { type: 'setMedia'; region: RegionId; media: AdMedia }
  | { type: 'campaign'; kind: CampaignKind; region?: RegionId }
  /** 기내식 기본값: 모든 비행기에 한꺼번에 */
  | { type: 'setService'; level: number }
  /** 비행기 좌석 배치 (all이면 같은 기종 모두) */
  | { type: 'setCabin'; plane: number; cabin: Cabin; all?: boolean }
  /** 비행기 기내식 (all이면 같은 기종 모두) */
  | { type: 'setMeal'; plane: number; level: number; all?: boolean }
  /** 정비 수준 1~5 */
  | { type: 'setMaint'; level: number }
  /** 예비 승무원 0~2 */
  | { type: 'setCrewReserve'; level: number }
  /** 직원 뽑기 (fast: 서둘러 — 비싸지만 한 달 빨리) */
  | { type: 'hire'; group: StaffGroup; n: number; fast: boolean }
  /** 직원 내보내기 (석 달 치 임금, 만족도가 떨어진다) */
  | { type: 'fire'; group: StaffGroup; n: number }
  /** 임금 수준 0.8~1.3 */
  | { type: 'setPay'; group: StaffGroup; level: number }
  | { type: 'buildAcademy' }
  /** 노선 시간대 나누기 [아침, 낮, 저녁, 밤] */
  | { type: 'setTimes'; route: number; times: [number, number, number, number] }
  | { type: 'borrow'; amount: number }
  | { type: 'repay'; amount: number }
  | { type: 'build'; city: string; kind: BusinessKind }
  /** 연료 탱크를 한 단계 키운다 */
  | { type: 'buildTank' }
  /** 연료를 지금 값으로 사서 탱크에 담는다 (톤) */
  | { type: 'buyFuel'; tons: number }
  /** 사 둔 연료를 그달 값의 90%에 판다 (톤) */
  | { type: 'sellFuel'; tons: number }
  /** 자동으로 사기 (보통 값에 견준 비율, null이면 끄기) */
  | { type: 'setFuelAuto'; ratio: number | null }
  /** 이 비행기를 이번 달 C점검에 보내거나(on) 점검을 다음으로 미룬다 */
  | { type: 'checkPlane'; plane: number; on: boolean }
  /** C점검 시점 (기체 상태 %) */
  | { type: 'setCheckAt'; at: number }
  /** 전세기 의뢰를 이 쉬는 비행기로 맡는다 (이번 달에 다녀온다) */
  | { type: 'charter'; offer: number; plane: number }
  /** 주식: 다른 회사 주식 사기·팔기 (%), 증자, 과반을 가진 회사 인수 */
  | { type: 'buyStake'; company: number; pct: number }
  | { type: 'sellStake'; company: number; pct: number }
  | { type: 'issueShares' }
  | { type: 'merge'; company: number }
  /** 공항 시설 짓기·팔기 */
  | { type: 'buildFacility'; city: string; kind: FacilityKind }
  | { type: 'sellFacility'; city: string; kind: FacilityKind }
  | { type: 'sellBusiness'; city: string; kind: BusinessKind }
  /** 운수권 신청 (rightsTypes.ts) */
  | RightsAction
  | { type: 'endTurn' };

/** 화면 연출용: 마지막 행동에서 일어난 일 */
export type GameEvent =
  | { id: number; type: 'start' }
  | { id: number; type: 'branch'; company: number; city: string }
  | { id: number; type: 'route'; company: number; a: string; b: string }
  | { id: number; type: 'closeRoute'; company: number; a: string; b: string }
  | { id: number; type: 'plane'; company: number; model: string; leased: boolean }
  | { id: number; type: 'order'; company: number; model: string; due: number }
  | { id: number; type: 'choice'; company: number; option: number }
  | { id: number; type: 'alliance'; company: number; with: number; ok: boolean }
  | { id: number; type: 'sell'; company: number; model: string; amount: number }
  | { id: number; type: 'assign'; company: number; route: number }
  | { id: number; type: 'cabin'; company: number; plane: number; cost: number }
  | { id: number; type: 'campaign'; company: number; kind: CampaignKind }
  | { id: number; type: 'money'; company: number; amount: number; what: 'borrow' | 'repay' }
  | { id: number; type: 'build'; company: number; city: string; kind: BusinessKind }
  | { id: number; type: 'fuel'; company: number; tons: number; what: 'buy' | 'sell' | 'tank' }
  | { id: number; type: 'check'; company: number; plane: number; on: boolean }
  | { id: number; type: 'facility'; company: number; city: string; kind: FacilityKind }
  | { id: number; type: 'charter'; company: number; offer: number }
  | { id: number; type: 'stock'; company: number; target: number; what: 'buy' | 'sell' | 'issue' | 'merge' }
  | { id: number; type: 'turn'; company: number }
  | { id: number; type: 'month'; t: number }
  | { id: number; type: 'quarter'; q: number }
  | { id: number; type: 'bankrupt'; company: number }
  | RightsEvent
  | { id: number; type: 'gameover' };

export interface LogEntry {
  id: number;
  seat: SeatIndex | null;
  text: string;
}

export type Phase = 'manage' | 'gameover';

export interface AirlineState {
  /** 저장 형식 판 (2·3판 저장은 4판으로 바꿔 읽는다) */
  version: 4;
  options: AirlineOptions;
  /** 시작한 해 */
  startYear: number;
  /** 지금 달 번호 = 해 × 12 + (달 − 1). 한 차례가 한 달 */
  t: number;
  /** 시작한 달 */
  startT: number;
  /** 지금 분기 번호 = 해 × 4 + (분기 − 1) (늘 floor(t / 3)) */
  q: number;
  /** 시작한 분기 번호 */
  startQ: number;
  phase: Phase;
  companies: Company[];
  /** 이번 달에 경영하는 순서 (회사 번호) */
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
  /** 중고 비행기 시장 */
  market: UsedPlane[];
  /** 이미 알린 가격 경쟁 (회사|회사|두 도시) */
  priceWars: string[];
  news: NewsItem[];
  /** 분기 기록 (그래프) */
  history: HistoryPoint[];
  /** 달 기록 (그래프) */
  months: MonthPoint[];
  /** 지난달 결산 */
  report: QuarterReport | null;
  /** 지난 분기 결산 (석 달 합) */
  qReport: QuarterReport | null;
  /** 최근 달 결산들 (달별 손익표, 최근 24달) */
  ledger: QuarterReport[];
  /** 해마다 결산 */
  years: YearReport[];
  /** 해마다 연말 시상식 (예전 저장에는 없다) */
  awards?: AwardYear[];
  /** 전세기 의뢰 게시판 (예전 저장에는 없다) */
  charters?: CharterOffer[];
  /** 항공 동맹 (예전 저장에는 없다: 1:1 제휴는 불러올 때 동맹으로 옮긴다) */
  alliances?: Alliance[];
  /** 주식 (stocks.ts): stakes[i][j] = 회사 i의 주식 가운데 회사 j가 가진 몫 (%). 없으면 아무도 안 가졌다 */
  stakes?: number[][];
  /** 운수권 장부 (예전 저장에는 없다: rights.ts) */
  rights?: RightsBook;
  nextId: number;
  result: GameResult | null;
  challenge: ChallengeProgress | null;
  events: GameEvent[];
  nextEventId: number;
  log: LogEntry[];
  nextLogId: number;
}
