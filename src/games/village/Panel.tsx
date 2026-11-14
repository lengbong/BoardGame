import { GameControls } from '../../components/GameControls';
import { ShapeIcon } from '../../components/shapes';
import { withJosa } from '../../lib/korean';
import { KIND_LABEL, SEAT_COLORS } from '../common/players';
import type { GameSettings } from '../common/settings';
import { playerName } from './rules';
import { SEAT_SHAPES, TileIcon } from './TileArt';
import { FEATURE_NAMES, TILES } from './tiles';
import type { VillageState } from './types';

interface PanelProps {
  state: VillageState;
  hint: string;
  thinking: boolean;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onToggleSpots: () => void;
  onNewGame: () => void;
  onExit: () => void;
}

/** 깃발 개수를 작은 깃발 그림으로 */
function FlagRow({ count, total, color }: { count: number; total: number; color: string }) {
  return (
    <span className="vl-flag-row" aria-label={`남은 깃발 ${count}개`} title={`남은 깃발 ${count}개 / ${total}개`}>
      {Array.from({ length: total }, (_, i) => (
        <svg key={i} viewBox="0 0 10 14" width={8} height={12} className={i < count ? '' : 'vl-flag-used'} aria-hidden="true">
          <path d="M1 13 V1" stroke="#6b4a2b" strokeWidth={1.4} />
          <path d="M1.6 1.2 L9 3.8 L1.6 6.4 Z" fill={i < count ? color : 'none'} stroke={i < count ? 'rgba(0,0,0,0.35)' : 'currentColor'} strokeWidth={0.7} />
        </svg>
      ))}
    </span>
  );
}

/** 바로 앞 차례 요약 한 줄 */
function lastTurnText(state: VillageState): string | null {
  const t = state.lastTurn;
  if (!t) return null;
  const who = playerName(state.players[t.player]);
  let text = `${withJosa(who, '이/가')} ${withJosa(TILES[t.t].name, '을/를')} 놓았어요`;
  if (t.flag) text += ` · ${FEATURE_NAMES[t.flag]}에 🚩`;
  const gains = t.gains.filter((g) => g.points > 0);
  if (gains.length > 0) text += ` · ${gains.map((g) => `${playerName(state.players[g.player])} +${g.points}`).join(', ')}`;
  return text + '.';
}

export function Panel({ state, hint, thinking, settings, onSettings, onToggleSpots, onNewGame, onExit }: PanelProps) {
  const over = state.phase === 'gameover';
  const shownIndex = over ? (state.winners[0] ?? 0) : state.current;
  const shown = state.players[shownIndex];
  const color = SEAT_COLORS[shown.seat];
  const recent = state.log.slice(-16).reverse();
  const summary = lastTurnText(state);
  const top = Math.max(...state.players.map((p) => p.score));

  return (
    <aside className="panel vl-panel">
      <section className="turn-card" style={{ borderColor: color.main, background: color.light }}>
        <div className="turn-title">
          <ShapeIcon shape={SEAT_SHAPES[shown.seat]} color={color.main} size={20} />
          <strong data-testid="vl-turn-name">{over && state.winners.length > 1 ? '공동 우승' : playerName(shown)}</strong>
          <span>{over ? (state.winners.length > 1 ? '' : '우승!') : state.phase === 'flag' ? '깃발' : '차례'}</span>
          {!over && shown.kind !== 'human' && <span className="tag">컴퓨터</span>}
          {thinking && <span className="vl-dots" aria-hidden="true" />}
        </div>
        <p className="hint" data-testid="vl-hint">
          {hint}
        </p>
        {summary && !over && <p className="vl-summary">방금: {summary}</p>}
      </section>

      <section className="players vl-players">
        <h2>
          플레이어 <span className="vl-stack-note">남은 조각 {state.stack.length}장</span>
        </h2>
        <ul>
          {state.players.map((p, i) => {
            const c = SEAT_COLORS[p.seat];
            return (
              <li key={p.seat} className={!over && i === state.current ? 'is-current' : ''} data-testid={`vl-player-${i}`}>
                <ShapeIcon shape={SEAT_SHAPES[p.seat]} color={c.main} size={16} />
                <span className="vl-player-text">
                  <span className="player-name">
                    {playerName(p)}
                    {over && p.score === top && ' 🏆'}
                  </span>
                  <span className="player-kind">{KIND_LABEL[p.kind]}</span>
                  <FlagRow count={p.flags} total={state.options.flags} color={c.main} />
                </span>
                <span className="vl-player-hand" aria-label={`손 조각: ${p.hand.map((t) => TILES[t].name).join(', ') || '없음'}`}>
                  {p.hand.map((t, k) => (
                    <TileIcon key={k} t={t} size={26} />
                  ))}
                </span>
                <span className="vl-score" title="점수">
                  {p.score}
                  <small>점</small>
                </span>
              </li>
            );
          })}
        </ul>
        <label className="vl-toggle">
          <input type="checkbox" checked={state.options.showSpots} onChange={onToggleSpots} />
          놓을 수 있는 자리 반짝이기
        </label>
      </section>

      <section className="log vl-log">
        <h2>진행 기록</h2>
        <ol>
          {recent.map((e) => (
            <li key={e.id}>
              {e.seat !== null && <span className="dot small" style={{ background: SEAT_COLORS[e.seat].main }} />}
              {e.text}
            </li>
          ))}
        </ol>
      </section>

      <GameControls settings={settings} onSettings={onSettings} onNewGame={onNewGame} onExit={onExit} />
    </aside>
  );
}
