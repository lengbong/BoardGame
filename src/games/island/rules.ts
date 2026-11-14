import { withJosa } from '../../lib/korean';
import { randomInt, shuffle } from '../../lib/random';
import { SEAT_COLORS } from '../common/players';
import { CORNERS, EDGES, HEXES } from './board';
import type {
  BuildKind,
  Gain,
  GameEvent,
  IslandAction,
  IslandOptions,
  IslandSetup,
  IslandState,
  Player,
  PlayerStats,
  Resource,
  ResourceCount,
  Rng,
  SeatIndex,
  Terrain,
} from './types';

export const RESOURCES: readonly Resource[] = ['wood', 'stone', 'grain', 'fish'];

export const RES_INFO: Record<Resource, { name: string; emoji: string; terrain: Terrain }> = {
  wood: { name: '나무', emoji: '🪵', terrain: 'forest' },
  stone: { name: '돌', emoji: '🪨', terrain: 'rock' },
  grain: { name: '곡식', emoji: '🌾', terrain: 'field' },
  fish: { name: '물고기', emoji: '🐟', terrain: 'shore' },
};

export const TERRAIN_INFO: Record<Terrain, { name: string; res: Resource | null }> = {
  forest: { name: '숲', res: 'wood' },
  rock: { name: '돌산', res: 'stone' },
  field: { name: '밭', res: 'grain' },
  shore: { name: '갯벌·어장', res: 'fish' },
  hill: { name: '등대 언덕', res: null },
};

/** 섬 16칸의 땅 종류 수 (갯벌·어장과 등대 언덕은 바닷가에만) */
export const TERRAIN_COUNTS: Record<Terrain, number> = { forest: 4, rock: 4, field: 3, shore: 4, hill: 1 };

export const COSTS: Record<BuildKind, ResourceCount> = {
  road: { wood: 1, stone: 1, grain: 0, fish: 0 },
  house: { wood: 2, stone: 1, grain: 1, fish: 1 },
  hall: { wood: 0, stone: 3, grain: 2, fish: 2 },
  lighthouse: { wood: 1, stone: 3, grain: 1, fish: 1 },
};

export const BUILD_INFO: Record<BuildKind, { name: string; emoji: string; gain: number }> = {
  road: { name: '길', emoji: '🛤️', gain: 0 },
  house: { name: '집', emoji: '🏠', gain: 1 },
  hall: { name: '마을회관', emoji: '🏛️', gain: 1 },
  lighthouse: { name: '등대', emoji: '🔆', gain: 2 },
};

export const BUILD_KINDS: readonly BuildKind[] = ['road', 'house', 'hall', 'lighthouse'];

/** 차례를 마칠 때 손에 들 수 있는 자원 수 */
export const HAND_LIMIT = 9;
/** 축제 깃발을 받으려면 내 건물이 닿은 땅 칸이 이만큼은 되어야 한다 */
export const FLAG_MIN = 9;
export const FLAG_POINTS = 2;
export const LIGHTHOUSE_POINTS = 2;
export const BANK_RATE = 3;
export const LIGHTHOUSE_RATE = 2;
export const MARKET_SIZE = 4;
/** 아주 오래 걸리면 이 바퀴가 끝날 때 점수가 가장 높은 사람이 이긴다 (거의 일어나지 않는 안전장치) */
export const MAX_ROUNDS = 60;
export const TARGETS = [8, 10, 12] as const;

export const DEFAULT_OPTIONS: IslandOptions = { target: 10, market: true, helper: true, harvest: false };

const MAX_LOG = 80;

type EventInput = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'id'> : never) : never;

// ------------------------------------------------------------------ 작은 도우미

export function playerName(player: Player): string {
  return player.name || SEAT_COLORS[player.seat].name;
}

export function emptyRes(): ResourceCount {
  return { wood: 0, stone: 0, grain: 0, fish: 0 };
}

export function totalRes(r: ResourceCount): number {
  return r.wood + r.stone + r.grain + r.fish;
}

export function canAfford(have: ResourceCount, cost: ResourceCount): boolean {
  return RESOURCES.every((k) => have[k] >= cost[k]);
}

/** 모자란 자원 */
export function missing(have: ResourceCount, cost: ResourceCount): ResourceCount {
  const out = emptyRes();
  for (const k of RESOURCES) out[k] = Math.max(0, cost[k] - have[k]);
  return out;
}

/** "🪵1 🪨2" (0개는 빼고) */
export function resText(r: ResourceCount): string {
  return RESOURCES.filter((k) => r[k] > 0)
    .map((k) => `${RES_INFO[k].emoji}${r[k]}`)
    .join(' ');
}

function emptyStats(): PlayerStats {
  return { produced: 0, trades: 0, discarded: 0, roads: 0 };
}

function nameOf(s: IslandState, i: number): string {
  return playerName(s.players[i]);
}

function addLog(s: IslandState, seat: SeatIndex | null, text: string): void {
  s.log = [...s.log, { id: s.nextLogId, seat, text }].slice(-MAX_LOG);
  s.nextLogId += 1;
}

function emit(s: IslandState, event: EventInput): void {
  s.events.push({ ...event, id: s.nextEventId } as GameEvent);
  s.nextEventId += 1;
}

function draft(state: IslandState): IslandState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, res: { ...p.res }, stats: { ...p.stats } })),
    buildings: state.buildings.map((b) => (b ? { ...b } : null)),
    roads: [...state.roads],
    lighthouses: [...state.lighthouses],
    market: [...state.market],
    events: [],
  };
}

// ------------------------------------------------------------------ 판 만들기

/**
 * 땅 종류와 숫자를 섞어 놓는다. 공평하게:
 * 이웃한 칸끼리 같은 숫자가 없고, 같은 땅 종류끼리도 숫자가 겹치지 않는다.
 * 숫자 1~6은 모두 두 번씩, 그중 세 숫자는 한 번 더 (15칸).
 */
export function generateBoard(rng: Rng): { terrain: Terrain[]; numbers: number[] } {
  for (let attempt = 0; attempt < 50; attempt++) {
    const coastal = shuffle(
      HEXES.filter((h) => h.coastal).map((h) => h.id),
      rng,
    );
    const terrain: Terrain[] = HEXES.map(() => 'forest');
    const used = new Set<number>();
    const take = (list: number[], t: Terrain, n: number) => {
      let k = 0;
      for (const id of list) {
        if (k >= n) break;
        if (used.has(id)) continue;
        used.add(id);
        terrain[id] = t;
        k++;
      }
    };
    take(coastal, 'hill', TERRAIN_COUNTS.hill);
    take(coastal, 'shore', TERRAIN_COUNTS.shore);
    const rest = shuffle(
      HEXES.map((h) => h.id).filter((id) => !used.has(id)),
      rng,
    );
    take(rest, 'forest', TERRAIN_COUNTS.forest);
    take(rest, 'rock', TERRAIN_COUNTS.rock);
    take(rest, 'field', TERRAIN_COUNTS.field);

    const numbers = assignNumbers(terrain, rng);
    if (numbers) return { terrain, numbers };
  }
  throw new Error('섬을 만들 수 없어요');
}

function assignNumbers(terrain: Terrain[], rng: Rng): number[] | null {
  const extras = shuffle([1, 2, 3, 4, 5, 6], rng).slice(0, 3);
  const pool = new Map<number, number>();
  for (let n = 1; n <= 6; n++) pool.set(n, 2 + (extras.includes(n) ? 1 : 0));
  const order = HEXES.filter((h) => terrain[h.id] !== 'hill')
    .map((h) => h.id)
    .sort((a, b) => HEXES[b].neighbors.length - HEXES[a].neighbors.length || a - b);
  const numbers = HEXES.map(() => 0);
  let steps = 0;
  const place = (i: number): boolean => {
    if (i === order.length) return true;
    if (++steps > 20000) return false;
    const h = order[i];
    for (const n of shuffle([1, 2, 3, 4, 5, 6], rng)) {
      if ((pool.get(n) ?? 0) === 0) continue;
      if (HEXES[h].neighbors.some((nb) => numbers[nb] === n)) continue;
      if (HEXES.some((o) => o.id !== h && terrain[o.id] === terrain[h] && numbers[o.id] === n)) continue;
      numbers[h] = n;
      pool.set(n, pool.get(n)! - 1);
      if (place(i + 1)) return true;
      numbers[h] = 0;
      pool.set(n, pool.get(n)! + 1);
    }
    return false;
  };
  return place(0) ? numbers : null;
}

/** 공평한 판인지 (테스트·저장 검사용) */
export function isFairBoard(terrain: Terrain[], numbers: number[]): boolean {
  if (terrain.length !== HEXES.length || numbers.length !== HEXES.length) return false;
  for (const t of Object.keys(TERRAIN_COUNTS) as Terrain[]) {
    if (terrain.filter((x) => x === t).length !== TERRAIN_COUNTS[t]) return false;
  }
  for (const h of HEXES) {
    const t = terrain[h.id];
    const n = numbers[h.id];
    if ((t === 'shore' || t === 'hill') && !h.coastal) return false;
    if (t === 'hill') {
      if (n !== 0) return false;
      continue;
    }
    if (!Number.isInteger(n) || n < 1 || n > 6) return false;
    if (h.neighbors.some((nb) => numbers[nb] === n)) return false;
    if (HEXES.some((o) => o.id !== h.id && terrain[o.id] === t && numbers[o.id] === n)) return false;
  }
  for (let n = 1; n <= 6; n++) {
    const c = numbers.filter((x) => x === n).length;
    if (c < 2 || c > 3) return false;
  }
  return true;
}

export function createGame(setup: IslandSetup, rng: Rng = Math.random): IslandState {
  const players: Player[] = [];
  setup.seats.forEach((seat, i) => {
    if (seat.kind === 'empty') return;
    players.push({ seat: i as SeatIndex, kind: seat.kind, name: seat.name.trim(), res: emptyRes(), stats: emptyStats() });
  });
  const n = players.length;
  const board = generateBoard(rng);
  const first = randomInt(n, rng);
  const forward = Array.from({ length: n }, (_, k) => (first + k) % n);
  const setupOrder = [...forward, ...[...forward].reverse()];
  const market = setup.options.market ? Array.from({ length: MARKET_SIZE }, () => RESOURCES[randomInt(4, rng)]) : [];
  const s: IslandState = {
    players,
    options: { ...setup.options },
    terrain: board.terrain,
    numbers: board.numbers,
    buildings: CORNERS.map(() => null),
    roads: EDGES.map(() => null),
    lighthouses: players.map(() => null),
    market,
    phase: 'setup',
    current: first,
    setupOrder,
    setupStep: 0,
    setupHouse: null,
    dice: null,
    chosenDie: null,
    marketUsed: false,
    bankTrades: 0,
    flagHolder: null,
    discardNeed: 0,
    winner: null,
    round: 0,
    turn: 1,
    events: [],
    nextEventId: 1,
    log: [],
    nextLogId: 1,
  };
  emit(s, { type: 'start', first });
  addLog(s, null, `🏝️ 섬에 도착했어요! ${withJosa(nameOf(s, first), '이/가')} 먼저 집과 길을 놓아요.`);
  return s;
}

// ------------------------------------------------------------------ 판 살펴보기

/** 지금 행동할 사람 (끝났으면 -1) */
export function actor(state: IslandState): number {
  return state.phase === 'gameover' ? -1 : state.current;
}

/** 이 사람 건물이 닿은 서로 다른 땅 칸 */
export function touchedHexes(state: IslandState, p: number): Set<number> {
  const out = new Set<number>();
  state.buildings.forEach((b, c) => {
    if (b && b.owner === p) for (const h of CORNERS[c].hexes) out.add(h);
  });
  return out;
}

export interface PointsBreakdown {
  houses: number;
  halls: number;
  lighthouse: boolean;
  flag: boolean;
  total: number;
}

export function pointsOf(state: IslandState, p: number): PointsBreakdown {
  let houses = 0;
  let halls = 0;
  for (const b of state.buildings) {
    if (!b || b.owner !== p) continue;
    if (b.type === 'hall') halls++;
    else houses++;
  }
  const lighthouse = state.lighthouses[p] !== null;
  const flag = state.flagHolder === p;
  return { houses, halls, lighthouse, flag, total: houses + halls * 2 + (lighthouse ? LIGHTHOUSE_POINTS : 0) + (flag ? FLAG_POINTS : 0) };
}

export function points(state: IslandState, p: number): number {
  return pointsOf(state, p).total;
}

export function bankRate(state: IslandState, p: number): number {
  return state.lighthouses[p] !== null ? LIGHTHOUSE_RATE : BANK_RATE;
}

/** 모서리가 비어 있고 이웃 모서리에도 건물이 없다 (건물끼리 변 2개 이상 떨어져야 한다) */
export function spacedOk(state: IslandState, c: number): boolean {
  return !state.buildings[c] && CORNERS[c].corners.every((n) => !state.buildings[n]);
}

function hasRoadAt(state: IslandState, p: number, c: number): boolean {
  return CORNERS[c].edges.some((e) => state.roads[e] === p);
}

export function canPlaceHouse(state: IslandState, p: number, c: number): boolean {
  if (c < 0 || c >= CORNERS.length || !spacedOk(state, c)) return false;
  return state.phase === 'setup' || hasRoadAt(state, p, c);
}

export function canPlaceRoad(state: IslandState, p: number, e: number): boolean {
  if (e < 0 || e >= EDGES.length || state.roads[e] !== null) return false;
  const edge = EDGES[e];
  if (state.phase === 'setup') return state.setupHouse !== null && (edge.a === state.setupHouse || edge.b === state.setupHouse);
  return [edge.a, edge.b].some((v) => {
    const b = state.buildings[v];
    if (b) return b.owner === p;
    // 남의 건물이 없는 모서리라면 내 길에서 이어 갈 수 있다
    return CORNERS[v].edges.some((x) => x !== e && state.roads[x] === p);
  });
}

export function canPlaceHall(state: IslandState, p: number, c: number): boolean {
  const b = state.buildings[c];
  return !!b && b.owner === p && b.type === 'house';
}

export function canPlaceLighthouse(state: IslandState, p: number, c: number): boolean {
  const b = state.buildings[c];
  return state.lighthouses[p] === null && !!b && b.owner === p && CORNERS[c].coastal;
}

/** 이 종류를 놓을 수 있는 자리 (자원은 따지지 않는다) */
export function validSpots(state: IslandState, p: number, kind: BuildKind): number[] {
  const out: number[] = [];
  if (kind === 'road') {
    for (let e = 0; e < EDGES.length; e++) if (canPlaceRoad(state, p, e)) out.push(e);
    return out;
  }
  for (let c = 0; c < CORNERS.length; c++) {
    if (kind === 'house' ? canPlaceHouse(state, p, c) : kind === 'hall' ? canPlaceHall(state, p, c) : canPlaceLighthouse(state, p, c)) out.push(c);
  }
  return out;
}

/** 지금 이것을 지을 수 있는지, 못 지으면 왜 못 짓는지 (짧은 말) */
export function buildBlocker(state: IslandState, p: number, kind: BuildKind): string | null {
  if (state.phase !== 'main' || state.current !== p) return '지금은 지을 수 없어요';
  const player = state.players[p];
  if (kind === 'lighthouse' && state.lighthouses[p] !== null) return '등대는 한 사람에 하나예요';
  const spots = validSpots(state, p, kind);
  if (spots.length === 0) {
    if (kind === 'road') return '이을 수 있는 길이 없어요';
    if (kind === 'house') return '길이 닿은 빈 자리가 없어요';
    if (kind === 'hall') return '키울 내 집이 없어요';
    return '바닷가에 내 집이 있어야 해요';
  }
  if (!canAfford(player.res, COSTS[kind])) return `${resText(missing(player.res, COSTS[kind]))} 모자라요`;
  return null;
}

// ------------------------------------------------------------------ 행동

/** 행동을 적용한 새 상태. 할 수 없는 행동이면 그대로 돌려준다. */
export function applyAction(state: IslandState, action: IslandAction, rng: Rng = Math.random): IslandState {
  if (state.phase === 'gameover') return state;
  switch (action.type) {
    case 'build':
      if (state.phase === 'setup') return setupBuild(state, action.kind, action.at);
      if (state.phase === 'main') return build(state, action.kind, action.at);
      return state;
    case 'roll':
      return state.phase === 'roll' ? roll(state, action.dice, rng) : state;
    case 'choose':
      return state.phase === 'choose' ? choose(state, action.die) : state;
    case 'bank':
      return state.phase === 'main' ? bank(state, action.give, action.get) : state;
    case 'market':
      return state.phase === 'main' ? marketSwap(state, action.give, action.slot) : state;
    case 'endTurn':
      return state.phase === 'main' ? endTurn(state) : state;
    case 'discard':
      return state.phase === 'discard' ? discard(state, action.res) : state;
  }
  return state;
}

function setupBuild(state: IslandState, kind: BuildKind, at: number): IslandState {
  const p = state.current;
  if (kind === 'house') {
    if (state.setupHouse !== null || !canPlaceHouse(state, p, at)) return state;
    const s = draft(state);
    s.buildings[at] = { owner: p, type: 'house' };
    s.setupHouse = at;
    emit(s, { type: 'build', player: p, kind: 'house', at, points: 1 });
    const second = s.setupStep >= s.players.length;
    if (second) {
      const gains: Gain[] = [];
      for (const h of CORNERS[at].hexes) {
        const res = TERRAIN_INFO[s.terrain[h]].res;
        if (!res) continue;
        s.players[p].res[res] += 1;
        gains.push({ hex: h, corner: at, player: p, res, amount: 1 });
      }
      if (gains.length > 0) emit(s, { type: 'startGain', player: p, gains });
      const got = emptyRes();
      gains.forEach((g) => (got[g.res] += 1));
      addLog(s, s.players[p].seat, `🏠 ${withJosa(nameOf(s, p), '이/가')} 두 번째 집을 놓고 ${resText(got) || '아무것도'} 받았어요.`);
    } else {
      addLog(s, s.players[p].seat, `🏠 ${withJosa(nameOf(s, p), '이/가')} 첫 집을 놓았어요.`);
    }
    updateFlag(s, p);
    return s;
  }
  if (kind === 'road') {
    if (state.setupHouse === null || !canPlaceRoad(state, p, at)) return state;
    const s = draft(state);
    s.roads[at] = p;
    s.players[p].stats.roads += 1;
    s.setupHouse = null;
    emit(s, { type: 'build', player: p, kind: 'road', at, points: 0 });
    s.setupStep += 1;
    s.turn += 1;
    if (s.setupStep >= s.setupOrder.length) {
      s.phase = 'roll';
      s.current = s.setupOrder[0];
      s.round = 1;
      emit(s, { type: 'turn', player: s.current });
      addLog(s, null, `⛵ 준비 끝! ${withJosa(nameOf(s, s.current), '이/가')} 먼저 주사위를 굴려요.`);
    } else {
      s.current = s.setupOrder[s.setupStep];
    }
    return s;
  }
  return state;
}

function build(state: IslandState, kind: BuildKind, at: number): IslandState {
  const p = state.current;
  const cost = COSTS[kind];
  if (!canAfford(state.players[p].res, cost)) return state;
  const ok =
    kind === 'road'
      ? canPlaceRoad(state, p, at)
      : kind === 'house'
        ? canPlaceHouse(state, p, at)
        : kind === 'hall'
          ? canPlaceHall(state, p, at)
          : canPlaceLighthouse(state, p, at);
  if (!ok) return state;
  const s = draft(state);
  const me = s.players[p];
  for (const k of RESOURCES) me.res[k] -= cost[k];
  const who = nameOf(s, p);
  if (kind === 'road') {
    s.roads[at] = p;
    me.stats.roads += 1;
    addLog(s, me.seat, `🛤️ ${withJosa(who, '이/가')} 길을 놓았어요.`);
  } else if (kind === 'house') {
    s.buildings[at] = { owner: p, type: 'house' };
    addLog(s, me.seat, `🏠 ${withJosa(who, '이/가')} 집을 지었어요. (+1점)`);
  } else if (kind === 'hall') {
    s.buildings[at] = { owner: p, type: 'hall' };
    addLog(s, me.seat, `🏛️ ${withJosa(who, '이/가')} 집을 마을회관으로 키웠어요. (+1점, 자원 2개씩)`);
  } else {
    s.lighthouses[p] = at;
    addLog(s, me.seat, `🔆 ${withJosa(who, '이/가')} 등대를 세웠어요! (+2점, 은행 2:1)`);
  }
  emit(s, { type: 'build', player: p, kind, at, points: BUILD_INFO[kind].gain });
  if (kind === 'house') updateFlag(s, p);
  return s;
}

/** 축제 깃발: 내 건물이 닿은 땅 칸이 FLAG_MIN 이상이고, 가진 사람보다 많아야 가져온다 */
function updateFlag(s: IslandState, p: number): void {
  if (s.flagHolder === p) return;
  const mine = touchedHexes(s, p).size;
  if (mine < FLAG_MIN) return;
  const holder = s.flagHolder;
  if (holder !== null && mine <= touchedHexes(s, holder).size) return;
  s.flagHolder = p;
  emit(s, { type: 'flag', player: p, from: holder });
  addLog(
    s,
    s.players[p].seat,
    holder === null
      ? `🚩 ${withJosa(nameOf(s, p), '이/가')} 바다 축제 깃발을 받았어요! (땅 ${mine}칸, +2점)`
      : `🚩 ${withJosa(nameOf(s, p), '이/가')} ${nameOf(s, holder)}에게서 축제 깃발을 가져왔어요! (땅 ${mine}칸, +2점)`,
  );
}

/** 굴린 눈과 같은 숫자의 땅 칸 (풍년 규칙: 두 눈 모두) */
export function producingHexes(state: Pick<IslandState, 'numbers'>, dice: [number, number]): number[] {
  return HEXES.filter((h) => state.numbers[h.id] > 0 && (state.numbers[h.id] === dice[0] || state.numbers[h.id] === dice[1])).map((h) => h.id);
}

/** '3을', '4를' (숫자를 우리말로 읽을 때: 일·삼·육은 받침이 있다) */
export function numberWithObject(n: number): string {
  return `${n}${[1, 3, 6].includes(n) ? '을' : '를'}`;
}

/** 숫자 하나의 땅 칸 */
export function hexesWithNumber(state: Pick<IslandState, 'numbers'>, n: number): number[] {
  return HEXES.filter((h) => state.numbers[h.id] === n).map((h) => h.id);
}

/** 이 칸들이 times번 자원을 내면 누가 무엇을 받는지 (상태는 바꾸지 않는다) */
export function gainsFrom(state: Pick<IslandState, 'terrain' | 'buildings'>, hexes: number[], times: number): Gain[] {
  const gains: Gain[] = [];
  for (const h of hexes) {
    const res = TERRAIN_INFO[state.terrain[h]].res;
    if (!res) continue;
    for (const c of HEXES[h].corners) {
      const b = state.buildings[c];
      if (!b) continue;
      gains.push({ hex: h, corner: c, player: b.owner, res, amount: (b.type === 'hall' ? 2 : 1) * times });
    }
  }
  return gains;
}

/** 사람마다 받는 자원으로 묶기 */
export function gainsByPlayer(state: Pick<IslandState, 'players'>, gains: Gain[]): ResourceCount[] {
  const per = state.players.map(() => emptyRes());
  gains.forEach((g) => (per[g.player][g.res] += g.amount));
  return per;
}

/** 골라 쓰는 주사위: die번째 눈을 고르면 사람마다 무엇을 받는지 (미리 보기) */
export function previewChoice(state: IslandState, die: 0 | 1): ResourceCount[] {
  if (!state.dice) return state.players.map(() => emptyRes());
  return gainsByPlayer(state, gainsFrom(state, hexesWithNumber(state, state.dice[die]), 1));
}

/** 이번 차례에 자원을 낸 숫자들 (화면에서 숫자 패를 밝힐 때) */
export function usedNumbers(state: IslandState): number[] {
  if (!state.dice || (state.phase !== 'main' && state.phase !== 'discard')) return [];
  if (state.chosenDie !== null) return [state.dice[state.chosenDie]];
  return state.dice[0] === state.dice[1] || state.options.harvest ? [...new Set(state.dice)] : [];
}

/** 자원을 나눠 주고 기록을 남긴다 */
function produce(s: IslandState, gains: Gain[]): void {
  for (const g of gains) {
    s.players[g.player].res[g.res] += g.amount;
    s.players[g.player].stats.produced += g.amount;
  }
  if (gains.length > 0) {
    emit(s, { type: 'produce', gains });
    const per = gainsByPlayer(s, gains);
    const parts = per.map((r, i) => (totalRes(r) > 0 ? `${nameOf(s, i)} ${resText(r)}` : '')).filter(Boolean);
    addLog(s, null, `　→ ${parts.join(' · ')}`);
  } else {
    addLog(s, null, '　→ 아무도 자원을 받지 못했어요.');
  }
}

function roll(state: IslandState, fixed: [number, number] | undefined, rng: Rng): IslandState {
  const valid = (d: number) => Number.isInteger(d) && d >= 1 && d <= 6;
  const dice: [number, number] = fixed && valid(fixed[0]) && valid(fixed[1]) ? [fixed[0], fixed[1]] : [1 + randomInt(6, rng), 1 + randomInt(6, rng)];
  const s = draft(state);
  const p = s.current;
  s.dice = dice;
  s.chosenDie = null;
  const doubles = dice[0] === dice[1];
  if (!doubles && !s.options.harvest) {
    // 골라 쓰는 주사위: 굴린 사람이 두 눈 중 하나를 고를 때까지 기다린다
    s.phase = 'choose';
    emit(s, { type: 'roll', player: p, dice, hexes: [] });
    addLog(s, s.players[p].seat, `🎲 ${nameOf(s, p)}: ${dice[0]} · ${dice[1]} — 어느 눈을 쓸까요?`);
    return s;
  }
  s.phase = 'main';
  const hexes = producingHexes(s, dice);
  emit(s, { type: 'roll', player: p, dice, hexes });
  addLog(s, s.players[p].seat, `🎲 ${nameOf(s, p)}: ${dice[0]} · ${dice[1]}${doubles ? ' (같은 눈! 두 배)' : ''}`);
  produce(s, gainsFrom(s, hexes, doubles ? 2 : 1));
  return s;
}

function choose(state: IslandState, die: 0 | 1): IslandState {
  if ((die !== 0 && die !== 1) || !state.dice) return state;
  const s = draft(state);
  const p = s.current;
  const n = s.dice![die];
  s.chosenDie = die;
  s.phase = 'main';
  const hexes = hexesWithNumber(s, n);
  emit(s, { type: 'choose', player: p, die, number: n, hexes });
  addLog(s, s.players[p].seat, `👉 ${withJosa(nameOf(s, p), '이/가')} ${numberWithObject(n)} 골랐어요.`);
  produce(s, gainsFrom(s, hexes, 1));
  return s;
}

function bank(state: IslandState, give: Resource, get: Resource): IslandState {
  const p = state.current;
  const rate = bankRate(state, p);
  if (give === get || !RESOURCES.includes(give) || !RESOURCES.includes(get) || state.players[p].res[give] < rate) return state;
  const s = draft(state);
  const me = s.players[p];
  me.res[give] -= rate;
  me.res[get] += 1;
  me.stats.trades += 1;
  s.bankTrades += 1;
  emit(s, { type: 'bank', player: p, give, count: rate, get });
  addLog(s, me.seat, `🏦 ${nameOf(s, p)}: 은행에 ${RES_INFO[give].emoji}${rate} 주고 ${RES_INFO[get].emoji}1 받았어요.`);
  return s;
}

function marketSwap(state: IslandState, give: Resource, slot: number): IslandState {
  const p = state.current;
  if (!state.options.market || state.marketUsed || !Number.isInteger(slot) || slot < 0 || slot >= state.market.length) return state;
  const get = state.market[slot];
  if (!RESOURCES.includes(give) || give === get || state.players[p].res[give] < 1) return state;
  const s = draft(state);
  const me = s.players[p];
  me.res[give] -= 1;
  me.res[get] += 1;
  me.stats.trades += 1;
  s.market[slot] = give;
  s.marketUsed = true;
  emit(s, { type: 'market', player: p, give, get, slot });
  addLog(s, me.seat, `🧺 ${nameOf(s, p)}: 장터에서 ${RES_INFO[give].emoji} → ${RES_INFO[get].emoji} 바꿨어요.`);
  return s;
}

function endTurn(state: IslandState): IslandState {
  const s = draft(state);
  const p = s.current;
  if (points(s, p) >= s.options.target) {
    finish(s, p, false);
    return s;
  }
  const total = totalRes(s.players[p].res);
  if (total > HAND_LIMIT) {
    s.phase = 'discard';
    s.discardNeed = total - HAND_LIMIT;
    addLog(s, s.players[p].seat, `🧺 ${nameOf(s, p)}의 자원이 ${total}개라서 ${s.discardNeed}개를 내려놓아야 해요.`);
    return s;
  }
  nextTurn(s);
  return s;
}

function discard(state: IslandState, res: ResourceCount): IslandState {
  const p = state.current;
  const have = state.players[p].res;
  if (!res || typeof res !== 'object') return state;
  let sum = 0;
  for (const k of RESOURCES) {
    const v = res[k];
    if (!Number.isInteger(v) || v < 0 || v > have[k]) return state;
    sum += v;
  }
  if (sum !== state.discardNeed) return state;
  const s = draft(state);
  const me = s.players[p];
  for (const k of RESOURCES) me.res[k] -= res[k];
  me.stats.discarded += sum;
  s.discardNeed = 0;
  emit(s, { type: 'discard', player: p, count: sum });
  addLog(s, me.seat, `🧺 ${withJosa(nameOf(s, p), '이/가')} 자원 ${sum}개(${resText(res)})를 내려놓았어요.`);
  nextTurn(s);
  return s;
}

function nextTurn(s: IslandState): void {
  const n = s.players.length;
  s.current = (s.current + 1) % n;
  s.phase = 'roll';
  s.dice = null;
  s.chosenDie = null;
  s.marketUsed = false;
  s.bankTrades = 0;
  s.discardNeed = 0;
  s.turn += 1;
  if (s.current === s.setupOrder[0]) {
    s.round += 1;
    if (s.round > MAX_ROUNDS) {
      const order = rankings(s);
      finish(s, order[0], true);
      return;
    }
  }
  emit(s, { type: 'turn', player: s.current });
}

function finish(s: IslandState, winner: number, byLimit: boolean): void {
  s.phase = 'gameover';
  s.winner = winner;
  s.discardNeed = 0;
  emit(s, { type: 'win', player: winner, byLimit });
  addLog(
    s,
    s.players[winner].seat,
    byLimit
      ? `🏁 ${MAX_ROUNDS}바퀴가 지났어요. 점수가 가장 높은 ${withJosa(nameOf(s, winner), '이/가')} 이겼어요!`
      : `🏆 ${withJosa(nameOf(s, winner), '이/가')} ${points(s, winner)}점으로 섬마을 개척에 성공했어요!`,
  );
}

/** 순위: 이긴 사람 먼저, 그다음 점수 → 닿은 땅 칸 → 손에 든 자원 */
export function rankings(state: IslandState): number[] {
  const idx = state.players.map((_, i) => i);
  return idx.sort((a, b) => {
    if (state.winner === a) return -1;
    if (state.winner === b) return 1;
    return (
      points(state, b) - points(state, a) ||
      touchedHexes(state, b).size - touchedHexes(state, a).size ||
      totalRes(state.players[b].res) - totalRes(state.players[a].res) ||
      a - b
    );
  });
}
