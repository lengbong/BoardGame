import { GOAL, SEAT_COLORS } from './board';
import { Dice } from './Dice';
import { SPEED_LABELS, type Speed } from './storage';
import type { GameState } from './types';

const KIND_LABEL = { human: '사람', 'ai-easy': '컴퓨터 · 쉬움', 'ai-normal': '컴퓨터 · 보통' } as const;
const MEDALS = ['🥇', '🥈', '🥉', '4등'];

interface PanelProps {
  state: GameState;
  diceFace: number | null;
  diceRolling: boolean;
  canRoll: boolean;
  hint: string;
  speed: Speed;
  muted: boolean;
  onRoll: () => void;
  onSpeed: (speed: Speed) => void;
  onToggleMute: () => void;
  onNewGame: () => void;
  onExit: () => void;
}

export function Panel(props: PanelProps) {
  const { state, diceFace, diceRolling, canRoll, hint, speed, muted } = props;
  const current = state.players[state.current];
  const highlighted = state.phase === 'gameover' ? state.players[state.rankings[0]] : current;
  const color = SEAT_COLORS[highlighted.seat];
  const recent = state.log.slice(-8).reverse();

  return (
    <aside className="panel">
      <section className="turn-card" style={{ borderColor: color.main, background: color.light }}>
        {state.phase === 'gameover' ? (
          <div className="turn-title">
            <span>🏆</span>
            <strong data-testid="turn-name">{state.players[state.rankings[0]].name}</strong>
            <span>우승!</span>
          </div>
        ) : (
          <div className="turn-title">
            <span className="dot" style={{ background: color.main }} />
            <strong data-testid="turn-name">{current.name}</strong>
            <span>차례</span>
            {current.kind !== 'human' && <span className="tag">컴퓨터</span>}
          </div>
        )}
        <div className="dice-row">
          <Dice value={diceFace} rolling={diceRolling} color={color.main} />
          <button type="button" className="btn btn-primary btn-roll" onClick={props.onRoll} disabled={!canRoll} data-testid="roll">
            주사위 굴리기
            <small>Space</small>
          </button>
        </div>
        <p className="hint" data-testid="hint">
          {hint}
        </p>
      </section>

      <section className="players">
        <h2>플레이어</h2>
        <ul>
          {state.players.map((p, i) => {
            const done = p.pieces.filter((x) => x >= GOAL).length;
            const rank = state.rankings.indexOf(i);
            return (
              <li key={p.seat} className={i === state.current && state.phase !== 'gameover' ? 'is-current' : ''}>
                <span className="dot" style={{ background: SEAT_COLORS[p.seat].main }} />
                <span className="player-name">{p.name}</span>
                <span className="player-kind">{KIND_LABEL[p.kind]}</span>
                <span className="goal-dots" aria-label={`골인 ${done}개`}>
                  {p.pieces.map((_, k) => (
                    <span key={k} className={k < done ? 'filled' : ''} style={{ borderColor: SEAT_COLORS[p.seat].main, background: k < done ? SEAT_COLORS[p.seat].main : undefined }} />
                  ))}
                </span>
                {rank >= 0 && <span className="medal">{MEDALS[rank]}</span>}
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

      <section className="controls">
        <label>
          속도
          <select value={speed} onChange={(e) => props.onSpeed(e.target.value as Speed)}>
            {(Object.keys(SPEED_LABELS) as Speed[]).map((s) => (
              <option key={s} value={s}>
                {SPEED_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" onClick={props.onToggleMute}>
          {muted ? '🔇 소리 꺼짐' : '🔊 소리 켜짐'}
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
