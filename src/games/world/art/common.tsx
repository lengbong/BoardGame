import { createContext, useContext, useId, type ReactNode } from 'react';

/** 모든 도시 그림은 160×100 좌표계, 지평선은 대략 y=84 */
export const ART_W = 160;
export const ART_H = 100;

/** 같은 그림이 화면에 여러 번 나와도 그라디언트·클립 id가 겹치지 않도록 */
const ArtIdContext = createContext('art');

export function useArtId(name: string): string {
  return `${useContext(ArtIdContext)}-${name}`;
}

interface SceneProps {
  sky: [string, string];
  sun?: { x: number; y: number; r: number; color?: string };
  clouds?: [number, number, number][];
  title?: string;
  className?: string;
  children: ReactNode;
}

export function Scene({ sky, sun, clouds = [], title, className, children }: SceneProps) {
  const id = `a${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <ArtIdContext.Provider value={id}>
      <svg
        className={className}
        viewBox={`0 0 ${ART_W} ${ART_H}`}
        preserveAspectRatio="xMidYMax slice"
        role={title ? 'img' : undefined}
        aria-label={title}
        aria-hidden={title ? undefined : true}
      >
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={sky[0]} />
            <stop offset="1" stopColor={sky[1]} />
          </linearGradient>
        </defs>
        <rect width={ART_W} height={ART_H} fill={`url(#${id}-sky)`} />
        {sun && (
          <g>
            <circle cx={sun.x} cy={sun.y} r={sun.r * 1.9} fill={sun.color ?? '#ffe08a'} opacity="0.22" />
            <circle cx={sun.x} cy={sun.y} r={sun.r} fill={sun.color ?? '#ffe08a'} />
          </g>
        )}
        {clouds.map(([x, y, s], i) => (
          <Cloud key={i} x={x} y={y} s={s} />
        ))}
        {children}
      </svg>
    </ArtIdContext.Provider>
  );
}

export function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#fff" opacity="0.92">
      <ellipse cx="0" cy="2" rx="11" ry="4" />
      <circle cx="-4" cy="0" r="4.5" />
      <circle cx="3" cy="-1.5" r="5.5" />
      <circle cx="8" cy="1" r="3.5" />
    </g>
  );
}

/** 물결선이 있는 물 */
export function Water({ y, color = '#3b8fc4', light = '#7cc0e6' }: { y: number; color?: string; light?: string }) {
  const waves = [];
  for (let row = 0; row < 3; row++) {
    const wy = y + 4 + row * 5;
    for (let x = (row % 2) * 10 + 4; x < ART_W; x += 22) {
      waves.push(<path key={`${row}-${x}`} d={`M${x} ${wy} q3 -1.6 6 0 t6 0`} stroke={light} strokeWidth="0.9" fill="none" opacity="0.8" />);
    }
  }
  return (
    <g>
      <rect x="0" y={y} width={ART_W} height={ART_H - y} fill={color} />
      {waves}
    </g>
  );
}

/** 완만한 언덕 땅 */
export function Ground({ y = 84, color, edge }: { y?: number; color: string; edge?: string }) {
  return (
    <g>
      <path d={`M0 ${y + 1} Q40 ${y - 2} 80 ${y} T160 ${y - 1} V100 H0Z`} fill={color} />
      {edge && <path d={`M0 ${y + 1} Q40 ${y - 2} 80 ${y} T160 ${y - 1}`} stroke={edge} strokeWidth="1.2" fill="none" />}
    </g>
  );
}

export function Tree({ x, y, s = 1, color = '#4f9a4c', dark = '#3d7d3b' }: { x: number; y: number; s?: number; color?: string; dark?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-0.9" y="-5" width="1.8" height="5" fill="#7a5233" />
      <circle cx="0" cy="-8" r="5" fill={color} />
      <circle cx="1.8" cy="-7" r="3.4" fill={dark} opacity="0.55" />
    </g>
  );
}

export function Palm({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0 Q-1.5 -9 1.5 -18" stroke="#8b5a2b" strokeWidth="2" fill="none" strokeLinecap="round" />
      {[-60, -20, 20, 60, 100, 140].map((a) => (
        <ellipse key={a} cx="1.5" cy="-18" rx="7" ry="1.8" fill="#3f9b52" transform={`rotate(${a} 1.5 -18) translate(5 0)`} />
      ))}
    </g>
  );
}

/** 직사각형 건물의 오른쪽 그림자 */
export function Shade({ x, y, w, h, opacity = 0.14 }: { x: number; y: number; w: number; h: number; opacity?: number }) {
  return <rect x={x} y={y} width={w} height={h} fill="#000" opacity={opacity} />;
}
