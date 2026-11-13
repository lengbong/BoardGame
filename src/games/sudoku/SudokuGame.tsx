import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useMusic } from '../../lib/useMusic';
import { useTimers } from '../../lib/useTimers';
import type { GameSettings } from '../common/settings';
import { Board, type CellFx, type FlashFx } from './Board';
import { UNITS, findConflicts } from './grid';
import { Panel, type MessageTone } from './Panel';
import { PrintCurrentDialog, type CurrentPrintOptions } from './PrintCurrentDialog';
import { PrintPortal, type PrintItem } from './PrintSheets';
import { enterPrintMode, exitPrintMode, printWithMode } from './printing';
import { Results } from './Results';
import { applyAction, digitCounts, digitJosa, givenMask, wrongCells } from './rules';
import { SUDOKU_SONG } from './song';
import { sdSfx } from './sounds';
import { clearSavedGame, saveGame } from './storage';
import type { Difficulty, MistakeMode, SudokuAction, SudokuState } from './types';

interface SudokuGameProps {
  initialState: SudokuState;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  /** 다 풀었을 때 기록을 남기고 새 최고 기록인지 알려 준다 */
  onSolved: (difficulty: Difficulty, ms: number, hints: number) => { newBest: boolean; bestMs: number | null };
  onNext: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

interface PrintJob {
  item: PrintItem;
  answers: boolean;
  header: boolean;
}

const DIGIT_CODES: Record<string, number> = {};
for (let d = 1; d <= 9; d++) {
  DIGIT_CODES[`Digit${d}`] = d;
  DIGIT_CODES[`Numpad${d}`] = d;
}

function firstEmpty(state: SudokuState): number {
  const i = state.values.findIndex((v) => v === 0);
  return i >= 0 ? i : 40;
}

export function SudokuGame({ initialState, settings, onSettings, onSolved, onNext, onChangeSetup, onExit }: SudokuGameProps) {
  const [game, setGame] = useState<SudokuState>(initialState);
  const [selected, setSelected] = useState(() => firstEmpty(initialState));
  const [notesMode, setNotesMode] = useState(false);
  const [paused, setPaused] = useState(false);
  const [fx, setFx] = useState<CellFx | null>(null);
  const [flash, setFlash] = useState<FlashFx | null>(null);
  const [hintUnit, setHintUnit] = useState<{ unit: number; seq: number } | null>(null);
  const [transient, setTransient] = useState<{ text: string; tone: MessageTone } | null>(null);
  const [result, setResult] = useState<{ newBest: boolean; bestMs: number | null } | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printOpts, setPrintOpts] = useState<CurrentPrintOptions>({ withProgress: false, answers: false, header: true });
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);
  const later = useTimers();
  const seq = useRef(1);
  const gameRef = useRef(game);
  gameRef.current = game;
  const printJobRef = useRef(printJob);
  printJobRef.current = printJob;

  useMusic(SUDOKU_SONG, settings.music);

  const act = useCallback((action: SudokuAction) => setGame((g) => applyAction(g, action)), []);

  const playing = game.status === 'playing';
  const given = givenMask(game.puzzle);
  const conflicts = useMemo(() => findConflicts(game.values), [game.values]);
  const allWrong = useMemo(() => wrongCells({ puzzle: game.puzzle, values: game.values }), [game.puzzle, game.values]);
  const wrong = game.mistakeMode === 'instant' || game.showWrong ? allWrong : EMPTY_SET;
  const counts = useMemo(() => digitCounts(game.values), [game.values]);
  const empty = 81 - counts.reduce((a, b) => a + b, 0);

  // ---------------------------------------------------------------- 저장
  const lastSave = useRef(0);
  const lastMode = useRef(game.mistakeMode);
  useEffect(() => {
    if (game.status === 'solved') {
      clearSavedGame();
      return;
    }
    const now = Date.now();
    const important = game.events.length > 0 || lastMode.current !== game.mistakeMode;
    lastMode.current = game.mistakeMode;
    if (!important && now - lastSave.current < 5000) return;
    saveGame(game);
    lastSave.current = now;
  }, [game]);
  useEffect(() => {
    const flush = () => {
      if (gameRef.current.status === 'playing') saveGame(gameRef.current);
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  // ---------------------------------------------------------------- 시계
  const timerRunning = playing && !paused && !resultOpen;
  useEffect(() => {
    if (!timerRunning) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const d = now - last;
      last = now;
      setGame((g) => applyAction(g, { type: 'tick', ms: d }));
    }, 1000);
    return () => {
      window.clearInterval(id);
      const d = performance.now() - last;
      if (d > 30) setGame((g) => applyAction(g, { type: 'tick', ms: d }));
    };
  }, [timerRunning]);

  // 다른 창으로 가면 저절로 쉬기
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && gameRef.current.status === 'playing') setPaused(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ---------------------------------------------------------------- 소리와 연출
  const prevGame = useRef<SudokuState | null>(null);
  useEffect(() => {
    const before = prevGame.current;
    prevGame.current = game;
    if (!before || before === game || game.events.length === 0) return;
    let msg: { text: string; tone: MessageTone } | null = null;
    for (const e of game.events) {
      switch (e.type) {
        case 'place': {
          const showError = e.conflict || (e.wrong && game.mistakeMode === 'instant');
          if (showError) sdSfx.error();
          else sdSfx.place(e.digit);
          setFx({ cell: e.cell, kind: showError ? 'shake' : 'pop', seq: seq.current++ });
          if (e.conflict) msg = { text: `같은 줄·열·3×3 칸에 ${digitJosa(e.digit, '이/가')} 벌써 있어요.`, tone: 'warn' };
          else if (e.wrong && game.mistakeMode === 'instant') msg = { text: '앗, 그 칸에는 다른 숫자가 들어가요. 다시 생각해 봐요!', tone: 'warn' };
          break;
        }
        case 'note':
          sdSfx.note(e.on);
          setFx({ cell: e.cell, kind: 'pop', seq: seq.current++ });
          break;
        case 'erase':
          sdSfx.erase();
          break;
        case 'fillNotes':
          sdSfx.fill();
          msg = { text: `빈칸 ${e.count}곳에 들어갈 수 있는 후보 숫자를 모두 적었어요.`, tone: 'info' };
          break;
        case 'hint': {
          sdSfx.hint();
          setSelected(e.hint.cell);
          setFx({ cell: e.hint.cell, kind: 'hint', seq: seq.current++ });
          const s = seq.current++;
          setHintUnit(e.hint.unit === null ? null : { unit: e.hint.unit, seq: s });
          later(() => setHintUnit((h) => (h && h.seq === s ? null : h)), 3200);
          break;
        }
        case 'undo':
          sdSfx.undo();
          break;
        case 'redo':
          sdSfx.redo();
          break;
        case 'reset':
          sdSfx.erase();
          break;
        case 'unitDone': {
          const cells = new Map<number, number>();
          for (const u of e.units) UNITS[u].forEach((c, k) => cells.set(c, Math.min(cells.get(c) ?? 99, k)));
          const s = seq.current++;
          setFlash({ cells, seq: s });
          later(() => setFlash((f) => (f && f.seq === s ? null : f)), 1100);
          later(() => sdSfx.unit(e.units.length), 120);
          if (!msg && !game.events.some((x) => x.type === 'hint')) {
            const names = e.units.map((u) => (u < 9 ? '가로줄' : u < 18 ? '세로줄' : '3×3 칸'));
            msg = { text: `✨ ${[...new Set(names)].join('·')}을 다 채웠어요!`, tone: 'good' };
          }
          break;
        }
        case 'checkFailed':
          sdSfx.check();
          msg = { text: `다 채웠지만 틀린 칸이 ${e.wrong}곳 있어요. 빨간 칸을 고쳐 보세요.`, tone: 'warn' };
          break;
        case 'complete': {
          later(() => sdSfx.complete(), 250);
          const r = onSolved(game.puzzle.difficulty, game.elapsedMs, game.hintsUsed);
          setResult(r);
          later(() => setResultOpen(true), 900);
          break;
        }
        case 'blocked':
          sdSfx.blocked();
          msg = {
            text: e.reason === 'given' ? '처음부터 있던 숫자는 바꿀 수 없어요.' : e.reason === 'filled' ? '숫자가 있는 칸에는 메모를 할 수 없어요. 먼저 지워 주세요.' : '이미 다 풀었어요!',
            tone: 'info',
          };
          break;
      }
    }
    setTransient(msg);
  }, [game, later, onSolved]);

  // ---------------------------------------------------------------- 조작
  const enterDigit = useCallback(
    (digit: number, asNote: boolean) => {
      if (selected < 0) return;
      act(asNote ? { type: 'note', cell: selected, digit } : { type: 'place', cell: selected, digit });
    },
    [act, selected],
  );

  const move = useCallback((dr: number, dc: number) => {
    setSelected((s) => {
      const cur = s < 0 ? 40 : s;
      const r = (Math.floor(cur / 9) + dr + 9) % 9;
      const c = ((cur % 9) + dc + 9) % 9;
      return r * 9 + c;
    });
  }, []);

  const togglePause = useCallback(() => {
    if (gameRef.current.status !== 'playing') return;
    setPaused((p) => !p);
  }, []);

  const hint = useCallback(() => act({ type: 'hint', cell: selected }), [act, selected]);
  const erase = useCallback(() => selected >= 0 && act({ type: 'erase', cell: selected }), [act, selected]);

  // 키보드
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (printOpen || resultOpen || e.altKey) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.code === 'KeyP' && !ctrl) {
      e.preventDefault();
      togglePause();
      return;
    }
    if (paused || !playing) return;
    if (ctrl) {
      if (e.code === 'KeyZ') {
        e.preventDefault();
        act({ type: e.shiftKey ? 'redo' : 'undo' });
      } else if (e.code === 'KeyY') {
        e.preventDefault();
        act({ type: 'redo' });
      }
      return;
    }
    const digit = DIGIT_CODES[e.code];
    if (digit) {
      e.preventDefault();
      enterDigit(digit, notesMode || e.shiftKey);
      return;
    }
    switch (e.code) {
      case 'ArrowUp':
        e.preventDefault();
        move(-1, 0);
        return;
      case 'ArrowDown':
        e.preventDefault();
        move(1, 0);
        return;
      case 'ArrowLeft':
        e.preventDefault();
        move(0, -1);
        return;
      case 'ArrowRight':
        e.preventDefault();
        move(0, 1);
        return;
      case 'Backspace':
      case 'Delete':
      case 'Digit0':
      case 'Numpad0':
        e.preventDefault();
        erase();
        return;
      case 'KeyN':
        e.preventDefault();
        setNotesMode((n) => !n);
        return;
      case 'KeyH':
        e.preventDefault();
        hint();
        return;
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // ---------------------------------------------------------------- 인쇄
  const currentItem: PrintItem = useMemo(
    () => ({ difficulty: game.puzzle.difficulty, seed: game.puzzle.seed, puzzle: game.puzzle, progress: game.values }),
    [game.puzzle, game.values],
  );
  const doPrint = useCallback(() => {
    const job: PrintJob = {
      item: printOpts.withProgress ? currentItem : { ...currentItem, progress: undefined },
      answers: printOpts.answers,
      header: printOpts.header,
    };
    setPrintOpen(false);
    flushSync(() => setPrintJob(job));
    printWithMode(() => setPrintJob(null));
  }, [currentItem, printOpts]);

  // Ctrl+P로 인쇄해도 앱 화면 대신 지금 문제(빈 문제지)가 나오게 한다.
  useEffect(() => {
    let auto = false;
    const before = () => {
      if (printJobRef.current) return;
      const g = gameRef.current;
      auto = true;
      flushSync(() => setPrintJob({ item: { difficulty: g.puzzle.difficulty, seed: g.puzzle.seed, puzzle: g.puzzle }, answers: false, header: true }));
      enterPrintMode();
    };
    const after = () => {
      if (!auto) return;
      auto = false;
      exitPrintMode();
      setPrintJob(null);
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
      exitPrintMode();
    };
  }, []);

  // ---------------------------------------------------------------- 안내 문구
  let message: string;
  let tone: MessageTone = 'info';
  if (!playing) {
    message = '다 풀었어요! 🎉 새 문제에 도전해 볼까요?';
    tone = 'good';
  } else if (paused) {
    message = '잠깐 쉬는 중이에요. 판을 가려 두었어요.';
  } else if (transient) {
    message = transient.text;
    tone = transient.tone;
  } else if (game.lastHint) {
    message = `💡 ${game.lastHint.message}`;
    tone = 'hint';
  } else if (game.showWrong && allWrong.size > 0) {
    message = `틀린 칸이 ${allWrong.size}곳 있어요. 빨간 칸을 고쳐 보세요.`;
    tone = 'warn';
  } else if (conflicts.size > 0) {
    message = '빨간 칸은 같은 줄·열·3×3 칸에 같은 숫자가 겹쳐 있어요.';
    tone = 'warn';
  } else if (notesMode) {
    message = '메모 모드예요. 숫자를 누르면 작은 후보 숫자를 적거나 지워요. (N으로 끄기)';
  } else if (selected >= 0 && given[selected]) {
    message = '처음부터 있던 숫자예요. 빈칸을 골라 숫자를 넣어요.';
  } else {
    message = '칸을 고르고 숫자를 넣어요. 가로줄·세로줄·3×3 칸에 같은 숫자가 없어야 해요.';
  }

  const selectCell = useCallback((i: number) => setSelected(i), []);

  return (
    <div className="sd-game" data-testid="sd-game">
      <div className="sd-main">
        <div className="sd-board-wrap">
          <Board
            puzzle={game.puzzle}
            values={game.values}
            notes={game.notes}
            hinted={game.hinted}
            selected={paused ? -1 : selected}
            hidden={paused}
            wrong={wrong}
            conflicts={conflicts}
            fx={fx}
            flash={flash}
            hintUnit={hintUnit?.unit ?? null}
            onSelect={selectCell}
          />
          {paused && (
            <div className="sd-pause" data-testid="sd-paused">
              <div className="sd-pause-card">
                <div className="sd-pause-icon" aria-hidden="true">
                  ☕
                </div>
                <strong>잠깐 쉬는 중</strong>
                <span>시계도 멈췄어요.</span>
                <button type="button" className="btn btn-primary" onClick={togglePause} autoFocus>
                  ▶ 계속하기 <kbd>P</kbd>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Panel
        state={game}
        settings={settings}
        onSettings={onSettings}
        paused={paused}
        notesMode={notesMode}
        message={message}
        tone={tone}
        counts={counts}
        empty={empty}
        onPause={togglePause}
        onToggleNotes={() => setNotesMode((n) => !n)}
        onDigit={(d) => enterDigit(d, notesMode)}
        onErase={erase}
        onUndo={() => act({ type: 'undo' })}
        onRedo={() => act({ type: 'redo' })}
        onHint={hint}
        onFillNotes={() => act({ type: 'fillNotes' })}
        onPrint={() => setPrintOpen(true)}
        onMistakeMode={(mode: MistakeMode) => act({ type: 'setMistakeMode', mode })}
        onNewGame={onChangeSetup}
        onExit={onExit}
      />
      {resultOpen && result && (
        <Results
          state={game}
          newBest={result.newBest}
          bestMs={result.bestMs}
          onNext={onNext}
          onChangeSetup={onChangeSetup}
          onExit={onExit}
          onClose={() => setResultOpen(false)}
        />
      )}
      {printOpen && (
        <PrintCurrentDialog item={currentItem} options={printOpts} onOptions={setPrintOpts} onPrint={doPrint} onClose={() => setPrintOpen(false)} />
      )}
      {printJob && <PrintPortal items={[printJob.item]} perPage={1} answers={printJob.answers} header={printJob.header} title="스도쿠" />}
    </div>
  );
}

const EMPTY_SET: ReadonlySet<number> = new Set();
