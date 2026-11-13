import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { decideAction } from './ai';
import { boxOf, layoutArm, layoutLine, type TilePos } from './layout';
import { DEFAULT_OPTIONS, applyAction, createGame } from './rules';
import type { DominoSetup, DominoState } from './types';

type Box = { x0: number; y0: number; x1: number; y1: number };
const pxBox = (t: TilePos): Box => ({ x0: t.x - t.w / 2, y0: t.y - t.h / 2, x1: t.x + t.w / 2, y1: t.y + t.h / 2 });
const overlapArea = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/** 컴퓨터끼리 한 판을 두면서 줄이 자라는 모습을 모두 모은다. */
function collectLines(seed: number, players: number): { line: { left: number; right: number }[]; origin: number }[] {
  const rng = seededRandom(seed);
  const seats = [0, 1, 2, 3].map((i) => ({ kind: i < players ? 'ai-normal' : 'empty', name: '' })) as DominoSetup['seats'];
  let s: DominoState = createGame({ seats, options: { ...DEFAULT_OPTIONS } }, rng);
  const out: { line: { left: number; right: number }[]; origin: number }[] = [];
  for (let i = 0; i < 400 && s.phase === 'play'; i++) {
    s = applyAction(s, decideAction(s, 'ai-normal', rng), rng);
    out.push({ line: s.line.map((p) => ({ left: p.left, right: p.right })), origin: s.origin });
  }
  return out;
}

/** 한쪽 팔로만 아주 길게 뻗은 줄 (더블이 섞인), 28개까지 */
function syntheticLine(length: number, seed: number, doubleEvery: number): { left: number; right: number }[] {
  const rng = seededRandom(seed);
  const line: { left: number; right: number }[] = [];
  let end = 6;
  for (let i = 0; i < length; i++) {
    if (i % doubleEvery === doubleEvery - 1) line.push({ left: end, right: end });
    else {
      const next = Math.floor(rng() * 7);
      line.push({ left: end, right: next === end ? (next + 1) % 7 : next });
      end = line[line.length - 1].right;
    }
  }
  return line;
}

function checkLayout(line: { left: number; right: number }[], origin: number, w: number, h: number) {
  const ghost = { double: false, entry: null, exit: null };
  const lay = layoutLine(line, origin, w, h, { ghosts: { left: ghost, right: ghost } });
  const boxes = lay.tiles.map(pxBox);
  const all = [...boxes, pxBox(lay.slots.left!), pxBox(lay.slots.right!)];
  // 1) 모두 탁자 안
  for (const b of all) {
    expect(b.x0).toBeGreaterThanOrEqual(-0.01);
    expect(b.y0).toBeGreaterThanOrEqual(-0.01);
    expect(b.x1).toBeLessThanOrEqual(w + 0.01);
    expect(b.y1).toBeLessThanOrEqual(h + 0.01);
  }
  // 2) 서로 겹치지 않는다
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) expect(overlapArea(all[i], all[j])).toBeLessThan(lay.unit * lay.unit * 0.01);
  }
  // 3) 이웃한 패는 서로 맞닿아 있다 (한쪽 방향으로는 틈이 0, 다른 방향으로는 겹침)
  const chain = [pxBox(lay.slots.left!), ...boxes, pxBox(lay.slots.right!)];
  for (let i = 1; i < chain.length; i++) {
    const a = chain[i - 1];
    const b = chain[i];
    const gx = Math.max(a.x0 - b.x1, b.x0 - a.x1);
    const gy = Math.max(a.y0 - b.y1, b.y0 - a.y1);
    expect(Math.abs(Math.max(gx, gy))).toBeLessThan(lay.unit * 0.01);
    expect(Math.min(gx, gy)).toBeLessThan(0);
  }
  return lay;
}

describe('뱀 모양 배치', () => {
  it('넓으면 첫 패에서 오른쪽으로 곧게 뻗는다', () => {
    const pos = layoutArm([{ double: false }, { double: true }, { double: false }], 1, 20);
    expect(pos).toEqual([
      { x: 2, y: 0, rot: 0 },
      { x: 3.5, y: 0, rot: 90 },
      { x: 5, y: 0, rot: 0 },
    ]);
  });

  it('끝에 다가가면 아래로 꺾어서 다음 줄은 반대 방향으로 간다', () => {
    const tiles = Array.from({ length: 6 }, () => ({ double: false }));
    const pos = layoutArm(tiles, 1, 6);
    expect(pos[0]).toEqual({ x: 2, y: 0, rot: 0 });
    expect(pos[1].rot).toBe(90); // 모서리는 세로
    expect(pos[2].rot).toBe(90); // 한 번 더 내려가고
    expect(pos[3].rot).toBe(180); // 반대 방향(왼쪽)으로
    expect(pos[3].y).toBeGreaterThanOrEqual(2.5);
    for (const p of pos) {
      const b = boxOf(p);
      expect(b.x0).toBeGreaterThanOrEqual(-6);
      expect(b.x1).toBeLessThanOrEqual(6);
    }
  });

  it('왼쪽 팔은 반대로 (왼쪽으로 가다가 위로) 자란다', () => {
    const line = Array.from({ length: 9 }, (_, i) => ({ left: i % 7, right: (i + 1) % 7 }));
    const lay = layoutLine(line, 8, 600, 400);
    const origin = lay.tiles[8];
    expect(lay.tiles[7].x).toBeLessThan(origin.x);
    expect(Math.min(...lay.tiles.map((t) => t.y))).toBeLessThanOrEqual(origin.y);
  });

  it('줄이 길어져도 모든 패가 탁자 안에 겹치지 않고 이어진다 (실제 게임)', () => {
    const sizes: [number, number][] = [
      [900, 460],
      [640, 420],
      [420, 520],
      [1100, 300],
    ];
    for (const seed of [3, 8, 13]) {
      for (const players of [2, 4]) {
        for (const { line, origin } of collectLines(seed, players)) {
          if (line.length === 0) continue;
          for (const [w, h] of sizes) checkLayout(line, origin, w, h);
        }
      }
    }
  });

  it('28개짜리 긴 줄도 (한쪽으로만, 양쪽으로, 더블 섞어서) 탁자 안에 들어간다', () => {
    const sizes: [number, number][] = [
      [900, 460],
      [520, 380],
      [360, 560],
    ];
    for (const [w, h] of sizes) {
      for (const doubleEvery of [3, 4, 7]) {
        const line = syntheticLine(28, doubleEvery, doubleEvery);
        for (const origin of [0, 27, 13]) checkLayout(line, origin, w, h);
      }
    }
  });

  it('짧은 줄은 크게, 긴 줄은 작게 그린다', () => {
    const short = layoutLine(syntheticLine(3, 1, 9), 0, 600, 300);
    const long = layoutLine(syntheticLine(28, 1, 9), 0, 600, 300);
    expect(short.unit).toBe(30);
    expect(long.unit).toBeLessThan(short.unit);
    expect(long.unit).toBeGreaterThanOrEqual(8);
  });

  it('줄이 비어 있으면 첫 패 자리는 가운데에 놓인다', () => {
    const lay = layoutLine([], 0, 800, 400, { ghosts: { left: null, right: { double: true, entry: 5, exit: 5 } } });
    expect(lay.slots.right).toMatchObject({ x: 400, y: 200, rot: 90, a: 5, b: 5 });
  });
});
