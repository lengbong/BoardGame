/** 게임 목록 카드에 쓰는 만칼라 그림: 나무판, 구멍, 씨앗 */
export function MancalaIcon() {
  const seeds: [number, number, string][] = [
    [22, 24, '#e5484d'],
    [27, 27, '#f5b400'],
    [22, 30, '#3e63dd'],
    [42, 24, '#30a46c'],
    [37, 28, '#e5484d'],
    [22, 44, '#f5b400'],
    [42, 42, '#3e63dd'],
    [38, 45, '#e5484d'],
  ];
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect x="4" y="12" width="56" height="40" rx="18" fill="#b9793f" stroke="#7a4a22" strokeWidth="3" />
      {[24, 40].map((cx) => [27, 43].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="7.5" fill="#7a4a22" opacity="0.75" />))}
      <ellipse cx="11" cy="32" rx="4" ry="11" fill="#7a4a22" opacity="0.75" />
      <ellipse cx="53" cy="32" rx="4" ry="11" fill="#7a4a22" opacity="0.75" />
      {seeds.map(([x, y, c], i) => (
        <circle key={i} cx={x} cy={y} r="2.6" fill={c} stroke="rgba(0,0,0,0.3)" strokeWidth="0.6" />
      ))}
    </svg>
  );
}
