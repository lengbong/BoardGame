import { CITY, citySize } from './cities';
import { applyRightsBlocker, countryKey, homeOf, polityAt, rightsFee, rightsInfo, rightsMode, tightPairs } from './rights';
import { yearOf } from './time';
import type { AirlineAction, AirlineState, Company } from './types';

/**
 * 컴퓨터의 운수권 (ai.ts의 Planner가 경영을 마친 뒤).
 * 노선 후보를 고를 때는 남은 횟수가 없는 두 나라를 빼고(ai.ts), 띄울 때는 assignBlocker·bestFreq가 운수권을 지킨다.
 * 여기서는 남은 주간 횟수가 거의 없는 두 나라를 더 신청한다 (쉬움은 한 번에 하나).
 * 실제처럼에서는 보통 컴퓨터가 계획하는 달에 지점이 있는 외국 두 나라 사이 운수권도 하나씩 신청한다.
 * 계산은 이 회사가 나는 두 나라 수만큼이라 한 차례 시간에 거의 영향이 없다.
 */

/** ai.ts의 Planner에서 이 파일이 쓰는 것만 */
export interface RightsPlanner {
  s: AirlineState;
  readonly ci: number;
  readonly normal: boolean;
  readonly planning: boolean;
  readonly c: Company;
  act(a: AirlineAction): boolean;
  reserve(): number;
}

export function aiRights(p: RightsPlanner): void {
  if (p.c.out || p.s.phase !== 'manage') return;
  const mode = rightsMode(p.s);
  if (mode === 'off') return;
  const fee = rightsFee(p.s);
  const max = p.normal ? 2 : 1;
  let done = 0;
  for (const info of tightPairs(p.s, p.ci, 3)) {
    if (done >= max || p.c.cash < p.reserve() + fee * 2) break;
    if (applyRightsBlocker(p.s, p.ci, info.key)) continue;
    if (p.act({ type: 'applyRights', key: info.key })) done++;
  }
  // 실제처럼: 외국과 외국 사이는 신청해야만 난다. 보통 컴퓨터는 계획하는 달에 큰 두 나라 하나씩
  if (mode !== 'real' || !p.normal || !p.planning || done >= max || p.c.cash < p.reserve() * 2 + fee) return;
  const year = yearOf(p.s.q);
  const home = homeOf(p.s, p.ci);
  const size = new Map<string, number>();
  for (const city of p.c.branches) {
    const pol = polityAt(city, year);
    if (pol === home) continue;
    size.set(pol, Math.max(size.get(pol) ?? 0, citySize(CITY[city], year)));
  }
  const list = [...size.keys()];
  let best: { key: string; v: number } | null = null;
  for (let i = 0; i < list.length; i++) {
    for (let k = i + 1; k < list.length; k++) {
      const key = countryKey(list[i], list[k]);
      const info = rightsInfo(p.s, p.ci, key);
      if (!Number.isFinite(info.allow) || info.allow > 0 || info.pending || info.full) continue;
      const v = size.get(list[i])! * size.get(list[k])!;
      if (!best || v > best.v) best = { key, v };
    }
  }
  if (best && best.v >= 12 && !applyRightsBlocker(p.s, p.ci, best.key)) p.act({ type: 'applyRights', key: best.key });
}
