import type { SegDef } from './tiles';
import type { Pt, Side } from './types';

/**
 * 조각 그림의 모양 계산 (돌리기 전, 0~100 좌표).
 * 길·냇물은 모서리 가운데에서 직각으로 들어오게 그려서 옆 조각과 매끄럽게 이어진다.
 */

/** 모서리 가운데 점 */
const MID: readonly Pt[] = [
  [50, 0],
  [100, 50],
  [50, 100],
  [0, 50],
];
/** 모서리에서 조각 안쪽으로 향하는 방향 */
const IN: readonly Pt[] = [
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 0],
];

const f = (n: number) => Math.round(n * 10) / 10;
const pt = (p: Pt) => `${f(p[0])},${f(p[1])}`;
const add = (a: Pt, b: Pt, k = 1): Pt => [a[0] + b[0] * k, a[1] + b[1] * k];

/** 길·냇물 한 줄기의 선 (SVG path d) */
export function lineD(seg: SegDef): string {
  const e0 = seg.edges[0];
  const p0 = MID[e0];
  const n0 = IN[e0];
  if (seg.edges.length === 1) {
    const end = seg.at ?? [50, 50];
    const dist = Math.hypot(end[0] - p0[0], end[1] - p0[1]);
    return `M${pt(p0)} Q${pt(add(p0, n0, dist * 0.55))} ${pt(end)}`;
  }
  const e1 = seg.edges[1];
  const p3 = MID[e1];
  const n1 = IN[e1];
  const oppositeEdges = (e0 + 2) % 4 === e1;
  let via = seg.via;
  if (!via && oppositeEdges) {
    if (seg.kind !== 'stream') return `M${pt(p0)} L${pt(p3)}`;
    // 냇물은 살짝 휘어 흐른다
    via = add([50, 50], [n0[1], -n0[0]], 7);
  }
  if (!via) {
    const L = 28;
    return `M${pt(p0)} C${pt(add(p0, n0, L))} ${pt(add(p3, n1, L))} ${pt(p3)}`;
  }
  const L1 = 16;
  const c1 = add(p0, n0, L1);
  const c4 = add(p3, n1, L1);
  const len = Math.hypot(c4[0] - c1[0], c4[1] - c1[1]) || 1;
  const dir: Pt = [(c4[0] - c1[0]) / len, (c4[1] - c1[1]) / len];
  const L2 = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]) * 0.17;
  return `M${pt(p0)} C${pt(c1)} ${pt(add(via, dir, -L2))} ${pt(via)} C${pt(add(via, dir, L2))} ${pt(c4)} ${pt(p3)}`;
}

/** 논 모양 (기본 방향): fill은 논 전체, bank는 논둑(안쪽 둑길) */
const PADDY_SHAPES: { edges: Side[]; fill: string; bank: string }[] = [
  {
    edges: [0],
    fill: 'M0,0 H100 L82,23 Q79,30 72,30 H28 Q21,30 18,23 Z',
    bank: 'M0,0 L18,23 Q21,30 28,30 H72 Q79,30 82,23 L100,0',
  },
  {
    edges: [0, 1],
    fill: 'M0,0 H100 V100 L77,82 Q70,77 70,70 V37 Q70,30 63,30 H28 Q21,30 18,23 Z',
    bank: 'M0,0 L18,23 Q21,30 28,30 H63 Q70,30 70,37 V70 Q70,77 77,82 L100,100',
  },
  {
    edges: [0, 2],
    fill: 'M0,0 H100 L80,23 Q74,31 74,40 V60 Q74,69 80,77 L100,100 H0 L20,77 Q26,69 26,60 V40 Q26,31 20,23 Z',
    bank: 'M0,0 L20,23 Q26,31 26,40 V60 Q26,69 20,77 L0,100 M100,0 L80,23 Q74,31 74,40 V60 Q74,69 80,77 L100,100',
  },
  {
    edges: [0, 1, 3],
    fill: 'M0,0 H100 V100 L80,75 Q76,68 68,68 H32 Q24,68 20,75 L0,100 Z',
    bank: 'M0,100 L20,75 Q24,68 32,68 H68 Q76,68 80,75 L100,100',
  },
  { edges: [0, 1, 2, 3], fill: 'M0,0 H100 V100 H0 Z', bank: '' },
];

/** 논 한 배미의 모양과, 기본 모양을 몇 번 돌려야 하는지 */
export function paddyShape(edges: readonly Side[]): { fill: string; bank: string; turn: number } {
  const want = [...edges].sort().join('');
  for (const shape of PADDY_SHAPES) {
    if (shape.edges.length !== edges.length) continue;
    for (let k = 0; k < 4; k++) {
      const got = shape.edges
        .map((e) => (e + k) % 4)
        .sort()
        .join('');
      if (got === want) return { fill: shape.fill, bank: shape.bank, turn: k };
    }
  }
  return { fill: PADDY_SHAPES[0].fill, bank: PADDY_SHAPES[0].bank, turn: 0 };
}

/** 돌다리: 서로 엇갈리는 곧은 길과 곧은 냇물이 한 조각에 있으면 가운데에 다리를 놓는다 */
export function bridgeTurn(segs: readonly SegDef[]): number | null {
  const road = segs.find((s) => s.kind === 'path' && s.edges.length === 2 && (s.edges[0] + 2) % 4 === s.edges[1]);
  const water = segs.find((s) => s.kind === 'stream' && s.edges.length === 2 && (s.edges[0] + 2) % 4 === s.edges[1]);
  if (!road || !water) return null;
  return road.edges[0] % 2 === 0 ? 0 : 1;
}
