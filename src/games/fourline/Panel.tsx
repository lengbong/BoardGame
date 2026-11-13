import type { ReactNode } from 'react';
import { GameControls } from '../../components/GameControls';
import { DUEL_KIND_LABEL } from '../common/duel';
import type { GameSettings } from '../common/settings';
import { SHAPE_NAME, SIDE_CARD, Stone } from './StoneArt';
import { SIDE_LABELS, playerName } from './rules';
import type { FourLineState, Side } from './types';

interface PanelProps {
  state: FourLineState;
  hint: ReactNode;
  thinking: boolean;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  showUndo: boolean;
  canUndo: boolean;
  onUndo: () => void;
  onToggleHints: () => void;
  onNewGame: () => void;
  onExit: () => void;
}

export function Panel(props: PanelProps) {
  const { state } = props;
  const active = state.phase === 'play';
  const shown: Side = active ? state.current : (state.winner ?? state.current);
  const card = SIDE_CARD[shown];
  const recent = state.log.slice(-14).reverse();
  const placed: [number, number] = [0, 0];
  for (const v of state.board) if (v !== -1) placed[v] += 1;

  return (
    <aside className="panel fl-panel">
      <section className="turn-card" style={{ borderColor: card.border, background: card.bg }}>
        <div className="turn-title">
          <span className="fl-turn-stone">{active || state.winner !== null ? <Stone side={shown} /> : '🤝'}</span>
          <strong data-testid="fl-turn-name">{active || state.winner !== null ? playerName(state, shown) : '비겼어요'}</strong>
          <span>{active ? '차례' : state.winner !== null ? '승리!' : ''}</span>
          {active && state.players[shown].kind !== 'human' && <span className="tag">컴퓨터</span>}
        </div>
        <p className="fl-sub">
          가로·세로·대각선으로 넷 잇기 · {state.moves.length}수째
          {props.thinking && <span className="fl-thinking" aria-hidden="true" />}
        </p>
        <p className="hint" data-testid="fl-hint">
          {props.hint}
        </p>
      </section>

      <section className="players fl-players">
        <h2>플레이어</h2>
        <ul>
          {([0, 1] as const).map((side) => (
            <li key={side} className={active && state.current === side ? 'is-current' : ''}>
              <span className="fl-player-stone">
                <Stone side={side} />
              </span>
              <span className="player-name">{playerName(state, side)}</span>
              <span className="player-kind">
                {SIDE_LABELS[side]} {SHAPE_NAME[side]} · {DUEL_KIND_LABEL[state.players[side].kind]}
              </span>
              <span className="fl-count" title="놓은 돌 수">
                {placed[side]}
              </span>
            </li>
          ))}
        </ul>
        <label className="fl-toggle" title="바로 이기는 곳(초록)과 꼭 막아야 할 곳(주황)을 알려 줘요">
          <input type="checkbox" checked={state.options.hints} onChange={props.onToggleHints} />
          수 알려 주기 <kbd>H</kbd>
        </label>
      </section>

      <section className="log fl-log">
        <h2>진행 기록</h2>
        <ol>
          {recent.map((e) => (
            <li key={e.id}>
              {e.side !== null && (
                <span className="fl-log-stone">
                  <Stone side={e.side} />
                </span>
              )}
              {e.text}
            </li>
          ))}
        </ol>
      </section>

      <GameControls settings={props.settings} onSettings={props.onSettings} onNewGame={props.onNewGame} onExit={props.onExit}>
        {props.showUndo && (
          <button type="button" className="btn" onClick={props.onUndo} disabled={!props.canUndo} data-testid="fl-undo" title="내가 둔 마지막 수를 되돌려요">
            ↶ 무르기 <kbd>U</kbd>
          </button>
        )}
      </GameControls>
    </aside>
  );
}
