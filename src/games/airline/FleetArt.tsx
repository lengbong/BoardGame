import { useRef, type ReactNode } from 'react';
import { useElementWidth } from '../../lib/useElementWidth';
import { MAP_PLANE_D } from './Art';
import { LINE as S } from './StaffArt';
import { monthOf, yearOfM } from './time';

/**
 * 🛩️ 비행기 화면 그림: 한 주 비행시간 막대(노선마다 조각), 기종 성능 막대, 주문 도착 달력, 작은 선 아이콘.
 * 글자는 글자 색, 색은 막대에만. 숫자는 늘 글자로 같이 쓴다.
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ------------------------------------------------------------------ 아이콘 (24×24 선 그림)

export type FleetIconKind = 'plane' | 'seat' | 'range' | 'speed' | 'runway' | 'fuel' | 'comfort' | 'calendar' | 'box' | 'key' | 'doc' | 'parked' | 'clock' | 'wrench' | 'stack' | 'age' | 'tag' | 'sun' | 'sunrise' | 'sunset' | 'moon';

const ICONS: Record<FleetIconKind, ReactNode> = {
  plane: <path d={MAP_PLANE_D} transform="translate(12 12) rotate(-30) scale(1.05)" fill="currentColor" />,
  seat: (
    <>
      <path d="M7.5 4.5h4a1.5 1.5 0 0 1 1.5 1.5v7.5H8.6a1.6 1.6 0 0 1-1.6-1.5z" {...S} />
      <path d="M6 13.5h10.5a1.5 1.5 0 0 1 1.5 1.5v1.5H7.5M8 16.5V20M16.5 16.5V20" {...S} />
    </>
  ),
  range: (
    <>
      <path d="M3.5 17c3-8 14-8 17 0" {...S} strokeDasharray="1.8 2.4" />
      <circle cx={3.8} cy={17} r={1.6} fill="currentColor" />
      <path d="M17.6 14.2l3 2.8-3.9 1" {...S} />
    </>
  ),
  speed: (
    <>
      <path d="M3.8 17a8.2 8.2 0 1 1 16.4 0" {...S} />
      <path d="M12 17l4.2-5.2M7 17h1M16 17h1M12 9.5v1" {...S} />
    </>
  ),
  runway: (
    <>
      <path d="M8.5 21L10 3h4l1.5 18z" {...S} />
      <path d="M12 6v2M12 11v2M12 16v2" {...S} />
    </>
  ),
  fuel: (
    <>
      <path d="M5 20V5.2C5 4.5 5.5 4 6.2 4h6.6c.7 0 1.2.5 1.2 1.2V20M3.5 20h12M7 8.5h5" {...S} />
      <path d="M14 10.5h1.8a1.7 1.7 0 0 1 1.7 1.7v4.3a1.5 1.5 0 0 0 3 0V9.2L18 6.8" {...S} />
    </>
  ),
  comfort: <path d="M12 3.6l2.6 5.2 5.8.9-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.9z" {...S} />,
  calendar: (
    <>
      <rect x={3.5} y={5} width={17} height={15} rx={2} {...S} />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" {...S} />
    </>
  ),
  box: (
    <>
      <path d="M3.5 7.5L12 3.5l8.5 4v9L12 20.5l-8.5-4z" {...S} />
      <path d="M3.5 7.5L12 11.5l8.5-4M12 11.5v9M7.8 5.5l8.4 4" {...S} />
    </>
  ),
  key: (
    <>
      <circle cx={8} cy={12} r={4} {...S} />
      <path d="M12 12h8.5M17.5 12v3M20.5 12v2.2" {...S} />
    </>
  ),
  doc: (
    <>
      <path d="M6.5 3.5h7.5l4 4v13h-11.5z" {...S} />
      <path d="M13.5 3.5v4.5H18M9.5 12.5h5.5M9.5 16h5.5" {...S} />
    </>
  ),
  parked: (
    <>
      <path d={MAP_PLANE_D} transform="translate(9.5 12) rotate(-90) scale(0.85)" fill="currentColor" />
      <path d="M17.5 8.5v7M21 8.5v7" {...S} strokeWidth={2.2} />
    </>
  ),
  clock: (
    <>
      <circle cx={12} cy={12} r={8.5} {...S} />
      <path d="M12 7v5l3.4 2.2" {...S} />
    </>
  ),
  wrench: <path d="M14.8 6.2a4.2 4.2 0 0 0-5.6 5.2l-5.6 5.6a1.7 1.7 0 0 0 2.4 2.4l5.6-5.6a4.2 4.2 0 0 0 5.2-5.6L14.3 10.7l-2.2-.4-.4-2.2z" {...S} />,
  stack: (
    <>
      <path d="M12 4l8.5 4-8.5 4-8.5-4z" {...S} />
      <path d="M3.5 12l8.5 4 8.5-4M3.5 16l8.5 4 8.5-4" {...S} />
    </>
  ),
  age: (
    <>
      <path d="M7 3.5h10M7 20.5h10M8 3.5c0 5 8 4.5 8 8.5s-8 3.5-8 8.5M16 3.5c0 5-8 4.5-8 8.5s8 3.5 8 8.5" {...S} />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.2V4h8.2l8.8 8.8-8.2 8.2z" {...S} />
      <circle cx={8} cy={8.5} r={1.4} {...S} />
    </>
  ),
  sunrise: (
    <>
      <path d="M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0M12 6.5V9M5 11l1.6 1.2M19 11l-1.6 1.2" {...S} />
    </>
  ),
  sun: (
    <>
      <circle cx={12} cy={12} r={4} {...S} />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6" {...S} />
    </>
  ),
  sunset: (
    <>
      <path d="M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0M12 9.5V7M9.8 8.4L12 10.6l2.2-2.2" {...S} />
    </>
  ),
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" {...S} />,
};

/** 시간대(아침·낮·저녁·밤) 아이콘 */
export const BAND_ICON: FleetIconKind[] = ['sunrise', 'sun', 'sunset', 'moon'];

export function FleetIcon({ kind, size = 18, className }: { kind: FleetIconKind; size?: number; className?: string }) {
  return (
    <svg className={`al-sicon${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[kind]}
    </svg>
  );
}

function IconAt({ kind, x, y, size }: { kind: FleetIconKind; x: number; y: number; size: number }) {
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 24 24" className="al-fl-rowicon" aria-hidden="true">
      {ICONS[kind]}
    </svg>
  );
}

// ------------------------------------------------------------------ 한 주 비행시간 막대

export type UseTone = 'good' | 'warn' | 'bad';

export function toneOfUse(use: number): UseTone {
  return use > 0.75 ? 'good' : use > 0.45 ? 'warn' : 'bad';
}

export interface HourPart {
  label: string;
  hours: number;
}

/**
 * 한 주 98시간 가운데 노선마다 쓰는 시간을 조각으로 쌓고(조각 사이 2px 틈), 남는 시간은 빈 바탕.
 * 막대 아래에 '주 14 / 98시간'을 쓴다 (남는 시간은 옆의 '다른 노선에 쓰기' 링크가 말해 줘요).
 */
export function HoursBar({ parts, max, tone }: { parts: HourPart[]; max: number; tone: UseTone }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(160, useElementWidth(ref) || 260);
  const used = parts.reduce((s, p) => s + p.hours, 0);
  const x = (h: number) => 1 + (clamp(h, 0, max) / max) * (width - 2);
  const bh = 12;
  const top = 2;
  let at = 0;
  const spare = Math.max(0, max - used);
  return (
    <div className="al-chart al-fl-hours" ref={ref}>
      <svg width={width} height={top + bh + 16} role="img" aria-label={`한 주 ${Math.round(used)}시간 / ${max}시간, 남는 ${Math.round(spare)}시간`}>
        <rect x={x(0)} y={top} width={width - 2} height={bh} rx={4} className="al-hc-track" />
        {parts.map((p, i) => {
          const a = x(at) + (i > 0 ? 1 : 0);
          at += p.hours;
          const b = x(at) - (i < parts.length - 1 ? 1 : 0);
          const w = Math.max(0, b - a);
          return (
            <rect key={i} x={a} y={top} width={w} height={bh} rx={Math.min(4, w / 2)} className={`al-fl-seg al-tone-${tone}${i % 2 ? ' al-fl-seg-alt' : ''}`}>
              <title>
                {p.label} · 주 {Math.round(p.hours)}시간
              </title>
            </rect>
          );
        })}
        <text x={x(0)} y={top + bh + 13} className="al-tick">
          주 {Math.round(used)} / {max}시간
        </text>
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ 기종 성능 막대

export interface SpecRow {
  icon: FleetIconKind;
  label: string;
  /** 0~1 막대 길이 */
  v: number;
  text: string;
  /** 연료처럼 좋고 나쁨을 색으로 */
  tone?: UseTone;
}

/** 기종 카드의 성능: 아이콘 · 이름 · 막대 · 값 (막대는 지금 살 수 있는 기종 가운데 가장 큰 값에 견준 길이) */
export function SpecBars({ rows }: { rows: SpecRow[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(180, useElementWidth(ref) || 220);
  const rowH = 20;
  const labelW = 84;
  const valueW = 64;
  const plotW = Math.max(30, width - labelW - valueW - 6);
  const bh = 7;
  return (
    <div className="al-chart al-fl-specs" ref={ref}>
      <svg width={width} height={rows.length * rowH} role="img" aria-label={rows.map((r) => `${r.label} ${r.text}`).join(', ')}>
        {rows.map((r, i) => {
          const y = i * rowH;
          const w = clamp(r.v, 0, 1) * plotW;
          return (
            <g key={r.label}>
              <IconAt kind={r.icon} x={0} y={y + 3} size={14} />
              <text x={19} y={y + 14} className="al-fl-spec-label">
                {r.label}
              </text>
              <rect x={labelW} y={y + (rowH - bh) / 2} width={plotW} height={bh} rx={3.5} className="al-hc-track" />
              {w > 0.5 && <rect x={labelW} y={y + (rowH - bh) / 2} width={w} height={bh} rx={Math.min(3.5, w / 2)} className={r.tone ? `al-fl-spec-bar al-tone-${r.tone}` : 'al-fl-spec-bar'} />}
              <text x={width - 1} y={y + 14} textAnchor="end" className="al-fl-spec-value">
                {r.text}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ 주문 도착 달력

/** 주문한 비행기가 언제 오는지 달 눈금 위에 비행기 점으로 */
export function ArrivalTimeline({ now, items }: { now: number; items: { due: number; label: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(220, useElementWidth(ref) || 360);
  if (items.length === 0) return null;
  const end = Math.max(now + 3, ...items.map((i) => i.due));
  const span = end - now;
  const m = { l: 18, r: 30 };
  const x = (t: number) => m.l + ((t - now) / span) * (width - m.l - m.r);
  const axisY = 30;
  const every = Math.ceil(span / Math.max(1, Math.floor((width - m.l - m.r) / 46)));
  const merged = new Map<number, string[]>();
  for (const it of items) merged.set(it.due, [...(merged.get(it.due) ?? []), it.label]);
  const pts = [...merged.entries()].sort((a, b) => a[0] - b[0]);
  let lastX = -Infinity;
  let lift = false;
  return (
    <div className="al-chart al-fl-arrivals" ref={ref}>
      <svg width={width} height={52} role="img" aria-label={`주문 도착: ${pts.map(([t, l]) => `${yearOfM(t)}년 ${monthOf(t)}월 ${l.join('·')}`).join(', ')}`}>
        <line x1={x(now)} x2={x(end)} y1={axisY} y2={axisY} className="al-fl-axis" />
        {Array.from({ length: span + 1 }, (_, i) => now + i).map((t, i) => {
          const show = i % every === 0 || merged.has(t);
          return (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={axisY - 3} y2={axisY + 3} className="al-fl-tick" />
              {show && (
                <text x={x(t)} y={axisY + 17} textAnchor="middle" className={`al-tick${i === 0 ? ' al-tick-now' : ''}`}>
                  {i === 0 ? '지금' : monthOf(t) === 1 ? `${String(yearOfM(t) % 100).padStart(2, '0')}년 1월` : `${monthOf(t)}월`}
                </text>
              )}
            </g>
          );
        })}
        <circle cx={x(now)} cy={axisY} r={4} className="al-fl-now" />
        {pts.map(([t, labels]) => {
          const px = x(t);
          lift = px - lastX < 70 ? !lift : false;
          lastX = px;
          const text = labels.length > 1 ? `${labels[0]} 외 ${labels.length - 1}` : labels[0];
          return (
            <g key={t}>
              <title>
                {yearOfM(t)}년 {monthOf(t)}월 도착: {labels.join(', ')}
              </title>
              <circle cx={px} cy={axisY} r={9} className="al-fl-dot" />
              <path d={MAP_PLANE_D} transform={`translate(${px} ${axisY}) scale(0.62)`} className="al-fl-dot-plane" />
              <text x={Math.min(px, width - 2)} y={lift ? 7 : 15} textAnchor={px > width - 40 ? 'end' : 'middle'} className="al-fl-label">
                {text}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
