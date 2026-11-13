import type { CSSProperties, ReactElement } from 'react';
import { CARD_BLACK, CARD_RED, SUIT_INFO, cardLabel, rankLabel, type Card, type Suit } from '../games/common/playingCards';
import './playing-card.css';

/**
 * 보통 트럼프 카드 그림 — 이 프로젝트에서 직접 그린 SVG (100×140).
 * - A~10: 무늬(♠♥♦♣)를 흔히 쓰는 자리 배치로 그린다. 아래쪽 절반은 뒤집어 그린다.
 * - J·Q·K: 직접 그린 귀여운 만화풍 인물 (위아래 대칭)
 * - 조커: 복면을 쓴 귀여운 도둑 (도둑잡기용)
 * - 뒷면: CSS로 그린 무늬 (손패가 많아도 가볍게)
 * 크기는 CSS 변수 --pc-w (기본 72px)로 정한다. 뒷면 색은 --pc-back.
 */

const INK = '#2a2420';
const SKIN = '#ffd9b8';
const CHEEK = '#ff8f8f';
const GOLD = '#f2bd3c';
const FONT = "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', system-ui, sans-serif";

/** 무늬 모양 (가운데 0,0 · 크기 100 기준) */
const SUIT_PATHS: Record<Suit, string> = {
  heart:
    'M0 45 C-30 22 -50 5 -50 -18 C-50 -36 -36 -47 -24 -47 C-12 -47 -3 -40 0 -30 C3 -40 12 -47 24 -47 C36 -47 50 -36 50 -18 C50 5 30 22 0 45 Z',
  spade:
    'M0 -48 C-30 -22 -50 -8 -50 12 C-50 28 -38 38 -25 38 C-15 38 -7 33 -3 27 C-5 38 -12 46 -20 50 L20 50 C12 46 5 38 3 27 C7 33 15 38 25 38 C38 38 50 28 50 12 C50 -8 30 -22 0 -48 Z',
  diamond: 'M0 -50 Q16 -24 38 0 Q16 24 0 50 Q-16 24 -38 0 Q-16 -24 0 -50 Z',
  club:
    'M-22 -24 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0 Z M-46 6 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0 Z M2 6 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0 Z M-12 2 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 Z M-4 8 C-4 30 -12 42 -20 50 L20 50 C12 42 4 30 4 8 Z',
};

export function suitColor(suit: Suit): string {
  return SUIT_INFO[suit].red ? CARD_RED : CARD_BLACK;
}

/** (x, y)를 가운데로 하는 크기 size의 무늬. flip이면 거꾸로 */
export function SuitShape({ suit, x, y, size, flip = false, fill }: { suit: Suit; x: number; y: number; size: number; flip?: boolean; fill?: string }) {
  const k = size / 100;
  return <path d={SUIT_PATHS[suit]} transform={`translate(${x} ${y}) scale(${k})${flip ? ' rotate(180)' : ''}`} fill={fill ?? suitColor(suit)} />;
}

/** 글자 사이에 넣는 작은 무늬 그림 */
export function SuitIcon({ suit, size = 16, className = '', color }: { suit: Suit; size?: number; className?: string; color?: string }) {
  return (
    <svg viewBox="-52 -52 104 104" width={size} height={size} className={`pc-suit-icon ${className}`} role="img" aria-label={SUIT_INFO[suit].name}>
      <path d={SUIT_PATHS[suit]} fill={color ?? suitColor(suit)} />
    </svg>
  );
}

// ---------------------------------------------------------------- 숫자 카드 무늬 배치
const L = 31;
const C = 50;
const R = 69;
const ROW4 = [27, 55.7, 84.3, 113];
const ROW3 = [27, 70, 113];

type Pip = [number, number];

function pipLayout(rank: number): Pip[] {
  const [t, m, b] = ROW3;
  switch (rank) {
    case 2:
      return [
        [C, t],
        [C, b],
      ];
    case 3:
      return [
        [C, t],
        [C, m],
        [C, b],
      ];
    case 4:
      return [
        [L, t],
        [R, t],
        [L, b],
        [R, b],
      ];
    case 5:
      return [...pipLayout(4), [C, m]];
    case 6:
      return [...pipLayout(4), [L, m], [R, m]];
    case 7:
      return [...pipLayout(6), [C, 48.5]];
    case 8:
      return [...pipLayout(6), [C, 48.5], [C, 91.5]];
    case 9:
    case 10: {
      const sides: Pip[] = ROW4.flatMap((y) => [
        [L, y],
        [R, y],
      ]) as Pip[];
      return rank === 9 ? [...sides, [C, m]] : [...sides, [C, 41.3], [C, 98.7]];
    }
    default:
      return [];
  }
}

function CornerIndex({ card, color }: { card: Card; color: string }) {
  const label = rankLabel(card.rank);
  const wide = label.length > 1;
  return (
    <g>
      <text
        x={11.5}
        y={16}
        fontSize={wide ? 15 : 18}
        letterSpacing={wide ? -1.6 : 0}
        fontWeight={800}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontFamily={FONT}
      >
        {label}
      </text>
      <SuitShape suit={card.suit!} x={11.5} y={31} size={10.5} />
    </g>
  );
}

// ---------------------------------------------------------------- J·Q·K 인물
interface CourtPalette {
  robe: string;
  dark: string;
  tint: string;
  hair: string;
}

const COURT: Record<Suit, CourtPalette> = {
  heart: { robe: '#d8343b', dark: '#8e1c22', tint: '#fff1ee', hair: '#7a3e1d' },
  diamond: { robe: '#ea7a2c', dark: '#9f4410', tint: '#fff4e6', hair: '#d99a1e' },
  spade: { robe: '#33427a', dark: '#161d38', tint: '#eef1f8', hair: '#2b2b2b' },
  club: { robe: '#2c7058', dark: '#123b2c', tint: '#ebf6f1', hair: '#9b4f22' },
};

function Face({ cy, r = 10.8 }: { cy: number; r?: number }) {
  return (
    <>
      <circle cx={50} cy={cy} r={r} fill={SKIN} stroke={INK} strokeWidth={1.2} />
      <circle cx={42.6} cy={cy + 3} r={1.9} fill={CHEEK} opacity={0.55} />
      <circle cx={57.4} cy={cy + 3} r={1.9} fill={CHEEK} opacity={0.55} />
      <circle cx={45.8} cy={cy - 0.8} r={1.35} fill={INK} />
      <circle cx={54.2} cy={cy - 0.8} r={1.35} fill={INK} />
    </>
  );
}

const ROBE = 'M25 70 C26 61 33 56 41 55 L59 55 C67 56 74 61 75 70 Z';

function KingHalf({ p }: { p: CourtPalette }) {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d={ROBE} fill={p.robe} stroke={INK} strokeWidth={1.2} />
      <path d="M37 56 C42 60.5 58 60.5 63 56 L61 54.5 C56 57.5 44 57.5 39 54.5 Z" fill="#fffaf0" stroke={INK} strokeWidth={0.8} />
      <circle cx={44} cy={57.6} r={0.8} fill={INK} />
      <circle cx={50} cy={58.6} r={0.8} fill={INK} />
      <circle cx={56} cy={57.6} r={0.8} fill={INK} />
      <path d="M50 62 L50 70" stroke={GOLD} strokeWidth={2} />
      <line x1={67} y1={69} x2={69.5} y2={41} stroke={INK} strokeWidth={3.4} />
      <line x1={67} y1={69} x2={69.5} y2={41} stroke={GOLD} strokeWidth={1.8} />
      <circle cx={69.8} cy={38.4} r={3.4} fill={GOLD} stroke={INK} strokeWidth={1} />
      <Face cy={41} />
      <path
        d="M39.3 42 C39.5 52 45 56.5 50 56.5 C55 56.5 60.5 52 60.7 42 C58 46 55 47.5 50 47.5 C45 47.5 42 46 39.3 42 Z"
        fill="#f7f3ea"
        stroke={INK}
        strokeWidth={1}
      />
      <path d="M45 46.5 C47 45 49 45.3 50 46.5 C51 45.3 53 45 55 46.5 C53 48 51 47.8 50 47 C49 47.8 47 48 45 46.5 Z" fill="#f7f3ea" stroke={INK} strokeWidth={0.8} />
      <path d="M39 33.5 L38.5 23.5 L44 28.5 L50 21 L56 28.5 L61.5 23.5 L61 33.5 Z" fill={GOLD} stroke={INK} strokeWidth={1.1} />
      <circle cx={50} cy={29.6} r={1.8} fill={p.robe} stroke={INK} strokeWidth={0.5} />
      <circle cx={44.5} cy={31.2} r={1} fill={p.robe} />
      <circle cx={55.5} cy={31.2} r={1} fill={p.robe} />
    </g>
  );
}

function QueenHalf({ p }: { p: CourtPalette }) {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d="M37.5 42 C36 30 42 27.5 50 27.5 C58 27.5 64 30 62.5 42 C62.5 50 65 55 67 60 L33 60 C35 55 37.5 50 37.5 42 Z" fill={p.hair} stroke={INK} strokeWidth={1} />
      <path d={ROBE} fill={p.robe} stroke={INK} strokeWidth={1.2} />
      <path d="M42 55.3 C45 60.5 55 60.5 58 55.3" fill="none" stroke={GOLD} strokeWidth={2} />
      <circle cx={50} cy={61} r={1.7} fill={GOLD} stroke={INK} strokeWidth={0.6} />
      <line x1={31.5} y1={69} x2={33} y2={53} stroke="#3d8b4f" strokeWidth={1.6} />
      <path d="M33 58 C30 56 28.5 57.5 29 59 C31 59.5 32 59 33 58 Z" fill="#4fa25f" />
      <g transform="translate(33 50)">
        {[0, 72, 144, 216, 288].map((a) => (
          <circle key={a} cx={2.8 * Math.cos((a * Math.PI) / 180)} cy={2.8 * Math.sin((a * Math.PI) / 180)} r={2.4} fill="#ffffff" stroke={INK} strokeWidth={0.5} />
        ))}
        <circle r={1.8} fill={GOLD} />
      </g>
      <Face cy={41.5} r={10.4} />
      <path d="M39.6 40 C40 31.5 46 30 50 32 C54 30 60 31.5 60.4 40 C57.5 36 54 35 50 35.6 C46 35 42.5 36 39.6 40 Z" fill={p.hair} stroke={INK} strokeWidth={0.8} />
      <path d="M42.5 31.5 L44 26 L47 30 L50 24 L53 30 L56 26 L57.5 31.5 C54 30.3 46 30.3 42.5 31.5 Z" fill={GOLD} stroke={INK} strokeWidth={0.9} />
      <circle cx={50} cy={27.6} r={1.1} fill={p.robe} />
      <path d="M47.4 45.6 Q50 47.8 52.6 45.6" fill="none" stroke="#c0392b" strokeWidth={1.3} />
    </g>
  );
}

function JackHalf({ p }: { p: CourtPalette }) {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d={ROBE} fill={p.robe} stroke={INK} strokeWidth={1.2} />
      <path d="M43 55.2 L50 63 L57 55.2 Z" fill="#fffaf0" stroke={INK} strokeWidth={0.8} />
      <circle cx={50} cy={66.5} r={1.1} fill={GOLD} />
      <line x1={31} y1={69} x2={31} y2={31} stroke={INK} strokeWidth={2.8} />
      <line x1={31} y1={69} x2={31} y2={31} stroke="#c58b4a" strokeWidth={1.4} />
      <path d="M31.5 30.5 L42.5 34 L31.5 37.5 Z" fill={GOLD} stroke={INK} strokeWidth={0.8} />
      <Face cy={42.5} r={10.4} />
      <path d="M39.7 41 C39.5 35 44 32.8 50 32.8 C56 32.8 60.5 35 60.3 41 C58 38.6 55 37.6 52 38.2 L50 36.6 L48 38.2 C45 37.6 42 38.6 39.7 41 Z" fill={p.hair} />
      <path d="M37 35.5 C37 26 63 26 63 35.5 C58 33.5 42 33.5 37 35.5 Z" fill={p.dark} stroke={INK} strokeWidth={1} />
      <path d="M57.5 29.5 C63 22.5 69 21 73 22 C69 25.5 64 28.5 59 31.5 Z" fill="#fffaf0" stroke={INK} strokeWidth={0.8} />
      <path d="M46.6 46.8 Q50 49.8 53.4 46.8" fill="none" stroke={INK} strokeWidth={1.1} />
    </g>
  );
}

function CourtArt({ card }: { card: Card }) {
  const suit = card.suit!;
  const p = COURT[suit];
  const Half = card.rank === 13 ? KingHalf : card.rank === 12 ? QueenHalf : JackHalf;
  return (
    <g>
      <rect x={21} y={16} width={58} height={108} rx={4} fill={p.tint} stroke={suitColor(suit)} strokeWidth={1.2} />
      <Half p={p} />
      <g transform="rotate(180 50 70)">
        <Half p={p} />
      </g>
      <line x1={21.6} y1={70} x2={78.4} y2={70} stroke={p.dark} strokeWidth={0.9} />
      <SuitShape suit={suit} x={27} y={22.5} size={8} />
      <SuitShape suit={suit} x={73} y={117.5} size={8} flip />
    </g>
  );
}

// ---------------------------------------------------------------- 조커: 복면 도둑
const STRIPE_DARK = '#2b2d42';
const STRIPE_LIGHT = '#f6f2ea';
const THIEF_RED = '#e05a47';

function ThiefHead({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  // 머리 하나를 (cx, cy) 반지름 r 크기로 그린다 (기준 크기 14)
  const k = r / 14;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${k})`} strokeLinejoin="round" strokeLinecap="round">
      <circle r={14} fill={SKIN} stroke={INK} strokeWidth={1.3} />
      <circle cx={-8.5} cy={7} r={2.2} fill={CHEEK} opacity={0.6} />
      <circle cx={8.5} cy={7} r={2.2} fill={CHEEK} opacity={0.6} />
      <path d="M-14.2 -2.5 C-15 -17.5 15 -17.5 14.2 -2.5 Z" fill={STRIPE_DARK} stroke={INK} strokeWidth={1} />
      <rect x={-15} y={-6.5} width={30} height={5} rx={2.5} fill={THIEF_RED} stroke={INK} strokeWidth={0.8} />
      <circle cx={0} cy={-15.5} r={3.3} fill={THIEF_RED} stroke={INK} strokeWidth={0.8} />
      <path d="M-14 1.5 L-19.5 -1.5 L-18.5 3 Z M-14 4.5 L-19.5 7.5 L-17.8 3.3 Z" fill="#1d1d28" />
      <rect x={-14.5} y={-0.5} width={29} height={8.5} rx={4.2} fill="#1d1d28" />
      <ellipse cx={-5.5} cy={3.6} rx={3.5} ry={2.7} fill="#fff" />
      <ellipse cx={5.5} cy={3.6} rx={3.5} ry={2.7} fill="#fff" />
      <circle cx={-4.2} cy={3.9} r={1.45} fill={INK} />
      <circle cx={6.8} cy={3.9} r={1.45} fill={INK} />
      <path d="M-5 9.6 Q0.5 13.4 5.6 8.8" fill="none" stroke={INK} strokeWidth={1.3} />
      <path d="M1.4 11.3 L2.6 13.2 L3.6 11" fill="#fff" stroke={INK} strokeWidth={0.6} />
    </g>
  );
}

function ThiefArt() {
  // 줄무늬 몸통: 진한 타원 위에 흰 줄을 얹는다 (타원 폭에 맞춘 너비)
  const bodyCx = 50;
  const bodyCy = 88;
  const rx = 17.5;
  const ry = 15;
  const stripes = [79.2, 86.2, 93.2, 100.2].map((y) => {
    const dy = (y - bodyCy) / ry;
    const hw = rx * Math.sqrt(Math.max(0, 1 - dy * dy)) - 1.2;
    return { y, hw };
  });
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <rect x={21} y={16} width={58} height={108} rx={4} fill="#f1ebfb" stroke="#6b3fa0" strokeWidth={1.2} />
      {[
        [29, 24],
        [71, 27],
        [26, 48],
        [74, 98],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y - 3} L${x + 0.9} ${y - 0.9} L${x + 3} ${y} L${x + 0.9} ${y + 0.9} L${x} ${y + 3} L${x - 0.9} ${y + 0.9} L${x - 3} ${y} L${x - 0.9} ${y - 0.9} Z`} fill="#c9b2ec" />
      ))}
      <ellipse cx={51} cy={113.5} rx={17} ry={2.6} fill="rgba(60,30,90,0.15)" />
      {/* 발끝으로 살금살금 */}
      <line x1={45} y1={100} x2={42} y2={110} stroke={STRIPE_DARK} strokeWidth={4.2} />
      <ellipse cx={40.2} cy={111.3} rx={4.4} ry={2.3} fill="#1d1d28" />
      <line x1={55.5} y1={100} x2={61} y2={106} stroke={STRIPE_DARK} strokeWidth={4.2} />
      <ellipse cx={63.6} cy={106.4} rx={4.4} ry={2.3} fill="#1d1d28" transform="rotate(-24 63.6 106.4)" />
      {/* 보따리 */}
      <path d="M57 58 C66 50 80 54 78.5 67 C77.5 77 66 80 60 75 C55 71 53 62 57 58 Z" fill="#cf9f5e" stroke={INK} strokeWidth={1.1} />
      <path d="M60 60.5 C62 57 65 56 67 57.5" fill="none" stroke="#a87b3f" strokeWidth={1} />
      <path d="M69 63.5 L70.4 66.6 L73.7 66.9 L71.2 69 L72 72.3 L69 70.5 L66 72.3 L66.8 69 L64.3 66.9 L67.6 66.6 Z" fill={GOLD} stroke={INK} strokeWidth={0.6} />
      {/* 몸통 */}
      <ellipse cx={bodyCx} cy={bodyCy} rx={rx} ry={ry} fill={STRIPE_DARK} stroke={INK} strokeWidth={1} />
      {stripes.map((s) => (
        <rect key={s.y} x={bodyCx - s.hw} y={s.y - 1.8} width={s.hw * 2} height={3.6} rx={1.8} fill={STRIPE_LIGHT} />
      ))}
      {/* 보따리를 든 팔 */}
      <path d="M63 80 C66 75 64 70 61 67" fill="none" stroke={STRIPE_DARK} strokeWidth={4.2} />
      <circle cx={60.5} cy={66.5} r={3} fill={SKIN} stroke={INK} strokeWidth={1} />
      {/* "쉿!" 하는 팔 */}
      <path d="M36.5 82 C32 77 33.5 72 37 69.5" fill="none" stroke={STRIPE_DARK} strokeWidth={4.2} />
      <ThiefHead cx={50} cy={58} r={14} />
      <circle cx={38} cy={69} r={3.1} fill={SKIN} stroke={INK} strokeWidth={1} />
      <rect x={37.3} y={62.6} width={2.4} height={6} rx={1.2} fill={SKIN} stroke={INK} strokeWidth={0.8} />
      {/* 이름표 */}
      <rect x={38} y={115.5} width={24} height={7.5} rx={3.75} fill="#6b3fa0" />
      <text x={50} y={119.4} fontSize={6} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill="#fff" fontFamily={FONT}>
        도둑
      </text>
    </g>
  );
}

function JokerCorner() {
  return (
    <g>
      {'JOKER'.split('').map((ch, i) => (
        <text key={i} x={11} y={13 + i * 9} fontSize={9.5} fontWeight={900} textAnchor="middle" dominantBaseline="central" fill="#6b3fa0" fontFamily={FONT}>
          {ch}
        </text>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- 카드 앞면
function FullFace({ card }: { card: Card }) {
  if (card.suit === null) {
    return (
      <>
        <ThiefArt />
        <JokerCorner />
        <g transform="rotate(180 50 70)">
          <JokerCorner />
        </g>
      </>
    );
  }
  const color = suitColor(card.suit);
  let middle: ReactElement;
  if (card.rank === 1) {
    middle = (
      <g>
        <circle cx={50} cy={70} r={30} fill="none" stroke={color} strokeOpacity={0.28} strokeWidth={1.2} strokeDasharray="2 3" />
        <circle cx={50} cy={70} r={25} fill={color} fillOpacity={0.06} />
        <SuitShape suit={card.suit} x={50} y={70} size={42} />
      </g>
    );
  } else if (card.rank >= 11) {
    middle = <CourtArt card={card} />;
  } else {
    const size = card.rank >= 9 ? 16.5 : 18;
    middle = (
      <g>
        {pipLayout(card.rank).map(([x, y], i) => (
          <SuitShape key={i} suit={card.suit!} x={x} y={y} size={size} flip={y > 70} />
        ))}
      </g>
    );
  }
  return (
    <>
      {middle}
      <CornerIndex card={card} color={color} />
      <g transform="rotate(180 50 70)">
        <CornerIndex card={card} color={color} />
      </g>
    </>
  );
}

/** 작은 크기용: 큰 숫자와 큰 무늬만 */
function MiniFace({ card }: { card: Card }) {
  if (card.suit === null) {
    return (
      <>
        <rect x={6} y={6} width={88} height={128} rx={6} fill="#f1ebfb" />
        <ThiefHead cx={50} cy={74} r={30} />
        <text x={50} y={24} fontSize={20} fontWeight={900} textAnchor="middle" dominantBaseline="central" fill="#6b3fa0" fontFamily={FONT}>
          조커
        </text>
      </>
    );
  }
  const color = suitColor(card.suit);
  const label = rankLabel(card.rank);
  const wide = label.length > 1;
  return (
    <>
      {card.rank >= 11 && <rect x={6} y={6} width={88} height={128} rx={6} fill={COURT[card.suit].tint} />}
      <text
        x={29}
        y={32}
        fontSize={wide ? 34 : 40}
        letterSpacing={wide ? -3 : 0}
        fontWeight={900}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontFamily={FONT}
      >
        {label}
      </text>
      <SuitShape suit={card.suit} x={29} y={66} size={24} />
      <SuitShape suit={card.suit} x={63} y={103} size={46} />
    </>
  );
}

interface FaceProps {
  card: Card;
  className?: string;
  /** mini: 작은 칸에서도 잘 보이게 큰 숫자와 무늬만 그린다 */
  variant?: 'full' | 'mini';
  style?: CSSProperties;
}

export function PlayingCardFace({ card, className = '', variant = 'full', style }: FaceProps) {
  return (
    <svg viewBox="0 0 100 140" className={`pc-card pc-face ${className}`} style={style} role="img" aria-label={cardLabel(card)}>
      <rect x={0.75} y={0.75} width={98.5} height={138.5} rx={8} fill="#fffdf8" stroke="#bdb5a6" strokeWidth={1.5} />
      {variant === 'mini' ? <MiniFace card={card} /> : <FullFace card={card} />}
    </svg>
  );
}

/** 카드 뒷면 (CSS). 색은 --pc-back 변수로 바꿀 수 있다. */
export function PlayingCardBack({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <span className={`pc-card pc-back ${className}`} style={style} aria-hidden="true">
      <span className="pc-back-emblem" />
    </span>
  );
}

/** 뒤집히는 카드: faceUp이 바뀌면 3D로 뒤집힌다. card가 없으면 뒷면만 */
export function FlipCard({ card, faceUp, className = '', variant }: { card: Card | null; faceUp: boolean; className?: string; variant?: 'full' | 'mini' }) {
  return (
    <span className={`pc-flip${faceUp && card ? ' pc-flip-up' : ''} ${className}`}>
      <span className="pc-flip-inner">
        <span className="pc-flip-front">{card ? <PlayingCardFace card={card} variant={variant} /> : <PlayingCardBack />}</span>
        <span className="pc-flip-back">
          <PlayingCardBack />
        </span>
      </span>
    </span>
  );
}

export interface FlyingCardSpec {
  id: number;
  /** 출발·도착 위치 (날아가는 층 기준 px, 카드 가운데) */
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** 보여 줄 카드. null이면 뒷면 */
  card: Card | null;
  /** 뒷면으로 출발해서 날아가는 동안 앞면으로 뒤집힌다 */
  flip?: boolean;
  /** 앞면으로 출발해서 뒷면으로 뒤집힌다 */
  hide?: boolean;
  delay: number;
  duration: number;
  /** 카드 너비 px (출발 → 도착) */
  w0: number;
  w1: number;
  /** 도착할 때 기울기 (도) */
  rotate?: number;
}

/** 한 곳에서 다른 곳으로 날아가는 카드. 부모(날아가는 층)는 position: relative/absolute */
export function FlyingCard({ spec }: { spec: FlyingCardSpec }) {
  const style = {
    '--fx': `${spec.x}px`,
    '--fy': `${spec.y}px`,
    '--tx': `${spec.tx}px`,
    '--ty': `${spec.ty}px`,
    '--s1': spec.w1 / spec.w0,
    '--r1': `${spec.rotate ?? 0}deg`,
    '--pc-w': `${spec.w0}px`,
    animationDelay: `${spec.delay}ms`,
    animationDuration: `${spec.duration}ms`,
  } as CSSProperties;
  const turning = spec.card && (spec.flip || spec.hide);
  return (
    <span className="pc-flyer" style={style}>
      {turning ? (
        <span className={`pc-flip pc-flyer-turn ${spec.flip ? 'pc-turn-up' : 'pc-turn-down'}`} style={{ animationDelay: `${spec.delay}ms`, animationDuration: `${spec.duration}ms` }}>
          <span className="pc-flip-inner" style={{ animationDelay: `${spec.delay}ms`, animationDuration: `${spec.duration}ms` }}>
            <span className="pc-flip-front">
              <PlayingCardFace card={spec.card!} />
            </span>
            <span className="pc-flip-back">
              <PlayingCardBack />
            </span>
          </span>
        </span>
      ) : spec.card ? (
        <PlayingCardFace card={spec.card} />
      ) : (
        <PlayingCardBack />
      )}
    </span>
  );
}
