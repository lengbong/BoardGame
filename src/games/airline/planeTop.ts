import { SHAPES } from './aircraftShapes';
import { FREIGHTER_SHAPES } from './freighterShapes';
import type { PlaneShape } from './plane3d';

/**
 * 위에서 내려다본 기종 모양 (공항 도면용, 가벼운 SVG 경로 몇 개).
 * 실제 길이·날개폭·동체 폭·후퇴각·가로세로비·엔진 자리로 그린다. 단위 m, 코가 +x, 가운데가 (0,0).
 * 3D 그림(plane3d)보다 훨씬 가벼워서 비행기 수십 대를 세워도 화면이 버벅거리지 않는다.
 */
export interface PlaneTop {
  len: number;
  span: number;
  /** 동체 */
  body: string;
  /** 날개 (주날개 + 수평 꼬리날개) */
  wings: string;
  /** 엔진 덮개·프로펠러 */
  engines: string;
  /** 수직 꼬리날개 (위에서 보면 가는 띠) — 회사 색 */
  fin: string;
  /** 동체 위 줄 — 회사 색 */
  crown: string;
}

const f = (v: number) => (Math.round(v * 10) / 10).toString();
const poly = (pts: [number, number][]) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z';
const mirror = (pts: [number, number][]) => [...pts, ...pts.map(([x, y]) => [x, -y] as [number, number]).reverse()];

function rect(x0: number, x1: number, y0: number, y1: number): string {
  return poly([
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]);
}

function build(s: PlaneShape): PlaneTop {
  const L = s.len;
  const r = s.dia / 2;
  const nose = L / 2;
  const tail = -L / 2;
  const ln = Math.min(L * 0.3, (s.noseLen ?? (s.sst ? 5.2 : 1.6)) * s.dia);
  const lt = Math.min(L * 0.35, (s.tailLen ?? (s.sst ? 2.2 : 2.7)) * s.dia);

  // 동체: 둥근 코, 곧은 몸통, 가늘어지는 꼬리
  const body =
    `M${f(nose)} 0` +
    `Q${f(nose - ln * 0.15)} ${f(-r)} ${f(nose - ln)} ${f(-r)}` +
    `L${f(tail + lt)} ${f(-r)}` +
    `L${f(tail)} ${f(-r * 0.22)}L${f(tail)} ${f(r * 0.22)}` +
    `L${f(tail + lt)} ${f(r)}` +
    `L${f(nose - ln)} ${f(r)}` +
    `Q${f(nose - ln * 0.15)} ${f(r)} ${f(nose)} 0Z`;

  const b = s.span / 2;
  const wingParts: string[] = [];
  const engParts: string[] = [];
  const rear = !!s.eng.rear;
  // 주날개
  let leAt: (y: number) => number = () => 0;
  if (s.planform && s.planform.length > 1) {
    const le = s.planform.map(([yf, lef]) => [nose - lef * L, yf * b] as [number, number]);
    const te = s.planform.map(([yf, , tef]) => [nose - tef * L, yf * b] as [number, number]).reverse();
    wingParts.push(poly(mirror([...le, ...te].map(([x, y]) => [x, -y] as [number, number]))));
    leAt = (y) => {
      const yf = y / b;
      const pf = s.planform!;
      for (let i = 1; i < pf.length; i++) {
        if (yf <= pf[i][0]) {
          const t = (yf - pf[i - 1][0]) / (pf[i][0] - pf[i - 1][0] || 1);
          return nose - (pf[i - 1][1] + (pf[i][1] - pf[i - 1][1]) * t) * L;
        }
      }
      return nose - pf[pf.length - 1][1] * L;
    };
  } else {
    const AR = s.ar ?? 8.5;
    const lam = s.taper ?? 0.28;
    const area = (s.span * s.span) / AR;
    const cr = (2 * area) / (s.span * (1 + lam));
    const ct = cr * lam;
    const pos = s.pos ?? (rear ? 0.55 : s.high ? 0.47 : 0.46);
    const qcRoot = nose - pos * L;
    const sw = Math.tan((s.sweep * Math.PI) / 180);
    const qcTip = qcRoot - b * sw;
    const leRoot = qcRoot + cr / 4;
    const teRoot = qcRoot - (3 * cr) / 4;
    const leTip = qcTip + ct / 4;
    const teTip = qcTip - (3 * ct) / 4;
    wingParts.push(
      poly(
        mirror([
          [leRoot, 0],
          [leTip, -b],
          [teTip, -b],
          [teRoot, 0],
        ]),
      ),
    );
    leAt = (y) => leRoot + ((leTip - leRoot) * y) / b;
  }
  // 수평 꼬리날개
  if (s.tail !== 'none') {
    const bh = (s.span * (s.stab ?? (s.high ? 0.3 : 0.37))) / 2;
    const crh = L * 0.1;
    const cth = crh * 0.38;
    const sw = Math.tan(((s.sweep + 4) * Math.PI) / 180);
    const teRoot = tail + L * (s.tail === 't' ? 0.015 : 0.03);
    const leRoot = teRoot + crh;
    const leTip = leRoot - bh * sw;
    wingParts.push(
      poly(
        mirror([
          [leRoot, 0],
          [leTip, -bh],
          [leTip - cth, -bh],
          [teRoot, 0],
        ]),
      ),
    );
  }
  // 엔진
  const d = s.eng.d;
  const l = Math.max(s.eng.l, d * 1.2);
  for (const frac of s.eng.wing ?? []) {
    const y = frac * b;
    const x0 = leAt(y) + l * 0.55;
    engParts.push(rect(x0 - l, x0, -y - d / 2, -y + d / 2), rect(x0 - l, x0, y - d / 2, y + d / 2));
  }
  for (const frac of s.eng.prop ?? []) {
    const y = frac * b;
    const x0 = leAt(y) + d * 1.6;
    const pd = (s.eng.propD ?? d * 3) / 2;
    engParts.push(rect(x0 - d * 3, x0, -y - d / 2, -y + d / 2), rect(x0 - d * 3, x0, y - d / 2, y + d / 2));
    engParts.push(rect(x0, x0 + 0.35, -y - pd, -y + pd), rect(x0, x0 + 0.35, y - pd, y + pd));
  }
  if (s.eng.rear) {
    const x1 = tail + L * 0.14 + l;
    const yo = r + d / 2 + 0.15;
    engParts.push(rect(x1 - l, x1, -yo - d / 2, -yo + d / 2), rect(x1 - l, x1, yo - d / 2, yo + d / 2));
  }
  if (s.eng.box) {
    const x1 = nose - L * 0.62;
    engParts.push(rect(x1 - L * 0.13, x1, -r * 2.6, -r * 0.9), rect(x1 - L * 0.13, x1, r * 0.9, r * 2.6));
  }
  // 수직 꼬리날개와 동체 위 줄
  const finW = Math.max(0.35, s.dia * 0.09);
  const finLen = L * (s.sst ? 0.2 : 0.15);
  const fin = rect(tail + L * 0.005, tail + finLen, -finW, finW);
  const crownW = s.dia * 0.13;
  const crown = rect(tail + lt * 0.9, nose - ln * 0.9, -crownW, crownW);
  return { len: L, span: s.span, body, wings: wingParts.join(''), engines: engParts.join(''), fin, crown };
}

const cache = new Map<string, PlaneTop | null>();

/** 기종의 위에서 본 모양 (기종마다 한 번만 만든다). 모르는 기종이면 null */
export function planeTop(model: string): PlaneTop | null {
  const hit = cache.get(model);
  if (hit !== undefined) return hit;
  const shape = SHAPES[model] ?? FREIGHTER_SHAPES[model];
  const top = shape ? build(shape) : null;
  cache.set(model, top);
  return top;
}
