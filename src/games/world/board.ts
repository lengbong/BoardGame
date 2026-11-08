import type { Region, Square } from './types';

export const BOARD_LENGTH = 32;
export const START = 0;
export const STUCK_SQUARE = 8;
export const FESTIVAL_SQUARE = 16;
export const PLANE_SQUARE = 24;
export const MAX_LEVEL = 3;
export const STUCK_TURNS = 2;

export const REGION_INFO: Record<Region, { name: string; color: string }> = {
  asia: { name: '아시아', color: '#e5484d' },
  europe: { name: '유럽', color: '#3e63dd' },
  'mideast-africa': { name: '중동·아프리카', color: '#e38a16' },
  americas: { name: '아메리카', color: '#30a46c' },
  oceania: { name: '오세아니아', color: '#0ea5b7' },
};

export const LEVEL_NAMES = ['땅', '집', '빌딩', '호텔'];
export const LEVEL_ICONS = ['', '🏠', '🏢', '🏨'];

/** 통행료 = 땅값 × 배수 (건물 단계별) */
const RENT_MULTIPLIER = [0.2, 0.6, 1.4, 2.5];

const city = (index: number, cityId: string, name: string, country: string, region: Region, price: number): Square => ({
  index,
  kind: 'city',
  cityId,
  name,
  country,
  region,
  price,
});

export const SQUARES: Square[] = [
  { index: 0, kind: 'start', name: '출발' },
  city(1, 'cairo', '카이로', '이집트', 'mideast-africa', 60),
  { index: 2, kind: 'card', name: '여행 카드' },
  city(3, 'istanbul', '이스탄불', '튀르키예', 'europe', 70),
  city(4, 'hanoi', '하노이', '베트남', 'asia', 80),
  { index: 5, kind: 'tax', name: '공항 이용료', tax: 50 },
  city(6, 'bangkok', '방콕', '태국', 'asia', 90),
  city(7, 'newdelhi', '뉴델리', '인도', 'asia', 100),
  { index: 8, kind: 'stuck', name: '여권 분실' },
  city(9, 'taipei', '타이베이', '대만', 'asia', 110),
  city(10, 'singapore', '싱가포르', '싱가포르', 'asia', 120),
  { index: 11, kind: 'card', name: '여행 카드' },
  city(12, 'beijing', '베이징', '중국', 'asia', 130),
  city(13, 'rio', '리우데자네이루', '브라질', 'americas', 140),
  city(14, 'sydney', '시드니', '오스트레일리아', 'oceania', 150),
  city(15, 'seoul', '서울', '대한민국', 'asia', 160),
  { index: 16, kind: 'festival', name: '세계 축제' },
  city(17, 'moscow', '모스크바', '러시아', 'europe', 180),
  { index: 18, kind: 'card', name: '여행 카드' },
  city(19, 'athens', '아테네', '그리스', 'europe', 190),
  city(20, 'rome', '로마', '이탈리아', 'europe', 200),
  city(21, 'barcelona', '바르셀로나', '스페인', 'europe', 210),
  { index: 22, kind: 'tax', name: '호텔 숙박세', tax: 100 },
  city(23, 'berlin', '베를린', '독일', 'europe', 220),
  { index: 24, kind: 'plane', name: '비행기' },
  city(25, 'amsterdam', '암스테르담', '네덜란드', 'europe', 240),
  city(26, 'london', '런던', '영국', 'europe', 260),
  { index: 27, kind: 'card', name: '여행 카드' },
  city(28, 'paris', '파리', '프랑스', 'europe', 280),
  city(29, 'dubai', '두바이', '아랍에미리트', 'mideast-africa', 300),
  city(30, 'tokyo', '도쿄', '일본', 'asia', 320),
  city(31, 'newyork', '뉴욕', '미국', 'americas', 350),
];

export const CORNER_INFO: Record<number, { emoji: string; desc: string }> = {
  0: { emoji: '🏁', desc: '지나갈 때마다 월급' },
  8: { emoji: '🛂', desc: '2번 쉬기 (더블이면 탈출)' },
  16: { emoji: '🎉', desc: '내 도시에 축제! 통행료 2배' },
  24: { emoji: '✈️', desc: '원하는 칸으로 날아가기' },
};

export function buildCost(square: Square): number {
  return Math.round((square.price ?? 0) * 0.5);
}

export function rentFor(square: Square, level: number, festival: boolean): number {
  const base = Math.round((square.price ?? 0) * RENT_MULTIPLIER[level]);
  return festival ? base * 2 : base;
}

/** 땅값 + 지은 건물값 (총자산 계산용) */
export function propertyValue(square: Square, level: number): number {
  return (square.price ?? 0) + buildCost(square) * level;
}

/** 9×9 판에서 칸의 위치 (행, 열). 0번은 오른쪽 아래, 시계 방향으로 돈다. */
export function squareGridPosition(index: number): { row: number; col: number } {
  if (index <= 8) return { row: 8, col: 8 - index };
  if (index <= 16) return { row: 8 - (index - 8), col: 0 };
  if (index <= 24) return { row: 0, col: index - 16 };
  return { row: index - 24, col: 8 };
}
