import { useId, type CSSProperties, type MouseEvent, type PointerEvent, type Ref } from 'react';
import { COLUMN_LETTERS, shipCells } from './fleet';
import { CELL, ShipHull, shipTransform } from './ShipArt';
import { HIT, MISS, type Mark, type PlacedShip, type ShipKind, type ShotResult } from './types';

/** 판 왼쪽·위의 좌표 글자 자리 */
export const MARGIN = 7;

/** 방금 쏜 한 발의 연출 정보 */
export interface ShotFx {
  id: number;
  cell: number;
  result: ShotResult;
  /** 격침이면 그 배의 칸들 */
  cells: number[];
  ship: ShipKind | null;
  /** 포탄이 날아가는 시간(ms), 떨어진 뒤 연출 시간(ms) */
  fly: number;
  impact: number;
}

export interface BoardProps {
  size: number;
  ariaLabel: string;
  /** 다 보이게 그릴 배 (내 함대, 끝난 뒤 공개) */
  ships?: readonly PlacedShip[];
  /** ships 가운데 가라앉은 배 */
  sunkIds?: ReadonlySet<ShipKind>;
  /** 상대 바다에서 가라앉아 공개된 배 (윤곽) */
  wrecks?: readonly PlacedShip[];
  /** 흐리게 보여 줄 배 (모두 공개 모드) */
  ghosts?: readonly PlacedShip[];
  /** 이 바다에 떨어진 포탄 결과 */
  marks: readonly Mark[];
  /** 가장 최근에 떨어진 칸 (고리 표시) */
  lastCell?: number | null;
  fx?: ShotFx | null;
  /** 조준(aim) 또는 배 놓기(place) 칸 */
  cursor?: number | null;
  cursorKind?: 'aim' | 'place';
  /** 놓으려는 배 미리 보기 */
  preview?: { ship: PlacedShip; ok: boolean } | null;
  /** 배를 놓을 수 없는 칸 (붙이지 않기 규칙) */
  zone?: ReadonlySet<number> | null;
  interactive?: boolean;
  className?: string;
  svgRef?: Ref<SVGSVGElement>;
  onCellDown?: (cell: number, e: PointerEvent<SVGRectElement>) => void;
  onHover?: (cell: number | null) => void;
  onCellContext?: (cell: number, e: MouseEvent<SVGRectElement>) => void;
}

/** 화면 좌표 → 칸 번호 (판 밖이면 null) */
export function cellFromPoint(svg: SVGSVGElement | null, clientX: number, clientY: number, size: number): number | null {
  if (!svg) return null;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  const x = Math.floor((pt.x - MARGIN) / CELL);
  const y = Math.floor((pt.y - MARGIN) / CELL);
  if (x < 0 || y < 0 || x >= size || y >= size) return null;
  return y * size + x;
}

function center(cell: number, size: number): [number, number] {
  return [MARGIN + (cell % size) * CELL + CELL / 2, MARGIN + Math.floor(cell / size) * CELL + CELL / 2];
}

/** 물보라 자국: 하얀 점과 둥근 테 (모양으로도 구별) */
function MissMark({ x, y, fresh, style }: { x: number; y: number; fresh?: boolean; style?: CSSProperties }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={`sh-miss${fresh ? ' sh-mark-new' : ''}`} style={style}>
        <circle className="sh-miss-ring" r={3.1} />
        <circle className="sh-miss-dot" r={1.6} />
      </g>
    </g>
  );
}

const FLAME =
  'M0 -4.6 C1.2 -2.8 3.6 -2.2 3.4 0.6 C3.3 2.8 1.8 4 0 4 C-1.8 4 -3.3 2.8 -3.4 0.6 C-3.5 -1.2 -2 -1.6 -1.6 -3 C-1 -2 -0.6 -1.8 -0.4 -1.6 C-0.3 -2.8 -0.6 -3.6 0 -4.6 Z';

/** 명중 자국: 불꽃 + 붉은 X */
function HitMark({ x, y, fresh, style }: { x: number; y: number; fresh?: boolean; style?: CSSProperties }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={`sh-hit${fresh ? ' sh-mark-new' : ''}`} style={style}>
        <path className="sh-hit-flame" d={FLAME} />
        <path className="sh-hit-core" d="M0 -1.2 C0.9 -0.2 1.6 0.4 1.5 1.5 C1.4 2.4 0.7 2.8 0 2.8 C-0.7 2.8 -1.4 2.4 -1.5 1.5 C-1.6 0.4 -0.6 -0.1 0 -1.2 Z" />
        <path className="sh-hit-x" d="M-3.3 -3.3 L3.3 3.3 M3.3 -3.3 L-3.3 3.3" />
      </g>
    </g>
  );
}

/** 가라앉은 배 칸: 그을린 X */
function SunkMark({ x, y }: { x: number; y: number }) {
  return (
    <g className="sh-sunk-mark" transform={`translate(${x} ${y})`}>
      <circle r={2.6} />
      <path d="M-2.6 -2.6 L2.6 2.6 M2.6 -2.6 L-2.6 2.6" />
    </g>
  );
}

const DROPS: [number, number][] = [
  [-6, -5],
  [6, -6],
  [-7, 2],
  [7, 3],
  [0, -8],
  [-2, 7],
];
const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315];

/** 포탄이 떨어지는 연출 (물보라 고리 / 폭발) */
function ShotEffect({ fx, size }: { fx: ShotFx; size: number }) {
  const [x, y] = center(fx.cell, size);
  const style = { '--fly': `${fx.fly}ms`, '--impact': `${fx.impact}ms` } as CSSProperties;
  return (
    <g className="sh-fx" style={style} key={fx.id} aria-hidden="true">
      {fx.fly > 0 && (
        <g transform={`translate(${x} ${y})`}>
          <ellipse className="sh-shell-shadow" rx={2.4} ry={1.2} cy={1.5} />
          <circle className="sh-shell" r={1.5} />
        </g>
      )}
      {fx.result === 'miss' ? (
        <g transform={`translate(${x} ${y})`}>
          {[0, 1, 2].map((i) => (
            <circle key={i} className="sh-ripple" r={5} style={{ animationDelay: `calc(var(--fly) + ${i * 110}ms)` }} />
          ))}
          {DROPS.map(([dx, dy], i) => (
            <circle key={i} className="sh-drop" r={0.8} style={{ '--dx': `${dx}px`, '--dy': `${dy}px` } as CSSProperties} />
          ))}
        </g>
      ) : (
        <g transform={`translate(${x} ${y})`}>
          <circle className="sh-smoke" r={6} />
          <polygon
            className="sh-boom"
            points={Array.from({ length: 16 }, (_, i) => {
              const a = (i * Math.PI) / 8;
              const r = i % 2 === 0 ? 9 : 4.2;
              return `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`;
            }).join(' ')}
          />
          <circle className="sh-boom-core" r={3.2} />
          {SPARKS.map((deg) => (
            <line key={deg} className="sh-spark" x1={0} y1={0} x2={0} y2={-3} style={{ '--rot': `${deg}deg` } as CSSProperties} />
          ))}
        </g>
      )}
    </g>
  );
}

/** 바다 한 판 (SVG). 좌표 글자, 물결, 배, 포탄 자국, 조준점, 연출을 그린다. */
export function Board(props: BoardProps) {
  const { size, marks, fx, cursor, preview, zone } = props;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const span = size * CELL;
  const total = MARGIN + span + 1;
  const sunkIds = props.sunkIds ?? new Set<ShipKind>();
  const fxSunk = fx?.result === 'sunk' ? fx.ship : null;
  const cx = cursor != null ? cursor % size : -1;
  const cy = cursor != null ? Math.floor(cursor / size) : -1;
  // 가라앉은 배 칸 (그을린 X로 그린다)
  const sunkCells = new Set<number>();
  for (const s of props.ships ?? []) if (sunkIds.has(s.id)) shipCells(s, size).forEach((c) => sunkCells.add(c));
  for (const s of props.wrecks ?? []) shipCells(s, size).forEach((c) => sunkCells.add(c));

  const cellFromEvent = (e: { clientX: number; clientY: number; currentTarget: SVGElement }) =>
    cellFromPoint(e.currentTarget.ownerSVGElement, e.clientX, e.clientY, size);

  const delayStyle = (cell: number): CSSProperties | undefined =>
    fx && (fx.cell === cell || (fx.result === 'sunk' && fx.cells.includes(cell))) ? ({ '--fly': `${fx.fly}ms` } as CSSProperties) : undefined;

  return (
    <svg
      ref={props.svgRef}
      className={`sh-board-svg${props.interactive ? ' sh-interactive' : ''} ${props.className ?? ''}`}
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label={props.ariaLabel}
    >
      <defs>
        <linearGradient id={`${uid}-sea`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="sh-sea-stop1" />
          <stop offset="1" className="sh-sea-stop2" />
        </linearGradient>
        <pattern id={`${uid}-waves`} width={20} height={10} patternUnits="userSpaceOnUse">
          <path className="sh-wave" d="M0 4 Q2.5 2 5 4 T10 4 M10 9 Q12.5 7 15 9 T20 9" />
        </pattern>
        <pattern id={`${uid}-hatch`} width={3} height={3} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line className="sh-hatch-line" x1={0} y1={0} x2={0} y2={3} />
        </pattern>
      </defs>

      {/* 바다 */}
      <rect className="sh-sea" x={MARGIN} y={MARGIN} width={span} height={span} rx={1.5} fill={`url(#${uid}-sea)`} />
      <rect className="sh-sea-waves" x={MARGIN} y={MARGIN} width={span} height={span} fill={`url(#${uid}-waves)`} />

      {/* 놓을 수 없는 칸 */}
      {zone &&
        [...zone].map((c) => (
          <rect key={c} x={MARGIN + (c % size) * CELL} y={MARGIN + Math.floor(c / size) * CELL} width={CELL} height={CELL} fill={`url(#${uid}-hatch)`} className="sh-zone" />
        ))}

      {/* 줄 */}
      <path
        className="sh-grid"
        d={Array.from({ length: size + 1 }, (_, i) => `M${MARGIN + i * CELL} ${MARGIN} V${MARGIN + span} M${MARGIN} ${MARGIN + i * CELL} H${MARGIN + span}`).join(' ')}
      />
      <rect className="sh-frame" x={MARGIN} y={MARGIN} width={span} height={span} rx={1.5} />

      {/* 좌표 글자 */}
      {Array.from({ length: size }, (_, i) => (
        <g key={i} className="sh-label">
          <text x={MARGIN + i * CELL + CELL / 2} y={MARGIN - 2} textAnchor="middle" className={i === cx ? 'sh-label-on' : ''}>
            {COLUMN_LETTERS[i]}
          </text>
          <text x={MARGIN - 1.6} y={MARGIN + i * CELL + CELL / 2 + 1.4} textAnchor="end" className={i === cy ? 'sh-label-on' : ''}>
            {i + 1}
          </text>
        </g>
      ))}

      {/* 흐린 배 (모두 공개) */}
      {props.ghosts?.map((s) => (
        <g key={`g-${s.id}`} transform={shipTransform(s, MARGIN, MARGIN)}>
          <ShipHull id={s.id} className="sh-ship-ghost" />
        </g>
      ))}

      {/* 배 */}
      {props.ships?.map((s) => {
        const sunk = sunkIds.has(s.id);
        const fresh = sunk && fxSunk === s.id;
        return (
          <g
            key={`s-${s.id}`}
            transform={shipTransform(s, MARGIN, MARGIN)}
            style={fresh ? ({ '--fly': `${fx!.fly}ms`, '--impact': `${fx!.impact}ms` } as CSSProperties) : undefined}
          >
            <ShipHull
              id={s.id}
              className={sunk ? `sh-ship-sunk${fresh ? ' sh-ship-sinking' : ''}` : ''}
            />
          </g>
        );
      })}

      {/* 가라앉아 공개된 상대 배 */}
      {props.wrecks?.map((s) => {
        const fresh = fxSunk === s.id;
        return (
          <g key={`w-${s.id}`} transform={shipTransform(s, MARGIN, MARGIN)} style={fresh ? ({ '--fly': `${fx!.fly}ms`, '--impact': `${fx!.impact}ms` } as CSSProperties) : undefined}>
            <ShipHull id={s.id} className={`sh-ship-wreck${fresh ? ' sh-wreck-new' : ''}`} />
          </g>
        );
      })}

      {/* 포탄 자국 */}
      {marks.map((m, c) => {
        if (m === 0) return null;
        const [x, y] = center(c, size);
        const fresh = fx?.cell === c;
        if (m === MISS) return <MissMark key={c} x={x} y={y} fresh={fresh} style={delayStyle(c)} />;
        if (m === HIT && sunkCells.has(c)) {
          return (
            <g key={c} className={fx?.result === 'sunk' && fx.cells.includes(c) ? 'sh-mark-new' : ''} style={delayStyle(c)}>
              <SunkMark x={x} y={y} />
            </g>
          );
        }
        return <HitMark key={c} x={x} y={y} fresh={fresh} style={delayStyle(c)} />;
      })}

      {/* 가장 최근 칸 */}
      {props.lastCell != null && props.lastCell >= 0 && (
        <rect
          className="sh-last"
          x={MARGIN + (props.lastCell % size) * CELL + 0.6}
          y={MARGIN + Math.floor(props.lastCell / size) * CELL + 0.6}
          width={CELL - 1.2}
          height={CELL - 1.2}
          rx={1.6}
          style={fx && fx.cell === props.lastCell ? ({ '--fly': `${fx.fly + fx.impact * 0.5}ms` } as CSSProperties) : undefined}
        />
      )}

      {/* 놓으려는 배 */}
      {preview && (
        <g transform={shipTransform(preview.ship, MARGIN, MARGIN)} className={preview.ok ? 'sh-preview-ok' : 'sh-preview-bad'}>
          <rect className="sh-preview-box" x={0.4} y={0.4} width={shipCells(preview.ship, size).length * CELL - 0.8} height={CELL - 0.8} rx={2} />
          <ShipHull id={preview.ship.id} className="sh-ship-preview" />
        </g>
      )}

      {/* 조준점 */}
      {cursor != null && cursor >= 0 && (
        <g
          className={`sh-cursor sh-cursor-${props.cursorKind ?? 'aim'}${props.cursorKind === 'aim' && marks[cursor] !== 0 ? ' sh-cursor-used' : ''}`}
          transform={`translate(${MARGIN + cx * CELL + CELL / 2} ${MARGIN + cy * CELL + CELL / 2})`}
        >
          {props.cursorKind === 'place' ? (
            <rect x={-4.6} y={-4.6} width={9.2} height={9.2} rx={1.6} />
          ) : (
            <>
              <circle r={3.6} />
              <path d="M0 -5 V-2 M0 5 V2 M-5 0 H-2 M5 0 H2" />
            </>
          )}
        </g>
      )}

      {fx && <ShotEffect key={fx.id} fx={fx} size={size} />}

      {/* 마우스 입력 */}
      {props.interactive && (
        <rect
          className="sh-hit-area"
          x={MARGIN}
          y={MARGIN}
          width={span}
          height={span}
          onPointerDown={(e) => {
            const c = cellFromEvent(e);
            if (c !== null) props.onCellDown?.(c, e);
          }}
          onPointerMove={(e) => props.onHover?.(cellFromEvent(e))}
          onPointerLeave={() => props.onHover?.(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            const c = cellFromEvent(e);
            if (c !== null) props.onCellContext?.(c, e);
          }}
        />
      )}
    </svg>
  );
}
