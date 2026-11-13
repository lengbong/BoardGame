import type { CSSProperties } from 'react';
import { PIP_COLORS, PIP_INK } from './dominoes';

/**
 * 도미노 패 그림 (직접 그린 SVG). 상아색 패, 가운데 칸막이와 놋쇠 핀, 표준 점 배치.
 * 가로 패는 viewBox 200×100 (a가 왼쪽, b가 오른쪽), 세로 패는 100×200 (a가 위, b가 아래).
 */

/** 한 칸(100×100) 안의 점 위치. 가로 패 기준: 6은 긴 쪽으로 셋씩 두 줄 */
export function pipPoints(n: number): [number, number][] {
  switch (n) {
    case 1:
      return [[50, 50]];
    case 2:
      return [
        [27, 27],
        [73, 73],
      ];
    case 3:
      return [
        [25, 25],
        [50, 50],
        [75, 75],
      ];
    case 4:
      return [
        [27, 27],
        [73, 27],
        [27, 73],
        [73, 73],
      ];
    case 5:
      return [
        [25, 25],
        [75, 25],
        [50, 50],
        [25, 75],
        [75, 75],
      ];
    case 6:
      return [
        [24, 28],
        [50, 28],
        [76, 28],
        [24, 72],
        [50, 72],
        [76, 72],
      ];
    default:
      return [];
  }
}

function Pips({ n, ox, oy, vertical, colors }: { n: number | null; ox: number; oy: number; vertical: boolean; colors: boolean }) {
  if (n === null || n <= 0) return null;
  const fill = colors ? PIP_COLORS[n] : PIP_INK;
  return (
    <g fill={fill}>
      {pipPoints(n).map(([x, y], i) => {
        const px = ox + (vertical ? y : x);
        const py = oy + (vertical ? x : y);
        return (
          <g key={i}>
            <circle cx={px} cy={py} r={9.6} />
            <circle cx={px - 2.6} cy={py - 2.6} r={2.6} fill="#fff" opacity={0.32} />
          </g>
        );
      })}
    </g>
  );
}

interface DominoFaceProps {
  a: number | null;
  b: number | null;
  vertical?: boolean;
  /** 숫자마다 점 색을 다르게 */
  colors?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function DominoFace({ a, b, vertical = false, colors = false, className = '', style, title }: DominoFaceProps) {
  const w = vertical ? 100 : 200;
  const h = vertical ? 200 : 100;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`dm-face ${className}`} style={style} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect x={2.5} y={2.5} width={w - 5} height={h - 5} rx={15} fill="#fbf5e4" stroke="#5c4a35" strokeWidth={3.5} />
      {/* 위쪽 윤기, 아래쪽 그늘 */}
      {vertical ? (
        <>
          <rect x={7} y={7} width={22} height={h - 14} rx={10} fill="#fff" opacity={0.55} />
          <rect x={w - 20} y={9} width={12} height={h - 18} rx={6} fill="#c9b88f" opacity={0.35} />
        </>
      ) : (
        <>
          <rect x={7} y={7} width={w - 14} height={22} rx={10} fill="#fff" opacity={0.55} />
          <rect x={9} y={h - 20} width={w - 18} height={12} rx={6} fill="#c9b88f" opacity={0.35} />
        </>
      )}
      {vertical ? (
        <line x1={14} y1={100} x2={86} y2={100} stroke="#6b5a44" strokeWidth={3.5} strokeLinecap="round" />
      ) : (
        <line x1={100} y1={14} x2={100} y2={86} stroke="#6b5a44" strokeWidth={3.5} strokeLinecap="round" />
      )}
      <circle cx={w / 2} cy={h / 2} r={5.5} fill="#b98a3e" stroke="#7d5a22" strokeWidth={1.5} />
      <Pips n={a} ox={0} oy={0} vertical={vertical} colors={colors} />
      <Pips n={b} ox={vertical ? 0 : 100} oy={vertical ? 100 : 0} vertical={vertical} colors={colors} />
    </svg>
  );
}

/** 뒷면: 짙은 청록 바탕에 테두리 선과 마름모 무늬 */
export function DominoBack({ vertical = true, className = '' }: { vertical?: boolean; className?: string }) {
  const w = vertical ? 100 : 200;
  const h = vertical ? 200 : 100;
  const cx = w / 2;
  const cy = h / 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`dm-face dm-back ${className}`} aria-hidden="true">
      <rect x={2.5} y={2.5} width={w - 5} height={h - 5} rx={15} fill="#2c5462" stroke="#142a31" strokeWidth={3.5} />
      <rect x={13} y={13} width={w - 26} height={h - 26} rx={9} fill="none" stroke="#f2e3c0" strokeOpacity={0.5} strokeWidth={4} />
      <polygon points={`${cx},${cy - 26} ${cx + 18},${cy} ${cx},${cy + 26} ${cx - 18},${cy}`} fill="#e9b44c" stroke="#f7e7c4" strokeWidth={3} />
      <circle cx={cx} cy={cy} r={6} fill="#2c5462" />
    </svg>
  );
}
