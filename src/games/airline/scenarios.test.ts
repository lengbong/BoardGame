import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL } from './aircraft';
import { aiTurn } from './ai';
import { ACHIEVEMENTS, checkAchievements, emptyAchStore, parseAchStore } from './achievements';
import { fitsBizModel } from './bizmodel';
import { defaultCabin } from './cabin';
import { CHALLENGES } from './challenges';
import { CITY, airportClass, dist } from './cities';
import { recordGameEnd, emptyHof, parseHof } from './hallOfFame';
import { branchPolitics, makerPolitics, routePolitics } from './politics';
import { rightsInfoFor } from './rights';
import { actor, applyAction, createGame, endT } from './rules';
import { scenarioMonthEnd } from './scenarioRules';
import {
  SCENARIO,
  SCENARIOS,
  currentStage,
  endOf,
  fastOf,
  goalLabel,
  goalStatus,
  planeKindOf,
  scenarioOf,
  stageMet,
  stageViews,
  starText,
  starsFor,
  startOf,
  type ScenarioGoal,
} from './scenarios';
import { SCENARIO_STORE_KEY, addScenarioResult, emptyScenarioStore, isValidScenarioState, loadScenarioStore, parseScenarioStore, recordScenarioEnd, resetScenarioStore } from './scenarioSave';
import { WEEK_HOURS, companyValue, emptyReport, maxFreq, planeHours, slotCapacity, slotsUsed } from './simulate';
import { parseOptions, parseSaved } from './storage';
import { yearOfM } from './time';
import type { AirlineOptions, AirlineSetup, AirlineState, CompanyReport, Plane, QuarterReport, SeatKind } from './types';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const NOW = 1_700_000_000_000;

function setup(id: string | null, kind: SeatKind = 'human', options: Partial<AirlineOptions> = {}): AirlineSetup {
  return {
    seats: [
      { kind, name: '' },
      { kind: 'ai-normal', name: '' },
      { kind: 'empty', name: '' },
      { kind: 'empty', name: '' },
    ],
    options: { era: 1983, mode: 'scenario', scenario: id, years: 20, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'fierce', names: 'fictional', rights: 'off', history: false, ...options },
    hubs: [null, null, null, null],
    airlines: [null, null, null, null],
  };
}

const start = (id: string, kind: SeatKind = 'human', options: Partial<AirlineOptions> = {}) => createGame(setup(id, kind, options), seededRandom(7));

let nextPlane = 70000;
function plane(model: string, legs: Plane['legs'] = [], since = 0): Plane {
  return { id: nextPlane++, model, leased: false, rent: 0, deposit: 0, since, legs, cabin: defaultCabin(MODEL[model]), meal: 3 };
}

/** 노선 하나를 열고 그 기종으로 띄운다 */
function fly(s: AirlineState, ci: number, a: string, b: string, model: string, freq = 3): void {
  const c = s.companies[ci];
  const id = 60000 + nextPlane;
  for (const city of [a, b]) if (!c.branches.includes(city)) c.branches.push(city);
  c.routes.push({ id, a, b, fare: 0, since: s.t, stats: null, times: [1, 1, 1, 0] });
  c.planes.push(plane(model, [{ route: id, freq }], s.t));
}

function monthReport(s: AirlineState, t: number, patch: Partial<CompanyReport>[]): QuarterReport {
  return { q: Math.floor(t / 3), t, span: 1, companies: s.companies.map((_, i) => ({ ...emptyReport(), ...(patch[i] ?? {}) })), routes: [], news: [] } as unknown as QuarterReport;
}

const ok = (s: AirlineState, g: ScenarioGoal) => goalStatus(s, 0, g).ok;

describe('역사 시나리오 목록', () => {
  it('시대가 다른 시나리오 6~8개, id가 겹치지 않고 단계·별·기한이 알맞다', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(6);
    expect(SCENARIOS.length).toBeLessThanOrEqual(8);
    expect(new Set(SCENARIOS.map((d) => d.id)).size).toBe(SCENARIOS.length);
    // 도전 과제와 id가 겹치지 않는다 (업적·명예의 전당에서 따로 센다)
    for (const d of SCENARIOS) expect(CHALLENGES.some((c) => c.id === d.id)).toBe(false);
    expect(new Set(SCENARIOS.map((d) => d.hub)).size).toBe(SCENARIOS.length);
    expect(SCENARIOS.some((d) => CITY[d.hub].country !== '한국')).toBe(true);
    for (const d of SCENARIOS) {
      expect(d.title.length).toBeGreaterThan(2);
      expect(d.story.length).toBeGreaterThan(40);
      expect(d.stages.length).toBeGreaterThanOrEqual(3);
      expect([1, 4, 7, 10]).toContain(d.month ?? 1);
      expect(d.stars).toBeGreaterThanOrEqual(1);
      expect(d.stars).toBeLessThanOrEqual(3);
      expect(MODEL[d.art]).toBeTruthy();
      // 빠른 별 기한은 시작과 끝 사이, 끝까지 3년 넘게
      expect(fastOf(d)).toBeGreaterThan(startOf(d) + 18);
      expect(fastOf(d)).toBeLessThan(endOf(d));
      expect(endOf(d) - startOf(d)).toBeGreaterThanOrEqual(36);
      for (const st of d.stages) {
        expect(st.goals.length).toBeGreaterThan(0);
        expect(st.story.length).toBeGreaterThan(10);
        for (const g of st.goals) expect(goalLabel(g).length).toBeGreaterThan(3);
      }
      expect(d.tips.length).toBeGreaterThan(0);
    }
  });

  it('비행기 종류 나누기: 제트기·프로펠러기·넓은 동체·점보·화물기·연료를 아끼는/많이 먹는 비행기', () => {
    expect(planeKindOf(MODEL.f27, 'prop')).toBe(true);
    expect(planeKindOf(MODEL.f27, 'jet')).toBe(false);
    expect(planeKindOf(MODEL.b707, 'jet')).toBe(true);
    expect(planeKindOf(MODEL.b707, 'thirsty')).toBe(true);
    expect(planeKindOf(MODEL['b737-200'], 'thrifty')).toBe(true);
    expect(planeKindOf(MODEL.a300b4, 'thrifty')).toBe(true);
    expect(planeKindOf(MODEL['b747-100'], 'jumbo')).toBe(true);
    expect(planeKindOf(MODEL['b747-100'], 'wide')).toBe(true);
    expect(planeKindOf(MODEL['b747-200f'], 'freighter')).toBe(true);
    expect(planeKindOf(MODEL['b747-200f'], 'bigFreighter')).toBe(true);
    expect(planeKindOf(MODEL['b747-200f'], 'jumbo')).toBe(false);
    expect(planeKindOf(MODEL['b707-320c'], 'bigFreighter')).toBe(false);
  });
});

describe('시나리오 시작', () => {
  for (const def of SCENARIOS) {
    it(`${def.emoji} ${def.title}: 정해 둔 회사·라이벌·비행기로 규칙에 맞게 시작한다`, () => {
      const s = start(def.id);
      const year = yearOfM(s.t);
      expect(s.options.mode).toBe('scenario');
      expect(s.options.scenario).toBe(def.id);
      // 시나리오의 시대 규칙이 설정보다 앞선다
      expect(s.options.rights).toBe(def.rights);
      expect(s.options.history).toBe(def.history);
      expect(s.options.aiStyle).toBe(def.aiStyle);
      expect(s.t).toBe(startOf(def));
      expect(s.startT).toBe(startOf(def));
      expect(s.q).toBe(Math.floor(s.t / 3));
      expect(s.challenge).toBeNull();
      expect(s.scenario).toEqual({ id: def.id, company: 0, deadline: endOf(def), done: def.stages.map(() => null) });
      expect(endT(s)).toBe(endOf(def));
      expect(s.companies.length).toBe(1 + def.rivals.length);
      const me = s.companies[0];
      expect(me.kind).toBe('human');
      expect(me.hub).toBe(def.hub);
      expect(me.cash).toBe(def.cash);
      expect(me.debt).toBe(def.debt ?? 0);
      expect(me.bizModel).toBe(def.model ?? 'full');
      def.rivals.forEach((r, k) => {
        const c = s.companies[k + 1];
        expect(c.kind).toBe(r.kind);
        expect(c.hub).toBe(r.hub);
        expect(c.bizModel).toBe(r.model ?? 'full');
        expect(c.planes.length).toBe(r.fleet?.length ?? 0);
        if (r.name) expect(c.name).toBe(r.name);
      });
      expect(me.planes.length).toBe(def.fleet?.length ?? 0);
      s.companies.forEach((c, ci) => {
        expect(c.branches).toContain(c.hub);
        for (const city of c.branches) {
          expect(CITY[city]).toBeTruthy();
          if (def.history) expect(branchPolitics(c.hub, city, year), `${c.name} 지점 ${city}`).toBeNull();
        }
        for (const p of c.planes) {
          const m = MODEL[p.model];
          // 그 해에 있던 기종: 만든 해(지금 − 나이)에 생산 중이었다
          const built = yearOfM(p.since);
          expect(m.intro, `${p.model} ${built}`).toBeLessThanOrEqual(built);
          expect(m.end, `${p.model} ${built}`).toBeGreaterThanOrEqual(built);
          expect(m.intro).toBeLessThanOrEqual(year);
          expect(fitsBizModel(c.bizModel, m), `${c.name} ${p.model}`).toBe(true);
          if (def.history) expect(makerPolitics(c.hub, m, year), `${c.name} ${p.model}`).toBeNull();
          expect(planeHours(c, p)).toBeLessThanOrEqual(WEEK_HOURS + 1e-6);
          for (const leg of p.legs) {
            const r = c.routes.find((x) => x.id === leg.route)!;
            expect(r).toBeTruthy();
            expect(c.branches).toContain(r.a);
            expect(c.branches).toContain(r.b);
            const d = dist(r.a, r.b);
            expect(m.range, `${p.model} ${r.a}-${r.b}`).toBeGreaterThanOrEqual(d);
            expect(airportClass(CITY[r.a], year), `${r.a} ${p.model}`).toBeGreaterThanOrEqual(m.runway);
            expect(airportClass(CITY[r.b], year), `${r.b} ${p.model}`).toBeGreaterThanOrEqual(m.runway);
            expect(leg.freq).toBeGreaterThanOrEqual(1);
            expect(leg.freq).toBeLessThanOrEqual(maxFreq(m, d));
            if (def.history) expect(routePolitics(c.hub, r.a, r.b, year), `${r.a}-${r.b}`).toBeNull();
          }
        }
        // 운수권: 처음 노선은 두 나라 사이 주간 횟수 안에서
        for (const r of c.routes) {
          const info = rightsInfoFor(s, ci, r.a, r.b);
          expect(info.left, `${c.name} ${r.a}-${r.b} ${info.label}`).toBeGreaterThanOrEqual(0);
        }
        for (const city of c.branches) expect(slotsUsed(c, city), `${c.name} ${city}`).toBeLessThanOrEqual(slotCapacity(s, ci, city));
      });
      // 처음부터 이룬 단계는 없다
      expect(stageMet(s, 0, def.stages[0])).toBe(false);
      expect(stageMet(s, 0, def.stages[def.stages.length - 1])).toBe(false);
      // 시작 소식과 저장 왕복
      expect(s.news.some((n) => n.title.includes(def.title))).toBe(true);
      const back = parseSaved(clone({ setup: setup(def.id), state: s, savedAt: NOW }));
      expect(back).not.toBeNull();
      expect(back!.state.scenario).toEqual(s.scenario);
      expect(back!.state.options.scenario).toBe(def.id);
    });
  }

  it('실제 항공사 이름으로 하면 라이벌만 그 해 날던 항공사 이름을 빌리고, 지어낸 이름·저가항공은 그대로', () => {
    const s = start('dereg', 'human', { names: 'real' });
    expect(s.companies[1].airline).not.toBeNull();
    expect(s.companies[0].airline).toBeNull();
    const lcc = start('lccboom', 'human', { names: 'real' });
    expect(lcc.companies[3].name).toBe('콩새항공');
    expect(lcc.companies[3].airline).toBeNull();
    expect(lcc.news.some((n) => n.text.includes('게임 속 이야기'))).toBe(true);
  });

  it('모르는 시나리오나 id가 없으면 보통 게임(정해진 해까지)으로 시작한다', () => {
    const s = createGame({ ...setup('nope'), seats: [{ kind: 'human', name: '' }, { kind: 'ai-normal', name: '' }, { kind: 'empty', name: '' }, { kind: 'empty', name: '' }] }, seededRandom(1));
    expect(s.options.mode).toBe('years');
    expect(s.scenario).toBeUndefined();
    expect(createGame(setup(null), seededRandom(1)).options.mode).toBe('years');
  });
});

describe('단계 목표 살피기', () => {
  it('노선·비행기·지역·나라 목표', () => {
    const s = clone(start('jetage'));
    expect(ok(s, { kind: 'planes', n: 2, type: 'jet' })).toBe(false);
    expect(goalStatus(s, 0, { kind: 'planes', n: 2, type: 'jet' }).text).toBe('0 / 2대');
    s.companies[0].planes.push(plane('b707'), plane('caravelle'));
    expect(ok(s, { kind: 'planes', n: 2, type: 'jet' })).toBe(true);
    // 띄우는 비행기만 세는 목표는 쉬는 비행기를 세지 않는다
    expect(ok(s, { kind: 'planes', n: 1, type: 'jet', fly: true })).toBe(false);
    expect(goalStatus(s, 0, { kind: 'fewPlanes', max: 0, type: 'prop' }).text).toBe('지금 3대');
    expect(ok(s, { kind: 'fewPlanes', max: 0, type: 'prop' })).toBe(false);
    expect(ok(s, { kind: 'routes', n: 3 })).toBe(true);
    expect(ok(s, { kind: 'routes', n: 1, minKm: 4000 })).toBe(false);
    fly(s, 0, 'tokyo', 'honolulu', 'b707');
    expect(ok(s, { kind: 'routes', n: 1, minKm: 4000 })).toBe(true);
    expect(ok(s, { kind: 'routes', n: 4 })).toBe(true);
    expect(ok(s, { kind: 'planes', n: 1, type: 'jet', fly: true })).toBe(true);
    // 동아시아 + 대양주(하와이) = 2지역, 나라 밖: 한국·미국
    expect(goalStatus(s, 0, { kind: 'regions', n: 4 }).text).toBe('2 / 4곳');
    expect(goalStatus(s, 0, { kind: 'countries', n: 3 }).text).toBe('2 / 3곳');
    // 도쿄·오사카–서울과 도쿄–호놀룰루는 나라 밖, 도쿄–오사카는 나라 안
    expect(ok(s, { kind: 'routes', n: 3, intl: true })).toBe(true);
    expect(ok(s, { kind: 'routes', n: 4, intl: true })).toBe(false);
    // 프로펠러기를 모두 팔면
    s.companies[0].planes = s.companies[0].planes.filter((p) => !planeKindOf(MODEL[p.model], 'prop'));
    expect(ok(s, { kind: 'fewPlanes', max: 0, type: 'prop' })).toBe(true);
    // 진행 막대는 0~1
    for (const st of SCENARIO.jetage.stages) for (const g of st.goals) {
      const r = goalStatus(s, 0, g).ratio;
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });

  it('돈·순위·빚·평판·흑자 목표', () => {
    const s = clone(start('oilshock'));
    const v = companyValue(s, 0);
    expect(ok(s, { kind: 'value', v: Math.floor(v) })).toBe(true);
    expect(ok(s, { kind: 'value', v: Math.ceil(v) + 1 })).toBe(false);
    expect(ok(s, { kind: 'debt', max: 300 })).toBe(false);
    s.companies[0].debt = 250;
    expect(ok(s, { kind: 'debt', max: 300 })).toBe(true);
    expect(goalStatus(s, 0, { kind: 'debt', max: 0 }).label).toBe('빚 모두 갚기');
    expect(ok(s, { kind: 'rank', r: 1 })).toBe(false);
    s.companies[0].cash = 1e6;
    expect(ok(s, { kind: 'rank', r: 1 })).toBe(true);
    expect(goalStatus(s, 0, { kind: 'rank', r: 1 }).text).toBe('지금 1등');
    s.companies[0].reputation = 69.6;
    expect(ok(s, { kind: 'reputation', n: 70 })).toBe(true);
    s.companies[0].stats.profitStreak = 3;
    expect(goalStatus(s, 0, { kind: 'streak', n: 4 }).ratio).toBeCloseTo(0.75);
    // 한 해 흑자: 1973년(시작한 해)은 세지 않고, 1974년부터
    const yr = (year: number, profit: number) => ({ year, companies: s.companies.map((_, i) => ({ ...emptyReport(), profit: i === 0 ? profit : 0 })) });
    s.years = [yr(1973, 500)] as AirlineState['years'];
    expect(ok(s, { kind: 'yearProfit', from: 1974 })).toBe(false);
    expect(goalStatus(s, 0, { kind: 'yearProfit', from: 1974 }).text).toContain('1974년을 기다려요');
    s.years.push(yr(1974, -20) as AirlineState['years'][number]);
    expect(ok(s, { kind: 'yearProfit', from: 1974 })).toBe(false);
    s.years.push(yr(1975, 12) as AirlineState['years'][number]);
    expect(ok(s, { kind: 'yearProfit', from: 1974 })).toBe(true);
    expect(goalStatus(s, 0, { kind: 'yearProfit', from: 1974 }).text).toContain('1975년');
  });

  it('최근 석 달 손님·화물·갈아탄 손님은 달 결산 장부 마지막 석 달로 센다', () => {
    const s = clone(start('cargo'));
    const t = s.t;
    s.ledger = [
      monthReport(s, t - 3, [{ pax: 999999, cargoT: 99999, xferPax: 99999 }]),
      monthReport(s, t - 2, [{ pax: 100000, cargoT: 30000, xferPax: 10000 }]),
      monthReport(s, t - 1, [{ pax: 100000, cargoT: 30000, xferPax: 10000 }]),
      monthReport(s, t, [{ pax: 50000, cargoT: 40000, xferPax: 20000 }]),
    ];
    expect(goalStatus(s, 0, { kind: 'pax3', n: 250000 }).ok).toBe(true);
    expect(goalStatus(s, 0, { kind: 'pax3', n: 250001 }).ok).toBe(false);
    expect(goalStatus(s, 0, { kind: 'cargo3', t: 100000 }).ok).toBe(true);
    expect(goalStatus(s, 0, { kind: 'cargo3', t: 100000 }).text).toBe('10만 / 10만톤');
    expect(goalStatus(s, 0, { kind: 'xfer3', n: 40000 }).ok).toBe(true);
    expect(goalStatus(s, 0, { kind: 'xfer3', n: 40001 }).ok).toBe(false);
  });

  it('라이벌과 겨루는 노선: 라이벌도 나는 노선에서 우리 손님 몫이 절반을 넘어야 센다', () => {
    const s = clone(start('dereg'));
    const g: ScenarioGoal = { kind: 'contested', n: 1 };
    const me = s.companies[0];
    const r = me.routes[0];
    r.stats = { lf: 0.8, pax: 1000, revenue: 1, profit: 1, lossStreak: 0, share: 0.7, xfer: 0, xferRev: 0, onTime: 0.9, hist: [], cancel: 0 } as unknown as typeof r.stats;
    // 샌프란시스코–로스앤젤레스는 아직 우리만 난다
    expect(ok(s, g)).toBe(false);
    fly(s, 1, 'sanfrancisco', 'losangeles', 'b727-200');
    expect(ok(s, g)).toBe(true);
    r.stats!.share = 0.5;
    expect(ok(s, g)).toBe(false);
  });

  it('단계 보기: 이룬 단계·지금 단계·아직, 지금 단계는 목표마다 진행', () => {
    const s = clone(start('jetage'));
    s.scenario!.done[0] = s.t;
    const v = stageViews(s, SCENARIO.jetage, s.scenario!);
    expect(v.map((x) => x.current)).toEqual([false, true, false]);
    expect(v[0].doneAt).toBe(s.t);
    expect(v[1].goals.length).toBe(2);
    expect(currentStage(s.scenario!)).toBe(1);
    expect(scenarioOf(s)?.def.id).toBe('jetage');
    expect(scenarioOf({ scenario: { ...s.scenario!, id: 'gone' } })).toBeNull();
  });
});

describe('달마다 단계 진행·성공·실패·별', () => {
  /** 제트 시대: 1·2단계 목표를 채운 상태 */
  function jetReady(): AirlineState {
    const s = clone(start('jetage'));
    fly(s, 0, 'tokyo', 'honolulu', 'b707');
    fly(s, 0, 'tokyo', 'sanfrancisco', 'b707');
    fly(s, 0, 'tokyo', 'hongkong', 'b707');
    s.companies[0].branches.push('london');
    return s;
  }

  it('지금 단계를 이루면 그 달에 표시하고 이야기 소식을 낸다 (한 달에 여러 단계도)', () => {
    const s = clone(start('jetage'));
    s.companies[0].planes.push(plane('b707'), plane('b707'));
    let r = scenarioMonthEnd(s, s.t);
    expect(r.result).toBeNull();
    expect(r.state.scenario!.done).toEqual([s.t, null, null]);
    expect(r.state.news.at(-1)!.title).toContain('1단계');
    expect(r.state.news.at(-1)!.text).toBe(SCENARIO.jetage.stages[0].story);
    // 이미 이룬 단계는 다시 알리지 않는다
    const again = scenarioMonthEnd(r.state, s.t + 1);
    expect(again.state.scenario!.done).toEqual([s.t, null, null]);
    expect(again.state.news.length).toBe(r.state.news.length);
    // 2단계(4,000km 넘는 노선 2개 + 4지역)까지 한꺼번에
    const t2 = jetReady();
    r = scenarioMonthEnd(t2, t2.t + 2);
    expect(r.state.scenario!.done).toEqual([t2.t + 2, null, null]);
    fly(t2, 0, 'tokyo', 'bangkok', 'caravelle');
    t2.companies[0].routes.at(-1)!.b = 'delhi';
    t2.companies[0].branches.push('delhi');
    expect(goalStatus(t2, 0, { kind: 'regions', n: 4 }).ok).toBe(true);
    r = scenarioMonthEnd(t2, t2.t + 2);
    expect(r.state.scenario!.done).toEqual([t2.t + 2, t2.t + 2, null]);
    expect(r.result).toBeNull();
  });

  it('마지막 단계를 이루면 성공: 빨리 + 덤 목표면 별 셋, 늦고 덤이 없으면 별 하나', () => {
    const def = SCENARIO.oilshock;
    const base = clone(start('oilshock'));
    base.scenario!.done = [base.t, base.t, null];
    const me = base.companies[0];
    me.debt = 0;
    me.cash = 50000;
    // 1등이 되도록 돈이 많고, 기름 먹는 비행기는 아직 있다
    let r = scenarioMonthEnd(clone(base), fastOf(def));
    expect(r.result).toEqual({ winners: [0], reason: expect.stringContaining('해냈어요'), success: true });
    expect(r.state.scenario!.stars).toBe(2);
    expect(r.state.scenario!.bonus).toBe(false);
    expect(r.state.scenario!.done[2]).toBe(fastOf(def));
    r = scenarioMonthEnd(clone(base), fastOf(def) + 1);
    expect(r.state.scenario!.stars).toBe(1);
    // 기름 먹는 비행기를 모두 정리하면 덤 별
    const tidy = clone(base);
    tidy.companies[0].planes = tidy.companies[0].planes.filter((p) => !planeKindOf(MODEL[p.model], 'thirsty'));
    r = scenarioMonthEnd(tidy, fastOf(def) - 5);
    expect(r.state.scenario!.stars).toBe(3);
    expect(r.state.scenario!.bonus).toBe(true);
    expect(starsFor(def, fastOf(def) + 1, true)).toBe(2);
    expect(starText(2)).toBe('★★☆');
  });

  it('기한이 지나면 실패(별 0), 회사가 운항을 멈추면 바로 실패', () => {
    const s = clone(start('jumbo'));
    let r = scenarioMonthEnd(s, s.scenario!.deadline - 1);
    expect(r.result).toBeNull();
    r = scenarioMonthEnd(s, s.scenario!.deadline);
    expect(r.result).toEqual({ winners: [], reason: expect.stringContaining('기한'), success: false });
    expect(r.state.scenario!.stars).toBe(0);
    const out = clone(start('jumbo'));
    out.companies[0].out = true;
    r = scenarioMonthEnd(out, out.t);
    expect(r.result?.success).toBe(false);
    expect(r.result?.reason).toContain('운항');
  });

  it('실제 달 결산에서도 단계를 살핀다 (모두 이번 달을 마치면)', () => {
    let s = clone(start('jetage'));
    s.companies[0].planes.push(plane('b707', [], s.t - 12), plane('caravelle', [], s.t - 12));
    const t0 = s.t;
    const rng = seededRandom(3);
    while (s.t === t0) s = s.companies[actor(s)].kind === 'human' ? applyAction(s, { type: 'endTurn' }, rng) : aiTurn(s, rng);
    expect(s.scenario!.done[0]).toBe(t0);
    expect(s.phase).toBe('manage');
  });
});

describe('저장', () => {
  it('예전 저장(시나리오 값 없음)도 그대로 읽고, 저장 판 번호는 4판 그대로', () => {
    const s = createGame({ ...setup(null), options: { ...setup(null).options, mode: 'years' } }, seededRandom(2));
    expect(s.version).toBe(4);
    const raw = clone({ setup: setup(null), state: s, savedAt: NOW }) as unknown as { state: Record<string, unknown>; setup: { options: Record<string, unknown> } };
    delete raw.state.scenario;
    delete (raw.state.options as Record<string, unknown>).scenario;
    delete raw.setup.options.scenario;
    const back = parseSaved(raw);
    expect(back).not.toBeNull();
    expect(back!.state.scenario).toBeUndefined();
    expect('scenario' in back!.state.options).toBe(false);
    expect(parseOptions({ mode: 'scenario', scenario: 'jetage' })).toMatchObject({ mode: 'scenario', scenario: 'jetage' });
    expect('scenario' in parseOptions({ mode: 'years', scenario: 'nope' })).toBe(false);
  });

  it('망가진 시나리오 진행은 저장을 버린다', () => {
    const s = start('cargo');
    expect(isValidScenarioState(s)).toBe(true);
    const bad = (patch: Record<string, unknown>) => ({ ...s, scenario: { ...s.scenario!, ...patch } }) as AirlineState;
    expect(isValidScenarioState(bad({ id: 'nope' }))).toBe(false);
    expect(isValidScenarioState(bad({ done: [null] }))).toBe(false);
    expect(isValidScenarioState(bad({ done: [null, 5, null] }))).toBe(false);
    expect(isValidScenarioState(bad({ company: 9 }))).toBe(false);
    expect(isValidScenarioState(bad({ stars: 4 }))).toBe(false);
    expect(parseSaved(clone({ setup: setup('cargo'), state: bad({ deadline: 'soon' }), savedAt: NOW }))).toBeNull();
  });

  describe('가장 좋은 기록 (family-boardgame.airline.scenarios.v1)', () => {
    const ended = (id: string, success: boolean, stars: number, months: number, kind: SeatKind = 'human'): AirlineState => {
      const s = clone(start(id, kind));
      s.phase = 'gameover';
      s.t = s.startT + months - 1;
      s.result = { winners: success ? [0] : [], reason: '끝', success };
      s.scenario = { ...s.scenario!, stars, bonus: stars === 3 };
      s.nextLogId += months * 7 + stars;
      return s;
    };

    it('성공·실패를 세고 더 좋은 기록(별이 많거나 같은 별에서 빨리)만 바꾼다, 같은 끝은 한 번만', () => {
      let st = emptyScenarioStore();
      st = addScenarioResult(st, ended('jetage', false, 0, 96), NOW);
      expect(st.best.jetage).toEqual({ stars: 0, months: null, plays: 1, wins: 0, at: NOW });
      const win = ended('jetage', true, 2, 60);
      st = addScenarioResult(st, win, NOW + 1);
      expect(st.best.jetage).toMatchObject({ stars: 2, months: 60, plays: 2, wins: 1 });
      expect(addScenarioResult(st, win, NOW + 2)).toBe(st);
      st = addScenarioResult(st, ended('jetage', true, 2, 70), NOW + 3);
      expect(st.best.jetage).toMatchObject({ stars: 2, months: 60, plays: 3, wins: 2, at: NOW + 1 });
      st = addScenarioResult(st, ended('jetage', true, 2, 50), NOW + 4);
      expect(st.best.jetage).toMatchObject({ stars: 2, months: 50, at: NOW + 4 });
      st = addScenarioResult(st, ended('jetage', true, 3, 80), NOW + 5);
      expect(st.best.jetage).toMatchObject({ stars: 3, months: 80, plays: 5, wins: 4 });
      // 컴퓨터끼리 한 판은 세지 않는다
      expect(addScenarioResult(st, ended('cargo', true, 3, 50, 'ai-normal'), NOW)).toBe(st);
      // 끝나지 않은 판도
      expect(addScenarioResult(st, start('cargo'), NOW)).toBe(st);
    });

    it('저장된 기록을 꼼꼼히 읽는다 (모르는 시나리오·망가진 값은 버린다)', () => {
      expect(parseScenarioStore(null)).toEqual(emptyScenarioStore());
      expect(parseScenarioStore({ v: 2, best: {} })).toEqual(emptyScenarioStore());
      const got = parseScenarioStore({
        v: 1,
        best: {
          jetage: { stars: 2, months: 40, plays: 3, wins: 1, at: NOW },
          nope: { stars: 3, months: 10, plays: 1, wins: 1, at: NOW },
          cargo: { stars: 5, months: 10, plays: 1, wins: 1, at: NOW },
          jumbo: { stars: 2, months: null, plays: 1, wins: 1, at: NOW },
          dereg: { stars: 1, months: 30, plays: 1, wins: 2, at: NOW },
          oilshock: { stars: 0, months: 30, plays: 2, wins: 0, at: NOW },
        },
        seen: ['abc123', 'abc123', 'BAD KEY', 7],
      });
      expect(Object.keys(got.best).sort()).toEqual(['jetage', 'oilshock']);
      expect(got.best.oilshock.months).toBeNull();
      expect(got.seen).toEqual(['abc123']);
    });

    describe('localStorage', () => {
      let mem: Map<string, string>;
      beforeEach(() => {
        mem = new Map();
        (globalThis as unknown as { window: unknown }).window = {
          localStorage: {
            getItem: (k: string) => mem.get(k) ?? null,
            setItem: (k: string, v: string) => void mem.set(k, v),
            removeItem: (k: string) => void mem.delete(k),
          },
        };
        resetScenarioStore();
      });
      afterEach(() => {
        delete (globalThis as unknown as { window?: unknown }).window;
      });

      it('게임 저장과 따로 이 열쇠에 남고, 망가진 값은 빈 기록으로 읽는다', () => {
        expect(SCENARIO_STORE_KEY).toBe('family-boardgame.airline.scenarios.v1');
        recordScenarioEnd(ended('lccboom', true, 3, 55), NOW);
        recordScenarioEnd(ended('lccboom', true, 3, 55), NOW + 1);
        expect(loadScenarioStore().best.lccboom).toMatchObject({ stars: 3, months: 55, plays: 1, wins: 1 });
        expect(mem.has('family-boardgame.airline.save.v1')).toBe(false);
        resetScenarioStore();
        expect(mem.has(SCENARIO_STORE_KEY)).toBe(false);
        mem.set(SCENARIO_STORE_KEY, '{oops');
        expect(loadScenarioStore()).toEqual(emptyScenarioStore());
      });
    });
  });
});

describe('업적·명예의 전당', () => {
  const won = (id: string): AirlineState => {
    const s = clone(start(id));
    s.phase = 'gameover';
    s.result = { winners: [0], reason: '성공', success: true };
    s.scenario = { ...s.scenario!, done: s.scenario!.done.map(() => s.t), stars: 2, bonus: false };
    return s;
  };

  it('시나리오 성공은 도전 과제·우승과 따로 센다 (역사 속으로 배지)', () => {
    expect(ACHIEVEMENTS.length).toBeLessThanOrEqual(40);
    const r = checkAchievements(won('jetage'), emptyAchStore(), NOW);
    const ids = r.unlocks.map((u) => u.id);
    expect(ids).toContain('scenario-one');
    expect(ids).not.toContain('first-win');
    expect(ids).not.toContain('challenge-one');
    expect(r.store.progress.scenarios).toEqual(['jetage']);
    expect(r.store.progress.challenges).toEqual([]);
    // 실패한 시나리오는 세지 않는다
    const lost = { ...won('jetage'), result: { winners: [], reason: '실패', success: false } };
    expect(checkAchievements(lost, emptyAchStore(), NOW).unlocks.map((u) => u.id)).not.toContain('scenario-one');
  });

  it('모든 시나리오를 성공하면 하늘길 역사가, 진행은 저장에서 꼼꼼히 읽는다', () => {
    const others = SCENARIOS.map((d) => d.id).filter((id) => id !== 'cargo');
    const store = { ...emptyAchStore(), progress: { eras: [], challenges: [], scenarios: others, games: 6 } };
    const ids = checkAchievements(won('cargo'), store, NOW).unlocks.map((u) => u.id);
    expect(ids).toContain('scenario-all');
    expect(parseAchStore({ v: 1, items: {}, progress: { eras: [], challenges: [], scenarios: ['cargo', 'nope', 'jetage', 'cargo'], games: 1 }, seen: [] }).progress.scenarios).toEqual(['jetage', 'cargo']);
    // 시나리오를 하나도 안 했으면 예전과 같은 모양
    expect(parseAchStore({ v: 1, items: {}, progress: { eras: [], challenges: [], games: 1 }, seen: [] }).progress).toEqual({ eras: [], challenges: [], games: 1 });
  });

  it('명예의 전당은 시나리오 이름과 성공을 남긴다', () => {
    const s = won('openskies');
    s.companies[0].cash = 9000;
    const r = recordGameEnd(emptyHof(), s, NOW);
    expect(r.hof.games[0]).toMatchObject({ mode: 'scenario', scenario: 'openskies', challenge: null, won: true });
    expect(parseHof(clone(r.hof)).games[0].scenario).toBe('openskies');
  });
});

describe('컴퓨터가 시나리오 회사를 맡아도 끝까지', () => {
  for (const def of SCENARIOS) {
    it(`${def.emoji} ${def.title}: 컴퓨터끼리 끝까지 (1단계는 이루고, 첫 몇 달에 끝나지 않는다)`, () => {
      const rng = seededRandom(startOf(def));
      let s = createGame(setup(def.id, 'ai-normal'), rng);
      let worst = 0;
      let guard = 0;
      while (s.phase !== 'gameover' && guard++ < 3000) {
        const t0 = performance.now();
        s = aiTurn(s, rng);
        worst = Math.max(worst, performance.now() - t0);
      }
      expect(s.phase).toBe('gameover');
      expect(s.result).not.toBeNull();
      const p = s.scenario!;
      expect(p.done[0], '1단계').not.toBeNull();
      expect(p.stars).toBeGreaterThanOrEqual(0);
      if (s.result!.success) {
        expect(p.done.every((d) => d !== null)).toBe(true);
        expect(p.stars).toBe(starsFor(def, p.done.at(-1)!, !!p.bonus));
        expect(s.t - s.startT, '너무 빨리 끝나지 않는다').toBeGreaterThanOrEqual(24);
      } else {
        expect(s.t).toBeLessThanOrEqual(p.deadline);
      }
      for (let i = 0; i < s.companies.length; i++) expect(Number.isFinite(companyValue(s, i))).toBe(true);
      // 컴퓨터 한 차례가 화면을 멈추지 않는다 (함께 돌리는 테스트 때문에 튀는 것을 넉넉히 봐준다)
      expect(worst).toBeLessThan(600);
    }, 120000);
  }
});
