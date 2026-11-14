import { useEffect, useMemo, useRef, useState } from 'react';
import { ALL_CREDITS } from './images';

const KINDS: { id: 'all' | 'aircraft' | 'cities' | 'airlines'; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'aircraft', label: '기종' },
  { id: 'cities', label: '도시' },
  { id: 'airlines', label: '항공사' },
];

/** '사진 출처': 위키미디어 공용 사진마다 지은이·라이선스·원본 링크 */
export function CreditsModal({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('all');
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  const list = useMemo(() => ALL_CREDITS.filter((c) => kind === 'all' || c.key.startsWith(`${kind}/`)), [kind]);
  return (
    <div className="overlay al-credits-overlay" role="dialog" aria-modal="true" aria-labelledby="al-credits-title" onClick={onClose}>
      <div className="result-card al-credits" onClick={(e) => e.stopPropagation()} data-testid="al-credits">
        <h2 id="al-credits-title">📷 사진 출처</h2>
        <p className="al-muted">
          기종·도시·항공사 사진은 위키미디어 공용(Wikimedia Commons)에서 자유 라이선스로 공개된 사진을 작게 줄여 썼어요. 사진마다 지은이와 라이선스는 아래와 같아요. 항공사 로고는 쓰지 않았어요. 사진이 없는 곳은 직접 그린 그림을
          보여 줘요.
        </p>
        <div className="al-sort" role="group" aria-label="종류">
          {KINDS.map((k) => (
            <button key={k.id} type="button" className={`al-chip${kind === k.id ? ' al-on' : ''}`} onClick={() => setKind(k.id)}>
              {k.label} {k.id === 'all' ? ALL_CREDITS.length : ALL_CREDITS.filter((c) => c.key.startsWith(`${k.id}/`)).length}
            </button>
          ))}
        </div>
        {list.length === 0 ? (
          <p className="al-muted">아직 들어 있는 사진이 없어요.</p>
        ) : (
          <div className="al-credits-list">
            <table className="al-table">
              <thead>
                <tr>
                  <th>사진</th>
                  <th>지은이</th>
                  <th>라이선스</th>
                  <th>원본</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.key}>
                    <th>{c.title}</th>
                    <td>{c.author}</td>
                    <td>
                      {c.licenseUrl ? (
                        <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer">
                          {c.license}
                        </a>
                      ) : (
                        c.license
                      )}
                    </td>
                    <td>
                      <a href={c.source} target="_blank" rel="noopener noreferrer" title={c.file}>
                        위키미디어 공용
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="result-actions">
          <button ref={close} type="button" className="btn btn-primary" onClick={onClose} data-testid="al-credits-close">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
