import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import type { DuelAiLevel, DuelKind } from '../common/duel';
import { decideAction, decideShot, densityMap } from './ai';
import { isValidFleet, placementProblem, shipCells } from './fleet';
import { DEFAULT_OPTIONS, applyAction, canFire, createGame, knowledgeFor, sunkShips } from './rules';
import { HIT, MISS, UNKNOWN, type Knowledge, type Mark, type PlacedShip, type SeaSize, type ShipsOptions, type ShipsState } from './types';

const LEVELS: DuelAiLevel[] = ['ai-easy', 'ai-normal', 'ai-hard'];

function setup(kinds: [DuelKind, DuelKind], options: Partial<ShipsOptions> = {}) {
  return {
    seats: [
      { kind: kinds[0], name: '' },
      { kind: kinds[1], name: '' },
    ] as [{ kind: DuelKind; name: string }, { kind: DuelKind; name: string }],
    options: { ...DEFAULT_OPTIONS, ...options },
  };
}

/** 직접 만든 아는 정보. marks에 적은 칸 말고는 모두 아직 안 쏜 칸 */
function knowledge(opts: {
  size?: number;
  noTouch?: boolean;
  miss?: number[];
  hit?: number[];
  sunk?: number[][];
  remaining?: number[];
  allMissExcept?: number[];
}): Knowledge {
  const size = opts.size ?? 10;
  const marks = new Array<Mark>(size * size).fill(opts.allMissExcept ? MISS : UNKNOWN);
  for (const c of opts.allMissExcept ?? []) marks[c] = UNKNOWN;
  for (const c of opts.miss ?? []) marks[c] = MISS;
  for (const c of opts.hit ?? []) marks[c] = HIT;
  for (const ship of opts.sunk ?? []) for (const c of ship) marks[c] = HIT;
  return {
    size,
    noTouch: opts.noTouch ?? false,
    marks,
    sunk: (opts.sunk ?? []).map((cells) => ({ length: cells.length, cells })),
    remaining: opts.remaining ?? [5, 4, 3, 3, 2],
  };
}

function choices(k: Knowledge, level: DuelAiLevel, seeds = 40): Set<number> {
  const out = new Set<number>();
  for (let seed = 1; seed <= seeds; seed++) out.add(decideShot(k, level, seededRandom(seed)));
  return out;
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}

describe('컴퓨터: 기본', () => {
  it('어느 수준이든 아직 안 쏜 칸만 고른다 (남은 칸이 하나면 그 칸)', () => {
    const k = knowledge({ allMissExcept: [37], remaining: [2] });
    for (const level of LEVELS) expect(choices(k, level, 10)).toEqual(new Set([37]));
  });

  it('아는 정보를 고치지 않는다 (얼려 둔 정보로도 동작)', () => {
    const k = deepFreeze(knowledge({ miss: [0, 11, 22], hit: [55], sunk: [[90, 91]], remaining: [5, 4, 3, 3], noTouch: true }));
    for (const level of LEVELS) expect(() => decideShot(k, level, seededRandom(1))).not.toThrow();
  });

  it('쉬움은 아무 칸이나 쏜다 (여러 시드에서 고르게 퍼진다)', () => {
    const picks = choices(knowledge({}), 'ai-easy', 60);
    expect(picks.size).toBeGreaterThan(40);
  });
});

describe('컴퓨터: 보통 (찾기/노리기)', () => {
  it('한 칸을 맞히면 위아래양옆을 노린다', () => {
    const picks = choices(knowledge({ hit: [55] }), 'ai-normal');
    for (const c of picks) expect([45, 54, 56, 65]).toContain(c);
    expect(picks.size).toBeGreaterThan(1);
  });

  it('두 칸이 이어지면 그 줄을 따라가고, 한쪽 끝이 막히면 다른 끝을 쏜다', () => {
    const line = choices(knowledge({ hit: [42, 43] }), 'ai-normal');
    expect([...line].sort()).toEqual([41, 44]);
    expect(choices(knowledge({ hit: [42, 43], miss: [41] }), 'ai-normal')).toEqual(new Set([44]));
    // 세로 줄 C5-C6-C7, 위가 판 끝이 아니어도 막혀 있으면 아래로
    expect(choices(knowledge({ hit: [42, 52, 62], miss: [32] }), 'ai-normal')).toEqual(new Set([72]));
  });

  it('줄 양 끝이 모두 막히면 (나란히 붙은 배) 맞힌 칸 둘레를 쏜다', () => {
    const picks = choices(knowledge({ hit: [42, 43], miss: [41, 44] }), 'ai-normal');
    for (const c of picks) expect([32, 33, 52, 53]).toContain(c);
  });

  it('격침하고 남은 명중 칸이 없으면 다시 바둑판 무늬로 찾는다', () => {
    const k = knowledge({ sunk: [[42, 43]], miss: [41, 44], remaining: [5, 4, 3, 3] });
    for (const c of choices(k, 'ai-normal')) expect(((c % 10) + Math.floor(c / 10)) % 2).toBe(0);
  });

  it('남은 가장 작은 배도 못 들어가는 칸은 건너뛴다', () => {
    // 남은 배는 3칸짜리 하나. A1은 혼자 떨어진 칸, A6~C6은 3칸 줄
    const k = knowledge({ allMissExcept: [0, 50, 51, 52], remaining: [3] });
    expect(choices(k, 'ai-normal')).toEqual(new Set([51]));
  });

  it('붙이지 않기 규칙이면 가라앉은 배 둘레는 쏘지 않는다', () => {
    const k = knowledge({ noTouch: true, sunk: [[0, 1]], remaining: [5, 4, 3, 3] });
    for (const c of choices(k, 'ai-normal', 80)) expect([2, 10, 11, 12]).not.toContain(c);
  });
});

describe('컴퓨터: 어려움 (확률 지도)', () => {
  it('빈 바다에서는 배가 가장 많이 지나갈 수 있는 가운데를 쏜다', () => {
    const picks = choices(knowledge({}), 'ai-hard');
    for (const c of picks) expect([44, 45, 54, 55]).toContain(c);
  });

  it('맞힌 칸 옆을 노리고, 이어진 줄은 따라간다', () => {
    for (const c of choices(knowledge({ hit: [55] }), 'ai-hard')) expect([45, 54, 56, 65]).toContain(c);
    for (const c of choices(knowledge({ hit: [42, 43] }), 'ai-hard')) expect([41, 44]).toContain(c);
    expect(choices(knowledge({ hit: [42, 43], miss: [44] }), 'ai-hard')).toEqual(new Set([41]));
  });

  it('남은 배가 들어갈 수 없는 칸은 확률이 0이라 쏘지 않는다', () => {
    // 남은 배는 2칸짜리 하나. 외딴 칸 A1, F6과 이어진 두 칸 H8·I8
    const k = knowledge({ allMissExcept: [0, 55, 77, 78], remaining: [2] });
    expect(densityMap(k).hunt[0]).toBe(0);
    expect(densityMap(k).hunt[55]).toBe(0);
    expect(choices(k, 'ai-hard')).toEqual(new Set([77, 78]));
  });

  it('붙이지 않기 규칙: 가라앉은 배 둘레와 명중 칸 대각선은 쏘지 않고, 줄 방향을 알아챈다', () => {
    const k1 = knowledge({ noTouch: true, sunk: [[0, 1]], remaining: [5, 4, 3, 3] });
    const map = densityMap(k1);
    for (const c of [2, 10, 11, 12]) expect(map.hunt[c]).toBe(0);
    const k2 = knowledge({ noTouch: true, hit: [55], remaining: [5, 4, 3, 3, 2] });
    for (const c of choices(k2, 'ai-hard')) expect([45, 54, 56, 65]).toContain(c);
    for (const c of [44, 46, 64, 66]) expect(densityMap(k2).target[c]).toBe(0);
    // 이어진 두 칸이면 같은 배라서 위아래(C4, D4, C6, D6)는 비어 있다
    const k3 = knowledge({ noTouch: true, hit: [42, 43], miss: [44] });
    for (const c of [32, 33, 52, 53]) expect(densityMap(k3).target[c]).toBe(0);
    expect(choices(k3, 'ai-hard')).toEqual(new Set([41]));
  });

  it('규칙이 꺼져 있으면 나란히 붙은 배일 수도 있어서 위아래도 후보가 된다', () => {
    const k = knowledge({ noTouch: false, hit: [42, 43], miss: [41, 44] });
    const picks = choices(k, 'ai-hard');
    for (const c of picks) expect([32, 33, 52, 53]).toContain(c);
  });
});

/** 맞힌 적 없는 배를 쏜 적 없는 다른 자리로 옮긴다. 쏜 사람이 아는 정보는 그대로다. */
function relocateHidden(state: ShipsState, owner: 0 | 1, seed: number): { state: ShipsState; moved: number } {
  const s = structuredClone(state);
  const size = s.options.size;
  const marks = s.players[1 - owner].marks;
  const rng = seededRandom(seed);
  let moved = 0;
  const fleet = s.players[owner].fleet;
  fleet.forEach((ship, i) => {
    if (shipCells(ship, size).some((c) => marks[c] !== UNKNOWN)) return;
    for (let t = 0; t < 400; t++) {
      const cand: PlacedShip = { id: ship.id, x: Math.floor(rng() * size), y: Math.floor(rng() * size), dir: rng() < 0.5 ? 'h' : 'v' };
      if (cand.x === ship.x && cand.y === ship.y && cand.dir === ship.dir) continue;
      if (placementProblem(cand, fleet, size, s.options.noTouch) !== null) continue;
      if (shipCells(cand, size).some((c) => marks[c] !== UNKNOWN)) continue;
      fleet[i] = cand;
      moved++;
      return;
    }
  });
  expect(isValidFleet(fleet, size, s.options.noTouch)).toBe(true);
  return { state: s, moved };
}

describe('컴퓨터는 숨긴 정보를 보지 않는다', () => {
  for (const noTouch of [false, true]) {
    it(`상대 배 위치가 달라도 아는 정보가 같으면 똑같이 쏜다${noTouch ? ' (붙이지 않기)' : ''}`, () => {
      let s = createGame(setup(['ai-hard', 'ai-normal'], { noTouch }), seededRandom(11));
      let checked = 0;
      for (let step = 0; step < 70 && s.phase === 'battle'; step++) {
        if (step % 7 === 3 && s.current === 0) {
          const alt = relocateHidden(s, 1, step);
          if (alt.moved > 0) {
            expect(knowledgeFor(alt.state, 0)).toEqual(knowledgeFor(s, 0));
            for (const level of LEVELS) {
              for (let seed = 1; seed <= 8; seed++) {
                expect(decideAction(alt.state, level, seededRandom(seed))).toEqual(decideAction(s, level, seededRandom(seed)));
              }
            }
            checked++;
          }
        }
        s = applyAction(s, decideAction(s, s.current === 0 ? 'ai-hard' : 'ai-normal', seededRandom(step * 31 + 7)));
      }
      expect(checked).toBeGreaterThan(2);
    });
  }
});

function playOut(levels: [DuelAiLevel, DuelAiLevel], seed: number, options: Partial<ShipsOptions>): ShipsState {
  const rng = seededRandom(seed);
  let s = createGame(setup(levels, options), rng);
  const size = s.options.size;
  for (let guard = 0; guard < size * size * 2 + 5 && s.phase === 'battle'; guard++) {
    const action = decideAction(s, levels[s.current], rng);
    expect(action.type === 'fire' && canFire(s, action.cell)).toBe(true);
    s = applyAction(s, action);
  }
  return s;
}

describe('컴퓨터끼리 끝까지', () => {
  const pairs: [DuelAiLevel, DuelAiLevel][] = [
    ['ai-easy', 'ai-easy'],
    ['ai-normal', 'ai-easy'],
    ['ai-easy', 'ai-hard'],
    ['ai-hard', 'ai-normal'],
    ['ai-hard', 'ai-hard'],
  ];
  const variants: Partial<ShipsOptions>[] = [{}, { size: 8, noTouch: true }, { extraTurn: true, noTouch: true }, { size: 8, extraTurn: true }];
  for (const pair of pairs) {
    it(`${pair[0]} 대 ${pair[1]}: 여러 시드·규칙에서 같은 칸을 두 번 쏘지 않고 끝난다`, () => {
      for (const [i, options] of variants.entries()) {
        for (let seed = 1; seed <= 3; seed++) {
          const s = playOut(pair, seed * 100 + i, options);
          expect(s.phase).toBe('gameover');
          const winner = s.winner!;
          const loser = winner === 0 ? 1 : 0;
          expect(sunkShips(s, loser)).toHaveLength(s.players[loser].fleet.length);
          for (const p of s.players) expect(new Set(p.history).size).toBe(p.history.length);
        }
      }
    });
  }

  it('어려울수록 더 적게 쏘고 끝낸다 (혼자 쏘기 평균)', () => {
    const solo = (level: DuelAiLevel, seed: number, size: SeaSize = 10) => {
      const rng = seededRandom(seed);
      let s = createGame(setup(['ai-normal', 'ai-normal'], { size }), rng);
      while (s.phase === 'battle') {
        s = applyAction(s, decideAction(s, level, rng));
        s.current = 0; // 오른쪽은 쏘지 않는다
      }
      return s.players[0].history.length;
    };
    const avg = (level: DuelAiLevel) => {
      let sum = 0;
      for (let seed = 1; seed <= 24; seed++) sum += solo(level, seed);
      return sum / 24;
    };
    const easy = avg('ai-easy');
    const normal = avg('ai-normal');
    const hard = avg('ai-hard');
    expect(normal).toBeLessThan(easy - 15);
    expect(hard).toBeLessThan(normal);
    expect(hard).toBeLessThan(62);
  });
});
