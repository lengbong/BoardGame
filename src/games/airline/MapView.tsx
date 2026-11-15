import { shownCompanies } from './rules';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { shapeElement } from '../../components/shapes';
import { useElementWidth } from '../../lib/useElementWidth';
import { coColors, mapInk } from './brand';
import { LandmarkIcon, MAP_PLANE_D, SEAT_SHAPES } from './Art';
import { CITIES, CITY, REGIONS, REGION_INFO, citySize, dist, pairKey } from './cities';
import { yearOf } from './time';
import type { AirlineState, Company, RegionId } from './types';
import { LAND, MAP_H, MAP_W, WATER, greatCircleArc, project, shapePath, type RouteArc } from './worldmap';
import { routeFreq } from './simulate';

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
  /** 이 회사의 노선·비행기·지점만 보여 준다 (null이면 모두) */
  focusCo?: number | null;
  /** 범례에서 회사를 고르면 (같은 회사를 다시 누르면 null) */
  onFocusCo?: (company: number | null) => void;
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

/** 한 번만 도는 SVG 움직임은 문서 시계가 아니라 지금부터 시작해야 해서 붙자마자 시작한다 */
function startMotion(el: SVGAnimationElement | null) {
  try {
    el?.beginElement();
  } catch {
    // 움직임을 못 쓰는 브라우저면 그냥 둔다
  }
}

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

/** 지도에 그릴 노선 하나 */
interface MapRoute {
  key: string;
  company: number;
  route: number;
  d: string;
  copies: string[];
  mid: { x: number; y: number };
  flying: boolean;
  freq: number;
  pair: string;
  dist: number;
  /** 어두운 바다 위에서 잘 보이게 밝힌 회사 색 */
  ink: string;
}

/** 대권 항로는 두 도시와 비키는 칸만으로 정해지니, 한 번 셈한 길은 다시 쓴다 (노선이 수백 개면 상태가 바뀔 때마다 셈하면 느리다) */
const arcCache = new Map<string, RouteArc>();
function routeArc(a: string, b: string, lane: number): RouteArc {
  const key = `${a}>${b}#${lane}`;
  let arc = arcCache.get(key);
  if (!arc) {
    arc = greatCircleArc(CITY[a], CITY[b], lane);
    arcCache.set(key, arc);
  }
  return arc;
}

let landPaths: { land: { name: string; d: string }[]; water: { name: string; d: string }[] } | null = null;
function getLandPaths() {
  landPaths ??= { land: LAND.map((s) => ({ name: s.name, d: shapePath(s.pts) })), water: WATER.map((s) => ({ name: s.name, d: shapePath(s.pts) })) };
  return landPaths;
}

/** 바다·땅 (확대할 때만 다시 그린다) */
const LandLayer = memo(function LandLayer({ k }: { k: number }) {
  const { land, water } = getLandPaths();
  return (
    <>
      <rect x={-MAP_W} y={-50} width={MAP_W * 3} height={MAP_H + 100} fill="url(#al-sea)" />
      {[0, 23.44, -23.44].map((lat) => {
        const y = project(0, lat).y;
        return <line key={lat} x1={0} x2={MAP_W} y1={y} y2={y} className={lat === 0 ? 'al-equator' : 'al-tropic'} strokeWidth={k} />;
      })}
      <g className="al-land">
        {land.map((p) => (
          <path key={p.name} d={p.d} strokeWidth={0.8 * k} />
        ))}
      </g>
      <g className="al-water">
        {water.map((p) => (
          <path key={p.name} d={p.d} strokeWidth={0.6 * k} />
        ))}
      </g>
    </>
  );
});

interface RouteItemProps {
  r: MapRoute;
  k: number;
  mine: boolean;
  sel: boolean;
  pulse: boolean;
  isNew: boolean;
  onPick: (sel: Selection) => void;
}

/** 노선 하나 (고르거나 반짝일 때 그 노선만 다시 그린다) */
const RouteItem = memo(function RouteItem({ r, k, mine, sel, pulse, isNew, onPick }: RouteItemProps) {
  return (
    <g
      className={`al-route${mine ? ' al-route-mine' : ''}${sel ? ' al-route-sel' : ''}${pulse ? ' al-pulse-route' : ''}${isNew ? ' al-route-new' : ''}${r.flying ? '' : ' al-route-idle'}`}
      onClick={(e) => {
        e.stopPropagation();
        onPick({ kind: 'route', company: r.company, route: r.route });
      }}
    >
      <path d={r.d} className="al-route-hit" strokeWidth={10 * k} />
      {sel && <path d={r.d} className="al-route-halo" strokeWidth={(mine ? 7 : 6) * k} />}
      <path d={r.d} className="al-route-case" strokeWidth={(mine ? 4 : 2.9) * k} />
      <path d={r.d} stroke={r.ink} strokeWidth={(mine ? 2.4 : 1.5) * k} strokeDasharray={r.flying ? undefined : `${4 * k} ${3 * k}`} className="al-route-line" />
    </g>
  );
});

interface RouteLayerProps {
  routes: MapRoute[];
  k: number;
  viewer: number;
  selKey: string | null;
  pulseRoute: Map<string, number>;
  newRoute: Set<string>;
  onPick: (sel: Selection) => void;
}

/** 노선들 (지도를 끌기만 할 때는 다시 그리지 않는다) */
const RouteLayer = memo(function RouteLayer({ routes, k, viewer, selKey, pulseRoute, newRoute, onPick }: RouteLayerProps) {
  return (
    <g className="al-routes">
      {routes.map((r) => {
        const pulse = pulseRoute.get(`${r.company}|${r.pair}`);
        return <RouteItem key={r.key + (pulse ?? '')} r={r} k={k} mine={r.company === viewer} sel={selKey === r.key} pulse={pulse !== undefined} isNew={newRoute.has(r.key)} onPick={onPick} />;
      })}
    </g>
  );
});

/** 나는 비행기 */
const PlaneLayer = memo(function PlaneLayer({ planes, k, viewer, flying }: { planes: MapRoute[]; k: number; viewer: number; flying: boolean }) {
  return (
    <g className="al-planes" aria-hidden="true">
      {planes.flatMap((r, i) => {
        const dur = (flying ? 1.6 : 6) + r.dist / (flying ? 6000 : 1600);
        const begin = `${-((i * 1.37) % dur).toFixed(2)}s`;
        // 지도 끝을 넘는 노선은 두 벌 모두에 같은 때에 띄워서, 한쪽 끝으로 나가면 반대쪽에서 들어온다
        return r.copies.map((path, j) => (
          <path key={`${r.key}-${j}-${flying ? 'f' : 'n'}`} d={MAP_PLANE_D} fill={r.ink} className="al-map-plane" transform={`scale(${(r.company === viewer ? 1 : 0.8) * k})`}>
            <animateMotion dur={`${dur.toFixed(1)}s`} repeatCount="indefinite" rotate="auto" path={path} begin={begin} />
          </path>
        ));
      })}
    </g>
  );
});

interface CityLayerProps {
  companies: Company[];
  year: number;
  k: number;
  zoom: number;
  viewer: number;
  focusCo: number | null;
  selCity: string | null;
  branchOf: Map<string, number[]>;
  pulseCity: Map<string, number>;
  onPick: (sel: Selection) => void;
  onSelect: (sel: Selection) => void;
}

/** 도시 (지도를 끌기만 할 때는 다시 그리지 않는다) */
const CityLayer = memo(function CityLayer({ companies, year, k, zoom, viewer, focusCo, selCity, branchOf, pulseCity, onPick, onSelect }: CityLayerProps) {
  // 이름을 늘 붙일 지점: 고른 회사, 없으면 지금 보는 회사
  const labelCo = companies[focusCo ?? viewer];
  const fontPx = 11;
  const showLabel = (id: string) => {
    if (zoom >= 1.7) return true;
    if (selCity === id) return true;
    if (labelCo?.branches.includes(id)) return true;
    return citySize(CITY[id], year) >= 7.5;
  };
  return (
    <g className="al-cities">
      {CITIES.map((city) => {
        const p = project(city.lon, city.lat);
        const size = citySize(city, year);
        const r = (1.6 + size * 0.32) * k;
        const owners = (branchOf.get(city.id) ?? []).filter((ci) => focusCo === null || ci === focusCo).filter((ci, k, all) => all.length <= 4 || ci === viewer || companies[ci].hub === city.id || k < 3).slice(0, 5);
        const sel = selCity === city.id;
        const lp = LABEL_POS[city.id];
        const fs = fontPx * k;
        const lx = lp === 'l' ? p.x - r - 3 * k : lp === 't' || lp === 'b' ? p.x : p.x + r + 3 * k;
        const ly = lp === 't' ? p.y - r - 4 * k : lp === 'b' ? p.y + r + fs : p.y + fs * 0.35;
        const anchor = lp === 'l' ? 'end' : lp === 't' || lp === 'b' ? 'middle' : 'start';
        const pulse = pulseCity.get(city.id);
        const hubOf = owners.find((ci) => companies[ci].hub === city.id);
        return (
          <g
            key={city.id + (pulse ?? '')}
            className={`al-city${sel ? ' al-city-sel' : ''}${pulse ? ' al-pulse-city' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onPick({ kind: 'city', id: city.id });
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
            <circle cx={p.x} cy={p.y} r={Math.max(r * 1.6, 6 * k)} className="al-city-hit" />
            {sel && <circle cx={p.x} cy={p.y} r={r + 4 * k} className="al-city-ring" strokeWidth={1.6 * k} />}
            {hubOf !== undefined && <circle cx={p.x} cy={p.y} r={r + 2.4 * k} fill="none" stroke={coColors(companies[hubOf]).main} strokeWidth={1.8 * k} />}
            <circle cx={p.x} cy={p.y} r={r} className="al-city-dot" strokeWidth={0.9 * k} />
            {owners.map((ci, j) => {
              const co = companies[ci];
              const ang = (-50 + j * 50) * (Math.PI / 180);
              const ox = p.x + Math.cos(ang) * (r + 4.5 * k);
              const oy = p.y - r - 3.5 * k + Math.sin(ang) * 2 * k;
              return <g key={ci}>{shapeElement(SEAT_SHAPES[co.seat], ox, oy, 2.6 * k, coColors(co).main, { stroke: '#fff', strokeWidth: 0.7 * k })}</g>;
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
  );
});

/**
 * 세계 지도. 세 장을 겹쳐 그린다: 아래 (바다·땅·노선), 가운데 (나는 비행기·취항 연출), 위 (도시).
 * 비행기는 쉬지 않고 움직이니 가운데 장만 따로 다시 그리게 해서, 노선이 수백 개여도 화면이 굼뜨지 않게 한다.
 */
export const MapView = memo(function MapView({ state, viewer, selected, onSelect, pulses: allPulses, flying, fx, zoomCmd, focusCo = null, onFocusCo }: MapViewProps) {
  const [view, setView] = useState<View>(FULL);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean; id: number } | null>(null);
  const width = useElementWidth(wrapRef);
  const year = yearOf(state.q);
  const k = view.w / Math.max(1, width || MAP_W);
  const zoom = MAP_W / view.w;
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const animate = fx && !reduced;
  const viewBox = `${view.x} ${view.y} ${view.w} ${view.h}`;

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
    const el = stackRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toMap(e.clientX, e.clientY);
      zoomBy(e.deltaY < 0 ? 0.85 : 1 / 0.85, p?.x, p?.y);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [toMap, zoomBy]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, view, moved: false, id: e.pointerId };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    if (!d.moved) {
      d.moved = true;
      stackRef.current?.setPointerCapture(e.pointerId);
    }
    const s = d.view.w / Math.max(1, width);
    setView(clampView({ ...d.view, x: d.view.x - dx * s, y: d.view.y - dy * s }));
  };
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d && d.moved && stackRef.current?.hasPointerCapture(e.pointerId)) stackRef.current.releasePointerCapture(e.pointerId);
    // 끌기가 끝난 직후의 click은 무시한다
    window.setTimeout(() => {
      if (drag.current === d) drag.current = null;
    }, 0);
  };
  const wasDrag = () => !!drag.current?.moved;
  // 노선·도시를 눌렀을 때 (끌기였으면 무시). 늘 같은 함수라 노선·도시 장을 다시 그리지 않는다
  const pick = useCallback(
    (sel: Selection) => {
      if (!drag.current?.moved) onSelect(sel);
    },
    [onSelect],
  );

  // 노선들 (같은 두 도시를 여러 회사가 날면 조금씩 다르게 휘게)
  const allRoutes = useMemo(() => {
    const lanes = new Map<string, number>();
    const out: MapRoute[] = [];
    state.companies.forEach((c, ci) => {
      if (c.out) return;
      const ink = mapInk(coColors(c).main);
      for (const r of c.routes) {
        const pair = pairKey(r.a, r.b);
        const lane = lanes.get(pair) ?? 0;
        lanes.set(pair, lane + 1);
        const arc = routeArc(r.a, r.b, lane === 0 ? 0 : lane % 2 === 1 ? Math.ceil(lane / 2) : -lane / 2);
        const freq = routeFreq(c, r.id);
        out.push({ key: `${ci}-${r.id}`, company: ci, route: r.id, d: arc.d, copies: arc.copies, mid: arc.mid, flying: freq > 0, freq, pair, dist: dist(r.a, r.b), ink });
      }
    });
    return out;
  }, [state.companies]);
  // 회사를 골랐으면 그 회사 노선만 (휘는 자리는 모든 노선 기준이라 골라도 선이 움직이지 않는다)
  const routes = useMemo(() => (focusCo === null ? allRoutes : allRoutes.filter((r) => r.company === focusCo)), [allRoutes, focusCo]);
  const pulses = useMemo(() => (focusCo === null ? allPulses : allPulses.filter((p) => p.company === focusCo)), [allPulses, focusCo]);

  const [pulseRoute, pulseCity] = useMemo(() => {
    const byRoute = new Map<string, number>();
    const byCity = new Map<string, number>();
    for (const p of pulses) {
      if (p.kind === 'route') byRoute.set(`${p.company}|${p.key}`, p.id);
      else byCity.set(p.key, p.id);
    }
    return [byRoute, byCity];
  }, [pulses]);

  const branchOf = useMemo(() => {
    const m = new Map<string, number[]>();
    state.companies.forEach((c, ci) => {
      if (c.out) return;
      for (const b of c.branches) m.set(b, [...(m.get(b) ?? []), ci]);
    });
    return m;
  }, [state.companies]);

  // 범례에 보일 회사 (세계 항공사 모드는 가치 순 위쪽과 내 회사, 그리고 지금 고른 회사)
  const legendIds = useMemo(() => {
    const ids = shownCompanies(state, viewer);
    return focusCo !== null && !ids.includes(focusCo) ? [...ids, focusCo] : ids;
  }, [state, viewer, focusCo]);

  // 지도 위에 띄울 비행기 수는 적당히
  const animated = useMemo(
    () => (animate ? routes.filter((r) => r.flying).sort((a, b) => (a.company === viewer ? -1 : 0) - (b.company === viewer ? -1 : 0)).slice(0, 70) : []),
    [animate, routes, viewer],
  );

  const selKey = selected?.kind === 'route' ? `${selected.company}-${selected.route}` : null;
  const selCity = selected?.kind === 'city' ? selected.id : null;

  // 새 노선 취항: 노선이 그려지고, 첫 비행기가 날아가고, 닿은 도시가 반짝인다
  const openings = useMemo(
    () =>
      animate
        ? pulses.flatMap((p) => {
            if (p.kind !== 'route') return [];
            const r = [...routes].reverse().find((x) => x.company === p.company && x.pair === p.key);
            if (!r) return [];
            const route = state.companies[p.company]?.routes.find((x) => x.id === r.route);
            return route ? [{ id: p.id, r, a: route.a, b: route.b }] : [];
          })
        : [],
    [animate, pulses, routes, state.companies],
  );
  const newRoute = useMemo(() => new Set(openings.map((o) => o.r.key)), [openings]);

  return (
    <div className="al-map-wrap" ref={wrapRef}>
      <div
        className="al-map-stack"
        ref={stackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={() => {
          if (!wasDrag()) onSelect(null);
        }}
      >
        <svg
          ref={svgRef}
          className={`al-map${flying ? ' al-map-flying' : ''}`}
          viewBox={viewBox}
          role="img"
          aria-label={`세계 지도${focusCo !== null && state.companies[focusCo] ? ` (${state.companies[focusCo].name} 노선만)` : ''}: 도시를 누르면 정보가, 노선을 누르면 노선 정보가 나와요`}
        >
          <defs>
            <linearGradient id="al-sea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="al-sea-top" />
              <stop offset="1" className="al-sea-bottom" />
            </linearGradient>
          </defs>
          <LandLayer k={k} />
          <RouteLayer routes={routes} k={k} viewer={viewer} selKey={selKey} pulseRoute={pulseRoute} newRoute={newRoute} onPick={pick} />
        </svg>

        {/* 나는 비행기와 취항 연출: 쉬지 않고 움직이니 따로 한 장에 (아래 지도를 다시 그리지 않게) */}
        <svg className="al-map-layer al-map-air" viewBox={viewBox} aria-hidden="true">
          <PlaneLayer planes={animated} k={k} viewer={viewer} flying={flying} />
          {openings.length > 0 && (
            <g className="al-openings">
              {openings.map((o) => {
                const color = coColors(state.companies[o.r.company]).main;
                const pa = project(CITY[o.a].lon, CITY[o.a].lat);
                const pb = project(CITY[o.b].lon, CITY[o.b].lat);
                return (
                  <g key={`open-${o.id}`} className="al-open">
                    {o.r.copies.map((path, j) => (
                      <g key={j}>
                        <path d={path} pathLength={1} className="al-open-glow" stroke={color} strokeWidth={9 * k} />
                        <path d={path} pathLength={1} className="al-open-draw" stroke={color} strokeWidth={3.2 * k} />
                        <path d={MAP_PLANE_D} fill={color} stroke="#fff" strokeWidth={0.5} className="al-open-plane" transform={`scale(${1.8 * k})`}>
                          <animateMotion ref={startMotion} dur="1.5s" begin="indefinite" fill="freeze" rotate="auto" path={path} calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines="0.45 0 0.3 1" />
                        </path>
                      </g>
                    ))}
                    <circle cx={pa.x} cy={pa.y} r={7 * k} className="al-open-ring" stroke={color} style={{ animationDelay: '0s' }} />
                    {[1.35, 1.6, 1.85].map((delay) => (
                      <circle key={delay} cx={pb.x} cy={pb.y} r={7 * k} className="al-open-ring" stroke={color} strokeWidth={2 * k} style={{ animationDelay: `${delay}s` }} />
                    ))}
                    <g transform={`translate(${o.r.mid.x} ${o.r.mid.y - 9 * k}) scale(${k})`} className="al-open-tag">
                      <rect x={-34} y={-11} width={68} height={18} rx={9} fill={color} />
                      <text x={0} y={2.5} textAnchor="middle" className="al-open-tag-text">
                        ✈ 신규 취항
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          )}
        </svg>

        {/* 도시 */}
        <svg className="al-map-layer al-map-top" viewBox={viewBox} role="group" aria-label="도시">
          <CityLayer
            companies={state.companies}
            year={year}
            k={k}
            zoom={zoom}
            viewer={viewer}
            focusCo={focusCo}
            selCity={selCity}
            branchOf={branchOf}
            pulseCity={pulseCity}
            onPick={pick}
            onSelect={onSelect}
          />
        </svg>
      </div>

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
        <ul className={`al-map-legend${focusCo !== null ? ' al-legend-focus' : ''}`} aria-label="회사 색 (누르면 그 회사 노선만 보여요)">
          {legendIds.map((i) => {
            const c = state.companies[i];
            const on = focusCo === i;
            // 판에서 빠진 컴퓨터 회사는 감춘다 (회사가 늘고 줄어도 범례가 넘치지 않게)
            if (c.out && c.kind !== 'human' && !on) return null;
            return (
              <li key={i} className={`${c.out ? 'al-out' : ''}${on ? ' al-on' : ''}`}>
                <button
                  type="button"
                  className="al-legend-btn"
                  style={{ '--al-co': coColors(c).main } as CSSProperties}
                  aria-pressed={on}
                  disabled={!onFocusCo}
                  onClick={() => onFocusCo?.(on ? null : i)}
                  title={on ? '모든 항공사 노선 보기' : `${c.name} 노선만 보기`}
                  data-testid={`al-legend-${i}`}
                >
                  <svg viewBox="0 0 20 20" width={12} height={12} aria-hidden="true">
                    {shapeElement(SEAT_SHAPES[c.seat], 10, 10, 9, coColors(c).main)}
                  </svg>
                  {c.name}
                </button>
              </li>
            );
          })}
          {focusCo !== null && onFocusCo && (
            <li>
              <button type="button" className="al-legend-btn al-legend-all" onClick={() => onFocusCo(null)} title="모든 항공사 노선 보기 (Esc)" data-testid="al-legend-all">
                ✕ 모두 보기
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
});
