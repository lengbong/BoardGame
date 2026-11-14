/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { aiTurn } from './ai';
import { createGame } from './rules';
import { DEFAULT_SETUP, isValidState, parseOptions, parseSaved } from './storage';
import type { AirlineSetup, AirlineState } from './types';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function played(quarters: number): { setup: AirlineSetup; state: AirlineState } {
  const setup: AirlineSetup = {
    ...DEFAULT_SETUP,
    seats: [
      { kind: 'ai-normal', name: '' },
      { kind: 'ai-easy', name: '' },
      { kind: 'empty', name: '' },
      { kind: 'empty', name: '' },
    ],
  };
  const rng = seededRandom(3);
  let state = createGame(setup, rng);
  for (let i = 0; i < quarters * 2; i++) state = aiTurn(state, rng);
  return { setup, state };
}

describe('저장과 이어하기', () => {
  it('새 게임과 몇 해 진행한 게임은 JSON으로 저장했다가 그대로 불러온다', () => {
    for (const q of [0, 12]) {
      const { setup, state } = played(q);
      const saved = parseSaved(clone({ setup, state, savedAt: 123 }));
      expect(saved).not.toBeNull();
      expect(saved!.state.q).toBe(state.q);
      expect(saved!.state.companies.map((c) => c.cash)).toEqual(state.companies.map((c) => c.cash));
      expect(saved!.savedAt).toBe(123);
    }
  });

  it('망가진 저장은 무시한다', () => {
    const { setup, state } = played(4);
    const broken: ((s: AirlineState) => void)[] = [
      (s) => (s.companies[0].branches = ['atlantis']),
      (s) => {
        const p = s.companies[0].planes[0];
        if (p) p.legs = [{ route: 999999, freq: 3 }];
        else s.companies[0].debt = -1;
      },
      (s) => (s.companies[0].debt = -5),
      (s) => (s.companies = []),
      (s) => (s.turnPos = 9),
      (s) => (s.companies[1].planes = [{ id: 1, model: 'not-a-plane', leased: false, rent: 0, deposit: 0, since: 0, legs: [] }]),
      (s) => ((s as unknown as Record<string, unknown>).version = 1),
      (s) => ((s.companies[0] as unknown as Record<string, unknown>).orders = undefined),
      (s) => (s.companies[0].goals = [{ kind: 'moon' } as unknown as AirlineState['companies'][0]['goals'][0]]),
      (s) => (s.market = [{ id: 1, model: 'nope', age: 3, price: 10, listed: 0 }]),
      (s) => (s.companies[0].partner = 0),
      (s) => ((s as unknown as Record<string, unknown>).q = 'soon'),
      (s) => (s.history[0].value = []),
    ];
    for (const breakIt of broken) {
      const s = clone(state);
      breakIt(s);
      expect(isValidState(s)).toBe(false);
      expect(parseSaved({ setup, state: s, savedAt: 1 })).toBeNull();
    }
    expect(parseSaved(null)).toBeNull();
    expect(parseSaved({ setup: { seats: [] }, state })).toBeNull();
  });

  it('설정이 이상하면 기본값으로 바꾼다', () => {
    const o = parseOptions({ era: 1999, mode: 'party', years: 7, money: 'lots', goalValue: 3, challenge: 'unknown' });
    expect(o.era).toBe(1983);
    expect(o.mode).toBe('years');
    expect(o.years).toBe(20);
    expect(o.money).toBe('normal');
    expect(o.goalValue).toBe(20000);
    expect(o.challenge).toBeNull();
    expect(parseOptions({ era: 1963, mode: 'challenge', challenge: 'rescue' }).challenge).toBe('rescue');
    expect(o.aiStyle).toBe('normal');
    expect(o.names).toBe('real');
    expect(parseOptions({ names: 'fictional' }).names).toBe('fictional');
    expect(parseOptions({ aiStyle: 'fierce' }).aiStyle).toBe('fierce');
  });

  it('2판(분기) 저장은 3판(달)으로 바꿔 읽는다: 분기는 그 분기의 첫 달로', () => {
    const { setup, state } = played(12);
    // 3판 상태를 2판 모양으로 되돌린다
    const v2 = clone(state) as unknown as Record<string, any>;
    v2.version = 2;
    v2.q = Math.floor(v2.t / 3);
    v2.startQ = Math.floor(v2.startT / 3);
    delete v2.t;
    delete v2.startT;
    delete v2.months;
    delete v2.ledger;
    delete v2.years;
    delete v2.qReport;
    v2.report = null;
    for (const c of v2.companies) {
      for (const p of c.planes) p.since = Math.floor(p.since / 3);
      for (const r of c.routes) {
        r.since = Math.floor(r.since / 3);
        if (r.stats) {
          delete r.stats.onTime;
          delete r.stats.cancel;
          delete r.stats.hist;
        }
      }
      for (const o of c.orders) o.due = Math.floor(o.due / 3);
      for (const m of c.mods) m.until = Math.floor(m.until / 3);
      c.nextChoiceQ = Math.floor(c.nextChoiceT / 3);
      delete c.nextChoiceT;
      delete c.maint;
      delete c.crewReserve;
      delete c.onTime;
      delete c.acc.qProfit;
    }
    for (const n of v2.news) {
      n.q = Math.floor(n.t / 3);
      delete n.t;
    }
    for (const u of v2.market) u.listed = Math.floor(u.listed / 3);
    for (const e of v2.effects) e.until = Math.floor(e.until / 3);
    expect(isValidState(v2)).toBe(false);
    const saved = parseSaved({ setup, state: v2, savedAt: 5 });
    expect(saved).not.toBeNull();
    const s3 = saved!.state;
    expect(s3.version).toBe(3);
    expect(s3.t).toBe(v2.q * 3);
    expect(s3.q).toBe(v2.q);
    expect(s3.startT).toBe(v2.startQ * 3);
    expect(s3.companies.every((c) => c.maint === 3 && c.crewReserve === 1 && c.planes.every((p) => p.since % 3 === 0))).toBe(true);
    expect(s3.news.every((n) => Number.isInteger(n.t))).toBe(true);
    expect(s3.months).toEqual([]);
    expect(isValidState(s3)).toBe(true);
    // 바꾼 저장으로 이어서 할 수 있다
    let t = s3;
    for (let i = 0; i < 6; i++) t = aiTurn(t, seededRandom(i));
    expect(t.t).toBe(s3.t + 3);
  });

  it('옛 형식(비행기 한 대 한 노선) 저장은 버린다', () => {
    const { setup, state } = played(2);
    const old = clone(state) as unknown as Record<string, unknown>;
    delete old.version;
    const companies = old.companies as Record<string, unknown>[];
    for (const c of companies) {
      c.planes = (c.planes as { legs: { route: number; freq: number }[] }[]).map((p) => ({ ...p, route: p.legs[0]?.route ?? null, freq: p.legs[0]?.freq ?? 0, legs: undefined }));
      delete c.orders;
    }
    expect(parseSaved({ setup, state: old, savedAt: 1 })).toBeNull();
  });
});
