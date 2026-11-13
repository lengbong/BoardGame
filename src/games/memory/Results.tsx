import type { CSSProperties } from 'react';
import { Confetti } from '../../components/Confetti';
import { ShapeIcon } from '../../components/shapes';
import { SEAT_COLORS } from '../common/players';
import { MiniPile, SEAT_SHAPES } from './Panel';
import { computeRanks, playerName, rankingOrder, winners } from './rules';
import type { MemoryState } from './types';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

interface GameOverProps {
  state: MemoryState;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

export function GameOver({ state, onRestart, onChangeSetup, onExit }: GameOverProps) {
  const top = winners(state);
  const ranks = state.ranks.length ? state.ranks : computeRanks(state.players.map((p) => p.pairs.length));
  const order = rankingOrder(state);
  const title = top.length === 1 ? `${playerName(state.players[top[0]])} 우승!` : `${top.map((i) => playerName(state.players[i])).join(' · ')} 공동 우승!`;
  const humanWon = top.some((i) => state.players[i].kind === 'human');

  return (
    <div className="overlay mm-result-overlay" role="dialog" aria-modal="true" aria-labelledby="mm-result-title">
      <Confetti count={humanWon ? 110 : 60} />
      <div className="result-card mm-result" data-testid="mm-result">
        <div className="mm-trophy" aria-hidden="true">
          🏆
        </div>
        <h2 id="mm-result-title">{title}</h2>
        <p className="mm-result-sub">짝 {state.cards.length / 2}개를 모두 찾았어요!</p>
        <ol className="mm-score-table">
          {order.map((pi, k) => {
            const p = state.players[pi];
            const c = SEAT_COLORS[p.seat];
            const rank = ranks[pi];
            return (
              <li key={pi} className={rank === 1 ? 'is-winner' : ''} style={{ animationDelay: `${0.2 + k * 0.12}s` } as CSSProperties}>
                <span className="medal">{MEDALS[rank] ?? `${rank}등`}</span>
                <ShapeIcon shape={SEAT_SHAPES[p.seat]} color={c.main} size={16} />
                <strong>{playerName(p)}</strong>
                <MiniPile pics={p.pairs} max={18} className="mm-pile-wide" />
                <span className="mm-row-total">{p.pairs.length}짝</span>
              </li>
            );
          })}
        </ol>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} data-testid="mm-restart">
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
