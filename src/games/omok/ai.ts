import { pick } from '../../lib/random';
import { DIRS, dirShape, exactFive, fiveSpots, forbiddenAt, makesFive, nearbyEmpty, other } from './rules';
import type { Cell, DuelAiLevel, OmokState, RuleSet, Stone } from './types';

/**
 * 오목 컴퓨터.
 * 빈칸마다 '내가 두면 생기는 모양(공격)'과 '상대가 두면 생기는 모양(막기)'을 점수로 매긴다.
 * 어려움은 사를 연달아 두어 이기는 길(연속 사, VCF)을 찾고, 상대의 가장 좋은 대답까지 따져 본다.
 * 금수 자리에는 두지 않는다.
 */

export const SCORE = {
  five: 1_000_000,
  openFour: 120_000,
  four: 12_000,
  openThree: 6_000,
  closedThree: 700,
  two: 90,
  one: 10,
};

export interface MoveValue {
  score: number;
  five: boolean;
  openFour: boolean;
  fours: number;
  openThrees: number;
}

/** side가 index(빈칸)에 둔다고 볼 때 생기는 모양의 점수 */
export function attackValue(board: Cell[], size: number, index: number, side: Stone, rule: RuleSet): MoveValue {
  const exact = exactFive(rule, side);
  board[index] = side;
  const v: MoveValue = { score: 0, five: false, openFour: false, fours: 0, openThrees: 0 };
  for (const [dr, dc] of DIRS) {
    const s = dirShape(board, size, index, dr, dc, side, exact);
    if (s.five) {
      v.five = true;
      v.score += SCORE.five;
    } else if (s.spots >= 2) {
      v.openFour = true;
      v.fours += 1;
      v.score += SCORE.openFour;
    } else if (s.spots === 1) {
      v.fours += 1;
      v.score += SCORE.four;
    } else if (s.openThree) {
      v.openThrees += 1;
      v.score += SCORE.openThree;
    } else if (s.closedThree) {
      v.score += SCORE.closedThree;
    } else if (s.twoWindows > 0) {
      v.score += SCORE.two * Math.min(3, s.twoWindows);
    } else {
      v.score += SCORE.one;
    }
  }
  board[index] = -1;
  if (!v.five) {
    if (v.fours >= 2) v.score += 100_000;
    else if (v.fours >= 1 && v.openThrees >= 1) v.score += 80_000;
    else if (v.openThrees >= 2) v.score += 40_000;
  }
  return v;
}

interface Cand {
  index: number;
  att: MoveValue;
  def: MoveValue | null;
  score: number;
}

/** 둘 수 있는 자리들과 점수 (공격 + 막기 × 0.9). 상대의 금수 자리는 막을 필요가 없다 */
function candidates(board: Cell[], size: number, me: Stone, rule: RuleSet, defenseWeight = 0.9): Cand[] {
  const opp = other(me);
  let spots = nearbyEmpty(board, size, 2).filter((i) => !forbiddenAt(board, size, i, me, rule));
  if (spots.length === 0) spots = board.map((c, i) => (c === -1 && !forbiddenAt(board, size, i, me, rule) ? i : -1)).filter((i) => i >= 0);
  return spots.map((index) => {
    const att = attackValue(board, size, index, me, rule);
    const def = forbiddenAt(board, size, index, opp, rule) ? null : attackValue(board, size, index, opp, rule);
    return { index, att, def, score: att.score + (def ? def.score * defenseWeight : 0) };
  });
}

/** side가 index에 둔 뒤 다섯이 되는 빈칸들 (모든 방향) */
function winningSpots(board: Cell[], size: number, index: number, side: Stone, rule: RuleSet): number[] {
  const exact = exactFive(rule, side);
  const out = new Set<number>();
  for (const [dr, dc] of DIRS) for (const p of fiveSpots(board, size, index, dr, dc, side, exact)) out.add(p);
  return [...out];
}

/**
 * 연속 사(VCF): 사를 두면 상대는 막을 수밖에 없다. 이것을 이어 가다 열린 사·쌍사로 이기는 길을 찾는다.
 * 찾으면 첫 수, 없으면 null. budget은 살펴볼 수 있는 수의 개수 (오래 생각하지 않게)
 */
export function findVcf(board: Cell[], size: number, side: Stone, rule: RuleSet, depth = 10, budget = { n: 2500 }): number | null {
  if (depth <= 0 || budget.n <= 0) return null;
  const opp = other(side);
  for (const i of nearbyEmpty(board, size, 2)) {
    if (budget.n-- <= 0) return null;
    if (forbiddenAt(board, size, i, side, rule)) continue;
    if (makesFive(board, size, i, side, rule)) return i;
    board[i] = side;
    const wins = winningSpots(board, size, i, side, rule);
    if (wins.length === 0) {
      board[i] = -1;
      continue;
    }
    if (wins.length >= 2 || forbiddenAt(board, size, wins[0], opp, rule)) {
      board[i] = -1;
      return i;
    }
    // 상대가 막는다. 막는 수로 상대가 다섯이 되거나 사가 생기면 이 길은 믿을 수 없다
    const blockAt = wins[0];
    const oppFive = makesFive(board, size, blockAt, opp, rule);
    board[blockAt] = opp;
    const oppFour = !oppFive && winningSpots(board, size, blockAt, opp, rule).length > 0;
    let found: number | null = null;
    if (!oppFive && !oppFour) found = findVcf(board, size, side, rule, depth - 1, budget);
    board[blockAt] = -1;
    board[i] = -1;
    if (found !== null) return i;
  }
  return null;
}

function best(cands: Cand[], rng: () => number): Cand {
  const top = Math.max(...cands.map((c) => c.score));
  return pick(cands.filter((c) => c.score >= top - 1e-9), rng) ?? cands[0];
}

/** 두면 다음에 막을 수 없게 되는 수: 열린 사, 쌍사, 사삼 */
function isWinning(v: MoveValue): boolean {
  return v.openFour || v.fours >= 2 || (v.fours >= 1 && v.openThrees >= 1);
}

/** side가 지금 두면 이기는 모양이 되는 자리들 */
function winningMoves(board: Cell[], size: number, side: Stone, rule: RuleSet): number[] {
  const out: number[] = [];
  for (const i of nearbyEmpty(board, size, 2)) {
    if (forbiddenAt(board, size, i, side, rule)) continue;
    if (isWinning(attackValue(board, size, i, side, rule))) out.push(i);
  }
  return out;
}

/**
 * 컴퓨터가 둘 칸을 정한다.
 * - 쉬움: 바로 이기는 수·바로 막는 수도 가끔 놓치고, 막기를 덜 하며 점수에 큰 흔들림을 섞는다
 * - 보통: 이기는 수 → 막는 수 → 열린 사·쌍사·사삼 → 짧은 연속 사 → 점수가 가장 높은 칸
 * - 어려움: 보통 + 긴 연속 사, 상대의 가장 좋은 대답과 상대의 연속 사, 다음에 이기는 모양을 만들 수 있는지까지 본다
 */
export function decideMove(state: OmokState, level: DuelAiLevel, rng: () => number = Math.random): number {
  const size = state.size;
  const rule = state.options.rule;
  const board = [...state.board];
  const me = state.current;
  const opp = other(me);
  const cands = candidates(board, size, me, rule, level === 'ai-easy' ? 0.35 : 0.9);
  if (cands.length === 0) return board.findIndex((c) => c === -1);

  const myFive = cands.filter((c) => c.att.five);
  const oppFive = cands.filter((c) => c.def?.five);

  if (level === 'ai-easy') {
    if (myFive.length > 0 && rng() < 0.85) return myFive[0].index;
    if (oppFive.length > 0 && rng() < 0.7) return oppFive[0].index;
    if (rng() < 0.12) return (pick(cands, rng) ?? cands[0]).index;
    const noisy = cands.map((c) => ({ ...c, score: (c.score - (c.att.five ? SCORE.five : 0)) * (0.3 + rng() * 1.4) }));
    return best(noisy, rng).index;
  }

  if (myFive.length > 0) return myFive[0].index;
  if (oppFive.length > 0) return oppFive[0].index;
  const winning = cands.filter((c) => isWinning(c.att));
  if (winning.length > 0) return best(winning, rng).index;
  const hard = level === 'ai-hard';
  const vcf = findVcf(board, size, me, rule, hard ? 10 : 6, { n: hard ? 2500 : 600 });
  if (vcf !== null) return vcf;
  if (!hard) return best(cands, rng).index;

  // 어려움: 앞을 내다본다
  const top = [...cands].sort((a, b) => b.score - a.score).slice(0, 12);
  let bestIdx = top[0].index;
  let bestVal = -Infinity;
  for (const c of top) {
    board[c.index] = me;
    const replies = candidates(board, size, opp, rule);
    let oppBest = 0;
    let oppWins = false;
    for (const r of replies) {
      if (r.att.five) oppWins = true;
      oppBest = Math.max(oppBest, r.score);
    }
    let value = c.score - 0.85 * oppBest;
    if (oppWins) value -= 2 * SCORE.five;
    else if (findVcf(board, size, opp, rule, 8, { n: 900 }) !== null) value -= SCORE.five;
    else {
      // 이 수를 두면 다음에 이기는 모양을 만들 자리가 생기는지 (두 군데면 상대가 다 막을 수 없다)
      const threats = winningMoves(board, size, me, rule).length;
      if (threats >= 2) value += 300_000;
      else if (threats === 1) value += 30_000;
    }
    board[c.index] = -1;
    if (value > bestVal) {
      bestVal = value;
      bestIdx = c.index;
    }
  }
  return bestIdx;
}
