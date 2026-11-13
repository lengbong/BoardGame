import type { CSSProperties, ReactNode } from 'react';
import { FlipCard, PlayingCardBack, PlayingCardFace } from '../../components/PlayingCard';
import { SEAT_COLORS } from '../common/players';
import { rankLabel, type Card } from '../common/playingCards';
import { claimText, playerName } from './rules';
import type { CheatState } from './types';

export interface SeatFx {
  id: number;
  player: number;
  text: string;
  tone: 'claim' | 'pass' | 'doubt' | 'caught' | 'truth' | 'win';
}

export interface CenterFx {
  id: number;
  text: string;
  tone: 'lie' | 'truth' | 'win' | 'info';
}

/** 의심받아 뒤집는 카드: flipped가 되면 앞면으로 뒤집히고 맞는지(✓/✗)가 보인다 */
export interface RevealFx {
  id: number;
  cards: Card[];
  rank: number;
  lie: boolean;
  flipped: boolean;
}

export type RegisterEl = (key: string) => (el: HTMLElement | null) => void;

interface TableProps {
  state: CheatState;
  openHands: boolean;
  reg: RegisterEl;
  seatFx: SeatFx[];
  centerFx: CenterFx | null;
  reveal: RevealFx | null;
  /** 가운데 상자에 보여 줄 것 (사람이 의심할지 고르는 칸 등) */
  box: ReactNode;
  /** 더미에 보여 줄 장수 (날아가는 중인 카드 때문에 실제와 다를 수 있다) */
  pileCount: number;
  /** 지금 정하는 사람 (-1이면 없음) */
  actor: number;
  thinking: boolean;
  dealKey: number;
  dealStep: number;
}

const FAN_MAX = 13;

function SeatFan({ cards, open, dealKey, dealStep, order, players }: { cards: Card[]; open: boolean; dealKey: number; dealStep: number; order: number; players: number }) {
  const visible = cards.slice(0, FAN_MAX);
  const width = open ? 32 : 28;
  const step = visible.length > 1 ? Math.min(open ? 15 : 9, (150 - width) / (visible.length - 1)) : 0;
  return (
    <div className="ch-fan" style={{ width: Math.max(width, width + step * (visible.length - 1)) }}>
      {visible.map((c, i) => (
        <span key={`${dealKey}-${i}`} className="ch-fan-card" style={{ left: i * step, '--pc-w': `${width}px`, '--i': i, animationDelay: `${(i * players + order) * dealStep}ms` } as CSSProperties}>
          {open ? <PlayingCardFace card={c} variant="mini" /> : <PlayingCardBack />}
        </span>
      ))}
      {cards.length > FAN_MAX && <span className="ch-fan-more">+{cards.length - FAN_MAX}</span>}
    </div>
  );
}

/** 더미: 뒷면 카드를 조금씩 비뚤게 쌓는다 */
function Pile({ count, claimCount, reg }: { count: number; claimCount: number; reg: RegisterEl }) {
  const shown = Math.min(count, 12);
  const claimShown = Math.min(claimCount, shown);
  return (
    <div className="ch-pile" aria-label={`더미 ${count}장`}>
      <div className="ch-pile-stack" ref={reg('pile')}>
        {count === 0 && <span className="ch-pile-empty">비어 있어요</span>}
        {Array.from({ length: shown }, (_, i) => {
          const k = count - shown + i;
          const r = ((k * 37) % 23) - 11;
          const x = ((k * 13) % 9) - 4;
          const top = i >= shown - claimShown;
          return (
            <span
              key={k}
              className={`ch-pile-card${top ? ' ch-pile-claim' : ''}`}
              style={{ transform: `translate(${x + (top ? (i - (shown - claimShown)) * 12 + 14 : 0)}px, ${top ? -10 : -i * 0.6}px) rotate(${top ? r / 3 : r}deg)` }}
            >
              <PlayingCardBack />
            </span>
          );
        })}
      </div>
      <span className="ch-pile-count" data-testid="ch-pile-count">
        더미 {count}장
      </span>
    </div>
  );
}

export function Table(props: TableProps) {
  const { state, openHands, reg, seatFx, centerFx, reveal } = props;
  const n = state.players.length;
  const claim = state.phase === 'doubt' ? state.claim : null;

  return (
    <div className="ch-table" data-testid="ch-table">
      {state.players.map((p, i) => {
        const c = SEAT_COLORS[p.seat];
        const isCurrent = state.phase !== 'gameover' && i === state.current;
        const isActor = i === props.actor;
        const fx = seatFx.filter((f) => f.player === i);
        const order = (i - state.first + n) % n;
        const cls = [
          'ch-seat',
          `ch-pos-${p.seat}`,
          isCurrent && state.phase === 'play' ? 'ch-seat-current' : '',
          claim && claim.player === i ? 'ch-seat-claimant' : '',
          isActor && state.phase === 'doubt' ? 'ch-seat-judge' : '',
          isActor && props.thinking ? 'ch-seat-thinking' : '',
          state.winner === i ? 'ch-seat-winner' : '',
        ].join(' ');
        return (
          <div key={p.seat} className={cls} style={{ '--sc': c.main, '--sc-dark': c.dark, '--sc-light': c.light } as CSSProperties} data-testid={`ch-seat-${i}`}>
            <div className="ch-seat-head">
              <span className="ch-avatar">{playerName(p).slice(0, 1)}</span>
              <span className="ch-seat-name">{playerName(p)}</span>
              {p.kind !== 'human' && <span className="ch-seat-tag">{p.kind === 'ai-easy' ? '컴퓨터·쉬움' : '컴퓨터'}</span>}
            </div>
            <div className="ch-fan-wrap" ref={reg(`seat-${i}`)}>
              {p.hand.length === 0 ? (
                <span className="ch-seat-done">{state.winner === i ? '🏆' : '0장'}</span>
              ) : (
                <SeatFan cards={p.hand} open={openHands} dealKey={props.dealKey} dealStep={props.dealStep} order={order} players={n} />
              )}
            </div>
            <div className="ch-seat-meta">
              <span data-testid={`ch-count-${i}`}>{p.hand.length}장</span>
              {isCurrent && state.phase === 'play' && <span className="ch-seat-badge">{rankLabel(state.rank)} 낼 차례</span>}
              {isActor && state.phase === 'doubt' && <span className="ch-seat-badge ch-badge-judge">의심할까?</span>}
            </div>
            {fx.map((f) => (
              <span key={f.id} className={`ch-bubble ch-bubble-${f.tone}`}>
                {f.text}
              </span>
            ))}
          </div>
        );
      })}

      <ol className="ch-ranks" aria-label="내는 숫자 순서">
        {Array.from({ length: 13 }, (_, k) => {
          const r = k + 1;
          const cls = [claim && claim.rank === r ? 'ch-rank-claim' : '', state.phase === 'play' && state.rank === r ? 'ch-rank-now' : '', claim && state.rank === r ? 'ch-rank-next' : ''].join(' ');
          return (
            <li key={r} className={cls}>
              {rankLabel(r)}
            </li>
          );
        })}
      </ol>
      <div className="ch-center" ref={reg('center')}>
        <div className="ch-sign" data-testid="ch-sign">
          {claim ? (
            <>
              <span className="ch-sign-who" style={{ background: SEAT_COLORS[state.players[claim.player].seat].main }}>
                {playerName(state.players[claim.player])}
              </span>
              <b>“{claimText(claim.rank, claim.count)}”</b>
            </>
          ) : state.phase === 'play' ? (
            <>
              지금 낼 숫자 <b className="ch-sign-rank">{rankLabel(state.rank)}</b>
            </>
          ) : (
            <b>게임 끝!</b>
          )}
        </div>
        <Pile count={props.pileCount} claimCount={claim ? claim.count : 0} reg={reg} />
        <div className="ch-box">
          {reveal ? (
            <div className={`ch-reveal${reveal.flipped ? (reveal.lie ? ' ch-reveal-lie' : ' ch-reveal-truth') : ''}`} data-testid="ch-reveal">
              <div className="ch-reveal-cards">
                {reveal.cards.map((card, i) => (
                  <span key={card.id} className="ch-reveal-card" style={{ '--i': i } as CSSProperties}>
                    <FlipCard card={card} faceUp={reveal.flipped} />
                    {reveal.flipped && <i className={card.rank === reveal.rank ? 'ch-mark-ok' : 'ch-mark-no'}>{card.rank === reveal.rank ? '✓' : '✗'}</i>}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            props.box
          )}
        </div>
      </div>

      {centerFx && (
        <div key={centerFx.id} className={`ch-center-fx ch-cfx-${centerFx.tone}`}>
          {centerFx.text}
        </div>
      )}
    </div>
  );
}
