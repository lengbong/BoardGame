import type { AirlineState, Award, AwardKind, AwardYear, CompanyReport } from './types';

/**
 * 연말 시상식 (Skytrax 시상식처럼): 해가 끝나면 그해 결산으로 부문마다 상을 준다.
 * 상마다 넘어야 하는 문턱이 있어서 혼자 하는 판에서도 그냥 받지는 못한다.
 */
export interface AwardInfo {
  name: string;
  icon: string;
  desc: string;
  /** 받으면 오르는 평판 */
  rep: number;
}

export const AWARD_KINDS: readonly AwardKind[] = ['airline', 'punctual', 'service', 'growth', 'hub'];

export const AWARD_INFO: Record<AwardKind, AwardInfo> = {
  airline: { name: '올해의 항공사', icon: '🏆', desc: '이익·손님·정시 운항·평판·성장을 모두 따져 가장 잘한 회사 (흑자여야 해요). 평판 +5, 열두 달 동안 손님 +3%', rep: 5 },
  punctual: { name: '정시 운항상', icon: '⏱️', desc: '한 해 정시 운항률이 가장 높은 회사 (82% 넘게, 한 해 500편 넘게). 평판 +3', rep: 3 },
  service: { name: '서비스상', icon: '🍽️', desc: '해가 끝날 때 평판이 가장 높은 회사 (65 넘게, 비행기 세 대 넘게). 평판 +2', rep: 2 },
  growth: { name: '성장상', icon: '📈', desc: '지난해보다 손님이 가장 많이 는 회사 (10% 넘게). 평판 +2', rep: 2 },
  hub: { name: '환승 허브상', icon: '🔁', desc: '갈아탄 손님이 가장 많은 회사 (손님의 5% 넘게). 평판 +2', rep: 2 },
};

/** 올해의 항공사가 받는 손님 효과 */
export const AIRLINE_AWARD_DEMAND = 1.03;
export const AIRLINE_AWARD_MONTHS = 12;

const pct = (v: number) => `${Math.round(v * 100)}%`;
const big = (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(v >= 100000 ? 0 : 1)}만` : Math.round(v).toLocaleString('ko-KR'));
/** 돈 (억): 1만 억이 넘으면 조 */
const money = (v: number) => (Math.abs(v) >= 10000 ? `${(v / 10000).toFixed(1).replace(/\.0$/, '')}조` : `${Math.round(v).toLocaleString('ko-KR')}억`);

/** 가장 큰 값을 가진 회사 (같으면 앞 회사) */
function top(cands: number[], score: (ci: number) => number): number | null {
  let best: number | null = null;
  for (const ci of cands) if (best === null || score(ci) > score(best)) best = ci;
  return best;
}

/**
 * 이 해의 상. year: 그해 결산(회사마다 열두 달 합), prev: 지난해 결산 (성장상).
 * 운항을 멈춘 회사는 받지 못한다.
 */
export function yearAwards(state: Pick<AirlineState, 'companies'>, yearNo: number, year: readonly CompanyReport[], prev?: readonly CompanyReport[]): AwardYear {
  const items: Award[] = [];
  const alive = state.companies.map((c, i) => (c.out || !year[i] ? -1 : i)).filter((i) => i >= 0);
  const add = (kind: AwardKind, ci: number | null, value: number, text: string) => {
    if (ci !== null) items.push({ kind, company: ci, value: Math.round(value * 1000) / 1000, text });
  };

  // 정시 운항상
  const punctual = alive.filter((i) => year[i].flights - year[i].cancelled >= 500 && year[i].onTime >= 0.82);
  const p = top(punctual, (i) => year[i].onTime);
  if (p !== null) add('punctual', p, year[p].onTime, `정시 운항률 ${pct(year[p].onTime)}`);

  // 서비스상
  const service = alive.filter((i) => state.companies[i].planes.length >= 3 && state.companies[i].reputation >= 65);
  const sv = top(service, (i) => state.companies[i].reputation);
  if (sv !== null) add('service', sv, state.companies[sv].reputation, `평판 ${Math.round(state.companies[sv].reputation)}`);

  // 성장상
  const growthOf = (i: number) => (prev?.[i] && prev[i].pax >= 20000 ? year[i].pax / prev[i].pax - 1 : -1);
  const growth = alive.filter((i) => growthOf(i) >= 0.1);
  const g = top(growth, growthOf);
  if (g !== null) add('growth', g, growthOf(g), `손님 ${pct(growthOf(g))} 늘어 ${big(year[g].pax)}명`);

  // 환승 허브상
  const hub = alive.filter((i) => year[i].xferPax >= 10000 && year[i].xferPax >= year[i].pax * 0.05);
  const h = top(hub, (i) => year[i].xferPax);
  if (h !== null) add('hub', h, year[h].xferPax, `갈아탄 손님 ${big(year[h].xferPax)}명`);

  // 올해의 항공사: 부문마다 순위 점수를 더한다 (흑자인 회사만)
  const cands = alive.filter((i) => year[i].profit > 0 && year[i].flights > 0);
  if (cands.length > 0) {
    const rankScore = (metric: (i: number) => number) => {
      const sorted = [...alive].sort((x, y) => metric(y) - metric(x));
      return (i: number) => (alive.length <= 1 ? 1 : 1 - sorted.indexOf(i) / (alive.length - 1));
    };
    const parts = [
      rankScore((i) => year[i].profit),
      rankScore((i) => year[i].pax),
      rankScore((i) => (year[i].flights > 0 ? year[i].onTime : 0)),
      rankScore((i) => state.companies[i].reputation),
      rankScore((i) => growthOf(i)),
    ];
    const weights = [2, 1.5, 1, 1, 1];
    const score = (i: number) => parts.reduce((s, f, k) => s + f(i) * weights[k], 0) + items.filter((x) => x.company === i).length * 0.3;
    const a = top(cands, score);
    // 혼자 하는 판이면 흑자에 정시 운항·평판까지 괜찮아야 준다
    const solo = alive.length <= 1;
    if (a !== null && (!solo || (year[a].onTime >= 0.8 && state.companies[a].reputation >= 60))) add('airline', a, score(a), `이익 ${money(year[a].profit)} · 손님 ${big(year[a].pax)}명`);
  }
  items.sort((x, y) => AWARD_KINDS.indexOf(x.kind) - AWARD_KINDS.indexOf(y.kind));
  return { year: yearNo, items };
}

/** 이 회사가 받은 상 개수 (종류마다) */
export function trophyCount(awards: readonly AwardYear[] | undefined, ci: number): Map<AwardKind, number> {
  const out = new Map<AwardKind, number>();
  for (const y of awards ?? []) for (const a of y.items) if (a.company === ci) out.set(a.kind, (out.get(a.kind) ?? 0) + 1);
  return out;
}
