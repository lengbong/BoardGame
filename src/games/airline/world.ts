import { CITY } from './cities';
import { REAL_AIRLINE, REAL_AIRLINES, type RealAirline } from './realAirlines';
import { usableColor } from './brand';
import { AIRLINE_FATES, PREDECESSOR, entryT, fateIn } from './airlineHistory';
import { mOf, monthOf, yearOfM } from './time';
import type { AirlineOptions, RegionId } from './types';

/**
 * 세계 항공사 모드: 사람은 한 명이고, 그 해에 날던 실제 항공사가 모두 컴퓨터 라이벌로 나온다.
 * 세월이 흐르면 실제 역사대로 새 항공사가 생기고, 이름이 바뀌고, 합쳐지고, 문을 닫는다.
 * 2027년부터는 예측해서 지어낸 미래 항공사와 미래의 합병이 이어진다 (모두 게임 속 이야기).
 */

/** 게임이 끝나는 가장 늦은 해 (이 해 12월 결산이 마지막) */
export const LAST_YEAR = 2100;

/** 예측해서 지어낸 미래 항공사 (실제 회사가 아니에요) */
export interface FutureAirline {
  id: string;
  name: string;
  founded: number;
  hub: string;
  region: RegionId;
  colors: [string, string];
  note: string;
}

const F = (id: string, name: string, founded: number, hub: string, colors: [string, string], note: string): FutureAirline => ({ id, name, founded, hub, region: CITY[hub].region, colors, note });

export const FUTURE_AIRLINES: readonly FutureAirline[] = [
  F('bharat', '바라트항공', 2029, 'delhi', ['#ff7a1a', '#138808'], '인도에서 비행기를 타는 사람이 크게 늘며 델리에 생긴 새 대형 항공사'),
  F('nusantara', '누산타라항공', 2032, 'jakarta', ['#c8102e', '#f2c14e'], '섬이 만 칠천 개인 인도네시아를 잇는 새 항공사'),
  F('gadeok', '부산퍼시픽항공', 2035, 'busan', ['#0e7c86', '#f26b38'], '부산 새 공항이 열리며 태평양 노선을 노리고 생긴 항공사'),
  F('afriunion', '아프리카유니언항공', 2036, 'lagos', ['#0b6e4f', '#f4c430'], '아프리카 하늘이 하나의 시장으로 열리며 라고스에 생긴 항공사'),
  F('mekong', '메콩항공', 2039, 'bangkok', ['#7b2d8e', '#f29f05'], '동남아 중산층을 겨냥한 장거리 저가 항공사'),
  F('silkroad', '실크로드항공', 2042, 'shanghai', ['#b5121b', '#d4af37'], '아시아와 유럽을 잇는 상하이의 새 항공사'),
  F('h2europe', 'H2유럽항공', 2046, 'amsterdam', ['#00a878', '#1b4965'], '수소 여객기만 띄우는 유럽의 깨끗한 항공사'),
  F('andes', '안데스커넥트', 2050, 'mexicocity', ['#00a3a1', '#e4572e'], '남북 아메리카를 촘촘히 잇는 새 항공사'),
  F('savanna', '사바나항공', 2055, 'nairobi', ['#d95d39', '#2d6a4f'], '빠르게 자라는 동아프리카의 새 대표 항공사'),
  F('aurora', '오로라초음속항공', 2060, 'losangeles', ['#5f0f40', '#ff9e00'], '초음속기만 띄우는 프리미엄 항공사'),
  F('ganges', '갠지스항공', 2066, 'mumbai', ['#0077b6', '#ffb703'], '세계에서 가장 큰 시장이 된 인도의 두 번째 새 대형 항공사'),
  F('sahara', '사하라스카이', 2072, 'casablanca', ['#c2703d', '#1d3557'], '아프리카와 유럽·아메리카를 잇는 대서양의 새 항공사'),
  F('pacificrim', '퍼시픽림항공', 2078, 'sydney', ['#006d77', '#e29578'], '극초음속기로 태평양을 반나절 생활권으로 묶는 항공사'),
  F('stratolink', '스트라토링크', 2086, 'singapore', ['#3a0ca3', '#4cc9f0'], '세기말에 생긴 수소·극초음속 전문 항공사'),
];

export const FUTURE_AIRLINE: Record<string, FutureAirline> = Object.fromEntries(FUTURE_AIRLINES.map((a) => [a.id, a]));

/**
 * 이름만 바뀐 회사: 앞 회사가 없어지는 달에 뒤 회사 이름으로 이어 난다.
 * 실제 역사(이름 바꾸기·합병·문 닫기)는 보통 판과 같은 표(airlineHistory.ts)를 쓴다.
 */
export const RENAMES: Record<string, string> = Object.fromEntries(AIRLINE_FATES.filter((f) => f.kind === 'rename' && f.into).map((f) => [f.id, f.into!]));

/** 예측해서 지어낸 미래의 합병 (게임 속 이야기, 그 해 1월) */
export const PREDICTED_MERGERS: readonly { id: string; year: number; into: string }[] = [
  { id: 'ita', year: 2034, into: 'lufthansa' },
  { id: 'kenya', year: 2058, into: 'ethiopian' },
];

export type Fate =
  | { kind: 'rename'; into: string; why?: string }
  | { kind: 'merge'; into: string; predicted?: boolean; why?: string }
  /** intoName: 판 밖(목록에 없는) 회사에 합쳐졌다 */
  | { kind: 'close'; intoName?: string; why?: string };

/** 이 실제 항공사가 이 달(t)에 맞는 운명: 실제 역사는 그 달에, 예측한 미래의 합병은 그 해 1월에 (없으면 그대로 난다) */
export function fateAt(airline: string, t: number): Fate | null {
  const f = fateIn(airline, t);
  if (f) {
    if (f.kind === 'rename' && f.into) return { kind: 'rename', into: f.into, why: f.why };
    if (f.kind === 'merge' && f.into) return { kind: 'merge', into: f.into, why: f.why };
    return { kind: 'close', ...(f.intoName ? { intoName: f.intoName } : {}), why: f.why };
  }
  if (monthOf(t) !== 1) return null;
  const p = PREDICTED_MERGERS.find((m) => m.id === airline && m.year === yearOfM(t));
  return p ? { kind: 'merge', into: p.into, predicted: true } : null;
}

/** 쉬던 회사가 날기 시작하는 달: 실제 항공사는 날기 시작한 달, 예측한 미래 항공사는 그 해 1월 */
export function joinT(c: { airline: string | null; joinYear?: number }): number {
  const year = c.joinYear ?? 0;
  return c.airline ? entryT(c.airline, year) : mOf(year, 1);
}

/** 앞 회사(문을 닫은 뒤 뒤를 이은 회사의 앞 회사)가 아직 날고 있으면 뒤 회사는 기다린다 */
export function waitsForPredecessor(airline: string | null, flying: readonly (string | null)[]): boolean {
  return !!airline && !!PREDECESSOR[airline] && flying.includes(PREDECESSOR[airline]);
}

/** 지도·배지에 쓸 색: 주된 색 → 곁들인 색 순서로 쓸 만한 첫 색 */
export function brandColor(colors: readonly [string, string]): string | null {
  return usableColor(colors[0]) ?? usableColor(colors[1]);
}

/** 세계 명단의 한 줄 */
export interface WorldEntry {
  /** 실제 항공사 id (예측한 미래 항공사는 null) */
  airline: string | null;
  /** 예측한 미래 항공사 id */
  future: string | null;
  name: string;
  hub: string;
  colors: [string, string];
  /** 날기 시작하는 해 (시작한 해보다 앞이면 처음부터 난다) */
  founded: number;
}

/** 이름이 바뀌어 생긴 회사 → 앞 회사 */
const RENAMED_FROM: Record<string, string> = Object.fromEntries(Object.entries(RENAMES).map(([from, to]) => [to, from]));

/** 앞 회사를 끝까지 거슬러 올라간다 */
function rootOf(id: string): string {
  let x = id;
  while (RENAMED_FROM[x]) x = RENAMED_FROM[x];
  return x;
}

/**
 * 이 판에 나올 라이벌 명단: 시작한 해에 날던 실제 항공사와, 끝나는 해까지 새로 생길 항공사.
 * 이름만 바뀐 회사는 앞 회사 자리를 이어받으니 따로 넣지 않는다. 사람이 고른 항공사(와 그 앞뒤 이름)는 뺀다.
 */
export function worldRoster(startYear: number, endYear: number, playerAirline: string | null): WorldEntry[] {
  const mine = playerAirline ? rootOf(playerAirline) : null;
  const out: WorldEntry[] = [];
  for (const a of REAL_AIRLINES) {
    if (a.defunct !== undefined && a.defunct <= startYear) continue;
    if (a.founded > endYear) continue;
    if (mine && rootOf(a.id) === mine) continue;
    // 앞 회사가 이 판에 나오면 그 자리를 이어받는다
    const from = RENAMED_FROM[a.id];
    if (from && (REAL_AIRLINE[from].defunct ?? Infinity) > startYear) continue;
    out.push({ airline: a.id, future: null, name: a.name, hub: a.hub, colors: a.colors, founded: a.founded });
  }
  for (const f of FUTURE_AIRLINES) {
    if (f.founded <= startYear || f.founded > endYear) continue;
    out.push({ airline: null, future: f.id, name: f.name, hub: f.hub, colors: f.colors, founded: f.founded });
  }
  return out;
}

/** 이 판이 끝나는 해 (명단을 어디까지 준비할지) */
export function worldEndYear(options: Pick<AirlineOptions, 'era' | 'mode' | 'years'>, goalYears: number): number {
  if (options.mode === 'years') return options.years === 0 ? LAST_YEAR : Math.min(LAST_YEAR, options.era + options.years);
  return Math.min(LAST_YEAR, options.era + goalYears);
}

/**
 * 세계 항공사 모드에서 컴퓨터 회사 하나가 가질 수 있는 노선 수.
 * 회사가 수십 곳이라, 몇 곳이 온 세계를 덮지 않고 저마다 본거지를 중심으로 알맞은 크기로 자라게 한다.
 */
export function worldRouteCap(kind: string, hubSize: number): number {
  const cap = Math.round(Math.max(20, Math.min(50, 10 + 4.5 * hubSize)));
  return kind === 'ai-easy' ? Math.round(cap * 0.6) : cap;
}

/** 구조 조정으로 한 번 살아난 뒤 이만큼(달)은 지나야 다시 살아날 수 있다 */
export const RESCUE_GAP = 180;

/** 실제 항공사 설명에 붙이는 한 줄 */
export function realNote(a: RealAirline): string {
  return a.note ?? `${a.founded}년부터 날아온 항공사`;
}
