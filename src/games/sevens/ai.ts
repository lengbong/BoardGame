import { pick } from '../../lib/random';
import { cardIdOf, type Card } from '../common/playingCards';
import { MAX_PASSES, canPlace, isPlaced, playableCards } from './rules';
import type { Board, Rng, SevensAction, SevensState, Suit } from './types';

export type AiLevel = 'ai-easy' | 'ai-normal';

function withCard(board: Board, card: Card): Board {
  const b: Board = { spade: [...board.spade], heart: [...board.heart], diamond: [...board.diamond], club: [...board.club] };
  b[card.suit!][card.rank] = { by: -1, dumped: false };
  return b;
}

/**
 * 카드를 냈을 때 얼마나 좋은지 점수로 평가한다 (높을수록 좋음). 컴퓨터는 판과 자기 손패만 본다.
 * - 새로 길이 열리는 카드가 남의 카드면 나쁘다 (그 너머 남의 카드가 많을수록 더). → 남을 막는 카드는 쥐고 있는다.
 * - 새로 열리는 카드가 내 카드면 좋다 (나만 돕는 카드).
 * - 다만 그 너머로 내 카드가 줄줄이 이어지고 그 뒤에 남의 카드가 기다리고 있으면,
 *   남을 계속 막으면서 나중에 통과하지 않고 낼 '비상 카드'가 되므로 아껴 둔다.
 * - 7은 내 카드가 길게 이어지는 무늬부터 연다.
 * - 통과가 얼마 안 남았으면 아껴 둔 것보다 다음 차례에도 낼 카드가 남는 쪽을 고른다.
 */
export function evaluatePlay(state: SevensState, card: Card): number {
  const me = state.current;
  const player = state.players[me];
  const rest = player.hand.filter((c) => c.id !== card.id);
  if (rest.length === 0) return 1_000_000;
  const mine = new Set(rest.map((c) => c.id));
  const suit = card.suit as Suit;
  const after = withCard(state.board, card);
  let score = 0;

  for (const dir of [-1, 1]) {
    const r = card.rank + dir;
    if (r < 1 || r > 13 || isPlaced(after, suit, r)) continue;
    // 원래 열려 있던 칸이면 새로 여는 것이 아니다.
    if (canPlace(state.board, { id: cardIdOf(suit, r), suit, rank: r })) continue;
    let myRun = 0;
    let myBeyond = 0;
    let othersBeyond = 0;
    let unbroken = true;
    for (let k = r; k >= 1 && k <= 13 && !isPlaced(after, suit, k); k += dir) {
      if (mine.has(cardIdOf(suit, k))) {
        myBeyond += 1;
        if (unbroken) myRun += 1;
      } else {
        unbroken = false;
        if (k !== r) othersBeyond += 1;
      }
    }
    if (mine.has(cardIdOf(suit, r))) {
      score += 4;
      if (card.rank !== 7 && myRun >= 2 && othersBeyond > 0) score -= 4 + 2 * myRun;
    } else {
      score -= 10 + 2.5 * othersBeyond;
    }
    if (card.rank === 7) score += 2 * myBeyond;
  }

  // 다음 차례에 낼 수 있는 내 카드 수 (남이 길을 안 열어 줘도)
  const flex = rest.filter((c) => canPlace(after, c)).length;
  const left = state.options.passLimit ? MAX_PASSES - player.passes : 99;
  const weight = left <= 0 ? 14 : left === 1 ? 7 : left === 2 ? 3 : 2;
  score += weight * Math.min(flex, 3);
  if (flex === 0 && left <= 0) score -= 60;

  // 점수 모으기에서는 큰 카드를 조금 먼저 턴다.
  if (state.options.endMode === 'points') score += card.rank * 0.3;
  return score;
}

/**
 * 컴퓨터가 지금 할 행동을 정한다.
 * - 쉬움: 낼 수 있는 카드 중 아무거나
 * - 보통: evaluatePlay 점수가 가장 높은 카드
 * 낼 카드가 없으면 통과한다.
 */
export function decideAction(state: SevensState, level: AiLevel, rng: Rng = Math.random): SevensAction {
  if (state.phase === 'roundover') return { type: 'nextRound' };
  const cards = playableCards(state);
  if (cards.length === 0) return { type: 'pass' };
  if (level === 'ai-easy') return { type: 'play', cardId: (pick(cards, rng) ?? cards[0]).id };
  let best = cards[0];
  let bestScore = -Infinity;
  for (const card of cards) {
    const score = evaluatePlay(state, card) + rng() * 0.5;
    if (score > bestScore) {
      best = card;
      bestScore = score;
    }
  }
  return { type: 'play', cardId: best.id };
}
