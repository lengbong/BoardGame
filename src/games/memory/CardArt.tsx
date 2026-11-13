import type { ReactElement } from 'react';
import { pictureInfo } from './themes';

/**
 * 이 프로젝트에서 직접 그린 카드 그림 (SVG, 100×100)
 * 모두 같은 그림체: 굵은 갈색 테두리, 납작한 밝은 색, 동그란 눈과 볼터치.
 * 색을 몰라도 알아볼 수 있게 그림마다 바깥 모양(실루엣)을 다르게 했다.
 */

const INK = '#3a2c24';
const CHEEK = '#ff8fa3';
const GLASS = '#bfe6ff';
const LEAF = '#6cc04a';
const STEM = '#7a4a2a';

type MouthKind = 'smile' | 'w' | 'open' | 'none';

interface FaceProps {
  x: number;
  y: number;
  s?: number;
  mouth?: MouthKind;
  cheeks?: boolean;
  /** 어두운 바탕 위: 흰자위가 있는 눈 */
  white?: boolean;
  /** 코 색 (없으면 코 없음) */
  nose?: string;
}

/** 귀여운 얼굴: 눈 두 개 + 입 + 볼터치. (x, y)는 두 눈 사이 */
function Face({ x, y, s = 1, mouth = 'smile', cheeks = true, white = false, nose }: FaceProps) {
  const ex = 7 * s;
  const my = y + (nose ? 6.5 : 5) * s;
  return (
    <g>
      {cheeks && (
        <>
          <circle cx={x - 11 * s} cy={y + 4 * s} r={3.2 * s} fill={CHEEK} opacity={0.65} stroke="none" />
          <circle cx={x + 11 * s} cy={y + 4 * s} r={3.2 * s} fill={CHEEK} opacity={0.65} stroke="none" />
        </>
      )}
      {[-1, 1].map((d) =>
        white ? (
          <g key={d}>
            <circle cx={x + d * ex} cy={y} r={3.7 * s} fill="#fff" strokeWidth={1.4 * s} />
            <circle cx={x + d * ex + 0.5 * s} cy={y + 0.4 * s} r={2 * s} fill={INK} stroke="none" />
          </g>
        ) : (
          <g key={d}>
            <circle cx={x + d * ex} cy={y} r={2.8 * s} fill={INK} stroke="none" />
            <circle cx={x + d * ex - 0.9 * s} cy={y - 1 * s} r={1 * s} fill="#fff" stroke="none" />
          </g>
        ),
      )}
      {nose && <ellipse cx={x} cy={y + 3.3 * s} rx={2.6 * s} ry={1.9 * s} fill={nose} stroke="none" />}
      {mouth === 'smile' && <path d={`M${x - 3.5 * s} ${my} Q${x} ${my + 4 * s} ${x + 3.5 * s} ${my}`} fill="none" strokeWidth={2 * s} />}
      {mouth === 'w' && (
        <path d={`M${x - 4 * s} ${my} Q${x - 2 * s} ${my + 3 * s} ${x} ${my} Q${x + 2 * s} ${my + 3 * s} ${x + 4 * s} ${my}`} fill="none" strokeWidth={1.8 * s} />
      )}
      {mouth === 'open' && <path d={`M${x - 3.5 * s} ${my} Q${x} ${my + 6.5 * s} ${x + 3.5 * s} ${my} Z`} fill="#c94a5a" strokeWidth={1.6 * s} />}
    </g>
  );
}

/** 옆모습 얼굴: 눈 하나 + 웃는 입 + 볼터치. dir=-1이면 왼쪽을 본다 */
function SideFace({ x, y, s = 1, dir = -1 }: { x: number; y: number; s?: number; dir?: 1 | -1 }) {
  return (
    <g>
      <circle cx={x - dir * 5 * s} cy={y + 5 * s} r={3 * s} fill={CHEEK} opacity={0.65} stroke="none" />
      <circle cx={x} cy={y} r={2.9 * s} fill={INK} stroke="none" />
      <circle cx={x - 0.9 * s} cy={y - 1 * s} r={1 * s} fill="#fff" stroke="none" />
      <path d={`M${x + dir * 1 * s} ${y + 6 * s} Q${x + dir * 5 * s} ${y + 9 * s} ${x + dir * 8 * s} ${y + 5 * s}`} fill="none" strokeWidth={2 * s} />
    </g>
  );
}

/** 테두리가 있는 굵은 선 (다리, 줄기, 자전거 몸통) */
function Tube({ d, color, w }: { d: string; color: string; w: number }) {
  return (
    <>
      <path d={d} fill="none" stroke={INK} strokeWidth={w + 5} />
      <path d={d} fill="none" stroke={color} strokeWidth={w} />
    </>
  );
}

function Wheel({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <>
      <circle cx={x} cy={y} r={r} fill="#3d3b4a" />
      <circle cx={x} cy={y} r={r * 0.42} fill="#d9dce4" strokeWidth={2} />
    </>
  );
}

/** 물결 모양 동그라미 (사자 갈기, 브로콜리) */
function scallop(cx: number, cy: number, r: number, n: number, depth = 0.6): string {
  const chord = 2 * r * Math.sin(Math.PI / n);
  const rr = (chord / 2 / depth).toFixed(2);
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = (cx + r * Math.cos(a)).toFixed(1);
    const y = (cy + r * Math.sin(a)).toFixed(1);
    d += i === 0 ? `M${x} ${y}` : ` A${rr} ${rr} 0 0 1 ${x} ${y}`;
  }
  return `${d}Z`;
}

/** 달팽이 껍데기 소용돌이 */
function spiral(cx: number, cy: number, turns: number, maxR: number): string {
  const steps = Math.round(turns * 24);
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const r = 1.5 + t * maxR;
    d += `${i === 0 ? 'M' : ' L'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }
  return d;
}

const Dots = ({ pts, r, fill }: { pts: [number, number][]; r: number; fill: string }) => (
  <>
    {pts.map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r={r} fill={fill} stroke="none" />
    ))}
  </>
);

// ================================================================ 동물
const ANIMALS: Record<string, () => ReactElement> = {
  'a-rabbit': () => (
    <>
      <ellipse cx={38} cy={28} rx={8.5} ry={21} transform="rotate(-12 38 28)" fill="#f7f3ef" />
      <ellipse cx={62} cy={28} rx={8.5} ry={21} transform="rotate(12 62 28)" fill="#f7f3ef" />
      <ellipse cx={38} cy={30} rx={3.8} ry={14} transform="rotate(-12 38 30)" fill="#ffb3c4" stroke="none" />
      <ellipse cx={62} cy={30} rx={3.8} ry={14} transform="rotate(12 62 30)" fill="#ffb3c4" stroke="none" />
      <ellipse cx={50} cy={67} rx={28} ry={24} fill="#f7f3ef" />
      <Face x={50} y={63} nose="#ff7f9a" mouth="w" />
    </>
  ),
  'a-bear': () => (
    <>
      <circle cx={26} cy={31} r={11} fill="#b47a4c" />
      <circle cx={74} cy={31} r={11} fill="#b47a4c" />
      <circle cx={26} cy={31} r={5.5} fill="#e8c39b" stroke="none" />
      <circle cx={74} cy={31} r={5.5} fill="#e8c39b" stroke="none" />
      <circle cx={50} cy={57} r={30} fill="#b47a4c" />
      <ellipse cx={50} cy={68} rx={13} ry={10} fill="#ecd0ac" />
      <Face x={50} y={52} mouth="none" />
      <ellipse cx={50} cy={64} rx={4.6} ry={3.3} fill={INK} stroke="none" />
      <path d="M50 66 L50 69 M45 69 Q47.5 72.5 50 69 Q52.5 72.5 55 69" fill="none" strokeWidth={2} />
    </>
  ),
  'a-cat': () => (
    <>
      <path d="M23 50 L26 14 L48 32 Z" fill="#f6a54c" />
      <path d="M77 50 L74 14 L52 32 Z" fill="#f6a54c" />
      <path d="M29 38 L30 23 L40 31 Z" fill="#ffb3c4" stroke="none" />
      <path d="M71 38 L70 23 L60 31 Z" fill="#ffb3c4" stroke="none" />
      <ellipse cx={50} cy={59} rx={30} ry={25} fill="#f6a54c" />
      <path d="M44 36 L45 43 M50 35 L50 43 M56 36 L55 43" fill="none" stroke="#c76c1c" strokeWidth={3} />
      <path d="M14 58 L30 61 M15 67 L30 65 M86 58 L70 61 M85 67 L70 65" fill="none" strokeWidth={2} />
      <Face x={50} y={56} nose="#ff7f9a" mouth="w" />
    </>
  ),
  'a-dog': () => (
    <>
      <ellipse cx={50} cy={55} rx={25} ry={27} fill="#f5dfbf" />
      <ellipse cx={58} cy={48} rx={8} ry={7} fill="#c08a5c" stroke="none" />
      <path d="M31 33 C17 29 10 45 15 63 C17 71 26 71 28 62 C30 52 33 44 31 33 Z" fill="#a8754c" />
      <path d="M69 33 C83 29 90 45 85 63 C83 71 74 71 72 62 C70 52 67 44 69 33 Z" fill="#a8754c" />
      <ellipse cx={50} cy={67} rx={12.5} ry={9} fill="#fff6e8" />
      <ellipse cx={50} cy={62.5} rx={5} ry={3.6} fill={INK} stroke="none" />
      <path d="M50 65 L50 68 M44.5 68 Q47.2 71.5 50 68 Q52.8 71.5 55.5 68" fill="none" strokeWidth={2} />
      <path d="M47.6 71 Q50 78 52.4 71 Z" fill="#ff7b8f" strokeWidth={1.5} />
      <Face x={50} y={50} mouth="none" />
    </>
  ),
  'a-pig': () => (
    <>
      <path d="M27 40 L21 15 L45 28 Z" fill="#f7a8b8" />
      <path d="M73 40 L79 15 L55 28 Z" fill="#f7a8b8" />
      <circle cx={50} cy={57} r={29} fill="#f9bccb" />
      <ellipse cx={50} cy={65} rx={13} ry={9} fill="#f48fa6" />
      <ellipse cx={45.5} cy={65} rx={2.1} ry={3.2} fill={INK} stroke="none" />
      <ellipse cx={54.5} cy={65} rx={2.1} ry={3.2} fill={INK} stroke="none" />
      <Face x={50} y={49} mouth="none" />
      <path d="M45 78 Q50 81 55 78" fill="none" strokeWidth={2} />
    </>
  ),
  'a-lion': () => (
    <>
      <path d={scallop(50, 53, 34, 14, 0.62)} fill="#d9822b" />
      <circle cx={33} cy={36} r={6.5} fill="#f7c56b" />
      <circle cx={67} cy={36} r={6.5} fill="#f7c56b" />
      <circle cx={50} cy={55} r={22} fill="#f7c56b" />
      <ellipse cx={50} cy={64} rx={10} ry={7} fill="#fde6b4" stroke="none" />
      <path d="M45.5 60 L54.5 60 L50 64.5 Z" fill="#8a4b2a" strokeWidth={1.5} />
      <path d="M50 64.5 L50 67 M45.5 67 Q47.8 70 50 67 Q52.2 70 54.5 67" fill="none" strokeWidth={2} />
      <Face x={50} y={51} mouth="none" />
    </>
  ),
  'a-chick': () => (
    <>
      <path d="M41 84 L41 93 M36 93 L46 93 M59 84 L59 93 M54 93 L64 93" fill="none" stroke="#e98a1f" strokeWidth={3.5} />
      <path d="M47 32 Q42 18 49 20 Q50 13 56 18 Q61 21 54 32" fill="#ffd84d" />
      <circle cx={50} cy={58} r={28} fill="#ffd84d" />
      <path d="M23 58 Q13 64 19 75 Q28 74 29 64" fill="#ffc22e" />
      <path d="M77 58 Q87 64 81 75 Q72 74 71 64" fill="#ffc22e" />
      <Face x={50} y={52} mouth="none" />
      <path d="M44 58 L56 58 L50 65.5 Z" fill="#ff9a2e" strokeWidth={2} />
    </>
  ),
  'a-penguin': () => (
    <>
      <ellipse cx={40} cy={89} rx={8} ry={4} fill="#ff9a2e" />
      <ellipse cx={60} cy={89} rx={8} ry={4} fill="#ff9a2e" />
      <ellipse cx={24} cy={60} rx={7} ry={17} transform="rotate(22 24 60)" fill="#34405a" />
      <ellipse cx={76} cy={60} rx={7} ry={17} transform="rotate(-22 76 60)" fill="#34405a" />
      <ellipse cx={50} cy={54} rx={26} ry={34} fill="#34405a" />
      <path d="M50 31 C39 22 27 31 31 45 C27 62 31 82 50 84 C69 82 73 62 69 45 C73 31 61 22 50 31 Z" fill="#fbfbf7" />
      <Face x={50} y={43} s={0.95} mouth="none" />
      <path d="M45 49 L55 49 L50 55 Z" fill="#ff9a2e" strokeWidth={2} />
    </>
  ),
  'a-owl': () => (
    <>
      <path d="M24 32 L30 11 L42 24 Q50 21 58 24 L70 11 L76 32 Q84 54 76 74 Q68 90 50 90 Q32 90 24 74 Q16 54 24 32 Z" fill="#a8744f" />
      <ellipse cx={50} cy={71} rx={17} ry={15} fill="#ecd3ad" stroke="none" />
      <path d="M42 66 l3 3 l3 -3 M52 66 l3 3 l3 -3 M47 75 l3 3 l3 -3" fill="none" stroke="#b98a5e" strokeWidth={2} />
      <path d="M24 48 Q11 62 22 80 Q29 70 29 56 Z" fill="#8a5a3a" />
      <path d="M76 48 Q89 62 78 80 Q71 70 71 56 Z" fill="#8a5a3a" />
      <circle cx={38} cy={42} r={12} fill="#fff7e6" />
      <circle cx={62} cy={42} r={12} fill="#fff7e6" />
      <circle cx={39} cy={43} r={5.5} fill={INK} stroke="none" />
      <circle cx={61} cy={43} r={5.5} fill={INK} stroke="none" />
      <circle cx={37.3} cy={41.2} r={1.8} fill="#fff" stroke="none" />
      <circle cx={59.3} cy={41.2} r={1.8} fill="#fff" stroke="none" />
      <path d="M46 51 L54 51 L50 58 Z" fill="#ff9a2e" strokeWidth={2} />
    </>
  ),
  'a-fish': () => (
    <>
      <path d="M68 50 L91 31 Q86 50 91 69 Z" fill="#ff9f43" />
      <path d="M33 33 Q46 16 60 31 Z" fill="#ff9f43" />
      <path d="M42 68 Q50 80 58 67 Z" fill="#ff9f43" />
      <ellipse cx={44} cy={50} rx={31} ry={20} fill="#ffc048" />
      <path d="M53 32 Q46 50 53 68 M63 35 Q57 50 63 65" fill="none" stroke="#ff9f43" strokeWidth={4} />
      <path d="M34 40 Q39 50 34 60" fill="none" strokeWidth={2} />
      <SideFace x={23} y={46} />
      <circle cx={10} cy={26} r={3.2} fill="#d6f1ff" strokeWidth={1.8} />
      <circle cx={17} cy={15} r={4.5} fill="#d6f1ff" strokeWidth={1.8} />
    </>
  ),
  'a-whale': () => (
    <>
      <path d="M36 30 Q34 20 26 16 M36 30 Q36 18 37 11 M36 30 Q39 20 47 16" fill="none" stroke="#56b8f0" strokeWidth={3.5} />
      <path
        d="M8 60 C8 41 24 33 42 33 C62 33 73 45 76 57 C80 51 82 43 89 39 C93 45 92 51 88 57 C94 57 97 62 95 67 C87 67 81 65 76 64 C70 77 56 83 40 83 C21 83 8 74 8 60 Z"
        fill="#5b8fd9"
      />
      <path d="M12 68 C20 79 38 83 56 79 C42 78 26 75 12 68 Z" fill="#cfe3ff" stroke="none" />
      <path d="M20 72 L22 76 M30 75 L31 79 M40 77 L40 81" fill="none" stroke="#8fb3e8" strokeWidth={2} />
      <SideFace x={24} y={54} />
    </>
  ),
  'a-turtle': () => (
    <>
      <ellipse cx={27} cy={72} rx={7} ry={9} fill="#9bd77b" />
      <ellipse cx={61} cy={72} rx={7} ry={9} fill="#9bd77b" />
      <path d="M11 64 L3 69 L12 71 Z" fill="#9bd77b" />
      <path d="M70 60 Q76 50 84 48" fill="none" stroke={INK} strokeWidth={14} />
      <path d="M70 60 Q76 50 84 48" fill="none" stroke="#9bd77b" strokeWidth={9} />
      <circle cx={85} cy={47} r={11} fill="#9bd77b" />
      <path d="M8 66 Q10 28 43 27 Q76 28 78 66 Z" fill="#5fae4c" />
      <path d="M35 39 L51 39 L57 51 L51 62 L35 62 L29 51 Z" fill="#82c96b" strokeWidth={2.5} />
      <path d="M35 39 L28 31 M51 39 L58 31 M57 51 L72 50 M29 51 L14 50 M35 62 L33 66 M51 62 L53 66" fill="none" strokeWidth={2.5} />
      <rect x={6} y={62} width={74} height={8} rx={4} fill="#e8c56b" />
      <SideFace x={88} y={44} s={0.85} dir={1} />
    </>
  ),
  'a-crab': () => (
    <>
      <Tube d="M28 66 L13 72 M28 72 L15 81 M72 66 L87 72 M72 72 L85 81" color="#f0664b" w={3.5} />
      <Tube d="M35 56 Q24 48 24 38 M65 56 Q76 48 76 38" color="#f0664b" w={4} />
      <path d="M24 40 C11 40 9 23 19 16 L24 27 L30 18 C37 26 35 40 24 40 Z" fill="#f0664b" />
      <path d="M76 40 C89 40 91 23 81 16 L76 27 L70 18 C63 26 65 40 76 40 Z" fill="#f0664b" />
      <path d="M43 48 L41 34 M57 48 L59 34" fill="none" strokeWidth={3} />
      <ellipse cx={50} cy={63} rx={28} ry={18} fill="#f0664b" />
      <circle cx={41} cy={32} r={5} fill="#fff" strokeWidth={2} />
      <circle cx={59} cy={32} r={5} fill="#fff" strokeWidth={2} />
      <circle cx={41.5} cy={32.5} r={2.4} fill={INK} stroke="none" />
      <circle cx={59.5} cy={32.5} r={2.4} fill={INK} stroke="none" />
      <path d="M43 66 Q50 72 57 66" fill="none" strokeWidth={2.2} />
      <circle cx={35} cy={64} r={3.4} fill={CHEEK} opacity={0.7} stroke="none" />
      <circle cx={65} cy={64} r={3.4} fill={CHEEK} opacity={0.7} stroke="none" />
    </>
  ),
  'a-octopus': () => (
    <>
      {['M30 58 Q20 72 26 84 Q31 91 36 84', 'M40 62 Q35 78 42 89', 'M50 62 Q49 79 55 91', 'M60 62 Q66 78 59 89', 'M70 58 Q80 72 74 84 Q69 91 64 84'].map((d) => (
        <Tube key={d} d={d} color="#e57fb5" w={8} />
      ))}
      <path d="M23 56 C19 28 35 12 50 12 C65 12 81 28 77 56 C70 67 30 67 23 56 Z" fill="#e57fb5" />
      <Dots pts={[[36, 26], [62, 22], [68, 34]]} r={3.2} fill="#f7b3d6" />
      <Face x={50} y={44} />
    </>
  ),
  'a-frog': () => (
    <>
      <ellipse cx={30} cy={87} rx={11} ry={5} fill="#5fae4c" />
      <ellipse cx={70} cy={87} rx={11} ry={5} fill="#5fae4c" />
      <circle cx={33} cy={36} r={12} fill="#7cc95a" />
      <circle cx={67} cy={36} r={12} fill="#7cc95a" />
      <ellipse cx={50} cy={62} rx={34} ry={25} fill="#7cc95a" />
      <ellipse cx={50} cy={73} rx={18} ry={10} fill="#c6eba5" stroke="none" />
      <circle cx={33} cy={35} r={7.5} fill="#fff" strokeWidth={2} />
      <circle cx={67} cy={35} r={7.5} fill="#fff" strokeWidth={2} />
      <circle cx={34} cy={36} r={3.6} fill={INK} stroke="none" />
      <circle cx={66} cy={36} r={3.6} fill={INK} stroke="none" />
      <path d="M31 59 Q50 73 69 59" fill="none" strokeWidth={2.6} />
      <circle cx={24} cy={58} r={3.6} fill={CHEEK} opacity={0.7} stroke="none" />
      <circle cx={76} cy={58} r={3.6} fill={CHEEK} opacity={0.7} stroke="none" />
    </>
  ),
  'a-snail': () => (
    <>
      <path d="M20 46 L13 29 M32 46 L34 28" fill="none" strokeWidth={2.5} />
      <circle cx={13} cy={27} r={3.2} fill={INK} stroke="none" />
      <circle cx={34} cy={26} r={3.2} fill={INK} stroke="none" />
      <path d="M10 84 Q7 72 15 66 L15 56 Q15 43 26 43 Q37 43 37 56 L37 71 L84 72 Q93 74 91 80 Q89 85 80 85 L16 85 Q10 85 10 84 Z" fill="#b9e08a" />
      <circle cx={60} cy={50} r={25} fill="#f2b45a" />
      <path d={spiral(60, 50, 2.25, 19)} fill="none" stroke="#b9772e" strokeWidth={3} />
      <Face x={26} y={55} s={0.62} />
    </>
  ),
  'a-butterfly': () => (
    <>
      <path d="M48 46 C40 21 19 11 11 22 C5 33 16 49 48 51 Z" fill="#ff9ec7" />
      <path d="M52 46 C60 21 81 11 89 22 C95 33 84 49 52 51 Z" fill="#ff9ec7" />
      <path d="M48 53 C30 55 17 67 23 79 C29 89 44 79 48 61 Z" fill="#ffc94d" />
      <path d="M52 53 C70 55 83 67 77 79 C71 89 56 79 52 61 Z" fill="#ffc94d" />
      <circle cx={27} cy={29} r={5.5} fill="#fff3a8" strokeWidth={2} />
      <circle cx={73} cy={29} r={5.5} fill="#fff3a8" strokeWidth={2} />
      <circle cx={33} cy={71} r={4} fill="#fff" strokeWidth={2} />
      <circle cx={67} cy={71} r={4} fill="#fff" strokeWidth={2} />
      <path d="M47 26 Q42 13 35 13 M53 26 Q58 13 65 13" fill="none" strokeWidth={2.5} />
      <circle cx={35} cy={13} r={2.6} fill={INK} stroke="none" />
      <circle cx={65} cy={13} r={2.6} fill={INK} stroke="none" />
      <rect x={45} y={34} width={10} height={48} rx={5} fill="#6b5240" />
      <circle cx={50} cy={31} r={9} fill="#6b5240" />
      <Face x={50} y={30} s={0.5} white cheeks={false} mouth="none" />
    </>
  ),
  'a-elephant': () => (
    <>
      <ellipse cx={24} cy={46} rx={17} ry={21} fill="#a9b8c9" />
      <ellipse cx={76} cy={46} rx={17} ry={21} fill="#a9b8c9" />
      <ellipse cx={25} cy={47} rx={10} ry={13} fill="#f4b6c6" stroke="none" />
      <ellipse cx={75} cy={47} rx={10} ry={13} fill="#f4b6c6" stroke="none" />
      <path d="M43 58 C42 72 46 84 56 88 C62 90 69 86 67 80 C65 76 59 80 56 76 C54 70 56 64 57 58 Z" fill="#a9b8c9" />
      <circle cx={50} cy={44} r={23} fill="#a9b8c9" />
      <path d="M46 72 L53 71 M49 80 L56 80" fill="none" strokeWidth={2} />
      <Face x={50} y={42} mouth="none" />
    </>
  ),
};

// ================================================================ 과일·채소
const FOOD: Record<string, () => ReactElement> = {
  'f-apple': () => (
    <>
      <path d="M50 30 C40 20 14 22 14 50 C14 76 34 92 50 86 C66 92 86 76 86 50 C86 22 60 20 50 30 Z" fill="#ef4b4b" />
      <path d="M50 30 Q50 20 54 11" fill="none" stroke={STEM} strokeWidth={4.5} />
      <path d="M55 20 Q66 7 79 13 Q69 26 55 20 Z" fill={LEAF} />
      <ellipse cx={27} cy={44} rx={4} ry={8} transform="rotate(20 27 44)" fill="#fff" opacity={0.7} stroke="none" />
      <Face x={50} y={56} />
    </>
  ),
  'f-banana': () => (
    <>
      <path d="M22 22 C19 58 44 86 84 83 C91 82 92 75 86 73 C56 71 39 53 36 22 Z" fill="#ffd93d" />
      <path d="M22 23 L19 11 L31 9 L36 23 Z" fill="#8a6a3a" />
      <circle cx={88} cy={78} r={2.6} fill={INK} stroke="none" />
      <path d="M30 32 C33 56 50 72 78 77" fill="none" stroke="#e6b31e" strokeWidth={2.5} />
      <g transform="rotate(-40 40 62)">
        <Face x={40} y={62} s={0.6} />
      </g>
    </>
  ),
  'f-strawberry': () => (
    <>
      <path d="M50 90 C30 82 14 58 18 40 C22 26 38 26 50 32 C62 26 78 26 82 40 C86 58 70 82 50 90 Z" fill="#f0445a" />
      {(
        [
          [30, 44], [42, 39], [58, 39], [70, 44], [26, 56], [74, 56], [33, 70], [67, 70], [44, 79], [56, 79], [50, 46],
        ] as [number, number][]
      ).map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx={1.6} ry={2.5} fill="#ffe066" stroke="none" />
      ))}
      <path d="M50 35 L35 25 L44 23 L40 12 L50 20 L60 12 L56 23 L65 25 Z" fill="#5cb84a" />
      <Face x={50} y={58} />
    </>
  ),
  'f-grapes': () => (
    <>
      <path d="M50 26 Q52 16 58 10" fill="none" stroke={STEM} strokeWidth={4.5} />
      <path d="M54 20 Q64 6 80 12 Q72 26 54 20 Z" fill={LEAF} />
      {(
        [
          [50, 84], [41, 68], [59, 68], [32, 51], [50, 51], [68, 51], [23, 34], [41, 34], [59, 34], [77, 34],
        ] as [number, number][]
      ).map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={10} fill="#9461cf" />
          <circle cx={x - 3.5} cy={y - 3.5} r={2.2} fill="#fff" opacity={0.6} stroke="none" />
        </g>
      ))}
      <Face x={50} y={51} s={0.55} />
    </>
  ),
  'f-watermelon': () => (
    <>
      <path d="M6 32 L94 32 A44 44 0 0 1 6 32 Z" fill="#3fa34d" />
      <path d="M12 32 L88 32 A38 38 0 0 1 12 32 Z" fill="#f3f8de" stroke="none" />
      <path d="M17 32 L83 32 A33 33 0 0 1 17 32 Z" fill="#ff5f6d" strokeWidth={2} />
      <path d="M14 46 L9 49 M22 60 L17 64 M36 70 L33 75 M50 72 L50 77 M64 70 L67 75 M78 60 L83 64 M86 46 L91 49" fill="none" stroke="#2a7a36" strokeWidth={2.5} />
      {(
        [
          [30, 42], [70, 42], [36, 56], [64, 56], [50, 64],
        ] as [number, number][]
      ).map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx={2} ry={3.2} fill={INK} stroke="none" />
      ))}
      <Face x={50} y={44} s={0.9} />
    </>
  ),
  'f-pear': () => (
    <>
      <path d="M50 24 Q50 15 46 9" fill="none" stroke={STEM} strokeWidth={4.5} />
      <path d="M50 17 Q60 5 73 11 Q63 22 50 17 Z" fill={LEAF} />
      <path d="M50 22 C40 22 36 32 36 42 C36 50 20 56 20 72 C20 86 34 92 50 92 C66 92 80 86 80 72 C80 56 64 50 64 42 C64 32 60 22 50 22 Z" fill="#d6e05a" />
      <Dots pts={[[44, 34], [56, 40], [30, 66], [70, 64], [40, 84], [62, 84]]} r={1.4} fill="#a8a23a" />
      <Face x={50} y={70} />
    </>
  ),
  'f-cherry': () => (
    <>
      <path d="M32 56 Q36 32 58 13 M68 51 Q66 32 58 13" fill="none" stroke="#6b8e23" strokeWidth={3.5} />
      <path d="M58 13 Q72 3 85 11 Q73 23 58 13 Z" fill={LEAF} />
      <circle cx={31} cy={70} r={18} fill="#e8304a" />
      <circle cx={69} cy={65} r={18} fill="#e8304a" />
      <ellipse cx={22} cy={63} rx={3} ry={5} transform="rotate(30 22 63)" fill="#fff" opacity={0.6} stroke="none" />
      <ellipse cx={60} cy={58} rx={3} ry={5} transform="rotate(30 60 58)" fill="#fff" opacity={0.6} stroke="none" />
      <Face x={32} y={71} s={0.7} />
      <Face x={70} y={66} s={0.7} />
    </>
  ),
  'f-pineapple': () => (
    <>
      <path d="M36 43 L25 20 L40 30 L42 7 L50 26 L58 7 L60 30 L75 20 L64 43 Z" fill="#4fae48" />
      <ellipse cx={50} cy={66} rx={25} ry={27} fill="#f8c540" />
      {(
        [
          [40, 46], [50, 45], [60, 46], [31, 56], [69, 56], [29, 66], [71, 66], [31, 76], [69, 76], [40, 85], [50, 86], [60, 85],
        ] as [number, number][]
      ).map(([x, y], i) => (
        <path key={i} d={`M${x - 3} ${y - 2} L${x} ${y + 1.5} L${x + 3} ${y - 2}`} fill="none" stroke="#c8901c" strokeWidth={2} />
      ))}
      <Face x={50} y={64} />
    </>
  ),
  'f-lemon': () => (
    <g transform="rotate(-18 50 52)">
      <path d="M54 26 Q62 12 76 14 Q68 27 54 26 Z" fill={LEAF} />
      <path
        d="M7 52 Q11 48 16 46 C21 30 38 24 50 24 C62 24 79 30 84 46 Q89 48 93 52 Q89 56 84 58 C79 74 62 80 50 80 C38 80 21 74 16 58 Q11 56 7 52 Z"
        fill="#fde262"
      />
      <path d="M26 42 Q30 34 38 31" fill="none" stroke="#fff" strokeWidth={3} opacity={0.8} />
      <Face x={50} y={52} />
    </g>
  ),
  'f-peach': () => (
    <>
      <path d="M50 22 Q34 5 19 15 Q33 29 50 22 Z" fill={LEAF} />
      <path d="M50 22 Q56 7 69 7 Q65 22 50 22 Z" fill="#82d35c" />
      <path d="M50 19 C44 28 15 28 15 57 C15 79 32 91 50 91 C68 91 85 79 85 57 C85 28 56 28 50 19 Z" fill="#ffb592" />
      <circle cx={66} cy={50} r={14} fill="#ff8f8f" opacity={0.4} stroke="none" />
      <path d="M50 22 C38 40 38 62 47 80" fill="none" stroke="#e57f6a" strokeWidth={2.5} />
      <Face x={62} y={60} s={0.9} />
    </>
  ),
  'f-carrot': () => (
    <>
      <Tube d="M50 32 Q41 18 32 11" color="#5cb84a" w={5} />
      <Tube d="M50 32 Q50 17 52 6" color="#5cb84a" w={5} />
      <Tube d="M50 32 Q60 19 71 14" color="#5cb84a" w={5} />
      <path d="M29 35 Q50 25 71 35 Q69 45 63 57 L52 89 Q50 93 48 89 L37 57 Q31 45 29 35 Z" fill="#ff8a2a" />
      <path d="M36 54 L43 54 M64 63 L57 63 M42 75 L48 75" fill="none" stroke="#d96a12" strokeWidth={2.5} />
      <Face x={50} y={41} s={0.8} />
    </>
  ),
  'f-corn': () => (
    <>
      <ellipse cx={50} cy={45} rx={18} ry={33} fill="#ffd23a" />
      {[18, 26, 34, 42, 50, 58, 66].map((y) => {
        const half = 18 * Math.sqrt(Math.max(0, 1 - ((y - 45) / 33) ** 2));
        const xs = half > 13 ? [-10, 0, 10] : half > 8 ? [-5, 5] : [0];
        return xs.map((dx) => <rect key={`${y}-${dx}`} x={50 + dx - 3.5} y={y - 3} width={7} height={6} rx={2.5} fill="#ffe680" stroke="#d9a21b" strokeWidth={1.4} />);
      })}
      <path d="M50 93 C29 89 21 64 27 39 C33 56 40 71 50 81 Z" fill={LEAF} />
      <path d="M50 93 C71 89 79 64 73 39 C67 56 60 71 50 81 Z" fill="#55a83e" />
    </>
  ),
  'f-eggplant': () => (
    <>
      <path d="M44 28 C34 34 26 50 28 66 C30 84 46 94 60 88 C74 82 74 66 66 54 C60 44 58 32 52 28 Z" fill="#7b3fa0" />
      <path d="M36 52 Q33 64 39 75" fill="none" stroke="#b58ad3" strokeWidth={3} />
      <path d="M48 26 Q48 15 55 9" fill="none" stroke="#4a8f3a" strokeWidth={5} />
      <path d="M35 33 Q48 20 61 30 L57 39 L50 33 L44 41 L40 33 Z" fill="#5cb84a" />
      <Face x={53} y={64} white s={0.95} />
    </>
  ),
  'f-mushroom': () => (
    <>
      <path d="M36 54 Q34 76 38 86 Q50 92 62 86 Q66 76 64 54 Z" fill="#f6ead2" />
      <path d="M9 56 C9 28 30 13 50 13 C70 13 91 28 91 56 C79 63 21 63 9 56 Z" fill="#e84b3c" />
      <circle cx={29} cy={34} r={6} fill="#fff" strokeWidth={2} />
      <circle cx={50} cy={24} r={5} fill="#fff" strokeWidth={2} />
      <circle cx={71} cy={34} r={6} fill="#fff" strokeWidth={2} />
      <circle cx={41} cy={47} r={4} fill="#fff" strokeWidth={2} />
      <circle cx={61} cy={47} r={4.5} fill="#fff" strokeWidth={2} />
      <Face x={50} y={71} s={0.75} />
    </>
  ),
  'f-broccoli': () => (
    <>
      <path d="M41 56 L39 89 Q50 93 61 89 L59 56 Z" fill="#a6d77d" />
      <path d="M45 66 L50 74 L55 66" fill="none" stroke="#7fb85a" strokeWidth={2.5} />
      <path d={scallop(50, 39, 27, 9, 0.6)} fill="#4fa83d" />
      <Dots pts={[[30, 26], [66, 22], [74, 44], [26, 48], [50, 18]]} r={3} fill="#3c8a2e" />
      <Face x={50} y={41} />
    </>
  ),
  'f-pepper': () => (
    <>
      <path d="M30 30 C46 26 56 36 60 50 C64 66 70 78 87 88 C62 93 42 78 36 62 C32 50 26 40 30 30 Z" fill="#e8392b" />
      <path d="M30 28 Q23 16 30 9" fill="none" stroke="#4a8f3a" strokeWidth={4.5} />
      <path d="M23 35 Q27 21 41 26 Q39 37 30 39 Z" fill="#5cb84a" />
      <path d="M38 40 Q43 50 44 58" fill="none" stroke="#ff8f80" strokeWidth={3} />
      <Face x={50} y={57} s={0.72} />
    </>
  ),
  'f-pumpkin': () => (
    <>
      <path d="M47 34 Q45 21 51 14 L58 16 Q54 23 55 34 Z" fill="#7a5a2a" />
      <path d="M57 21 Q70 6 84 14 Q75 27 57 21 Z" fill={LEAF} />
      <ellipse cx={30} cy={62} rx={20} ry={25} fill="#f39232" />
      <ellipse cx={70} cy={62} rx={20} ry={25} fill="#f39232" />
      <ellipse cx={50} cy={62} rx={18} ry={28} fill="#f7a23f" />
      <Face x={50} y={62} />
    </>
  ),
  'f-peas': () => (
    <g transform="rotate(-20 50 52)">
      <path d="M8 52 Q2 46 6 38" fill="none" stroke="#4a8f3a" strokeWidth={3.5} />
      <path d="M8 52 C20 32 70 28 93 42 C81 66 31 74 8 52 Z" fill="#5cb84a" />
      <path d="M16 52 C30 40 66 38 85 44 C73 60 34 64 16 52 Z" fill="#cdeea5" stroke="none" />
      {[30, 44, 58, 72].map((x, i) => {
        const y = 52 - i * 2.2;
        return (
          <g key={x}>
            <circle cx={x} cy={y} r={7.5} fill="#8fd45e" strokeWidth={2.2} />
            <circle cx={x - 2.4} cy={y - 0.8} r={1.2} fill={INK} stroke="none" />
            <circle cx={x + 2.4} cy={y - 0.8} r={1.2} fill={INK} stroke="none" />
            <path d={`M${x - 1.6} ${y + 2} Q${x} ${y + 3.6} ${x + 1.6} ${y + 2}`} fill="none" strokeWidth={1.2} />
          </g>
        );
      })}
    </g>
  ),
};

// ================================================================ 탈것
const VEHICLES: Record<string, () => ReactElement> = {
  'v-car': () => (
    <>
      <path d="M7 68 L7 54 Q7 46 17 46 L28 46 L38 30 Q41 26 47 26 L66 26 Q72 26 75 31 L84 46 Q93 47 93 56 L93 68 Z" fill="#ef5350" />
      <path d="M33 46 L41 32 L54 32 L54 46 Z" fill={GLASS} strokeWidth={2.5} />
      <path d="M60 32 L68 32 Q70 32 71 34 L77 46 L60 46 Z" fill={GLASS} strokeWidth={2.5} />
      <circle cx={89} cy={54} r={3} fill="#ffe066" strokeWidth={2} />
      <path d="M57 49 L57 64" fill="none" strokeWidth={2} />
      <Wheel x={27} y={70} r={11} />
      <Wheel x={73} y={70} r={11} />
      <Face x={40} y={53} s={0.68} />
    </>
  ),
  'v-bus': () => (
    <>
      <rect x={7} y={22} width={86} height={52} rx={9} fill="#ffc93c" />
      <rect x={13} y={30} width={13} height={14} rx={2} fill={GLASS} strokeWidth={2.5} />
      <rect x={30} y={30} width={13} height={14} rx={2} fill={GLASS} strokeWidth={2.5} />
      <rect x={47} y={30} width={13} height={14} rx={2} fill={GLASS} strokeWidth={2.5} />
      <path d="M64 30 L64 72 M74 30 L74 72 M64 30 L74 30 M69 30 L69 72" fill="none" strokeWidth={2.5} />
      <rect x={78} y={30} width={11} height={18} rx={2} fill={GLASS} strokeWidth={2.5} />
      <rect x={7} y={64} width={86} height={4} fill="#f29f05" stroke="none" />
      <circle cx={88} cy={58} r={2.8} fill="#fff6c2" strokeWidth={2} />
      <Wheel x={25} y={76} r={9} />
      <Wheel x={78} y={76} r={9} />
      <Face x={34} y={53} s={0.7} />
    </>
  ),
  'v-train': () => (
    <>
      <circle cx={74} cy={16} r={5} fill="#eef2f6" strokeWidth={2} />
      <circle cx={84} cy={9} r={4} fill="#eef2f6" strokeWidth={2} />
      <circle cx={64} cy={11} r={3.5} fill="#eef2f6" strokeWidth={2} />
      <path d="M67 44 L67 29 L63 24 L83 24 L79 29 L79 44 Z" fill="#e05a4f" />
      <rect x={10} y={27} width={30} height={46} rx={3} fill="#3f86d8" />
      <rect x={6} y={20} width={38} height={8} rx={3} fill="#e05a4f" />
      <rect x={17} y={34} width={16} height={14} rx={2} fill={GLASS} strokeWidth={2.5} />
      <path d="M40 42 L84 42 Q91 42 91 50 L91 64 Q91 72 84 72 L40 72 Z" fill="#4a9be8" />
      <path d="M86 42 L86 72" fill="none" strokeWidth={2} />
      <path d="M91 66 L97 79 L84 79 Z" fill="#e05a4f" />
      <rect x={7} y={71} width={82} height={6} rx={2} fill="#5a5a6a" />
      <Wheel x={24} y={80} r={10} />
      <Wheel x={50} y={82} r={8} />
      <Wheel x={72} y={82} r={8} />
      <Face x={62} y={55} s={0.75} />
    </>
  ),
  'v-plane': () => (
    <g transform="rotate(-12 50 52)">
      <path d="M45 46 L61 24 L69 24 L61 46 Z" fill="#9fd0ff" />
      <path d="M12 50 L10 25 L20 25 L33 45 Z" fill="#4aa3ff" />
      <path d="M9 48 Q9 42 17 42 L78 42 Q92 44 95 52 Q92 61 78 62 L17 62 Q9 62 9 56 Z" fill="#f4f8fc" />
      <path d="M12 57 L90 57" fill="none" stroke="#4aa3ff" strokeWidth={3} />
      {[34, 43, 52, 61].map((x) => (
        <circle key={x} cx={x} cy={50} r={2.7} fill={GLASS} strokeWidth={1.8} />
      ))}
      <path d="M80 46 Q89 47 92 52 L80 52 Z" fill={GLASS} strokeWidth={2} />
      <path d="M41 58 L61 86 L72 86 L62 58 Z" fill="#4aa3ff" />
    </g>
  ),
  'v-sailboat': () => (
    <>
      <path d="M2 86 Q12 80 22 86 T42 86 T62 86 T82 86 T102 86" fill="none" stroke="#4fb3e8" strokeWidth={3.5} />
      <path d="M50 11 L50 66" fill="none" strokeWidth={3.5} />
      <path d="M50 11 L63 15 L50 20 Z" fill="#ef5350" strokeWidth={2} />
      <path d="M46 19 L46 61 L15 61 Q30 43 46 19 Z" fill="#fff" />
      <path d="M54 25 L54 61 L81 61 Q71 45 54 25 Z" fill="#ffe08a" />
      <path d="M9 65 L91 65 Q87 80 74 82 L26 82 Q13 80 9 65 Z" fill="#e2683c" />
      <Face x={50} y={71} s={0.7} />
    </>
  ),
  'v-bicycle': () => (
    <>
      {[24, 76].map((x) => (
        <g key={x}>
          <circle cx={x} cy={64} r={17} fill="none" strokeWidth={4.5} />
          <path d={`M${x - 13} ${64} L${x + 13} 64 M${x} 51 L${x} 77 M${x - 9} 55 L${x + 9} 73 M${x + 9} 55 L${x - 9} 73`} fill="none" stroke="#a7adba" strokeWidth={1.5} />
          <circle cx={x} cy={64} r={2.6} fill={INK} stroke="none" />
        </g>
      ))}
      <Tube d="M24 64 L42 38 L50 64 Z M42 38 L70 38 L50 64 M70 36 L76 64" color="#2fb36b" w={4.5} />
      <path d="M42 38 L41 33" fill="none" strokeWidth={3} />
      <path d="M33 31 L49 31 Q49 36 42 36 Q35 36 33 31 Z" fill="#5a4a42" strokeWidth={2.5} />
      <path d="M70 37 L67 26 M61 25 Q68 22 77 27" fill="none" strokeWidth={4} />
      <circle cx={50} cy={64} r={4.5} fill="#d9dce4" strokeWidth={2} />
    </>
  ),
  'v-helicopter': () => (
    <>
      <rect x={42} y={26} width={6} height={11} fill="#5a5a6a" />
      <rect x={10} y={21} width={72} height={5} rx={2.5} fill="#5a5a6a" />
      <path d="M62 50 L90 44 L90 52 L64 62 Z" fill="#ffb02e" />
      <circle cx={90} cy={47} r={7} fill="none" stroke="#5a5a6a" strokeWidth={2.5} />
      <path d="M90 40 L90 54 M83 47 L97 47" fill="none" strokeWidth={2.5} />
      <path d="M22 80 Q22 83 27 83 L69 83 M35 74 L33 83 M58 74 L60 83" fill="none" strokeWidth={3.5} />
      <ellipse cx={44} cy={57} rx={27} ry={20} fill="#ffb02e" />
      <path d="M20 53 Q22 39 39 37 L39 55 Z" fill={GLASS} strokeWidth={2.5} />
      <Face x={54} y={58} s={0.8} />
    </>
  ),
  'v-rocket': () => (
    <>
      <path d="M40 72 Q37 85 50 97 Q63 85 60 72 Z" fill="#ffb02e" />
      <path d="M44 72 Q44 82 50 89 Q56 82 56 72 Z" fill="#ffe066" stroke="none" />
      <path d="M35 54 L19 75 L36 72 Z" fill="#ef5350" />
      <path d="M65 54 L81 75 L64 72 Z" fill="#ef5350" />
      <path d="M50 5 C66 17 70 40 66 72 L34 72 C30 40 34 17 50 5 Z" fill="#f4f6fb" />
      <path d="M50 5 C57 10 61 16 63 22 L37 22 C39 16 43 10 50 5 Z" fill="#ef5350" />
      <circle cx={50} cy={43} r={12} fill={GLASS} strokeWidth={3} />
      <Face x={50} y={42} s={0.58} />
      <path d="M34 64 L66 64" fill="none" strokeWidth={2.5} />
    </>
  ),
  'v-truck': () => (
    <>
      <rect x={9} y={61} width={82} height={8} rx={2} fill="#5a5a6a" />
      <path d="M40 62 L50 44" fill="none" stroke="#8a8a98" strokeWidth={4} />
      <g transform="rotate(-16 13 61)">
        <path d="M9 36 Q30 18 56 36 Z" fill="#c9965e" />
        <path d="M6 36 L62 36 L58 61 L12 61 Z" fill="#ffb02e" />
        <path d="M20 42 L20 56 M34 42 L34 56 M48 42 L48 56" fill="none" stroke="#e0901a" strokeWidth={2.5} />
      </g>
      <circle cx={6} cy={60} r={3.5} fill="#c9965e" strokeWidth={2} />
      <circle cx={12} cy={68} r={2.5} fill="#c9965e" strokeWidth={2} />
      <path d="M63 62 L63 31 Q63 27 67 27 L80 27 Q84 27 86 31 L93 46 L93 62 Z" fill="#3d7dd8" />
      <path d="M69 33 L80 33 L86 46 L69 46 Z" fill={GLASS} strokeWidth={2.5} />
      <Wheel x={24} y={72} r={10} />
      <Wheel x={47} y={72} r={10} />
      <Wheel x={79} y={72} r={10} />
      <Face x={78} y={53} s={0.55} />
    </>
  ),
  'v-firetruck': () => (
    <>
      <rect x={67} y={17} width={11} height={9} rx={3} fill="#4aa3ff" />
      <path d="M7 70 L7 40 L61 40 L61 30 Q61 26 65 26 L80 26 Q84 26 86 30 L93 44 L93 70 Z" fill="#e53935" />
      <path d="M13 37 L13 40 M55 37 L55 40" fill="none" strokeWidth={2.5} />
      <rect x={9} y={30} width={50} height={7} rx={1.5} fill="#e7e9ee" />
      <path d="M17 30 L17 37 M25 30 L25 37 M33 30 L33 37 M41 30 L41 37 M49 30 L49 37" fill="none" strokeWidth={2} />
      <path d="M67 32 L80 32 L86 44 L67 44 Z" fill={GLASS} strokeWidth={2.5} />
      <rect x={12} y={45} width={18} height={12} rx={2} fill="#ff7a6e" strokeWidth={2} />
      <circle cx={45} cy={51} r={6.5} fill="#ffd54f" strokeWidth={2} />
      <circle cx={45} cy={51} r={2} fill={INK} stroke="none" />
      <rect x={7} y={60} width={86} height={4} fill="#fff" stroke="none" />
      <Wheel x={25} y={72} r={10} />
      <Wheel x={76} y={72} r={10} />
      <Face x={77} y={51} s={0.55} />
    </>
  ),
  'v-scooter': () => (
    <>
      <path d="M78 22 L74 11" fill="none" strokeWidth={2.5} />
      <circle cx={73} cy={9} r={3} fill={GLASS} strokeWidth={2} />
      <Wheel x={24} y={73} r={11} />
      <Wheel x={78} y={73} r={11} />
      <path d="M9 67 Q7 46 30 44 L48 44 L53 67 Z" fill="#39c2b4" />
      <path d="M15 44 Q15 35 26 35 L46 35 Q50 35 50 39 L50 44 Z" fill="#5a4a42" />
      <rect x={47} y={61} width={26} height={6} rx={2} fill="#39c2b4" />
      <path d="M66 67 L75 24 L84 26 L79 67 Z" fill="#39c2b4" />
      <path d="M69 22 L91 20" fill="none" strokeWidth={4.5} />
      <circle cx={84} cy={35} r={4.5} fill="#ffe066" strokeWidth={2} />
      <Face x={30} y={54} s={0.65} />
    </>
  ),
  'v-balloon': () => (
    <>
      <path d="M40 67 L42 80 M60 67 L58 80" fill="none" strokeWidth={2.5} />
      <path d="M38 78 L62 78 L59 94 L41 94 Z" fill="#c68a4f" />
      <path d="M40 85 L60 85" fill="none" stroke="#9a6532" strokeWidth={2} />
      <path d="M50 5 C74 5 89 21 87 40 C85 56 66 64 60 70 L40 70 C34 64 15 56 13 40 C11 21 26 5 50 5 Z" fill="#ef5350" />
      <path d="M50 5 C38 15 34 48 42 70 L58 70 C66 48 62 15 50 5 Z" fill="#ffd54f" />
      <path d="M30 11 C20 24 21 48 33 63 M70 11 C80 24 79 48 67 63" fill="none" strokeWidth={2.2} />
      <Face x={50} y={36} s={0.85} />
    </>
  ),
  'v-submarine': () => (
    <>
      <circle cx={90} cy={30} r={3} fill="#d6f1ff" strokeWidth={1.6} />
      <circle cx={94} cy={21} r={2} fill="#d6f1ff" strokeWidth={1.6} />
      <circle cx={85} cy={19} r={2.5} fill="#d6f1ff" strokeWidth={1.6} />
      <path d="M59 30 L59 14 L70 14" fill="none" strokeWidth={4} />
      <path d="M39 42 L43 26 L64 26 L67 42 Z" fill="#ffd23f" />
      <path d="M12 57 L3 45 L7 57 L3 69 Z" fill="#b0b8c4" />
      <rect x={9} y={40} width={82} height={34} rx={17} fill="#ffd23f" />
      <circle cx={29} cy={57} r={6.5} fill={GLASS} strokeWidth={2.5} />
      <circle cx={47} cy={57} r={6.5} fill={GLASS} strokeWidth={2.5} />
      <Face x={72} y={55} s={0.7} />
    </>
  ),
  'v-excavator': () => (
    <>
      <rect x={7} y={70} width={58} height={18} rx={9} fill="#4a4a58" />
      <circle cx={17} cy={79} r={5} fill="#8a8a98" strokeWidth={2} />
      <circle cx={36} cy={79} r={5} fill="#8a8a98" strokeWidth={2} />
      <circle cx={55} cy={79} r={5} fill="#8a8a98" strokeWidth={2} />
      <Tube d="M50 54 L69 25 L86 50" color="#ffc23a" w={7} />
      <path d="M80 49 L95 49 L93 62 Q86 69 78 60 Z" fill="#7a7a88" />
      <path d="M84 64 L83 68 M89 63 L89 67" fill="none" strokeWidth={2.5} />
      <rect x={11} y={47} width={48} height={23} rx={4} fill="#ffc23a" />
      <path d="M15 47 L15 25 Q15 21 19 21 L36 21 Q40 21 40 25 L40 47 Z" fill="#ffc23a" />
      <rect x={20} y={26} width={15} height={14} rx={2} fill={GLASS} strokeWidth={2.5} />
      <Face x={36} y={57} s={0.65} />
    </>
  ),
  'v-tractor': () => (
    <>
      <rect x={66} y={27} width={5} height={21} fill="#5a5a6a" strokeWidth={2.5} />
      <path d="M19 52 L22 20 M50 20 L52 52" fill="none" strokeWidth={4} />
      <rect x={15} y={15} width={41} height={7} rx={2} fill="#e53935" />
      <path d="M25 26 L47 26 L48 46 L24 46 Z" fill={GLASS} strokeWidth={2.5} />
      <path d="M13 70 L13 48 L54 48 L54 46 L86 46 Q90 46 90 50 L90 68 L13 70 Z" fill="#4caf50" />
      <path d="M76 50 L76 64 M82 50 L82 64" fill="none" stroke="#2f8a34" strokeWidth={2.5} />
      <circle cx={32} cy={70} r={21} fill="#3d3b4a" />
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return <circle key={i} cx={32 + 21 * Math.cos(a)} cy={70 + 21 * Math.sin(a)} r={2.6} fill="#3d3b4a" stroke="none" />;
      })}
      <circle cx={32} cy={70} r={9} fill="#ffd54f" strokeWidth={2.5} />
      <Wheel x={78} y={77} r={11} />
      <Face x={64} y={56} s={0.62} />
    </>
  ),
  'v-ambulance': () => (
    <>
      <rect x={27} y={18} width={16} height={9} rx={3} fill="#4aa3ff" />
      <rect x={35} y={18} width={8} height={9} rx={0} fill="#ff6b6b" stroke="none" />
      <path d="M7 70 L7 32 Q7 26 13 26 L62 26 Q66 26 68 30 L76 44 L87 46 Q93 48 93 56 L93 70 Z" fill="#fafafa" />
      <path d="M64 32 L70 32 L76 44 L64 44 Z" fill={GLASS} strokeWidth={2.5} />
      <path d="M29 34 L37 34 L37 42 L45 42 L45 50 L37 50 L37 58 L29 58 L29 50 L21 50 L21 42 L29 42 Z" fill="#e53935" strokeWidth={2} />
      <rect x={7} y={61} width={86} height={4} fill="#e53935" stroke="none" />
      <circle cx={89} cy={54} r={2.8} fill="#ffe066" strokeWidth={2} />
      <Wheel x={25} y={72} r={10} />
      <Wheel x={75} y={72} r={10} />
      <Face x={71} y={53} s={0.55} />
    </>
  ),
  'v-kickboard': () => (
    <>
      <Tube d="M73 76 L80 21" color="#a5adbd" w={4} />
      <Tube d="M67 20 L93 22" color="#ff6fa8" w={4.5} />
      <path d="M12 72 Q7 75 9 82" fill="none" strokeWidth={3} />
      <rect x={11} y={69} width={68} height={10} rx={5} fill="#ff6fa8" />
      <path d="M33 74 l2 -3 l2 3 l3 0.4 l-2.3 2 l0.7 3 l-3.4 -1.7 l-3.4 1.7 l0.7 -3 l-2.3 -2 Z" fill="#ffe066" strokeWidth={1.2} />
      <circle cx={20} cy={85} r={7.5} fill="#3d3b4a" />
      <circle cx={75} cy={85} r={7.5} fill="#3d3b4a" />
      <circle cx={20} cy={85} r={2.5} fill="#d9dce4" stroke="none" />
      <circle cx={75} cy={85} r={2.5} fill="#d9dce4" stroke="none" />
    </>
  ),
  'v-cablecar': () => (
    <>
      <path d="M1 23 L99 8" fill="none" strokeWidth={2.5} />
      <path d="M50 16 L50 33" fill="none" strokeWidth={3.5} />
      <circle cx={50} cy={15.5} r={4} fill="#a5adbd" strokeWidth={2} />
      <path d="M28 37 Q50 26 72 37 Z" fill="#c62828" />
      <rect x={21} y={35} width={58} height={52} rx={8} fill="#ef5350" />
      <rect x={27} y={43} width={20} height={18} rx={3} fill={GLASS} strokeWidth={2.5} />
      <rect x={53} y={43} width={20} height={18} rx={3} fill={GLASS} strokeWidth={2.5} />
      <Face x={50} y={72} s={0.8} />
    </>
  ),
};

const PICTURES: Record<string, () => ReactElement> = { ...ANIMALS, ...FOOD, ...VEHICLES };

/** 그림이 있는 id 목록 (테스트·도감용) */
export const DRAWN_PICTURES = Object.keys(PICTURES);

/** 그림 하나 (100×100 SVG) */
export function Picture({ pic, className }: { pic: string; className?: string }) {
  const draw = PICTURES[pic];
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <g stroke={INK} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
        {draw ? draw() : <text x={50} y={60} textAnchor="middle" fontSize={40} fill={INK} stroke="none">?</text>}
      </g>
    </svg>
  );
}

/** 카드 앞면: 연한 동그라미 위 그림 + 아래 이름 */
export function CardFace({ pic, showName = true }: { pic: string; showName?: boolean }) {
  const info = pictureInfo(pic);
  return (
    <span className={`mm-face${showName ? '' : ' mm-face-noname'}`} style={{ '--mm-tint': info?.theme.tint ?? '#eee' } as React.CSSProperties}>
      <span className="mm-face-pic">
        <Picture pic={pic} />
      </span>
      {showName && <span className="mm-face-name">{info?.name ?? '?'}</span>}
    </span>
  );
}

/** 카드 뒷면: 무늬 바탕 + 가운데 물음표 메달 */
export function CardBack() {
  return (
    <span className="mm-back">
      <svg viewBox="0 0 60 60" className="mm-back-emblem" aria-hidden="true" focusable="false">
        <circle cx={30} cy={30} r={25} fill="#fff" />
        <circle cx={30} cy={30} r={20.5} fill="none" stroke="var(--mm-back-a)" strokeWidth={2} strokeDasharray="3 3.4" />
        <path d="M22.5 23.5 Q22.5 15 30.5 15 Q38.5 15 38.5 22.5 Q38.5 27.5 32.5 30 Q30.5 31 30.5 34.5" fill="none" stroke="var(--mm-back-b)" strokeWidth={5.5} strokeLinecap="round" />
        <circle cx={30.5} cy={43} r={3.6} fill="var(--mm-back-b)" />
        <path d="M49 8 l1.6 3.4 l3.4 1.6 l-3.4 1.6 l-1.6 3.4 l-1.6 -3.4 l-3.4 -1.6 l3.4 -1.6 Z" fill="#ffe066" />
        <path d="M10 44 l1.2 2.6 l2.6 1.2 l-2.6 1.2 l-1.2 2.6 l-1.2 -2.6 l-2.6 -1.2 l2.6 -1.2 Z" fill="#ffe066" />
      </svg>
    </span>
  );
}
