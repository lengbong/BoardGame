import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL } from './aircraft';
import { aiManage, aiTurn, planTurn } from './ai';
import { CHALLENGES } from './challenges';
import { AIRPORT_INFO, CITY, airportClass, dist } from './cities';
import { actor, applyAction, createGame } from './rules';
import { WEEK_HOURS, companyValue, estimateExisting, maxFreq, planeHours, slotCapacity, slotsUsed } from './simulate';
import { yearOf } from './time';
import type { AirlineOptions, AirlineSetup, AirlineState, SeatKind } from './types';

function setup(kinds: SeatKind[], options: Partial<AirlineOptions> = {}, hubs: (string | null)[] = []): AirlineSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as AirlineSetup['seats'],
    options: { era: 2003, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'normal', ...options },
    hubs: [0, 1, 2, 3].map((i) => hubs[i] ?? null),
  };
}

/** 모든 비행기가 규칙에 맞게 떠 있는지 */
function checkFleet(s: AirlineState): void {
  const year = yearOf(s.q);
  s.companies.forEach((c, ci) => {
    if (c.out) return;
    for (const p of c.planes) {
      const m = MODEL[p.model];
      for (const leg of p.legs) {
        const r = c.routes.find((x) => x.id === leg.route)!;
        expect(r).toBeTruthy();
        const d = dist(r.a, r.b);
        expect(m.range).toBeGreaterThanOrEqual(d);
        expect(airportClass(CITY[r.a], year)).toBeGreaterThanOrEqual(m.runway);
        expect(airportClass(CITY[r.b], year)).toBeGreaterThanOrEqual(m.runway);
        expect(leg.freq).toBeGreaterThanOrEqual(1);
        expect(leg.freq).toBeLessThanOrEqual(maxFreq(m, d));
        expect(c.branches).toContain(r.a);
        expect(c.branches).toContain(r.b);
      }
      // 한 대가 여러 노선을 날아도 주간 비행시간을 넘지 않는다
      expect(planeHours(c, p)).toBeLessThanOrEqual(WEEK_HOURS + 1e-6);
    }
    for (const city of c.branches) expect(slotsUsed(c, city)).toBeLessThanOrEqual(slotCapacity(s, ci, city));
  });
}

/** 컴퓨터끼리 끝까지 */
function playOut(kinds: SeatKind[], seed: number, options: Partial<AirlineOptions> = {}, check = false) {
  const rng = seededRandom(seed);
  let s = createGame(setup(kinds, options), rng);
  let turns = 0;
  let worst = 0;
  while (s.phase !== 'gameover' && turns < 1000) {
    const t0 = performance.now();
    s = aiTurn(s, rng);
    worst = Math.max(worst, performance.now() - t0);
    turns++;
    if (check && turns % 7 === 0) checkFleet(s);
  }
  return { s, turns, worst };
}

describe('컴퓨터 항공사', () => {
  it('정한 행동은 모두 규칙에 맞다 (차례대로 다시 해도 하나도 거절되지 않는다)', () => {
    for (const seed of [1, 2, 3]) {
      const rng = seededRandom(seed);
      let s = createGame(setup(['ai-normal', 'ai-easy', 'ai-normal']), rng);
      for (let turn = 0; turn < 24; turn++) {
        const ci = actor(s);
        const level = s.companies[ci].kind === 'ai-easy' ? 'ai-easy' : 'ai-normal';
        const actions = planTurn(s, ci, level, seededRandom(seed * 100 + turn));
        let t = s;
        for (const a of actions) {
          const next = applyAction(t, a);
          expect(next, JSON.stringify(a)).not.toBe(t);
          t = next;
        }
        s = applyAction(t, { type: 'endTurn' }, rng);
      }
      checkFleet(s);
    }
  });

  it('보통: 첫 분기에 본사에서 이익이 날 노선을 열고 비행기를 띄운다', () => {
    for (const seed of [4, 5, 6]) {
      const s = createGame(setup(['ai-normal', 'human'], {}, [null, 'london']), seededRandom(seed));
      const t = aiManage(s, 0, 'ai-normal', seededRandom(seed));
      const c = t.companies[0];
      expect(c.routes.length).toBeGreaterThan(0);
      expect(c.planes.some((p) => p.legs.some((l) => l.freq > 0))).toBe(true);
      const best = Math.max(...c.routes.map((r) => estimateExisting(t, 0, r).profit));
      expect(best).toBeGreaterThan(0);
      expect(c.cash).toBeGreaterThan(0);
    }
  });

  it('돈이 바닥나면 쉬는 비행기를 팔고 광고를 끄고 돈을 빌린다', () => {
    let s = createGame(setup(['ai-normal', 'human'], {}, [null, 'london']), seededRandom(7));
    s = aiManage(s, 0, 'ai-normal', seededRandom(7));
    const c = s.companies[0];
    c.planes.push({ id: s.nextId++, model: 'a320', leased: false, rent: 0, deposit: 0, since: s.q, legs: [] });
    c.cash = -30;
    c.crisis = 1;
    c.ads.eastasia = 50;
    c.ads.europe = 50;
    const t = aiManage(s, 0, 'ai-normal', seededRandom(8));
    const after = t.companies[0];
    expect(after.cash).toBeGreaterThanOrEqual(0);
    expect(after.planes.every((p) => p.legs.length > 0)).toBe(true);
    expect(Object.values(after.ads).every((v) => v === 0)).toBe(true);
  });

  it('쉬움은 운임을 조심스럽게(±15% 안에서) 정하고 먼 노선은 피한다', () => {
    const { s } = playOut(['ai-easy', 'ai-easy'], 11, { years: 10 });
    for (const c of s.companies) {
      for (const r of c.routes) {
        expect(Math.abs(r.fare)).toBeLessThanOrEqual(15);
        expect(dist(r.a, r.b)).toBeLessThanOrEqual(6500);
      }
    }
  });
});

describe('컴퓨터끼리 끝까지', () => {
  it('1963년부터 4개 회사가 20년 동안: 멈추지 않고, 숫자가 터지지 않고, 규칙을 지킨다', () => {
    const { s, worst } = playOut(['ai-normal', 'ai-easy', 'ai-normal', 'ai-easy'], 21, { era: 1963 }, true);
    expect(s.phase).toBe('gameover');
    expect(yearOf(s.q)).toBe(1982);
    expect(s.result!.winners.length).toBeGreaterThan(0);
    for (let i = 0; i < s.companies.length; i++) {
      const v = companyValue(s, i);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeLessThan(500000);
    }
    expect(s.history.length).toBe(81);
    expect(worst).toBeLessThan(300);
  });

  it('2003년부터 20년: 보통 회사가 크게 자라지만 터무니없지는 않다', () => {
    for (const seed of [31, 32]) {
      const { s, worst } = playOut(['ai-normal', 'ai-easy'], seed, {}, true);
      expect(s.phase).toBe('gameover');
      const v = companyValue(s, 0);
      expect(v).toBeGreaterThan(20000);
      expect(v).toBeLessThan(400000);
      expect(s.companies[0].routes.length).toBeGreaterThan(5);
      expect(worst).toBeLessThan(300);
      for (const h of s.history) for (const x of h.value) expect(Number.isFinite(x)).toBe(true);
    }
  });

  it('목표 먼저 이루기에서는 보통 회사가 여러 지역으로 넓혀 결국 목표를 이룬다', () => {
    const { s } = playOut(['ai-normal', 'ai-easy'], 41, { mode: 'goal', goalValue: 10000, goalRegions: 6 });
    expect(s.phase).toBe('gameover');
    expect(s.result!.reason).toContain('목표');
    expect(yearOf(s.q) - 2003).toBeLessThan(25);
  });

  it('보통이 쉬움보다 자주 이긴다', () => {
    let normal = 0;
    let games = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const kinds: SeatKind[] = seed % 2 === 0 ? ['ai-normal', 'ai-easy'] : ['ai-easy', 'ai-normal'];
      const { s } = playOut(kinds, seed * 13, { years: 10, era: seed % 3 === 0 ? 1983 : 2003 });
      const w = s.result!.winners[0];
      if (s.companies[w].kind === 'ai-normal') normal++;
      games++;
    }
    expect(normal / games).toBeGreaterThanOrEqual(0.75);
  });

  it('도전 과제마다 컴퓨터가 도전해도 멈추지 않는다', () => {
    for (const def of CHALLENGES) {
      const rng = seededRandom(def.year);
      let s = createGame(setup(['ai-normal'], { mode: 'challenge', challenge: def.id }), rng);
      expect(s.challenge!.id).toBe(def.id);
      for (let k = 0; k < 6 * s.companies.length && s.phase !== 'gameover'; k++) s = aiTurn(s, rng);
      expect(s.challenge!.progress.length).toBeGreaterThan(0);
      expect(Number.isFinite(companyValue(s, 0))).toBe(true);
      checkFleet(s);
    }
    expect(AIRPORT_INFO[1].slots).toBeLessThan(AIRPORT_INFO[4].slots);
  });
});
