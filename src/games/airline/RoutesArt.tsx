import { useId, useRef, type ReactNode } from 'react';
import { useElementWidth } from '../../lib/useElementWidth';
import { MAP_PLANE_D } from './Art';
import { fmtMoney, km } from './format';

/**
 * 🧭 노선 화면 그림: 두 도시를 잇는 하늘길, 손님 나눔 막대, 운임 눈금, 하루 시간대 시계,
 * 시간대 맞춤 막대, 수입·비용 두 줄 막대, 좌석 나눔 막대.
 * 글자는 늘 글자 색, 색은 막대·점에만. 색으로만 읽히지 않게 이름·값을 옆에 같이 쓴다.
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ------------------------------------------------------------------ 작은 아이콘 (24×24 선 그림)

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export type RouteIconKind = 'biz' | 'leisure' | 'xfer' | 'seat' | 'route';

const ROUTE_ICONS: Record<RouteIconKind, ReactNode> = {
  // 서류 가방 (사업 손님)
  biz: (
    <>
      <rect x={3.5} y={7.5} width={17} height={12} rx={2} {...S} />
      <path d="M9 7.5V5.6c0-.6.5-1.1 1.1-1.1h3.8c.6 0 1.1.5 1.1 1.1v1.9M3.5 12.5h17M11 12.5v1.8h2v-1.8" {...S} />
    </>
  ),
  // 파라솔 (관광 손님)
  leisure: (
    <>
      <path d="M4 11.5a8 8 0 0 1 16 0z" {...S} />
      <path d="M12 11.5V20M8.5 20.5h7M12 3.5v.5" {...S} />
    </>
  ),
  // 갈아타기 (두 화살표)
  xfer: <path d="M4 8h13l-3-3M20 16H7l3 3" {...S} />,
  // 좌석
  seat: (
    <>
      <path d="M7 4.5v9.5h9.5l1.5 5.5" {...S} />
      <path d="M7 14l-1.5 5.5M10.5 10h5" {...S} />
    </>
  ),
  // 하늘길 (두 점과 곡선)
  route: (
    <>
      <circle cx={5} cy={17} r={2} {...S} />
      <circle cx={19} cy={17} r={2} {...S} />
      <path d="M6.6 15.6C9 7 15 7 17.4 15.6" {...S} strokeDasharray="2 2.4" />
    </>
  ),
};

export function RouteIcon({ kind, size = 18, className }: { kind: RouteIconKind; size?: number; className?: string }) {
  return (
    <svg className={`al-sicon${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {ROUTE_ICONS[kind]}
    </svg>
  );
}

/** 노선 목록 줄의 작은 하늘길 (점—곡선—점) */
export function RouteGlyph() {
  return (
    <svg className="al-rr-glyph" width={22} height={10} viewBox="0 0 22 10" aria-hidden="true">
      <path d="M3 8Q11 -1 19 8" className="al-ra-path al-rea-thin" />
      <circle cx={3} cy={8} r={2} className="al-ra-dot" />
      <circle cx={19} cy={8} r={2} className="al-ra-dot" />
    </svg>
  );
}

// ------------------------------------------------------------------ 두 도시를 잇는 하늘길

/** 두 점을 잇는 둥근 하늘길과 가운데 비행기. 꼭대기에 거리 */
export function RouteArc({ distance, height = 44 }: { distance: number; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(80, useElementWidth(ref) || 200);
  const x0 = 7;
  const x1 = width - 7;
  const y = height - 9;
  const top = 12;
  const mx = width / 2;
  // 2차 곡선의 가운데 점 = (P0 + 2C + P1) / 4 → C = 2*top - y
  const cy = 2 * top - y;
  return (
    <div className="al-ra-arc" ref={ref} aria-hidden="true">
      <svg width={width} height={height}>
        <path d={`M${x0} ${y}Q${mx} ${cy} ${x1} ${y}`} className="al-ra-path" />
        <circle cx={x0} cy={y} r={5} className="al-ra-dot" />
        <circle cx={x1} cy={y} r={5} className="al-ra-dot" />
        <rect x={mx - 32} y={top - 9} width={64} height={18} rx={9} className="al-ra-chip" />
        <text x={mx} y={top + 4} textAnchor="middle" className="al-ra-km">
          {km(distance)}
        </text>
        <path d={MAP_PLANE_D} transform={`translate(${mx + 46} ${top + 3}) rotate(8) scale(0.95)`} className="al-ra-plane" />
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ 한 줄 나눔 막대 (손님·좌석)

export interface SplitPart {
  key: string;
  name: ReactNode;
  v: number;
  /** css 색 (var(...) 또는 hex) */
  color: string;
  /** 범례에 쓸 값 글 */
  text?: string;
}

/**
 * 한 덩어리를 몇 조각으로 나눈 얇은 막대 (조각 사이 2px 틈). 아래 범례에 이름과 값.
 * 조각이 넓으면 안에 몫(%)을 쓴다.
 */
export function SplitBar({ parts, label, height = 14, legend = true }: { parts: SplitPart[]; label: string; height?: number; legend?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(120, useElementWidth(ref) || 300);
  const shown = parts.filter((p) => p.v > 0);
  const total = shown.reduce((s, p) => s + p.v, 0);
  let at = 0;
  return (
    <div className="al-split" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={`${label}: ${shown.map((p) => `${typeof p.name === 'string' ? p.name : p.key} ${Math.round((p.v / Math.max(1, total)) * 100)}%`).join(', ')}`}>
        {total <= 0 && <rect x={0} y={0} width={width} height={height} rx={height / 2} className="al-hc-track" />}
        {shown.map((p, i) => {
          const a = (at / total) * width + (i > 0 ? 1 : 0);
          at += p.v;
          const b = (at / total) * width - (i < shown.length - 1 ? 1 : 0);
          const w = Math.max(0, b - a);
          return (
            <rect key={p.key} x={a} y={0} width={w} height={height} rx={Math.min(height / 2, w / 2, 5)} style={{ fill: p.color }}>
              <title>
                {typeof p.name === 'string' ? p.name : p.key} {p.text ?? ''} ({Math.round((p.v / total) * 100)}%)
              </title>
            </rect>
          );
        })}
      </svg>
      {legend && (
        <ul className="al-hc-legend al-split-legend">
          {shown.map((p) => (
            <li key={p.key}>
              <i className="al-sw" style={{ background: p.color }} /> {p.name} <b>{p.text ?? `${Math.round((p.v / Math.max(1, total)) * 100)}%`}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ 운임 눈금

export interface FareMark {
  key: string;
  fare: number;
  color: string;
  name: string;
}

/** 싸게 −30% ~ 비싸게 +30% 눈금 위에 내 운임(삼각형)과 라이벌 운임(회사 색 점) */
export function FareScale({ mine, rivals, min, max }: { mine: number; rivals: FareMark[]; min: number; max: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(200, useElementWidth(ref) || 320);
  const pad = 14;
  const x = (f: number) => pad + ((clamp(f, min, max) - min) / (max - min)) * (width - pad * 2);
  const axisY = 22;
  const ticks = [min, min / 2, 0, max / 2, max];
  return (
    <div className="al-chart al-farescale" ref={ref}>
      <svg width={width} height={rivals.length > 0 ? 58 : 46} role="img" aria-label={`내 운임 ${mine}%${rivals.length ? `, 라이벌 ${rivals.map((r) => `${r.name} ${r.fare}%`).join(', ')}` : ''}`}>
        <rect x={pad} y={axisY - 3} width={x(0) - pad} height={6} rx={3} className="al-fs-cheap" />
        <rect x={x(0)} y={axisY - 3} width={width - pad - x(0)} height={6} rx={3} className="al-fs-dear" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={axisY - 6} y2={axisY + 6} className={t === 0 ? 'al-fs-zero' : 'al-pl-tick'} />
            <text x={x(t)} y={axisY + 18} textAnchor={t === min ? 'start' : t === max ? 'end' : 'middle'} className="al-tick">
              {t === 0 ? '보통' : `${t > 0 ? '+' : ''}${t}%`}
            </text>
          </g>
        ))}
        <path d={`M${x(mine)} ${axisY - 5}l-6 -10h12z`} className="al-fs-me">
          <title>내 운임 {mine === 0 ? '보통' : `${mine > 0 ? '+' : ''}${mine}%`}</title>
        </path>
        {rivals.map((r, i) => {
          // 같은 운임인 회사가 여럿이면 옆으로 조금씩 비켜 놓는다
          const same = rivals.filter((o) => o.fare === r.fare);
          const k = same.indexOf(r);
          const dx = (k - (same.length - 1) / 2) * 11;
          return (
            <circle key={r.key + i} cx={x(r.fare) + dx} cy={axisY + 30} r={5} className="al-fs-rival" style={{ fill: r.color }}>
              <title>
                {r.name} {r.fare === 0 ? '보통' : `${r.fare > 0 ? '+' : ''}${r.fare}%`}
              </title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ 하루 시간대 시계

export interface BandSlice {
  start: number;
  len: number;
  count: number;
  closed: boolean;
  name: string;
}

/** 24시간 시계: 시간대마다 고리 조각, 편이 많을수록 진하게. 가운데에 주간 편수 */
export function BandDial({ bands, total, size = 96 }: { bands: BandSlice[]; total: number; size?: number }) {
  const c = size / 2;
  const r = size / 2 - 9;
  const sw = 12;
  const max = Math.max(1, ...bands.map((b) => b.count));
  const pt = (h: number, rad: number) => {
    const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
    return [c + rad * Math.cos(a), c + rad * Math.sin(a)] as const;
  };
  const arc = (h0: number, h1: number) => {
    const [x0, y0] = pt(h0, r);
    const [x1, y1] = pt(h1, r);
    const large = h1 - h0 > 12 ? 1 : 0;
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  return (
    <svg className="al-dial" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`하루 시간대: ${bands.map((b) => `${b.name} 주 ${b.count}`).join(', ')}`}>
      <circle cx={c} cy={c} r={r} className="al-dial-track" strokeWidth={sw} />
      {bands.map((b) => (
        <path
          key={b.name}
          d={arc(b.start + 0.15, b.start + b.len - 0.15)}
          strokeWidth={sw}
          className={b.closed ? 'al-dial-closed' : b.count > 0 ? 'al-dial-on' : 'al-dial-off'}
          style={b.count > 0 && !b.closed ? { opacity: 0.35 + 0.65 * (b.count / max) } : undefined}
        >
          <title>
            {b.name} {b.closed ? '밤 운항 금지' : `주 ${b.count}회`}
          </title>
        </path>
      ))}
      {[0, 6, 12, 18].map((h) => {
        const [x, y] = pt(h, r - sw / 2 - 7);
        return (
          <text key={h} x={x} y={y + 3} textAnchor="middle" className="al-dial-hour">
            {h}
          </text>
        );
      })}
      <text x={c} y={c + 1} textAnchor="middle" className="al-dial-num">
        {total}
      </text>
      <text x={c} y={c + 12} textAnchor="middle" className="al-dial-sub">
        주 왕복
      </text>
    </svg>
  );
}

// ------------------------------------------------------------------ 시간대 맞춤 (100%가 보통)

/** 60%~140% 눈금, 100% 자리에서 지금 값까지 채운다 (넘으면 초록, 모자라면 빨강) */
export function FitBar({ value, label }: { value: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(40, useElementWidth(ref) || 160);
  const lo = 0.6;
  const hi = 1.4;
  const x = (v: number) => 1 + ((clamp(v, lo, hi) - lo) / (hi - lo)) * (width - 2);
  const a = Math.min(x(1), x(value));
  const b = Math.max(x(1), x(value));
  const tone = value >= 1.02 ? 'al-fit-up' : value < 0.95 ? 'al-fit-down' : 'al-fit-even';
  return (
    <div className="al-chart al-fitbar" ref={ref}>
      <svg width={width} height={14} role="img" aria-label={`${label} ${Math.round(value * 100)}%`}>
        <rect x={1} y={3} width={width - 2} height={8} rx={4} className="al-hc-track" />
        {b - a > 0.5 && <rect x={a} y={3} width={b - a} height={8} rx={3} className={tone} />}
        <line x1={x(1)} x2={x(1)} y1={0} y2={14} className="al-hc-need" />
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ 노선 수입 vs 비용

export interface CostSeg {
  key: string;
  name: string;
  v: number;
  /** css 클래스 (fill 색) */
  cls: string;
}

/**
 * 두 줄 막대: 위는 달 운임 수입, 아래는 비용 항목을 나눠 쌓은 막대 (같은 눈금).
 * 수입이 더 크면 남는 몫(이익)을 비용 뒤에 연한 초록으로, 모자라면 넘친 몫(손해)을 빨간 빗금으로.
 */
export function RouteMoney({ revenue, costs }: { revenue: number; costs: CostSeg[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(220, useElementWidth(ref) || 320);
  const id = useId();
  const cost = costs.reduce((s, c) => s + Math.max(0, c.v), 0);
  const max = Math.max(1, revenue, cost);
  const labelW = 34;
  const x = (v: number) => labelW + (clamp(v, 0, max) / max) * (width - labelW - 2);
  const bh = 14;
  const y1 = 2;
  const y2 = y1 + bh + 8;
  const profit = revenue - cost;
  let at = 0;
  const segs = costs.filter((c) => c.v > 0);
  return (
    <div className="al-chart al-rmoney" ref={ref}>
      <svg width={width} height={y2 + bh + 2} role="img" aria-label={`달 수입 ${fmtMoney(revenue)}, 비용 ${fmtMoney(cost)}, ${profit >= 0 ? '이익' : '손해'} ${fmtMoney(Math.abs(profit))}`}>
        <defs>
          <pattern id={`${id}-loss`} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={6} height={6} className="al-flow-loss-bg" />
            <line x1={1.5} y1={0} x2={1.5} y2={6} className="al-flow-loss-line" />
          </pattern>
        </defs>
        <text x={0} y={y1 + bh - 3} className="al-tick">
          수입
        </text>
        {revenue > 0 && (
          <rect x={x(0)} y={y1} width={x(revenue) - x(0)} height={bh} rx={4} className="al-rm-rev">
            <title>달 운임 수입 {fmtMoney(revenue)}</title>
          </rect>
        )}
        <text x={0} y={y2 + bh - 3} className="al-tick">
          비용
        </text>
        {profit > 0 && (
          <rect x={x(cost)} y={y2} width={x(revenue) - x(cost)} height={bh} rx={4} className="al-flow-profit">
            <title>이익 {fmtMoney(profit)}</title>
          </rect>
        )}
        {segs.map((s, i) => {
          const a = x(at) + (i > 0 ? 1 : 0);
          at += s.v;
          const b = x(Math.min(at, max)) - (i < segs.length - 1 ? 1 : 0);
          const w = Math.max(0, b - a);
          return (
            <rect key={s.key} x={a} y={y2} width={w} height={bh} rx={Math.min(4, w / 2)} className={`al-rm-seg ${s.cls}`}>
              <title>
                {s.name} {fmtMoney(s.v)}
              </title>
            </rect>
          );
        })}
        {profit < 0 && (
          <rect x={x(revenue)} y={y2 + bh + 1} width={Math.max(2, x(cost) - x(revenue))} height={3} rx={1.5} fill={`url(#${id}-loss)`} className="al-rm-loss">
            <title>손해 {fmtMoney(-profit)}</title>
          </rect>
        )}
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ 빈 화면 그림

/** 노선을 고르기 전: 지구 위 하늘길 세 갈래와 비행기 */
export function RoutesEmptyArt() {
  return (
    <svg className="al-routes-empty-art" width={180} height={110} viewBox="0 0 180 110" aria-hidden="true">
      <ellipse cx={90} cy={98} rx={78} ry={9} className="al-rea-ground" />
      <path d="M22 88Q60 18 158 80" className="al-rea-path" />
      <path d="M22 88Q90 50 140 92" className="al-rea-path al-rea-thin" />
      <path d="M40 94Q70 66 100 92" className="al-rea-path al-rea-thin" />
      {[
        [22, 88],
        [158, 80],
        [140, 92],
        [40, 94],
        [100, 92],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={4.5} className="al-ra-dot" />
      ))}
      <path d={MAP_PLANE_D} transform="translate(92 38) rotate(12) scale(1.7)" className="al-ra-plane" />
    </svg>
  );
}
