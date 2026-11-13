import type { Dir, PlacedShip, Rng, SeaSize, ShipKind, ShipSpec } from './types';

/** 바다 크기별 함대. 8×8 바다에는 항공모함이 없다. */
export const FLEETS: Record<SeaSize, ShipSpec[]> = {
  10: [
    { id: 'carrier', name: '항공모함', length: 5 },
    { id: 'battleship', name: '전함', length: 4 },
    { id: 'cruiser', name: '순양함', length: 3 },
    { id: 'submarine', name: '잠수함', length: 3 },
    { id: 'destroyer', name: '구축함', length: 2 },
  ],
  8: [
    { id: 'battleship', name: '전함', length: 4 },
    { id: 'cruiser', name: '순양함', length: 3 },
    { id: 'submarine', name: '잠수함', length: 3 },
    { id: 'destroyer', name: '구축함', length: 2 },
  ],
};

export const SHIP_INFO: Record<ShipKind, ShipSpec> = {
  carrier: FLEETS[10][0],
  battleship: FLEETS[10][1],
  cruiser: FLEETS[10][2],
  submarine: FLEETS[10][3],
  destroyer: FLEETS[10][4],
};

export const COLUMN_LETTERS = 'ABCDEFGHIJ';

export function shipLength(id: ShipKind): number {
  return SHIP_INFO[id].length;
}

/** 칸 번호 → 좌표 이름 (예: 0 → A1, 26 → G3) */
export function cellName(cell: number, size: number): string {
  return `${COLUMN_LETTERS[cell % size]}${Math.floor(cell / size) + 1}`;
}

/** 배가 차지하는 칸 번호들 (앞에서부터). 판 밖이면 -1이 들어갈 수 있으니 inBounds를 먼저 본다. */
export function shipCells(ship: PlacedShip, size: number): number[] {
  const len = shipLength(ship.id);
  const cells: number[] = [];
  for (let k = 0; k < len; k++) {
    const x = ship.dir === 'h' ? ship.x + k : ship.x;
    const y = ship.dir === 'v' ? ship.y + k : ship.y;
    cells.push(x >= 0 && x < size && y >= 0 && y < size ? y * size + x : -1);
  }
  return cells;
}

export function inBounds(ship: PlacedShip, size: number): boolean {
  const len = shipLength(ship.id);
  if (!Number.isInteger(ship.x) || !Number.isInteger(ship.y) || ship.x < 0 || ship.y < 0) return false;
  return ship.dir === 'h' ? ship.x + len <= size && ship.y < size : ship.y + len <= size && ship.x < size;
}

/** 칸 둘레 8칸 (대각선 포함) */
export function neighbors8(cell: number, size: number): number[] {
  const x = cell % size;
  const y = Math.floor(cell / size);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) out.push(ny * size + nx);
    }
  }
  return out;
}

/** 칸 위아래양옆 4칸 */
export function neighbors4(cell: number, size: number): number[] {
  const x = cell % size;
  const y = Math.floor(cell / size);
  const out: number[] = [];
  if (y > 0) out.push(cell - size);
  if (y < size - 1) out.push(cell + size);
  if (x > 0) out.push(cell - 1);
  if (x < size - 1) out.push(cell + 1);
  return out;
}

/** 배를 놓을 수 없는 까닭: out 판 밖, overlap 겹침, touch 붙음(붙이지 않기 규칙) */
export type PlacementProblem = 'out' | 'overlap' | 'touch';

export const PROBLEM_TEXT: Record<PlacementProblem, string> = {
  out: '바다 밖으로 나가요.',
  overlap: '다른 배와 겹쳐요.',
  touch: '다른 배와 붙어 있어요. (배끼리 붙이지 않기 규칙)',
};

/**
 * ship을 others 사이에 놓을 수 있는지 본다. 놓을 수 있으면 null.
 * others에 같은 종류의 배가 있으면 그 배는 무시한다 (옮기는 중인 배).
 */
export function placementProblem(ship: PlacedShip, others: readonly PlacedShip[], size: number, noTouch: boolean): PlacementProblem | null {
  if (!inBounds(ship, size)) return 'out';
  const occupied = new Set<number>();
  for (const o of others) {
    if (o.id === ship.id || !inBounds(o, size)) continue;
    for (const c of shipCells(o, size)) occupied.add(c);
  }
  const cells = shipCells(ship, size);
  if (cells.some((c) => occupied.has(c))) return 'overlap';
  if (noTouch && cells.some((c) => neighbors8(c, size).some((n) => occupied.has(n)))) return 'touch';
  return null;
}

/** 함대 전체가 규칙에 맞는지: 정해진 배가 한 척씩 모두 있고, 판 안이고, 겹치지(붙지) 않는다. */
export function isValidFleet(fleet: readonly PlacedShip[], size: SeaSize, noTouch: boolean): boolean {
  if (!Array.isArray(fleet)) return false;
  const specs = FLEETS[size];
  if (fleet.length !== specs.length) return false;
  const ids = new Set(fleet.map((s) => s?.id));
  if (ids.size !== specs.length || !specs.every((s) => ids.has(s.id))) return false;
  for (let i = 0; i < fleet.length; i++) {
    const s = fleet[i];
    if (s.dir !== 'h' && s.dir !== 'v') return false;
    if (placementProblem(s, fleet.slice(0, i), size, noTouch) !== null) return false;
  }
  return true;
}

/** 붙이지 않기 규칙에서 다른 배를 놓을 수 없는 칸 (배 칸 + 둘레) */
export function blockedCells(fleet: readonly PlacedShip[], size: number, noTouch: boolean, except?: ShipKind): Set<number> {
  const out = new Set<number>();
  for (const s of fleet) {
    if (s.id === except || !inBounds(s, size)) continue;
    for (const c of shipCells(s, size)) {
      out.add(c);
      if (noTouch) for (const n of neighbors8(c, size)) out.add(n);
    }
  }
  return out;
}

/** 배의 앞 칸이 (x, y)이고 방향이 dir일 때 판 안으로 들어오게 앞 칸을 당긴다. */
export function clampShip(id: ShipKind, x: number, y: number, dir: Dir, size: number): PlacedShip {
  const len = shipLength(id);
  const maxX = dir === 'h' ? size - len : size - 1;
  const maxY = dir === 'v' ? size - len : size - 1;
  return { id, dir, x: Math.max(0, Math.min(maxX, x)), y: Math.max(0, Math.min(maxY, y)) };
}

/** 한 척을 무작위로 놓는다. 놓을 자리가 없으면 null */
function placeOne(spec: ShipSpec, fleet: PlacedShip[], size: SeaSize, noTouch: boolean, rng: Rng): PlacedShip | null {
  const options: PlacedShip[] = [];
  for (const dir of ['h', 'v'] as Dir[]) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const ship = { id: spec.id, x, y, dir };
        if (placementProblem(ship, fleet, size, noTouch) === null) options.push(ship);
      }
    }
  }
  if (options.length === 0) return null;
  return options[Math.min(options.length - 1, Math.floor(rng() * options.length))];
}

/**
 * 무작위로 함대를 놓는다. 이미 놓인 배(keep)는 그대로 두고 나머지만 채운다.
 * 큰 배부터 놓고, 막히면 처음부터 다시 한다. (keep 때문에 끝내 안 되면 keep도 버린다)
 */
export function randomFleet(size: SeaSize, noTouch: boolean, rng: Rng, keep: readonly PlacedShip[] = []): PlacedShip[] {
  const specs = [...FLEETS[size]].sort((a, b) => b.length - a.length);
  for (let attempt = 0; attempt < 200; attempt++) {
    const base = attempt < 100 ? keep.filter((s) => specs.some((p) => p.id === s.id)) : [];
    const fleet: PlacedShip[] = [...base];
    let ok = true;
    for (const spec of specs) {
      if (fleet.some((s) => s.id === spec.id)) continue;
      const ship = placeOne(spec, fleet, size, noTouch, rng);
      if (!ship) {
        ok = false;
        break;
      }
      fleet.push(ship);
    }
    if (ok) return FLEETS[size].map((spec) => fleet.find((s) => s.id === spec.id)!);
  }
  throw new Error('배를 놓을 자리가 없어요.');
}
