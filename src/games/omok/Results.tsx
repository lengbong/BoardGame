import { Confetti } from '../../components/Confetti';
import { playerName } from './rules';
import { Stone, StoneShape } from './StoneArt';
import type { OmokState } from './types';

interface ResultsProps {
  state: OmokState;
  canUndo: boolean;
  onUndo: () => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
  onClose: () => void;
}

/** 끝난 판을 작게 그린다 (이긴 줄에 선) */
function MiniBoard({ state }: { state: OmokState }) {
  const n = state.size;
  const line = state.winLine;
  const at = (i: number) => ({ x: i % n, y: Math.floor(i / n) });
  return (
    <svg className="ok-mini" viewBox={`-0.8 -0.8 ${n + 0.6} ${n + 0.6}`} aria-hidden="true">
      <rect x={-0.8} y={-0.8} width={n + 0.6} height={n + 0.6} rx={0.4} fill="url(#ok-wood)" />
      {Array.from({ length: n }, (_, k) => (
        <g key={k} stroke="#6b4a2b" strokeWidth={0.05}>
          <line x1={0} y1={k} x2={n - 1} y2={k} />
          <line x1={k} y1={0} x2={k} y2={n - 1} />
        </g>
      ))}
      {state.board.map((c, i) => (c === -1 ? null : <StoneShape key={i} side={c} cx={at(i).x} cy={at(i).y} r={0.44} />))}
      {line && line.length >= 2 && (
        <line x1={at(line[0]).x} y1={at(line[0]).y} x2={at(line[line.length - 1]).x} y2={at(line[line.length - 1]).y} className="ok-winline" />
      )}
    </svg>
  );
}

export function Results({ state, canUndo, onUndo, onRestart, onChangeSetup, onExit, onClose }: ResultsProps) {
  const winner = state.winner;
  const humans = state.players.filter((p) => p.kind === 'human').length;
  const humanLost = winner !== null && state.players[winner].kind !== 'human' && humans === 1;
  const party = winner !== null && !humanLost;

  return (
    <div className="overlay ok-result-overlay" role="dialog" aria-modal="true" aria-labelledby="ok-result-title">
      {party && <Confetti />}
      <div className="result-card ok-result" data-testid="ok-result">
        <button type="button" className="btn btn-ghost ok-result-close" onClick={onClose} aria-label="닫고 판 보기" title="닫고 판 보기">
          ✕
        </button>
        <div className="ok-result-icon" aria-hidden="true">
          {winner === null ? '🤝' : <Stone side={winner} />}
        </div>
        <h2 id="ok-result-title">{winner === null ? '판이 꽉 찼어요. 비겼어요!' : `${playerName(state, winner)} 승리!`}</h2>
        <p className="ok-result-sub">
          {winner === null
            ? '둘 다 끝까지 잘 막았어요.'
            : humanLost
              ? '아쉬워요! 상대가 셋을 이으면 양쪽 끝 중 하나를 바로 막아 보세요.'
              : `${state.moves.length}수 만에 다섯 줄을 만들었어요!`}
        </p>
        <MiniBoard state={state} />
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} data-testid="ok-restart">
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
