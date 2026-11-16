import { useMemo, useState } from 'react';
import { MODEL } from './aircraft';
import { advise, applyAdvice, applyAdviceAll, batchable, topAdvice, type Advice } from './advisor';
import { BUSINESS_INFO, BUSINESS_KINDS } from './business';
import { FacilityRow } from './FacilityCard';
import { allianceOf, alliesOf } from './alliances';
import { LandmarkIcon } from './Art';
import { AirportCard, AirportModal } from './AirportView';
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
import { ActButton, CoName, LoadMeter, Photo } from './ui';
import type { Selection } from './MapView';
import { coColors } from './brand';
import { FinIcon, ProgressRing } from './FinanceArt';
import { AnyIconView, MapIcon, MiniBar, MixBar, RouteArt, SeasonChart, ShareStack, StarRow, StatRing, UseBar, adviceIcon, weatherIcon, type Tone } from './MapArt';
import { MoreInfo, StaffIcon } from './StaffArt';
import './map-panel.css';

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
  /** 안 되는 까닭을 알림으로 보여 준다 */
  onSay?: (text: string) => void;
  /** 움직이는 연출을 켰는지 (공항 이착륙) */
  fx?: boolean;
}

const notMine = '내 차례에만 할 수 있어요';

export function InfoPanel(props: Common & { selected: Selection }) {
  const { selected } = props;
  if (selected?.kind === 'city') return <CityPanel {...props} city={selected.id} />;
  if (selected?.kind === 'route') return <RoutePanel {...props} company={selected.company} route={selected.route} />;
  return <Overview {...props} />;
}

// ------------------------------------------------------------------ 도시

function CityPanel({ state, viewer, canAct, perform, onPlanRoute, onSelect, city, fx = true }: Common & { city: string }) {
  const c = CITY[city];
  const [airportOpen, setAirportOpen] = useState(false);
  // 여러 공항이 있는 도시에서 탭으로 고른 공항 (도시를 바꾸면 대표 공항부터)
  const [aptPick, setAptPick] = useState<{ city: string; icao: string } | null>(null);
  const aptIcao = aptPick?.city === city ? aptPick.icao : undefined;
  const pickApt = (icao: string) => setAptPick({ city, icao });
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
  const kinds = BUSINESS_KINDS.filter((k) => BUSINESS_INFO[k].why(c, size) === null || me.businesses.some((b) => b.city === city && b.kind === k));
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
        <AirportCard key={city} state={state} viewer={viewer} city={city} fx={fx} icao={aptIcao} onPick={pickApt} onOpen={() => setAirportOpen(true)} paused={airportOpen} />
        {airportOpen && <AirportModal state={state} viewer={viewer} city={city} fx={fx} icao={aptIcao} onPick={pickApt} onClose={() => setAirportOpen(false)} />}
        <div className="al-mp-tiles">
          <div className="al-mp-tile">
            <StatRing value={size / 10} text={size.toFixed(1)} tone="blue" size={44} label={`도시 크기 ${size.toFixed(1)} / 10`} />
            <span>
              <small>도시 크기</small>
              <b>
                {size.toFixed(1)}
                <small className="al-muted"> / 10</small>
              </b>
              {later > size + 0.4 && (
                <small className="al-up" title="10년 뒤 더 커져요">
                  <MapIcon kind="up" size={12} /> 10년 뒤 {later.toFixed(1)}
                </small>
              )}
            </span>
          </div>
          <div className="al-mp-tile">
            <span className="al-mp-tile-icon al-mp-ink-gold">
              <FinIcon kind="star" size={22} />
            </span>
            <span>
              <small>관광 매력</small>
              <StarRow value={c.fun} label={`관광 매력 ${c.fun} / 10`} />
              <small className="al-muted">{c.fun} / 10</small>
            </span>
          </div>
          <div className={`al-mp-tile${wx.cause ? ' al-mp-tile-warn' : ''}`}>
            <span className={`al-mp-tile-icon ${wx.cause ? 'al-mp-ink-warn' : 'al-mp-ink-gold'}`}>
              <MapIcon kind={weatherIcon(wx.cause)} size={22} />
            </span>
            <span>
              <small>이번 달 날씨</small>
              <b>{wx.cause ? `${WEATHER_INFO[wx.cause].name} 걱정` : '대체로 괜찮아요'}</b>
              {wx.cause && <small className="al-muted">지연·결항 ×{wx.factor.toFixed(1)}</small>}
            </span>
          </div>
          <div className="al-mp-tile">
            <span className="al-mp-tile-icon">
              <FinIcon kind="tower" size={22} />
            </span>
            <span>
              <small>공항</small>
              <b>{AIRPORT_INFO[cls].name}</b>
              <small className="al-muted">{cls >= 4 ? '모든 비행기' : cls === 3 ? '점보까지' : cls === 2 ? '중형까지' : '작은 비행기만'}</small>
            </span>
          </div>
          <div className="al-mp-tile">
            <span className="al-mp-tile-icon">
              <MapIcon kind="gate" size={22} />
            </span>
            <span className="al-mp-tile-grow">
              <small>내 슬롯{me.hub === city ? ' (본사 2배)' : ''}</small>
              <b>
                주 {slotsUsed(me, city)} <small className="al-muted">/ {slotCapacity(state, viewer, city)}회</small>
              </b>
              <UseBar used={slotsUsed(me, city)} total={slotCapacity(state, viewer, city)} label={`내 슬롯 주 ${slotsUsed(me, city)} / ${slotCapacity(state, viewer, city)}회`} />
            </span>
          </div>
          <div className="al-mp-tile">
            <span className="al-mp-tile-icon">
              <FinIcon kind="coin" size={22} />
            </span>
            <span>
              <small>공항 이용료</small>
              <b>{FEE_INFO[c.fee].name}</b>
            </span>
          </div>
        </div>
        <div className="al-mp-charts">
          <figure className="al-mp-fig">
            <figcaption>손님 성격</figcaption>
            <MixBar biz={c.biz} />
          </figure>
          <figure className="al-mp-fig">
            <figcaption>
              관광 손님 달마다 <small className="al-muted">{SEASON_NAMES[c.season]}</small>
            </figcaption>
            <SeasonChart values={season} current={m0} label={`${SEASON_NAMES[c.season]}, 이번 달 관광 손님 ×${season[m0].toFixed(2)}`} />
          </figure>
        </div>
        {(events.length > 0 || effects.length > 0) && (
          <div className="al-mp-news">
            <FinIcon kind="megaphone" size={16} />
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
          </div>
        )}
      </div>
      <div className="al-info-side">
        <section>
          <h4 className="al-mp-h4">
            <FinIcon kind="building" size={15} /> 여기 있는 회사
          </h4>
          {here.length === 0 ? (
            <p className="al-muted">아직 아무도 없어요.</p>
          ) : (
            <ul className="al-here">
              {here.map(({ co, i }) => (
                <li key={i}>
                  <CoName c={co} />
                  {co.hub === city ? (
                    <span className="tag al-mp-tag">
                      <MapIcon kind="hub" size={12} /> 본사
                    </span>
                  ) : (
                    <span className="tag al-mp-tag">
                      <FinIcon kind="building" size={12} /> 지점
                    </span>
                  )}
                  <small className="al-mp-inline">
                    <MapIcon kind="route" size={13} /> 노선 {co.routes.filter((r) => r.a === city || r.b === city).length}개
                  </small>
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
              <small className="al-muted al-mp-inline">
                <FinIcon kind="coin" size={13} /> 유지비 달마다 {fmtMoney(branchUpkeep(city, state.q))} · 지점이 있어야 노선을 열 수 있어요
              </small>
            </>
          ) : (
            <>
              <ActButton primary blocker={canAct ? null : notMine} onClick={() => onPlanRoute(city)} testId="al-plan-from">
                ✈️ 여기서 노선 열기
              </ActButton>
              <div className="al-biz-row" aria-label="부대사업">
                {kinds.map((k) => {
                  const info = BUSINESS_INFO[k];
                  return me.businesses.some((b) => b.city === city && b.kind === k) ? (
                    <span key={k} className="tag" title={info.desc}>
                      {info.icon} {info.name} 운영 중
                    </span>
                  ) : (
                    <ActButton key={k} small blocker={block(buildBlocker(state, viewer, city, k))} onClick={() => perform({ type: 'build', city, kind: k })} title={info.desc} testId={`al-build-${k}`}>
                      {info.icon} {info.name} {fmtMoney(businessCost(city, k, state.q))}
                    </ActButton>
                  );
                })}
              </div>
              <FacilityRow state={state} viewer={viewer} city={city} canAct={canAct} perform={perform} />
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
            <h4 className="al-mp-h4">
              <MapIcon kind="xfer" size={15} /> 여기서 갈아타는 손님 <small className="al-muted">지난달</small>
            </h4>
            <ol className="al-dests al-mp-bars">
              {xfers.map((x) => (
                <li key={`${x.a}-${x.b}`}>
                  <span className="al-mp-bar-name">
                    {CITY[x.a].name} → {CITY[x.b].name}
                  </span>
                  <MiniBar value={x.pax / Math.max(1, ...xfers.map((y) => y.pax))} className="al-mp-mini-xfer" />
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
            <h4 className="al-mp-h4">
              <MapIcon kind="route" size={15} /> 이 도시를 지나는 노선
            </h4>
            <ul className="al-through">
              {through.map(({ co, i, r }) => (
                <li key={`${i}-${r.id}`}>
                  <button type="button" className="al-link" onClick={() => onSelect({ kind: 'route', company: i, route: r.id })}>
                    <CoName c={co} /> {CITY[r.a === city ? r.b : r.a].name}
                  </button>
                  <small className="al-mp-inline">
                    주 {routeFreq(co, r.id)}회
                    {r.stats && (
                      <>
                        {' · '}
                        <LoadMeter lf={r.stats.lf} /> {pct(r.stats.lf)}
                      </>
                    )}
                  </small>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <h4 className="al-mp-h4">
            <FinIcon kind="people" size={15} /> 여기서 손님이 많은 곳 <small className="al-muted">한 방향 주간</small>
          </h4>
          <ol className="al-dests al-mp-bars">
            {dests.map((d) => {
              const mineRoute = routeOnPair(me, city, d.id);
              const top = Math.max(1, dests[0]?.demand ?? 1);
              return (
                <li key={d.id}>
                  <button type="button" className="al-link al-mp-bar-name" onClick={() => onPlanRoute(city, d.id)} disabled={!canAct && !mineRoute}>
                    {CITY[d.id].name}
                  </button>
                  <MiniBar value={d.demand / top} className={mineRoute ? 'al-mp-mini-mine' : 'al-mp-mini-fill'} label={`${CITY[d.id].name} 주 ${fmtPax(d.demand)}`} />
                  <small>
                    {fmtPax(d.demand)} · {km(d.d)}
                    {mineRoute ? (
                      <b className="al-pos"> · ✓ 내 노선</b>
                    ) : me.branches.includes(d.id) ? (
                      ' · 지점 있음'
                    ) : (
                      ''
                    )}
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
          <RouteArt />
          <div>
            <h3>
              {CITY[r.a].name} ⇄ {CITY[r.b].name} <small>{km(d)}</small>
            </h3>
            <p>두 도시를 오가는 손님과 이 노선을 나는 회사들이에요.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-small al-close" onClick={() => onSelect(null)} aria-label="닫기 (Esc)">
            ✕
          </button>
        </header>
        <div className="al-mp-tiles al-mp-tiles-route">
          <div className="al-mp-tile">
            <span className="al-mp-tile-icon">
              <MapIcon kind="route" size={22} />
            </span>
            <span>
              <small>거리</small>
              <b>{km(d)}</b>
            </span>
          </div>
          <div className="al-mp-tile">
            <span className="al-mp-tile-icon">
              <FinIcon kind="people" size={22} />
            </span>
            <span>
              <small>잠재 손님 (한 방향 주간)</small>
              <b>{fmtPax(dem.biz + dem.leisure)}</b>
            </span>
          </div>
          <div className="al-mp-tile">
            <span className="al-mp-tile-icon">
              <FinIcon kind="plane" size={22} />
            </span>
            <span>
              <small>나는 회사</small>
              <b>{ops.length}곳</b>
            </span>
          </div>
        </div>
        <div className="al-mp-charts">
          <figure className="al-mp-fig">
            <figcaption>손님 성격</figcaption>
            <MixBar biz={dem.biz / Math.max(1e-9, dem.biz + dem.leisure)} />
          </figure>
          {ops.some(({ rt }) => rt!.stats) && (
            <figure className="al-mp-fig">
              <figcaption>회사마다 손님 몫 <small className="al-muted">지난달</small></figcaption>
              <ShareStack
                parts={ops.map(({ co, rt }) => ({ name: co.name, v: rt!.stats?.share ?? 0, color: coColors(co).main }))}
                label={`손님 몫: ${ops.map(({ co, rt }) => `${co.name} ${rt!.stats ? pct(rt!.stats.share) : '—'}`).join(', ')}`}
              />
              <ul className="al-hc-legend">
                {ops.map(({ co, i, rt }) => (
                  <li key={i}>
                    <i className="al-sw" style={{ background: coColors(co).main }} /> {co.name} {rt!.stats ? pct(rt!.stats.share) : '—'}
                  </li>
                ))}
              </ul>
            </figure>
          )}
        </div>
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
          <p className="al-muted al-mp-note">
            <MapIcon kind="xfer" size={15} /> {owner.name}의 이 노선에는 갈아타는 손님도 주 {fmtPax(r.stats.xfer)}씩 타요.
          </p>
        )}
        <h4 className="al-mp-h4">손님이 회사를 고르는 기준</h4>
        <ul className="al-mp-why">
          <li>
            <FinIcon kind="tag" size={16} /> 싼 운임
          </li>
          <li>
            <StaffIcon kind="clock" size={16} /> 자주 나는 편
          </li>
          <li>
            <FinIcon kind="plane" size={16} /> 새롭고 편한 비행기
          </li>
          <li>
            <FinIcon kind="star" size={16} /> 평판·광고
          </li>
        </ul>
        <MoreInfo>손님은 운임이 싸고, 자주 날고, 새롭고 편한 비행기를 띄우고, 평판·광고가 좋은 회사를 더 많이 골라요.</MoreInfo>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ 아무것도 고르지 않았을 때

/** 경영 비서가 처음에 보여 주는 권유 수 (‘더 보기’를 누르면 ADVICE_MAX까지) */
const ADVICE_SHOW = 5;
const ADVICE_MAX = 10;
const EMPTY_KEYS: ReadonlySet<string> = new Set();

/** 이번 달에 한 경영 비서 권유: 그 자리에 '✓ 했어요'로 남기고, 다음 달 숫자가 나올 때까지 다시 권하지 않는다 */
interface DoneTip {
  key: string;
  icon: string;
  title: string;
  detail: string;
  /** 할 때 목록에서 몇 번째였는지 (그 자리에 남긴다) */
  at: number;
}

/** 한 권유 기억 (탭을 옮겨 다시 그려도 남게 모듈에 둔다). 판·달·회사가 바뀌면 새로 */
let doneMemo: { id: string; tips: DoneTip[] } | null = null;
const NO_DONE: DoneTip[] = [];

function Overview({ state, viewer, canAct, setState, onPlanRoute, onOpenChoice, onAuto, onSay }: Common) {
  // 적용이 안 된 권유와 그 까닭 (상태가 바뀌면 사라진다)
  const [fail, setFail] = useState<{ state: AirlineState; key: string; why: string } | null>(null);
  // 한꺼번에 하기에서 뺀 권유 (처음엔 모두 고른다). 달이 바뀌면 다시 모두 고른다
  const [offAt, setOffAt] = useState<{ t: number; keys: ReadonlySet<string> }>(() => ({ t: state.t, keys: new Set() }));
  const off = offAt.t === state.t ? offAt.keys : EMPTY_KEYS;
  const setOff = (fn: (cur: ReadonlySet<string>) => ReadonlySet<string>) => setOffAt({ t: state.t, keys: fn(off) });
  const [more, setMore] = useState(false);
  // 한꺼번에 한 결과 (그 결과 상태일 때만 보인다)
  const [batch, setBatch] = useState<{ state: AirlineState; done: number; failed: { title: string; why: string }[] } | null>(null);
  const me = state.companies[viewer];
  const [, redraw] = useState(0);
  const doneId = `${state.startT}:${state.t}:${viewer}:${me.name}`;
  const done = doneMemo?.id === doneId ? doneMemo.tips : NO_DONE;
  const all = useMemo(() => (canAct ? advise(state, viewer, ADVICE_MAX, done) : []), [state, viewer, canAct, done]);
  // 한 만큼 새 권유 자리는 줄이되 둘은 남긴다 (한 줄이 쌓여 목록이 끝없이 길어지지 않게)
  const tips = useMemo(() => (more ? all : topAdvice(all, Math.max(2, ADVICE_SHOW - done.length))), [all, more, done]);
  const hidden = all.length - tips.length;
  // 한 줄은 할 때 자리에 끼워 넣는다
  const rows = useMemo(() => {
    const list: ({ done: false; t: Advice } | { done: true; d: DoneTip })[] = tips.map((t) => ({ done: false, t }));
    if (canAct) for (const d of [...done].sort((x, y) => x.at - y.at)) list.splice(Math.min(d.at, list.length), 0, { done: true, d });
    return list;
  }, [tips, done, canAct]);
  const markDone = (list: readonly Advice[]) => {
    if (list.length === 0) return;
    const add = list.map((t) => ({ key: t.key, icon: t.icon, title: t.title, detail: t.detail, at: Math.max(0, rows.findIndex((r) => !r.done && r.t.key === t.key)) }));
    doneMemo = { id: doneId, tips: [...done, ...add] };
    redraw((n) => n + 1);
  };
  // 지금 적용할 수 없는 권유는 미리 해 보고 까닭을 적어 둔다 (버튼을 흐리게)
  const blockedWhy = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tips) {
      if (!t.apply || t.key === 'choice' || t.key === 'auto') continue;
      const why = applyAdvice(t, state).why;
      if (why) m.set(t.key, why);
    }
    return m;
  }, [tips, state]);
  const doable = tips.filter((t) => batchable(t) && !blockedWhy.has(t.key));
  const chosen = doable.filter((t) => !off.has(t.key));
  const chosenGain = chosen.reduce((sum, t) => sum + Math.max(0, t.gain ?? 0), 0);
  const showBatch = doable.length >= 2;
  const toggle = (key: string) =>
    setOff((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const runBatch = () => {
    const res = applyAdviceAll(chosen, state);
    const failed = res.failed.map((f) => ({ title: f.advice.title, why: f.why }));
    if (res.done.length > 0) {
      markDone(res.done);
      setState(res.state);
    }
    setBatch({ state: res.state, done: res.done.length, failed });
    // 한 결과는 목록 위에 보여 준다. 하나도 못 했을 때만 알림으로도 알린다
    if (res.done.length === 0) onSay?.(`경영 비서: 하나도 못 했어요 — ${failed[0]?.why ?? '지금은 할 수 없어요'}`);
  };
  const flying = me.planes.filter((p) => p.legs.length > 0);
  const use = flying.length ? flying.reduce((s, p) => s + planeHours(me, p), 0) / (flying.length * WEEK_HOURS) : 0;
  const first = state.q - state.startQ < 4;
  const meal = me.planes.length > 0 ? me.planes.reduce((t, p) => t + p.meal, 0) / me.planes.length : me.service;
  const useTone: Tone = use >= 0.55 ? 'good' : use >= 0.3 ? 'warn' : 'bad';
  const repTone: Tone = me.reputation >= 60 ? 'good' : me.reputation >= 40 ? 'warn' : 'bad';
  const onTone: Tone = me.onTime >= 0.85 ? 'good' : me.onTime >= 0.7 ? 'warn' : 'bad';
  return (
    <div className="al-info al-overview">
      <div className="al-info-main">
        <h3 className="al-mp-h3">
          <StaffIcon kind="people" size={20} /> 경영 비서 <small>지난달 숫자로 고른 할 만한 일</small>
        </h3>
        {!canAct ? (
          <p className="al-muted">내 차례가 되면 할 만한 일을 골라 드릴게요. 그동안 지도와 보고서를 둘러보세요.</p>
        ) : rows.length === 0 ? (
          <p className="al-muted">지금은 딱히 고칠 곳이 없어요. 지도에서 도시를 눌러 새 노선을 찾아보거나 차례를 마치세요.</p>
        ) : (
          <>
            {showBatch && (
              <div className="al-advice-batch" data-testid="al-advice-batch">
                <label className="al-advice-all">
                  <input
                    type="checkbox"
                    checked={chosen.length === doable.length}
                    ref={(el) => {
                      if (el) el.indeterminate = chosen.length > 0 && chosen.length < doable.length;
                    }}
                    onChange={() => setOff(() => (chosen.length === doable.length ? new Set(doable.map((t) => t.key)) : new Set()))}
                  />
                  모두 고르기
                </label>
                <span className="al-advice-batch-sum">
                  {chosen.length}개 고름{chosenGain > 0 && <small> · 달 이익 약 +{fmtMoney(chosenGain)}</small>}
                </span>
                <button type="button" className="btn btn-small btn-primary" disabled={chosen.length === 0} onClick={runBatch} data-testid="al-advice-batch-run">
                  고른 {chosen.length}개 한꺼번에 하기
                </button>
              </div>
            )}
            {batch && batch.state === state && (
              <div className={`al-advice-result${batch.failed.length ? ' al-has-fail' : ''}`} role="status" data-testid="al-advice-result">
                <b>{batch.done > 0 ? `✓ ${batch.done}개를 했어요` : '하나도 못 했어요'}</b>
                {batch.failed.length > 0 && (
                  <ul>
                    {batch.failed.map((f) => (
                      <li key={f.title}>
                        ⚠ {f.title}: {f.why}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <ul className="al-tips al-advice" data-testid="al-advice">
              {rows.map((row) => {
                if (row.done) {
                  const d = row.d;
                  const ic = adviceIcon(d.key);
                  return (
                    <li key={`done-${d.key}`} className="al-tip-done" data-testid="al-advice-done">
                      {showBatch && <span className="al-tip-pick" />}
                      <span className="al-tip-icon al-mp-tip-icon" aria-hidden="true">
                        {ic ? <AnyIconView icon={ic} size={22} /> : d.icon}
                      </span>
                      <div className="al-tip-text">
                        <b>{d.title}</b>
                        <small>{d.detail}</small>
                      </div>
                      <div className="al-tip-acts">
                        <span className="al-tip-done-mark" title="이번 달에 했어요. 다음 달 숫자가 나오면 다시 살펴볼게요">
                          ✓ 했어요
                        </span>
                      </div>
                    </li>
                  );
                }
                const t = row.t;
                const canPick = showBatch && doable.includes(t);
                return (
                  <li key={t.key} className={canPick && off.has(t.key) ? 'al-tip-off' : undefined}>
                    {showBatch && (
                      <span className="al-tip-pick">
                        {canPick && <input type="checkbox" checked={!off.has(t.key)} onChange={() => toggle(t.key)} aria-label={`${t.title} 고르기`} data-testid="al-advice-pick" />}
                      </span>
                    )}
                    <span className="al-tip-icon al-mp-tip-icon" aria-hidden="true">
                      {(() => {
                        const ic = adviceIcon(t.key);
                        return ic ? <AnyIconView icon={ic} size={22} /> : t.icon;
                      })()}
                    </span>
                    <div className="al-tip-text">
                      <b>{t.title}</b>
                      <small>{t.detail}</small>
                      {(() => {
                        const why = blockedWhy.get(t.key) ?? (fail && fail.state === state && fail.key === t.key ? fail.why : null);
                        return why ? (
                          <small className="al-tip-why" role="status" data-testid="al-advice-why">
                            ⚠ 지금은 할 수 없어요: {why}
                          </small>
                        ) : null;
                      })()}
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
                          disabled={blockedWhy.has(t.key)}
                          title={blockedWhy.get(t.key)}
                          onClick={() => {
                            const res = applyAdvice(t, state);
                            if (res.why) {
                              setFail({ state, key: t.key, why: res.why });
                              onSay?.(`${t.label ?? '적용'}: ${res.why}`);
                            } else {
                              markDone([t]);
                              setState(res.state);
                            }
                          }}
                          data-testid="al-advice-apply"
                        >
                          {t.label ?? '적용'}
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            {(hidden > 0 || more) && (
              <button type="button" className="al-link al-advice-more" onClick={() => setMore(!more)} aria-expanded={more} data-testid="al-advice-more">
                {more ? '▴ 접기' : `▾ 할 만한 일 ${hidden}개 더 보기`}
              </button>
            )}
          </>
        )}
        {canAct && first && (
          <p className="al-muted al-tip al-mp-note">
            <StaffIcon kind="info" size={15} /> 처음 한 해는 비서가 권하는 대로 해 봐도 좋아요. 첫해에는 리스 보증금이 없어요.
          </p>
        )}
      </div>
      <div className="al-info-side">
        <h4 className="al-mp-h4">
          <FinIcon kind="chart" size={15} /> 내 회사 한눈에
        </h4>
        <div className="al-mp-rings">
          <figure>
            <StatRing value={use} text={`${Math.round(use * 100)}%`} tone={useTone} label={`비행기 가동률 ${Math.round(use * 100)}%`} />
            <figcaption>가동률</figcaption>
          </figure>
          <figure>
            <StatRing value={me.reputation / 100} text={`${Math.round(me.reputation)}`} tone={repTone} label={`평판 ${Math.round(me.reputation)}`} />
            <figcaption>평판</figcaption>
          </figure>
          <figure>
            <StatRing value={me.onTime} text={`${Math.round(me.onTime * 100)}%`} tone={onTone} label={`정시 운항 ${Math.round(me.onTime * 100)}%`} />
            <figcaption>정시 운항</figcaption>
          </figure>
        </div>
        <ul className="al-mp-facts">
          <li>
            <MapIcon kind="hub" size={16} />
            <span>
              본사 <b>{CITY[me.hub].name}</b>
            </span>
          </li>
          <li>
            <FinIcon kind="building" size={16} />
            <span>
              지점 <b>{me.branches.length}</b>곳
            </span>
          </li>
          <li>
            <MapIcon kind="route" size={16} />
            <span>
              노선 <b>{me.routes.length}</b>개
            </span>
          </li>
          <li>
            <FinIcon kind="plane" size={16} />
            <span>
              비행기 <b>{me.planes.length}</b>대{me.orders.length > 0 && <small className="al-muted"> · 주문 {me.orders.length}</small>}
            </span>
          </li>
          <li>
            <FinIcon kind="meal" size={16} />
            <span>
              기내식 <b>{meal.toFixed(1)}</b>단계
            </span>
          </li>
          {allianceOf(state, viewer) && (
            <li>
              <FinIcon kind="rings" size={16} />
              <span>
                {allianceOf(state, viewer)!.name} <b>{alliesOf(state, viewer).map((i) => state.companies[i].name).join('·')}</b>
              </span>
            </li>
          )}
        </ul>
        {me.goals.length > 0 && (
          <>
            <h4 className="al-mp-h4">
              <FinIcon kind="target" size={15} /> 올해 목표
            </h4>
            <ul className="al-goal-list al-mp-goals">
              {me.goals.map((g) => {
                const v = goalProgress(state, viewer, g);
                const done = g.done === true || (g.done !== false && v >= 1);
                return (
                  <li key={g.kind}>
                    <ProgressRingMini v={v} done={done} fail={g.done === false} label={`${g.text} ${Math.round(v * 100)}%`} />
                    <span className="al-goal-text">{g.text}</span>
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

/** 목표 진행 작은 고리 (재무 화면과 같은 모양) */
function ProgressRingMini({ v, done, fail, label }: { v: number; done: boolean; fail: boolean; label: string }) {
  return <ProgressRing value={fail ? v : done ? 1 : v} tone={fail ? 'bad' : done ? 'good' : 'blue'} mark={done ? 'done' : fail ? 'fail' : undefined} size={32} label={label} />;
}
