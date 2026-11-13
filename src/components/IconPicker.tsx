import { useId, type CSSProperties, type ReactNode } from 'react';

export interface IconChoice<V extends string> {
  value: V;
  /** 아이콘 밑에 쓰는 짧은 이름. 예: '쉬움' */
  short: string;
  /** 전체 이름 (없으면 short). 마우스를 올리면 보이고 화면 낭독기가 읽는다. 예: '컴퓨터 (쉬움)' */
  label?: string;
  icon: ReactNode;
}

interface IconPickerProps<V extends string> {
  /** 이름표. 예: '참가', '속도' */
  caption: string;
  value: V;
  options: readonly IconChoice<V>[];
  onChange: (value: V) => void;
  /** 고른 칸의 바탕색 (기본: 강조색) */
  color?: string;
  /** 이름표를 위가 아니라 왼쪽에 둔다 */
  inline?: boolean;
  /** 묶음에 붙는 data-testid. 칸마다 `${testId}-${value}`가 붙는다. */
  testId?: string;
}

/**
 * 몇 가지 중 하나를 아이콘 버튼 한 줄로 고른다 (드롭다운 대신).
 * 속은 라디오 버튼이라 Tab으로 들어가 방향키로도 고를 수 있다.
 */
export function IconPicker<V extends string>({ caption, value, options, onChange, color, inline, testId }: IconPickerProps<V>) {
  const id = useId();
  return (
    <div className={`choice-field${inline ? ' choice-inline' : ''}`}>
      <span id={`${id}-caption`}>{caption}</span>
      <div
        className="choice-group"
        role="radiogroup"
        aria-labelledby={`${id}-caption`}
        style={color ? ({ '--pick': color } as CSSProperties) : undefined}
        data-testid={testId}
      >
        {options.map((o) => {
          const on = o.value === value;
          return (
            <label key={o.value} className={`choice-option${on ? ' choice-on' : ''}`} title={o.label ?? o.short} data-testid={testId && `${testId}-${o.value}`}>
              <input type="radio" name={id} value={o.value} checked={on} onChange={() => onChange(o.value)} aria-label={o.label ?? o.short} />
              {o.icon}
              <span aria-hidden="true">{o.short}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** 아이콘 SVG가 함께 쓰는 선 모양 */
export const ICON_DUO = { fill: 'currentColor', fillOpacity: 0.18, stroke: 'currentColor', strokeWidth: 2.2, strokeLinejoin: 'round' } as const;
export const ICON_LINE = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** 고르기 버튼에 넣는 32×32 아이콘 틀 */
export function ChoiceIcon({ children, size = 26 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" className="choice-icon">
      {children}
    </svg>
  );
}
