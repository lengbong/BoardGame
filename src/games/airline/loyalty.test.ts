import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL } from './aircraft';
import { aiTurn, planTurn } from './ai';
import { contestedShare, wantedLevel } from './aiLoyalty';
import { CAMPAIGN_INFO } from './ads';
import {
  AWARD_BOOST,
  BRAND_CHANGE_MONTHS,
  BRAND_COOLDOWN,
  BRAND_SWITCH_KEEP,
  allFits,
  bestPosition,
  brandBlocker,
  brandChangeCost,
  brandStats,
  fitOf,
  newBrand,
  stepBrand,
} from './brandPosition';
import { defaultCabin } from './cabin';
import { CITY, REGIONS } from './cities';
import {
  BRAND_EFFECT,
  DOWNGRADE_LOSS,
  GOLD_LOUNGE_SAVE,
  LOYALTY_FROM,
  LOYALTY_LEVELS,
  POOL_K,
  chargeLoyalty,
  emptyRegionMap,
  loyaltyBlocker,
  loyaltyCost,
  loyaltyQuality,
  loyaltyUpkeep,
  memberFlow,
  newLoyalty,
  pullAt,
  regionFlights,
  rewardCost,
  settleCost,
  stepMembers,
  totalMembers,
  upgradeFee,
} from './loyalty';
import { isLoyaltyAction } from './loyaltyRules';
import { actor, applyAction, createGame } from './rules';
import { companyValue, computeMonth, emptyReport, splitMarket, type Offer } from './simulate';
import { isValidState, parseSaved } from './storage';
import { defaultTimes } from './timetable';
import { STAFF_GROUPS, staffNeed } from './staff';
import { yearOf } from './time';
import type { AirlineOptions, AirlineSetup, AirlineState, Company, CompanyReport, RegionId, SeatKind } from './types';
import type { LoyaltyLevel, LoyaltyState } from './loyaltyTypes';

function setup(kinds: SeatKind[], options: Partial<AirlineOptions> = {}, hubs: (string | null)[] = [], models: AirlineSetup['models'] = undefined): AirlineSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as AirlineSetup['seats'],
    options: { era: 1983, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'rich', challenge: null, aiStyle: 'normal', names: 'fictional', ...options },
    hubs: [0, 1, 2, 3].map((i) => hubs[i] ?? null),
    airlines: [null, null, null, null],
    ...(models ? { models } : {}),
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
function addRoute(s: AirlineState, ci: number, a: string, b: string, model: string, freq: number, fare = 0): number {
  const c = s.companies[ci];
  for (const city of [a, b]) if (!c.branches.includes(city)) c.branches.push(city);
  let r = c.routes.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  if (!r) {
    r = { id: s.nextId++, a, b, fare, since: s.t, stats: null, times: defaultTimes(a, b, yearOf(s.q)) };
    c.routes.push(r);
  }
  const plane = s.nextId++;
  c.planes = [...c.planes, { id: plane, model, leased: true, rent: 3, deposit: 0, since: s.t, legs: [{ route: r.id, freq }], cabin: defaultCabin(MODEL[model]), meal: 3, cond: 80 }];
  return r.id;
}

/** 사람 회사 하나(0번)가 서울에서 동아시아·유럽으로 나는 1990년 판 */
function humanGame(year: 1983 | 2003 = 1983, kinds: SeatKind[] = ['human', 'ai-normal']): AirlineState {
  const s = clone(createGame(setup(kinds, { era: year }, ['seoul', 'london']), seededRandom(4)));
  // 1990년으로 (단골 프로그램은 1981년부터)
  const t = 1990 * 12;
  s.t = Math.max(s.t, t);
  s.q = Math.floor(s.t / 3);
  s.startT = Math.min(s.startT, s.t);
  s.startQ = Math.floor(s.startT / 3);
  addRoute(s, 0, 'seoul', 'tokyo', 'a300-600', 14);
  addRoute(s, 0, 'seoul', 'hongkong', 'a300-600', 10);
  addRoute(s, 0, 'seoul', 'london', 'b747-200', 7);
  s.companies[0].cash = 5000;
  // 일손이 모자라 결항이 나지 않게 (정시율이 무너지면 회원이 떠난다)
  const need = staffNeed(s, s.companies[0]);
  for (const g of STAFF_GROUPS) s.companies[0].staff[g].have = Math.ceil(need[g] * 1.15);
  return s;
}

/** 다 자란 회원 (지역 손님만큼, 단계 최대 몫) */
function matureLoyalty(c: Company, rep: CompanyReport, level: LoyaltyLevel, t: number): LoyaltyState {
  const cap = LOYALTY_LEVELS[level].cap;
  const fl = regionFlights(c);
  const L = newLoyalty(level, t - 36);
  for (const r of REGIONS) {
    L.base[r] = Math.round(rep.regionPax[r]);
    L.members[r] = Math.round(rep.regionPax[r] * POOL_K * cap);
    L.reach[r] = fl[r];
    L.pen[r] = rep.regionPax[r] > 0 ? cap : 0;
  }
  return L;
}

function fakeReport(regionPax: Partial<Record<RegionId, number>>, ticket = 1000): CompanyReport {
  const r = emptyReport();
  r.ticket = ticket;
  for (const k of REGIONS) r.regionPax[k] = regionPax[k] ?? 0;
  r.pax = Object.values(r.regionPax).reduce((a, b) => a + b, 0);
  r.flights = 100;
  return r;
}

describe('단골 프로그램: 시작·단계·돈·막는 까닭', () => {
  it(`${LOYALTY_FROM}년 전에는 시작할 수 없고, 화물 전문은 못 하며, 저가항공은 기본까지`, () => {
    const s = humanGame();
    const early = clone(s);
    early.t = 1979 * 12;
    early.q = Math.floor(early.t / 3);
    expect(loyaltyBlocker(early, 0, 1)).toContain(`${LOYALTY_FROM}년부터`);
    expect(loyaltyBlocker(s, 0, 1)).toBeNull();
    const cargo = clone(s);
    cargo.companies[0].bizModel = 'cargo';
    expect(loyaltyBlocker(cargo, 0, 1)).toContain('화물');
    const lcc = clone(s);
    lcc.companies[0].bizModel = 'lcc';
    expect(loyaltyBlocker(lcc, 0, 1)).toBeNull();
    expect(loyaltyBlocker(lcc, 0, 2)).toContain('저가항공');
    expect(loyaltyBlocker(s, 0, 0)).toBe('프로그램이 없어요');
    expect(loyaltyBlocker(s, 0, 4)).toBe('없는 단계예요');
    const empty = clone(s);
    empty.companies[0].planes = [];
    expect(loyaltyBlocker(empty, 0, 1)).toContain('비행기');
    const poor = clone(s);
    poor.companies[0].cash = 1;
    expect(loyaltyBlocker(poor, 0, 1)).toContain('돈이 모자라요');
  });

  it('시작·올리기는 값을 내고, 내리기는 공짜지만 회원 10%가 떠나고, 그만두면 마일리지를 정리하고 평판이 조금 내려간다', () => {
    let s = humanGame();
    const cash0 = s.companies[0].cash;
    const fee1 = upgradeFee(s.companies[0], 0, 1);
    expect(fee1).toBe(Math.round(LOYALTY_LEVELS[1].fee + LOYALTY_LEVELS[1].feePerPlane * 3));
    s = act(s, { type: 'setLoyalty', level: 1 });
    expect(s.companies[0].loyalty?.level).toBe(1);
    expect(s.companies[0].cash).toBeCloseTo(cash0 - fee1, 6);
    expect(s.events.some((e) => e.type === 'loyalty')).toBe(true);
    expect(s.log.at(-1)!.text).toContain('시작');
    // 바로 골드로: 실버·골드 값을 모두 낸다
    const fee13 = upgradeFee(s.companies[0], 1, 3);
    expect(fee13).toBe(upgradeFee(s.companies[0], 1, 2) + upgradeFee(s.companies[0], 2, 3));
    const cash1 = s.companies[0].cash;
    s = act(s, { type: 'setLoyalty', level: 3 });
    expect(s.companies[0].cash).toBeCloseTo(cash1 - fee13, 6);
    expect(loyaltyBlocker(s, 0, 3)).toBe('지금 단계예요');
    // 회원을 채우고 내리기
    const c = s.companies[0];
    c.loyalty = { ...c.loyalty!, members: { ...emptyRegionMap(), eastasia: 10000, europe: 5000 }, last: 40 };
    const cash2 = c.cash;
    s = act(s, { type: 'setLoyalty', level: 2 });
    expect(s.companies[0].cash).toBe(cash2);
    expect(s.companies[0].loyalty!.members.eastasia).toBe(Math.round(10000 * (1 - DOWNGRADE_LOSS)));
    // 그만두기
    const rep0 = s.companies[0].reputation;
    const settle = settleCost(s.companies[0]);
    expect(settle).toBe(80);
    const cash3 = s.companies[0].cash;
    s = act(s, { type: 'setLoyalty', level: 0 });
    expect(s.companies[0].loyalty).toBeUndefined();
    expect(s.companies[0].cash).toBeCloseTo(cash3 - settle, 6);
    expect(s.companies[0].reputation).toBeCloseTo(Math.max(0, rep0 - 2), 6);
  });

  it('남은 마일리지를 정리할 돈이 없으면 그만둘 수 없다', () => {
    const s = humanGame();
    const c = s.companies[0];
    c.loyalty = { ...newLoyalty(1, s.t), last: 100 };
    c.cash = 50;
    expect(loyaltyBlocker(s, 0, 0)).toContain('정리할 돈');
    c.cash = 500;
    expect(loyaltyBlocker(s, 0, 0)).toBeNull();
  });

  it('달 값 = 운영비(단계 바탕 + 비행기 수만큼) + 마일리지(회원이 탄 운임 × 단계 비율), 광고비에 들고 따로 적힌다', () => {
    const s = humanGame();
    const c = s.companies[0];
    c.loyalty = newLoyalty(2, s.t);
    c.loyalty.pen = { ...emptyRegionMap(), eastasia: 0.5, europe: 0.25 };
    const rep = fakeReport({ eastasia: 3000, europe: 1000 }, 2000);
    const upkeep = loyaltyUpkeep(c);
    expect(upkeep).toBeCloseTo(LOYALTY_LEVELS[2].upkeep + LOYALTY_LEVELS[2].upkeepPerPlane * 3, 6);
    // 회원 몫 평균 (3000×0.5 + 1000×0.25) / 4000 = 0.4375
    expect(rewardCost(c.loyalty, rep)).toBeCloseTo(2000 * 0.4375 * LOYALTY_LEVELS[2].reward, 6);
    const ads0 = rep.ads;
    chargeLoyalty(c, rep);
    expect(rep.loyalty).toBeCloseTo(loyaltyCost(c, rep), 6);
    expect(rep.ads - ads0).toBeCloseTo(rep.loyalty!, 6);
    // 비행기가 많을수록 운영비가 크다
    const big = { ...c, planes: [...c.planes, ...c.planes, ...c.planes] };
    expect(loyaltyUpkeep(big)).toBeGreaterThan(upkeep);
    // 골드는 우리 라운지가 있으면 운영비가 준다
    const gold = { ...c, loyalty: { ...c.loyalty, level: 3 as const } };
    const withLounge = { ...gold, facilities: [{ city: 'seoul', kind: 'lounge' as const, cost: 50 }] };
    expect(loyaltyUpkeep(withLounge)).toBeCloseTo(loyaltyUpkeep(gold) * GOLD_LOUNGE_SAVE, 6);
    // 프로그램이 없으면 아무것도 더하지 않는다
    const none = { ...c, loyalty: undefined };
    const rep2 = fakeReport({ eastasia: 10 });
    chargeLoyalty(none, rep2);
    expect(rep2.ads).toBe(0);
    expect(rep2.loyalty).toBeUndefined();
  });

  it('잘못 쓰면 손해: 혼자 나는 작은 회사가 다 자란 골드 회원을 두어도 손님은 조금 늘 뿐 이익은 준다', () => {
    const s = humanGame();
    const base = computeMonth(s).reports[0];
    const at = (lv: LoyaltyLevel) => {
      const t = clone(s);
      t.companies[0].loyalty = matureLoyalty(t.companies[0], base, lv, s.t);
      return computeMonth(t).reports[0];
    };
    const l1 = at(1);
    const l3 = at(3);
    expect(l1.pax).toBeGreaterThanOrEqual(base.pax);
    expect(l3.pax).toBeGreaterThanOrEqual(l1.pax);
    expect(l3.pax / base.pax).toBeLessThan(1.05);
    expect(l3.profit).toBeLessThan(base.profit);
    expect(l3.profit).toBeLessThan(l1.profit);
  });

  it('달 결산(computeMonth)의 광고비에 프로그램 값이 들어 이익이 그만큼 준다', () => {
    const s = humanGame();
    const before = computeMonth(s).reports[0];
    const t = clone(s);
    t.companies[0].loyalty = newLoyalty(1, s.t);
    const after = computeMonth(t).reports[0];
    expect(after.loyalty).toBeCloseTo(loyaltyUpkeep(t.companies[0]), 6);
    expect(after.ads - before.ads).toBeCloseTo(after.loyalty!, 6);
    expect(after.profit).toBeLessThan(before.profit);
  });
});

describe('회원 모이기·떠나기', () => {
  it('시작하면 달마다 지역 손님 가운데 회원이 천천히 모여 단계 최대 몫에 가까워진다', () => {
    let s = act(humanGame(), { type: 'setLoyalty', level: 1 });
    const totals: number[] = [];
    for (let k = 0; k < 30; k++) {
      s = passMonth(s);
      totals.push(totalMembers(s.companies[0].loyalty));
    }
    const L = s.companies[0].loyalty!;
    expect(totals[0]).toBeGreaterThan(0);
    // 천천히: 첫 달에 최대의 4분의 1도 안 모인다
    expect(totals[0]).toBeLessThan(totals[29] * 0.3);
    expect(totals[29]).toBeGreaterThan(totals[11]);
    expect(L.hist.length).toBe(24);
    expect(L.hist.at(-1)).toBe(totals[29]);
    // 회원 몫은 단계 최대 몫을 크게 넘지 않는다
    for (const r of REGIONS) expect(L.pen[r]).toBeLessThanOrEqual(LOYALTY_LEVELS[1].cap + 0.05);
    expect(L.pen.eastasia).toBeGreaterThan(0.25);
    expect(L.pen.europe).toBeGreaterThan(0.1);
    expect(L.members.africa).toBe(0);
    // 결산에 프로그램 값이 적힌다
    expect(L.last).toBeGreaterThan(0);
    expect(s.report!.companies[0].loyalty).toBeCloseTo(L.last, 1);
  });

  it('마일리지 두 배 캠페인·동맹 회사의 프로그램이 가입을 빠르게 하고, 높은 단계일수록 더 많이 모인다', () => {
    const s = humanGame(1983, ['human', 'ai-normal', 'ai-normal']);
    s.companies[0].loyalty = newLoyalty(1, s.t);
    const base = memberFlow(s, 0, s.t).join;
    const miles = clone(s);
    miles.companies[0].mods.push({ id: 1, kind: 'demand', value: 1.1, until: s.t + 6, label: `${CAMPAIGN_INFO.miles.icon} ${CAMPAIGN_INFO.miles.name}`, seg: 'biz' });
    expect(memberFlow(miles, 0, s.t).join).toBeGreaterThan(base * 1.5);
    expect(memberFlow(miles, 0, s.t).why.some((w) => w.text.includes('마일리지 두 배'))).toBe(true);
    const allied = clone(s);
    allied.alliances = [{ id: 1, name: '하늘별 동맹', members: [0, 1], since: s.t }];
    expect(memberFlow(allied, 0, s.t).join).toBe(base);
    allied.companies[1].loyalty = newLoyalty(1, s.t);
    expect(memberFlow(allied, 0, s.t).join).toBeGreaterThan(base);
    // 높은 단계: 같은 손님에서 더 많은 회원이 목표
    const rep = fakeReport({ eastasia: 100000 });
    const step = (lv: LoyaltyLevel) => {
      const t = clone(s);
      t.companies[0].loyalty = newLoyalty(lv, s.t);
      let L = t.companies[0].loyalty;
      for (let k = 0; k < 60; k++) {
        t.companies[0].loyalty = L;
        L = stepMembers(t, 0, s.t, rep, regionFlights(t.companies[0]), null);
      }
      return L.members.eastasia;
    };
    const m1 = step(1);
    const m3 = step(3);
    expect(m3).toBeGreaterThan(m1 * 1.3);
    expect(m1).toBeLessThan(100000 * POOL_K * LOYALTY_LEVELS[1].cap);
  });

  it('정시 운항률·평판이 나쁘면 회원이 더 빨리 떠난다', () => {
    const s = humanGame();
    s.companies[0].loyalty = newLoyalty(1, s.t);
    const good = memberFlow(s, 0, s.t);
    const bad = clone(s);
    bad.companies[0].onTime = 0.62;
    bad.companies[0].reputation = 30;
    const worse = memberFlow(bad, 0, s.t);
    expect(worse.churn).toBeGreaterThan(good.churn + 0.05);
    expect(worse.why.filter((w) => !w.good).length).toBeGreaterThanOrEqual(2);
    // 회원이 다 모인 뒤에도 나쁜 회사는 회원이 줄어든다
    const rep = fakeReport({ eastasia: 50000 });
    const L0 = { ...newLoyalty(1, s.t), members: { ...emptyRegionMap(), eastasia: 27000 }, base: { ...emptyRegionMap(), eastasia: 50000 }, pen: { ...emptyRegionMap(), eastasia: 0.45 } };
    bad.companies[0].loyalty = L0;
    s.companies[0].loyalty = L0;
    const fl = regionFlights(s.companies[0]);
    expect(stepMembers(bad, 0, s.t, rep, fl, null).members.eastasia).toBeLessThan(stepMembers(s, 0, s.t, rep, fl, null).members.eastasia);
    expect(stepMembers(bad, 0, s.t, rep, fl, null).members.eastasia).toBeLessThan(27000);
  });

  it('그 지역 노선을 크게 줄이면 그 지역 회원만 빨리 떠나고, 동맹 회사가 그 지역을 날면 덜 떠난다', () => {
    const s = humanGame();
    const c = s.companies[0];
    const fl = regionFlights(c);
    expect(fl.europe).toBe(7);
    const L0: LoyaltyState = {
      ...newLoyalty(1, s.t),
      members: { ...emptyRegionMap(), eastasia: 20000, europe: 8000 },
      base: { ...emptyRegionMap(), eastasia: 40000, europe: 15000 },
      reach: { ...fl },
      pen: { ...emptyRegionMap(), eastasia: 0.42, europe: 0.44 },
    };
    c.loyalty = L0;
    const rep = fakeReport({ eastasia: 40000, europe: 15000 });
    const keep = stepMembers(s, 0, s.t, rep, fl, null);
    // 유럽 노선을 닫았다 (런던 비행기를 쉬게)
    const cut = { ...fl, europe: 0 };
    const after = stepMembers(s, 0, s.t, fakeReport({ eastasia: 40000, europe: 0 }), cut, null);
    expect(after.members.europe).toBeLessThan(keep.members.europe * 0.92);
    expect(after.members.eastasia).toBe(keep.members.eastasia);
    // 동맹 회사가 유럽을 난다: 덜 떠난다
    const ally = stepMembers(s, 0, s.t, fakeReport({ eastasia: 40000, europe: 0 }), cut, { ...emptyRegionMap(), europe: 20 });
    expect(ally.members.europe).toBeGreaterThan(after.members.europe);
    expect(ally.members.europe).toBeLessThan(keep.members.europe);
  });

  it('사업 모델이 저가항공으로 바뀌면 기본 단계로, 화물 전문이면 프로그램·브랜드가 없어진다', () => {
    let s = humanGame();
    s.companies[0].loyalty = newLoyalty(3, s.t);
    s.companies[0].brandPos = newBrand('service', s.t);
    s.companies[0].bizModel = 'lcc';
    s = passMonth(s);
    expect(s.companies[0].loyalty!.level).toBe(1);
    expect(s.companies[0].brandPos!.pos).toBe('service');
    s.companies[0].bizModel = 'cargo';
    s = passMonth(s);
    expect(s.companies[0].loyalty).toBeUndefined();
    expect(s.companies[0].brandPos).toBeUndefined();
  });

  it('분기 끝에는 사람 회사 진행 기록에 회원·브랜드 한 줄이 남는다', () => {
    let s = act(humanGame(), { type: 'setLoyalty', level: 1 }, { type: 'setBrandPos', pos: 'ontime' });
    for (let k = 0; k < 3; k++) s = passMonth(s);
    expect(s.log.some((l) => l.text.includes('단골 손님') && l.text.includes('브랜드 힘'))).toBe(true);
  });

  it('인수된 회사의 회원 절반은 프로그램이 있는 인수 회사로 넘어간다', () => {
    let s = humanGame(1983, ['human', 'ai-normal']);
    s.companies[0].loyalty = { ...newLoyalty(1, s.t), members: { ...emptyRegionMap(), eastasia: 1000 } };
    s.companies[1].loyalty = { ...newLoyalty(1, s.t), members: { ...emptyRegionMap(), eastasia: 4000, europe: 2000 } };
    s.companies[1].brandPos = newBrand('network', s.t);
    s.companies[1].out = true;
    s.companies[1].mergedInto = 0;
    s.companies[1].routes = [];
    s.companies[1].planes = [];
    s = passMonth(s);
    expect(s.companies[1].loyalty).toBeUndefined();
    expect(s.companies[1].brandPos).toBeUndefined();
    // 넘겨받은 2000 + 1000에서 한 달 움직임 (조금 늘거나 줄어도 넘겨받은 만큼은 보인다)
    expect(s.companies[0].loyalty!.members.eastasia).toBeGreaterThan(2500);
    expect(s.companies[0].loyalty!.members.europe).toBeGreaterThan(800);
  });
});

describe('손님 끌기 (시장 나누기)', () => {
  it('프로그램·브랜드가 없으면 그대로이고, 있으면 같은 객체에 곱하며 한도 안이다', () => {
    const s = humanGame();
    const c = s.companies[0];
    const q = { biz: 1.3, leisure: 0.9 };
    expect(loyaltyQuality(q, c, 'seoul', 'tokyo', 20)).toBe(q);
    expect(q).toEqual({ biz: 1.3, leisure: 0.9 });
    c.loyalty = { ...newLoyalty(3, s.t), pen: { ...emptyRegionMap(1) } };
    c.brandPos = { ...newBrand('service', s.t), strength: 100 };
    const max = LOYALTY_LEVELS[3];
    const e = BRAND_EFFECT.service;
    const p0 = pullAt(c, 'seoul', 'tokyo', 0);
    expect(p0.biz).toBeCloseTo((1 + max.biz) * (1 + e.biz), 9);
    expect(p0.leisure).toBeCloseTo((1 + max.leisure) * (1 + e.leisure), 9);
    // 가장 큰 경우(회원 몫 100%·브랜드 힘 100)에도 사업 +25%·관광 +13% 안, 실제로 닿는 최대 몫(골드 72%)이면 사업 +19% 안
    for (const pos of ['ontime', 'service', 'value', 'network'] as const) {
      c.brandPos = { ...newBrand(pos, s.t), strength: 100 };
      const p = pullAt(c, 'seoul', 'tokyo', 0);
      expect(p.biz).toBeLessThan(1.25);
      expect(p.leisure).toBeLessThan(1.13);
      const real = pullAt({ ...c, loyalty: { ...c.loyalty!, pen: emptyRegionMap(max.cap) } }, 'seoul', 'tokyo', 0);
      expect(real.biz).toBeLessThan(1.19);
    }
  });

  it('회원은 비싸도 덜 떠나고 싸게 팔아도 덜 몰린다 (가격에 덜 민감)', () => {
    const s = humanGame();
    const c = s.companies[0];
    c.loyalty = { ...newLoyalty(2, s.t), pen: { ...emptyRegionMap(0.6) } };
    const at0 = pullAt(c, 'seoul', 'tokyo', 0);
    const hi = pullAt(c, 'seoul', 'tokyo', 20);
    const lo = pullAt(c, 'seoul', 'tokyo', -20);
    expect(hi.biz).toBeGreaterThan(at0.biz);
    expect(lo.biz).toBeLessThan(at0.biz);
    expect(hi.leisure).toBeGreaterThan(at0.leisure);
    // 운임 +20%에 회원 덕분에 덜 떠나는 정도는 몇 %
    expect(hi.biz / at0.biz).toBeLessThan(1.04);
  });

  it('지역마다 회원 몫이 다르면 두 도시의 지역 평균을 쓴다', () => {
    const s = humanGame();
    const c = s.companies[0];
    c.loyalty = { ...newLoyalty(1, s.t), pen: { ...emptyRegionMap(), eastasia: 0.4, europe: 0 } };
    const inAsia = pullAt(c, 'seoul', 'tokyo').biz - 1;
    const toEurope = pullAt(c, 'seoul', 'london').biz - 1;
    const inEurope = pullAt(c, 'london', 'paris').biz - 1;
    expect(inAsia).toBeCloseTo(LOYALTY_LEVELS[1].biz * 0.4, 9);
    expect(toEurope).toBeCloseTo(LOYALTY_LEVELS[1].biz * 0.2, 9);
    expect(inEurope).toBe(0);
  });

  it('같은 두 도시에서 회원이 많은 회사가 손님을 조금 더 가져가지만, 몇 %일 뿐이다', () => {
    const s = humanGame(1983, ['human', 'human']);
    const offer = (company: number): Offer => ({ company, fare: 0, planes: [{ model: MODEL['a300-600'], freq: 7, age: 2 }] });
    // 두 회사를 똑같이 (본사·평판·광고)
    s.companies[1] = { ...s.companies[1], hub: s.companies[0].hub, reputation: s.companies[0].reputation, awareness: { ...s.companies[0].awareness }, morale: s.companies[0].morale };
    const plain = splitMarket(s, 'seoul', 'tokyo', [offer(0), offer(1)]);
    expect(plain[0].biz).toBeCloseTo(plain[1].biz, 6);
    s.companies[0].loyalty = { ...newLoyalty(1, s.t), pen: { ...emptyRegionMap(LOYALTY_LEVELS[1].cap) } };
    const res = splitMarket(s, 'seoul', 'tokyo', [offer(0), offer(1)]);
    expect(res[0].biz).toBeGreaterThan(res[1].biz);
    expect(res[0].biz / res[1].biz).toBeLessThan(1.06);
    expect(res[0].leisure / res[1].leisure).toBeLessThan(1.03);
    // 두 회사 합은 거의 그대로 (손님을 새로 만들기보다 나눠 가진다)
    expect(res[0].biz + res[1].biz).toBeLessThan((plain[0].biz + plain[1].biz) * 1.02);
  });
});

describe('동맹과 함께 (겹쳐 세지 않기)', () => {
  it('동맹에 들어도 우리 회원의 손님 끌기는 그대로다 (동맹 마일리지는 시장 나누기에서 따로 한 번만)', () => {
    const s = humanGame(1983, ['human', 'ai-normal']);
    s.companies[0].loyalty = { ...newLoyalty(2, s.t), pen: { ...emptyRegionMap(0.5) } };
    s.companies[1].loyalty = { ...newLoyalty(2, s.t), pen: { ...emptyRegionMap(0.5) } };
    const solo = pullAt(s.companies[0], 'seoul', 'tokyo');
    const allied = clone(s);
    allied.alliances = [{ id: 1, name: '하늘별 동맹', members: [0, 1], since: s.t }];
    expect(pullAt(allied.companies[0], 'seoul', 'tokyo')).toEqual(solo);
    // 시장 나누기: 동맹이 더하는 손님은 프로그램이 있든 없든 같은 배수다
    const offer: Offer = { company: 0, fare: 0, planes: [{ model: MODEL['a300-600'], freq: 7, age: 2 }] };
    const withProg = (st: AirlineState) => splitMarket(st, 'seoul', 'tokyo', [offer])[0].biz;
    const noProg = (st: AirlineState) => {
      const x = clone(st);
      x.companies[0].loyalty = undefined;
      return splitMarket(x, 'seoul', 'tokyo', [offer])[0].biz;
    };
    const gainSolo = withProg(s) / noProg(s);
    const gainAllied = withProg(allied) / noProg(allied);
    expect(Math.abs(gainSolo - gainAllied)).toBeLessThan(0.01);
  });
});

describe('브랜드 자리', () => {
  it('어울림은 실제 숫자로 잰다: 정시율·기내식·운임·노선망', () => {
    const s = humanGame();
    const c = s.companies[0];
    const st = brandStats(c, s.t, null, false);
    const late = fitOf({ ...st, onTime: 0.7 }, 'ontime');
    const punctual = fitOf({ ...st, onTime: 0.93, maint: 4 }, 'ontime');
    expect(punctual.fit).toBeGreaterThan(0.5);
    expect(late.fit).toBeLessThan(0);
    expect(late.reasons[0].v).toBeLessThan(0);
    expect(late.reasons[0].text).toContain('정시 운항률');
    expect(fitOf({ ...st, meal: 5, reputation: 85, pitch: 2 }, 'service').fit).toBeGreaterThan(fitOf({ ...st, meal: 1, reputation: 35, pitch: 0 }, 'service').fit + 0.8);
    expect(fitOf({ ...st, fare: -10 }, 'value').fit).toBeGreaterThan(fitOf({ ...st, fare: 25 }, 'value').fit);
    expect(fitOf({ ...st, regions: 6, routes: 30, xfer: 0.1 }, 'network').fit).toBeGreaterThan(0.8);
    expect(fitOf({ ...st, regions: 1, routes: 2 }, 'network').fit).toBeLessThan(0);
    // 저가항공은 알뜰한 운임이 저절로 잘 어울리고, 따뜻한 서비스와는 어긋난다
    const lcc = { ...st, lcc: true, pitch: 0, meal: 1, fare: 20 };
    expect(fitOf(lcc, 'value').fit).toBeGreaterThan(0.2);
    expect(fitOf(lcc, 'service').fit).toBeLessThan(0);
    expect(bestPosition(allFits({ ...c, bizModel: 'lcc' }, s.t, null, false), { bizModel: 'lcc' })).toBe('value');
    // 손님 비행기가 없으면 0
    expect(fitOf({ ...st, planes: 0 }, 'ontime').fit).toBe(0);
  });

  it('어울리면 브랜드 힘이 천천히 쌓이고, 어긋나면 더 빨리 깎인다', () => {
    const s = humanGame();
    const c = s.companies[0];
    c.onTime = 0.93;
    c.maint = 4;
    let b = newBrand('ontime', s.t);
    for (let k = 0; k < 12; k++) b = stepBrand(b, c, s.t + k, null, false);
    expect(b.strength).toBeGreaterThan(15);
    expect(b.strength).toBeLessThan(b.fit * 100);
    expect(b.hist.length).toBe(12);
    const up = b.strength;
    // 정시율이 무너졌다
    c.onTime = 0.66;
    c.maint = 2;
    let d = b;
    for (let k = 0; k < 6; k++) d = stepBrand(d, c, s.t + 12 + k, null, false);
    expect(d.fit).toBeLessThan(0);
    expect(up - d.strength).toBeGreaterThan(up * 0.45);
    // 광고로 잘 알려지면 더 빨리 쌓인다
    c.onTime = 0.93;
    c.maint = 4;
    const known = { ...c, awareness: { ...c.awareness, eastasia: 1, europe: 1 } };
    const unknown = { ...c, awareness: { ...c.awareness, eastasia: 0, europe: 0 } };
    expect(stepBrand(newBrand('ontime', s.t), known, s.t, null, false).strength).toBeGreaterThan(stepBrand(newBrand('ontime', s.t), unknown, s.t, null, false).strength);
  });

  it('처음 정하기는 공짜·바로, 바꾸기는 돈과 석 달, 힘은 35%만 남고, 한 해에 한 번', () => {
    let s = humanGame();
    const cash0 = s.companies[0].cash;
    s = act(s, { type: 'setBrandPos', pos: 'service' });
    expect(s.companies[0].brandPos?.pos).toBe('service');
    expect(s.companies[0].cash).toBe(cash0);
    expect(brandBlocker(s, 0, 'service')).toBe('지금 브랜드예요');
    expect(brandBlocker(s, 0, 'ontime')).toContain(`${BRAND_COOLDOWN}달 뒤`);
    // 한 해 지났다고 치고
    s.companies[0].brandPos = { ...s.companies[0].brandPos!, since: s.t - BRAND_COOLDOWN, strength: 60 };
    expect(brandBlocker(s, 0, 'ontime')).toBeNull();
    const cost = brandChangeCost(s.companies[0]);
    s = act(s, { type: 'setBrandPos', pos: 'ontime' });
    expect(s.companies[0].cash).toBe(cash0 - cost);
    expect(s.companies[0].brandPos!.next).toEqual({ pos: 'ontime', t: s.t + BRAND_CHANGE_MONTHS });
    expect(brandBlocker(s, 0, 'value')).toContain('바꾸는 중');
    // 바꾸기 그만두기 (지금 자리를 고르면)
    const back = act(s, { type: 'setBrandPos', pos: 'service' });
    expect(back.companies[0].brandPos!.next).toBeNull();
    // 석 달 뒤에 바뀌고 힘은 35%
    let b = s.companies[0].brandPos!;
    const c = s.companies[0];
    for (let k = 1; k <= BRAND_CHANGE_MONTHS; k++) b = stepBrand(b, c, s.t + k, null, false);
    expect(b.pos).toBe('ontime');
    expect(b.since).toBe(s.t + BRAND_CHANGE_MONTHS);
    expect(b.strength).toBeLessThan(60 * BRAND_SWITCH_KEEP + 8);
    // 화물 전문은 손님 브랜드가 없다
    const cargo = clone(s);
    cargo.companies[0].bizModel = 'cargo';
    expect(brandBlocker(cargo, 0, 'value')).toContain('화물');
  });

  it('맞는 상을 받으면 1월에 브랜드 힘이 오른다', () => {
    const s = humanGame();
    const c = s.companies[0];
    const jan = 1991 * 12;
    const b = { ...newBrand('ontime', s.t), strength: 40 };
    const plain = stepBrand(b, c, jan, null, false, []);
    const won = stepBrand(b, c, jan, null, false, ['punctual']);
    expect(won.strength - plain.strength).toBeCloseTo(AWARD_BOOST, 1);
    expect(stepBrand(b, c, jan, null, false, ['service']).strength).toBe(plain.strength);
  });

  it('사람 회사는 브랜드 문턱을 넘으면 소식을 받고, 오르내림이 잦아도 같은 소식을 거듭 받지 않는다', () => {
    let s = humanGame();
    s.companies[0].onTime = 0.95;
    s.companies[0].maint = 5;
    s.companies[0].brandPos = { ...newBrand('ontime', s.t), strength: 29.5, since: s.t - 20 };
    s = passMonth(s);
    const b = s.companies[0].brandPos!;
    expect(b.strength).toBeGreaterThanOrEqual(30);
    const news = s.news.filter((n) => n.title.includes('떠오르는 회사'));
    expect(news.length).toBe(1);
    expect(b.told).toBe(1);
    // 30 근처에서 조금 내려가도 '흐려지고 있어요'는 25 아래에서만
    s.companies[0].brandPos = { ...b, strength: 29 };
    s.companies[0].onTime = 0.85;
    s = passMonth(s);
    expect(s.news.filter((n) => n.title.includes('흐려지고')).length).toBe(0);
  });
});

describe('저장', () => {
  it('예전 저장(새 값 없음)은 그대로 불러오고 프로그램 없이·브랜드 없이 놀며, 망가진 값은 버린다', () => {
    const s = humanGame();
    const old = clone(s);
    for (const c of old.companies) {
      delete (c as Partial<Company>).loyalty;
      delete (c as Partial<Company>).brandPos;
    }
    const back = parseSaved({ setup: setup(['human', 'ai-normal']), state: old, savedAt: 1 });
    expect(back).not.toBeNull();
    expect(back!.state.companies[0].loyalty).toBeUndefined();
    expect(back!.state.companies[0].brandPos).toBeUndefined();
    expect(pullAt(back!.state.companies[0], 'seoul', 'tokyo')).toEqual({ biz: 1, leisure: 1 });
    // 프로그램·브랜드가 있는 저장도 그대로
    let t = act(s, { type: 'setLoyalty', level: 1 }, { type: 'setBrandPos', pos: 'network' });
    t = passMonth(t);
    const round = parseSaved(clone({ setup: setup(['human', 'ai-normal']), state: t, savedAt: 1 }));
    expect(round).not.toBeNull();
    expect(round!.state.companies[0].loyalty).toEqual(t.companies[0].loyalty);
    expect(round!.state.companies[0].brandPos).toEqual(t.companies[0].brandPos);
    // 망가진 값
    const bad1 = clone(t);
    (bad1.companies[0].loyalty as unknown as { level: number }).level = 7;
    expect(isValidState(bad1)).toBe(false);
    const bad2 = clone(t);
    bad2.companies[0].loyalty!.pen.europe = 3;
    expect(isValidState(bad2)).toBe(false);
    const bad3 = clone(t);
    (bad3.companies[0].brandPos as unknown as { pos: string }).pos = 'luxury';
    expect(isValidState(bad3)).toBe(false);
    const bad4 = clone(t);
    bad4.companies[0].brandPos!.strength = 140;
    expect(isValidState(bad4)).toBe(false);
  });

  it('행동 판별', () => {
    expect(isLoyaltyAction({ type: 'setLoyalty' })).toBe(true);
    expect(isLoyaltyAction({ type: 'setBrandPos' })).toBe(true);
    expect(isLoyaltyAction({ type: 'setAds' })).toBe(false);
  });
});

describe('컴퓨터', () => {
  it('크기·겨루기·사업 모델에 맞게 단계를 고른다 (작으면 안 하고, 화물 전문은 안 하고, 골드는 아주 큰 회사만)', () => {
    const s = humanGame(1983, ['ai-normal', 'ai-easy']);
    s.qReport = { q: s.q - 1, t: s.t - 1, span: 3, companies: [fakeReport({ eastasia: 1000 }), fakeReport({ eastasia: 1000 })], routes: [], news: [], xfers: [], ops: [] };
    s.qReport.companies[0].profit = 100;
    s.qReport.companies[1].profit = 100;
    const c = s.companies[0];
    // 작은 회사 (비행기 셋)
    expect(wantedLevel(s, 0, true)).toBe(0);
    // 비행기 20대, 노선의 절반이 겨룬다
    const fleet = (n: number, share: number) => {
      const t = clone(s);
      const k = t.companies[0];
      const base = k.planes[0];
      k.planes = Array.from({ length: n }, (_, i) => ({ ...base, id: 9000 + i }));
      k.routes = k.routes.map((r, i) => ({ ...r, stats: { lf: 0.8, pax: 1000, revenue: 10, profit: 1, lossStreak: 0, share: i < Math.round(k.routes.length * share) ? 0.5 : 1, xfer: 0, xferRev: 0, onTime: 0.9, cancel: 0, hist: [] } }));
      return t;
    };
    expect(contestedShare(fleet(20, 0.34).companies[0])).toBeCloseTo(1 / 3, 6);
    expect(wantedLevel(fleet(20, 0.34), 0, true)).toBe(1);
    expect(wantedLevel(fleet(40, 0.34), 0, true)).toBe(2);
    expect(wantedLevel(fleet(40, 0.1), 0, true)).toBe(1);
    expect(wantedLevel(fleet(60, 1), 0, true)).toBe(2);
    const huge = fleet(100, 1);
    huge.companies[0].reputation = 70;
    expect(wantedLevel(huge, 0, true)).toBe(3);
    huge.companies[0].reputation = 40;
    expect(wantedLevel(huge, 0, true)).toBe(2);
    // 쉬움은 기본까지만
    expect(wantedLevel(huge, 0, false)).toBe(1);
    // 화물 전문·저가항공
    const cargo = fleet(60, 1);
    cargo.companies[0].bizModel = 'cargo';
    expect(wantedLevel(cargo, 0, true)).toBe(0);
    const lcc = fleet(60, 1);
    lcc.companies[0].bizModel = 'lcc';
    expect(wantedLevel(lcc, 0, true)).toBe(0);
    lcc.t = 1996 * 12;
    lcc.q = Math.floor(lcc.t / 3);
    expect(wantedLevel(lcc, 0, true)).toBe(1);
    // 적자 분기면 내린다, 위기면 그만둔다
    const loss = fleet(60, 1);
    loss.companies[0].loyalty = newLoyalty(2, s.t);
    loss.qReport!.companies[0].profit = -50;
    expect(wantedLevel(loss, 0, true)).toBe(1);
    loss.companies[0].crisis = 1;
    expect(wantedLevel(loss, 0, true)).toBe(0);
    expect(c.loyalty).toBeUndefined();
  });

  it('컴퓨터는 처음에 어울리는 브랜드를 고르고 (저가항공은 알뜰한 운임, 화물 전문은 없음), 정한 행동은 모두 규칙에 맞다', () => {
    const rng = seededRandom(12);
    let s = createGame(setup(['ai-normal', 'ai-normal', 'ai-normal', 'ai-easy'], { era: 2003 }, ['tokyo', 'london', 'hongkong', 'newyork'], ['full', 'lcc', 'cargo', null]), rng);
    for (let turn = 0; turn < 40; turn++) {
      const ci = actor(s);
      const level = s.companies[ci].kind === 'ai-easy' ? 'ai-easy' : 'ai-normal';
      const actions = planTurn(s, ci, level, seededRandom(300 + turn));
      let t = s;
      for (const a of actions) {
        const next = applyAction(t, a);
        expect(next, JSON.stringify(a)).not.toBe(t);
        t = next;
      }
      s = applyAction(t, { type: 'endTurn' }, rng);
    }
    const [full, lcc, cargo, easy] = s.companies;
    expect(full.brandPos).toBeDefined();
    expect(lcc.brandPos?.pos).toBe('value');
    expect(cargo.brandPos).toBeUndefined();
    expect(cargo.loyalty).toBeUndefined();
    expect(easy.brandPos).toBeDefined();
  });

  for (const [seed, era, kinds] of [
    [31, 1983, ['ai-normal', 'ai-easy']],
    [32, 2003, ['ai-normal', 'ai-normal']],
  ] as const) {
    it(`컴퓨터끼리 끝까지 (${era}년, 씨앗 ${seed}): 숫자가 터지지 않고, 큰 보통 회사는 프로그램을 쓰고, 저장이 올바르다`, () => {
      const rng = seededRandom(seed);
      let s = createGame(setup([...kinds], { era, years: 10, money: 'normal' }), rng);
      let turns = 0;
      let worst = 0;
      let starts = 0;
      while (s.phase !== 'gameover' && turns < 3000) {
        const t0 = performance.now();
        const before = s.companies.map((c) => c.loyalty?.level ?? 0);
        s = aiTurn(s, rng);
        worst = Math.max(worst, performance.now() - t0);
        s.companies.forEach((c, i) => {
          if ((c.loyalty?.level ?? 0) > before[i]) starts++;
        });
        turns++;
      }
      expect(s.phase).toBe('gameover');
      expect(isValidState(s)).toBe(true);
      for (let i = 0; i < s.companies.length; i++) {
        const c = s.companies[i];
        expect(Number.isFinite(companyValue(s, i))).toBe(true);
        if (c.loyalty) {
          for (const r of REGIONS) {
            expect(Number.isFinite(c.loyalty.members[r])).toBe(true);
            expect(c.loyalty.pen[r]).toBeLessThanOrEqual(1);
          }
          expect(c.loyalty.hist.length).toBeLessThanOrEqual(24);
        }
        if (c.brandPos) {
          expect(c.brandPos.strength).toBeGreaterThanOrEqual(0);
          expect(c.brandPos.strength).toBeLessThanOrEqual(100);
        }
      }
      // 컴퓨터는 판 동안 프로그램을 열거나 올린다 (작은 회사·골드만 하는 일은 없다)
      expect(starts).toBeGreaterThan(0);
      expect(s.companies.every((c) => c.kind !== 'ai-easy' || (c.loyalty?.level ?? 0) <= 1)).toBe(true);
      expect(s.companies.every((c) => c.brandPos)).toBe(true);
      expect(worst).toBeLessThan(600);
    }, 60000);
  }

  it('같은 씨앗이면 같은 결과 (단골·브랜드도 난수를 쓰지 않는다)', () => {
    const run = () => {
      const rng = seededRandom(5);
      let s = createGame(setup(['ai-normal', 'ai-normal'], { era: 1983, years: 10 }), rng);
      for (let k = 0; k < 4 * 12 * 2; k++) s = aiTurn(s, rng);
      return s;
    };
    const a = run();
    const b = run();
    expect(a.companies.map((c) => [c.loyalty, c.brandPos, Math.round(c.cash)])).toEqual(b.companies.map((c) => [c.loyalty, c.brandPos, Math.round(c.cash)]));
  }, 30000);
});

describe('빠르기', () => {
  it('손님 끌기 셈은 아주 가볍다 (삼십만 번에 0.4초 안)', () => {
    const s = humanGame();
    const c = s.companies[0];
    c.loyalty = { ...newLoyalty(2, s.t), pen: { ...emptyRegionMap(0.5) } };
    c.brandPos = { ...newBrand('ontime', s.t), strength: 50 };
    const cities = Object.keys(CITY);
    let sum = 0;
    const t0 = performance.now();
    for (let k = 0; k < 300_000; k++) {
      const q = loyaltyQuality({ biz: 1, leisure: 1 }, c, cities[k % 50], cities[(k * 7 + 3) % 50], (k % 7) * 5 - 15);
      sum += q.biz;
    }
    expect(performance.now() - t0).toBeLessThan(400);
    expect(sum).toBeGreaterThan(300_000);
  });
});
