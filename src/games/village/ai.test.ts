import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { bestPlan, decideAction, type AiLevel } from './ai';
import { Grid } from './board';
import { DEFAULT_OPTIONS, applyAction, createGame, flagChoices, gridOf, mustDiscard, tilesAccountedFor } from './rules';
import { TILES } from './tiles';
import type { Placed, Rot, SeatKind, VillageAction, VillageOptions, VillageSetup, VillageState } from './types';

const T = (id: string) => TILES.findIndex((t) => t.id === id);

function setup(kinds: SeatKind[], options: Partial<VillageOptions> = {}): VillageSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as VillageSetup['seats'],
    options: { ...DEFAULT_OPTIONS, ...options },
  };
}

interface Put {
  id: string;
  x: number;
  y: number;
  r: Rot;
  flag?: { seg: number; player: number };
}

/** 지도를 직접 꾸민 게임 (0번 컴퓨터 차례). 더미는 넉넉히 남겨 둔다 */
function scene(puts: Put[], hands: string[][], level: AiLevel = 'ai-normal'): VillageState {
  const s = createGame(setup(hands.map((_, i) => (i === 0 ? level : 'ai-easy'))), seededRandom(1));
  const grid = new Grid([s.board[0]]);
  for (const p of puts) {
    const placed: Placed = { t: T(p.id), x: p.x, y: p.y, r: p.r, flag: p.flag ?? null, by: 1 };
    if (!grid.fits(placed.t, p.x, p.y, p.r)) throw new Error(`맞지 않음 ${p.id}`);
    grid.add(placed);
  }
  s.board = grid.tiles;
  s.players.forEach((pl, i) => {
    pl.hand = hands[i].map(T);
    pl.flags = 6 - s.board.filter((b) => b.flag?.player === i).length;
  });
  s.current = 0;
  s.phase = 'place';
  return s;
}

/** 컴퓨터끼리 끝까지 */
function playOut(kinds: SeatKind[], seed: number, options: Partial<VillageOptions> = {}, check = false) {
  const rng = seededRandom(seed);
  let s = createGame(setup(kinds, options), rng);
  let steps = 0;
  let slowest = 0;
  while (s.phase !== 'gameover' && steps < 600) {
    const t0 = performance.now();
    const a = decideAction(s, s.players[s.current].kind as AiLevel, rng)!;
    slowest = Math.max(slowest, performance.now() - t0);
    const next = applyAction(s, a);
    if (next === s) throw new Error(`할 수 없는 행동: ${JSON.stringify(a)}`);
    s = next;
    if (check) {
      expect(tilesAccountedFor(s)).toBe(true);
      const onBoard = s.players.map((_, i) => s.board.filter((b) => b.flag?.player === i).length);
      s.players.forEach((p, i) => expect(p.flags + onBoard[i]).toBe(s.options.flags));
    }
    steps++;
  }
  return { state: s, slowest };
}

const isPlace = (a: VillageAction | null): a is Extract<VillageAction, { type: 'place' }> => a?.type === 'place';

describe('컴퓨터: 올바른 행동만', () => {
  it('쉬움·보통 모두 언제나 할 수 있는 행동을 고른다 (끝까지, 여러 인원·규칙)', () => {
    const cases: [SeatKind[], Partial<VillageOptions>][] = [
      [['ai-easy', 'ai-normal'], {}],
      [['ai-normal', 'ai-easy', 'ai-normal'], { hand: 1 }],
      [['ai-easy', 'ai-easy', 'ai-normal', 'ai-normal'], { flags: 4, jangseung: false }],
    ];
    cases.forEach(([kinds, opts], k) => {
      const { state } = playOut(kinds, 40 + k, opts, true);
      expect(state.phase).toBe('gameover');
      expect(state.stack).toHaveLength(0);
      const sum = state.players.map((p) => p.stats.path + p.stats.stream + p.stats.paddy + p.stats.jangseung + p.stats.final);
      expect(state.players.map((p) => p.score)).toEqual(sum);
    });
  });

  it('놓을 곳이 없으면 버리기를 고른다', () => {
    for (const level of ['ai-easy', 'ai-normal'] as const) {
      const s = scene([], [['road-cross', 'pine-hill'], ['pine-hill']], level);
      s.board = [{ t: T('paddy-full'), x: 0, y: 0, r: 0, flag: null, by: null }];
      expect(mustDiscard(s)).toBe(true);
      const a = decideAction(s, level, seededRandom(1));
      expect(a?.type).toBe('discard');
      expect(applyAction(s, a!)).not.toBe(s);
    }
  });

  it('끝난 게임에서는 아무것도 하지 않는다', () => {
    const { state } = playOut(['ai-easy', 'ai-easy'], 7);
    expect(decideAction(state, 'ai-normal')).toBeNull();
  });
});

describe('컴퓨터 보통: 뻔한 좋은 수', () => {
  it('내 깃발이 있는 길을 완성할 수 있으면 완성한다', () => {
    const s = scene([{ id: 'road-house', x: 1, y: 0, r: 1, flag: { seg: 0, player: 0 } }], [['pine-hill', 'road-house'], ['pine-hill']]);
    const a = decideAction(s, 'ai-normal', seededRandom(1));
    expect(a).toEqual({ type: 'place', hand: 1, x: -1, y: 0, r: 3 });
  });

  it('남의 깃발이 있는 길은 완성시켜 주지 않는다', () => {
    const s = scene([{ id: 'road-house', x: 1, y: 0, r: 1, flag: { seg: 0, player: 1 } }], [['road-house', 'pine-hill'], ['pine-hill']]);
    for (let k = 0; k < 5; k++) {
      const a = decideAction(s, 'ai-normal', seededRandom(k));
      expect(isPlace(a)).toBe(true);
      if (isPlace(a)) expect(a.x === -1 && a.y === 0 && s.players[0].hand[a.hand] === T('road-house')).toBe(false);
    }
  });

  it('놓자마자 완성되는 주인 없는 지형에는 깃발을 꽂는다', () => {
    let s = scene([{ id: 'road-house', x: 1, y: 0, r: 1 }], [['road-house', 'pine-hill'], ['pine-hill']]);
    s = applyAction(s, { type: 'place', hand: 0, x: -1, y: 0, r: 3 });
    expect(s.phase).toBe('flag');
    expect(decideAction(s, 'ai-normal')).toEqual({ type: 'flag', seg: 0 });
    // 계획을 세울 때도 같은 판단: 완성하는 자리 + 깃발
    const fresh = scene([{ id: 'road-house', x: 1, y: 0, r: 1 }], [['road-house', 'pine-hill'], ['pine-hill']]);
    expect(bestPlan(fresh, seededRandom(2))).toMatchObject({ hand: 0, at: { x: -1, y: 0, r: 3 }, seg: 0 });
  });

  it('마지막 깃발은 하찮은 지형에 쓰지 않고 아껴 둔다', () => {
    let s = scene([], [['road-curve', 'pine-hill'], ['pine-hill']]);
    s.players[0].flags = 1;
    s.board[0].flag = null;
    s = applyAction(s, { type: 'place', hand: 0, x: 0, y: 1, r: 0 });
    expect(s.phase).toBe('flag');
    expect(flagChoices(s).some((c) => c.ok)).toBe(true);
    expect(decideAction(s, 'ai-normal')).toEqual({ type: 'skipFlag' });
  });

  it('남의 길에 내 길을 이어 붙여 함께 갖는다 (이득이면)', () => {
    // 1번 깃발 길: (-1,0)~(1,0), 내 깃발 길: (1,1)~(2,1). (2,0)에 굽은 길을 놓으면 둘이 이어져 1:1
    const s = scene(
      [
        { id: 'road-straight', x: -1, y: 0, r: 1 },
        { id: 'road-straight', x: 1, y: 0, r: 1, flag: { seg: 0, player: 1 } },
        { id: 'road-curve', x: 1, y: 1, r: 0 },
        { id: 'road-curve', x: 2, y: 1, r: 2, flag: { seg: 0, player: 0 } },
      ],
      [['road-curve', 'pine-hill'], ['pine-hill']],
    );
    const a = decideAction(s, 'ai-normal', seededRandom(3));
    expect(a).toMatchObject({ type: 'place', hand: 0, x: 2, y: 0, r: 1 });
    const after = applyAction(s, a!);
    const f = gridOf(after).trace(after.board.length - 1, 0, 2);
    expect(f.flags).toEqual([1, 1]);
  });

  it('장승은 길·냇물·논이 모두 닿는 자리를 고른다', () => {
    // (1,1) 자리: 위는 길, 왼쪽은 냇물(샘), 아래는 논 → 장승 갈림길을 놓으면 3점
    const s = scene(
      [
        { id: 'road-curve', x: 1, y: 0, r: 1 },
        { id: 'spring', x: 0, y: 1, r: 3 },
        { id: 'pine-hill', x: 0, y: 2, r: 0 },
        { id: 'paddy-edge', x: 1, y: 2, r: 0 },
      ],
      [['pine-hill', 'js-cross'], ['pine-hill']],
    );
    const a = decideAction(s, 'ai-normal', seededRandom(1));
    expect(a).toEqual({ type: 'place', hand: 1, x: 1, y: 1, r: 0 });
    const after = applyAction(s, a!);
    expect(after.events.find((e) => e.type === 'jangseung')).toMatchObject({ points: 3 });
  });
});

describe('컴퓨터 쉬움', () => {
  it('완성되는 자리를 자주 고른다', () => {
    const s = scene([{ id: 'road-house', x: 1, y: 0, r: 1 }], [['road-house', 'road-house'], ['pine-hill']], 'ai-easy');
    let completes = 0;
    for (let k = 0; k < 40; k++) {
      const a = decideAction(s, 'ai-easy', seededRandom(100 + k));
      if (isPlace(a) && a.x === -1 && a.y === 0 && a.r === 3) completes++;
    }
    expect(completes).toBeGreaterThan(16);
    expect(completes).toBeLessThan(40);
  });

  it('깃발은 가끔만 꽂는다', () => {
    let planted = 0;
    for (let k = 0; k < 40; k++) {
      let s = scene([], [['road-straight', 'pine-hill'], ['pine-hill']], 'ai-easy');
      s = applyAction(s, { type: 'place', hand: 0, x: 1, y: 0, r: 1 });
      if (decideAction(s, 'ai-easy', seededRandom(k))?.type === 'flag') planted++;
    }
    expect(planted).toBeGreaterThan(4);
    expect(planted).toBeLessThan(30);
  });
});

describe('실력과 빠르기', () => {
  it('보통은 쉬움보다 자주 이긴다', () => {
    let normalWins = 0;
    let games = 0;
    for (let g = 0; g < 24; g++) {
      // 2인: 자리를 번갈아, 4인: 보통 2 · 쉬움 2
      const kinds: SeatKind[] = g % 3 === 0 ? ['ai-normal', 'ai-easy', 'ai-normal', 'ai-easy'] : g % 2 ? ['ai-normal', 'ai-easy'] : ['ai-easy', 'ai-normal'];
      const { state } = playOut(kinds, 2000 + g);
      games++;
      if (state.winners.some((w) => state.players[w].kind === 'ai-normal')) normalWins++;
    }
    expect(normalWins / games).toBeGreaterThan(0.8);
  });

  it('한 수를 정하는 데 오래 걸리지 않는다 (4인 보통끼리)', () => {
    const { state, slowest } = playOut(['ai-normal', 'ai-normal', 'ai-normal', 'ai-normal'], 77);
    expect(state.phase).toBe('gameover');
    expect(slowest).toBeLessThan(250);
  });
});
