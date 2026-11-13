import { Confetti } from '../../components/Confetti';
import { Stone } from './StoneArt';
import { COLS, playerName, winSegments } from './rules';
import type { FourLineState } from './types';

interface ResultsProps {
  state: FourLineState;
  canUndo: boolean;
  onUndo: () => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

/** 끝난 판을 작게 그린다 (이긴 줄에 선) */
function MiniBoard({ state }: { state: FourLineState }) {
  const segs = state.winLine && state.lastMove !== null ? winSegments(state.board, state.lastMove) : [];
  const at = (i: number) => ({ x: (i % COLS) + 0.5, y: Math.floor(i / COLS) + 0.5 });
  return (
    <svg className="fl-mini" viewBox="-0.2 -0.2 7.4 6.4" aria-hidden="true">
      <rect x={-0.2} y={-0.2} width={7.4} height={6.4} rx={0.4} className="fl-mini-plate" />
      {state.board.map((v, i) => {
        const p = at(i);
        return <circle key={i} cx={p.x} cy={p.y} r={0.38} className={v === -1 ? 'fl-mini-hole' : v === 0 ? 'fl-mini-r' : 'fl-mini-y'} />;
      })}
      {segs.map(([a, b]) => (
        <line key={`${a}-${b}`} x1={at(a).x} y1={at(a).y} x2={at(b).x} y2={at(b).y} className="fl-mini-line" />
      ))}
    </svg>
  );
}

export function Results({ state, canUndo, onUndo, onRestart, onChangeSetup, onExit }: ResultsProps) {
  const winner = state.winner;
  const humans = state.players.filter((p) => p.kind === 'human').length;
  const humanLost = winner !== null && state.players[winner].kind !== 'human' && humans === 1;
  const party = winner !== null && !humanLost;

  return (
    <div className="overlay fl-result-overlay" role="dialog" aria-modal="true" aria-labelledby="fl-result-title">
      {party && <Confetti />}
      <div className="result-card fl-result" data-testid="fl-result">
        <div className="fl-result-icon" aria-hidden="true">
          {winner === null ? '🤝' : <Stone side={winner} />}
        </div>
        <h2 id="fl-result-title">{winner === null ? '판이 꽉 찼어요. 비겼어요!' : `${playerName(state, winner)} 승리!`}</h2>
        <p className="fl-result-sub">
          {winner === null
            ? '둘 다 끝까지 잘 막았어요.'
            : humanLost
              ? '아쉬워요! 상대가 셋을 이으면 바로 막아 보세요. 다음엔 이길 수 있어요.'
              : `${state.moves.length}수 만에 넷을 이었어요!`}
        </p>
        <MiniBoard state={state} />
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} data-testid="fl-restart">
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
