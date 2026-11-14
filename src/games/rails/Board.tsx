import { memo, type CSSProperties, type Ref } from 'react';
import { SEAT_COLORS } from '../common/players';
import { stampArt, symbolShape } from './art';
import { ISLANDS_D, JEJU_D, MAINLAND_D, MOUNTAINS, RIVERS_D } from './land';
import { CITIES, CITY, COLOR_INFO, MAP_H, MAP_W, ROUTES, ROUTE_POINTS, STAMPS, STAMP_AT, routePathD, routeSlots, type SlotGeom } from './map';
import type { CityDef, RailsState, SeatIndex } from './types';

export interface FloatFx {
  id: number;
  x: number;
  y: number;
  text: string;
  tone: 'points' | 'stamp' | 'plan' | 'minus';
  until: number;
}

export interface ClaimFx {
  route: number;
  key: number;
  /** 칸마다 나타나는 간격 (ms) */
  step: number;
  /** 첫 칸이 나타나기까지 (ms) */
  delay: number;
}

interface BoardProps {
  state: RailsState;
  svgRef: Ref<SVGSVGElement>;
  /** 지금 깔 수 있어서 반짝일 길 */
  affordable: ReadonlySet<number>;
  hoverRoute: number | null;
  selectedRoute: number | null;
  /** 계획에 마우스를 올렸을 때: 반짝일 도시와 길 */
  focusCities: readonly string[];
  focusRoutes: ReadonlySet<number>;
  /** 손패 색에 마우스를 올렸을 때 그 색 길만 또렷하게 */
  focusColor: string | null;
  claimFx: ClaimFx | null;
  floats: FloatFx[];
  /** 끝났을 때 한 사람의 가장 큰 기찻길 묶음을 보여 준다 */
  showNetwork: { player: number; cities: string[] } | null;
  interactive: boolean;
  onHoverRoute: (id: number | null) => void;
  onSelectRoute: (id: number) => void;
}

/** 자리마다 기차 창문 모양이 달라서 색을 구별하기 어려워도 누구 기차인지 알 수 있다 */
export function CarWindows({ seat, w }: { seat: SeatIndex; w: number }) {
  const x0 = -w / 2;
  switch (seat) {
    case 0:
      return <rect x={x0 + 3} y={-3.6} width={w - 6} height={3.6} rx={1.4} className="rl-car-window" />;
    case 1:
      return (
        <>
          <rect x={x0 + 3} y={-3.6} width={(w - 8) / 2} height={3.6} rx={1} className="rl-car-window" />
          <rect x={1} y={-3.6} width={(w - 8) / 2} height={3.6} rx={1} className="rl-car-window" />
        </>
      );
    case 2:
      return (
        <>
          {[-1, 0, 1].map((k) => (
            <rect key={k} x={k * (w / 3.4) - 1.8} y={-4} width={3.6} height={4.2} rx={0.8} className="rl-car-window" />
          ))}
        </>
      );
    case 3:
      return (
        <>
          {[-1, 1].map((k) => (
            <circle key={k} cx={k * (w / 4.6)} cy={-1.6} r={2.2} className="rl-car-window" />
          ))}
        </>
      );
  }
}

function Car({ s, seat, cls, style }: { s: SlotGeom; seat: SeatIndex; cls: string; style?: CSSProperties }) {
  const c = SEAT_COLORS[seat];
  const w = s.w + 1;
  return (
    <g transform={`translate(${s.x.toFixed(1)} ${s.y.toFixed(1)}) rotate(${s.angle.toFixed(1)})`}>
      <g className={cls} style={style}>
        <rect x={-w / 2} y={-6.2} width={w} height={10.6} rx={3} fill={c.main} stroke={c.dark} strokeWidth={1.3} />
        <CarWindows seat={seat} w={w} />
        <circle cx={-w / 2 + 4.6} cy={4.6} r={2} className="rl-car-wheel" />
        <circle cx={w / 2 - 4.6} cy={4.6} r={2} className="rl-car-wheel" />
      </g>
    </g>
  );
}

const LABEL_POS: Record<CityDef['label'], { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' }> = {
  n: { dx: 0, dy: -12, anchor: 'middle' },
  s: { dx: 0, dy: 20, anchor: 'middle' },
  e: { dx: 11, dy: 4.5, anchor: 'start' },
  w: { dx: -11, dy: 4.5, anchor: 'end' },
  ne: { dx: 8, dy: -10, anchor: 'start' },
  nw: { dx: -8, dy: -10, anchor: 'end' },
  se: { dx: 8, dy: 18, anchor: 'start' },
  sw: { dx: -8, dy: 18, anchor: 'end' },
};

/** 도장 그림을 도시 점 옆 어디에 둘지 */
const STAMP_OFFSET: Record<string, { dx: number; dy: number }> = {
  seoul: { dx: -6, dy: 20 },
  sokcho: { dx: 2, dy: -24 },
  gangneung: { dx: 22, dy: -14 },
  andong: { dx: 20, dy: 14 },
  gyeongju: { dx: 2, dy: 22 },
  jeonju: { dx: -24, dy: 8 },
  busan: { dx: 24, dy: 14 },
  jeju: { dx: 34, dy: 4 },
};

function BoardImpl(props: BoardProps) {
  const { state, affordable, hoverRoute, selectedRoute, focusCities, focusRoutes, focusColor, claimFx, floats, showNetwork, interactive } = props;
  const stampsOn = state.options.stamps;
  const netCities = new Set(showNetwork?.cities ?? []);

  return (
    <svg ref={props.svgRef} className="rl-board" viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="group" aria-label="우리나라 기찻길 지도">
      <defs>
        <linearGradient id="rl-sea-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="rl-sea-stop-a" />
          <stop offset="1" className="rl-sea-stop-b" />
        </linearGradient>
        <pattern id="rl-waves" width="46" height="26" patternUnits="userSpaceOnUse">
          <path d="M4 14 q5 -5 10 0 t10 0" className="rl-wave-mark" />
        </pattern>
      </defs>

      {/* 바다 */}
      <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="url(#rl-sea-grad)" />
      <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="url(#rl-waves)" />
      <text x={18} y={470} className="rl-sea-label" transform="rotate(-90 18 470)">
        서 해
      </text>
      <text x={590} y={78} className="rl-sea-label" transform="rotate(90 590 78)">
        동 해
      </text>
      <text x={372} y={712} className="rl-sea-label">
        남 해
      </text>

      {/* 땅 */}
      <g className="rl-land-shadow" transform="translate(3 4)">
        <path d={MAINLAND_D} />
        <path d={ISLANDS_D} />
        <path d={JEJU_D} />
      </g>
      <path d={MAINLAND_D} className="rl-land" />
      <path d={ISLANDS_D} className="rl-land" />
      <path d={JEJU_D} className="rl-land" />
      {RIVERS_D.map((d) => (
        <path key={d} d={d} className="rl-river" />
      ))}
      {MOUNTAINS.map((m) => (
        <g key={`${m.x}-${m.y}`} transform={`translate(${m.x} ${m.y}) scale(${m.s})`} className="rl-mountain">
          <path d="M-13 7 L-3 -9 L3 -1 L7 -6 L15 7 Z" />
          <path d="M-3 -9 L-6.2 -3.8 L-3.4 -5 L-1.2 -3.2 Z" className="rl-mountain-snow" />
        </g>
      ))}
      {/* 한라산 */}
      <g transform="translate(176 762)" className="rl-mountain">
        <path d="M-18 8 Q-8 -2 -4 -8 L4 -8 Q8 -2 18 8 Z" />
      </g>

      {/* 나침반 */}
      <g transform="translate(570 770)" className="rl-compass" aria-hidden="true">
        <circle r={18} />
        <path d="M0 -16 L5 0 L0 16 L-5 0 Z" />
        <path d="M0 -16 L5 0 L-5 0 Z" className="rl-compass-n" />
        <text y={-21}>북</text>
      </g>

      {/* 점수판 */}
      <g transform="translate(330 744)" className="rl-score-sign" aria-hidden="true">
        <rect x={0} y={0} width={196} height={50} rx={8} />
        <text x={98} y={15} className="rl-score-sign-title">
          기찻길 점수
        </text>
        {[1, 2, 3, 4, 5].map((len, i) => (
          <g key={len} transform={`translate(${12 + i * 37} 26)`}>
            {Array.from({ length: len }, (_, k) => (
              <rect key={k} x={k * 5.4} y={0} width={4.4} height={6} rx={1} className="rl-score-sign-car" />
            ))}
            <text x={13} y={20}>
              {ROUTE_POINTS[len]}점
            </text>
          </g>
        ))}
      </g>

      {/* 기찻길 */}
      <g className="rl-routes">
        {ROUTES.map((r) => {
          const owner = state.owners[r.id];
          const slots = routeSlots(r);
          const d = routePathD(r);
          const info = COLOR_INFO[r.color];
          const isHover = hoverRoute === r.id;
          const isSel = selectedRoute === r.id;
          const canNow = affordable.has(r.id);
          const dim = (focusColor !== null && owner === null && r.color !== focusColor && r.color !== 'gray') || (focusRoutes.size > 0 && !focusRoutes.has(r.id) && owner === null);
          const cls = [
            'rl-route',
            owner !== null && 'rl-route-owned',
            canNow && 'rl-route-can',
            isHover && 'rl-route-hover',
            isSel && 'rl-route-selected',
            focusRoutes.has(r.id) && 'rl-route-focus',
            dim && 'rl-route-dim',
            r.sea && 'rl-route-sea',
          ]
            .filter(Boolean)
            .join(' ');
          const animating = claimFx && claimFx.route === r.id ? claimFx : null;
          const label = `${CITY[r.a].name}–${CITY[r.b].name}, ${r.sea ? '배 노선 ' : ''}${info.name} ${r.length}칸, ${ROUTE_POINTS[r.length]}점${
            owner !== null ? `, ${state.players[owner].name}의 기찻길` : canNow ? ', 깔 수 있어요' : ''
          }`;
          return (
            <g
              key={r.id}
              className={cls}
              data-route={r.id}
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={label}
              onMouseEnter={() => props.onHoverRoute(r.id)}
              onMouseLeave={() => props.onHoverRoute(null)}
              onFocus={() => props.onHoverRoute(r.id)}
              onBlur={() => props.onHoverRoute(null)}
              onClick={() => interactive && props.onSelectRoute(r.id)}
              onKeyDown={(e) => {
                if (interactive && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  e.stopPropagation();
                  props.onSelectRoute(r.id);
                }
              }}
            >
              <path d={d} className="rl-route-hit" />
              {r.sea && <path d={d} className="rl-sea-lane" />}
              {owner !== null && <path d={d} className="rl-rail-bed" />}
              {owner === null
                ? slots.map((s, k) => (
                    <g key={k} transform={`translate(${s.x.toFixed(1)} ${s.y.toFixed(1)}) rotate(${s.angle.toFixed(1)})`}>
                      <rect x={-s.w / 2} y={-5} width={s.w} height={10} rx={2.6} className="rl-slot" fill={info.main} stroke={info.main} />
                      {r.color !== 'gray' && symbolShape(r.color, 0, 0.3, 3.6, info.main, { className: 'rl-slot-symbol', stroke: info.dark, strokeWidth: 0.6 })}
                      {r.color === 'gray' && <circle r={1.5} className="rl-slot-gray-dot" fill={info.dark} />}
                    </g>
                  ))
                : slots.map((s, k) => (
                    <Car
                      key={animating ? `${animating.key}-${k}` : k}
                      s={s}
                      seat={state.players[owner].seat}
                      cls={animating ? 'rl-car rl-car-new' : 'rl-car'}
                      style={animating ? { animationDelay: `${animating.delay + k * animating.step}ms` } : undefined}
                    />
                  ))}
              {animating && animating.step > 0 && (
                <g
                  key={`puff-${animating.key}`}
                  transform={`translate(${slots[slots.length - 1].x.toFixed(1)} ${slots[slots.length - 1].y.toFixed(1)})`}
                  className="rl-puffs"
                  style={{ '--rl-puff-delay': `${animating.delay + slots.length * animating.step}ms` } as CSSProperties}
                >
                  <circle r={4} cx={-2} cy={-9} />
                  <circle r={5} cx={3} cy={-15} />
                  <circle r={3.5} cx={-4} cy={-19} />
                </g>
              )}
              {r.sea && (
                <g transform={`translate(${((CITY[r.a].x + CITY[r.b].x) / 2 + (r.bend ?? 0) * 0.6).toFixed(1)} ${((CITY[r.a].y + CITY[r.b].y) / 2 - 2).toFixed(1)})`} className="rl-boat">
                  <path d="M-9 0 H9 L6 5 H-6 Z" />
                  <rect x={-4} y={-6} width={7} height={6} rx={1} />
                  <rect x={-1} y={-10} width={2} height={4} />
                </g>
              )}
            </g>
          );
        })}
      </g>

      {/* 도장 */}
      {stampsOn &&
        STAMPS.map((st) => {
          const city = CITY[st.city];
          const off = STAMP_OFFSET[st.city] ?? { dx: 16, dy: -14 };
          const first = state.stampFirst[st.city];
          const visitors = state.players.map((p, i) => (p.stamps.some((m) => m.city === st.city) ? i : -1)).filter((i) => i >= 0);
          const ring = first !== null && first !== undefined ? SEAT_COLORS[state.players[first].seat].main : undefined;
          return (
            <g key={st.city} transform={`translate(${city.x + off.dx} ${city.y + off.dy})`} className={`rl-stamp${first !== null ? ' rl-stamp-taken' : ''}`}>
              <title>{`${city.name} ${st.name} 도장${first !== null ? ` — 첫 도장: ${state.players[first].name}` : ' — 처음 오면 +3점'}`}</title>
              <circle r={10.5} className="rl-stamp-bg" style={ring ? { stroke: ring } : undefined} />
              <g transform="scale(0.78)">{stampArt(st.icon)}</g>
              {visitors.map((i, k) => (
                <circle key={i} cx={-6 + k * 4} cy={13.5} r={1.9} fill={SEAT_COLORS[state.players[i].seat].main} className="rl-stamp-visitor" />
              ))}
            </g>
          );
        })}

      {/* 도시 */}
      {CITIES.map((c) => {
        const pos = LABEL_POS[c.label];
        const focus = focusCities.includes(c.id);
        const inNet = netCities.has(c.id);
        return (
          <g key={c.id} className={`rl-city${focus ? ' rl-city-focus' : ''}${inNet ? ' rl-city-net' : ''}`} transform={`translate(${c.x} ${c.y})`}>
            {focus && <circle r={15} className="rl-city-ring" />}
            {inNet && showNetwork && <circle r={11} className="rl-city-net-ring" style={{ stroke: SEAT_COLORS[state.players[showNetwork.player].seat].main }} />}
            <circle r={STAMP_AT[c.id] && stampsOn ? 7.6 : 6.6} className="rl-city-dot" />
            <circle r={2.6} className="rl-city-core" />
            <text x={pos.dx} y={pos.dy} textAnchor={pos.anchor} className="rl-city-label">
              {c.name}
            </text>
          </g>
        );
      })}

      {/* 떠오르는 점수 */}
      <g className="rl-floats" pointerEvents="none">
        {floats.map((f) => (
          <text key={f.id} x={f.x} y={f.y} className={`rl-float rl-float-${f.tone}`}>
            {f.text}
          </text>
        ))}
      </g>
    </svg>
  );
}

export const Board = memo(BoardImpl);
