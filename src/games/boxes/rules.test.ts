import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import {
  applyAction,
  boxLines,
  captureLines,
  completesCount,
  computeRanks,
  createGame,
  geometry,
  givesCount,
  hLine,
  isHorizontal,
  lineBoxes,
  lineCount,
  lineDots,
  lineInfo,
  recommendedSize,
  safeLines,
  vLine,
  winners,
} from './rules';
import { centerLine, moveCursor } from './cursor';
import { isValidState } from './storage';
import { boardFromAscii } from './testBoard';
import type { BoxesSetup, BoxesState, SeatKind } from './types';

function setup(kinds: SeatKind[], size = 4, noExtraTurn = false): BoxesSetup {
  const seats = [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as BoxesSetup['seats'];
  return { seats, options: { size, noExtraTurn, warnings: true } };
}

function line(s: BoxesState, e: number): BoxesState {
  const next = applyAction(s, { type: 'line', edge: e });
  expect(next).not.toBe(s);
  return next;
}

describe('선 번호 매기기', () => {
  it('n×n 판의 선은 2n(n+1)개이고 가로선 다음에 세로선 번호가 온다', () => {
    expect(lineCount(3)).toBe(24);
    expect(lineCount(6)).toBe(84);
    expect(hLine(4, 0, 0)).toBe(0);
    expect(hLine(4, 4, 3)).toBe(19);
    expect(vLine(4, 0, 0)).toBe(20);
    expect(vLine(4, 3, 4)).toBe(39);
    expect(isHorizontal(4, 19)).toBe(true);
    expect(isHorizontal(4, 20)).toBe(false);
  });

  it('선 번호 ↔ 위치 ↔ 양 끝 점이 서로 맞는다', () => {
    for (const n of [3, 4, 5, 6]) {
      for (let e = 0; e < lineCount(n); e++) {
        const { horizontal, r, c } = lineInfo(n, e);
        expect(horizontal ? hLine(n, r, c) : vLine(n, r, c)).toBe(e);
        const [a, b] = lineDots(n, e);
        // 이웃한 두 점 (거리 1)
        expect(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])).toBe(1);
        expect([...a, ...b].every((v) => v >= 0 && v <= n)).toBe(true);
      }
    }
  });

  it('상자의 네 변과 선에 붙은 상자가 서로 맞는다 (테두리 선은 상자 1개, 안쪽 선은 2개)', () => {
    const n = 5;
    const g = geometry(n);
    expect(boxLines(n, 0)).toEqual([hLine(n, 0, 0), hLine(n, 1, 0), vLine(n, 0, 0), vLine(n, 0, 1)]);
    for (let b = 0; b < n * n; b++) {
      expect(new Set(boxLines(n, b)).size).toBe(4);
      for (const l of boxLines(n, b)) expect(lineBoxes(n, l)).toContain(b);
    }
    const border = g.lineBoxes.filter((bs) => bs.length === 1).length;
    expect(border).toBe(4 * n);
    expect(g.lineBoxes.every((bs) => bs.length === 1 || bs.length === 2)).toBe(true);
    expect(lineBoxes(n, hLine(n, 0, 2))).toEqual([2]);
    expect(lineBoxes(n, vLine(n, 1, 1)).sort()).toEqual([5, 6]);
  });
});

describe('키보드 커서', () => {
  it('←→는 같은 줄, ↑↓는 가로선 줄과 세로선 줄을 번갈아 움직이고 판 밖으로 나가지 않는다', () => {
    const n = 4;
    const start = hLine(n, 1, 2);
    expect(moveCursor(n, start, 'right')).toBe(hLine(n, 1, 3));
    expect(moveCursor(n, hLine(n, 1, 3), 'right')).toBe(hLine(n, 1, 3));
    expect(moveCursor(n, start, 'down')).toBe(vLine(n, 1, 2));
    expect(moveCursor(n, moveCursor(n, start, 'down'), 'down')).toBe(hLine(n, 2, 2));
    expect(moveCursor(n, moveCursor(n, start, 'up'), 'up')).toBe(hLine(n, 0, 2));
    expect(moveCursor(n, hLine(n, 0, 0), 'up')).toBe(hLine(n, 0, 0));
    expect(moveCursor(n, vLine(n, 2, 4), 'down')).toBe(hLine(n, 3, 3));
    expect(moveCursor(n, vLine(n, 0, 0), 'left')).toBe(vLine(n, 0, 0));
    expect(centerLine(n)).toBe(hLine(n, 2, 1));
  });

  it('어디서 어느 쪽으로 움직여도 올바른 선 번호이고, 모든 선에 갈 수 있다', () => {
    for (const n of [3, 6]) {
      const seen = new Set([centerLine(n)]);
      const queue = [centerLine(n)];
      while (queue.length) {
        const e = queue.pop()!;
        for (const d of ['up', 'down', 'left', 'right'] as const) {
          const m = moveCursor(n, e, d);
          expect(m >= 0 && m < lineCount(n)).toBe(true);
          if (!seen.has(m)) {
            seen.add(m);
            queue.push(m);
          }
        }
      }
      expect(seen.size).toBe(lineCount(n));
    }
  });
});

describe('게임 만들기', () => {
  it('비운 자리는 빼고, 판 크기만큼 빈 선과 빈 상자를 만든다', () => {
    const s = createGame(setup(['human', 'empty', 'ai-easy', 'ai-normal'], 5), () => 0.99);
    expect(s.players.map((p) => p.seat)).toEqual([0, 2, 3]);
    expect(s.players.map((p) => p.name)).toEqual(['빨강', '노랑', '파랑']);
    expect(s.size).toBe(5);
    expect(s.lines).toHaveLength(60);
    expect(s.lines.every((p) => p === -1)).toBe(true);
    expect(s.boxes).toHaveLength(25);
    expect(s.starter).toBe(2);
    expect(s.current).toBe(2);
    expect(s.phase).toBe('play');
  });

  it('2명보다 적으면 시작할 수 없고, 이상한 판 크기는 4×4로 바꾼다', () => {
    expect(() => createGame(setup(['human']))).toThrow();
    const s = createGame(setup(['human', 'human'], 9));
    expect(s.size).toBe(4);
  });

  it('추천 판 크기: 2명은 4×4, 3~4명은 5×5', () => {
    expect(recommendedSize(2)).toBe(4);
    expect(recommendedSize(3)).toBe(5);
    expect(recommendedSize(4)).toBe(5);
  });
});

describe('선 긋기와 상자 완성', () => {
  it('선을 그으면 그 사람 색으로 표시되고 차례가 넘어간다. 원래 상태는 그대로', () => {
    const s0 = createGame(setup(['human', 'human']), () => 0);
    const s1 = line(s0, 5);
    expect(s1.lines[5]).toBe(0);
    expect(s0.lines[5]).toBe(-1);
    expect(s1.current).toBe(1);
    expect(s1.turn).toBe(s0.turn + 1);
    expect(s1.history).toEqual([5]);
    expect(s1.events.map((e) => e.type)).toEqual(['line', 'turn']);
  });

  it('이미 그은 선, 판 밖 번호, 끝난 게임에는 아무 일도 없다', () => {
    const s0 = createGame(setup(['human', 'human']), () => 0);
    const s1 = line(s0, 5);
    expect(applyAction(s1, { type: 'line', edge: 5 })).toBe(s1);
    expect(applyAction(s1, { type: 'line', edge: -1 })).toBe(s1);
    expect(applyAction(s1, { type: 'line', edge: 40 })).toBe(s1);
    expect(applyAction(s1, { type: 'line', edge: 2.5 })).toBe(s1);
    const over: BoxesState = { ...s1, phase: 'gameover' };
    expect(applyAction(over, { type: 'line', edge: 6 })).toBe(over);
  });

  it('네 번째 변을 그으면 상자가 내 것이 되고 한 번 더 한다', () => {
    const s = boardFromAscii(
      `
      +-+ + +
      | | | |
      + + + +
      |     |
      + + + +
      |     |
      +-+-+-+
      `,
      { current: 1 },
    );
    const e = hLine(3, 1, 0);
    expect(completesCount(s, e)).toBe(1);
    const next = line(s, e);
    expect(next.boxes[0]).toBe(1);
    expect(next.players[1].score).toBe(1);
    expect(next.current).toBe(1);
    expect(next.turn).toBe(s.turn);
    expect(next.events.map((x) => x.type)).toEqual(['line', 'box', 'again']);
    expect(next.log[next.log.length - 1].text).toContain('한 번 더');
  });

  it('선 하나로 상자 두 개를 한꺼번에 완성할 수 있다', () => {
    const s = boardFromAscii(`
      +-+-+-+
      |   |
      +-+-+ +
      |     |
      + + + +
      |     |
      +-+-+-+
    `);
    // 위 줄 상자 (0,0)과 (0,1) 사이 세로선
    const e = vLine(3, 0, 1);
    expect(completesCount(s, e)).toBe(2);
    const next = line(s, e);
    expect(next.boxes.slice(0, 2)).toEqual([0, 0]);
    expect(next.players[0].score).toBe(2);
    const boxEvent = next.events.find((x) => x.type === 'box');
    expect(boxEvent && boxEvent.type === 'box' && boxEvent.boxes.sort()).toEqual([0, 1]);
    expect(next.current).toBe(0);
  });

  it('간단 규칙: 상자를 만들어도 차례가 넘어간다', () => {
    const s = boardFromAscii(
      `
      +-+ + +
      | | | |
      + + + +
      |     |
      + + + +
      |     |
      +-+-+-+
      `,
      { noExtraTurn: true },
    );
    const next = line(s, hLine(3, 1, 0));
    expect(next.boxes[0]).toBe(0);
    expect(next.players[0].score).toBe(1);
    expect(next.current).toBe(1);
    expect(next.events.map((x) => x.type)).toEqual(['line', 'box', 'turn']);
    expect(next.log[next.log.length - 1].text).not.toContain('한 번 더');
  });

  it('안전한 선 / 상자를 완성하는 선 / 세 번째 변을 만드는 선을 구별한다', () => {
    const s = boardFromAscii(`
      +-+ + +
      |     |
      + + + +
      |     |
      + + + +
      |
      + + + +
    `);
    // 상자 0은 변 2개(위, 왼쪽): 그 상자의 다른 변은 위험
    expect(givesCount(s, hLine(3, 1, 0))).toBe(1);
    expect(safeLines(s)).not.toContain(hLine(3, 1, 0));
    expect(safeLines(s)).not.toContain(vLine(3, 0, 1));
    expect(safeLines(s)).toContain(hLine(3, 0, 2));
    expect(captureLines(s)).toEqual([]);
    const s2 = line(s, hLine(3, 1, 0));
    expect(captureLines(s2)).toEqual([vLine(3, 0, 1)]);
    expect(s2.log[s2.log.length - 1].text).toContain('세 번째 선');
  });

  it('안전한 선이 다 떨어지면 한 번 알려 준다', () => {
    const s = boardFromAscii(`
      +-+-+-+
      |     |
      +-+-+-+
      |     |
      +-+-+ +
      |     |
      +-+-+-+
    `);
    expect(safeLines(s).length).toBe(0);
    const next = line(s, vLine(3, 0, 1));
    expect(next.safeGone).toBe(true);
    expect(next.log.some((l) => l.text.includes('안전한 선이 없어요'))).toBe(true);
  });
});

describe('게임 끝과 순위', () => {
  it('마지막 선을 그으면 끝나고 상자가 많은 순서로 순위를 매긴다', () => {
    const s = boardFromAscii(
      `
      +-+-+-+
      |1|1|0|
      +-+-+-+
      |1|0|1|
      +-+-+-+
      |0|0|
      +-+-+ +
      `,
      { current: 1 },
    );
    expect(s.players.map((p) => p.score)).toEqual([4, 4]);
    // 마지막 상자의 남은 변 2개: 첫 번째는 세 번째 변, 두 번째로 완성
    const a = line(s, vLine(3, 2, 3));
    expect(a.phase).toBe('play');
    expect(a.current).toBe(0);
    const b = line(a, hLine(3, 3, 2));
    expect(b.phase).toBe('gameover');
    expect(b.players.map((p) => p.score)).toEqual([5, 4]);
    expect(b.rankings).toEqual([0, 1]);
    expect(b.ranks).toEqual([1, 2]);
    expect(winners(b)).toEqual([0]);
    expect(b.events.some((e) => e.type === 'end')).toBe(true);
    expect(b.log[b.log.length - 1].text).toContain('이겼어요');
  });

  it('같은 점수는 같은 등수 (공동 1등, 다음은 3등), 모두 같으면 모두 1등', () => {
    expect(computeRanks([3, 3, 1]).ranks).toEqual([1, 1, 3]);
    expect(computeRanks([3, 3, 1]).rankings).toEqual([0, 1, 2]);
    expect(computeRanks([2, 5, 5, 4]).ranks).toEqual([4, 1, 1, 3]);
    expect(computeRanks([2, 5, 5, 4]).rankings).toEqual([1, 2, 3, 0]);
    expect(computeRanks([4, 4]).ranks).toEqual([1, 1]);
  });

  it('모두 같은 점수면 모두 1등이고 비겼다고 기록한다', () => {
    const s = boardFromAscii(
      `
      +-+-+-+
      |0|1|2|
      +-+-+-+
      |2|0|1|
      +-+-+-+
      |1|2|
      +-+-+ +
      `,
      { players: 3, current: 2 },
    );
    expect(s.players.map((p) => p.score)).toEqual([2, 3, 3]);
    const a = line(s, vLine(3, 2, 3));
    expect(a.current).toBe(0);
    const b = line(a, hLine(3, 3, 2));
    expect(b.phase).toBe('gameover');
    expect(b.players.map((p) => p.score)).toEqual([3, 3, 3]);
    expect(b.ranks).toEqual([1, 1, 1]);
    expect(winners(b)).toEqual([0, 1, 2]);
    expect(b.log[b.log.length - 1].text).toContain('비겼어요');
  });

  it('아무렇게나 끝까지 그어도 상자 합은 n×n이고 저장할 수 있는 상태다', () => {
    for (const [n, seed] of [
      [3, 1],
      [6, 2],
    ]) {
      const rng = seededRandom(seed);
      let s = createGame(setup(['human', 'human', 'human'], n), rng);
      let steps = 0;
      while (s.phase === 'play') {
        const open = s.lines.map((p, e) => (p === -1 ? e : -1)).filter((e) => e >= 0);
        s = line(s, open[Math.floor(rng() * open.length)]);
        steps += 1;
        if (steps % 7 === 0) expect(isValidState(JSON.parse(JSON.stringify(s)))).toBe(true);
      }
      expect(steps).toBe(lineCount(n));
      expect(s.players.reduce((a, p) => a + p.score, 0)).toBe(n * n);
      expect(s.boxes.every((o) => o >= 0)).toBe(true);
      expect(s.history).toHaveLength(lineCount(n));
    }
  });

  it('망가진 저장 상태는 받아들이지 않는다', () => {
    const s = line(createGame(setup(['human', 'ai-normal']), () => 0), 3);
    expect(isValidState(s)).toBe(true);
    expect(isValidState({ ...s, size: 7 })).toBe(false);
    expect(isValidState({ ...s, lines: s.lines.slice(1) })).toBe(false);
    expect(isValidState({ ...s, boxes: s.boxes.map((_, i) => (i === 0 ? 0 : -1)) })).toBe(false);
    expect(isValidState({ ...s, players: s.players.map((p) => ({ ...p, score: 3 })) })).toBe(false);
    expect(isValidState({ ...s, current: 5 })).toBe(false);
    expect(isValidState(null)).toBe(false);
  });
});
