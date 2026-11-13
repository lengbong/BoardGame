import { useId } from 'react';

/** 게임 목록 카드에 쓰는 만칼라 그림: 나뭇결 판, 파인 구멍, 반짝이는 씨앗 */
export function MancalaIcon() {
  const p = useId().replace(/:/g, '');
  const seeds: [number, number, string][] = [
    [21.5, 24.5, '#e0464e'],
    [25.5, 27.5, '#f2b025'],
    [21, 29.5, '#3b8fe0'],
    [41.5, 24, '#2fae74'],
    [37.5, 28, '#e0464e'],
    [22, 44, '#f2b025'],
    [26, 40.5, '#9461d9'],
    [42, 42, '#3b8fe0'],
    [38, 45, '#e0464e'],
    [11, 28, '#2fae74'],
    [11.5, 34, '#f2784b'],
    [52.5, 31, '#9461d9'],
  ];
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={`${p}-w`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d4975a" />
          <stop offset="1" stopColor="#9e6130" />
        </linearGradient>
        <radialGradient id={`${p}-h`} cx="50%" cy="62%" r="62%">
          <stop offset="0" stopColor="#8d5729" />
          <stop offset="1" stopColor="#3d210b" />
        </radialGradient>
        <radialGradient id={`${p}-s`} cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="3" y="11" width="58" height="42" rx="18" fill="#6b3a14" />
      <rect x="5" y="13" width="54" height="38" rx="16" fill={`url(#${p}-w)`} />
      <path d="M8 22 C20 19 34 25 56 21 M8 40 C24 43 38 37 56 42" stroke="#6b3a14" strokeOpacity="0.25" strokeWidth="1" fill="none" />
      {[24, 40].map((cx) => [27, 43].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="7.2" fill={`url(#${p}-h)`} stroke="#f0c08a" strokeOpacity="0.6" strokeWidth="0.8" />))}
      <rect x="7.5" y="20" width="8" height="24" rx="4" fill={`url(#${p}-h)`} stroke="#f0c08a" strokeOpacity="0.6" strokeWidth="0.8" />
      <rect x="48.5" y="20" width="8" height="24" rx="4" fill={`url(#${p}-h)`} stroke="#f0c08a" strokeOpacity="0.6" strokeWidth="0.8" />
      {seeds.map(([x, y, c], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="2.5" fill={c} stroke="rgba(0,0,0,0.35)" strokeWidth="0.5" />
          <circle cx={x} cy={y} r="2.5" fill={`url(#${p}-s)`} />
        </g>
      ))}
    </svg>
  );
}
