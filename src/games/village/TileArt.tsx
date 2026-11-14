import { memo, type ReactNode } from 'react';
import { shapeElement, type ShapeKind } from '../../components/shapes';
import { SEAT_COLORS, type SeatIndex } from '../common/players';
import { bridgeTurn, lineD, paddyShape } from './geometry';
import { TILES, rotPt, type Deco, type SegDef } from './tiles';
import type { EndKind, Pt, Rot } from './types';

/**
 * 우리 마을 지도의 그림 (모두 직접 그린 SVG).
 * 조각 하나는 0~100 좌표. 땅(논·냇물·길)은 조각과 함께 돌고, 집·나무·장승 같은 것은 늘 똑바로 선다.
 */

/** 자리마다 깃발에 붙는 모양 (색을 구별하기 어려워도 알아보게) */
export const SEAT_SHAPES: Record<SeatIndex, ShapeKind> = { 0: 'circle', 1: 'leaf', 2: 'star', 3: 'diamond' };

/** 모든 지도 그림이 함께 쓰는 무늬. 화면에 한 번만 그린다. */
export function VillageDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="vl-clip" clipPathUnits="userSpaceOnUse">
          <rect x="0" y="0" width="100" height="100" />
        </clipPath>
        <pattern id="vl-grass" width="25" height="25" patternUnits="userSpaceOnUse">
          <rect width="25" height="25" fill="#d8e5a6" />
          <path d="M4 7 l1 -3 M6 7 l-0.5 -3 M16 19 l1 -3 M18 19 l-0.5 -3 M20 6 l0.8 -2" stroke="#b2c47c" strokeWidth="0.9" strokeLinecap="round" />
          <circle cx="11" cy="13" r="0.8" fill="#c4d690" />
        </pattern>
        <pattern id="vl-rice" width="9" height="9" patternUnits="userSpaceOnUse">
          <rect width="9" height="9" fill="#a9d462" />
          <path d="M0 8 H9" stroke="#c9e7d6" strokeWidth="1.1" />
          <path d="M2.5 6.5 l-1 -3 M2.5 6.5 l0 -3.4 M2.5 6.5 l1 -3 M7 2.5 l-1 -2.4 M7 2.5 l0 -2.6 M7 2.5 l1 -2.4" stroke="#5c962c" strokeWidth="0.75" strokeLinecap="round" />
        </pattern>
        <linearGradient id="vl-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ecd08a" />
          <stop offset="1" stopColor="#c99a45" />
        </linearGradient>
        <radialGradient id="vl-water" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#bfe6f5" />
          <stop offset="1" stopColor="#6fb3d6" />
        </radialGradient>
      </defs>
    </svg>
  );
}

// ------------------------------------------------------------------ 작은 그림들 (발 딛는 곳이 0,0)

function Shadow({ rx, ry = rx * 0.32 }: { rx: number; ry?: number }) {
  return <ellipse cx={0} cy={0} rx={rx} ry={ry} fill="rgba(60,45,20,0.22)" />;
}

/** 초가집: 둥근 볏짚 지붕, 흰 벽, 나무 기둥 */
export function House() {
  return (
    <g>
      <Shadow rx={17} />
      <rect x={-13} y={-13} width={26} height={13} fill="#f6eedb" stroke="#7a5534" strokeWidth={1.2} />
      <path d="M-13 -13 V0 M-4.5 -13 V0 M4.5 -13 V0 M13 -13 V0" stroke="#8a6040" strokeWidth={1.4} />
      <rect x={-3.5} y={-9.5} width={7} height={9.5} fill="#9a6b43" stroke="#6b4527" strokeWidth={0.8} />
      <rect x={6.5} y={-10} width={5} height={4.5} fill="#e9dcbc" stroke="#8a6040" strokeWidth={0.7} />
      <path d="M-18 -11 Q-17 -27 0 -28 Q17 -27 18 -11 Q0 -7 -18 -11 Z" fill="url(#vl-roof)" stroke="#9f7832" strokeWidth={1.1} />
      <path d="M-11 -24 Q0 -18 11 -24 M-15 -17 Q0 -11 15 -17" fill="none" stroke="#b58b3c" strokeWidth={0.9} />
      <path d="M-1 -28 Q0 -31 1 -28" stroke="#9f7832" strokeWidth={1.2} fill="none" />
    </g>
  );
}

/** 원두막: 네 다리 위의 작은 볏짚 지붕 쉼터 */
function Hut() {
  return (
    <g>
      <Shadow rx={13} />
      <path d="M-9 0 V-12 M9 0 V-12 M-6 -1 V-12 M6 -1 V-12" stroke="#7a5534" strokeWidth={1.6} strokeLinecap="round" />
      <rect x={-11} y={-14} width={22} height={3} rx={1} fill="#b98a55" stroke="#6b4527" strokeWidth={0.8} />
      <path d="M-9 -14 V-20 M9 -14 V-20" stroke="#7a5534" strokeWidth={1.3} />
      <path d="M-14 -19 Q0 -32 14 -19 Q0 -16 -14 -19 Z" fill="url(#vl-roof)" stroke="#9f7832" strokeWidth={1} />
    </g>
  );
}

/** 장터: 흰 차양 아래 장독과 고추 바구니 */
function Market() {
  return (
    <g>
      <Shadow rx={22} />
      <path d="M-18 0 V-18 M18 0 V-18" stroke="#7a5534" strokeWidth={1.6} />
      <path d="M-22 -17 L-16 -25 H16 L22 -17 Q16 -14 11 -17 Q5.5 -14 0 -17 Q-5.5 -14 -11 -17 Q-16 -14 -22 -17 Z" fill="#fbf6ea" stroke="#b5432f" strokeWidth={1.2} />
      <path d="M-16 -25 H16" stroke="#b5432f" strokeWidth={2} />
      <ellipse cx={-10} cy={-6} rx={6} ry={6.5} fill="#6b4024" stroke="#3f2412" strokeWidth={0.9} />
      <ellipse cx={-11.5} cy={-8.5} rx={1.6} ry={2.4} fill="#a7764c" opacity={0.8} />
      <rect x={-13} y={-13.5} width={6} height={2} rx={1} fill="#4a2a14" />
      <ellipse cx={2} cy={-4.5} rx={4.5} ry={5} fill="#7d4c2a" stroke="#3f2412" strokeWidth={0.9} />
      <path d="M8 -1 Q13 -6 18 -1 Z" fill="#c8a06a" stroke="#7a5534" strokeWidth={0.8} />
      <circle cx={11} cy={-3.2} r={1.4} fill="#d8362a" />
      <circle cx={13.6} cy={-3.6} r={1.4} fill="#e2452f" />
      <circle cx={15.8} cy={-2.8} r={1.2} fill="#c92e22" />
    </g>
  );
}

/** 갈림길 돌무더기 */
function Cairn() {
  return (
    <g>
      <Shadow rx={10} />
      <ellipse cx={0} cy={-3} rx={9} ry={4.2} fill="#a8a294" stroke="#6f695c" strokeWidth={0.9} />
      <ellipse cx={-1} cy={-8} rx={6.5} ry={3.4} fill="#bab4a6" stroke="#6f695c" strokeWidth={0.9} />
      <ellipse cx={0.5} cy={-12} rx={4} ry={2.6} fill="#c9c3b5" stroke="#6f695c" strokeWidth={0.9} />
      <ellipse cx={0} cy={-15.5} rx={2.2} ry={1.7} fill="#d6d0c2" stroke="#6f695c" strokeWidth={0.8} />
    </g>
  );
}

/** 빨래터: 넓적한 빨랫돌, 빨래 뭉치, 방망이 */
function Laundry() {
  return (
    <g>
      <ellipse cx={-6} cy={-2} rx={9} ry={4} fill="#b7b1a4" stroke="#6f695c" strokeWidth={0.9} />
      <ellipse cx={7} cy={-1} rx={7} ry={3.4} fill="#aaa497" stroke="#6f695c" strokeWidth={0.9} />
      <path d="M-11 -4 Q-8 -9 -3 -6 Q-1 -3 -5 -2 Q-10 -1 -11 -4 Z" fill="#f4f6fb" stroke="#9aa6b8" strokeWidth={0.8} />
      <path d="M3 -3 L13 -6" stroke="#8a6040" strokeWidth={2.2} strokeLinecap="round" />
    </g>
  );
}

/** 샘: 돌로 두른 맑은 물 */
function Spring() {
  return (
    <g>
      <ellipse cx={0} cy={0} rx={12} ry={8} fill="#9e9789" stroke="#6f695c" strokeWidth={1} />
      <ellipse cx={0} cy={-0.5} rx={8.5} ry={5.2} fill="url(#vl-water)" />
      {[-9, -4.5, 0, 4.5, 9].map((x, i) => (
        <ellipse key={i} cx={x} cy={x === 0 ? 6.8 : Math.abs(x) > 6 ? 3 : 5.8} rx={2.6} ry={1.6} fill="#c3bdae" stroke="#6f695c" strokeWidth={0.6} />
      ))}
      <circle cx={-2} cy={-1.5} r={1.4} fill="none" stroke="#fff" strokeWidth={0.7} opacity={0.9} />
      <circle cx={2.5} cy={0.5} r={0.9} fill="none" stroke="#fff" strokeWidth={0.6} opacity={0.8} />
    </g>
  );
}

/** 연못: 연잎과 연꽃 */
function Pond() {
  return (
    <g>
      <path d="M-20 0 Q-21 -13 -5 -14 Q14 -16 19 -4 Q22 9 4 11 Q-17 13 -20 0 Z" fill="url(#vl-water)" stroke="#4f8db0" strokeWidth={1.3} />
      <path d="M-12 1 a5 4 0 1 1 3 3.5 l-3 -3.5 z" fill="#5f9e45" stroke="#3f7a2c" strokeWidth={0.6} />
      <path d="M8 -6 a4.5 3.5 0 1 1 -3 2.8 l3 -2.8 z" fill="#6aab4f" stroke="#3f7a2c" strokeWidth={0.6} />
      <g transform="translate(9 3)">
        <path d="M0 0 Q-3 -3 -1 -6 Q0 -3 0 0 Q1 -3 2 -6 Q4 -3 0 0 Z" fill="#f29bb5" stroke="#c2577a" strokeWidth={0.5} />
      </g>
      <path d="M-4 -8 q3 -1.5 6 0" stroke="#e3f5fb" strokeWidth={0.9} fill="none" />
    </g>
  );
}

/** 장승 한 쌍: 갓 쓴 천하대장군과 지하여장군 */
export function Jangseung({ size = 1 }: { size?: number }) {
  const pole = (x: number, h: number, hat: boolean, tint: string) => (
    <g transform={`translate(${x} 0)`}>
      <path d={`M-3.6 0 V${-h + 6} Q-3.8 ${-h} 0 ${-h - 0.5} Q3.8 ${-h} 3.6 ${-h + 6} V0 Z`} fill={tint} stroke="#6b4527" strokeWidth={0.9} />
      {hat ? (
        <g>
          <ellipse cx={0} cy={-h + 1} rx={6} ry={1.6} fill="#2e2825" />
          <rect x={-3} y={-h - 4.5} width={6} height={5} rx={1.4} fill="#2e2825" />
        </g>
      ) : (
        <path d={`M-3.6 ${-h + 3} Q0 ${-h - 2.5} 3.6 ${-h + 3}`} fill="#3a2a20" />
      )}
      {/* 부리부리한 눈, 주먹코, 이를 드러낸 입 */}
      <path d={`M-3 ${-h + 5.6} q1.4 -1.2 2.4 0 M0.6 ${-h + 5.6} q1.4 -1.2 2.4 0`} stroke="#3a2416" strokeWidth={0.8} fill="none" />
      <circle cx={-1.7} cy={-h + 7.6} r={1.25} fill="#fff" stroke="#3a2416" strokeWidth={0.5} />
      <circle cx={1.7} cy={-h + 7.6} r={1.25} fill="#fff" stroke="#3a2416" strokeWidth={0.5} />
      <circle cx={-1.7} cy={-h + 7.7} r={0.55} fill="#1d130c" />
      <circle cx={1.7} cy={-h + 7.7} r={0.55} fill="#1d130c" />
      <ellipse cx={0} cy={-h + 10.3} rx={1.1} ry={1.3} fill="#b07c48" stroke="#3a2416" strokeWidth={0.4} />
      <rect x={-2.4} y={-h + 12.5} width={4.8} height={2.2} rx={0.8} fill="#fff" stroke="#3a2416" strokeWidth={0.5} />
      <path d={`M-1.2 ${-h + 12.5} v2.2 M0 ${-h + 12.5} v2.2 M1.2 ${-h + 12.5} v2.2`} stroke="#3a2416" strokeWidth={0.3} />
      <path d={`M-2.2 ${-h + 17} V-3 M0 ${-h + 17} V-3 M2.2 ${-h + 17} V-3`} stroke="#a0713f" strokeWidth={0.5} opacity={0.7} />
      <path d={`M-3.4 ${-h + 16} H3.4`} stroke="#c0392b" strokeWidth={0.9} />
    </g>
  );
  return (
    <g transform={size !== 1 ? `scale(${size})` : undefined}>
      <Shadow rx={11} />
      {pole(-4.6, 29, true, '#d1a46b')}
      {pole(4.8, 25, false, '#c99a5f')}
    </g>
  );
}

/** 소나무: 구불한 줄기와 층층이 뭉게진 잎 */
function Pine() {
  return (
    <g>
      <Shadow rx={9} />
      <path d="M0 0 Q-2 -7 1 -12 Q3 -16 0 -21" stroke="#7a4f2c" strokeWidth={2.6} fill="none" strokeLinecap="round" />
      <path d="M-11 -12 Q-11 -17 -4 -16 Q-1 -20 4 -17 Q11 -18 10 -12 Q4 -10 -11 -12 Z" fill="#3e7d4a" stroke="#2c5c36" strokeWidth={0.8} />
      <path d="M-8 -19 Q-8 -24 -2 -23 Q2 -27 6 -23 Q10 -22 8 -19 Q0 -17 -8 -19 Z" fill="#4a8d55" stroke="#2c5c36" strokeWidth={0.8} />
      <path d="M-5 -25 Q-4 -30 1 -29 Q6 -30 5 -25 Q0 -23 -5 -25 Z" fill="#579c60" stroke="#2c5c36" strokeWidth={0.8} />
    </g>
  );
}

/** 둥근 느티나무 */
function Tree() {
  return (
    <g>
      <Shadow rx={9} />
      <path d="M0 0 V-10" stroke="#7a4f2c" strokeWidth={2.6} strokeLinecap="round" />
      <circle cx={0} cy={-16} r={9} fill="#7fb35a" stroke="#4f7f37" strokeWidth={0.9} />
      <circle cx={-3} cy={-19} r={4} fill="#94c56c" />
      <circle cx={3} cy={-13} r={1.2} fill="#e86a5a" />
    </g>
  );
}

function Flowers() {
  return (
    <g>
      {[
        [-4, -1, '#f2a3b8'],
        [0, -3, '#fff3b0'],
        [4, 0, '#f6f6f0'],
        [1, 2, '#f2a3b8'],
      ].map(([x, y, c], i) => (
        <circle key={i} cx={x as number} cy={y as number} r={1.6} fill={c as string} stroke="rgba(120,90,60,0.4)" strokeWidth={0.4} />
      ))}
    </g>
  );
}

function Rock() {
  return (
    <g>
      <path d="M-6 0 Q-7 -5 -2 -6 Q4 -8 6 -3 Q7 0 3 1 Q-3 2 -6 0 Z" fill="#b2ab9c" stroke="#6f695c" strokeWidth={0.8} />
      <path d="M-2 -4 Q1 -5 3 -3" stroke="#d2ccbe" strokeWidth={0.8} fill="none" />
    </g>
  );
}

function Tuft() {
  return <path d="M-4 0 Q-4 -4 -6 -6 M-1 0 Q-1 -5 0 -8 M2 0 Q2 -4 5 -6" stroke="#8fae55" strokeWidth={1.1} fill="none" strokeLinecap="round" />;
}

/** 냇물의 물고기 (+2점) */
export function Fish() {
  return (
    <g>
      <path d="M-6 0 Q-1 -4.5 5 0 Q-1 4.5 -6 0 Z" fill="#f08a4b" stroke="#a6501f" strokeWidth={0.8} />
      <path d="M-5.5 0 L-10 -3.5 L-9 0 L-10 3.5 Z" fill="#f4a36d" stroke="#a6501f" strokeWidth={0.7} />
      <circle cx={2.4} cy={-0.8} r={0.8} fill="#2b1a10" />
      <path d="M-1 -2.6 Q0 0 -1 2.6" stroke="#a6501f" strokeWidth={0.5} fill="none" />
    </g>
  );
}

/** 허수아비 (+2점): 삿갓, 벌린 팔 */
export function Scarecrow() {
  return (
    <g>
      <Shadow rx={6} />
      <path d="M0 0 V-17" stroke="#8a6040" strokeWidth={1.4} />
      <path d="M-9 -12 H9" stroke="#8a6040" strokeWidth={1.4} strokeLinecap="round" />
      <path d="M-5 -14 H5 L4 -6 H-4 Z" fill="#6f8fc9" stroke="#3f5a8f" strokeWidth={0.8} />
      <path d="M-9.5 -12 l-1.6 1.6 M-9.5 -12 l-1.6 -1.2 M9.5 -12 l1.6 1.6 M9.5 -12 l1.6 -1.2" stroke="#d9b75c" strokeWidth={0.9} />
      <circle cx={0} cy={-17.5} r={3.2} fill="#f3e2b8" stroke="#8a6040" strokeWidth={0.7} />
      <path d="M-6.5 -19 L0 -25 L6.5 -19 Z" fill="#d6b25e" stroke="#9f7832" strokeWidth={0.8} />
      <circle cx={-1.1} cy={-17.3} r={0.5} fill="#3a2416" />
      <circle cx={1.1} cy={-17.3} r={0.5} fill="#3a2416" />
    </g>
  );
}

/** 깃발: 자리 색 천에 자리 모양 */
export function Pennant({ seat, scale = 1 }: { seat: SeatIndex; scale?: number }) {
  const c = SEAT_COLORS[seat];
  return (
    <g transform={scale !== 1 ? `scale(${scale})` : undefined}>
      <ellipse cx={0} cy={0} rx={4.5} ry={1.8} fill="rgba(40,30,15,0.3)" />
      <path d="M0 0 V-30" stroke="#5a3a1f" strokeWidth={2} strokeLinecap="round" />
      <g className="vl-cloth">
        <path d="M1 -30 Q11 -28 21 -24 Q11 -20 1 -18 Z" fill={c.main} stroke={c.dark} strokeWidth={1.2} strokeLinejoin="round" />
        {shapeElement(SEAT_SHAPES[seat], 8.5, -24, 3.6, '#fff')}
      </g>
      <circle cx={0} cy={-31} r={1.8} fill="#e9c46a" stroke="#9a7a2a" strokeWidth={0.5} />
    </g>
  );
}

const DECO: Record<Deco['kind'], () => ReactNode> = {
  pine: () => <Pine />,
  tree: () => <Tree />,
  flowers: () => <Flowers />,
  rock: () => <Rock />,
  tuft: () => <Tuft />,
};

const END_SPRITE: Partial<Record<EndKind, () => ReactNode>> = {
  house: () => <House />,
  hut: () => <Hut />,
  laundry: () => <Laundry />,
  spring: () => <Spring />,
  pond: () => <Pond />,
};

// ------------------------------------------------------------------ 땅 모양 (조각과 함께 돈다)

export function PaddyShape({ seg, className }: { seg: SegDef; className?: string }) {
  const shape = paddyShape(seg.edges);
  return (
    <g transform={shape.turn ? `rotate(${shape.turn * 90} 50 50)` : undefined} className={className}>
      <path d={shape.fill} fill="url(#vl-rice)" />
      {shape.bank && (
        <>
          <path d={shape.bank} fill="none" stroke="#a37b48" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
          <path d={shape.bank} fill="none" stroke="#d8bd8a" strokeWidth={1.3} strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

function StreamLine({ seg }: { seg: SegDef }) {
  const d = lineD(seg);
  return (
    <g>
      <path d={d} fill="none" stroke="#5f97b5" strokeWidth={19} strokeLinecap="round" />
      <path d={d} fill="none" stroke="#8ccbe5" strokeWidth={14} strokeLinecap="round" />
      <path d={d} fill="none" stroke="#e3f5fb" strokeWidth={1.6} strokeDasharray="5 9" strokeLinecap="round" />
    </g>
  );
}

function PathLine({ seg }: { seg: SegDef }) {
  const d = lineD(seg);
  return (
    <g>
      {/* 돌담처럼 가장자리에 박힌 돌 */}
      <path d={d} fill="none" stroke="#9c9383" strokeWidth={20} strokeDasharray="2.6 3.4" strokeLinecap="butt" />
      <path d={d} fill="none" stroke="#dcbf8e" strokeWidth={14} strokeLinecap="round" />
      <path d={d} fill="none" stroke="#ecd8b0" strokeWidth={3.5} strokeDasharray="7 9" strokeLinecap="round" />
    </g>
  );
}

function Bridge({ turn }: { turn: number }) {
  return (
    <g transform={turn ? `rotate(90 50 50)` : undefined}>
      <rect x={37} y={33} width={26} height={34} rx={2} fill="#c3bcae" stroke="#6f695c" strokeWidth={1.2} />
      <path d="M37 41.5 H63 M37 50 H63 M37 58.5 H63" stroke="#8f887a" strokeWidth={1} />
      <path d="M38.5 33 V67 M61.5 33 V67" stroke="#a49d8f" strokeWidth={1.6} />
    </g>
  );
}

/** 한 지형만 그린다 (완성 반짝임, 깃발 고르기 미리 보기). 조각 좌표계 안에서 쓴다 */
export function SegmentGlow({ seg, className }: { seg: SegDef; className?: string }) {
  if (seg.kind === 'paddy') {
    const shape = paddyShape(seg.edges);
    return <path d={shape.fill} transform={shape.turn ? `rotate(${shape.turn * 90} 50 50)` : undefined} className={className} />;
  }
  return <path d={lineD(seg)} className={className} fill="none" strokeLinecap="round" />;
}

// ------------------------------------------------------------------ 조각 한 장

interface TileArtProps {
  t: number;
  r: Rot;
}

/** 조각 한 장 (0~100 좌표). 지도와 손 조각이 함께 쓴다 */
export const TileArt = memo(function TileArt({ t, r }: TileArtProps) {
  const def = TILES[t];
  const sprites: { at: Pt; node: ReactNode; key: string }[] = [];
  const crossDone = new Set<string>();
  let market: Pt[] = [];
  def.segs.forEach((s, i) => {
    if (s.end === 'cross' && s.at) {
      const k = s.at.join(',');
      if (!crossDone.has(k)) {
        crossDone.add(k);
        sprites.push({ at: s.at, node: <Cairn />, key: `cross-${k}` });
      }
    } else if (s.end === 'market' && s.at) market = [...market, s.at];
    else if (s.end && s.at && END_SPRITE[s.end]) sprites.push({ at: s.at, node: END_SPRITE[s.end]!(), key: `end-${i}` });
    s.crows?.forEach((p, k) => sprites.push({ at: p, node: <Scarecrow />, key: `crow-${i}-${k}` }));
  });
  if (market.length > 0) {
    const at: Pt = [market.reduce((a, p) => a + p[0], 0) / market.length, market.reduce((a, p) => a + p[1], 0) / market.length + 8];
    sprites.push({ at, node: <Market />, key: 'market' });
  }
  def.deco?.forEach((dc, i) => sprites.push({ at: dc.at, node: DECO[dc.kind](), key: `deco-${i}` }));
  if (def.jangseung) sprites.push({ at: def.jangseung, node: <Jangseung />, key: 'js' });
  // 아래쪽에 있는 것이 앞에 보이게
  const placed = sprites.map((s) => ({ ...s, at: rotPt(s.at, r) })).sort((a, b) => a.at[1] - b.at[1]);
  const fish = def.segs.flatMap((s, i) => (s.fish ?? []).map((p, k) => ({ at: rotPt(p, r), key: `fish-${i}-${k}` })));
  const bridge = bridgeTurn(def.segs);

  return (
    <g clipPath="url(#vl-clip)">
      <rect width={100} height={100} fill="url(#vl-grass)" />
      <g transform={r ? `rotate(${r * 90} 50 50)` : undefined}>
        {def.segs.map((s, i) => (s.kind === 'paddy' ? <PaddyShape key={i} seg={s} /> : null))}
        {def.segs.map((s, i) => (s.kind === 'stream' ? <StreamLine key={i} seg={s} /> : null))}
        {def.segs.map((s, i) => (s.kind === 'path' ? <PathLine key={i} seg={s} /> : null))}
        {bridge !== null && <Bridge turn={bridge} />}
      </g>
      {fish.map((f) => (
        <g key={f.key} transform={`translate(${f.at[0]} ${f.at[1]})`}>
          <Fish />
        </g>
      ))}
      {placed.map((s) => (
        <g key={s.key} transform={`translate(${s.at[0]} ${s.at[1]})`}>
          {s.node}
        </g>
      ))}
      <rect x={0.4} y={0.4} width={99.2} height={99.2} fill="none" stroke="rgba(90,70,40,0.16)" strokeWidth={0.8} />
    </g>
  );
});

/** 조각 한 장짜리 SVG (손 조각, 패널, 설명) */
export function TileIcon({ t, r = 0, size = 64, className, title }: { t: number; r?: Rot; size?: number; className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <TileArt t={t} r={r} />
    </svg>
  );
}
