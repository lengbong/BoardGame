import { Confetti } from '../../components/Confetti';
import { Board } from './Board';
import { SIDES, other, playerStats, sunkShips } from './rules';
import type { ShipsState, Side } from './types';

interface ResultsProps {
  state: ShipsState;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
  /** 결과 창을 닫고 판을 살펴보기 */
  onClose: () => void;
}

/** 게임이 끝났을 때: 두 함대를 나란히 공개하고 기록을 보여 준다. */
export function Results({ state, onRestart, onChangeSetup, onExit, onClose }: ResultsProps) {
  const winner = state.winner ?? 0;
  const loser = other(winner);
  const humans = state.players.filter((p) => p.kind === 'human').length;
  const winnerHuman = state.players[winner].kind === 'human';
  const celebrate = winnerHuman || humans === 0;
  const stats = playerStats(state, winner);
  const size = state.options.size;

  return (
    <div className="overlay sh-result-overlay" role="dialog" aria-modal="true" aria-labelledby="sh-result-title">
      {celebrate && <Confetti />}
      <div className="result-card sh-result" data-testid="sh-result">
        <div className="sh-trophy" aria-hidden="true">
          {celebrate ? '🏆' : '⚓'}
        </div>
        <h2 id="sh-result-title">
          <span className="dot" style={{ background: SIDES[winner].color }} /> {state.players[winner].name} 승리!
        </h2>
        <p className="sh-result-sub">
          {stats.shots}발 만에 {state.players[loser].name}의 배를 모두 가라앉혔어요.
          {humans === 1 && !winnerHuman ? ' 아쉬워요! 다음엔 꼭 이겨 봐요.' : ''}
        </p>
        <div className="sh-result-boards">
          {([0, 1] as Side[]).map((i) => {
            const st = playerStats(state, other(i));
            const sunk = sunkShips(state, i);
            return (
              <figure key={i} className={`sh-result-board${i === winner ? ' sh-result-win' : ''}`} style={{ borderColor: SIDES[i].color }}>
                <figcaption style={{ background: SIDES[i].color }}>
                  {i === winner ? '🏆 ' : ''}
                  {state.players[i].name}의 바다
                </figcaption>
                <Board
                  size={size}
                  ariaLabel={`${state.players[i].name}의 바다, 배 ${state.players[i].fleet.length - sunk.length}척 남음`}
                  ships={state.players[i].fleet}
                  sunkIds={new Set(sunk.map((s) => s.id))}
                  marks={state.players[other(i)].marks}
                />
                <p>
                  남은 배 <b>{state.players[i].fleet.length - sunk.length}</b>척 · 받은 포탄 {st.shots}발 (명중 {st.hits})
                </p>
              </figure>
            );
          })}
        </div>
        <table className="sh-result-table">
          <thead>
            <tr>
              <th>함대</th>
              <th>발사</th>
              <th>명중</th>
              <th>명중률</th>
            </tr>
          </thead>
          <tbody>
            {([0, 1] as Side[]).map((i) => {
              const s = playerStats(state, i);
              return (
                <tr key={i}>
                  <td>
                    <span className="dot small" style={{ background: SIDES[i].color }} /> {state.players[i].name}
                  </td>
                  <td>{s.shots}</td>
                  <td>{s.hits}</td>
                  <td>{s.accuracy}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} data-testid="sh-restart">
            같은 설정으로 다시 하기
          </button>
          <button type="button" className="btn" onClick={onChangeSetup}>
            설정 바꾸기
          </button>
          <button type="button" className="btn" onClick={onExit}>
            처음 화면
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            판 살펴보기
          </button>
        </div>
      </div>
    </div>
  );
}
