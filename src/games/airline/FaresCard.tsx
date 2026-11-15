import { useMemo } from 'react';
import { CLASS_INFO } from './cabin';
import { fareText, fmtFine, fmtMoney, pct } from './format';
import { FARE_MAX, FARE_MIN, fareMin } from './rules';
import { estimateExisting, type RouteEstimate } from './simulate';
import type { AirlineAction, AirlineState, Route } from './types';
import { ActButton } from './ui';

const notMine = '내 차례에만 할 수 있어요';

type Cls = 'c' | 'f' | 'k';

const STEPS: Record<Cls, number[]> = { c: [-20, -10, 0, 10, 20, 30], f: [-20, -10, 0, 10, 20, 30], k: [-20, -10, 0, 10, 20] };

/** 등급마다 이번 달 이익이 가장 큰 운임 (다른 등급은 지금 그대로) */
function recommend(state: AirlineState, viewer: number, route: Route, est: RouteEstimate): { fares: Partial<Record<Cls, number>>; gain: number } | null {
  const base = est.profit;
  const out: Partial<Record<Cls, number>> = {};
  let gain = 0;
  const has: Record<Cls, boolean> = { c: est.cls.seats[1] > 0, f: est.cls.seats[0] > 0, k: est.cargoCap > 0 };
  const cur: Record<Cls, number> = { c: route.fareC ?? 0, f: route.fareF ?? 0, k: route.fareK ?? 0 };
  for (const cls of ['c', 'f', 'k'] as const) {
    if (!has[cls]) continue;
    let best = cur[cls];
    let bestP = base;
    for (const v of STEPS[cls]) {
      if (v === cur[cls]) continue;
      const e = estimateExisting(state, viewer, route, cls === 'c' ? { fareC: v } : cls === 'f' ? { fareF: v } : { fareK: v });
      if (e.profit > bestP + 0.05) {
        bestP = e.profit;
        best = v;
      }
    }
    if (best !== cur[cls]) {
      out[cls] = best;
      gain += bestP - base;
    }
  }
  return gain > 0.05 ? { fares: out, gain } : null;
}

function FareSlider({ label, value, min, max, disabled, onChange, testId }: { label: string; value: number; min: number; max: number; disabled: boolean; onChange: (v: number) => void; testId: string }) {
  return (
    <div className="al-fare-row">
      <span className="al-fare-label">
        {label} <b>{fareText(value)}</b>
      </span>
      <input type="range" min={min} max={max} step={5} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} aria-label={`${label} 운임 조정`} data-testid={testId} />
    </div>
  );
}

/** 운임: 이코노미(·저가항공은 더 싸게)·비즈니스·일등석·화물, 등급마다 탑승률과 수입, 추천 운임 */
export function FaresCard({ state, viewer, canAct, perform, route, est }: { state: AirlineState; viewer: number; canAct: boolean; perform: (a: AirlineAction) => void; route: Route; est: RouteEstimate }) {
  const me = state.companies[viewer];
  const rec = useMemo(() => (canAct ? recommend(state, viewer, route, est) : null), [state, viewer, route, est, canAct]);
  const hasY = est.cls.seats[2] > 0 || est.seatsWeek > 0;
  const rows = (['f', 'c', 'y'] as const)
    .map((k, i) => ({ k, i, seats: est.cls.seats[i], pax: est.cls.pax[i], rev: est.cls.rev[i] }))
    .filter((x) => x.seats > 0);
  const last = route.stats?.cls;
  const setClass = (cls: Cls, fare: number) => perform({ type: 'setClassFare', route: route.id, cls, fare });
  return (
    <section className="al-card al-fares" data-testid="al-fares">
      <h4>
        운임 <small>{me.model === 'lcc' ? '저가항공은 −50%까지 싸게 팔 수 있어요' : '등급마다 따로 정해요'}</small>
      </h4>
      {hasY && (
        <>
          <FareSlider label="💺 이코노미" value={route.fare} min={fareMin(me)} max={FARE_MAX} disabled={!canAct} onChange={(v) => perform({ type: 'setFare', route: route.id, fare: v })} testId="al-fare" />
          <div className="al-fare-quick">
            {(me.model === 'lcc' ? [-40, -25, 0] : [-15, 0, 15]).map((f) => (
              <button key={f} type="button" className={`al-chip${route.fare === f ? ' al-on' : ''}`} disabled={!canAct} onClick={() => perform({ type: 'setFare', route: route.id, fare: f })}>
                {fareText(f)}
              </button>
            ))}
          </div>
        </>
      )}
      {est.cls.seats[1] > 0 && <FareSlider label="💼 비즈니스" value={route.fareC ?? 0} min={FARE_MIN} max={FARE_MAX} disabled={!canAct} onChange={(v) => setClass('c', v)} testId="al-fare-c" />}
      {est.cls.seats[0] > 0 && <FareSlider label="👑 일등석" value={route.fareF ?? 0} min={FARE_MIN} max={FARE_MAX} disabled={!canAct} onChange={(v) => setClass('f', v)} testId="al-fare-f" />}
      {est.cargoCap > 0 && <FareSlider label="📦 화물" value={route.fareK ?? 0} min={FARE_MIN} max={FARE_MAX} disabled={!canAct} onChange={(v) => setClass('k', v)} testId="al-fare-k" />}
      {(rows.length > 0 || est.cargoCap > 0) && (
        <div className="al-table-wrap">
          <table className="al-table al-class-table">
            <thead>
              <tr>
                <th>이번 달 어림</th>
                <th>좌석·짐칸 (주)</th>
                <th>탑승률</th>
                <th>달 수입</th>
                {last && <th>지난달</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.k}>
                  <th>
                    {CLASS_INFO[x.k].icon} {CLASS_INFO[x.k].name}
                  </th>
                  <td>{Math.round(x.seats).toLocaleString('ko-KR')}석</td>
                  <td className={x.pax / x.seats > 0.97 ? 'al-pos' : x.pax / x.seats < 0.5 ? 'al-neg' : ''}>{pct(x.pax / x.seats)}</td>
                  <td>{fmtFine(x.rev)}</td>
                  {last && <td className="al-muted">{last.seats[x.i] > 0 ? pct(last.pax[x.i] / last.seats[x.i]) : '—'}</td>}
                </tr>
              ))}
              {est.cargoCap > 0 && (
                <tr>
                  <th>📦 화물</th>
                  <td>{Math.round(est.cargoCap).toLocaleString('ko-KR')}톤</td>
                  <td className={est.cargoT / est.cargoCap > 0.97 ? 'al-pos' : est.cargoT / est.cargoCap < 0.5 ? 'al-neg' : ''}>{pct(est.cargoT / est.cargoCap)}</td>
                  <td>{fmtFine(est.cargoRev)}</td>
                  {last && <td className="al-muted">{route.stats?.cargo && route.stats.cargo.cap > 0 ? pct(route.stats.cargo.t / route.stats.cargo.cap) : '—'}</td>}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {rec && (
        <div className="al-tt-best">
          <ActButton
            small
            primary
            blocker={canAct ? null : notMine}
            onClick={() => {
              for (const [cls, v] of Object.entries(rec.fares) as [Cls, number][]) setClass(cls, v);
            }}
            testId="al-fares-best"
          >
            추천 운임으로 ({(Object.entries(rec.fares) as [Cls, number][]).map(([cls, v]) => `${cls === 'c' ? '비즈니스' : cls === 'f' ? '일등석' : '화물'} ${fareText(v)}`).join(' · ')}, 달 +{fmtMoney(rec.gain)})
          </ActButton>
        </div>
      )}
      <p className="al-muted al-tip">
        싸면 손님이 늘고(특히 관광객), 비싸면 한 명에게 더 받아요. 일등석·비즈니스 손님은 값에 덜 민감하지만 너무 비싸면 아래 등급으로 내려가요. 윗등급 자리가 남으면 넘치는 이코노미 손님이 이코노미 값에 타요.
      </p>
    </section>
  );
}
