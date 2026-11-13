import { useEffect, useRef } from 'react';
import { Sheets, type PrintItem } from './PrintSheets';

export interface CurrentPrintOptions {
  withProgress: boolean;
  answers: boolean;
  header: boolean;
}

interface Props {
  item: PrintItem;
  options: CurrentPrintOptions;
  onOptions: (o: CurrentPrintOptions) => void;
  onPrint: () => void;
  onClose: () => void;
}

/** 게임 화면의 "지금 문제 인쇄": 빈 문제로 / 푼 데까지, 정답 쪽 넣기 */
export function PrintCurrentDialog({ item, options, onOptions, onPrint, onClose }: Props) {
  const printRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    printRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const shown: PrintItem = options.withProgress ? item : { ...item, progress: undefined };
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="sd-pc-title" onClick={onClose}>
      <div className="result-card sd-pc-card" onClick={(e) => e.stopPropagation()} data-testid="sd-print-dialog">
        <h2 id="sd-pc-title">🖨 지금 문제 인쇄</h2>
        <div className="sd-pc-body">
          <div className="sd-pc-options">
            <fieldset>
              <legend>무엇을 인쇄할까요?</legend>
              <label className="rule-item">
                <input type="radio" name="sd-pc-mode" checked={!options.withProgress} onChange={() => onOptions({ ...options, withProgress: false })} />
                <span>
                  <strong>빈 문제지</strong>
                  <small>처음 주어진 숫자만 인쇄해요.</small>
                </span>
              </label>
              <label className="rule-item">
                <input type="radio" name="sd-pc-mode" checked={options.withProgress} onChange={() => onOptions({ ...options, withProgress: true })} />
                <span>
                  <strong>지금까지 푼 데까지</strong>
                  <small>내가 넣은 숫자는 회색 기울임 글씨로 인쇄해요.</small>
                </span>
              </label>
            </fieldset>
            <label className="rule-item">
              <input type="checkbox" checked={options.answers} onChange={(e) => onOptions({ ...options, answers: e.target.checked })} />
              <span>
                <strong>정답 쪽도 함께</strong>
                <small>두 번째 쪽에 정답을 인쇄해요.</small>
              </span>
            </label>
            <label className="rule-item">
              <input type="checkbox" checked={options.header} onChange={(e) => onOptions({ ...options, header: e.target.checked })} />
              <span>
                <strong>이름·날짜 칸</strong>
                <small>맨 위에 제목과 이름·날짜 쓰는 줄을 넣어요.</small>
              </span>
            </label>
          </div>
          <div className="sd-preview sd-pc-preview" aria-label="인쇄 미리보기">
            <Sheets items={[shown]} perPage={1} answers={options.answers} header={options.header} title="스도쿠" paper />
          </div>
        </div>
        <div className="result-actions">
          <button ref={printRef} type="button" className="btn btn-primary" onClick={onPrint} data-testid="sd-print-current-go">
            🖨 인쇄하기
          </button>
          <button type="button" className="btn" onClick={onClose}>
            닫기 <kbd>Esc</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
