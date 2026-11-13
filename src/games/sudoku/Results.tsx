import { Confetti } from '../../components/Confetti';
import { DIFFICULTY_INFO } from './generator';
import { formatTimeKo } from './storage';
import type { SudokuState } from './types';

interface ResultsProps {
  state: SudokuState;
  newBest: boolean;
  bestMs: number | null;
  onNext: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
  onClose: () => void;
}

/** 다 풀었을 때: 꽃가루, 걸린 시간, 힌트 수, 최고 기록 */
export function Results({ state, newBest, bestMs, onNext, onChangeSetup, onExit, onClose }: ResultsProps) {
  const info = DIFFICULTY_INFO[state.puzzle.difficulty];
  return (
    <div className="overlay sd-result-overlay" role="dialog" aria-modal="true" aria-labelledby="sd-result-title">
      <Confetti />
      <div className="result-card sd-result" data-testid="sd-result">
        <div className="sd-result-badge" aria-hidden="true">
          <svg viewBox="0 0 64 64">
            <rect x="6" y="6" width="52" height="52" rx="10" fill="#fff7e0" stroke="#d9a520" strokeWidth="3" />
            <path d="M24 6v52M40 6v52M6 24h52M6 40h52" stroke="#e6c46a" strokeWidth="1.5" />
            <path d="M18 33l9 9 19-21" fill="none" stroke="#2e9d5b" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 id="sd-result-title">다 풀었어요! 🎉</h2>
        <p className="sd-result-sub">
          {info.label} · 문제 번호 {state.puzzle.id}
        </p>
        <ul className="sd-result-stats">
          <li>
            <span>걸린 시간</span>
            <strong data-testid="sd-result-time">{formatTimeKo(state.elapsedMs)}</strong>
          </li>
          <li>
            <span>힌트</span>
            <strong>{state.hintsUsed === 0 ? '안 썼어요 👍' : `${state.hintsUsed}번`}</strong>
          </li>
          {state.mistakeMode === 'instant' && (
            <li>
              <span>실수</span>
              <strong>{state.mistakes === 0 ? '없어요 ✨' : `${state.mistakes}번`}</strong>
            </li>
          )}
          <li>
            <span>{info.label} 최고 기록</span>
            <strong>
              {newBest ? <span className="sd-new-best">🏅 새 기록!</span> : bestMs !== null ? formatTimeKo(bestMs) : '아직 없어요'}
            </strong>
          </li>
        </ul>
        {state.hintsUsed > 0 && <p className="sd-result-note">힌트 없이 풀면 최고 기록에 올라가요.</p>}
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onNext} data-testid="sd-next">
            {info.label} 새 문제
          </button>
          <button type="button" className="btn" onClick={onChangeSetup}>
            난이도 바꾸기
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
