/** 게임 목록 카드에 쓰는 뒤집기 그림: 초록 판 위의 흑돌과 백돌 */
export function ReversiIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="10" fill="#2f8f5b" stroke="#1d5e3a" strokeWidth="3" />
      <path d="M32 6V58M6 32H58" stroke="#1d5e3a" strokeWidth="2" />
      <circle cx="19" cy="19" r="10" fill="#222" />
      <circle cx="45" cy="45" r="10" fill="#222" />
      <circle cx="45" cy="19" r="10" fill="#f7f4ec" stroke="#bbb" strokeWidth="1.5" />
      <circle cx="19" cy="45" r="10" fill="#f7f4ec" stroke="#bbb" strokeWidth="1.5" />
    </svg>
  );
}
