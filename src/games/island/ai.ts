import { pick } from '../../lib/random';
import { CORNERS, EDGES, HEXES } from './board';
import {
  COSTS,
  HAND_LIMIT,
  FLAG_MIN,
  RESOURCES,
  TERRAIN_INFO,
  bankRate,
  canAfford,
  emptyRes,
  missing,
  points,
  previewChoice,
  spacedOk,
  totalRes,
  touchedHexes,
  validSpots,
} from './rules';
import type { BuildKind, IslandAction, IslandState, Resource, ResourceCount, Rng } from './types';

export type AiLevel = 'ai-easy' | 'ai-normal';

/**
 * 한 칸에서 한 번 굴릴 때 받을 것으로 기대하는 자원 수.
 * 숫자 하나가 주사위 두 개 중 하나에라도 나올 확률은 11/36이고, 같은 눈(1/36)이면 두 번 받으니
 * 기대값은 11/36 + 1/36 = 1/3. 숫자 1~6이 모두 같은 확률이라 칸마다 같다.
 */
export const HEX_YIELD = 1 / 3;
/** 숫자 하나가 한 번 굴릴 때 나올 확률 */
export const NUMBER_CHANCE = 11 / 36;

/** 자원마다 쓰임새 (돌은 길·집·회관·등대에 모두 들어서 가장 많이 필요하다) */
const DEMAND: Record<Resource, number> = { wood: 1.0, stone: 1.2, grain: 0.9, fish: 1.0 };

// ------------------------------------------------------------------ 값 매기기

/** 섬 전체에서 자원이 얼마나 귀한지: 그 자원이 나는 칸이 적을수록, 많이 쓰일수록 크다 */
export function resourceWeights(state: IslandState): ResourceCount {
  const count = emptyRes();
  for (const h of HEXES) {
    const r = TERRAIN_INFO[state.terrain[h.id]].res;
    if (r) count[r] += 1;
  }
  const avg = RESOURCES.reduce((s, r) => s + count[r], 0) / RESOURCES.length;
  const w = emptyRes();
  for (const r of RESOURCES) w[r] = DEMAND[r] * (avg / Math.max(1, count[r]));
  return w;
}

/** 이 사람이 한 번 굴릴 때마다 받을 것으로 기대하는 자원 */
export function productionOf(state: IslandState, p: number): ResourceCount {
  const out = emptyRes();
  state.buildings.forEach((b, c) => {
    if (!b || b.owner !== p) return;
    for (const h of CORNERS[c].hexes) {
      const r = TERRAIN_INFO[state.terrain[h]].res;
      if (r) out[r] += HEX_YIELD * (b.type === 'hall' ? 2 : 1);
    }
  });
  return out;
}

/** 이 사람 건물이 닿은 숫자들 */
function coveredNumbers(state: IslandState, p: number): Set<number> {
  const out = new Set<number>();
  state.buildings.forEach((b, c) => {
    if (!b || b.owner !== p) return;
    for (const h of CORNERS[c].hexes) if (state.numbers[h] > 0) out.add(state.numbers[h]);
  });
  return out;
}

interface Ctx {
  p: number;
  weights: ResourceCount;
  prod: ResourceCount;
  covered: Set<number>;
  touched: Set<number>;
  hasCoast: boolean;
}

function context(state: IslandState, p: number): Ctx {
  const hasCoast = state.buildings.some((b, c) => !!b && b.owner === p && CORNERS[c].coastal);
  return { p, weights: resourceWeights(state), prod: productionOf(state, p), covered: coveredNumbers(state, p), touched: touchedHexes(state, p), hasCoast };
}

/** 모서리에 서 있는 건물 하나가 낳는 자원의 값 (회관이면 두 배) */
function yieldValue(state: IslandState, c: number, ctx: Ctx): number {
  let v = 0;
  for (const h of CORNERS[c].hexes) {
    const r = TERRAIN_INFO[state.terrain[h]].res;
    if (r) v += HEX_YIELD * 3 * ctx.weights[r];
  }
  return v;
}

/**
 * 빈 모서리에 집을 지을 때의 값:
 * 닿는 땅의 기대 생산 × 자원의 귀함 + 아직 없는 자원·숫자 보너스 + 새로 닿는 땅(축제) + 바닷가(등대 자리)
 */
export function cornerValue(state: IslandState, c: number, ctx: Ctx): number {
  let v = 0;
  const seen = new Set<number>();
  for (const h of CORNERS[c].hexes) {
    const r = TERRAIN_INFO[state.terrain[h]].res;
    if (!r) continue;
    const lack = ctx.prod[r] < 0.2 ? 1.4 : ctx.prod[r] < 0.5 ? 1.12 : 1;
    v += HEX_YIELD * 3 * ctx.weights[r] * lack;
    const n = state.numbers[h];
    if (!ctx.covered.has(n) && !seen.has(n)) {
      // 새 숫자: 굴릴 때 하나라도 받을 확률이 올라간다
      v += NUMBER_CHANCE * 0.8;
      seen.add(n);
    }
  }
  const fresh = CORNERS[c].hexes.filter((h) => !ctx.touched.has(h)).length;
  v += fresh * 0.12;
  if (CORNERS[c].coastal && !ctx.hasCoast) v += 0.35;
  return v;
}

// ------------------------------------------------------------------ 계획

export interface Plan {
  kind: 'house' | 'hall' | 'lighthouse';
  /** 지을 모서리 */
  at: number;
  /** 집까지 먼저 놓아야 할 길 (가까운 것부터) */
  path: number[];
  cost: ResourceCount;
  value: number;
  priority: number;
}

/** 내 길·건물에서 빈 변을 따라 3칸까지: 모서리마다 거리와 거기까지 놓을 길 */
function roadReach(state: IslandState, p: number, maxDepth = 3): Map<number, number[]> {
  const out = new Map<number, number[]>();
  const queue: number[] = [];
  for (let c = 0; c < CORNERS.length; c++) {
    const b = state.buildings[c];
    const mine = (b && b.owner === p) || (!b && CORNERS[c].edges.some((e) => state.roads[e] === p));
    if (mine) {
      out.set(c, []);
      queue.push(c);
    }
  }
  while (queue.length > 0) {
    const c = queue.shift()!;
    const path = out.get(c)!;
    if (path.length >= maxDepth) continue;
    const b = state.buildings[c];
    if (b && b.owner !== p) continue; // 남의 건물을 지나갈 수 없다
    for (const e of CORNERS[c].edges) {
      if (state.roads[e] !== null) continue;
      const edge = EDGES[e];
      const next = edge.a === c ? edge.b : edge.a;
      if (out.has(next)) continue;
      out.set(next, [...path, e]);
      queue.push(next);
    }
  }
  return out;
}

function addCost(a: ResourceCount, b: ResourceCount, times = 1): ResourceCount {
  const out = emptyRes();
  for (const r of RESOURCES) out[r] = a[r] + b[r] * times;
  return out;
}

/** 모자란 것을 채우는 데 몇 바퀴쯤 걸릴지 어림 (바꾸기로 채울 수 있는 만큼은 뺀다) */
function eta(state: IslandState, ctx: Ctx, cost: ResourceCount): number {
  const hand = state.players[ctx.p].res;
  const need = missing(hand, cost);
  const lack = totalRes(need);
  if (lack === 0) return 0;
  const rate = bankRate(state, ctx.p);
  let trade = 0;
  for (const r of RESOURCES) trade += Math.floor(Math.max(0, hand[r] - cost[r]) / rate);
  if (state.options.market && RESOURCES.some((r) => need[r] > 0 && state.market.includes(r))) trade += 1;
  const remaining = Math.max(0, lack - trade);
  const perRound = RESOURCES.reduce((s, r) => s + (need[r] > 0 ? ctx.prod[r] : ctx.prod[r] * 0.3), 0) * state.players.length;
  return (lack - remaining) * 0.15 + remaining / Math.max(0.6, perRound);
}

/** 할 만한 목표를 모두 모아 좋은 순서로 (집·회관·등대, 그리고 집을 위한 길) */
export function makePlans(state: IslandState, p: number): Plan[] {
  const ctx = context(state, p);
  const plans: Plan[] = [];
  const myPoints = points(state, p);
  const target = state.options.target;
  const flagCount = state.flagHolder === null ? FLAG_MIN - 1 : state.flagHolder === p ? Infinity : touchedHexes(state, state.flagHolder).size;

  const finish = (gain: number) => (myPoints + gain >= target ? 6 : 0);

  // 마을회관
  state.buildings.forEach((b, c) => {
    if (!b || b.owner !== p || b.type !== 'house') return;
    const value = 1 + yieldValue(state, c, ctx) * 0.9 + finish(1);
    plans.push({ kind: 'hall', at: c, path: [], cost: COSTS.hall, value, priority: 0 });
  });

  // 등대: 바닷가 건물 중 아무 곳
  if (state.lighthouses[p] === null) {
    const spots = validSpots(state, p, 'lighthouse');
    if (spots.length > 0) {
      const value = 2 + 0.5 + finish(2);
      plans.push({ kind: 'lighthouse', at: spots[0], path: [], cost: COSTS.lighthouse, value, priority: 0 });
    }
  }

  // 집 (길이 이미 닿았거나 3칸 안)
  const reach = roadReach(state, p);
  for (const [c, path] of reach) {
    if (!spacedOk(state, c)) continue;
    if (path.length === 0 && !CORNERS[c].edges.some((e) => state.roads[e] === p)) continue;
    const d = path.length;
    let value = 1 + cornerValue(state, c, ctx) * 0.9;
    const after = new Set([...ctx.touched, ...CORNERS[c].hexes]).size;
    if (after > flagCount && after >= FLAG_MIN) value += 2.2 + finish(3);
    else value += finish(1);
    value = value * Math.pow(0.82, d) - 0.12 * d;
    plans.push({ kind: 'house', at: c, path, cost: addCost(COSTS.house, COSTS.road, d), value, priority: 0 });
  }

  for (const plan of plans) plan.priority = plan.value / (1 + eta(state, ctx, plan.cost));
  return plans.sort((a, b) => b.priority - a.priority || a.at - b.at);
}

/** 계획의 바로 다음 한 걸음 */
function nextStep(plan: Plan): { kind: BuildKind; at: number } {
  if (plan.path.length > 0) return { kind: 'road', at: plan.path[0] };
  return { kind: plan.kind, at: plan.at };
}

// ------------------------------------------------------------------ 처음 집·길

function setupHouseChoice(state: IslandState, level: AiLevel, rng: Rng): number {
  const p = state.current;
  const spots = validSpots(state, p, 'house');
  if (level === 'ai-easy') {
    const producing = (c: number) => CORNERS[c].hexes.filter((h) => TERRAIN_INFO[state.terrain[h]].res).length;
    const best = spots.filter((c) => producing(c) === 3);
    const good = spots.filter((c) => producing(c) >= 2);
    return pick(best.length > 0 && rng() < 0.7 ? best : good.length > 0 ? good : spots, rng)!;
  }
  const ctx = context(state, p);
  let best = spots[0];
  let bestV = -Infinity;
  for (const c of spots) {
    const v = cornerValue(state, c, ctx) + rng() * 0.05;
    if (v > bestV) {
      bestV = v;
      best = c;
    }
  }
  return best;
}

function setupRoadChoice(state: IslandState, level: AiLevel, rng: Rng): number {
  const p = state.current;
  const spots = validSpots(state, p, 'road');
  if (level === 'ai-easy') return pick(spots, rng)!;
  const ctx = context(state, p);
  // 집이 이미 놓였다고 치고 다음 집 자리를 본다
  ctx.touched = new Set([...ctx.touched]);
  let best = spots[0];
  let bestV = -Infinity;
  for (const e of spots) {
    const edge = EDGES[e];
    const far = edge.a === state.setupHouse ? edge.b : edge.a;
    let v = 0;
    for (const c of CORNERS[far].corners) {
      if (c === state.setupHouse || !spacedOk(state, c)) continue;
      v = Math.max(v, cornerValue(state, c, ctx));
    }
    v += rng() * 0.02;
    if (v > bestV) {
      bestV = v;
      best = e;
    }
  }
  return best;
}

// ------------------------------------------------------------------ 내려놓기

/** 손 제한: 목표에 필요한 것은 남기고 많이 남는 것부터 내려놓는다 */
export function chooseDiscard(state: IslandState, level: AiLevel, rng: Rng): ResourceCount {
  const p = state.current;
  const hand = { ...state.players[p].res };
  const out = emptyRes();
  const keep = emptyRes();
  if (level === 'ai-normal') {
    const plan = makePlans(state, p)[0];
    if (plan) for (const r of RESOURCES) keep[r] = plan.cost[r];
  }
  const w = resourceWeights(state);
  for (let k = 0; k < state.discardNeed; k++) {
    const options = RESOURCES.filter((r) => hand[r] > 0);
    let r: Resource;
    if (level === 'ai-easy') r = pick(options, rng)!;
    else r = options.sort((a, b) => hand[b] - keep[b] - (hand[a] - keep[a]) || w[a] - w[b])[0];
    hand[r] -= 1;
    out[r] += 1;
  }
  return out;
}

// ------------------------------------------------------------------ 바꾸기

/** 목표에 모자란 것을 장터·은행으로 채우는 한 번의 바꾸기 (할 게 없으면 null) */
function tradeToward(state: IslandState, cost: ResourceCount, force: boolean): IslandAction | null {
  const p = state.current;
  const hand = state.players[p].res;
  const need = missing(hand, cost);
  const lack = totalRes(need);
  if (lack === 0) return null;
  const w = resourceWeights(state);
  const surplus = (r: Resource) => hand[r] - cost[r];
  const wanted = RESOURCES.filter((r) => need[r] > 0).sort((a, b) => need[b] - need[a] || w[b] - w[a]);

  // 장터: 남는 자원 1개로 모자란 자원 1개
  if (state.options.market && !state.marketUsed) {
    for (const get of wanted) {
      const slot = state.market.indexOf(get);
      if (slot < 0) continue;
      const give = RESOURCES.filter((r) => r !== get && surplus(r) > 0).sort((a, b) => surplus(b) - surplus(a) || w[a] - w[b])[0];
      if (give) return { type: 'market', give, slot };
    }
  }

  // 은행: 이번 차례에 목표를 다 채울 수 있을 때만 (또는 어차피 내려놓아야 할 때)
  if (state.bankTrades >= 4) return null;
  const rate = bankRate(state, p);
  let can = 0;
  for (const r of RESOURCES) can += Math.floor(Math.max(0, surplus(r)) / rate);
  if (can < lack && !force) return null;
  const give = RESOURCES.filter((r) => surplus(r) >= rate).sort((a, b) => surplus(b) - surplus(a) || w[a] - w[b])[0];
  if (!give) return null;
  return { type: 'bank', give, get: wanted[0] };
}

// ------------------------------------------------------------------ 차례

function normalMain(state: IslandState): IslandAction {
  const p = state.current;
  const hand = state.players[p].res;
  const plans = makePlans(state, p);
  const best = plans[0];
  const over = totalRes(hand) > HAND_LIMIT;

  // 1) 지금 지을 수 있는 좋은 것 (가장 좋은 목표에 쓸 자원은 아껴 둔다)
  const bestLack = best ? totalRes(missing(hand, best.cost)) : 0;
  for (const plan of plans) {
    const step = nextStep(plan);
    const cost = COSTS[step.kind];
    if (!canAfford(hand, cost)) continue;
    if (plan === best || over) return { type: 'build', kind: step.kind, at: step.at };
    if (plan.priority < best.priority * 0.6) continue;
    const left = emptyRes();
    for (const r of RESOURCES) left[r] = hand[r] - cost[r];
    if (totalRes(missing(left, best.cost)) <= bestLack) return { type: 'build', kind: step.kind, at: step.at };
  }

  // 2) 가장 좋은 목표를 향해 바꾸기
  if (best) {
    const t = tradeToward(state, best.cost, over);
    if (t) return t;
    // 회관·등대처럼 다음 걸음이 바로 목표인데, 걸음만큼은 채울 수 있으면
    const step = nextStep(best);
    if (step.kind === 'road') {
      const t2 = tradeToward(state, COSTS.road, over);
      if (t2) return t2;
    }
  }

  // 3) 손이 넘치면 무엇이든 짓거나 바꾼다
  if (over) {
    for (const kind of ['house', 'hall', 'lighthouse', 'road'] as BuildKind[]) {
      if (!canAfford(hand, COSTS[kind])) continue;
      const spots = validSpots(state, p, kind);
      if (spots.length > 0) return { type: 'build', kind, at: bestSpot(state, p, kind, spots) };
    }
  }
  return { type: 'endTurn' };
}

/** 여러 자리 중 고르기 (보통 컴퓨터와 초보 도움 추천이 함께 쓴다) */
function bestSpot(state: IslandState, p: number, kind: BuildKind, spots: number[]): number {
  const ctx = context(state, p);
  if (kind === 'road') {
    const plan = makePlans(state, p).find((pl) => pl.path.length > 0 && spots.includes(pl.path[0]));
    if (plan) return plan.path[0];
    return spots[0];
  }
  let best = spots[0];
  let bestV = -Infinity;
  for (const c of spots) {
    const v = kind === 'house' ? cornerValue(state, c, ctx) : kind === 'hall' ? yieldValue(state, c, ctx) : -c;
    if (v > bestV) {
      bestV = v;
      best = c;
    }
  }
  return best;
}

function easyMain(state: IslandState, rng: Rng): IslandAction {
  const p = state.current;
  const hand = state.players[p].res;
  for (const kind of ['house', 'hall', 'lighthouse'] as BuildKind[]) {
    if (!canAfford(hand, COSTS[kind])) continue;
    const spots = validSpots(state, p, kind);
    if (spots.length > 0 && rng() < 0.85) return { type: 'build', kind, at: pick(spots, rng)! };
  }
  if (canAfford(hand, COSTS.road) && validSpots(state, p, 'house').length === 0 && rng() < 0.6) {
    const spots = validSpots(state, p, 'road');
    // 집 지을 빈자리 쪽으로 가는 길이면 더 좋다 (가끔은 아무 데나)
    const toward = spots.filter((e) => [EDGES[e].a, EDGES[e].b].some((v) => spacedOk(state, v) || CORNERS[v].corners.some((n) => spacedOk(state, n))));
    if (spots.length > 0) return { type: 'build', kind: 'road', at: pick(toward.length > 0 && rng() < 0.75 ? toward : spots, rng)! };
  }
  // 집이나 마을회관에 하나만 모자라면 은행에서 바꿔 본다 (차례마다 한 번)
  if (state.bankTrades === 0) {
    for (const kind of ['house', 'hall'] as const) {
      const need = missing(hand, COSTS[kind]);
      const rate = bankRate(state, p);
      const give = RESOURCES.find((r) => hand[r] - COSTS[kind][r] >= rate);
      const get = RESOURCES.find((r) => need[r] > 0);
      if (totalRes(need) === 1 && give && get) return { type: 'bank', give, get };
    }
  }
  return { type: 'endTurn' };
}

/**
 * 골라 쓰는 주사위: 두 눈 중 어느 쪽을 쓸지.
 * 보통은 (내가 받는 자원의 값, 지금 목표에 모자란 것이면 더) − (남이 받는 자원 × 비중, 1등에게 가면 더 크게)
 */
export function chooseDie(state: IslandState, level: AiLevel, rng: Rng): 0 | 1 {
  if (level === 'ai-easy') return rng() < 0.5 ? 0 : 1;
  const p = state.current;
  const w = resourceWeights(state);
  const hand = state.players[p].res;
  const plan = makePlans(state, p)[0];
  const need = plan ? missing(hand, plan.cost) : emptyRes();
  const lead = Math.max(...state.players.map((_, i) => (i === p ? -1 : points(state, i))));
  const score = (die: 0 | 1) => {
    const per = previewChoice(state, die);
    let v = 0;
    for (const r of RESOURCES) v += per[p][r] * w[r] + Math.min(per[p][r], need[r]) * 0.8;
    per.forEach((g, i) => {
      if (i === p) return;
      const share = 0.6 * (points(state, i) === lead ? 1.4 : 1);
      v -= totalRes(g) * share;
    });
    return v;
  };
  const a = score(0);
  const b = score(1);
  if (Math.abs(a - b) < 1e-9) return rng() < 0.5 ? 0 : 1;
  return a > b ? 0 : 1;
}

/** 지금 차례인 컴퓨터가 할 행동 하나 */
export function decideAction(state: IslandState, level: AiLevel, rng: Rng = Math.random): IslandAction {
  switch (state.phase) {
    case 'setup':
      return state.setupHouse === null
        ? { type: 'build', kind: 'house', at: setupHouseChoice(state, level, rng) }
        : { type: 'build', kind: 'road', at: setupRoadChoice(state, level, rng) };
    case 'roll':
      return { type: 'roll' };
    case 'choose':
      return { type: 'choose', die: chooseDie(state, level, rng) };
    case 'discard':
      return { type: 'discard', res: chooseDiscard(state, level, rng) };
    case 'main':
      return level === 'ai-normal' ? normalMain(state) : easyMain(state, rng);
    default:
      return { type: 'endTurn' };
  }
}

/** 초보 도움: 이 종류를 지을 때 추천하는 자리 (없으면 null) */
export function recommendSpot(state: IslandState, p: number, kind: BuildKind): number | null {
  if (state.phase === 'setup') {
    if (state.current !== p) return null;
    if (kind === 'house' && state.setupHouse === null) return setupHouseChoice(state, 'ai-normal', () => 0);
    if (kind === 'road' && state.setupHouse !== null) return setupRoadChoice(state, 'ai-normal', () => 0);
    return null;
  }
  const spots = validSpots(state, p, kind);
  if (spots.length === 0) return null;
  return bestSpot(state, p, kind, spots);
}
