import { GameControls } from '../../components/GameControls';
import { KIND_LABEL, SEAT_COLORS } from '../common/players';
import type { GameSettings } from '../common/settings';
import { actor, claimText, playerName, rankWithObject } from './rules';
import type { CheatState } from './types';

interface PanelProps {
  state: CheatState;
  hint: string;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onNewGame: () => void;
  onExit: () => void;
}

export function Panel({ state, hint, settings, onSettings, onNewGame, onExit }: PanelProps) {
  const act = actor(state);
  const shownIndex = state.phase === 'gameover' ? (state.winner ?? 0) : state.phase === 'doubt' && state.claim ? state.claim.player : state.current;
  const shown = state.players[shownIndex];
  const color = SEAT_COLORS[shown.seat];
  const recent = state.log.slice(-14).reverse();

  let title: string;
  let sub: string | null = null;
  if (state.phase === 'gameover') title = '우승!';
  else if (state.phase === 'doubt' && state.claim) {
    title = `“${claimText(state.claim.rank, state.claim.count)}”`;
    if (act >= 0) sub = `${playerName(state.players[act])}의 판단을 기다려요`;
  } else {
    title = '차례';
    sub = `${rankWithObject(state.rank)} 낼 차례예요`;
  }

  return (
    <aside className="panel ch-panel">
      <section className="turn-card" style={{ borderColor: color.main, background: color.light }}>
        <div className="turn-title">
          <span className="dot" style={{ background: color.main }} />
          <strong data-testid="ch-turn-name">{playerName(shown)}</strong>
          <span>{title}</span>
          {shown.kind !== 'human' && state.phase !== 'gameover' && <span className="tag">컴퓨터</span>}
        </div>
        {sub && <p className="ch-turn-sub">{sub}</p>}
        <p className="hint">{hint}</p>
      </section>

      <section className="players ch-players">
        <h2>플레이어</h2>
        <ul>
          {state.players.map((p, i) => {
            const c = SEAT_COLORS[p.seat];
            return (
              <li key={p.seat} className={i === act ? 'is-current' : ''}>
                <span className="dot" style={{ background: c.main }} />
                <span className="player-name">{playerName(p)}</span>
                <span className="player-kind">{KIND_LABEL[p.kind]}</span>
                <span className={`ch-chip${state.winner === i ? ' ch-chip-win' : ''}`} title="손에 든 카드">
                  {state.winner === i ? '🏆' : `🂠 ${p.hand.length}`}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="ch-pile-note">
          가운데 더미 <b>{state.pile.length}장</b>
          {state.aside.length > 0 && ` · 빼 둔 카드 ${state.aside.length}장`}
        </p>
      </section>

      <section className="log ch-log">
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
