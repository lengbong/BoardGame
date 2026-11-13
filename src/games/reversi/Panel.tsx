import type { CSSProperties, ReactNode } from 'react';
import { GameControls } from '../../components/GameControls';
import { DUEL_KIND_LABEL } from '../common/duel';
import type { GameSettings } from '../common/settings';
import { DiscFace, SIDE_CARD } from './DiscArt';
import { playerName } from './rules';
import type { Disc, ReversiState } from './types';

interface PanelProps {
  state: ReversiState;
  hint: ReactNode;
  thinking: boolean;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  canUndo: boolean;
  showUndo: boolean;
  onUndo: () => void;
  onToggleHints: () => void;
  onNewGame: () => void;
  onExit: () => void;
}

export function Panel(props: PanelProps) {
  const { state } = props;
  const active = state.phase === 'play';
  const shown: Disc = active ? state.current : (state.winner ?? state.current);
  const card = SIDE_CARD[shown];
  const total = state.size * state.size;
  const [b, w] = state.counts;
  const recent = state.log.slice(-14).reverse();

  let title: string;
  if (active) title = '차례';
  else if (state.winner === null) title = '무승부';
  else title = '승리!';

  return (
    <aside className="panel rv-panel">
      <section className="turn-card" style={{ borderColor: card.border, background: card.bg }}>
        <div className="turn-title">
          <span className="rv-turn-disc">{active || state.winner !== null ? <DiscFace side={shown} /> : '🤝'}</span>
          <strong data-testid="rv-turn-name">{active || state.winner !== null ? playerName(state, shown) : '비겼어요'}</strong>
          <span>{title}</span>
          {active && state.players[shown].kind !== 'human' && <span className="tag">컴퓨터</span>}
        </div>
        <p className="rv-sub">
          {state.size}×{state.size} 판 · {state.turn - 1}수째{props.thinking && <span className="rv-thinking" aria-hidden="true" />}
        </p>
        <p className="hint" data-testid="rv-hint">
          {props.hint}
        </p>
      </section>

      <section className="players rv-players">
        <h2>돌 수</h2>
        <ul>
          {([0, 1] as const).map((side) => (
            <li key={side} className={active && state.current === side ? 'is-current' : ''}>
              <span className="rv-player-disc">
                <DiscFace side={side} />
              </span>
              <span className="player-name">{playerName(state, side)}</span>
              <span className="player-kind">
                {side === 0 ? '흑' : '백'} · {DUEL_KIND_LABEL[state.players[side].kind]}
              </span>
              <strong className="rv-count" data-testid={`rv-count-${side}`}>
                {state.counts[side]}
              </strong>
            </li>
          ))}
        </ul>
        <div
          className="rv-tug"
          style={{ '--b': b / total, '--w': w / total } as CSSProperties}
          role="img"
          aria-label={`흑 ${b}개, 백 ${w}개, 빈칸 ${total - b - w}개`}
        >
          <span className="rv-tug-b" />
          <span className="rv-tug-empty" />
          <span className="rv-tug-w" />
        </div>
        <label className="rv-toggle">
          <input type="checkbox" checked={state.options.hints} onChange={props.onToggleHints} />
          둘 수 있는 곳 표시 <kbd>H</kbd>
        </label>
      </section>

      <section className="log rv-log">
        <h2>진행 기록</h2>
        <ol>
          {recent.map((e) => (
            <li key={e.id}>
              {e.side !== null && (
                <span className="rv-log-disc">
                  <DiscFace side={e.side} />
                </span>
              )}
              {e.text}
            </li>
          ))}
        </ol>
      </section>

      <GameControls settings={props.settings} onSettings={props.onSettings} onNewGame={props.onNewGame} onExit={props.onExit}>
        {props.showUndo && (
          <button type="button" className="btn" onClick={props.onUndo} disabled={!props.canUndo} data-testid="rv-undo" title="내가 둔 마지막 수를 되돌려요">
            ↶ 무르기 <kbd>U</kbd>
          </button>
        )}
      </GameControls>
    </aside>
  );
}
