import { useCallback, useEffect, useRef } from 'react';

/** 컴포넌트가 사라질 때 남은 타이머를 모두 정리해 주는 setTimeout */
export function useTimers() {
  const timers = useRef(new Set<number>());
  const alive = useRef(false);

  useEffect(() => {
    const set = timers.current;
    alive.current = true;
    return () => {
      alive.current = false;
      // 개발 모드(StrictMode)는 effect를 한 번 껐다가 바로 다시 켠다. 그때 건 타이머까지 지우지 않도록
      // 정말로 사라졌을 때(다시 켜지지 않았을 때)만 지운다.
      queueMicrotask(() => {
        if (alive.current) return;
        set.forEach((t) => window.clearTimeout(t));
        set.clear();
      });
    };
  }, []);

  return useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  }, []);
}
