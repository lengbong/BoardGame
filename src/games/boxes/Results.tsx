import type { CSSProperties } from 'react';
import { Confetti } from '../../components/Confetti';
import { ShapeIcon } from '../../components/shapes';
import { SEAT_COLORS } from '../common/players';
import { PENS } from './art';
import { Board } from './Board';
import { playerName, winners } from './rules';
import type { BoxesState } from './types';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉', 4: '4등' };

interface ResultsProps {
  state: BoxesState;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
  onClose: () => void;
}

export function Results({ state, onRestart, onChangeSetup, onExit, onClose }: ResultsProps) {
  const top = winners(state);
  const allTie = top.length === state.players.length;
  const total = state.size * state.size;
  let title: string;
  if (allTie) title = '모두 비겼어요!';
  else if (top.length > 1) title = `${top.map((i) => playerName(state.players[i])).join(' · ')} 공동 우승!`;
  else title = `${playerName(state.players[top[0]])} 우승!`;

  return (
    <div className="overlay bx-result-overlay" role="dialog" aria-modal="true" aria-labelledby="bx-result-title">
      {!allTie && <Confetti />}
      <div className="result-card bx-result" data-testid="bx-result">
        <div className="bx-result-head">
          <div className="bx-trophy" aria-hidden="true">
            {allTie ? '🤝' : '🏆'}
          </div>
          <h2 id="bx-result-title">{title}</h2>
        </div>
        <div className="bx-result-body">
          <Board state={state} mini className="bx-result-board" label="마지막 판 모습" />
          <ol className="bx-score-table">
            {state.rankings.map((pi, k) => {
              const p = state.players[pi];
              const rank = state.ranks[pi];
              const c = SEAT_COLORS[p.seat];
              return (
                <li key={pi} className={rank === 1 && !allTie ? 'bx-row-winner' : ''} style={{ animationDelay: `${0.2 + k * 0.12}s` }}>
                  <span className="medal">{MEDALS[rank]}</span>
                  <ShapeIcon shape={PENS[p.seat].shape} color={c.main} size={16} />
                  <strong>{playerName(p)}</strong>
                  <span className="bx-row-bar" style={{ '--ratio': p.score / total, '--pc': PENS[p.seat].ink } as CSSProperties} />
                  <span className="bx-row-total">상자 {p.score}개</span>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} data-testid="bx-restart">
            같은 설정으로 다시 하기
          </button>
          <button type="button" className="btn" onClick={onChangeSetup}>
            설정 바꾸기
          </button>
          <button type="button" className="btn" onClick={onExit}>
            처음 화면
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            판 다시 보기
          </button>
        </div>
      </div>
    </div>
  );
}
