import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import {
  CARDS_PER_COLOR,
  CITIES,
  CITY_ROUTES,
  DECK_TOTAL,
  PLANS,
  ROUTES,
  ROUTE_POINTS,
  STAMPS,
  TICKET_COLORS,
  WILD_CARDS,
  mapDistance,
} from './map';
import {
  DEFAULT_OPTIONS,
  TOUR_BONUS,
  actor,
  affordableRoutes,
  allPlanIds,
  applyAction,
  canPass,
  claimProblem,
  completedPlans,
  computeFinalScores,
  countCards,
  createGame,
  emptyHand,
  isConnected,
  largestNetwork,
  paymentOptions,
} from './rules';
import { isValidState } from './storage';
import type { CardKind, Hand, RailsOptions, RailsSetup, RailsState, SeatKind } from './types';

function setup(kinds: SeatKind[], options: Partial<RailsOptions> = {}): RailsSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: `P${i}` })) as RailsSetup['seats'],
    options: { ...DEFAULT_OPTIONS, ...options },
  };
}

/** 모두 계획을 고르고(앞에서부터 최소 장수) 0번이 먼저 할 차례인 게임 */
function ready(n = 2, options: Partial<RailsOptions> = {}, seed = 1): RailsState {
  let s = createGame(setup(Array(n).fill('human'), options), seededRandom(seed));
  while (s.phase === 'plans') s = applyAction(s, { type: 'keepPlans', keep: s.offer!.plans.slice(0, s.offer!.minKeep) });
  s.current = 0;
  s.first = 0;
  s.events = [];
  return s;
}

/** 손패를 바꾼다 (바꾼 만큼 더미에서 빼거나 넣어서 표 수를 맞춘다) */
function giveHand(s: RailsState, player: number, hand: Partial<Hand>): void {
  const p = s.players[player];
  for (const k of Object.keys(p.hand) as CardKind[]) {
    const want = hand[k] ?? 0;
    while (p.hand[k] < want) {
      const i = s.deck.indexOf(k);
      if (i < 0) throw new Error('더미에 표가 모자라요');
      s.deck.splice(i, 1);
      p.hand[k] += 1;
    }
    while (p.hand[k] > want) {
      p.hand[k] -= 1;
      s.deck.push(k);
    }
  }
}

const routeId = (a: string, b: string) => ROUTES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a))!.id;

describe('판 자료', () => {
  it('도시 26곳, 기찻길 47개: 길이 1~5, 겹치는 길 없음', () => {
    expect(CITIES).toHaveLength(26);
    expect(new Set(CITIES.map((c) => c.id)).size).toBe(26);
    expect(ROUTES).toHaveLength(47);
    const pairs = new Set<string>();
    ROUTES.forEach((r, i) => {
      expect(r.id).toBe(i);
      expect(r.length).toBeGreaterThanOrEqual(1);
      expect(r.length).toBeLessThanOrEqual(5);
      expect(r.a).not.toBe(r.b);
      expect(CITIES.some((c) => c.id === r.a) && CITIES.some((c) => c.id === r.b)).toBe(true);
      const key = [r.a, r.b].sort().join('-');
      expect(pairs.has(key)).toBe(false);
      pairs.add(key);
    });
  });

  it('모든 도시가 이어져 있고, 제주는 회색 배 노선(2~3칸)으로만 간다', () => {
    for (const c of CITIES) expect(mapDistance('seoul', c.id)).toBeLessThan(Infinity);
    const jeju = CITY_ROUTES.jeju.map((id) => ROUTES[id]);
    expect(jeju.length).toBeGreaterThanOrEqual(2);
    for (const r of jeju) {
      expect(r.sea).toBe(true);
      expect(r.color).toBe('gray');
      expect(r.length).toBeGreaterThanOrEqual(2);
      expect(r.length).toBeLessThanOrEqual(3);
    }
    expect(ROUTES.filter((r) => r.sea).every((r) => r.a === 'jeju' || r.b === 'jeju')).toBe(true);
  });

  it('여섯 색 길이 고르게 있고, 길 칸 수는 2~4명이 쓰기에 알맞다', () => {
    const total = ROUTES.reduce((sum, r) => sum + r.length, 0);
    expect(total).toBeGreaterThan(120);
    for (const c of TICKET_COLORS) {
      const len = ROUTES.filter((r) => r.color === c).reduce((sum, r) => sum + r.length, 0);
      expect(len).toBeGreaterThanOrEqual(17);
      expect(len).toBeLessThanOrEqual(24);
    }
  });

  it('여행 계획 30장: 4~20점, 점수는 가장 짧은 칸 수에 따라 정해진다', () => {
    expect(PLANS).toHaveLength(30);
    expect(new Set(PLANS.map((p) => p.id)).size).toBe(30);
    expect(new Set(PLANS.map((p) => [p.a, p.b].sort().join('-'))).size).toBe(30);
    for (const p of PLANS) {
      const d = mapDistance(p.a, p.b);
      const bonus = d >= 17 ? 3 : d >= 13 ? 2 : d >= 9 ? 1 : 0;
      expect(p.points).toBe(Math.min(20, Math.max(4, d + bonus)));
    }
    expect(Math.min(...PLANS.map((p) => p.points))).toBe(4);
    expect(Math.max(...PLANS.map((p) => p.points))).toBe(20);
  });

  it('관광 도장 8곳, 기찻길 점수표, 표 94장', () => {
    expect(STAMPS).toHaveLength(8);
    expect(new Set(STAMPS.map((s) => s.city)).size).toBe(8);
    expect(ROUTE_POINTS).toEqual({ 1: 1, 2: 3, 3: 5, 4: 7, 5: 10 });
    expect(DECK_TOTAL).toBe(CARDS_PER_COLOR * 6 + WILD_CARDS);
  });
});

describe('시작', () => {
  it('표 4장씩, 창구 5장(만능표 없음), 첫 사람부터 계획 3장 중 2장 이상', () => {
    for (const n of [2, 3, 4]) {
      const s = createGame(setup(Array(n).fill('ai-normal')), seededRandom(n));
      expect(s.players).toHaveLength(n);
      for (const p of s.players) {
        expect(Object.values(p.hand).reduce((a, b) => a + b, 0)).toBe(4);
        expect(p.trains).toBe(30);
      }
      expect(s.window.every((c) => c !== null && c !== ('wild' as string))).toBe(true);
      expect(s.phase).toBe('plans');
      expect(s.offer).toMatchObject({ player: s.first, minKeep: 2, initial: true });
      expect(s.offer!.plans).toHaveLength(3);
      const cards = countCards(s);
      expect(TICKET_COLORS.every((c) => cards[c] === CARDS_PER_COLOR)).toBe(true);
      expect(cards.wild).toBe(WILD_CARDS);
      expect(allPlanIds(s).sort((a, b) => a - b)).toEqual(PLANS.map((p) => p.id).sort((a, b) => a - b));
    }
  });

  it('어린이: 계획 2장만 보고 1장 이상, 긴 게임: 기차 40칸', () => {
    const s = createGame(setup(['human', 'human'], { planStart: 'kids', trains: 40 }), seededRandom(5));
    expect(s.offer!.plans).toHaveLength(2);
    expect(s.offer!.minKeep).toBe(1);
    expect(s.players.every((p) => p.trains === 40)).toBe(true);
  });

  it('빈 자리는 빼고, 2명 이상이어야 한다', () => {
    const s = createGame(setup(['empty', 'human', 'empty', 'ai-easy']), seededRandom(3));
    expect(s.players.map((p) => p.seat)).toEqual([1, 3]);
    expect(() => createGame(setup(['human']))).toThrow();
  });

  it('계획 고르기: 모자라거나 받지 않은 카드는 안 되고, 다 고르면 첫 사람부터 시작', () => {
    let s = createGame(setup(['human', 'human', 'human']), seededRandom(9));
    const first = s.first;
    const offer = s.offer!;
    expect(applyAction(s, { type: 'keepPlans', keep: [offer.plans[0]] })).toBe(s);
    expect(applyAction(s, { type: 'keepPlans', keep: [offer.plans[0], offer.plans[0]] })).toBe(s);
    const stranger = PLANS.find((p) => !offer.plans.includes(p.id))!.id;
    expect(applyAction(s, { type: 'keepPlans', keep: [offer.plans[0], stranger] })).toBe(s);
    s = applyAction(s, { type: 'keepPlans', keep: offer.plans.slice(0, 2) });
    expect(s.players[first].plans).toEqual(offer.plans.slice(0, 2));
    expect(s.planDeck.at(-1)).toBe(offer.plans[2]);
    expect(s.offer!.player).toBe((first + 1) % 3);
    while (s.phase === 'plans') s = applyAction(s, { type: 'keepPlans', keep: s.offer!.plans });
    expect(s.phase).toBe('play');
    expect(s.current).toBe(first);
    expect(s.players.every((p) => p.plans.length >= 2)).toBe(true);
  });
});

describe('표 받기', () => {
  it('창구에서 받으면 바로 다시 채우고, 두 장째에 차례가 끝난다', () => {
    let s = ready(2);
    const card = s.window[2]!;
    const before = s.players[0].hand[card];
    s = applyAction(s, { type: 'take', from: 'window', index: 2 });
    expect(s.players[0].hand[card]).toBe(before + 1);
    expect(s.window[2]).not.toBeNull();
    expect(s.drawn).toBe(1);
    expect(s.current).toBe(0);
    s = applyAction(s, { type: 'take', from: 'deck' });
    expect(s.drawn).toBe(0);
    expect(s.current).toBe(1);
    expect(Object.values(s.players[0].hand).reduce((a, b) => a + b, 0)).toBe(6);
  });

  it('만능표는 창구에 놓이지 않고 더미 아래로 간다', () => {
    const s = ready(2);
    // 더미 맨 위: 만능표 3장, 그다음 빨강표
    const top: CardKind[] = ['wild', 'wild', 'wild', 'red'];
    const rest = [...s.deck];
    for (const k of top) rest.splice(rest.indexOf(k), 1);
    s.deck = [...top, ...rest];
    const next = applyAction(s, { type: 'take', from: 'window', index: 0 });
    expect(next.window[0]).toBe('red');
    expect(next.window.every((c) => c !== ('wild' as string))).toBe(true);
    expect(next.deck.slice(-3)).toEqual(['wild', 'wild', 'wild']);
    expect(countCards(next).wild).toBe(WILD_CARDS);
  });

  it('더미에서 받은 표는 기록에 색을 남기지 않는다 (비밀)', () => {
    let s = ready(2);
    s = applyAction(s, { type: 'take', from: 'deck' });
    s = applyAction(s, { type: 'take', from: 'deck' });
    const text = s.log.at(-1)!.text;
    expect(text).toContain('더미 1장 + 더미 1장');
    for (const name of ['빨강표', '주황표', '노랑표', '초록표', '파랑표', '보라표', '만능']) expect(text).not.toContain(name);
  });

  it('더미가 비면 버린 표를 섞어서 쓴다 (같은 상태면 같은 결과)', () => {
    const s = ready(2);
    s.discard = [...s.deck];
    s.deck = [];
    const a = applyAction(s, { type: 'take', from: 'deck' });
    const b = applyAction(s, { type: 'take', from: 'deck' });
    expect(a.events.some((e) => e.type === 'reshuffle')).toBe(true);
    expect(a.discard).toHaveLength(0);
    expect(a.deck).toEqual(b.deck);
    expect(a.seed).not.toBe(s.seed);
  });

  it('빈 칸이나 없는 칸은 받을 수 없고, 표가 하나도 없으면 한 장만 받고 끝난다', () => {
    const s = ready(2);
    s.window[1] = null;
    s.deck.push(...[]);
    expect(applyAction(s, { type: 'take', from: 'window', index: 1 })).toBe(s);
    expect(applyAction(s, { type: 'take', from: 'window', index: 7 })).toBe(s);
    // 더미·버린 표를 모두 손패로 옮기고 창구 한 장만 남긴다
    const t = ready(2);
    for (const c of t.deck) t.players[1].hand[c] += 1;
    t.deck = [];
    for (let i = 1; i < 5; i++) {
      t.players[1].hand[t.window[i]!] += 1;
      t.window[i] = null;
    }
    const u = applyAction(t, { type: 'take', from: 'window', index: 0 });
    expect(u.current).toBe(1);
    expect(u.window.every((c) => c === null)).toBe(true);
    expect(countCards(u).wild).toBe(WILD_CARDS);
  });
});

describe('기찻길 깔기', () => {
  it('같은 색 표를 내고 칸 수에 따라 바로 점수를 받는다', () => {
    const s = ready(2, { stamps: false });
    const rid = routeId('seoul', 'wonju'); // 보라 4칸
    giveHand(s, 0, { purple: 4, red: 1 });
    const t = applyAction(s, { type: 'claim', route: rid, color: 'purple', wilds: 0 });
    expect(t.owners[rid]).toBe(0);
    expect(t.players[0].hand.purple).toBe(0);
    expect(t.players[0].hand.red).toBe(1);
    expect(t.players[0].trains).toBe(26);
    expect(t.players[0].routePoints).toBe(7);
    expect(t.discard.filter((c) => c === 'purple')).toHaveLength(4);
    expect(t.current).toBe(1);
  });

  it('만능표는 아무 색 대신, 회색 길은 아무 한 색으로 (섞어서는 안 됨)', () => {
    const s = ready(2, { stamps: false });
    const gray = routeId('cheonan', 'cheongju'); // 회색 2칸
    giveHand(s, 0, { red: 1, blue: 1, wild: 1 });
    expect(paymentOptions(s.players[0].hand, ROUTES[gray]).map((o) => [o.color, o.wilds])).toEqual([
      ['red', 1],
      ['blue', 1],
    ]);
    expect(applyAction(s, { type: 'claim', route: gray, color: 'red', wilds: 0 })).toBe(s);
    const t = applyAction(s, { type: 'claim', route: gray, color: 'blue', wilds: 1 });
    expect(t.owners[gray]).toBe(0);
    expect(t.players[0].hand).toEqual({ ...emptyHand(), red: 1 });
    // 만능표만으로도 된다
    const u = ready(2, { stamps: false });
    giveHand(u, 0, { wild: 2 });
    expect(applyAction(u, { type: 'claim', route: gray, color: null, wilds: 2 }).owners[gray]).toBe(0);
  });

  it('색이 다르거나, 표·기차가 모자라거나, 이미 깐 길이거나, 표를 받는 중이면 안 된다', () => {
    const s = ready(2);
    const rid = routeId('seoul', 'chuncheon'); // 파랑 3칸
    giveHand(s, 0, { blue: 2, red: 3, wild: 0 });
    expect(applyAction(s, { type: 'claim', route: rid, color: 'red', wilds: 0 })).toBe(s);
    expect(applyAction(s, { type: 'claim', route: rid, color: 'blue', wilds: 0 })).toBe(s);
    expect(claimProblem(s, 0, rid)).toBe('파랑표가 1장 모자라요.');
    giveHand(s, 0, { blue: 3 });
    s.players[0].trains = 2;
    expect(applyAction(s, { type: 'claim', route: rid, color: 'blue', wilds: 0 })).toBe(s);
    expect(claimProblem(s, 0, rid)).toContain('기차가 3칸 필요');
    s.players[0].trains = 30;
    s.owners[rid] = 1;
    s.players[1].routes.push(rid);
    expect(applyAction(s, { type: 'claim', route: rid, color: 'blue', wilds: 0 })).toBe(s);
    expect(claimProblem(s, 0, rid)).toContain('P1');
    const t = ready(2);
    giveHand(t, 0, { blue: 3 });
    const mid = applyAction(t, { type: 'take', from: 'deck' });
    expect(applyAction(mid, { type: 'claim', route: rid, color: 'blue', wilds: 0 })).toBe(mid);
  });

  it('지금 깔 수 있는 길 목록은 표와 기차를 모두 본다', () => {
    const s = ready(2);
    giveHand(s, 0, { red: 1 });
    const list = affordableRoutes(s, 0);
    expect(list.every((id) => ROUTES[id].length === 1 && (ROUTES[id].color === 'red' || ROUTES[id].color === 'gray'))).toBe(true);
    expect(list).toContain(routeId('incheon', 'seoul'));
    expect(list).toContain(routeId('gyeongju', 'ulsan'));
  });

  it('행동은 원래 상태를 바꾸지 않는다', () => {
    const s = ready(2);
    giveHand(s, 0, { blue: 3 });
    const copy = structuredClone(s);
    applyAction(s, { type: 'claim', route: routeId('seoul', 'chuncheon'), color: 'blue', wilds: 0 });
    applyAction(s, { type: 'take', from: 'window', index: 0 });
    expect(s).toEqual(copy);
  });
});

describe('관광 도장', () => {
  it('처음 닿은 사람은 +3, 나중에 온 사람은 +1, 같은 도장은 한 번만', () => {
    let s = ready(2);
    giveHand(s, 0, { red: 1, blue: 3 });
    giveHand(s, 1, { orange: 4 });
    s = applyAction(s, { type: 'claim', route: routeId('incheon', 'seoul'), color: 'red', wilds: 0 });
    expect(s.players[0].stampPoints).toBe(3);
    expect(s.stampFirst.seoul).toBe(0);
    expect(s.events.find((e) => e.type === 'stamp')).toMatchObject({ city: 'seoul', first: true, points: 3 });
    s = applyAction(s, { type: 'take', from: 'deck' });
    s = applyAction(s, { type: 'take', from: 'deck' });
    // 0번이 서울에 또 닿아도 도장은 한 번
    s = applyAction(s, { type: 'claim', route: routeId('seoul', 'chuncheon'), color: 'blue', wilds: 0 });
    expect(s.players[0].stampPoints).toBe(3);
    expect(s.players[0].stamps).toHaveLength(1);
    // 1번은 부산에 처음 → +3, 그다음 서울에 → +1
    giveHand(s, 1, { orange: 4, purple: 4 });
    s = applyAction(s, { type: 'claim', route: routeId('daegu', 'busan'), color: 'orange', wilds: 0 });
    expect(s.players[1].stampPoints).toBe(3);
    s = applyAction(s, { type: 'take', from: 'deck' });
    s = applyAction(s, { type: 'take', from: 'deck' });
    s = applyAction(s, { type: 'claim', route: routeId('seoul', 'wonju'), color: 'purple', wilds: 0 });
    expect(s.players[1].stampPoints).toBe(4);
    expect(s.players[1].stamps).toEqual([
      { city: 'busan', first: true },
      { city: 'seoul', first: false },
    ]);
  });

  it('도장을 끄면 점수가 없다', () => {
    let s = ready(2, { stamps: false });
    giveHand(s, 0, { red: 1 });
    s = applyAction(s, { type: 'claim', route: routeId('incheon', 'seoul'), color: 'red', wilds: 0 });
    expect(s.players[0].stampPoints).toBe(0);
    expect(s.stampFirst.seoul).toBeNull();
  });
});

describe('여행 계획과 점수', () => {
  it('내 기찻길로 이어졌는지, 가장 큰 묶음의 도시 수', () => {
    const routes = [routeId('incheon', 'seoul'), routeId('seoul', 'cheonan'), routeId('cheonan', 'daejeon'), routeId('pohang', 'gyeongju')];
    expect(isConnected(routes, 'incheon', 'daejeon')).toBe(true);
    expect(isConnected(routes, 'incheon', 'pohang')).toBe(false);
    expect(isConnected(routes, 'jeju', 'jeju')).toBe(true);
    expect(largestNetwork(routes).size).toBe(4);
    expect(largestNetwork([]).size).toBe(0);
  });

  it('계획을 이으면 그 순간 알리고, 끝 점수는 이룬 것 +, 못 이룬 것 −', () => {
    let s = ready(2, { stamps: false });
    s.players[0].plans = [0, 3]; // 서울–대전 6점, 대구–울산 4점
    s.players[0].routes = [routeId('seoul', 'cheonan')];
    s.owners[routeId('seoul', 'cheonan')] = 0;
    giveHand(s, 0, { blue: 3 });
    s = applyAction(s, { type: 'claim', route: routeId('cheonan', 'daejeon'), color: 'blue', wilds: 0 });
    expect(s.events.some((e) => e.type === 'planDone' && e.plan === 0)).toBe(true);
    expect(completedPlans(s, 0)).toEqual([0]);
    const res = computeFinalScores(s);
    expect(res[0].plansDone).toEqual([0]);
    expect(res[0].plansFailed).toEqual([3]);
    expect(res[0].planPoints).toBe(6 - 4);
  });

  it('전국 일주 상: 가장 많은 도시에 닿은 묶음, 같으면 모두 +8', () => {
    const s = ready(3, { stamps: false });
    const give = (p: number, ids: number[]) => {
      for (const id of ids) {
        s.owners[id] = p;
        s.players[p].routes.push(id);
      }
    };
    give(0, [routeId('incheon', 'seoul'), routeId('seoul', 'cheonan')]); // 3곳
    give(1, [routeId('pohang', 'gyeongju'), routeId('gyeongju', 'ulsan')]); // 3곳
    give(2, [routeId('gwangju', 'mokpo')]); // 2곳
    s.players.forEach((p) => (p.plans = []));
    const res = computeFinalScores(s);
    expect(res.map((r) => r.tourCities)).toEqual([3, 3, 2]);
    expect(res.map((r) => r.tour)).toEqual([TOUR_BONUS, TOUR_BONUS, 0]);
  });
});

describe('끝내기', () => {
  it('기차가 2칸 이하로 남으면 그 사람까지 모두 한 번씩 더 하고 끝난다', () => {
    let s = ready(3, { stamps: false });
    s.players[0].trains = 3;
    giveHand(s, 0, { orange: 2 });
    s = applyAction(s, { type: 'claim', route: routeId('chuncheon', 'wonju'), color: 'orange', wilds: 0 });
    expect(s.players[0].trains).toBe(1);
    expect(s.finalTurns).toBe(3);
    expect(s.finalBy).toBe(0);
    expect(s.events.some((e) => e.type === 'finalRound')).toBe(true);
    const order: number[] = [];
    while (s.phase !== 'gameover') {
      order.push(actor(s));
      s = applyAction(s, { type: 'take', from: 'deck' });
      if (s.phase !== 'gameover' && s.drawn > 0) s = applyAction(s, { type: 'take', from: 'deck' });
    }
    expect(order).toEqual([1, 2, 0]);
    expect(s.results).not.toBeNull();
    expect(s.winners.length).toBeGreaterThan(0);
    expect(s.events.some((e) => e.type === 'gameover')).toBe(true);
  });

  it('아무도 더 깔 수 있는 길이 없으면 바로 끝난다', () => {
    let s = ready(2, { stamps: false });
    const last = routeId('incheon', 'seoul');
    ROUTES.forEach((r) => {
      if (r.id !== last) {
        s.owners[r.id] = 1;
        s.players[1].routes.push(r.id);
      }
    });
    giveHand(s, 0, { red: 1 });
    s = applyAction(s, { type: 'claim', route: last, color: 'red', wilds: 0 });
    expect(s.phase).toBe('gameover');
    expect(s.events.find((e) => e.type === 'gameover')).toMatchObject({ reason: 'stuck' });
  });

  it('넘기기는 정말 아무것도 할 수 없을 때만', () => {
    const s = ready(2);
    expect(canPass(s)).toBe(false);
    expect(applyAction(s, { type: 'pass' })).toBe(s);
    for (const c of s.deck) s.players[1].hand[c] += 1;
    s.deck = [];
    for (let i = 0; i < 5; i++) {
      s.players[1].hand[s.window[i]!] += 1;
      s.window[i] = null;
    }
    s.planDeck = [];
    s.players[0].hand = emptyHand();
    expect(canPass(s)).toBe(true);
    const t = applyAction(s, { type: 'pass' });
    expect(t.current).toBe(1);
    expect(t.passes).toBe(1);
  });

  it('여행 계획 뽑기: 3장 중 1장 이상, 남은 것은 더미 아래로', () => {
    let s = ready(2);
    const top = s.planDeck.slice(0, 3);
    s = applyAction(s, { type: 'drawPlans' });
    expect(s.phase).toBe('plans');
    expect(s.offer).toMatchObject({ player: 0, plans: top, minKeep: 1, initial: false });
    expect(applyAction(s, { type: 'keepPlans', keep: [] })).toBe(s);
    const had = s.players[0].plans.length;
    s = applyAction(s, { type: 'keepPlans', keep: [top[1]] });
    expect(s.players[0].plans).toHaveLength(had + 1);
    expect(s.planDeck.slice(-2)).toEqual([top[0], top[2]]);
    expect(s.phase).toBe('play');
    expect(s.current).toBe(1);
    // 표를 받는 중에는 뽑을 수 없다
    const mid = applyAction(s, { type: 'take', from: 'deck' });
    expect(applyAction(mid, { type: 'drawPlans' })).toBe(mid);
  });

  it('저장 검사: 새 게임은 통과, 표가 사라진 상태는 거절', () => {
    const s = ready(3);
    expect(isValidState(s)).toBe(true);
    const bad = structuredClone(s);
    bad.deck.pop();
    expect(isValidState(bad)).toBe(false);
    const bad2 = structuredClone(s);
    bad2.owners[0] = 1;
    expect(isValidState(bad2)).toBe(false);
    expect(isValidState({ players: [] })).toBe(false);
  });
});
