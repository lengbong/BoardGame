import type { ReactNode } from 'react';
import { GOALS } from './cards';
import type { GoalId, PlantArt, Token } from './types';

/**
 * 꽃밭 가꾸기 그림 (모두 직접 그린 SVG).
 * 토큰은 동그란 칩에 모양이 다른 그림(물방울·해·새싹·지렁이·꿀벌)을 넣어서 색을 구별하기 어려워도 알아볼 수 있다.
 */

// ------------------------------------------------------------------ 토큰

const CHIP: Record<Token, { bg: string; rim: string }> = {
  water: { bg: '#d9eefc', rim: '#4a90d9' },
  sun: { bg: '#fff3c4', rim: '#e8a317' },
  seed: { bg: '#e6f4d7', rim: '#5d9b3a' },
  compost: { bg: '#ead7c0', rim: '#8a5a33' },
  bee: { bg: '#ffe48a', rim: '#3b2f1e' },
};

function TokenSymbol({ token }: { token: Token }) {
  switch (token) {
    case 'water':
      return (
        <g>
          <path d="M20 7 C20 7 11 18 11 24 a9 9 0 0 0 18 0 C29 18 20 7 20 7z" fill="#3d8fe0" stroke="#1f5fa8" strokeWidth={1.4} strokeLinejoin="round" />
          <path d="M15.5 24.5 a4.5 4.5 0 0 0 3.5 4.4" fill="none" stroke="#cfe8ff" strokeWidth={2} strokeLinecap="round" />
        </g>
      );
    case 'sun':
      return (
        <g>
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d="M20 5.5 L22.2 10.5 L17.8 10.5z" fill="#f29a0e" transform={`rotate(${i * 45} 20 20)`} />
          ))}
          <circle cx={20} cy={20} r={7.6} fill="#ffc21a" stroke="#e07b00" strokeWidth={1.4} />
          <circle cx={17.6} cy={19} r={1} fill="#7a4100" />
          <circle cx={22.4} cy={19} r={1} fill="#7a4100" />
          <path d="M17.4 22.2 q2.6 2.2 5.2 0" fill="none" stroke="#7a4100" strokeWidth={1.1} strokeLinecap="round" />
        </g>
      );
    case 'seed':
      return (
        <g>
          <ellipse cx={20} cy={27} rx={6} ry={4.2} fill="#a8743f" stroke="#6e4520" strokeWidth={1.3} />
          <path d="M20 25 C20 20 20 17 20 14" stroke="#3f8f2a" strokeWidth={2} fill="none" strokeLinecap="round" />
          <path d="M20 16 C15 16 12 13 11.5 9.5 C16 9.5 19 12 20 16z" fill="#6cc04a" stroke="#3f8f2a" strokeWidth={1.2} strokeLinejoin="round" />
          <path d="M20 14.5 C24 14.5 27.5 12 28.5 8 C24 8 21 10.5 20 14.5z" fill="#86d35f" stroke="#3f8f2a" strokeWidth={1.2} strokeLinejoin="round" />
        </g>
      );
    case 'compost':
      return (
        <g>
          <path d="M7 28 C10 18 30 18 33 28z" fill="#6b4425" stroke="#4a2c14" strokeWidth={1.2} strokeLinejoin="round" />
          <circle cx={14} cy={25} r={1.2} fill="#a87a4c" />
          <circle cx={24} cy={23} r={1} fill="#a87a4c" />
          <path d="M11 16 c3 -5 7 2 10 -2 s6 -2 8 2" fill="none" stroke="#e98fa0" strokeWidth={3.4} strokeLinecap="round" />
          <circle cx={28.6} cy={15.6} r={0.8} fill="#4a2c14" />
        </g>
      );
    case 'bee':
      return (
        <g>
          <ellipse cx={15} cy={13.5} rx={5} ry={3.6} fill="#ffffff" stroke="#7d8ea8" strokeWidth={1} opacity={0.95} transform="rotate(-25 15 13.5)" />
          <ellipse cx={24} cy={13} rx={5} ry={3.6} fill="#ffffff" stroke="#7d8ea8" strokeWidth={1} opacity={0.95} transform="rotate(25 24 13)" />
          <ellipse cx={20} cy={22} rx={9} ry={7} fill="#ffcc1f" stroke="#3b2f1e" strokeWidth={1.4} />
          <path d="M16.5 15.6 v12.8 M22.5 15.4 v13.2" stroke="#3b2f1e" strokeWidth={2.6} />
          <circle cx={27} cy={20.5} r={1.1} fill="#3b2f1e" />
          <path d="M11 22 l-2.6 0.6" stroke="#3b2f1e" strokeWidth={1.6} strokeLinecap="round" />
        </g>
      );
  }
}

/** 토큰 하나 (칩 모양) */
export function TokenIcon({ token, size = 28, className }: { token: Token; size?: number; className?: string }) {
  const c = CHIP[token];
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className ?? 'gd-token-svg'} aria-hidden="true" focusable="false">
      <circle cx={20} cy={21.2} r={18} fill="rgba(0,0,0,0.22)" />
      <circle cx={20} cy={20} r={18} fill={c.bg} stroke={c.rim} strokeWidth={2.4} />
      <circle cx={20} cy={20} r={14.6} fill="none" stroke={c.rim} strokeWidth={0.8} strokeDasharray="2 2.2" opacity={0.55} />
      <TokenSymbol token={token} />
    </svg>
  );
}

// ------------------------------------------------------------------ 식물

const STEM = '#4f9a3a';
const LEAF = '#69b64a';
const LEAF_DARK = '#3e7f2c';
const TRUNK = '#8a5a33';

function petalRing(cx: number, cy: number, n: number, dist: number, rx: number, ry: number, fill: string, stroke?: string, offset = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = offset + (360 / n) * i;
    return <ellipse key={i} cx={cx} cy={cy - dist} rx={rx} ry={ry} fill={fill} stroke={stroke} strokeWidth={stroke ? 0.8 : 0} transform={`rotate(${a} ${cx} ${cy})`} />;
  });
}

function leaf(x: number, y: number, len: number, angle: number, fill = LEAF, key?: string | number) {
  return (
    <path
      key={key}
      d={`M0 0 C${len * 0.3} ${-len * 0.28} ${len * 0.75} ${-len * 0.25} ${len} 0 C${len * 0.75} ${len * 0.25} ${len * 0.3} ${len * 0.28} 0 0z`}
      fill={fill}
      stroke={LEAF_DARK}
      strokeWidth={0.8}
      transform={`translate(${x} ${y}) rotate(${angle})`}
    />
  );
}

function ground() {
  return <ellipse cx={30} cy={54} rx={20} ry={3.2} fill="#8b6a45" opacity={0.35} />;
}

function canopy(fill: string, extra?: ReactNode) {
  return (
    <g>
      <path d="M28 54 L28 36 M32 54 L32 36" stroke={TRUNK} strokeWidth={3} />
      <rect x={27} y={34} width={6} height={20} rx={2} fill={TRUNK} />
      <path d="M30 40 L22 33 M30 38 L38 31" stroke={TRUNK} strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={20} cy={26} r={11} fill={fill} />
      <circle cx={40} cy={26} r={11} fill={fill} />
      <circle cx={30} cy={18} r={13} fill={fill} />
      <circle cx={30} cy={29} r={10} fill={fill} />
      {extra}
    </g>
  );
}

function PlantShape({ art }: { art: PlantArt }) {
  const { color, accent = '#f6d64a' } = art;
  switch (art.shape) {
    case 'star':
      return (
        <g>
          {ground()}
          <path d="M30 54 C26 40 18 30 12 18 M30 54 C32 38 36 26 44 14 M30 54 C30 42 29 30 30 10" stroke="#8a6a3a" strokeWidth={1.8} fill="none" strokeLinecap="round" />
          {[
            [13, 20],
            [17, 28],
            [22, 36],
            [42, 17],
            [38, 25],
            [35, 33],
            [30, 13],
            [29.5, 23],
            [30, 33],
            [25, 44],
          ].map(([x, y], i) => (
            <g key={i}>{petalRing(x, y, 4, 2.6, 1.6, 2.6, color, '#c99700', i * 20)}</g>
          ))}
          {leaf(33, 44, 8, -20, accent, 'l')}
        </g>
      );
    case 'bell':
      return (
        <g>
          {ground()}
          <path d="M30 54 C30 40 26 30 22 22 M30 50 C34 40 38 32 42 24 M30 46 C30 36 31 26 31 18" stroke={STEM} strokeWidth={1.8} fill="none" />
          {leaf(30, 46, 11, 200, LEAF, 'a')}
          {leaf(30, 42, 11, -20, LEAF, 'b')}
          {[
            [21, 20, -20],
            [42, 22, 20],
            [31, 14, 0],
          ].map(([x, y, r], i) => (
            <g key={i} transform={`rotate(${r} ${x} ${y})`}>
              <path d={`M${x - 8} ${y - 5} Q${x - 9} ${y + 6} ${x} ${y + 7} Q${x + 9} ${y + 6} ${x + 8} ${y - 5} Q${x + 5} ${y - 2} ${x + 3} ${y - 6} Q${x} ${y - 2} ${x - 3} ${y - 6} Q${x - 5} ${y - 2} ${x - 8} ${y - 5}z`} fill={color} stroke={accent} strokeWidth={1} />
              <circle cx={x} cy={y + 1} r={1.6} fill={accent} />
            </g>
          ))}
        </g>
      );
    case 'puff':
      return (
        <g>
          {ground()}
          <path d="M22 54 C22 44 20 36 18 26 M38 54 C38 42 40 30 41 20" stroke={STEM} strokeWidth={1.8} fill="none" />
          {leaf(30, 53, 14, 200, LEAF, 'a')}
          {leaf(30, 53, 14, -20, LEAF, 'b')}
          {petalRing(18, 24, 14, 5, 1.6, 4.4, color, '#d39b00')}
          <circle cx={18} cy={24} r={3.2} fill="#f0a800" />
          <circle cx={41} cy={17} r={10} fill="#ffffff" stroke="#c8d0d8" strokeWidth={0.8} opacity={0.95} />
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d="M41 17 L41 8" stroke="#b8c2cc" strokeWidth={0.7} transform={`rotate(${i * 30} 41 17)`} />
          ))}
          <circle cx={41} cy={17} r={1.5} fill="#9aa5b0" />
        </g>
      );
    case 'violet':
      return (
        <g>
          {ground()}
          {[
            [18, 50, 0],
            [30, 52, 0],
            [42, 50, 0],
          ].map(([x, y], i) => (
            <path key={i} d={`M${x} ${y} c-8 -4 -8 -14 0 -12 c8 -2 8 8 0 12z`} fill={LEAF} stroke={LEAF_DARK} strokeWidth={0.8} />
          ))}
          <path d="M24 44 C24 34 22 28 20 24 M36 44 C36 32 38 26 40 20" stroke={STEM} strokeWidth={1.6} fill="none" />
          {[
            [20, 22],
            [40, 18],
          ].map(([x, y], i) => (
            <g key={i}>
              {petalRing(x, y, 5, 4, 3.4, 4.4, color, '#4b3392', 36)}
              <circle cx={x} cy={y} r={2.2} fill={accent} />
            </g>
          ))}
        </g>
      );
    case 'tulip':
      return (
        <g>
          {ground()}
          <path d="M30 54 L30 26" stroke={STEM} strokeWidth={2.2} />
          <path d="M30 54 C20 50 16 40 18 30 C24 36 28 44 30 54z" fill={LEAF} stroke={LEAF_DARK} strokeWidth={0.8} />
          <path d="M30 54 C40 50 44 42 42 32 C36 38 32 46 30 54z" fill={LEAF} stroke={LEAF_DARK} strokeWidth={0.8} />
          <path d="M20 12 C20 24 24 28 30 28 C36 28 40 24 40 12 C36 16 34 14 33 10 C31 14 29 14 27 10 C26 14 24 16 20 12z" fill={color} stroke="#a52a2a" strokeWidth={1} />
          <path d="M27 12 C27 20 28 24 30 27" stroke={accent} strokeWidth={1.4} fill="none" opacity={0.8} />
        </g>
      );
    case 'daffodil':
      return (
        <g>
          {ground()}
          <path d="M30 54 C30 42 30 34 32 26" stroke={STEM} strokeWidth={2} fill="none" />
          <path d="M26 54 C22 44 22 36 24 28" stroke={LEAF} strokeWidth={3} fill="none" strokeLinecap="round" />
          <path d="M36 54 C40 46 42 38 40 30" stroke={LEAF} strokeWidth={3} fill="none" strokeLinecap="round" />
          {petalRing(32, 20, 6, 6, 4, 6.4, color, '#d9c35a', 0)}
          <circle cx={32} cy={20} r={5} fill={accent} stroke="#c06a00" strokeWidth={1} />
          <circle cx={32} cy={20} r={2.6} fill="#ffcf6a" />
        </g>
      );
    case 'leafy':
      return (
        <g>
          {ground()}
          {[-60, -30, 0, 30, 60].map((a, i) => (
            <ellipse key={i} cx={30} cy={34} rx={8} ry={16} fill={i % 2 ? accent : color} stroke={LEAF_DARK} strokeWidth={0.8} transform={`rotate(${a} 30 52)`} />
          ))}
          {[-45, -15, 15, 45].map((a, i) => (
            <ellipse key={`f${i}`} cx={30} cy={38} rx={6.4} ry={13} fill={color} stroke={LEAF_DARK} strokeWidth={0.8} transform={`rotate(${a} 30 52)`} />
          ))}
          <ellipse cx={30} cy={40} rx={6} ry={12} fill={color} stroke={LEAF_DARK} strokeWidth={0.8} />
          <path d="M30 50 L30 30" stroke="#e9f7d8" strokeWidth={1} opacity={0.8} />
        </g>
      );
    case 'pod':
      return (
        <g>
          {ground()}
          <path d="M18 54 C18 40 24 30 22 14 M42 54 C40 40 36 28 40 12" stroke={STEM} strokeWidth={1.8} fill="none" />
          <path d="M22 14 c4 -4 8 0 4 3 c-3 2 -6 -1 -3 -3" stroke={STEM} strokeWidth={1} fill="none" />
          {leaf(20, 34, 10, 200, LEAF, 'a')}
          {leaf(40, 30, 10, -20, LEAF, 'b')}
          {[
            [24, 24, 30],
            [36, 38, -30],
            [30, 30, 10],
          ].map(([x, y, r], i) => (
            <g key={i} transform={`rotate(${r} ${x} ${y})`}>
              <path d={`M${x - 3} ${y - 9} C${x + 4} ${y - 6} ${x + 4} ${y + 6} ${x - 1} ${y + 10} C${x - 5} ${y + 4} ${x - 6} ${y - 4} ${x - 3} ${y - 9}z`} fill={color} stroke={LEAF_DARK} strokeWidth={0.9} />
              {[-4, 0, 4].map((d) => (
                <circle key={d} cx={x - 1} cy={y + d} r={1.6} fill={accent} />
              ))}
            </g>
          ))}
        </g>
      );
    case 'sprig':
      return (
        <g>
          {ground()}
          {[
            [22, -14],
            [30, 0],
            [38, 14],
          ].map(([x, r], i) => (
            <g key={i} transform={`rotate(${r} 30 54)`}>
              <path d={`M${x} 54 L${x} 14`} stroke={STEM} strokeWidth={1.6} />
              {[46, 38, 30, 22].map((y, k) => (
                <g key={k}>
                  {leaf(x, y, 8 - k, 210 + k * 6, color, `l${k}`)}
                  {leaf(x, y - 3, 8 - k, -30 - k * 6, color, `r${k}`)}
                </g>
              ))}
              <circle cx={x} cy={13} r={2} fill={accent} stroke={LEAF_DARK} strokeWidth={0.5} />
            </g>
          ))}
        </g>
      );
    case 'blossomTree':
    case 'fruitTree':
    case 'roundTree': {
      const leafColor = art.shape === 'blossomTree' ? '#7cbf5a' : accent;
      const dots: [number, number][] = [
        [20, 22],
        [28, 12],
        [38, 18],
        [43, 28],
        [17, 31],
        [31, 26],
        [24, 34],
        [37, 33],
        [33, 8],
      ];
      return (
        <g>
          {ground()}
          {canopy(
            leafColor,
            dots.map(([x, y], i) =>
              art.shape === 'blossomTree' ? (
                <g key={i}>{petalRing(x, y, 5, 2.2, 1.8, 2.4, color, accent, i * 13)}</g>
              ) : art.shape === 'roundTree' ? (
                <g key={i}>
                  <circle cx={x} cy={y} r={3.2} fill="#c9a54a" stroke={color} strokeWidth={0.8} />
                  {Array.from({ length: 8 }, (_, k) => (
                    <path key={k} d={`M${x} ${y - 3} L${x} ${y - 5}`} stroke="#9a7a2a" strokeWidth={0.7} transform={`rotate(${k * 45} ${x} ${y})`} />
                  ))}
                </g>
              ) : (
                <g key={i}>
                  <circle cx={x} cy={y} r={3.1} fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth={0.6} />
                  <circle cx={x - 1} cy={y - 1} r={0.9} fill="#fff" opacity={0.6} />
                </g>
              ),
            ),
          )}
        </g>
      );
    }
    case 'sunflower':
      return (
        <g>
          {ground()}
          <path d="M30 54 L30 28" stroke={STEM} strokeWidth={2.6} />
          {leaf(30, 44, 13, 200, LEAF, 'a')}
          {leaf(30, 38, 13, -20, LEAF, 'b')}
          {petalRing(30, 18, 16, 9, 2.6, 5, color, '#d48a00')}
          <circle cx={30} cy={18} r={7.4} fill={accent} />
          {Array.from({ length: 10 }, (_, i) => (
            <circle key={i} cx={30 + 4 * Math.cos(i * 0.63)} cy={18 + 4 * Math.sin(i * 0.63)} r={0.8} fill="#3a2010" />
          ))}
        </g>
      );
    case 'hydrangea':
      return (
        <g>
          {ground()}
          {leaf(30, 50, 15, 200, LEAF, 'a')}
          {leaf(30, 50, 15, -20, LEAF, 'b')}
          <path d="M30 54 L30 34" stroke={STEM} strokeWidth={2} />
          {[
            [22, 24],
            [30, 18],
            [38, 24],
            [26, 31],
            [34, 31],
            [30, 25],
            [21, 16],
            [39, 16],
            [30, 10],
          ].map(([x, y], i) => (
            <g key={i}>
              {petalRing(x, y, 4, 2.4, 2.2, 2.6, i % 3 === 0 ? accent : color, 'rgba(0,0,0,0.25)', 45)}
              <circle cx={x} cy={y} r={0.8} fill="#fff" />
            </g>
          ))}
        </g>
      );
    case 'trumpet':
      return (
        <g>
          {ground()}
          <path d="M14 54 C10 40 22 34 18 24 C14 14 26 10 30 16 C34 22 44 18 46 10" stroke={STEM} strokeWidth={1.6} fill="none" />
          {leaf(16, 36, 10, 160, LEAF, 'a')}
          {leaf(38, 18, 9, -40, LEAF, 'b')}
          {[
            [24, 32, 12],
            [40, 32, 10],
          ].map(([x, y, r], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={r} fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth={0.8} />
              {Array.from({ length: 5 }, (_, k) => (
                <path key={k} d={`M${x} ${y} L${x} ${y - r}`} stroke={accent} strokeWidth={1.2} opacity={0.7} transform={`rotate(${k * 72} ${x} ${y})`} />
              ))}
              <circle cx={x} cy={y} r={r * 0.32} fill="#fff" opacity={0.9} />
            </g>
          ))}
        </g>
      );
    case 'rose':
      return (
        <g>
          {ground()}
          <path d="M30 54 L30 30" stroke={STEM} strokeWidth={2.2} />
          {leaf(30, 46, 11, 205, LEAF, 'a')}
          {leaf(30, 40, 11, -25, LEAF, 'b')}
          <circle cx={30} cy={20} r={12} fill={color} stroke={accent} strokeWidth={1.2} />
          <path d="M30 20 m-7 2 a7 7 0 1 1 12 3 a5 5 0 1 1 -8 -5 a3 3 0 1 1 4 3" fill="none" stroke={accent} strokeWidth={1.4} strokeLinecap="round" />
          <path d="M19 24 C22 32 38 32 41 24" fill="none" stroke={accent} strokeWidth={1.2} />
        </g>
      );
    case 'vine':
      return (
        <g>
          {ground()}
          <path d="M8 50 C18 40 28 50 36 40 C44 30 50 34 54 24" stroke={STEM} strokeWidth={1.8} fill="none" />
          {[
            [16, 42],
            [34, 40],
            [50, 28],
          ].map(([x, y], i) => (
            <path key={i} d={`M${x} ${y} c-6 -2 -8 -10 -2 -14 c2 3 6 3 8 0 c4 6 0 12 -6 14z`} fill={LEAF} stroke={LEAF_DARK} strokeWidth={0.8} />
          ))}
          {[
            [22, 44, 20],
            [42, 38, -10],
          ].map(([x, y, r], i) => (
            <g key={i} transform={`rotate(${r} ${x} ${y})`}>
              <rect x={x - 3.4} y={y} width={6.8} height={16} rx={3.4} fill={color} stroke="#24601f" strokeWidth={0.8} />
              {[4, 8, 12].map((d) => (
                <circle key={d} cx={x - 1} cy={y + d} r={0.6} fill="#d8f0c0" />
              ))}
            </g>
          ))}
          {petalRing(28, 24, 5, 2.4, 1.8, 2.6, accent, '#c9a000')}
        </g>
      );
    case 'fruitVeg':
      return (
        <g>
          {ground()}
          <path d="M30 54 L30 12 M30 30 L18 22 M30 24 L42 16" stroke={accent} strokeWidth={1.8} fill="none" />
          {leaf(30, 40, 11, 200, LEAF, 'a')}
          {leaf(30, 34, 11, -20, LEAF, 'b')}
          {leaf(30, 14, 8, -80, LEAF, 'c')}
          {(art.color === '#6b2f8f'
            ? [
                [18, 30, 4.5, 9],
                [42, 24, 4.5, 9],
              ]
            : [
                [18, 28, 6, 6],
                [42, 22, 6, 6],
                [30, 40, 5, 5],
              ]
          ).map(([x, y, rx, ry], i) => (
            <g key={i}>
              <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth={0.8} />
              <path d={`M${x - 2.4} ${y - ry + 0.6} L${x} ${y - ry - 1.6} L${x + 2.4} ${y - ry + 0.6}`} fill={LEAF_DARK} />
              <ellipse cx={x - rx * 0.35} cy={y - ry * 0.35} rx={rx * 0.25} ry={ry * 0.2} fill="#fff" opacity={0.45} />
            </g>
          ))}
        </g>
      );
    case 'corn':
      return (
        <g>
          {ground()}
          <path d="M30 54 L30 6" stroke={STEM} strokeWidth={3} />
          <path d="M30 50 C18 46 12 36 10 28 M30 42 C42 38 48 30 50 22 M30 32 C22 26 18 18 18 12" stroke={LEAF} strokeWidth={3.4} fill="none" strokeLinecap="round" />
          <ellipse cx={36} cy={30} rx={5.4} ry={11} fill={color} stroke="#b9860a" strokeWidth={0.9} transform="rotate(15 36 30)" />
          {[-6, -2, 2, 6].map((d) => (
            <path key={d} d={`M${32 + d * 0.3} ${30 + d} h8`} stroke="#d39e14" strokeWidth={0.7} transform="rotate(15 36 30)" />
          ))}
          <path d="M31 40 C30 32 31 24 34 18 M41 40 C42 32 41 24 38 18" stroke={accent} strokeWidth={2.4} fill="none" transform="rotate(15 36 30)" />
          <path d="M30 6 l-3 -4 M30 6 l3 -4 M30 6 l0 -5" stroke="#c9a46a" strokeWidth={1} />
        </g>
      );
    case 'spike':
      return (
        <g>
          {ground()}
          {[
            [20, -12],
            [30, 0],
            [40, 12],
          ].map(([x, r], i) => (
            <g key={i} transform={`rotate(${r} 30 54)`}>
              <path d={`M${x} 54 L${x} 10`} stroke={accent} strokeWidth={1.6} />
              {[12, 16, 20, 24, 28].map((y, k) => (
                <g key={k}>
                  <ellipse cx={x - 1.6} cy={y} rx={1.8} ry={2.6} fill={color} />
                  <ellipse cx={x + 1.6} cy={y + 2} rx={1.8} ry={2.6} fill={color} />
                </g>
              ))}
              {leaf(x, 44, 7, 215, LEAF, 'a')}
              {leaf(x, 40, 7, -35, LEAF, 'b')}
            </g>
          ))}
        </g>
      );
    case 'daisy':
      return (
        <g>
          {ground()}
          <path d="M22 54 C22 44 20 36 20 28 M38 54 C38 44 40 36 40 22" stroke={STEM} strokeWidth={1.6} fill="none" />
          {leaf(22, 46, 9, 205, LEAF, 'a')}
          {leaf(38, 44, 9, -25, LEAF, 'b')}
          {[
            [20, 26, 8],
            [40, 18, 9.5],
          ].map(([x, y, r], i) => (
            <g key={i}>
              {petalRing(x, y, 12, r * 0.6, r * 0.18, r * 0.42, color, '#c8b7d8')}
              <circle cx={x} cy={y} r={r * 0.3} fill={accent} stroke="#b07a00" strokeWidth={0.6} />
            </g>
          ))}
        </g>
      );
    case 'mum':
      return (
        <g>
          {ground()}
          <path d="M30 54 L30 32" stroke={STEM} strokeWidth={2} />
          {leaf(30, 46, 12, 200, LEAF_DARK, 'a')}
          {leaf(30, 40, 12, -20, LEAF_DARK, 'b')}
          {petalRing(30, 20, 18, 9, 1.8, 4.4, accent)}
          {petalRing(30, 20, 14, 6, 1.8, 3.8, color, undefined, 12)}
          {petalRing(30, 20, 10, 3, 1.6, 3, color, accent, 5)}
        </g>
      );
    case 'spider':
      return (
        <g>
          {ground()}
          <path d="M30 54 L30 26" stroke={STEM} strokeWidth={2} />
          {Array.from({ length: 6 }, (_, i) => (
            <path key={i} d="M30 22 C34 16 36 10 33 5" stroke={accent} strokeWidth={0.9} fill="none" transform={`rotate(${i * 60 - 150} 30 22)`} />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <path key={`p${i}`} d="M30 22 C33 18 38 16 41 18 C38 18 34 20 30 22z" fill={color} stroke="#9c1018" strokeWidth={0.6} transform={`rotate(${i * 60} 30 22)`} />
          ))}
          <circle cx={30} cy={22} r={2} fill="#9c1018" />
        </g>
      );
    case 'cabbage':
      return (
        <g>
          {ground()}
          <path d="M14 52 C8 40 12 22 26 14 C22 28 22 40 26 52z" fill={color} stroke={LEAF_DARK} strokeWidth={0.8} />
          <path d="M46 52 C52 40 48 22 34 14 C38 28 38 40 34 52z" fill={color} stroke={LEAF_DARK} strokeWidth={0.8} />
          <path d="M20 52 C16 36 22 18 30 10 C38 18 44 36 40 52z" fill={accent} stroke="#9aaa70" strokeWidth={0.8} />
          <path d="M30 52 L30 14 M30 30 L24 22 M30 38 L36 30" stroke="#c8d6a0" strokeWidth={1} />
          <path d="M24 52 C22 40 26 26 30 18 C34 26 38 40 36 52z" fill="#fbf8e6" stroke="#c8c49a" strokeWidth={0.6} opacity={0.85} />
        </g>
      );
    case 'root':
      return (
        <g>
          <rect x={6} y={34} width={48} height={22} rx={6} fill="#a07850" opacity={0.35} />
          <path d={`M24 36 C22 46 26 54 30 58 C34 54 38 46 36 36z`} fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth={0.8} />
          <path d="M27 42 h5 M28 48 h4" stroke="rgba(0,0,0,0.25)" strokeWidth={0.7} />
          {[
            [-30, 14],
            [-8, 18],
            [12, 17],
            [32, 13],
          ].map(([a, len], i) => (
            <g key={i}>{leaf(30, 36, len, -90 + a, LEAF, i)}</g>
          ))}
          {art.accent && art.accent !== '#5aa040' && art.accent !== '#7cb342' && (
            <g>
              <path d="M30 36 L30 12" stroke={STEM} strokeWidth={1.2} />
              {Array.from({ length: 6 }, (_, k) => (
                <circle key={k} cx={30 + 2.2 * Math.cos(k)} cy={10 + 2 * Math.sin(k)} r={1.6} fill={accent} />
              ))}
            </g>
          )}
        </g>
      );
    case 'pumpkin':
      return (
        <g>
          {ground()}
          <path d="M44 40 C50 34 54 30 56 24" stroke={STEM} strokeWidth={1.6} fill="none" />
          <path d="M48 30 c-6 -2 -8 -10 -2 -14 c2 3 6 3 8 0 c4 6 0 12 -6 14z" fill={LEAF} stroke={LEAF_DARK} strokeWidth={0.8} />
          <ellipse cx={30} cy={40} rx={18} ry={13} fill={color} stroke="#b45a0c" strokeWidth={1} />
          <ellipse cx={30} cy={40} rx={11} ry={13} fill="none" stroke="#c96a12" strokeWidth={1} />
          <ellipse cx={30} cy={40} rx={4.5} ry={13} fill="none" stroke="#c96a12" strokeWidth={1} />
          <path d="M30 27 C30 22 32 20 35 19" stroke={accent} strokeWidth={3} fill="none" strokeLinecap="round" />
        </g>
      );
    case 'fanTree':
      return (
        <g>
          {ground()}
          <rect x={27} y={32} width={6} height={22} rx={2} fill={TRUNK} />
          {[
            [18, 22],
            [30, 12],
            [42, 22],
            [24, 30],
            [36, 30],
            [30, 22],
            [14, 32],
            [46, 32],
          ].map(([x, y], i) => (
            <path key={i} d={`M${x} ${y + 5} L${x - 6} ${y - 3} Q${x} ${y - 7} ${x + 6} ${y - 3}z`} fill={i % 2 ? color : accent} stroke="#a37a00" strokeWidth={0.7} transform={`rotate(${(i % 3) * 14 - 14} ${x} ${y})`} />
          ))}
        </g>
      );
    case 'mapleTree':
      return (
        <g>
          {ground()}
          <rect x={27} y={32} width={6} height={22} rx={2} fill={TRUNK} />
          <path d="M30 40 L20 32 M30 36 L40 28" stroke={TRUNK} strokeWidth={2.2} strokeLinecap="round" />
          {[
            [18, 24],
            [30, 14],
            [42, 24],
            [24, 32],
            [36, 32],
            [30, 24],
            [20, 14],
            [40, 14],
          ].map(([x, y], i) => (
            <path
              key={i}
              d={`M${x} ${y - 6} L${x + 1.6} ${y - 2} L${x + 5.6} ${y - 3} L${x + 3} ${y + 0.6} L${x + 4.6} ${y + 4} L${x} ${y + 2} L${x - 4.6} ${y + 4} L${x - 3} ${y + 0.6} L${x - 5.6} ${y - 3} L${x - 1.6} ${y - 2}z`}
              fill={i % 2 ? color : accent}
              stroke="#7a1d0c"
              strokeWidth={0.6}
            />
          ))}
        </g>
      );
  }
}

/** 식물 그림 (viewBox 0 0 60 60) */
export function PlantPicture({ art, size, className }: { art: PlantArt; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 60 60" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <PlantShape art={art} />
    </svg>
  );
}

// ------------------------------------------------------------------ 상장 (로제트)

/** 주름 잡힌 동그란 상장과 리본 꼬리 두 개 */
export function Rosette({ goal, ownerColor, size = 54, dim }: { goal: GoalId; ownerColor?: string; size?: number; dim?: boolean }) {
  const g = GOALS[goal];
  const tail = ownerColor ?? g.color;
  const pleats = 20;
  const pts = Array.from({ length: pleats * 2 }, (_, i) => {
    const r = i % 2 === 0 ? 21 : 18;
    const a = (Math.PI * i) / pleats;
    return `${(24 + r * Math.sin(a)).toFixed(2)},${(22 - r * Math.cos(a)).toFixed(2)}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 48 62" width={size * 0.78} height={size} aria-hidden="true" focusable="false" style={{ opacity: dim ? 0.55 : 1 }}>
      <path d="M15 34 L9 60 L16 55 L21 61 L24 38z" fill={tail} stroke="rgba(0,0,0,0.3)" strokeWidth={0.8} />
      <path d="M33 34 L39 60 L32 55 L27 61 L24 38z" fill={tail} stroke="rgba(0,0,0,0.3)" strokeWidth={0.8} />
      <polygon points={pts} fill={g.color} stroke="rgba(0,0,0,0.3)" strokeWidth={0.8} />
      <circle cx={24} cy={22} r={14} fill="#fffaf0" stroke={g.color} strokeWidth={1.6} />
      <circle cx={24} cy={22} r={11.4} fill="none" stroke={g.color} strokeWidth={0.6} strokeDasharray="1.6 1.4" />
      <text x={24} y={27.5} textAnchor="middle" fontSize={14}>
        {g.icon}
      </text>
    </svg>
  );
}

// ------------------------------------------------------------------ 머리 그림·아이콘

/** 꿀벌집(벌통) 그림 */
export function HiveIcon({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <path d="M8 34 h24 M20 4 v4" stroke="#6b4a2a" strokeWidth={2} strokeLinecap="round" />
      <ellipse cx={20} cy={12} rx={7} ry={4} fill="#f1b93a" stroke="#9a6a14" strokeWidth={1.2} />
      <ellipse cx={20} cy={18} rx={10} ry={5} fill="#f6c54a" stroke="#9a6a14" strokeWidth={1.2} />
      <ellipse cx={20} cy={25} rx={12} ry={6} fill="#f1b93a" stroke="#9a6a14" strokeWidth={1.2} />
      <path d="M17 30 a3 3 0 0 1 6 0 v2 h-6z" fill="#5a3a12" />
    </svg>
  );
}

/** 주머니 그림 */
export function BagIcon({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <path d="M13 10 C10 16 6 22 7 29 C8 36 32 36 33 29 C34 22 30 16 27 10z" fill="#d8b98a" stroke="#8a6a3a" strokeWidth={1.4} />
      <path d="M12 10 q8 4 16 0" stroke="#8a6a3a" strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <path d="M14 7 q6 -4 12 0" stroke="#b5452a" strokeWidth={1.8} fill="none" />
      <circle cx={16} cy={24} r={2.4} fill="#3d8fe0" />
      <circle cx={22} cy={27} r={2.4} fill="#ffc21a" />
      <circle cx={26} cy={22} r={2.4} fill="#6cc04a" />
    </svg>
  );
}
