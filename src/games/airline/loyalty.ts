import { CAMPAIGN_INFO } from './ads';
import { alliesOf } from './alliances';
import { CITY, REGIONS } from './cities';
import { countFacility } from './facilities';
import { isFreighter } from './freighters';
import { MODEL } from './aircraft';
import { yearOf } from './time';
import type { AirlineState, Company, CompanyReport, RegionId } from './types';
import type { BrandPos, LoyaltyLevel, LoyaltyState } from './loyaltyTypes';

/**
 * 단골 손님 프로그램 (게임 속 이름: '하늘길 단골 손님', 실제 회원 제도의 이름은 쓰지 않는다).
 *
 * - 회사가 프로그램을 시작하면(1981년부터) 그 지역에 닿는 우리 손님 가운데 회원이 천천히 모인다 (지역마다).
 *   광고로 많이 알려진 지역, 평판이 좋은 회사, '마일리지 두 배' 캠페인 동안, 동맹 회사도 프로그램이 있으면 더 빨리 모인다.
 * - 회원은 우리 비행기를 더 고른다 (사업 손님은 더, 관광 손님은 조금). 운임이 조금 비싸도 덜 떠난다 (가격에 덜 민감).
 * - 단계: 기본(적립) → 실버(좌석 승급) → 골드(라운지 초대). 높을수록 회원이 많이 모이고 효과가 크지만 돈도 많이 든다.
 * - 돈: 시작·올리는 값, 달마다 운영비(회사 크기에 따라)와 마일리지 값(회원이 탄 만큼, 운임 수입의 몇 %). 광고비에 함께 든다.
 *   그만두면 남은 마일리지를 정리하는 값(지난달 값의 두 배)을 한 번 낸다.
 * - 회원은 천천히 떠난다: 정시 운항률이 낮거나 평판이 나쁘면 더 빨리, 그 지역 노선을 크게 줄이면 더 빨리
 *   (동맹 회사가 그 지역을 날면 동맹 회사 비행기로도 적립되어 덜 떠난다).
 * - 동맹 마일리지(alliances.ts, 회사마다 손님 +1.5%)는 그대로 두고, 우리 프로그램의 손님 끌기에 동맹 몫을 또 더하지 않는다
 *   (한 번만 센다). 동맹은 회원이 모이고 남는 데에만 돕는다.
 *
 * 손님 끌기(loyaltyQuality)는 시장 나누기에서 아주 자주 불리므로 저장된 값(지역마다 회원 몫·브랜드 힘)만 읽는다 (O(1)).
 * 회원 몫은 달 결산 때 한 번 다시 셈한다 (loyaltyRules.ts).
 */

/** 단골 프로그램을 시작할 수 있는 해 */
export const LOYALTY_FROM = 1981;

export interface LevelInfo {
  name: string;
  icon: string;
  /** 회원 혜택 (짧은 글) */
  perk: string;
  /** 회원 몫이 1일 때 사업·관광 손님 끌기 더하기 */
  biz: number;
  leisure: number;
  /** 회원 몫이 1일 때 가격에 덜 민감한 정도 (운임 배수의 지수에 더한다) */
  tolBiz: number;
  tolLeisure: number;
  /** 우리 단골 손님 가운데 회원이 될 수 있는 몫 */
  cap: number;
  /** 달마다 떠나는 회원 (보통 때) */
  churn: number;
  /** 회원이 탄 운임의 이만큼을 마일리지 값으로 */
  reward: number;
  /** 달 운영비: 바탕 + 손님 비행기 한 대마다 (억) */
  upkeep: number;
  upkeepPerPlane: number;
  /** 이 단계로 올리는 값: 바탕 + 비행기 한 대마다 (억) */
  fee: number;
  feePerPlane: number;
}

export const LOYALTY_LEVELS: Record<LoyaltyLevel, LevelInfo> = {
  1: {
    name: '기본',
    icon: '💳',
    perk: '타면 적립, 모으면 공짜 표',
    biz: 0.08,
    leisure: 0.03,
    tolBiz: 0.1,
    tolLeisure: 0.05,
    cap: 0.45,
    churn: 0.012,
    reward: 0.004,
    upkeep: 2,
    upkeepPerPlane: 0.12,
    fee: 20,
    feePerPlane: 1,
  },
  2: {
    name: '실버',
    icon: '🥈',
    perk: '좌석 승급·먼저 타기',
    biz: 0.12,
    leisure: 0.045,
    tolBiz: 0.18,
    tolLeisure: 0.08,
    cap: 0.6,
    churn: 0.009,
    reward: 0.0083,
    upkeep: 4.5,
    upkeepPerPlane: 0.26,
    fee: 20,
    feePerPlane: 1,
  },
  3: {
    name: '골드',
    icon: '🥇',
    perk: '라운지 초대·전용 창구·짐 먼저',
    biz: 0.16,
    leisure: 0.06,
    tolBiz: 0.26,
    tolLeisure: 0.11,
    cap: 0.72,
    churn: 0.006,
    reward: 0.0155,
    upkeep: 11,
    upkeepPerPlane: 0.55,
    fee: 30,
    feePerPlane: 1.5,
  },
};

export const LOYALTY_LEVEL_LIST: readonly LoyaltyLevel[] = [1, 2, 3];

/** 프로그램 이름 (지어낸 이름) */
export const LOYALTY_NAME = '하늘길 단골 손님';

/** 골드: 우리 라운지가 있으면 남의 라운지를 빌리지 않아 운영비가 준다 */
export const GOLD_LOUNGE_SAVE = 0.8;
/** 우리 단골 손님 수 = 지역에 닿는 달 손님 × 이만큼 (회원이 될 수 있는 사람들) */
export const POOL_K = 1.2;
/** 회원이 모이는 빠르기 바탕 (모자란 만큼의 이 몫이 달마다 가입) */
export const JOIN_RATE = 0.09;
/** '마일리지 두 배' 캠페인 동안 가입 배수 */
export const MILES_JOIN = 1.6;
/** 동맹 회사 한 곳(프로그램이 있는)마다 가입 배수 더하기 */
export const ALLY_JOIN = 0.15;
/** 그만둘 때 남은 마일리지 정리: 지난달 프로그램 값의 이 배 */
export const SETTLE_MONTHS = 2;
/** 단계를 내리면 바로 떠나는 회원 */
export const DOWNGRADE_LOSS = 0.1;

/** 브랜드 자리의 효과 (브랜드 힘 100일 때). 이름·설명은 brandPosition.ts */
export interface BrandEffect {
  biz: number;
  leisure: number;
  tolBiz: number;
  tolLeisure: number;
}

export const BRAND_EFFECT: Record<BrandPos, BrandEffect> = {
  // 사업 손님은 제때 뜨는 회사를 믿고, 조금 비싸도 탄다
  ontime: { biz: 0.06, leisure: 0, tolBiz: 0.1, tolLeisure: 0 },
  // 따뜻한 서비스는 사업·관광 손님 모두, 조금 비싸도 탄다
  service: { biz: 0.04, leisure: 0.03, tolBiz: 0.08, tolLeisure: 0.06 },
  // 싼 표를 찾는 관광 손님이 먼저 찾아온다 (가격에는 그대로 민감하다)
  value: { biz: 0.01, leisure: 0.06, tolBiz: 0, tolLeisure: 0 },
  // 어디든 가는 회사: 모든 손님이 조금씩
  network: { biz: 0.035, leisure: 0.035, tolBiz: 0, tolLeisure: 0 },
};

export const emptyRegionMap = (v = 0): Record<RegionId, number> => ({ eastasia: v, seaoc: v, southmid: v, europe: v, africa: v, americas: v });

const isLcc = (c: Pick<Company, 'bizModel'>) => c.bizModel === 'lcc';
const isCargo = (c: Pick<Company, 'bizModel'>) => c.bizModel === 'cargo';

/** 손님을 태우는 비행기 수 */
export function paxPlanes(c: Pick<Company, 'planes'>): number {
  let n = 0;
  for (const p of c.planes) if (!isFreighter(MODEL[p.model])) n++;
  return n;
}

export function loyaltyLevel(c: Pick<Company, 'loyalty'>): 0 | LoyaltyLevel {
  return c.loyalty?.level ?? 0;
}

/** 이 회사가 둘 수 있는 가장 높은 단계 (저가항공은 기본까지, 화물 전문은 없음) */
export function maxLevel(c: Pick<Company, 'bizModel'>): 0 | LoyaltyLevel {
  if (isCargo(c)) return 0;
  return isLcc(c) ? 1 : 3;
}

// ------------------------------------------------------------------ 손님 끌기 (시장 나누기에서 아주 자주 불린다)

/**
 * 회원과 브랜드의 손님 끌기를 회사 매력(평판·광고)에 곱한다. q는 막 만든 값이라 그대로 고쳐 돌려준다.
 * fare: 일반석 운임 조정 (%) — 회원·브랜드는 비쌀 때 덜 떠나고 쌀 때 덜 몰린다 (가격에 덜 민감).
 * 저장된 값만 읽는다: 프로그램·브랜드가 없으면 아무것도 하지 않는다.
 */
export function loyaltyQuality<Q extends { biz: number; leisure: number }>(q: Q, c: Company, a: string, b: string, fare: number): Q {
  const L = c.loyalty;
  const B = c.brandPos;
  if (!L && !B) return q;
  let mb = 1;
  let ml = 1;
  let tb = 0;
  let tl = 0;
  if (L) {
    const ra = CITY[a].region;
    const rb = CITY[b].region;
    const pen = ra === rb ? L.pen[ra] : (L.pen[ra] + L.pen[rb]) / 2;
    if (pen > 0) {
      const lv = LOYALTY_LEVELS[L.level];
      mb += lv.biz * pen;
      ml += lv.leisure * pen;
      tb += lv.tolBiz * pen;
      tl += lv.tolLeisure * pen;
    }
  }
  if (B && B.strength > 0) {
    const k = B.strength / 100;
    const e = BRAND_EFFECT[B.pos];
    mb *= 1 + e.biz * k;
    ml *= 1 + e.leisure * k;
    tb += e.tolBiz * k;
    tl += e.tolLeisure * k;
  }
  if (fare !== 0 && (tb > 0 || tl > 0)) {
    const p = 1 + fare / 100;
    if (tb > 0) mb *= p ** tb;
    if (tl > 0) ml *= p ** tl;
  }
  q.biz *= mb;
  q.leisure *= ml;
  return q;
}

/** 화면용: 이 회사가 두 도시 사이에서 받는 손님 끌기 배수 (운임 보통일 때) */
export function pullAt(c: Company, a: string, b: string, fare = 0): { biz: number; leisure: number } {
  return loyaltyQuality({ biz: 1, leisure: 1 }, c, a, b, fare);
}

/** 화면용: 회원만의 손님 끌기 (지역 평균, 운임 보통일 때) */
export function memberPull(c: Company): { biz: number; leisure: number; pen: number } {
  const L = c.loyalty;
  if (!L) return { biz: 0, leisure: 0, pen: 0 };
  const pen = weightedPen(L);
  const lv = LOYALTY_LEVELS[L.level];
  return { biz: lv.biz * pen, leisure: lv.leisure * pen, pen };
}

// ------------------------------------------------------------------ 돈

/** 회원 몫 평균 (지역에 닿는 손님으로 무게) */
export function weightedPen(L: LoyaltyState, regionPax?: Record<RegionId, number>): number {
  let sum = 0;
  let w = 0;
  for (const r of REGIONS) {
    const px = regionPax ? regionPax[r] : L.base[r];
    sum += px;
    w += px * L.pen[r];
  }
  return sum > 0 ? w / sum : 0;
}

/** 달 운영비 (억): 단계 바탕 + 비행기 수만큼 (골드는 우리 라운지가 있으면 덜) */
export function loyaltyUpkeep(c: Company, level: LoyaltyLevel = c.loyalty?.level ?? 1): number {
  const info = LOYALTY_LEVELS[level];
  const lounge = level === 3 && countFacility(c, 'lounge') > 0 ? GOLD_LOUNGE_SAVE : 1;
  return (info.upkeep + info.upkeepPerPlane * paxPlanes(c)) * lounge;
}

/** 손님 운임 수입 (화물·부가 수입 빼고) */
const paxRevenue = (rep: CompanyReport) => Math.max(0, rep.ticket - rep.cargo - rep.ancillary);

/** 이번 달 마일리지 값 (억): 회원이 탄 운임 × 단계 비율 */
export function rewardCost(L: LoyaltyState, rep: CompanyReport): number {
  return paxRevenue(rep) * weightedPen(L, rep.regionPax) * LOYALTY_LEVELS[L.level].reward;
}

/** 이번 달 프로그램 값 (운영비 + 마일리지, 억) */
export function loyaltyCost(c: Company, rep: CompanyReport): number {
  const L = c.loyalty;
  if (!L || c.out) return 0;
  return loyaltyUpkeep(c, L.level) + rewardCost(L, rep);
}

/**
 * 달 결산(simulate.ts의 computeMonth)에서: 프로그램 값을 광고비에 더하고 따로 적어 둔다.
 * rep는 이 달 손님·수입을 다 더한 결산 (세금을 셈하기 전)
 */
export function chargeLoyalty(c: Company, rep: CompanyReport): void {
  const cost = loyaltyCost(c, rep);
  if (cost <= 0) return;
  rep.ads += cost;
  rep.loyalty = cost;
}

/** from 단계에서 to 단계로 올리는 값 (내리는 것은 공짜) */
export function upgradeFee(c: Pick<Company, 'planes'>, from: number, to: number): number {
  let fee = 0;
  const n = paxPlanes(c);
  for (let lv = from + 1; lv <= to; lv++) {
    const info = LOYALTY_LEVELS[lv as LoyaltyLevel];
    fee += info.fee + info.feePerPlane * n;
  }
  return Math.round(fee);
}

/** 그만둘 때 남은 마일리지를 정리하는 값 */
export function settleCost(c: Pick<Company, 'loyalty'>): number {
  return Math.round((c.loyalty?.last ?? 0) * SETTLE_MONTHS * 10) / 10;
}

const money = (v: number) => `${Math.round(v).toLocaleString('ko-KR')}억`;

/** 이 단계로 바꿀 수 없는 까닭 (0이면 그만두기) */
export function loyaltyBlocker(state: Pick<AirlineState, 'companies' | 'q'>, ci: number, level: number): string | null {
  const c = state.companies[ci];
  if (!c || c.out) return '운항을 멈춘 회사예요';
  if (!Number.isInteger(level) || level < 0 || level > 3) return '없는 단계예요';
  const cur = loyaltyLevel(c);
  if (level === cur) return cur === 0 ? '프로그램이 없어요' : '지금 단계예요';
  if (level === 0) {
    const settle = settleCost(c);
    if (settle > 0 && c.cash < settle) return `남은 마일리지를 정리할 돈이 모자라요 (${money(settle)} 필요)`;
    return null;
  }
  if (isCargo(c)) return '화물 전문 회사는 손님이 없어요';
  if (yearOf(state.q) < LOYALTY_FROM) return `${LOYALTY_FROM}년부터 할 수 있어요`;
  if (level > maxLevel(c)) return '저가항공은 기본 단계까지만 해요 (좌석 승급·라운지가 없어요)';
  if (cur === 0 && paxPlanes(c) === 0) return '손님을 태우는 비행기가 있어야 해요';
  const fee = upgradeFee(c, cur, level);
  if (c.cash < fee) return `돈이 모자라요 (${money(fee)} 필요)`;
  return null;
}

/** 새 프로그램 (회원 없이 시작) */
export function newLoyalty(level: LoyaltyLevel, t: number): LoyaltyState {
  return { level, since: t, members: emptyRegionMap(), base: emptyRegionMap(), reach: emptyRegionMap(), pen: emptyRegionMap(), hist: [], last: 0 };
}

/** 회원 수 합 */
export function totalMembers(L: LoyaltyState | undefined | null): number {
  if (!L) return 0;
  let n = 0;
  for (const r of REGIONS) n += L.members[r];
  return n;
}

// ------------------------------------------------------------------ 달마다 회원 모이기·떠나기

/** 지역마다 우리 주간 운항 (지역에 닿는 노선의 왕복 횟수) */
export function regionFlights(c: Pick<Company, 'routes' | 'planes'>): Record<RegionId, number> {
  const out = emptyRegionMap();
  if (c.routes.length === 0) return out;
  const reg = new Map<number, [RegionId, RegionId]>();
  for (const r of c.routes) reg.set(r.id, [CITY[r.a].region, CITY[r.b].region]);
  for (const p of c.planes) {
    for (const l of p.legs) {
      const x = reg.get(l.route);
      if (!x || l.freq <= 0) continue;
      out[x[0]] += l.freq;
      if (x[1] !== x[0]) out[x[1]] += l.freq;
    }
  }
  return out;
}

/** '마일리지 두 배' 캠페인이 걸려 있는지 */
export function milesCampaign(c: Pick<Company, 'mods'>, t: number): boolean {
  const label = `${CAMPAIGN_INFO.miles.icon} ${CAMPAIGN_INFO.miles.name}`;
  return c.mods.some((m) => m.label === label && m.until > t);
}

/** 동맹 회사 가운데 단골 프로그램이 있는 회사 (동맹 회사 비행기로도 적립된다) */
export function alliedPrograms(state: Pick<AirlineState, 'alliances' | 'companies'>, ci: number): number[] {
  return alliesOf(state, ci).filter((i) => !!state.companies[i].loyalty);
}

/** 이번 달 회원이 모이고 떠나는 까닭 (화면·테스트) */
export interface MemberFlow {
  /** 가입 빠르기 (모자란 만큼의 몫) */
  join: number;
  /** 떠나는 몫 (보통 + 까닭마다) */
  churn: number;
  why: { text: string; good: boolean }[];
}

/** 회원이 모이는 빠르기와 떠나는 몫 (노선을 줄인 지역의 몫은 지역마다 따로 더한다) */
export function memberFlow(state: Pick<AirlineState, 'alliances' | 'companies'>, ci: number, t: number, region?: RegionId): MemberFlow {
  const c = state.companies[ci];
  const L = c.loyalty;
  const why: MemberFlow['why'] = [];
  if (!L) return { join: 0, churn: 0, why };
  const info = LOYALTY_LEVELS[L.level];
  const aw = region ? c.awareness[region] : REGIONS.reduce((s, r) => s + c.awareness[r], 0) / REGIONS.length;
  const allies = alliedPrograms(state, ci).length;
  const miles = milesCampaign(c, t);
  const join = Math.min(0.25, JOIN_RATE * (0.6 + 0.8 * aw) * (0.6 + (0.8 * c.reputation) / 100) * (miles ? MILES_JOIN : 1) * (1 + ALLY_JOIN * allies));
  let churn = info.churn;
  const late = Math.max(0, 0.82 - c.onTime) * 0.25;
  const bad = Math.max(0, 50 - c.reputation) * 0.001;
  churn += late + bad;
  if (miles) why.push({ text: '💳 마일리지 두 배 캠페인 중이라 가입이 늘어요', good: true });
  if (allies > 0) why.push({ text: `🤝 동맹 회사 ${allies}곳에서도 적립돼요`, good: true });
  if (aw >= 0.4) why.push({ text: '📣 광고로 잘 알려져 가입이 빨라요', good: true });
  else if (aw < 0.15) why.push({ text: '📣 덜 알려져 가입이 느려요 (광고를 해 보세요)', good: false });
  if (c.reputation >= 70) why.push({ text: '⭐ 평판이 좋아 가입이 빨라요', good: true });
  if (late > 0) why.push({ text: `⏱️ 정시 운항률 ${Math.round(c.onTime * 100)}% — 늦는 비행이 잦아 회원이 떠나요`, good: false });
  if (bad > 0) why.push({ text: `⭐ 평판 ${Math.round(c.reputation)} — 실망한 회원이 떠나요`, good: false });
  return { join, churn, why };
}

/**
 * 한 달 뒤의 프로그램 (순수 함수). rep: 이 달 결산. flights: 지역마다 이 달 주간 운항. allyFlights: 동맹 회사들의 지역 운항 합.
 */
export function stepMembers(
  state: Pick<AirlineState, 'alliances' | 'companies'>,
  ci: number,
  t: number,
  rep: CompanyReport,
  flights: Record<RegionId, number>,
  allyFlights: Record<RegionId, number> | null,
): LoyaltyState {
  const c = state.companies[ci];
  const L = c.loyalty!;
  const info = LOYALTY_LEVELS[L.level];
  const flow = memberFlow(state, ci, t);
  const members = emptyRegionMap();
  const base = emptyRegionMap();
  const reach = emptyRegionMap();
  const pen = emptyRegionMap();
  const awAvg = REGIONS.reduce((s, r) => s + c.awareness[r], 0) / REGIONS.length;
  let total = 0;
  for (const r of REGIONS) {
    const px = rep.regionPax[r];
    const b0 = L.base[r];
    const b = b0 <= 0 ? px : b0 + (px - b0) * 0.25;
    const fl = flights[r];
    const r0 = L.reach[r];
    const rc = r0 <= 0 ? fl : r0 + (fl - r0) * 0.3;
    const pool = b * POOL_K;
    const target = pool * info.cap;
    let m = L.members[r];
    // 가입: 그 지역에서 알려진 정도에 따라 (평균에 견주어)
    const join = flow.join * ((0.6 + 0.8 * c.awareness[r]) / (0.6 + 0.8 * awAvg));
    const add = Math.max(0, target - m) * Math.min(0.25, join);
    let churn = flow.churn;
    // 그 지역 노선을 크게 줄이면 회원이 떠난다 (동맹 회사가 그 지역을 날면 덜)
    if (r0 > 0 && fl < r0 * 0.7) churn += (1 - fl / r0) * 0.12 * (allyFlights && allyFlights[r] > 0 ? 0.5 : 1);
    // 회원이 될 수 있는 사람보다 많으면 천천히 줄어든다
    if (m > target && m > 0) churn += ((m - target) / m) * 0.06;
    m = Math.max(0, m + add - m * Math.min(0.5, churn));
    members[r] = Math.round(m);
    base[r] = Math.round(b);
    reach[r] = Math.round(rc * 10) / 10;
    pen[r] = pool >= 1 ? Math.round(Math.min(1, m / pool) * 1000) / 1000 : m > 0 ? 1 : 0;
    total += members[r];
  }
  return { level: L.level, since: L.since, members, base, reach, pen, hist: [...L.hist, total].slice(-24), last: Math.round((rep.loyalty ?? 0) * 100) / 100 };
}

/** 노선을 크게 줄여 회원이 떠나는 지역 (화면) */
export function cutRegions(c: Company): RegionId[] {
  const L = c.loyalty;
  if (!L) return [];
  const fl = regionFlights(c);
  return REGIONS.filter((r) => L.reach[r] > 0 && fl[r] < L.reach[r] * 0.7);
}
