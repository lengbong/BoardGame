import { pick } from '../../lib/random';
import { geometry, type Geometry } from './rules';
import type { AiLevel, BoxesAction, BoxesState, Rng } from './types';

/* ================================================================
   컴퓨터 플레이어
   - 쉬움: 가져갈 상자가 있으면 가져가고, 없으면 아무 선이나 (반쯤은 세 번째 변을 피함)
   - 보통: 상자는 항상 가져가고, 안전한 선을 고르고, 안전한 선이 없으면 가장 작은 줄(사슬)을 내준다.
     끝판에는 사슬·고리를 읽어서 "두 개 남기기(더블 크로스)"로 주도권을 지킨다.
     안전한 선이 몇 개 안 남았을 때와 끝판은 끝까지 읽어 본다 (탐색 노드 수 제한, 넘으면 어림셈).
   - 간단 규칙(한 번 더 없음): 상자를 가져가되 다음 사람에게 상자를 덜 남기는 쪽, 안전한 선, 그다음 손해가 적은 선
   ================================================================ */

const GROUND = -1;

/** 안전한 선이 이만큼 이하로 남으면 끝판까지 읽어서 고른다 */
export const SAFE_SEARCH_MAX = 8;
/** 탐색 노드 수 한도 (넘으면 어림셈으로 고른다) */
export const DEFAULT_BUDGET = 120_000;

export interface AiOptions {
  /** 탐색 노드 수 한도 */
  budget?: number;
}

/** 탐색용으로 마음대로 긋고 지울 수 있는 판 */
class Board {
  readonly g: Geometry;
  readonly drawn: Uint8Array;
  readonly sides: Uint8Array;
  readonly owned: Uint8Array;
  open = 0;
  private readonly words: Int32Array;

  constructor(state: Pick<BoxesState, 'size' | 'lines'>) {
    this.g = geometry(state.size);
    this.drawn = new Uint8Array(this.g.lines);
    this.sides = new Uint8Array(this.g.boxes);
    this.owned = new Uint8Array(this.g.boxes);
    this.words = new Int32Array(Math.ceil(this.g.lines / 28));
    state.lines.forEach((p, e) => {
      if (p !== -1) this.mark(e);
      else this.open += 1;
    });
    for (let b = 0; b < this.g.boxes; b++) if (this.sides[b] === 4) this.owned[b] = 1;
  }

  private mark(e: number): void {
    this.drawn[e] = 1;
    this.words[(e / 28) | 0] ^= 1 << e % 28;
    for (const b of this.g.lineBoxes[e]) this.sides[b] += 1;
  }

  /** 선을 긋고, 완성된 상자 수를 돌려준다. */
  draw(e: number): number {
    this.mark(e);
    this.open -= 1;
    let k = 0;
    for (const b of this.g.lineBoxes[e]) {
      if (this.sides[b] === 4) {
        this.owned[b] = 1;
        k += 1;
      }
    }
    return k;
  }

  /** 마지막에 그은 선을 지운다. (그은 순서의 반대로만 지울 것) */
  undraw(e: number): void {
    this.drawn[e] = 0;
    this.words[(e / 28) | 0] ^= 1 << e % 28;
    this.open += 1;
    for (const b of this.g.lineBoxes[e]) {
      if (this.sides[b] === 4) this.owned[b] = 0;
      this.sides[b] -= 1;
    }
  }

  key(): string {
    let s = '';
    for (let i = 0; i < this.words.length; i++) s += this.words[i].toString(36) + ',';
    return s;
  }

  /** 상자 b에서 선 e 건너편 상자 (판 밖이면 GROUND) */
  across(e: number, b: number): number {
    const bs = this.g.lineBoxes[e];
    if (bs.length === 1) return GROUND;
    return bs[0] === b ? bs[1] : bs[0];
  }

  /** 상자 b의 아직 긋지 않은 선 중 except가 아닌 첫 번째 */
  freeLine(b: number, except = -1): number {
    for (const l of this.g.boxLines[b]) if (!this.drawn[l] && l !== except) return l;
    return -1;
  }

  openLines(): number[] {
    const out: number[] = [];
    for (let e = 0; e < this.g.lines; e++) if (!this.drawn[e]) out.push(e);
    return out;
  }

  safeLines(): number[] {
    const out: number[] = [];
    for (let e = 0; e < this.g.lines; e++) {
      if (this.drawn[e]) continue;
      if (this.g.lineBoxes[e].every((b) => this.sides[b] <= 1)) out.push(e);
    }
    return out;
  }

  captureLines(): number[] {
    const out: number[] = [];
    for (let e = 0; e < this.g.lines; e++) {
      if (this.drawn[e]) continue;
      if (this.g.lineBoxes[e].some((b) => this.sides[b] === 3)) out.push(e);
    }
    return out;
  }

  completes(e: number): number {
    return this.g.lineBoxes[e].filter((b) => this.sides[b] === 3).length;
  }

  gives(e: number): number {
    return this.g.lineBoxes[e].filter((b) => this.sides[b] === 2).length;
  }
}

/* ---------------------------------------------------------------- 상자 가져가기 분석 */

export interface Decision {
  /** 가져가는 선 (상자를 완성하고 사슬을 계속 먹는다) */
  take: number;
  /** 머리핀 선: 마지막 2개(고리는 4개)를 남기고 차례를 넘기는 선 */
  hairpin: number;
  /** 남겨 주는 상자 수 (사슬 2, 고리 4) */
  cost: number;
}

export interface CaptureInfo {
  /** 망설일 것 없이 가져가면 되는 선 */
  forced: number | null;
  /** 사슬(고리) 끝: 다 먹을지, 남겨 줄지 골라야 하는 곳 */
  decision: Decision | null;
}

/**
 * 가져갈 수 있는 상자(세 변짜리)를 살펴본다. 없으면 null.
 * 사슬 가운데의 상자는 그냥 가져가면 되고(forced), 사슬의 마지막 2개·고리의 마지막 4개에서만
 * 다 먹을지 / 머리핀 선으로 남겨 줄지(decision) 고르면 된다.
 */
function analyzeCaptures(b: Board): CaptureInfo | null {
  const { sides, owned } = b;
  const decisions: Decision[] = [];
  for (let box = 0; box < b.g.boxes; box++) {
    if (owned[box] || sides[box] !== 3) continue;
    const e = b.freeLine(box);
    const o = b.across(e, box);
    // 판 밖, 상자 2개를 한꺼번에(도미노), 또는 사슬이 여기서 끝나는 외톨이 상자
    if (o === GROUND || sides[o] === 3 || sides[o] <= 1) return { forced: e, decision: null };
    const f = b.freeLine(o, e);
    const nx = b.across(f, o);
    if (nx === GROUND || sides[nx] <= 1) {
      decisions.push({ take: e, hairpin: f, cost: 2 });
      continue;
    }
    if (sides[nx] === 3) return { forced: e, decision: null };
    const g = b.freeLine(nx, f);
    const nx2 = b.across(g, nx);
    if (nx2 !== GROUND && sides[nx2] === 3) {
      decisions.push({ take: e, hairpin: f, cost: 4 });
      continue;
    }
    return { forced: e, decision: null };
  }
  if (decisions.length === 0) return null;
  const distinct = decisions.filter((d, i) => decisions.findIndex((x) => x.hairpin === d.hairpin) === i);
  if (distinct.length >= 2) {
    // 여러 군데면 남겨 주기 비싼 곳(고리)부터 먹고, 마지막 한 곳에서만 고민한다.
    distinct.sort((x, y) => y.cost - x.cost);
    return { forced: distinct[0].take, decision: null };
  }
  return { forced: null, decision: distinct[0] };
}

/* ---------------------------------------------------------------- 사슬·고리 나누기 */

export type ComponentKind = 'chain' | 'loop' | 'complex';

interface Component {
  kind: ComponentKind;
  boxes: number[];
  /** 판 밖으로 이어진 선 */
  ground: number[];
  /** 상자끼리 잇는 선 */
  inner: number[];
}

/** 아직 주인 없는 상자를 '긋지 않은 선'으로 이어진 덩어리로 나눈다. */
function components(b: Board): Component[] {
  const seen = new Uint8Array(b.g.boxes);
  const out: Component[] = [];
  for (let s = 0; s < b.g.boxes; s++) {
    if (b.owned[s] || seen[s]) continue;
    const boxes: number[] = [];
    const ground: number[] = [];
    const inner = new Set<number>();
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const x = stack.pop()!;
      boxes.push(x);
      for (const l of b.g.boxLines[x]) {
        if (b.drawn[l]) continue;
        const o = b.across(l, x);
        if (o === GROUND) ground.push(l);
        else {
          inner.add(l);
          if (!seen[o]) {
            seen[o] = 1;
            stack.push(o);
          }
        }
      }
    }
    const allTwo = boxes.every((x) => b.sides[x] === 2);
    const kind: ComponentKind = allTwo && ground.length === 2 ? 'chain' : allTwo && ground.length === 0 ? 'loop' : 'complex';
    out.push({ kind, boxes, ground, inner: [...inner] });
  }
  return out;
}

/** 테스트·안내용: 남은 상자 덩어리들의 모양 */
export function describeComponents(state: Pick<BoxesState, 'size' | 'lines'>): { kind: ComponentKind; size: number }[] {
  return components(new Board(state)).map((c) => ({ kind: c.kind, size: c.boxes.length }));
}

/**
 * 안전한 선이 없을 때 내줄 수 있는 수들. 같은 모양 덩어리는 하나만,
 * 사슬은 끝에서 열고(2칸 사슬은 가운데도), 고리는 아무 데나, 복잡한 덩어리는 모든 선.
 */
function openingMoves(b: Board): number[] {
  const moves: number[] = [];
  const seenSig = new Set<string>();
  for (const c of components(b)) {
    if (c.kind === 'complex') {
      for (const l of [...c.inner, ...c.ground]) if (!moves.includes(l)) moves.push(l);
      continue;
    }
    const sig = `${c.kind}${c.boxes.length}`;
    if (seenSig.has(sig)) continue;
    seenSig.add(sig);
    if (c.kind === 'loop') moves.push(c.inner[0]);
    else if (c.boxes.length === 2) moves.push(c.inner[0], c.ground[0]);
    else moves.push(c.ground[0]);
  }
  return moves;
}

/* ---------------------------------------------------------------- 끝까지 읽기 (max^n + 기억) */

const BUDGET_EXCEEDED = new Error('budget');

interface Search {
  b: Board;
  players: number;
  memo: Map<string, number[]>;
  nodes: number;
  budget: number;
}

function zeros(n: number): number[] {
  return Array.from({ length: n }, () => 0);
}

/** 지금 player 차례일 때 앞으로 사람마다 얻을 상자 수 (모두 자기 상자를 최대로 하려고 둔다고 가정) */
function solve(S: Search, player: number): number[] {
  const b = S.b;
  if (b.open === 0) return zeros(S.players);
  const key = b.key() + player;
  const hit = S.memo.get(key);
  if (hit) return hit;
  if (++S.nodes > S.budget) throw BUDGET_EXCEEDED;
  const next = (player + 1) % S.players;
  let result: number[];
  const cap = analyzeCaptures(b);
  if (cap && cap.forced !== null) {
    const k = b.draw(cap.forced);
    result = [...solve(S, player)];
    result[player] += k;
    b.undraw(cap.forced);
  } else if (cap && cap.decision) {
    const d = cap.decision;
    const k = b.draw(d.take);
    const take = [...solve(S, player)];
    take[player] += k;
    b.undraw(d.take);
    b.draw(d.hairpin);
    const hairpin = solve(S, next);
    b.undraw(d.hairpin);
    result = take[player] >= hairpin[player] ? take : hairpin;
  } else {
    const safe = b.safeLines();
    const moves = safe.length > 0 ? safe : openingMoves(b);
    let best: number[] | null = null;
    for (const m of moves) {
      b.draw(m);
      const v = solve(S, next);
      b.undraw(m);
      if (!best || v[player] > best[player]) best = v;
    }
    result = best!;
  }
  S.memo.set(key, result);
  return result;
}

/** 후보 수마다 끝까지 읽어 가장 좋은 수를 고른다. 한도를 넘으면 null */
function searchBest(state: BoxesState, moves: number[], budget: number, rng: Rng): number | null {
  if (moves.length === 0) return null;
  const b = new Board(state);
  const player = state.current;
  const P = state.players.length;
  const S: Search = { b, players: P, memo: new Map(), nodes: 0, budget };
  const scored: { move: number; own: number; rival: number; gives: number }[] = [];
  try {
    for (const m of moves) {
      const gives = b.gives(m);
      const k = b.draw(m);
      let v: number[];
      if (k > 0) {
        v = [...solve(S, player)];
        v[player] += k;
      } else {
        v = solve(S, (player + 1) % P);
      }
      b.undraw(m);
      const rival = Math.max(...v.filter((_, i) => i !== player));
      scored.push({ move: m, own: v[player], rival, gives });
    }
  } catch (err) {
    if (err === BUDGET_EXCEEDED) return null;
    throw err;
  }
  const bestOwn = Math.max(...scored.map((s) => s.own));
  let top = scored.filter((s) => s.own === bestOwn);
  const bestRival = Math.min(...top.map((s) => s.rival));
  top = top.filter((s) => s.rival === bestRival);
  const leastGives = Math.min(...top.map((s) => s.gives));
  top = top.filter((s) => s.gives === leastGives);
  return pick(top, rng)!.move;
}

/* ---------------------------------------------------------------- 어림셈 (탐색 한도를 넘었을 때) */

/** 상대가 이어서 가져갈 수 있는 상자 수 (욕심껏 다 먹는다고 칠 때) */
function greedyRun(b: Board): number {
  const drawn: number[] = [];
  let total = 0;
  for (;;) {
    const caps = b.captureLines();
    if (caps.length === 0) break;
    total += b.draw(caps[0]);
    drawn.push(caps[0]);
  }
  for (let i = drawn.length - 1; i >= 0; i--) b.undraw(drawn[i]);
  return total;
}

/**
 * 사슬·고리만 남은 끝판을 단순하게 본 값: 내가 하나를 열어야 할 때 (나 − 상대) 상자 수.
 * 2칸 이하 사슬은 다 먹히고, 3칸 이상 사슬은 2개, 고리는 4개를 남겨 받을 수 있다.
 */
function abstractValue(parts: { loop: boolean; len: number }[], memo = new Map<string, number>()): number {
  if (parts.length === 0) return 0;
  const key = parts
    .map((p) => (p.loop ? 'L' : 'C') + p.len)
    .sort()
    .join(',');
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  let best = -Infinity;
  const tried = new Set<string>();
  parts.forEach((p, i) => {
    const sig = (p.loop ? 'L' : 'C') + p.len;
    if (tried.has(sig)) return;
    tried.add(sig);
    const rest = parts.filter((_, j) => j !== i);
    const v = abstractValue(rest, memo);
    let opp: number;
    if (rest.length === 0 || (!p.loop && p.len <= 2)) opp = p.len + v;
    else {
      const keep = p.loop ? 4 : 2;
      opp = Math.max(p.len + v, p.len - 2 * keep - v);
    }
    best = Math.max(best, -opp);
  });
  memo.set(key, best);
  return best;
}

function abstractParts(b: Board): { loop: boolean; len: number }[] {
  return components(b).map((c) => ({ loop: c.kind === 'loop', len: c.boxes.length }));
}

function fallbackDecision(state: BoxesState, d: Decision): number {
  // 이 사슬을 다 먹었다고 치고 남은 판을 본다. (어림셈용 판이라 되돌리지 않는다)
  const b = new Board(state);
  b.draw(d.take);
  for (;;) {
    const caps = b.captureLines();
    if (caps.length === 0) break;
    b.draw(caps[0]);
  }
  const rest = abstractParts(b);
  if (rest.length === 0) return d.take;
  return abstractValue(rest) < -d.cost ? d.hairpin : d.take;
}

function fallbackSacrifice(state: BoxesState, rng: Rng): number {
  const b = new Board(state);
  const scored = openingMoves(b).map((m) => {
    b.draw(m);
    const run = greedyRun(b);
    b.undraw(m);
    return { m, run };
  });
  const least = Math.min(...scored.map((s) => s.run));
  return pick(scored.filter((s) => s.run === least), rng)!.m;
}

/* ---------------------------------------------------------------- 수준별 고르기 */

function easyLine(state: BoxesState, rng: Rng): number {
  const b = new Board(state);
  const caps = b.captureLines();
  if (caps.length > 0) return pick(caps, rng)!;
  const safe = b.safeLines();
  if (safe.length > 0 && rng() < 0.5) return pick(safe, rng)!;
  return pick(b.openLines(), rng)!;
}

/** 간단 규칙(한 번 더 없음): 가져가는 선은 상자를 많이, 남겨 주는 상자는 적게 */
function bestCaptureNoExtra(b: Board, caps: number[]): number[] {
  const score = (e: number) => b.completes(e) * 10 - b.g.lineBoxes[e].filter((x) => b.sides[x] === 2).length * 3;
  const top = Math.max(...caps.map(score));
  return caps.filter((e) => score(e) === top);
}

function noExtraLine(state: BoxesState, rng: Rng): number {
  const b = new Board(state);
  const caps = b.captureLines();
  if (caps.length > 0) return pick(bestCaptureNoExtra(b, caps), rng)!;
  const safe = b.safeLines();
  if (safe.length > 0) return pick(safe, rng)!;
  // 어디든 상자를 내줘야 하면: 차례대로 한 개씩 가져가는 것을 끝까지 따라가 보고 손해가 가장 적은 선
  const P = state.players.length;
  const me = state.current;
  const scored = b.openLines().map((m) => {
    const drawn = [m];
    b.draw(m);
    const gain = zeros(P);
    let who = (me + 1) % P;
    for (;;) {
      const cs = b.captureLines();
      if (cs.length === 0) break;
      const e = bestCaptureNoExtra(b, cs)[0];
      gain[who] += b.draw(e);
      drawn.push(e);
      who = (who + 1) % P;
    }
    for (let i = drawn.length - 1; i >= 0; i--) b.undraw(drawn[i]);
    const others = gain.reduce((s, v, i) => (i === me ? s : s + v), 0);
    return { m, net: gain[me] - others };
  });
  const best = Math.max(...scored.map((s) => s.net));
  return pick(scored.filter((s) => s.net === best), rng)!.m;
}

function normalLine(state: BoxesState, rng: Rng, budget: number): number {
  if (state.options.noExtraTurn) return noExtraLine(state, rng);
  const b = new Board(state);
  const cap = analyzeCaptures(b);
  if (cap && cap.forced !== null) return cap.forced;
  const safe = b.safeLines();
  if (cap && cap.decision) {
    const d = cap.decision;
    // 아직 안전한 선이 남아 있으면 그냥 다 먹는다.
    if (safe.length > 0) return d.take;
    return searchBest(state, [d.take, d.hairpin], budget, rng) ?? fallbackDecision(state, d);
  }
  if (safe.length > 0) {
    if (safe.length <= SAFE_SEARCH_MAX) {
      const best = searchBest(state, safe, budget, rng);
      if (best !== null) return best;
    }
    return pick(safe, rng)!;
  }
  return searchBest(state, openingMoves(b), budget, rng) ?? fallbackSacrifice(state, rng);
}

/** 지금 차례인 컴퓨터가 그을 선 */
export function decideAction(state: BoxesState, level: AiLevel, rng: Rng = Math.random, opts: AiOptions = {}): BoxesAction {
  const budget = opts.budget ?? DEFAULT_BUDGET;
  let edge = level === 'ai-easy' ? easyLine(state, rng) : normalLine(state, rng, budget);
  if (!(edge >= 0 && edge < state.lines.length && state.lines[edge] === -1)) {
    // 혹시라도 잘못 고르면 아무 빈 선이나
    edge = state.lines.findIndex((p) => p === -1);
  }
  return { type: 'line', edge };
}

/** 테스트용: 가져가기 분석을 상태에서 바로 */
export function captureInfo(state: Pick<BoxesState, 'size' | 'lines'>): CaptureInfo | null {
  return analyzeCaptures(new Board(state));
}
