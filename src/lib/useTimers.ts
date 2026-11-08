import { useCallback, useEffect, useRef } from 'react';

/** 컴포넌트가 사라질 때 남은 타이머를 모두 정리해 주는 setTimeout */
export function useTimers() {
  const timers = useRef(new Set<number>());

  useEffect(() => {
    const set = timers.current;
    return () => {
      set.forEach((t) => window.clearTimeout(t));
      set.clear();
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
