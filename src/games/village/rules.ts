import { withJosa } from '../../lib/korean';
import { randomInt, shuffle } from '../../lib/random';
import { SEAT_COLORS } from '../common/players';
import { DX, DY, Grid, allFeatures, cellKey, keyX, keyY, majority, opposite, type FeatureInfo } from './board';
import { EDGES, FEATURE_NAMES, START_TILE, TILES, deckList, isJangseungTile } from './tiles';
import type { FeatureKind, GameEvent, Player, PlayerStats, Rng, Rot, SeatIndex, VillageAction, VillageOptions, VillageSetup, VillageState } from './types';

export const DEFAULT_OPTIONS: VillageOptions = {
  jangseung: true,
  flags: 6,
  hand: 2,
  showSpots: true,
};

const MAX_LOG = 100;
const ROTS: Rot[] = [0, 1, 2, 3];

type EventInput = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'id'> : never) : never;

export function playerName(player: Pick<Player, 'name' | 'seat'>): string {
  return player.name || SEAT_COLORS[player.seat].name;
}

function nameOf(s: VillageState, i: number): string {
  return playerName(s.players[i]);
}

function addLog(s: VillageState, seat: SeatIndex | null, text: string): void {
  s.log = [...s.log, { id: s.nextLogId, seat, text }].slice(-MAX_LOG);
  s.nextLogId += 1;
}

function emit(s: VillageState, event: EventInput): void {
  s.events.push({ ...event, id: s.nextEventId } as GameEvent);
  s.nextEventId += 1;
}

function draft(state: VillageState): VillageState {
  const s = structuredClone(state);
  s.events = [];
  return s;
}

function emptyStats(): PlayerStats {
  return { tiles: 0, path: 0, stream: 0, paddy: 0, jangseung: 0, final: 0, completed: 0, flagsPlanted: 0 };
}

export function gridOf(state: Pick<VillageState, 'board'>): Grid {
  return new Grid(state.board);
}

// ------------------------------------------------------------------ 놓을 자리

export interface Placement {
  x: number;
  y: number;
  r: Rot;
}

/** 조각 t를 놓을 수 있는 모든 (자리, 방향) */
export function placementsFor(grid: Grid, t: number, rots: readonly Rot[] = ROTS): Placement[] {
  const out: Placement[] = [];
  for (const key of grid.frontier()) {
    const x = keyX(key);
    const y = keyY(key);
    for (const r of rots) if (grid.fits(t, x, y, r)) out.push({ x, y, r });
  }
  return out;
}

/** 자리마다 맞는 방향들 (화면에서 반짝이는 자리) */
export function spotsFor(grid: Grid, t: number): Map<number, Rot[]> {
  const out = new Map<number, Rot[]>();
  for (const key of grid.frontier()) {
    const x = keyX(key);
    const y = keyY(key);
    const rots = ROTS.filter((r) => grid.fits(t, x, y, r));
    if (rots.length > 0) out.set(key, rots);
  }
  return out;
}

export function canPlaceTile(grid: Grid, t: number): boolean {
  for (const key of grid.frontier()) {
    const x = keyX(key);
    const y = keyY(key);
    for (const r of ROTS) if (grid.fits(t, x, y, r)) return true;
  }
  return false;
}

/** 손에 든 조각 중 하나라도 놓을 수 있는지 */
export function canPlaceAny(state: VillageState, player: number, grid: Grid = gridOf(state)): boolean {
  return state.players[player].hand.some((t) => canPlaceTile(grid, t));
}

/** 놓을 수 없어 버려야 하는 상황인지 (지금 차례 사람) */
export function mustDiscard(state: VillageState): boolean {
  return state.phase === 'place' && state.stack.length > 0 && !canPlaceAny(state, state.current);
}

// ------------------------------------------------------------------ 장승

/** 장승 조각을 놓았을 때 점수: 맞닿은 이웃 조각 모서리의 지형 종류(길·냇물·논) 수 */
export function jangseungScore(grid: Grid, index: number): { points: number; kinds: FeatureKind[] } {
  const p = grid.tiles[index];
  const kinds = new Set<FeatureKind>();
  for (let s = 0; s < 4; s++) {
    const j = grid.get(p.x + DX[s], p.y + DY[s]);
    if (j === undefined) continue;
    const q = grid.tiles[j];
    const e = EDGES[q.t][q.r][opposite(s)];
    if (e !== 'field') kinds.add(e);
  }
  const order: FeatureKind[] = ['path', 'stream', 'paddy'];
  const list = order.filter((k) => kinds.has(k));
  return { points: list.length, kinds: list };
}

// ------------------------------------------------------------------ 깃발

export interface FlagChoice {
  seg: number;
  kind: FeatureKind;
  /** 꽂을 수 있는지 */
  ok: boolean;
  /** 못 꽂는 까닭 */
  reason: string | null;
  feature: FeatureInfo;
}

/** 방금 놓은 조각의 지형마다 깃발을 꽂을 수 있는지 */
export function flagChoices(state: VillageState, grid: Grid = gridOf(state)): FlagChoice[] {
  if (state.placed === null) return [];
  const n = state.players.length;
  const p = state.board[state.placed];
  const hasFlags = state.players[state.current].flags > 0;
  return TILES[p.t].segs.map((seg, i) => {
    const feature = grid.trace(state.placed!, i, n);
    const taken = feature.flags.some((c) => c > 0);
    const ok = hasFlags && !taken;
    const reason = !hasFlags ? '깃발이 남지 않았어요' : taken ? '이미 깃발이 있어요' : null;
    return { seg: i, kind: seg.kind, ok, reason, feature };
  });
}

// ------------------------------------------------------------------ 게임 만들기

export function createGame(setup: VillageSetup, rng: Rng = Math.random): VillageState {
  const options: VillageOptions = { ...DEFAULT_OPTIONS, ...setup.options };
  const players: Player[] = [];
  setup.seats.forEach((seat, i) => {
    if (seat.kind === 'empty') return;
    players.push({
      seat: i as SeatIndex,
      kind: seat.kind,
      name: seat.name.trim() || SEAT_COLORS[i as SeatIndex].name,
      score: 0,
      flags: options.flags,
      hand: [],
      stats: emptyStats(),
    });
  });
  if (players.length < 2) throw new Error('플레이어가 2명 이상 필요합니다.');
  const stack = shuffle(deckList(options.jangseung), rng);
  const first = randomInt(players.length, rng);
  for (let k = 0; k < options.hand; k++) {
    for (let j = 0; j < players.length; j++) players[(first + j) % players.length].hand.push(stack.pop()!);
  }
  const s: VillageState = {
    players,
    options,
    board: [{ t: START_TILE, x: 0, y: 0, r: 0, flag: null, by: null }],
    stack,
    discarded: [],
    phase: 'place',
    current: first,
    placed: null,
    turn: 1,
    moves: 0,
    lastTurn: null,
    winners: [],
    events: [],
    nextEventId: 1,
    log: [],
    nextLogId: 1,
  };
  emit(s, { type: 'start', first });
  addLog(s, null, `마을 어귀에서 지도를 그리기 시작해요. 조각 ${stack.length + players.length * options.hand}장`);
  addLog(s, players[first].seat, `${withJosa(nameOf(s, first), '이/가')} 먼저 해요.`);
  return s;
}

// ------------------------------------------------------------------ 행동

function place(state: VillageState, a: Extract<VillageAction, { type: 'place' }>): VillageState {
  if (state.phase !== 'place') return state;
  const me = state.current;
  const hand = state.players[me].hand;
  if (!Number.isInteger(a.hand) || a.hand < 0 || a.hand >= hand.length) return state;
  if (!Number.isInteger(a.x) || !Number.isInteger(a.y) || !ROTS.includes(a.r)) return state;
  if (Math.abs(a.x) > 400 || Math.abs(a.y) > 400) return state;
  const t = hand[a.hand];
  const grid = gridOf(state);
  if (!grid.fits(t, a.x, a.y, a.r)) return state;

  const s = draft(state);
  const p = s.players[me];
  p.hand.splice(a.hand, 1);
  p.stats.tiles += 1;
  s.board.push({ t, x: a.x, y: a.y, r: a.r, flag: null, by: me });
  const index = s.board.length - 1;
  s.moves += 1;
  s.placed = index;
  s.lastTurn = { player: me, t, flag: null, gains: [] };
  emit(s, { type: 'place', player: me, index });
  addLog(s, p.seat, `${nameOf(s, me)}: ${withJosa(TILES[t].name, '을/를')} 놓았어요.`);

  const after = gridOf(s);
  if (s.options.jangseung && isJangseungTile(t)) {
    const js = jangseungScore(after, index);
    emit(s, { type: 'jangseung', player: me, index, points: js.points, kinds: js.kinds });
    if (js.points > 0) {
      p.score += js.points;
      p.stats.jangseung += js.points;
      s.lastTurn.gains.push({ player: me, points: js.points });
      addLog(s, p.seat, `🪵 장승: 이웃에 ${js.kinds.map((k) => FEATURE_NAMES[k]).join('·')} → +${js.points}점`);
    } else {
      addLog(s, p.seat, '🪵 장승 둘레에 길·냇물·논이 없어서 점수가 없어요.');
    }
  }

  if (flagChoices(s, after).some((c) => c.ok)) {
    s.phase = 'flag';
    return s;
  }
  finishTurn(s);
  return s;
}

function plantFlag(state: VillageState, seg: number): VillageState {
  if (state.phase !== 'flag' || state.placed === null) return state;
  const choice = flagChoices(state).find((c) => c.seg === seg);
  if (!choice || !choice.ok) return state;
  const s = draft(state);
  const me = s.current;
  const p = s.players[me];
  s.board[s.placed!].flag = { seg, player: me };
  p.flags -= 1;
  p.stats.flagsPlanted += 1;
  if (s.lastTurn) s.lastTurn.flag = choice.kind;
  emit(s, { type: 'flag', player: me, index: s.placed!, seg });
  addLog(s, p.seat, `🚩 ${FEATURE_NAMES[choice.kind]}에 깃발을 꽂았어요. (${choice.feature.tiles}칸)`);
  finishTurn(s);
  return s;
}

function skipFlag(state: VillageState): VillageState {
  if (state.phase !== 'flag') return state;
  const s = draft(state);
  emit(s, { type: 'skipFlag', player: s.current });
  finishTurn(s);
  return s;
}

function discard(state: VillageState, handIndex: number): VillageState {
  if (!mustDiscard(state)) return state;
  const me = state.current;
  if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= state.players[me].hand.length) return state;
  const s = draft(state);
  const p = s.players[me];
  const [t] = p.hand.splice(handIndex, 1);
  s.discarded.push(t);
  emit(s, { type: 'discard', player: me, t });
  addLog(s, p.seat, `${nameOf(s, me)}: 놓을 곳이 없어서 ${withJosa(TILES[t].name, '을/를')} 버리고 새로 뽑았어요.`);
  if (s.stack.length > 0) p.hand.push(s.stack.pop()!);
  s.turn += 1;
  // 그래도 놓을 곳이 없고 더미가 비었으면 다음 사람에게
  if (s.stack.length === 0 && !canPlaceAny(s, me)) advance(s, me);
  return s;
}

/** 놓은 조각이 완성한 지형을 셈하고, 새 조각을 뽑고, 다음 사람에게 */
function finishTurn(s: VillageState): void {
  const index = s.placed!;
  const me = s.current;
  const n = s.players.length;
  const grid = gridOf(s);
  const done = new Set<string>();
  const def = TILES[s.board[index].t];
  def.segs.forEach((_, seg) => {
    const f = grid.trace(index, seg, n);
    const key = `${f.nodes[0][0]}:${f.nodes[0][1]}`;
    if (done.has(key) || !f.complete) return;
    done.add(key);
    scoreComplete(s, f);
  });
  s.placed = null;
  const p = s.players[me];
  while (p.hand.length < s.options.hand && s.stack.length > 0) p.hand.push(s.stack.pop()!);
  advance(s, me);
}

function scoreComplete(s: VillageState, f: FeatureInfo): void {
  const winners = majority(f.flags);
  const returned: { index: number; seg: number; player: number }[] = [];
  for (const [i, seg] of f.nodes) {
    const flag = s.board[i].flag;
    if (flag && flag.seg === seg) {
      returned.push({ index: i, seg, player: flag.player });
      s.players[flag.player].flags += 1;
      s.board[i].flag = null;
    }
  }
  for (const w of winners) {
    const p = s.players[w];
    p.score += f.points;
    p.stats[f.kind] += f.points;
    p.stats.completed += 1;
    s.lastTurn?.gains.push({ player: w, points: f.points });
  }
  emit(s, { type: 'complete', kind: f.kind, nodes: f.nodes, tiles: f.tiles, points: f.points, winners, returned });
  const what = `${FEATURE_NAMES[f.kind]} 완성 (${f.tiles}칸${f.fish ? ` · 물고기 ${f.fish}` : ''}${f.crows ? ` · 허수아비 ${f.crows}` : ''})`;
  if (winners.length === 0) addLog(s, null, `✨ ${what} — 깃발이 없어서 점수는 없어요.`);
  else
    winners.forEach((w) => addLog(s, s.players[w].seat, `✨ ${what} → ${withJosa(nameOf(s, w), '이/가')} +${f.points}점${winners.length > 1 ? ' (같이 받아요)' : ''}`));
}

/**
 * from 다음 사람부터 차례를 찾는다.
 * 더미가 남았으면 다음 사람이 바로 차례 (놓을 곳이 없으면 버리고 뽑는다).
 * 더미가 비었으면 놓을 수 있는 조각을 든 사람만 하고, 아무도 없으면 끝.
 */
function advance(s: VillageState, from: number): void {
  const n = s.players.length;
  const grid = gridOf(s);
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    const p = s.players[i];
    if (s.stack.length > 0 || canPlaceAny(s, i, grid)) {
      s.current = i;
      s.phase = 'place';
      s.turn += 1;
      return;
    }
    if (p.hand.length > 0 && k < n) {
      emit(s, { type: 'pass', player: i });
      addLog(s, p.seat, `${nameOf(s, i)}: 놓을 수 있는 조각이 없어서 지나가요.`);
    }
  }
  endGame(s);
}

function endGame(s: VillageState): void {
  const n = s.players.length;
  const grid = gridOf(s);
  for (const f of allFeatures(grid, n)) {
    if (f.complete) continue;
    const winners = majority(f.flags);
    if (winners.length === 0) continue;
    const points = Math.floor(f.points / 2);
    for (const w of winners) {
      s.players[w].score += points;
      s.players[w].stats.final += points;
    }
    emit(s, { type: 'final', kind: f.kind, nodes: f.nodes, tiles: f.tiles, points, winners });
    if (points > 0) winners.forEach((w) => addLog(s, s.players[w].seat, `미완성 ${FEATURE_NAMES[f.kind]} ${f.tiles}칸 → ${nameOf(s, w)} +${points}점 (반)`));
  }
  s.phase = 'gameover';
  s.placed = null;
  const top = Math.max(...s.players.map((p) => p.score));
  s.winners = s.players.map((p, i) => (p.score === top ? i : -1)).filter((i) => i >= 0);
  s.turn += 1;
  emit(s, { type: 'gameover', winners: s.winners });
  const names = s.winners.map((w) => nameOf(s, w)).join(', ');
  addLog(s, s.winners.length === 1 ? s.players[s.winners[0]].seat : null, `🏆 지도 완성! ${names} ${top}점으로 ${s.winners.length > 1 ? '공동 ' : ''}우승!`);
}

/**
 * 행동을 적용한 새 상태. 할 수 없는 행동이면 원래 상태를 그대로 돌려준다. (state는 바꾸지 않는다)
 */
export function applyAction(state: VillageState, action: VillageAction): VillageState {
  switch (action.type) {
    case 'place':
      return place(state, action);
    case 'flag':
      return plantFlag(state, action.seg);
    case 'skipFlag':
      return skipFlag(state);
    case 'discard':
      return discard(state, action.hand);
  }
  return state;
}

// ------------------------------------------------------------------ 결과

/** 점수 높은 순 (같으면 완성 지형이 많은 순, 그다음 자리 순) */
export function rankings(state: VillageState): number[] {
  return state.players
    .map((_, i) => i)
    .sort((a, b) => {
      const pa = state.players[a];
      const pb = state.players[b];
      return pb.score - pa.score || pb.stats.completed - pa.stats.completed || a - b;
    });
}

/** 지도 범위 (조각들의 가장자리 좌표) */
export function boardBounds(board: readonly { x: number; y: number }[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of board) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY };
}

/** 모든 조각이 제자리에 있는지 (불러오기 검사·테스트용): 지도 + 더미 + 손 + 버린 것 = 처음 조각 + 더미 전체 */
export function tilesAccountedFor(state: VillageState): boolean {
  const all = [...state.board.slice(1).map((p) => p.t), ...state.stack, ...state.discarded, ...state.players.flatMap((p) => p.hand)].sort((a, b) => a - b);
  const want = deckList(state.options.jangseung).sort((a, b) => a - b);
  return state.board[0]?.t === START_TILE && all.length === want.length && all.every((t, i) => t === want[i]);
}

export { cellKey };
