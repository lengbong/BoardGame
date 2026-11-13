import type { DuelSide } from '../common/duel';
import type { Stone as StoneSide } from './types';

/**
 * 오목 돌 그림 (직접 그린 SVG). 그러데이션은 StoneDefs에 한 번만 그려 두고 모든 돌이 함께 쓴다.
 * 흑돌은 위쪽에 은은한 빛, 백돌은 조개껍데기처럼 살짝 누런 가장자리.
 */
export function StoneDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="ok-black" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#707070" />
          <stop offset="30%" stopColor="#2e2e2e" />
          <stop offset="80%" stopColor="#111" />
          <stop offset="100%" stopColor="#000" />
        </radialGradient>
        <radialGradient id="ok-white" cx="35%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#f3efe6" />
          <stop offset="90%" stopColor="#d6cfbf" />
          <stop offset="100%" stopColor="#b9b09d" />
        </radialGradient>
        <linearGradient id="ok-wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0cf94" />
          <stop offset="55%" stopColor="#e2b673" />
          <stop offset="100%" stopColor="#d4a35c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** 돌 하나 (가운데 cx, cy, 반지름 r). 판 좌표계 안에서 쓴다 */
export function StoneShape({ side, cx, cy, r = 0.46, className }: { side: StoneSide; cx: number; cy: number; r?: number; className?: string }) {
  const black = side === 0;
  return (
    <g className={className}>
      <circle cx={cx + r * 0.08} cy={cy + r * 0.12} r={r} fill="#000" opacity={0.28} />
      <circle cx={cx} cy={cy} r={r} fill={black ? 'url(#ok-black)' : 'url(#ok-white)'} stroke={black ? '#000' : '#9e9580'} strokeWidth={r * 0.04} />
      <ellipse cx={cx - r * 0.3} cy={cy - r * 0.35} rx={r * 0.32} ry={r * 0.18} transform={`rotate(-30 ${cx - r * 0.3} ${cy - r * 0.35})`} fill="#fff" opacity={black ? 0.22 : 0.7} />
    </g>
  );
}

/** 아이콘으로 쓰는 돌 (viewBox 0~1) */
export function Stone({ side }: { side: StoneSide }) {
  return (
    <svg viewBox="-0.05 -0.05 1.1 1.1" className="ok-stone-icon" aria-hidden="true" focusable="false">
      <StoneShape side={side} cx={0.5} cy={0.5} />
    </svg>
  );
}

export const OMOK_SIDES: [DuelSide, DuelSide] = [
  { label: '흑', color: '#2a2a2a', icon: <Stone side={0} /> },
  { label: '백', color: '#efe9dc', textColor: '#2b2724', icon: <Stone side={1} /> },
];

/** 차례 카드 바탕색 */
export const SIDE_CARD: [{ border: string; bg: string }, { border: string; bg: string }] = [
  { border: '#2a2a2a', bg: '#ecebe7' },
  { border: '#b9b09c', bg: '#fffdf6' },
];

/** 처음 화면 카드 그림: 바둑판에 놓인 다섯 돌 */
export function OmokIcon() {
  return (
    <svg viewBox="0 0 5 5" aria-hidden="true">
      <rect x={0} y={0} width={5} height={5} rx={0.5} fill="#e2b673" />
      {[1, 2, 3, 4].map((k) => (
        <g key={k} stroke="#7a5230" strokeWidth={0.06}>
          <line x1={0.5} y1={k} x2={4.5} y2={k} />
          <line x1={k} y1={0.5} x2={k} y2={4.5} />
        </g>
      ))}
      <StoneShape side={1} cx={1} cy={4} r={0.42} />
      <StoneShape side={1} cx={4} cy={1} r={0.42} />
      {[1, 2, 3].map((k) => (
        <StoneShape key={k} side={0} cx={k} cy={k} r={0.42} />
      ))}
      <line x1={0.6} y1={0.6} x2={4.4} y2={4.4} stroke="#ffcf3f" strokeWidth={0.16} strokeLinecap="round" opacity={0.9} />
      <StoneShape side={0} cx={4} cy={4} r={0.42} />
    </svg>
  );
}
