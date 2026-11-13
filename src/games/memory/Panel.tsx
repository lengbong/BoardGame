import type { CSSProperties, MutableRefObject, ReactNode } from 'react';
import { GameControls } from '../../components/GameControls';
import { ShapeIcon, type ShapeKind } from '../../components/shapes';
import type { GameSettings } from '../common/settings';
import { KIND_LABEL, SEAT_COLORS, type SeatIndex } from '../common/players';
import { Picture } from './CardArt';
import { playerName, remainingPairs, totalPairs, winners } from './rules';
import { pictureInfo, pictureName } from './themes';
import type { MemoryState } from './types';

/** 자리마다 색과 함께 붙이는 모양 (색을 구별하기 어려워도 알아볼 수 있게) */
export const SEAT_SHAPES: Record<SeatIndex, ShapeKind> = { 0: 'circle', 1: 'leaf', 2: 'star', 3: 'diamond' };

/** 모은 짝을 작은 카드로 겹쳐 쌓아 보여 준다. */
export function MiniPile({ pics, max = 6, className = '' }: { pics: string[]; max?: number; className?: string }) {
  const shown = pics.slice(-max);
  return (
    <span className={`mm-pile ${className}`}>
      {shown.length === 0 && <span className="mm-pile-empty" />}
      {shown.map((pic, i) => (
        <span key={`${pic}-${i}`} className="mm-mini" style={{ '--k': i, background: pictureInfo(pic)?.theme.tint } as CSSProperties} title={pictureName(pic)}>
          <Picture pic={pic} />
        </span>
      ))}
    </span>
  );
}

interface PanelProps {
  state: MemoryState;
  hint: ReactNode;
  /** 아직 날아오는 중이라 더미에 안 보이는 짝 수 (사람마다) */
  pileLag: number[];
  pileRefs: MutableRefObject<Record<number, HTMLElement | null>>;
  bump: Record<number, number>;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onNewGame: () => void;
  onExit: () => void;
}

export function Panel({ state, hint, pileLag, pileRefs, bump, settings, onSettings, onNewGame, onExit }: PanelProps) {
  const over = state.phase === 'gameover';
  const current = state.players[state.current];
  const top = over ? winners(state) : [];
  const shown = over ? state.players[top[0]] : current;
  const color = SEAT_COLORS[shown.seat];
  const recent = state.log.slice(-10).reverse();
  const left = remainingPairs(state);

  return (
    <aside className="panel mm-panel">
      <section className="turn-card" style={{ borderColor: color.main, background: color.light }}>
        <div className="turn-title">
          <span className="dot" style={{ background: color.main }} />
          <strong data-testid="mm-turn-name">{over && top.length > 1 ? '공동 우승' : playerName(shown)}</strong>
          <span>{over ? (top.length > 1 ? '' : '우승') : state.phase === 'peek' ? '먼저 시작' : '차례'}</span>
          {!over && current.kind !== 'human' && <span className="tag">컴퓨터</span>}
        </div>
        <p className="mm-turn-info">
          남은 짝 <strong>{left}</strong> / {totalPairs(state)}
          {!over && state.streak > 0 && <span className="mm-streak">연속 {state.streak}짝!</span>}
        </p>
        <p className="hint">{hint}</p>
      </section>

      <section className="players">
        <h2>플레이어</h2>
        <ul>
          {state.players.map((p, i) => {
            const c = SEAT_COLORS[p.seat];
            const lag = pileLag[i] ?? 0;
            const pics = p.pairs.slice(0, p.pairs.length - lag);
            const active = !over && i === state.current;
            return (
              <li key={p.seat} className={`mm-player${active ? ' is-current' : ''}`} style={{ '--pc': c.main } as CSSProperties}>
                <ShapeIcon shape={SEAT_SHAPES[p.seat]} color={c.main} size={16} className="mm-player-shape" />
                <span className="mm-player-text">
                  <span className="player-name">{playerName(p)}</span>
                  <span className="player-kind">{KIND_LABEL[p.kind]}</span>
                </span>
                <span className="mm-player-pile" ref={(el) => void (pileRefs.current[i] = el)}>
                  <MiniPile pics={pics} key={bump[i] ?? 0} className={bump[i] ? 'is-bump' : ''} />
                </span>
                <span className="mm-pair-count" aria-label={`짝 ${pics.length}개`}>
                  {pics.length}
                  <small>짝</small>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="log">
        <h2>진행 기록</h2>
        <ol>
          {recent.map((e) => (
            <li key={e.id}>
              {e.seat !== null && <span className="dot small" style={{ background: SEAT_COLORS[e.seat].main }} />}
              {e.text}
            </li>
          ))}
        </ol>
      </section>

      <GameControls settings={settings} onSettings={onSettings} onNewGame={onNewGame} onExit={onExit} />
    </aside>
  );
}
