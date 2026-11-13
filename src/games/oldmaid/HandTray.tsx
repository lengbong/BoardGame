import { useRef, type CSSProperties } from 'react';
import { PlayingCardBack, PlayingCardFace } from '../../components/PlayingCard';
import { useElementWidth } from '../../lib/useElementWidth';
import { SEAT_COLORS } from '../common/players';
import { isJoker } from '../common/playingCards';
import { playerName } from './rules';
import type { RegisterEl } from './Table';
import type { OldMaidState } from './types';

interface HandTrayProps {
  state: OldMaidState;
  /** 아래 칸에 손패를 보여 줄 사람 (없으면 null) */
  owner: number | null;
  faceUp: boolean;
  /** 지금 이 사람이 뽑을 차례인지 */
  isTurn: boolean;
  hint: string;
  reg: RegisterEl;
  /** 날아오는 중이라 아직 숨겨 둘 카드 */
  hidden: ReadonlySet<number>;
  recentId: number | null;
  /** 곧 버릴 짝 (반짝이게) */
  willPair: ReadonlySet<number>;
  /** 섞기 연출: 시작까지 기다릴 시간 (ms). 섞지 않으면 undefined */
  shuffleDelay?: number;
  canShuffle: boolean;
  onShuffle: () => void;
  /** 방금 뽑은 카드를 확인하는 중 (차례 넘김 모드) */
  confirming: boolean;
  onConfirm: () => void;
  dealKey: number;
  dealStep: number;
  flyMs: number;
}

const CARD_W = 84;

export function HandTray(props: HandTrayProps) {
  const { state, owner, faceUp, hidden, recentId, willPair } = props;
  // 손패 칸은 늘 같은 요소로 그려서 너비를 잴 수 있게 한다 (손패가 없는 화면에서 시작해도).
  const trayRef = useRef<HTMLElement>(null);
  const width = useElementWidth(trayRef);

  if (owner === null) {
    return (
      <section className="om-tray om-tray-empty" ref={trayRef} data-testid="om-tray">
        <p>{props.hint}</p>
      </section>
    );
  }

  const player = state.players[owner];
  const c = SEAT_COLORS[player.seat];
  const cards = player.hand;
  const n = cards.length;
  const avail = Math.max(CARD_W, width - 36);
  const step = n > 1 ? Math.min(CARD_W + 10, (avail - CARD_W) / (n - 1)) : 0;
  const order = (owner - state.first + state.players.length) % state.players.length;
  const hasJoker = faceUp && cards.some(isJoker);

  return (
    <section
      className={`om-tray${props.isTurn ? ' om-tray-turn' : ''}${props.shuffleDelay !== undefined ? ' om-tray-shuffle' : ''}`}
      style={{ '--sc': c.main, '--sc-light': c.light, '--sc-dark': c.dark, '--om-sd': `${props.shuffleDelay ?? 0}ms` } as CSSProperties}
      ref={trayRef}
      data-testid="om-tray"
    >
      <header className="om-tray-head">
        <span className="om-avatar">{playerName(player).slice(0, 1)}</span>
        <strong>{playerName(player)}의 카드</strong>
        <span className="om-tray-count">{n}장</span>
        {hasJoker && <span className="om-joker-tag">🤫 조커가 있어요</span>}
        <p className="om-tray-hint" data-testid="om-hint">
          {props.hint}
        </p>
        <div className="om-tray-actions">
          {faceUp && (
            <button type="button" className="btn" onClick={props.onShuffle} disabled={!props.canShuffle} data-testid="om-shuffle">
              🔀 섞기 <kbd>S</kbd>
            </button>
          )}
          {props.confirming && (
            <button type="button" className="btn btn-primary" onClick={props.onConfirm} data-testid="om-confirm">
              다 봤어요, 넘기기 <kbd>Enter</kbd>
            </button>
          )}
        </div>
      </header>

      <div className="om-hand" ref={props.reg('tray-hand')}>
        {n === 0 && <p className="om-hand-empty">{player.place > 0 ? `카드를 다 털었어요! 🎉 (${player.place}등)` : ''}</p>}
        <div className="om-hand-row" style={{ width: n > 0 ? CARD_W + step * (n - 1) : 0 }}>
          {cards.map((card, i) => {
            const cls = [
              'om-hand-card',
              hidden.has(card.id) ? 'om-hidden' : '',
              faceUp && recentId === card.id ? 'om-recent' : '',
              faceUp && willPair.has(card.id) ? 'om-will-pair' : '',
              faceUp && isJoker(card) ? 'om-hand-joker' : '',
            ].join(' ');
            return (
              <span
                key={`${props.dealKey}-${card.id}`}
                className={cls}
                style={{ left: i * step, zIndex: i + 1, '--i': i, animationDelay: `${(i * state.players.length + order) * props.dealStep + props.flyMs}ms` } as CSSProperties}
                ref={faceUp ? props.reg(`tray-${card.id}`) : undefined}
              >
                {faceUp ? <PlayingCardFace card={card} /> : <PlayingCardBack />}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
