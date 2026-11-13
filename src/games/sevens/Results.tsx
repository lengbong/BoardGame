import type { CSSProperties } from 'react';
import { Confetti } from '../../components/Confetti';
import { PlayingCardFace } from '../../components/PlayingCard';
import { SEAT_COLORS } from '../common/players';
import { sortCards } from '../common/playingCards';
import { playerName } from './rules';
import type { SevensState } from './types';

const MEDALS = ['🥇', '🥈', '🥉', '4등'];

function MiniHand({ state, index }: { state: SevensState; index: number }) {
  const p = state.players[index];
  if (p.status === 'out') return <span className="sv-mini-hand sv-mini-note">통과를 다 써서 탈락</span>;
  const hand = sortCards(p.hand);
  if (hand.length === 0) return <span className="sv-mini-hand sv-mini-note">다 냈어요! 🎉</span>;
  return (
    <span className="sv-mini-hand">
      {hand.slice(0, 12).map((c) => (
        <PlayingCardFace key={c.id} card={c} variant="mini" />
      ))}
      {hand.length > 12 && <span className="sv-mini-more">+{hand.length - 12}</span>}
    </span>
  );
}

interface RoundOverProps {
  state: SevensState;
  canContinue: boolean;
  onNext: () => void;
}

/** 점수 모으기: 한 판이 끝났을 때 */
export function RoundOver({ state, canContinue, onNext }: RoundOverProps) {
  const result = state.roundResult!;
  const order = state.players.map((_, i) => i).sort((a, b) => state.players[b].score - state.players[a].score || a - b);
  const target = state.options.targetScore;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="sv-round-title">
      <div className="result-card sv-result sv-pop-in" data-testid="sv-roundover">
        <h2 id="sv-round-title">
          🎉 {playerName(state.players[result.winner])} 승리! <small>+{result.points}점</small>
        </h2>
        <p className="sv-result-sub">
          {state.round}번째 판 끝 · {target}점을 먼저 모으면 우승
        </p>
        <ol className="sv-score-table">
          {order.map((i) => {
            const p = state.players[i];
            const c = SEAT_COLORS[p.seat];
            return (
              <li key={i} className={i === result.winner ? 'sv-row-winner' : ''}>
                <span className="dot" style={{ background: c.main }} />
                <strong>{playerName(p)}</strong>
                <MiniHand state={state} index={i} />
                <span className="sv-row-points">{i === result.winner ? `+${result.points}` : `${result.handPoints[i]}점 남음`}</span>
                <span className="sv-row-total">
                  <span className="sv-score-bar" style={{ '--ratio': Math.min(1, p.score / target), '--sc': c.main } as CSSProperties} />
                  {p.score}점
                </span>
              </li>
            );
          })}
        </ol>
        <div className="result-actions">
          {canContinue ? (
            <button type="button" className="btn btn-primary btn-large" onClick={onNext} data-testid="sv-next-round">
              다음 판 시작 <kbd>Enter</kbd>
            </button>
          ) : (
            <p className="sv-result-sub">곧 다음 판이 시작돼요…</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface GameOverProps {
  state: SevensState;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

export function GameOver({ state, onRestart, onChangeSetup, onExit }: GameOverProps) {
  const winner = state.players[state.rankings[0]];
  const points = state.options.endMode === 'points';
  return (
    <div className="overlay sv-result-overlay" role="dialog" aria-modal="true" aria-labelledby="sv-result-title">
      <Confetti />
      <div className="result-card sv-result sv-pop-in" data-testid="sv-result">
        <div className="sv-trophy" aria-hidden="true">
          🏆
        </div>
        <h2 id="sv-result-title">{playerName(winner)} {points ? '우승!' : '1등!'}</h2>
        <ol className="sv-score-table">
          {state.rankings.map((pi, rank) => {
            const p = state.players[pi];
            const c = SEAT_COLORS[p.seat];
            return (
              <li key={pi} style={{ animationDelay: `${0.25 + rank * 0.15}s` }} className={rank === 0 ? 'sv-row-winner' : ''}>
                <span className="medal">{MEDALS[rank]}</span>
                <span className="dot" style={{ background: c.main }} />
                <strong>{playerName(p)}</strong>
                <MiniHand state={state} index={pi} />
                <span className="sv-row-total">
                  {points ? `${p.score}점` : p.status === 'playing' ? `${p.hand.length}장 남음` : ''}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} data-testid="sv-restart">
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
