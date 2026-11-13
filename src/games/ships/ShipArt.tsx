import type { PlacedShip, ShipKind } from './types';
import { shipLength } from './fleet';

/*
 * 배 그림 (직접 그린 위에서 내려다본 모습).
 * 한 칸 = 10 단위. 가로로 누운 배를 그리고 뱃머리는 오른쪽이다.
 * 색은 CSS 변수(--sh-hull 등)로 정해서 다크 모드와 가라앉은 모습을 CSS에서 바꾼다.
 */

export const CELL = 10;

function Gun({ x, dir = 1, r = 1.5, len = 2.4 }: { x: number; dir?: 1 | -1; r?: number; len?: number }) {
  return (
    <g className="sh-hull-gun">
      <line x1={x + dir * (r - 0.2)} y1={4.55} x2={x + dir * (r + len)} y2={4.55} />
      <line x1={x + dir * (r - 0.2)} y1={5.45} x2={x + dir * (r + len)} y2={5.45} />
      <circle cx={x} cy={5} r={r} />
    </g>
  );
}

function Plane({ x, y }: { x: number; y: number }) {
  return (
    <path
      className="sh-hull-plane"
      transform={`translate(${x} ${y})`}
      d="M2.4 0 L1.2 0.45 L0.5 2 L-0.2 2 L0 0.45 L-1.6 0.4 L-2 1.1 L-2.4 1.1 L-2.2 0 L-2.4 -1.1 L-2 -1.1 L-1.6 -0.4 L0 -0.45 L-0.2 -2 L0.5 -2 L1.2 -0.45 Z"
    />
  );
}

const BODY: Record<ShipKind, string> = {
  carrier: 'M2.2 1.4 H43 L48.8 5 L43 8.6 H2.2 Q1 8.6 1 7.4 V2.6 Q1 1.4 2.2 1.4 Z',
  battleship: 'M3 2 H32 Q37.5 2.6 39 5 Q37.5 7.4 32 8 H3 Q1.2 8 1.2 5 Q1.2 2 3 2 Z',
  cruiser: 'M2.6 2.5 H23.5 Q28.2 3.1 29.2 5 Q28.2 6.9 23.5 7.5 H2.6 Q1.2 7.5 1.2 5 Q1.2 2.5 2.6 2.5 Z',
  submarine: 'M5 3.2 H24.5 Q29.2 3.4 29.2 5 Q29.2 6.6 24.5 6.8 H5 Q1.3 6.6 1.3 5 Q1.3 3.4 5 3.2 Z',
  destroyer: 'M2.2 3 H14.2 Q18.4 3.5 19.3 5 Q18.4 6.5 14.2 7 H2.2 Q1 7 1 5 Q1 3 2.2 3 Z',
};

function Details({ id }: { id: ShipKind }) {
  switch (id) {
    case 'carrier':
      return (
        <>
          <path className="sh-hull-line sh-hull-dash" d="M4 5 H40" />
          <path className="sh-hull-line" d="M8 7.4 L26 2.6" />
          <Plane x={14} y={4} />
          <Plane x={22} y={6.1} />
          <rect className="sh-hull-dark" x={30} y={6.3} width={8} height={1.9} rx={0.5} />
          <circle className="sh-hull-deck" cx={34} cy={7.25} r={0.55} />
        </>
      );
    case 'battleship':
      return (
        <>
          <path className="sh-hull-line" d="M4 5 H36" />
          <Gun x={8} dir={-1} r={1.7} />
          <circle className="sh-hull-dark" cx={13} cy={5} r={1.25} />
          <rect className="sh-hull-deck" x={15} y={3.3} width={8.5} height={3.4} rx={0.9} />
          <rect className="sh-hull-dark" x={19.2} y={3.9} width={3} height={2.2} rx={0.4} />
          <Gun x={26.6} r={1.6} len={1.8} />
          <Gun x={31.6} r={1.6} len={2.6} />
        </>
      );
    case 'cruiser':
      return (
        <>
          <Gun x={6.2} dir={-1} r={1.4} len={2.2} />
          <rect className="sh-hull-deck" x={10} y={3.5} width={7} height={3} rx={0.8} />
          <rect className="sh-hull-dark" x={14} y={4} width={2.2} height={2} rx={0.4} />
          <circle className="sh-hull-dark" cx={19.2} cy={5} r={1} />
          <Gun x={23.2} r={1.4} len={2.4} />
        </>
      );
    case 'submarine':
      return (
        <>
          <path className="sh-hull-line" d="M2.6 3.6 L3.8 5 L2.6 6.4" />
          <circle className="sh-hull-deck" cx={9} cy={5} r={0.5} />
          <circle className="sh-hull-deck" cx={24} cy={5} r={0.5} />
          <rect className="sh-hull-dark" x={14.6} y={4.05} width={5.6} height={1.9} rx={0.95} />
          <path className="sh-hull-line" d="M16.4 3.3 V6.7" />
        </>
      );
    case 'destroyer':
      return (
        <>
          <circle className="sh-hull-dark" cx={6.6} cy={5} r={0.95} />
          <rect className="sh-hull-deck" x={8.4} y={3.8} width={4} height={2.4} rx={0.6} />
          <rect className="sh-hull-dark" x={10.4} y={4.2} width={1.5} height={1.6} rx={0.3} />
          <Gun x={14.6} r={1.15} len={2} />
        </>
      );
  }
}

/** 가로로 누운 배 한 척 (0,0)~(길이×10, 10) */
export function ShipHull({ id, className = '' }: { id: ShipKind; className?: string }) {
  return (
    <g className={`sh-ship sh-ship-${id} ${className}`}>
      <path className="sh-hull-body" d={BODY[id]} />
      <Details id={id} />
    </g>
  );
}

/** 판 위에 배를 놓는 transform. (ox, oy)는 판 왼쪽 위 칸의 SVG 좌표 */
export function shipTransform(ship: PlacedShip, ox: number, oy: number): string {
  const x = ox + ship.x * CELL;
  const y = oy + ship.y * CELL;
  return ship.dir === 'h' ? `translate(${x} ${y})` : `translate(${x + CELL} ${y}) rotate(90)`;
}

/** 배 하나만 그린 작은 그림 (자리 표시, 배 고르기 칸, 함대 현황) */
export function ShipIcon({ id, cell = 14, vertical = false, className = '' }: { id: ShipKind; cell?: number; vertical?: boolean; className?: string }) {
  const len = shipLength(id);
  const w = len * CELL;
  return (
    <svg
      className={`sh-ship-icon ${className}`}
      viewBox={vertical ? `0 0 ${CELL} ${w}` : `0 0 ${w} ${CELL}`}
      width={vertical ? cell : len * cell}
      height={vertical ? len * cell : cell}
      aria-hidden="true"
    >
      <g transform={vertical ? `translate(${CELL} 0) rotate(90)` : undefined}>
        <ShipHull id={id} />
      </g>
    </svg>
  );
}

/** 편 표시용 작은 배 (자리 선택 머리띠) */
export function SideIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 13 H21 L18.5 18 H5.5 Z" fill="#fff" />
      <rect x={8} y={8.5} width={7} height={3.5} rx={0.8} fill="#fff" />
      <rect x={11} y={5} width={1.6} height={3.5} fill="#fff" />
      <path d="M2 20.5 Q5 19 8 20.5 T14 20.5 T20 20.5 T23 20" stroke="#fff" strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </svg>
  );
}
