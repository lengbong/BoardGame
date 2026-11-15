import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { aiTurn } from './ai';
import { AIRLINE_AWARD_DEMAND, AWARD_INFO, trophyCount, yearAwards } from './awards';
import { createGame, runMonth } from './rules';
import { emptyReport } from './simulate';
import { isValidState } from './storage';
import { mOf, yearOf } from './time';
import type { AirlineSetup, AirlineState, CompanyReport, SeatKind } from './types';

function setup(kinds: SeatKind[]): AirlineSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as AirlineSetup['seats'],
    options: { era: 2003, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'normal', names: 'fictional' },
    hubs: ['seoul', 'london', 'newyork', null],
    airlines: [null, null, null, null],
  };
}

function rep(over: Partial<CompanyReport>): CompanyReport {
  return { ...emptyReport(), flights: 2000, onTime: 0.85, pax: 300000, profit: 100, ...over };
}

function withPlanes(s: AirlineState, ci: number, n: number): void {
  const c = s.companies[ci];
  c.planes = Array.from({ length: n }, (_, k) => ({ id: 9000 + ci * 100 + k, model: 'b737-800', leased: true, rent: 1, deposit: 0, since: s.t, legs: [], cabin: { first: 0, business: 0, pitch: 1 }, meal: 3 }));
}

describe('연말 시상식', () => {
  it('부문마다 가장 잘한 회사가 받고, 문턱을 넘지 못하면 아무도 받지 않는다', () => {
    const s = createGame(setup(['human', 'ai-normal', 'ai-normal']), seededRandom(1));
    for (let i = 0; i < 3; i++) withPlanes(s, i, 5);
    s.companies[0].reputation = 80;
    s.companies[1].reputation = 60;
    s.companies[2].reputation = 70;
    const year = [rep({ onTime: 0.9, pax: 500000, xferPax: 60000, profit: 300 }), rep({ onTime: 0.8, pax: 200000, profit: -50 }), rep({ onTime: 0.86, pax: 400000, xferPax: 10000 })];
    const prev = [rep({ pax: 480000 }), rep({ pax: 100000 }), rep({ pax: 300000 })];
    const aw = yearAwards(s, 2003, year, prev);
    const by = Object.fromEntries(aw.items.map((a) => [a.kind, a.company]));
    expect(by.punctual).toBe(0);
    expect(by.service).toBe(0);
    // 회사 1은 손님이 두 배지만 적자라도 성장상은 받을 수 있다
    expect(by.growth).toBe(1);
    expect(by.hub).toBe(0);
    expect(by.airline).toBe(0);
    // 문턱: 정시율이 모두 낮고 평판도 낮으면 그 부문은 비어 있다
    for (const c of s.companies) c.reputation = 50;
    const none = yearAwards(s, 2003, year.map((r) => ({ ...r, onTime: 0.7, xferPax: 0 })), year);
    expect(none.items.map((a) => a.kind)).not.toContain('punctual');
    expect(none.items.map((a) => a.kind)).not.toContain('service');
    expect(none.items.map((a) => a.kind)).not.toContain('growth');
    expect(none.items.map((a) => a.kind)).not.toContain('hub');
  });

  it('적자 회사는 올해의 항공사가 될 수 없고, 혼자 하는 판은 정시 운항·평판도 괜찮아야 한다', () => {
    const s = createGame(setup(['human']), seededRandom(1));
    withPlanes(s, 0, 5);
    s.companies[0].reputation = 70;
    expect(yearAwards(s, 2003, [rep({ profit: -10 })]).items.some((a) => a.kind === 'airline')).toBe(false);
    expect(yearAwards(s, 2003, [rep({ profit: 10, onTime: 0.7 })]).items.some((a) => a.kind === 'airline')).toBe(false);
    expect(yearAwards(s, 2003, [rep({ profit: 10, onTime: 0.86 })]).items.some((a) => a.kind === 'airline')).toBe(true);
  });

  it('12월 결산에 시상식이 열려 평판이 오르고, 올해의 항공사는 한 해 동안 손님이 는다', () => {
    const rng = seededRandom(4);
    let s = createGame(setup(['ai-normal', 'ai-normal', 'ai-easy']), rng);
    while (s.phase !== 'gameover' && s.t < mOf(2005, 12)) s = aiTurn(s, rng);
    // 11월이 끝난 뒤, 12월을 마치기 바로 전
    while (s.order[s.turnPos] !== s.order[0] || s.t !== mOf(2005, 12)) s = aiTurn(s, rng);
    const before = s.companies.map((c) => c.reputation);
    const after = runMonth(s, seededRandom(2));
    const y = after.awards?.find((x) => x.year === 2005);
    expect(y).toBeTruthy();
    expect(y!.items.length).toBeGreaterThan(0);
    expect(after.news.some((n) => n.title === '2005년 하늘길 시상식')).toBe(true);
    const airline = y!.items.find((a) => a.kind === 'airline');
    if (airline) {
      const c = after.companies[airline.company];
      expect(c.mods.some((m) => m.kind === 'demand' && m.value === AIRLINE_AWARD_DEMAND && m.until > after.t + 10)).toBe(true);
    }
    // 상을 받은 회사의 평판은 평소 변화에 더해 상만큼 오른다 (상이 없던 쪽과 견주어)
    const winner = y!.items[0].company;
    expect(after.companies[winner].reputation).toBeGreaterThan(before[winner] - 5 + AWARD_INFO[y!.items[0].kind].rep * 0.5);
    expect(trophyCount(after.awards, winner).get(y!.items[0].kind)).toBeGreaterThanOrEqual(1);
    expect(isValidState(after)).toBe(true);
    const broken = JSON.parse(JSON.stringify(after));
    broken.awards[broken.awards.length - 1].items[0].kind = 'oscar';
    expect(isValidState(broken)).toBe(false);
  }, 60000);

  it('컴퓨터끼리 몇 해 두면 해마다 시상식이 쌓인다', () => {
    const rng = seededRandom(9);
    let s = createGame(setup(['ai-normal', 'ai-easy']), rng);
    while (s.phase !== 'gameover' && yearOf(s.q) <= 2008) s = aiTurn(s, rng);
    const years = (s.awards ?? []).map((y) => y.year);
    expect(years.length).toBeGreaterThanOrEqual(3);
    expect(new Set(years).size).toBe(years.length);
  }, 60000);
});
