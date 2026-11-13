import { describe, expect, it } from 'vitest';
import { puzzleCode } from './generator';
import { PEERS, bit, candidatesAt, gridToString, parseGrid } from './grid';
import { MAX_HISTORY, applyAction, createGame, digitCounts, digitIs, digitJosa, findHint, solutionOf, wrongCells } from './rules';
import { LogicBoard } from './logic';
import { SUDOKU_SONG } from './song';
import { solve } from './solver';
import { formatTime, recordSolve, emptyRecords, validateState } from './storage';
import type { Puzzle, SudokuAction, SudokuState } from './types';

const GIVENS = '003020600900305001001806400008102900700000008006708200002609500800203009005010300';
const SOLUTION = gridToString(solve(parseGrid(GIVENS))!);
const ESCARGOT = '1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..';

function puzzle(givens = GIVENS, solution = SOLUTION): Puzzle {
  const g = parseGrid(givens);
  return {
    id: puzzleCode('easy', 123),
    difficulty: 'easy',
    seed: 123,
    givens: gridToString(g),
    solution,
    clues: g.filter(Boolean).length,
    level: 1,
  };
}

const sol = parseGrid(SOLUTION);
const run = (s: SudokuState, ...actions: SudokuAction[]) => actions.reduce(applyAction, s);
/** 0번 칸은 빈칸 (정답 4), 2번 칸은 처음 숫자 3 */
const wrongDigit = (cell: number) => (sol[cell] % 9) + 1;

describe('숫자 넣기와 메모', () => {
  it('새 게임은 처음 숫자만 있고 메모는 비어 있다', () => {
    const s = createGame(puzzle());
    expect(gridToString(s.values)).toBe(puzzle().givens);
    expect(s.notes.every((n) => n === 0)).toBe(true);
    expect(s.status).toBe('playing');
  });

  it('숫자를 넣으면 같은 줄·열·3×3 칸의 메모에서 그 숫자가 지워진다 (다른 칸은 그대로)', () => {
    let s = createGame(puzzle());
    const peer = 1; // 같은 가로줄의 빈칸
    const far = 80 - 9 * 0; // 맨 끝 칸 (0번과 이웃이 아님)
    expect(PEERS[0]).toContain(peer);
    expect(PEERS[0]).not.toContain(far);
    s = run(s, { type: 'note', cell: peer, digit: 4 }, { type: 'note', cell: peer, digit: 5 }, { type: 'note', cell: far, digit: 4 });
    s = run(s, { type: 'note', cell: 0, digit: 9 });
    s = applyAction(s, { type: 'place', cell: 0, digit: 4 });
    expect(s.values[0]).toBe(4);
    expect(s.notes[0]).toBe(0);
    expect(s.notes[peer]).toBe(bit(5));
    expect(s.notes[far]).toBe(bit(4));
    expect(s.events[0]).toMatchObject({ type: 'place', cell: 0, digit: 4, wrong: false, conflict: false });
  });

  it('처음 숫자는 바꾸거나 지울 수 없고, 숫자가 있는 칸에는 메모를 못 한다', () => {
    let s = createGame(puzzle());
    const before = s.values;
    s = applyAction(s, { type: 'place', cell: 2, digit: 5 });
    expect(s.values).toEqual(before);
    expect(s.events).toEqual([{ type: 'blocked', reason: 'given' }]);
    s = applyAction(s, { type: 'erase', cell: 2 });
    expect(s.values[2]).toBe(3);
    s = run(s, { type: 'place', cell: 0, digit: 4 }, { type: 'note', cell: 0, digit: 1 });
    expect(s.events).toEqual([{ type: 'blocked', reason: 'filled' }]);
  });

  it('메모는 누를 때마다 켜고 끈다', () => {
    let s = createGame(puzzle());
    s = run(s, { type: 'note', cell: 0, digit: 4 }, { type: 'note', cell: 0, digit: 5 });
    expect(s.notes[0]).toBe(bit(4) | bit(5));
    s = applyAction(s, { type: 'note', cell: 0, digit: 4 });
    expect(s.notes[0]).toBe(bit(5));
    expect(s.events[0]).toMatchObject({ type: 'note', on: false });
  });

  it('지우기: 숫자를 먼저 지우고, 숫자가 없으면 메모를 지운다', () => {
    let s = createGame(puzzle());
    s = run(s, { type: 'note', cell: 0, digit: 5 }, { type: 'place', cell: 0, digit: 4 });
    s = applyAction(s, { type: 'erase', cell: 0 });
    expect(s.values[0]).toBe(0);
    s = run(s, { type: 'note', cell: 0, digit: 7 }, { type: 'erase', cell: 0 });
    expect(s.notes[0]).toBe(0);
  });

  it('후보 숫자 모두 채우기는 칸마다 들어갈 수 있는 숫자를 적고, 되돌릴 수 있다', () => {
    let s = createGame(puzzle());
    s = applyAction(s, { type: 'fillNotes' });
    s.values.forEach((v, i) => expect(s.notes[i]).toBe(v ? 0 : candidatesAt(s.values, i)));
    s = applyAction(s, { type: 'undo' });
    expect(s.notes.every((n) => n === 0)).toBe(true);
  });

  it('숫자마다 판에 놓인 개수를 센다', () => {
    const counts = digitCounts(createGame(puzzle()).values);
    expect(counts.slice(1).reduce((a, b) => a + b, 0)).toBe(puzzle().clues);
    expect(counts[2]).toBe(GIVENS.split('').filter((c) => c === '2').length);
  });
});

describe('되돌리기·다시 하기', () => {
  it('숫자와 저절로 지워진 메모까지 함께 되돌리고 다시 한다', () => {
    let s = createGame(puzzle());
    s = run(s, { type: 'note', cell: 1, digit: 4 }, { type: 'place', cell: 0, digit: 4 });
    expect(s.notes[1]).toBe(0);
    s = applyAction(s, { type: 'undo' });
    expect(s.values[0]).toBe(0);
    expect(s.notes[1]).toBe(bit(4));
    s = applyAction(s, { type: 'redo' });
    expect(s.values[0]).toBe(4);
    expect(s.notes[1]).toBe(0);
  });

  it('새로 행동하면 다시 하기 기록이 사라지고, 기록이 없으면 아무 일도 없다', () => {
    let s = createGame(puzzle());
    s = run(s, { type: 'place', cell: 0, digit: 4 }, { type: 'undo' });
    expect(s.redo).toHaveLength(1);
    s = applyAction(s, { type: 'place', cell: 1, digit: sol[1] });
    expect(s.redo).toHaveLength(0);
    const fresh = createGame(puzzle());
    expect(applyAction(fresh, { type: 'undo' }).values).toEqual(fresh.values);
    expect(applyAction(fresh, { type: 'redo' }).events).toEqual([]);
  });

  it('되돌리기 기록은 정해진 개수까지만 둔다', () => {
    let s = createGame(puzzle());
    for (let k = 0; k < MAX_HISTORY + 20; k++) s = applyAction(s, { type: 'note', cell: 0, digit: 1 + (k % 9) });
    expect(s.undo).toHaveLength(MAX_HISTORY);
  });

  it('처음부터 다시는 처음 숫자만 남기고, 그것도 되돌릴 수 있다', () => {
    let s = createGame(puzzle());
    s = run(s, { type: 'place', cell: 0, digit: 4 }, { type: 'note', cell: 1, digit: 2 }, { type: 'reset' });
    expect(gridToString(s.values)).toBe(puzzle().givens);
    expect(s.notes[1]).toBe(0);
    s = applyAction(s, { type: 'undo' });
    expect(s.values[0]).toBe(4);
  });
});

describe('겹침·틀림·완성', () => {
  it('같은 줄에 같은 숫자를 넣으면 겹침, 정답과 다르면 실수로 센다', () => {
    let s = createGame(puzzle());
    s = applyAction(s, { type: 'place', cell: 0, digit: 3 }); // 같은 가로줄에 3이 있다
    expect(s.events[0]).toMatchObject({ type: 'place', conflict: true, wrong: true });
    expect(s.mistakes).toBe(1);
    expect(wrongCells(s).has(0)).toBe(true);
  });

  it('정답을 모두 채우면 완성되고, 그 뒤로는 바꿀 수 없다', () => {
    let s = createGame(puzzle());
    const empties = s.values.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    for (const i of empties) s = applyAction(s, { type: 'place', cell: i, digit: sol[i] });
    expect(s.status).toBe('solved');
    expect(s.events.some((e) => e.type === 'complete')).toBe(true);
    const after = applyAction(s, { type: 'erase', cell: empties[0] });
    expect(after.values[empties[0]]).toBe(sol[empties[0]]);
    expect(after.events).toEqual([{ type: 'blocked', reason: 'solved' }]);
  });

  it('줄을 다 채우면 그 묶음을 알려 준다', () => {
    let s = createGame(puzzle());
    const row0 = [0, 1, 3, 5, 7, 8].filter((i) => !s.values[i]);
    for (const i of row0.slice(0, -1)) s = applyAction(s, { type: 'place', cell: i, digit: sol[i] });
    expect(s.events.some((e) => e.type === 'unitDone')).toBe(false);
    const last = row0[row0.length - 1];
    s = applyAction(s, { type: 'place', cell: last, digit: sol[last] });
    const done = s.events.find((e) => e.type === 'unitDone');
    expect(done && done.type === 'unitDone' && done.units).toContain(0);
  });

  it('다 채운 뒤 확인: 다 채우기 전엔 조용하다가, 틀린 채로 다 채우면 틀린 칸을 보여 준다', () => {
    let s = createGame(puzzle(), 'end');
    const empties = s.values.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    const bad = empties[0];
    s = applyAction(s, { type: 'place', cell: bad, digit: wrongDigit(bad) });
    expect(s.showWrong).toBe(false);
    for (const i of empties.slice(1)) s = applyAction(s, { type: 'place', cell: i, digit: sol[i] });
    expect(s.status).toBe('playing');
    expect(s.showWrong).toBe(true);
    expect(s.events.some((e) => e.type === 'checkFailed' && e.wrong === 1)).toBe(true);
    s = applyAction(s, { type: 'place', cell: bad, digit: sol[bad] });
    expect(s.status).toBe('solved');
  });

  it('시계는 푸는 동안에만 간다', () => {
    let s = createGame(puzzle());
    s = run(s, { type: 'tick', ms: 1500 }, { type: 'tick', ms: 500 });
    expect(s.elapsedMs).toBe(2000);
    const solved = { ...s, status: 'solved' as const };
    expect(applyAction(solved, { type: 'tick', ms: 1000 }).elapsedMs).toBe(2000);
  });
});

describe('힌트', () => {
  it('정답 숫자로 한 칸을 채우고, 어떻게 찾는지 설명한다', () => {
    let s = createGame(puzzle());
    s = applyAction(s, { type: 'hint', cell: 0 });
    const ev = s.events[0];
    expect(ev.type).toBe('hint');
    if (ev.type !== 'hint') return;
    expect(s.values[ev.hint.cell]).toBe(sol[ev.hint.cell]);
    expect(['single', 'hidden']).toContain(ev.hint.kind);
    expect(ev.hint.message).toContain(String(ev.hint.digit));
    expect(s.hintsUsed).toBe(1);
    expect(s.hinted).toContain(ev.hint.cell);
  });

  it('하나만 남은 칸이면 "이 칸에는 ~만 들어갈 수 있어요"', () => {
    let s = createGame(puzzle());
    const empties = s.values.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    for (const i of empties.slice(1)) s = applyAction(s, { type: 'place', cell: i, digit: sol[i] });
    const hint = findHint(s, empties[0])!;
    expect(hint.kind).toBe('single');
    expect(hint.message).toContain(`이 칸에는 ${sol[empties[0]]}만 들어갈 수 있어요`);
  });

  it('틀린 숫자가 있으면 먼저 고쳐 준다', () => {
    let s = createGame(puzzle());
    s = applyAction(s, { type: 'place', cell: 0, digit: wrongDigit(0) });
    s = applyAction(s, { type: 'hint' });
    expect(s.values[0]).toBe(sol[0]);
    expect(s.lastHint).toMatchObject({ kind: 'fix', cell: 0 });
  });

  it('쉬운 방법으로 못 찾으면 정답을 알려 준다 (아주 어려운 문제)', () => {
    const escSol = gridToString(solve(parseGrid(ESCARGOT))!);
    const s = createGame(puzzle(ESCARGOT, escSol));
    const hint = findHint(s, 1)!;
    expect(hint.digit).toBe(solutionOf(s.puzzle)[hint.cell]);
    expect(['hidden', 'single', 'advanced', 'reveal']).toContain(hint.kind);
  });

  it('single이 없으면 어려운 방법으로 후보를 줄인 뒤 찾은 칸을 알려 준다', () => {
    const grid = parseGrid('4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......');
    const b = new LogicBoard(grid);
    while (b.nakedSingles() + b.hiddenSingles() > 0);
    const stuck = Array.from(b.values);
    const p = puzzle(gridToString(grid), gridToString(solve(grid)!));
    const s = { ...createGame(p), values: stuck };
    const hint = findHint(s)!;
    expect(hint.kind).toBe('advanced');
    expect(hint.message).toMatch(/‘.+’ 방법으로 후보를 줄이면/);
    expect(hint.digit).toBe(solutionOf(p)[hint.cell]);
  });

  it('숫자 뒤 조사를 받침에 맞게 붙인다', () => {
    expect(digitJosa(7, '이/가')).toBe('7이');
    expect(digitJosa(2, '이/가')).toBe('2가');
    expect(digitJosa(3, '은/는')).toBe('3은');
    expect(digitIs(9)).toBe('9예요');
    expect(digitIs(8)).toBe('8이에요');
  });
});

describe('저장과 기록', () => {
  it('저장한 게임을 JSON으로 왔다 갔다 해도 그대로 불러오고, 망가진 저장은 버린다', () => {
    let s = createGame(puzzle());
    s = run(s, { type: 'note', cell: 1, digit: 2 }, { type: 'place', cell: 0, digit: 4 }, { type: 'tick', ms: 3000 });
    const back = validateState(JSON.parse(JSON.stringify(s)))!;
    expect(back.values).toEqual(s.values);
    expect(back.undo).toEqual(s.undo);
    expect(validateState({ ...s, values: s.values.slice(1) })).toBeNull();
    expect(validateState({ ...s, values: s.values.map((v, i) => (i === 2 ? 9 : v)) })).toBeNull(); // 처음 숫자가 바뀜
    expect(validateState({ ...s, puzzle: { ...s.puzzle, solution: '1'.repeat(81) } })).toBeNull();
    expect(validateState(null)).toBeNull();
  });

  it('힌트 없이 더 빨리 풀었을 때만 최고 기록이 된다', () => {
    let r = emptyRecords();
    let out = recordSolve(r, 'easy', 300000, 0);
    expect(out.newBest).toBe(true);
    r = out.records;
    out = recordSolve(r, 'easy', 200000, 2);
    expect(out.newBest).toBe(false);
    expect(out.records.easy).toEqual({ solved: 2, bestMs: 300000 });
    out = recordSolve(out.records, 'easy', 250000, 0);
    expect(out.records.easy.bestMs).toBe(250000);
  });

  it('시간은 분:초로 보여 준다', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65_400)).toBe('1:05');
    expect(formatTime(3_723_000)).toBe('1:02:03');
  });
});

describe('배경음악', () => {
  it('16마디, 마디마다 8분음표 8개, 느리고 북 없는 곡', () => {
    expect(SUDOKU_SONG.bars).toHaveLength(16);
    for (const bar of SUDOKU_SONG.bars) expect(bar.melody).toHaveLength(8);
    expect(SUDOKU_SONG.bpm).toBeGreaterThanOrEqual(84);
    expect(SUDOKU_SONG.bpm).toBeLessThanOrEqual(92);
    expect(SUDOKU_SONG.drums).toBe('none');
  });
});
