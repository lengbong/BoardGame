import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { Grid, allFeatures, majority } from './board';
import { DEFAULT_OPTIONS, applyAction, canPlaceAny, createGame, flagChoices, gridOf, jangseungScore, mustDiscard, placementsFor, rankings, tilesAccountedFor } from './rules';
import { isValidState } from './storage';
import { DISTINCT_ROTS, EDGES, START_TILE, TILES, deckList, featurePoints, isJangseungTile, rotPt } from './tiles';
import type { Placed, Rot, SeatKind, VillageOptions, VillageSetup, VillageState } from './types';

const T = (id: string) => {
  const i = TILES.findIndex((t) => t.id === id);
  if (i < 0) throw new Error(id);
  return i;
};

function setup(kinds: SeatKind[], options: Partial<VillageOptions> = {}): VillageSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: `P${i}` })) as VillageSetup['seats'],
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

/** 지도를 직접 꾸민 게임 (0번 차례, 조각 놓기 단계). 놓는 조각은 맞는지 확인한다 */
function scene(puts: Put[], hands: string[][], opts: Partial<VillageOptions> = {}, stack: string[] = ['road-straight', 'road-curve', 'paddy-edge']): VillageState {
  const s = createGame(setup(hands.map(() => 'human' as SeatKind), opts), seededRandom(1));
  const grid = new Grid([s.board[0]]);
  const board: Placed[] = [s.board[0]];
  for (const p of puts) {
    const t = T(p.id);
    if (!grid.fits(t, p.x, p.y, p.r)) throw new Error(`맞지 않음: ${p.id} ${p.x},${p.y} r${p.r}`);
    const placed: Placed = { t, x: p.x, y: p.y, r: p.r, flag: p.flag ?? null, by: 0 };
    grid.add(placed);
    board.push(placed);
  }
  s.board = board;
  s.players.forEach((pl, i) => {
    pl.hand = hands[i].map(T);
    pl.flags = s.options.flags - board.filter((b) => b.flag?.player === i).length;
  });
  s.stack = stack.map(T);
  s.current = 0;
  s.phase = 'place';
  s.placed = null;
  return s;
}

function place(s: VillageState, hand: number, x: number, y: number, r: Rot): VillageState {
  const next = applyAction(s, { type: 'place', hand, x, y, r });
  expect(next).not.toBe(s);
  return next;
}

describe('조각 모음', () => {
  it('장승을 넣으면 56장, 빼면 장승 조각 5장이 빠진다. 처음 조각은 더미에 없다', () => {
    expect(deckList(true)).toHaveLength(56);
    expect(deckList(false)).toHaveLength(51);
    expect(deckList(true)).not.toContain(START_TILE);
    expect(deckList(false).some(isJangseungTile)).toBe(false);
    expect(TILES[START_TILE].name).toBe('마을 어귀');
    expect(TILES[START_TILE].jangseung).toBeDefined();
    expect(isJangseungTile(START_TILE)).toBe(false);
  });

  it('모든 조각의 지형이 올바르게 적혀 있다', () => {
    for (const def of TILES) {
      const used = new Set<number>();
      for (const s of def.segs) {
        for (const e of s.edges) {
          expect(used.has(e), `${def.id} 모서리 겹침`).toBe(false);
          used.add(e);
        }
        if (s.kind !== 'paddy') {
          expect(s.edges.length === 1, `${def.id}`).toBe(s.end !== undefined);
          expect(s.edges.length).toBeLessThanOrEqual(2);
        } else expect(s.end).toBeUndefined();
        if (s.fish) expect(s.kind).toBe('stream');
        if (s.crows) expect(s.kind).toBe('paddy');
        for (const v of s.anchor) expect(v >= 0 && v <= 100).toBe(true);
      }
    }
  });

  it('조각을 돌리면 모서리도 시계 방향으로 돈다', () => {
    const curve = T('road-curve'); // 동·남
    expect(EDGES[curve][0]).toEqual(['field', 'path', 'path', 'field']);
    expect(EDGES[curve][1]).toEqual(['field', 'field', 'path', 'path']);
    expect(rotPt([50, 0], 1)).toEqual([100, 50]);
    expect(rotPt([10, 20], 4)).toEqual([10, 20]);
    expect(DISTINCT_ROTS[T('road-straight')]).toHaveLength(2);
    expect(DISTINCT_ROTS[T('road-cross')]).toHaveLength(1);
    expect(DISTINCT_ROTS[T('paddy-full')]).toHaveLength(1);
    expect(DISTINCT_ROTS[curve]).toHaveLength(4);
  });

  it('점수표: 길 칸당 1, 냇물 칸당 1 + 물고기 2, 논 칸당 2 + 허수아비 2', () => {
    expect(featurePoints('path', 4, 0, 0)).toBe(4);
    expect(featurePoints('stream', 3, 2, 0)).toBe(7);
    expect(featurePoints('paddy', 3, 0, 1)).toBe(8);
  });
});

describe('게임 만들기와 놓기', () => {
  it('처음 조각을 깔고 모두 손에 2장씩 든다', () => {
    const s = createGame(setup(['human', 'ai-easy', 'ai-normal']), seededRandom(3));
    expect(s.board).toHaveLength(1);
    expect(s.board[0]).toMatchObject({ t: START_TILE, x: 0, y: 0, r: 0 });
    expect(s.players.every((p) => p.hand.length === 2 && p.flags === 6 && p.score === 0)).toBe(true);
    expect(s.stack).toHaveLength(56 - 6);
    expect(s.current).toBeGreaterThanOrEqual(0);
    expect(s.current).toBeLessThan(3);
    expect(tilesAccountedFor(s)).toBe(true);
  });

  it('빠른 게임은 손에 1장, 깃발 4개 규칙', () => {
    const s = createGame(setup(['human', 'ai-easy'], { hand: 1, flags: 4 }), seededRandom(4));
    expect(s.players.map((p) => p.hand.length)).toEqual([1, 1]);
    expect(s.players.map((p) => p.flags)).toEqual([4, 4]);
    expect(s.stack).toHaveLength(54);
  });

  it('플레이어가 1명이면 시작할 수 없다', () => {
    expect(() => createGame(setup(['human']))).toThrow();
  });

  it('맞닿은 이웃이 있고 모서리가 모두 같아야 놓을 수 있다', () => {
    const g = new Grid([{ t: START_TILE, x: 0, y: 0, r: 0, flag: null, by: null }]);
    const house = T('road-house'); // 길이 남쪽
    expect(g.fits(house, 1, 0, 1)).toBe(true); // 길이 서쪽 → 처음 조각의 동쪽 길과 맞음
    expect(g.fits(house, 1, 0, 0)).toBe(false); // 들 ↔ 길
    expect(g.mismatches(house, 1, 0, 0)).toEqual([3]);
    expect(g.fits(house, 2, 0, 1)).toBe(false); // 이웃이 없음
    expect(g.fits(house, 0, 0, 1)).toBe(false); // 이미 있음
    expect(g.fits(T('pine-hill'), 0, 1, 0)).toBe(true); // 들 ↔ 들
    expect(g.fits(T('pine-hill'), 0, -1, 0)).toBe(false); // 논둑 ↔ 들
    expect(g.frontier()).toHaveLength(4);
  });

  it('할 수 없는 놓기는 상태를 바꾸지 않는다', () => {
    const s = scene([], [['road-house', 'pine-hill'], ['road-straight']]);
    expect(applyAction(s, { type: 'place', hand: 0, x: 1, y: 0, r: 0 })).toBe(s);
    expect(applyAction(s, { type: 'place', hand: 5, x: 1, y: 0, r: 1 })).toBe(s);
    expect(applyAction(s, { type: 'place', hand: 0, x: 1.5, y: 0, r: 1 })).toBe(s);
    expect(applyAction(s, { type: 'place', hand: 0, x: 1, y: 0, r: 7 as Rot })).toBe(s);
    expect(applyAction(s, { type: 'flag', seg: 0 })).toBe(s);
    expect(applyAction(s, { type: 'skipFlag' })).toBe(s);
    expect(applyAction(s, { type: 'discard', hand: 0 })).toBe(s); // 놓을 곳이 있으면 버릴 수 없다
  });

  it('놓고 깃발 단계를 마치면 한 장을 새로 뽑고 다음 사람 차례', () => {
    let s = scene([], [['road-straight', 'pine-hill'], ['road-curve', 'road-curve']], {}, ['spring', 'pond']);
    s = place(s, 0, 1, 0, 1);
    expect(s.phase).toBe('flag');
    expect(s.players[0].hand.map((t) => TILES[t].id)).toEqual(['pine-hill']);
    s = applyAction(s, { type: 'skipFlag' });
    expect(s.players[0].hand.map((t) => TILES[t].id)).toEqual(['pine-hill', 'pond']);
    expect(s.current).toBe(1);
    expect(s.phase).toBe('place');
    expect(s.stack).toHaveLength(1);
    expect(s.lastTurn).toMatchObject({ player: 0, t: T('road-straight'), flag: null });
  });

  it('놓을 수 있는 자리 목록은 모두 실제로 놓을 수 있다', () => {
    const s = createGame(setup(['human', 'human']), seededRandom(9));
    const g = gridOf(s);
    for (const t of [T('road-cross'), T('paddy-full'), T('bridge'), T('pine-hill')]) {
      const list = placementsFor(g, t);
      expect(list.length).toBeGreaterThan(0);
      for (const p of list) expect(g.fits(t, p.x, p.y, p.r)).toBe(true);
    }
  });
});

describe('지형 완성과 점수', () => {
  it('길: 집에서 집까지 이어지면 완성, 깃발 주인이 칸마다 1점, 깃발은 돌아온다', () => {
    let s = scene([{ id: 'road-house', x: 1, y: 0, r: 1, flag: { seg: 0, player: 0 } }], [['road-house', 'pine-hill'], ['road-curve']]);
    expect(s.players[0].flags).toBe(5);
    s = place(s, 0, -1, 0, 3);
    // 완성된 길에는 이미 깃발이 있으므로 깃발 단계 없이 끝난다
    expect(s.phase).toBe('place');
    expect(s.players[0].score).toBe(3);
    expect(s.players[0].stats.path).toBe(3);
    expect(s.players[0].flags).toBe(6);
    expect(s.board[1].flag).toBeNull();
    const done = s.events.find((e) => e.type === 'complete');
    expect(done).toMatchObject({ kind: 'path', tiles: 3, points: 3, winners: [0] });
  });

  it('길이 고리처럼 닫혀도 완성', () => {
    let s = scene(
      [
        { id: 'road-curve', x: 0, y: 1, r: 0, flag: { seg: 0, player: 1 } },
        { id: 'road-curve', x: 1, y: 1, r: 1 },
        { id: 'road-curve', x: 1, y: 2, r: 2 },
      ],
      [['road-curve', 'pine-hill'], ['pine-hill']],
    );
    s = place(s, 0, 0, 2, 3);
    expect(s.players[1].score).toBe(4);
    expect(s.players[0].score).toBe(0);
  });

  it('냇물: 샘에서 연못까지, 칸마다 1점 + 물고기마다 2점', () => {
    let s = scene(
      [
        { id: 'spring', x: 0, y: 1, r: 3, flag: { seg: 0, player: 0 } },
        { id: 'stream-fish', x: 1, y: 1, r: 1 },
      ],
      [['pond', 'pine-hill'], ['pine-hill']],
    );
    s = place(s, 0, 2, 1, 1);
    expect(s.players[0].score).toBe(3 + 2 * 2);
    expect(s.players[0].stats.stream).toBe(7);
  });

  it('논: 논둑으로 다 둘러싸이면 완성, 칸마다 2점 + 허수아비 2점', () => {
    let s = scene([{ id: 'paddy-band', x: 0, y: -1, r: 0, flag: { seg: 0, player: 0 } }], [['paddy-edge', 'pine-hill'], ['pine-hill']]);
    const open = gridOf(s).trace(1, 0, 2);
    expect(open).toMatchObject({ kind: 'paddy', tiles: 2, open: 1, crows: 1, complete: false });
    s = place(s, 0, 0, -2, 2);
    expect(s.players[0].score).toBe(3 * 2 + 2);
    expect(s.players[0].stats.paddy).toBe(8);
  });

  it('깃발 없이 완성되면 점수는 없지만 완성은 알려 준다', () => {
    let s = scene([], [['paddy-edge', 'pine-hill'], ['pine-hill']]);
    s = place(s, 0, 0, -1, 2);
    expect(s.phase).toBe('flag');
    s = applyAction(s, { type: 'skipFlag' });
    expect(s.events.find((e) => e.type === 'complete')).toMatchObject({ kind: 'paddy', points: 4, winners: [] });
    expect(s.players.every((p) => p.score === 0)).toBe(true);
  });

  it('완성시키는 조각에 깃발을 꽂으면 바로 점수를 받고 깃발도 돌아온다', () => {
    let s = scene([{ id: 'road-house', x: 1, y: 0, r: 1 }], [['road-house', 'pine-hill'], ['pine-hill']]);
    s = place(s, 0, -1, 0, 3);
    expect(s.phase).toBe('flag');
    const choice = flagChoices(s)[0];
    expect(choice).toMatchObject({ ok: true, kind: 'path' });
    expect(choice.feature.complete).toBe(true);
    s = applyAction(s, { type: 'flag', seg: 0 });
    expect(s.players[0].score).toBe(3);
    expect(s.players[0].flags).toBe(6);
    expect(s.players[0].stats.flagsPlanted).toBe(1);
  });

  it('깃발이 많은 사람만 점수, 같으면 모두 다 받는다', () => {
    expect(majority([1, 2, 0])).toEqual([1]);
    expect(majority([1, 1, 0])).toEqual([0, 1]);
    expect(majority([0, 0])).toEqual([]);
    // 0번 1개, 1번 2개 → 1번만
    let s = scene(
      [
        { id: 'road-straight', x: 1, y: 0, r: 1, flag: { seg: 0, player: 1 } },
        { id: 'road-house', x: 2, y: 0, r: 1, flag: { seg: 0, player: 0 } },
        { id: 'road-straight', x: -1, y: 0, r: 1, flag: { seg: 0, player: 1 } },
      ],
      [['road-house', 'pine-hill'], ['pine-hill']],
    );
    s = place(s, 0, -2, 0, 3);
    expect(s.players.map((p) => p.score)).toEqual([0, 5]);
    expect(s.players.map((p) => p.flags)).toEqual([6, 6]);
    // 1개씩이면 둘 다 5점
    let t = scene(
      [
        { id: 'road-straight', x: 1, y: 0, r: 1, flag: { seg: 0, player: 1 } },
        { id: 'road-house', x: 2, y: 0, r: 1, flag: { seg: 0, player: 0 } },
        { id: 'road-straight', x: -1, y: 0, r: 1 },
      ],
      [['road-house', 'pine-hill'], ['pine-hill']],
    );
    t = place(t, 0, -2, 0, 3);
    expect(t.players.map((p) => p.score)).toEqual([5, 5]);
    expect(t.events.find((e) => e.type === 'complete')).toMatchObject({ winners: [0, 1] });
  });

  it('이미 깃발이 있는 지형에는 꽂을 수 없고, 같은 조각의 다른 지형에는 꽂을 수 있다', () => {
    let s = scene([{ id: 'road-straight', x: -1, y: 0, r: 1, flag: { seg: 0, player: 1 } }], [['paddy-road', 'pine-hill'], ['pine-hill']]);
    // 논둑 옆 길: 논(북), 길(동서). 처음 조각 동쪽에 놓으면 길이 깃발 있는 길과 이어진다
    s = place(s, 0, 1, 0, 0);
    const choices = flagChoices(s);
    expect(choices.find((c) => c.kind === 'path')).toMatchObject({ ok: false, reason: '이미 깃발이 있어요' });
    expect(choices.find((c) => c.kind === 'paddy')).toMatchObject({ ok: true });
    expect(applyAction(s, { type: 'flag', seg: 1 })).toBe(s);
    s = applyAction(s, { type: 'flag', seg: 0 });
    expect(s.board.at(-1)!.flag).toEqual({ seg: 0, player: 0 });
  });

  it('깃발이 없거나 꽂을 지형이 없으면 깃발 단계를 건너뛴다', () => {
    let s = scene([], [['road-straight', 'pine-hill'], ['pine-hill']]);
    s.players[0].flags = 0;
    s = place(s, 0, 1, 0, 1);
    expect(s.phase).toBe('place');
    expect(s.current).toBe(1);
    let t = scene([], [['pine-hill', 'pine-hill'], ['pine-hill']]);
    t = place(t, 0, 0, 1, 0);
    expect(t.phase).toBe('place');
    expect(t.current).toBe(1);
  });

  it('지형을 이어 붙이면 깃발이 합쳐져 함께 갖는 지형이 된다', () => {
    // 0번 깃발 길(서쪽)과 1번 깃발 길(동쪽 끝)이 가운데 조각으로 이어진다
    const s = scene(
      [
        { id: 'road-straight', x: -1, y: 0, r: 1, flag: { seg: 0, player: 0 } },
        { id: 'road-straight', x: 1, y: 0, r: 1 },
      ],
      [['pine-hill'], ['pine-hill']],
    );
    s.board[2].flag = { seg: 0, player: 1 };
    const f = gridOf(s).trace(0, 1, 2);
    expect(f.tiles).toBe(3);
    expect(f.flags).toEqual([1, 1]);
    expect(majority(f.flags)).toEqual([0, 1]);
  });
});

describe('장승', () => {
  it('맞닿은 이웃 모서리의 지형 종류 수만큼 바로 점수 (깃발 없이)', () => {
    let s = scene([], [['js-cross', 'pine-hill'], ['pine-hill']]);
    // 장승 갈림길: 북 길, 동 길, 남 논, 서 냇물(샘). 처음 조각의 서쪽 길에 동쪽 길을 붙인다 → 이웃 1곳(길)
    s = place(s, 0, -1, 0, 0);
    expect(s.events.find((e) => e.type === 'jangseung')).toMatchObject({ points: 1, kinds: ['path'] });
    expect(s.players[0].score).toBe(1);
    expect(s.players[0].stats.jangseung).toBe(1);
  });

  it('길·냇물·논이 모두 닿으면 3점', () => {
    // 가운데 (0,1)에 장승 갈림길: 위는 길, 아래는 논, 왼쪽은 냇물(샘)
    const g = new Grid([
      { t: T('road-straight'), x: 0, y: 0, r: 0, flag: null, by: null },
      { t: T('paddy-edge'), x: 0, y: 2, r: 0, flag: null, by: 0 },
      { t: T('spring'), x: -1, y: 1, r: 3, flag: null, by: 0 },
    ]);
    expect(g.fits(T('js-cross'), 0, 1, 0)).toBe(true);
    const i = g.add({ t: T('js-cross'), x: 0, y: 1, r: 0, flag: null, by: 0 });
    expect(jangseungScore(g, i)).toEqual({ points: 3, kinds: ['path', 'stream', 'paddy'] });
  });

  it('장승 끄기면 장승 조각이 없고, 혹시 놓아도 점수가 없다', () => {
    const off = createGame(setup(['human', 'human'], { jangseung: false }), seededRandom(2));
    expect([...off.stack, ...off.players.flatMap((p) => p.hand)].some(isJangseungTile)).toBe(false);
    let s = scene([], [['js-road', 'pine-hill'], ['pine-hill']], { jangseung: false });
    s = place(s, 0, 1, 0, 1);
    expect(s.events.some((e) => e.type === 'jangseung')).toBe(false);
    expect(s.players[0].score).toBe(0);
  });
});

describe('놓을 곳이 없을 때와 끝내기', () => {
  /** 사방이 논둑인 너른 논 한 장만 있는 지도 */
  function stuckScene(stack: string[]): VillageState {
    const s = scene([], [['road-cross', 'pine-hill'], ['paddy-edge']], {}, stack);
    s.board = [{ t: T('paddy-full'), x: 0, y: 0, r: 0, flag: null, by: null }];
    return s;
  }

  it('손의 조각을 어디에도 놓을 수 없으면 하나를 버리고 새로 뽑는다', () => {
    let s = stuckScene(['road-straight', 'paddy-edge']);
    expect(canPlaceAny(s, 0)).toBe(false);
    expect(mustDiscard(s)).toBe(true);
    expect(applyAction(s, { type: 'place', hand: 0, x: 1, y: 0, r: 0 })).toBe(s);
    s = applyAction(s, { type: 'discard', hand: 0 });
    expect(s.discarded.map((t) => TILES[t].id)).toEqual(['road-cross']);
    expect(s.players[0].hand.map((t) => TILES[t].id)).toEqual(['pine-hill', 'paddy-edge']);
    expect(s.current).toBe(0);
    expect(mustDiscard(s)).toBe(false);
    expect(s.events[0]).toMatchObject({ type: 'discard', player: 0 });
  });

  it('더미가 비었고 아무도 놓을 수 없으면 끝나고, 미완성 지형은 반 점수 (내림)', () => {
    let s = stuckScene([]);
    s.players[0].hand = [T('paddy-edge')];
    s.players[1].hand = [T('road-cross')];
    s = place(s, 0, 0, -1, 2);
    expect(s.phase).toBe('flag');
    s = applyAction(s, { type: 'flag', seg: 0 });
    // 너른 논(허수아비 1) + 논 한 배미 = 2칸, 아직 열림 → (2×2 + 2) / 2 = 3점
    expect(s.phase).toBe('gameover');
    expect(s.events.some((e) => e.type === 'pass' && e.player === 1)).toBe(true);
    expect(s.events.find((e) => e.type === 'final')).toMatchObject({ kind: 'paddy', points: 3, winners: [0] });
    expect(s.players[0].score).toBe(3);
    expect(s.players[0].stats.final).toBe(3);
    expect(s.winners).toEqual([0]);
    expect(s.events.at(-1)).toMatchObject({ type: 'gameover', winners: [0] });
  });

  it('더미가 비면 손에 남은 조각을 다 놓을 때까지 한다', () => {
    let s = scene([], [['road-straight', 'pine-hill'], ['road-curve', 'paddy-edge']], {}, []);
    s = place(s, 0, 1, 0, 1);
    s = applyAction(s, { type: 'skipFlag' });
    expect(s.players[0].hand).toHaveLength(1);
    expect(s.current).toBe(1);
    expect(s.phase).toBe('place');
  });

  it('같은 점수면 공동 우승, 순위는 점수 → 완성 수 순', () => {
    let s = stuckScene([]);
    s.players[0].hand = [T('paddy-edge')];
    s.players[1].hand = [];
    s.players[1].score = 3;
    s = place(s, 0, 0, -1, 2);
    s = applyAction(s, { type: 'flag', seg: 0 });
    expect(s.winners).toEqual([0, 1]);
    const r = structuredClone(s);
    r.players[1].stats.completed = 2;
    expect(rankings(r)).toEqual([1, 0]);
  });
});

describe('저장 검사', () => {
  it('새 게임과 진행 중인 게임은 올바르고, 고친 저장은 거절한다', () => {
    let s = createGame(setup(['human', 'ai-normal', 'ai-easy']), seededRandom(11));
    expect(isValidState(JSON.parse(JSON.stringify(s)))).toBe(true);
    const g = gridOf(s);
    const t = s.players[s.current].hand[0];
    const spot = placementsFor(g, t)[0];
    s = applyAction(s, { type: 'place', hand: 0, x: spot.x, y: spot.y, r: spot.r });
    const copy = JSON.parse(JSON.stringify(s));
    expect(isValidState(copy)).toBe(true);

    const dup = structuredClone(copy);
    dup.board.push({ ...dup.board[1] });
    expect(isValidState(dup)).toBe(false);
    const lost = structuredClone(copy);
    lost.stack.pop();
    expect(isValidState(lost)).toBe(false);
    const flags = structuredClone(copy);
    flags.players[0].flags = 9;
    expect(isValidState(flags)).toBe(false);
    const bad = structuredClone(copy);
    bad.board[1].r = (bad.board[1].r + 1) % 4;
    // 돌린 조각이 우연히 맞을 수도 있으므로, 맞지 않을 때만 거절을 확인한다
    if (!new Grid([bad.board[0]]).fits(bad.board[1].t, bad.board[1].x, bad.board[1].y, bad.board[1].r)) expect(isValidState(bad)).toBe(false);
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ ...copy, phase: 'oops' })).toBe(false);
  });
});

describe('지형 모으기', () => {
  it('모든 지형을 한 번씩만 센다', () => {
    const s = scene(
      [
        { id: 'road-house', x: 1, y: 0, r: 1 },
        { id: 'paddy-edge', x: 0, y: -1, r: 2 },
      ],
      [['pine-hill'], ['pine-hill']],
    );
    const fs = allFeatures(gridOf(s), 2);
    expect(fs.map((f) => `${f.kind}${f.tiles}${f.complete ? '!' : ''}`).sort()).toEqual(['paddy2!', 'path2']);
    expect(fs.reduce((n, f) => n + f.nodes.length, 0)).toBe(4);
  });
});
