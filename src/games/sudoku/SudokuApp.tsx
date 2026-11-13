import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameSettings } from '../common/settings';
import { getPuzzle, randomSeed } from './generator';
import { PrintStudio } from './PrintStudio';
import { createGame } from './rules';
import {
  SETTINGS_KEY,
  loadRecords,
  loadSavedGame,
  loadSetup,
  recordSolve,
  saveRecords,
  saveSetup,
  type SavedSudokuGame,
  type SudokuRecords,
} from './storage';
import { SudokuGame } from './SudokuGame';
import { SudokuSetup } from './SudokuSetup';
import type { Difficulty, SudokuSetup as Setup, SudokuState } from './types';
import './sudoku.css';

type Screen = { type: 'setup'; busy: boolean } | { type: 'game'; state: SudokuState; key: number } | { type: 'print' };

export function SudokuApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useGameSettings(SETTINGS_KEY);
  const [setup, setSetup] = useState<Setup>(loadSetup);
  const [saved, setSaved] = useState<SavedSudokuGame | null>(loadSavedGame);
  const [records, setRecords] = useState<SudokuRecords>(loadRecords);
  const [screen, setScreen] = useState<Screen>({ type: 'setup', busy: false });
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const genTimer = useRef(0);

  useEffect(() => saveSetup(setup), [setup]);
  useEffect(() => () => window.clearTimeout(genTimer.current), []);

  /** 문제 만들기는 잠깐 걸릴 수 있어서 "만드는 중" 화면을 먼저 그린 뒤에 만든다. */
  const startPuzzle = useCallback((difficulty: Difficulty, seed: number, mistakeMode: Setup['mistakeMode']) => {
    setScreen({ type: 'setup', busy: true });
    window.clearTimeout(genTimer.current);
    genTimer.current = window.setTimeout(() => {
      const puzzle = getPuzzle(difficulty, seed);
      setScreen({ type: 'game', state: createGame(puzzle, mistakeMode), key: Date.now() });
    }, 30);
  }, []);

  const start = (s: Setup) => {
    setSetup(s);
    startPuzzle(s.difficulty, randomSeed(), s.mistakeMode);
  };

  const backToSetup = useCallback(() => {
    setSaved(loadSavedGame());
    setRecords(loadRecords());
    setScreen({ type: 'setup', busy: false });
  }, []);

  const onSolved = useCallback((difficulty: Difficulty, ms: number, hints: number) => {
    const { records: next, newBest } = recordSolve(recordsRef.current, difficulty, ms, hints);
    saveRecords(next);
    setRecords(next);
    return { newBest, bestMs: next[difficulty].bestMs };
  }, []);

  if (screen.type === 'game') {
    const difficulty = screen.state.puzzle.difficulty;
    return (
      <div className="sd-app">
        <SudokuGame
          key={screen.key}
          initialState={screen.state}
          settings={settings}
          onSettings={setSettings}
          onSolved={onSolved}
          onNext={() => startPuzzle(difficulty, randomSeed(), screen.state.mistakeMode)}
          onChangeSetup={backToSetup}
          onExit={onExit}
        />
      </div>
    );
  }

  if (screen.type === 'print') {
    return (
      <div className="sd-app">
        <PrintStudio onBack={backToSetup} />
      </div>
    );
  }

  return (
    <div className="sd-app">
      <SudokuSetup
        setup={setup}
        onSetup={setSetup}
        saved={saved}
        records={records}
        busy={screen.busy}
        onStart={start}
        onOpenCode={(difficulty, seed) => startPuzzle(difficulty, seed, setup.mistakeMode)}
        onResume={() => saved && setScreen({ type: 'game', state: saved.state, key: Date.now() })}
        onPrint={() => setScreen({ type: 'print' })}
        onBack={onExit}
      />
    </div>
  );
}
