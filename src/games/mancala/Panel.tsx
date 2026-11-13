import type { ReactNode } from 'react';
import { GameControls } from '../../components/GameControls';
import { DUEL_KIND_LABEL } from '../common/duel';
import type { GameSettings } from '../common/settings';
import { sideName, storeOf } from './rules';
import { SideIcon } from './SideIcon';
import { SIDE_INFO } from './sides';
import type { MancalaState, Side } from './types';

interface PanelProps {
  state: MancalaState;
  /** 화면에 보이는 칸별 씨앗 수 (연출 중에는 실제 상태보다 늦다) */
  shownCounts: number[];
  /** 마지막 수 연출 중인지 */
  animating: boolean;
  hint: ReactNode;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  hints: boolean;
  onToggleHints: () => void;
  canUndo: boolean;
  showUndo: boolean;
  onUndo: () => void;
  onNewGame: () => void;
  onExit: () => void;
}

export function Panel(props: PanelProps) {
  const { state, shownCounts } = props;
  // 끝난 뒤에도 마지막 연출이 끝날 때까지는 마지막에 둔 사람을 보여 준다.
  const active = state.phase === 'play' || props.animating;
  const result = state.result;
  // 씨앗을 뿌리는 연출 중에는 방금 둔 사람을, 끝나면 이긴 사람을 보여 준다.
  const shownSide: Side =
    props.animating && state.lastMove ? state.lastMove.side : state.phase === 'play' ? state.current : (result?.winner ?? state.current);
  const info = SIDE_INFO[shownSide];
  const recent = state.log.slice(-12).reverse();
  const draw = !active && result?.winner === null;

  return (
    <aside className="panel mc-panel">
      <section className="turn-card" style={{ borderColor: draw ? '#b9a98f' : info.main, background: draw ? '#f3ede2' : info.light }}>
        <div className="turn-title">
          {draw ? (
            <strong data-testid="mc-turn-name">🤝 비겼어요</strong>
          ) : (
            <>
              <span className="mc-turn-icon">
                <SideIcon side={shownSide} size={26} />
              </span>
              <strong data-testid="mc-turn-name">{sideName(state, shownSide)}</strong>
              <span>{active ? '차례' : '우승!'}</span>
              {state.players[shownSide].kind !== 'human' && <span className="tag">컴퓨터</span>}
            </>
          )}
        </div>
        <div className="hint mc-hint">{props.hint}</div>
        <div className="mc-turn-tools">
          {props.showUndo && (
            <button type="button" className="btn btn-small" onClick={props.onUndo} disabled={!props.canUndo} title="내가 둔 수를 하나 무를 수 있어요 (컴퓨터가 그 뒤에 둔 수도 함께)" data-testid="mc-undo">
              ↶ 무르기 <kbd>U</kbd>
            </button>
          )}
          <button
            type="button"
            className={`btn btn-small${props.hints ? ' btn-selected' : ''}`}
            onClick={props.onToggleHints}
            aria-pressed={props.hints}
            title="도움말: 구멍에 마우스를 올리면 마지막 씨앗이 떨어질 곳을 보여 줘요"
            data-testid="mc-hints"
          >
            💡 도움말 {props.hints ? '켬' : '끔'} <kbd>H</kbd>
          </button>
        </div>
      </section>

      <section className="players mc-players">
        <h2>창고 점수</h2>
        <ul>
          {([0, 1] as Side[]).map((side) => {
            const p = state.players[side];
            const store = shownCounts[storeOf(side)];
            const onSide = shownCounts.slice(side * 7, side * 7 + 6).reduce((a, b) => a + b, 0);
            return (
              <li key={side} className={active && shownSide === side ? 'is-current' : ''}>
                <span className="mc-player-icon">
                  <SideIcon side={side} size={22} />
                </span>
                <span className="mc-player-text">
                  <span className="player-name">{sideName(state, side)}</span>
                  <span className="player-kind">
                    {DUEL_KIND_LABEL[p.kind]} · 구멍에 {onSide}개
                  </span>
                </span>
                <span className="mc-store-count" style={{ background: SIDE_INFO[side].main }} title={`창고 씨앗 ${store}개`} data-testid={`mc-score-${side}`}>
                  {store}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="log mc-log">
        <h2>진행 기록</h2>
        <ol>
          {recent.map((e) => (
            <li key={e.id}>
              {e.side !== null && <span className="dot small" style={{ background: SIDE_INFO[e.side].main }} />}
              {e.text}
            </li>
          ))}
        </ol>
      </section>

      <GameControls settings={props.settings} onSettings={props.onSettings} onNewGame={props.onNewGame} onExit={props.onExit} />
    </aside>
  );
}
