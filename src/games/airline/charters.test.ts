import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL } from './aircraft';
import { aiManage, aiTurn } from './ai';
import { advise } from './advisor';
import { defaultCabin } from './cabin';
import { MAX_OFFERS, charterBlocker, charterProfit, myCharters, openCharters, refreshCharters, tripsFor } from './charters';
import { actor, applyAction, assignBlocker, createGame, sellBlocker } from './rules';
import { computeMonth } from './simulate';
import { isValidState } from './storage';
import { defaultTimes } from './timetable';
import { yearOf } from './time';
import type { AirlineAction, AirlineSetup, AirlineState, CharterOffer, SeatKind } from './types';

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

/** 쉬는 비행기 한 대를 붙인다 */
function addIdle(s: AirlineState, ci: number, model: string): number {
  const id = s.nextId++;
  s.companies[ci].planes.push({ id, model, leased: true, rent: 3, deposit: 0, since: s.t, legs: [], cabin: defaultCabin(MODEL[model]), meal: 3, cond: 90 });
  return id;
}

/** 의뢰를 하나 올린다 */
function addOffer(s: AirlineState, o: Partial<CharterOffer> = {}): CharterOffer {
  const offer: CharterOffer = { id: s.nextId++, a: 'seoul', b: 'osaka', pax: 1800, pay: 30, title: '수학여행 단체', icon: '🎒', listed: s.t, expires: s.t + 2, ...o };
  s.charters = [...(s.charters ?? []), offer];
  return offer;
}

describe('전세기 계약', () => {
  it('달마다 게시판에 의뢰가 올라오고, 지난 의뢰는 내려간다 (많아야 여섯 건)', () => {
    let s = game();
    for (let k = 0; k < 40; k++) {
      s = refreshCharters({ ...s, t: s.t + 1 }, seededRandom(k));
      expect(openCharters(s).length).toBeLessThanOrEqual(MAX_OFFERS);
      for (const o of openCharters(s)) {
        expect(o.a).not.toBe(o.b);
        expect(o.pay).toBeGreaterThan(0);
        expect(o.expires).toBeGreaterThanOrEqual(s.t);
      }
    }
    expect((s.charters ?? []).length).toBeGreaterThan(0);
  });

  it('쉬는 비행기·항속 거리·좌석과 비행시간·지점을 따진다', () => {
    const s = game();
    const small = addIdle(s, 0, 'b737-800');
    const o = addOffer(s);
    expect(charterBlocker(s, 0, o.id, small)).toBeNull();
    expect(tripsFor(o, s.companies[0].planes.find((p) => p.id === small)!)).toBe(Math.ceil(1800 / MODEL['b737-800'].seats));
    // 지점이 없는 두 도시
    const far = addOffer(s, { a: 'paris', b: 'rome' });
    expect(charterBlocker(s, 0, far.id, small)).toMatch(/지점/);
    // 항속 거리가 모자라는 먼 의뢰
    const longHaul = addOffer(s, { a: 'seoul', b: 'saopaulo' });
    expect(charterBlocker(s, 0, longHaul.id, small)).toMatch(/항속/);
    // 손님이 너무 많아 한 달에 다 못 나른다
    const huge = addOffer(s, { a: 'seoul', b: 'sydney', pax: 20000 });
    const wide = addIdle(s, 0, 'b777-300');
    expect(charterBlocker(s, 0, huge.id, wide)).toMatch(/한 달/);
    // 화물기는 손님을 못 태운다
    const freighterId = Object.values(MODEL).find((m) => m.seats === 0)?.id;
    if (freighterId) expect(charterBlocker(s, 0, o.id, addIdle(s, 0, freighterId))).toMatch(/화물기/);
  });

  it('맡으면 그달 비행기가 묶이고(노선·팔기 안 됨), 달 결산에 보수와 비용이 들어간 뒤 게시판에서 내려간다', () => {
    let s = game();
    const pid = addIdle(s, 0, 'b737-800');
    const o = addOffer(s);
    s.companies[0].routes.push({ id: s.nextId++, a: 'seoul', b: 'tokyo', fare: 0, since: s.t, stats: null, times: defaultTimes('seoul', 'tokyo', 2003) });
    const rid = s.companies[0].routes[0].id;
    const before = computeMonth(s).reports[0];
    s = act(s, { type: 'charter', offer: o.id, plane: pid });
    expect(myCharters(s, 0).map((x) => x.id)).toEqual([o.id]);
    expect(openCharters(s).some((x) => x.id === o.id)).toBe(false);
    expect(sellBlocker(s, 0, pid)).toMatch(/전세기/);
    expect(assignBlocker(s, 0, pid, rid, 2)).toMatch(/전세기/);
    // 다른 회사는 이제 못 맡는다
    expect(charterBlocker(s, 1, o.id, pid)).toMatch(/맡았어요/);
    const after = computeMonth(s).reports[0];
    expect(after.charters).toBe(1);
    expect(after.side - before.side).toBeCloseTo(o.pay, 6);
    expect(after.fuel).toBeGreaterThan(before.fuel);
    const profit = charterProfit(s, 0, o, s.companies[0].planes.find((p) => p.id === pid)!);
    expect(after.profit - before.profit).toBeLessThan(o.pay);
    expect(profit).toBeLessThan(o.pay);
    s = act(s, { type: 'endTurn' }, { type: 'endTurn' });
    expect((s.charters ?? []).some((x) => x.id === o.id)).toBe(false);
  });

  it('너무 큰 비행기는 빈 좌석에 연료를 태워 덜 남는다', () => {
    const s = game();
    const o = addOffer(s, { pax: 1500 });
    const small = addIdle(s, 0, 'a320');
    const big = addIdle(s, 0, 'b747-400');
    const p = (id: number) => s.companies[0].planes.find((x) => x.id === id)!;
    expect(charterProfit(s, 0, o, p(small))).toBeGreaterThan(charterProfit(s, 0, o, p(big)));
  });

  it('전세기로 나간 비행기는 그달 C점검을 메우는 예비기가 되지 못한다', () => {
    let s = game();
    const rid = s.nextId++;
    s.companies[0].routes.push({ id: rid, a: 'seoul', b: 'tokyo', fare: 0, since: s.t, stats: null, times: defaultTimes('seoul', 'tokyo', 2003) });
    s.companies[0].planes.push({ id: s.nextId++, model: 'b737-800', leased: true, rent: 3, deposit: 0, since: s.t, legs: [{ route: rid, freq: 14 }], cabin: defaultCabin(MODEL['b737-800']), meal: 3, cond: 40, check: s.t });
    const spare = addIdle(s, 0, 'b737-800');
    const covered = computeMonth(s).reports[0].seats;
    const o = addOffer(s);
    s = act(s, { type: 'charter', offer: o.id, plane: spare });
    expect(computeMonth(s).reports[0].seats).toBeLessThan(covered);
  });

  it('저장에 게시판이 남고, 망가진 의뢰는 거른다', () => {
    const s = game();
    addOffer(s);
    expect(isValidState(s)).toBe(true);
    const broken = JSON.parse(JSON.stringify(s));
    broken.charters[0].a = 'atlantis';
    expect(isValidState(broken)).toBe(false);
  });

  it('보통 컴퓨터는 남는 의뢰를 쉬는 비행기로 맡는다', () => {
    let s = game(['ai-normal', 'human']);
    addIdle(s, 0, 'b737-800');
    for (let k = 0; k < 10 && actor(s) !== 0; k++) s = applyAction(s, { type: 'endTurn' }, seededRandom(k));
    const o = addOffer(s, { pay: 80 });
    const managed = aiManage(s, 0, 'ai-normal', seededRandom(1));
    expect(myCharters(managed, 0).some((x) => x.id === o.id)).toBe(true);
  });

  it('비서는 남는 의뢰를 권하고 한 번에 맡긴다', () => {
    const s = game();
    addIdle(s, 0, 'b737-800');
    const o = addOffer(s, { pay: 80 });
    const tip = advise(s, 0, 20).find((a) => a.key === `charter-${o.id}`);
    expect(tip?.apply).toBeTruthy();
    expect(myCharters(tip!.apply!(s), 0).length).toBe(1);
  });

  it('컴퓨터끼리 몇 해 두면 의뢰가 오가고 게시판이 넘치지 않는다', () => {
    const rng = seededRandom(12);
    let s = createGame(setup(['ai-normal', 'ai-normal']), rng);
    let flown = 0;
    while (s.phase !== 'gameover' && yearOf(s.q) <= 2008) {
      s = aiTurn(s, rng);
      if (s.turnPos === 0 && s.report) flown += s.report.companies.reduce((sum, r) => sum + (r.charters ?? 0), 0);
      expect((s.charters ?? []).length).toBeLessThanOrEqual(MAX_OFFERS + 4);
    }
    expect(flown).toBeGreaterThan(0);
  }, 60000);
});
