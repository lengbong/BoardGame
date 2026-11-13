import { describe, expect, it } from 'vitest';
import { buildTimeline } from './animation';
import { listsFromBoard, listsMatch, seedSpot, PIT_R, SEED_R, STORE_RX, STORE_RY } from './layout';
import {
  DEFAULT_OPTIONS,
  applyAction,
  createGame,
  extraTurnPits,
  legalMoves,
  oppositeOf,
  previewMove,
  simulateMove,
  storeOf,
} from './rules';
import { isValidState } from './storage';
import type { MancalaOptions, MancalaState, Side } from './types';

function game(options: Partial<MancalaOptions> = {}): MancalaState {
  return createGame({
    seats: [
      { kind: 'human', name: '가' },
      { kind: 'human', name: '나' },
    ],
    options: { ...DEFAULT_OPTIONS, ...options },
    hints: true,
  });
}

/** 판을 직접 정해서 시작한다. pits0/pits1은 그 편이 보기에 왼쪽부터 6칸 */
function position(pits0: number[], store0: number, pits1: number[], store1: number, current: Side = 0, options: Partial<MancalaOptions> = {}): MancalaState {
  const s = game(options);
  s.board = [...pits0, store0, ...pits1, store1];
  s.current = current;
  return s;
}

const total = (b: number[]) => b.reduce((a, c) => a + c, 0);

describe('판 준비', () => {
  it('구멍마다 정한 수만큼 씨앗을 넣고 창고는 비운다', () => {
    for (const seeds of [3, 4, 5, 6] as const) {
      const s = game({ seeds });
      expect(s.board).toEqual([seeds, seeds, seeds, seeds, seeds, seeds, 0, seeds, seeds, seeds, seeds, seeds, seeds, 0]);
      expect(total(s.board)).toBe(seeds * 12);
      expect(s.current).toBe(0);
      expect(s.phase).toBe('play');
    }
  });

  it('둘 수 있는 곳은 지금 차례인 편의 씨앗 있는 구멍뿐이다', () => {
    const s = position([0, 2, 0, 1, 0, 3], 0, [1, 1, 1, 1, 1, 1], 0);
    expect(legalMoves(s)).toEqual([1, 3, 5]);
    s.current = 1;
    expect(legalMoves(s)).toEqual([7, 8, 9, 10, 11, 12]);
    // 건너편 구멍 번호
    expect(oppositeOf(0)).toBe(12);
    expect(oppositeOf(5)).toBe(7);
    expect(oppositeOf(9)).toBe(3);
  });
});

describe('씨앗 뿌리기', () => {
  it('한 알씩 다음 구멍에 넣는다', () => {
    const s = applyAction(game(), { type: 'sow', pit: 0 });
    expect(s.board).toEqual([0, 5, 5, 5, 5, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
    expect(s.current).toBe(1);
    expect(s.events[0]).toMatchObject({ type: 'sow', side: 0, pit: 0, count: 4, path: [1, 2, 3, 4] });
  });

  it('내 창고에 넣고 상대 구멍으로 이어 간다', () => {
    const s = applyAction(game(), { type: 'sow', pit: 4 });
    expect(s.board).toEqual([4, 4, 4, 4, 0, 5, 1, 5, 5, 4, 4, 4, 4, 0]);
    expect(s.lastMove).toMatchObject({ side: 0, pit: 4, last: 8, extra: false });
  });

  it('0번 편은 상대 창고(13)를 건너뛰고 내 쪽으로 돌아온다', () => {
    const s = position([0, 0, 0, 0, 0, 9], 0, [1, 1, 1, 1, 1, 1], 0);
    const r = simulateMove(s.board, 0, 5, s.options);
    expect(r.path).toEqual([6, 7, 8, 9, 10, 11, 12, 0, 1]);
    expect(r.board[13]).toBe(0);
  });

  it('1번 편은 상대 창고(6)를 건너뛴다', () => {
    const s = position([1, 1, 1, 1, 1, 1], 0, [0, 0, 0, 0, 0, 9], 0, 1);
    const r = simulateMove(s.board, 1, 12, s.options);
    expect(r.path).toEqual([13, 0, 1, 2, 3, 4, 5, 7, 8]);
    expect(r.board[6]).toBe(0);
  });

  it('씨앗 13개면 한 바퀴를 돌아 처음 구멍에 마지막 씨앗이 떨어진다 (처음 구멍을 건너뛰지 않음)', () => {
    const s = position([0, 0, 13, 0, 0, 0], 0, [2, 0, 0, 0, 0, 0], 0);
    const r = simulateMove(s.board, 0, 2, s.options);
    expect(r.path).toHaveLength(13);
    expect(r.last).toBe(2);
    expect(r.path).not.toContain(13);
    // 처음 구멍은 비어 있다가 한 알을 받았고 건너편(10)에도 씨앗이 있으니 가져오기
    expect(r.capture).toEqual({ pit: 2, opposite: 10, count: 2 });
    expect(total(r.board)).toBe(15);
  });

  it('씨앗이 아주 많으면 판을 여러 바퀴 돌고 씨앗 수는 그대로다', () => {
    const s = position([0, 30, 0, 0, 0, 1], 0, [1, 0, 0, 0, 0, 0], 0);
    const r = simulateMove(s.board, 0, 1, s.options);
    expect(r.path).toHaveLength(30);
    expect(r.path.filter((c) => c === 13)).toHaveLength(0);
    expect(r.path.filter((c) => c === 1)).toHaveLength(2);
    expect(total(r.board)).toBe(32);
    expect(r.board[6]).toBe(2);
  });

  it('마지막 씨앗이 내 창고에 떨어지면 한 번 더 한다', () => {
    const s = applyAction(game(), { type: 'sow', pit: 2 });
    expect(s.board.slice(0, 7)).toEqual([4, 4, 0, 5, 5, 5, 1]);
    expect(s.current).toBe(0);
    expect(s.lastMove?.extra).toBe(true);
    expect(s.events.map((e) => e.type)).toEqual(['sow', 'extra']);
    expect(s.stats[0].extraTurns).toBe(1);
  });

  it('한 바퀴 돌고 내 창고에서 끝나도 한 번 더 (1번 편)', () => {
    const s = position([1, 1, 1, 1, 1, 1], 0, [19, 0, 0, 0, 0, 0], 0, 1);
    expect(extraTurnPits(s.board, 1)).toEqual([7]);
    const n = applyAction(s, { type: 'sow', pit: 7 });
    expect(n.lastMove?.last).toBe(13);
    expect(n.current).toBe(1);
  });

  it('둘 수 없는 행동은 무시한다', () => {
    const s = position([0, 2, 0, 0, 0, 0], 0, [1, 1, 1, 1, 1, 1], 0);
    expect(applyAction(s, { type: 'sow', pit: 0 })).toBe(s); // 빈 구멍
    expect(applyAction(s, { type: 'sow', pit: 8 })).toBe(s); // 상대 구멍
    expect(applyAction(s, { type: 'sow', pit: 6 })).toBe(s); // 창고
    expect(applyAction(s, { type: 'sow', pit: 99 })).toBe(s);
  });
});

describe('가져오기', () => {
  it('비어 있던 내 구멍에서 끝나고 건너편에 씨앗이 있으면 둘 다 창고로', () => {
    const s = position([1, 0, 0, 0, 0, 2], 3, [0, 0, 0, 0, 5, 1], 4);
    const n = applyAction(s, { type: 'sow', pit: 0 });
    expect(n.board[1]).toBe(0);
    expect(n.board[11]).toBe(0);
    expect(n.board[6]).toBe(3 + 6);
    expect(n.events.map((e) => e.type)).toContain('capture');
    expect(n.stats[0]).toMatchObject({ captures: 1, captured: 6 });
    expect(n.current).toBe(1);
  });

  it('건너편이 비어 있으면 (정통 규칙) 가져오지 않고 씨앗은 그대로', () => {
    const s = position([1, 0, 0, 0, 0, 1], 0, [0, 0, 1, 0, 0, 0], 0);
    const r = simulateMove(s.board, 0, 0, s.options);
    expect(r.capture).toBeNull();
    expect(r.board[1]).toBe(1);
  });

  it('변형: 건너편이 비어도 내 씨앗 한 알을 창고로 가져온다', () => {
    const s = position([1, 0, 0, 0, 0, 1], 0, [0, 0, 1, 0, 0, 0], 0, 0, { captureEmpty: true });
    const r = simulateMove(s.board, 0, 0, s.options);
    expect(r.capture).toEqual({ pit: 1, opposite: 11, count: 1 });
    expect(r.board[1]).toBe(0);
    expect(r.board[6]).toBe(1);
  });

  it('상대 빈 구멍이나 씨앗이 있던 내 구멍에서 끝나면 가져오지 않는다', () => {
    const a = position([0, 0, 0, 0, 0, 2], 0, [0, 3, 0, 0, 0, 1], 0);
    expect(simulateMove(a.board, 0, 5, a.options).capture).toBeNull(); // 7번(상대)에서 끝
    const b = position([1, 2, 0, 0, 0, 0], 0, [0, 0, 0, 0, 4, 0], 0);
    expect(simulateMove(b.board, 0, 0, b.options).capture).toBeNull(); // 씨앗 있던 1번
  });

  it('1번 편도 가져올 수 있다', () => {
    const s = position([0, 0, 0, 7, 0, 1], 0, [0, 1, 0, 0, 0, 2], 0, 1);
    const n = applyAction(s, { type: 'sow', pit: 8 });
    expect(n.lastMove?.capture).toEqual({ pit: 9, opposite: 3, count: 8 });
    expect(n.board[13]).toBe(8);
  });
});

describe('끝내기와 점수', () => {
  it('내 구멍이 모두 비면 끝나고, 남은 씨앗은 주인 창고로 간다 (정통)', () => {
    const s = position([0, 0, 0, 0, 0, 1], 20, [2, 3, 0, 0, 0, 1], 21);
    const n = applyAction(s, { type: 'sow', pit: 5 });
    expect(n.phase).toBe('gameover');
    expect(n.board).toEqual([0, 0, 0, 0, 0, 0, 21, 0, 0, 0, 0, 0, 0, 27]);
    expect(n.result).toEqual({ winner: 1, scores: [21, 27], swept: [0, 6] });
    expect(n.lastMove?.extra).toBe(false); // 창고에서 끝났지만 판이 끝나서 한 번 더는 없다
    expect(n.events.map((e) => e.type)).toEqual(['sow', 'sweep', 'end']);
  });

  it('가져오기로 상대 구멍이 모두 비어도 끝난다', () => {
    const s = position([1, 0, 0, 0, 0, 2], 10, [0, 0, 0, 0, 4, 0], 20);
    const n = applyAction(s, { type: 'sow', pit: 0 });
    expect(n.phase).toBe('gameover');
    expect(n.board[6]).toBe(10 + 5 + 2);
    expect(n.result?.winner).toBe(1);
    expect(n.result?.swept).toEqual([2, 0]);
  });

  it('변형: 남은 씨앗은 구멍이 먼저 빈 쪽 사람이 모두 가져간다', () => {
    const s = position([0, 0, 0, 0, 0, 1], 20, [2, 3, 0, 0, 0, 1], 21, 0, { sweep: 'emptier' });
    const n = applyAction(s, { type: 'sow', pit: 5 });
    expect(n.board[6]).toBe(27);
    expect(n.board[13]).toBe(21);
    expect(n.result).toEqual({ winner: 0, scores: [27, 21], swept: [6, 0] });
  });

  it('창고 씨앗이 같으면 비긴다', () => {
    const t = position([0, 0, 0, 0, 0, 1], 23, [0, 0, 0, 0, 0, 1], 23);
    const n = applyAction(t, { type: 'sow', pit: 5 });
    expect(n.board[6]).toBe(24);
    expect(n.board[13]).toBe(24);
    expect(n.result?.winner).toBeNull();
    expect(n.log.at(-1)?.text).toContain('비겼어요');
    expect(applyAction(n, { type: 'sow', pit: 5 })).toBe(n); // 끝난 뒤에는 아무것도 못 한다
  });

  it('씨앗 수는 언제나 그대로이고, 끝까지 두면 모두 창고에 들어간다', () => {
    let s = game({ seeds: 5 });
    let guard = 0;
    while (s.phase === 'play' && guard++ < 500) {
      const moves = legalMoves(s);
      s = applyAction(s, { type: 'sow', pit: moves[(guard * 7) % moves.length] });
      expect(total(s.board)).toBe(60);
    }
    expect(s.phase).toBe('gameover');
    expect(s.board[storeOf(0)] + s.board[storeOf(1)]).toBe(60);
    expect(isValidState(JSON.parse(JSON.stringify(s)))).toBe(true);
  });
});

describe('도움말·저장·연출', () => {
  it('마지막 씨앗 위치 미리 보기는 실제 결과와 같다', () => {
    const s = game();
    const p = previewMove(s, 2);
    expect(p?.last).toBe(6);
    expect(p?.extra).toBe(true);
    expect(previewMove(s, 8)).toBeNull(); // 상대 구멍
    expect(applyAction(s, { type: 'sow', pit: 2 }).board).toEqual(p?.board);
  });

  it('저장된 상태 검사: 씨앗 수가 틀리거나 모양이 망가지면 버린다', () => {
    const s = applyAction(game(), { type: 'sow', pit: 0 });
    const copy = JSON.parse(JSON.stringify(s));
    expect(isValidState(copy)).toBe(true);
    expect(isValidState({ ...copy, board: copy.board.slice(0, 13) })).toBe(false);
    expect(isValidState({ ...copy, board: copy.board.map((n: number, i: number) => (i === 0 ? n + 1 : n)) })).toBe(false);
    expect(isValidState({ ...copy, current: 2 })).toBe(false);
    expect(isValidState(null)).toBe(false);
  });

  it('연출 순서를 끝까지 따라가면 씨앗 목록이 새 판과 같아진다 (뿌리기·가져오기·정리)', () => {
    const cases: [MancalaState, number][] = [
      [game(), 2],
      [position([1, 0, 0, 0, 0, 0], 3, [0, 0, 0, 0, 5, 1], 4), 0],
      [position([0, 0, 0, 0, 0, 1], 20, [2, 3, 0, 0, 0, 1], 21), 5],
      [position([0, 30, 0, 0, 0, 1], 0, [1, 0, 0, 0, 0, 0], 16), 1],
    ];
    for (const [s, pit] of cases) {
      const before = listsFromBoard(s.board);
      const n = applyAction(s, { type: 'sow', pit });
      const tl = buildTimeline(before, n.events, { step: 200, fly: 400, pause: 100 });
      expect(listsMatch(tl.final, n.board)).toBe(true);
      // 씨앗 번호는 하나도 없어지거나 겹치지 않는다
      const ids = tl.final.flat().sort((a, b) => a - b);
      expect(ids).toEqual(before.flat().sort((a, b) => a - b));
      expect(tl.total).toBeGreaterThan(0);
      for (let i = 1; i < tl.frames.length; i++) expect(tl.frames[i].at).toBeGreaterThanOrEqual(tl.frames[i - 1].at);
    }
  });

  it('씨앗 자리는 늘 같고, 구멍·창고 안쪽에 들어간다', () => {
    for (let slot = 0; slot < 44; slot++) {
      const a = seedSpot(3, slot);
      expect(seedSpot(3, slot)).toEqual(a);
      expect(Math.hypot(a.x, a.y) + SEED_R).toBeLessThan(PIT_R);
    }
    for (let slot = 0; slot < 72; slot++) {
      const a = seedSpot(6, slot);
      expect((a.x / (STORE_RX - SEED_R)) ** 2 + (a.y / (STORE_RY - SEED_R)) ** 2).toBeLessThan(1);
    }
  });
});
