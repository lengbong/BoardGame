import type { LogicLevel } from './logic';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'expert';

/** 만든 문제 하나. 문제 번호(id)만 있으면 언제든 똑같이 다시 만들 수 있다. */
export interface Puzzle {
  /** 문제 번호, 예: "2-04821" (앞 숫자 = 난이도, 뒤 = 시드) */
  id: string;
  difficulty: Difficulty;
  seed: number;
  /** 81글자, 빈칸은 '.' */
  givens: string;
  /** 81글자 정답 */
  solution: string;
  clues: number;
  /** 사람 방법 풀이기로 매긴 단계 (4 = 풀이기로 못 풂) */
  level: LogicLevel;
}

/** 틀린 숫자 표시: 바로 표시 / 다 채운 뒤 확인 */
export type MistakeMode = 'instant' | 'end';

export interface SudokuSetup {
  difficulty: Difficulty;
  mistakeMode: MistakeMode;
}

/** 칸 하나가 바뀐 기록 (되돌리기용): v 숫자, n 메모 마스크, 0 = 전, 1 = 후 */
export interface CellChange {
  i: number;
  v0: number;
  n0: number;
  v1: number;
  n1: number;
}

export interface HistoryEntry {
  changes: CellChange[];
}

export interface HintInfo {
  cell: number;
  digit: number;
  /** fix: 틀린 숫자를 고침, single: 하나만 남은 칸, hidden: 여기밖에 없는 칸, advanced: 어려운 방법 뒤 single, reveal: 그냥 알려 줌 */
  kind: 'fix' | 'single' | 'hidden' | 'advanced' | 'reveal';
  /** 강조할 묶음 (0~26) */
  unit: number | null;
  message: string;
}

export type SudokuEvent =
  | { type: 'place'; cell: number; digit: number; wrong: boolean; conflict: boolean }
  | { type: 'note'; cell: number; digit: number; on: boolean }
  | { type: 'erase'; cell: number }
  | { type: 'fillNotes'; count: number }
  | { type: 'hint'; hint: HintInfo }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' }
  /** 가로줄·세로줄·3×3 칸을 다 채움 (묶음 번호) */
  | { type: 'unitDone'; units: number[] }
  | { type: 'complete' }
  /** 다 채웠는데 틀린 칸이 있음 */
  | { type: 'checkFailed'; wrong: number }
  | { type: 'blocked'; reason: 'given' | 'filled' | 'solved' };

export interface SudokuState {
  puzzle: Puzzle;
  values: number[];
  /** 메모(후보 숫자) 마스크 */
  notes: number[];
  undo: HistoryEntry[];
  redo: HistoryEntry[];
  mistakeMode: MistakeMode;
  hintsUsed: number;
  /** 틀린 숫자를 넣은 횟수 */
  mistakes: number;
  /** 힌트로 채운 칸 */
  hinted: number[];
  elapsedMs: number;
  status: 'playing' | 'solved';
  /** 다 채운 뒤 확인 모드에서 틀린 칸을 보여 주는 중 */
  showWrong: boolean;
  lastHint: HintInfo | null;
  /** 마지막 행동에서 일어난 일 (소리·연출용) */
  events: SudokuEvent[];
}

export type SudokuAction =
  | { type: 'place'; cell: number; digit: number }
  | { type: 'note'; cell: number; digit: number }
  | { type: 'erase'; cell: number }
  | { type: 'fillNotes' }
  | { type: 'clearNotes' }
  | { type: 'hint'; cell?: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' }
  | { type: 'tick'; ms: number }
  | { type: 'setMistakeMode'; mode: MistakeMode };
