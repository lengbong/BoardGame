import { CITY, airportClass, citySize } from './cities';
import { checkCost } from './condition';
import { yearOf } from './time';
import type { AirlineState, Company, Facility, FacilityKind, Plane } from './types';

/**
 * 공항 시설 (Airline Club·AirlineSim처럼): 지점이 있는 공항에 짓는다.
 * - 라운지: 그 도시를 오가는 노선의 사업 손님이 우리를 더 고르고, 그 도시에서 갈아타는 손님이 늘고, 평판이 조금 오른다
 * - 정비 기지: C점검이 싸지고 정비고 자리가 늘며 비행기가 덜 닳는다 (할인은 한 곳만, 자리는 곳마다)
 * - 전용 터미널: 그 공항 슬롯이 늘고 붐빔이 덜하며, 갈아타는 시간이 짧아진다 (큰 공항만)
 */
export interface FacilityInfo {
  name: string;
  icon: string;
  desc: string;
  /** 짓는 값 (억) */
  cost: (size: number) => number;
  /** 달 유지비 (억) */
  upkeep: (size: number) => number;
  /** 지을 수 있는 공항 등급 (이 등급 이상) */
  minAirport: number;
}

export const FACILITY_KINDS: readonly FacilityKind[] = ['lounge', 'base', 'terminal'];

export const FACILITY_INFO: Record<FacilityKind, FacilityInfo> = {
  lounge: {
    name: '라운지',
    icon: '🛋️',
    desc: '이 도시를 오가는 노선의 사업 손님 +6%, 여기서 갈아타는 사업 손님 +10%, 평판 +1 (라운지 세 곳까지)',
    cost: (s) => Math.round(18 + 4 * s),
    upkeep: (s) => Math.round((0.8 + 0.15 * s) * 10) / 10,
    minAirport: 2,
  },
  base: {
    name: '정비 기지',
    icon: '🛠️',
    desc: 'C점검 값 −35%, 정비고 자리 +2, 모든 비행기가 10% 덜 닳아요 (할인은 한 곳만, 자리는 곳마다)',
    cost: (s) => Math.round(110 + 6 * s),
    upkeep: () => 3,
    minAirport: 2,
  },
  terminal: {
    name: '전용 터미널',
    icon: '🏛️',
    desc: '이 공항 슬롯 +25%, 붐빔으로 생기는 지연이 줄고, 갈아타는 시간이 짧아져 환승 손님이 늘어요',
    cost: (s) => Math.round(70 + 28 * s),
    upkeep: (s) => Math.round((1.5 + 0.45 * s) * 10) / 10,
    minAirport: 3,
  },
};

/** 시설을 팔면 지은 값의 이만큼 */
export const FACILITY_REFUND = 0.5;

/** 라운지 하나가 그 도시 노선의 사업 손님에게 주는 배수 */
export const LOUNGE_BIZ = 1.06;
/** 라운지가 있는 곳에서 갈아타는 사업 손님 배수 */
export const LOUNGE_XFER = 1.1;
/** 전용 터미널의 슬롯 배수 */
export const TERMINAL_SLOTS = 1.25;
/** 전용 터미널이 있는 곳에서 갈아타는 시간 (보통 2시간) */
export const TERMINAL_XFER_HOURS = 1.2;
/** 정비 기지가 있으면 C점검 값 배수, 닳는 빠르기 배수, 늘어나는 정비고 자리 */
export const BASE_CHECK = 0.65;
export const BASE_WEAR = 0.9;
export const BASE_SLOTS = 2;

export const facilitiesOf = (c: Company): readonly Facility[] => c.facilities ?? [];

export const hasFacility = (c: Company, city: string, kind: FacilityKind): boolean => facilitiesOf(c).some((f) => f.city === city && f.kind === kind);

export const countFacility = (c: Company, kind: FacilityKind): number => facilitiesOf(c).filter((f) => f.kind === kind).length;

export function facilityCost(city: string, kind: FacilityKind, q: number): number {
  return FACILITY_INFO[kind].cost(citySize(CITY[city], yearOf(q)));
}

export function facilityUpkeep(city: string, kind: FacilityKind, q: number): number {
  return FACILITY_INFO[kind].upkeep(citySize(CITY[city], yearOf(q)));
}

/** 이 회사 시설의 달 유지비 합 */
export function facilitiesUpkeep(c: Company, q: number): number {
  return facilitiesOf(c).reduce((s, f) => s + facilityUpkeep(f.city, f.kind, q), 0);
}

/** 회사 가치에 더하는 시설 (지은 값의 60%) */
export const facilitiesWorth = (c: Company): number => facilitiesOf(c).reduce((s, f) => s + f.cost * 0.6, 0);

/** C점검 값 배수 (정비 기지가 하나라도 있으면) */
export const checkMult = (c: Company): number => (countFacility(c, 'base') > 0 ? BASE_CHECK : 1);

/** 닳는 빠르기 배수 */
export const wearMult = (c: Company): number => (countFacility(c, 'base') > 0 ? BASE_WEAR : 1);

/** 이 회사가 이 비행기를 C점검하는 값 (정비 기지 할인) */
export const companyCheckCost = (c: Company, p: Plane): number => checkCost(p, checkMult(c));

/** 더 늘어나는 정비고 자리 */
export const extraCheckSlots = (c: Company): number => countFacility(c, 'base') * BASE_SLOTS;

/** 이 도시 노선의 사업 손님 배수 (라운지) */
export const loungeBiz = (c: Company, city: string): number => (hasFacility(c, city, 'lounge') ? LOUNGE_BIZ : 1);

/** 이 도시의 슬롯 배수 (전용 터미널) */
export const terminalSlots = (c: Company, city: string): number => (hasFacility(c, city, 'terminal') ? TERMINAL_SLOTS : 1);

/** 라운지가 올려 주는 평판 (세 곳까지) */
export const loungeRep = (c: Company): number => Math.min(3, countFacility(c, 'lounge'));

export function facilityBlocker(state: AirlineState, ci: number, city: string, kind: FacilityKind): string | null {
  const c = state.companies[ci];
  const info = FACILITY_INFO[kind];
  if (!info || !CITY[city]) return '없는 시설이에요';
  if (!c.branches.includes(city)) return '지점이 있는 공항에만 지어요';
  if (hasFacility(c, city, kind)) return '이미 있어요';
  if (airportClass(CITY[city], yearOf(state.q)) < info.minAirport) return '공항이 더 커야 지을 수 있어요';
  const cost = facilityCost(city, kind, state.q);
  if (c.cash < cost) return `돈이 모자라요 (${cost.toLocaleString('ko-KR')}억 필요)`;
  return null;
}
