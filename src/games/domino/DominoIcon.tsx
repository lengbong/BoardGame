/** 게임 목록 카드에 쓰는 도미노 그림 (도미노 이모지는 컴퓨터마다 안 보일 수 있어서 직접 그린다) */
export function DominoIcon() {
  const ink = '#2b2724';
  const pip = (cx: number, cy: number) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.9" fill={ink} />;
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      {/* 뒤에 기댄 패 (뒷면) */}
      <g transform="rotate(24 44 30)">
        <rect x="32" y="5" width="24" height="46" rx="5" fill="#2c5462" stroke="#142a31" strokeWidth="2.5" />
        <rect x="36.5" y="9.5" width="15" height="37" rx="3" fill="none" stroke="#f2e3c0" strokeOpacity="0.55" strokeWidth="1.6" />
        <polygon points="44,20 49,28 44,36 39,28" fill="#e9b44c" />
      </g>
      {/* 앞의 상아색 패: 6 · 3 */}
      <g transform="rotate(-16 26 34)">
        <rect x="13" y="6" width="27" height="54" rx="6" fill="#fbf5e4" stroke="#5c4a35" strokeWidth="2.8" />
        <rect x="16" y="9" width="5" height="48" rx="2.5" fill="#fff" opacity="0.6" />
        <line x1="17" y1="33" x2="36" y2="33" stroke="#6b5a44" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="26.5" cy="33" r="1.8" fill="#b98a3e" />
        {[pip(20.5, 13), pip(20.5, 19.5), pip(20.5, 26), pip(32.5, 13), pip(32.5, 19.5), pip(32.5, 26)]}
        {[pip(20.5, 40), pip(26.5, 46.5), pip(32.5, 53)]}
      </g>
    </svg>
  );
}
