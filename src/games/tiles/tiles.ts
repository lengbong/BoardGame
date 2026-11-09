import type { ShapeKind } from '../../components/shapes';
import type { Rng, Tile, TileColor } from './types';

export const TILE_COLORS: TileColor[] = ['red', 'blue', 'green', 'black'];

export const TILE_COLOR_INFO: Record<TileColor, { name: string; main: string; shape: ShapeKind }> = {
  red: { name: '빨강', main: '#d23a2f', shape: 'circle' },
  blue: { name: '파랑', main: '#2459c4', shape: 'diamond' },
  green: { name: '초록', main: '#1f8a4c', shape: 'leaf' },
  black: { name: '검정', main: '#2a2a33', shape: 'star' },
};

export const RACK_SIZE = 14;
export const JOKER_POINTS = 30;
export const MELD_POINTS = 30;

/** 타일 106개: 1~13 × 4색 × 2벌 + 조커 2개 */
export function createPool(): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;
  for (let copy = 0; copy < 2; copy++) {
    for (const color of TILE_COLORS) {
      for (let value = 1; value <= 13; value++) tiles.push({ id: id++, color, value, joker: false });
    }
  }
  tiles.push({ id: id++, color: null, value: 0, joker: true });
  tiles.push({ id: id++, color: null, value: 0, joker: true });
  return tiles;
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 손에 남았을 때 점수: 숫자 그대로, 조커 30 */
export function tilePoints(tile: Tile): number {
  return tile.joker ? JOKER_POINTS : tile.value;
}

export function rackPoints(rack: Tile[]): number {
  return rack.reduce((sum, t) => sum + tilePoints(t), 0);
}

export function tileLabel(tile: Tile): string {
  return tile.joker ? '조커' : `${TILE_COLOR_INFO[tile.color!].name} ${tile.value}`;
}

const colorIndex = (t: Tile) => (t.joker ? 9 : TILE_COLORS.indexOf(t.color!));

/** 색깔순 (같은 색끼리 숫자 차례로: 7 8 9) */
export function sortByColor(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => colorIndex(a) - colorIndex(b) || a.value - b.value || a.id - b.id);
}

/** 숫자순 (같은 숫자끼리: 7 7 7) */
export function sortByNumber(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => Number(a.joker) - Number(b.joker) || a.value - b.value || colorIndex(a) - colorIndex(b) || a.id - b.id);
}
