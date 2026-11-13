import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { digitPool } from './rules';
import type { NoteMark } from './types';

interface BatBoxProps {
  title: ReactNode;
  color: string;
  length: number;
  zero: boolean;
  entry: number[];
  /** 숫자를 넣을 수 있는지 */
  enabled: boolean;
  submitLabel: ReactNode;
  onDigit: (d: number) => void;
  onBack: () => void;
  onClear: () => void;
  onSubmit: () => void;
  /** 숫자 메모 (없으면 메모 줄을 그리지 않는다) */
  notes?: NoteMark[] | null;
  onNote?: (digit: number) => void;
  notice?: string | null;
  /** 추리 도우미 칸 */
  helper?: ReactNode;
  /** 제목 줄 오른쪽 (내 숫자 보기, 아무 숫자나 등) */
  extra?: ReactNode;
  /** 바뀔 때마다 칸이 흔들린다 (잘못 눌렀을 때) */
  shake: number;
  testId?: string;
}

/** 마우스로 누른 단추가 포커스를 가져가지 않게: 그래야 Enter가 언제나 '치기'가 된다 */
const keepFocus = (e: MouseEvent) => e.preventDefault();

const NOTE_LABEL: Record<NoteMark, string> = { 0: '모름', 1: '있다', 2: '없다' };

/** 타석: 숫자 칸, 숫자 단추, 메모 */
export function BatBox(props: BatBoxProps) {
  const { length, entry, enabled, notes } = props;
  const pool = digitPool(props.zero);
  const full = entry.length === length;
  return (
    <section className={`bb-bat${enabled ? ' bb-bat-on' : ''}`} style={{ '--team': props.color } as CSSProperties} data-testid={props.testId ?? 'bb-bat'}>
      <header className="bb-bat-head">
        <h2>{props.title}</h2>
        {props.extra}
      </header>

      <div className="bb-bat-body">
        <div className="bb-entry-wrap">
          <div key={props.shake} className={`bb-entry${props.shake > 0 ? ' bb-shake' : ''}`} aria-label={`넣은 숫자: ${entry.join(' ') || '없음'}`}>
            {Array.from({ length }, (_, i) => (
              <span key={i} className={['bb-slot', i < entry.length ? 'bb-slot-full' : '', enabled && i === entry.length ? 'bb-slot-next' : ''].join(' ')}>
                {entry[i] ?? ''}
              </span>
            ))}
          </div>
          <p className={`bb-notice${props.notice ? ' bb-notice-on' : ''}`} role="status">
            {props.notice ?? ''}
          </p>
          {props.helper}
        </div>

        <div className="bb-pad-wrap">
          <div className={`bb-pad bb-pad-${pool.length}`} role="group" aria-label="숫자 단추">
            {pool.map((d) => {
              const used = entry.includes(d);
              const mark = notes?.[d] ?? 0;
              return (
                <button
                  key={d}
                  type="button"
                  className={['bb-key', used ? 'bb-key-used' : '', mark === 2 ? 'bb-key-no' : '', mark === 1 ? 'bb-key-yes' : ''].join(' ')}
                  disabled={!enabled || used || full}
                  onClick={() => props.onDigit(d)}
                  onMouseDown={keepFocus}
                  aria-label={`${d}${mark ? ` (메모: ${NOTE_LABEL[mark]})` : ''}`}
                  data-testid={`bb-key-${d}`}
                >
                  {d}
                </button>
              );
            })}
            <button type="button" className="bb-key bb-key-fn" disabled={!enabled || entry.length === 0} onClick={props.onBack} onMouseDown={keepFocus} aria-label="한 칸 지우기" title="한 칸 지우기 (Backspace)">
              ⌫
            </button>
          </div>
          <div className="bb-pad-actions">
            <button type="button" className="btn" disabled={!enabled || entry.length === 0} onClick={props.onClear} onMouseDown={keepFocus} title="모두 지우기 (Esc)">
              지우기
            </button>
            <button type="button" className="btn btn-primary bb-submit" disabled={!enabled || !full} onClick={props.onSubmit} data-testid="bb-submit">
              {props.submitLabel} <kbd>Enter</kbd>
            </button>
          </div>
        </div>
      </div>

      {notes && props.onNote && (
        <div className="bb-memo" role="group" aria-label="숫자 메모">
          <span className="bb-memo-title" title="숫자를 누를 때마다 ○(있다) → ✕(없다) → 지우기">
            📝 메모 <small>Shift+숫자</small>
          </span>
          {pool.map((d) => (
            <button
              key={d}
              type="button"
              className={`bb-memo-chip bb-memo-${notes[d]}`}
              onClick={() => props.onNote!(d)}
              onMouseDown={keepFocus}
              aria-label={`${d} 메모: ${NOTE_LABEL[notes[d]]}`}
              data-testid={`bb-memo-${d}`}
            >
              <span>{d}</span>
              <i aria-hidden="true">{notes[d] === 1 ? '○' : notes[d] === 2 ? '✕' : ''}</i>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
