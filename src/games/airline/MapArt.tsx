import { useId, useRef, type ReactNode } from 'react';
import { useElementWidth } from '../../lib/useElementWidth';
import { MAP_PLANE_D } from './Art';
import { FinIcon, type FinIconKind } from './FinanceArt';
import { LINE as S, StaffIcon, type StaffIconKind } from './StaffArt';
import type { WeatherCause } from './calendar';

/**
 * 🗺️ 지도 탭 아래 정보 칸 그림: 경영 비서 아이콘, 숫자 고리, 손님 성격 막대, 성수기 막대, 슬롯 막대,
 * 행선지 손님 막대, 노선 몫 막대, 날씨·별 아이콘, 노선 머리 그림.
 * 색은 막대에만, 글자는 글자 색. 숫자와 이름을 늘 같이 쓴다.
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ------------------------------------------------------------------ 지도 탭 전용 아이콘 (24×24 선 그림)

export type MapIconKind = 'route' | 'cut' | 'plus' | 'swap' | 'typhoon' | 'snow' | 'rain' | 'fog' | 'storm' | 'sun' | 'forward' | 'decide' | 'biz' | 'fun' | 'up' | 'gate' | 'hub' | 'xfer';

const MAP_ICONS: Record<MapIconKind, ReactNode> = {
  route: (
    <>
      <circle cx={5} cy={17} r={2.2} {...S} />
      <circle cx={19} cy={7} r={2.2} {...S} />
      <path d="M6.6 15.4C9 9 13 7.5 16.8 7.2" {...S} strokeDasharray="2 2.4" />
    </>
  ),
  cut: (
    <>
      <circle cx={6.5} cy={17} r={2.6} {...S} />
      <circle cx={17.5} cy={17} r={2.6} {...S} />
      <path d="M8.4 15.2L18 4.5M15.6 15.2L6 4.5" {...S} />
    </>
  ),
  plus: (
    <>
      <circle cx={12} cy={12} r={8.5} {...S} />
      <path d="M12 8v8M8 12h8" {...S} />
    </>
  ),
  swap: (
    <>
      <path d="M4 8.5h14l-3.5-3.5M20 15.5H6l3.5 3.5" {...S} />
    </>
  ),
  typhoon: (
    <>
      <path d="M12 12m-2.6 0a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0-5.2 0" {...S} />
      <path d="M14.6 12c0-5-4-7.5-8.6-7M9.4 12c0 5 4 7.5 8.6 7" {...S} />
    </>
  ),
  snow: <path d="M12 3.5v17M4.6 7.8l14.8 8.4M4.6 16.2l14.8-8.4M9.6 4.8L12 7l2.4-2.2M9.6 19.2L12 17l2.4 2.2" {...S} />,
  rain: (
    <>
      <path d="M7 15.5a4 4 0 0 1-.3-8 5.5 5.5 0 0 1 10.6 1.3 3.4 3.4 0 0 1-.3 6.7z" {...S} />
      <path d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5" {...S} />
    </>
  ),
  fog: <path d="M4 8h16M6 12h12M4 16h16M8 20h8" {...S} />,
  storm: (
    <>
      <path d="M7 14.5a4 4 0 0 1-.3-8 5.5 5.5 0 0 1 10.6 1.3 3.4 3.4 0 0 1-.3 6.7" {...S} />
      <path d="M12.5 13l-2.5 4h3.5l-2 4" {...S} />
    </>
  ),
  sun: (
    <>
      <circle cx={12} cy={12} r={4} {...S} />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" {...S} />
    </>
  ),
  forward: <path d="M4 6.5l7 5.5-7 5.5zM12.5 6.5l7 5.5-7 5.5z" {...S} />,
  decide: (
    <>
      <path d="M12 21V3.5" {...S} />
      <path d="M12 5.5h6.5l2 2-2 2H12M12 11.5H5.5l-2 2 2 2H12" {...S} />
    </>
  ),
  biz: (
    <>
      <rect x={3.5} y={7.5} width={17} height={12} rx={2} {...S} />
      <path d="M9 7.5V5.6c0-.6.5-1.1 1.1-1.1h3.8c.6 0 1.1.5 1.1 1.1v1.9M3.5 12.5h17" {...S} />
    </>
  ),
  fun: (
    <>
      <rect x={3.5} y={7} width={17} height={12.5} rx={2.2} {...S} />
      <path d="M8.5 7l1.4-2.5h4.2L15.5 7" {...S} />
      <circle cx={12} cy={13.2} r={3.4} {...S} />
    </>
  ),
  up: <path d="M12 20V5M6 10.5L12 4.5l6 6" {...S} />,
  gate: (
    <>
      <rect x={4} y={5} width={16} height={14} rx={2} {...S} />
      <path d="M4 9.5h16M8.5 13h7M8.5 16h4" {...S} />
    </>
  ),
  hub: (
    <>
      <path d="M12 3.6l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" {...S} />
    </>
  ),
  xfer: (
    <>
      <circle cx={12} cy={12} r={2.6} {...S} />
      <path d="M3.5 17.5L9.8 13.6M14.2 10.4l6.3-3.9M20.5 6.5h-4M20.5 6.5v4" {...S} />
    </>
  ),
};

export function MapIcon({ kind, size = 20, className }: { kind: MapIconKind; size?: number; className?: string }) {
  return (
    <svg className={`al-sicon${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {MAP_ICONS[kind]}
    </svg>
  );
}

/** 세 묶음(지도·재무·인사) 아이콘 가운데 하나 */
export type AnyIcon = { set: 'map'; kind: MapIconKind } | { set: 'fin'; kind: FinIconKind } | { set: 'staff'; kind: StaffIconKind };

export function AnyIconView({ icon, size = 20, className }: { icon: AnyIcon; size?: number; className?: string }) {
  if (icon.set === 'map') return <MapIcon kind={icon.kind} size={size} className={className} />;
  if (icon.set === 'fin') return <FinIcon kind={icon.kind} size={size} className={className} />;
  return <StaffIcon kind={icon.kind} size={size} className={className} />;
}

const m = (kind: MapIconKind): AnyIcon => ({ set: 'map', kind });
const f = (kind: FinIconKind): AnyIcon => ({ set: 'fin', kind });
const st = (kind: StaffIconKind): AnyIcon => ({ set: 'staff', kind });

/** 경영 비서 권유의 열쇠(key)로 고른 아이콘. 모르는 열쇠면 null (그때는 원래 이모지) */
export function adviceIcon(key: string): AnyIcon | null {
  if (key === 'spare') return f('shield');
  const head = key.split('-')[0];
  switch (head) {
    case 'choice':
      return m('decide');
    case 'first':
    case 'route':
    case 'swaproute':
      return m('route');
    case 'idle':
      return f('parked');
    case 'spare':
    case 'times':
      return st('clock');
    case 'close':
      return m('cut');
    case 'add':
      return m('plus');
    case 'fareup':
      return f('chart');
    case 'freqdown':
      return f('down');
    case 'faredown':
      return f('tag');
    case 'upgrade':
      return m('up');
    case 'orderfull':
    case 'order':
      return f('shop');
    case 'renew':
    case 'maint':
    case 'maintdown':
      return f('wrench');
    case 'swap':
      return m('swap');
    case 'hire':
      return f('people');
    case 'pay':
      return f('coin');
    case 'academy':
      return st('school');
    case 'typhoon':
      return m('typhoon');
    case 'snow':
      return m('snow');
    case 'borrow':
    case 'repay':
      return f('bank');
    case 'ads':
      return f('megaphone');
    case 'goal':
      return f('target');
    case 'auto':
      return m('forward');
    default:
      return null;
  }
}

/** 날씨 걱정 아이콘 (걱정이 없으면 해) */
export function weatherIcon(cause: WeatherCause | null | undefined): MapIconKind {
  switch (cause) {
    case 'typhoon':
      return 'typhoon';
    case 'snow':
      return 'snow';
    case 'monsoon':
      return 'rain';
    case 'fog':
      return 'fog';
    case 'storm':
      return 'storm';
    default:
      return 'sun';
  }
}

// ------------------------------------------------------------------ 숫자 고리

export type Tone = 'good' | 'warn' | 'bad' | 'blue';

/** 동그란 고리 + 가운데 글 (예: 평판 71, 가동률 49%) */
export function StatRing({ value, text, tone, size = 52, label }: { value: number; text: string; tone: Tone; size?: number; label: string }) {
  const v = clamp(value, 0, 1);
  const r = size / 2 - 4.5;
  const c = 2 * Math.PI * r;
  return (
    <svg className="al-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      <circle cx={size / 2} cy={size / 2} r={r} className="al-ring-track" strokeWidth={6} />
      {v > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={`al-ring-fill al-ring-${tone}`}
          strokeWidth={6}
          strokeDasharray={`${(c * v).toFixed(2)} ${c.toFixed(2)}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      <text x={size / 2} y={size / 2 + 4.5} textAnchor="middle" className="al-ring-text al-mp-ring-text">
        {text}
      </text>
    </svg>
  );
}

// ------------------------------------------------------------------ 별 다섯 (관광 매력)

export function StarRow({ value, max = 10, label }: { value: number; max?: number; label: string }) {
  const id = useId();
  const five = (clamp(value, 0, max) / max) * 5;
  const d = 'M8 1.2l2 4.1 4.5.7-3.3 3.2.8 4.5L8 11.6l-4 2.1.8-4.5L1.5 6l4.5-.7z';
  return (
    <svg className="al-mp-stars" width={84} height={16} viewBox="0 0 84 16" role="img" aria-label={label}>
      <defs>
        <clipPath id={`${id}-c`}>
          <rect x={0} y={0} width={(five / 5) * 84} height={16} />
        </clipPath>
      </defs>
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={`o${i}`} d={d} transform={`translate(${i * 17} 0.5)`} className="al-mp-star-off" />
      ))}
      <g clipPath={`url(#${id}-c)`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={`f${i}`} d={d} transform={`translate(${i * 17} 0.5)`} className="al-mp-star-on" />
        ))}
      </g>
    </svg>
  );
}

// ------------------------------------------------------------------ 손님 성격 (사업 vs 관광)

/** 한 막대를 사업(파랑)·관광(금색)으로 나누고, 양 끝에 아이콘과 % */
export function MixBar({ biz, label }: { biz: number; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(200, useElementWidth(ref) || 320);
  const b = clamp(biz, 0, 1);
  const iconW = 22;
  const x0 = iconW;
  const x1 = width - iconW;
  const split = x0 + (x1 - x0) * b;
  const bh = 14;
  const y = 3;
  return (
    <div className="al-chart al-mp-mix" ref={ref}>
      <svg width={width} height={bh + 22} role="img" aria-label={label ?? `사업 손님 ${Math.round(b * 100)}%, 관광 손님 ${Math.round((1 - b) * 100)}%`}>
        <svg x={0} y={y - 2} width={18} height={18} viewBox="0 0 24 24" className="al-mp-biz-ink" aria-hidden="true">
          {MAP_ICONS.biz}
        </svg>
        <svg x={width - 18} y={y - 2} width={18} height={18} viewBox="0 0 24 24" className="al-mp-fun-ink" aria-hidden="true">
          {MAP_ICONS.fun}
        </svg>
        {b > 0.005 && <rect x={x0} y={y} width={Math.max(0, split - x0 - (b < 0.995 ? 1 : 0))} height={bh} rx={4} className="al-mp-biz" />}
        {b < 0.995 && <rect x={split + (b > 0.005 ? 1 : 0)} y={y} width={Math.max(0, x1 - split - (b > 0.005 ? 1 : 0))} height={bh} rx={4} className="al-mp-fun" />}
        <text x={x0} y={y + bh + 14} className="al-tick">
          사업 {Math.round(b * 100)}%
        </text>
        <text x={x1} y={y + bh + 14} textAnchor="end" className="al-tick">
          관광 {Math.round((1 - b) * 100)}%
        </text>
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ 성수기 (열두 달 관광 손님 배수)

/** 열두 달 막대: 1보다 크면 진하게, 이번 달은 강조 + 값 */
export function SeasonChart({ values, current, label }: { values: number[]; current: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(200, useElementWidth(ref) || 320);
  const h = 70;
  const top = 14;
  const base = h - 14;
  const lo = 0.6;
  const hi = Math.max(1.4, ...values);
  const slot = width / 12;
  const bw = Math.min(18, slot - 3);
  const y = (v: number) => base - ((clamp(v, lo, hi) - lo) / (hi - lo)) * (base - top);
  const oneY = y(1);
  return (
    <div className="al-chart al-mp-season" ref={ref}>
      <svg width={width} height={h} role="img" aria-label={label}>
        <line x1={0} x2={width} y1={oneY} y2={oneY} className="al-grid" />
        {values.map((v, i) => {
          const x = i * slot + (slot - bw) / 2;
          const t = y(v);
          const ht = Math.max(2, base - t);
          const r = Math.min(3, bw / 2, ht);
          const cls = i === current ? 'al-mp-season-now' : v >= 1.05 ? 'al-mp-season-hi' : 'al-mp-season-lo';
          return (
            <g key={i}>
              <title>
                {i + 1}월 관광 손님 ×{v.toFixed(2)}
              </title>
              <path d={`M${x} ${base}V${base - ht + r}Q${x} ${base - ht} ${x + r} ${base - ht}H${x + bw - r}Q${x + bw} ${base - ht} ${x + bw} ${base - ht + r}V${base}Z`} className={cls} />
              {i === current && (
                <text x={x + bw / 2} y={base - ht - 3} textAnchor="middle" className="al-mp-season-val">
                  ×{v.toFixed(1)}
                </text>
              )}
              <text x={x + bw / 2} y={h - 2} textAnchor="middle" className={`al-tick${i === current ? ' al-tick-now' : ''}`}>
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ 얼마나 찼는지 (슬롯 등)

/** 짧은 가로 막대: 쓴 것 / 전부. 90% 넘으면 주의 색 */
export function UseBar({ used, total, label }: { used: number; total: number; label: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const width = Math.max(60, useElementWidth(ref) || 120);
  const v = total > 0 ? clamp(used / total, 0, 1) : 0;
  const w = v * (width - 2);
  const tone = v >= 0.95 ? 'bad' : v >= 0.8 ? 'warn' : 'good';
  return (
    <span className="al-mp-usebar" ref={ref}>
      <svg width={width} height={10} role="img" aria-label={label}>
        <rect x={1} y={1} width={width - 2} height={8} rx={4} className="al-hc-track" />
        {w > 0.5 && <rect x={1} y={1} width={w} height={8} rx={Math.min(4, w / 2)} className={`al-mp-use al-tone-${tone}`} />}
      </svg>
    </span>
  );
}

/** 목록 줄 안의 작은 막대 (0~1). 한 가지 색 */
export function MiniBar({ value, className = 'al-mp-mini-fill', label }: { value: number; className?: string; label?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const width = Math.max(30, useElementWidth(ref) || 80);
  const w = clamp(value, 0, 1) * width;
  return (
    <span className="al-mp-mini" ref={ref}>
      <svg width={width} height={8} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
        {w > 0.5 && <rect x={0} y={0} width={w} height={8} rx={Math.min(4, w / 2)} className={className} />}
      </svg>
    </span>
  );
}

// ------------------------------------------------------------------ 노선 몫 (회사 색으로 나눈 막대)

export interface SharePart {
  name: string;
  v: number;
  color: string;
}

/** 이 두 도시 손님을 회사마다 나눈 몫. 회사 색 조각 + 넓으면 안에 % */
export function ShareStack({ parts, label }: { parts: SharePart[]; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(200, useElementWidth(ref) || 360);
  const total = parts.reduce((s, p) => s + Math.max(0, p.v), 0);
  const bh = 22;
  let at = 0;
  const shown = parts.filter((p) => p.v > 0);
  return (
    <div className="al-chart al-mp-share" ref={ref}>
      <svg width={width} height={bh} role="img" aria-label={label}>
        {total <= 0 ? (
          <rect x={0} y={0} width={width} height={bh} rx={4} className="al-hc-track" />
        ) : (
          shown.map((p, i) => {
            const a = (at / total) * width + (i > 0 ? 1 : 0);
            at += p.v;
            const b = (at / total) * width - (i < shown.length - 1 ? 1 : 0);
            const w = Math.max(0, b - a);
            const share = `${Math.round((p.v / total) * 100)}%`;
            return (
              <g key={p.name}>
                <title>
                  {p.name} {share}
                </title>
                <rect x={a} y={0} width={w} height={bh} rx={Math.min(4, w / 2)} style={{ fill: p.color }} />
                {w > 38 && (
                  <text x={a + 7} y={bh / 2 + 4.5} className="al-mp-share-in">
                    {share}
                  </text>
                )}
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ 노선 머리 그림

/** 두 도시 점을 잇는 둥근 길과 그 위의 비행기 */
export function RouteArt() {
  return (
    <svg className="al-mp-route-art" width={46} height={46} viewBox="0 0 46 46" aria-hidden="true">
      <rect x={0.5} y={0.5} width={45} height={45} rx={12} className="al-mp-route-bg" />
      <path d="M10 33C14 17 28 11 36 13" className="al-mp-route-path" />
      <circle cx={10} cy={33} r={3.6} className="al-mp-route-dot" />
      <circle cx={36} cy={13} r={3.6} className="al-mp-route-dot" />
      <path d={MAP_PLANE_D} transform="translate(23 19) rotate(-28) scale(0.95)" className="al-mp-route-plane" />
    </svg>
  );
}
