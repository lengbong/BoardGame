import type { Alliance, AirlineState } from './types';

/**
 * 항공 동맹 (Airline Manager처럼): 회사 둘셋이 모인 동맹. 예전의 1:1 제휴(코드셰어)를 넓힌 것.
 * - 동맹 회사들의 노선을 이어 갈아타는 손님을 함께 태운다
 * - 동맹 회사도 지점이 있는 도시를 오가면 손님 +5%
 * - 동맹 마일리지: 회사가 하나 늘 때마다 모든 노선 손님 +1.5%
 * - 동맹 회사의 라운지는 우리 사업 손님에게도 반쯤 효과가 있다
 * 실제 동맹 이름은 쓰지 않는다.
 */

/** 동맹 하나에 들어갈 수 있는 회사 수 (네 회사가 모두 한 동맹이면 겨룰 상대가 없다) */
export const MAX_MEMBERS = 3;
/** 동맹 마일리지: 회사가 하나 늘 때마다 손님 배수 */
export const MILES_PER_MEMBER = 0.015;
/** 동맹 회사도 지점이 있는 도시의 손님 배수 */
export const JOINT_BONUS = 1.05;

export const ALLIANCE_NAMES = ['하늘별 동맹', '푸른띠 동맹', '세계일주 동맹', '은빛날개 동맹'] as const;

const alive = (state: Pick<AirlineState, 'companies'>, ci: number) => !!state.companies[ci] && !state.companies[ci].out;

/** 이 회사가 든 동맹 (없으면 null) */
export function allianceOf(state: Pick<AirlineState, 'alliances'>, ci: number): Alliance | null {
  return (state.alliances ?? []).find((a) => a.members.includes(ci)) ?? null;
}

/** 동맹 회사들 (나는 빼고, 운항을 멈춘 회사도 뺀다) */
export function alliesOf(state: Pick<AirlineState, 'alliances' | 'companies'>, ci: number): number[] {
  const a = allianceOf(state, ci);
  return a ? a.members.filter((m) => m !== ci && alive(state, m)) : [];
}

export function areAllied(state: Pick<AirlineState, 'alliances'>, x: number, y: number): boolean {
  const a = allianceOf(state, x);
  return !!a && x !== y && a.members.includes(y);
}

/** 쓰지 않은 동맹 이름 */
export function freeAllianceName(state: Pick<AirlineState, 'alliances'>): string {
  const used = new Set((state.alliances ?? []).map((a) => a.name));
  return ALLIANCE_NAMES.find((n) => !used.has(n)) ?? `동맹 ${(state.alliances ?? []).length + 1}`;
}

/**
 * x와 y를 한 동맹으로: 둘 다 없으면 새 동맹, 한쪽만 있으면 그 동맹에 넣는다.
 * 둘 다 다른 동맹이거나 자리가 없으면 그대로 돌려준다.
 */
export function joinAlliance<S extends Pick<AirlineState, 'alliances' | 'nextId' | 't'>>(state: S, x: number, y: number): S {
  const ax = allianceOf(state, x);
  const ay = allianceOf(state, y);
  const list = state.alliances ?? [];
  if (ax && ay) return state;
  if (!ax && !ay) {
    return { ...state, alliances: [...list, { id: state.nextId, name: freeAllianceName(state), members: [x, y], since: state.t }], nextId: state.nextId + 1 };
  }
  const host = (ax ?? ay)!;
  const newcomer = ax ? y : x;
  if (host.members.length >= MAX_MEMBERS) return state;
  return { ...state, alliances: list.map((a) => (a.id === host.id ? { ...a, members: [...a.members, newcomer] } : a)) };
}

/** 이 회사가 동맹에서 나간다 (혼자 남으면 동맹이 없어진다) */
export function leaveAlliance<S extends Pick<AirlineState, 'alliances'>>(state: S, ci: number): S {
  const list = (state.alliances ?? []).map((a) => ({ ...a, members: a.members.filter((m) => m !== ci) })).filter((a) => a.members.length >= 2);
  return { ...state, alliances: list };
}

/** 운항을 멈춘 회사를 동맹에서 뺀다 */
export function pruneAlliances<S extends Pick<AirlineState, 'alliances' | 'companies'>>(state: S): S {
  if (!state.alliances?.length) return state;
  const list = state.alliances.map((a) => ({ ...a, members: a.members.filter((m) => alive(state, m)) })).filter((a) => a.members.length >= 2);
  return { ...state, alliances: list };
}

/** 예전 저장의 1:1 제휴(partner)를 동맹으로 옮긴다 */
export function migratePartners<S extends Pick<AirlineState, 'alliances' | 'companies' | 'nextId' | 't'>>(state: S): S {
  let s = state;
  const done = new Set<number>();
  s.companies.forEach((c, ci) => {
    const p = c.partner;
    if (p === null || p === undefined || done.has(ci)) return;
    done.add(ci);
    done.add(p);
    if (s.companies[p]?.partner === ci && !allianceOf(s, ci) && !allianceOf(s, p)) s = joinAlliance(s, ci, p);
  });
  if (!s.companies.some((c) => c.partner !== null)) return s;
  return { ...s, companies: s.companies.map((c) => (c.partner === null ? c : { ...c, partner: null })) };
}

/** 이 회사들이 한 네트워크 (갈아타기·동맹 효과): 동맹마다 하나, 동맹이 없는 회사는 혼자 */
export function allianceGroups(state: Pick<AirlineState, 'alliances' | 'companies'>): number[][] {
  const out: number[][] = [];
  const seen = new Set<number>();
  state.companies.forEach((c, ci) => {
    if (c.out || seen.has(ci)) return;
    const group = [ci, ...alliesOf(state, ci)];
    for (const g of group) seen.add(g);
    out.push(group);
  });
  return out;
}
