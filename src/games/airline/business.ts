import type { BusinessKind, CityDef } from './types';

/**
 * 부대사업 (에어 매니지먼트처럼 도시마다 여러 사업을 벌인다).
 * 지점이 있는 도시에 세우고, 분기마다 수입이 들어오며, 그 도시를 오가는 노선의 손님이 우리 회사를 더 고른다.
 */
export interface BusinessInfo {
  name: string;
  icon: string;
  desc: string;
  /** 세우는 값 (억) */
  cost: (city: CityDef, size: number) => number;
  /** 세울 수 없는 까닭 (세울 수 있으면 null) */
  why: (city: CityDef, size: number) => string | null;
  /** 그 도시를 오가는 노선에서 사업·관광 손님이 우리를 고르는 배수 */
  biz: number;
  leisure: number;
  /** 분기 수입 (억): 세운 값 × 비율 × 계절 + 우리 비행기로 온 관광 손님 × 몫 */
  rate: (city: CityDef) => number;
  perArrival: number;
  /** 계절 배수 [1분기, 2, 3, 4] (없으면 도시의 관광 성수기) */
  season?: readonly number[] | 'city';
}

/** 눈 덮인 산이 가까운 도시 (스키장) */
export const SKI_CITIES: readonly string[] = ['zurich', 'milan', 'vancouver', 'seoul', 'tokyo', 'moscow', 'montreal', 'auckland'];

const SOUTH = new Set(['sydney', 'auckland', 'johannesburg', 'capetown', 'saopaulo', 'rio', 'buenosaires']);

export const BUSINESS_KINDS: readonly BusinessKind[] = ['hotel', 'agency', 'bus', 'restaurant', 'store', 'resort', 'ski', 'park'];

export const BUSINESS_INFO: Record<BusinessKind, BusinessInfo> = {
  hotel: {
    name: '호텔',
    icon: '🏨',
    desc: '관광 손님이 늘고 숙박 수입이 생겨요',
    cost: (c, s) => 40 + 10 * s + 6 * c.fun,
    why: () => null,
    biz: 1,
    leisure: 1.12,
    rate: (c) => 0.016 + 0.003 * c.fun,
    perArrival: 0.0003,
    season: 'city',
  },
  agency: {
    name: '여행사',
    icon: '🧳',
    desc: '이 도시 노선의 손님이 조금 늘어요',
    cost: (_c, s) => 15 + 4 * s,
    why: () => null,
    biz: 1.05,
    leisure: 1.05,
    rate: () => 0.02,
    perArrival: 0.0001,
  },
  bus: {
    name: '공항버스',
    icon: '🚌',
    desc: '공항까지 편하게 오가서 손님이 조금 늘고, 우리 손님이 많을수록 돈을 벌어요',
    cost: (_c, s) => 8 + 2.5 * s,
    why: () => null,
    biz: 1.03,
    leisure: 1.03,
    rate: () => 0.012,
    perArrival: 0.00028,
  },
  restaurant: {
    name: '레스토랑',
    icon: '🍜',
    desc: '도시 사람과 관광 손님이 찾는 식당. 꾸준히 조금씩 벌어요',
    cost: (_c, s) => 10 + 3 * s,
    why: () => null,
    biz: 1.01,
    leisure: 1.03,
    rate: () => 0.03,
    perArrival: 0.00008,
  },
  store: {
    name: '백화점',
    icon: '🏬',
    desc: '큰 도시에만 세워요. 비싸지만 큰 수입, 쇼핑 손님이 늘어요',
    cost: (_c, s) => 60 + 12 * s,
    why: (_c, s) => (s < 7 ? '아주 큰 도시(크기 7 이상)에만 세워요' : null),
    biz: 1.04,
    leisure: 1.04,
    rate: () => 0.03,
    perArrival: 0.0001,
    season: [0.95, 0.95, 0.95, 1.15],
  },
  resort: {
    name: '리조트',
    icon: '🏝️',
    desc: '관광지에만 세워요. 성수기에 크게 벌고 관광 손님이 많이 늘어요',
    cost: (c, s) => 70 + 8 * s + 8 * c.fun,
    why: (c) => (c.fun < 7 ? '관광 매력이 큰 곳(7 이상)에만 세워요' : null),
    biz: 1,
    leisure: 1.18,
    rate: (c) => 0.012 + 0.0035 * c.fun,
    perArrival: 0.0004,
    season: 'city',
  },
  ski: {
    name: '스키장',
    icon: '⛷️',
    desc: '눈 덮인 산이 가까운 도시에만. 겨울에 크게 벌어요',
    cost: (_c, s) => 50 + 6 * s,
    why: (c) => (SKI_CITIES.includes(c.id) ? null : '눈 덮인 산이 가까운 도시에만 세워요'),
    biz: 1,
    leisure: 1.08,
    rate: () => 0.042,
    perArrival: 0.0002,
    season: [1.8, 0.4, 0.2, 1.6],
  },
  park: {
    name: '놀이공원',
    icon: '🎡',
    desc: '큰 도시(크기 6 이상)에 세워요. 가족 손님이 늘고 여름에 많이 벌어요',
    cost: (_c, s) => 80 + 10 * s,
    why: (_c, s) => (s < 6 ? '큰 도시(크기 6 이상)에만 세워요' : null),
    biz: 1,
    leisure: 1.1,
    rate: () => 0.022,
    perArrival: 0.0003,
    season: [0.7, 1.1, 1.5, 0.7],
  },
};

/** 계절 배수 (남반구는 여름·겨울이 반대) */
export function businessSeason(kind: BusinessKind, city: CityDef, quarter: number, citySeason: readonly number[]): number {
  const s = BUSINESS_INFO[kind].season;
  if (!s) return 1;
  if (s === 'city') return citySeason[quarter];
  return SOUTH.has(city.id) ? s[(quarter + 2) % 4] : s[quarter];
}
