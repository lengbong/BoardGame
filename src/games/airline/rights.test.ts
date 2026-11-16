import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL } from './aircraft';
import { aiTurn, planTurn } from './ai';
import { applyRenewPlan, renewPlan } from './bulk';
import { defaultCabin } from './cabin';
import { charterPlaneIds } from './charters';
import {
  RIGHT_LAPSE,
  applyRightsBlocker,
  approvalChance,
  countryKey,
  openYear,
  pairKeyAt,
  pairUsage,
  rightsInfo,
  rightsInfoFor,
  rightsMode,
  splitRightsList,
  tierOf,
} from './rights';
import { actor, applyAction, assignBlocker, bestFreq, createGame, routeBlocker } from './rules';
import { companyValue, slotCapacity, slotsUsed } from './simulate';
import { isValidState, parseOptions, parseSaved } from './storage';
import { defaultTimes } from './timetable';
import { yearOf } from './time';
import type { AirlineOptions, AirlineSetup, AirlineState, CharterOffer, SeatKind } from './types';

function setup(kinds: SeatKind[], options: Partial<AirlineOptions> = {}, hubs: (string | null)[] = []): AirlineSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as AirlineSetup['seats'],
    options: { era: 1983, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'rich', challenge: null, aiStyle: 'normal', names: 'fictional', ...options },
    hubs: [0, 1, 2, 3].map((i) => hubs[i] ?? null),
    airlines: [null, null, null, null],
  };
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function act(s: AirlineState, ...actions: Parameters<typeof applyAction>[1][]): AirlineState {
  for (const a of actions) {
    const next = applyAction(s, a, seededRandom(9));
    expect(next, JSON.stringify(a)).not.toBe(s);
    s = next;
  }
  return s;
}

/** 이 회사 차례가 올 때까지 (사람은 차례를 마치고, 컴퓨터는 경영한다) */
function untilActor(s: AirlineState, ci: number, rng = seededRandom(5)): AirlineState {
  let guard = 0;
  while (actor(s) !== ci && s.phase !== 'gameover' && guard++ < 50) {
    const k = actor(s);
    s = s.companies[k].kind === 'human' ? applyAction(s, { type: 'endTurn' }, rng) : aiTurn(s, rng);
  }
  return s;
}

/** 한 달을 모두 마친다 (사람은 그냥 넘긴다) */
function passMonth(s: AirlineState, rng = seededRandom(3)): AirlineState {
  const t = s.t;
  let guard = 0;
  while (s.t === t && s.phase !== 'gameover' && guard++ < 50) {
    const k = actor(s);
    s = s.companies[k].kind === 'human' ? applyAction(s, { type: 'endTurn' }, rng) : aiTurn(s, rng);
  }
  return s;
}

/** 노선과 그 노선을 나는 비행기 한 대를 바로 붙인다 (지점도) */
function addRoute(s: AirlineState, ci: number, a: string, b: string, model: string, freq: number): { route: number; plane: number } {
  const c = s.companies[ci];
  for (const city of [a, b]) if (!c.branches.includes(city)) c.branches.push(city);
  let r = c.routes.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  if (!r) {
    r = { id: s.nextId++, a, b, fare: 0, since: s.t, stats: null, times: defaultTimes(a, b, yearOf(s.q)) };
    c.routes.push(r);
  }
  const plane = s.nextId++;
  c.planes = [...c.planes, { id: plane, model, leased: true, rent: 3, deposit: 0, since: s.t, legs: [{ route: r.id, freq }], cabin: defaultCabin(MODEL[model]), meal: 3, cond: 80 }];
  return { route: r.id, plane };
}

describe('운수권', () => {
  it('나라는 politics.ts의 polity를 쓰고, 협정은 시대마다 넓어진다', () => {
    expect(pairKeyAt('seoul', 'busan', 1990)).toBe(countryKey('한국', '한국'));
    expect(pairKeyAt('hongkong', 'tokyo', 1990)).toBe(countryKey('영국령 홍콩', '일본'));
    expect(pairKeyAt('hongkong', 'tokyo', 2000)).toBe(countryKey('홍콩', '일본'));
    expect(tierOf('일본', '대만', 1970)).toBe(0);
    expect(tierOf('일본', '대만', 1990)).toBe(1);
    expect(tierOf('일본', '대만', 2011)).toBe(2);
    expect(openYear('프랑스', '독일')).toBe(1997);
    expect(tierOf('미국', '네덜란드', 1996)).toBe(2);
  });

  it('간단히: 1978년부터 본국 노선은 자유, 외국과 외국 사이는 주 21회 (옛 협정은 본국 21·외국 7)', () => {
    const s = createGame(setup(['human', 'human'], {}, ['seoul', 'london']), seededRandom(1));
    const home = rightsInfoFor(s, 0, 'seoul', 'tokyo');
    expect(home.allow).toBe(Infinity);
    expect(home.free).toBe('home');
    const far = rightsInfoFor(s, 0, 'tokyo', 'taipei');
    expect(far.allow).toBe(21);
    expect(far.label).toBe('대만–일본');
    const old = createGame(setup(['human', 'human'], { era: 1963 }, ['seoul', 'london']), seededRandom(1));
    expect(rightsInfoFor(old, 0, 'seoul', 'tokyo').allow).toBe(21);
    expect(rightsInfoFor(old, 0, 'tokyo', 'manila').allow).toBe(7);
    expect(rightsInfoFor(old, 0, 'seoul', 'busan').domestic).toBe(true);
  });

  /** 0번(서울 본사)이 도쿄–타이베이·오사카–타이베이 노선과 비행기를 가진 판 */
  function farRoutes(options: Partial<AirlineOptions> = {}): { s: AirlineState; tpe: number; osa: number; p1: number; p2: number } {
    let s = createGame(setup(['human', 'human'], { era: 1983, ...options }, ['seoul', 'london']), seededRandom(1));
    s = act(s, { type: 'openBranch', city: 'tokyo' }, { type: 'openBranch', city: 'taipei' }, { type: 'openBranch', city: 'osaka' });
    s = act(s, { type: 'openRoute', a: 'tokyo', b: 'taipei' }, { type: 'openRoute', a: 'osaka', b: 'taipei' });
    s = act(s, { type: 'lease', model: 'b737-200' }, { type: 'lease', model: 'b737-200' });
    const [tpe, osa] = s.companies[0].routes.map((r) => r.id);
    const [p1, p2] = s.companies[0].planes.map((p) => p.id);
    return { s, tpe, osa, p1, p2 };
  }

  it('두 나라 사이 노선을 모두 더해 주간 횟수를 넘으면 더 띄울 수 없다 (줄이는 것은 된다)', () => {
    const { s: s0, tpe, osa, p1, p2 } = farRoutes();
    // 한 대로 도쿄–타이베이 12회 (비행시간 안), 다른 한 대로 오사카–타이베이를 띄우면 남은 9회까지만
    const f1 = Math.min(12, bestFreq(s0, 0, p1, tpe));
    let s = act(s0, { type: 'assign', plane: p1, route: tpe, freq: f1 });
    const key = pairKeyAt('tokyo', 'taipei', yearOf(s.q));
    expect(pairUsage(s.companies[0], yearOf(s.q)).get(key)).toBe(f1);
    const left = 21 - f1;
    expect(bestFreq(s, 0, p2, osa)).toBeLessThanOrEqual(left);
    expect(assignBlocker(s, 0, p2, osa, left + 1)).toContain('운수권이 모자라요');
    s = act(s, { type: 'assign', plane: p2, route: osa, freq: Math.min(left, bestFreq(s, 0, p2, osa)) });
    expect(rightsInfo(s, 0, key).used).toBeLessThanOrEqual(21);
    // 줄이기는 늘 된다
    expect(assignBlocker(s, 0, p1, tpe, f1 - 1)).toBeNull();
  });

  it('운수권을 다 쓰면 그 두 나라 사이 새 노선을 열 수 없고, 이유를 알려 준다', () => {
    const { s: s0, tpe, p1 } = farRoutes();
    let s = act(s0, { type: 'assign', plane: p1, route: tpe, freq: Math.min(12, bestFreq(s0, 0, p1, tpe)) });
    // 쓰는 횟수를 21로 꾸민다 (비행기 한 대 더)
    s.companies[0] = { ...s.companies[0], planes: [...s.companies[0].planes, { id: s.nextId, model: 'b737-200', leased: true, rent: 1, deposit: 0, since: s.t, legs: [{ route: tpe, freq: 21 - s.companies[0].planes[0].legs[0].freq }], cabin: defaultCabin(MODEL['b737-200']), meal: 3 }] };
    s = { ...s, nextId: s.nextId + 1 };
    s = act(s, { type: 'openBranch', city: 'manila' });
    expect(routeBlocker(s, 0, 'osaka', 'taipei')).toBe('이미 있는 노선이에요');
    // 다른 두 나라(일본–필리핀)는 아직 남아 있다
    expect(routeBlocker(s, 0, 'tokyo', 'manila')).toBeNull();
    // 오사카–타이베이를 닫고 다시 열려 하면 운수권 때문에 막힌다
    const osaRoute = s.companies[0].routes.find((r) => r.a === 'osaka')!.id;
    s = act(s, { type: 'closeRoute', route: osaRoute });
    expect(routeBlocker(s, 0, 'osaka', 'taipei')).toContain('운수권');
  });

  it('신청하면 돈을 내고 기다리며, 결산 때 받아들여지면 횟수가 늘고 1년 동안 안 쓰면 돌려준다', () => {
    const { s: s0 } = farRoutes();
    const key = pairKeyAt('tokyo', 'taipei', 1983);
    expect(approvalChance(s0, 0, key)).toBeCloseTo(0.75, 6);
    let granted: AirlineState | null = null;
    // 결과는 판·달마다 정해진다: 몇 달 안에 한 번은 받아들여진다
    let s = s0;
    for (let k = 0; k < 6 && !granted; k++) {
      const cash = s.companies[0].cash;
      s = act(s, { type: 'applyRights', key });
      expect(s.companies[0].cash).toBe(cash - 10);
      expect(applyRightsBlocker(s, 0, key)).toContain('기다리는 중');
      s = passMonth(s);
      s = passMonth(s);
      s = untilActor(s, 0);
      if (rightsInfo(s, 0, key).extra > 0) granted = s;
    }
    expect(granted).not.toBeNull();
    const info = rightsInfo(granted!, 0, key);
    expect(info.allow).toBe(21 + 14);
    expect(granted!.news.some((n) => n.title.includes('운수권 심사'))).toBe(true);
    // 더 받은 횟수를 쓰지 않으면 12달 뒤 돌려준다
    let t = granted!;
    for (let k = 0; k < RIGHT_LAPSE + 1; k++) t = passMonth(t);
    expect(rightsInfo(t, 0, key).extra).toBe(0);
  });

  it('실제처럼: 외국과 외국 사이는 신청해야 날고, 옛 협정 동안은 날 수 있는 항공사 수가 정해져 있다', () => {
    const s = createGame(setup(['human', 'human', 'human'], { era: 1963, rights: 'real' }, ['seoul', 'london', 'paris']), seededRandom(1));
    expect(rightsInfoFor(s, 0, 'tokyo', 'manila').allow).toBe(0);
    expect(rightsInfoFor(s, 0, 'seoul', 'tokyo').allow).toBe(7);
    // 1·2번이 이미 영국–미국 같은 두 나라를 날면 0번은 자리가 없다
    let t = act(s, { type: 'openBranch', city: 'tokyo' }, { type: 'openBranch', city: 'manila' });
    t = { ...t, rights: { held: [[], [{ key: pairKeyAt('tokyo', 'manila', 1963), add: 7, since: t.t, used: t.t }], [{ key: pairKeyAt('tokyo', 'manila', 1963), add: 7, since: t.t, used: t.t }]], apps: [[], [], []] } };
    const info = rightsInfoFor(t, 0, 'tokyo', 'manila');
    expect(info.full).toBe(true);
    expect(applyRightsBlocker(t, 0, info.key)).toContain('자리가 찼어요');
    expect(routeBlocker(t, 0, 'tokyo', 'manila')).toContain('자리가 찼어요');
  });

  it('냉전으로 막힌 하늘길은 운수권으로도 열 수 없다 (정치가 먼저)', () => {
    const s = createGame(setup(['human', 'human'], { era: 1983 }, ['seoul', 'london']), seededRandom(1));
    const key = countryKey('한국', '중국');
    expect(applyRightsBlocker(s, 0, key)).toContain('국교');
    const t = act(s, { type: 'openBranch', city: 'tokyo' });
    expect(routeBlocker(t, 0, 'tokyo', 'beijing')).toContain('지점이 없어요');
  });

  it('운수권을 끄면 횟수 제한이 없다 (슬롯·비행시간만)', () => {
    const { s: s0, tpe, p1 } = farRoutes({ rights: 'off' });
    expect(rightsInfoFor(s0, 0, 'tokyo', 'taipei').allow).toBe(Infinity);
    let s = act(s0, { type: 'assign', plane: p1, route: tpe, freq: Math.min(12, bestFreq(s0, 0, p1, tpe)) });
    s.companies[0] = { ...s.companies[0], planes: [...s.companies[0].planes, { id: s.nextId, model: 'b737-200', leased: true, rent: 1, deposit: 0, since: s.t, legs: [{ route: tpe, freq: 20 }], cabin: defaultCabin(MODEL['b737-200']), meal: 3 }] };
    s = { ...s, nextId: s.nextId + 1 };
    expect(routeBlocker(s, 0, 'osaka', 'taipei')).toBe('이미 있는 노선이에요');
    expect(applyRightsBlocker(s, 0, pairKeyAt('tokyo', 'taipei', 1983))).toContain('끈 판');
  });
});

describe('운수권 저장', () => {
  it('운수권 값이 없는 4판 저장도 불러오고, 그 판은 운수권을 끈 예전 규칙 그대로다', () => {
    const setupObj = setup(['human', 'ai-normal']);
    let s = createGame(setupObj, seededRandom(4));
    s = passMonth(s);
    const old = clone(s) as unknown as Record<string, unknown>;
    delete (old.options as Record<string, unknown>).rights;
    delete old.rights;
    const oldSetup = clone(setupObj) as unknown as { options: Record<string, unknown> };
    delete oldSetup.options.rights;
    const saved = parseSaved({ setup: oldSetup, state: old, savedAt: 1 });
    expect(saved).not.toBeNull();
    expect(saved!.state.options.rights).toBeUndefined();
    expect(rightsMode(saved!.state)).toBe('off');
    expect(rightsInfoFor(saved!.state, 0, 'tokyo', 'taipei').allow).toBe(Infinity);
    expect(isValidState(saved!.state)).toBe(true);
    // 이어서 두어도 멈추지 않는다
    let t = saved!.state;
    for (let k = 0; k < 4; k++) t = passMonth(t);
    expect(t.rights).toBeUndefined();
    expect(t.phase).toBe('manage');
  });

  it('운수권 값이 있는 저장은 그대로 다시 읽고, 망가진 운수권 장부는 받지 않는다', () => {
    const setupObj = setup(['human', 'human'], { rights: 'real' }, ['seoul', 'london']);
    let s = createGame(setupObj, seededRandom(4));
    s = act(s, { type: 'applyRights', key: countryKey('일본', '필리핀') });
    const back = parseSaved(clone({ setup: setupObj, state: s, savedAt: 1 }))!;
    expect(back).not.toBeNull();
    expect(back.state.options.rights).toBe('real');
    expect(back.setup.options.rights).toBe('real');
    expect(back.state.rights!.apps[0].length).toBe(1);
    const bad = clone(s);
    bad.rights = { held: [[{ key: 'x', add: 7, since: 0, used: 0 }], []], apps: [[], []] };
    expect(isValidState(bad)).toBe(false);
    const bad2 = clone(s);
    bad2.rights = { held: [[]], apps: [[]] };
    expect(isValidState(bad2)).toBe(false);
  });

  it('설정 값은 올바른 것만 남기고, 없으면 새 게임은 간단히 (도전 과제는 끈다)', () => {
    expect(parseOptions({ rights: 'real' }).rights).toBe('real');
    expect('rights' in parseOptions({ rights: 'nope' })).toBe(false);
    const s = createGame({ ...setup(['human', 'human']), options: parseOptions({}) }, seededRandom(1));
    expect(s.options.rights).toBe('simple');
    const ch = createGame(setup(['human'], { mode: 'challenge', challenge: 'oilstorm' }), seededRandom(1));
    expect(rightsMode(ch)).toBe('off');
  });
});

describe('다른 기능과 함께', () => {
  /** 0번(서울)이 1번(도쿄 본사 컴퓨터)을 인수할 수 있게 꾸민 판 */
  function mergeReady(rights: 'simple' | 'real', hubs: string[]): AirlineState {
    const s = createGame(setup(['human', 'ai-normal', 'ai-easy'], { rights }, hubs), seededRandom(2));
    s.stakes = s.companies.map(() => s.companies.map(() => 0));
    s.stakes[1][0] = 60;
    s.companies[0].cash = 99999;
    expect(actor(s)).toBe(0);
    return s;
  }

  it('인수: 인수된 회사의 운수권·신청을 넘겨받고, 날던 하늘길은 그 회사 기본 횟수만큼까지 이어서 난다', () => {
    let s = mergeReady('simple', ['seoul', 'tokyo', 'paris']);
    const key = pairKeyAt('tokyo', 'taipei', 1983);
    // 우리는 도쿄–타이베이(외국 두 나라: 21회)를 15회, 도쿄 본사 회사는 본국 노선이라 제한 없이 30회
    addRoute(s, 0, 'tokyo', 'taipei', 'b737-200', 12);
    addRoute(s, 0, 'osaka', 'taipei', 'b737-200', 3);
    addRoute(s, 1, 'tokyo', 'taipei', 'b737-200', 13);
    addRoute(s, 1, 'tokyo', 'taipei', 'b737-200', 13);
    addRoute(s, 1, 'osaka', 'taipei', 'b737-200', 4);
    const otherKey = countryKey('일본', '필리핀');
    s.rights = { held: [[], [{ key: otherKey, add: 14, since: s.t, used: s.t }], []], apps: [[], [{ key: countryKey('대만', '필리핀'), add: 14, due: s.t + 1, fee: 10 }], []] };
    expect(rightsInfo(s, 0, key).allow).toBe(21);
    s = act(s, { type: 'merge', company: 1 });
    expect(s.companies[1].out).toBe(true);
    const info = rightsInfo(s, 0, key);
    // 합친 횟수(슬롯을 넘으면 rules.ts가 먼저 줄인다)는 모두 운수권 안이고, 줄이지 않았다
    expect(info.used).toBeLessThanOrEqual(info.allow);
    expect(info.used).toBe(pairUsage(s.companies[0], 1983).get(key));
    expect(info.used).toBeGreaterThan(21);
    // 더 받은 운수권과 기다리던 신청도 넘어온다
    expect(rightsInfo(s, 0, otherKey).extra).toBe(14);
    expect(s.rights!.apps[0].some((a) => a.key === countryKey('대만', '필리핀'))).toBe(true);
    expect(s.rights!.held[1]).toEqual([]);
    for (const city of s.companies[0].branches) expect(slotsUsed(s.companies[0], city)).toBeLessThanOrEqual(slotCapacity(s, 0, city));
    expect(isValidState(s)).toBe(true);
  });

  it('인수: 그래도 넘치는 횟수는 넘겨받은 비행기부터 줄이고, 원래 우리 비행기는 그대로', () => {
    let s = mergeReady('real', ['seoul', 'london', 'paris']);
    const key = pairKeyAt('tokyo', 'taipei', 1983);
    const mine = addRoute(s, 0, 'tokyo', 'taipei', 'b737-200', 7);
    const theirs = addRoute(s, 1, 'tokyo', 'taipei', 'b737-200', 10);
    // 실제처럼: 외국 두 나라라 기본 0회. 둘 다 7회씩 받았는데 1번은 10회를 날고 있었다 (넘친 3회)
    s.rights = { held: [[{ key, add: 7, since: s.t, used: s.t }], [{ key, add: 7, since: s.t, used: s.t }], []], apps: [[], [], []] };
    s = act(s, { type: 'merge', company: 1 });
    const a = s.companies[0];
    const info = rightsInfo(s, 0, key);
    expect(info.allow).toBe(14);
    expect(info.used).toBe(14);
    expect(a.planes.find((p) => p.id === mine.plane)!.legs[0].freq).toBe(7);
    expect(a.planes.find((p) => p.id === theirs.plane)!.legs[0].freq).toBe(7);
  });

  it('동맹(코드셰어) 회사의 비행은 우리 횟수에 들지 않는다 (회사마다 제 운수권)', () => {
    const s = createGame(setup(['human', 'human'], {}, ['seoul', 'london']), seededRandom(1));
    addRoute(s, 1, 'tokyo', 'taipei', 'b737-200', 14);
    s.alliances = [{ id: 1, name: '하늘별 동맹', members: [0, 1], since: s.t }];
    expect(rightsInfoFor(s, 1, 'tokyo', 'taipei').used).toBe(14);
    expect(rightsInfoFor(s, 0, 'tokyo', 'taipei').used).toBe(0);
    expect(rightsInfoFor(s, 0, 'tokyo', 'taipei').left).toBe(21);
  });

  it('전세기 계약은 운수권을 쓰지 않고, 전세기로 나간 비행기는 노선에도 넣을 수 없다', () => {
    let s = createGame(setup(['human', 'human'], { era: 1983 }, ['seoul', 'london']), seededRandom(3));
    const r = addRoute(s, 0, 'tokyo', 'taipei', 'b737-200', 12);
    addRoute(s, 0, 'tokyo', 'taipei', 'b737-200', 9);
    const key = pairKeyAt('tokyo', 'taipei', 1983);
    expect(rightsInfo(s, 0, key).left).toBe(0);
    const idle = s.nextId++;
    s.companies[0].planes = [...s.companies[0].planes, { id: idle, model: 'b737-200', leased: true, rent: 3, deposit: 0, since: s.t, legs: [], cabin: defaultCabin(MODEL['b737-200']), meal: 3, cond: 90 }];
    const offer: CharterOffer = { id: s.nextId++, a: 'tokyo', b: 'taipei', pax: 600, pay: 20, title: '수학여행 단체', icon: '🎒', listed: s.t, expires: s.t + 2 };
    s.charters = [offer];
    // 운수권을 다 썼어도 한 번짜리 전세기는 맡을 수 있다
    s = act(s, { type: 'charter', offer: offer.id, plane: idle });
    expect(charterPlaneIds(s, 0).has(idle)).toBe(true);
    expect(rightsInfo(s, 0, key).used).toBe(21);
    expect(assignBlocker(s, 0, idle, r.route, 1)).toContain('전세기');
  });

  it('한꺼번에 고치기의 낡은 비행기 바꾸기는 운수권을 다 쓴 노선에서도 같은 횟수로 바꾸고 넘지 않는다', () => {
    const s = createGame(setup(['human', 'human'], { era: 2003, money: 'normal' }, ['seoul', 'london']), seededRandom(1));
    const key = pairKeyAt('bangkok', 'singapore', 2003);
    expect(rightsInfo(s, 0, key).allow).toBe(21);
    const r = addRoute(s, 0, 'bangkok', 'singapore', 'b737-200', 14);
    addRoute(s, 0, 'bangkok', 'singapore', 'b737-200', 7);
    // 30년 된 비싼 리스기로 꾸민다
    s.companies[0].planes = s.companies[0].planes.map((p) => (p.id === r.plane ? { ...p, since: s.t - 360, rent: 25 } : p));
    const plan = renewPlan(s, 0);
    const after = applyRenewPlan(s, 0, plan);
    const info = rightsInfo(after, 0, key);
    expect(plan.items.length).toBe(1);
    expect(after.companies[0].planes.some((p) => p.id === r.plane)).toBe(false);
    expect(info.used).toBe(21);
  });
});

describe('컴퓨터와 운수권', () => {
  it('컴퓨터는 운수권 안에서만 띄우고, 모자라면 신청한다 (1963년 간단히·실제처럼)', () => {
    for (const rights of ['simple', 'real'] as const) {
      const rng = seededRandom(rights === 'simple' ? 41 : 43);
      let s = createGame(setup(['ai-normal', 'ai-normal', 'ai-easy'], { era: 1963, rights }, ['singapore', 'hongkong', 'bangkok']), rng);
      let applied = 0;
      while (yearOf(s.q) < 1968 && s.phase !== 'gameover') {
        s = aiTurn(s, rng);
        applied = Math.max(applied, (s.rights?.held ?? []).flat().length + (s.rights?.apps ?? []).flat().length);
        s.companies.forEach((c, ci) => {
          if (c.out) return;
          for (const [key, used] of pairUsage(c, yearOf(s.q))) {
            const info = rightsInfo(s, ci, key);
            expect(used, `${rights} ${c.name} ${key}`).toBeLessThanOrEqual(info.allow);
          }
        });
      }
      expect(applied, rights).toBeGreaterThan(0);
    }
  }, 60000);

  it('컴퓨터가 정한 운수권 신청도 다시 하면 하나도 거절되지 않는다', () => {
    const rng = seededRandom(51);
    let s = createGame(setup(['ai-normal', 'ai-normal', 'ai-easy', 'ai-normal'], { era: 1983, rights: 'real' }), rng);
    let applies = 0;
    for (let turn = 0; turn < 120 && s.phase !== 'gameover'; turn++) {
      const ci = actor(s);
      const level = s.companies[ci].kind === 'ai-easy' ? 'ai-easy' : 'ai-normal';
      const actions = planTurn(s, ci, level, seededRandom(turn));
      let t = s;
      for (const a of actions) {
        const next = applyAction(t, a);
        expect(next, JSON.stringify(a)).not.toBe(t);
        if (a.type === 'applyRights') applies++;
        t = next;
      }
      s = applyAction(t, { type: 'endTurn' }, rng);
    }
    expect(applies).toBeGreaterThan(0);
  }, 60000);

  it('시드 고정 컴퓨터끼리 실제처럼으로 끝까지 가고, 한 차례는 짧다', () => {
    const rng = seededRandom(61);
    let s = createGame(setup(['ai-normal', 'ai-normal', 'ai-easy', 'ai-normal'], { era: 1983, years: 10, rights: 'real', money: 'normal' }), rng);
    let worst = 0;
    let guard = 0;
    while (s.phase !== 'gameover' && guard++ < 3000) {
      const t0 = performance.now();
      s = aiTurn(s, rng);
      worst = Math.max(worst, performance.now() - t0);
    }
    expect(s.phase).toBe('gameover');
    expect(s.result!.winners.length).toBeGreaterThan(0);
    for (let i = 0; i < s.companies.length; i++) expect(Number.isFinite(companyValue(s, i))).toBe(true);
    expect(isValidState(clone(s))).toBe(true);
    expect(worst).toBeLessThan(600);
  }, 60000);
});

describe('운수권 카드 목록 접기', () => {
  const row = (name: string, left: number, pending = false) => ({ name, left, pending: pending ? { key: name, add: 14, due: 0, fee: 10 } : null });
  const names = (xs: { name: string }[]) => xs.map((x) => x.name);

  it('다 쓴 곳·신청 중인 곳은 여섯 줄을 넘어도 모두 보이고, 넉넉한 곳만 접힌다', () => {
    const list = [
      ...Array.from({ length: 7 }, (_, i) => row(`다씀${i}`, 0)),
      row('신청', 9, true),
      ...Array.from({ length: 5 }, (_, i) => row(`넉넉${i}`, 5 + i)),
    ];
    const { top, rest } = splitRightsList(list);
    expect(names(top)).toEqual([...Array.from({ length: 7 }, (_, i) => `다씀${i}`), '신청']);
    expect(names(rest)).toEqual(['넉넉0', '넉넉1', '넉넉2', '넉넉3', '넉넉4']);
  });

  it('급한 곳이 적으면 빠듯한 차례로 여섯 줄까지 채우고, 신청 중인 곳은 뒤에 있어도 보인다', () => {
    const list = [row('a', 0), row('b', 1), row('c', 2), row('d', 3), row('e', 4), row('f', 5), row('g', 6), row('h', 7), row('i', 8, true), row('j', 9)];
    const { top, rest } = splitRightsList(list);
    expect(names(top)).toEqual(['a', 'b', 'c', 'd', 'e', 'i']);
    expect(names(rest)).toEqual(['f', 'g', 'h', 'j']);
  });

  it('접을 곳이 두 곳 이하면 모두 보인다', () => {
    const list = Array.from({ length: 8 }, (_, i) => row(`x${i}`, i + 1));
    expect(splitRightsList(list)).toEqual({ top: list, rest: [] });
    expect(splitRightsList(list.slice(0, 3))).toEqual({ top: list.slice(0, 3), rest: [] });
  });
});
