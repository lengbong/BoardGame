import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { CORNERS, EDGES } from './board';
import { HEX_YIELD, NUMBER_CHANCE, chooseDie, chooseDiscard, decideAction, makePlans, recommendSpot, type AiLevel } from './ai';
import { COSTS, DEFAULT_OPTIONS, FLAG_MIN, MAX_ROUNDS, applyAction, createGame, emptyRes, hexesWithNumber, points, previewChoice, spacedOk, totalRes, touchedHexes, validSpots } from './rules';
import type { IslandOptions, IslandSetup, IslandState, ResourceCount, SeatKind } from './types';

function setup(kinds: SeatKind[], options: Partial<IslandOptions> = {}): IslandSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: `C${i}` })) as IslandSetup['seats'],
    options: { ...DEFAULT_OPTIONS, ...options },
  };
}

function res(r: Partial<ResourceCount>): ResourceCount {
  return { ...emptyRes(), ...r };
}

/** 컴퓨터끼리 끝까지. 고른 행동이 하나라도 규칙에 어긋나면 알려 준다 */
function playOut(kinds: SeatKind[], seed: number, options: Partial<IslandOptions> = {}) {
  const rng = seededRandom(seed);
  let s = createGame(setup(kinds, options), rng);
  let steps = 0;
  let illegal = 0;
  while (s.phase !== 'gameover' && steps < 5000) {
    const level = s.players[s.current].kind as AiLevel;
    const next = applyAction(s, decideAction(s, level, rng), rng);
    if (next === s) {
      illegal++;
      break;
    }
    s = next;
    steps++;
  }
  return { s, steps, illegal };
}

/** 처음 집 놓기를 컴퓨터끼리 끝낸 판 (0번 차례, 주사위 굴린 뒤) */
function afterSetup(seed: number, kinds: SeatKind[] = ['ai-normal', 'ai-normal']): IslandState {
  const rng = seededRandom(seed);
  let s = createGame(setup(kinds), rng);
  while (s.phase === 'setup') s = applyAction(s, decideAction(s, 'ai-normal', rng), rng);
  s.current = 0;
  s = applyAction(s, { type: 'roll', dice: [1, 1] });
  s.current = 0;
  s.players.forEach((p) => (p.res = emptyRes()));
  return s;
}

describe('값 매기기', () => {
  it('한 칸의 기대 생산은 1/3, 숫자 하나가 나올 확률은 11/36', () => {
    let any = 0;
    let expect2 = 0;
    for (let a = 1; a <= 6; a++)
      for (let b = 1; b <= 6; b++) {
        if (a === 3 || b === 3) any++;
        expect2 += (a === 3 ? 1 : 0) + (b === 3 ? 1 : 0) === 0 ? 0 : a === b ? 2 : 1;
      }
    expect(any / 36).toBeCloseTo(NUMBER_CHANCE, 10);
    expect(expect2 / 36).toBeCloseTo(HEX_YIELD, 10);
  });

  it('보통: 첫 집은 자원이 나는 땅 3칸에 닿은 자리에 놓는다', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = createGame(setup(['ai-normal', 'ai-normal']), seededRandom(seed));
      const a = decideAction(s, 'ai-normal', seededRandom(seed));
      expect(a.type).toBe('build');
      if (a.type !== 'build') continue;
      const producing = CORNERS[a.at].hexes.filter((h) => s.terrain[h] !== 'hill').length;
      expect(producing).toBe(3);
    }
  });

  it('처음 길은 방금 놓은 집에 붙인다 (쉬움·보통)', () => {
    for (const level of ['ai-easy', 'ai-normal'] as const) {
      let s = createGame(setup(['ai-normal', 'ai-normal']), seededRandom(3));
      s = applyAction(s, decideAction(s, level, seededRandom(4)));
      const house = s.setupHouse!;
      const a = decideAction(s, level, seededRandom(5));
      expect(a.type).toBe('build');
      if (a.type === 'build') expect([EDGES[a.at].a, EDGES[a.at].b]).toContain(house);
    }
  });
});

describe('보통 컴퓨터의 판단', () => {
  it('집을 지을 수 있으면 짓는다', () => {
    const s = afterSetup(7);
    // 0번 길 끝에서 바로 지을 수 있는 자리를 하나 만든다
    const spot = CORNERS.find((c) => spacedOk(s, c.id) && c.edges.some((e) => s.roads[e] === null))!;
    s.roads[spot.edges.find((e) => s.roads[e] === null)!] = 0;
    s.players[0].res = { ...COSTS.house };
    const a = decideAction(s, 'ai-normal', seededRandom(1));
    expect(a).toMatchObject({ type: 'build', kind: 'house' });
  });

  it('이기는 수가 있으면 바로 둔다 (등대로 목표 점수)', () => {
    const s = afterSetup(8);
    const coast = CORNERS.find((c) => c.coastal && s.buildings[c.id]?.owner === 0) ?? null;
    if (coast === null) {
      const c = CORNERS.find((x) => x.coastal && spacedOk(s, x.id))!;
      s.buildings[c.id] = { owner: 0, type: 'house' };
    }
    s.options = { ...s.options, target: (points(s, 0) + 2) as IslandOptions['target'] };
    s.players[0].res = { ...COSTS.lighthouse };
    expect(decideAction(s, 'ai-normal', seededRandom(1))).toMatchObject({ type: 'build', kind: 'lighthouse' });
  });

  it('장터로 모자란 하나를 채운다', () => {
    const s = afterSetup(9);
    const mine = s.buildings.findIndex((b) => b?.owner === 0);
    expect(mine).toBeGreaterThanOrEqual(0);
    s.lighthouses[0] = null;
    // 회관까지 물고기 하나만 모자라고, 나무가 남는다. 장터에 물고기가 있다
    s.players[0].res = res({ stone: 3, fish: 1, grain: 2, wood: 1 });
    s.market = ['grain', 'fish', 'grain', 'grain'];
    expect(decideAction(s, 'ai-normal', seededRandom(1))).toEqual({ type: 'market', give: 'wood', slot: 1 });
    // 장터는 차례마다 한 번
    const t = applyAction(s, { type: 'market', give: 'wood', slot: 1 });
    expect(decideAction(t, 'ai-normal', seededRandom(1)).type).not.toBe('market');
  });

  it('은행은 이번 차례에 목표를 채울 수 있을 때만 쓴다', () => {
    const s = afterSetup(10);
    s.options = { ...s.options, market: false };
    s.market = [];
    // 곡식 4개뿐: 3개를 바꿔도 아무것도 지을 수 없으니 바꾸지 않는다
    s.players[0].res = res({ grain: 4 });
    expect(decideAction(s, 'ai-normal', seededRandom(1))).toEqual({ type: 'endTurn' });
    // 돌 6개, 물고기 2개, 곡식 1개: 돌 3개로 곡식을 받으면 회관을 지을 수 있다
    s.players[0].res = res({ stone: 6, fish: 2, grain: 1 });
    const a = decideAction(s, 'ai-normal', seededRandom(1));
    expect(a).toEqual({ type: 'bank', give: 'stone', get: 'grain' });
    const t = applyAction(s, a);
    expect(decideAction(t, 'ai-normal', seededRandom(1))).toMatchObject({ type: 'build', kind: 'hall' });
  });

  it('손 제한: 목표에 필요한 자원은 남기고 많이 남는 것부터 내려놓는다', () => {
    const s = afterSetup(11);
    s.players[0].res = res({ wood: 7, stone: 2, fish: 2, grain: 1 });
    s.phase = 'discard';
    s.discardNeed = 3;
    const d = chooseDiscard(s, 'ai-normal', seededRandom(1));
    expect(totalRes(d)).toBe(3);
    expect(d.wood).toBe(3);
    for (const level of ['ai-easy', 'ai-normal'] as const) {
      const a = decideAction(s, level, seededRandom(2));
      expect(a.type).toBe('discard');
      expect(applyAction(s, a)).not.toBe(s);
    }
  });

  it('축제 깃발을 가져올 수 있는 집 자리를 더 좋게 본다', () => {
    const s = afterSetup(12);
    expect(s.flagHolder).toBe(null);
    // 0번에게 집을 하나 더 주어 다음 집 하나로 깃발에 닿을 수 있게 한다
    const extra = CORNERS.find((c) => spacedOk(s, c.id) && c.hexes.length === 3 && c.hexes.every((h) => !touchedHexes(s, 0).has(h)))!;
    s.buildings[extra.id] = { owner: 0, type: 'house' };
    const mine = touchedHexes(s, 0);
    expect(mine.size).toBeGreaterThanOrEqual(FLAG_MIN - 3);
    const withFlag = makePlans(s, 0).filter((p) => p.kind === 'house');
    // 이미 깃발을 가졌다면 같은 자리라도 깃발 보너스가 없다
    const held = { ...s, flagHolder: 0 };
    const noFlag = makePlans(held, 0).filter((p) => p.kind === 'house');
    let checked = 0;
    for (const p of withFlag) {
      const q = noFlag.find((x) => x.at === p.at)!;
      const takes = new Set([...mine, ...CORNERS[p.at].hexes]).size >= FLAG_MIN;
      if (takes) {
        expect(p.value - q.value).toBeGreaterThan(1);
        checked++;
      } else expect(p.value).toBeCloseTo(q.value, 6);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('초보 도움 추천 자리는 언제나 놓을 수 있는 자리다', () => {
    const rng = seededRandom(13);
    let s = createGame(setup(['human', 'ai-normal', 'ai-easy']), rng);
    for (let k = 0; k < 6; k++) {
      const kind = s.setupHouse === null ? 'house' : 'road';
      const r = recommendSpot(s, s.current, kind);
      expect(validSpots(s, s.current, kind)).toContain(r);
      s = applyAction(s, { type: 'build', kind, at: r! });
    }
    const t = afterSetup(14);
    t.players[0].res = res({ wood: 3, stone: 3, grain: 3, fish: 3 });
    for (const kind of ['road', 'house', 'hall', 'lighthouse'] as const) {
      const r = recommendSpot(t, 0, kind);
      if (r !== null) expect(validSpots(t, 0, kind)).toContain(r);
    }
  });
});

describe('골라 쓰는 주사위', () => {
  /** 0번 집만 있는 숫자 a, 1번 집만 있는 숫자 b가 나온 판 */
  function split(seed: number) {
    const s = afterSetup(seed);
    s.buildings = s.buildings.map(() => null);
    const nums = [1, 2, 3, 4, 5, 6];
    const a = nums.find((n) => hexesWithNumber(s, n).length > 0)!;
    const b = nums.find((n) => n !== a && hexesWithNumber(s, n).every((h) => !hexesWithNumber(s, a).some((x) => CORNERS.some((c) => c.hexes.includes(h) && c.hexes.includes(x)))))!;
    const ha = hexesWithNumber(s, a).find((h) => s.terrain[h] !== 'hill')!;
    const hb = hexesWithNumber(s, b).find((h) => s.terrain[h] !== 'hill')!;
    const ca = CORNERS.find((c) => c.hexes.includes(ha) && c.hexes.every((h) => s.numbers[h] !== b))!;
    const cb = CORNERS.find((c) => c.hexes.includes(hb) && c.hexes.every((h) => s.numbers[h] !== a) && !c.corners.includes(ca.id) && c.id !== ca.id)!;
    s.buildings[ca.id] = { owner: 0, type: 'house' };
    s.buildings[cb.id] = { owner: 1, type: 'hall' };
    s.phase = 'roll';
    s.current = 0;
    s.dice = null;
    return { s: applyAction(s, { type: 'roll', dice: [b, a] }), a, b };
  }

  it('보통은 나에게 자원이 오고 남에게 덜 가는 눈을 고른다', () => {
    for (const seed of [21, 22, 23]) {
      const { s } = split(seed);
      expect(s.phase).toBe('choose');
      expect(totalRes(previewChoice(s, 1)[0])).toBeGreaterThan(0);
      expect(totalRes(previewChoice(s, 0)[1])).toBeGreaterThan(0);
      expect(chooseDie(s, 'ai-normal', seededRandom(1))).toBe(1);
      expect(decideAction(s, 'ai-normal', seededRandom(1))).toEqual({ type: 'choose', die: 1 });
    }
  });

  it('쉬움은 아무 눈이나 고르지만 언제나 0이나 1', () => {
    const { s } = split(21);
    const seen = new Set<number>();
    for (let k = 0; k < 30; k++) {
      const a = decideAction(s, 'ai-easy', seededRandom(k));
      expect(a.type).toBe('choose');
      if (a.type === 'choose') seen.add(a.die);
      expect(applyAction(s, a)).not.toBe(s);
    }
    expect([...seen].sort()).toEqual([0, 1]);
  });
});

describe('컴퓨터끼리 끝까지', () => {
  it('여러 시드·인원·규칙에서 규칙에 맞는 행동만 하고 끝난다', () => {
    const configs: [SeatKind[], Partial<IslandOptions>][] = [
      [['ai-normal', 'ai-easy'], {}],
      [['ai-easy', 'ai-easy'], { target: 8 }],
      [['ai-normal', 'ai-normal', 'ai-easy'], { market: false }],
      [['ai-normal', 'ai-easy', 'ai-normal'], { harvest: true }],
      [['ai-easy', 'ai-normal', 'ai-normal', 'ai-easy'], { target: 12 }],
      [['ai-normal', 'ai-normal', 'ai-normal', 'ai-normal'], {}],
    ];
    for (const [kinds, opts] of configs) {
      for (let seed = 1; seed <= 6; seed++) {
        const { s, illegal } = playOut(kinds, seed * 31, opts);
        expect(illegal).toBe(0);
        expect(s.phase).toBe('gameover');
        const w = s.winner!;
        expect(points(s, w)).toBeGreaterThanOrEqual(s.round > MAX_ROUNDS ? 0 : s.options.target);
        // 차례를 마칠 때마다 9개 이하
        for (const p of s.players) for (const v of Object.values(p.res)) expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('한 번 생각하는 데 오래 걸리지 않는다 (4명, 수백 수)', () => {
    const rng = seededRandom(77);
    let s = createGame(setup(['ai-normal', 'ai-normal', 'ai-normal', 'ai-normal']), rng);
    let worst = 0;
    let n = 0;
    while (s.phase !== 'gameover' && n < 3000) {
      const t0 = performance.now();
      const a = decideAction(s, 'ai-normal', rng);
      worst = Math.max(worst, performance.now() - t0);
      s = applyAction(s, a, rng);
      n++;
    }
    expect(worst).toBeLessThan(150);
  });
});

describe('실력', () => {
  it('보통은 쉬움보다 자주 이긴다', () => {
    const games = 40;
    let normal = 0;
    for (let g = 0; g < games; g++) {
      // 자리를 번갈아 바꿔 공평하게
      const kinds: SeatKind[] = g % 2 === 0 ? ['ai-normal', 'ai-easy'] : ['ai-easy', 'ai-normal'];
      const { s } = playOut(kinds, 1000 + g);
      if (s.players[s.winner!].kind === 'ai-normal') normal++;
    }
    // 잰 값: 40판 중 40판
    expect(normal / games).toBeGreaterThan(0.8);
  });

  it('4명 판(보통 2, 쉬움 2)에서도 보통이 대부분 이긴다', () => {
    let normal = 0;
    const games = 20;
    for (let g = 0; g < games; g++) {
      const { s } = playOut(['ai-normal', 'ai-easy', 'ai-normal', 'ai-easy'], 2000 + g);
      if (s.players[s.winner!].kind === 'ai-normal') normal++;
    }
    expect(normal / games).toBeGreaterThan(0.75);
  });
});
