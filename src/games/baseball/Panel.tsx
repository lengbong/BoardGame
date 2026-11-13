import type { ReactNode } from 'react';
import { GameControls } from '../../components/GameControls';
import { DUEL_KIND_LABEL } from '../common/duel';
import type { GameSettings } from '../common/settings';
import { TEAM_COLORS, TeamCap } from './art';
import { inningLabel, resultShort } from './rules';
import type { BaseballState, Guess, Side } from './types';

interface PanelProps {
  state: BaseballState;
  hint: ReactNode;
  thinking: boolean;
  /** 혼자 맞히기 최고 기록 (없으면 undefined) */
  best?: number;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onGiveUp: () => void;
  onNewGame: () => void;
  onExit: () => void;
  extra?: ReactNode;
}

/** 가장 잘 친 결과 (스트라이크가 많고, 같으면 볼이 많은 것) */
function bestGuess(guesses: Guess[]): Guess | null {
  let best: Guess | null = null;
  for (const g of guesses) if (!best || g.strikes > best.strikes || (g.strikes === best.strikes && g.balls > best.balls)) best = g;
  return best;
}

export function Panel(props: PanelProps) {
  const { state } = props;
  const solo = state.options.mode === 'solo';
  const active = state.phase === 'play';
  const shown: Side = state.phase === 'secret' ? (state.setting ?? 0) : active ? state.current : (state.winner ?? state.current);
  const c = TEAM_COLORS[shown];
  const p = state.players[shown];
  const recent = state.log.slice(-14).reverse();
  const len = state.options.length;

  let title: ReactNode;
  if (state.phase === 'secret') title = '숫자 정하기';
  else if (active) title = solo ? '맞히는 중' : state.lastChance ? '마지막 기회!' : '공격';
  else if (solo) title = state.gaveUp ? '답 보기' : '맞혔어요!';
  else title = state.winner === null ? '' : '승리!';

  return (
    <aside className="panel bb-panel">
      <section className="turn-card" style={{ borderColor: solo ? '#2f8f4e' : c.main, background: solo ? '#e5f5ea' : c.light }}>
        <div className="turn-title">
          {solo ? <span aria-hidden="true">⚾</span> : state.phase === 'gameover' && state.winner === null ? <span aria-hidden="true">🤝</span> : <TeamCap side={shown} size={30} />}
          <strong data-testid="bb-turn-name">{state.phase === 'gameover' && state.winner === null && !solo ? '무승부' : p.name}</strong>
          <span>{title}</span>
          {!solo && active && p.kind !== 'human' && <span className="tag">컴퓨터</span>}
        </div>
        <p className="bb-sub">
          {len}자리 · {state.options.zero ? '0~9' : '1~9'}
          {active && ` · ${inningLabel(state, state.current, state.players[state.current].guesses.length)}`}
          {props.thinking && <span className="bb-thinking" aria-hidden="true" />}
        </p>
        <p className="hint" data-testid="bb-hint">
          {props.hint}
        </p>
      </section>

      <section className="players bb-players">
        <h2>{solo ? '기록' : '플레이어'}</h2>
        <ul>
          {(solo ? [0] : [0, 1]).map((i) => {
            const side = i as Side;
            const pl = state.players[side];
            const best = bestGuess(pl.guesses);
            return (
              <li key={side} className={active && state.current === side && !solo ? 'is-current' : ''}>
                {solo ? <span aria-hidden="true">🧢</span> : <TeamCap side={side} size={24} />}
                <span className="player-name">{pl.name}</span>
                <span className="player-kind">{solo ? `친 횟수 ${pl.guesses.length}번` : DUEL_KIND_LABEL[pl.kind]}</span>
                <span className="bb-chip" title="가장 잘 친 결과">
                  {best ? resultShort(best.strikes, best.balls, len) : '—'}
                </span>
              </li>
            );
          })}
        </ul>
        {solo && <p className="bb-record">🏅 최고 기록: {props.best ? `${props.best}번 만에 맞히기` : '아직 없어요'}</p>}
      </section>

      <section className="log bb-log">
        <h2>진행 기록</h2>
        <ol>
          {recent.map((e) => (
            <li key={e.id}>
              {e.side !== null && !solo && <span className="dot small" style={{ background: TEAM_COLORS[e.side].main }} />}
              {e.text}
            </li>
          ))}
        </ol>
      </section>

      {props.extra}

      <GameControls settings={props.settings} onSettings={props.onSettings} onNewGame={props.onNewGame} onExit={props.onExit}>
        {solo && (
          <button type="button" className="btn" onClick={props.onGiveUp} disabled={!active} data-testid="bb-giveup" title="숨긴 숫자를 보고 끝내요">
            🙈 답 보기
          </button>
        )}
      </GameControls>
    </aside>
  );
}
