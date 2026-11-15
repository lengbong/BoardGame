import { useRef, useState, type ReactNode } from 'react';
import { useElementWidth } from '../../lib/useElementWidth';
import { FinIcon } from './FinanceArt';
import { LINE as S, StaffIcon } from './StaffArt';
import type { NewsItem } from './types';

/**
 * 📈 보고서·📰 뉴스 그림: 날씨·까닭 아이콘, 줄마다 막대(한 칸 막대·나눠 쌓은 막대·0을 가운데 둔 막대),
 * 해마다 회사별 묶음 막대, 순위 메달, 지역 점, 뉴스 갈래 아이콘.
 * 글자는 늘 글자 색, 색은 막대·점에만. 색만으로 읽히지 않게 숫자·이름을 옆에 같이 쓴다.
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ------------------------------------------------------------------ 아이콘 (24×24 선 그림)

export type RIconKind = 'sun' | 'typhoon' | 'snow' | 'rain' | 'fog' | 'storm' | 'volcano' | 'divert' | 'globe' | 'transfer' | 'suitcase' | 'bars' | 'medal' | 'table';

const CLOUD = 'M7 15h10a3.8 3.8 0 0 0 .5-7.6A5.4 5.4 0 0 0 7 8.6 3.2 3.2 0 0 0 7 15z';

const R_ICONS: Record<RIconKind, ReactNode> = {
  sun: (
    <>
      <circle cx={12} cy={12} r={4} {...S} />
      <path d="M12 2.8v2.2M12 19v2.2M2.8 12H5M19 12h2.2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5L7 17M17 7l1.5-1.5" {...S} />
    </>
  ),
  typhoon: (
    <>
      <circle cx={12} cy={12} r={3} {...S} />
      <path d="M18.8 7A8 8 0 0 0 4.4 9.6M5.2 17A8 8 0 0 0 19.6 14.4" {...S} />
    </>
  ),
  snow: (
    <>
      <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" {...S} />
      <path d="M9.6 4.4L12 6.3l2.4-1.9M9.6 19.6L12 17.7l2.4 1.9" {...S} />
    </>
  ),
  rain: (
    <>
      <path d={CLOUD} {...S} />
      <path d="M8.5 18l-1 2.4M12.5 18l-1 2.4M16.5 18l-1 2.4" {...S} />
    </>
  ),
  fog: <path d="M4 7.5h16M6 11.5h14M4 15.5h13M7 19.5h10" {...S} />,
  storm: (
    <>
      <path d={CLOUD} {...S} />
      <path d="M12.6 15.5l-2.1 3.2h3l-2.1 3.3" {...S} />
    </>
  ),
  volcano: (
    <>
      <path d="M3 20.5l6-9h6l6 9z" {...S} />
      <path d="M10.5 8.5c-.4-2 .6-3.6 2-4.5M14 8c.2-1.6 1.2-2.8 2.6-3.2" {...S} />
    </>
  ),
  divert: (
    <>
      <path d="M6 20.5V12a5 5 0 0 1 5-5h7.5" {...S} />
      <path d="M15.5 4l3 3-3 3" {...S} />
    </>
  ),
  globe: (
    <>
      <circle cx={12} cy={12} r={8.5} {...S} />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.2 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.2-3.6-8.5s1.2-6.2 3.6-8.5z" {...S} />
    </>
  ),
  transfer: (
    <>
      <path d="M4 8.5h14.5M15.5 5.5l3 3-3 3" {...S} />
      <path d="M20 15.5H5.5M8.5 12.5l-3 3 3 3" {...S} />
    </>
  ),
  suitcase: (
    <>
      <rect x={3.5} y={8} width={17} height={12} rx={2} {...S} />
      <path d="M9 8V5.2h6V8M8.5 12v4.5M15.5 12v4.5" {...S} />
    </>
  ),
  bars: (
    <>
      <path d="M3.5 20.5h17" {...S} />
      <path d="M6.5 20.5v-6M10.5 20.5V9M14.5 20.5v-8M18.5 20.5V5.5" {...S} strokeWidth={2.6} />
    </>
  ),
  medal: (
    <>
      <circle cx={12} cy={14.5} r={5.5} {...S} />
      <path d="M8.2 3.5l2.4 5.6M15.8 3.5l-2.4 5.6M10.5 14.5l1.5-1.2v4" {...S} />
    </>
  ),
  table: (
    <>
      <rect x={3.5} y={4.5} width={17} height={15} rx={2} {...S} />
      <path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10" {...S} />
    </>
  ),
};

export function RIcon({ kind, size = 20, className }: { kind: RIconKind; size?: number; className?: string }) {
  return (
    <svg className={`al-sicon${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {R_ICONS[kind]}
    </svg>
  );
}

/** 지연·결항의 큰 까닭 (causeInfo의 열쇠) 아이콘 */
export function CauseIcon({ cause, size = 18 }: { cause: string; size?: number }) {
  switch (cause) {
    case 'typhoon':
      return <RIcon kind="typhoon" size={size} className="al-cause-icon al-cause-weather" />;
    case 'snow':
      return <RIcon kind="snow" size={size} className="al-cause-icon al-cause-weather" />;
    case 'monsoon':
      return <RIcon kind="rain" size={size} className="al-cause-icon al-cause-weather" />;
    case 'fog':
      return <RIcon kind="fog" size={size} className="al-cause-icon al-cause-weather" />;
    case 'storm':
      return <RIcon kind="storm" size={size} className="al-cause-icon al-cause-weather" />;
    case 'tech':
      return <FinIcon kind="wrench" size={size} className="al-cause-icon" />;
    case 'crew':
      return <FinIcon kind="people" size={size} className="al-cause-icon" />;
    case 'congestion':
      return <FinIcon kind="tower" size={size} className="al-cause-icon" />;
    case 'staff':
      return <StaffIcon kind="people" size={size} className="al-cause-icon al-cause-bad" />;
    case 'strike':
      return <StaffIcon kind="strike" size={size} className="al-cause-icon al-cause-bad" />;
    default:
      return <StaffIcon kind="clock" size={size} className="al-cause-icon" />;
  }
}

// ------------------------------------------------------------------ 줄 안의 막대

export type BarTone = 'good' | 'warn' | 'bad' | 'blue' | 'gain' | 'loss' | 'muted';

/** 한 칸 막대 (0~1). 칸 너비를 재서 그린다 */
export function BarCell({ frac, tone = 'blue', label, height = 10 }: { frac: number; tone?: BarTone; label: string; height?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const width = Math.max(30, useElementWidth(ref) || 80);
  const w = clamp(frac, 0, 1) * (width - 2);
  return (
    <span className="al-barcell" ref={ref}>
      <svg width={width} height={height + 2} role="img" aria-label={label}>
        <rect x={1} y={1} width={width - 2} height={height} rx={Math.min(5, height / 2)} className="al-bc-track" />
        {w > 0.5 && <rect x={1} y={1} width={w} height={height} rx={Math.min(4, w / 2, height / 2)} className={`al-bc-${tone}`} />}
      </svg>
    </span>
  );
}

/** 0을 가운데(음수가 있을 때) 또는 왼쪽에 둔 막대. 흑자는 파랑 오른쪽, 적자는 주황 왼쪽 */
export function DivergeCell({ value, max, hasNeg, label }: { value: number; max: number; hasNeg: boolean; label: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const width = Math.max(40, useElementWidth(ref) || 100);
  const h = 12;
  const zero = hasNeg ? width / 2 : 1;
  const span = hasNeg ? width / 2 - 1 : width - 2;
  const len = (Math.min(Math.abs(value), max) / Math.max(1e-9, max)) * span;
  const x = value >= 0 ? zero : zero - len;
  return (
    <span className="al-barcell" ref={ref}>
      <svg width={width} height={h + 2} role="img" aria-label={label}>
        {hasNeg && <line x1={zero} x2={zero} y1={0} y2={h + 2} className="al-axis" />}
        {len > 0.5 && <rect x={x} y={1} width={len} height={h} rx={Math.min(4, len / 2)} className={value >= 0 ? 'al-bc-gain' : 'al-bc-loss'} />}
      </svg>
    </span>
  );
}

export interface StackPart {
  name: string;
  v: number;
  tone: BarTone;
}

/** 나눠 쌓은 막대 (조각 사이 2px 틈). 조각 이름·값은 옆 범례와 마우스 글에 */
export function StackCell({ parts, total, label, height = 12 }: { parts: StackPart[]; total?: number; label: string; height?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const width = Math.max(40, useElementWidth(ref) || 120);
  const shown = parts.filter((p) => p.v > 0);
  const sum = Math.max(1e-9, total ?? shown.reduce((s, p) => s + p.v, 0));
  let at = 1;
  return (
    <span className="al-barcell" ref={ref}>
      <svg width={width} height={height + 2} role="img" aria-label={label}>
        <rect x={1} y={1} width={width - 2} height={height} rx={Math.min(5, height / 2)} className="al-bc-track" />
        {shown.map((p, i) => {
          const full = (p.v / sum) * (width - 2);
          const x = at + (i > 0 ? 1 : 0);
          const w = Math.max(0, full - (i > 0 ? 1 : 0) - (i < shown.length - 1 ? 1 : 0));
          at += full;
          return (
            <rect key={p.name} x={x} y={1} width={Math.max(w, 1)} height={height} rx={Math.min(3, w / 2, height / 2)} className={`al-bc-${p.tone}`}>
              <title>
                {p.name} {Math.round(p.v).toLocaleString('ko-KR')}
              </title>
            </rect>
          );
        })}
      </svg>
    </span>
  );
}

// ------------------------------------------------------------------ 해마다 회사별 묶음 막대

function niceStep(range: number, count: number): number {
  const raw = range / Math.max(1, count);
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}

export interface BarGroup {
  label: string;
  values: (number | null)[];
}

/**
 * 해마다 묶음 막대: 한 해에 회사마다 막대 하나 (회사 색), 흑자는 위·적자는 아래.
 * 막대 끝은 4px 둥글게, 막대 사이 2px 틈. 마우스를 올리면 그 해 그 회사 값.
 */
export function GroupedBars({ groups, colors, names, format, axisFormat, height = 210, ariaLabel }: { groups: BarGroup[]; colors: string[]; names: string[]; format: (v: number) => string; axisFormat: (v: number) => string; height?: number; ariaLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(260, useElementWidth(ref) || 520);
  const [hover, setHover] = useState<{ g: number; s: number } | null>(null);
  const m = { l: 56, r: 10, t: 14, b: 24 };
  const w = width - m.l - m.r;
  const h = height - m.t - m.b;
  const vals = groups.flatMap((g) => g.values.filter((v): v is number => v !== null));
  const lo = Math.min(0, ...vals);
  const hi = Math.max(1, ...vals);
  const step = niceStep(hi - lo, 4);
  const yLo = Math.floor(lo / step) * step;
  const yHi = Math.ceil(hi / step) * step;
  const y = (v: number) => m.t + h - ((v - yLo) / (yHi - yLo || 1)) * h;
  const ticks: number[] = [];
  for (let v = yLo; v <= yHi + 1e-9; v += step) ticks.push(v);
  const n = Math.max(1, names.length);
  const slot = w / Math.max(1, groups.length);
  const bw = Math.max(3, Math.min(24, (slot * 0.8 - (n - 1) * 2) / n));
  const groupW = n * bw + (n - 1) * 2;
  return (
    <div className="al-chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={m.l + w} y1={y(v)} y2={y(v)} className={v === 0 ? 'al-axis' : 'al-grid'} />
            <text x={m.l - 6} y={y(v) + 4} textAnchor="end" className="al-tick">
              {axisFormat(v)}
            </text>
          </g>
        ))}
        {groups.map((g, gi) => {
          const x0 = m.l + gi * slot + (slot - groupW) / 2;
          return (
            <g key={g.label}>
              {g.values.map((v, si) => {
                if (v === null) return null;
                const x = x0 + si * (bw + 2);
                const top = y(Math.max(0, v));
                const bot = y(Math.min(0, v));
                const bh = Math.max(1, bot - top);
                const r = Math.min(4, bw / 2, bh);
                // 0에 닿는 쪽은 네모, 값 쪽 끝만 둥글게
                const d =
                  v >= 0
                    ? `M${x} ${bot}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + bw - r}Q${x + bw} ${top} ${x + bw} ${top + r}V${bot}Z`
                    : `M${x} ${top}V${bot - r}Q${x} ${bot} ${x + r} ${bot}H${x + bw - r}Q${x + bw} ${bot} ${x + bw} ${bot - r}V${top}Z`;
                const on = hover && hover.g === gi && hover.s === si;
                return (
                  <path key={si} d={d} fill={colors[si]} opacity={hover && !on ? 0.55 : 1} onPointerEnter={() => setHover({ g: gi, s: si })} onPointerLeave={() => setHover(null)}>
                    <title>
                      {g.label} · {names[si]} {format(v)}
                    </title>
                  </path>
                );
              })}
              <text x={m.l + gi * slot + slot / 2} y={height - 6} textAnchor="middle" className="al-tick">
                {g.label}
              </text>
            </g>
          );
        })}
        {hover &&
          (() => {
            const v = groups[hover.g].values[hover.s];
            if (v === null || v === undefined) return null;
            const x = m.l + hover.g * slot + (slot - groupW) / 2 + hover.s * (bw + 2) + bw / 2;
            const ty = v >= 0 ? y(v) - 6 : y(v) + 14;
            return (
              <text x={clamp(x, m.l + 20, m.l + w - 20)} y={ty} textAnchor="middle" className="al-gb-hover">
                {format(v)}
              </text>
            );
          })()}
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ 순위 메달 · 지역 점

/** 1·2·3등은 금·은·동 메달, 그 밖은 회색 동그라미 */
export function RankMedal({ rank, out }: { rank: number; out?: boolean }) {
  const cls = out ? 'al-medal-out' : rank === 1 ? 'al-medal-1' : rank === 2 ? 'al-medal-2' : rank === 3 ? 'al-medal-3' : 'al-medal-n';
  return (
    <svg className={`al-medal ${cls}`} width={34} height={38} viewBox="0 0 34 38" role="img" aria-label={out ? '운항 중단' : `${rank}등`}>
      <path d="M9 1h6l3 9h-6zM25 1h-6l-3 9h6z" className="al-medal-ribbon" />
      <circle cx={17} cy={23} r={13} className="al-medal-disc" />
      <circle cx={17} cy={23} r={9.5} className="al-medal-ring" />
      <text x={17} y={27.5} textAnchor="middle" className="al-medal-num">
        {out ? '×' : rank}
      </text>
    </svg>
  );
}

/** 여섯 지역 중 몇 곳에 닿는지 점 여섯 개로 */
export function RegionDots({ n, total = 6 }: { n: number; total?: number }) {
  return (
    <svg className="al-rdots" width={total * 9} height={9} viewBox={`0 0 ${total * 9} 9`} role="img" aria-label={`지역 ${n}/${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <circle key={i} cx={4.5 + i * 9} cy={4.5} r={3.4} className={i < n ? 'al-rdot-on' : 'al-rdot-off'} />
      ))}
    </svg>
  );
}

// ------------------------------------------------------------------ 뉴스 갈래

export type NewsKind = 'weather' | 'company' | 'money' | 'plane' | 'travel' | 'world' | 'challenge' | 'other';

export const NEWS_KINDS: { id: NewsKind; name: string }[] = [
  { id: 'company', name: '회사 소식' },
  { id: 'weather', name: '날씨' },
  { id: 'money', name: '기름값·경제' },
  { id: 'plane', name: '비행기·공항' },
  { id: 'travel', name: '여행·행사' },
  { id: 'world', name: '세계 소식' },
  { id: 'challenge', name: '도전 과제' },
  { id: 'other', name: '그 밖의 소식' },
];

const WEATHER_E = new Set(['🌀', '❄️', '🌧️', '🌫️', '⛈️', '🌋']);
const COMPANY_E = new Set(['🤝', '✂️', '⚔️', '📍', '🏷️', '🪧', '🛑', '🔧', '📦']);
const MONEY_E = new Set(['⛽', '🛢️', '📈', '📉', '🏦', '💹', '💸', '💰']);
const PLANE_E = new Set(['🆕', '🔚', '🛩️', '🛫', '🏗️', '✈️']);
const TRAVEL_E = new Set(['🏅', '🎡', '⛷️', '🎒', '🧳', '🗽', '🏝️', '🎪', '🌅', '🌇', '🎬']);
const WORLD_E = new Set(['🕊️', '🚫', '🧱', '😷', '🦠', '💉', '⚔️']);

/** 소식 갈래: 도전 과제 → 날씨 → 회사(특정 회사 소식) → 아이콘으로 */
export function newsKind(n: NewsItem): NewsKind {
  if (n.title.startsWith('도전')) return 'challenge';
  if (WEATHER_E.has(n.icon)) return 'weather';
  if (n.company !== undefined || (n.for && n.for.length > 0) || (COMPANY_E.has(n.icon) && !WORLD_E.has(n.icon))) return 'company';
  if (MONEY_E.has(n.icon)) return 'money';
  if (PLANE_E.has(n.icon)) return 'plane';
  // 🏢는 박람회(좋은 소식)일 때만 여행·행사, 나쁜 소식이면 세계 소식
  if (n.icon === '🏢') return n.tone === 'good' ? 'travel' : 'world';
  if (TRAVEL_E.has(n.icon)) return 'travel';
  if (WORLD_E.has(n.icon)) return 'world';
  return 'other';
}

/** 갈래 아이콘 (색 네모 안) */
export function NewsKindIcon({ kind, size = 34 }: { kind: NewsKind; size?: number }) {
  const inner = Math.round(size * 0.58);
  const icon =
    kind === 'weather' ? (
      <RIcon kind="storm" size={inner} />
    ) : kind === 'company' ? (
      <FinIcon kind="building" size={inner} />
    ) : kind === 'money' ? (
      <FinIcon kind="chart" size={inner} />
    ) : kind === 'plane' ? (
      <FinIcon kind="plane" size={inner} />
    ) : kind === 'travel' ? (
      <RIcon kind="suitcase" size={inner} />
    ) : kind === 'world' ? (
      <RIcon kind="globe" size={inner} />
    ) : kind === 'challenge' ? (
      <FinIcon kind="trophy" size={inner} />
    ) : (
      <StaffIcon kind="info" size={inner} />
    );
  return (
    <span className={`al-nk al-nk-${kind}`} style={{ width: size, height: size }} aria-hidden="true">
      {icon}
    </span>
  );
}

/** 소식 분위기 표시: 좋은 소식 ▲ / 나쁜 소식 ▼ / 큰 소식 ★ (색 + 모양 + 글) */
export function ToneBadge({ tone }: { tone: NewsItem['tone'] }) {
  if (tone === 'info') return null;
  const text = tone === 'good' ? '좋은 소식' : tone === 'bad' ? '나쁜 소식' : '큰 소식';
  return (
    <span className={`al-tone-badge al-tb-${tone}`}>
      <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden="true">
        {tone === 'good' ? <path d="M5 1.5L9 8.5H1z" /> : tone === 'bad' ? <path d="M5 8.5L9 1.5H1z" /> : <path d="M5 .8l1.2 2.7 2.9.3-2.2 2 .7 2.9L5 7.2 2.4 8.7l.7-2.9-2.2-2 2.9-.3z" />}
      </svg>
      {text}
    </span>
  );
}
