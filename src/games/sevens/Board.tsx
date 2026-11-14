import { useRef, type CSSProperties } from 'react';
import { PlayingCardFace, SuitIcon } from '../../components/PlayingCard';
import { SEAT_COLORS } from '../common/players';
import { RANKS, SUITS, SUIT_INFO, cardLabel, makeCard, rankLabel, type Card } from '../common/playingCards';
import { canPlace } from './rules';
import type { SevensState } from './types';
import { useElementSize } from './useElementSize';

export type RegisterEl = (key: string) => (el: HTMLElement | null) => void;

export interface CenterFx {
  id: number;
  text: string;
  tone: 'win' | 'info' | 'out';
  delay?: number;
}

interface BoardProps {
  state: SevensState;
  reg: RegisterEl;
  /** 사람이 지금 낼 수 있는 카드 (판의 그 칸이 반짝인다) */
  playable: Card[];
  selectedId: number | null;
  onPlay: (cardId: number) => void;
  onSelect: (cardId: number | null) => void;
  /** 날아오는 중이라 아직 비워 둘 칸 (카드 id) */
  hidden: ReadonlySet<number>;
  recentIds: ReadonlySet<number>;
  centerFx: CenterFx | null;
  info: string;
}

const LABEL_W = 30;
const GAP = 5;
const PAD = 12;
const HEAD_H = 18;

export function Board({ state, reg, playable, selectedId, onPlay, onSelect, hidden, recentIds, centerFx, info }: BoardProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(boxRef);
  const byW = (width - PAD * 2 - LABEL_W - GAP * 13) / 13;
  const byH = (height - PAD * 2 - HEAD_H - GAP * 4 - 26) / 4 / 1.4;
  const cell = Math.max(15, Math.min(84, Math.floor(Math.min(byW, byH))));
  const mini = cell < 56;
  const playableIds = new Set(playable.map((c) => c.id));

  return (
    <div className="sv-board" ref={boxRef} data-testid="sv-board">
      <div className="sv-grid" style={{ '--cell': `${cell}px`, '--pc-w': `${cell}px` } as CSSProperties} role="grid" aria-label="카드 판">
        <span className="sv-corner" />
        {RANKS.map((r) => (
          <span key={r} className={`sv-col-head${r === 7 ? ' sv-col-seven' : ''}`} aria-hidden="true">
            {rankLabel(r)}
          </span>
        ))}
        {SUITS.map((suit) => (
          <div key={suit} className="sv-row" role="row">
            <span className="sv-row-head" title={SUIT_INFO[suit].name}>
              <SuitIcon suit={suit} size={Math.min(26, Math.max(16, cell * 0.36))} />
            </span>
            {RANKS.map((rank) => {
              const card = makeCard(suit, rank);
              const placed = state.board[suit][rank];
              const seven = rank === 7 ? ' sv-cell-seven' : '';
              if (placed && !hidden.has(card.id)) {
                const by = state.players[placed.by];
                return (
                  <span
                    key={rank}
                    className={`sv-cell sv-placed${placed.dumped ? ' sv-dumped' : ''}${recentIds.has(card.id) ? ' sv-recent' : ''}${seven}`}
                    ref={reg(`cell-${card.id}`)}
                    role="gridcell"
                    aria-label={`${cardLabel(card)}${placed.dumped ? ' (탈락해서 내려놓은 카드)' : ''}`}
                  >
                    <PlayingCardFace card={card} variant={mini ? 'mini' : 'full'} />
                    {placed.dumped && by && <span className="sv-dump-mark" style={{ background: SEAT_COLORS[by.seat].main }} aria-hidden="true" />}
                  </span>
                );
              }
              if (!placed && playableIds.has(card.id)) {
                return (
                  <button
                    key={rank}
                    type="button"
                    className={`sv-cell sv-slot sv-slot-play${selectedId === card.id ? ' sv-slot-sel' : ''}${seven}`}
                    onClick={() => onPlay(card.id)}
                    onMouseEnter={() => onSelect(card.id)}
                    ref={reg(`cell-${card.id}`)}
                    aria-label={`${cardLabel(card)} 내기`}
                    data-testid={`sv-slot-${card.id}`}
                  >
                    <span className="sv-ghost">
                      <PlayingCardFace card={card} variant={mini ? 'mini' : 'full'} />
                    </span>
                  </button>
                );
              }
              const open = !placed && canPlace(state.board, card) && state.phase === 'play';
              return (
                <span key={rank} className={`sv-cell sv-slot${open ? ' sv-slot-open' : ''}${seven}`} ref={reg(`cell-${card.id}`)} role="gridcell" aria-label={`${cardLabel(card)} 빈칸`}>
                  <span className="sv-slot-label">{rankLabel(rank)}</span>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {info && <p className="sv-board-info">{info}</p>}
      {centerFx && (
        <div key={centerFx.id} className={`sv-center-fx sv-cfx-${centerFx.tone}`} style={{ animationDelay: `${centerFx.delay ?? 0}ms` }}>
          {centerFx.text}
        </div>
      )}
    </div>
  );
}
