import { MODEL } from './aircraft';
import { inCheck } from './condition';
import { AIRPORT_INFO, CITIES, CITY, airportClass, citySize, dist, pairKey } from './cities';
import { FIXED_EVENTS } from './events';
import { isFreighter } from './freighters';
import { routePolitics } from './politics';
import { WEEKS, WEEK_HOURS, baseFare, charterCost, legHours, planeAge } from './simulate';
import { monthOf, yearOfM } from './time';
import type { AirlineState, CharterOffer, Plane, Rng } from './types';

/**
 * 전세기 계약 (Pocket Planes의 일감, Airline Tycoon의 계약처럼): 한 달짜리 연속 전세 의뢰가 게시판에 올라오고,
 * 먼저 맡은 회사가 그달 쉬는 비행기로 손님 수천 명을 여러 번에 나눠 데려갔다가 데려온다 (왕복).
 * 손님 ÷ 좌석만큼 왕복해야 하니, 너무 큰 비행기는 빈 좌석에 연료를 태우고 너무 작은 비행기는 여러 번 오가야 한다.
 */

interface Theme {
  title: string;
  icon: string;
  pax: [number, number];
  /** 운임 배수 */
  pay: number;
  maxD?: number;
  minD?: number;
  /** 관광지로 가는 의뢰 */
  resort?: boolean;
}

const THEMES: readonly Theme[] = [
  { title: '수학여행 단체 (학교 여러 곳)', icon: '🎒', pax: [1200, 2600], pay: 1.25, maxD: 3500 },
  { title: '기업 단체 연수', icon: '💼', pax: [800, 1800], pay: 1.5 },
  { title: '오케스트라·합창단 순회 공연', icon: '🎻', pax: [600, 1200], pay: 1.6, minD: 1500 },
  { title: '축구 대표팀 원정 응원단', icon: '⚽', pax: [1500, 3800], pay: 1.4 },
  { title: '여행사 휴가철 연속 전세', icon: '🏖️', pax: [2000, 5000], pay: 1.2, resort: true },
  { title: '의료 봉사단', icon: '🩺', pax: [500, 1100], pay: 1.45 },
  { title: '교민 귀국 연속 전세기', icon: '🏠', pax: [1500, 3200], pay: 1.35, minD: 2500 },
  { title: '콘서트 투어 관객단', icon: '🎤', pax: [900, 2000], pay: 1.6 },
  { title: '국제 학회 참가단', icon: '🎓', pax: [700, 1600], pay: 1.5, minD: 1200 },
];

/** 게시판에 한꺼번에 올라와 있는 의뢰 수 */
export const MAX_OFFERS = 6;
/** 의뢰가 올라와 있는 달 수 */
export const OFFER_MONTHS = 3;
/** 한 달에 한 비행기가 쓸 수 있는 비행시간 */
export const MONTH_HOURS = WEEK_HOURS * WEEKS;

const pick = <T>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length)];

/** 지금 맡을 수 있는 의뢰 (아직 아무도 안 맡았고 기한 안) */
export function openCharters(state: Pick<AirlineState, 'charters' | 't'>): CharterOffer[] {
  return (state.charters ?? []).filter((o) => o.by === undefined && o.expires >= state.t);
}

/** 이번 달 이 회사가 맡아 나는 의뢰 */
export function myCharters(state: Pick<AirlineState, 'charters' | 't'>, ci: number): CharterOffer[] {
  return (state.charters ?? []).filter((o) => o.by === ci && o.t === state.t);
}

/** 이번 달 전세기로 나가는 비행기 */
export function charterPlaneIds(state: Pick<AirlineState, 'charters' | 't'>, ci: number): Set<number> {
  return new Set(myCharters(state, ci).map((o) => o.plane!));
}

/** 이 비행기로 이 의뢰를 하려면 몇 번 왕복해야 하는지 */
export function tripsFor(o: CharterOffer, p: Plane): number {
  return Math.ceil(o.pax / MODEL[p.model].seats);
}

/** 이 비행기로 이 의뢰를 했을 때 이익 어림 (보수 − 연료·승무원·공항) */
export function charterProfit(state: AirlineState, ci: number, o: CharterOffer, p: Plane): number {
  return o.pay - charterCost(state, ci, MODEL[p.model], planeAge(state, p), o.a, o.b, tripsFor(o, p), o.pax).total;
}

/** 이 비행기로 이 의뢰를 맡을 수 없는 까닭 */
export function charterBlocker(state: AirlineState, ci: number, offerId: number, planeId: number): string | null {
  const c = state.companies[ci];
  const o = (state.charters ?? []).find((x) => x.id === offerId);
  if (!o) return '없는 의뢰예요';
  if (o.by !== undefined) return o.by === ci ? '이미 맡았어요' : `${state.companies[o.by]?.name ?? '다른 회사'}이(가) 맡았어요`;
  if (o.expires < state.t) return '기한이 지났어요';
  if (!c.branches.includes(o.a) && !c.branches.includes(o.b)) return `${CITY[o.a].name}이나 ${CITY[o.b].name}에 지점이 있어야 해요`;
  if (routePolitics(c.hub, o.a, o.b, yearOfM(state.t)) && state.options.history !== false) return '나라 사이 하늘길이 막혀 있어요';
  const p = c.planes.find((x) => x.id === planeId);
  if (!p) return '없는 비행기예요';
  if (p.legs.length > 0) return '쉬는 비행기만 보낼 수 있어요';
  if (inCheck(p, state.t)) return '이번 달 C점검 중이에요';
  if (charterPlaneIds(state, ci).has(p.id)) return '이번 달 다른 전세기로 나가요';
  const m = MODEL[p.model];
  if (isFreighter(m) || m.seats <= 0) return '화물기는 손님을 못 태워요';
  const d = dist(o.a, o.b);
  if (m.range < d) return `항속 거리가 모자라요 (${m.range.toLocaleString('ko-KR')}km)`;
  const year = yearOfM(state.t);
  for (const city of [o.a, o.b]) if (airportClass(CITY[city], year) < m.runway) return `${CITY[city].name} 공항(${AIRPORT_INFO[airportClass(CITY[city], year)].name})에는 못 내려요`;
  const hours = tripsFor(o, p) * 2 * legHours(m, d);
  if (hours > MONTH_HOURS) return `한 달에 다 못 날라요 (${tripsFor(o, p)}번 왕복 필요)`;
  return null;
}

/** 새 의뢰 하나 (못 만들면 null) */
function makeOffer(state: AirlineState, id: number, rng: Rng): CharterOffer | null {
  const t = state.t;
  const year = yearOfM(t);
  const usable = CITIES.filter((c) => airportClass(c, year) >= 2);
  // 앞으로 석 달 안에 올림픽·엑스포가 열리면 그 도시로 가는 의뢰가 잘 나온다
  const soon = FIXED_EVENTS.filter((e) => {
    for (let k = 1; k <= 3; k++) if (e.year === yearOfM(t + k) && e.months[0] === monthOf(t + k)) return true;
    return false;
  });
  let theme: Theme;
  let b: string;
  if (soon.length > 0 && rng() < 0.6) {
    const e = pick(soon, rng);
    theme = e.kind === 'expo' ? { title: `${e.title} 관람단`, icon: '🎡', pax: [2500, 6000], pay: 1.5 } : { title: `${e.title} 선수단·응원단`, icon: e.kind === 'winter' ? '⛷️' : '🏅', pax: [2000, 5000], pay: 1.7 };
    b = e.city;
  } else {
    theme = pick(THEMES, rng);
    const dests = theme.resort ? usable.filter((c) => c.fun >= 7) : usable;
    // 큰 도시일수록 자주
    const weights = dests.map((c) => citySize(c, year) ** 1.2 + (theme.resort ? c.fun : 0));
    let r = rng() * weights.reduce((x, y) => x + y, 0);
    b = dests[dests.length - 1].id;
    for (let i = 0; i < dests.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        b = dests[i].id;
        break;
      }
    }
  }
  // 출발지: 거리 조건에 맞는 큰 도시
  const origins = usable.filter((c) => {
    if (c.id === b) return false;
    const d = dist(c.id, b);
    return d >= Math.max(500, theme.minD ?? 0) && d <= (theme.maxD ?? 9500);
  });
  if (origins.length === 0) return null;
  const ow = origins.map((c) => citySize(c, year) ** 1.5);
  let r = rng() * ow.reduce((x, y) => x + y, 0);
  let a = origins[origins.length - 1].id;
  for (let i = 0; i < origins.length; i++) {
    r -= ow[i];
    if (r <= 0) {
      a = origins[i].id;
      break;
    }
  }
  const pax = Math.round((theme.pax[0] + rng() * (theme.pax[1] - theme.pax[0])) / 50) * 50;
  // 보수: 왕복 운임 × 배수 (억)
  const pay = Math.round(((pax * baseFare(dist(a, b), Math.floor(t / 3)) * 2 * theme.pay) / 10000) * 10) / 10;
  return { id, a, b, pax, pay: Math.max(1, pay), title: theme.title, icon: theme.icon, listed: t, expires: t + OFFER_MONTHS - 1 };
}

/** 다음 달 게시판: 끝난·지난 의뢰는 내리고 새 의뢰를 몇 개 올린다 (t는 이미 새 달) */
export function refreshCharters(state: AirlineState, rng: Rng): AirlineState {
  const t = state.t;
  let list = (state.charters ?? []).filter((o) => (o.by === undefined ? o.expires >= t : o.t !== undefined && o.t >= t));
  let nextId = state.nextId;
  const want = rng() < 0.65 ? 1 + (rng() < 0.3 ? 1 : 0) : 0;
  const open = list.filter((o) => o.by === undefined).length;
  for (let k = 0; k < Math.min(want, MAX_OFFERS - open); k++) {
    const o = makeOffer({ ...state, charters: list }, nextId, rng);
    if (!o || list.some((x) => x.by === undefined && pairKey(x.a, x.b) === pairKey(o.a, o.b))) continue;
    list = [...list, o];
    nextId += 1;
  }
  return { ...state, charters: list, nextId };
}
