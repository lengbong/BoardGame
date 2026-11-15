import { useMemo, useState } from 'react';
import { CAMPAIGNS, CAMPAIGN_INFO, MEDIA, MEDIA_INFO, mediaOf } from './ads';
import { MODEL } from './aircraft';
import { BUSINESS_INFO } from './business';
import { MEAL_ICONS, MEAL_NAMES } from './cabin';
import { CITY, REGIONS, REGION_INFO } from './cities';
import { fmtMoney, signedMoney } from './format';
import { FuelCard } from './FuelCard';
import { CheckPolicy } from './ConditionArt';
import { FacilityCard } from './FacilityCard';
import { facilitiesWorth } from './facilities';
import { tankWorth } from './fuel';
import { GRADE_INFO, goalProgress } from './goals';
import { ADS_MAX, allianceOutlook, borrowBlocker, campaignBlocker, campaignCost, proposeBlocker, repayBlocker } from './rules';
import {
  MAINT_COST,
  MAINT_NAMES,
  MAINT_RISK,
  RESERVE_COST,
  RESERVE_NAMES,
  spareCover,
  businessValue,
  companyValue,
  computeQuarter,
  creditLimit,
  planeValue,
  reputationTarget,
} from './simulate';
import { AllianceLink, AssetBar, CostBars, FinIcon, LoanMeter, MoneyFlow, OutlookBars, ProgressRing, TargetBar, WrenchPips, type FinIconKind } from './FinanceArt';
import { MoreInfo } from './StaffArt';
import { mLabel, monthsText, qOfM, yearOf } from './time';
import type { AdMedia, AirlineAction, AirlineState, CompanyReport, Mod, ModKind, RegionId } from './types';
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
  { key: 'side', name: '부대사업 수입' },
];
const COSTS: { key: keyof CompanyReport; name: string; icon: FinIconKind }[] = [
  { key: 'fuel', name: '연료비', icon: 'fuel' },
  { key: 'staff', name: '직원 임금·초과 근무', icon: 'people' },
  { key: 'crew', name: '운항 수당·정비 부품', icon: 'wrench' },
  { key: 'airport', name: '공항 이용료·지상 조업', icon: 'tower' },
  { key: 'service', name: '기내 서비스', icon: 'meal' },
  { key: 'sales', name: '표 판매 수수료', icon: 'tag' },
  { key: 'lease', name: '리스료·보험', icon: 'doc' },
  { key: 'fleet', name: '쉬는 비행기', icon: 'parked' },
  { key: 'branch', name: '지점·시설 유지비', icon: 'building' },
  { key: 'ads', name: '광고비', icon: 'megaphone' },
  { key: 'interest', name: '대출 이자', icon: 'bank' },
  { key: 'disrupt', name: '지연·결항 보상', icon: 'delay' },
  { key: 'tax', name: '법인세 (이익의 20%)', icon: 'receipt' },
];

const MOD_ICON: Record<ModKind, FinIconKind> = {
  crew: 'wrench',
  fuelHedge: 'fuel',
  fuel: 'fuel',
  demand: 'people',
  service: 'meal',
  sales: 'tag',
  slot: 'tower',
  discount: 'tag',
  subsidy: 'coin',
};

const num = (r: CompanyReport | null | undefined, k: keyof CompanyReport) => (r ? (r[k] as number) : 0);

export function FinanceView({ state, viewer, canAct, perform }: FinanceViewProps) {
  const me = state.companies[viewer];
  const rep = state.report?.companies[viewer];
  // 지금 정해 둔 대로 이번 달을 날면 (운항 사건 없이, 사건·계절은 이번 달 그대로)
  const next = useMemo(() => (state.phase === 'manage' ? computeQuarter(state).reports[viewer] : null), [state, viewer]);
  const limit = creditLimit(state, viewer);
  const planesValue = me.planes.reduce((s, p) => s + planeValue(state, p), 0);
  const bizValue = me.businesses.reduce((s, b) => s + businessValue(b), 0);
  const fuelValue = (me.fuel ? tankWorth(me) : 0) + facilitiesWorth(me);
  const value = companyValue(state, viewer);
  const left = Math.max(0, limit - me.debt);
  const block = (b: string | null) => (canAct ? b : notMine);
  const amounts = [100, 500, 1000];
  const adsTotal = REGIONS.reduce((s, r) => s + me.ads[r], 0);
  const year = yearOf(state.q);
  const [campaignRegion, setCampaignRegion] = useState<RegionId>(CITY[me.hub].region);
  const campaignDone = me.lastCampaign !== undefined && qOfM(me.lastCampaign) === state.q;
  const activeCampaigns = me.mods.filter((m) => m.until > state.t && CAMPAIGNS.some((k) => m.label === `${CAMPAIGN_INFO[k].icon} ${CAMPAIGN_INFO[k].name}`));
  const target = reputationTarget(state, me);
  const avgMeal = me.planes.length > 0 ? me.planes.reduce((s, p) => s + p.meal, 0) / me.planes.length : me.service;
  const mixed = me.planes.some((p) => p.meal !== me.service);
  const deposits = me.planes.reduce((s, p) => s + p.deposit, 0);
  const ordered = me.orders.reduce((s, o) => s + o.price, 0);
  const mods = me.mods.filter((m) => m.until > state.t);
  // 손익 그림: 지난달 값(없으면 이번 달 어림)
  const base = rep ?? next;
  const inParts = INCOME.map((x) => ({ name: x.name, v: num(base, x.key) }));
  const inTotal = inParts.reduce((t, x) => t + x.v, 0);
  const profit = base ? base.profit : 0;
  const costRows = COSTS.map((x) => ({ key: x.key, name: x.name, icon: x.icon, v: num(base, x.key), est: next && rep ? num(next, x.key) : undefined, estOnly: !rep }))
    .filter((x) => Math.round(x.v) !== 0 || Math.round(x.est ?? 0) !== 0)
    .sort((a, b) => b.v - a.v);
  const shortCash = Math.max(0, -me.cash);
  const onTone = me.onTime >= 0.85 ? 'good' : me.onTime >= 0.7 ? 'warn' : 'bad';

  return (
    <div className="al-finance">
      <section className="al-card al-pnl">
        <h4 className="al-fin-title">
          <FinIcon kind="chart" /> 달 손익 <small>{rep ? '지난달' : next ? '이번 달 어림 (지난달 기록은 아직 없어요)' : '아직 기록이 없어요'}</small>
        </h4>
        {base ? (
          <>
            <ul className="al-staff-kpi al-fin-kpi">
              <li className="al-kpi-in">
                <FinIcon kind="ticket" size={26} />
                <span>
                  <small>들어온 돈</small>
                  <b>+{fmtMoney(inTotal)}</b>
                </span>
              </li>
              <li className="al-kpi-out">
                <FinIcon kind="receipt" size={26} />
                <span>
                  <small>나간 돈</small>
                  <b>−{fmtMoney(inTotal - profit)}</b>
                </span>
              </li>
              <li className={profit < 0 ? 'al-kpi-bad' : 'al-kpi-ok'}>
                <FinIcon kind={profit < 0 ? 'down' : 'chart'} size={26} />
                <span>
                  <small>달 이익</small>
                  <b className={profit < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(profit)}</b>
                  {rep && next && (
                    <small>
                      이번 달 어림 <span className="al-nowrap">{signedMoney(next.profit)}</span>
                    </small>
                  )}
                </span>
              </li>
            </ul>
            <MoneyFlow income={inParts} cost={inTotal - profit} />
            <ul className="al-hc-legend al-flow-legend">
              {inParts
                .filter((x) => x.v > 0)
                .map((x, i) => (
                  <li key={x.name}>
                    <i className={`al-sw al-sw-in-${i}`} /> {x.name} {fmtMoney(x.v)}
                  </li>
                ))}
              <li>
                <i className="al-sw al-sw-cost" /> 나간 돈
              </li>
              <li>
                <i className={profit >= 0 ? 'al-sw al-sw-profit' : 'al-sw al-sw-loss'} /> {profit >= 0 ? '이익' : '손해'}
              </li>
            </ul>
            <h5 className="al-fin-sub">
              나간 돈 항목 <small>큰 것부터{rep && next ? ' · │ 이번 달 어림' : ''}</small>
            </h5>
            <CostBars rows={costRows} />
            {rep && rep.autoLoan > 0 && (
              <p className="al-staff-state al-neg">
                <FinIcon kind="bank" size={16} /> 돈이 모자라 저절로 빌린 돈 {fmtMoney(rep.autoLoan)}
              </p>
            )}
          </>
        ) : (
          <p className="al-muted">첫 달이 지나면 손익이 보여요.</p>
        )}
        <MoreInfo label="표로 보기">
          <table className="al-table al-pnl-table">
            <thead>
              <tr>
                <th />
                <th>지난달{rep ? '' : ' (아직 없음)'}</th>
                {next && <th>이번 달 어림</th>}
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
                <th>달 이익</th>
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
          <p>‘이번 달 어림’은 지금 정해 둔 노선·운임·광고 그대로, 라이벌도 지금 그대로이고 지연·결항이 없을 때의 값이에요.</p>
        </MoreInfo>
      </section>

      <section className="al-card al-balance">
        <h4 className="al-fin-title">
          <FinIcon kind="wallet" /> 회사 가치
        </h4>
        <p className="al-hero-num">{fmtMoney(value)}</p>
        <AssetBar
          parts={[
            { name: '현금', v: Math.max(0, me.cash), slot: 1 },
            { name: '내 비행기', v: planesValue, slot: 2 },
            { name: '리스 보증금', v: deposits, slot: 3 },
            { name: '주문한 비행기', v: ordered, slot: 4 },
            { name: fuelValue > 0 ? '부대사업·그 밖의 자산' : '부대사업', v: bizValue + fuelValue, slot: 5 },
          ]}
          debt={me.debt + shortCash}
        />
        <ul className="al-hc-legend al-asset-legend">
          <li>
            <i className="al-sw al-cat-1" /> 현금 <b>{fmtMoney(me.cash)}</b>
          </li>
          <li>
            <i className="al-sw al-cat-2" /> 내 비행기 {me.planes.filter((p) => !p.leased).length}대 <b>{fmtMoney(planesValue)}</b>
          </li>
          {deposits > 0 && (
            <li title="리스기를 돌려줄 때 돌려받아요">
              <i className="al-sw al-cat-3" /> 리스 보증금 <b>{fmtMoney(deposits)}</b>
            </li>
          )}
          {ordered > 0 && (
            <li>
              <i className="al-sw al-cat-4" /> 주문한 비행기 {me.orders.length}대 <b>{fmtMoney(ordered)}</b>
            </li>
          )}
          {bizValue > 0 && (
            <li>
              <i className="al-sw al-cat-5" /> 부대사업 <b>{fmtMoney(bizValue)}</b>
            </li>
          )}
          {fuelValue > 0 && (
            <li title="사 둔 연료(산 값)와 탱크·공항 시설(지은 값의 60%)">
              <i className="al-sw al-cat-5" /> 연료·탱크·시설 <b>{fmtMoney(fuelValue)}</b>
            </li>
          )}
          <li>
            <i className="al-sw al-sw-debt" /> 빚 <b className={me.debt > 0 ? 'al-neg' : ''}>{me.debt > 0 ? `−${fmtMoney(me.debt)}` : '없음'}</b>
          </li>
        </ul>
        <h4 className="al-fin-title al-fin-gap">
          <FinIcon kind="bank" /> 은행 대출{' '}
          <small>
            금리 연 {state.rate.toFixed(1)}% · 남은 한도 {fmtMoney(left)}
          </small>
        </h4>
        <LoanMeter debt={me.debt} limit={limit} />
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
        <MoreInfo>한도는 내 비행기 가치의 절반 + 처음 믿어 주는 돈이에요. 한도의 80%를 넘게 빌리면 금리가 2%p 올라가요.</MoreInfo>
      </section>

      <section className="al-card al-alliance">
        <h4 className="al-fin-title">
          <FinIcon kind="rings" /> 제휴 <small>코드셰어</small>
        </h4>
        {me.partner !== null ? (
          <div className="al-partner">
            <AllianceLink left={<CoName c={me} bold />} right={<CoName c={state.companies[me.partner]} bold />} />
            <ul className="al-perks">
              <li>
                <FinIcon kind="plane" size={16} /> 서로의 노선을 이어 갈아타는 손님을 함께 태워요
              </li>
              <li>
                <FinIcon kind="people" size={16} /> 둘 다 지점이 있는 도시에서 손님 <b className="al-pos">+5%</b>
              </li>
            </ul>
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
                  <small className="al-muted al-outlook-text">
                    {c.partner === null && look !== null && <OutlookBars level={look === 'yes' ? 3 : look === 'maybe' ? 2 : 1} />}
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
        <MoreInfo>
          {me.partner !== null
            ? '공동 운항하면 서로의 노선을 이어 갈아타는 손님을 함께 태우고, 둘 다 지점이 있는 도시에서 손님이 5% 늘어요. '
            : ''}
          같은 도시에 지점이 많고 겹치는 노선이 적을수록 제휴를 반겨요. 석 달에 한 번 제안할 수 있어요.
        </MoreInfo>
        {mods.length > 0 && (
          <>
            <h5 className="al-fin-sub">지금 걸린 효과</h5>
            <ul className="al-mods">
              {mods.map((m) => (
                <li key={m.id}>
                  <FinIcon kind={MOD_ICON[m.kind]} size={22} className="al-mod-icon" />
                  <span className="al-mod-main">
                    <span>{m.label}</span>
                    <small className="al-muted">{modText(m)}</small>
                  </span>
                  <small className="al-mod-left" title={`${mLabel(m.until - 1)}까지`}>
                    <FinIcon kind="hourglass" size={14} /> {monthsText(Math.max(1, m.until - state.t))} 남음
                  </small>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="al-card al-goals">
        <h4 className="al-fin-title">
          <FinIcon kind="target" /> 올해 목표
        </h4>
        {me.goals.length === 0 ? (
          <p className="al-muted">새해가 되면 목표가 생겨요.</p>
        ) : (
          <ul className="al-goal-list">
            {me.goals.map((g) => {
              const v = goalProgress(state, viewer, g);
              return (
                <li key={g.kind}>
                  <ProgressRing
                    value={g.done === false ? v : g.done === true ? 1 : v}
                    tone={g.done === false ? 'bad' : v >= 1 || g.done === true ? 'good' : 'blue'}
                    mark={g.done === true || (g.done !== false && v >= 1) ? 'done' : g.done === false ? 'fail' : undefined}
                    label={`${g.text} ${Math.round(v * 100)}%`}
                  />
                  <span className="al-goal-main">
                    <span className="al-goal-text">{g.text}</span>
                    <span className="al-goal-reward">
                      <span>
                        <FinIcon kind="coin" size={14} /> {fmtMoney(g.reward.cash)}
                      </span>
                      <span>
                        <FinIcon kind="star" size={14} /> 평판 +{g.reward.rep}
                      </span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {me.reviews.length > 0 && (
          <>
            <h5 className="al-fin-sub">
              <FinIcon kind="trophy" size={16} /> 지난 경영 평가
            </h5>
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
        <h4 className="al-fin-title">
          <FinIcon kind="megaphone" /> 지역 광고 <small>달마다 {fmtMoney(adsTotal)}</small>
        </h4>
        <ul>
          {REGIONS.map((r) => (
            <li key={r}>
              <span className="al-ad-name">
                {REGION_INFO[r].emoji} {REGION_INFO[r].short}
              </span>
              <span className="al-ad-meter" title={`알려진 정도 ${Math.round(me.awareness[r] * 100)}%`}>
                <Meter value={me.awareness[r]} tone="accent" label={`${REGION_INFO[r].name}에서 알려진 정도`} />
                <small>{Math.round(me.awareness[r] * 100)}%</small>
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
              <select
                className="al-media"
                value={mediaOf(me, r)}
                disabled={!canAct}
                aria-label={`${REGION_INFO[r].name} 광고 매체`}
                title={MEDIA_INFO[mediaOf(me, r)].desc}
                onChange={(e) => perform({ type: 'setMedia', region: r, media: e.target.value as AdMedia })}
              >
                {MEDIA.filter((m) => year >= MEDIA_INFO[m].from || mediaOf(me, r) === m).map((m) => (
                  <option key={m} value={m}>
                    {MEDIA_INFO[m].icon} {MEDIA_INFO[m].name}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
        <p className="al-muted al-tip al-ad-head">
          <span>막대: 그 지역에서 우리 회사가 알려진 정도</span>
        </p>
        <MoreInfo label="광고·매체는 어떻게 달라요?">
          광고를 하면 그 지역에 닿는 노선에서 손님이 우리 회사를 더 골라요. 효과는 몇 달에 걸쳐 쌓이고, 멈추면 천천히 줄어요. 매체마다 닿는 손님이 달라요: 📰 신문은 사업 손님, 📖 여행 잡지는 관광 손님, 📻 라디오는 적은
          돈에 효과가 크지만 많이 써도 덜 늘고, 💻 인터넷(1998년부터)은 같은 돈에 효과가 커요.
        </MoreInfo>
        <h4 className="al-campaign-title">
          캠페인 <small>{campaignDone ? '이번 분기에는 이미 했어요' : '한 분기에 하나'}</small>
        </h4>
        <div className="al-campaigns">
          <label className="al-campaign-region">
            지역
            <select value={campaignRegion} onChange={(e) => setCampaignRegion(e.target.value as RegionId)} aria-label="캠페인 지역">
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {REGION_INFO[r].emoji} {REGION_INFO[r].short}
                </option>
              ))}
            </select>
          </label>
          {CAMPAIGNS.map((k) => {
            const info = CAMPAIGN_INFO[k];
            return (
              <ActButton
                key={k}
                small
                blocker={canAct ? campaignBlocker(state, viewer, k, campaignRegion) : '내 차례에만 할 수 있어요'}
                onClick={() => perform({ type: 'campaign', kind: k, region: info.region ? campaignRegion : undefined })}
                title={info.desc}
                testId={`al-campaign-${k}`}
              >
                {info.icon} {info.name}
                {info.region ? ` (${REGION_INFO[campaignRegion].short})` : ''} · {fmtMoney(campaignCost(state, k))}
              </ActButton>
            );
          })}
        </div>
        {activeCampaigns.length > 0 && (
          <ul className="al-mods al-campaign-live">
            {activeCampaigns.map((m) => (
              <li key={m.id}>
                <span className="al-mod-main">
                  <span>{m.label}</span>
                  <small className="al-muted">진행 중 · {mLabel(m.until - 1)}까지</small>
                </span>
                <small className="al-mod-left">
                  <FinIcon kind="hourglass" size={14} /> {monthsText(Math.max(1, m.until - state.t))} 남음
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="al-card al-ops-card">
        <h4 className="al-fin-title">
          <FinIcon kind="shield" /> 운항 관리
        </h4>
        <div className="al-ops-top">
          <ProgressRing value={me.onTime} tone={onTone} size={56} label={`정시 운항률 ${Math.round(me.onTime * 100)}%`} />
          <span>
            <small className="al-muted">정시 운항률 (최근 석 달)</small>
            <b className={onTone === 'bad' ? 'al-neg' : ''}>{Math.round(me.onTime * 100)}%</b>
          </span>
          <span>
            <small className="al-muted">지연·결항 위험</small>
            <b className={MAINT_RISK[me.maint] > 1 ? 'al-neg' : MAINT_RISK[me.maint] < 1 ? 'al-pos' : ''}>
              <FinIcon kind="delay" size={16} /> {riskText(MAINT_RISK[me.maint])}
            </b>
          </span>
        </div>
        <div className="al-service-row" role="radiogroup" aria-label="정비 수준">
          {[1, 2, 3, 4, 5].map((lv) => (
            <button
              key={lv}
              type="button"
              role="radio"
              aria-checked={me.maint === lv}
              className={`al-svc${me.maint === lv ? ' al-on' : ''}`}
              disabled={!canAct}
              onClick={() => perform({ type: 'setMaint', level: lv })}
              data-testid={`al-maint-${lv}`}
            >
              <WrenchPips level={lv} />
              <small>{MAINT_NAMES[lv]}</small>
              <small className="al-muted">정비비 {MAINT_COST[lv] >= 1 ? '+' : ''}{Math.round((MAINT_COST[lv] - 1) * 100)}%</small>
            </button>
          ))}
        </div>
        <div className="al-loan-row al-reserve-row">
          <span>
            <FinIcon kind="people" size={16} /> 예비 승무원
          </span>
          {[0, 1, 2].map((lv) => (
            <button key={lv} type="button" className={`al-chip${me.crewReserve === lv ? ' al-on' : ''}`} disabled={!canAct} onClick={() => perform({ type: 'setCrewReserve', level: lv })} aria-pressed={me.crewReserve === lv}>
              {RESERVE_NAMES[lv]} {lv > 0 ? `(승무원비 +${Math.round((RESERVE_COST[lv] - 1) * 100)}%)` : ''}
            </button>
          ))}
        </div>
        <div className="al-spare">
          <FinIcon kind="parked" size={20} />
          <span>
            예비기 <b>{me.planes.filter((p) => p.legs.length === 0).length}대</b> <small className="al-muted">쉬는 비행기가 기체 점검·결항 때 대신 날아요</small>
          </span>
          <Meter value={spareCover(me)} tone={spareCover(me) >= 1 ? 'good' : 'blue'} label={`예비기가 메우는 정도 ${Math.round(spareCover(me) * 100)}%`} />
          <small>{Math.round(spareCover(me) * 100)}%</small>
        </div>
        <CheckPolicy state={state} viewer={viewer} canAct={canAct} perform={perform} />
        <MoreInfo>정비를 꼼꼼히 하면 승무원·정비비가 늘지만 지연·결항·기체 점검이 줄고 기체 상태도 천천히 닳아요. 비행기가 낡을수록 더 중요해요. 예비 승무원은 아픈 사람·늦은 비행 때문에 생기는 지연을 줄여요.</MoreInfo>
      </section>

      <FuelCard state={state} viewer={viewer} canAct={canAct} perform={perform} next={next} />

      <FacilityCard state={state} viewer={viewer} canAct={canAct} perform={perform} />

      <section className="al-card al-service">
        <h4 className="al-fin-title">
          <FinIcon kind="meal" /> 기내식 기본값
        </h4>
        <div className="al-service-row" role="radiogroup" aria-label="기내식 기본값">
          {[1, 2, 3, 4, 5].map((lv) => (
            <button
              key={lv}
              type="button"
              role="radio"
              aria-checked={me.service === lv}
              className={`al-svc${me.service === lv ? ' al-on' : ''}`}
              title={`모든 비행기의 기내식을 '${MEAL_NAMES[lv]}'(으)로`}
              disabled={!canAct}
              onClick={() => perform({ type: 'setService', level: lv })}
            >
              <span aria-hidden="true">{MEAL_ICONS[lv]}</span>
              <b>{lv}</b>
              <small>{MEAL_NAMES[lv]}</small>
            </button>
          ))}
        </div>
        {mixed && (
          <p className="al-staff-state al-muted">
            <FinIcon kind="plane" size={16} /> 지금은 비행기마다 기내식이 달라요 (평균 {avgMeal.toFixed(1)}단계)
          </p>
        )}
        <div className="al-rep">
          <span className="al-rep-label">
            <FinIcon kind="star" size={16} /> 평판 <b>{Math.round(me.reputation)}</b>{' '}
            <small className="al-muted">
              {Math.abs(target - me.reputation) < 0.5 ? '그대로 머물러요' : `${target > me.reputation ? '▲' : '▼'} ${Math.round(target)}로 ${target > me.reputation ? '오르는' : '내리는'} 중`}
            </small>
          </span>
          <TargetBar value={me.reputation} target={target} label={`평판 ${Math.round(me.reputation)}, 향하는 곳 ${Math.round(target)}`} />
        </div>
        <MoreInfo>
          누르면 모든 비행기의 기내식이 한꺼번에 바뀌고, 새로 받는 비행기도 이 단계로 시작해요. 비행기마다 따로 정하려면 비행기 화면에서 🪑 좌석·기내식을 누르세요. 기내식이 좋을수록 손님 한 명당 돈이 더 들지만 평판이 올라
          손님이 우리를 더 골라요.
        </MoreInfo>
        {me.businesses.length > 0 && (
          <>
            <h5 className="al-fin-sub">
              <FinIcon kind="shop" size={16} /> 부대사업
            </h5>
            <ul className="al-biz-list">
              {me.businesses.map((b) => (
                <li key={`${b.city}-${b.kind}`}>
                  {BUSINESS_INFO[b.kind].icon} {BUSINESS_INFO[b.kind].name} · {CITY[b.city].name}
                  <ActButton
                    small
                    blocker={canAct ? null : notMine}
                    onClick={() => {
                      if (window.confirm(`${CITY[b.city].name} ${BUSINESS_INFO[b.kind].name}을(를) ${fmtMoney(b.cost * 0.7)}에 팔까요?`)) perform({ type: 'sellBusiness', city: b.city, kind: b.kind });
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

/** 지연·결항 위험 배수를 '보통'에 견준 글로 (1.3 → '보통보다 30% 많아요') */
function riskText(v: number): string {
  const d = Math.round((v - 1) * 100);
  return d === 0 ? '보통' : `보통보다 ${Math.abs(d)}% ${d > 0 ? '많아요' : '적어요'}`;
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
      return `${m.city ? `${CITY[m.city].name} 노선을 날면 ` : ''}달 ${fmtMoney(m.value)} 보조금`;
  }
}
