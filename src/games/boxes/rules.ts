import { withJosa } from '../../lib/korean';
import { SEAT_COLORS } from '../common/players';
import type { BoxesAction, BoxesOptions, BoxesSetup, BoxesState, GameEvent, Player, Rng, SeatIndex } from './types';

/* ================================================================
   판의 번호 매기기 (n = 한 변의 상자 수)
   - 점: (r, c), 0 ≤ r, c ≤ n
   - 가로선 hLine(r, c): 점 (r, c) — (r, c+1), 0 ≤ r ≤ n, 0 ≤ c < n → 번호 r·n + c
   - 세로선 vLine(r, c): 점 (r, c) — (r+1, c), 0 ≤ r < n, 0 ≤ c ≤ n → 번호 n(n+1) + r(n+1) + c
   - 상자 (r, c): 번호 r·n + c, 위 hLine(r,c) · 아래 hLine(r+1,c) · 왼쪽 vLine(r,c) · 오른쪽 vLine(r,c+1)
   ================================================================ */

export const BOARD_SIZES = [3, 4, 5, 6] as const;

export const DEFAULT_OPTIONS: BoxesOptions = { size: 4, noExtraTurn: false, warnings: true };

/** 사람 수에 맞는 판 크기: 2명은 4×4(16칸), 3~4명은 5×5(25칸) — 사람마다 상자가 너무 적지 않게 */
export function recommendedSize(playerCount: number): number {
  return playerCount >= 3 ? 5 : 4;
}

export function lineCount(n: number): number {
  return 2 * n * (n + 1);
}

export function boxCount(n: number): number {
  return n * n;
}

export function hLine(n: number, r: number, c: number): number {
  return r * n + c;
}

export function vLine(n: number, r: number, c: number): number {
  return n * (n + 1) + r * (n + 1) + c;
}

export function isHorizontal(n: number, e: number): boolean {
  return e < n * (n + 1);
}

/** 선의 위치: 가로선이면 왼쪽 점, 세로선이면 위쪽 점의 (r, c) */
export function lineInfo(n: number, e: number): { horizontal: boolean; r: number; c: number } {
  if (isHorizontal(n, e)) return { horizontal: true, r: Math.floor(e / n), c: e % n };
  const k = e - n * (n + 1);
  return { horizontal: false, r: Math.floor(k / (n + 1)), c: k % (n + 1) };
}

/** 선 양 끝 점의 (r, c) */
export function lineDots(n: number, e: number): [[number, number], [number, number]] {
  const { horizontal, r, c } = lineInfo(n, e);
  return horizontal ? [[r, c], [r, c + 1]] : [[r, c], [r + 1, c]];
}

export interface Geometry {
  n: number;
  lines: number;
  boxes: number;
  /** 상자마다 [위, 아래, 왼쪽, 오른쪽] 선 번호 */
  boxLines: number[][];
  /** 선마다 붙어 있는 상자 (1개 또는 2개) */
  lineBoxes: number[][];
}

const geometryCache = new Map<number, Geometry>();

export function geometry(n: number): Geometry {
  const cached = geometryCache.get(n);
  if (cached) return cached;
  const lines = lineCount(n);
  const boxLines: number[][] = [];
  const lineBoxes: number[][] = Array.from({ length: lines }, () => []);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const b = r * n + c;
      const ls = [hLine(n, r, c), hLine(n, r + 1, c), vLine(n, r, c), vLine(n, r, c + 1)];
      boxLines.push(ls);
      for (const l of ls) lineBoxes[l].push(b);
    }
  }
  const g: Geometry = { n, lines, boxes: n * n, boxLines, lineBoxes };
  geometryCache.set(n, g);
  return g;
}

export function boxLines(n: number, b: number): number[] {
  return geometry(n).boxLines[b];
}

export function lineBoxes(n: number, e: number): number[] {
  return geometry(n).lineBoxes[e];
}

/** 상자에 그어진 변의 수 (0~4) */
export function boxSides(state: Pick<BoxesState, 'size' | 'lines'>, b: number): number {
  let k = 0;
  for (const l of boxLines(state.size, b)) if (state.lines[l] !== -1) k += 1;
  return k;
}

/** 아직 긋지 않은 선 */
export function openLines(state: Pick<BoxesState, 'lines'>): number[] {
  const out: number[] = [];
  state.lines.forEach((p, e) => {
    if (p === -1) out.push(e);
  });
  return out;
}

/** 이 선을 그으면 완성되는 상자 수 */
export function completesCount(state: Pick<BoxesState, 'size' | 'lines'>, e: number): number {
  if (state.lines[e] !== -1) return 0;
  return lineBoxes(state.size, e).filter((b) => boxSides(state, b) === 3).length;
}

/** 이 선을 그으면 세 변이 그어진 상자(다음 사람이 가져갈 수 있는 상자)가 새로 생기는 수 */
export function givesCount(state: Pick<BoxesState, 'size' | 'lines'>, e: number): number {
  if (state.lines[e] !== -1) return 0;
  return lineBoxes(state.size, e).filter((b) => boxSides(state, b) === 2).length;
}

/** 상자를 완성하는 선 */
export function captureLines(state: Pick<BoxesState, 'size' | 'lines'>): number[] {
  return openLines(state).filter((e) => completesCount(state, e) > 0);
}

/** 안전한 선: 그어도 세 변짜리 상자가 생기지 않는 선 (붙은 상자가 모두 변 0~1개) */
export function safeLines(state: Pick<BoxesState, 'size' | 'lines'>): number[] {
  return openLines(state).filter((e) => lineBoxes(state.size, e).every((b) => boxSides(state, b) <= 1));
}

/* ================================================================
   게임 진행
   ================================================================ */

const MAX_LOG = 60;

type EventInput = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'id'> : never) : never;

export function playerName(player: Player): string {
  return player.name || SEAT_COLORS[player.seat].name;
}

function nameOf(s: BoxesState, index: number): string {
  return playerName(s.players[index]);
}

function addLog(s: BoxesState, seat: SeatIndex | null, text: string): void {
  s.log = [...s.log, { id: s.nextLogId, seat, text }].slice(-MAX_LOG);
  s.nextLogId += 1;
}

function emit(s: BoxesState, event: EventInput): void {
  s.events.push({ ...event, id: s.nextEventId } as GameEvent);
  s.nextEventId += 1;
}

function draft(state: BoxesState): BoxesState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p })),
    lines: [...state.lines],
    boxes: [...state.boxes],
    history: [...state.history],
    rankings: [...state.rankings],
    ranks: [...state.ranks],
    events: [],
  };
}

export function isValidSize(n: unknown): n is number {
  return typeof n === 'number' && (BOARD_SIZES as readonly number[]).includes(n);
}

export function createGame(setup: BoxesSetup, rng: Rng = Math.random): BoxesState {
  const players: Player[] = [];
  setup.seats.forEach((seat, i) => {
    if (seat.kind === 'empty') return;
    players.push({ seat: i as SeatIndex, kind: seat.kind, name: seat.name.trim() || SEAT_COLORS[i as SeatIndex].name, score: 0 });
  });
  if (players.length < 2) throw new Error('플레이어가 2명 이상 필요합니다.');
  const options: BoxesOptions = { ...DEFAULT_OPTIONS, ...setup.options };
  if (!isValidSize(options.size)) options.size = DEFAULT_OPTIONS.size;
  const n = options.size;
  const starter = Math.min(players.length - 1, Math.floor(rng() * players.length));
  const s: BoxesState = {
    size: n,
    players,
    options,
    starter,
    current: starter,
    lines: Array.from({ length: lineCount(n) }, () => -1),
    boxes: Array.from({ length: boxCount(n) }, () => -1),
    history: [],
    phase: 'play',
    turn: 1,
    safeGone: false,
    rankings: [],
    ranks: [],
    events: [],
    nextEventId: 1,
    log: [],
    nextLogId: 1,
  };
  emit(s, { type: 'turn', player: starter });
  addLog(s, players[starter].seat, `${n}×${n} 판이에요. ${withJosa(nameOf(s, starter), '이/가')} 먼저 시작해요.`);
  return s;
}

/** 점수로 등수를 매긴다. 같은 점수는 같은 등수 (1등이 둘이면 둘 다 1등, 다음은 3등) */
export function computeRanks(scores: number[]): { rankings: number[]; ranks: number[] } {
  const ranks = scores.map((s) => 1 + scores.filter((t) => t > s).length);
  const rankings = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a] || a - b);
  return { rankings, ranks };
}

/** 1등인 사람들 (gameover가 아니면 빈 배열) */
export function winners(state: BoxesState): number[] {
  if (state.phase !== 'gameover') return [];
  return state.ranks.map((r, i) => (r === 1 ? i : -1)).filter((i) => i >= 0);
}

function finish(s: BoxesState): void {
  s.phase = 'gameover';
  const { rankings, ranks } = computeRanks(s.players.map((p) => p.score));
  s.rankings = rankings;
  s.ranks = ranks;
  const top = winners(s);
  emit(s, { type: 'end', winners: top });
  if (top.length === s.players.length) {
    addLog(s, null, `모두 상자 ${s.players[0].score}개로 비겼어요!`);
  } else if (top.length > 1) {
    const names = top.map((i) => nameOf(s, i)).join(', ');
    addLog(s, null, `🏆 ${names} 공동 1등! (상자 ${s.players[top[0]].score}개)`);
  } else {
    const w = top[0];
    addLog(s, s.players[w].seat, `🏆 ${withJosa(nameOf(s, w), '이/가')} 상자 ${s.players[w].score}개로 이겼어요!`);
  }
}

/**
 * 행동을 적용한 새 상태를 돌려준다. 할 수 없는 행동이면 원래 상태를 그대로 돌려준다.
 * (state는 바꾸지 않는다)
 */
export function applyAction(state: BoxesState, action: BoxesAction): BoxesState {
  if (state.phase !== 'play' || action.type !== 'line') return state;
  const n = state.size;
  const e = action.edge;
  if (!Number.isInteger(e) || e < 0 || e >= state.lines.length || state.lines[e] !== -1) return state;

  const s = draft(state);
  const me = s.current;
  const seat = s.players[me].seat;
  const name = nameOf(s, me);
  const gives = givesCount(s, e);
  s.lines[e] = me;
  s.history.push(e);
  emit(s, { type: 'line', player: me, edge: e });

  const done = lineBoxes(n, e).filter((b) => boxSides(s, b) === 4);
  for (const b of done) s.boxes[b] = me;
  s.players[me].score += done.length;
  const over = s.lines.every((p) => p !== -1);

  if (done.length > 0) {
    emit(s, { type: 'box', player: me, boxes: done });
    const again = !over && !s.options.noExtraTurn;
    addLog(s, seat, `${withJosa(name, '이/가')} 상자 ${done.length}개를 완성했어요! (모두 ${s.players[me].score}개)${again ? ' 한 번 더!' : ''}`);
  } else if (gives > 0) {
    addLog(s, seat, `${withJosa(name, '이/가')} 상자의 세 번째 선을 그었어요.`);
  } else {
    addLog(s, seat, `${withJosa(name, '이/가')} 선을 그었어요.`);
  }

  if (over) {
    finish(s);
    return s;
  }

  if (done.length > 0 && !s.options.noExtraTurn) {
    emit(s, { type: 'again', player: me });
  } else {
    s.current = (me + 1) % s.players.length;
    s.turn += 1;
    emit(s, { type: 'turn', player: s.current });
  }

  if (!s.safeGone && safeLines(s).length === 0) {
    s.safeGone = true;
    addLog(s, null, '✏️ 이제 안전한 선이 없어요. 어디에 그어도 상자를 내줘요!');
  }
  return s;
}
