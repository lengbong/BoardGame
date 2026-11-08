import { useId, type ReactNode } from 'react';
import { Cloud } from './common';

/** 정사각형(100×100) 그림 틀: 배경 그라디언트 + 내용 */
function Square({ bg, children, className }: { bg: [string, string]; children: (id: string) => ReactNode; className?: string }) {
  const id = `t${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={bg[0]} />
          <stop offset="1" stopColor={bg[1]} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id}-bg)`} />
      {children(id)}
    </svg>
  );
}

// ---------------------------------------------------------------- 모서리 칸

export function StartArt({ className }: { className?: string }) {
  return (
    <Square className={className} bg={['#c9ecff', '#fff4d1']}>
      {() => (
        <g>
          <Cloud x={74} y={18} s={1.1} />
          <line x1="34" y1="16" x2="34" y2="74" stroke="#6b4a2b" strokeWidth="3" strokeLinecap="round" />
          <path d="M35 18 Q48 13 60 18 T84 18 V44 Q72 39 60 44 T35 44 Z" fill="#fff" stroke="#333" strokeWidth="1.2" />
          {[0, 1, 2, 3, 4, 5].map((c) =>
            [0, 1, 2].map((r) =>
              (c + r) % 2 === 0 ? (
                <rect key={`${c}-${r}`} x={36 + c * 8} y={19.5 + r * 8.2} width="8" height="8.2" fill="#2b2b2b" />
              ) : null,
            ),
          )}
          <path d="M88 82 H30 L38 74 M30 82 L38 90" stroke="#2fa95a" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M88 82 H30 L38 74 M30 82 L38 90" stroke="#5fd387" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="16" cy="70" r="8" fill="#f6c244" stroke="#c99a22" strokeWidth="1.5" />
          <text x="16" y="74.5" textAnchor="middle" fontSize="13" fontWeight="900" fill="#9a6f00">+</text>
        </g>
      )}
    </Square>
  );
}

export function StuckArt({ className }: { className?: string }) {
  return (
    <Square className={className} bg={['#e6ecf7', '#cdd8ec']}>
      {() => (
        <g>
          <g transform="rotate(-10 50 52)">
            <rect x="26" y="20" width="46" height="62" rx="5" fill="#27407a" />
            <rect x="26" y="20" width="6" height="62" rx="3" fill="#1d3163" />
            <circle cx="51" cy="46" r="11" fill="none" stroke="#e8c15a" strokeWidth="2" />
            <ellipse cx="51" cy="46" rx="4.5" ry="11" fill="none" stroke="#e8c15a" strokeWidth="1.4" />
            <line x1="40" y1="46" x2="62" y2="46" stroke="#e8c15a" strokeWidth="1.4" />
            <rect x="38" y="64" width="26" height="3" rx="1.5" fill="#e8c15a" />
            <rect x="42" y="70" width="18" height="2" rx="1" fill="#e8c15a" opacity="0.7" />
          </g>
          <circle cx="74" cy="28" r="14" fill="#e5484d" />
          <text x="74" y="34.5" textAnchor="middle" fontSize="19" fontWeight="900" fill="#fff">?</text>
          <circle cx="24" cy="80" r="9" fill="none" stroke="#5c6b80" strokeWidth="3" />
          <line x1="30" y1="86" x2="38" y2="94" stroke="#5c6b80" strokeWidth="4" strokeLinecap="round" />
        </g>
      )}
    </Square>
  );
}

function Burst({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  return (
    <g>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 12;
        return (
          <line
            key={i}
            x1={x + Math.cos(a) * r * 0.3}
            y1={y + Math.sin(a) * r * 0.3}
            x2={x + Math.cos(a) * r}
            y2={y + Math.sin(a) * r}
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={x} cy={y} r={r * 0.18} fill="#fff" />
    </g>
  );
}

export function FestivalArt({ className }: { className?: string }) {
  return (
    <Square className={className} bg={['#3a2a78', '#c7569a']}>
      {() => (
        <g>
          {[
            [12, 12],
            [86, 8],
            [64, 40],
            [20, 46],
            [92, 52],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="#fff" opacity="0.8" />
          ))}
          <Burst x={34} y={30} r={18} color="#ffd166" />
          <Burst x={72} y={24} r={14} color="#7ee0f5" />
          <Burst x={60} y={56} r={11} color="#ff8fb1" />
          <path d="M0 70 Q25 80 50 70 T100 70" stroke="#f4efe6" strokeWidth="1" fill="none" />
          {[6, 18, 30, 42, 54, 66, 78, 90].map((x, i) => (
            <polygon key={x} points={`${x - 4},${72 + Math.sin(x / 16) * 4} ${x + 4},${72 + Math.sin((x + 8) / 16) * 4} ${x},${82 + Math.sin(x / 16) * 4}`} fill={['#ffd166', '#ef476f', '#06d6a0', '#118ab2'][i % 4]} />
          ))}
          <rect x="0" y="88" width="100" height="12" fill="#2a1f55" />
        </g>
      )}
    </Square>
  );
}

export function PlaneArt({ className }: { className?: string }) {
  return (
    <Square className={className} bg={['#79c6f3', '#e2f5ff']}>
      {() => (
        <g>
          <Cloud x={24} y={70} s={1.4} />
          <Cloud x={78} y={82} s={1.1} />
          <path d="M8 88 Q30 70 46 58" stroke="#fff" strokeWidth="2.5" strokeDasharray="4 4" fill="none" strokeLinecap="round" />
          <g transform="translate(60 42) rotate(-32)">
            <ellipse cx="0" cy="0" rx="26" ry="6" fill="#ffffff" />
            <path d="M18 -4 Q27 -3 27 0 Q27 3 18 4 Z" fill="#3e63dd" />
            <path d="M-4 -4 L-14 -24 L-6 -24 L10 -4 Z" fill="#dfe6f2" />
            <path d="M-4 4 L-14 24 L-6 24 L10 4 Z" fill="#c9d3e3" />
            <path d="M-20 -3 L-27 -14 L-22 -14 L-14 -3 Z" fill="#3e63dd" />
            {[-8, -2, 4, 10].map((x) => (
              <circle key={x} cx={x} cy="-1.5" r="1.3" fill="#3e63dd" />
            ))}
            <rect x="-26" y="2" width="44" height="1.4" fill="#3e63dd" />
          </g>
        </g>
      )}
    </Square>
  );
}

// ---------------------------------------------------------------- 일반 특수 칸

export function CardArt({ className }: { className?: string }) {
  return (
    <Square className={className} bg={['#fff2d6', '#ffd9a8']}>
      {() => (
        <g>
          <rect x="38" y="20" width="24" height="12" rx="4" fill="none" stroke="#7a4b2a" strokeWidth="4" />
          <rect x="18" y="30" width="64" height="50" rx="8" fill="#b9733f" />
          <rect x="18" y="30" width="64" height="50" rx="8" fill="none" stroke="#8a512a" strokeWidth="2" />
          <rect x="30" y="30" width="5" height="50" fill="#8a512a" />
          <rect x="65" y="30" width="5" height="50" fill="#8a512a" />
          <circle cx="50" cy="48" r="8" fill="#ef476f" />
          <rect x="40" y="60" width="18" height="10" rx="2" fill="#06d6a0" transform="rotate(-8 49 65)" />
          <circle cx="24" cy="74" r="4" fill="#ffd166" />
          <path d="M72 44 L86 36 L92 48 L78 56 Z" fill="#fff" stroke="#7a4b2a" strokeWidth="1.2" />
          <text x="82" y="50" textAnchor="middle" fontSize="11" fontWeight="900" fill="#e5484d" transform="rotate(-28 82 46)">
            ?
          </text>
        </g>
      )}
    </Square>
  );
}

function Coin({ x, y, r = 9 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y + 1.5} r={r} fill="#b9861a" />
      <circle cx={x} cy={y} r={r} fill="#f6c244" />
      <circle cx={x} cy={y} r={r * 0.68} fill="none" stroke="#d9a42a" strokeWidth="1.4" />
    </g>
  );
}

export function AirportTaxArt({ className }: { className?: string }) {
  return (
    <Square className={className} bg={['#e3f2ff', '#cfe4f7']}>
      {() => (
        <g>
          <g transform="rotate(-12 48 46)">
            <rect x="14" y="28" width="66" height="34" rx="4" fill="#fff" stroke="#9fb4cc" strokeWidth="1.2" />
            <rect x="14" y="28" width="66" height="9" rx="4" fill="#3e63dd" />
            <line x1="60" y1="37" x2="60" y2="62" stroke="#9fb4cc" strokeWidth="1" strokeDasharray="2 2" />
            <path d="M24 48 L44 48 M24 54 L38 54" stroke="#9fb4cc" strokeWidth="2" strokeLinecap="round" />
            <path d="M64 46 L74 46 L70 42 M74 46 L70 50" stroke="#3e63dd" strokeWidth="1.6" fill="none" />
          </g>
          <Coin x={70} y={74} r={11} />
          <Coin x={52} y={80} r={9} />
        </g>
      )}
    </Square>
  );
}

export function HotelTaxArt({ className }: { className?: string }) {
  return (
    <Square className={className} bg={['#fbefe0', '#f1d9bd']}>
      {() => (
        <g>
          <rect x="16" y="70" width="56" height="6" rx="2" fill="#8a6a46" />
          <path d="M22 70 Q22 42 44 42 Q66 42 66 70 Z" fill="#e3b341" />
          <path d="M44 42 Q66 42 66 70 L52 70 Q56 50 44 42 Z" fill="#c9952a" />
          <rect x="42" y="36" width="4" height="7" rx="1" fill="#c9952a" />
          <circle cx="44" cy="35" r="3" fill="#e3b341" />
          <path d="M30 56 Q34 50 40 48" stroke="#fff3c4" strokeWidth="2" fill="none" strokeLinecap="round" />
          <Coin x={78} y={68} r={10} />
          <Coin x={80} y={52} r={8} />
        </g>
      )}
    </Square>
  );
}

// ---------------------------------------------------------------- 건물·말·로고

/** 땅 주인 표시용 건물 아이콘. level 0 깃발, 1 집, 2 빌딩, 3 호텔 */
export function BuildingIcon({ level, color, dark, className }: { level: number; color: string; dark: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {level === 0 && (
        <g>
          <line x1="7" y1="3" x2="7" y2="21" stroke="#4b3a2a" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8 4 L20 8 L8 12 Z" fill={color} stroke={dark} strokeWidth="1" />
        </g>
      )}
      {level === 1 && (
        <g>
          <path d="M4 12 L12 4 L20 12 Z" fill={dark} />
          <rect x="6" y="11" width="12" height="10" fill={color} stroke={dark} strokeWidth="1" />
          <rect x="10.5" y="15" width="3" height="6" fill={dark} />
        </g>
      )}
      {level === 2 && (
        <g>
          <rect x="5" y="3" width="14" height="18" fill={color} stroke={dark} strokeWidth="1" />
          {[6, 10, 14].map((y) => (
            <g key={y}>
              <rect x="7.5" y={y} width="3" height="2.4" fill="#fff" />
              <rect x="13.5" y={y} width="3" height="2.4" fill="#fff" />
            </g>
          ))}
          <rect x="10.5" y="17.5" width="3" height="3.5" fill={dark} />
        </g>
      )}
      {level === 3 && (
        <g>
          <rect x="3" y="5" width="18" height="16" fill={color} stroke={dark} strokeWidth="1" />
          <rect x="3.5" y="1" width="17" height="5.4" rx="1" fill={dark} />
          <text x="12" y="5.2" textAnchor="middle" fontSize="4.2" fontWeight="900" fill="#fff" textLength="14" lengthAdjust="spacingAndGlyphs">
            HOTEL
          </text>
          {[8.5, 12.5].map((y) =>
            [5.5, 10.5, 15.5].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="3" height="2.4" fill="#fff" />),
          )}
          <rect x="10" y="16.5" width="4" height="4.5" fill={dark} />
        </g>
      )}
    </svg>
  );
}

export function Pawn({ color, dark, className }: { color: string; dark: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 52" aria-hidden="true">
      <ellipse cx="20" cy="47" rx="15" ry="4.5" fill="#000" opacity="0.25" />
      <ellipse cx="20" cy="44" rx="14" ry="5" fill={dark} />
      <path d="M8 44 Q10 30 15 24 L25 24 Q30 30 32 44 Z" fill={color} />
      <ellipse cx="20" cy="24" rx="8" ry="2.6" fill={dark} />
      <circle cx="20" cy="14" r="10" fill={color} />
      <circle cx="16.5" cy="10.5" r="3.4" fill="#fff" opacity="0.55" />
      <path d="M12 40 Q14 31 17 27" stroke="#fff" strokeWidth="2" opacity="0.35" fill="none" strokeLinecap="round" />
      <circle cx="20" cy="14" r="10" fill="none" stroke={dark} strokeWidth="1.4" />
      <path d="M8 44 Q10 30 15 24 L25 24 Q30 30 32 44 Z" fill="none" stroke={dark} strokeWidth="1.4" />
    </svg>
  );
}

export function GlobeLogo({ className }: { className?: string }) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-sea`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#7fd3ff" />
          <stop offset="1" stopColor="#2a73c9" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <circle cx="50" cy="50" r="34" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="34" fill={`url(#${id}-sea)`} />
      <g clipPath={`url(#${id}-clip)`} fill="#5cc46a">
        <path d="M24 30 Q34 22 44 28 Q46 38 38 42 Q34 52 26 50 Q18 42 24 30 Z" />
        <path d="M40 56 Q48 52 52 60 Q50 74 44 80 Q38 70 40 56 Z" />
        <path d="M56 24 Q70 20 78 30 Q80 40 70 42 Q64 50 58 44 Q52 34 56 24 Z" />
        <path d="M66 58 Q76 56 80 64 Q74 70 66 66 Z" />
      </g>
      <g clipPath={`url(#${id}-clip)`} fill="none" stroke="#fff" strokeWidth="0.8" opacity="0.4">
        <ellipse cx="50" cy="50" rx="14" ry="34" />
        <path d="M16 50 H84 M20 34 H80 M20 66 H80" />
      </g>
      <circle cx="50" cy="50" r="34" fill="none" stroke="#1b4f91" strokeWidth="2" />
      <ellipse cx="50" cy="50" rx="46" ry="14" fill="none" stroke="#ffd166" strokeWidth="2.5" transform="rotate(-18 50 50)" strokeDasharray="70 8" />
      <g transform="translate(88 30) rotate(30)">
        <ellipse cx="0" cy="0" rx="7" ry="2" fill="#fff" stroke="#1b4f91" strokeWidth="0.8" />
        <path d="M-1 0 L-4 -6 L-1 -6 L3 0 L-1 6 L-4 6 Z" fill="#fff" stroke="#1b4f91" strokeWidth="0.8" />
      </g>
    </svg>
  );
}
