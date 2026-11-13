import type { CSSProperties, MutableRefObject } from 'react';
import { SEAT_COLORS } from '../common/players';
import { DominoBack, DominoFace } from './DominoArt';
import { sortHand } from './dominoes';
import { playerName } from './rules';
import type { DominoState } from './types';

export interface SeatFx {
  id: number;
  player: number;
  text: string;
  tone: 'draw' | 'pass' | 'win';
}

interface SeatStripProps {
  state: DominoState;
  /** 패를 앞면으로 보여 줄지 (모두 공개, 또는 판이 끝났을 때) */
  showFaces: boolean;
  /** 아래 손패 칸에 패가 펼쳐진 사람 */
  owner: number | null;
  pipColors: boolean;
  seatRefs: MutableRefObject<Record<number, HTMLElement | null>>;
  boneyardRef: MutableRefObject<HTMLElement | null>;
  canDraw: boolean;
  onDraw: () => void;
  seatFx: SeatFx[];
  dealKey: number;
  dealStep: number;
}

const MAX_SHOWN = 12;

export function SeatStrip(props: SeatStripProps) {
  const { state, showFaces, owner, pipColors, seatFx, dealKey, dealStep } = props;
  const active = state.phase === 'play';
  const n = state.players.length;
  const bones = state.boneyard.length;
  const block = state.options.blockRule;

  return (
    <div className="dm-strip">
      {state.players.map((p, i) => {
        const c = SEAT_COLORS[p.seat];
        const current = active && i === state.current;
        const tiles = showFaces ? sortHand(p.hand) : p.hand;
        const shown = tiles.slice(0, MAX_SHOWN);
        const fx = seatFx.filter((f) => f.player === i);
        return (
          <div
            key={p.seat}
            className={`dm-seat${current ? ' dm-seat-current' : ''}`}
            style={{ '--pc': c.main, '--pc-dark': c.dark, '--pc-light': c.light } as CSSProperties}
            ref={(el) => void (props.seatRefs.current[i] = el)}
            data-testid={`dm-seat-${i}`}
          >
            <div className="dm-seat-head">
              <span className="dm-avatar" aria-hidden="true">
                {playerName(p).slice(0, 1)}
              </span>
              <span className="dm-seat-name">{playerName(p)}</span>
              {p.kind !== 'human' && <span className="dm-seat-tag">{p.kind === 'ai-easy' ? '컴퓨터·쉬움' : '컴퓨터'}</span>}
              {current && <span className="dm-seat-turn">차례</span>}
            </div>
            <div className="dm-seat-body">
              <span className={`dm-seat-tiles${showFaces ? ' dm-seat-faces' : ''}`} aria-label={`${playerName(p)}: 패 ${p.hand.length}개`}>
                {shown.map((t, k) => (
                  <span key={`${dealKey}-${t.id}`} className="dm-mini" style={{ animationDelay: `${(k * n + i) * dealStep}ms` }}>
                    {showFaces ? <DominoFace a={t.a} b={t.b} vertical colors={pipColors} /> : <DominoBack />}
                  </span>
                ))}
                {tiles.length > MAX_SHOWN && <span className="dm-seat-more">+{tiles.length - MAX_SHOWN}</span>}
                {tiles.length === 0 && <span className="dm-seat-empty">다 냈어요!</span>}
              </span>
              <span className="dm-seat-meta">
                <strong data-testid={`dm-count-${i}`}>{p.hand.length}</strong>개
                {state.options.endMode === 'points' && <span className="dm-seat-score">{p.score}점</span>}
              </span>
            </div>
            {i === owner && active && <span className="dm-seat-mine">아래 칸 ↓</span>}
            {fx.map((f) => (
              <span key={f.id} className={`dm-seat-fx dm-fx-${f.tone}`}>
                {f.text}
              </span>
            ))}
          </div>
        );
      })}

      <button
        type="button"
        className={`dm-boneyard${props.canDraw ? ' dm-boneyard-ready' : ''}${block ? ' dm-boneyard-block' : ''}`}
        ref={(el) => void (props.boneyardRef.current = el)}
        onClick={props.onDraw}
        onMouseDown={(e) => e.preventDefault()}
        disabled={!props.canDraw}
        aria-label={`뽑는 더미 ${bones}개${props.canDraw ? ' — 눌러서 뽑기' : ''}`}
        data-testid="dm-boneyard"
      >
        <span className="dm-bone-pile" aria-hidden="true">
          {bones === 0 ? (
            <span className="dm-bone-empty" />
          ) : (
            Array.from({ length: Math.min(3, bones) }, (_, k) => (
              <span key={k} className="dm-bone" style={{ '--k': k } as CSSProperties}>
                <DominoBack vertical={false} />
              </span>
            ))
          )}
        </span>
        <span className="dm-bone-label">
          뽑는 더미 <strong data-testid="dm-boneyard-count">{bones}</strong>개
        </span>
        <span className="dm-bone-sub">
          {props.canDraw ? (
            <>
              뽑기 <kbd>D</kbd>
            </>
          ) : block ? (
            '블록 규칙: 안 뽑아요'
          ) : bones === 0 ? (
            '다 뽑았어요'
          ) : (
            '낼 패가 없을 때 뽑아요'
          )}
        </span>
      </button>
    </div>
  );
}
