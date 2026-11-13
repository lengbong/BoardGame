import type { CSSProperties } from 'react';
import { KIND_LABEL, SEAT_COLORS } from '../common/players';
import { SPEEDS, SPEED_LABELS, type Speed } from '../common/speed';
import { playerName } from './rules';
import type { LastCardState } from './types';

interface PanelProps {
  state: LastCardState;
  hint: string;
  speed: Speed;
  muted: boolean;
  music: boolean;
  onSpeed: (speed: Speed) => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onNewGame: () => void;
  onExit: () => void;
}

export function Panel(props: PanelProps) {
  const { state } = props;
  const active = state.phase === 'play' || state.phase === 'drawn';
  const current = state.players[state.current];
  const color = SEAT_COLORS[current.seat];
  const recent = state.log.slice(-10).reverse();
  const points = state.options.endMode === 'points';

  return (
    <aside className="panel lc-panel">
      <section className="turn-card" style={{ borderColor: color.main, background: color.light }}>
        <div className="turn-title">
          <span className="dot" style={{ background: color.main }} />
          <strong data-testid="lc-turn-name">{playerName(current)}</strong>
          <span>{active ? '차례' : state.phase === 'roundover' ? '이번 판 승리' : '우승'}</span>
          {current.kind !== 'human' && <span className="tag">컴퓨터</span>}
        </div>
        <p className="lc-round-info">
          {points ? `${state.round}번째 판 · ${state.options.targetScore}점 먼저 내면 우승` : '한 판 승부 · 카드를 먼저 다 내면 우승'}
        </p>
        <p className="hint">{props.hint}</p>
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
                <span className={`lc-count-chip${p.hand.length === 1 ? ' lc-count-one' : ''}`}>🂠 {p.hand.length}</span>
                {points && (
                  <span className="lc-score" title={`${p.score}점`}>
                    <span className="lc-score-bar" style={{ '--ratio': ratio, '--pc': c.main } as CSSProperties} />
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

      <section className="controls game-controls">
        <label>
          속도
          <select value={props.speed} onChange={(e) => props.onSpeed(e.target.value as Speed)}>
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {SPEED_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" onClick={props.onToggleMusic}>
          {props.music ? '🎵 음악 켜짐' : '🎵 음악 꺼짐'}
        </button>
        <button type="button" className="btn" onClick={props.onToggleMute}>
          {props.muted ? '🔇 효과음 꺼짐' : '🔊 효과음 켜짐'}
        </button>
        <button type="button" className="btn" onClick={props.onNewGame}>
          새 게임
        </button>
        <button type="button" className="btn" onClick={props.onExit}>
          처음 화면
        </button>
      </section>
    </aside>
  );
}
