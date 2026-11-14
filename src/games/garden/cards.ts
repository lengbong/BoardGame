import type { Bonus, GoalId, Kind, PlantArt, PlantCard, Res, ResCount, Season, Token } from './types';

/**
 * 꽃밭 가꾸기의 식물 48장 (봄·여름·가을 16장씩).
 * 값은 이 게임에 맞춰 새로 정했다: 봄은 자원 2~4개에 0~1점, 여름은 4~6개에 1~3점, 가을은 6~8개에 3~5점.
 * 계절마다 네 자원을 만드는 식물이 4장씩 고르게 들어 있다.
 */

export const RES: Res[] = ['water', 'sun', 'seed', 'compost'];
export const TOKENS: Token[] = ['water', 'sun', 'seed', 'compost', 'bee'];
export const KINDS: Kind[] = ['flower', 'veggie', 'tree', 'herb'];

export const RES_LABEL: Record<Token, string> = { water: '물', sun: '햇빛', seed: '씨앗', compost: '거름', bee: '꿀벌' };
export const RES_EMOJI: Record<Token, string> = { water: '💧', sun: '☀️', seed: '🌱', compost: '🪱', bee: '🐝' };
export const KIND_LABEL: Record<Kind, string> = { flower: '꽃', veggie: '채소', tree: '나무', herb: '약초' };
export const KIND_EMOJI: Record<Kind, string> = { flower: '🌸', veggie: '🥬', tree: '🌳', herb: '🌿' };
export const SEASON_LABEL: Record<Season, string> = { 1: '봄', 2: '여름', 3: '가을' };
export const BONUS_LABEL: Record<Bonus, string> = { water2: '물뿌리개', bee: '새집', scarecrow: '허수아비' };
export const BONUS_TEXT: Record<Bonus, string> = {
  water2: '심으면 주머니에서 💧 물 2개를 받아요',
  bee: '심으면 벌통에서 🐝 꿀벌 1마리를 받아요',
  scarecrow: '심으면 내 채소 1장마다 1점을 더 받아요',
};

type CardSpec = [name: string, kind: Kind, cost: [number, number, number, number], produce: Res, points: number, art: PlantArt, bonus?: Bonus];

const c = (w: number, s: number, d: number, k: number): [number, number, number, number] => [w, s, d, k];

const SPRING: CardSpec[] = [
  ['개나리', 'flower', c(0, 2, 1, 0), 'water', 0, { shape: 'star', color: '#f5c518', accent: '#7cb342' }],
  ['진달래', 'flower', c(1, 0, 0, 2), 'sun', 0, { shape: 'bell', color: '#e0559a', accent: '#8e2463' }],
  ['민들레', 'flower', c(0, 1, 2, 0), 'seed', 0, { shape: 'puff', color: '#f7c600' }],
  ['제비꽃', 'flower', c(2, 0, 1, 0), 'compost', 0, { shape: 'violet', color: '#7b5bc9', accent: '#f6d64a' }],
  ['튤립', 'flower', c(3, 0, 0, 1), 'sun', 1, { shape: 'tulip', color: '#e8473f', accent: '#f39a3d' }],
  ['수선화', 'flower', c(2, 0, 0, 1), 'seed', 0, { shape: 'daffodil', color: '#fff3a8', accent: '#f29b1d' }, 'water2'],
  ['상추', 'veggie', c(1, 1, 0, 0), 'compost', 0, { shape: 'leafy', color: '#8fd14f', accent: '#5a9e2f' }],
  ['시금치', 'veggie', c(0, 0, 2, 1), 'water', 0, { shape: 'leafy', color: '#3f8f3a', accent: '#2a6b2a' }],
  ['쑥갓', 'veggie', c(0, 1, 0, 1), 'water', 0, { shape: 'sprig', color: '#5cae4a', accent: '#f4d35e' }],
  ['냉이', 'veggie', c(0, 0, 1, 2), 'sun', 0, { shape: 'sprig', color: '#7aa64a', accent: '#ffffff' }],
  ['완두콩', 'veggie', c(0, 0, 3, 1), 'compost', 1, { shape: 'pod', color: '#79c447', accent: '#b7e48a' }],
  ['쑥', 'herb', c(1, 0, 1, 1), 'seed', 0, { shape: 'sprig', color: '#8fae8a', accent: '#c9d8c5' }],
  ['박하', 'herb', c(0, 2, 0, 1), 'compost', 0, { shape: 'sprig', color: '#3fbf8f', accent: '#b9f0d8' }],
  ['캐모마일', 'herb', c(1, 3, 0, 0), 'water', 1, { shape: 'daisy', color: '#ffffff', accent: '#f6c22e' }],
  ['달래', 'herb', c(1, 2, 0, 0), 'sun', 0, { shape: 'spike', color: '#c7a6e8', accent: '#6aa84f' }],
  ['매화나무', 'tree', c(0, 1, 0, 3), 'seed', 1, { shape: 'blossomTree', color: '#fbe3ea', accent: '#e86a8f' }],
];

const SUMMER: CardSpec[] = [
  ['해바라기', 'flower', c(1, 4, 0, 1), 'water', 2, { shape: 'sunflower', color: '#f7b500', accent: '#6b3e1f' }],
  ['수국', 'flower', c(4, 0, 2, 0), 'sun', 1, { shape: 'hydrangea', color: '#7d9cf0', accent: '#b78be8' }, 'water2'],
  ['나팔꽃', 'flower', c(1, 2, 0, 3), 'seed', 2, { shape: 'trumpet', color: '#5b7ee8', accent: '#e4b7f2' }],
  ['봉숭아', 'flower', c(1, 0, 4, 1), 'compost', 2, { shape: 'bell', color: '#f0566e', accent: '#b2263f' }],
  ['장미', 'flower', c(0, 2, 0, 5), 'sun', 3, { shape: 'rose', color: '#d7263d', accent: '#8f1527' }],
  ['오이', 'veggie', c(4, 0, 0, 2), 'compost', 2, { shape: 'vine', color: '#3e8e3a', accent: '#f5d547' }],
  ['토마토', 'veggie', c(2, 2, 2, 0), 'water', 2, { shape: 'fruitVeg', color: '#e8412c', accent: '#3f8f3a' }],
  ['가지', 'veggie', c(2, 0, 1, 3), 'seed', 2, { shape: 'fruitVeg', color: '#6b2f8f', accent: '#3f8f3a' }],
  ['옥수수', 'veggie', c(1, 4, 1, 0), 'sun', 1, { shape: 'corn', color: '#f6c445', accent: '#6fae3c' }, 'scarecrow'],
  ['라벤더', 'herb', c(0, 5, 2, 0), 'seed', 3, { shape: 'spike', color: '#9b6fd8', accent: '#6f9a5a' }],
  ['바질', 'herb', c(2, 1, 0, 3), 'compost', 2, { shape: 'sprig', color: '#2f9e44', accent: '#c3f0a8' }],
  ['로즈메리', 'herb', c(0, 0, 3, 4), 'water', 3, { shape: 'spike', color: '#6f8fc9', accent: '#4f7a5a' }],
  ['레몬밤', 'herb', c(0, 2, 4, 0), 'sun', 2, { shape: 'sprig', color: '#9ccc3d', accent: '#fff59d' }],
  ['무궁화', 'tree', c(5, 0, 2, 0), 'compost', 3, { shape: 'blossomTree', color: '#f2a7c3', accent: '#c2185b' }],
  ['자두나무', 'tree', c(2, 1, 3, 0), 'seed', 1, { shape: 'fruitTree', color: '#8e3fa0', accent: '#5f9e3f' }, 'bee'],
  ['복숭아나무', 'tree', c(0, 4, 0, 3), 'water', 3, { shape: 'fruitTree', color: '#f7a072', accent: '#5f9e3f' }],
];

const AUTUMN: CardSpec[] = [
  ['코스모스', 'flower', c(0, 2, 4, 2), 'seed', 3, { shape: 'daisy', color: '#f28ab2', accent: '#f6c22e' }],
  ['국화', 'flower', c(0, 6, 2, 0), 'water', 5, { shape: 'mum', color: '#f5b82e', accent: '#d9822b' }],
  ['구절초', 'flower', c(3, 1, 4, 0), 'sun', 4, { shape: 'daisy', color: '#f4f0ff', accent: '#e9b62c' }],
  ['꽃무릇', 'flower', c(0, 0, 6, 2), 'compost', 5, { shape: 'spider', color: '#e3262f', accent: '#ff8a80' }],
  ['배추', 'veggie', c(5, 0, 1, 2), 'sun', 3, { shape: 'cabbage', color: '#a5d36b', accent: '#f4f1d0' }],
  ['무', 'veggie', c(1, 5, 0, 2), 'compost', 3, { shape: 'root', color: '#f7f5ee', accent: '#5aa040' }],
  ['호박', 'veggie', c(2, 4, 2, 0), 'water', 3, { shape: 'pumpkin', color: '#f08a24', accent: '#5f8f3a' }, 'scarecrow'],
  ['인삼', 'herb', c(0, 2, 0, 6), 'seed', 5, { shape: 'root', color: '#e9cf9b', accent: '#d7263d' }],
  ['도라지', 'herb', c(3, 0, 0, 5), 'water', 4, { shape: 'trumpet', color: '#8a6ad8', accent: '#e9e0ff' }],
  ['생강', 'herb', c(0, 4, 4, 0), 'sun', 4, { shape: 'root', color: '#d9b26a', accent: '#7cb342' }],
  ['감나무', 'tree', c(5, 3, 0, 0), 'compost', 4, { shape: 'fruitTree', color: '#f57c1f', accent: '#7a9a3a' }],
  ['사과나무', 'tree', c(0, 6, 0, 2), 'water', 5, { shape: 'fruitTree', color: '#d62828', accent: '#4f9a3a' }],
  ['밤나무', 'tree', c(2, 0, 5, 1), 'compost', 3, { shape: 'roundTree', color: '#8a5a2b', accent: '#9bbf4a' }, 'bee'],
  ['은행나무', 'tree', c(1, 0, 3, 4), 'seed', 4, { shape: 'fanTree', color: '#f6c90e', accent: '#c99a06' }],
  ['단풍나무', 'tree', c(6, 0, 2, 0), 'sun', 5, { shape: 'mapleTree', color: '#e4572e', accent: '#b5301a' }],
  ['대추나무', 'tree', c(4, 0, 0, 4), 'seed', 4, { shape: 'fruitTree', color: '#a8322a', accent: '#6b8f3a' }],
];

function build(): PlantCard[] {
  const out: PlantCard[] = [];
  const seasons: [Season, CardSpec[]][] = [
    [1, SPRING],
    [2, SUMMER],
    [3, AUTUMN],
  ];
  for (const [season, list] of seasons) {
    for (const [name, kind, [water, sun, seed, compost], produce, points, art, bonus] of list) {
      const cost: ResCount = { water, sun, seed, compost };
      out.push({ id: out.length, name, kind, season, cost, produce, points, art, ...(bonus ? { bonus } : {}) });
    }
  }
  return out;
}

export const CARDS: readonly PlantCard[] = build();
export const CARD_COUNT = CARDS.length;

export function card(id: number): PlantCard {
  return CARDS[id];
}

export function costTotal(cost: ResCount): number {
  return cost.water + cost.sun + cost.seed + cost.compost;
}

// ------------------------------------------------------------------ 박람회 상장

export const RIBBON_POINTS = 3;

export interface GoalDef {
  id: GoalId;
  title: string;
  /** 무엇을 해야 하는지 한 줄 */
  text: string;
  /** 상장 가운데 그림 */
  icon: string;
  /** 리본 색 */
  color: string;
  /** 지금까지 채운 칸 / 채워야 할 칸 */
  progress: (cards: readonly PlantCard[]) => { have: number; need: number };
}

const countKind = (cards: readonly PlantCard[], k: Kind) => cards.filter((x) => x.kind === k).length;
const countSeason = (cards: readonly PlantCard[], s: Season) => cards.filter((x) => x.season === s).length;

export const GOALS: Record<GoalId, GoalDef> = {
  flowers4: { id: 'flowers4', title: '꽃 정원', text: '꽃 4장', icon: '🌸', color: '#e86a9a', progress: (cs) => ({ have: Math.min(4, countKind(cs, 'flower')), need: 4 }) },
  trees3: { id: 'trees3', title: '작은 숲', text: '나무 3장', icon: '🌳', color: '#3f9a52', progress: (cs) => ({ have: Math.min(3, countKind(cs, 'tree')), need: 3 }) },
  allKinds: {
    id: 'allKinds',
    title: '골고루 정원',
    text: '꽃·채소·나무·약초 모두 1장씩',
    icon: '🎨',
    color: '#e09a2b',
    progress: (cs) => ({ have: KINDS.filter((k) => countKind(cs, k) > 0).length, need: 4 }),
  },
  sameRes4: {
    id: 'sameRes4',
    title: '한 우물 정원',
    text: '같은 자원을 만드는 식물 4장',
    icon: '🔁',
    color: '#3f86c9',
    progress: (cs) => ({ have: Math.min(4, Math.max(...RES.map((r) => cs.filter((x) => x.produce === r).length))), need: 4 }),
  },
  veggieHerb: {
    id: 'veggieHerb',
    title: '건강 밥상',
    text: '채소 3장 + 약초 2장',
    icon: '🥗',
    color: '#6aa83a',
    progress: (cs) => ({ have: Math.min(3, countKind(cs, 'veggie')) + Math.min(2, countKind(cs, 'herb')), need: 5 }),
  },
  seasons: {
    id: 'seasons',
    title: '세 계절 정원',
    text: '봄·여름·가을 식물 2장씩',
    icon: '🗓️',
    color: '#9a6ad0',
    progress: (cs) => ({ have: ([1, 2, 3] as Season[]).reduce((a, s) => a + Math.min(2, countSeason(cs, s)), 0), need: 6 }),
  },
  autumn3: { id: 'autumn3', title: '풍성한 가을', text: '가을 식물 3장', icon: '🍁', color: '#d9622b', progress: (cs) => ({ have: Math.min(3, countSeason(cs, 3)), need: 3 }) },
  big7: { id: 'big7', title: '큰 정원', text: '식물 7장', icon: '🏡', color: '#b0873a', progress: (cs) => ({ have: Math.min(7, cs.length), need: 7 }) },
};

export const GOAL_IDS: GoalId[] = ['flowers4', 'trees3', 'allKinds', 'sameRes4', 'veggieHerb', 'seasons', 'autumn3', 'big7'];

export function goalMet(goal: GoalId, cards: readonly PlantCard[]): boolean {
  const p = GOALS[goal].progress(cards);
  return p.have >= p.need;
}
