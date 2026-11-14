import { EDGES, SEG_AT, SEG_EDGES, TILES, featurePoints } from './tiles';
import type { FeatureKind, Node, Placed, Rot, Side } from './types';

/** 모서리 방향으로 한 칸: 북 · 동 · 남 · 서 */
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;

/** 반대쪽 모서리 */
export function opposite(side: number): Side {
  return ((side + 2) % 4) as Side;
}

/** 좌표를 숫자 하나로 (지도는 처음 조각에서 ±500칸 안) */
export function cellKey(x: number, y: number): number {
  return (x + 512) * 1024 + (y + 512);
}

export function keyX(key: number): number {
  return Math.floor(key / 1024) - 512;
}

export function keyY(key: number): number {
  return (key % 1024) - 512;
}

/**
 * 지도: 놓인 조각과 좌표 찾기 표. 컴퓨터가 '여기 놓으면?'을 빨리 따져 보도록 add/pop으로 잠깐 놓아 볼 수 있다.
 * (게임 상태의 조각 객체는 바꾸지 않는다)
 */
export class Grid {
  readonly tiles: Placed[];
  readonly at = new Map<number, number>();

  constructor(board: readonly Placed[]) {
    this.tiles = [...board];
    this.tiles.forEach((p, i) => this.at.set(cellKey(p.x, p.y), i));
  }

  get(x: number, y: number): number | undefined {
    return this.at.get(cellKey(x, y));
  }

  add(p: Placed): number {
    this.tiles.push(p);
    const i = this.tiles.length - 1;
    this.at.set(cellKey(p.x, p.y), i);
    return i;
  }

  /** 마지막에 add한 조각을 치운다 */
  pop(): void {
    const p = this.tiles.pop();
    if (p) this.at.delete(cellKey(p.x, p.y));
  }

  /** 빈 칸 중 놓인 조각과 맞닿은 칸들 */
  frontier(): number[] {
    const out = new Set<number>();
    for (const p of this.tiles) {
      for (let s = 0; s < 4; s++) {
        const k = cellKey(p.x + DX[s], p.y + DY[s]);
        if (!this.at.has(k)) out.add(k);
      }
    }
    return [...out];
  }

  /** 조각 t를 r만큼 돌려 (x, y)에 놓을 수 있는지: 빈 칸이고, 이웃이 하나 이상 있고, 맞닿은 모서리가 모두 같은 지형 */
  fits(t: number, x: number, y: number, r: Rot): boolean {
    if (this.at.has(cellKey(x, y))) return false;
    let neighbours = 0;
    const edges = EDGES[t][r];
    for (let s = 0; s < 4; s++) {
      const j = this.at.get(cellKey(x + DX[s], y + DY[s]));
      if (j === undefined) continue;
      const q = this.tiles[j];
      if (EDGES[q.t][q.r][opposite(s)] !== edges[s]) return false;
      neighbours++;
    }
    return neighbours > 0;
  }

  /** 맞지 않는 모서리들 (화면에서 빨갛게 보여 준다) */
  mismatches(t: number, x: number, y: number, r: Rot): Side[] {
    const out: Side[] = [];
    const edges = EDGES[t][r];
    for (let s = 0 as Side; s < 4; s = (s + 1) as Side) {
      const j = this.at.get(cellKey(x + DX[s], y + DY[s]));
      if (j === undefined) continue;
      const q = this.tiles[j];
      if (EDGES[q.t][q.r][opposite(s)] !== edges[s]) out.push(s);
    }
    return out;
  }

  /** 이 조각의 seg번째 지형과 이어진 지형 전체를 따라간다 */
  trace(index: number, seg: number, players: number): FeatureInfo {
    return traceFeature(this, index, seg, players);
  }
}

/** 이어진 지형 하나 (길 한 줄, 냇물 한 줄기, 논 한 덩이) */
export interface FeatureInfo {
  kind: FeatureKind;
  nodes: Node[];
  /** 이 지형이 지나는 조각 수 */
  tiles: number;
  /** 아직 이어지지 않은 모서리 수 (0이면 완성) */
  open: number;
  fish: number;
  crows: number;
  /** 자리마다 꽂은 깃발 수 */
  flags: number[];
  complete: boolean;
  points: number;
}

const nodeId = (index: number, seg: number) => index * 8 + seg;

export function traceFeature(grid: Grid, index: number, seg: number, players: number): FeatureInfo {
  const first = grid.tiles[index];
  const kind = TILES[first.t].segs[seg].kind;
  const seen = new Set<number>([nodeId(index, seg)]);
  const queue: [number, number][] = [[index, seg]];
  const nodes: Node[] = [];
  const tileSet = new Set<number>();
  const flags = new Array<number>(players).fill(0);
  let open = 0;
  let fish = 0;
  let crows = 0;
  while (queue.length > 0) {
    const [i, s] = queue.pop()!;
    nodes.push([i, s]);
    tileSet.add(i);
    const p = grid.tiles[i];
    const def = TILES[p.t].segs[s];
    fish += def.fish?.length ?? 0;
    crows += def.crows?.length ?? 0;
    if (p.flag && p.flag.seg === s && p.flag.player < players) flags[p.flag.player] += 1;
    for (const side of SEG_EDGES[p.t][p.r][s]) {
      const j = grid.get(p.x + DX[side], p.y + DY[side]);
      if (j === undefined) {
        open++;
        continue;
      }
      const q = grid.tiles[j];
      const s2 = SEG_AT[q.t][q.r][opposite(side)];
      if (s2 < 0) continue; // 맞춰 놓았다면 생기지 않는다
      const id = nodeId(j, s2);
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push([j, s2]);
    }
  }
  nodes.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const tiles = tileSet.size;
  return { kind, nodes, tiles, open, fish, crows, flags, complete: open === 0, points: featurePoints(kind, tiles, fish, crows) };
}

/** 지도의 모든 지형 (조각마다 지형 번호마다 한 번씩) */
export function allFeatures(grid: Grid, players: number): FeatureInfo[] {
  const done = new Set<number>();
  const out: FeatureInfo[] = [];
  grid.tiles.forEach((p, i) => {
    TILES[p.t].segs.forEach((_, s) => {
      if (done.has(nodeId(i, s))) return;
      const f = traceFeature(grid, i, s, players);
      f.nodes.forEach(([a, b]) => done.add(nodeId(a, b)));
      out.push(f);
    });
  });
  return out;
}

/** 깃발이 가장 많은 사람들 (깃발이 없으면 빈 배열). 같으면 모두 */
export function majority(flags: readonly number[]): number[] {
  const top = Math.max(0, ...flags);
  if (top === 0) return [];
  return flags.map((c, i) => (c === top ? i : -1)).filter((i) => i >= 0);
}
