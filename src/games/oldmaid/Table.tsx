import { useRef, type CSSProperties } from 'react';
import { PlayingCardBack, PlayingCardFace } from '../../components/PlayingCard';
import { useElementWidth } from '../../lib/useElementWidth';
import { SEAT_COLORS } from '../common/players';
import type { Card } from '../common/playingCards';
import { playerName } from './rules';
import type { OldMaidState } from './types';

export interface SeatFx {
  id: number;
  player: number;
  text: string;
  tone: 'pair' | 'out' | 'shuffle' | 'info';
}

export interface CenterFx {
  id: number;
  text: string;
  tone: 'thief' | 'joker' | 'info';
  /** 나타나기까지 기다릴 시간 (ms) */
  delay?: number;
}

export type RegisterEl = (key: string) => (el: HTMLElement | null) => void;

interface TableProps {
  state: OldMaidState;
  openHands: boolean;
  reg: RegisterEl;
  /** 지금 카드를 뽑힐 사람 (-1이면 없음) */
  target: number;
  /** 사람이 고를 수 있게 뽑을 카드를 크게 펼쳐 보여 줄지 */
  showPick: boolean;
  pickEnabled: boolean;
  sel: number | null;
  picking: number | null;
  onPick: (index: number) => void;
  onHover: (index: number | null) => void;
  seatFx: SeatFx[];
  centerFx: CenterFx | null;
  /** 손패를 섞는 사람 → 섞기 연출을 시작할 때까지 기다릴 시간 (ms) */
  shuffling: ReadonlyMap<number, number>;
  /** 날아오는 중이라 아직 더미에 안 보이게 할 장수 (맨 위부터) */
  pileHold: number;
  dealKey: number;
  dealStep: number;
  flyMs: number;
  info: string;
  /** 컴퓨터가 카드를 고르는 중 */
  thinking: boolean;
}

/** 카드마다 고정된 작은 기울기 (다시 그려도 그대로) */
export function pileTilt(card: Card, k = 1): { r: number; x: number; y: number } {
  const h = (card.id * 9301 + 49297) % 233280;
  return { r: ((h % 31) - 15) * k, x: ((h >> 3) % 13) - 6, y: ((h >> 6) % 9) - 4 };
}

const FAN_MAX = 15;

function SeatFan({ cards, open, dealKey, dealStep, flyMs, order, players }: { cards: Card[]; open: boolean; dealKey: number; dealStep: number; flyMs: number; order: number; players: number }) {
  const visible = cards.slice(0, FAN_MAX);
  const width = open ? 32 : 28;
  const step = visible.length > 1 ? Math.min(open ? 15 : 11, (160 - width) / (visible.length - 1)) : 0;
  return (
    <div className="om-fan" style={{ width: Math.max(width, width + step * (visible.length - 1)) }}>
      {visible.map((c, i) => (
        <span
          key={`${dealKey}-${i}`}
          className="om-fan-card"
          style={{ left: i * step, '--pc-w': `${width}px`, '--i': i, animationDelay: `${(i * players + order) * dealStep + flyMs}ms` } as CSSProperties}
        >
          {open ? <PlayingCardFace card={c} variant="mini" /> : <PlayingCardBack />}
        </span>
      ))}
      {cards.length > FAN_MAX && <span className="om-fan-more">+{cards.length - FAN_MAX}</span>}
    </div>
  );
}

const PICK_W = 70;

export function Table(props: TableProps) {
  const { state, openHands, reg, target, showPick, pickEnabled, sel, picking, seatFx, centerFx, shuffling, pileHold } = props;
  const tableRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(tableRef);
  const n = state.players.length;
  const active = state.phase === 'play';

  const pile = state.discard.slice(0, Math.max(0, state.discard.length - pileHold));
  const pileShown = pile.slice(-12);

  // 뽑을 카드 펼치기
  const targetHand = target >= 0 ? state.players[target].hand : [];
  const count = targetHand.length;
  const maxRow = width > 760 ? Math.min(640, width - 360) : Math.max(PICK_W, width - 40);
  const step = count > 1 ? Math.min(PICK_W * 0.82, (maxRow - PICK_W) / (count - 1)) : 0;
  const mid = (count - 1) / 2;
  const rotStep = count > 1 ? Math.min(5, 50 / count) : 0;
  const targetPlayer = target >= 0 ? state.players[target] : null;

  return (
    <div className="om-table" ref={tableRef} data-testid="om-table">
      {state.players.map((p, i) => {
        const c = SEAT_COLORS[p.seat];
        const isCurrent = active && i === state.current;
        const isTarget = active && i === target;
        const out = p.hand.length === 0 && state.phase !== 'deal';
        const fx = seatFx.filter((f) => f.player === i);
        const order = (i - state.first + n) % n;
        const cls = [
          'om-seat',
          `om-pos-${p.seat}`,
          isCurrent ? 'om-seat-current' : '',
          isTarget ? 'om-seat-target' : '',
          isTarget && props.thinking ? 'om-seat-thinking' : '',
          out ? 'om-seat-out' : '',
          shuffling.has(i) ? 'om-seat-shuffle' : '',
          state.thief === i ? 'om-seat-thief' : '',
        ].join(' ');
        return (
          <div
            key={p.seat}
            className={cls}
            style={{ '--sc': c.main, '--sc-dark': c.dark, '--sc-light': c.light, '--om-sd': `${shuffling.get(i) ?? 0}ms` } as CSSProperties}
            data-testid={`om-seat-${i}`}
          >
            <div className="om-seat-head">
              <span className="om-avatar">{playerName(p).slice(0, 1)}</span>
              <span className="om-seat-name">{playerName(p)}</span>
              {p.kind !== 'human' && <span className="om-seat-tag">{p.kind === 'ai-easy' ? '컴퓨터·쉬움' : '컴퓨터'}</span>}
            </div>
            <div className="om-fan-wrap" ref={reg(`seat-${i}`)}>
              {out ? (
                <span className="om-seat-done">{state.thief === i ? '🃏' : p.place > 0 ? `${p.place}등` : ''}</span>
              ) : (
                <SeatFan cards={p.hand} open={openHands} dealKey={props.dealKey} dealStep={props.dealStep} flyMs={props.flyMs} order={order} players={n} />
              )}
            </div>
            <div className="om-seat-meta">
              <span data-testid={`om-count-${i}`}>{out ? (state.thief === i ? '도둑!' : '다 털었어요') : `${p.hand.length}장`}</span>
              {isCurrent && <span className="om-seat-badge">뽑는 차례</span>}
              {isTarget && <span className="om-seat-badge om-badge-target">뽑히는 중</span>}
            </div>
            {fx.map((f) => (
              <span key={f.id} className={`om-seat-fx om-fx-${f.tone}`}>
                {f.text}
              </span>
            ))}
          </div>
        );
      })}

      <div className="om-pile" aria-label={`버린 짝 ${Math.floor(pile.length / 2)}쌍`}>
        <span className="om-pile-label">버린 짝 {Math.floor(pile.length / 2)}쌍</span>
        <div className="om-pile-cards" ref={reg('pile')}>
          {pileShown.length === 0 && <span className="om-pile-empty" />}
          {pileShown.map((c) => {
            const t = pileTilt(c);
            return (
              <span key={c.id} className="om-pile-card" style={{ transform: `translate(${t.x}px, ${t.y}px) rotate(${t.r}deg)` }}>
                <PlayingCardFace card={c} />
              </span>
            );
          })}
        </div>
      </div>

      <div className="om-center" ref={reg('center')}>
        {showPick && targetPlayer ? (
          <div className={`om-pick${pickEnabled ? ' om-pick-on' : ''}`} role="group" aria-label={`${playerName(targetPlayer)}의 카드에서 한 장 뽑기`} data-testid="om-pick">
            <div className="om-pick-head" style={{ '--sc': SEAT_COLORS[targetPlayer.seat].main } as CSSProperties}>
              <span className="om-avatar">{playerName(targetPlayer).slice(0, 1)}</span>
              <span>
                <strong>{playerName(targetPlayer)}</strong>의 카드 {count}장
              </span>
            </div>
            <div className="om-pick-row" style={{ width: PICK_W + step * Math.max(0, count - 1), '--pc-w': `${PICK_W}px` } as CSSProperties} onMouseLeave={() => props.onHover(null)}>
              {targetHand.map((c, i) => {
                const off = mid > 0 ? (i - mid) / mid : 0;
                const cls = ['om-pick-card', sel === i ? 'om-pick-sel' : '', picking === i ? 'om-pick-chosen' : '', picking !== null && picking !== i ? 'om-pick-faded' : ''].join(' ');
                return (
                  <button
                    key={i}
                    type="button"
                    className={cls}
                    style={{ left: i * step, zIndex: picking === i ? 60 : i + 1, '--rot': `${(i - mid) * rotStep}deg`, '--arc': `${off * off * 14}px` } as CSSProperties}
                    onClick={() => props.onPick(i)}
                    onMouseEnter={() => props.onHover(i)}
                    onFocus={() => props.onHover(i)}
                    disabled={!pickEnabled}
                    ref={reg(`pick-${i}`)}
                    aria-label={`${i + 1}번째 카드 뽑기`}
                    data-testid={`om-pick-${i}`}
                  >
                    {openHands ? <PlayingCardFace card={c} /> : <PlayingCardBack />}
                    {i < 9 && <span className="om-pick-num">{i + 1}</span>}
                  </button>
                );
              })}
            </div>
            <p className="om-pick-keys">
              카드를 눌러 뽑아요 · <kbd>←</kbd>
              <kbd>→</kbd> 고르기 · <kbd>Space</kbd> 뽑기
            </p>
          </div>
        ) : (
          props.info && (
            <div className="om-center-info" data-testid="om-center-info">
              {props.info}
            </div>
          )
        )}
      </div>

      {centerFx && (
        <div key={centerFx.id} className={`om-center-fx om-cfx-${centerFx.tone}`} style={{ animationDelay: `${centerFx.delay ?? 0}ms` }}>
          {centerFx.text}
        </div>
      )}
    </div>
  );
}
