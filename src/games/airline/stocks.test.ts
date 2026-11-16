import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL } from './aircraft';
import { aiManage, aiTurn } from './ai';
import { defaultCabin } from './cabin';
import { HUMAN_CAP, MAX_HELD, buyCost, buyStakeBlocker, buyoutCost, heldTotal, issueBlocker, mergeBlocker, pricePerPct, shareholders, stakeOf } from './stocks';
import { actor, applyAction, createGame, runMonth } from './rules';
import { baseValue, companyValue, marketCap, slotCapacity, slotsUsed, valuationMult } from './simulate';
import { isValidState } from './storage';
import { defaultTimes } from './timetable';
import { yearOf } from './time';
import type { AirlineAction, AirlineSetup, AirlineState, SeatKind } from './types';

function setup(kinds: SeatKind[]): AirlineSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as AirlineSetup['seats'],
    options: { era: 2003, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'normal', names: 'fictional' },
    hubs: ['seoul', 'london', 'newyork', null],
    airlines: [null, null, null, null],
  };
}

function act(s: AirlineState, ...actions: AirlineAction[]): AirlineState {
  for (const a of actions) {
    const next = applyAction(s, a, seededRandom(5));
    expect(next, JSON.stringify(a)).not.toBe(s);
    s = next;
  }
  return s;
}

function addRoute(s: AirlineState, ci: number, a: string, b: string, model: string, freq: number): number {
  const c = s.companies[ci];
  for (const city of [a, b]) if (!c.branches.includes(city)) c.branches.push(city);
  const rid = s.nextId++;
  c.routes.push({ id: rid, a, b, fare: 0, since: s.t, stats: null, times: defaultTimes(a, b, 2003) });
  c.planes.push({ id: s.nextId++, model, leased: true, rent: 3, deposit: 0, since: s.t, legs: [{ route: rid, freq }], cabin: defaultCabin(MODEL[model]), meal: 3, cond: 80 });
  return rid;
}

describe('주식과 인수합병', () => {
  it('주가는 시가 총액의 1%이고, 이익을 많이 낸 회사일수록 배수가 높다', () => {
    const s = createGame(setup(['human', 'ai-normal']), seededRandom(1));
    expect(valuationMult(s, 0)).toBeCloseTo(0.9, 6);
    expect(marketCap(s, 0)).toBeCloseTo(baseValue(s, 0) * 0.9, 6);
    s.ledger = [{ q: s.q, t: s.t, span: 1, companies: [{ ...s.companies.map(() => ({}))[0], profit: 600 } as never, { profit: -100 } as never], routes: [], news: [], xfers: [], ops: [] }];
    expect(valuationMult(s, 0)).toBeGreaterThan(1.3);
    expect(valuationMult(s, 1)).toBeLessThan(0.9);
    expect(pricePerPct(s, 0)).toBeCloseTo(marketCap(s, 0) / 100, 6);
  });

  it('사면 몫이 늘고 값이 오르며, 가진 주식은 회사 가치에 시가로 들어간다', () => {
    let s = createGame(setup(['human', 'ai-normal']), seededRandom(1));
    const before = companyValue(s, 0);
    const cost = buyCost(s, 1, 10);
    s = act(s, { type: 'buyStake', company: 1, pct: 10 });
    expect(stakeOf(s, 1, 0)).toBe(10);
    expect(s.companies[0].cash).toBeCloseTo(2500 - cost, 6);
    // 남이 많이 가질수록 비싸진다
    expect(pricePerPct(s, 1)).toBeGreaterThan(marketCap(s, 1) / 100);
    // 가치 = 남은 현금 + 주식 시가 (산 값보다 조금 적다: 오른 값을 치렀으니)
    expect(companyValue(s, 0)).toBeCloseTo(before - cost + marketCap(s, 1) * 0.1, 4);
    s = act(s, { type: 'sellStake', company: 1, pct: 4 });
    expect(stakeOf(s, 1, 0)).toBe(6);
  });

  it('남들이 가질 수 있는 몫은 70%까지, 사람 회사는 한 회사가 49%까지', () => {
    let s = createGame(setup(['human', 'human', 'ai-normal']), seededRandom(1));
    s.companies[0].cash = 99999;
    expect(buyStakeBlocker(s, 0, 1, HUMAN_CAP + 1)).toMatch(/사람 회사/);
    s = act(s, { type: 'buyStake', company: 1, pct: HUMAN_CAP });
    expect(buyStakeBlocker(s, 0, 1, 1)).toMatch(/사람 회사/);
    s = act(s, { type: 'buyStake', company: 2, pct: 10 }, { type: 'buyStake', company: 2, pct: 10 }, { type: 'buyStake', company: 2, pct: 10 }, { type: 'buyStake', company: 2, pct: 10 });
    expect(heldTotal(s, 2)).toBe(40);
    expect(buyStakeBlocker(s, 0, 2, MAX_HELD - 40 + 1)).toMatch(/창업자/);
  });

  it('흑자 분기에는 이익의 20%를 주주 회사에게 몫만큼 배당한다', () => {
    let s = createGame(setup(['human', 'human']), seededRandom(1));
    addRoute(s, 1, 'london', 'paris', 'a320', 14);
    addRoute(s, 1, 'london', 'newyork', 'b777-300', 7);
    s.companies[0].cash = 9999;
    s = act(s, { type: 'buyStake', company: 1, pct: 20 });
    // 분기 끝(3월)까지
    let guard = 0;
    while (s.t % 3 !== 2 && guard++ < 10) s = runMonth(s, seededRandom(guard));
    const cash0 = s.companies[0].cash;
    const cash1 = s.companies[1].cash;
    const after = runMonth(s, seededRandom(3));
    const qp = after.qReport!.companies[1].profit;
    if (qp > 0) {
      const div = qp * 0.2 * 0.2;
      expect(after.companies[0].cash - cash0 - after.report!.companies[0].profit).toBeCloseTo(div, 4);
      expect(after.companies[1].cash - cash1 - after.report!.companies[1].profit).toBeCloseTo(-div, 4);
    }
  });

  it('증자: 돈을 마련하고 다른 회사들 몫이 줄며, 한 해에 한 번', () => {
    let s = createGame(setup(['human', 'human']), seededRandom(1));
    // 회사 1이 회사 0의 주식 11%를 가지고 있다
    s.stakes = [
      [0, 11],
      [0, 0],
    ];
    expect(actor(s)).toBe(0);
    const cash = s.companies[0].cash;
    s = act(s, { type: 'issueShares' });
    expect(s.companies[0].cash).toBeGreaterThan(cash);
    expect(stakeOf(s, 0, 1)).toBeCloseTo(10, 1);
    expect(issueBlocker(s, 0)).toMatch(/한 해/);
  });

  it('주주 목록: 몫이 큰 회사부터, 자기 몫은 빼고, 나머지는 창업자·일반 주주', () => {
    const s = {
      stakes: [
        [0, 4.5, 12, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
    };
    expect(shareholders(s, 0)).toEqual({
      holders: [
        { j: 2, pct: 12 },
        { j: 1, pct: 4.5 },
      ],
      founder: 83.5,
    });
    expect(shareholders(s, 1)).toEqual({ holders: [], founder: 100 });
    expect(shareholders({}, 0)).toEqual({ holders: [], founder: 100 });
  });

  it('과반을 가진 컴퓨터 회사를 인수하면 노선·비행기·지점·현금·빚을 넘겨받고 그 회사는 빠진다', () => {
    let s = createGame(setup(['human', 'ai-normal', 'ai-easy']), seededRandom(1));
    addRoute(s, 1, 'london', 'paris', 'a320', 14);
    addRoute(s, 1, 'london', 'seoul', 'b777-300', 7);
    addRoute(s, 0, 'seoul', 'london', 'b777-300', 7);
    s.companies[1].debt = 300;
    s.companies[0].cash = 99999;
    s = act(s, { type: 'buyStake', company: 2, pct: 5 });
    expect(mergeBlocker(s, 0, 1)).toMatch(/51%/);
    s = act(s, { type: 'buyStake', company: 1, pct: 10 }, { type: 'buyStake', company: 1, pct: 10 }, { type: 'buyStake', company: 1, pct: 10 }, { type: 'buyStake', company: 1, pct: 10 }, { type: 'buyStake', company: 1, pct: 10 }, { type: 'buyStake', company: 1, pct: 1 });
    expect(mergeBlocker(s, 0, 1)).toBeNull();
    const planes = s.companies[0].planes.length + s.companies[1].planes.length;
    const routes0 = s.companies[0].routes.length;
    const cost = buyoutCost(s, 0, 1);
    const cash = s.companies[0].cash + s.companies[1].cash;
    s = act(s, { type: 'merge', company: 1 });
    const a = s.companies[0];
    expect(s.companies[1].out).toBe(true);
    expect(s.companies[1].mergedInto).toBe(0);
    expect(a.planes.length).toBe(planes);
    // 서울–런던은 겹쳐서 하나로 합치고, 런던–파리는 넘겨받는다
    expect(a.routes.length).toBe(routes0 + 1);
    expect(a.branches).toContain('paris');
    expect(a.debt).toBe(300);
    expect(a.cash).toBeCloseTo(cash - cost, 4);
    expect(stakeOf(s, 1, 0)).toBe(0);
    // 모든 비행기가 있는 노선을 난다
    const ids = new Set(a.routes.map((r) => r.id));
    for (const p of a.planes) for (const l of p.legs) expect(ids.has(l.route)).toBe(true);
    expect(s.news.some((n) => n.title.includes('인수'))).toBe(true);
    // 합친 뒤에도 공항 슬롯을 넘지 않는다
    for (const city of a.branches) expect(slotsUsed(a, city)).toBeLessThanOrEqual(slotCapacity(s, 0, city));
    expect(isValidState(s)).toBe(true);
  });

  it('사람 회사는 인수할 수 없다', () => {
    const s = createGame(setup(['ai-normal', 'human']), seededRandom(1));
    s.stakes = [
      [0, 0],
      [0, 0],
    ];
    expect(mergeBlocker(s, 0, 1)).toMatch(/사람 회사/);
  });

  it('저장에 주식 표가 남고, 망가진 표는 거른다', () => {
    let s = createGame(setup(['human', 'human']), seededRandom(1));
    s = act(s, { type: 'buyStake', company: 1, pct: 5 });
    expect(isValidState(s)).toBe(true);
    const broken = JSON.parse(JSON.stringify(s));
    broken.stakes[1][0] = 140;
    expect(isValidState(broken)).toBe(false);
  });

  it('치열한 컴퓨터는 다섯 해가 지나면 아주 작은 컴퓨터 회사를 사들여 합친다', () => {
    let s = createGame({ ...setup(['ai-normal', 'ai-easy']), options: { ...setup(['ai-normal', 'ai-easy']).options, aiStyle: 'fierce' } }, seededRandom(1));
    addRoute(s, 1, 'london', 'paris', 'a320', 14);
    s.companies[0].cash = 60000;
    s.companies[1].cash = 300;
    for (let k = 0; k < 10 && !(actor(s) === 0 && s.t % 3 === 0); k++) s = applyAction(s, { type: 'endTurn' }, seededRandom(k));
    s.companies[0].cash = 60000;
    // 다섯 해가 지난 판으로
    s.startT = s.t - 61;
    s.startQ = Math.floor(s.startT / 3);
    const managed = aiManage(s, 0, 'ai-normal', seededRandom(1));
    expect(managed.companies[1].out).toBe(true);
    expect(managed.companies[1].mergedInto).toBe(0);
  });

  it('컴퓨터끼리 몇 해 두어도 주식 표가 규칙을 지킨다', () => {
    const rng = seededRandom(21);
    let s = createGame({ ...setup(['ai-normal', 'ai-normal', 'ai-easy']), options: { ...setup([]).options, aiStyle: 'fierce' } }, rng);
    while (s.phase !== 'gameover' && yearOf(s.q) <= 2012) {
      s = aiTurn(s, rng);
      for (let i = 0; i < s.companies.length; i++) {
        expect(heldTotal(s, i)).toBeLessThanOrEqual(MAX_HELD + 0.01);
        if (s.companies[i].kind === 'human') for (let j = 0; j < s.companies.length; j++) expect(stakeOf(s, i, j)).toBeLessThanOrEqual(HUMAN_CAP + 0.01);
      }
    }
    expect(isValidState(s)).toBe(true);
    for (let i = 0; i < s.companies.length; i++) expect(Number.isFinite(companyValue(s, i))).toBe(true);
  }, 60000);
});
