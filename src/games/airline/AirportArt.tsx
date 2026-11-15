import { memo, useEffect, useId, useMemo, useRef, useState, type PointerEventHandler, type Ref } from 'react';
import type { ParkedPlane } from './airportScene';
import type { AirportMapData } from './airportTypes';
import type { Paint } from './PlaneImage';
import { planeTop } from './planeTop';

/**
 * 공항 도면 (오픈스트리트맵) 위에 비행기를 세우고 뜨고 내리는 모습을 그린다.
 * 좌표는 m 단위. k는 화면 1px이 몇 m인지 (선 굵기·글자·비행기 최소 크기를 화면 기준으로 맞춘다).
 *
 * 빠르게 그리려고:
 * - 도면과 서 있는 비행기는 한 번 그린 뒤 그대로 두고 (React.memo, k는 조금씩 묶어서),
 * - 뜨고 내리는 비행기는 위에 겹친 다른 SVG에 그려서 움직일 때 도면을 다시 그리지 않으며,
 * - 비행기는 기종·칠마다 가벼운 모양 하나를 <defs>에 두고 <use>로 여러 번 쓴다.
 */
export interface AirportLayersProps {
  map: AirportMapData;
  planes: ParkedPlane[];
  paintOf: (company: number) => Paint;
  /** 이착륙 연출에 쓸 비행기 차례 */
  traffic: { company: number | null; model: string }[];
  animate: boolean;
  k: number;
  viewBox: string;
  label: string;
  /** 크게 보기: 활주로 번호·유도로 가운데 선·터미널 이름 */
  detail?: boolean;
  /** 이 회사 비행기만 또렷하게 (나머지는 흐리게) */
  focus?: number | null;
  svgRef?: Ref<SVGSVGElement>;
  onPointerDown?: PointerEventHandler<SVGSVGElement>;
  onPointerMove?: PointerEventHandler<SVGSVGElement>;
  onPointerUp?: PointerEventHandler<SVGSVGElement>;
}

/** 비행기는 화면에서 이만큼(px)보다 작아지지 않게 키운다 */
const MIN_PLANE_PX = 10;

/** k를 약 19%씩 묶는다 (확대·이동할 때마다 도면을 다시 만들지 않게) */
function quantize(k: number): number {
  return 2 ** (Math.round(Math.log2(Math.max(k, 0.01)) * 4) / 4);
}

const kindKey = (model: string, company: number | null) => `${model}|${company ?? 'g'}`;

export function AirportLayers({ map, planes, paintOf, traffic, animate, k, viewBox, label, detail = false, focus = null, svgRef, onPointerDown, onPointerMove, onPointerUp }: AirportLayersProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const kq = quantize(k);
  // 이 그림에서 쓰는 기종·칠 → <defs> 안 모양 id
  const kinds = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of [...planes, ...traffic]) {
      const key = kindKey(p.model, p.company);
      if (!m.has(key) && planeTop(p.model)) m.set(key, `apt${uid}-${m.size}`);
    }
    return m;
  }, [planes, traffic, uid]);
  const moving = animate && map.rwy.length > 0 && traffic.length > 0;
  return (
    <>
      <svg
        ref={svgRef}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={label}
        className="al-apt-base"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <PlaneDefs kinds={kinds} paintOf={paintOf} />
        <AirportBase map={map} k={kq} detail={detail} />
        <ParkedPlanes planes={planes} kinds={kinds} paintOf={paintOf} k={kq} focus={focus} />
        {detail && <Labels map={map} k={kq} />}
      </svg>
      {moving && (
        <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className="al-apt-movers" aria-hidden="true">
          <RunwayTraffic map={map} traffic={traffic} kinds={kinds} paintOf={paintOf} k={kq} />
        </svg>
      )}
    </>
  );
}

// ------------------------------------------------------------------ 도면

const AirportBase = memo(function AirportBase({ map, k, detail }: { map: AirportMapData; k: number; detail: boolean }) {
  const hair = Math.max(0.6, 0.7 * k);
  return (
    <g className="al-apt-scene">
      {/* 틀 밖은 자료가 없으니 칠하지 않는다 (지도 한 장처럼) */}
      <rect x={0} y={0} width={map.w} height={map.h} className={map.sea ? 'al-apt-sea' : 'al-apt-land'} />
      {map.sea && map.land && <path d={map.land} className="al-apt-land" />}
      {map.water && <path d={map.water} className="al-apt-water" />}
      {map.field && <path d={map.field} className="al-apt-field" strokeWidth={hair * 1.4} />}
      {map.apron && <path d={map.apron} className="al-apt-apron" />}
      {map.twy?.map(([w, d]) => (
        <path key={w} d={d} className="al-apt-twy" strokeWidth={Math.max(w, 1.6 * k)} />
      ))}
      {detail && k < 4 && map.twy?.map(([w, d]) => <path key={`c${w}`} d={d} className="al-apt-twy-line" strokeWidth={Math.max(0.6, 0.55 * k)} />)}
      {map.rwy.map((r, i) => (
        <Runway key={i} r={r} k={k} detail={detail} />
      ))}
      {map.bldg && <path d={map.bldg} className="al-apt-bldg" strokeWidth={hair} />}
      {map.hangar && <path d={map.hangar} className="al-apt-hangar" strokeWidth={hair} />}
      {map.term && <path d={map.term} className="al-apt-term" strokeWidth={hair * 1.2} />}
      {map.tower && (
        <g className="al-apt-tower" transform={`translate(${map.tower[0]} ${map.tower[1]})`}>
          <circle r={Math.max(7, 4 * k)} strokeWidth={hair * 1.5} />
          <circle r={Math.max(2.5, 1.5 * k)} className="al-apt-tower-dot" />
        </g>
      )}
    </g>
  );
});

const Labels = memo(function Labels({ map, k }: { map: AirportMapData; k: number }) {
  return (
    <g>
      {map.labels?.map(([x, y, name]) => (
        <text key={name} x={x} y={y} className="al-apt-label" fontSize={12 * k} strokeWidth={3 * k} textAnchor="middle">
          {name}
        </text>
      ))}
    </g>
  );
});

// ------------------------------------------------------------------ 활주로

function Runway({ r, k, detail }: { r: AirportMapData['rwy'][number]; k: number; detail: boolean }) {
  const [x1, y1, x2, y2, w, ref] = r;
  const L = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / L;
  const uy = (y2 - y1) / L;
  const mark = Math.max(0.9, 0.5 * k);
  const ends = ref ? ref.split('/') : [];
  // 문턱 줄무늬 (피아노 건반)
  const keys: string[] = [];
  const stripes = w >= 40 ? 12 : 8;
  for (const [px, py, sx, sy] of [
    [x1, y1, ux, uy],
    [x2, y2, -ux, -uy],
  ] as const) {
    for (let i = 0; i < stripes; i++) {
      const off = (i - (stripes - 1) / 2) * ((w * 0.82) / stripes);
      const ax = px + sx * 6 + -sy * off;
      const ay = py + sy * 6 + sx * off;
      keys.push(`M${ax.toFixed(1)} ${ay.toFixed(1)}l${(sx * 32).toFixed(1)} ${(sy * 32).toFixed(1)}`);
    }
    // 겨냥점 (두 줄 굵은 막대)
    if (L > 1800) {
      for (const side of [-1, 1]) {
        const off = side * w * 0.28;
        const ax = px + sx * 400 + -sy * off;
        const ay = py + sy * 400 + sx * off;
        keys.push(`M${ax.toFixed(1)} ${ay.toFixed(1)}l${(sx * 50).toFixed(1)} ${(sy * 50).toFixed(1)}`);
      }
    }
  }
  const showMarks = k < 9;
  const fontM = Math.min(w * 0.42, 20);
  const showNumbers = detail && ends.length === 2 && fontM / k >= 7;
  const ang = (Math.atan2(uy, ux) * 180) / Math.PI;
  return (
    <g className="al-apt-rwy">
      <line x1={x1} y1={y1} x2={x2} y2={y2} className="al-apt-rwy-body" strokeWidth={Math.max(w, 2.2 * k)} />
      {showMarks && (
        <>
          <line
            x1={x1 + ux * 90}
            y1={y1 + uy * 90}
            x2={x2 - ux * 90}
            y2={y2 - uy * 90}
            className="al-apt-rwy-mark"
            strokeWidth={mark}
            strokeDasharray={`${Math.max(30, 6 * k)} ${Math.max(20, 4 * k)}`}
          />
          <path d={keys.join('')} className="al-apt-rwy-mark" strokeWidth={w >= 40 ? Math.max(1.8, 0.6 * k) : Math.max(1.5, 0.6 * k)} />
        </>
      )}
      {showNumbers &&
        ends.map((name, i) => {
          const px = i === 0 ? x1 + ux * 70 : x2 - ux * 70;
          const py = i === 0 ? y1 + uy * 70 : y2 - uy * 70;
          // 내려앉는 조종사가 바로 읽게 (글자 위쪽이 활주로 안쪽)
          const rot = i === 0 ? ang + 90 : ang - 90;
          return (
            <text key={i} transform={`translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${rot.toFixed(1)})`} className="al-apt-rwy-num" fontSize={fontM} textAnchor="middle" dominantBaseline="hanging">
              {name}
            </text>
          );
        })}
      <title>{ref ? `활주로 ${ref} · ${Math.round(L).toLocaleString()} m` : `활주로 ${Math.round(L).toLocaleString()} m`}</title>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={Math.max(w, 10 * k)} />
    </g>
  );
}

// ------------------------------------------------------------------ 비행기

const PLANE_COLORS = {
  company: { body: '#eef2f6', wings: '#d5dce5', engines: '#a3aebb' },
  grey: { body: '#d8dee5', wings: '#c2cad3', engines: '#99a4b1' },
};

/** 기종·칠마다 위에서 본 모양 하나 (코가 +x, m 단위) */
const PlaneDefs = memo(function PlaneDefs({ kinds, paintOf }: { kinds: Map<string, string>; paintOf: (company: number) => Paint }) {
  return (
    <defs>
      {[...kinds].map(([key, id]) => {
        const [model, co] = key.split('|');
        const top = planeTop(model);
        if (!top) return null;
        const paint = co === 'g' ? null : paintOf(Number(co));
        const c = paint ? PLANE_COLORS.company : PLANE_COLORS.grey;
        return (
          <g key={id} id={id} stroke="#2a3644" strokeWidth={0.3} strokeLinejoin="round">
            <path d={top.wings} fill={c.wings} />
            <path d={top.engines} fill={c.engines} />
            <path d={top.body} fill={c.body} />
            {paint && <path d={top.crown} fill={paint.main} stroke="none" />}
            <path d={top.fin} fill={paint ? paint.dark : '#8a96a5'} stroke="none" />
          </g>
        );
      })}
    </defs>
  );
});

function spriteScale(len: number, k: number) {
  return Math.max(1, (MIN_PLANE_PX * k) / len);
}

const ParkedPlanes = memo(function ParkedPlanes({
  planes,
  kinds,
  paintOf,
  k,
  focus,
}: {
  planes: ParkedPlane[];
  kinds: Map<string, string>;
  paintOf: (company: number) => Paint;
  k: number;
  focus: number | null;
}) {
  return (
    <g className="al-apt-planes">
      {planes.map((p, i) => {
        const id = kinds.get(kindKey(p.model, p.company));
        const top = planeTop(p.model);
        if (!id || !top) return null;
        const s = spriteScale(top.len, k);
        const L = top.len * s;
        const rad = (p.hdg * Math.PI) / 180;
        // 주기장 점은 앞바퀴 자리쯤: 비행기 가운데는 조금 뒤
        const cx = p.x - Math.cos(rad) * L * 0.3;
        const cy = p.y - Math.sin(rad) * L * 0.3;
        const dim = p.company === null || (focus !== null && p.company !== focus);
        return (
          <g key={i} transform={`translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${p.hdg.toFixed(0)})`} className={dim ? 'al-apt-plane al-apt-plane-dim' : 'al-apt-plane'}>
            {/* 화면에서 작을 때만 회사 색 둥근 빛 (크게 보면 동체 줄과 꼬리 색으로 알아본다) */}
            {p.company !== null && !dim && top.len / k < 40 && <ellipse rx={L * 0.62} ry={top.span * s * 0.45} fill={paintOf(p.company).main} className="al-apt-plane-glow" />}
            <use href={`#${id}`} transform={`scale(${s.toFixed(3)})`} />
          </g>
        );
      })}
    </g>
  );
});

const MOVE_DUR = 13;

/** 활주로에서 번갈아 뜨고 내리는 비행기 (도면 위에 겹친 SVG) */
function RunwayTraffic({
  map,
  traffic,
  kinds,
  paintOf,
  k,
}: {
  map: AirportMapData;
  traffic: { company: number | null; model: string }[];
  kinds: Map<string, string>;
  paintOf: (company: number) => Paint;
  k: number;
}) {
  const [n, setN] = useState(0);
  const gap = map.rwy.length >= 2 ? MOVE_DUR * 0.55 : MOVE_DUR * 0.9;
  useEffect(() => {
    const t = window.setTimeout(() => setN((x) => x + 1), gap * 1000);
    return () => window.clearTimeout(t);
  }, [n, gap]);
  const events = [n - 1, n].filter((i) => i >= 0);
  return (
    <g className="al-apt-traffic">
      {events.map((i) => {
        const plane = traffic[i % traffic.length];
        const kind = i % 2 === 0 ? 'takeoff' : 'landing';
        // 활주로가 여럿이면 뜨는 활주로와 내리는 활주로를 나눈다
        const r = map.rwy[kind === 'takeoff' ? 0 : Math.min(1, map.rwy.length - 1)];
        const id = kinds.get(kindKey(plane.model, plane.company));
        if (!id) return null;
        return <Movement key={i} kind={kind} r={r} model={plane.model} id={id} glow={plane.company === null ? null : paintOf(plane.company).main} k={k} />;
      })}
    </g>
  );
}

/** 0~1 사이 이징 (CSS cubic-bezier와 같은 셈) */
function bezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  const cx = (t: number) => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3;
  const cy = (t: number) => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (cx(mid) < x) lo = mid;
    else hi = mid;
  }
  return cy((lo + hi) / 2);
}

/** times(0~1)에 맞춘 값들 사이를 곧게 잇는다 */
function lerpAt(times: number[], values: number[], u: number): number {
  for (let i = 1; i < times.length; i++) {
    if (u <= times[i]) {
      const t = (u - times[i - 1]) / (times[i] - times[i - 1] || 1);
      return values[i - 1] + (values[i] - values[i - 1]) * t;
    }
  }
  return values[values.length - 1];
}

interface MoveGeo {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  angle: number;
  /** 움직임 진행 (활주로 위 자리) */
  keyTimes: number[];
  keyPoints: number[];
  splines: [number, number, number, number][];
  /** 높이 (크기) */
  scaleTimes: number[];
  scale: number[];
  /** 그림자가 비행기에서 떨어지는 거리 (비행기 기준 앞·옆, m) */
  shadow: [number, number][];
  opacityTimes: number[];
  opacity: number[];
}

function moveGeo(kind: 'takeoff' | 'landing', r: AirportMapData['rwy'][number]): MoveGeo {
  const [x1, y1, x2, y2] = r;
  const L = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / L;
  const uy = (y2 - y1) / L;
  const angle = (Math.atan2(uy, ux) * 180) / Math.PI;
  if (kind === 'takeoff') {
    const start = 60;
    const beyond = 2600;
    const total = L - start + beyond;
    const rot = Math.min(0.9, (L * 0.55 - start) / total);
    return {
      x0: x1 + ux * start,
      y0: y1 + uy * start,
      x1: x2 + ux * beyond,
      y1: y2 + uy * beyond,
      angle,
      keyTimes: [0, 0.55, 1],
      keyPoints: [0, rot, 1],
      splines: [
        [0.55, 0, 0.9, 0.6],
        [0.2, 0.3, 0.6, 1],
      ],
      scaleTimes: [0, 0.55, 1],
      scale: [1, 1, 2.1],
      shadow: [
        [0, 0],
        [0, 0],
        [-60, 140],
      ],
      opacityTimes: [0, 0.06, 0.55, 0.86, 1],
      opacity: [0, 1, 1, 1, 0],
    };
  }
  const before = 3000;
  const stop = L * 0.7;
  const touch = (before + 320) / (before + stop);
  return {
    x0: x1 - ux * before,
    y0: y1 - uy * before,
    x1: x1 + ux * stop,
    y1: y1 + uy * stop,
    angle,
    keyTimes: [0, 0.45, 1],
    keyPoints: [0, touch, 1],
    splines: [
      [0, 0, 1, 1],
      [0.1, 0.6, 0.3, 1],
    ],
    scaleTimes: [0, 0.45, 1],
    scale: [2.2, 1, 1],
    shadow: [
      [-70, 160],
      [0, 0],
      [0, 0],
    ],
    opacityTimes: [0, 0.12, 0.86, 1],
    opacity: [0, 1, 1, 0],
  };
}

/**
 * 뜨거나 내리는 비행기 한 대. SVG 자체 움직임(SMIL)은 브라우저가 화면 전체를 자꾸 다시 셈해서 무거우므로,
 * 곧은 길 위 자리를 한 프레임마다 직접 셈해 transform만 바꾼다.
 */
function Movement({ kind, r, model, id, glow, k }: { kind: 'takeoff' | 'landing'; r: AirportMapData['rwy'][number]; model: string; id: string; glow: string | null; k: number }) {
  const geo = useMemo(() => moveGeo(kind, r), [kind, r]);
  const box = useRef<SVGGElement>(null);
  const body = useRef<SVGGElement>(null);
  const shade = useRef<SVGEllipseElement>(null);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / (MOVE_DUR * 1000));
      let p = geo.keyPoints[geo.keyPoints.length - 1];
      for (let i = 1; i < geo.keyTimes.length; i++) {
        if (u <= geo.keyTimes[i]) {
          const t = (u - geo.keyTimes[i - 1]) / (geo.keyTimes[i] - geo.keyTimes[i - 1]);
          const [a, b, c, d] = geo.splines[i - 1];
          p = geo.keyPoints[i - 1] + (geo.keyPoints[i] - geo.keyPoints[i - 1]) * bezier(a, b, c, d, t);
          break;
        }
      }
      const x = geo.x0 + (geo.x1 - geo.x0) * p;
      const y = geo.y0 + (geo.y1 - geo.y0) * p;
      const sc = lerpAt(geo.scaleTimes, geo.scale, u);
      const sx = lerpAt(geo.scaleTimes, geo.shadow.map((v) => v[0]), u);
      const sy = lerpAt(geo.scaleTimes, geo.shadow.map((v) => v[1]), u);
      box.current?.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${geo.angle.toFixed(1)})`);
      box.current?.setAttribute('opacity', lerpAt(geo.opacityTimes, geo.opacity, u).toFixed(2));
      body.current?.setAttribute('transform', `scale(${sc.toFixed(3)})`);
      shade.current?.setAttribute('transform', `translate(${sx.toFixed(1)} ${sy.toFixed(1)})`);
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [geo]);
  const top = planeTop(model);
  if (!top) return null;
  const s = spriteScale(top.len, k);
  const L = top.len * s;
  const S = top.span * s;
  return (
    <g ref={box} opacity={0} className="al-apt-mover">
      <ellipse ref={shade} rx={L * 0.5} ry={S * 0.32} className="al-apt-shadow" />
      <g ref={body}>
        {glow && top.len / k < 40 && <ellipse rx={L * 0.62} ry={S * 0.45} fill={glow} className="al-apt-plane-glow" />}
        <use href={`#${id}`} transform={`scale(${s.toFixed(3)})`} />
      </g>
    </g>
  );
}
