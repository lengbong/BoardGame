import type { ReactNode } from 'react';
import { GameControls } from '../../components/GameControls';
import { KIND_LABEL, SEAT_COLORS } from '../common/players';
import type { GameSettings } from '../common/settings';
import { StampBadge, TrainIcon } from './art';
import { CarWindows } from './Board';
import { CITY, STAMP_AT } from './map';
import { actor, handTotal, playerName, publicScore } from './rules';
import type { RailsState, SeatIndex } from './types';
import type { RegisterEl } from './Station';

interface PanelProps {
  state: RailsState;
  hint: string;
  /** 사람 차례일 때 할 수 있는 일 목록 */
  actions: ReactNode;
  notice: string | null;
  reg: RegisterEl;
  /** 모두 공개면 계획 장수 옆에 이은 수도 */
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onNewGame: () => void;
  onExit: () => void;
}

/** 작은 기차 한 칸 (자리마다 창문 모양이 다르다) */
export function SeatCar({ seat }: { seat: SeatIndex }) {
  const c = SEAT_COLORS[seat];
  return (
    <svg viewBox="-13 -8 26 16" width={26} height={16} aria-hidden="true" className="rl-seat-car">
      <rect x={-12} y={-6.2} width={24} height={10.6} rx={3} fill={c.main} stroke={c.dark} strokeWidth={1.3} />
      <CarWindows seat={seat} w={24} />
      <circle cx={-7.4} cy={4.6} r={2} className="rl-car-wheel" />
      <circle cx={7.4} cy={4.6} r={2} className="rl-car-wheel" />
    </svg>
  );
}

export function Panel({ state, hint, actions, notice, reg, settings, onSettings, onNewGame, onExit }: PanelProps) {
  const act = actor(state);
  const shownIndex = state.phase === 'gameover' ? (state.winners[0] ?? 0) : act >= 0 ? act : state.current;
  const shown = state.players[shownIndex];
  const color = SEAT_COLORS[shown.seat];
  const recent = state.log.slice(-14).reverse();

  let title: string;
  if (state.phase === 'gameover') title = '우승!';
  else if (state.phase === 'plans') title = '계획 고르기';
  else title = '차례';

  return (
    <aside className="panel rl-panel">
      <section className="turn-card" style={{ borderColor: color.main, background: color.light }}>
        <div className="turn-title">
          <span className="dot" style={{ background: color.main }} />
          <strong data-testid="rl-turn-name">{playerName(shown)}</strong>
          <span>{title}</span>
          {shown.kind !== 'human' && state.phase !== 'gameover' && <span className="tag">컴퓨터</span>}
        </div>
        {state.finalTurns !== null && state.phase !== 'gameover' && (
          <p className="rl-final-note" data-testid="rl-final-note">
            🔔 마지막 바퀴! 남은 차례 {state.finalTurns}번
          </p>
        )}
        <p className="hint">{hint}</p>
        {notice && (
          <p className="rl-notice" role="status">
            {notice}
          </p>
        )}
        {actions}
      </section>

      <section className="players rl-players">
        <h2>플레이어</h2>
        <ul>
          {state.players.map((p, i) => {
            const c = SEAT_COLORS[p.seat];
            const winner = state.phase === 'gameover' && state.winners.includes(i);
            return (
              <li key={p.seat} className={i === act ? 'is-current' : ''} ref={reg(`player-${i}`)} data-testid={`rl-player-${i}`}>
                <div className="rl-player-row">
                  <SeatCar seat={p.seat} />
                  <span className="player-name">{playerName(p)}</span>
                  <span className="player-kind">{KIND_LABEL[p.kind]}</span>
                  <span className={`rl-score-chip${winner ? ' rl-score-win' : ''}`} title="지금까지 점수 (기찻길 + 도장). 여행 계획은 끝날 때 더해요">
                    {winner ? '🏆 ' : ''}
                    {state.results ? state.results[i].total : publicScore(p)}점
                  </span>
                </div>
                <div className="rl-player-stats">
                  <span title="남은 기차 칸">
                    <TrainIcon color={c.main} size={11} /> {p.trains}
                  </span>
                  <span title="들고 있는 표">🎫 {handTotal(p.hand)}</span>
                  <span title="여행 계획 (비밀)">🗺️ {p.plans.length}</span>
                  {state.options.stamps && (
                    <span className="rl-player-stamps" title={p.stamps.map((m) => `${CITY[m.city].name} ${STAMP_AT[m.city].name}${m.first ? '(첫 도장)' : ''}`).join(', ') || '도장 없음'}>
                      {p.stamps.length === 0 ? <span className="rl-no-stamp">도장 0</span> : p.stamps.map((m) => <StampBadge key={m.city} icon={STAMP_AT[m.city].icon} size={16} first={m.first} color={m.first ? c.main : undefined} />)}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="rl-deck-note">
          표 더미 {state.deck.length}장 · 버린 표 {state.discard.length}장 · 계획 더미 {state.planDeck.length}장
        </p>
      </section>

      <section className="log rl-log">
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
