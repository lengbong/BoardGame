import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL, fitsBizModel, isFreighter } from './aircraft';
import { aiTurn } from './ai';
import { C_SPACE, F_SPACE, allocateClasses, cabinSpace, classShares, presetBlocker, presetCabin, refitCost, seatsOf } from './cabin';
import { CARGO_MONTH, bellyT, cargoDemand, oilCargoMult, planeCargoT } from './cargo';
import { applyAction, buyBlocker, cabinBlocker, createGame, modelBlocker, proposeBlocker, runMonth, MODEL_SWITCH_MONTHS } from './rules';
import { computeMonth, estimateExisting, planeHours, splitMarket, type Offer } from './simulate';
import { migrateV3 } from './storage';
import { defaultTimes } from './timetable';
import { mOf } from './time';
import type { AirlineOptions, AirlineSetup, AirlineState, BizModel, CabinPreset, SeatKind } from './types';

function setup(kinds: SeatKind[], options: Partial<AirlineOptions> = {}, hubs: (string | null)[] = []): AirlineSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as AirlineSetup['seats'],
    options: { era: 2003, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'normal', names: 'fictional', ...options },
    hubs: [0, 1, 2, 3].map((i) => hubs[i] ?? null),
    airlines: [null, null, null, null],
  };
}

/** 사람 둘 (0번 회사 사업 모델을 정하고), 0번 회사에 노선 하나와 비행기 한 대 */
function game(to: string, model = 'b777-200', preset: CabinPreset = 'two', biz: BizModel = 'full', from = 'seoul', era: AirlineOptions['era'] = 2003, freq = 7): { s: AirlineState; route: number; plane: number } {
  const s = createGame(setup(['human', 'human'], { era }, [from, from === 'london' ? 'paris' : 'london']), seededRandom(3));
  const c = s.companies[0];
  c.model = biz;
  c.cash = 5000;
  if (!c.branches.includes(to)) c.branches.push(to);
  const route = s.nextId++;
  c.routes.push({ id: route, a: from, b: to, fare: 0, since: s.t, stats: null, times: defaultTimes(from, to, era) });
  const plane = s.nextId++;
  c.planes.push({ id: plane, model, leased: false, rent: 0, deposit: 0, since: s.t, legs: [{ route, freq }], cabin: presetCabin(MODEL[model], preset, era) });
  return { s, route, plane };
}

describe('좌석 등급: 배치', () => {
  it('본보기마다 넓이를 지킨다 (일등석 3.5석, 비즈니스 2석), 고밀도는 좌석이 더 많다', () => {
    const m = MODEL['b777-200'];
    const S = cabinSpace(m);
    const space = (p: CabinPreset, y = 2003) => {
      const c = presetCabin(m, p, y);
      return c.f * F_SPACE + c.c * C_SPACE + c.y;
    };
    for (const p of ['three', 'two', 'eco'] as const) expect(Math.abs(space(p) - S)).toBeLessThanOrEqual(3);
    const dense = presetCabin(m, 'dense', 2003);
    expect(seatsOf(dense)).toBeGreaterThan(seatsOf(presetCabin(m, 'eco', 2003)));
    expect(seatsOf(presetCabin(m, 'three', 2003))).toBeLessThan(seatsOf(presetCabin(m, 'two', 2003)));
    // 흔한 2등급은 기종 좌석 수와 비슷하다
    expect(Math.abs(seatsOf(presetCabin(m, 'two', 2003)) - m.seats)).toBeLessThanOrEqual(m.seats * 0.05);
    // 1979년 전 2등급은 일등석 + 이코노미 (비즈니스석이 없었다)
    const old = presetCabin(MODEL['b707'], 'two', 1970);
    expect(old.f).toBeGreaterThan(0);
    expect(old.c).toBe(0);
    expect(presetBlocker(MODEL['b747-100'], 'three', 1975, 'full')).toContain('1979');
    expect(presetBlocker(MODEL['a320'], 'two', 2003, 'lcc')).toContain('저가항공');
    expect(presetBlocker(MODEL['b747-400f'], 'eco', 2003, 'full')).toContain('화물기');
    expect(presetBlocker(MODEL['b737-300'], 'three', 2003, 'full')).toContain('150석');
  });

  it('좌석을 바꾸면 돈이 들고 그 달은 날지 않으며, 다음 달부터 새 좌석으로 난다', () => {
    const { s, route, plane } = game('tokyo', 'a320', 'two');
    const cash = s.companies[0].cash;
    expect(cabinBlocker(s, 0, plane, 'two')).toContain('지금 그 배치');
    const t = applyAction(s, { type: 'setCabin', plane, preset: 'eco' });
    expect(t.companies[0].cash).toBeCloseTo(cash - refitCost(MODEL['a320']), 5);
    const p = t.companies[0].planes.find((x) => x.id === plane)!;
    expect(p.cabin).toEqual(presetCabin(MODEL['a320'], 'eco', 2003));
    expect(p.refit).toBe(t.t);
    // 그 달: 이 노선은 손님이 없다
    const out = computeMonth(t);
    expect(out.routeStats[0].get(route)?.pax ?? 0).toBe(0);
    expect(cabinBlocker(t, 0, plane, 'dense')).toContain('이번 달');
    // 다음 달에는 다시 난다
    const next = runMonth(runMonth(t, seededRandom(1)), seededRandom(2));
    expect(next.report!.companies[0].pax).toBeGreaterThan(0);
  });
});

describe('좌석 등급: 손님', () => {
  it('옛날일수록 일등석, 1979년 뒤로 비즈니스, 멀수록 윗등급 손님이 많다', () => {
    expect(classShares(1965, 6000).fB).toBeGreaterThan(classShares(2015, 6000).fB);
    expect(classShares(1970, 6000).cB).toBe(0);
    expect(classShares(1995, 6000).cB).toBeGreaterThan(0.2);
    expect(classShares(2005, 9000).cB).toBeGreaterThan(classShares(2005, 1000).cB);
    expect(classShares(2005, 9000).fB).toBeGreaterThan(classShares(2005, 1000).fB);
    // 관광 손님은 윗등급을 덜 찾는다
    expect(classShares(2005, 9000).cL).toBeLessThan(classShares(2005, 9000).cB);
  });

  it('비즈니스 운임을 올리면 비즈니스 손님이 줄고 일부는 이코노미로 내려간다, 자리가 없으면 아래 등급으로', () => {
    const sh = classShares(2005, 8000);
    const seats = { f: 30, c: 1500, y: 2000 };
    const base = allocateClasses(seats, 2000, 1500, sh, 0, 0);
    const dear = allocateClasses(seats, 2000, 1500, sh, 30, 0);
    expect(dear.c).toBeLessThan(base.c);
    expect(dear.yBiz).toBeGreaterThan(base.yBiz);
    // 일등석이 없으면 일등석 손님 일부가 비즈니스로
    const noF = allocateClasses({ f: 0, c: 1500, y: 2000 }, 2000, 1500, sh, 0, 0);
    expect(noF.f).toBe(0);
    expect(noF.c).toBeGreaterThanOrEqual(base.c);
    // 손님은 좌석보다 많을 수 없다
    for (const x of [base, dear, noF]) {
      expect(x.f).toBeLessThanOrEqual(seats.f + 1e-9);
      expect(x.c).toBeLessThanOrEqual(seats.c + 1e-9);
    }
  });

  it('사업 손님이 많은 먼 노선에서는 윗등급 좌석이 좌석당 더 번다', () => {
    const three = game('london', 'b777-200', 'three');
    const eco = game('london', 'b777-200', 'eco');
    const r3 = estimateExisting(three.s, 0, three.s.companies[0].routes[0]);
    const re = estimateExisting(eco.s, 0, eco.s.companies[0].routes[0]);
    expect(r3.cls.seats[0]).toBeGreaterThan(0);
    expect(r3.cls.pax[1]).toBeGreaterThan(0);
    expect(r3.revenue / r3.seatsWeek).toBeGreaterThan(re.revenue / re.seatsWeek);
  });
});

describe('사업 모델', () => {
  it('저가항공: 화물기·초음속기·윗등급·제휴는 안 되고, 운임은 더 싸게, 비행기는 더 빨리 돈다', () => {
    const lcc = game('tokyo', 'a320', 'dense', 'lcc');
    const s = lcc.s;
    expect(buyBlocker(s, 0, 'b747-400f', true)).toContain('저가항공');
    expect(cabinBlocker(s, 0, lcc.plane, 'two')).toContain('저가항공');
    expect(proposeBlocker(s, 0, 1)).toContain('제휴');
    expect(applyAction(s, { type: 'setFare', route: lcc.route, fare: -45 }).companies[0].routes[0].fare).toBe(-45);
    expect(applyAction(s, { type: 'setService', level: 4 })).toBe(s);
    const full = game('tokyo', 'a320', 'two', 'full');
    expect(applyAction(full.s, { type: 'setFare', route: full.route, fare: -45 })).toBe(full.s);
    expect(planeHours(s.companies[0], s.companies[0].planes[0])).toBeLessThan(planeHours(full.s.companies[0], full.s.companies[0].planes[0]));
    // 부가 수입은 있고 짐칸 화물은 없다
    const r = computeMonth(s).reports[0];
    expect(r.ancillary).toBeGreaterThan(0);
    expect(r.cargo).toBe(0);
    const rf = computeMonth(full.s).reports[0];
    expect(rf.ancillary).toBe(0);
  });

  it('저가항공이 날면 싼 표를 찾는 관광 손님이 새로 생긴다 (규제가 풀린 뒤로)', () => {
    const { s } = game('osaka', 'a320', 'dense', 'full');
    const offer = (model: BizModel): Offer => ({ company: 0, fare: -30, model, planes: [{ model: MODEL['a321'], freq: 28, age: 0, cabin: presetCabin(MODEL['a321'], 'dense', 2003), cargo: 0 }] });
    const asFull = splitMarket(s, 'seoul', 'osaka', [offer('full')])[0];
    const asLcc = splitMarket(s, 'seoul', 'osaka', [offer('lcc')])[0];
    expect(asLcc.leisure).toBeGreaterThan(asFull.leisure);
    // 사업 손님은 저가항공을 덜 고른다
    expect(asLcc.biz).toBeLessThan(asFull.biz);
    // 1970년에는 그 효과가 없다
    const old = { ...s, t: mOf(1970, 5), q: Math.floor(mOf(1970, 5) / 3) };
    const oldFull = splitMarket(old, 'seoul', 'osaka', [offer('full')])[0];
    const oldLcc = splitMarket(old, 'seoul', 'osaka', [offer('lcc')])[0];
    expect(Math.abs(oldLcc.leisure / oldFull.leisure - 1)).toBeLessThan(0.01);
  });

  it('사업 모델을 바꾸면 돈이 들고 여섯 달 뒤에 바뀐다 (저가항공은 좌석이 고밀도로)', () => {
    const { s } = game('tokyo', 'b777-200', 'three', 'full');
    const cash = s.companies[0].cash;
    expect(modelBlocker(s, 0, 'cargo')).toContain('여객기');
    let t = applyAction(s, { type: 'setModel', model: 'lcc' });
    expect(t.companies[0].cash).toBeLessThan(cash);
    expect(t.companies[0].modelNext).toEqual({ model: 'lcc', t: s.t + MODEL_SWITCH_MONTHS });
    expect(modelBlocker(t, 0, 'full')).toContain('바꾸는 중');
    const rng = seededRandom(5);
    for (let k = 0; k < MODEL_SWITCH_MONTHS - 1; k++) t = runMonth(t, rng);
    expect(t.companies[0].model).toBe('full');
    t = runMonth(t, rng);
    expect(t.companies[0].model).toBe('lcc');
    expect(t.companies[0].modelNext).toBeNull();
    const cab = t.companies[0].planes[0].cabin!;
    expect(cab.f + cab.c).toBe(0);
    expect(cab).toEqual(presetCabin(MODEL['b777-200'], 'dense', 2003));
    expect(t.news.some((n) => n.title.includes('저가항공'))).toBe(true);
  });
});

describe('화물', () => {
  it('화물기는 통째로, 넓은 동체 여객기는 짐칸에 꽤, 좁은 동체는 조금, 저가항공은 안 싣는다', () => {
    expect(isFreighter(MODEL['b747-400f'])).toBe(true);
    expect(planeCargoT(MODEL['b747-400f'], 'full')).toBeGreaterThan(planeCargoT(MODEL['b747-400'], 'full') * 4);
    expect(bellyT(MODEL['b747-400'])).toBeGreaterThan(bellyT(MODEL['a320']) * 5);
    expect(planeCargoT(MODEL['a320'], 'lcc')).toBe(0);
    expect(fitsBizModel('cargo', MODEL['a320'])).toBe(false);
    expect(fitsBizModel('cargo', MODEL['b777f'])).toBe(true);
    expect(fitsBizModel('lcc', MODEL['concorde'])).toBe(false);
    // 화물기마다 바탕 여객기와 같은 계열
    for (const id of ['b747-400f', 'md11f', 'b767-300f', 'a330-200f', 'b747-8f', 'dc10-30f', 'b707-320c', 'dc8-55f', 'b747-200f', 'a300-600f', 'b777f']) {
      const m = MODEL[id];
      expect(m.cargo).toBeGreaterThan(0);
      expect(m.family).toBe(MODEL[m.base!].family);
    }
  });

  it('화물은 무역 도시 사이에 많고, 연말에 가장 많고, 기름값이 오르면 준다', () => {
    const s = { t: mOf(2005, 5) };
    expect(cargoDemand(s, 'hongkong', 'frankfurt')).toBeGreaterThan(cargoDemand(s, 'seoul', 'guam') * 5);
    expect(cargoDemand({ t: mOf(2005, 11) }, 'hongkong', 'frankfurt')).toBeGreaterThan(cargoDemand({ t: mOf(2005, 2) }, 'hongkong', 'frankfurt'));
    expect(Math.max(...CARGO_MONTH)).toBe(CARGO_MONTH[10]);
    expect(cargoDemand({ t: mOf(2005, 5) }, 'hongkong', 'frankfurt')).toBeGreaterThan(cargoDemand({ t: mOf(1975, 5) }, 'hongkong', 'frankfurt'));
    expect(oilCargoMult(2)).toBeLessThan(oilCargoMult(1));
  });

  it('여객기 짐칸과 화물기가 화물 수입을 벌고, 결산에 화물 줄이 생긴다', () => {
    const wide = game('frankfurt', 'b747-400', 'three', 'full', 'hongkong');
    const r = computeMonth(wide.s).reports[0];
    expect(r.cargo).toBeGreaterThan(0);
    expect(r.cargoT).toBeGreaterThan(0);
    expect(r.cargoT).toBeLessThanOrEqual(r.cargoCap + 1e-6);
    const fr = game('dubai', 'b747-400f', 'eco', 'cargo', 'hongkong', 2003, 3);
    const rf = computeMonth(fr.s).reports[0];
    expect(rf.ticket).toBe(0);
    expect(rf.pax).toBe(0);
    expect(rf.cargo).toBeGreaterThan(0);
    const st = computeMonth(fr.s).routeStats[0].get(fr.route)!;
    expect(st.cargo.cap).toBeGreaterThan(0);
    expect(st.lf).toBeCloseTo(st.cargo.t / st.cargo.cap, 6);
    // 화물 운임을 올리면 톤은 준다
    const route = fr.s.companies[0].routes[0];
    expect(estimateExisting(fr.s, 0, route, { fareK: 30 }).cargoT).toBeLessThan(estimateExisting(fr.s, 0, route).cargoT);
  });

  it('화물 전문 회사는 화물기만 산다', () => {
    const { s } = game('dubai', 'b747-400f', 'eco', 'cargo', 'hongkong');
    expect(buyBlocker(s, 0, 'a320', true)).toContain('화물');
    expect(buyBlocker(s, 0, 'b767-300f', true)).toBeNull();
  });
});

describe('컴퓨터와 저장', () => {
  it('저가항공·화물 전문 컴퓨터도 규칙대로 몇 해를 경영한다', () => {
    const rng = seededRandom(17);
    let s = createGame(setup(['ai-normal', 'ai-normal', 'ai-easy'], { era: 2003 }, ['frankfurt', 'hongkong', 'seoul']), rng);
    s = { ...s, companies: s.companies.map((c, i) => ({ ...c, model: (['lcc', 'cargo', 'full'] as const)[i], service: i === 0 ? 1 : c.service })) };
    for (let k = 0; k < 3 * 12 * 3 && s.phase === 'manage'; k++) s = aiTurn(s, rng);
    const [lcc, cargo, full] = s.companies;
    expect(lcc.planes.length).toBeGreaterThan(3);
    expect(lcc.planes.every((p) => fitsBizModel('lcc', MODEL[p.model]) && (p.cabin?.f ?? 0) + (p.cabin?.c ?? 0) === 0)).toBe(true);
    expect(cargo.planes.length).toBeGreaterThan(0);
    expect(cargo.planes.every((p) => isFreighter(MODEL[p.model]))).toBe(true);
    expect(full.planes.length).toBeGreaterThan(0);
    const last = s.years[s.years.length - 1].companies;
    expect(last[0].ancillary).toBeGreaterThan(0);
    expect(last[1].cargo).toBeGreaterThan(0);
    expect(last[1].ticket).toBe(0);
  });

  it('3판 저장은 4판으로: 모두 풀서비스, 그때의 2등급 좌석, 결산 새 값은 0', () => {
    const { s } = game('tokyo', 'b707', 'two', 'full', 'seoul', 1983);
    const raw = JSON.parse(JSON.stringify(runMonth(s, seededRandom(1))));
    raw.version = 3;
    for (const c of raw.companies) {
      delete c.model;
      delete c.modelNext;
      for (const p of c.planes) delete p.cabin;
      for (const r of c.routes) {
        delete r.fareC;
        delete r.fareF;
        delete r.fareK;
      }
    }
    for (const r of raw.report.companies) for (const k of ['cargo', 'ancillary', 'cargoT', 'cargoCap', 'paxF', 'paxC', 'revF', 'revC']) delete r[k];
    const v4 = migrateV3(raw) as AirlineState;
    expect(v4.version).toBe(4);
    expect(v4.companies.every((c) => c.model === 'full' && c.modelNext === null)).toBe(true);
    const cab = v4.companies[0].planes[0].cabin!;
    expect(cab).toEqual(presetCabin(MODEL['b707'], 'two', 1983));
    expect(v4.companies[0].routes[0].fareC).toBe(0);
    expect(v4.report!.companies[0].cargo).toBe(0);
    expect(v4.report!.companies[0].paxC).toBe(0);
  });
});
