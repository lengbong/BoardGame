import { MAX_ROUTES } from './limits';
import { companyValue, regionsServed } from './simulate';
import type { AirlineState, Company, CompanyReport, Grade, Review, Rng, YearAcc, YearGoal } from './types';

/**
 * 연간 목표와 경영 평가: 해마다 작은 목표 2~3개를 받고, 해가 끝나면 S~D 등급과 짧은 평을 받는다.
 */

export function freshAcc(state: AirlineState, ci: number, year: number, lastPax: number): YearAcc {
  const c = state.companies[ci];
  return {
    year,
    pax: 0,
    seats: 0,
    xfer: 0,
    revenue: 0,
    profit: 0,
    profitQ: 0,
    qProfit: 0,
    quarters: 0,
    bought: 0,
    startValue: Math.round(companyValue(state, ci)),
    startRegions: regionsServed(c).size,
    startRoutes: c.routes.length,
    lastPax,
  };
}

/** 달 결과를 올해 숫자에 더한다 */
export function addMonth(acc: YearAcc, rep: CompanyReport): YearAcc {
  return {
    ...acc,
    pax: acc.pax + rep.pax,
    seats: acc.seats + rep.seats,
    xfer: acc.xfer + rep.xferPax,
    revenue: acc.revenue + rep.ticket + rep.side,
    profit: acc.profit + rep.profit,
    qProfit: acc.qProfit + rep.profit,
  };
}

/** 분기가 끝나면: 그 분기가 흑자였는지 센다 */
export function closeQuarter(acc: YearAcc): YearAcc {
  return { ...acc, profitQ: acc.profitQ + (acc.qProfit > 0 ? 1 : 0), quarters: acc.quarters + 1, qProfit: 0 };
}

function rewardFor(state: AirlineState, ci: number): { cash: number; rep: number } {
  const v = companyValue(state, ci);
  return { cash: Math.round(Math.max(20, Math.min(600, v * 0.02)) / 5) * 5, rep: 3 };
}

/** 올해 목표 2~3개 */
export function newGoals(state: AirlineState, ci: number, rng: Rng): YearGoal[] {
  const c = state.companies[ci];
  const reward = rewardFor(state, ci);
  const regions = regionsServed(c).size;
  const pool: Omit<YearGoal, 'done'>[] = [];
  pool.push({ kind: 'lf', target: 0.88, text: '올해 탑승률 88% 넘기기', reward });
  pool.push({ kind: 'profit4', target: 4, text: '올해 네 분기 모두 흑자', reward: { cash: reward.cash, rep: 4 } });
  if (regions < 6) pool.push({ kind: 'region', target: regions + 1, text: '새 지역에 취항하기', reward });
  if (c.routes.length <= MAX_ROUTES - 2) pool.push({ kind: 'routes', target: c.routes.length + 2, text: '노선 2개 늘리기', reward });
  if (c.acc.pax > 0 || c.acc.lastPax > 0) {
    const last = Math.max(c.acc.pax, c.acc.lastPax);
    pool.push({ kind: 'pax', target: Math.round(last * 1.15), text: '손님 15% 늘리기', reward });
  }
  pool.push({ kind: 'value', target: Math.round(companyValue(state, ci) * 1.1), text: '회사 가치 10% 키우기', reward: { cash: reward.cash, rep: 4 } });
  pool.push({ kind: 'fleet', target: 2, text: '새 비행기 2대 들이기', reward });
  if (c.routes.filter((r) => r.a === c.hub || r.b === c.hub).length >= 3) pool.push({ kind: 'xfer', target: 2000, text: '갈아타는 손님 2천 명 태우기', reward });
  const out: YearGoal[] = [];
  const bag = [...pool];
  const count = 3;
  while (out.length < count && bag.length) {
    const k = Math.floor(rng() * bag.length);
    out.push({ ...bag[k], done: null });
    bag.splice(k, 1);
  }
  return out;
}

/** 목표를 이루었는지 (해가 끝날 때) */
export function goalMet(state: AirlineState, ci: number, g: YearGoal): boolean {
  const c = state.companies[ci];
  const a = c.acc;
  switch (g.kind) {
    case 'lf':
      return a.seats > 0 && a.pax / a.seats >= g.target;
    case 'profit4':
      return a.profitQ >= 4;
    case 'region':
      return regionsServed(c).size >= g.target;
    case 'routes':
      return c.routes.length >= g.target;
    case 'pax':
      return a.pax >= g.target;
    case 'value':
      return companyValue(state, ci) >= g.target;
    case 'fleet':
      return a.bought >= g.target;
    case 'xfer':
      return a.xfer >= g.target;
  }
}

/** 시작값에서 목표까지 얼마나 왔는지 (0~1) */
const part = (now: number, start: number, target: number) => (target <= start ? (now >= target ? 1 : 0) : Math.max(0, Math.min(1, (now - start) / (target - start))));

/** 지금까지 얼마나 했는지 (0~1, 화면용) */
export function goalProgress(state: AirlineState, ci: number, g: YearGoal): number {
  const c = state.companies[ci];
  const a = c.acc;
  switch (g.kind) {
    case 'lf':
      return a.seats > 0 ? Math.min(1, a.pax / a.seats / g.target) : 0;
    case 'profit4':
      return Math.min(1, a.profitQ / 4);
    case 'region':
      return part(regionsServed(c).size, a.startRegions, g.target);
    case 'routes':
      return part(c.routes.length, a.startRoutes, g.target);
    case 'pax':
      return Math.min(1, a.pax / Math.max(1, g.target));
    case 'value':
      return part(companyValue(state, ci), a.startValue, g.target);
    case 'fleet':
      return Math.min(1, a.bought / g.target);
    case 'xfer':
      return Math.min(1, a.xfer / g.target);
  }
}

/** 한 해 경영 평가 */
export function gradeYear(state: AirlineState, ci: number, goals: YearGoal[]): Review {
  const c: Company = state.companies[ci];
  const a = c.acc;
  const margin = a.revenue > 0 ? a.profit / a.revenue : a.profit >= 0 ? 0 : -1;
  const value = companyValue(state, ci);
  const growth = a.startValue > 0 ? value / a.startValue - 1 : value > a.startValue ? 0.1 : -0.1;
  const lf = a.seats > 0 ? a.pax / a.seats : 0;
  const met = goals.filter((g) => g.done).length;
  let score = 0;
  score += margin > 0.28 ? 3 : margin > 0.18 ? 2 : margin > 0.06 ? 1 : 0;
  score += growth > 0.4 ? 3 : growth > 0.15 ? 2 : growth > 0.03 ? 1 : 0;
  score += lf > 0.95 ? 2 : lf > 0.85 ? 1 : 0;
  score += met;
  const grade: Grade = score >= 10 ? 'S' : score >= 8 ? 'A' : score >= 5 ? 'B' : score >= 3 ? 'C' : 'D';
  const good: string[] = [];
  const bad: string[] = [];
  if (margin > 0.2) good.push(`이익률이 ${Math.round(margin * 100)}%로 튼튼해요`);
  else if (margin <= 0) bad.push('올해는 적자였어요 — 손해 보는 노선을 줄이고 운임을 살펴보세요');
  else if (margin < 0.05) bad.push(`이익률이 ${Math.round(margin * 100)}%로 낮아요 — 비용이 큰 노선을 살펴보세요`);
  if (growth > 0.15) good.push(`회사 가치가 ${Math.round(growth * 100)}% 자랐어요`);
  else if (growth < 0) bad.push('회사 가치가 줄었어요');
  if (lf > 0.92) good.push(`탑승률 ${Math.round(lf * 100)}%로 좌석을 알차게 채웠어요`);
  else if (a.seats > 0 && lf < 0.75) bad.push(`탑승률이 ${Math.round(lf * 100)}%예요 — 빈 좌석이 많아요`);
  if (a.xfer > 5000) good.push(`갈아타는 손님 ${Math.round(a.xfer / 1000)}천 명이 우리 허브를 지나갔어요`);
  if (a.seats === 0) bad.push('아직 띄운 비행기가 없어요');
  const text = [good[0], bad[0] ?? good[1]].filter(Boolean).join('. ') + (good.length + bad.length ? '.' : '조용한 한 해였어요.');
  return { year: a.year, grade, text, met, total: goals.length };
}

export const GRADE_INFO: Record<Grade, { color: string; word: string }> = {
  S: { color: '#d4a106', word: '최고예요!' },
  A: { color: '#2f9e6a', word: '아주 잘했어요' },
  B: { color: '#3f8fbf', word: '잘했어요' },
  C: { color: '#c27a00', word: '조금 아쉬워요' },
  D: { color: '#c93434', word: '힘든 한 해' },
};
