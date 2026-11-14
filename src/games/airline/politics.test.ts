import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL } from './aircraft';
import { defaultCabin } from './cabin';
import { HISTORY, historyAt, worldMult } from './events';
import { makerPolitics, polity, relationBlock, routePolitics } from './politics';
import { applyAction, branchBlocker, buyBlocker, createGame, routeBlocker, runQuarter } from './rules';
import { pairDemand } from './simulate';
import { qOf } from './time';
import type { AirlineOptions, AirlineSetup, AirlineState } from './types';

function game(hubs: [string, string], era: 1963 | 1983 | 2003, extra: Partial<AirlineOptions> = {}): AirlineState {
  const setup: AirlineSetup = {
    seats: [
      { kind: 'human', name: '' },
      { kind: 'human', name: '' },
      { kind: 'empty', name: '' },
      { kind: 'empty', name: '' },
    ],
    options: { era, mode: 'years', years: 30, goalValue: 20000, goalRegions: 6, money: 'rich', challenge: null, aiStyle: 'normal', names: 'fictional', ...extra },
    hubs: [hubs[0], hubs[1], null, null],
    airlines: [null, null, null, null],
  };
  const s = createGame(setup, seededRandom(1));
  s.companies[0].cash = 1e6;
  return s;
}

const at = (s: AirlineState, year: number, quarter = 1): AirlineState => ({ ...s, q: qOf(year, quarter) });

describe('나라 관계 (냉전·국교)', () => {
  it('도시의 나라는 해마다 바뀐다 (홍콩 반환·베트남 통일·소련 해체)', () => {
    expect(polity('hongkong', 1990)).toBe('영국령 홍콩');
    expect(polity('hongkong', 2000)).toBe('홍콩');
    expect(polity('hochiminh', 1970)).toBe('남베트남');
    expect(polity('hochiminh', 1980)).toBe('베트남');
    expect(polity('moscow', 1985)).toBe('소련');
    expect(polity('moscow', 1995)).toBe('러시아');
    expect(polity('honolulu', 1990)).toBe('미국');
  });

  it('국교가 없으면 노선·지점을 열 수 없고, 열린 해부터는 된다', () => {
    let s = game(['newyork', 'london'], 1963);
    s = applyAction(s, { type: 'openBranch', city: 'tokyo' });
    expect(branchBlocker(at(s, 1975), 0, 'beijing')).toContain('국교');
    expect(branchBlocker(at(s, 1980), 0, 'beijing')).toBeNull();
    expect(routePolitics('seoul', 'seoul', 'moscow', 1985)?.why).toContain('소련');
    expect(routePolitics('seoul', 'seoul', 'moscow', 1991)).toBeNull();
    // 제3국 사이 노선도 본사 나라 관계를 따른다 (미국 회사의 도쿄–베이징)
    expect(routePolitics('newyork', 'tokyo', 'beijing', 1976)).not.toBeNull();
    expect(routePolitics('london', 'tokyo', 'beijing', 1976)).toBeNull();
    expect(relationBlock('러시아', '영국', 2023)?.until).toBe(9999);
  });

  it("설정에서 '실제 역사'를 끄면 막힘이 없다", () => {
    const s = game(['newyork', 'london'], 1963, { history: false });
    expect(branchBlocker(at(s, 1970), 0, 'beijing')).toBeNull();
    expect(buyBlocker(at(s, 1970), 0, 'tu134', true)).toBeNull();
  });

  it('냉전 동안 소련 비행기는 동쪽 나라만, 서방 비행기는 서쪽 나라만 산다', () => {
    expect(makerPolitics('london', MODEL.tu154, 1983)).toContain('소련 비행기');
    expect(makerPolitics('moscow', MODEL.tu154, 1983)).toBeNull();
    expect(makerPolitics('moscow', MODEL['b737-300'], 1985)).toContain('서방 비행기');
    expect(makerPolitics('beijing', MODEL['b737-300'], 1985)).toBeNull();
    expect(makerPolitics('london', MODEL.il96, 1995)).toBeNull();
    const s = game(['london', 'moscow'], 1983);
    expect(buyBlocker(s, 0, 'tu154', true)).toContain('소련');
    expect(buyBlocker(s, 1, 'tu154', true)).toBeNull();
  });

  it('관계가 막히는 해가 오면 그 노선은 운항을 멈춘다 (베트남 통일)', () => {
    let s = game(['newyork', 'london'], 1963);
    s = at(s, 1975, 4);
    const c = s.companies[0];
    c.branches.push('hochiminh', 'tokyo');
    c.routes.push({ id: 900, a: 'tokyo', b: 'hochiminh', fare: 0, since: s.q, stats: null });
    c.planes.push({ id: 901, model: 'b707', leased: false, rent: 0, deposit: 0, since: s.q, legs: [{ route: 900, freq: 3 }], cabin: defaultCabin(MODEL.b707), meal: 3 });
    s = { ...s, nextId: 1000 };
    const t = runQuarter(s, seededRandom(3));
    expect(t.companies[0].routes.some((r) => r.id === 900)).toBe(false);
    expect(t.companies[0].planes.find((p) => p.id === 901)!.legs).toEqual([]);
    expect(t.news.some((n) => n.title.includes('운항 중단'))).toBe(true);
    // 영국 회사는 그대로 날 수 있다
    expect(routeBlocker(t, 1, 'london', 'hochiminh')).not.toContain('국교');
  });
});

describe('실제 역사 사건', () => {
  it('사건표는 시간 순서이고 분기 값이 올바르다', () => {
    for (let i = 1; i < HISTORY.length; i++) expect(qOf(HISTORY[i].year, HISTORY[i].quarter)).toBeGreaterThanOrEqual(qOf(HISTORY[i - 1].year, HISTORY[i - 1].quarter));
    for (const h of HISTORY) {
      expect(h.quarter).toBeGreaterThanOrEqual(1);
      expect(h.quarter).toBeLessThanOrEqual(4);
    }
    expect(historyAt(qOf(2001, 3)).map((h) => h.title)).toContain('9·11 테러');
  });

  it('9·11 테러가 일어나면 온 세계 손님이 줄고, 실제 역사를 끄면 그대로다', () => {
    const base = at(game(['seoul', 'tokyo'], 2003), 2001, 2);
    const before = pairDemand(base, 'london', 'newyork', qOf(2001, 3));
    const on = runQuarter({ ...base, turnPos: 0 }, seededRandom(1));
    expect(worldMult(on.effects)).toBeLessThan(1);
    const after = pairDemand(on, 'london', 'newyork');
    expect(after.biz + after.leisure).toBeLessThan((before.biz + before.leisure) * 0.9);
    const off = runQuarter({ ...base, options: { ...base.options, history: false }, turnPos: 0 }, seededRandom(1));
    expect(worldMult(off.effects)).toBe(1);
  });

  it('코로나19 때는 손님이 거의 사라지지만 지원금이 나온다', () => {
    let s = at(game(['seoul', 'tokyo'], 2003), 2020, 1);
    s = applyAction(s, { type: 'openBranch', city: 'osaka' });
    s = applyAction(s, { type: 'openRoute', a: 'seoul', b: 'osaka' });
    s = applyAction(s, { type: 'lease', model: 'a320neo' });
    const c = s.companies[0];
    s = applyAction(s, { type: 'assign', plane: c.planes[0].id, route: c.routes[0].id, freq: 14 });
    const play = (t: AirlineState) => applyAction(applyAction(t, { type: 'endTurn' }, seededRandom(5)), { type: 'endTurn' }, seededRandom(5));
    const on = play(s);
    const off = play({ ...s, options: { ...s.options, history: false } });
    expect(worldMult(on.effects)).toBeLessThan(0.3);
    expect(on.news.some((n) => n.title.includes('코로나19'))).toBe(true);
    // 지난 분기(코로나 전) 결과는 같고, 지원금만큼 현금이 더 많다
    expect(on.companies[0].cash).toBeGreaterThan(off.companies[0].cash + 1);
  });
});
