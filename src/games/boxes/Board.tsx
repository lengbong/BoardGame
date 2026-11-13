import { useId, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { shapeElement } from '../../components/shapes';
import { SEAT_COLORS } from '../common/players';
import { MARGIN, PENS, UNIT, boardExtent, distToSegment, dotXY, hatchStrokes, initialOf, wobblyPath } from './art';
import { boxLines, boxSides, lineBoxes, lineDots, lineInfo } from './rules';
import type { BoxesState } from './types';

interface BoardProps {
  state: BoxesState;
  /** 사람이 지금 선을 그을 수 있는지 */
  interactive?: boolean;
  onLine?: (edge: number) => void;
  /** 키보드 커서가 가리키는 선 (null이면 안 보임) */
  cursor?: number | null;
  /** 연필로 선을 긋는 시간(ms). 0이면 바로 */
  drawMs?: number;
  /** 튀어나오는 +1 같은 연출 */
  fx?: boolean;
  /** 세 번째 변을 그으려 할 때 ⚠ 표시 */
  warnings?: boolean;
  /** 결과 화면의 작은 판 (조작·연출 없음) */
  mini?: boolean;
  className?: string;
  label?: string;
}

function lineCoords(n: number, e: number): [number, number, number, number] {
  const [[r1, c1], [r2, c2]] = lineDots(n, e);
  const [x1, y1] = dotXY(r1, c1);
  const [x2, y2] = dotXY(r2, c2);
  return [x1, y1, x2, y2];
}

/** 공책 종이 위의 점과 상자 판 (SVG, 화면 크기에 맞춰 늘고 줄어든다) */
export function Board({ state, interactive = false, onLine, cursor = null, drawMs = 0, fx = false, warnings = false, mini = false, className = '', label }: BoardProps) {
  const n = state.size;
  const W = boardExtent(n);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  // 처음 그릴 때 이미 있던 선·상자는 애니메이션 없이 (이어하기, 결과 화면)
  const mountedAt = useRef(state.history.length);
  const animate = !mini && drawMs > 0;

  const order = useMemo(() => {
    const o = new Map<number, number>();
    state.history.forEach((e, i) => o.set(e, i));
    return o;
  }, [state.history]);
  const lastLine = state.history.length > 0 ? state.history[state.history.length - 1] : null;
  const current = state.players[state.current];
  const curPen = PENS[current.seat];

  const lineAt = (clientX: number, clientY: number): number | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    let best: number | null = null;
    let bestD = UNIT * 0.5 + 1;
    for (let e = 0; e < state.lines.length; e++) {
      if (state.lines[e] !== -1) continue;
      const [x1, y1, x2, y2] = lineCoords(n, e);
      const d = distToSegment(pt.x, pt.y, x1, y1, x2, y2);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  };

  const onPointerMove = (ev: PointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    const e = lineAt(ev.clientX, ev.clientY);
    if (e !== hover) setHover(e);
  };
  const onClick = (ev: MouseEvent<SVGSVGElement>) => {
    if (!interactive || !onLine) return;
    const e = lineAt(ev.clientX, ev.clientY);
    if (e !== null) onLine(e);
  };

  const shownHover = interactive && hover !== null && state.lines[hover] === -1 ? hover : null;
  const ghosts = new Set<number>();
  if (shownHover !== null) ghosts.add(shownHover);
  if (interactive && cursor !== null && state.lines[cursor] === -1) ghosts.add(cursor);
  const marker = interactive ? (cursor !== null && state.lines[cursor] === -1 ? cursor : shownHover) : null;

  const boxSize = UNIT;
  const inset = 9;

  return (
    <svg
      ref={svgRef}
      className={`bx-board${mini ? ' bx-board-mini' : ''}${interactive && shownHover !== null ? ' bx-board-pick' : ''} ${className}`}
      viewBox={`0 0 ${W} ${W}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label ?? `${n}×${n} 점과 상자 판`}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHover(null)}
      onClick={onClick}
    >
      <defs>
        <pattern id={`bx-grid-${uid}`} width={UNIT / 4} height={UNIT / 4} patternUnits="userSpaceOnUse" x={MARGIN} y={MARGIN}>
          <path d={`M${UNIT / 4} 0H0V${UNIT / 4}`} className="bx-grid-line" />
        </pattern>
        <filter id={`bx-crayon-${uid}`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="3.5" />
        </filter>
      </defs>

      {/* 공책 종이 */}
      <rect className="bx-paper" x={2} y={2} width={W - 4} height={W - 4} rx={10} />
      <rect x={2} y={2} width={W - 4} height={W - 4} rx={10} fill={`url(#bx-grid-${uid})`} />
      <line className="bx-margin-line" x1={MARGIN * 0.55} y1={4} x2={MARGIN * 0.55} y2={W - 4} />
      {!mini &&
        [0.22, 0.5, 0.78].map((t) => <circle key={t} className="bx-hole" cx={MARGIN * 0.27} cy={W * t} r={7} />)}

      {/* 완성한 상자: 크레용 빗금 + 모양 + 이름 첫 글자 */}
      {state.boxes.map((owner, b) => {
        if (owner === -1) return null;
        const r = Math.floor(b / n);
        const c = b % n;
        const [x, y] = dotXY(r, c);
        const p = state.players[owner];
        const pen = PENS[p.seat];
        const fresh = animate && boxNewlyDone(state, b, order, mountedAt.current);
        const strokes = hatchStrokes(x + inset, y + inset, boxSize - inset * 2, b + 1);
        const cx = x + boxSize / 2;
        const cy = y + boxSize / 2;
        return (
          <g key={`b${b}`} className={fresh ? 'bx-box bx-box-new' : 'bx-box'}>
            <rect x={x + 5} y={y + 5} width={boxSize - 10} height={boxSize - 10} rx={6} fill={SEAT_COLORS[p.seat].light} className="bx-box-wash" />
            <g filter={`url(#bx-crayon-${uid})`} stroke={pen.ink} className="bx-hatch">
              {strokes.map((d, i) => (
                <path key={i} d={d} pathLength={1} style={fresh ? ({ animationDelay: `${i * 28}ms` } as CSSProperties) : undefined} />
              ))}
            </g>
            <g className="bx-box-mark">
              {shapeElement(pen.shape, cx, cy - 13, 15, pen.ink, { stroke: '#fff', strokeWidth: 3, paintOrder: 'stroke' })}
              <text x={cx} y={cy + 30} className="bx-box-initial" fill={pen.label}>
                {initialOf(p.name)}
              </text>
            </g>
            {fresh && fx && (
              <text x={cx} y={cy - 30} className="bx-plus" fill={pen.label}>
                +1
              </text>
            )}
          </g>
        );
      })}

      {/* 마지막에 그은 선: 형광펜 */}
      {lastLine !== null && !mini && (() => {
        const [x1, y1, x2, y2] = lineCoords(n, lastLine);
        return <line key={`hl${state.history.length}`} className="bx-highlight" x1={x1} y1={y1} x2={x2} y2={y2} />;
      })()}

      {/* 그은 선: 그은 사람 펜 색 */}
      {state.lines.map((owner, e) => {
        if (owner === -1) return null;
        const [x1, y1, x2, y2] = lineCoords(n, e);
        const pen = PENS[state.players[owner].seat];
        const fresh = animate && (order.get(e) ?? -1) >= mountedAt.current;
        const style = fresh ? ({ '--bx-draw': `${drawMs}ms` } as CSSProperties) : undefined;
        return (
          <g key={`l${e}`} stroke={pen.ink} className={fresh ? 'bx-ink bx-ink-new' : 'bx-ink'} style={style}>
            <path d={wobblyPath(x1, y1, x2, y2, e + 1)} pathLength={1} className="bx-ink-main" />
            <path d={wobblyPath(x1, y1, x2, y2, e + 501, 2.2)} pathLength={1} className="bx-ink-sketch" />
          </g>
        );
      })}

      {/* 사람 차례: 마우스·키보드로 고른 자리에 흐린 선 */}
      {[...ghosts].map((e) => {
        const [x1, y1, x2, y2] = lineCoords(n, e);
        return <line key={`g${e}`} className="bx-ghost" x1={x1} y1={y1} x2={x2} y2={y2} stroke={curPen.ink} />;
      })}
      {interactive && cursor !== null && <CursorRing n={n} edge={cursor} />}

      {/* 점 */}
      {Array.from({ length: (n + 1) * (n + 1) }, (_, k) => {
        const [x, y] = dotXY(Math.floor(k / (n + 1)), k % (n + 1));
        return <circle key={`d${k}`} className="bx-dot" cx={x} cy={y} r={7} />;
      })}

      {/* 고른 선이 상자를 완성하면 +, 세 번째 변이면 ⚠ */}
      {marker !== null && <LineMarker state={state} edge={marker} warnings={warnings} color={curPen.ink} />}

      {/* 연필 */}
      {animate && lastLine !== null && state.history.length > mountedAt.current && (() => {
        const [x1, y1, x2, y2] = lineCoords(n, lastLine);
        const style = { '--x1': `${x1}px`, '--y1': `${y1}px`, '--x2': `${x2}px`, '--y2': `${y2}px`, '--bx-draw': `${drawMs}ms` } as CSSProperties;
        return (
          <g key={`p${state.history.length}`} className="bx-pencil" style={style} aria-hidden="true">
            <Pencil color={PENS[state.players[state.lines[lastLine]].seat].ink} />
          </g>
        );
      })()}
    </svg>
  );
}

/** 상자가 처음 그린 뒤에 완성됐는지: 네 변 중 가장 늦게 그은 선의 순서로 판단 */
function boxNewlyDone(state: BoxesState, b: number, order: Map<number, number>, mountedAt: number): boolean {
  const last = Math.max(...boxLines(state.size, b).map((l) => order.get(l) ?? -1));
  return last >= mountedAt;
}

function CursorRing({ n, edge }: { n: number; edge: number }) {
  const { horizontal } = lineInfo(n, edge);
  const [x1, y1, x2, y2] = lineCoords(n, edge);
  const pad = 14;
  const x = Math.min(x1, x2) - (horizontal ? -pad : pad + 4);
  const y = Math.min(y1, y2) - (horizontal ? pad + 4 : -pad);
  const w = horizontal ? UNIT - pad * 2 : (pad + 4) * 2;
  const h = horizontal ? (pad + 4) * 2 : UNIT - pad * 2;
  return <rect className="bx-cursor" x={x} y={y} width={w} height={h} rx={16} />;
}

/** 고른 선이 완성할 상자에는 +1, 세 번째 변을 만들 상자에는 ⚠ (상자 가운데에) */
function LineMarker({ state, edge, warnings, color }: { state: BoxesState; edge: number; warnings: boolean; color: string }) {
  const n = state.size;
  const around = lineBoxes(n, edge).map((b) => ({ b, sides: boxSides(state, b) }));
  const center = (b: number) => {
    const [x, y] = dotXY(Math.floor(b / n), b % n);
    return [x + UNIT / 2, y + UNIT / 2];
  };
  const done = around.filter((x) => x.sides === 3);
  if (done.length > 0) {
    return (
      <g aria-hidden="true">
        {done.map(({ b }) => {
          const [mx, my] = center(b);
          return (
            <g key={b} className="bx-marker">
              <circle cx={mx} cy={my} r={22} fill={color} stroke="#fff" strokeWidth={3.5} />
              <text x={mx} y={my + 8} className="bx-marker-text">
                +1
              </text>
            </g>
          );
        })}
      </g>
    );
  }
  const risky = warnings ? around.filter((x) => x.sides === 2) : [];
  if (risky.length === 0) return null;
  return (
    <g aria-hidden="true">
      {risky.map(({ b }) => {
        const [mx, my] = center(b);
        return (
          <g key={b} className="bx-marker bx-marker-warn">
            <path d={`M${mx} ${my - 22}L${mx + 22} ${my + 16}H${mx - 22}Z`} fill="#ffcf3f" stroke="#7a5600" strokeWidth={3} strokeLinejoin="round" />
            <text x={mx} y={my + 11} className="bx-marker-warn-text">
              !
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** 끝(0,0)이 연필심인 작은 연필. 몸통은 오른쪽 위로 */
function Pencil({ color }: { color: string }) {
  return (
    <g transform="rotate(-52)">
      <path d="M0 0L15 -6.5V6.5Z" fill="#f2cf9a" stroke="#6b4a22" strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M0 0L5.5 -2.4V2.4Z" fill={color} />
      <rect x={15} y={-6.5} width={46} height={13} fill="#ffd23f" stroke="#8a6a00" strokeWidth={1.2} />
      <line x1={15} y1={-2.2} x2={61} y2={-2.2} stroke="#e6b400" strokeWidth={1.2} />
      <line x1={15} y1={2.2} x2={61} y2={2.2} stroke="#e6b400" strokeWidth={1.2} />
      <rect x={61} y={-6.8} width={6} height={13.6} fill="#c9ccd2" stroke="#6d7179" strokeWidth={1.1} />
      <rect x={67} y={-6.5} width={9} height={13} rx={3.5} fill="#ff9aa8" stroke="#a24d5a" strokeWidth={1.1} />
    </g>
  );
}
