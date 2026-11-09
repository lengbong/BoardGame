import { describe, expect, it } from 'vitest';
import { planMove } from './ai';
import { DEFAULT_OPTIONS, applyAction, checkCommit, createGame } from './rules';
import { analyzeSet, isValidTable } from './sets';
import { createPool, rackPoints, sortByColor, sortByNumber, tilePoints } from './tiles';
import type { SeatKind, TableSet, Tile, TileColor, TilesOptions, TilesSetup, TilesState } from './types';
import { moveTiles, playedCount, startWork } from './work';

/** 시드 고정 난수 (mulberry32) */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let nextId = 1000;
const t = (color: TileColor, value: number): Tile => ({ id: nextId++, color, value, joker: false });
const J = (): Tile => ({ id: nextId++, color: null, value: 0, joker: true });
const r = (v: number) => t('red', v);
const b = (v: number) => t('blue', v);
const g = (v: number) => t('green', v);
const k = (v: number) => t('black', v);

function setup(kinds: SeatKind[], options: Partial<TilesOptions> = {}): TilesSetup {
  return {
    seats: kinds.map((kind, i) => ({ kind, name: `P${i}` })) as TilesSetup['seats'],
    options: { ...DEFAULT_OPTIONS, ...options },
  };
}

/** 원하는 손패와 판으로 게임을 만든다. 0번 차례. */
function game(racks: Tile[][], table: Tile[][] = [], opts: Partial<TilesOptions> = {}, melded = true): TilesState {
  const kinds = (['human', 'human', 'human', 'human'] as SeatKind[]).map((kind, i) => (i < racks.length ? kind : 'empty'));
  const s = createGame(setup(kinds, opts), () => 0);
  s.players.forEach((p, i) => {
    p.rack = racks[i];
    p.melded = melded;
  });
  s.table = table.map((tiles, i) => ({ id: 100 + i, tiles }));
  s.current = 0;
  return s;
}

const withNew = (s: TilesState, ...sets: Tile[][]): TableSet[] => [...s.table, ...sets.map((tiles, i) => ({ id: -1 - i, tiles }))];

describe('타일', () => {
  it('106개: 1~13 × 4색 × 2벌 + 조커 2개', () => {
    const pool = createPool();
    expect(pool).toHaveLength(106);
    expect(new Set(pool.map((x) => x.id)).size).toBe(106);
    expect(pool.filter((x) => x.joker)).toHaveLength(2);
    expect(pool.filter((x) => x.color === 'red' && x.value === 7)).toHaveLength(2);
  });

  it('남은 타일 점수: 숫자 그대로, 조커 30', () => {
    expect(tilePoints(r(9))).toBe(9);
    expect(tilePoints(J())).toBe(30);
    expect(rackPoints([r(1), b(13), J()])).toBe(44);
  });

  it('정렬: 숫자순은 같은 숫자끼리, 색깔순은 같은 색끼리', () => {
    const tiles = [b(7), r(8), J(), r(7), b(1)];
    expect(sortByNumber(tiles).map((x) => (x.joker ? 'J' : `${x.color![0]}${x.value}`))).toEqual(['b1', 'r7', 'b7', 'r8', 'J']);
    expect(sortByColor(tiles).map((x) => (x.joker ? 'J' : `${x.color![0]}${x.value}`))).toEqual(['r7', 'r8', 'b1', 'b7', 'J']);
  });
});

describe('줄 검사', () => {
  it('같은 숫자 줄: 3~4개, 색이 모두 달라야 한다', () => {
    expect(analyzeSet([r(5), b(5), g(5)]).kind).toBe('group');
    expect(analyzeSet([r(5), b(5), g(5), k(5)]).valid).toBe(true);
    expect(analyzeSet([r(5), b(5), r(5)]).valid).toBe(false);
    expect(analyzeSet([r(5), b(5), r(5)]).reason).toContain('색이 모두 달라야');
    expect(analyzeSet([r(5), b(5)]).reason).toContain('3개 이상');
    expect(analyzeSet([r(5), b(5), g(5), k(5), J()]).valid).toBe(false);
  });

  it('연속 줄: 같은 색, 이어진 숫자, 3개 이상', () => {
    expect(analyzeSet([r(3), r(4), r(5)]).kind).toBe('run');
    expect(analyzeSet([r(5), r(3), r(4)]).arranged.map((x) => x.value)).toEqual([3, 4, 5]);
    expect(analyzeSet([r(3), r(4), r(6)]).reason).toContain('이어지지');
    expect(analyzeSet([r(3), b(4), r(5)]).valid).toBe(false);
    expect(analyzeSet([r(12), r(13), r(1)]).valid).toBe(false);
    const all = Array.from({ length: 13 }, (_, i) => r(i + 1));
    expect(analyzeSet(all).valid).toBe(true);
  });

  it('조커는 빈자리를 채우고, 남으면 끝에 붙는다', () => {
    const a = analyzeSet([r(3), J(), r(5)]);
    expect(a.valid).toBe(true);
    expect(a.values).toEqual([3, 4, 5]);
    expect(a.points).toBe(12);
    expect(analyzeSet([r(5), r(6), J()]).values).toEqual([5, 6, 7]);
    // 13 다음에는 못 붙으니 앞에 붙는다
    expect(analyzeSet([r(12), r(13), J()]).values).toEqual([11, 12, 13]);
    expect(analyzeSet([r(5), b(5), J()]).kind).toBe('group');
    expect(analyzeSet([r(5), b(5), J()]).points).toBe(15);
    expect(analyzeSet([r(2), J(), J()]).valid).toBe(true);
    expect(analyzeSet([r(2), J(), r(6)]).valid).toBe(false);
  });

  it('판 전체 검사', () => {
    expect(isValidTable([{ id: 1, tiles: [r(1), r(2), r(3)] }])).toBe(true);
    expect(isValidTable([{ id: 1, tiles: [r(1), r(2), r(3)] }, { id: 2, tiles: [b(1)] }])).toBe(false);
  });
});

describe('게임 시작', () => {
  it('14개씩 나눠 주고 판은 비어 있다', () => {
    const s = createGame(setup(['human', 'ai-normal', 'ai-easy', 'empty']), seeded(1));
    expect(s.players.every((p) => p.rack.length === 14 && !p.melded)).toBe(true);
    expect(s.pool).toHaveLength(106 - 42);
    expect(s.table).toEqual([]);
  });

  it('2명보다 적으면 시작할 수 없다', () => {
    expect(() => createGame(setup(['human', 'empty', 'empty', 'empty']))).toThrow();
  });
});

describe('제출 검사', () => {
  it('새 줄을 내면 내 타일에서 빠지고 판에 놓인다', () => {
    const s = game([[r(3), r(4), r(5), b(9)], [k(1)]]);
    const after = applyAction(s, { type: 'commit', table: withNew(s, [s.players[0].rack[2], s.players[0].rack[0], s.players[0].rack[1]]) });
    expect(after.table).toHaveLength(1);
    expect(after.table[0].tiles.map((x) => x.value)).toEqual([3, 4, 5]);
    expect(after.table[0].id).toBeGreaterThan(0);
    expect(after.players[0].rack.map((x) => x.value)).toEqual([9]);
    expect(after.current).toBe(1);
    expect(after.lastMove?.played).toHaveLength(3);
  });

  it('타일을 하나도 안 내면 제출할 수 없다', () => {
    const s = game([[r(3)], [k(1)]], [[b(1), b(2), b(3)]]);
    const c = checkCommit(s, s.table);
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.reason).toContain('1개 이상');
    expect(applyAction(s, { type: 'commit', table: s.table })).toBe(s);
  });

  it('올바르지 않은 줄이 있으면 제출할 수 없다', () => {
    const s = game([[r(3), r(4), b(5)], [k(1)]]);
    const c = checkCommit(s, withNew(s, s.players[0].rack));
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.reason).toContain('올바르지 않은 줄');
  });

  it('판에 있던 타일을 가져가면 안 된다', () => {
    const s = game([[b(4)], [k(1)]], [[b(1), b(2), b(3)]]);
    const c = checkCommit(s, [{ id: 100, tiles: [s.table[0].tiles[1], s.table[0].tiles[2], s.players[0].rack[0]] }]);
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.reason).toContain('가져갈 수 없어요');
  });

  it('다른 사람 타일이나 같은 타일 두 번은 안 된다', () => {
    const mine = [r(1), r(2), r(3)];
    const theirs = k(5);
    const s = game([mine, [theirs]]);
    expect(checkCommit(s, withNew(s, [mine[0], mine[1], theirs])).ok).toBe(false);
    expect(checkCommit(s, withNew(s, [mine[0], mine[1], mine[2]], [mine[0], mine[1], mine[2]])).ok).toBe(false);
  });

  it('정통 규칙: 판의 줄을 뜯어서 다시 조합할 수 있다', () => {
    // 판: 빨강 3~6. 내 손: 빨강 6 → 3~6을 3~5로 줄이고 6 6? (안 됨) → 대신 빨강 4~6 + 6 7 8 같은 재배치
    const table = [r(3), r(4), r(5), r(6)];
    const mine = [r(7), b(6), g(6)];
    const s = game([mine, [k(1)]], [table]);
    // 3~5 / 6 6 6 (빨강·파랑·초록)  + 빨강 7은 남김
    const proposal = [
      { id: 100, tiles: [table[0], table[1], table[2]] },
      { id: -1, tiles: [table[3], mine[1], mine[2]] },
    ];
    const c = checkCommit(s, proposal);
    expect(c.ok).toBe(true);
    const after = applyAction(s, { type: 'commit', table: proposal });
    expect(after.table.map((x) => x.id)).toEqual([100, 1]);
    expect(after.players[0].rack).toHaveLength(1);
  });

  it('간단 규칙: 붙이기는 되지만 나누거나 합칠 수 없다', () => {
    const table = [r(3), r(4), r(5), r(6)];
    const mine = [r(7), b(6), g(6)];
    const s = game([mine, [k(1)]], [table], { rearrange: false });
    const split = [
      { id: 100, tiles: [table[0], table[1], table[2]] },
      { id: -1, tiles: [table[3], mine[1], mine[2]] },
    ];
    const c = checkCommit(s, split);
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.reason).toContain('나눌 수 없어요');
    expect(checkCommit(s, [{ id: 100, tiles: [...table, mine[0]] }]).ok).toBe(true);

    const two = game([[r(9)], [k(1)]], [[r(3), r(4), r(5)], [r(6), r(7), r(8)]], { rearrange: false });
    const merged = [{ id: 100, tiles: [...two.table[0].tiles, ...two.table[1].tiles, two.players[0].rack[0]] }];
    const m = checkCommit(two, merged);
    expect(m.ok).toBe(false);
    if (!m.ok) expect(m.reason).toContain('합칠 수 없어요');
  });
});

describe('첫 등록 30점', () => {
  it('내 타일로만 30점 이상이어야 한다', () => {
    const low = [r(1), r(2), r(3), b(9)];
    const s = game([low, [k(1)]], [], {}, false);
    const c = checkCommit(s, withNew(s, low.slice(0, 3)));
    expect(c.ok).toBe(false);
    if (!c.ok) {
      expect(c.reason).toContain('30점');
      expect(c.meldPoints).toBe(6);
    }

    const high = [r(10), b(10), g(10), k(1)];
    const h = game([high, [k(2)]], [], {}, false);
    const after = applyAction(h, { type: 'commit', table: withNew(h, high.slice(0, 3)) });
    expect(after.players[0].melded).toBe(true);
    expect(after.lastMove?.meldPoints).toBe(30);
  });

  it('첫 등록 때는 판의 줄에 붙이거나 뜯을 수 없다', () => {
    const table = [b(1), b(2), b(3)];
    const mine = [b(4), r(11), g(11), k(11)];
    const s = game([mine, [k(1)]], [table], {}, false);
    const c = checkCommit(s, [{ id: 100, tiles: [...table, mine[0]] }, { id: -1, tiles: mine.slice(1) }]);
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.reason).toContain('건드릴 수 없어요');
    expect(checkCommit(s, [{ id: 100, tiles: table }, { id: -1, tiles: mine.slice(1) }]).ok).toBe(true);
  });

  it('규칙을 끄면 첫 차례에도 아무 줄이나 낼 수 있다', () => {
    const low = [r(1), r(2), r(3), b(9)];
    const s = game([low, [k(1)]], [], { initialMeld: false }, false);
    expect(checkCommit(s, withNew(s, low.slice(0, 3))).ok).toBe(true);
  });
});

describe('가져오기와 판 끝내기', () => {
  it('타일을 1개 가져오고 차례가 넘어간다', () => {
    const s = game([[r(1)], [k(1)]]);
    s.pool = [b(5)];
    const after = applyAction(s, { type: 'draw' });
    expect(after.players[0].rack).toHaveLength(2);
    expect(after.pool).toHaveLength(0);
    expect(after.current).toBe(1);
  });

  it('타일을 다 내면 이기고, 남은 타일 점수를 가져온다', () => {
    const mine = [r(3), r(4), r(5)];
    const s = game([mine, [k(1), J()], [b(9)]]);
    const after = applyAction(s, { type: 'commit', table: withNew(s, mine) });
    expect(after.phase).toBe('gameover');
    expect(after.roundResult).toEqual({ winner: 0, blocked: false, deltas: [40, -31, -9], rackPoints: [0, 31, 9] });
    expect(after.rankings).toEqual([0, 2, 1]);
    expect(after.players[1].score).toBe(-31);
  });

  it('더미가 비고 모두 한 바퀴 넘어가면 남은 타일이 가장 적은 사람이 이긴다', () => {
    let s = game([[r(9)], [k(2)], [b(5)]]);
    s.pool = [];
    for (let i = 0; i < 3; i++) s = applyAction(s, { type: 'draw' });
    expect(s.phase).toBe('gameover');
    expect(s.roundResult?.blocked).toBe(true);
    expect(s.roundResult?.winner).toBe(1);
    expect(s.roundResult?.deltas).toEqual([-9, 14, -5]);
  });

  it('여러 판: 정해진 판 수까지 하고 점수 합계로 순위', () => {
    const mine = [r(3), r(4), r(5)];
    const s = game([mine, [k(1)]], [], { endMode: 'rounds', rounds: 2 });
    s.starter = 0;
    const over = applyAction(s, { type: 'commit', table: withNew(s, mine) });
    expect(over.phase).toBe('roundover');
    const next = applyAction(over, { type: 'nextRound' }, seeded(2));
    expect(next.round).toBe(2);
    expect(next.current).toBe(1);
    expect(next.players.every((p) => p.rack.length === 14 && !p.melded)).toBe(true);
    expect(next.players[0].score).toBe(1);
    expect(next.table).toEqual([]);
  });

  it('행동을 적용해도 원래 상태는 바뀌지 않는다', () => {
    const mine = [r(3), r(4), r(5), b(1)];
    const s = game([mine, [k(1)]]);
    s.pool = [b(5)];
    const snap = JSON.stringify(s);
    applyAction(s, { type: 'commit', table: withNew(s, mine.slice(0, 3)) });
    applyAction(s, { type: 'draw' });
    expect(JSON.stringify(s)).toBe(snap);
  });
});

describe('차례 중 판 고치기', () => {
  it('고른 타일로 새 줄을 만들고, 줄에 붙이고, 되돌린다', () => {
    const table = [b(1), b(2), b(3)];
    const mine = [b(4), r(7), g(7), k(7)];
    const s = game([mine, [k(1)]], [table]);
    let w = startWork(s);
    w = moveTiles(w, [mine[1].id, mine[2].id, mine[3].id], 'new');
    expect(w.table).toHaveLength(2);
    expect(w.table[1].id).toBeLessThan(0);
    expect(playedCount(w)).toBe(3);
    w = moveTiles(w, [mine[0].id], 100);
    expect(w.table[0].tiles.map((x) => x.value)).toEqual([1, 2, 3, 4]);
    // 판에 있던 타일은 내 칸으로 못 가져온다
    const before = w;
    w = moveTiles(w, [table[0].id], 'rack');
    expect(w).toBe(before);
    w = moveTiles(w, [mine[0].id, table[0].id], 'rack');
    expect(w.rack.map((x) => x.id)).toEqual([mine[0].id]);
    expect(w.table[0].tiles).toHaveLength(3);
    expect(checkCommit(s, w.table).ok).toBe(true);
  });

  it('줄의 타일을 떼어 새 줄로 옮기면 빈 줄은 없어진다', () => {
    const s = game([[r(9)], [k(1)]], [[b(1), b(2), b(3)]]);
    let w = startWork(s);
    w = moveTiles(w, s.table[0].tiles.map((x) => x.id), 'new');
    expect(w.table).toHaveLength(1);
    expect(w.table[0].id).toBe(-1);
  });
});

describe('끝까지 해 보기', () => {
  function playOut(seed: number, kinds: SeatKind[], opts: Partial<TilesOptions> = {}) {
    const rng = seeded(seed);
    let s = createGame(setup(kinds, opts), rng);
    let steps = 0;
    const total = (st: TilesState) => st.pool.length + st.table.reduce((n, x) => n + x.tiles.length, 0) + st.players.reduce((n, p) => n + p.rack.length, 0);
    while (s.phase !== 'gameover' && steps < 3000) {
      const p = s.players[s.current];
      const level = p.kind === 'ai-easy' ? 'ai-easy' : 'ai-normal';
      const next = applyAction(s, planMove(s, level, rng), rng);
      expect(next).not.toBe(s);
      expect(total(next)).toBe(106);
      expect(isValidTable(next.table)).toBe(true);
      s = next;
      steps++;
    }
    return s;
  }

  it('컴퓨터끼리 해도 언제나 끝난다 (정통 규칙)', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const s = playOut(seed, ['ai-normal', 'ai-easy', 'ai-normal', 'ai-easy']);
      expect(s.phase).toBe('gameover');
    }
  });

  it('간단 규칙, 첫 등록 없음, 2명', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const s = playOut(seed, ['ai-normal', 'empty', 'ai-easy', 'empty'], { rearrange: false, initialMeld: false });
      expect(s.phase).toBe('gameover');
    }
  });

  it('여러 판', () => {
    const s = playOut(7, ['ai-normal', 'ai-normal', 'empty', 'empty'], { endMode: 'rounds', rounds: 2 });
    expect(s.phase).toBe('gameover');
    expect(s.round).toBe(2);
  });
});
