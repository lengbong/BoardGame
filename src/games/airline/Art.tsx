import type { ReactElement, ReactNode } from 'react';
import { shapeElement, type ShapeKind } from '../../components/shapes';
import type { BodyType, Landmark } from './types';

/** 자리마다 꼬리 날개에 그리는 모양 (다른 게임과 같은 순서) */
export const SEAT_SHAPES: ShapeKind[] = ['circle', 'star', 'leaf', 'diamond'];

// ------------------------------------------------------------------ 비행기 옆모습

interface PlaneArtProps {
  body: BodyType;
  engines: number;
  /** 회사 색 (꼬리·줄무늬). 없으면 회색 */
  color?: string;
  dark?: string;
  shape?: ShapeKind;
  width?: number;
  title?: string;
}

const BODY_H: Record<BodyType, number> = {
  prop: 7,
  rearjet: 7,
  narrow: 8,
  trijet: 8,
  quad: 8,
  wide: 10,
  widetri: 10,
  jumbo: 10,
  double: 14,
  sst: 5,
};

/**
 * 제조사 표시 없이 기종의 생김새만 따라 그린 옆모습 (오른쪽이 앞).
 * 날개 아래 엔진 / 꼬리 엔진 / 세 발 / 점보 혹 / 2층 / 초음속 삼각 날개 / 프로펠러를 구별한다.
 */
export function PlaneArt({ body, engines, color = '#8a94a6', dark, shape = 'circle', width = 120, title }: PlaneArtProps) {
  const h = BODY_H[body];
  const cy = 24;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  const fin = dark ?? color;
  const sst = body === 'sst';
  const tTail = body === 'rearjet' || body === 'trijet';
  const nose = sst ? 116 : 112;
  const parts: ReactNode[] = [];
  // 날개 (옆에서 보면 비스듬한 판)
  if (body === 'prop') {
    parts.push(<path key="wing" d={`M46 ${y0 + 0.5} L64 ${y0 + 0.5} L60 ${y0 - 1.5} L50 ${y0 - 1.5}Z`} className="al-pa-wing" />);
  } else if (sst) {
    parts.push(<path key="wing" d={`M30 ${y1} L84 ${y1 - 0.5} L40 ${y1 + 4}Z`} className="al-pa-wing" />);
  } else {
    parts.push(<path key="wing" d={`M50 ${y1 - 1} L66 ${y1 - 1} L48 ${y1 + 4.5} L40 ${y1 + 4.5}Z`} className="al-pa-wing" />);
  }
  // 꼬리 날개
  parts.push(
    <path
      key="fin"
      d={sst ? `M10 ${y0 + 0.5} L6 ${y0 - 11} L12 ${y0 - 11} L30 ${y0}Z` : `M10 ${y0 + 1} L4 ${y0 - 13} L12 ${y0 - 13} L27 ${y0}Z`}
      fill={fin}
      className="al-pa-fin"
    />,
  );
  parts.push(<g key="logo">{shapeElement(shape, sst ? 9.5 : 9, sst ? y0 - 6 : y0 - 7, 3.2, '#fff')}</g>);
  if (tTail) parts.push(<path key="stab" d={`M1 ${y0 - 13} L16 ${y0 - 12.2} L15 ${y0 - 11} L2 ${y0 - 11.6}Z`} fill={fin} />);
  else if (!sst) parts.push(<path key="stab" d={`M5 ${y0 + 3.5} L22 ${y0 + 3} L21 ${y0 + 4.6} L6 ${y0 + 5}Z`} className="al-pa-wing" />);
  // 몸통
  const hump = body === 'jumbo' ? `L72 ${y0} Q80 ${y0 - 4.5} 92 ${y0 - 4.5} Q104 ${y0 - 4} 108 ${y0 + 1.5}` : `L100 ${y0}`;
  const noseD = sst
    ? `Q112 ${y0} ${nose} ${cy + 1.6} Q110 ${y1} 100 ${y1}`
    : body === 'jumbo'
      ? `Q113 ${y0 + 2.5} ${nose} ${cy + 1} Q112 ${y1} 100 ${y1}`
      : `Q${nose} ${y0} ${nose + 1} ${cy + 1} Q${nose} ${y1} 100 ${y1}`;
  parts.push(<path key="body" d={`M10 ${y0 + 1} ${hump} ${noseD} L30 ${y1} Q17 ${y1} 10 ${y0 + 2.2}Z`} className="al-pa-body" />);
  // 회사 줄무늬
  parts.push(<rect key="stripe" x={14} y={y0 + h * 0.62} width={sst ? 92 : 88} height={Math.max(1.2, h * 0.14)} rx={0.6} fill={color} />);
  // 창문
  const rows = body === 'double' ? [y0 + h * 0.28, y0 + h * 0.52] : [y0 + h * (sst ? 0.36 : 0.38)];
  const winEnd = body === 'jumbo' ? 98 : 102;
  rows.forEach((wy, ri) =>
    parts.push(
      <path key={`win${ri}`} d={Array.from({ length: Math.floor((winEnd - 30) / 3.2) }, (_, i) => `M${30 + i * 3.2} ${wy}h1.5`).join('')} className="al-pa-win" />,
    ),
  );
  if (body === 'jumbo') parts.push(<path key="upper" d={`M82 ${y0 - 2}h1.5M85.2 ${y0 - 2}h1.5M88.4 ${y0 - 2}h1.5M91.6 ${y0 - 2}h1.5`} className="al-pa-win" />);
  parts.push(<path key="cockpit" d={sst ? `M106 ${y0 + 1.2} l4 0.8` : `M${nose - 7} ${y0 + h * 0.3} l4 0.6`} className="al-pa-cockpit" />);
  // 엔진
  const pod = (x: number, y: number, k: string, rx = 6, ry = 2.3) => <ellipse key={k} cx={x} cy={y} rx={rx} ry={ry} className="al-pa-engine" />;
  if (body === 'prop') {
    parts.push(pod(56, y0 + 1, 'e1', 5, 1.8));
    parts.push(<ellipse key="prop" cx={61.5} cy={y0 + 1} rx={0.8} ry={5} className="al-pa-prop" />);
  } else if (body === 'rearjet') {
    parts.push(pod(21, y0 + 1.5, 'e1', 6, 2.4));
  } else if (body === 'trijet') {
    parts.push(pod(21, y0 + 2, 'e1', 6, 2.4));
    parts.push(<ellipse key="duct" cx={17} cy={y0 - 1.2} rx={4} ry={1.6} className="al-pa-engine" />);
  } else if (sst) {
    parts.push(<rect key="e1" x={42} y={y1 + 1.5} width={18} height={3} rx={1} className="al-pa-engine" />);
  } else {
    const ey = y1 + 4.5;
    if (engines >= 4) {
      parts.push(pod(46, ey + 0.4, 'e1', 5.5, 2.2));
      parts.push(pod(60, ey - 0.6, 'e2', 5.5, 2.2));
    } else {
      parts.push(pod(55, ey, 'e1', body === 'narrow' ? 5.5 : 7, body === 'narrow' ? 2.4 : 3));
    }
    if (body === 'widetri') parts.push(pod(12, y0 - 7, 'e3', 6, 2.2));
  }
  return (
    <svg viewBox="0 -4 120 44" width={width} height={(width * 44) / 120} className="al-plane-art" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {parts}
    </svg>
  );
}

/** 지도 위를 나는 작은 비행기 (위에서 본 모양, 오른쪽이 앞) */
export const MAP_PLANE_D =
  'M7 0 L4 -0.9 L0.5 -1 L-3 -6 L-5 -6 L-3.4 -1 L-6 -0.9 L-7.5 -3 L-8.8 -3 L-8 0 L-8.8 3 L-7.5 3 L-6 0.9 L-3.4 1 L-5 6 L-3 6 L0.5 1 L4 0.9Z';

// ------------------------------------------------------------------ 도시 명소

const L = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const F = { fill: 'currentColor', fillOpacity: 0.22, stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' } as const;

const LANDMARKS: Record<Landmark, ReactElement> = {
  tower: (
    <>
      <path d="M12 3v14" {...L} />
      <path d="M9 9h6l-1 3h-4z" {...F} />
      <path d="M5 21c2-4 12-4 14 0" {...L} />
    </>
  ),
  lighthouse: (
    <>
      <path d="M10 8h4l1.5 13h-7z" {...F} />
      <path d="M9.5 8h5M12 4v4M7 6l-3-1M17 6l3-1" {...L} />
    </>
  ),
  stone: (
    <>
      <path d="M8 21v-9a4 4 0 0 1 8 0v9z" {...F} />
      <path d="M8.5 10.5c0-5 7-5 7 0M10 13h1M13 13h1M11 16h2" {...L} />
    </>
  ),
  fuji: (
    <>
      <path d="M2 20l7-12h6l7 12z" {...F} />
      <path d="M9 8l1.5 3 1.5-2 1.5 2 1.5-3" {...L} />
    </>
  ),
  castle: (
    <>
      <path d="M6 21h12M8 21v-6h8v6M7 15l5-3 5 3M9 12v-3h6v3M8 9l4-3 4 3" {...L} />
    </>
  ),
  gate: (
    <>
      <path d="M4 10h16l-2-3H6z" {...F} />
      <path d="M6 10v10h12V10M10 20v-5h4v5M3 20h18" {...L} />
    </>
  ),
  orb: (
    <>
      <path d="M12 2v19M9 21h6" {...L} />
      <circle cx="12" cy="8" r="2.6" {...F} />
      <circle cx="12" cy="15" r="2" {...F} />
    </>
  ),
  junk: (
    <>
      <path d="M4 17h16l-2 3H6z" {...F} />
      <path d="M12 17V4M12 5c4 2 5 7 5 11h-5M12 7c-3 2-4 6-4 9h4M9 9h3M8.5 12h3.5M14 9h1.5M14 12h2.5" {...L} />
    </>
  ),
  tiered: (
    <>
      <path d="M12 2v3M9 21V8h6v13M8 11h8M8 14h8M8 17h8M10 8l2-3 2 3" {...L} />
    </>
  ),
  lion: (
    <>
      <circle cx="10" cy="9" r="4.5" {...F} />
      <path d="M13 12c3 1 5 4 5 8H8c0-3 1-5 2-6M15 14c2-1 4 0 5 2" {...L} />
    </>
  ),
  stupa: (
    <>
      <path d="M6 21c0-6 3-9 6-9s6 3 6 9z" {...F} />
      <path d="M12 12V3M10 7h4M4 21h16" {...L} />
    </>
  ),
  twin: (
    <>
      <path d="M7 21V7l1.5-3L10 7v14M14 21V7l1.5-3L17 7v14M10 12h4" {...L} />
    </>
  ),
  monument: (
    <>
      <path d="M10.5 21V8h3v13M7 21h10" {...L} />
      <path d="M12 2c2 2 1.5 4 0 5-1.5-1-2-3 0-5z" {...F} />
    </>
  ),
  church: (
    <>
      <path d="M6 21V11l6-4 6 4v10z" {...F} />
      <path d="M12 7V3M10.5 4.5h3M10 21v-4h4v4" {...L} />
    </>
  ),
  lantern: (
    <>
      <path d="M8 6h8M12 3v3M8 18h8M12 18v3" {...L} />
      <path d="M8 6c-3 4-3 8 0 12h8c3-4 3-8 0-12z" {...F} />
    </>
  ),
  splitgate: (
    <>
      <path d="M3 21l2-14 3-3 2 3v14zM21 21l-2-14-3-3-2 3v14z" {...F} />
      <path d="M2 21h20" {...L} />
    </>
  ),
  opera: (
    <>
      <path d="M3 18c1-8 6-12 9-12-2 3-2 8-1 12zM10 18c1-7 5-10 8-10-2 3-2 6-1 10zM16 18c1-5 3-7 5-7-1 2-1 4 0 7z" {...F} />
      <path d="M2 18h20M2 21h20" {...L} />
    </>
  ),
  sail: (
    <>
      <path d="M12 3v14M12 4l7 12h-7zM12 6l-6 10h6" {...F} />
      <path d="M4 18h16l-2 3H6z" {...L} />
    </>
  ),
  surf: (
    <>
      <path d="M3 17c3-1 4-5 8-5s4 4 7 4 3-2 3-2" {...L} />
      <path d="M14 3c2 2 2 8 0 11-2-3-2-9 0-11z" {...F} />
      <path d="M2 21c3 0 3-1.5 6-1.5s3 1.5 6 1.5 3-1.5 6-1.5" {...L} />
    </>
  ),
  coconut: (
    <>
      <path d="M12 21c1-4 1-8 0-12" {...L} />
      <path d="M12 9c-3-3-7-2-8 0 3-1 5 0 8 0zM12 9c3-3 7-2 8 0-3-1-5 0-8 0zM12 9c-1-3-4-5-6-5 2 1 4 3 6 5zM12 9c1-3 4-5 6-5-2 1-4 3-6 5z" {...F} />
      <path d="M5 21h14" {...L} />
    </>
  ),
  arch: (
    <>
      <path d="M5 21V7h14v14h-4v-7a3 3 0 0 0-6 0v7z" {...F} />
      <path d="M4 7h16M7 4h10" {...L} />
    </>
  ),
  film: (
    <>
      <rect x="4" y="7" width="16" height="11" rx="1.5" {...F} />
      <path d="M4 10h16M4 15h16M8 7v3M12 7v3M16 7v3M8 15v3M12 15v3M16 15v3" {...L} />
    </>
  ),
  elephant: (
    <>
      <path d="M5 18v-6a5 4 0 0 1 10 0v6M15 12c2 0 3 2 3 5 1 0 1 2 0 2" {...L} />
      <path d="M6 12a5 4 0 0 1 9 0v3H6z" {...F} />
      <path d="M8 18v3M12 18v3" {...L} />
    </>
  ),
  villa: (
    <>
      <path d="M5 12l7-6 7 6z" {...F} />
      <path d="M7 12v4h10v-4M9 16v4M15 16v4M2 20c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1" {...L} />
    </>
  ),
  spire: (
    <>
      <path d="M12 2v3M10.5 21l1-16h1l1 16z" {...F} />
      <path d="M8 21l2.5-6M16 21l-2.5-6M6 21h12" {...L} />
    </>
  ),
  dhow: (
    <>
      <path d="M3 16h17l-3 4H7z" {...F} />
      <path d="M11 16V4l7 10h-7M11 5L5 14h6" {...L} />
    </>
  ),
  peaks: (
    <>
      <path d="M2 20l6-11 4 6 3-5 7 10z" {...F} />
      <path d="M8 9l1.5 3M15 10l1.5 2.5" {...L} />
    </>
  ),
  clock: (
    <>
      <path d="M9 21V8h6v13M8 8l4-5 4 5" {...L} />
      <circle cx="12" cy="11" r="2" {...F} />
      <path d="M12 10v1h1" {...L} />
    </>
  ),
  lattice: (
    <>
      <path d="M12 2l-1 6-2 7-3 6M12 2l1 6 2 7 3 6M9.5 12h5M7.5 17h9" {...L} />
      <path d="M9 21a3 3 0 0 1 6 0" {...L} />
    </>
  ),
  skyline: (
    <>
      <path d="M3 21V12h4v9M8 21V6h4v15M13 21V9h4v12M18 21v-7h3v7" {...F} />
    </>
  ),
  windmill: (
    <>
      <path d="M9 21l1.5-10h3L15 21z" {...F} />
      <path d="M12 9l6-6M12 9l-6-6M12 9l6 6M12 9l-6 6" {...L} />
    </>
  ),
  alps: (
    <>
      <path d="M1 20l6-9 4 5 5-9 7 13z" {...F} />
      <path d="M14 10l2-3 2 3M5 14l2-3 1.5 2" {...L} />
    </>
  ),
  colosseum: (
    <>
      <path d="M3 20V9c3-2 15-2 18 0v11z" {...F} />
      <path d="M3 13h18M3 16.5h18M7 9.5v10.5M11 9v11M15 9v11M19 9.5v10.5" {...L} />
    </>
  ),
  cathedral: (
    <>
      <path d="M5 21V11h14v10z" {...F} />
      <path d="M7 11V5M10 11V3M14 11V3M17 11V5M12 21v-4" {...L} />
    </>
  ),
  basilica: (
    <>
      <path d="M6 21l1-14 1 14M10 21l1.2-18 1.2 18M14 21l1.2-18 1.2 18M17 21l1-12 1 12" {...F} />
      <path d="M4 21h16" {...L} />
    </>
  ),
  palace: (
    <>
      <path d="M3 21V12h18v9zM9 12V8h6v4" {...F} />
      <path d="M12 8V4M6 15v3M9 15v3M15 15v3M18 15v3" {...L} />
    </>
  ),
  columns: (
    <>
      <path d="M3 8l9-4 9 4z" {...F} />
      <path d="M5 8v11M9 8v11M15 8v11M19 8v11M3 19h18M3 21h18" {...L} />
    </>
  ),
  mosque: (
    <>
      <path d="M7 15a5 5 0 0 1 10 0z" {...F} />
      <path d="M6 15h12v6H6zM3 21V8M21 21V8M2.5 8h1M20.5 8h1M12 10V7" {...L} />
    </>
  ),
  pyramid: (
    <>
      <path d="M2 20l8-14 8 14z" {...F} />
      <path d="M14 20l3-6 5 6" {...L} />
    </>
  ),
  giraffe: (
    <>
      <path d="M8 21v-7l2-1 2-9h2l-1 10 2 1v6" {...L} />
      <circle cx="11" cy="15" r="0.9" fill="currentColor" />
      <circle cx="13" cy="9" r="0.8" fill="currentColor" />
      <path d="M14 4l2 1" {...L} />
    </>
  ),
  gem: (
    <>
      <path d="M5 9l3-4h8l3 4-7 11z" {...F} />
      <path d="M5 9h14M9 9l3 11 3-11M8 5l1 4M16 5l-1 4" {...L} />
    </>
  ),
  tablemtn: (
    <>
      <path d="M2 20l4-9h12l4 9z" {...F} />
      <path d="M6 11h12M2 21c3 0 3-1 6-1s3 1 6 1 3-1 6-1" {...L} />
    </>
  ),
  drum: (
    <>
      <path d="M7 5c0-1 10-1 10 0l-2 7 2 7c0 1-10 1-10 0l2-7z" {...F} />
      <path d="M7 5c0 1 10 1 10 0M9 12h6M18 4l3-2" {...L} />
    </>
  ),
  horseshoe: (
    <>
      <path d="M5 21V10a7 7 0 0 1 14 0v11h-4v-8a3 3 0 0 0-6 0v8z" {...F} />
    </>
  ),
  statue: (
    <>
      <path d="M10 21v-9l1-5h2l1 5v9z" {...F} />
      <path d="M13 7l2-4M15 3l1.5-1M10.5 7l-1.5-2.5 2-.5M7 21h10" {...L} />
    </>
  ),
  palm: (
    <>
      <path d="M11 21c2-5 2-9 1-13" {...L} />
      <path d="M12 8c-3-2-6-1-8 1 3 0 5 0 8-1zM12 8c3-3 6-2 8 0-3 0-5 0-8 0zM12 8c0-3 2-5 4-6-1 2-2 4-4 6zM12 8c-1-3-3-4-5-4 2 1 3 2 5 4z" {...F} />
    </>
  ),
  bridge: (
    <>
      <path d="M2 16h20M6 21V5M18 21V5" {...L} />
      <path d="M6 5c2 6 10 6 12 0M2 9c2 4 3 6 4 7M22 9c-2 4-3 6-4 7" {...L} />
    </>
  ),
  skyscraper: (
    <>
      <path d="M8 21V6l4-3 4 3v15z" {...F} />
      <path d="M12 3V1M10 9h4M10 12h4M10 15h4M10 18h4" {...L} />
    </>
  ),
  flamingo: (
    <>
      <path d="M11 13c-4 0-6-3-4-5s5 0 6 2 0 4-2 3z" {...F} />
      <path d="M12 12c2-2 2-5 0-7-1-1-3 0-3 1M10 14v7M10 17l3 1" {...L} />
    </>
  ),
  maple: (
    <path d="M12 2l1.5 4 3-1-1 4 4-1-2 3 3 2-4 1 1 3-4-2-1 6-1-6-4 2 1-3-4-1 3-2-2-3 4 1-1-4 3 1z" {...F} />
  ),
  needle: (
    <>
      <path d="M12 2v19M9 21h6" {...L} />
      <ellipse cx="12" cy="9" rx="3.5" ry="1.8" {...F} />
    </>
  ),
  sphere: (
    <>
      <circle cx="12" cy="11" r="8" {...F} />
      <path d="M4 11h16M12 3v16M6 6l12 10M18 6L6 16M7 21h10" {...L} />
    </>
  ),
  steppyramid: (
    <>
      <path d="M3 20h18v-3H5v-3h14v-3H7V8h10V5H9" {...L} />
      <path d="M3 20h18l-2-3H5z" {...F} />
    </>
  ),
  coffee: (
    <>
      <path d="M5 10h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" {...F} />
      <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16M9 3c-1 2 1 3 0 5M12 3c-1 2 1 3 0 5" {...L} />
    </>
  ),
  sugarloaf: (
    <>
      <path d="M2 20c2-6 4-12 7-12s4 5 5 7c1-2 2-4 4-4s3 4 4 9z" {...F} />
      <path d="M9 8l9 3" {...L} />
    </>
  ),
  obelisk: (
    <>
      <path d="M10 21l1-16 1-2 1 2 1 16z" {...F} />
      <path d="M6 21h12" {...L} />
    </>
  ),
};

export function LandmarkIcon({ kind, size = 24, className }: { kind: Landmark; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      {LANDMARKS[kind]}
    </svg>
  );
}

/** 회사 꼬리 배지: 회사 색 동그라미 안에 하얀 모양 */
export function CompanyBadge({ color, shape, size = 18 }: { color: string; shape: ShapeKind; size?: number }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" className="al-badge">
      <path d="M3 17 L7 3 H15 L12 17Z" fill={color} />
      {shapeElement(shape, 10, 9.5, 3.6, '#fff')}
    </svg>
  );
}

/** 설정 화면 머리 그림: 구름 위로 나는 비행기와 지구 하늘길 */
export function HeroArt() {
  return (
    <svg viewBox="0 0 220 140" width={220} height={140} className="al-hero-art" aria-hidden="true">
      <defs>
        <linearGradient id="al-hero-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7ec4ea" />
          <stop offset="1" stopColor="#d9f0fb" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="216" height="136" rx="22" fill="url(#al-hero-sky)" />
      <circle cx="176" cy="34" r="14" fill="#ffd36b" opacity="0.9" />
      <path d="M-10 150 A130 130 0 0 1 230 150" fill="#5aa86b" opacity="0.85" />
      <path d="M20 140 A110 90 0 0 1 200 140" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="5 6" opacity="0.8" />
      <circle cx="42" cy="112" r="4" fill="#fff" stroke="#2a6f8f" strokeWidth="1.5" />
      <circle cx="178" cy="112" r="4" fill="#fff" stroke="#2a6f8f" strokeWidth="1.5" />
      <g fill="#fff" opacity="0.95">
        <ellipse cx="50" cy="40" rx="22" ry="9" />
        <ellipse cx="66" cy="34" rx="14" ry="9" />
        <ellipse cx="150" cy="78" rx="20" ry="7" />
        <ellipse cx="164" cy="73" rx="11" ry="7" />
      </g>
      <g transform="translate(58 46) rotate(-10)">
        <PlaneArtInline />
      </g>
    </svg>
  );
}

/** 머리 그림 안의 비행기 (svg 안에 넣으려고 g로) */
function PlaneArtInline() {
  return (
    <g transform="scale(0.85)">
      <path d="M50 31 L66 31 L48 36.5 L40 36.5Z" fill="#c9d1dc" stroke="#7b8796" strokeWidth="0.8" />
      <path d="M10 21 L4 7 L12 7 L27 20Z" fill="#e5484d" />
      <path d="M10 21 L100 20 Q112 20 113 25 Q112 30 100 30 L30 30 Q17 30 10 22.2Z" fill="#fdfdfd" stroke="#7b8796" strokeWidth="0.8" />
      <rect x="14" y="26.2" width="88" height="1.4" fill="#e5484d" />
      <path d={Array.from({ length: 22 }, (_, i) => `M${30 + i * 3.2} 23.8h1.5`).join('')} stroke="#5f7489" strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="55" cy="36.5" rx="6" ry="2.4" fill="#aab4c2" stroke="#7b8796" strokeWidth="0.8" />
      {shapeElement('star', 9, 13, 3.2, '#fff')}
    </g>
  );
}
