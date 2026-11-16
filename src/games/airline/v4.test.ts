import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL } from './aircraft';
import { advise, applyAdvice } from './advisor';
import { aiTurn, planTurn } from './ai';
import { BIZ_CHANGE_MONTHS, CARGO_NAMES, LCC_NAMES, bizChangeCost, leisureStimulus } from './bizmodel';
import { cabinStats } from './cabin';
import { allocateClasses, classShares } from './classes';
import { CARGO_MONTH, bellyT, cargoDemand, planeCargoT } from './cargo';
import { applyFares, recommendFares } from './fares';
import { FREIGHTERS, availableFreighters, isFreighter } from './freighters';
import { FREIGHTER_SHAPES } from './freighterShapes';
import { migrateV3 } from './migrate4';
import { NEUTRAL_LIVERY, renderPlaneSvg } from './plane3d';
import { SHAPES } from './aircraftShapes';
import { actor, applyAction, cabinChangeBlocker, createGame, proposeBlocker } from './rules';
import { companyValue, computeMonth, estimateRoute, maxFreqFor, pairDemand, splitMarket } from './simulate';
import { isValidState, parseSaved } from './storage';
import { mOf, yearOf } from './time';
import type { AirlineSetup, AirlineState, BizModel, SeatKind } from './types';

function setup(kinds: SeatKind[], options: Partial<AirlineSetup['options']> = {}, hubs: (string | null)[] = [], models: (BizModel | null)[] = []): AirlineSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as AirlineSetup['seats'],
    options: { era: 2003, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'rich', challenge: null, aiStyle: 'normal', names: 'fictional', ...options },
    hubs: [0, 1, 2, 3].map((i) => hubs[i] ?? null),
    airlines: [null, null, null, null],
    models: [0, 1, 2, 3].map((i) => models[i] ?? null),
  };
}

/** 사람 둘 (0번이 고른 사업 모델), 서울·도쿄 */
function duo(model: BizModel = 'full', era: 1963 | 1983 | 2003 = 2003): AirlineState {
  return createGame(setup(['human', 'human'], { era }, ['seoul', 'tokyo'], [model, null]), seededRandom(1));
}

/** 0번 회사가 서울–a 노선을 열고 기종 하나를 리스해 띄운다 */
function flyRoute(s0: AirlineState, b: string, model: string, freq = 7): { s: AirlineState; plane: number; route: number } {
  let s = applyAction(s0, { type: 'openBranch', city: b });
  s = applyAction(s, { type: 'openRoute', a: 'seoul', b });
  s = applyAction(s, { type: 'lease', model });
  const c = s.companies[0];
  const plane = c.planes[c.planes.length - 1].id;
  const route = c.routes[c.routes.length - 1].id;
  s = applyAction(s, { type: 'assign', plane, route, freq });
  return { s, plane, route };
}

describe('등급별 수요', () => {
  it('옛날에는 일등석, 1979년부터 비즈니스석, 고급 좌석 손님은 갈수록·멀수록 많다', () => {
    const early = classShares(1965, 8000);
    expect(early.fB).toBeGreaterThan(0);
    expect(early.cB).toBe(0);
    const later = classShares(1995, 8000);
    expect(later.cB).toBeGreaterThan(later.fB);
    expect(classShares(2020, 8000).cB + classShares(2020, 8000).fB).toBeGreaterThan(early.fB);
    expect(classShares(2020, 8000).cL).toBeGreaterThan(classShares(1990, 8000).cL);
    expect(classShares(2005, 9000).cB).toBeGreaterThan(classShares(2005, 900).cB);
  });

  it('자리가 차면 아래 등급으로, 일반석이 차면 남은 고급 좌석에 일반석 값으로', () => {
    const sh = classShares(2005, 9000);
    // 일등석 2석뿐: 넘친 일등석 손님은 비즈니스석으로
    const tight = allocateClasses({ first: 2, business: 400, econ: 2000 }, 1000, 1000, sh, 0, 0);
    const roomy = allocateClasses({ first: 200, business: 400, econ: 2000 }, 1000, 1000, sh, 0, 0);
    expect(tight.f).toBe(2);
    expect(tight.c).toBeGreaterThan(roomy.c);
    // 일반석이 모자라면 남은 비즈니스석에 일반석 손님이 앉는다
    const full = allocateClasses({ first: 0, business: 300, econ: 500 }, 400, 1500, sh, 0, 0);
    expect(full.yB + full.yL).toBeGreaterThan(500);
    expect(full.upC).toBeGreaterThan(0);
    expect(full.c + full.upC).toBeLessThanOrEqual(300 + 1e-9);
    // 고급 좌석이 아예 없으면 모두 일반석으로 내려간다 (잃는 손님 없음)
    const none = allocateClasses({ first: 0, business: 0, econ: 5000 }, 1000, 1000, sh, 0, 0);
    expect(none.b + none.l).toBeCloseTo(2000, 6);
  });

  it('등급 운임을 올리면 그 등급 손님이 줄고 일부는 일반석으로, 일등석 손님은 덜 민감하다', () => {
    const sh = classShares(1990, 9000);
    const caps = { first: 500, business: 500, econ: 5000 };
    const base = allocateClasses(caps, 1000, 1000, sh, 0, 0);
    const c20 = allocateClasses(caps, 1000, 1000, sh, 0, 20);
    const f20 = allocateClasses(caps, 1000, 1000, sh, 20, 0);
    expect(c20.c).toBeLessThan(base.c);
    expect(c20.yB).toBeGreaterThan(base.yB);
    expect(f20.f / base.f).toBeGreaterThan(c20.c / base.c);
    // 싸게 팔면 늘어난다
    expect(allocateClasses(caps, 1000, 1000, sh, 0, -20).c).toBeGreaterThan(base.c);
  });

  it('시장 나누기: 등급별 수입을 더하면 운임 수입, 꽉 찬 비즈니스석은 비싸게 팔면 더 번다', () => {
    const s = duo();
    const m = MODEL['b777-200'];
    const cab = cabinStats(m, { first: 0, business: 30, pitch: 1 }, 3);
    const offer = (fareC: number) => splitMarket(s, 'london', 'newyork', [{ company: 0, fare: 0, fareC, planes: [{ model: m, freq: 7, age: 0, cab }] }])[0];
    const r0 = offer(0);
    expect(r0.cls.rev.reduce((a, b) => a + b, 0) + r0.cargoRev + r0.ancillary).toBeCloseTo(r0.revenue, 9);
    expect(r0.cls.pax[1]).toBeGreaterThan(0);
    // 비즈니스석이 꽉 찼으면 올려도 손님이 차고 수입이 는다
    if (r0.cls.pax[1] >= r0.cls.seats[1] - 1e-6) expect(offer(15).cls.rev[1]).toBeGreaterThan(r0.cls.rev[1]);
  });
});

describe('등급별 운임 정하기와 추천 운임', () => {
  it('비즈니스석·일등석·화물 운임은 따로, 범위를 넘으면 막는다', () => {
    const { s, route } = flyRoute(duo(), 'bangkok', 'b767-300');
    const t = applyAction(s, { type: 'setFare', route, fare: 15, cls: 'c' });
    const r = t.companies[0].routes.find((x) => x.id === route)!;
    expect(r.fareC).toBe(15);
    expect(r.fare).toBe(0);
    expect(applyAction(t, { type: 'setFare', route, fare: 50, cls: 'c' })).toBe(t);
    expect(applyAction(t, { type: 'setFare', route, fare: -35, cls: 'k' })).toBe(t);
    const k = applyAction(t, { type: 'setFare', route, fare: -10, cls: 'k' });
    expect(k.companies[0].routes.find((x) => x.id === route)!.fareK).toBe(-10);
  });

  it('추천 운임은 지금보다 못하지 않고, 한꺼번에 적용할 수 있다', () => {
    const { s, route } = flyRoute(duo(), 'tokyo', 'b767-300', 14);
    const r = s.companies[0].routes.find((x) => x.id === route)!;
    const adv = recommendFares(s, 0, r);
    expect(adv.profit).toBeGreaterThanOrEqual(adv.now - 1e-9);
    expect(adv.keys).toContain('y');
    const t = applyFares(s, route, adv.fares);
    const r2 = t.companies[0].routes.find((x) => x.id === route)!;
    expect(r2.fare).toBe(adv.fares.y);
    expect(r2.fareC ?? 0).toBe(adv.fares.c);
  });
});

describe('사업 모델', () => {
  it('저가항공: 한 등급 촘촘한 좌석, 제휴·고급 좌석 안 됨, 화물칸 없음, 비용이 싸고 비행기를 빨리 돌리고 부가 수입', () => {
    const lcc = flyRoute(duo('lcc'), 'osaka', 'a320', 14);
    const full = flyRoute(duo('full'), 'osaka', 'a320', 14);
    const p = lcc.s.companies[0].planes[0];
    expect(p.cabin).toEqual({ first: 0, business: 0, pitch: 0 });
    expect(lcc.s.companies[0].service).toBe(1);
    expect(cabinChangeBlocker(lcc.s, 0, p.id, { first: 0, business: 12, pitch: 1 })).toContain('저가항공');
    expect(proposeBlocker(lcc.s, 0, 1)).toContain('저가항공');
    const e1 = estimateRoute(lcc.s, 0, 'seoul', 'osaka', [{ model: 'a320', freq: 14 }], 0);
    const e2 = estimateRoute(full.s, 0, 'seoul', 'osaka', [{ model: 'a320', freq: 14 }], 0);
    expect(e1.seatsWeek).toBeGreaterThan(e2.seatsWeek);
    expect(e1.cargoCap).toBe(0);
    expect(e2.cargoCap).toBeGreaterThan(0);
    expect(e1.ancillary).toBeGreaterThan(0);
    expect(e2.ancillary).toBe(0);
    expect(e1.cost.crew).toBeLessThan(e2.cost.crew);
    expect(e1.cost.sales / Math.max(1, e1.revenue)).toBeLessThan(e2.cost.sales / Math.max(1, e2.revenue));
    // 빨리 돌려서 같은 비행기로 더 자주
    const lccMax = maxFreqFor(lcc.s.companies[0], lcc.s.companies[0].planes[0], lcc.route);
    const fullMax = maxFreqFor(full.s.companies[0], full.s.companies[0].planes[0], full.route);
    expect(lccMax).toBeGreaterThanOrEqual(fullMax);
    // 화물기·초음속기는 못 들인다
    expect(applyAction(lcc.s, { type: 'lease', model: 'b777f' })).toBe(lcc.s);
  });

  it('저가항공은 사업 손님을 덜 끌고, 1978년 규제가 풀린 뒤로는 관광 손님을 늘린다', () => {
    const s = duo();
    const m = MODEL.a320;
    const cab = { seats: 150, prem: 0, first: 0, econ: 150, pitch: 1 as const, meal: 1, fixed: false };
    const lccState = { ...s, companies: s.companies.map((c, i) => (i === 0 ? { ...c, bizModel: 'lcc' as const } : c)) };
    const pl = [{ model: m, freq: 14, age: 0, cab }];
    const asFull = splitMarket(s, 'seoul', 'tokyo', [{ company: 0, fare: 0, planes: pl }])[0];
    const asLcc = splitMarket(lccState, 'seoul', 'tokyo', [{ company: 0, fare: 0, planes: pl }])[0];
    expect(asLcc.biz).toBeLessThan(asFull.biz);
    expect(leisureStimulus(1970)).toBe(1);
    expect(leisureStimulus(2005)).toBeGreaterThan(1.4);
  });

  it('저가항공 노선에는 갈아타는 손님이 타지 않는다', () => {
    let s = duo('lcc');
    s = flyRoute(s, 'bangkok', 'a321').s;
    s = flyRoute(s, 'tokyo', 'a321').s;
    s = applyAction(s, { type: 'endTurn' });
    s = applyAction(s, { type: 'endTurn' });
    expect(s.companies[0].routes.every((r) => (r.stats?.xfer ?? 0) === 0)).toBe(true);
    expect(s.report!.companies[0].ancillary).toBeGreaterThan(0);
  });

  it('사업 모델 바꾸기: 돈을 내고 여섯 달 뒤에 바뀌며, 저가항공이 되면 좌석이 바뀌고 화물기는 노선에서 빠진다', () => {
    let { s } = flyRoute(duo('full'), 'hongkong', 'b767-300');
    s = flyRoute(s, 'tokyo', 'b767-300f', 5).s;
    const c0 = s.companies[0];
    expect(c0.planes.some((p) => isFreighter(MODEL[p.model]) && p.legs.length > 0)).toBe(true);
    const cost = bizChangeCost(c0, 'lcc');
    const t = applyAction(s, { type: 'setBizModel', model: 'lcc' });
    expect(t.companies[0].cash).toBeCloseTo(c0.cash - cost, 6);
    expect(t.companies[0].bizModelNext).toEqual({ model: 'lcc', t: s.t + BIZ_CHANGE_MONTHS });
    expect(t.companies[0].bizModel).toBe('full');
    // 바꾸는 중에는 다른 모델로 또 바꿀 수 없고, 지금 모델을 고르면 그만둔다
    expect(applyAction(t, { type: 'setBizModel', model: 'cargo' })).toBe(t);
    expect(applyAction(t, { type: 'setBizModel', model: 'full' }).companies[0].bizModelNext).toBeNull();
    let u = t;
    for (let k = 0; k < BIZ_CHANGE_MONTHS * 2 + 2 && u.t < s.t + BIZ_CHANGE_MONTHS; k++) u = applyAction({ ...u, turnPos: u.turnPos }, { type: 'endTurn' });
    const c = u.companies[0];
    expect(c.bizModel).toBe('lcc');
    expect(c.bizModelNext).toBeNull();
    for (const p of c.planes) {
      if (isFreighter(MODEL[p.model])) expect(p.legs).toEqual([]);
      else expect(p.cabin.business + p.cabin.first).toBe(0);
    }
    expect(u.news.some((n) => n.title.includes('저가항공'))).toBe(true);
  });

  it('화물 전문은 화물기만, 풀서비스는 둘 다 들인다', () => {
    const cargo = duo('cargo');
    expect(applyAction(cargo, { type: 'lease', model: 'b767-300' })).toBe(cargo);
    const t = applyAction(cargo, { type: 'lease', model: 'b767-300f' });
    expect(t.companies[0].planes).toHaveLength(1);
    const full = duo('full');
    expect(applyAction(full, { type: 'lease', model: 'b767-300f' }).companies[0].planes).toHaveLength(1);
  });

  it('사람과 셋 넘게 겨루면 가끔 컴퓨터 하나가 지어낸 이름의 저가항공(1988년부터)·화물 전문이 된다', () => {
    let lcc = 0;
    let cargo = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const era = seed % 2 ? 2003 : 1983;
      const s = createGame({ ...setup(['human', 'ai-normal', 'ai-easy', 'ai-normal'], { era, names: 'real' }), airlines: [null, null, null, null] }, seededRandom(seed));
      const special = s.companies.filter((c) => c.bizModel !== 'full');
      expect(special.length).toBeLessThanOrEqual(1);
      for (const c of special) {
        expect(c.kind).not.toBe('human');
        expect(c.airline).toBeNull();
        expect([...LCC_NAMES, ...CARGO_NAMES] as string[]).toContain(c.name);
        if (c.bizModel === 'lcc') {
          expect(era).toBeGreaterThanOrEqual(1988);
          lcc++;
        } else cargo++;
      }
      // 사람은 고르지 않으면 풀서비스
      expect(s.companies[0].bizModel).toBe('full');
    }
    expect(lcc + cargo).toBeGreaterThan(0);
    // 컴퓨터끼리 둘이면 모두 풀서비스
    const two = createGame(setup(['ai-normal', 'ai-easy']), seededRandom(3));
    expect(two.companies.every((c) => c.bizModel === 'full')).toBe(true);
  });
});

describe('화물', () => {
  it('넓은 동체는 배 아래 짐칸이 크고, 화물기는 훨씬 많이 싣는다. 저가항공은 짐칸 화물을 받지 않는다', () => {
    expect(bellyT(MODEL['b777-200'])).toBeGreaterThan(bellyT(MODEL.a320) * 3);
    expect(MODEL.b777f.cargo!).toBeGreaterThan(bellyT(MODEL['b777-200']) * 5);
    expect(planeCargoT(MODEL.a320, 'lcc')).toBe(0);
    expect(planeCargoT(MODEL.b777f, 'full')).toBe(MODEL.b777f.cargo);
    // 실제로 있던 화물기들: 해마다 고를 수 있는 것이 있다
    expect(availableFreighters(1965).map((m) => m.id)).toContain('b707-320c');
    expect(availableFreighters(1995).map((m) => m.id)).toEqual(expect.arrayContaining(['b747-400f', 'md11f', 'b767-300f']));
    expect(availableFreighters(2015).map((m) => m.id)).toEqual(expect.arrayContaining(['b777f', 'b747-8f', 'a330-200f']));
    for (const m of FREIGHTERS) {
      expect(m.seats).toBe(0);
      expect(m.cargo).toBeGreaterThan(10);
      expect(m.intro).toBeLessThanOrEqual(m.end);
      expect(MODEL[m.id]).toBe(m);
    }
  });

  it('화물기만 나는 노선: 좌석은 없고 화물 수입과 화물 탑승률이 남는다', () => {
    let s = duo('full');
    s = flyRoute(s, 'hongkong', 'b767-300f', 7).s;
    const route = s.companies[0].routes[0].id;
    const e = estimateRoute(s, 0, 'seoul', 'hongkong', [{ model: 'b767-300f', freq: 7 }], 0);
    expect(e.seatsWeek).toBe(0);
    expect(e.paxWeek).toBe(0);
    expect(e.cargoT).toBeGreaterThan(0);
    expect(e.cargoRev).toBeGreaterThan(0);
    expect(e.revenue).toBeCloseTo(e.cargoRev, 9);
    s = applyAction(applyAction(s, { type: 'endTurn' }), { type: 'endTurn' });
    const st = s.companies[0].routes.find((r) => r.id === route)!.stats!;
    expect(st.cargo!.cap).toBeGreaterThan(0);
    expect(st.lf).toBeCloseTo(st.cargo!.t / st.cargo!.cap, 6);
    expect(s.report!.companies[0].cargo).toBeGreaterThan(0);
    expect(s.report!.companies[0].cargo).toBeLessThanOrEqual(s.report!.companies[0].ticket + 1e-9);
  });

  it('화물은 10~12월에 가장 많고, 기름값이 오르면 줄고, 시대가 갈수록 는다', () => {
    const s = duo();
    const nov = cargoDemand(s, 'hongkong', 'frankfurt', mOf(2005, 11));
    const feb = cargoDemand(s, 'hongkong', 'frankfurt', mOf(2005, 2));
    expect(nov).toBeGreaterThan(feb * 1.2);
    expect(Math.max(...CARGO_MONTH)).toBe(CARGO_MONTH[10]);
    expect(cargoDemand(s, 'hongkong', 'frankfurt', mOf(2015, 6))).toBeGreaterThan(cargoDemand(s, 'hongkong', 'frankfurt', mOf(1975, 6)) * 2);
    // 기름값
    const m = MODEL['b777f'];
    const pl = [{ model: m, freq: 7, age: 0 }];
    const cheap = splitMarket({ ...s, oil: 0.8 }, 'hongkong', 'frankfurt', [{ company: 0, fare: 0, planes: pl }])[0];
    const dear = splitMarket({ ...s, oil: 2.2 }, 'hongkong', 'frankfurt', [{ company: 0, fare: 0, planes: pl }])[0];
    expect(dear.cargoT).toBeLessThan(cheap.cargoT);
  });

  it('화물기 그림: 모든 화물기를 숫자 오류 없이, 손님 창문 없이 그린다', () => {
    for (const m of FREIGHTERS) {
      const shape = FREIGHTER_SHAPES[m.id];
      expect(shape, m.id).toBeDefined();
      const svg = renderPlaneSvg(shape, NEUTRAL_LIVERY);
      expect(svg).not.toContain('NaN');
      expect(svg).not.toBe(renderPlaneSvg(SHAPES[m.base!], NEUTRAL_LIVERY));
    }
  });
});

describe('4판 저장', () => {
  it('3판 저장은 4판으로: 풀서비스, 일반석 운임은 그대로, 고급 좌석 운임은 예전처럼 같은 %로, 화물 운임은 0', () => {
    let { s } = flyRoute(duo(), 'bangkok', 'b767-300');
    s = applyAction(s, { type: 'setFare', route: s.companies[0].routes[0].id, fare: 15 });
    s = applyAction(applyAction(s, { type: 'endTurn' }), { type: 'endTurn' });
    const v3 = JSON.parse(JSON.stringify(s));
    v3.version = 3;
    for (const c of v3.companies) {
      delete c.bizModel;
      delete c.bizModelNext;
      for (const r of c.routes) {
        delete r.fareC;
        delete r.fareF;
        delete r.fareK;
        if (r.stats) {
          delete r.stats.cls;
          delete r.stats.cargo;
        }
      }
    }
    for (const rep of [v3.report, ...v3.ledger]) for (const r of rep.companies) for (const k of ['cargo', 'ancillary', 'cargoT', 'cargoCap', 'paxF', 'paxC', 'revF', 'revC']) delete r[k];
    expect(isValidState(v3)).toBe(false);
    const m = migrateV3(v3) as AirlineState;
    expect(m.version).toBe(4);
    expect(m.companies.every((c) => c.bizModel === 'full')).toBe(true);
    const r = m.companies[0].routes[0];
    expect(r.fare).toBe(15);
    expect(r.fareC).toBe(15);
    expect(r.fareF).toBe(15);
    expect(r.fareK).toBe(0);
    expect(m.report!.companies[0].cargo).toBe(0);
    const saved = parseSaved({ setup: setup(['human', 'human']), state: v3, savedAt: 1 });
    expect(saved).not.toBeNull();
    expect(isValidState(saved!.state)).toBe(true);
    // 이어서 할 수 있다
    let t = saved!.state;
    for (let k = 0; k < 4; k++) t = applyAction(t, { type: 'endTurn' });
    expect(t.t).toBe(saved!.state.t + 2);
    // 이상한 사업 모델·운임은 버린다
    const bad = JSON.parse(JSON.stringify(s));
    bad.companies[0].bizModel = 'zeppelin';
    expect(isValidState(bad)).toBe(false);
    const bad2 = JSON.parse(JSON.stringify(s));
    bad2.companies[0].routes[0].fareC = 99;
    expect(isValidState(bad2)).toBe(false);
  });

  it('설정 저장의 사업 모델은 사람 자리 것만 남는다', () => {
    const s = createGame(setup(['human', 'human'], {}, ['seoul', 'tokyo'], ['lcc', 'cargo']), seededRandom(2));
    expect(s.companies.map((c) => c.bizModel)).toEqual(['lcc', 'cargo']);
    const saved = parseSaved({ setup: setup(['human', 'human'], {}, [], ['lcc', 'bogus' as BizModel]), state: s, savedAt: 1 })!;
    expect(saved.setup.models).toEqual(['lcc', null, null, null]);
  });
});

describe('컴퓨터와 경영 비서', () => {
  it('저가항공·화물 전문 컴퓨터가 정한 행동도 모두 규칙에 맞다', () => {
    for (const seed of [4, 5]) {
      const rng = seededRandom(seed);
      let s = createGame(setup(['ai-normal', 'ai-normal', 'ai-easy'], {}, ['seoul', 'hongkong', 'london'], ['lcc', 'cargo', 'full']), rng);
      expect(s.companies.map((c) => c.bizModel)).toEqual(['lcc', 'cargo', 'full']);
      for (let turn = 0; turn < 30; turn++) {
        const ci = actor(s);
        const level = s.companies[ci].kind === 'ai-easy' ? 'ai-easy' : 'ai-normal';
        const actions = planTurn(s, ci, level, seededRandom(seed * 100 + turn));
        let t = s;
        for (const a of actions) {
          const next = applyAction(t, a);
          expect(next, JSON.stringify(a)).not.toBe(t);
          t = next;
        }
        s = applyAction(t, { type: 'endTurn' }, rng);
      }
      const [lcc, cargo] = s.companies;
      expect(lcc.planes.every((p) => !isFreighter(MODEL[p.model]) && p.cabin.business === 0 && p.cabin.first === 0)).toBe(true);
      expect(cargo.planes.every((p) => isFreighter(MODEL[p.model]))).toBe(true);
    }
  });

  it('저가항공·화물 전문 컴퓨터가 섞인 판도 끝까지 가고, 모두 자라며, 보통이 쉬움보다 크다', () => {
    const rng = seededRandom(77);
    let s = createGame(setup(['ai-normal', 'ai-normal', 'ai-normal', 'ai-easy'], { years: 10 }, ['tokyo', 'london', 'hongkong', 'newyork'], ['full', 'lcc', 'cargo', null]), rng);
    let turns = 0;
    let worst = 0;
    while (s.phase !== 'gameover' && turns < 2000) {
      const t0 = performance.now();
      s = aiTurn(s, rng);
      worst = Math.max(worst, performance.now() - t0);
      turns++;
    }
    expect(s.phase).toBe('gameover');
    expect(yearOf(s.q)).toBe(2012);
    for (let i = 0; i < 4; i++) expect(Number.isFinite(companyValue(s, i))).toBe(true);
    const [full, lcc, cargo, easy] = s.companies;
    expect(full.out || lcc.out || cargo.out).toBe(false);
    expect(lcc.routes.length).toBeGreaterThan(5);
    expect(cargo.routes.length).toBeGreaterThan(5);
    const last = s.years[s.years.length - 1];
    expect(last.companies[1].ancillary).toBeGreaterThan(0);
    expect(last.companies[2].cargo).toBeCloseTo(last.companies[2].ticket, 6);
    expect(last.companies[0].revF + last.companies[0].revC).toBeGreaterThan(0);
    expect(companyValue(s, 0)).toBeGreaterThan(companyValue(s, 3));
    expect(easy.bizModel).toBe('full');
    expect(worst).toBeLessThan(900);
  }, 60000);

  it('한 달 계산과 컴퓨터 한 차례는 빠르다', () => {
    const rng = seededRandom(9);
    let s = createGame(setup(['ai-normal', 'ai-normal', 'ai-easy'], {}, ['seoul', 'london', 'newyork']), rng);
    for (let k = 0; k < 3 * 12 * 6; k++) s = aiTurn(s, rng);
    const t0 = performance.now();
    for (let k = 0; k < 5; k++) computeMonth(s);
    const month = (performance.now() - t0) / 5;
    let ai = 0;
    let n = 0;
    for (let k = 0; k < 24; k++) {
      const t1 = performance.now();
      s = aiTurn(s, rng);
      ai += performance.now() - t1;
      n++;
    }
    // 함께 도는 테스트 때문에 튀는 것을 넉넉히 봐준다 (혼자 돌면 달 10ms·차례 15ms 안팎)
    expect(month).toBeLessThan(120);
    expect(ai / n).toBeLessThan(150);
  }, 60000);

  it('경영 비서의 등급별 운임 조언은 규칙에 맞는 상태를 만든다', () => {
    let { s } = flyRoute(duo(), 'losangeles', 'b777-200', 7);
    s = flyRoute(s, 'tokyo', 'b767-300', 14).s;
    for (let k = 0; k < 4; k++) s = applyAction(applyAction(s, { type: 'endTurn' }), { type: 'endTurn' });
    s = { ...s, turnPos: s.order.indexOf(0) };
    const tips = advise(s, 0, 10);
    for (const tip of tips) {
      if (!tip.apply) continue;
      const next = tip.apply(s);
      expect(isValidState(next)).toBe(true);
    }
    expect(pairDemand(s, 'seoul', 'tokyo').biz).toBeGreaterThan(0);
  });
});

describe('경영 비서: 새 비행기 주문 권유', () => {
  it('주문하고 나면 같은 노선에 또 주문하라고 권하지 않는다 (오고 있는 비행기가 그 노선을 맡는다)', () => {
    const rng = seededRandom(7);
    let s = createGame(setup(['ai-normal', 'ai-normal', 'ai-normal', 'ai-normal'], { era: 1983, years: 20, money: 'normal' }), rng);
    let checked = 0;
    for (let turn = 0; turn < 300 && s.phase === 'manage' && checked < 3; turn++) {
      const ci = actor(s);
      const tip = advise(s, ci, 99).find((a) => a.key.startsWith('orderfull-'));
      if (tip) {
        const next = applyAdvice(tip, s);
        expect(next.why).toBeNull();
        expect(next.state.companies[ci].orders.length).toBe(s.companies[ci].orders.length + 1);
        // 같은 노선(같은 열쇠)을 또 권하지 않는다: 다른 꽉 찬 노선이 남았으면 그 노선을 권한다
        const again = advise(next.state, ci, 99).filter((a) => a.key.startsWith('orderfull-'));
        expect(again.map((a) => a.key)).not.toContain(tip.key);
        expect(again.map((a) => a.title)).not.toContain(tip.title);
        checked++;
      }
      s = aiTurn(s, rng);
    }
    expect(checked).toBeGreaterThan(0);
  }, 60000);
});
