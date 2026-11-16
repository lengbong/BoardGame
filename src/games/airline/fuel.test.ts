import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL } from './aircraft';
import { aiManage } from './ai';
import { advise } from './advisor';
import { defaultCabin } from './cabin';
import { FUEL_PASS, FUEL_SELL_RATE, FUEL_TON, MAX_TANK, PAX_BURN, TANK_LEVELS, autoBuyTons, burnFuel, buyFuelBlocker, fuelSurcharge, fuelSurchargeKm, normalOil, surchargeText, tankBlocker, tankOf } from './fuel';
import { actor, applyAction, createGame, runMonth } from './rules';
import { FUEL_PRICE, baseFare, companyValue, computeMonth, marketFare } from './simulate';
import { isValidState, parseSaved } from './storage';
import { defaultTimes } from './timetable';
import type { AirlineAction, AirlineSetup, AirlineState, SeatKind } from './types';

function setup(kinds: SeatKind[]): AirlineSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as AirlineSetup['seats'],
    options: { era: 2003, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'normal', names: 'fictional' },
    hubs: ['seoul', 'london', null, null],
    airlines: [null, null, null, null],
  };
}

function game(kinds: SeatKind[] = ['human', 'human']): AirlineState {
  return createGame(setup(kinds), seededRandom(3));
}

function act(s: AirlineState, ...actions: AirlineAction[]): AirlineState {
  for (const a of actions) {
    const next = applyAction(s, a, seededRandom(5));
    expect(next, JSON.stringify(a)).not.toBe(s);
    s = next;
  }
  return s;
}

/** ci 회사 차례가 될 때까지 차례를 넘긴다 (when: 더 맞춰야 할 조건) */
function toTurn(s: AirlineState, ci: number, when: (s: AirlineState) => boolean = () => true): AirlineState {
  for (let k = 0; k < 40 && !(actor(s) === ci && when(s)); k++) s = applyAction(s, { type: 'endTurn' }, seededRandom(k));
  expect(actor(s)).toBe(ci);
  return s;
}

/** 노선과 비행기를 손으로 붙인다 */
function addRoute(s: AirlineState, ci: number, a: string, b: string, model: string, freq: number): void {
  const c = s.companies[ci];
  for (const city of [a, b]) if (!c.branches.includes(city)) c.branches.push(city);
  const rid = s.nextId++;
  c.routes.push({ id: rid, a, b, fare: 0, since: s.t, stats: null, times: defaultTimes(a, b, 2003) });
  c.planes.push({ id: s.nextId++, model, leased: true, rent: 3, deposit: 0, since: s.t, legs: [{ route: rid, freq }], cabin: defaultCabin(MODEL[model]), meal: 3 });
}

describe('연료 탱크', () => {
  it('1톤 값은 비행 비용 계산의 연료 값과 같다', () => {
    expect(FUEL_TON).toBeCloseTo((FUEL_PRICE * 1000) / 10000, 10);
  });

  it('탱크를 지어야 연료를 사 둘 수 있고, 단계마다 값을 내고 더 많이 담는다', () => {
    let s = game();
    expect(buyFuelBlocker(s, 0, 100)).toMatch(/탱크/);
    const cash = s.companies[0].cash;
    s = act(s, { type: 'buildTank' });
    expect(tankOf(s.companies[0]).level).toBe(1);
    expect(s.companies[0].cash).toBeCloseTo(cash - TANK_LEVELS[1].cost, 6);
    s = act(s, { type: 'buildTank' });
    expect(tankOf(s.companies[0]).level).toBe(2);
    // 가장 큰 탱크 다음은 없다
    s.companies[0].fuel = { ...tankOf(s.companies[0]), level: MAX_TANK };
    expect(tankBlocker(s, 0)).toMatch(/가장 큰/);
  });

  it('살 때마다 평균 단가를 다시 셈하고, 탱크보다 많이는 못 산다', () => {
    let s = game();
    s = act(s, { type: 'buildTank' });
    s.oil = 1.2;
    const cash = s.companies[0].cash;
    s = act(s, { type: 'buyFuel', tons: 1000 });
    expect(s.companies[0].cash).toBeCloseTo(cash - 1000 * FUEL_TON * 1.2, 6);
    s.oil = 0.8;
    s = act(s, { type: 'buyFuel', tons: 1000 });
    const t = tankOf(s.companies[0]);
    expect(t.stock).toBe(2000);
    expect(t.avg).toBeCloseTo(1, 4);
    expect(buyFuelBlocker(s, 0, 1)).toMatch(/가득/);
  });

  it('되팔면 그달 값의 90%를 받는다', () => {
    let s = game();
    s = act(s, { type: 'buildTank' }, { type: 'buyFuel', tons: 1000 });
    s.oil = 1.5;
    const cash = s.companies[0].cash;
    s = act(s, { type: 'sellFuel', tons: 400 });
    expect(s.companies[0].cash).toBeCloseTo(cash + 400 * FUEL_TON * 1.5 * FUEL_SELL_RATE, 6);
    expect(tankOf(s.companies[0]).stock).toBe(600);
  });

  it('달 계산은 탱크 연료를 산 값으로 먼저 쓰고, 다음 달에는 그만큼 줄어 있다', () => {
    let s = game();
    addRoute(s, 0, 'seoul', 'tokyo', 'b737-800', 14);
    s.oil = 1.4;
    const plain = computeMonth(s).reports[0];
    expect(plain.fuelTons).toBeGreaterThan(0);
    s = act(s, { type: 'buildTank' });
    s.oil = 0.9;
    s = act(s, { type: 'buyFuel', tons: 500 });
    s.oil = 1.4;
    const out = computeMonth(s).reports[0];
    expect(out.tankUsed).toBeCloseTo(Math.min(500, plain.fuelTons!), 4);
    expect(out.fuel).toBeLessThan(plain.fuel);
    expect(out.tankSaved).toBeCloseTo(out.tankUsed! * (1.4 - 0.9) * FUEL_TON, 6);
    // 그달 값과 산 값의 차이만큼 아낀다
    expect(plain.fuel - out.fuel).toBeCloseTo(out.tankSaved!, 6);
    const before = tankOf(s.companies[0]).stock;
    s = act(s, { type: 'endTurn' }, { type: 'endTurn' });
    expect(tankOf(s.companies[0]).stock).toBeLessThan(before);
  });

  it('탱크 연료가 그달 값보다 비싸면 더 든 돈이 음수로 남는다', () => {
    const b = burnFuel({ level: 1, stock: 100, avg: 1.5, auto: null }, 300, 1);
    expect(b.used).toBe(100);
    expect(b.saved).toBeLessThan(0);
    expect(b.cost).toBeCloseTo((100 * 1.5 + 200) * FUEL_TON, 8);
  });

  it('자동으로 사기: 유가가 보통 값 × 비율 아래일 때만, 돈을 조금 남기고 채운다', () => {
    const s = game();
    const c = { ...s.companies[0], cash: 500, fuel: { level: 2, stock: 1000, avg: 1, auto: 0.92 } };
    expect(autoBuyTons(c, 0.95, 1, 0)).toBe(0);
    const tons = autoBuyTons(c, 0.9, 1, 0);
    expect(tons).toBe(TANK_LEVELS[2].cap - 1000);
    // 돈이 적으면 50억(또는 지난달 비용의 한 달 반)을 남기고, 그 위 돈의 절반만 쓴다
    const poor = { ...c, cash: 150 };
    expect(autoBuyTons(poor, 0.9, 1, 0)).toBe(Math.floor(50 / (FUEL_TON * 0.9)));
    expect(autoBuyTons(poor, 0.9, 1, 100)).toBe(0);
    // 다음 달이 열릴 때 저절로 산다
    let g = game();
    g = act(g, { type: 'buildTank' }, { type: 'setFuelAuto', ratio: 1.2 });
    g = act(g, { type: 'endTurn' }, { type: 'endTurn' });
    expect(tankOf(g.companies[0]).stock).toBeGreaterThan(0);
    expect(g.log.some((l) => l.text.includes('자동으로 사 두기'))).toBe(true);
  });

  it('사 둔 연료와 탱크는 회사 가치에 들어간다', () => {
    let s = game();
    const v0 = companyValue(s, 0);
    s = act(s, { type: 'buildTank' }, { type: 'buyFuel', tons: 1000 });
    const paid = TANK_LEVELS[1].cost + 1000 * FUEL_TON * s.oil;
    const kept = TANK_LEVELS[1].cost * 0.6 + 1000 * FUEL_TON * s.oil;
    expect(companyValue(s, 0)).toBeCloseTo(v0 - paid + kept, 4);
  });

  it('저장에 탱크가 남고, 망가진 탱크는 거른다 (예전 저장은 탱크 없이 그대로)', () => {
    let s = game();
    expect(isValidState(s)).toBe(true);
    s = act(s, { type: 'buildTank' }, { type: 'buyFuel', tons: 300 }, { type: 'setFuelAuto', ratio: 0.92 });
    const saved = parseSaved(JSON.parse(JSON.stringify({ setup: setup(['human', 'human']), state: s, savedAt: 1 })));
    expect(saved?.state.companies[0].fuel).toEqual({ level: 1, stock: 300, avg: s.oil, auto: 0.92 });
    const broken = JSON.parse(JSON.stringify(s));
    broken.companies[0].fuel.level = 9;
    expect(isValidState(broken)).toBe(false);
  });

  it('보통 컴퓨터는 연료를 많이 쓰고 돈이 넉넉하면 탱크를 짓고 자동으로 사게 한다', () => {
    let s = game(['ai-normal', 'human']);
    for (const [a, b] of [['seoul', 'tokyo'], ['seoul', 'bangkok'], ['seoul', 'singapore']]) addRoute(s, 0, a, b, 'a330-300', 14);
    s.companies[0].cash = 9000;
    s = runMonth(s, seededRandom(2));
    expect(s.report!.companies[0].fuelTons).toBeGreaterThan(TANK_LEVELS[1].cap);
    // 컴퓨터가 크게 계획하는 달의 그 회사 차례까지
    s = toTurn(s, 0, (x) => x.t % 3 === 0);
    s.companies[0].cash = 9000;
    const managed = aiManage(s, 0, 'ai-normal', seededRandom(1));
    expect(tankOf(managed.companies[0]).level).toBeGreaterThan(0);
    expect(tankOf(managed.companies[0]).auto).not.toBeNull();
  });

  it('비서는 연료를 많이 쓰는 회사에 탱크를 권하고, 탱크가 있고 유가가 싸면 채우기를 권한다', () => {
    let s = game();
    for (const [a, b] of [['seoul', 'tokyo'], ['seoul', 'bangkok']]) addRoute(s, 0, a, b, 'a330-300', 14);
    s.companies[0].cash = 3000;
    s = act(s, { type: 'endTurn' }, { type: 'endTurn' });
    s = toTurn(s, 0);
    s.companies[0].cash = 3000;
    const tip = advise(s, 0, 20).find((a) => a.key === 'tank');
    expect(tip?.apply).toBeTruthy();
    s = tip!.apply!(s);
    expect(tankOf(s.companies[0]).level).toBe(1);
    s.oil = 0.6;
    const buy = advise(s, 0, 20).find((a) => a.key === 'fuelbuy');
    expect(buy?.apply).toBeTruthy();
    expect(tankOf(buy!.apply!(s).companies[0]).stock).toBeGreaterThan(0);
  });
});

describe('유류할증', () => {
  it('유가가 보통 값보다 높을 때만, 오른 만큼과 거리에 비례해 붙는다', () => {
    const s = game();
    // 2003년의 보통 값은 1
    expect(normalOil(s)).toBe(1);
    expect(fuelSurcharge({ ...s, oil: 0.8 }, 1000)).toBe(0);
    expect(fuelSurcharge({ ...s, oil: 1 }, 1000)).toBe(0);
    expect(surchargeText({ ...s, oil: 1 })).toBeNull();
    // 손님 한 명 1km 연료 × 오른 유가 × 1kg 값(만 원)의 60%
    const perKm = FUEL_PASS * 1 * PAX_BURN * FUEL_PRICE;
    expect(fuelSurchargeKm({ ...s, oil: 2 })).toBeCloseTo(perKm, 8);
    expect(fuelSurcharge({ ...s, oil: 2 }, 5000)).toBeCloseTo(5 * fuelSurcharge({ ...s, oil: 2 }, 1000), 8);
    expect(fuelSurcharge({ ...s, oil: 3 }, 1000)).toBeCloseTo(2 * fuelSurcharge({ ...s, oil: 2 }, 1000), 8);
    expect(surchargeText({ ...s, oil: 2 })).toBe(`${(perKm * 1000).toFixed(1)}만 원`);
    // 손님이 내는 값 = 기본 운임 + 유류할증
    expect(marketFare({ ...s, oil: 2 }, 3000)).toBeCloseTo(baseFare(3000, s.q) + perKm * 3000, 8);
    // 보통 값이 높은 시대(2010년대 1.35)에는 그보다 오른 만큼만
    const later = { ...s, t: s.t + 12 * 8 };
    expect(normalOil(later)).toBe(1.35);
    expect(fuelSurcharge({ ...later, oil: 1.35 }, 1000)).toBe(0);
    // 실제 역사를 끄면 보통 값은 언제나 1
    expect(normalOil({ ...later, options: { ...later.options, history: false } })).toBe(1);
  });

  it('달 계산: 손님 수는 그대로이고, 운임 수입이 늘어 늘어난 연료비의 일부만 메운다 (짧은 노선도 긴 노선도)', () => {
    for (const [a, b, model] of [
      ['seoul', 'tokyo', 'b737-800'],
      ['seoul', 'london', 'b787-9'],
    ] as const) {
      const s = game();
      addRoute(s, 0, a, b, model, 7);
      const low = computeMonth({ ...s, oil: 1 }, seededRandom(9)).reports[0];
      const high = computeMonth({ ...s, oil: 2 }, seededRandom(9)).reports[0];
      expect(high.pax, a + b).toBeCloseTo(low.pax, 6);
      const moreFare = high.ticket - low.ticket;
      const moreFuel = high.fuel - low.fuel;
      expect(moreFare, a + b).toBeGreaterThan(0);
      // 기름값이 뛰면 이익은 줄어든다 (다 메우지는 못한다)
      expect(moreFare, a + b).toBeLessThan(moreFuel);
      expect(moreFare / moreFuel, a + b).toBeGreaterThan(0.3);
    }
  });
});
