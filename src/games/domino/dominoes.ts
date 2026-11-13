import type { Tile } from './types';

/** 더블식스 세트: 0~6 점, 패 28개 */
export const MAX_PIP = 6;
export const SET_SIZE = 28;

/** 패 28개를 만든다. id는 0·0, 0·1 … 6·6 순서로 0~27 */
export function createSet(): Tile[] {
  const tiles: Tile[] = [];
  for (let a = 0; a <= MAX_PIP; a++) {
    for (let b = a; b <= MAX_PIP; b++) tiles.push({ id: tiles.length, a, b });
  }
  return tiles;
}

export function isDouble(tile: Tile): boolean {
  return tile.a === tile.b;
}

/** 패 하나의 점 합 */
export function tilePips(tile: Tile): number {
  return tile.a + tile.b;
}

/** 손패의 점 합 */
export function handPips(hand: readonly Tile[]): number {
  return hand.reduce((sum, t) => sum + tilePips(t), 0);
}

export function hasNumber(tile: Tile, n: number): boolean {
  return tile.a === n || tile.b === n;
}

/** 진행 기록에 쓰는 이름 (예: "3·5", "6·6") */
export function tileLabel(tile: Tile): string {
  return `${tile.a}·${tile.b}`;
}

/** 손패 정렬: 작은 숫자 → 큰 숫자 */
export function sortHand(hand: readonly Tile[]): Tile[] {
  return [...hand].sort((x, y) => x.a - y.a || x.b - y.b);
}

/** '점 색깔' 보기에서 숫자마다 쓰는 색 (상아색 패 위에서 잘 보이는 진한 색) */
export const PIP_COLORS: Record<number, string> = {
  1: '#2369c9',
  2: '#1d8a4c',
  3: '#d13b3b',
  4: '#7a4a1e',
  5: '#7b45c9',
  6: '#d97a00',
};

export const PIP_INK = '#24201c';
