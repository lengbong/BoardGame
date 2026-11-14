import { useMemo } from 'react';
import { SEAT_COLORS } from '../common/players';
import { MODEL } from './aircraft';
import { openSuggestion, suggestRoutes, type Candidate } from './ai';
import { LandmarkIcon, PlaneArt, SEAT_SHAPES } from './Art';
import { AIRPORT_INFO, CITIES, CITY, FEE_INFO, REGION_INFO, SEASON_INFO, airportClass, citySize, dist, pairKey } from './cities';
import { FIXED_EVENTS, FIXED_ICON } from './events';
import { fmtMoney, fmtPax, km, pct, signedMoney } from './format';
import { branchBlocker, buildBlocker, closeBranchBlocker, routeOnPair } from './rules';
import { branchCost, branchUpkeep, businessCost, leaseDeposit, pairDemand, slotCapacity, slotsUsed } from './simulate';
import { QUARTER_NAMES, yearOf } from './time';
import type { AirlineAction, AirlineState } from './types';
import { ActButton, CoName, LoadMeter, Meter, Stars } from './ui';
import type { Selection } from './MapView';

interface Common {
  state: AirlineState;
  viewer: number;
  canAct: boolean;
  perform: (a: AirlineAction) => void;
  setState: (s: AirlineState) => void;
  onPlanRoute: (from: string, to?: string) => void;
  onEditRoute: (routeId: number) => void;
  onSelect: (sel: Selection) => void;
}

const notMine = '내 차례에만 할 수 있어요';

export function InfoPanel(props: Common & { selected: Selection }) {
  const { selected } = props;
  if (selected?.kind === 'city') return <CityPanel {...props} city={selected.id} />;
  if (selected?.kind === 'route') return <RoutePanel {...props} company={selected.company} route={selected.route} />;
  return <Overview {...props} />;
}

// ------------------------------------------------------------------ 도시

function CityPanel({ state, viewer, canAct, perform, onPlanRoute, onSelect, city }: Common & { city: string }) {
  const c = CITY[city];
  const year = yearOf(state.q);
  const me = state.companies[viewer];
  const size = citySize(c, year);
  const later = citySize(c, year + 10);
  const cls = airportClass(c, year);
  const has = me.branches.includes(city);
  const block = (b: string | null) => (canAct ? b : notMine);
  const events = FIXED_EVENTS.filter((e) => e.city === city && e.year >= year && e.year <= year + 2);
  const effects = state.effects.filter((e) => (e.kind === 'tourism' || e.kind === 'fair') && e.city === city);
  const here = state.companies.map((co, i) => ({ co, i })).filter(({ co }) => !co.out && co.branches.includes(city));
  const dests = useMemo(
    () =>
      CITIES.filter((x) => x.id !== city && dist(city, x.id) >= 300)
        .map((x) => {
          const d = pairDemand(state, city, x.id);
          return { id: x.id, demand: d.biz + d.leisure, d: dist(city, x.id) };
        })
        .sort((a, b) => b.demand - a.demand)
        .slice(0, 6),
    [state, city],
  );
  const hotel = me.businesses.find((b) => b.city === city && b.kind === 'hotel');
  const agency = me.businesses.find((b) => b.city === city && b.kind === 'agency');
  const season = SEASON_INFO[c.season].mult;

  return (
    <div className="al-info al-city-info" data-testid="al-city-panel">
      <div className="al-info-main">
        <header className="al-info-head">
          <span className="al-landmark" aria-hidden="true">
            <LandmarkIcon kind={c.landmark} size={34} />
          </span>
          <div>
            <h3>
              {c.name} <small>{c.country} · {REGION_INFO[c.region].name}</small>
            </h3>
            <p>{c.desc}</p>
          </div>
          <button type="button" className="btn btn-ghost btn-small al-close" onClick={() => onSelect(null)} aria-label="닫기 (Esc)">
            ✕
          </button>
        </header>
        <dl className="al-traits">
          <div>
            <dt>도시 크기</dt>
            <dd>
              <Meter value={size / 10} tone="blue" label={`도시 크기 ${size.toFixed(1)}`} /> {size.toFixed(1)}
              {later > size + 0.4 && <span className="al-up" title="10년 뒤 더 커져요"> ↗</span>}
            </dd>
          </div>
          <div>
            <dt>손님 성격</dt>
            <dd className="al-mix">
              <span className="al-mix-bar" aria-hidden="true">
                <span className="al-mix-biz" style={{ width: `${c.biz * 100}%` }} />
                <span className="al-mix-fun" style={{ width: `${(1 - c.biz) * 100}%` }} />
              </span>
              사업 {pct(c.biz)} · 관광 {pct(1 - c.biz)}
            </dd>
          </div>
          <div>
            <dt>관광 매력</dt>
            <dd>
              <Stars n={Math.round(c.fun / 2)} /> {c.fun}/10
            </dd>
          </div>
          <div>
            <dt>성수기</dt>
            <dd className="al-season">
              <span className="al-season-bars" aria-hidden="true">
                {season.map((m, i) => (
                  <span key={i} style={{ height: `${Math.round(m * 12)}px` }} title={`${i + 1}분기 ${QUARTER_NAMES[i]}`} />
                ))}
              </span>
              {SEASON_INFO[c.season].name}
            </dd>
          </div>
          <div>
            <dt>공항</dt>
            <dd>
              {AIRPORT_INFO[cls].name} {cls >= 4 ? '(모든 비행기)' : cls === 3 ? '(점보까지)' : cls === 2 ? '(중형까지)' : '(작은 비행기만)'}
            </dd>
          </div>
          <div>
            <dt>내 슬롯</dt>
            <dd>
              주 {slotsUsed(me, city)} / {slotCapacity(state, viewer, city)}회{me.hub === city ? ' (본사 2배)' : ''}
            </dd>
          </div>
          <div>
            <dt>이용료</dt>
            <dd>{FEE_INFO[c.fee].name}</dd>
          </div>
          {(events.length > 0 || effects.length > 0) && (
            <div className="al-trait-wide">
              <dt>소식</dt>
              <dd>
                {events.map((e) => (
                  <span key={`${e.year}${e.kind}`} className="tag al-tag-event">
                    {FIXED_ICON[e.kind]} {e.year}년 {e.title}
                  </span>
                ))}
                {effects.map((e) => (
                  <span key={e.id} className="tag al-tag-event">
                    {e.kind === 'tourism' ? '🎒 여행 붐' : '🏢 박람회'}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </div>
      <div className="al-info-side">
        <section>
          <h4>여기 있는 회사</h4>
          {here.length === 0 ? (
            <p className="al-muted">아직 아무도 없어요.</p>
          ) : (
            <ul className="al-here">
              {here.map(({ co, i }) => (
                <li key={i}>
                  <CoName c={co} />
                  {co.hub === city ? <span className="tag">본사</span> : <span className="tag">지점</span>}
                  <small>노선 {co.routes.filter((r) => r.a === city || r.b === city).length}개</small>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="al-city-actions">
          {!has ? (
            <>
              <ActButton primary blocker={block(branchBlocker(state, viewer, city))} onClick={() => perform({ type: 'openBranch', city })} testId="al-open-branch">
                🏢 지점 열기 · {fmtMoney(branchCost(city, state.q))}
              </ActButton>
              <small className="al-muted">유지비 분기마다 {fmtMoney(branchUpkeep(city, state.q))}. 지점이 있어야 노선을 열 수 있어요.</small>
            </>
          ) : (
            <>
              <ActButton primary blocker={canAct ? null : notMine} onClick={() => onPlanRoute(city)} testId="al-plan-from">
                ✈️ 여기서 노선 열기
              </ActButton>
              <div className="al-biz-row">
                {hotel ? (
                  <span className="tag">🏨 호텔 운영 중</span>
                ) : (
                  <ActButton small blocker={block(buildBlocker(state, viewer, city, 'hotel'))} onClick={() => perform({ type: 'build', city, kind: 'hotel' })} title="관광 손님이 늘고 숙박 수입이 생겨요">
                    🏨 호텔 {fmtMoney(businessCost(city, 'hotel', state.q))}
                  </ActButton>
                )}
                {agency ? (
                  <span className="tag">🧳 여행사 운영 중</span>
                ) : (
                  <ActButton small blocker={block(buildBlocker(state, viewer, city, 'agency'))} onClick={() => perform({ type: 'build', city, kind: 'agency' })} title="이 도시 노선의 손님이 조금 늘어요">
                    🧳 여행사 {fmtMoney(businessCost(city, 'agency', state.q))}
                  </ActButton>
                )}
              </div>
              {me.hub !== city && (
                <ActButton small blocker={block(closeBranchBlocker(state, viewer, city))} onClick={() => perform({ type: 'closeBranch', city })}>
                  지점 닫기
                </ActButton>
              )}
            </>
          )}
        </section>
        <section>
          <h4>여기서 손님이 많은 곳</h4>
          <ol className="al-dests">
            {dests.map((d) => {
              const mineRoute = routeOnPair(me, city, d.id);
              return (
                <li key={d.id}>
                  <button type="button" className="al-link" onClick={() => onPlanRoute(city, d.id)} disabled={!canAct && !mineRoute}>
                    {CITY[d.id].name}
                  </button>
                  <small>
                    {km(d.d)} · 주 {fmtPax(d.demand)}
                    {mineRoute ? ' · ✓ 내 노선' : me.branches.includes(d.id) ? ' · 지점 있음' : ''}
                  </small>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ 노선

function RoutePanel({ state, viewer, canAct, onEditRoute, onPlanRoute, onSelect, company, route }: Common & { company: number; route: number }) {
  const owner = state.companies[company];
  const r = owner?.routes.find((x) => x.id === route);
  if (!owner || !r) return <Overview {...{ state, viewer, canAct, perform: () => {}, setState: () => {}, onPlanRoute, onEditRoute, onSelect }} />;
  const key = pairKey(r.a, r.b);
  const me = state.companies[viewer];
  const ops = state.companies
    .map((co, i) => ({ co, i, rt: co.out ? undefined : co.routes.find((x) => pairKey(x.a, x.b) === key) }))
    .filter((x) => x.rt);
  const d = dist(r.a, r.b);
  const dem = pairDemand(state, r.a, r.b);
  const mine = ops.find((x) => x.i === viewer);
  return (
    <div className="al-info al-route-info" data-testid="al-route-panel">
      <div className="al-info-main">
        <header className="al-info-head">
          <span className="al-landmark" aria-hidden="true">
            ✈️
          </span>
          <div>
            <h3>
              {CITY[r.a].name} ⇄ {CITY[r.b].name} <small>{km(d)}</small>
            </h3>
            <p>
              한 방향 주간 잠재 손님 {fmtPax(dem.biz + dem.leisure)} (사업 {pct(dem.biz / (dem.biz + dem.leisure))}) · 이 두 도시를 나는 회사 {ops.length}곳
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-small al-close" onClick={() => onSelect(null)} aria-label="닫기 (Esc)">
            ✕
          </button>
        </header>
        <table className="al-table al-ops">
          <thead>
            <tr>
              <th>회사</th>
              <th>비행기 · 주간 왕복</th>
              <th>운임</th>
              <th>탑승률</th>
              <th>몫</th>
              <th>지난 분기 이익</th>
            </tr>
          </thead>
          <tbody>
            {ops.map(({ co, i, rt }) => {
              const planes = co.planes.filter((p) => p.route === rt!.id);
              const st = rt!.stats;
              return (
                <tr key={i} className={i === viewer ? 'al-row-mine' : ''}>
                  <td>
                    <CoName c={co} />
                  </td>
                  <td>{planes.length === 0 ? '비행기 없음' : planes.map((p) => `${MODEL[p.model].name}×${p.freq}`).join(', ')}</td>
                  <td>{rt!.fare === 0 ? '보통' : `${rt!.fare > 0 ? '+' : ''}${rt!.fare}%`}</td>
                  <td>
                    {st ? (
                      <>
                        <LoadMeter lf={st.lf} /> {pct(st.lf)}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{st ? pct(st.share) : '—'}</td>
                  <td className={st && st.profit < 0 ? 'al-neg' : 'al-pos'}>{st ? signedMoney(st.profit) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="al-info-side">
        {mine ? (
          <ActButton primary blocker={null} onClick={() => onEditRoute(mine.rt!.id)} testId="al-edit-route">
            🛠️ 노선 계획에서 고치기
          </ActButton>
        ) : (
          <>
            <ActButton primary blocker={canAct ? null : notMine} onClick={() => onPlanRoute(r.a, r.b)}>
              ✈️ 나도 이 노선 열기
            </ActButton>
            <small className="al-muted">
              {me.branches.includes(r.a) && me.branches.includes(r.b) ? '두 도시 모두 지점이 있어요.' : '지점이 없는 도시는 노선을 열 때 함께 열 수 있어요.'}
            </small>
          </>
        )}
        <p className="al-muted al-tip">손님은 운임이 싸고, 자주 날고, 새롭고 편한 비행기를 띄우고, 평판·광고가 좋은 회사를 더 많이 골라요.</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ 아무것도 고르지 않았을 때

function Overview({ state, viewer, canAct, setState, onPlanRoute, onSelect }: Common) {
  const me = state.companies[viewer];
  const tips = useMemo(() => (canAct ? suggestRoutes(state, viewer, 4) : []), [state, viewer, canAct]);
  const color = SEAT_COLORS[me.seat];
  const flying = me.planes.filter((p) => p.route !== null && p.freq > 0).length;
  const open = (cand: Candidate, buy: boolean) => setState(openSuggestion(state, viewer, cand, buy));
  return (
    <div className="al-info al-overview">
      <div className="al-info-main">
        <h3>
          💡 추천 노선 <small>지금 비행기로 어림한 이번 분기 이익</small>
        </h3>
        {!canAct ? (
          <p className="al-muted">내 차례가 되면 추천 노선을 보여 줄게요. 그동안 지도와 보고서를 둘러보세요.</p>
        ) : tips.length === 0 ? (
          <p className="al-muted">지금은 이익이 날 만한 새 노선이 잘 안 보여요. 돈이 모이면 다시 살펴보거나, 지도에서 도시를 눌러 직접 찾아보세요.</p>
        ) : (
          <ul className="al-tips">
            {tips.map((t) => {
              const m = t.model;
              const deposit = leaseDeposit(state, m);
              const need = t.needBranch.reduce((s, c) => s + branchCost(c, state.q), 0);
              return (
                <li key={`${t.a}-${t.b}`}>
                  <PlaneArt body={m.body} engines={m.engines} color={color.main} dark={color.dark} shape={SEAT_SHAPES[me.seat]} width={64} />
                  <div className="al-tip-text">
                    <button type="button" className="al-link" onClick={() => onSelect({ kind: 'city', id: t.b === me.hub ? t.a : t.b })}>
                      {CITY[t.a].name} ⇄ {CITY[t.b].name}
                    </button>
                    <small>
                      {m.name} 주 {t.freq}회 · 예상 이익 <b className="al-pos">{signedMoney(t.profit)}</b>/분기
                      {t.needBranch.length > 0 && ` · 지점 ${t.needBranch.map((c) => CITY[c].name).join('·')} ${fmtMoney(need)}`}
                    </small>
                  </div>
                  <div className="al-tip-acts">
                    <button type="button" className="btn btn-small btn-primary" onClick={() => open(t, false)} title={`계약금 ${fmtMoney(deposit)} + 지점`} data-testid="al-tip-lease">
                      리스로 열기
                    </button>
                    <button type="button" className="btn btn-small" onClick={() => onPlanRoute(t.a, t.b)}>
                      자세히
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="al-info-side">
        <h4>내 회사 한눈에</h4>
        <ul className="al-facts">
          <li>
            본사 <b>{CITY[me.hub].name}</b>
          </li>
          <li>
            지점 <b>{me.branches.length}</b>곳 · 노선 <b>{me.routes.length}</b>개
          </li>
          <li>
            비행기 <b>{me.planes.length}</b>대 (나는 중 {flying})
          </li>
          <li>
            평판 <b>{Math.round(me.reputation)}</b> · 서비스 {me.service}단계
          </li>
        </ul>
        <p className="al-muted al-tip">
          지도에서 도시를 누르면 도시 정보와 지점 열기, 노선을 누르면 탑승률과 라이벌이 보여요. 끌어서 옮기고 휠로 확대해요.
        </p>
        {canAct && (
          <button type="button" className="btn btn-small" onClick={() => onPlanRoute(me.hub)}>
            ✈️ {CITY[me.hub].name}에서 새 노선 찾기
          </button>
        )}
      </div>
    </div>
  );
}
