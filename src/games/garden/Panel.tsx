import type { ReactNode } from 'react';
import { GameControls } from '../../components/GameControls';
import { KIND_LABEL as SEAT_KIND_LABEL, SEAT_COLORS } from '../common/players';
import type { GameSettings } from '../common/settings';
import { playerName, ribbonCount, scoreOf, turnsLeftInRound } from './rules';
import type { GardenState } from './types';

interface PanelProps {
  state: GardenState;
  hint: string;
  /** 차례 카드 아래의 행동 상자 */
  action: ReactNode;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onNewGame: () => void;
  onExit: () => void;
}

export function Panel({ state, hint, action, settings, onSettings, onNewGame, onExit }: PanelProps) {
  const over = state.phase === 'gameover';
  const shown = state.players[over ? (state.winners[0] ?? 0) : state.current];
  const color = SEAT_COLORS[shown.seat];
  const recent = state.log.slice(-16).reverse();
  const left = turnsLeftInRound(state);

  return (
    <aside className="panel gd-panel">
      <section className="turn-card gd-turn" style={{ borderColor: color.main, background: color.light }}>
        <div className="turn-title">
          <span className="dot" style={{ background: color.main }} />
          <strong data-testid="gd-turn-name">{playerName(shown)}</strong>
          <span>{over ? (state.winners.length > 1 ? '함께 우승!' : '우승!') : state.phase === 'discard' ? '돌려놓기' : '차례'}</span>
          {shown.kind !== 'human' && !over && <span className="tag">컴퓨터</span>}
        </div>
        <p className="gd-round">
          {state.round}라운드 · 목표 {state.options.target}점
          {state.endTriggered && !over && <b className="gd-last-round"> 🎯 마지막 라운드 ({left}명 남음)</b>}
        </p>
        <p className="hint" data-testid="gd-hint">
          {hint}
        </p>
        {action}
      </section>

      <section className="players gd-players">
        <h2>플레이어</h2>
        <ul>
          {state.players.map((p, i) => {
            const c = SEAT_COLORS[p.seat];
            const rib = ribbonCount(state, i);
            return (
              <li key={p.seat} className={i === state.current && !over ? 'is-current' : ''}>
                <span className="dot" style={{ background: c.main }} />
                <span className="player-name">{playerName(p)}</span>
                <span className="player-kind">
                  {SEAT_KIND_LABEL[p.kind]}
                  {i === state.first && (
                    <em className="gd-first" title="첫 차례: 이 사람부터 라운드가 시작해요" aria-label="첫 차례">
                      {' '}
                      🚩
                    </em>
                  )}
                </span>
                <span className="gd-chip" title={`식물 ${p.garden.length}장${rib ? `, 상장 ${rib}개` : ''}`}>
                  🌱{p.garden.length}
                  {rib > 0 && ` 🏵️${rib}`}
                </span>
                <span className={`gd-chip gd-chip-score${over && state.winners.includes(i) ? ' gd-chip-win' : ''}`}>{over && state.winners.includes(i) ? '🏆 ' : ''}{scoreOf(state, i)}점</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="log gd-log">
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
