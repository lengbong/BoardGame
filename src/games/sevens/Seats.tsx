import type { CSSProperties } from 'react';
import { PlayingCardBack, PlayingCardFace } from '../../components/PlayingCard';
import { SEAT_COLORS } from '../common/players';
import { MAX_PASSES, playerName } from './rules';
import type { RegisterEl } from './Board';
import type { SevensState } from './types';

export interface SeatFx {
  id: number;
  player: number;
  text: string;
  tone: 'pass' | 'finish' | 'out' | 'info';
}

interface SeatsProps {
  state: SevensState;
  reg: RegisterEl;
  openHands: boolean;
  seatFx: SeatFx[];
  thinking: boolean;
  dealKey: number;
  dealStep: number;
  flyMs: number;
}

const FAN_MAX = 13;

/** 위쪽 자리 줄: 사람마다 이름, 남은 카드, 통과 횟수 */
export function Seats({ state, reg, openHands, seatFx, thinking, dealKey, dealStep, flyMs }: SeatsProps) {
  const active = state.phase === 'play';
  const n = state.players.length;
  const points = state.options.endMode === 'points';
  return (
    <div className="sv-seats" style={{ '--n': n } as CSSProperties}>
      {state.players.map((p, i) => {
        const c = SEAT_COLORS[p.seat];
        const isCurrent = active && i === state.current;
        const place = state.finishOrder.indexOf(i) + 1;
        const cards = p.hand.slice(0, openHands ? 26 : FAN_MAX);
        const w = openHands ? 22 : 20;
        const maxW = 150;
        const step = cards.length > 1 ? Math.min(openHands ? 13 : 9, (maxW - w) / (cards.length - 1)) : 0;
        const order = (i - state.dealer + n) % n;
        const fx = seatFx.filter((f) => f.player === i);
        return (
          <div
            key={p.seat}
            className={`sv-seat${isCurrent ? ' sv-seat-current' : ''}${isCurrent && thinking ? ' sv-seat-thinking' : ''} sv-status-${p.status}`}
            style={{ '--sc': c.main, '--sc-light': c.light, '--sc-dark': c.dark } as CSSProperties}
            ref={reg(`seat-${i}`)}
            data-testid={`sv-seat-${i}`}
          >
            <div className="sv-seat-top">
              <span className="sv-avatar">{playerName(p).slice(0, 1)}</span>
              <span className="sv-seat-name">{playerName(p)}</span>
              {p.kind !== 'human' && <span className="sv-seat-tag">{p.kind === 'ai-easy' ? '쉬움' : '컴퓨터'}</span>}
              {points && <span className="sv-seat-score">{p.score}점</span>}
            </div>
            <div className="sv-seat-bottom">
              <span className="sv-seat-count" data-testid={`sv-count-${i}`}>
                {p.status === 'finished' ? `🎉 ${place}등` : p.status === 'out' ? '탈락' : `${p.hand.length}장`}
              </span>
              {state.options.passLimit && (
                <span className="sv-pass-dots" title={`통과 ${p.passes}/${MAX_PASSES}`} aria-label={`통과 ${p.passes}번 / ${MAX_PASSES}번`}>
                  {Array.from({ length: MAX_PASSES }, (_, k) => (
                    <span key={k} className={k < p.passes ? 'sv-dot-used' : ''} />
                  ))}
                </span>
              )}
              <span className="sv-seat-fan" style={{ width: cards.length ? w + step * (cards.length - 1) : 0, '--pc-w': `${w}px` } as CSSProperties}>
                {cards.map((card, k) => (
                  <span
                    key={`${dealKey}-${openHands ? card.id : k}`}
                    className="sv-fan-card"
                    style={{ left: k * step, '--i': k, animationDelay: `${(k * n + order) * dealStep + flyMs}ms` } as CSSProperties}
                  >
                    {openHands ? <PlayingCardFace card={card} variant="mini" /> : <PlayingCardBack />}
                  </span>
                ))}
              </span>
            </div>
            {fx.map((f) => (
              <span key={f.id} className={`sv-seat-fx sv-fx-${f.tone}`}>
                {f.text}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
