import { useMemo, useState } from 'react';
import { MODEL } from './aircraft';
import { checkAtOf, condOf } from './condition';
import { FinIcon } from './FinanceArt';
import { FleetIcon } from './FleetArt';
import { fmtMoney, signedMoney } from './format';
import { RENEW_MIN, applyRenew, budgetOf, fleetRenewPlan, idleOldPlan, isOld, isRetired, isWorn, orderFor, pickHow, renewOption, type IdleOldPlan, type RenewItem, type RenewPlan } from './renew';
import { buyBlocker } from './rules';
import { MAX_DELIVERIES, WEEK_HOURS, planeAge, planeHours } from './simulate';
import { MoreInfo } from './StaffArt';
import { mShort } from './time';
import type { AirlineState, Company, Plane } from './types';
import { ActButton } from './ui';

const notMine = '내 차례에만 할 수 있어요';

/** 비행기 목록 거르기 */
export type PlaneFilter = 'all' | 'old' | 'retired' | 'worn' | 'idle' | 'leased' | 'renewing';
/** 비행기 목록 줄 세우기 */
export type PlaneSort = 'base' | 'age' | 'cond' | 'use';

export const FILTER_NAMES: Record<PlaneFilter, string> = {
  all: '전체',
  old: '낡은 (18년+)',
  retired: '단종',
  worn: '닳은',
  idle: '쉬는',
  leased: '리스',
  renewing: '교체 주문',
};

export const SORT_NAMES: Record<PlaneSort, string> = {
  base: '쉬는 것 먼저',
  age: '나이 많은 순',
  cond: '상태 나쁜 순',
  use: '가동률 낮은 순',
};

export function planeFilter(state: AirlineState, c: Company, f: PlaneFilter): (p: Plane) => boolean {
  switch (f) {
    case 'old':
      return (p) => isOld(state, p);
    case 'retired':
      return (p) => isRetired(state, p);
    case 'worn':
      return (p) => isWorn(c, p);
    case 'idle':
      return (p) => p.legs.length === 0;
    case 'leased':
      return (p) => p.leased;
    case 'renewing':
      return (p) => !!orderFor(c, p.id);
    default:
      return () => true;
  }
}

export function sortPlanes(c: Company, planes: readonly Plane[], sort: PlaneSort): Plane[] {
  const list = [...planes];
  if (sort === 'age') return list.sort((a, b) => a.since - b.since);
  if (sort === 'cond') return list.sort((a, b) => condOf(a) - condOf(b));
  if (sort === 'use') return list.sort((a, b) => planeHours(c, a) - planeHours(c, b));
  return list.sort((a, b) => (a.legs.length === 0 ? 0 : 1) - (b.legs.length === 0 ? 0 : 1) || planeHours(c, a) - planeHours(c, b));
}

const HOW_TEXT: Record<RenewItem['how'], string> = { lease: '리스로 바로', order: '주문해 두기', sell: '팔기' };

interface Preview {
  /** 계획을 세운 상태 (상태가 바뀌면 다시 세운다) */
  state: AirlineState;
  renew: RenewPlan;
  idle: IdleOldPlan;
}

/** 비행기 화면의 ‘바꿀 비행기’: 낡은·닳은 비행기를 한눈에 보고, 비서가 세운 계획을 골라 한꺼번에 바꾼다 */
export function RenewCard({
  state,
  viewer,
  canAct,
  apply,
  filter,
  onFilter,
}: {
  state: AirlineState;
  viewer: number;
  canAct: boolean;
  apply: (fn: (s: AirlineState) => AirlineState) => void;
  filter: PlaneFilter;
  onFilter: (f: PlaneFilter) => void;
}) {
  const c = state.companies[viewer];
  const [preview, setPreview] = useState<Preview | null>(null);
  // 계획에서 뺀 비행기 (처음엔 모두 고른다)
  const [off, setOff] = useState<ReadonlySet<number>>(() => new Set());
  const [done, setDone] = useState<{ state: AirlineState; text: string; failed: string[] } | null>(null);
  const old = c.planes.filter((p) => isOld(state, p));
  const oldFlying = old.filter((p) => p.legs.length > 0).length;
  const retired = c.planes.filter((p) => isRetired(state, p)).length;
  const worn = c.planes.filter((p) => isWorn(c, p)).length;
  const renewing = c.orders.filter((o) => o.replaces !== undefined && c.planes.some((p) => p.id === o.replaces));
  const at = checkAtOf(c);
  if (c.planes.length === 0) return null;

  const p = preview && preview.state === state ? preview : null;
  // 리스로 바로 → 주문해 두기 → 쉬는 비행기 팔기 순으로 묶어 보여 준다
  const items = p ? [...p.renew.items.filter((x) => x.how === 'lease'), ...p.renew.items.filter((x) => x.how === 'order'), ...p.idle.items] : [];
  const chosen = items.filter((x) => !off.has(x.plane));
  const gain = chosen.reduce((s, x) => s + x.gain, 0);
  const cash = chosen.reduce((s, x) => s + x.cash, 0);
  const leftLease = Math.max(0, MAX_DELIVERIES - c.taken);

  const look = () => {
    setDone(null);
    setOff(new Set());
    setPreview({ state, renew: fleetRenewPlan(state, viewer, { look: 30, max: 30 }), idle: idleOldPlan(state, viewer) });
  };
  const run = () => {
    const res = applyRenew(state, viewer, chosen);
    const failed = res.failed.map((f) => `${MODEL[f.item.from].name}: ${f.why}`);
    if (res.done.length > 0) apply(() => res.state);
    const n = (how: RenewItem['how']) => res.done.filter((x) => x.how === how).length;
    const parts = [n('lease') && `리스로 ${n('lease')}대 바꿈`, n('order') && `${n('order')}대 주문 (오면 바꿔요)`, n('sell') && `쉬는 낡은 비행기 ${n('sell')}대 정리`].filter(Boolean);
    setDone({ state: res.state, text: parts.length ? `${parts.join(' · ')}했어요` : '하나도 못 했어요', failed });
  };

  const chip = (f: PlaneFilter, n: number, label: string, sub?: string, tone?: 'warn' | 'bad') => (
    <li>
      <button type="button" className={`al-renew-stat${filter === f ? ' al-on' : ''}${tone ? ` al-${tone}` : ''}`} onClick={() => onFilter(filter === f ? 'all' : f)} aria-pressed={filter === f} disabled={n === 0} data-testid={`al-renew-stat-${f}`}>
        <small>{label}</small>
        <b>{n}대</b>
        {sub && <small>{sub}</small>}
      </button>
    </li>
  );

  return (
    <section className="al-card al-renew" aria-label="바꿀 비행기" data-testid="al-renew">
      <h4 className="al-fin-title">
        <FinIcon kind="wrench" /> 바꿀 비행기 <small>낡을수록 연료·정비비가 늘고 손님이 덜 좋아해요 · 누르면 그 비행기만 보여요</small>
      </h4>
      <ul className="al-renew-stats">
        {chip('old', old.length, '낡은 비행기 (18년+)', `노선 ${oldFlying} · 쉬는 ${old.length - oldFlying}`, old.length ? 'warn' : undefined)}
        {chip('worn', worn, `닳은 비행기 (상태 ${at}% 아래)`, '곧 C점검으로 쉬어요', worn ? 'bad' : undefined)}
        {chip('retired', retired, '단종 기종', '부품이 귀해져요')}
        {chip('renewing', renewing.length, '교체 주문', renewing.length ? `${mShort(Math.min(...renewing.map((o) => o.due)))}부터 도착` : '오면 노선을 넘겨받아요')}
      </ul>
      <div className="al-renew-acts">
        <button type="button" className="btn btn-small" onClick={look} disabled={old.length === 0} data-testid="al-renew-look">
          ♻️ 비서에게 바꿀 계획 세우기
        </button>
        <small className="al-muted">
          급하면(닳았거나 25년 넘음) 리스로 바로 (이번 달 {leftLease}/{MAX_DELIVERIES}대 남음), 돈이 넉넉하면 새 비행기를 주문해 두고, 쉬는 낡은 비행기는 예비기로 세지 않고 팔아요.
        </small>
      </div>
      {done && done.state === state && (
        <div className={`al-advice-result${done.failed.length ? ' al-has-fail' : ''}`} role="status" data-testid="al-renew-done">
          <b>✓ {done.text}</b>
          {done.failed.length > 0 && (
            <ul>
              {done.failed.map((f) => (
                <li key={f}>⚠ {f}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {p && (
        <div className="al-renew-plan" data-testid="al-renew-plan">
          {items.length === 0 ? (
            <p className="al-muted">
              지금은 바꿀 만한 비행기가 없어요.{' '}
              {p.renew.old > 0 && `노선을 나는 낡은 비행기 ${p.renew.old}대는 바꿔도 달 이익이 ${RENEW_MIN}억 넘게 늘지 않거나, 돈·리스 한도가 모자라요.`}
            </p>
          ) : (
            <>
              <label className="al-advice-all">
                <input
                  type="checkbox"
                  checked={chosen.length === items.length}
                  ref={(el) => {
                    if (el) el.indeterminate = chosen.length > 0 && chosen.length < items.length;
                  }}
                  onChange={() => setOff(chosen.length === items.length ? new Set(items.map((x) => x.plane)) : new Set())}
                />
                모두 고르기 <small className="al-muted">({items.length}대)</small>
              </label>
              <ul className="al-renew-items">
                {items.map((it, i) => {
                  const pl = c.planes.find((x) => x.id === it.plane);
                  const head = i === 0 || items[i - 1].how !== it.how;
                  const n = items.filter((x) => x.how === it.how).length;
                  return [
                    head && (
                      <li key={`h-${it.how}`} className="al-renew-group">
                        {it.how === 'lease' ? `리스로 바로 바꾸기 ${n}대 (이번 달부터 새 비행기가 날아요)` : it.how === 'order' ? `새 비행기 주문해 두기 ${n}대 (오면 노선을 넘겨받고 낡은 비행기는 팔아요)` : `쉬는 낡은 비행기 정리 ${n}대`}
                      </li>
                    ),
                    <li key={it.plane} className={off.has(it.plane) ? 'al-tip-off' : undefined}>
                      <input
                        type="checkbox"
                        checked={!off.has(it.plane)}
                        onChange={() =>
                          setOff((cur) => {
                            const next = new Set(cur);
                            if (next.has(it.plane)) next.delete(it.plane);
                            else next.add(it.plane);
                            return next;
                          })
                        }
                        aria-label={`${MODEL[it.from].name} 고르기`}
                        data-testid="al-renew-pick"
                      />
                      <span className={`al-renew-how al-how-${it.how}`}>{it.how === 'sell' && pl?.leased ? '돌려주기' : HOW_TEXT[it.how]}</span>
                      <span className="al-renew-what">
                        <b>{MODEL[it.from].name}</b>
                        <small className="al-muted">
                          {' '}
                          {Math.floor(it.age)}년 · 상태 {Math.round(it.cond)}%{it.urgent ? ' · 급함' : ''}
                        </small>
                        {it.to && (
                          <>
                            {' → '}
                            <b>{MODEL[it.to].name}</b>
                            {it.how === 'order' && <small className="al-muted"> ({it.lead}달 뒤)</small>}
                          </>
                        )}
                      </span>
                      <span className="al-renew-num">
                        <small className="al-pos">달 {signedMoney(it.gain)}</small>
                        <small className={Math.round(it.cash) >= 0 ? 'al-pos' : 'al-neg'}>현금 {signedMoney(it.cash)}</small>
                      </span>
                    </li>,
                  ];
                })}
              </ul>
              <div className="al-renew-foot">
                <span>
                  {chosen.length}대 고름 · 달 이익 약 <b className="al-pos">{signedMoney(gain)}</b> · 이번 달 현금 <b className={Math.round(cash) >= 0 ? 'al-pos' : 'al-neg'}>{signedMoney(cash)}</b>
                </span>
                <ActButton small primary blocker={canAct ? (chosen.length ? null : '고른 비행기가 없어요') : notMine} onClick={run} testId="al-renew-run">
                  고른 {chosen.length}대 바꾸기
                </ActButton>
              </div>
            </>
          )}
          {(p.renew.kept > 0 || p.renew.more > 0 || p.idle.need > 0) && items.length > 0 && (
            <small className="al-muted al-renew-note">
              {p.renew.kept > 0 && `낡은 비행기 ${p.renew.kept}대는 지금 바꿔도 남는 게 적거나 돈·리스 한도가 모자라 그대로 둬요. `}
              {p.renew.more > 0 && `${p.renew.more}대는 이번 것을 바꾼 뒤 다시 살펴볼게요. `}
              {p.idle.need > 0 &&
                (p.idle.spare >= p.idle.need
                  ? `예비기 ${p.idle.need}대는 쉬는 젊은 비행기로 남아요.`
                  : `예비기는 젊은 비행기로만 둬요: ${p.idle.need}대 가운데 ${p.idle.spare}대뿐이라, 젊은 내 비행기(주문·중고)를 ${p.idle.need - p.idle.spare}대 더 두면 결항이 줄어요.`)}
            </small>
          )}
        </div>
      )}
      <MoreInfo>
        주문한 새 비행기가 오면 바꾸려던 낡은 비행기의 노선을 그대로 넘겨받고, 낡은 비행기는 팔아요 (리스기는 돌려줘요). 리스·중고는 한 달에 {MAX_DELIVERIES}대까지만 바로 받을 수 있어 많이 바꿀 때는 주문이
        좋아요. 어림은 라이벌이 지금 그대로일 때의 달 이익이에요.
      </MoreInfo>
    </section>
  );
}

/** 비행기 한 대의 ‘바꾸기’: 리스로 바로 바꿀 때와 주문해 둘 때를 견주어 보고 고른다 */
export function RenewPanel({
  state,
  viewer,
  plane,
  canAct,
  apply,
  onClose,
}: {
  state: AirlineState;
  viewer: number;
  plane: Plane;
  canAct: boolean;
  apply: (fn: (s: AirlineState) => AirlineState) => void;
  onClose: () => void;
}) {
  const opt = useMemo(() => renewOption(state, viewer, plane.id), [state, viewer, plane.id]);
  const [why, setWhy] = useState<string | null>(null);
  const b = budgetOf(state, viewer);
  const pick = opt ? pickHow(opt, b) : null;
  const m = MODEL[plane.model];
  const go = (it: RenewItem) => {
    const res = applyRenew(state, viewer, [it]);
    if (res.failed.length) setWhy(res.failed[0].why);
    else {
      apply(() => res.state);
      onClose();
    }
  };
  return (
    <div className="al-cabin al-renew-panel" data-testid={`al-renew-panel-${plane.id}`}>
      <div className="al-cabin-head">
        <b>
          ♻️ {m.name} 바꾸기 <small className="al-muted">{Math.floor(planeAge(state, plane))}년 · 상태 {Math.round(condOf(plane))}% · 가동률 {Math.round((planeHours(state.companies[viewer], plane) / WEEK_HOURS) * 100)}%</small>
        </b>
        <button type="button" className="al-link" onClick={onClose}>
          닫기
        </button>
      </div>
      {!opt || (!opt.lease && !opt.order) ? (
        <p className="al-muted">이 비행기의 노선을 넘겨받을 수 있는 새 기종이 없어요 (거리·공항 크기·좌석 수).</p>
      ) : (
        <div className="al-renew-opts">
          {opt.lease && (
            <div className={`al-renew-opt${pick === 'lease' ? ' al-on' : ''}`}>
              <span className="al-renew-opt-head">
                <FleetIcon kind="doc" size={16} /> <b>리스로 바로</b> {pick === 'lease' && <span className="al-flag al-flag-good">비서 추천</span>}
              </span>
              <span>
                <b>{MODEL[opt.lease.model].name}</b> · 이번 달부터 달 이익{' '}
                <b className={Math.round(opt.lease.gain) >= 0 ? 'al-pos' : 'al-neg'}>{signedMoney(opt.lease.gain)}</b>
              </span>
              <small className="al-muted">
                리스료 달 {fmtMoney(opt.lease.rent)} · 보증금 {fmtMoney(opt.lease.deposit)} · {plane.leased ? '낡은 리스기는 돌려줘요' : `낡은 비행기는 ${fmtMoney(opt.sale)}에 팔아요`}
              </small>
              <ActButton
                small
                primary={pick === 'lease'}
                blocker={canAct ? buyBlocker(state, viewer, opt.lease.model, true) : notMine}
                onClick={() => go({ plane: plane.id, from: plane.model, to: opt.lease!.model, how: 'lease', gain: opt.lease!.gain, cash: opt.sale - opt.lease!.deposit, age: opt.age, cond: opt.cond })}
                testId={`al-renew-lease-${plane.id}`}
              >
                리스로 바꾸기
              </ActButton>
            </div>
          )}
          {opt.order && (
            <div className={`al-renew-opt${pick === 'order' ? ' al-on' : ''}`}>
              <span className="al-renew-opt-head">
                <FleetIcon kind="box" size={16} /> <b>주문해 두기</b> {pick === 'order' && <span className="al-flag al-flag-good">비서 추천</span>}
              </span>
              <span>
                <b>{MODEL[opt.order.model].name}</b> · {fmtMoney(opt.order.price)} · {opt.order.lead}달 뒤 ({mShort(state.t + opt.order.lead)}) 도착
              </span>
              <small className="al-muted">
                오면 노선을 넘겨받고 낡은 비행기는 {plane.leased ? '돌려줘요' : '팔아요'}. 그 뒤 달 이익{' '}
                <b className={Math.round(opt.order.gain) >= 0 ? 'al-pos' : 'al-neg'}>{signedMoney(opt.order.gain)}</b>{' '}
                (리스료 없음)
              </small>
              <ActButton
                small
                primary={pick === 'order'}
                blocker={canAct ? buyBlocker(state, viewer, opt.order.model, false) : notMine}
                onClick={() => go({ plane: plane.id, from: plane.model, to: opt.order!.model, how: 'order', gain: opt.order!.gain, cash: -opt.order!.price, lead: opt.order!.lead, age: opt.age, cond: opt.cond })}
                testId={`al-renew-order-${plane.id}`}
              >
                주문해 바꾸기
              </ActButton>
            </div>
          )}
        </div>
      )}
      {opt && !pick && (opt.lease || opt.order) && (
        <small className="al-muted">
          비서 생각: 지금은 바꿔도 달 이익이 {RENEW_MIN}억 넘게 늘지 않거나 돈이 넉넉하지 않아요.{isWorn(state.companies[viewer], plane) ? ' C점검으로 상태를 되돌리는 편이 나아요.' : ' 그래도 바꾸려면 위에서 골라요.'}
        </small>
      )}
      {why && (
        <small className="al-tip-why" role="status">
          ⚠ 지금은 할 수 없어요: {why}
        </small>
      )}
    </div>
  );
}
