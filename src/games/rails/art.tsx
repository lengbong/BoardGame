import { useId, type ReactElement } from 'react';
import { CITY, COLOR_INFO, MAP_H, MAP_W } from './map';
import { ISLANDS_D, JEJU_D, MAINLAND_D } from './land';
import type { CardKind, RouteColor, StampIcon } from './types';

/**
 * 기차로 전국 일주 그림 (모두 직접 그린 SVG).
 * 색마다 모양: 빨강 동그라미, 주황 세모, 노랑 별, 초록 잎, 파랑 물방울, 보라 하트
 */

/** (cx, cy)를 가운데로 하는 반지름 r짜리 색 모양 */
export function symbolShape(kind: RouteColor | CardKind, cx: number, cy: number, r: number, fill: string, extra: object = {}): ReactElement | null {
  const t = `translate(${cx} ${cy})`;
  switch (kind) {
    case 'red':
      return <circle cx={cx} cy={cy} r={r * 0.82} fill={fill} {...extra} />;
    case 'orange':
      return <polygon points={`${cx},${cy - r} ${cx + r * 0.92},${cy + r * 0.72} ${cx - r * 0.92},${cy + r * 0.72}`} fill={fill} strokeLinejoin="round" {...extra} />;
    case 'yellow': {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const a = ((-90 + i * 36) * Math.PI) / 180;
        const rr = i % 2 === 0 ? r : r * 0.45;
        return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
      });
      return <polygon points={pts.join(' ')} fill={fill} strokeLinejoin="round" {...extra} />;
    }
    case 'green':
      return (
        <path
          d={`M0 ${-r} C${r * 0.95} ${-r * 0.4} ${r * 0.8} ${r * 0.55} 0 ${r} C${-r * 0.8} ${r * 0.55} ${-r * 0.95} ${-r * 0.4} 0 ${-r}Z`}
          transform={`${t} rotate(30)`}
          fill={fill}
          {...extra}
        />
      );
    case 'blue':
      return (
        <path
          d={`M0 ${-r} C${0.45 * r} ${-0.45 * r} ${0.72 * r} ${-0.05 * r} ${0.72 * r} ${0.28 * r} A${0.72 * r} ${0.72 * r} 0 1 1 ${-0.72 * r} ${0.28 * r} C${-0.72 * r} ${-0.05 * r} ${-0.45 * r} ${-0.45 * r} 0 ${-r}Z`}
          transform={t}
          fill={fill}
          {...extra}
        />
      );
    case 'purple':
      return (
        <path
          d={`M0 ${0.85 * r} C${-1.15 * r} ${0.05 * r} ${-0.7 * r} ${-1.05 * r} 0 ${-0.38 * r} C${0.7 * r} ${-1.05 * r} ${1.15 * r} ${0.05 * r} 0 ${0.85 * r}Z`}
          transform={t}
          fill={fill}
          {...extra}
        />
      );
    case 'wild':
      return (
        <g transform={t} {...extra}>
          <path d={`M${-r} ${r * 0.5} A${r} ${r} 0 0 1 ${r} ${r * 0.5}`} fill="none" stroke="#e2483f" strokeWidth={r * 0.28} />
          <path d={`M${-r * 0.7} ${r * 0.5} A${r * 0.7} ${r * 0.7} 0 0 1 ${r * 0.7} ${r * 0.5}`} fill="none" stroke="#efc12b" strokeWidth={r * 0.28} />
          <path d={`M${-r * 0.4} ${r * 0.5} A${r * 0.4} ${r * 0.4} 0 0 1 ${r * 0.4} ${r * 0.5}`} fill="none" stroke="#3a78d4" strokeWidth={r * 0.28} />
        </g>
      );
    case 'gray':
      return null;
  }
}

/** 모양 하나만 그린 작은 SVG (글자 사이에 넣는다) */
export function SymbolIcon({ kind, size = 14 }: { kind: CardKind | RouteColor; size?: number }) {
  const info = COLOR_INFO[kind];
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" className="rl-symbol-icon">
      {kind === 'gray' ? (
        <rect x={3} y={6} width={14} height={8} rx={3} fill={info.main} stroke={info.dark} strokeWidth={1.5} />
      ) : (
        symbolShape(kind, 10, 10.5, 8, info.main, { stroke: info.dark, strokeWidth: 1.2 })
      )}
    </svg>
  );
}

/** 초고속 열차 앞모습 (만능 고속열차표 그림) */
function BulletNose({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-15 8 C-15 -6 -8 -12 0 -12 C8 -12 15 -6 15 8 Z" fill="#f4f6f8" stroke="#3d4650" strokeWidth={1.4} />
      <path d="M-9 -2 C-8 -7 -4 -9 0 -9 C4 -9 8 -7 9 -2 Z" fill="#33536f" />
      <path d="M-15 4 H15" stroke="#2c6fb7" strokeWidth={2.4} />
      <circle cx={-9} cy={7} r={1.6} fill="#ffd34d" />
      <circle cx={9} cy={7} r={1.6} fill="#ffd34d" />
    </g>
  );
}

/** 기차표 한 장 (앞면). viewBox 60×84 */
export function TicketFace({ kind }: { kind: CardKind }) {
  const info = COLOR_INFO[kind];
  const wild = kind === 'wild';
  const gid = `rl-rainbow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg viewBox="0 0 60 84" className="rl-ticket-svg" aria-hidden="true">
      {wild && (
        <defs>
          <linearGradient id={gid} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#e2483f" />
            <stop offset="0.2" stopColor="#f08a24" />
            <stop offset="0.4" stopColor="#efc12b" />
            <stop offset="0.6" stopColor="#36a15b" />
            <stop offset="0.8" stopColor="#3a78d4" />
            <stop offset="1" stopColor="#9259c8" />
          </linearGradient>
        </defs>
      )}
      <rect x={1} y={1} width={58} height={82} rx={7} fill="#fffaf0" stroke={info.dark} strokeWidth={1.6} />
      <path d="M1 8 a7 7 0 0 1 7 -7 h44 a7 7 0 0 1 7 7 v14 h-58 z" fill={wild ? `url(#${gid})` : info.main} />
      <text x={30} y={15.5} textAnchor="middle" className="rl-ticket-head">
        {wild ? '만능' : '기차표'}
      </text>
      {/* 떼는 줄 */}
      <line x1={7} y1={62} x2={53} y2={62} stroke={info.dark} strokeWidth={1} strokeDasharray="2 2.4" opacity={0.55} />
      <circle cx={1} cy={62} r={3.2} fill="var(--rl-card-bg, #fff)" stroke={info.dark} strokeWidth={1} />
      <circle cx={59} cy={62} r={3.2} fill="var(--rl-card-bg, #fff)" stroke={info.dark} strokeWidth={1} />
      {wild ? (
        <BulletNose x={30} y={42} s={1.05} />
      ) : (
        <>
          <circle cx={30} cy={41} r={15} fill={info.light} />
          {symbolShape(kind, 30, 41.5, 11.5, info.main, { stroke: info.dark, strokeWidth: 1.4 })}
        </>
      )}
      <text x={30} y={75} textAnchor="middle" className="rl-ticket-name" fill={info.dark}>
        {wild ? '만능' : info.name}
      </text>
    </svg>
  );
}

/** 기차표 뒷면 (더미) */
export function TicketBack() {
  return (
    <svg viewBox="0 0 60 84" className="rl-ticket-svg" aria-hidden="true">
      <rect x={1} y={1} width={58} height={82} rx={7} fill="#2f5d62" stroke="#1d3c40" strokeWidth={1.6} />
      <rect x={6} y={6} width={48} height={72} rx={5} fill="none" stroke="#f3e2b3" strokeWidth={1.2} strokeDasharray="3 2" />
      {/* 철길 */}
      <path d="M14 70 L26 18 M46 70 L34 18" stroke="#f3e2b3" strokeWidth={1.6} />
      {[24, 34, 44, 54, 64].map((y) => (
        <line key={y} x1={30 - (74 - y) * 0.27 - 4} y1={y} x2={30 + (74 - y) * 0.27 + 4} y2={y} stroke="#f3e2b3" strokeWidth={1.4} opacity={0.75} />
      ))}
      <circle cx={30} cy={36} r={9} fill="#e9b949" stroke="#f3e2b3" strokeWidth={1.4} />
      <path d="M25 38 h10 v-4 h-3 v-3 h-4 v3 h-3 z" fill="#2f5d62" />
    </svg>
  );
}

/** 작은 기차 아이콘 (기차 칸 수 옆에) */
export function TrainIcon({ color = 'currentColor', size = 18 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 28 20" width={size * 1.4} height={size} aria-hidden="true" className="rl-train-icon">
      <rect x={2} y={6} width={17} height={9} rx={2} fill={color} />
      <rect x={13} y={2} width={8} height={13} rx={2} fill={color} />
      <rect x={15} y={4} width={4} height={4} rx={1} fill="#fff" opacity={0.85} />
      <rect x={5} y={3} width={3} height={4} rx={1} fill={color} />
      <path d="M21 9 h4 l2 6 h-6 z" fill={color} />
      <circle cx={7} cy={16.5} r={2.6} fill="#2b2724" stroke="#fff" strokeWidth={0.8} />
      <circle cx={16} cy={16.5} r={2.6} fill="#2b2724" stroke="#fff" strokeWidth={0.8} />
    </svg>
  );
}

/** 관광 도장 그림 (가운데 0,0, 반지름 약 10) */
export function stampArt(icon: StampIcon): ReactElement {
  const ink = 'var(--rl-stamp-ink, #7a2e1d)';
  switch (icon) {
    case 'tower':
      return (
        <g stroke={ink} strokeWidth={1.4} strokeLinecap="round" fill="none">
          <line x1={0} y1={-9} x2={0} y2={-5} />
          <ellipse cx={0} cy={-3} rx={3.6} ry={1.8} fill={ink} />
          <path d="M-1.2 -1 L-2.4 7 M1.2 -1 L2.4 7" />
          <path d="M-6 8 Q0 3 6 8" />
        </g>
      );
    case 'peak':
      return (
        <g fill={ink}>
          <path d="M-9 7 L-4 -3 L-1.5 1 L2 -8 L9 7 Z" />
          <path d="M2 -8 L0.2 -3.6 L2.2 -4.6 L3.6 -3.4 Z" fill="#fff" />
        </g>
      );
    case 'wave':
      return (
        <g fill="none" stroke={ink} strokeWidth={1.6} strokeLinecap="round">
          <circle cx={4} cy={-5} r={2.6} fill={ink} stroke="none" />
          <path d="M-9 1 Q-6.5 -2 -4 1 T1 1 T6 1 T9 0" />
          <path d="M-9 5.5 Q-6.5 2.5 -4 5.5 T1 5.5 T6 5.5 T9 4.5" />
        </g>
      );
    case 'mask':
      return (
        <g fill="none" stroke={ink} strokeWidth={1.4} strokeLinecap="round">
          <path d="M-7 -6 Q0 -10 7 -6 Q8 3 0 8 Q-8 3 -7 -6 Z" fill={ink} fillOpacity={0.15} />
          <path d="M-5 -2 Q-3.5 -4 -2 -2 M2 -2 Q3.5 -4 5 -2" />
          <path d="M-4 3 Q0 6.5 4 3" />
        </g>
      );
    case 'temple':
      return (
        <g fill={ink}>
          <path d="M-9 -2 Q0 -8 9 -2 L6 -2 L6 0 L-6 0 L-6 -2 Z" />
          <rect x={-5} y={0} width={10} height={5} fill="none" stroke={ink} strokeWidth={1.4} />
          <rect x={-8} y={5} width={16} height={2.4} />
          <rect x={-1} y={-10} width={2} height={3} />
        </g>
      );
    case 'hanok':
      return (
        <g fill={ink}>
          <path d="M-10 -1 Q-6 -2 -5 -7 L5 -7 Q6 -2 10 -1 Q0 -3 -10 -1 Z" />
          <rect x={-6} y={0} width={12} height={7} fill="none" stroke={ink} strokeWidth={1.4} />
          <line x1={0} y1={0} x2={0} y2={7} stroke={ink} strokeWidth={1.2} />
        </g>
      );
    case 'beach':
      return (
        <g fill="none" stroke={ink} strokeWidth={1.4} strokeLinecap="round">
          <path d="M-8 -2 Q-2 -11 6 -4 Z" fill={ink} />
          <line x1={-1} y1={-5} x2={2} y2={7} />
          <path d="M-9 7 Q0 4 9 7" />
        </g>
      );
    case 'volcano':
      return (
        <g fill={ink}>
          <path d="M-10 7 Q-5 2 -3 -4 L3 -4 Q5 2 10 7 Z" />
          <path d="M-3 -4 Q0 -2 3 -4" fill="none" stroke="#fff" strokeWidth={1.2} />
          <path d="M-1 -6 Q-2 -9 0 -10 M2 -6 Q3 -9 1.5 -10" fill="none" stroke={ink} strokeWidth={1} />
        </g>
      );
  }
}

/** 동그란 도장 하나 (HTML 안에 넣는 작은 SVG) */
export function StampBadge({ icon, size = 22, color, faded = false, first = false }: { icon: StampIcon; size?: number; color?: string; faded?: boolean; first?: boolean }) {
  return (
    <svg viewBox="-12 -12 24 24" width={size} height={size} aria-hidden="true" className={`rl-stamp-badge${faded ? ' rl-stamp-faded' : ''}`}>
      <circle r={11} fill="var(--rl-stamp-paper, #fff6e4)" stroke={color ?? 'var(--rl-stamp-ink, #7a2e1d)'} strokeWidth={first ? 2.2 : 1.4} strokeDasharray={first ? undefined : '2.2 1.6'} />
      {stampArt(icon)}
    </svg>
  );
}

/** 계획 카드에 들어가는 작은 우리나라 지도 */
export function MiniKorea({ a, b, done = false, size = 44 }: { a: string; b: string; done?: boolean; size?: number }) {
  const ca = CITY[a];
  const cb = CITY[b];
  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} width={size * (MAP_W / MAP_H)} height={size} aria-hidden="true" className="rl-mini-korea">
      <path d={MAINLAND_D} className="rl-mini-land" />
      <path d={ISLANDS_D} className="rl-mini-land" />
      <path d={JEJU_D} className="rl-mini-land" />
      <line x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y} className={done ? 'rl-mini-line rl-mini-done' : 'rl-mini-line'} />
      <circle cx={ca.x} cy={ca.y} r={34} className="rl-mini-dot" />
      <circle cx={cb.x} cy={cb.y} r={34} className="rl-mini-dot" />
    </svg>
  );
}
