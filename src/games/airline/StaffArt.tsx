import { useId, useRef, useState, type ReactNode } from 'react';
import { useElementWidth } from '../../lib/useElementWidth';
import { MAP_PLANE_D } from './Art';
import { monthOf, yearOfM } from './time';
import type { StaffGroup } from './types';

/**
 * 👥 인사 화면 그림: 직군 그림, 조직 만족도 계기판·폭포 막대, 인원 막대, 훈련 달력, 작은 아이콘.
 * 색은 상태(좋음·주의·나쁨)를 나타낼 때만 쓰고, 글자는 늘 글자 색으로 쓴다 (색만으로 읽히지 않게 숫자·부호를 같이).
 */

export type Tone = 'good' | 'warn' | 'bad';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ------------------------------------------------------------------ 직군 그림

const SKIN = '#f2c6a0';
const SKIN_SHADE = '#dfa982';
const HAIR = '#4a3426';
const INK = '#2b2724';
const SHOULDERS = 'M9 66c0-14 9-22.5 23-22.5S55 52 55 66z';

/** 직군마다 배경 동그라미 색 (연하게 섞어서 쓴다) */
const ROLE_HUE: Record<StaffGroup, string> = {
  pilot: '#3e63dd',
  cabin: '#d9622b',
  tech: '#c98a00',
  ground: '#1d8a52',
};

function Face() {
  return (
    <>
      <rect x={28} y={34} width={8} height={10} rx={3} fill={SKIN_SHADE} />
      <circle cx={32} cy={27} r={10.5} fill={SKIN} />
      <circle cx={28.2} cy={28} r={1.3} fill={INK} />
      <circle cx={35.8} cy={28} r={1.3} fill={INK} />
      <path d="M28.8 31.6q3.2 2.6 6.4 0" fill="none" stroke={INK} strokeWidth={1.3} strokeLinecap="round" />
      <circle cx={25.6} cy={30.8} r={1.6} fill="#f08b7a" opacity={0.45} />
      <circle cx={38.4} cy={30.8} r={1.6} fill="#f08b7a" opacity={0.45} />
    </>
  );
}

const ROLE_BODY: Record<StaffGroup, ReactNode> = {
  // 조종사: 남색 제복, 금색 견장, 모자
  pilot: (
    <>
      <path d={SHOULDERS} fill="#27416d" />
      <path d="M26 44l6 9 6-9z" fill="#fff" />
      <path d="M31 45.5h2l.9 8-1.9 2.4-1.9-2.4z" fill="#16233b" />
      <path d="M12.6 51.4l8.6-3.8 1 2.6-8.5 4z" fill="#e3b23c" />
      <path d="M51.4 51.4l-8.6-3.8-1 2.6 8.5 4z" fill="#e3b23c" />
      <Face />
      <path d="M20.5 21.4c0-7.2 5-10.9 11.5-10.9s11.5 3.7 11.5 10.9z" fill="#27416d" />
      <rect x={20.5} y={18.8} width={23} height={3} fill="#16233b" />
      <path d="M19 21.8q13 4.2 26 0l-.7 2.6q-12.3 3.6-24.6 0z" fill="#101a2d" />
      <circle cx={32} cy={15.2} r={2.3} fill="#e3b23c" />
      <path d="M26.4 15.6q2.8-1.7 3.6 0M37.6 15.6q-2.8-1.7-3.6 0" stroke="#e3b23c" strokeWidth={1.2} fill="none" strokeLinecap="round" />
    </>
  ),
  // 객실 승무원: 묶은 머리, 작은 모자, 스카프
  cabin: (
    <>
      <circle cx={32} cy={14.6} r={5} fill={HAIR} />
      <path d={SHOULDERS} fill="#1f6f86" />
      <path d="M25.5 44l6.5 7.5 6.5-7.5z" fill="#fff" />
      <Face />
      <path d="M21.4 28.4c-.8-8.2 4-13 10.6-13s11.4 4.8 10.6 13c-1.4-4.6-5-7.6-10.6-7.6S22.8 23.8 21.4 28.4z" fill={HAIR} />
      <rect x={35.6} y={13.6} width={9.4} height={4.6} rx={1.6} fill="#e8703a" transform="rotate(16 40.3 15.9)" />
      <path d="M25.6 43.4l6.4 5 6.4-5 1.6 2.3-8 6.1-8-6.1z" fill="#e8703a" />
      <path d="M32 50l-3.6 7.2 2.5.5 1.1-4.7 1.1 4.7 2.5-.5z" fill="#c9561f" />
      <rect x={40.5} y={53} width={6.5} height={2.8} rx={1} fill="#f3e3b5" />
    </>
  ),
  // 정비사: 작업복, 안전모, 렌치
  tech: (
    <>
      <path d={SHOULDERS} fill="#3d6aa3" />
      <path d="M24.5 45v21M39.5 45v21" stroke="#2a4f80" strokeWidth={2.6} />
      <rect x={27.5} y={53} width={9} height={7} rx={1.5} fill="#2a4f80" />
      <Face />
      <path d="M20.6 23.4c0-7.6 5-12.4 11.4-12.4s11.4 4.8 11.4 12.4z" fill="#f2b632" />
      <rect x={18.4} y={22.4} width={27.2} height={3} rx={1.5} fill="#d99a16" />
      <rect x={30.6} y={11.2} width={2.8} height={11.6} rx={1.2} fill="#f8d47a" />
      <g transform="rotate(38 50.4 48)">
        <rect x={48.6} y={44} width={3.6} height={17} rx={1.8} fill="#9aa4ae" />
        <path d="M45.4 40a5 5 0 0 0 10 0v-4h-3v4h-4v-4h-3z" fill="#9aa4ae" />
      </g>
    </>
  ),
  // 지상직: 헤드셋, 카운터, 짐가방
  ground: (
    <>
      <path d={SHOULDERS} fill="#2f7d55" />
      <path d="M26.5 44l5.5 7 5.5-7z" fill="#fff" />
      <path d="M28.6 44.4l3.4 6.6 3.4-6.6" stroke="#e3b23c" strokeWidth={1.2} fill="none" />
      <Face />
      <path d="M21.5 26.6c-.4-7.2 4-11.2 10.5-11.2s10.9 4 10.5 11.2c-2-3.8-5.6-5.8-10.5-5.8s-8.5 2-10.5 5.8z" fill={HAIR} />
      <path d="M20.8 28a11.2 11.2 0 0 1 22.4 0" fill="none" stroke="#3a3a3a" strokeWidth={2} />
      <rect x={18.8} y={25.6} width={4} height={6.4} rx={2} fill="#3a3a3a" />
      <path d="M21.2 31.6q1 3.8 6.2 4" stroke="#3a3a3a" strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <circle cx={27.6} cy={35.6} r={1.3} fill="#3a3a3a" />
      <rect x={43.5} y={45.5} width={11} height={8.6} rx={1.6} fill="#d9622b" />
      <path d="M46.6 45.5v-2.2h4.8v2.2" stroke="#8a3c16" fill="none" strokeWidth={1.4} />
      <rect x={2} y={54} width={60} height={12} fill="#c99a63" />
      <rect x={2} y={53} width={60} height={3} rx={1} fill="#a87a45" />
    </>
  ),
};

/** 직군 그림 (동그라미 안의 사람) */
export function RoleArt({ group, size = 56 }: { group: StaffGroup; size?: number }) {
  const id = useId();
  return (
    <svg className="al-role-art" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <clipPath id={`${id}-c`}>
          <circle cx={32} cy={32} r={31} />
        </clipPath>
      </defs>
      <circle cx={32} cy={32} r={31} style={{ fill: `color-mix(in srgb, ${ROLE_HUE[group]} 20%, var(--surface))` }} />
      <g clipPath={`url(#${id}-c)`}>{ROLE_BODY[group]}</g>
      <circle cx={32} cy={32} r={31} fill="none" style={{ stroke: `color-mix(in srgb, ${ROLE_HUE[group]} 45%, var(--surface))` }} strokeWidth={1.5} />
    </svg>
  );
}

// ------------------------------------------------------------------ 작은 아이콘 (24×24, 선 그림)

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export type StaffIconKind = 'people' | 'plane' | 'clock' | 'strike' | 'cancel' | 'calendar' | 'coin' | 'smile' | 'school' | 'check' | 'alert' | 'info';

const ICONS: Record<StaffIconKind, ReactNode> = {
  people: (
    <>
      <circle cx={9} cy={8} r={3.2} {...S} />
      <path d="M3 20c0-3.8 2.7-6.4 6-6.4s6 2.6 6 6.4" {...S} />
      <circle cx={16.5} cy={9} r={2.6} {...S} />
      <path d="M15.6 14c3.2-.4 5.6 1.9 5.6 5.4" {...S} />
    </>
  ),
  plane: <path d={MAP_PLANE_D} transform="translate(12 12) rotate(-30) scale(1.05)" fill="currentColor" />,
  clock: (
    <>
      <circle cx={12} cy={12} r={8.5} {...S} />
      <path d="M12 7v5l3.4 2.2" {...S} />
    </>
  ),
  strike: (
    <>
      <rect x={4.5} y={3.5} width={15} height={9.5} rx={1.6} {...S} />
      <path d="M12 13v8M9 21h6M12 6.2v3.2" {...S} />
      <circle cx={12} cy={11} r={0.4} fill="currentColor" stroke="currentColor" strokeWidth={1.2} />
    </>
  ),
  cancel: (
    <>
      <path d={MAP_PLANE_D} transform="translate(12 12) rotate(-30) scale(1.05)" fill="currentColor" opacity={0.45} />
      <path d="M4.5 4.5l15 15" {...S} strokeWidth={2.2} />
    </>
  ),
  calendar: (
    <>
      <rect x={3.5} y={5} width={17} height={15} rx={2} {...S} />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" {...S} />
      <path d="M8 14h2M14 14h2M8 17h2" {...S} />
    </>
  ),
  coin: (
    <>
      <ellipse cx={12} cy={7} rx={7} ry={3} {...S} />
      <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" {...S} />
    </>
  ),
  smile: (
    <>
      <circle cx={12} cy={12} r={8.5} {...S} />
      <path d="M8.5 13.5q3.5 3.4 7 0" {...S} />
      <path d="M9 9.5v.5M15 9.5v.5" {...S} strokeWidth={2.2} />
    </>
  ),
  school: (
    <>
      <path d="M2.5 9L12 4.5 21.5 9 12 13.5z" {...S} />
      <path d="M6.5 11v4.6c0 1.6 2.5 2.9 5.5 2.9s5.5-1.3 5.5-2.9V11M21.5 9v5" {...S} />
    </>
  ),
  check: (
    <>
      <circle cx={12} cy={12} r={8.5} {...S} />
      <path d="M8 12.3l2.7 2.7L16 9.6" {...S} />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.8l9 15.7H3z" {...S} />
      <path d="M12 9.6v4.6M12 17v.2" {...S} />
    </>
  ),
  info: (
    <>
      <circle cx={12} cy={12} r={8.5} {...S} />
      <path d="M12 11v5.5M12 7.6v.2" {...S} strokeWidth={2.2} />
    </>
  ),
};

export function StaffIcon({ kind, size = 20, className }: { kind: StaffIconKind; size?: number; className?: string }) {
  return (
    <svg className={`al-sicon${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[kind]}
    </svg>
  );
}

// ------------------------------------------------------------------ ⓘ 자세히

/** 긴 설명을 접어 두고 'ⓘ 자세히'를 누르면 펼친다 */
export function MoreInfo({ children, label = '자세히' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="al-more">
      <button type="button" className="al-more-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <StaffIcon kind="info" size={15} /> {open ? '접기' : label}
      </button>
      {open && (
        <div id={id} className="al-more-text">
          {children}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ 조직 만족도 계기판

export function moraleTone(v: number): Tone {
  return v < 30 ? 'bad' : v < 45 ? 'warn' : 'good';
}

/**
 * 반원 계기판: 0~100. 바탕 띠는 파업 위험(0~30)·주의(30~45)·괜찮음(45~100)을 연하게,
 * 채운 띠는 지금 만족도, 바깥 삼각형은 만족도가 향하는 곳. 가운데 얼굴과 숫자.
 */
export function MoraleGauge({ value, target }: { value: number; target: number }) {
  const w = 228;
  const cx = w / 2;
  const cy = 104;
  const r = 84;
  const sw = 16;
  const v = clamp(value, 0, 100);
  const tg = clamp(target, 0, 100);
  const pt = (val: number, rad: number) => {
    const a = Math.PI - (val / 100) * Math.PI;
    return [cx + rad * Math.cos(a), cy - rad * Math.sin(a)] as const;
  };
  const arc = (a: number, b: number, rad = r) => {
    const [x0, y0] = pt(a, rad);
    const [x1, y1] = pt(b, rad);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${rad} ${rad} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const tone = moraleTone(v);
  const [ex, ey] = pt(v, r);
  // 향하는 곳: 띠 바깥의 삼각형 (안쪽을 가리킨다)
  const ta = Math.PI - (tg / 100) * Math.PI;
  const tip = pt(tg, r + sw / 2 + 1);
  const baseL = [cx + (r + sw / 2 + 10) * Math.cos(ta + 0.06), cy - (r + sw / 2 + 10) * Math.sin(ta + 0.06)];
  const baseR = [cx + (r + sw / 2 + 10) * Math.cos(ta - 0.06), cy - (r + sw / 2 + 10) * Math.sin(ta - 0.06)];
  const up = tg - v;
  const mood = v >= 60 ? 1 : v >= 45 ? 0 : -1;
  return (
    <svg className="al-gauge" width={w} height={132} viewBox={`0 0 ${w} 132`} role="img" aria-label={`조직 만족도 ${Math.round(v)}, 향하는 곳 ${Math.round(tg)}`}>
      <path d={arc(0, 30)} className="al-gauge-zone al-zone-bad" strokeWidth={sw} />
      <path d={arc(30, 45)} className="al-gauge-zone al-zone-warn" strokeWidth={sw} />
      <path d={arc(45, 100)} className="al-gauge-zone al-zone-good" strokeWidth={sw} />
      {v > 0.5 && <path d={arc(0, v)} className={`al-gauge-fill al-tone-${tone}`} strokeWidth={sw} />}
      {[30, 45].map((k) => {
        const [x0, y0] = pt(k, r - sw / 2 - 1);
        const [x1, y1] = pt(k, r + sw / 2 + 1);
        return <line key={k} x1={x0} y1={y0} x2={x1} y2={y1} className="al-gauge-gap" />;
      })}
      <circle cx={ex} cy={ey} r={7} className={`al-gauge-dot al-tone-${tone}`} />
      <path d={`M${tip[0].toFixed(2)} ${tip[1].toFixed(2)}L${baseL[0].toFixed(2)} ${baseL[1].toFixed(2)}L${baseR[0].toFixed(2)} ${baseR[1].toFixed(2)}Z`} className="al-gauge-target">
        <title>향하는 곳 {Math.round(tg)}</title>
      </path>
      {/* 얼굴 */}
      <g transform={`translate(${cx} 52)`} className={`al-gauge-face al-tone-${tone}`}>
        <circle r={15} className="al-face-bg" />
        <circle cx={-5} cy={-3} r={1.8} className="al-face-ink" />
        <circle cx={5} cy={-3} r={1.8} className="al-face-ink" />
        <path d={mood > 0 ? 'M-6 4q6 6 12 0' : mood === 0 ? 'M-6 5.5h12' : 'M-6 8q6-6 12 0'} className="al-face-mouth" />
      </g>
      <text x={cx} y={cy - 6} textAnchor="middle" className="al-gauge-num">
        {Math.round(v)}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" className="al-gauge-sub">
        {Math.abs(up) < 0.5 ? '그대로 머물러요' : `${up > 0 ? '▲' : '▼'} ${Math.round(tg)}로 ${up > 0 ? '오르는' : '내리는'} 중`}
      </text>
      <text x={cx - r} y={cy + 20} textAnchor="middle" className="al-tick">
        0
      </text>
      <text x={cx + r} y={cy + 20} textAnchor="middle" className="al-tick">
        100
      </text>
      {(() => {
        const [lx, ly] = pt(15, r + sw / 2 + 10);
        return (
          <text x={lx - 4} y={ly} textAnchor="end" className="al-tick al-gauge-danger">
            파업
          </text>
        );
      })()}
    </svg>
  );
}

// ------------------------------------------------------------------ 만족도 폭포 막대

export interface MoralePart {
  label: string;
  v: number;
}

/**
 * 폭포 막대: 기본값에서 시작해 까닭마다 오르내리고, 맨 아래 줄이 만족도가 향하는 곳.
 * 오르면 초록(+), 내리면 빨강(−) — 부호와 숫자를 늘 같이 쓴다.
 */
export function MoraleWaterfall({ base, parts, target }: { base: number; parts: MoralePart[]; target: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(240, useElementWidth(ref) || 360);
  const labelW = 70;
  const valueW = 44;
  const rowH = 24;
  const barH = 14;
  const plotW = width - labelW - valueW - 8;
  const x = (v: number) => labelW + (clamp(v, 0, 100) / 100) * plotW;
  type Row = { label: string; from: number; to: number; kind: 'base' | 'up' | 'down' | 'total'; text: string };
  const rows: Row[] = [{ label: '기본', from: 0, to: base, kind: 'base', text: `${base}` }];
  let run = base;
  for (const p of parts) {
    const next = run + p.v;
    rows.push({ label: p.label, from: run, to: next, kind: p.v >= 0 ? 'up' : 'down', text: `${p.v >= 0 ? '+' : '−'}${Math.abs(Math.round(p.v))}` });
    run = next;
  }
  rows.push({ label: '향하는 곳', from: 0, to: target, kind: 'total', text: `${Math.round(target)}` });
  const height = rows.length * rowH + 18;
  const axisY = rows.length * rowH + 2;
  const tone = moraleTone(target);
  return (
    <div className="al-chart al-waterfall" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={`만족도가 향하는 곳 ${Math.round(target)}: ${rows.map((r) => `${r.label} ${r.text}`).join(', ')}`}>
        {[0, 30, 50, 100].map((k) => (
          <g key={k}>
            <line x1={x(k)} x2={x(k)} y1={2} y2={axisY} className={k === 30 ? 'al-wf-strike' : 'al-grid'} />
            <text x={x(k)} y={height - 3} textAnchor="middle" className="al-tick">
              {k === 30 ? '30 파업' : k}
            </text>
          </g>
        ))}
        {rows.map((row, i) => {
          const y = i * rowH + (rowH - barH) / 2 + 2;
          const a = x(Math.min(row.from, row.to));
          const b = x(Math.max(row.from, row.to));
          const bw = Math.max(2, b - a);
          const next = rows[i + 1];
          const cls = row.kind === 'total' ? `al-tone-${tone}` : row.kind === 'base' ? 'al-wf-base' : row.kind === 'up' ? 'al-wf-up' : 'al-wf-down';
          return (
            <g key={row.label + i}>
              <title>
                {row.label} {row.text}
                {row.kind === 'up' || row.kind === 'down' ? ` (${Math.round(row.from)} → ${Math.round(row.to)})` : ''}
              </title>
              <text x={labelW - 8} y={y + barH / 2 + 4} textAnchor="end" className={`al-wf-label${row.kind === 'total' ? ' al-wf-strong' : ''}`}>
                {row.label}
              </text>
              <rect x={a} y={y} width={bw} height={barH} rx={Math.min(4, bw / 2)} className={`al-wf-bar ${cls}`} />
              {next && next.kind !== 'total' && <line x1={x(row.to)} x2={x(row.to)} y1={y + barH} y2={y + rowH} className="al-wf-link" />}
              <text x={width - 4} y={y + barH / 2 + 4} textAnchor="end" className={`al-wf-value${row.kind === 'total' ? ' al-wf-strong' : ''}`}>
                {row.kind === 'total' ? `= ${row.text}` : row.text}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ 인원 막대

/**
 * 한 직군의 사람: 지금 일하는 사람(채운 막대, 상태 색) + 훈련 중(빗금) + 필요한 곳 눈금.
 * 모자라면 지금 사람 끝에서 필요 눈금까지 바탕을 연한 빨강으로.
 */
export function HeadcountBar({ need, have, pipe, tone, name }: { need: number; have: number; pipe: number; tone: Tone; name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(200, useElementWidth(ref) || 360);
  const id = useId();
  const max = Math.max(need, have + pipe, 1) * 1.12;
  const x = (v: number) => 1 + (clamp(v, 0, max) / max) * (width - 2);
  const top = 20;
  const bh = 18;
  const short = Math.max(0, need - have);
  const nx = x(need);
  const anchor = nx > width - 44 ? 'end' : nx < 44 ? 'start' : 'middle';
  const haveW = x(have) - x(0);
  const pipeX = x(have) + (have > 0 ? 2 : 0);
  const pipeW = x(have + pipe) - pipeX;
  return (
    <div className="al-chart al-hc" ref={ref}>
      <svg width={width} height={top + bh + 8} role="img" aria-label={`${name}: 지금 ${have}명, 훈련 중 ${pipe}명, 필요 ${need}명${short > 0 ? `, ${short}명 모자람` : ''}`}>
        <defs>
          <pattern id={`${id}-h`} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={6} height={6} className="al-hc-pipe-bg" />
            <line x1={1.5} y1={0} x2={1.5} y2={6} className="al-hc-pipe-line" />
          </pattern>
        </defs>
        <rect x={x(0)} y={top} width={width - 2} height={bh} rx={5} className="al-hc-track" />
        {short > 0 && need > 0 && (
          <>
            <rect x={x(have)} y={top} width={Math.max(0, nx - x(have))} height={bh} rx={4} className="al-hc-short" />
            {/* 훈련 중 빗금에 가려도 보이게 막대 아래에 빨간 줄 */}
            <rect x={x(have)} y={top + bh + 3} width={Math.max(2, nx - x(have))} height={4} rx={2} className="al-hc-short-line" />
          </>
        )}
        {haveW > 0.5 && <rect x={x(0)} y={top} width={haveW} height={bh} rx={Math.min(5, haveW / 2)} className={`al-hc-have al-tone-${tone}`} />}
        {pipe > 0 && pipeW > 0.5 && <rect x={pipeX} y={top} width={pipeW} height={bh} rx={Math.min(5, pipeW / 2)} fill={`url(#${id}-h)`} />}
        {need > 0 && (
          <>
            <line x1={nx} x2={nx} y1={top - 5} y2={top + bh + 3} className="al-hc-need" />
            <text x={nx} y={top - 8} textAnchor={anchor} className="al-hc-need-label">
              필요 {need.toLocaleString('ko-KR')}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ 훈련 달력

/** 훈련 중인 사람들이 언제 일을 시작하는지 달 눈금 위에 */
export function PipelineTimeline({ now, batches }: { now: number; batches: { n: number; ready: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(220, useElementWidth(ref) || 360);
  const merged = new Map<number, number>();
  for (const b of batches) merged.set(b.ready, (merged.get(b.ready) ?? 0) + b.n);
  const points = [...merged.entries()].sort((a, b) => a[0] - b[0]);
  if (points.length === 0) return null;
  const end = Math.max(now + 2, points[points.length - 1][0]);
  const span = end - now;
  const m = { l: 18, r: 22 };
  const x = (t: number) => m.l + ((t - now) / span) * (width - m.l - m.r);
  const axisY = 26;
  const every = Math.ceil(span / Math.max(1, Math.floor((width - m.l - m.r) / 44)));
  const months = Array.from({ length: span + 1 }, (_, i) => now + i);
  let lastLabelX = -Infinity;
  let lift = false;
  return (
    <div className="al-chart al-pipeline" ref={ref}>
      <svg width={width} height={48} role="img" aria-label={`훈련 중: ${points.map(([t, n]) => `${yearOfM(t)}년 ${monthOf(t)}월 ${n}명`).join(', ')}`}>
        <line x1={x(now)} x2={x(end)} y1={axisY} y2={axisY} className="al-pl-axis" />
        {months.map((t, i) => {
          const show = i % every === 0 || merged.has(t);
          return (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={axisY - 3} y2={axisY + 3} className="al-pl-tick" />
              {show && (
                <text x={x(t)} y={axisY + 17} textAnchor="middle" className={`al-tick${i === 0 ? ' al-tick-now' : ''}`}>
                  {i === 0 ? '지금' : monthOf(t) === 1 ? `${String(yearOfM(t) % 100).padStart(2, '0')}년 1월` : `${monthOf(t)}월`}
                </text>
              )}
            </g>
          );
        })}
        <circle cx={x(now)} cy={axisY} r={4} className="al-pl-now" />
        {points.map(([t, n]) => {
          const px = x(t);
          // 이름표가 붙으면 번갈아 높이를 바꾼다
          lift = px - lastLabelX < 46 ? !lift : false;
          lastLabelX = px;
          return (
            <g key={t}>
              <title>
                {yearOfM(t)}년 {monthOf(t)}월부터 {n}명이 일해요
              </title>
              <circle cx={px} cy={axisY} r={6} className="al-pl-dot" />
              <text x={Math.min(px, width - 2)} y={lift ? 6 : 13} textAnchor={px > width - 24 ? 'end' : 'middle'} className="al-pl-label">
                +{n}명
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ 훈련원 그림

/** 훈련원 건물: 지붕 위 학사모, 기둥, 활주로 */
export function AcademyArt({ open }: { open: boolean }) {
  return (
    <svg className={`al-academy-art${open ? ' al-on' : ''}`} width={92} height={64} viewBox="0 0 92 64" aria-hidden="true">
      <rect x={0} y={0} width={92} height={64} rx={10} className="al-academy-sky" />
      <rect x={0} y={52} width={92} height={12} className="al-academy-ground" />
      <path d="M8 58h76" stroke="#fff" strokeWidth={1.6} strokeDasharray="6 5" opacity={0.8} />
      <path d="M20 26L46 14l26 12z" fill="#b5523a" />
      <rect x={22} y={26} width={48} height={24} fill="#f3e6cf" />
      <rect x={22} y={48} width={48} height={4} fill="#d8c3a0" />
      {[27, 37, 51, 61].map((cx) => (
        <rect key={cx} x={cx} y={29} width={4} height={19} fill="#d8c3a0" />
      ))}
      <rect x={42} y={36} width={8} height={12} rx={1} fill="#7a5a3a" />
      <path d="M36 10l10-4.5L56 10l-10 4.5z" fill="#2b2724" />
      <path d="M40 12v3.6c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2V12" fill="#2b2724" />
      <path d="M56 10v5" stroke="#e3b23c" strokeWidth={1.4} />
      <circle cx={56} cy={15.6} r={1.2} fill="#e3b23c" />
      <path d={MAP_PLANE_D} transform="translate(78 14) rotate(-20) scale(0.75)" fill="#fff" />
      {!open && <rect x={0} y={0} width={92} height={64} rx={10} className="al-academy-veil" />}
    </svg>
  );
}
