import { CITIES, CITY, REGIONS, REGION_INFO, citySize } from './cities';
import { monthOf, yearOfM } from './time';
import type { DistOmit, Effect, NewsItem, NewsTone, RegionId, Rng } from './types';

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

/** 무작위 '기름값이 크게 올랐어요'는 유가가 보통 값의 이 배수보다 낮을 때만 (오름이 겹쳐 치솟지 않게) */
export const OIL_SPIKE_LIMIT = 1.5;
/** 보통 값과 상관없이 이 유가 위에서는 더 오르지 않는다 */
export const OIL_SPIKE_MAX = 2.4;

interface EventContext {
  /** 지금 달 */
  t: number;
  oil: number;
  /** 그 시대 보통 유가 (없으면 1) */
  oilNormal?: number;
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
    if (k === 'oilUp') return ctx.oil < Math.min(OIL_SPIKE_MAX, (ctx.oilNormal ?? 1) * OIL_SPIKE_LIMIT);
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
        news: { icon: '⛽', title: '기름값이 크게 올랐어요', text: `유가 지수: ${fmtOil(ctx.oil)} → ${fmtOil(to)}. 운임에 유류할증이 붙지만 늘어난 연료비를 다 메우지는 못해요. 연료를 많이 먹는 비행기일수록 손해가 커져요.`, tone: 'bad' },
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

/** 온 세계 손님 배수 (큰 사건) */
export function worldMult(effects: readonly Effect[]): number {
  return effects.reduce((m, e) => (e.kind === 'world' ? m * e.mult : m), 1);
}

// ------------------------------------------------------------------ 실제 역사 사건

/**
 * 실제로 일어난 큰 사건 (설정에서 '실제 역사'를 켜면 그 달에 일어난다).
 * demand: 손님 배수 (regions가 없으면 온 세계), months 달 동안.
 * aid: 정부 지원금 (지난달 비용의 몇 배를 회사마다 받는다).
 */
export interface HistoryEvent {
  year: number;
  /** 1~12 */
  month: number;
  icon: string;
  title: string;
  text: string;
  tone: NewsTone;
  demand?: { regions?: RegionId[]; mult: number; months: number }[];
  oil?: number;
  aid?: number;
}

export const HISTORY: readonly HistoryEvent[] = [
  { year: 1967, month: 6, icon: '⚔️', title: '6일 전쟁', text: '중동에서 전쟁이 일어나 수에즈 운하가 막혔어요. 중동을 오가는 손님이 줄어요.', tone: 'bad', demand: [{ regions: ['southmid', 'africa'], mult: 0.85, months: 9 }] },
  { year: 1973, month: 10, icon: '⛽', title: '1차 석유 파동', text: '중동 전쟁으로 산유국들이 석유 수출을 줄여 기름값이 크게 뛰었어요. 연료를 많이 먹는 비행기는 큰 손해를 봐요.', tone: 'bad', oil: 1.7, demand: [{ mult: 0.93, months: 12 }] },
  { year: 1978, month: 10, icon: '🗽', title: '미국 항공 자유화', text: '미국이 항공 규제를 풀어 누구나 노선과 운임을 정할 수 있게 됐어요. 값이 내려 아메리카 손님이 늘어요.', tone: 'good', demand: [{ regions: ['americas'], mult: 1.12, months: 24 }] },
  { year: 1979, month: 4, icon: '⛽', title: '2차 석유 파동', text: '이란 혁명으로 기름값이 다시 크게 올랐어요.', tone: 'bad', oil: 1.45, demand: [{ mult: 0.95, months: 12 }] },
  { year: 1986, month: 2, icon: '🛢️', title: '기름값 폭락', text: '산유국들이 석유를 많이 풀어 기름값이 절반 가까이 떨어졌어요. 연료비가 크게 줄어요.', tone: 'good', oil: 0.6 },
  { year: 1989, month: 11, icon: '🧱', title: '베를린 장벽 붕괴', text: '동서 유럽을 가르던 장벽이 무너졌어요. 유럽을 오가는 손님이 늘어요.', tone: 'good', demand: [{ regions: ['europe'], mult: 1.1, months: 24 }] },
  { year: 1990, month: 8, icon: '⚔️', title: '걸프 전쟁', text: '이라크가 쿠웨이트를 침공했어요. 기름값이 뛰고 중동과 세계 여행 손님이 줄어요.', tone: 'bad', oil: 1.55, demand: [{ regions: ['southmid'], mult: 0.65, months: 8 }, { mult: 0.92, months: 8 }] },
  { year: 1991, month: 12, icon: '🕊️', title: '소련 해체', text: '소련이 여러 나라로 나뉘며 냉전이 끝났어요. 막혔던 하늘길이 하나둘 열리고, 이제 누구나 러시아 비행기를 살 수 있어요.', tone: 'info' },
  { year: 1997, month: 7, icon: '📉', title: '아시아 외환 위기', text: '아시아 여러 나라의 돈값이 크게 떨어졌어요. 동아시아·동남아 손님이 줄어요.', tone: 'bad', demand: [{ regions: ['eastasia', 'seaoc'], mult: 0.84, months: 15 }] },
  { year: 2001, month: 9, icon: '🏢', title: '9·11 테러', text: '미국에서 비행기를 이용한 테러가 일어났어요. 비행기를 타려는 사람이 크게 줄고 보안이 엄해져요.', tone: 'bad', demand: [{ mult: 0.8, months: 5 }, { regions: ['americas'], mult: 0.85, months: 12 }] },
  { year: 2003, month: 4, icon: '😷', title: '사스 유행', text: '새 호흡기 전염병이 돌아 아시아 여행 손님이 크게 줄었어요.', tone: 'bad', demand: [{ regions: ['eastasia'], mult: 0.65, months: 3 }, { regions: ['seaoc'], mult: 0.82, months: 3 }] },
  { year: 2008, month: 10, icon: '🏦', title: '세계 금융 위기', text: '큰 은행들이 무너지며 세계 경제가 움츠러들었어요. 손님, 특히 사업 손님이 줄어요.', tone: 'bad', oil: 0.65, demand: [{ mult: 0.88, months: 12 }] },
  { year: 2010, month: 4, icon: '🌋', title: '아이슬란드 화산 폭발', text: '화산재가 유럽 하늘을 덮어 며칠 동안 비행기가 뜨지 못했어요.', tone: 'bad', demand: [{ regions: ['europe'], mult: 0.7, months: 1 }] },
  {
    year: 2020,
    month: 3,
    icon: '🦠',
    title: '코로나19 대유행',
    text: '전염병이 온 세계로 퍼져 나라마다 국경을 닫았어요. 손님이 거의 사라져요. 나라마다 항공사에 지원금을 줬어요. 비행기를 쉬게 하고 돈을 아끼세요.',
    tone: 'big',
    oil: 0.55,
    aid: 2.5,
    demand: [{ mult: 0.2, months: 3 }],
  },
  { year: 2020, month: 6, icon: '😷', title: '코로나19: 국경이 조금씩 열려요', text: '아직 손님이 예전의 절반에도 못 미쳐요. 가까운 나라 노선부터 조금씩 돌아와요.', tone: 'bad', aid: 1.2, demand: [{ mult: 0.42, months: 12 }] },
  { year: 2021, month: 6, icon: '💉', title: '백신 접종이 늘어요', text: '백신을 맞은 사람이 많아져 여행이 다시 늘기 시작했어요.', tone: 'info', demand: [{ mult: 0.7, months: 12 }] },
  { year: 2022, month: 2, icon: '⚔️', title: '우크라이나 전쟁', text: '러시아가 우크라이나를 침공했어요. 기름값이 뛰고, 서방과 러시아 사이 하늘길이 닫혀요.', tone: 'bad', oil: 1.35 },
  { year: 2022, month: 7, icon: '🧳', title: '여행이 돌아와요', text: '나라마다 국경을 열어 여행 손님이 거의 예전만큼 돌아왔어요. 밀렸던 여행 수요로 관광 손님이 북적여요.', tone: 'good', demand: [{ mult: 0.92, months: 9 }] },
];

/** 이 달에 일어나는 실제 역사 사건 */
export function historyAt(t: number): HistoryEvent[] {
  const year = yearOfM(t);
  const month = monthOf(t);
  return HISTORY.filter((e) => e.year === year && e.month === month);
}

/** 실제 역사의 기름값 기준 (유가는 이 값 쪽으로 천천히 돌아간다) */
export function historicOil(year: number): number {
  if (year < 1974) return 1;
  if (year < 1979) return 1.3;
  if (year < 1986) return 1.5;
  if (year < 2000) return 0.9;
  if (year < 2005) return 1;
  if (year < 2015) return 1.35;
  if (year < 2022) return 1;
  // 2026년 뒤는 예측: 탄소세로 등유값이 오르다가 수소·전기가 퍼지며 천천히 내린다
  if (year < 2035) return 1.2;
  if (year < 2055) return 1.35;
  if (year < 2075) return 1.2;
  return 1.05;
}
