import { useState } from 'react';
import './fleet.css';
import { coColors } from './brand';
import { BODY_INFO, MODEL, MODELS, availableModels, commonalityMult, isFictional, launchDiscount, leadTime, sizeClass, type SizeClass } from './aircraft';
import { EAST_MAKERS } from './politics';
import { SEAT_SHAPES } from './Art';
import { AIRPORT_INFO, CITY, dist } from './cities';
import { fmtMoney, km } from './format';
import { CANCEL_REFUND, buyBlocker, deliveriesThisQuarter, depositFor, firstYearHelp, sellAmount, sellBlocker, usedBlocker } from './rules';
import {
  MAX_DELIVERIES,
  WEEK_HOURS,
  familyCounts,
  leaseRent,
  legHours,
  orderPrice,
  planeAge,
  planeHours,
  planeValue,
  routeOf,
} from './simulate';
import { MEAL_NAMES } from './cabin';
import { mLabel, mShort, yearOf } from './time';
import type { AirlineAction, AirlineState, ModelDef } from './types';
import { CabinEditor, cabinSeatText } from './CabinEditor';
import { CheckButton, CondBar, PlaneCondition } from './ConditionArt';
import { checkAtOf, fleetCond, inCheck } from './condition';
import { DaySchedule } from './DaySchedule';
import { ArrivalTimeline, FleetIcon, HoursBar, SpecBars, toneOfUse, type FleetIconKind } from './FleetArt';
import { FinIcon, ProgressRing } from './FinanceArt';
import { PlaneImage } from './PlaneImage';
import { FreighterShop } from './FreighterShop';
import { bizModelOf } from './bizmodel';
import { availableFreighters } from './freighters';
import { MoreInfo } from './StaffArt';
import { ActButton } from './ui';

interface FleetViewProps {
  state: AirlineState;
  viewer: number;
  canAct: boolean;
  perform: (a: AirlineAction) => void;
  onEditRoute: (routeId: number) => void;
  onGoRoutes: () => void;
}

const notMine = '내 차례에만 할 수 있어요';

/** 좌석 100개를 100km 나르는 데 드는 연료 (kg) */
const fuelPerSeat = (m: ModelDef) => (m.burn / m.seats) * 10000;
const BEST_FUEL = Math.min(...MODELS.map(fuelPerSeat));

type Tab = 'hangar' | 'shop' | 'used' | 'day';

export function FleetView({ state, viewer, canAct, perform, onEditRoute, onGoRoutes }: FleetViewProps) {
  const me = state.companies[viewer];
  const [tab, setTab] = useState<Tab>(me.planes.length === 0 && me.orders.length === 0 ? 'shop' : 'hangar');
  const [size, setSize] = useState<SizeClass | 'all' | 'cargo'>(bizModelOf(me) === 'cargo' ? 'cargo' : 'all');
  const [cabinFor, setCabinFor] = useState<number | null>(null);
  const year = yearOf(state.q);
  const color = coColors(me);
  const paint = { main: color.main, dark: color.dark, shape: SEAT_SHAPES[me.seat] };
  const planes = [...me.planes].sort((a, b) => (a.legs.length === 0 ? 0 : 1) - (b.legs.length === 0 ? 0 : 1) || planeHours(me, a) - planeHours(me, b));
  const models = size === 'cargo' ? [] : availableModels(year).filter((m) => size === 'all' || sizeClass(m) === size);
  const soon = MODELS.filter((m) => m.intro > year && m.intro <= year + 4);
  const delivered = deliveriesThisQuarter(state, viewer);
  const families = familyCounts(me);
  const flying = me.planes.filter((p) => p.legs.length > 0);
  const avgUse = flying.length ? flying.reduce((s, p) => s + planeHours(me, p), 0) / (flying.length * WEEK_HOURS) : 0;
  const help = firstYearHelp(state, viewer);
  const owned = me.planes.filter((p) => !p.leased).length;
  const idle = me.planes.length - flying.length;
  const avgAge = me.planes.length ? me.planes.reduce((s, p) => s + planeAge(state, p), 0) / me.planes.length : 0;
  // 성능 막대는 지금 살 수 있는 모든 기종 가운데 가장 큰 값에 견준다
  const all = availableModels(year);
  const top = {
    seats: Math.max(1, ...all.map((m) => m.seats)),
    range: Math.max(1, ...all.map((m) => m.range)),
    speed: Math.max(1, ...all.map((m) => m.speed)),
  };
  /** 비행기 한 대의 노선별 한 주 비행시간 */
  const hourParts = (p: (typeof me.planes)[number]) => {
    const pm = MODEL[p.model];
    return p.legs
      .filter((l) => l.freq > 0)
      .map((l) => {
        const r = routeOf(me, l.route);
        return r ? { label: `${CITY[r.a].name} ⇄ ${CITY[r.b].name} 주 ${l.freq}회`, hours: 2 * legHours(pm, dist(r.a, r.b)) * l.freq } : null;
      })
      .filter((x): x is { label: string; hours: number } => x !== null);
  };
  const specRows = (m: ModelDef, extra: { icon: FleetIconKind; label: string; v: number; text: string; tone?: 'good' | 'warn' | 'bad' }[] = []) => [
    { icon: 'seat' as const, label: '좌석', v: m.seats / top.seats, text: `${m.seats}석` },
    { icon: 'range' as const, label: '거리', v: m.range / top.range, text: km(m.range) },
    ...extra,
  ];

  return (
    <div className="al-fleet">
      <div className="al-subtabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'hangar'} className={`al-subtab${tab === 'hangar' ? ' al-on' : ''}`} onClick={() => setTab('hangar')}>
          <FleetIcon kind="plane" size={16} /> 내 비행기 {me.planes.length}대{me.orders.length > 0 && ` · 주문 ${me.orders.length}`}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'shop'} className={`al-subtab${tab === 'shop' ? ' al-on' : ''}`} onClick={() => setTab('shop')} data-testid="al-shop-tab">
          <FleetIcon kind="box" size={16} /> 새 비행기 (주문·리스)
        </button>
        <button type="button" role="tab" aria-selected={tab === 'used'} className={`al-subtab${tab === 'used' ? ' al-on' : ''}`} onClick={() => setTab('used')} data-testid="al-used-tab">
          <FleetIcon kind="tag" size={16} /> 중고 시장 {state.market.length}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'day'} className={`al-subtab${tab === 'day' ? ' al-on' : ''}`} onClick={() => setTab('day')} data-testid="al-day-tab">
          <FleetIcon kind="clock" size={16} /> 하루 운항표
        </button>
        <span className="al-subtab-note al-fl-deliv" title="리스·중고 비행기는 한 달에 이만큼까지 바로 받을 수 있어요">
          이번 달 바로 받기 (리스·중고)
          <span className="al-fl-deliv-pips" aria-hidden="true">
            {Array.from({ length: MAX_DELIVERIES }, (_, i) => (
              <FleetIcon key={i} kind="plane" size={15} className={i < delivered ? 'al-on' : ''} />
            ))}
          </span>
          <b>
            {delivered}/{MAX_DELIVERIES}대
          </b>
        </span>
      </div>

      {tab === 'day' && (
        <section className="al-card al-day-card">
          <h4 className="al-fin-title">
            <FleetIcon kind="clock" /> 하루 운항표 <small>노선을 나는 비행기 {flying.length}대</small>
          </h4>
          <DaySchedule state={state} ci={viewer} planes={[...flying].sort((a, b) => planeHours(me, b) - planeHours(me, a))} limit={40} />
          <MoreInfo label="시간대는 어디서 바꿔요?">노선마다 시간대(아침·낮·저녁·밤) 나누기는 ‘노선’ 화면의 운항 시간표에서 바꿔요.</MoreInfo>
        </section>
      )}

      {tab === 'hangar' && (
        <div className="al-hangar">
          {me.planes.length > 0 && (
            <section className="al-card al-fl-sum">
              <ul className="al-staff-kpi al-fl-kpi">
                <li className="al-kpi-ok">
                  <FleetIcon kind="plane" size={26} />
                  <span>
                    <small>비행기</small>
                    <b>{me.planes.length}대</b>
                    <small>
                      내 것 {owned} · 리스 {me.planes.length - owned}
                    </small>
                  </span>
                </li>
                <li className={toneOfUse(avgUse) === 'bad' ? 'al-kpi-bad' : 'al-kpi-ok'}>
                  <ProgressRing value={avgUse} tone={toneOfUse(avgUse) === 'good' ? 'good' : toneOfUse(avgUse) === 'warn' ? 'warn' : 'bad'} size={42} label={`평균 가동률 ${Math.round(avgUse * 100)}%`} />
                  <span>
                    <small>평균 가동률</small>
                    <b>{Math.round(avgUse * 100)}%</b>
                    <small>한 대 주 {WEEK_HOURS}시간까지</small>
                  </span>
                </li>
                <li className={idle > 0 ? 'al-kpi-warn' : 'al-kpi-ok'}>
                  <FleetIcon kind="parked" size={26} />
                  <span>
                    <small>쉬는 비행기</small>
                    <b>{idle}대</b>
                    <small>{idle > 0 ? '예비기로 대신 날아요' : '모두 날아요'}</small>
                  </span>
                </li>
                <li className="al-kpi-ok">
                  <FleetIcon kind="age" size={26} />
                  <span>
                    <small>평균 나이</small>
                    <b>{avgAge.toFixed(1)}년</b>
                    <small>낡을수록 연료·정비비 ↑</small>
                  </span>
                </li>
                <li className={fleetCond(me) < checkAtOf(me) + 5 ? 'al-kpi-warn' : 'al-kpi-ok'}>
                  <FinIcon kind="wrench" size={26} />
                  <span>
                    <small>평균 기체 상태</small>
                    <b>{Math.round(fleetCond(me))}%</b>
                    <small>
                      <CondBar cond={fleetCond(me)} at={checkAtOf(me)} width={60} /> 이번 달 C점검 {me.planes.filter((p) => inCheck(p, state.t)).length}대
                    </small>
                  </span>
                </li>
              </ul>
              {[...families.entries()].some(([, n]) => n >= 2) && (
                <div className="al-families al-fl-families">
                  {[...families.entries()]
                    .filter(([, n]) => n >= 2)
                    .map(([f, n]) => (
                      <span key={f} className="al-chip al-chip-static" title="같은 계열이 많으면 조종사·부품을 함께 써서 정비·승무원비가 줄어요">
                        <FleetIcon kind="stack" size={14} /> {f} 계열 {n}대 · 정비 −{Math.round((1 - commonalityMult(n)) * 100)}%
                      </span>
                    ))}
                </div>
              )}
              <MoreInfo>
                한 대가 한 주에 {WEEK_HOURS}시간까지 날아요. 가동률이 낮은 비행기는 남는 시간을 다른 노선에 쓰면 리스료·정비비를 더 잘 벌어요. 같은 계열(예: 727, 737) 비행기가 여러 대면 조종사·부품을 함께 써서 정비·승무원비가 줄어요.
                쉬는 비행기는 기체 점검·결항 때 대신 나는 예비기가 돼요.
              </MoreInfo>
            </section>
          )}
          {me.orders.length > 0 && (
            <section className="al-orders" aria-label="주문 대기">
              <h4 className="al-fin-title">
                <FleetIcon kind="box" /> 주문 대기 <small>{me.orders.length}대</small>
              </h4>
              <ArrivalTimeline now={state.t} items={me.orders.map((o) => ({ due: o.due, label: MODEL[o.model].name }))} />
              <ul>
                {[...me.orders]
                  .sort((a, b) => a.due - b.due)
                  .map((o) => {
                    const m = MODEL[o.model];
                    return (
                      <li key={o.id}>
                        <PlaneImage model={m.id} paint={paint} className="al-thumb" />
                        <b>{m.name}</b>
                        <span className="al-fl-meta">
                          <FleetIcon kind="calendar" size={14} /> {mLabel(o.due)} 도착 <small className="al-muted">({o.due - state.t}달 뒤)</small>
                        </span>
                        <span className="al-fl-meta al-muted">
                          <FinIcon kind="coin" size={14} /> 낸 값 {fmtMoney(o.price)}
                        </span>
                        <ActButton
                          small
                          blocker={canAct ? null : notMine}
                          onClick={() => {
                            if (window.confirm(`${m.name} 주문을 무를까요? 낸 값의 ${Math.round(CANCEL_REFUND * 100)}%(${fmtMoney(Math.round(o.price * CANCEL_REFUND))})만 돌려받아요.`))
                              perform({ type: 'cancelOrder', order: o.id });
                          }}
                        >
                          주문 무르기
                        </ActButton>
                      </li>
                    );
                  })}
              </ul>
            </section>
          )}
          {planes.length === 0 && (
            <p className="al-muted al-empty-main">
              아직 비행기가 없어요.{' '}
              <button type="button" className="al-link" onClick={() => setTab('shop')}>
                리스하거나 주문
              </button>
              해 보세요. 리스는 바로 쓸 수 있고, 주문은 싸지만 몇 달 기다려야 해요.
            </p>
          )}
          <ul className="al-plane-list">
            {planes.map((p) => {
              const m = MODEL[p.model];
              const age = planeAge(state, p);
              const old = year > m.end;
              const hours = planeHours(me, p);
              const use = hours / WEEK_HOURS;
              const spare = WEEK_HOURS - hours;
              const amount = sellAmount(state, p);
              return (
                <li key={p.id} className={p.legs.length ? '' : 'al-idle'}>
                  <span className="al-pl-art">
                    <PlaneImage model={m.id} paint={paint} className="al-thumb" />
                  </span>
                  <div className="al-pl-name">
                    <b>{m.name}</b>
                    <small>
                      {m.maker} · {km(m.range)}
                    </small>
                    <button type="button" className="al-link al-small al-cabin-link al-fl-cabin" onClick={() => setCabinFor(cabinFor === p.id ? null : p.id)} aria-expanded={cabinFor === p.id} data-testid={`al-cabin-open-${p.id}`}>
                      <FleetIcon kind="seat" size={14} /> {cabinSeatText(p)} <FinIcon kind="meal" size={14} /> {MEAL_NAMES[p.meal]}
                    </button>
                    <small className="al-fl-meta">
                      <FleetIcon kind="age" size={13} /> {Math.floor(age)}년째
                      {p.leased ? (
                        <>
                          <FleetIcon kind="doc" size={13} /> 리스 · 달 {fmtMoney(p.rent)}
                          {p.deposit > 0 ? ` · 보증금 ${fmtMoney(p.deposit)}` : ''}
                        </>
                      ) : (
                        <>
                          <FleetIcon kind="key" size={13} /> 내 것 · 가치 {fmtMoney(planeValue(state, p))}
                        </>
                      )}
                      {old && <span className="al-flag al-flag-warn">단종</span>}
                    </small>
                    <PlaneCondition state={state} c={me} p={p} />
                  </div>
                  <div className="al-pl-route">
                    {p.legs.length > 0 ? (
                      <>
                        <span className="al-fl-use">
                          <span className="al-fl-use-label">
                            가동률 <b>{Math.round(use * 100)}%</b>
                          </span>
                          <HoursBar parts={hourParts(p)} max={WEEK_HOURS} tone={toneOfUse(use)} />
                        </span>
                        {p.legs.map((l) => {
                          const r = routeOf(me, l.route);
                          if (!r) return null;
                          return (
                            <button key={l.route} type="button" className="al-link" onClick={() => onEditRoute(r.id)}>
                              {CITY[r.a].name} ⇄ {CITY[r.b].name} · 주 {l.freq}회
                            </button>
                          );
                        })}
                        {spare >= 12 && (
                          <button type="button" className="al-link al-small" onClick={onGoRoutes} disabled={!canAct}>
                            남는 {Math.round(spare)}시간을 다른 노선에 쓰기 →
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="al-flag al-fl-idle-flag">
                          <FleetIcon kind="parked" size={14} /> 쉬는 중 · 예비기
                        </span>
                        <button type="button" className="btn btn-small" onClick={onGoRoutes} disabled={!canAct}>
                          노선에 넣기
                        </button>
                      </>
                    )}
                  </div>
                  <div className="al-pl-act">
                    <CheckButton state={state} viewer={viewer} p={p} canAct={canAct} perform={perform} />
                    <ActButton
                      small
                      blocker={canAct ? sellBlocker(state, viewer, p.id) : notMine}
                      onClick={() => {
                        const msg = p.leased
                          ? `${m.name}을 돌려줄까요? 보증금 ${fmtMoney(p.deposit)}을 돌려받고 위약금 ${fmtMoney(p.rent)}을 내요.`
                          : `${m.name}을 ${fmtMoney(amount)}에 팔까요?`;
                        if (window.confirm(msg)) perform({ type: 'sell', plane: p.id });
                      }}
                    >
                      {p.leased ? `반납 ${amount >= 0 ? '+' : '−'}${fmtMoney(Math.abs(amount))}` : `팔기 +${fmtMoney(amount)}`}
                    </ActButton>
                  </div>
                  {cabinFor === p.id && <CabinEditor state={state} viewer={viewer} plane={p} canAct={canAct} perform={perform} onClose={() => setCabinFor(null)} />}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tab === 'shop' && (
        <div className="al-shop">
          <div className="al-sort" role="group" aria-label="크기">
            {(['all', 'small', 'medium', 'large', 'cargo'] as const).map((k) => (
              <button key={k} type="button" className={`al-chip${size === k ? ' al-on' : ''}`} onClick={() => setSize(k)} data-testid={`al-size-${k}`}>
                {k === 'all' ? `전체 ${availableModels(year).length}` : k === 'small' ? '작은 (120석 아래)' : k === 'medium' ? '중간 (230석 아래)' : k === 'large' ? '큰 비행기' : `📦 화물기 ${availableFreighters(year).length}`}
              </button>
            ))}
            <span className="al-muted al-shop-note">
              {year}년에 살 수 있는 기종{help && ' · 첫해에는 리스 보증금이 없어요'}
            </span>
          </div>
          <div className="al-fl-howto">
            <span>
              <FleetIcon kind="box" size={18} /> <b>주문</b> 값을 먼저 내고 3~12달 뒤에 받아요 (더 싸요)
            </span>
            <span>
              <FleetIcon kind="doc" size={18} /> <b>리스</b> 바로 받고 달마다 값의 1.2% 남짓을 내요
            </span>
          </div>
          <MoreInfo>값은 그 해 값을 오늘 돈으로 어림한 것이에요. 주문하면 값을 먼저 내고 몇 달 기다려야 하지만 내 것이 되어 나중에 팔 수 있어요. 리스는 바로 받아 쓸 수 있고, 돌려줄 때 보증금을 돌려받지만 위약금으로 한 달 치를 내요.</MoreInfo>
          {size === 'cargo' && <FreighterShop state={state} viewer={viewer} canAct={canAct} perform={perform} />}
          <ul className="al-cards">
            {models.map((m) => {
              const eff = BEST_FUEL / fuelPerSeat(m);
              const ending = m.end <= year + 1 && m.end < 2040;
              const lead = leadTime(m, year);
              const launch = launchDiscount(m, year);
              const famNow = families.get(m.family) ?? 0;
              const common = 1 - commonalityMult(famNow + 1);
              const deposit = depositFor(state, viewer, m.id);
              const rent = leaseRent(state, m);
              return (
                <li key={m.id} className="al-model-card" data-testid={`al-model-${m.id}`}>
                  <div className="al-mc-art">
                    <PlaneImage model={m.id} label={m.name} />
                  </div>
                  <h4>
                    {m.name} <small>{m.maker}</small>
                  </h4>
                  <p className="al-mc-note">
                    {BODY_INFO[m.body].name} · {m.note}
                  </p>
                  <div className="al-mc-tags">
                    {isFictional(m) && (
                      <span className="al-flag al-flag-blue" title="실제로 만들어지지 않은 게임 속 미래 기종이에요">
                        ✨ 상상 속 기종
                      </span>
                    )}
                    {EAST_MAKERS.includes(m.maker) && <span className="al-flag">☭ 소련·러시아제</span>}
                    {launch > 0 && <span className="al-flag al-flag-good">첫 손님 할인 −{Math.round(launch * 100)}%</span>}
                    {famNow > 0 && (
                      <span className="al-flag al-flag-blue" title="같은 계열 비행기가 많을수록 정비·승무원비가 줄어요">
                        {m.family} 계열 {famNow}대 보유{common > 0 ? ` · 정비 −${Math.round(common * 100)}%` : ''}
                      </span>
                    )}
                    {ending && <span className="al-flag al-flag-warn">곧 단종</span>}
                  </div>
                  <SpecBars
                    rows={specRows(m, [
                      { icon: 'speed', label: '속도', v: m.speed / top.speed, text: `${m.speed.toLocaleString()}km/h` },
                      { icon: 'fuel', label: '연료 아끼기', v: eff, text: `${Math.round(eff * 100)}점`, tone: eff > 0.7 ? 'good' : eff > 0.45 ? 'warn' : 'bad' },
                      { icon: 'comfort', label: '편안함', v: m.comfort / 5, text: `${m.comfort} / 5` },
                    ])}
                  />
                  <ul className="al-fl-facts">
                    <li title="이 비행기가 내릴 수 있는 가장 작은 공항">
                      <FleetIcon kind="runway" size={14} /> {AIRPORT_INFO[m.runway].name} 이상
                    </li>
                    <li title="만든 해">
                      <FleetIcon kind="calendar" size={14} /> {m.intro}~{m.end >= 2040 ? '지금' : m.end}
                    </li>
                    <li title={`주문하면 ${mLabel(state.t + lead)}에 받아요`}>
                      <FleetIcon kind="box" size={14} /> 주문하면 {lead}달 뒤 <small className="al-muted">({mShort(state.t + lead)})</small>
                    </li>
                  </ul>
                  <div className="al-mc-buy">
                    <ActButton
                      small
                      primary
                      blocker={canAct ? buyBlocker(state, viewer, m.id, false) : notMine}
                      onClick={() => perform({ type: 'buy', model: m.id })}
                      testId={`al-buy-${m.id}`}
                      title={`값을 지금 내고 ${mLabel(state.t + lead)}에 받아요`}
                    >
                      주문 {fmtMoney(orderPrice(state, m, me))}
                    </ActButton>
                    <ActButton
                      small
                      blocker={canAct ? buyBlocker(state, viewer, m.id, true) : notMine}
                      onClick={() => perform({ type: 'lease', model: m.id })}
                      title={deposit > 0 ? `보증금 ${fmtMoney(deposit)}은 돌려줄 때 돌려받아요` : '첫해에는 보증금 없이 바로 받아요'}
                      testId={`al-lease-${m.id}`}
                    >
                      리스 · 달 {fmtMoney(rent)} <small>{deposit > 0 ? `(보증금 ${fmtMoney(deposit)})` : '(보증금 없음)'}</small>
                    </ActButton>
                  </div>
                </li>
              );
            })}
          </ul>
          {soon.length > 0 && (
            <section className="al-fl-soon" aria-label="곧 나오는 기종">
              <h5 className="al-fin-sub">
                <FleetIcon kind="calendar" size={16} /> 곧 나와요 <small>나오자마자 주문하면 첫 손님 할인을 받지만 오래 기다려요</small>
              </h5>
              <ol className="al-fl-soon-years">
                {[...new Set(soon.map((m) => m.intro))]
                  .sort((x, y) => x - y)
                  .map((yr) => (
                    <li key={yr}>
                      <b>{yr}</b>
                      <span>
                        {soon
                          .filter((m) => m.intro === yr)
                          .map((m) => (
                            <span key={m.id} className="al-chip al-chip-static">
                              <FleetIcon kind="plane" size={13} /> {m.name}
                            </span>
                          ))}
                      </span>
                    </li>
                  ))}
              </ol>
            </section>
          )}
        </div>
      )}

      {tab === 'used' && (
        <div className="al-used">
          <div className="al-fl-howto">
            <span>
              <FleetIcon kind="tag" size={18} /> 다른 회사가 쓰던 비행기예요. <b>바로 받고 새것보다 싸요</b>
            </span>
            <span>
              <FleetIcon kind="age" size={18} /> 낡을수록 연료·정비비가 더 들고 손님도 덜 좋아해요
            </span>
          </div>
          <MoreInfo>매물은 달마다 조금씩 바뀌어요. 노선에 넣지 않은 비행기는 기체 점검이나 결항 때 대신 나는 예비기가 돼요.</MoreInfo>
          {state.market.length === 0 && <p className="al-muted al-empty-main">지금은 나온 비행기가 없어요.</p>}
          <ul className="al-cards">
            {state.market.map((u) => {
              const m = MODEL[u.model];
              const newPrice = orderPrice(state, m, me);
              return (
                <li key={u.id} className="al-model-card al-used-card" data-testid={`al-used-${u.id}`}>
                  <div className="al-mc-art">
                    <PlaneImage model={m.id} label={m.name} />
                  </div>
                  <h4>
                    {m.name} <small>{m.maker}</small>
                  </h4>
                  <div className="al-mc-tags">
                    <span className="al-flag">{u.age}년 된 비행기</span>
                    {u.from && <span className="al-flag al-flag-warn">{u.from}에서 나옴</span>}
                    {year > m.end && <span className="al-flag">단종 기종</span>}
                  </div>
                  <SpecBars
                    rows={specRows(m, [
                      { icon: 'age', label: '나이', v: Math.min(1, u.age / 30), text: `${u.age}년`, tone: u.age < 10 ? 'good' : u.age < 20 ? 'warn' : 'bad' },
                      ...(year <= m.end && newPrice > 0
                        ? [{ icon: 'tag' as const, label: '값', v: Math.min(1, u.price / newPrice), text: `새것의 ${Math.round((u.price / newPrice) * 100)}%` }]
                        : []),
                    ])}
                  />
                  {year <= m.end && <small className="al-muted al-fl-newprice">새것 값 {fmtMoney(newPrice)}</small>}
                  <div className="al-mc-buy">
                    <ActButton small primary blocker={canAct ? usedBlocker(state, viewer, u.id) : notMine} onClick={() => perform({ type: 'buyUsed', listing: u.id })} testId={`al-buyused-${u.id}`}>
                      사기 {fmtMoney(u.price)}
                    </ActButton>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
