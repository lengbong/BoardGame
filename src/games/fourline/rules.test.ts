import { describe, expect, it } from 'vitest';
import type { DuelKind } from '../common/duel';
import { CELLS, COLS, DEFAULT_OPTIONS, applyAction, canUndo, coordName, createGame, landingRow, legalColumns, replay, undo, winSegments, winningColumns, winningLine } from './rules';
import type { FourLineSetup, FourLineState } from './types';

function setup(kinds: [DuelKind, DuelKind] = ['human', 'human'], undoOpt = true): FourLineSetup {
  return {
    seats: [
      { kind: kinds[0], name: '' },
      { kind: kinds[1], name: '' },
    ],
    options: { ...DEFAULT_OPTIONS, undo: undoOpt },
  };
}

/** 열 번호(0~6)를 차례로 떨어뜨린다 */
function play(cols: number[], kinds?: [DuelKind, DuelKind]): FourLineState {
  let s = createGame(setup(kinds));
  for (const col of cols) {
    const next = applyAction(s, { type: 'drop', col });
    expect(next).not.toBe(s);
    s = next;
  }
  return s;
}

/** 서로 비기는 꽉 찬 판 순서: 열을 두 쌍씩 번갈아 채운다 */
const DRAW_ORDER = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2, 4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 4, 6, 6, 6, 6, 6, 6];

describe('사목 규칙: 떨어뜨리기', () => {
  it('빈 판에서 빨강부터 시작하고 7열 모두 둘 수 있다', () => {
    const s = createGame(setup());
    expect(s.board).toHaveLength(42);
    expect(s.current).toBe(0);
    expect(legalColumns(s.board)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('돌은 그 열의 맨 아래 빈칸까지 떨어진다', () => {
    let s = createGame(setup());
    expect(landingRow(s.board, 3)).toBe(5);
    s = applyAction(s, { type: 'drop', col: 3 });
    expect(s.board[5 * COLS + 3]).toBe(0);
    expect(s.current).toBe(1);
    expect(landingRow(s.board, 3)).toBe(4);
    s = applyAction(s, { type: 'drop', col: 3 });
    expect(s.board[4 * COLS + 3]).toBe(1);
    expect(s.events[0]).toMatchObject({ type: 'drop', player: 1, col: 3, row: 4 });
    expect(s.lastMove).toBe(4 * COLS + 3);
  });

  it('꽉 찬 열에는 둘 수 없다', () => {
    const s = play([2, 2, 2, 2, 2, 2]);
    expect(landingRow(s.board, 2)).toBe(-1);
    expect(legalColumns(s.board)).not.toContain(2);
    expect(applyAction(s, { type: 'drop', col: 2 })).toBe(s);
    expect(applyAction(s, { type: 'drop', col: 7 })).toBe(s);
  });

  it('좌표는 열 글자 + 아래에서부터 행 번호', () => {
    expect(coordName(5 * COLS + 0)).toBe('A1');
    expect(coordName(0 * COLS + 6)).toBe('G6');
    expect(coordName(3 * COLS + 3)).toBe('D3');
    const s = play([3]);
    expect(s.log[s.log.length - 1].text).toContain('D1');
  });
});

describe('사목 규칙: 넷 잇기', () => {
  it('가로 넷', () => {
    const s = play([0, 0, 1, 1, 2, 2, 3]);
    expect(s.phase).toBe('gameover');
    expect(s.winner).toBe(0);
    expect(s.winLine).toEqual([35, 36, 37, 38]);
    expect(s.events.map((e) => e.type)).toEqual(['drop', 'win']);
  });

  it('세로 넷', () => {
    const s = play([0, 1, 0, 1, 0, 1, 2, 1]);
    expect(s.winner).toBe(1);
    expect(s.winLine).toEqual([2 * COLS + 1, 3 * COLS + 1, 4 * COLS + 1, 5 * COLS + 1]);
  });

  it('오른쪽 위로 가는 대각선 넷', () => {
    // 빨강: A1, B2, C3, D4
    const s = play([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
    expect(s.winner).toBe(0);
    expect(s.winLine!.map(coordName).sort()).toEqual(['A1', 'B2', 'C3', 'D4']);
  });

  it('왼쪽 위로 가는 대각선 넷', () => {
    // 빨강: G1, F2, E3, D4
    const s = play([6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3]);
    expect(s.winner).toBe(0);
    expect(s.winLine!.map(coordName).sort()).toEqual(['D4', 'E3', 'F2', 'G1']);
  });

  it('다섯 이어지면 다섯 칸 모두 이긴 줄', () => {
    // 빨강 A1 B1 _ D1 E1 → 가운데 C1을 채우면 다섯
    const s = play([0, 0, 1, 1, 3, 3, 4, 4, 2]);
    expect(s.winner).toBe(0);
    expect(s.winLine).toHaveLength(5);
  });

  it('셋까지는 이기지 않고, 상대 돌로 끊기면 넷이 아니다', () => {
    const s = play([0, 6, 1, 6, 2, 3]);
    expect(s.phase).toBe('play');
    expect(winningLine(s.board, 5 * COLS + 2)).toEqual([]);
  });

  it('바로 이기는 열 찾기', () => {
    const s = play([0, 0, 1, 1, 2]);
    expect(winningColumns(s.board, 0)).toEqual([3]);
    expect(winningColumns(s.board, 1)).toEqual([]);
  });

  it('판이 꽉 차면 비긴다', () => {
    const s = play(DRAW_ORDER);
    expect(s.moves).toHaveLength(CELLS);
    expect(s.phase).toBe('gameover');
    expect(s.winner).toBeNull();
    expect(s.events.map((e) => e.type)).toEqual(['drop', 'draw']);
    expect(legalColumns(s.board)).toEqual([]);
  });

  it('끝난 게임에는 더 둘 수 없다', () => {
    const s = play([0, 0, 1, 1, 2, 2, 3]);
    expect(applyAction(s, { type: 'drop', col: 5 })).toBe(s);
  });
});

describe('사목 규칙: 무르기', () => {
  it('사람 수와 컴퓨터 수를 함께 되돌린다', () => {
    const s = play([3, 2, 4, 4], ['human', 'ai-hard']);
    const back = undo(s);
    expect(back.moves).toEqual([3, 2]);
    expect(back.current).toBe(0);
    expect(back.board).toEqual(play([3, 2]).board);
    expect(back.events[0].type).toBe('undo');
  });

  it('사람이 노랑이면 노랑 차례로 돌아간다', () => {
    const s = play([3, 2, 4], ['ai-easy', 'human']);
    const back = undo(s);
    expect(back.moves).toEqual([3]);
    expect(back.current).toBe(1);
  });

  it('끝난 게임도 무를 수 있다', () => {
    const s = play([0, 6, 1, 6, 2, 6, 3], ['human', 'ai-normal']);
    expect(s.phase).toBe('gameover');
    const back = undo(s);
    expect(back.phase).toBe('play');
    expect(back.winLine).toBeNull();
    expect(back.moves).toHaveLength(6);
  });

  it('무르기를 끄면 무를 수 없고, 컴퓨터끼리도 무를 수 없다', () => {
    let s = createGame(setup(['human', 'ai-easy'], false));
    s = applyAction(s, { type: 'drop', col: 3 });
    expect(canUndo(s)).toBe(false);
    const cpu = play([3, 3], ['ai-easy', 'ai-hard']);
    expect(canUndo(cpu)).toBe(false);
    expect(undo(cpu)).toBe(cpu);
  });

  it('다시 두기는 같은 판을 만든다', () => {
    const s = play([3, 3, 2, 4, 1, 0]);
    const again = replay(s, s.moves.length);
    expect(again.board).toEqual(s.board);
    expect(again.current).toBe(s.current);
  });
});

describe('사목 규칙: 이긴 줄 선', () => {
  it('이긴 줄의 양 끝을 돌려준다', () => {
    const s = play([0, 0, 1, 1, 2, 2, 3]);
    expect(winSegments(s.board, s.lastMove!)).toEqual([[35, 38]]);
    const d = play([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
    const segs = winSegments(d.board, d.lastMove!);
    expect(segs).toHaveLength(1);
    expect(segs[0].map(coordName).sort()).toEqual(['A1', 'D4']);
  });
});
