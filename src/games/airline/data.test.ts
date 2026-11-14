import { describe, expect, it } from 'vitest';
import { MODELS, availableModels } from './aircraft';
import { CHALLENGES } from './challenges';
import { CITIES, CITY, REGIONS, airportClass } from './cities';
import { FIXED_EVENTS } from './events';
import { hubCandidates } from './rules';
import { LAND, MAP_H, MAP_W, WATER, distanceToShape, insideShape, project } from './worldmap';

describe('도시', () => {
  it('50개 남짓 도시가 여섯 지역에 고루 있고, 값이 알맞은 범위에 있다', () => {
    expect(CITIES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(CITIES.map((c) => c.id)).size).toBe(CITIES.length);
    for (const r of REGIONS) expect(CITIES.filter((c) => c.region === r).length).toBeGreaterThanOrEqual(6);
    for (const c of CITIES) {
      expect(c.size).toHaveLength(8);
      expect(c.airport).toHaveLength(8);
      for (const v of c.size) expect(v).toBeGreaterThan(0.2);
      for (const v of c.size) expect(v).toBeLessThanOrEqual(10);
      for (const v of c.airport) expect([1, 2, 3, 4]).toContain(v);
      // 공항은 시대가 지나며 작아지지 않는다
      for (let i = 1; i < 8; i++) expect(c.airport[i]).toBeGreaterThanOrEqual(c.airport[i - 1]);
      expect(c.biz).toBeGreaterThanOrEqual(0);
      expect(c.biz).toBeLessThanOrEqual(1);
      expect(c.fun).toBeGreaterThanOrEqual(0);
      expect(c.fun).toBeLessThanOrEqual(10);
      expect(c.desc.length).toBeGreaterThan(10);
      expect(Math.abs(c.lat)).toBeLessThan(60);
    }
  });

  it('시작 해마다 본사로 고를 수 있는 도시가 넉넉하다', () => {
    for (const y of [1963, 1983, 2003]) expect(hubCandidates(y).length).toBeGreaterThanOrEqual(20);
    expect(airportClass(CITY.kathmandu, 2003)).toBeLessThan(3);
  });

  it('도시는 모두 지도 안, 육지 위(또는 해안선 바로 옆)에 있다', () => {
    for (const c of CITIES) {
      const p = project(c.lon, c.lat);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(MAP_W);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(MAP_H);
      const onLand = LAND.some((s) => insideShape(p.x, p.y, s.pts));
      const near = Math.min(...LAND.map((s) => distanceToShape(p.x, p.y, s.pts)));
      expect(onLand || near < 1.5, c.name).toBe(true);
    }
    for (const s of [...LAND, ...WATER]) {
      expect(s.pts.length).toBeGreaterThanOrEqual(3);
      for (const [lon, lat] of s.pts) {
        expect(Math.abs(lon)).toBeLessThanOrEqual(180);
        expect(Math.abs(lat)).toBeLessThanOrEqual(90);
      }
    }
  });
});

describe('기종', () => {
  it('실제 기종 40여 개: 해·좌석·거리가 그럴듯하다', () => {
    expect(MODELS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(MODELS.map((m) => m.id)).size).toBe(MODELS.length);
    for (const m of MODELS) {
      expect(m.intro).toBeLessThanOrEqual(m.end);
      expect(m.seats).toBeGreaterThanOrEqual(40);
      expect(m.seats).toBeLessThanOrEqual(600);
      expect(m.range).toBeGreaterThanOrEqual(1400);
      expect(m.range).toBeLessThanOrEqual(17000);
      expect(m.speed).toBeGreaterThan(400);
      expect(m.price).toBeGreaterThan(50);
      expect(m.burn).toBeGreaterThan(0.5);
      expect(m.comfort).toBeGreaterThanOrEqual(1);
      expect(m.comfort).toBeLessThanOrEqual(5);
    }
    const names = MODELS.map((m) => m.name);
    for (const n of ['707-320B', '727-200', '737-200', '747-100', 'DC-10-30', 'A300B4', '콩코드', '767-300ER', '757-200', 'A320', 'MD-82', '747-400', '777-200ER', 'A330-300', 'A340-300', '737-800', 'A380', '787-9', 'A350-900', 'A220-300']) {
      expect(names).toContain(n);
    }
  });

  it('어느 시작 해든 짧은·중간·먼 노선에 쓸 기종이 있다', () => {
    for (const y of [1963, 1983, 2003]) {
      const ms = availableModels(y);
      expect(ms.some((m) => m.runway === 1)).toBe(true);
      expect(ms.some((m) => m.seats >= 100 && m.seats <= 200)).toBe(true);
      expect(Math.max(...ms.map((m) => m.range))).toBeGreaterThanOrEqual(9000);
    }
  });
});

describe('사건과 도전 과제', () => {
  it('올림픽·엑스포는 게임 도시에서 열린 진짜 해이고, 분기는 1~4', () => {
    for (const e of FIXED_EVENTS) {
      expect(CITY[e.city]).toBeTruthy();
      expect(e.quarters.every((q) => q >= 1 && q <= 4)).toBe(true);
    }
    const key = (e: (typeof FIXED_EVENTS)[number]) => `${e.year}-${e.city}-${e.kind}`;
    const keys = FIXED_EVENTS.map(key);
    expect(keys).toContain('1988-seoul-olympic');
    expect(keys).toContain('1964-tokyo-olympic');
    expect(keys).toContain('2010-shanghai-expo');
    expect(keys).toContain('1970-osaka-expo');
  });

  it('도전 과제 8가지: 본사 공항이 쓸 만하고, 처음 비행기는 그때 있던 기종이다', () => {
    expect(CHALLENGES.length).toBe(8);
    for (const c of CHALLENGES) {
      expect(CITY[c.hub]).toBeTruthy();
      expect(airportClass(CITY[c.hub], c.year)).toBeGreaterThanOrEqual(2);
      const hubs = [c.hub, ...c.rivals.map((r) => r.hub)];
      expect(new Set(hubs).size).toBe(hubs.length);
      for (const f of c.fleet ?? []) {
        const m = MODELS.find((x) => x.id === f.model)!;
        expect(m).toBeTruthy();
        expect(m.intro).toBeLessThanOrEqual(c.year - Math.floor(f.age));
      }
      expect(c.goal.length).toBeGreaterThan(10);
    }
  });
});
