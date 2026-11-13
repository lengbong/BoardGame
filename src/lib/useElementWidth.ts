import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

/**
 * 요소의 너비(px)를 따라간다. ResizeObserver가 없으면 처음 너비만 잰다.
 * 요소가 처음에는 없다가 나중에 나타나거나(가림 화면이 걷힐 때 등) 다른 요소로 바뀌어도 따라간다.
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  const [el, setEl] = useState<HTMLElement | null>(null);

  // 그릴 때마다 ref가 가리키는 요소가 바뀌었는지 본다. (바뀔 때만 다시 그리므로 반복되지 않는다)
  useLayoutEffect(() => {
    if (ref.current !== el) setEl(ref.current);
  });

  useEffect(() => {
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  return width;
}
