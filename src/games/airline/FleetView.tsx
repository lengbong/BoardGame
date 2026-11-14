import { useState } from 'react';
import { SEAT_COLORS } from '../common/players';
import { BODY_INFO, MODEL, MODELS, availableModels, commonalityMult, launchDiscount, leadTime, sizeClass, type SizeClass } from './aircraft';
import { PlaneArt, SEAT_SHAPES } from './Art';
import { AIRPORT_INFO, CITY } from './cities';
import { fmtMoney, km } from './format';
import { CANCEL_REFUND, buyBlocker, deliveriesThisQuarter, depositFor, firstYearHelp, sellAmount, sellBlocker, usedBlocker } from './rules';
import {
  MAX_DELIVERIES,
  WEEK_HOURS,
  familyCounts,
  leaseRent,
  orderPrice,
  planeAge,
  planeHours,
  planeValue,
  routeOf,
} from './simulate';
import { qLabel, yearOf } from './time';
import type { AirlineAction, AirlineState, ModelDef } from './types';
import { ActButton, Meter, Stars } from './ui';

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

type Tab = 'hangar' | 'shop' | 'used';

export function FleetView({ state, viewer, canAct, perform, onEditRoute, onGoRoutes }: FleetViewProps) {
  const me = state.companies[viewer];
  const [tab, setTab] = useState<Tab>(me.planes.length === 0 && me.orders.length === 0 ? 'shop' : 'hangar');
  const [size, setSize] = useState<SizeClass | 'all'>('all');
  const year = yearOf(state.q);
  const color = SEAT_COLORS[me.seat];
  const shape = SEAT_SHAPES[me.seat];
  const planes = [...me.planes].sort((a, b) => (a.legs.length === 0 ? 0 : 1) - (b.legs.length === 0 ? 0 : 1) || planeHours(me, a) - planeHours(me, b));
  const models = availableModels(year).filter((m) => size === 'all' || sizeClass(m) === size);
  const soon = MODELS.filter((m) => m.intro > year && m.intro <= year + 4);
  const delivered = deliveriesThisQuarter(state, viewer);
  const families = familyCounts(me);
  const flying = me.planes.filter((p) => p.legs.length > 0);
  const avgUse = flying.length ? flying.reduce((s, p) => s + planeHours(me, p), 0) / (flying.length * WEEK_HOURS) : 0;
  const help = firstYearHelp(state, viewer);

  return (
    <div className="al-fleet">
      <div className="al-subtabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'hangar'} className={`al-subtab${tab === 'hangar' ? ' al-on' : ''}`} onClick={() => setTab('hangar')}>
          🛩️ 내 비행기 {me.planes.length}대{me.orders.length > 0 && ` · 주문 ${me.orders.length}`}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'shop'} className={`al-subtab${tab === 'shop' ? ' al-on' : ''}`} onClick={() => setTab('shop')} data-testid="al-shop-tab">
          🛒 새 비행기 (주문·리스)
        </button>
        <button type="button" role="tab" aria-selected={tab === 'used'} className={`al-subtab${tab === 'used' ? ' al-on' : ''}`} onClick={() => setTab('used')} data-testid="al-used-tab">
          🏷️ 중고 시장 {state.market.length}
        </button>
        <span className="al-subtab-note">
          이번 분기에 바로 받은 비행기 (리스·중고) {delivered}/{MAX_DELIVERIES}대
        </span>
      </div>

      {tab === 'hangar' && (
        <div className="al-hangar">
          {me.planes.length > 0 && (
            <div className="al-fleet-sum">
              <span>
                평균 가동률 <b>{Math.round(avgUse * 100)}%</b>
                <Meter value={avgUse} tone={avgUse > 0.75 ? 'good' : avgUse > 0.45 ? 'warn' : 'bad'} label={`평균 가동률 ${Math.round(avgUse * 100)}%`} />
              </span>
              <span className="al-muted">한 대가 한 주에 {WEEK_HOURS}시간까지 날아요. 남는 시간은 다른 노선에 쓰세요.</span>
              <span className="al-families">
                {[...families.entries()]
                  .filter(([, n]) => n >= 2)
                  .map(([f, n]) => (
                    <span key={f} className="al-chip al-chip-static" title="같은 계열이 많으면 조종사·부품을 함께 써서 정비·승무원비가 줄어요">
                      {f} 계열 {n}대 · 정비 −{Math.round((1 - commonalityMult(n)) * 100)}%
                    </span>
                  ))}
              </span>
            </div>
          )}
          {me.orders.length > 0 && (
            <section className="al-orders" aria-label="주문 대기">
              <h4>📦 주문 대기</h4>
              <ul>
                {[...me.orders]
                  .sort((a, b) => a.due - b.due)
                  .map((o) => {
                    const m = MODEL[o.model];
                    return (
                      <li key={o.id}>
                        <PlaneArt body={m.body} engines={m.engines} color={color.main} dark={color.dark} shape={shape} width={64} />
                        <b>{m.name}</b>
                        <span>
                          {qLabel(o.due)} 도착 <small className="al-muted">({o.due - state.q}분기 뒤)</small>
                        </span>
                        <span className="al-muted">낸 값 {fmtMoney(o.price)}</span>
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
              해 보세요. 리스는 바로 쓸 수 있고, 주문은 싸지만 몇 분기 기다려야 해요.
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
                  <PlaneArt body={m.body} engines={m.engines} color={color.main} dark={color.dark} shape={shape} width={96} />
                  <div className="al-pl-name">
                    <b>{m.name}</b>
                    <small>
                      {m.maker} · {m.seats}석 · {km(m.range)}
                    </small>
                    <small>
                      {Math.floor(age)}년째 · {p.leased ? `리스 (분기 ${fmtMoney(p.rent)}${p.deposit > 0 ? ` · 보증금 ${fmtMoney(p.deposit)}` : ''})` : `내 것 (가치 ${fmtMoney(planeValue(state, p))})`}
                      {old && ' · 단종'}
                    </small>
                  </div>
                  <div className="al-pl-route">
                    {p.legs.length > 0 ? (
                      <>
                        <span className="al-pl-use">
                          가동률 {Math.round(use * 100)}%
                          <Meter value={use} tone={use > 0.75 ? 'good' : use > 0.45 ? 'warn' : 'bad'} label={`가동률 ${Math.round(use * 100)}%`} />
                          <small className="al-muted">주 {Math.round(hours)} / {WEEK_HOURS}시간</small>
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
                        <span className="al-flag">쉬는 중</span>
                        <button type="button" className="btn btn-small" onClick={onGoRoutes} disabled={!canAct}>
                          노선에 넣기
                        </button>
                      </>
                    )}
                  </div>
                  <div className="al-pl-act">
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
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tab === 'shop' && (
        <div className="al-shop">
          <div className="al-sort" role="group" aria-label="크기">
            {(['all', 'small', 'medium', 'large'] as const).map((k) => (
              <button key={k} type="button" className={`al-chip${size === k ? ' al-on' : ''}`} onClick={() => setSize(k)}>
                {k === 'all' ? `전체 ${availableModels(year).length}` : k === 'small' ? '작은 (120석 아래)' : k === 'medium' ? '중간 (230석 아래)' : '큰 비행기'}
              </button>
            ))}
            <span className="al-muted al-shop-note">
              {year}년에 살 수 있는 기종 · 값은 어림한 오늘 돈 · 주문은 값을 먼저 내고 몇 분기 뒤에 받아요. 리스는 바로 받지만 분기마다 값의 3.5%를 내요.
              {help && ' 첫해에는 리스 보증금이 없어요.'}
            </span>
          </div>
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
                    <PlaneArt body={m.body} engines={m.engines} color={color.main} dark={color.dark} shape={shape} width={150} title={`${m.name} 옆모습`} />
                  </div>
                  <h4>
                    {m.name} <small>{m.maker}</small>
                  </h4>
                  <p className="al-mc-note">
                    {BODY_INFO[m.body].name} · {m.note}
                  </p>
                  <div className="al-mc-tags">
                    {launch > 0 && <span className="al-flag al-flag-good">첫 손님 할인 −{Math.round(launch * 100)}%</span>}
                    {famNow > 0 && (
                      <span className="al-flag al-flag-blue" title="같은 계열 비행기가 많을수록 정비·승무원비가 줄어요">
                        {m.family} 계열 {famNow}대 보유{common > 0 ? ` · 정비 −${Math.round(common * 100)}%` : ''}
                      </span>
                    )}
                    {ending && <span className="al-flag al-flag-warn">곧 단종</span>}
                  </div>
                  <dl className="al-mc-specs">
                    <div>
                      <dt>좌석</dt>
                      <dd>{m.seats}석</dd>
                    </div>
                    <div>
                      <dt>거리</dt>
                      <dd>{km(m.range)}</dd>
                    </div>
                    <div>
                      <dt>속도</dt>
                      <dd>{m.speed.toLocaleString()}km/h</dd>
                    </div>
                    <div>
                      <dt>공항</dt>
                      <dd>{AIRPORT_INFO[m.runway].name} 이상</dd>
                    </div>
                    <div>
                      <dt>연료 아끼기</dt>
                      <dd>
                        <Meter value={eff} tone={eff > 0.7 ? 'good' : eff > 0.45 ? 'warn' : 'bad'} label={`연료 효율 ${Math.round(eff * 100)}`} />
                      </dd>
                    </div>
                    <div>
                      <dt>편안함</dt>
                      <dd>
                        <Stars n={m.comfort} />
                      </dd>
                    </div>
                    <div>
                      <dt>만든 해</dt>
                      <dd>
                        {m.intro}~{m.end >= 2040 ? '지금' : m.end}
                      </dd>
                    </div>
                    <div>
                      <dt>주문하면</dt>
                      <dd>
                        {lead}분기 뒤 <small className="al-muted">({qLabel(state.q + lead)})</small>
                      </dd>
                    </div>
                  </dl>
                  <div className="al-mc-buy">
                    <ActButton
                      small
                      primary
                      blocker={canAct ? buyBlocker(state, viewer, m.id, false) : notMine}
                      onClick={() => perform({ type: 'buy', model: m.id })}
                      testId={`al-buy-${m.id}`}
                      title={`값을 지금 내고 ${qLabel(state.q + lead)}에 받아요`}
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
                      리스 · 분기 {fmtMoney(rent)} <small>{deposit > 0 ? `(보증금 ${fmtMoney(deposit)})` : '(보증금 없음)'}</small>
                    </ActButton>
                  </div>
                </li>
              );
            })}
          </ul>
          {soon.length > 0 && (
            <p className="al-muted al-soon">
              곧 나와요: {soon.map((m) => `${m.name}(${m.intro})`).join(', ')} — 나오자마자 주문하면 첫 손님 할인을 받지만 오래 기다려요.
            </p>
          )}
        </div>
      )}

      {tab === 'used' && (
        <div className="al-used">
          <p className="al-muted">
            다른 회사가 쓰던 비행기예요. 바로 받고 새것보다 싸지만, 낡을수록 연료·정비비가 더 들고 손님도 덜 좋아해요. 매물은 분기마다 바뀌어요.
          </p>
          {state.market.length === 0 && <p className="al-muted al-empty-main">지금은 나온 비행기가 없어요.</p>}
          <ul className="al-cards">
            {state.market.map((u) => {
              const m = MODEL[u.model];
              const newPrice = orderPrice(state, m, me);
              return (
                <li key={u.id} className="al-model-card al-used-card" data-testid={`al-used-${u.id}`}>
                  <div className="al-mc-art">
                    <PlaneArt body={m.body} engines={m.engines} color={color.main} dark={color.dark} shape={shape} width={130} title={`${m.name} 옆모습`} />
                  </div>
                  <h4>
                    {m.name} <small>{m.maker}</small>
                  </h4>
                  <div className="al-mc-tags">
                    <span className="al-flag">{u.age}년 된 비행기</span>
                    {u.from && <span className="al-flag al-flag-warn">{u.from}에서 나옴</span>}
                    {year > m.end && <span className="al-flag">단종 기종</span>}
                  </div>
                  <dl className="al-mc-specs">
                    <div>
                      <dt>좌석</dt>
                      <dd>{m.seats}석</dd>
                    </div>
                    <div>
                      <dt>거리</dt>
                      <dd>{km(m.range)}</dd>
                    </div>
                    <div>
                      <dt>새것 값</dt>
                      <dd>{year <= m.end ? fmtMoney(newPrice) : '—'}</dd>
                    </div>
                  </dl>
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
