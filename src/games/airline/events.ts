import { CITIES, CITY, REGIONS, REGION_INFO, citySize } from './cities';
import { monthOf, yearOfM } from './time';
import type { DistOmit, Effect, NewsItem, RegionId, Rng } from './types';

/**
 * 실제로 열렸거나 열리기로 정해진 올림픽(여름·겨울)과 세계 엑스포 가운데, 이 게임의 도시에서 열리는 것.
 * months: 행사가 열린 달 (대략, 1~12).
 */
export interface FixedEvent {
  year: number;
  months: number[];
  city: string;
  kind: 'olympic' | 'winter' | 'expo';
  title: string;
}

export const FIXED_EVENTS: readonly FixedEvent[] = [
  { year: 1964, months: [10], city: 'tokyo', kind: 'olympic', title: '도쿄 올림픽' },
  { year: 1967, months: [4, 5, 6, 7, 8, 9, 10], city: 'montreal', kind: 'expo', title: '몬트리올 엑스포' },
  { year: 1968, months: [10], city: 'mexicocity', kind: 'olympic', title: '멕시코시티 올림픽' },
  { year: 1970, months: [3, 4, 5, 6, 7, 8, 9], city: 'osaka', kind: 'expo', title: '오사카 엑스포' },
  { year: 1976, months: [7, 8], city: 'montreal', kind: 'olympic', title: '몬트리올 올림픽' },
  { year: 1984, months: [7, 8], city: 'losangeles', kind: 'olympic', title: '로스앤젤레스 올림픽' },
  { year: 1986, months: [5, 6, 7, 8, 9, 10], city: 'vancouver', kind: 'expo', title: '밴쿠버 엑스포' },
  { year: 1988, months: [9, 10], city: 'seoul', kind: 'olympic', title: '서울 올림픽' },
  { year: 1992, months: [7, 8], city: 'barcelona', kind: 'olympic', title: '바르셀로나 올림픽' },
  { year: 2000, months: [9, 10], city: 'sydney', kind: 'olympic', title: '시드니 올림픽' },
  { year: 2004, months: [8], city: 'athens', kind: 'olympic', title: '아테네 올림픽' },
  { year: 2008, months: [8], city: 'beijing', kind: 'olympic', title: '베이징 올림픽' },
  { year: 2010, months: [2, 3], city: 'vancouver', kind: 'winter', title: '밴쿠버 겨울 올림픽' },
  { year: 2010, months: [5, 6, 7, 8, 9, 10], city: 'shanghai', kind: 'expo', title: '상하이 엑스포' },
  { year: 2012, months: [7, 8], city: 'london', kind: 'olympic', title: '런던 올림픽' },
  { year: 2015, months: [5, 6, 7, 8, 9, 10], city: 'milan', kind: 'expo', title: '밀라노 엑스포' },
  { year: 2016, months: [8, 9], city: 'rio', kind: 'olympic', title: '리우데자네이루 올림픽' },
  { year: 2024, months: [7, 8], city: 'paris', kind: 'olympic', title: '파리 올림픽' },
  { year: 2025, months: [4, 5, 6, 7, 8, 9, 10], city: 'osaka', kind: 'expo', title: '오사카 엑스포' },
  { year: 2028, months: [7, 8], city: 'losangeles', kind: 'olympic', title: '로스앤젤레스 올림픽' },
];

export const FIXED_ICON: Record<FixedEvent['kind'], string> = { olympic: '🏅', winter: '⛷️', expo: '🎡' };

/** 올림픽·엑스포 때문에 늘어나는 손님 배수 (그 도시를 오가는 모든 노선, t: 그 달) */
export function fixedEventMult(city: string, t: number): number {
  const year = yearOfM(t);
  const month = monthOf(t);
  let m = 1;
  for (const e of FIXED_EVENTS) {
    if (e.city !== city || e.year !== year) continue;
    if (e.months.includes(month)) m *= e.kind === 'expo' ? 1.35 : e.kind === 'winter' ? 1.5 : 1.8;
    else m *= 1.08;
  }
  return m;
}

/** 이 달에 막 시작하는 행사 */
export function fixedEventsAt(t: number): FixedEvent[] {
  const year = yearOfM(t);
  const month = monthOf(t);
  return FIXED_EVENTS.filter((e) => e.year === year && e.months[0] === month);
}

/** 사건 하나가 바꾸는 것 (simulate.ts가 상태에 넣는다) */
export interface EventOutcome {
  news: Omit<NewsItem, 'id' | 't'>;
  effect?: DistOmit<Effect, 'id'>;
  /** 유가에 곱하기 */
  oil?: number;
  /** 금리 더하기 (연 %p) */
  rate?: number;
  /** 공항 슬롯 늘리기 */
  slot?: { city: string; add: number };
}

interface EventContext {
  /** 지금 달 */
  t: number;
  oil: number;
  rate: number;
  slotBoost: Record<string, number>;
  /** 이미 걸려 있는 효과 (같은 효과가 겹치지 않게) */
  effects: readonly Effect[];
  /** 지금 하늘길에 노선이 있는 도시들 (사건이 판에 닿게) */
  activeCities: readonly string[];
}

function pickWeighted<T>(items: readonly T[], weight: (t: T) => number, rng: Rng): T | undefined {
  const total = items.reduce((s, t) => s + Math.max(0, weight(t)), 0);
  if (total <= 0) return undefined;
  let r = rng() * total;
  for (const t of items) {
    r -= Math.max(0, weight(t));
    if (r <= 0) return t;
  }
  return items[items.length - 1];
}

type EventKind = 'oilUp' | 'oilDown' | 'boom' | 'slump' | 'tourism' | 'fair' | 'sale' | 'airport' | 'rateUp' | 'rateDown';

const EVENT_WEIGHTS: Record<EventKind, number> = {
  oilUp: 1,
  oilDown: 1,
  boom: 1.2,
  slump: 0.9,
  tourism: 1.2,
  fair: 0.9,
  sale: 0.7,
  airport: 0.8,
  rateUp: 0.5,
  rateDown: 0.5,
};

const fmtOil = (v: number) => v.toFixed(2);

/** 무작위 사건 하나 (일어날지는 부르는 쪽이 정한다) */
export function rollRandomEvent(ctx: EventContext, rng: Rng): EventOutcome | null {
  const year = yearOfM(ctx.t);
  const kinds = (Object.keys(EVENT_WEIGHTS) as EventKind[]).filter((k) => {
    if (k === 'oilUp') return ctx.oil < 2.4;
    if (k === 'oilDown') return ctx.oil > 0.7;
    if (k === 'rateUp') return ctx.rate < 11;
    if (k === 'rateDown') return ctx.rate > 3.5;
    if (k === 'sale') return !ctx.effects.some((e) => e.kind === 'sale');
    return true;
  });
  const kind = pickWeighted(kinds, (k) => EVENT_WEIGHTS[k], rng);
  if (!kind) return null;
  // 도시 사건은 지금 노선이 있는 도시를 조금 더 자주 고른다
  const cityWeight = (id: string, base: number) => base * (ctx.activeCities.includes(id) ? 2.5 : 1);
  const until = ctx.t + 12;
  switch (kind) {
    case 'oilUp': {
      const mult = 1.3 + rng() * 0.25;
      const to = ctx.oil * mult;
      return {
        oil: mult,
        news: { icon: '⛽', title: '기름값이 크게 올랐어요', text: `유가 지수: ${fmtOil(ctx.oil)} → ${fmtOil(to)}. 연료를 많이 먹는 비행기일수록 손해가 커져요.`, tone: 'bad' },
      };
    }
    case 'oilDown': {
      const mult = 0.7 + rng() * 0.1;
      return {
        oil: mult,
        news: { icon: '🛢️', title: '기름값이 내렸어요', text: `유가 지수: ${fmtOil(ctx.oil)} → ${fmtOil(ctx.oil * mult)}. 연료비가 줄어요.`, tone: 'good' },
      };
    }
    case 'boom':
    case 'slump': {
      const region = REGIONS[Math.floor(rng() * REGIONS.length)] as RegionId;
      if (ctx.effects.some((e) => (e.kind === 'boom' || e.kind === 'slump') && e.region === region)) return null;
      const good = kind === 'boom';
      return {
        effect: { kind, region, mult: good ? 1.15 : 0.86, until },
        news: good
          ? { icon: '📈', title: `${REGION_INFO[region].name} 경기 호황`, text: `${REGION_INFO[region].name} 경제가 좋아져서 1년 동안 그곳을 오가는 손님이 15% 늘어요.`, tone: 'good' }
          : { icon: '📉', title: `${REGION_INFO[region].name} 경기 불황`, text: `${REGION_INFO[region].name} 경제가 움츠러들어 1년 동안 그곳을 오가는 손님이 14% 줄어요.`, tone: 'bad' },
      };
    }
    case 'tourism': {
      const city = pickWeighted(
        CITIES.filter((c) => c.fun >= 6 && !ctx.effects.some((e) => e.kind === 'tourism' && e.city === c.id)),
        (c) => cityWeight(c.id, c.fun),
        rng,
      );
      if (!city) return null;
      return {
        effect: { kind: 'tourism', city: city.id, mult: 1.5, until },
        news: { icon: '🎒', title: `${city.name} 여행 붐`, text: `${city.name} 여행이 인기를 끌어서 1년 동안 관광 손님이 1.5배가 돼요.`, tone: 'good', city: city.id },
      };
    }
    case 'fair': {
      const city = pickWeighted(
        CITIES.filter((c) => c.biz >= 0.55 && citySize(c, year) >= 3),
        (c) => cityWeight(c.id, c.biz * citySize(c, year)),
        rng,
      );
      if (!city) return null;
      return {
        effect: { kind: 'fair', city: city.id, mult: 1.4, until: ctx.t + 2 },
        news: { icon: '🏢', title: `${city.name} 국제 박람회`, text: `이번 달과 다음 달에 ${city.name}에서 큰 박람회가 열려서 사업 손님이 1.4배로 늘어요.`, tone: 'good', city: city.id },
      };
    }
    case 'sale':
      return {
        effect: { kind: 'sale', mult: 0.85, until: ctx.t + 6 },
        news: { icon: '🛩️', title: '항공 박람회 특가', text: '항공 박람회가 열려서 앞으로 여섯 달 동안 새 비행기 값과 리스료가 15% 싸요.', tone: 'good' },
      };
    case 'airport': {
      const city = pickWeighted(
        CITIES.filter((c) => (ctx.slotBoost[c.id] ?? 0) < 0.75),
        (c) => cityWeight(c.id, citySize(c, year)),
        rng,
      );
      if (!city) return null;
      return {
        slot: { city: city.id, add: 0.25 },
        news: { icon: '🏗️', title: `${city.name} 공항 확장`, text: `${city.name} 공항에 새 탑승구가 생겨서 회사마다 쓸 수 있는 주간 운항 횟수(슬롯)가 25% 늘었어요.`, tone: 'good', city: city.id },
      };
    }
    case 'rateUp':
      return {
        rate: 1.5,
        news: { icon: '🏦', title: '금리가 올랐어요', text: `은행 대출 금리가 연 ${ctx.rate.toFixed(1)}%에서 ${(ctx.rate + 1.5).toFixed(1)}%로 올랐어요. 빚이 많으면 이자가 늘어요.`, tone: 'bad' },
      };
    case 'rateDown':
      return {
        rate: -1.5,
        news: { icon: '🏦', title: '금리가 내렸어요', text: `은행 대출 금리가 연 ${ctx.rate.toFixed(1)}%에서 ${(ctx.rate - 1.5).toFixed(1)}%로 내렸어요. 돈을 빌리기 좋아요.`, tone: 'good' },
      };
  }
}

/** 효과가 걸린 손님 배수 (사업·관광 따로) */
export function effectMults(effects: readonly Effect[], cityId: string): { biz: number; leisure: number } {
  const city = CITY[cityId];
  let biz = 1;
  let leisure = 1;
  for (const e of effects) {
    if ((e.kind === 'boom' || e.kind === 'slump') && e.region === city.region) {
      biz *= e.mult;
      leisure *= e.mult;
    } else if (e.kind === 'tourism' && e.city === cityId) leisure *= e.mult;
    else if (e.kind === 'fair' && e.city === cityId) biz *= e.mult;
  }
  return { biz, leisure };
}

/** 비행기 값 배수 (박람회 특가) */
export function priceMult(effects: readonly Effect[]): number {
  return effects.reduce((m, e) => (e.kind === 'sale' ? m * e.mult : m), 1);
}
