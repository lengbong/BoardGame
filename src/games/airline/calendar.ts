import { CITY } from './cities';
import type { RegionId, Season } from './types';

/**
 * 달마다 바뀌는 것: 관광 성수기, 명절·방학 같은 여행철, 날씨 (태풍·폭설·몬순·안개).
 * 숫자는 게임용 어림이다. month0: 0(1월) ~ 11(12월).
 */

/** 성수기 모양마다 열두 달 관광 손님 배수 (평균 1 안팎) */
export const SEASON_MONTHS: Record<Season, readonly number[]> = {
  flat: [0.94, 0.94, 1, 1.02, 1.02, 1.02, 1.06, 1.06, 1, 1, 0.96, 0.98],
  // 북반구 여름 (지중해·유럽 바닷가·부산)
  summer: [0.68, 0.7, 0.84, 0.98, 1.06, 1.26, 1.5, 1.55, 1.16, 0.95, 0.72, 0.8],
  // 따뜻한 곳의 겨울 성수기 (하와이·방콕·몰디브·두바이)
  winter: [1.42, 1.38, 1.22, 1.02, 0.8, 0.7, 0.76, 0.74, 0.72, 0.92, 1.12, 1.4],
  // 남반구 여름 (시드니·리우)
  south: [1.5, 1.38, 1.15, 0.96, 0.8, 0.7, 0.8, 0.76, 0.86, 0.96, 1.06, 1.38],
};

export const SEASON_NAMES: Record<Season, string> = {
  flat: '사계절 고르게',
  summer: '여름(6~9월) 성수기',
  winter: '겨울(11~3월) 성수기',
  south: '남반구 여름(12~2월) 성수기',
};

/** 지역마다 모두가 여행을 많이 하는 때 (설·추석·여름방학·연말 등). 관광 손님에 곱한다 */
const HOLIDAYS: Record<RegionId, readonly number[]> = {
  //            1월   2월   3월  4월  5월   6월  7월   8월   9월   10월  11월  12월
  eastasia: [1.08, 1.12, 0.96, 0.98, 1.06, 0.96, 1.08, 1.1, 1.06, 1.02, 0.94, 1.06],
  seaoc: [1.08, 1.08, 0.98, 1.02, 0.98, 0.98, 1.04, 1.04, 0.98, 0.98, 0.96, 1.1],
  southmid: [1.04, 0.98, 0.98, 1, 1.04, 1.02, 1.02, 1, 0.96, 1.04, 1.04, 1.08],
  europe: [0.98, 0.96, 0.98, 1.04, 1.02, 1.02, 1.1, 1.12, 1, 0.98, 0.92, 1.08],
  africa: [1.02, 0.98, 0.98, 1, 0.98, 1, 1.06, 1.06, 0.98, 0.98, 0.98, 1.08],
  americas: [0.98, 0.98, 1.04, 1, 1, 1.04, 1.1, 1.08, 0.96, 0.98, 1.02, 1.1],
};

/** 사업 손님: 여름휴가·연말연시에 줄어든다 */
const BIZ: Record<RegionId, readonly number[]> = {
  eastasia: [0.94, 0.88, 1.04, 1.04, 1.02, 1.04, 0.98, 0.94, 1.04, 1.04, 1.06, 0.96],
  seaoc: [0.96, 0.94, 1.04, 1.02, 1.02, 1.02, 1, 0.98, 1.02, 1.04, 1.04, 0.92],
  southmid: [1, 1, 1.02, 1, 0.98, 0.98, 0.98, 0.98, 1.02, 1.02, 1.04, 0.98],
  europe: [0.96, 1.02, 1.06, 1.04, 1.04, 1.04, 0.92, 0.82, 1.06, 1.06, 1.04, 0.9],
  africa: [0.98, 1, 1.02, 1, 1, 1, 0.98, 0.96, 1.02, 1.02, 1.02, 0.96],
  americas: [0.96, 1, 1.04, 1.02, 1.02, 1.02, 0.96, 0.94, 1.04, 1.04, 1, 0.94],
};

export function leisureMonthMult(cityId: string, month0: number): number {
  const c = CITY[cityId];
  return SEASON_MONTHS[c.season][month0] * HOLIDAYS[c.region][month0];
}

export function bizMonthMult(cityId: string, month0: number): number {
  return BIZ[CITY[cityId].region][month0];
}

/** 성수기 모양의 분기 평균 (화면·호텔 수입용) */
export function seasonQuarterMult(season: Season, quarter0: number): number {
  const m = SEASON_MONTHS[season];
  return (m[quarter0 * 3] + m[quarter0 * 3 + 1] + m[quarter0 * 3 + 2]) / 3;
}

// ------------------------------------------------------------------ 날씨

export type WeatherCause = 'typhoon' | 'snow' | 'monsoon' | 'fog' | 'storm';

export const WEATHER_INFO: Record<WeatherCause, { icon: string; name: string }> = {
  typhoon: { icon: '🌀', name: '태풍' },
  snow: { icon: '❄️', name: '폭설' },
  monsoon: { icon: '🌧️', name: '몬순 폭우' },
  fog: { icon: '🌫️', name: '짙은 안개' },
  storm: { icon: '⛈️', name: '열대 폭풍' },
};

const TYPHOON = new Set(['tokyo', 'osaka', 'seoul', 'busan', 'jeju', 'shanghai', 'hongkong', 'taipei', 'manila', 'guam']);
const MONSOON = new Set(['mumbai', 'delhi', 'colombo', 'kathmandu', 'bangkok', 'hochiminh', 'male']);
const FOG = new Set(['london', 'amsterdam', 'paris', 'frankfurt', 'milan', 'zurich', 'sanfrancisco']);
const STORM = new Set(['miami', 'honolulu']);
/** 바다 가까워 겨울이 순한 곳 (눈이 덜 온다) */
const MILD_WINTER = new Set(['london', 'paris', 'amsterdam', 'madrid', 'barcelona', 'rome', 'milan', 'athens', 'istanbul', 'vancouver', 'sanfrancisco', 'seoul', 'busan']);

/**
 * 이 도시의 이 달 날씨가 운항을 얼마나 흔드는지 (1이면 보통, 클수록 지연·결항이 늘어난다)와 큰 원인.
 */
export function weather(cityId: string, month0: number): { factor: number; cause: WeatherCause | null } {
  const c = CITY[cityId];
  if (!c) return { factor: 1, cause: null };
  let best: { add: number; cause: WeatherCause | null } = { add: 0, cause: null };
  const consider = (add: number, cause: WeatherCause) => {
    if (add > best.add) best = { add, cause };
  };
  if (TYPHOON.has(cityId)) consider([0, 0, 0, 0, 0, 0.15, 0.7, 1.0, 0.8, 0.25, 0, 0][month0], 'typhoon');
  if (MONSOON.has(cityId)) consider([0, 0, 0, 0, 0.1, 0.7, 0.9, 0.8, 0.55, 0.1, 0, 0][month0], 'monsoon');
  if (STORM.has(cityId)) consider([0, 0, 0, 0, 0, 0.1, 0.25, 0.5, 0.6, 0.35, 0.1, 0][month0], 'storm');
  if (c.lat >= 38) {
    const mild = MILD_WINTER.has(cityId) ? 0.45 : 1;
    const snow = [0.7, 0.6, 0.25, 0, 0, 0, 0, 0, 0, 0, 0.15, 0.55][month0] * (c.lat >= 48 ? 1.1 : c.lat >= 42 ? 1 : 0.6) * mild;
    consider(snow, 'snow');
  }
  if (FOG.has(cityId)) {
    const fog = cityId === 'sanfrancisco' ? [0, 0, 0, 0, 0, 0.2, 0.35, 0.35, 0.15, 0, 0, 0][month0] : [0.35, 0.2, 0.1, 0, 0, 0, 0, 0, 0.05, 0.2, 0.35, 0.4][month0];
    consider(fog, 'fog');
  }
  return { factor: 1 + best.add, cause: best.add >= 0.3 ? best.cause : null };
}
