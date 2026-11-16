import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL } from './aircraft';
import { advise, applyAdvice, applyAdviceAll, isRouteAdvice, topAdvice, type Advice } from './advisor';
import { defaultCabin } from './cabin';
import { RENEW_MIN, applyRenew, budgetOf, fleetRenewPlan, idleOldPlan, isOld, orderFor, pickHow, renewCandidates, renewOption } from './renew';
import { applyAction, createGame, runMonth } from './rules';
import { MAX_DELIVERIES, planeAge } from './simulate';
import { isValidState } from './storage';
import { defaultTimes } from './timetable';
import type { AirlineSetup, AirlineState } from './types';

function setup(): AirlineSetup {
  return {
    seats: [{ kind: 'human', name: '' }, { kind: 'human', name: '' }, { kind: 'empty', name: '' }, { kind: 'empty', name: '' }],
    options: { era: 2003, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'normal', names: 'fictional' },
    hubs: ['seoul', 'london', null, null],
    airlines: [null, null, null, null],
  };
}

const game = () => createGame(setup(), seededRandom(1));

/** 비행기를 손으로 붙인다 (freq 0이면 쉬는 비행기). 비행기 번호를 돌려준다 */
function addPlane(s: AirlineState, a: string, b: string, model: string, freq: number, o: { age?: number; rent?: number; cond?: number } = {}): number {
  const c = s.companies[0];
  for (const city of [a, b]) if (!c.branches.includes(city)) c.branches.push(city);
  let r = c.routes.find((x) => x.a === a && x.b === b);
  if (!r) {
    r = { id: s.nextId++, a, b, fare: 0, since: s.t, stats: null, times: defaultTimes(a, b, 2003) };
    c.routes.push(r);
  }
  const pid = s.nextId++;
  c.planes.push({
    id: pid,
    model,
    leased: !!o.rent,
    rent: o.rent ?? 0,
    deposit: 0,
    since: s.t - Math.round((o.age ?? 0) * 12),
    legs: freq > 0 ? [{ route: r.id, freq }] : [],
    cabin: defaultCabin(MODEL[model]),
    meal: 3,
    cond: o.cond ?? 70,
  });
  return pid;
}

const ROUTES: [string, string][] = [
  ['seoul', 'tokyo'],
  ['seoul', 'osaka'],
  ['seoul', 'beijing'],
  ['seoul', 'shanghai'],
  ['seoul', 'taipei'],
  ['seoul', 'hongkong'],
];

describe('낡은 비행기 바꾸기: 방법 고르기', () => {
  it('급한(닳았거나 25년 넘은) 비행기는 리스로 바로, 돈이 넉넉하면 주문해 둔다', () => {
    const s = game();
    const urgent = addPlane(s, 'seoul', 'tokyo', 'b737-200', 14, { age: 30, rent: 25, cond: 45 });
    const calm = addPlane(s, 'seoul', 'osaka', 'b737-200', 14, { age: 20, cond: 80 });
    const u = renewOption(s, 0, urgent)!;
    expect(u.urgent).toBe(true);
    expect(u.lease!.gain).toBeGreaterThan(RENEW_MIN);
    expect(pickHow(u, budgetOf(s, 0))).toBe('lease');
    const k = renewOption(s, 0, calm)!;
    expect(k.urgent).toBe(false);
    expect(pickHow(k, budgetOf(s, 0))).toBe('order');
    // 돈이 모자라면 주문하지 않는다 (리스로 남는 게 적으면 그대로 둔다)
    const poor = { ...budgetOf(s, 0), cash: 100 };
    expect(pickHow(k, poor)).not.toBe('order');
    // 이번 달 리스 한도를 다 쓰면 급해도 리스하지 않는다
    expect(pickHow(u, { ...budgetOf(s, 0), leaseLeft: 0 })).not.toBe('lease');
  });

  it('노선에 없거나 이미 바꾸려고 주문해 둔 비행기는 따지지 않는다', () => {
    let s = game();
    const idle = addPlane(s, 'seoul', 'tokyo', 'b737-200', 0, { age: 22 });
    const flying = addPlane(s, 'seoul', 'osaka', 'b737-200', 14, { age: 22 });
    expect(renewOption(s, 0, idle)).toBeNull();
    expect(renewCandidates(s, 0).map((p) => p.id)).toEqual([flying]);
    s = applyAction(s, { type: 'buy', model: 'b737-800', replaces: flying });
    expect(orderFor(s.companies[0], flying)).toBeTruthy();
    expect(renewOption(s, 0, flying)).toBeNull();
    expect(renewCandidates(s, 0)).toHaveLength(0);
    // 같은 비행기를 두 번 맡기지 않는다
    s = applyAction(s, { type: 'buy', model: 'b737-800', replaces: flying });
    expect(s.companies[0].orders.filter((o) => o.replaces === flying)).toHaveLength(1);
    expect(isValidState(s)).toBe(true);
  });

  it('계획은 이번 달 리스 한도와 남겨 둘 돈을 넘지 않는다', () => {
    const s = game();
    s.companies[0].cash = 400;
    const ids = ROUTES.map(([a, b]) => addPlane(s, a, b, 'b737-200', 14, { age: 28, rent: 20, cond: 40 }));
    const plan = fleetRenewPlan(s, 0);
    expect(plan.items.length).toBe(MAX_DELIVERIES);
    expect(plan.items.every((x) => x.how === 'lease')).toBe(true);
    expect(plan.kept).toBe(ids.length - MAX_DELIVERIES);
    const res = applyRenew(s, 0, plan.items);
    expect(res.failed).toEqual([]);
    const c = res.state.companies[0];
    expect(c.taken).toBe(MAX_DELIVERIES);
    expect(c.planes.filter((p) => p.model === 'b737-200')).toHaveLength(ids.length - MAX_DELIVERIES);
    // 바꾼 노선은 새 비행기가 같은 횟수로 난다
    for (const it of plan.items) {
      const route = s.companies[0].planes.find((p) => p.id === it.plane)!.legs[0].route;
      const now = c.planes.filter((p) => p.legs.some((l) => l.route === route));
      expect(now).toHaveLength(1);
      expect(now[0].model).toBe(it.to);
      expect(planeAge(res.state, now[0])).toBeLessThan(1);
    }
    expect(isValidState(res.state)).toBe(true);
  });
});

describe('낡은 비행기 바꾸기: 주문해 두면 오면 바꾼다', () => {
  it('주문한 새 비행기가 오면 낡은 비행기의 노선을 넘겨받고, 낡은 비행기는 판다', () => {
    let s = game();
    const old = addPlane(s, 'seoul', 'osaka', 'b737-200', 14, { age: 20, cond: 80 });
    const route = s.companies[0].planes.find((p) => p.id === old)!.legs[0].route;
    const plan = fleetRenewPlan(s, 0);
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].how).toBe('order');
    s = applyRenew(s, 0, plan.items).state;
    const order = s.companies[0].orders[0];
    expect(order.replaces).toBe(old);
    // 바로 다음 달에 오게 한다
    s = { ...s, companies: s.companies.map((c, i) => (i === 0 ? { ...c, orders: c.orders.map((o) => ({ ...o, due: s.t + 1 })) } : c)) };
    s = runMonth(s, seededRandom(2));
    const c = s.companies[0];
    expect(c.orders).toHaveLength(0);
    expect(c.planes.some((p) => p.id === old)).toBe(false);
    const fresh = c.planes.find((p) => p.model === order.model)!;
    expect(fresh.legs).toEqual([{ route, freq: 14 }]);
    expect(s.news.some((n) => n.title.includes('낡은 비행기 1대 바꿈'))).toBe(true);
    expect(isValidState(s)).toBe(true);
  });

  it('바꾸려던 비행기를 그새 팔았으면 새 비행기는 쉬는 비행기로 온다', () => {
    let s = game();
    const old = addPlane(s, 'seoul', 'osaka', 'b737-200', 14, { age: 20, cond: 80 });
    s = applyAction(s, { type: 'buy', model: 'b737-800', replaces: old });
    s = applyAction(s, { type: 'sell', plane: old });
    s = { ...s, companies: s.companies.map((c, i) => (i === 0 ? { ...c, orders: c.orders.map((o) => ({ ...o, due: s.t + 1 })) } : c)) };
    s = runMonth(s, seededRandom(2));
    const fresh = s.companies[0].planes.find((p) => p.model === 'b737-800')!;
    expect(fresh.legs).toEqual([]);
  });
});

describe('쉬는 낡은 비행기 정리', () => {
  it('예비기 몫은 젊은 내 비행기부터 남기고, 나머지 낡은 비행기는 판다 (리스기는 돌려준다)', () => {
    const s = game();
    // 날고 있는 비행기 13대 → 예비기 몫 1대
    for (let i = 0; i < 13; i++) addPlane(s, ...ROUTES[i % ROUTES.length], 'a320', 2);
    const young = addPlane(s, 'seoul', 'tokyo', 'a320', 0, { age: 1 });
    const oldA = addPlane(s, 'seoul', 'tokyo', 'b737-200', 0, { age: 22 });
    const oldB = addPlane(s, 'seoul', 'tokyo', 'b737-200', 0, { age: 24 });
    const oldLease = addPlane(s, 'seoul', 'tokyo', 'b737-200', 0, { age: 21, rent: 10 });
    const plan = idleOldPlan(s, 0);
    expect(plan.need).toBe(1);
    expect(plan.old).toBe(3);
    expect(plan.items.map((x) => x.plane).sort()).toEqual([oldA, oldB, oldLease].sort());
    expect(plan.items.some((x) => x.plane === young)).toBe(false);
    const after = applyRenew(s, 0, plan.items).state.companies[0];
    expect(after.planes.filter((p) => p.legs.length === 0).map((p) => p.id)).toEqual([young]);
  });

  it('젊은 쉬는 비행기가 없으면 낡은 비행기 가운데 젊은 것을 예비기로 남긴다', () => {
    const s = game();
    for (let i = 0; i < 13; i++) addPlane(s, ...ROUTES[i % ROUTES.length], 'a320', 2);
    const a = addPlane(s, 'seoul', 'tokyo', 'b737-200', 0, { age: 19 });
    const b = addPlane(s, 'seoul', 'tokyo', 'b737-200', 0, { age: 26 });
    const plan = idleOldPlan(s, 0);
    expect(plan.items.map((x) => x.plane)).toEqual([b]);
    expect(isOld(s, s.companies[0].planes.find((p) => p.id === a)!)).toBe(true);
  });
});

describe('경영 비서: 낡은·닳은 비행기를 묶어 권하고 한꺼번에 하기', () => {
  it('낡은 비행기가 여럿이면 한 줄로 묶어 권하고, 누르면 모두 바꾼다', () => {
    const s = game();
    s.companies[0].cash = 400;
    for (const [a, b] of ROUTES.slice(0, 3)) addPlane(s, a, b, 'b737-200', 14, { age: 28, rent: 20, cond: 40 });
    const tip = advise(s, 0, 20).find((a) => a.key === 'renew-many');
    expect(tip?.title).toBe('낡은 비행기 3대 바꾸기');
    const res = applyAdvice(tip!, s);
    expect(res.why).toBeNull();
    expect(res.state.companies[0].planes.some((p) => p.model === 'b737-200')).toBe(false);
  });

  it('쉬는 낡은 비행기는 따로 권한 것 말고 묶어서 정리하라고 한다', () => {
    const s = game();
    addPlane(s, 'seoul', 'tokyo', 'a320', 14);
    // 띄울 곳이 없는 아주 먼 곳의 낡은 비행기들 (같은 기종은 한 번만 따져 팔기를 권한다)
    const ids = [0, 1, 2, 3].map(() => addPlane(s, 'seoul', 'tokyo', 'b737-200', 0, { age: 24 }));
    const tips = advise(s, 0, 20);
    const one = tips.filter((a) => ids.some((id) => a.key === `idle-sell-${id}` || a.key === `idle-${id}` || a.key.startsWith(`route-plane${id}-`)));
    const group = tips.find((a) => a.key.startsWith('idleold-'));
    expect(group, tips.map((a) => a.key).join(' ')).toBeTruthy();
    const res = applyAdvice(group!, s);
    expect(res.why).toBeNull();
    // 따로 권한 비행기만 남는다
    expect(res.state.companies[0].planes.filter((p) => p.model === 'b737-200')).toHaveLength(one.length);
  });

  it('아주 닳은 비행기가 여럿이면 한꺼번에 C점검을 권한다', () => {
    const s = game();
    const ids = ROUTES.slice(0, 3).map(([a, b]) => addPlane(s, a, b, 'a320', 14, { age: 2, cond: 20 }));
    const tip = advise(s, 0, 20).find((a) => a.key === 'check-many');
    expect(tip?.title).toBe('많이 닳은 비행기 3대 C점검 보내기');
    const res = applyAdvice(tip!, s);
    expect(res.why).toBeNull();
    for (const id of ids) expect(res.state.companies[0].planes.find((p) => p.id === id)!.check).toBe(s.t);
  });

  it('고른 권유를 차례로 하고, 못 하는 것은 까닭과 함께 건너뛴다', () => {
    const s = game();
    const ok: Advice = { key: 'a', icon: '', title: '광고', detail: '', weight: 1, apply: (x) => applyAction(x, { type: 'setAds', region: 'eastasia', amount: 5 }) };
    const no: Advice = { key: 'b', icon: '', title: '없는 비행기 팔기', detail: '', weight: 1, apply: (x) => applyAction(x, { type: 'sell', plane: 99999 }) };
    const info: Advice = { key: 'c', icon: '', title: '알림', detail: '', weight: 1 };
    const choice: Advice = { key: 'choice', icon: '', title: '결정', detail: '', weight: 1, apply: (x) => x };
    const res = applyAdviceAll([ok, no, info, choice], s);
    expect(res.done.map((a) => a.key)).toEqual(['a']);
    expect(res.failed.map((f) => f.advice.key)).toEqual(['b']);
    expect(res.state.companies[0].ads.eastasia).toBe(5);
  });

  it('처음에 보여 줄 몇 개만 고를 때도 새 노선 권유 자리는 남긴다', () => {
    const mk = (key: string): Advice => ({ key, icon: '', title: key, detail: '', weight: 1 });
    const list = [mk('choice'), mk('hire'), mk('pay'), mk('ads'), mk('tank'), mk('fuelbuy'), mk('route-seoul-tokyo')];
    const top = topAdvice(list, 5);
    expect(top).toHaveLength(5);
    expect(top.some(isRouteAdvice)).toBe(true);
    expect(top[0].key).toBe('choice');
    expect(topAdvice(list.slice(0, 3), 5)).toHaveLength(3);
  });
});
