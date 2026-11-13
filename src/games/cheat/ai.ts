import { pick, shuffle } from '../../lib/random';
import { DECK_SIZE, MAX_PLAY, upcomingRanks } from './rules';
import type { Card, CheatState, Rng } from './types';

export type AiLevel = 'ai-easy' | 'ai-normal';

/** C(n, k) */
function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** 위치를 모르는 카드 unknown장 중 rank 카드가 left장일 때, hand장을 든 사람이 그 숫자를 x장 가지고 있을 확률 (초기하 분포) */
export function holdChance(unknown: number, left: number, hand: number, x: number): number {
  const total = choose(unknown, hand);
  if (total === 0 || x < 0 || x > left || x > hand) return 0;
  return (choose(left, x) * choose(unknown - left, hand - x)) / total;
}

/**
 * 사람들이 보통 이렇게 낸다고 보고 '말한 장수'로부터 진짜일 확률을 어림한다 (베이즈).
 * - 그 숫자를 x장(1장 이상) 가지고 있으면: 대개(80%) x장을 그대로 내고, 가끔(20%) 한 장을 몰래 더 끼운다.
 * - 하나도 없으면: 대개(80%) 아무 카드 한 장, 가끔(20%) 두 장으로 거짓말한다.
 */
export function truthChance(unknown: number, left: number, handBefore: number, count: number): number {
  const p = (x: number) => holdChance(unknown, left, handBefore, x);
  const truth = p(count) * (count >= 4 || handBefore === count ? 1 : 0.8);
  let lie = count >= 2 ? p(count - 1) * 0.2 : 0;
  if (count === 1) lie += p(0) * 0.8;
  if (count === 2) lie += p(0) * 0.2;
  return truth + lie > 0 ? truth / (truth + lie) : 0;
}

/**
 * me가 아는 것만으로 본 '의심받는 카드가 진짜일 확률'과 '확실한 거짓말'인지.
 * 아는 것: 내 손패, 내가 더미에 낸 카드. (남의 손패나 뒷면 카드는 보지 않는다)
 */
export function judgeClaim(state: CheatState, me: number): { certainLie: boolean; chance: number } {
  const claim = state.claim;
  if (!claim) return { certainLie: false, chance: 1 };
  if (state.options.handView === 'open') {
    // 모두 공개: 누구나 손패를 보았으니 컴퓨터도 안다.
    const lie = claim.cards.some((c) => c.rank !== claim.rank);
    return { certainLie: lie, chance: lie ? 0 : 1 };
  }
  const mine = state.players[me].hand;
  const minePile = state.pile.filter((pc) => pc.by === me).map((pc) => pc.card);
  const seen = mine.filter((c) => c.rank === claim.rank).length + minePile.filter((c) => c.rank === claim.rank).length;
  const left = 4 - seen;
  if (claim.count > left) return { certainLie: true, chance: 0 };
  const unknown = DECK_SIZE - mine.length - minePile.length;
  const handBefore = state.players[claim.player].hand.length + claim.count;
  return { certainLie: false, chance: truthChance(unknown, left, handBefore, claim.count) };
}

/**
 * 컴퓨터가 '거짓말!'을 외칠지 정한다.
 * - 쉬움: 확실한 거짓말도 가끔 놓치고, 그 밖에는 가끔 아무 때나 외친다.
 * - 보통: 확실한 거짓말(내 손패와 내가 낸 카드로 보아 그 숫자가 모자람)은 꼭 잡고, 아니면 진짜일 확률을
 *   어림해서 아주 낮을 때만 의심한다. 더미가 크면 더 조심하고, 상대가 마지막 카드를 내면 웬만하면 의심한다.
 *   (컴퓨터끼리 해 보면 보통이 쉬움보다 훨씬 자주 이긴다)
 */
export function decideDoubt(state: CheatState, me: number, level: AiLevel, rng: Rng = Math.random): boolean {
  const claim = state.claim;
  if (!claim || state.phase !== 'doubt') return false;
  const { certainLie, chance } = judgeClaim(state, me);
  const claimantLeft = state.players[claim.player].hand.length;

  if (level === 'ai-easy') {
    if (certainLie) return rng() < 0.7;
    if (claimantLeft === 0) return rng() < 0.5;
    return rng() < 0.08 + 0.06 * (claim.count - 1);
  }

  if (certainLie) return true;
  // 마지막 카드는 그냥 두면 그 사람이 이기므로 웬만하면 의심한다.
  if (claimantLeft === 0) return chance < 0.75 || rng() < 0.5;
  // 틀리면 더미를 가져가야 하므로 꽤 수상할 때만 외친다. 더미가 크거나 내가 거의 다 냈으면 더 조심한다.
  let threshold = 0.2;
  if (state.pile.length >= 10) threshold -= 0.07;
  if (state.players[me].hand.length <= 3) threshold -= 0.05;
  threshold += (rng() - 0.5) * 0.1;
  return chance < threshold;
}

/**
 * 버리기 좋은(거짓말로 낼) 카드 순서: 내 차례에 금방 필요하지 않은 숫자, 그중에도 한 장뿐인 숫자부터.
 * soon: 다음 내 차례들에 낼 숫자 (앞일수록 중요)
 */
function junkOrder(hand: Card[], soon: number[], rng: Rng): Card[] {
  const need = (rank: number) => {
    const i = soon.indexOf(rank);
    return i < 0 ? 0 : soon.length - i;
  };
  const count = (rank: number) => hand.filter((c) => c.rank === rank).length;
  return shuffle(hand, rng).sort((a, b) => need(a.rank) - need(b.rank) || count(a.rank) - count(b.rank));
}

/**
 * 컴퓨터가 낼 카드를 정한다. 지금 숫자 카드가 있으면 그대로 내고, 없으면 거짓말을 한다.
 * - 쉬움: 지금 숫자 카드를 다 내거나, 없으면 아무 카드 한 장
 * - 보통: 없으면 다음 내 차례들에 쓸 숫자는 남기고 필요 없는(금방 안 쓰는, 한 장뿐인) 카드로 거짓말한다.
 * 손에 남은 카드가 모두 지금 숫자면 한꺼번에 내서 끝낸다.
 */
export function decidePlay(state: CheatState, level: AiLevel, rng: Rng = Math.random): number[] {
  const me = state.current;
  const hand = state.players[me].hand;
  const rank = state.rank;
  const match = hand.filter((c) => c.rank === rank);
  const others = hand.filter((c) => c.rank !== rank);
  if (hand.length === 0) return [];

  if (match.length === hand.length && hand.length <= MAX_PLAY) return hand.map((c) => c.id);

  if (level === 'ai-easy') {
    if (match.length > 0) return match.map((c) => c.id);
    return [(pick(hand, rng) ?? hand[0]).id];
  }

  const n = state.players.length;
  // 이번 차례 다음부터 내 차례에 낼 숫자들
  const soon = upcomingRanks(state, me, 5).slice(1, 1 + Math.max(2, Math.ceil(8 / n)));
  const junk = junkOrder(others, soon, rng);
  // 진짜 카드가 있으면 그대로 낸다. (몰래 한 장 더 끼우면 들키기 쉬워서 손해다)
  if (match.length > 0) return match.map((c) => c.id);

  // 거짓말: 보통은 한 장, 손패가 많고 더미가 작으면 가끔 두 장
  const howMany = hand.length >= 8 && state.pile.length <= 4 && rng() < 0.3 ? 2 : 1;
  return junk.slice(0, howMany).map((c) => c.id);
}
