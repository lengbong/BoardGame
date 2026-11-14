import { useMemo } from 'react';
import { bestTimes } from './ai';
import { CITY, dist } from './cities';
import { fmtFine } from './format';
import { timesBlocker } from './rules';
import { routeFreq, slotCapacity } from './simulate';
import { BAND_INFO, bandCaps, bandCounts, bandUsed, curfew, timeFit, type Times } from './timetable';
import { yearOf } from './time';
import type { AirlineAction, AirlineState, Route } from './types';
import { ActButton } from './ui';

const notMine = '내 차례에만 할 수 있어요';

const PRESETS: { label: string; times: Times; title: string }[] = [
  { label: '💼 아침·저녁', times: [4, 1, 4, 0], title: '출장 손님은 아침에 떠나 저녁에 돌아오는 편을 좋아해요' },
  { label: '고르게', times: [3, 3, 3, 0], title: '세 시간대에 고루' },
  { label: '🏖️ 낮 많이', times: [2, 4, 3, 0], title: '여행 손님은 느긋한 낮 편을 좋아해요' },
  { label: '🌙 밤까지', times: [2, 2, 3, 2], title: '장거리는 밤에 떠서 자면서 가도 괜찮아요' },
];

/** 노선 시간표: 주간 운항을 아침·낮·저녁·밤에 나누고, 시간대마다 두 공항 슬롯을 보여 준다 */
export function TimetableCard({ state, viewer, canAct, perform, route }: { state: AirlineState; viewer: number; canAct: boolean; perform: (a: AirlineAction) => void; route: Route }) {
  const me = state.companies[viewer];
  const total = routeFreq(me, route.id);
  const counts = bandCounts(route.times, total);
  const year = yearOf(state.q);
  const d = dist(route.a, route.b);
  const fit = timeFit(route.times, d);
  const night = [route.a, route.b].filter((c) => curfew(c, year));
  const freqOf = (id: number) => routeFreq(me, id);
  const room = [route.a, route.b].map((city) => {
    const cap = bandCaps(state, viewer, city, slotCapacity(state, viewer, city));
    const used = bandUsed(me, city, freqOf, route.id);
    return { city, left: cap.map((x, i) => Math.max(0, x - used[i])) as Times };
  });
  const best = useMemo(() => (canAct ? bestTimes(state, viewer, route.id) : null), [state, viewer, route.id, canAct]);
  const block = canAct ? null : notMine;

  // 한 시간대를 하나 늘리면 가장 많은 다른 시간대에서 하나 빼고, 줄이면 손님이 가장 좋아하는 다른 시간대로 옮긴다 (합은 그대로)
  const move = (band: number, delta: 1 | -1): Times | null => {
    if (total <= 0) {
      const t = [...route.times] as Times;
      t[band] = Math.max(0, t[band] + delta);
      return t;
    }
    const next = [...counts] as Times;
    if (delta > 0) {
      let from = -1;
      for (let i = 0; i < 4; i++) if (i !== band && next[i] > 0 && (from < 0 || next[i] > next[from])) from = i;
      if (from < 0) return null;
      next[from]--;
      next[band]++;
    } else {
      if (next[band] <= 0) return null;
      let to = -1;
      let bestFit = -1;
      for (let i = 0; i < 4; i++) {
        if (i === band || (i === 3 && night.length > 0)) continue;
        const t = [...next] as Times;
        t[band]--;
        t[i]++;
        const f = timeFit(t, d);
        const v = f.biz + f.leisure;
        if (v > bestFit) {
          bestFit = v;
          to = i;
        }
      }
      if (to < 0) return null;
      next[band]--;
      next[to]++;
    }
    return next;
  };

  return (
    <section className="al-card al-timetable" data-testid="al-timetable">
      <h4>
        🕑 운항 시간표 <small>주 {total}회 왕복을 시간대에 나누기</small>
      </h4>
      <div className="al-tt-bands">
        {BAND_INFO.map((b, i) => {
          const closed = i === 3 && night.length > 0;
          const up = move(i, 1);
          const down = move(i, -1);
          const upWhy = closed ? '밤 운항 금지' : !up ? '옮길 편이 없어요' : timesBlocker(state, viewer, route.id, up);
          const downWhy = !down ? '뺄 편이 없어요' : timesBlocker(state, viewer, route.id, down);
          return (
            <div key={b.name} className={`al-tt-band${counts[i] > 0 ? ' al-on' : ''}${closed ? ' al-closed' : ''}`} data-testid={`al-band-${i}`}>
              <span className="al-tt-name">
                {b.icon} {b.name} <small>{b.hours}</small>
              </span>
              <span className="al-stepper" role="group" aria-label={`${b.name} 주간 편수`}>
                <button type="button" className="al-step-btn" disabled={!!block || !!downWhy} title={downWhy ?? undefined} onClick={() => down && perform({ type: 'setTimes', route: route.id, times: down })} aria-label={`${b.name} 줄이기`}>
                  −
                </button>
                <b>{total > 0 ? `주 ${counts[i]}` : route.times[i]}</b>
                <button type="button" className="al-step-btn" disabled={!!block || !!upWhy} title={upWhy ?? undefined} onClick={() => up && perform({ type: 'setTimes', route: route.id, times: up })} aria-label={`${b.name} 늘리기`}>
                  +
                </button>
              </span>
              <small className="al-muted al-tt-room">
                {closed
                  ? `🚫 ${night.map((c) => CITY[c].name).join('·')} 밤 운항 금지`
                  : room.map((r) => `${CITY[r.city].name} ${Math.max(0, r.left[i] - counts[i])}`).join(' · ') + ' 남음'}
              </small>
            </div>
          );
        })}
      </div>
      <p className="al-tt-fit">
        <span className={`tag ${fit.biz >= 1.02 ? 'al-pos' : fit.biz < 0.95 ? 'al-neg' : ''}`}>💼 사업 손님 {Math.round(fit.biz * 100)}%</span>
        <span className={`tag ${fit.leisure >= 1.02 ? 'al-pos' : fit.leisure < 0.95 ? 'al-neg' : ''}`}>🏖️ 관광 손님 {Math.round(fit.leisure * 100)}%</span>
        <span className="al-muted">시간대가 손님에게 맞는 정도 (100%가 보통)</span>
      </p>
      <div className="al-fare-quick al-tt-presets">
        {PRESETS.map((p) => {
          const why = p.times[3] > 0 && night.length > 0 ? '밤 운항 금지' : timesBlocker(state, viewer, route.id, p.times);
          const on = p.times.every((x, i) => x === route.times[i]);
          return (
            <button key={p.label} type="button" className={`al-chip${on ? ' al-on' : ''}`} disabled={!!block || (!!why && !on)} title={why ?? p.title} onClick={() => perform({ type: 'setTimes', route: route.id, times: p.times })}>
              {p.label}
            </button>
          );
        })}
      </div>
      {best && (
        <div className="al-tt-best">
          <ActButton small primary blocker={block} onClick={() => perform({ type: 'setTimes', route: route.id, times: best.times })} testId="al-times-best">
            추천 시간표로 바꾸기 (달 이익 +{fmtFine(best.gain)})
          </ActButton>
        </div>
      )}
      <p className="al-muted al-tip">
        사업 손님은 아침·저녁 편을, 관광 손님은 낮 편을 좋아해요. 6,000km 넘는 장거리는 밤에 떠도 괜찮아요. 큰 공항은 아침·저녁 슬롯이 붐벼서, 한 시간대에 몰면 지연이 늘어요.
      </p>
    </section>
  );
}
