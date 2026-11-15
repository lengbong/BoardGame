import { MODEL } from './aircraft';
import { AWARD_KINDS, trophyCount } from './awards';
import { CHALLENGES } from './challenges';
import { SCENARIOS } from './scenarios';
import { dist } from './cities';
import { isFreighter } from './freighters';
import { REAL_AIRLINE } from './realAirlines';
import { companyValue, regionsServed, routeFreq } from './simulate';
import { yearOfM } from './time';
import type { AirlineState, BodyType, Company } from './types';

/**
 * 업적: 여러 판에 걸쳐 이 브라우저(가족)에 쌓이는 배지.
 * 사람 회사만 이룰 수 있고, 한 번 이루면 처음 이룬 회사 이름이 남는다.
 * 모두 게임 상태(회사·결산·시상식·결과)만 보고 정하는 순수 함수 — 규칙 엔진은 건드리지 않는다.
 */

/** 1 동 · 2 은 · 3 금 */
export type AchTier = 1 | 2 | 3;
/** 배지 바탕색 묶음 */
export type AchGroup = 'start' | 'fleet' | 'network' | 'money' | 'awards' | 'wins';

/** 배지 가운데 그림 (BadgeArt.tsx) */
export type BadgeGlyph =
  | 'plane'
  | 'route'
  | 'wide'
  | 'coin'
  | 'people'
  | 'trophy'
  | 'building'
  | 'drum'
  | 'ticket'
  | 'link'
  | 'globe'
  | 'city'
  | 'fleet'
  | 'box'
  | 'streak'
  | 'oil'
  | 'arc'
  | 'crown'
  | 'gem'
  | 'pie'
  | 'star'
  | 'flag'
  | 'backpack'
  | 'crate'
  | 'summit'
  | 'tally'
  | 'bolt'
  | 'piggy'
  | 'fleet100'
  | 'city50'
  | 'sweep'
  | 'merge'
  | 'flame'
  | 'eras'
  | 'compass'
  | 'hourglass'
  | 'scroll'
  | 'scrolls';

/** 여러 판에 걸친 진행 (게임이 끝날 때마다 더한다) */
export interface FameProgress {
  /** 사람 회사가 이긴 시작 해 (정해진 해까지·목표 먼저) */
  eras: number[];
  /** 성공한 도전 과제 id */
  challenges: string[];
  /** 성공한 역사 시나리오 id (하나도 없으면 키가 없다: 예전 저장과 같은 모양) */
  scenarios?: string[];
  /** 사람 회사가 있는 게임을 끝까지 마친 수 */
  games: number;
}

export interface AchCtx {
  state: AirlineState;
  ci: number;
  c: Company;
  /** 게임이 끝났는지 */
  final: boolean;
  /** 이 회사가 이겼는지 (정해진 해까지·목표 먼저, 게임이 끝났을 때만) */
  won: boolean;
  progress: FameProgress;
}

export interface AchievementDef {
  id: string;
  name: string;
  /** 이루는 방법 */
  desc: string;
  tier: AchTier;
  group: AchGroup;
  art: BadgeGlyph;
  /** 이루기 전에는 '???'로 가린다 */
  hidden?: boolean;
  /** 여러 판에 걸친 진행 [지금, 목표] (진열장에 보여 준다) */
  steps?: (p: FameProgress) => [number, number];
  test: (x: AchCtx) => boolean;
}

/** 처음 이룬 기록 */
export interface UnlockRecord {
  /** 이룬 때 (Date.now()) */
  at: number;
  /** 처음 이룬 회사 이름 */
  by: string;
  seat: number;
  /** 실제 항공사 id (가상 항공사면 null) */
  airline: string | null;
  /** 게임 속 해 */
  year: number;
  /** 그 판의 열쇠 (결과 화면의 '새 업적') */
  g: string;
}

export interface AchStore {
  v: 1;
  items: Record<string, UnlockRecord>;
  progress: FameProgress;
  /** 이미 센 게임 끝 (같은 끝을 두 번 세지 않게, 최근 것만) */
  seen: string[];
}

export interface Unlock {
  id: string;
  ci: number;
  record: UnlockRecord;
}

export const START_ERAS: readonly number[] = [1963, 1983, 2003];
export const SEEN_KEEP = 40;

// ------------------------------------------------------------------ 상태에서 읽는 도우미

const WIDE: ReadonlySet<BodyType> = new Set<BodyType>(['wide', 'widetri', 'jumbo', 'double']);
const bodyOf = (model: string): BodyType | undefined => MODEL[model]?.body;

export function flyingRoutes(c: Company) {
  return c.routes.filter((r) => routeFreq(c, r.id) > 0);
}

export function freighterCount(c: Company): number {
  return c.planes.filter((p) => MODEL[p.model] && isFreighter(MODEL[p.model])).length;
}

/** 이 회사의 해마다 결산 */
function yearsOf(state: AirlineState, ci: number) {
  return state.years.flatMap((y) => (y.companies[ci] ? [{ year: y.year, r: y.companies[ci] }] : []));
}

/** 그 해 열두 달 평균 유가 (열두 달이 다 없으면 null) */
export function yearOil(state: Pick<AirlineState, 'months'>, year: number): number | null {
  const list = state.months.filter((m) => yearOfM(m.t) === year);
  if (list.length < 12) return null;
  return list.reduce((s, m) => s + m.oil, 0) / list.length;
}

export const OIL_SHOCK = 1.5;
export const LONG_HAUL_KM = 11000;

/** 한 해에 이 회사가 받은 상 수 가운데 가장 많은 해 */
function bestAwardYear(state: AirlineState, ci: number): number {
  let best = 0;
  for (const y of state.awards ?? []) best = Math.max(best, y.items.filter((a) => a.company === ci).length);
  return best;
}

export function trophies(state: Pick<AirlineState, 'awards'>, ci: number): number {
  return [...trophyCount(state.awards, ci).values()].reduce((s, n) => s + n, 0);
}

/** 이 회사가 맡아 다녀온 전세기가 있는지 */
function didCharter(state: AirlineState, ci: number): boolean {
  if ((state.report?.companies[ci]?.charters ?? 0) > 0) return true;
  return (state.charters ?? []).some((o) => o.by === ci && o.t !== undefined && o.t < state.t);
}

/** 이 회사가 이겼는지 (도전 과제·역사 시나리오는 따로 센다) */
export function isWinner(state: AirlineState, ci: number): boolean {
  return state.phase === 'gameover' && !!state.result && state.options.mode !== 'challenge' && state.options.mode !== 'scenario' && state.result.winners.includes(ci);
}

/** 이 회사가 도전 과제를 성공했는지 */
export function challengeDone(state: AirlineState, ci: number): string | null {
  if (state.phase !== 'gameover' || state.options.mode !== 'challenge' || !state.challenge || !state.result?.success) return null;
  return state.challenge.company === ci ? state.challenge.id : null;
}

/** 이 회사가 역사 시나리오를 성공했는지 (도전 과제와 따로 센다) */
export function scenarioDone(state: AirlineState, ci: number): string | null {
  if (state.phase !== 'gameover' || state.options.mode !== 'scenario' || !state.scenario || !state.result?.success) return null;
  return state.scenario.company === ci ? state.scenario.id : null;
}

/** 여러 판에 걸친 진행의 시나리오 목록 (모르는 id는 버리고 목록 차례로) */
const scenarioIds = (list: readonly unknown[]): string[] => SCENARIOS.map((d) => d.id).filter((id) => list.includes(id));
const withScenarios = (ids: string[]): { scenarios?: string[] } => (ids.length > 0 ? { scenarios: ids } : {});

const playedMonths = (state: AirlineState) => state.t - state.startT + 1;

// ------------------------------------------------------------------ 업적 목록

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // ---------------------------------------------------------------- 동 (처음 해 보는 일)
  { id: 'first-plane', name: '첫 비행기', desc: '비행기를 한 대 들여와요 (사기·리스·중고 모두 좋아요)', tier: 1, group: 'start', art: 'plane', test: ({ c }) => c.planes.length > 0 },
  { id: 'first-route', name: '첫 하늘길', desc: '노선을 열고 비행기를 띄워요', tier: 1, group: 'start', art: 'route', test: ({ c }) => flyingRoutes(c).length > 0 },
  { id: 'first-wide', name: '넓은 동체', desc: '통로가 두 줄인 넓은 동체 비행기를 들여와요', tier: 1, group: 'fleet', art: 'wide', test: ({ c }) => c.planes.some((p) => WIDE.has(bodyOf(p.model)!)) },
  { id: 'first-black', name: '첫 흑자 해', desc: '한 해를 흑자로 마쳐요', tier: 1, group: 'money', art: 'coin', test: ({ state, ci }) => yearsOf(state, ci).some((y) => y.r.profit > 0) },
  { id: 'pax-100k', name: '손님 10만 명', desc: '한 게임에서 손님을 모두 10만 명 태워요', tier: 1, group: 'network', art: 'people', test: ({ c }) => c.stats.pax >= 100000 },
  { id: 'first-trophy', name: '첫 트로피', desc: '연말 시상식에서 상을 하나 받아요', tier: 1, group: 'awards', art: 'trophy', test: ({ state, ci }) => trophies(state, ci) > 0 },
  { id: 'facility', name: '우리 공항 시설', desc: '라운지·정비 기지·전용 터미널 가운데 하나를 지어요', tier: 1, group: 'start', art: 'building', test: ({ c }) => (c.facilities?.length ?? 0) > 0 },
  { id: 'tank', name: '기름 창고', desc: '연료 탱크를 지어요', tier: 1, group: 'money', art: 'drum', test: ({ c }) => (c.fuel?.level ?? 0) > 0 },
  { id: 'charter', name: '첫 전세기', desc: '전세기 의뢰를 맡아 다녀와요', tier: 1, group: 'start', art: 'ticket', test: ({ state, ci }) => didCharter(state, ci) },
  { id: 'alliance', name: '하늘 친구', desc: '항공 동맹에 들어가요', tier: 1, group: 'network', art: 'link', test: ({ state, ci }) => (state.alliances ?? []).some((a) => a.members.includes(ci)) },

  // ---------------------------------------------------------------- 은 (꽤 애써야 하는 일)
  { id: 'regions-6', name: '여섯 지역 하늘길', desc: '세계 여섯 지역 모두에 비행기를 띄워요', tier: 2, group: 'network', art: 'globe', test: ({ c }) => regionsServed(c).size >= 6 },
  { id: 'cities-25', name: '지점 25곳', desc: '도시 25곳에 지점을 내요', tier: 2, group: 'network', art: 'city', test: ({ c }) => c.branches.length >= 25 },
  { id: 'fleet-50', name: '비행기 50대', desc: '비행기를 50대 갖춰요', tier: 2, group: 'fleet', art: 'fleet', test: ({ c }) => c.planes.length >= 50 },
  { id: 'freighters', name: '화물기 부대', desc: '화물기를 5대 갖춰요', tier: 2, group: 'fleet', art: 'box', test: ({ c }) => freighterCount(c) >= 5 },
  { id: 'streak-8', name: '2년 내리 흑자', desc: '8분기 잇달아 흑자를 내요', tier: 2, group: 'money', art: 'streak', test: ({ c }) => c.stats.profitStreak >= 8 },
  {
    id: 'oil-black',
    name: '기름값 폭풍 속 흑자',
    desc: '기름값이 아주 비싼 해(한 해 평균 유가 지수 1.5 넘게)를 흑자로 마쳐요',
    tier: 2,
    group: 'money',
    art: 'oil',
    test: ({ state, ci }) => yearsOf(state, ci).some((y) => y.r.profit > 0 && (yearOil(state, y.year) ?? 0) > OIL_SHOCK),
  },
  { id: 'long-haul', name: '지구 반 바퀴', desc: '11,000km 넘는 노선에 비행기를 띄워요', tier: 2, group: 'network', art: 'arc', test: ({ c }) => flyingRoutes(c).some((r) => dist(r.a, r.b) > LONG_HAUL_KM) },
  { id: 'triple', name: '한 해 3관왕', desc: '한 해 시상식에서 상을 세 개 받아요', tier: 2, group: 'awards', art: 'crown', test: ({ state, ci }) => bestAwardYear(state, ci) >= 3 },
  { id: 'value-1jo', name: '1조 회사', desc: '회사 가치 1조(10,000억)를 넘겨요', tier: 2, group: 'money', art: 'gem', test: ({ state, ci, c }) => !c.out && companyValue(state, ci) >= 10000 },
  {
    id: 'stake-20',
    name: '큰 주주',
    desc: '다른 회사 주식을 20% 넘게 가져요',
    tier: 2,
    group: 'money',
    art: 'pie',
    test: ({ state, ci }) => (state.stakes ?? []).some((row, j) => j !== ci && !state.companies[j]?.out && (row?.[ci] ?? 0) >= 20),
  },
  { id: 'grade-s', name: 'S 평가', desc: '한 해 경영 평가에서 S를 받아요', tier: 2, group: 'awards', art: 'star', test: ({ c }) => c.reviews.some((r) => r.grade === 'S') },
  { id: 'first-win', name: '첫 우승', desc: '‘정해진 해까지’나 ‘목표 먼저’ 게임에서 이겨요', tier: 2, group: 'wins', art: 'flag', test: ({ won }) => won },
  { id: 'win-lcc', name: '저가항공 우승', desc: '🎒 저가항공으로 게임에서 이겨요', tier: 2, group: 'wins', art: 'backpack', test: ({ won, c }) => won && c.bizModel === 'lcc' },
  { id: 'win-cargo', name: '화물 전문 우승', desc: '📦 화물 전문으로 게임에서 이겨요', tier: 2, group: 'wins', art: 'crate', test: ({ won, c }) => won && c.bizModel === 'cargo' },
  { id: 'challenge-one', name: '도전 성공', desc: '도전 과제를 하나 성공해요', tier: 2, group: 'wins', art: 'summit', test: ({ state, ci }) => challengeDone(state, ci) !== null },
  { id: 'scenario-one', name: '역사 속으로', desc: '역사 시나리오를 하나 성공해요', tier: 2, group: 'wins', art: 'scroll', test: ({ state, ci }) => scenarioDone(state, ci) !== null },
  { id: 'veteran', name: '단골 기장', desc: '게임을 다섯 판 끝까지 해요', tier: 2, group: 'wins', art: 'tally', steps: (p) => [Math.min(p.games, 5), 5], test: ({ final, progress }) => final && progress.games >= 5 },
  {
    id: 'supersonic',
    name: '소리보다 빠르게',
    desc: '초음속 비행기를 노선에 띄워요',
    tier: 2,
    group: 'fleet',
    art: 'bolt',
    hidden: true,
    test: ({ c }) => c.planes.some((p) => bodyOf(p.model) === 'sst' && p.legs.some((l) => l.freq > 0)),
  },
  {
    id: 'debt-free',
    name: '빚 없는 큰 회사',
    desc: '비행기가 30대 넘는데 빚이 하나도 없어요',
    tier: 2,
    group: 'money',
    art: 'piggy',
    hidden: true,
    test: ({ c }) => !c.out && c.debt <= 0 && c.planes.length >= 30,
  },

  // ---------------------------------------------------------------- 금 (아주 어려운 일)
  { id: 'fleet-100', name: '비행기 100대', desc: '비행기를 100대 갖춰요', tier: 3, group: 'fleet', art: 'fleet100', test: ({ c }) => c.planes.length >= 100 },
  { id: 'cities-50', name: '지점 50곳', desc: '도시 50곳에 지점을 내요', tier: 3, group: 'network', art: 'city50', test: ({ c }) => c.branches.length >= 50 },
  {
    id: 'sweep',
    name: '시상식 싹쓸이',
    desc: '한 해 시상식 다섯 부문을 모두 받아요',
    tier: 3,
    group: 'awards',
    art: 'sweep',
    test: ({ state, ci }) => (state.awards ?? []).some((y) => AWARD_KINDS.every((k) => y.items.some((a) => a.kind === k && a.company === ci))),
  },
  { id: 'takeover', name: '회사 합치기', desc: '주식을 절반 넘게 사들여 라이벌 회사를 합쳐요', tier: 3, group: 'money', art: 'merge', test: ({ state, ci }) => state.companies.some((o, j) => j !== ci && o.mergedInto === ci) },
  {
    id: 'win-fierce',
    name: '치열한 승부',
    desc: '컴퓨터 성향 ‘치열’인 게임에서 이겨요',
    tier: 3,
    group: 'wins',
    art: 'flame',
    test: ({ state, won }) => won && state.options.aiStyle === 'fierce' && state.companies.some((o) => o.kind !== 'human'),
  },
  {
    id: 'win-eras',
    name: '세 시대 정복',
    desc: '1963·1983·2003년에 시작하는 게임에서 한 번씩 이겨요',
    tier: 3,
    group: 'wins',
    art: 'eras',
    steps: (p) => [START_ERAS.filter((e) => p.eras.includes(e)).length, START_ERAS.length],
    test: ({ won, progress }) => won && START_ERAS.every((e) => progress.eras.includes(e)),
  },
  {
    id: 'challenge-all',
    name: '도전 과제 완주',
    desc: `도전 과제 ${CHALLENGES.length}개를 모두 성공해요`,
    tier: 3,
    group: 'wins',
    art: 'compass',
    steps: (p) => [CHALLENGES.filter((d) => p.challenges.includes(d.id)).length, CHALLENGES.length],
    test: ({ state, ci, progress }) => challengeDone(state, ci) !== null && CHALLENGES.every((d) => progress.challenges.includes(d.id)),
  },
  {
    id: 'scenario-all',
    name: '하늘길 역사가',
    desc: `역사 시나리오 ${SCENARIOS.length}개를 모두 성공해요`,
    tier: 3,
    group: 'wins',
    art: 'scrolls',
    steps: (p) => [SCENARIOS.filter((d) => p.scenarios?.includes(d.id)).length, SCENARIOS.length],
    test: ({ state, ci, progress }) => scenarioDone(state, ci) !== null && SCENARIOS.every((d) => progress.scenarios?.includes(d.id)),
  },
  {
    id: 'marathon',
    name: '30년 비행',
    desc: '회사를 지키며 30년 이어진 게임을 끝까지 마쳐요',
    tier: 3,
    group: 'wins',
    art: 'hourglass',
    hidden: true,
    test: ({ state, final, c }) => final && !c.out && playedMonths(state) >= 360,
  },
];

export const ACHIEVEMENT: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export const TIER_INFO: Record<AchTier, { name: string; color: string }> = {
  1: { name: '동', color: '#c27c45' },
  2: { name: '은', color: '#9aa7b8' },
  3: { name: '금', color: '#e2b13c' },
};

// ------------------------------------------------------------------ 판 열쇠

/** 짧은 해시 (같은 글이면 같은 열쇠) */
export function hashStr(s: string): string {
  let h = 5381;
  let h2 = 52711;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h = (Math.imul(h, 33) ^ ch) | 0;
    h2 = (Math.imul(h2, 31) + ch) | 0;
  }
  return (h >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

/** 한 판의 열쇠 (시작 때 정해지고 끝까지 같다) */
export function gameKey(state: Pick<AirlineState, 'startYear' | 'startT' | 'options' | 'companies'>): string {
  return hashStr([state.startYear, state.startT, state.options.mode, state.options.challenge ?? state.options.scenario ?? '', ...state.companies.map((c) => `${c.seat}:${c.kind}:${c.name}:${c.hub}`)].join('|'));
}

/** 끝난 판의 열쇠 (같은 끝을 두 번 세지 않게) */
export function endKey(state: AirlineState): string {
  return hashStr([gameKey(state), state.t, state.nextId, state.nextLogId, state.nextEventId, ...state.companies.map((c) => `${Math.round(c.cash)}:${c.planes.length}:${c.out ? 1 : 0}`)].join('|'));
}

// ------------------------------------------------------------------ 저장 형식

export function emptyAchStore(): AchStore {
  return { v: 1, items: {}, progress: { eras: [], challenges: [], games: 0 }, seen: [] };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
export const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e14;
export const isName = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 40;
export const isKey = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-z]{2,24}$/.test(v);
export const isSeat = (v: unknown): v is number => isInt(v) && v >= 0 && v <= 3;
export const isYear = (v: unknown): v is number => isInt(v) && v >= 1900 && v <= 2200;
export const parseAirlineId = (v: unknown): string | null => (typeof v === 'string' && REAL_AIRLINE[v] ? v : null);

function parseRecord(v: unknown): UnlockRecord | null {
  if (!isObj(v)) return null;
  if (!isTime(v.at) || !isName(v.by) || !isSeat(v.seat) || !isYear(v.year)) return null;
  return { at: v.at, by: v.by, seat: v.seat, airline: parseAirlineId(v.airline), year: v.year, g: isKey(v.g) ? v.g : '' };
}

/** 저장된 업적을 꼼꼼히 읽는다 (모르는 업적·망가진 값은 버린다) */
export function parseAchStore(raw: unknown): AchStore {
  const out = emptyAchStore();
  if (!isObj(raw) || raw.v !== 1) return out;
  if (isObj(raw.items)) {
    for (const [id, rec] of Object.entries(raw.items)) {
      if (!ACHIEVEMENT[id]) continue;
      const r = parseRecord(rec);
      if (r) out.items[id] = r;
    }
  }
  const p = isObj(raw.progress) ? raw.progress : {};
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  out.progress = {
    eras: START_ERAS.filter((e) => list(p.eras).includes(e)),
    challenges: CHALLENGES.map((d) => d.id).filter((id) => list(p.challenges).includes(id)),
    ...withScenarios(scenarioIds(list(p.scenarios))),
    games: isInt(p.games) && p.games >= 0 && p.games < 1e6 ? p.games : 0,
  };
  out.seen = [...new Set(list(raw.seen).filter(isKey))].slice(-SEEN_KEEP);
  return out;
}

// ------------------------------------------------------------------ 살피기

/** 게임이 끝났을 때 여러 판에 걸친 진행을 더한다 (이미 센 끝이면 그대로) */
export function addGameEnd(store: AchStore, state: AirlineState): AchStore {
  if (state.phase !== 'gameover' || !state.result) return store;
  const key = endKey(state);
  if (store.seen.includes(key)) return store;
  const humans = state.companies.map((c, i) => (c.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  if (humans.length === 0) return store;
  const eras = [...store.progress.eras];
  const challenges = [...store.progress.challenges];
  if (humans.some((ci) => isWinner(state, ci)) && START_ERAS.includes(state.startYear) && !eras.includes(state.startYear)) eras.push(state.startYear);
  const scenarios = [...(store.progress.scenarios ?? [])];
  for (const ci of humans) {
    const ch = challengeDone(state, ci);
    if (ch && !challenges.includes(ch)) challenges.push(ch);
    const sc = scenarioDone(state, ci);
    if (sc && !scenarios.includes(sc)) scenarios.push(sc);
  }
  return {
    ...store,
    progress: {
      eras: START_ERAS.filter((e) => eras.includes(e)),
      challenges: CHALLENGES.map((d) => d.id).filter((id) => challenges.includes(id)),
      ...withScenarios(scenarioIds(scenarios)),
      games: store.progress.games + 1,
    },
    seen: [...store.seen, key].slice(-SEEN_KEEP),
  };
}

/**
 * 새로 이룬 업적을 찾는다 (한 달이 끝날 때마다, 그리고 게임이 끝날 때).
 * 사람 회사만, 이미 이룬 업적은 건너뛴다. 같은 달에 여러 사람이 이루면 앞 자리 회사가 처음 이룬 회사가 된다.
 * 게임이 끝났으면 여러 판에 걸친 진행도 함께 더한다 (같은 끝은 한 번만).
 */
export function checkAchievements(state: AirlineState, store: AchStore, now: number): { store: AchStore; unlocks: Unlock[] } {
  const final = state.phase === 'gameover';
  let next = final ? addGameEnd(store, state) : store;
  const unlocks: Unlock[] = [];
  const g = gameKey(state);
  const year = yearOfM(state.t);
  for (const [ci, c] of state.companies.entries()) {
    if (c.kind !== 'human') continue;
    const ctx: AchCtx = { state, ci, c, final, won: final && isWinner(state, ci), progress: next.progress };
    for (const def of ACHIEVEMENTS) {
      if (next.items[def.id] || unlocks.some((u) => u.id === def.id)) continue;
      if (!def.test(ctx)) continue;
      unlocks.push({ id: def.id, ci, record: { at: now, by: c.name, seat: c.seat, airline: c.airline && REAL_AIRLINE[c.airline] ? c.airline : null, year, g } });
    }
  }
  if (unlocks.length > 0) {
    const items = { ...next.items };
    for (const u of unlocks) items[u.id] = u.record;
    next = { ...next, items };
  }
  return { store: next, unlocks };
}

/** 이 판에서 새로 이룬 업적 (결과 화면) */
export function unlockedIn(store: AchStore, state: Pick<AirlineState, 'startYear' | 'startT' | 'options' | 'companies'>): string[] {
  const g = gameKey(state);
  return ACHIEVEMENTS.filter((a) => store.items[a.id]?.g === g).map((a) => a.id);
}

export function unlockedCount(store: AchStore): number {
  return ACHIEVEMENTS.filter((a) => store.items[a.id]).length;
}
