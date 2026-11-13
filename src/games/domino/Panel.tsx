import type { CSSProperties } from 'react';
import { GameControls } from '../../components/GameControls';
import { KIND_LABEL, SEAT_COLORS } from '../common/players';
import type { GameSettings } from '../common/settings';
import { lineEnds, playerName } from './rules';
import type { DominoState } from './types';

interface PanelProps {
  state: DominoState;
  hint: string;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  pipColors: boolean;
  onTogglePipColors: () => void;
  onNewGame: () => void;
  onExit: () => void;
}

export function Panel({ state, hint, settings, onSettings, pipColors, onTogglePipColors, onNewGame, onExit }: PanelProps) {
  const active = state.phase === 'play';
  const current = state.players[state.current];
  const winner = state.roundResult?.winner ?? null;
  const shown = active ? current : winner !== null ? state.players[winner] : current;
  const color = SEAT_COLORS[shown.seat];
  const recent = state.log.slice(-12).reverse();
  const points = state.options.endMode === 'points';
  const ends = lineEnds(state);

  let status: string;
  if (active) status = '차례';
  else if (winner === null) status = '비김';
  else status = state.phase === 'roundover' ? '이번 판 승리' : '우승';

  return (
    <aside className="panel dm-panel">
      <section className="turn-card" style={{ borderColor: color.main, background: color.light }}>
        <div className="turn-title">
          <span className="dot" style={{ background: color.main }} />
          <strong data-testid="dm-turn-name">{active || winner !== null ? playerName(shown) : '무승부'}</strong>
          <span>{status}</span>
          {active && current.kind !== 'human' && <span className="tag">컴퓨터</span>}
        </div>
        <p className="dm-round-info">
          {points ? `${state.round}번째 판 · ${state.options.targetScore}점 먼저 모으면 우승` : '한 판 승부 · 패를 먼저 다 내면 우승'}
          {state.options.blockRule ? ' · 블록 규칙' : ''}
        </p>
        <p className="hint">{hint}</p>
      </section>

      <section className="dm-info">
        <div className="dm-info-item">
          <span>열린 끝</span>
          <strong data-testid="dm-ends">{ends ? `${ends.left} · ${ends.right}` : '—'}</strong>
        </div>
        <div className="dm-info-item">
          <span>뽑는 더미</span>
          <strong>{state.boneyard.length}개</strong>
        </div>
        <button type="button" className={`dm-info-item dm-pip-toggle${pipColors ? ' dm-pip-on' : ''}`} onClick={onTogglePipColors} aria-pressed={pipColors} data-testid="dm-pip-colors">
          <span>🎨 점 색깔</span>
          <strong>{pipColors ? '켜짐' : '꺼짐'}</strong>
        </button>
      </section>

      <section className="players">
        <h2>플레이어</h2>
        <ul>
          {state.players.map((p, i) => {
            const c = SEAT_COLORS[p.seat];
            const ratio = Math.min(1, p.score / state.options.targetScore);
            return (
              <li key={p.seat} className={i === state.current && active ? 'is-current' : ''}>
                <span className="dot" style={{ background: c.main }} />
                <span className="player-name">{playerName(p)}</span>
                <span className="player-kind">{KIND_LABEL[p.kind]}</span>
                <span className="dm-count-chip" title={`패 ${p.hand.length}개`}>
                  ▯ {p.hand.length}
                </span>
                {points && (
                  <span className="dm-score" title={`${p.score}점`}>
                    <span className="dm-score-bar" style={{ '--ratio': ratio, '--pc': c.main } as CSSProperties} />
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
