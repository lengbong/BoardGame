import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL } from './aircraft';
import { Planner, aiManage, aiTurn } from './ai';
import { aiRivals, fareBounds, mealFor, modelTaste, newRoutesFor, reserveMult, rivalWeights, usedAgeFor } from './aiPersonality';
import { allianceOf } from './alliances';
import { defaultCabin } from './cabin';
import { allianceScore } from './choices';
import { pairKey } from './cities';
import { PERSONA, PERSONA_IDS, assignPersonas, personaOf, quoteOf, QUOTES } from './personality';
import {
  REL_BANDS,
  TRUCE_MONTHS,
  VISIT_GAP,
  allianceMood,
  emptyBook,
  isValidRivalsState,
  notesFor,
  relBand,
  relOf,
  rivalsMonth,
  sharedRoutes,
  truceBlocker,
  truceOn,
  truceOutlook,
  visitBlocker,
  visitCost,
} from './relations';
import { actor, allianceOutlook, applyAction, createGame, runMonth } from './rules';
import { isValidState, parseOptions, parseSaved } from './storage';
import { defaultTimes } from './timetable';
import type { AirlineAction, AirlineOptions, AirlineSetup, AirlineState, SeatKind } from './types';
import type { PersonaId } from './rivalTypes';

function setup(kinds: SeatKind[], options: Partial<AirlineOptions> = {}, hubs: (string | null)[] = ['seoul', 'tokyo', 'london', 'newyork']): AirlineSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as AirlineSetup['seats'],
    options: { era: 2003, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'normal', names: 'fictional', ...options },
    hubs: [0, 1, 2, 3].map((i) => hubs[i] ?? null),
    airlines: [null, null, null, null],
  };
}

/** 사람(0)과 컴퓨터들이 있는 판. 성격은 정해 준 대로 장부에 적는다 */
function game(personas: (PersonaId | null)[] = [null, 'saver', 'expander'], options: Partial<AirlineOptions> = {}): AirlineState {
  const kinds: SeatKind[] = personas.map((p, i) => (i === 0 ? 'human' : p ? 'ai-normal' : 'empty'));
  const s = createGame(setup(kinds, options), seededRandom(3));
  s.rivals = emptyBook(s);
  personas.forEach((p, i) => (s.rivals!.persona[i] = i === 0 ? null : p));
  return s;
}

/** 이 회사 차례로 */
function turnOf(s: AirlineState, ci: number): AirlineState {
  return { ...s, turnPos: s.order.indexOf(ci) };
}

function act(s: AirlineState, ...actions: AirlineAction[]): AirlineState {
  for (const a of actions) {
    const next = applyAction(s, a, seededRandom(5));
    expect(next, JSON.stringify(a)).not.toBe(s);
    s = next;
  }
  return s;
}

/** 노선과 비행기를 바로 넣는다 (since: 연 달) */
function addRoute(s: AirlineState, ci: number, a: string, b: string, fare = 0, since = s.t - 3, model = 'a320', freq = 14): number {
  // 회사는 새 객체로 바꾼다 (노선 찾기 캐시가 회사 객체마다 있다)
  const c = s.companies[ci];
  const rid = s.nextId++;
  const pid = s.nextId++;
  s.companies[ci] = {
    ...c,
    branches: [...c.branches, ...[a, b].filter((city, k, arr) => !c.branches.includes(city) && arr.indexOf(city) === k)],
    routes: [...c.routes, { id: rid, a, b, fare, since, stats: null, times: defaultTimes(a, b, 2003) }],
    planes: [...c.planes, { id: pid, model, leased: true, rent: 3, deposit: 0, since: s.t, legs: [{ route: rid, freq }], cabin: defaultCabin(MODEL[model]), meal: 3, cond: 80 }],
  };
  return rid;
}

const rng = () => seededRandom(11);

/** aiRivals에 넘길 작은 경영자 (그 회사 차례로) */
function planner(s0: AirlineState, ci: number) {
  return {
    s: turnOf(s0, ci),
    ci,
    normal: true,
    planning: true,
    get c() {
      return this.s.companies[ci];
    },
    act(a: AirlineAction) {
      const n = applyAction(this.s, a);
      if (n === this.s) return false;
      this.s = n;
      return true;
    },
  };
}

describe('경영진 성격 나누기', () => {
  it('같은 판이면 늘 같은 성격, 컴퓨터끼리 겹치지 않고 사람은 성격이 없다', () => {
    const a = createGame(setup(['human', 'ai-normal', 'ai-normal', 'ai-normal']), seededRandom(1));
    const b = createGame(setup(['human', 'ai-normal', 'ai-normal', 'ai-normal']), seededRandom(1));
    const pa = a.companies.map((_, i) => personaOf(a, i));
    expect(pa).toEqual(b.companies.map((_, i) => personaOf(b, i)));
    expect(pa[0]).toBeNull();
    const ai = pa.slice(1);
    expect(new Set(ai).size).toBe(3);
    for (const p of ai) expect(PERSONA_IDS).toContain(p);
    // 결산하면 장부에 그대로 적힌다
    const s = runMonth(a, rng());
    expect(s.rivals!.persona).toEqual(pa);
  });

  it('판(회사 이름·본사)이 달라지면 성격 조합도 여러 가지가 나온다', () => {
    const seen = new Set<string>();
    const hubsList = [
      ['seoul', 'tokyo', 'london', 'newyork'],
      ['paris', 'dubai', 'sydney', 'chicago'],
      ['beijing', 'frankfurt', 'singapore', 'miami'],
      ['madrid', 'toronto', 'bangkok', 'cairo'],
      ['rome', 'delhi', 'osaka', 'saopaulo'],
    ];
    for (const hubs of hubsList) {
      const s = createGame(setup(['ai-normal', 'ai-normal', 'ai-normal', 'ai-normal'], {}, hubs), seededRandom(2));
      const ps = s.companies.map((_, i) => personaOf(s, i));
      expect(new Set(ps).size).toBe(4);
      seen.add(ps.join(','));
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });

  it('저가항공은 서비스 장인·허브 전략가가 되지 않고, 성격을 끈 판에서는 아무도 성격이 없다', () => {
    for (let k = 0; k < 12; k++) {
      const s = createGame(setup(['ai-normal', 'ai-normal', 'ai-normal', 'ai-normal'], {}, [['seoul', 'tokyo', 'london', 'newyork'], ['paris', 'dubai', 'sydney', 'chicago'], ['rome', 'delhi', 'osaka', 'miami']][k % 3]), seededRandom(k));
      const companies = s.companies.map((c) => ({ ...c, bizModel: 'lcc' as const }));
      const ps = assignPersonas({ startT: s.startT + k, companies });
      for (const p of ps) expect(p === 'service' || p === 'hub').toBe(false);
    }
    const off = createGame(setup(['human', 'ai-normal', 'ai-normal'], { personas: false }), seededRandom(1));
    expect(off.companies.map((_, i) => personaOf(off, i))).toEqual([null, null, null]);
    const after = runMonth(off, rng());
    expect(after.rivals).toBeUndefined();
  });

  it('성격마다 이름·동물·한마디가 있고, 한마디에는 사람 이름이 없으며 실제 항공사면 게임 속 이야기라고 밝힌다', () => {
    for (const id of PERSONA_IDS) {
      expect(PERSONA[id].name.length).toBeGreaterThan(2);
      expect(PERSONA[id].animal.length).toBeGreaterThan(0);
      for (const q of Object.values(QUOTES[id])) expect(q).toMatch(/요[.!?…]?$|요!$/);
    }
    const s = game([null, 'fare']);
    expect(quoteOf(s, 1, 'gift')).not.toContain('게임 속 이야기');
    s.companies[1].airline = 'KE';
    expect(quoteOf(s, 1, 'gift')).toContain('(게임 속 이야기)');
  });
});

describe('성격에 따라 다르게 경영한다', () => {
  it('손잡이: 운임 바닥·천장, 기내식, 중고 비행기, 남기는 돈, 라이벌 노선을 꺼리는 정도, 기종 크기', () => {
    const s = game([null, 'service', 'fare', 'saver']);
    expect(fareBounds(s, 1, -25, 25)[0]).toBeGreaterThan(fareBounds(s, 3, -25, 25)[0]);
    expect(fareBounds(s, 3, -25, 25)[0]).toBeGreaterThan(fareBounds(s, 2, -25, 25)[0]);
    expect(mealFor(s, 1, 3)).toBe(4);
    expect(mealFor(s, 3, 3)).toBe(2);
    expect(usedAgeFor(s, 1)).toBe(-1);
    expect(usedAgeFor(s, 3)).toBeGreaterThan(14);
    expect(reserveMult(s, 3)).toBeGreaterThan(reserveMult(s, 2));
    expect(modelTaste(s, 2, MODEL['b747-400'])).toBeLessThan(1);
    expect(modelTaste(s, 1, MODEL['b747-400'])).toBeGreaterThan(1);
    // 사람 회사·성격이 없으면 예전 값 그대로
    expect(fareBounds(s, 0, -25, 25)).toEqual([-25, 25]);
    expect(rivalWeights(s, 0)).toEqual(s.companies.map(() => 0.6));
    expect(newRoutesFor(s, 0, 2)).toBe(2);
    // 확장가는 돈이 넉넉하면 세 분기에 한 번쯤 노선 하나를 더 연다 (돈이 모자라면 그대로)
    s.rivals!.persona[2] = 'expander';
    let extra = 0;
    for (let k = 0; k < 30; k++) extra += newRoutesFor({ ...s, q: s.q + k }, 2, 2) - 2;
    expect(extra).toBeGreaterThanOrEqual(9);
    expect(extra).toBeLessThanOrEqual(11);
    for (let k = 0; k < 6; k++) expect(newRoutesFor({ ...s, q: s.q + k }, 2, 2, s.companies[2].cash)).toBe(2);
    expect(newRoutesFor({ ...s, q: s.q }, 2, 0)).toBe(0);
    // 사이가 아주 나쁘면 확장가는 그 회사 노선에 끌리고(되갚기), 사이가 좋으면 더 피한다
    s.rivals!.rel[2][0] = -80;
    expect(rivalWeights(s, 2)[0]).toBeLessThan(0);
    s.rivals!.rel[2][0] = 60;
    expect(rivalWeights(s, 2)[0]).toBeCloseTo(PERSONA.expander.rivalW * 1.6, 6);
    // 살림꾼은 사이가 나빠도 노선으로 되갚지 않는다
    s.rivals!.rel[3][0] = -80;
    expect(rivalWeights(s, 3)[0]).toBe(PERSONA.saver.rivalW);
  });

  it('같은 상태에서 서비스 장인은 기내식을 살림꾼보다 좋게 하고, 살림꾼은 돈을 더 남긴다', () => {
    const base = game([null, 'saver', 'saver', 'saver']);
    // 계획하는 달인 컴퓨터를 고른다
    const ci = [1, 2, 3].find((i) => (base.t + i) % 3 === 0)!;
    addRoute(base, ci, base.companies[ci].hub, 'bangkok');
    addRoute(base, ci, base.companies[ci].hub, 'singapore');
    const meals = (p: PersonaId) => {
      const s = structuredClone(base);
      s.rivals!.persona[ci] = p;
      const out = aiManage(turnOf(s, ci), ci, 'ai-normal', rng());
      const flying = out.companies[ci].planes.filter((x) => x.legs.length > 0);
      return flying.reduce((sum, x) => sum + x.meal, 0) / Math.max(1, flying.length);
    };
    expect(meals('service')).toBeGreaterThanOrEqual(meals('saver') + 1.5);
  });

  it('두 해 자란 회사에서 살림꾼은 확장가보다 돈을 더 남긴다 (컴퓨터 성향 배수 위에 성격 배수)', () => {
    const r = seededRandom(21);
    let g = createGame(setup(['ai-normal', 'ai-normal']), r);
    while (g.t < g.startT + 24) g = aiTurn(g, r);
    const reserve = (p: PersonaId) => {
      const s = structuredClone(g);
      s.rivals!.persona[0] = p;
      return new Planner(s, 0, 'ai-normal', rng()).reserve();
    };
    expect(reserve('saver')).toBeGreaterThan(60);
    expect(reserve('saver') / reserve('expander')).toBeCloseTo(PERSONA.saver.reserve / PERSONA.expander.reserve, 6);
  });

  it('새 길 개척자는 라이벌이 나는 노선을 확장가보다 덜 고른다', () => {
    const base = game([null, 'pioneer', 'saver']);
    // 사람(서울)과 컴퓨터 2(런던)가 도쿄에서 나가는 큰 노선을 많이 난다
    // 라이벌들은 작은 비행기로 주 1회만, 비싸게 (그래도 손님이 많이 남는 큰 노선)
    for (const b of ['osaka', 'seoul', 'beijing', 'shanghai', 'hongkong', 'taipei', 'singapore', 'bangkok']) {
      addRoute(base, 0, 'tokyo', b, 30, base.t - 3, 'b737-800', 1);
      addRoute(base, 2, 'tokyo', b, 30, base.t - 3, 'b737-800', 1);
    }
    // 라이벌이 나는 노선 가운데 가장 앞선 것의 순위 (개척자는 더 뒤로 미룬다)
    const firstRival = (p: PersonaId) => {
      const s = structuredClone(base);
      s.rivals!.persona[1] = p;
      const cands = new Planner(s, 1, 'ai-normal', rng()).bestCandidates(10);
      const k = cands.findIndex((x) => s.companies[0].routes.some((r) => pairKey(r.a, r.b) === pairKey(x.a, x.b)));
      return k < 0 ? 99 : k;
    };
    expect(firstRival('pioneer')).toBeGreaterThan(firstRival('expander'));
    // 성격이 없으면(사람에게 보여 주는 추천 노선) 예전 그대로: 사람 회사로 셈하면 성격 손잡이가 없다
    expect(rivalWeights(base, 0)).toEqual(base.companies.map(() => 0.6));
  });

  it('운임 승부사는 사이가 아주 나쁜 라이벌보다 싸게 팔고, 휴전 중인 노선은 건드리지 않는다', () => {
    const s0 = game([null, 'fare']);
    const ci = 1;
    const mine = addRoute(s0, ci, 'tokyo', 'hongkong', 0);
    addRoute(s0, 0, 'tokyo', 'hongkong', -10);
    s0.rivals!.rel[1][0] = -80;
    const pl = planner(s0, ci);
    aiRivals(pl);
    expect(pl.s.companies[ci].routes.find((r) => r.id === mine)!.fare).toBe(-15);
    // 휴전이 있으면 그대로
    const s = structuredClone(s0);
    s.rivals!.truces.push({ a: 1, b: 0, key: pairKey('tokyo', 'hongkong'), since: s.t, until: s.t + 6, floorA: 0, floorB: -10 });
    const pl2 = planner(s, ci);
    aiRivals(pl2);
    expect(pl2.s.companies[ci].routes.find((r) => r.id === mine)!.fare).toBe(0);
    // 다른 성격은 운임 다툼을 하지 않는다
    const calm = structuredClone(s0);
    calm.rivals!.persona[1] = 'service';
    const pl3 = planner(calm, ci);
    aiRivals(pl3);
    expect(pl3.s.companies[ci].routes.find((r) => r.id === mine)!.fare).toBe(0);
  });
});

describe('사이가 움직이는 일', () => {
  it('허브 전략가의 본사 노선에 들어가면 크게 서운해하고 까닭이 남는다', () => {
    const s = game([null, 'hub']);
    addRoute(s, 1, 'tokyo', 'osaka', 0, s.t - 5);
    addRoute(s, 0, 'tokyo', 'osaka', 0, s.t);
    const after = runMonth(s, rng());
    expect(relOf(after, 1, 0)).toBe(-10);
    expect(notesFor(after, 1, 0)[0].text).toContain('본사 노선');
  });

  it('같은 노선에서 10%p 넘게 싸게 팔면 서운해하고, 서비스 장인은 운임 승부사보다 덜 서운해한다', () => {
    const run = (p: PersonaId) => {
      const s = game([null, p]);
      addRoute(s, 1, 'tokyo', 'osaka', 10);
      addRoute(s, 0, 'tokyo', 'osaka', -15);
      return relOf(runMonth(s, rng()), 1, 0);
    };
    expect(run('service')).toBeLessThan(0);
    expect(run('fare')).toBeLessThan(run('service'));
  });

  it('주식을 사면 살림꾼은 반기고 확장가는 경계한다', () => {
    let s = game([null, 'saver', 'expander']);
    s = runMonth(s, rng());
    s = turnOf(s, 0);
    s.companies[0].cash = 99999;
    s = act(s, { type: 'buyStake', company: 1, pct: 10 }, { type: 'buyStake', company: 2, pct: 10 }, { type: 'endTurn' });
    while (actor(s) !== 0 && s.phase === 'manage') s = applyAction(s, { type: 'endTurn' }, rng());
    expect(relOf(s, 1, 0)).toBeGreaterThan(0);
    expect(relOf(s, 2, 0)).toBeLessThan(0);
  });

  it('같은 동맹이 되면 +10, 그 뒤 달마다 조금씩 좋아지고, 동맹이 없으면 보통 쪽으로 돌아간다', () => {
    let s = game([null, 'pioneer', 'saver']);
    s = runMonth(s, rng());
    s.alliances = [{ id: 999, name: '하늘별 동맹', members: [0, 1], since: s.t }];
    s.rivals!.rel[2][0] = 50;
    s = runMonth(s, rng());
    expect(relOf(s, 1, 0)).toBeGreaterThan(12);
    expect(notesFor(s, 1, 0)[0].text).toContain('동맹');
    expect(relOf(s, 2, 0)).toBeLessThan(50);
    expect(relOf(s, 2, 0)).toBeGreaterThan(45);
  });

  it('연말 시상식: 서비스 장인은 서비스상을 받은 회사를 존경한다', () => {
    let s = game([null, 'service']);
    while ((s.t % 12) !== 11) s = runMonth(s, rng());
    s.awards = [{ year: Math.floor(s.t / 12), items: [{ kind: 'service', company: 0, value: 80, text: '평판 80' }] }];
    const before = relOf(s, 1, 0);
    // rivalsMonth만 따로 (runMonth는 시상식을 새로 정한다)
    const after = rivalsMonth(s, s.t);
    expect(relOf(after, 1, 0)).toBeGreaterThan(before * 0.96 + 5);
  });

  it('사이 말이 바뀌면 사람에게 한마디 소식 (오르내림이 잦지 않게 경계에서 조금 지나야)', () => {
    let s = game([null, 'saver']);
    s.companies[1].airline = 'KE';
    s.rivals!.rel[1][0] = 40;
    // 지난번에 알린 말은 '보통'
    s.rivals!.said = s.companies.map(() => s.companies.map(() => 2));
    s = runMonth(s, rng());
    const news = s.news.filter((n) => n.for?.includes(0) && n.company === 1);
    expect(news.length).toBe(1);
    expect(news[0].title).toContain('사이가 좋아졌어요');
    expect(news[0].text).toContain('게임 속 이야기');
    // 한 번 알린 뒤에는 같은 칸 안에서 오르내려도 다시 알리지 않는다
    const n0 = s.news.length;
    s = runMonth(s, rng());
    expect(s.news.slice(n0).filter((n) => n.company === 1 && n.title.includes('사이')).length).toBe(0);
    expect(REL_BANDS[relBand(relOf(s, 1, 0))].word).toBe('사이좋음');
  });
});

describe('외교: 인사 방문·휴전', () => {
  it('인사 방문은 돈이 들고 사이가 오르며, 여섯 달에 한 번이고 이유를 알려 준다', () => {
    let s = turnOf(game([null, 'saver', 'fare']), 0);
    const cost = visitCost(s, 0);
    const cash = s.companies[0].cash;
    s = act(s, { type: 'rivalVisit', to: 1 });
    expect(s.companies[0].cash).toBeCloseTo(cash - cost, 6);
    expect(relOf(s, 1, 0)).toBe(12.5);
    expect(visitBlocker(s, 0, 1)).toContain(`${VISIT_GAP}달 뒤`);
    expect(applyAction(s, { type: 'rivalVisit', to: 1 })).toBe(s);
    // 다른 회사는 따로
    expect(visitBlocker(s, 0, 2)).toBeNull();
    s.companies[0].cash = 1;
    expect(visitBlocker(s, 0, 2)).toContain('돈이 모자라요');
    expect(visitBlocker(s, 0, 0)).toContain('라이벌');
    const off = turnOf(createGame(setup(['human', 'ai-normal'], { personas: false }), seededRandom(1)), 0);
    expect(visitBlocker(off, 0, 1)).toContain('끈 판');
    expect(s.log.at(-1)!.text).toContain('인사 방문');
  });

  it('휴전: 함께 나는 노선이 있어야 하고, 살림꾼은 받아들이고 운임 승부사는 거절한다', () => {
    let s = turnOf(game([null, 'saver', 'fare']), 0);
    expect(truceBlocker(s, 0, 1, 1)).toContain('함께 나는 노선');
    const r1 = addRoute(s, 0, 'tokyo', 'osaka', -5);
    addRoute(s, 1, 'tokyo', 'osaka', 0);
    const r2 = addRoute(s, 0, 'seoul', 'beijing', 0);
    addRoute(s, 2, 'seoul', 'beijing', 0);
    expect(sharedRoutes(s, 0, 1).map((x) => x.mine.id)).toEqual([r1]);
    expect(truceOutlook(s, 0, 1, pairKey('tokyo', 'osaka'))).toBe('yes');
    expect(truceOutlook(s, 0, 2, pairKey('seoul', 'beijing'))).toBe('no');
    s = act(s, { type: 'rivalTruce', to: 1, route: r1 }, { type: 'rivalTruce', to: 2, route: r2 });
    const tr = truceOn(s, 0, 1, pairKey('tokyo', 'osaka'))!;
    expect(tr).toBeTruthy();
    expect(tr.until).toBe(s.t + TRUCE_MONTHS);
    expect([tr.floorA, tr.floorB]).toEqual([0, -5]);
    expect(truceOn(s, 0, 2, pairKey('seoul', 'beijing'))).toBeUndefined();
    expect(relOf(s, 1, 0)).toBeGreaterThan(0);
    // 거절당하면 석 달 기다린다
    expect(truceBlocker(s, 0, 2, r2)).toContain('달 뒤에');
    expect(truceBlocker(s, 0, 1, r1)).toContain('이미 휴전');
    // 사이가 아주 나쁘면 만나 주지 않는다
    s.rivals!.ask[0][2] = -999;
    s.rivals!.rel[2][0] = -70;
    expect(truceBlocker(s, 0, 2, r2)).toContain('껄끄러워요');
  });

  it('휴전 중에는 두 회사 모두 일반석 운임을 휴전 때보다 내릴 수 없고, 올리기·다른 등급은 된다. 끝까지 지키면 고마워한다', () => {
    let s = turnOf(game([null, 'saver']), 0);
    const mine = addRoute(s, 0, 'tokyo', 'osaka', -5);
    const theirs = addRoute(s, 1, 'tokyo', 'osaka', 0);
    s = act(s, { type: 'rivalTruce', to: 1, route: mine });
    expect(applyAction(s, { type: 'setFare', route: mine, fare: -10 })).toBe(s);
    s = act(s, { type: 'setFare', route: mine, fare: 5 }, { type: 'setFare', route: mine, fare: -5 }, { type: 'setFare', route: mine, fare: -10, cls: 'c' });
    // 컴퓨터도 못 내린다
    const ai = turnOf(s, 1);
    expect(applyAction(ai, { type: 'setFare', route: theirs, fare: -5 })).toBe(ai);
    // 여섯 달이 지나면 끝나고 고맙다는 소식
    const start = s.t;
    for (let k = 0; k < TRUCE_MONTHS; k++) s = runMonth(s, rng());
    expect(s.t).toBe(start + TRUCE_MONTHS);
    expect(truceOn(s, 0, 1, pairKey('tokyo', 'osaka'))).toBeUndefined();
    expect(s.rivals!.truces.length).toBe(0);
    expect(s.news.some((n) => n.title.includes('끝까지 지켰어요') && n.for?.includes(0))).toBe(true);
    s = turnOf(s, 0);
    s = act(s, { type: 'setFare', route: mine, fare: -10 });
  });

  it('휴전을 먼저 끝내면 운임을 내릴 수 있지만 많이 서운해한다', () => {
    let s = turnOf(game([null, 'saver']), 0);
    const mine = addRoute(s, 0, 'tokyo', 'osaka', -5);
    addRoute(s, 1, 'tokyo', 'osaka', 0);
    s = act(s, { type: 'rivalTruce', to: 1, route: mine });
    const before = relOf(s, 1, 0);
    s = act(s, { type: 'rivalEndTruce', to: 1, key: pairKey('tokyo', 'osaka') }, { type: 'setFare', route: mine, fare: -20 });
    expect(relOf(s, 1, 0)).toBe(before - 20);
    expect(notesFor(s, 1, 0)[0].text).toContain('먼저 끝냈어요');
  });

  it('사이가 좋은 컴퓨터는 운임 다툼 중인 노선에서 먼저 휴전을 청하고, 받아들이면 휴전이 된다', () => {
    let s = game([null, 'saver']);
    const mine = addRoute(s, 0, 'tokyo', 'osaka', -20);
    addRoute(s, 1, 'tokyo', 'osaka', 0);
    s.rivals!.rel[1][0] = 70;
    let k = 0;
    while (!(s.rivals?.offers.length) && k++ < 12) s = runMonth(s, rng());
    const offer = s.rivals!.offers[0];
    expect(offer).toBeTruthy();
    expect(offer.from).toBe(1);
    expect(s.news.some((n) => n.title.includes('휴전 제안') && n.for?.includes(0))).toBe(true);
    s = turnOf(s, 0);
    s = act(s, { type: 'rivalAnswer', offer: offer.id, accept: true });
    expect(truceOn(s, 0, 1, offer.key)).toBeTruthy();
    expect(applyAction(s, { type: 'setFare', route: mine, fare: -25 })).toBe(s);
    expect(s.rivals!.offers.length).toBe(0);
  });

  it('거절하면 조금 서운해하고 제안이 사라진다', () => {
    let s = turnOf(game([null, 'pioneer']), 0);
    addRoute(s, 0, 'tokyo', 'osaka', -20);
    addRoute(s, 1, 'tokyo', 'osaka', 0);
    s.rivals!.offers.push({ id: 777, from: 1, to: 0, key: pairKey('tokyo', 'osaka'), until: s.t + 2 });
    s = act(s, { type: 'rivalAnswer', offer: 777, accept: false });
    expect(relOf(s, 1, 0)).toBeLessThan(0);
    expect(s.rivals!.offers.length).toBe(0);
    expect(applyAction(s, { type: 'rivalAnswer', offer: 777, accept: true })).toBe(s);
  });
});

describe('동맹과 사이', () => {
  it('사이가 좋으면 동맹 제안을 받아들이고, 나쁘면 거절한다 (점수 차이 = 사이 차이 ÷ 25)', () => {
    const base = turnOf(game([null, 'saver', 'fare']), 0);
    const good = structuredClone(base);
    good.rivals!.rel[1][0] = 80;
    const bad = structuredClone(base);
    bad.rivals!.rel[1][0] = -80;
    expect(allianceScore(good, 0, 1) - allianceScore(bad, 0, 1)).toBeCloseTo(160 / 25, 6);
    // 사이가 보통이면 예전 점수 그대로, 좋으면 사이 ÷ 25
    expect(allianceMood(base, 0, 1)).toBe(0);
    expect(allianceMood(good, 0, 1)).toBeCloseTo(80 / 25, 6);
    expect(allianceOutlook(good, 0, 1)).toBe('yes');
    expect(allianceOutlook(bad, 0, 1)).toBe('no');
    const g = act(good, { type: 'propose', to: 1 });
    expect(allianceOf(g, 0)?.members).toContain(1);
    const b = act(bad, { type: 'propose', to: 1 });
    expect(allianceOf(b, 0)).toBeNull();
    // 성격을 끈 판은 예전 점수 그대로
    const off = structuredClone(good);
    off.options = { ...off.options, personas: false };
    expect(allianceMood(off, 0, 1)).toBe(0);
  });
});

describe('저장', () => {
  it('예전 저장(라이벌 장부·설정 없음)도 그대로 읽고, 첫 결산에 성격을 정해 적는다', () => {
    const s = createGame(setup(['human', 'ai-normal', 'ai-normal']), seededRandom(4));
    const old = JSON.parse(JSON.stringify(s)) as AirlineState;
    delete old.rivals;
    delete (old.options as Partial<AirlineOptions>).personas;
    expect(isValidState(old)).toBe(true);
    const saved = parseSaved({ setup: setup(['human', 'ai-normal', 'ai-normal']), state: old });
    expect(saved).not.toBeNull();
    expect(parseOptions(old.options).personas).toBeUndefined();
    expect(personaOf(saved!.state, 1)).not.toBeNull();
    const next = runMonth(saved!.state, rng());
    expect(next.rivals!.persona).toEqual(assignPersonas(next));
    expect(isValidState(JSON.parse(JSON.stringify(next)))).toBe(true);
    expect(parseOptions({ ...old.options, personas: false }).personas).toBe(false);
  });

  it('망가진 라이벌 장부는 받지 않는다', () => {
    const s = runMonth(game([null, 'saver', 'fare']), rng());
    expect(isValidRivalsState(s)).toBe(true);
    const bad1 = structuredClone(s);
    bad1.rivals!.rel[1] = [0];
    expect(isValidRivalsState(bad1)).toBe(false);
    const bad2 = structuredClone(s);
    bad2.rivals!.rel[1][0] = 500;
    expect(isValidRivalsState(bad2)).toBe(false);
    const bad3 = structuredClone(s);
    (bad3.rivals!.persona as unknown[])[1] = 'boss';
    expect(isValidState(bad3)).toBe(false);
  });
});

describe('컴퓨터끼리 끝까지 (성격 켜기)', () => {
  it('성격이 다른 컴퓨터 넷이 10년을 끝까지: 멈추지 않고, 사이는 −100…100 안, 한 차례는 짧다', () => {
    for (const [seed, era, style] of [
      [7, 2003, 'fierce'],
      [8, 1983, 'relaxed'],
    ] as const) {
      const r = seededRandom(seed);
      let s = createGame(setup(['ai-normal', 'ai-normal', 'ai-normal', 'ai-easy'], { era, years: 10, aiStyle: style }, [null, null, null, null]), r);
      let worst = 0;
      let turns = 0;
      while (s.phase !== 'gameover' && turns < 3000) {
        const t0 = performance.now();
        s = aiTurn(s, r);
        worst = Math.max(worst, performance.now() - t0);
        turns++;
      }
      expect(s.phase).toBe('gameover');
      expect(s.result!.winners.length).toBeGreaterThan(0);
      // 처음 네 회사는 성격이 모두 다르다 (판 가운데 생긴 회사는 그때 날던 회사와 겹치지 않게 받는다)
      expect(new Set(s.rivals!.persona.slice(0, 4)).size).toBe(4);
      expect(s.rivals!.persona.length).toBe(s.companies.length);
      for (const row of s.rivals!.rel) for (const v of row) expect(Math.abs(v)).toBeLessThanOrEqual(100);
      // 사람이 없으면 까닭(사람에게 보여 줄 것)은 적지 않는다
      expect(s.rivals!.notes.length).toBe(0);
      expect(isValidState(JSON.parse(JSON.stringify(s)))).toBe(true);
      expect(worst).toBeLessThan(600);
    }
  }, 60000);
});
