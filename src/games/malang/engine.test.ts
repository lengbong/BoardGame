import { describe, expect, it } from 'vitest';
import {
  COUNTDOWN,
  DEFAULT_OPTIONS,
  LOCK_DELAY,
  MAX_GARBAGE_DROP,
  applyGravity,
  applyInput,
  createGame,
  ensureQueue,
  fallSpeed,
  findGroups,
  garbageRate,
  ghostCells,
  idx,
  nextRound,
  pieceCells,
  popScore,
  setSoftDrop,
  step,
} from './engine';
import { DEATH_X, GARBAGE, H, W } from './types';
import type { Blob, MalangOptions, MalangState, PlayerState } from './types';

const COLORS: Record<string, number> = { R: 0, G: 1, B: 2, Y: 3, P: 4, X: GARBAGE };

/** 아래쪽 줄부터 맞춰 그린 판: rows는 위에서 아래 순서, 모자란 위쪽 줄은 빈칸 */
function grid(rows: string[]): (Blob | null)[] {
  const g: (Blob | null)[] = Array.from({ length: W * H }, () => null);
  let id = 1000;
  const top = H - rows.length;
  rows.forEach((row, r) => {
    [...row].forEach((ch, x) => {
      if (ch !== '.') g[idx(x, top + r)] = { id: id++, c: COLORS[ch] };
    });
  });
  return g;
}

function draw(g: (Blob | null)[]): string[] {
  const inv = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [v, k]));
  const rows: string[] = [];
  for (let y = 0; y < H; y++) rows.push(Array.from({ length: W }, (_, x) => (g[idx(x, y)] ? inv[g[idx(x, y)]!.c] : '.')).join(''));
  return rows;
}

function game(options: Partial<MalangOptions> = {}, seed = 1): MalangState {
  const s = createGame({ seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }], options: { ...DEFAULT_OPTIONS, ...options } }, seed);
  step(s, COUNTDOWN);
  s.events = [];
  return s;
}

/** 조건이 될 때까지 16ms씩 진행 */
function runUntil(s: MalangState, cond: () => boolean, max = 4000): void {
  for (let i = 0; i < max && !cond(); i++) step(s, 16);
}

/** 다음 조각 색을 정해 둔다 */
function setQueue(s: MalangState, p: PlayerState, pairs: [number, number][]): void {
  s.queue.splice(p.queueIndex, pairs.length, ...pairs);
}

describe('판', () => {
  it('중력: 빈칸을 메우며 내려오고, 움직인 젤리를 알려 준다', () => {
    const g = grid(['R.', '..', 'G.']);
    const falls = applyGravity(g);
    expect(draw(g).slice(-2)).toEqual(['R.....', 'G.....']);
    expect(falls).toEqual([{ id: 1000, x: 0, from: H - 3, to: H - 2 }]);
  });

  it('같은 색 4개 이상이 이어지면 덩어리, 방해 젤리는 덩어리가 아니다', () => {
    expect(findGroups(grid(['RR....', 'RR....']))).toHaveLength(1);
    expect(findGroups(grid(['RRR...', 'GGGR..']))).toHaveLength(0);
    expect(findGroups(grid(['XXXX..']))).toHaveLength(0);
    const two = findGroups(grid(['RRRRGG', '....GG']));
    expect(two.map((g) => g.length).sort()).toEqual([4, 4]);
  });

  it('점수: 10 × 개수 × (연쇄 + 색 + 큰 덩어리)', () => {
    expect(popScore(1, [{ size: 4, color: 0 }])).toBe(40);
    expect(popScore(2, [{ size: 4, color: 0 }])).toBe(320);
    expect(popScore(1, [{ size: 5, color: 0 }])).toBe(100);
    expect(popScore(1, [{ size: 4, color: 0 }, { size: 4, color: 1 }])).toBe(240);
    expect(popScore(4, [{ size: 4, color: 0 }])).toBe(1280);
  });

  it('미리 보기: 따로 떨어지는 두 젤리의 자리', () => {
    const g = grid(['......', 'R.....']);
    const ghost = ghostCells(g, { x: 0, y: 0, r: 1, colors: [1, 2], ids: [1, 2], fall: 0, lockT: 0, resets: 0, serial: 1 });
    expect(ghost).toContainEqual({ x: 0, y: H - 2, c: 1 });
    expect(ghost).toContainEqual({ x: 1, y: H - 1, c: 2 });
  });
});

describe('조각 다루기', () => {
  it('3·2·1이 끝나면 3번째 줄 맨 위에 조각이 나온다', () => {
    const s = createGame({ seats: [{ kind: 'human', name: '' }, { kind: 'human', name: '' }], options: DEFAULT_OPTIONS }, 3);
    expect(s.phase).toBe('countdown');
    step(s, COUNTDOWN);
    expect(s.phase).toBe('play');
    step(s, 200);
    const p = s.players[0];
    expect(p.phase).toBe('move');
    expect(pieceCells(p.piece!)).toEqual([
      [DEATH_X, 0],
      [DEATH_X, -1],
    ]);
    expect(s.players.map((x) => x.name)).toEqual(['딸기', '소다']);
  });

  it('좌우로 움직이고 벽에서 멈춘다', () => {
    const s = game();
    step(s, 200);
    for (let k = 0; k < 5; k++) applyInput(s, 0, 'left');
    expect(s.players[0].piece!.x).toBe(0);
    expect(applyInput(s, 0, 'left')).toBe(false);
  });

  it('왼쪽 벽에서 왼쪽으로 돌리면 오른쪽으로 밀려난다', () => {
    const s = game();
    step(s, 200);
    const p = s.players[0];
    p.piece!.x = 0;
    p.piece!.y = 5;
    expect(applyInput(s, 0, 'ccw')).toBe(true);
    expect(p.piece).toMatchObject({ x: 1, r: 3 });
  });

  it('바닥에서 아래쪽으로 돌리면 한 칸 위로 밀린다', () => {
    const s = game();
    step(s, 200);
    const p = s.players[0];
    p.piece!.y = H - 1;
    p.piece!.r = 1;
    p.piece!.x = 2;
    applyInput(s, 0, 'cw');
    expect(p.piece).toMatchObject({ r: 2, y: H - 2 });
  });

  it('좁은 틈에서는 반 바퀴 돈다', () => {
    const s = game();
    const p = s.players[0];
    p.grid = grid(['X.X...', 'X.X...', 'X.X...']);
    step(s, 200);
    p.piece!.x = 1;
    p.piece!.y = H - 2;
    expect(applyInput(s, 0, 'cw')).toBe(true);
    expect(p.piece!.r).toBe(2);
  });

  it('바닥에 닿고 잠깐 뒤에 굳고, 따로 떨어진 젤리는 아래로 내려간다', () => {
    const s = game();
    const p = s.players[0];
    p.grid = grid(['..R...']);
    setQueue(s, p, [[1, 3]]);
    step(s, 200);
    applyInput(s, 0, 'cw'); // 붙은 젤리가 오른쪽(3번째 → 4번째 줄)
    runUntil(s, () => p.piece!.lockT > 0);
    expect(p.phase).toBe('move');
    step(s, LOCK_DELAY);
    expect(p.phase).toBe('settle');
    expect(p.falls).toHaveLength(1);
    runUntil(s, () => p.phase === 'move');
    expect(draw(p.grid).slice(-2)).toEqual(['..G...', '..RY..']);
    expect(p.stats.pieces).toBe(1);
  });

  it('바로 떨어뜨리기는 곧바로 굳는다', () => {
    const s = game();
    step(s, 200);
    applyInput(s, 0, 'drop');
    expect(s.players[0].phase).toBe('settle');
    expect(s.events.map((e) => e.type)).toEqual(expect.arrayContaining(['hardDrop', 'land']));
  });

  it('↓를 누르면 빨리 떨어진다', () => {
    const a = game();
    const b = game();
    step(a, 200);
    step(b, 200);
    setSoftDrop(b, 0, true);
    step(a, 300);
    step(b, 300);
    expect(b.players[0].piece!.y).toBeGreaterThan(a.players[0].piece!.y + 3);
  });
});

describe('연쇄', () => {
  it('4개가 이어지면 터지고, 위의 젤리가 떨어져 다시 이어지면 연쇄', () => {
    const s = game({ mode: 'solo' });
    const p = s.players[0];
    // 빨강 3개 위에 초록 3개: 빨강을 터뜨리면 초록이 내려와 4개가 된다
    p.grid = grid(['G.....', 'R.....', 'RGG...', 'RRG...']);
    // 첫 젤리 축이 빨강, 붙은 젤리가 노랑
    setQueue(s, p, [[0, 3]]);
    step(s, 200);
    p.piece!.x = 1;
    applyInput(s, 0, 'drop');
    runUntil(s, () => p.phase === 'move' || p.phase === 'dead');
    const pops = s.events.filter((e) => e.type === 'pop');
    expect(pops.map((e) => (e.type === 'pop' ? e.chain : 0))).toEqual([1, 2]);
    expect(p.stats.maxChain).toBe(2);
    expect(p.score).toBeGreaterThan(40 + 320);
    expect(p.chain).toBe(0);
  });

  it('터지는 젤리 옆의 방해 젤리도 없어진다', () => {
    const s = game({ mode: 'solo' });
    const p = s.players[0];
    p.grid = grid(['X.....', 'RRR...', 'XXXX.X']);
    setQueue(s, p, [[0, 0]]);
    step(s, 200);
    p.piece!.x = 3;
    applyInput(s, 0, 'drop');
    runUntil(s, () => p.phase === 'move');
    // 빨강 5개가 터지면서 붙어 있던 방해 젤리 5개가 함께 사라지고, 떨어져 있던 1개만 남는다
    expect(p.grid.filter((b) => b?.c === GARBAGE)).toHaveLength(1);
  });

  it('판을 모두 비우면 보너스', () => {
    const s = game({ mode: 'solo' });
    const p = s.players[0];
    p.grid = grid(['RR....']);
    setQueue(s, p, [[0, 0]]);
    step(s, 200);
    applyInput(s, 0, 'cw');
    p.piece!.x = 0;
    applyInput(s, 0, 'drop');
    runUntil(s, () => p.phase === 'move');
    expect(p.stats.allClears).toBe(1);
    expect(s.events.some((e) => e.type === 'allClear')).toBe(true);
  });
});

describe('방해 젤리', () => {
  function chainReady(s: MalangState, player: number): void {
    const p = s.players[player];
    p.grid = grid(['G.....', 'R.....', 'RGG...', 'RRG...']);
    setQueue(s, p, [[0, 3]]);
  }

  it('연쇄 점수만큼 상대에게 보내고, 상대는 자기 조각이 끝난 뒤에 받는다', () => {
    const s = game();
    chainReady(s, 0);
    step(s, 200);
    s.players[0].piece!.x = 1;
    applyInput(s, 0, 'drop');
    runUntil(s, () => s.players[0].phase === 'move');
    const sent = s.players[0].stats.garbageSent;
    expect(sent).toBeGreaterThan(0);
    expect(s.players[1].pending).toBe(sent);
    // 상대가 조각을 내려놓으면 방해 젤리가 떨어진다
    applyInput(s, 1, 'drop');
    runUntil(s, () => s.players[1].phase === 'garbage');
    expect(s.players[1].pending).toBe(0);
    runUntil(s, () => s.players[1].phase === 'move');
    expect(s.players[1].grid.filter((b) => b?.c === GARBAGE)).toHaveLength(sent);
  });

  it('나에게 올 방해 젤리는 내 연쇄로 먼저 지운다 (상쇄)', () => {
    const s = game();
    s.players[0].pending = 4;
    chainReady(s, 0);
    step(s, 200);
    s.players[0].piece!.x = 1;
    applyInput(s, 0, 'drop');
    runUntil(s, () => s.players[0].phase === 'move' || s.players[0].phase === 'garbage');
    expect(s.events.some((e) => e.type === 'offset')).toBe(true);
    expect(s.players[0].pending).toBe(0);
  });

  it('한 번에 최대 30개(5줄)까지만 떨어지고 나머지는 다음에', () => {
    const s = game();
    s.players[1].pending = 40;
    step(s, 200);
    applyInput(s, 1, 'drop');
    runUntil(s, () => s.players[1].phase === 'move' || s.players[1].phase === 'dead');
    expect(s.players[1].stats.garbageReceived).toBe(MAX_GARBAGE_DROP);
    expect(s.players[1].pending).toBe(10);
  });

  it('오래 하면 방해 젤리가 점점 쉽게 만들어진다', () => {
    expect(garbageRate(0)).toBe(60);
    expect(garbageRate(200_000)).toBeLessThan(60);
    expect(garbageRate(10_000_000)).toBeGreaterThanOrEqual(12);
  });
});

describe('승패', () => {
  it('3번째 줄 맨 위까지 차면 지고, 상대가 이긴다', () => {
    const s = game();
    const p = s.players[0];
    // 3번째 줄을 꼭대기 바로 아래까지 채운다
    for (let y = 1; y < H; y++) p.grid[idx(DEATH_X, y)] = { id: 5000 + y, c: GARBAGE };
    step(s, 200);
    applyInput(s, 0, 'drop');
    runUntil(s, () => s.phase !== 'play');
    expect(p.phase).toBe('dead');
    expect(s.phase).toBe('over');
    expect(s.winner).toBe(1);
    expect(s.wins).toEqual([0, 1]);
  });

  it('2판 먼저 이기기: 한 판이 끝나면 다음 판', () => {
    const s = game({ winsNeeded: 2 });
    for (let y = 1; y < H; y++) s.players[1].grid[idx(DEATH_X, y)] = { id: 5000 + y, c: GARBAGE };
    step(s, 200);
    applyInput(s, 1, 'drop');
    runUntil(s, () => s.phase !== 'play');
    expect(s.phase).toBe('roundover');
    expect(s.roundWinner).toBe(0);
    const t = nextRound(s);
    expect(t.phase).toBe('countdown');
    expect(t.round).toBe(2);
    expect(t.wins).toEqual([1, 0]);
    expect(t.players[1].grid.every((b) => b === null)).toBe(true);
  });

  it('혼자 하기: 막히면 끝', () => {
    const s = game({ mode: 'solo' });
    for (let y = 1; y < H; y++) s.players[0].grid[idx(DEATH_X, y)] = { id: 5000 + y, c: GARBAGE };
    step(s, 200);
    applyInput(s, 0, 'drop');
    runUntil(s, () => s.phase !== 'play');
    expect(s.phase).toBe('over');
    expect(s.winner).toBeNull();
  });
});

describe('그 밖', () => {
  it('두 사람은 같은 순서로 조각을 받는다', () => {
    const s = game();
    step(s, 200);
    expect(s.players[0].piece!.colors).toEqual(s.players[1].piece!.colors);
  });

  it('색 가짓수만큼의 색이 나온다', () => {
    for (const colors of [4, 5] as const) {
      const s = createGame({ seats: [{ kind: 'human', name: '' }, { kind: 'human', name: '' }], options: { ...DEFAULT_OPTIONS, colors } }, 9);
      ensureQueue(s, 200);
      const seen = new Set(s.queue.flat());
      expect(seen.size).toBe(colors);
      expect(Math.max(...seen)).toBe(colors - 1);
    }
  });

  it('상태는 JSON으로 저장했다가 그대로 이어 할 수 있다', () => {
    const s = game();
    step(s, 1500);
    const copy = JSON.parse(JSON.stringify(s)) as MalangState;
    expect(copy).toEqual(s);
    step(s, 777);
    step(copy, 777);
    expect(copy.players.map((p) => p.piece?.y)).toEqual(s.players.map((p) => p.piece?.y));
  });

  it('혼자 하기: 많이 터뜨리면 레벨이 오르고 빨라진다', () => {
    const s = game({ mode: 'solo' });
    const p = s.players[0];
    const before = fallSpeed(s, p);
    p.stats.popped = 22;
    p.grid = grid(['RRR...']);
    setQueue(s, p, [[0, 1]]);
    step(s, 200);
    p.piece!.x = 3;
    applyInput(s, 0, 'drop');
    runUntil(s, () => p.phase === 'move');
    expect(p.level).toBe(2);
    expect(s.events.some((e) => e.type === 'levelUp')).toBe(true);
    expect(fallSpeed(s, p)).toBeGreaterThan(before);
  });
});
