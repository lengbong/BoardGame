import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL, availableModels, commonalityMult, launchDiscount, leadTime } from './aircraft';
import { CHALLENGE } from './challenges';
import { CITY, citySize, dist } from './cities';
import {
  MAX_ROUTES,
  START_MONEY,
  actor,
  applyAction,
  assignBlocker,
  CANCEL_REFUND,
  bestFreq,
  branchBlocker,
  buyBlocker,
  companyName,
  createGame,
  depositFor,
  endQ,
  rankings,
  routeBlocker,
  runMonth,
  runQuarter,
  CRISIS_MONTHS,
  endT,
} from './rules';
import {
  MAX_DELIVERIES,
  computeMonth,
  WEEK_HOURS,
  branchCost,
  companyValue,
  creditLimit,
  estimateRoute,
  leaseDeposit,
  maxFreq,
  maxFreqFor,
  orderPrice,
  planeHours,
  sellPrice,
  slotCapacity,
  utilization,
} from './simulate';
import { mOf, qOf, yearOf } from './time';
import type { AirlineOptions, AirlineSetup, AirlineState, SeatKind } from './types';

function setup(kinds: SeatKind[], options: Partial<AirlineOptions> = {}, hubs: (string | null)[] = []): AirlineSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as AirlineSetup['seats'],
    options: { era: 2003, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'normal', names: 'fictional', ...options },
    hubs: [0, 1, 2, 3].map((i) => hubs[i] ?? null),
    airlines: [null, null, null, null],
  };
}

/** 사람 둘 (서울·런던), 2003년 */
function twoHumans(options: Partial<AirlineOptions> = {}): AirlineState {
  return createGame(setup(['human', 'human'], options, ['seoul', 'london']), seededRandom(1));
}

function act(s: AirlineState, ...actions: Parameters<typeof applyAction>[1][]): AirlineState {
  for (const a of actions) {
    const next = applyAction(s, a, seededRandom(9));
    expect(next, JSON.stringify(a)).not.toBe(s);
    s = next;
  }
  return s;
}

/** 0번 회사가 서울–도쿄 노선에 737-800을 띄운 판 */
function withTokyoRoute(): AirlineState {
  let s = twoHumans();
  s = act(s, { type: 'openBranch', city: 'tokyo' }, { type: 'openRoute', a: 'seoul', b: 'tokyo' }, { type: 'lease', model: 'b737-800' });
  const plane = s.companies[0].planes[0].id;
  const route = s.companies[0].routes[0].id;
  return act(s, { type: 'assign', plane, route, freq: 14 });
}

describe('새 게임', () => {
  it('비우지 않은 자리마다 회사가 생기고, 본사는 서로 다르다', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const s = createGame(setup(['human', 'ai-normal', 'ai-easy', 'ai-normal']), seededRandom(seed));
      expect(s.companies).toHaveLength(4);
      const hubs = s.companies.map((c) => c.hub);
      expect(new Set(hubs).size).toBe(4);
      for (const c of s.companies) {
        expect(c.branches).toEqual([c.hub]);
        expect(c.cash).toBe(START_MONEY.normal.cash);
        expect(c.planes).toHaveLength(0);
      }
      expect(s.q).toBe(qOf(2003, 1));
      expect(s.t).toBe(mOf(2003, 1));
      expect(s.history).toHaveLength(1);
      expect(s.months).toHaveLength(1);
    }
  });

  it('사람이 고른 본사를 쓰고, 시작 해와 돈을 고를 수 있다', () => {
    const s = createGame(setup(['ai-easy', 'human'], { era: 1963, money: 'tight' }, [null, 'tokyo']), seededRandom(2));
    expect(s.companies[1].hub).toBe('tokyo');
    expect(s.companies[0].hub).not.toBe('tokyo');
    expect(yearOf(s.q)).toBe(1963);
    expect(s.companies[0].cash).toBe(START_MONEY.tight.cash);
  });

  it('회사 이름: 비우면 정해진 이름, 항공이 없으면 붙인다', () => {
    expect(companyName('', 3)).toBe('푸른하늘항공');
    expect(companyName('우리집', 0)).toBe('우리집항공');
    expect(companyName('별빛항공', 1)).toBe('별빛항공');
  });
});

describe('지점과 노선', () => {
  it('지점을 열면 값만큼 돈이 줄고, 같은 곳에 두 번 열 수 없다', () => {
    let s = twoHumans();
    const cost = branchCost('tokyo', s.q);
    s = act(s, { type: 'openBranch', city: 'tokyo' });
    expect(s.companies[0].cash).toBe(START_MONEY.normal.cash - cost);
    expect(applyAction(s, { type: 'openBranch', city: 'tokyo' })).toBe(s);
    expect(branchBlocker(s, 0, 'tokyo')).toBe('이미 지점이 있어요');
    s.companies[0].cash = 5;
    expect(branchBlocker(s, 0, 'paris')).toContain('돈이 모자라요');
  });

  it('노선은 두 도시 모두 지점이 있어야 하고, 같은 두 도시는 한 번만', () => {
    let s = twoHumans();
    expect(routeBlocker(s, 0, 'seoul', 'tokyo')).toContain('도쿄에 지점이 없어요');
    s = act(s, { type: 'openBranch', city: 'tokyo' }, { type: 'openRoute', a: 'seoul', b: 'tokyo' });
    expect(routeBlocker(s, 0, 'tokyo', 'seoul')).toBe('이미 있는 노선이에요');
    expect(s.companies[0].routes).toHaveLength(1);
  });

  it('그 시대 비행기로 못 가는 먼 노선은 열 수 없다 (1963년 런던–시드니)', () => {
    let s = createGame(setup(['human', 'human'], { era: 1963 }, ['london', 'newyork']), seededRandom(3));
    s = act(s, { type: 'openBranch', city: 'sydney' });
    expect(dist('london', 'sydney')).toBeGreaterThan(15000);
    expect(routeBlocker(s, 0, 'london', 'sydney')).toContain('날 수 있는 비행기가 없어요');
  });

  it('노선을 닫으면 비행기는 쉬고, 노선이 있는 지점과 본사는 닫을 수 없다', () => {
    let s = withTokyoRoute();
    expect(applyAction(s, { type: 'closeBranch', city: 'tokyo' })).toBe(s);
    expect(applyAction(s, { type: 'closeBranch', city: 'seoul' })).toBe(s);
    s = act(s, { type: 'closeRoute', route: s.companies[0].routes[0].id });
    expect(s.companies[0].planes[0].legs).toEqual([]);
    s = act(s, { type: 'closeBranch', city: 'tokyo' });
    expect(s.companies[0].branches).toEqual(['seoul']);
  });

  it(`노선은 ${MAX_ROUTES}개까지`, () => {
    let s = twoHumans({ money: 'rich' });
    s.companies[0].cash = 1e7;
    const others = Object.keys(CITY).filter((id) => id !== 'seoul');
    for (const city of others) s = applyAction(s, { type: 'openBranch', city });
    let opened = 0;
    for (const city of others) {
      const next = applyAction(s, { type: 'openRoute', a: 'seoul', b: city });
      if (next !== s) opened++;
      s = next;
    }
    expect(s.companies[0].routes.length).toBe(MAX_ROUTES);
    expect(opened).toBe(MAX_ROUTES);
  });
});

describe('비행기', () => {
  it('새 비행기는 주문하고 값을 낸 뒤 몇 달 뒤에 받고, 리스는 바로 받는다 (첫해 사람은 보증금 없음)', () => {
    let s = twoHumans();
    const m = MODEL['b737-800'];
    const price = orderPrice(s, m, s.companies[0]);
    s = act(s, { type: 'buy', model: m.id });
    expect(s.companies[0].cash).toBeCloseTo(START_MONEY.normal.cash - price, 5);
    expect(s.companies[0].planes).toHaveLength(0);
    expect(s.companies[0].orders).toHaveLength(1);
    expect(s.companies[0].orders[0].due).toBe(s.t + leadTime(m, 2003));
    expect(leadTime(m, 2003)).toBeGreaterThanOrEqual(3);
    expect(leadTime(m, 2003)).toBeLessThanOrEqual(12);
    expect(depositFor(s, 0, m.id)).toBe(0);
    s = act(s, { type: 'lease', model: m.id });
    expect(s.companies[0].cash).toBeCloseTo(START_MONEY.normal.cash - price, 5);
    expect(s.companies[0].planes.map((p) => p.leased)).toEqual([true]);
    // 첫해가 지나면 리스할 때 보증금(리스료 두 분기 치)을 내고, 돌려줄 때 돌려받는다
    s.t += 12;
    s.q = Math.floor(s.t / 3);
    expect(depositFor(s, 0, m.id)).toBeCloseTo(leaseDeposit(s, m), 5);
    const cash = s.companies[0].cash;
    s = act(s, { type: 'lease', model: m.id });
    const p = s.companies[0].planes[1];
    expect(p.deposit).toBeCloseTo(leaseDeposit(s, m), 5);
    expect(s.companies[0].cash).toBeCloseTo(cash - p.deposit, 5);
    s = act(s, { type: 'sell', plane: p.id });
    expect(s.companies[0].cash).toBeCloseTo(cash - p.rent, 5);
  });

  it('주문한 비행기는 정한 달이 되면 들어오고, 주문을 무르면 70%를 돌려받는다', () => {
    let s = twoHumans({ money: 'rich' });
    const m = MODEL['a320'];
    s = act(s, { type: 'buy', model: m.id }, { type: 'buy', model: m.id });
    const [o1, o2] = s.companies[0].orders;
    const cash = s.companies[0].cash;
    s = act(s, { type: 'cancelOrder', order: o2.id });
    expect(s.companies[0].cash).toBeCloseTo(cash + Math.round(o2.price * CANCEL_REFUND), 5);
    const rng = seededRandom(3);
    while (s.t < o1.due && s.phase === 'manage') s = runMonth(s, rng);
    expect(s.t).toBe(o1.due);
    const c = s.companies[0];
    expect(c.orders).toHaveLength(0);
    expect(c.planes.filter((p) => p.model === m.id && !p.leased)).toHaveLength(1);
    expect(s.news.some((n) => n.title.includes('인도'))).toBe(true);
  });

  it('같은 계열 비행기가 많으면 정비·승무원비가 줄고, 새 기종 첫 손님은 할인을 받는다', () => {
    const s = twoHumans({ money: 'rich' });
    const crew = () => estimateRoute(s, 0, 'seoul', 'tokyo', [{ model: 'a320', freq: 10 }], 0).cost.crew;
    const before = crew();
    for (let i = 0; i < 4; i++) s.companies[0].planes.push({ id: s.nextId++, model: 'a321', leased: false, rent: 0, deposit: 0, since: s.t, legs: [] });
    expect(MODEL.a321.family).toBe(MODEL.a320.family);
    expect(commonalityMult(4)).toBeLessThan(1);
    expect(crew()).toBeLessThan(before);
    const fresh = availableModels(2003).find((x) => x.intro >= 2002);
    if (fresh) {
      expect(launchDiscount(fresh, 2003)).toBeGreaterThan(0);
      expect(orderPrice(s, fresh, s.companies[0])).toBeLessThan(fresh.price);
    }
    expect(launchDiscount(MODEL['b737-800'], 2003)).toBe(0);
    expect(leadTime(MODEL['b737-800'], 2003)).toBeLessThan(leadTime(MODEL['b737-800'], 1998));
  });

  it('중고 시장에서 바로 살 수 있고, 산 비행기는 매물에서 빠진다', () => {
    let s = twoHumans({ money: 'rich' });
    expect(s.market.length).toBeGreaterThan(0);
    const u = s.market[0];
    s = act(s, { type: 'buyUsed', listing: u.id });
    expect(s.market.some((x) => x.id === u.id)).toBe(false);
    const p = s.companies[0].planes[0];
    expect(p.model).toBe(u.model);
    expect(p.leased).toBe(false);
    expect(Math.round((s.t - p.since) / 12)).toBe(Math.round(u.age));
    expect(applyAction(s, { type: 'buyUsed', listing: u.id })).toBe(s);
  });

  it('그 해에 나오지 않았거나 생산이 끝난 기종은 살 수 없다', () => {
    const s83 = createGame(setup(['human', 'human'], { era: 1983 }, ['seoul', 'london']), seededRandom(1));
    expect(buyBlocker(s83, 0, 'a380', false)).toContain('2007년에 나와요');
    expect(buyBlocker(s83, 0, 'b707', false)).toBe('생산이 끝난 기종이에요');
    expect(buyBlocker(s83, 0, 'b747-200', true)).toBeNull();
    const ids63 = availableModels(1963).map((m) => m.id);
    expect(ids63).toContain('b707');
    expect(ids63).not.toContain('b747-100');
    const ids03 = availableModels(2003).map((m) => m.id);
    expect(ids03).toContain('b777-200');
    expect(ids03).not.toContain('concorde');
    expect(availableModels(1977).map((m) => m.id)).toContain('concorde');
  });

  it(`한 달에 ${MAX_DELIVERIES}대까지만 바로 받는다`, () => {
    let s = twoHumans({ money: 'rich' });
    for (let i = 0; i < MAX_DELIVERIES; i++) s = act(s, { type: 'lease', model: 'atr72' });
    expect(applyAction(s, { type: 'lease', model: 'atr72' })).toBe(s);
    expect(buyBlocker(s, 0, 'atr72', true)).toContain('한 달에');
  });

  it('팔면 가치의 90%를 받고, 리스기를 돌려주면 위약금을 낸다', () => {
    let s = twoHumans();
    s.companies[0].planes.push({ id: s.nextId++, model: 'a320', leased: false, rent: 0, deposit: 0, since: s.t - 24, legs: [] });
    s = act(s, { type: 'lease', model: 'a320' });
    const [own, leased] = s.companies[0].planes;
    const cash = s.companies[0].cash;
    const price = sellPrice(s, own);
    s = act(s, { type: 'sell', plane: own.id });
    expect(s.companies[0].cash).toBeCloseTo(cash + price, 5);
    s = act(s, { type: 'sell', plane: leased.id });
    expect(s.companies[0].cash).toBeCloseTo(cash + price + leased.deposit - leased.rent, 5);
    expect(s.companies[0].planes).toHaveLength(0);
  });

  it('비행기 한 대가 비행시간 안에서 여러 노선을 난다', () => {
    let s = twoHumans({ money: 'rich' });
    s = act(s, { type: 'openBranch', city: 'tokyo' }, { type: 'openBranch', city: 'osaka' });
    s = act(s, { type: 'openRoute', a: 'seoul', b: 'tokyo' }, { type: 'openRoute', a: 'seoul', b: 'osaka' }, { type: 'lease', model: 'a320' });
    const p = s.companies[0].planes[0];
    const [tyo, osa] = s.companies[0].routes;
    s = act(s, { type: 'assign', plane: p.id, route: tyo.id, freq: 10 });
    const c1 = s.companies[0];
    const used = planeHours(c1, c1.planes[0]);
    expect(used).toBeGreaterThan(0);
    const left = maxFreqFor(c1, c1.planes[0], osa.id);
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThan(maxFreq(MODEL.a320, dist('seoul', 'osaka')));
    s = act(s, { type: 'assign', plane: p.id, route: osa.id, freq: left });
    const c2 = s.companies[0];
    expect(c2.planes[0].legs).toHaveLength(2);
    expect(planeHours(c2, c2.planes[0])).toBeLessThanOrEqual(WEEK_HOURS + 1e-6);
    expect(utilization(c2, c2.planes[0])).toBeGreaterThan(0.9);
    // 남은 시간이 없으면 더 늘릴 수 없다
    expect(assignBlocker(s, 0, p.id, osa.id, left + 1)).toContain('비행시간');
    // 0회로 정하면 그 노선에서만 빠진다
    s = act(s, { type: 'assign', plane: p.id, route: tyo.id, freq: 0 });
    expect(s.companies[0].planes[0].legs.map((l) => l.route)).toEqual([osa.id]);
    // 두 노선 손님이 모두 생긴다
    s = act(s, { type: 'assign', plane: p.id, route: tyo.id, freq: 4 }, { type: 'endTurn' }, { type: 'endTurn' });
    expect(s.companies[0].routes.every((r) => r.stats!.pax > 0)).toBe(true);
  });

  it('항속 거리·공항 크기·주간 횟수·슬롯을 넘으면 띄울 수 없다', () => {
    let s = twoHumans({ money: 'rich', era: 2003 });
    s = act(s, { type: 'openBranch', city: 'newyork' }, { type: 'openBranch', city: 'kathmandu' }, { type: 'openBranch', city: 'tokyo' });
    s = act(s, { type: 'openRoute', a: 'seoul', b: 'newyork' }, { type: 'openRoute', a: 'seoul', b: 'kathmandu' }, { type: 'openRoute', a: 'seoul', b: 'tokyo' });
    s = act(s, { type: 'lease', model: 'a320' }, { type: 'lease', model: 'b747-400' });
    const [small, jumbo] = s.companies[0].planes;
    const [ny, ktm, tyo] = s.companies[0].routes;
    expect(assignBlocker(s, 0, small.id, ny.id, 3)).toContain('항속 거리가 모자라요');
    expect(assignBlocker(s, 0, jumbo.id, ktm.id, 3)).toContain('카트만두 공항');
    const max = maxFreq(MODEL['a320'], dist('seoul', 'tokyo'));
    expect(assignBlocker(s, 0, small.id, tyo.id, max + 1)).toContain(`${max}번까지`);
    expect(assignBlocker(s, 0, small.id, tyo.id, max)).toBeNull();
    expect(bestFreq(s, 0, small.id, tyo.id)).toBe(max);
    // 도쿄 슬롯을 거의 다 쓴 것처럼 꾸민다
    const cap = slotCapacity(s, 0, 'tokyo');
    s.companies[0].planes.push({ id: 999, model: 'a320', leased: true, rent: 1, deposit: 0, since: s.t, legs: [{ route: tyo.id, freq: cap - 2 }] });
    s.nextId = 1000;
    expect(assignBlocker(s, 0, small.id, tyo.id, 3)).toContain('도쿄 슬롯이 모자라요');
    expect(bestFreq(s, 0, small.id, tyo.id)).toBe(2);
  });
});

describe('운임·광고·서비스·대출·부대사업', () => {
  it('운임은 −30%~+30%, 광고와 서비스도 범위 안에서만', () => {
    let s = withTokyoRoute();
    const r = s.companies[0].routes[0].id;
    s = act(s, { type: 'setFare', route: r, fare: 20 });
    expect(s.companies[0].routes[0].fare).toBe(20);
    expect(applyAction(s, { type: 'setFare', route: r, fare: 35 })).toBe(s);
    s = act(s, { type: 'setAds', region: 'eastasia', amount: 25 }, { type: 'setService', level: 5 });
    expect(s.companies[0].ads.eastasia).toBe(25);
    expect(applyAction(s, { type: 'setService', level: 6 })).toBe(s);
    expect(applyAction(s, { type: 'setAds', region: 'europe', amount: -1 })).toBe(s);
  });

  it('대출은 한도까지, 갚을 때는 현금 안에서', () => {
    let s = twoHumans();
    const limit = creditLimit(s, 0);
    expect(limit).toBe(Math.round(START_MONEY.normal.cash * 0.5));
    expect(applyAction(s, { type: 'borrow', amount: limit + 10 })).toBe(s);
    s = act(s, { type: 'borrow', amount: limit });
    expect(s.companies[0].debt).toBe(limit);
    expect(s.companies[0].cash).toBe(START_MONEY.normal.cash + limit);
    s = act(s, { type: 'repay', amount: 300 });
    expect(s.companies[0].debt).toBe(limit - 300);
    s.companies[0].cash = 10;
    expect(applyAction(s, { type: 'repay', amount: 100 })).toBe(s);
  });

  it('호텔은 지점이 있는 도시에만 짓고, 분기마다 수입이 생긴다', () => {
    let s = withTokyoRoute();
    expect(applyAction(s, { type: 'build', city: 'paris', kind: 'hotel' })).toBe(s);
    s = act(s, { type: 'build', city: 'tokyo', kind: 'hotel' });
    expect(s.companies[0].businesses).toHaveLength(1);
    s = act(s, { type: 'endTurn' }, { type: 'endTurn' });
    expect(s.report!.companies[0].side).toBeGreaterThan(0);
    expect(s.report!.companies[1].side).toBe(0);
  });
});

describe('달 진행', () => {
  it('지금 회사만 행동하고, 모두 마치면 이번 달을 계산해 다음 달로', () => {
    let s = withTokyoRoute();
    expect(actor(s)).toBe(0);
    s = act(s, { type: 'endTurn' });
    expect(actor(s)).toBe(1);
    // 1번 회사 차례에 0번 노선을 바꿀 수 없다
    expect(applyAction(s, { type: 'setFare', route: s.companies[0].routes[0].id, fare: 10 })).toBe(s);
    const t = s.t;
    s = act(s, { type: 'endTurn' });
    expect(s.t).toBe(t + 1);
    expect(s.q).toBe(Math.floor((t + 1) / 3));
    expect(s.report!.t).toBe(t);
    expect(s.report!.span).toBe(1);
    expect(s.months).toHaveLength(2);
    expect(s.report!.companies[0].pax).toBeGreaterThan(0);
    expect(s.companies[0].routes[0].stats!.lf).toBeGreaterThan(0);
    expect(s.companies[0].routes[0].stats!.hist).toHaveLength(1);
    // 다음 달은 순서가 한 칸 돈다
    expect(actor(s)).toBe(1);
    expect(s.events.some((e) => e.type === 'month')).toBe(true);
    expect(s.events.some((e) => e.type === 'quarter')).toBe(false);
  });

  it('석 달이 지나면 분기 결산이, 열두 달이 지나면 한 해 결산이 나오고, 모두 달 결산의 합이다', () => {
    let s = withTokyoRoute();
    const rng = seededRandom(4);
    for (let k = 0; k < 3; k++) s = runMonth(s, rng);
    expect(s.qReport).not.toBeNull();
    expect(s.qReport!.span).toBe(3);
    expect(s.history).toHaveLength(2);
    const months = s.ledger.slice(-3);
    for (const key of ['ticket', 'fuel', 'profit', 'pax', 'flights', 'cancelled'] as const) {
      const sum = months.reduce((acc, m) => acc + (m.companies[0][key] as number), 0);
      expect(s.qReport!.companies[0][key]).toBeCloseTo(sum, 6);
    }
    for (let k = 0; k < 9; k++) s = runMonth(s, rng);
    expect(s.years).toHaveLength(1);
    const year = s.ledger.filter((l) => yearOf(Math.floor(l.t / 3)) === 2003);
    expect(year).toHaveLength(12);
    const sumProfit = year.reduce((acc, m) => acc + m.companies[0].profit, 0);
    expect(s.years[0].companies[0].profit).toBeCloseTo(sumProfit, 6);
    expect(s.companies[0].reviews).toHaveLength(1);
  });

  it(`${CRISIS_MONTHS}달 내내 돈이 모자라면 운항을 멈추고 빠진다`, () => {
    let s = withTokyoRoute();
    s.companies[0].cash = -50000;
    s.companies[0].baseCredit = 0;
    s.companies[0].debt = 0;
    for (let k = 0; k < CRISIS_MONTHS - 1; k++) s = runMonth(s, seededRandom(1));
    expect(s.companies[0].out).toBe(false);
    expect(s.companies[0].crisis).toBe(CRISIS_MONTHS - 1);
    s = runMonth(s, seededRandom(1));
    expect(s.companies[0].out).toBe(true);
    expect(s.companies[0].planes).toHaveLength(0);
    // 남은 회사가 하나면 끝
    expect(s.phase).toBe('gameover');
    expect(s.result!.winners).toEqual([1]);
  });

  it('돈이 모자라면 대출 한도 안에서 저절로 빌린다', () => {
    let s = withTokyoRoute();
    s.companies[0].cash = -100;
    s = runMonth(s, seededRandom(1));
    expect(s.report!.companies[0].autoLoan).toBeGreaterThan(0);
    expect(s.companies[0].cash).toBeGreaterThanOrEqual(0);
    expect(s.companies[0].crisis).toBe(0);
  });

  it('리스료·이자·지점 유지비는 달마다 낸다', () => {
    const s = withTokyoRoute();
    s.companies[0].debt = 600;
    const r = computeMonth(s).reports[0];
    expect(r.interest).toBeCloseTo((600 * s.rate) / 100 / 12, 6);
    expect(r.lease).toBeGreaterThan(0);
    expect(r.lease).toBeLessThan(s.companies[0].planes[0].rent * 1.5 + 5);
  });
});

describe('승리 조건', () => {
  it('정해진 해까지: 그 해 마지막 분기가 끝나면 회사 가치 1등이 이긴다', () => {
    let s = twoHumans({ mode: 'years', years: 10 });
    expect(endQ(s)).toBe(qOf(2012, 4));
    expect(endT(s)).toBe(mOf(2012, 12));
    s.companies[1].cash = 9999;
    s.t = endT(s) - 1;
    s.q = Math.floor(s.t / 3);
    s = runMonth(s, seededRandom(1));
    expect(s.phase).toBe('manage');
    s = runMonth(s, seededRandom(1));
    expect(s.phase).toBe('gameover');
    expect(s.result!.winners).toEqual([1]);
    expect(rankings(s)[0]).toBe(1);
  });

  it('목표 먼저 이루기: 여섯 지역 취항 + 회사 가치를 먼저 이루면 이긴다', () => {
    let s = twoHumans({ mode: 'goal', goalValue: 10000, goalRegions: 6 });
    const c = s.companies[0];
    c.cash = 20000;
    // 여섯 지역에 닿는 노선 셋 (서울–시드니, 런던–뉴욕, 두바이–나이로비)
    const pairs: [string, string, string][] = [
      ['seoul', 'sydney', 'b777-200'],
      ['london', 'newyork', 'b777-200'],
      ['dubai', 'nairobi', 'a320'],
    ];
    for (const [a, b, model] of pairs) {
      for (const city of [a, b]) if (!c.branches.includes(city)) c.branches.push(city);
      const rid = s.nextId++;
      c.routes.push({ id: rid, a, b, fare: 0, since: s.t, stats: null });
      c.planes.push({ id: s.nextId++, model, leased: true, rent: 3, deposit: 0, since: s.t, legs: [{ route: rid, freq: 2 }] });
    }
    s = runMonth(s, seededRandom(1));
    expect(s.phase).toBe('gameover');
    expect(s.result!.winners).toEqual([0]);
  });

  it('도전 과제: 적자 회사 살리기는 낡은 비행기·빚·노선을 가지고 시작한다', () => {
    const s = createGame(setup(['human'], { mode: 'challenge', challenge: 'rescue' }), seededRandom(1));
    const me = s.companies[0];
    const def = CHALLENGE.rescue;
    expect(me.hub).toBe('busan');
    expect(me.debt).toBe(def.debt);
    expect(me.planes).toHaveLength(def.fleet!.length);
    expect(me.planes.every((p) => p.legs.length > 0 && p.legs.every((l) => l.freq > 0))).toBe(true);
    expect(s.companies).toHaveLength(1 + def.rivals.length);
    expect(s.challenge!.startValue).toBeLessThan(0);
    expect(endQ(s)).toBe(qOf(2007, 4));
  });

  it('도전 과제: 조건을 이루면 성공, 기한이 지나면 실패', () => {
    let s = createGame(setup(['human'], { mode: 'challenge', challenge: 'sixregions' }), seededRandom(1));
    s.t = endT(s);
    s.q = Math.floor(s.t / 3);
    s = runMonth(s, seededRandom(1));
    expect(s.phase).toBe('gameover');
    expect(s.result!.success).toBe(false);
    expect(s.result!.winners).toEqual([]);

    let t = createGame(setup(['human'], { mode: 'challenge', challenge: 'topdog' }), seededRandom(1));
    t.companies[0].cash = 50000;
    t = runQuarter(t, seededRandom(1));
    expect(t.phase).toBe('gameover');
    expect(t.result!.success).toBe(true);
    expect(t.result!.winners).toEqual([0]);
  });
});

describe('시대와 사건', () => {
  it('도시는 시대마다 자란다 (두바이·서울은 크게, 뉴욕은 그대로)', () => {
    expect(citySize(CITY.dubai, 2003)).toBeGreaterThan(citySize(CITY.dubai, 1963) * 5);
    expect(citySize(CITY.seoul, 2003)).toBeGreaterThan(citySize(CITY.seoul, 1963) * 2);
    expect(citySize(CITY.newyork, 2003)).toBe(citySize(CITY.newyork, 1963));
  });

  it('여러 분기 동안 사건과 뉴스가 생기고 유가는 정해진 범위에 있다', () => {
    let s = createGame(setup(['human', 'human'], { era: 1983, years: 30 }, ['seoul', 'london']), seededRandom(5));
    const rng = seededRandom(6);
    const oils: number[] = [];
    for (let i = 0; i < 144; i++) {
      s = runMonth(s, rng);
      oils.push(s.oil);
      expect(s.oil).toBeGreaterThanOrEqual(0.5);
      expect(s.oil).toBeLessThanOrEqual(3);
      expect(s.rate).toBeGreaterThanOrEqual(2);
    }
    const titles = s.news.map((n) => n.title).join(' / ');
    expect(titles).toContain('서울 올림픽');
    expect(s.news.length).toBeGreaterThan(20);
    // 새 기종 소식
    expect(titles).toMatch(/새 기종/);
    // 유가는 달마다 조금씩 움직인다 (같은 값만 이어지지 않는다)
    expect(new Set(oils).size).toBeGreaterThan(30);
  });

  it('회사 가치는 현금 − 빚 + 내 비행기 가치 + 낸 주문 값', () => {
    let s = twoHumans();
    s = act(s, { type: 'buy', model: 'a320' }, { type: 'borrow', amount: 500 });
    const c = s.companies[0];
    expect(companyValue(s, 0)).toBeCloseTo(c.cash - c.debt + c.orders[0].price, 5);
  });
});
