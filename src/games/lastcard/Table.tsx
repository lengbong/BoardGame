import type { CSSProperties, MutableRefObject } from 'react';
import { SEAT_COLORS } from '../common/players';
import { COLOR_INFO, sortHand } from './cards';
import { CardBack, CardFace, ColorShapeIcon } from './CardArt';
import { playerName, topCard } from './rules';
import type { Card, LastCardState } from './types';

export interface TableRefs {
  table: HTMLDivElement | null;
  deck: HTMLElement | null;
  discard: HTMLElement | null;
  tray: HTMLElement | null;
  seats: Record<number, HTMLElement | null>;
}

/** 더미에서 자리로 날아가는 카드 뒷면 */
export interface Flyer {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  delay: number;
}

export interface SeatFx {
  id: number;
  player: number;
  text: string;
  tone: 'call' | 'skip' | 'draw' | 'pass' | 'stack' | 'win';
}

export interface CenterFx {
  id: number;
  text: string;
  color?: string;
}

interface TableProps {
  state: LastCardState;
  refs: MutableRefObject<TableRefs>;
  /** 모든 손패 공개 */
  openHands: boolean;
  /** 지금 손패를 아래 칸에 펼쳐 보여 주는 사람 (자리 쪽 손패는 작게만) */
  canDraw: boolean;
  onDraw: () => void;
  flyers: Flyer[];
  seatFx: SeatFx[];
  centerFx: CenterFx | null;
  /** 맨 위 카드가 날아오기 시작한 위치 (버린 더미 기준 px) */
  playFrom: { cardId: number; x: number; y: number } | null;
  flyMs: number;
  dealKey: number;
  dealStep: number;
  turnHint: string;
}

/** 카드마다 고정된 작은 기울기 (다시 그려도 그대로) */
function tilt(card: Card, k: number): { r: number; x: number; y: number } {
  const h = (card.id * 9301 + 49297) % 233280;
  return { r: ((h % 21) - 10) * k, x: ((h >> 3) % 9) - 4, y: ((h >> 6) % 7) - 3 };
}

function SeatFan({ cards, open, dealKey, dealStep, order, players }: { cards: Card[]; open: boolean; dealKey: number; dealStep: number; order: number; players: number }) {
  const shown = open ? sortHand(cards) : cards;
  const max = 14;
  const visible = shown.slice(0, max);
  const width = open ? 34 : 26;
  const step = visible.length > 1 ? Math.min(open ? 20 : 12, (150 - width) / (visible.length - 1)) : 0;
  return (
    <div className="lc-fan" style={{ width: width + step * Math.max(0, visible.length - 1) }}>
      {visible.map((c, i) => {
        const style = {
          left: i * step,
          '--cw': `${width}px`,
          animationDelay: `${(i * players + order) * dealStep}ms`,
        } as CSSProperties;
        return (
          <span key={`${dealKey}-${c.id}`} className={`lc-fan-card${i === visible.length - 1 ? ' lc-fan-last' : ''}`} style={style}>
            {open ? <CardFace card={c} /> : <CardBack />}
          </span>
        );
      })}
      {shown.length > max && <span className="lc-fan-more">+{shown.length - max}</span>}
    </div>
  );
}

function DirectionRing({ direction }: { direction: 1 | -1 }) {
  // 시계 방향 화살표 4개를 타원 위에 그리고, 반대 방향이면 좌우를 뒤집는다.
  const arrows = [20, 110, 200, 290];
  return (
    <svg viewBox="-200 -120 400 240" className={`lc-dir-ring ${direction === 1 ? 'lc-dir-cw' : 'lc-dir-ccw'}`} aria-hidden="true">
      <g>
        {/* 점선이 진행 방향으로 흘러간다 (ellipse는 시계 방향으로 그려진다) */}
        <ellipse className="lc-dir-flow" rx={180} ry={100} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={5} strokeDasharray="14 18" />
        {arrows.map((deg) => {
          const a = (deg * Math.PI) / 180;
          const x = 180 * Math.cos(a);
          const y = 100 * Math.sin(a);
          // 접선 방향
          const angle = (Math.atan2(100 * Math.cos(a), -180 * Math.sin(a)) * 180) / Math.PI;
          return <polygon key={deg} points="-12,-11 14,0 -12,11" transform={`translate(${x} ${y}) rotate(${angle})`} fill="rgba(255,255,255,0.45)" />;
        })}
      </g>
    </svg>
  );
}

export function Table(props: TableProps) {
  const { state, refs, openHands, canDraw, flyers, seatFx, centerFx, playFrom, flyMs, dealKey, dealStep, turnHint } = props;
  const top = topCard(state);
  const under = state.discard.slice(-4, -1);
  const color = COLOR_INFO[state.activeColor];
  const active = state.phase === 'play' || state.phase === 'drawn';
  const n = state.players.length;

  const topStyle = {
    '--r': `${tilt(top, 0.6).r}deg`,
    '--fly': `${flyMs}ms`,
    ...(playFrom && playFrom.cardId === top.id ? { '--fx': `${playFrom.x}px`, '--fy': `${playFrom.y}px` } : {}),
  } as CSSProperties;

  return (
    <div className="lc-table" ref={(el) => void (refs.current.table = el)} data-testid="lc-table">
      <DirectionRing direction={state.direction} />

      {state.players.map((p, i) => {
        const c = SEAT_COLORS[p.seat];
        const isCurrent = active && i === state.current;
        const fx = seatFx.filter((f) => f.player === i);
        const order = (i - state.starter + n) % n;
        return (
          <div
            key={p.seat}
            className={`lc-seat lc-pos-${p.seat}${isCurrent ? ' lc-seat-current' : ''}`}
            style={{ '--pc': c.main, '--pc-dark': c.dark, '--pc-light': c.light } as CSSProperties}
            ref={(el) => void (refs.current.seats[i] = el)}
            data-testid={`lc-seat-${i}`}
          >
            <div className="lc-seat-head">
              <span className="lc-avatar">{playerName(p).slice(0, 1)}</span>
              <span className="lc-seat-name">{playerName(p)}</span>
              {p.kind !== 'human' && <span className="lc-seat-tag">{p.kind === 'ai-easy' ? '컴퓨터·쉬움' : '컴퓨터'}</span>}
            </div>
            <SeatFan cards={p.hand} open={openHands} dealKey={dealKey} dealStep={dealStep} order={order} players={n} />
            <div className="lc-seat-meta">
              <span data-testid={`lc-count-${i}`}>{p.hand.length}장</span>
              {state.options.endMode === 'points' && <span>· {p.score}점</span>}
              {isCurrent && <span className="lc-seat-turn">차례</span>}
            </div>
            {p.hand.length === 1 && active && <span className="lc-last-badge">한 장!</span>}
            {fx.map((f) => (
              <span key={f.id} className={`lc-seat-fx lc-fx-${f.tone}`}>
                {f.text}
              </span>
            ))}
          </div>
        );
      })}

      <div className="lc-center">
        <div className="lc-piles">
        <button
          type="button"
          className={`lc-deck${canDraw ? ' lc-deck-ready' : ''}`}
          onClick={props.onDraw}
          disabled={!canDraw}
          ref={(el) => void (refs.current.deck = el)}
          aria-label={`카드 뽑기 (남은 카드 ${state.drawPile.length}장)`}
          data-testid="lc-deck"
        >
          {state.drawPile.length > 0 ? (
            <>
              {state.drawPile.length > 2 && <CardBack className="lc-deck-layer lc-deck-layer-2" />}
              {state.drawPile.length > 1 && <CardBack className="lc-deck-layer lc-deck-layer-1" />}
              <CardBack className="lc-deck-top" />
            </>
          ) : (
            <span className="lc-card lc-deck-empty" />
          )}
          <span className="lc-deck-label">{canDraw ? '뽑기' : `${state.drawPile.length}장`}</span>
        </button>

        <div className="lc-discard" ref={(el) => void (refs.current.discard = el)} style={{ '--active': color.main } as CSSProperties}>
          <span className="lc-discard-ring" />
          {under.map((c) => {
            const t = tilt(c, 1);
            return (
              <span key={c.id} className="lc-discard-under" style={{ transform: `translate(${t.x}px, ${t.y}px) rotate(${t.r}deg)` }}>
                <CardFace card={c} />
              </span>
            );
          })}
          <span key={`${state.round}-${top.id}`} className={`lc-discard-top${playFrom && playFrom.cardId === top.id ? ' lc-discard-fly' : ''}`} style={topStyle} data-testid="lc-top">
            <CardFace card={top} />
          </span>
          {state.pendingDraw > 0 && active && <span className="lc-stack-badge">+{state.pendingDraw}</span>}
        </div>
        </div>
        <div className="lc-color-chip" style={{ '--active': color.main, '--active-dark': color.dark } as CSSProperties} data-testid="lc-active-color">
          <ColorShapeIcon color={state.activeColor} size={20} />
          지금 색 <strong>{color.name}</strong>
          <span className="lc-dir-text">{state.direction === 1 ? '↻ 시계 방향' : '↺ 반대 방향'}</span>
        </div>
      </div>

      {turnHint && <div className="lc-table-hint">{turnHint}</div>}

      {centerFx && (
        <div key={centerFx.id} className="lc-center-fx" style={{ color: centerFx.color }}>
          {centerFx.text}
        </div>
      )}

      {flyers.map((f) => (
        <span
          key={f.id}
          className="lc-flyer"
          style={{ left: f.x, top: f.y, '--tx': `${f.tx}px`, '--ty': `${f.ty}px`, animationDelay: `${f.delay}ms`, animationDuration: `${flyMs}ms` } as CSSProperties}
        >
          <CardBack />
        </span>
      ))}
    </div>
  );
}
