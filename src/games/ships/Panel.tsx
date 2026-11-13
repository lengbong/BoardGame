import type { ReactNode } from 'react';
import { GameControls } from '../../components/GameControls';
import { DUEL_KIND_LABEL } from '../common/duel';
import type { GameSettings } from '../common/settings';
import { FLEETS } from './fleet';
import { SIDES, playerStats, sunkShips } from './rules';
import { ShipIcon } from './ShipArt';
import type { ShipsState, Side } from './types';

interface PanelProps {
  state: ShipsState;
  hint: string;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onNewGame: () => void;
  onExit: () => void;
  /** 차례 카드 아래에 붙일 버튼 (예: 결과 다시 보기) */
  extra?: ReactNode;
}

function lighten(hex: string): string {
  return `color-mix(in srgb, ${hex} 14%, #ffffff)`;
}

export function Panel({ state, hint, settings, onSettings, onNewGame, onExit, extra }: PanelProps) {
  const { phase } = state;
  const who: Side = phase === 'place' ? (state.placing ?? 0) : phase === 'gameover' ? (state.winner ?? 0) : state.current;
  const side = SIDES[who];
  const player = state.players[who];
  const status = phase === 'place' ? '배 숨기는 중' : phase === 'gameover' ? '승리!' : '차례';
  const recent = state.log.slice(-14).reverse();
  const specs = FLEETS[state.options.size];

  return (
    <aside className="panel sh-panel">
      <section className="turn-card" style={{ borderColor: side.color, background: lighten(side.color) }}>
        <div className="turn-title">
          <span className="dot" style={{ background: side.color }} />
          <strong data-testid="sh-turn-name">{player.name}</strong>
          <span>{status}</span>
          {player.kind !== 'human' && <span className="tag">컴퓨터</span>}
        </div>
        <p className="sh-rule-line">
          {state.options.size}×{state.options.size} 바다
          {state.options.noTouch ? ' · 붙이지 않기' : ''}
          {state.options.extraTurn ? ' · 맞히면 한 번 더' : ''}
        </p>
        <p className="hint">{hint}</p>
        {extra}
      </section>

      <section className="sh-fleets">
        <h2>함대 현황</h2>
        {([0, 1] as Side[]).map((i) => {
          const p = state.players[i];
          const sunk = new Set(sunkShips(state, i).map((s) => s.id));
          const stats = playerStats(state, i);
          const active = phase === 'battle' && state.current === i;
          return (
            <div key={i} className={`sh-fleet${active ? ' sh-fleet-active' : ''}`} style={{ borderColor: active ? SIDES[i].color : undefined }}>
              <div className="sh-fleet-head">
                <span className="dot" style={{ background: SIDES[i].color }} />
                <strong>{p.name}</strong>
                <span className="player-kind">{DUEL_KIND_LABEL[p.kind]}</span>
                <span className="sh-fleet-count" title="떠 있는 배">
                  {p.ready ? `${specs.length - sunk.size}/${specs.length}척` : '숨기는 중'}
                </span>
              </div>
              <ul className="sh-chips" aria-label={`${p.name} 배`}>
                {specs.map((spec) => {
                  const down = sunk.has(spec.id);
                  return (
                    <li key={spec.id} className={down ? 'sh-chip sh-chip-sunk' : 'sh-chip'} title={`${spec.name} ${spec.length}칸${down ? ' — 격침' : ''}`}>
                      <ShipIcon id={spec.id} cell={7} />
                      <span>{spec.name}</span>
                      {down && (
                        <span className="sh-chip-x" aria-label="격침">
                          ✕
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="sh-stats">
                🎯 발사 <b>{stats.shots}</b> · 명중 <b>{stats.hits}</b> · 명중률 <b>{stats.accuracy}%</b>
              </p>
            </div>
          );
        })}
      </section>

      <section className="log">
        <h2>진행 기록</h2>
        <ol>
          {recent.map((e) => (
            <li key={e.id}>
              {e.side !== null && <span className="dot small" style={{ background: SIDES[e.side].color }} />}
              {e.text}
            </li>
          ))}
        </ol>
      </section>

      <GameControls settings={settings} onSettings={onSettings} onNewGame={onNewGame} onExit={onExit} />
    </aside>
  );
}
