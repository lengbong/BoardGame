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
