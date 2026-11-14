import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { advise } from './advisor';
import { aiTurn, planTurn } from './ai';
import { SCENARIO_IDS, allianceScore, makeChoice } from './choices';
import { goalMet, gradeYear, newGoals } from './goals';
import { MAX_PLANES, actor, applyAction, choiceBlocker, createGame, proposeBlocker, routeOnPair, runQuarter } from './rules';
import { computeQuarter, networks } from './simulate';
import { isValidState } from './storage';
import { qOf, quarterOf, yearOf } from './time';
import type { AirlineOptions, AirlineSetup, AirlineState, Company, SeatKind } from './types';

function setup(kinds: SeatKind[], options: Partial<AirlineOptions> = {}, hubs: (string | null)[] = []): AirlineSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as AirlineSetup['seats'],
    options: { era: 2003, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'normal', ...options },
    hubs: [0, 1, 2, 3].map((i) => hubs[i] ?? null),
  };
}

function act(s: AirlineState, ...actions: Parameters<typeof applyAction>[1][]): AirlineState {
  for (const a of actions) {
    const next = applyAction(s, a, seededRandom(9));
    expect(next, JSON.stringify(a)).not.toBe(s);
    s = next;
  }
  return s;
}

/** 노선과 비행기를 손으로 붙인다 (분기 계산 시험용) */
function addRoute(s: AirlineState, ci: number, a: string, b: string, model: string, freq: number): number {
  const c = s.companies[ci];
  for (const city of [a, b]) if (!c.branches.includes(city)) c.branches.push(city);
  const rid = s.nextId++;
  c.routes.push({ id: rid, a, b, fare: 0, since: s.q, stats: null });
  c.planes.push({ id: s.nextId++, model, leased: true, rent: 10, deposit: 0, since: s.q, legs: [{ route: rid, freq }] });
  return rid;
}

function twoHumans(): AirlineState {
  return createGame(setup(['human', 'human'], {}, ['seoul', 'london']), seededRandom(1));
}

describe('갈아타는 손님', () => {
  it('본사를 거쳐 한 번 갈아타는 손님이 두 구간 좌석을 함께 차지하고, 수입은 거리만큼 나눈다', () => {
    const s = twoHumans();
    const tyo = addRoute(s, 0, 'seoul', 'tokyo', 'a330-300', 14);
    const bkk = addRoute(s, 0, 'seoul', 'bangkok', 'a330-300', 7);
    const out = computeQuarter(s);
    const t = out.xfers.find((x) => x.via === 'seoul' && [x.a, x.b].sort().join() === 'bangkok,tokyo');
    expect(t).toBeTruthy();
    expect(t!.pax).toBeGreaterThan(0);
    expect(t!.companies).toEqual([0]);
    const a = out.routeStats[0].get(tyo)!;
    const b = out.routeStats[0].get(bkk)!;
    expect(a.xfer).toBeCloseTo(b.xfer, 6);
    expect(a.xfer).toBeGreaterThan(0);
    // 긴 구간(서울–방콕)이 수입을 더 많이 가져간다
    expect(b.xferRev).toBeGreaterThan(a.xferRev);
    expect(out.reports[0].xferPax).toBeGreaterThan(0);
    // 좌석보다 많이 태우지 않는다
    for (const st of out.routeStats[0].values()) expect(st.lf).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('곧장 가는 라이벌 노선이 있으면 갈아타는 손님이 줄고, 너무 돌아가는 길은 안 탄다', () => {
    const base = twoHumans();
    addRoute(base, 0, 'seoul', 'tokyo', 'a330-300', 14);
    addRoute(base, 0, 'seoul', 'bangkok', 'a330-300', 7);
    const alone = computeQuarter(base).xfers.find((x) => x.via === 'seoul' && x.a !== 'seoul' && x.b !== 'seoul')!.pax;
    const rival = structuredClone(base);
    addRoute(rival, 1, 'tokyo', 'bangkok', 'a330-300', 14);
    const withRival = computeQuarter(rival).xfers.find((x) => x.via === 'seoul' && [x.a, x.b].includes('bangkok') && [x.a, x.b].includes('tokyo'));
    expect(withRival?.pax ?? 0).toBeLessThan(alone);
    // 서울을 거쳐 도쿄–시드니는 너무 돌아가지 않지만, 런던–도쿄–서울 같은 되돌아가는 길은 없다
    const back = twoHumans();
    addRoute(back, 0, 'seoul', 'tokyo', 'a330-300', 14);
    addRoute(back, 0, 'seoul', 'osaka', 'a320', 14);
    expect(computeQuarter(back).xfers.some((x) => [x.a, x.b].includes('tokyo') && [x.a, x.b].includes('osaka'))).toBe(false);
  });

  it('제휴(코드셰어)하면 두 회사 노선을 이어 갈아타는 손님을 함께 태운다', () => {
    const s = twoHumans();
    addRoute(s, 0, 'seoul', 'tokyo', 'a330-300', 14);
    addRoute(s, 1, 'seoul', 'bangkok', 'a330-300', 7);
    const pair = (st: AirlineState) => computeQuarter(st).xfers.filter((x) => x.companies.length === 2);
    expect(pair(s)).toHaveLength(0);
    s.companies[0].partner = 1;
    s.companies[1].partner = 0;
    expect(networks(s)).toEqual([[0, 1]]);
    const joint = pair(s);
    expect(joint.length).toBeGreaterThan(0);
    expect(joint[0].companies.sort()).toEqual([0, 1]);
  });
});

describe('제휴 제안', () => {
  it('사람에게 제안하면 결정 사건이 오고, 받아들이면 제휴, 끝낼 수도 있다', () => {
    let s = twoHumans();
    s = act(s, { type: 'propose', to: 1 });
    expect(proposeBlocker(s, 0, 1)).toContain('이미 제안');
    expect(s.companies[1].choice?.scenario).toBe('alliance');
    s = act(s, { type: 'endTurn' });
    expect(actor(s)).toBe(1);
    s = act(s, { type: 'choose', option: 0 });
    expect(s.companies[0].partner).toBe(1);
    expect(s.companies[1].partner).toBe(0);
    expect(s.news.some((n) => n.title.includes('제휴'))).toBe(true);
    s = act(s, { type: 'endAlliance' });
    expect(s.companies[0].partner).toBeNull();
    expect(s.companies[1].partner).toBeNull();
  });

  it('컴퓨터는 겹치는 노선이 많으면 거절하고, 함께 가는 도시가 많으면 받아들인다', () => {
    const s = createGame(setup(['human', 'ai-normal'], {}, ['seoul', 'london']), seededRandom(2));
    for (const city of ['tokyo', 'newyork', 'paris', 'bangkok']) {
      s.companies[0].branches.push(city);
      s.companies[1].branches.push(city);
    }
    expect(allianceScore(s, 0, 1)).toBeGreaterThan(0);
    const yes = applyAction(s, { type: 'propose', to: 1 });
    expect(yes.companies[1].partner).toBe(0);
    const t = createGame(setup(['human', 'ai-normal'], {}, ['seoul', 'busan']), seededRandom(2));
    addRoute(t, 0, 'seoul', 'tokyo', 'a320', 7);
    addRoute(t, 1, 'seoul', 'tokyo', 'a320', 7);
    addRoute(t, 0, 'busan', 'osaka', 'a320', 7);
    addRoute(t, 1, 'busan', 'osaka', 'a320', 7);
    expect(allianceScore(t, 0, 1)).toBeLessThanOrEqual(0);
    const no = applyAction(t, { type: 'propose', to: 1 });
    expect(no.companies[1].partner).toBeNull();
    expect(no.events.some((e) => e.type === 'alliance' && !e.ok)).toBe(true);
  });
});

describe('결정 사건', () => {
  it(`이야기는 ${SCENARIO_IDS.length}가지이고, 시대마다 고를 수 있는 일이 여럿 나온다`, () => {
    expect(SCENARIO_IDS.length).toBeGreaterThanOrEqual(15);
    const seen = new Set<string>();
    for (const era of [1963, 1983, 2003] as const) {
      const s = createGame(setup(['human', 'human'], { era }, ['seoul', 'london']), seededRandom(era));
      for (const [a, b] of [
        ['seoul', 'tokyo'],
        ['seoul', 'bangkok'],
        ['seoul', 'osaka'],
      ]) {
        addRoute(s, 0, a, b, era === 1963 ? 'b707' : era === 1983 ? 'b737-200' : 'a320', 3);
      }
      s.companies[0].planes.push({ id: s.nextId++, model: era === 1963 ? 'b707' : 'a320', leased: false, rent: 0, deposit: 0, since: s.q, legs: [] });
      const here = new Set<string>();
      for (let k = 0; k < 60; k++) {
        const d = makeChoice(s, 0, seededRandom(k * 7 + era));
        expect(d).not.toBeNull();
        expect(d!.options.length).toBeGreaterThanOrEqual(2);
        expect(d!.options.length).toBeLessThanOrEqual(3);
        for (const o of d!.options) expect(o.desc.length).toBeGreaterThan(0);
        here.add(d!.scenario);
        seen.add(d!.scenario);
      }
      expect(here.size).toBeGreaterThanOrEqual(8);
      // 인터넷 판매는 1990년대 뒤에만
      if (era === 1963) expect(here.has('online')).toBe(false);
    }
    expect(seen.size).toBeGreaterThanOrEqual(14);
  });

  it('고르면 미리 보여 준 대로 바뀌고, 돈이 모자란 안은 못 고르며, 안 고르면 마지막 안으로 정해진다', () => {
    let s = twoHumans();
    s.companies[0].choice = {
      id: s.nextId++,
      scenario: 'test',
      icon: '🧪',
      title: '시험',
      text: '시험',
      options: [
        { label: '비싼 안', desc: '현금 −9999', cost: 9999, ai: 1, effects: [{ kind: 'rep', amount: 10 }] },
        { label: '값싼 안', desc: '평판 +4, 연료 −5%', cost: 10, ai: 0.5, effects: [{ kind: 'rep', amount: 4 }, { kind: 'mod', mod: { kind: 'fuel', value: 0.95, until: s.q + 4, label: '연료 절약' } }] },
        { label: '안 해요', desc: '없음', cost: 0, ai: 0, effects: [] },
      ],
    };
    expect(choiceBlocker(s, 0, 0)).toContain('돈이 모자라요');
    expect(applyAction(s, { type: 'choose', option: 0 })).toBe(s);
    const rep = s.companies[0].reputation;
    const cash = s.companies[0].cash;
    const t = act(s, { type: 'choose', option: 1 });
    expect(t.companies[0].choice).toBeNull();
    expect(t.companies[0].reputation).toBeCloseTo(rep + 4, 5);
    expect(t.companies[0].cash).toBeCloseTo(cash - 10, 5);
    expect(t.companies[0].mods.some((m) => m.kind === 'fuel' && m.value === 0.95)).toBe(true);
    // 안 고르고 차례를 마치면 마지막 안
    const u = act(s, { type: 'endTurn' });
    expect(u.companies[0].choice).toBeNull();
    expect(u.companies[0].reputation).toBe(rep);
  });

  it('회사마다 서너 분기에 한 번쯤 결정 사건이 오고, 컴퓨터는 알아서 고른다', () => {
    const rng = seededRandom(5);
    let s = createGame(setup(['ai-normal', 'ai-easy', 'ai-normal']), rng);
    const got = [0, 0, 0];
    while (s.q < s.startQ + 16) {
      const ci = actor(s);
      if (s.companies[ci].choice) {
        got[ci]++;
        const actions = planTurn(s, ci, s.companies[ci].kind === 'ai-easy' ? 'ai-easy' : 'ai-normal', seededRandom(s.q));
        expect(actions.some((a) => a.type === 'choose')).toBe(true);
      }
      s = aiTurn(s, rng);
    }
    for (const n of got) {
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(6);
    }
  });
});

describe('파산과 중고 시장', () => {
  it('파산한 회사의 내 비행기는 중고 시장에 나오고, 슬롯이 비었다는 소식이 뜬다', () => {
    let s = createGame(setup(['human', 'human', 'human']), seededRandom(1));
    const c = s.companies[0];
    for (let i = 0; i < 3; i++) c.planes.push({ id: s.nextId++, model: 'a320', leased: false, rent: 0, deposit: 0, since: s.q - 8, legs: [] });
    c.cash = -99999;
    c.baseCredit = 0;
    c.crisis = 1;
    s = runQuarter(s, seededRandom(2));
    expect(s.companies[0].out).toBe(true);
    const fromIt = s.market.filter((u) => u.from === c.name);
    expect(fromIt).toHaveLength(3);
    expect(fromIt.every((u) => u.model === 'a320' && u.price > 0)).toBe(true);
    expect(s.news.some((n) => n.title.includes('파산') && n.text.includes('슬롯'))).toBe(true);
    expect(s.phase).toBe('manage');
  });
});

describe('라이벌 소식', () => {
  it('라이벌이 내 노선에 들어오면 나에게 알려 준다', () => {
    let s = twoHumans();
    s = act(s, { type: 'openBranch', city: 'paris' }, { type: 'openRoute', a: 'seoul', b: 'paris' }, { type: 'endTurn' });
    s.companies[1].branches.push('seoul');
    s = act(s, { type: 'openRoute', a: 'london', b: 'seoul' });
    expect(routeOnPair(s.companies[1], 'seoul', 'london')).toBeTruthy();
    const s2 = act(s, { type: 'openBranch', city: 'paris' }, { type: 'openRoute', a: 'paris', b: 'seoul' });
    const n = s2.news.find((x) => x.icon === '⚔️');
    expect(n).toBeTruthy();
    expect(n!.for).toEqual([0]);
  });
});

describe('경영 비서', () => {
  it('처음에는 첫 노선을 권하고, 적용하면 노선과 비행기가 생긴다', () => {
    const s = createGame(setup(['human', 'ai-normal'], {}, ['seoul']), seededRandom(4));
    const list = advise(s, 0);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].key.startsWith('first')).toBe(true);
    const t = list[0].apply!(s);
    expect(t).not.toBe(s);
    expect(t.companies[0].routes).toHaveLength(1);
    expect(t.companies[0].planes[0].legs.length).toBe(1);
    // 첫해에는 리스 보증금이 없다
    expect(t.companies[0].planes[0].deposit).toBe(0);
  });

  it('여러 상황에서 3~5개를 넘지 않게 권하고, 적용 버튼은 모두 규칙에 맞는 상태를 만든다', () => {
    const rng = seededRandom(8);
    let s = createGame(setup(['human', 'ai-normal'], { era: 1983 }), rng);
    let applied = 0;
    for (let turn = 0; turn < 40 && s.phase === 'manage'; turn++) {
      const ci = actor(s);
      if (s.companies[ci].kind === 'human') {
        const list = advise(s, ci);
        expect(list.length).toBeLessThanOrEqual(5);
        expect(new Set(list.map((a) => a.key)).size).toBe(list.length);
        for (const a of list) {
          expect(a.title.length).toBeGreaterThan(0);
          if (!a.apply) continue;
          const t = a.apply(s);
          expect(isValidState(t), a.key).toBe(true);
          if (t !== s) applied++;
        }
        const first = list.find((a) => a.apply);
        if (first) s = first.apply!(s);
        s = applyAction(s, { type: 'endTurn' }, rng);
      } else s = aiTurn(s, rng);
    }
    expect(applied).toBeGreaterThan(10);
  });
});

describe('연간 목표와 평가', () => {
  it('해마다 목표 셋을 받고, 4분기가 끝나면 등급과 평을 받고 이룬 목표만큼 상을 받는다', () => {
    const rng = seededRandom(3);
    let s = createGame(setup(['ai-normal', 'ai-easy']), rng);
    expect(s.companies.every((c) => c.goals.length === 3 && c.goals.every((g) => g.done === null))).toBe(true);
    while (quarterOf(s.q) !== 4 || s.turnPos !== 0) s = aiTurn(s, rng);
    for (let i = 0; i < s.order.length - 1; i++) s = aiTurn(s, rng);
    s = aiTurn(s, rng);
    expect(yearOf(s.q)).toBe(2004);
    const rep = s.report!;
    for (const [ci, r] of rep.companies.entries()) {
      expect(r.review).toBeTruthy();
      expect(['S', 'A', 'B', 'C', 'D']).toContain(r.review!.grade);
      expect(r.review!.text.length).toBeGreaterThan(5);
      expect(r.goals!.every((g) => typeof g.done === 'boolean')).toBe(true);
      expect(s.companies[ci].reviews.at(-1)!.year).toBe(2003);
      expect(s.companies[ci].goals.every((g) => g.done === null)).toBe(true);
    }
    // 새해 목표
    expect(s.companies.every((c) => c.goals.length === 3 && c.goals.every((g) => g.done === null))).toBe(true);
    expect(s.companies.every((c) => c.acc.year === 2004 && c.acc.quarters === 0)).toBe(true);
  });

  it('목표는 이룬 만큼만 맞다고 매기고, 등급은 이익·성장·탑승률·목표로 정한다', () => {
    const s = twoHumans();
    const c: Company = s.companies[0];
    c.acc = { ...c.acc, pax: 900, seats: 1000, profitQ: 4, revenue: 1000, profit: 300, quarters: 4, startValue: c.cash * 0.6 };
    const goals = newGoals(s, 0, seededRandom(1));
    expect(goals).toHaveLength(3);
    expect(goalMet(s, 0, { kind: 'lf', target: 0.88, text: '', reward: { cash: 1, rep: 1 }, done: null })).toBe(true);
    expect(goalMet(s, 0, { kind: 'lf', target: 0.95, text: '', reward: { cash: 1, rep: 1 }, done: null })).toBe(false);
    expect(goalMet(s, 0, { kind: 'profit4', target: 4, text: '', reward: { cash: 1, rep: 1 }, done: null })).toBe(true);
    const good = gradeYear(s, 0, goals.map((g) => ({ ...g, done: true })));
    expect(['S', 'A']).toContain(good.grade);
    c.acc = { ...c.acc, pax: 400, seats: 1000, profitQ: 0, revenue: 1000, profit: -200, startValue: c.cash * 1.5 };
    const bad = gradeYear(s, 0, goals.map((g) => ({ ...g, done: false })));
    expect(bad.grade).toBe('D');
    expect(bad.text).toContain('적자');
  });
});

describe('컴퓨터 성향과 기타', () => {
  it('느긋한 컴퓨터는 치열한 컴퓨터보다 천천히 넓힌다', () => {
    const routesAfter = (aiStyle: AirlineOptions['aiStyle']) => {
      let total = 0;
      for (const seed of [1, 2]) {
        const rng = seededRandom(seed);
        let s = createGame(setup(['ai-normal', 'ai-normal'], { aiStyle }), rng);
        while (s.q < s.startQ + 8) s = aiTurn(s, rng);
        total += s.companies.reduce((sum, c) => sum + c.routes.length, 0);
      }
      return total;
    };
    expect(routesAfter('relaxed')).toBeLessThan(routesAfter('fierce'));
  });

  it(`비행기는 주문까지 ${MAX_PLANES}대까지`, () => {
    const s = twoHumans();
    for (let i = 0; i < MAX_PLANES; i++) s.companies[0].planes.push({ id: s.nextId++, model: 'a320', leased: false, rent: 0, deposit: 0, since: s.q, legs: [] });
    s.companies[0].cash = 1e6;
    expect(applyAction(s, { type: 'buy', model: 'a320' })).toBe(s);
    expect(applyAction(s, { type: 'lease', model: 'a320' })).toBe(s);
  });

  it('시작 분기 정보', () => {
    const s = twoHumans();
    expect(s.q).toBe(qOf(2003, 1));
    expect(s.version).toBe(2);
    expect(isValidState(JSON.parse(JSON.stringify(s)))).toBe(true);
  });
});
