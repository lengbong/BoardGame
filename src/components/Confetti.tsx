import { useMemo } from 'react';

const CONFETTI_COLORS = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#f78c6b', '#c77dff'];

/** 우승 축하 꽃가루 (CSS 애니메이션만 사용) */
export function Confetti({ count = 90 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        // 고정된 의사 난수: 다시 그려도 모양이 바뀌지 않게
        const r = (n: number) => {
          const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
          return x - Math.floor(x);
        };
        return {
          left: r(1) * 100,
          delay: r(2) * 1.2,
          duration: 2.4 + r(3) * 1.8,
          size: 6 + r(4) * 6,
          drift: (r(5) - 0.5) * 160,
          spin: 360 + r(6) * 720,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          round: r(7) > 0.6,
        };
      }),
    [count],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.round ? p.size : p.size * 0.45,
              background: p.color,
              borderRadius: p.round ? '50%' : 2,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
