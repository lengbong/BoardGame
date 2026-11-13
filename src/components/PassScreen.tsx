import { useEffect } from 'react';

interface PassScreenProps {
  /** 다음 차례인 사람 이름 */
  name: string;
  /** 그 사람의 색 (테두리·버튼) */
  color: string;
  /** 무엇을 보게 되는지 (기본 '내 카드') */
  what?: string;
  /** 덧붙일 말 (예: 지난 차례에 일어난 일) */
  note?: string;
  onReveal: () => void;
}

/**
 * 차례 넘김 화면: 사람이 2명 이상이고 서로 숨겨야 하는 게임에서,
 * 다음 사람이 컴퓨터 앞에 앉을 때까지 화면을 가린다. Enter나 Space로도 넘어간다.
 * 부모 요소를 덮도록 position: absolute로 그린다 (부모에 position: relative 필요).
 */
export function PassScreen({ name, color, what = '내 카드', note, onReveal }: PassScreenProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onReveal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onReveal]);

  return (
    <div className="pass-screen" role="dialog" aria-modal="true" aria-label={`${name} 차례`}>
      <div className="pass-card" style={{ borderColor: color }}>
        <div className="pass-eyes" aria-hidden="true">
          🙈
        </div>
        <h2>
          <span className="dot" style={{ background: color }} /> {name} 차례예요
        </h2>
        <p>다른 사람은 잠깐 눈을 감거나 고개를 돌려 주세요.</p>
        {note && <p className="pass-note">{note}</p>}
        <button type="button" className="btn btn-primary btn-large" style={{ background: color, borderColor: color }} onClick={onReveal} data-testid="pass-reveal">
          {what} 보기 <kbd>Enter</kbd>
        </button>
      </div>
    </div>
  );
}
