import { allFits, bestPosition, brandBlocker, brandChangeCost } from './brandPosition';
import { alliesOf } from './alliances';
import { LOYALTY_FROM, loyaltyBlocker, loyaltyLevel, paxPlanes, settleCost, upgradeFee } from './loyalty';
import { monthOf, yearOf } from './time';
import type { AirlineAction, AirlineState, Company } from './types';
import type { LoyaltyLevel } from './loyaltyTypes';

/**
 * 컴퓨터의 단골 프로그램과 브랜드 자리 (ai.ts의 Planner가 경영을 마친 뒤).
 *
 * - 브랜드: 처음에는 지금 숫자와 가장 잘 어울리는 자리를 고른다 (저가항공은 알뜰한 운임). 보통 컴퓨터는 한 해에 한 번
 *   (그해 첫 계획 달) 브랜드가 잘 안 어울려 힘이 약하고(30 아래) 훨씬 잘 어울리는 자리가 있으면 바꾼다. 쉬움은 바꾸지 않는다.
 * - 단골 프로그램은 다른 회사와 겨루는 노선이 많을수록 이득이다 (혼자 나는 노선은 이미 손님이 넘쳐 덜 남는다).
 *   보통: 손님 비행기 12대(저가항공 25대·1995년부터) 넘고 흑자이며 겨루는 노선이 조금이라도 있으면 기본,
 *   35대 넘고 노선의 30% 넘게 겨루면 실버, 90대 넘고 절반 넘게 겨루며 평판 60 넘으면 골드. 한 번에 한 단계씩, 돈이 넉넉할 때만.
 *   적자 분기면 한 단계 내리고, 돈이 모자란 위기면 그만둔다 (겨루는 정도가 꽤 줄어도 내린다).
 *   쉬움: 비행기 20대 넘고 흑자면 기본만 (1985년부터), 위기면 그만둔다.
 * 계산은 노선 수만큼이고 계획하는 달(석 달에 한 번)에만 해서 한 차례 시간에 거의 영향이 없다.
 */

/** ai.ts의 Planner에서 이 파일이 쓰는 것만 */
export interface LoyaltyPlanner {
  s: AirlineState;
  readonly ci: number;
  readonly normal: boolean;
  readonly planning: boolean;
  readonly c: Company;
  act(a: AirlineAction): boolean;
  reserve(): number;
}

/** 지난 결산에서 다른 회사와 함께 나는 (우리 몫이 90%보다 적은) 노선의 비율 */
export function contestedShare(c: Pick<Company, 'routes'>): number {
  let n = 0;
  let k = 0;
  for (const r of c.routes) {
    if (!r.stats || r.stats.pax <= 0) continue;
    n++;
    if (r.stats.share < 0.9) k++;
  }
  return n > 0 ? k / n : 0;
}

/** 지금 크기·겨루기·이익으로 알맞은 단계 (지금 단계에서 내릴 때는 조금 너그럽게) */
export function wantedLevel(s: AirlineState, ci: number, normal: boolean): 0 | LoyaltyLevel {
  const c = s.companies[ci];
  if (c.bizModel === 'cargo' || c.out) return 0;
  const year = yearOf(s.q);
  if (year < LOYALTY_FROM) return 0;
  const cur = loyaltyLevel(c);
  const n = paxPlanes(c);
  const comp = contestedShare(c);
  const lastQ = s.qReport?.companies[ci];
  const profitable = !!lastQ && lastQ.profit > 0;
  const lcc = c.bizModel === 'lcc';
  if (c.crisis > 0) return 0;
  if (!normal) {
    if (year < 1985) return 0;
    if (cur >= 1) return 1;
    return n >= 20 && profitable ? 1 : 0;
  }
  // 이미 하는 단계는 조금 아래 문턱까지 지킨다 (오락가락하지 않게)
  const keep = (lv: number) => cur >= lv;
  let want: 0 | LoyaltyLevel = 0;
  const l1 = lcc ? year >= 1995 && n >= 25 : n >= 12;
  if (l1 && (comp > 0 || n >= 40) && (profitable || keep(1))) want = 1;
  if (!lcc && want === 1 && n >= (keep(2) ? 30 : 35) && comp >= (keep(2) ? 0.2 : 0.3) && (profitable || keep(2))) want = 2;
  if (!lcc && want === 2 && n >= (keep(3) ? 80 : 90) && comp >= (keep(3) ? 0.38 : 0.5) && c.reputation >= (keep(3) ? 55 : 60) && (profitable || keep(3))) want = 3;
  // 적자 분기면 한 단계 내린다 (기본은 지킨다)
  if (lastQ && lastQ.profit < 0 && cur >= 2) want = Math.min(want, cur - 1) as 0 | LoyaltyLevel;
  return want;
}

export function aiLoyalty(p: LoyaltyPlanner): void {
  const c0 = p.c;
  if (c0.out || p.s.phase !== 'manage' || c0.bizModel === 'cargo') return;
  // 1) 브랜드 자리
  if (!c0.brandPos) {
    if (paxPlanes(c0) > 0) {
      const fits = allFits(c0, p.s.t, p.s.report?.companies[p.ci], alliesOf(p.s, p.ci).length > 0);
      p.act({ type: 'setBrandPos', pos: bestPosition(fits, c0) });
    }
  } else if (p.normal && p.planning && monthOf(p.s.t) <= 3 && !c0.brandPos.next && c0.bizModel !== 'lcc') {
    const b = c0.brandPos;
    if (b.fit < 0.2 && b.strength < 30) {
      const fits = allFits(c0, p.s.t, p.s.report?.companies[p.ci], alliesOf(p.s, p.ci).length > 0);
      const best = bestPosition(fits, c0);
      if (best !== b.pos && fits[best].fit >= 0.3 && fits[best].fit > fits[b.pos].fit + 0.3 && !brandBlocker(p.s, p.ci, best) && c0.cash > p.reserve() + brandChangeCost(c0) * 2) {
        p.act({ type: 'setBrandPos', pos: best });
      }
    }
  }
  // 2) 단골 프로그램 (계획하는 달에만)
  if (!p.planning) return;
  const c = p.c;
  const cur = loyaltyLevel(c);
  const want = wantedLevel(p.s, p.ci, p.normal);
  if (want === cur) return;
  if (want > cur) {
    const next = (cur + 1) as LoyaltyLevel;
    if (loyaltyBlocker(p.s, p.ci, next)) return;
    if (c.cash < p.reserve() + upgradeFee(c, cur, next) * 3) return;
    p.act({ type: 'setLoyalty', level: next });
    return;
  }
  // 내리기: 위기면 그만두고, 아니면 한 단계씩
  const to = c.crisis > 0 && cur === 1 ? 0 : ((cur - 1) as 0 | LoyaltyLevel);
  if (to === 0 && settleCost(c) > c.cash) return;
  if (!loyaltyBlocker(p.s, p.ci, to)) p.act({ type: 'setLoyalty', level: to });
}
