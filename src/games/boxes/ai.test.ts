import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { captureInfo, decideAction, describeComponents } from './ai';
import { applyAction, captureLines, createGame, hLine, lineCount, safeLines, vLine } from './rules';
import { boardFromAscii } from './testBoard';
import type { AiLevel, BoxesSetup, BoxesState, SeatKind } from './types';

const LEVELS: AiLevel[] = ['ai-easy', 'ai-normal'];

function setup(kinds: SeatKind[], size: number, noExtraTurn = false): BoxesSetup {
  const seats = [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as BoxesSetup['seats'];
  return { seats, options: { size, noExtraTurn, warnings: true } };
}

/** 컴퓨터끼리 끝까지. 매 수마다 check를 부른다. */
function playOut(s: BoxesState, rng: () => number, check?: (before: BoxesState, edge: number) => void): BoxesState {
  let steps = 0;
  while (s.phase === 'play') {
    const p = s.players[s.current];
    const action = decideAction(s, p.kind === 'human' ? 'ai-normal' : p.kind, rng);
    check?.(s, action.edge);
    const next = applyAction(s, action);
    expect(next).not.toBe(s);
    s = next;
    steps += 1;
    expect(steps).toBeLessThanOrEqual(lineCount(s.size));
  }
  return s;
}

/*
 * 끝판 1: 위 두 줄은 4칸 사슬 2개, 아래 줄에서 상대가 2칸 사슬을 반쯤 열어 줬다.
 *   (3,0)은 세 변(가져갈 수 있음), (3,1)은 두 변이고 그 바닥 선은 판 밖으로 이어진다.
 */
const DOUBLE_CROSS = `
  +-+-+-+-+

  +-+-+-+-+

  +-+-+-+-+
  |1|1|0|0|
  +-+-+-+-+
  |   |1|0|
  +-+ +-+-+
`;

/* 끝판 2: 같은 모양인데 남은 것은 구석의 1칸 사슬 하나뿐 */
const TAKE_ALL = `
  + +-+-+-+
    |1|0|1|
  +-+-+-+-+
  |0|1|0|1|
  +-+-+-+-+
  |1|1|0|0|
  +-+-+-+-+
  |   |1|0|
  +-+ +-+-+
`;

/* 끝판 3: 4칸 사슬(맨 위 줄), 3칸 사슬(오른쪽 세로), 1칸 사슬(왼쪽 아래 구석) */
const THREE_CHAINS = `
  +-+-+-+-+

  +-+-+-+-+
  |0|1|0|
  +-+-+-+ +
  |1|0|1| |
  +-+-+-+ +
    |0|1| |
  + +-+-+ +
`;

/* 끝판 4: 4칸, 3칸 사슬과 아래 줄 2칸 사슬 */
const TWO_CHAIN = `
  +-+-+-+-+

  +-+-+-+-+
  |0|1|0|
  +-+-+-+ +
  |1|0|1| |
  +-+-+-+ +
      |1| |
  +-+ +-+ +
`;

describe('컴퓨터: 상자 가져가기', () => {
  it('가져갈 상자가 있으면 쉬움·보통 모두 가져간다', () => {
    const s = boardFromAscii(`
      +-+ + +
      | | | |
      + + + +
      |     |
      + + + +
      |     |
      +-+-+-+
    `);
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 5; seed++) {
        expect(decideAction(s, level, seededRandom(seed)).edge).toBe(hLine(3, 1, 0));
      }
    }
  });

  it('긴 사슬 가운데 상자는 망설이지 않고 먹는다', () => {
    const s = boardFromAscii(`
      +-+-+-+
      |
      +-+-+-+
      |0|1|0|
      +-+-+-+
      |1|0|1|
      +-+-+-+
    `);
    // 맨 위 줄 3칸 사슬의 왼쪽 상자가 세 변: 다 먹어도 되는 곳
    const info = captureInfo(s);
    expect(info?.forced).toBe(vLine(3, 0, 1));
    expect(decideAction(s, 'ai-normal').edge).toBe(vLine(3, 0, 1));
  });

  it('사슬 끝 2개·고리 끝 4개에서만 남겨 줄지 고민한다', () => {
    const chainEnd = captureInfo(boardFromAscii(DOUBLE_CROSS));
    expect(chainEnd?.forced).toBeNull();
    expect(chainEnd?.decision).toEqual({ take: vLine(4, 3, 1), hairpin: hLine(4, 4, 1), cost: 2 });

    // 2×2 고리를 상대가 한 군데 열어 준 모양
    const loop = captureInfo(
      boardFromAscii(`
        +-+-+-+
        |   |0|
        + +-+-+
        |   |1|
        +-+-+-+
        |0|1|0|
        +-+-+-+
      `),
    );
    expect(loop?.decision?.cost).toBe(4);
    expect(loop?.decision?.hairpin).toBe(hLine(3, 1, 0));
  });

  it('남은 긴 사슬이 많으면 마지막 두 상자를 남겨 주고 주도권을 지킨다 (더블 크로스)', () => {
    const s = boardFromAscii(DOUBLE_CROSS);
    expect(decideAction(s, 'ai-normal', seededRandom(1)).edge).toBe(hLine(4, 4, 1));
    // 끝까지 보통끼리 두면 남겨 준 쪽(0번)이 이긴다: 0번 3+2+4 = 9, 1번 3+2+2 = 7
    const end = playOut(s, seededRandom(2));
    expect(end.players.map((p) => p.score)).toEqual([9, 7]);
  });

  it('고리 끝에서도 이득이면 네 상자를 남겨 준다', () => {
    // 위 두 줄은 5칸 사슬 2개, 왼쪽 아래 2×2 고리를 상대가 열어 줬다.
    const s = boardFromAscii(`
      +-+-+-+-+-+
     
      +-+-+-+-+-+
     
      +-+-+-+-+-+
      |0|1|0|1|0|
      +-+-+-+-+-+
      |   |1|0|1|
      + +-+-+-+-+
      |   |0|1|0|
      +-+-+-+-+-+
    `);
    expect(captureInfo(s)?.decision).toEqual({ take: vLine(5, 3, 1), hairpin: hLine(5, 4, 0), cost: 4 });
    expect(decideAction(s, 'ai-normal', seededRandom(1)).edge).toBe(hLine(5, 4, 0));
  });

  it('남겨 줘도 이득이 없으면 다 먹는다', () => {
    const s = boardFromAscii(TAKE_ALL);
    expect(decideAction(s, 'ai-normal', seededRandom(1)).edge).toBe(vLine(4, 3, 1));
  });

  it('상대가 남겨 준 두 상자(도미노)는 한 번에 가져간다', () => {
    const s = applyAction(boardFromAscii(DOUBLE_CROSS), { type: 'line', edge: hLine(4, 4, 1) });
    expect(s.current).toBe(1);
    expect(decideAction(s, 'ai-normal').edge).toBe(vLine(4, 3, 1));
    expect(decideAction(s, 'ai-easy').edge).toBe(vLine(4, 3, 1));
  });
});

describe('컴퓨터: 안전한 선과 내주기', () => {
  it('안전한 선이 있으면 보통은 세 번째 변을 긋지 않는다', () => {
    for (const size of [3, 4, 5, 6]) {
      let checked = 0;
      const rng = seededRandom(size * 11);
      playOut(createGame(setup(['ai-normal', 'ai-easy'], size), rng), rng, (s, edge) => {
        if (s.players[s.current].kind !== 'ai-normal') return;
        const safe = safeLines(s);
        if (safe.length > 0 && captureLines(s).length === 0) {
          expect(safe).toContain(edge);
          checked += 1;
        }
      });
      expect(checked).toBeGreaterThan(2);
    }
  });

  it('쉬움은 가끔 실수하지만 반쯤은 안전한 선을 고른다', () => {
    const s = createGame(setup(['ai-easy', 'ai-easy'], 4), () => 0);
    // 상자 하나가 두 변인 판: 위험한 선 2개, 나머지는 안전
    const t = applyAction(applyAction(s, { type: 'line', edge: hLine(4, 0, 0) }), { type: 'line', edge: hLine(4, 4, 3) });
    const u = applyAction(t, { type: 'line', edge: vLine(4, 0, 0) });
    const risky = new Set([hLine(4, 1, 0), vLine(4, 0, 1)]);
    let riskyPicks = 0;
    for (let seed = 1; seed <= 200; seed++) if (risky.has(decideAction(u, 'ai-easy', seededRandom(seed)).edge)) riskyPicks += 1;
    expect(riskyPicks).toBeGreaterThan(0);
    expect(riskyPicks).toBeLessThan(20);
  });

  it('안전한 선이 없으면 가장 작은 사슬을 내준다', () => {
    const s = boardFromAscii(THREE_CHAINS);
    expect(safeLines(s)).toEqual([]);
    expect(
      describeComponents(s)
        .map((c) => `${c.kind}${c.size}`)
        .sort(),
    ).toEqual(['chain1', 'chain3', 'chain4']);
    for (let seed = 1; seed <= 5; seed++) {
      expect([vLine(4, 3, 0), hLine(4, 4, 0)]).toContain(decideAction(s, 'ai-normal', seededRandom(seed)).edge);
    }
  });

  it('2칸 사슬은 가운데 선으로 내줘서 상대가 남겨 주기를 못 하게 한다', () => {
    const s = boardFromAscii(TWO_CHAIN);
    expect(
      describeComponents(s)
        .map((c) => `${c.kind}${c.size}`)
        .sort(),
    ).toEqual(['chain2', 'chain3', 'chain4']);
    expect(decideAction(s, 'ai-normal', seededRandom(3)).edge).toBe(vLine(4, 3, 1));
    // 그렇게 끝까지 두면 0번이 9칸 중 5칸
    const before = s.players.map((p) => p.score);
    const end = playOut(s, seededRandom(4));
    expect(end.players[0].score - before[0]).toBe(5);
  });

  it('고리는 사슬과 구별하고, 4칸 고리를 열면 상대는 4개를 남겨 줄 수 있다', () => {
    const s = boardFromAscii(`
      +-+-+-+
      |   |0|
      + + +-+
      |   |1|
      +-+-+-+
      |0|1|0|
      +-+-+-+
    `);
    expect(describeComponents(s)).toEqual([{ kind: 'loop', size: 4 }]);
  });
});

describe('컴퓨터끼리 끝까지', () => {
  it('여러 판 크기·시드에서 보통끼리, 보통 대 쉬움 모두 끝까지 간다', () => {
    for (const size of [3, 4, 5, 6]) {
      for (const seed of [1, 2]) {
        const rng = seededRandom(seed * 100 + size);
        const kinds: SeatKind[] = seed === 1 ? ['ai-normal', 'ai-normal'] : ['ai-easy', 'ai-normal'];
        const end = playOut(createGame(setup(kinds, size), rng), rng);
        expect(end.phase).toBe('gameover');
        expect(end.lines.every((p) => p !== -1)).toBe(true);
        expect(end.players.reduce((a, p) => a + p.score, 0)).toBe(size * size);
        expect(end.ranks[end.rankings[0]]).toBe(1);
      }
    }
  });

  it('3~4명 게임과 간단 규칙(한 번 더 없음)도 끝까지 간다', () => {
    const games: [SeatKind[], number, boolean][] = [
      [['ai-normal', 'ai-easy', 'ai-normal'], 5, false],
      [['ai-normal', 'ai-normal', 'ai-easy', 'ai-normal'], 6, false],
      [['ai-normal', 'ai-easy'], 4, true],
      [['ai-easy', 'ai-normal', 'ai-normal', 'ai-easy'], 5, true],
    ];
    games.forEach(([kinds, size, noExtra], i) => {
      const rng = seededRandom(700 + i);
      const end = playOut(createGame(setup(kinds, size, noExtra), rng), rng);
      expect(end.players.reduce((a, p) => a + p.score, 0)).toBe(size * size);
      expect(end.history).toHaveLength(lineCount(size));
    });
  });

  it('보통은 쉬움을 거의 항상 이긴다', () => {
    let normalWins = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const rng = seededRandom(seed * 31);
      const kinds: SeatKind[] = seed % 2 ? ['ai-normal', 'ai-easy'] : ['ai-easy', 'ai-normal'];
      const end = playOut(createGame(setup(kinds, seed <= 5 ? 4 : 5), rng), rng);
      const n = kinds.indexOf('ai-normal');
      if (end.players[n].score > end.players[1 - n].score) normalWins += 1;
    }
    expect(normalWins).toBeGreaterThanOrEqual(8);
  });

  it('탐색 한도가 아주 작아도 어림셈으로 올바른 선을 고른다', () => {
    const rng = seededRandom(5);
    let s = createGame(setup(['ai-normal', 'ai-normal'], 5), rng);
    while (s.phase === 'play') {
      const a = decideAction(s, 'ai-normal', rng, { budget: 30 });
      expect(s.lines[a.edge]).toBe(-1);
      s = applyAction(s, a);
    }
    expect(s.players[0].score + s.players[1].score).toBe(25);
    // 한도가 작아도 끝판 1의 더블 크로스는 어림셈으로 찾는다
    expect(decideAction(boardFromAscii(DOUBLE_CROSS), 'ai-normal', seededRandom(1), { budget: 1 }).edge).toBe(hLine(4, 4, 1));
  });
});
