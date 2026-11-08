import { CARD_COLORS, cardPoints, isWild } from './cards';
import { canCall, nextIndex, playableCards } from './rules';
import type { Card, CardColor, LastCardAction, LastCardState, Rng } from './types';

export type AiLevel = 'ai-easy' | 'ai-normal';

/** 손에 가장 많이 든 색 (색 바꾸기 카드는 빼고 센다) */
export function bestColor(hand: Card[], rng: Rng = Math.random): CardColor {
  const counts = new Map<CardColor, number>(CARD_COLORS.map((c) => [c, 0]));
  for (const c of hand) if (c.color) counts.set(c.color, counts.get(c.color)! + 1);
  const max = Math.max(...counts.values());
  const best = CARD_COLORS.filter((c) => counts.get(c) === max);
  return best[Math.min(best.length - 1, Math.floor(rng() * best.length))];
}

function randomColor(rng: Rng): CardColor {
  return CARD_COLORS[Math.min(3, Math.floor(rng() * 4))];
}

/** 카드를 냈을 때 얼마나 좋은지 점수로 평가 (높을수록 좋음) */
export function scorePlay(state: LastCardState, card: Card, color: CardColor): number {
  const me = state.current;
  const rest = state.players[me].hand.filter((c) => c.id !== card.id);
  if (rest.length === 0) return 10_000;

  const next = state.players[nextIndex(state, me)];
  const danger = next.hand.length <= 2;
  const twoPlayers = state.players.length === 2;
  const after = card.color ?? color;

  // 낸 뒤에도 같은 색을 이어 낼 수 있으면 좋다.
  let score = rest.filter((c) => c.color === after).length * 12;
  // 점수 높은 카드는 일찍 털어 낸다.
  score += Math.min(cardPoints(card), 20) * 0.8;

  switch (card.kind) {
    case 'skip':
    case 'draw2':
      score += danger ? 70 : 6;
      if (twoPlayers) score += 15; // 2명이면 바로 한 번 더 할 수 있다.
      break;
    case 'reverse':
      score += twoPlayers ? (danger ? 70 : 20) : danger ? 30 : 4;
      break;
    case 'wild':
      // 색 바꾸기는 아껴 두었다가 낼 카드가 없을 때 쓴다.
      score -= 45;
      break;
    case 'wild4':
      score += danger ? 60 : -70;
      break;
    default:
  }
  // 남은 카드가 색 바꾸기뿐이면 미리 아껴 둘 필요가 없다.
  if (rest.every(isWild)) score += 40;
  return score;
}

function chooseCard(state: LastCardState, cards: Card[], level: AiLevel, rng: Rng): { card: Card; color: CardColor } {
  const hand = state.players[state.current].hand;
  if (level === 'ai-easy') {
    const card = cards[Math.min(cards.length - 1, Math.floor(rng() * cards.length))];
    const color = rng() < 0.5 ? randomColor(rng) : bestColor(hand.filter((c) => c.id !== card.id), rng);
    return { card, color };
  }
  let best = cards[0];
  let bestColorPick: CardColor = 'red';
  let bestScore = -Infinity;
  for (const card of cards) {
    const color = isWild(card) ? bestColor(hand.filter((c) => c.id !== card.id), rng) : card.color!;
    const s = scorePlay(state, card, color);
    if (s > bestScore) {
      best = card;
      bestColorPick = color;
      bestScore = s;
    }
  }
  return { card: best, color: bestColorPick };
}

/** 컴퓨터가 지금 할 행동을 정한다. */
export function decideAction(state: LastCardState, level: AiLevel, rng: Rng = Math.random): LastCardAction {
  if (state.phase === 'roundover') return { type: 'nextRound' };
  const cards = playableCards(state);

  // 쉬움: 가끔 '한 장!'을 깜빡한다.
  const call = canCall(state) && (level === 'ai-normal' || rng() < 0.7);

  if (state.phase === 'drawn') {
    if (cards.length === 0 || (level === 'ai-easy' && rng() < 0.25)) return { type: 'pass' };
    const { card, color } = chooseCard(state, cards, level, rng);
    return { type: 'play', cardId: card.id, color: isWild(card) ? color : undefined, call };
  }

  if (cards.length === 0) return { type: 'draw' };
  const { card, color } = chooseCard(state, cards, level, rng);
  return { type: 'play', cardId: card.id, color: isWild(card) ? color : undefined, call };
}
