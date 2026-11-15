import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL, MODELS, availableModels, isFictional } from './aircraft';
import { SHAPES } from './aircraftShapes';
import { aiTurn } from './ai';
import { CITIES, CITY, airportClass, citySize } from './cities';
import { FREIGHTERS } from './freighters';
import { AIRLINE_FATES, FATE, PREDECESSOR } from './airlineHistory';
import { REAL_AIRLINE, REAL_AIRLINES, airlinesAt } from './realAirlines';
import { applyAction, createGame, endT, listedCompanies, runMonth, shownCompanies, SHOWN_COMPANIES } from './rules';
import { fareFactor, travelFactor } from './simulate';
import { parseOptions, parseSaved, serializeSave } from './storage';
import { mOf, qOf, qOfM } from './time';
import type { AirlineOptions, AirlineSetup, AirlineState, SeatKind } from './types';
import { FUTURE_AIRLINES, LAST_YEAR, PREDICTED_MERGERS, RENAMES, fateAt, worldRoster, worldRouteCap } from './world';

function setup(options: Partial<AirlineOptions> = {}, airline: string | null = null, kind: SeatKind = 'human', hub: string | null = null): AirlineSetup {
  return {
    seats: [{ kind, name: '' }, { kind: 'empty', name: '' }, { kind: 'empty', name: '' }, { kind: 'empty', name: '' }],
    options: { era: 1983, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'normal', names: airline ? 'real' : 'fictional', world: true, ...options },
    hubs: [hub, null, null, null],
    airlines: [airline, null, null, null],
  };
}

/** 차례 없이 달만 넘긴다 (아무도 경영하지 않는다) */
function skipTo(state: AirlineState, year: number, month = 1): AirlineState {
  let s = state;
  const rng = seededRandom(7);
  while (s.phase !== 'gameover' && s.t < mOf(year, month)) s = runMonth(s, rng);
  return s;
}

const names = (s: AirlineState) => s.companies.filter((c) => !c.out).map((c) => c.name);

describe('세계 항공사 모드: 새 게임', () => {
  it('사람은 한 명, 그 해에 날던 실제 항공사가 모두 컴퓨터 라이벌로 나온다', () => {
    const s = createGame(setup({ era: 1983 }, 'korean'), seededRandom(1));
    expect(s.companies[0].kind).toBe('human');
    expect(s.companies[0].name).toBe('대한항공');
    expect(s.companies[0].hub).toBe('seoul');
    expect(s.companies.filter((c) => c.kind === 'human')).toHaveLength(1);
    const flying = s.companies.filter((c) => !c.out);
    const real = airlinesAt(1983);
    expect(flying).toHaveLength(real.length);
    expect(flying.length).toBeGreaterThan(30);
    for (const a of real) expect(names(s), a.name).toContain(a.name);
    // 라이벌은 모두 컴퓨터이고 실제 본거지에서 시작한다
    for (const c of flying.slice(1)) {
      expect(c.kind).toBe('ai-normal');
      expect(c.airline && REAL_AIRLINE[c.airline].hub).toBe(c.hub);
      expect(c.color).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(s.order[0]).toBe(0);
  });

  it('나중에 생길 항공사는 자리를 잡아 두고 쉬다가 그 해에 날기 시작한다', () => {
    let s = createGame(setup({ era: 1983 }, 'korean'), seededRandom(1));
    const emirates = s.companies.findIndex((c) => c.airline === 'emirates');
    const asiana = s.companies.findIndex((c) => c.airline === 'asiana');
    expect(s.companies[emirates]).toMatchObject({ dormant: true, out: true, joinYear: 1985 });
    expect(listedCompanies(s)).not.toContain(emirates);
    const n = s.companies.length;
    // 실제 항공사는 날기 시작한 달에 나온다 (에미레이트항공 1985년 10월)
    s = skipTo(s, 1985, 9);
    expect(s.companies[emirates].dormant).toBe(true);
    s = skipTo(s, 1985, 10);
    expect(s.companies).toHaveLength(n);
    expect(s.companies[emirates].out).toBe(false);
    expect(s.companies[emirates].dormant).toBeFalsy();
    expect(s.companies[asiana].out).toBe(true);
    expect(s.news.some((x) => x.title === '새 항공사: 에미레이트항공')).toBe(true);
    expect(s.order).toContain(emirates);
    s = skipTo(s, 1988, 12);
    expect(s.companies[asiana].out).toBe(false);
  });

  it('새 항공사를 만들면 지어낸 이름으로 실제 항공사 모두와 겨룬다', () => {
    const st = setup({ era: 2003 });
    st.seats[0].name = '무지개';
    st.hubs[0] = 'busan';
    const s = createGame(st, seededRandom(2));
    expect(s.companies[0]).toMatchObject({ name: '무지개항공', hub: 'busan', airline: null });
    expect(s.companies.filter((c) => !c.out)).toHaveLength(airlinesAt(2003).length + 1);
  });

  it("'실제 항공사 맡기'에서 고르지 않으면 저절로 하나를 맡고, 그 항공사는 라이벌로 나오지 않는다", () => {
    const st = setup({ era: 1983, names: 'real' });
    const s = createGame(st, seededRandom(5));
    const mine = s.companies[0].airline;
    expect(mine && REAL_AIRLINE[mine]).toBeTruthy();
    expect(s.companies.filter((c) => c.airline === mine)).toHaveLength(1);
    expect(s.companies.filter((c) => !c.out)).toHaveLength(airlinesAt(1983).length);
  });

  it('2026년에 시작하면 예측한 미래 항공사가 차례로 생긴다', () => {
    const s = createGame(setup({ era: 2026, years: 0 }, 'korean'), seededRandom(3));
    const future = s.companies.filter((c) => c.predicted);
    expect(future).toHaveLength(FUTURE_AIRLINES.length);
    for (const c of future) {
      expect(c.dormant).toBe(true);
      expect(c.airline).toBeNull();
      expect(c.joinYear).toBeGreaterThan(2026);
    }
    // 30년만 하면 그 안에 생기는 항공사만 준비한다
    const short = createGame(setup({ era: 2026, years: 30 }, 'korean'), seededRandom(3));
    expect(short.companies.filter((c) => c.predicted)).toHaveLength(FUTURE_AIRLINES.filter((f) => f.founded <= 2056).length);
  });
});

describe('세계 항공사 모드: 역사대로 바뀌는 항공사', () => {
  it('영국해외항공은 1974년에 영국항공으로 이름을 바꿔 이어 난다', () => {
    let s = createGame(setup({ era: 1963 }, 'jal'), seededRandom(1));
    const boac = s.companies.findIndex((c) => c.airline === 'boac');
    expect(boac).toBeGreaterThan(0);
    expect(s.companies.some((c) => c.airline === 'britishairways')).toBe(false);
    s = skipTo(s, 1974, 4);
    // 아무도 경영하지 않아 돈이 떨어져 멈췄을 수 있다: 그때는 이름을 바꾸지 않는다
    if (!s.companies[boac].out) expect(s.companies[boac]).toMatchObject({ airline: 'britishairways', name: '영국항공' });
  });

  it('팬암은 1991년에 역사 속으로 사라지고, 사람이 맡은 항공사는 그대로 난다', () => {
    const base = createGame(setup({ era: 1983, history: true }, 'korean'), seededRandom(1));
    const panam = base.companies.findIndex((c) => c.airline === 'panam');
    // 1991년 11월로 바로 건너뛴다 (경영 없이 여러 해를 보내면 돈이 떨어지니). 팬암은 1991년 12월에 운항을 마쳤다
    const t = mOf(1991, 11);
    let s: AirlineState = { ...base, t, q: Math.floor(t / 3) };
    expect(s.companies[panam].out).toBe(false);
    s = runMonth(s, seededRandom(4));
    expect(s.t).toBe(mOf(1991, 12));
    expect(s.companies[panam].out).toBe(true);
    expect(s.news.some((x) => x.title === '팬암, 역사 속으로')).toBe(true);

    const mine = createGame(setup({ era: 1983 }, 'panam'), seededRandom(1));
    let m: AirlineState = { ...mine, t, q: Math.floor(t / 3) };
    m = runMonth(m, seededRandom(4));
    expect(m.companies[0]).toMatchObject({ airline: 'panam', out: false });
  });

  it('실제 역사를 끄면 사라지지 않는다', () => {
    const base = createGame(setup({ era: 1983, history: false }, 'korean'), seededRandom(1));
    const panam = base.companies.findIndex((c) => c.airline === 'panam');
    const t = mOf(1991, 11);
    const s = runMonth({ ...base, t, q: Math.floor(t / 3) }, seededRandom(4));
    expect(s.companies[panam].out).toBe(false);
  });

  it('합쳐지는 회사는 노선과 비행기를 넘겨준다 (노스웨스트 → 델타, 2010년)', () => {
    const rng = seededRandom(9);
    let s = createGame(setup({ era: 2003, years: 10 }, null, 'ai-normal'), rng);
    const nw = s.companies.findIndex((c) => c.airline === 'northwest');
    const dl = s.companies.findIndex((c) => c.airline === 'delta');
    // 두 해쯤 컴퓨터끼리 경영하게 두고 2009년 12월로 건너뛴다
    while (s.t < mOf(2005, 1)) s = aiTurn(s, rng);
    expect(s.companies[nw].routes.length).toBeGreaterThan(0);
    const routes = new Set([...s.companies[nw].routes, ...s.companies[dl].routes].map((r) => [r.a, r.b].sort().join('-')));
    const planes = s.companies[nw].planes.length + s.companies[dl].planes.length;
    const t = mOf(2009, 12);
    s = { ...s, t, q: Math.floor(t / 3), turnPos: 0 };
    s = runMonth(s, rng);
    expect(s.companies[nw]).toMatchObject({ out: true, mergedInto: dl });
    expect(s.companies[dl].routes).toHaveLength(routes.size);
    expect(s.companies[dl].planes).toHaveLength(planes);
    expect(s.news.some((x) => x.title === '노스웨스트항공, 델타항공에 합쳐져요')).toBe(true);
  }, 120000);

  it('운명표: 이름 바꾸기·합병·폐업, 그리고 예측한 미래의 합병', () => {
    // 실제 역사는 보통 판과 같은 표(airlineHistory.ts)를 그 달에 따른다
    expect(fateAt('boac', mOf(1974, 4))).toMatchObject({ kind: 'rename', into: 'britishairways' });
    expect(fateAt('boac', mOf(1974, 3))).toBeNull();
    expect(fateAt('twa', mOf(2001, 4))).toMatchObject({ kind: 'merge', into: 'american' });
    expect(fateAt('panam', mOf(1991, 12))).toMatchObject({ kind: 'close' });
    expect(fateAt('panam', mOf(1991, 1))).toBeNull();
    // 스위스에어·알리탈리아는 문을 닫고, 뒤를 이은 회사는 따로 생긴다
    expect(fateAt('swissair', mOf(2001, 10))).toMatchObject({ kind: 'close' });
    expect(fateAt('alitalia', mOf(2021, 10))).toMatchObject({ kind: 'close' });
    expect(RENAMES.swissair).toBeUndefined();
    // 실제 인수 시점(2024): 아시아나는 대한항공에, 하와이안은 판 밖의 알래스카항공에
    expect(fateAt('asiana', mOf(2024, 12))).toMatchObject({ kind: 'merge', into: 'korean' });
    expect(fateAt('asiana', mOf(2024, 12))).not.toHaveProperty('predicted');
    expect(fateAt('asiana', mOf(2027, 1))).toBeNull();
    expect(fateAt('hawaiian', mOf(2024, 9))).toMatchObject({ kind: 'close', intoName: '알래스카항공' });
    expect(fateAt('ita', mOf(2034, 1))).toEqual({ kind: 'merge', into: 'lufthansa', predicted: true });
    for (const [from, to] of Object.entries(RENAMES)) {
      expect(REAL_AIRLINE[from].defunct).toBe(REAL_AIRLINE[to].founded);
    }
    for (const m of PREDICTED_MERGERS) {
      expect(REAL_AIRLINE[m.id]).toBeTruthy();
      expect(REAL_AIRLINE[m.into]).toBeTruthy();
      expect(m.year).toBeGreaterThan(2026);
    }
  });

  it('명단: 이름만 바뀐 회사는 앞 회사 자리를 이어받고, 사람이 고른 항공사는 빠진다', () => {
    const r63 = worldRoster(1963, 2100, null).map((e) => e.airline ?? e.future);
    expect(r63).toContain('boac');
    expect(r63).not.toContain('britishairways');
    expect(r63).toContain('emirates');
    const r83 = worldRoster(1983, 2003, null).map((e) => e.airline ?? e.future);
    expect(r83).toContain('britishairways');
    expect(r83).not.toContain('boac');
    expect(r83).not.toContain('latam');
    expect(r83).not.toContain('bharat');
    expect(worldRoster(1963, 2100, 'boac').some((e) => e.airline === 'boac' || e.airline === 'britishairways')).toBe(false);
    expect(new Set(r63).size).toBe(r63.length);
  });

  it('예측한 미래 항공사: 본거지가 있고, 2027년부터 2100년 사이에 생긴다', () => {
    expect(FUTURE_AIRLINES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(FUTURE_AIRLINES.map((f) => f.name)).size).toBe(FUTURE_AIRLINES.length);
    for (const f of FUTURE_AIRLINES) {
      expect(CITY[f.hub], f.id).toBeTruthy();
      expect(REAL_AIRLINE[f.id]).toBeUndefined();
      expect(f.founded).toBeGreaterThan(2026);
      expect(f.founded).toBeLessThan(LAST_YEAR);
      expect(f.note.length).toBeGreaterThan(8);
    }
  });
});

describe('세계 항공사 모드: 컴퓨터끼리 경영', () => {
  it('열 해 동안 라이벌이 자라고, 저장했다가 그대로 읽는다', () => {
    const rng = seededRandom(11);
    const st = setup({ era: 2003, years: 10 }, null, 'ai-normal');
    let s = createGame(st, rng);
    while (s.phase !== 'gameover' && s.t < mOf(2009, 1)) s = aiTurn(s, rng);
    const flying = s.companies.filter((c) => !c.out);
    // 거의 모든 항공사가 살아서 노선을 날린다
    expect(flying.length).toBeGreaterThan(airlinesAt(2003).length * 0.8);
    expect(flying.filter((c) => c.routes.length >= 5).length).toBeGreaterThan(flying.length * 0.8);
    // 컴퓨터 회사는 정해진 크기까지만 넓힌다
    for (const c of flying) expect(c.routes.length, c.name).toBeLessThanOrEqual(worldRouteCap(c.kind, citySize(CITY[c.hub], 2009)) + 6);
    // 저장: 브라우저 한도(약 5MB) 안이고, 다시 읽으면 같은 판
    const text = serializeSave(st, s, 1);
    expect(text.length).toBeLessThan(3_000_000);
    const back = parseSaved(JSON.parse(text));
    expect(back).not.toBeNull();
    expect(back!.state.companies).toHaveLength(s.companies.length);
    expect(back!.state.t).toBe(s.t);
    expect(back!.state.options.world).toBe(true);
    expect(back!.state.companies.map((c) => c.routes.length)).toEqual(s.companies.map((c) => c.routes.length));
    expect(back!.state.ledger).toHaveLength(s.ledger.length);
    // 한도를 넘으면 쓰는 더 가벼운 저장도 읽힌다
    const lean = serializeSave(st, s, 1, true);
    expect(lean.length).toBeLessThan(text.length);
    expect(parseSaved(JSON.parse(lean))?.state.t).toBe(s.t);
    for (const r of back!.state.ledger) for (const c of r.companies) expect(typeof c.profit).toBe('number');
    // 읽은 판을 이어서 할 수 있다
    let again = back!.state;
    for (let k = 0; k < s.companies.length + 2 && again.phase !== 'gameover'; k++) again = aiTurn(again, rng);
    expect(again.t).toBeGreaterThanOrEqual(s.t);
    // 화면에는 위쪽 몇 곳과 보는 회사만
    const shown = shownCompanies(s, 0);
    expect(shown.length).toBeLessThanOrEqual(SHOWN_COMPANIES);
    expect(shown).toContain(0);
    expect(new Set(shown).size).toBe(shown.length);
  }, 240000);

  it('사람이 차례를 마치면 다음은 컴퓨터, 모두 마치면 다음 달', () => {
    const rng = seededRandom(3);
    let s = createGame(setup({ era: 1983 }, 'korean'), rng);
    const t0 = s.t;
    s = applyAction(s, { type: 'endTurn' }, rng);
    expect(s.t).toBe(t0);
    let guard = 0;
    while (s.t === t0 && guard++ < 200) s = aiTurn(s, rng);
    expect(s.t).toBe(t0 + 1);
    expect(guard).toBeLessThan(80);
  });
});

describe('게임 길이와 2100년까지의 세계', () => {
  it('정해진 해: 10·20·30·50년, 0이면 2100년 12월까지', () => {
    const end = (o: Partial<AirlineOptions>) => endT(createGame(setup(o, 'korean'), seededRandom(1)));
    expect(end({ era: 1983, years: 20 })).toBe(mOf(2002, 12));
    expect(end({ era: 1983, years: 50 })).toBe(mOf(2032, 12));
    expect(end({ era: 1983, years: 0 })).toBe(mOf(2100, 12));
    expect(end({ era: 2026, years: 0 })).toBe(mOf(2100, 12));
    expect(end({ era: 2026, years: 50 })).toBe(mOf(2075, 12));
    // 예전 방식(자리 넷)에서도 길이를 늘릴 수 있다
    const legacy = createGame({ ...setup({ era: 2003, years: 0, world: undefined, names: 'fictional' }), seats: [{ kind: 'human', name: '' }, { kind: 'ai-normal', name: '' }, { kind: 'empty', name: '' }, { kind: 'empty', name: '' }] }, seededRandom(1));
    expect(legacy.companies).toHaveLength(2);
    expect(endT(legacy)).toBe(mOf(2100, 12));
  });

  it('설정 읽기: 새 시작 해·길이·세계 모드', () => {
    expect(parseOptions({ era: 2026, years: 0, world: true })).toMatchObject({ era: 2026, years: 0, world: true });
    expect(parseOptions({ era: 2026, years: 50 }).years).toBe(50);
    expect(parseOptions({ years: 40 }).years).toBe(20);
    expect('world' in parseOptions({ era: 1983 })).toBe(false);
  });

  it('어느 해든 (1963~2100) 짧은·중간·먼 노선에 쓸 새 기종을 살 수 있다', () => {
    for (let y = 1963; y <= LAST_YEAR; y++) {
      const ms = availableModels(y);
      expect(ms.some((m) => m.runway === 1), `${y} 작은 공항`).toBe(true);
      expect(ms.some((m) => m.seats >= 100 && m.seats <= 200), `${y} 중형`).toBe(true);
      expect(Math.max(...ms.map((m) => m.range)), `${y} 장거리`).toBeGreaterThanOrEqual(9000);
      if (y >= 1970) expect(ms.some((m) => m.seats >= 280), `${y} 대형`).toBe(true);
      if (y >= 1964) expect(FREIGHTERS.some((m) => m.intro <= y && y <= m.end), `${y} 화물기`).toBe(true);
    }
  });

  it('예측한 미래 기종: 표시가 붙고, 그림이 있고, 세월이 갈수록 연료를 덜 쓴다', () => {
    const future = MODELS.filter((m) => m.intro > 2027);
    expect(future.length).toBeGreaterThanOrEqual(25);
    for (const m of future) {
      expect(isFictional(m), m.id).toBe(true);
      expect(SHAPES[m.id], m.id).toBeDefined();
      expect(m.end).toBeLessThanOrEqual(LAST_YEAR);
    }
    for (const m of MODELS.filter((x) => x.intro <= 2027)) expect(isFictional(m), m.id).toBe(false);
    for (const m of FREIGHTERS.filter((x) => x.intro > 2027)) expect(isFictional(MODEL[m.id]), m.id).toBe(true);
    // 2026년에 만들던 기종은 2060년 전에 모두 생산이 끝난다
    for (const m of MODELS.filter((x) => x.intro <= 2026)) expect(m.end, m.id).toBeLessThan(2060);
    // 좌석 하나를 1km 나르는 연료: 세기말 한 줄 통로기는 오늘의 절반 아래
    const perSeat = (id: string) => MODEL[id].burn / MODEL[id].seats;
    expect(perSeat('b797-8')).toBeLessThan(perSeat('b737max8') * 0.8);
    expect(perSeat('b220h')).toBeLessThan(perSeat('a320neo') * 0.5);
    expect(new Set(future.map((m) => m.maker)).size).toBeGreaterThanOrEqual(8);
  });

  it('도시와 여행 수요는 2030년 뒤에도 자라고, 공항은 줄어들지 않는다', () => {
    for (const c of CITIES) {
      expect(citySize(c, 2100), c.id).toBeGreaterThan(citySize(c, 2030));
      expect(citySize(c, 2031)).toBeCloseTo(citySize(c, 2030), 0);
      for (let y = 1961; y <= 2100; y++) {
        const cls = airportClass(c, y);
        expect(cls).toBeGreaterThanOrEqual(1);
        expect(cls).toBeLessThanOrEqual(4);
        if (y > 2030) expect(cls, `${c.id} ${y}`).toBeGreaterThanOrEqual(airportClass(c, y - 1));
      }
    }
    expect(citySize(CITY.lagos, 2100) / citySize(CITY.lagos, 2030)).toBeGreaterThan(citySize(CITY.london, 2100) / citySize(CITY.london, 2030));
    expect(travelFactor(qOf(2100, 1))).toBeGreaterThan(travelFactor(qOf(2045, 1)));
    expect(fareFactor(qOf(2100, 1))).toBeLessThan(fareFactor(qOf(2045, 1)));
  });
});

describe('두 모드가 함께 쓰는 실제 역사 (airlineHistory.ts)', () => {
  it('운명표와 실제 항공사 명단이 맞는다: 없어지는 항공사는 모두 까닭이 있고, 시작 명단에서 빠지는 해는 운명의 해(또는 다음 해)', () => {
    for (const f of AIRLINE_FATES) {
      const a = REAL_AIRLINE[f.id];
      expect(a, f.id).toBeTruthy();
      expect([f.year, f.year + 1], f.id).toContain(a.defunct);
      expect(f.month).toBeGreaterThanOrEqual(1);
      expect(f.month).toBeLessThanOrEqual(12);
      if (f.into) expect(REAL_AIRLINE[f.into], f.into).toBeTruthy();
      expect(f.why.length).toBeGreaterThan(5);
    }
    for (const a of REAL_AIRLINES) if (a.defunct !== undefined) expect(FATE[a.id], a.id).toBeTruthy();
    // 뒤를 이은 회사는 앞 회사가 빠지는 해에 생긴다
    for (const [to, from] of Object.entries(PREDECESSOR)) expect(REAL_AIRLINE[to].founded, to).toBe(REAL_AIRLINE[from].defunct);
  });

  it('아시아나·하와이안은 2024년에 인수돼 2026년 판에는 따로 나오지 않는다', () => {
    const ids = (y: number) => airlinesAt(y).map((a) => a.id);
    expect(ids(2023)).toEqual(expect.arrayContaining(['asiana', 'hawaiian']));
    expect(ids(2026)).not.toContain('asiana');
    expect(ids(2026)).not.toContain('hawaiian');
    const roster = worldRoster(2026, 2100, null).map((e) => e.airline);
    expect(roster).not.toContain('asiana');
    expect(roster).not.toContain('hawaiian');
  });

  it('스위스에어가 문을 닫은 뒤에야 스위스국제항공이 생기고, 사람이 스위스에어를 맡아 날고 있으면 생기지 않는다', () => {
    const jump = (s: AirlineState, year: number, month: number) => runMonth({ ...s, t: mOf(year, month), q: qOfM(mOf(year, month)) }, seededRandom(4));
    let s = createGame(setup({ era: 1983 }, 'korean'), seededRandom(1));
    const sr = s.companies.findIndex((c) => c.airline === 'swissair');
    const lx = s.companies.findIndex((c) => c.airline === 'swiss');
    expect(s.companies[lx].dormant).toBe(true);
    s = jump(s, 2001, 9);
    expect(s.companies[sr]).toMatchObject({ out: true, fate: '2001년 문을 닫음' });
    expect(s.companies[lx].dormant).toBe(true);
    s = jump(s, 2002, 3);
    expect(s.t).toBe(mOf(2002, 4));
    expect(s.companies[lx]).toMatchObject({ out: false, name: '스위스국제항공' });

    let m = createGame(setup({ era: 1983 }, 'swissair'), seededRandom(1));
    const lx2 = m.companies.findIndex((c) => c.airline === 'swiss');
    m = jump(m, 2002, 3);
    expect(m.companies[0]).toMatchObject({ airline: 'swissair', out: false });
    expect(m.companies[lx2].dormant).toBe(true);
  });
});
