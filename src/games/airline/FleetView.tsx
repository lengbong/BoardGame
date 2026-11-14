import { useState } from 'react';
import { SEAT_COLORS } from '../common/players';
import { BODY_INFO, MODEL, MODELS, availableModels, sizeClass, type SizeClass } from './aircraft';
import { PlaneArt, SEAT_SHAPES } from './Art';
import { AIRPORT_INFO, CITY } from './cities';
import { fmtMoney, km } from './format';
import { buyBlocker, deliveriesThisQuarter, sellBlocker } from './rules';
import { MAX_DELIVERIES, leaseDeposit, leaseRent, modelPrice, planeAge, planeValue, sellPrice } from './simulate';
import { yearOf } from './time';
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

export function FleetView({ state, viewer, canAct, perform, onEditRoute, onGoRoutes }: FleetViewProps) {
  const me = state.companies[viewer];
  const [tab, setTab] = useState<'hangar' | 'shop'>(me.planes.length === 0 ? 'shop' : 'hangar');
  const [size, setSize] = useState<SizeClass | 'all'>('all');
  const year = yearOf(state.q);
  const color = SEAT_COLORS[me.seat];
  const shape = SEAT_SHAPES[me.seat];
  const planes = [...me.planes].sort((a, b) => (a.route === null ? 0 : 1) - (b.route === null ? 0 : 1) || planeAge(state, b) - planeAge(state, a));
  const models = availableModels(year).filter((m) => size === 'all' || sizeClass(m) === size);
  const soon = MODELS.filter((m) => m.intro > year && m.intro <= year + 4);
  const delivered = deliveriesThisQuarter(state, viewer);

  return (
    <div className="al-fleet">
      <div className="al-subtabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'hangar'} className={`al-subtab${tab === 'hangar' ? ' al-on' : ''}`} onClick={() => setTab('hangar')}>
          🛩️ 내 비행기 {me.planes.length}대
        </button>
        <button type="button" role="tab" aria-selected={tab === 'shop'} className={`al-subtab${tab === 'shop' ? ' al-on' : ''}`} onClick={() => setTab('shop')} data-testid="al-shop-tab">
          🛒 새 비행기 사기·리스
        </button>
        <span className="al-subtab-note">
          이번 분기에 받은 비행기 {delivered}/{MAX_DELIVERIES}대
        </span>
      </div>

      {tab === 'hangar' ? (
        <div className="al-hangar">
          {planes.length === 0 && (
            <p className="al-muted al-empty-main">
              아직 비행기가 없어요.{' '}
              <button type="button" className="al-link" onClick={() => setTab('shop')}>
                새 비행기를 사거나 리스
              </button>
              해 보세요. 리스는 계약금만 내고 바로 쓸 수 있어요.
            </p>
          )}
          <ul className="al-plane-list">
            {planes.map((p) => {
              const m = MODEL[p.model];
              const r = p.route !== null ? me.routes.find((x) => x.id === p.route) : undefined;
              const age = planeAge(state, p);
              const old = year > m.end;
              return (
                <li key={p.id} className={r ? '' : 'al-idle'}>
                  <PlaneArt body={m.body} engines={m.engines} color={color.main} dark={color.dark} shape={shape} width={96} />
                  <div className="al-pl-name">
                    <b>{m.name}</b>
                    <small>
                      {m.maker} · {m.seats}석 · {km(m.range)}
                    </small>
                    <small>
                      {Math.floor(age)}년째 · {p.leased ? `리스 (분기 ${fmtMoney(p.rent)})` : `내 것 (가치 ${fmtMoney(planeValue(state, p))})`}
                      {old && ' · 단종'}
                    </small>
                  </div>
                  <div className="al-pl-route">
                    {r ? (
                      <button type="button" className="al-link" onClick={() => onEditRoute(r.id)}>
                        {CITY[r.a].name} ⇄ {CITY[r.b].name} · 주 {p.freq}회
                      </button>
                    ) : (
                      <span className="al-flag">쉬는 중</span>
                    )}
                    {!r && (
                      <button type="button" className="btn btn-small" onClick={onGoRoutes} disabled={!canAct}>
                        노선에 넣기
                      </button>
                    )}
                  </div>
                  <div className="al-pl-act">
                    <ActButton
                      small
                      blocker={canAct ? sellBlocker(state, viewer, p.id) : notMine}
                      onClick={() => {
                        if (window.confirm(p.leased ? `${m.name}을 돌려줄까요? 위약금 ${fmtMoney(p.rent)}을 내요.` : `${m.name}을 ${fmtMoney(sellPrice(state, p))}에 팔까요?`))
                          perform({ type: 'sell', plane: p.id });
                      }}
                    >
                      {p.leased ? `반납 −${fmtMoney(p.rent)}` : `팔기 +${fmtMoney(sellPrice(state, p))}`}
                    </ActButton>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="al-shop">
          <div className="al-sort" role="group" aria-label="크기">
            {(['all', 'small', 'medium', 'large'] as const).map((k) => (
              <button key={k} type="button" className={`al-chip${size === k ? ' al-on' : ''}`} onClick={() => setSize(k)}>
                {k === 'all' ? `전체 ${availableModels(year).length}` : k === 'small' ? '작은 (120석 아래)' : k === 'medium' ? '중간 (230석 아래)' : '큰 비행기'}
              </button>
            ))}
            <span className="al-muted al-shop-note">{year}년에 살 수 있는 기종 · 값은 어림한 오늘 돈</span>
          </div>
          <ul className="al-cards">
            {models.map((m) => {
              const eff = BEST_FUEL / fuelPerSeat(m);
              const ending = m.end <= year + 1 && m.end < 2040;
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
                        {ending && <span className="al-flag al-flag-warn">곧 단종</span>}
                      </dd>
                    </div>
                  </dl>
                  <div className="al-mc-buy">
                    <ActButton small primary blocker={canAct ? buyBlocker(state, viewer, m.id, false) : notMine} onClick={() => perform({ type: 'buy', model: m.id })} testId={`al-buy-${m.id}`}>
                      사기 {fmtMoney(modelPrice(state, m))}
                    </ActButton>
                    <ActButton
                      small
                      blocker={canAct ? buyBlocker(state, viewer, m.id, true) : notMine}
                      onClick={() => perform({ type: 'lease', model: m.id })}
                      title="두 분기 치 리스료를 계약금으로 내요"
                      testId={`al-lease-${m.id}`}
                    >
                      리스 {fmtMoney(leaseDeposit(state, m))} <small>(분기 {fmtMoney(leaseRent(state, m))})</small>
                    </ActButton>
                  </div>
                </li>
              );
            })}
          </ul>
          {soon.length > 0 && (
            <p className="al-muted al-soon">
              곧 나와요: {soon.map((m) => `${m.name}(${m.intro})`).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
