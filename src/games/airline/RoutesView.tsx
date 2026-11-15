import { useMemo, useState } from 'react';
import './routes.css';
import { coColors } from './brand';
import { MODEL } from './aircraft';
import { openSuggestion, type Candidate } from './ai';
import { SEAT_SHAPES } from './Art';
import { PlaneImage } from './PlaneImage';
import { cabinSeats } from './cabin';
import { AIRPORT_INFO, CITIES, CITY, REGIONS, REGION_INFO, airportClass, dist, pairKey } from './cities';
import { fareText, fmtMoney, fmtPax, km, pct, signedFine, signedMoney } from './format';
import { FARE_MAX, FARE_MIN, applyAction, assignBlocker, bestFreq, buyBlocker, depositFor, maxRangeNow, routeBlocker, routeOnPair, usedBlocker } from './rules';
import {
  WEEK_HOURS,
  branchCost,
  branchUpkeep,
  draftsOf,
  estimateExisting,
  estimateRoute,
  fareOutlook,
  legFreq,
  legHours,
  leaseRent,
  opsRates,
  maxFreq,
  pairDemand,
  planeAge,
  planeHours,
  planesOnRoute,
  routeFreq,
  routeOf,
  slotCapacity,
  slotsUsed,
  type RouteEstimate,
} from './simulate';
import { yearOf } from './time';
import type { AirlineAction, AirlineState, ModelDef, RegionId } from './types';
import { SparkBars, Sparkline } from './Charts';
import { causeInfo } from './ReportView';
import { DaySchedule } from './DaySchedule';
import { TimetableCard } from './TimetableCard';
import { FaresCard } from './FaresCard';
import { modelsFor } from './bizmodel';
import { capacityText } from './freighters';
import { ActButton, CoName, LoadMeter, Meter, Stepper } from './ui';
import { FinIcon, ProgressRing } from './FinanceArt';
import { MoreInfo, StaffIcon } from './StaffArt';
import { FareProfitBars, FareScale, RouteArc, RouteGlyph, RouteIcon, RouteMoney, RoutesEmptyArt, SplitBar, type FareMark } from './RoutesArt';

/** 탑승률 고리 색: 많이 비면 빨강, 알맞으면 초록, 꽉 차면 주황 */
const lfTone = (lf: number) => (lf < 0.55 ? 'bad' : lf > 0.97 ? 'warn' : 'good');

export interface Planner {
  from: string;
  to: string | null;
}

interface RoutesViewProps {
  state: AirlineState;
  viewer: number;
  canAct: boolean;
  perform: (a: AirlineAction) => void;
  apply: (fn: (s: AirlineState) => AirlineState) => void;
  focus: number | null;
  onFocus: (id: number | null) => void;
  planner: Planner | null;
  onPlanner: (p: Planner | null) => void;
  onShowCity: (id: string) => void;
}

const notMine = '내 차례에만 할 수 있어요';

export function RoutesView(props: RoutesViewProps) {
  const { state, viewer, focus, onFocus, planner, onPlanner, canAct } = props;
  const me = state.companies[viewer];
  const [sort, setSort] = useState<'profit' | 'lf' | 'name'>('profit');
  const routes = [...me.routes].sort((a, b) => {
    if (sort === 'name') return CITY[a.a].name.localeCompare(CITY[b.a].name, 'ko');
    if (sort === 'lf') return (a.stats?.lf ?? 0) - (b.stats?.lf ?? 0);
    return (b.stats?.profit ?? -1e9) - (a.stats?.profit ?? -1e9);
  });
  const current = focus !== null ? me.routes.find((r) => r.id === focus) : undefined;
  const withStats = me.routes.filter((r) => r.stats);
  const profitSum = withStats.reduce((t, r) => t + (r.stats?.profit ?? 0), 0);
  const avgLf = withStats.length > 0 ? withStats.reduce((t, r) => t + (r.stats?.lf ?? 0), 0) / withStats.length : null;

  return (
    <div className="al-routes-view">
      <aside className="al-route-list">
        <div className="al-list-head">
          <h3>
            내 노선 <small>{me.routes.length}개</small>
          </h3>
          <button type="button" className="btn btn-small btn-primary" disabled={!canAct} onClick={() => onPlanner({ from: me.hub, to: null })} data-testid="al-new-route">
            ＋ 새 노선
          </button>
        </div>
        <div className="al-sort" role="group" aria-label="정렬">
          {(['profit', 'lf', 'name'] as const).map((k) => (
            <button key={k} type="button" className={`al-chip${sort === k ? ' al-on' : ''}`} onClick={() => setSort(k)}>
              {k === 'profit' ? '이익순' : k === 'lf' ? '탑승률 낮은 순' : '이름순'}
            </button>
          ))}
        </div>
        {withStats.length > 0 && (
          <div className="al-rl-sum">
            <span>
              <small>달 이익 합</small>
              <b className={profitSum < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(profitSum)}</b>
            </span>
            {avgLf !== null && (
              <span className="al-rl-lf">
                <ProgressRing value={avgLf} tone={lfTone(avgLf)} size={42} label={`평균 탑승률 ${pct(avgLf)}`} />
                <small>평균 탑승률</small>
              </span>
            )}
          </div>
        )}
        {routes.length === 0 && <p className="al-muted al-empty">아직 노선이 없어요. ‘＋ 새 노선’이나 지도에서 도시를 눌러 시작해요.</p>}
        <ul>
          {routes.map((r) => {
            const planes = planesOnRoute(me, r.id);
            const freq = routeFreq(me, r.id);
            const st = r.stats;
            const warn = planes.length === 0 ? '비행기 없음' : st && st.profit < 0 ? '적자' : st && st.lf > 0.97 ? '꽉 참' : null;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className={`al-route-row${focus === r.id && !planner ? ' al-on' : ''}`}
                  onClick={() => {
                    onPlanner(null);
                    onFocus(r.id);
                  }}
                >
                  <span className="al-rr-name">
                    <span className="al-rr-cities">
                      {CITY[r.a].name} <RouteGlyph /> {CITY[r.b].name}
                    </span>
                    {warn && (
                      <span className={`al-flag${warn === '꽉 참' ? ' al-flag-warn' : ''}`}>
                        <StaffIcon kind={warn === '꽉 참' ? 'check' : 'alert'} size={11} /> {warn}
                      </span>
                    )}
                  </span>
                  <span className="al-rr-sub">
                    <small className="al-rr-planes" title={`비행기 ${planes.length}대 · 주 ${freq}회 왕복`}>
                      <FinIcon kind="plane" size={13} />
                      {planes.length} · 주 {freq}회
                    </small>
                    {st && <LoadMeter lf={st.lf} />}
                    {st && <small className="al-rr-lf">{pct(st.lf)}</small>}
                    <small className={st && st.profit < 0 ? 'al-neg' : 'al-pos'}>{st ? signedMoney(st.profit) : '새 노선'}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
      <section className="al-route-main">
        {planner ? (
          <NewRoute {...props} planner={planner} />
        ) : current ? (
          <RouteEditor {...props} routeId={current.id} />
        ) : (
          <div className="al-empty-main">
            <RoutesEmptyArt />
            <p>왼쪽에서 노선을 고르면 비행기·운항 횟수·운임을 바꾸고, 바뀐 결과를 바로 어림해서 보여 줘요.</p>
            <button type="button" className="btn btn-primary" disabled={!canAct} onClick={() => onPlanner({ from: me.hub, to: null })}>
              ＋ 새 노선 찾기
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ 노선 고치기

function RouteEditor({ state, viewer, canAct, perform, apply, routeId, onFocus, onShowCity }: RoutesViewProps & { routeId: number }) {
  const me = state.companies[viewer];
  const r = me.routes.find((x) => x.id === routeId)!;
  const d = dist(r.a, r.b);
  const planes = planesOnRoute(me, r.id);
  const est = estimateExisting(state, viewer, r);
  const dem = pairDemand(state, r.a, r.b);
  const color = coColors(me);
  // 이 노선에 더 넣을 수 있는 비행기: 쉬는 비행기 + 다른 노선을 날고도 시간이 남는 비행기
  const others = me.planes
    .filter((p) => legFreq(p, r.id) === 0)
    .map((p) => ({ p, f: bestFreq(state, viewer, p.id, r.id), idle: p.legs.length === 0 }))
    .filter((x) => x.idle || x.f > 0)
    .sort((x, y) => Number(y.idle) - Number(x.idle) || y.f - x.f);
  const year = yearOf(state.q);
  const block = canAct ? null : notMine;
  const key = pairKey(r.a, r.b);
  const rivals = state.companies.map((c, i) => ({ c, i, rt: c.out || i === viewer ? undefined : c.routes.find((x) => pairKey(x.a, x.b) === key) })).filter((x) => x.rt);
  // 이 노선의 주간 좌석 (한 방향): 나와 라이벌
  const seatsOf = (c: (typeof state.companies)[number], routeId: number) => planesOnRoute(c, routeId).reduce((t, p) => t + cabinSeats(MODEL[p.model], p.cabin) * legFreq(p, routeId), 0);
  const mySeats = seatsOf(me, r.id);
  const myFreq = planes.reduce((t, p) => t + legFreq(p, r.id), 0);

  // 이 노선에 보태기 좋은 새 기종 (리스로 한 대 더 띄웠을 때 늘어나는 이익)
  const extra = useMemo(() => {
    const out: { m: ModelDef; freq: number; gain: number }[] = [];
    const base = draftsOf(state, me, r.id);
    const left = Math.min(slotCapacity(state, viewer, r.a) - slotsUsed(me, r.a), slotCapacity(state, viewer, r.b) - slotsUsed(me, r.b));
    for (const m of modelsFor(me, year)) {
      if (m.range < d || airportClass(CITY[r.a], year) < m.runway || airportClass(CITY[r.b], year) < m.runway) continue;
      const f = Math.min(maxFreq(m, d), left);
      if (f < 1) continue;
      const e = estimateExisting(state, viewer, r, { planes: [...base, { model: m.id, freq: f }] });
      out.push({ m, freq: f, gain: e.profit - est.profit });
    }
    return out.filter((x) => x.gain > 1).sort((a, b) => b.gain - a.gain).slice(0, 3);
  }, [state, viewer, r, me, year, d, est.profit]);

  const acquire = (how: { lease: string } | { used: number }) =>
    apply((s) => {
      const t = applyAction(s, 'lease' in how ? { type: 'lease', model: how.lease } : { type: 'buyUsed', listing: how.used });
      if (t === s) return s;
      const c = t.companies[viewer];
      const pid = c.planes[c.planes.length - 1].id;
      const f = bestFreq(t, viewer, pid, r.id);
      return f > 0 ? applyAction(t, { type: 'assign', plane: pid, route: r.id, freq: f }) : t;
    });

  return (
    <div className="al-editor" data-testid="al-route-editor">
      <header className="al-editor-head al-re-head">
        <div className="al-re-title">
          <h3 className="al-ra">
            <button type="button" className="al-link al-ra-city" onClick={() => onShowCity(r.a)}>
              {CITY[r.a].name}
            </button>
            <RouteArc distance={d} />
            <button type="button" className="al-link al-ra-city" onClick={() => onShowCity(r.b)}>
              {CITY[r.b].name}
            </button>
          </h3>
          <div className="al-re-facts">
            <span className="al-re-fact">
              <FinIcon kind="people" size={18} />
              <span>
                <small>한 방향 주간 잠재 손님</small>
                <b>{fmtPax(dem.biz + dem.leisure)}</b>
              </span>
            </span>
            <span className="al-re-fact">
              <FinIcon kind="rings" size={18} />
              <span>
                <small>라이벌</small>
                <b>{rivals.length > 0 ? `${rivals.length}곳` : '없어요'}</b>
              </span>
            </span>
            <div className="al-re-split">
              <SplitBar
                label="잠재 손님 나눔"
                height={10}
                parts={[
                  { key: 'biz', name: <><RouteIcon kind="biz" size={13} /> 사업</>, v: dem.biz, color: 'var(--al-cat-1)', text: pct(dem.biz / Math.max(1, dem.biz + dem.leisure)) },
                  { key: 'leisure', name: <><RouteIcon kind="leisure" size={13} /> 관광</>, v: dem.leisure, color: 'var(--al-cat-3)', text: pct(dem.leisure / Math.max(1, dem.biz + dem.leisure)) },
                ]}
              />
            </div>
          </div>
        </div>
        <ActButton
          small
          blocker={block}
          onClick={() => {
            if (window.confirm('이 노선을 닫을까요? 비행기는 쉬는 상태가 돼요.')) {
              perform({ type: 'closeRoute', route: r.id });
              onFocus(null);
            }
          }}
        >
          노선 닫기
        </ActButton>
      </header>

      <div className="al-editor-grid">
        <div className="al-editor-left">
          <section className="al-card">
            <h4 className="al-fin-title">
              <FinIcon kind="plane" /> 띄우는 비행기{' '}
              <small>
                {planes.length}대 · 주 {myFreq}회 왕복 · 좌석 {mySeats.toLocaleString('ko-KR')}
              </small>
            </h4>
            {planes.length === 0 && <p className="al-muted">비행기가 없어서 운항하지 않아요. 아래에서 넣어 주세요.</p>}
            <ul className="al-plane-rows">
              {planes.map((p) => {
                const m = MODEL[p.model];
                const now = legFreq(p, r.id);
                const max = Math.max(now, bestFreq(state, viewer, p.id, r.id));
                const elsewhere = p.legs.filter((l) => l.route !== r.id).map((l) => routeOf(me, l.route)).filter((x) => !!x);
                const use = planeHours(me, p) / WEEK_HOURS;
                return (
                  <li key={p.id}>
                    <PlaneImage model={m.id} paint={{ main: color.main, dark: color.dark, shape: SEAT_SHAPES[me.seat] }} className="al-plane-chip" />
                    <span className="al-pr-name">
                      <b>{m.name}</b>
                      <small>
                        {cabinSeats(m, p.cabin)}석 · {p.leased ? '리스' : '내 것'}
                      </small>
                      <span className="al-pr-use" title={`한 주 ${Math.round(planeHours(me, p))} / ${WEEK_HOURS}시간 날아요`}>
                        <Meter value={use} tone={use > 0.92 ? 'warn' : 'blue'} label={`가동률 ${Math.round(use * 100)}%`} />
                        <small>가동 {Math.round(use * 100)}%</small>
                      </span>
                      {elsewhere.length > 0 && (
                        <small className="al-muted" title={elsewhere.map((x) => `${CITY[x!.a].name}–${CITY[x!.b].name}`).join(', ')}>
                          다른 노선 {elsewhere.length}개도 날아요
                        </small>
                      )}
                    </span>
                    <span className="al-pr-freq">
                      <small>주간 왕복</small>
                      <Stepper value={now} min={1} max={max} disabled={!canAct} label={`${m.name} 주간 왕복`} onChange={(f) => perform({ type: 'assign', plane: p.id, route: r.id, freq: f })} />
                      <small className="al-muted">이 비행기로 최대 {max}</small>
                    </span>
                    <button type="button" className="btn btn-small" disabled={!canAct} onClick={() => perform({ type: 'assign', plane: p.id, route: r.id, freq: 0 })} title="이 노선에서만 빼요 (다른 노선은 그대로)">
                      빼기
                    </button>
                  </li>
                );
              })}
            </ul>
            {others.length > 0 && (
              <>
                <h5 className="al-fin-sub">
                  <FinIcon kind="parked" size={16} /> 내 비행기 더 넣기
                </h5>
                <ul className="al-idle-rows">
                  {others.slice(0, 8).map(({ p, f, idle }) => {
                    const m = MODEL[p.model];
                    const why = f > 0 ? null : assignBlocker(state, viewer, p.id, r.id, 1) ?? '슬롯이 모자라요';
                    const spare = WEEK_HOURS - planeHours(me, p);
                    return (
                      <li key={p.id}>
                        <span className="al-idle-name">
                          <b>{m.name}</b> <small className="al-muted">{Math.floor(planeAge(state, p))}년</small>
                          <span className="al-idle-hours" title={idle ? '쉬는 중이에요' : `다른 노선을 날고 한 주 ${Math.round(spare)}시간 남아요`}>
                            <Meter value={spare / WEEK_HOURS} tone={idle ? 'good' : 'blue'} label={`남는 시간 ${Math.round(spare)}시간`} />
                            <small>{idle ? '쉬는 중' : `${Math.round(spare)}시간 남음`}</small>
                          </span>
                        </span>
                        <ActButton small blocker={canAct ? why : notMine} onClick={() => perform({ type: 'assign', plane: p.id, route: r.id, freq: f })}>
                          넣기 · 주 {f}회
                        </ActButton>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {extra.length > 0 && (
              <>
                <h5 className="al-fin-sub">
                  <FinIcon kind="shop" size={16} /> 새로 들여서 넣기
                </h5>
                <ul className="al-idle-rows">
                  {extra.map(({ m, freq, gain }) => {
                    const used = state.market.find((u) => u.model === m.id);
                    const deposit = depositFor(state, viewer, m.id);
                    return (
                      <li key={m.id}>
                        <span className="al-idle-name">
                          <b>{m.name}</b>
                          <span className="al-chips">
                            <span className="al-chip-static">주 {freq}회</span>
                            <span className="al-chip-static al-pos">이익 {signedMoney(gain)}</span>
                          </span>
                        </span>
                        <span className="al-two">
                          <ActButton
                            small
                            blocker={canAct ? buyBlocker(state, viewer, m.id, true) : notMine}
                            onClick={() => acquire({ lease: m.id })}
                            title={deposit > 0 ? `보증금 ${fmtMoney(deposit)} (돌려줄 때 돌려받아요)` : '첫해에는 보증금이 없어요'}
                          >
                            리스 · 달 {fmtMoney(leaseRent(state, m))}
                          </ActButton>
                          {used && (
                            <ActButton small blocker={canAct ? usedBlocker(state, viewer, used.id) : notMine} onClick={() => acquire({ used: used.id })} title={`${used.age}년 된 중고`}>
                              중고 {fmtMoney(used.price)}
                            </ActButton>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="al-muted al-tip">새 비행기 주문은 ‘비행기’ 화면에서 해요 (싸지만 몇 달 뒤에 와요).</p>
              </>
            )}
          </section>
          <FareCard
            key={`${viewer}-${r.id}-${state.t}`}
            state={state}
            viewer={viewer}
            canAct={canAct}
            perform={perform}
            routeId={r.id}
            est={est}
            hasPlanes={planes.length > 0}
            rivals={rivals.map(({ c, i, rt }) => ({ key: String(i), fare: rt!.fare, color: coColors(c).main, name: c.name }))}
          />
          <FaresCard state={state} viewer={viewer} canAct={canAct} perform={perform} apply={apply} route={r} est={est} />
          <TimetableCard state={state} viewer={viewer} canAct={canAct} perform={perform} route={r} />
        </div>
        <div className="al-editor-right">
          <EstimateCard est={est} lastProfit={r.stats?.profit ?? null} lastLf={r.stats?.lf ?? null} lastPremLf={r.stats?.premLf ?? null} />
          <section className="al-card al-route-ops">
            <h4 className="al-fin-title">
              <StaffIcon kind="clock" /> 운항과 지난 열두 달
            </h4>
            {(() => {
              const risk = opsRates(state, viewer, r.id);
              const info = causeInfo(risk.cause);
              const hist = r.stats?.hist ?? [];
              const lastHist = hist[hist.length - 1];
              return (
                <div className="al-ro-grid">
                  <div className="al-ro-tile">
                    <span className="al-ro-head">
                      <small>탑승률 흐름</small>
                      {lastHist && <b>{pct(lastHist[0])}</b>}
                    </span>
                    <Sparkline values={hist.map((x) => x[0])} width={112} height={28} label="최근 열두 달 탑승률" />
                  </div>
                  <div className="al-ro-tile">
                    <span className="al-ro-head">
                      <small>이익 흐름</small>
                      {lastHist && <b className={lastHist[1] < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(lastHist[1])}</b>}
                    </span>
                    <SparkBars values={hist.map((x) => x[1])} width={112} height={28} label="최근 열두 달 이익" />
                  </div>
                  <div className="al-ro-tile al-ro-row al-ro-wide">
                    {r.stats ? (
                      <ProgressRing value={r.stats.onTime} tone={r.stats.onTime >= 0.85 ? 'good' : r.stats.onTime >= 0.7 ? 'warn' : 'bad'} size={46} label={`지난달 정시율 ${pct(r.stats.onTime)}`} />
                    ) : (
                      <ProgressRing value={0} size={46} label="지난달 정시율 없음" />
                    )}
                    <span>
                      <small>지난달 정시율</small>
                      <b>{r.stats ? pct(r.stats.onTime) : '—'}</b>
                      <small>결항 {r.stats ? `${(r.stats.cancel * 100).toFixed(1)}%` : '—'}</small>
                    </span>
                  </div>
                  <div className="al-ro-tile al-ro-row al-ro-wide">
                    <span className="al-ro-cause" aria-hidden="true">
                      {info.icon}
                    </span>
                    <span>
                      <small>이번 달 걱정</small>
                      <b>
                        {info.name}
                        {risk.city ? ` (${CITY[risk.city].name})` : ''}
                      </b>
                      <span className="al-ro-risk">
                        <small>지연 약 {pct(risk.late)}</small>
                        <Meter value={risk.late / 0.3} tone={risk.late > 0.15 ? 'bad' : 'warn'} label={`지연 약 ${pct(risk.late)}`} />
                      </span>
                      <span className="al-ro-risk">
                        <small>결항 약 {(risk.cancel * 100).toFixed(1)}%</small>
                        <Meter value={risk.cancel / 0.05} tone={risk.cancel > 0.02 ? 'bad' : 'warn'} label={`결항 약 ${(risk.cancel * 100).toFixed(1)}%`} />
                      </span>
                    </span>
                  </div>
                </div>
              );
            })()}
          </section>
          {planes.length > 0 && (
            <section className="al-card">
              <h4 className="al-fin-title">
                <StaffIcon kind="calendar" /> 하루 운항표 <small>이 노선을 나는 비행기 {planes.length}대 · 진한 막대가 이 노선</small>
              </h4>
              <DaySchedule state={state} ci={viewer} planes={planes} highlight={r.id} limit={6} />
            </section>
          )}
          {rivals.length > 0 && (
            <section className="al-card al-rival-card">
              <h4 className="al-fin-title">
                <FinIcon kind="rings" /> 라이벌 <small>한 방향 주간 좌석 나눔</small>
              </h4>
              <SplitBar
                label="이 노선 주간 좌석"
                parts={[
                  { key: 'me', name: <CoName c={me} />, v: mySeats, color: color.main, text: `${mySeats.toLocaleString('ko-KR')}석` },
                  ...rivals.map(({ c, i, rt }) => {
                    const seats = seatsOf(c, rt!.id);
                    return { key: String(i), name: <CoName c={c} />, v: seats, color: coColors(c).main, text: `${seats.toLocaleString('ko-KR')}석` };
                  }),
                ]}
              />
              <ul className="al-rivals">
                {rivals.map(({ c, i, rt }) => {
                  const ps = planesOnRoute(c, rt!.id);
                  return (
                    <li key={i}>
                      <CoName c={c} />
                      <span className="al-rival-facts">
                        <span className="al-chip-static" title="비행기 × 주간 왕복">
                          <FinIcon kind="plane" size={12} /> {ps.map((p) => `${MODEL[p.model].name}×${legFreq(p, rt!.id)}`).join(', ') || '비행기 없음'}
                        </span>
                        <span className="al-chip-static">
                          <FinIcon kind="tag" size={12} /> {fareText(rt!.fare)}
                        </span>
                        {rt!.stats && (
                          <span className="al-rival-lf">
                            <LoadMeter lf={rt!.stats.lf} />
                            <small>탑승률 {pct(rt!.stats.lf)}</small>
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ 운임 (바꾸면 바로 이익 어림)

/** 별 (가장 남는 운임 표시, 막대 위 별과 같은 모양) */
function BestStar() {
  return (
    <svg viewBox="0 0 12 12" width={12} height={12} aria-hidden="true" className="al-fpb-key">
      <path d="M6 0.5L7.3 4.2L11.2 4.3L8.1 6.7L9.2 10.4L6 8.2L2.8 10.4L3.9 6.7L0.8 4.3L4.7 4.2Z" />
    </svg>
  );
}

/**
 * 운임 카드: 슬라이더 바로 위에 예상 이익·탑승률과 운임별 이익 막대를 둔다.
 * (모바일에서는 ‘이번 달 어림’ 카드가 한참 아래라, 운임을 바꾸며 결과를 한 화면에서 보도록)
 */
function FareCard({
  state,
  viewer,
  canAct,
  perform,
  routeId,
  est,
  hasPlanes,
  rivals,
}: {
  state: AirlineState;
  viewer: number;
  canAct: boolean;
  perform: (a: AirlineAction) => void;
  routeId: number;
  est: RouteEstimate;
  hasPlanes: boolean;
  rivals: FareMark[];
}) {
  const r = state.companies[viewer].routes.find((x) => x.id === routeId)!;
  // 이번 달 이 노선을 처음 볼 때의 운임: 바꾼 뒤 이익이 얼마나 달라졌는지 견주는 기준
  const [startFare] = useState(r.fare);
  const outlook = useMemo(() => (hasPlanes ? fareOutlook(state, viewer, r, FARE_MIN, FARE_MAX) : null), [state, viewer, r, hasPlanes]);
  const before = useMemo(() => (hasPlanes && startFare !== r.fare ? estimateExisting(state, viewer, r, { fare: startFare }) : null), [state, viewer, r, hasPlanes, startFare]);
  const setFare = (fare: number) => perform({ type: 'setFare', route: r.id, fare });
  const bestPoint = outlook?.points.find((p) => p.fare === outlook.best);
  const diff = before ? est.profit - before.profit : 0;

  return (
    <section className="al-card al-fare-card">
      <h4 className="al-fin-title">
        <FinIcon kind="tag" /> 운임 <small>{fareText(r.fare)}</small>
      </h4>
      {rivals.length > 0 && (
        <>
          <FareScale mine={r.fare} min={FARE_MIN} max={FARE_MAX} rivals={rivals} />
          <p className="al-muted al-tip al-fs-legend">
            <span>
              <i className="al-fs-key al-fs-key-me" /> 내 운임
            </span>
            <span>
              <i className="al-fs-key al-fs-key-rival" /> 라이벌 운임
            </span>
            <span>(점에 마우스를 올리면 회사 이름)</span>
          </p>
        </>
      )}
      {outlook ? (
        <>
          {/* 손가락이 슬라이더를 가려도 보이게 결과는 슬라이더 위에 */}
          <div className="al-fare-est" data-testid="al-fare-est">
            <span className="al-fe-main">
              <small>
                <b>{fareText(r.fare)}</b>일 때 이번 달 예상 이익
              </small>
              <b className={est.profit < 0 ? 'al-neg' : 'al-pos'} data-testid="al-fare-profit">
                {signedFine(est.profit)}
              </b>
              {before ? (
                <small className="al-fe-diff">
                  바꾸기 전({fareText(startFare)})보다 <b className={diff < 0 ? 'al-neg' : 'al-pos'}>{signedFine(diff)}</b>
                </small>
              ) : (
                <small className="al-fe-diff al-muted">운임을 바꾸면 바로 다시 어림해요</small>
              )}
            </span>
            <span className="al-fe-lf">
              <ProgressRing value={est.lf} tone={lfTone(est.lf)} size={46} label={`탑승률 ${pct(est.lf)}`} />
              <small>탑승률</small>
            </span>
          </div>
          <FareProfitBars bars={outlook.points} current={r.fare} best={outlook.best} format={signedFine} onPick={canAct ? setFare : undefined} />
          {bestPoint && (
            <p className="al-fpb-note">
              <BestStar /> 가장 남는 운임 <b>{fareText(bestPoint.fare)}</b>
              <span className="al-muted">· 이익 {signedFine(bestPoint.profit)}</span>
              {bestPoint.fare === r.fare ? (
                <span className="al-chip-static al-pos">지금 운임</span>
              ) : (
                <button type="button" className="al-chip" disabled={!canAct} onClick={() => setFare(bestPoint.fare)} data-testid="al-fare-best">
                  이 운임으로
                </button>
              )}
            </p>
          )}
        </>
      ) : (
        <p className="al-muted">비행기를 넣으면 운임에 따라 이익이 얼마나 될지 여기서 바로 어림해 보여 줘요.</p>
      )}
      <div className="al-fare">
        <span>싸게</span>
        <input
          type="range"
          min={FARE_MIN}
          max={FARE_MAX}
          step={5}
          value={r.fare}
          disabled={!canAct}
          onChange={(e) => setFare(Number(e.target.value))}
          aria-label="운임 조정"
          aria-valuetext={`${fareText(r.fare)}${outlook ? `, 예상 이익 ${signedFine(est.profit)}` : ''}`}
          data-testid="al-fare"
        />
        <span>비싸게</span>
      </div>
      <div className="al-fare-quick">
        {[-15, 0, 15].map((f) => (
          <button key={f} type="button" className={`al-chip${r.fare === f ? ' al-on' : ''}`} disabled={!canAct} onClick={() => setFare(f)}>
            {fareText(f)}
          </button>
        ))}
      </div>
      <MoreInfo>
        싸면 손님이 늘고(특히 관광객), 비싸면 한 명에게 더 받아요. 좌석이 꽉 차면 올려 보고, 많이 비면 내려 보세요. 막대는 운임마다 이번 달 이익 어림이에요 (비행기·시간표·라이벌이 지금 그대로일 때). 막대를 눌러도 그 운임으로 바뀌어요.
      </MoreInfo>
    </section>
  );
}

const COST_PARTS: { key: keyof RouteEstimate['cost']; name: string; cls: string }[] = [
  { key: 'fuel', name: '연료', cls: 'al-c-fuel' },
  { key: 'crew', name: '승무원·정비', cls: 'al-c-crew' },
  { key: 'airport', name: '공항', cls: 'al-c-apt' },
  { key: 'service', name: '기내 서비스', cls: 'al-c-svc' },
  { key: 'sales', name: '판매 수수료', cls: 'al-c-sales' },
  { key: 'lease', name: '리스·보험', cls: 'al-c-lease' },
];

/** 이번 달 어림 (손님·탑승률·수입·비용·이익) */
export function EstimateCard({
  est,
  lastProfit,
  lastLf,
  lastPremLf = null,
  title = '이번 달 어림',
}: {
  est: RouteEstimate;
  lastProfit: number | null;
  lastLf: number | null;
  lastPremLf?: number | null;
  title?: string;
}) {
  return (
    <section className="al-card al-estimate" aria-live="polite">
      <h4 className="al-fin-title">
        <FinIcon kind="chart" /> {title}
      </h4>
      <div className="al-est-big">
        <span>예상 이익</span>
        <b className={est.profit < 0 ? 'al-neg' : 'al-pos'} data-testid="al-est-profit">
          {signedFine(est.profit)}
        </b>
      </div>
      <div className="al-est-rings">
        <figure>
          <ProgressRing value={est.lf} tone={lfTone(est.lf)} size={58} label={`탑승률 ${pct(est.lf)}`} />
          <figcaption>탑승률</figcaption>
        </figure>
        <figure>
          <ProgressRing value={est.share} tone="blue" size={58} label={`이 두 도시 손님 중 내 몫 ${pct(est.share)}`} />
          <figcaption>두 도시 손님 중 내 몫</figcaption>
        </figure>
        <div className="al-est-pax">
          <span>
            <FinIcon kind="people" size={16} /> <small>주간 손님 (한 방향)</small>
          </span>
          <b>
            {fmtPax(est.paxWeek)} <small>/ 좌석 {est.seatsWeek.toLocaleString('ko-KR')}</small>
          </b>
          {est.xferWeek > 0 && (
            <small className="al-muted">
              <RouteIcon kind="xfer" size={13} /> 그중 갈아타는 손님 {fmtPax(est.xferWeek)}
            </small>
          )}
          <span>
            <FinIcon kind="ticket" size={16} /> <small>달 운임 수입</small>
          </span>
          <b>{fmtMoney(est.revenue)}</b>
        </div>
      </div>
      <RouteMoney revenue={est.revenue} costs={COST_PARTS.map((p) => ({ key: p.key, name: p.name, v: est.cost[p.key] as number, cls: p.cls }))} />
      <ul className="al-cost-legend">
        <li>
          <i className="al-c-rev" /> 수입 {fmtMoney(est.revenue)}
        </li>
        {COST_PARTS.map((p) => (
          <li key={p.key}>
            <i className={p.cls} /> {p.name} {fmtMoney(est.cost[p.key] as number)}
          </li>
        ))}
        <li>
          <i className={est.profit >= 0 ? 'al-sw-profit' : 'al-sw-loss'} /> {est.profit >= 0 ? '이익' : '손해'}
        </li>
      </ul>
      {lastProfit !== null && (
        <p className="al-muted al-last">
          <StaffIcon kind="calendar" size={14} /> 지난달 실제
          <span className="al-chip-static">
            이익 <b className={lastProfit < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(lastProfit)}</b>
          </span>
          {lastLf !== null && <span className="al-chip-static">탑승률 {pct(lastLf)}</span>}
          {lastPremLf !== null && <span className="al-chip-static">고급 좌석 {pct(lastPremLf)}</span>}
        </p>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ 새 노선 찾기

function NewRoute({ state, viewer, canAct, apply, planner, onPlanner, onFocus }: RoutesViewProps & { planner: Planner }) {
  const me = state.companies[viewer];
  const year = yearOf(state.q);
  const [region, setRegion] = useState<RegionId | 'all'>('all');
  const [onlyBranch, setOnlyBranch] = useState(false);
  const from = me.branches.includes(planner.from) ? planner.from : me.hub;
  const maxRange = maxRangeNow(state, viewer);
  const color = coColors(me);

  const list = useMemo(() => {
    return CITIES.filter((c) => c.id !== from)
      .map((c) => {
        const d = dist(from, c.id);
        const dem = pairDemand(state, from, c.id);
        const rivals = state.companies.filter((x, i) => i !== viewer && !x.out && routeOnPair(x, from, c.id)).length;
        return { c, d, demand: dem.biz + dem.leisure, rivals, mine: !!routeOnPair(me, from, c.id), branch: me.branches.includes(c.id), reach: d <= maxRange && d >= 150 };
      })
      .filter((x) => (region === 'all' || x.c.region === region) && (!onlyBranch || x.branch))
      .sort((a, b) => b.demand - a.demand);
  }, [state, from, viewer, me, maxRange, region, onlyBranch]);

  const maxDemand = Math.max(1, ...list.map((x) => x.demand));
  const to = planner.to;
  const options = useMemo(() => {
    if (!to) return [];
    const d = dist(from, to);
    const out: { m: ModelDef; freq: number; e: RouteEstimate }[] = [];
    const left = Math.min(slotCapacity(state, viewer, from) - slotsUsed(me, from), slotCapacity(state, viewer, to) - slotsUsed(me, to));
    const dem = pairDemand(state, from, to);
    for (const m of modelsFor(me, year)) {
      if (m.range < d || airportClass(CITY[from], year) < m.runway || airportClass(CITY[to], year) < m.runway) continue;
      const max = Math.min(maxFreq(m, d), left);
      if (max < 1) continue;
      const fit = Math.max(1, Math.min(max, Math.round(((dem.biz + dem.leisure) * 0.7) / m.seats)));
      let best: { m: ModelDef; freq: number; e: RouteEstimate } | null = null;
      for (const f of new Set([fit, max, Math.max(1, Math.round((fit + max) / 2))])) {
        const e = estimateRoute(state, viewer, from, to, [{ model: m.id, freq: f }], 0);
        if (!best || e.profit > best.e.profit) best = { m, freq: f, e };
      }
      if (best) out.push(best);
    }
    return out.sort((a, b) => b.e.profit - a.e.profit).slice(0, 5);
  }, [state, viewer, me, from, to, year]);

  const bestProfit = Math.max(1, ...options.map((o) => o.e.profit));
  const needBranch = to ? [from, to].filter((c) => !me.branches.includes(c)) : [];
  const branchMoney = needBranch.reduce((s, c) => s + branchCost(c, state.q), 0);
  let why: string | null = canAct ? null : notMine;
  if (!why && to) {
    if (routeOnPair(me, from, to)) why = '이미 있는 노선이에요';
    else if (me.cash < branchMoney) why = `지점을 열 돈이 모자라요 (${fmtMoney(branchMoney)})`;
    else {
      const b = routeBlocker({ ...state, companies: state.companies.map((c, i) => (i === viewer ? { ...c, branches: [...c.branches, ...needBranch] } : c)) }, viewer, from, to);
      why = b;
    }
  }

  const openRouteOnly = () =>
    apply((s) => {
      let t = s;
      for (const c of needBranch) t = applyAction(t, { type: 'openBranch', city: c });
      const u = applyAction(t, { type: 'openRoute', a: from, b: to! });
      if (u === t) return s;
      const id = routeOnPair(u.companies[viewer], from, to!)?.id ?? null;
      queueMicrotask(() => {
        onPlanner(null);
        onFocus(id);
      });
      return u;
    });

  // 비행시간이 남는 내 비행기 (쉬는 비행기 포함): 이 노선을 몇 번 날 수 있는지
  const mine = useMemo(() => {
    if (!to) return [];
    const d = dist(from, to);
    return me.planes
      .map((p) => {
        const m = MODEL[p.model];
        if (m.range < d || airportClass(CITY[from], year) < m.runway || airportClass(CITY[to], year) < m.runway) return null;
        const f = Math.min(maxFreq(m, d), Math.floor((WEEK_HOURS - planeHours(me, p)) / (2 * legHours(m, d)) + 1e-9));
        if (f < 1) return null;
        const e = estimateRoute(state, viewer, from, to, [{ model: m.id, freq: f, age: planeAge(state, p), fixed: 0 }], 0);
        return { p, m, freq: f, e };
      })
      .filter((x) => !!x)
      .sort((x, y) => Number(y!.p.legs.length === 0) - Number(x!.p.legs.length === 0) || y!.e.profit - x!.e.profit)
      .slice(0, 4) as { p: (typeof me.planes)[number]; m: ModelDef; freq: number; e: RouteEstimate }[];
  }, [state, viewer, me, from, to, year]);

  const openWith = (o: { m: ModelDef; freq: number; e: RouteEstimate }, how: 'lease' | 'used' | number) =>
    apply((s) => {
      const cand: Candidate = { a: from, b: to!, model: o.m, freq: o.freq, fare: 0, profit: o.e.profit, capital: 0, needBranch, score: 0 };
      const u = openSuggestion(s, viewer, cand, how);
      if (u === s) return s;
      const id = routeOnPair(u.companies[viewer], from, to!)?.id ?? null;
      queueMicrotask(() => {
        onPlanner(null);
        onFocus(id);
      });
      return u;
    });

  return (
    <div className="al-newroute" data-testid="al-planner">
      <header className="al-editor-head">
        <h3 className="al-fin-title">
          <RouteIcon kind="route" size={20} /> 새 노선 찾기
        </h3>
        <button type="button" className="btn btn-small btn-ghost" onClick={() => onPlanner(null)} aria-label="닫기">
          ✕ 닫기
        </button>
      </header>
      <div className="al-nr-grid">
        <div className="al-nr-left">
          <label className="al-field">
            <span>출발 (내 지점)</span>
            <select value={from} onChange={(e) => onPlanner({ from: e.target.value, to: null })}>
              {me.branches.map((c) => (
                <option key={c} value={c}>
                  {CITY[c].name}
                  {c === me.hub ? ' (본사)' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="al-sort" role="group" aria-label="지역">
            <button type="button" className={`al-chip${region === 'all' ? ' al-on' : ''}`} onClick={() => setRegion('all')}>
              전체
            </button>
            {REGIONS.map((r) => (
              <button key={r} type="button" className={`al-chip${region === r ? ' al-on' : ''}`} onClick={() => setRegion(r)}>
                {REGION_INFO[r].short}
              </button>
            ))}
            <label className="al-check">
              <input type="checkbox" checked={onlyBranch} onChange={(e) => setOnlyBranch(e.target.checked)} /> 지점 있는 곳만
            </label>
          </div>
          <ul className="al-dest-list">
            {list.map((x) => (
              <li key={x.c.id}>
                <button
                  type="button"
                  className={`al-dest-row${to === x.c.id ? ' al-on' : ''}${x.reach ? '' : ' al-far'}`}
                  onClick={() => onPlanner({ from, to: x.c.id })}
                  data-testid={`al-dest-${x.c.id}`}
                >
                  <span className="al-dr-name">
                    {x.c.name}
                    {x.mine && <span className="al-flag al-flag-ok">내 노선</span>}
                    {!x.reach && <span className="al-flag">너무 멀어요</span>}
                  </span>
                  <span className="al-dr-demand" title={`한 방향 주간 잠재 손님 ${fmtPax(x.demand)}`}>
                    <FinIcon kind="people" size={13} />
                    <Meter value={x.demand / maxDemand} tone="blue" label={`주간 손님 ${fmtPax(x.demand)}`} />
                    <small>주 {fmtPax(x.demand)}</small>
                  </span>
                  <small className="al-dr-facts">
                    <span>
                      <RouteIcon kind="route" size={13} /> {km(x.d)}
                    </span>
                    {x.rivals > 0 && (
                      <span>
                        <FinIcon kind="rings" size={13} /> 라이벌 {x.rivals}
                      </span>
                    )}
                    <span className={x.branch ? 'al-pos' : ''}>
                      <FinIcon kind="building" size={13} /> {x.branch ? '지점 ✓' : `지점 ${fmtMoney(branchCost(x.c.id, state.q))}`}
                    </span>
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="al-nr-right">
          {!to ? (
            <div className="al-empty-main al-nr-empty">
              <RoutesEmptyArt />
              <p className="al-muted">왼쪽에서 갈 도시를 고르세요. 막대가 긴(주간 손님이 많은) 곳, 라이벌이 적은 곳이 좋아요. 너무 가까운 곳은 기차를 타서 손님이 적어요.</p>
            </div>
          ) : (
            <>
              <h4 className="al-ra al-nr-title">
                <span className="al-ra-city">{CITY[from].name}</span>
                <RouteArc distance={dist(from, to)} height={40} />
                <span className="al-ra-city">{CITY[to].name}</span>
              </h4>
              <p className="al-nr-facts">
                <span className="al-chip-static">
                  <FinIcon kind="tower" size={13} /> {AIRPORT_INFO[airportClass(CITY[to], year)].name}
                </span>
                {needBranch.length === 0 ? (
                  <span className="al-chip-static al-pos">
                    <FinIcon kind="building" size={13} /> 두 도시 모두 지점이 있어요
                  </span>
                ) : (
                  needBranch.map((c) => (
                    <span key={c} className="al-chip-static" title={`유지비 달 ${fmtMoney(branchUpkeep(c, state.q))}`}>
                      <FinIcon kind="building" size={13} /> {CITY[c].name} 지점 새로 열기 {fmtMoney(branchCost(c, state.q))} · 유지비 달 {fmtMoney(branchUpkeep(c, state.q))}
                    </span>
                  ))
                )}
              </p>
              {/* 노선 자체를 못 여는 이유는 여기 한 번만 (버튼마다 되풀이하지 않는다) */}
              {why && (
                <p className="al-why al-route-block" role="note" data-testid="al-route-block">
                  🚫 {why}
                </p>
              )}
              {options.length === 0 ? (
                <p className="al-why">지금 이 노선에 띄울 수 있는 비행기가 없어요. (거리·공항 크기·슬롯을 확인하세요)</p>
              ) : (
                <ul className="al-options">
                  {options.map((o) => {
                    const used = state.market.find((u) => u.model === o.m.id);
                    const leaseWhy = why ?? buyBlocker(state, viewer, o.m.id, true);
                    const usedWhy = used ? (why ?? usedBlocker(state, viewer, used.id)) : null;
                    // 리스·중고가 같은 이유로 막히면 그 이유는 두 버튼 밑에 한 번만
                    const sameWhy = !why && !!leaseWhy && leaseWhy === usedWhy ? leaseWhy : null;
                    return (
                      <li key={o.m.id}>
                        <PlaneImage model={o.m.id} paint={{ main: color.main, dark: color.dark, shape: SEAT_SHAPES[me.seat] }} className="al-plane-chip al-plane-chip-big" />
                        <div className="al-opt-body">
                          <span className="al-opt-text">
                            <b>{o.m.name}</b>
                            <span className="al-chips">
                              <span className="al-chip-static">주 {o.freq}회</span>
                              <span className="al-chip-static">
                                <RouteIcon kind="seat" size={12} /> {capacityText(o.m)}
                              </span>
                            </span>
                            <span className="al-opt-bars">
                              <span title={`탑승률 ${pct(o.e.lf)}`}>
                                <LoadMeter lf={o.e.lf} /> <small>탑승률 {pct(o.e.lf)}</small>
                              </span>
                              <span title="달 이익 어림 (가장 좋은 것에 견준 막대)">
                                <Meter value={Math.max(0, o.e.profit) / bestProfit} tone={o.e.profit < 0 ? 'bad' : 'good'} label={`달 이익 ${signedMoney(o.e.profit)}`} />{' '}
                                <small>
                                  이익 <b className={o.e.profit < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(o.e.profit)}</b>/달
                                </small>
                              </span>
                            </span>
                          </span>
                          <span className="al-act">
                            <span className="al-two">
                              <ActButton
                                small
                                primary
                                blocker={leaseWhy}
                                quiet={!!why || !!sameWhy}
                                onClick={() => openWith(o, 'lease')}
                                title={(() => {
                                  const dep = depositFor(state, viewer, o.m.id);
                                  return `달 리스료 ${fmtMoney(leaseRent(state, o.m))}${dep > 0 ? `, 보증금 ${fmtMoney(dep)} (돌려줄 때 돌려받아요)` : ', 첫해 보증금 없음'}`;
                                })()}
                              >
                                리스로 열기
                              </ActButton>
                              {used && (
                                <ActButton small blocker={usedWhy} quiet={!!why || !!sameWhy} onClick={() => openWith(o, 'used')} title={`${used.age}년 된 중고`}>
                                  중고 {fmtMoney(used.price)}
                                </ActButton>
                              )}
                            </span>
                            {sameWhy && <small className="al-why">{sameWhy}</small>}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {mine.length > 0 && (
                <>
                  <h5 className="al-fin-sub">
                    <FinIcon kind="parked" size={16} /> 내 비행기로 열기 <small>리스료는 이미 내는 중</small>
                  </h5>
                  <ul className="al-options">
                    {mine.map((o) => (
                      <li key={o.p.id}>
                        <PlaneImage model={o.m.id} paint={{ main: color.main, dark: color.dark, shape: SEAT_SHAPES[me.seat] }} className="al-plane-chip al-plane-chip-big" />
                        <div className="al-opt-body">
                          <span className="al-opt-text">
                            <b>{o.m.name}</b>
                            <span className="al-chips">
                              <span className={`al-chip-static${o.p.legs.length === 0 ? ' al-pos' : ''}`}>{o.p.legs.length === 0 ? '쉬는 중' : '남는 시간으로'}</span>
                              <span className="al-chip-static">주 {o.freq}회</span>
                            </span>
                            <span className="al-opt-bars">
                              <span title={`탑승률 ${pct(o.e.lf)}`}>
                                <LoadMeter lf={o.e.lf} /> <small>탑승률 {pct(o.e.lf)}</small>
                              </span>
                              <span>
                                <small>
                                  이 노선 이익 <b className={o.e.profit < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(o.e.profit)}</b>/달
                                </small>
                              </span>
                            </span>
                          </span>
                          <ActButton small blocker={why} quiet onClick={() => openWith(o, o.p.id)}>
                            이 비행기로 열기
                          </ActButton>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="al-nr-foot">
                <ActButton blocker={why} quiet onClick={openRouteOnly} testId="al-open-route-only">
                  노선만 열기 (비행기는 나중에)
                </ActButton>
                <MoreInfo>이익은 라이벌이 지금 그대로일 때의 어림이에요. 계절과 사건에 따라 달라져요. 너무 가까운 도시는 기차를 타는 손님이 많아서 비행기 손님이 적어요.</MoreInfo>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
