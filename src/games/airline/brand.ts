import { SEAT_COLORS } from '../common/players';
import { CITY, dist } from './cities';
import { REAL_AIRLINE, airlinesAt, type RealAirline } from './realAirlines';
import type { Company, Rng } from './types';

/**
 * 실제 항공사 모드: 항공사 고르기, 본거지, 회사 색.
 * 실제 항공사의 이름·두 글자 부호(IATA)·칠 색만 빌려 쓰고 로고는 그리지 않는다.
 */

export interface CoColors {
  main: string;
  dark: string;
  light: string;
}

// ------------------------------------------------------------------ 색 셈

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** CIE Lab (색 차이 셈용) */
function toLab([r, g, b]: RGB): [number, number, number] {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

/** 두 색이 얼마나 다른지 (CIE76) */
export function colorDistance(a: string, b: string): number {
  const A = toLab(hexToRgb(a));
  const B = toLab(hexToRgb(b));
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

/**
 * 지도 선·배지로 쓰기 좋은 색으로 고친다: 밝은 바탕과 어두운 바탕 모두에서 보이게 밝기를 가운데로,
 * 회색에 가까운 색은 쓰지 않는다 (null).
 */
export function usableColor(hex: string): string | null {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  if (s < 0.22 || l > 0.93 || l < 0.08) return null;
  // 바다색(하늘색)과 섞이지 않게 파란 쪽은 조금 더 진하게
  const top = h >= 170 && h <= 255 ? 0.5 : 0.54;
  return rgbToHex(hslToRgb(h, Math.max(0.5, s), Math.max(0.42, Math.min(top, l))));
}

function shade(hex: string, l: number, sMin = 0): string {
  const [h, s] = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb(h, Math.max(sMin, s), l));
}

/** 회사 색 세 가지 (실제 항공사 색이 있으면 그 색, 없으면 자리 색) */
export function coColors(c: Pick<Company, 'seat' | 'color'>): CoColors {
  if (!c.color) return SEAT_COLORS[c.seat];
  return { main: c.color, dark: shade(c.color, 0.27, 0.4), light: shade(c.color, 0.93, 0.5) };
}

/** 이만큼은 달라야 서로 다른 회사로 보인다 */
const MIN_DISTANCE = 30;

/** 두 회사 색이 한눈에 다른지: 색 차이가 크고, 색깔(색상환)도 꽤 다르다 */
export function distinctColors(a: string, b: string): boolean {
  if (colorDistance(a, b) < MIN_DISTANCE) return false;
  const [ha, sa, la] = rgbToHsl(hexToRgb(a));
  const [hb, sb, lb] = rgbToHsl(hexToRgb(b));
  const dh = Math.min(Math.abs(ha - hb), 360 - Math.abs(ha - hb));
  return dh >= 32 || Math.abs(la - lb) >= 0.22 || Math.abs(sa - sb) >= 0.5;
}

/**
 * 회사마다 색을 고른다. 실제 항공사는 주된 색 → 곁들인 색 순서로 보고, 앞 회사와 너무 비슷하면 다음 색,
 * 둘 다 비슷하면 자리 색을 쓴다 (모양은 자리마다 달라서 색이 비슷해도 모양으로 가린다).
 */
export function pickColors(list: { seat: number; airline: string | null }[]): (string | null)[] {
  const chosen: string[] = [];
  return list.map(({ seat, airline }) => {
    const a = airline ? REAL_AIRLINE[airline] : undefined;
    const cands = a ? (a.colors.map(usableColor).filter(Boolean) as string[]) : [];
    const far = (c: string) => chosen.every((x) => distinctColors(x, c));
    let pick: string | null = cands.find(far) ?? null;
    if (!pick) {
      // 자리 색 (그것도 겹치면 다른 자리 색)
      const seats = [seat, 0, 1, 2, 3].map((i) => SEAT_COLORS[i as 0].main);
      const seatPick = seats.find(far) ?? seats[0];
      chosen.push(seatPick);
      return a ? seatPick : null;
    }
    chosen.push(pick);
    return pick;
  });
}

// ------------------------------------------------------------------ 본거지

/**
 * 게임에서 쓰는 본거지: 실제 본거지가 그 해에 본사가 될 수 있는 도시면 그대로,
 * 아니면 (아직 공항이 작거나 하면) 같은 지역에서 가장 가까운 큰 도시.
 */
export function gameHub(a: RealAirline, candidates: readonly string[], taken: readonly string[] = []): string | null {
  const free = candidates.filter((c) => !taken.includes(c));
  if (free.includes(a.hub)) return a.hub;
  const region = CITY[a.hub]?.region ?? a.region;
  const near = (list: string[]) => [...list].sort((x, y) => dist(a.hub, x) - dist(a.hub, y))[0] ?? null;
  return near(free.filter((c) => CITY[c].region === region)) ?? near(free);
}

/** 그 해에 고를 수 있는 실제 항공사 (이름순) */
export function selectableAirlines(year: number): RealAirline[] {
  return airlinesAt(year);
}

/**
 * 컴퓨터(또는 고르지 않은 사람)에게 실제 항공사를 준다: 이미 쓴 항공사·본거지는 피하고,
 * 지역이 겹치지 않게, 큰 도시를 본거지로 둔 항공사를 더 자주 고른다.
 */
export function autoAirline(
  year: number,
  candidates: readonly string[],
  takenAirlines: readonly string[],
  takenHubs: readonly string[],
  size: (city: string) => number,
  rng: Rng,
): { airline: RealAirline; hub: string } | null {
  const usedRegions = takenHubs.map((h) => CITY[h].region);
  const opts = airlinesAt(year)
    .filter((a) => !takenAirlines.includes(a.id))
    .map((a) => ({ a, hub: gameHub(a, candidates, takenHubs) }))
    .filter((x): x is { a: RealAirline; hub: string } => !!x.hub);
  if (opts.length === 0) return null;
  const weights = opts.map(({ a, hub }) => {
    const s = size(hub);
    return s * s * (usedRegions.includes(CITY[hub].region) ? 0.3 : 1) * (s >= 5 ? 1 : 0.3) * (hub === a.hub ? 1 : 0.25);
  });
  const total = weights.reduce((x, y) => x + y, 0);
  let r = rng() * total;
  for (let i = 0; i < opts.length; i++) {
    r -= weights[i];
    if (r <= 0) return { airline: opts[i].a, hub: opts[i].hub };
  }
  const last = opts[opts.length - 1];
  return { airline: last.a, hub: last.hub };
}

/** 회사의 실제 항공사 (없으면 undefined) */
export function realOf(c: Pick<Company, 'airline'>): RealAirline | undefined {
  return c.airline ? REAL_AIRLINE[c.airline] : undefined;
}

/** 배지 글자색: 바탕이 밝으면 검게 */
export function inkOn(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#1a1a1a' : '#ffffff';
}
