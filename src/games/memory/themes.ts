import type { BoardSize, ThemeId } from './types';

/** 카드 그림 하나: id와 아이가 부르는 이름 */
export interface PictureInfo {
  id: string;
  name: string;
}

export interface ThemeInfo {
  id: Exclude<ThemeId, 'mixed'>;
  name: string;
  /** 카드 앞면 그림 뒤 동그라미 색 (연한 색) */
  tint: string;
  pictures: PictureInfo[];
}

/** 그림 그리기는 CardArt.tsx. 여기에는 이름만 둔다 (규칙·컴퓨터는 그림을 몰라도 된다). */
export const THEMES: ThemeInfo[] = [
  {
    id: 'animals',
    name: '동물',
    tint: '#e3f2d9',
    pictures: [
      { id: 'a-rabbit', name: '토끼' },
      { id: 'a-bear', name: '곰' },
      { id: 'a-cat', name: '고양이' },
      { id: 'a-dog', name: '강아지' },
      { id: 'a-pig', name: '돼지' },
      { id: 'a-lion', name: '사자' },
      { id: 'a-chick', name: '병아리' },
      { id: 'a-penguin', name: '펭귄' },
      { id: 'a-owl', name: '부엉이' },
      { id: 'a-fish', name: '물고기' },
      { id: 'a-whale', name: '고래' },
      { id: 'a-turtle', name: '거북이' },
      { id: 'a-crab', name: '게' },
      { id: 'a-octopus', name: '문어' },
      { id: 'a-frog', name: '개구리' },
      { id: 'a-snail', name: '달팽이' },
      { id: 'a-butterfly', name: '나비' },
      { id: 'a-elephant', name: '코끼리' },
    ],
  },
  {
    id: 'food',
    name: '과일·채소',
    tint: '#fdeedd',
    pictures: [
      { id: 'f-apple', name: '사과' },
      { id: 'f-banana', name: '바나나' },
      { id: 'f-strawberry', name: '딸기' },
      { id: 'f-grapes', name: '포도' },
      { id: 'f-watermelon', name: '수박' },
      { id: 'f-pear', name: '배' },
      { id: 'f-cherry', name: '체리' },
      { id: 'f-pineapple', name: '파인애플' },
      { id: 'f-lemon', name: '레몬' },
      { id: 'f-peach', name: '복숭아' },
      { id: 'f-carrot', name: '당근' },
      { id: 'f-corn', name: '옥수수' },
      { id: 'f-eggplant', name: '가지' },
      { id: 'f-mushroom', name: '버섯' },
      { id: 'f-broccoli', name: '브로콜리' },
      { id: 'f-pepper', name: '고추' },
      { id: 'f-pumpkin', name: '호박' },
      { id: 'f-peas', name: '완두콩' },
    ],
  },
  {
    id: 'vehicles',
    name: '탈것',
    tint: '#dfeafb',
    pictures: [
      { id: 'v-car', name: '자동차' },
      { id: 'v-bus', name: '버스' },
      { id: 'v-train', name: '기차' },
      { id: 'v-plane', name: '비행기' },
      { id: 'v-sailboat', name: '돛단배' },
      { id: 'v-bicycle', name: '자전거' },
      { id: 'v-helicopter', name: '헬리콥터' },
      { id: 'v-rocket', name: '로켓' },
      { id: 'v-truck', name: '덤프트럭' },
      { id: 'v-firetruck', name: '소방차' },
      { id: 'v-scooter', name: '오토바이' },
      { id: 'v-balloon', name: '열기구' },
      { id: 'v-submarine', name: '잠수함' },
      { id: 'v-excavator', name: '굴착기' },
      { id: 'v-tractor', name: '트랙터' },
      { id: 'v-ambulance', name: '구급차' },
      { id: 'v-kickboard', name: '킥보드' },
      { id: 'v-cablecar', name: '케이블카' },
    ],
  },
];

export const THEME_LABELS: Record<ThemeId, string> = {
  animals: '동물',
  food: '과일·채소',
  vehicles: '탈것',
  mixed: '골고루 섞기',
};

export const THEME_IDS: ThemeId[] = ['animals', 'food', 'vehicles', 'mixed'];

const BY_ID = new Map<string, PictureInfo & { theme: ThemeInfo }>(
  THEMES.flatMap((t) => t.pictures.map((p) => [p.id, { ...p, theme: t }] as const)),
);

export function pictureInfo(id: string): (PictureInfo & { theme: ThemeInfo }) | undefined {
  return BY_ID.get(id);
}

/** 그림 이름 (모르는 id면 '카드') */
export function pictureName(id: string): string {
  return BY_ID.get(id)?.name ?? '카드';
}

/** 그 묶음에서 쓸 수 있는 모든 그림 id */
export function themePictures(theme: ThemeId): string[] {
  if (theme === 'mixed') return THEMES.flatMap((t) => t.pictures.map((p) => p.id));
  return THEMES.find((t) => t.id === theme)!.pictures.map((p) => p.id);
}

export const BOARD_SIZES: { value: BoardSize; rows: number; cols: number; label: string; desc: string }[] = [
  { value: '4x4', rows: 4, cols: 4, label: '4×4 · 8짝', desc: '처음 하는 아이에게 딱 좋아요' },
  { value: '4x6', rows: 4, cols: 6, label: '4×6 · 12짝', desc: '조금 더 길게' },
  { value: '6x6', rows: 6, cols: 6, label: '6×6 · 18짝', desc: '기억력 대장 도전!' },
];

export function boardDims(size: BoardSize): { rows: number; cols: number; pairs: number } {
  const b = BOARD_SIZES.find((s) => s.value === size) ?? BOARD_SIZES[0];
  return { rows: b.rows, cols: b.cols, pairs: (b.rows * b.cols) / 2 };
}
