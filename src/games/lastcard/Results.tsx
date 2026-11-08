import type { CSSProperties } from 'react';
import { Confetti } from '../../components/Confetti';
import { SEAT_COLORS } from '../common/players';
import { handPoints, sortHand } from './cards';
import { CardFace } from './CardArt';
import { playerName } from './rules';
import type { LastCardState } from './types';

const MEDALS = ['🥇', '🥈', '🥉', '4등'];

function MiniHand({ state, index }: { state: LastCardState; index: number }) {
  const hand = sortHand(state.players[index].hand);
  if (hand.length === 0) return <span className="lc-mini-hand lc-mini-empty">다 냈어요! 🎉</span>;
  return (
    <span className="lc-mini-hand">
      {hand.slice(0, 12).map((c) => (
        <CardFace key={c.id} card={c} className="lc-mini" />
      ))}
      {hand.length > 12 && <span className="lc-mini-more">+{hand.length - 12}</span>}
    </span>
  );
}

interface RoundOverProps {
  state: LastCardState;
  canContinue: boolean;
  onNext: () => void;
}

/** 점수 모으기: 한 판이 끝났을 때 */
export function RoundOver({ state, canContinue, onNext }: RoundOverProps) {
  const result = state.roundResult!;
  const order = state.players.map((_, i) => i).sort((a, b) => state.players[b].score - state.players[a].score || a - b);
  const target = state.options.targetScore;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="lc-round-title">
      <div className="result-card lc-result lc-pop-in" data-testid="lc-roundover">
        <h2 id="lc-round-title">
          🎉 {playerName(state.players[result.winner])} 승리! <small>+{result.points}점</small>
        </h2>
        <p className="lc-result-sub">
          {state.round}번째 판 끝 · {target}점을 먼저 모으면 우승
        </p>
        <ol className="lc-score-table">
          {order.map((i) => {
            const p = state.players[i];
            const c = SEAT_COLORS[p.seat];
            return (
              <li key={i} className={i === result.winner ? 'lc-row-winner' : ''}>
                <span className="dot" style={{ background: c.main }} />
                <strong>{playerName(p)}</strong>
                <MiniHand state={state} index={i} />
                <span className="lc-row-points">{i === result.winner ? `+${result.points}` : `${result.handPoints[i]}점 남음`}</span>
                <span className="lc-row-total">
                  <span className="lc-score-bar" style={{ '--ratio': Math.min(1, p.score / target), '--pc': c.main } as CSSProperties} />
                  {p.score}점
                </span>
              </li>
            );
          })}
        </ol>
        <div className="result-actions">
          {canContinue ? (
            <button type="button" className="btn btn-primary btn-large" onClick={onNext} data-testid="lc-next-round">
              다음 판 시작 <kbd>Enter</kbd>
            </button>
          ) : (
            <p className="lc-result-sub">곧 다음 판이 시작돼요…</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface GameOverProps {
  state: LastCardState;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

export function GameOver({ state, onRestart, onChangeSetup, onExit }: GameOverProps) {
  const winner = state.players[state.rankings[0]];
  const points = state.options.endMode === 'points';
  return (
    <div className="overlay lc-result-overlay" role="dialog" aria-modal="true" aria-labelledby="lc-result-title">
      <Confetti />
      <div className="result-card lc-result lc-pop-in" data-testid="lc-result">
        <div className="trophy" aria-hidden="true">
          🏆
        </div>
        <h2 id="lc-result-title">{playerName(winner)} 우승!</h2>
        <ol className="lc-score-table">
          {state.rankings.map((pi, rank) => {
            const p = state.players[pi];
            const c = SEAT_COLORS[p.seat];
            return (
              <li key={pi} style={{ animationDelay: `${0.25 + rank * 0.15}s` }} className={rank === 0 ? 'lc-row-winner' : ''}>
                <span className="medal">{MEDALS[rank]}</span>
                <span className="dot" style={{ background: c.main }} />
                <strong>{playerName(p)}</strong>
                <MiniHand state={state} index={pi} />
                <span className="lc-row-total">{points ? `${p.score}점` : p.hand.length === 0 ? `+${state.roundResult?.points ?? 0}점` : `${handPoints(p.hand)}점 남음`}</span>
              </li>
            );
          })}
        </ol>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} data-testid="lc-restart">
            같은 설정으로 다시 하기
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
