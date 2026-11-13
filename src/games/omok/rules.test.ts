import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, applyAction, canUndo, coordName, createGame, forbiddenAt, hintSpots, makesFive, replay, starPoints, undo, winLineAt } from './rules';
import type { Cell, DuelKind, OmokOptions, OmokState, RuleSet, Stone } from './types';

const N = 15;
const at = (r: number, c: number) => r * N + c;

function empty(): Cell[] {
  return Array.from({ length: N * N }, () => -1 as Cell);
}

/** 흑(0)·백(1) 돌을 놓은 판 */
function board(black: [number, number][], white: [number, number][] = []): Cell[] {
  const b = empty();
  for (const [r, c] of black) b[at(r, c)] = 0;
  for (const [r, c] of white) b[at(r, c)] = 1;
  return b;
}

function game(options: Partial<OmokOptions> = {}, kinds: [DuelKind, DuelKind] = ['human', 'human']): OmokState {
  return createGame({ seats: [{ kind: kinds[0], name: '' }, { kind: kinds[1], name: '' }], options: { ...DEFAULT_OPTIONS, ...options } });
}

function play(s: OmokState, moves: [number, number][]): OmokState {
  for (const [r, c] of moves) s = applyAction(s, { type: 'place', index: at(r, c) });
  return s;
}

describe('판', () => {
  it('좌표: 열은 A부터, 줄은 아래부터', () => {
    expect(coordName(at(14, 0), N)).toBe('A1');
    expect(coordName(at(7, 7), N)).toBe('H8');
    expect(coordName(at(0, 14), N)).toBe('O15');
  });

  it('화점 5개', () => {
    expect(starPoints(15)).toContain(at(7, 7));
    expect(starPoints(15)).toHaveLength(5);
    expect(starPoints(13)).toContain(6 * 13 + 6);
  });
});

describe('다섯 줄', () => {
  it('가로·세로·대각선 다섯이면 이긴다', () => {
    for (const line of [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ]) {
      const b = empty();
      for (let k = 0; k < 4; k++) b[at(7 + line[0] * k, 7 + line[1] * k)] = 0;
      expect(makesFive(b, N, at(7 + line[0] * 4, 7 + line[1] * 4), 0, 'free')).toBe(true);
    }
  });

  it('렌주의 흑은 정확히 다섯이어야 이기고, 백과 자유 규칙은 여섯도 이긴다', () => {
    const b = board([
      [7, 2],
      [7, 3],
      [7, 4],
      [7, 6],
      [7, 7],
    ]);
    expect(makesFive(b, N, at(7, 5), 0, 'renju')).toBe(false);
    expect(makesFive(b, N, at(7, 5), 0, 'free')).toBe(true);
    const w = b.map((c) => (c === 0 ? 1 : c)) as Cell[];
    expect(makesFive(w, N, at(7, 5), 1, 'renju')).toBe(true);
  });

  it('게임: 흑이 다섯을 만들면 끝나고 이긴 줄이 남는다', () => {
    let s = game({ rule: 'free' });
    s = play(s, [
      [7, 7],
      [8, 7],
      [7, 8],
      [8, 8],
      [7, 9],
      [8, 9],
      [7, 10],
      [8, 10],
      [7, 11],
    ]);
    expect(s.phase).toBe('gameover');
    expect(s.winner).toBe(0);
    expect(s.winLine).toEqual([at(7, 7), at(7, 8), at(7, 9), at(7, 10), at(7, 11)]);
    expect(s.events.map((e) => e.type)).toEqual(['place', 'win']);
    expect(winLineAt(s.board, N, at(7, 9), 'free')).not.toBeNull();
  });

  it('이미 돌이 있는 칸에는 둘 수 없다', () => {
    const s = play(game(), [[7, 7]]);
    expect(applyAction(s, { type: 'place', index: at(7, 7) })).toBe(s);
  });
});

describe('금수', () => {
  // 가운데에 두면 가로·세로로 열린 삼이 두 개 생기는 모양
  const double3 = board([
    [7, 5],
    [7, 6],
    [5, 7],
    [6, 7],
  ]);

  it('쌍삼: 쌍삼 금지는 흑백 모두, 렌주는 흑만, 자유는 없음', () => {
    expect(forbiddenAt(double3, N, at(7, 7), 0, 'no33')).toBe('33');
    const w = double3.map((c) => (c === 0 ? 1 : c)) as Cell[];
    expect(forbiddenAt(w, N, at(7, 7), 1, 'no33')).toBe('33');
    expect(forbiddenAt(double3, N, at(7, 7), 0, 'renju')).toBe('33');
    expect(forbiddenAt(w, N, at(7, 7), 1, 'renju')).toBeNull();
    expect(forbiddenAt(double3, N, at(7, 7), 0, 'free')).toBeNull();
  });

  it('한쪽이 막힌 삼은 열린 삼이 아니다', () => {
    const b = double3.slice();
    b[at(7, 4)] = 1; // 가로 삼의 끝을 막는다
    b[at(7, 8)] = 1;
    expect(forbiddenAt(b, N, at(7, 7), 0, 'no33')).toBeNull();
  });

  it('렌주: 흑의 쌍사와 장목은 금수', () => {
    const d4 = board([
      [7, 4],
      [7, 5],
      [7, 6],
      [4, 7],
      [5, 7],
      [6, 7],
    ]);
    d4[at(7, 3)] = 1;
    d4[at(3, 7)] = 1;
    expect(forbiddenAt(d4, N, at(7, 7), 0, 'renju')).toBe('44');
    expect(forbiddenAt(d4, N, at(7, 7), 0, 'no33')).toBeNull();
    const six = board([
      [7, 2],
      [7, 3],
      [7, 4],
      [7, 6],
      [7, 7],
    ]);
    expect(forbiddenAt(six, N, at(7, 5), 0, 'renju')).toBe('overline');
  });

  it('다섯이 되는 수는 금수 모양이어도 둘 수 있다', () => {
    const b = double3.slice();
    for (const c of [3, 4]) b[at(7, c)] = 0; // 가로가 다섯이 된다
    expect(forbiddenAt(b, N, at(7, 7), 0, 'no33')).toBeNull();
  });

  it('게임: 금수 자리에는 둘 수 없다', () => {
    let s = game({ rule: 'no33' });
    s = play(s, [
      [7, 5],
      [0, 0],
      [7, 6],
      [0, 2],
      [5, 7],
      [0, 4],
      [6, 7],
      [0, 6],
    ]);
    expect(s.current).toBe(0);
    expect(applyAction(s, { type: 'place', index: at(7, 7) })).toBe(s);
  });
});

describe('수 알려 주기', () => {
  it('이길 곳, 막을 곳, 조심할 곳', () => {
    const b = board(
      [
        [7, 7],
        [7, 8],
        [7, 9],
        [7, 10],
      ],
      [
        [9, 7],
        [9, 8],
      ],
    );
    expect(hintSpots(b, N, 0, 'free').win.sort()).toEqual([at(7, 6), at(7, 11)].sort());
    expect(hintSpots(b, N, 1, 'free').block.sort()).toEqual([at(7, 6), at(7, 11)].sort());
    const three = board([
      [7, 7],
      [7, 8],
      [7, 9],
    ]);
    expect(hintSpots(three, N, 1, 'free').watch.length).toBeGreaterThan(0);
  });
});

describe('무르기와 다시 두기', () => {
  it('컴퓨터와 할 때 사람이 둔 수와 컴퓨터가 둔 수를 함께 무른다', () => {
    let s = game({}, ['human', 'ai-normal']);
    s = play(s, [
      [7, 7],
      [7, 8],
      [8, 8],
      [6, 6],
    ]);
    expect(canUndo(s)).toBe(true);
    const u = undo(s);
    expect(u.moves).toHaveLength(2);
    expect(u.current).toBe(0);
    expect(u.board[at(8, 8)]).toBe(-1);
    expect(u.events.map((e) => e.type)).toEqual(['undo']);
  });

  it('다시 두기는 원래 판과 같다', () => {
    const s = play(game(), [
      [7, 7],
      [7, 8],
      [8, 8],
    ]);
    const r = replay(s, s.moves.length);
    expect(r.board).toEqual(s.board);
    expect(r.current).toBe(s.current);
  });

  it('판이 꽉 차면 비긴다 (13줄 판)', () => {
    const n = 13;
    // 다섯이 생기지 않는 무늬로 채우고 마지막 한 칸만 남긴다
    const color = (r: number, c: number): Stone => (Math.floor(c / 2 + r) % 2 === 0 ? 0 : 1);
    const full: Cell[] = Array.from({ length: n * n }, (_, i) => color(Math.floor(i / n), i % n));
    expect(full.every((_, i) => winLineAt(full, n, i, 'free') === null)).toBe(true);
    const last = n * n - 1;
    const s = game({ size: 13, rule: 'free' });
    s.board = full.slice();
    s.board[last] = -1;
    s.current = full[last] as Stone;
    const t = applyAction(s, { type: 'place', index: last });
    expect(t.phase).toBe('gameover');
    expect(t.winner).toBeNull();
    expect(t.events.map((e) => e.type)).toEqual(['place', 'draw']);
  });
});

export { at, board, empty, game, play };
export type { RuleSet };
