import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { aiTick, chainPotential, newBrain, nextInput, placeOn, planMove, reachable, resolveBoard, shapeScore, toBoard, type AiBrain } from './ai';
import { COUNTDOWN, DEFAULT_OPTIONS, createGame, idx, step } from './engine';
import { DEATH_X, GARBAGE, H, W } from './types';
import type { Blob, DuelAiLevel, MalangOptions, MalangState } from './types';

const COLORS: Record<string, number> = { R: 0, G: 1, B: 2, Y: 3, P: 4, X: GARBAGE };

function grid(rows: string[]): (Blob | null)[] {
  const g: (Blob | null)[] = Array.from({ length: W * H }, () => null);
  let id = 1000;
  const top = H - rows.length;
  rows.forEach((row, r) => [...row].forEach((ch, x) => ch !== '.' && (g[idx(x, top + r)] = { id: id++, c: COLORS[ch] })));
  return g;
}

/** 컴퓨터끼리 화면 없이 대결시킨다 */
export function playMatch(a: DuelAiLevel, b: DuelAiLevel, seed: number, options: Partial<MalangOptions> = {}, maxMs = 400_000): MalangState {
  const s = createGame({ seats: [{ kind: a, name: 'A' }, { kind: b, name: 'B' }], options: { ...DEFAULT_OPTIONS, ...options } }, seed);
  const rng = seededRandom(seed * 7 + 1);
  const brains: AiBrain[] = [newBrain(), newBrain()];
  for (let t = 0; t < maxMs && s.phase !== 'over'; t += 16) {
    aiTick(s, 0, a, brains[0], 16, rng);
    aiTick(s, 1, b, brains[1], 16, rng);
    step(s, 16);
    s.events = [];
  }
  return s;
}

describe('말랑 팡팡 컴퓨터: 머릿속 판', () => {
  it('조각을 놓으면 자기 줄 맨 위로 떨어진다', () => {
    const b = toBoard(grid(['R.....']));
    const v = placeOn(b, 0, 0, [1, 2])!;
    expect(v[idx(0, H - 2)]).toBe(1);
    expect(v[idx(0, H - 3)]).toBe(2);
    const h = placeOn(b, 0, 1, [1, 2])!;
    expect(h[idx(0, H - 2)]).toBe(1);
    expect(h[idx(1, H - 1)]).toBe(2);
    expect(placeOn(b, 5, 1, [1, 2])).toBeNull();
  });

  it('연쇄를 끝까지 계산한다', () => {
    const b = toBoard(grid(['G.....', 'R.....', 'RGG...', 'RRG...']));
    b[idx(1, H - 3)] = 0; // 빨강을 하나 더 놓아 4개
    const r = resolveBoard(b);
    expect(r.chains).toBe(2);
    expect(b.every((c) => c === -1)).toBe(true);
  });

  it('연쇄 씨앗: 젤리 하나만 더 오면 2연쇄가 되는 판을 알아본다', () => {
    const b = toBoard(grid(['G.....', 'R.....', 'RGG...', 'RRG...']));
    expect(chainPotential(b, 4).chains).toBe(2);
  });

  it('가운데 줄이 막히는 판은 아주 나쁘다', () => {
    const b = toBoard(grid([]));
    b[DEATH_X] = 1;
    expect(shapeScore(b)).toBeLessThan(-1e6);
  });
});

describe('말랑 팡팡 컴퓨터: 판단', () => {
  function withPiece(rows: string[], colors: [number, number], options: Partial<MalangOptions> = {}): MalangState {
    const s = createGame({ seats: [{ kind: 'ai-hard', name: '' }, { kind: 'ai-hard', name: '' }], options: { ...DEFAULT_OPTIONS, ...options } }, 4);
    step(s, COUNTDOWN + 200);
    const p = s.players[0];
    p.grid = grid(rows);
    p.piece = { ...p.piece!, colors, x: DEATH_X, y: 0, r: 0 };
    return s;
  }

  it('갈 수 없는 자리는 고르지 않는다: 높은 벽 너머', () => {
    const s = withPiece(['.X....', '.X....', '.X....', '.X....', '.X....', '.X....', '.X....', '.X....', '.X....', '.X....', '.X....', '.X....'], [0, 1]);
    const places = reachable(s.players[0].grid, s.players[0].piece!);
    expect(places.some((p) => p.x === 0)).toBe(false);
    for (const level of ['ai-easy', 'ai-normal', 'ai-hard'] as DuelAiLevel[]) {
      const plan = planMove(s, 0, level, seededRandom(1));
      expect(plan.x).toBeGreaterThanOrEqual(1);
    }
  });

  it('위험할 때는 터뜨려서 살아남는다', () => {
    // 가운데 줄이 높이 쌓여 위험한데 빨강을 맞추면 터진다
    const s = withPiece(['..G...', '..B...', '..G...', '..B...', '..G...', '..B...', '..G...', '..B...', '..G...', 'RRRB..'], [0, 0]);
    for (const level of ['ai-normal', 'ai-hard'] as DuelAiLevel[]) {
      const plan = planMove(s, 0, level, seededRandom(2));
      const b = placeOn(toBoard(s.players[0].grid), plan.x, plan.r, [0, 0])!;
      expect(resolveBoard(b).chains).toBeGreaterThan(0);
    }
  });

  it('단추 고르기: 먼저 돌리고, 옆으로 가고, 다 오면 떨어뜨린다', () => {
    expect(nextInput({ x: 2, r: 0 }, { x: 4, r: 3 })).toBe('ccw');
    expect(nextInput({ x: 2, r: 0 }, { x: 4, r: 1 })).toBe('cw');
    expect(nextInput({ x: 2, r: 1 }, { x: 4, r: 1 })).toBe('right');
    expect(nextInput({ x: 4, r: 1 }, { x: 4, r: 1 })).toBe('drop');
  });

  it('어려움도 한 번 생각하는 데 오래 걸리지 않는다', () => {
    const s = withPiece(['RGBY..', 'GBYR..', 'BYRG.Y', 'YRGBBY'], [1, 2]);
    const t0 = performance.now();
    for (let k = 0; k < 10; k++) planMove(s, 0, 'ai-hard', seededRandom(k));
    expect((performance.now() - t0) / 10).toBeLessThan(60);
  });
});

describe('말랑 팡팡 컴퓨터: 실력', () => {
  it('컴퓨터끼리 하면 언젠가는 끝난다', () => {
    for (let seed = 1; seed <= 3; seed++) {
      const s = playMatch('ai-normal', 'ai-easy', seed);
      expect(s.phase).toBe('over');
    }
  }, 60_000);

  it('어려움은 쉬움을 이긴다', () => {
    let hard = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const s = playMatch(seed % 2 ? 'ai-hard' : 'ai-easy', seed % 2 ? 'ai-easy' : 'ai-hard', seed);
      const hardSide = seed % 2 ? 0 : 1;
      if (s.winner === hardSide) hard++;
    }
    expect(hard).toBeGreaterThanOrEqual(3);
  }, 120_000);
});
