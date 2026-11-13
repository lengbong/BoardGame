import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject, type RefObject } from 'react';
import { CardBack, CardFace } from './CardArt';
import { playerName } from './rules';
import { pictureName } from './themes';
import type { MemoryState } from './types';

/** 요소의 너비와 높이를 따라간다. */
function useBoxSize(ref: RefObject<HTMLElement | null>): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'match' | 'miss' | 'info';
}

interface BoardProps {
  state: MemoryState;
  /** 짝을 맞혀서 날아가기 전까지 앞면으로 보여 줄 카드 */
  holding: ReadonlySet<number>;
  /** 사람이 지금 카드를 뒤집을 수 있는지 */
  interactive: boolean;
  cursor: number;
  cardRefs: MutableRefObject<(HTMLButtonElement | null)[]>;
  /** 카드를 펼쳐 놓는 중 (처음 한 번) */
  dealing: boolean;
  /** 처음 보여 주기가 끝나고 카드를 차례로 덮는 중 */
  covering: boolean;
  flipMs: number;
  turnColor: string;
  toast: Toast | null;
  onCard: (id: number) => void;
  onCursor: (id: number) => void;
}

const ASPECT = 0.8; // 카드 너비 : 높이

export function Board(props: BoardProps) {
  const { state, holding, interactive, cursor, cardRefs, dealing, covering, flipMs, turnColor, toast, onCard, onCursor } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const { w, h } = useBoxSize(wrapRef);
  const { rows, cols } = state;
  const gap = rows * cols >= 36 ? 8 : rows * cols >= 24 ? 10 : 14;
  const pad = 16;
  const cw = Math.max(40, Math.floor(Math.min((w - pad * 2 - gap * (cols - 1)) / cols, ((h - pad * 2 - gap * (rows - 1)) / rows) * ASPECT)));
  const ch = Math.floor(cw / ASPECT);
  const peek = state.phase === 'peek';
  const wrong = state.phase === 'mismatch';

  return (
    <div
      className={`mm-board-wrap${wrong ? ' is-mismatch' : ''}`}
      ref={wrapRef}
      style={{ '--pc': turnColor } as CSSProperties}
      data-mm-theme={state.options.theme}
    >
      <div
        className={`mm-board${covering ? ' is-covering' : ''}${dealing ? ' is-dealing' : ''}`}
        role="group"
        aria-label={`카드 판 ${rows}줄 ${cols}칸`}
        style={
          {
            gridTemplateColumns: `repeat(${cols}, ${cw}px)`,
            gap,
            '--cw': `${cw}px`,
            '--ch': `${ch}px`,
            '--mm-flip': `${flipMs}ms`,
            visibility: w > 0 ? 'visible' : 'hidden',
          } as CSSProperties
        }
      >
        {state.cards.map((card) => {
          const held = holding.has(card.id);
          const gone = card.matchedBy !== null && !held;
          const up = peek || held || state.faceUp.includes(card.id);
          const known = up || card.id in state.seen;
          const flippable = interactive && !up && !gone;
          const row = Math.floor(card.id / cols) + 1;
          const col = (card.id % cols) + 1;
          const where = `${row}줄 ${col}번째`;
          const label = gone
            ? `${where}: 빈 자리 (${playerName(state.players[card.matchedBy!])}의 ${pictureName(card.pic)} 짝)`
            : up
              ? `${where}: ${pictureName(card.pic)}`
              : `${where} 카드, 뒷면`;
          const cls = [
            'mm-card',
            up && 'is-up',
            gone && 'is-gone',
            held && 'is-match',
            wrong && up && !held && 'is-wrong',
            flippable && 'can-flip',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={card.id}
              ref={(el) => void (cardRefs.current[card.id] = el)}
              type="button"
              className={cls}
              style={{ '--i': card.id, '--r': row - 1, '--c': col - 1 } as CSSProperties}
              tabIndex={card.id === cursor ? 0 : -1}
              aria-label={label}
              aria-disabled={!flippable}
              onClick={() => onCard(card.id)}
              onFocus={() => onCursor(card.id)}
              data-testid={`mm-card-${card.id}`}
            >
              <span className="mm-slot" aria-hidden="true" />
              <span className="mm-card-body" aria-hidden="true">
                <span className="mm-card-inner">
                  <span className="mm-side mm-side-back">
                    <CardBack />
                  </span>
                  <span className="mm-side mm-side-front">{known && <CardFace pic={card.pic} showName={state.options.showNames} />}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {toast && (
        <div key={toast.id} className={`mm-toast mm-toast-${toast.tone}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}
