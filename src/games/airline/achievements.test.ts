/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL, MODELS } from './aircraft';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT,
  LONG_HAUL_KM,
  addGameEnd,
  checkAchievements,
  emptyAchStore,
  endKey,
  gameKey,
  parseAchStore,
  unlockedIn,
  type AchStore,
} from './achievements';
import { defaultCabin } from './cabin';
import { CHALLENGES } from './challenges';
import { CITIES, CITY, dist } from './cities';
import { ACH_KEY, HOF_KEY, loadAchStore, loadHof, resetFame, trackFame } from './fameStore';
import { FREIGHTERS } from './freighters';
import { HOF_SIZE, emptyHof, parseHof, recordGameEnd, type FameEntry } from './hallOfFame';
import { createGame } from './rules';
import { emptyReport } from './simulate';
import type { AirlineOptions, AirlineSetup, AirlineState, Company, CompanyReport, Plane, SeatKind } from './types';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const NOW = 1_700_000_000_000;

function setup(kinds: SeatKind[], options: Partial<AirlineOptions> = {}): AirlineSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as AirlineSetup['seats'],
    options: { era: 1983, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'normal', names: 'fictional', ...options },
    hubs: ['seoul', 'london', null, null],
    airlines: [null, null, null, null],
  };
}

/** 사람(0) + 컴퓨터(1), 막 시작한 게임 */
const BASE = createGame(setup(['human', 'ai-normal']), seededRandom(11));

let nextPlane = 9000;
function plane(model: string, legs: Plane['legs'] = []): Plane {
  return { id: nextPlane++, model, leased: false, rent: 0, deposit: 0, since: BASE.t, legs, cabin: defaultCabin(MODEL[model]), meal: 3 };
}
const narrow = MODELS.find((m) => m.body === 'narrow' && m.intro <= 1983 && m.end >= 1983)!.id;
const wide = MODELS.find((m) => m.body === 'wide')!.id;
const freighter = FREIGHTERS[0].id;

/** 노선 하나를 열고 비행기로 띄운다 */
function fly(c: Company, a: string, b: string, model = narrow): void {
  const id = 500 + c.routes.length;
  for (const city of [a, b]) if (!c.branches.includes(city)) c.branches.push(city);
  c.routes.push({ id, a, b, fare: 0, since: BASE.t, stats: null, times: [1, 1, 1, 0] });
  c.planes.push(plane(model, [{ route: id, freq: 3 }]));
}

function report(patch: Partial<CompanyReport>): CompanyReport {
  return { ...emptyReport(), ...patch };
}

function finish(s: AirlineState, winners: number[], extra: Partial<AirlineState['result'] & object> = {}): AirlineState {
  return { ...s, phase: 'gameover', result: { winners, reason: '끝', ...extra } };
}

const ids = (s: AirlineState, store: AchStore = emptyAchStore()) => checkAchievements(s, store, NOW).unlocks.map((u) => u.id);

describe('업적 살피기', () => {
  it('막 시작한 게임에서는 아무 업적도 이루지 않는다', () => {
    expect(ids(BASE)).toEqual([]);
    expect(ids(finish(clone(BASE), [1]))).toEqual([]);
  });

  it('업적은 30개쯤이고 id가 겹치지 않으며 숨은 업적이 몇 개 있다', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(28);
    expect(ACHIEVEMENTS.length).toBeLessThanOrEqual(40);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.filter((a) => a.hidden).length).toBeGreaterThanOrEqual(2);
    for (const t of [1, 2, 3]) expect(ACHIEVEMENTS.filter((a) => a.tier === t).length).toBeGreaterThanOrEqual(6);
    for (const a of ACHIEVEMENTS) {
      expect(a.name.length).toBeGreaterThan(1);
      expect(a.desc).toMatch(/요\)?$/);
    }
  });

  // 업적마다: 이 상태를 만들면 그 업적이 나온다
  const cases: [string, (s: AirlineState) => AirlineState, AchStore?][] = [
    ['first-plane', (s) => (s.companies[0].planes.push(plane(narrow)), s)],
    ['first-route', (s) => (fly(s.companies[0], 'seoul', 'tokyo'), s)],
    ['first-wide', (s) => (s.companies[0].planes.push(plane(wide)), s)],
    ['first-black', (s) => ({ ...s, years: [{ year: 1983, companies: [report({ profit: 12 }), report({ profit: -3 })] }] })],
    ['pax-100k', (s) => ((s.companies[0].stats.pax = 100000), s)],
    ['first-trophy', (s) => ({ ...s, awards: [{ year: 1983, items: [{ kind: 'service', company: 0, value: 70, text: '' }] }] })],
    ['facility', (s) => ((s.companies[0].facilities = [{ city: 'seoul', kind: 'lounge', cost: 20 }]), s)],
    ['tank', (s) => ((s.companies[0].fuel = { level: 1, stock: 0, avg: 0, auto: null }), s)],
    ['charter', (s) => ({ ...s, charters: [{ id: 1, a: 'seoul', b: 'tokyo', pax: 900, pay: 5, title: '', icon: '', listed: s.t - 2, expires: s.t, by: 0, plane: 1, t: s.t - 1 }] })],
    ['alliance', (s) => ({ ...s, alliances: [{ id: 1, name: '하늘별 동맹', members: [0, 1], since: s.t }] })],
    [
      'regions-6',
      (s) => {
        const c = s.companies[0];
        for (const region of ['eastasia', 'seaoc', 'southmid', 'europe', 'africa', 'americas']) fly(c, 'seoul', CITIES.find((x) => x.region === region && x.id !== 'seoul')!.id);
        return s;
      },
    ],
    ['cities-25', (s) => ((s.companies[0].branches = CITIES.slice(0, 25).map((c) => c.id)), s)],
    ['fleet-50', (s) => ((s.companies[0].planes = Array.from({ length: 50 }, () => plane(narrow))), s)],
    ['freighters', (s) => ((s.companies[0].planes = Array.from({ length: 5 }, () => plane(freighter))), s)],
    ['streak-8', (s) => ((s.companies[0].stats.profitStreak = 8), s)],
    [
      'oil-black',
      (s) => ({
        ...s,
        years: [{ year: 1984, companies: [report({ profit: 40 }), report({ profit: 40 })] }],
        months: Array.from({ length: 12 }, (_, m) => ({ t: 1984 * 12 + m, oil: 1.7, value: [0, 0], profit: [0, 0], revenue: [0, 0], pax: [0, 0], lf: [0, 0], onTime: [0, 0], staff: [0, 0] })),
      }),
    ],
    [
      'long-haul',
      (s) => {
        const far = CITIES.find((x) => dist('seoul', x.id) > LONG_HAUL_KM)!;
        fly(s.companies[0], 'seoul', far.id, MODELS.reduce((a, b) => (b.range > a.range ? b : a)).id);
        return s;
      },
    ],
    ['triple', (s) => ({ ...s, awards: [{ year: 1984, items: (['airline', 'punctual', 'service'] as const).map((kind) => ({ kind, company: 0, value: 1, text: '' })) }] })],
    ['value-1jo', (s) => ((s.companies[0].cash = 20000), s)],
    ['stake-20', (s) => ({ ...s, stakes: [[100, 0], [25, 75]] })],
    ['grade-s', (s) => ((s.companies[0].reviews = [{ year: 1983, grade: 'S', text: '', met: 3, total: 3 }]), s)],
    ['first-win', (s) => finish(s, [0])],
    ['win-lcc', (s) => ((s.companies[0].bizModel = 'lcc'), finish(s, [0]))],
    ['win-cargo', (s) => ((s.companies[0].bizModel = 'cargo'), finish(s, [0]))],
    ['veteran', (s) => finish(s, [1]), { ...emptyAchStore(), progress: { eras: [], challenges: [], games: 4 } }],
    ['supersonic', (s) => (fly(s.companies[0], 'paris', 'newyork', 'concorde'), s)],
    ['debt-free', (s) => ((s.companies[0].debt = 0), (s.companies[0].planes = Array.from({ length: 30 }, () => plane(narrow))), s)],
    ['fleet-100', (s) => ((s.companies[0].planes = Array.from({ length: 100 }, () => plane(narrow))), s)],
    ['cities-50', (s) => ((s.companies[0].branches = CITIES.slice(0, 50).map((c) => c.id)), s)],
    ['sweep', (s) => ({ ...s, awards: [{ year: 1985, items: (['airline', 'punctual', 'service', 'growth', 'hub'] as const).map((kind) => ({ kind, company: 0, value: 1, text: '' })) }] })],
    ['takeover', (s) => ((s.companies[1].out = true), (s.companies[1].mergedInto = 0), s)],
    ['win-fierce', (s) => finish({ ...s, options: { ...s.options, aiStyle: 'fierce' } }, [0])],
    ['win-eras', (s) => finish(s, [0]), { ...emptyAchStore(), progress: { eras: [1963, 2003], challenges: [], games: 2 } }],
    ['marathon', (s) => finish({ ...s, t: s.startT + 359 }, [1])],
  ];

  for (const [id, make, store] of cases) {
    it(`${ACHIEVEMENT[id].name} (${id}): 만든 상태에서 나오고, 처음 상태에서는 나오지 않는다`, () => {
      expect(ACHIEVEMENT[id]).toBeTruthy();
      expect(ids(BASE, store)).not.toContain(id);
      const s = make(clone(BASE));
      const got = checkAchievements(s, store ?? emptyAchStore(), NOW);
      expect(got.unlocks.map((u) => u.id)).toContain(id);
      const u = got.unlocks.find((x) => x.id === id)!;
      expect(u.ci).toBe(0);
      expect(got.store.items[id]).toMatchObject({ by: s.companies[0].name, seat: 0, at: NOW, g: gameKey(s) });
    });
  }

  it('도전 과제: 하나 성공하면 ‘도전 성공’, 여덟 개를 모두 하면 ‘도전 과제 완주’', () => {
    const base = createGame(setup(['human'], { mode: 'challenge', challenge: 'rescue' }), seededRandom(4));
    expect(ids(finish(clone(base), [], { success: false }))).not.toContain('challenge-one');
    const won = finish(clone(base), [0], { success: true });
    expect(ids(won)).toContain('challenge-one');
    expect(ids(won)).not.toContain('challenge-all');
    // 도전 과제 성공은 ‘첫 우승’으로 세지 않는다
    expect(ids(won)).not.toContain('first-win');
    const others = CHALLENGES.map((d) => d.id).filter((x) => x !== 'rescue');
    expect(ids(won, { ...emptyAchStore(), progress: { eras: [], challenges: others, games: 7 } })).toContain('challenge-all');
  });

  it('도전 과제 완주는 같은 과제를 여러 번 해도 채워지지 않는다', () => {
    const base = createGame(setup(['human'], { mode: 'challenge', challenge: 'rescue' }), seededRandom(4));
    let store = emptyAchStore();
    for (let i = 0; i < 9; i++) store = checkAchievements(finish({ ...clone(base), nextId: base.nextId + i }, [0], { success: true }), store, NOW).store;
    expect(store.progress.challenges).toEqual(['rescue']);
    expect(store.progress.games).toBe(9);
    expect(store.items['challenge-all']).toBeUndefined();
  });

  it('사람 회사만 이룬다: 컴퓨터 회사가 해도 나오지 않는다', () => {
    const s = clone(BASE);
    const ai = s.companies[1];
    ai.planes = Array.from({ length: 100 }, () => plane(wide));
    ai.branches = CITIES.slice(0, 50).map((c) => c.id);
    ai.stats.pax = 5_000_000;
    s.awards = [{ year: 1985, items: (['airline', 'punctual', 'service', 'growth', 'hub'] as const).map((kind) => ({ kind, company: 1, value: 1, text: '' })) }];
    expect(ids(finish(s, [1]))).toEqual([]);
    // 컴퓨터끼리 한 게임은 아무것도 세지 않는다
    const bots = createGame(setup(['ai-normal', 'ai-easy']), seededRandom(2));
    bots.companies[0].planes = Array.from({ length: 60 }, () => plane(narrow));
    const r = checkAchievements(finish(bots, [0]), emptyAchStore(), NOW);
    expect(r.unlocks).toEqual([]);
    expect(r.store.progress.games).toBe(0);
  });

  it('이미 이룬 업적은 다시 나오지 않고, 처음 이룬 회사가 남는다', () => {
    const s = clone(BASE);
    s.companies[0].planes.push(plane(narrow));
    const first = checkAchievements(s, emptyAchStore(), NOW);
    const again = checkAchievements(s, first.store, NOW + 5000);
    expect(again.unlocks).toEqual([]);
    expect(again.store.items['first-plane'].at).toBe(NOW);
  });

  it('사람이 여럿이면 앞 자리 회사가 처음 이룬 회사가 되고, 다른 업적은 각자 이룬다', () => {
    const s = createGame(setup(['human', 'human', 'ai-easy']), seededRandom(5));
    s.companies[0].planes.push(plane(narrow));
    s.companies[1].planes.push(plane(wide));
    const r = checkAchievements(s, emptyAchStore(), NOW);
    expect(r.store.items['first-plane'].by).toBe(s.companies[0].name);
    expect(r.store.items['first-wide'].by).toBe(s.companies[1].name);
    expect(r.store.items['first-wide'].seat).toBe(1);
  });

  it('같은 게임 끝을 두 번 살펴도 판 수·이긴 시대는 한 번만 센다', () => {
    const s = finish(clone(BASE), [0]);
    const a = checkAchievements(s, emptyAchStore(), NOW).store;
    const b = checkAchievements(s, a, NOW + 1).store;
    expect(a.progress.games).toBe(1);
    expect(b.progress.games).toBe(1);
    expect(b.progress.eras).toEqual([1983]);
    expect(addGameEnd(b, s)).toBe(b);
    // 다른 게임이 끝나면 더한다
    const other = finish({ ...clone(BASE), nextId: BASE.nextId + 77 }, [1]);
    expect(endKey(other)).not.toBe(endKey(s));
    expect(checkAchievements(other, b, NOW).store.progress.games).toBe(2);
  });

  it('결과 화면의 ‘새 업적’은 이 게임 열쇠로 찾는다', () => {
    const s = clone(BASE);
    s.companies[0].planes.push(plane(narrow));
    const store = checkAchievements(s, emptyAchStore(), NOW).store;
    expect(unlockedIn(store, s)).toEqual(['first-plane']);
    const other = createGame(setup(['human', 'ai-normal'], { era: 2003 }), seededRandom(12));
    expect(unlockedIn(store, other)).toEqual([]);
  });
});

describe('명예의 전당', () => {
  function ended(value: number, seed: number, kinds: SeatKind[] = ['human', 'ai-normal']): AirlineState {
    const s = createGame(setup(kinds), seededRandom(seed));
    s.companies.forEach((c) => {
      c.cash = 0;
      c.debt = 0;
    });
    s.companies[0].cash = value;
    s.companies[1].cash = value / 2;
    return finish({ ...s, nextId: s.nextId + seed }, [0]);
  }

  it('사람 회사의 최종 회사 가치로 순위를 매기고 10개만 남긴다', () => {
    let hof = emptyHof();
    const values = [500, 3000, 1200, 800, 9000, 100, 2500, 4000, 700, 6000, 50, 7000];
    values.forEach((v, i) => (hof = recordGameEnd(hof, ended(v, i + 1), NOW + i).hof));
    expect(hof.games.length).toBe(HOF_SIZE);
    expect(hof.games.map((e) => e.value)).toEqual([...values].sort((a, b) => b - a).slice(0, HOF_SIZE));
    // 컴퓨터 회사는 오르지 않는다
    expect(hof.games.every((e) => e.seat === 0)).toBe(true);
    // 들지 못하는 작은 회사는 순위가 없다
    const small = recordGameEnd(hof, ended(10, 99), NOW + 99);
    expect(small.ranks).toEqual([{ ci: 0, rank: null }]);
    const big = recordGameEnd(hof, ended(8000, 98), NOW + 98);
    expect(big.ranks).toEqual([{ ci: 0, rank: 2 }]);
    expect(big.hof.games[1]).toMatchObject({ value: 8000, startYear: 1983, mode: 'years', model: 'full', place: 1, won: true, months: 1 });
  });

  it('같은 게임 끝을 두 번 넣어도 한 번만 들어간다', () => {
    const s = ended(5000, 3);
    const a = recordGameEnd(emptyHof(), s, NOW);
    const b = recordGameEnd(a.hof, s, NOW + 10);
    expect(a.already).toBe(false);
    expect(b.already).toBe(true);
    expect(b.hof).toBe(a.hof);
    expect(b.hof.games.length).toBe(1);
    expect(b.ranks).toEqual([{ ci: 0, rank: 1 }]);
  });

  it('사람이 여럿이면 회사마다 따로 오르고, 그만둔(끝나지 않은) 게임과 파산한 회사는 오르지 않는다', () => {
    const s = ended(3000, 4, ['human', 'human', 'ai-easy']);
    s.companies[1].cash = 2000;
    const r = recordGameEnd(emptyHof(), s, NOW);
    expect(r.hof.games.map((e) => e.name)).toEqual([s.companies[0].name, s.companies[1].name]);
    expect(r.ranks).toEqual([
      { ci: 0, rank: 1 },
      { ci: 1, rank: 2 },
    ]);
    const going = { ...s, phase: 'manage' as const, result: null };
    expect(recordGameEnd(emptyHof(), going, NOW).hof.games).toEqual([]);
    const broke = clone(s);
    broke.companies[1].out = true;
    expect(recordGameEnd(emptyHof(), broke, NOW).hof.games.map((e) => e.seat)).toEqual([0]);
  });

  it('기록은 더 큰 값이 나와야 바뀐다', () => {
    const a = ended(3000, 5);
    a.companies[0].planes = Array.from({ length: 12 }, () => plane(narrow));
    a.years = [
      { year: 1983, companies: [report({ pax: 50000, profit: 30 }), report({ pax: 900000, profit: 900 })] },
      { year: 1984, companies: [report({ pax: 80000, profit: 10 }), report({})] },
    ];
    a.awards = [{ year: 1984, items: [{ kind: 'service', company: 0, value: 70, text: '' }] }];
    const r1 = recordGameEnd(emptyHof(), a, NOW);
    expect(r1.hof.records.fleet?.value).toBe(12);
    expect(r1.hof.records.yearPax).toMatchObject({ value: 80000, year: 1984 });
    expect(r1.hof.records.yearProfit).toMatchObject({ value: 30, year: 1983 });
    expect(r1.hof.records.trophies?.value).toBe(1);
    expect(r1.records).toEqual(expect.arrayContaining(['fleet', 'yearPax', 'yearProfit', 'trophies']));
    const b = ended(100, 6);
    b.companies[0].planes = Array.from({ length: 30 }, () => plane(narrow));
    const r2 = recordGameEnd(r1.hof, b, NOW + 1);
    expect(r2.hof.records.fleet?.value).toBe(30);
    expect(r2.hof.records.yearPax?.value).toBe(80000);
    expect(r2.records).toContain('fleet');
    expect(r2.records).not.toContain('yearPax');
  });
});

describe('저장 검사', () => {
  it('망가진 업적 저장은 무시하고, 맞는 것만 남긴다', () => {
    for (const bad of [null, 'x', 42, [], { v: 2, items: { 'first-plane': {} } }]) expect(parseAchStore(bad)).toEqual(emptyAchStore());
    const s = parseAchStore({
      v: 1,
      items: {
        'first-plane': { at: NOW, by: '노을항공', seat: 0, airline: 'nope', year: 1985, g: 'abc123' },
        'no-such-thing': { at: NOW, by: 'x', seat: 0, year: 1985 },
        'first-wide': { at: 'yesterday', by: 'x', seat: 0, year: 1985 },
        'first-route': { at: NOW, by: '', seat: 0, year: 1985 },
        'fleet-50': { at: NOW, by: 'x', seat: 7, year: 1985 },
        tank: { at: NOW, by: 'x'.repeat(80), seat: 1, year: 1985 },
      },
      progress: { eras: [1963, 1999, '2003', 2003, 1963], challenges: ['rescue', 'nope', 'rescue'], games: -3 },
      seen: ['ok1', 'BAD KEY', 5, 'ok1'],
    });
    expect(Object.keys(s.items)).toEqual(['first-plane']);
    expect(s.items['first-plane'].airline).toBeNull();
    expect(s.progress).toEqual({ eras: [1963, 2003], challenges: ['rescue'], games: 0 });
    expect(s.seen).toEqual(['ok1']);
  });

  it('망가진 명예의 전당 저장도 무시하고, 순서를 다시 맞춘다', () => {
    for (const bad of [null, 'x', { v: 3 }, { games: 'no' }]) expect(parseHof(bad)).toEqual(emptyHof());
    const good: FameEntry = { k: 'abc', name: '노을항공', seat: 0, airline: null, hub: 'seoul', startYear: 1983, months: 240, mode: 'years', challenge: null, model: 'full', value: 300, place: 1, won: true, at: NOW };
    const h = parseHof({
      v: 1,
      games: [
        good,
        { ...good, k: 'def', value: 900 },
        { ...good, k: 'abc' },
        { ...good, k: 'neg', value: -5 },
        { ...good, k: 'bad', mode: 'weird' },
        { ...good, k: 'nan', value: 'big' },
        ...Array.from({ length: 12 }, (_, i) => ({ ...good, k: `m${i}`, value: 10 + i })),
      ],
      records: { fleet: { value: 40, name: 'x', seat: 0, airline: null, startYear: 1983, year: null, at: NOW, k: 'abc' }, yearPax: { value: 'lots' }, nope: {} },
    });
    expect(h.games.length).toBe(HOF_SIZE);
    expect(h.games[0].value).toBe(900);
    expect(h.games.filter((e) => e.k === 'abc').length).toBe(1);
    expect(h.games.some((e) => e.k === 'neg' || e.k === 'bad' || e.k === 'nan')).toBe(false);
    expect(Object.keys(h.records)).toEqual(['fleet']);
  });

  describe('localStorage', () => {
    let mem: Map<string, string>;
    beforeEach(() => {
      mem = new Map();
      (globalThis as any).window = {
        localStorage: {
          getItem: (k: string) => mem.get(k) ?? null,
          setItem: (k: string, v: string) => void mem.set(k, v),
          removeItem: (k: string) => void mem.delete(k),
        },
      };
    });
    afterEach(() => {
      delete (globalThis as any).window;
    });

    it('게임 저장과 다른 열쇠에 저장하고, 망가진 JSON은 빈 기록으로 읽는다', () => {
      const s = clone(BASE);
      s.companies[0].planes.push(plane(narrow));
      const got = trackFame(s, NOW);
      expect(got.map((u) => u.id)).toEqual(['first-plane']);
      expect(ACH_KEY).toBe('family-boardgame.airline.achievements.v1');
      expect(HOF_KEY).toBe('family-boardgame.airline.halloffame.v1');
      expect(loadAchStore().items['first-plane'].by).toBe(s.companies[0].name);
      expect(trackFame(s, NOW + 1)).toEqual([]);
      resetFame();
      mem.set(ACH_KEY, '{not json');
      mem.set(HOF_KEY, '"just a string"');
      expect(loadAchStore()).toEqual(emptyAchStore());
      expect(loadHof()).toEqual(emptyHof());
    });

    it('게임이 끝나면 명예의 전당에 한 번만 넣고, 지우기로 모두 지운다', () => {
      const s = finish(clone(BASE), [0]);
      s.companies[0].cash = 4000;
      trackFame(s, NOW);
      trackFame(s, NOW + 1);
      expect(loadHof().games.length).toBe(1);
      expect(loadAchStore().progress.games).toBe(1);
      expect(loadAchStore().items['first-win']).toBeTruthy();
      resetFame();
      expect(mem.has(ACH_KEY)).toBe(false);
      expect(mem.has(HOF_KEY)).toBe(false);
      expect(loadHof()).toEqual(emptyHof());
    });
  });
});

it('도시 데이터: 11,000km 넘는 노선이 있다 (지구 반 바퀴)', () => {
  expect(CITIES.some((a) => CITIES.some((b) => dist(a.id, b.id) > LONG_HAUL_KM))).toBe(true);
  expect(CITY.seoul).toBeTruthy();
});
