import { useRef, type CSSProperties } from 'react';
import { PlayingCardBack, PlayingCardFace } from '../../components/PlayingCard';
import { useElementWidth } from '../../lib/useElementWidth';
import { SEAT_COLORS } from '../common/players';
import { cardLabel } from '../common/playingCards';
import type { RegisterEl } from './Board';
import { MAX_PASSES, playerName } from './rules';
import type { SevensState } from './types';

interface HandTrayProps {
  state: SevensState;
  owner: number | null;
  faceUp: boolean;
  /** 지금 이 사람이 카드를 고를 수 있는지 */
  interactive: boolean;
  isTurn: boolean;
  playableIds: ReadonlySet<number>;
  selectedId: number | null;
  shakeId: number | null;
  hint: string;
  reg: RegisterEl;
  canPass: boolean;
  /** 통과하면 탈락하는지 */
  passEliminates: boolean;
  onCard: (cardId: number) => void;
  onSelect: (cardId: number | null) => void;
  onPass: () => void;
  dealKey: number;
  dealStep: number;
  flyMs: number;
}

const CARD_W = 76;
const SUIT_GAP = 10;

export function HandTray(props: HandTrayProps) {
  const { state, owner, faceUp, interactive, playableIds, selectedId, shakeId } = props;
  // 손패 칸은 늘 같은 요소로 그려서 너비를 잴 수 있게 한다.
  const trayRef = useRef<HTMLElement>(null);
  const width = useElementWidth(trayRef);

  if (owner === null) {
    return (
      <section className="sv-tray sv-tray-empty" ref={trayRef} data-testid="sv-tray">
        <p>{props.hint}</p>
      </section>
    );
  }

  const player = state.players[owner];
  const c = SEAT_COLORS[player.seat];
  const cards = player.hand;
  const n = cards.length;
  // 무늬가 바뀌는 곳에 조금 틈을 둔다.
  const breaks = faceUp ? cards.reduce((k, card, i) => (i > 0 && card.suit !== cards[i - 1].suit ? k + 1 : k), 0) : 0;
  const avail = Math.max(CARD_W, width - 36 - breaks * SUIT_GAP);
  const step = n > 1 ? Math.min(CARD_W + 6, (avail - CARD_W) / (n - 1)) : 0;
  let offset = 0;
  const lefts = cards.map((card, i) => {
    if (faceUp && i > 0 && card.suit !== cards[i - 1].suit) offset += SUIT_GAP;
    return i * step + offset;
  });
  const rowW = n > 0 ? lefts[n - 1] + CARD_W : 0;
  const order = (owner - state.dealer + state.players.length) % state.players.length;
  const left = state.options.passLimit ? MAX_PASSES - player.passes : null;

  return (
    <section
      className={`sv-tray${props.isTurn ? ' sv-tray-turn' : ''}`}
      style={{ '--sc': c.main, '--sc-light': c.light, '--sc-dark': c.dark } as CSSProperties}
      ref={trayRef}
      data-testid="sv-tray"
    >
      <header className="sv-tray-head">
        <span className="sv-avatar">{playerName(player).slice(0, 1)}</span>
        <strong>{playerName(player)}의 카드</strong>
        <span className="sv-tray-count">{n}장</span>
        <p className="sv-tray-hint" data-testid="sv-hint">
          {props.hint}
        </p>
        <div className="sv-tray-actions">
          {left !== null && player.status === 'playing' && (
            <span className="sv-pass-left" title="남은 통과">
              남은 통과 <strong>{Math.max(0, left)}</strong>
            </span>
          )}
          <button
            type="button"
            className={`btn${props.canPass ? (props.passEliminates ? ' sv-pass-danger' : ' sv-pass-ready') : ''}`}
            onClick={props.onPass}
            disabled={!props.canPass}
            data-testid="sv-pass"
          >
            {props.canPass && props.passEliminates ? '탈락… 카드 내려놓기' : '통과'} <kbd>Space</kbd>
          </button>
        </div>
      </header>

      <div className="sv-hand" ref={props.reg('tray-hand')} onMouseLeave={() => props.onSelect(null)}>
        {n === 0 && <p className="sv-hand-empty">{player.status === 'finished' ? '카드를 다 냈어요! 🎉' : player.status === 'out' ? '탈락했어요. 다음 판을 기다려요.' : ''}</p>}
        <div className="sv-hand-row" style={{ width: rowW }}>
          {cards.map((card, i) => {
            const style = {
              left: lefts[i],
              zIndex: i + 1,
              animationDelay: `${(i * state.players.length + order) * props.dealStep + props.flyMs}ms`,
            } as CSSProperties;
            if (!faceUp) {
              return (
                <span key={`${props.dealKey}-${i}`} className="sv-hand-card" style={style}>
                  <PlayingCardBack />
                </span>
              );
            }
            const playable = interactive && playableIds.has(card.id);
            const cls = [
              'sv-hand-card',
              playable ? 'sv-playable' : '',
              interactive && !playable ? 'sv-dim' : '',
              selectedId === card.id && playable ? 'sv-selected' : '',
              shakeId === card.id ? 'sv-shake' : '',
            ].join(' ');
            return (
              <button
                key={`${props.dealKey}-${card.id}`}
                type="button"
                className={cls}
                style={style}
                onClick={() => props.onCard(card.id)}
                onMouseEnter={() => playable && props.onSelect(card.id)}
                disabled={!interactive}
                ref={props.reg(`hand-${card.id}`)}
                aria-label={`${cardLabel(card)}${playable ? ' (낼 수 있어요)' : ''}`}
                data-testid={`sv-card-${card.id}`}
              >
                <PlayingCardFace card={card} />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

