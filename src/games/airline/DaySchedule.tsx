import { MODEL } from './aircraft';
import { coColors, inkOn } from './brand';
import { CITY, dist } from './cities';
import { legHours, routeOf } from './simulate';
import { BAND_INFO, bandCounts } from './timetable';
import type { AirlineState, Plane } from './types';

/**
 * 하루 운항표: 비행기마다 가장 바쁜 하루를 시간 막대로 보여 준다 (05시 → 다음 날 05시).
 * 노선 시간표(아침·낮·저녁·밤 몫)대로 왕복을 놓고, 비행기가 앞 편을 마쳐야 다음 편을 뜬다.
 */

const START = 5;
const SPAN = 24;

export interface DayLeg {
  route: number;
  from: string;
  to: string;
  dep: number;
  arr: number;
  band: number;
}

/** 한 비행기의 가장 바쁜 하루 (출발·도착 시각은 05시부터 센 시간) */
export function planeDay(state: AirlineState, ci: number, plane: Plane): { legs: DayLeg[]; spill: number } {
  const c = state.companies[ci];
  const m = MODEL[plane.model];
  const trips: { route: number; band: number; a: string; b: string; h: number }[] = [];
  for (const l of plane.legs) {
    const r = routeOf(c, l.route);
    if (!r || l.freq <= 0) continue;
    const week = bandCounts(r.times, l.freq);
    const perDay = Math.ceil(l.freq / 7);
    const day = bandCounts(week, perDay);
    const h = legHours(m, dist(r.a, r.b));
    day.forEach((n, band) => {
      for (let k = 0; k < n; k++) trips.push({ route: r.id, band, a: r.a, b: r.b, h });
    });
  }
  trips.sort((x, y) => x.band - y.band || x.route - y.route);
  const legs: DayLeg[] = [];
  let cursor = BAND_INFO[0].start;
  let spill = 0;
  for (const t of trips) {
    const dep = Math.max(cursor, BAND_INFO[t.band].start);
    if (dep >= START + SPAN) {
      spill++;
      continue;
    }
    legs.push({ route: t.route, from: t.a, to: t.b, dep, arr: dep + t.h, band: t.band });
    legs.push({ route: t.route, from: t.b, to: t.a, dep: dep + t.h, arr: dep + 2 * t.h, band: t.band });
    cursor = dep + 2 * t.h;
  }
  return { legs, spill };
}

const hh = (h: number) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`;

export function DaySchedule({ state, ci, planes, highlight, limit = 10 }: { state: AirlineState; ci: number; planes: Plane[]; highlight?: number; limit?: number }) {
  const c = state.companies[ci];
  const col = coColors(c);
  const ink = inkOn(col.main);
  const flying = planes.filter((p) => p.legs.some((l) => l.freq > 0));
  if (flying.length === 0) return <p className="al-muted">노선을 나는 비행기가 없어요.</p>;
  const shown = flying.slice(0, limit);
  const pos = (h: number) => `${(Math.max(0, Math.min(SPAN, h - START)) / SPAN) * 100}%`;
  const width = (a: number, b: number) => `${((Math.min(START + SPAN, b) - Math.max(START, a)) / SPAN) * 100}%`;
  return (
    <div className="al-day" data-testid="al-day-schedule">
      <div className="al-day-row al-day-axis" aria-hidden="true">
        <span className="al-day-name" />
        <div className="al-day-track al-day-track-axis">
          {BAND_INFO.map((b) => (
            <span key={b.name} className="al-day-band-label" style={{ left: pos(b.start), width: width(b.start, b.start + b.len) }}>
              {b.icon} {b.name}
            </span>
          ))}
        </div>
      </div>
      {shown.map((p) => {
        const { legs, spill } = planeDay(state, ci, p);
        const m = MODEL[p.model];
        return (
          <div key={p.id} className="al-day-row">
            <span className="al-day-name" title={`${m.name} #${p.id}`}>
              {m.name}
            </span>
            <div className="al-day-track" role="img" aria-label={`${m.name} 하루 운항: ${legs.map((l) => `${CITY[l.from].name}→${CITY[l.to].name} ${hh(l.dep)}`).join(', ') || '없음'}`}>
              {BAND_INFO.map((b, i) => (
                <span key={b.name} className={`al-day-bg al-day-bg-${i}`} style={{ left: pos(b.start), width: width(b.start, b.start + b.len) }} />
              ))}
              {legs.map((l, i) => {
                if (l.dep >= START + SPAN) return null;
                const dim = highlight !== undefined && l.route !== highlight;
                return (
                  <span
                    key={i}
                    className={`al-day-leg${dim ? ' al-dim' : ''}`}
                    style={{ left: pos(l.dep), width: width(l.dep, l.arr), background: col.main, color: ink }}
                    title={`${CITY[l.from].name} → ${CITY[l.to].name} · ${hh(l.dep)}–${hh(l.arr)}${l.arr > START + SPAN ? ' (다음 날 도착)' : ''}`}
                  >
                    {CITY[l.to].name}
                  </span>
                );
              })}
            </div>
            {spill > 0 && <small className="al-muted al-day-spill">+{spill}왕복 다음 날</small>}
          </div>
        );
      })}
      {flying.length > shown.length && <p className="al-muted al-tip">비행기 {flying.length - shown.length}대 더 있어요.</p>}
      <p className="al-muted al-tip">어느 바쁜 하루를 어림한 것이에요 (05시 → 다음 날 05시). 막대 하나가 한 편이고, 노선의 시간대 몫대로 놓았어요.</p>
    </div>
  );
}
