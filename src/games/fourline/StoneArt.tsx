import { shapeElement } from '../../components/shapes';
import type { DuelSide } from '../common/duel';
import type { Side } from './types';

/**
 * 사목 돌 그림 (직접 그린 SVG). 빨강에는 ●, 노랑에는 ★ 모양을 새겨서 색을 구별하기 어려워도 알아볼 수 있다.
 * 그러데이션은 StoneDefs 한 번만 그려 두고 모든 돌이 함께 쓴다.
 */
export function StoneDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="fl-grad-0" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#ff9a9c" />
          <stop offset="35%" stopColor="#ea4f54" />
          <stop offset="85%" stopColor="#c0353a" />
          <stop offset="100%" stopColor="#9a2428" />
        </radialGradient>
        <radialGradient id="fl-grad-1" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#fff2b0" />
          <stop offset="35%" stopColor="#ffc928" />
          <stop offset="85%" stopColor="#e9a500" />
          <stop offset="100%" stopColor="#bf8200" />
        </radialGradient>
        <radialGradient id="fl-grad-shine" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

const MARK: Record<Side, { shape: 'circle' | 'star'; fill: string; ring: string }> = {
  0: { shape: 'circle', fill: '#8e1b20', ring: '#a3262b' },
  1: { shape: 'star', fill: '#9a6000', ring: '#c58a00' },
};

/** 돌 하나. viewBox 0~100 */
export function Stone({ side, className }: { side: Side; className?: string }) {
  const m = MARK[side];
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="47" fill={`url(#fl-grad-${side})`} />
      <circle cx="50" cy="50" r="35" fill="none" stroke={m.ring} strokeOpacity="0.55" strokeWidth="4" />
      <circle cx="50" cy="50" r="31" fill="#000" opacity="0.06" />
      {shapeElement(m.shape, 50, 51, side === 0 ? 20 : 21, m.fill, { opacity: 0.75 })}
      <ellipse cx="35" cy="28" rx="16" ry="10" transform="rotate(-30 35 28)" fill="url(#fl-grad-shine)" />
    </svg>
  );
}

export const FOURLINE_SIDES: [DuelSide, DuelSide] = [
  { label: '빨강', color: '#d93d42', icon: <Stone side={0} /> },
  { label: '노랑', color: '#f2b100', textColor: '#3a2a00', icon: <Stone side={1} /> },
];

/** 차례 카드 테두리·바탕색 */
export const SIDE_CARD: [{ border: string; bg: string }, { border: string; bg: string }] = [
  { border: '#e5484d', bg: '#fde8e8' },
  { border: '#f5b400', bg: '#fff6d6' },
];

export const SHAPE_NAME: Record<Side, string> = { 0: '●', 1: '★' };
