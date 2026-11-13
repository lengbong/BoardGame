import type { DuelAiLevel } from '../common/duel';
import { legalMoves, flipsFor } from './rules';
import type { ReversiAction, ReversiState, Rng } from './types';

/**
 * 뒤집기 컴퓨터.
 * - 쉬움: 아무 데나 두되 많이 뒤집는 곳·모서리를 조금 더 좋아한다.
 * - 보통: 칸 점수표 + 둘 곳 수(기동력) + 모서리로 3~4수 앞까지 알파-베타 탐색.
 * - 어려움: 시간 제한(약 0.75초) 안에서 점점 깊이 보는 탐색, 더 나은 평가(모서리·모서리 옆 위험·기동력·변두리 돌),
 *   빈칸이 14개 이하(작은 판 16개)이면 끝까지 완전히 읽어 돌 수 차이가 가장 큰 수를 둔다.
 * 판은 테두리를 두른 1차원 배열(메일박스)로 빠르게 다룬다.
 */

const EMPTY = 0;
const WALL = 3;

export const HARD_TIME_MS = 750;
/** 어려움이 끝까지 읽기 시작하는 빈칸 수 */
const SOLVE_EMPTIES: Record<number, number> = { 8: 14, 6: 16 };
const NORMAL_DEPTH: Record<number, number> = { 8: 4, 6: 4 };
/** 판이 끝났을 때 돌 하나 차이의 값 (평가값보다 훨씬 크게) */
const FINAL = 1_000_000;
const INF = 1e12;

export interface AiOptions {
  /** 어려움의 생각 시간 (ms) */
  timeMs?: number;
  now?: () => number;
}

interface Tables {
  n: number;
  W: number;
  dirs: Int16Array;
  /** 판 안쪽 칸 (테두리 좌표) */
  squares: Int16Array;
  /** 탐색 순서: 좋은 칸부터 */
  order: Int16Array;
  /** 보통 평가용 칸 점수 */
  wNormal: Float64Array;
  /** 어려움 평가용 칸 점수 */
  wHard: Float64Array;
  corners: Int16Array;
  /** 모서리마다 그 옆 칸들 (X 1개 + C 2개) */
  cornerNear: Int16Array[];
}

// 판의 1/4 조각 [바깥에서 몇 번째 줄][몇 번째 칸]. 큰 판은 4×4, 작은 판은 앞의 3×3만 쓴다.
const Q_NORMAL = [
  [100, -20, 10, 5],
  [-20, -50, -2, -2],
  [10, -2, -1, -1],
  [5, -2, -1, -1],
];
const Q_HARD = [
  [20, -3, 11, 8],
  [-3, -7, -4, 1],
  [11, -4, 2, 2],
  [8, 1, 2, -3],
];
const Q_ORDER = [
  [9, 2, 7, 6],
  [2, 0, 3, 3],
  [7, 3, 5, 4],
  [6, 3, 4, 4],
];

const tableCache = new Map<number, Tables>();

function tablesFor(n: number): Tables {
  const cached = tableCache.get(n);
  if (cached) return cached;
  const W = n + 2;
  const dirs = new Int16Array([-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1]);
  const squares = new Int16Array(n * n);
  const wNormal = new Float64Array(W * W);
  const wHard = new Float64Array(W * W);
  const ordKey = new Float64Array(W * W);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const sq = (r + 1) * W + (c + 1);
      squares[r * n + c] = sq;
      const a = Math.min(r, n - 1 - r);
      const b = Math.min(c, n - 1 - c);
      wNormal[sq] = Q_NORMAL[a][b];
      wHard[sq] = Q_HARD[a][b];
      ordKey[sq] = Q_ORDER[a][b];
    }
  }
  const order = Int16Array.from([...squares].sort((x, y) => ordKey[y] - ordKey[x] || x - y));
  const pad = (r: number, c: number) => (r + 1) * W + (c + 1);
  const cornerRC: [number, number, number, number][] = [
    [0, 0, 1, 1],
    [0, n - 1, 1, -1],
    [n - 1, 0, -1, 1],
    [n - 1, n - 1, -1, -1],
  ];
  const corners = Int16Array.from(cornerRC.map(([r, c]) => pad(r, c)));
  const cornerNear = cornerRC.map(([r, c, dr, dc]) => Int16Array.from([pad(r + dr, c + dc), pad(r, c + dc), pad(r + dr, c)]));
  const t: Tables = { n, W, dirs, squares, order, wNormal, wHard, corners, cornerNear };
  tableCache.set(n, t);
  return t;
}

class Engine {
  readonly t: Tables;
  readonly cells: Int8Array;
  /** 돌 수: [안 씀, 흑, 백] */
  readonly count = new Int32Array(3);
  private readonly stack = new Int16Array(8192);
  private sp = 0;
  /** 수 깊이마다 쓰는 수 목록 */
  readonly buffers: Int16Array[] = [];

  constructor(state: ReversiState) {
    this.t = tablesFor(state.size);
    const { n, W } = this.t;
    this.cells = new Int8Array(W * W).fill(WALL);
    for (let i = 0; i < n * n; i++) {
      const v = state.board[i];
      const sq = this.t.squares[i];
      this.cells[sq] = v === -1 ? EMPTY : v + 1;
      if (v !== -1) this.count[v + 1] += 1;
    }
    for (let k = 0; k < 130; k++) this.buffers.push(new Int16Array(n * n));
  }

  canPlay(sq: number, me: number): boolean {
    const cells = this.cells;
    if (cells[sq] !== EMPTY) return false;
    const opp = 3 - me;
    const dirs = this.t.dirs;
    for (let k = 0; k < 8; k++) {
      const d = dirs[k];
      let p = sq + d;
      if (cells[p] !== opp) continue;
      p += d;
      while (cells[p] === opp) p += d;
      if (cells[p] === me) return true;
    }
    return false;
  }

  /** 두고 뒤집는다. 뒤집은 수를 돌려준다 (0이면 둘 수 없는 곳, 판은 그대로) */
  play(sq: number, me: number): number {
    const cells = this.cells;
    const opp = 3 - me;
    const dirs = this.t.dirs;
    const stack = this.stack;
    let sp = this.sp;
    let total = 0;
    for (let k = 0; k < 8; k++) {
      const d = dirs[k];
      let p = sq + d;
      if (cells[p] !== opp) continue;
      p += d;
      while (cells[p] === opp) p += d;
      if (cells[p] !== me) continue;
      p -= d;
      while (p !== sq) {
        cells[p] = me;
        stack[sp++] = p;
        total++;
        p -= d;
      }
    }
    if (total === 0) return 0;
    cells[sq] = me;
    stack[sp++] = total;
    this.sp = sp;
    this.count[me] += total + 1;
    this.count[opp] -= total;
    return total;
  }

  unplay(sq: number, me: number): void {
    const opp = 3 - me;
    let sp = this.sp;
    const total = this.stack[--sp];
    for (let k = 0; k < total; k++) this.cells[this.stack[--sp]] = opp;
    this.cells[sq] = EMPTY;
    this.sp = sp;
    this.count[me] -= total + 1;
    this.count[opp] += total;
  }

  moves(me: number, out: Int16Array): number {
    const order = this.t.order;
    let k = 0;
    for (let i = 0; i < order.length; i++) {
      const sq = order[i];
      if (this.cells[sq] === EMPTY && this.canPlay(sq, me)) out[k++] = sq;
    }
    return k;
  }

  mobility(me: number): number {
    const order = this.t.order;
    let k = 0;
    for (let i = 0; i < order.length; i++) if (this.canPlay(order[i], me)) k++;
    return k;
  }

  empties(): number {
    return this.t.n * this.t.n - this.count[1] - this.count[2];
  }

  /** 보통: 칸 점수 + 기동력 + 모서리 */
  evalNormal(me: number): number {
    const opp = 3 - me;
    const { squares, wNormal, corners } = this.t;
    let s = 0;
    for (let i = 0; i < squares.length; i++) {
      const v = this.cells[squares[i]];
      if (v === me) s += wNormal[squares[i]];
      else if (v === opp) s -= wNormal[squares[i]];
    }
    for (let i = 0; i < 4; i++) {
      const v = this.cells[corners[i]];
      if (v === me) s += 30;
      else if (v === opp) s -= 30;
    }
    return s + 7 * (this.mobility(me) - this.mobility(opp));
  }

  /** 어려움: 돌 수, 모서리, 빈 모서리 옆 위험, 기동력, 변두리 돌(빈칸과 닿은 돌), 칸 점수를 섞는다 */
  evalHard(me: number): number {
    const opp = 3 - me;
    const { squares, wHard, dirs, corners, cornerNear } = this.t;
    const cells = this.cells;
    let d = 0;
    let myF = 0;
    let opF = 0;
    for (let i = 0; i < squares.length; i++) {
      const sq = squares[i];
      const v = cells[sq];
      if (v === EMPTY) continue;
      let frontier = false;
      for (let k = 0; k < 8; k++) {
        if (cells[sq + dirs[k]] === EMPTY) {
          frontier = true;
          break;
        }
      }
      if (v === me) {
        d += wHard[sq];
        if (frontier) myF++;
      } else {
        d -= wHard[sq];
        if (frontier) opF++;
      }
    }
    const myT = this.count[me];
    const opT = this.count[opp];
    const p = myT > opT ? (100 * myT) / (myT + opT) : myT < opT ? (-100 * opT) / (myT + opT) : 0;
    const f = myF > opF ? (-100 * myF) / (myF + opF) : myF < opF ? (100 * opF) / (myF + opF) : 0;
    let c = 0;
    let l = 0;
    for (let i = 0; i < 4; i++) {
      const v = cells[corners[i]];
      if (v === me) c += 25;
      else if (v === opp) c -= 25;
      else {
        const near = cornerNear[i];
        for (let k = 0; k < 3; k++) {
          const w = k === 0 ? 2 : 1; // X칸이 C칸보다 더 위험하다
          if (cells[near[k]] === me) l -= 12.5 * w;
          else if (cells[near[k]] === opp) l += 12.5 * w;
        }
      }
    }
    const myM = this.mobility(me);
    const opM = this.mobility(opp);
    const m = myM > opM ? (100 * myM) / (myM + opM) : myM < opM ? (-100 * opM) / (myM + opM) : 0;
    return 10 * p + 801.724 * c + 382.026 * l + 78.922 * m + 74.396 * f + 10 * d;
  }
}

class Abort extends Error {}

interface Ctx {
  e: Engine;
  nodes: number;
  deadline: number;
  now: () => number;
  evaluate: (me: number) => number;
}

function tick(ctx: Ctx): void {
  ctx.nodes++;
  if ((ctx.nodes & 1023) === 0 && ctx.now() > ctx.deadline) throw new Abort();
}

function finalScore(e: Engine, me: number): number {
  return (e.count[me] - e.count[3 - me]) * FINAL;
}

/** 알파-베타 탐색 (값은 me 입장) */
function search(ctx: Ctx, me: number, depth: number, alpha: number, beta: number, ply: number, passed: boolean): number {
  tick(ctx);
  const e = ctx.e;
  if (depth <= 0) return ctx.evaluate(me);
  const buf = e.buffers[ply];
  const n = e.moves(me, buf);
  if (n === 0) {
    if (passed) return finalScore(e, me);
    return -search(ctx, 3 - me, depth, -beta, -alpha, ply + 1, true);
  }
  let best = -INF;
  for (let i = 0; i < n; i++) {
    const sq = buf[i];
    e.play(sq, me);
    const v = -search(ctx, 3 - me, depth - 1, -beta, -alpha, ply + 1, false);
    e.unplay(sq, me);
    if (v > best) {
      best = v;
      if (v > alpha) {
        alpha = v;
        if (alpha >= beta) break;
      }
    }
  }
  return best;
}

/** 끝까지 읽기: 돌 수 차이 (me 입장) */
function solve(ctx: Ctx, me: number, alpha: number, beta: number, ply: number, passed: boolean, empties: number): number {
  tick(ctx);
  const e = ctx.e;
  const opp = 3 - me;
  if (empties === 0) return e.count[me] - e.count[opp];
  const buf = e.buffers[ply];
  const n = e.moves(me, buf);
  if (n === 0) {
    if (passed) return e.count[me] - e.count[opp];
    return -solve(ctx, opp, -beta, -alpha, ply + 1, true, empties);
  }
  if (n > 1 && empties > 6) {
    // 상대가 둘 곳이 적어지는 수부터 (빨리 좁혀지는 순서)
    const keys = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      e.play(buf[i], me);
      keys[i] = e.mobility(opp);
      e.unplay(buf[i], me);
    }
    for (let i = 1; i < n; i++) {
      const sq = buf[i];
      const key = keys[i];
      let j = i - 1;
      while (j >= 0 && keys[j] > key) {
        buf[j + 1] = buf[j];
        keys[j + 1] = keys[j];
        j--;
      }
      buf[j + 1] = sq;
      keys[j + 1] = key;
    }
  }
  let best = -INF;
  for (let i = 0; i < n; i++) {
    const sq = buf[i];
    e.play(sq, me);
    const v = -solve(ctx, opp, -beta, -alpha, ply + 1, false, empties - 1);
    e.unplay(sq, me);
    if (v > best) {
      best = v;
      if (v > alpha) {
        alpha = v;
        if (alpha >= beta) break;
      }
    }
  }
  return best;
}

interface RootResult {
  move: number;
  scores: Map<number, number>;
}

/** 뿌리에서 한 깊이를 끝까지 본다. 수 순서는 rootMoves 순서 */
function searchRoot(ctx: Ctx, me: number, depth: number, rootMoves: number[], useSolve: boolean): RootResult {
  const e = ctx.e;
  const scores = new Map<number, number>();
  let alpha = -INF;
  let bestMove = rootMoves[0];
  const empties = e.empties();
  for (const sq of rootMoves) {
    e.play(sq, me);
    let v: number;
    try {
      // 첫 수는 넓은 창으로, 그다음부터는 지금 최선보다 나은지만 본다
      v = useSolve
        ? -solve(ctx, 3 - me, -INF, -alpha, 1, false, empties - 1)
        : -search(ctx, 3 - me, depth - 1, -INF, -alpha, 1, false);
    } finally {
      e.unplay(sq, me);
    }
    scores.set(sq, v);
    if (v > alpha) {
      alpha = v;
      bestMove = sq;
    }
  }
  return { move: bestMove, scores };
}

function toBoardIndex(t: Tables, sq: number): number {
  const r = Math.floor(sq / t.W) - 1;
  const c = (sq % t.W) - 1;
  return r * t.n + c;
}

function chooseEasy(state: ReversiState, moves: number[], rng: Rng): number {
  const n = state.size;
  const weights = moves.map((i) => {
    const flips = flipsFor(state.board, n, i, state.current).length;
    const r = Math.floor(i / n);
    const c = i % n;
    const corner = (r === 0 || r === n - 1) && (c === 0 || c === n - 1);
    return (1 + 0.4 * flips) * (corner ? 2.5 : 1);
  });
  let x = rng() * weights.reduce((a, b) => a + b, 0);
  for (let k = 0; k < moves.length; k++) {
    x -= weights[k];
    if (x < 0) return moves[k];
  }
  return moves[moves.length - 1];
}

function chooseNormal(state: ReversiState, rng: Rng): number {
  const e = new Engine(state);
  const me = state.current + 1;
  const ctx: Ctx = { e, nodes: 0, deadline: Infinity, now: () => 0, evaluate: (p) => e.evalNormal(p) };
  const buf = e.buffers[0];
  const n = e.moves(me, buf);
  const rootMoves = Array.from(buf.subarray(0, n));
  const depth = NORMAL_DEPTH[state.size] ?? 4;
  let best = rootMoves[0];
  let bestScore = -INF;
  for (const sq of rootMoves) {
    e.play(sq, me);
    // 비슷한 수 사이에서는 조금씩 다르게 두도록 작은 흔들림을 더한다
    const v = -search(ctx, 3 - me, depth - 1, -INF, INF, 1, false) + rng() * 3;
    e.unplay(sq, me);
    if (v > bestScore) {
      bestScore = v;
      best = sq;
    }
  }
  return toBoardIndex(e.t, best);
}

function chooseHard(state: ReversiState, opts: AiOptions): number {
  const now = opts.now ?? (() => performance.now());
  const start = now();
  const budget = opts.timeMs ?? HARD_TIME_MS;
  const e = new Engine(state);
  const me = state.current + 1;
  const ctx: Ctx = { e, nodes: 0, deadline: start + budget, now, evaluate: (p) => e.evalHard(p) };
  const buf = e.buffers[0];
  const n = e.moves(me, buf);
  let rootMoves = Array.from(buf.subarray(0, n));
  if (rootMoves.length === 1) return toBoardIndex(e.t, rootMoves[0]);

  // 1수 앞은 시간과 상관없이 끝까지 본다 (아무리 바빠도 엉뚱한 수는 두지 않게)
  ctx.deadline = Infinity;
  let best = searchRoot(ctx, me, 1, rootMoves, false);
  ctx.deadline = start + budget;
  const empties = e.empties();
  const reorder = (r: RootResult) => [...rootMoves].sort((a, b) => (r.scores.get(b) ?? -INF) - (r.scores.get(a) ?? -INF));

  if (empties <= (SOLVE_EMPTIES[state.size] ?? 12)) {
    // 끝까지 읽기 전에 얕게 보아 순서를 정하고, 시간이 모자라면 그 결과를 쓴다
    try {
      best = searchRoot(ctx, me, Math.min(4, empties), rootMoves, false);
      rootMoves = reorder(best);
      return toBoardIndex(e.t, searchRoot(ctx, me, empties, rootMoves, true).move);
    } catch (err) {
      if (!(err instanceof Abort)) throw err;
      return toBoardIndex(e.t, best.move);
    }
  }

  for (let depth = 2; depth <= empties; depth++) {
    rootMoves = reorder(best);
    try {
      best = searchRoot(ctx, me, depth, rootMoves, false);
    } catch (err) {
      if (!(err instanceof Abort)) throw err;
      break;
    }
    // 다음 깊이는 보통 몇 배 더 걸리므로, 남은 시간이 너무 적으면 멈춘다
    if (now() - start > budget * 0.45) break;
  }
  return toBoardIndex(e.t, best.move);
}

/** 지금 차례인 컴퓨터가 둘 칸 */
export function chooseMove(state: ReversiState, level: DuelAiLevel, rng: Rng = Math.random, opts: AiOptions = {}): number | null {
  if (state.phase !== 'play') return null;
  const moves = legalMoves(state.board, state.size, state.current);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];
  if (level === 'ai-easy') return chooseEasy(state, moves, rng);
  if (level === 'ai-normal') return chooseNormal(state, rng);
  return chooseHard(state, opts);
}

export function decideAction(state: ReversiState, level: DuelAiLevel, rng: Rng = Math.random, opts: AiOptions = {}): ReversiAction {
  const index = chooseMove(state, level, rng, opts);
  return { type: 'place', index: index ?? -1 };
}

/** 테스트용: 판을 끝까지 읽은 돌 수 차이 (지금 차례 입장) */
export function solveExact(state: ReversiState): number {
  const e = new Engine(state);
  const ctx: Ctx = { e, nodes: 0, deadline: Infinity, now: () => 0, evaluate: () => 0 };
  return solve(ctx, state.current + 1, -INF, INF, 0, false, e.empties());
}
