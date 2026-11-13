import { Confetti } from '../../components/Confetti';
import { DiscFace } from './DiscArt';
import { playerName } from './rules';
import type { ReversiState } from './types';

interface ResultsProps {
  state: ReversiState;
  /** 컴퓨터와 할 때 마지막 수 무르기 */
  canUndo: boolean;
  onUndo: () => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

/** 끝난 판을 작게 그린다 */
function MiniBoard({ state }: { state: ReversiState }) {
  const n = state.size;
  return (
    <svg className="rv-mini" viewBox={`0 0 ${n} ${n}`} aria-hidden="true">
      <rect width={n} height={n} rx={0.25} className="rv-mini-felt" />
      {state.board.map((v, i) =>
        v === -1 ? null : (
          <circle key={i} cx={(i % n) + 0.5} cy={Math.floor(i / n) + 0.5} r={0.4} className={v === 0 ? 'rv-mini-b' : 'rv-mini-w'} />
        ),
      )}
    </svg>
  );
}

export function Results({ state, canUndo, onUndo, onRestart, onChangeSetup, onExit }: ResultsProps) {
  const winner = state.winner;
  const humans = state.players.filter((p) => p.kind === 'human').length;
  const humanLost = winner !== null && state.players[winner].kind !== 'human' && humans === 1;
  const party = winner !== null && !humanLost;
  const [b, w] = state.counts;

  return (
    <div className="overlay rv-result-overlay" role="dialog" aria-modal="true" aria-labelledby="rv-result-title">
      {party && <Confetti />}
      <div className="result-card rv-result" data-testid="rv-result">
        <div className="rv-result-icon" aria-hidden="true">
          {winner === null ? '🤝' : humanLost ? '💪' : '🏆'}
        </div>
        <h2 id="rv-result-title">{winner === null ? '비겼어요!' : `${playerName(state, winner)} 승리!`}</h2>
        {humanLost && <p className="rv-result-sub">아쉬워요! 모서리를 먼저 차지해 보세요. 다음엔 이길 수 있어요.</p>}
        <div className="rv-score-row">
          <div className={`rv-score-side${winner === 0 ? ' rv-score-win' : ''}`}>
            <span className="rv-score-disc">
              <DiscFace side={0} />
            </span>
            <span className="rv-score-name">{playerName(state, 0)}</span>
            <strong>{b}</strong>
          </div>
          <span className="rv-score-colon">:</span>
          <div className={`rv-score-side${winner === 1 ? ' rv-score-win' : ''}`}>
            <span className="rv-score-disc">
              <DiscFace side={1} />
            </span>
            <span className="rv-score-name">{playerName(state, 1)}</span>
            <strong>{w}</strong>
          </div>
        </div>
        <MiniBoard state={state} />
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} data-testid="rv-restart">
            같은 설정으로 다시 하기
          </button>
          <button type="button" className="btn" onClick={onChangeSetup}>
            설정 바꾸기
          </button>
          <button type="button" className="btn" onClick={onExit}>
            처음 화면
          </button>
          {canUndo && (
            <button type="button" className="btn" onClick={onUndo}>
              ↶ 무르기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
