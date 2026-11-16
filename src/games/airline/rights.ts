import { blockText, polity, relationBlock } from './politics';
import { legFreq, routeOf } from './simulate';
import { mLabel, yearOf, yearOfM } from './time';
import type { AirlineState, Company, NewsItem, Plane, Route } from './types';
import type { RightApp, RightsBook, RightsMode, TrafficRight } from './rightsTypes';

/**
 * 운수권과 항공 협정.
 *
 * - 나라는 politics.ts의 polity()를 그대로 쓴다 (홍콩·모스크바·사이공은 해마다 속한 나라가 바뀐다).
 * - 정치(politics.ts)는 '아예 못 나는' 하늘길, 운수권은 '얼마나 날 수 있는지'예요. 막힌 하늘길은 운수권으로 열 수 없어요.
 * - 나라 안 노선은 자유. 두 나라를 잇는 노선은 두 나라 사이 협정이 정한 주간 왕복 횟수 안에서만 날아요.
 *   한 회사가 그 두 나라 사이를 나는 모든 노선의 주간 왕복을 더해서 센다 (서울–도쿄와 부산–오사카는 같은 '한국–일본').
 * - 협정은 시대마다 넓어진다: 옛 항공 협정(1977년까지) → 넓힌 항공 협정(1978년부터) → 하늘 개방 협정(나라마다 1995~2020년 무렵, 제한 없음).
 *   유럽 나라끼리는 1997년부터 하늘 개방. 해와 나라는 게임을 위한 어림이에요 (실제 협정 이름·날짜가 아니에요).
 * - 본국(본사 나라)을 잇는 노선이 외국과 외국을 잇는 노선보다 횟수가 넉넉하다.
 * - 더 날고 싶으면 신청한다 (돈, 몇 달 기다림, 평판·본국에 따라 받아들여질 확률). 더 받은 횟수를 한 해 동안 쓰지 않으면 돌려준다.
 * - 간단히: 기본 횟수가 넉넉하고 신청이 거의 늘 되며 다음 달에 정해진다.
 *   실제처럼: 외국과 외국 사이는 신청해야만 날고, 옛 협정 동안 두 나라 사이를 나는 우리 게임 항공사 수도 정해져 있다.
 * - 회사마다 제 운수권: 동맹(코드셰어) 회사의 비행은 우리 횟수에 들지 않는다 (손님만 이어 태운다).
 * - 전세기 계약(charters.ts)은 한 번짜리 비정기 운항이라 운수권을 쓰지 않는다 (노선에 넣은 비행기만 센다).
 * - 인수(rules.ts의 합치기)하면 인수된 회사의 운수권과 신청도 넘겨받는다 (rightsRules.ts).
 */

export type Tier = 0 | 1 | 2;

export const RIGHTS_TIERS: readonly { name: string; icon: string; text: string }[] = [
  { name: '옛 항공 협정', icon: '📜', text: '나라끼리 정한 적은 횟수만 날 수 있어요' },
  { name: '넓힌 항공 협정', icon: '📄', text: '협정을 넓혀 전보다 많이 날 수 있어요' },
  { name: '하늘 개방 협정', icon: '🕊️', text: '횟수 제한 없이 자유롭게 날아요' },
];

export const RIGHTS_MODE_INFO: Record<RightsMode, { name: string; text: string }> = {
  off: { name: '끄기', text: '운수권 없이 어느 나라든 마음껏 날아요' },
  simple: { name: '간단히', text: '외국과 외국 사이 노선(옛날에는 모든 국제선)만 주간 횟수 안에서 날아요. 더 필요하면 신청해요 (거의 늘 돼요)' },
  real: { name: '실제처럼', text: '외국과 외국 사이 노선은 신청해야만 날고, 옛 협정 동안은 두 나라 사이를 나는 항공사 수도 정해져 있어요' },
};

/** 넓힌 항공 협정이 시작되는 해 */
export const WIDEN_YEAR = 1978;
/** 유럽 나라끼리 하늘 개방 */
export const EUROPE_OPEN = 1997;
const EUROPE = ['영국', '프랑스', '독일', '네덜란드', '스위스', '이탈리아', '스페인', '그리스'];

/** 나라마다 하늘 개방 협정에 들어가는 해 (게임용 어림). 두 나라 가운데 늦은 해부터 두 나라 사이가 열린다 */
const OPEN_YEAR: Record<string, number> = {
  미국: 1995,
  네덜란드: 1995,
  싱가포르: 1995,
  뉴질랜드: 1995,
  아랍에미리트: 1996,
  스위스: 1997,
  카타르: 1998,
  한국: 1998,
  대만: 1998,
  말레이시아: 1998,
  영국: 2004,
  프랑스: 2004,
  독일: 2004,
  이탈리아: 2004,
  스페인: 2004,
  그리스: 2004,
  오스트레일리아: 2004,
  캐나다: 2006,
  태국: 2006,
  모로코: 2006,
  홍콩: 2008,
  일본: 2010,
  튀르키예: 2010,
  인도네시아: 2010,
  필리핀: 2010,
  몰디브: 2010,
  멕시코: 2012,
  브라질: 2012,
  인도: 2012,
  이집트: 2012,
  케냐: 2012,
  '남아프리카 공화국': 2012,
  아르헨티나: 2014,
  스리랑카: 2014,
  나이지리아: 2014,
  네팔: 2016,
  베트남: 2016,
  중국: 2020,
};
/** 목록에 없는 나라(옛 나라 이름 등)는 이 해에 */
const OPEN_DEFAULT = 2015;

/** 두 나라 사이가 하늘 개방 협정이 되는 해 */
export function openYear(p: string, q: string): number {
  const y = Math.max(OPEN_YEAR[p] ?? OPEN_DEFAULT, OPEN_YEAR[q] ?? OPEN_DEFAULT);
  if (EUROPE.includes(p) && EUROPE.includes(q)) return Math.min(y, EUROPE_OPEN);
  // 러시아는 이 게임이 끝날 때까지 열지 않는다 (소련 때는 옛 협정)
  if (p === '러시아' || q === '러시아' || p === '소련' || q === '소련') return 9999;
  return y;
}

export function tierOf(p: string, q: string, year: number): Tier {
  if (year >= openYear(p, q)) return 2;
  return year >= WIDEN_YEAR ? 1 : 0;
}

/**
 * 주간 왕복 기본 횟수 [옛 협정, 넓힌 협정] — 하늘 개방이면 제한 없음.
 * 간단히: 넓힌 협정부터 본국을 오가는 노선은 자유 (외국과 외국 사이만 센다) — 가족 게임에서 가볍게.
 */
export const RIGHTS_BASE: Record<Exclude<RightsMode, 'off'>, { home: readonly [number, number]; far: readonly [number, number] }> = {
  simple: { home: [21, Infinity], far: [7, 21] },
  real: { home: [7, 21], far: [0, 0] },
};
/** 실제처럼: 두 나라 사이를 날 수 있는 우리 게임 항공사 수 [옛 협정, 넓힌 협정] */
export const CARRIER_LIMIT: readonly [number, number] = [2, 3];
/** 한 번 신청할 때 더 받는 주간 왕복 */
export const RIGHT_STEP: Record<Exclude<RightsMode, 'off'>, number> = { simple: 14, real: 7 };
/** 신청하고 정해질 때까지 달 수 */
export const RIGHT_WAIT: Record<Exclude<RightsMode, 'off'>, number> = { simple: 1, real: 3 };
/** 신청 수수료 (억) */
export const RIGHT_FEE: Record<Exclude<RightsMode, 'off'>, number> = { simple: 10, real: 20 };
/** 더 받은 횟수를 이만큼 달 동안 쓰지 않으면 돌려준다 */
export const RIGHT_LAPSE = 12;
/** 한 번에 기다릴 수 있는 신청 수 */
export const MAX_APPS = 3;

/** 이 판의 운수권 규칙 (도전 과제는 정해 둔 노선을 그대로 날도록 끈다, 예전 저장도 끈다) */
export function rightsMode(state: Pick<AirlineState, 'options'>): RightsMode {
  if (state.options.mode === 'challenge') return 'off';
  return state.options.rights ?? 'off';
}

// ------------------------------------------------------------------ 나라와 사용량

const polityMemo = new Map<string, string>();

/** 그 해 도시가 속한 나라 (politics.ts의 polity, 기억해 두고 쓴다) */
export function polityAt(city: string, year: number): string {
  const k = `${city}:${year}`;
  let v = polityMemo.get(k);
  if (v === undefined) {
    v = polity(city, year);
    polityMemo.set(k, v);
  }
  return v;
}

/** 두 나라 열쇠 ('나라|나라', 가나다순). 같은 나라면 '나라|나라' */
export function countryKey(p: string, q: string): string {
  return p <= q ? `${p}|${q}` : `${q}|${p}`;
}

/** 두 도시가 속한 두 나라 열쇠 */
export function pairKeyAt(a: string, b: string, year: number): string {
  return countryKey(polityAt(a, year), polityAt(b, year));
}

export function splitKey(key: string): [string, string] {
  const i = key.indexOf('|');
  return [key.slice(0, i), key.slice(i + 1)];
}

export function isDomesticKey(key: string): boolean {
  const [p, q] = splitKey(key);
  return p === q;
}

const usageMemo = new WeakMap<readonly Plane[], { routes: readonly Route[]; year: number; n: number; map: Map<string, number> }>();

/** 회사가 두 나라마다 지금 띄우는 주간 왕복 합 (나라 안 노선도 같은 나라 열쇠로 들어 있다) */
export function pairUsage(c: Company, year: number): Map<string, number> {
  const hit = usageMemo.get(c.planes);
  if (hit && hit.routes === c.routes && hit.year === year && hit.n === c.planes.length) return hit.map;
  const map = new Map<string, number>();
  for (const p of c.planes) {
    for (const l of p.legs) {
      if (l.freq <= 0) continue;
      const r = routeOf(c, l.route);
      if (!r) continue;
      const k = pairKeyAt(r.a, r.b, year);
      map.set(k, (map.get(k) ?? 0) + l.freq);
    }
  }
  usageMemo.set(c.planes, { routes: c.routes, year, n: c.planes.length, map });
  return map;
}

// ------------------------------------------------------------------ 장부

export function emptyRightsBook(n: number): RightsBook {
  return { held: Array.from({ length: n }, () => []), apps: Array.from({ length: n }, () => []) };
}

export const heldRights = (state: Pick<AirlineState, 'rights'>, ci: number): readonly TrafficRight[] => state.rights?.held[ci] ?? [];
export const appsOf = (state: Pick<AirlineState, 'rights'>, ci: number): readonly RightApp[] => state.rights?.apps[ci] ?? [];

function extraOf(state: Pick<AirlineState, 'rights'>, ci: number, key: string): number {
  let v = 0;
  for (const r of heldRights(state, ci)) if (r.key === key) v += r.add;
  return v;
}

/** 본사 나라 */
export function homeOf(state: Pick<AirlineState, 'q' | 'companies'>, ci: number): string {
  return polityAt(state.companies[ci].hub, yearOf(state.q));
}

/** 실제처럼: 두 나라 사이를 이미 나는(또는 운수권을 받은) 다른 게임 항공사 수 */
function carriersOn(state: Pick<AirlineState, 'q' | 'companies' | 'rights'>, key: string, except: number): number {
  const year = yearOf(state.q);
  let n = 0;
  state.companies.forEach((c, k) => {
    if (k === except || c.out) return;
    if ((pairUsage(c, year).get(key) ?? 0) > 0 || extraOf(state, k, key) > 0) n++;
  });
  return n;
}

export interface RightsInfo {
  key: string;
  /** '한국–일본' (본국을 앞에) */
  label: string;
  domestic: boolean;
  tier: Tier;
  /** 본국을 잇는 두 나라인지 */
  home: boolean;
  /** 기본 횟수 (제한 없으면 Infinity) */
  base: number;
  /** 더 받은 횟수 */
  extra: number;
  /** 날 수 있는 주간 왕복 (제한 없으면 Infinity) */
  allow: number;
  /** 지금 띄우는 주간 왕복 */
  used: number;
  /** 남은 주간 왕복 (제한 없으면 Infinity) */
  left: number;
  /** 실제처럼: 다른 항공사 자리가 다 차서 기본 횟수도 받지 못한다 */
  full: boolean;
  /** 기다리는 신청 */
  pending: RightApp | null;
  /** 제한이 없는 까닭: 규칙 끔·나라 안·하늘 개방 협정·간단히(본국 노선 자유). 제한이 있으면 null */
  free: 'off' | 'domestic' | 'open' | 'home' | null;
}

/** 두 나라 사이 운수권 상태 */
export function rightsInfo(state: Pick<AirlineState, 'options' | 'q' | 'companies' | 'rights'>, ci: number, key: string): RightsInfo {
  const mode = rightsMode(state);
  const [p, q] = splitKey(key);
  const year = yearOf(state.q);
  const home = homeOf(state, ci);
  const isHome = p === home || q === home;
  const other = p === home ? q : p;
  const label = isHome ? (p === q ? p : `${home}–${other}`) : `${p}–${q}`;
  const used = pairUsage(state.companies[ci], year).get(key) ?? 0;
  const pending = appsOf(state, ci).find((x) => x.key === key) ?? null;
  const tier = p === q ? 2 : tierOf(p, q, year);
  const free = mode === 'off' ? 'off' : p === q ? 'domestic' : tier === 2 ? 'open' : null;
  if (free || mode === 'off' || tier === 2) {
    return { key, label, domestic: p === q, tier, home: isHome, base: Infinity, extra: 0, allow: Infinity, used, left: Infinity, full: false, pending, free: free ?? 'open' };
  }
  let base = RIGHTS_BASE[mode][isHome ? 'home' : 'far'][tier];
  if (!Number.isFinite(base)) return { key, label, domestic: false, tier, home: isHome, base, extra: 0, allow: Infinity, used, left: Infinity, full: false, pending, free: 'home' };
  const extra = extraOf(state, ci, key);
  let full = false;
  if (mode === 'real' && used <= 0 && extra <= 0 && carriersOn(state, key, ci) >= CARRIER_LIMIT[tier]) {
    full = true;
    base = 0;
  }
  const allow = base + extra;
  return { key, label, domestic: false, tier, home: isHome, base, extra, allow, used, left: allow - used, full, pending, free: null };
}

export function rightsInfoFor(state: Pick<AirlineState, 'options' | 'q' | 'companies' | 'rights'>, ci: number, a: string, b: string): RightsInfo {
  return rightsInfo(state, ci, pairKeyAt(a, b, yearOf(state.q)));
}

// ------------------------------------------------------------------ 할 수 있는지

/** 이 비행기를 이 노선에 freq번 띄우면 운수권이 모자라는 까닭 (줄이는 것은 늘 된다) */
export function rightsAssignBlocker(state: AirlineState, ci: number, plane: Plane, route: Route, freq: number): string | null {
  if (rightsMode(state) === 'off') return null;
  const cur = legFreq(plane, route.id);
  if (freq <= cur) return null;
  const info = rightsInfoFor(state, ci, route.a, route.b);
  if (!Number.isFinite(info.allow)) return null;
  const room = info.allow - (info.used - cur);
  if (freq <= room) return null;
  return `운수권이 모자라요: ${info.label} 주 ${info.allow}회 가운데 ${Math.max(0, info.left)}회 남았어요`;
}

/** 이 비행기가 이 노선을 운수권 안에서 띄울 수 있는 가장 큰 주간 왕복 (제한 없으면 Infinity) */
export function rightsRoom(state: AirlineState, ci: number, plane: Plane, route: Route): number {
  if (rightsMode(state) === 'off') return Infinity;
  const info = rightsInfoFor(state, ci, route.a, route.b);
  if (!Number.isFinite(info.allow)) return Infinity;
  const cur = legFreq(plane, route.id);
  return Math.max(cur, info.allow - (info.used - cur));
}

/** 두 도시 사이 노선을 새로 열 때 운수권 때문에 못 여는 까닭 */
export function rightsRouteBlocker(state: AirlineState, ci: number, a: string, b: string): string | null {
  if (rightsMode(state) === 'off') return null;
  const info = rightsInfoFor(state, ci, a, b);
  if (!Number.isFinite(info.allow) || info.left >= 1) return null;
  if (info.full) return `${info.label} 사이는 우리 게임 항공사 ${CARRIER_LIMIT[info.tier as 0 | 1]}곳까지만 날 수 있어요 (자리가 찼어요)`;
  if (info.allow <= 0) return `${info.label} 노선은 운수권을 받아야 열 수 있어요 (신청해요)`;
  return `${info.label} 운수권 주 ${info.allow}회를 다 쓰고 있어요 (다른 노선을 줄이거나 더 신청해요)`;
}

/** 운수권을 더 받을 확률 */
export function approvalChance(state: Pick<AirlineState, 'options' | 'q' | 'companies' | 'rights'>, ci: number, key: string): number {
  const mode = rightsMode(state);
  const info = rightsInfo(state, ci, key);
  if (mode === 'simple') return info.home ? 0.9 : 0.75;
  const rep = state.companies[ci].reputation;
  let p = 0.35 + rep / 200 + (info.home ? 0.15 : -0.15) - (info.tier === 0 ? 0.1 : 0);
  // 다른 회사가 많이 날수록 조금 어렵다
  p -= 0.05 * carriersOn(state, key, ci);
  return clamp(p, 0.1, 0.95);
}

export function rightsFee(state: Pick<AirlineState, 'options'>): number {
  const mode = rightsMode(state);
  return mode === 'off' ? 0 : RIGHT_FEE[mode];
}

/** 나라 관계가 막혔으면 그 까닭 (실제 역사를 켰을 때) */
function politicsBlock(state: Pick<AirlineState, 'options' | 'q' | 'companies'>, ci: number, key: string): string | null {
  if (state.options.history === false) return null;
  const year = yearOf(state.q);
  const [p, q] = splitKey(key);
  const home = homeOf(state, ci);
  const b = relationBlock(p, q, year) ?? relationBlock(home, p, year) ?? relationBlock(home, q, year);
  return b ? blockText(b) : null;
}

/** 운수권을 더 신청할 수 없는 까닭 */
export function applyRightsBlocker(state: AirlineState, ci: number, key: string): string | null {
  const mode = rightsMode(state);
  if (mode === 'off') return '운수권 규칙을 끈 판이에요';
  if (typeof key !== 'string' || !key.includes('|')) return '두 나라를 골라요';
  const [p, q] = splitKey(key);
  if (!p || !q) return '두 나라를 골라요';
  if (p === q) return '나라 안 노선은 운수권이 필요 없어요';
  const pol = politicsBlock(state, ci, key);
  if (pol) return pol;
  const info = rightsInfo(state, ci, key);
  if (!Number.isFinite(info.allow)) return info.free === 'home' ? '본국을 오가는 노선은 제한 없이 날아요' : '하늘 개방 협정이라 제한 없이 날아요';
  if (info.pending) return `신청 결과를 기다리는 중이에요 (${mLabel(info.pending.due)} 결산)`;
  if (info.full) return `${info.label} 사이는 우리 게임 항공사 ${CARRIER_LIMIT[info.tier as 0 | 1]}곳까지만 날 수 있어요 (자리가 찼어요)`;
  if (appsOf(state, ci).length >= MAX_APPS) return `신청은 한 번에 ${MAX_APPS}곳까지 기다릴 수 있어요`;
  const fee = rightsFee(state);
  if (state.companies[ci].cash < fee) return `돈이 모자라요 (${money(fee)} 필요)`;
  return null;
}

/** 운수권을 신청한다 (규칙 확인은 applyRightsBlocker로 미리) */
export function addRightsApp(state: AirlineState, ci: number, key: string): AirlineState {
  const mode = rightsMode(state) as Exclude<RightsMode, 'off'>;
  const fee = rightsFee(state);
  const book = state.rights ?? emptyRightsBook(state.companies.length);
  const apps = book.apps.map((list, k) => (k === ci ? [...list, { key, add: RIGHT_STEP[mode], due: state.t + RIGHT_WAIT[mode], fee }] : list));
  const companies = state.companies.slice();
  companies[ci] = { ...companies[ci], cash: companies[ci].cash - fee };
  return { ...state, companies, rights: { held: book.held, apps } };
}

// ------------------------------------------------------------------ 달마다

/** 사람 회사에만 보이는 소식 */
const forHuman = (c: Company, ci: number) => (c.kind === 'human' ? [ci] : undefined);

/**
 * 달 결산 때: 신청을 정하고, 더 받은 횟수를 쓴 달을 적고, 한 해 넘게 쓰지 않은 횟수는 돌려준다.
 * 운항을 멈춘 회사의 운수권은 없어진다.
 */
export function rightsMonth(state: AirlineState, t: number): AirlineState {
  if (rightsMode(state) === 'off' || !state.rights) return state;
  let s = state;
  const year = yearOfM(t);
  const salt = gameSalt(s);
  const held = s.rights!.held.map((list) => [...list]);
  const apps = s.rights!.apps.map((list) => [...list]);
  for (let ci = 0; ci < s.companies.length; ci++) {
    const c = s.companies[ci];
    if (!held[ci]) held[ci] = [];
    if (!apps[ci]) apps[ci] = [];
    if (c.out) {
      held[ci] = [];
      apps[ci] = [];
      continue;
    }
    // 1) 신청 정하기
    const due = apps[ci].filter((a) => a.due <= t);
    if (due.length > 0) {
      apps[ci] = apps[ci].filter((a) => a.due > t);
      const yes: string[] = [];
      const no: string[] = [];
      for (const a of due) {
        const view = { ...s, rights: { held, apps } };
        const info = rightsInfo(view, ci, a.key);
        const chance = Number.isFinite(info.allow) ? approvalChance(view, ci, a.key) : 1;
        const ok = !info.full && hash01(t, ci, strHash(a.key), salt) < chance;
        if (ok) {
          if (Number.isFinite(info.allow)) held[ci] = [...held[ci], { key: a.key, add: a.add, since: t, used: t }];
          yes.push(`${info.label} 주 ${a.add}회`);
        } else no.push(info.label);
      }
      if (c.kind === 'human') {
        s = addNews(s, {
          icon: '🛂',
          title: `${c.name}: 운수권 심사 결과`,
          text: `${yes.length ? `받았어요: ${yes.join(', ')}. ` : ''}${no.length ? `이번에는 안 됐어요: ${no.join(', ')} — 평판을 높여 다시 신청해 보세요.` : ''}`,
          tone: yes.length ? 'good' : 'bad',
          for: [ci],
          company: ci,
        });
      }
    }
    // 2) 더 받은 횟수를 쓴 달 적기, 오래 안 쓴 횟수 돌려주기
    if (held[ci].length > 0) {
      const usage = pairUsage(c, year);
      const view = { ...s, rights: { held, apps } };
      const lapsed: string[] = [];
      const keep: TrafficRight[] = [];
      const seen = new Map<string, RightsInfo>();
      for (const r of held[ci]) {
        let info = seen.get(r.key);
        if (!info) {
          info = rightsInfo(view, ci, r.key);
          seen.set(r.key, info);
        }
        // 하늘 개방이 되면 더 받은 횟수는 필요 없다
        if (!Number.isFinite(info.base)) continue;
        const use = usage.get(r.key) ?? 0;
        if (use > info.base) keep.push(r.used === t ? r : { ...r, used: t });
        else if (t - r.used >= RIGHT_LAPSE) lapsed.push(info.label);
        else keep.push(r);
      }
      held[ci] = keep;
      if (lapsed.length > 0 && c.kind === 'human') {
        s = addNews(s, {
          icon: '📜',
          title: `${c.name}: 쓰지 않은 운수권을 돌려줬어요`,
          text: `${[...new Set(lapsed)].join(', ')} — 더 받은 횟수를 ${RIGHT_LAPSE}달 동안 쓰지 않아 돌려줬어요. 기본 횟수는 그대로예요.`,
          tone: 'info',
          for: forHuman(c, ci),
          company: ci,
        });
      }
    }
  }
  return { ...s, rights: { held, apps } };
}

/** 이 회사가 운수권 때문에 더 늘리지 못하는 두 나라 (남은 횟수가 적은 순) */
export function tightPairs(state: AirlineState, ci: number, margin = 2): RightsInfo[] {
  if (rightsMode(state) === 'off') return [];
  const year = yearOf(state.q);
  const out: RightsInfo[] = [];
  for (const key of pairUsage(state.companies[ci], year).keys()) {
    if (isDomesticKey(key)) continue;
    const info = rightsInfo(state, ci, key);
    if (Number.isFinite(info.allow) && info.left <= margin) out.push(info);
  }
  return out.sort((x, y) => x.left - y.left);
}

/** 이 회사가 나는(또는 운수권을 받은) 두 나라 목록 (화면용) */
export function myPairs(state: AirlineState, ci: number): RightsInfo[] {
  const year = yearOf(state.q);
  const keys = new Set<string>();
  for (const key of pairUsage(state.companies[ci], year).keys()) if (!isDomesticKey(key)) keys.add(key);
  for (const r of heldRights(state, ci)) keys.add(r.key);
  for (const a of appsOf(state, ci)) keys.add(a.key);
  // 노선은 있는데 아직 비행기를 넣지 않은 곳도
  for (const r of state.companies[ci].routes) {
    const k = pairKeyAt(r.a, r.b, year);
    if (!isDomesticKey(k)) keys.add(k);
  }
  return [...keys].map((k) => rightsInfo(state, ci, k)).sort((x, y) => Number(Number.isFinite(y.allow)) - Number(Number.isFinite(x.allow)) || x.left - y.left || x.label.localeCompare(y.label, 'ko'));
}

/** 재무 화면 운수권 카드에 처음부터 보이는 줄 수 (다 쓴 곳·신청 중인 곳은 이보다 많아도 모두 보인다) */
export const RIGHTS_SHOWN = 6;

/**
 * 운수권 카드 목록을 나눈다: 다 쓴 곳·신청 중인 곳은 늘 보이고, 나머지는 빠듯한 차례로 RIGHTS_SHOWN줄까지 채운다.
 * 넘치는 곳은 '더 보기'로 접어 둔다. 접을 곳이 두 곳 이하면 단추가 줄만큼 자리를 먹으니 모두 보인다.
 * 줄 차례는 그대로 둔다 (myPairs가 빠듯한 차례로 늘어놓는다).
 */
export function splitRightsList<T extends Pick<RightsInfo, 'left' | 'pending'>>(list: T[], shown = RIGHTS_SHOWN): { top: T[]; rest: T[] } {
  const must = (x: T) => x.left <= 0 || x.pending !== null;
  let room = Math.max(0, shown - list.filter(must).length);
  const top: T[] = [];
  const rest: T[] = [];
  for (const x of list) {
    if (must(x)) top.push(x);
    else if (room > 0) {
      top.push(x);
      room--;
    } else rest.push(x);
  }
  return rest.length <= 2 ? { top: list, rest: [] } : { top, rest };
}

/** 두 도시 사이에 운수권으로 더 띄울 수 있는 주간 왕복 (제한 없으면 Infinity). 컴퓨터가 노선 후보를 고를 때 */
export function rightsLeftFor(state: AirlineState, ci: number, a: string, b: string): number {
  if (rightsMode(state) === 'off') return Infinity;
  return rightsInfoFor(state, ci, a, b).left;
}

// ------------------------------------------------------------------ 작은 도구 (rules.ts를 부르지 않으려고 따로 둔다)

/** rules.ts의 fmtMoney와 같은 글: '1,250억', '2.3조' */
export function money(v: number): string {
  const r = Math.round(v);
  if (Math.abs(r) >= 10000) return `${(r / 10000).toFixed(Math.abs(r) >= 100000 ? 0 : 1).replace(/\.0$/, '')}조`;
  return `${r.toLocaleString('ko-KR')}억`;
}

function addNews(state: AirlineState, item: Omit<NewsItem, 'id' | 't'>): AirlineState {
  const news = [...state.news, { ...item, id: state.nextId, t: state.t }];
  return { ...state, news: news.length > 70 ? news.slice(-70) : news, nextId: state.nextId + 1 };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 글자를 수로 (같은 글이면 늘 같은 수) */
function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * 상태에서 만드는 0~1 사이 수: 같은 판·같은 달·같은 회사면 늘 같다.
 * 신청 심사에 주사위(rng)를 쓰지 않아 다른 무작위(사건·날씨·운항)의 순서를 바꾸지 않고, 규칙은 순수 함수로 남는다.
 */
function hash01(...xs: number[]): number {
  let h = 0x9e3779b9;
  for (const x of xs) {
    h = Math.imul(h ^ (x | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}

/** 판마다 다른 씨앗 (시작한 달과 회사 이름·본사로) */
function gameSalt(state: Pick<AirlineState, 'startT' | 'companies'>): number {
  return strHash(`${state.startT}|${state.companies.map((c) => `${c.name}@${c.hub}`).join(',')}`);
}
