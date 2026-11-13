import type { CSSProperties } from 'react';
import { DiscFace } from './DiscArt';
import { SIDE_LABELS, coordName, distance, other } from './rules';
import type { Disc, ReversiState } from './types';

export interface FlipTiming {
  /** 돌이 내려앉는 시간 */
  place: number;
  /** 거리 한 칸마다 늦추는 시간 */
  step: number;
  /** 한 돌이 뒤집히는 시간 */
  flip: number;
}

interface BoardProps {
  state: ReversiState;
  /** 사람이 지금 둘 수 있는지 */
  interactive: boolean;
  /** 둘 수 있는 곳 (사람 차례일 때만 채운다) */
  legal: ReadonlySet<number>;
  showHints: boolean;
  /** 마우스나 키보드로 고르고 있는 칸 */
  focus: number | null;
  showCursor: boolean;
  /** 고른 칸에 두면 뒤집힐 돌 */
  preview: ReadonlySet<number>;
  /** 연출 시간 (null이면 연출 없이 바로) */
  timing: FlipTiming | null;
  banner: { id: number; title: string; sub: string } | null;
  onPlace: (index: number) => void;
  onHover: (index: number | null) => void;
}

const STAR_POINTS: Record<number, [number, number][]> = {
  8: [
    [2, 2],
    [2, 6],
    [6, 2],
    [6, 6],
  ],
  6: [],
};

function axisFor(from: number, to: number, size: number): [number, number] {
  const dr = Math.sign(Math.floor(to / size) - Math.floor(from / size));
  const dc = Math.sign((to % size) - (from % size));
  // 놓은 돌에서 바깥쪽으로 굴러가듯 뒤집히게: 진행 방향에 수직인 축
  return [dr, -dc];
}

export function Board({ state, interactive, legal, showHints, focus, showCursor, preview, timing, banner, onPlace, onHover }: BoardProps) {
  const n = state.size;
  const letters = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
  const numbers = Array.from({ length: n }, (_, i) => String(i + 1));
  const place = timing ? state.events.find((e) => e.type === 'place') : undefined;
  const flipped = new Map<number, number>();
  if (place && place.type === 'place') place.flips.forEach((f) => flipped.set(f, distance(place.index, f, n)));
  const me = state.current;

  return (
    <div className="rv-frame" style={{ '--n': n } as CSSProperties}>
      <div className="rv-coords rv-coords-top" aria-hidden="true">
        {letters.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="rv-coords rv-coords-left" aria-hidden="true">
        {numbers.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div
        className={`rv-felt${interactive ? ' rv-felt-live' : ''}`}
        role="grid"
        aria-label={`${n}×${n} 뒤집기 판`}
        onMouseLeave={() => onHover(null)}
        data-testid="rv-board"
      >
        <svg className="rv-lines" viewBox={`0 0 ${n} ${n}`} preserveAspectRatio="none" aria-hidden="true">
          {Array.from({ length: n - 1 }, (_, i) => (
            <g key={i}>
              <line x1={i + 1} y1={0} x2={i + 1} y2={n} />
              <line x1={0} y1={i + 1} x2={n} y2={i + 1} />
            </g>
          ))}
        </svg>
        {STAR_POINTS[n].map(([r, c]) => (
          <span key={`${r}-${c}`} className="rv-star" style={{ left: `${(c / n) * 100}%`, top: `${(r / n) * 100}%` }} aria-hidden="true" />
        ))}
        {state.board.map((cell, i) => {
          const isLegal = legal.has(i);
          const isLast = state.lastMove === i;
          const dist = flipped.get(i);
          const classes = ['rv-cell'];
          if (isLegal && interactive) classes.push('rv-cell-legal');
          if (showCursor && focus === i) classes.push('rv-cell-cursor');
          if (preview.has(i)) classes.push('rv-cell-preview');
          let label = `${coordName(i, n)}, `;
          if (cell === -1) label += isLegal && interactive ? '둘 수 있어요' : '빈칸';
          else label += `${SIDE_LABELS[cell]}돌${isLast ? ' (방금 둔 돌)' : ''}`;

          let disc = null;
          if (cell !== -1) {
            if (timing && dist !== undefined && place) {
              const [ax, ay] = axisFor(place.index, i, n);
              const style = {
                '--ax': ax,
                '--ay': ay,
                '--delay': `${timing.place + (dist - 1) * timing.step}ms`,
                '--flip': `${timing.flip}ms`,
              } as CSSProperties;
              disc = (
                <span key={`flip-${place.id}`} className="rv-disc rv-disc-flip" style={style}>
                  <span className="rv-face rv-face-front">
                    <DiscFace side={other(cell as Disc)} />
                  </span>
                  <span className="rv-face rv-face-back">
                    <DiscFace side={cell as Disc} />
                  </span>
                </span>
              );
            } else if (timing && place && place.index === i) {
              disc = (
                <span key={`drop-${place.id}`} className="rv-disc rv-disc-drop" style={{ '--place': `${Math.max(timing.place, 120)}ms` } as CSSProperties}>
                  <DiscFace side={cell as Disc} />
                </span>
              );
            } else {
              disc = (
                <span key="still" className="rv-disc">
                  <DiscFace side={cell as Disc} />
                </span>
              );
            }
          }

          return (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              role="gridcell"
              className={classes.join(' ')}
              aria-label={label}
              data-testid={`rv-cell-${coordName(i, n)}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPlace(i)}
              onMouseEnter={() => onHover(i)}
            >
              {cell === -1 && isLegal && interactive && showHints && <span className={`rv-hint rv-hint-${me}`} aria-hidden="true" />}
              {cell === -1 && isLegal && interactive && (
                <span className="rv-ghost" aria-hidden="true">
                  <DiscFace side={me} />
                </span>
              )}
              {disc}
              {isLast && cell !== -1 && <span className={`rv-last rv-last-on-${cell}`} aria-hidden="true" />}
            </button>
          );
        })}
        {banner && (
          <div key={banner.id} className="rv-banner" role="status" data-testid="rv-pass-banner">
            <strong>{banner.title}</strong>
            <span>{banner.sub}</span>
          </div>
        )}
      </div>
      <div className="rv-coords rv-coords-right" aria-hidden="true">
        {numbers.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="rv-coords rv-coords-bottom" aria-hidden="true">
        {letters.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}
