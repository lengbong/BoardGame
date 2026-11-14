import type { AdMedia, CampaignKind, Company, ModKind, RegionId } from './types';

/**
 * 광고 매체와 캠페인 (에어 매니지먼트처럼 매체를 골라 광고하고, 짧은 캠페인을 벌인다).
 *
 * 매체: 지역마다 하나. 같은 돈으로 알려지는 정도(power)와, 어떤 손님에게 잘 닿는지(biz·leisure)가 다르다.
 * 캠페인: 한 분기에 하나. 돈을 내면 정해진 동안 손님이 늘거나 회사가 크게 알려진다.
 */
export interface MediaInfo {
  name: string;
  icon: string;
  desc: string;
  /** 사업·관광 손님에게 닿는 배수 (알려진 정도의 효과에 곱한다) */
  biz: number;
  leisure: number;
  /** 같은 돈으로 쌓이는 알려진 정도 배수 */
  power: number;
  /** 아무리 써도 이만큼까지만 (1이면 끝까지) */
  cap: number;
  /** 이 해부터 쓸 수 있다 */
  from: number;
}

export const MEDIA: readonly AdMedia[] = ['tv', 'newspaper', 'magazine', 'radio', 'internet'];

export const MEDIA_INFO: Record<AdMedia, MediaInfo> = {
  tv: { name: 'TV', icon: '📺', desc: '모든 손님에게 고루, 가장 널리 알려져요', biz: 1, leisure: 1, power: 1, cap: 1, from: 1950 },
  newspaper: { name: '신문', icon: '📰', desc: '사업 손님이 많이 봐요 (관광 손님에게는 덜 닿아요)', biz: 1.4, leisure: 0.65, power: 0.95, cap: 1, from: 1950 },
  magazine: { name: '여행 잡지', icon: '📖', desc: '관광 손님이 많이 봐요 (사업 손님에게는 덜 닿아요)', biz: 0.65, leisure: 1.4, power: 0.95, cap: 1, from: 1950 },
  radio: { name: '라디오', icon: '📻', desc: '적은 돈으로 잘 알려지지만 많이 써도 덜 늘어요', biz: 1, leisure: 1, power: 1.5, cap: 0.65, from: 1950 },
  internet: { name: '인터넷', icon: '💻', desc: '같은 돈에 효과가 크고 사업·관광 손님 모두에게 닿아요', biz: 1.1, leisure: 1.1, power: 1.35, cap: 1, from: 1998 },
};

/** 회사가 그 지역에 쓰는 매체 (예전 저장은 TV) */
export function mediaOf(c: Company, region: RegionId): AdMedia {
  return c.adMedia?.[region] ?? 'tv';
}

/** 광고비가 쌓아 주는 알려진 정도의 목표 (0~1) */
export function adTarget(c: Company, region: RegionId, scale: number): number {
  const m = MEDIA_INFO[mediaOf(c, region)];
  return Math.min(m.cap, 1 - Math.exp((-c.ads[region] * m.power) / scale));
}

export interface CampaignInfo {
  name: string;
  icon: string;
  desc: string;
  /** 광고 규모(adScale)의 몇 배를 내는지 */
  costK: number;
  /** 지역을 골라야 하는지 */
  region: boolean;
  /** 손님 배수 효과 */
  mod?: { kind: Extract<ModKind, 'demand'>; seg?: 'biz' | 'leisure'; value: number; quarters: number };
  /** 그 지역에 알려진 정도 더하기 */
  awareness?: number;
  /** 평판 더하기 */
  rep?: number;
  from: number;
}

export const CAMPAIGNS: readonly CampaignKind[] = ['sale', 'miles', 'lucky', 'star'];

export const CAMPAIGN_INFO: Record<CampaignKind, CampaignInfo> = {
  sale: { name: '할인 대잔치', icon: '🏷️', desc: '고른 지역에 닿는 노선의 관광 손님이 이번 분기에 25% 늘어요', costK: 1.4, region: true, mod: { kind: 'demand', seg: 'leisure', value: 1.25, quarters: 1 }, from: 1950 },
  miles: { name: '마일리지 두 배', icon: '💳', desc: '모든 노선의 사업 손님이 두 분기 동안 10% 늘어요', costK: 2.6, region: false, mod: { kind: 'demand', seg: 'biz', value: 1.1, quarters: 2 }, from: 1981 },
  lucky: { name: '경품 행사', icon: '🎁', desc: '모든 노선의 관광 손님이 두 분기 동안 8% 늘어요', costK: 1.8, region: false, mod: { kind: 'demand', seg: 'leisure', value: 1.08, quarters: 2 }, from: 1950 },
  star: { name: '스타 광고 모델', icon: '🌟', desc: '고른 지역에 회사가 크게 알려지고(+20%p) 평판이 조금 올라요', costK: 3, region: true, awareness: 0.2, rep: 2, from: 1950 },
};
