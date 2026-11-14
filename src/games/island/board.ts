/**
 * 섬의 모양 (늘 같은 모양, 땅 종류와 숫자만 판마다 바뀐다).
 * 꼭짓점이 위로 향한 육각형 16칸. 북서쪽의 둥근 몸통에서 남동쪽으로 꼬리처럼 뻗은 곶이 있고,
 * 그 사이로 바닷물이 들어온 작은 만이 있다.
 *
 * 좌표는 축 좌표 (q, r). 그림 좌표는 HEX_SIZE 단위로 계산한다.
 */

export const HEX_SIZE = 60;
const SQ3 = Math.sqrt(3);

/** 땅 칸 16개 (축 좌표). 줄마다 위에서 아래로 */
const LAND: [number, number][] = [
  [1, 0],
  [2, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [3, 1],
  [-1, 2],
  [0, 2],
  [1, 2],
  [2, 2],
  [3, 2],
  [0, 3],
  [1, 3],
  [3, 3],
  [2, 4],
  [3, 4],
];

export interface HexGeo {
  id: number;
  q: number;
  r: number;
  x: number;
  y: number;
  /** 바다와 맞닿은 칸 */
  coastal: boolean;
  /** 맞닿은 땅 칸 */
  neighbors: number[];
  /** 여섯 모서리 (위쪽 꼭짓점부터 시계 방향) */
  corners: number[];
  /** 여섯 변 (위쪽 꼭짓점에서 오른쪽 아래로 가는 변부터 시계 방향) */
  edges: number[];
}

export interface CornerGeo {
  id: number;
  x: number;
  y: number;
  /** 이 모서리에 닿은 땅 칸 (1~3개) */
  hexes: number[];
  /** 이 모서리에 붙은 변 (2~3개) */
  edges: number[];
  /** 변 하나로 이어진 이웃 모서리 */
  corners: number[];
  /** 바다와 닿은 모서리 (땅 칸이 3개보다 적다) */
  coastal: boolean;
  /** 바다 쪽을 가리키는 단위 벡터 (바닷가가 아니면 0,0) */
  outX: number;
  outY: number;
}

export interface EdgeGeo {
  id: number;
  a: number;
  b: number;
  hexes: number[];
  x: number;
  y: number;
}

const DIRS: [number, number][] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

function build() {
  const index = new Map(LAND.map(([q, r], i) => [`${q},${r}`, i]));
  const centers = LAND.map(([q, r]) => ({ x: HEX_SIZE * SQ3 * (q + r / 2), y: HEX_SIZE * 1.5 * r }));

  // 모서리: 같은 자리의 꼭짓점을 하나로 묶는다
  type RawCorner = { x: number; y: number; hexes: number[] };
  const raw = new Map<string, RawCorner>();
  const hexCornerKeys: string[][] = [];
  centers.forEach((c, h) => {
    const keys: string[] = [];
    for (let k = 0; k < 6; k++) {
      const a = ((60 * k - 90) * Math.PI) / 180;
      const x = c.x + HEX_SIZE * Math.cos(a);
      const y = c.y + HEX_SIZE * Math.sin(a);
      const key = `${Math.round(x * 10)},${Math.round(y * 10)}`;
      const rc = raw.get(key) ?? { x, y, hexes: [] };
      rc.hexes.push(h);
      raw.set(key, rc);
      keys.push(key);
    }
    hexCornerKeys.push(keys);
  });
  // 위에서 아래로, 왼쪽에서 오른쪽으로 번호를 붙인다
  const cornerKeys = [...raw.keys()].sort((ka, kb) => {
    const a = raw.get(ka)!;
    const b = raw.get(kb)!;
    return Math.abs(a.y - b.y) > 1 ? a.y - b.y : a.x - b.x;
  });
  const cornerId = new Map(cornerKeys.map((k, i) => [k, i]));

  // 변
  type RawEdge = { a: number; b: number; hexes: number[] };
  const rawEdges = new Map<string, RawEdge>();
  const hexEdgeKeys: string[][] = [];
  hexCornerKeys.forEach((keys, h) => {
    const list: string[] = [];
    for (let k = 0; k < 6; k++) {
      const a = cornerId.get(keys[k])!;
      const b = cornerId.get(keys[(k + 1) % 6])!;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      const re = rawEdges.get(key) ?? { a: Math.min(a, b), b: Math.max(a, b), hexes: [] };
      re.hexes.push(h);
      rawEdges.set(key, re);
      list.push(key);
    }
    hexEdgeKeys.push(list);
  });
  const mid = (e: RawEdge) => {
    const a = raw.get(cornerKeys[e.a])!;
    const b = raw.get(cornerKeys[e.b])!;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  const edgeKeys = [...rawEdges.keys()].sort((ka, kb) => {
    const a = mid(rawEdges.get(ka)!);
    const b = mid(rawEdges.get(kb)!);
    return Math.abs(a.y - b.y) > 1 ? a.y - b.y : a.x - b.x;
  });
  const edgeId = new Map(edgeKeys.map((k, i) => [k, i]));

  const edges: EdgeGeo[] = edgeKeys.map((k, id) => {
    const e = rawEdges.get(k)!;
    const m = mid(e);
    return { id, a: e.a, b: e.b, hexes: [...e.hexes].sort((x, y) => x - y), x: m.x, y: m.y };
  });

  const corners: CornerGeo[] = cornerKeys.map((k, id) => {
    const rc = raw.get(k)!;
    const myEdges = edges.filter((e) => e.a === id || e.b === id).map((e) => e.id);
    const near = myEdges.map((eid) => (edges[eid].a === id ? edges[eid].b : edges[eid].a));
    const coastal = rc.hexes.length < 3;
    let outX = 0;
    let outY = 0;
    if (coastal) {
      const cx = rc.hexes.reduce((s, h) => s + centers[h].x, 0) / rc.hexes.length;
      const cy = rc.hexes.reduce((s, h) => s + centers[h].y, 0) / rc.hexes.length;
      const len = Math.hypot(rc.x - cx, rc.y - cy) || 1;
      outX = (rc.x - cx) / len;
      outY = (rc.y - cy) / len;
    }
    return { id, x: rc.x, y: rc.y, hexes: [...rc.hexes].sort((a, b) => a - b), edges: myEdges, corners: near, coastal, outX, outY };
  });

  const hexes: HexGeo[] = LAND.map(([q, r], id) => {
    const neighbors = DIRS.map(([dq, dr]) => index.get(`${q + dq},${r + dr}`)).filter((v): v is number => v !== undefined);
    return {
      id,
      q,
      r,
      x: centers[id].x,
      y: centers[id].y,
      coastal: neighbors.length < 6,
      neighbors,
      corners: hexCornerKeys[id].map((key) => cornerId.get(key)!),
      edges: hexEdgeKeys[id].map((key) => edgeId.get(key)!),
    };
  });

  return { hexes, corners, edges };
}

const GEO = build();

export const HEXES: readonly HexGeo[] = GEO.hexes;
export const CORNERS: readonly CornerGeo[] = GEO.corners;
export const EDGES: readonly EdgeGeo[] = GEO.edges;

export const HEX_COUNT = HEXES.length;
export const CORNER_COUNT = CORNERS.length;
export const EDGE_COUNT = EDGES.length;

/** 두 모서리를 잇는 변 (없으면 -1) */
export function edgeBetween(a: number, b: number): number {
  const e = CORNERS[a].edges.find((id) => EDGES[id].a === b || EDGES[id].b === b);
  return e ?? -1;
}

/** 그림 범위: 바다 여백까지 (장터와 주사위 자리가 들어갈 만큼) */
export const VIEW = (() => {
  const xs = HEXES.map((h) => h.x);
  const ys = HEXES.map((h) => h.y);
  const minX = Math.min(...xs) - HEX_SIZE * (SQ3 / 2) - HEX_SIZE * 0.75;
  const maxX = Math.max(...xs) + HEX_SIZE * (SQ3 / 2) + HEX_SIZE * 0.75;
  const minY = Math.min(...ys) - HEX_SIZE - HEX_SIZE * 0.6;
  const maxY = Math.max(...ys) + HEX_SIZE + HEX_SIZE * 0.6;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
})();

/** 육각형의 꼭짓점 목록 (그리기용). scale로 크기를 바꾼다 */
export function hexPoints(cx: number, cy: number, scale = 1): string {
  const pts: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = ((60 * k - 90) * Math.PI) / 180;
    pts.push(`${(cx + HEX_SIZE * scale * Math.cos(a)).toFixed(2)},${(cy + HEX_SIZE * scale * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}
