import { pick } from '../../lib/random';
import { DX, DY, Grid, majority, opposite, type FeatureInfo } from './board';
import { flagChoices, gridOf, jangseungScore, placementsFor, type Placement } from './rules';
import { DISTINCT_ROTS, EDGES, SEG_AT, TILES, isJangseungTile } from './tiles';
import type { FeatureKind, Rng, VillageAction, VillageState } from './types';

/**
 * 우리 마을 지도 컴퓨터.
 * - 쉬움: 놓을 수 있는 곳 중 아무 데나 (무언가를 완성하는 자리를 조금 더 좋아함), 깃발은 가끔.
 * - 보통: (손 조각 × 자리 × 방향 × 깃발) 모두를 따져 본다.
 *   바로 얻는 점수 + 내 깃발 지형이 앞으로 완성될 기대 점수 − 남의 깃발 지형을 도와주는 만큼,
 *   깃발은 아껴 두는 값을 빼고 꽂는다. 남의 지형에 내 지형을 이어 붙여 같이 먹거나 빼앗는 것도 이 계산에 들어 있다.
 */
export type AiLevel = 'ai-easy' | 'ai-normal';

const BASE_CHANCE: Record<FeatureKind, number> = { path: 0.8, stream: 0.62, paddy: 0.72 };
const GROWTH: Record<FeatureKind, number> = { path: 1, stream: 1, paddy: 2 };

interface Ctx {
  grid: Grid;
  n: number;
  me: number;
  /** 남은 조각 수 (더미 + 모든 손) */
  left: number;
  /** 남은 조각 중 길·냇물·논의 열린 끝을 막을 수 있는 조각 수 */
  caps: Record<FeatureKind, number>;
  oppWeight: number;
  flagWorth: number;
  /** 지금 지도의 지형 (조각·지형 번호마다) */
  before: Map<number, FeatureInfo>;
  jangseung: boolean;
}

const nodeId = (i: number, s: number) => i * 8 + s;

function makeCtx(state: VillageState): Ctx {
  const grid = gridOf(state);
  const n = state.players.length;
  const me = state.current;
  const rest = [...state.stack, ...state.players.flatMap((p) => p.hand)];
  const caps: Record<FeatureKind, number> = { path: 0, stream: 0, paddy: 0 };
  for (const t of rest) for (const s of TILES[t].segs) if (s.edges.length === 1) caps[s.kind] += 1;
  const left = rest.length;
  const flags = state.players[me].flags;
  const myTurns = left / n;
  const base = flags >= 4 ? 1.2 : flags === 3 ? 1.8 : flags === 2 ? 2.6 : 3.6;
  return {
    grid,
    n,
    me,
    left,
    caps,
    oppWeight: n === 2 ? 0.9 : 0.6,
    flagWorth: myTurns <= 1 ? 0.2 : base * Math.min(1, myTurns / 7),
    before: new Map(),
    jangseung: state.options.jangseung,
  };
}

/** 지형이 끝까지 완성될 가능성 (아주 거칠게) */
function completeChance(ctx: Ctx, f: FeatureInfo): number {
  if (f.complete) return 1;
  const avail = Math.min(1, ctx.caps[f.kind] / f.open);
  const time = Math.min(1, ctx.left / (f.open * 3));
  return Math.pow(BASE_CHANCE[f.kind], f.open) * avail * time;
}

/** 깃발 주인이 이 지형에서 받을 것으로 보는 점수 */
function expected(ctx: Ctx, f: FeatureInfo): number {
  if (f.complete) return f.points;
  const p = completeChance(ctx, f);
  return p * (f.points + f.open * GROWTH[f.kind] * 0.5) + (1 - p) * Math.floor(f.points / 2);
}

/** 이 지형이 나에게 주는 값 (남이 받는 점수는 덜 나쁘게 뺀다) */
function worthFor(ctx: Ctx, f: FeatureInfo): number {
  const owners = majority(f.flags);
  if (owners.length === 0) return 0;
  const ev = expected(ctx, f);
  let v = 0;
  for (const o of owners) v += o === ctx.me ? ev : -ctx.oppWeight * ev;
  // 완성되면 깃발이 돌아온다
  if (f.complete) v += f.flags[ctx.me] * ctx.flagWorth;
  return v;
}

/** 깃발을 꽂으면 더해지는 값 (깃발이 없는 지형에만 꽂을 수 있다) */
function flagGain(ctx: Ctx, f: FeatureInfo): number {
  if (f.complete) return f.points;
  return expected(ctx, f) - ctx.flagWorth;
}

function beforeFeature(ctx: Ctx, i: number, s: number): FeatureInfo {
  const id = nodeId(i, s);
  let f = ctx.before.get(id);
  if (!f) {
    f = ctx.grid.trace(i, s, ctx.n);
    for (const [a, b] of f.nodes) ctx.before.set(nodeId(a, b), f);
  }
  return f;
}

export interface Plan {
  hand: number;
  at: Placement;
  /** 꽂을 지형 번호 (꽂지 않으면 null) */
  seg: number | null;
  value: number;
}

/** 조각 하나를 한 자리에 놓았을 때의 값과, 지형마다 깃발을 꽂으면 더해지는 값 */
function evaluate(ctx: Ctx, t: number, at: Placement, canFlag: boolean): { base: number; bestSeg: number | null; bestFlag: number } {
  const { grid } = ctx;
  // 놓기 전에 맞닿는 지형들
  const touched = new Set<FeatureInfo>();
  for (let side = 0; side < 4; side++) {
    const j = grid.get(at.x + DX[side], at.y + DY[side]);
    if (j === undefined) continue;
    const q = grid.tiles[j];
    const s2 = SEG_AT[q.t][q.r][opposite(side)];
    if (s2 >= 0) touched.add(beforeFeature(ctx, j, s2));
  }
  let base = 0;
  for (const f of touched) base -= worthFor(ctx, f);

  const index = grid.add({ t, x: at.x, y: at.y, r: at.r, flag: null, by: ctx.me });
  const seen = new Set<number>();
  let bestSeg: number | null = null;
  let bestFlag = 0;
  TILES[t].segs.forEach((_, s) => {
    if (seen.has(s)) return;
    const f = grid.trace(index, s, ctx.n);
    for (const [a, b] of f.nodes) if (a === index) seen.add(b);
    base += worthFor(ctx, f);
    if (canFlag && f.flags.every((c) => c === 0)) {
      const g = flagGain(ctx, f);
      if (g > bestFlag) {
        bestFlag = g;
        bestSeg = s;
      }
    }
  });
  if (ctx.jangseung && isJangseungTile(t)) base += jangseungScore(grid, index).points;
  grid.pop();
  return { base, bestSeg, bestFlag };
}

/** 보통: 모든 수를 따져서 가장 좋은 것 */
export function bestPlan(state: VillageState, rng: Rng = Math.random): Plan | null {
  const ctx = makeCtx(state);
  const me = state.players[state.current];
  const canFlag = me.flags > 0;
  let best: Plan | null = null;
  me.hand.forEach((t, h) => {
    // 같은 조각 두 장이면 한 번만 본다
    if (me.hand.indexOf(t) !== h) return;
    for (const at of placementsFor(ctx.grid, t, DISTINCT_ROTS[t])) {
      const e = evaluate(ctx, t, at, canFlag);
      const value = e.base + e.bestFlag + rng() * 0.05;
      if (!best || value > best.value) best = { hand: h, at, seg: e.bestSeg, value };
    }
  });
  return best;
}

/** 이번 놓기가 무언가를 완성하는지 (쉬움이 좋아한다) */
function completesSomething(grid: Grid, t: number, at: Placement, n: number): boolean {
  const index = grid.add({ t, x: at.x, y: at.y, r: at.r, flag: null, by: null });
  let done = false;
  for (let s = 0; s < TILES[t].segs.length && !done; s++) done = grid.trace(index, s, n).complete;
  grid.pop();
  return done;
}

function chooseDiscard(state: VillageState, level: AiLevel, rng: Rng): VillageAction {
  const hand = state.players[state.current].hand;
  if (level === 'ai-easy' || hand.length < 2) return { type: 'discard', hand: Math.floor(rng() * hand.length) };
  // 보통: 들이 아닌 모서리가 많은(맞추기 어려운) 조각을 버린다
  const hard = hand.map((t) => EDGES[t][0].filter((e) => e !== 'field').length);
  return { type: 'discard', hand: hard[0] >= hard[1] ? 0 : 1 };
}

function decidePlace(state: VillageState, level: AiLevel, rng: Rng): VillageAction {
  const grid = gridOf(state);
  const me = state.players[state.current];
  if (level === 'ai-normal') {
    const plan = bestPlan(state, rng);
    if (!plan) return chooseDiscard(state, level, rng);
    return { type: 'place', hand: plan.hand, x: plan.at.x, y: plan.at.y, r: plan.at.r };
  }
  const all: { hand: number; at: Placement }[] = [];
  me.hand.forEach((t, h) => placementsFor(grid, t).forEach((at) => all.push({ hand: h, at })));
  if (all.length === 0) return chooseDiscard(state, level, rng);
  let choice = pick(all, rng)!;
  if (rng() < 0.6) {
    const n = state.players.length;
    const finishing = all.filter((o) => completesSomething(grid, me.hand[o.hand], o.at, n));
    if (finishing.length > 0) choice = pick(finishing, rng)!;
  }
  return { type: 'place', hand: choice.hand, x: choice.at.x, y: choice.at.y, r: choice.at.r };
}

function decideFlag(state: VillageState, level: AiLevel, rng: Rng): VillageAction {
  const choices = flagChoices(state).filter((c) => c.ok);
  if (choices.length === 0) return { type: 'skipFlag' };
  if (level === 'ai-easy') {
    const done = choices.filter((c) => c.feature.complete);
    if (done.length > 0 && rng() < 0.7) return { type: 'flag', seg: pick(done, rng)!.seg };
    if (rng() < 0.35) return { type: 'flag', seg: pick(choices, rng)!.seg };
    return { type: 'skipFlag' };
  }
  const ctx = makeCtx(state);
  let best: { seg: number; gain: number } | null = null;
  for (const c of choices) {
    const gain = flagGain(ctx, c.feature);
    if (gain > 0 && (!best || gain > best.gain)) best = { seg: c.seg, gain };
  }
  return best ? { type: 'flag', seg: best.seg } : { type: 'skipFlag' };
}

/** 지금 차례인 컴퓨터가 할 행동 (끝났으면 null) */
export function decideAction(state: VillageState, level: AiLevel, rng: Rng = Math.random): VillageAction | null {
  if (state.phase === 'place') return decidePlace(state, level, rng);
  if (state.phase === 'flag') return decideFlag(state, level, rng);
  return null;
}
