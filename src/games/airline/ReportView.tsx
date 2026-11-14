import { useState } from 'react';
import { coColors, realOf } from './brand';
import { SEAT_SHAPES } from './Art';
import { WEATHER_INFO, weather } from './calendar';
import { LineChart, Legend, MonthBars, ProfitBars, ShareBars, SparkBars, Sparkline, type Series, type ShareRow } from './Charts';
import { CITY, REGIONS, REGION_INFO } from './cities';
import { FIXED_ICON } from './events';
import { axisMoney, fmtMoney, fmtPax, pct, signedMoney } from './format';
import { GRADE_INFO } from './goals';
import { rankings } from './rules';
import { companyValue, pairDemand, regionsServed } from './simulate';
import { mLabel, mOf, mShort, monthOf, qLabel, qShort, quarterOf, yearOf, yearOfM } from './time';
import type { AirlineState, CompanyReport, MonthPoint } from './types';
import { AirlinePhoto } from './AirlinePicker';
import { CoName } from './ui';

type View = 'month' | 'quarter' | 'year' | 'ops';

const VIEWS: { id: View; label: string }[] = [
  { id: 'month', label: '📅 달마다' },
  { id: 'quarter', label: '🗓️ 분기' },
  { id: 'year', label: '📆 해마다' },
  { id: 'ops', label: '🛫 운항 상황판' },
];

export function ReportView({ state, viewer }: { state: AirlineState; viewer: number }) {
  const [view, setView] = useState<View>('month');
  return (
    <div className="al-report">
      <div className="al-subtabs" role="tablist" aria-label="보고서 보기">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" role="tab" aria-selected={view === v.id} className={`al-subtab${view === v.id ? ' al-on' : ''}`} onClick={() => setView(v.id)} data-testid={`al-report-${v.id}`}>
            {v.label}
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

const costOf = (r: CompanyReport) => r.fuel + r.crew + r.airport + r.service + r.sales + r.lease + r.fleet + r.branch + r.ads + r.interest + r.disrupt + r.tax;

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
          <button type="button" className="btn btn-small" onClick={() => setTable(!table)} aria-pressed={table}>
            {table ? '📊 그래프로 보기' : '📋 표로 보기'}
          </button>
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
          {state.months.length < 2 ? <p className="al-muted">첫 달이 끝나면 그려져요.</p> : <LineChart series={onTimeSeries} labels={labels} tickAt={tickAt} format={(v) => `${v.toFixed(1)}%`} axisFormat={(v) => `${Math.round(v)}`} height={200} zero={false} ariaLabel="회사마다 정시 운항률이 달마다 어떻게 변했는지" />}
        </section>
      </div>

      <div className="al-report-grid">
        <section className="al-card al-chart-card">
          <h4>
            유가 지수 <small>1이 보통 · 지금 {state.oil.toFixed(2)}</small>
          </h4>
          {state.months.length < 2 ? <p className="al-muted">첫 달이 끝나면 그려져요.</p> : <LineChart series={oil} labels={labels} tickAt={tickAt} format={(v) => v.toFixed(2)} axisFormat={(v) => v.toFixed(2)} height={170} zero={false} ariaLabel="유가 지수가 달마다 어떻게 변했는지" />}
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

      <section className="al-card">
        <h4>
          노선마다 최근 열두 달 <small>{me.routes.length}개</small>
        </h4>
        {routes.length === 0 ? (
          <p className="al-muted">아직 노선이 없어요.</p>
        ) : (
          <div className="al-table-wrap">
            <table className="al-table al-route-months">
              <thead>
                <tr>
                  <th>노선</th>
                  <th>탑승률</th>
                  <th>이익</th>
                  <th>지난달 이익</th>
                  <th>정시율</th>
                  <th>결항률</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => {
                  const hist = r.stats?.hist ?? [];
                  const name = `${CITY[r.a].name}–${CITY[r.b].name}`;
                  return (
                    <tr key={r.id}>
                      <th>{name}</th>
                      <td>
                        <Sparkline values={hist.map((x) => x[0])} label={`${name} 최근 탑승률`} /> {r.stats ? pct(r.stats.lf) : '—'}
                      </td>
                      <td>
                        <SparkBars values={hist.map((x) => x[1])} label={`${name} 최근 이익`} />
                      </td>
                      <td className={r.stats && r.stats.profit < 0 ? 'al-neg' : 'al-pos'}>{r.stats ? signedMoney(r.stats.profit) : '—'}</td>
                      <td>{r.stats ? pct(r.stats.onTime) : '—'}</td>
                      <td>{r.stats ? pct(r.stats.cancel) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function YearView({ state, viewer }: { state: AirlineState; viewer: number }) {
  const years = state.years;
  const me = state.companies[viewer];
  const acc = me.acc;
  return (
    <>
      <section className="al-card">
        <h4>{me.name} 해마다 결산</h4>
        {years.length === 0 && acc.quarters === 0 ? (
          <p className="al-muted">첫해가 끝나면(12월) 한 해 결산이 나와요.</p>
        ) : (
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
                <tr className="al-row-mine">
                  <th>{acc.year}년 (지금까지)</th>
                  <td>{fmtMoney(acc.revenue)}</td>
                  <td>{fmtMoney(acc.revenue - acc.profit)}</td>
                  <td className={acc.profit < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(acc.profit)}</td>
                  <td>{fmtPax(acc.pax)}</td>
                  <td>{pct(acc.seats > 0 ? acc.pax / acc.seats : 0)}</td>
                  <td>{pct(me.onTime)}</td>
                  <td>—</td>
                </tr>
                {[...years].reverse().map((y) => {
                  const r = y.companies[viewer];
                  if (!r) return null;
                  const review = me.reviews.find((x) => x.year === y.year);
                  return (
                    <tr key={y.year}>
                      <th>{y.year}년</th>
                      <td>{fmtMoney(r.ticket + r.side)}</td>
                      <td>{fmtMoney(costOf(r))}</td>
                      <td className={r.profit < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(r.profit)}</td>
                      <td>{fmtPax(r.pax)}</td>
                      <td>{pct(r.seats > 0 ? r.pax / r.seats : 0)}</td>
                      <td>{r.flights > 0 ? pct(r.onTime) : '—'}</td>
                      <td>
                        {review ? (
                          <span className="al-grade al-grade-small" style={{ background: GRADE_INFO[review.grade].color }} title={review.text}>
                            {review.grade}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {years.length > 0 && (
        <section className="al-card">
          <h4>항공사마다 한 해 이익</h4>
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
};

export function causeInfo(cause: string): { icon: string; name: string } {
  return CAUSE[cause] ?? { icon: '⏱️', name: '여러 까닭' };
}

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
  return (
    <>
      <section className="al-card">
        <h4>
          🛫 운항 상황판 <small>{rep ? mLabel(rep.t) : '아직 없음'}</small>
        </h4>
        {r && r.flights > 0 ? (
          <div className="al-ops-kpi">
            <div>
              <span>뜬 편</span>
              <b>{Math.round(r.flights - r.cancelled).toLocaleString('ko-KR')}편</b>
            </div>
            <div>
              <span>정시 운항률</span>
              <b>{pct(r.onTime)}</b>
            </div>
            <div>
              <span>지연</span>
              <b>{r.late}편</b>
            </div>
            <div>
              <span>결항</span>
              <b>
                {r.cancelled}편 <small>({pct(r.cancelled / r.flights)})</small>
              </b>
            </div>
            <div>
              <span>회항</span>
              <b>{r.diverted}편</b>
            </div>
            <div>
              <span>보상·추가 비용</span>
              <b>{fmtMoney(r.disrupt)}</b>
            </div>
          </div>
        ) : (
          <p className="al-muted">이번 달 결산이 나오면 노선마다 지연·결항을 보여 줘요.</p>
        )}
        <p className="al-muted al-tip">
          정비 수준·예비 승무원은 재무 화면에서, 예비기(노선에 넣지 않은 비행기)는 비행기 화면에서 정해요. 늦거나 결항이 잦으면 평판과 손님(특히 사업 손님)이 줄어요. 모든 사건은 게임 속 이야기이고, 손님은 늘 안전하게 다른 편으로 옮겨 타요.
        </p>
        {mine.length > 0 && (
          <div className="al-table-wrap">
            <table className="al-table">
              <thead>
                <tr>
                  <th>노선</th>
                  <th>편수</th>
                  <th>지연</th>
                  <th>결항</th>
                  <th>회항</th>
                  <th>점검</th>
                  <th>큰 까닭</th>
                </tr>
              </thead>
              <tbody>
                {mine.slice(0, 20).map((o) => {
                  const info = causeInfo(o.cause);
                  return (
                    <tr key={o.route}>
                      <th>
                        {CITY[o.a].name}–{CITY[o.b].name}
                      </th>
                      <td>{Math.round(o.flights)}</td>
                      <td>{o.late}</td>
                      <td className={o.cancelled > 0 ? 'al-neg' : ''}>{o.cancelled}</td>
                      <td>{o.diverted}</td>
                      <td>{o.grounded > 0 ? `${o.grounded}대` : '—'}</td>
                      <td>
                        {info.icon} {info.name}
                        {o.city ? ` (${CITY[o.city].name})` : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="al-card">
        <h4>앞으로 석 달 날씨 걱정</h4>
        <ul className="al-outlook">
          {outlook.map(({ mm, list }) => (
            <li key={mm}>
              <b>{mm + 1}월</b>{' '}
              {list.length === 0 ? (
                <span className="al-muted">우리 노선 도시는 대체로 맑아요</span>
              ) : (
                list.slice(0, 5).map((x) => (
                  <span key={x.c} className="tag">
                    {WEATHER_INFO[x.w.cause!].icon} {CITY[x.c].name}
                  </span>
                ))
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
          <button type="button" className="btn btn-small" onClick={() => setTable(!table)} aria-pressed={table}>
            {table ? '📈 그래프로 보기' : '📋 표로 보기'}
          </button>
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
          <h4>가장 잘 된 노선 · 안 된 노선</h4>
          {routes.length === 0 ? (
            <p className="al-muted">아직 운항한 노선이 없어요.</p>
          ) : (
            <table className="al-table al-best">
              <tbody>
                {best.map((r) => (
                  <tr key={`${r.company}-${r.route}`} className={r.company === viewer ? 'al-row-mine' : ''}>
                    <td>
                      <CoName c={state.companies[r.company]} />
                    </td>
                    <td>
                      {CITY[r.a].name}–{CITY[r.b].name}
                    </td>
                    <td>{pct(r.seats > 0 ? r.pax / r.seats : 0)}</td>
                    <td className="al-pos">{signedMoney(r.profit)}</td>
                  </tr>
                ))}
                {worst.length > 0 && (
                  <tr className="al-sep">
                    <td colSpan={4}>⋯</td>
                  </tr>
                )}
                {worst.map((r) => (
                  <tr key={`w-${r.company}-${r.route}`} className={r.company === viewer ? 'al-row-mine' : ''}>
                    <td>
                      <CoName c={state.companies[r.company]} />
                    </td>
                    <td>
                      {CITY[r.a].name}–{CITY[r.b].name}
                    </td>
                    <td>{pct(r.seats > 0 ? r.pax / r.seats : 0)}</td>
                    <td className={r.profit < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(r.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="al-card">
        <h4>
          갈아타는 손님 <small>{rep ? `${rep.span === 3 ? qLabel(rep.q) : mLabel(rep.t)} · 허브마다` : ''}</small>
        </h4>
        {hubRows.length === 0 ? (
          <p className="al-muted">아직 갈아타는 손님이 없어요. 본사에서 여러 곳으로 노선을 내면, 곧장 가는 노선이 없는 두 도시 손님이 본사에서 갈아타요.</p>
        ) : (
          <table className="al-table al-xfer-table">
            <thead>
              <tr>
                <th>갈아타는 도시</th>
                <th>회사</th>
                <th>분기 손님</th>
                <th>많이 간 연결</th>
              </tr>
            </thead>
            <tbody>
              {hubRows.map(([via, h]) => (
                <tr key={via} className={h.companies.has(viewer) ? 'al-row-mine' : ''}>
                  <th>{CITY[via].name}</th>
                  <td>
                    {[...h.companies].map((ci) => (
                      <CoName key={ci} c={state.companies[ci]} />
                    ))}
                  </td>
                  <td>{fmtPax(h.pax)}</td>
                  <td>
                    <small>
                      {h.top
                        .slice(0, 3)
                        .map((t) => `${CITY[t.a].name}→${CITY[t.b].name}`)
                        .join(', ')}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="al-card">
        <h4>회사 비교</h4>
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
                    <td>
                      {c.reviews.length > 0 ? (
                        <span className="al-grade al-grade-small" style={{ background: GRADE_INFO[c.reviews[c.reviews.length - 1].grade].color }} title={c.reviews[c.reviews.length - 1].text}>
                          {c.reviews[c.reviews.length - 1].grade}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function NewsView({ state, onCity, viewer }: { state: AirlineState; onCity: (id: string) => void; viewer: number }) {
  const items = [...state.news].reverse();
  const [mineOnly, setMineOnly] = useState(false);
  const shown = mineOnly ? items.filter((n) => n.for?.includes(viewer)) : items;
  return (
    <div className="al-news">
      <h3>
        📰 하늘길 뉴스 <small>최근 {items.length}개</small>
        <label className="al-check al-news-filter">
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> 우리 회사 소식만
        </label>
      </h3>
      <ul>
        {shown.map((n) => (
          <li key={n.id} className={`al-news-${n.tone}${n.for?.includes(viewer) ? ' al-news-for' : ''}`}>
            <span className="al-news-icon" aria-hidden="true">
              {n.icon}
            </span>
            <div className="al-news-body">
              <b>{n.title}</b> {n.for?.includes(viewer) && <span className="al-flag al-flag-warn">우리 회사</span>} <small className="al-muted">{mLabel(n.t)}</small>
              <p>{n.text}</p>
              {n.city && (
                <button type="button" className="al-link" onClick={() => onCity(n.city!)}>
                  지도에서 {CITY[n.city].name} 보기
                </button>
              )}
            </div>
            {n.company !== undefined && state.companies[n.company] && realOf(state.companies[n.company]) && (
              <span className="al-news-photo">
                <AirlinePhoto airline={realOf(state.companies[n.company])!} width={90} />
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="al-muted al-tip">
        {FIXED_ICON.olympic} 올림픽 · {FIXED_ICON.expo} 엑스포는 실제로 열린(또는 열리기로 한) 해에 그 도시 손님을 크게 늘려요. 그 밖의 사건은 판마다 무작위예요.
      </p>
    </div>
  );
}
