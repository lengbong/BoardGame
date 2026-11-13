import type { DuelSide } from '../common/duel';
import type { Disc } from './types';

/**
 * 뒤집기 돌 그림 (직접 그린 SVG). 그러데이션은 DiscDefs 한 번만 그려 두고 모든 돌이 함께 쓴다.
 * 돌 아래쪽에 살짝 어두운 초승달을 깔아 두께가 느껴지게 했다.
 */
export function DiscDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="rv-grad-black" cx="38%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#6b6b6b" />
          <stop offset="28%" stopColor="#333" />
          <stop offset="75%" stopColor="#141414" />
          <stop offset="100%" stopColor="#050505" />
        </radialGradient>
        <radialGradient id="rv-grad-white" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#f4f0e6" />
          <stop offset="85%" stopColor="#d9d2c2" />
          <stop offset="100%" stopColor="#bdb4a1" />
        </radialGradient>
        <radialGradient id="rv-grad-shine" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** 돌 한 면. viewBox 0~100 */
export function DiscFace({ side, className }: { side: Disc; className?: string }) {
  const black = side === 0;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <circle cx="50" cy="53" r="46" fill={black ? '#000' : '#8f8676'} opacity={black ? 0.55 : 0.6} />
      <circle cx="50" cy="50" r="46" fill={black ? 'url(#rv-grad-black)' : 'url(#rv-grad-white)'} />
      <circle cx="50" cy="50" r="38" fill="none" stroke={black ? '#ffffff' : '#9c937f'} strokeOpacity={black ? 0.07 : 0.25} strokeWidth="1.5" />
      <ellipse cx="36" cy="30" rx="17" ry="11" transform="rotate(-28 36 30)" fill="url(#rv-grad-shine)" opacity={black ? 0.55 : 0.9} />
    </svg>
  );
}

export const REVERSI_SIDES: [DuelSide, DuelSide] = [
  { label: '흑', color: '#2a2a2a', icon: <DiscFace side={0} className="rv-side-icon" /> },
  { label: '백', color: '#efe9dc', textColor: '#2b2724', icon: <DiscFace side={1} /> },
];

/** 차례 카드 바탕색 (밝은 글자 카드 위에 쓰므로 둘 다 밝게) */
export const SIDE_CARD: [{ border: string; bg: string }, { border: string; bg: string }] = [
  { border: '#2a2a2a', bg: '#ecebe7' },
  { border: '#b9b09c', bg: '#fffdf6' },
];
