import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL } from './aircraft';
import { aiManage, aiTurn } from './ai';
import { advise } from './advisor';
import { defaultCabin } from './cabin';
import { DEFAULT_COND, checkCost, condOf, condRisk, dueForCheck, monthlyWear, restoredCond, usedCond } from './condition';
import { actor, applyAction, checkBlocker, createGame } from './rules';
import { computeMonth, groundingChance, opsRates, planeHours, sellPrice } from './simulate';
import { isValidState, parseSaved } from './storage';
import { defaultTimes } from './timetable';
import { yearOf } from './time';
import type { AirlineAction, AirlineSetup, AirlineState, SeatKind } from './types';

function setup(kinds: SeatKind[], era: 1963 | 1983 | 2003 = 2003, hubs: (string | null)[] = ['seoul', 'london', null, null]): AirlineSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as AirlineSetup['seats'],
    options: { era, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'normal', names: 'fictional' },
    hubs,
    airlines: [null, null, null, null],
  };
}

const game = (kinds: SeatKind[] = ['human', 'human']) => createGame(setup(kinds), seededRandom(3));

function act(s: AirlineState, ...actions: AirlineAction[]): AirlineState {
  for (const a of actions) {
    const next = applyAction(s, a, seededRandom(5));
    expect(next, JSON.stringify(a)).not.toBe(s);
    s = next;
  }
  return s;
}

function toTurn(s: AirlineState, ci: number, when: (s: AirlineState) => boolean = () => true): AirlineState {
  for (let k = 0; k < 40 && !(actor(s) === ci && when(s)); k++) s = applyAction(s, { type: 'endTurn' }, seededRandom(k));
  expect(actor(s)).toBe(ci);
  return s;
}

/** 노선과 비행기를 손으로 붙인다 (비행기 번호를 돌려준다) */
function addRoute(s: AirlineState, ci: number, a: string, b: string, model: string, freq: number, cond?: number): number {
  const c = s.companies[ci];
  for (const city of [a, b]) if (!c.branches.includes(city)) c.branches.push(city);
  const rid = s.nextId++;
  c.routes.push({ id: rid, a, b, fare: 0, since: s.t, stats: null, times: defaultTimes(a, b, 2003) });
  const pid = s.nextId++;
  c.planes.push({ id: pid, model, leased: true, rent: 3, deposit: 0, since: s.t, legs: [{ route: rid, freq }], cabin: defaultCabin(MODEL[model]), meal: 3, ...(cond !== undefined ? { cond } : {}) });
  return pid;
}

describe('기체 상태와 C점검', () => {
  it('새로 리스한 비행기는 100%, 중고는 나이만큼 닳아 있다', () => {
    let s = game();
    s = act(s, { type: 'lease', model: 'b737-800' });
    expect(s.companies[0].planes[0].cond).toBe(100);
    expect(usedCond(10)).toBeLessThan(usedCond(2));
    expect(usedCond(40)).toBe(45);
    expect(condOf({ ...s.companies[0].planes[0], cond: undefined })).toBe(DEFAULT_COND);
  });

  it('날면 닳고 (낡거나 정비를 아끼면 더 빨리), 쉬는 비행기는 그대로다', () => {
    let s = game();
    const pid = addRoute(s, 0, 'seoul', 'tokyo', 'b737-800', 20, 90);
    s.companies[0].planes.push({ id: s.nextId++, model: 'b737-800', leased: true, rent: 3, deposit: 0, since: s.t, legs: [], cabin: defaultCabin(MODEL['b737-800']), meal: 3, cond: 90 });
    const hours = planeHours(s.companies[0], s.companies[0].planes[0]);
    const wear = monthlyWear(hours, 0, 3);
    expect(wear).toBeGreaterThan(0.5);
    expect(monthlyWear(hours, 20, 3)).toBeGreaterThan(wear);
    expect(monthlyWear(hours, 0, 1)).toBeGreaterThan(wear);
    expect(monthlyWear(hours, 0, 5)).toBeLessThan(wear);
    s = act(s, { type: 'endTurn' }, { type: 'endTurn' });
    const p = s.companies[0].planes.find((x) => x.id === pid)!;
    expect(p.cond).toBeCloseTo(90 - wear, 0);
    expect(s.companies[0].planes[1].cond).toBe(90);
  });

  it('상태가 낮을수록 고장·지연이 잦다', () => {
    expect(condRisk(100)).toBeLessThan(condRisk(70));
    expect(condRisk(70)).toBeCloseTo(1, 1);
    expect(condRisk(20)).toBeGreaterThan(2);
    const s = game();
    addRoute(s, 0, 'seoul', 'tokyo', 'b737-800', 14, 95);
    const good = { ...s.companies[0].planes[0] };
    const rid = s.companies[0].routes[0].id;
    const lateGood = opsRates(s, 0, rid).late;
    const gGood = groundingChance(s, s.companies[0], good);
    s.companies[0].planes[0].cond = 15;
    expect(opsRates(s, 0, rid).late).toBeGreaterThan(lateGood);
    expect(groundingChance(s, s.companies[0], s.companies[0].planes[0])).toBeGreaterThan(gGood * 2);
  });

  it('점검 시점 아래로 내려가면 다음 달 정비고에 들어가고, 그달이 끝나면 상태가 돌아온다', () => {
    let s = game();
    const pid = addRoute(s, 0, 'seoul', 'tokyo', 'b737-800', 14, 49.5);
    expect(dueForCheck(s.companies[0], s.t)).toEqual([pid]);
    s = act(s, { type: 'endTurn' }, { type: 'endTurn' });
    const p = s.companies[0].planes.find((x) => x.id === pid)!;
    expect(p.check).toBe(s.t);
    expect(s.log.some((l) => l.text.includes('C점검'))).toBe(true);
    // 점검 값은 '운항 수당·정비 부품'에 들어간다
    const out = computeMonth(s).reports[0];
    expect(out.checks).toBe(1);
    expect(out.checkCost).toBeCloseTo(checkCost(p), 6);
    s = toTurn(s, 0);
    s = act(s, { type: 'endTurn' });
    s = toTurn(s, 0);
    const after = s.companies[0].planes.find((x) => x.id === pid)!;
    expect(after.check).toBeUndefined();
    expect(after.cond).toBeGreaterThanOrEqual(restoredCond(0) - 3);
  });

  it('점검하는 달에는 그 노선 좌석이 줄지만, 쉬는 비행기가 있으면 대신 난다', () => {
    const s = game();
    const pid = addRoute(s, 0, 'seoul', 'tokyo', 'b737-800', 14, 40);
    addRoute(s, 0, 'seoul', 'osaka', 'b737-800', 14, 90);
    const normal = computeMonth(s).reports[0];
    s.companies[0].planes.find((x) => x.id === pid)!.check = s.t;
    const down = computeMonth(s).reports[0];
    expect(down.seats).toBeLessThan(normal.seats * 0.75);
    // 점검으로 줄인 운항은 결항으로 세지 않는다
    expect(down.cancelled).toBe(0);
    s.companies[0].planes.push({ id: s.nextId++, model: 'b737-800', leased: true, rent: 3, deposit: 0, since: s.t, legs: [], cabin: defaultCabin(MODEL['b737-800']), meal: 3, cond: 100 });
    const covered = computeMonth(s).reports[0];
    expect(covered.seats).toBeCloseTo(normal.seats, 3);
  });

  it('한 대씩 점검에 보내거나 미룰 수 있고, 아직 좋은 비행기는 보내지 않는다', () => {
    let s = game();
    const pid = addRoute(s, 0, 'seoul', 'tokyo', 'b737-800', 14, 70);
    const fresh = addRoute(s, 0, 'seoul', 'osaka', 'b737-800', 14, 97);
    expect(checkBlocker(s, 0, fresh)).toMatch(/좋아요/);
    s = act(s, { type: 'checkPlane', plane: pid, on: true });
    expect(s.companies[0].planes.find((x) => x.id === pid)!.check).toBe(s.t);
    expect(checkBlocker(s, 0, pid)).toMatch(/이미/);
    s = act(s, { type: 'checkPlane', plane: pid, on: false });
    expect(s.companies[0].planes.find((x) => x.id === pid)!.check).toBeUndefined();
    s = act(s, { type: 'setCheckAt', at: 65 });
    expect(s.companies[0].checkAt).toBe(65);
    expect(applyAction(s, { type: 'setCheckAt', at: 77 })).toBe(s);
  });

  it('닳은 비행기는 팔 때 값을 덜 받는다', () => {
    const s = game();
    addRoute(s, 0, 'seoul', 'tokyo', 'b737-800', 14, 100);
    const p = { ...s.companies[0].planes[0], leased: false };
    expect(sellPrice(s, { ...p, cond: 20 })).toBeLessThan(sellPrice(s, p));
  });

  it('저장에 상태와 점검이 남고, 망가진 값은 거른다 (예전 저장은 그대로 열린다)', () => {
    let s = game();
    const pid = addRoute(s, 0, 'seoul', 'tokyo', 'b737-800', 14, 60);
    s = act(s, { type: 'checkPlane', plane: pid, on: true }, { type: 'setCheckAt', at: 35 });
    const back = parseSaved(JSON.parse(JSON.stringify({ setup: setup(['human', 'human']), state: s, savedAt: 1 })));
    expect(back?.state.companies[0].planes[0].check).toBe(s.t);
    expect(back?.state.companies[0].checkAt).toBe(35);
    const old = JSON.parse(JSON.stringify(s));
    delete old.companies[0].planes[0].cond;
    delete old.companies[0].planes[0].check;
    delete old.companies[0].checkAt;
    expect(isValidState(old)).toBe(true);
    const broken = JSON.parse(JSON.stringify(s));
    broken.companies[0].planes[0].cond = 140;
    expect(isValidState(broken)).toBe(false);
  });

  it('보통 컴퓨터는 돈이 급하면 이번 달 점검을 미룬다', () => {
    let s = game(['ai-normal', 'human']);
    const pid = addRoute(s, 0, 'seoul', 'tokyo', 'b737-800', 14, 30);
    s.companies[0].planes.find((x) => x.id === pid)!.check = s.t;
    s.companies[0].cash = -50;
    // 컴퓨터가 크게 계획하는 달의 그 회사 차례까지
    s = toTurn(s, 0, (x) => x.t % 3 === 0);
    s.companies[0].planes.find((x) => x.id === pid)!.check = s.t;
    s.companies[0].cash = -50;
    const managed = aiManage(s, 0, 'ai-normal', seededRandom(1));
    const p = managed.companies[0].planes.find((x) => x.id === pid);
    expect(p).toBeTruthy();
    expect(p!.check).toBeUndefined();
  });

  it('비서는 아주 닳은 비행기를 점검에 보내라고 권한다', () => {
    let s = game();
    const pid = addRoute(s, 0, 'seoul', 'tokyo', 'b737-800', 14, 20);
    s.companies[0].checkAt = 35;
    s = { ...s };
    // 점검 시점(35) 아래지만 이번 달 정비고에 들어가지 않은 비행기
    const tip = advise(s, 0, 20).find((a) => a.key === `check-${pid}`);
    expect(tip?.apply).toBeTruthy();
    expect(tip!.apply!(s).companies[0].planes[0].check).toBe(s.t);
  });

  it('외딴 본사 컴퓨터가 노선 한두 개에 오래 머물지 않고 길을 튼다 (1963년 요하네스버그, 여러 판)', () => {
    for (const seed of [4, 11, 21]) {
      const rng = seededRandom(seed);
      let s = createGame(setup(['ai-normal', 'ai-normal', 'ai-normal', 'ai-normal'], 1963, ['seoul', 'london', 'newyork', 'johannesburg']), rng);
      while (s.phase !== 'gameover' && yearOf(s.q) <= 1972) s = aiTurn(s, rng);
      expect(s.companies[3].routes.length, `seed ${seed}`).toBeGreaterThanOrEqual(8);
      expect(s.companies[3].cash, `seed ${seed}`).toBeGreaterThan(0);
    }
  }, 60000);

  it('컴퓨터끼리 몇 해 두어도 상태는 0~100 안에 있고 점검이 돌아간다', () => {
    const rng = seededRandom(8);
    let s = createGame(setup(['ai-normal', 'ai-easy']), rng);
    let checks = 0;
    while (s.phase !== 'gameover' && yearOf(s.q) <= 2007) {
      s = aiTurn(s, rng);
      if (s.turnPos === 0 && s.report) checks += s.report.companies.reduce((sum, r) => sum + (r.checks ?? 0), 0);
    }
    for (const c of s.companies) for (const p of c.planes) expect(condOf(p)).toBeGreaterThanOrEqual(0);
    for (const c of s.companies) for (const p of c.planes) expect(condOf(p)).toBeLessThanOrEqual(100);
    expect(checks).toBeGreaterThan(0);
  }, 60000);
});
