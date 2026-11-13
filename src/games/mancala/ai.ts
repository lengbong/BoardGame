import type { DuelAiLevel } from '../common/duel';
import { pick } from '../../lib/random';
import { CELLS, PITS, legalMoves, other, storeOf } from './rules';
import type { MancalaAction, MancalaOptions, MancalaState, Rng, Side } from './types';

/**
 * 만칼라 컴퓨터 플레이어
 * - 쉬움: 대부분 아무 구멍이나, 가끔 바로 눈앞에서 가장 많이 얻는 수
 * - 보통: 알파-베타 탐색 4수 앞까지 (한 번 더는 같은 사람이 이어서 두는 것으로 계산)
 * - 어려움: 알파-베타 반복 심화 (최대 12수, 수 순서 정렬, 시간 0.6초까지)
 * 평가는 두 창고의 씨앗 차이. 끝난 판은 남은 씨앗 정리까지 계산한 최종 점수로 본다.
 */
export interface AiOptions {
  /** 어려움의 생각 시간 한도 (ms). 기본 600 */
  timeMs?: number;
  /** 탐색 깊이 (수). 기본: 보통 4, 어려움 12 */
  maxDepth?: number;
  /** 시간 재는 함수 (테스트용) */
  now?: () => number;
}

type Rules = Pick<MancalaOptions, 'captureEmpty' | 'sweep'>;

/** 결과 코드: 0 보통, 1 한 번 더, 2 끝남. out에 새 판을 쓴다. */
const NORMAL = 0;
const EXTRA = 1;
const OVER = 2;

/** 빠른 한 수 (경로·기록 없이). board는 그대로 두고 out에 결과를 쓴다. */
export function fastMove(board: ArrayLike<number>, side: Side, pit: number, rules: Rules, out: number[]): number {
  for (let i = 0; i < CELLS; i++) out[i] = board[i];
  let seeds = out[pit];
  out[pit] = 0;
  const skip = side === 0 ? 13 : 6;
  const myStore = side === 0 ? 6 : 13;
  let i = pit;
  // 한 바퀴(13칸)를 넘으면 한꺼번에 나눠 넣는다.
  if (seeds >= 13) {
    const laps = Math.floor(seeds / 13);
    for (let k = 0; k < CELLS; k++) if (k !== skip) out[k] += laps;
    seeds -= laps * 13;
  }
  while (seeds > 0) {
    i = i === 13 ? 0 : i + 1;
    if (i === skip) continue;
    out[i] += 1;
    seeds -= 1;
  }
  let result = i === myStore ? EXTRA : NORMAL;
  const mine = side === 0 ? i <= 5 : i >= 7 && i <= 12;
  if (result === NORMAL && mine && out[i] === 1) {
    const opp = 12 - i;
    if (out[opp] > 0 || rules.captureEmpty) {
      out[myStore] += out[opp] + 1;
      out[i] = 0;
      out[opp] = 0;
    }
  }
  let s0 = 0;
  let s1 = 0;
  for (let k = 0; k < PITS; k++) {
    s0 += out[k];
    s1 += out[7 + k];
  }
  if (s0 === 0 || s1 === 0) {
    if (rules.sweep === 'emptier' && !(s0 === 0 && s1 === 0)) {
      const to = s0 === 0 ? 6 : 13;
      out[to] += s0 + s1;
    } else {
      out[6] += s0;
      out[13] += s1;
    }
    for (let k = 0; k < PITS; k++) {
      out[k] = 0;
      out[7 + k] = 0;
    }
    result = OVER;
  }
  return result;
}

const WIN = 1000;

function terminalValue(b: ArrayLike<number>, root: Side): number {
  const diff = b[storeOf(root)] - b[storeOf(other(root))];
  return diff > 0 ? WIN + diff : diff < 0 ? -WIN + diff : 0;
}

function storeDiff(b: ArrayLike<number>, root: Side): number {
  return b[storeOf(root)] - b[storeOf(other(root))];
}

interface Child {
  pit: number;
  board: number[];
  code: number;
  order: number;
}

/** 자식 수를 만들고 좋아 보이는 순서로 정렬한다: 한 번 더(창고에 가까운 구멍 먼저) → 창고에 많이 넣는 수 */
function children(b: ArrayLike<number>, side: Side, rules: Rules, pits?: number[]): Child[] {
  const list: Child[] = [];
  const store = storeOf(side);
  const start = side * 7;
  const candidates = pits ?? Array.from({ length: PITS }, (_, k) => start + k);
  for (const pit of candidates) {
    if (b[pit] === 0) continue;
    const out = new Array<number>(CELLS);
    const code = fastMove(b, side, pit, rules, out);
    const gain = out[store] - b[store];
    const order = code === EXTRA ? 100 + pit - start : code === OVER ? 50 + gain : gain;
    list.push({ pit, board: out, code, order });
  }
  list.sort((a, c) => c.order - a.order);
  return list;
}

interface Ctx {
  rules: Rules;
  root: Side;
  deadline: number;
  now: () => number;
  nodes: number;
  aborted: boolean;
}

/**
 * 알파-베타 탐색. 값은 root 편이 보기에 (창고 차이).
 * depth는 반 수 단위: 보통 수는 2, '한 번 더' 수는 1을 쓴다 (같은 사람이 이어서 두므로 덜 깎는다).
 */
function search(b: ArrayLike<number>, toMove: Side, depth: number, alpha: number, beta: number, ctx: Ctx): number {
  ctx.nodes += 1;
  if ((ctx.nodes & 2047) === 0 && ctx.now() > ctx.deadline) ctx.aborted = true;
  if (ctx.aborted) return 0;
  if (depth <= 0) return storeDiff(b, ctx.root);
  const maximizing = toMove === ctx.root;
  const kids = children(b, toMove, ctx.rules);
  let best = maximizing ? -Infinity : Infinity;
  for (const c of kids) {
    let v: number;
    if (c.code === OVER) v = terminalValue(c.board, ctx.root);
    else if (c.code === EXTRA) v = search(c.board, toMove, depth - 1, alpha, beta, ctx);
    else v = search(c.board, other(toMove), depth - 2, alpha, beta, ctx);
    if (maximizing) {
      if (v > best) best = v;
      if (best > alpha) alpha = best;
    } else {
      if (v < best) best = v;
      if (best < beta) beta = best;
    }
    if (alpha >= beta) break;
  }
  return best;
}

/** 뿌리 수마다 정확한 값 (보통 컴퓨터가 같은 값끼리 골고루 고르려고 쓴다) */
function rootValues(state: MancalaState, depth: number, ctx: Ctx, pits: number[]): { pit: number; value: number }[] {
  const side = state.current;
  return children(state.board, side, ctx.rules, pits).map((c) => {
    let value: number;
    if (c.code === OVER) value = terminalValue(c.board, side);
    else if (c.code === EXTRA) value = search(c.board, side, depth * 2 - 1, -Infinity, Infinity, ctx);
    else value = search(c.board, other(side), depth * 2 - 2, -Infinity, Infinity, ctx);
    return { pit: c.pit, value };
  });
}

/** 반복 심화 알파-베타. 시간이 다 되면 마지막으로 끝까지 계산한 깊이의 가장 좋은 수를 쓴다. */
function iterativeBest(state: MancalaState, maxDepth: number, ctx: Ctx, pits: number[]): number {
  const side = state.current;
  let order = children(state.board, side, ctx.rules, pits);
  let bestPit = order[0].pit;
  for (let depth = 1; depth <= maxDepth; depth++) {
    let alpha = -Infinity;
    let iterBest = order[0].pit;
    const scored: { child: Child; value: number }[] = [];
    for (const c of order) {
      let v: number;
      if (c.code === OVER) v = terminalValue(c.board, side);
      else if (c.code === EXTRA) v = search(c.board, side, depth * 2 - 1, alpha, Infinity, ctx);
      else v = search(c.board, other(side), depth * 2 - 2, alpha, Infinity, ctx);
      if (ctx.aborted) break;
      scored.push({ child: c, value: v });
      if (v > alpha) {
        alpha = v;
        iterBest = c.pit;
      }
    }
    if (ctx.aborted) break;
    bestPit = iterBest;
    // 확실히 이기는 수를 찾았으면 더 볼 필요 없다.
    if (alpha >= WIN) break;
    // 다음 깊이는 이번 깊이에서 좋았던 수부터 본다 (가장 좋은 수를 맨 앞에).
    order = scored
      .slice()
      .sort((a, b) => (a.child.pit === iterBest ? -1 : b.child.pit === iterBest ? 1 : b.value - a.value))
      .map((x) => x.child);
  }
  return bestPit;
}

/** 쉬움의 욕심 수: 바로 창고에 가장 많이 넣는 수 (한 번 더는 조금 더 쳐 준다) */
function greedyPit(state: MancalaState, pits: number[], rng: Rng): number {
  const side = state.current;
  const store = storeOf(side);
  const out = new Array<number>(CELLS);
  let best = -Infinity;
  let bests: number[] = [];
  for (const pit of pits) {
    const code = fastMove(state.board, side, pit, state.options, out);
    const value = out[store] - state.board[store] + (code === EXTRA ? 1.5 : 0);
    if (value > best + 1e-9) {
      best = value;
      bests = [pit];
    } else if (Math.abs(value - best) <= 1e-9) bests.push(pit);
  }
  return pick(bests, rng) ?? pits[0];
}

export function decideAction(state: MancalaState, level: DuelAiLevel, rng: Rng = Math.random, opts: AiOptions = {}): MancalaAction {
  const pits = legalMoves(state);
  if (pits.length === 0) throw new Error('둘 수 있는 구멍이 없어요');
  if (pits.length === 1) return { type: 'sow', pit: pits[0] };
  const now = opts.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const rules: Rules = { captureEmpty: state.options.captureEmpty, sweep: state.options.sweep };

  if (level === 'ai-easy') {
    if (rng() < 0.35) return { type: 'sow', pit: greedyPit(state, pits, rng) };
    return { type: 'sow', pit: pick(pits, rng)! };
  }

  if (level === 'ai-normal') {
    const ctx: Ctx = { rules, root: state.current, deadline: Infinity, now, nodes: 0, aborted: false };
    const values = rootValues(state, opts.maxDepth ?? 4, ctx, pits);
    const best = Math.max(...values.map((v) => v.value));
    const bests = values.filter((v) => v.value >= best - 1e-9).map((v) => v.pit);
    return { type: 'sow', pit: pick(bests, rng) ?? bests[0] };
  }

  // 어려움: 같은 값의 수는 난수로 섞어 두어 매번 똑같은 판이 되지 않게 한다.
  const shuffled = pits.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const ctx: Ctx = { rules, root: state.current, deadline: now() + (opts.timeMs ?? 600), now, nodes: 0, aborted: false };
  return { type: 'sow', pit: iterativeBest(state, opts.maxDepth ?? 12, ctx, shuffled) };
}
