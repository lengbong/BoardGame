import { addRightsApp, applyRightsBlocker, emptyRightsBook, isDomesticKey, pairKeyAt, pairUsage, rightsInfo, rightsMode, money } from './rights';
import { routeOf } from './simulate';
import { mLabel, yearOf } from './time';
import type { AirlineState, Plane } from './types';
import type { RightsAction, TrafficRight } from './rightsTypes';

/*
 * 운수권의 행동과 인수 뒤 정리 (rules.ts는 여기로 넘기기만 한다). rules.ts를 부르지 않는다.
 */

export function isRightsAction(a: { type: string }): a is RightsAction {
  return a.type === 'applyRights';
}

/** 운수권 신청 */
export function applyRightsAction(state: AirlineState, action: RightsAction, ci: number): AirlineState {
  if (applyRightsBlocker(state, ci, action.key)) return state;
  const c0 = state.companies[ci];
  const info = rightsInfo(state, ci, action.key);
  let s = addRightsApp(state, ci, action.key);
  const app = s.rights!.apps[ci].at(-1)!;
  s = { ...s, events: [{ id: s.nextEventId, type: 'rights', company: ci, key: action.key }], nextEventId: s.nextEventId + 1 };
  const log = [...s.log, { id: s.nextLogId, seat: c0.seat, text: `${c0.name}: ${info.label} 운수권 주 ${app.add}회 더 신청 (−${money(app.fee)}, ${mLabel(app.due)} 결산 때 정해져요)` }];
  return { ...s, log: log.length > 80 ? log.slice(-80) : log, nextLogId: s.nextLogId + 1 };
}

/**
 * 인수(rules.ts의 합치기) 뒤: 인수된 회사 i의 더 받은 운수권과 기다리던 신청을 인수한 회사 j가 넘겨받는다.
 * 그래도 합친 운항이 j의 운수권을 넘는 두 나라는, i가 그 두 나라 사이에 가졌던 기본 횟수만큼까지 운수권으로 넘겨받는다
 * (인수된 회사의 지정 항공사 자격도 함께 넘어온다고 보고, 날던 하늘길을 갑자기 끊지 않는다).
 * 그러고도 넘치면 넘겨받은 비행기의 횟수부터 줄인다 (원래 j의 비행기는 건드리지 않는다).
 * before: 합치기 전 상태, after: 합친 뒤 상태
 */
export function rightsAfterMerge(before: AirlineState, after: AirlineState, j: number, i: number): AirlineState {
  if (rightsMode(after) === 'off' || after === before) return after;
  const year = yearOf(after.q);
  const t = after.t;
  // 합치기 전 i가 두 나라마다 가졌던 기본 횟수 (제한이 없던 곳은 날던 만큼)
  const tBase = new Map<string, number>();
  for (const [key, use] of pairUsage(before.companies[i], year)) {
    if (isDomesticKey(key)) continue;
    const info = rightsInfo(before, i, key);
    tBase.set(key, Number.isFinite(info.base) ? info.base : use);
  }
  const book = after.rights ?? emptyRightsBook(after.companies.length);
  const held = book.held.map((list) => [...(list ?? [])]);
  const apps = book.apps.map((list) => [...(list ?? [])]);
  held[j] = [...held[j], ...held[i].map((r) => ({ ...r, since: t, used: t }))];
  const mine = new Set(apps[j].map((a) => a.key));
  apps[j] = [...apps[j], ...apps[i].filter((a) => !mine.has(a.key))].slice(0, 6);
  held[i] = [];
  apps[i] = [];
  let s: AirlineState = { ...after, rights: { held, apps } };
  // 모자라는 두 나라는 i의 기본 횟수만큼까지 넘겨받는다
  const add: TrafficRight[] = [];
  for (const [key, use] of pairUsage(s.companies[j], year)) {
    if (isDomesticKey(key)) continue;
    const info = rightsInfo(s, j, key);
    if (!Number.isFinite(info.allow) || use <= info.allow) continue;
    const grant = Math.min(use - info.allow, tBase.get(key) ?? 0);
    if (grant > 0) add.push({ key, add: grant, since: t, used: t });
  }
  if (add.length > 0) {
    held[j] = [...held[j], ...add];
    s = { ...s, rights: { held, apps } };
  }
  // 그래도 넘치면 넘겨받은 비행기부터 줄인다
  const absorbed = new Set(before.companies[i].planes.map((p) => p.id));
  const c = s.companies[j];
  let planes: Plane[] | null = null;
  for (const [key, use] of pairUsage(c, year)) {
    if (isDomesticKey(key)) continue;
    const info = rightsInfo(s, j, key);
    if (!Number.isFinite(info.allow) || use <= info.allow) continue;
    let over = use - info.allow;
    if (!planes) planes = c.planes.map((p) => ({ ...p, legs: p.legs.map((l) => ({ ...l })) }));
    const legs: Plane['legs'][number][] = [];
    for (const p of planes) {
      if (!absorbed.has(p.id)) continue;
      for (const l of p.legs) {
        const r = routeOf(c, l.route);
        if (r && pairKeyAt(r.a, r.b, year) === key) legs.push(l);
      }
    }
    legs.sort((x, y) => y.freq - x.freq);
    for (const l of legs) {
      if (over <= 0) break;
      const cut = Math.min(over, l.freq);
      l.freq -= cut;
      over -= cut;
    }
  }
  if (planes) {
    const companies = s.companies.slice();
    companies[j] = { ...c, planes: planes.map((p) => ({ ...p, legs: p.legs.filter((l) => l.freq > 0) })) };
    s = { ...s, companies };
  }
  return s;
}
