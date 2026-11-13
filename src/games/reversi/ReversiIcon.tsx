/** 게임 목록 카드에 쓰는 뒤집기 그림: 나무 테두리 초록 판 위의 흑돌과 백돌, 하나는 뒤집히는 중 */
export function ReversiIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="rv-icon-felt" cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#3ca66e" />
          <stop offset="100%" stopColor="#18603c" />
        </radialGradient>
        <radialGradient id="rv-icon-black" cx="38%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#6b6b6b" />
          <stop offset="35%" stopColor="#2c2c2c" />
          <stop offset="100%" stopColor="#060606" />
        </radialGradient>
        <radialGradient id="rv-icon-white" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#ece6d8" />
          <stop offset="100%" stopColor="#bdb4a1" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="10" fill="#73492a" />
      <rect x="6" y="6" width="52" height="52" rx="4" fill="url(#rv-icon-felt)" />
      <path d="M32 6V58M6 32H58M19 6V58M45 6V58M6 19H58M6 45H58" stroke="#0f3f26" strokeOpacity="0.55" strokeWidth="1.2" />
      <circle cx="19" cy="20.5" r="10" fill="#000" opacity="0.4" />
      <circle cx="19" cy="19" r="10" fill="url(#rv-icon-black)" />
      <circle cx="45" cy="46.5" r="10" fill="#000" opacity="0.4" />
      <circle cx="45" cy="45" r="10" fill="url(#rv-icon-black)" />
      <circle cx="19" cy="46.5" r="10" fill="#7d7464" opacity="0.5" />
      <circle cx="19" cy="45" r="10" fill="url(#rv-icon-white)" />
      {/* 뒤집히는 중인 돌: 옆에서 본 납작한 타원, 반은 흑 반은 백 */}
      <ellipse cx="45" cy="20.5" rx="4.5" ry="10" fill="#000" opacity="0.3" />
      <path d="M45 9 a4.2 10 0 0 0 0 20Z" fill="url(#rv-icon-white)" />
      <path d="M45 9 a4.2 10 0 0 1 0 20Z" fill="url(#rv-icon-black)" />
      <path d="M52 14 q4 5 0 10" stroke="#ffd166" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M38 14 q-4 5 0 10" stroke="#ffd166" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
