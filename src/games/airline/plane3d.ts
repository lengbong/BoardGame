import type { ShapeKind } from '../../components/shapes';

/**
 * 기종의 실제 치수(길이·날개폭·동체 지름·후퇴각·엔진 자리)로 간단한 3D 모형을 만들고,
 * 비스듬히 앞 위에서 본 모습을 SVG로 그린다 (사진 대신 쓰는 그림).
 *
 * 모형 좌표: x 앞쪽(코 0, 꼬리 −길이), y 왼쪽 날개 쪽, z 위. 단위는 m.
 * 화면은 코가 왼쪽 아래를 보고 왼쪽 날개가 보는 사람 쪽으로 오는 각도.
 */

export type Vec = readonly [number, number, number];

/** 날개 끝 모양 */
export type TipKind = 'plain' | 'fence' | 'winglet' | 'blended' | 'sharklet' | 'raked' | 'curved' | 'split' | 'updown';

export interface EngineMount {
  /** 날개 아래 엔진 (한쪽 날개, 반날개폭 비율) */
  wing?: readonly number[];
  /** 꼬리 옆에 붙은 엔진 (한쪽에 1 또는 2) */
  rear?: 1 | 2;
  /** 꼬리 가운데 엔진: S자 덕트(727·트라이스타) / 꼬리 날개 밑(DC-10) */
  center?: 'sduct' | 'fin';
  /** 날개 위 프로펠러 (한쪽 날개, 반날개폭 비율) */
  prop?: readonly number[];
  /** 초음속기: 날개 아래 엔진 상자 */
  box?: boolean;
  /** 엔진 덮개(나셀) 지름·길이 (m) */
  d: number;
  l: number;
  /** 날개 바로 밑에 붙은 가는 옛 엔진 */
  slim?: boolean;
  /** 프로펠러 지름 (m) */
  propD?: number;
}

export interface PlaneShape {
  /** 전체 길이 (m) */
  len: number;
  /** 날개폭 (m) */
  span: number;
  /** 동체 폭 (m) */
  dia: number;
  /** 동체 높이 ÷ 폭 */
  tall?: number;
  /** 1/4 시위 후퇴각 (도) */
  sweep: number;
  /** 날개 가로세로비 */
  ar?: number;
  /** 날개 끝 시위 ÷ 뿌리 시위 */
  taper?: number;
  /** 날개 공력 중심 자리 (코에서 길이 비율) */
  pos?: number;
  /** 동체 위에 붙은 날개 (프로펠러기) */
  high?: boolean;
  /** 안쪽 뒷전이 곧게 넓어진 날개 */
  crank?: boolean;
  /** 위로 꺾인 각 (도) */
  dihedral?: number;
  tip?: TipKind;
  /** 윙렛 높이 (m) */
  tipH?: number;
  eng: EngineMount;
  /** 수평 꼬리날개: 아래 / T자 / 꼬리 가운데 */
  tail: 'low' | 't' | 'cross' | 'none';
  /** 동체 위 수직 꼬리날개 높이 (m) */
  finH?: number;
  /** 수평 꼬리날개 폭 (날개폭 비율) */
  stab?: number;
  /** 코·꼬리 원뿔 길이 (동체 폭 배수) */
  noseLen?: number;
  tailLen?: number;
  /** 747처럼 앞쪽이 불룩한 2층: 혹이 끝나는 자리 (길이 비율) */
  hump?: number;
  /** 2층 여객기 */
  decks?: 1 | 2;
  /** 초음속기 (뾰족한 코·삼각 날개) */
  sst?: boolean;
  /** 삼각 날개 모양 [반날개폭 비율, 앞전(코에서 길이 비율), 뒷전] */
  planform?: readonly (readonly [number, number, number])[];
  /** 창문 줄 수 대신 쓰는 값 (없으면 decks) */
  windows?: number;
}

/** 칠 색 */
export interface Livery {
  body: string;
  belly: string;
  /** 창문 아래 줄무늬 */
  cheat: string;
  tail: string;
  engine: string;
  window: string;
  /** 꼬리에 그리는 모양 (없으면 안 그림) */
  logo?: ShapeKind;
  logoColor?: string;
}

/** 첨부한 옛 게임 그림처럼 흰 몸통에 짙은 파랑 줄 (주문·구경용) */
export const NEUTRAL_LIVERY: Livery = {
  body: '#f6f8fa',
  belly: '#dfe5ec',
  cheat: '#2557a7',
  tail: '#f6f8fa',
  engine: '#cfd7e0',
  window: '#1d3557',
};

/** 회사 색을 입힌 칠 */
export function companyLivery(main: string, dark: string, logo?: ShapeKind): Livery {
  return { ...NEUTRAL_LIVERY, cheat: main, tail: dark, logo, logoColor: '#ffffff' };
}

// ------------------------------------------------------------------ 벡터

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec): Vec => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: Vec, b: Vec, t: number): Vec => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const rad = (deg: number) => (deg * Math.PI) / 180;

/** 다각형의 법선 (Newell) */
function newell(pts: readonly Vec[]): Vec {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return norm([nx, ny, nz]);
}

const centroid = (pts: readonly Vec[]): Vec => {
  let s: Vec = [0, 0, 0];
  for (const p of pts) s = add(s, p);
  return mul(s, 1 / pts.length);
};

// ------------------------------------------------------------------ 카메라

export interface Camera {
  /** 코가 보는 사람 쪽으로 돌아간 각 (도) */
  yaw: number;
  /** 내려다보는 각 (도) */
  pitch: number;
  /** 기울기 (음수면 가까운 날개가 내려간다) */
  roll: number;
}

export const DEFAULT_CAMERA: Camera = { yaw: 14, pitch: 30, roll: -6 };

interface Projector {
  /** 모형 좌표 → 화면 (x 오른쪽, y 아래, depth 클수록 가깝다) */
  (p: Vec): [number, number, number];
  /** 모형 좌표 방향 → 세계 좌표 방향 */
  dir(v: Vec): Vec;
  view: Vec;
}

function projector(cam: Camera): Projector {
  const a = rad(cam.yaw);
  const b = rad(cam.pitch);
  const r = rad(cam.roll);
  const fwd: Vec = [-Math.cos(a), 0, Math.sin(a)];
  const left0: Vec = [Math.sin(a), 0, Math.cos(a)];
  const up0: Vec = [0, 1, 0];
  const left = add(mul(left0, Math.cos(r)), mul(up0, Math.sin(r)));
  const up = sub(mul(up0, Math.cos(r)), mul(left0, Math.sin(r)));
  const cb = Math.cos(b);
  const sb = Math.sin(b);
  const dir = (p: Vec): Vec => add(add(mul(fwd, p[0]), mul(left, p[1])), mul(up, p[2]));
  const f = ((p: Vec) => {
    const w = dir(p);
    return [w[0], -(w[1] * cb - w[2] * sb), w[1] * sb + w[2] * cb];
  }) as Projector;
  f.dir = dir;
  f.view = [0, sb, cb];
  return f;
}

// ------------------------------------------------------------------ 면

type Rgb = readonly [number, number, number];

function hex(c: string): Rgb {
  const h = c.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (x) => x + x) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

interface Face {
  pts: Vec[];
  color: Rgb;
  /** 그리는 층 (작은 것부터) */
  layer: number;
  /** 같은 층에서 부품끼리의 순서 (클수록 나중) */
  unit: number;
  /** 부품 안에서의 순서 */
  order: number;
  /** 뒤를 보면 안 그린다 */
  cull: boolean;
  /** 빛 계산 없이 이 색 그대로 */
  flat?: boolean;
  opacity?: number;
  /** 바깥 방향 (뒤집힌 면 바로잡기용 기준점) */
  inside?: Vec;
}

interface Stroke {
  pts: Vec[];
  color: string;
  width: number;
  dash?: [number, number];
  layer: number;
  unit: number;
  order: number;
}

interface Builder {
  faces: Face[];
  strokes: Stroke[];
  extras: { layer: number; unit: number; order: number; svg: (P: Projector, k: number, ox: number, oy: number) => string }[];
}

// ------------------------------------------------------------------ 동체

interface Section {
  zc: number;
  a: number;
  b: number;
  /** 위쪽만 더 부푼 높이 (747 2층 혹) */
  up: number;
}

function fuselageSection(s: PlaneShape): (u: number) => Section {
  const L = s.len;
  const R = s.dia / 2;
  const H = R * (s.tall ?? 1.04);
  const ln = (s.noseLen ?? (s.sst ? 5.2 : 1.6)) * s.dia;
  const lt = (s.tailLen ?? (s.sst ? 2.2 : 2.7)) * s.dia;
  const humpEnd = (s.hump ?? 0) * L;
  return (u) => {
    let top = H;
    let bot = -H;
    let a = R;
    if (u < ln) {
      const t = clamp(u / ln, 0, 1);
      if (s.sst) {
        const k = Math.pow(t, 0.62);
        a = R * k;
        const tipZ = -0.35 * H;
        top = lerp(tipZ, H, Math.pow(t, 0.58));
        bot = lerp(tipZ, -H, Math.pow(t, 0.7));
      } else {
        a = R * Math.sqrt(1 - (1 - t) ** 2.15);
        const tipZ = -0.22 * H;
        top = lerp(tipZ, H, Math.pow(1 - (1 - t) ** 1.9, 0.62));
        bot = lerp(tipZ, -H, Math.sqrt(1 - (1 - t) ** 2.6));
      }
    }
    if (u > L - lt) {
      const t = clamp((L - u) / lt, 0, 1);
      const e = 1 - (1 - t) ** 1.7;
      a = R * lerp(0.09, 1, Math.pow(t, 0.8));
      top = lerp(H * 0.42, H, Math.pow(e, 0.45));
      bot = lerp(H * 0.14, -H, Math.pow(t, 0.72));
    }
    let up = 0;
    if (humpEnd > 0) up = smooth(0.012 * L, 0.11 * L, u) * (1 - smooth(humpEnd - 0.12 * L, humpEnd, u)) * H * 0.5;
    return { zc: (top + bot) / 2, a, b: (top - bot) / 2, up };
  };
}

const RING = 24;

function fuselage(B: Builder, s: PlaneShape, sec: (u: number) => Section, liv: Livery) {
  const L = s.len;
  const ln = (s.noseLen ?? (s.sst ? 5.2 : 1.6)) * s.dia;
  const lt = (s.tailLen ?? (s.sst ? 2.2 : 2.7)) * s.dia;
  const us: number[] = [];
  for (let i = 0; i <= 12; i++) us.push(ln * Math.pow(i / 12, 1.7));
  const mid = Math.max(2, Math.ceil((L - ln - lt) / (s.dia * 0.8)));
  for (let i = 1; i < mid; i++) us.push(ln + ((L - ln - lt) * i) / mid);
  for (let i = 0; i <= 9; i++) us.push(L - lt + lt * (i / 9));
  if (s.hump) for (const f of [0.03, 0.05, 0.07, 0.09, 0.11, s.hump - 0.08, s.hump - 0.05, s.hump - 0.02]) us.push(f * L);
  us.sort((p, q) => p - q);
  const stations = us.filter((u, i) => i === 0 || u - us[i - 1] > 0.02);
  const ring = (u: number): Vec[] => {
    const c = sec(u);
    return Array.from({ length: RING }, (_, j) => {
      const th = (2 * Math.PI * j) / RING;
      const sn = Math.sin(th);
      return [-u, c.a * Math.cos(th), c.zc + (sn > 0 ? c.b + c.up : c.b) * sn] as Vec;
    });
  };
  const body = hex(liv.body);
  const belly = hex(liv.belly);
  let prev = ring(stations[0]);
  for (let i = 1; i < stations.length; i++) {
    const cur = ring(stations[i]);
    const uMid = (stations[i - 1] + stations[i]) / 2;
    const c = sec(uMid);
    for (let j = 0; j < RING; j++) {
      const j2 = (j + 1) % RING;
      const thMid = (2 * Math.PI * (j + 0.5)) / RING;
      const lower = Math.sin(thMid) < -0.62;
      const pts = [prev[j], prev[j2], cur[j2], cur[j]];
      const degenerate = Math.hypot(...sub(prev[j], prev[j2])) < 1e-6;
      B.faces.push({
        pts: degenerate ? [prev[j], cur[j2], cur[j]] : pts,
        color: lower ? belly : body,
        layer: 10,
        unit: 0,
        order: 0,
        cull: true,
        inside: [-uMid, 0, c.zc],
      });
    }
    prev = cur;
  }
  // 꼬리 끝 (보조 동력 배기구)
  B.faces.push({ pts: [...prev].reverse(), color: hex('#9aa4b0'), layer: 10, unit: 0, order: 0, cull: true, inside: [-L + 1, 0, sec(L).zc] });
}

/** 동체 겉면 위 한 점: 높이 z를 주면 그 높이의 왼쪽 옆면, side=-1이면 오른쪽 */
function surfaceAt(sec: (u: number) => Section, u: number, z: number, lift = 1.01, side = 1): Vec {
  const c = sec(u);
  const bz = z > c.zc ? c.b + c.up : c.b;
  const sn = clamp((z - c.zc) / bz, -1, 1);
  const cs = Math.sqrt(1 - sn * sn);
  return [-u, side * c.a * cs * lift, c.zc + bz * sn * lift];
}

function surfaceTheta(sec: (u: number) => Section, u: number, th: number, lift = 1.012): Vec {
  const c = sec(u);
  const sn = Math.sin(th);
  return [-u, c.a * Math.cos(th) * lift, c.zc + (sn > 0 ? c.b + c.up : c.b) * sn * lift];
}

/** 동체에 칠한 무늬 (조종석 창, 줄무늬) */
function decals(B: Builder, s: PlaneShape, sec: (u: number) => Section, liv: Livery) {
  const L = s.len;
  const R = s.dia / 2;
  const H = R * (s.tall ?? 1.04);
  const ln = (s.noseLen ?? (s.sst ? 5.2 : 1.6)) * s.dia;
  const lt = (s.tailLen ?? (s.sst ? 2.2 : 2.7)) * s.dia;
  // 줄무늬: 창문 바로 아래, 앞에서 뒤로
  const cheat = hex(liv.cheat);
  const twoDeck = (s.windows ?? s.decks ?? 1) >= 2;
  const cz0 = twoDeck ? -0.46 * H : -0.16 * H;
  const cz1 = twoDeck ? -0.32 * H : 0.02 * H;
  const u0 = ln * 0.75;
  const u1 = L - lt * 0.35;
  const n = Math.max(12, Math.round((u1 - u0) / (s.dia * 0.5)));
  for (const side of [1, -1]) {
    for (let i = 0; i < n; i++) {
      const ua = lerp(u0, u1, i / n);
      const ub = lerp(u0, u1, (i + 1) / n);
      const taperA = 1 - smooth(L - lt * 0.9, u1, ua) * 0.85;
      const taperB = 1 - smooth(L - lt * 0.9, u1, ub) * 0.85;
      const midZ = (cz0 + cz1) / 2;
      const hA = ((cz1 - cz0) / 2) * taperA;
      const hB = ((cz1 - cz0) / 2) * taperB;
      const za = (k: number) => sec(ua).zc - sec(0.5 * L).zc + midZ + k;
      const zb = (k: number) => sec(ub).zc - sec(0.5 * L).zc + midZ + k;
      const pts: Vec[] = [surfaceAt(sec, ua, za(-hA), 1.012, side), surfaceAt(sec, ub, zb(-hB), 1.012, side), surfaceAt(sec, ub, zb(hB), 1.012, side), surfaceAt(sec, ua, za(hA), 1.012, side)];
      if (side < 0) pts.reverse();
      B.faces.push({ pts, color: cheat, layer: 11, unit: 0, order: 0, cull: true, inside: [-(ua + ub) / 2, 0, sec((ua + ub) / 2).zc] });
    }
  }
  // 조종석 창
  const glass = hex('#1b2633');
  const cockpit = (uA: number, uB: number, thA: number, thB: number, steps: number) => {
    for (let k = 0; k < steps; k++) {
      const ta = lerp(thA, thB, k / steps);
      const tb = lerp(thA, thB, (k + 1) / steps);
      const slant = (th: number) => Math.abs(Math.cos(th)) * (uB - uA) * 0.35;
      const pts: Vec[] = [surfaceTheta(sec, uA + slant(ta), ta), surfaceTheta(sec, uB, ta), surfaceTheta(sec, uB, tb), surfaceTheta(sec, uA + slant(tb), tb)];
      B.faces.push({ pts, color: glass, layer: 11, unit: 1, order: 0, cull: true, inside: [-(uA + uB) / 2, 0, sec((uA + uB) / 2).zc] });
    }
  };
  if (s.sst) {
    cockpit(ln * 0.8, ln * 0.86, rad(28), rad(152), 10);
  } else if (s.hump) {
    cockpit(L * 0.043, L * 0.056, rad(44), rad(136), 12);
    cockpit(L * 0.058, L * 0.066, rad(46), rad(62), 2);
    cockpit(L * 0.058, L * 0.066, rad(118), rad(134), 2);
  } else {
    const ua = ln * (s.hump ? 0.22 : 0.47);
    const ub = ln * (s.hump ? 0.3 : 0.6);
    cockpit(ua, ub, rad(24), rad(156), 14);
    // 옆 창
    cockpit(ub + 0.05, ub + (ub - ua) * 0.75, rad(28), rad(48), 2);
    cockpit(ub + 0.05, ub + (ub - ua) * 0.75, rad(132), rad(152), 2);
  }
  // 손님 창문: 점선
  const win = s.windows ?? s.decks ?? 1;
  const winRow = (z: number, uA: number, uB: number) => {
    const pts: Vec[] = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const u = lerp(uA, uB, i / steps);
      pts.push(surfaceAt(sec, u, z + sec(u).zc - sec(0.5 * L).zc, 1.015));
    }
    B.strokes.push({ pts, color: liv.window, width: 0.3, dash: [0.27, 0.27], layer: 11, unit: 2, order: 0 });
  };
  const wz = 0.24 * H;
  const wu0 = s.sst ? ln * 1.0 : ln * 1.05;
  const wu1 = L - lt * (s.sst ? 0.8 : 0.72);
  if (win >= 2) {
    winRow(-0.18 * H, wu0 + 0.5, wu1);
    winRow(0.5 * H, wu0 + 1.5, wu1 - lt * 0.1);
  } else {
    winRow(wz, wu0, wu1);
  }
  if (s.hump) {
    const pts: Vec[] = [];
    const uA = s.len * 0.075;
    const uB = s.len * (s.hump - 0.04);
    for (let i = 0; i <= 12; i++) {
      const u = lerp(uA, uB, i / 12);
      const c = sec(u);
      pts.push(surfaceAt(sec, u, c.zc + c.b * 0.92 + c.up * 0.75, 1.015));
    }
    B.strokes.push({ pts, color: liv.window, width: 0.3, dash: [0.27, 0.27], layer: 11, unit: 2, order: 0 });
  }
  // 문 테두리 (앞·뒤)
  const door = (u: number) => {
    const c = sec(u);
    const zA = c.zc - 0.32 * c.b;
    const zB = c.zc + 0.45 * c.b;
    const w = 1.0;
    const pts: Vec[] = [surfaceAt(sec, u, zA, 1.016), surfaceAt(sec, u + w, zA, 1.016), surfaceAt(sec, u + w, zB, 1.016), surfaceAt(sec, u, zB, 1.016), surfaceAt(sec, u, zA, 1.016)];
    B.strokes.push({ pts, color: '#9aa6b4', width: 0.07, layer: 11, unit: 3, order: 0 });
  };
  if (!s.sst) {
    door(ln * 1.0);
    door(L - lt * 1.0);
    if (s.len > 45) door(s.len * 0.36);
  }
}

// ------------------------------------------------------------------ 날개 (얇은 판을 이어 붙인다)

interface WingStation {
  /** 앞전 점 */
  le: Vec;
  /** 뒷전 점 */
  te: Vec;
  /** 두께 (m) */
  t: number;
}

const FOIL_UP: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.025, 0.42],
  [0.12, 0.55],
  [0.35, 0.56],
  [0.68, 0.38],
  [1, 0.05],
];
const FOIL_LO: readonly (readonly [number, number])[] = [
  [1, -0.02],
  [0.68, -0.2],
  [0.35, -0.38],
  [0.12, -0.36],
  [0.025, -0.24],
];

/** 두께 방향 n으로 단면을 붙여 판을 만든다 */
function loft(B: Builder, st: readonly WingStation[], n: Vec, color: Rgb, layer: number, unit: number, opts: { capEnd?: boolean; capStart?: boolean; flatFoil?: boolean } = {}) {
  const foil = opts.flatFoil
    ? ([
        [0, 0],
        [0.15, 0.5],
        [0.85, 0.5],
        [1, 0],
        [0.85, -0.5],
        [0.15, -0.5],
      ] as const)
    : [...FOIL_UP, ...FOIL_LO];
  const at = (w: WingStation, c: number, k: number): Vec => add(lerpV(w.le, w.te, c), mul(n, k * w.t));
  for (let i = 0; i + 1 < st.length; i++) {
    const A = st[i];
    const Bs = st[i + 1];
    const pa = foil.map(([c, k]) => at(A, c, k));
    const pb = foil.map(([c, k]) => at(Bs, c, k));
    const inside = centroid([...pa, ...pb]);
    for (let j = 0; j < foil.length; j++) {
      const j2 = (j + 1) % foil.length;
      B.faces.push({ pts: [pa[j], pa[j2], pb[j2], pb[j]], color, layer, unit, order: 0, cull: true, inside });
    }
    if (i === 0 && opts.capStart) B.faces.push({ pts: [...pa], color, layer, unit, order: 0, cull: true, inside });
    if (i + 2 === st.length && opts.capEnd !== false) B.faces.push({ pts: [...pb], color, layer, unit, order: 0, cull: true, inside });
  }
}

interface WingGeom {
  semi: number;
  /** y 자리에서 앞전 x */
  leX: (y: number) => number;
  /** y 자리에서 날개 높이 */
  zAt: (y: number) => number;
  chord: (y: number) => number;
  t: (y: number) => number;
  /** 동체와 만나는 y */
  y0: number;
}

function wingGeometry(s: PlaneShape, sec: (u: number) => Section): WingGeom {
  const L = s.len;
  const semi = s.span / 2;
  const R = s.dia / 2;
  const H = R * (s.tall ?? 1.04);
  if (s.planform) {
    const pf = s.planform;
    const ys = pf.map((p) => p[0] * semi);
    const pick = (y: number, k: 1 | 2) => {
      for (let i = 1; i < pf.length; i++) {
        if (y <= ys[i] || i === pf.length - 1) {
          const t = clamp((y - ys[i - 1]) / (ys[i] - ys[i - 1]), 0, 1);
          return -lerp(pf[i - 1][k], pf[i][k], t) * L;
        }
      }
      return -pf[pf.length - 1][k] * L;
    };
    const zRoot = sec(0.6 * L).zc - 0.55 * H;
    return {
      semi,
      leX: (y) => pick(y, 1),
      chord: (y) => pick(y, 1) - pick(y, 2),
      zAt: (y) => zRoot + y * Math.tan(rad(s.dihedral ?? 0)),
      t: (y) => (pick(y, 1) - pick(y, 2)) * 0.035,
      y0: ys[0],
    };
  }
  const AR = s.ar ?? 8.5;
  const lam = s.taper ?? 0.28;
  const area = (s.span * s.span) / AR;
  const cr = (2 * area) / (s.span * (1 + lam));
  const ct = cr * lam;
  const tanLE = Math.tan(rad(s.sweep)) + (cr - ct) / (4 * semi);
  const ymac = (semi / 3) * ((1 + 2 * lam) / (1 + lam));
  const cmac = ((2 / 3) * cr * (1 + lam + lam * lam)) / (1 + lam);
  const rear = !!s.eng.rear;
  const pos = s.pos ?? (rear ? 0.55 : s.high ? 0.47 : 0.46);
  const xLE0 = -pos * L + 0.25 * cmac + ymac * tanLE;
  const uMid = -xLE0 + cr * 0.5;
  const c = sec(uMid);
  const zRoot = s.high ? c.zc + c.b * 0.93 : c.zc - c.b * 0.6;
  const dih = rad(s.dihedral ?? (s.high ? 1.5 : 5.5));
  const baseChord = (y: number) => cr - ((cr - ct) * y) / semi;
  const teBase = (y: number) => xLE0 - y * tanLE - baseChord(y);
  const yk = 0.34 * semi;
  const crank = s.crank ?? (!rear && !s.high && !s.sst);
  const leX = (y: number) => xLE0 - y * tanLE;
  const teX = (y: number) => (crank && y < yk ? Math.min(teBase(y), teBase(yk)) : teBase(y));
  const zN = (z: number) => (z - c.zc) / c.b;
  const y0 = c.a * Math.sqrt(Math.max(0, 1 - zN(zRoot) ** 2)) * 0.97;
  return {
    semi,
    leX,
    chord: (y) => leX(y) - teX(y),
    zAt: (y) => zRoot + Math.max(0, y - y0) * Math.tan(dih),
    t: (y) => (leX(y) - teX(y)) * (0.12 - 0.025 * (y / semi)),
    y0,
  };
}

function wings(B: Builder, s: PlaneShape, g: WingGeom, liv: Livery) {
  const color = hex('#d9e0e8');
  const semi = g.semi;
  const raked = s.tip === 'raked';
  const ys = s.planform ? s.planform.map((p) => p[0] * semi) : [g.y0, ...(s.crank ?? (!s.eng.rear && !s.high && !s.sst) ? [0.34 * semi] : []), 0.62 * semi, raked ? 0.9 * semi : semi];
  if (s.planform) ys[0] = Math.max(ys[0], g.y0);
  for (const side of [1, -1]) {
    const st: WingStation[] = ys.map((y) => ({ le: [g.leX(y), side * y, g.zAt(y)], te: [g.leX(y) - g.chord(y), side * y, g.zAt(y)], t: g.t(y) }));
    if (raked) {
      const yT = semi;
      const prevC = g.chord(0.9 * semi);
      const le: Vec = [g.leX(0.9 * semi) - prevC * 0.62, side * yT, g.zAt(yT)];
      st.push({ le, te: [g.leX(0.9 * semi) - prevC * 0.98, side * yT, g.zAt(yT)], t: g.t(yT) * 0.5 });
    }
    const layer = side > 0 ? 31 : 1;
    loft(B, st, [0, 0, 1], color, layer, 0);
    // 날개 끝 장치
    const tipSt = st[st.length - 1];
    const tc = tipSt.le[0] - tipSt.te[0];
    const winglet = (h: number, cant: number, sweepBack: number, rootK: number, tipK: number, down = false) => {
      const dz = down ? -1 : 1;
      const out = Math.sin(rad(cant)) * h * side;
      const upz = Math.cos(rad(cant)) * h * dz;
      const root: WingStation = { le: add(tipSt.le, [-tc * (1 - rootK) * 0.5, 0, 0]), te: tipSt.te, t: tipSt.t * 0.8 };
      const tipLe: Vec = add(root.le, [-sweepBack, out, upz]);
      const tipW: WingStation = { le: tipLe, te: add(tipLe, [-tc * tipK, 0, 0]), t: tipSt.t * 0.45 };
      loft(B, [root, tipW], [0, side, 0], color, layer, 1, { flatFoil: true });
    };
    const h = s.tipH ?? 2.3;
    switch (s.tip) {
      case 'fence':
        winglet(h * 0.55, 0, h * 0.5, 0.75, 0.25);
        winglet(h * 0.35, 0, h * 0.25, 0.6, 0.25, true);
        break;
      case 'winglet':
        winglet(h, 18, h * 0.7, 0.85, 0.35);
        break;
      case 'blended':
        winglet(h, 14, h * 0.55, 0.95, 0.3);
        break;
      case 'sharklet':
        winglet(h, 12, h * 0.62, 0.95, 0.28);
        break;
      case 'curved': {
        winglet(h * 0.45, 62, h * 0.25, 1, 0.65);
        const prevLe = st[st.length - 1];
        void prevLe;
        winglet(h, 22, h * 0.75, 0.75, 0.22);
        break;
      }
      case 'split':
        winglet(h, 12, h * 0.62, 0.9, 0.25);
        winglet(h * 0.45, 25, h * 0.35, 0.6, 0.25, true);
        break;
      case 'updown':
        winglet(h, 10, h * 0.6, 0.8, 0.3);
        winglet(h * 0.4, 20, h * 0.3, 0.55, 0.3, true);
        break;
      default:
        break;
    }
  }
  void liv;
}

// ------------------------------------------------------------------ 꼬리날개

interface TailGeom {
  /** 수직 꼬리 뿌리·끝 */
  finRootLe: number;
  finRootZ: number;
  finTipLe: number;
  finTipZ: number;
  finRootC: number;
  finTipC: number;
}

function tails(B: Builder, s: PlaneShape, sec: (u: number) => Section, liv: Livery): TailGeom {
  const L = s.len;
  const lt = (s.tailLen ?? (s.sst ? 2.2 : 2.7)) * s.dia;
  const finH = s.finH ?? s.dia * (s.tail === 't' ? 1.45 : s.dia > 4.5 ? 1.55 : 1.7);
  const tT = s.tail === 't';
  const rootC = finH * (tT ? 1.3 : s.sst ? 2.3 : 1.12);
  const tipC = rootC * (tT ? 0.62 : 0.34);
  const sweep = rad(tT ? 44 : s.sst ? 52 : 40);
  const rootTe = -(L - (s.sst ? lt * 0.06 : lt * 0.08));
  const rootLe = rootTe + rootC;
  const uRoot = -(rootLe + rootTe) / 2;
  const cs = sec(uRoot);
  const rootZ = cs.zc + cs.b * 0.82;
  const tipLe = rootLe - finH * Math.tan(sweep);
  const tipZ = rootZ + finH;
  const tailColor = hex(liv.tail);
  const finSt: WingStation[] = [
    { le: [rootLe, 0, rootZ], te: [rootTe, 0, rootZ], t: rootC * 0.11 },
    { le: [tipLe, 0, tipZ], te: [tipLe - tipC, 0, tipZ], t: tipC * 0.1 },
  ];
  loft(B, finSt, [0, 1, 0], tailColor, 20, 0, {});
  // 꼬리 모양 무늬 (회사)
  if (liv.logo) {
    const cx = lerp(rootLe - rootC * 0.5, tipLe - tipC * 0.5, 0.5);
    const cz = lerp(rootZ, tipZ, 0.52);
    const r = Math.min(finH * 0.22, lerp(rootC, tipC, 0.5) * 0.28);
    const logo = liv.logo;
    const color = liv.logoColor ?? '#fff';
    const yOff = rootC * 0.06;
    B.extras.push({
      layer: 20,
      unit: 5,
      order: 0,
      svg: (P, k, ox, oy) => {
        const o = P([cx, yOff, cz]);
        const ex = P([cx - 1, yOff, cz]);
        const ez = P([cx, yOff, cz + 1]);
        // 꼬리 날개 왼쪽 면이 보일 때만
        const nW = P.dir([0, 1, 0]);
        if (dot(nW, P.view) <= 0) return '';
        const m = [(ex[0] - o[0]) * k, (ex[1] - o[1]) * k, (ez[0] - o[0]) * k, (ez[1] - o[1]) * k, o[0] * k + ox, o[1] * k + oy];
        return `<path transform="matrix(${m.map((v) => v.toFixed(3)).join(' ')})" d="${shapePath(logo, r)}" fill="${color}"/>`;
      },
    });
  }
  // 수평 꼬리날개
  if (s.tail !== 'none') {
    const bh = s.span * (s.stab ?? (s.high ? 0.3 : 0.37));
    const semiH = bh / 2;
    const cr = (2 * ((bh * bh) / 4.6)) / (bh * 1.38);
    const ct = cr * 0.38;
    const sw = rad(tT ? 34 : 33);
    let leRoot: number;
    let z: number;
    let y0: number;
    if (tT) {
      leRoot = tipLe + cr * 0.15;
      z = tipZ - 0.1;
      y0 = 0;
    } else if (s.tail === 'cross') {
      leRoot = lerp(rootLe, tipLe, 0.45) + cr * 0.1;
      z = lerp(rootZ, tipZ, 0.45);
      y0 = 0;
    } else {
      leRoot = rootLe + cr * 0.15;
      const c = sec(-leRoot + cr * 0.5);
      z = c.zc + c.b * 0.1;
      y0 = c.a * 0.85;
    }
    const dih = rad(tT ? -1 : 6);
    for (const side of [1, -1]) {
      const st: WingStation[] = [
        { le: [leRoot - y0 * Math.tan(sw), side * y0, z], te: [leRoot - y0 * Math.tan(sw) - cr, side * y0, z], t: cr * 0.1 },
        { le: [leRoot - semiH * Math.tan(sw), side * semiH, z + (semiH - y0) * Math.tan(dih)], te: [leRoot - semiH * Math.tan(sw) - ct, side * semiH, z + (semiH - y0) * Math.tan(dih)], t: ct * 0.1 },
      ];
      loft(B, st, [0, 0, 1], hex('#d9e0e8'), tT || s.tail === 'cross' ? 20 : side > 0 ? 32 : 2, tT || s.tail === 'cross' ? (side > 0 ? 3 : -3) : 0);
    }
  }
  return { finRootLe: rootLe, finRootZ: rootZ, finTipLe: tipLe, finTipZ: tipZ, finRootC: rootC, finTipC: tipC };
}

function shapePath(shape: ShapeKind, r: number): string {
  const f = (v: number) => v.toFixed(2);
  switch (shape) {
    case 'circle':
      return `M${f(-r * 0.85)} 0a${f(r * 0.85)} ${f(r * 0.85)} 0 1 0 ${f(r * 1.7)} 0a${f(r * 0.85)} ${f(r * 0.85)} 0 1 0 ${f(-r * 1.7)} 0Z`;
    case 'star':
      return (
        Array.from({ length: 10 }, (_, i) => {
          const a = rad(90 + i * 36);
          const rr = i % 2 === 0 ? r : r * 0.45;
          return `${i === 0 ? 'M' : 'L'}${f(rr * Math.cos(a))} ${f(rr * Math.sin(a))}`;
        }).join('') + 'Z'
      );
    case 'leaf': {
      const pts = (x: number, y: number) => {
        const a = rad(-35);
        return `${f(x * Math.cos(a) - y * Math.sin(a))} ${f(x * Math.sin(a) + y * Math.cos(a))}`;
      };
      return `M${pts(0, r)}C${pts(r * 0.95, r * 0.45)} ${pts(r * 0.95, -r * 0.45)} ${pts(0, -r)}C${pts(-r * 0.95, -r * 0.45)} ${pts(-r * 0.95, r * 0.45)} ${pts(0, r)}Z`;
    }
    case 'diamond':
      return `M0 ${f(r)}L${f(r * 0.75)} 0L0 ${f(-r)}L${f(-r * 0.75)} 0Z`;
  }
}

// ------------------------------------------------------------------ 엔진

/** 축이 x 방향인 회전체 (엔진 덮개) */
function nacelle(B: Builder, front: Vec, len: number, r: number, liv: Livery, layer: number, unit: number, opts: { slim?: boolean; flatBottom?: boolean; noIntake?: boolean } = {}) {
  const prof: readonly (readonly [number, number])[] = opts.slim
    ? [
        [0, 0.82],
        [0.05, 0.95],
        [0.2, 1],
        [0.6, 0.97],
        [0.85, 0.82],
        [1, 0.62],
      ]
    : [
        [0, 0.88],
        [0.05, 0.98],
        [0.18, 1],
        [0.45, 0.97],
        [0.72, 0.84],
        [0.9, 0.7],
        [1, 0.6],
      ];
  const N = 16;
  const ring = (k: number): Vec[] =>
    Array.from({ length: N }, (_, j) => {
      const th = (2 * Math.PI * j) / N;
      const rr = r * prof[k][1];
      const zf = opts.flatBottom && Math.sin(th) < 0 ? 0.82 : 1;
      return [front[0] - len * prof[k][0], front[1] + rr * Math.cos(th), front[2] + rr * Math.sin(th) * zf] as Vec;
    });
  const eng = hex(liv.engine);
  const lip = hex('#eef2f6');
  let prev = ring(0);
  const first = prev;
  for (let k = 1; k < prof.length; k++) {
    const cur = ring(k);
    const inside: Vec = [front[0] - len * (prof[k - 1][0] + prof[k][0]) * 0.5, front[1], front[2]];
    for (let j = 0; j < N; j++) {
      const j2 = (j + 1) % N;
      B.faces.push({ pts: [prev[j], prev[j2], cur[j2], cur[j]], color: k === 1 ? lip : eng, layer, unit, order: 0, cull: true, inside });
    }
    prev = cur;
  }
  B.faces.push({ pts: [...prev], color: hex('#59626e'), layer, unit, order: 0, cull: true, inside: add(front, [-len * 0.5, 0, 0]) });
  if (!opts.noIntake) {
    // 공기 흡입구: 어두운 원 + 가운데 팬
    B.faces.push({ pts: [...first].reverse(), color: hex('#232a33'), layer, unit, order: 1, cull: true, flat: true, inside: add(front, [-len * 0.5, 0, 0]) });
    const fan: Vec[] = Array.from({ length: 10 }, (_, j) => {
      const th = (2 * Math.PI * j) / 10;
      return [front[0] - 0.05, front[1] + r * 0.62 * Math.cos(th), front[2] + r * 0.62 * Math.sin(th)] as Vec;
    });
    B.faces.push({ pts: fan.reverse(), color: hex('#4a525d'), layer, unit, order: 2, cull: true, flat: true, inside: add(front, [-len, 0, 0]) });
    const spin: Vec[] = Array.from({ length: 8 }, (_, j) => {
      const th = (2 * Math.PI * j) / 8;
      return [front[0] - 0.02, front[1] + r * 0.18 * Math.cos(th), front[2] + r * 0.18 * Math.sin(th)] as Vec;
    });
    B.faces.push({ pts: spin.reverse(), color: hex('#b8c0ca'), layer, unit, order: 3, cull: true, flat: true, inside: add(front, [-len, 0, 0]) });
  }
}

/** 상자 (기둥·엔진 상자) */
function box(B: Builder, c0: Vec, c1: Vec, color: Rgb, layer: number, unit: number, order = 0) {
  const [x0, y0, z0] = c0;
  const [x1, y1, z1] = c1;
  const v: Vec[] = [
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y1, z0],
    [x0, y1, z0],
    [x0, y0, z1],
    [x1, y0, z1],
    [x1, y1, z1],
    [x0, y1, z1],
  ];
  const inside = centroid(v);
  const quads = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [2, 3, 7, 6],
    [1, 2, 6, 5],
    [0, 3, 7, 4],
  ];
  for (const q of quads) B.faces.push({ pts: q.map((i) => v[i]), color, layer, unit, order, cull: true, inside });
}

function engines(B: Builder, s: PlaneShape, sec: (u: number) => Section, g: WingGeom, tail: TailGeom, liv: Livery) {
  const e = s.eng;
  const r = e.d / 2;
  const L = s.len;
  const lt = (s.tailLen ?? (s.sst ? 2.2 : 2.7)) * s.dia;
  const pylon = hex('#d8dee5');
  for (const side of [1, -1]) {
    const near = side > 0;
    for (const [k, eta] of (e.wing ?? []).entries()) {
      const y = eta * g.semi;
      const le = g.leX(y);
      const zw = g.zAt(y) - g.t(y) * 0.35;
      const front: Vec = e.slim ? [le + e.l * 0.32, side * y, zw - r * 0.95] : [le + e.l * 0.55, side * y, zw - r * 1.18];
      const unit = near ? 10 + k : 10 - k;
      nacelle(B, front, e.l, r, liv, near ? 30 : 0, unit, { slim: e.slim, flatBottom: !e.slim && e.d < 2.2 });
      box(B, [front[0] - e.l * 0.25, side * y - r * 0.12, front[2] + r * 0.6], [Math.min(front[0] - e.l * 1.02, le - g.chord(y) * 0.55), side * y + r * 0.12, zw], pylon, near ? 30 : 0, unit, -1);
    }
    if (e.rear) {
      const uF = L - lt * 1.18;
      const uM = uF + e.l * 0.5;
      const c = sec(uM);
      // 엔진 둘이면 옆으로 나란히 (Il-62)
      const ys = e.rear === 2 ? [c.a + r * 1.15, c.a + r * 3.3] : [c.a + r * 1.15];
      const z = c.zc + c.b * 0.38;
      ys.forEach((y, k) => {
        const front: Vec = [-uF, side * y, z];
        nacelle(B, front, e.l, r, liv, near ? 30 : 0, near ? 20 + k : -20 - k, { slim: true });
        box(B, [-uF - e.l * 0.3, side * c.a * 0.7, z - r * 0.18], [-uF - e.l * 0.75, side * (y - r * 0.8), z + r * 0.18], pylon, near ? 30 : 0, near ? 19 : -19);
      });
    }
    for (const [k, eta] of (e.prop ?? []).entries()) {
      const y = eta * g.semi;
      const le = g.leX(y);
      const c = g.chord(y);
      const zw = g.zAt(y);
      const front: Vec = s.high ? [le + c * 1.05, side * y, zw - r * 0.75] : [le + c * 0.9, side * y, zw + r * 0.1];
      const unit = near ? 10 + k : 10 - k;
      nacelle(B, front, c * 2.0, r, liv, near ? 30 : 0, unit, { noIntake: true });
      // 프로펠러 원판 (돌고 있어 흐릿하게)
      const pr = (e.propD ?? 3.9) / 2;
      const disc: Vec[] = Array.from({ length: 24 }, (_, j) => {
        const th = (2 * Math.PI * j) / 24;
        return [front[0] + 0.25, front[1] + pr * Math.cos(th), front[2] + pr * Math.sin(th)] as Vec;
      });
      B.faces.push({ pts: disc, color: hex('#8792a0'), layer: near ? 33 : 3, unit, order: 0, cull: false, flat: true, opacity: 0.28 });
      const blades = 6;
      for (let bI = 0; bI < blades; bI++) {
        const th = rad(20 + (360 / blades) * bI);
        const w = rad(4);
        const p0: Vec = [front[0] + 0.3, front[1] + 0.25 * Math.cos(th - w * 3), front[2] + 0.25 * Math.sin(th - w * 3)];
        const p1: Vec = [front[0] + 0.3, front[1] + pr * Math.cos(th - w), front[2] + pr * Math.sin(th - w)];
        const p2: Vec = [front[0] + 0.3, front[1] + pr * Math.cos(th + w), front[2] + pr * Math.sin(th + w)];
        const p3: Vec = [front[0] + 0.3, front[1] + 0.25 * Math.cos(th + w * 3), front[2] + 0.25 * Math.sin(th + w * 3)];
        B.faces.push({ pts: [p0, p1, p2, p3], color: hex('#3c4450'), layer: near ? 33 : 3, unit, order: 1, cull: false, flat: true, opacity: 0.35 });
      }
      const spin: Vec[] = Array.from({ length: 10 }, (_, j) => {
        const th = (2 * Math.PI * j) / 10;
        return [front[0] + 0.32, front[1] + r * 0.4 * Math.cos(th), front[2] + r * 0.4 * Math.sin(th)] as Vec;
      });
      B.faces.push({ pts: spin, color: hex(liv.engine), layer: near ? 33 : 3, unit, order: 2, cull: false });
    }
  }
  if (e.box) {
    // 콩코드: 날개 아래 엔진 상자 둘 (한 상자에 엔진 둘)
    for (const side of [1, -1]) {
      const yIn = g.semi * 0.2;
      const yOut = g.semi * 0.47;
      const uF = L * 0.6;
      const uB = L * 0.83;
      const zTop = g.zAt((yIn + yOut) / 2) - 0.05;
      const zBot = zTop - e.d;
      const near = side > 0;
      box(B, [-uF, side * yIn, zBot], [-uB, side * yOut, zTop], hex(liv.engine), near ? 30 : 0, near ? 10 : -10);
      // 흡입구 두 개
      for (const [a, b] of [
        [0.06, 0.47],
        [0.53, 0.94],
      ]) {
        const yA = side * lerp(yIn, yOut, a);
        const yB = side * lerp(yIn, yOut, b);
        const pts: Vec[] = [
          [-uF + 0.02, yA, zBot + 0.12],
          [-uF + 0.02, yB, zBot + 0.12],
          [-uF + 0.02, yB, zTop - 0.12],
          [-uF + 0.02, yA, zTop - 0.12],
        ];
        B.faces.push({ pts: side > 0 ? pts : [...pts].reverse(), color: hex('#232a33'), layer: near ? 30 : 0, unit: near ? 10 : -10, order: 2, cull: false, flat: true });
      }
    }
  }
  if (e.center === 'sduct') {
    const uF = -tail.finRootLe - e.d * 0.6;
    const c = sec(uF + e.d);
    const front: Vec = [-uF, 0, c.zc + c.b * 0.78];
    nacelle(B, front, -tail.finRootLe - tail.finRootC - uF + 0.6 + (L + tail.finRootLe + tail.finRootC) * 0.5, r * 0.95, liv, 20, 1, { slim: true });
  } else if (e.center === 'fin') {
    const uF = -tail.finRootLe + e.l * 0.05;
    const c = sec(uF + e.l * 0.5);
    const front: Vec = [-uF, 0, c.zc + c.b + r * 1.7];
    nacelle(B, front, e.l * 1.15, r, liv, 20, 2, {});
  }
}

// ------------------------------------------------------------------ 그리기

function shadeColor(base: Rgb, n: Vec, P: Projector, flat: boolean): Rgb {
  if (flat) return base;
  const Lw = norm([-0.35, 0.9, 0.55]);
  const d = Math.max(0, dot(n, Lw));
  const back = Math.max(0, -dot(n, Lw));
  // 반사광
  const h = norm(add(Lw, P.view));
  const spec = Math.pow(Math.max(0, dot(n, h)), 24) * 0.22;
  const k = 0.52 + 0.48 * d - 0.08 * back;
  // 그늘은 살짝 파랗게
  const tint: Rgb = [0.94 + 0.06 * d, 0.96 + 0.04 * d, 1];
  return [0, 1, 2].map((i) => clamp(base[i] * k * tint[i] + 255 * spec, 0, 255)) as unknown as Rgb;
}

const toHex = (c: Rgb) => '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

export interface RenderOptions {
  width?: number;
  height?: number;
  /** 가장자리 여백 비율 */
  pad?: number;
  camera?: Camera;
}

/** 기종 모양 + 칠 → SVG 글 */
export function renderPlaneSvg(s: PlaneShape, liv: Livery, opts: RenderOptions = {}): string {
  const W = opts.width ?? 400;
  const Hh = opts.height ?? 225;
  const pad = opts.pad ?? 0.06;
  const P = projector(opts.camera ?? DEFAULT_CAMERA);
  const B: Builder = { faces: [], strokes: [], extras: [] };
  const sec = fuselageSection(s);
  fuselage(B, s, sec, liv);
  decals(B, s, sec, liv);
  const g = wingGeometry(s, sec);
  wings(B, s, g, liv);
  const tail = tails(B, s, sec, liv);
  engines(B, s, sec, g, tail, liv);

  // 화면에 비춘 면들
  type Item = { kind: 'face'; f: Face; pts: [number, number][]; depth: number; fill: string; opacity?: number } | { kind: 'stroke'; s: Stroke; pts: [number, number][]; depth: number } | { kind: 'extra'; e: Builder['extras'][number]; depth: number };
  const items: (Item & { layer: number; unit: number; order: number })[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  for (const f of B.faces) {
    let n = P.dir(newell(f.pts));
    if (f.inside) {
      const out = P.dir(sub(centroid(f.pts), f.inside));
      if (dot(n, out) < 0) n = mul(n, -1) as Vec;
    }
    if (f.cull && dot(n, P.view) <= 0.002) continue;
    const pr = f.pts.map((p) => P(p));
    const depth = pr.reduce((acc, p) => acc + p[2], 0) / pr.length;
    const pts = pr.map((p) => [p[0], p[1]] as [number, number]);
    for (const [x, y] of pts) grow(x, y);
    items.push({ kind: 'face', f, pts, depth, fill: toHex(shadeColor(f.color, n, P, !!f.flat)), opacity: f.opacity, layer: f.layer, unit: f.unit, order: f.order });
  }
  for (const st of B.strokes) {
    const pr = st.pts.map((p) => P(p));
    items.push({ kind: 'stroke', s: st, pts: pr.map((p) => [p[0], p[1]]), depth: 0, layer: st.layer, unit: st.unit, order: st.order });
  }
  for (const e of B.extras) items.push({ kind: 'extra', e, depth: 0, layer: e.layer, unit: e.unit, order: e.order });
  items.sort((a, b) => a.layer - b.layer || a.unit - b.unit || a.order - b.order || a.depth - b.depth);

  const bw = maxX - minX;
  const bh = maxY - minY;
  const k = Math.min((W * (1 - 2 * pad)) / bw, (Hh * (1 - 2 * pad)) / bh);
  const ox = (W - bw * k) / 2 - minX * k;
  const oy = (Hh - bh * k) / 2 - minY * k;
  const fx = (v: number) => (Math.round(v * 10) / 10).toString();
  const out: string[] = [];
  let run: { fill: string; opacity?: number; d: string[] } | null = null;
  const flush = () => {
    if (!run) return;
    const op = run.opacity !== undefined ? ` fill-opacity="${run.opacity}"` : '';
    const stroke = run.opacity !== undefined ? '' : ` stroke="${run.fill}"`;
    out.push(`<path fill="${run.fill}"${stroke}${op} d="${run.d.join('')}"/>`);
    run = null;
  };
  for (const it of items) {
    if (it.kind === 'face') {
      const d = 'M' + it.pts.map(([x, y]) => `${fx(x * k + ox)} ${fx(y * k + oy)}`).join('L') + 'Z';
      if (run && run.fill === it.fill && run.opacity === it.opacity) run.d.push(d);
      else {
        flush();
        run = { fill: it.fill, opacity: it.opacity, d: [d] };
      }
    } else if (it.kind === 'stroke') {
      flush();
      const d = 'M' + it.pts.map(([x, y]) => `${fx(x * k + ox)} ${fx(y * k + oy)}`).join('L');
      const dash = it.s.dash ? ` stroke-dasharray="${fx(it.s.dash[0] * k * 0.9)} ${fx(it.s.dash[1] * k * 0.9)}"` : '';
      out.push(`<path fill="none" stroke="${it.s.color}" stroke-width="${fx(Math.max(0.5, it.s.width * k))}"${dash} d="${d}"/>`);
    } else {
      flush();
      out.push(it.e.svg(P, k, ox, oy));
    }
  }
  flush();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}"><g stroke-width="0.6" stroke-linejoin="round">${out.join('')}</g></svg>`;
}

/** <img src>에 바로 넣는 data URL */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
