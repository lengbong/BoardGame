import { shuffle, type Rng } from '../../lib/random';

/**
 * 여러 카드 게임(도둑잡기, 칠 이어놓기 …)이 함께 쓰는 보통 트럼프 카드 52장 (+ 조커).
 * 카드 그림은 components/PlayingCard.tsx
 */
export type Suit = 'spade' | 'heart' | 'diamond' | 'club';

/** 정렬·판 줄 순서: ♠ ♥ ♦ ♣ */
export const SUITS: readonly Suit[] = ['spade', 'heart', 'diamond', 'club'];

/** 1(A) ~ 13(K) */
export const RANKS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export const JOKER_ID = 52;

export interface Card {
  /** 0~51: 무늬 순서 × 13 + (숫자 - 1). 조커는 52 */
  id: number;
  /** 조커는 null */
  suit: Suit | null;
  /** 1(A) ~ 13(K). 조커는 0 */
  rank: number;
}

export const SUIT_INFO: Record<Suit, { symbol: string; name: string; red: boolean }> = {
  spade: { symbol: '♠', name: '스페이드', red: false },
  heart: { symbol: '♥', name: '하트', red: true },
  diamond: { symbol: '♦', name: '다이아', red: true },
  club: { symbol: '♣', name: '클로버', red: false },
};

/** 카드 글자색: 빨간 무늬는 빨강, 검은 무늬는 검정 */
export const CARD_RED = '#d22630';
export const CARD_BLACK = '#1f2228';

const RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** 'A', '2' … '10', 'J', 'Q', 'K' */
export function rankLabel(rank: number): string {
  return RANK_LABELS[rank] ?? '?';
}

export function cardIdOf(suit: Suit, rank: number): number {
  return SUITS.indexOf(suit) * 13 + (rank - 1);
}

export function makeCard(suit: Suit, rank: number): Card {
  return { id: cardIdOf(suit, rank), suit, rank };
}

export function makeJoker(): Card {
  return { id: JOKER_ID, suit: null, rank: 0 };
}

/** 52장 (♠A … ♣K 순서). joker가 true면 조커 1장을 맨 끝에 더한다. */
export function createDeck(options: { joker?: boolean } = {}): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push(makeCard(suit, rank));
  if (options.joker) deck.push(makeJoker());
  return deck;
}

/** 섞은 새 더미 */
export function shuffledDeck(rng: Rng, options: { joker?: boolean } = {}): Card[] {
  return shuffle(createDeck(options), rng);
}

export function isJoker(card: Card): boolean {
  return card.suit === null;
}

export function isRedCard(card: Card): boolean {
  return card.suit !== null && SUIT_INFO[card.suit].red;
}

/** 화면 읽기·기록용 이름: '스페이드 7', '하트 A', '조커' */
export function cardLabel(card: Card): string {
  if (card.suit === null) return '조커';
  return `${SUIT_INFO[card.suit].name} ${rankLabel(card.rank)}`;
}

/** 짧은 이름: '♠7', '♥A', '🃏' */
export function cardShortLabel(card: Card): string {
  if (card.suit === null) return '조커';
  return `${SUIT_INFO[card.suit].symbol}${rankLabel(card.rank)}`;
}

/** 남은 카드 점수: A=1 … 10=10, J=11, Q=12, K=13, 조커 0 */
export function cardPoints(card: Card): number {
  return card.suit === null ? 0 : card.rank;
}

export function handPoints(cards: readonly Card[]): number {
  return cards.reduce((sum, c) => sum + cardPoints(c), 0);
}

/**
 * 정렬: 'suit'는 무늬별(♠♥♦♣) 다음 숫자순, 'rank'는 숫자순 다음 무늬순. 조커는 맨 끝.
 * 원본은 그대로 두고 새 배열을 돌려준다.
 */
export function sortCards(cards: readonly Card[], by: 'suit' | 'rank' = 'suit'): Card[] {
  const suitIndex = (c: Card) => (c.suit === null ? 99 : SUITS.indexOf(c.suit));
  return [...cards].sort((a, b) => {
    if (a.suit === null || b.suit === null) return (a.suit === null ? 1 : 0) - (b.suit === null ? 1 : 0);
    if (by === 'suit') return suitIndex(a) - suitIndex(b) || a.rank - b.rank;
    return a.rank - b.rank || suitIndex(a) - suitIndex(b);
  });
}

/** 저장된 값이 올바른 카드인지 (불러오기 검사용) */
export function isValidCard(v: unknown): v is Card {
  const c = v as Card;
  if (!c || typeof c !== 'object' || typeof c.id !== 'number' || typeof c.rank !== 'number') return false;
  if (c.suit === null) return c.id === JOKER_ID && c.rank === 0;
  return SUITS.includes(c.suit) && Number.isInteger(c.rank) && c.rank >= 1 && c.rank <= 13 && c.id === cardIdOf(c.suit, c.rank);
}
