import { MODEL } from './aircraft';
import { withJosa } from '../../lib/korean';
import { REGIONS, CITY } from './cities';
import { countFacility } from './facilities';
import { isFreighter, sizeSeats } from './freighters';
import { BRAND_EFFECT } from './loyalty';
import { monthOf, yearOfM } from './time';
import type { AirlineState, AwardKind, Company, CompanyReport } from './types';
import type { BrandPos, BrandPosState } from './loyaltyTypes';

/**
 * 브랜드 자리 (회사 색·꼬리 무늬는 brand.ts — 여기는 '우리 회사 하면 떠오르는 것').
 *
 * - 회사마다 브랜드 자리 하나를 내세운다: ⏱️ 믿음직한 정시 · 🍽️ 따뜻한 서비스 · 🏷️ 알뜰한 운임 · 🌐 넓은 노선망.
 * - 처음 정하는 것은 공짜이고 바로. 바꾸려면 돈(새 칠·광고)과 석 달이 들고, 쌓은 브랜드 힘은 35%만 남는다. 바꾸기는 한 해에 한 번.
 * - 달마다 실제 숫자(정시 운항률·결항·정비, 기내식·평판·좌석 간격·라운지, 운임·사업 모델, 지역·노선·갈아타기·동맹)로
 *   '얼마나 어울려요'(−1~1)를 재고, 어울리면 브랜드 힘(0~100)이 천천히 쌓이고, 어긋나면 더 빨리 깎인다.
 *   광고로 많이 알려진 회사일수록 빨리 쌓인다 (알려진 정도 = 아는 사람, 브랜드 = 무엇으로 아는지).
 * - 브랜드 힘은 자리에 맞는 손님을 조금 더 끌고, 정시·서비스는 운임이 조금 비싸도 덜 떠나게 한다 (loyalty.ts의 BRAND_EFFECT).
 * - 연말 시상식에서 맞는 상을 받으면 다음 1월에 브랜드 힘이 쑥 오른다.
 * - 저가항공은 알뜰한 운임이, 풀서비스는 나머지가 저절로 잘 어울린다.
 */

export interface BrandInfo {
  name: string;
  icon: string;
  /** 손님이 떠올리는 모습 (짧게) */
  desc: string;
  /** 효과 (짧게) */
  effect: string;
  /** 이 자리에 맞는 연말 상 */
  award: AwardKind;
}

export const BRAND_POSITIONS: readonly BrandPos[] = ['ontime', 'service', 'value', 'network'];

export const BRAND_INFO: Record<BrandPos, BrandInfo> = {
  ontime: { name: '믿음직한 정시', icon: '⏱️', desc: '약속한 시간에 꼭 뜨는 회사', effect: '사업 손님이 더 고르고, 조금 비싸도 타요', award: 'punctual' },
  service: { name: '따뜻한 서비스', icon: '🍽️', desc: '맛있는 기내식과 넉넉한 자리', effect: '모든 손님이 조금 더 고르고, 조금 비싸도 타요', award: 'service' },
  value: { name: '알뜰한 운임', icon: '🏷️', desc: '누구나 부담 없이 타는 싼 표', effect: '싼 표를 찾는 관광 손님이 먼저 찾아와요', award: 'growth' },
  network: { name: '넓은 노선망', icon: '🌐', desc: '어디든 데려다주는 회사', effect: '사업·관광 손님 모두 조금씩 더 골라요', award: 'hub' },
};

/** 브랜드 힘 문턱 (넘으면 소식) */
export const BRAND_TIERS: readonly { at: number; name: string }[] = [
  { at: 30, name: '알려지기 시작한 브랜드' },
  { at: 60, name: '믿고 찾는 브랜드' },
  { at: 85, name: '하늘길의 대표 브랜드' },
];

/** 바꾸는 데 걸리는 달 */
export const BRAND_CHANGE_MONTHS = 3;
/** 바꾸면 남는 브랜드 힘 */
export const BRAND_SWITCH_KEEP = 0.35;
/** 한 번 정하면 이만큼은 바꿀 수 없다 (처음 정한 것 빼고는 한 해에 한 번) */
export const BRAND_COOLDOWN = 12;
/** 맞는 상을 받으면 다음 1월에 오르는 브랜드 힘 */
export const AWARD_BOOST = 8;

/** 바꾸는 값 (새 칠·광고, 억) */
export function brandChangeCost(c: Pick<Company, 'planes'>): number {
  return Math.round(20 + 1.5 * c.planes.length);
}

export function brandTier(strength: number): number {
  let k = 0;
  for (let i = 0; i < BRAND_TIERS.length; i++) if (strength >= BRAND_TIERS[i].at) k = i + 1;
  return k;
}

const money = (v: number) => `${Math.round(v).toLocaleString('ko-KR')}억`;

/** 브랜드 자리를 정하거나 바꿀 수 없는 까닭 (지금 자리를 고르면 바꾸기를 그만둔다) */
export function brandBlocker(state: Pick<AirlineState, 'companies' | 't'>, ci: number, pos: BrandPos): string | null {
  const c = state.companies[ci];
  if (!c || c.out) return '운항을 멈춘 회사예요';
  if (!BRAND_INFO[pos]) return '없는 브랜드예요';
  if (c.bizModel === 'cargo') return '화물 전문 회사는 손님 브랜드가 없어요';
  const b = c.brandPos;
  if (!b) return null;
  if (pos === b.pos) return b.next ? null : '지금 브랜드예요';
  if (b.next) return b.next.pos === pos ? '바꾸는 중이에요' : `${withJosa(BRAND_INFO[b.next.pos].name, '으로/로')} 바꾸는 중이에요`;
  const left = b.since + BRAND_COOLDOWN - state.t;
  if (left > 0) return `${left}달 뒤에 바꿀 수 있어요 (한 해에 한 번)`;
  const cost = brandChangeCost(c);
  if (c.cash < cost) return `돈이 모자라요 (${money(cost)} 필요)`;
  return null;
}

// ------------------------------------------------------------------ 얼마나 어울려요

/** 어울림을 재는 숫자들 (회사 하나, O(비행기 + 노선)) */
export interface BrandStats {
  onTime: number;
  cancel: number;
  maint: number;
  age: number;
  meal: number;
  pitch: number;
  /** 고급 좌석(일등·비즈니스) 몫 */
  premShare: number;
  reputation: number;
  lounges: number;
  morale: number;
  /** 일반석 운임 조정 평균 (운항 횟수로 무게, %) */
  fare: number;
  lcc: boolean;
  regions: number;
  routes: number;
  /** 갈아탄 손님 몫 */
  xfer: number;
  allied: boolean;
  planes: number;
}

export function brandStats(c: Company, t: number, rep: CompanyReport | null | undefined, allied: boolean): BrandStats {
  let w = 0;
  let meal = 0;
  let pitch = 0;
  let age = 0;
  let seats = 0;
  let prem = 0;
  let pax = 0;
  const freq = new Map<number, number>();
  for (const p of c.planes) {
    const m = MODEL[p.model];
    for (const l of p.legs) if (l.freq > 0) freq.set(l.route, (freq.get(l.route) ?? 0) + l.freq);
    const s = sizeSeats(m);
    age += s * Math.max(0, (t - p.since) / 12);
    w += s;
    if (isFreighter(m)) continue;
    pax++;
    meal += p.meal * m.seats;
    pitch += p.cabin.pitch * m.seats;
    prem += (p.cabin.first + p.cabin.business) * 1;
    seats += m.seats;
  }
  let fareW = 0;
  let fare = 0;
  const regions = new Set<string>();
  let routes = 0;
  for (const r of c.routes) {
    const f = freq.get(r.id) ?? 0;
    if (f <= 0) continue;
    routes++;
    fare += r.fare * f;
    fareW += f;
    regions.add(CITY[r.a].region);
    regions.add(CITY[r.b].region);
  }
  return {
    onTime: c.onTime,
    cancel: rep && rep.flights > 0 ? rep.cancelled / rep.flights : 0,
    maint: c.maint,
    age: w > 0 ? age / w : 0,
    meal: seats > 0 ? meal / seats : c.service,
    pitch: seats > 0 ? pitch / seats : 1,
    premShare: seats > 0 ? prem / seats : 0,
    reputation: c.reputation,
    lounges: countFacility(c, 'lounge'),
    morale: c.morale ?? 65,
    fare: fareW > 0 ? fare / fareW : 0,
    lcc: c.bizModel === 'lcc',
    regions: regions.size,
    routes,
    xfer: rep && rep.pax > 0 ? rep.xferPax / rep.pax : 0,
    allied,
    planes: pax,
  };
}

export interface FitReason {
  text: string;
  /** 어울림에 더하는 값 (+ 어울려요, − 어긋나요) */
  v: number;
}

export interface BrandFit {
  /** −1~1 */
  fit: number;
  reasons: FitReason[];
}

const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));
const pctText = (v: number) => `${Math.round(v * 100)}%`;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** 이 자리가 지금 숫자와 얼마나 어울리는지와 그 까닭 */
export function fitOf(st: BrandStats, pos: BrandPos): BrandFit {
  const reasons: FitReason[] = [];
  const add = (text: string, v: number) => {
    if (Math.abs(v) >= 0.005) reasons.push({ text, v: r2(v) });
  };
  if (st.planes === 0) return { fit: 0, reasons: [{ text: '손님을 태우는 비행기가 아직 없어요', v: 0 }] };
  switch (pos) {
    case 'ontime':
      add(`정시 운항률 ${pctText(st.onTime)}`, clamp((st.onTime - 0.8) / 0.1) * 0.65);
      if (st.cancel > 0.02) add(`결항이 잦아요 (${(st.cancel * 100).toFixed(1)}%)`, -0.25);
      else if (st.cancel < 0.005) add('결항이 거의 없어요', 0.1);
      if (st.maint >= 4) add('정비를 꼼꼼히 해요', 0.15);
      else if (st.maint <= 2) add('정비를 아껴요', -0.2);
      if (st.age < 8) add(`새 비행기가 많아요 (평균 ${Math.round(st.age)}년)`, 0.1);
      else if (st.age > 16) add(`비행기가 낡았어요 (평균 ${Math.round(st.age)}년)`, -0.15);
      break;
    case 'service':
      add(`기내식 평균 ${st.meal.toFixed(1)}단계`, clamp((st.meal - 3) / 1.5) * 0.4);
      add(`평판 ${Math.round(st.reputation)}`, clamp((st.reputation - 60) / 25) * 0.3);
      if (st.pitch >= 1.5) add('일반석이 넓어요', 0.15);
      else if (st.pitch < 0.5) add('좌석이 촘촘해요', -0.25);
      if (st.lounges > 0) add(`라운지 ${st.lounges}곳`, 0.1);
      if (st.morale < 50) add('직원들이 지쳐 있어요 (조직 만족도)', -0.15);
      else if (st.morale >= 75) add('직원들이 즐겁게 일해요', 0.05);
      if (st.lcc) add('저가항공이라 서비스를 줄였어요', -0.2);
      break;
    case 'value':
      // 운임은 보통(+10%)에 견준다: 손님이 넘치는 노선이 많아 다들 조금 비싸게 판다
      add(`일반석 운임 평균 ${st.fare > 0 ? '+' : ''}${Math.round(st.fare)}%`, clamp((10 - st.fare) / 15) * 0.45);
      if (st.lcc) add('저가항공이에요 (싼 비용·한 등급)', 0.55);
      if (st.pitch < 0.5) add('촘촘한 좌석으로 싸게 팔아요', 0.1);
      if (st.meal <= 1.5) add('기내식을 줄여 아껴요', 0.1);
      else if (st.meal >= 4) add('기내식에 돈을 많이 써요', -0.15);
      if (st.premShare > 0.15) add('고급 좌석이 많아요', -0.15);
      break;
    case 'network':
      add(`여섯 지역 가운데 ${st.regions}곳을 날아요`, clamp((st.regions - 2) / 3) * 0.4);
      add(`노선 ${st.routes}개`, clamp((st.routes - 8) / 16) * 0.35);
      if (st.xfer >= 0.05) add(`갈아타는 손님 ${pctText(st.xfer)}`, 0.15);
      if (st.allied) add('동맹 회사 노선도 함께 이어요', 0.1);
      break;
  }
  const fit = clamp(reasons.reduce((s, x) => s + x.v, 0));
  reasons.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  return { fit: r2(fit), reasons };
}

/** 네 자리 모두의 어울림 (화면·컴퓨터) */
export function allFits(c: Company, t: number, rep: CompanyReport | null | undefined, allied: boolean): Record<BrandPos, BrandFit> {
  const st = brandStats(c, t, rep, allied);
  return { ontime: fitOf(st, 'ontime'), service: fitOf(st, 'service'), value: fitOf(st, 'value'), network: fitOf(st, 'network') };
}

/** 지금 숫자로 가장 잘 어울리는 자리 (같으면 앞 자리) */
export function bestPosition(fits: Record<BrandPos, BrandFit>, c: Pick<Company, 'bizModel'>): BrandPos {
  if (c.bizModel === 'lcc') return 'value';
  let best: BrandPos = 'ontime';
  for (const p of BRAND_POSITIONS) if (fits[p].fit > fits[best].fit + 1e-9) best = p;
  return best;
}

/** 새 브랜드 (힘 0에서 시작) */
export function newBrand(pos: BrandPos, t: number): BrandPosState {
  return { pos, strength: 0, since: t, next: null, fit: 0, hist: [] };
}

/** 알려진 정도 평균 (지점이 있는 지역으로) */
function knownness(c: Company): number {
  const seen = new Set(c.branches.map((x) => CITY[x].region));
  const list = REGIONS.filter((r) => seen.has(r));
  if (list.length === 0) return 0;
  return list.reduce((s, r) => s + c.awareness[r], 0) / list.length;
}

/**
 * 한 달 뒤의 브랜드 (순수 함수). 바꾸는 중이면 그 달에 바꾸고, 어울림으로 힘을 움직인다.
 * awards: 1월이면 지난해 이 회사가 받은 상
 */
export function stepBrand(b: BrandPosState, c: Company, t: number, rep: CompanyReport | null | undefined, allied: boolean, awards: readonly AwardKind[] = []): BrandPosState {
  let pos = b.pos;
  let strength = b.strength;
  let since = b.since;
  let next = b.next ?? null;
  if (next && next.t <= t) {
    pos = next.pos;
    strength *= BRAND_SWITCH_KEEP;
    since = t;
    next = null;
  }
  const fit = fitOf(brandStats(c, t, rep, allied), pos).fit;
  const target = Math.max(0, fit) * 100;
  if (target > strength) strength += (target - strength) * 0.05 * (0.7 + 0.6 * knownness(c));
  else strength += (target - strength) * (fit < 0 ? 0.12 : 0.06);
  if (monthOf(t) === 1 && awards.includes(BRAND_INFO[pos].award)) strength += AWARD_BOOST;
  strength = Math.round(clamp(strength, 0, 100) * 10) / 10;
  return { pos, strength, since, next, fit, hist: [...b.hist, Math.round(strength)].slice(-24) };
}

/** 지난해 이 회사가 받은 상 (1월에 브랜드 힘을 올린다) */
export function lastYearAwards(state: Pick<AirlineState, 'awards'>, ci: number, t: number): AwardKind[] {
  const year = yearOfM(t) - 1;
  const y = (state.awards ?? []).find((a) => a.year === year);
  return y ? y.items.filter((a) => a.company === ci).map((a) => a.kind) : [];
}

/** 브랜드 힘이 주는 효과 글 ('사업 손님 +3.6%') */
export function brandEffectText(b: Pick<BrandPosState, 'pos' | 'strength'>): string {
  const k = b.strength / 100;
  const e = BRAND_EFFECT[b.pos];
  const parts: string[] = [];
  const p = (v: number) => `+${(v * k * 100).toFixed(1)}%`;
  if (e.biz > 0 && e.leisure > 0 && Math.abs(e.biz - e.leisure) < 1e-9) parts.push(`모든 손님 ${p(e.biz)}`);
  else {
    if (e.biz > 0) parts.push(`사업 손님 ${p(e.biz)}`);
    if (e.leisure > 0) parts.push(`관광 손님 ${p(e.leisure)}`);
  }
  if (e.tolBiz > 0 || e.tolLeisure > 0) parts.push('비싸도 덜 떠나요');
  return parts.join(' · ');
}
