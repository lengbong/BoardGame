import { withJosa } from '../../lib/korean';
import { SEAT_COLORS } from '../common/players';
import { analyzeSet } from './sets';
import { MELD_POINTS, RACK_SIZE, createPool, rackPoints, shuffle } from './tiles';
import type { Player, Rng, SeatIndex, TableSet, Tile, TilesAction, TilesOptions, TilesSetup, TilesState } from './types';

export const ROUND_CHOICES = [2, 3, 5];
export const TIME_CHOICES = [60, 120];

export const DEFAULT_OPTIONS: TilesOptions = {
  rearrange: true,
  initialMeld: true,
  turnTime: 0,
  handView: 'cover',
  endMode: 'single',
  rounds: 3,
};

const MAX_LOG = 60;

export function playerName(player: Player): string {
  return player.name || SEAT_COLORS[player.seat].name;
}

function addLog(s: TilesState, seat: SeatIndex | null, text: string): void {
  s.log = [...s.log, { id: s.nextLogId, seat, text }].slice(-MAX_LOG);
  s.nextLogId += 1;
}

function nextTurn(s: TilesState): void {
  s.current = (s.current + 1) % s.players.length;
  s.turn += 1;
}

/** 이번 차례에 첫 등록을 해야 하는지 */
export function needsMeld(state: TilesState, index = state.current): boolean {
  return state.options.initialMeld && !state.players[index].melded;
}

function startRound(s: TilesState, starter: number, rng: Rng): void {
  s.round += 1;
  const pool = shuffle(createPool(), rng);
  for (const p of s.players) {
    p.rack = [];
    p.melded = false;
  }
  for (let k = 0; k < RACK_SIZE; k++) for (const p of s.players) p.rack.push(pool.pop()!);
  s.pool = pool;
  s.table = [];
  s.starter = starter;
  s.current = starter;
  s.turn += 1;
  s.passesInRow = 0;
  s.lastMove = null;
  s.roundResult = null;
  s.phase = 'play';
  const who = withJosa(playerName(s.players[starter]), '이/가');
  addLog(s, s.players[starter].seat, s.options.endMode === 'rounds' ? `${s.round}번째 판! ${who} 먼저 시작해요.` : `${who} 먼저 시작해요.`);
}

export function createGame(setup: TilesSetup, rng: Rng = Math.random): TilesState {
  const players: Player[] = [];
  setup.seats.forEach((seat, i) => {
    if (seat.kind === 'empty') return;
    players.push({
      seat: i as SeatIndex,
      kind: seat.kind,
      name: seat.name.trim() || SEAT_COLORS[i as SeatIndex].name,
      rack: [],
      melded: false,
      score: 0,
    });
  });
  if (players.length < 2) throw new Error('플레이어가 2명 이상 필요합니다.');
  const starter = Math.min(players.length - 1, Math.floor(rng() * players.length));
  const s: TilesState = {
    players,
    options: { ...DEFAULT_OPTIONS, ...setup.options },
    round: 0,
    starter,
    current: starter,
    pool: [],
    table: [],
    nextSetId: 1,
    phase: 'play',
    turn: 0,
    passesInRow: 0,
    lastMove: null,
    roundResult: null,
    rankings: [],
    log: [],
    nextLogId: 1,
  };
  startRound(s, starter, rng);
  return s;
}

export type CommitCheck =
  | { ok: true; table: TableSet[]; played: Tile[]; meldPoints: number | null }
  | { ok: false; reason: string; played: number; meldPoints: number | null };

const setKey = (tiles: Tile[]) =>
  tiles
    .map((t) => t.id)
    .sort((a, b) => a - b)
    .join(',');

/**
 * 지금 차례인 사람이 제출한 판이 규칙에 맞는지 확인한다.
 * - 판에 있던 타일은 모두 판에 남아 있어야 한다 (내 타일 칸으로 가져올 수 없음)
 * - 내 타일을 1개 이상 내야 한다
 * - 모든 줄이 올바라야 한다
 * - 첫 등록: 판에 있던 줄은 그대로 두고, 내 타일만으로 만든 줄의 합이 30 이상
 * - 간단 규칙: 판에 있던 줄은 나누거나 합칠 수 없고, 내 타일을 붙이기만 한다
 */
export function checkCommit(state: TilesState, proposal: TableSet[]): CommitCheck {
  const me = state.players[state.current];
  const known = new Map<number, Tile>();
  const oldSetOf = new Map<number, number>();
  for (const set of state.table) {
    for (const t of set.tiles) {
      known.set(t.id, t);
      oldSetOf.set(t.id, set.id);
    }
  }
  const rackIds = new Set(me.rack.map((t) => t.id));
  for (const t of me.rack) known.set(t.id, t);

  const seen = new Set<number>();
  const played: Tile[] = [];
  const sets: TableSet[] = [];
  for (const set of proposal) {
    if (set.tiles.length === 0) continue;
    const tiles: Tile[] = [];
    for (const t of set.tiles) {
      const real = known.get(t.id);
      if (!real) return { ok: false, reason: '알 수 없는 타일이 있어요', played: played.length, meldPoints: null };
      if (seen.has(t.id)) return { ok: false, reason: '같은 타일이 두 번 있어요', played: played.length, meldPoints: null };
      seen.add(t.id);
      if (rackIds.has(t.id)) played.push(real);
      tiles.push(real);
    }
    sets.push({ id: set.id, tiles });
  }
  for (const id of oldSetOf.keys()) {
    if (!seen.has(id)) return { ok: false, reason: '판에 있던 타일은 가져갈 수 없어요', played: played.length, meldPoints: null };
  }

  // 첫 등록 점수 (내 타일로만 만든 새 줄)
  let meldPoints: number | null = null;
  const meld = needsMeld(state);
  if (meld) {
    const oldKeys = new Set(state.table.map((s) => setKey(s.tiles)));
    meldPoints = 0;
    for (const set of sets) {
      if (oldKeys.has(setKey(set.tiles))) continue;
      if (set.tiles.some((t) => oldSetOf.has(t.id))) {
        return { ok: false, reason: '첫 등록 때는 판에 있던 줄을 건드릴 수 없어요', played: played.length, meldPoints: null };
      }
      const a = analyzeSet(set.tiles);
      if (a.valid) meldPoints += a.points;
    }
  }

  if (played.length === 0) return { ok: false, reason: '타일을 1개 이상 내야 해요', played: 0, meldPoints };
  const bad = sets.find((s) => !analyzeSet(s.tiles).valid);
  if (bad) return { ok: false, reason: `올바르지 않은 줄이 있어요: ${analyzeSet(bad.tiles).reason}`, played: played.length, meldPoints };
  if (meld && meldPoints! < MELD_POINTS) {
    return { ok: false, reason: `첫 등록은 내 타일로 ${MELD_POINTS}점 이상이어야 해요 (지금 ${meldPoints}점)`, played: played.length, meldPoints };
  }

  if (!state.options.rearrange) {
    const oldSizes = new Map(state.table.map((s) => [s.id, s.tiles.length]));
    for (const set of sets) {
      const from = new Set(set.tiles.filter((t) => oldSetOf.has(t.id)).map((t) => oldSetOf.get(t.id)!));
      if (from.size > 1) return { ok: false, reason: '간단 규칙에서는 판의 줄을 합칠 수 없어요', played: played.length, meldPoints };
      if (from.size === 1) {
        const id = [...from][0];
        const count = set.tiles.filter((t) => oldSetOf.get(t.id) === id).length;
        if (count !== oldSizes.get(id)) return { ok: false, reason: '간단 규칙에서는 판의 줄을 나눌 수 없어요', played: played.length, meldPoints };
      }
    }
  }

  return { ok: true, table: sets, played, meldPoints };
}

/** 판이 끝났을 때 점수 계산. winner가 null이면 아무도 못 내서 끝난 경우 */
function finishRound(s: TilesState, winnerIndex: number | null): void {
  const points = s.players.map((p) => rackPoints(p.rack));
  let winner = winnerIndex;
  const blocked = winner === null;
  if (winner === null) {
    winner = 0;
    s.players.forEach((p, i) => {
      const w = s.players[winner!];
      if (points[i] < points[winner!] || (points[i] === points[winner!] && p.rack.length < w.rack.length)) winner = i;
    });
  }
  const w = winner;
  const deltas = points.map((v, i) => (i === w ? points.reduce((sum, x, k) => (k === w ? sum : sum + x), 0) : -v));
  s.players.forEach((p, i) => (p.score += deltas[i]));
  s.roundResult = { winner: w, blocked, deltas, rackPoints: points };

  const name = withJosa(playerName(s.players[w]), '이/가');
  addLog(
    s,
    s.players[w].seat,
    blocked ? `더 낼 사람이 없어요. 남은 타일이 가장 적은 ${name} 이겼어요! (+${deltas[w]}점)` : `${name} 타일을 다 냈어요! (+${deltas[w]}점)`,
  );

  const order = s.players.map((_, i) => i);
  if (s.options.endMode === 'single') {
    s.phase = 'gameover';
    s.rankings = order.sort((a, b) => (a === w ? -1 : b === w ? 1 : points[a] - points[b] || a - b));
  } else if (s.round >= s.options.rounds) {
    s.phase = 'gameover';
    s.rankings = order.sort((a, b) => s.players[b].score - s.players[a].score || (a === w ? -1 : b === w ? 1 : a - b));
  } else {
    s.phase = 'roundover';
    return;
  }
  addLog(s, s.players[s.rankings[0]].seat, `🏆 ${withJosa(playerName(s.players[s.rankings[0]]), '이/가')} 우승했어요!`);
}

/** 행동을 적용한 새 상태를 돌려준다. 할 수 없으면 원래 상태를 그대로 돌려준다. */
export function applyAction(state: TilesState, action: TilesAction, rng: Rng = Math.random): TilesState {
  if (action.type === 'nextRound') {
    if (state.phase !== 'roundover') return state;
    const s = structuredClone(state);
    startRound(s, (s.starter + 1) % s.players.length, rng);
    return s;
  }
  if (state.phase !== 'play') return state;
  const me = state.current;

  if (action.type === 'draw') {
    const s = structuredClone(state);
    const p = s.players[me];
    const name = playerName(p);
    if (s.pool.length === 0) {
      s.passesInRow += 1;
      s.lastMove = { player: me, played: [], drew: false, meldPoints: null };
      addLog(s, p.seat, `가져올 타일이 없어서 ${withJosa(name, '이/가')} 넘어가요.`);
      if (s.passesInRow >= s.players.length) {
        finishRound(s, null);
        return s;
      }
    } else {
      p.rack.push(s.pool.pop()!);
      s.passesInRow = 0;
      s.lastMove = { player: me, played: [], drew: true, meldPoints: null };
      addLog(s, p.seat, `${withJosa(name, '이/가')} 타일을 1개 가져왔어요.`);
    }
    nextTurn(s);
    return s;
  }

  const check = checkCommit(state, action.table);
  if (!check.ok) return state;
  const s = structuredClone(state);
  const p = s.players[me];
  const playedIds = new Set(check.played.map((t) => t.id));
  const oldSetIds = new Set(state.table.map((set) => set.id));
  const used = new Set<number>();
  s.table = check.table.map((set) => {
    let id = set.id;
    if (!oldSetIds.has(id) || used.has(id)) id = s.nextSetId++;
    used.add(id);
    return { id, tiles: analyzeSet(set.tiles).arranged };
  });
  p.rack = p.rack.filter((t) => !playedIds.has(t.id));
  const firstMeld = needsMeld(state);
  p.melded = true;
  s.passesInRow = 0;
  s.lastMove = { player: me, played: [...playedIds], drew: false, meldPoints: firstMeld ? check.meldPoints : null };
  const name = playerName(p);
  addLog(
    s,
    p.seat,
    firstMeld ? `${name}: 첫 등록 성공! 타일 ${playedIds.size}개 (${check.meldPoints}점)` : `${name}: 타일 ${playedIds.size}개를 냈어요.`,
  );
  if (p.rack.length === 0) {
    finishRound(s, me);
    return s;
  }
  nextTurn(s);
  return s;
}
