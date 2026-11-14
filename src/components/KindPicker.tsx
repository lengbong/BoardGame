import { ChoiceIcon, ICON_DUO as DUO, ICON_LINE as LINE, IconPicker } from './IconPicker';

/** 아이콘으로 고르는 참가 종류 (4인 게임의 SeatKind, 2인 게임의 DuelKind를 모두 담는다) */
export type KindIconName = 'human' | 'ai-easy' | 'ai-normal' | 'ai-hard' | 'empty';

export interface KindOption<K extends KindIconName> {
  value: K;
  /** 전체 이름. 예: '컴퓨터 (쉬움)' */
  label: string;
  /** 아이콘 밑에 쓰는 짧은 이름. 예: '쉬움' */
  short: string;
}

/** 로봇 얼굴: 쉬움은 웃는 눈, 보통은 동그란 눈, 어려움은 찡그린 눈썹과 이를 보인 입 */
function RobotFace({ level }: { level: 'easy' | 'normal' | 'hard' }) {
  switch (level) {
    case 'easy':
      return (
        <>
          <path d="M10 18q2-2.6 4 0M18 18q2-2.6 4 0" {...LINE} />
          <path d="M12 21.5q4 3 8 0" {...LINE} />
        </>
      );
    case 'normal':
      return (
        <>
          <circle cx="12" cy="17" r="2" fill="currentColor" />
          <circle cx="20" cy="17" r="2" fill="currentColor" />
          <path d="M12.5 22.5h7" {...LINE} />
        </>
      );
    case 'hard':
      return (
        <>
          <path d="M9.5 13.8l4.2 1.6M22.5 13.8l-4.2 1.6" {...LINE} />
          <circle cx="12" cy="18" r="1.7" fill="currentColor" />
          <circle cx="20" cy="18" r="1.7" fill="currentColor" />
          <path d="M11.5 23.2l2.25-1.6 2.25 1.6 2.25-1.6 2.25 1.6" {...LINE} />
        </>
      );
  }
}

export function KindIcon({ kind, size }: { kind: KindIconName; size?: number }) {
  if (kind === 'human') {
    return (
      <ChoiceIcon size={size}>
        <circle cx="16" cy="11" r="5.5" {...DUO} />
        <path d="M6 28c0-5.8 4.5-9.5 10-9.5s10 3.7 10 9.5z" {...DUO} />
      </ChoiceIcon>
    );
  }
  if (kind === 'empty') {
    return (
      <ChoiceIcon size={size}>
        <circle cx="16" cy="16" r="10.5" {...LINE} />
        <path d="M8.6 23.4 23.4 8.6" {...LINE} />
      </ChoiceIcon>
    );
  }
  return (
    <ChoiceIcon size={size}>
      <path d="M16 10V6.5" {...LINE} />
      <circle cx="16" cy="5" r="2" fill="currentColor" />
      <rect x="2.5" y="15" width="3" height="6" rx="1.2" fill="currentColor" />
      <rect x="26.5" y="15" width="3" height="6" rx="1.2" fill="currentColor" />
      <rect x="5.5" y="10" width="21" height="17" rx="4.5" {...DUO} />
      <RobotFace level={kind === 'ai-easy' ? 'easy' : kind === 'ai-hard' ? 'hard' : 'normal'} />
    </ChoiceIcon>
  );
}

interface KindPickerProps<K extends KindIconName> {
  caption: string;
  value: K;
  options: readonly KindOption<K>[];
  onChange: (kind: K) => void;
  /** 고른 칸의 바탕색 (기본: 강조색) */
  color?: string;
  testId?: string;
}

/** 사람/컴퓨터(난이도)/비움을 아이콘 버튼 한 줄로 고른다. */
export function KindPicker<K extends KindIconName>({ options, ...rest }: KindPickerProps<K>) {
  return <IconPicker {...rest} options={options.map((o) => ({ ...o, icon: <KindIcon kind={o.value} /> }))} />;
}
