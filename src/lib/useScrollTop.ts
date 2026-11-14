import { useEffect } from 'react';

/**
 * key가 바뀔 때마다 창을 맨 위로 올린다.
 * 설정 화면 맨 아래의 '게임 시작'을 눌러도 게임 화면은 맨 위부터 보이게 (좁은 화면에서 판이 가려지지 않게).
 * 예: useScrollTop('key' in screen ? screen.key : screen.type)
 */
export function useScrollTop(key: unknown): void {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [key]);
}
