import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import type { DuelKind } from '../common/duel';
import { isValidFleet, shipCells } from './fleet';
import { DEFAULT_OPTIONS, applyAction, canFire, createGame, knowledgeFor, playerStats, sunkShips } from './rules';
import { HIT, MISS, UNKNOWN, type PlacedShip, type ShipsOptions, type ShipsState } from './types';

const ship = (id: PlacedShip['id'], x: number, y: number, dir: PlacedShip['dir'] = 'h'): PlacedShip => ({ id, x, y, dir });

/** 10×10: 0, 2, 4, 6, 8번째 줄 왼쪽에 한 척씩 */
const ROWS: PlacedShip[] = [
  ship('carrier', 0, 0),
  ship('battleship', 0, 2),
  ship('cruiser', 0, 4),
  ship('submarine', 0, 6),
  ship('destroyer', 0, 8),
];
/** 10×10: 오른쪽 세로줄 */
const COLS: PlacedShip[] = [
  ship('carrier', 9, 0, 'v'),
  ship('battleship', 7, 0, 'v'),
  ship('cruiser', 5, 0, 'v'),
  ship('submarine', 9, 7, 'v'),
  ship('destroyer', 7, 8, 'v'),
];

function setup(kinds: [DuelKind, DuelKind], options: Partial<ShipsOptions> = {}) {
  return {
    seats: [
      { kind: kinds[0], name: '' },
      { kind: kinds[1], name: '' },
    ] as [{ kind: DuelKind; name: string }, { kind: DuelKind; name: string }],
    options: { ...DEFAULT_OPTIONS, ...options },
  };
}

/** 배를 정해 둔 전투 상태 (둘 다 컴퓨터) */
function battle(options: Partial<ShipsOptions> = {}, fleets: [PlacedShip[], PlacedShip[]] = [ROWS, COLS]): ShipsState {
  const s = createGame(setup(['ai-normal', 'ai-normal'], options), seededRandom(1));
  s.players[0].fleet = fleets[0];
  s.players[1].fleet = fleets[1];
  return s;
}

function fireAll(s: ShipsState, cells: number[]): ShipsState {
  return cells.reduce((g, c) => applyAction(g, { type: 'fire', cell: c }), s);
}

describe('새 게임과 배 놓기', () => {
  it('사람 + 컴퓨터: 사람이 배를 놓는 단계로 시작하고, 컴퓨터 배는 이미 놓여 있다', () => {
    const s = createGame(setup(['human', 'ai-hard']), seededRandom(3));
    expect(s.phase).toBe('place');
    expect(s.placing).toBe(0);
    expect(s.players[0].ready).toBe(false);
    expect(s.players[1].ready).toBe(true);
    expect(isValidFleet(s.players[1].fleet, 10, false)).toBe(true);
    expect(s.players[0].name).toBe('파랑 함대');
    expect(s.players[1].marks).toHaveLength(100);
  });

  it('컴퓨터끼리는 바로 전투, 왼쪽 자리가 먼저 쏜다', () => {
    const s = createGame(setup(['ai-easy', 'ai-hard'], { size: 8, noTouch: true }), seededRandom(5));
    expect(s.phase).toBe('battle');
    expect(s.current).toBe(0);
    expect(s.players[0].marks).toHaveLength(64);
    expect(isValidFleet(s.players[0].fleet, 8, true)).toBe(true);
    expect(s.events.map((e) => e.type)).toContain('start');
  });

  it('올바르지 않은 배치나 차례가 아닌 사람의 배치는 받지 않는다', () => {
    const s = createGame(setup(['human', 'human']), seededRandom(1));
    expect(applyAction(s, { type: 'place', player: 0, fleet: ROWS.slice(0, 4) })).toBe(s);
    expect(applyAction(s, { type: 'place', player: 1, fleet: ROWS })).toBe(s);
    const overlapping = [...ROWS.slice(0, 4), ship('destroyer', 1, 0, 'v')];
    expect(applyAction(s, { type: 'place', player: 0, fleet: overlapping })).toBe(s);
    const touching = [...ROWS.slice(0, 4), ship('destroyer', 0, 7)];
    const strict = createGame(setup(['human', 'ai-easy'], { noTouch: true }), seededRandom(1));
    expect(applyAction(strict, { type: 'place', player: 0, fleet: touching })).toBe(strict);
    expect(applyAction(createGame(setup(['human', 'ai-easy']), seededRandom(1)), { type: 'place', player: 0, fleet: touching }).phase).toBe('battle');
  });

  it('사람 둘: 왼쪽 → 오른쪽 차례로 배를 놓고 전투가 시작된다', () => {
    let s = createGame(setup(['human', 'human']), seededRandom(1));
    s = applyAction(s, { type: 'place', player: 0, fleet: ROWS });
    expect(s.phase).toBe('place');
    expect(s.placing).toBe(1);
    s = applyAction(s, { type: 'place', player: 1, fleet: COLS });
    expect(s.phase).toBe('battle');
    expect(s.placing).toBeNull();
    expect(s.current).toBe(0);
    expect(s.players[1].fleet).toEqual(COLS);
  });
});

describe('쏘기', () => {
  it('빗나가면 물보라, 상대 차례가 된다', () => {
    const s = fireAll(battle(), [55]); // F6 (COLS에 없음)
    expect(s.players[0].marks[55]).toBe(MISS);
    expect(s.current).toBe(1);
    expect(s.events).toEqual([expect.objectContaining({ type: 'shot', shooter: 0, cell: 55, result: 'miss' })]);
    expect(s.log.at(-1)?.text).toBe('파랑 함대: F6 물보라 (빗나감)');
  });

  it('맞히면 명중, 한 번 더 규칙이 꺼져 있으면 상대 차례', () => {
    const s = fireAll(battle(), [9]); // J1: 항공모함
    expect(s.players[0].marks[9]).toBe(HIT);
    expect(s.events[0]).toMatchObject({ type: 'shot', result: 'hit', ship: null });
    expect(s.log.at(-1)?.text).toBe('파랑 함대: J1 명중!');
    expect(s.current).toBe(1);
  });

  it('맞히면 한 번 더: 명중이면 같은 사람이 또 쏘고, 빗나가면 넘어간다', () => {
    let s = fireAll(battle({ extraTurn: true }), [9]);
    expect(s.current).toBe(0);
    expect(s.events.map((e) => e.type)).toEqual(['shot', 'extra']);
    s = fireAll(s, [19]);
    expect(s.current).toBe(0);
    s = fireAll(s, [0]);
    expect(s.current).toBe(1);
  });

  it('배의 모든 칸을 맞히면 격침, 그 배의 칸이 공개된다', () => {
    // 왼쪽이 구축함(H9, H10)을, 오른쪽은 아무 데나 빗나가게
    const s = fireAll(battle(), [87, 10, 97]);
    const last = s.events.find((e) => e.type === 'shot')!;
    expect(last).toMatchObject({ shooter: 0, result: 'sunk', ship: 'destroyer', cells: [87, 97] });
    expect(s.log.at(-1)?.text).toBe('파랑 함대: H10 격침! 구축함을 가라앉혔어요.');
    expect(sunkShips(s, 1).map((x) => x.id)).toEqual(['destroyer']);
  });

  it('이미 쏜 칸, 판 밖, 배 놓는 중, 끝난 뒤에는 쏠 수 없다', () => {
    const s = fireAll(battle(), [55, 1]);
    expect(s.current).toBe(0);
    expect(canFire(s, 55)).toBe(false);
    expect(applyAction(s, { type: 'fire', cell: 55 })).toBe(s);
    expect(applyAction(s, { type: 'fire', cell: 100 })).toBe(s);
    expect(applyAction(s, { type: 'fire', cell: -1 })).toBe(s);
    expect(applyAction(s, { type: 'fire', cell: 2.5 })).toBe(s);
    const placing = createGame(setup(['human', 'ai-easy']), seededRandom(1));
    expect(applyAction(placing, { type: 'fire', cell: 0 })).toBe(placing);
  });

  it('상대 배를 모두 가라앉히면 이기고, 그 뒤로는 아무것도 할 수 없다', () => {
    let s = battle({ extraTurn: true });
    const targets = COLS.flatMap((x) => shipCells(x, 10));
    s = fireAll(s, targets);
    expect(s.phase).toBe('gameover');
    expect(s.winner).toBe(0);
    expect(s.events.at(-1)).toMatchObject({ type: 'win', player: 0 });
    expect(sunkShips(s, 1)).toHaveLength(5);
    expect(applyAction(s, { type: 'fire', cell: 50 })).toBe(s);
    expect(playerStats(s, 0)).toEqual({ shots: 17, hits: 17, accuracy: 100 });
  });

  it('번갈아 쏘다가 오른쪽이 이길 수도 있다 (8×8)', () => {
    const left: PlacedShip[] = [ship('battleship', 0, 0), ship('cruiser', 0, 2), ship('submarine', 0, 4), ship('destroyer', 0, 6)];
    const right: PlacedShip[] = [ship('battleship', 4, 7), ship('cruiser', 5, 0), ship('submarine', 5, 2), ship('destroyer', 6, 4)];
    let s = battle({ size: 8 }, [left, right]);
    const targets = left.flatMap((x) => shipCells(x, 8));
    // 왼쪽은 계속 빗나가는 칸(맨 아래에서 두 번째 줄)을 쏜다
    const misses = [48, 49, 50, 51, 52, 53, 54, 55, 40, 41, 42, 43];
    targets.forEach((c, i) => {
      s = applyAction(s, { type: 'fire', cell: misses[i] });
      s = applyAction(s, { type: 'fire', cell: c });
    });
    expect(s.winner).toBe(1);
    expect(playerStats(s, 0)).toEqual({ shots: 12, hits: 0, accuracy: 0 });
  });
});

describe('아는 정보', () => {
  it('쏜 사람이 아는 것: 내 쏜 결과, 가라앉은 배 칸, 남은 배 길이뿐', () => {
    const s = fireAll(battle(), [87, 0, 97, 1, 9]);
    const k = knowledgeFor(s, 0);
    expect(k.marks[87]).toBe(HIT);
    expect(k.marks[9]).toBe(HIT);
    expect(k.marks[19]).toBe(UNKNOWN);
    expect(k.sunk).toEqual([{ length: 2, cells: [87, 97] }]);
    expect(k.remaining).toEqual([5, 4, 3, 3]);
    expect(JSON.stringify(k)).not.toContain('carrier');
  });

  it('상태는 JSON으로 저장했다 불러와도 그대로 이어진다', () => {
    const s = fireAll(battle({ noTouch: false }), [87, 0, 97]);
    const copy = JSON.parse(JSON.stringify(s)) as ShipsState;
    expect(copy).toEqual(s);
    expect(applyAction(copy, { type: 'fire', cell: 5 })).toEqual(applyAction(s, { type: 'fire', cell: 5 }));
  });
});
