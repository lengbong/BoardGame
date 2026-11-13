import { useRef, type CSSProperties, type MutableRefObject } from 'react';
import { useElementWidth } from '../../lib/useElementWidth';
import { SEAT_COLORS } from '../common/players';
import { DominoBack, DominoFace } from './DominoArt';
import { handPips, sortHand } from './dominoes';
import { lineEnds, playerName } from './rules';
import type { DominoState, Side } from './types';

interface HandTrayProps {
  state: DominoState;
  /** 아래 칸에 보여 줄 사람 (없으면 null) */
  owner: number | null;
  faceUp: boolean;
  /** 지금 이 사람이 패를 고를 수 있는지 */
  interactive: boolean;
  pipColors: boolean;
  playableIds: ReadonlySet<number>;
  /** 키보드 커서가 가리키는 패 */
  cursorId: number | null;
  showCursor: boolean;
  /** 끝을 고르는 중인 패 */
  pendingId: number | null;
  activeSide: Side;
  recentIds: ReadonlySet<number>;
  shakeId: number | null;
  dealKey: number;
  dealStep: number;
  hint: string;
  canDraw: boolean;
  canPass: boolean;
  handEls: MutableRefObject<Map<number, HTMLElement>>;
  trayRef: MutableRefObject<HTMLElement | null>;
  onTile: (tileId: number) => void;
  onHover: (tileId: number | null) => void;
  onDraw: () => void;
  onPass: () => void;
  onSide: (side: Side) => void;
  onCancel: () => void;
}

const MAX_W = 50;
/** 마우스로 누를 때는 포커스를 남기지 않는다 (Enter·Space가 키보드 커서를 따르도록) */
export const noFocus = (e: { preventDefault: () => void }) => e.preventDefault();
const MIN_W = 26;

export function HandTray(props: HandTrayProps) {
  const { state, owner, faceUp, interactive, pipColors, playableIds, cursorId, showCursor, pendingId, recentIds, shakeId } = props;
  const rowRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(rowRef);

  if (owner === null) {
    return (
      <section className="dm-tray dm-tray-empty" ref={(el) => void (props.trayRef.current = el)}>
        <p>{props.hint}</p>
      </section>
    );
  }

  const player = state.players[owner];
  const c = SEAT_COLORS[player.seat];
  const tiles = faceUp ? sortHand(player.hand) : player.hand;
  const n = tiles.length;
  const gap = 8;
  const avail = Math.max(120, width - 8);
  const tw = n > 0 ? Math.max(MIN_W, Math.min(MAX_W, (avail - gap * (n - 1)) / n)) : MAX_W;
  const total = n * tw + Math.max(0, n - 1) * gap;
  // 패가 아주 많으면 조금씩 겹쳐서 한 줄에 다 보이게 한다.
  const overlap = n > 1 && total > avail ? (total - avail) / (n - 1) : 0;
  const myTurn = owner === state.current && state.phase === 'play';
  const ends = lineEnds(state);
  const pending = pendingId !== null;

  return (
    <section
      className={`dm-tray${myTurn ? ' dm-tray-turn' : ''}`}
      style={{ '--pc': c.main, '--pc-light': c.light, '--pc-dark': c.dark, '--tw': `${tw}px` } as CSSProperties}
      ref={(el) => void (props.trayRef.current = el)}
      data-testid="dm-tray"
    >
      <header className="dm-tray-head">
        <span className="dm-avatar" aria-hidden="true">
          {playerName(player).slice(0, 1)}
        </span>
        <strong>{playerName(player)}의 패</strong>
        <span className="dm-tray-count">
          {n}개{faceUp && n > 0 ? ` · 점 ${handPips(player.hand)}` : ''}
        </span>
        <p className="dm-tray-hint" data-testid="dm-hint" aria-live="polite">
          {props.hint}
        </p>
        <div className="dm-tray-actions">
          {pending ? (
            <>
              <button type="button" className={`btn dm-side-btn${props.activeSide === 'left' ? ' btn-selected' : ''}`} onClick={() => props.onSide('left')} data-testid="dm-side-left">
                ← 왼쪽 끝 ({ends?.left})
              </button>
              <button type="button" className={`btn dm-side-btn${props.activeSide === 'right' ? ' btn-selected' : ''}`} onClick={() => props.onSide('right')} data-testid="dm-side-right">
                오른쪽 끝 ({ends?.right}) →
              </button>
              <button type="button" className="btn btn-small" onClick={props.onCancel}>
                취소 <kbd>Esc</kbd>
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn" onClick={props.onDraw} onMouseDown={noFocus} disabled={!props.canDraw} data-testid="dm-draw">
                뽑기 <kbd>D</kbd>
              </button>
              <button type="button" className="btn" onClick={props.onPass} onMouseDown={noFocus} disabled={!props.canPass} data-testid="dm-pass">
                통과 <kbd>Space</kbd>
              </button>
            </>
          )}
        </div>
      </header>

      <div className={`dm-hand${interactive ? ' dm-hand-active' : ''}`} ref={rowRef} onMouseLeave={() => props.onHover(null)}>
        {tiles.map((t, i) => {
          const style = {
            marginLeft: i === 0 ? 0 : gap - overlap,
            zIndex: i + 1,
            animationDelay: `${i * props.dealStep * state.players.length}ms`,
          } as CSSProperties;
          if (!faceUp) {
            return (
              <span key={`${props.dealKey}-${t.id}`} className="dm-hand-tile dm-hand-back" style={style}>
                <DominoBack />
              </span>
            );
          }
          const playable = interactive && playableIds.has(t.id);
          const cls = [
            'dm-hand-tile',
            playable ? 'dm-playable' : '',
            interactive && !playable ? 'dm-dim' : '',
            showCursor && interactive && cursorId === t.id ? 'dm-cursor' : '',
            pendingId === t.id ? 'dm-pending' : '',
            recentIds.has(t.id) ? 'dm-recent' : '',
            shakeId === t.id ? 'dm-shake' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={`${props.dealKey}-${t.id}`}
              type="button"
              className={cls}
              style={style}
              ref={(el) => {
                if (el) props.handEls.current.set(t.id, el);
                else props.handEls.current.delete(t.id);
              }}
              onClick={() => props.onTile(t.id)}
              onMouseDown={noFocus}
              onMouseEnter={() => props.onHover(t.id)}
              disabled={!interactive}
              aria-label={`${t.a}·${t.b} 패${playable ? ' (낼 수 있어요)' : ''}`}
              data-testid={`dm-tile-${t.id}`}
            >
              <DominoFace a={t.a} b={t.b} vertical colors={pipColors} />
              {interactive && i < 9 && <span className="dm-key">{i + 1}</span>}
            </button>
          );
        })}
        {n === 0 && <p className="dm-hand-none">패를 다 냈어요! 🎉</p>}
      </div>
    </section>
  );
}
