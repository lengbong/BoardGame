import { describe, expect, it } from 'vitest';
import { generatePuzzle } from './generator';
import { parseGrid } from './grid';
import { LogicBoard, findLogicalStep, gradePuzzle } from './logic';
import { solve } from './solver';

/** 하나만 남은 칸으로만 풀리는 문제 */
const EASY = '003020600900305001001806400008102900700000008006708200002609500800203009005010300';
/** 가리키기(pointing)가 필요한 문제 */
const POINTING = '4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......';
/** X-윙이 필요한 문제 */
const XWING = '1.....569492.561.8.561.924...964.8.1.64.1....218.356.4.4.5...169.5.614.2621.....5';
/** XY-윙이 필요한 문제 */
const XYWING = '9..24.....5.69.231.2..5..9..9.7..32...29356.7.7...29...69.2..7351..79.622.7.86..9';
/** 매우 어려운 문제로 알려진 것 (사람 방법 풀이기로는 못 푼다) */
const ESCARGOT = '1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..';

describe('사람 방법 풀이기 (난이도 매기기)', () => {
  it('쉬운 문제는 1단계 (single만으로 풀림)', () => {
    const r = gradePuzzle(parseGrid(EASY));
    expect(r.solved).toBe(true);
    expect(r.level).toBe(1);
    expect(Object.keys(r.counts).every((t) => t === 'nakedSingle' || t === 'hiddenSingle')).toBe(true);
  });

  it('가리키기가 필요한 문제는 2단계', () => {
    const r = gradePuzzle(parseGrid(POINTING));
    expect(r.solved).toBe(true);
    expect(r.level).toBe(2);
    expect(r.counts.pointing).toBeGreaterThan(0);
    // 1단계만 쓰면 못 푼다
    expect(gradePuzzle(parseGrid(POINTING), 1)).toMatchObject({ solved: false, level: 2 });
  });

  it('X-윙·XY-윙이 필요한 문제는 3단계이고, 2단계까지로는 못 푼다', () => {
    const x = gradePuzzle(parseGrid(XWING));
    expect(x).toMatchObject({ solved: true, level: 3 });
    expect(x.counts.xWing).toBeGreaterThan(0);
    const y = gradePuzzle(parseGrid(XYWING));
    expect(y).toMatchObject({ solved: true, level: 3 });
    expect(y.counts.xyWing).toBeGreaterThan(0);
    expect(gradePuzzle(parseGrid(XWING), 2)).toMatchObject({ solved: false, level: 3 });
  });

  it('아주 어려운 문제는 4단계 (풀이기로 못 풂)', () => {
    expect(gradePuzzle(parseGrid(ESCARGOT))).toMatchObject({ solved: false, level: 4 });
  });

  it('어떤 방법도 정답 숫자를 후보에서 지우지 않는다 (여러 문제로 확인)', () => {
    const puzzles = [XWING, XYWING, POINTING, ESCARGOT].map(parseGrid);
    for (const [d, seeds] of [
      ['hard', [11, 12]],
      ['expert', [21, 22]],
    ] as const) {
      for (const seed of seeds) puzzles.push(parseGrid(generatePuzzle(d, seed).givens));
    }
    for (const p of puzzles) {
      const sol = solve(p)!;
      const b = new LogicBoard(p);
      for (let guard = 0; guard < 400 && b.remaining > 0 && !b.broken; guard++) {
        if (!b.nakedSingles() && !b.hiddenSingles() && !b.eliminateStep(3)) break;
        for (let i = 0; i < 81; i++) {
          if (b.values[i]) expect(b.values[i]).toBe(sol[i]);
          else expect(b.cands[i] & (1 << (sol[i] - 1))).not.toBe(0);
        }
      }
      expect(b.broken).toBe(false);
    }
  });
});

describe('힌트용 한 걸음 찾기', () => {
  it('고른 칸이 하나만 남은 칸이면 그 칸을 알려 준다', () => {
    const g = parseGrid(EASY);
    const sol = solve(g)!;
    // 판을 거의 다 채우고 한 칸만 비운다 → 그 칸은 naked single
    const almost = [...sol];
    almost[40] = 0;
    const step = findLogicalStep(almost, 40)!;
    expect(step).toMatchObject({ cell: 40, digit: sol[40], technique: 'nakedSingle', via: [] });
  });

  it('여기밖에 없는 칸이면 어느 묶음에서 찾았는지 알려 준다', () => {
    const g = parseGrid(EASY);
    const sol = solve(g)!;
    const step = findLogicalStep(g)!;
    expect(step.digit).toBe(sol[step.cell]);
    if (step.technique === 'hiddenSingle') expect(step.unit).toBeGreaterThanOrEqual(0);
    // 0번 칸(후보 4·5)은 single이 아니라서 다른 칸을 찾는다
    const step0 = findLogicalStep(g, 0)!;
    expect(step0.digit).toBe(sol[step0.cell]);
  });

  it('어려운 방법을 써야 하면 쓴 방법을 함께 알려 준다', () => {
    const step = findLogicalStep(parseGrid(XWING))!;
    const sol = solve(parseGrid(XWING))!;
    expect(step.digit).toBe(sol[step.cell]);
  });
});
