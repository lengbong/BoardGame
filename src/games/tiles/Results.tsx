import { Confetti } from '../../components/Confetti';
import { SEAT_COLORS } from '../common/players';
import { TileFace } from './TileArt';
import { playerName } from './rules';
import { sortByColor } from './tiles';
import type { TilesState } from './types';

const MEDALS = ['🥇', '🥈', '🥉', '4등'];

function MiniRack({ state, index }: { state: TilesState; index: number }) {
  const rack = sortByColor(state.players[index].rack);
  if (rack.length === 0) return <span className="tl-mini-rack tl-mini-empty">다 냈어요! 🎉</span>;
  return (
    <span className="tl-mini-rack">
      {rack.slice(0, 16).map((t) => (
        <TileFace key={t.id} tile={t} />
      ))}
      {rack.length > 16 && <span className="tl-mini-more">+{rack.length - 16}</span>}
    </span>
  );
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export function RoundOver({ state, canContinue, onNext }: { state: TilesState; canContinue: boolean; onNext: () => void }) {
  const result = state.roundResult!;
  const order = state.players.map((_, i) => i).sort((a, b) => state.players[b].score - state.players[a].score || a - b);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="tl-round-title">
      <div className="result-card tl-result tl-pop-in" data-testid="tl-roundover">
        <h2 id="tl-round-title">
          🎉 {playerName(state.players[result.winner])} 승리! <small>{signed(result.deltas[result.winner])}점</small>
        </h2>
        <p className="tl-result-sub">
          {state.round} / {state.options.rounds}판 끝{result.blocked ? ' · 더 낼 사람이 없어서 남은 타일이 가장 적은 사람이 이겼어요' : ''}
        </p>
        <ol className="tl-score-table">
          {order.map((i) => (
            <li key={i} className={i === result.winner ? 'tl-row-winner' : ''}>
              <span className="dot" style={{ background: SEAT_COLORS[state.players[i].seat].main }} />
              <strong>{playerName(state.players[i])}</strong>
              <MiniRack state={state} index={i} />
              <span className="tl-row-delta">{signed(result.deltas[i])}</span>
              <span className="tl-row-total">{state.players[i].score}점</span>
            </li>
          ))}
        </ol>
        <div className="result-actions">
          {canContinue ? (
            <button type="button" className="btn btn-primary btn-large" onClick={onNext} data-testid="tl-next-round">
              다음 판 시작 <kbd>Enter</kbd>
            </button>
          ) : (
            <p className="tl-result-sub">곧 다음 판이 시작돼요…</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface GameOverProps {
  state: TilesState;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

export function GameOver({ state, onRestart, onChangeSetup, onExit }: GameOverProps) {
  const result = state.roundResult!;
  const rounds = state.options.endMode === 'rounds';
  return (
    <div className="overlay tl-result-overlay" role="dialog" aria-modal="true" aria-labelledby="tl-result-title">
      <Confetti />
      <div className="result-card tl-result tl-pop-in" data-testid="tl-result">
        <div className="tl-trophy" aria-hidden="true">
          🏆
        </div>
        <h2 id="tl-result-title">{playerName(state.players[state.rankings[0]])} 우승!</h2>
        {result.blocked && !rounds && <p className="tl-result-sub">더 낼 사람이 없어서 남은 타일이 가장 적은 사람이 이겼어요.</p>}
        <ol className="tl-score-table">
          {state.rankings.map((pi, rank) => (
            <li key={pi} style={{ animationDelay: `${0.25 + rank * 0.15}s` }} className={rank === 0 ? 'tl-row-winner' : ''}>
              <span className="medal">{MEDALS[rank]}</span>
              <span className="dot" style={{ background: SEAT_COLORS[state.players[pi].seat].main }} />
              <strong>{playerName(state.players[pi])}</strong>
              <MiniRack state={state} index={pi} />
              <span className="tl-row-total">{rounds ? `${state.players[pi].score}점` : `${signed(result.deltas[pi])}점`}</span>
            </li>
          ))}
        </ol>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} data-testid="tl-restart">
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
