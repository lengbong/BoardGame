import { seededRandom, type Rng } from '../../lib/random';
import { CELLS, gridToString } from './grid';
import { gradePuzzle, type LogicLevel } from './logic';
import { countSolutions, randomSolvedGrid } from './solver';
import type { Difficulty, Puzzle } from './types';

export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'expert'];

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; code: number; desc: string; clues: string }> = {
  easy: {
    label: '쉬움',
    code: 1,
    clues: '숫자 36~40개',
    desc: '들어갈 숫자가 하나뿐인 칸만 찾으면 풀려요. 처음 하는 사람과 아이에게 좋아요.',
  },
  normal: {
    label: '보통',
    code: 2,
    clues: '숫자 26~32개',
    desc: '메모를 하면서 후보를 줄여야 하는 곳이 한두 군데 있어요.',
  },
  hard: {
    label: '어려움',
    code: 3,
    clues: '숫자 22~29개',
    desc: '숨은 짝, X-윙 같은 어려운 방법이 필요해요. 끈기가 필요해요!',
  },
  expert: {
    label: '아주 어려움',
    code: 4,
    clues: '숫자 20~27개',
    desc: '숫자가 아주 적거나 고수의 방법이 필요한 문제예요. 어른들의 도전!',
  },
};

/** 시드는 1~99999 (문제 번호의 뒤 다섯 자리) */
export const MAX_SEED = 99999;

export function randomSeed(rng: Rng = Math.random): number {
  return 1 + Math.min(MAX_SEED - 1, Math.floor(rng() * MAX_SEED));
}

/** 문제 번호: "난이도-시드" (예: 보통 4821번 → "2-04821") */
export function puzzleCode(difficulty: Difficulty, seed: number): string {
  return `${DIFFICULTY_INFO[difficulty].code}-${String(seed).padStart(5, '0')}`;
}

/** 문제 번호를 읽는다. "2-04821", "2 4821", "204821" 모두 된다. 잘못되면 null */
export function parsePuzzleCode(text: string): { difficulty: Difficulty; seed: number } | null {
  const m = /^\s*([1-4])\s*[-–—\s·.]?\s*(\d{1,5})\s*$/.exec(text);
  if (!m) return null;
  const seed = Number(m[2]);
  if (seed < 1 || seed > MAX_SEED) return null;
  return { difficulty: DIFFICULTIES[Number(m[1]) - 1], seed };
}

interface Target {
  /** 지우는 동안 넘지 않을 단계 (4 = 제한 없음) */
  cap: LogicLevel;
  /** 목표 단계 (이 단계 이상이 나와야 성공) */
  want: LogicLevel;
  /** 이 범위의 숫자 개수까지 먼저 지운다 */
  stop: [number, number];
  /** 목표 단계를 찾으며 더 지울 때도 이보다 적게는 남기지 않는다 */
  floor: number;
  /** 다시 만들어 보는 횟수 (시드마다 결과가 같도록 시간이 아니라 횟수로 제한) */
  attempts: number;
}

const TARGETS: Record<Difficulty, Target> = {
  easy: { cap: 1, want: 1, stop: [36, 40], floor: 36, attempts: 2 },
  normal: { cap: 2, want: 2, stop: [29, 32], floor: 26, attempts: 24 },
  hard: { cap: 3, want: 3, stop: [26, 29], floor: 22, attempts: 18 },
  expert: { cap: 4, want: 4, stop: [17, 17], floor: 17, attempts: 12 },
};

/** 아주 어려움: 풀이기로 못 풀거나, 3단계이면서 숫자가 이만큼 이하 */
const EXPERT_FEW_CLUES = 23;

interface Candidate {
  grid: number[];
  clues: number;
  level: LogicLevel;
}

function shuffled<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let k = a.length - 1; k > 0; k--) {
    const j = Math.min(k, Math.floor(rng() * (k + 1)));
    [a[k], a[j]] = [a[j], a[k]];
  }
  return a;
}

function levelOf(grid: number[]): LogicLevel {
  return gradePuzzle(grid, 3).level;
}

function meetsTarget(c: Candidate, difficulty: Difficulty, t: Target): boolean {
  if (difficulty === 'expert') return c.level === 4 || (c.level === 3 && c.clues <= EXPERT_FEW_CLUES);
  return c.level === t.want && c.clues <= t.stop[1] + (difficulty === 'easy' ? 5 : 0);
}

/** 여러 번 해도 목표에 못 미쳤을 때 가장 가까운 것을 고르는 점수 (클수록 좋음) */
function score(c: Candidate, difficulty: Difficulty, t: Target): number {
  if (difficulty === 'easy') return (c.level === 1 ? 1000 : 0) - Math.abs(c.clues - 38);
  const levelScore = c.level >= t.want ? 1000 + (difficulty === 'expert' ? 0 : -(c.level - t.want) * 500) : c.level * 100;
  return levelScore - c.clues;
}

/** 완성 판에서 해답이 하나로 유지되도록 숫자를 지운다. */
function dig(full: number[], rng: Rng, t: Target): Candidate {
  const grid = [...full];
  let clues = CELLS;
  const stopAt = t.stop[0] + Math.floor(rng() * (t.stop[1] - t.stop[0] + 1));
  // 먼저 가운데를 중심으로 마주 보는 두 칸씩 (보기 좋은 대칭), 그다음 한 칸씩
  const pairs = shuffled(
    Array.from({ length: 41 }, (_, i) => (i === 40 ? [40] : [i, 80 - i])),
    rng,
  );
  const singles = shuffled(
    Array.from({ length: CELLS }, (_, i) => [i]),
    rng,
  );
  const groups = [...pairs, ...singles];

  const tryRemove = (cells: number[]): boolean => {
    if (cells.some((i) => grid[i] === 0)) return false;
    if (clues - cells.length < t.floor) return false;
    const saved = cells.map((i) => grid[i]);
    for (const i of cells) grid[i] = 0;
    const ok = countSolutions(grid, 2) === 1 && (t.cap === 4 || gradePuzzle(grid, t.cap as 1 | 2 | 3).solved);
    if (!ok) {
      cells.forEach((i, k) => (grid[i] = saved[k]));
      return false;
    }
    clues -= cells.length;
    return true;
  };

  let g = 0;
  // 1) 목표 개수까지 지우기
  for (; g < groups.length && clues > stopAt; g++) tryRemove(groups[g]);
  let level = levelOf(grid);
  // 2) 목표 단계가 안 나왔으면 바닥 개수까지 조금씩 더 지워 본다
  if (t.cap !== 4) {
    for (; g < groups.length && level < t.want && clues > t.floor; g++) {
      if (tryRemove(groups[g])) level = levelOf(grid);
    }
  }
  return { grid, clues, level };
}

/** 같은 난이도와 시드면 언제나 같은 문제가 나온다. */
export function generatePuzzle(difficulty: Difficulty, seed: number): Puzzle {
  const t = TARGETS[difficulty];
  const rng = seededRandom((Math.imul(seed, 2654435761) ^ (DIFFICULTY_INFO[difficulty].code * 0x9e3779b9)) >>> 0);
  let best: { cand: Candidate; full: number[] } | null = null;
  for (let a = 0; a < t.attempts; a++) {
    const full = randomSolvedGrid(rng);
    const cand = dig(full, rng, t);
    if (!best || score(cand, difficulty, t) > score(best.cand, difficulty, t)) best = { cand, full };
    if (meetsTarget(cand, difficulty, t)) break;
  }
  const { cand, full } = best!;
  return {
    id: puzzleCode(difficulty, seed),
    difficulty,
    seed,
    givens: gridToString(cand.grid),
    solution: gridToString(full),
    clues: cand.clues,
    level: cand.level,
  };
}

const cache = new Map<string, Puzzle>();

/** 한 번 만든 문제는 기억해 둔다 (인쇄 미리보기에서 다시 만들지 않게). */
export function getPuzzle(difficulty: Difficulty, seed: number): Puzzle {
  const id = puzzleCode(difficulty, seed);
  let p = cache.get(id);
  if (!p) {
    p = generatePuzzle(difficulty, seed);
    if (cache.size > 400) cache.clear();
    cache.set(id, p);
  }
  return p;
}

export function hasCachedPuzzle(difficulty: Difficulty, seed: number): boolean {
  return cache.has(puzzleCode(difficulty, seed));
}
