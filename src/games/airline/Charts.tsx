import { useRef, useState, type PointerEvent } from 'react';
import { shapeElement, type ShapeKind } from '../../components/shapes';
import { useElementWidth } from '../../lib/useElementWidth';

export interface Series {
  name: string;
  color: string;
  shape: ShapeKind;
  values: (number | null)[];
}

/** 깔끔한 눈금 간격 (1·2·2.5·5 × 10ⁿ) */
function niceStep(range: number, count: number): number {
  const raw = range / Math.max(1, count);
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}

/** 범례: 모양 + 이름 (색만으로 구별하지 않게) */
export function Legend({ series }: { series: Pick<Series, 'name' | 'color' | 'shape'>[] }) {
  return (
    <ul className="al-legend">
      {series.map((s) => (
        <li key={s.name}>
          <svg viewBox="0 0 20 20" width={12} height={12} aria-hidden="true">
            {shapeElement(s.shape, 10, 10, 9, s.color)}
          </svg>
          {s.name}
        </li>
      ))}
    </ul>
  );
}

interface LineChartProps {
  series: Series[];
  /** x마다 이름 (예: '83년 2분기') */
  labels: string[];
  /** x 눈금을 찍을 자리 */
  tickAt: (i: number) => string | null;
  format: (v: number) => string;
  axisFormat: (v: number) => string;
  height?: number;
  ariaLabel: string;
  /** false면 세로축을 0에서 시작하지 않고 값 범위에 맞춘다 (비율·지수) */
  zero?: boolean;
}

/** 여러 회사의 값이 시간에 따라 어떻게 변했는지: 2px 선, 끝에 모양 표시와 이름, 마우스를 올리면 그 시점 값 */
export function LineChart({ series, labels, tickAt, format, axisFormat, height = 220, ariaLabel, zero = true }: LineChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(300, useElementWidth(ref) || 600);
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const m = { l: 52, r: 128, t: 12, b: 26 };
  const w = width - m.l - m.r;
  const h = height - m.t - m.b;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const dataLo = all.length ? Math.min(...all) : 0;
  const dataHi = all.length ? Math.max(...all) : 1;
  const lo = zero ? Math.min(0, dataLo) : dataLo - (dataHi - dataLo || 1) * 0.1;
  const hiRaw = zero ? Math.max(1, dataHi) : dataHi + (dataHi - dataLo || 1) * 0.1;
  const step = niceStep(hiRaw - lo, 4);
  const yMin = Math.floor(lo / step) * step;
  const yMax = Math.ceil(hiRaw / step) * step;
  const x = (i: number) => m.l + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v: number) => m.t + h - ((v - yMin) / (yMax - yMin || 1)) * h;
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + step / 2; v += step) ticks.push(v);

  // 끝 이름표가 겹치지 않게 아래위로 민다
  const ends = (() => {
    const list = series
      .map((s, k) => {
        let i = s.values.length - 1;
        while (i >= 0 && s.values[i] === null) i--;
        return i < 0 ? null : { k, i, v: s.values[i] as number, ty: 0 };
      })
      .filter((e): e is { k: number; i: number; v: number; ty: number } => e !== null)
      .sort((a, b) => b.v - a.v);
    let last = -Infinity;
    for (const e of list) {
      e.ty = Math.max(y(e.v), last + 15);
      last = e.ty;
    }
    return list;
  })();

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(((px - m.l) / (w || 1)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const tip =
    hover !== null
      ? series
          .map((s) => ({ s, v: s.values[hover] }))
          .filter((x): x is { s: Series; v: number } => x.v !== null && x.v !== undefined)
          .sort((a, b) => b.v - a.v)
      : [];

  return (
    <div className="al-chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={m.l + w} y1={y(t)} y2={y(t)} className={t === 0 ? 'al-axis' : 'al-grid'} />
            <text x={m.l - 6} y={y(t) + 4} textAnchor="end" className="al-tick">
              {axisFormat(t)}
            </text>
          </g>
        ))}
        {labels.map((_, i) => {
          const t = tickAt(i);
          return t ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="al-tick">
              {t}
            </text>
          ) : null;
        })}
        {series.map((s) => {
          const d = s.values
            .map((v, i) => (v === null ? null : `${x(i).toFixed(1)} ${y(v).toFixed(1)}`))
            .reduce<string[]>((acc, p, i, arr) => {
              if (p === null) return acc;
              acc.push(`${i === 0 || arr[i - 1] === null ? 'M' : 'L'}${p}`);
              return acc;
            }, [])
            .join('');
          return <path key={s.name} d={d} stroke={s.color} className="al-line" />;
        })}
        {ends.map((e) => {
          const s = series[e.k];
          return (
            <g key={s.name}>
              <g className="al-end-mark">{shapeElement(s.shape, x(e.i), y(e.v), 6, s.color, { stroke: 'var(--surface)', strokeWidth: 2 })}</g>
              <text x={x(e.i) + 10} y={e.ty + 4} className="al-end-label">
                {s.name} <tspan className="al-end-value">{format(e.v)}</tspan>
              </text>
            </g>
          );
        })}
        {hover !== null && (
          <g className="al-cross" pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + h} />
            {tip.map(({ s, v }) => (
              <g key={s.name}>{shapeElement(s.shape, x(hover), y(v), 5, s.color, { stroke: 'var(--surface)', strokeWidth: 2 })}</g>
            ))}
          </g>
        )}
        <rect x={m.l} y={m.t} width={w} height={h} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hover !== null && tip.length > 0 && (
        <div className="al-tooltip" style={{ left: Math.min(width - 190, Math.max(0, x(hover) + 12)), top: m.t }}>
          <b>{labels[hover]}</b>
          <ul>
            {tip.map(({ s, v }) => (
              <li key={s.name}>
                <svg viewBox="0 0 20 20" width={10} height={10} aria-hidden="true">
                  {shapeElement(s.shape, 10, 10, 9, s.color)}
                </svg>
                <span>{s.name}</span>
                <b>{format(v)}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export interface ShareRow {
  label: string;
  total: number;
  parts: { name: string; color: string; shape: ShapeKind; value: number }[];
}

/** 지역마다 회사들이 나눈 몫: 100% 막대, 조각 사이 2px 틈, 마우스를 올리면 값 */
export function ShareBars({ rows, format }: { rows: ShareRow[]; format: (v: number) => string }) {
  const [hover, setHover] = useState<{ r: number; p: number } | null>(null);
  return (
    <ul className="al-share">
      {rows.map((row, ri) => {
        const parts = row.parts.filter((p) => p.value > 0);
        return (
          <li key={row.label}>
            <span className="al-share-label">{row.label}</span>
            <span className="al-share-bar">
              {row.total <= 0 ? (
                <span className="al-share-none">아직 아무도 날지 않아요</span>
              ) : (
                parts.map((p, pi) => (
                  <span
                    key={p.name}
                    className="al-share-seg"
                    style={{ width: `${(p.value / row.total) * 100}%`, background: p.color }}
                    onPointerEnter={() => setHover({ r: ri, p: pi })}
                    onPointerLeave={() => setHover(null)}
                    title={`${p.name}: ${format(p.value)} (${Math.round((p.value / row.total) * 100)}%)`}
                  >
                    {p.value / row.total >= 0.12 && (
                      <svg viewBox="0 0 20 20" width={10} height={10} aria-hidden="true">
                        {shapeElement(p.shape, 10, 10, 8, '#fff')}
                      </svg>
                    )}
                  </span>
                ))
              )}
              {hover && hover.r === ri && parts[hover.p] && (
                <span className="al-share-tip">
                  {parts[hover.p].name} {format(parts[hover.p].value)} · {Math.round((parts[hover.p].value / row.total) * 100)}%
                </span>
              )}
            </span>
            <span className="al-share-total">{row.total > 0 ? format(row.total) : ''}</span>
          </li>
        );
      })}
    </ul>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  /** 마우스를 올렸을 때 더 보여 줄 줄들 */
  detail?: string[];
}

/**
 * 달마다 이익: 0을 가운데 두고 흑자는 파랑, 적자는 주황 막대 (색만이 아니라 위·아래 방향과 값으로도 읽힌다).
 * 막대 끝은 4px 둥글게, 막대 사이 2px 틈, 마우스를 올리면 그 달 값.
 */
export function ProfitBars({ data, format, axisFormat, height = 200, ariaLabel, tickEvery = 3 }: { data: BarDatum[]; format: (v: number) => string; axisFormat: (v: number) => string; height?: number; ariaLabel: string; tickEvery?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(300, useElementWidth(ref) || 600);
  const [hover, setHover] = useState<number | null>(null);
  const m = { l: 52, r: 12, t: 12, b: 26 };
  const w = width - m.l - m.r;
  const h = height - m.t - m.b;
  const vals = data.map((d) => d.value);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0, ...vals, 1);
  const step = niceStep(hi - lo, 4);
  const yMin = Math.floor(lo / step) * step;
  const yMax = Math.ceil(hi / step) * step;
  const y = (v: number) => m.t + h - ((v - yMin) / (yMax - yMin || 1)) * h;
  const slot = w / Math.max(1, data.length);
  const bw = Math.max(2, Math.min(28, slot - 2));
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + step / 2; v += step) ticks.push(v);
  const bar = (v: number, x: number) => {
    const y0 = y(0);
    const y1 = y(v);
    const top = Math.min(y0, y1);
    const ht = Math.max(1, Math.abs(y1 - y0));
    const r = Math.min(4, bw / 2, ht);
    // 0에서 먼 쪽 끝만 둥글게
    if (v >= 0) return `M${x} ${top + ht}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + bw - r}Q${x + bw} ${top} ${x + bw} ${top + r}V${top + ht}Z`;
    return `M${x} ${top}V${top + ht - r}Q${x} ${top + ht} ${x + r} ${top + ht}H${x + bw - r}Q${x + bw} ${top + ht} ${x + bw} ${top + ht - r}V${top}Z`;
  };
  return (
    <div className="al-chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={m.l + w} y1={y(t)} y2={y(t)} className={t === 0 ? 'al-axis' : 'al-grid'} />
            <text x={m.l - 6} y={y(t) + 4} textAnchor="end" className="al-tick">
              {axisFormat(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = m.l + i * slot + (slot - bw) / 2;
          return (
            <g key={i}>
              <path d={bar(d.value, x)} className={d.value >= 0 ? 'al-bar-gain' : 'al-bar-loss'} opacity={hover === null || hover === i ? 1 : 0.55} />
              {i % tickEvery === 0 && (
                <text x={x + bw / 2} y={height - 8} textAnchor="middle" className="al-tick">
                  {d.label}
                </text>
              )}
              <rect x={m.l + i * slot} y={m.t} width={slot} height={h} fill="transparent" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div className="al-tooltip" style={{ left: Math.min(width - 190, Math.max(0, m.l + hover * slot + slot)), top: m.t }}>
          <b>{data[hover].label}</b>
          <ul>
            <li>
              <span>이익</span>
              <b>{format(data[hover].value)}</b>
            </li>
            {(data[hover].detail ?? []).map((line) => (
              <li key={line}>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** 작은 선 (최근 몇 달 흐름). 끝 점에 지금 값 */
export function Sparkline({ values, max = 1, width = 84, height = 22, label }: { values: number[]; max?: number; width?: number; height?: number; label: string }) {
  if (values.length === 0) return <span className="al-muted">—</span>;
  const n = values.length;
  const x = (i: number) => 2 + (n <= 1 ? (width - 4) / 2 : (i / (n - 1)) * (width - 6));
  const y = (v: number) => height - 3 - (Math.max(0, Math.min(max, v)) / (max || 1)) * (height - 6);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  return (
    <svg width={width} height={height} className="al-spark" role="img" aria-label={label}>
      <path d={d} className="al-spark-line" />
      <circle cx={x(n - 1)} cy={y(values[n - 1])} r={2.5} className="al-spark-dot" />
    </svg>
  );
}

/** 작은 막대 (최근 몇 달 이익): 흑자 파랑 위로, 적자 주황 아래로 */
export function SparkBars({ values, width = 84, height = 22, label }: { values: number[]; width?: number; height?: number; label: string }) {
  if (values.length === 0) return <span className="al-muted">—</span>;
  const n = values.length;
  const peak = Math.max(1e-6, ...values.map((v) => Math.abs(v)));
  const mid = height / 2;
  const slot = width / n;
  const bw = Math.max(1.5, slot - 2);
  return (
    <svg width={width} height={height} className="al-spark" role="img" aria-label={label}>
      <line x1={0} x2={width} y1={mid} y2={mid} className="al-axis" />
      {values.map((v, i) => {
        const ht = Math.max(1, (Math.abs(v) / peak) * (mid - 1));
        return <rect key={i} x={i * slot + (slot - bw) / 2} y={v >= 0 ? mid - ht : mid} width={bw} height={ht} rx={1} className={v >= 0 ? 'al-bar-gain' : 'al-bar-loss'} />;
      })}
    </svg>
  );
}

/** 열두 달 막대 (한 가지 색), 지금 달은 진하게 + 이름표 */
export function MonthBars({ values, current, format, height = 150, ariaLabel }: { values: number[]; current: number; format: (v: number) => string; height?: number; ariaLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(260, useElementWidth(ref) || 480);
  const [hover, setHover] = useState<number | null>(null);
  const m = { l: 8, r: 8, t: 18, b: 22 };
  const w = width - m.l - m.r;
  const h = height - m.t - m.b;
  const peak = Math.max(1e-6, ...values);
  const slot = w / 12;
  const bw = Math.min(30, slot - 2);
  return (
    <div className="al-chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        <line x1={m.l} x2={m.l + w} y1={m.t + h} y2={m.t + h} className="al-axis" />
        {values.map((v, i) => {
          const ht = Math.max(1, (v / peak) * h);
          const x = m.l + i * slot + (slot - bw) / 2;
          const top = m.t + h - ht;
          const r = Math.min(4, bw / 2, ht);
          return (
            <g key={i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <path d={`M${x} ${m.t + h}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + bw - r}Q${x + bw} ${top} ${x + bw} ${top + r}V${m.t + h}Z`} className={i === current ? 'al-bar-now' : 'al-bar-month'} />
              {(i === current || i === hover) && (
                <text x={x + bw / 2} y={top - 4} textAnchor="middle" className="al-end-value">
                  {format(v)}
                </text>
              )}
              <text x={x + bw / 2} y={height - 6} textAnchor="middle" className={`al-tick${i === current ? ' al-tick-now' : ''}`}>
                {i + 1}월
              </text>
              <rect x={m.l + i * slot} y={m.t} width={slot} height={h} fill="transparent" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
