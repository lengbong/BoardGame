import { useMemo } from 'react';
import { CITY, REGIONS, REGION_INFO } from './cities';
import { fmtMoney, signedMoney } from './format';
import { ADS_MAX, borrowBlocker, repayBlocker } from './rules';
import {
  SERVICE_NAMES,
  businessValue,
  companyValue,
  computeQuarter,
  creditLimit,
  planeValue,
  reputationTarget,
} from './simulate';
import type { AirlineAction, AirlineState, CompanyReport } from './types';
import { ActButton, Meter, Stepper } from './ui';

interface FinanceViewProps {
  state: AirlineState;
  viewer: number;
  canAct: boolean;
  perform: (a: AirlineAction) => void;
}

const notMine = '내 차례에만 할 수 있어요';

const INCOME: { key: keyof CompanyReport; name: string }[] = [
  { key: 'ticket', name: '운임 수입' },
  { key: 'side', name: '호텔·여행사 수입' },
];
const COSTS: { key: keyof CompanyReport; name: string }[] = [
  { key: 'fuel', name: '연료비' },
  { key: 'crew', name: '승무원·정비비' },
  { key: 'airport', name: '공항 이용료·지상 조업' },
  { key: 'service', name: '기내 서비스' },
  { key: 'sales', name: '표 판매 수수료' },
  { key: 'lease', name: '리스료·보험' },
  { key: 'fleet', name: '쉬는 비행기' },
  { key: 'branch', name: '지점 유지비' },
  { key: 'ads', name: '광고비' },
  { key: 'interest', name: '대출 이자' },
  { key: 'tax', name: '법인세 (이익의 20%)' },
];

export function FinanceView({ state, viewer, canAct, perform }: FinanceViewProps) {
  const me = state.companies[viewer];
  const rep = state.report?.companies[viewer];
  // 지금 정해 둔 대로 이번 분기를 날면 (사건·계절은 이번 분기 그대로)
  const next = useMemo(() => (state.phase === 'manage' ? computeQuarter(state).reports[viewer] : null), [state, viewer]);
  const limit = creditLimit(state, viewer);
  const planesValue = me.planes.reduce((s, p) => s + planeValue(state, p), 0);
  const bizValue = me.businesses.reduce((s, b) => s + businessValue(b), 0);
  const value = companyValue(state, viewer);
  const left = Math.max(0, limit - me.debt);
  const block = (b: string | null) => (canAct ? b : notMine);
  const amounts = [100, 500, 1000];
  const adsTotal = REGIONS.reduce((s, r) => s + me.ads[r], 0);
  const target = reputationTarget(state, me);

  return (
    <div className="al-finance">
      <section className="al-card al-pnl">
        <h4>분기 손익</h4>
        <table className="al-table al-pnl-table">
          <thead>
            <tr>
              <th />
              <th>지난 분기{rep ? '' : ' (아직 없음)'}</th>
              {next && <th>이번 분기 어림</th>}
            </tr>
          </thead>
          <tbody>
            {INCOME.map((x) => (
              <tr key={x.key}>
                <th>{x.name}</th>
                <td className="al-pos">{rep ? `+${fmtMoney(rep[x.key] as number)}` : '—'}</td>
                {next && <td className="al-pos">+{fmtMoney(next[x.key] as number)}</td>}
              </tr>
            ))}
            {COSTS.filter((x) => Math.round((rep?.[x.key] as number) ?? 0) !== 0 || Math.round((next?.[x.key] as number) ?? 0) !== 0).map((x) => (
              <tr key={x.key}>
                <th>{x.name}</th>
                <td className="al-neg">{rep ? `−${fmtMoney(rep[x.key] as number)}` : '—'}</td>
                {next && <td className="al-neg">−{fmtMoney(next[x.key] as number)}</td>}
              </tr>
            ))}
            <tr className="al-total">
              <th>분기 이익</th>
              <td className={rep && rep.profit < 0 ? 'al-neg' : 'al-pos'}>{rep ? signedMoney(rep.profit) : '—'}</td>
              {next && <td className={next.profit < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(next.profit)}</td>}
            </tr>
            {rep && rep.autoLoan > 0 && (
              <tr>
                <th>돈이 모자라 저절로 빌린 돈</th>
                <td className="al-neg">{fmtMoney(rep.autoLoan)}</td>
                {next && <td />}
              </tr>
            )}
          </tbody>
        </table>
        <p className="al-muted al-tip">‘이번 분기 어림’은 지금 정해 둔 노선·운임·광고 그대로, 라이벌도 지금 그대로일 때의 값이에요.</p>
      </section>

      <section className="al-card al-balance">
        <h4>회사 가치 {fmtMoney(value)}</h4>
        <table className="al-table">
          <tbody>
            <tr>
              <th>현금</th>
              <td>{fmtMoney(me.cash)}</td>
            </tr>
            <tr>
              <th>내 비행기 가치 ({me.planes.filter((p) => !p.leased).length}대)</th>
              <td>{fmtMoney(planesValue)}</td>
            </tr>
            {bizValue > 0 && (
              <tr>
                <th>호텔·여행사 가치</th>
                <td>{fmtMoney(bizValue)}</td>
              </tr>
            )}
            <tr>
              <th>빚</th>
              <td className={me.debt > 0 ? 'al-neg' : ''}>{me.debt > 0 ? `−${fmtMoney(me.debt)}` : '없음'}</td>
            </tr>
          </tbody>
        </table>
        <h4>
          은행 대출 <small>금리 연 {state.rate.toFixed(1)}% · 한도 {fmtMoney(limit)} (남은 {fmtMoney(left)})</small>
        </h4>
        <Meter value={limit > 0 ? me.debt / limit : 0} tone={me.debt > limit * 0.8 ? 'bad' : 'blue'} label="대출 한도 사용" />
        <div className="al-loan-row">
          <span>빌리기</span>
          {amounts.map((a) => (
            <ActButton key={a} small blocker={block(borrowBlocker(state, viewer, a))} onClick={() => perform({ type: 'borrow', amount: a })}>
              {fmtMoney(a)}
            </ActButton>
          ))}
          <ActButton small blocker={block(left >= 1 ? null : '대출 한도를 다 썼어요')} onClick={() => perform({ type: 'borrow', amount: Math.floor(left) })}>
            최대
          </ActButton>
        </div>
        <div className="al-loan-row">
          <span>갚기</span>
          {me.debt <= 0 && <span className="al-muted al-noloan">갚을 빚이 없어요</span>}
          {me.debt > 0 && amounts.map((a) => (
            <ActButton key={a} small blocker={block(repayBlocker(state, viewer, Math.min(a, me.debt)))} onClick={() => perform({ type: 'repay', amount: Math.min(a, me.debt) })}>
              {fmtMoney(a)}
            </ActButton>
          ))}
          {me.debt > 0 && (
            <ActButton small blocker={block(repayBlocker(state, viewer, Math.min(me.debt, me.cash)))} onClick={() => perform({ type: 'repay', amount: Math.min(me.debt, Math.floor(me.cash)) })}>
              모두
            </ActButton>
          )}
        </div>
        <p className="al-muted al-tip">한도는 내 비행기 가치의 절반 + 처음 믿어 주는 돈이에요. 한도의 80%를 넘게 빌리면 금리가 2%p 올라가요.</p>
      </section>

      <section className="al-card al-ads">
        <h4>
          지역 광고 <small>분기마다 {fmtMoney(adsTotal)}</small>
        </h4>
        <ul>
          {REGIONS.map((r) => (
            <li key={r}>
              <span className="al-ad-name">
                {REGION_INFO[r].emoji} {REGION_INFO[r].short}
              </span>
              <span className="al-ad-meter" title={`알려진 정도 ${Math.round(me.awareness[r] * 100)}%`}>
                <Meter value={me.awareness[r]} tone="accent" label={`${REGION_INFO[r].name}에서 알려진 정도`} />
              </span>
              <Stepper
                value={me.ads[r]}
                min={0}
                max={ADS_MAX}
                step={me.ads[r] >= 50 ? 10 : 5}
                disabled={!canAct}
                label={`${REGION_INFO[r].name} 광고비`}
                format={(v) => (v === 0 ? '0' : fmtMoney(v))}
                onChange={(v) => perform({ type: 'setAds', region: r, amount: v })}
              />
            </li>
          ))}
        </ul>
        <p className="al-muted al-tip">광고를 하면 그 지역에 닿는 노선에서 손님이 우리 회사를 더 골라요. 효과는 몇 분기에 걸쳐 쌓이고, 멈추면 천천히 줄어요.</p>
      </section>

      <section className="al-card al-service">
        <h4>
          기내 서비스 <small>평판 {Math.round(me.reputation)} → {Math.round(target)}</small>
        </h4>
        <div className="al-service-row" role="radiogroup" aria-label="기내 서비스">
          {[1, 2, 3, 4, 5].map((lv) => (
            <button
              key={lv}
              type="button"
              role="radio"
              aria-checked={me.service === lv}
              className={`al-svc${me.service === lv ? ' al-on' : ''}`}
              disabled={!canAct}
              onClick={() => perform({ type: 'setService', level: lv })}
            >
              <span aria-hidden="true">{'🍽️'.repeat(1)}{lv >= 4 ? '✨' : ''}</span>
              <b>{lv}</b>
              <small>{SERVICE_NAMES[lv]}</small>
            </button>
          ))}
        </div>
        <Meter value={me.reputation / 100} tone="good" label="평판" />
        <p className="al-muted al-tip">서비스가 좋으면 손님 한 명당 돈이 더 들지만 평판이 올라 손님이 우리를 더 골라요. 새 비행기도 평판을 올려 줘요.</p>
        {me.businesses.length > 0 && (
          <>
            <h4>호텔·여행사</h4>
            <ul className="al-biz-list">
              {me.businesses.map((b) => (
                <li key={`${b.city}-${b.kind}`}>
                  {b.kind === 'hotel' ? '🏨 호텔' : '🧳 여행사'} · {CITY[b.city].name}
                  <ActButton
                    small
                    blocker={canAct ? null : notMine}
                    onClick={() => {
                      if (window.confirm(`${CITY[b.city].name} ${b.kind === 'hotel' ? '호텔' : '여행사'}을 ${fmtMoney(b.cost * 0.7)}에 팔까요?`)) perform({ type: 'sellBusiness', city: b.city, kind: b.kind });
                    }}
                  >
                    팔기 +{fmtMoney(b.cost * 0.7)}
                  </ActButton>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
