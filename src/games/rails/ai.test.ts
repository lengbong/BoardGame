import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { aiStep, cheapestPath, choosePlans, decideAction, planNeeds, type AiLevel } from './ai';
import { CARDS_PER_COLOR, PLANS, ROUTES, TICKET_COLORS, WILD_CARDS } from './map';
import { DEFAULT_OPTIONS, actor, allPlanIds, applyAction, countCards, createGame } from './rules';
import type { CardKind, Hand, RailsOptions, RailsSetup, RailsState, SeatKind } from './types';

function setup(kinds: SeatKind[], options: Partial<RailsOptions> = {}): RailsSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: `C${i}` })) as RailsSetup['seats'],
    options: { ...DEFAULT_OPTIONS, ...options },
  };
}

/** 계획을 모두 고른 뒤 0번 차례인 게임 */
function ready(kinds: SeatKind[] = ['ai-normal', 'ai-normal'], seed = 1, options: Partial<RailsOptions> = {}): RailsState {
  let s = createGame(setup(kinds, options), seededRandom(seed));
  while (s.phase === 'plans') s = applyAction(s, { type: 'keepPlans', keep: s.offer!.plans.slice(0, s.offer!.minKeep) });
  s.current = 0;
  s.events = [];
  return s;
}

function giveHand(s: RailsState, player: number, hand: Partial<Hand>): void {
  const p = s.players[player];
  for (const k of Object.keys(p.hand) as CardKind[]) {
    const want = hand[k] ?? 0;
    while (p.hand[k] < want) {
      s.deck.splice(s.deck.indexOf(k), 1);
      p.hand[k] += 1;
    }
    while (p.hand[k] > want) {
      p.hand[k] -= 1;
      s.deck.push(k);
    }
  }
}

function own(s: RailsState, player: number, ids: number[]): void {
  for (const id of ids) {
    s.owners[id] = player;
    s.players[player].routes.push(id);
  }
}

const routeId = (a: string, b: string) => ROUTES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a))!.id;
const planId = (a: string, b: string) => PLANS.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))!.id;

/** 컴퓨터끼리 끝까지 */
function playOut(kinds: SeatKind[], seed: number, options: Partial<RailsOptions> = {}): { state: RailsState; steps: number } {
  const rng = seededRandom(seed);
  let s = createGame(setup(kinds, options), rng);
  let steps = 0;
  while (s.phase !== 'gameover' && steps < 2000) {
    const level = s.players[actor(s)].kind as AiLevel;
    const action = decideAction(s, level, rng);
    const next = applyAction(s, action);
    // 컴퓨터는 언제나 할 수 있는 행동만 고른다
    if (next === s) throw new Error(`안 되는 행동: ${JSON.stringify(action)}`);
    s = next;
    steps++;
  }
  return { state: s, steps };
}

describe('길 찾기', () => {
  it('내 길은 공짜, 남의 길은 못 지나간다', () => {
    const s = ready();
    const base = cheapestPath(s, 0, 'seoul', 'daejeon')!;
    expect(base.cost).toBe(6);
    own(s, 0, [routeId('seoul', 'cheonan')]);
    expect(cheapestPath(s, 0, 'seoul', 'daejeon')!.cost).toBe(3);
    own(s, 1, [routeId('cheonan', 'daejeon')]);
    const around = cheapestPath(s, 0, 'seoul', 'daejeon')!;
    expect(around.open).not.toContain(routeId('cheonan', 'daejeon'));
    expect(around.cost).toBeGreaterThan(3);
  });

  it('완전히 막힌 계획은 못 이루는 것으로 본다', () => {
    const s = ready();
    s.players[0].plans = [planId('jeju', 'gwangju')];
    own(s, 1, [routeId('mokpo', 'jeju'), routeId('yeosu', 'jeju')]);
    const needs = planNeeds(s, 0);
    expect(needs.dead).toEqual([planId('jeju', 'gwangju')]);
    expect(needs.targets).toEqual([]);
  });
});

describe('보통 컴퓨터', () => {
  it('계획 길 위의 길을 깔 수 있으면 깐다', () => {
    const s = ready();
    s.players[0].plans = [planId('seoul', 'daejeon')];
    giveHand(s, 0, { red: 3, green: 1 });
    const a = decideAction(s, 'ai-normal', seededRandom(1));
    expect(a).toEqual({ type: 'claim', route: routeId('seoul', 'cheonan'), color: 'red', wilds: 0 });
  });

  it('모자란 색을 창구에서 가져온다', () => {
    const s = ready();
    s.players[0].plans = [planId('seoul', 'daejeon')];
    giveHand(s, 0, { red: 1 });
    // 창구에 빨강 한 장 (나머지는 계획과 상관없는 색)
    const back = s.window.filter((c): c is NonNullable<typeof c> => c !== null);
    s.deck.push(...back);
    s.window = ['purple', 'yellow', 'red', 'purple', 'yellow'];
    for (const c of s.window) s.deck.splice(s.deck.indexOf(c!), 1);
    expect(decideAction(s, 'ai-normal', seededRandom(2))).toEqual({ type: 'take', from: 'window', index: 2 });
    expect(TICKET_COLORS.every((c) => countCards(s)[c] === CARDS_PER_COLOR)).toBe(true);
  });

  it('마지막 차례에는 지금 가장 점수가 큰 길을 깐다', () => {
    const s = ready(['ai-normal', 'ai-normal'], 1, { stamps: false });
    s.players[0].plans = [];
    s.finalTurns = 2;
    giveHand(s, 0, { orange: 4, red: 1 });
    const a = decideAction(s, 'ai-normal', seededRandom(3));
    expect(a.type).toBe('claim');
    expect(ROUTES[(a as { route: number }).route].length).toBe(4);
  });

  it('계획을 고를 때 막힌 계획은 피하고, 꼭 가져야 할 장수는 지킨다', () => {
    const s = ready();
    own(s, 1, [routeId('mokpo', 'jeju'), routeId('yeosu', 'jeju')]);
    const blocked = planId('jeju', 'gwangju');
    const offer = { player: 0, plans: [blocked, planId('seoul', 'daejeon'), planId('incheon', 'cheongju')], minKeep: 1, initial: false };
    for (let k = 0; k < 5; k++) {
      const keep = choosePlans(s, offer, 'ai-normal', seededRandom(k));
      expect(keep.length).toBeGreaterThanOrEqual(1);
      expect(keep).not.toContain(blocked);
    }
    const all = { ...offer, plans: [blocked], minKeep: 1 };
    expect(choosePlans(s, all, 'ai-normal')).toEqual([blocked]);
  });

  it('계획을 다 이었고 기차가 넉넉하면 새 계획을 뽑는다', () => {
    const s = ready();
    s.players[0].plans = [planId('pohang', 'busan')];
    own(s, 0, [routeId('pohang', 'gyeongju'), routeId('gyeongju', 'ulsan'), routeId('ulsan', 'busan')]);
    expect(decideAction(s, 'ai-normal', seededRandom(4))).toEqual({ type: 'drawPlans' });
  });
});

describe('쉬운 컴퓨터', () => {
  it('계획은 정해진 장수 이상 고르고, 행동은 언제나 할 수 있는 것', () => {
    const s = createGame(setup(['ai-easy', 'ai-easy']), seededRandom(8));
    const keep = choosePlans(s, s.offer!, 'ai-easy', seededRandom(1));
    expect(keep.length).toBeGreaterThanOrEqual(2);
    expect(keep.every((id) => s.offer!.plans.includes(id))).toBe(true);
    let t = ready(['ai-easy', 'ai-easy'], 3);
    for (let k = 0; k < 40 && t.phase !== 'gameover'; k++) {
      const next = applyAction(t, decideAction(t, 'ai-easy', seededRandom(k)));
      expect(next).not.toBe(t);
      t = next;
    }
  });
});

describe('컴퓨터끼리 끝까지', () => {
  it('2~4명, 여러 시드로 멈추지 않고 끝나며 표와 계획 카드가 그대로다', () => {
    const cases: SeatKind[][] = [
      ['ai-normal', 'ai-easy'],
      ['ai-easy', 'ai-normal', 'ai-normal'],
      ['ai-normal', 'ai-normal', 'ai-easy', 'ai-easy'],
      ['ai-easy', 'ai-easy', 'ai-easy', 'ai-easy'],
    ];
    cases.forEach((kinds, k) => {
      for (const seed of [11, 22, 33]) {
        const { state } = playOut(kinds, seed * (k + 1));
        expect(state.phase).toBe('gameover');
        expect(state.results).toHaveLength(kinds.length);
        expect(state.winners.length).toBeGreaterThan(0);
        const cards = countCards(state);
        expect(TICKET_COLORS.every((c) => cards[c] === CARDS_PER_COLOR) && cards.wild === WILD_CARDS).toBe(true);
        expect(new Set(allPlanIds(state)).size).toBe(PLANS.length);
        for (const [i, p] of state.players.entries()) {
          expect(p.trains).toBeGreaterThanOrEqual(0);
          expect(p.plans.length).toBeGreaterThanOrEqual(1);
          expect(p.routes.every((r) => state.owners[r] === i)).toBe(true);
        }
      }
    });
  });

  it('긴 게임(기차 40칸)·어린이 계획·도장 끄기도 끝난다', () => {
    for (const seed of [5, 6]) {
      const { state } = playOut(['ai-normal', 'ai-normal', 'ai-normal', 'ai-normal'], seed, { trains: 40, planStart: 'kids', stamps: false });
      expect(state.phase).toBe('gameover');
      expect(state.players.every((p) => p.stampPoints === 0)).toBe(true);
    }
  });

  it('aiStep은 언제나 앞으로 나아간다', () => {
    let s = createGame(setup(['ai-normal', 'ai-easy', 'ai-normal']), seededRandom(77));
    for (let k = 0; k < 400 && s.phase !== 'gameover'; k++) {
      const next = aiStep(s, s.players[actor(s)].kind as AiLevel, seededRandom(k));
      expect(next).not.toBe(s);
      s = next;
    }
    expect(s.phase).toBe('gameover');
  });

  it('보통이 쉬움보다 자주 이긴다', () => {
    let normalWins = 0;
    const games = 24;
    for (let seed = 1; seed <= games; seed++) {
      const kinds: SeatKind[] = seed % 2 ? ['ai-normal', 'ai-easy'] : ['ai-easy', 'ai-normal'];
      const { state } = playOut(kinds, 1000 + seed);
      if (state.winners.some((i) => state.players[i].kind === 'ai-normal')) normalWins++;
    }
    // 잰 값: 24판 중 24판
    expect(normalWins / games).toBeGreaterThan(0.75);
  });
});
