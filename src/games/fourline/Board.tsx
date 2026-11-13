import type { CSSProperties } from 'react';
import { Stone } from './StoneArt';
import { COLS, ROWS, SIDE_LABELS, coordName, landingRow, winSegments } from './rules';
import { dropTiming } from './storage';
import type { FourLineState, Side } from './types';

interface BoardProps {
  state: FourLineState;
  /** 사람이 지금 떨어뜨릴 수 있는지 */
  interactive: boolean;
  /** 마우스·키보드로 고른 열 */
  selected: number | null;
  /** 키보드로 고르는 중이면 테두리를 보여 준다 */
  showCursor: boolean;
  /** 도움: 바로 이기는 열, 꼭 막아야 할 열 */
  hints: { win: number[]; block: number[] } | null;
  /** 떨어지는 시간 (0이면 연출 없이 바로) */
  fall: number;
  onDrop: (col: number) => void;
  onHover: (col: number | null) => void;
}

/** 판 앞판: 나무판에 구멍 42개 (짝홀 채우기로 구멍을 뚫는다). 단위: 한 칸 = 10 */
function platePath(): string {
  const B = 3;
  let d = `M${-B + 2} ${-B} H${COLS * 10 + B - 2} Q${COLS * 10 + B} ${-B} ${COLS * 10 + B} ${-B + 2} V${ROWS * 10 + B - 2} Q${COLS * 10 + B} ${ROWS * 10 + B} ${COLS * 10 + B - 2} ${ROWS * 10 + B} H${-B + 2} Q${-B} ${ROWS * 10 + B} ${-B} ${ROWS * 10 + B - 2} V${-B + 2} Q${-B} ${-B} ${-B + 2} ${-B}Z`;
  const r = 3.85;
  for (let row = 0; row < ROWS; row++) {
    for (let c = 0; c < COLS; c++) {
      const cx = c * 10 + 5;
      const cy = row * 10 + 5;
      d += ` M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
    }
  }
  return d;
}
const PLATE = platePath();

const center = (index: number) => ({ x: (index % COLS) * 10 + 5, y: Math.floor(index / COLS) * 10 + 5 });

export function Board({ state, interactive, selected, showCursor, hints, fall, onDrop, onHover }: BoardProps) {
  const drop = fall > 0 ? state.events.find((e) => e.type === 'drop') : undefined;
  const dropIndex = drop && drop.type === 'drop' ? drop.row * COLS + drop.col : -1;
  const timing = drop && drop.type === 'drop' ? dropTiming(fall, drop.row) : { impact: 0, total: 0 };
  const winSet = new Set(state.winLine ?? []);
  const segments = state.winLine && state.lastMove !== null ? winSegments(state.board, state.lastMove) : [];
  const me: Side = state.current;

  const marks: { index: number; kind: 'win' | 'block' }[] = [];
  if (hints) {
    for (const c of hints.win) marks.push({ index: landingRow(state.board, c) * COLS + c, kind: 'win' });
    for (const c of hints.block) if (!hints.win.includes(c)) marks.push({ index: landingRow(state.board, c) * COLS + c, kind: 'block' });
  }

  return (
    <div className={`fl-stage${interactive ? ' fl-live' : ''}`} style={{ '--after': `${timing.total}ms` } as CSSProperties}>
      <div className="fl-heads">
        {Array.from({ length: COLS }, (_, c) => {
          const full = state.board[c] !== -1;
          const on = selected === c;
          return (
            <button
              key={c}
              type="button"
              tabIndex={-1}
              className={`fl-head${on && interactive ? ' fl-head-on' : ''}${on && showCursor ? ' fl-head-cursor' : ''}${full ? ' fl-head-full' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onDrop(c)}
              onMouseEnter={() => onHover(c)}
              aria-label={`${c + 1}번 줄(${String.fromCharCode(65 + c)})에 떨어뜨리기${full ? ' — 꽉 찼어요' : ''}`}
              data-testid={`fl-col-${c + 1}`}
            >
              {interactive && on && !full ? (
                <span className="fl-ghost" aria-hidden="true">
                  <Stone side={me} />
                </span>
              ) : (
                <span className="fl-head-num" aria-hidden="true">
                  {c + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="fl-board" onMouseLeave={() => onHover(null)} data-testid="fl-board">
        <div className="fl-back" aria-hidden="true" />
        <div className="fl-stones" aria-hidden="true">
          {state.board.map((v, i) => {
            if (v === -1) return null;
            const r = Math.floor(i / COLS);
            const c = i % COLS;
            const dropping = i === dropIndex;
            const cls = ['fl-cell'];
            if (winSet.has(i)) cls.push('fl-cell-win');
            if (i === state.lastMove && state.phase === 'play') cls.push('fl-cell-last');
            const style = { '--r': r, '--c': c } as Record<string, string | number>;
            if (dropping) {
              style['--fall'] = r + 1.3;
              style['--dur'] = `${timing.total}ms`;
            }
            return (
              <span key={dropping && drop ? `${i}-${drop.id}` : i} className={cls.join(' ')} style={style as CSSProperties}>
                <span className={`fl-stone${dropping ? ' fl-stone-drop' : ''}`}>
                  <Stone side={v} />
                </span>
              </span>
            );
          })}
        </div>

        <svg className="fl-plate" viewBox="-3 -3 76 66" aria-hidden="true">
          <defs>
            <linearGradient id="fl-plate-grad" x1="0" y1="0" x2="0.35" y2="1">
              <stop offset="0%" stopColor="#c88d55" />
              <stop offset="55%" stopColor="#a8723f" />
              <stop offset="100%" stopColor="#8a5a30" />
            </linearGradient>
            <pattern id="fl-plate-grain" width="14" height="66" patternUnits="userSpaceOnUse">
              <path d="M2 0 C4 20 0 40 3 66 M9 0 C7 25 11 45 8 66" stroke="#6b4220" strokeOpacity="0.12" strokeWidth="0.6" fill="none" />
            </pattern>
          </defs>
          <path d={PLATE} fill="url(#fl-plate-grad)" fillRule="evenodd" />
          <path d={PLATE} fill="url(#fl-plate-grain)" fillRule="evenodd" />
          {Array.from({ length: ROWS * COLS }, (_, i) => {
            const { x, y } = center(i);
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={3.85} className="fl-hole-shadow" />
                <circle cx={x} cy={y} r={4.35} className="fl-hole-rim" />
              </g>
            );
          })}
        </svg>

        {marks.length > 0 && (
          <div className="fl-marks" aria-hidden="true">
            {marks.map((m) => (
              <span
                key={`${m.kind}-${m.index}`}
                className={`fl-mark fl-mark-${m.kind}`}
                style={{ '--r': Math.floor(m.index / COLS), '--c': m.index % COLS } as CSSProperties}
              >
                {m.kind === 'win' ? '이겨요' : '막아요'}
              </span>
            ))}
          </div>
        )}

        {segments.length > 0 && (
          <svg className="fl-winline" viewBox="0 0 70 60" aria-hidden="true">
            {segments.map(([a, b]) => {
              const p = center(a);
              const q = center(b);
              return (
                <g key={`${a}-${b}`}>
                  <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} className="fl-winline-under" pathLength={1} />
                  <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} className="fl-winline-top" pathLength={1} />
                </g>
              );
            })}
            {[...winSet].map((i) => (
              <circle key={i} cx={center(i).x} cy={center(i).y} r={4.1} className="fl-winring" />
            ))}
          </svg>
        )}

        <div className="fl-cols">
          {Array.from({ length: COLS }, (_, c) => {
            const full = state.board[c] !== -1;
            const top = landingRow(state.board, c);
            return (
              <button
                key={c}
                type="button"
                tabIndex={-1}
                className={`fl-colbtn${selected === c && interactive && !full ? ' fl-colbtn-on' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onDrop(c)}
                onMouseEnter={() => onHover(c)}
                aria-label={
                  full ? `${c + 1}번 줄 — 꽉 찼어요` : `${c + 1}번 줄에 떨어뜨리면 ${coordName(top * COLS + c)} 칸에 놓여요`
                }
              />
            );
          })}
        </div>
      </div>

      <div className="fl-feet" aria-hidden="true">
        {Array.from({ length: COLS }, (_, c) => (
          <span key={c}>{String.fromCharCode(65 + c)}</span>
        ))}
      </div>
      <p className="fl-sr" aria-live="polite">
        {state.lastMove !== null ? `${SIDE_LABELS[state.board[state.lastMove] as Side]} ${coordName(state.lastMove)}` : ''}
      </p>
    </div>
  );
}
