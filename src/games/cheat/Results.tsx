import { Confetti } from '../../components/Confetti';
import { withJosa } from '../../lib/korean';
import { SEAT_COLORS } from '../common/players';
import { playerName, rankings } from './rules';
import type { CheatState } from './types';

const MEDALS = ['🥇', '🥈', '🥉', '4등'];

interface GameOverProps {
  state: CheatState;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

/** 가장 눈에 띄는 기록에 붙이는 별명 */
function titles(state: CheatState): Map<number, string> {
  const out = new Map<number, string>();
  const best = (score: (i: number) => number, label: string) => {
    const scores = state.players.map((_, i) => score(i));
    const top = Math.max(...scores);
    if (top <= 0) return;
    const who = scores.indexOf(top);
    if (scores.filter((s) => s === top).length === 1 && !out.has(who)) out.set(who, label);
  };
  best((i) => state.players[i].stats.rightDoubts, '🕵️ 명탐정');
  best((i) => state.players[i].stats.lies - state.players[i].stats.caught, '🎭 포커페이스');
  best((i) => state.players[i].stats.pickups, '🧺 더미 수집가');
  return out;
}

export function GameOver({ state, onRestart, onChangeSetup, onExit }: GameOverProps) {
  const order = rankings(state);
  const winner = state.players[order[0]];
  const humans = state.players.filter((p) => p.kind === 'human');
  const humanLost = humans.length === 1 && winner.kind !== 'human';
  const names = titles(state);

  return (
    <div className="overlay ch-result-overlay" role="dialog" aria-modal="true" aria-labelledby="ch-result-title">
      {!humanLost && <Confetti />}
      <div className="result-card ch-result" data-testid="ch-result">
        <div className="trophy" aria-hidden="true">
          {humanLost ? '🤥' : '🏆'}
        </div>
        <h2 id="ch-result-title">{playerName(winner)} 우승!</h2>
        <p className="ch-result-sub">
          {humanLost ? '아깝다! 거짓말은 한 장씩, 마지막 카드는 진짜로 내 보세요 😉' : `${withJosa(playerName(winner), '이/가')} 카드를 가장 먼저 다 냈어요!`}
        </p>
        <ol className="ch-rank-list">
          {order.map((pi, rank) => {
            const p = state.players[pi];
            const st = p.stats;
            return (
              <li key={pi} className={rank === 0 ? 'ch-rank-winner' : ''} style={{ animationDelay: `${0.3 + rank * 0.15}s` }}>
                <span className="medal">{MEDALS[rank]}</span>
                <span className="dot" style={{ background: SEAT_COLORS[p.seat].main }} />
                <span className="ch-rank-name">
                  <strong>{playerName(p)}</strong>
                  {names.has(pi) && <em>{names.get(pi)}</em>}
                  <small>
                    거짓말 {st.lies}번 (들킴 {st.caught}) · 의심 {st.doubts}번 (맞힘 {st.rightDoubts})
                  </small>
                </span>
                <span className="ch-rank-note">{rank === 0 ? '다 냈어요!' : `${p.hand.length}장 남음`}</span>
              </li>
            );
          })}
        </ol>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} data-testid="ch-restart">
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
