import { HOME_COLUMN_START, LAST_TRACK_PROGRESS, TRACK_LENGTH, absoluteSquare, isSafeSquare } from './board';
import type { GameState, Move, Rng } from './types';

/** 해당 진행도 위치에서 상대 말이 1~6칸 뒤에 있어 잡힐 수 있는 경우의 수 */
export function dangerAt(state: GameState, playerIndex: number, progress: number): number {
  if (progress < 0 || progress > LAST_TRACK_PROGRESS) return 0;
  const seat = state.players[playerIndex].seat;
  const abs = absoluteSquare(seat, progress);
  if (state.rules.safeSquares && isSafeSquare(abs)) return 0;
  let threats = 0;
  state.players.forEach((other, oi) => {
    if (oi === playerIndex) return;
    for (const p of other.pieces) {
      if (p < 0 || p > LAST_TRACK_PROGRESS) continue;
      const behind = (abs - absoluteSquare(other.seat, p) + TRACK_LENGTH) % TRACK_LENGTH;
      // 상대가 결승 통로로 꺾어 들어가기 전에 이 칸에 닿을 수 있어야 위협이 된다.
      if (behind >= 1 && behind <= 6 && p + behind <= LAST_TRACK_PROGRESS) threats++;
    }
  });
  return threats;
}

/** 수의 좋고 나쁨을 점수로 평가 (높을수록 좋음) */
export function scoreMove(state: GameState, move: Move): number {
  let score = 0;
  if (move.finishes) score += 1000;
  for (const c of move.captures) score += 500 + c.from * 6;
  if (move.enters) score += 300;
  if (move.from <= LAST_TRACK_PROGRESS && move.to >= HOME_COLUMN_START) score += 150;
  if (move.to <= LAST_TRACK_PROGRESS) {
    const abs = absoluteSquare(state.players[move.playerIndex].seat, move.to);
    if (state.rules.safeSquares && isSafeSquare(abs)) score += 80;
  }
  const dangerBefore = move.enters ? 0 : dangerAt(state, move.playerIndex, move.from);
  const dangerAfter = dangerAt(state, move.playerIndex, move.to);
  score += (dangerBefore - dangerAfter) * 120;
  // 앞서 있는 말을 조금 더 우선해서 끝까지 보내도록
  score += move.to * 2;
  return score;
}

export type AiLevel = 'ai-easy' | 'ai-normal';

export function chooseMove(state: GameState, moves: Move[], level: AiLevel, rng: Rng = Math.random): Move {
  if (moves.length === 0) throw new Error('둘 수 있는 수가 없습니다.');
  if (level === 'ai-easy' && rng() < 0.5) {
    return moves[Math.min(moves.length - 1, Math.floor(rng() * moves.length))];
  }
  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const s = scoreMove(state, m);
    if (s > bestScore) {
      best = m;
      bestScore = s;
    }
  }
  return best;
}
