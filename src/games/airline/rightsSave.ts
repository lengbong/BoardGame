import type { AirlineState } from './types';
import type { RightsMode } from './rightsTypes';

/*
 * 운수권의 저장 값. 저장 판 번호는 그대로 4판이고 새 값은 모두 선택이에요:
 * 없으면(예전 저장·다른 판의 저장) 운수권을 끈 채로 예전 규칙 그대로 이어서 놀아요.
 */

const RIGHTS_MODES: readonly RightsMode[] = ['off', 'simple', 'real'];

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 설정의 운수권 값 (올바를 때만 키를 둔다: 기본값 위에 펼쳐도 기본값을 지우지 않게) */
export function parseRightsOption(o: Record<string, unknown>): { rights?: RightsMode } {
  return RIGHTS_MODES.includes(o.rights as RightsMode) ? { rights: o.rights as RightsMode } : {};
}

/** 운수권 장부가 올바른지 (없으면 올바름) */
export function isValidRightsState(s: AirlineState): boolean {
  const n = s.companies.length;
  const rt = s.rights as unknown;
  if (rt === undefined) return true;
  if (!isObj(rt) || !Array.isArray(rt.held) || rt.held.length !== n || !Array.isArray(rt.apps) || rt.apps.length !== n) return false;
  const okKey = (k: unknown) => typeof k === 'string' && k.includes('|') && k.length < 80;
  if (!rt.held.every((list) => Array.isArray(list) && list.length <= 200 && list.every((r) => isObj(r) && okKey(r.key) && isInt(r.add) && r.add > 0 && isInt(r.since) && isInt(r.used)))) return false;
  if (!rt.apps.every((list) => Array.isArray(list) && list.length <= 10 && list.every((a) => isObj(a) && okKey(a.key) && isInt(a.add) && a.add > 0 && isInt(a.due) && isNum(a.fee)))) return false;
  return true;
}
