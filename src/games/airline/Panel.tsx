import { useState, type ReactNode } from 'react';
import { GameControls } from '../../components/GameControls';
import { KIND_LABEL, SEAT_KIND_OPTIONS } from '../common/players';
import type { GameSettings } from '../common/settings';
import { coColors } from './brand';
import { CompanyBadge, SEAT_SHAPES } from './Art';
import { CHALLENGE } from './challenges';
import { fmtMoney } from './format';
import { actor, endT, rankings } from './rules';
import { companyValue, regionsServed } from './simulate';
import { mLabel } from './time';
import type { AirlineState } from './types';
import { AirlinePhoto } from './AirlinePicker';
import { CreditsModal } from './CreditsModal';
import { realOf } from './brand';
import { IataBadge, Kbd, Meter } from './ui';

interface PanelProps {
  state: AirlineState;
  viewer: number;
  hint: ReactNode;
  /** 사람이 지금 분기를 마칠 수 있는지 */
  canEnd: boolean;
  busy: string | null;
  onEndTurn: () => void;
  /** 지금 켜 둔 자동 진행 */
  auto: 'quarter' | 'event' | null;
  onAuto: (mode: 'quarter' | 'event') => void;
  onStopAuto: () => void;
  settings: GameSettings;
  onSettings: (s: GameSettings) => void;
  onNewGame: () => void;
  onExit: () => void;
}

export function Panel({ state, viewer, hint, canEnd, busy, onEndTurn, auto, onAuto, onStopAuto, settings, onSettings, onNewGame, onExit }: PanelProps) {
  const act = actor(state);
  const shown = state.phase === 'gameover' ? state.companies[state.result?.winners[0] ?? viewer] : state.companies[act];
  const color = coColors(shown);
  const order = rankings(state);
  const recent = state.log.slice(-14).reverse();
  const me = state.companies[viewer];
  const left = endT(state) - state.t + 1;
  const [credits, setCredits] = useState(false);

  let goal: ReactNode;
  if (state.challenge) {
    const def = CHALLENGE[state.challenge.id];
    goal = (
      <>
        <b>
          {def.emoji} {def.title}
        </b>
        <small>{def.goal}</small>
        <Meter value={state.challenge.ratio} tone="good" label="도전 진행" />
        <small>{state.challenge.progress}</small>
        <small className="al-muted">
          기한 {mLabel(state.challenge.deadline)} (남은 {Math.max(0, left)}달)
        </small>
      </>
    );
  } else if (state.options.mode === 'goal') {
    const v = companyValue(state, viewer);
    const regions = regionsServed(me).size;
    goal = (
      <>
        <b>
          🎯 {state.options.goalRegions}개 지역 취항 + 회사 가치 {fmtMoney(state.options.goalValue)}
        </b>
        <small>
          {me.name}: 지역 {regions}/{state.options.goalRegions} · 가치 {Math.round((v / state.options.goalValue) * 100)}%
        </small>
        <Meter value={Math.min(regions / state.options.goalRegions, v / state.options.goalValue)} tone="good" label="목표까지" />
      </>
    );
  } else {
    const total = state.options.years * 12;
    goal = (
      <>
        <b>🏁 {mLabel(endT(state))}까지 회사 가치 1등</b>
        <small>남은 {Math.max(0, left)}달</small>
        <Meter value={(total - left) / total} tone="blue" label="지난 시간" />
      </>
    );
  }

  return (
    <aside className="panel al-panel">
      <section className="turn-card al-turn" style={{ borderColor: color.main, background: color.light }}>
        <div className="turn-title">
          <CompanyBadge color={color.main} shape={SEAT_SHAPES[shown.seat]} size={22} />
          {realOf(shown) && <IataBadge airline={realOf(shown)!} small />}
          <strong data-testid="al-turn-name">{shown.name}</strong>
          <span>{state.phase === 'gameover' ? (state.result?.winners.length ? '우승!' : '') : '차례'}</span>
          {shown.kind !== 'human' && state.phase !== 'gameover' && <span className="tag">컴퓨터</span>}
        </div>
        {realOf(shown) && (
          <div className="al-turn-photo">
            <AirlinePhoto airline={realOf(shown)!} width={110} />
          </div>
        )}
        <p className="al-turn-date">
          {mLabel(state.t)} · 유가 {state.oil.toFixed(2)}
        </p>
        <div className="hint" data-testid="al-hint">
          {hint}
        </div>
        {state.phase === 'manage' && (
          <button type="button" className="btn btn-primary al-end-btn" disabled={!canEnd || !!auto} onClick={onEndTurn} data-testid="al-end-turn">
            {busy ?? (
              <>
                이번 달 마치기 <Kbd>Enter</Kbd>
              </>
            )}
          </button>
        )}
        {state.phase === 'manage' && state.companies[viewer]?.kind === 'human' && (
          <div className="al-auto-row">
            {auto ? (
              <button type="button" className="btn btn-small al-auto-stop" onClick={onStopAuto} data-testid="al-auto-stop">
                ⏸ 자동 진행 멈추기
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-small" disabled={!canEnd} onClick={() => onAuto('quarter')} title="이번 분기가 끝날 때까지 달을 넘겨요 (일이 생기면 멈춰요)" data-testid="al-auto-quarter">
                  ⏩ 분기 끝까지 맡기기
                </button>
                <button type="button" className="btn btn-small" disabled={!canEnd} onClick={() => onAuto('event')} title="결정할 일·큰 사건·돈 걱정·우리 노선 라이벌 소식이 생길 때까지 달을 넘겨요" data-testid="al-auto-event">
                  ⏭ 일이 생길 때까지
                </button>
              </>
            )}
          </div>
        )}
      </section>

      <section className="al-goal">{goal}</section>

      <section className="players al-players">
        <h2>항공사</h2>
        <ul>
          {order.map((i, rank) => {
            const c = state.companies[i];
            const col = coColors(c);
            const pos = state.order.indexOf(i);
            const status = c.out ? '운항 중단' : state.phase !== 'manage' ? '' : i === act ? '경영 중' : pos >= 0 && pos < state.turnPos ? '✓ 마침' : '기다림';
            return (
              <li key={i} className={`al-prow${i === act ? ' is-current' : ''}${c.out ? ' al-out' : ''}`} data-testid={`al-player-${i}`}>
                <span className="al-rank">{c.out ? '—' : rank + 1}</span>
                <CompanyBadge color={col.main} shape={SEAT_SHAPES[c.seat]} size={18} />
                <span className="al-prow-main">
                  <span className="al-prow-top">
                    {realOf(c) && <IataBadge airline={realOf(c)!} small />}
                    <span className="player-name">{c.name}</span>
                    <span className="player-kind" title={KIND_LABEL[c.kind]}>
                      {c.kind === 'human' ? '사람' : `컴퓨터 ${SEAT_KIND_OPTIONS.find((o) => o.value === c.kind)?.short ?? ''}`}
                    </span>
                  </span>
                  <span className="al-prow-sub">
                    <b>{fmtMoney(companyValue(state, i))}</b>
                    <small>
                      ✈️{c.planes.length} · 노선 {c.routes.length} · 🌍{regionsServed(c).size}
                    </small>
                  </span>
                </span>
                <span className="al-status">{status}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="log al-log">
        <h2>진행 기록</h2>
        <ol>
          {recent.map((e) => (
            <li key={e.id}>
              {e.seat !== null && <span className="dot small" style={{ background: coColors(state.companies.find((c) => c.seat === e.seat) ?? { seat: e.seat, color: null }).main }} />}
              {e.text}
            </li>
          ))}
        </ol>
      </section>

      <GameControls settings={settings} onSettings={onSettings} onNewGame={onNewGame} onExit={onExit} />
      <button type="button" className="btn btn-small btn-ghost al-credits-btn" onClick={() => setCredits(true)} data-testid="al-credits-open">
        📷 사진 출처
      </button>
      {credits && <CreditsModal onClose={() => setCredits(false)} />}
    </aside>
  );
}
