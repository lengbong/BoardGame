import { useMemo } from 'react';
import { MODEL } from './aircraft';
import { advise } from './advisor';
import { LandmarkIcon } from './Art';
import { SEASON_NAMES, WEATHER_INFO, leisureMonthMult, weather } from './calendar';
import { AIRPORT_INFO, CITIES, CITY, FEE_INFO, REGION_INFO, airportClass, citySize, dist, pairKey } from './cities';
import { FIXED_EVENTS, FIXED_ICON } from './events';
import { fmtMoney, fmtPax, km, pct, signedMoney } from './format';
import { goalProgress } from './goals';
import { branchBlocker, buildBlocker, closeBranchBlocker, routeOnPair } from './rules';
import { WEEK_HOURS, branchCost, branchUpkeep, businessCost, legFreq, pairDemand, planeHours, planesOnRoute, routeFreq, slotCapacity, slotsUsed } from './simulate';
import { monthOf, yearOf } from './time';
import type { AirlineAction, AirlineState } from './types';
import { cityPhoto } from './images';
import { ActButton, CoName, LoadMeter, Meter, Photo, Stars } from './ui';
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
  onOpenChoice: () => void;
  onAuto?: () => void;
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
  const xfers = (state.report?.xfers ?? []).filter((x) => x.via === city).slice(0, 4);
  const through = state.companies
    .flatMap((co, i) => (co.out ? [] : co.routes.filter((r) => r.a === city || r.b === city).map((r) => ({ co, i, r }))))
    .sort((x, y) => Number(y.i === viewer) - Number(x.i === viewer) || routeFreq(y.co, y.r.id) - routeFreq(x.co, x.r.id))
    .slice(0, 8);
  const hotel = me.businesses.find((b) => b.city === city && b.kind === 'hotel');
  const agency = me.businesses.find((b) => b.city === city && b.kind === 'agency');
  const m0 = monthOf(state.t) - 1;
  const season = Array.from({ length: 12 }, (_, i) => leisureMonthMult(city, i));
  const wx = weather(city, m0);

  return (
    <div className="al-info al-city-info" data-testid="al-city-panel">
      <div className="al-info-main">
        <header className="al-info-head">
          <Photo
            src={cityPhoto(city)}
            credit={`cities/${city}`}
            alt={`${c.name} 사진`}
            ratio="4 / 3"
            className="al-city-photo"
            fallback={
              <span className="al-landmark" aria-hidden="true">
                <LandmarkIcon kind={c.landmark} size={34} />
              </span>
            }
          />
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
                  <span key={i} className={i === m0 ? 'al-season-now' : ''} style={{ height: `${Math.round(m * 9)}px` }} title={`${i + 1}월 관광 손님 ×${m.toFixed(2)}`} />
                ))}
              </span>
              {SEASON_NAMES[c.season]}
            </dd>
          </div>
          <div>
            <dt>이번 달 날씨</dt>
            <dd>{wx.cause ? `${WEATHER_INFO[wx.cause].icon} ${WEATHER_INFO[wx.cause].name} 걱정 (지연·결항 ×${wx.factor.toFixed(1)})` : '☀️ 대체로 괜찮아요'}</dd>
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
              <small className="al-muted">유지비 달마다 {fmtMoney(branchUpkeep(city, state.q))}. 지점이 있어야 노선을 열 수 있어요.</small>
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
        {xfers.length > 0 && (
          <section>
            <h4>여기서 갈아타는 손님 <small className="al-muted">지난달</small></h4>
            <ol className="al-dests">
              {xfers.map((x) => (
                <li key={`${x.a}-${x.b}`}>
                  <span>
                    {CITY[x.a].name} → {CITY[x.b].name}
                  </span>
                  <small>
                    {fmtPax(x.pax)} · {x.companies.map((ci) => state.companies[ci].name).join('·')}
                  </small>
                </li>
              ))}
            </ol>
          </section>
        )}
        {through.length > 0 && (
          <section>
            <h4>이 도시를 지나는 노선</h4>
            <ul className="al-through">
              {through.map(({ co, i, r }) => (
                <li key={`${i}-${r.id}`}>
                  <button type="button" className="al-link" onClick={() => onSelect({ kind: 'route', company: i, route: r.id })}>
                    <CoName c={co} /> {CITY[r.a === city ? r.b : r.a].name}
                  </button>
                  <small>
                    주 {routeFreq(co, r.id)}회{r.stats ? ` · 탑승률 ${pct(r.stats.lf)}` : ''}
                  </small>
                </li>
              ))}
            </ul>
          </section>
        )}
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
  if (!owner || !r) return <Overview {...{ state, viewer, canAct, perform: () => {}, setState: () => {}, onPlanRoute, onEditRoute, onSelect, onOpenChoice: () => {} }} />;
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
              <th>지난달 이익</th>
            </tr>
          </thead>
          <tbody>
            {ops.map(({ co, i, rt }) => {
              const planes = planesOnRoute(co, rt!.id);
              const st = rt!.stats;
              return (
                <tr key={i} className={i === viewer ? 'al-row-mine' : ''}>
                  <td>
                    <CoName c={co} />
                  </td>
                  <td>{planes.length === 0 ? '비행기 없음' : planes.map((p) => `${MODEL[p.model].name}×${legFreq(p, rt!.id)}`).join(', ')}</td>
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
        {r.stats && r.stats.xfer > 0 && (
          <p className="al-muted">
            {owner.name}의 이 노선에는 갈아타는 손님도 주 {fmtPax(r.stats.xfer)}씩 타요.
          </p>
        )}
        <p className="al-muted al-tip">손님은 운임이 싸고, 자주 날고, 새롭고 편한 비행기를 띄우고, 평판·광고가 좋은 회사를 더 많이 골라요.</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ 아무것도 고르지 않았을 때

function Overview({ state, viewer, canAct, setState, onPlanRoute, onOpenChoice, onAuto }: Common) {
  const me = state.companies[viewer];
  const tips = useMemo(() => (canAct ? advise(state, viewer) : []), [state, viewer, canAct]);
  const flying = me.planes.filter((p) => p.legs.length > 0);
  const use = flying.length ? flying.reduce((s, p) => s + planeHours(me, p), 0) / (flying.length * WEEK_HOURS) : 0;
  const first = state.q - state.startQ < 4;
  return (
    <div className="al-info al-overview">
      <div className="al-info-main">
        <h3>
          🧑‍💼 경영 비서 <small>지난달 숫자로 고른 할 만한 일</small>
        </h3>
        {!canAct ? (
          <p className="al-muted">내 차례가 되면 할 만한 일을 골라 드릴게요. 그동안 지도와 보고서를 둘러보세요.</p>
        ) : tips.length === 0 ? (
          <p className="al-muted">지금은 딱히 고칠 곳이 없어요. 지도에서 도시를 눌러 새 노선을 찾아보거나 차례를 마치세요.</p>
        ) : (
          <ul className="al-tips al-advice" data-testid="al-advice">
            {tips.map((t) => (
              <li key={t.key}>
                <span className="al-tip-icon" aria-hidden="true">
                  {t.icon}
                </span>
                <div className="al-tip-text">
                  <b>{t.title}</b>
                  <small>{t.detail}</small>
                </div>
                <div className="al-tip-acts">
                  {t.key === 'choice' ? (
                    <button type="button" className="btn btn-small btn-primary" onClick={onOpenChoice}>
                      고르기
                    </button>
                  ) : t.key === 'auto' && onAuto ? (
                    <button type="button" className="btn btn-small" onClick={onAuto}>
                      {t.label}
                    </button>
                  ) : t.apply ? (
                    <button
                      type="button"
                      className="btn btn-small btn-primary"
                      onClick={() => {
                        const next = t.apply!(state);
                        if (next !== state) setState(next);
                      }}
                      data-testid="al-advice-apply"
                    >
                      {t.label ?? '적용'}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {canAct && first && <p className="al-muted al-tip">처음 한 해는 비서가 권하는 대로 해 봐도 좋아요. 첫해에는 리스 보증금이 없어요.</p>}
      </div>
      <div className="al-info-side">
        <h4>내 회사 한눈에</h4>
        <ul className="al-facts">
          <li>
            본사 <b>{CITY[me.hub].name}</b> · 지점 <b>{me.branches.length}</b>곳 · 노선 <b>{me.routes.length}</b>개
          </li>
          <li>
            비행기 <b>{me.planes.length}</b>대 (가동률 {Math.round(use * 100)}%){me.orders.length > 0 && ` · 주문 ${me.orders.length}`}
          </li>
          <li>
            평판 <b>{Math.round(me.reputation)}</b> · 서비스 {me.service}단계 · 정시 운항 <b>{Math.round(me.onTime * 100)}%</b>
            {me.partner !== null && ` · 제휴 ${state.companies[me.partner].name}`}
          </li>
        </ul>
        {me.goals.length > 0 && (
          <>
            <h4>올해 목표</h4>
            <ul className="al-goals-mini">
              {me.goals.map((g) => {
                const v = goalProgress(state, viewer, g);
                return (
                  <li key={g.kind}>
                    <span>
                      {v >= 1 ? '✅' : '🎯'} {g.text}
                    </span>
                    <Meter value={v} tone={v >= 1 ? 'good' : 'blue'} label={`${g.text} ${Math.round(v * 100)}%`} />
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {canAct && (
          <button type="button" className="btn btn-small" onClick={() => onPlanRoute(me.hub)}>
            ✈️ {CITY[me.hub].name}에서 새 노선 찾기
          </button>
        )}
      </div>
    </div>
  );
}
