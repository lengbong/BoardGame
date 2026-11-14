import { SPEEDS, SPEED_LABELS, type Speed } from '../games/common/speed';
import { ChoiceIcon, IconPicker, type IconChoice } from './IconPicker';

/** 빨리감기처럼 세모가 1개(보통)·2개(빠르게)·3개(아주 빠르게) */
const ARROWS: Record<Speed, string[]> = {
  normal: ['M11 8.5 22.5 16 11 23.5z'],
  fast: ['M5.5 9.5 15 16l-9.5 6.5z', 'M16 9.5 25.5 16 16 22.5z'],
  turbo: ['M2.5 10.5 10 16l-7.5 5.5z', 'M11.5 10.5 19 16l-7.5 5.5z', 'M20.5 10.5 28 16l-7.5 5.5z'],
};

export function SpeedIcon({ speed, size }: { speed: Speed; size?: number }) {
  return (
    <ChoiceIcon size={size}>
      {ARROWS[speed].map((d) => (
        <path key={d} d={d} fill="currentColor" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      ))}
    </ChoiceIcon>
  );
}

const SPEED_CHOICES: IconChoice<Speed>[] = SPEEDS.map((s) => ({ value: s, short: SPEED_LABELS[s], icon: <SpeedIcon speed={s} /> }));

interface SpeedPickerProps {
  value: Speed;
  onChange: (speed: Speed) => void;
  /** 이름표 (기본 '속도') */
  caption?: string;
  /** 이름표를 위가 아니라 왼쪽에 둔다 */
  inline?: boolean;
}

/** 컴퓨터·애니메이션 속도를 아이콘 버튼 3개로 고른다 */
export function SpeedPicker({ value, onChange, caption = '속도', inline }: SpeedPickerProps) {
  return <IconPicker caption={caption} value={value} options={SPEED_CHOICES} onChange={onChange} inline={inline} testId="speed" />;
}
