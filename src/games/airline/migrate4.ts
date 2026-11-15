import { BIZ_MODELS } from './bizmodel';
import { CLASS_FARE_MAX, CLASS_FARE_MIN } from './classes';
import type { BizModel, Company } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 4판 저장 (등급별 운임·사업 모델·화물).
 *
 * 3판 저장을 4판으로 바꾸는 방법: 모든 회사는 풀서비스, 노선의 일반석 운임(fare)은 그대로 두고
 * 비즈니스석·일등석 운임은 예전처럼 일반석 운임 조정을 따라가게(같은 %) 정하고, 화물 운임은 0으로.
 * 결산의 새 값(화물·부가 수입·등급 손님)은 0으로 채운다.
 */

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const clampFare = (v: unknown) => (isInt(v) ? Math.max(CLASS_FARE_MIN, Math.min(CLASS_FARE_MAX, v)) : 0);

/** 결산 한 줄에 4판에서 생긴 값이 없으면 0으로 */
export const REPORT_V4_KEYS = ['cargo', 'ancillary', 'cargoT', 'cargoCap', 'paxF', 'paxC', 'revF', 'revC'] as const;

function fillReport(r: unknown): void {
  if (!isObj(r)) return;
  for (const key of REPORT_V4_KEYS) if (typeof r[key] !== 'number' || !Number.isFinite(r[key])) r[key] = 0;
}

/** 3판 저장 → 4판 (다른 판은 그대로 돌려준다) */
export function migrateV3(v: unknown): unknown {
  if (!isObj(v) || v.version !== 3 || !Array.isArray(v.companies)) return v;
  const s = JSON.parse(JSON.stringify(v)) as Record<string, any>;
  s.version = 4;
  for (const c of s.companies) {
    if (!isObj(c)) continue;
    c.bizModel = 'full';
    c.bizModelNext = null;
    for (const r of Array.isArray(c.routes) ? c.routes : []) {
      if (!isObj(r)) continue;
      r.fareC = clampFare(r.fare);
      r.fareF = clampFare(r.fare);
      r.fareK = 0;
    }
  }
  const reports = [s.report, s.qReport, ...(Array.isArray(s.ledger) ? s.ledger : []), ...(Array.isArray(s.years) ? s.years : [])];
  for (const rep of reports) if (isObj(rep) && Array.isArray(rep.companies)) for (const r of rep.companies) fillReport(r);
  return s;
}

/** 4판 회사 값 (사업 모델·등급 운임)이 올바른지 */
export function isValidV4Company(k: Company): boolean {
  if (!BIZ_MODELS.includes(k.bizModel)) return false;
  const next = k.bizModelNext;
  if (next !== undefined && next !== null && !(isObj(next) && BIZ_MODELS.includes(next.model) && isInt(next.t))) return false;
  for (const r of k.routes) {
    for (const key of ['fareC', 'fareF', 'fareK'] as const) {
      const f = r[key];
      if (f !== undefined && !(isInt(f) && f >= CLASS_FARE_MIN && f <= CLASS_FARE_MAX)) return false;
    }
  }
  return true;
}

/** 설정 저장의 자리마다 사업 모델 */
export function parseModels(v: unknown): (BizModel | null)[] {
  const list = Array.isArray(v) ? v : [];
  return [0, 1, 2, 3].map((i) => (BIZ_MODELS.includes(list[i]) ? (list[i] as BizModel) : null));
}
