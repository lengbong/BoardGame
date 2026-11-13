/** 게임 목록 카드에 쓰는 도미노 그림 (도미노 이모지는 컴퓨터마다 안 보일 수 있어서 직접 그린다) */
export function DominoIcon() {
  const pip = (cx: number, cy: number) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.2" fill="#2b2724" />;
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <g transform="rotate(-18 32 32)">
        <rect x="18" y="4" width="28" height="56" rx="6" fill="#fffdf6" stroke="#2b2724" strokeWidth="3" />
        <line x1="22" y1="32" x2="42" y2="32" stroke="#2b2724" strokeWidth="2.5" strokeLinecap="round" />
        {[pip(25, 11), pip(32, 18), pip(39, 25)]}
        {[pip(25, 39), pip(39, 39), pip(25, 53), pip(39, 53), pip(32, 46)]}
      </g>
    </svg>
  );
}
