import { Confetti } from '../../components/Confetti';
import { DUEL_KIND_LABEL } from '../common/duel';
import { sideName } from './rules';
import { SideIcon } from './SideIcon';
import { SIDE_INFO } from './sides';
import type { MancalaState, Side } from './types';

interface ResultsProps {
  state: MancalaState;
  canUndo: boolean;
  onUndo: () => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

export function Results({ state, canUndo, onUndo, onRestart, onChangeSetup, onExit }: ResultsProps) {
  const result = state.result!;
  const winner = result.winner;
  const order: Side[] = winner === 1 ? [1, 0] : [0, 1];
  return (
    <div className="overlay mc-result-overlay" role="dialog" aria-modal="true" aria-labelledby="mc-result-title">
      {winner !== null && <Confetti />}
      <div className="result-card mc-result" data-testid="mc-result">
        <div className="mc-trophy" aria-hidden="true">
          {winner === null ? '🤝' : '🏆'}
        </div>
        <h2 id="mc-result-title">{winner === null ? '비겼어요!' : `${sideName(state, winner)} 우승!`}</h2>
        <p className="mc-result-sub">
          {result.scores[0]} : {result.scores[1]}
          {winner !== null && ` · ${Math.abs(result.scores[0] - result.scores[1])}개 차이`}
        </p>
        <ol className="mc-result-rows">
          {order.map((side, rank) => {
            const st = state.stats[side];
            return (
              <li key={side} className={winner === side ? 'mc-row-winner' : ''} style={{ animationDelay: `${0.2 + rank * 0.15}s` }}>
                <span className="medal">{winner === null ? '🤝' : rank === 0 ? '🥇' : '🥈'}</span>
                <SideIcon side={side} size={26} />
                <span className="mc-row-name">
                  <strong>{sideName(state, side)}</strong>
                  <small>
                    {DUEL_KIND_LABEL[state.players[side].kind]} · 가져오기 {st.captures}번 · 한 번 더 {st.extraTurns}번
                    {result.swept[side] > 0 && ` · 남은 씨앗 +${result.swept[side]}`}
                  </small>
                </span>
                <span className="mc-row-score" style={{ background: SIDE_INFO[side].main }}>
                  {result.scores[side]}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} data-testid="mc-restart">
            같은 설정으로 다시 하기
          </button>
          <button type="button" className="btn" onClick={onChangeSetup}>
            설정 바꾸기
          </button>
          <button type="button" className="btn" onClick={onExit}>
            처음 화면
          </button>
          {canUndo && (
            <button type="button" className="btn btn-ghost" onClick={onUndo}>
              ↶ 한 수 무르기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
