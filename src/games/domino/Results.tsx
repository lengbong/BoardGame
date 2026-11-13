import type { CSSProperties } from 'react';
import { Confetti } from '../../components/Confetti';
import { SEAT_COLORS } from '../common/players';
import { DominoFace } from './DominoArt';
import { sortHand } from './dominoes';
import { playerName } from './rules';
import type { DominoState } from './types';

const MEDALS = ['🥇', '🥈', '🥉', '4등'];

function MiniHand({ state, index, pipColors }: { state: DominoState; index: number; pipColors: boolean }) {
  const hand = sortHand(state.players[index].hand);
  if (hand.length === 0) return <span className="dm-mini-hand dm-mini-done">다 냈어요! 🎉</span>;
  return (
    <span className="dm-mini-hand">
      {hand.slice(0, 12).map((t) => (
        <span key={t.id} className="dm-mini dm-mini-result">
          <DominoFace a={t.a} b={t.b} vertical colors={pipColors} />
        </span>
      ))}
      {hand.length > 12 && <span className="dm-seat-more">+{hand.length - 12}</span>}
    </span>
  );
}

function headline(state: DominoState): { icon: string; title: string; sub: string } {
  const r = state.roundResult!;
  if (r.winner === null) {
    const names = r.tied.map((i) => playerName(state.players[i])).join(', ');
    return { icon: '🤝', title: '비겼어요!', sub: `막혔는데 ${names}의 남은 점과 패 수가 똑같아요. 아무도 점수를 얻지 못해요.` };
  }
  const name = playerName(state.players[r.winner]);
  if (r.reason === 'blocked') return { icon: '🚧', title: `막혔어요! ${name} 승리`, sub: '아무도 낼 수 없어서, 남은 점이 가장 적은 사람이 이겼어요.' };
  return { icon: '🎉', title: `${name} 승리!`, sub: '패를 먼저 다 냈어요. 다른 사람들 손에 남은 점을 모두 가져가요.' };
}

interface RoundOverProps {
  state: DominoState;
  pipColors: boolean;
  canContinue: boolean;
  onNext: () => void;
}

/** 점수 모으기: 한 판이 끝났을 때 */
export function RoundOver({ state, pipColors, canContinue, onNext }: RoundOverProps) {
  const result = state.roundResult!;
  const order = state.players.map((_, i) => i).sort((a, b) => state.players[b].score - state.players[a].score || a - b);
  const target = state.options.targetScore;
  const head = headline(state);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="dm-round-title">
      <div className="result-card dm-result dm-pop-in" data-testid="dm-roundover">
        <div className="dm-result-icon" aria-hidden="true">
          {head.icon}
        </div>
        <h2 id="dm-round-title">
          {head.title} {result.winner !== null && <small>+{result.points}점</small>}
        </h2>
        <p className="dm-result-sub">{head.sub}</p>
        <p className="dm-result-sub">
          {state.round}번째 판 끝 · {target}점을 먼저 모으면 우승
        </p>
        <ol className="dm-score-table">
          {order.map((i, rank) => {
            const p = state.players[i];
            const c = SEAT_COLORS[p.seat];
            return (
              <li key={i} className={i === result.winner ? 'dm-row-winner' : ''} style={{ animationDelay: `${0.1 + rank * 0.1}s` }}>
                <span className="dot" style={{ background: c.main }} />
                <strong className="dm-row-name">{playerName(p)}</strong>
                <MiniHand state={state} index={i} pipColors={pipColors} />
                <span className="dm-row-points">{i === result.winner ? `+${result.points}` : `남은 점 ${result.handPips[i]}`}</span>
                <span className="dm-row-total">
                  <span className="dm-score-bar" style={{ '--ratio': Math.min(1, p.score / target), '--pc': c.main } as CSSProperties} />
                  {p.score}점
                </span>
              </li>
            );
          })}
        </ol>
        <div className="result-actions">
          {canContinue ? (
            <button type="button" className="btn btn-primary btn-large" onClick={onNext} data-testid="dm-next-round">
              다음 판 시작 <kbd>Enter</kbd>
            </button>
          ) : (
            <p className="dm-result-sub">곧 다음 판이 시작돼요…</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface GameOverProps {
  state: DominoState;
  pipColors: boolean;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

export function GameOver({ state, pipColors, onRestart, onChangeSetup, onExit }: GameOverProps) {
  const result = state.roundResult;
  const points = state.options.endMode === 'points';
  const tie = !result || result.winner === null;
  const head = result ? headline(state) : null;
  return (
    <div className="overlay dm-result-overlay" role="dialog" aria-modal="true" aria-labelledby="dm-result-title">
      {!tie && <Confetti />}
      <div className="result-card dm-result dm-pop-in" data-testid="dm-result">
        <div className="trophy" aria-hidden="true">
          {tie ? '🤝' : '🏆'}
        </div>
        <h2 id="dm-result-title">{tie ? '비겼어요!' : `${playerName(state.players[state.rankings[0]])} 우승!`}</h2>
        {head && <p className="dm-result-sub">{head.sub}</p>}
        <ol className="dm-score-table">
          {state.rankings.map((pi, rank) => {
            const p = state.players[pi];
            const c = SEAT_COLORS[p.seat];
            let value: string;
            if (points) value = `${p.score}점`;
            else if (result && pi === result.winner) value = `+${result.points}점`;
            else value = `남은 점 ${result?.handPips[pi] ?? 0}`;
            return (
              <li key={pi} style={{ animationDelay: `${0.25 + rank * 0.15}s` }} className={!tie && rank === 0 ? 'dm-row-winner' : ''}>
                <span className="medal">{tie && result?.tied.includes(pi) ? '🤝' : MEDALS[rank]}</span>
                <span className="dot" style={{ background: c.main }} />
                <strong className="dm-row-name">{playerName(p)}</strong>
                <MiniHand state={state} index={pi} pipColors={pipColors} />
                <span className="dm-row-total">{value}</span>
              </li>
            );
          })}
        </ol>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} data-testid="dm-restart">
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
