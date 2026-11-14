import { useMemo, useState } from 'react';
import { coColors } from './brand';
import { MODEL, availableModels } from './aircraft';
import { openSuggestion, type Candidate } from './ai';
import { PlaneArt, SEAT_SHAPES } from './Art';
import { AIRPORT_INFO, CITIES, CITY, REGIONS, REGION_INFO, airportClass, dist, pairKey } from './cities';
import { fareText, fmtMoney, fmtPax, km, pct, signedMoney } from './format';
import { FARE_MAX, FARE_MIN, applyAction, assignBlocker, bestFreq, buyBlocker, depositFor, maxRangeNow, routeBlocker, routeOnPair, usedBlocker } from './rules';
import {
  WEEK_HOURS,
  branchCost,
  branchUpkeep,
  draftsOf,
  estimateExisting,
  estimateRoute,
  legFreq,
  legHours,
  leaseRent,
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
import { ActButton, CoName, LoadMeter, Stepper } from './ui';

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
                    {CITY[r.a].name} ⇄ {CITY[r.b].name}
                    {warn && <span className={`al-flag${warn === '꽉 참' ? ' al-flag-warn' : ''}`}>{warn}</span>}
                  </span>
                  <span className="al-rr-sub">
                    <small>
                      ✈️{planes.length} · 주 {freq}회
                    </small>
                    {st && <LoadMeter lf={st.lf} />}
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

  // 이 노선에 보태기 좋은 새 기종 (리스로 한 대 더 띄웠을 때 늘어나는 이익)
  const extra = useMemo(() => {
    const out: { m: ModelDef; freq: number; gain: number }[] = [];
    const base = draftsOf(state, me, r.id);
    const left = Math.min(slotCapacity(state, viewer, r.a) - slotsUsed(me, r.a), slotCapacity(state, viewer, r.b) - slotsUsed(me, r.b));
    for (const m of availableModels(year)) {
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
      <header className="al-editor-head">
        <div>
          <h3>
            <button type="button" className="al-link" onClick={() => onShowCity(r.a)}>
              {CITY[r.a].name}
            </button>{' '}
            ⇄{' '}
            <button type="button" className="al-link" onClick={() => onShowCity(r.b)}>
              {CITY[r.b].name}
            </button>{' '}
            <small>{km(d)}</small>
          </h3>
          <p className="al-muted">
            한 방향 주간 잠재 손님 {fmtPax(dem.biz + dem.leisure)} (사업 {pct(dem.biz / Math.max(1, dem.biz + dem.leisure))}) · 라이벌 {rivals.length}곳
          </p>
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
            <h4>띄우는 비행기</h4>
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
                    <PlaneArt body={m.body} engines={m.engines} color={color.main} dark={color.dark} shape={SEAT_SHAPES[me.seat]} width={58} />
                    <span className="al-pr-name">
                      <b>{m.name}</b>
                      <small>
                        {m.seats}석 · {p.leased ? '리스' : '내 것'} · 가동 {Math.round(use * 100)}%
                      </small>
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
                <h5>내 비행기 더 넣기</h5>
                <ul className="al-idle-rows">
                  {others.slice(0, 8).map(({ p, f, idle }) => {
                    const m = MODEL[p.model];
                    const why = f > 0 ? null : assignBlocker(state, viewer, p.id, r.id, 1) ?? '슬롯이 모자라요';
                    const spare = WEEK_HOURS - planeHours(me, p);
                    return (
                      <li key={p.id}>
                        <span>
                          {m.name}{' '}
                          <small className="al-muted">
                            ({Math.floor(planeAge(state, p))}년 · {idle ? '쉬는 중' : `다른 노선을 날고 ${Math.round(spare)}시간 남음`})
                          </small>
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
                <h5>새로 들여서 넣기</h5>
                <ul className="al-idle-rows">
                  {extra.map(({ m, freq, gain }) => {
                    const used = state.market.find((u) => u.model === m.id);
                    const deposit = depositFor(state, viewer, m.id);
                    return (
                      <li key={m.id}>
                        <span>
                          {m.name} <small className="al-muted">주 {freq}회 · 이익 {signedMoney(gain)}</small>
                        </span>
                        <span className="al-two">
                          <ActButton
                            small
                            blocker={canAct ? buyBlocker(state, viewer, m.id, true) : notMine}
                            onClick={() => acquire({ lease: m.id })}
                            title={deposit > 0 ? `보증금 ${fmtMoney(deposit)} (돌려줄 때 돌려받아요)` : '첫해에는 보증금이 없어요'}
                          >
                            리스 · 분기 {fmtMoney(leaseRent(state, m))}
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
                <p className="al-muted al-tip">새 비행기 주문은 ‘비행기’ 화면에서 해요 (싸지만 몇 분기 뒤에 와요).</p>
              </>
            )}
          </section>
          <section className="al-card">
            <h4>
              운임 <small>{fareText(r.fare)}</small>
            </h4>
            <div className="al-fare">
              <span>싸게</span>
              <input
                type="range"
                min={FARE_MIN}
                max={FARE_MAX}
                step={5}
                value={r.fare}
                disabled={!canAct}
                onChange={(e) => perform({ type: 'setFare', route: r.id, fare: Number(e.target.value) })}
                aria-label="운임 조정"
                data-testid="al-fare"
              />
              <span>비싸게</span>
            </div>
            <div className="al-fare-quick">
              {[-15, 0, 15].map((f) => (
                <button key={f} type="button" className={`al-chip${r.fare === f ? ' al-on' : ''}`} disabled={!canAct} onClick={() => perform({ type: 'setFare', route: r.id, fare: f })}>
                  {fareText(f)}
                </button>
              ))}
            </div>
            <p className="al-muted al-tip">싸면 손님이 늘고(특히 관광객), 비싸면 한 명에게 더 받아요. 좌석이 꽉 차면 올려 보고, 많이 비면 내려 보세요.</p>
          </section>
        </div>
        <div className="al-editor-right">
          <EstimateCard est={est} lastProfit={r.stats?.profit ?? null} lastLf={r.stats?.lf ?? null} />
          {rivals.length > 0 && (
            <section className="al-card">
              <h4>라이벌</h4>
              <ul className="al-rivals">
                {rivals.map(({ c, i, rt }) => {
                  const ps = planesOnRoute(c, rt!.id);
                  return (
                    <li key={i}>
                      <CoName c={c} />
                      <small>
                        {ps.map((p) => `${MODEL[p.model].name}×${legFreq(p, rt!.id)}`).join(', ') || '비행기 없음'} · {fareText(rt!.fare)}
                        {rt!.stats ? ` · 탑승률 ${pct(rt!.stats.lf)}` : ''}
                      </small>
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

const COST_PARTS: { key: keyof RouteEstimate['cost']; name: string; cls: string }[] = [
  { key: 'fuel', name: '연료', cls: 'al-c-fuel' },
  { key: 'crew', name: '승무원·정비', cls: 'al-c-crew' },
  { key: 'airport', name: '공항', cls: 'al-c-apt' },
  { key: 'service', name: '기내 서비스', cls: 'al-c-svc' },
  { key: 'sales', name: '판매 수수료', cls: 'al-c-sales' },
  { key: 'lease', name: '리스·보험', cls: 'al-c-lease' },
];

/** 이번 분기 어림 (손님·탑승률·수입·비용·이익) */
export function EstimateCard({ est, lastProfit, lastLf, title = '이번 분기 어림' }: { est: RouteEstimate; lastProfit: number | null; lastLf: number | null; title?: string }) {
  const total = Math.max(est.revenue, est.cost.total, 1);
  return (
    <section className="al-card al-estimate" aria-live="polite">
      <h4>{title}</h4>
      <div className="al-est-big">
        <span>예상 이익</span>
        <b className={est.profit < 0 ? 'al-neg' : 'al-pos'} data-testid="al-est-profit">
          {signedMoney(est.profit)}
        </b>
      </div>
      <dl className="al-est-grid">
        <div>
          <dt>주간 손님 (한 방향)</dt>
          <dd>
            {fmtPax(est.paxWeek)} / 좌석 {est.seatsWeek.toLocaleString('ko-KR')}
          </dd>
        </div>
        <div>
          <dt>탑승률</dt>
          <dd>
            <LoadMeter lf={est.lf} /> {pct(est.lf)}
          </dd>
        </div>
        <div>
          <dt>이 두 도시 손님 중 내 몫</dt>
          <dd>{pct(est.share)}</dd>
        </div>
        <div>
          <dt>분기 운임 수입</dt>
          <dd>{fmtMoney(est.revenue)}</dd>
        </div>
      </dl>
      <div className="al-costbar" aria-hidden="true">
        <span className="al-c-rev" style={{ width: `${(est.revenue / total) * 100}%` }} />
      </div>
      <div className="al-costbar" aria-hidden="true">
        {COST_PARTS.map((p) => (
          <span key={p.key} className={p.cls} style={{ width: `${((est.cost[p.key] as number) / total) * 100}%` }} />
        ))}
      </div>
      <ul className="al-cost-legend">
        <li>
          <i className="al-c-rev" /> 수입 {fmtMoney(est.revenue)}
        </li>
        {COST_PARTS.map((p) => (
          <li key={p.key}>
            <i className={p.cls} /> {p.name} {fmtMoney(est.cost[p.key] as number)}
          </li>
        ))}
      </ul>
      {lastProfit !== null && (
        <p className="al-muted al-last">
          지난 분기 실제: 이익 {signedMoney(lastProfit)}
          {lastLf !== null && ` · 탑승률 ${pct(lastLf)}`}
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

  const to = planner.to;
  const options = useMemo(() => {
    if (!to) return [];
    const d = dist(from, to);
    const out: { m: ModelDef; freq: number; e: RouteEstimate }[] = [];
    const left = Math.min(slotCapacity(state, viewer, from) - slotsUsed(me, from), slotCapacity(state, viewer, to) - slotsUsed(me, to));
    const dem = pairDemand(state, from, to);
    for (const m of availableModels(year)) {
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
        <h3>새 노선 찾기</h3>
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
                  <small>
                    {km(x.d)} · 주 {fmtPax(x.demand)}
                    {x.rivals > 0 ? ` · 라이벌 ${x.rivals}` : ''} · {x.branch ? '지점 ✓' : `지점 ${fmtMoney(branchCost(x.c.id, state.q))}`}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="al-nr-right">
          {!to ? (
            <p className="al-muted al-empty-main">왼쪽에서 갈 도시를 고르세요. 주간 손님이 많고 라이벌이 적은 곳이 좋아요. 너무 가까운 곳은 기차를 타서 손님이 적어요.</p>
          ) : (
            <>
              <h4>
                {CITY[from].name} ⇄ {CITY[to].name} <small>{km(dist(from, to))}</small>
              </h4>
              <p className="al-muted">
                {AIRPORT_INFO[airportClass(CITY[to], year)].name}
                {needBranch.length > 0 && ` · 지점 새로 열기: ${needBranch.map((c) => `${CITY[c].name} ${fmtMoney(branchCost(c, state.q))} (유지비 분기 ${fmtMoney(branchUpkeep(c, state.q))})`).join(', ')}`}
              </p>
              {options.length === 0 ? (
                <p className="al-why">지금 이 노선에 띄울 수 있는 비행기가 없어요. (거리·공항 크기·슬롯을 확인하세요)</p>
              ) : (
                <ul className="al-options">
                  {options.map((o) => (
                    <li key={o.m.id}>
                      <PlaneArt body={o.m.body} engines={o.m.engines} color={color.main} dark={color.dark} shape={SEAT_SHAPES[me.seat]} width={70} />
                      <span className="al-opt-text">
                        <b>{o.m.name}</b>
                        <small>
                          주 {o.freq}회 · {o.m.seats}석 · 탑승률 {pct(o.e.lf)}
                        </small>
                        <small>
                          이익 <b className={o.e.profit < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(o.e.profit)}</b>/분기
                        </small>
                      </span>
                      <span className="al-two">
                        <ActButton
                          small
                          primary
                          blocker={why ?? buyBlocker(state, viewer, o.m.id, true)}
                          onClick={() => openWith(o, 'lease')}
                          title={(() => {
                            const dep = depositFor(state, viewer, o.m.id);
                            return `분기 리스료 ${fmtMoney(leaseRent(state, o.m))}${dep > 0 ? `, 보증금 ${fmtMoney(dep)} (돌려줄 때 돌려받아요)` : ', 첫해 보증금 없음'}`;
                          })()}
                        >
                          리스로 열기
                        </ActButton>
                        {(() => {
                          const used = state.market.find((u) => u.model === o.m.id);
                          return used ? (
                            <ActButton small blocker={why ?? usedBlocker(state, viewer, used.id)} onClick={() => openWith(o, 'used')} title={`${used.age}년 된 중고`}>
                              중고 {fmtMoney(used.price)}
                            </ActButton>
                          ) : null;
                        })()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {mine.length > 0 && (
                <>
                  <h5>내 비행기로 열기</h5>
                  <ul className="al-options">
                    {mine.map((o) => (
                      <li key={o.p.id}>
                        <PlaneArt body={o.m.body} engines={o.m.engines} color={color.main} dark={color.dark} shape={SEAT_SHAPES[me.seat]} width={70} />
                        <span className="al-opt-text">
                          <b>{o.m.name}</b>
                          <small>
                            {o.p.legs.length === 0 ? '쉬는 중' : `남는 시간으로`} 주 {o.freq}회 · 탑승률 {pct(o.e.lf)}
                          </small>
                          <small>
                            이 노선 이익 <b className={o.e.profit < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(o.e.profit)}</b>/분기 <span className="al-muted">(리스료는 이미 내는 중)</span>
                          </small>
                        </span>
                        <ActButton small blocker={why} onClick={() => openWith(o, o.p.id)}>
                          이 비행기로 열기
                        </ActButton>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="al-nr-foot">
                <ActButton blocker={why} onClick={openRouteOnly} testId="al-open-route-only">
                  노선만 열기 (비행기는 나중에)
                </ActButton>
                <p className="al-muted al-tip">이익은 라이벌이 지금 그대로일 때의 어림이에요. 계절과 사건에 따라 달라져요.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
