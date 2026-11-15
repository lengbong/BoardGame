import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { aiTurn } from './ai';
import { makeChoice } from './choices';
import { applyAction, autoStopReason, createGame, runMonth, timesBlocker } from './rules';
import { computeMonth, estimateExisting, slotCapacity } from './simulate';
import {
  OVERTIME,
  STAFF_GROUPS,
  fireCost,
  hireCost,
  hireTime,
  moraleTarget,
  payroll,
  staffCap,
  staffNeed,
  staffTotal,
  strikeChance,
} from './staff';
import { fillMissing, migrateV3 } from './storage';
import { bandCaps, bandCounts, curfew, defaultTimes, legalTimes, timeFit } from './timetable';
import { mOf } from './time';
import type { AirlineOptions, AirlineSetup, AirlineState, SeatKind } from './types';

function setup(kinds: SeatKind[], options: Partial<AirlineOptions> = {}, hubs: (string | null)[] = []): AirlineSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as AirlineSetup['seats'],
    options: { era: 2003, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'normal', names: 'fictional', ...options },
    hubs: [0, 1, 2, 3].map((i) => hubs[i] ?? null),
    airlines: [null, null, null, null],
  };
}

/** 사람 둘, 0번 회사에 노선 여러 개 (비행기 수·나이·기종을 정해서) */
function fleet(dests: string[], { from = 'seoul', model = 'a320', age = 0, freq = 14, hub2 = 'london' } = {}): AirlineState {
  const s = createGame(setup(['human', 'human'], {}, [from, hub2]), seededRandom(1));
  const c = s.companies[0];
  for (const to of dests) {
    if (!c.branches.includes(to)) c.branches.push(to);
    const route = s.nextId++;
    c.routes.push({ id: route, a: from, b: to, fare: 0, since: s.t, stats: null, times: defaultTimes(from, to, 2003) });
    c.planes.push({ id: s.nextId++, model, leased: false, rent: 0, deposit: 0, since: s.t - Math.round(age * 12), legs: [{ route, freq }] });
  }
  return s;
}

/** 0번 회사 직원을 필요한 만큼 (배수) 맞춘다 */
function staffTo(s: AirlineState, mult: number): AirlineState {
  const t = structuredClone(s);
  const c = t.companies[0];
  const need = staffNeed(t, c);
  for (const g of STAFF_GROUPS) c.staff[g] = { ...c.staff[g], have: Math.round(need[g] * mult), pipe: [] };
  return t;
}

describe('직원: 필요한 사람 수', () => {
  it('비행시간·좌석·비행기 나이·지점·손님에 따라 늘어난다', () => {
    const one = fleet(['tokyo']);
    const three = fleet(['tokyo', 'osaka', 'beijing']);
    const n1 = staffNeed(one, one.companies[0]);
    const n3 = staffNeed(three, three.companies[0]);
    for (const g of STAFF_GROUPS) expect(n3[g]).toBeGreaterThan(n1[g]);
    // 먼 노선(비행시간이 길다) → 조종사가 더
    const far = fleet(['sydney'], { model: 'b787-9', freq: 4 });
    const near = fleet(['tokyo'], { model: 'b787-9', freq: 4 });
    expect(staffNeed(far, far.companies[0]).pilot).toBeGreaterThan(staffNeed(near, near.companies[0]).pilot);
    // 큰 비행기 → 객실 승무원·정비사가 더
    const big = fleet(['tokyo'], { model: 'b777-300', freq: 14 });
    const nb = staffNeed(big, big.companies[0]);
    expect(nb.cabin).toBeGreaterThan(n1.cabin);
    expect(nb.tech).toBeGreaterThan(n1.tech);
    // 낡은 비행기 → 정비사가 더
    const old = fleet(['tokyo'], { age: 25 });
    expect(staffNeed(old, old.companies[0]).tech).toBeGreaterThan(n1.tech);
    // 비행기가 없으면 운항 인력은 필요 없다
    const none = createGame(setup(['human', 'human'], {}, ['seoul', 'london']), seededRandom(2));
    const n0 = staffNeed(none, none.companies[0]);
    expect(n0.pilot).toBe(0);
    expect(n0.ground).toBeGreaterThan(0);
  });

  it('시작할 때 비행기를 가진 회사(실제 항공사)는 필요한 만큼 직원이 있다', () => {
    const s = createGame(setup(['human', 'ai-normal'], { era: 1983, names: 'real' }), seededRandom(3));
    for (const c of s.companies) {
      if (c.planes.length === 0) continue;
      expect(staffCap(staffNeed(s, c), c)).toBe(1);
      expect(staffTotal(c)).toBeGreaterThan(0);
    }
  });
});

describe('직원: 뽑기·내보내기·임금', () => {
  it('뽑으면 몇 달 뒤에 일을 시작한다 (조종사 5달, 서두르면 4달, 훈련원이 있으면 3달)', () => {
    let s = staffTo(fleet(['tokyo']), 1.1);
    const c0 = s.companies[0];
    expect(hireTime(c0, 'pilot', false)).toBe(5);
    expect(hireTime(c0, 'pilot', true)).toBe(4);
    expect(hireTime(c0, 'cabin', false)).toBe(2);
    expect(hireTime(c0, 'ground', true)).toBe(1);
    expect(hireTime({ ...c0, academy: true }, 'pilot', false)).toBe(3);
    const before = c0.staff.pilot.have;
    const cash = c0.cash;
    s = applyAction(s, { type: 'hire', group: 'pilot', n: 10, fast: false });
    expect(s.companies[0].cash).toBeCloseTo(cash - hireCost(s, c0, 'pilot', 10, false), 5);
    expect(s.companies[0].staff.pilot.pipe).toEqual([{ n: 10, ready: s.t + 5 }]);
    const start = s.t;
    const rng = seededRandom(4);
    while (s.t < start + 4) {
      s = runMonth(s, rng);
      expect(s.companies[0].staff.pilot.have).toBe(before);
    }
    s = runMonth(s, rng);
    expect(s.t).toBe(start + 5);
    expect(s.companies[0].staff.pilot.have).toBe(before + 10);
    expect(s.companies[0].staff.pilot.pipe).toHaveLength(0);
    // 서둘러 뽑으면 더 비싸고, 훈련원이 있으면 싸다
    expect(hireCost(s, c0, 'pilot', 10, true)).toBeGreaterThan(hireCost(s, c0, 'pilot', 10, false));
    expect(hireCost(s, { ...c0, academy: true }, 'pilot', 10, false)).toBeLessThan(hireCost(s, c0, 'pilot', 10, false));
  });

  it('내보내면 석 달 치 임금이 들고 남은 사람들이 서운해한다', () => {
    const s = staffTo(fleet(['tokyo']), 1.5);
    const c = s.companies[0];
    const t = applyAction(s, { type: 'fire', group: 'cabin', n: 5 });
    expect(t.companies[0].staff.cabin.have).toBe(c.staff.cabin.have - 5);
    expect(t.companies[0].cash).toBeCloseTo(c.cash - fireCost(s, c, 'cabin', 5), 5);
    expect(t.companies[0].shock).toBeGreaterThan(c.shock);
    expect(moraleTarget(t, t.companies[0]).value).toBeLessThan(moraleTarget(s, c).value);
    // 없는 사람은 못 내보낸다
    expect(applyAction(s, { type: 'fire', group: 'cabin', n: c.staff.cabin.have + 1 })).toBe(s);
  });

  it('임금 수준은 80~130%이고, 높으면 만족도 목표가 오르고 임금이 는다', () => {
    const s = staffTo(fleet(['tokyo']), 1.05);
    const hi = applyAction(s, { type: 'setPay', group: 'pilot', level: 1.2 });
    expect(hi.companies[0].staff.pilot.pay).toBe(1.2);
    expect(moraleTarget(hi, hi.companies[0]).value).toBeGreaterThan(moraleTarget(s, s.companies[0]).value);
    expect(payroll(hi, hi.companies[0])).toBeGreaterThan(payroll(s, s.companies[0]));
    expect(applyAction(s, { type: 'setPay', group: 'pilot', level: 1.5 })).toBe(s);
    expect(applyAction(s, { type: 'setPay', group: 'pilot', level: 0.5 })).toBe(s);
  });

  it('훈련원을 세우면 돈이 들고 한 번만 세운다', () => {
    const s = fleet(['tokyo']);
    s.companies[0].cash = 1000;
    const t = applyAction(s, { type: 'buildAcademy' });
    expect(t.companies[0].academy).toBe(true);
    expect(t.companies[0].cash).toBeLessThan(1000);
    expect(applyAction(t, { type: 'buildAcademy' })).toBe(t);
  });
});

describe('직원: 모자라면 결항, 만족도가 낮으면 파업', () => {
  it('15%까지는 초과 근무로 버티고, 그보다 모자라면 결항이 나서 손님이 준다', () => {
    const base = fleet(['tokyo', 'osaka', 'beijing']);
    const full = staffTo(base, 1.05);
    const ot = staffTo(base, 0.9);
    const short = staffTo(base, 0.6);
    expect(staffCap(staffNeed(full, full.companies[0]), full.companies[0])).toBe(1);
    expect(staffCap(staffNeed(ot, ot.companies[0]), ot.companies[0])).toBe(1);
    const cap = staffCap(staffNeed(short, short.companies[0]), short.companies[0]);
    expect(cap).toBeLessThan(1);
    expect(cap).toBeCloseTo(0.6 * (1 + OVERTIME), 1);
    const rFull = computeMonth(full).reports[0];
    const rOt = computeMonth(ot).reports[0];
    const rShort = computeMonth(short).reports[0];
    expect(rFull.staffCancelled).toBe(0);
    expect(rOt.staffCancelled).toBe(0);
    expect(rShort.staffCancelled).toBeGreaterThan(0);
    expect(rShort.pax).toBeLessThan(rFull.pax);
    // 초과 근무는 돈이 더 든다 (사람이 적어도 임금이 사람 수만큼 줄지는 않는다)
    expect(rOt.staff).toBeGreaterThan(rFull.staff * 0.9 * 0.95);
    // 만족도 목표도 떨어진다
    expect(moraleTarget(ot, ot.companies[0]).overtime).toBeLessThan(0);
    // 자동 진행도 멈춘다
    expect(autoStopReason(short, 0, short.nextId)).toContain('일손');
  });

  it('만족도가 30 아래면 파업이 날 수 있고, 파업하면 운항이 줄고 소식이 온다', () => {
    const s = staffTo(fleet(['tokyo', 'osaka']), 1.05);
    expect(strikeChance({ ...s.companies[0], morale: 60 })).toBe(0);
    expect(strikeChance({ ...s.companies[0], morale: 29 })).toBeGreaterThan(0);
    expect(strikeChance({ ...s.companies[0], morale: 5 })).toBeGreaterThan(strikeChance({ ...s.companies[0], morale: 25 }));
    // 만족도를 아주 낮게 묶어 두고 여러 달 돌리면 파업이 난다
    let strikes = 0;
    let news = 0;
    let t = s;
    const rng = seededRandom(5);
    for (let k = 0; k < 48; k++) {
      t = structuredClone(t);
      t.companies[0].morale = 2;
      t.companies[0].shock = 40;
      const calm = computeMonth(t).reports[0];
      t = runMonth(t, rng);
      const r = t.report!.companies[0];
      if (r.strike) {
        strikes++;
        expect(r.cancelled).toBeGreaterThan(0);
        expect(r.flights - r.cancelled).toBeLessThan(calm.flights);
        if (t.news.some((n) => n.icon === '🪧' && n.t === t.report!.t)) news++;
      }
    }
    expect(strikes).toBeGreaterThan(0);
    expect(news).toBe(strikes);
  });

  it('만족도가 낮으면 임금 협상이 먼저 온다', () => {
    const s = staffTo(fleet(['tokyo', 'osaka', 'beijing']), 1.05);
    s.companies[0].morale = 30;
    let wage = 0;
    for (let k = 0; k < 40; k++) if (makeChoice(s, 0, seededRandom(100 + k))?.scenario === 'wage') wage++;
    expect(wage).toBeGreaterThan(20);
    // 임금 협상을 받아들이면 임금 수준과 만족도가 오른다
    const offer = makeChoice(s, 0, seededRandom(101));
    if (offer?.scenario === 'wage') {
      const t = structuredClone(s);
      t.companies[0].choice = { id: 1, ...offer };
      const u = applyAction(t, { type: 'choose', option: 0 }, seededRandom(1));
      expect(u.companies[0].staff.pilot.pay).toBeGreaterThan(s.companies[0].staff.pilot.pay);
      expect(u.companies[0].morale).toBeGreaterThan(30);
    }
  });
});

describe('운항 시간표', () => {
  it('주간 횟수를 시간대에 나누면 합이 같다', () => {
    expect(bandCounts([4, 2, 4, 0], 14)).toEqual([6, 3, 5, 0]);
    for (const total of [0, 1, 7, 13, 28]) for (const t of [[1, 1, 1, 1], [4, 1, 4, 0], [0, 0, 0, 3]]) expect(bandCounts(t, total).reduce((a, b) => a + b, 0)).toBe(total);
  });

  it('사업 손님은 아침·저녁, 관광 손님은 낮을 좋아하고, 장거리는 밤도 괜찮다', () => {
    const bizT = [4, 1, 4, 0];
    const leiT = [2, 4, 3, 0];
    expect(timeFit(bizT, 1200).biz).toBeGreaterThan(timeFit(leiT, 1200).biz);
    expect(timeFit(leiT, 1200).leisure).toBeGreaterThan(timeFit(bizT, 1200).leisure);
    expect(timeFit([0, 0, 0, 1], 9000).biz).toBeGreaterThan(timeFit([0, 0, 0, 1], 1200).biz);
    // (좌석이 넉넉해야 차이가 보인다)
    const s = staffTo(fleet(['tokyo', 'guam'], { model: 'b747-400', freq: 14 }), 1.05);
    const c = s.companies[0];
    const tokyo = c.routes.find((r) => r.b === 'tokyo')!;
    const bizFirst = estimateExisting(s, 0, tokyo, { times: [4, 1, 4, 0] });
    const dayFirst = estimateExisting(s, 0, tokyo, { times: [1, 4, 1, 0] });
    expect(bizFirst.lf).toBeLessThan(0.97);
    // 사업 손님이 많은 노선은 아침·저녁 편이 돈이 된다 (사업 손님이 더 비싸게 낸다)
    expect(bizFirst.revenue).toBeGreaterThan(dayFirst.revenue);
    const guam = c.routes.find((r) => r.b === 'guam')!;
    const gDay = estimateExisting(s, 0, guam, { times: [2, 4, 3, 0] });
    const gBiz = estimateExisting(s, 0, guam, { times: [4, 0, 4, 0] });
    // 관광 노선은 낮 편에 손님이 더 탄다
    expect(gDay.paxWeek).toBeGreaterThan(gBiz.paxWeek);
    expect(gDay.revenue).toBeGreaterThan(gBiz.revenue);
  });

  it('시간대마다 공항 슬롯이 따로 있어서 한 시간대에 몰 수 없다', () => {
    const s = fleet(['tokyo'], { freq: 20 });
    const c = s.companies[0];
    const r = c.routes[0];
    for (let k = 0; k < 2; k++) c.planes.push({ id: s.nextId++, model: 'a320', leased: false, rent: 0, deposit: 0, since: s.t, legs: [{ route: r.id, freq: 20 }] });
    const capT = bandCaps(s, 0, 'tokyo', slotCapacity(s, 0, 'tokyo'));
    // 큰 공항은 낮보다 아침·저녁 슬롯이 적다
    expect(capT[0]).toBeLessThan(capT[1]);
    expect(60).toBeGreaterThan(capT[0]);
    // 주 60회를 모두 아침에 몰면 도쿄 아침 슬롯이 모자란다
    expect(timesBlocker(s, 0, r.id, [1, 0, 0, 0])).toContain('도쿄 아침 슬롯이 모자라요');
    expect(applyAction(s, { type: 'setTimes', route: r.id, times: [1, 0, 0, 0] })).toBe(s);
    // 고르게 나누면 된다
    expect(timesBlocker(s, 0, r.id, [3, 3, 3, 0])).toBeNull();
    expect(applyAction(s, { type: 'setTimes', route: r.id, times: [3, 3, 3, 0] }).companies[0].routes[0].times).toEqual([3, 3, 3, 0]);
  });

  it('밤 운항을 막는 공항이 있으면 밤 편을 못 넣는다', () => {
    expect(curfew('london', 2003)).toBe(true);
    expect(curfew('tokyo', 1990)).toBe(true);
    expect(curfew('tokyo', 2015)).toBe(false);
    expect(curfew('seoul', 2003)).toBe(false);
    expect(defaultTimes('seoul', 'london', 2003)[3]).toBe(0);
    expect(defaultTimes('seoul', 'newyork', 2003)[3]).toBeGreaterThan(0);
    expect(legalTimes({ a: 'seoul', b: 'london', times: [2, 2, 3, 2] }, 2003)).toEqual([2, 2, 5, 0]);
    const s = fleet(['london'], { model: 'b777-300', freq: 7, hub2: 'paris' });
    const r = s.companies[0].routes[0];
    expect(timesBlocker(s, 0, r.id, [2, 2, 3, 2])).toContain('밤 운항');
    expect(applyAction(s, { type: 'setTimes', route: r.id, times: [2, 2, 3, 2] })).toBe(s);
    expect(timesBlocker(s, 0, r.id, [2, 2, 3, 0])).toBeNull();
  });
});

describe('저장과 컴퓨터', () => {
  it('직원·시간표가 없는 3판 저장(1단계)은 채워서 읽는다', () => {
    const s = fleet(['tokyo']);
    const raw = JSON.parse(JSON.stringify(s));
    raw.version = 3;
    for (const c of raw.companies) {
      delete c.model;
      delete c.modelNext;
      for (const p of c.planes) delete p.cabin;
      delete c.staff;
      delete c.morale;
      delete c.academy;
      delete c.shock;
      for (const r of c.routes) delete r.times;
    }
    const filled = migrateV3(fillMissing(raw)) as AirlineState;
    expect(filled.version).toBe(4);
    expect(filled.companies[0].model).toBe('full');
    expect(filled.companies[0].planes[0].cabin).toBeTruthy();
    const c = filled.companies[0];
    expect(c.routes[0].times).toHaveLength(4);
    expect(c.morale).toBe(65);
    expect(c.academy).toBe(false);
    expect(staffCap(staffNeed(filled, c), c)).toBe(1);
  });

  it('컴퓨터는 직원을 미리 뽑아서 일손 부족 결항이 드물다', () => {
    const rng = seededRandom(12);
    let s = createGame(setup(['ai-normal', 'ai-easy']), rng);
    let flights = 0;
    let staffCancelled = 0;
    for (let k = 0; k < 2 * 12 * 5 && s.phase === 'manage'; k++) {
      s = aiTurn(s, rng);
      if (s.turnPos === 0 && s.report) {
        flights += s.report.companies[0].flights;
        staffCancelled += s.report.companies[0].staffCancelled;
      }
    }
    expect(flights).toBeGreaterThan(1000);
    expect(staffCancelled / flights).toBeLessThan(0.04);
    expect(s.companies[0].morale).toBeGreaterThan(30);
    expect(mOf(2003, 1)).toBe(s.startT);
  });
});
