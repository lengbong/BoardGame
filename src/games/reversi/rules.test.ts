import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, applyAction, canUndo, coordName, countDiscs, createGame, flipsFor, initialBoard, legalMoves, replay, undo } from './rules';
import type { BoardSize, Cell, Disc, ReversiSetup, ReversiState } from './types';
import type { DuelKind } from '../common/duel';

function setup(size: BoardSize = 8, kinds: [DuelKind, DuelKind] = ['human', 'human'], undoOpt = true): ReversiSetup {
  return {
    seats: [
      { kind: kinds[0], name: '' },
      { kind: kinds[1], name: '' },
    ],
    options: { ...DEFAULT_OPTIONS, size, undo: undoOpt },
  };
}

/** 'B' 흑, 'W' 백, '.' 빈칸 */
function parse(rows: string[]): Cell[] {
  return rows.join('').split('').map((ch) => (ch === 'B' ? 0 : ch === 'W' ? 1 : -1)) as Cell[];
}

function withBoard(rows: string[], current: Disc = 0, kinds: [DuelKind, DuelKind] = ['human', 'human']): ReversiState {
  const size = rows.length as BoardSize;
  const s = createGame(setup(size, kinds));
  s.board = parse(rows);
  s.counts = countDiscs(s.board);
  s.current = current;
  return s;
}

const idx = (name: string, size = 8) => (Number(name.slice(1)) - 1) * size + (name.charCodeAt(0) - 65);

describe('뒤집기 규칙: 시작', () => {
  it('8×8 판은 가운데 네 칸에 흑백 2개씩 놓고 흑부터 시작한다', () => {
    const s = createGame(setup());
    expect(s.board).toHaveLength(64);
    expect(s.counts).toEqual([2, 2]);
    expect(s.current).toBe(0);
    expect(s.board[idx('D4')]).toBe(1);
    expect(s.board[idx('E5')]).toBe(1);
    expect(s.board[idx('E4')]).toBe(0);
    expect(s.board[idx('D5')]).toBe(0);
  });

  it('처음에 흑이 둘 수 있는 곳은 D3, C4, F5, E6 네 곳', () => {
    const s = createGame(setup());
    expect(legalMoves(s.board, 8, 0).map((i) => coordName(i, 8)).sort()).toEqual(['C4', 'D3', 'E6', 'F5']);
    expect(legalMoves(s.board, 8, 1).map((i) => coordName(i, 8)).sort()).toEqual(['C5', 'D6', 'E3', 'F4']);
  });

  it('6×6 어린이 판도 같은 모양으로 시작한다', () => {
    const s = createGame(setup(6));
    expect(s.size).toBe(6);
    expect(s.board).toHaveLength(36);
    expect(s.counts).toEqual([2, 2]);
    expect(legalMoves(s.board, 6, 0).map((i) => coordName(i, 6)).sort()).toEqual(['B3', 'C2', 'D5', 'E4']);
  });

  it('좌표 이름은 열 글자 + 위에서부터 행 번호', () => {
    expect(coordName(0, 8)).toBe('A1');
    expect(coordName(63, 8)).toBe('H8');
    expect(coordName(19, 8)).toBe('D3');
    expect(coordName(35, 6)).toBe('F6');
  });
});

describe('뒤집기 규칙: 뒤집기', () => {
  it('여덟 방향 모두 뒤집는다', () => {
    const s = withBoard([
      '........',
      '.B..B..B',
      '..W.W.W.',
      '...WWW..',
      '.BWW.WWB',
      '...WWW..',
      '..W.W.W.',
      '.B..B..B',
    ]);
    const at = idx('E5');
    const flips = flipsFor(s.board, 8, at, 0);
    expect(flips).toHaveLength(16);
    const next = applyAction(s, { type: 'place', index: at });
    for (const f of flips) expect(next.board[f]).toBe(0);
    // 다른 돌은 그대로
    expect(next.board[idx('B1', 8)]).toBe(-1);
    expect(next.counts).toEqual([s.counts[0] + 17, s.counts[1] - 16]);
  });

  it('뒤집는 순서는 놓은 돌에서 가까운 것부터', () => {
    const s = withBoard([
      'B.......',
      '.W......',
      '..W.....',
      '....WWB.',
      '...W....',
      '...B....',
      '........',
      '........',
    ]);
    const flips = flipsFor(s.board, 8, idx('D4'), 0).map((i) => coordName(i, 8));
    // 거리 1: C3(대각), E4(오른쪽), D5(아래) / 거리 2: B2, F4
    expect(flips.slice(0, 3).sort()).toEqual(['C3', 'D5', 'E4']);
    expect(flips.slice(3).sort()).toEqual(['B2', 'F4']);
  });

  it('끝이 빈칸이거나 판 밖이면 뒤집지 않는다', () => {
    const s = withBoard([
      'WWW.....',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '.......W',
    ]);
    expect(flipsFor(s.board, 8, idx('D1'), 0)).toEqual([]);
    expect(flipsFor(s.board, 8, idx('G8'), 0)).toEqual([]);
  });

  it('이미 돌이 있는 칸이나 뒤집을 게 없는 칸에는 둘 수 없다', () => {
    const s = createGame(setup());
    expect(applyAction(s, { type: 'place', index: idx('D4') })).toBe(s);
    expect(applyAction(s, { type: 'place', index: idx('A1') })).toBe(s);
  });

  it('두면 돌 수와 차례, 마지막 수, 기록이 바뀐다', () => {
    const s = createGame(setup());
    const next = applyAction(s, { type: 'place', index: idx('D3') });
    expect(next.counts).toEqual([4, 1]);
    expect(next.current).toBe(1);
    expect(next.lastMove).toBe(idx('D3'));
    expect(next.turn).toBe(2);
    expect(next.events[0]).toMatchObject({ type: 'place', player: 0, index: idx('D3'), flips: [idx('D4')] });
    expect(next.log[next.log.length - 1].text).toContain('D3');
    // 원래 상태는 그대로
    expect(s.board[idx('D4')]).toBe(1);
  });
});

describe('뒤집기 규칙: 넘김과 끝', () => {
  it('상대가 둘 곳이 없으면 저절로 넘어가고 같은 사람이 한 번 더 둔다', () => {
    // 흑이 A3에 두면 백은 둘 곳이 없고, 흑은 아직 둘 곳이 있다
    const s = withBoard([
      'BBBBBBBB',
      'BBBBBBBB',
      '.WBBBBBB',
      'BBBBBBB.',
      'BBBBBBB.',
      'BBBBBBBB',
      'BBBBBBBB',
      'BBBBBBW.',
    ]);
    const next = applyAction(s, { type: 'place', index: idx('A3') });
    expect(next.phase).toBe('play');
    expect(next.current).toBe(0);
    expect(next.passes).toEqual([0, 1]);
    expect(next.events.map((e) => e.type)).toEqual(['place', 'pass']);
    expect(next.log[next.log.length - 1].text).toContain('둘 곳이 없어서 넘어가요');
    expect(legalMoves(next.board, 8, 1)).toEqual([]);
    expect(legalMoves(next.board, 8, 0).length).toBeGreaterThan(0);
  });

  const ENDING = ['.BBBBBBB', 'BBWWWWWW', 'BWBWWWWW', 'BWWBWWWW', 'BWWWBWWW', 'BWWWWBWW', 'BWWWWWBW', 'BWWWWWW.'];

  it('빈칸이 남아도 둘 다 둘 곳이 없으면 끝나고 돌이 많은 쪽이 이긴다', () => {
    const s = withBoard(ENDING, 0);
    const next = applyAction(s, { type: 'place', index: idx('H8') });
    expect(flipsFor(s.board, 8, idx('H8'), 0)).toHaveLength(12);
    // 남은 A1은 가로·세로·대각선이 모두 흑이라 아무도 둘 수 없다
    expect(next.board[idx('A1')]).toBe(-1);
    expect(next.phase).toBe('gameover');
    expect(next.counts).toEqual([33, 30]);
    expect(next.winner).toBe(0);
    expect(next.events.map((e) => e.type)).toEqual(['place', 'end']);
  });

  it('판이 다 차면 끝나고, 같으면 무승부', () => {
    const s = withBoard(['BBBBBBBB', 'BBBBBBBB', 'BBBBBBBB', 'BBBBBBB.', 'WWWWWWWB', 'WWWWWWWW', 'WWWWWWWW', 'WWWWWWWW'], 1);
    const next = applyAction(s, { type: 'place', index: idx('H4') });
    expect(next.board.includes(-1)).toBe(false);
    expect(next.phase).toBe('gameover');
    expect(next.counts).toEqual([31, 33]);
    expect(next.winner).toBe(1);

    const d = withBoard(['WWBBBBBB', 'BBBBBBBB', 'BBBBBBBB', 'BBBBBBB.', 'WWWWWWWW', 'WWWWWWWB', 'WWWWWWWW', 'WWWWWWWW'], 0);
    const end = applyAction(d, { type: 'place', index: idx('H4') });
    expect(end.phase).toBe('gameover');
    expect(end.counts).toEqual([32, 32]);
    expect(end.winner).toBeNull();
    expect(end.log[end.log.length - 1].text).toContain('비겼어요');
  });

  it('끝난 게임에는 더 둘 수 없다', () => {
    const over = applyAction(withBoard(ENDING, 0), { type: 'place', index: idx('H8') });
    expect(applyAction(over, { type: 'place', index: idx('A1') })).toBe(over);
  });

  it('6×6 판에서도 끝까지 둘 수 있고 돌 수 합은 판 크기 이하', () => {
    let s = createGame(setup(6));
    let guard = 0;
    while (s.phase === 'play' && guard++ < 100) {
      const moves = legalMoves(s.board, 6, s.current);
      expect(moves.length).toBeGreaterThan(0);
      s = applyAction(s, { type: 'place', index: moves[0] });
      expect(countDiscs(s.board)).toEqual(s.counts);
    }
    expect(s.phase).toBe('gameover');
    expect(s.counts[0] + s.counts[1]).toBeLessThanOrEqual(36);
  });
});

describe('뒤집기 규칙: 무르기', () => {
  it('사람이 둔 수와 그 뒤 컴퓨터 수를 되돌려 사람 차례로 돌아간다', () => {
    let s = createGame(setup(8, ['human', 'ai-normal']));
    const start = s;
    s = applyAction(s, { type: 'place', index: idx('D3') });
    s = applyAction(s, { type: 'place', index: legalMoves(s.board, 8, 1)[0] });
    expect(canUndo(s)).toBe(true);
    const back = undo(s);
    expect(back.board).toEqual(start.board);
    expect(back.current).toBe(0);
    expect(back.moves).toEqual([]);
    expect(back.events[0].type).toBe('undo');
    expect(back.nextEventId).toBeGreaterThan(s.nextEventId);
    expect(canUndo(back)).toBe(false);
  });

  it('사람이 백일 때도 사람의 마지막 수로 돌아간다', () => {
    let s = createGame(setup(8, ['ai-easy', 'human']));
    s = applyAction(s, { type: 'place', index: idx('D3') });
    const before = s;
    s = applyAction(s, { type: 'place', index: legalMoves(s.board, 8, 1)[0] });
    s = applyAction(s, { type: 'place', index: legalMoves(s.board, 8, 0)[0] });
    const back = undo(s);
    expect(back.board).toEqual(before.board);
    expect(back.current).toBe(1);
    expect(back.moves).toHaveLength(1);
  });

  it('무르기를 끄거나 사람이 둔 수가 없으면 무를 수 없다', () => {
    let s = createGame(setup(8, ['human', 'ai-normal'], false));
    s = applyAction(s, { type: 'place', index: idx('D3') });
    expect(canUndo(s)).toBe(false);
    const cpu = applyAction(createGame(setup(8, ['ai-easy', 'ai-easy'])), { type: 'place', index: idx('D3') });
    expect(canUndo(cpu)).toBe(false);
    expect(undo(cpu)).toBe(cpu);
  });

  it('다시 두기(replay)는 같은 판을 만든다', () => {
    let s = createGame(setup(6));
    for (let k = 0; k < 10 && s.phase === 'play'; k++) s = applyAction(s, { type: 'place', index: legalMoves(s.board, 6, s.current).at(-1)! });
    const again = replay(s, s.moves.length);
    expect(again.board).toEqual(s.board);
    expect(again.current).toBe(s.current);
    expect(again.counts).toEqual(s.counts);
  });

  it('처음 판 만들기는 크기마다 4개', () => {
    expect(initialBoard(6).filter((v) => v !== -1)).toHaveLength(4);
    expect(initialBoard(8).filter((v) => v !== -1)).toHaveLength(4);
  });
});
