import type { EdgeKind, EndKind, FeatureKind, Pt, Rot, Side } from './types';

/**
 * 우리 마을 지도의 땅 조각 (이 게임을 위해 새로 정한 56장 + 처음 조각 '마을 어귀').
 * 좌표는 돌리기 전 기준, 조각 하나가 0~100. 모서리 번호: 0 북 · 1 동 · 2 남 · 3 서.
 */

/** 조각 안의 지형 하나 (길 한 줄기, 냇물 한 줄기, 논 한 배미) */
export interface SegDef {
  kind: FeatureKind;
  /** 이 지형이 닿는 모서리 */
  edges: Side[];
  /** 모서리가 하나인 길·냇물이 조각 안에서 끝나는 곳 */
  end?: EndKind;
  /** 끝나는 곳의 위치 */
  at?: Pt;
  /** 모서리 둘을 잇는 길·냇물이 지나는 가운데 점 (그림용) */
  via?: Pt;
  /** 깃발을 꽂는 자리 */
  anchor: Pt;
  /** 물고기 그림 위치 (냇물: 한 마리에 +2점) */
  fish?: Pt[];
  /** 허수아비 위치 (논: 하나에 +2점) */
  crows?: Pt[];
}

export type DecoKind = 'pine' | 'tree' | 'flowers' | 'rock' | 'tuft';

export interface Deco {
  kind: DecoKind;
  at: Pt;
}

export interface TileDef {
  id: string;
  name: string;
  /** 더미에 들어가는 장수 */
  count: number;
  segs: SegDef[];
  /** 장승이 서 있는 자리. 있으면 장승 조각 (처음 조각은 그림만) */
  jangseung?: Pt;
  deco?: Deco[];
}

const d = (kind: DecoKind, x: number, y: number): Deco => ({ kind, at: [x, y] });

export const START_TILE_ID = 'start';

export const TILES: TileDef[] = [
  // ---------------------------------------------------------------- 처음 조각
  {
    id: START_TILE_ID,
    name: '마을 어귀',
    count: 0,
    jangseung: [28, 84],
    segs: [
      { kind: 'paddy', edges: [0], anchor: [50, 12] },
      { kind: 'path', edges: [1, 3], via: [50, 60], anchor: [70, 56] },
    ],
    deco: [d('tree', 78, 82), d('flowers', 52, 86)],
  },

  // ---------------------------------------------------------------- 길
  { id: 'road-straight', name: '곧은 길', count: 4, segs: [{ kind: 'path', edges: [0, 2], anchor: [50, 52] }], deco: [d('pine', 22, 30), d('flowers', 78, 72), d('tuft', 80, 24)] },
  { id: 'road-curve', name: '굽은 길', count: 5, segs: [{ kind: 'path', edges: [1, 2], anchor: [64, 64] }], deco: [d('tree', 28, 30), d('tuft', 22, 76), d('rock', 84, 18)] },
  {
    id: 'road-house',
    name: '초가집',
    count: 2,
    segs: [{ kind: 'path', edges: [2], end: 'house', at: [50, 52], anchor: [50, 84] }],
    deco: [d('tree', 16, 22), d('flowers', 82, 76)],
  },
  {
    id: 'road-tee',
    name: '세 갈래 길',
    count: 2,
    segs: [
      { kind: 'path', edges: [1], end: 'cross', at: [50, 50], anchor: [84, 50] },
      { kind: 'path', edges: [2], end: 'cross', at: [50, 50], anchor: [50, 84] },
      { kind: 'path', edges: [3], end: 'cross', at: [50, 50], anchor: [16, 50] },
    ],
    deco: [d('pine', 30, 20), d('tuft', 74, 18)],
  },
  {
    id: 'road-cross',
    name: '네거리',
    count: 1,
    segs: [
      { kind: 'path', edges: [0], end: 'cross', at: [50, 50], anchor: [50, 16] },
      { kind: 'path', edges: [1], end: 'cross', at: [50, 50], anchor: [84, 50] },
      { kind: 'path', edges: [2], end: 'cross', at: [50, 50], anchor: [50, 84] },
      { kind: 'path', edges: [3], end: 'cross', at: [50, 50], anchor: [16, 50] },
    ],
    deco: [d('tuft', 20, 20), d('flowers', 80, 80)],
  },
  {
    id: 'market',
    name: '장터',
    count: 1,
    segs: [
      { kind: 'path', edges: [0], end: 'market', at: [50, 46], anchor: [50, 12] },
      { kind: 'path', edges: [2], end: 'market', at: [50, 54], anchor: [50, 88] },
    ],
    deco: [d('tree', 14, 80), d('tuft', 86, 20)],
  },

  // ---------------------------------------------------------------- 냇물
  { id: 'stream-straight', name: '곧은 냇물', count: 2, segs: [{ kind: 'stream', edges: [0, 2], anchor: [50, 52] }], deco: [d('rock', 24, 28), d('tuft', 76, 70)] },
  {
    id: 'stream-fish',
    name: '물고기 냇물',
    count: 1,
    segs: [{ kind: 'stream', edges: [0, 2], anchor: [50, 68], fish: [[50, 34]] }],
    deco: [d('tree', 20, 74), d('flowers', 82, 26)],
  },
  { id: 'stream-curve', name: '굽은 냇물', count: 2, segs: [{ kind: 'stream', edges: [0, 3], anchor: [36, 36] }], deco: [d('pine', 72, 68), d('tuft', 28, 80)] },
  {
    id: 'stream-curve-fish',
    name: '물고기 굽은 냇물',
    count: 1,
    segs: [{ kind: 'stream', edges: [0, 3], anchor: [24, 44], fish: [[42, 30]] }],
    deco: [d('tree', 72, 70), d('rock', 80, 22)],
  },
  {
    id: 'spring',
    name: '샘',
    count: 3,
    segs: [{ kind: 'stream', edges: [2], end: 'spring', at: [50, 44], anchor: [50, 82] }],
    deco: [d('pine', 20, 26), d('flowers', 80, 28)],
  },
  {
    id: 'pond',
    name: '연못',
    count: 2,
    segs: [{ kind: 'stream', edges: [2], end: 'pond', at: [50, 42], anchor: [50, 86], fish: [[40, 44]] }],
    deco: [d('tree', 84, 16), d('tuft', 14, 80)],
  },
  {
    id: 'bridge',
    name: '돌다리',
    count: 2,
    segs: [
      { kind: 'path', edges: [0, 2], anchor: [50, 18] },
      { kind: 'stream', edges: [1, 3], anchor: [18, 52] },
    ],
    deco: [d('tuft', 80, 20), d('flowers', 22, 82)],
  },
  {
    id: 'stream-road',
    name: '냇가 길',
    count: 2,
    segs: [
      { kind: 'path', edges: [0, 1], anchor: [66, 32] },
      { kind: 'stream', edges: [2, 3], anchor: [34, 66] },
    ],
    deco: [d('tree', 22, 22), d('rock', 80, 80)],
  },
  {
    id: 'laundry',
    name: '빨래터',
    count: 1,
    segs: [
      { kind: 'stream', edges: [0], end: 'pond', at: [50, 34], anchor: [72, 12] },
      { kind: 'path', edges: [2], end: 'laundry', at: [50, 66], anchor: [50, 90] },
    ],
    deco: [d('tree', 16, 76), d('flowers', 86, 64)],
  },

  // ---------------------------------------------------------------- 논
  { id: 'paddy-edge', name: '논 한 배미', count: 3, segs: [{ kind: 'paddy', edges: [0], anchor: [50, 13] }], deco: [d('tree', 30, 66), d('flowers', 72, 74), d('tuft', 56, 50)] },
  { id: 'paddy-band', name: '긴 논', count: 1, segs: [{ kind: 'paddy', edges: [0, 2], anchor: [50, 64], crows: [[50, 36]] }], deco: [d('tuft', 8, 50), d('tuft', 92, 52)] },
  { id: 'paddy-corner', name: '논 모퉁이', count: 2, segs: [{ kind: 'paddy', edges: [0, 1], anchor: [62, 14] }], deco: [d('pine', 30, 70)] },
  {
    id: 'paddy-corner-crow',
    name: '허수아비 논 모퉁이',
    count: 1,
    segs: [{ kind: 'paddy', edges: [0, 1], anchor: [44, 14], crows: [[86, 56]] }],
    deco: [d('tree', 30, 72)],
  },
  {
    id: 'paddy-two',
    name: '마주 본 논',
    count: 1,
    segs: [
      { kind: 'paddy', edges: [0], anchor: [50, 13] },
      { kind: 'paddy', edges: [2], anchor: [50, 87] },
    ],
    deco: [d('pine', 28, 50), d('tree', 72, 50)],
  },
  { id: 'paddy-big', name: '큰 논', count: 2, segs: [{ kind: 'paddy', edges: [0, 1, 3], anchor: [50, 30] }], deco: [d('flowers', 50, 86)] },
  {
    id: 'paddy-big-crow',
    name: '허수아비 큰 논',
    count: 1,
    segs: [{ kind: 'paddy', edges: [0, 1, 3], anchor: [66, 30], crows: [[34, 40]] }],
    deco: [d('tuft', 50, 88)],
  },
  { id: 'paddy-full', name: '너른 논', count: 1, segs: [{ kind: 'paddy', edges: [0, 1, 2, 3], anchor: [64, 64], crows: [[36, 36]] }] },
  {
    id: 'paddy-road',
    name: '논둑 옆 길',
    count: 2,
    segs: [
      { kind: 'paddy', edges: [0], anchor: [50, 12] },
      { kind: 'path', edges: [1, 3], via: [50, 64], anchor: [28, 58] },
    ],
    deco: [d('flowers', 74, 84), d('tuft', 20, 86)],
  },
  {
    id: 'paddy-road-curve',
    name: '논 옆 굽은 길',
    count: 1,
    segs: [
      { kind: 'paddy', edges: [0], anchor: [50, 12] },
      { kind: 'path', edges: [1, 2], via: [54, 58], anchor: [72, 70] },
    ],
    deco: [d('tree', 24, 66)],
  },
  {
    id: 'paddy-house',
    name: '논 옆 초가집',
    count: 1,
    segs: [
      { kind: 'paddy', edges: [0], anchor: [50, 12] },
      { kind: 'path', edges: [2], end: 'house', at: [50, 64], anchor: [50, 90] },
    ],
    deco: [d('tree', 16, 72), d('flowers', 86, 80)],
  },
  {
    id: 'paddy-stream',
    name: '논물 대는 냇물',
    count: 2,
    segs: [
      { kind: 'paddy', edges: [0], anchor: [50, 12] },
      { kind: 'stream', edges: [1, 3], via: [50, 62], anchor: [24, 60] },
    ],
    deco: [d('tuft', 76, 88), d('flowers', 26, 88)],
  },
  {
    id: 'paddy-hut',
    name: '원두막 논',
    count: 1,
    segs: [
      { kind: 'paddy', edges: [0, 1, 3], anchor: [50, 28] },
      { kind: 'path', edges: [2], end: 'hut', at: [50, 82], anchor: [30, 92] },
    ],
  },

  // ---------------------------------------------------------------- 장승 (놓는 순간 점수)
  {
    id: 'js-road',
    name: '장승 길목',
    count: 2,
    jangseung: [50, 54],
    segs: [{ kind: 'path', edges: [2], end: 'jangseung', at: [50, 58], anchor: [50, 86] }],
    deco: [d('pine', 18, 24), d('tree', 82, 30)],
  },
  {
    id: 'js-stream',
    name: '냇가 장승',
    count: 1,
    jangseung: [72, 90],
    segs: [
      { kind: 'paddy', edges: [0], anchor: [50, 12] },
      { kind: 'stream', edges: [1, 3], via: [50, 50], anchor: [20, 50] },
      { kind: 'path', edges: [2], end: 'jangseung', at: [56, 80], anchor: [36, 88] },
    ],
  },
  {
    id: 'js-cross',
    name: '장승 갈림길',
    count: 1,
    jangseung: [62, 52],
    segs: [
      { kind: 'path', edges: [0], end: 'jangseung', at: [56, 44], anchor: [40, 16] },
      { kind: 'path', edges: [1], end: 'jangseung', at: [64, 46], anchor: [86, 62] },
      { kind: 'paddy', edges: [2], anchor: [50, 88] },
      { kind: 'stream', edges: [3], end: 'spring', at: [28, 50], anchor: [10, 40] },
    ],
  },
  {
    id: 'js-paddy',
    name: '논 옆 장승',
    count: 1,
    jangseung: [50, 74],
    segs: [
      { kind: 'paddy', edges: [0], anchor: [50, 12] },
      { kind: 'path', edges: [2], end: 'jangseung', at: [50, 76], anchor: [32, 90] },
    ],
    deco: [d('tree', 16, 56), d('flowers', 84, 60)],
  },

  // ---------------------------------------------------------------- 들 (점수 없음)
  { id: 'pine-hill', name: '솔밭 언덕', count: 1, segs: [], deco: [d('pine', 30, 34), d('pine', 66, 28), d('pine', 48, 66), d('rock', 80, 76), d('tuft', 18, 80)] },
];

export const START_TILE = TILES.findIndex((t) => t.id === START_TILE_ID);

/** 장승 조각인지 (처음 조각 빼고) */
export function isJangseungTile(t: number): boolean {
  return t !== START_TILE && TILES[t].jangseung !== undefined;
}

/** 더미에 넣을 조각들 (장승 끄기면 장승 조각을 뺀다) */
export function deckList(jangseung: boolean): number[] {
  const out: number[] = [];
  TILES.forEach((def, t) => {
    if (t === START_TILE || (!jangseung && isJangseungTile(t))) return;
    for (let k = 0; k < def.count; k++) out.push(t);
  });
  return out;
}

/** 돌리기 전 모서리 지형 (지형이 닿지 않은 모서리는 들) */
function baseEdges(def: TileDef): EdgeKind[] {
  const e: EdgeKind[] = ['field', 'field', 'field', 'field'];
  for (const s of def.segs) for (const side of s.edges) e[side] = s.kind;
  return e;
}

export const FEATURE_NAMES: Record<FeatureKind, string> = { path: '길', stream: '냇물', paddy: '논' };
export const EDGE_NAMES: Record<EdgeKind, string> = { path: '길', stream: '냇물', paddy: '논둑', field: '들' };
export const END_NAMES: Record<EndKind, string> = {
  house: '초가집',
  hut: '원두막',
  market: '장터',
  cross: '갈림길',
  laundry: '빨래터',
  jangseung: '장승',
  spring: '샘',
  pond: '연못',
};

/** 돌린 모서리 번호 */
export function rotSide(side: number, r: number): Side {
  return ((side + r) % 4) as Side;
}

/** 돌린 조각 그림 좌표 (가운데 50,50을 기준으로 시계 방향) */
export function rotPt(p: Pt, r: number): Pt {
  let [x, y] = p;
  for (let k = 0; k < r % 4; k++) [x, y] = [100 - y, x];
  return [x, y];
}

/**
 * 미리 계산해 둔 표: EDGES[t][r][side] = 그 모서리 지형, SEG_AT[t][r][side] = 그 모서리에 닿는 지형 번호(없으면 -1),
 * SEG_EDGES[t][r][seg] = 돌린 뒤 지형이 닿는 모서리
 */
export const EDGES: EdgeKind[][][] = [];
export const SEG_AT: number[][][] = [];
export const SEG_EDGES: Side[][][][] = [];

TILES.forEach((def, t) => {
  const base = baseEdges(def);
  EDGES[t] = [];
  SEG_AT[t] = [];
  SEG_EDGES[t] = [];
  for (let r = 0; r < 4; r++) {
    const edges: EdgeKind[] = [];
    const at: number[] = [-1, -1, -1, -1];
    for (let side = 0; side < 4; side++) edges[rotSide(side, r)] = base[side];
    def.segs.forEach((s, i) => s.edges.forEach((side) => (at[rotSide(side, r)] = i)));
    EDGES[t][r] = edges;
    SEG_AT[t][r] = at;
    SEG_EDGES[t][r] = def.segs.map((s) => s.edges.map((side) => rotSide(side, r)));
  }
});

/** 돌려 봐도 모양이 같은 방향은 뺀 회전 목록 (예: 곧은 길은 0, 1만) */
export const DISTINCT_ROTS: Rot[][] = TILES.map((_, t) => {
  const seen = new Set<string>();
  const out: Rot[] = [];
  for (let r = 0 as Rot; r < 4; r = (r + 1) as Rot) {
    const key = EDGES[t][r].join(',') + '|' + SEG_EDGES[t][r].map((e) => [...e].sort().join('')).sort().join('/');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
});

/** 지형 점수: 길 칸당 1 · 냇물 칸당 1 + 물고기 2 · 논 칸당 2 + 허수아비 2 */
export function featurePoints(kind: FeatureKind, tiles: number, fish: number, crows: number): number {
  if (kind === 'path') return tiles;
  if (kind === 'stream') return tiles + fish * 2;
  return tiles * 2 + crows * 2;
}

export const TILE_COUNT_WITH_JANGSEUNG = deckList(true).length;
