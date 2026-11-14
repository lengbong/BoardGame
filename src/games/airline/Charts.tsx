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
}

/** 여러 회사의 값이 시간에 따라 어떻게 변했는지: 2px 선, 끝에 모양 표시와 이름, 마우스를 올리면 그 시점 값 */
export function LineChart({ series, labels, tickAt, format, axisFormat, height = 220, ariaLabel }: LineChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(300, useElementWidth(ref) || 600);
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const m = { l: 52, r: 128, t: 12, b: 26 };
  const w = width - m.l - m.r;
  const h = height - m.t - m.b;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const lo = Math.min(0, ...all);
  const hiRaw = Math.max(1, ...all);
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
