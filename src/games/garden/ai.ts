import { pick, type Rng } from '../../lib/random';
import { CARDS, GOALS, RES, TOKENS, card, goalMet } from './cards';
import {
  GREENHOUSE_SIZE,
  LINES,
  STORAGE_LIMIT,
  canPlant,
  gardenCards,
  isOnSale,
  legalActions,
  lineTokens,
  payment,
  production,
  scoreOf,
  shortfall,
  tokenTotal,
} from './rules';
import type { GardenAction, GardenState, LineId, PlantCard, Player, Res, Token, TokenCount } from './types';

export type AiLevel = 'ai-easy' | 'ai-normal';
/**
 * 보통 컴퓨터의 저울 (시드 고정 대국으로 맞춘 값).
 * eng: 생산의 값어치, buyFrac·buyAbs: 지금 살지 정하는 기준, spend·beePen: 토큰·꿀벌을 쓰는 아쉬움,
 * turnDiv: 한 번 거두면 모자란 자원이 몇 개쯤 메워지는지, rib: 상장 쫓기, h0~h2: 목표 1~3순위에 맞춘 거두기
 */
const W = { eng: 2.2, buyFrac: 0.6, buyAbs: 1.8, spend: 0.35, beePen: 0.8, turnDiv: 2.4, rib: 0.75, h0: 3, h1: 1.2, h2: 0.6, deny2: 0.6, denyN: 0.2 } as const;

/** 컴퓨터가 할 행동을 정한다 (바구니가 넘친 단계면 돌려놓을 토큰) */
export function decideAction(state: GardenState, level: AiLevel, rng: Rng = Math.random): GardenAction {
  if (state.phase === 'discard') return { type: 'discard', tokens: level === 'ai-easy' ? easyDiscard(state, rng) : smartDiscard(state) };
  return level === 'ai-easy' ? easyAction(state, rng) : normalAction(state, rng);
}

// ------------------------------------------------------------------ 쉬움

function easyAction(state: GardenState, rng: Rng): GardenAction {
  const legal = legalActions(state);
  const plants = legal.filter((a) => a.type === 'plant');
  if (plants.length > 0) return pick(plants, rng)!;
  const harvests = legal.filter((a) => a.type === 'harvest');
  if (harvests.length > 0) return pick(harvests, rng)!;
  return pick(legal, rng)!;
}

function easyDiscard(state: GardenState, rng: Rng): Partial<TokenCount> {
  const p = state.players[state.current];
  let need = tokenTotal(p.tokens) - STORAGE_LIMIT;
  const left = { ...p.tokens };
  const back: Partial<TokenCount> = {};
  while (need > 0) {
    const kinds = RES.filter((r) => left[r] > 0);
    const t: Token = kinds.length > 0 ? pick(kinds, rng)! : 'bee';
    left[t] -= 1;
    back[t] = (back[t] ?? 0) + 1;
    need -= 1;
  }
  return back;
}

// ------------------------------------------------------------------ 보통

/** 게임이 얼마나 남았는지에 따라 생산(엔진)의 값어치: 처음엔 크고 끝에 가까울수록 작다 */
function engineWeight(state: GardenState): number {
  const lead = Math.max(...state.players.map((_, i) => scoreOf(state, i)));
  const left = Math.max(0, state.options.target - lead) / state.options.target;
  return 0.15 + W.eng * left;
}

/** 지금 보이는 식물들 (시장 + 모든 온실) */
function visibleCards(state: GardenState): PlantCard[] {
  return [...state.market, ...state.players.flatMap((p) => p.greenhouse)].map(card);
}

/** 이 자원을 하나 더 만들면 앞으로 얼마나 쓸모 있을지 (0.4~1.2) */
function resDemand(state: GardenState, me: Player, r: Res): number {
  const prod = production(me);
  const cards = visibleCards(state);
  const upcoming = state.deck.slice(0, 4).map(card);
  const all = [...cards, ...upcoming];
  if (all.length === 0) return 0.4;
  const want = all.filter((c) => c.cost[r] > prod[r]).length;
  return 0.4 + 0.8 * (want / all.length);
}

/** 상장을 향해 얼마나 다가가는지 */
function ribbonValue(state: GardenState, meIndex: number, c: PlantCard): number {
  if (state.ribbons.length === 0) return 0;
  const mine = gardenCards(state.players[meIndex]);
  let v = 0;
  for (const r of state.ribbons) {
    if (r.owner !== null) continue;
    const g = GOALS[r.goal];
    const before = g.progress(mine);
    const after = g.progress([...mine, c]);
    if (after.have <= before.have) continue;
    if (after.have >= after.need) {
      v += 3;
      continue;
    }
    // 남보다 늦으면 덜 쫓는다
    const myLeft = after.need - after.have;
    let rivalLeft = Infinity;
    state.players.forEach((p, i) => {
      if (i === meIndex) return;
      const pr = g.progress(gardenCards(p));
      rivalLeft = Math.min(rivalLeft, pr.need - pr.have);
    });
    const contest = rivalLeft < myLeft ? 0.35 : rivalLeft === myLeft ? 0.7 : 1;
    v += (3 * (after.have - before.have) * contest * W.rib) / after.need;
  }
  return v;
}

/** 식물 한 장이 나에게 얼마나 값진지 (점수 단위) */
export function cardValue(state: GardenState, meIndex: number, c: PlantCard): number {
  const me = state.players[meIndex];
  let pts = c.points;
  if (c.bonus === 'scarecrow') pts += gardenCards(me).filter((x) => x.kind === 'veggie').length + (c.kind === 'veggie' ? 1 : 0);
  const myScore = scoreOf(state, meIndex);
  const rib = ribbonValue(state, meIndex, c);
  // 마지막 라운드에는 지금 얻는 점수만 따진다
  if (state.endTriggered) return pts + (rib >= 3 ? Math.floor(rib / 3) * 3 : 0);
  let v = pts + rib + engineWeight(state) * resDemand(state, me, c.produce);
  if (c.bonus === 'water2') v += 0.6;
  if (c.bonus === 'bee' && state.hive > 0) v += 0.8;
  // 이 식물로 목표 점수에 닿으면 아주 좋다
  if (myScore + pts + Math.floor(rib / 3) * 3 >= state.options.target) v += 4;
  return v;
}

interface Target {
  card: PlantCard;
  value: number;
  short: number;
  turns: number;
  priority: number;
  inMarket: boolean;
}

function targets(state: GardenState, meIndex: number): Target[] {
  const me = state.players[meIndex];
  const n = state.players.length;
  // 이번 라운드가 끝나기 전에 내 차례가 다시 오는지 (아니면 시장 맨 끝 카드는 시든다)
  const lastInRound = (meIndex + 1) % n === state.first;
  const out: Target[] = [];
  for (const id of [...state.market, ...me.greenhouse]) {
    const c = card(id);
    const inMarket = state.market.includes(id);
    const sale = inMarket && isOnSale(state, id);
    const sf = shortfall(me, c, sale);
    const turns = Math.ceil(sf.short / W.turnDiv);
    const value = cardValue(state, meIndex, c);
    let priority = value / (1 + turns);
    if (inMarket && turns > 0) {
      const idx = state.market.indexOf(id);
      if (idx === state.market.length - 1 && lastInRound) priority *= 0.3;
      else if (idx === state.market.length - 1) priority *= 0.75;
      // 남들도 노린다: 이미 살 수 있는 상대가 있으면 사라질 수 있다
      if (state.players.some((_, i) => i !== meIndex && canAfford(state, i, id))) priority *= 0.6;
    }
    out.push({ card: c, value, short: sf.short, turns, priority, inMarket });
  }
  return out.sort((a, b) => b.priority - a.priority);
}

function canAfford(state: GardenState, index: number, cardId: number): boolean {
  const p = state.players[index];
  return payment(p, card(cardId), isOnSale(state, cardId)) !== null;
}

/** 줄을 거둔 뒤의 바구니로 목표들이 얼마나 가까워지는지 */
function harvestScore(state: GardenState, meIndex: number, line: LineId, goals: Target[]): number {
  const me = state.players[meIndex];
  const got = lineTokens(state, line);
  if (got.length === 0) return -Infinity;
  const tokens = { ...me.tokens };
  for (const t of got) tokens[t] += 1;
  const after = { ...me, tokens };
  let v = 0;
  goals.slice(0, 3).forEach((t, k) => {
    const w = k === 0 ? W.h0 : k === 1 ? W.h1 : W.h2;
    const sale = t.inMarket && isOnSale(state, t.card.id);
    const s2 = shortfall(after, t.card, sale).short;
    v += (t.short - s2) * w;
    if (k === 0 && s2 === 0 && t.short > 0) v += 1.5;
  });
  v += got.filter((t) => t === 'bee').length * 0.6;
  v += got.length * 0.15;
  const over = tokenTotal(tokens) - STORAGE_LIMIT;
  if (over > 0) v -= over * 0.35;
  return v;
}

function normalAction(state: GardenState, rng: Rng): GardenAction {
  const meIndex = state.current;
  const me = state.players[meIndex];
  const legal = legalActions(state);
  if (legal.length === 1 && legal[0].type === 'pass') return legal[0];
  const goals = targets(state, meIndex);
  const best = goals[0];

  const last = state.endTriggered;
  const n = state.players.length;
  const canReserve = me.greenhouse.length < GREENHOUSE_SIZE && state.market.length > 0 && !last;

  // 1) 살 수 있는 식물 중 가장 값진 것 (마지막 라운드엔 남는 토큰이 쓸모없으니 점수만 본다)
  let buy: { id: number; v: number } | null = null;
  for (const a of legal) {
    if (a.type !== 'plant') continue;
    const c = card(a.cardId);
    const sale = state.market.includes(c.id) && isOnSale(state, c.id);
    const pay = payment(me, c, sale)!;
    let v = cardValue(state, meIndex, c);
    if (!last) v -= pay.paid.bee * W.beePen + tokenTotal(pay.paid) * W.spend;
    // 더 좋은 목표에 쓸 토큰을 써 버리면 조금 손해
    if (!last && best && best.card.id !== c.id && best.short > 0) {
      const left = { ...me.tokens };
      for (const t of TOKENS) left[t] -= pay.paid[t];
      const s2 = shortfall({ ...me, tokens: left, garden: [...me.garden, c.id] }, best.card, best.inMarket && isOnSale(state, best.card.id)).short;
      v -= Math.max(0, s2 - best.short) * 0.3;
    }
    if (!buy || v > buy.v) buy = { id: c.id, v };
  }

  // 2) 상대가 지금 살 수 있는 값진 식물을 나도 노리면 먼저 온실에 맡아 둔다
  if (canReserve) {
    let deny: { id: number; v: number } | null = null;
    for (const t of goals.slice(0, 4)) {
      if (!t.inMarket || t.value < 3) continue;
      let gain = 0;
      state.players.forEach((p, i) => {
        if (i === meIndex || !canAfford(state, i, t.card.id)) return;
        const after = gardenCards(p).concat(t.card);
        const ribbon = state.ribbons.filter((r) => r.owner === null && goalMet(r.goal, after)).length * 3;
        const finish = scoreOf(state, i) + t.card.points + ribbon >= state.options.target ? 3 : 0;
        gain = Math.max(gain, t.card.points + ribbon + finish);
      });
      if (gain < 3) continue;
      const v = gain * (n === 2 ? W.deny2 : W.denyN) + t.value * 0.3;
      if (!deny || v > deny.v) deny = { id: t.card.id, v };
    }
    if (deny && (!buy || deny.v > buy.v)) return { type: 'reserve', cardId: deny.id };
  }

  if (buy) {
    const planVal = best ? best.value / (1 + best.turns) : 0;
    if (last || buy.v >= planVal * W.buyFrac || buy.v >= W.buyAbs) return { type: 'plant', cardId: buy.id };
  }

  // 3) 온실에 맡기고 꿀벌 받기: 꿀벌 하나면 살 수 있는데 그 자원이 텃밭에 없을 때, 또는 곧 시들 값진 식물
  if (canReserve && best && best.inMarket) {
    const lastInRound = (meIndex + 1) % n === state.first;
    const idx = state.market.indexOf(best.card.id);
    const wilting = idx === state.market.length - 1 && lastInRound;
    const lineHelps = LINES.some((l) => harvestScore(state, meIndex, l, [best]) >= 3);
    if (best.short === 1 && state.hive > 0 && !lineHelps) return { type: 'reserve', cardId: best.card.id };
    if (wilting && best.value >= 3 && best.short > 0) return { type: 'reserve', cardId: best.card.id };
  }

  // 4) 목표에 가장 도움 되는 줄 거두기
  let bestLine: LineId | null = null;
  let bestScore = -Infinity;
  for (const line of LINES) {
    const v = harvestScore(state, meIndex, line, goals) + rng() * 0.05;
    if (v > bestScore) {
      bestScore = v;
      bestLine = line;
    }
  }
  if (bestLine) return { type: 'harvest', line: bestLine };
  if (buy) return { type: 'plant', cardId: buy.id };
  const res = legal.find((a) => a.type === 'reserve');
  return res ?? legal[0];
}

/** 넘친 토큰: 목표에 필요 없는 것부터 돌려놓고, 꿀벌은 끝까지 지킨다 */
function smartDiscard(state: GardenState): Partial<TokenCount> {
  const meIndex = state.current;
  const me = state.players[meIndex];
  let need = tokenTotal(me.tokens) - STORAGE_LIMIT;
  const goals = targets(state, meIndex).slice(0, 3);
  const prod = production(me);
  const want: Record<Res, number> = { water: 0, sun: 0, seed: 0, compost: 0 };
  goals.forEach((t, k) => {
    for (const r of RES) want[r] = Math.max(want[r], Math.max(0, t.card.cost[r] - prod[r]) * (k === 0 ? 1 : 0.8));
  });
  const left = { ...me.tokens };
  const back: Partial<TokenCount> = {};
  while (need > 0) {
    let pickT: Token | null = null;
    let key = -Infinity;
    for (const r of RES) {
      if (left[r] === 0) continue;
      const surplus = left[r] - want[r];
      const k = surplus * 10 + left[r];
      if (k > key) {
        key = k;
        pickT = r;
      }
    }
    const t: Token = pickT ?? 'bee';
    left[t] -= 1;
    back[t] = (back[t] ?? 0) + 1;
    need -= 1;
  }
  return back;
}

/** 테스트·도움말용: 이 사람이 지금 살 수 있는 식물 */
export function affordableCards(state: GardenState, index: number): number[] {
  return CARDS.filter((c) => canPlant(state, index, c.id)).map((c) => c.id);
}
