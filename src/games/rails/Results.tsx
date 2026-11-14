import { useEffect, useState, type CSSProperties } from 'react';
import { Confetti } from '../../components/Confetti';
import { withJosa } from '../../lib/korean';
import { SEAT_COLORS } from '../common/players';
import { SeatCar } from './Panel';
import { CITY, PLAN } from './map';
import { playerName, rankings, TOUR_BONUS } from './rules';
import type { RailsState } from './types';

const MEDALS = ['🥇', '🥈', '🥉', '4등'];

interface GameOverProps {
  state: RailsState;
  /** 점수를 하나씩 세는 연출 */
  animate: boolean;
  onShowNetwork: (player: number | null) => void;
  onHideResult: () => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

/** 0에서 value까지 세어 올라가는 숫자 */
function CountUp({ value, delay, animate }: { value: number; delay: number; animate: boolean }) {
  const [shown, setShown] = useState(animate ? 0 : value);
  useEffect(() => {
    if (!animate) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now() + delay;
    const dur = 600;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / dur));
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delay, animate]);
  return <>{shown > 0 && value > 0 ? `+${shown}` : shown}</>;
}

const STEP = 650;

export function GameOver({ state, animate, onShowNetwork, onHideResult, onRestart, onChangeSetup, onExit }: GameOverProps) {
  const results = state.results!;
  const order = rankings(state);
  const winners = state.winners;
  const humans = state.players.filter((p) => p.kind === 'human');
  const humanLost = humans.length === 1 && !winners.some((i) => state.players[i].kind === 'human');
  const names = winners.map((i) => playerName(state.players[i])).join(', ');
  const top = results[winners[0]];
  const cell = (col: number): CSSProperties => ({ animationDelay: animate ? `${col * STEP}ms` : '0ms' });
  const d = (col: number) => (animate ? col * STEP : 0);
  const bestTour = Math.max(...results.map((r) => r.tourCities));

  return (
    <div className="overlay rl-result-overlay" role="dialog" aria-modal="true" aria-labelledby="rl-result-title">
      {!humanLost && <Confetti />}
      <div className={`result-card rl-result${animate ? '' : ' rl-no-anim'}`} data-testid="rl-result">
        <div className="trophy" aria-hidden="true">
          {humanLost ? '🚂' : '🏆'}
        </div>
        <h2 id="rl-result-title">
          {names} 우승{winners.length > 1 ? ' (공동)' : ''}!
        </h2>
        <p className="rl-result-sub">
          {humanLost
            ? '아깝다! 다음에는 여행 계획을 먼저 이어 보세요 🗺️'
            : `${withJosa(names, '이/가')} ${top.total}점으로 전국 일주를 가장 멋지게 마쳤어요!`}
        </p>
        <div className="rl-score-wrap">
          <table className="rl-score-table">
            <thead>
              <tr>
                <th scope="col">순위</th>
                <th scope="col">이름</th>
                <th scope="col" style={cell(0)} className="rl-col">
                  🛤️ 기찻길
                </th>
                <th scope="col" style={cell(1)} className="rl-col">
                  🗺️ 여행 계획
                </th>
                {state.options.stamps && (
                  <th scope="col" style={cell(2)} className="rl-col">
                    🏅 도장
                  </th>
                )}
                <th scope="col" style={cell(3)} className="rl-col">
                  🚂 일주 상
                </th>
                <th scope="col" style={cell(4)} className="rl-col">
                  합계
                </th>
              </tr>
            </thead>
            <tbody>
              {order.map((pi, rank) => {
                const p = state.players[pi];
                const r = results[pi];
                const win = winners.includes(pi);
                const place = order.findIndex((q) => results[q].total === r.total && results[q].plansDone.length === r.plansDone.length);
                return (
                  <tr key={pi} className={win ? 'rl-row-win' : ''} onMouseEnter={() => onShowNetwork(pi)} onMouseLeave={() => onShowNetwork(null)} data-testid={`rl-result-row-${rank}`}>
                    <td className="medal">{MEDALS[place]}</td>
                    <td className="rl-result-name">
                      <SeatCar seat={p.seat} />
                      <strong style={{ '--rl-seat-dark': SEAT_COLORS[p.seat].dark, '--rl-seat-main': SEAT_COLORS[p.seat].main } as CSSProperties}>{playerName(p)}</strong>
                    </td>
                    <td style={cell(0)} className="rl-col">
                      <CountUp value={r.routes} delay={d(0)} animate={animate} />
                    </td>
                    <td style={cell(1)} className={`rl-col ${r.planPoints < 0 ? 'rl-neg' : ''}`}>
                      {r.planPoints < 0 ? r.planPoints : <CountUp value={r.planPoints} delay={d(1)} animate={animate} />}
                      <small>
                        이룸 {r.plansDone.length} · 못 이룸 {r.plansFailed.length}
                      </small>
                    </td>
                    {state.options.stamps && (
                      <td style={cell(2)} className="rl-col">
                        <CountUp value={r.stamps} delay={d(2)} animate={animate} />
                        <small>{state.players[pi].stamps.length}개</small>
                      </td>
                    )}
                    <td style={cell(3)} className={`rl-col${r.tour > 0 ? ' rl-tour' : ''}`}>
                      {r.tour > 0 ? `+${r.tour}` : '–'}
                      <small>{r.tourCities}곳</small>
                    </td>
                    <td style={cell(4)} className="rl-col rl-total">
                      <CountUp value={r.total} delay={d(4)} animate={animate} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="rl-result-tour">
          🚂 전국 일주 상 (+{TOUR_BONUS}): 하나로 이어진 기찻길이 가장 많은 도시({bestTour}곳)에 닿은 사람. 줄에 마우스를 올리면 지도에 보여요.
        </p>
        <div className="rl-result-plans" style={cell(1)}>
          {order.map((pi) => {
            const r = results[pi];
            const p = state.players[pi];
            return (
              <div key={pi} className="rl-result-plan-row">
                <span className="dot" style={{ background: SEAT_COLORS[p.seat].main }} />
                {[...r.plansDone.map((id) => [id, true] as const), ...r.plansFailed.map((id) => [id, false] as const)].map(([id, ok]) => (
                  <span key={id} className={`rl-plan-chip ${ok ? 'rl-chip-ok' : 'rl-chip-bad'}`}>
                    {ok ? '✓' : '✗'} {CITY[PLAN[id].a].name}→{CITY[PLAN[id].b].name} {ok ? '+' : '−'}
                    {PLAN[id].points}
                  </span>
                ))}
                {r.plansDone.length + r.plansFailed.length === 0 && <span className="rl-plan-chip">계획 없음</span>}
              </div>
            );
          })}
        </div>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} data-testid="rl-restart">
            같은 설정으로 다시 하기
          </button>
          <button type="button" className="btn" onClick={onHideResult} data-testid="rl-see-map">
            🗺️ 지도 보기
          </button>
          <button type="button" className="btn" onClick={onChangeSetup}>
            설정 바꾸기
          </button>
          <button type="button" className="btn" onClick={onExit}>
            처음 화면
          </button>
        </div>
      </div>
    </div>
  );
}
