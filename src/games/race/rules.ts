import {
  GOAL,
  HOME_COLUMN_START,
  LAST_TRACK_PROGRESS,
  PIECES_PER_PLAYER,
  SEAT_COLORS,
  YARD,
  absoluteSquare,
  isSafeSquare,
} from './board';
import { withJosa } from '../../lib/korean';
import type {
  Capture,
  GameSetup,
  GameState,
  LogEntry,
  Move,
  Player,
  Rng,
  RuleOptions,
  SeatIndex,
} from './types';

export const CLASSIC_RULES: RuleOptions = {
  needSixToEnter: true,
  bonusOnSix: true,
  threeSixesEndsTurn: true,
  bonusOnCaptureOrFinish: true,
  safeSquares: true,
  exactFinish: true,
  stopAtFirstWinner: false,
};

export const EASY_RULES: RuleOptions = {
  needSixToEnter: false,
  bonusOnSix: true,
  threeSixesEndsTurn: false,
  bonusOnCaptureOrFinish: true,
  safeSquares: true,
  exactFinish: false,
  stopAtFirstWinner: false,
};

const MAX_LOG = 60;

export function activeSeatCount(setup: GameSetup): number {
  return setup.seats.filter((s) => s.kind !== 'empty').length;
}

export function playerLabel(player: Player): string {
  return player.name || SEAT_COLORS[player.seat].name;
}

function addLog(state: GameState, seat: SeatIndex | null, text: string): GameState {
  const entry: LogEntry = { id: state.nextLogId, seat, text };
  const log = [...state.log, entry].slice(-MAX_LOG);
  return { ...state, log, nextLogId: state.nextLogId + 1 };
}

/** 게임을 새로 만든다. 첫 차례는 rng로 정한다. */
export function createGame(setup: GameSetup, rng: Rng = Math.random): GameState {
  const players: Player[] = [];
  setup.seats.forEach((seat, i) => {
    if (seat.kind === 'empty') return;
    players.push({
      seat: i as SeatIndex,
      kind: seat.kind,
      name: seat.name.trim() || SEAT_COLORS[i as SeatIndex].name,
      pieces: Array.from({ length: PIECES_PER_PLAYER }, () => YARD),
    });
  });
  if (players.length < 2) {
    throw new Error('플레이어가 2명 이상 필요합니다.');
  }
  const current = Math.min(players.length - 1, Math.floor(rng() * players.length));
  const state: GameState = {
    players,
    rules: { ...setup.rules },
    current,
    phase: 'rolling',
    dice: null,
    sixesInRow: 0,
    passKeepsTurn: false,
    rankings: [],
    log: [],
    nextLogId: 1,
    lastMove: null,
  };
  return addLog(state, players[current].seat, `${playerLabel(players[current])}부터 시작합니다.`);
}

export function rollDieValue(rng: Rng = Math.random): number {
  return Math.min(6, Math.floor(rng() * 6) + 1);
}

export function isPlayerFinished(player: Player): boolean {
  return player.pieces.every((p) => p >= GOAL);
}

/** 상대 말 중 해당 절대 칸에 있는 말 목록 */
function opponentsAt(state: GameState, playerIndex: number, abs: number): Capture[] {
  const found: Capture[] = [];
  state.players.forEach((other, oi) => {
    if (oi === playerIndex) return;
    other.pieces.forEach((p, pi) => {
      if (p >= 0 && p <= LAST_TRACK_PROGRESS && absoluteSquare(other.seat, p) === abs) {
        found.push({ playerIndex: oi, pieceIndex: pi, from: p });
      }
    });
  });
  return found;
}

/** 말 하나를 주사위 수만큼 움직였을 때의 결과. 움직일 수 없으면 null. */
export function moveForPiece(state: GameState, playerIndex: number, pieceIndex: number, dice: number): Move | null {
  const player = state.players[playerIndex];
  const from = player.pieces[pieceIndex];
  const { rules } = state;
  if (from >= GOAL) return null;

  let to: number;
  let enters = false;
  if (from === YARD) {
    if (rules.needSixToEnter && dice !== 6) return null;
    to = 0;
    enters = true;
  } else {
    to = from + dice;
    if (to > GOAL) {
      if (rules.exactFinish) return null;
      to = GOAL;
    }
  }

  let captures: Capture[] = [];
  if (to <= LAST_TRACK_PROGRESS) {
    const abs = absoluteSquare(player.seat, to);
    if (!(rules.safeSquares && isSafeSquare(abs))) {
      captures = opponentsAt(state, playerIndex, abs);
    }
  }

  return { playerIndex, pieceIndex, from, to, enters, finishes: to === GOAL, captures };
}

/** 현재 차례에 둘 수 있는 모든 수 */
export function legalMoves(state: GameState): Move[] {
  if (state.phase !== 'choosing' || state.dice === null) return [];
  return movesForDice(state, state.current, state.dice);
}

export function movesForDice(state: GameState, playerIndex: number, dice: number): Move[] {
  const moves: Move[] = [];
  state.players[playerIndex].pieces.forEach((_, pi) => {
    const m = moveForPiece(state, playerIndex, pi, dice);
    if (m) moves.push(m);
  });
  return moves;
}

function nextActivePlayer(state: GameState, from: number): number {
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (from + step) % n;
    if (!state.rankings.includes(idx)) return idx;
  }
  return from;
}

function startTurn(state: GameState, playerIndex: number): GameState {
  return { ...state, current: playerIndex, phase: 'rolling', sixesInRow: 0, passKeepsTurn: false };
}

/** 주사위를 굴린 결과를 반영한다. */
export function applyRoll(state: GameState, dice: number): GameState {
  if (state.phase !== 'rolling') return state;
  const player = state.players[state.current];
  const who = playerLabel(player);
  const sixesInRow = dice === 6 ? state.sixesInRow + 1 : 0;
  let next: GameState = { ...state, dice, sixesInRow, lastMove: null };
  next = addLog(next, player.seat, `${who}: 주사위 ${dice}`);

  if (state.rules.threeSixesEndsTurn && sixesInRow >= 3) {
    next = addLog(next, player.seat, `6이 세 번 연속! ${who}의 차례가 끝납니다.`);
    return { ...next, phase: 'passing', passKeepsTurn: false };
  }

  const moves = movesForDice(next, state.current, dice);
  if (moves.length === 0) {
    const keeps = dice === 6 && state.rules.bonusOnSix;
    const allInYard = player.pieces.every((p) => p === YARD || p >= GOAL);
    const reason = allInYard && state.rules.needSixToEnter ? '6이 나와야 출발할 수 있어요.' : '움직일 수 있는 말이 없어요.';
    next = addLog(next, player.seat, reason + (keeps ? ' 한 번 더!' : ''));
    return { ...next, phase: 'passing', passKeepsTurn: keeps };
  }
  return { ...next, phase: 'choosing' };
}

/** passing 단계를 끝내고 다음 차례로 넘어간다. */
export function advanceTurn(state: GameState): GameState {
  if (state.phase !== 'passing') return state;
  if (state.passKeepsTurn) {
    return { ...state, phase: 'rolling', passKeepsTurn: false };
  }
  return startTurn(state, nextActivePlayer(state, state.current));
}

/** 말을 움직인다. move는 legalMoves()가 돌려준 것이어야 한다. */
export function applyMove(state: GameState, move: Move): GameState {
  if (state.phase !== 'choosing' || move.playerIndex !== state.current) return state;
  const valid = legalMoves(state).some((m) => m.pieceIndex === move.pieceIndex);
  if (!valid) return state;
  // 상태가 바뀌었을 수 있으므로 다시 계산한다.
  const actual = moveForPiece(state, move.playerIndex, move.pieceIndex, state.dice!)!;

  const players = state.players.map((p) => ({ ...p, pieces: [...p.pieces] }));
  const mover = players[actual.playerIndex];
  mover.pieces[actual.pieceIndex] = actual.to;
  for (const c of actual.captures) {
    players[c.playerIndex].pieces[c.pieceIndex] = YARD;
  }

  let next: GameState = { ...state, players, lastMove: actual };
  const who = playerLabel(mover);

  if (actual.captures.length > 0) {
    const victims = [...new Set(actual.captures.map((c) => playerLabel(players[c.playerIndex])))].join(', ');
    next = addLog(next, mover.seat, `${withJosa(who, '이/가')} ${victims}의 말을 잡았어요!`);
  } else if (actual.enters) {
    next = addLog(next, mover.seat, `${who}의 말이 출발했어요.`);
  } else if (actual.from <= LAST_TRACK_PROGRESS && actual.to >= HOME_COLUMN_START && actual.to < GOAL) {
    next = addLog(next, mover.seat, `${who}의 말이 결승 통로에 들어갔어요.`);
  }
  if (actual.finishes) {
    const done = mover.pieces.filter((p) => p >= GOAL).length;
    next = addLog(next, mover.seat, `${who}의 말이 골인! (${done}/${PIECES_PER_PLAYER})`);
  }

  if (isPlayerFinished(mover)) {
    const rankings = [...next.rankings, actual.playerIndex];
    next = { ...next, rankings };
    next = addLog(next, mover.seat, `🎉 ${who} ${rankings.length}등!`);
    const remaining = players.map((_, i) => i).filter((i) => !rankings.includes(i));
    if (state.rules.stopAtFirstWinner || remaining.length <= 1) {
      return finishGame(next);
    }
    return startTurn(next, nextActivePlayer(next, actual.playerIndex));
  }

  const bonus =
    (state.dice === 6 && state.rules.bonusOnSix) ||
    ((actual.captures.length > 0 || actual.finishes) && state.rules.bonusOnCaptureOrFinish);
  if (bonus) {
    next = addLog(next, mover.seat, '한 번 더!');
    return { ...next, phase: 'rolling' };
  }
  return startTurn(next, nextActivePlayer(next, actual.playerIndex));
}

/** 남은 플레이어의 순위를 (골인한 말 수, 진행도 합) 기준으로 정하고 게임을 끝낸다. */
function finishGame(state: GameState): GameState {
  const remaining = state.players
    .map((_, i) => i)
    .filter((i) => !state.rankings.includes(i))
    .sort((a, b) => score(state.players[b]) - score(state.players[a]));
  return { ...state, rankings: [...state.rankings, ...remaining], phase: 'gameover' };
}

function score(player: Player): number {
  return player.pieces.reduce((sum, p) => sum + (p === YARD ? 0 : p + 1), 0);
}
