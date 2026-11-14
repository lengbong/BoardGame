import type { ReactNode } from 'react';
import { SEAT_COLORS } from '../common/players';
import { CompanyBadge, SEAT_SHAPES } from './Art';
import type { Company } from './types';

/** 할 수 있으면 누를 수 있고, 못 하면 흐리게 + 이유를 작게 보여 주는 버튼 */
export function ActButton({
  children,
  blocker,
  onClick,
  primary,
  small,
  testId,
  title,
}: {
  children: ReactNode;
  /** 못 하는 이유 (null이면 할 수 있음) */
  blocker: string | null;
  onClick: () => void;
  primary?: boolean;
  small?: boolean;
  testId?: string;
  title?: string;
}) {
  return (
    <span className="al-act">
      <button
        type="button"
        className={`btn${primary ? ' btn-primary' : ''}${small ? ' btn-small' : ''}${blocker ? '' : ' al-can'}`}
        disabled={!!blocker}
        onClick={onClick}
        title={blocker ?? title}
        data-testid={testId}
      >
        {children}
      </button>
      {blocker && <small className="al-why">{blocker}</small>}
    </span>
  );
}

/** − 값 + */
export function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
  label,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  label: string;
  format?: (v: number) => string;
}) {
  return (
    <span className="al-stepper" role="group" aria-label={label}>
      <button type="button" className="al-step-btn" disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - step))} aria-label={`${label} 줄이기`}>
        −
      </button>
      <b>{format ? format(value) : value}</b>
      <button type="button" className="al-step-btn" disabled={disabled || value >= max} onClick={() => onChange(Math.min(max, value + step))} aria-label={`${label} 늘리기`}>
        +
      </button>
    </span>
  );
}

/** 가로 막대 (0~1) */
export function Meter({ value, tone = 'accent', label }: { value: number; tone?: 'accent' | 'good' | 'bad' | 'warn' | 'blue'; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className={`al-meter al-meter-${tone}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
      <span style={{ width: `${v * 100}%` }} />
    </span>
  );
}

/** 탑승률 막대: 낮으면 빨강, 알맞으면 초록, 꽉 차면 주황 */
export function LoadMeter({ lf }: { lf: number }) {
  const tone = lf < 0.55 ? 'bad' : lf > 0.97 ? 'warn' : 'good';
  return <Meter value={lf} tone={tone} label={`탑승률 ${Math.round(lf * 100)}%`} />;
}

export function Stars({ n, max = 5 }: { n: number; max?: number }) {
  return (
    <span className="al-stars" aria-label={`${n} / ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < n ? 'al-star-on' : ''} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}

/** 회사 꼬리 배지 + 이름 */
export function CoName({ c, bold }: { c: Company; bold?: boolean }) {
  const col = SEAT_COLORS[c.seat];
  return (
    <span className="al-coname">
      <CompanyBadge color={col.main} shape={SEAT_SHAPES[c.seat]} size={16} />
      {bold ? <b>{c.name}</b> : c.name}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>;
}
