import './v4.css';
import { BODY_INFO, endingSoon, launchDiscount, leadTime, productionYears } from './aircraft';
import { bizModelOf } from './bizmodel';
import { AIRPORT_INFO } from './cities';
import { FREIGHTERS, availableFreighters } from './freighters';
import { fmtMoney, km } from './format';
import { buyBlocker, depositFor } from './rules';
import { leaseRent, orderPrice } from './simulate';
import { mLabel, mShort, yearOf } from './time';
import type { AirlineAction, AirlineState } from './types';
import { FleetIcon, SpecBars } from './FleetArt';
import { MoreInfo } from './StaffArt';
import { PlaneImage } from './PlaneImage';
import { ActButton } from './ui';

const notMine = '내 차례에만 할 수 있어요';

/** 비행기 화면 ‘새 비행기’의 화물기 고르기 */
export function FreighterShop({ state, viewer, canAct, perform }: { state: AirlineState; viewer: number; canAct: boolean; perform: (a: AirlineAction) => void }) {
  const me = state.companies[viewer];
  const year = yearOf(state.q);
  const list = availableFreighters(year);
  const soon = FREIGHTERS.filter((m) => m.intro > year && m.intro <= year + 6);
  const top = { cargo: Math.max(1, ...list.map((m) => m.cargo ?? 0)), range: Math.max(1, ...list.map((m) => m.range)) };
  const model = bizModelOf(me);
  return (
    <div className="al-freighters" data-testid="al-freighter-shop">
      <p className="al-muted al-freighter-note">
        {model === 'lcc'
          ? '저가항공은 화물기를 쓰지 않아요 (재무 화면에서 사업 모델을 바꿀 수 있어요).'
          : model === 'cargo'
            ? '화물 전문 회사는 화물기로만 날아요. 짐이 많은 무역 도시(홍콩·프랑크푸르트·싱가포르·두바이…) 사이 먼 노선이 좋아요.'
            : '넓은 동체 여객기의 배 아래 짐칸으로 모자라면 화물기를 띄워요. 짐이 많은 무역 도시 사이 먼 노선이 좋아요.'}
      </p>
      {list.length === 0 && <p className="al-muted al-empty-main">{year}년에는 새로 살 수 있는 화물기가 없어요.</p>}
      <ul className="al-cards">
        {list.map((m) => {
          const lead = leadTime(m, year);
          const launch = launchDiscount(m, year);
          const deposit = depositFor(state, viewer, m.id);
          const made = productionYears(m, year);
          return (
            <li key={m.id} className="al-model-card" data-testid={`al-model-${m.id}`}>
              <div className="al-mc-art">
                <PlaneImage model={m.id} label={m.name} />
              </div>
              <h4>
                {m.name} <small>{m.maker}</small>
              </h4>
              <p className="al-mc-note">
                {BODY_INFO[m.body].name} 화물기 · {m.note}
              </p>
              <div className="al-mc-tags">
                <span className="al-flag al-flag-blue al-mc-cargo">📦 {m.cargo}톤</span>
                {launch > 0 && <span className="al-flag al-flag-good">첫 손님 할인 −{Math.round(launch * 100)}%</span>}
                {endingSoon(m, year) && <span className="al-flag al-flag-warn">곧 단종</span>}
              </div>
              <SpecBars
                rows={[
                  { icon: 'box', label: '짐', v: (m.cargo ?? 0) / top.cargo, text: `${m.cargo}톤` },
                  { icon: 'range', label: '거리', v: m.range / top.range, text: km(m.range) },
                ]}
              />
              <ul className="al-fl-facts">
                <li title="이 비행기가 내릴 수 있는 가장 작은 공항">
                  <FleetIcon kind="runway" size={14} /> {AIRPORT_INFO[m.runway].name} 이상
                </li>
                <li title={made.title}>
                  <FleetIcon kind="calendar" size={14} /> {made.years}
                  {made.left && <small className="al-muted"> · {made.left}</small>}
                </li>
                <li title={`주문하면 ${mLabel(state.t + lead)}에 받아요`}>
                  <FleetIcon kind="box" size={14} /> 주문하면 {lead}달 뒤 <small className="al-muted">({mShort(state.t + lead)})</small>
                </li>
              </ul>
              <div className="al-mc-buy">
                <ActButton small primary blocker={canAct ? buyBlocker(state, viewer, m.id, false) : notMine} onClick={() => perform({ type: 'buy', model: m.id })} testId={`al-buy-${m.id}`}>
                  주문 {fmtMoney(orderPrice(state, m, me))}
                </ActButton>
                <ActButton
                  small
                  blocker={canAct ? buyBlocker(state, viewer, m.id, true) : notMine}
                  onClick={() => perform({ type: 'lease', model: m.id })}
                  title={deposit > 0 ? `보증금 ${fmtMoney(deposit)}은 돌려줄 때 돌려받아요` : '첫해에는 보증금 없이 바로 받아요'}
                  testId={`al-lease-${m.id}`}
                >
                  리스 · 달 {fmtMoney(leaseRent(state, m))}
                </ActButton>
              </div>
            </li>
          );
        })}
      </ul>
      {soon.length > 0 && (
        <p className="al-muted">
          <FleetIcon kind="calendar" size={14} /> 곧 나와요: {soon.map((m) => `${m.name} (${m.intro})`).join(' · ')}
        </p>
      )}
      <MoreInfo>화물기는 손님 대신 짐을 실어요. 짐 수요는 도시 경제·무역 도시·거리·시대로 정해지고 10~12월에 가장 많아요. 기름값이 오르면 짐이 조금 줄어요. 노선 화면 ‘등급별 운임’에서 화물 운임을 정해요.</MoreInfo>
    </div>
  );
}
