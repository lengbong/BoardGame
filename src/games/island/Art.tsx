import type { ReactElement } from 'react';
import { shapeElement, type ShapeKind } from '../../components/shapes';
import type { SeatIndex } from '../common/players';
import type { BuildKind, Resource, Terrain } from './types';

/** 자리마다 붙이는 모양 (색을 구별하기 어려워도 알아보게) */
export const SEAT_SHAPES: Record<SeatIndex, ShapeKind> = { 0: 'circle', 1: 'leaf', 2: 'star', 3: 'diamond' };

// ------------------------------------------------------------------ 자원 그림 (32×32 안에)

/** SVG 안에 넣는 자원 그림 (가운데 16,16 기준 32×32) */
export function ResourceGlyph({ res }: { res: Resource }): ReactElement {
  switch (res) {
    case 'wood':
      return (
        <g>
          <rect x={4} y={15} width={22} height={9} rx={4.5} fill="#a8683a" stroke="#6b3f1f" strokeWidth={1.4} />
          <rect x={8} y={7} width={20} height={9} rx={4.5} fill="#bf7c45" stroke="#6b3f1f" strokeWidth={1.4} />
          <ellipse cx={24} cy={11.5} rx={3.6} ry={4.2} fill="#f2d3a2" stroke="#6b3f1f" strokeWidth={1.2} />
          <circle cx={24} cy={11.5} r={1.4} fill="none" stroke="#b07a46" strokeWidth={0.9} />
          <ellipse cx={22} cy={19.5} rx={3.6} ry={4.2} fill="#f2d3a2" stroke="#6b3f1f" strokeWidth={1.2} />
          <circle cx={22} cy={19.5} r={1.4} fill="none" stroke="#b07a46" strokeWidth={0.9} />
          <path d="M11 10.5 h7 M8 19 h8" stroke="#8a522a" strokeWidth={1} strokeLinecap="round" />
        </g>
      );
    case 'stone':
      return (
        <g>
          <path d="M4 25 L7 15 L13 10 L19 12 L23 9 L28 15 L29 25 Z" fill="#9aa1a8" stroke="#4d5359" strokeWidth={1.4} strokeLinejoin="round" />
          <path d="M13 10 L15 18 L23 9 M15 18 L10 25 M15 18 L22 25 M28 15 L22 19" fill="none" stroke="#5f666d" strokeWidth={1} strokeLinejoin="round" />
          <path d="M8 15 L13 10 L14 14 Z" fill="#c9cfd4" />
          <path d="M19 12 L23 9 L25 13 Z" fill="#c9cfd4" />
        </g>
      );
    case 'grain':
      return (
        <g>
          <path d="M16 29 V12 M16 24 L10 13 M16 24 L22 13" stroke="#a7781f" strokeWidth={1.6} strokeLinecap="round" fill="none" />
          {[
            [16, 7],
            [10, 9],
            [22, 9],
          ].map(([x, y], i) => (
            <g key={i} transform={`rotate(${[0, -25, 25][i]} ${x} ${y})`}>
              <ellipse cx={x} cy={y} rx={2.6} ry={5} fill="#f2c14e" stroke="#a7781f" strokeWidth={1.1} />
              <path d={`M${x} ${y - 3.5} v7`} stroke="#d69a2a" strokeWidth={0.8} />
            </g>
          ))}
          <path d="M12 23 Q16 21 20 23" stroke="#c0392b" strokeWidth={2} fill="none" strokeLinecap="round" />
        </g>
      );
    case 'fish':
      return (
        <g>
          <path d="M5 16 C9 8 20 8 25 16 C20 24 9 24 5 16 Z" fill="#5fa8d3" stroke="#255d80" strokeWidth={1.4} />
          <path d="M24 16 L30 10 L29 16 L30 22 Z" fill="#4a90bd" stroke="#255d80" strokeWidth={1.3} strokeLinejoin="round" />
          <circle cx={10} cy={14.5} r={1.6} fill="#1f2a30" />
          <path d="M14 12 Q16 16 14 20 M18 12 Q20 16 18 20" stroke="#a9d6ef" strokeWidth={1} fill="none" />
        </g>
      );
  }
}

export function ResourceIcon({ res, size = 22, className }: { res: Resource; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden="true">
      <ResourceGlyph res={res} />
    </svg>
  );
}

// ------------------------------------------------------------------ 땅 그림

export const TERRAIN_FILL: Record<Terrain, [string, string]> = {
  forest: ['#a7d48a', '#6fae5c'],
  rock: ['#d6cdbd', '#a99d8a'],
  field: ['#f7e08e', '#e5b952'],
  shore: ['#cfe7df', '#d8c79c'],
  hill: ['#d9efb4', '#b2d98a'],
};

function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-1.6} y={2} width={3.2} height={7} rx={1} fill="#7a4a24" />
      <circle cx={0} cy={-2} r={8} fill="#3f8a3c" stroke="#2c6a2c" strokeWidth={1.2} />
      <circle cx={-2.6} cy={-4.6} r={3} fill="#68b25a" />
    </g>
  );
}

function Pine({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-1.4} y={6} width={2.8} height={5} fill="#7a4a24" />
      <path d="M0 -12 L8 1 H3 L9 8 H-9 L-3 1 H-8 Z" fill="#2f7d4a" stroke="#215c36" strokeWidth={1.1} strokeLinejoin="round" />
      <path d="M0 -12 L-4 -5" stroke="#5aa86e" strokeWidth={1.4} strokeLinecap="round" />
    </g>
  );
}

function Rock({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-11 7 L-7 -4 L-1 -9 L5 -6 L10 1 L11 7 Z" fill="#8f949a" stroke="#4f5459" strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M-7 -4 L-1 -9 L0 -2 Z" fill="#c3c8cc" />
      <path d="M0 -2 L-3 7 M0 -2 L6 3" stroke="#5f656b" strokeWidth={1} fill="none" />
    </g>
  );
}

function Peak({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-16 10 L-3 -13 L3 -6 L8 -11 L18 10 Z" fill="#9b8f7d" stroke="#5a5040" strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M-3 -13 L-7 -6 L-4 -7 L-1 -4 L3 -6 Z" fill="#f4f1ea" />
      <path d="M8 -11 L5 -5 L8 -6 L10 -4 Z" fill="#f4f1ea" />
    </g>
  );
}

function Sheaf({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 9 L-5 -6 M0 9 L0 -8 M0 9 L5 -6" stroke="#b07f1f" strokeWidth={1.6} strokeLinecap="round" />
      <ellipse cx={-5} cy={-8} rx={2} ry={3.6} fill="#f6cf58" stroke="#a7781f" strokeWidth={0.9} />
      <ellipse cx={0} cy={-10} rx={2} ry={3.6} fill="#f6cf58" stroke="#a7781f" strokeWidth={0.9} />
      <ellipse cx={5} cy={-8} rx={2} ry={3.6} fill="#f6cf58" stroke="#a7781f" strokeWidth={0.9} />
      <path d="M-3 4 H3" stroke="#c0392b" strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

function Net({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-14 -8 Q0 -14 14 -8 L10 9 Q0 13 -10 9 Z" fill="rgba(255,255,255,0.25)" stroke="#6b5a3c" strokeWidth={1.2} />
      <path d="M-7 -11 L-5 11 M0 -12 L0 12 M7 -11 L5 11 M-12 -2 Q0 -6 12 -2 M-11 4 Q0 1 11 4" stroke="#6b5a3c" strokeWidth={0.8} fill="none" />
      {[-12, -4, 4, 12].map((fx) => (
        <circle key={fx} cx={fx} cy={-9.5 - (Math.abs(fx) < 6 ? 2 : 0)} r={1.8} fill="#e8743b" stroke="#8a3d17" strokeWidth={0.6} />
      ))}
    </g>
  );
}

function SmallFish({ x, y, flip }: { x: number; y: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}>
      <path d="M-6 0 C-3 -4 3 -4 5 0 C3 4 -3 4 -6 0 Z" fill="#4f93c2" stroke="#24587a" strokeWidth={0.9} />
      <path d="M5 0 L9 -3 L9 3 Z" fill="#4f93c2" stroke="#24587a" strokeWidth={0.8} strokeLinejoin="round" />
      <circle cx={-3} cy={-0.6} r={0.9} fill="#14222b" />
    </g>
  );
}

function Flower({ x, y, c }: { x: number; y: number; c: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cx={2.2 * Math.cos((a * Math.PI) / 180)} cy={2.2 * Math.sin((a * Math.PI) / 180)} r={1.6} fill={c} />
      ))}
      <circle r={1.2} fill="#f6d04d" />
    </g>
  );
}

/** 땅 칸 그림. (cx, cy)는 칸 가운데, 가운데에는 숫자 패가 놓이므로 비워 둔다 */
export function TerrainArt({ terrain, cx, cy, variant }: { terrain: Terrain; cx: number; cy: number; variant: number }) {
  const flip = variant % 2 === 1 ? -1 : 1;
  const g = (children: ReactElement) => <g transform={`translate(${cx} ${cy}) scale(${flip} 1)`}>{children}</g>;
  switch (terrain) {
    case 'forest':
      return g(
        <>
          <Pine x={-24} y={-27} s={1.05} />
          <Tree x={22} y={-26} s={0.95} />
          <Tree x={-31} y={8} s={0.9} />
          <Pine x={30} y={10} s={0.95} />
          <Tree x={-12} y={33} s={0.85} />
          <Pine x={13} y={33} s={0.8} />
        </>,
      );
    case 'rock':
      return g(
        <>
          <Peak x={-14} y={-28} s={0.95} />
          <Rock x={27} y={-17} s={0.9} />
          <Rock x={-30} y={14} s={0.85} />
          <Peak x={22} y={22} s={0.8} />
          <Rock x={-6} y={36} s={0.6} />
        </>,
      );
    case 'field':
      return g(
        <>
          {[-38, -26, 26, 38].map((y) => (
            <path key={y} d={`M-40 ${y} Q0 ${y - 6} 40 ${y}`} stroke="#c99a35" strokeWidth={2} fill="none" strokeDasharray="5 4" opacity={0.75} />
          ))}
          <Sheaf x={-30} y={-6} />
          <Sheaf x={31} y={-4} />
          <Sheaf x={-15} y={-30} />
          <Sheaf x={17} y={31} />
        </>,
      );
    case 'shore':
      return g(
        <>
          {[-34, 28, 40].map((y, i) => (
            <path key={y} d={`M${-30 + i * 6} ${y} q6 -4 12 0 t12 0 t12 0`} stroke="#7fb7c9" strokeWidth={1.8} fill="none" strokeLinecap="round" />
          ))}
          <Net x={-25} y={-16} />
          <SmallFish x={28} y={-18} />
          <SmallFish x={26} y={16} flip />
          <g transform="translate(-26 22)">
            <path d="M-6 3 Q0 -6 6 3 Z" fill="#f3e2c3" stroke="#a88a5a" strokeWidth={0.9} />
            <path d="M0 -3 L-3 3 M0 -3 L0 3 M0 -3 L3 3" stroke="#a88a5a" strokeWidth={0.6} />
          </g>
        </>,
      );
    case 'hill':
      return g(
        <>
          <path d="M-42 26 Q-14 -2 14 18 Q30 6 44 22" fill="#9ccb72" stroke="#6c9d4c" strokeWidth={1.4} />
          <path d="M-8 30 Q2 14 -4 2 Q-10 -12 4 -24" stroke="#e8d7a8" strokeWidth={4} fill="none" strokeLinecap="round" />
          <Flower x={-26} y={-18} c="#f78fb3" />
          <Flower x={24} y={-24} c="#ffffff" />
          <Flower x={28} y={2} c="#c39bd3" />
          <Flower x={-30} y={6} c="#ffffff" />
          <Flower x={14} y={34} c="#f78fb3" />
          {/* 작은 나무 표지판 */}
          <g transform="translate(-14 -34)">
            <rect x={-1} y={0} width={2} height={10} fill="#7a4a24" />
            <rect x={-7} y={-4} width={14} height={6} rx={1.5} fill="#c48a52" stroke="#7a4a24" strokeWidth={0.8} />
          </g>
        </>,
      );
  }
}

/** 숫자 패: 숫자와 그 수만큼의 점 (주사위 눈과 맞춰 보기 쉽게) */
export function NumberToken({ n, cx, cy, hot }: { n: number; cx: number; cy: number; hot?: boolean }) {
  const dots = Array.from({ length: n }, (_, i) => cx + (i - (n - 1) / 2) * 3.6);
  return (
    <g className={`is-token${hot ? ' is-token-hot' : ''}`} style={{ transformOrigin: `${cx}px ${cy}px` }}>
      <circle cx={cx} cy={cy + 1.2} r={16.5} fill="rgba(60,40,10,0.25)" />
      <circle cx={cx} cy={cy} r={16.5} className="is-token-face" stroke="#8a6a3a" strokeWidth={1.6} />
      <text x={cx} y={cy - 1.5} className="is-token-num" textAnchor="middle" dominantBaseline="central">
        {n}
      </text>
      {dots.map((x, i) => (
        <circle key={i} cx={x} cy={cy + 9.5} r={1.35} fill="#8a6a3a" />
      ))}
    </g>
  );
}

// ------------------------------------------------------------------ 건물 그림

interface PieceProps {
  x: number;
  y: number;
  color: string;
  dark: string;
  shape: ShapeKind;
}

/** 집: 모서리 (x, y)에 바닥 가운데를 두는 작은 집 */
export function HouseShape({ x, y, color, dark, shape }: PieceProps) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={0} cy={9} rx={14} ry={3.5} fill="rgba(0,0,0,0.22)" />
      <rect x={-11} y={-6} width={22} height={15} rx={2} fill={color} stroke={dark} strokeWidth={1.6} />
      <path d="M-14 -5 L0 -18 L14 -5 Z" fill={dark} stroke={dark} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M-10 -8 L0 -16" stroke="rgba(255,255,255,0.35)" strokeWidth={1.4} strokeLinecap="round" />
      {shapeElement(shape, 0, 1.5, 4.6, '#fff', { stroke: dark, strokeWidth: 0.6 })}
    </g>
  );
}

/** 마을회관: 더 크고 지붕이 두 겹, 꼭대기에 작은 깃발 */
export function HallShape({ x, y, color, dark, shape }: PieceProps) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={0} cy={11} rx={19} ry={4} fill="rgba(0,0,0,0.24)" />
      <rect x={-17} y={-6} width={34} height={17} rx={2} fill={color} stroke={dark} strokeWidth={1.7} />
      <path d="M-20 -5 L0 -19 L20 -5 Z" fill={dark} stroke={dark} strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M-8 -14 L0 -26 L8 -14 Z" fill={color} stroke={dark} strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M0 -26 V-34" stroke={dark} strokeWidth={1.3} />
      <path d="M0 -34 L7 -31.5 L0 -29 Z" fill="#fff" stroke={dark} strokeWidth={0.8} />
      <rect x={-13} y={-1} width={4} height={5} rx={0.8} fill="#fff6d6" stroke={dark} strokeWidth={0.7} />
      <rect x={9} y={-1} width={4} height={5} rx={0.8} fill="#fff6d6" stroke={dark} strokeWidth={0.7} />
      {shapeElement(shape, 0, 3, 5.2, '#fff', { stroke: dark, strokeWidth: 0.6 })}
    </g>
  );
}

/** 등대: 건물 옆 바다 쪽에 서는 줄무늬 탑 */
export function LighthouseShape({ x, y, color, dark }: { x: number; y: number; color: string; dark: string }) {
  return (
    <g transform={`translate(${x} ${y})`} className="is-lighthouse">
      <g className="is-beam">
        <path d="M0 -27 L-30 -36 L-30 -20 Z" fill="rgba(255,236,140,0.45)" />
        <path d="M0 -27 L30 -36 L30 -20 Z" fill="rgba(255,236,140,0.45)" />
      </g>
      <ellipse cx={0} cy={10} rx={10} ry={3} fill="rgba(0,0,0,0.22)" />
      <path d="M-8 10 L-5 -20 H5 L8 10 Z" fill="#fff" stroke={dark} strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M-7.3 3 L-6.6 -4 H6.6 L7.3 3 Z" fill={color} />
      <path d="M-6 -11 L-5.6 -16 H5.6 L6 -11 Z" fill={color} />
      <rect x={-6.5} y={-30} width={13} height={10} rx={2} fill="#ffe680" stroke={dark} strokeWidth={1.4} />
      <path d="M-8 -30 L0 -37 L8 -30 Z" fill={dark} />
      <circle cx={0} cy={-25} r={2.6} fill="#fff8c2" />
    </g>
  );
}

/** 짓기 메뉴용 작은 그림 */
export function BuildIcon({ kind, color, dark, shape, size = 34 }: { kind: BuildKind; color: string; dark: string; shape: ShapeKind; size?: number }) {
  return (
    <svg viewBox="-22 -38 44 52" width={size} height={size} aria-hidden="true">
      {kind === 'road' && (
        <g>
          <path d="M-16 6 L16 -22" stroke={dark} strokeWidth={9} strokeLinecap="round" />
          <path d="M-16 6 L16 -22" stroke={color} strokeWidth={6} strokeLinecap="round" />
          <path d="M-16 6 L16 -22" stroke="#fff" strokeWidth={1.4} strokeDasharray="3 4" strokeLinecap="round" />
        </g>
      )}
      {kind === 'house' && <HouseShape x={0} y={2} color={color} dark={dark} shape={shape} />}
      {kind === 'hall' && <HallShape x={0} y={2} color={color} dark={dark} shape={shape} />}
      {kind === 'lighthouse' && <LighthouseShape x={0} y={3} color={color} dark={dark} />}
    </svg>
  );
}

/** 등대 작은 그림 (패널·결과용) */
export function LighthouseIcon({ size = 16, color = '#e5484d', dark = '#a52a2f' }: { size?: number; color?: string; dark?: string }) {
  return (
    <svg viewBox="-12 -40 24 52" width={size} height={size} aria-hidden="true">
      <LighthouseShape x={0} y={0} color={color} dark={dark} />
    </svg>
  );
}

/** 축제 깃발 그림 */
export function FlagIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <path d="M8 4 V29" stroke="#7a4a24" strokeWidth={2.2} strokeLinecap="round" />
      <path d="M9 5 C14 2 18 9 26 6 L24 13 L27 19 C19 22 15 15 9 18 Z" fill="#ff6b6b" stroke="#a83232" strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M12 9 l2 2 l3 -3 M17 13 l2 2 l3 -3" stroke="#fff" strokeWidth={1.1} fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** 설정 화면 머리 그림: 작은 섬과 집, 마을회관, 등대, 갈매기 */
export function HeroIsland() {
  const k = 0.4;
  const S = 60 * k;
  const SQ3 = Math.sqrt(3);
  const hexes: [number, number, Terrain, number][] = [
    [0, 0, 'forest', 3],
    [1, 0, 'field', 5],
    [-0.5, 1, 'rock', 2],
    [0.5, 1, 'shore', 6],
    [1.5, 1, 'hill', 0],
  ];
  const pos = (q: number, r: number) => ({ x: 80 + q * S * SQ3, y: 57 + r * S * 1.5 });
  const pts = (scale: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = ((60 * i - 90) * Math.PI) / 180;
      return `${(60 * scale * Math.cos(a)).toFixed(1)},${(60 * scale * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
  /** 칸 (q, r)의 i번째 꼭짓점 (위에서 시계 방향) */
  const corner = (q: number, r: number, i: number) => {
    const p = pos(q, r);
    const a = ((60 * i - 90) * Math.PI) / 180;
    return { x: p.x + S * Math.cos(a), y: p.y + S * Math.sin(a) };
  };
  const house = corner(0, 0, 4);
  const hall = corner(0, 0, 2);
  const road = [corner(0, 0, 4), corner(0, 0, 3)];
  const light = corner(1.5, 1, 2);
  const piece = (x: number, y: number, el: ReactElement) => <g transform={`translate(${x} ${y}) scale(${k}) translate(${-x} ${-y})`}>{el}</g>;
  return (
    <svg className="is-hero-art" viewBox="0 0 200 140" aria-hidden="true">
      <defs>
        <clipPath id="is-hero-clip">
          <polygon points={pts(0.96)} />
        </clipPath>
      </defs>
      <rect x={0} y={0} width={200} height={140} rx={18} fill="#7cc5d8" />
      <circle cx={174} cy={22} r={11} fill="#ffe08a" className="is-hero-sun" />
      {[112, 124].map((y, i) => (
        <path key={y} className="is-hero-wave" style={{ animationDelay: `${i * 0.6}s` }} d={`M${8 + i * 22} ${y} q8 -5 16 0 t16 0 t16 0`} stroke="#e8f8fb" strokeWidth={2} fill="none" strokeLinecap="round" />
      ))}
      {hexes.map(([q, r], i) => {
        const p = pos(q, r);
        return <circle key={`w${i}`} cx={p.x} cy={p.y} r={S * 1.34} fill="#b9e8e6" />;
      })}
      {hexes.map(([q, r], i) => {
        const p = pos(q, r);
        return <circle key={`f${i}`} cx={p.x} cy={p.y} r={S * 1.17} fill="#fdfaf0" />;
      })}
      {hexes.map(([q, r], i) => {
        const p = pos(q, r);
        return <circle key={`s${i}`} cx={p.x} cy={p.y} r={S * 1.11} fill="#f2e0b0" />;
      })}
      {hexes.map(([q, r, t, n], i) => {
        const p = pos(q, r);
        return (
          <g key={i} transform={`translate(${p.x} ${p.y}) scale(${k})`}>
            <polygon points={pts(0.985)} fill={TERRAIN_FILL[t][1]} stroke="rgba(90,66,30,0.55)" strokeWidth={2.5} />
            <g clipPath="url(#is-hero-clip)">
              <TerrainArt terrain={t} cx={0} cy={0} variant={i} />
            </g>
            {n > 0 && <NumberToken n={n} cx={0} cy={0} />}
          </g>
        );
      })}
      <line x1={road[0].x} y1={road[0].y} x2={road[1].x} y2={road[1].y} stroke="#a52a2f" strokeWidth={4.2} strokeLinecap="round" />
      <line x1={road[0].x} y1={road[0].y} x2={road[1].x} y2={road[1].y} stroke="#e5484d" strokeWidth={2.6} strokeLinecap="round" />
      {piece(house.x, house.y, <HouseShape x={house.x} y={house.y + 3} color="#e5484d" dark="#a52a2f" shape="circle" />)}
      {piece(hall.x, hall.y, <HallShape x={hall.x} y={hall.y + 2} color="#3e63dd" dark="#25409a" shape="diamond" />)}
      {piece(light.x, light.y, <HouseShape x={light.x} y={light.y + 3} color="#30a46c" dark="#1d6b45" shape="leaf" />)}
      {piece(light.x + 9, light.y - 4, <LighthouseShape x={light.x + 9} y={light.y - 4} color="#30a46c" dark="#1d6b45" />)}
      <g transform="translate(26 40) scale(0.55)">
        <path d="M-18 4 H18 L12 13 H-12 Z" fill="#b5713f" stroke="#6b3f1f" strokeWidth={1.4} strokeLinejoin="round" />
        <path d="M0 4 V-26" stroke="#6b3f1f" strokeWidth={1.6} />
        <path d="M1 -25 L16 1 H1 Z" fill="#fffaf0" stroke="#a89a80" strokeWidth={1} strokeLinejoin="round" />
        <path d="M-1 -20 L-12 1 H-1 Z" fill="#ffd166" stroke="#a89a80" strokeWidth={1} strokeLinejoin="round" />
      </g>
      <path className="is-hero-gull" d="M144 48 q6 -6 12 0 q6 -6 12 0" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" />
    </svg>
  );
}
