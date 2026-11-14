import { Confetti } from '../../components/Confetti';
import { ShapeIcon } from '../../components/shapes';
import { withJosa } from '../../lib/korean';
import { SEAT_COLORS } from '../common/players';
import { FlagIcon, SEAT_SHAPES } from './Art';
import { playerName, pointsOf, rankings, touchedHexes } from './rules';
import type { IslandState } from './types';

const MEDALS = ['🥇', '🥈', '🥉', '4등'];

interface GameOverProps {
  state: IslandState;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

/** 가장 눈에 띄는 기록에 붙이는 별명 */
function titles(state: IslandState): Map<number, string> {
  const out = new Map<number, string>();
  const best = (score: (i: number) => number, label: string) => {
    const scores = state.players.map((_, i) => score(i));
    const top = Math.max(...scores);
    if (top <= 0) return;
    const who = scores.indexOf(top);
    if (scores.filter((s) => s === top).length === 1 && !out.has(who)) out.set(who, label);
  };
  best((i) => state.players[i].stats.produced, '🌾 부지런한 농부');
  best((i) => state.players[i].stats.roads, '🛤️ 길 닦는 일꾼');
  best((i) => state.players[i].stats.trades, '🧺 장터 단골');
  return out;
}

export function GameOver({ state, onRestart, onChangeSetup, onExit }: GameOverProps) {
  const order = rankings(state);
  const winner = state.players[order[0]];
  const humans = state.players.filter((p) => p.kind === 'human');
  const humanLost = humans.length === 1 && winner.kind !== 'human';
  const names = titles(state);
  const byLimit = state.log.at(-1)?.text.startsWith('🏁') ?? false;

  return (
    <div className="overlay is-result-overlay" role="dialog" aria-modal="true" aria-labelledby="is-result-title">
      {!humanLost && <Confetti />}
      <div className="result-card is-result" data-testid="is-result">
        <div className="trophy" aria-hidden="true">
          {humanLost ? '🌊' : '🏝️'}
        </div>
        <h2 id="is-result-title">{playerName(winner)} 우승!</h2>
        <p className="is-result-sub">
          {byLimit
            ? '오래 걸려서 점수가 가장 높은 사람이 이겼어요.'
            : humanLost
              ? '아깝다! 처음 집은 숫자가 다른 땅 3칸에 닿게, 남는 자원은 장터와 은행에서 바꿔 보세요 😉'
              : `${withJosa(playerName(winner), '이/가')} 목표 점수를 먼저 모아 섬마을을 꾸몄어요!`}
        </p>
        <ol className="is-rank-list">
          {order.map((pi, rank) => {
            const p = state.players[pi];
            const pts = pointsOf(state, pi);
            const c = SEAT_COLORS[p.seat];
            return (
              <li key={pi} className={rank === 0 ? 'is-rank-winner' : ''} style={{ animationDelay: `${0.3 + rank * 0.15}s` }}>
                <span className="medal">{MEDALS[rank]}</span>
                <ShapeIcon shape={SEAT_SHAPES[p.seat]} color={c.main} size={16} />
                <span className="is-rank-name">
                  <strong>{playerName(p)}</strong>
                  {names.has(pi) && <em>{names.get(pi)}</em>}
                  <small>
                    🏠 집 {pts.houses} · 🏛️ 회관 {pts.halls}
                    {pts.lighthouse && ' · 🔆 등대'}
                    {pts.flag && ' · 🚩 깃발'} · 🗺️ 땅 {touchedHexes(state, pi).size}칸 · 받은 자원 {p.stats.produced}개
                  </small>
                </span>
                <span className="is-rank-pts">
                  {pts.flag && <FlagIcon size={16} />}
                  <b>{pts.total}</b>점
                </span>
              </li>
            );
          })}
        </ol>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} data-testid="is-restart">
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
