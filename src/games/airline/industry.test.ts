import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { aiTurn, planTurn } from './ai';
import { defaultCabin } from './cabin';
import { MODEL } from './aircraft';
import {
  ENTRY_GRACE,
  FATE,
  FATE_LEAD,
  MAX_ACTIVE,
  MAX_COMPANIES,
  admitEntrant,
  aliveCount,
  enterMarket,
  entryChance,
  failCompany,
  fateT,
  foundersAt,
  historyMonth,
  industryMonth,
  isYoung,
  type EntrantPlan,
} from './industry';
import { personaOf } from './personality';
import { emptyRightsBook } from './rights';
import { emptyStakes } from './stocks';
import { applyAction, createGame, industryHooks, runMonth } from './rules';
import { WEEK_HOURS, emptyReport, planeHours } from './simulate';
import { isValidState, parseSaved } from './storage';
import { mOf, qOfM } from './time';
import type { AirlineOptions, AirlineSetup, AirlineState, Company, QuarterReport, SeatKind } from './types';

function setup(kinds: SeatKind[], options: Partial<AirlineOptions> = {}, airlines: (string | null)[] = []): AirlineSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as AirlineSetup['seats'],
    options: { era: 1983, mode: 'years', years: 30, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'normal', names: 'real', ...options },
    hubs: [null, null, null, null],
    airlines: [0, 1, 2, 3].map((i) => airlines[i] ?? null),
    // 컴퓨터가 저절로 저가항공·화물 전문(지어낸 이름)이 되지 않게 모두 풀서비스로
    models: [0, 1, 2, 3].map((i) => (kinds[i] && kinds[i] !== 'empty' ? 'full' : null)),
  };
}

/** 시계를 옮긴다 (결산 기록은 그대로) */
const at = (s: AirlineState, t: number): AirlineState => ({ ...s, t, q: qOfM(t) });
const idx = (s: AirlineState, id: string) => s.companies.findIndex((c) => c.airline === id);
const patch = (s: AirlineState, ci: number, p: Partial<AirlineState['companies'][number]>): AirlineState => ({ ...s, companies: s.companies.map((c, i) => (i === ci ? { ...c, ...p } : c)) });

/** 지난 열두 달을 회사 ci의 이익으로 채운다 (튼튼한지 볼 때) */
function withLedger(s: AirlineState, ci: number, profit: number): AirlineState {
  const ledger: QuarterReport[] = Array.from({ length: 12 }, (_, k) => {
    const t = s.t - 12 + k;
    return { q: qOfM(t), t, span: 1, companies: s.companies.map((_, i) => ({ ...emptyReport(), ...(i === ci ? { profit, ticket: 1000 } : {}) })), routes: [], news: [], xfers: [], ops: [] };
  });
  return { ...s, ledger };
}

/** 비행기 몇 대를 쥐여 준다 (인수 제안은 비행기가 있는 회사만) */
function withPlanes(s: AirlineState, ci: number, n: number): AirlineState {
  let next = s.nextId;
  const planes = Array.from({ length: n }, () => ({ id: next++, model: 'b737-300', leased: false, rent: 0, deposit: 0, since: s.t - 24, legs: [], cabin: defaultCabin(MODEL['b737-300']), meal: 3 }));
  return { ...patch(s, ci, { planes: [...s.companies[ci].planes, ...planes] }), nextId: next };
}

const plan = (over: Partial<EntrantPlan> = {}): EntrantPlan => ({ name: '새벽항공', airline: null, hub: 'paris', model: 'lcc', cash: 1200, why: 'boom', ...over });

describe('판 가운데 회사 더하기', () => {
  it('주식·운수권·라이벌 장부·그래프·결산의 회사 칸이 모두 늘고, 기존 성격은 그대로, 저장이 올바르다', () => {
    const rng = seededRandom(1);
    let s = createGame(setup(['human', 'ai-normal', 'ai-normal'], { rights: 'real', names: 'fictional' }), rng);
    s = runMonth(runMonth(s, rng), rng);
    // 운수권 장부·주식 표는 처음 쓸 때 생긴다: 미리 만들어 두고 늘어나는지 본다
    s = { ...s, rights: emptyRightsBook(s.companies.length), stakes: emptyStakes(s.companies.length) };
    const personas = s.companies.map((_, i) => personaOf(s, i));
    const s2 = admitEntrant(s, plan(), industryHooks(s));
    const n = s.companies.length + 1;
    expect(s2.companies.length).toBe(n);
    const c = s2.companies[n - 1];
    expect(c.born).toBe(s.t);
    expect(c.bizModel).toBe('lcc');
    expect(c.kind).toBe('ai-normal');
    expect(c.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(c.goals.length).toBeGreaterThan(0);
    expect(s2.order).toContain(n - 1);
    for (const h of s2.history) expect(h.value.length).toBe(n);
    for (const m of s2.months) expect([m.value, m.profit, m.revenue, m.pax, m.lf, m.onTime, m.staff].every((a) => a.length === n)).toBe(true);
    for (const l of s2.ledger) expect(l.companies.length).toBe(n);
    expect(s2.report!.companies.length).toBe(n);
    expect(s2.rights!.held.length).toBe(n);
    expect(s2.rights!.apps.length).toBe(n);
    expect(s2.stakes!.length).toBe(n);
    expect(s2.stakes!.every((row) => row.length === n)).toBe(true);
    expect(s2.rivals!.persona.length).toBe(n);
    expect(s2.rivals!.rel.every((row) => row.length === n)).toBe(true);
    // 기존 회사 성격은 흔들리지 않고, 새 회사는 지금 날고 있는 컴퓨터와 다른 성격
    expect(s2.companies.slice(0, n - 1).map((_, i) => personaOf(s2, i))).toEqual(personas);
    expect(personas).not.toContain(personaOf(s2, n - 1));
    expect(s2.industry!.at(-1)!.kind).toBe('enter');
    expect(s2.news.at(-1)!.title).toContain('새벽항공');
    expect(isValidState(JSON.parse(JSON.stringify(s2)))).toBe(true);
    // 새 회사와 함께 한 달을 더 셈해도 칸이 맞는다
    const s3 = runMonth(s2, rng);
    expect(s3.report!.companies.length).toBe(n);
    expect(isValidState(JSON.parse(JSON.stringify(s3)))).toBe(true);
    const saved = parseSaved(JSON.parse(JSON.stringify({ setup: setup(['human', 'ai-normal', 'ai-normal']), state: s3, savedAt: 1 })));
    expect(saved!.state.companies.length).toBe(n);
  });

  it('저장은 회사 열두 곳까지', () => {
    let s = createGame(setup(['human', 'ai-normal'], { names: 'fictional' }), seededRandom(2));
    const hubs = ['paris', 'london', 'tokyo', 'seoul', 'sydney', 'cairo', 'rio', 'toronto', 'dubai', 'madrid', 'rome'];
    for (let k = 0; s.companies.length < MAX_COMPANIES; k++) {
      s = admitEntrant(s, plan({ name: `시험${k}항공`, hub: hubs[k], model: 'full' }), industryHooks(s));
      // 동시에 날 수 있는 수를 넘지 않게 앞 회사를 하나씩 내보낸다
      if (aliveCount(s) >= MAX_ACTIVE) s = industryHooks(s).shutDown(s, s.companies.findIndex((c, i) => i > 0 && !c.out), s.t);
    }
    expect(isValidState(JSON.parse(JSON.stringify(s)))).toBe(true);
    const over = JSON.parse(JSON.stringify(s));
    over.companies.push(over.companies[1]);
    expect(isValidState(over)).toBe(false);
  });
});

describe('새 회사', () => {
  it('실제 역사: 그 해에 생긴 실제 항공사가 들어오고, 이미 들어온 회사는 다시 생기지 않는다', () => {
    const s = createGame(setup(['human', 'ai-normal', 'ai-normal', 'ai-normal']), seededRandom(3));
    const t = mOf(1985, 10);
    expect(foundersAt(at(s, t), t).map((a) => a.id)).toContain('emirates');
    const s2 = enterMarket(at(s, t), industryHooks(s));
    const c = s2.companies.at(-1)!;
    expect(c.airline).toBe('emirates');
    expect(c.hub).toBe('dubai');
    expect(s2.news.some((x) => x.title.includes('에미레이트항공'))).toBe(true);
    expect(foundersAt(s2, t).map((a) => a.id)).not.toContain('emirates');
  });

  it('하늘이 꽉 차면 들어오지 못하고 세계 소식만 나온다', () => {
    let s = createGame(setup(['human', 'ai-normal', 'ai-normal', 'ai-normal']), seededRandom(4));
    s = admitEntrant(s, plan({ name: '새벽항공', hub: 'rome' }), industryHooks(s));
    s = admitEntrant(s, plan({ name: '은하수항공', hub: 'madrid' }), industryHooks(s));
    expect(aliveCount(s)).toBe(MAX_ACTIVE);
    const t = mOf(1985, 10);
    const s2 = enterMarket(at(s, t), industryHooks(s));
    expect(s2.companies.length).toBe(s.companies.length);
    expect(s2.news.at(-1)!.title).toContain('세계 소식');
    expect(s2.industry!.at(-1)!.kind).toBe('world');
  });

  it('앞 회사가 날고 있으면 뒤를 이은 회사는 들어오지 않는다 (스위스에어 → 스위스국제항공)', () => {
    const s = createGame(setup(['human', 'ai-normal'], {}, [null, 'swissair']), seededRandom(5));
    const t = mOf(2002, 4);
    expect(foundersAt(at(s, t), t).map((a) => a.id)).not.toContain('swiss');
    const gone = industryHooks(s).shutDown(s, idx(s, 'swissair'), s.t);
    expect(foundersAt(at(gone, t), t).map((a) => a.id)).toContain('swiss');
  });

  it('시작 두 해 동안은 생기지 않고, 빈자리가 생기면 더 잘 생기며, 시장 변화를 끄면 생기지 않는다', () => {
    const s = createGame(setup(['human', 'ai-normal', 'ai-normal', 'ai-normal'], { names: 'fictional' }), seededRandom(6));
    expect(entryChance(s, s.startT + ENTRY_GRACE - 1).p).toBe(0);
    const later = at(s, s.startT + ENTRY_GRACE + 6);
    const boom = entryChance(later, later.t).p;
    expect(boom).toBeGreaterThan(0);
    expect(boom).toBeLessThan(0.03);
    // 한 회사가 문을 닫은 지 여섯 달이 지나면
    const gone = industryHooks(later).shutDown(at(later, later.t - 8), 2, later.t - 8);
    expect(entryChance(at(gone, later.t), later.t).p).toBeGreaterThanOrEqual(0.06);
    const off = { ...later, options: { ...later.options, industry: false } };
    expect(entryChance(off, off.t).p).toBe(0);
    expect(foundersAt(at(off, mOf(1985, 10)), mOf(1985, 10))).toEqual([]);
    expect(enterMarket(at(off, mOf(1985, 10)), industryHooks(off)).companies.length).toBe(s.companies.length);
  });
});

describe('실제 항공사의 역사', () => {
  it('위기는 그 해 18달 전부터: 손님이 줄고 비용이 는다 (먹구름 소식)', () => {
    const s = createGame(setup(['human', 'ai-normal'], {}, [null, 'panam']), seededRandom(7));
    const pi = idx(s, 'panam');
    const ft = fateT(FATE.panam);
    const early = historyMonth(at(s, ft - FATE_LEAD - 1), ft - FATE_LEAD - 1, industryHooks(s));
    expect(early.companies[pi].mods.length).toBe(0);
    const start = historyMonth(at(s, ft - FATE_LEAD), ft - FATE_LEAD, industryHooks(s));
    const mods = start.companies[pi].mods;
    expect(mods.find((m) => m.kind === 'demand')!.value).toBeLessThan(1);
    expect(mods.find((m) => m.kind === 'crew')!.value).toBeGreaterThan(1);
    expect(mods.every((m) => m.until === ft + 1)).toBe(true);
    expect(start.news.at(-1)!.title).toContain('먹구름');
    // 같은 위기는 한 번만 알린다
    const again = historyMonth(at(start, ft - 3), ft - 3, industryHooks(s));
    expect(again.companies[pi].mods.length).toBe(mods.length);
  });

  it('그 달에 약하면 역사대로 문을 닫고, 튼튼하면 살아남는다', () => {
    const s = createGame(setup(['human', 'ai-normal'], {}, [null, 'panam']), seededRandom(8));
    const pi = idx(s, 'panam');
    const ft = fateT(FATE.panam);
    const weak = historyMonth(patch(at(s, ft), pi, { cash: -200 }), ft, industryHooks(s));
    expect(weak.companies[pi].out).toBe(true);
    expect(weak.companies[pi].fate).toBe('1991년 문을 닫음');
    expect(weak.industry!.at(-1)!.kind).toBe('cease');
    const strong = historyMonth(withLedger(patch(at(s, ft), pi, { cash: 5000 }), pi, 120), ft, industryHooks(s));
    expect(strong.companies[pi].out).toBe(false);
    expect(strong.news.at(-1)!.title).toContain('위기를 넘겼어요');
    expect(strong.industry!.at(-1)!.kind).toBe('survive');
  });

  it('사람이 고른 회사는 역사에 끌려가지 않는다 (소식만)', () => {
    const s = createGame(setup(['human', 'ai-normal'], {}, ['panam']), seededRandom(9));
    const ft = fateT(FATE.panam);
    const s2 = historyMonth(patch(at(s, ft), 0, { cash: -200 }), ft, industryHooks(s));
    expect(s2.companies[0].out).toBe(false);
    expect(s2.companies[0].mods.length).toBe(0);
    expect(s2.news.at(-1)!.title).toContain('실제 역사 속');
  });

  it('이름 바꾸기: BOAC는 1974년 영국항공이 되고, 성격은 그대로', () => {
    const s = createGame(setup(['human', 'ai-normal'], { era: 1963 }, [null, 'boac']), seededRandom(10));
    const bi = idx(s, 'boac');
    const before = personaOf(s, bi);
    const ft = fateT(FATE.boac);
    const s2 = historyMonth(at(s, ft), ft, industryHooks(s));
    expect(s2.companies[bi].name).toBe('영국항공');
    expect(s2.companies[bi].airline).toBe('britishairways');
    expect(s2.companies[bi].out).toBe(false);
    expect(personaOf(s2, bi)).toBe(before);
    expect(s2.industry!.at(-1)!.kind).toBe('rename');
  });

  it('합병: 합칠 회사가 컴퓨터면 그 회사로 (TWA → 아메리칸항공)', () => {
    const s = createGame(setup(['human', 'ai-normal', 'ai-normal'], {}, [null, 'twa', 'american']), seededRandom(11));
    const ti = idx(s, 'twa');
    const ai = idx(s, 'american');
    const ft = fateT(FATE.twa);
    const s2 = historyMonth(withPlanes(patch(at(s, ft), ti, { cash: -100 }), ti, 3), ft, industryHooks(s));
    expect(s2.companies[ti].out).toBe(true);
    expect(s2.companies[ti].mergedInto).toBe(ai);
    expect(s2.companies[ai].planes.length).toBe(3);
    expect(s2.news.some((x) => x.text.includes('실제 역사처럼'))).toBe(true);
  });

  it('합병: 합칠 회사가 사람이면 인수 제안 — 사면 합치고, 안 사면 문을 닫는다', () => {
    const base = createGame(setup(['human', 'ai-normal'], {}, ['american', 'twa']), seededRandom(12));
    const ti = idx(base, 'twa');
    const ft = fateT(FATE.twa);
    let s = withPlanes(patch(patch(at(base, ft), ti, { cash: -100 }), 0, { cash: 50000 }), ti, 2);
    s = industryMonth(s, ft, [], industryHooks(s));
    expect(s.companies[ti].out).toBe(false);
    expect(s.companies[ti].sale).toMatchObject({ buyer: 0, why: 'history' });
    expect(s.companies[0].choice!.scenario).toBe('acquire');
    // 사람 차례에 고른다
    const turn = { ...at(s, ft + 1), order: [0, ti], turnPos: 0 };
    const bought = applyAction(turn, { type: 'choose', option: 0 });
    expect(bought.companies[ti].mergedInto).toBe(0);
    expect(bought.companies[0].planes.length).toBe(2);
    const passed = applyAction(turn, { type: 'choose', option: 1 });
    expect(passed.companies[ti].out).toBe(false);
    const closed = industryMonth(passed, ft + 1, [], industryHooks(passed));
    expect(closed.companies[ti].out).toBe(true);
    expect(closed.companies[ti].mergedInto).toBeUndefined();
  });

  it('합칠 회사가 판에 없으면 판 밖 회사에 합쳐져 빠진다 (하와이안항공 → 알래스카항공)', () => {
    const s = createGame(setup(['human', 'ai-normal'], { era: 2003 }, [null, 'hawaiian']), seededRandom(13));
    const hi = idx(s, 'hawaiian');
    const ft = fateT(FATE.hawaiian);
    const s2 = historyMonth(patch(at(s, ft), hi, { cash: -100 }), ft, industryHooks(s));
    expect(s2.companies[hi].out).toBe(true);
    expect(s2.companies[hi].fate).toBe('알래스카항공에 합쳐짐');
  });

  it('실제 항공사 이름이나 실제 역사를 끄면 역사를 따르지 않는다', () => {
    for (const opt of [{ history: false }, { industry: false }] as const) {
      const s = createGame(setup(['human', 'ai-normal'], opt, [null, 'panam']), seededRandom(14));
      const pi = idx(s, 'panam');
      const ft = fateT(FATE.panam);
      const s2 = historyMonth(patch(at(s, ft), pi, { cash: -200 }), ft, industryHooks(s));
      expect(s2.companies[pi].out).toBe(false);
    }
  });
});

describe('돈이 바닥난 회사', () => {
  it('컴퓨터: 처음에는 법정 관리로 빚을 줄여 다시 날고, 두 번째는 문을 닫는다 (사 줄 회사가 없으면)', () => {
    let s = createGame(setup(['ai-normal', 'ai-normal'], { names: 'fictional' }), seededRandom(15));
    s = withPlanes(patch(s, 1, { cash: -300, debt: 2000, crisis: 4 }), 1, 3);
    s = patch(s, 0, { cash: 0 });
    const p = failCompany(s, 1, s.t, industryHooks(s));
    const c = p.companies[1];
    expect(c.out).toBe(false);
    expect(c.rescued).toBe(s.t);
    expect(c.crisis).toBe(0);
    expect(c.cash).toBeGreaterThan(0);
    expect(c.debt).toBeLessThan(2000 * 0.5);
    expect(c.planes.length).toBe(0); // 쉬던 비행기는 정리했다
    expect(c.mods.some((m) => m.label.includes('법정 관리'))).toBe(true);
    expect(p.news.at(-1)!.title).toContain('법정 관리');
    const again = failCompany(patch(p, 1, { cash: -300, crisis: 4 }), 1, s.t + 20, industryHooks(p));
    expect(again.companies[1].out).toBe(true);
  });

  it('컴퓨터: 돈이 넉넉한 다른 컴퓨터가 싸게 사들이기도 한다', () => {
    let s = createGame(setup(['ai-normal', 'ai-normal'], { names: 'fictional', aiStyle: 'fierce' }), seededRandom(16));
    s = withPlanes(patch(s, 1, { cash: -100, crisis: 4 }), 1, 4);
    s = patch(s, 0, { cash: 50000 });
    let rescued = 0;
    for (let k = 0; k < 6; k++) {
      const r = failCompany(at(s, s.t + k), 1, s.t + k, industryHooks(s));
      if (r.companies[1].mergedInto === 0) {
        rescued++;
        expect(r.companies[0].planes.length).toBe(4);
        expect(r.news.some((x) => x.text.includes('문을 닫기 직전'))).toBe(true);
      } else expect(r.companies[1].rescued).toBeDefined();
    }
    expect(rescued).toBeGreaterThan(0);
  });

  it('사람 회사가 넉넉하면 인수 제안: 안 사면 다음 결산에 법정 관리나 다른 길로', () => {
    let s = createGame(setup(['human', 'ai-normal'], { names: 'fictional' }), seededRandom(17));
    s = withPlanes(patch(patch(s, 1, { cash: -100, crisis: 4 }), 0, { cash: 50000 }), 1, 2);
    let offered: AirlineState | null = null;
    for (let k = 0; k < 8 && !offered; k++) {
      const r = failCompany(at(s, s.t + k), 1, s.t + k, industryHooks(s));
      if (r.companies[1].sale) offered = r;
    }
    expect(offered).not.toBeNull();
    const o = offered!;
    expect(o.companies[0].choice!.title).toContain('인수 제안');
    expect(o.companies[1].sale!.why).toBe('distress');
    // 기다리는 동안에는 문을 닫지 않는다
    expect(failCompany(o, 1, o.t, industryHooks(o)).companies[1].out).toBe(false);
    // 사람이 사지 않으면: 다음 결산에서 다시 제안하지 않고 법정 관리로
    const declined = { ...o, companies: o.companies.map((c, i) => (i === 0 ? { ...c, choice: null } : c)) };
    const next = failCompany(declined, 1, o.t + 1, industryHooks(o));
    expect(next.companies[1].sale).toBeUndefined();
    expect(next.companies[1].rescued !== undefined || next.companies[1].out).toBe(true);
  });

  it('사람 회사는 그대로 운항을 멈추고, 시장 변화를 끄면 컴퓨터도 바로 멈춘다', () => {
    let s = createGame(setup(['human', 'ai-normal'], { names: 'fictional' }), seededRandom(18));
    s = patch(s, 0, { cash: -100, crisis: 4 });
    const h = failCompany(s, 0, s.t, industryHooks(s));
    expect(h.companies[0].out).toBe(true);
    expect(h.companies[0].rescued).toBeUndefined();
    const off = patch({ ...s, options: { ...s.options, industry: false } }, 1, { cash: -100, crisis: 4 });
    expect(failCompany(off, 1, s.t, industryHooks(off)).companies[1].out).toBe(true);
  });
});

describe('회사 합치기 뒤 비행기', () => {
  it('저가항공을 합친 풀서비스 회사: 빠른 회전으로 짠 횟수는 우리 주간 비행시간 안으로 줄이고, 맞지 않는 기종은 쉬게 한다', () => {
    let s = createGame(setup(['ai-normal', 'ai-normal'], { names: 'fictional', era: 2003 }), seededRandom(20));
    const lcc: Company = { ...s.companies[1], bizModel: 'lcc' };
    const route = { id: s.nextId, a: 'paris', b: 'madrid', fare: 0, since: s.t, stats: null, times: [1, 1, 1, 1] as [number, number, number, number] };
    const m = MODEL['a320'];
    const hours = (c: Company, freq: number) => planeHours(c, { id: 0, model: 'a320', leased: false, rent: 0, deposit: 0, since: s.t, legs: [{ route: route.id, freq }], cabin: defaultCabin(m), meal: 1 });
    let freq = 1;
    while (hours({ ...lcc, routes: [route] }, freq + 1) <= WEEK_HOURS) freq++;
    const plane = { id: s.nextId + 1, model: 'a320', leased: false, rent: 0, deposit: 0, since: s.t, legs: [{ route: route.id, freq }], cabin: defaultCabin(m), meal: 1 };
    const freighter = { ...plane, id: s.nextId + 2, model: 'b747-400f', legs: [] };
    s = { ...s, nextId: s.nextId + 3, companies: [s.companies[0], { ...lcc, routes: [route], planes: [plane, freighter], branches: ['paris', 'madrid', lcc.hub] }] };
    expect(hours({ ...s.companies[0], routes: [route] }, freq)).toBeGreaterThan(WEEK_HOURS);
    const merged = industryHooks(s).merge(s, 0, 1, { rate: 0.6, why: 'rescue' });
    const a = merged.companies[0];
    for (const p of a.planes) expect(planeHours(a, p)).toBeLessThanOrEqual(WEEK_HOURS + 1e-9);
    expect(a.planes.find((p) => p.id === plane.id)!.legs[0].freq).toBeLessThan(freq);
    // 저가항공이 화물기를 넘겨받으면 쉬게 한다 (반대로 화물기는 풀서비스가 쓸 수 있다)
    const toLcc = industryHooks(s).merge({ ...s, companies: [{ ...s.companies[0], bizModel: 'lcc' }, { ...s.companies[1], bizModel: 'full', planes: [{ ...freighter, legs: [{ route: route.id, freq: 2 }] }] }] }, 0, 1, { rate: 0.6, why: 'rescue' });
    expect(toLcc.companies[0].planes.find((p) => p.id === freighter.id)!.legs).toEqual([]);
  });
});

describe('컴퓨터의 인수', () => {
  it('새로 생긴 작은 회사는 몇 해 동안 치열한 컴퓨터도 사들이지 않는다', () => {
    let s = createGame(setup(['ai-normal', 'ai-normal'], { names: 'fictional', aiStyle: 'fierce' }), seededRandom(19));
    s = admitEntrant(at(s, s.startT + 70), plan({ hub: 'rome', cash: 300 }), industryHooks(s));
    const young = s.companies.length - 1;
    expect(isYoung(s, s.companies[young])).toBe(true);
    s = { ...patch(s, 0, { cash: 80000 }), order: [0, 1, young], turnPos: 0 };
    const acts = planTurn(s, 0, 'ai-normal', seededRandom(1));
    expect(acts.some((a) => (a.type === 'buyStake' || a.type === 'merge') && a.company === young)).toBe(false);
    expect(isYoung(at(s, s.t + 60), s.companies[young])).toBe(false);
  });
});

describe('끝까지 (실제 항공사와 실제 역사)', () => {
  it('1983년부터 20년: 팬암·TWA의 역사를 지나며 멈추지 않고, 동시에 6곳까지, 저장이 올바르다', () => {
    const rng = seededRandom(83);
    let s = createGame(setup(['ai-normal', 'ai-normal', 'ai-normal', 'ai-easy'], { years: 20 }, ['panam', 'twa', 'american', 'lufthansa']), rng);
    let turns = 0;
    let most = 0;
    while (s.phase !== 'gameover' && turns < 3000) {
      s = aiTurn(s, rng);
      most = Math.max(most, aliveCount(s));
      turns++;
    }
    expect(s.phase).toBe('gameover');
    expect(most).toBeLessThanOrEqual(MAX_ACTIVE);
    expect(s.companies.length).toBeLessThanOrEqual(MAX_COMPANIES);
    // 팬암(1991)과 TWA(2001)는 역사를 만났다: 위기 소식이 났고, 결말은 문 닫기·합병·살아남기 가운데 하나
    const log = s.industry ?? [];
    for (const id of ['panam', 'twa']) {
      const ci = idx(s, id);
      expect(log.some((e) => e.kind === 'crisis' && e.company === ci)).toBe(true);
      expect(log.some((e) => e.company === ci && (e.kind === 'cease' || e.kind === 'merge' || e.kind === 'survive'))).toBe(true);
    }
    expect(s.companies.slice(4).every((c) => c.born !== undefined)).toBe(true);
    expect(isValidState(JSON.parse(JSON.stringify(s)))).toBe(true);
  }, 120000);
});
