import { useEffect, useRef, useState } from 'react';

/** 숫자가 바뀌면 이전 값에서 새 값까지 부드럽게 세어 올라간다/내려간다. */
export function useAnimatedNumber(value: number, duration = 650): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const shownRef = useRef(value);

  useEffect(() => {
    from.current = shownRef.current;
    if (from.current === value) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from.current + (value - from.current) * eased);
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return shown;
}

export interface Floater {
  id: number;
  playerIndex: number;
  amount: number;
  square: number;
}
