import { useEffect, useRef } from 'react';
import { fmtMoney } from './format';
import { choiceBlocker } from './rules';
import type { AirlineState } from './types';

/** 결정 사건: 선택지마다 생기는 일을 미리 보여 주고 하나를 고른다 */
export function ChoiceModal({
  state,
  viewer,
  canAct,
  onChoose,
  onLater,
}: {
  state: AirlineState;
  viewer: number;
  canAct: boolean;
  onChoose: (option: number) => void;
  onLater: () => void;
}) {
  const ch = state.companies[viewer].choice;
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), [ch?.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onLater();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onLater]);
  if (!ch) return null;
  const from = ch.from !== undefined ? state.companies[ch.from] : null;
  return (
    <div className="overlay al-choice-overlay" role="dialog" aria-modal="true" aria-labelledby="al-choice-title">
      <div className="result-card al-choice" data-testid="al-choice">
        <div className="al-choice-icon" aria-hidden="true">
          {ch.icon}
        </div>
        <h2 id="al-choice-title">{ch.title}</h2>
        <p className="al-choice-text">{ch.text}</p>
        {from && <p className="al-muted">제안한 회사: {from.name}</p>}
        <ul className="al-choice-opts">
          {ch.options.map((o, i) => {
            const why = canAct ? choiceBlocker(state, viewer, i) : '내 차례에만 고를 수 있어요';
            return (
              <li key={i}>
                <button
                  ref={i === 0 ? first : undefined}
                  type="button"
                  className={`al-choice-opt${why ? '' : ' al-can'}`}
                  disabled={!!why}
                  onClick={() => onChoose(i)}
                  data-testid={`al-choice-${i}`}
                >
                  <b>{o.label}</b>
                  <span>{o.desc}</span>
                  {o.cost > 0 && <small className="al-choice-cost">드는 돈 {fmtMoney(o.cost)}</small>}
                  {why && <small className="al-why">{why}</small>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="result-actions">
          <button type="button" className="btn btn-ghost" onClick={onLater}>
            나중에 고를래요 <small className="al-muted">(안 고르면 차례를 마칠 때 ‘{ch.options[ch.options.length - 1].label}’)</small>
          </button>
        </div>
      </div>
    </div>
  );
}
