import { withJosa } from '../../lib/korean';
import { SIDE_INFO } from './sides';
import type {
  CaptureInfo,
  MancalaAction,
  MancalaEvent,
  MancalaOptions,
  MancalaPlayer,
  MancalaResult,
  MancalaSetup,
  MancalaState,
  MoveResult,
  SeedCount,
  Side,
  SweepMove,
} from './types';

export const PITS = 6;
export const CELLS = 14;
export const SEED_COUNTS: SeedCount[] = [3, 4, 5, 6];

export const DEFAULT_OPTIONS: MancalaOptions = {
  seeds: 4,
  captureEmpty: false,
  sweep: 'owner',
  undo: true,
};

const MAX_LOG = 80;

type EventInput = MancalaEvent extends infer E ? (E extends MancalaEvent ? Omit<E, 'id'> : never) : never;

/** 그 편의 창고 칸 번호 */
export function storeOf(side: Side): number {
  return side === 0 ? 6 : 13;
}

/** 그 편의 k번째 구멍 (k = 0~5, 그 편이 보기에 왼쪽부터) */
export function pitOf(side: Side, k: number): number {
  return side * 7 + k;
}

export function isStore(index: number): boolean {
  return index === 6 || index === 13;
}

/** 칸의 주인 (구멍과 창고 모두) */
export function ownerOf(index: number): Side {
  return index <= 6 ? 0 : 1;
}

/** 구멍의 건너편 구멍 */
export function oppositeOf(index: number): number {
  return 12 - index;
}

export function other(side: Side): Side {
  return side === 0 ? 1 : 0;
}

/** 그 편 구멍에 남은 씨앗의 합 */
export function sideSeeds(board: readonly number[], side: Side): number {
  const start = side * 7;
  let sum = 0;
  for (let i = start; i < start + PITS; i++) sum += board[i];
  return sum;
}

/** 지금 둘 수 있는 구멍 번호들: 내 구멍 중 씨앗이 있는 곳 */
export function legalPits(board: readonly number[], side: Side): number[] {
  const pits: number[] = [];
  for (let k = 0; k < PITS; k++) if (board[pitOf(side, k)] > 0) pits.push(pitOf(side, k));
  return pits;
}

export function legalMoves(state: MancalaState): number[] {
  return state.phase === 'play' ? legalPits(state.board, state.current) : [];
}

/**
 * 한 수를 둔다 (상태 없이 판만 가지고). 화면·컴퓨터·규칙이 모두 이 함수를 쓴다.
 * - 씨앗을 한 알씩 다음 칸에 넣는다. 내 창고에는 넣고 상대 창고는 건너뛴다. 처음 구멍은 건너뛰지 않는다.
 * - 마지막 씨앗이 내 창고 → 한 번 더
 * - 마지막 씨앗이 비어 있던 내 구멍 + 건너편에 씨앗 있음 → 둘 다 내 창고로 (captureEmpty면 건너편이 비어도 내 한 알을 가져온다)
 * - 한쪽 구멍이 모두 비면 끝: 남은 씨앗을 창고로 옮긴다.
 */
export function simulateMove(board: readonly number[], side: Side, pit: number, options: Pick<MancalaOptions, 'captureEmpty' | 'sweep'>): MoveResult {
  const b = board.slice();
  let seeds = b[pit];
  b[pit] = 0;
  const skip = storeOf(other(side));
  const path: number[] = [];
  let i = pit;
  while (seeds > 0) {
    i = (i + 1) % CELLS;
    if (i === skip) continue;
    b[i] += 1;
    seeds -= 1;
    path.push(i);
  }
  const last = i;
  const myStore = storeOf(side);
  let extra = last === myStore;
  let capture: CaptureInfo | null = null;
  if (!extra && !isStore(last) && ownerOf(last) === side && b[last] === 1) {
    const opposite = oppositeOf(last);
    if (b[opposite] > 0 || options.captureEmpty) {
      const count = b[opposite] + 1;
      b[myStore] += count;
      b[last] = 0;
      b[opposite] = 0;
      capture = { pit: last, opposite, count };
    }
  }

  const sweep: SweepMove[] = [];
  const empty0 = sideSeeds(b, 0) === 0;
  const empty1 = sideSeeds(b, 1) === 0;
  const gameOver = empty0 || empty1;
  const emptied: Side | 'both' | null = empty0 && empty1 ? 'both' : empty0 ? 0 : empty1 ? 1 : null;
  if (gameOver) {
    extra = false;
    // 정통: 그 구멍 주인의 창고로 / 변형: 구멍이 빈 쪽 사람의 창고로
    const emptier: Side = empty0 ? 0 : 1;
    for (let p = 0; p < CELLS; p++) {
      if (isStore(p) || b[p] === 0) continue;
      const to = options.sweep === 'emptier' && !(empty0 && empty1) ? storeOf(emptier) : storeOf(ownerOf(p));
      sweep.push({ from: p, to, count: b[p] });
      b[to] += b[p];
      b[p] = 0;
    }
  }
  return { board: b, path, last, extra, capture, gameOver, emptied, sweep };
}

/** 그 구멍을 고르면 마지막 씨앗이 어디에 떨어지는지 (도움말용) */
export function previewMove(state: MancalaState, pit: number): MoveResult | null {
  if (state.phase !== 'play' || ownerOf(pit) !== state.current || isStore(pit) || state.board[pit] === 0) return null;
  return simulateMove(state.board, state.current, pit, state.options);
}

export function sideName(state: Pick<MancalaState, 'players'>, side: Side): string {
  return state.players[side].name.trim() || SIDE_INFO[side].label;
}

/** 화면에 보여 줄 구멍 번호 (그 편이 보기에 왼쪽부터 1~6) */
export function pitNumber(index: number): number {
  return (index % 7) + 1;
}

export function scoreOf(board: readonly number[], side: Side): number {
  return board[storeOf(side)];
}

function addLog(s: MancalaState, side: Side | null, text: string): void {
  s.log = [...s.log, { id: s.nextLogId, side, text }].slice(-MAX_LOG);
  s.nextLogId += 1;
}

function emit(s: MancalaState, event: EventInput): void {
  s.events.push({ ...event, id: s.nextEventId } as MancalaEvent);
  s.nextEventId += 1;
}

function emptyStats() {
  return { captures: 0, captured: 0, extraTurns: 0 };
}

export function createGame(setup: MancalaSetup): MancalaState {
  const options = { ...DEFAULT_OPTIONS, ...setup.options };
  const board = Array.from({ length: CELLS }, (_, i) => (isStore(i) ? 0 : options.seeds));
  const players = setup.seats.map((s) => ({ kind: s.kind, name: s.name.trim() })) as [MancalaPlayer, MancalaPlayer];
  const s: MancalaState = {
    board,
    options,
    players,
    current: 0,
    phase: 'play',
    turn: 0,
    lastMove: null,
    stats: [emptyStats(), emptyStats()],
    result: null,
    events: [],
    nextEventId: 1,
    log: [],
    nextLogId: 1,
  };
  addLog(s, null, `구멍마다 씨앗 ${options.seeds}개씩, 모두 ${options.seeds * 12}개로 시작해요.`);
  if (options.captureEmpty) addLog(s, null, '변형 규칙: 건너편이 비어도 내 씨앗 한 알은 가져와요.');
  if (options.sweep === 'emptier') addLog(s, null, '변형 규칙: 끝날 때 남은 씨앗은 먼저 빈 쪽이 모두 가져가요.');
  addLog(s, 0, `${withJosa(sideName(s, 0), '이/가')} 먼저 해요.`);
  return s;
}

function finalResult(board: readonly number[], swept: [number, number]): MancalaResult {
  const scores: [number, number] = [scoreOf(board, 0), scoreOf(board, 1)];
  const winner: Side | null = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;
  return { winner, scores, swept };
}

/** 행동을 적용한 새 상태. 둘 수 없는 행동이면 원래 상태를 그대로 돌려준다. */
export function applyAction(state: MancalaState, action: MancalaAction): MancalaState {
  if (action.type !== 'sow' || state.phase !== 'play') return state;
  const side = state.current;
  const pit = action.pit;
  if (!Number.isInteger(pit) || pit < 0 || pit >= CELLS || isStore(pit) || ownerOf(pit) !== side || state.board[pit] === 0) return state;

  const r = simulateMove(state.board, side, pit, state.options);
  const s: MancalaState = {
    ...state,
    board: r.board,
    stats: [{ ...state.stats[0] }, { ...state.stats[1] }],
    events: [],
    turn: state.turn + 1,
    lastMove: { side, pit, last: r.last, extra: r.extra, capture: r.capture },
  };
  const name = sideName(s, side);
  const count = state.board[pit];
  emit(s, { type: 'sow', side, pit, count, path: r.path });
  addLog(s, side, `${name}: ${pitNumber(pit)}번 구멍에서 씨앗 ${count}개를 뿌렸어요.`);

  if (r.capture) {
    const c = r.capture;
    emit(s, { type: 'capture', side, pit: c.pit, opposite: c.opposite, count: c.count });
    s.stats[side].captures += 1;
    s.stats[side].captured += c.count;
    addLog(
      s,
      side,
      c.count > 1
        ? `빈 구멍에서 끝! 건너편 씨앗 ${c.count - 1}개와 함께 ${c.count}개를 창고로 가져왔어요.`
        : '빈 구멍에서 끝! 건너편은 비었지만 씨앗 한 알을 창고로 가져왔어요.',
    );
  }
  if (r.extra) {
    emit(s, { type: 'extra', side });
    s.stats[side].extraTurns += 1;
    addLog(s, side, `창고에서 끝났어요. ${withJosa(name, '이/가')} 한 번 더 해요!`);
  }

  if (r.gameOver) {
    const swept: [number, number] = [0, 0];
    for (const m of r.sweep) swept[ownerOf(m.to)] += m.count;
    addLog(s, null, r.emptied === 'both' ? '양쪽 구멍이 모두 비었어요.' : `${sideName(s, r.emptied ?? side)} 쪽 구멍이 모두 비었어요.`);
    if (r.sweep.length > 0) {
      emit(s, { type: 'sweep', moves: r.sweep });
      const parts = ([0, 1] as Side[]).filter((p) => swept[p] > 0).map((p) => `${sideName(s, p)} 창고에 ${swept[p]}개`);
      addLog(s, null, `남은 씨앗을 정리해요: ${parts.join(', ')}.`);
    }
    s.phase = 'gameover';
    s.result = finalResult(r.board, swept);
    emit(s, { type: 'end', winner: s.result.winner });
    const [a, b] = s.result.scores;
    addLog(s, s.result.winner, s.result.winner === null ? `비겼어요! ${a} : ${b}` : `${sideName(s, s.result.winner)} 승리! ${a} : ${b}`);
    return s;
  }

  if (!r.extra) s.current = other(side);
  return s;
}

/** 그 편이 한 수 앞에서 '한 번 더'를 할 수 있는 구멍 (컴퓨터·도움말용) */
export function extraTurnPits(board: readonly number[], side: Side): number[] {
  return legalPits(board, side).filter((p) => {
    const steps = storeOf(side) - p;
    return board[p] === steps || board[p] === steps + 13;
  });
}
