import type { RegionId } from './types';

/**
 * 단골 손님 프로그램과 브랜드 자리의 타입 (loyalty.ts · brandPosition.ts).
 * 저장 판 번호는 그대로(4판)이고 새 값은 모두 선택이에요: 없으면(예전 저장) 단골 프로그램이 없고 브랜드도 정하지 않은 채로 놀아요.
 *
 * 나누어 맡는 일:
 * - 평판(reputation): 지금 우리 비행이 얼마나 좋은지 (기내식·비행기·정시) — 바로바로 움직여요
 * - 광고로 알려진 정도(awareness): 우리 회사를 아는 사람이 얼마나 많은지
 * - 단골 손님(loyalty): 우리를 계속 타 주는 회원 — 천천히 모이고 천천히 떠나요
 * - 브랜드(brandPos): 우리 회사 하면 떠오르는 것 — 내세운 모습대로 살면 쌓이고, 어긋나면 깎여요
 */

/** 단골 프로그램 단계: 1 기본 · 2 실버 · 3 골드 */
export type LoyaltyLevel = 1 | 2 | 3;

/** 회사의 단골 손님 프로그램 (없으면 프로그램이 없다) */
export interface LoyaltyState {
  level: LoyaltyLevel;
  /** 시작한 달 */
  since: number;
  /** 지역마다 회원 수 (명) */
  members: Record<RegionId, number>;
  /** 지역마다 그 지역에 닿는 우리 달 손님 (천천히 따라가는 값, 회원이 모일 바탕) */
  base: Record<RegionId, number>;
  /** 지역마다 그 지역에 닿는 우리 주간 운항 (천천히 따라가는 값, 노선을 줄였는지 본다) */
  reach: Record<RegionId, number>;
  /** 지역마다 우리 단골 손님 가운데 회원 몫 0~1 (손님 끌기에 쓰는, 달마다 다시 셈한 값) */
  pen: Record<RegionId, number>;
  /** 최근 24달 전체 회원 수 (그래프, 오래된 것부터) */
  hist: number[];
  /** 지난달 프로그램 값 (운영비 + 마일리지, 억). 그만둘 때 남은 마일리지를 정리하는 데 쓴다 */
  last: number;
}

/** 브랜드 자리: 믿음직한 정시 · 따뜻한 서비스 · 알뜰한 운임 · 넓은 노선망 */
export type BrandPos = 'ontime' | 'service' | 'value' | 'network';

/** 회사의 브랜드 (없으면 아직 정하지 않았다: 효과 없음) */
export interface BrandPosState {
  pos: BrandPos;
  /** 브랜드 힘 0~100 */
  strength: number;
  /** 이 자리로 정한 달 (바꾸기는 한 해에 한 번) */
  since: number;
  /** 바꾸는 중인 자리 (t 달에 바뀐다) */
  next?: { pos: BrandPos; t: number } | null;
  /** 지난달 '얼마나 어울려요' −1~1 */
  fit: number;
  /** 최근 24달 브랜드 힘 (그래프) */
  hist: number[];
  /** 소식으로 알린 가장 높은 문턱 (BRAND_TIERS 몇 번째까지, 오르내림이 잦을 때 소식을 거듭 내지 않게) */
  told?: number;
}

export type LoyaltyAction =
  /** 단골 프로그램 단계 (0이면 그만둔다, 없을 때 1~3이면 시작한다) */
  | { type: 'setLoyalty'; level: 0 | LoyaltyLevel }
  /** 브랜드 자리 정하기·바꾸기 (처음은 바로·공짜, 그 뒤는 돈과 석 달. 지금 자리를 고르면 바꾸기를 그만둔다) */
  | { type: 'setBrandPos'; pos: BrandPos };

export type LoyaltyEvent = { id: number; type: 'loyalty'; company: number; what: 'level' | 'brand' };
