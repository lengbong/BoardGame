import { pick, shuffle } from '../../lib/random';
import { allCodes, isConsistent, randomCode } from './rules';
import type { BaseballOptions, BaseballState, DuelAiLevel, Guess, Rng } from './types';

/**
 * 컴퓨터가 기억하는 최근 결과 수 (그보다 오래된 결과는 잊는다).
 * 3자리 1~9에서 평균 쉬움 약 7.8번, 보통 약 5.6번, 어려움 약 4.8번 만에 맞힌다.
 */
export const EASY_MEMORY = 2;
export const NORMAL_MEMORY = 3;

/** 어려움이 한 번에 견주어 보는 숫자 수 (너무 오래 생각하지 않게) */
const HARD_POOL = 260;

export function decideSecret(options: Pick<BaseballOptions, 'length' | 'zero'>, rng: Rng = Math.random): number[] {
  return randomCode(options, rng);
}

/** 숫자마다 비트 하나: 공통 숫자 수를 빠르게 센다 */
function maskOf(code: readonly number[]): number {
  let m = 0;
  for (const d of code) m |= 1 << d;
  return m;
}

function popcount(x: number): number {
  let n = 0;
  while (x) {
    x &= x - 1;
    n += 1;
  }
  return n;
}

/**
 * guess를 쳤을 때 나올 결과마다 남는 후보 수의 제곱 합 (작을수록 후보를 고르게 나눈다).
 * 결과 칸 = 스트라이크 × 5 + 볼
 */
function splitScore(guess: readonly number[], candidates: readonly (readonly number[])[], masks: readonly number[]): number {
  const counts = new Array<number>(25).fill(0);
  const gm = maskOf(guess);
  const n = guess.length;
  for (let k = 0; k < candidates.length; k++) {
    const c = candidates[k];
    let strikes = 0;
    for (let i = 0; i < n; i++) if (c[i] === guess[i]) strikes += 1;
    const common = popcount(gm & masks[k]);
    counts[strikes * 5 + common - strikes] += 1;
  }
  let score = 0;
  for (const x of counts) score += x * x;
  return score;
}

function sameCode(a: readonly number[], b: readonly number[]): boolean {
  return a.every((d, i) => d === b[i]);
}

/**
 * 어려움: 후보를 가장 고르게 나누는 숫자를 친다. 후보가 아닌 숫자도 견주어 보되, 점수가 같으면 후보(맞힐 수도 있는 숫자)를 고른다.
 */
function bestSplit(candidates: number[][], options: Pick<BaseballOptions, 'length' | 'zero'>, tried: readonly Guess[], rng: Rng): number[] {
  if (candidates.length <= 2) return pick(candidates, rng) ?? candidates[0];
  const masks = candidates.map(maskOf);
  const fromCandidates = candidates.length > HARD_POOL ? shuffle(candidates, rng).slice(0, HARD_POOL) : candidates;
  // 후보가 적을 때는 후보가 아닌 숫자가 더 잘 나누기도 한다.
  const extra =
    candidates.length <= 80
      ? shuffle(allCodes(options.length, options.zero), rng)
          .filter((c) => !tried.some((g) => sameCode(g.digits, c)))
          .slice(0, 160)
      : [];
  const candidateSet = new Set(candidates);
  let best: number[] = fromCandidates[0];
  let bestScore = Infinity;
  let bestIsCandidate = true;
  for (const g of [...fromCandidates, ...extra]) {
    const isCandidate = candidateSet.has(g);
    // 후보면 맞힐 수도 있으므로 조금 더 좋게 친다 (자기 자신 칸 1개가 홈런으로 끝난다).
    const score = splitScore(g, candidates, masks) - (isCandidate ? 1 : 0);
    if (score < bestScore || (score === bestScore && isCandidate && !bestIsCandidate)) {
      best = g;
      bestScore = score;
      bestIsCandidate = isCandidate;
    }
  }
  return best;
}

/**
 * 컴퓨터가 칠 숫자를 정한다. 상대의 비밀 숫자는 보지 않고, 내가 친 숫자와 결과만 쓴다.
 * - 쉬움: 최근 결과 2개만 기억하고, 그와 맞는 숫자 중 아무거나 친다 (오래된 결과는 잊어버림)
 * - 보통: 최근 결과 3개를 기억하고, 그와 맞는 숫자 중 아무거나 친다
 * - 어려움: 모든 결과를 기억하고, 결과와 맞는 숫자들을 가장 고르게 나누는 숫자를 골라 친다
 */
export function decideGuess(state: BaseballState, level: DuelAiLevel, rng: Rng = Math.random): number[] {
  const options = state.options;
  const tried = state.players[state.current].guesses;
  const codes = allCodes(options.length, options.zero);
  const fresh = (c: readonly number[]) => !tried.some((g) => sameCode(g.digits, c));

  if (tried.length === 0) return randomCode(options, rng);

  if (level === 'ai-easy' || level === 'ai-normal') {
    const memory = tried.slice(-(level === 'ai-easy' ? EASY_MEMORY : NORMAL_MEMORY));
    const pool = codes.filter((c) => fresh(c) && isConsistent(c, memory));
    const fallback = codes.filter(fresh);
    return [...(pick(pool, rng) ?? pick(fallback, rng) ?? codes[0])];
  }

  const candidates = codes.filter((c) => isConsistent(c, tried));
  if (candidates.length === 0) return [...(pick(codes.filter(fresh), rng) ?? codes[0])];
  return [...bestSplit(candidates, options, tried, rng)];
}
