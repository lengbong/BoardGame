import { MODEL } from './aircraft';
import { SHAPES } from './aircraftShapes';
import { FREIGHTER_SHAPES } from './freighterShapes';
import type { AirportMapData } from './airportTypes';
import { CITY, airportClass } from './cities';
import { legFreq } from './simulate';
import type { AirlineState } from './types';

/** 주기장에 선 비행기 한 대 (company가 null이면 게임에 없는 다른 항공사) */
export interface ParkedPlane {
  x: number;
  y: number;
  /** 코가 보는 방향 (도, 0 동쪽 · 90 남쪽) */
  hdg: number;
  model: string;
  company: number | null;
}

/** 이 공항을 드나드는 우리·라이벌 비행기 한 대 */
export interface VisitingPlane {
  company: number;
  model: string;
}

/** 이 도시를 지나는 노선을 나는 비행기들 (보는 회사 먼저) */
export function visitingPlanes(state: AirlineState, cityId: string, viewer: number): VisitingPlane[] {
  const out: VisitingPlane[] = [];
  const order = state.companies.map((_, i) => i).sort((a, b) => Number(b === viewer) - Number(a === viewer) || a - b);
  for (const ci of order) {
    const c = state.companies[ci];
    if (c.out) continue;
    const here = new Set(c.routes.filter((r) => r.a === cityId || r.b === cityId).map((r) => r.id));
    if (here.size === 0) continue;
    for (const p of c.planes) {
      if (p.check === state.t) continue;
      if ([...here].some((id) => legFreq(p, id) > 0)) out.push({ company: ci, model: p.model });
    }
  }
  return out;
}

/** 글자 → 늘 같은 난수 */
function seeded(text: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** 그 해 그 공항에 흔히 보이던 다른 항공사 기종 (공항 등급에 내릴 수 있는 여객기) */
export function backgroundModels(year: number, cls: number): string[] {
  return Object.values(MODEL)
    .filter((m) => !m.cargo && m.body !== 'sst' && SHAPES[m.id] && m.intro <= year && year <= m.end + 12 && m.runway <= cls)
    .map((m) => m.id);
}

/** 가장 긴 활주로 방향 (도) — 방향을 모르는 주기장에 쓴다 */
function mainHeading(map: AirportMapData): number {
  const r = map.rwy[0];
  if (!r) return 0;
  return (Math.atan2(r[3] - r[1], r[2] - r[0]) * 180) / Math.PI + 90;
}

/**
 * 주기장에 비행기를 세운다.
 * 이 공항을 드나드는 회사 비행기는 터미널 가까운 자리부터 회사끼리 모아 세우고,
 * 남은 자리 일부에는 공항 크기에 맞게 다른 항공사(회색) 비행기를 세운다.
 */
export function parkPlanes(map: AirportMapData, icao: string, cityId: string, year: number, visiting: VisitingPlane[], main = true): ParkedPlane[] {
  const st = map.stands ?? [];
  const stands: { x: number; y: number; hdg: number }[] = [];
  for (let i = 0; i + 2 < st.length; i += 3) stands.push({ x: st[i], y: st[i + 1], hdg: st[i + 2] < 0 ? mainHeading(map) : st[i + 2] });
  if (stands.length === 0) return [];
  const own = visiting.filter((v) => SHAPES[v.model] || FREIGHTER_SHAPES[v.model]).slice(0, stands.length);
  // 회사 비행기 자리: 터미널 가까운 자리들을 한 줄로 늘어놓아 회사끼리 이어지게
  const near = stands.slice(0, own.length);
  const cx = near.reduce((s, p) => s + p.x, 0) / Math.max(1, near.length);
  const cy = near.reduce((s, p) => s + p.y, 0) / Math.max(1, near.length);
  near.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  const out: ParkedPlane[] = own.map((v, i) => ({ ...near[i], model: v.model, company: v.company }));
  // 다른 항공사
  const rest = stands.slice(own.length);
  const cls = airportClass(CITY[cityId], year);
  const all = backgroundModels(year, cls);
  if (all.length === 0) return out;
  const rnd = seeded(`${icao}|${Math.floor(year / 5)}`);
  // 기종은 열 가지쯤만 (그림을 처음 그리는 시간이 짧게)
  const pool = [...all];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  pool.length = Math.min(pool.length, 10);
  // 함께 쓰는 공항(대표 공항이 아닌 곳)은 조금 한산하게
  const frac = (0.14 + 0.1 * cls) * (main ? 1 : 0.75);
  for (const s of rest) {
    if (rnd() > frac) continue;
    out.push({ ...s, model: pool[Math.floor(rnd() * pool.length)], company: null });
  }
  return out;
}

/** 이착륙 연출에 쓸 비행기 차례 (회사 비행기가 없으면 다른 항공사 기종) */
export function trafficQueue(visiting: VisitingPlane[], year: number, cityId: string): { company: number | null; model: string }[] {
  if (visiting.length > 0) {
    // 회사마다 고르게 섞는다
    const by = new Map<number, VisitingPlane[]>();
    for (const v of visiting) by.set(v.company, [...(by.get(v.company) ?? []), v]);
    const lists = [...by.values()];
    const out: VisitingPlane[] = [];
    for (let i = 0; out.length < Math.min(12, visiting.length); i++) for (const l of lists) if (l[i % l.length] && out.length < 12) out.push(l[i % l.length]);
    return out;
  }
  const pool = backgroundModels(year, airportClass(CITY[cityId], year));
  return pool.slice(0, 6).map((model) => ({ company: null, model }));
}
