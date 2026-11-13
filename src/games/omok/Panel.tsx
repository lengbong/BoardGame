import type { ReactNode } from 'react';
import { GameControls } from '../../components/GameControls';
import { DUEL_KIND_LABEL } from '../common/duel';
import type { GameSettings } from '../common/settings';
import { RULE_NAMES, SIDE_LABELS, coordName, playerName } from './rules';
import { SIDE_CARD, Stone } from './StoneArt';
import type { OmokState, Stone as Side } from './types';

interface PanelProps {
  state: OmokState;
  hint: string;
  /** 안내 문구가 경고(금수 등)인지 */
  notice: boolean;
  thinking: boolean;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  showUndo: boolean;
  canUndo: boolean;
  onUndo: () => void;
  onToggleHints: () => void;
  onToggleNumbers: () => void;
  onNewGame: () => void;
  onExit: () => void;
  extra?: ReactNode;
}

export function Panel(props: PanelProps) {
  const { state } = props;
  const active = state.phase === 'play';
  const shown: Side = active ? state.current : (state.winner ?? state.current);
  const card = SIDE_CARD[shown];
  const recent = state.log.slice(-14).reverse();
  const last = state.lastMove;

  return (
    <aside className="panel ok-panel">
      <section className="turn-card" style={{ borderColor: card.border, background: card.bg }}>
        <div className="turn-title">
          <span className="ok-turn-stone">{active || state.winner !== null ? <Stone side={shown} /> : '🤝'}</span>
          <strong data-testid="ok-turn-name">{active || state.winner !== null ? playerName(state, shown) : '비겼어요'}</strong>
          <span>{active ? '차례' : state.winner !== null ? '승리!' : ''}</span>
          {active && state.players[shown].kind !== 'human' && <span className="tag">컴퓨터</span>}
        </div>
        <p className="ok-sub">
          {RULE_NAMES[state.options.rule]} · {state.moves.length}수째{last !== null && ` · 마지막 ${coordName(last, state.size)}`}
          {props.thinking && <span className="ok-thinking" aria-hidden="true" />}
        </p>
        <p className={`hint${props.notice ? ' ok-notice' : ''}`} data-testid="ok-hint">
          {props.hint}
        </p>
      </section>

      <section className="players ok-players">
        <h2>플레이어</h2>
        <ul>
          {([0, 1] as const).map((side) => (
            <li key={side} className={active && state.current === side ? 'is-current' : ''}>
              <span className="ok-player-stone">
                <Stone side={side} />
              </span>
              <span className="player-name">{playerName(state, side)}</span>
              <span className="player-kind">
                {SIDE_LABELS[side]} · {DUEL_KIND_LABEL[state.players[side].kind]}
              </span>
            </li>
          ))}
        </ul>
        <div className="ok-toggles">
          <label title="이길 곳(초록), 꼭 막을 곳(주황), 조심할 곳(노랑)을 알려 줘요">
            <input type="checkbox" checked={state.options.hints} onChange={props.onToggleHints} />
            수 알려 주기 <kbd>H</kbd>
          </label>
          <label title="돌에 둔 순서를 숫자로 보여 줘요">
            <input type="checkbox" checked={state.options.numbers} onChange={props.onToggleNumbers} />
            수 번호 <kbd>N</kbd>
          </label>
        </div>
      </section>

      <section className="log ok-log">
        <h2>진행 기록</h2>
        <ol>
          {recent.map((e) => (
            <li key={e.id}>
              {e.side !== null && (
                <span className="ok-log-stone">
                  <Stone side={e.side} />
                </span>
              )}
              {e.text}
            </li>
          ))}
        </ol>
      </section>

      {props.extra}

      <GameControls settings={props.settings} onSettings={props.onSettings} onNewGame={props.onNewGame} onExit={props.onExit}>
        {props.showUndo && (
          <button type="button" className="btn" onClick={props.onUndo} disabled={!props.canUndo} data-testid="ok-undo" title="내가 둔 마지막 수를 되돌려요">
            ↶ 무르기 <kbd>U</kbd>
          </button>
        )}
      </GameControls>
    </aside>
  );
}
