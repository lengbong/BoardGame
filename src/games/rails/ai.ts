import { pick, shuffle } from '../../lib/random';
import { CITY_ROUTES, PLAN, ROUTES, ROUTE_POINTS, STAMP_AT, STAMP_FIRST_POINTS, STAMP_LATER_POINTS, TICKET_COLORS, otherEnd } from './map';
import {
  affordableRoutes,
  applyAction,
  canPass,
  canTakeAny,
  canTakeDeck,
  completedPlans,
  handTotal,
  largestNetwork,
  networkRoots,
  paymentOptions,
  type Payment,
} from './rules';
import type { PlanOffer, RailsAction, RailsState, Rng, TicketColor } from './types';

export type AiLevel = 'ai-easy' | 'ai-normal';

/** 한 번 깔 때마다 차례 하나를 쓰므로, 같은 칸 수면 길 수가 적은 쪽을 고르도록 붙이는 값 */
const TURN_COST = 0.45;

export interface PathResult {
  /** 새로 깔아야 하는 칸 수 (이미 깐 길과 free 길은 0) */
  cost: number;
  /** 길 위에서 아직 아무도 깔지 않은 길 (free 포함) */
  open: number[];
  /** 그중 free에 없는 길 */
  fresh: number[];
}

/**
 * me가 from에서 to까지 가는 가장 싼 길 (다익스트라).
 * 내 길과 free 길은 공짜, 남이 깐 길은 못 지나가고, 빈 길은 칸 수만큼.
 */
export function cheapestPath(
  state: RailsState,
  me: number,
  from: string,
  to: string,
  opts: { free?: ReadonlySet<number>; exclude?: number } = {},
): PathResult | null {
  const dist = new Map<string, number>([[from, 0]]);
  const via = new Map<string, number>();
  const done = new Set<string>();
  for (;;) {
    let best: string | null = null;
    let bestD = Infinity;
    for (const [city, d] of dist) {
      if (!done.has(city) && d < bestD) {
        best = city;
        bestD = d;
      }
    }
    if (best === null) return null;
    if (best === to) break;
    done.add(best);
    for (const rid of CITY_ROUTES[best]) {
      if (rid === opts.exclude) continue;
      const owner = state.owners[rid];
      let w: number;
      if (owner === me || opts.free?.has(rid)) w = 0;
      else if (owner !== null) continue;
      else w = ROUTES[rid].length + TURN_COST;
      const next = otherEnd(ROUTES[rid], best);
      const nd = bestD + w;
      if (nd < (dist.get(next) ?? Infinity)) {
        dist.set(next, nd);
        via.set(next, rid);
      }
    }
  }
  const open: number[] = [];
  const fresh: number[] = [];
  let cost = 0;
  let city = to;
  while (city !== from) {
    const rid = via.get(city)!;
    if (state.owners[rid] === null) {
      open.push(rid);
      if (!opts.free?.has(rid)) {
        fresh.push(rid);
        cost += ROUTES[rid].length;
      }
    }
    city = otherEnd(ROUTES[rid], city);
  }
  return { cost, open, fresh };
}

export interface PlanNeeds {
  /** 계획을 이루려고 깔 길들 */
  targets: number[];
  /** 그 길에 드는 기차 칸 */
  committed: number;
  /** 아직 이루지 못한 계획 중 이룰 수 있는 것 */
  live: number[];
  /** 막혔거나 기차가 모자라서 못 이루는 계획 */
  dead: number[];
  /** 계획마다 고른 길 */
  paths: Map<number, number[]>;
}

/** 아직 못 이은 계획들을 점수 큰 것부터 차례로 길을 정한다 (앞 계획의 길은 다음 계획에 공짜) */
export function planNeeds(state: RailsState, me: number, extraPlans: number[] = []): PlanNeeds {
  const p = state.players[me];
  const done = new Set(completedPlans(state, me));
  const pending = [...p.plans, ...extraPlans].filter((id) => !done.has(id)).sort((a, b) => PLAN[b].points - PLAN[a].points);
  const free = new Set<number>();
  let committed = 0;
  const live: number[] = [];
  const dead: number[] = [];
  const paths = new Map<number, number[]>();
  for (const id of pending) {
    const plan = PLAN[id];
    const path = cheapestPath(state, me, plan.a, plan.b, { free });
    if (!path || committed + path.cost > p.trains) {
      dead.push(id);
      continue;
    }
    for (const r of path.fresh) free.add(r);
    committed += path.cost;
    live.push(id);
    paths.set(id, path.open);
  }
  return { targets: [...free], committed, live, dead, paths };
}

/** 이 도시에 도장을 받으면 몇 점인지 */
function stampGain(state: RailsState, me: number, city: string): number {
  if (!state.options.stamps || !STAMP_AT[city]) return 0;
  if (state.players[me].stamps.some((m) => m.city === city)) return 0;
  return state.stampFirst[city] === null ? STAMP_FIRST_POINTS : STAMP_LATER_POINTS;
}

/** 남이 이 도시까지 기찻길을 깔아 두었는지 (그 길을 노릴 수 있다) */
function rivalsNear(state: RailsState, me: number, city: string): number {
  let n = 0;
  state.players.forEach((p, i) => {
    if (i !== me && p.routes.some((rid) => ROUTES[rid].a === city || ROUTES[rid].b === city)) n += 1;
  });
  return n;
}

/** 계획에 쓸 길들 중 무엇부터 깔지: 길수록, 막히면 크게 돌아가야 할수록, 남이 노릴수록 먼저 */
function targetPriority(state: RailsState, me: number, rid: number, needs: PlanNeeds): number {
  const r = ROUTES[rid];
  let crit = 0;
  const free = new Set(needs.targets);
  free.delete(rid);
  for (const [planId, open] of needs.paths) {
    if (!open.includes(rid)) continue;
    const plan = PLAN[planId];
    const alt = cheapestPath(state, me, plan.a, plan.b, { free, exclude: rid });
    crit += alt ? Math.max(0, alt.cost - r.length) : 12;
  }
  const contest = rivalsNear(state, me, r.a) + rivalsNear(state, me, r.b);
  const stamp = stampGain(state, me, r.a) + stampGain(state, me, r.b);
  return r.length * 1.3 + Math.min(crit, 12) * 0.5 + contest * 0.8 + stamp * 0.6;
}

/** 색마다 계획 길에 아직 필요한 칸 (회색 길은 따로) */
function colorNeeds(needs: PlanNeeds): { need: Record<TicketColor, number>; gray: number } {
  const need = { red: 0, orange: 0, yellow: 0, green: 0, blue: 0, purple: 0 } as Record<TicketColor, number>;
  let gray = 0;
  for (const rid of needs.targets) {
    const r = ROUTES[rid];
    if (r.color === 'gray') gray += r.length;
    else need[r.color] += r.length;
  }
  return { need, gray };
}

/** 값 치르는 방법: 만능표를 적게, 다른 계획 길에 쓸 색은 아껴서 */
function choosePayment(state: RailsState, me: number, rid: number, needs: PlanNeeds | null): Payment {
  const hand = state.players[me].hand;
  const opts = paymentOptions(hand, ROUTES[rid]);
  if (opts.length === 1 || !needs) return opts[0];
  const { need } = colorNeeds({ ...needs, targets: needs.targets.filter((t) => t !== rid) });
  let best = opts[0];
  let bestScore = -Infinity;
  for (const o of opts) {
    const colored = ROUTES[rid].length - o.wilds;
    const left = o.color ? hand[o.color] - colored : 0;
    const shortage = o.color ? Math.max(0, need[o.color] - left) - Math.max(0, need[o.color] - hand[o.color]) : 0;
    const score = -o.wilds * 3 - shortage * 2 + (o.color ? (hand[o.color] - need[o.color]) * 0.1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return best;
}

function claimAction(state: RailsState, me: number, rid: number, needs: PlanNeeds | null): RailsAction {
  const pay = choosePayment(state, me, rid, needs);
  return { type: 'claim', route: rid, color: pay.color, wilds: pay.wilds };
}

/** 이 길을 지금 깔면 바로 얻는 점수 (길 + 도장 + 이어지는 계획) */
function immediateGain(state: RailsState, me: number, rid: number): number {
  const r = ROUTES[rid];
  let gain = ROUTE_POINTS[r.length] + stampGain(state, me, r.a) + stampGain(state, me, r.b);
  const p = state.players[me];
  const before = new Set(completedPlans(state, me));
  const roots = networkRoots([...p.routes, rid]);
  for (const id of p.plans) {
    if (before.has(id)) continue;
    const plan = PLAN[id];
    const ra = roots.get(plan.a);
    if (ra !== undefined && ra === roots.get(plan.b)) gain += plan.points * 2;
  }
  return gain;
}

/** 계획과 상관없이 점수를 벌 길: 길수록, 내 기찻길 묶음을 키울수록 좋다 */
function bestFreeClaim(state: RailsState, me: number, afford: number[]): number | null {
  const p = state.players[me];
  if (afford.length === 0) return null;
  const big = largestNetwork(p.routes);
  const inBig = new Set(big.cities);
  const touched = new Set(p.routes.flatMap((rid) => [ROUTES[rid].a, ROUTES[rid].b]));
  let best: number | null = null;
  let bestScore = -Infinity;
  for (const rid of afford) {
    const r = ROUTES[rid];
    let score = ROUTE_POINTS[r.length] + stampGain(state, me, r.a) + stampGain(state, me, r.b);
    if (touched.has(r.a) || touched.has(r.b)) score += 1.5;
    if ((inBig.has(r.a) && !inBig.has(r.b)) || (inBig.has(r.b) && !inBig.has(r.a))) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = rid;
    }
  }
  return best;
}

/** 표 받기 (보통): 계획 길에 모자란 색을 창구에서, 없으면 더미에서 */
function chooseTakeNormal(state: RailsState, me: number, needs: PlanNeeds, rng: Rng): RailsAction {
  const hand = state.players[me].hand;
  const window = state.window;
  const deck = canTakeDeck(state);
  const take = (index: number): RailsAction => ({ type: 'take', from: 'window', index });
  if (needs.targets.length === 0) {
    // 긴 길을 깔 수 있게 가장 많이 든 색을 더 모은다
    const most = [...TICKET_COLORS].sort((a, b) => hand[b] - hand[a])[0];
    const idx = window.indexOf(most);
    if (idx >= 0 && hand[most] >= 2) return take(idx);
    if (deck) return { type: 'take', from: 'deck' };
  } else {
    const { need, gray } = colorNeeds(needs);
    // 가장 급한 길의 색은 조금 더 쳐준다
    const urgent = [...needs.targets].sort((a, b) => targetPriority(state, me, b, needs) - targetPriority(state, me, a, needs))[0];
    const urgentColor = ROUTES[urgent].color;
    let wildsLeft = hand.wild;
    const deficit = { red: 0, orange: 0, yellow: 0, green: 0, blue: 0, purple: 0 } as Record<TicketColor, number>;
    for (const c of TICKET_COLORS) deficit[c] = Math.max(0, need[c] - hand[c]);
    // 만능표는 가장 조금 모자란 색부터 메운다고 본다
    for (const c of [...TICKET_COLORS].sort((a, b) => deficit[a] - deficit[b])) {
      const use = Math.min(wildsLeft, deficit[c]);
      deficit[c] -= use;
      wildsLeft -= use;
    }
    // 회색 길은 남는 표가 가장 많은 색으로 채운다
    const surplus = [...TICKET_COLORS].sort((a, b) => hand[b] - need[b] - (hand[a] - need[a]))[0];
    let bestIdx = -1;
    let bestVal = 0;
    window.forEach((c, i) => {
      if (!c) return;
      let v = deficit[c] > 0 ? 2 + deficit[c] * 0.3 : 0;
      if (c === urgentColor && deficit[c] > 0) v += 1.2;
      if (gray > 0 && c === surplus) v = Math.max(v, 1.6);
      if (v > bestVal) {
        bestVal = v;
        bestIdx = i;
      }
    });
    if (bestIdx >= 0 && bestVal >= 1.5) return take(bestIdx);
    if (deck) return { type: 'take', from: 'deck' };
    if (bestIdx >= 0) return take(bestIdx);
  }
  const any = window.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
  return take(pick(any, rng) ?? 0);
}

/** 가장 작은 사람 기차 수 (곧 끝날지 보려고) */
function fewestTrains(state: RailsState): number {
  return Math.min(...state.players.map((p) => p.trains));
}

// ------------------------------------------------------------------ 계획 고르기

/** 보여 준 계획 중 가질 것을 고른다 */
export function choosePlans(state: RailsState, offer: PlanOffer, level: AiLevel, rng: Rng = Math.random): number[] {
  const me = offer.player;
  if (level === 'ai-easy') {
    const order = shuffle(offer.plans, rng);
    const keep = Math.min(order.length, offer.minKeep + (rng() < 0.25 ? 1 : 0));
    return order.slice(0, keep);
  }
  const p = state.players[me];
  const base = planNeeds(state, me);
  const free = new Set(base.targets);
  let budget = p.trains - base.committed;
  const chosen: number[] = [];
  const limit = offer.initial ? 0.8 : 0.9;
  // 게임 중에 뽑은 계획은 남은 시간도 본다: 누군가 기차를 거의 다 썼으면 짧은 계획만
  if (!offer.initial) budget = Math.min(budget, Math.max(0, fewestTrains(state) - 2) * 1.2);
  for (;;) {
    let best: number | null = null;
    let bestScore = -Infinity;
    let bestPath: PathResult | null = null;
    for (const id of offer.plans) {
      if (chosen.includes(id)) continue;
      const plan = PLAN[id];
      const path = cheapestPath(state, me, plan.a, plan.b, { free });
      if (!path || path.cost > budget * limit) continue;
      const score = plan.points - path.cost * 0.35;
      if (score > bestScore) {
        bestScore = score;
        best = id;
        bestPath = path;
      }
    }
    if (best === null || !bestPath) break;
    const extra = chosen.length >= offer.minKeep;
    if (extra && !(bestPath.cost <= 3 || (bestPath.cost <= budget * 0.3 && PLAN[best].points >= bestPath.cost))) break;
    chosen.push(best);
    for (const r of bestPath.fresh) free.add(r);
    budget -= bestPath.cost;
  }
  if (chosen.length < offer.minKeep) {
    // 꼭 가져야 하면 잃는 점수가 가장 적은 것
    const rest = offer.plans.filter((id) => !chosen.includes(id)).sort((a, b) => PLAN[a].points - PLAN[b].points);
    chosen.push(...rest.slice(0, offer.minKeep - chosen.length));
  }
  return chosen;
}

// ------------------------------------------------------------------ 차례

function easyTurn(state: RailsState, me: number, rng: Rng): RailsAction {
  const p = state.players[me];
  const afford = affordableRoutes(state, me);
  const takeRandom = (): RailsAction | null => {
    const slots = state.window.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
    if (canTakeDeck(state) && (slots.length === 0 || rng() < 0.5)) return { type: 'take', from: 'deck' };
    if (slots.length > 0) return { type: 'take', from: 'window', index: pick(slots, rng)! };
    return null;
  };
  if (state.drawn > 0) return takeRandom() ?? { type: 'pass' };

  // 계획 하나를 골라 그 길 위의 길들
  const done = new Set(completedPlans(state, me));
  const pending = p.plans.filter((id) => !done.has(id));
  const target = pick(pending, rng);
  const path = target !== undefined ? cheapestPath(state, me, PLAN[target].a, PLAN[target].b) : null;
  const onPlan = path ? afford.filter((r) => path.open.includes(r)) : [];

  if (afford.length > 0 && (rng() < 0.4 || handTotal(p.hand) >= 12 || !canTakeAny(state))) {
    const rid = onPlan.length > 0 && rng() < 0.6 ? pick(onPlan, rng)! : pick(afford, rng)!;
    return claimAction(state, me, rid, null);
  }
  if (pending.length === 0 && p.trains >= 15 && state.planDeck.length > 0 && state.finalTurns === null && rng() < 0.15) return { type: 'drawPlans' };
  if (path && rng() < 0.5) {
    const colors = new Set(path.open.map((r) => ROUTES[r].color));
    const idx = state.window.findIndex((c) => c !== null && colors.has(c));
    if (idx >= 0) return { type: 'take', from: 'window', index: idx };
  }
  const t = takeRandom();
  if (t) return t;
  if (afford.length > 0) return claimAction(state, me, pick(afford, rng)!, null);
  if (state.planDeck.length > 0) return { type: 'drawPlans' };
  return { type: 'pass' };
}

function normalTurn(state: RailsState, me: number, rng: Rng): RailsAction {
  const p = state.players[me];
  const needs = planNeeds(state, me);
  if (state.drawn > 0) return canTakeAny(state) ? chooseTakeNormal(state, me, needs, rng) : { type: 'pass' };

  const afford = affordableRoutes(state, me);
  // 마지막 바퀴: 이번이 마지막 차례이므로 지금 가장 점수가 큰 길
  if (state.finalTurns !== null) {
    if (afford.length > 0) {
      const best = [...afford].sort((a, b) => immediateGain(state, me, b) - immediateGain(state, me, a))[0];
      return claimAction(state, me, best, needs);
    }
    if (canTakeAny(state)) return chooseTakeNormal(state, me, needs, rng);
    return canPass(state) ? { type: 'pass' } : { type: 'drawPlans' };
  }

  const affordTargets = afford.filter((r) => needs.targets.includes(r));
  if (affordTargets.length > 0) {
    const best = [...affordTargets].sort((a, b) => targetPriority(state, me, b, needs) - targetPriority(state, me, a, needs))[0];
    return claimAction(state, me, best, needs);
  }

  if (needs.targets.length === 0) {
    // 계획을 다 이었으면(또는 못 이루면) 새 계획을 뽑거나 점수를 번다
    if (p.trains >= 12 && fewestTrains(state) >= 9 && state.planDeck.length > 0) return { type: 'drawPlans' };
    const free = bestFreeClaim(state, me, afford);
    if (free !== null && (ROUTES[free].length >= 3 || p.trains <= 6 || handTotal(p.hand) >= 10 || !canTakeAny(state))) return claimAction(state, me, free, needs);
  } else if (handTotal(p.hand) >= 18 && afford.length > 0) {
    // 표가 너무 많이 쌓이면 점수라도 번다
    const free = bestFreeClaim(state, me, afford);
    if (free !== null) return claimAction(state, me, free, needs);
  }

  if (canTakeAny(state)) return chooseTakeNormal(state, me, needs, rng);
  if (afford.length > 0) return claimAction(state, me, bestFreeClaim(state, me, afford)!, needs);
  if (state.planDeck.length > 0) return { type: 'drawPlans' };
  return { type: 'pass' };
}

/** 컴퓨터가 지금 할 행동 (계획 고르기 포함). 남의 손패와 더미 순서는 보지 않는다. */
export function decideAction(state: RailsState, level: AiLevel, rng: Rng = Math.random): RailsAction {
  if (state.phase === 'plans' && state.offer) return { type: 'keepPlans', keep: choosePlans(state, state.offer, level, rng) };
  const me = state.current;
  return level === 'ai-easy' ? easyTurn(state, me, rng) : normalTurn(state, me, rng);
}

/**
 * 컴퓨터가 한 번 움직인 새 상태. 고른 행동이 혹시 안 되면 할 수 있는 다른 행동으로 넘어가서
 * 컴퓨터끼리 할 때 멈추지 않게 한다.
 */
export function aiStep(state: RailsState, level: AiLevel, rng: Rng = Math.random): RailsState {
  const next = applyAction(state, decideAction(state, level, rng));
  if (next !== state) return next;
  const fallbacks: RailsAction[] = [];
  if (state.phase === 'plans' && state.offer) fallbacks.push({ type: 'keepPlans', keep: state.offer.plans });
  fallbacks.push({ type: 'take', from: 'deck' });
  state.window.forEach((c, i) => c && fallbacks.push({ type: 'take', from: 'window', index: i }));
  const afford = state.phase === 'play' ? affordableRoutes(state, state.current) : [];
  if (afford.length > 0) fallbacks.push(claimAction(state, state.current, afford[0], null));
  fallbacks.push({ type: 'drawPlans' }, { type: 'pass' });
  for (const a of fallbacks) {
    const s = applyAction(state, a);
    if (s !== state) return s;
  }
  return state;
}
