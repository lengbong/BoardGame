import type { CSSProperties } from 'react';
import { SEAT_COLORS } from '../common/players';
import { MiniKorea, SymbolIcon, TicketBack, TicketFace, TrainIcon } from './art';
import { CARD_KINDS, CITY, COLOR_INFO, PLAN } from './map';
import { completedPlans, handTotal, playerName, WINDOW_SIZE } from './rules';
import type { CardKind, RailsState } from './types';

export type RegisterEl = (key: string) => (el: HTMLElement | null) => void;

interface StationProps {
  state: RailsState;
  /** 손패와 계획을 보여 줄 사람 (가려야 하면 null) */
  owner: number | null;
  /** 지금 이 사람이 표를 받을 수 있는지 */
  canTake: boolean;
  /** 표를 받을 수 없는 까닭 (마우스를 올리면) */
  takeReason: string | null;
  canDrawPlans: boolean;
  drawPlansReason: string | null;
  /** 이 사람이 계획을 고르는 중인지 */
  choosing: boolean;
  picked: ReadonlySet<number>;
  hiddenNote: string;
  /** 창구 칸마다 새로 채워질 때 바뀌는 번호 (애니메이션) */
  windowKeys: number[];
  /** 방금 받은 표 (반짝) */
  recent: ReadonlySet<CardKind>;
  reg: RegisterEl;
  onTakeWindow: (index: number) => void;
  onTakeDeck: () => void;
  onDrawPlans: () => void;
  onTogglePick: (planId: number) => void;
  onConfirmPlans: () => void;
  onHoverPlan: (planId: number | null) => void;
  onHoverColor: (kind: CardKind | null) => void;
}

function PlanCard({
  planId,
  done,
  picked,
  onClick,
  onHover,
  keyHint,
  testId,
}: {
  planId: number;
  done?: boolean;
  picked?: boolean;
  onClick?: () => void;
  onHover: (id: number | null) => void;
  keyHint?: string;
  testId?: string;
}) {
  const plan = PLAN[planId];
  const cls = ['rl-plan', done && 'rl-plan-done', picked !== undefined && 'rl-plan-pickable', picked && 'rl-plan-picked'].filter(Boolean).join(' ');
  const body = (
    <>
      <MiniKorea a={plan.a} b={plan.b} done={done} size={40} />
      <span className="rl-plan-text">
        <b>
          {CITY[plan.a].name} <span aria-hidden="true">→</span> {CITY[plan.b].name}
        </b>
        <small>{done ? '이었어요! 끝나면 +' + plan.points : `이으면 +${plan.points} · 못 이으면 −${plan.points}`}</small>
      </span>
      <span className="rl-plan-points">{plan.points}</span>
      {done && (
        <span className="rl-plan-check" aria-label="이었어요">
          ✓
        </span>
      )}
      {picked !== undefined && <span className="rl-plan-pick" aria-hidden="true">{picked ? '✔' : ''}</span>}
      {keyHint && <kbd className="rl-plan-key">{keyHint}</kbd>}
    </>
  );
  const label = `${CITY[plan.a].name}에서 ${CITY[plan.b].name}까지 ${plan.points}점${done ? ', 이었어요' : ''}${picked !== undefined ? (picked ? ', 고름' : ', 안 고름') : ''}`;
  if (onClick)
    return (
      <button
        type="button"
        className={cls}
        onClick={onClick}
        onMouseEnter={() => onHover(planId)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(planId)}
        onBlur={() => onHover(null)}
        aria-pressed={picked}
        aria-label={label}
        data-testid={testId}
      >
        {body}
      </button>
    );
  return (
    <div className={cls} onMouseEnter={() => onHover(planId)} onMouseLeave={() => onHover(null)} aria-label={label} role="listitem" tabIndex={0} onFocus={() => onHover(planId)} onBlur={() => onHover(null)}>
      {body}
    </div>
  );
}

export function Station(props: StationProps) {
  const { state, owner, canTake, choosing, picked, reg, recent } = props;
  const player = owner !== null ? state.players[owner] : null;
  const deckCount = state.deck.length + state.discard.length;
  const offer = state.offer;
  const done = owner !== null ? new Set(completedPlans(state, owner)) : new Set<number>();

  return (
    <div className="rl-station" data-testid="rl-station">
      <section className="rl-counter" aria-label="매표소">
        <div className="rl-awning" aria-hidden="true" />
        <h2 className="rl-counter-title">
          🎫 매표소 <small>{canTake ? (state.drawn > 0 ? '한 장 더 받아요!' : '표 2장을 받을 수 있어요') : ''}</small>
        </h2>
        <div className="rl-window">
          {Array.from({ length: WINDOW_SIZE }, (_, i) => {
            const c = state.window[i];
            return (
              <button
                key={`${i}-${props.windowKeys[i] ?? 0}`}
                type="button"
                className={`rl-card rl-window-card${c ? '' : ' rl-card-empty'}${canTake && c ? ' rl-card-can' : ''}`}
                ref={reg(`win-${i}`)}
                disabled={!c}
                aria-disabled={!canTake}
                onClick={() => props.onTakeWindow(i)}
                title={canTake ? `${c ? COLOR_INFO[c].name + '표' : ''} 받기 (${i + 1})` : (props.takeReason ?? '')}
                aria-label={c ? `창구 ${i + 1}번 ${COLOR_INFO[c].name}표 받기` : `창구 ${i + 1}번 비었음`}
                data-testid={`rl-window-${i}`}
              >
                {c ? <TicketFace kind={c} /> : <span className="rl-card-hole" />}
                <kbd className="rl-card-key">{i + 1}</kbd>
              </button>
            );
          })}
          <button
            type="button"
            className={`rl-card rl-deck${canTake && deckCount > 0 ? ' rl-card-can' : ''}${deckCount === 0 ? ' rl-card-empty' : ''}`}
            ref={reg('deck')}
            disabled={deckCount === 0}
            aria-disabled={!canTake}
            onClick={props.onTakeDeck}
            title={canTake ? '더미에서 1장 받기 (D) — 만능 고속열차표는 여기서만 나와요' : (props.takeReason ?? '')}
            aria-label={`표 더미에서 받기, ${deckCount}장 남음`}
            data-testid="rl-deck"
          >
            <span className="rl-deck-stack" aria-hidden="true">
              <TicketBack />
            </span>
            <span className="rl-deck-count">{deckCount}</span>
            <kbd className="rl-card-key">D</kbd>
          </button>
        </div>
      </section>

      {player ? (
        <section className="rl-hand-box" style={{ '--rl-owner': SEAT_COLORS[player.seat].main } as CSSProperties} data-testid="rl-hand">
          <h2 className="rl-box-title">
            <span className="dot" style={{ background: SEAT_COLORS[player.seat].main }} />
            {playerName(player)}의 표 <small>{handTotal(player.hand)}장</small>
            <span className="rl-trains-left" title="남은 기차 칸">
              <TrainIcon color={SEAT_COLORS[player.seat].main} size={14} /> {player.trains}칸
            </span>
          </h2>
          <div className="rl-hand" ref={reg('hand')}>
            {CARD_KINDS.map((k) => {
              const n = player.hand[k];
              return (
                <div
                  key={k}
                  className={`rl-stack${n === 0 ? ' rl-stack-zero' : ''}${recent.has(k) ? ' rl-stack-new' : ''}`}
                  ref={reg(`hand-${k}`)}
                  onMouseEnter={() => props.onHoverColor(k)}
                  onMouseLeave={() => props.onHoverColor(null)}
                  title={`${COLOR_INFO[k].name}${k === 'wild' ? '표: 어떤 색 대신으로도 써요' : `표 (${COLOR_INFO[k].shapeName})`} ${n}장`}
                  aria-label={`${k === 'wild' ? '만능 고속열차표' : COLOR_INFO[k].name + '표'} ${n}장`}
                >
                  <span className="rl-stack-cards">
                    {n > 1 && <span className="rl-stack-under" aria-hidden="true" />}
                    <span className="rl-card rl-hand-card">
                      <TicketFace kind={k} />
                    </span>
                  </span>
                  <span className="rl-stack-count">×{n}</span>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="rl-hand-box rl-hidden-box" data-testid="rl-hand-hidden">
          <p>🙈 {props.hiddenNote}</p>
        </section>
      )}

      {player && choosing && offer && (
        <section className="rl-offer" data-testid="rl-offer">
          <h2 className="rl-box-title">
            🗺️ 여행 계획 고르기 <small>{offer.minKeep}장 이상 가져요</small>
          </h2>
          <p className="rl-offer-note">
            이으면 점수를 받고, 끝날 때까지 못 이으면 그만큼 잃어요. 마우스를 올리면 지도에 두 도시가 반짝여요.
          </p>
          <div className="rl-plan-list">
            {offer.plans.map((id, i) => (
              <PlanCard key={id} planId={id} picked={picked.has(id)} onClick={() => props.onTogglePick(id)} onHover={props.onHoverPlan} keyHint={String(i + 1)} testId={`rl-offer-${i}`} />
            ))}
          </div>
          <button type="button" className="btn btn-primary rl-offer-ok" disabled={picked.size < offer.minKeep} onClick={props.onConfirmPlans} data-testid="rl-offer-ok">
            {picked.size < offer.minKeep ? `${offer.minKeep - picked.size}장 더 골라요` : `${picked.size}장 가지기`} <kbd>Enter</kbd>
          </button>
        </section>
      )}

      {player && (
        <section className="rl-plans-box" data-testid="rl-plans">
          <h2 className="rl-box-title">
            🗺️ 여행 계획{' '}
            <small>
              {player.plans.length > 0 ? `이은 것 ${done.size}/${player.plans.length}` : '아직 없어요'}
            </small>
          </h2>
          {player.plans.length > 0 && (
            <div className="rl-plan-list rl-my-plans" role="list">
              {[...player.plans]
                .sort((a, b) => Number(done.has(a)) - Number(done.has(b)) || PLAN[b].points - PLAN[a].points)
                .map((id) => (
                  <PlanCard key={id} planId={id} done={done.has(id)} onHover={props.onHoverPlan} />
                ))}
            </div>
          )}
          {!choosing && (
            <button
              type="button"
              className={`btn rl-draw-plans${props.canDrawPlans ? ' rl-btn-can' : ''}`}
              disabled={!props.canDrawPlans}
              title={props.drawPlansReason ?? '여행 계획 3장을 보고 1장 이상 가져요'}
              onClick={props.onDrawPlans}
              data-testid="rl-draw-plans"
            >
              🗺️ 여행 계획 뽑기 <small>({state.planDeck.length}장 남음)</small> <kbd>P</kbd>
            </button>
          )}
        </section>
      )}
      <p className="rl-legend">
        {CARD_KINDS.filter((k) => k !== 'wild').map((k) => (
          <span key={k}>
            <SymbolIcon kind={k} size={12} />
            {COLOR_INFO[k].name}
          </span>
        ))}
        <span>
          <SymbolIcon kind="gray" size={12} />
          회색 = 아무 한 색
        </span>
      </p>
    </div>
  );
}
