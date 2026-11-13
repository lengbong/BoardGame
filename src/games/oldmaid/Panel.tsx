import { GameControls } from '../../components/GameControls';
import { KIND_LABEL, SEAT_COLORS } from '../common/players';
import type { GameSettings } from '../common/settings';
import { drawTarget, playerName } from './rules';
import type { OldMaidState } from './types';

interface PanelProps {
  state: OldMaidState;
  hint: string;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onNewGame: () => void;
  onExit: () => void;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function Panel({ state, hint, settings, onSettings, onNewGame, onExit }: PanelProps) {
  const active = state.phase === 'play';
  const current = state.players[state.current];
  const shown = state.phase === 'gameover' && state.thief !== null ? state.players[state.thief] : current;
  const color = SEAT_COLORS[shown.seat];
  const target = drawTarget(state);
  const recent = state.log.slice(-12).reverse();
  const open = state.options.handView === 'open';

  return (
    <aside className="panel om-panel">
      <section className="turn-card" style={{ borderColor: color.main, background: color.light }}>
        <div className="turn-title">
          <span className="dot" style={{ background: color.main }} />
          <strong data-testid="om-turn-name">{playerName(shown)}</strong>
          <span>{state.phase === 'gameover' ? '도둑!' : state.phase === 'deal' ? '부터 시작' : '차례'}</span>
          {shown.kind !== 'human' && <span className="tag">컴퓨터</span>}
        </div>
        {active && target >= 0 && (
          <p className="om-turn-sub">
            <span className="dot small" style={{ background: SEAT_COLORS[state.players[target].seat].main }} />
            {playerName(state.players[target])}의 카드를 한 장 뽑아요
          </p>
        )}
        <p className="hint">{hint}</p>
      </section>

      <section className="players">
        <h2>플레이어</h2>
        <ul>
          {state.players.map((p, i) => {
            const c = SEAT_COLORS[p.seat];
            const out = p.hand.length === 0 && state.phase !== 'deal';
            return (
              <li key={p.seat} className={i === state.current && active ? 'is-current' : ''}>
                <span className="dot" style={{ background: c.main }} />
                <span className="player-name">{playerName(p)}</span>
                <span className="player-kind">{KIND_LABEL[p.kind]}</span>
                {state.thief === i ? (
                  <span className="om-chip om-chip-thief">🃏 도둑</span>
                ) : out ? (
                  <span className="om-chip om-chip-out">
                    {MEDALS[p.place - 1] ?? ''} {p.place}등
                  </span>
                ) : (
                  <span className="om-chip">
                    🂠 {p.hand.length}
                    {open && p.hand.some((card) => card.suit === null) ? ' 🃏' : ''}
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
