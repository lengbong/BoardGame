import { pick } from '../../lib/random';
import { isJoker } from '../common/playingCards';
import { drawTarget, prevActive } from './rules';
import type { OldMaidAction, OldMaidState, Rng } from './types';

export type AiLevel = 'ai-easy' | 'ai-normal';

/**
 * me가 '본 것으로' 아는 조커 자리 (target 손패에서 몇 번째인지). 모르면 -1.
 * 모두 공개 모드이거나, 조커가 옮겨 가는 것을 보고 기억하는 경우에만 알 수 있다. 몰래 보지 않는다.
 */
export function knownJokerIndex(state: OldMaidState, me: number, target: number): number {
  const open = state.options.handView === 'open';
  if (!open && !state.jokerKnownBy.includes(me)) return -1;
  return state.players[target]?.hand.findIndex(isJoker) ?? -1;
}

/**
 * 조커를 숨길 자리 (0 왼쪽 ~ 1 오른쪽).
 * 내 카드를 뽑아 가는 사람이 지금까지 가장 덜 뽑은 쪽에 둔다. (그 사람이 뽑은 위치는 모두가 본 정보)
 */
export function jokerSpotFor(state: OldMaidState, me: number, rng: Rng = Math.random): number {
  const drawer = prevActive(state, me);
  const counts = drawer >= 0 ? state.picks[drawer] : undefined;
  if (!counts || counts[0] + counts[1] + counts[2] < 2) return rng();
  const spots: [number, number][] = [
    [counts[0], 0.04],
    [counts[1], 0.5],
    [counts[2], 0.96],
  ];
  const min = Math.min(...counts);
  return (pick(spots.filter(([c]) => c === min), rng) ?? spots[1])[1];
}

/**
 * 컴퓨터가 지금 할 행동을 정한다.
 * - 쉬움: 아무 카드나 뽑는다.
 * - 보통: 뒷면만 보이므로 역시 아무 카드나 뽑지만, 조커 자리를 '본 것으로' 알면 피한다.
 *   모두 공개 모드에서는 짝이 맞는 카드를 고른다. 뽑은 뒤 조커를 상대가 덜 뽑는 쪽에 숨긴다.
 * 컴퓨터는 뽑은 뒤 언제나 손패를 섞는다.
 */
export function decideAction(state: OldMaidState, level: AiLevel, rng: Rng = Math.random): OldMaidAction {
  if (state.phase === 'deal') return { type: 'discardPairs' };
  const me = state.current;
  const target = drawTarget(state);
  const hand = target >= 0 ? state.players[target].hand : [];
  let choices = hand.map((_, i) => i);
  let jokerSpot: number | undefined;

  if (level === 'ai-normal') {
    const ji = knownJokerIndex(state, me, target);
    if (ji >= 0 && choices.length > 1) choices = choices.filter((i) => i !== ji);
    if (state.options.handView === 'open') {
      const mine = new Set(state.players[me].hand.filter((c) => !isJoker(c)).map((c) => c.rank));
      const pairing = choices.filter((i) => !isJoker(hand[i]) && mine.has(hand[i].rank));
      if (pairing.length > 0) choices = pairing;
    }
    jokerSpot = jokerSpotFor(state, me, rng);
  }

  return { type: 'draw', index: pick(choices, rng) ?? 0, shuffle: true, jokerSpot };
}
