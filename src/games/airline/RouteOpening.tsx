import type { CSSProperties } from 'react';
import { availableModels } from './aircraft';
import { LandmarkIcon, SEAT_SHAPES } from './Art';
import { coColors } from './brand';
import { CITY, dist } from './cities';
import { km } from './format';
import { planeImageUrl } from './PlaneImage';
import { legFreq } from './simulate';
import { yearOf } from './time';
import type { AirlineState } from './types';

export interface Opening {
  id: number;
  company: number;
  a: string;
  b: string;
  /** 같은 차례에 함께 연 노선 수 (이것 말고) */
  more: number;
}

/** 축하 카드에 그릴 비행기: 그 노선을 나는 비행기 → 회사에 가장 많은 기종 → 그 해에 흔한 기종 */
export function openingModel(state: AirlineState, o: Opening): string {
  const c = state.companies[o.company];
  const route = c.routes.find((r) => (r.a === o.a && r.b === o.b) || (r.a === o.b && r.b === o.a));
  const flying = route ? c.planes.find((p) => legFreq(p, route.id) > 0) : undefined;
  if (flying) return flying.model;
  const counts = new Map<string, number>();
  for (const p of c.planes) counts.set(p.model, (counts.get(p.model) ?? 0) + 1);
  const top = [...counts.entries()].sort((x, y) => y[1] - x[1])[0];
  if (top) return top[0];
  const year = yearOf(state.q);
  const pick = availableModels(year).filter((m) => m.body !== 'sst' && m.seats >= 100).sort((x, y) => Math.abs(x.seats - 160) - Math.abs(y.seats - 160))[0];
  return pick?.id ?? 'a320';
}

const CONFETTI = ['#f5b400', '#e5484d', '#30a46c', '#3e63dd', '#8e4ec6', '#f76b15'];

/** 새 노선 취항 축하 카드 (잠깐 보였다가 사라진다, 누르면 바로 닫힌다) */
export function RouteOpeningCard({ state, opening, onClose }: { state: AirlineState; opening: Opening; onClose: () => void }) {
  const c = state.companies[opening.company];
  const color = coColors(c);
  const a = CITY[opening.a];
  const b = CITY[opening.b];
  const url = planeImageUrl(openingModel(state, opening), { main: color.main, dark: color.dark, shape: SEAT_SHAPES[c.seat] });
  return (
    <div className="al-opening" role="status" aria-live="polite" onClick={onClose} data-testid="al-opening" style={{ '--al-co': color.main } as CSSProperties}>
      <div className="al-opening-card">
        <div className="al-opening-scene">
          <svg className="al-opening-bg" viewBox="0 0 420 128" preserveAspectRatio="none" aria-hidden="true">
            <g fill="#fff" opacity="0.8">
              <ellipse cx="80" cy="30" rx="26" ry="8" />
              <ellipse cx="98" cy="25" rx="15" ry="9" />
              <ellipse cx="300" cy="52" rx="22" ry="7" />
              <ellipse cx="315" cy="48" rx="12" ry="7" />
            </g>
            <path d="M40 96 Q210 -6 380 96" pathLength={1} className="al-opening-arc" />
          </svg>
          {CONFETTI.flatMap((col, i) =>
            [0, 1].map((k) => (
              <span key={`${i}-${k}`} className="al-confetti" style={{ left: `${8 + ((i * 2 + k) * 83) % 92}%`, background: col, animationDelay: `${1.6 + ((i + k * 3) % 6) * 0.09}s` }} />
            )),
          )}
          {url && <img className="al-opening-plane" src={url} alt="" draggable={false} />}
          <span className="al-opening-city al-from">
            <LandmarkIcon kind={a.landmark} size={26} />
            {a.name}
          </span>
          <span className="al-opening-city al-to">
            <LandmarkIcon kind={b.landmark} size={26} />
            {b.name}
          </span>
        </div>
        <div className="al-opening-text">
          <small>🎉 신규 취항{opening.more > 0 ? ` (외 ${opening.more}개)` : ''}</small>
          <b>
            {a.name} ✈ {b.name}
          </b>
          <span>
            {c.name} · {km(dist(a.id, b.id))} · 첫 비행기가 떠나요!
          </span>
        </div>
      </div>
    </div>
  );
}
