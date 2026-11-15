import { REGIONS } from './cities';
import { BRAND_POSITIONS } from './brandPosition';
import type { AirlineState } from './types';

/*
 * 단골 프로그램·브랜드 자리의 저장 값. 저장 판 번호는 그대로 4판이고 새 값은 모두 선택이에요:
 * 없으면(예전 저장) 프로그램 없이, 브랜드도 정하지 않은 채로 이어서 놀아요.
 */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const okRegions = (v: unknown, max: number) => isObj(v) && REGIONS.every((r) => isNum(v[r]) && (v[r] as number) >= 0 && (v[r] as number) <= max);
const okHist = (v: unknown, max: number) => Array.isArray(v) && v.length <= 24 && v.every((x) => isNum(x) && x >= 0 && x <= max);

function okLoyalty(v: unknown): boolean {
  if (v === undefined) return true;
  if (!isObj(v)) return false;
  if (!(v.level === 1 || v.level === 2 || v.level === 3) || !isInt(v.since)) return false;
  const big = 1e10;
  if (!okRegions(v.members, big) || !okRegions(v.base, big) || !okRegions(v.reach, 1e7) || !okRegions(v.pen, 1)) return false;
  return okHist(v.hist, big * 6) && isNum(v.last) && v.last >= 0;
}

function okBrand(v: unknown): boolean {
  if (v === undefined) return true;
  if (!isObj(v)) return false;
  if (!BRAND_POSITIONS.includes(v.pos as never) || !isNum(v.strength) || v.strength < 0 || v.strength > 100 || !isInt(v.since)) return false;
  if (!isNum(v.fit) || v.fit < -1 || v.fit > 1 || !okHist(v.hist, 100)) return false;
  if (v.next !== undefined && v.next !== null && !(isObj(v.next) && BRAND_POSITIONS.includes(v.next.pos as never) && isInt(v.next.t))) return false;
  if (v.told !== undefined && !(isInt(v.told) && v.told >= 0 && v.told <= 3)) return false;
  return true;
}

/** 회사마다 단골 프로그램·브랜드 값이 올바른지 (없으면 올바름) */
export function isValidLoyaltyState(s: AirlineState): boolean {
  return s.companies.every((c) => okLoyalty((c as { loyalty?: unknown }).loyalty) && okBrand((c as { brandPos?: unknown }).brandPos));
}
