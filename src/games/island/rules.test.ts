import { afterEach, describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { CORNERS, EDGES, HEXES, edgeBetween } from './board';
import {
  BANK_RATE,
  COSTS,
  DEFAULT_OPTIONS,
  FLAG_MIN,
  HAND_LIMIT,
  LIGHTHOUSE_RATE,
  MAX_ROUNDS,
  applyAction,
  bankRate,
  buildBlocker,
  canPlaceHouse,
  canPlaceRoad,
  createGame,
  emptyRes,
  generateBoard,
  isFairBoard,
  points,
  pointsOf,
  previewChoice,
  producingHexes,
  totalRes,
  touchedHexes,
  validSpots,
} from './rules';
import type { IslandOptions, IslandSetup, IslandState, ResourceCount, SeatKind } from './types';

function setup(kinds: SeatKind[], options: Partial<IslandOptions> = {}): IslandSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: `P${i}` })) as IslandSetup['seats'],
    options: { ...DEFAULT_OPTIONS, ...options },
  };
}

/** 처음 집 놓기를 건너뛰고 0번 차례(주사위 전)로 시작하는 판 */
function fresh(n = 2, options: Partial<IslandOptions> = {}, seed = 1): IslandState {
  const s = createGame(setup(Array.from({ length: n }, () => 'human' as SeatKind), options), seededRandom(seed));
  s.phase = 'roll';
  s.current = 0;
  s.setupOrder = [...Array.from({ length: n }, (_, i) => i), ...Array.from({ length: n }, (_, i) => n - 1 - i)];
  s.setupStep = s.setupOrder.length;
  s.round = 1;
  s.events = [];
  return s;
}

function res(r: Partial<ResourceCount>): ResourceCount {
  return { ...emptyRes(), ...r };
}

function add(a: ResourceCount, b: ResourceCount): ResourceCount {
  return { wood: a.wood + b.wood, stone: a.stone + b.stone, grain: a.grain + b.grain, fish: a.fish + b.fish };
}

function inMain(s: IslandState, dice: [number, number] = [6, 6]): IslandState {
  // 아무 건물도 없을 때 굴리면 자원 변화 없이 main으로 간다
  const t = applyAction(s, { type: 'roll', dice });
  return t;
}

/** 땅 3칸에 닿은 안쪽 모서리 */
const INNER = CORNERS.filter((c) => c.hexes.length === 3).map((c) => c.id);

describe('섬 모양', () => {
  it('땅 16칸이 하나로 이어져 있고, 대칭 육각형 판이 아니다', () => {
    expect(HEXES).toHaveLength(16);
    const seen = new Set([0]);
    const stack = [0];
    while (stack.length) for (const nb of HEXES[stack.pop()!].neighbors) if (!seen.has(nb)) (seen.add(nb), stack.push(nb));
    expect(seen.size).toBe(16);
    // 정육각형 판이라면 이웃 수 분포가 대칭이다. 이 섬은 안쪽 칸이 2개뿐인 손그림 모양
    expect(HEXES.filter((h) => !h.coastal)).toHaveLength(2);
    const rows = new Map<number, number>();
    HEXES.forEach((h) => rows.set(h.r, (rows.get(h.r) ?? 0) + 1));
    expect([...rows.values()]).not.toEqual([...rows.values()].reverse());
  });

  it('모서리는 땅 1~3칸에 닿고, 변·이웃 관계가 서로 맞다', () => {
    for (const c of CORNERS) {
      expect(c.hexes.length).toBeGreaterThanOrEqual(1);
      expect(c.hexes.length).toBeLessThanOrEqual(3);
      expect(c.coastal).toBe(c.hexes.length < 3);
      for (const n of c.corners) expect(CORNERS[n].corners).toContain(c.id);
      for (const e of c.edges) expect([EDGES[e].a, EDGES[e].b]).toContain(c.id);
    }
    for (const h of HEXES) {
      expect(new Set(h.corners).size).toBe(6);
      expect(new Set(h.edges).size).toBe(6);
    }
    expect(edgeBetween(EDGES[0].a, EDGES[0].b)).toBe(0);
  });
});

describe('판 섞기', () => {
  it('여러 시드에서 늘 공평한 판: 이웃 칸 숫자가 다르고, 숫자마다 2~3번, 갯벌·언덕은 바닷가', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const b = generateBoard(seededRandom(seed));
      expect(isFairBoard(b.terrain, b.numbers)).toBe(true);
      for (const h of HEXES) for (const nb of h.neighbors) if (b.numbers[h.id] > 0) expect(b.numbers[nb]).not.toBe(b.numbers[h.id]);
      expect(b.terrain.filter((t) => t === 'hill')).toHaveLength(1);
      expect(b.numbers.filter((n) => n === 0)).toHaveLength(1);
    }
  });

  it('판마다 땅과 숫자가 바뀐다', () => {
    const a = generateBoard(seededRandom(1));
    const b = generateBoard(seededRandom(2));
    expect(a.terrain.join() + a.numbers.join()).not.toBe(b.terrain.join() + b.numbers.join());
  });

  it('공평 검사는 이웃한 같은 숫자를 잡아낸다', () => {
    const b = generateBoard(seededRandom(3));
    const h = HEXES.find((x) => b.terrain[x.id] !== 'hill' && x.neighbors.some((nb) => b.terrain[nb] !== 'hill'))!;
    const nb = h.neighbors.find((x) => b.terrain[x] !== 'hill')!;
    const numbers = [...b.numbers];
    numbers[nb] = numbers[h.id];
    expect(isFairBoard(b.terrain, numbers)).toBe(false);
  });
});

describe('게임 만들기와 처음 집 놓기', () => {
  it('빈 자리는 빼고, 뱀 순서(0 1 2 2 1 0)로 놓는다', () => {
    const s = createGame(setup(['human', 'empty', 'ai-easy', 'ai-normal']), seededRandom(4));
    expect(s.players.map((p) => p.seat)).toEqual([0, 2, 3]);
    const f = s.setupOrder[0];
    expect(s.setupOrder).toEqual([f, (f + 1) % 3, (f + 2) % 3, (f + 2) % 3, (f + 1) % 3, f]);
    expect(s.phase).toBe('setup');
    expect(s.market).toHaveLength(4);
    expect(createGame(setup(['human', 'human'], { market: false }), seededRandom(4)).market).toEqual([]);
  });

  it('집은 다른 건물과 변 두 칸 이상 떨어져야 하고, 길은 방금 놓은 집에 붙여야 한다', () => {
    let s = createGame(setup(['human', 'human']), seededRandom(5));
    const p = s.current;
    const c = INNER[0];
    // 길부터는 못 놓는다
    expect(applyAction(s, { type: 'build', kind: 'road', at: CORNERS[c].edges[0] })).toBe(s);
    s = applyAction(s, { type: 'build', kind: 'house', at: c });
    expect(s.buildings[c]).toEqual({ owner: p, type: 'house' });
    // 집을 또 놓을 수는 없다
    expect(applyAction(s, { type: 'build', kind: 'house', at: INNER[INNER.length - 1] })).toBe(s);
    const far = EDGES.find((e) => e.a !== c && e.b !== c)!;
    expect(applyAction(s, { type: 'build', kind: 'road', at: far.id })).toBe(s);
    s = applyAction(s, { type: 'build', kind: 'road', at: CORNERS[c].edges[0] });
    expect(s.current).not.toBe(p);
    // 다음 사람은 이웃 모서리에 놓을 수 없다
    for (const n of CORNERS[c].corners) expect(canPlaceHouse(s, s.current, n)).toBe(false);
  });

  it('두 번째 집에 닿은 땅마다 자원 하나씩, 준비가 끝나면 첫 사람이 주사위를 굴린다', () => {
    let s = createGame(setup(['human', 'human']), seededRandom(6));
    const first = s.current;
    const picks: number[] = [];
    for (let step = 0; step < 4; step++) {
      const c = validSpots(s, s.current, 'house').find((x) => CORNERS[x].hexes.length === 3)!;
      picks.push(c);
      const before = totalRes(s.players[s.current].res);
      const who = s.current;
      s = applyAction(s, { type: 'build', kind: 'house', at: c });
      const producing = CORNERS[c].hexes.filter((h) => s.terrain[h] !== 'hill').length;
      expect(totalRes(s.players[who].res) - before).toBe(step >= 2 ? producing : 0);
      s = applyAction(s, { type: 'build', kind: 'road', at: validSpots(s, s.current, 'road')[0] });
    }
    expect(s.phase).toBe('roll');
    expect(s.current).toBe(first);
    expect(s.round).toBe(1);
  });
});

describe('주사위와 자원', () => {
  it('두 눈 중 하나와 같은 숫자의 땅이 모두 자원을 낸다', () => {
    const s = fresh();
    const hexes = producingHexes(s, [2, 5]);
    expect(hexes.length).toBeGreaterThanOrEqual(4);
    for (const h of HEXES) expect(hexes.includes(h.id)).toBe(s.numbers[h.id] === 2 || s.numbers[h.id] === 5);
  });

  it('집은 1개, 마을회관은 2개, 같은 눈이면 두 배, 등대 언덕은 아무것도 없다', () => {
    const s = fresh();
    const h = HEXES.find((x) => s.terrain[x.id] === 'forest')!;
    const n = s.numbers[h.id];
    const other = n === 6 ? 1 : 6;
    const [c1, c2] = [h.corners[0], h.corners[3]];
    s.buildings[c1] = { owner: 0, type: 'house' };
    s.buildings[c2] = { owner: 1, type: 'hall' };
    const gainsAt = (t: IslandState) => {
      // 같은 모서리에 닿은 다른 숲 칸이 같이 나올 수 있으므로 생산 기록으로 센다
      const e = t.events.find((x) => x.type === 'produce');
      return e && e.type === 'produce' ? e.gains.filter((g) => g.hex === h.id) : [];
    };
    const rolled = applyAction(s, { type: 'roll', dice: [n, other] });
    expect(rolled.phase).toBe('choose');
    const t = applyAction(rolled, { type: 'choose', die: 0 });
    const gains = gainsAt(t);
    expect(gains.find((g) => g.player === 0)?.amount).toBe(1);
    expect(gains.find((g) => g.player === 1)?.amount).toBe(2);
    const d = applyAction(s, { type: 'roll', dice: [n, n] });
    const dg = gainsAt(d);
    expect(dg.find((g) => g.player === 0)?.amount).toBe(2);
    expect(dg.find((g) => g.player === 1)?.amount).toBe(4);
    // 등대 언덕은 숫자가 없다
    const hill = HEXES.find((x) => s.terrain[x.id] === 'hill')!;
    expect(s.numbers[hill.id]).toBe(0);
    expect(t.phase).toBe('main');
    expect(t.dice).toEqual([n, other]);
    expect(t.chosenDie).toBe(0);
  });

  it('골라 쓰는 주사위: 고르기 전에는 아무도 받지 않고, 고른 숫자의 땅만 자원을 낸다', () => {
    const s = fresh();
    // 모든 안쪽 모서리에 집을 두어 어느 숫자든 누군가 받게 한다
    CORNERS.forEach((c) => {
      if (c.id % 5 === 0 && c.corners.every((x) => !s.buildings[x])) s.buildings[c.id] = { owner: c.id % 2, type: 'house' };
    });
    const [a, b] = [2, 5];
    const rolled = applyAction(s, { type: 'roll', dice: [a, b] });
    expect(rolled.phase).toBe('choose');
    expect(rolled.players.map((p) => totalRes(p.res))).toEqual([0, 0]);
    // 고르기 전에는 짓기·바꾸기·차례 마치기를 할 수 없다
    expect(applyAction(rolled, { type: 'endTurn' })).toBe(rolled);
    expect(applyAction(rolled, { type: 'roll' })).toBe(rolled);
    expect(applyAction(rolled, { type: 'choose', die: 2 as 0 })).toBe(rolled);
    for (const die of [0, 1] as const) {
      const before = previewChoice(rolled, die);
      const t = applyAction(rolled, { type: 'choose', die });
      expect(t.players.map((p) => p.res)).toEqual(before);
      const e = t.events.find((x) => x.type === 'choose');
      expect(e && e.type === 'choose' && e.hexes.every((h) => t.numbers[h] === (die === 0 ? a : b))).toBe(true);
      expect(e && e.type === 'choose' ? e.hexes.length : 0).toBe(HEXES.filter((h) => t.numbers[h.id] === (die === 0 ? a : b)).length);
      expect(applyAction(t, { type: 'choose', die })).toBe(t);
    }
    // 다음 차례에는 고른 눈이 지워진다
    const next = applyAction(applyAction(rolled, { type: 'choose', die: 1 }), { type: 'endTurn' });
    if (next.phase === 'roll') {
      expect(next.chosenDie).toBe(null);
      expect(next.dice).toBe(null);
    }
  });

  it('같은 눈이면 고르지 않고 그 숫자가 두 번 낸다', () => {
    const s = fresh();
    const h = HEXES.find((x) => s.terrain[x.id] === 'field')!;
    s.buildings[h.corners[1]] = { owner: 0, type: 'house' };
    const n = s.numbers[h.id];
    const t = applyAction(s, { type: 'roll', dice: [n, n] });
    expect(t.phase).toBe('main');
    expect(t.chosenDie).toBe(null);
    expect(t.players[0].res.grain).toBeGreaterThanOrEqual(2);
    expect(t.players[0].res.grain % 2).toBe(0);
  });

  it('풍년 규칙: 고르지 않고 두 눈의 땅이 모두 자원을 낸다', () => {
    const s = fresh(2, { harvest: true });
    const f = HEXES.find((x) => s.terrain[x.id] === 'forest')!;
    const r = HEXES.find((x) => s.terrain[x.id] === 'rock' && s.numbers[x.id] !== s.numbers[f.id])!;
    s.buildings[f.corners[0]] = { owner: 0, type: 'house' };
    s.buildings[r.corners[3]] = { owner: 0, type: 'house' };
    const t = applyAction(s, { type: 'roll', dice: [s.numbers[f.id], s.numbers[r.id]] });
    expect(t.phase).toBe('main');
    expect(t.players[0].res.wood).toBeGreaterThanOrEqual(1);
    expect(t.players[0].res.stone).toBeGreaterThanOrEqual(1);
    // 기본 규칙(골라 쓰기)에서는 같은 주사위로 고르기를 기다린다
    const u = fresh(2, { harvest: false });
    expect(applyAction(u, { type: 'roll', dice: [1, 2] }).phase).toBe('choose');
  });

  it('주사위는 1~6, 굴린 뒤에는 다시 굴릴 수 없다', () => {
    const rng = seededRandom(9);
    for (let k = 0; k < 50; k++) {
      const t = applyAction(fresh(), { type: 'roll' }, rng);
      expect(t.dice![0]).toBeGreaterThanOrEqual(1);
      expect(t.dice![1]).toBeLessThanOrEqual(6);
      expect(applyAction(t, { type: 'roll' }, rng)).toBe(t);
    }
  });
});

describe('짓기', () => {
  /** 0번이 안쪽 모서리에 집과 길 하나를 가진 판 */
  function withHome(n = 2) {
    const s = fresh(n);
    const c = INNER[0];
    s.buildings[c] = { owner: 0, type: 'house' };
    const e = CORNERS[c].edges[0];
    s.roads[e] = 0;
    return { s: inMain(s), c, e };
  }

  it('길은 내 길·건물에 이어야 하고 나무1·돌1이 든다', () => {
    const { s, c, e } = withHome();
    s.players[0].res = res({ wood: 1, stone: 1 });
    const end = EDGES[e].a === c ? EDGES[e].b : EDGES[e].a;
    const next = CORNERS[end].edges.find((x) => x !== e)!;
    const far = EDGES.find((x) => ![x.a, x.b].some((v) => v === c || v === end))!;
    expect(canPlaceRoad(s, 0, far.id)).toBe(false);
    expect(applyAction(s, { type: 'build', kind: 'road', at: far.id })).toBe(s);
    const t = applyAction(s, { type: 'build', kind: 'road', at: next });
    expect(t.roads[next]).toBe(0);
    expect(t.players[0].res).toEqual(emptyRes());
    // 자원이 없으면 못 짓는다
    const other = CORNERS[c].edges.find((x) => x !== e)!;
    expect(applyAction(t, { type: 'build', kind: 'road', at: other })).toBe(t);
    expect(buildBlocker(t, 0, 'road')).toContain('모자라요');
  });

  it('남의 건물이 있는 모서리를 지나 길을 이을 수 없다', () => {
    const { s, c, e } = withHome();
    const end = EDGES[e].a === c ? EDGES[e].b : EDGES[e].a;
    const next = CORNERS[end].edges.find((x) => x !== e)!;
    const beyond = EDGES[next].a === end ? EDGES[next].b : EDGES[next].a;
    s.roads[next] = 0;
    s.buildings[beyond] = { owner: 1, type: 'house' };
    const after = CORNERS[beyond].edges.filter((x) => x !== next);
    for (const x of after) expect(canPlaceRoad(s, 0, x)).toBe(false);
  });

  it('집은 내 길이 닿고 떨어진 모서리에만 짓고, 값을 치른다', () => {
    const { s, c, e } = withHome();
    s.players[0].res = add(COSTS.road, COSTS.house);
    const end = EDGES[e].a === c ? EDGES[e].b : EDGES[e].a;
    // 길 끝은 집과 바로 이웃이라 못 짓는다
    expect(canPlaceHouse(s, 0, end)).toBe(false);
    const next = CORNERS[end].edges.find((x) => x !== e)!;
    let t = applyAction(s, { type: 'build', kind: 'road', at: next });
    const spot = EDGES[next].a === end ? EDGES[next].b : EDGES[next].a;
    expect(validSpots(t, 0, 'house')).toContain(spot);
    t = applyAction(t, { type: 'build', kind: 'house', at: spot });
    expect(t.buildings[spot]).toEqual({ owner: 0, type: 'house' });
    expect(t.players[0].res).toEqual(emptyRes());
    expect(points(t, 0)).toBe(2);
  });

  it('마을회관은 내 집만 키울 수 있고 점수가 2점이 된다', () => {
    const { s, c } = withHome();
    s.players[0].res = { ...COSTS.hall };
    const theirs = INNER[INNER.length - 1];
    s.buildings[theirs] = { owner: 1, type: 'house' };
    expect(applyAction(s, { type: 'build', kind: 'hall', at: theirs })).toBe(s);
    const t = applyAction(s, { type: 'build', kind: 'hall', at: c });
    expect(t.buildings[c]).toEqual({ owner: 0, type: 'hall' });
    expect(pointsOf(t, 0)).toMatchObject({ houses: 0, halls: 1, total: 2 });
    expect(t.players[0].res).toEqual(emptyRes());
  });

  it('등대는 바닷가 내 집에 하나만, +2점이고 은행이 2:1이 된다', () => {
    const s = fresh();
    const coast = CORNERS.find((c) => c.coastal && c.hexes.length === 2)!.id;
    const inner = INNER[0];
    s.buildings[coast] = { owner: 0, type: 'house' };
    s.buildings[inner] = { owner: 0, type: 'house' };
    let t = inMain(s);
    t.players[0].res = add(COSTS.lighthouse, COSTS.lighthouse);
    expect(validSpots(t, 0, 'lighthouse')).toEqual([coast]);
    expect(applyAction(t, { type: 'build', kind: 'lighthouse', at: inner })).toBe(t);
    expect(bankRate(t, 0)).toBe(BANK_RATE);
    t = applyAction(t, { type: 'build', kind: 'lighthouse', at: coast });
    expect(t.lighthouses[0]).toBe(coast);
    expect(points(t, 0)).toBe(4);
    expect(bankRate(t, 0)).toBe(LIGHTHOUSE_RATE);
    expect(buildBlocker(t, 0, 'lighthouse')).toBe('등대는 한 사람에 하나예요');
    expect(applyAction(t, { type: 'build', kind: 'lighthouse', at: coast })).toBe(t);
  });

  it('주사위를 굴리기 전에는 지을 수 없다', () => {
    const s = fresh();
    s.players[0].res = res({ wood: 5, stone: 5, grain: 5, fish: 5 });
    s.buildings[INNER[0]] = { owner: 0, type: 'house' };
    expect(applyAction(s, { type: 'build', kind: 'hall', at: INNER[0] })).toBe(s);
    expect(applyAction(s, { type: 'endTurn' })).toBe(s);
  });
});

describe('바꾸기', () => {
  it('은행: 같은 자원 3개 → 아무 자원 1개 (모자라거나 같은 자원이면 안 됨)', () => {
    const s = inMain(fresh());
    s.players[0].res = res({ stone: 3, wood: 2 });
    expect(applyAction(s, { type: 'bank', give: 'wood', get: 'fish' })).toBe(s);
    expect(applyAction(s, { type: 'bank', give: 'stone', get: 'stone' })).toBe(s);
    const t = applyAction(s, { type: 'bank', give: 'stone', get: 'fish' });
    expect(t.players[0].res).toEqual(res({ wood: 2, fish: 1 }));
    expect(t.bankTrades).toBe(1);
  });

  it('장터: 내 자원 1개와 장터 1개를 맞바꾸고, 준 자원은 장터에 남으며 차례마다 한 번', () => {
    const s = inMain(fresh());
    s.market = ['fish', 'grain', 'wood', 'wood'];
    s.players[0].res = res({ stone: 2 });
    const t = applyAction(s, { type: 'market', give: 'stone', slot: 1 });
    expect(t.players[0].res).toEqual(res({ stone: 1, grain: 1 }));
    expect(t.market).toEqual(['fish', 'stone', 'wood', 'wood']);
    expect(applyAction(t, { type: 'market', give: 'stone', slot: 0 })).toBe(t);
    // 같은 자원끼리는 바꿀 수 없다
    expect(applyAction(s, { type: 'market', give: 'stone', slot: 1 }).market[1]).toBe('stone');
    const w = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, res: res({ wood: 1 }) } : p)) };
    expect(applyAction(w, { type: 'market', give: 'wood', slot: 2 })).toBe(w);
  });

  it('장터를 끄면 장터 바꾸기를 할 수 없다', () => {
    const s = inMain(fresh(2, { market: false }));
    s.players[0].res = res({ stone: 2 });
    expect(s.market).toEqual([]);
    expect(applyAction(s, { type: 'market', give: 'stone', slot: 0 })).toBe(s);
  });
});

describe('차례 마치기, 손 제한, 승리', () => {
  it('9개 이하면 바로 다음 사람, 넘으면 골라서 9개까지 내려놓는다', () => {
    let s = inMain(fresh());
    s.players[0].res = res({ wood: 9 });
    let t = applyAction(s, { type: 'endTurn' });
    expect(t.phase).toBe('roll');
    expect(t.current).toBe(1);

    s = inMain(fresh());
    s.players[0].res = res({ wood: 6, stone: 3, fish: 3 });
    t = applyAction(s, { type: 'endTurn' });
    expect(t.phase).toBe('discard');
    expect(t.discardNeed).toBe(12 - HAND_LIMIT);
    // 개수가 틀리거나 없는 것을 내려놓을 수 없다
    expect(applyAction(t, { type: 'discard', res: res({ wood: 2 }) })).toBe(t);
    expect(applyAction(t, { type: 'discard', res: res({ grain: 3 }) })).toBe(t);
    const u = applyAction(t, { type: 'discard', res: res({ wood: 2, fish: 1 }) });
    expect(u.players[0].res).toEqual(res({ wood: 4, stone: 3, fish: 2 }));
    expect(u.players[0].stats.discarded).toBe(3);
    expect(u.current).toBe(1);
  });

  it('목표 점수는 내 차례를 마칠 때 확인한다 (손 제한보다 먼저)', () => {
    const s = inMain(fresh(2, { target: 8 }));
    // 회관 3개(6점) + 등대(2점) = 8점
    const coast = CORNERS.filter((c) => c.coastal);
    const spots: number[] = [];
    for (const c of coast) if (spots.length < 3 && spots.every((x) => !CORNERS[x].corners.includes(c.id) && x !== c.id)) spots.push(c.id);
    spots.forEach((c) => (s.buildings[c] = { owner: 0, type: 'hall' }));
    s.lighthouses[0] = spots[0];
    s.players[0].res = res({ wood: 20 });
    expect(points(s, 0)).toBe(8);
    expect(s.phase).toBe('main');
    const t = applyAction(s, { type: 'endTurn' });
    expect(t.phase).toBe('gameover');
    expect(t.winner).toBe(0);
    expect(applyAction(t, { type: 'roll' })).toBe(t);
  });

  it('바퀴 수: 첫 사람에게 돌아올 때마다 1씩 늘고, 아주 오래 걸리면 점수 높은 사람이 이긴다', () => {
    let s = fresh(3);
    s.buildings[INNER[0]] = { owner: 2, type: 'hall' };
    const turn = (t: IslandState) => {
      const r = applyAction(t, { type: 'roll', dice: [6, 6] });
      r.players.forEach((p) => (p.res = emptyRes()));
      return applyAction(r, { type: 'endTurn' });
    };
    for (let k = 0; k < 3; k++) s = turn(s);
    expect(s.round).toBe(2);
    s.round = MAX_ROUNDS;
    for (let k = 0; k < 3; k++) s = turn(s);
    expect(s.phase).toBe('gameover');
    expect(s.winner).toBe(2);
  });
});

describe('바다 축제 깃발', () => {
  /** p의 집들을 놓아 서로 다른 땅 칸 count개 이상에 닿게 한다 */
  function spread(s: IslandState, p: number, count: number, avoid: Set<number> = new Set()) {
    for (const c of CORNERS) {
      if (touchedHexes(s, p).size >= count) break;
      if (avoid.has(c.id) || s.buildings[c.id] || c.corners.some((n) => s.buildings[n])) continue;
      if (c.hexes.every((h) => touchedHexes(s, p).has(h))) continue;
      s.buildings[c.id] = { owner: p, type: 'house' };
    }
  }

  it(`땅 ${FLAG_MIN}칸 이상에 닿게 집을 지으면 받고, 가진 사람보다 많아야 빼앗는다`, () => {
    let s = inMain(fresh());
    spread(s, 0, FLAG_MIN - 3);
    // 0번 차례: 집 하나로 FLAG_MIN칸이 되게
    const reach = (p: number, need: number) =>
      CORNERS.find((c) => !s.buildings[c.id] && c.corners.every((n) => !s.buildings[n]) && new Set([...touchedHexes(s, p), ...c.hexes]).size >= need)!;
    const c = reach(0, FLAG_MIN);
    s.roads[c.edges[0]] = 0;
    s.players[0].res = { ...COSTS.house };
    s = applyAction(s, { type: 'build', kind: 'house', at: c.id });
    const mine = touchedHexes(s, 0).size;
    expect(mine).toBeGreaterThanOrEqual(FLAG_MIN);
    expect(s.flagHolder).toBe(0);
    expect(s.events.some((e) => e.type === 'flag' && e.player === 0 && e.from === null)).toBe(true);
    expect(points(s, 0) - pointsOf(s, 0).houses).toBe(2);

    // 1번이 같은 수만큼 닿으면 그대로, 더 많으면 빼앗는다
    s = applyAction(s, { type: 'endTurn' });
    s = applyAction(s, { type: 'roll', dice: [6, 6] });
    s.players[1].res = add(COSTS.house, COSTS.house);
    spread(s, 1, mine - 1);
    expect(touchedHexes(s, 1).size).toBe(mine - 1);
    expect(s.flagHolder).toBe(0);
    const tie = CORNERS.find(
      (x) => !s.buildings[x.id] && x.corners.every((n) => !s.buildings[n]) && new Set([...touchedHexes(s, 1), ...x.hexes]).size === mine,
    );
    expect(tie).toBeTruthy();
    if (tie) {
      s.roads[tie.edges[0]] = 1;
      const t = applyAction(s, { type: 'build', kind: 'house', at: tie.id });
      expect(touchedHexes(t, 1).size).toBe(mine);
      expect(t.flagHolder).toBe(0);
    }
    const more = CORNERS.find(
      (x) => !s.buildings[x.id] && x.corners.every((n) => !s.buildings[n]) && new Set([...touchedHexes(s, 1), ...x.hexes]).size > mine,
    );
    expect(more).toBeTruthy();
    s.roads[more!.edges[0]] = 1;
    const u = applyAction(s, { type: 'build', kind: 'house', at: more!.id });
    expect(u.flagHolder).toBe(1);
    expect(u.events.some((e) => e.type === 'flag' && e.from === 0)).toBe(true);
  });

  it(`${FLAG_MIN - 1}칸으로는 받지 못한다`, () => {
    let s = inMain(fresh());
    spread(s, 0, FLAG_MIN - 3);
    const c = CORNERS.find((x) => !s.buildings[x.id] && x.corners.every((n) => !s.buildings[n]) && new Set([...touchedHexes(s, 0), ...x.hexes]).size === FLAG_MIN - 1);
    expect(c).toBeTruthy();
    if (!c) return;
    s.roads[c.edges[0]] = 0;
    s.players[0].res = { ...COSTS.house };
    s = applyAction(s, { type: 'build', kind: 'house', at: c.id });
    expect(s.flagHolder).toBe(null);
  });
});

describe('저장', () => {
  const store = new Map<string, string>();
  const g = globalThis as unknown as { window?: unknown };
  afterEach(() => {
    store.clear();
  });

  it('저장한 판을 그대로 불러오고, 망가진 저장은 무시한다', async () => {
    g.window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
    };
    const { loadSavedIslandGame, saveIslandGame, clearSavedIslandGame } = await import('./storage');
    const su = setup(['human', 'ai-normal', 'ai-easy']);
    let s = createGame(su, seededRandom(11));
    s = applyAction(s, { type: 'build', kind: 'house', at: validSpots(s, s.current, 'house')[0] });
    saveIslandGame(su, s);
    const loaded = loadSavedIslandGame();
    expect(loaded?.state.buildings).toEqual(s.buildings);
    expect(loaded?.state.setupHouse).toBe(s.setupHouse);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);

    const raw = JSON.parse(store.get('family-boardgame.island.save.v1')!);
    raw.state.numbers[0] = 9;
    store.set('family-boardgame.island.save.v1', JSON.stringify(raw));
    expect(loadSavedIslandGame()).toBeNull();
    store.set('family-boardgame.island.save.v1', '{oops');
    expect(loadSavedIslandGame()).toBeNull();
    clearSavedIslandGame();
    expect(store.has('family-boardgame.island.save.v1')).toBe(false);
    delete g.window;
  });
});

it('짓는 값', () => {
  // 골라 쓰는 주사위에 맞춰 다듬은 값 (컴퓨터끼리 2명 약 12바퀴, 4명 약 9바퀴)
  expect(COSTS.road).toEqual(res({ wood: 1, stone: 1 }));
  expect(COSTS.house).toEqual(res({ wood: 2, stone: 1, grain: 1, fish: 1 }));
  expect(COSTS.hall).toEqual(res({ stone: 3, fish: 2, grain: 2 }));
  expect(COSTS.lighthouse).toEqual(res({ stone: 3, wood: 1, grain: 1, fish: 1 }));
});
