import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { decideAction, scoreMove } from './ai';
import { createSet } from './dominoes';
import { DEFAULT_OPTIONS, applyAction, canDraw, createGame, legalMoves } from './rules';
import type { DominoOptions, DominoSetup, DominoState, PlacedTile, SeatKind, Tile } from './types';

const SET = createSet();
function T(a: number, b: number): Tile {
  return SET.find((t) => t.a === Math.min(a, b) && t.b === Math.max(a, b))!;
}

function game(hands: [number, number][][], line: [number, number][], options: Partial<DominoOptions> = {}, boneyard?: [number, number][]): DominoState {
  const seats = [0, 1, 2, 3].map((i) => ({ kind: i < hands.length ? 'ai-normal' : 'empty', name: `C${i}` })) as DominoSetup['seats'];
  const s = createGame({ seats, options: { ...DEFAULT_OPTIONS, ...options } }, seededRandom(1));
  s.players.forEach((p, i) => {
    p.hand = hands[i].map(([a, b]) => T(a, b));
    p.lacks = [];
  });
  s.line = line.map(([l, r], i): PlacedTile => ({ tile: T(l, r), left: l, right: r, order: i, player: 0 }));
  s.origin = 0;
  const used = new Set([...s.players.flatMap((p) => p.hand.map((t) => t.id)), ...s.line.map((p) => p.tile.id)]);
  s.boneyard = boneyard ? boneyard.map(([a, b]) => T(a, b)) : SET.filter((t) => !used.has(t.id));
  s.current = 0;
  s.phase = 'play';
  return s;
}

const playOf = (tile: Tile) => expect.objectContaining({ type: 'play', tileId: tile.id });

describe('컴퓨터: 기본', () => {
  it('낼 패가 없으면 뽑고, 뽑을 수도 없으면 통과한다', () => {
    const s = game([[[0, 1]], [[4, 2]]], [[3, 4]]);
    expect(decideAction(s, 'ai-normal')).toEqual({ type: 'draw' });
    expect(decideAction(s, 'ai-easy')).toEqual({ type: 'draw' });
    const empty = game([[[0, 1]], [[4, 2]]], [[3, 4]], {}, []);
    expect(decideAction(empty, 'ai-normal')).toEqual({ type: 'pass' });
    const block = game([[[0, 1]], [[4, 2]]], [[3, 4]], { blockRule: true });
    expect(decideAction(block, 'ai-easy')).toEqual({ type: 'pass' });
  });

  it('마지막 패를 낼 수 있으면 바로 낸다', () => {
    const s = game([[[3, 1]], [[4, 2]]], [[3, 4]]);
    expect(decideAction(s, 'ai-normal')).toEqual(playOf(T(1, 3)));
  });

  it('쉬움 컴퓨터도 언제나 올바른 수만 둔다', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = seededRandom(seed);
      const s = createGame({ seats: [0, 1, 2, 3].map(() => ({ kind: 'ai-easy', name: '' })) as DominoSetup['seats'], options: DEFAULT_OPTIONS }, rng);
      const a = decideAction(s, 'ai-easy', rng);
      if (a.type === 'play') expect(legalMoves(s).some((m) => m.tileId === a.tileId && m.side === a.side)).toBe(true);
      expect(applyAction(s, a, rng)).not.toBe(s);
    }
  });

  it('판이 끝났으면 다음 판을 시작한다', () => {
    const s = game([[[3, 1]], [[4, 2]]], [[3, 4]]);
    s.phase = 'roundover';
    expect(decideAction(s, 'ai-easy')).toEqual({ type: 'nextRound' });
  });
});

describe('컴퓨터 (보통): 작전', () => {
  it('더블과 점이 많은 패를 먼저 낸다', () => {
    const s = game([[[6, 6], [2, 1], [0, 3], [4, 5]], [[0, 0]]], [[6, 2]]);
    expect(decideAction(s, 'ai-normal')).toEqual(playOf(T(6, 6)));
    const heavy = game([[[3, 6], [3, 1], [6, 2], [1, 4]], [[0, 0]]], [[3, 5], [5, 0], [0, 3]]);
    expect(decideAction(heavy, 'ai-normal')).toEqual(playOf(T(3, 6)));
  });

  it('낸 뒤에도 내가 이어 낼 수 있는 끝을 남긴다', () => {
    // 3·6을 내면 끝이 6·4 (이어 낼 패 1개), 4·1을 내면 끝이 3·1 (이어 낼 패 3개)
    const s = game([[[3, 6], [4, 1], [1, 1], [1, 2]], [[0, 0]]], [[3, 4]]);
    expect(decideAction(s, 'ai-normal')).toEqual(playOf(T(1, 4)));
    expect(scoreMove(s, T(1, 4), 'right')).toBeGreaterThan(scoreMove(s, T(3, 6), 'left'));
  });

  it('다른 사람이 뽑거나 통과할 때 없던 숫자로 끝을 만들어 막는다', () => {
    const base = () => game([[[2, 4], [5, 1], [4, 0], [1, 0]], [[6, 6], [3, 3]]], [[2, 3], [3, 5]]);
    const a = base();
    a.players[1].lacks = [4, 5];
    expect(decideAction(a, 'ai-normal')).toEqual(playOf(T(2, 4))); // 끝이 4·5가 된다
    const b = base();
    b.players[1].lacks = [1, 2];
    expect(decideAction(b, 'ai-normal')).toEqual(playOf(T(1, 5))); // 끝이 2·1이 된다
  });

  it('뽑은 것을 보고 없는 숫자를 기억하고, 그 숫자로 막는다 (실제 진행)', () => {
    // 끝이 3·5. 1번(다음 사람)이 뽑고 통과하면 3과 5가 없다는 것을 알게 된다.
    const make = () =>
      game(
        [
          [
            [3, 5],
            [5, 1],
            [1, 4],
            [4, 6],
          ],
          [
            [0, 2],
            [2, 2],
          ],
        ],
        [
          [3, 6],
          [6, 5],
        ],
        {},
        [[0, 0]],
      );
    // 아무것도 모를 때는 5·1로 이어 낼 패를 남긴다.
    expect(decideAction(make(), 'ai-normal')).toEqual(playOf(T(1, 5)));

    const s = make();
    s.current = 1;
    const drawn = applyAction(s, { type: 'draw' }); // 0·0을 뽑아도 낼 수 없다
    expect(drawn.players[1].lacks).toEqual([3, 5]);
    const passed = applyAction(drawn, { type: 'pass' });
    expect(passed.current).toBe(0);
    // 이제는 3·5를 왼쪽에 내서 끝을 5·5로 만들어 1번을 막는다.
    expect(decideAction(passed, 'ai-normal')).toEqual({ type: 'play', tileId: T(3, 5).id, side: 'left' });
  });

  it('줄이 비어 있으면 (이긴 사람이 시작) 무거운 더블로 시작한다', () => {
    const s = game([[[6, 6], [0, 1], [2, 3], [1, 4]], [[5, 5]]], []);
    expect(decideAction(s, 'ai-normal')).toEqual(playOf(T(6, 6)));
  });
});

function runGame(kinds: SeatKind[], options: Partial<DominoOptions>, seed: number): DominoState {
  const rng = seededRandom(seed);
  const seats = [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as DominoSetup['seats'];
  let s = createGame({ seats, options: { ...DEFAULT_OPTIONS, ...options } }, rng);
  for (let step = 0; step < 3000 && s.phase !== 'gameover'; step++) {
    const p = s.players[s.current];
    const level = p.kind === 'ai-easy' ? 'ai-easy' : 'ai-normal';
    const action = decideAction(s, level, rng);
    if (action.type === 'draw') expect(canDraw(s)).toBe(true);
    const next = applyAction(s, action, rng);
    expect(next).not.toBe(s); // 언제나 할 수 있는 행동
    const ids = [...next.players.flatMap((q) => q.hand.map((t) => t.id)), ...next.line.map((q) => q.tile.id), ...next.boneyard.map((t) => t.id)];
    expect(new Set(ids).size).toBe(28);
    expect(ids).toHaveLength(28);
    expect(next.line.every((q, i) => i === 0 || next.line[i - 1].right === q.left)).toBe(true);
    s = next;
  }
  expect(s.phase).toBe('gameover');
  return s;
}

describe('컴퓨터끼리 끝까지', () => {
  it('2~4명, 한 판·점수 모으기, 블록 규칙 켜고 끄기: 여러 시드로 끝까지 올바르게 진행된다', () => {
    const cases: [SeatKind[], Partial<DominoOptions>][] = [
      [['ai-normal', 'ai-easy'], { endMode: 'single' }],
      [['ai-normal', 'ai-normal', 'ai-easy'], { endMode: 'points', targetScore: 50 }],
      [['ai-easy', 'ai-normal', 'ai-normal', 'ai-easy'], { endMode: 'points', targetScore: 100, blockRule: true }],
      [['ai-normal', 'ai-normal'], { endMode: 'points', targetScore: 150, winnerStarts: false }],
      [['ai-normal', 'empty', 'ai-normal', 'ai-normal'], { endMode: 'single', blockRule: true }],
    ];
    for (const [kinds, options] of cases) {
      for (const seed of [1, 7, 42, 99, 2024]) {
        const s = runGame(kinds, options, seed);
        if (s.roundResult?.winner !== null && s.options.endMode === 'points') {
          expect(s.players[s.rankings[0]].score).toBeGreaterThanOrEqual(s.options.targetScore);
        }
      }
    }
  });

  it('보통 컴퓨터는 쉬움 컴퓨터보다 더 많이 이긴다', () => {
    let normal = 0;
    let easy = 0;
    for (let seed = 1; seed <= 120; seed++) {
      // 자리를 번갈아 바꿔서 먼저 하는 이득을 없앤다.
      const flip = seed % 2 === 0;
      const s = runGame(flip ? ['ai-easy', 'ai-normal'] : ['ai-normal', 'ai-easy'], { endMode: 'single' }, seed);
      const w = s.roundResult?.winner;
      if (w === null || w === undefined) continue;
      if (s.players[w].kind === 'ai-normal') normal++;
      else easy++;
    }
    expect(normal).toBeGreaterThan(easy * 1.3);
  });
});
