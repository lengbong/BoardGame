import { useEffect, useMemo, useState } from 'react';
import type { ParkedPlane } from './airportScene';
import type { AirportMapData } from './airportTypes';
import { planeSize, planeTopUrl, type Paint } from './PlaneImage';

/**
 * 공항 도면 (오픈스트리트맵) 위에 비행기를 세우고 뜨고 내리는 모습을 그린다.
 * 좌표는 m 단위. k는 화면 1px이 몇 m인지 (선 굵기·글자·비행기 최소 크기를 화면 기준으로 맞춘다).
 */
export interface AirportSceneProps {
  map: AirportMapData;
  planes: ParkedPlane[];
  paintOf: (company: number) => Paint;
  /** 이착륙 연출에 쓸 비행기 차례 */
  traffic: { company: number | null; model: string }[];
  animate: boolean;
  k: number;
  /** 크게 보기: 활주로 번호·유도로 가운데 선·터미널 이름 */
  detail?: boolean;
  /** 이 회사 비행기만 또렷하게 (나머지는 흐리게) */
  focus?: number | null;
}

/** 비행기는 화면에서 이만큼(px)보다 작아지지 않게 키운다 */
const MIN_PLANE_PX = 10;

export function AirportScene({ map, planes, paintOf, traffic, animate, k, detail = false, focus = null }: AirportSceneProps) {
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
      <g className="al-apt-planes">
        {planes.map((p, i) => (
          <PlaneSprite
            key={i}
            model={p.model}
            paint={p.company === null ? null : paintOf(p.company)}
            x={p.x}
            y={p.y}
            hdg={p.hdg}
            k={k}
            dim={p.company === null || (focus !== null && p.company !== focus)}
          />
        ))}
      </g>
      {animate && map.rwy.length > 0 && traffic.length > 0 && <RunwayTraffic map={map} traffic={traffic} paintOf={paintOf} k={k} />}
      {detail &&
        map.labels?.map(([x, y, name]) => (
          <text key={name} x={x} y={y} className="al-apt-label" fontSize={12 * k} strokeWidth={3 * k} textAnchor="middle">
            {name}
          </text>
        ))}
    </g>
  );
}

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

function spriteScale(len: number, k: number) {
  return Math.max(1, (MIN_PLANE_PX * k) / len);
}

function PlaneSprite({ model, paint, x, y, hdg, k, dim }: { model: string; paint: Paint | null; x: number; y: number; hdg: number; k: number; dim: boolean }) {
  const size = planeSize(model);
  const url = planeTopUrl(model, paint);
  if (!size || !url) return null;
  const s = spriteScale(size.len, k);
  const L = size.len * s;
  const S = size.span * s;
  const rad = (hdg * Math.PI) / 180;
  // 주기장 점은 앞바퀴 자리쯤: 비행기 가운데는 조금 뒤
  const cx = x - Math.cos(rad) * L * 0.3;
  const cy = y - Math.sin(rad) * L * 0.3;
  return (
    <g transform={`translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${(hdg - 180).toFixed(0)})`} className={dim ? 'al-apt-plane al-apt-plane-dim' : 'al-apt-plane'}>
      {paint && <ellipse rx={L * 0.62} ry={S * 0.45} fill={paint.main} className="al-apt-plane-glow" />}
      <image href={url} x={-L / 2} y={-S / 2} width={L} height={S} preserveAspectRatio="xMidYMid meet" />
    </g>
  );
}

/** 한 번만 도는 SVG 움직임은 붙자마자 지금부터 시작한다 */
function startNow(el: SVGAnimationElement | null) {
  try {
    el?.beginElement();
  } catch {
    // 움직임을 못 쓰는 브라우저면 그냥 둔다
  }
}

const MOVE_DUR = 13;

/** 활주로에서 번갈아 뜨고 내리는 비행기 */
function RunwayTraffic({ map, traffic, paintOf, k }: { map: AirportMapData; traffic: { company: number | null; model: string }[]; paintOf: (company: number) => Paint; k: number }) {
  const [n, setN] = useState(0);
  const gap = map.rwy.length >= 2 ? MOVE_DUR * 0.55 : MOVE_DUR * 0.9;
  useEffect(() => {
    const t = window.setTimeout(() => setN((x) => x + 1), gap * 1000);
    return () => window.clearTimeout(t);
  }, [n, gap]);
  const events = [n - 1, n].filter((i) => i >= 0);
  return (
    <g className="al-apt-traffic" aria-hidden="true">
      {events.map((i) => {
        const plane = traffic[i % traffic.length];
        const kind = i % 2 === 0 ? 'takeoff' : 'landing';
        // 활주로가 여럿이면 뜨는 활주로와 내리는 활주로를 나눈다
        const r = map.rwy[kind === 'takeoff' ? 0 : Math.min(1, map.rwy.length - 1)];
        return <Movement key={i} kind={kind} r={r} model={plane.model} paint={plane.company === null ? null : paintOf(plane.company)} k={k} />;
      })}
    </g>
  );
}

function Movement({ kind, r, model, paint, k }: { kind: 'takeoff' | 'landing'; r: AirportMapData['rwy'][number]; model: string; paint: Paint | null; k: number }) {
  const geo = useMemo(() => {
    const [x1, y1, x2, y2] = r;
    const L = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / L;
    const uy = (y2 - y1) / L;
    if (kind === 'takeoff') {
      const start = 60;
      const beyond = 2600;
      const total = L - start + beyond;
      const rot = Math.min(0.9, (L * 0.55 - start) / total);
      return {
        path: `M${(x1 + ux * start).toFixed(0)} ${(y1 + uy * start).toFixed(0)}L${(x2 + ux * beyond).toFixed(0)} ${(y2 + uy * beyond).toFixed(0)}`,
        keyPoints: `0;${rot.toFixed(3)};1`,
        keyTimes: '0;0.55;1',
        keySplines: '0.55 0 0.9 0.6;0.2 0.3 0.6 1',
        scale: '1;1;2.1',
        scaleTimes: '0;0.55;1',
        shadow: '0 0;0 0;-60 140',
        opacity: '0;1;1;1;0',
        opacityTimes: '0;0.06;0.55;0.86;1',
      };
    }
    const before = 3000;
    const stop = L * 0.7;
    const total = before + stop;
    const touch = (before + 320) / total;
    return {
      path: `M${(x1 - ux * before).toFixed(0)} ${(y1 - uy * before).toFixed(0)}L${(x1 + ux * stop).toFixed(0)} ${(y1 + uy * stop).toFixed(0)}`,
      keyPoints: `0;${touch.toFixed(3)};1`,
      keyTimes: '0;0.45;1',
      keySplines: '0 0 1 1;0.1 0.6 0.3 1',
      scale: '2.2;1;1',
      scaleTimes: '0;0.45;1',
      shadow: '-70 160;0 0;0 0',
      opacity: '0;1;1;0',
      opacityTimes: '0;0.12;0.86;1',
    };
  }, [kind, r]);
  const size = planeSize(model);
  const url = planeTopUrl(model, paint);
  if (!size || !url) return null;
  const s = spriteScale(size.len, k);
  const L = size.len * s;
  const S = size.span * s;
  const dur = `${MOVE_DUR}s`;
  return (
    <g opacity={0} className="al-apt-mover">
      <animateMotion ref={startNow} begin="indefinite" dur={dur} fill="freeze" path={geo.path} rotate="auto" calcMode="spline" keyPoints={geo.keyPoints} keyTimes={geo.keyTimes} keySplines={geo.keySplines} />
      <animate ref={startNow} attributeName="opacity" begin="indefinite" dur={dur} fill="freeze" values={geo.opacity} keyTimes={geo.opacityTimes} />
      <g className="al-apt-shadow">
        <animateTransform ref={startNow} attributeName="transform" type="translate" begin="indefinite" dur={dur} fill="freeze" values={geo.shadow} keyTimes={geo.scaleTimes} />
        <image href={url} x={-L / 2} y={-S / 2} width={L} height={S} transform="rotate(180)" />
      </g>
      <g>
        <animateTransform ref={startNow} attributeName="transform" type="scale" begin="indefinite" dur={dur} fill="freeze" values={geo.scale} keyTimes={geo.scaleTimes} />
        {paint && <ellipse rx={L * 0.62} ry={S * 0.45} fill={paint.main} className="al-apt-plane-glow" />}
        <image href={url} x={-L / 2} y={-S / 2} width={L} height={S} transform="rotate(180)" />
      </g>
    </g>
  );
}
