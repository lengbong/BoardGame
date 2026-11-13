import { useRef, type CSSProperties } from 'react';
import { PlayingCardBack, PlayingCardFace } from '../../components/PlayingCard';
import { useElementWidth } from '../../lib/useElementWidth';
import { SEAT_COLORS } from '../common/players';
import { rankLabel, sortCards } from '../common/playingCards';
import { MAX_PLAY, claimText, playerName } from './rules';
import type { RegisterEl } from './Table';
import type { CheatState } from './types';

interface HandTrayProps {
  state: CheatState;
  /** 아래 칸에 손패를 보여 줄 사람 (없으면 null) */
  owner: number | null;
  faceUp: boolean;
  /** 이 사람이 지금 카드를 낼 차례이고 고를 수 있는지 */
  canPlay: boolean;
  hint: string;
  reg: RegisterEl;
  selected: ReadonlySet<number>;
  /** 키보드로 가리키는 카드 (손패에서 몇 번째) */
  cursor: number | null;
  onToggle: (cardId: number) => void;
  onSelectMatches: () => void;
  onClear: () => void;
  onPlay: () => void;
  /** 날아오는 중이라 아직 숨겨 둘 카드 */
  hidden: ReadonlySet<number>;
  /** 방금 더미에서 가져온 카드 */
  recent: ReadonlySet<number>;
  /** 앞으로 내 차례마다 낼 숫자 */
  upcoming: number[];
  dealKey: number;
  dealStep: number;
}

const CARD_W = 80;

export function HandTray(props: HandTrayProps) {
  const { state, owner, faceUp, selected, hidden, recent } = props;
  const trayRef = useRef<HTMLElement>(null);
  const width = useElementWidth(trayRef);

  if (owner === null) {
    return (
      <section className="ch-tray ch-tray-empty" ref={trayRef} data-testid="ch-tray">
        <p>{props.hint}</p>
      </section>
    );
  }

  const player = state.players[owner];
  const c = SEAT_COLORS[player.seat];
  const cards = faceUp ? sortCards(player.hand, 'rank') : player.hand;
  const n = cards.length;
  const avail = Math.max(CARD_W, width - 36);
  const step = n > 1 ? Math.min(CARD_W + 8, (avail - CARD_W) / (n - 1)) : 0;
  const order = (owner - state.first + state.players.length) % state.players.length;
  const rank = state.rank;
  const picks = cards.filter((card) => selected.has(card.id));
  const lying = picks.some((card) => card.rank !== rank);
  const matches = faceUp ? cards.filter((card) => card.rank === rank).length : 0;

  return (
    <section
      className={`ch-tray${props.canPlay ? ' ch-tray-turn' : ''}`}
      style={{ '--sc': c.main, '--sc-light': c.light, '--sc-dark': c.dark } as CSSProperties}
      ref={trayRef}
      data-testid="ch-tray"
    >
      <header className="ch-tray-head">
        <span className="ch-avatar">{playerName(player).slice(0, 1)}</span>
        <strong>{playerName(player)}의 카드</strong>
        <span className="ch-tray-count">{n}장</span>
        {faceUp && props.upcoming.length > 0 && (
          <span className="ch-upcoming" title="차례가 올 때마다 이 숫자를 내야 해요">
            내 차례마다 낼 숫자{' '}
            {props.upcoming.map((r, i) => (
              <span key={i} className="ch-up">
                {i > 0 && <i aria-hidden="true">→</i>}
                <b className={i === 0 && props.canPlay ? 'ch-up-now' : ''}>{rankLabel(r)}</b>
              </span>
            ))}
          </span>
        )}
        <p className="ch-tray-hint" data-testid="ch-hint">
          {props.hint}
        </p>
      </header>

      <div className="ch-hand" ref={props.reg('tray-hand')}>
        {n === 0 && <p className="ch-hand-empty">카드를 다 냈어요!</p>}
        <div className="ch-hand-row" style={{ width: n > 0 ? CARD_W + step * (n - 1) : 0 }}>
          {cards.map((card, i) => {
            const sel = selected.has(card.id);
            const cls = [
              'ch-hand-card',
              sel ? 'ch-sel' : '',
              props.canPlay && card.rank === rank ? 'ch-match' : '',
              props.cursor === i && props.canPlay ? 'ch-cursor' : '',
              hidden.has(card.id) ? 'ch-hidden' : '',
              faceUp && recent.has(card.id) ? 'ch-recent' : '',
            ].join(' ');
            return (
              <button
                key={`${props.dealKey}-${card.id}`}
                type="button"
                className={cls}
                style={{ left: i * step, zIndex: i + 1, animationDelay: `${(i * state.players.length + order) * props.dealStep}ms` } as CSSProperties}
                onClick={() => props.onToggle(card.id)}
                onMouseDown={(e) => e.preventDefault()}
                disabled={!props.canPlay || (!sel && selected.size >= MAX_PLAY)}
                ref={faceUp ? props.reg(`tray-${card.id}`) : undefined}
                aria-pressed={sel}
                aria-label={faceUp ? `${rankLabel(card.rank)} 카드${sel ? ' (고름)' : ''}` : '카드'}
                data-testid={`ch-card-${card.id}`}
              >
                {faceUp ? <PlayingCardFace card={card} /> : <PlayingCardBack />}
              </button>
            );
          })}
        </div>
      </div>

      {props.canPlay && (
        <footer className="ch-tray-foot">
          <button type="button" className="btn btn-small" onClick={props.onSelectMatches} onMouseDown={(e) => e.preventDefault()} disabled={matches === 0} data-testid="ch-select-matches">
            {rankLabel(rank)} 모두 고르기 <kbd>A</kbd>
          </button>
          <button type="button" className="btn btn-small" onClick={props.onClear} onMouseDown={(e) => e.preventDefault()} disabled={selected.size === 0}>
            다시 고르기
          </button>
          <span className="ch-pick-info">
            {picks.length === 0 ? `1~${MAX_PLAY}장을 골라요` : lying ? '🤫 거짓말이에요! 들키지 않게…' : '😇 진짜 카드예요'}
          </span>
          <button type="button" className="btn btn-primary ch-play-btn" onClick={props.onPlay} onMouseDown={(e) => e.preventDefault()} disabled={picks.length === 0} data-testid="ch-play">
            {picks.length === 0 ? '카드를 골라요' : `“${claimText(rank, picks.length)}” 내기`} <kbd>Enter</kbd>
          </button>
        </footer>
      )}
    </section>
  );
}
