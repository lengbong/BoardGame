import { Confetti } from '../../components/Confetti';
import { withJosa } from '../../lib/korean';
import { SEAT_COLORS } from '../common/players';
import { PlantPicture, Rosette } from './Art';
import { card } from './cards';
import { playerName, rankings, scoreParts } from './rules';
import type { GardenState } from './types';

const MEDALS = ['🥇', '🥈', '🥉', '4등'];

interface GameOverProps {
  state: GardenState;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

export function GameOver({ state, onRestart, onChangeSetup, onExit }: GameOverProps) {
  const order = rankings(state);
  const winners = state.winners;
  const humans = state.players.filter((p) => p.kind === 'human');
  const humanLost = humans.length === 1 && !winners.some((w) => state.players[w].kind === 'human');
  const shared = winners.length > 1;
  const names = winners.map((w) => playerName(state.players[w])).join(' · ');
  const top = state.players[winners[0]];
  // 점수가 같아서 식물 수로 가렸는지
  const tieBroken = !shared && order.length > 1 && scoreParts(state, order[0]).total === scoreParts(state, order[1]).total;

  // 등수: 점수와 식물 수가 같으면 같은 등수
  const place: number[] = [];
  order.forEach((pi, k) => {
    const prev = order[k - 1];
    const same = k > 0 && scoreParts(state, pi).total === scoreParts(state, prev).total && state.players[pi].garden.length === state.players[prev].garden.length;
    place.push(same ? place[k - 1] : k);
  });

  return (
    <div className="overlay gd-result-overlay" role="dialog" aria-modal="true" aria-labelledby="gd-result-title">
      {!humanLost && <Confetti />}
      <div className="result-card gd-result" data-testid="gd-result">
        <div className="trophy" aria-hidden="true">
          {humanLost ? '🌱' : '🏆'}
        </div>
        <h2 id="gd-result-title">{shared ? `${names} 함께 우승!` : `${names} 우승!`}</h2>
        <p className="gd-result-sub">
          {humanLost
            ? '아깝다! 처음엔 싼 식물로 생산을 늘리고, 나중엔 점수 큰 가을 식물을 노려 보세요 🌻'
            : shared
              ? '점수도 식물 수도 똑같아서 함께 우승이에요!'
              : tieBroken
                ? `점수가 같았지만 ${withJosa(playerName(top), '이/가')} 식물을 더 적게 심어서 이겼어요!`
                : `${withJosa(playerName(top), '이/가')} 가장 아름다운 정원을 가꿨어요!`}
        </p>
        <ol className="gd-rank-list">
          {order.map((pi, k) => {
            const p = state.players[pi];
            const parts = scoreParts(state, pi);
            const ribbons = state.ribbons.filter((r) => r.owner === pi);
            const best = [...p.garden].sort((a, b) => card(b).points - card(a).points).slice(0, 4);
            return (
              <li key={pi} className={place[k] === 0 ? 'gd-rank-winner' : ''} style={{ animationDelay: `${0.3 + k * 0.15}s` }}>
                <span className="medal">{MEDALS[place[k]]}</span>
                <span className="dot" style={{ background: SEAT_COLORS[p.seat].main }} />
                <span className="gd-rank-name">
                  <strong>{playerName(p)}</strong>
                  <small>
                    꽃 점수 {parts.plants}{parts.ribbons > 0 && ` · 상장 ${parts.ribbons}`}
                    {parts.bonus > 0 && ` · 허수아비 ${parts.bonus}`} · 심은 식물 {p.garden.length}장
                  </small>
                </span>
                <span className="gd-rank-art" aria-hidden="true">
                  {best.map((id) => (
                    <PlantPicture key={id} art={card(id).art} size={26} />
                  ))}
                  {ribbons.map((r) => (
                    <Rosette key={r.goal} goal={r.goal} size={26} />
                  ))}
                </span>
                <span className="gd-rank-score">{parts.total}점</span>
              </li>
            );
          })}
        </ol>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} data-testid="gd-restart">
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
