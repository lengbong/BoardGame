import { useRef, type CSSProperties, type MutableRefObject } from 'react';
import { useElementWidth } from '../../lib/useElementWidth';
import { SEAT_COLORS } from '../common/players';
import { CARD_COLORS, COLOR_INFO, sortHand } from './cards';
import { CardBack, CardFace, ColorShapeIcon } from './CardArt';
import { playerName } from './rules';
import type { TableRefs } from './Table';
import type { CardColor, LastCardState } from './types';

interface HandTrayProps {
  state: LastCardState;
  refs: MutableRefObject<TableRefs>;
  /** 아래 칸에 보여 줄 사람 (없으면 null) */
  owner: number | null;
  faceUp: boolean;
  /** 지금 이 사람이 카드를 고를 수 있는지 */
  interactive: boolean;
  /** 손패를 가리고 '카드 보기' 버튼을 보여 줄지 */
  covered: boolean;
  playableIds: ReadonlySet<number>;
  recentIds: ReadonlySet<number>;
  shakeId: number | null;
  colorPickFor: number | null;
  canDraw: boolean;
  canPass: boolean;
  canCallNow: boolean;
  dealKey: number;
  dealStep: number;
  hint: string;
  onReveal: () => void;
  onCard: (cardId: number) => void;
  onDraw: () => void;
  onPass: () => void;
  onCall: () => void;
  onPickColor: (color: CardColor) => void;
  onCancelColor: () => void;
}

const CARD_W = 86;

export function HandTray(props: HandTrayProps) {
  const { state, owner, faceUp, interactive, covered, playableIds, recentIds, shakeId, colorPickFor } = props;
  const handRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(handRef);

  if (owner === null) {
    return (
      <section className="lc-tray lc-tray-empty" ref={(el) => void (props.refs.current.tray = el)}>
        <p>{props.hint}</p>
      </section>
    );
  }

  const player = state.players[owner];
  const c = SEAT_COLORS[player.seat];
  const cards = faceUp ? sortHand(player.hand) : player.hand;
  const n = cards.length;
  const avail = Math.max(CARD_W, width - 8);
  const step = n > 1 ? Math.min(CARD_W + 8, (avail - CARD_W) / (n - 1)) : 0;
  const myTurn = owner === state.current && (state.phase === 'play' || state.phase === 'drawn');
  const showCover = covered && myTurn;

  return (
    <section
      className={`lc-tray${myTurn ? ' lc-tray-turn' : ''}`}
      style={{ '--pc': c.main, '--pc-light': c.light, '--pc-dark': c.dark } as CSSProperties}
      ref={(el) => void (props.refs.current.tray = el)}
      data-testid="lc-tray"
    >
      <header className="lc-tray-head">
        <span className="lc-avatar">{playerName(player).slice(0, 1)}</span>
        <strong>{playerName(player)}의 카드</strong>
        <span className="lc-tray-count">{n}장</span>
        <p className="lc-tray-hint" data-testid="lc-hint">
          {props.hint}
        </p>
        <div className="lc-tray-actions">
          {props.canPass ? (
            <button type="button" className="btn" onClick={props.onPass} data-testid="lc-pass">
              넘기기 <kbd>Space</kbd>
            </button>
          ) : (
            <button type="button" className="btn" onClick={props.onDraw} disabled={!props.canDraw} data-testid="lc-draw">
              {state.pendingDraw > 0 && myTurn ? `${state.pendingDraw}장 받기` : '카드 뽑기'} <kbd>Space</kbd>
            </button>
          )}
          {state.options.callRule && (
            <button
              type="button"
              className={`btn lc-call-btn${state.called && myTurn ? ' lc-called' : ''}`}
              onClick={props.onCall}
              disabled={!props.canCallNow}
              data-testid="lc-call"
            >
              📣 {state.called && myTurn ? '외쳤어요!' : '한 장!'}
            </button>
          )}
        </div>
      </header>

      <div className={`lc-hand${interactive ? ' lc-hand-active' : ''}`} ref={handRef}>
        <div className="lc-hand-row" style={{ width: n > 0 ? CARD_W + step * (n - 1) : 0 }}>
          {cards.map((card, i) => {
            const style = {
              left: i * step,
              zIndex: i + 1,
              animationDelay: `${i * props.dealStep * state.players.length}ms`,
            } as CSSProperties;
            if (!faceUp || showCover) {
              return (
                <span key={`${props.dealKey}-${card.id}`} className="lc-hand-card lc-hand-back" style={style}>
                  <CardBack />
                </span>
              );
            }
            const playable = interactive && playableIds.has(card.id);
            const cls = [
              'lc-hand-card',
              playable ? 'lc-playable' : '',
              interactive && !playable ? 'lc-dim' : '',
              recentIds.has(card.id) ? 'lc-recent' : '',
              state.phase === 'drawn' && state.drawnCardId === card.id && myTurn ? 'lc-drawn' : '',
              shakeId === card.id ? 'lc-shake' : '',
            ].join(' ');
            return (
              <button
                key={`${props.dealKey}-${card.id}`}
                type="button"
                className={cls}
                style={style}
                onClick={() => props.onCard(card.id)}
                disabled={!interactive}
                data-testid={`lc-card-${card.id}`}
              >
                <CardFace card={card} />
              </button>
            );
          })}
        </div>
      </div>

      {showCover && (
        <div className="lc-cover">
          <p>
            <strong>{playerName(player)}</strong> 차례예요. 다른 사람은 잠깐 눈을 감아 주세요! 🙈
          </p>
          <button type="button" className="btn btn-primary btn-large" onClick={props.onReveal} data-testid="lc-reveal">
            내 카드 보기 <kbd>Enter</kbd>
          </button>
        </div>
      )}

      {colorPickFor !== null && (
        <div className="lc-color-pick" role="dialog" aria-label="바꿀 색 고르기">
          <p>어떤 색으로 바꿀까요?</p>
          <div className="lc-color-buttons">
            {CARD_COLORS.map((col, i) => (
              <button
                key={col}
                type="button"
                className="lc-color-btn"
                style={{ '--active': COLOR_INFO[col].main, '--active-dark': COLOR_INFO[col].dark } as CSSProperties}
                onClick={() => props.onPickColor(col)}
                data-testid={`lc-color-${col}`}
              >
                <ColorShapeIcon color={col} size={30} />
                {COLOR_INFO[col].name}
                <kbd>{i + 1}</kbd>
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-small" onClick={props.onCancelColor}>
            취소 <kbd>Esc</kbd>
          </button>
        </div>
      )}
    </section>
  );
}
