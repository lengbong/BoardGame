import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { AIRPORT_MAPS } from './airportMaps';
import { AIRPORT_INFO_BY_ICAO, CITY_AIRPORTS, cityAirport, runwayLength } from './airports';
import { backgroundModels, parkPlanes, trafficQueue, visitingPlanes } from './airportScene';
import { CITIES } from './cities';
import { applyAction, createGame } from './rules';
import type { AirlineAction, AirlineSetup, AirlineState } from './types';

describe('도시마다 그 해의 공항', () => {
  it('모든 도시에 공항이 있고, 1955~2045년 어느 해든 공항이 꼭 하나다', () => {
    for (const c of CITIES) {
      const eras = CITY_AIRPORTS[c.id];
      expect(eras, c.id).toBeDefined();
      for (let y = 1955; y <= 2045; y++) {
        const hits = eras.filter((e) => (e.from === undefined || y >= e.from) && (e.to === undefined || y <= e.to));
        expect(hits.length, `${c.id} ${y}`).toBe(1);
      }
    }
  });

  it('쓰는 공항마다 이름·부호와 도면이 있다', () => {
    for (const eras of Object.values(CITY_AIRPORTS)) {
      for (const e of eras) {
        expect(AIRPORT_INFO_BY_ICAO[e.icao], e.icao).toBeDefined();
        expect(AIRPORT_MAPS[e.icao], `${e.icao} 도면`).toBeDefined();
      }
    }
  });

  it('새 공항이 생긴 해에 옮겨 간다', () => {
    expect(cityAirport('seoul', 1990)?.info.icao).toBe('RKSS');
    expect(cityAirport('seoul', 2001)?.info.icao).toBe('RKSI');
    expect(cityAirport('hongkong', 1997)?.info.icao).toBe('VHHX');
    expect(cityAirport('hongkong', 1998)?.info.icao).toBe('VHHH');
    expect(cityAirport('tokyo', 1985)?.info.icao).toBe('RJAA');
    expect(cityAirport('tokyo', 2015)?.info.icao).toBe('RJTT');
    expect(cityAirport('montreal', 1980)?.info.icao).toBe('CYMX');
    // 앞뒤 공항 이야기
    const gimpo = cityAirport('seoul', 1990);
    expect(gimpo?.next?.info.icao).toBe('RKSI');
    expect(gimpo?.prev).toBeUndefined();
    expect(cityAirport('seoul', 2010)?.prev?.info.icao).toBe('RKSS');
    // 범위 밖의 해는 끝 공항
    expect(cityAirport('seoul', 1940)?.info.icao).toBe('RKSS');
    expect(cityAirport('seoul', 2100)?.info.icao).toBe('RKSI');
  });
});

describe('공항 도면 자료', () => {
  it('틀 크기·활주로·경로·주기장이 알맞다', () => {
    for (const [icao, m] of Object.entries(AIRPORT_MAPS)) {
      expect(m.w, icao).toBeGreaterThan(500);
      expect(m.h, icao).toBeGreaterThan(500);
      expect(m.w * m.h, icao).toBeLessThan(25000 * 25000);
      expect(m.rwy.length, `${icao} 활주로`).toBeGreaterThan(0);
      for (const r of m.rwy) {
        expect(runwayLength(r), `${icao} ${r[5]}`).toBeGreaterThan(900);
        expect(runwayLength(r), `${icao} ${r[5]}`).toBeLessThan(5600);
        expect(r[4], `${icao} 폭`).toBeGreaterThanOrEqual(5);
        // 활주로는 틀 안에 (끝이 살짝 걸치는 것은 괜찮다)
        for (const [x, y] of [
          [r[0], r[1]],
          [r[2], r[3]],
        ])
          expect(x >= -300 && x <= m.w + 300 && y >= -300 && y <= m.h + 300, `${icao} 활주로 자리`).toBe(true);
      }
      // 활주로는 긴 것부터
      for (let i = 1; i < m.rwy.length; i++) expect(runwayLength(m.rwy[i - 1])).toBeGreaterThanOrEqual(runwayLength(m.rwy[i]));
      for (const d of [m.land, m.water, m.field, m.apron, m.term, m.hangar, m.bldg, ...(m.twy ?? []).map((t) => t[1])]) {
        if (d) expect(d, icao).toMatch(/^M-?\d/);
      }
      if (m.stands) {
        expect(m.stands.length % 3, icao).toBe(0);
        for (let i = 2; i < m.stands.length; i += 3) expect(m.stands[i] >= -1 && m.stands[i] < 360, icao).toBe(true);
      }
    }
  });

  it('모두 합쳐도 게임 파일이 너무 커지지 않는다', () => {
    const size = JSON.stringify(AIRPORT_MAPS).length;
    expect(size).toBeLessThan(1_600_000);
  });
});

// ------------------------------------------------------------------ 비행기 세우기

function game(): AirlineState {
  const setup: AirlineSetup = {
    seats: [
      { kind: 'human', name: '' },
      { kind: 'human', name: '' },
      { kind: 'empty', name: '' },
      { kind: 'empty', name: '' },
    ] as AirlineSetup['seats'],
    options: { era: 2003, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'normal', names: 'fictional' },
    hubs: ['seoul', 'london', null, null],
    airlines: [null, null, null, null],
  };
  return createGame(setup, seededRandom(1));
}

function act(s: AirlineState, ci: number, a: AirlineAction): AirlineState {
  const at = { ...s, turnPos: s.order.indexOf(ci) };
  const next = applyAction(at, a, seededRandom(4));
  expect(next, JSON.stringify(a)).not.toBe(at);
  return next;
}

/** 0번(서울)과 1번(런던)이 서울–도쿄, 런던–서울을 나는 판 */
function withFlights(): AirlineState {
  let s = game();
  s = act(s, 0, { type: 'openBranch', city: 'tokyo' });
  s = act(s, 0, { type: 'openRoute', a: 'seoul', b: 'tokyo' });
  s = act(s, 0, { type: 'lease', model: 'b737-800' });
  s = act(s, 0, { type: 'assign', plane: s.companies[0].planes[0].id, route: s.companies[0].routes[0].id, freq: 14 });
  s = act(s, 1, { type: 'openBranch', city: 'seoul' });
  s = act(s, 1, { type: 'openRoute', a: 'london', b: 'seoul' });
  s = act(s, 1, { type: 'lease', model: 'b747-400' });
  s = act(s, 1, { type: 'assign', plane: s.companies[1].planes[0].id, route: s.companies[1].routes[0].id, freq: 3 });
  return s;
}

describe('공항에 비행기 세우기', () => {
  it('이 도시를 지나는 노선의 비행기만, 보는 회사 먼저', () => {
    const s = withFlights();
    expect(visitingPlanes(s, 'seoul', 0)).toEqual([
      { company: 0, model: 'b737-800' },
      { company: 1, model: 'b747-400' },
    ]);
    expect(visitingPlanes(s, 'seoul', 1).map((v) => v.company)).toEqual([1, 0]);
    expect(visitingPlanes(s, 'tokyo', 0)).toEqual([{ company: 0, model: 'b737-800' }]);
    expect(visitingPlanes(s, 'paris', 0)).toEqual([]);
  });

  it('회사 비행기는 주기장에 서고, 남은 자리에 다른 항공사 비행기가 늘 같은 자리에 선다', () => {
    const s = withFlights();
    const map = AIRPORT_MAPS.RKSI;
    const visiting = visitingPlanes(s, 'seoul', 0);
    const a = parkPlanes(map, 'RKSI', 'seoul', 2003, visiting);
    const b = parkPlanes(map, 'RKSI', 'seoul', 2003, visiting);
    expect(a).toEqual(b);
    expect(a.filter((p) => p.company === 0)).toHaveLength(1);
    expect(a.filter((p) => p.company === 1)).toHaveLength(1);
    expect(a.filter((p) => p.company === null).length).toBeGreaterThan(5);
    expect(a.length).toBeLessThanOrEqual((map.stands?.length ?? 0) / 3);
    // 서로 다른 자리
    const spots = new Set(a.map((p) => `${p.x},${p.y}`));
    expect(spots.size).toBe(a.length);
    // 다른 항공사 비행기도 그 해에 날던 기종
    const pool = new Set(backgroundModels(2003, 4));
    for (const p of a.filter((x) => x.company === null)) expect(pool.has(p.model)).toBe(true);
  });

  it('옛날에는 그 무렵 기종만', () => {
    const pool = backgroundModels(1965, 3);
    expect(pool.length).toBeGreaterThan(0);
    expect(pool).not.toContain('a320');
    expect(pool).not.toContain('b747-400');
  });

  it('이착륙 연출은 회사 비행기를 고르게 섞고, 없으면 다른 항공사 기종', () => {
    const s = withFlights();
    const q = trafficQueue(visitingPlanes(s, 'seoul', 0), 2003, 'seoul');
    expect(q.slice(0, 2).map((v) => v.company)).toEqual([0, 1]);
    const empty = trafficQueue([], 2003, 'seoul');
    expect(empty.length).toBeGreaterThan(0);
    expect(empty.every((v) => v.company === null)).toBe(true);
  });
});
