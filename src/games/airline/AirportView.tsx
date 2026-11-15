import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { SEAT_SHAPES } from './Art';
import { AirportScene } from './AirportArt';
import { airportShortName, cityAirports, runwayLength, type CityAirport } from './airports';
import { parkPlanes, trafficQueue, visitingPlanes } from './airportScene';
import { coColors } from './brand';
import { AIRPORT_INFO, CITY, FEE_INFO, airportClass } from './cities';
import { FinIcon } from './FinanceArt';
import type { Paint } from './PlaneImage';
import { slotCapacity, slotsUsed } from './simulate';
import { yearOf } from './time';
import type { AirlineState } from './types';
import { CoName } from './ui';
import { withJosa } from '../../lib/korean';
import { useElementWidth } from '../../lib/useElementWidth';
import './airport.css';

const OSM_COPYRIGHT = 'https://www.openstreetmap.org/copyright';

/**
 * 공항 그림에 쓰는 것들을 한 번에. icao로 탭에서 고른 공항 (없거나 그 해에 없는 공항이면 대표 공항).
 * 게임에서는 도시를 공항 하나로 셈하므로 회사 비행기는 대표 공항에만 서고, 다른 공항엔 다른 항공사(회색) 비행기만.
 */
function useAirportScene(state: AirlineState, viewer: number, city: string, icao?: string) {
  const year = yearOf(state.q);
  const aps = useMemo(() => cityAirports(city, year), [city, year]);
  const ap = aps.find((a) => a.info.icao === icao) ?? aps[0] ?? null;
  const main = aps[0] ?? null;
  const visiting = useMemo(() => visitingPlanes(state, city, viewer), [state, city, viewer]);
  const here = useMemo(() => (ap?.main ? visiting : []), [ap, visiting]);
  const planes = useMemo(() => (ap?.map ? parkPlanes(ap.map, ap.info.icao, city, year, here, ap.main) : []), [ap, city, year, here]);
  const traffic = useMemo(() => trafficQueue(here, year, city), [here, year, city]);
  const paintOf = useCallback(
    (ci: number): Paint => {
      const co = state.companies[ci];
      const col = coColors(co);
      return { main: col.main, dark: col.dark, shape: SEAT_SHAPES[co.seat] };
    },
    [state.companies],
  );
  return { year, aps, ap, main, visiting, planes, traffic, paintOf };
}

/** 그 공항의 부호 (대표 공항에서 물러난 뒤 부호가 바뀐 곳은 지금 부호: 돈므앙 DMK 등) */
function codeOf(ap: CityAirport): string {
  return ap.main ? ap.info.iata : (ap.info.now ?? ap.info.iata);
}

/** 여러 공항이 있는 도시: 공항 고르기 탭 */
function AirportTabs({ aps, current, city, onPick }: { aps: CityAirport[]; current: string; city: string; onPick: (icao: string) => void }) {
  if (aps.length < 2) return null;
  const cityName = CITY[city].name;
  return (
    <div className="al-apt-tabs" role="tablist" aria-label={`${cityName}의 공항`}>
      {aps.map((a) => {
        const on = a.info.icao === current;
        return (
          <button
            key={a.info.icao}
            type="button"
            role="tab"
            aria-selected={on}
            className={`al-apt-tab${on ? ' al-on' : ''}`}
            onClick={() => onPick(a.info.icao)}
            title={a.info.name}
            data-testid={`al-airport-tab-${a.info.icao}`}
          >
            {airportShortName(a.info, cityName)} <small>{codeOf(a)}</small>
            {a.main && <span className="al-apt-tab-main">대표</span>}
          </button>
        );
      })}
    </div>
  );
}

/** '2001년부터 인천국제공항(ICN)으로 옮겨요' 같은 시대 이야기 */
function eraLines(ap: CityAirport): string[] {
  // '하네다 공항 (도쿄국제공항)' → '하네다 공항(HND)을'
  const named = (info: { name: string; iata: string }, josa: '을/를' | '으로/로') => {
    const base = info.name.replace(/\s*\(.*\)$/, '');
    return `${base}(${info.iata})${withJosa(base, josa).slice(base.length)}`;
  };
  const out: string[] = [];
  if (ap.prev) out.push(`${ap.prev.era.to ?? ''}년까지는 ${named(ap.prev.info, '을/를')} 썼어요.`);
  if (ap.next) out.push(`${ap.next.era.from}년부터는 ${named(ap.next.info, '으로/로')} 옮겨 가요.`);
  return out;
}

// ------------------------------------------------------------------ 도시 칸 안 카드

export function AirportCard({
  state,
  viewer,
  city,
  fx,
  icao,
  onPick,
  onOpen,
}: {
  state: AirlineState;
  viewer: number;
  city: string;
  fx: boolean;
  /** 탭에서 고른 공항 */
  icao?: string;
  onPick: (icao: string) => void;
  onOpen: () => void;
}) {
  const { aps, ap, main, visiting, planes, traffic, paintOf } = useAirportScene(state, viewer, city, icao);
  const boxRef = useRef<HTMLButtonElement>(null);
  const width = useElementWidth(boxRef);
  if (!ap?.map) return null;
  const map = ap.map;
  const ratio = Math.max(1.25, Math.min(2, map.w / map.h));
  const pxW = width || 320;
  // 카드 높이는 CSS에서 220px까지 (넓은 화면에서는 양옆이 남는다)
  const pxH = Math.min(pxW / ratio, 220);
  const k = Math.max(map.w / pxW, map.h / pxH);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const mine = visiting.filter((v) => v.company === viewer).length;
  const longest = map.rwy[0] ? runwayLength(map.rwy[0]) : 0;
  const era = ap.main ? eraLines(ap) : ap.era.note ? [ap.era.note] : [];
  return (
    <section className="al-apt-card" data-testid="al-airport-card">
      <h4 className="al-mp-h4">
        <FinIcon kind="tower" size={15} /> 공항{aps.length > 1 && ` ${aps.length}곳`}
        <small>
          {ap.info.name} · {codeOf(ap)}
        </small>
      </h4>
      <AirportTabs aps={aps} current={ap.info.icao} city={city} onPick={onPick} />
      <button ref={boxRef} type="button" className="al-apt-thumb" style={{ aspectRatio: `${ratio}` }} onClick={onOpen} aria-label={`${ap.info.name} 도면 크게 보기`} data-testid="al-airport-open">
        <svg viewBox={`0 0 ${map.w} ${map.h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${ap.info.name} 위에서 본 모습`}>
          <AirportScene map={map} planes={planes} paintOf={paintOf} traffic={traffic} animate={fx && !reduced} k={k} />
        </svg>
        <span className="al-apt-hint" aria-hidden="true">
          🔍 크게 보기
        </span>
        <span className="al-apt-osm">© OpenStreetMap</span>
      </button>
      <p className="al-apt-sum">
        활주로 {map.rwy.length}개{longest > 0 && <> · 가장 긴 활주로 {longest.toLocaleString()} m</>}
        {!ap.main && main ? (
          visiting.length > 0 && <> · 회사 비행기는 대표 공항인 {airportShortName(main.info, CITY[city].name)}에 서 있어요</>
        ) : mine > 0 ? (
          <> · 우리 비행기 {mine}대가 드나들어요</>
        ) : visiting.length > 0 ? (
          <> · 회사 비행기 {visiting.length}대가 드나들어요</>
        ) : null}
      </p>
      {era.map((t) => (
        <small key={t} className="al-muted al-apt-era">
          {t}
        </small>
      ))}
    </section>
  );
}

// ------------------------------------------------------------------ 크게 보기

type View = { x: number; y: number; w: number; h: number };

export function AirportModal({
  state,
  viewer,
  city,
  fx,
  icao,
  onPick,
  onClose,
}: {
  state: AirlineState;
  viewer: number;
  city: string;
  fx: boolean;
  icao?: string;
  onPick: (icao: string) => void;
  onClose: () => void;
}) {
  const { year, aps, ap, main, visiting, planes, traffic, paintOf } = useAirportScene(state, viewer, city, icao);
  const close = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const map = ap?.map;
  const W = map?.w ?? 1000;
  const H = map?.h ?? 1000;
  const full = useMemo<View>(() => ({ x: 0, y: 0, w: W, h: H }), [W, H]);
  const [view, setView] = useState<View>(full);
  useEffect(() => setView(full), [full]);
  const width = useElementWidth(stageRef);
  const [stageH, setStageH] = useState(0);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    setStageH(el.clientHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setStageH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clamp = useCallback(
    (v: View): View => {
      const w = Math.max(W / 14, Math.min(W * 1.15, v.w));
      const h = (w * H) / W;
      const mx = W * 0.08;
      const my = H * 0.08;
      return { w, h, x: Math.max(-mx, Math.min(W - w + mx, v.x)), y: Math.max(-my, Math.min(H - h + my, v.y)) };
    },
    [W, H],
  );
  const zoomBy = useCallback(
    (f: number, cx?: number, cy?: number) =>
      setView((v) => {
        const px = cx ?? v.x + v.w / 2;
        const py = cy ?? v.y + v.h / 2;
        const w = v.w * f;
        const h = (w * H) / W;
        return clamp({ x: px - ((px - v.x) * w) / v.w, y: py - ((py - v.y) * h) / v.h, w, h });
      }),
    [clamp, W, H],
  );

  useEffect(() => close.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') return;
      // 게임 단축키(Enter로 차례 마치기 등)가 뒤에서 움직이지 않게
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === '+' || e.key === '=') zoomBy(0.75);
      else if (e.key === '-' || e.key === '_') zoomBy(1 / 0.75);
      else if (e.key === '0') setView(full);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, zoomBy, full]);

  const toMap = useCallback((clientX: number, clientY: number) => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }, []);
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
  }, [toMap, zoomBy, map]);

  const drag = useRef<{ x: number; y: number; view: View; id: number; moved: boolean } | null>(null);
  const k = Math.max(view.w / Math.max(1, width), view.h / Math.max(1, stageH || (width * H) / W));
  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, view, id: e.pointerId, moved: false };
  };
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) {
      d.moved = true;
      svgRef.current?.setPointerCapture(e.pointerId);
    }
    setView(clamp({ ...d.view, x: d.view.x - dx * k, y: d.view.y - dy * k }));
  };
  const onUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current?.moved) svgRef.current?.releasePointerCapture(e.pointerId);
    drag.current = null;
  };

  if (!ap || !map) return null;
  const c = CITY[city];
  const cls = airportClass(c, year);
  const me = state.companies[viewer];
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const byCo = new Map<number, number>();
  for (const v of visiting) byCo.set(v.company, (byCo.get(v.company) ?? 0) + 1);
  const parkedOthers = planes.filter((p) => p.company === null).length;
  const standCount = (map.stands?.length ?? 0) / 3;
  // 축척 막대: 화면 90px 안팎이 되는 둥근 길이
  const target = k * 90;
  const nice = [50, 100, 200, 250, 500, 1000, 2000, 2500, 5000].find((n) => n >= target * 0.6) ?? 5000;
  const zoomed = view.w < W * 0.98;

  return createPortal(
    <div className="overlay al-apt-overlay" role="dialog" aria-modal="true" aria-labelledby="al-apt-title" onClick={onClose}>
      <div className="result-card al-apt-modal" onClick={(e) => e.stopPropagation()} data-testid="al-airport-modal">
        <header className="al-apt-modal-head">
          <h2 id="al-apt-title">
            🛫 {ap.info.name}
            <small>
              {ap.info.en} · {codeOf(ap)} / {ap.info.icao}
            </small>
          </h2>
          <button ref={close} type="button" className="btn btn-ghost btn-small" onClick={onClose} aria-label="닫기 (Esc)" data-testid="al-airport-close">
            ✕
          </button>
        </header>
        <AirportTabs aps={aps} current={ap.info.icao} city={city} onPick={onPick} />
        <div className="al-apt-modal-body">
          <div className="al-apt-stage" ref={stageRef}>
            <svg
              ref={svgRef}
              viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={`${ap.info.name} 도면: 끌어서 옮기고, 휠이나 +·− 단추로 크게 볼 수 있어요`}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <AirportScene map={map} planes={planes} paintOf={paintOf} traffic={traffic} animate={fx && !reduced} k={k} detail focus={focus} />
            </svg>
            <div className="al-apt-tools" role="toolbar" aria-label="도면 보기">
              <button type="button" className="al-map-btn" onClick={() => zoomBy(0.7)} aria-label="확대 (+)" title="확대 (+)">
                ＋
              </button>
              <button type="button" className="al-map-btn" onClick={() => zoomBy(1 / 0.7)} aria-label="축소 (−)" title="축소 (−)">
                －
              </button>
              <button type="button" className={`al-map-btn al-map-chip${zoomed ? '' : ' al-on'}`} onClick={() => setView(full)} title="공항 전체 (0)">
                전체
              </button>
            </div>
            <div className="al-apt-north" aria-label="위쪽이 북쪽" title="위쪽이 북쪽">
              <svg viewBox="-10 -14 20 28" width={16} height={22} aria-hidden="true">
                <path d="M0 -13 L7 8 L0 3 L-7 8 Z" />
              </svg>
              N
            </div>
            <div className="al-apt-scale" aria-hidden="true">
              <span style={{ width: `${nice / k}px` }} />
              {nice >= 1000 ? `${nice / 1000} km` : `${nice} m`}
            </div>
            <a className="al-apt-osm al-apt-osm-big" href={OSM_COPYRIGHT} target="_blank" rel="noopener noreferrer">
              지도 데이터 © OpenStreetMap 기여자
            </a>
          </div>
          <aside className="al-apt-facts">
            <dl>
              <dt>도시</dt>
              <dd>
                {c.name} <small className="al-muted">{c.country}</small>
              </dd>
              {(ap.info.opened || ap.info.closed) && (
                <>
                  <dt>문 연 해</dt>
                  <dd>
                    {ap.info.opened ? `${ap.info.opened}년` : '—'}
                    {ap.info.closed && <small className="al-muted"> · {ap.info.closed}년 문 닫음</small>}
                  </dd>
                </>
              )}
              {ap.main && ap.info.now && (
                <>
                  <dt>지금 부호</dt>
                  <dd>{ap.info.now}</dd>
                </>
              )}
              {ap.main ? (
                <>
                  <dt>게임 속 공항</dt>
                  <dd>
                    {AIRPORT_INFO[cls].name} <small className="al-muted">· 이용료 {FEE_INFO[c.fee].name}</small>
                  </dd>
                  <dt>내 슬롯</dt>
                  <dd>
                    주 {slotsUsed(me, city)} / {slotCapacity(state, viewer, city)}회
                  </dd>
                </>
              ) : (
                <>
                  <dt>게임 속 공항</dt>
                  <dd>
                    함께 쓰는 공항 <small className="al-muted">· 게임에서는 대표 공항과 한 공항으로 셈해요</small>
                  </dd>
                </>
              )}
            </dl>
            <h3>
              <FinIcon kind="tower" size={15} /> 활주로 {map.rwy.length}개
            </h3>
            <ul className="al-apt-rwys">
              {map.rwy.map((r, i) => (
                <li key={i}>
                  <b>{r[5] || `${i + 1}번`}</b> {runwayLength(r).toLocaleString()} m <small className="al-muted">× {r[4]} m</small>
                </li>
              ))}
            </ul>
            {map.labels && map.labels.length > 0 && (
              <>
                <h3>
                  <FinIcon kind="building" size={15} /> 터미널
                </h3>
                <p className="al-apt-terms">{map.labels.map((l) => l[2]).join(' · ')}</p>
              </>
            )}
            <h3>
              <FinIcon kind="people" size={15} /> 서 있는 비행기
            </h3>
            {!ap.main && main ? (
              <p className="al-muted">회사 비행기는 대표 공항인 {airportShortName(main.info, c.name)}({codeOf(main)})에 서 있어요.</p>
            ) : byCo.size === 0 ? (
              <p className="al-muted">아직 이 공항을 드나드는 회사 비행기가 없어요.</p>
            ) : (
              <ul className="al-apt-cos">
                {[...byCo.entries()].map(([ci, n]) => (
                  <li key={ci}>
                    <button type="button" className={`al-apt-co${focus === ci ? ' al-on' : ''}`} aria-pressed={focus === ci} onClick={() => setFocus(focus === ci ? null : ci)} title="누르면 이 회사 비행기만 또렷하게">
                      <CoName c={state.companies[ci]} /> <b>{n}대</b>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <small className="al-muted">
              {parkedOthers > 0 && <>회색 비행기 {parkedOthers}대는 다른 항공사예요. </>}
              {standCount > 0 && <>도면의 주기장 {standCount}곳 가운데 터미널 가까운 곳부터 세웠어요.</>}
            </small>
            {(ap.era.note || ap.prev || ap.next) && (
              <div className="al-apt-story">
                {ap.era.note && <p>{ap.era.note}</p>}
                {(ap.main ? eraLines(ap) : []).map((t) => (
                  <p key={t} className="al-muted">
                    {t}
                  </p>
                ))}
              </div>
            )}
            {!ap.info.closed && year < 2015 && (
              <small className="al-muted">도면은 오늘날 모습이에요. {year}년에는 터미널이나 활주로가 이보다 적었을 수 있어요.</small>
            )}
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
