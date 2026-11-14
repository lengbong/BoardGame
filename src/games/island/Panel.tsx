import type { ReactNode } from 'react';
import { GameControls } from '../../components/GameControls';
import { ShapeIcon } from '../../components/shapes';
import { KIND_LABEL, SEAT_COLORS } from '../common/players';
import type { GameSettings } from '../common/settings';
import { FlagIcon, LighthouseIcon, ResourceIcon, SEAT_SHAPES } from './Art';
import { RESOURCES, RES_INFO, actor, playerName, pointsOf, touchedHexes } from './rules';
import type { IslandState, ResourceCount } from './types';

interface PanelProps {
  state: IslandState;
  hint: ReactNode;
  /** 지난 차례 요약 */
  summary: string | null;
  /** 화면에 보여 줄 자원 수 (날아오는 중인 것은 빼고) */
  shownRes: ResourceCount[];
  reg: (key: string) => (el: HTMLElement | null) => void;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onNewGame: () => void;
  onExit: () => void;
}

const PHASE_TEXT: Record<IslandState['phase'], string> = {
  setup: '처음 집 놓기',
  roll: '주사위를 굴릴 차례',
  choose: '쓸 눈 고르기',
  main: '짓기·바꾸기',
  discard: '자원 내려놓기',
  gameover: '끝',
};

export function Panel({ state, hint, summary, shownRes, reg, settings, onSettings, onNewGame, onExit }: PanelProps) {
  const act = actor(state);
  const shownIndex = state.phase === 'gameover' ? (state.winner ?? 0) : state.current;
  const shown = state.players[shownIndex];
  const color = SEAT_COLORS[shown.seat];
  const recent = state.log.slice(-16).reverse();
  const target = state.options.target;

  return (
    <aside className="panel is-panel">
      <section className="turn-card" style={{ borderColor: color.main, background: color.light }}>
        <div className="turn-title">
          <ShapeIcon shape={SEAT_SHAPES[shown.seat]} color={color.main} size={16} />
          <strong data-testid="is-turn-name">{playerName(shown)}</strong>
          <span>{state.phase === 'gameover' ? '우승!' : '차례'}</span>
          {shown.kind !== 'human' && state.phase !== 'gameover' && <span className="tag">컴퓨터</span>}
        </div>
        <p className="is-turn-sub">
          {state.phase === 'setup' ? `${PHASE_TEXT.setup} (${Math.min(state.setupStep + 1, state.setupOrder.length)}/${state.setupOrder.length})` : `${state.round}바퀴째 · ${PHASE_TEXT[state.phase]}`}
        </p>
        <div className="hint" data-testid="is-hint">
          {hint}
        </div>
        {summary && <p className="is-summary">{summary}</p>}
      </section>

      <section className="players is-players">
        <h2>
          플레이어 <small>목표 {target}점</small>
        </h2>
        <ul>
          {state.players.map((p, i) => {
            const c = SEAT_COLORS[p.seat];
            const pts = pointsOf(state, i);
            const hexes = touchedHexes(state, i).size;
            return (
              <li key={p.seat} className={`is-prow${i === act ? ' is-current' : ''}`} data-testid={`is-player-${i}`}>
                <div className="is-prow-top">
                  <ShapeIcon shape={SEAT_SHAPES[p.seat]} color={c.main} size={14} />
                  <span className="player-name">{playerName(p)}</span>
                  <span className="player-kind">{KIND_LABEL[p.kind]}</span>
                  <span className="is-pts" aria-label={`${pts.total}점`}>
                    {state.winner === i && '🏆 '}
                    <b>{pts.total}</b>
                    <small>/{target}점</small>
                  </span>
                </div>
                <div className="is-prow-res">
                  {RESOURCES.map((r) => (
                    <span key={r} className="is-pres" ref={reg(`pres-${i}-${r}`)} title={RES_INFO[r].name}>
                      <ResourceIcon res={r} size={15} />
                      {shownRes[i]?.[r] ?? p.res[r]}
                    </span>
                  ))}
                  <span className="is-badges">
                    <span className="is-badge" title="건물이 닿은 서로 다른 땅 칸 (축제 깃발)">
                      🗺️{hexes}
                    </span>
                    {pts.lighthouse && (
                      <span className="is-badge" title="등대 (+2점, 은행 2:1)">
                        <LighthouseIcon size={16} color={c.main} dark={c.dark} />
                      </span>
                    )}
                    {pts.flag && (
                      <span className="is-badge is-badge-flag" title="바다 축제 깃발 (+2점)">
                        <FlagIcon size={15} />
                      </span>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="log is-log">
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
