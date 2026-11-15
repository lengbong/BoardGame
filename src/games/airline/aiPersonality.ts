import { bizModelOf } from './bizmodel';
import { CITY, pairKey } from './cities';
import { sizeSeats } from './freighters';
import { personaDef } from './personality';
import { flyingIds, relOf, truceFloor } from './relations';
import { estimateExisting, routeIndex } from './simulate';
import type { AirlineAction, AirlineState, Company, ModelDef } from './types';

/**
 * 컴퓨터 경영에 성격을 입히는 손잡이 (ai.ts의 Planner가 부른다).
 * 성격이 없으면(사람 회사·성격을 끈 판) 모두 예전 값 그대로라 예전과 똑같이 경영한다.
 * 게임 전체의 컴퓨터 성향(느긋·보통·치열)은 ai.ts가 그대로 쓰고, 여기 값은 그 위에 곱하거나 더한다.
 *
 * - 남기는 돈(reserveMult), 분기마다 여는 새 노선(newRoutesFor)
 * - 노선 후보: 라이벌이 있는 두 도시를 꺼리는 정도(rivalWeights: 사이가 아주 나쁘면 오히려 그 회사 노선에 들어가고,
 *   사이가 좋으면 더 피한다), 성격이 좋아하는 노선(pairTaste: 본사·빈 하늘길·먼 길·사업 도시·짧은 관광 노선), 기종 크기(modelTaste)
 * - 운임 바닥·천장(fareBounds), 기내식(mealFor), 중고 비행기 나이(usedAgeFor), 비행기 바꾸는 나이(renewAgeFor)
 * - 동맹 제안 빈도(allyRate), 배당 주식 문턱(investMult)
 * - 운임 승부사는 계획하는 달에 같은 노선 라이벌보다 5%p 싸게 판다 (이익이 줄지 않을 때만, 사이가 아주 나쁜 사람 회사에게는 흑자이고 이익이 15% 넘게 줄지 않는 한).
 *   휴전 중인 노선은 건드리지 않는다 (rules.ts가 막기도 한다)
 */

type S = Pick<AirlineState, 'options' | 'companies' | 'startT' | 'rivals'>;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 사이가 이 아래면 되갚는다 (컴퓨터 성향이 치열할수록 빨리) */
export function grudgeAt(state: Pick<AirlineState, 'options'>): number {
  const style = state.options.aiStyle ?? 'normal';
  return style === 'fierce' ? -28 : style === 'relaxed' ? -55 : -40;
}

/** 남겨 두는 현금 배수 */
export function reserveMult(state: S, ci: number): number {
  return personaDef(state, ci)?.reserve ?? 1;
}

/**
 * 이번 분기에 열 새 노선 수 (base: 성향에 따른 수. 0인 분기는 그대로).
 * 더 여는 노선은 돈이 넉넉할 때만 (남겨 둘 돈 reserve의 네 배 넘게)
 */
export function newRoutesFor(state: S & Pick<AirlineState, 'q'>, ci: number, base: number, reserve = 0): number {
  const p = personaDef(state, ci);
  if (!p || base < 1) return base;
  // 0.5는 두 분기에 하나, 0.34는 세 분기에 하나쯤 (분기 번호로 고르게 나눈다)
  const extra = Math.floor((state.q + 1) * p.routes) - Math.floor(state.q * p.routes);
  if (extra > 0 && state.companies[ci].cash < reserve * 4) return base;
  return Math.max(1, base + extra);
}

/**
 * 회사마다 '이 회사가 나는 두 도시'를 꺼리는 정도 (노선 매력을 1 + 합 으로 나눈다. 성격이 없으면 모두 0.6 — 예전 그대로).
 * 사이가 아주 나쁘고 노선으로 되갚는 성격이면 음수(그 회사 노선이 더 끌린다), 사이가 좋으면 1.6배 더 피한다.
 */
export function rivalWeights(state: S, ci: number): number[] {
  const p = personaDef(state, ci);
  const grudge = grudgeAt(state);
  return state.companies.map((_, j) => {
    if (!p || j === ci) return 0.6;
    const r = relOf(state, ci, j);
    if (r <= grudge && p.retaliate === 'routes') return -0.2;
    return r >= 40 ? p.rivalW * 1.6 : p.rivalW;
  });
}

/** 성격이 좋아하는 두 도시 (노선 후보의 빠른 어림에 곱한다) */
export function pairTaste(state: S, ci: number, a: string, b: string, d: number, rivals: number): number {
  const p = personaDef(state, ci);
  if (!p) return 1;
  const c = state.companies[ci];
  const biz = (CITY[a].biz + CITY[b].biz) / 2;
  switch (p.id) {
    case 'hub':
      return a === c.hub || b === c.hub ? 1.06 : 1;
    case 'pioneer':
      return (rivals === 0 ? 1.06 : 0.97) * (d > 5000 ? 1.08 : 1);
    case 'service':
      return (biz >= 0.5 ? 1.15 : 1) * (d > 3000 ? 1.05 : 1);
    case 'fare':
      return biz < 0.4 ? 1.05 : 1;
    case 'saver':
      return d < 2500 ? 1.1 : 1;
    case 'expander':
      return rivals > 0 ? 1.05 : 1;
  }
}

/**
 * 노선 후보 끌림: 성격이 좋아하는 두 도시 × (예전처럼 라이벌 하나마다 0.6씩 꺼리던 것 대신 성격·사이에 따른 꺼림).
 * 빠른 어림과 마지막 점수에 곱한다. 성격이 없으면 1 (예전 그대로)
 */
export function pairPull(state: S, ci: number, a: string, b: string, d: number, rivals: number, wary: number): number {
  if (!personaDef(state, ci)) return 1;
  return (pairTaste(state, ci, a, b, d, rivals) * (1 + rivals * 0.6)) / Math.max(0.6, 1 + wary);
}

/** 기종 크기 취향 (큰 비행기·작은 비행기를 좋아하는 정도, 점수에 곱한다) */
export function modelTaste(state: S, ci: number, m: ModelDef): number {
  const p = personaDef(state, ci);
  if (!p || !p.size) return 1;
  const x = clamp(Math.log2(Math.max(1, sizeSeats(m)) / 180), -1, 1);
  return 1 + 0.06 * p.size * x;
}

/** 일반석 운임 바닥·천장 */
export function fareBounds(state: S, ci: number, floor: number, cap: number): [number, number] {
  const p = personaDef(state, ci);
  if (!p) return [floor, cap];
  const f = clamp(floor + p.fareFloor, -30, 20);
  return [f, clamp(cap + p.fareCap, f + 5, 30)];
}

/** 기내식 단계 */
export function mealFor(state: S, ci: number, want: number): number {
  const p = personaDef(state, ci);
  if (!p || bizModelOf(state.companies[ci]) === 'lcc') return want;
  return clamp(want + p.meal, 1, 5);
}

/** 사는 중고 비행기의 가장 많은 나이 (−1: 사지 않는다) */
export function usedAgeFor(state: S, ci: number): number {
  return personaDef(state, ci)?.usedAge ?? 14;
}

/** 이 나이가 넘은 비행기를 새 기종으로 바꾼다 */
export function renewAgeFor(state: S, ci: number): number {
  return personaDef(state, ci)?.renewAge ?? 20;
}

/** 동맹 제안 빈도 배수 */
export function allyRate(state: S, ci: number): number {
  return personaDef(state, ci)?.allyRate ?? 1;
}

/** 배당 주식을 사는 수익률 문턱 배수 */
export function investMult(state: S, ci: number): number {
  return personaDef(state, ci)?.invest ?? 1;
}

/** ai.ts의 Planner에서 이 파일이 쓰는 것만 */
export interface RivalPlanner {
  s: AirlineState;
  readonly ci: number;
  readonly normal: boolean;
  readonly planning: boolean;
  readonly c: Company;
  act(a: AirlineAction): boolean;
}

/**
 * 운임 승부사의 운임 다툼 (경영을 마친 뒤, 보통 컴퓨터가 계획하는 달에만).
 * 같은 노선 라이벌 가운데 가장 싼 운임보다 5%p 싸게 판다: 이익이 줄지 않을 때만,
 * 사이가 아주 나쁜 사람 회사가 있는 노선은 흑자이고 이익이 15% 넘게 줄지 않는 한 내린다. 한 차례에 노선 셋까지, 어림은 여덟 번까지.
 */
export function aiRivals(pl: RivalPlanner): void {
  if (!pl.normal || !pl.planning || pl.c.out || pl.s.phase !== 'manage') return;
  const p = personaDef(pl.s, pl.ci);
  if (!p || p.retaliate !== 'fares') return;
  const grudge = grudgeAt(pl.s);
  const others = pl.s.companies.map((x, j) => ({ x, j, fly: flyingIds(x) })).filter(({ x, j }) => j !== pl.ci && !x.out);
  if (others.length === 0) return;
  const [floor] = fareBounds(pl.s, pl.ci, bizModelOf(pl.c) === 'lcc' ? -30 : -25, 25);
  const mine = flyingIds(pl.c);
  let done = 0;
  let tries = 0;
  for (const r0 of [...pl.c.routes]) {
    if (done >= 3 || tries >= 8) break;
    if (!mine.has(r0.id)) continue;
    const key = pairKey(r0.a, r0.b);
    if (truceFloor(pl.s, pl.ci, key) !== null) continue;
    let min = Infinity;
    let mad = false;
    for (const { x, j, fly } of others) {
      const t = routeIndex(x).get(key);
      if (!t || !fly.has(t.id)) continue;
      min = Math.min(min, t.fare);
      // 손해를 보면서까지 되갚는 것은 사람 회사에게만 (컴퓨터끼리는 이익이 줄지 않을 때만 싸게 판다)
      if (x.kind === 'human' && relOf(pl.s, pl.ci, j) <= grudge) mad = true;
    }
    if (!Number.isFinite(min)) continue;
    // 다툼이 끝없이 내려가지 않게 보통 때는 −15%까지만 (되갚을 때는 운임 바닥까지)
    const want = Math.max(floor, min - 5, mad ? -Infinity : -15);
    if (want >= r0.fare || (r0.stats && r0.stats.lf > 0.9 && !mad)) continue;
    tries++;
    const r = pl.c.routes.find((x) => x.id === r0.id);
    if (!r) continue;
    const now = estimateExisting(pl.s, pl.ci, r).profit;
    const after = estimateExisting(pl.s, pl.ci, r, { fare: want }).profit;
    // 사이가 아주 나쁘면 이익이 조금(15%까지) 줄어도 내린다 (흑자인 한)
    const ok = mad ? after > 0 && after >= now - Math.abs(now) * 0.15 : after >= now;
    if (ok && pl.act({ type: 'setFare', route: r.id, fare: want })) done++;
  }
}
