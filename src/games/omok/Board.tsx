import { useRef } from 'react';
import { starPoints } from './rules';
import { StoneShape } from './StoneArt';
import type { Cell, OmokState, Stone } from './types';

interface BoardProps {
  state: OmokState;
  /** 사람이 둘 수 있는지 */
  interactive: boolean;
  /** 마우스나 키보드로 가리키는 칸 */
  cursor: number | null;
  /** 키보드로 움직이는 중이면 커서를 또렷하게 */
  keyboard: boolean;
  /** 지금 차례의 돌 (미리 보기 색) */
  side: Stone;
  hints: { win: number[]; block: number[]; watch: number[] } | null;
  /** 지금 차례 사람이 둘 수 없는 금수 자리 */
  forbidden: ReadonlySet<number>;
  showNumbers: boolean;
  /** 이긴 줄 연출을 보여 줄지 */
  showWin: boolean;
  onHover: (index: number | null) => void;
  onPlace: (index: number) => void;
}

/** 칸 번호 → 판 좌표 */
function xy(index: number, size: number): { x: number; y: number } {
  return { x: index % size, y: Math.floor(index / size) };
}

export function Board(props: BoardProps) {
  const { state, cursor, side, hints, forbidden } = props;
  const size = state.size;
  const svgRef = useRef<SVGSVGElement>(null);
  const moveNo = new Map<number, number>(state.moves.map((m, k) => [m, k + 1]));
  const last = state.lastMove;

  /** 마우스 위치에서 가장 가까운 교차점 */
  const pointToIndex = (e: { clientX: number; clientY: number }): number | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const c = Math.round(pt.x);
    const r = Math.round(pt.y);
    if (c < 0 || c >= size || r < 0 || r >= size) return null;
    return r * size + c;
  };

  const stones: { index: number; side: Stone }[] = [];
  state.board.forEach((cell: Cell, i) => {
    if (cell !== -1) stones.push({ index: i, side: cell });
  });
  const winSet = new Set(props.showWin ? (state.winLine ?? []) : []);
  const ends = props.showWin && state.winLine && state.winLine.length >= 2 ? [xy(state.winLine[0], size), xy(state.winLine[state.winLine.length - 1], size)] : null;
  const hoverOk = props.interactive && cursor !== null && state.board[cursor] === -1 && !forbidden.has(cursor);
  const letters = Array.from({ length: size }, (_, k) => String.fromCharCode(65 + k));

  return (
    <svg
      ref={svgRef}
      className={`ok-board${props.interactive ? ' ok-board-on' : ''}`}
      viewBox={`-1.1 -1.1 ${size + 1.2} ${size + 1.2}`}
      role="grid"
      aria-label={`오목판 ${size}줄`}
      onPointerMove={(e) => props.interactive && props.onHover(pointToIndex(e))}
      onPointerLeave={() => props.onHover(null)}
      onClick={(e) => {
        if (!props.interactive) return;
        const i = pointToIndex(e);
        if (i !== null) props.onPlace(i);
      }}
      data-testid="ok-board"
    >
      <rect x={-1.1} y={-1.1} width={size + 1.2} height={size + 1.2} rx={0.35} className="ok-frame" />
      <rect x={-0.96} y={-0.96} width={size + 0.92} height={size + 0.92} rx={0.22} fill="url(#ok-wood)" />
      {/* 나뭇결 */}
      {[0.17, 0.41, 0.63, 0.86].map((t, k) => (
        <path
          key={k}
          d={`M-0.7 ${t * size} C${size * 0.3} ${t * size - 0.6} ${size * 0.6} ${t * size + 0.7} ${size - 0.3} ${t * size + 0.1}`}
          className="ok-grain"
        />
      ))}
      <g className="ok-lines">
        {Array.from({ length: size }, (_, k) => (
          <g key={k}>
            <line x1={0} y1={k} x2={size - 1} y2={k} />
            <line x1={k} y1={0} x2={k} y2={size - 1} />
          </g>
        ))}
        <rect x={0} y={0} width={size - 1} height={size - 1} className="ok-edge" />
      </g>
      {starPoints(size).map((p) => {
        const { x, y } = xy(p, size);
        return <circle key={p} cx={x} cy={y} r={0.12} className="ok-star" />;
      })}
      <g className="ok-labels" aria-hidden="true">
        {letters.map((l, k) => (
          <text key={`t${k}`} x={k} y={-0.62} textAnchor="middle">
            {l}
          </text>
        ))}
        {letters.map((l, k) => (
          <text key={`b${k}`} x={k} y={size - 0.08} textAnchor="middle">
            {l}
          </text>
        ))}
        {Array.from({ length: size }, (_, k) => (
          <text key={`l${k}`} x={-0.62} y={k + 0.16} textAnchor="middle">
            {size - k}
          </text>
        ))}
        {Array.from({ length: size }, (_, k) => (
          <text key={`r${k}`} x={size - 0.38} y={k + 0.16} textAnchor="middle">
            {size - k}
          </text>
        ))}
      </g>

      {/* 금수 자리 */}
      {props.interactive &&
        [...forbidden].map((i) => {
          const { x, y } = xy(i, size);
          return <path key={`f${i}`} d={`M${x - 0.18} ${y - 0.18} L${x + 0.18} ${y + 0.18} M${x + 0.18} ${y - 0.18} L${x - 0.18} ${y + 0.18}`} className="ok-forbidden" />;
        })}

      {/* 수 알려 주기 */}
      {hints &&
        (
          [
            ['win', hints.win],
            ['block', hints.block],
            ['watch', hints.watch],
          ] as const
        ).flatMap(([kind, list]) =>
          list.map((i) => {
            const { x, y } = xy(i, size);
            return <circle key={`${kind}${i}`} cx={x} cy={y} r={0.36} className={`ok-hint ok-hint-${kind}`} />;
          }),
        )}

      {stones.map(({ index, side: s }) => {
        const { x, y } = xy(index, size);
        const isNew = index === last;
        const n = moveNo.get(index);
        return (
          <g key={index} className={`${isNew ? 'ok-new' : ''}${winSet.has(index) ? ' ok-winstone' : ''}`} style={{ transformOrigin: `${x}px ${y}px` }}>
            <StoneShape side={s} cx={x} cy={y} />
            {props.showNumbers && n !== undefined ? (
              <text x={x} y={y + 0.15} textAnchor="middle" className={`ok-num ${s === 0 ? 'ok-num-b' : 'ok-num-w'}${isNew ? ' ok-num-last' : ''}`}>
                {n}
              </text>
            ) : (
              isNew && <circle cx={x} cy={y} r={0.12} className="ok-last" />
            )}
          </g>
        );
      })}

      {ends && <line x1={ends[0].x} y1={ends[0].y} x2={ends[1].x} y2={ends[1].y} className="ok-winline" />}

      {/* 둘 자리 미리 보기 */}
      {props.interactive && cursor !== null && (
        <g className={`ok-cursor${props.keyboard ? ' ok-cursor-key' : ''}`} pointerEvents="none">
          {hoverOk && <StoneShape side={side} cx={cursor % size} cy={Math.floor(cursor / size)} className="ok-ghost" />}
          <rect x={(cursor % size) - 0.5} y={Math.floor(cursor / size) - 0.5} width={1} height={1} rx={0.15} className="ok-cursor-box" />
        </g>
      )}
    </svg>
  );
}
