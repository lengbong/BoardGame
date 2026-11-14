import { useEffect, useState } from 'react';
import type { GuideStep } from '../games/guides';
import { loadJson, saveJson } from '../lib/storage';

const SEEN_KEY = 'family-boardgame.guides-seen.v1';

function loadSeen(): string[] {
  const v = loadJson<string[]>(SEEN_KEY);
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
}

export function hasSeenGuide(gameId: string): boolean {
  return loadSeen().includes(gameId);
}

function markSeen(gameId: string): void {
  const seen = loadSeen();
  if (!seen.includes(gameId)) saveJson(SEEN_KEY, [...seen, gameId]);
}

interface FirstGuideProps {
  gameId: string;
  title: string;
  steps: GuideStep[];
  onClose: () => void;
}

/** 처음 하는 사람을 위한 안내: 그림 한 장씩 넘겨 보는 카드. ←→·Enter로 넘기고 Esc로 닫는다 */
export function FirstGuide({ gameId, title, steps, onClose }: FirstGuideProps) {
  const [i, setI] = useState(0);
  const last = i === steps.length - 1;
  const step = steps[i];

  const close = () => {
    markSeen(gameId);
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (last) close();
        else setI(i + 1);
      } else if (e.key === 'ArrowLeft' && i > 0) setI(i - 1);
    };
    // 게임의 키보드 조작보다 먼저 받는다
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  return (
    <div className="overlay guide-overlay" role="dialog" aria-modal="true" aria-labelledby="guide-title" data-testid="guide">
      <div className="result-card guide-card">
        <p className="guide-game">{title} · 이렇게 해요</p>
        <div className="guide-art" key={i} aria-hidden="true">
          {step.art}
        </div>
        <h2 id="guide-title">{step.title}</h2>
        <p className="guide-text">{step.text}</p>
        <div className="guide-dots" aria-label={`${steps.length}장 중 ${i + 1}번째`}>
          {steps.map((_, k) => (
            <span key={k} className={k === i ? 'guide-dot-on' : ''} />
          ))}
        </div>
        <div className="result-actions">
          {i > 0 && (
            <button type="button" className="btn" onClick={() => setI(i - 1)}>
              ← 앞으로
            </button>
          )}
          {!last && (
            <button type="button" className="btn btn-ghost" onClick={close} data-testid="guide-skip">
              건너뛰기
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => (last ? close() : setI(i + 1))} data-testid="guide-next" autoFocus>
            {last ? '알겠어요, 시작!' : '다음 →'}
          </button>
        </div>
      </div>
    </div>
  );
}
