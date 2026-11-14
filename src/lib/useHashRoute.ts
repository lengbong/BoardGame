import { useCallback, useEffect, useState } from 'react';

/** 주소의 '#/omok' 부분에서 게임 id를 읽는다. 없으면 null */
export function parseRoute(hash: string): string | null {
  const m = /^#\/([a-z0-9-]+)$/.exec(hash);
  return m ? m[1] : null;
}

/**
 * 주소 끝의 '#/게임'으로 지금 화면을 기억한다.
 * 덕분에 브라우저의 뒤로 가기(휴대폰의 뒤로 단추)로 게임 목록에 돌아오고, 새로고침해도 하던 게임 화면에 남는다.
 * 파일을 더블클릭해서 연(file://) 경우에도 동작한다.
 */
export function useHashRoute(): [string | null, (id: string | null) => void] {
  const [route, setRoute] = useState<string | null>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const go = useCallback((id: string | null) => {
    if (id !== null) {
      window.location.hash = `/${id}`;
    } else if (parseRoute(window.location.hash) !== null) {
      // 목록에서 들어온 게임이면 뒤로 가기와 똑같이 돌아간다 (기록이 쌓이지 않게). 주소로 바로 들어왔으면 주소만 지운다.
      if (window.history.state?.fromHub) window.history.back();
      else window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setRoute(id);
  }, []);

  return [route, go];
}

/** 목록에서 게임을 열 때: 기록에 '목록에서 왔음'을 남긴다 */
export function openFromHub(id: string): void {
  window.history.pushState({ fromHub: true }, '', `#/${id}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
