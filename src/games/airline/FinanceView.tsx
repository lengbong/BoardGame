import { useMemo } from 'react';
import { MODEL } from './aircraft';
import { CITY, REGIONS, REGION_INFO } from './cities';
import { fmtMoney, signedMoney } from './format';
import { GRADE_INFO, goalProgress } from './goals';
import { ADS_MAX, allianceOutlook, borrowBlocker, proposeBlocker, repayBlocker } from './rules';
import {
  SERVICE_NAMES,
  businessValue,
  companyValue,
  computeQuarter,
  creditLimit,
  planeValue,
  reputationTarget,
} from './simulate';
import { qLabel } from './time';
import type { AirlineAction, AirlineState, CompanyReport, Mod } from './types';
import { ActButton, CoName, Meter, Stepper } from './ui';

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
  const deposits = me.planes.reduce((s, p) => s + p.deposit, 0);
  const ordered = me.orders.reduce((s, o) => s + o.price, 0);
  const mods = me.mods.filter((m) => m.until > state.q);

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
            {deposits > 0 && (
              <tr>
                <th title="리스기를 돌려줄 때 돌려받아요">리스 보증금 (돌려받을 돈)</th>
                <td>{fmtMoney(deposits)}</td>
              </tr>
            )}
            {ordered > 0 && (
              <tr>
                <th>주문한 비행기 ({me.orders.length}대, 낸 값)</th>
                <td>{fmtMoney(ordered)}</td>
              </tr>
            )}
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

      <section className="al-card al-alliance">
        <h4>🤝 제휴 (코드셰어)</h4>
        {me.partner !== null ? (
          <div className="al-partner">
            <p>
              <CoName c={state.companies[me.partner]} bold />와 공동 운항 중이에요. 서로의 노선을 이어 갈아타는 손님을 함께 태우고, 둘 다 지점이 있는 도시에서 손님이 5% 늘어요.
            </p>
            <ActButton
              small
              blocker={canAct ? null : notMine}
              onClick={() => {
                if (window.confirm('제휴를 끝낼까요?')) perform({ type: 'endAlliance' });
              }}
            >
              제휴 끝내기
            </ActButton>
          </div>
        ) : state.companies.length < 2 ? (
          <p className="al-muted">함께할 회사가 없어요.</p>
        ) : (
          <ul className="al-alliance-list">
            {state.companies.map((c, i) => {
              if (i === viewer || c.out) return null;
              const look = c.kind === 'human' ? null : allianceOutlook(state, viewer, i);
              const why = canAct ? proposeBlocker(state, viewer, i) : notMine;
              return (
                <li key={i}>
                  <CoName c={c} />
                  <small className="al-muted">
                    {c.partner !== null ? '다른 회사와 제휴 중' : c.kind === 'human' ? '사람이 정해요' : look === 'yes' ? '받아들일 것 같아요' : look === 'maybe' ? '반반이에요' : '거절할 것 같아요'}
                  </small>
                  <ActButton small blocker={why} onClick={() => perform({ type: 'propose', to: i })}>
                    제휴 제안
                  </ActButton>
                </li>
              );
            })}
          </ul>
        )}
        <p className="al-muted al-tip">같은 도시에 지점이 많고 겹치는 노선이 적을수록 제휴를 반겨요. 한 분기에 한 번 제안할 수 있어요.</p>
        {mods.length > 0 && (
          <>
            <h4>지금 걸린 효과</h4>
            <ul className="al-mods">
              {mods.map((m) => (
                <li key={m.id}>
                  <span>{m.label}</span>
                  <small className="al-muted">
                    {modText(m)} · {qLabel(m.until - 1)}까지
                  </small>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="al-card al-goals">
        <h4>🎯 올해 목표</h4>
        {me.goals.length === 0 ? (
          <p className="al-muted">새해가 되면 목표가 생겨요.</p>
        ) : (
          <ul className="al-goal-list">
            {me.goals.map((g) => {
              const v = goalProgress(state, viewer, g);
              return (
                <li key={g.kind}>
                  <span className="al-goal-text">
                    {g.done === true ? '✅' : g.done === false ? '❌' : v >= 1 ? '✅' : '🎯'} {g.text}
                  </span>
                  <Meter value={v} tone={v >= 1 ? 'good' : 'blue'} label={`${g.text} ${Math.round(v * 100)}%`} />
                  <small className="al-muted">
                    상: {fmtMoney(g.reward.cash)} · 평판 +{g.reward.rep}
                  </small>
                </li>
              );
            })}
          </ul>
        )}
        {me.reviews.length > 0 && (
          <>
            <h4>지난 경영 평가</h4>
            <ol className="al-grades">
              {me.reviews.slice(-8).map((r) => (
                <li key={r.year} title={r.text}>
                  <span className="al-grade" style={{ background: GRADE_INFO[r.grade].color }}>
                    {r.grade}
                  </span>
                  <small>{r.year}</small>
                </li>
              ))}
            </ol>
            <p className="al-muted">{me.reviews[me.reviews.length - 1].text}</p>
          </>
        )}
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

/** 회사 효과를 짧은 글로 */
function modText(m: Mod): string {
  const p = (v: number) => `${v > 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 100)}%`;
  switch (m.kind) {
    case 'crew':
      return `승무원·정비비 ${p(m.value)}`;
    case 'fuel':
      return `연료비 ${p(m.value)}`;
    case 'fuelHedge':
      return `유가 ${m.value.toFixed(2)}로 고정`;
    case 'demand':
      return `${m.city ? `${CITY[m.city].name} ` : m.region ? `${REGION_INFO[m.region].short} ` : ''}${m.seg === 'biz' ? '사업 ' : m.seg === 'leisure' ? '관광 ' : ''}손님 ${p(m.value)}`;
    case 'service':
      return `서비스 비용 ${p(m.value)}`;
    case 'sales':
      return `판매 수수료 ${p(m.value)}`;
    case 'slot':
      return `${m.city ? `${CITY[m.city].name} ` : ''}슬롯 ${p(m.value)}`;
    case 'discount':
      return `${m.model ? `${MODEL[m.model]?.name ?? ''} ` : ''}주문 값 ${p(m.value)}`;
    case 'subsidy':
      return `${m.city ? `${CITY[m.city].name} 노선을 날면 ` : ''}분기 ${fmtMoney(m.value)} 보조금`;
  }
}
