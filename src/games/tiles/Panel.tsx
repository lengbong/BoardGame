import { KIND_LABEL, SEAT_COLORS } from '../common/players';
import { SPEEDS, SPEED_LABELS, type Speed } from '../common/speed';
import { TileFace } from './TileArt';
import { playerName } from './rules';
import { sortByColor } from './tiles';
import type { TilesState } from './types';

interface PanelProps {
  state: TilesState;
  hint: string;
  openHands: boolean;
  /** 사람마다 잠깐 보여 줄 말풍선 (방금 한 일) */
  bubbles: Record<number, { id: number; text: string }>;
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
  const active = state.phase === 'play';
  const current = state.players[state.current];
  const color = SEAT_COLORS[current.seat];
  const recent = state.log.slice(-10).reverse();
  const rounds = state.options.endMode === 'rounds';

  return (
    <aside className="panel tl-panel">
      <section className="turn-card" style={{ borderColor: color.main, background: color.light }}>
        <div className="turn-title">
          <span className="dot" style={{ background: color.main }} />
          <strong data-testid="tl-turn-name">{playerName(current)}</strong>
          <span>{active ? '차례' : '이번 판 끝'}</span>
          {current.kind !== 'human' && <span className="tag">컴퓨터</span>}
        </div>
        <p className="tl-round-info">
          {rounds ? `${state.round} / ${state.options.rounds}판` : '한 판 승부'} · 남은 타일 더미 {state.pool.length}개
        </p>
        <p className="hint">{props.hint}</p>
      </section>

      <section className="players">
        <h2>플레이어</h2>
        <ul>
          {state.players.map((p, i) => {
            const c = SEAT_COLORS[p.seat];
            const bubble = props.bubbles[i];
            return (
              <li key={p.seat} className={`tl-player${i === state.current && active ? ' is-current' : ''}`}>
                <div className="tl-player-row">
                  <span className="dot" style={{ background: c.main }} />
                  <span className="player-name">{playerName(p)}</span>
                  <span className="player-kind">{KIND_LABEL[p.kind]}</span>
                  {state.options.initialMeld && (
                    <span className={`tl-meld${p.melded ? ' tl-meld-done' : ''}`}>{p.melded ? '등록 ✓' : '등록 전'}</span>
                  )}
                  <span className="tl-count" data-testid={`tl-count-${i}`}>
                    {p.rack.length}개
                  </span>
                  {rounds && <span className="tl-score">{p.score}점</span>}
                  {bubble && (
                    <span key={bubble.id} className="tl-bubble">
                      {bubble.text}
                    </span>
                  )}
                </div>
                {props.openHands && p.kind !== 'human' && (
                  <div className="tl-mini-rack">
                    {sortByColor(p.rack).map((t) => (
                      <TileFace key={t.id} tile={t} />
                    ))}
                  </div>
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
