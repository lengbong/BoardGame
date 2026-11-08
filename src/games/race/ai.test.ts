import { describe, expect, it } from 'vitest';
import { GOAL, YARD } from './board';
import { chooseMove, dangerAt } from './ai';
import { CLASSIC_RULES, applyRoll, createGame, legalMoves } from './rules';
import type { GameState } from './types';

function redVsYellow(red: number[], yellow: number[]): GameState {
  const state = createGame(
    {
      seats: [
        { kind: 'ai-normal', name: '빨강' },
        { kind: 'empty', name: '' },
        { kind: 'ai-normal', name: '노랑' },
        { kind: 'empty', name: '' },
      ],
      rules: CLASSIC_RULES,
    },
    () => 0,
  );
  state.players[0].pieces = red;
  state.players[1].pieces = yellow;
  return state;
}

describe('컴퓨터 플레이어', () => {
  it('상대 말을 잡을 수 있으면 잡는다', () => {
    // 빨강 진행도 2 + 3 = 5 (절대 칸 5), 노랑 진행도 31 = 절대 칸 5
    const s = applyRoll(redVsYellow([2, 20, YARD, YARD], [31, YARD, YARD, YARD]), 3);
    const move = chooseMove(s, legalMoves(s), 'ai-normal');
    expect(move.pieceIndex).toBe(0);
    expect(move.captures).toHaveLength(1);
  });

  it('골인할 수 있으면 골인한다', () => {
    const s = applyRoll(redVsYellow([53, 20, YARD, YARD], [YARD, YARD, YARD, YARD]), 3);
    const move = chooseMove(s, legalMoves(s), 'ai-normal');
    expect(move.pieceIndex).toBe(0);
    expect(move.to).toBe(GOAL);
  });

  it('6이 나오면 대기실 말을 출발시키는 것을 선호한다', () => {
    const s = applyRoll(redVsYellow([10, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]), 6);
    const move = chooseMove(s, legalMoves(s), 'ai-normal');
    expect(move.enters).toBe(true);
  });

  it('잡힐 위험이 있는 말을 피신시킨다', () => {
    // 빨강 말 0번(진행도 20 = 절대 칸 20) 뒤 2칸에 노랑 말(절대 칸 18 = 노랑 진행도 44)
    const s0 = redVsYellow([20, 30, YARD, YARD], [44, YARD, YARD, YARD]);
    expect(dangerAt(s0, 0, 20)).toBe(1);
    const s = applyRoll(s0, 1);
    // 1칸 이동: 0번은 절대 칸 21(별칸, 안전) / 1번은 31
    const move = chooseMove(s, legalMoves(s), 'ai-normal');
    expect(move.pieceIndex).toBe(0);
  });

  it('쉬움 단계도 항상 합법적인 수를 고른다', () => {
    const s = applyRoll(redVsYellow([10, 20, YARD, YARD], [YARD, YARD, YARD, YARD]), 4);
    const moves = legalMoves(s);
    for (let i = 0; i < 20; i++) {
      expect(moves).toContain(chooseMove(s, moves, 'ai-easy'));
    }
  });
});
