import type { CardKind, CityDef, PlanDef, RouteColor, RouteDef, StampDef, TicketColor } from './types';

/**
 * 기차로 전국 일주 — 판 자료.
 * 도시 위치는 실제 지도를 바탕으로 하되, 기찻길이 잘 보이게 손으로 옮긴 그림 좌표다 (viewBox 0 0 620 820).
 */

export const MAP_W = 620;
export const MAP_H = 820;

export const CITIES: CityDef[] = [
  { id: 'seoul', name: '서울', x: 195, y: 160, label: 'n' },
  { id: 'incheon', name: '인천', x: 112, y: 190, label: 'w' },
  { id: 'chuncheon', name: '춘천', x: 315, y: 100, label: 'n' },
  { id: 'sokcho', name: '속초', x: 440, y: 55, label: 'w' },
  { id: 'gangneung', name: '강릉', x: 505, y: 150, label: 'e' },
  { id: 'donghae', name: '동해', x: 540, y: 237, label: 'e' },
  { id: 'wonju', name: '원주', x: 345, y: 210, label: 'n' },
  { id: 'seosan', name: '서산', x: 75, y: 290, label: 'w' },
  { id: 'cheonan', name: '천안', x: 195, y: 280, label: 'n' },
  { id: 'cheongju', name: '청주', x: 295, y: 300, label: 'n' },
  { id: 'daejeon', name: '대전', x: 255, y: 375, label: 'w' },
  { id: 'andong', name: '안동', x: 455, y: 310, label: 'n' },
  { id: 'gimcheon', name: '김천', x: 355, y: 410, label: 's' },
  { id: 'pohang', name: '포항', x: 565, y: 362, label: 'e' },
  { id: 'daegu', name: '대구', x: 450, y: 430, label: 'n' },
  { id: 'gyeongju', name: '경주', x: 545, y: 435, label: 'e' },
  { id: 'ulsan', name: '울산', x: 560, y: 510, label: 'e' },
  { id: 'busan', name: '부산', x: 495, y: 575, label: 's' },
  { id: 'gunsan', name: '군산', x: 110, y: 400, label: 'w' },
  { id: 'jeonju', name: '전주', x: 205, y: 450, label: 'n' },
  { id: 'jinju', name: '진주', x: 370, y: 525, label: 'n' },
  { id: 'gwangju', name: '광주', x: 150, y: 545, label: 'w' },
  { id: 'mokpo', name: '목포', x: 70, y: 615, label: 'w' },
  { id: 'yeosu', name: '여수', x: 290, y: 625, label: 's' },
  { id: 'tongyeong', name: '통영', x: 415, y: 625, label: 's' },
  { id: 'jeju', name: '제주', x: 180, y: 760, label: 'n' },
];

export const CITY: Record<string, CityDef> = Object.fromEntries(CITIES.map((c) => [c.id, c]));

/** 관광 도장 8곳 */
export const STAMPS: StampDef[] = [
  { city: 'seoul', name: '남산타워', icon: 'tower' },
  { city: 'sokcho', name: '설악산', icon: 'peak' },
  { city: 'gangneung', name: '바다', icon: 'wave' },
  { city: 'andong', name: '하회마을', icon: 'mask' },
  { city: 'gyeongju', name: '불국사', icon: 'temple' },
  { city: 'jeonju', name: '한옥마을', icon: 'hanok' },
  { city: 'busan', name: '해운대', icon: 'beach' },
  { city: 'jeju', name: '한라산', icon: 'volcano' },
];

export const STAMP_AT: Record<string, StampDef> = Object.fromEntries(STAMPS.map((s) => [s.city, s]));

/** 처음 도착한 사람의 큰 도장, 그 뒤로 온 사람의 작은 도장 */
export const STAMP_FIRST_POINTS = 3;
export const STAMP_LATER_POINTS = 1;

/** 기찻길 47개 (모두 한 줄짜리, 겹치는 길 없음) */
const R = (id: number, a: string, b: string, length: number, color: RouteColor, extra: Partial<RouteDef> = {}): RouteDef => ({ id, a, b, length, color, ...extra });

export const ROUTES: RouteDef[] = [
  // 수도권·강원
  R(0, 'incheon', 'seoul', 1, 'gray'),
  R(1, 'seoul', 'chuncheon', 3, 'blue', { bend: -10 }),
  R(2, 'chuncheon', 'sokcho', 3, 'green', { bend: -12 }),
  R(3, 'sokcho', 'gangneung', 2, 'red', { bend: -8 }),
  R(4, 'chuncheon', 'gangneung', 5, 'yellow', { bend: -10 }),
  R(5, 'seoul', 'wonju', 4, 'purple', { bend: 10 }),
  R(6, 'chuncheon', 'wonju', 2, 'orange', { bend: 6 }),
  R(7, 'wonju', 'gangneung', 4, 'green', { bend: 10 }),
  R(8, 'gangneung', 'donghae', 2, 'gray', { bend: -6 }),
  R(9, 'donghae', 'pohang', 3, 'blue', { bend: -10 }),
  R(10, 'donghae', 'andong', 3, 'orange', { bend: 8 }),
  // 충청
  R(11, 'seoul', 'cheonan', 3, 'red', { bend: -8 }),
  R(12, 'incheon', 'seosan', 3, 'yellow', { bend: 10 }),
  R(13, 'seosan', 'cheonan', 3, 'green', { bend: -8 }),
  R(14, 'seosan', 'gunsan', 3, 'purple', { bend: 8 }),
  R(15, 'cheonan', 'cheongju', 2, 'gray', { bend: -6 }),
  R(16, 'wonju', 'cheongju', 3, 'yellow', { bend: 8 }),
  R(17, 'cheonan', 'daejeon', 3, 'blue', { bend: -8 }),
  R(18, 'cheongju', 'daejeon', 2, 'orange', { bend: 6 }),
  // 경북
  R(19, 'wonju', 'andong', 4, 'red', { bend: -8 }),
  R(20, 'cheongju', 'andong', 4, 'purple', { bend: -12 }),
  R(21, 'andong', 'pohang', 3, 'yellow', { bend: -8 }),
  R(22, 'andong', 'daegu', 3, 'green', { bend: 10 }),
  R(23, 'daejeon', 'gimcheon', 3, 'red', { bend: -8 }),
  R(24, 'gimcheon', 'daegu', 2, 'gray', { bend: -6 }),
  // 호남
  R(25, 'daejeon', 'jeonju', 2, 'green', { bend: 6 }),
  R(26, 'gunsan', 'jeonju', 2, 'orange', { bend: -6 }),
  R(27, 'jeonju', 'gwangju', 3, 'blue', { bend: 8 }),
  R(28, 'gunsan', 'mokpo', 5, 'red', { bend: 14 }),
  R(29, 'gwangju', 'mokpo', 2, 'yellow', { bend: -6 }),
  R(30, 'gwangju', 'yeosu', 4, 'purple', { bend: 10 }),
  R(31, 'jeonju', 'jinju', 4, 'yellow', { bend: -10 }),
  R(32, 'daegu', 'jinju', 3, 'orange', { bend: 8 }),
  R(33, 'jeonju', 'gimcheon', 4, 'purple', { bend: -10 }),
  // 남해안·영남
  R(34, 'yeosu', 'jinju', 3, 'green', { bend: -8 }),
  R(35, 'jinju', 'tongyeong', 2, 'red', { bend: -6 }),
  R(36, 'yeosu', 'tongyeong', 3, 'orange', { bend: 10 }),
  R(37, 'tongyeong', 'busan', 2, 'blue', { bend: 8 }),
  R(38, 'jinju', 'busan', 3, 'purple', { bend: -8 }),
  R(39, 'daegu', 'busan', 4, 'orange', { bend: 10 }),
  R(40, 'daegu', 'gyeongju', 2, 'blue', { bend: -6 }),
  R(41, 'pohang', 'gyeongju', 1, 'gray'),
  R(42, 'gyeongju', 'ulsan', 1, 'red'),
  R(43, 'ulsan', 'busan', 2, 'green', { bend: -6 }),
  R(44, 'gwangju', 'jinju', 5, 'blue', { bend: 14 }),
  // 제주 배 노선
  R(45, 'mokpo', 'jeju', 3, 'gray', { sea: true, bend: -18 }),
  R(46, 'yeosu', 'jeju', 3, 'gray', { sea: true, bend: 18 }),
];

/** 기찻길 길이마다 받는 점수 */
export const ROUTE_POINTS: Record<number, number> = { 1: 1, 2: 3, 3: 5, 4: 7, 5: 10 };

/**
 * 여행 계획 30장: 두 도시를 내 기찻길로 이으면 +점수, 못 이으면 -점수.
 * 점수 = 가장 짧은 칸 수 (9~12칸이면 +1, 13~16칸 +2, 17칸 이상 +3, 4~20점)
 */
const P = (id: number, a: string, b: string, points: number): PlanDef => ({ id, a, b, points });

export const PLANS: PlanDef[] = [
  // 가까운 여행 (4~8점)
  P(0, 'seoul', 'daejeon', 6),
  P(1, 'incheon', 'cheongju', 6),
  P(2, 'chuncheon', 'gangneung', 5),
  P(3, 'daegu', 'ulsan', 4),
  P(4, 'gwangju', 'tongyeong', 7),
  P(5, 'jeonju', 'mokpo', 5),
  P(6, 'pohang', 'busan', 4),
  P(7, 'andong', 'gyeongju', 4),
  P(8, 'cheonan', 'gunsan', 6),
  P(9, 'wonju', 'gimcheon', 8),
  P(10, 'seoul', 'andong', 8),
  P(11, 'incheon', 'jeonju', 8),
  P(12, 'donghae', 'daegu', 6),
  P(14, 'gunsan', 'jinju', 6),
  P(15, 'cheongju', 'pohang', 7),
  P(16, 'mokpo', 'jinju', 7),
  P(17, 'jeju', 'gwangju', 5),
  P(18, 'sokcho', 'wonju', 5),
  P(21, 'jeonju', 'gyeongju', 8),
  P(26, 'gimcheon', 'yeosu', 8),
  P(27, 'jeju', 'busan', 8),
  // 먼 여행 (10~20점)
  P(13, 'daejeon', 'busan', 10),
  P(19, 'chuncheon', 'daegu', 10),
  P(20, 'seosan', 'daegu', 12),
  P(23, 'sokcho', 'busan', 12),
  P(28, 'seosan', 'pohang', 13),
  P(22, 'incheon', 'busan', 17),
  P(24, 'seoul', 'jeju', 17),
  P(25, 'mokpo', 'gangneung', 18),
  P(29, 'sokcho', 'jeju', 20),
];

export const PLAN: Record<number, PlanDef> = Object.fromEntries(PLANS.map((p) => [p.id, p]));

// ------------------------------------------------------------------ 표

export const TICKET_COLORS: TicketColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
export const CARD_KINDS: CardKind[] = [...TICKET_COLORS, 'wild'];

/** 색마다 표 14장, 만능 고속열차표 10장 = 94장 */
export const CARDS_PER_COLOR = 14;
export const WILD_CARDS = 10;
export const DECK_TOTAL = CARDS_PER_COLOR * TICKET_COLORS.length + WILD_CARDS;

export interface ColorInfo {
  name: string;
  /** 모양 이름 (색을 구별하기 어려운 사람을 위해) */
  shapeName: string;
  main: string;
  dark: string;
  light: string;
}

export const COLOR_INFO: Record<CardKind | 'gray', ColorInfo> = {
  red: { name: '빨강', shapeName: '동그라미', main: '#e2483f', dark: '#9e2a23', light: '#fbd9d5' },
  orange: { name: '주황', shapeName: '세모', main: '#f08a24', dark: '#a85810', light: '#fde2c6' },
  yellow: { name: '노랑', shapeName: '별', main: '#efc12b', dark: '#8f6f00', light: '#fdf0bf' },
  green: { name: '초록', shapeName: '잎', main: '#36a15b', dark: '#1d6638', light: '#cfeedb' },
  blue: { name: '파랑', shapeName: '물방울', main: '#3a78d4', dark: '#1f4b8e', light: '#d3e3fa' },
  purple: { name: '보라', shapeName: '하트', main: '#9259c8', dark: '#5d3189', light: '#e7d8f5' },
  wild: { name: '만능 고속열차', shapeName: '무지개', main: '#e8e4dc', dark: '#5a524a', light: '#f7f4ee' },
  gray: { name: '회색', shapeName: '아무 색', main: '#a39d94', dark: '#625d56', light: '#e7e3dc' },
};

// ------------------------------------------------------------------ 그림 계산

export interface Pt {
  x: number;
  y: number;
}

/** 휘어진 길의 조절점 (두 도시 가운데에서 bend만큼 옆으로) */
export function routeControl(r: RouteDef): Pt {
  const a = CITY[r.a];
  const b = CITY[r.b];
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bend = r.bend ?? 0;
  return { x: mx + (-dy / len) * bend, y: my + (dx / len) * bend };
}

function bezier(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

export function routePathD(r: RouteDef): string {
  const a = CITY[r.a];
  const b = CITY[r.b];
  const c = routeControl(r);
  return `M${a.x} ${a.y} Q${c.x.toFixed(1)} ${c.y.toFixed(1)} ${b.x} ${b.y}`;
}

export interface SlotGeom {
  x: number;
  y: number;
  /** 도 단위 기울기 */
  angle: number;
  w: number;
}

const CITY_GAP = 13;
const SLOT_GAP = 3.5;
const SLOT_MAX = 25;

const slotCache = new Map<number, SlotGeom[]>();

/** 기찻길 칸들의 위치 (길을 따라 고르게, 도시 점은 비켜서) */
export function routeSlots(r: RouteDef): SlotGeom[] {
  const hit = slotCache.get(r.id);
  if (hit) return hit;
  const a = CITY[r.a];
  const b = CITY[r.b];
  const c = routeControl(r);
  // 곡선을 잘게 나눠 길이를 잰다
  const N = 120;
  const pts: Pt[] = [];
  const acc: number[] = [0];
  for (let i = 0; i <= N; i++) pts.push(bezier(a, c, b, i / N));
  for (let i = 1; i <= N; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = acc[N];
  const avail = total - CITY_GAP * 2;
  const w = Math.min(SLOT_MAX, (avail - SLOT_GAP * (r.length - 1)) / r.length);
  const used = w * r.length + SLOT_GAP * (r.length - 1);
  const start = CITY_GAP + (avail - used) / 2;
  const at = (dist: number): { p: Pt; angle: number } => {
    let i = 1;
    while (i < N && acc[i] < dist) i++;
    const t0 = acc[i - 1];
    const f = acc[i] > t0 ? (dist - t0) / (acc[i] - t0) : 0;
    const p0 = pts[i - 1];
    const p1 = pts[i];
    return { p: { x: p0.x + (p1.x - p0.x) * f, y: p0.y + (p1.y - p0.y) * f }, angle: (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI };
  };
  const out: SlotGeom[] = [];
  for (let k = 0; k < r.length; k++) {
    const { p, angle } = at(start + k * (w + SLOT_GAP) + w / 2);
    out.push({ x: p.x, y: p.y, angle, w });
  }
  slotCache.set(r.id, out);
  return out;
}

/** 길의 가운데 (점수 숫자를 띄우는 곳) */
export function routeMid(r: RouteDef): Pt {
  return bezier(CITY[r.a], routeControl(r), CITY[r.b], 0.5);
}

/** 도시마다 이어진 기찻길 */
export const CITY_ROUTES: Record<string, number[]> = Object.fromEntries(CITIES.map((c) => [c.id, ROUTES.filter((r) => r.a === c.id || r.b === c.id).map((r) => r.id)]));

export function otherEnd(r: RouteDef, city: string): string {
  return r.a === city ? r.b : r.a;
}

/** 두 도시 사이의 가장 짧은 칸 수 (누가 깔았는지 상관없이) */
export function mapDistance(from: string, to: string): number {
  const dist: Record<string, number> = { [from]: 0 };
  const done = new Set<string>();
  for (;;) {
    let best: string | null = null;
    for (const id of Object.keys(dist)) if (!done.has(id) && (best === null || dist[id] < dist[best])) best = id;
    if (best === null) return Infinity;
    if (best === to) return dist[best];
    done.add(best);
    for (const rid of CITY_ROUTES[best]) {
      const r = ROUTES[rid];
      const n = otherEnd(r, best);
      const d = dist[best] + r.length;
      if (dist[n] === undefined || d < dist[n]) dist[n] = d;
    }
  }
}

export function routeName(r: RouteDef): string {
  return `${CITY[r.a].name}–${CITY[r.b].name}`;
}

export function planName(p: PlanDef): string {
  return `${CITY[p.a].name} → ${CITY[p.b].name}`;
}
