import { applyInput, isFree, pieceCells, popScore, rotatePiece, setSoftDrop, upcoming } from './engine';
import { DEATH_X, GARBAGE, H, W } from './types';
import type { Blob, DuelAiLevel, Input, MalangState, Piece, Rot } from './types';

/**
 * 말랑 팡팡 컴퓨터.
 * 조각이 나오면 놓을 수 있는 모든 자리(줄 × 방향)를 머릿속으로 놓아 보고, 터지는 연쇄와
 * '젤리 한두 개만 더 오면 몇 연쇄가 될지(연쇄 씨앗)', 높이, 같은 색끼리 붙은 정도로 점수를 매긴다.
 * 상대 판은 보지 않고 자기 판·다음 조각·나에게 올 방해 젤리 수만 본다.
 */

export interface Placement {
  x: number;
  r: Rot;
}

/** 수준마다 생각하는 시간, 한 번 움직이는 간격(ms), 내리는 방법 */
export const AI_TIMING: Record<DuelAiLevel, { think: number; move: number; drop: 'hard' | 'soft' }> = {
  'ai-easy': { think: 520, move: 230, drop: 'soft' },
  'ai-normal': { think: 300, move: 130, drop: 'hard' },
  'ai-hard': { think: 140, move: 70, drop: 'hard' },
};

const EMPTY = -1;
type Board = Int8Array;

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export function toBoard(grid: readonly (Blob | null)[]): Board {
  const b = new Int8Array(W * H);
  for (let i = 0; i < W * H; i++) b[i] = grid[i] ? grid[i]!.c : EMPTY;
  return b;
}

function columnTop(b: Board, x: number): number {
  let y = H - 1;
  while (y >= 0 && b[y * W + x] !== EMPTY) y -= 1;
  return y;
}

/** 조각을 (x, r)에 놓은 판. 놓을 수 없으면 null. 판 밖으로 넘친 젤리는 사라진다 */
export function placeOn(b: Board, x: number, r: Rot, colors: readonly [number, number]): Board | null {
  const cx = x + DX[r];
  if (x < 0 || x >= W || cx < 0 || cx >= W) return null;
  const out = b.slice();
  if (r === 0 || r === 2) {
    const top = columnTop(out, x);
    if (top < 0) return null;
    const [low, high] = r === 0 ? [colors[0], colors[1]] : [colors[1], colors[0]];
    out[top * W + x] = low;
    if (top - 1 >= 0) out[(top - 1) * W + x] = high;
    return out;
  }
  const t1 = columnTop(out, x);
  const t2 = columnTop(out, cx);
  if (t1 < 0 && t2 < 0) return null;
  if (t1 >= 0) out[t1 * W + x] = colors[0];
  if (t2 >= 0) out[t2 * W + cx] = colors[1];
  return out;
}

const stack = new Int32Array(W * H);
const seen = new Uint8Array(W * H);

/** 연쇄를 끝까지 일으킨다 (판을 그대로 고친다). 연쇄 수와 점수 */
export function resolveBoard(b: Board): { chains: number; score: number } {
  let chains = 0;
  let score = 0;
  for (;;) {
    seen.fill(0);
    const remove: number[] = [];
    const groups: { size: number; color: number }[] = [];
    for (let i = 0; i < W * H; i++) {
      const c = b[i];
      if (c === EMPTY || c === GARBAGE || seen[i]) continue;
      let sp = 0;
      let n = 0;
      const members: number[] = [];
      stack[sp++] = i;
      seen[i] = 1;
      while (sp > 0) {
        const k = stack[--sp];
        members.push(k);
        n += 1;
        const x = k % W;
        const y = (k - x) / W;
        for (let d = 0; d < 4; d++) {
          const nx = x + DX[d];
          const ny = y + DY[d];
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          const m = ny * W + nx;
          if (!seen[m] && b[m] === c) {
            seen[m] = 1;
            stack[sp++] = m;
          }
        }
      }
      if (n >= 4) {
        groups.push({ size: n, color: c });
        remove.push(...members);
      }
    }
    if (groups.length === 0) break;
    chains += 1;
    score += popScore(chains, groups);
    for (const k of remove) {
      const x = k % W;
      const y = (k - x) / W;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        if (b[ny * W + nx] === GARBAGE) b[ny * W + nx] = EMPTY;
      }
      b[k] = EMPTY;
    }
    // 중력
    for (let x = 0; x < W; x++) {
      let write = H - 1;
      for (let y = H - 1; y >= 0; y--) {
        const c = b[y * W + x];
        if (c === EMPTY) continue;
        if (write !== y) {
          b[write * W + x] = c;
          b[y * W + x] = EMPTY;
        }
        write -= 1;
      }
    }
  }
  return { chains, score };
}

function heightOf(b: Board, x: number): number {
  return H - 1 - columnTop(b, x);
}

/**
 * 연쇄 씨앗: 어느 줄에 같은 색 젤리를 1~2개 떨어뜨리면 몇 연쇄가 되는지 (가장 큰 것).
 * 지금 판이 앞으로 얼마나 큰 연쇄를 낼 수 있는지를 어림한다.
 */
export function chainPotential(b: Board, colors: number): { chains: number; score: number } {
  let best = { chains: 0, score: 0 };
  for (let x = 0; x < W; x++) {
    const top = columnTop(b, x);
    if (top < 1) continue;
    // 그 줄 위쪽과 옆에 닿는 색만 해 본다
    const near = new Set<number>();
    const below = top + 1 < H ? b[(top + 1) * W + x] : EMPTY;
    if (below >= 0 && below !== GARBAGE) near.add(below);
    for (const nx of [x - 1, x + 1]) {
      if (nx < 0 || nx >= W) continue;
      for (const ny of [top, top - 1]) {
        const c = b[ny * W + nx];
        if (c >= 0 && c !== GARBAGE) near.add(c);
      }
    }
    for (const c of near) {
      if (c >= colors) continue;
      for (const n of [1, 2]) {
        if (top - n + 1 < 0) continue;
        const t = b.slice();
        for (let k = 0; k < n; k++) t[(top - k) * W + x] = c;
        const r = resolveBoard(t);
        if (r.chains > best.chains || (r.chains === best.chains && r.score > best.score)) best = r;
        if (r.chains > 0) break;
      }
    }
  }
  return best;
}

/** 판 모양 점수: 낮고, 가운데(나오는 곳)가 비어 있고, 같은 색끼리 붙어 있을수록 좋다 */
export function shapeScore(b: Board): number {
  if (b[DEATH_X] !== EMPTY) return -1e7;
  let v = 0;
  for (let x = 0; x < W; x++) {
    const h = heightOf(b, x);
    v -= h * h * 0.7;
    if ((x === DEATH_X || x === DEATH_X + 1) && h >= 8) v -= (h - 7) * 450;
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = b[y * W + x];
      if (c === EMPTY) continue;
      if (c === GARBAGE) {
        v -= 4;
        continue;
      }
      if (x + 1 < W && b[y * W + x + 1] === c) v += 7;
      if (y + 1 < H && b[(y + 1) * W + x] === c) v += 7;
    }
  }
  return v;
}

/** 지금 조각이 갈 수 있는 자리들 (판 꼭대기에서 좌우·회전만으로) */
export function reachable(grid: readonly (Blob | null)[], piece: Piece): Placement[] {
  const key = (p: Pick<Piece, 'x' | 'r'>) => p.x * 4 + p.r;
  const fits = (p: Pick<Piece, 'x' | 'y' | 'r'>) => pieceCells(p).every(([x, y]) => isFree(grid, x, y));
  const start = { ...piece };
  const seenKeys = new Set([key(start)]);
  const queue: Piece[] = [start];
  const out: Placement[] = [];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    out.push({ x: cur.x, r: cur.r });
    const nexts: (Piece | null)[] = [
      fits({ ...cur, x: cur.x - 1 }) ? { ...cur, x: cur.x - 1 } : null,
      fits({ ...cur, x: cur.x + 1 }) ? { ...cur, x: cur.x + 1 } : null,
      rotatePiece(grid, cur, 1),
      rotatePiece(grid, cur, -1),
    ];
    for (const n of nexts) {
      if (!n || n.y !== cur.y || seenKeys.has(key(n))) continue;
      seenKeys.add(key(n));
      queue.push(n);
    }
  }
  return out;
}

interface Scored {
  place: Placement;
  value: number;
  board: Board;
}

/**
 * (x, r)에 놓았을 때의 값. 터지면 그 점수, 아니면 연쇄 씨앗과 판 모양.
 * 큰 연쇄를 모으다가 위험하거나 방해 젤리가 오면 쏜다.
 */
function scorePlacement(b: Board, place: Placement, colors: readonly [number, number], ctx: Ctx): Scored | null {
  const placed = placeOn(b, place.x, place.r, colors);
  if (!placed) return null;
  const { chains, score } = resolveBoard(placed);
  let value = shapeScore(placed);
  if (value <= -1e6) return { place, value, board: placed };
  if (chains > 0) {
    // 쉬움은 보이면 바로 터뜨린다 (큰 연쇄를 모으지 않는다)
    if (ctx.level === 'ai-easy') value += score * 1.5 + 120;
    else {
      const big = chains >= ctx.fireAt;
      value += big || ctx.urgent ? score * 1.2 + chains * 150 : score * 0.08 - 160;
    }
  }
  if (ctx.level !== 'ai-easy') {
    const pot = chainPotential(placed, ctx.colors);
    value += pot.chains * pot.chains * (ctx.level === 'ai-hard' ? 55 : 32);
  }
  return { place, value, board: placed };
}

interface Ctx {
  level: DuelAiLevel;
  colors: number;
  /** 이만큼 연쇄가 되면 쏜다 */
  fireAt: number;
  /** 위험하거나 방해 젤리가 많이 오면 작아도 쏜다 */
  urgent: boolean;
}

/** 지금 조각을 어디에 놓을지 정한다 */
export function planMove(state: MalangState, player: number, level: DuelAiLevel, rng: () => number = Math.random): Placement {
  const p = state.players[player];
  const piece = p.piece!;
  const board = toBoard(p.grid);
  const colors = state.options.colors;
  const middle = Math.max(heightOf(board, DEATH_X), heightOf(board, DEATH_X + 1));
  const ctx: Ctx = {
    level,
    colors,
    fireAt: level === 'ai-hard' ? 4 : 2,
    urgent: middle >= 8 || p.pending >= (level === 'ai-hard' ? 6 : 12),
  };
  const options = reachable(p.grid, piece);
  const scored: Scored[] = [];
  for (const place of options) {
    const s = scorePlacement(board, place, piece.colors, ctx);
    if (s) scored.push(s);
  }
  if (scored.length === 0) return { x: piece.x, r: piece.r };

  if (level === 'ai-easy') {
    for (const s of scored) s.value += (rng() - 0.5) * 120;
    scored.sort((a, b) => b.value - a.value);
    // 가끔은 둘째·셋째로 좋은 자리
    const k = rng() < 0.3 ? Math.min(scored.length - 1, 1 + Math.floor(rng() * 2)) : 0;
    return scored[k].place;
  }

  if (level === 'ai-hard') {
    const [next] = upcoming(state, player, 1);
    scored.sort((a, b) => b.value - a.value);
    const top = scored.slice(0, 6);
    let best = top[0];
    let bestTotal = -Infinity;
    for (const s of top) {
      if (s.value <= -1e6) continue;
      let bestNext = -Infinity;
      for (let x = 0; x < W; x++) {
        for (const r of [0, 1, 2, 3] as Rot[]) {
          const n = scorePlacement(s.board, { x, r }, next, ctx);
          if (n && n.value > bestNext) bestNext = n.value;
        }
      }
      const total = s.value * 0.45 + bestNext * 0.55;
      if (total > bestTotal) {
        bestTotal = total;
        best = s;
      }
    }
    return best.place;
  }

  scored.sort((a, b) => b.value - a.value);
  return scored[0].place;
}

/** 목표 자리로 가려면 지금 누를 단추 (다 왔으면 'drop') */
export function nextInput(piece: Pick<Piece, 'x' | 'r'>, target: Placement): Input {
  if (piece.r !== target.r) return (target.r - piece.r + 4) % 4 === 3 ? 'ccw' : 'cw';
  if (piece.x < target.x) return 'right';
  if (piece.x > target.x) return 'left';
  return 'drop';
}

/** 컴퓨터 한 명의 머릿속 (화면이 들고 있다) */
export interface AiBrain {
  serial: number;
  target: Placement | null;
  wait: number;
}

export function newBrain(): AiBrain {
  return { serial: -1, target: null, wait: 0 };
}

/**
 * 매 프레임 부른다: 생각하는 시간을 두고 목표를 정한 뒤, 수준에 맞는 빠르기로 단추를 하나씩 누른다.
 */
export function aiTick(state: MalangState, player: number, level: DuelAiLevel, brain: AiBrain, dt: number, rng: () => number = Math.random): void {
  const p = state.players[player];
  if (state.phase !== 'play' || p.phase !== 'move' || !p.piece) {
    if (p.soft) setSoftDrop(state, player, false);
    return;
  }
  const timing = AI_TIMING[level];
  if (brain.serial !== p.piece.serial) {
    brain.serial = p.piece.serial;
    brain.target = null;
    brain.wait = timing.think * (0.8 + rng() * 0.4);
    setSoftDrop(state, player, false);
  }
  brain.wait -= dt;
  if (brain.wait > 0) return;
  if (!brain.target) {
    brain.target = planMove(state, player, level, rng);
    brain.wait = timing.move;
    return;
  }
  const input = nextInput(p.piece, brain.target);
  if (input === 'drop') {
    if (timing.drop === 'hard') applyInput(state, player, 'drop');
    else setSoftDrop(state, player, true);
    brain.wait = timing.move;
    return;
  }
  if (!applyInput(state, player, input)) {
    // 막혀서 못 가면 지금 자리로 정한다
    brain.target = { x: p.piece.x, r: p.piece.r };
  }
  brain.wait = timing.move * (0.85 + rng() * 0.3);
}
