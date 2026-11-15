import { MODEL } from './aircraft';
import { sizeSeats } from './freighters';
import { CITY, citySize, dist } from './cities';
import { yearOf } from './time';
import type { AirlineState, Company, StaffGroup, StaffState } from './types';

/**
 * 직원과 조직: 조종사·객실 승무원·정비사·지상직. 필요한 사람 수는 비행시간·좌석·비행기 나이·지점·손님으로 정하고,
 * 뽑는 데는 몇 달이 걸린다. 모자라면 초과 근무로 조금은 버티지만 그 넘게는 결항이 난다.
 * 임금 수준·초과 근무·성장으로 조직 만족도가 움직이고, 만족도가 정시 운항·서비스·파업에 닿는다.
 */

export const STAFF_GROUPS: readonly StaffGroup[] = ['pilot', 'cabin', 'tech', 'ground'];

export interface StaffInfo {
  name: string;
  icon: string;
  /** 2000년 무렵 한 사람 달 임금 (억, 임금 수준 1) */
  salary: number;
  /** 뽑아서 일을 시작하기까지 (달) */
  hire: number;
  /** 서둘러 뽑으면 (달) */
  fast: number;
  /** 훈련원이 있으면 (달) */
  academy: number;
  /** 한 사람 뽑는 데 드는 돈 (달 임금의 몇 배) */
  hireCost: number;
}

export const STAFF_INFO: Record<StaffGroup, StaffInfo> = {
  pilot: { name: '조종사', icon: '🧑‍✈️', salary: 0.12, hire: 5, fast: 4, academy: 3, hireCost: 3 },
  cabin: { name: '객실 승무원', icon: '💁', salary: 0.035, hire: 2, fast: 1, academy: 1, hireCost: 1.5 },
  tech: { name: '정비사', icon: '🔧', salary: 0.045, hire: 3, fast: 2, academy: 2, hireCost: 2 },
  ground: { name: '지상직', icon: '🧳', salary: 0.03, hire: 1, fast: 1, academy: 1, hireCost: 1 },
};

/** 승무원·정비비 가운데 직원 임금으로 따로 셈하는 몫 (나머지는 노선 비용) */
export const STAFF_SHARE = 0.2;
/** 초과 근무로 버틸 수 있는 정도 (필요 인원의 15%까지) */
export const OVERTIME = 0.15;
/** 훈련원 짓는 값과 달 유지비 (억) */
export const ACADEMY_COST = 160;
export const ACADEMY_UPKEEP = 2.5;
/** 임금 수준 범위 */
export const PAY_MIN = 0.8;
export const PAY_MAX = 1.3;

/** 해마다 임금 배수 (오늘 돈 기준, 옛날일수록 조금 낮다) */
export function wageFactor(year: number): number {
  const pts: [number, number][] = [
    [1960, 0.75],
    [2000, 1],
    [2040, 1.15],
  ];
  if (year <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (year <= pts[i][0]) {
      const [y0, v0] = pts[i - 1];
      const [y1, v1] = pts[i];
      return v0 + ((v1 - v0) * (year - y0)) / (y1 - y0);
    }
  }
  return pts[pts.length - 1][1];
}

/** 한 사람 달 임금 (억, 임금 수준 1) */
export function salary(state: Pick<AirlineState, 'q'>, group: StaffGroup): number {
  return STAFF_INFO[group].salary * wageFactor(yearOf(state.q));
}

export function emptyStaff(): Record<StaffGroup, StaffState> {
  return {
    pilot: { have: 28, pay: 1, pipe: [] },
    cabin: { have: 45, pay: 1, pipe: [] },
    tech: { have: 16, pay: 1, pipe: [] },
    ground: { have: 30, pay: 1, pipe: [] },
  };
}

/** 비행기 한 대가 한 주에 쓰는 비행시간 (노선 정보로) */
function weekHours(c: Company, legs: { route: number; freq: number }[], model: string): number {
  const m = MODEL[model];
  let h = 0;
  for (const l of legs) {
    const r = c.routes.find((x) => x.id === l.route);
    if (r) h += 2 * (dist(r.a, r.b) / m.speed + 0.75) * l.freq;
  }
  return h;
}

const needCache = new WeakMap<Company, { t: number; need: Record<StaffGroup, number> }>();

/** 회사에 필요한 사람 수 (그룹마다). 같은 회사·같은 달이면 다시 셈하지 않는다 */
export function staffNeed(state: Pick<AirlineState, 'q' | 't'>, c: Company): Record<StaffGroup, number> {
  const hit = needCache.get(c);
  if (hit && hit.t === state.t) return hit.need;
  const need = computeNeed(state, c);
  needCache.set(c, { t: state.t, need });
  return need;
}

function computeNeed(state: Pick<AirlineState, 'q' | 't'>, c: Company): Record<StaffGroup, number> {
  let pilot = 0;
  let cabin = 0;
  let tech = 0;
  const weeks = 52 / 12;
  for (const p of c.planes) {
    const m = MODEL[p.model];
    const block = weekHours(c, p.legs, p.model) * weeks;
    const age = Math.max(0, (state.t - p.since) / 12);
    pilot += (block * 2) / 70;
    cabin += (block * Math.ceil(m.seats / 50)) / 75;
    const cycles = p.legs.reduce((s, l) => s + l.freq * 2 * weeks, 0);
    tech += 5 * (sizeSeats(m) / 150) ** 0.6 * (1 + 0.02 * age) + cycles * 0.002;
  }
  let ground = 0;
  const year = yearOf(state.q);
  for (const b of c.branches) ground += 6 + 0.6 * citySize(CITY[b], year);
  // 손님이 많을수록 공항·판매 인력이 는다 (지난달 손님으로 어림)
  let pax = 0;
  for (const r of c.routes) pax += r.stats?.pax ?? 0;
  ground += pax / 8000;
  return { pilot: Math.ceil(pilot), cabin: Math.ceil(cabin), tech: Math.ceil(tech), ground: Math.ceil(ground) };
}

/** 그룹마다 일손이 채워진 정도 (지금 사람 ÷ 필요, 1 넘으면 넉넉) */
export function coverage(need: Record<StaffGroup, number>, c: Company): Record<StaffGroup, number> {
  const out = {} as Record<StaffGroup, number>;
  for (const g of STAFF_GROUPS) out[g] = need[g] <= 0 ? 1 : c.staff[g].have / need[g];
  return out;
}

/**
 * 일손 때문에 뜰 수 있는 비율 (조종사·객실 승무원, 초과 근무 15%까지 버틴다). 1이면 모두 뜬다.
 */
export function staffCap(need: Record<StaffGroup, number>, c: Company): number {
  const cov = coverage(need, c);
  return Math.min(1, cov.pilot * (1 + OVERTIME), cov.cabin * (1 + OVERTIME));
}

/** 초과 근무 정도 (가장 모자란 운항 인력 그룹, 0이면 넉넉) */
export function overtime(need: Record<StaffGroup, number>, c: Company): number {
  let worst = 0;
  for (const g of ['pilot', 'cabin', 'tech'] as const) {
    if (need[g] <= 0) continue;
    const have = c.staff[g].have;
    worst = Math.max(worst, have <= 0 ? 1 : Math.max(0, need[g] / have - 1));
  }
  return Math.min(1, worst);
}

/** 사람 수로 고른 평균 임금 수준 */
export function avgPay(c: Company): number {
  let n = 0;
  let sum = 0;
  for (const g of STAFF_GROUPS) {
    const w = c.staff[g].have * STAFF_INFO[g].salary;
    n += w;
    sum += w * c.staff[g].pay;
  }
  return n > 0 ? sum / n : 1;
}

/** 조직 만족도가 향하는 값과 그 까닭 */
export function moraleTarget(state: Pick<AirlineState, 'q' | 't'>, c: Company): { value: number; pay: number; overtime: number; growth: number; academy: number; shock: number } {
  const need = staffNeed(state, c);
  const pay = (avgPay(c) - 1) * 120;
  const ot = -overtime(need, c) * 120;
  const flying = c.planes.filter((p) => p.legs.length > 0).length;
  const growth = flying > 0 && c.orders.length + c.routes.filter((r) => r.since >= state.t - 12).length >= 3 ? 4 : 0;
  const academy = c.academy ? 4 : 0;
  const shock = -c.shock;
  const value = Math.max(0, Math.min(100, 62 + pay + ot + growth + academy + shock));
  return { value, pay, overtime: ot, growth, academy, shock };
}

/** 이번 달 파업이 날 확률 (만족도가 아주 낮을 때만) */
export function strikeChance(c: Company): number {
  return c.morale < 30 ? ((30 - c.morale) / 30) * 0.12 : 0;
}

/** 뽑아서 일을 시작하기까지 걸리는 달 (훈련원이 있으면 짧고, 서두르면 한 달 줄어든다) */
export function hireTime(c: Company, group: StaffGroup, fast: boolean): number {
  const info = STAFF_INFO[group];
  const base = c.academy ? info.academy : info.hire;
  return Math.max(1, fast ? base - 1 : base);
}

/** n명 뽑는 데 드는 돈 */
export function hireCost(state: Pick<AirlineState, 'q'>, c: Company, group: StaffGroup, n: number, fast: boolean): number {
  return Math.round(n * salary(state, group) * STAFF_INFO[group].hireCost * (fast ? 1.6 : 1) * (c.academy ? 0.6 : 1) * 100) / 100;
}

/** n명 내보내는 돈 (석 달 치 임금) */
export function fireCost(state: Pick<AirlineState, 'q'>, c: Company, group: StaffGroup, n: number): number {
  return Math.round(n * salary(state, group) * c.staff[group].pay * 3 * 100) / 100;
}

/** 이번 달 직원 비용: 임금 + 훈련 중 사람(반 임금) + 초과 근무 + 훈련원 유지비 */
export function payroll(state: Pick<AirlineState, 'q' | 't'>, c: Company, need = staffNeed(state, c)): number {
  let v = 0;
  for (const g of STAFF_GROUPS) {
    const s = c.staff[g];
    const wage = salary(state, g) * s.pay;
    v += s.have * wage;
    for (const p of s.pipe) v += p.n * wage * 0.5;
    // 모자란 만큼 초과 근무 (15%까지, 1.5배 임금)
    const short = Math.max(0, Math.min(need[g] - s.have, s.have * OVERTIME));
    v += short * wage * 1.5;
  }
  if (c.academy) v += ACADEMY_UPKEEP;
  return v;
}

/** 모든 직원 수 */
export function staffTotal(c: Company): number {
  return STAFF_GROUPS.reduce((s, g) => s + c.staff[g].have, 0);
}

/** 뽑는 중인 사람 수 */
export function staffPipe(c: Company, g: StaffGroup): number {
  return c.staff[g].pipe.reduce((s, p) => s + p.n, 0);
}
