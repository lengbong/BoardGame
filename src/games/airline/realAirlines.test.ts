import { describe, expect, it } from 'vitest';
import { MODELS } from './aircraft';
import { CITIES, CITY } from './cities';
import { IMAGE_CREDITS } from './imageCredits';
import { ALL_CREDITS, aircraftPhoto, airlinePhoto, cityPhoto, photoCredit } from './images';
import { REAL_AIRLINES, REAL_AIRLINE, airlinesAt, type RealAirline } from './realAirlines';

/** 쓸 수 있는 라이선스: 퍼블릭 도메인, CC0, CC BY, CC BY-SA (scripts/fetch-airline-images.py와 같음) */
const FREE_LICENSE = /^(public domain|pd\b|pd-|cc0|cc[ -]by(-sa)?[ -]\d)/i;

/** 두 항공사가 같은 해에 날았던 적이 있나 (defunct 해부터는 날지 않음) */
function overlaps(a: RealAirline, b: RealAirline): boolean {
  return a.founded < (b.defunct ?? Infinity) && b.founded < (a.defunct ?? Infinity);
}

describe('실제 항공사', () => {
  it('40곳 남짓, id가 겹치지 않고 이름이 있다', () => {
    expect(REAL_AIRLINES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(REAL_AIRLINES.map((a) => a.id)).size).toBe(REAL_AIRLINES.length);
    for (const a of REAL_AIRLINES) {
      expect(a.id).toMatch(/^[a-z][a-z0-9]*$/);
      expect(a.name).toMatch(/[가-힣]/);
      expect(a.nameEn.length).toBeGreaterThan(1);
      expect(REAL_AIRLINE[a.id]).toBe(a);
      if (a.note !== undefined) expect(a.note.length).toBeGreaterThan(3);
    }
  });

  it('IATA 부호는 두 글자이고, 같은 때 나는 회사끼리는 겹치지 않는다', () => {
    for (const a of REAL_AIRLINES) expect(a.iata).toMatch(/^(?![0-9]{2})[A-Z0-9]{2}$/);
    for (let i = 0; i < REAL_AIRLINES.length; i++) {
      for (let j = i + 1; j < REAL_AIRLINES.length; j++) {
        const [a, b] = [REAL_AIRLINES[i], REAL_AIRLINES[j]];
        if (a.iata === b.iata) expect(overlaps(a, b), `${a.id}·${b.id} (${a.iata})`).toBe(false);
      }
    }
  });

  it('본거지 도시가 있고 지역이 그 도시와 같다', () => {
    for (const a of REAL_AIRLINES) {
      expect(CITY[a.hub], `${a.id}의 본거지 ${a.hub}`).toBeDefined();
      expect(a.region, a.id).toBe(CITY[a.hub].region);
    }
  });

  it('해가 말이 된다', () => {
    for (const a of REAL_AIRLINES) {
      expect(Number.isInteger(a.founded)).toBe(true);
      expect(a.founded).toBeGreaterThanOrEqual(1910);
      expect(a.founded).toBeLessThanOrEqual(2026);
      if (a.defunct !== undefined) {
        expect(Number.isInteger(a.defunct)).toBe(true);
        expect(a.defunct, a.id).toBeGreaterThan(a.founded);
        expect(a.defunct, a.id).toBeLessThanOrEqual(2030);
      }
    }
  });

  it('색은 #rrggbb 두 가지이고 서로 다르다', () => {
    for (const a of REAL_AIRLINES) {
      expect(a.colors).toHaveLength(2);
      for (const c of a.colors) expect(c, a.id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(a.colors[0].toLowerCase()).not.toBe(a.colors[1].toLowerCase());
    }
  });

  it('1963~2040년 해마다 12곳 넘게, 4개 지역 넘게 날고 있다', () => {
    for (let y = 1963; y <= 2040; y++) {
      const flying = airlinesAt(y);
      expect(flying.length, `${y}년`).toBeGreaterThanOrEqual(12);
      expect(new Set(flying.map((a) => a.region)).size, `${y}년`).toBeGreaterThanOrEqual(4);
      expect(new Set(flying.map((a) => a.iata)).size, `${y}년 IATA 겹침`).toBe(flying.length);
    }
  });

  it('없어지거나 이름이 바뀐 해부터는 뒤를 잇는 회사만 난다', () => {
    const ids = (y: number) => airlinesAt(y).map((a) => a.id);
    expect(ids(1973)).toContain('boac');
    expect(ids(1973)).not.toContain('britishairways');
    expect(ids(1974)).toContain('britishairways');
    expect(ids(1974)).not.toContain('boac');
    expect(ids(2001)).toContain('swissair');
    expect(ids(2002)).toContain('swiss');
    expect(ids(2002)).not.toContain('swissair');
    expect(ids(1990)).toContain('panam');
    expect(ids(1992)).not.toContain('panam');
    expect(ids(1968)).not.toContain('korean');
    expect(ids(1969)).toContain('korean');
  });
});

describe('사진', () => {
  const files = Object.keys(import.meta.glob('./assets/*/*.webp'));
  const keys = files.map((f) => f.replace(/^\.\/assets\//, '').replace(/\.webp$/, ''));

  it('사진마다 자유 라이선스 출처가 있다', () => {
    for (const key of keys) {
      const credit = IMAGE_CREDITS[key];
      expect(credit, `${key} 출처`).toBeDefined();
      expect(credit.license, key).toMatch(FREE_LICENSE);
      expect(credit.license, key).not.toMatch(/\bNC\b|\bND\b|GFDL/i);
      expect(credit.file.length).toBeGreaterThan(4);
      expect(credit.author.length).toBeGreaterThan(0);
      expect(credit.author.length).toBeLessThanOrEqual(60);
      expect(credit.author).not.toMatch(/[<>]/);
      expect(credit.source).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(typeof credit.licenseUrl).toBe('string');
    }
  });

  it('출처만 있고 사진이 없는 것은 없다', () => {
    for (const key of Object.keys(IMAGE_CREDITS)) expect(keys, key).toContain(key);
  });

  it('사진 이름은 기종·도시·항공사 id와 맞는다', () => {
    const known = new Set([
      ...MODELS.map((m) => `aircraft/${m.id}`),
      ...CITIES.map((c) => `cities/${c.id}`),
      ...REAL_AIRLINES.map((a) => `airlines/${a.id}`),
    ]);
    for (const key of keys) expect(known.has(key), key).toBe(true);
  });

  it('사진 꺼내기 함수가 있는 사진은 주소를, 없는 것은 undefined를 준다', () => {
    for (const key of keys) {
      const [kind, id] = key.split('/');
      const get = { aircraft: aircraftPhoto, cities: cityPhoto, airlines: airlinePhoto }[kind];
      expect(get, key).toBeDefined();
      expect(typeof get!(id), key).toBe('string');
      expect(photoCredit(key)).toBe(IMAGE_CREDITS[key]);
    }
    expect(aircraftPhoto('nope')).toBeUndefined();
    expect(cityPhoto('constructor')).toBeUndefined();
    expect(airlinePhoto('toString')).toBeUndefined();
    expect(photoCredit('constructor')).toBeUndefined();
  });

  it('사진을 모두 합쳐 2.2MB를 넘지 않는다 (게임이 한 파일로 묶이므로)', () => {
    const inline = import.meta.glob('./assets/*/*.webp', { query: '?inline', import: 'default', eager: true }) as Record<string, string>;
    const bytes = Object.values(inline).reduce((sum, url) => sum + Math.floor((url.length - url.indexOf(',') - 1) * 0.75), 0);
    expect(Object.keys(inline)).toHaveLength(files.length);
    for (const url of Object.values(inline)) expect(url.startsWith('data:image/webp;base64,')).toBe(true);
    expect(bytes).toBeLessThanOrEqual(2_200_000);
  });

  it('출처 목록에 모든 사진이 이름과 함께 한 번씩 있다', () => {
    expect(ALL_CREDITS.map((c) => c.key).sort()).toEqual([...keys].sort());
    for (const c of ALL_CREDITS) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.title).not.toBe(c.key.split('/')[1]);
    }
  });
});
