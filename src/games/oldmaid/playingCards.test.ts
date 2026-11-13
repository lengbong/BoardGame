import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import {
  JOKER_ID,
  SUITS,
  cardLabel,
  cardPoints,
  cardShortLabel,
  createDeck,
  handPoints,
  isJoker,
  isRedCard,
  isValidCard,
  makeCard,
  makeJoker,
  rankLabel,
  shuffledDeck,
  sortCards,
} from '../common/playingCards';

describe('공용 트럼프 카드 (common/playingCards)', () => {
  it('52장, 무늬마다 A~K 13장, id가 모두 다르다', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
    for (const suit of SUITS) expect(deck.filter((c) => c.suit === suit).map((c) => c.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(deck.some(isJoker)).toBe(false);
  });

  it('조커를 더하면 53장이고 조커는 맨 끝', () => {
    const deck = createDeck({ joker: true });
    expect(deck).toHaveLength(53);
    expect(deck[52]).toEqual({ id: JOKER_ID, suit: null, rank: 0 });
    expect(isJoker(deck[52])).toBe(true);
  });

  it('섞은 더미는 같은 카드들이고 시드가 같으면 같은 순서', () => {
    const a = shuffledDeck(seededRandom(5), { joker: true });
    const b = shuffledDeck(seededRandom(5), { joker: true });
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x.id - y.id)).toEqual(createDeck({ joker: true }));
  });

  it('한국어 이름과 짧은 이름', () => {
    expect(cardLabel(makeCard('spade', 7))).toBe('스페이드 7');
    expect(cardLabel(makeCard('heart', 1))).toBe('하트 A');
    expect(cardLabel(makeCard('diamond', 12))).toBe('다이아 Q');
    expect(cardLabel(makeCard('club', 10))).toBe('클로버 10');
    expect(cardLabel(makeJoker())).toBe('조커');
    expect(cardShortLabel(makeCard('club', 13))).toBe('♣K');
    expect(rankLabel(11)).toBe('J');
  });

  it('빨간 무늬는 하트와 다이아', () => {
    expect(isRedCard(makeCard('heart', 3))).toBe(true);
    expect(isRedCard(makeCard('diamond', 3))).toBe(true);
    expect(isRedCard(makeCard('spade', 3))).toBe(false);
    expect(isRedCard(makeJoker())).toBe(false);
  });

  it('정렬: 무늬별·숫자별, 조커는 맨 끝, 원본은 그대로', () => {
    const cards = [makeJoker(), makeCard('club', 2), makeCard('spade', 9), makeCard('heart', 2), makeCard('spade', 3)];
    const copy = [...cards];
    expect(sortCards(cards).map(cardShortLabel)).toEqual(['♠3', '♠9', '♥2', '♣2', '조커']);
    expect(sortCards(cards, 'rank').map(cardShortLabel)).toEqual(['♥2', '♣2', '♠3', '♠9', '조커']);
    expect(cards).toEqual(copy);
  });

  it('카드 점수: A=1, J=11, Q=12, K=13, 조커 0', () => {
    expect(cardPoints(makeCard('spade', 1))).toBe(1);
    expect(cardPoints(makeCard('heart', 13))).toBe(13);
    expect(handPoints([makeCard('club', 11), makeCard('club', 12), makeJoker()])).toBe(23);
  });

  it('저장된 카드 검사', () => {
    expect(isValidCard(makeCard('heart', 5))).toBe(true);
    expect(isValidCard(makeJoker())).toBe(true);
    expect(isValidCard({ id: 3, suit: 'heart', rank: 5 })).toBe(false);
    expect(isValidCard({ id: 0, suit: 'star', rank: 1 })).toBe(false);
    expect(isValidCard(null)).toBe(false);
  });
});
