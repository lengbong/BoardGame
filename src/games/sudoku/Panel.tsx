import type { MouseEvent } from 'react';
import { GameControls } from '../../components/GameControls';
import type { GameSettings } from '../common/settings';
import { DIFFICULTY_INFO } from './generator';
import { formatTime } from './storage';
import type { MistakeMode, SudokuState } from './types';

export type MessageTone = 'info' | 'warn' | 'hint' | 'good';

interface PanelProps {
  state: SudokuState;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  paused: boolean;
  notesMode: boolean;
  message: string;
  tone: MessageTone;
  counts: number[];
  empty: number;
  onPause: () => void;
  onToggleNotes: () => void;
  onDigit: (digit: number) => void;
  onErase: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onHint: () => void;
  onFillNotes: () => void;
  onPrint: () => void;
  onMistakeMode: (mode: MistakeMode) => void;
  onNewGame: () => void;
  onExit: () => void;
}

const PAD = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** 마우스로 누를 때는 포커스를 가져가지 않는다 (키보드로 계속 칸을 옮기고 숫자를 넣을 수 있게). Tab으로는 그대로 고를 수 있다. */
const keepFocus = (e: MouseEvent) => e.preventDefault();

/** 도구 단추 그림 (직접 그린 선 그림) */
function ToolIcon({ name }: { name: 'undo' | 'redo' | 'erase' | 'pencil' | 'bulb' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg className="sd-tool-icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'undo' && (
        <>
          <path d="M9 7H4V2" {...common} />
          <path d="M4.5 7.5A8 8 0 1 1 6 18" {...common} />
        </>
      )}
      {name === 'redo' && (
        <>
          <path d="M15 7h5V2" {...common} />
          <path d="M19.5 7.5A8 8 0 1 0 18 18" {...common} />
        </>
      )}
      {name === 'erase' && (
        <>
          <path d="M8 20h12" {...common} />
          <path d="M4.6 14.6l9.2-9.2a2 2 0 0 1 2.8 0l2.8 2.8a2 2 0 0 1 0 2.8L12 18.4a2 2 0 0 1-1.4.6H8.2a2 2 0 0 1-1.4-.6l-2.2-2.2a1.2 1.2 0 0 1 0-1.6z" {...common} />
          <path d="M9 10l5 5" {...common} />
        </>
      )}
      {name === 'pencil' && (
        <>
          <path d="M15.5 4.5l4 4L9 19l-5 1 1-5z" {...common} />
          <path d="M13.5 6.5l4 4" {...common} />
        </>
      )}
      {name === 'bulb' && (
        <>
          <path d="M9 17h6M10 21h4" {...common} />
          <path d="M8.5 14.5A6 6 0 1 1 15.5 14.5c-.8.7-1 1.4-1 2.5h-5c0-1.1-.2-1.8-1-2.5z" fill="#ffd54a" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}


export function Panel(props: PanelProps) {
  const { state, paused, notesMode } = props;
  const info = DIFFICULTY_INFO[state.puzzle.difficulty];
  const playing = state.status === 'playing';
  const locked = paused || !playing;
  return (
    <aside className="panel sd-panel">
      <section className="sd-status">
        <div className="sd-status-top">
          <span className={`sd-diff-chip sd-diff-${state.puzzle.difficulty}`}>{info.label}</span>
          <span className="sd-code">
            문제 번호 <b data-testid="sd-code">{state.puzzle.id}</b>
          </span>
        </div>
        <div className="sd-timer-row">
          <span className="sd-timer" role="timer" aria-label={`걸린 시간 ${formatTime(state.elapsedMs)}`} data-testid="sd-timer">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 13V9M10 2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {formatTime(state.elapsedMs)}
          </span>
          <button type="button" className="btn btn-small" onClick={props.onPause} disabled={!playing} data-testid="sd-pause">
            {paused ? '▶ 계속하기' : '⏸ 잠깐 쉬기'} <kbd>P</kbd>
          </button>
        </div>
        <div className="sd-stats">
          <span>
            빈칸 <b data-testid="sd-empty">{props.empty}</b>
          </span>
          <span>
            힌트 <b>{state.hintsUsed}</b>
          </span>
          {state.mistakeMode === 'instant' && (
            <span>
              실수 <b>{state.mistakes}</b>
            </span>
          )}
        </div>
        <p className={`hint sd-message sd-msg-${props.tone}`} aria-live="polite" data-testid="sd-message">
          {props.message}
        </p>
      </section>

      <section className="sd-tools" aria-label="도구">
        <button type="button" className="sd-tool" onMouseDown={keepFocus} onClick={props.onUndo} disabled={locked || state.undo.length === 0} data-testid="sd-undo">
          <ToolIcon name="undo" />
          <span>되돌리기</span>
          <kbd>Ctrl+Z</kbd>
        </button>
        <button type="button" className="sd-tool" onMouseDown={keepFocus} onClick={props.onRedo} disabled={locked || state.redo.length === 0} data-testid="sd-redo">
          <ToolIcon name="redo" />
          <span>다시 하기</span>
          <kbd>Ctrl+Y</kbd>
        </button>
        <button type="button" className="sd-tool" onMouseDown={keepFocus} onClick={props.onErase} disabled={locked} data-testid="sd-erase">
          <ToolIcon name="erase" />
          <span>지우기</span>
          <kbd>Del</kbd>
        </button>
        <button
          type="button"
          className={`sd-tool${notesMode ? ' sd-tool-on' : ''}`}
          onMouseDown={keepFocus}
          onClick={props.onToggleNotes}
          disabled={locked}
          aria-pressed={notesMode}
          data-testid="sd-notes-toggle"
        >
          <ToolIcon name="pencil" />
          <span>{notesMode ? '메모 ✓' : '메모'}</span>
          <kbd>N</kbd>
        </button>
        <button type="button" className="sd-tool" onMouseDown={keepFocus} onClick={props.onHint} disabled={locked} data-testid="sd-hint">
          <ToolIcon name="bulb" />
          <span>힌트</span>
          <kbd>H</kbd>
        </button>
      </section>

      <section className={`sd-pad-section${notesMode ? ' sd-pad-notes' : ''}`} aria-label="숫자 넣기">
        <div className="sd-pad-head">
          <strong>{notesMode ? '✎ 메모 적는 중' : '숫자 넣기'}</strong>
          <small>
            <kbd>1</kbd>~<kbd>9</kbd> · 메모 <kbd>Shift</kbd>+숫자
          </small>
        </div>
        <div className="sd-pad">
          {PAD.map((d) => {
            const left = Math.max(0, 9 - props.counts[d]);
            return (
              <button
                key={d}
                type="button"
                className={`sd-pad-btn${left === 0 ? ' sd-pad-done' : ''}`}
                onMouseDown={keepFocus}
                onClick={() => props.onDigit(d)}
                disabled={locked}
                aria-label={`${d} ${notesMode ? '메모' : '넣기'}, ${left}개 남음`}
                data-testid={`sd-pad-${d}`}
              >
                <span className="sd-pad-digit">{d}</span>
                <span className="sd-pad-left">{left === 0 ? '✓ 다 씀' : `${left}개 남음`}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="sd-extras">
        <button type="button" className="btn btn-small" onMouseDown={keepFocus} onClick={props.onFillNotes} disabled={locked} data-testid="sd-fill-notes" title="빈칸마다 들어갈 수 있는 후보 숫자를 모두 메모해요">
          ✎ 후보 모두 채우기
        </button>
        <button type="button" className="btn btn-small" onMouseDown={keepFocus} onClick={props.onPrint} data-testid="sd-print-current">
          🖨 지금 문제 인쇄
        </button>
        <label className="sd-mode-select">
          틀린 숫자
          <select value={state.mistakeMode} onChange={(e) => props.onMistakeMode(e.target.value as MistakeMode)} disabled={!playing}>
            <option value="instant">바로 표시</option>
            <option value="end">다 채운 뒤 확인</option>
          </select>
        </label>
      </section>

      <GameControls settings={props.settings} onSettings={props.onSettings} showSpeed={false} onNewGame={props.onNewGame} onExit={props.onExit} />
    </aside>
  );
}
