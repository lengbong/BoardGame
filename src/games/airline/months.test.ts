import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { aiTurn } from './ai';
import { weather } from './calendar';
import { applyAction, autoStopReason, createGame, runMonth } from './rules';
import { computeMonth, groundingChance, opsRates, spareCover } from './simulate';
import { mOf } from './time';
import type { AirlineOptions, AirlineSetup, AirlineState, SeatKind } from './types';

function setup(kinds: SeatKind[], options: Partial<AirlineOptions> = {}, hubs: (string | null)[] = []): AirlineSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as AirlineSetup['seats'],
    options: { era: 2003, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'normal', names: 'fictional', ...options },
    hubs: [0, 1, 2, 3].map((i) => hubs[i] ?? null),
    airlines: [null, null, null, null],
  };
}

/** 서울에서 노선 하나 (비행기 나이와 횟수를 정해서) */
function withRoute(to: string, age = 0, freq = 14, model = 'a320'): { s: AirlineState; route: number } {
  const s = createGame(setup(['human', 'human'], {}, ['seoul', 'london']), seededRandom(1));
  const c = s.companies[0];
  c.branches.push(to);
  const route = s.nextId++;
  c.routes.push({ id: route, a: 'seoul', b: to, fare: 0, since: s.t, stats: null });
  c.planes.push({ id: s.nextId++, model, leased: false, rent: 0, deposit: 0, since: s.t - Math.round(age * 12), legs: [{ route, freq }] });
  return { s, route };
}

const at = (s: AirlineState, year: number, month: number): AirlineState => {
  const t = mOf(year, month);
  return { ...s, t, q: Math.floor(t / 3) };
};

describe('운항 현장 (지연·결항·회항·기체 점검)', () => {
  it('낡은 비행기·낮은 정비·태풍철에는 지연·결항이 늘고, 꼼꼼한 정비·예비 승무원·예비기는 줄인다', () => {
    const fresh = withRoute('taipei', 1);
    const old = withRoute('taipei', 22);
    const r0 = opsRates(at(fresh.s, 2005, 4), 0, fresh.route);
    const rOld = opsRates(at(old.s, 2005, 4), 0, old.route);
    expect(rOld.late).toBeGreaterThan(r0.late);
    expect(rOld.cancel).toBeGreaterThan(r0.cancel);
    // 태풍철 (8월) — 서울·타이베이 모두 태풍 도시
    const rAug = opsRates(at(fresh.s, 2005, 8), 0, fresh.route);
    expect(rAug.cancel).toBeGreaterThan(r0.cancel * 2);
    expect(rAug.cause).toBe('typhoon');
    expect(weather('taipei', 7).cause).toBe('typhoon');
    expect(weather('chicago', 0).cause).toBe('snow');
    expect(weather('mumbai', 6).cause).toBe('monsoon');
    expect(weather('london', 11).cause).toBe('fog');
    // 정비 수준
    const s = at(old.s, 2005, 4);
    const lo = { ...s, companies: s.companies.map((c, i) => (i === 0 ? { ...c, maint: 1 } : c)) };
    const hi = { ...s, companies: s.companies.map((c, i) => (i === 0 ? { ...c, maint: 5 } : c)) };
    expect(opsRates(hi, 0, old.route).cancel).toBeLessThan(opsRates(lo, 0, old.route).cancel);
    expect(opsRates(hi, 0, old.route).late).toBeLessThan(opsRates(lo, 0, old.route).late);
    expect(groundingChance(hi, hi.companies[0], hi.companies[0].planes[0])).toBeLessThan(groundingChance(lo, lo.companies[0], lo.companies[0].planes[0]));
    // 예비 승무원
    const crew0 = { ...s, companies: s.companies.map((c, i) => (i === 0 ? { ...c, crewReserve: 0 } : c)) };
    const crew2 = { ...s, companies: s.companies.map((c, i) => (i === 0 ? { ...c, crewReserve: 2 } : c)) };
    expect(opsRates(crew2, 0, old.route).late).toBeLessThan(opsRates(crew0, 0, old.route).late);
    // 예비기: 쉬는 비행기가 있으면 결항이 준다
    const spare = structuredClone(s);
    spare.companies[0].planes.push({ id: spare.nextId++, model: 'a320', leased: false, rent: 0, deposit: 0, since: spare.t, legs: [] });
    expect(spareCover(spare.companies[0])).toBeGreaterThan(0);
    expect(opsRates(spare, 0, old.route).cancel).toBeLessThan(opsRates(s, 0, old.route).cancel);
  });

  it('달마다 사건을 뽑으면 지연·결항이 생기고, 정시 운항률이 평판·손님에 닿는다 (어림은 사건 없이)', () => {
    const { s, route } = withRoute('tokyo', 18, 20, 'b737-800');
    let t = at(s, 2005, 8);
    // 사건 없이 셈하면 결항이 없다
    expect(computeMonth(t).reports[0].cancelled).toBe(0);
    const rng = seededRandom(9);
    let late = 0;
    let cancelled = 0;
    let flights = 0;
    for (let k = 0; k < 12; k++) {
      t = runMonth(t, rng);
      const r = t.report!.companies[0];
      late += r.late;
      cancelled += r.cancelled;
      flights += r.flights;
    }
    expect(flights).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(0);
    expect(cancelled).toBeGreaterThan(0);
    expect(late / flights).toBeLessThan(0.5);
    expect(cancelled / flights).toBeLessThan(0.2);
    const st = t.companies[0].routes.find((r) => r.id === route)!.stats!;
    expect(st.onTime).toBeGreaterThan(0.3);
    expect(st.onTime).toBeLessThanOrEqual(1);
    expect(t.companies[0].onTime).toBeLessThan(1);
    // 상황판: 이번 달 노선마다 사건 기록
    expect(t.ledger.some((l) => l.ops.length > 0 || l.companies[0].late > 0)).toBe(true);
  });

  it('운항 소식은 순하게: 사고·다침·추락 같은 말이 없고, 실제 항공사가 나오면 ‘게임 속 이야기’라고 적는다', () => {
    const rng = seededRandom(31);
    let s = createGame({ ...setup(['ai-normal', 'ai-easy', 'ai-normal', 'human'], { era: 1983, names: 'real' }) }, rng);
    for (let k = 0; k < 4 * 12 * 4; k++) {
      const ci = s.order[s.turnPos];
      s = s.companies[ci].kind === 'human' ? applyAction(s, { type: 'endTurn' }, rng) : aiTurn(s, rng);
      if (s.phase !== 'manage') break;
    }
    const all = s.news.map((n) => `${n.title} ${n.text}`).join('\n');
    for (const bad of ['사고', '추락', '부상', '다쳤', '사망', '죽', '충돌', '불시착', '폭발', '전쟁', '테러']) expect(all).not.toContain(bad);
    const opsNews = s.news.filter((n) => n.icon === '🔧' || n.title.includes('공항이'));
    for (const n of opsNews) if (n.company !== undefined && s.companies[n.company]?.airline) expect(n.text).toContain('게임 속 이야기');
  });
});

describe('자동 진행', () => {
  it('일이 없으면 계속하고, 결정할 일·돈 걱정·우리 회사 소식·큰 사건이 생기면 멈춘다', () => {
    const { s } = withRoute('tokyo');
    s.companies[0].cash = 2000;
    const calm = runMonth(runMonth(s, seededRandom(1)), seededRandom(2));
    const since = calm.nextId;
    calm.companies[0].choice = null;
    expect(autoStopReason(calm, 0, since)).toBeNull();
    // 결정할 일
    const withChoice = structuredClone(calm);
    withChoice.companies[0].choice = { id: 1, scenario: 'x', icon: '🧪', title: '시험', text: '', options: [{ label: '네', desc: '', effects: [], cost: 0, ai: 1 }] };
    expect(autoStopReason(withChoice, 0, since)).toContain('결정할 일');
    // 돈 걱정
    const poor = structuredClone(calm);
    poor.companies[0].cash = 5;
    expect(autoStopReason(poor, 0, since)).toContain('현금');
    // 우리 회사에 닿은 소식 (라이벌 진입 등)
    const news = structuredClone(calm);
    news.news.push({ id: news.nextId++, t: news.t, icon: '⚔️', title: '라이벌이 들어왔어요', text: '', tone: 'bad', for: [0] });
    expect(autoStopReason(news, 0, since)).toContain('라이벌');
    // 큰 사건
    const big = structuredClone(calm);
    big.news.push({ id: big.nextId++, t: big.t, icon: '🏅', title: '올림픽', text: '', tone: 'big' });
    expect(autoStopReason(big, 0, since)).toContain('올림픽');
    // 다른 회사만 닿은 소식은 멈추지 않는다
    const other = structuredClone(calm);
    other.news.push({ id: other.nextId++, t: other.t, icon: '⚔️', title: '남의 일', text: '', tone: 'bad', for: [1] });
    expect(autoStopReason(other, 0, since)).toBeNull();
  });

  it('사람 둘이 각자 자동으로 넘겨도 달이 이어지고, 분기 결산은 석 달 합이다', () => {
    let s = createGame(setup(['human', 'human']), seededRandom(4));
    const rng = seededRandom(5);
    for (let k = 0; k < 2 * 9; k++) s = applyAction(s, { type: 'endTurn' }, rng);
    expect(s.t).toBe(s.startT + 9);
    expect(s.history).toHaveLength(4);
    expect(s.qReport!.span).toBe(3);
  });
});
