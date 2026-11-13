import { pick } from '../../lib/random';
import { createSet, hasNumber, isDouble, tilePips } from './dominoes';
import { balancedSide, canDraw, endsAfter, legalMoves } from './rules';
import type { DominoAction, DominoState, Rng, Side, Tile } from './types';

export type AiLevel = 'ai-easy' | 'ai-normal';

/** 내 손에도 줄에도 없는 패 (다른 사람 손이나 뽑는 더미에 있다) */
export function unseenTiles(state: DominoState, me: number): Tile[] {
  const seen = new Set<number>([...state.line.map((p) => p.tile.id), ...state.players[me].hand.map((t) => t.id)]);
  return createSet().filter((t) => !seen.has(t.id));
}

/**
 * 패를 그 끝에 냈을 때 얼마나 좋은지 점수로 평가한다 (높을수록 좋음).
 * - 점이 많은 패와 더블은 일찍 털어 낸다.
 * - 낸 뒤에도 내가 이어 낼 수 있는 끝을 남기고, 여러 숫자를 골고루 남긴다.
 * - 다른 사람이 뽑거나 통과할 때 없던 숫자로 끝을 만들어 막는다.
 */
export function scoreMove(state: DominoState, tile: Tile, side: Side): number {
  const me = state.current;
  const rest = state.players[me].hand.filter((t) => t.id !== tile.id);
  if (rest.length === 0) return 100_000;

  const ends = endsAfter(state, tile, side);
  const endVals = ends.left === ends.right ? [ends.left] : [ends.left, ends.right];
  let score = 0;

  // 1) 무거운 패부터: 판이 끝났을 때 손에 남는 점을 줄인다.
  score += tilePips(tile);
  // 2) 더블은 붙일 숫자가 하나뿐이라 늦게 내기 어렵다.
  if (isDouble(tile)) score += 5;
  // 3) 다음 차례에도 이어 낼 수 있는 패가 남는지
  const follow = rest.filter((t) => endVals.some((v) => hasNumber(t, v))).length;
  score += Math.min(follow, 4) * 3;
  if (follow === 0) score -= 8;
  // 4) 여러 숫자를 골고루 남긴다.
  score += new Set(rest.flatMap((t) => [t.a, t.b])).size * 1.2;
  // 5) 막기: 뽑거나 통과하는 것을 보고 알게 된 '없는 숫자'로 끝을 만든다. 다음 사람일수록, 패가 적을수록 중요하다.
  const n = state.players.length;
  for (let k = 1; k < n; k++) {
    const opp = state.players[(me + k) % n];
    const weight = (k === 1 ? 1 : 0.5) * (opp.hand.length <= 2 ? 2 : 1);
    const lacked = endVals.filter((v) => opp.lacks.includes(v)).length;
    score += (lacked === endVals.length ? 9 : lacked * 2.5) * weight;
  }
  // 6) 밖에 남은 패가 없는(적은) 숫자를 끝에 두면, 그 숫자를 쥔 나만 이어 낼 수 있다.
  const unseen = unseenTiles(state, me);
  for (const v of endVals) {
    const outside = unseen.filter((t) => hasNumber(t, v)).length;
    const mine = rest.filter((t) => hasNumber(t, v)).length;
    if (outside === 0) score += mine > 0 ? 6 : 2;
    else if (mine >= 2 && outside <= 2) score += 3;
  }
  return score;
}

/** 컴퓨터가 지금 할 행동을 정한다. 쉬움: 낼 수 있는 패 중 아무거나, 보통: scoreMove가 가장 높은 수 */
export function decideAction(state: DominoState, level: AiLevel, rng: Rng = Math.random): DominoAction {
  if (state.phase === 'roundover') return { type: 'nextRound' };
  const moves = legalMoves(state);
  if (moves.length === 0) return canDraw(state) ? { type: 'draw' } : { type: 'pass' };

  if (level === 'ai-easy') {
    const m = pick(moves, rng)!;
    return { type: 'play', tileId: m.tileId, side: m.side };
  }

  const hand = state.players[state.current].hand;
  const prefer = balancedSide(state);
  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const tile = hand.find((t) => t.id === m.tileId)!;
    // 결과가 같으면 줄이 고르게 자라도록 짧은 쪽에 놓는다.
    const s = scoreMove(state, tile, m.side) + (m.side === prefer ? 0.01 : 0);
    if (s > bestScore) {
      best = m;
      bestScore = s;
    }
  }
  return { type: 'play', tileId: best.tileId, side: best.side };
}
