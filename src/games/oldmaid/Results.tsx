import { Confetti } from '../../components/Confetti';
import { withJosa } from '../../lib/korean';
import { PlayingCardFace } from '../../components/PlayingCard';
import { SEAT_COLORS } from '../common/players';
import { makeJoker } from '../common/playingCards';
import { playerName, rankings } from './rules';
import type { OldMaidState } from './types';

const MEDALS = ['🥇', '🥈', '🥉', '4등'];

interface GameOverProps {
  state: OldMaidState;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

export function GameOver({ state, onRestart, onChangeSetup, onExit }: GameOverProps) {
  const order = rankings(state);
  const thief = state.thief !== null ? state.players[state.thief] : null;
  const winner = state.players[order[0]];
  const humans = state.players.filter((p) => p.kind === 'human');
  const humanThief = thief?.kind === 'human' && humans.length === 1;

  return (
    <div className="overlay om-result-overlay" role="dialog" aria-modal="true" aria-labelledby="om-result-title">
      <Confetti />
      <div className="result-card om-result om-pop-in" data-testid="om-result">
        {thief && (
          <div className="om-thief-reveal" aria-hidden="true">
            <span className="om-thief-card">
              <PlayingCardFace card={makeJoker()} />
            </span>
            <span className="om-thief-name" style={{ background: SEAT_COLORS[thief.seat].main }}>
              {playerName(thief)}
            </span>
          </div>
        )}
        <h2 id="om-result-title">{thief ? `도둑은 ${playerName(thief)}!` : '게임 끝!'}</h2>
        <p className="om-result-sub">
          {humanThief ? '아깝다! 다음엔 조커를 꼭 넘겨 보세요 😜' : `🥇 ${withJosa(playerName(winner), '이/가')} 가장 먼저 카드를 다 털었어요!`}
        </p>
        <ol className="om-rank-list">
          {order.map((pi, rank) => {
            const p = state.players[pi];
            const c = SEAT_COLORS[p.seat];
            const isThief = pi === state.thief;
            return (
              <li key={pi} className={isThief ? 'om-rank-thief' : rank === 0 ? 'om-rank-winner' : ''} style={{ animationDelay: `${0.35 + rank * 0.15}s` }}>
                <span className="medal">{isThief ? '🦹' : MEDALS[rank]}</span>
                <span className="dot" style={{ background: c.main }} />
                <strong>{playerName(p)}</strong>
                <span className="om-rank-note">{isThief ? '조커를 끝까지 들고 있었어요' : `${rank + 1}등으로 다 털었어요`}</span>
              </li>
            );
          })}
        </ol>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} data-testid="om-restart">
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
