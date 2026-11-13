import { CELLS, isStore, ownerOf } from './rules';
import type { Side } from './types';

/**
 * 판 그림의 좌표 (SVG viewBox 0 0 1000 440).
 * bottom 편의 구멍은 아래 줄 왼쪽→오른쪽, 그 편 창고는 오른쪽 끝.
 * 다른 편 구멍은 위 줄 오른쪽→왼쪽, 그 편 창고는 왼쪽 끝. → 씨앗은 시계 반대 방향으로 돈다.
 */
export const VIEW_W = 1000;
export const VIEW_H = 440;
export const PIT_R = 48;
export const STORE_RX = 56;
export const STORE_RY = 158;
export const SEED_R = 9.5;
export const ROW_TOP = 128;
export const ROW_BOTTOM = 312;
export const STORE_Y = 220;
export const STORE_X: [number, number] = [100, 900];
export const COLS = [222, 333.2, 444.4, 555.6, 666.8, 778];

export interface Point {
  x: number;
  y: number;
}

export function cellCenter(index: number, bottom: Side): Point {
  const side = ownerOf(index);
  if (isStore(index)) return { x: side === bottom ? STORE_X[1] : STORE_X[0], y: STORE_Y };
  const k = index % 7;
  return side === bottom ? { x: COLS[k], y: ROW_BOTTOM } : { x: COLS[5 - k], y: ROW_TOP };
}

/** 화면 위쪽 줄에 있는 칸인지 */
export function isTopRow(index: number, bottom: Side): boolean {
  return !isStore(index) && ownerOf(index) !== bottom;
}

/** 0 이상 1 미만의 고정된 의사 난수 (같은 입력이면 항상 같은 값) */
export function hash01(a: number, b: number, c = 0): number {
  let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35) ^ Math.imul(c + 0x1234, 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const GOLDEN = 2.399963229728653;
const PIT_LAYER = 11;
const STORE_LAYER = 30;

export interface SeedSpot {
  x: number;
  y: number;
  /** 씨앗 모양 기울기 (도) */
  rot: number;
  /** 몇 번째 층인지 (0부터). 층이 높을수록 위에 그린다. */
  layer: number;
}

/**
 * 칸 안에서 slot번째 씨앗의 자리 (칸 가운데 기준). 해바라기 씨처럼 가운데부터 바깥으로 채우고,
 * 한 층이 차면 조금 위로, 조금 좁게 다음 층을 쌓아 더미처럼 보이게 한다. 같은 칸·같은 순서면 항상 같은 자리.
 */
export function seedSpot(index: number, slot: number): SeedSpot {
  const store = isStore(index);
  const per = store ? STORE_LAYER : PIT_LAYER;
  const layer = Math.floor(slot / per);
  const k = slot % per;
  const spin = index * 0.97 + layer * 1.31;
  const angle = k * GOLDEN + spin;
  const jx = (hash01(index, slot, 1) - 0.5) * 3.6;
  const jy = (hash01(index, slot, 2) - 0.5) * 3.6;
  const rot = hash01(index, slot, 3) * 180;
  const shrink = Math.max(0.35, 1 - layer * 0.22);
  if (store) {
    const r = Math.sqrt((k + 0.5) / per) * shrink;
    return { x: Math.cos(angle) * r * 36 + jx, y: Math.sin(angle) * r * 128 + jy - layer * 5, rot, layer };
  }
  const r = 10.2 * Math.sqrt(k + 0.35) * shrink;
  return { x: Math.cos(angle) * r + jx, y: Math.sin(angle) * r + jy - layer * 4.5, rot, layer };
}

/** 칸 안에 실제로 그리는 씨앗 수의 한도 (그보다 많으면 숫자 배지만 정확하다) */
export function maxDrawn(index: number): number {
  return isStore(index) ? 96 : 44;
}

/** 반짝이는 조약돌 색 (가운데 색, 어두운 테두리 색) */
export const SEED_COLORS: { main: string; dark: string }[] = [
  { main: '#e0464e', dark: '#8f1c27' },
  { main: '#f2b025', dark: '#9c6608' },
  { main: '#3b8fe0', dark: '#1a4f88' },
  { main: '#2fae74', dark: '#146a45' },
  { main: '#9461d9', dark: '#55298f' },
  { main: '#f2784b', dark: '#a8401b' },
  { main: '#25b3b0', dark: '#0f6e6b' },
  { main: '#efe7d6', dark: '#a39478' },
];

export function seedColorIndex(id: number): number {
  return Math.floor(hash01(id, 77) * SEED_COLORS.length);
}

/**
 * 판(칸마다 씨앗 수)에서 씨앗 하나하나의 번호 목록을 만든다. 번호는 0부터 차례로, 색은 번호로 정해진다.
 * 화면은 이 목록으로 씨앗이 어느 칸에서 어느 칸으로 옮겨 가는지 그린다.
 */
export function listsFromBoard(board: readonly number[]): number[][] {
  let id = 0;
  return board.map((n) => Array.from({ length: n }, () => id++));
}

export function listsMatch(lists: readonly number[][], board: readonly number[]): boolean {
  return lists.length === CELLS && lists.every((l, i) => l.length === board[i]);
}
