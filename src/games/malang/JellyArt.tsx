import { memo, type CSSProperties } from 'react';
import { shapeElement } from '../../components/shapes';
import { GARBAGE } from './types';

/**
 * 말랑 팡팡 젤리 그림 — 이 프로젝트에서 직접 그린 SVG.
 * 칸 하나 = 1 × 1 단위. 색마다 이마에 다른 무늬(● 잎 ◆ ★ ♥)가 있어서 색을 구별하기 어려워도 알아볼 수 있다.
 */
export const JELLY_COLORS = [
  { name: '빨강', body: '#ff5d73', dark: '#c22f48', light: '#ffc2cb', mark: 'circle' },
  { name: '초록', body: '#3ccf6e', dark: '#1f8a45', light: '#bff2cf', mark: 'leaf' },
  { name: '파랑', body: '#4a8cff', dark: '#2556c4', light: '#c5d9ff', mark: 'diamond' },
  { name: '노랑', body: '#ffc93c', dark: '#c88f00', light: '#fff0bf', mark: 'star' },
  { name: '보라', body: '#b07cff', dark: '#7a45d1', light: '#e6d7ff', mark: 'heart' },
] as const;

/** 대결 편 색 (딸기, 소다) */
export const SIDE_COLORS = ['#ff5d73', '#4a8cff'];

export const GARBAGE_COLOR = { body: '#bdb7cc', dark: '#7d7590', light: '#eceaf2' };

export function colorOf(c: number): { body: string; dark: string; light: string } {
  return c === GARBAGE ? GARBAGE_COLOR : JELLY_COLORS[c];
}

function Mark({ c }: { c: number }) {
  const mark = JELLY_COLORS[c]?.mark;
  if (!mark) return null;
  if (mark === 'heart') {
    return <path d="M0.5 0.31 C0.44 0.26 0.39 0.22 0.39 0.18 C0.39 0.15 0.42 0.13 0.445 0.13 C0.47 0.13 0.49 0.145 0.5 0.165 C0.51 0.145 0.53 0.13 0.555 0.13 C0.58 0.13 0.61 0.15 0.61 0.18 C0.61 0.22 0.56 0.26 0.5 0.31 Z" fill="#fff" opacity={0.9} />;
  }
  return shapeElement(mark, 0.5, 0.22, 0.085, '#fff', { opacity: 0.9 });
}

export type JellyMood = 'normal' | 'pop' | 'scared' | 'happy' | 'sleep';

interface JellyProps {
  c: number;
  x: number;
  y: number;
  /** 눌림(착지)·커짐 연출: sx, sy */
  sx?: number;
  sy?: number;
  mood?: JellyMood;
  /** 눈 깜빡임 시간 차이 (젤리마다 다르게) */
  blink?: number;
  className?: string;
  /** 조종 중인 조각의 축 젤리 표시 */
  pivot?: boolean;
}

/** 젤리 한 개. (x, y)는 칸의 왼쪽 위 */
export const Jelly = memo(function Jelly({ c, x, y, sx = 1, sy = 1, mood = 'normal', blink = 0, className = '', pivot = false }: JellyProps) {
  const col = colorOf(c);
  const garbage = c === GARBAGE;
  const squash = sx !== 1 || sy !== 1 ? ` translate(0.5 0.95) scale(${sx} ${sy}) translate(-0.5 -0.95)` : '';
  return (
    <g transform={`translate(${x} ${y})${squash}`} className={`mp-jelly ${className}`}>
      <path
        d="M0.5 0.08 C0.82 0.08 0.95 0.33 0.95 0.58 C0.95 0.82 0.78 0.94 0.5 0.94 C0.22 0.94 0.05 0.82 0.05 0.58 C0.05 0.33 0.18 0.08 0.5 0.08 Z"
        fill={col.body}
        stroke={col.dark}
        strokeWidth={0.05}
      />
      <ellipse cx={0.33} cy={0.3} rx={0.13} ry={0.08} fill="#fff" opacity={0.55} transform="rotate(-25 0.33 0.3)" />
      {!garbage && <Mark c={c} />}
      {pivot && <circle cx={0.5} cy={0.52} r={0.47} fill="none" stroke="#fff" strokeWidth={0.05} opacity={0.75} className="mp-pivot" />}
      <g className="mp-face" style={{ '--blink': `${blink}s` } as CSSProperties}>
        {mood === 'sleep' || garbage ? (
          <>
            <path d="M0.3 0.52 Q0.36 0.57 0.42 0.52 M0.58 0.52 Q0.64 0.57 0.7 0.52" fill="none" stroke="#5b5470" strokeWidth={0.045} strokeLinecap="round" />
            <path d="M0.44 0.72 Q0.5 0.69 0.56 0.72" fill="none" stroke="#5b5470" strokeWidth={0.04} strokeLinecap="round" />
          </>
        ) : mood === 'happy' || mood === 'pop' ? (
          <>
            <path d="M0.29 0.55 Q0.36 0.45 0.43 0.55 M0.57 0.55 Q0.64 0.45 0.71 0.55" fill="none" stroke="#2b2240" strokeWidth={0.05} strokeLinecap="round" />
            <path d="M0.4 0.66 Q0.5 0.8 0.6 0.66 Z" fill="#7a2135" />
          </>
        ) : (
          <>
            <g className="mp-eyes">
              <ellipse cx={0.36} cy={0.52} rx={0.055} ry={mood === 'scared' ? 0.09 : 0.075} fill="#2b2240" />
              <ellipse cx={0.64} cy={0.52} rx={0.055} ry={mood === 'scared' ? 0.09 : 0.075} fill="#2b2240" />
              <circle cx={0.375} cy={0.49} r={0.02} fill="#fff" />
              <circle cx={0.655} cy={0.49} r={0.02} fill="#fff" />
            </g>
            {mood === 'scared' ? (
              <ellipse cx={0.5} cy={0.72} rx={0.05} ry={0.04} fill="#7a2135" />
            ) : (
              <path d="M0.43 0.68 Q0.5 0.75 0.57 0.68" fill="none" stroke="#2b2240" strokeWidth={0.04} strokeLinecap="round" />
            )}
          </>
        )}
        {!garbage && <ellipse cx={0.24} cy={0.66} rx={0.07} ry={0.04} fill="#ff8fa3" opacity={0.55} />}
        {!garbage && <ellipse cx={0.76} cy={0.66} rx={0.07} ry={0.04} fill="#ff8fa3" opacity={0.55} />}
      </g>
    </g>
  );
});

/** 같은 색 젤리 두 개 사이를 잇는 다리 (말랑하게 붙어 보이게) */
export function Bridge({ x, y, dir, c }: { x: number; y: number; dir: 'h' | 'v'; c: number }) {
  const col = colorOf(c);
  return dir === 'h' ? (
    <rect x={x + 0.5} y={y + 0.3} width={1} height={0.5} fill={col.body} />
  ) : (
    <rect x={x + 0.22} y={y + 0.5} width={0.56} height={1} fill={col.body} />
  );
}

/** 방해 젤리 예고 아이콘: 1개(작은 젤리), 6개(큰 젤리), 30개(구름) */
export function GarbageIcon({ size }: { size: 1 | 6 | 30 }) {
  if (size === 30) {
    return (
      <svg viewBox="0 0 40 28" className="mp-gicon mp-gicon-30" aria-hidden="true">
        <path d="M8 24 C2 24 1 16 7 14 C6 7 15 4 19 9 C22 3 33 4 33 12 C40 12 40 24 33 24 Z" fill="#9a93ad" stroke="#5f5875" strokeWidth={2} />
        <path d="M14 15 Q16 17 18 15 M23 15 Q25 17 27 15" fill="none" stroke="#3f3a52" strokeWidth={1.6} strokeLinecap="round" />
        <path d="M19 20 Q21 18.5 23 20" fill="none" stroke="#3f3a52" strokeWidth={1.4} strokeLinecap="round" />
      </svg>
    );
  }
  const big = size === 6;
  return (
    <svg viewBox="0 0 20 20" className={`mp-gicon ${big ? 'mp-gicon-6' : 'mp-gicon-1'}`} aria-hidden="true">
      <circle cx={10} cy={11} r={big ? 8.5 : 6} fill={GARBAGE_COLOR.body} stroke={GARBAGE_COLOR.dark} strokeWidth={1.5} />
      <path d={big ? 'M5.5 11 Q7 12.5 8.5 11 M11.5 11 Q13 12.5 14.5 11' : 'M7.3 11 Q8.2 12 9.1 11 M10.9 11 Q11.8 12 12.7 11'} fill="none" stroke="#5b5470" strokeWidth={1.1} strokeLinecap="round" />
    </svg>
  );
}

/** 방해 젤리 수를 아이콘으로 나눈다 (구름 30, 큰 젤리 6, 작은 젤리 1), 최대 6개 */
export function garbageIcons(n: number): (1 | 6 | 30)[] {
  const out: (1 | 6 | 30)[] = [];
  let left = n;
  for (const size of [30, 6, 1] as const) {
    while (left >= size && out.length < 6) {
      out.push(size);
      left -= size;
    }
  }
  return out;
}

/** 다음 조각 (세로로 선 두 젤리) */
export function PairPreview({ colors, small = false }: { colors: [number, number]; small?: boolean }) {
  return (
    <svg viewBox="0 0 1 2" className={`mp-pair${small ? ' mp-pair-small' : ''}`} aria-label={`${JELLY_COLORS[colors[1]].name}·${JELLY_COLORS[colors[0]].name}`}>
      <Jelly c={colors[1]} x={0} y={0} />
      <Jelly c={colors[0]} x={0} y={1} />
    </svg>
  );
}

/** 처음 화면 카드 그림 */
export function MalangIcon() {
  return (
    <svg viewBox="0 0 2.2 2.2" aria-hidden="true">
      <rect x={0.6} y={1.1} width={1} height={0.5} fill={JELLY_COLORS[2].body} />
      <Jelly c={2} x={0.1} y={1.1} mood="happy" />
      <Jelly c={2} x={1.1} y={1.1} />
      <Jelly c={0} x={0.6} y={0.15} mood="happy" />
    </svg>
  );
}
