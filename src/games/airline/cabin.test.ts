import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL, MODELS } from './aircraft';
import {
  MAX_SEAT_RATIO,
  cabinBlocker,
  cabinPresets,
  cabinSeats,
  cabinStats,
  defaultCabin,
  economySeats,
  fixedCabin,
  maxBusiness,
} from './cabin';
import { applyAction, createGame, refitCost, runQuarter } from './rules';
import { cabinOutlook, estimateExisting, reputationTarget, splitMarket } from './simulate';
import type { AirlineSetup, AirlineState, Cabin } from './types';

function game(): AirlineState {
  const setup: AirlineSetup = {
    seats: [
      { kind: 'human', name: '' },
      { kind: 'human', name: '' },
      { kind: 'empty', name: '' },
      { kind: 'empty', name: '' },
    ],
    options: { era: 2003, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'rich', challenge: null, aiStyle: 'normal', names: 'fictional' },
    hubs: ['seoul', 'tokyo', null, null],
    airlines: [null, null, null, null],
  };
  return createGame(setup, seededRandom(1));
}

/** 서울–방콕 노선에 767 한 대 */
function withRoute(): { s: AirlineState; plane: number; route: number } {
  let s = game();
  s = applyAction(s, { type: 'openBranch', city: 'bangkok' });
  s = applyAction(s, { type: 'openRoute', a: 'seoul', b: 'bangkok' });
  s = applyAction(s, { type: 'lease', model: 'b767-300' });
  const c = s.companies[0];
  const plane = c.planes[0].id;
  const route = c.routes[0].id;
  s = applyAction(s, { type: 'assign', plane, route, freq: 7 });
  return { s, plane, route };
}

describe('좌석 배치', () => {
  it('표준 배치는 기종표 좌석 수와 같고, 모든 기종의 미리 정한 배치는 쓸 수 있다', () => {
    for (const m of MODELS) {
      expect(cabinSeats(m, defaultCabin(m)), m.id).toBe(m.seats);
      expect(cabinBlocker(m, defaultCabin(m)), m.id).toBeNull();
      for (const pr of cabinPresets(m)) {
        expect(cabinBlocker(m, pr.cabin), `${m.id} ${pr.id}`).toBeNull();
        expect(cabinSeats(m, pr.cabin), `${m.id} ${pr.id}`).toBeLessThanOrEqual(Math.round(m.seats * MAX_SEAT_RATIO));
      }
    }
  });

  it('고급 좌석을 늘리면 전체 좌석이 줄고, 일반석이 촘촘하면 늘어난다', () => {
    const m = MODEL['b777-200'];
    const std = defaultCabin(m);
    const lux: Cabin = { first: 8, business: 60, pitch: 2 };
    expect(cabinSeats(m, lux)).toBeLessThan(cabinSeats(m, std));
    expect(economySeats(m, { ...std, pitch: 0 })).toBeGreaterThan(economySeats(m, std));
    expect(cabinSeats(m, { first: 0, business: 0, pitch: 0 })).toBeGreaterThan(m.seats);
  });

  it('작은 비행기에는 일등석이 없고, 초음속기는 바꿀 수 없다', () => {
    expect(cabinBlocker(MODEL.a320, { first: 4, business: 12, pitch: 1 })).toContain('큰 비행기');
    expect(cabinBlocker(MODEL.a320, { first: 0, business: maxBusiness(MODEL.a320, { first: 0, business: 0, pitch: 1 }) + 1, pitch: 1 })).toContain('까지');
    expect(fixedCabin(MODEL.concorde)).toBe(true);
    expect(cabinBlocker(MODEL.concorde, { first: 0, business: 10, pitch: 1 })).toContain('바꿀 수 없어요');
    expect(cabinPresets(MODEL.concorde)).toEqual([]);
  });

  it('사업 손님이 많은 먼 길에서는 비즈니스석을 늘리면 사업 손님이 더 고르고 수입이 는다', () => {
    const s = game();
    const m = MODEL['b777-200'];
    const offer = (cab: Cabin) => splitMarket(s, 'london', 'newyork', [{ company: 0, fare: 0, planes: [{ model: m, freq: 7, age: 0, cab: cabinStats(m, cab, 3) }] }])[0];
    const std = offer(defaultCabin(m));
    const prem = offer({ first: 0, business: 64, pitch: 1 });
    const dense = offer({ first: 0, business: 0, pitch: 0 });
    expect(prem.biz).toBeGreaterThan(std.biz);
    expect(prem.revenue).toBeGreaterThan(std.revenue);
    expect(dense.seats).toBeGreaterThan(std.seats);
    expect(dense.biz).toBeLessThan(std.biz);
    expect(prem.premSeats).toBe(64 * 7);
    expect(prem.premPax).toBeLessThanOrEqual(prem.premSeats);
  });

  it('좌석 배치는 받은 분기에 공짜, 그 뒤에는 새 값의 2%가 들고, 같은 기종 모두 바꿀 수 있다', () => {
    let { s, plane } = withRoute();
    const m = MODEL['b767-300'];
    const lux: Cabin = { first: 8, business: 30, pitch: 2 };
    const cash = s.companies[0].cash;
    s = applyAction(s, { type: 'setCabin', plane, cabin: lux });
    expect(s.companies[0].planes[0].cabin).toEqual(lux);
    expect(s.companies[0].cash).toBe(cash);
    expect(s.events.some((e) => e.type === 'cabin')).toBe(true);
    // 같은 배치는 아무 일도 없다
    expect(applyAction(s, { type: 'setCabin', plane, cabin: lux })).toBe(s);
    // 한 대 더 받고 분기를 넘기면 값이 든다
    s = applyAction(s, { type: 'lease', model: 'b767-300' });
    s = applyAction(s, { type: 'endTurn' });
    s = applyAction(s, { type: 'endTurn' });
    // 다음 분기에는 순서가 바뀔 수 있으니 0번 회사 차례로
    s = { ...s, turnPos: s.order.indexOf(0) };
    const p = s.companies[0].planes[0];
    const cost = refitCost(s, p, defaultCabin(m));
    expect(cost).toBe(Math.round(m.price * 0.02));
    const before = s.companies[0].cash;
    s = applyAction(s, { type: 'setCabin', plane, cabin: defaultCabin(m), all: true });
    // 두 번째 비행기는 이미 표준이라 한 대 값만
    expect(s.companies[0].cash).toBeCloseTo(before - cost, 6);
    expect(s.companies[0].planes.every((x) => x.cabin.business === defaultCabin(m).business)).toBe(true);
    // 이상한 배치는 막는다
    expect(applyAction(s, { type: 'setCabin', plane, cabin: { first: 0, business: 999, pitch: 1 } })).toBe(s);
  });

  it('기내식은 비행기마다, 기본값은 모든 비행기에 한꺼번에', () => {
    let { s, plane } = withRoute();
    s = applyAction(s, { type: 'lease', model: 'a320' });
    s = applyAction(s, { type: 'setMeal', plane, level: 5 });
    expect(s.companies[0].planes.find((p) => p.id === plane)!.meal).toBe(5);
    expect(s.companies[0].planes.find((p) => p.id !== plane)!.meal).toBe(3);
    expect(applyAction(s, { type: 'setMeal', plane, level: 9 })).toBe(s);
    s = applyAction(s, { type: 'setService', level: 2 });
    expect(s.companies[0].service).toBe(2);
    expect(s.companies[0].planes.every((p) => p.meal === 2)).toBe(true);
    // 새 비행기도 기본값으로 시작
    s = applyAction(s, { type: 'lease', model: 'a320' });
    expect(s.companies[0].planes.at(-1)!.meal).toBe(2);
  });

  it('좋은 기내식은 비용이 들지만 평판 목표를 올리고, 미리보기는 실제 어림과 같다', () => {
    const { s, plane, route } = withRoute();
    const c = s.companies[0];
    const low = { ...c, planes: c.planes.map((p) => ({ ...p, meal: 1 })) };
    const high = { ...c, planes: c.planes.map((p) => ({ ...p, meal: 5 })) };
    expect(reputationTarget(s, high)).toBeGreaterThan(reputationTarget(s, low));
    const o = cabinOutlook(s, 0, plane, c.planes[0].cabin, c.planes[0].meal);
    expect(o.now).toBeCloseTo(estimateExisting(s, 0, c.routes.find((r) => r.id === route)!).profit, 6);
    expect(o.next).toBeCloseTo(o.now, 6);
    const pricey = cabinOutlook(s, 0, plane, c.planes[0].cabin, 5);
    expect(pricey.next).not.toBeCloseTo(o.now, 3);
  });

  it('분기를 넘기면 고급 좌석 탑승률이 노선 결과에 남는다', () => {
    const { s } = withRoute();
    const t = runQuarter({ ...s, turnPos: 0 }, seededRandom(2));
    const st = t.companies[0].routes[0].stats!;
    expect(st.premLf).toBeGreaterThan(0);
    expect(st.premLf).toBeLessThanOrEqual(1);
  });
});
