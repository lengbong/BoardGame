import type { ReactNode } from 'react';
import { TIER_INFO, type AchGroup, type AchTier, type AchievementDef, type BadgeGlyph } from './achievements';

/** 배지 바탕색 (묶음마다) */
const GROUP_FILL: Record<AchGroup, string> = {
  start: '#3f8fd2',
  fleet: '#4f6fd0',
  network: '#2f9a6e',
  money: '#c9822a',
  awards: '#8d62cf',
  wins: '#cc4f45',
};

const W = { fill: 'none', stroke: '#fff', strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const F = { fill: '#fff' } as const;

/** 위에서 본 작은 비행기 (가운데 32,32, 크기 1) */
const PLANE = 'M32 18c1.6 0 2.4 1.6 2.4 3.6V29l9.6 5.4v3l-9.6-3v6.2l3 2.4v2.4L32 44l-5.4 1.4V43l3-2.4v-6.2l-9.6 3v-3l9.6-5.4v-7.4c0-2 .8-3.6 2.4-3.6z';

function Num({ n, y = 44 }: { n: string; y?: number }) {
  return (
    <text x={32} y={y} textAnchor="middle" fontSize={n.length > 2 ? 9.5 : 11} fontWeight={800} fill="#fff" fontFamily="system-ui, sans-serif">
      {n}
    </text>
  );
}

function Star({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    return `${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`;
  }).join(' ');
  return <polygon points={pts} {...F} />;
}

/** 배지 가운데 그림 (손그림풍의 흰 선) */
function Glyph({ kind }: { kind: BadgeGlyph }): ReactNode {
  switch (kind) {
    case 'plane':
      return <path d={PLANE} {...F} />;
    case 'route':
      return (
        <>
          <path d="M20 40Q32 16 44 40" {...W} strokeDasharray="3 3.5" />
          <circle cx={20} cy={40} r={3.4} {...F} />
          <circle cx={44} cy={40} r={3.4} {...F} />
          <path d="M30 24l4 2.4-4 2.4" {...W} strokeWidth={2.2} />
        </>
      );
    case 'wide':
      return (
        <>
          <path d="M17 34h30M32 22v4" {...W} />
          <circle cx={32} cy={33} r={7} {...W} />
          <circle cx={23.5} cy={38.5} r={2.6} {...F} />
          <circle cx={40.5} cy={38.5} r={2.6} {...F} />
          <path d="M30 31h4" {...W} strokeWidth={2} />
        </>
      );
    case 'coin':
      return (
        <>
          <circle cx={32} cy={32} r={11} {...W} />
          <path d="M32 38V26.5M27.5 31l4.5-4.5 4.5 4.5" {...W} />
        </>
      );
    case 'people':
      return (
        <>
          <circle cx={26.5} cy={26} r={4} {...F} />
          <circle cx={37.5} cy={26} r={4} {...F} />
          <path d="M19 42a7.5 7.5 0 0 1 15 0M30 42a7.5 7.5 0 0 1 15 0" {...W} />
        </>
      );
    case 'trophy':
      return <path d="M25 21h14v7a7 7 0 0 1-14 0zM32 35v4M26.5 43h11M25 23.5h-3a3.5 3.5 0 0 0 3.5 4.5M39 23.5h3a3.5 3.5 0 0 1-3.5 4.5" {...W} />;
    case 'building':
      return (
        <>
          <path d="M19 43h26M22 43V33h20v10M32 33V24M27.5 20.5h9l-1.5 4h-6z" {...W} />
          <path d="M26 37.5h3M35 37.5h3" {...W} strokeWidth={2} />
        </>
      );
    case 'drum':
      return (
        <>
          <ellipse cx={32} cy={23} rx={9} ry={3.4} {...W} />
          <path d="M23 23v17c0 1.9 4 3.4 9 3.4s9-1.5 9-3.4V23M23 31.5c0 1.9 4 3.4 9 3.4s9-1.5 9-3.4" {...W} />
        </>
      );
    case 'ticket':
      return (
        <>
          <path d="M20 25h24v4.5a2.5 2.5 0 0 0 0 5V39H20v-4.5a2.5 2.5 0 0 0 0-5z" {...W} />
          <path d="M30 26v12" {...W} strokeWidth={2} strokeDasharray="2 2.4" />
          <path d="M34 30h6M34 34h4" {...W} strokeWidth={2} />
        </>
      );
    case 'link':
      return <path d="M29.5 36.5l-3.2 3.2a4.6 4.6 0 0 1-6.5-6.5l4.6-4.6a4.6 4.6 0 0 1 6.5 0M34.5 27.5l3.2-3.2a4.6 4.6 0 0 1 6.5 6.5l-4.6 4.6a4.6 4.6 0 0 1-6.5 0M28.5 35.5l7-7" {...W} />;
    case 'globe':
      return (
        <>
          <circle cx={32} cy={32} r={11.5} {...W} />
          <ellipse cx={32} cy={32} rx={5} ry={11.5} {...W} strokeWidth={2} />
          <path d="M21 28h22M21 36h22" {...W} strokeWidth={2} />
        </>
      );
    case 'city':
      return <path d="M18 43h28M20.5 43V32h6v11M26.5 43V24h6.5v19M33 43V34h5v9M38 43V28.5h5.5V43M29.5 28.5v2M29.5 34v2" {...W} />;
    case 'fleet':
      return (
        <>
          <g transform="translate(-9 -5) scale(0.62) translate(19.6 19.6)">
            <path d={PLANE} {...F} />
          </g>
          <g transform="translate(9 -5) scale(0.62) translate(19.6 19.6)">
            <path d={PLANE} {...F} />
          </g>
          <g transform="translate(0 -9) scale(0.62) translate(19.6 19.6)">
            <path d={PLANE} {...F} />
          </g>
          <Num n="50" y={46} />
        </>
      );
    case 'box':
      return (
        <>
          <path d="M21 27l11-5.5L43 27v11.5L32 44l-11-5.5zM21 27l11 5.5L43 27M32 32.5V44" {...W} />
          <path d="M26.5 24.3l11 5.5" {...W} strokeWidth={2} />
        </>
      );
    case 'streak':
      return (
        <>
          <path d="M20 24.5h24V43H20zM20 30h24M26 21v6M38 21v6" {...W} />
          <path d="M23.5 36.5l2 2 3.5-3.5M34 36.5l2 2 3.5-3.5" {...W} strokeWidth={2.2} />
        </>
      );
    case 'oil':
      return (
        <>
          <path d="M28 20c-4 6-7.5 9.5-7.5 14a7.5 7.5 0 0 0 15 0c0-4.5-3.5-8-7.5-14z" {...F} />
          <path d="M42 41V26M38.5 29.5L42 26l3.5 3.5" {...W} />
        </>
      );
    case 'arc':
      return (
        <>
          <circle cx={32} cy={34} r={10} {...W} strokeWidth={2} />
          <path d="M17 38Q32 6 47 38" {...W} />
          <circle cx={17} cy={38} r={2.8} {...F} />
          <circle cx={47} cy={38} r={2.8} {...F} />
        </>
      );
    case 'crown':
      return (
        <>
          <path d="M20.5 40h23l2-14-7 5.5-6.5-9.5-6.5 9.5-7-5.5z" {...W} />
          <circle cx={32} cy={35} r={2} {...F} />
        </>
      );
    case 'gem':
      return <path d="M24.5 23h15l5.5 7L32 44 19 30zM19 30h26M28.5 23l-2.5 7 6 14 6-14-2.5-7" {...W} />;
    case 'pie':
      return (
        <>
          <circle cx={32} cy={32} r={11.5} {...W} />
          <path d="M32 32V20.5a11.5 11.5 0 0 1 10.8 15.4z" {...F} />
        </>
      );
    case 'star':
      return (
        <>
          <Star cx={32} cy={32} r={13} />
          <text x={32} y={36.5} textAnchor="middle" fontSize={11} fontWeight={900} fill="#8d62cf" fontFamily="system-ui, sans-serif">
            S
          </text>
        </>
      );
    case 'flag':
      return (
        <>
          <path d="M23 45V19" {...W} />
          <path d="M23.5 20.5h18v13h-18z" {...W} strokeWidth={2} />
          <path d="M23.5 20.5h4.5v4.3h-4.5zM32.5 20.5H37v4.3h-4.5zM28 24.8h4.5v4.3H28zM37 24.8h4.5v4.3H37zM23.5 29.1H28v4.4h-4.5zM32.5 29.1H37v4.4h-4.5z" {...F} />
        </>
      );
    case 'backpack':
      return (
        <>
          <path d="M24.5 28a7.5 7.5 0 0 1 15 0v15h-15zM28.5 27v-2.5a3.5 3.5 0 0 1 7 0V27" {...W} />
          <path d="M24.5 34.5h15M30 34.5v3.5h4v-3.5" {...W} strokeWidth={2.2} />
        </>
      );
    case 'crate':
      return (
        <>
          <path d="M21.5 30h21v13h-21zM21.5 30l3-5h15l3 5M32 30v13" {...W} />
          <Star cx={32} cy={19} r={4.6} />
        </>
      );
    case 'summit':
      return (
        <>
          <path d="M17 44l10.5-16 5 7 4.5-5.5L47 44z" {...W} />
          <path d="M32 26V17.5" {...W} strokeWidth={2.2} />
          <path d="M32 17.5h7l-2 2.6 2 2.6h-7z" {...F} />
        </>
      );
    case 'tally':
      return <path d="M23 23v18M27.5 23v18M32 23v18M36.5 23v18M19.5 37l25-10" {...W} />;
    case 'bolt':
      return <path d="M35 17L22.5 34.5h8.5l-3 12.5 13.5-18h-8.5z" {...F} />;
    case 'piggy':
      return (
        <>
          <ellipse cx={31} cy={33} rx={11} ry={8} {...W} />
          <path d="M26 41v3M36 41v3M42 31.5l3.5-1.5M27 21.5l2.5 4.5M29 27.5h6" {...W} strokeWidth={2.2} />
          <circle cx={37} cy={31} r={1.4} {...F} />
          <circle cx={33} cy={19} r={3} {...W} strokeWidth={2} />
        </>
      );
    case 'fleet100':
      return (
        <>
          <g transform="translate(0 -7) scale(0.78) translate(9 9)">
            <path d={PLANE} {...F} />
          </g>
          <Num n="100" y={46} />
        </>
      );
    case 'city50':
      return (
        <>
          <path d="M19 37h26M21 37V29h5v8M26 37V23h6v14M32 37v-7h4.5v7M36.5 37V26H42v11" {...W} strokeWidth={2.2} />
          <Num n="50" y={47.5} />
        </>
      );
    case 'sweep':
      return (
        <>
          <Star cx={32} cy={21} r={5.2} />
          <Star cx={21.5} cy={27.5} r={4.6} />
          <Star cx={42.5} cy={27.5} r={4.6} />
          <Star cx={25} cy={39} r={4.6} />
          <Star cx={39} cy={39} r={4.6} />
          <circle cx={32} cy={32} r={2.4} {...F} />
        </>
      );
    case 'merge':
      return <path d="M20 20l12 12M44 20L32 32M32 32v13M27.5 40.5L32 45l4.5-4.5M20 20v5M20 20h5M44 20v5M44 20h-5" {...W} />;
    case 'flame':
      return <path d="M32 17c3 6 9.5 9 9.5 17a9.5 9.5 0 0 1-19 0c0-4.5 2-7 4.5-9 0 3.5 1.2 5.5 3.3 5.8C29.5 25.5 30 21 32 17z" {...F} />;
    case 'eras':
      return (
        <>
          <path d="M17 38h30" {...W} />
          <circle cx={21} cy={38} r={3} {...F} />
          <circle cx={32} cy={38} r={3.8} {...F} />
          <circle cx={43} cy={38} r={4.6} {...F} />
          <path d="M21 33v-6M32 32v-9M43 31V19" {...W} strokeWidth={2.2} />
          <Star cx={43} cy={19} r={4} />
        </>
      );
    case 'compass': {
      const pts = Array.from({ length: 16 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 8;
        const rr = i % 4 === 0 ? 14 : i % 2 === 0 ? 8.5 : 4;
        return `${(32 + Math.cos(a) * rr).toFixed(2)},${(32 + Math.sin(a) * rr).toFixed(2)}`;
      }).join(' ');
      return (
        <>
          <polygon points={pts} {...F} />
          <circle cx={32} cy={32} r={2.2} fill="#cc4f45" />
        </>
      );
    }
    case 'hourglass':
      return (
        <>
          <path d="M23.5 19.5h17M23.5 44.5h17M26 19.5c0 7.5 12 7.5 12 12.5s-12 5-12 12.5M38 19.5c0 7.5-12 7.5-12 12.5s12 5 12 12.5" {...W} />
          <path d="M28.5 41.5h7l-3.5-3.5z" {...F} />
        </>
      );
    case 'scroll':
      // 펼친 두루마리 위에 지나간 하늘길 (역사 시나리오)
      return (
        <>
          <path d="M21 21.5h22v21H21z" {...W} />
          <path d="M19 19.5a2.5 2.5 0 0 1 5 0v25a2.5 2.5 0 0 1-5 0zM40 19.5a2.5 2.5 0 0 1 5 0v25a2.5 2.5 0 0 1-5 0z" {...F} />
          <path d="M26 38c3-7 7-9 12-11" {...W} strokeWidth={2} strokeDasharray="2.4 2.6" />
          <path d="M37 24.5l3 2.2-3.4 1.8z" {...F} />
        </>
      );
    case 'scrolls':
      // 두루마리와 별 셋 (역사 시나리오 모두)
      return (
        <>
          <path d="M22 30.5h20v14H22z" {...W} />
          <path d="M20 29a2.2 2.2 0 0 1 4.4 0v17a2.2 2.2 0 0 1-4.4 0zM39.6 29a2.2 2.2 0 0 1 4.4 0v17a2.2 2.2 0 0 1-4.4 0z" {...F} />
          <Star cx={22} cy={21} r={4.4} />
          <Star cx={32} cy={17.5} r={5.2} />
          <Star cx={42} cy={21} r={4.4} />
        </>
      );
  }
}

/** 배지 테두리: 동은 동그라미, 은은 방패, 금은 해바라기 모양 + 리본 */
function Frame({ tier, fill, locked }: { tier: AchTier; fill: string; locked: boolean }) {
  const rim = locked ? '#a39d93' : TIER_INFO[tier].color;
  const edge = locked ? '#7d776f' : tier === 3 ? '#a87b14' : tier === 2 ? '#6c7889' : '#87522a';
  if (tier === 1)
    return (
      <>
        <circle cx={32} cy={32} r={27} fill={rim} stroke={edge} strokeWidth={1.6} />
        <circle cx={32} cy={32} r={21.5} fill={fill} />
        <circle cx={32} cy={32} r={24.2} fill="none" stroke="#fff" strokeOpacity={0.45} strokeWidth={1} strokeDasharray="2 2.6" />
      </>
    );
  if (tier === 2)
    return (
      <>
        <path d="M32 3.5L55 11.5V31c0 14-10 23-23 29.5C19 54 9 45 9 31V11.5z" fill={rim} stroke={edge} strokeWidth={1.6} strokeLinejoin="round" />
        <path d="M32 9.5L50 15.8V31c0 11-7.6 18.4-18 23.8C21.6 49.4 14 42 14 31V15.8z" fill={fill} />
        <path d="M18 17.5L32 12.6l14 4.9" fill="none" stroke="#fff" strokeOpacity={0.4} strokeWidth={1.2} strokeLinecap="round" />
      </>
    );
  const petals = Array.from({ length: 24 }, (_, i) => {
    const a = (i * Math.PI) / 12;
    const rr = i % 2 === 0 ? 29.5 : 25.5;
    return `${(32 + Math.cos(a) * rr).toFixed(2)},${(31 + Math.sin(a) * rr).toFixed(2)}`;
  }).join(' ');
  return (
    <>
      <path d="M19 46l-6 15 7-3 4 6 5-14zM45 46l6 15-7-3-4 6-5-14z" fill={locked ? '#9a948b' : '#c0392b'} stroke={locked ? '#7d776f' : '#8e2a20'} strokeWidth={1} strokeLinejoin="round" />
      <polygon points={petals} fill={rim} stroke={edge} strokeWidth={1.4} strokeLinejoin="round" />
      <circle cx={32} cy={31} r={20.5} fill={fill} />
      <circle cx={32} cy={31} r={22.6} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={1} />
    </>
  );
}

/**
 * 업적 배지. 못 이룬 배지는 회색, 숨은 업적은 물음표.
 * size: 가로 크기 (px)
 */
export function AchBadge({ def, unlocked, size = 56, decorative }: { def: AchievementDef; unlocked: boolean; size?: number; decorative?: boolean }) {
  const secret = !unlocked && def.hidden;
  const fill = unlocked ? GROUP_FILL[def.group] : '#bdb6ab';
  const label = secret ? '숨은 업적' : `${def.name} (${TIER_INFO[def.tier].name}${unlocked ? ', 이뤘어요' : ', 아직'})`;
  return (
    <svg
      className={`al-ach-badge${unlocked ? '' : ' al-ach-locked'}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
    >
      <Frame tier={def.tier} fill={fill} locked={!unlocked} />
      <g transform={def.tier === 3 ? 'translate(32 31) scale(0.96) translate(-32 -32)' : def.tier === 2 ? 'translate(32 31) scale(0.9) translate(-32 -32)' : 'translate(32 32) scale(0.94) translate(-32 -32)'} opacity={unlocked ? 1 : 0.75}>
        {secret ? (
          <text x={32} y={41} textAnchor="middle" fontSize={26} fontWeight={900} fill="#fff" fontFamily="system-ui, sans-serif">
            ?
          </text>
        ) : (
          <Glyph kind={def.art} />
        )}
      </g>
    </svg>
  );
}

/** 명예의 전당 머리 그림: 기둥 넷과 지붕, 가운데 별 */
export function HallArt({ size = 64 }: { size?: number }) {
  return (
    <svg className="al-hall-art" width={size} height={size * 0.8} viewBox="0 0 80 64" aria-hidden="true">
      <path d="M8 22L40 6l32 16z" fill="#e2b13c" stroke="#a87b14" strokeWidth={1.6} strokeLinejoin="round" />
      <rect x={10} y={22} width={60} height={5} rx={1.5} fill="#f3e1b0" stroke="#a87b14" strokeWidth={1.2} />
      {[16, 30, 44, 58].map((x) => (
        <g key={x}>
          <rect x={x} y={28} width={6} height={24} fill="#fbf3dc" stroke="#b9a476" strokeWidth={1.2} />
          <path d={`M${x + 2} 30v20M${x + 4} 30v20`} stroke="#d8c79c" strokeWidth={0.8} />
        </g>
      ))}
      <rect x={6} y={52} width={68} height={6} rx={1.5} fill="#f3e1b0" stroke="#a87b14" strokeWidth={1.2} />
      <Star cx={40} cy={16} r={4.6} />
      <circle cx={40} cy={16} r={5.8} fill="none" stroke="#a87b14" strokeWidth={0.9} />
    </svg>
  );
}
