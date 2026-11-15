import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL } from './aircraft';
import { aiManage } from './ai';
import { advise } from './advisor';
import { defaultCabin } from './cabin';
import { checkCost } from './condition';
import { BASE_CHECK, FACILITY_INFO, FACILITY_REFUND, companyCheckCost, extraCheckSlots, facilityBlocker, facilityCost, wearMult } from './facilities';
import { actor, applyAction, closeBranchBlocker, createGame } from './rules';
import { companyValue, computeMonth, opsRates, reputationTarget, slotCapacity } from './simulate';
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

const game = (kinds: SeatKind[] = ['human', 'human']) => createGame(setup(kinds), seededRandom(3));

function act(s: AirlineState, ...actions: AirlineAction[]): AirlineState {
  for (const a of actions) {
    const next = applyAction(s, a, seededRandom(5));
    expect(next, JSON.stringify(a)).not.toBe(s);
    s = next;
  }
  return s;
}

/** 본사 슬롯을 줄여 노선 몇 개로도 거의 차게 한다 */
function tightHub(s: AirlineState, ci: number, value = 0.45): void {
  s.companies[ci].mods.push({ id: s.nextId++, kind: 'slot', value, until: s.t + 240, label: '시험', city: s.companies[ci].hub });
}

function addRoute(s: AirlineState, ci: number, a: string, b: string, model: string, freq: number): number {
  const c = s.companies[ci];
  for (const city of [a, b]) if (!c.branches.includes(city)) c.branches.push(city);
  const rid = s.nextId++;
  c.routes.push({ id: rid, a, b, fare: 0, since: s.t, stats: null, times: defaultTimes(a, b, 2003) });
  c.planes.push({ id: s.nextId++, model, leased: true, rent: 3, deposit: 0, since: s.t, legs: [{ route: rid, freq }], cabin: defaultCabin(MODEL[model]), meal: 3, cond: 80 });
  return rid;
}

describe('공항 시설', () => {
  it('지점이 있는 공항에만, 한 종류에 하나씩, 공항 크기에 맞게 짓는다', () => {
    let s = game();
    expect(facilityBlocker(s, 0, 'tokyo', 'lounge')).toMatch(/지점/);
    const cash = s.companies[0].cash;
    const cost = facilityCost('seoul', 'lounge', s.q);
    s = act(s, { type: 'buildFacility', city: 'seoul', kind: 'lounge' });
    expect(s.companies[0].cash).toBeCloseTo(cash - cost, 6);
    expect(s.companies[0].facilities).toEqual([{ city: 'seoul', kind: 'lounge', cost }]);
    expect(facilityBlocker(s, 0, 'seoul', 'lounge')).toMatch(/이미/);
    // 작은 공항에는 전용 터미널을 못 짓는다
    s.companies[0].branches.push('jeju');
    expect(facilityBlocker(s, 0, 'jeju', 'terminal')).toMatch(/공항/);
    // 시설이 있는 지점은 먼저 팔아야 닫는다
    s.companies[0].branches.push('busan');
    s.companies[0].cash = 9999;
    s = act(s, { type: 'buildFacility', city: 'busan', kind: 'lounge' });
    expect(closeBranchBlocker(s, 0, 'busan')).toMatch(/시설/);
    const before = s.companies[0].cash;
    const f = s.companies[0].facilities!.find((x) => x.city === 'busan')!;
    s = act(s, { type: 'sellFacility', city: 'busan', kind: 'lounge' });
    expect(s.companies[0].cash).toBeCloseTo(before + Math.round(f.cost * FACILITY_REFUND), 6);
    expect(closeBranchBlocker(s, 0, 'busan')).toBeNull();
  });

  it('라운지: 그 도시 노선의 사업 손님과 평판이 늘고, 유지비가 지점·시설 유지비에 든다', () => {
    let s = game();
    addRoute(s, 0, 'seoul', 'tokyo', 'a330-300', 14);
    const before = computeMonth(s).reports[0];
    const repBefore = reputationTarget(s, s.companies[0]);
    s = act(s, { type: 'buildFacility', city: 'seoul', kind: 'lounge' });
    const after = computeMonth(s).reports[0];
    expect(after.ticket).toBeGreaterThan(before.ticket);
    expect(after.branch).toBeGreaterThan(before.branch);
    expect(reputationTarget(s, s.companies[0])).toBeCloseTo(repBefore + 1, 6);
  });

  it('전용 터미널: 슬롯이 25% 늘고 붐빔이 덜하다', () => {
    let s = game();
    const rid = addRoute(s, 0, 'seoul', 'tokyo', 'b737-800', 28);
    const cap = slotCapacity(s, 0, 'seoul');
    const late = opsRates(s, 0, rid).late;
    s.companies[0].cash = 9999;
    s = act(s, { type: 'buildFacility', city: 'seoul', kind: 'terminal' });
    expect(slotCapacity(s, 0, 'seoul')).toBe(Math.round(cap * 1.25));
    expect(opsRates(s, 0, rid).late).toBeLessThanOrEqual(late);
  });

  it('정비 기지: C점검이 싸고 자리가 늘며 덜 닳는다', () => {
    let s = game();
    addRoute(s, 0, 'seoul', 'tokyo', 'b737-800', 14);
    const p = s.companies[0].planes[0];
    expect(companyCheckCost(s.companies[0], p)).toBe(checkCost(p));
    s = act(s, { type: 'buildFacility', city: 'seoul', kind: 'base' });
    expect(companyCheckCost(s.companies[0], p)).toBeCloseTo(checkCost(p, BASE_CHECK), 6);
    expect(extraCheckSlots(s.companies[0])).toBe(2);
    expect(wearMult(s.companies[0])).toBeLessThan(1);
  });

  it('시설은 회사 가치에 지은 값의 60%로 들어간다', () => {
    let s = game();
    const v = companyValue(s, 0);
    const cost = facilityCost('seoul', 'base', s.q);
    s = act(s, { type: 'buildFacility', city: 'seoul', kind: 'base' });
    expect(companyValue(s, 0)).toBeCloseTo(v - cost + cost * 0.6, 6);
  });

  it('저장에 시설이 남고, 망가진 시설은 거른다', () => {
    let s = game();
    s = act(s, { type: 'buildFacility', city: 'seoul', kind: 'lounge' });
    const back = parseSaved(JSON.parse(JSON.stringify({ setup: setup(['human', 'human']), state: s, savedAt: 1 })));
    expect(back?.state.companies[0].facilities?.[0].kind).toBe('lounge');
    const broken = JSON.parse(JSON.stringify(s));
    broken.companies[0].facilities[0].kind = 'casino';
    expect(isValidState(broken)).toBe(false);
  });

  it('보통 컴퓨터는 본사 슬롯이 차면 10월에 전용 터미널을 짓는다', () => {
    let s = game(['ai-normal', 'human']);
    // 컴퓨터가 같은 차례에 빈 노선의 횟수를 줄여도 본사가 꽉 차 있게
    tightHub(s, 0, 0.2);
    for (const b of ['tokyo', 'osaka', 'beijing', 'shanghai', 'hongkong', 'taipei', 'bangkok']) addRoute(s, 0, 'seoul', b, 'b737-800', 26);
    s.companies[0].cash = 20000;
    for (let k = 0; k < 60 && !(actor(s) === 0 && s.t % 12 === 9 && s.t % 3 === 0); k++) s = applyAction(s, { type: 'endTurn' }, seededRandom(k));
    expect(actor(s)).toBe(0);
    s.companies[0].cash = 20000;
    const managed = aiManage(s, 0, 'ai-normal', seededRandom(1));
    expect(managed.companies[0].facilities?.some((f) => f.kind === 'terminal' && f.city === 'seoul')).toBe(true);
  });

  it('비서는 본사 슬롯이 거의 차면 전용 터미널을 권한다', () => {
    const s = game();
    tightHub(s, 0);
    for (const b of ['tokyo', 'osaka', 'beijing', 'shanghai', 'hongkong', 'taipei', 'bangkok']) addRoute(s, 0, 'seoul', b, 'b737-800', 26);
    s.companies[0].cash = 9999;
    const tip = advise(s, 0, 20).find((a) => a.key === 'terminal');
    expect(tip?.apply).toBeTruthy();
    expect(tip!.apply!(s).companies[0].facilities?.[0].kind).toBe('terminal');
    expect(FACILITY_INFO.terminal.minAirport).toBe(3);
  });
});
