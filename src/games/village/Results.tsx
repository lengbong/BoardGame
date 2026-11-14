import { Confetti } from '../../components/Confetti';
import { ShapeIcon } from '../../components/shapes';
import { withJosa } from '../../lib/korean';
import { SEAT_COLORS } from '../common/players';
import { playerName, rankings } from './rules';
import { SEAT_SHAPES } from './TileArt';
import type { VillageState } from './types';

const MEDALS = ['🥇', '🥈', '🥉', '4등'];

interface ResultsProps {
  state: VillageState;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
  onViewMap: () => void;
}

/** 가장 눈에 띄는 기록에 붙이는 별명 (한 사람만 가장 높을 때) */
function titles(state: VillageState): Map<number, string> {
  const out = new Map<number, string>();
  const best = (score: (i: number) => number, label: string) => {
    const scores = state.players.map((_, i) => score(i));
    const top = Math.max(...scores);
    if (top <= 0) return;
    const who = scores.indexOf(top);
    if (scores.filter((s) => s === top).length === 1 && !out.has(who)) out.set(who, label);
  };
  best((i) => state.players[i].stats.paddy, '🌾 논 부자');
  best((i) => state.players[i].stats.path, '🛤️ 길 닦는 이');
  best((i) => state.players[i].stats.stream, '🐟 냇물 지킴이');
  best((i) => state.players[i].stats.jangseung, '🪵 장승 장인');
  return out;
}

export function Results({ state, onRestart, onChangeSetup, onExit, onViewMap }: ResultsProps) {
  const order = rankings(state);
  const winners = state.winners;
  const humans = state.players.map((p, i) => (p.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  const humanLost = humans.length === 1 && !winners.includes(humans[0]);
  const names = titles(state);
  const top = state.players[order[0]];
  const title = winners.length > 1 ? `${winners.map((w) => playerName(state.players[w])).join(' · ')} 공동 우승!` : `${playerName(top)} 우승!`;
  // 같은 점수는 같은 등수
  const place = order.map((pi) => state.players.filter((p) => p.score > state.players[pi].score).length);

  return (
    <div className="overlay vl-result-overlay" role="dialog" aria-modal="true" aria-labelledby="vl-result-title">
      {!humanLost && <Confetti />}
      <div className="result-card vl-result" data-testid="vl-result">
        <div className="trophy" aria-hidden="true">
          {humanLost ? '🗺️' : '🏆'}
        </div>
        <h2 id="vl-result-title">{title}</h2>
        <p className="vl-result-sub">
          {humanLost ? '아깝다! 깃발은 완성될 것 같은 곳에 꽂고, 다 쓰지 말고 한두 개 남겨 두세요 😉' : `${withJosa(playerName(top), '이/가')} ${top.score}점으로 마을 지도를 가장 잘 그렸어요!`}
        </p>
        <ol className="vl-rank-list">
          {order.map((pi, k) => {
            const p = state.players[pi];
            const st = p.stats;
            return (
              <li key={pi} className={winners.includes(pi) ? 'vl-rank-winner' : ''} style={{ animationDelay: `${0.3 + k * 0.15}s` }}>
                <span className="medal">{MEDALS[place[k]]}</span>
                <ShapeIcon shape={SEAT_SHAPES[p.seat]} color={SEAT_COLORS[p.seat].main} size={18} />
                <span className="vl-rank-name">
                  <strong>{playerName(p)}</strong>
                  {names.has(pi) && <em>{names.get(pi)}</em>}
                  <small>
                    길 {st.path} · 냇물 {st.stream} · 논 {st.paddy}
                    {state.options.jangseung && ` · 장승 ${st.jangseung}`} · 미완성 {st.final}
                  </small>
                </span>
                <span className="vl-rank-score">
                  {p.score}
                  <small>점</small>
                </span>
              </li>
            );
          })}
        </ol>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} data-testid="vl-restart">
            같은 설정으로 다시 하기
          </button>
          <button type="button" className="btn" onClick={onChangeSetup}>
            설정 바꾸기
          </button>
          <button type="button" className="btn" onClick={onViewMap} data-testid="vl-view-map">
            지도 구경하기
          </button>
          <button type="button" className="btn" onClick={onExit}>
            처음 화면
          </button>
        </div>
      </div>
    </div>
  );
}
