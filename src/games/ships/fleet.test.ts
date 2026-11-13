import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import {
  FLEETS,
  blockedCells,
  cellName,
  clampShip,
  inBounds,
  isValidFleet,
  placementProblem,
  randomFleet,
  shipCells,
} from './fleet';
import type { PlacedShip, SeaSize } from './types';

const ship = (id: PlacedShip['id'], x: number, y: number, dir: PlacedShip['dir'] = 'h'): PlacedShip => ({ id, x, y, dir });

/** 겹치지도 붙지도 않는 10×10 함대 */
const SPREAD: PlacedShip[] = [
  ship('carrier', 0, 0),
  ship('battleship', 0, 2),
  ship('cruiser', 0, 4),
  ship('submarine', 0, 6),
  ship('destroyer', 0, 8),
];

describe('함대와 좌표', () => {
  it('10×10은 5척 17칸, 8×8은 항공모함 없이 4척 12칸', () => {
    expect(FLEETS[10].map((s) => s.length)).toEqual([5, 4, 3, 3, 2]);
    expect(FLEETS[10].reduce((a, s) => a + s.length, 0)).toBe(17);
    expect(FLEETS[8].map((s) => s.id)).not.toContain('carrier');
    expect(FLEETS[8].reduce((a, s) => a + s.length, 0)).toBe(12);
  });

  it('좌표 이름은 열 글자 + 행 숫자', () => {
    expect(cellName(0, 10)).toBe('A1');
    expect(cellName(62, 10)).toBe('C7');
    expect(cellName(99, 10)).toBe('J10');
    expect(cellName(63, 8)).toBe('H8');
  });

  it('배가 차지하는 칸: 가로는 오른쪽으로, 세로는 아래로', () => {
    expect(shipCells(ship('cruiser', 2, 3), 10)).toEqual([32, 33, 34]);
    expect(shipCells(ship('cruiser', 2, 3, 'v'), 10)).toEqual([32, 42, 52]);
    expect(shipCells(ship('destroyer', 7, 7, 'v'), 8)).toEqual([63, -1]);
  });
});

describe('배 놓기 검사', () => {
  it('바다 밖으로 나가면 안 된다', () => {
    expect(inBounds(ship('carrier', 5, 0), 10)).toBe(true);
    expect(inBounds(ship('carrier', 6, 0), 10)).toBe(false);
    expect(inBounds(ship('battleship', 0, 7, 'v'), 10)).toBe(false);
    expect(inBounds(ship('battleship', 0, 6, 'v'), 10)).toBe(true);
    expect(inBounds(ship('destroyer', -1, 0), 10)).toBe(false);
    expect(placementProblem(ship('battleship', 5, 0), [], 8, false)).toBe('out');
    expect(placementProblem(ship('battleship', 4, 0), [], 8, false)).toBeNull();
  });

  it('다른 배와 겹치면 안 된다 (옮기는 같은 배는 무시)', () => {
    const others = [ship('carrier', 2, 2)];
    expect(placementProblem(ship('destroyer', 4, 1, 'v'), others, 10, false)).toBe('overlap');
    expect(placementProblem(ship('destroyer', 4, 0, 'v'), others, 10, false)).toBeNull();
    expect(placementProblem(ship('carrier', 3, 2), others, 10, false)).toBeNull();
  });

  it('붙이지 않기 규칙: 옆·대각선으로 붙으면 안 되고, 규칙이 꺼져 있으면 괜찮다', () => {
    const others = [ship('cruiser', 3, 3)];
    const side = ship('destroyer', 3, 4); // 바로 아래 줄
    const diagonal = ship('destroyer', 6, 4); // 오른쪽 아래 대각선
    const apart = ship('destroyer', 3, 5);
    expect(placementProblem(side, others, 10, false)).toBeNull();
    expect(placementProblem(side, others, 10, true)).toBe('touch');
    expect(placementProblem(diagonal, others, 10, false)).toBeNull();
    expect(placementProblem(diagonal, others, 10, true)).toBe('touch');
    expect(placementProblem(apart, others, 10, true)).toBeNull();
  });

  it('함대 전체 검사: 모든 배가 한 척씩, 판 안, 겹치지 않게', () => {
    expect(isValidFleet(SPREAD, 10, true)).toBe(true);
    expect(isValidFleet(SPREAD.slice(0, 4), 10, false)).toBe(false);
    expect(isValidFleet([...SPREAD.slice(0, 4), ship('cruiser', 5, 8)], 10, false)).toBe(false);
    expect(isValidFleet([...SPREAD.slice(0, 4), ship('destroyer', 9, 8)], 10, false)).toBe(false);
    expect(isValidFleet([...SPREAD.slice(0, 4), ship('destroyer', 1, 0, 'v')], 10, false)).toBe(false);
    const touching = [...SPREAD.slice(0, 4), ship('destroyer', 0, 7)];
    expect(isValidFleet(touching, 10, false)).toBe(true);
    expect(isValidFleet(touching, 10, true)).toBe(false);
    // 8×8 바다에 항공모함은 없다
    expect(isValidFleet(SPREAD.slice(0, 4), 8, false)).toBe(false);
    expect(isValidFleet(SPREAD.slice(1).map((s) => ({ ...s, y: s.y - 2 })), 8, true)).toBe(true);
  });

  it('놓을 수 없는 칸과 판 안으로 당기기', () => {
    const blocked = blockedCells([ship('destroyer', 0, 0)], 10, true);
    expect([...blocked].sort((a, b) => a - b)).toEqual([0, 1, 2, 10, 11, 12]);
    expect(blockedCells([ship('destroyer', 0, 0)], 10, false).size).toBe(2);
    expect(clampShip('carrier', 8, 9, 'h', 10)).toEqual({ id: 'carrier', x: 5, y: 9, dir: 'h' });
    expect(clampShip('carrier', 8, 9, 'v', 10)).toEqual({ id: 'carrier', x: 8, y: 5, dir: 'v' });
  });
});

describe('무작위 배치', () => {
  const cases: [SeaSize, boolean][] = [
    [10, false],
    [10, true],
    [8, false],
    [8, true],
  ];
  for (const [size, noTouch] of cases) {
    it(`${size}×${size}${noTouch ? ' 붙이지 않기' : ''}: 여러 시드에서 항상 올바르다`, () => {
      for (let seed = 1; seed <= 300; seed++) {
        const fleet = randomFleet(size, noTouch, seededRandom(seed));
        expect(isValidFleet(fleet, size, noTouch)).toBe(true);
      }
    });
  }

  it('같은 시드면 같은 배치, 이미 놓은 배는 그대로 둔다', () => {
    expect(randomFleet(10, false, seededRandom(7))).toEqual(randomFleet(10, false, seededRandom(7)));
    const keep = [ship('carrier', 0, 9)];
    for (let seed = 1; seed <= 50; seed++) {
      const fleet = randomFleet(10, true, seededRandom(seed), keep);
      expect(fleet.find((s) => s.id === 'carrier')).toEqual(keep[0]);
      expect(isValidFleet(fleet, 10, true)).toBe(true);
    }
  });
});
