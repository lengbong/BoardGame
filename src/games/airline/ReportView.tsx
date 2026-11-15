import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import './report.css';
import { coColors, realOf } from './brand';
import { SEAT_SHAPES } from './Art';
import { WEATHER_INFO, weather } from './calendar';
import { LineChart, Legend, MonthBars, ProfitBars, ShareBars, SparkBars, Sparkline, stepFixed, type Series, type ShareRow } from './Charts';
import { CITY, REGIONS, REGION_INFO } from './cities';
import { FIXED_ICON } from './events';
import { axisMoney, fmtMoney, fmtPax, pct, signedMoney } from './format';
import { GRADE_INFO } from './goals';
import { rankings } from './rules';
import { companyValue, pairDemand, regionsServed } from './simulate';
import { staffTotal } from './staff';
import { mLabel, mOf, mShort, monthOf, qLabel, qShort, quarterOf, yearOf, yearOfM } from './time';
import type { AirlineState, CompanyReport, MonthPoint, NewsItem } from './types';
import { AirlinePhoto } from './AirlinePicker';
import { FinIcon, ProgressRing, type RingTone } from './FinanceArt';
import { BarCell, CauseIcon, DivergeCell, GroupedBars, NEWS_KINDS, NewsKindIcon, RIcon, RankMedal, RegionDots, StackCell, ToneBadge, newsKind, type BarTone, type NewsKind } from './ReportArt';
import { MoreInfo, StaffIcon } from './StaffArt';
import { CoName } from './ui';

type View = 'month' | 'quarter' | 'year' | 'ops';

const VIEWS: { id: View; label: string; icon: ReactNode }[] = [
  { id: 'month', label: '달마다', icon: <StaffIcon kind="calendar" size={18} /> },
  { id: 'quarter', label: '분기', icon: <FinIcon kind="chart" size={18} /> },
  { id: 'year', label: '해마다', icon: <RIcon kind="bars" size={18} /> },
  { id: 'ops', label: '운항 상황판', icon: <FinIcon kind="tower" size={18} /> },
];

/** 탑승률 고리 색: 낮으면 빨강, 알맞으면 초록, 꽉 차면 주황 (LoadMeter와 같은 기준) */
const lfTone = (lf: number): RingTone => (lf < 0.55 ? 'bad' : lf > 0.97 ? 'warn' : 'good');
const onTimeTone = (v: number): BarTone => (v >= 0.85 ? 'good' : v >= 0.7 ? 'warn' : 'bad');

/** '표로 보기 / 그래프로 보기' 단추 (아이콘 + 글) */
function ViewToggle({ table, onToggle }: { table: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="btn btn-small al-rep-toggle" onClick={onToggle} aria-pressed={table}>
      {table ? <FinIcon kind="chart" size={15} /> : <RIcon kind="table" size={15} />} {table ? '그래프로 보기' : '표로 보기'}
    </button>
  );
}

export function ReportView({ state, viewer }: { state: AirlineState; viewer: number }) {
  const [view, setView] = useState<View>('month');
  return (
    <div className="al-report">
      <div className="al-subtabs al-rep-tabs" role="tablist" aria-label="보고서 보기">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" role="tab" aria-selected={view === v.id} className={`al-subtab${view === v.id ? ' al-on' : ''}`} onClick={() => setView(v.id)} data-testid={`al-report-${v.id}`}>
            {v.icon} {v.label}
          </button>
        ))}
      </div>
      {view === 'month' && <MonthView state={state} viewer={viewer} />}
      {view === 'quarter' && <QuarterView state={state} viewer={viewer} />}
      {view === 'year' && <YearView state={state} viewer={viewer} />}
      {view === 'ops' && <OpsView state={state} viewer={viewer} />}
    </div>
  );
}

const costOf = (r: CompanyReport) => r.fuel + r.crew + r.airport + r.service + r.sales + r.lease + r.fleet + r.branch + r.ads + r.interest + r.disrupt + r.staff + r.tax;

/** 달 기록에서 회사마다 선 (운항을 멈춘 회사는 멈춘 뒤로 비운다) */
function monthSeries(state: AirlineState, pick: (p: MonthPoint, i: number) => number): Series[] {
  return state.companies.map((c, i) => ({
    name: c.name,
    color: coColors(c).main,
    shape: SEAT_SHAPES[c.seat],
    values: state.months.map((p) => (c.out && p.value[i] === 0 ? null : pick(p, i))),
  }));
}

function monthTicks(state: AirlineState) {
  const n = state.months.length;
  const every = n > 180 ? 5 : n > 72 ? 2 : 1;
  return (i: number) => {
    const t = state.months[i].t + 1;
    if (monthOf(t) !== 1) return null;
    const y = yearOfM(t);
    return (y - yearOfM(state.months[0].t + 1)) % every === 0 ? `${y}` : null;
  };
}

function MonthView({ state, viewer }: { state: AirlineState; viewer: number }) {
  const [table, setTable] = useState(false);
  const me = state.companies[viewer];
  const ledger = state.ledger.slice(-24);
  const labels = state.months.map((p, k) => (k === 0 ? '시작' : mLabel(p.t)));
  const tickAt = monthTicks(state);
  const valueSeries = monthSeries(state, (p, i) => p.value[i]);
  const onTimeSeries = monthSeries(state, (p, i) => Math.round(p.onTime[i] * 1000) / 10);
  const legend = valueSeries.map((s) => ({ name: s.name, color: s.color, shape: s.shape }));
  const oil: Series[] = [{ name: '유가 지수', color: 'var(--al-gain)', shape: 'circle', values: state.months.map((p) => p.oil) }];
  const staffSeries = monthSeries(state, (p, i) => p.staff?.[i] ?? 0);
  const routes = [...me.routes].sort((a, b) => (b.stats?.profit ?? -1e9) - (a.stats?.profit ?? -1e9));
  const [pick, setPick] = useState<number | null>(routes[0]?.id ?? null);
  const route = me.routes.find((r) => r.id === pick) ?? routes[0];
  const year = yearOfM(state.t);
  const profile = route ? Array.from({ length: 12 }, (_, m) => { const d = pairDemand(state, route.a, route.b, mOf(year, m + 1)); return d.biz + d.leisure; }) : [];
  return (
    <>
      <section className="al-card al-chart-card">
        <div className="al-card-head">
          <h4>
            {me.name} 달마다 이익 <small>최근 {ledger.length}달</small>
          </h4>
          <ViewToggle table={table} onToggle={() => setTable(!table)} />
        </div>
        {ledger.length === 0 ? (
          <p className="al-muted al-empty-main">첫 달이 끝나면 그래프가 그려져요.</p>
        ) : table ? (
          <div className="al-table-wrap">
            <table className="al-table">
              <thead>
                <tr>
                  <th>달</th>
                  <th>수입</th>
                  <th>비용</th>
                  <th>이익</th>
                  <th>손님</th>
                  <th>탑승률</th>
                  <th>정시율</th>
                  <th>결항</th>
                </tr>
              </thead>
              <tbody>
                {[...ledger].reverse().map((l) => {
                  const r = l.companies[viewer];
                  return (
                    <tr key={l.t}>
                      <th>{mLabel(l.t)}</th>
                      <td>{fmtMoney(r.ticket + r.side)}</td>
                      <td>{fmtMoney(costOf(r))}</td>
                      <td className={r.profit < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(r.profit)}</td>
                      <td>{fmtPax(r.pax)}</td>
                      <td>{pct(r.seats > 0 ? r.pax / r.seats : 0)}</td>
                      <td>{r.flights > 0 ? pct(r.onTime) : '—'}</td>
                      <td>{r.cancelled}편</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <ProfitBars
            data={ledger.map((l) => {
              const r = l.companies[viewer];
              return { label: mShort(l.t), value: r.profit, detail: [`수입 ${fmtMoney(r.ticket + r.side)}`, `비용 ${fmtMoney(costOf(r))}`, `손님 ${fmtPax(r.pax)}`, `정시율 ${r.flights > 0 ? pct(r.onTime) : '—'}`] };
            })}
            format={signedMoney}
            axisFormat={axisMoney}
            ariaLabel={`${me.name}의 최근 달마다 이익 막대 그래프. 흑자는 위, 적자는 아래`}
            tickEvery={ledger.length > 12 ? 3 : 1}
          />
        )}
      </section>

      <div className="al-report-grid">
        <section className="al-card al-chart-card">
          <div className="al-card-head">
            <h4>회사 가치 (달마다)</h4>
            {legend.length > 1 && <Legend series={legend} />}
          </div>
          {state.months.length < 2 ? <p className="al-muted">첫 달이 끝나면 그려져요.</p> : <LineChart series={valueSeries} labels={labels} tickAt={tickAt} format={fmtMoney} axisFormat={axisMoney} height={200} ariaLabel="회사마다 가치가 달마다 어떻게 변했는지" />}
        </section>
        <section className="al-card al-chart-card">
          <div className="al-card-head">
            <h4>정시 운항률 (%)</h4>
            {legend.length > 1 && <Legend series={legend} />}
          </div>
          {state.months.length < 2 ? <p className="al-muted">첫 달이 끝나면 그려져요.</p> : <LineChart series={onTimeSeries} labels={labels} tickAt={tickAt} format={(v) => `${v.toFixed(1)}%`} axisFormat={stepFixed} height={200} zero={false} maxY={100} minSpan={4} ariaLabel="회사마다 정시 운항률이 달마다 어떻게 변했는지" />}
        </section>
      </div>

      <div className="al-report-grid">
        <section className="al-card al-chart-card">
          <h4>
            유가 지수 <small>1이 보통 · 지금 {state.oil.toFixed(2)}</small>
          </h4>
          {state.months.length < 2 ? <p className="al-muted">첫 달이 끝나면 그려져요.</p> : <LineChart series={oil} labels={labels} tickAt={tickAt} format={(v) => v.toFixed(2)} axisFormat={stepFixed} height={170} zero={false} minSpan={0.2} ariaLabel="유가 지수가 달마다 어떻게 변했는지" />}
        </section>
        <section className="al-card al-chart-card">
          <div className="al-card-head">
            <h4>
              달마다 손님 (계절) <small>{year}년 · 한 방향 주간 잠재 손님</small>
            </h4>
            {routes.length > 0 && (
              <select className="al-select" value={route?.id ?? ''} onChange={(e) => setPick(Number(e.target.value))} aria-label="노선 고르기">
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {CITY[r.a].name}–{CITY[r.b].name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {route ? (
            <MonthBars values={profile} current={monthOf(state.t) - 1} format={fmtPax} ariaLabel={`${CITY[route.a].name}–${CITY[route.b].name} 노선의 달마다 잠재 손님`} />
          ) : (
            <p className="al-muted">노선을 열면 달마다 손님이 어떻게 바뀌는지 보여 줘요.</p>
          )}
        </section>
      </div>

      <section className="al-card al-chart-card">
        <div className="al-card-head">
          <h4>
            직원 수 (달마다) <small>조종사·객실 승무원·정비사·지상직 합 · 우리 {staffTotal(me).toLocaleString('ko-KR')}명</small>
          </h4>
          {legend.length > 1 && <Legend series={legend} />}
        </div>
        {state.months.length < 2 ? <p className="al-muted">첫 달이 끝나면 그려져요.</p> : <LineChart series={staffSeries} labels={labels} tickAt={tickAt} format={(v) => `${Math.round(v).toLocaleString('ko-KR')}명`} axisFormat={(v) => Math.round(v).toLocaleString('ko-KR')} height={170} ariaLabel="회사마다 직원 수가 달마다 어떻게 변했는지" />}
      </section>

      <section className="al-card">
        <h4 className="al-fin-title">
          <FinIcon kind="plane" /> 노선마다 최근 열두 달 <small>{me.routes.length}개 · 이익 큰 순</small>
        </h4>
        {routes.length === 0 ? (
          <p className="al-muted">아직 노선이 없어요.</p>
        ) : (
          <ul className="al-rm-list">
            <li className="al-rm-head" aria-hidden="true">
              <span>노선</span>
              <span>
                <FinIcon kind="people" size={14} /> 탑승률
              </span>
              <span>
                <FinIcon kind="coin" size={14} /> 이익 흐름
              </span>
              <span>지난달 이익</span>
              <span>
                <StaffIcon kind="clock" size={14} /> 정시율
              </span>
              <span>
                <StaffIcon kind="cancel" size={14} /> 결항률
              </span>
            </li>
            {routes.map((r) => {
              const hist = r.stats?.hist ?? [];
              const name = `${CITY[r.a].name}–${CITY[r.b].name}`;
              const st = r.stats;
              return (
                <li key={r.id} className="al-rm-row">
                  <b className="al-rm-name">{name}</b>
                  <span className="al-rm-lf">
                    {st ? <ProgressRing value={st.lf} tone={lfTone(st.lf)} size={40} label={`${name} 탑승률 ${pct(st.lf)}`} /> : <span className="al-muted">—</span>}
                    <Sparkline values={hist.map((x) => x[0])} label={`${name} 최근 탑승률`} />
                  </span>
                  <span className="al-rm-spark">
                    <SparkBars values={hist.map((x) => x[1])} label={`${name} 최근 이익`} />
                  </span>
                  <b className={`al-rm-profit ${st && st.profit < 0 ? 'al-neg' : 'al-pos'}`}>{st ? signedMoney(st.profit) : '—'}</b>
                  <span className="al-rm-ontime">
                    {st ? (
                      <>
                        <small className="al-rm-mlabel">정시</small>
                        <BarCell frac={st.onTime} tone={onTimeTone(st.onTime)} label={`${name} 정시율 ${pct(st.onTime)}`} />
                        <small>{pct(st.onTime)}</small>
                      </>
                    ) : (
                      <span className="al-muted">—</span>
                    )}
                  </span>
                  <span className={`al-rm-cancel${st && st.cancel >= 0.05 ? ' al-neg' : ''}`}>
                    {st && st.cancel >= 0.05 && <StaffIcon kind="alert" size={14} />}
                    <small className="al-rm-mlabel">결항</small> {st ? pct(st.cancel) : '—'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function YearView({ state, viewer }: { state: AirlineState; viewer: number }) {
  const years = state.years;
  const me = state.companies[viewer];
  const acc = me.acc;
  const hasNow = acc.quarters > 0 || acc.revenue > 0;
  // 해마다 줄 (지금 해 먼저)
  type YRow = { key: string; label: string; now: boolean; revenue: number; cost: number; profit: number; pax: number; lf: number; onTime: number | null; grade?: { g: string; color: string; text: string } };
  const rows: YRow[] = [];
  if (hasNow) rows.push({ key: 'now', label: `${acc.year}년`, now: true, revenue: acc.revenue, cost: acc.revenue - acc.profit, profit: acc.profit, pax: acc.pax, lf: acc.seats > 0 ? acc.pax / acc.seats : 0, onTime: me.onTime });
  for (const y of [...years].reverse()) {
    const r = y.companies[viewer];
    if (!r) continue;
    const review = me.reviews.find((x) => x.year === y.year);
    rows.push({
      key: `${y.year}`,
      label: `${y.year}년`,
      now: false,
      revenue: r.ticket + r.side,
      cost: costOf(r),
      profit: r.profit,
      pax: r.pax,
      lf: r.seats > 0 ? r.pax / r.seats : 0,
      onTime: r.flights > 0 ? r.onTime : null,
      grade: review ? { g: review.grade, color: GRADE_INFO[review.grade].color, text: review.text } : undefined,
    });
  }
  const maxMoney = Math.max(1, ...rows.map((r) => Math.max(r.revenue, r.cost)));
  const bars = [...rows].reverse().map((r) => ({
    label: r.now ? `${r.label.replace('년', '')}~` : r.label.replace('년', ''),
    value: r.profit,
    detail: [r.now ? '지금까지' : '한 해', `수입 ${fmtMoney(r.revenue)}`, `비용 ${fmtMoney(r.cost)}`, `손님 ${fmtPax(r.pax)}`, `탑승률 ${pct(r.lf)}`],
  }));
  const coLegend = state.companies.map((c) => ({ name: c.name, color: coColors(c).main, shape: SEAT_SHAPES[c.seat] }));
  return (
    <>
      <section className="al-card">
        <h4 className="al-fin-title">
          <RIcon kind="bars" /> {me.name} 해마다 결산
        </h4>
        {rows.length === 0 ? (
          <p className="al-muted">첫해가 끝나면(12월) 한 해 결산이 나와요.</p>
        ) : (
          <>
            {bars.length > 1 && (
              <ProfitBars data={bars} format={signedMoney} axisFormat={axisMoney} height={170} ariaLabel={`${me.name}의 해마다 이익 막대 그래프. 흑자는 위, 적자는 아래`} tickEvery={bars.length > 14 ? 2 : 1} />
            )}
            <ul className="al-yr-list">
              {rows.map((r) => (
                <li key={r.key} className={`al-yr-row${r.now ? ' al-yr-now' : ''}`}>
                  <span className="al-yr-year">
                    <b>{r.label}</b>
                    {r.now ? (
                      <small className="al-flag al-flag-blue">지금까지</small>
                    ) : r.grade ? (
                      <span className="al-grade al-grade-small" style={{ background: r.grade.color }} title={r.grade.text}>
                        {r.grade.g}
                      </span>
                    ) : null}
                  </span>
                  <span className="al-yr-money">
                    <span className="al-yr-bar">
                      <small>수입</small>
                      <BarCell frac={r.revenue / maxMoney} tone="gain" label={`${r.label} 수입 ${fmtMoney(r.revenue)}`} height={8} />
                      <small className="al-yr-num">{fmtMoney(r.revenue)}</small>
                    </span>
                    <span className="al-yr-bar">
                      <small>비용</small>
                      <BarCell frac={r.cost / maxMoney} tone="loss" label={`${r.label} 비용 ${fmtMoney(r.cost)}`} height={8} />
                      <small className="al-yr-num">{fmtMoney(r.cost)}</small>
                    </span>
                  </span>
                  <span className="al-yr-profit">
                    <small>이익</small>
                    <b className={r.profit < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(r.profit)}</b>
                  </span>
                  <span className="al-yr-pax">
                    <FinIcon kind="people" size={16} />
                    <span>
                      <small>손님</small>
                      <b>{fmtPax(r.pax)}</b>
                    </span>
                  </span>
                  <span className="al-yr-rings">
                    <ProgressRing value={r.lf} tone={lfTone(r.lf)} size={42} label={`${r.label} 탑승률 ${pct(r.lf)}`} />
                    <small>탑승률</small>
                    {r.onTime !== null && (
                      <>
                        <ProgressRing value={r.onTime} tone={onTimeTone(r.onTime) === 'bad' ? 'bad' : onTimeTone(r.onTime) === 'warn' ? 'warn' : 'good'} size={42} label={`${r.label} 정시율 ${pct(r.onTime)}`} />
                        <small>정시율</small>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <MoreInfo label="표로 보기">
              <div className="al-table-wrap">
                <table className="al-table">
                  <thead>
                    <tr>
                      <th>해</th>
                      <th>수입</th>
                      <th>비용</th>
                      <th>이익</th>
                      <th>손님</th>
                      <th>탑승률</th>
                      <th>정시율</th>
                      <th>평가</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.key} className={r.now ? 'al-row-mine' : ''}>
                        <th>{r.now ? `${r.label} (지금까지)` : r.label}</th>
                        <td>{fmtMoney(r.revenue)}</td>
                        <td>{fmtMoney(r.cost)}</td>
                        <td className={r.profit < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(r.profit)}</td>
                        <td>{fmtPax(r.pax)}</td>
                        <td>{pct(r.lf)}</td>
                        <td>{r.onTime !== null ? pct(r.onTime) : '—'}</td>
                        <td>{r.grade ? r.grade.g : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </MoreInfo>
          </>
        )}
      </section>
      {years.length > 0 && (
        <section className="al-card al-chart-card">
          <div className="al-card-head">
            <h4 className="al-fin-title">
              <FinIcon kind="trophy" /> 항공사마다 한 해 이익
            </h4>
            {coLegend.length > 1 && <Legend series={coLegend} />}
          </div>
          <GroupedBars
            groups={years.map((y) => ({ label: `${y.year}`, values: state.companies.map((_, i) => (y.companies[i] ? y.companies[i]!.profit : null)) }))}
            colors={coLegend.map((c) => c.color)}
            names={coLegend.map((c) => c.name)}
            format={signedMoney}
            axisFormat={axisMoney}
            ariaLabel="항공사마다 한 해 이익을 해마다 견준 막대 그래프"
          />
          <MoreInfo label="표로 보기">
            <div className="al-table-wrap">
              <table className="al-table">
                <thead>
                  <tr>
                    <th>해</th>
                    {state.companies.map((c, i) => (
                      <th key={i}>
                        <CoName c={c} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...years].reverse().map((y) => (
                    <tr key={y.year}>
                      <th>{y.year}년</th>
                      {state.companies.map((_, i) => {
                        const r = y.companies[i];
                        return (
                          <td key={i} className={r && r.profit < 0 ? 'al-neg' : 'al-pos'}>
                            {r ? signedMoney(r.profit) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </MoreInfo>
        </section>
      )}
    </>
  );
}

const CAUSE: Record<string, { icon: string; name: string }> = {
  ...WEATHER_INFO,
  tech: { icon: '🔧', name: '기체 점검·고장' },
  crew: { icon: '🧑‍✈️', name: '승무원 일정' },
  congestion: { icon: '🛬', name: '공항 혼잡' },
  staff: { icon: '👥', name: '일손 부족' },
  strike: { icon: '🪧', name: '파업' },
};

export function causeInfo(cause: string): { icon: string; name: string } {
  return CAUSE[cause] ?? { icon: '⏱️', name: '여러 까닭' };
}

const OPS_PARTS: { key: 'ok' | 'late' | 'diverted' | 'cancelled'; name: string; tone: BarTone }[] = [
  { key: 'ok', name: '정시', tone: 'good' },
  { key: 'late', name: '지연', tone: 'warn' },
  { key: 'diverted', name: '회항', tone: 'blue' },
  { key: 'cancelled', name: '결항', tone: 'bad' },
];

function OpsView({ state, viewer }: { state: AirlineState; viewer: number }) {
  const rep = state.report;
  const me = state.companies[viewer];
  const mine = (rep?.ops ?? []).filter((o) => o.company === viewer);
  const r = rep?.companies[viewer];
  const m0 = monthOf(state.t) - 1;
  const cities = [...new Set(me.routes.flatMap((x) => [x.a, x.b]))];
  const outlook = [0, 1, 2].map((k) => {
    const mm = (m0 + k) % 12;
    const list = cities.map((c) => ({ c, w: weather(c, mm) })).filter((x) => x.w.cause).sort((a, b) => b.w.factor - a.w.factor);
    return { mm, list };
  });
  const cancelRate = r && r.flights > 0 ? r.cancelled / r.flights : 0;
  return (
    <>
      <section className="al-card">
        <h4 className="al-fin-title">
          <FinIcon kind="tower" /> 운항 상황판 <small>{rep ? mLabel(rep.t) : '아직 없음'}</small>
        </h4>
        {r && r.flights > 0 ? (
          <ul className="al-staff-kpi al-ops-tiles">
            <li className={r.onTime < 0.7 ? 'al-kpi-bad' : 'al-kpi-ok'}>
              <ProgressRing value={r.onTime} tone={onTimeTone(r.onTime) === 'bad' ? 'bad' : onTimeTone(r.onTime) === 'warn' ? 'warn' : 'good'} size={42} label={`정시 운항률 ${pct(r.onTime)}`} />
              <span>
                <small>정시 운항률</small>
                <b>{pct(r.onTime)}</b>
              </span>
            </li>
            <li className="al-kpi-ok">
              <FinIcon kind="plane" size={26} />
              <span>
                <small>뜬 편</small>
                <b>{Math.round(r.flights - r.cancelled).toLocaleString('ko-KR')}편</b>
              </span>
            </li>
            <li className="al-kpi-warnish">
              <FinIcon kind="delay" size={26} />
              <span>
                <small>지연</small>
                <b>{r.late}편</b>
              </span>
            </li>
            <li className={cancelRate >= 0.03 ? 'al-kpi-bad' : 'al-kpi-ok'}>
              <StaffIcon kind="cancel" size={26} />
              <span>
                <small>결항</small>
                <b className={cancelRate >= 0.03 ? 'al-neg' : ''}>
                  {r.cancelled}편 <small>({pct(cancelRate)})</small>
                </b>
              </span>
            </li>
            <li className="al-kpi-ok">
              <RIcon kind="divert" size={26} />
              <span>
                <small>회항</small>
                <b>{r.diverted}편</b>
              </span>
            </li>
            <li className={r.disrupt > 0 ? 'al-kpi-warnish' : 'al-kpi-ok'}>
              <FinIcon kind="coin" size={26} />
              <span>
                <small>보상·추가 비용</small>
                <b>{fmtMoney(r.disrupt)}</b>
              </span>
            </li>
            {r.staffCancelled > 0 && (
              <li className="al-kpi-bad">
                <StaffIcon kind="people" size={26} />
                <span>
                  <small>일손 부족 결항</small>
                  <b className="al-neg">{r.staffCancelled}편</b>
                </span>
              </li>
            )}
            {r.strike && (
              <li className="al-kpi-bad">
                <StaffIcon kind="strike" size={26} />
                <span>
                  <small>파업</small>
                  <b className="al-neg">일주일쯤</b>
                </span>
              </li>
            )}
          </ul>
        ) : (
          <p className="al-muted">이번 달 결산이 나오면 노선마다 지연·결항을 보여 줘요.</p>
        )}
        <MoreInfo label="지연·결항은 어떻게 줄여요?">
          정비 수준·예비 승무원은 재무 화면에서, 예비기(노선에 넣지 않은 비행기)는 비행기 화면에서 정해요. 늦거나 결항이 잦으면 평판과 손님(특히 사업 손님)이 줄어요. 모든 사건은 게임 속 이야기이고, 손님은 늘 안전하게 다른 편으로 옮겨 타요.
        </MoreInfo>
        {mine.length > 0 && (
          <>
            <h5 className="al-fin-sub">
              노선마다 <small>지연·결항이 많은 순</small>
            </h5>
            <ul className="al-hc-legend al-ops-legend">
              {OPS_PARTS.map((p) => (
                <li key={p.key}>
                  <i className={`al-sw al-sw-${p.tone}`} /> {p.name}
                </li>
              ))}
            </ul>
            <ul className="al-ops-list">
              {mine.slice(0, 20).map((o) => {
                const info = causeInfo(o.cause);
                const name = `${CITY[o.a].name}–${CITY[o.b].name}`;
                const v = { ok: Math.max(0, o.flights - o.late - o.cancelled - o.diverted), late: o.late, diverted: o.diverted, cancelled: o.cancelled };
                return (
                  <li key={o.route}>
                    <b className="al-ops-name">{name}</b>
                    <span className="al-ops-bar">
                      <StackCell parts={OPS_PARTS.map((p) => ({ name: p.name, v: v[p.key], tone: p.tone }))} total={Math.max(1, o.flights)} label={`${name}: ${Math.round(o.flights)}편 중 지연 ${o.late}, 회항 ${o.diverted}, 결항 ${o.cancelled}`} />
                      <small className="al-ops-counts">
                        {Math.round(o.flights)}편 · 지연 {o.late}
                        {o.diverted > 0 ? ` · 회항 ${o.diverted}` : ''}
                        {o.cancelled > 0 && <b className="al-neg"> · 결항 {o.cancelled}</b>}
                      </small>
                    </span>
                    <span className="al-ops-cause" title={info.name}>
                      <CauseIcon cause={o.cause} size={18} />
                      <span>
                        {info.name}
                        {o.city ? <small className="al-muted"> {CITY[o.city].name}</small> : ''}
                      </span>
                      {o.grounded > 0 && (
                        <small className="al-ops-ground">
                          <FinIcon kind="wrench" size={13} /> 점검 {o.grounded}대
                        </small>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
      <section className="al-card">
        <h4 className="al-fin-title">
          <RIcon kind="storm" /> 앞으로 석 달 날씨 걱정
        </h4>
        <ul className="al-wx">
          {outlook.map(({ mm, list }) => (
            <li key={mm} className={list.length > 0 ? 'al-wx-warn' : ''}>
              <b className="al-wx-month">{mm + 1}월</b>
              {list.length === 0 ? (
                <span className="al-wx-clear">
                  <RIcon kind="sun" size={26} className="al-wx-sun" />
                  <small className="al-muted">우리 노선 도시는 대체로 맑아요</small>
                </span>
              ) : (
                <span className="al-wx-cities">
                  {list.slice(0, 5).map((x) => (
                    <span key={x.c} className="al-wx-city" title={WEATHER_INFO[x.w.cause!].name}>
                      <CauseIcon cause={x.w.cause!} size={18} /> {CITY[x.c].name}
                      <small className="al-muted">{WEATHER_INFO[x.w.cause!].name}</small>
                    </span>
                  ))}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function QuarterView({ state, viewer }: { state: AirlineState; viewer: number }) {
  const [table, setTable] = useState(false);
  const hist = state.history;
  const series: Series[] = state.companies.map((c, i) => ({
    name: c.name,
    color: coColors(c).main,
    shape: SEAT_SHAPES[c.seat],
    values: hist.map((h) => (c.out && h.value[i] === 0 ? null : h.value[i])),
  }));
  const labels = hist.map((h, k) => (k === 0 ? '시작' : qShort(h.q)));
  const span = hist.length;
  const every = span > 80 ? 5 : span > 40 ? 2 : 1;
  const tickAt = (i: number) => {
    const q = hist[i].q + 1;
    if (quarterOf(q) !== 1) return null;
    const y = yearOf(q);
    return (y - yearOf(hist[0].q + 1)) % every === 0 ? `${y}` : null;
  };
  const rep = state.qReport ?? state.report;
  const shareRows: ShareRow[] = REGIONS.map((r) => {
    const parts = state.companies.map((c, i) => ({ name: c.name, color: coColors(c).main, shape: SEAT_SHAPES[c.seat], value: rep?.companies[i]?.regionPax[r] ?? 0 }));
    return { label: `${REGION_INFO[r].emoji} ${REGION_INFO[r].short}`, total: parts.reduce((s, p) => s + p.value, 0), parts };
  });
  const routes = rep ? [...rep.routes].sort((a, b) => b.profit - a.profit) : [];
  const best = routes.slice(0, 5);
  const worst = routes.length > 5 ? routes.slice(-5).reverse() : [];
  const order = rankings(state);
  // 허브마다 갈아탄 손님 (지난 분기)
  const hubs = new Map<string, { pax: number; companies: Set<number>; top: { a: string; b: string; pax: number }[] }>();
  for (const x of rep?.xfers ?? []) {
    const h = hubs.get(x.via) ?? { pax: 0, companies: new Set<number>(), top: [] };
    h.pax += x.pax;
    x.companies.forEach((ci) => h.companies.add(ci));
    h.top.push({ a: x.a, b: x.b, pax: x.pax });
    hubs.set(x.via, h);
  }
  const hubRows = [...hubs.entries()].sort((a, b) => b[1].pax - a[1].pax).slice(0, 6);
  const legendSeries = series.map((s) => ({ name: s.name, color: s.color, shape: s.shape }));

  return (
    <div className="al-report-inner">
      <section className="al-card al-chart-card">
        <div className="al-card-head">
          <h4>회사 가치 변화</h4>
          {series.length > 1 && <Legend series={legendSeries} />}
          <ViewToggle table={table} onToggle={() => setTable(!table)} />
        </div>
        {table ? (
          <div className="al-table-wrap">
            <table className="al-table">
              <thead>
                <tr>
                  <th>시점</th>
                  {state.companies.map((c, i) => (
                    <th key={i}>
                      <CoName c={c} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hist
                  .filter((h, k) => k === 0 || k === hist.length - 1 || quarterOf(h.q) === 4)
                  .map((h) => (
                    <tr key={h.q}>
                      <th>{h.q === hist[0].q ? '시작' : qLabel(h.q)}</th>
                      {h.value.map((v, i) => (
                        <td key={i}>{fmtMoney(v)}</td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : hist.length < 2 ? (
          <p className="al-muted al-empty-main">첫 분기가 끝나면 그래프가 그려져요.</p>
        ) : (
          <LineChart series={series} labels={labels} tickAt={tickAt} format={fmtMoney} axisFormat={axisMoney} ariaLabel="회사마다 가치가 분기마다 어떻게 변했는지 보여 주는 선 그래프" />
        )}
      </section>

      <div className="al-report-grid">
        <section className="al-card">
          <h4>지역마다 손님 나눠 갖기 {rep && <small>{rep.span === 3 ? qLabel(rep.q) : mLabel(rep.t)}</small>}</h4>
          {series.length > 1 && <Legend series={legendSeries} />}
          <ShareBars rows={shareRows} format={fmtPax} />
        </section>
        <section className="al-card">
          <h4 className="al-fin-title">
            <FinIcon kind="trophy" /> 가장 잘 된 노선 · 안 된 노선
          </h4>
          {routes.length === 0 ? (
            <p className="al-muted">아직 운항한 노선이 없어요.</p>
          ) : (
            (() => {
              const shown = [...best, ...worst];
              const max = Math.max(1, ...shown.map((r) => Math.abs(r.profit)));
              const hasNeg = shown.some((r) => r.profit < 0);
              const row = (r: (typeof routes)[number], key: string) => {
                const name = `${CITY[r.a].name}–${CITY[r.b].name}`;
                const lf = r.seats > 0 ? r.pax / r.seats : 0;
                return (
                  <li key={key} className={r.company === viewer ? 'al-row-mine' : ''}>
                    <span className="al-rk-co">
                      <CoName c={state.companies[r.company]} />
                    </span>
                    <span className="al-rk-route">
                      {name}
                      <small className="al-muted"> 탑승률 {pct(lf)}</small>
                    </span>
                    <DivergeCell value={r.profit} max={max} hasNeg={hasNeg} label={`${name} 분기 이익 ${signedMoney(r.profit)}`} />
                    <b className={r.profit < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(r.profit)}</b>
                  </li>
                );
              };
              return (
                <>
                  <h5 className="al-fin-sub al-rk-sub">
                    <span className="al-tone-badge al-tb-good">
                      <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden="true">
                        <path d="M5 1.5L9 8.5H1z" />
                      </svg>
                      잘 된 노선
                    </span>
                  </h5>
                  <ul className="al-rk-list">{best.map((r) => row(r, `${r.company}-${r.route}`))}</ul>
                  {worst.length > 0 && (
                    <>
                      <h5 className="al-fin-sub al-rk-sub">
                        <span className="al-tone-badge al-tb-bad">
                          <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden="true">
                            <path d="M5 8.5L9 1.5H1z" />
                          </svg>
                          안 된 노선
                        </span>
                      </h5>
                      <ul className="al-rk-list">{worst.map((r) => row(r, `w-${r.company}-${r.route}`))}</ul>
                    </>
                  )}
                </>
              );
            })()
          )}
        </section>
      </div>

      <section className="al-card">
        <h4 className="al-fin-title">
          <RIcon kind="transfer" /> 갈아타는 손님 <small>{rep ? `${rep.span === 3 ? qLabel(rep.q) : mLabel(rep.t)} · 허브마다` : ''}</small>
        </h4>
        {hubRows.length === 0 ? (
          <p className="al-muted">아직 갈아타는 손님이 없어요. 본사에서 여러 곳으로 노선을 내면, 곧장 가는 노선이 없는 두 도시 손님이 본사에서 갈아타요.</p>
        ) : (
          <ul className="al-xh-list">
            {hubRows.map(([via, h]) => (
              <li key={via} className={h.companies.has(viewer) ? 'al-row-mine' : ''}>
                <b className="al-xh-city">{CITY[via].name}</b>
                <span className="al-xh-bar">
                  <BarCell frac={h.pax / Math.max(1, hubRows[0][1].pax)} tone="blue" label={`${CITY[via].name}에서 갈아탄 손님 ${fmtPax(h.pax)}`} />
                  <small>{fmtPax(h.pax)}</small>
                </span>
                <span className="al-xh-cos">
                  {[...h.companies].map((ci) => (
                    <CoName key={ci} c={state.companies[ci]} />
                  ))}
                </span>
                <span className="al-xh-top">
                  {h.top.slice(0, 3).map((t) => (
                    <span key={`${t.a}-${t.b}`} className="al-xh-chip">
                      {CITY[t.a].name} → {CITY[t.b].name}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="al-card">
        <h4 className="al-fin-title">
          <RIcon kind="medal" /> 회사 비교 <small>회사 가치 순</small>
        </h4>
        <ul className="al-cmp">
          {order.map((i, rank) => {
            const c = state.companies[i];
            const r = rep?.companies[i];
            const last = c.reviews.length > 0 ? c.reviews[c.reviews.length - 1] : null;
            return (
              <li key={i} className={`al-cmp-card${i === viewer ? ' al-row-mine' : ''}${c.out ? ' al-cmp-out' : ''}`}>
                <div className="al-cmp-head">
                  <RankMedal rank={rank + 1} out={c.out} />
                  <span className="al-cmp-name">
                    <CoName c={c} bold />
                    <small className="al-muted">본사 {CITY[c.hub].name}</small>
                  </span>
                  {last && (
                    <span className="al-grade al-grade-small" style={{ background: GRADE_INFO[last.grade].color }} title={last.text}>
                      {last.grade}
                    </span>
                  )}
                </div>
                <p className="al-cmp-value">
                  <small>회사 가치</small>
                  <b>{fmtMoney(companyValue(state, i))}</b>
                </p>
                <ul className="al-cmp-stats">
                  <li>
                    <FinIcon kind="wallet" size={15} /> 현금 <b>{fmtMoney(c.cash)}</b>
                  </li>
                  <li>
                    <FinIcon kind="bank" size={15} /> 빚 <b className={c.debt > 0 ? 'al-neg' : ''}>{c.debt > 0 ? fmtMoney(c.debt) : '없음'}</b>
                  </li>
                  <li>
                    <FinIcon kind="plane" size={15} /> 비행기 <b>{c.planes.length}대</b>
                  </li>
                  <li>
                    <FinIcon kind="ticket" size={15} /> 노선 <b>{c.routes.length}개</b>
                  </li>
                  <li>
                    <RIcon kind="globe" size={15} /> 지역 <RegionDots n={regionsServed(c).size} />
                  </li>
                  <li>
                    <FinIcon kind="star" size={15} /> 평판 <b>{Math.round(c.reputation)}</b>
                  </li>
                  <li>
                    <FinIcon kind="people" size={15} /> 분기 손님 <b>{r ? fmtPax(r.pax) : '—'}</b>
                  </li>
                  <li>
                    <FinIcon kind={r && r.profit < 0 ? 'down' : 'chart'} size={15} /> 분기 이익 <b className={r && r.profit < 0 ? 'al-neg' : 'al-pos'}>{r ? signedMoney(r.profit) : '—'}</b>
                  </li>
                  <li>
                    <RIcon kind="transfer" size={15} /> 갈아탄 손님 <b>{r ? fmtPax(r.xferPax) : '—'}</b>
                  </li>
                </ul>
              </li>
            );
          })}
        </ul>
        <MoreInfo label="표로 보기">
          <div className="al-table-wrap">
            <table className="al-table al-compare">
              <thead>
                <tr>
                  <th>순위</th>
                  <th>회사</th>
                  <th>회사 가치</th>
                  <th>현금</th>
                  <th>빚</th>
                  <th>비행기</th>
                  <th>노선</th>
                  <th>지역</th>
                  <th>지난 분기 손님</th>
                  <th>지난 분기 이익</th>
                  <th>갈아탄 손님</th>
                  <th>평판</th>
                  <th>평가</th>
                </tr>
              </thead>
              <tbody>
                {order.map((i, rank) => {
                  const c = state.companies[i];
                  const r = rep?.companies[i];
                  return (
                    <tr key={i} className={i === viewer ? 'al-row-mine' : ''}>
                      <td>{c.out ? '운항 중단' : `${rank + 1}등`}</td>
                      <td>
                        <CoName c={c} /> <small className="al-muted">{CITY[c.hub].name}</small>
                      </td>
                      <td>{fmtMoney(companyValue(state, i))}</td>
                      <td>{fmtMoney(c.cash)}</td>
                      <td>{fmtMoney(c.debt)}</td>
                      <td>{c.planes.length}</td>
                      <td>{c.routes.length}</td>
                      <td>{regionsServed(c).size}/6</td>
                      <td>{r ? fmtPax(r.pax) : '—'}</td>
                      <td className={r && r.profit < 0 ? 'al-neg' : 'al-pos'}>{r ? signedMoney(r.profit) : '—'}</td>
                      <td>{r ? fmtPax(r.xferPax) : '—'}</td>
                      <td>{Math.round(c.reputation)}</td>
                      <td>{c.reviews.length > 0 ? c.reviews[c.reviews.length - 1].grade : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </MoreInfo>
      </section>
    </div>
  );
}

/** 소식 한 개: 갈래 아이콘 + 제목 + 분위기 표시, 긴 글은 두 줄만 보이고 '더 보기'로 펼친다 */
function NewsCard({ n, state, viewer, onCity }: { n: NewsItem; state: AirlineState; viewer: number; onCity: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const kind = newsKind(n);
  // 두 줄을 넘는 글만 접는다 (화면 너비에 따라 다르므로 그려진 뒤에 잰다)
  const textRef = useRef<HTMLParagraphElement>(null);
  const [over, setOver] = useState(false);
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const check = () => setOver(open || el.scrollHeight > el.clientHeight + 2);
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, n.text]);
  const long = n.text.length > 40;
  const mine = n.for?.includes(viewer);
  const co = n.company !== undefined ? state.companies[n.company] : undefined;
  return (
    <li className={`al-feed-item al-feed-${n.tone}${mine ? ' al-news-for' : ''}`}>
      <span className="al-feed-month" aria-hidden="true">
        {monthOf(n.t)}월
      </span>
      <span className={`al-feed-dot al-feed-dot-${n.tone}`} aria-hidden="true" />
      <div className="al-feed-card">
        <NewsKindIcon kind={kind} />
        <div className="al-news-body">
          <div className="al-feed-title">
            <b>{n.title}</b>
            {mine && <span className="al-flag al-flag-warn">우리 회사</span>}
            <ToneBadge tone={n.tone} />
            <small className="al-muted">{mLabel(n.t)}</small>
          </div>
          <p ref={textRef} className={long && !open ? 'al-feed-text al-clamp' : 'al-feed-text'}>
            {n.text}
          </p>
          <div className="al-feed-actions">
            {long && over && (
              <button type="button" className="al-more-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
                <StaffIcon kind="info" size={14} /> {open ? '접기' : '더 보기'}
              </button>
            )}
            {n.city && (
              <button type="button" className="al-link al-feed-city" onClick={() => onCity(n.city!)}>
                <FinIcon kind="target" size={14} /> 지도에서 {CITY[n.city].name} 보기
              </button>
            )}
          </div>
        </div>
        {co && realOf(co) && (
          <span className="al-news-photo">
            <AirlinePhoto airline={realOf(co)!} width={90} />
          </span>
        )}
      </div>
    </li>
  );
}

export function NewsView({ state, onCity, viewer }: { state: AirlineState; onCity: (id: string) => void; viewer: number }) {
  const items = [...state.news].reverse();
  const [mineOnly, setMineOnly] = useState(false);
  const [kind, setKind] = useState<NewsKind | 'all'>('all');
  const base = mineOnly ? items.filter((n) => n.for?.includes(viewer)) : items;
  const counts = new Map<NewsKind, number>();
  for (const n of base) counts.set(newsKind(n), (counts.get(newsKind(n)) ?? 0) + 1);
  const shown = kind === 'all' ? base : base.filter((n) => newsKind(n) === kind);
  // 해마다 묶기 (새 소식이 위)
  const groups: { year: number; list: NewsItem[] }[] = [];
  for (const n of shown) {
    const y = yearOfM(n.t);
    const g = groups[groups.length - 1];
    if (g && g.year === y) g.list.push(n);
    else groups.push({ year: y, list: [n] });
  }
  return (
    <div className="al-feed">
      <h3 className="al-feed-head">
        <FinIcon kind="megaphone" size={22} /> 하늘길 뉴스 <small>최근 {items.length}개</small>
        <label className="al-check al-news-filter">
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> 우리 회사 소식만
        </label>
      </h3>
      <div className="al-feed-chips" role="group" aria-label="소식 갈래 고르기">
        <button type="button" className={`al-chip${kind === 'all' ? ' al-on' : ''}`} aria-pressed={kind === 'all'} onClick={() => setKind('all')}>
          전체 {base.length}
        </button>
        {NEWS_KINDS.filter((k) => counts.has(k.id)).map((k) => (
          <button key={k.id} type="button" className={`al-chip al-feed-chip${kind === k.id ? ' al-on' : ''}`} aria-pressed={kind === k.id} onClick={() => setKind(kind === k.id ? 'all' : k.id)}>
            <NewsKindIcon kind={k.id} size={18} /> {k.name} {counts.get(k.id)}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="al-muted al-empty-main">{mineOnly ? '우리 회사 소식이 아직 없어요.' : '이 갈래 소식이 아직 없어요.'}</p>
      ) : (
        groups.map((g) => (
          <section key={g.year} className="al-feed-year">
            <h4 className="al-feed-yearhead">
              <span>{g.year}년</span>
              <small className="al-muted">{g.list.length}개</small>
            </h4>
            <ul className="al-feed-list">
              {g.list.map((n) => (
                <NewsCard key={n.id} n={n} state={state} viewer={viewer} onCity={onCity} />
              ))}
            </ul>
          </section>
        ))
      )}
      <MoreInfo label="사건은 어떻게 정해져요?">
        {FIXED_ICON.olympic} 올림픽 · {FIXED_ICON.expo} 엑스포는 실제로 열린(또는 열리기로 한) 해에 그 도시 손님을 크게 늘려요. 그 밖의 사건은 판마다 무작위예요.
      </MoreInfo>
    </div>
  );
}
