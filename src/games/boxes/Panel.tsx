import type { CSSProperties, ReactNode } from 'react';
import { GameControls } from '../../components/GameControls';
import { ShapeIcon } from '../../components/shapes';
import { KIND_LABEL, SEAT_COLORS } from '../common/players';
import type { GameSettings } from '../common/settings';
import { PENS } from './art';
import { playerName } from './rules';
import type { BoxesState } from './types';

interface PanelProps {
  state: BoxesState;
  hint: ReactNode;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onNewGame: () => void;
  onExit: () => void;
}

export function Panel({ state, hint, settings, onSettings, onNewGame, onExit }: PanelProps) {
  const active = state.phase === 'play';
  const current = state.players[state.current];
  const color = SEAT_COLORS[current.seat];
  const total = state.size * state.size;
  const left = state.boxes.filter((o) => o === -1).length;
  const recent = state.log.slice(-12).reverse();
  const topScore = Math.max(...state.players.map((p) => p.score));

  return (
    <aside className="panel bx-panel">
      <section className="turn-card" style={{ borderColor: color.main, background: color.light }} aria-live="polite">
        <div className="turn-title">
          <ShapeIcon shape={PENS[current.seat].shape} color={color.main} size={18} />
          <strong data-testid="bx-turn-name">{active ? playerName(current) : '게임 끝'}</strong>
          {active && <span>차례</span>}
          {active && current.kind !== 'human' && <span className="tag">컴퓨터</span>}
        </div>
        <p className="bx-round-info">
          {state.size}×{state.size} 판 · 남은 상자 {left}/{total}
          {state.options.noExtraTurn ? ' · 간단 규칙' : ''}
        </p>
        <p className="hint">{hint}</p>
      </section>

      <section className="players">
        <h2>상자 모으기</h2>
        <ul>
          {state.players.map((p, i) => {
            const c = SEAT_COLORS[p.seat];
            const lead = p.score > 0 && p.score === topScore;
            return (
              <li key={p.seat} className={i === state.current && active ? 'is-current' : ''}>
                <ShapeIcon shape={PENS[p.seat].shape} color={c.main} size={14} />
                <span className="bx-player-text">
                  <span className="player-name">{playerName(p)}</span>
                  <span className="player-kind">{KIND_LABEL[p.kind]}</span>
                </span>
                <span className="bx-score" title={`상자 ${p.score}개`}>
                  <span className="bx-score-bar" style={{ '--ratio': p.score / total, '--pc': PENS[p.seat].ink } as CSSProperties} />
                  <strong data-testid={`bx-score-${i}`}>
                    {lead ? '👑 ' : ''}
                    {p.score}
                  </strong>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="log bx-log">
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
