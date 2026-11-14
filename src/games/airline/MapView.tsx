import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { shapeElement } from '../../components/shapes';
import { useElementWidth } from '../../lib/useElementWidth';
import { SEAT_COLORS } from '../common/players';
import { LandmarkIcon, MAP_PLANE_D, SEAT_SHAPES } from './Art';
import { CITIES, CITY, REGIONS, REGION_INFO, citySize, dist, pairKey } from './cities';
import { yearOf } from './time';
import type { AirlineState, RegionId } from './types';
import { LAND, MAP_H, MAP_W, WATER, arcPath, project, shapePath } from './worldmap';

export type Selection = { kind: 'city'; id: string } | { kind: 'route'; company: number; route: number } | null;

export interface Pulse {
  id: number;
  kind: 'city' | 'route';
  /** 도시 id 또는 두 도시 열쇠 */
  key: string;
  company: number;
}

interface MapViewProps {
  state: AirlineState;
  viewer: number;
  selected: Selection;
  onSelect: (sel: Selection) => void;
  pulses: Pulse[];
  /** 분기를 계산하는 중 (비행기가 바쁘게 난다) */
  flying: boolean;
  fx: boolean;
  zoomCmd?: { n: number; kind: 'in' | 'out' | 'reset' };
}

type View = { x: number; y: number; w: number; h: number };
const FULL: View = { x: 0, y: 0, w: MAP_W, h: MAP_H };
const MIN_W = MAP_W / 7;

/** 붐비는 곳의 이름 자리 (기본은 오른쪽) */
const LABEL_POS: Record<string, 'l' | 't' | 'b'> = {
  seoul: 't',
  beijing: 'l',
  london: 'l',
  paris: 'b',
  madrid: 'l',
  amsterdam: 't',
  frankfurt: 't',
  milan: 'b',
  barcelona: 'b',
  busan: 'b',
  osaka: 'b',
  jeju: 'l',
  taipei: 't',
  hongkong: 'l',
  doha: 'l',
  kualalumpur: 'l',
  singapore: 'b',
  male: 'l',
  colombo: 'b',
  delhi: 't',
  kathmandu: 't',
  toronto: 'l',
  montreal: 't',
  chicago: 'l',
  saopaulo: 'l',
  rio: 'b',
  losangeles: 'b',
  sanfrancisco: 'l',
  vancouver: 'l',
  bali: 'b',
  jakarta: 'l',
  manila: 'b',
};

const pos = (id: string) => {
  const c = CITY[id];
  return project(c.lon, c.lat);
};

function clampView(v: View): View {
  const w = Math.max(MIN_W, Math.min(MAP_W, v.w));
  const h = (w * MAP_H) / MAP_W;
  return { w, h, x: Math.max(0, Math.min(MAP_W - w, v.x)), y: Math.max(0, Math.min(MAP_H - h, v.y)) };
}

function regionView(region: RegionId): View {
  const pts = CITIES.filter((c) => c.region === region).map((c) => project(c.lon, c.lat));
  let minX = Math.min(...pts.map((p) => p.x));
  let maxX = Math.max(...pts.map((p) => p.x));
  // 아메리카·대양주처럼 넓게 퍼진 곳도 한 화면에
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const pad = 40;
  minX -= pad;
  maxX += pad;
  let w = maxX - minX;
  let h = maxY - minY + pad * 2;
  if (w / h < MAP_W / MAP_H) w = (h * MAP_W) / MAP_H;
  else h = (w * MAP_H) / MAP_W;
  return clampView({ x: (minX + maxX) / 2 - w / 2, y: (minY + maxY) / 2 - h / 2, w, h });
}

export function MapView({ state, viewer, selected, onSelect, pulses, flying, fx, zoomCmd }: MapViewProps) {
  const [view, setView] = useState<View>(FULL);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean; id: number } | null>(null);
  const width = useElementWidth(wrapRef);
  const year = yearOf(state.q);
  const k = view.w / Math.max(1, width || MAP_W);
  const zoom = MAP_W / view.w;
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const animate = fx && !reduced;

  const zoomBy = useCallback((f: number, cx?: number, cy?: number) => {
    setView((v) => {
      const px = cx ?? v.x + v.w / 2;
      const py = cy ?? v.y + v.h / 2;
      const w = Math.max(MIN_W, Math.min(MAP_W, v.w * f));
      const h = (w * MAP_H) / MAP_W;
      return clampView({ x: px - ((px - v.x) * w) / v.w, y: py - ((py - v.y) * h) / v.h, w, h });
    });
  }, []);

  // 바깥에서 오는 확대·축소 명령 (키보드)
  const lastCmd = useRef(0);
  useEffect(() => {
    if (!zoomCmd || zoomCmd.n === lastCmd.current) return;
    lastCmd.current = zoomCmd.n;
    if (zoomCmd.kind === 'reset') setView(FULL);
    else zoomBy(zoomCmd.kind === 'in' ? 0.7 : 1 / 0.7);
  }, [zoomCmd, zoomBy]);

  const toMap = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }, []);

  // 휠로 확대 (passive가 아니어야 화면이 같이 굴러가지 않는다)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toMap(e.clientX, e.clientY);
      zoomBy(e.deltaY < 0 ? 0.85 : 1 / 0.85, p?.x, p?.y);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [toMap, zoomBy]);

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, view, moved: false, id: e.pointerId };
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    if (!d.moved) {
      d.moved = true;
      svgRef.current?.setPointerCapture(e.pointerId);
    }
    const s = d.view.w / Math.max(1, width);
    setView(clampView({ ...d.view, x: d.view.x - dx * s, y: d.view.y - dy * s }));
  };
  const endDrag = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (d && d.moved) svgRef.current?.releasePointerCapture(e.pointerId);
    // 끌기가 끝난 직후의 click은 무시한다
    window.setTimeout(() => {
      if (drag.current === d) drag.current = null;
    }, 0);
  };
  const wasDrag = () => !!drag.current?.moved;

  const landPaths = useMemo(() => LAND.map((s) => ({ name: s.name, d: shapePath(s.pts) })), []);
  const waterPaths = useMemo(() => WATER.map((s) => ({ name: s.name, d: shapePath(s.pts) })), []);

  // 노선들 (같은 두 도시를 여러 회사가 날면 조금씩 다르게 휘게)
  const routes = useMemo(() => {
    const lanes = new Map<string, number>();
    const out: { key: string; company: number; route: number; d: string; mid: { x: number; y: number }; flying: boolean; freq: number; pair: string; dist: number }[] = [];
    state.companies.forEach((c, ci) => {
      if (c.out) return;
      for (const r of c.routes) {
        const pair = pairKey(r.a, r.b);
        const lane = lanes.get(pair) ?? 0;
        lanes.set(pair, lane + 1);
        const arc = arcPath(pos(r.a), pos(r.b), lane === 0 ? 0 : lane % 2 === 1 ? Math.ceil(lane / 2) : -lane / 2);
        let freq = 0;
        for (const p of c.planes) if (p.route === r.id) freq += p.freq;
        out.push({ key: `${ci}-${r.id}`, company: ci, route: r.id, d: arc.d, mid: arc.mid, flying: freq > 0, freq, pair, dist: dist(r.a, r.b) });
      }
    });
    return out;
  }, [state.companies]);

  const pulseRoute = new Map<string, number>();
  const pulseCity = new Map<string, number>();
  for (const p of pulses) (p.kind === 'route' ? pulseRoute : pulseCity).set(p.kind === 'route' ? `${p.company}|${p.key}` : p.key, p.id);

  const branchOf = useMemo(() => {
    const m = new Map<string, number[]>();
    state.companies.forEach((c, ci) => {
      if (c.out) return;
      for (const b of c.branches) m.set(b, [...(m.get(b) ?? []), ci]);
    });
    return m;
  }, [state.companies]);

  const viewerCo = state.companies[viewer];
  const fontPx = 11;
  const showLabel = (id: string) => {
    if (zoom >= 1.7) return true;
    if (selected?.kind === 'city' && selected.id === id) return true;
    if (viewerCo?.branches.includes(id)) return true;
    return citySize(CITY[id], year) >= 7.5;
  };

  // 지도 위에 띄울 비행기 수는 적당히
  const animated = animate ? [...routes].filter((r) => r.flying).sort((a, b) => (a.company === viewer ? -1 : 0) - (b.company === viewer ? -1 : 0)).slice(0, 70) : [];

  const selRoute = selected?.kind === 'route' ? routes.find((r) => r.company === selected.company && r.route === selected.route) : null;

  return (
    <div className="al-map-wrap" ref={wrapRef}>
      <svg
        ref={svgRef}
        className={`al-map${flying ? ' al-map-flying' : ''}`}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        role="img"
        aria-label="세계 지도: 도시를 누르면 정보가, 노선을 누르면 노선 정보가 나와요"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={() => {
          if (!wasDrag()) onSelect(null);
        }}
      >
        <defs>
          <linearGradient id="al-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="al-sea-top" />
            <stop offset="1" className="al-sea-bottom" />
          </linearGradient>
        </defs>
        <rect x={-MAP_W} y={-50} width={MAP_W * 3} height={MAP_H + 100} fill="url(#al-sea)" />
        {[0, 23.44, -23.44].map((lat) => {
          const y = project(0, lat).y;
          return <line key={lat} x1={0} x2={MAP_W} y1={y} y2={y} className={lat === 0 ? 'al-equator' : 'al-tropic'} strokeWidth={k} />;
        })}
        <g className="al-land">
          {landPaths.map((p) => (
            <path key={p.name} d={p.d} strokeWidth={0.8 * k} />
          ))}
        </g>
        <g className="al-water">
          {waterPaths.map((p) => (
            <path key={p.name} d={p.d} strokeWidth={0.6 * k} />
          ))}
        </g>

        {/* 노선 */}
        <g className="al-routes">
          {routes.map((r) => {
            const c = state.companies[r.company];
            const color = SEAT_COLORS[c.seat].main;
            const mine = r.company === viewer;
            const sel = selRoute === r;
            const pulse = pulseRoute.get(`${r.company}|${r.pair}`);
            return (
              <g
                key={r.key + (pulse ?? '')}
                className={`al-route${mine ? ' al-route-mine' : ''}${sel ? ' al-route-sel' : ''}${pulse ? ' al-pulse-route' : ''}${r.flying ? '' : ' al-route-idle'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!wasDrag()) onSelect({ kind: 'route', company: r.company, route: r.route });
                }}
              >
                <path d={r.d} className="al-route-hit" strokeWidth={10 * k} />
                {sel && <path d={r.d} className="al-route-halo" strokeWidth={(mine ? 7 : 6) * k} />}
                <path d={r.d} stroke={color} strokeWidth={(mine ? 2.4 : 1.5) * k} strokeDasharray={r.flying ? undefined : `${4 * k} ${3 * k}`} className="al-route-line" />
              </g>
            );
          })}
        </g>

        {/* 나는 비행기 */}
        <g className="al-planes" aria-hidden="true">
          {animated.map((r, i) => {
            const c = state.companies[r.company];
            const dur = (flying ? 1.6 : 6) + r.dist / (flying ? 6000 : 1600);
            return (
              <path key={`${r.key}-${flying ? 'f' : 'n'}`} d={MAP_PLANE_D} fill={SEAT_COLORS[c.seat].main} className="al-map-plane" transform={`scale(${(r.company === viewer ? 1 : 0.8) * k})`}>
                <animateMotion dur={`${dur.toFixed(1)}s`} repeatCount="indefinite" rotate="auto" path={r.d} begin={`${-((i * 1.37) % dur).toFixed(2)}s`} />
              </path>
            );
          })}
        </g>

        {/* 도시 */}
        <g className="al-cities">
          {CITIES.map((city) => {
            const p = project(city.lon, city.lat);
            const size = citySize(city, year);
            const r = (1.6 + size * 0.32) * k;
            const owners = branchOf.get(city.id) ?? [];
            const sel = selected?.kind === 'city' && selected.id === city.id;
            const lp = LABEL_POS[city.id];
            const fs = fontPx * k;
            const lx = lp === 'l' ? p.x - r - 3 * k : lp === 't' || lp === 'b' ? p.x : p.x + r + 3 * k;
            const ly = lp === 't' ? p.y - r - 4 * k : lp === 'b' ? p.y + r + fs : p.y + fs * 0.35;
            const anchor = lp === 'l' ? 'end' : lp === 't' || lp === 'b' ? 'middle' : 'start';
            const pulse = pulseCity.get(city.id);
            const hubOf = owners.find((ci) => state.companies[ci].hub === city.id);
            return (
              <g
                key={city.id + (pulse ?? '')}
                className={`al-city${sel ? ' al-city-sel' : ''}${pulse ? ' al-pulse-city' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!wasDrag()) onSelect({ kind: 'city', id: city.id });
                }}
                role="button"
                tabIndex={0}
                aria-label={`${city.name} (${REGION_INFO[city.region].name})`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect({ kind: 'city', id: city.id });
                  }
                }}
              >
                <circle cx={p.x} cy={p.y} r={Math.max(r * 2.2, 7 * k)} className="al-city-hit" />
                {sel && <circle cx={p.x} cy={p.y} r={r + 4 * k} className="al-city-ring" strokeWidth={1.6 * k} />}
                {hubOf !== undefined && (
                  <circle cx={p.x} cy={p.y} r={r + 2.4 * k} fill="none" stroke={SEAT_COLORS[state.companies[hubOf].seat].main} strokeWidth={1.8 * k} />
                )}
                <circle cx={p.x} cy={p.y} r={r} className="al-city-dot" strokeWidth={0.9 * k} />
                {owners.map((ci, j) => {
                  const co = state.companies[ci];
                  const ang = (-50 + j * 50) * (Math.PI / 180);
                  const ox = p.x + Math.cos(ang) * (r + 4.5 * k);
                  const oy = p.y - r - 3.5 * k + Math.sin(ang) * 2 * k;
                  return <g key={ci}>{shapeElement(SEAT_SHAPES[co.seat], ox, oy, 2.6 * k, SEAT_COLORS[co.seat].main, { stroke: '#fff', strokeWidth: 0.7 * k })}</g>;
                })}
                {zoom >= 2.6 && (
                  <g transform={`translate(${p.x - 7 * k} ${p.y - r - 18 * k}) scale(${(14 / 24) * k})`} className="al-city-mark">
                    <LandmarkIcon kind={city.landmark} size={24} />
                  </g>
                )}
                {showLabel(city.id) && (
                  <text x={lx} y={ly} fontSize={fs} textAnchor={anchor} className="al-city-label" strokeWidth={3 * k}>
                    {city.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="al-map-tools" role="toolbar" aria-label="지도 보기">
        <button type="button" className="al-map-btn" onClick={() => zoomBy(0.7)} aria-label="확대 (+)" title="확대 (+)">
          ＋
        </button>
        <button type="button" className="al-map-btn" onClick={() => zoomBy(1 / 0.7)} aria-label="축소 (−)" title="축소 (−)">
          －
        </button>
        <button type="button" className={`al-map-btn al-map-chip${view.w >= MAP_W - 1 ? ' al-on' : ''}`} onClick={() => setView(FULL)} title="세계 전체 (0)">
          🌐 세계
        </button>
        {REGIONS.map((r) => (
          <button key={r} type="button" className="al-map-btn al-map-chip" onClick={() => setView(regionView(r))} title={`${REGION_INFO[r].name} 크게 보기`}>
            {REGION_INFO[r].short}
          </button>
        ))}
      </div>
      {state.companies.length > 1 && (
        <ul className="al-map-legend" aria-label="회사 색">
          {state.companies.map((c, i) => (
            <li key={i} className={c.out ? 'al-out' : ''}>
              <svg viewBox="0 0 20 20" width={12} height={12} aria-hidden="true">
                {shapeElement(SEAT_SHAPES[c.seat], 10, 10, 9, SEAT_COLORS[c.seat].main)}
              </svg>
              {c.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
