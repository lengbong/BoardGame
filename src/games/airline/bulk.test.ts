import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL } from './aircraft';
import { applyFarePlan, applyRenewPlan, applyTimesPlan, farePlan, renewPlan, timesPlan } from './bulk';
import { defaultCabin } from './cabin';
import { createGame } from './rules';
import { estimateExisting, planeAge } from './simulate';
import type { AirlineSetup, AirlineState } from './types';

function setup(): AirlineSetup {
  return {
    seats: [{ kind: 'human', name: '' }, { kind: 'human', name: '' }, { kind: 'empty', name: '' }, { kind: 'empty', name: '' }],
    options: { era: 2003, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'normal', names: 'fictional' },
    hubs: ['seoul', 'london', null, null],
    airlines: [null, null, null, null],
  };
}

function addRoute(s: AirlineState, a: string, b: string, model: string, freq: number, opts: { fare?: number; times?: [number, number, number, number]; age?: number; rent?: number } = {}): number {
  const c = s.companies[0];
  for (const city of [a, b]) if (!c.branches.includes(city)) c.branches.push(city);
  const rid = s.nextId++;
  c.routes.push({ id: rid, a, b, fare: opts.fare ?? 0, since: s.t, stats: null, times: opts.times ?? [3, 2, 4, 0] });
  c.planes.push({ id: s.nextId++, model, leased: !!opts.rent, rent: opts.rent ?? 0, deposit: 0, since: s.t - Math.round((opts.age ?? 0) * 12), legs: [{ route: rid, freq }], cabin: defaultCabin(MODEL[model]), meal: 3, cond: 70 });
  return rid;
}

const total = (s: AirlineState) => s.companies[0].routes.reduce((sum, r) => sum + estimateExisting(s, 0, r).profit, 0);

describe('한꺼번에 고치기', () => {
  it('운임: 너무 싸거나 비싼 노선들의 운임을 한꺼번에 이익이 더 나는 쪽으로 바꾼다', () => {
    const s = createGame(setup(), seededRandom(1));
    addRoute(s, 'seoul', 'tokyo', 'a330-300', 14, { fare: -30 });
    addRoute(s, 'seoul', 'bangkok', 'a330-300', 7, { fare: 30 });
    addRoute(s, 'seoul', 'osaka', 'a320', 14, { fare: -30 });
    const plan = farePlan(s, 0);
    expect(plan.items.length).toBeGreaterThan(0);
    expect(plan.gain).toBeGreaterThan(0);
    const after = applyFarePlan(s, plan);
    expect(after).not.toBe(s);
    expect(total(after)).toBeGreaterThan(total(s));
  });

  it('시간표: 맞지 않는 시간대를 한꺼번에 고친다', () => {
    const s = createGame(setup(), seededRandom(1));
    addRoute(s, 'seoul', 'tokyo', 'a330-300', 14, { times: [0, 0, 0, 1] });
    addRoute(s, 'seoul', 'beijing', 'a320', 14, { times: [0, 0, 0, 1] });
    addRoute(s, 'seoul', 'osaka', 'a320', 14, { times: [0, 0, 0, 1] });
    const plan = timesPlan(s, 0);
    expect(plan.items.length).toBeGreaterThan(0);
    const after = applyTimesPlan(s, plan);
    expect(total(after)).toBeGreaterThan(total(s));
    expect(after.companies[0].routes.some((r) => r.times[3] === 0)).toBe(true);
  });

  it('낡은 비행기: 열여덟 해 넘은 비행기를 같은 노선에서 더 버는 새 리스기로 바꾼다', () => {
    const s = createGame({ ...setup(), options: { ...setup().options, era: 2003 } }, seededRandom(1));
    // 비싼 리스료를 내는 낡은 리스기 (내 것이면 리스료가 없어 그대로 두는 편이 나을 수 있다)
    const rid = addRoute(s, 'seoul', 'tokyo', 'b747-100', 7, { age: 30, rent: 25 });
    addRoute(s, 'seoul', 'osaka', 'a320', 14);
    addRoute(s, 'seoul', 'bangkok', 'a330-300', 7);
    const plan = renewPlan(s, 0);
    expect(plan.items.length).toBe(1);
    expect(plan.items[0].from).toBe('b747-100');
    const after = applyRenewPlan(s, 0, plan);
    const c = after.companies[0];
    expect(c.planes.some((p) => p.model === 'b747-100')).toBe(false);
    const onRoute = c.planes.filter((p) => p.legs.some((l) => l.route === rid));
    expect(onRoute.length).toBe(1);
    expect(onRoute[0].model).toBe(plan.items[0].to);
    expect(planeAge(after, onRoute[0])).toBeLessThan(1);
  });

  it('고칠 곳이 없으면 빈 계획이고 상태도 그대로다', () => {
    const s = createGame(setup(), seededRandom(1));
    expect(farePlan(s, 0).items).toEqual([]);
    expect(applyTimesPlan(s, timesPlan(s, 0))).toBe(s);
    expect(renewPlan(s, 0).items).toEqual([]);
  });
});
