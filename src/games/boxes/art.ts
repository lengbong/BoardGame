import type { ShapeKind } from '../../components/shapes';
import { seededRandom } from '../../lib/random';
import type { SeatIndex } from './types';

/** 판 그림의 단위: 상자 한 칸 = 100, 둘레 여백 60 (SVG viewBox 좌표) */
export const UNIT = 100;
export const MARGIN = 60;

export function boardExtent(n: number): number {
  return n * UNIT + MARGIN * 2;
}

/** 점 (r, c)의 그림 좌표 */
export function dotXY(r: number, c: number): [number, number] {
  return [MARGIN + c * UNIT, MARGIN + r * UNIT];
}

/**
 * 자리마다 펜 색과 모양. 종이 위에서 잘 보이게 노랑은 조금 진하게.
 * 모양은 다른 카드 게임과 같은 짝 (빨강 ●, 초록 잎, 노랑 ★, 파랑 ◆)
 */
export const PENS: Record<SeatIndex, { ink: string; label: string; shape: ShapeKind }> = {
  0: { ink: '#e5484d', label: '#a52a2f', shape: 'circle' },
  1: { ink: '#2b9a64', label: '#1d6b45', shape: 'leaf' },
  2: { ink: '#e3a100', label: '#875f00', shape: 'star' },
  3: { ink: '#3e63dd', label: '#25409a', shape: 'diamond' },
};

const f = (v: number) => v.toFixed(1);

/** 손으로 그은 듯 살짝 휘고 끝이 조금 어긋난 선 (같은 seed면 늘 같은 모양) */
export function wobblyPath(x1: number, y1: number, x2: number, y2: number, seed: number, amp = 3.4): string {
  const rnd = seededRandom(seed * 7919 + 13);
  const j = () => (rnd() - 0.5) * 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const sx = x1 + j() * 1.6;
  const sy = y1 + j() * 1.6;
  const ex = x2 + j() * 1.6;
  const ey = y2 + j() * 1.6;
  const o1 = j() * amp;
  const o2 = j() * amp;
  const c1x = x1 + dx * 0.33 + nx * o1;
  const c1y = y1 + dy * 0.33 + ny * o1;
  const c2x = x1 + dx * 0.67 + nx * o2;
  const c2y = y1 + dy * 0.67 + ny * o2;
  return `M${f(sx)} ${f(sy)}C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(ex)} ${f(ey)}`;
}

/** 크레용으로 칠한 듯한 빗금: 상자 (x, y, size) 안쪽을 비스듬한 선 여러 개로 */
export function hatchStrokes(x: number, y: number, size: number, seed: number, gap = 12): string[] {
  const rnd = seededRandom(seed * 104729 + 7);
  const j = (a: number) => (rnd() - 0.5) * 2 * a;
  const out: string[] = [];
  for (let k = -size + gap * 0.6; k < size; k += gap) {
    // 상자 안 좌표에서 u − v = k 인 선분
    const u1 = Math.max(0, k);
    const v1 = Math.max(0, -k);
    const u2 = Math.min(size, size + k);
    const v2 = Math.min(size, size - k);
    if (Math.hypot(u2 - u1, v2 - v1) < 8) continue;
    const ax = x + u1 + j(1.5);
    const ay = y + v1 + j(1.5);
    const bx = x + u2 + j(1.5);
    const by = y + v2 + j(1.5);
    const mx = (ax + bx) / 2 + j(2);
    const my = (ay + by) / 2 + j(2);
    out.push(`M${f(ax)} ${f(ay)}Q${f(mx)} ${f(my)} ${f(bx)} ${f(by)}`);
  }
  return out;
}

/** 점 p에서 선분 ab까지 거리 */
export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** 이름 첫 글자 (영문은 대문자) */
export function initialOf(name: string): string {
  const first = Array.from(name.trim())[0] ?? '?';
  return first.toUpperCase();
}
