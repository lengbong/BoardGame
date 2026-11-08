import type { Card, CardColor, CardKind, Rng } from './types';

export const CARD_COLORS: CardColor[] = ['red', 'yellow', 'green', 'blue'];

/** 색마다 모양을 하나씩 붙여서 색을 구별하기 어려운 사람도 알아볼 수 있게 한다. */
export type ColorShape = 'circle' | 'star' | 'leaf' | 'diamond';

export const COLOR_INFO: Record<CardColor, { name: string; main: string; dark: string; light: string; shape: ColorShape }> = {
  red: { name: '빨강', main: '#e0463e', dark: '#9e2620', light: '#fde6e3', shape: 'circle' },
  yellow: { name: '노랑', main: '#f2b20c', dark: '#a06f00', light: '#fff4cf', shape: 'star' },
  green: { name: '초록', main: '#2e9d5b', dark: '#1b6439', light: '#dff4e7', shape: 'leaf' },
  blue: { name: '파랑', main: '#2f6bd6', dark: '#1c4290', light: '#e2ebfc', shape: 'diamond' },
};

export const KIND_LABEL: Record<CardKind, string> = {
  number: '숫자',
  skip: '건너뛰기',
  reverse: '방향 바꾸기',
  draw2: '+2',
  wild: '색 바꾸기',
  wild4: '+4',
};

/**
 * 카드 108장
 * - 색마다: 0 한 장, 1~9 두 장씩, 건너뛰기·방향 바꾸기·+2 두 장씩 (25장 × 4색)
 * - 색 바꾸기 4장, +4 4장
 */
export function createDeck(): Card[] {
  const cards: Card[] = [];
  let id = 0;
  const add = (kind: CardKind, color: CardColor | null, value = -1) => cards.push({ id: id++, kind, color, value });
  for (const color of CARD_COLORS) {
    add('number', color, 0);
    for (let v = 1; v <= 9; v++) {
      add('number', color, v);
      add('number', color, v);
    }
    for (const kind of ['skip', 'reverse', 'draw2'] as const) {
      add(kind, color);
      add(kind, color);
    }
  }
  for (let i = 0; i < 4; i++) add('wild', null);
  for (let i = 0; i < 4; i++) add('wild4', null);
  return cards;
}

/** Fisher–Yates. 새 배열을 돌려준다. */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function isWild(card: Card): boolean {
  return card.color === null;
}

/** 판이 끝났을 때 손에 남은 카드 점수: 숫자는 그 수, 기능 카드 20점, 색 바꾸기 50점 */
export function cardPoints(card: Card): number {
  if (card.kind === 'number') return card.value;
  if (card.kind === 'wild' || card.kind === 'wild4') return 50;
  return 20;
}

export function handPoints(hand: Card[]): number {
  return hand.reduce((sum, c) => sum + cardPoints(c), 0);
}

/** 카드에 쓰인 글자: '7', '+2' 같은 것 */
export function cardFace(card: Card): string {
  return card.kind === 'number' ? String(card.value) : KIND_LABEL[card.kind];
}

/** 진행 기록에 쓰는 카드 이름: '빨강 7', '파랑 건너뛰기', '+4' */
export function cardLabel(card: Card): string {
  if (card.color === null) return card.kind === 'wild4' ? '+4 색 바꾸기' : '색 바꾸기';
  return `${COLOR_INFO[card.color].name} ${cardFace(card)}`;
}

const KIND_ORDER: Record<CardKind, number> = { number: 0, skip: 1, reverse: 2, draw2: 3, wild: 4, wild4: 5 };

/** 손패를 보기 좋게 정렬: 색 → 숫자 → 기능 카드, 색 바꾸기는 맨 끝 */
export function sortHand(hand: Card[]): Card[] {
  const colorOrder = (c: Card) => (c.color === null ? 9 : CARD_COLORS.indexOf(c.color));
  return [...hand].sort(
    (a, b) => colorOrder(a) - colorOrder(b) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.value - b.value || a.id - b.id,
  );
}
