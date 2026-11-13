import { seededRandom } from '../../lib/random';
import type { DuelAiLevel } from '../common/duel';
import { CELLS, COLS, LINE_DIRECTIONS, ROWS, legalColumns, winningColumns } from './rules';
import type { Cell, FourLineAction, FourLineState, Rng, Side } from './types';

/**
 * 사목 컴퓨터.
 * - 쉬움: 아무 데나 두지만(가운데를 조금 좋아함) 바로 이길 수 있으면 이기고, 질 자리는 가끔 막는다.
 * - 보통: 5수 앞까지 알파-베타 탐색. 줄마다 돌 수를 세는 평가(3개 이어짐 = 위협).
 * - 어려움: 시간 제한(약 0.75초) 안에서 점점 깊이 보는 탐색(보통 12~20수 이상), 치환표(같은 판 기억),
 *   가운데부터 보는 수 순서, 위협 칸의 홀짝(먼저 둔 쪽은 홀수 줄, 나중 쪽은 짝수 줄 위협이 유리)까지 따진다.
 * 판은 69개의 '넷 줄'마다 양쪽 돌 수를 세어 두는 표로 다뤄서, 두고 무르는 것과 이김 검사가 아주 빠르다.
 */

export const HARD_TIME_MS = 750;
const NORMAL_DEPTH = 5;
const WIN = 10000;
const MATE = WIN - 200;
const INF = 1_000_000;
const ORDER = [3, 2, 4, 1, 5, 0, 6];
const CENTER_W = [0, 1, 2, 3, 2, 1, 0];
/** 한 줄에 내 돌만 1·2·3개 있을 때의 값 */
const LINE_W = [0, 1, 8, 40];

export interface AiOptions {
  /** 어려움의 생각 시간 (ms) */
  timeMs?: number;
  now?: () => number;
}

// ---------------------------------------------------------------- 줄 표
const LINES: number[][] = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    for (const [dr, dc] of LINE_DIRECTIONS) {
      const er = r + dr * 3;
      const ec = c + dc * 3;
      if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
      LINES.push([0, 1, 2, 3].map((k) => (r + dr * k) * COLS + (c + dc * k)));
    }
  }
}
const NL = LINES.length;
const LINE_CELLS = Int8Array.from(LINES.flat());
const CELL_LINES: Int16Array[] = Array.from({ length: CELLS }, (_, cell) =>
  Int16Array.from(LINES.map((l, i) => (l.includes(cell) ? i : -1)).filter((i) => i >= 0)),
);

// 판 모양을 숫자 두 개(32비트씩)로 줄이는 조브리스트 해시
const zr = seededRandom(0x5a17);
const Z_LO = Int32Array.from({ length: CELLS * 2 }, () => Math.floor(zr() * 2 ** 32) | 0);
const Z_HI = Int32Array.from({ length: CELLS * 2 }, () => Math.floor(zr() * 2 ** 32) | 0);

// 치환표 (처음 쓸 때 만든다)
const TT_BITS = 19;
const TT_SIZE = 1 << TT_BITS;
const TT_MASK = TT_SIZE - 1;
const EXACT = 1;
const LOWER = 2;
const UPPER = 3;
let tt: { key: Int32Array; val: Int16Array; depth: Int8Array; flag: Int8Array; move: Int8Array } | null = null;

function table() {
  if (!tt) {
    tt = {
      key: new Int32Array(TT_SIZE),
      val: new Int16Array(TT_SIZE),
      depth: new Int8Array(TT_SIZE),
      flag: new Int8Array(TT_SIZE),
      move: new Int8Array(TT_SIZE),
    };
  }
  return tt;
}

class Engine {
  /** 0 빈칸, 1 빨강, 2 노랑 */
  readonly cells = new Int8Array(CELLS);
  readonly h = new Int8Array(COLS);
  /** 줄마다 [빨강 수, 노랑 수] */
  readonly cnt = new Int8Array(NL * 2);
  lo = 0;
  hi = 0;
  count = 0;
  readonly buffers: Int8Array[] = Array.from({ length: CELLS + 2 }, () => new Int8Array(COLS));
  readonly keys: Int32Array[] = Array.from({ length: CELLS + 2 }, () => new Int32Array(COLS));

  constructor(board: readonly Cell[]) {
    // 아래 줄부터 채워야 높이가 맞는다
    for (let r = ROWS - 1; r >= 0; r--) {
      for (let c = 0; c < COLS; c++) {
        const v = board[r * COLS + c];
        if (v !== -1) this.play(c, v);
      }
    }
  }

  /** 열에 떨어뜨리면 놓일 칸 (꽉 찼으면 -1) */
  landing(col: number): number {
    const h = this.h[col];
    return h < ROWS ? (ROWS - 1 - h) * COLS + col : -1;
  }

  /** p가 cell에 두면 넷이 되는지 (cell은 비어 있어야 한다) */
  wins(cell: number, p: number): boolean {
    const lines = CELL_LINES[cell];
    for (let i = 0; i < lines.length; i++) if (this.cnt[lines[i] * 2 + p] === 3) return true;
    return false;
  }

  play(col: number, p: number): void {
    const cell = (ROWS - 1 - this.h[col]) * COLS + col;
    this.cells[cell] = p + 1;
    this.h[col]++;
    this.count++;
    const lines = CELL_LINES[cell];
    for (let i = 0; i < lines.length; i++) this.cnt[lines[i] * 2 + p]++;
    this.lo ^= Z_LO[cell * 2 + p];
    this.hi ^= Z_HI[cell * 2 + p];
  }

  unplay(col: number, p: number): void {
    this.h[col]--;
    this.count--;
    const cell = (ROWS - 1 - this.h[col]) * COLS + col;
    this.cells[cell] = 0;
    const lines = CELL_LINES[cell];
    for (let i = 0; i < lines.length; i++) this.cnt[lines[i] * 2 + p]--;
    this.lo ^= Z_LO[cell * 2 + p];
    this.hi ^= Z_HI[cell * 2 + p];
  }

  /** p 입장 평가. parity면 위협 칸의 홀짝까지 본다 */
  evaluate(p: number, parity: boolean): number {
    const opp = 1 - p;
    const cnt = this.cnt;
    let s = 0;
    for (let l = 0; l < NL; l++) {
      const a = cnt[l * 2 + p];
      const b = cnt[l * 2 + opp];
      if (a > 0 && b > 0) continue;
      if (a > 0) s += LINE_W[a];
      else if (b > 0) s -= LINE_W[b];
      if (parity && (a === 3 || b === 3)) {
        // 남은 한 칸의 줄 (아래에서 1부터): 빨강(먼저)은 홀수 줄, 노랑은 짝수 줄 위협이 끝판에 강하다
        let empty = 0;
        for (let k = 0; k < 4; k++) {
          const cell = LINE_CELLS[l * 4 + k];
          if (this.cells[cell] === 0) empty = cell;
        }
        const rowFromBottom = ROWS - Math.floor(empty / COLS); // 1~6
        const owner = a === 3 ? p : opp;
        const good = owner === 0 ? rowFromBottom % 2 === 1 : rowFromBottom % 2 === 0;
        s += (owner === p ? 1 : -1) * (good ? 70 : 20);
      }
    }
    return s;
  }

  /** 두면 그 위 칸을 상대가 바로 이기는 수 */
  losing(col: number, opp: number): boolean {
    const h = this.h[col];
    if (h + 1 >= ROWS) return false;
    return this.wins((ROWS - 2 - h) * COLS + col, opp);
  }

  /** 두면 새로 생기는 내 위협(셋 + 빈칸) 수 */
  threatsMade(col: number, p: number): number {
    const cell = this.landing(col);
    const lines = CELL_LINES[cell];
    let n = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (this.cnt[l * 2 + p] === 2 && this.cnt[l * 2 + 1 - p] === 0) n++;
    }
    return n;
  }
}

class Abort extends Error {}

interface Ctx {
  e: Engine;
  nodes: number;
  deadline: number;
  now: () => number;
  parity: boolean;
  useTT: boolean;
}

function negamax(ctx: Ctx, p: number, depth: number, alpha: number, beta: number, ply: number): number {
  ctx.nodes++;
  if ((ctx.nodes & 1023) === 0 && ctx.now() > ctx.deadline) throw new Abort();
  const e = ctx.e;
  const opp = 1 - p;
  if (e.count >= CELLS) return 0;

  // 바로 이길 수 있으면 이긴다
  for (let i = 0; i < COLS; i++) {
    const cell = e.landing(ORDER[i]);
    if (cell >= 0 && e.wins(cell, p)) return WIN - ply;
  }
  // 상대가 바로 이기는 자리: 둘 이상이면 진다, 하나면 막을 수밖에 없다
  let forced = -1;
  let oppWins = 0;
  for (let c = 0; c < COLS; c++) {
    const cell = e.landing(c);
    if (cell >= 0 && e.wins(cell, opp)) {
      oppWins++;
      forced = c;
    }
  }
  if (oppWins >= 2) return -(WIN - ply - 1);
  if (e.count >= CELLS - 1) return 0;
  if (depth <= 0) return e.evaluate(p, ctx.parity);

  const buf = e.buffers[ply];
  const keys = e.keys[ply];
  let n = 0;
  if (forced >= 0) {
    buf[n++] = forced;
  } else {
    for (let i = 0; i < COLS; i++) {
      const c = ORDER[i];
      if (e.h[c] < ROWS && !e.losing(c, opp)) buf[n++] = c;
    }
    if (n === 0) return -(WIN - ply - 1);
  }

  const alpha0 = alpha;
  let ttMove = -1;
  let idx = 0;
  if (ctx.useTT) {
    const t = table();
    idx = e.lo & TT_MASK;
    if (t.flag[idx] !== 0 && t.key[idx] === e.hi) {
      ttMove = t.move[idx];
      if (t.depth[idx] >= depth) {
        let v = t.val[idx];
        if (v > MATE) v -= ply;
        else if (v < -MATE) v += ply;
        const f = t.flag[idx];
        if (f === EXACT) return v;
        if (f === LOWER && v > alpha) alpha = v;
        else if (f === UPPER && v < beta) beta = v;
        if (alpha >= beta) return v;
      }
    }
  }

  // 수 순서: 기억해 둔 최선 수 → 위협을 만드는 수 → 가운데
  if (n > 1) {
    for (let i = 0; i < n; i++) {
      const c = buf[i];
      keys[i] = (c === ttMove ? 1000 : 0) + e.threatsMade(c, p) * 8 + CENTER_W[c];
    }
    for (let i = 1; i < n; i++) {
      const c = buf[i];
      const k = keys[i];
      let j = i - 1;
      while (j >= 0 && keys[j] < k) {
        buf[j + 1] = buf[j];
        keys[j + 1] = keys[j];
        j--;
      }
      buf[j + 1] = c;
      keys[j + 1] = k;
    }
  }

  let best = -INF;
  let bestMove = buf[0];
  for (let i = 0; i < n; i++) {
    const c = buf[i];
    e.play(c, p);
    let v: number;
    if (i === 0) {
      v = -negamax(ctx, opp, depth - 1, -beta, -alpha, ply + 1);
    } else {
      // 첫 수보다 나은지만 좁은 창으로 빨리 보고, 나을 때만 다시 제대로 본다
      v = -negamax(ctx, opp, depth - 1, -alpha - 1, -alpha, ply + 1);
      if (v > alpha && v < beta) v = -negamax(ctx, opp, depth - 1, -beta, -alpha, ply + 1);
    }
    e.unplay(c, p);
    if (v > best) {
      best = v;
      bestMove = c;
      if (v > alpha) {
        alpha = v;
        if (alpha >= beta) break;
      }
    }
  }

  if (ctx.useTT) {
    const t = table();
    let v = best;
    if (v > MATE) v += ply;
    else if (v < -MATE) v -= ply;
    t.key[idx] = e.hi;
    t.val[idx] = v;
    t.depth[idx] = depth;
    t.flag[idx] = best <= alpha0 ? UPPER : best >= beta ? LOWER : EXACT;
    t.move[idx] = bestMove;
  }
  return best;
}

interface RootResult {
  col: number;
  score: number;
}

function searchRoot(ctx: Ctx, p: number, depth: number, moves: number[], noise?: () => number): RootResult {
  const e = ctx.e;
  let alpha = -INF;
  let best: RootResult = { col: moves[0], score: -INF };
  for (const c of moves) {
    e.play(c, p);
    let v: number;
    try {
      v = noise ? -negamax(ctx, 1 - p, depth - 1, -INF, INF, 1) + noise() : -negamax(ctx, 1 - p, depth - 1, -INF, -alpha, 1);
    } finally {
      e.unplay(c, p);
    }
    if (v > best.score) {
      best = { col: c, score: v };
      if (v > alpha) alpha = v;
    }
  }
  return best;
}

/** 뿌리에서 볼 수: 상대에게 바로 이길 자리를 주는 수는 (다른 수가 있으면) 뺀다 */
function rootMoves(e: Engine, p: number): number[] {
  const all = ORDER.filter((c) => e.h[c] < ROWS);
  const safe = all.filter((c) => !e.losing(c, 1 - p));
  return safe.length > 0 ? safe : all;
}

function chooseEasy(state: FourLineState, rng: Rng): number {
  const me = state.current;
  const wins = winningColumns(state.board, me);
  if (wins.length > 0) return wins[0];
  const blocks = winningColumns(state.board, me === 0 ? 1 : 0);
  if (blocks.length > 0 && rng() < 0.6) return blocks[0];
  const cols = legalColumns(state.board);
  const weights = cols.map((c) => 1 + CENTER_W[c]);
  let x = rng() * weights.reduce((a, b) => a + b, 0);
  for (let k = 0; k < cols.length; k++) {
    x -= weights[k];
    if (x < 0) return cols[k];
  }
  return cols[cols.length - 1];
}

function chooseNormal(state: FourLineState, rng: Rng): number {
  const e = new Engine(state.board);
  const p = state.current;
  const ctx: Ctx = { e, nodes: 0, deadline: Infinity, now: () => 0, parity: false, useTT: false };
  const moves = rootMoves(e, p);
  return searchRoot(ctx, p, NORMAL_DEPTH, moves, () => rng() * 4).col;
}

function chooseHard(state: FourLineState, opts: AiOptions): number {
  const now = opts.now ?? (() => performance.now());
  const start = now();
  const budget = opts.timeMs ?? HARD_TIME_MS;
  const e = new Engine(state.board);
  const p = state.current;
  table().flag.fill(0);
  const ctx: Ctx = { e, nodes: 0, deadline: Infinity, now, parity: true, useTT: true };
  let moves = rootMoves(e, p);
  if (moves.length === 1) return moves[0];
  // 첫 수와 그 대답은 가운데가 가장 좋다고 알려져 있다
  if (e.count === 0 || (e.count === 1 && e.h[3] === 1)) return 3;

  // 2수 앞은 시간과 상관없이 끝까지 본다 (바로 이기기·막기는 절대 놓치지 않게)
  let best = searchRoot(ctx, p, 2, moves);
  ctx.deadline = start + budget;
  const left = CELLS - e.count;
  for (let depth = 3; depth <= left && Math.abs(best.score) < MATE; depth++) {
    moves = [best.col, ...moves.filter((c) => c !== best.col)];
    try {
      best = searchRoot(ctx, p, depth, moves);
    } catch (err) {
      if (!(err instanceof Abort)) throw err;
      break;
    }
    if (now() - start > budget * 0.5) break;
  }
  return best.col;
}

/** 지금 차례인 컴퓨터가 떨어뜨릴 열 */
export function chooseColumn(state: FourLineState, level: DuelAiLevel, rng: Rng = Math.random, opts: AiOptions = {}): number | null {
  if (state.phase !== 'play') return null;
  const cols = legalColumns(state.board);
  if (cols.length === 0) return null;
  if (cols.length === 1) return cols[0];
  if (level === 'ai-easy') return chooseEasy(state, rng);
  // 바로 이기는 수는 어느 수준이든 놓치지 않는다
  const wins = winningColumns(state.board, state.current as Side);
  if (wins.length > 0) return wins[0];
  if (level === 'ai-normal') return chooseNormal(state, rng);
  return chooseHard(state, opts);
}

export function decideAction(state: FourLineState, level: DuelAiLevel, rng: Rng = Math.random, opts: AiOptions = {}): FourLineAction {
  return { type: 'drop', col: chooseColumn(state, level, rng, opts) ?? -1 };
}
