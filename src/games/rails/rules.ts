import { withJosa } from '../../lib/korean';
import { randomInt, seededRandom, shuffle } from '../../lib/random';
import { SEAT_COLORS } from '../common/players';
import {
  CARDS_PER_COLOR,
  CARD_KINDS,
  CITY,
  COLOR_INFO,
  PLAN,
  PLANS,
  ROUTES,
  ROUTE_POINTS,
  STAMPS,
  STAMP_AT,
  STAMP_FIRST_POINTS,
  STAMP_LATER_POINTS,
  TICKET_COLORS,
  WILD_CARDS,
  routeName,
} from './map';
import type {
  CardKind,
  FinalScore,
  GameEvent,
  Hand,
  Player,
  RailsAction,
  RailsOptions,
  RailsSetup,
  RailsState,
  RouteDef,
  Rng,
  SeatIndex,
  TicketColor,
} from './types';

export const DEFAULT_OPTIONS: RailsOptions = {
  handView: 'cover',
  planStart: 'basic',
  stamps: true,
  trains: 30,
};

/** 처음에 받는 표 */
export const START_CARDS = 4;
/** 창구에 펼쳐 두는 표 */
export const WINDOW_SIZE = 5;
/** 한 차례에 받는 표 */
export const TAKE_PER_TURN = 2;
/** 여행 계획을 뽑을 때 보는 장수 */
export const PLAN_DRAW = 3;
/** 기차가 이만큼 이하로 남으면 마지막 바퀴 */
export const FINAL_TRAINS = 2;
/** 전국 일주 상 */
export const TOUR_BONUS = 8;

const MAX_LOG = 80;

type EventInput = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'id'> : never) : never;

export function playerName(player: Player): string {
  return player.name || SEAT_COLORS[player.seat].name;
}

export function emptyHand(): Hand {
  return { red: 0, orange: 0, yellow: 0, green: 0, blue: 0, purple: 0, wild: 0 };
}

export function handTotal(hand: Hand): number {
  return CARD_KINDS.reduce((sum, k) => sum + hand[k], 0);
}

export function cardName(kind: CardKind): string {
  return kind === 'wild' ? '만능 고속열차표' : `${COLOR_INFO[kind].name}표`;
}

/** 지금 무언가를 정해야 하는 사람. 끝났으면 -1 */
export function actor(state: RailsState): number {
  if (state.phase === 'plans') return state.offer?.player ?? -1;
  if (state.phase === 'play') return state.current;
  return -1;
}

function nameOf(s: RailsState, i: number): string {
  return playerName(s.players[i]);
}

function addLog(s: RailsState, seat: SeatIndex | null, text: string): void {
  s.log = [...s.log, { id: s.nextLogId, seat, text }].slice(-MAX_LOG);
  s.nextLogId += 1;
}

function emit(s: RailsState, event: EventInput): void {
  s.events.push({ ...event, id: s.nextEventId } as GameEvent);
  s.nextEventId += 1;
}

function draft(state: RailsState): RailsState {
  const s = structuredClone(state);
  s.events = [];
  return s;
}

function buildDeck(): CardKind[] {
  const deck: CardKind[] = [];
  for (const c of TICKET_COLORS) for (let k = 0; k < CARDS_PER_COLOR; k++) deck.push(c);
  for (let k = 0; k < WILD_CARDS; k++) deck.push('wild');
  return deck;
}

// ------------------------------------------------------------------ 표 더미

/** 버린 표를 섞어서 더미에 넣는다 (상태 안의 씨앗으로 섞어서 같은 상태면 같은 결과) */
function mergeDiscard(s: RailsState): void {
  if (s.discard.length === 0) return;
  const rng = seededRandom(s.seed);
  const count = s.discard.length;
  s.deck = shuffle([...s.deck, ...s.discard], rng);
  s.discard = [];
  s.seed = Math.floor(rng() * 0x100000000) >>> 0;
  emit(s, { type: 'reshuffle', count });
}

/** 더미 맨 위에서 한 장 (비었으면 버린 표를 섞어서) */
function drawTop(s: RailsState): CardKind | null {
  if (s.deck.length === 0) mergeDiscard(s);
  return s.deck.shift() ?? null;
}

/**
 * 창구 빈칸을 채운다. 만능표는 창구에 놓지 않고 더미 맨 아래로 보낸다.
 * 색 표가 하나도 없으면 빈칸으로 둔다.
 */
function refillSlot(s: RailsState, i: number): TicketColor | null {
  for (let attempt = 0; attempt < 2; attempt++) {
    const k = s.deck.findIndex((c) => c !== 'wild');
    if (k >= 0) {
      const skipped = s.deck.splice(0, k);
      const card = s.deck.shift() as TicketColor;
      s.deck.push(...skipped);
      s.window[i] = card;
      return card;
    }
    if (!s.discard.some((c) => c !== 'wild')) break;
    mergeDiscard(s);
  }
  s.window[i] = null;
  return null;
}

function refillWindow(s: RailsState, announce: boolean): void {
  for (let i = 0; i < WINDOW_SIZE; i++) {
    if (s.window[i] !== null) continue;
    const card = refillSlot(s, i);
    if (announce && card) emit(s, { type: 'refill', index: i, card });
  }
}

/** 창구나 더미에서 표를 받을 수 있는지 */
export function canTakeAny(state: RailsState): boolean {
  return state.window.some((c) => c !== null) || state.deck.length + state.discard.length > 0;
}

export function canTakeDeck(state: RailsState): boolean {
  return state.deck.length + state.discard.length > 0;
}

// ------------------------------------------------------------------ 기찻길 값 치르기

export interface Payment {
  /** 색 표 (모두 만능표로 치르면 null) */
  color: TicketColor | null;
  wilds: number;
}

/** 이 길을 깔 수 있는 방법들 (만능표를 적게 쓰는 것부터) */
export function paymentOptions(hand: Hand, route: RouteDef): Payment[] {
  const len = route.length;
  const out: Payment[] = [];
  const colors = route.color === 'gray' ? TICKET_COLORS : [route.color];
  for (const c of colors) {
    const have = hand[c];
    if (have <= 0) continue;
    const wilds = Math.max(0, len - have);
    if (wilds <= hand.wild) out.push({ color: c, wilds });
  }
  if (hand.wild >= len) out.push({ color: null, wilds: len });
  return out.sort((a, b) => a.wilds - b.wilds || (b.color ? hand[b.color] : 0) - (a.color ? hand[a.color] : 0));
}

/** 치르는 표 목록 */
export function paymentCards(route: RouteDef, pay: Payment): CardKind[] {
  const colored = route.length - pay.wilds;
  const out: CardKind[] = [];
  for (let k = 0; k < colored; k++) out.push(pay.color!);
  for (let k = 0; k < pay.wilds; k++) out.push('wild');
  return out;
}

function validPayment(hand: Hand, route: RouteDef, color: TicketColor | null, wilds: number): boolean {
  const len = route.length;
  if (!Number.isInteger(wilds) || wilds < 0 || wilds > len || hand.wild < wilds) return false;
  const colored = len - wilds;
  if (colored === 0) return true;
  if (!color || !TICKET_COLORS.includes(color)) return false;
  if (route.color !== 'gray' && route.color !== color) return false;
  return hand[color] >= colored;
}

/** 이 길을 지금 깔 수 없는 까닭 (깔 수 있으면 null) */
export function claimProblem(state: RailsState, player: number, routeId: number): string | null {
  const r = ROUTES[routeId];
  if (!r) return '없는 길이에요.';
  const owner = state.owners[routeId];
  if (owner !== null) return owner === player ? '이미 내가 깐 길이에요.' : `이미 ${withJosa(nameOf(state, owner), '이/가')} 깐 길이에요.`;
  const p = state.players[player];
  if (p.trains < r.length) return `기차가 ${r.length}칸 필요한데 ${p.trains}칸 남았어요.`;
  if (paymentOptions(p.hand, r).length > 0) return null;
  if (r.color === 'gray') {
    const best = Math.max(...TICKET_COLORS.map((c) => p.hand[c]));
    const short = r.length - best - p.hand.wild;
    return `같은 색 표 ${r.length}장이 필요해요. (${short}장 모자라요)`;
  }
  const short = r.length - p.hand[r.color] - p.hand.wild;
  return `${COLOR_INFO[r.color].name}표가 ${short}장 모자라요.`;
}

/** 지금 깔 수 있는 길들 */
export function affordableRoutes(state: RailsState, player: number): number[] {
  const p = state.players[player];
  return ROUTES.filter((r) => state.owners[r.id] === null && p.trains >= r.length && paymentOptions(p.hand, r).length > 0).map((r) => r.id);
}

// ------------------------------------------------------------------ 기찻길 묶음

/** 도시마다 같은 묶음의 대표 도시 */
export function networkRoots(routeIds: readonly number[]): Map<string, string> {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let y = x;
    while (parent.get(y) !== r) {
      const next = parent.get(y)!;
      parent.set(y, r);
      y = next;
    }
    return r;
  };
  for (const id of routeIds) {
    const r = ROUTES[id];
    if (!parent.has(r.a)) parent.set(r.a, r.a);
    if (!parent.has(r.b)) parent.set(r.b, r.b);
    const ra = find(r.a);
    const rb = find(r.b);
    if (ra !== rb) parent.set(ra, rb);
  }
  const out = new Map<string, string>();
  for (const c of parent.keys()) out.set(c, find(c));
  return out;
}

export function isConnected(routeIds: readonly number[], a: string, b: string): boolean {
  if (a === b) return true;
  const roots = networkRoots(routeIds);
  const ra = roots.get(a);
  return ra !== undefined && ra === roots.get(b);
}

/** 가장 큰 기찻길 묶음에 닿은 도시 수와 그 도시들 */
export function largestNetwork(routeIds: readonly number[]): { size: number; cities: string[] } {
  const roots = networkRoots(routeIds);
  const groups = new Map<string, string[]>();
  for (const [city, root] of roots) groups.set(root, [...(groups.get(root) ?? []), city]);
  let best: string[] = [];
  for (const g of groups.values()) if (g.length > best.length) best = g;
  return { size: best.length, cities: best };
}

/** 이미 이은 여행 계획 */
export function completedPlans(state: RailsState, player: number): number[] {
  const p = state.players[player];
  const roots = networkRoots(p.routes);
  return p.plans.filter((id) => {
    const plan = PLAN[id];
    const ra = roots.get(plan.a);
    return ra !== undefined && ra === roots.get(plan.b);
  });
}

// ------------------------------------------------------------------ 시작

function makeOffer(s: RailsState, player: number, initial: boolean): void {
  const kids = s.options.planStart === 'kids';
  const count = initial && kids ? 2 : PLAN_DRAW;
  const plans = s.planDeck.splice(0, count);
  const minKeep = Math.min(plans.length, initial ? (kids ? 1 : 2) : 1);
  s.offer = { player, plans, minKeep, initial };
  s.phase = 'plans';
  emit(s, { type: 'planOffer', player, count: plans.length });
}

export function createGame(setup: RailsSetup, rng: Rng = Math.random): RailsState {
  const options: RailsOptions = { ...DEFAULT_OPTIONS, ...setup.options };
  const players: Player[] = [];
  setup.seats.forEach((seat, i) => {
    if (seat.kind === 'empty') return;
    players.push({
      seat: i as SeatIndex,
      kind: seat.kind,
      name: seat.name.trim() || SEAT_COLORS[i as SeatIndex].name,
      hand: emptyHand(),
      plans: [],
      trains: options.trains,
      routes: [],
      routePoints: 0,
      stamps: [],
      stampPoints: 0,
    });
  });
  if (players.length < 2) throw new Error('플레이어가 2명 이상 필요합니다.');
  const n = players.length;
  const first = randomInt(n, rng);
  const deck = shuffle(buildDeck(), rng);
  const planDeck = shuffle(
    PLANS.map((p) => p.id),
    rng,
  );
  const s: RailsState = {
    players,
    options,
    phase: 'plans',
    first,
    current: first,
    deck,
    discard: [],
    window: Array<TicketColor | null>(WINDOW_SIZE).fill(null),
    planDeck,
    offer: null,
    setupLeft: n,
    drawn: 0,
    owners: ROUTES.map(() => null),
    stampFirst: Object.fromEntries(STAMPS.map((st) => [st.city, null])),
    finalTurns: null,
    finalBy: null,
    passes: 0,
    seed: Math.floor(rng() * 0x100000000) >>> 0,
    turn: 1,
    turnsPlayed: 0,
    results: null,
    winners: [],
    events: [],
    nextEventId: 1,
    log: [],
    nextLogId: 1,
  };
  for (let k = 0; k < START_CARDS * n; k++) {
    const card = s.deck.shift()!;
    s.players[(first + k) % n].hand[card] += 1;
  }
  refillWindow(s, false);
  emit(s, { type: 'deal' });
  addLog(s, null, `기차표를 ${START_CARDS}장씩 나눠 줬어요. 기차는 한 사람에 ${options.trains}칸!`);
  makeOffer(s, first, true);
  addLog(s, null, '먼저 여행 계획을 골라요.');
  return s;
}

// ------------------------------------------------------------------ 차례 끝

/** 아무나 아직 깔 수 있는 길이 남았는지 (기차 수만 본다) */
export function anyRouteOpen(state: RailsState): boolean {
  const most = Math.max(...state.players.map((p) => p.trains));
  return ROUTES.some((r) => state.owners[r.id] === null && r.length <= most);
}

/** 순위: 점수, 같으면 이룬 계획이 많은 사람 */
export function rankings(state: RailsState): number[] {
  const res = state.results;
  const order = state.players.map((_, i) => i);
  if (!res) return order.sort((a, b) => publicScore(state.players[b]) - publicScore(state.players[a]) || a - b);
  return order.sort((a, b) => res[b].total - res[a].total || res[b].plansDone.length - res[a].plansDone.length || a - b);
}

/** 게임 중에 모두에게 보이는 점수 (기찻길 + 도장) */
export function publicScore(p: Player): number {
  return p.routePoints + p.stampPoints;
}

export function computeFinalScores(state: RailsState): FinalScore[] {
  const scores = state.players.map((p, i): FinalScore => {
    const roots = networkRoots(p.routes);
    const plansDone: number[] = [];
    const plansFailed: number[] = [];
    for (const id of p.plans) {
      const plan = PLAN[id];
      const ra = roots.get(plan.a);
      if (ra !== undefined && ra === roots.get(plan.b)) plansDone.push(id);
      else plansFailed.push(id);
    }
    const planPoints = plansDone.reduce((sum, id) => sum + PLAN[id].points, 0) - plansFailed.reduce((sum, id) => sum + PLAN[id].points, 0);
    return {
      player: i,
      routes: p.routePoints,
      plansDone,
      plansFailed,
      planPoints,
      stamps: p.stampPoints,
      tourCities: largestNetwork(p.routes).size,
      tour: 0,
      total: 0,
    };
  });
  const most = Math.max(...scores.map((sc) => sc.tourCities));
  for (const sc of scores) {
    sc.tour = most > 0 && sc.tourCities === most ? TOUR_BONUS : 0;
    sc.total = sc.routes + sc.planPoints + sc.stamps + sc.tour;
  }
  return scores;
}

function finish(s: RailsState, reason: 'trains' | 'stuck'): void {
  s.phase = 'gameover';
  s.offer = null;
  s.finalTurns = null;
  s.results = computeFinalScores(s);
  const order = rankings(s);
  const top = s.results[order[0]];
  s.winners = order.filter((i) => s.results![i].total === top.total && s.results![i].plansDone.length === top.plansDone.length);
  s.turn += 1;
  emit(s, { type: 'gameover', reason });
  addLog(s, null, reason === 'stuck' ? '더 깔 수 있는 기찻길이 없어서 여행이 끝났어요.' : '모두 마지막 차례를 마쳤어요. 점수를 세요!');
  const names = s.winners.map((i) => nameOf(s, i)).join(', ');
  addLog(s, s.winners.length === 1 ? s.players[s.winners[0]].seat : null, `🏆 ${names} 우승! (${top.total}점)`);
}

function endTurn(s: RailsState, passed: boolean): void {
  const me = s.current;
  const n = s.players.length;
  s.drawn = 0;
  s.turnsPlayed += 1;
  s.passes = passed ? s.passes + 1 : 0;
  refillWindow(s, true);
  if (s.finalTurns !== null) {
    s.finalTurns -= 1;
    if (s.finalTurns <= 0) {
      finish(s, 'trains');
      return;
    }
  } else if (s.players[me].trains <= FINAL_TRAINS) {
    s.finalTurns = n;
    s.finalBy = me;
    emit(s, { type: 'finalRound', player: me });
    addLog(s, s.players[me].seat, `🔔 ${withJosa(nameOf(s, me), '이/가')} 기차를 거의 다 썼어요! 모두 한 번씩만 더 해요.`);
  }
  if (!anyRouteOpen(s) || s.passes >= n) {
    finish(s, 'stuck');
    return;
  }
  s.current = (me + 1) % n;
  s.turn += 1;
}

// ------------------------------------------------------------------ 행동

function keepPlans(state: RailsState, keep: number[]): RailsState {
  const offer = state.offer;
  if (state.phase !== 'plans' || !offer || !Array.isArray(keep)) return state;
  if (new Set(keep).size !== keep.length || !keep.every((id) => offer.plans.includes(id))) return state;
  if (keep.length < offer.minKeep) return state;
  const s = draft(state);
  const me = offer.player;
  const p = s.players[me];
  const returned = offer.plans.filter((id) => !keep.includes(id));
  p.plans.push(...keep);
  s.planDeck.push(...returned);
  s.offer = null;
  emit(s, { type: 'planKeep', player: me, kept: keep.length, returned: returned.length, initial: offer.initial });
  addLog(s, p.seat, `${nameOf(s, me)}: 🗺️ 여행 계획 ${keep.length}장을 가졌어요${returned.length > 0 ? ` (${returned.length}장은 돌려놓음)` : ''}.`);
  if (offer.initial) {
    s.setupLeft -= 1;
    if (s.setupLeft > 0) {
      const next = (me + 1) % s.players.length;
      makeOffer(s, next, true);
    } else {
      s.phase = 'play';
      s.current = s.first;
      addLog(s, s.players[s.first].seat, `🚂 출발! ${withJosa(nameOf(s, s.first), '이/가')} 먼저 해요.`);
    }
    s.turn += 1;
    return s;
  }
  s.phase = 'play';
  endTurn(s, false);
  return s;
}

function take(state: RailsState, action: Extract<RailsAction, { type: 'take' }>): RailsState {
  if (state.phase !== 'play' || state.drawn >= TAKE_PER_TURN) return state;
  if (action.from === 'window') {
    const idx = action.index;
    if (!Number.isInteger(idx) || idx < 0 || idx >= WINDOW_SIZE || state.window[idx] === null) return state;
  } else if (!canTakeDeck(state)) return state;

  const s = draft(state);
  const me = s.current;
  const p = s.players[me];
  let card: CardKind;
  let index = -1;
  if (action.from === 'window') {
    index = action.index;
    card = s.window[index]!;
    s.window[index] = null;
  } else {
    card = drawTop(s)!;
  }
  p.hand[card] += 1;
  emit(s, { type: 'take', player: me, from: action.from, index, card });
  if (action.from === 'window') {
    const refill = refillSlot(s, index);
    emit(s, { type: 'refill', index, card: refill });
  }
  const what = action.from === 'window' ? `창구 ${cardName(card)}` : '더미 1장';
  if (s.drawn === 0) addLog(s, p.seat, `${nameOf(s, me)}: 🎫 ${what}`);
  else {
    const last = s.log[s.log.length - 1];
    if (last && last.seat === p.seat && last.text.startsWith(`${nameOf(s, me)}: 🎫`)) last.text += ` + ${what}`;
    else addLog(s, p.seat, `${nameOf(s, me)}: 🎫 ${what}`);
  }
  s.drawn += 1;
  if (s.drawn >= TAKE_PER_TURN || !canTakeAny(s)) endTurn(s, false);
  return s;
}

function claim(state: RailsState, action: Extract<RailsAction, { type: 'claim' }>): RailsState {
  if (state.phase !== 'play' || state.drawn !== 0) return state;
  const route = ROUTES[action.route];
  if (!route || state.owners[route.id] !== null) return state;
  const me = state.current;
  const before = state.players[me];
  if (before.trains < route.length || !validPayment(before.hand, route, action.color, action.wilds)) return state;

  const s = draft(state);
  const p = s.players[me];
  const donePlansBefore = new Set(completedPlans(s, me));
  const pay: Payment = { color: route.length - action.wilds > 0 ? action.color : null, wilds: action.wilds };
  const paid = paymentCards(route, pay);
  for (const c of paid) p.hand[c] -= 1;
  s.discard.push(...paid);
  s.owners[route.id] = me;
  p.trains -= route.length;
  p.routes.push(route.id);
  const points = ROUTE_POINTS[route.length];
  p.routePoints += points;
  emit(s, { type: 'claim', player: me, route: route.id, points, paid });
  addLog(s, p.seat, `${nameOf(s, me)}: 🛤️ ${routeName(route)} ${route.length}칸 (+${points}점)`);

  if (s.options.stamps) {
    for (const city of [route.a, route.b]) {
      const stamp = STAMP_AT[city];
      if (!stamp || p.stamps.some((m) => m.city === city)) continue;
      const first = s.stampFirst[city] === null;
      const pts = first ? STAMP_FIRST_POINTS : STAMP_LATER_POINTS;
      if (first) s.stampFirst[city] = me;
      p.stamps.push({ city, first });
      p.stampPoints += pts;
      emit(s, { type: 'stamp', player: me, city, first, points: pts });
      addLog(s, p.seat, `${nameOf(s, me)}: 🏅 ${CITY[city].name} ${stamp.name} ${first ? '첫' : ''} 도장 (+${pts}점)`);
    }
  }
  for (const id of completedPlans(s, me)) if (!donePlansBefore.has(id)) emit(s, { type: 'planDone', player: me, plan: id });
  endTurn(s, false);
  return s;
}

function drawPlans(state: RailsState): RailsState {
  if (state.phase !== 'play' || state.drawn !== 0 || state.planDeck.length === 0) return state;
  const s = draft(state);
  const me = s.current;
  makeOffer(s, me, false);
  addLog(s, s.players[me].seat, `${nameOf(s, me)}: 🗺️ 여행 계획 ${s.offer!.plans.length}장을 뽑았어요.`);
  return s;
}

/** 아무것도 할 수 없어서 넘길 수 있는지 */
export function canPass(state: RailsState): boolean {
  if (state.phase !== 'play') return false;
  if (canTakeAny(state)) return false;
  if (state.drawn > 0) return false;
  if (state.planDeck.length > 0) return false;
  return affordableRoutes(state, state.current).length === 0;
}

function pass(state: RailsState): RailsState {
  if (!canPass(state)) return state;
  const s = draft(state);
  const me = s.current;
  emit(s, { type: 'pass', player: me });
  addLog(s, s.players[me].seat, `${nameOf(s, me)}: 할 수 있는 일이 없어서 넘겨요.`);
  endTurn(s, true);
  return s;
}

/**
 * 행동을 적용한 새 상태를 돌려준다. 할 수 없는 행동이면 원래 상태를 그대로 돌려준다.
 * (state는 바꾸지 않는다. 더미 섞기도 상태 안의 씨앗을 쓰므로 같은 상태·행동이면 결과가 같다)
 */
export function applyAction(state: RailsState, action: RailsAction): RailsState {
  switch (action.type) {
    case 'keepPlans':
      return keepPlans(state, action.keep);
    case 'take':
      return take(state, action);
    case 'claim':
      return claim(state, action);
    case 'drawPlans':
      return drawPlans(state);
    case 'pass':
      return pass(state);
  }
}

/** 표가 모두 제자리에 있는지 (불러오기 검사·테스트용) */
export function countCards(state: RailsState): Hand {
  const h = emptyHand();
  for (const c of state.deck) h[c] += 1;
  for (const c of state.discard) h[c] += 1;
  for (const c of state.window) if (c) h[c] += 1;
  for (const p of state.players) for (const k of CARD_KINDS) h[k] += p.hand[k];
  return h;
}

/** 여행 계획 카드가 모두 제자리에 있는지 */
export function allPlanIds(state: RailsState): number[] {
  return [...state.planDeck, ...(state.offer?.plans ?? []), ...state.players.flatMap((p) => p.plans)];
}
