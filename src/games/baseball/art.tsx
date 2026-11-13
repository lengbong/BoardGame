import type { DuelSide } from '../common/duel';
import type { Side } from './types';

/** 편 색 */
export const TEAM_COLORS: Record<Side, { main: string; dark: string; light: string }> = {
  0: { main: '#2f6fd6', dark: '#1d4a99', light: '#e4edfc' },
  1: { main: '#d6453d', dark: '#9b2a24', light: '#fde7e5' },
};

/** 야구 모자 (편 색). 챙 아래에 편 글자(파·빨)를 새겨 색을 구별하기 어려워도 알아볼 수 있게 한다 */
export function TeamCap({ side, size }: { side: Side; size?: number }) {
  const c = TEAM_COLORS[side];
  return (
    <svg viewBox="0 0 40 32" width={size} height={size ? size * 0.8 : undefined} className="bb-cap" aria-hidden="true">
      <path d="M5 22 C5 9 13 3 21 3 C29 3 35 9 35 22 Z" fill={c.main} stroke={c.dark} strokeWidth={1.6} />
      <path d="M21 3 C18 8 17 15 17.5 22 M21 3 C24 8 25.5 15 25 22" fill="none" stroke={c.dark} strokeWidth={1} opacity={0.6} />
      <path d="M2 23 C10 19 32 19 39 23.5 C36 27.5 24 27 20 26 C14 25 6 27 2 23 Z" fill={c.dark} />
      <circle cx={21} cy={3.4} r={2} fill={c.dark} />
      <text x={21} y={17.5} textAnchor="middle" fontSize={9.5} fontWeight={900} fill="#fff" fontFamily="system-ui, sans-serif">
        {side === 0 ? '파' : '빨'}
      </text>
    </svg>
  );
}

/** 야구공 (빨간 실밥) */
export function BallArt({ size, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="-12 -12 24 24" width={size} height={size} className={className} aria-hidden="true">
      <circle r={11} fill="#fffdf6" stroke="#c9c1b0" strokeWidth={1} />
      <path d="M-7.5 -8 C-3 -4 -3 4 -7.5 8" fill="none" stroke="#d63b32" strokeWidth={1.1} />
      <path d="M7.5 -8 C3 -4 3 4 7.5 8" fill="none" stroke="#d63b32" strokeWidth={1.1} />
      {[-5.6, -2.8, 0, 2.8, 5.6].map((y) => (
        <g key={y} stroke="#d63b32" strokeWidth={0.8}>
          <path d={`M${-5.6 + Math.abs(y) * 0.32} ${y} l-1.8 -0.9`} />
          <path d={`M${5.6 - Math.abs(y) * 0.32} ${y} l1.8 -0.9`} />
        </g>
      ))}
    </svg>
  );
}

export const BASEBALL_SIDES: [DuelSide, DuelSide] = [
  { label: '파랑팀', color: TEAM_COLORS[0].main, icon: <TeamCap side={0} /> },
  { label: '빨강팀', color: TEAM_COLORS[1].main, icon: <TeamCap side={1} /> },
];
