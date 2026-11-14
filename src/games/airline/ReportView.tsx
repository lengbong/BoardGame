import { useState } from 'react';
import { SEAT_COLORS } from '../common/players';
import { SEAT_SHAPES } from './Art';
import { LineChart, Legend, ShareBars, type Series, type ShareRow } from './Charts';
import { CITY, REGIONS, REGION_INFO } from './cities';
import { FIXED_ICON } from './events';
import { axisMoney, fmtMoney, fmtPax, pct, signedMoney } from './format';
import { GRADE_INFO } from './goals';
import { rankings } from './rules';
import { companyValue, regionsServed } from './simulate';
import { qLabel, qShort, quarterOf, yearOf } from './time';
import type { AirlineState } from './types';
import { CoName } from './ui';

export function ReportView({ state, viewer }: { state: AirlineState; viewer: number }) {
  const [table, setTable] = useState(false);
  const hist = state.history;
  const series: Series[] = state.companies.map((c, i) => ({
    name: c.name,
    color: SEAT_COLORS[c.seat].main,
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
  const rep = state.report;
  const shareRows: ShareRow[] = REGIONS.map((r) => {
    const parts = state.companies.map((c, i) => ({ name: c.name, color: SEAT_COLORS[c.seat].main, shape: SEAT_SHAPES[c.seat], value: rep?.companies[i]?.regionPax[r] ?? 0 }));
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
    <div className="al-report">
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
          <h4>지역마다 손님 나눠 갖기 {rep && <small>{qLabel(rep.q)}</small>}</h4>
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
          갈아타는 손님 <small>{rep ? `${qLabel(rep.q)} · 허브마다` : ''}</small>
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
                    <td>{c.out ? '파산' : `${rank + 1}등`}</td>
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
            <div>
              <b>{n.title}</b> {n.for?.includes(viewer) && <span className="al-flag al-flag-warn">우리 회사</span>} <small className="al-muted">{qLabel(n.q)}</small>
              <p>{n.text}</p>
              {n.city && (
                <button type="button" className="al-link" onClick={() => onCity(n.city!)}>
                  지도에서 {CITY[n.city].name} 보기
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="al-muted al-tip">
        {FIXED_ICON.olympic} 올림픽 · {FIXED_ICON.expo} 엑스포는 실제로 열린(또는 열리기로 한) 해에 그 도시 손님을 크게 늘려요. 그 밖의 사건은 판마다 무작위예요.
      </p>
    </div>
  );
}
