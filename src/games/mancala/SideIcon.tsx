import type { DuelSide } from '../common/duel';
import { SIDE_INFO } from './sides';
import type { Side } from './types';

/** 해님 편 그림: 햇살이 있는 해 */
function Sun({ size }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <g stroke="#ffe08a" strokeWidth="2.2" strokeLinecap="round">
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return <line key={i} x1={12 + Math.cos(a) * 7.6} y1={12 + Math.sin(a) * 7.6} x2={12 + Math.cos(a) * 10.6} y2={12 + Math.sin(a) * 10.6} />;
        })}
      </g>
      <circle cx="12" cy="12" r="5.6" fill="#ffd34d" stroke="#c76a14" strokeWidth="1.2" />
      <circle cx="10.2" cy="10.4" r="1.6" fill="#fff6c9" opacity="0.8" />
    </svg>
  );
}

/** 달님 편 그림: 초승달과 작은 별 */
function Moon({ size }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M15.5 3.2a9 9 0 1 0 5.3 14.6A7.4 7.4 0 0 1 15.5 3.2Z" fill="#f4f1dc" stroke="#7d86c9" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M19 4.2l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z" fill="#fff3b0" />
    </svg>
  );
}

export function SideIcon({ side, size }: { side: Side; size?: number }) {
  return side === 0 ? <Sun size={size} /> : <Moon size={size} />;
}

/** 자리 고르기(DuelPicker)에 넘길 두 편의 모양 */
export const DUEL_SIDES: [DuelSide, DuelSide] = [
  { label: SIDE_INFO[0].label, color: SIDE_INFO[0].main, icon: <SideIcon side={0} /> },
  { label: SIDE_INFO[1].label, color: SIDE_INFO[1].main, icon: <SideIcon side={1} /> },
];
