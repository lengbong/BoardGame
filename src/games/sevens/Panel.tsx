import type { CSSProperties } from 'react';
import { GameControls } from '../../components/GameControls';
import { KIND_LABEL, SEAT_COLORS } from '../common/players';
import type { GameSettings } from '../common/settings';
import { MAX_PASSES, placedCount, playerName } from './rules';
import type { SevensState } from './types';

interface PanelProps {
  state: SevensState;
  hint: string;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onNewGame: () => void;
  onExit: () => void;
}

export function Panel({ state, hint, settings, onSettings, onNewGame, onExit }: PanelProps) {
  const active = state.phase === 'play';
  const shownIndex = active ? state.current : (state.roundResult?.winner ?? state.current);
  const shown = state.players[shownIndex];
  const color = SEAT_COLORS[shown.seat];
  const recent = state.log.slice(-12).reverse();
  const points = state.options.endMode === 'points';

  return (
    <aside className="panel sv-panel">
      <section className="turn-card" style={{ borderColor: color.main, background: color.light }}>
        <div className="turn-title">
          <span className="dot" style={{ background: color.main }} />
          <strong data-testid="sv-turn-name">{playerName(shown)}</strong>
          <span>{active ? '차례' : state.phase === 'roundover' ? '이번 판 승리' : points ? '우승' : '1등'}</span>
          {shown.kind !== 'human' && <span className="tag">컴퓨터</span>}
        </div>
        <p className="sv-round-info">
          {points ? `${state.round}번째 판 · ${state.options.targetScore}점 먼저 모으면 우승` : '한 판 · 카드를 먼저 다 내면 1등'} · 판 {placedCount(state.board)}/52
        </p>
        <p className="hint">{hint}</p>
      </section>

      <section className="players">
        <h2>플레이어</h2>
        <ul>
          {state.players.map((p, i) => {
            const c = SEAT_COLORS[p.seat];
            const place = state.finishOrder.indexOf(i) + 1;
            const ratio = Math.min(1, p.score / state.options.targetScore);
            return (
              <li key={p.seat} className={i === state.current && active ? 'is-current' : ''}>
                <span className="dot" style={{ background: c.main }} />
                <span className="player-name">{playerName(p)}</span>
                <span className="player-kind">{KIND_LABEL[p.kind]}</span>
                {p.status === 'finished' ? (
                  <span className="sv-chip sv-chip-done">🎉 {place}등</span>
                ) : p.status === 'out' ? (
                  <span className="sv-chip sv-chip-out">탈락</span>
                ) : (
                  <span className="sv-chip" title={state.options.passLimit ? `통과 ${p.passes}/${MAX_PASSES}` : undefined}>
                    🂠 {p.hand.length}
                    {state.options.passLimit ? ` · 통과 ${p.passes}` : ''}
                  </span>
                )}
                {points && (
                  <span className="sv-score" title={`${p.score}점`}>
                    <span className="sv-score-bar" style={{ '--ratio': ratio, '--sc': c.main } as CSSProperties} />
                    {p.score}
                  </span>
                )}
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
