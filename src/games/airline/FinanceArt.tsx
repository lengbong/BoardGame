import { useId, useRef, type ReactNode } from 'react';
import { useElementWidth } from '../../lib/useElementWidth';
import { MAP_PLANE_D } from './Art';
import { fmtMoney } from './format';
import { LINE as S } from './StaffArt';

/**
 * 💰 재무 화면 그림: 손익 막대(들어온 돈·나간 돈), 비용 순위 막대, 회사 가치 구성 막대, 대출 한도 막대,
 * 목표 진행 고리, 목표값이 있는 막대(평판), 제휴 가능성 막대, 작은 선 아이콘.
 * 글자는 늘 글자 색, 색은 막대에만. 색이 연한 조각은 옆에 이름과 값을 같이 쓴다.
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ------------------------------------------------------------------ 아이콘 (24×24 선 그림)

export type FinIconKind =
  | 'ticket'
  | 'shop'
  | 'fuel'
  | 'people'
  | 'wrench'
  | 'tower'
  | 'meal'
  | 'tag'
  | 'doc'
  | 'parked'
  | 'building'
  | 'megaphone'
  | 'bank'
  | 'delay'
  | 'receipt'
  | 'rings'
  | 'target'
  | 'hourglass'
  | 'shield'
  | 'trophy'
  | 'star'
  | 'wallet'
  | 'chart'
  | 'down'
  | 'plane'
  | 'coin';

const PLANE = <path d={MAP_PLANE_D} transform="translate(12 12) rotate(-30) scale(1.05)" fill="currentColor" />;

const FIN_ICONS: Record<FinIconKind, ReactNode> = {
  ticket: (
    <>
      <path d="M3.5 6.5h17v3.6a2 2 0 0 0 0 3.8v3.6h-17v-3.6a2 2 0 0 0 0-3.8z" {...S} />
      <path d="M15 7v10" {...S} strokeDasharray="1.6 2.2" />
    </>
  ),
  shop: (
    <>
      <path d="M5 8.5h14l-1.2 11.5H6.2z" {...S} />
      <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" {...S} />
    </>
  ),
  fuel: (
    <>
      <path d="M5 20V5.2C5 4.5 5.5 4 6.2 4h6.6c.7 0 1.2.5 1.2 1.2V20M3.5 20h12M7 8.5h5" {...S} />
      <path d="M14 10.5h1.8a1.7 1.7 0 0 1 1.7 1.7v4.3a1.5 1.5 0 0 0 3 0V9.2L18 6.8" {...S} />
    </>
  ),
  people: (
    <>
      <circle cx={9} cy={8} r={3.2} {...S} />
      <path d="M3 20c0-3.8 2.7-6.4 6-6.4s6 2.6 6 6.4" {...S} />
      <circle cx={16.5} cy={9} r={2.6} {...S} />
      <path d="M15.6 14c3.2-.4 5.6 1.9 5.6 5.4" {...S} />
    </>
  ),
  wrench: <path d="M14.8 6.2a4.2 4.2 0 0 0-5.6 5.2l-5.6 5.6a1.7 1.7 0 0 0 2.4 2.4l5.6-5.6a4.2 4.2 0 0 0 5.2-5.6L14.3 10.7l-2.2-.4-.4-2.2z" {...S} />,
  tower: (
    <>
      <path d="M9 21l1-9.5h4l1 9.5M6.5 21h11" {...S} />
      <path d="M7.5 11.5h9L15 7H9zM12 7V3.5" {...S} />
    </>
  ),
  meal: (
    <>
      <path d="M3.5 17.5h17M5.5 17.5a6.5 6.5 0 0 1 13 0" {...S} />
      <path d="M12 11V9.4M10.4 9h3.2" {...S} />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.2V4h8.2l8.8 8.8-8.2 8.2z" {...S} />
      <circle cx={8} cy={8.5} r={1.4} {...S} />
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
  building: (
    <>
      <path d="M4 20.5V8.5l8-4 8 4v12M3 20.5h18" {...S} />
      <path d="M9.5 20.5v-5h5v5M8 11.5h2M14 11.5h2" {...S} />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10v4h3l7.5 4.5v-13L7 10z" {...S} />
      <path d="M17.5 9.3a3.6 3.6 0 0 1 0 5.4M7 14l1.6 5.5h2.6l-1-5" {...S} />
    </>
  ),
  bank: (
    <>
      <path d="M3 9.5h18L12 4z" {...S} />
      <path d="M5.5 9.5v8M10 9.5v8M14 9.5v8M18.5 9.5v8M3 20h18" {...S} />
    </>
  ),
  delay: (
    <>
      <circle cx={11} cy={12.5} r={7.5} {...S} />
      <path d="M11 8.5v4.2l2.6 1.6M20.5 4.5v4.5M20.5 12v.2" {...S} />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12V21l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z" {...S} />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" {...S} />
    </>
  ),
  rings: (
    <>
      <circle cx={8.8} cy={12} r={5.3} {...S} />
      <circle cx={15.2} cy={12} r={5.3} {...S} />
    </>
  ),
  target: (
    <>
      <circle cx={12} cy={12} r={8.5} {...S} />
      <circle cx={12} cy={12} r={5} {...S} />
      <circle cx={12} cy={12} r={1.4} fill="currentColor" />
    </>
  ),
  hourglass: <path d="M7 3.5h10M7 20.5h10M8 3.5c0 5 8 4.5 8 8.5s-8 3.5-8 8.5M16 3.5c0 5-8 4.5-8 8.5s8 3.5 8 8.5" {...S} />,
  shield: (
    <>
      <path d="M12 3.2l7 2.8v5.2c0 4.8-3.3 8.2-7 9.8-3.7-1.6-7-5-7-9.8V6z" {...S} />
      <path d="M8.8 12l2.2 2.2 4.2-4.4" {...S} />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 5.8H5.2a3 3 0 0 0 3 4.4M16 5.8h2.8a3 3 0 0 1-3 4.4M12 13v3.5M8.5 20.5h7M10 16.5h4v4h-4z" {...S} />
    </>
  ),
  star: <path d="M12 3.6l2.6 5.2 5.8.9-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.9z" {...S} />,
  wallet: (
    <>
      <path d="M4 7.5h15.5a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.2A2.2 2.2 0 0 1 6.2 4H17v3.5" {...S} />
      <path d="M16 13.8h1.6" {...S} strokeWidth={2.4} />
    </>
  ),
  chart: (
    <>
      <path d="M4 19.5h16" {...S} />
      <path d="M5.5 15.5l4-4 3 3 6-6.5M15 8h3.5v3.5" {...S} />
    </>
  ),
  down: (
    <>
      <path d="M4 19.5h16" {...S} />
      <path d="M5.5 7.5l4 4 3-3 6 6.5M15 15.5h3.5V12" {...S} />
    </>
  ),
  plane: PLANE,
  coin: (
    <>
      <ellipse cx={12} cy={7} rx={7} ry={3} {...S} />
      <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" {...S} />
    </>
  ),
};

export function FinIcon({ kind, size = 20, className }: { kind: FinIconKind; size?: number; className?: string }) {
  return (
    <svg className={`al-sicon${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {FIN_ICONS[kind]}
    </svg>
  );
}

/** svg 안에 아이콘 하나 (x, y 왼쪽 위) */
function IconAt({ kind, x, y, size }: { kind: FinIconKind; x: number; y: number; size: number }) {
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 24 24" className="al-fin-rowicon" aria-hidden="true">
      {FIN_ICONS[kind]}
    </svg>
  );
}

// ------------------------------------------------------------------ 손익: 들어온 돈 vs 나간 돈

export interface MoneyPart {
  name: string;
  v: number;
}

/**
 * 두 줄 막대: 위는 들어온 돈(운임·부대사업), 아래는 나간 돈.
 * 들어온 돈이 더 크면 그 차이(이익)를 나간 돈 막대 뒤에 연한 초록으로, 더 작으면 넘친 만큼(손해)을 빨간 빗금으로.
 */
export function MoneyFlow({ income, cost }: { income: MoneyPart[]; cost: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(260, useElementWidth(ref) || 420);
  const id = useId();
  const inTotal = income.reduce((s, p) => s + Math.max(0, p.v), 0);
  const max = Math.max(1, inTotal, cost);
  const labelW = 64;
  const valueW = 76;
  const plotW = width - labelW - valueW - 6;
  const x = (v: number) => labelW + (clamp(v, 0, max) / max) * plotW;
  const bh = 22;
  const y1 = 4;
  const y2 = y1 + bh + 12;
  const profit = inTotal - cost;
  let at = 0;
  const segs = income
    .filter((p) => p.v > 0)
    .map((p, i, arr) => {
      const a = x(at) + (i > 0 ? 1 : 0);
      at += p.v;
      const b = x(at) - (i < arr.length - 1 ? 1 : 0);
      return { ...p, a, w: Math.max(0, b - a), i };
    });
  const gapA = x(Math.min(inTotal, cost));
  const gapB = x(Math.max(inTotal, cost));
  const gapLabel = `${profit >= 0 ? '이익' : '손해'} ${fmtMoney(Math.abs(profit))}`;
  const gapFits = gapB - gapA > gapLabel.length * 7.2 + 12;
  return (
    <div className="al-chart al-flow" ref={ref}>
      <svg width={width} height={y2 + bh + 6} role="img" aria-label={`들어온 돈 ${fmtMoney(inTotal)}, 나간 돈 ${fmtMoney(cost)}, ${gapLabel}`}>
        <defs>
          <pattern id={`${id}-loss`} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={6} height={6} className="al-flow-loss-bg" />
            <line x1={1.5} y1={0} x2={1.5} y2={6} className="al-flow-loss-line" />
          </pattern>
        </defs>
        <text x={labelW - 8} y={y1 + bh / 2 + 4} textAnchor="end" className="al-wf-label">
          들어온 돈
        </text>
        {segs.map((s) => (
          <rect key={s.name} x={s.a} y={y1} width={s.w} height={bh} rx={Math.min(4, s.w / 2)} className={`al-flow-in al-flow-in-${s.i}`}>
            <title>
              {s.name} {fmtMoney(s.v)}
            </title>
          </rect>
        ))}
        <text x={width - 2} y={y1 + bh / 2 + 4} textAnchor="end" className="al-wf-value al-flow-num">
          +{fmtMoney(inTotal)}
        </text>

        <text x={labelW - 8} y={y2 + bh / 2 + 4} textAnchor="end" className="al-wf-label">
          나간 돈
        </text>
        {profit > 0 && (
          <rect x={gapA} y={y2} width={gapB - gapA} height={bh} rx={4} className="al-flow-profit">
            <title>{gapLabel}</title>
          </rect>
        )}
        <rect x={x(0)} y={y2} width={Math.max(0, x(Math.min(cost, inTotal)) - x(0) - (profit < 0 ? 1 : 0))} height={bh} rx={4} className="al-flow-cost">
          <title>나간 돈 {fmtMoney(cost)}</title>
        </rect>
        {profit < 0 && (
          <rect x={gapA + 1} y={y2} width={Math.max(0, gapB - gapA - 1)} height={bh} rx={4} fill={`url(#${id}-loss)`}>
            <title>{gapLabel}</title>
          </rect>
        )}
        {gapFits && Math.abs(profit) > 0 && (
          <text x={(gapA + gapB) / 2} y={y2 + bh / 2 + 4} textAnchor="middle" className={`al-flow-gap-label ${profit >= 0 ? 'al-pos' : 'al-neg'}`}>
            {gapLabel}
          </text>
        )}
        <text x={width - 2} y={y2 + bh / 2 + 4} textAnchor="end" className="al-wf-value al-flow-num">
          −{fmtMoney(cost)}
        </text>
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ 비용 순위 막대

export interface CostRow {
  key: string;
  name: string;
  icon: FinIconKind;
  /** 막대 길이 (지난달, 없으면 이번 달 어림) */
  v: number;
  /** 이번 달 어림 (눈금으로) */
  est?: number;
  /** 지난달 값이 없을 때 true (이번 달 어림만) */
  estOnly?: boolean;
}

/** 나간 돈 항목: 큰 것부터, 한 가지 색 막대 + 아이콘 + 값. 이번 달 어림은 막대 위 눈금 */
export function CostBars({ rows }: { rows: CostRow[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(240, useElementWidth(ref) || 420);
  // 좁으면 이름을 막대 위 줄에 쓴다 (이름이 막대와 겹치지 않게)
  const stacked = width < 440;
  const rowH = stacked ? 36 : 24;
  const barH = stacked ? 10 : 12;
  const labelW = stacked ? 24 : Math.min(172, Math.max(140, width * 0.36));
  const valueW = stacked ? 8 : 64;
  const plotW = width - labelW - valueW - 6;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.v, r.est ?? 0)));
  const x = (v: number) => labelW + (clamp(v, 0, max) / max) * plotW;
  const textY = (y: number) => (stacked ? y + 13 : y + rowH / 2 + 4);
  return (
    <div className="al-chart al-costbars" ref={ref}>
      <svg width={width} height={rows.length * rowH + 2} role="img" aria-label={`나간 돈 항목: ${rows.map((r) => `${r.name} ${fmtMoney(r.v)}`).join(', ')}`}>
        {rows.map((r, i) => {
          const y = i * rowH;
          const by = stacked ? y + 19 : y + (rowH - barH) / 2;
          const w = Math.max(r.v > 0 ? 2 : 0, x(r.v) - x(0));
          return (
            <g key={r.key}>
              <title>
                {r.name}
                {r.estOnly ? ` · 이번 달 어림 −${fmtMoney(r.v)}` : ` · 지난달 −${fmtMoney(r.v)}${r.est !== undefined ? ` · 이번 달 어림 −${fmtMoney(r.est)}` : ''}`}
              </title>
              <rect x={0} y={y} width={width} height={rowH} fill="transparent" />
              <IconAt kind={r.icon} x={0} y={stacked ? y + 1 : y + 3} size={18} />
              <text x={24} y={textY(y)} className="al-cost-name">
                {r.name}
              </text>
              {w > 0 && <rect x={x(0)} y={by} width={w} height={barH} rx={Math.min(4, w / 2)} className="al-cost-bar" />}
              {r.est !== undefined && !r.estOnly && <line x1={x(r.est)} x2={x(r.est)} y1={by - 3} y2={by + barH + 3} className="al-cost-est" />}
              <text x={width - 2} y={textY(y)} textAnchor="end" className="al-wf-value">
                −{fmtMoney(r.v)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ 회사 가치 구성

export interface AssetPart {
  name: string;
  v: number;
  /** 정해진 색 자리 (1~5) */
  slot: number;
  /** 이름 옆에 붙일 작은 글 (예: 6대) */
  note?: string;
}

/** 진한 바탕이라 흰 글씨가 읽히는 색 자리 */
const WHITE_INK = new Set([1, 2]);

/**
 * 회사 가치 = 가진 것 − 빚. 위는 가진 것을 한 막대로 나눠 쌓고(넓은 조각 안에는 몫 %), 빚이 있으면 같은 눈금으로 아래에 빨간 막대.
 * 이름과 값은 아래 범례에 늘 쓴다.
 */
export function AssetBar({ parts, debt }: { parts: AssetPart[]; debt: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(240, useElementWidth(ref) || 420);
  const shown = parts.filter((p) => p.v > 0);
  const total = shown.reduce((s, p) => s + p.v, 0);
  const max = Math.max(1, total, debt);
  const x = (v: number) => (clamp(v, 0, max) / max) * width;
  const bh = 28;
  const debtY = bh + 8;
  let at = 0;
  return (
    <div className="al-chart al-assets" ref={ref}>
      <svg width={width} height={debt > 0 ? debtY + 14 : bh} role="img" aria-label={`가진 것: ${shown.map((p) => `${p.name} ${fmtMoney(p.v)}`).join(', ')}${debt > 0 ? `, 빚 ${fmtMoney(debt)}` : ''}`}>
        {shown.map((p, i) => {
          const a = x(at) + (i > 0 ? 1 : 0);
          at += p.v;
          const b = x(at) - (i < shown.length - 1 ? 1 : 0);
          const w = Math.max(0, b - a);
          const share = `${Math.round((p.v / Math.max(1, total)) * 100)}%`;
          return (
            <g key={p.name}>
              <title>
                {p.name} {fmtMoney(p.v)} ({share})
              </title>
              <rect x={a} y={0} width={w} height={bh} rx={Math.min(4, w / 2)} className={`al-cat-${p.slot}`} />
              {w > 40 && (
                <text x={a + 8} y={bh / 2 + 4.5} className={`al-asset-in ${WHITE_INK.has(p.slot) ? 'al-ink-white' : 'al-ink-dark'}`}>
                  {share}
                </text>
              )}
            </g>
          );
        })}
        {debt > 0 && (
          <rect x={0} y={debtY} width={Math.max(2, x(debt))} height={14} rx={4} className="al-asset-debt">
            <title>빚 {fmtMoney(debt)}</title>
          </rect>
        )}
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ 대출 한도

/** 빌린 돈 / 한도. 한도의 80%를 넘으면 금리가 오르는 구역을 연한 빨강으로, 80% 자리에 눈금 */
export function LoanMeter({ debt, limit }: { debt: number; limit: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(220, useElementWidth(ref) || 380);
  const max = Math.max(1, limit, debt);
  const x = (v: number) => 1 + (clamp(v, 0, max) / max) * (width - 2);
  const top = 18;
  const bh = 16;
  const over = debt > limit * 0.8;
  const t80 = x(limit * 0.8);
  const w = x(debt) - x(0);
  return (
    <div className="al-chart al-loan" ref={ref}>
      <svg width={width} height={top + bh + 18} role="img" aria-label={`빌린 돈 ${fmtMoney(debt)} / 한도 ${fmtMoney(limit)}`}>
        <rect x={x(0)} y={top} width={width - 2} height={bh} rx={5} className="al-hc-track" />
        {limit > 0 && <rect x={t80} y={top} width={Math.max(0, x(limit) - t80)} height={bh} rx={4} className="al-loan-hot" />}
        {w > 0.5 && <rect x={x(0)} y={top} width={w} height={bh} rx={Math.min(5, w / 2)} className={over ? 'al-loan-fill al-loan-over' : 'al-loan-fill'} />}
        {limit > 0 && (
          <>
            <line x1={t80} x2={t80} y1={top - 4} y2={top + bh + 3} className="al-hc-need" />
            <text x={t80} y={top - 7} textAnchor={t80 > width - 90 ? 'end' : 'middle'} className="al-hc-need-label">
              80% 넘으면 금리 +2%p
            </text>
          </>
        )}
        <text x={x(0)} y={top + bh + 15} className="al-tick">
          빌린 돈 {fmtMoney(debt)}
        </text>
        <text x={width - 1} y={top + bh + 15} textAnchor="end" className="al-tick">
          한도 {fmtMoney(limit)}
        </text>
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ 진행 고리

export type RingTone = 'good' | 'blue' | 'bad' | 'warn';

/** 동그란 진행 고리. 가운데에 % 또는 ✓/✗ */
export function ProgressRing({ value, tone = 'blue', size = 40, mark, label }: { value: number; tone?: RingTone; size?: number; mark?: 'done' | 'fail'; label: string }) {
  const v = clamp(value, 0, 1);
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <svg className="al-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      <circle cx={size / 2} cy={size / 2} r={r} className="al-ring-track" strokeWidth={5} />
      {v > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={`al-ring-fill al-ring-${tone}`}
          strokeWidth={5}
          strokeDasharray={`${(c * v).toFixed(2)} ${c.toFixed(2)}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      {mark === 'done' ? (
        <path d={`M${size * 0.32} ${size * 0.52}l${size * 0.12} ${size * 0.12} ${size * 0.24}-${size * 0.26}`} className="al-ring-mark al-ring-good" />
      ) : mark === 'fail' ? (
        <path d={`M${size * 0.36} ${size * 0.36}l${size * 0.28} ${size * 0.28}M${size * 0.64} ${size * 0.36}l-${size * 0.28} ${size * 0.28}`} className="al-ring-mark al-ring-bad" />
      ) : (
        <text x={size / 2} y={size / 2 + 4} textAnchor="middle" className="al-ring-text">
          {Math.round(v * 100)}%
        </text>
      )}
    </svg>
  );
}

// ------------------------------------------------------------------ 목표값이 있는 막대 (평판 등)

/** 0~max 막대: 채운 곳이 지금 값, 삼각형이 향하는 값 */
export function TargetBar({ value, target, max = 100, label }: { value: number; target: number; max?: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(200, useElementWidth(ref) || 360);
  const x = (v: number) => 1 + (clamp(v, 0, max) / max) * (width - 2);
  const top = 12;
  const bh = 14;
  const w = x(value) - x(0);
  const tx = x(target);
  return (
    <div className="al-chart al-targetbar" ref={ref}>
      <svg width={width} height={top + bh + 16} role="img" aria-label={label}>
        <rect x={x(0)} y={top} width={width - 2} height={bh} rx={5} className="al-hc-track" />
        {w > 0.5 && <rect x={x(0)} y={top} width={w} height={bh} rx={Math.min(5, w / 2)} className="al-tb-fill" />}
        <path d={`M${tx} ${top - 1}l-5 -8h10z`} className="al-gauge-target">
          <title>향하는 곳 {Math.round(target)}</title>
        </path>
        <text x={x(0)} y={top + bh + 13} className="al-tick">
          0
        </text>
        <text x={width - 1} y={top + bh + 13} textAnchor="end" className="al-tick">
          {max}
        </text>
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ 제휴 가능성

/** 신호 막대 세 칸: 받아들일 것 같으면 3칸, 반반이면 2칸, 거절할 것 같으면 1칸 */
export function OutlookBars({ level }: { level: 0 | 1 | 2 | 3 }) {
  const tone = level >= 3 ? 'good' : level === 2 ? 'warn' : 'bad';
  return (
    <svg className="al-outlook-bars" width={20} height={16} viewBox="0 0 20 16" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <rect key={i} x={i * 7} y={10 - i * 5} width={5} height={6 + i * 5} rx={1.5} className={i < level ? `al-ob-on al-tone-${tone}` : 'al-ob-off'} />
      ))}
    </svg>
  );
}

/** 두 회사 꼬리 배지 사이를 잇는 고리 */
export function AllianceLink({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="al-alliance-link">
      <span className="al-al-side">{left}</span>
      <svg width={60} height={24} viewBox="0 0 60 24" aria-hidden="true" className="al-al-rings">
        <path d="M2 12h14M44 12h14" className="al-al-line" />
        <circle cx={25} cy={12} r={8} className="al-al-ring" />
        <circle cx={35} cy={12} r={8} className="al-al-ring" />
      </svg>
      <span className="al-al-side">{right}</span>
    </div>
  );
}

// ------------------------------------------------------------------ 정비 수준 렌치 칸

/** 정비 수준 1~5를 렌치 다섯 칸으로 */
export function WrenchPips({ level }: { level: number }) {
  return (
    <svg className="al-pips" width={70} height={14} viewBox="0 0 60 12" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(${i * 12} 0) scale(0.5)`} className={i < level ? 'al-pip-on' : 'al-pip-off'}>
          <path d="M14.8 6.2a4.2 4.2 0 0 0-5.6 5.2l-5.6 5.6a1.7 1.7 0 0 0 2.4 2.4l5.6-5.6a4.2 4.2 0 0 0 5.2-5.6L14.3 10.7l-2.2-.4-.4-2.2z" />
        </g>
      ))}
    </svg>
  );
}
