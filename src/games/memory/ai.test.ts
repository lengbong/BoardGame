import { describe, expect, it } from 'vitest';
import { seededRandom, shuffle } from '../../lib/random';
import { aiView, decideAction, decideFlip, recall, type AiLevel, type AiView } from './ai';
import { DEFAULT_OPTIONS, applyAction, createGame, totalPairs } from './rules';
import type { BoardSize, MemoryOptions, MemorySetup, MemoryState, SeatKind } from './types';

function setup(kinds: SeatKind[], options: Partial<MemoryOptions> = {}): MemorySetup {
  const four = [...kinds, 'empty', 'empty', 'empty'].slice(0, 4) as SeatKind[];
  return {
    seats: four.map((kind, i) => ({ kind, name: `C${i}` })) as MemorySetup['seats'],
    options: { ...DEFAULT_OPTIONS, ...options },
  };
}

function game(kinds: SeatKind[] = ['ai-normal', 'ai-normal'], options: Partial<MemoryOptions> = {}, seed = 1): MemoryState {
  const s = createGame(setup(kinds, options), seededRandom(seed));
  s.current = 0;
  return s;
}

function flip(s: MemoryState, cardId: number): MemoryState {
  const t = applyAction(s, { type: 'flip', cardId });
  expect(t).not.toBe(s);
  return t;
}

/** 서로 다른 그림 카드 두 장을 뒤집었다가 덮는다 (공개 기록만 남는다). */
function peekAt(s: MemoryState, a: number, b: number): MemoryState {
  return applyAction(flip(flip(s, a), b), { type: 'hide' });
}

/** 컴퓨터끼리 끝까지 둔다. 걸음 수와 끝난 상태를 돌려준다. */
function playOut(s: MemoryState, rng: () => number, maxSteps = 6000): { state: MemoryState; steps: number } {
  let steps = 0;
  while (s.phase !== 'gameover' && steps < maxSteps) {
    const p = s.players[s.current];
    const action = decideAction(s, p.kind === 'human' ? 'ai-normal' : p.kind, rng);
    if (action.type === 'flip') {
      // 올바른 카드만 고르는지 매번 확인
      const card = s.cards[action.cardId];
      expect(card.matchedBy).toBeNull();
      expect(s.faceUp).not.toContain(action.cardId);
    }
    const next = applyAction(s, action);
    expect(next).not.toBe(s);
    s = next;
    steps += 1;
  }
  return { state: s, steps };
}

const LEVELS: AiLevel[] = ['ai-easy', 'ai-normal'];

describe('컴퓨터는 공개된 정보만 본다', () => {
  it('처음에는 컴퓨터가 받는 정보에 그림이 하나도 없다', () => {
    const s = game(['ai-normal', 'ai-normal'], { size: '6x6' });
    const text = JSON.stringify(aiView(s));
    for (const c of s.cards) expect(text).not.toContain(c.pic);
    expect(aiView(s).hidden).toHaveLength(36);
  });

  it('한 장을 뒤집으면 그 그림만 알게 된다', () => {
    let s = game();
    s = flip(s, 0);
    const view = aiView(s);
    expect(view.faceUp).toEqual([{ id: 0, pic: s.cards[0].pic }]);
    expect(Object.keys(view.seen)).toEqual(['0']);
    const text = JSON.stringify(view);
    for (const c of s.cards) if (c.pic !== s.cards[0].pic) expect(text).not.toContain(c.pic);
  });

  it('보지 못한 카드의 그림을 바꿔 섞어도 컴퓨터의 선택은 똑같다', () => {
    for (let seed = 1; seed <= 40; seed++) {
      let s = game(['ai-normal', 'ai-easy'], { size: '4x6' }, seed);
      const rng = seededRandom(seed * 7);
      // 몇 번 진행해서 공개 기록을 쌓는다.
      for (let k = 0; k < 6 + (seed % 7); k++) {
        if (s.phase === 'gameover') break;
        s = applyAction(s, decideAction(s, 'ai-normal', rng));
      }
      if (s.phase !== 'play') continue;
      const unseen = s.cards.filter((c) => c.matchedBy === null && !(c.id in s.seen) && !s.faceUp.includes(c.id));
      const swapped = structuredClone(s);
      const newPics = shuffle(
        unseen.map((c) => c.pic),
        seededRandom(seed + 99),
      ).reverse();
      unseen.forEach((c, i) => (swapped.cards[c.id].pic = newPics[i]));
      for (const level of LEVELS) {
        expect(decideFlip(aiView(swapped), level, seededRandom(seed))).toBe(decideFlip(aiView(s), level, seededRandom(seed)));
      }
    }
  });

  it('아무것도 공개되지 않았으면 짝을 맞히는 확률은 운(1/15) 정도다', () => {
    let hits = 0;
    const trials = 3000;
    for (let t = 0; t < trials; t++) {
      const s = game(['ai-normal', 'ai-normal'], {}, 1000 + t);
      const rng = seededRandom(t);
      const a = decideFlip(aiView(s), 'ai-normal', rng);
      const s1 = flip(s, a);
      const b = decideFlip(aiView(s1), 'ai-normal', rng);
      if (s.cards[a].pic === s.cards[b].pic) hits += 1;
    }
    const rate = hits / trials;
    expect(rate).toBeGreaterThan(0.03);
    expect(rate).toBeLessThan(0.11);
  });
});

describe('컴퓨터의 판단', () => {
  /** 직접 만든 정보: 카드 0~7이 뒷면, 기록은 seen */
  function view(seen: AiView['seen'], extra: Partial<AiView> = {}): AiView {
    return { hidden: [0, 1, 2, 3, 4, 5, 6, 7], faceUp: [], seen, reveals: 10, me: 1, ...extra };
  }

  it('보통: 기억하는 짝이 있으면 바로 뒤집고, 둘째 장으로 그 짝을 맞힌다', () => {
    let s = game(['ai-normal', 'ai-normal'], {}, 3);
    const pic = s.cards[0].pic;
    const partner = s.cards.find((c) => c.id !== 0 && c.pic === pic)!.id;
    const other = s.cards.find((c) => c.pic !== pic)!.id;
    s = peekAt(s, 0, other);
    s = peekAt(s, partner, s.cards.find((c) => c.pic !== pic && c.id !== other)!.id);
    s.current = 0;
    const first = decideFlip(aiView(s), 'ai-normal', seededRandom(1));
    expect([0, partner]).toContain(first);
    s = flip(s, first);
    expect(decideFlip(aiView(s), 'ai-normal', seededRandom(2))).toBe(first === 0 ? partner : 0);
  });

  it('보통: 짝을 모르면 처음 보는 카드를 먼저 뒤집고, 그 짝을 기억하면 맞힌다', () => {
    const v = view({ 0: { pic: 'a-cat', at: 8 }, 1: { pic: 'a-dog', at: 9 } });
    for (let seed = 0; seed < 30; seed++) {
      const first = decideFlip(v, 'ai-normal', seededRandom(seed));
      expect(first).toBeGreaterThanOrEqual(2);
    }
    // 처음 본 카드가 고양이였다면 기억 속 고양이(0번)를 뒤집는다.
    const second = view({ 0: { pic: 'a-cat', at: 8 }, 1: { pic: 'a-dog', at: 9 }, 5: { pic: 'a-cat', at: 10 } }, {
      hidden: [0, 1, 2, 3, 4, 6, 7],
      faceUp: [{ id: 5, pic: 'a-cat' }],
      reveals: 11,
    });
    expect(decideFlip(second, 'ai-normal', seededRandom(4))).toBe(0);
  });

  it('보통: 첫 장의 짝을 모르면 틀릴 게 뻔한 카드 대신 처음 보는 카드를 뒤집는다', () => {
    const v = view({ 0: { pic: 'a-cat', at: 8 }, 1: { pic: 'a-dog', at: 9 }, 5: { pic: 'a-pig', at: 10 } }, {
      hidden: [0, 1, 2, 3, 4, 6, 7],
      faceUp: [{ id: 5, pic: 'a-pig' }],
      reveals: 11,
    });
    for (let seed = 0; seed < 30; seed++) expect([2, 3, 4, 6, 7]).toContain(decideFlip(v, 'ai-normal', seededRandom(seed)));
  });

  it('쉬움은 최근 몇 장만 기억하고, 오래전에 본 짝은 잊는다 (보통은 대부분 기억한다)', () => {
    let normalBoth = 0;
    for (let t = 0; t < 60; t++) {
      const o = t * 40; // 시도마다 '본 때'를 바꿔 서로 다른 기억이 되게 한다.
      const seen: AiView['seen'] = { 0: { pic: 'a-cat', at: o }, 1: { pic: 'a-cat', at: o + 1 } };
      // 그 뒤로 6장을 더 보았다.
      for (let id = 2; id < 8; id++) seen[id] = { pic: `x-${id}`, at: o + id + 10 };
      const v = view(seen, { reveals: o + 20, me: t % 4 });
      const easy = recall(v, 'ai-easy');
      expect(easy.has(0) || easy.has(1)).toBe(false);
      expect(easy.size).toBeLessThanOrEqual(6);
      const normal = recall(v, 'ai-normal');
      if (normal.has(0) && normal.has(1)) normalBoth += 1;
    }
    expect(normalBoth).toBeGreaterThan(25);
  });

  it('한 번 잊은 카드는 다시 공개될 때까지 떠오르지 않는다', () => {
    for (const level of LEVELS) {
      for (let t = 0; t < 80; t++) {
        const at = t * 7;
        let forgotten = false;
        for (let reveals = at + 1; reveals < at + 60; reveals++) {
          const has = recall({ hidden: [0, 1], faceUp: [], seen: { 0: { pic: 'a-owl', at } }, reveals, me: t % 4 }, level).has(0);
          if (forgotten) expect(has).toBe(false);
          if (!has) forgotten = true;
        }
      }
    }
  });

  it('기억은 공개 기록에 있는 카드만 쓰고, 첫 장을 뒤집어도 흔들리지 않는다', () => {
    const seen: AiView['seen'] = { 2: { pic: 'a-cat', at: 2 }, 6: { pic: 'a-owl', at: 4 }, 3: { pic: 'a-pig', at: 9 } };
    for (const level of LEVELS) {
      for (let me = 0; me < 4; me++) {
        const before = recall(view(seen, { me }), level);
        expect([...before.keys()].every((id) => id === 2 || id === 6 || id === 3)).toBe(true);
        // 첫 장으로 5번을 뒤집었다 (공개 횟수 +1)
        const after = recall(
          view({ ...seen, 5: { pic: 'a-dog', at: 10 } }, { hidden: [0, 1, 2, 3, 4, 6, 7], faceUp: [{ id: 5, pic: 'a-dog' }], reveals: 11, me }),
          level,
        );
        expect([...after.entries()].sort()).toEqual([...before.entries()].sort());
      }
    }
  });

  it('처음에 슬쩍 본 카드는 잘 기억하지 못한다 (보통도 짝 몇 개만 안다)', () => {
    let pairs = 0;
    for (let seed = 1; seed <= 20; seed++) {
      let s = game(['ai-normal', 'ai-normal'], { size: '6x6', peek: true }, seed);
      s = applyAction(s, { type: 'startPlay' });
      const mem = recall(aiView(s), 'ai-normal');
      const pics = [...mem.values()];
      pairs += new Set(pics.filter((p, i) => pics.indexOf(p) !== i)).size;
    }
    expect(pairs / 20).toBeLessThan(3);
  });

  it('짝을 찾은 카드나 앞면 카드는 절대 고르지 않는다', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const level of LEVELS) {
        let s = game([level, level], { size: '4x4' }, seed);
        const rng = seededRandom(seed);
        for (let k = 0; k < 40 && s.phase !== 'gameover'; k++) {
          if (s.phase === 'play') {
            const id = decideFlip(aiView(s), level, rng);
            expect(s.cards[id].matchedBy).toBeNull();
            expect(s.faceUp).not.toContain(id);
          }
          s = applyAction(s, decideAction(s, level, rng));
        }
      }
    }
  });

  it('보여 주기·짝 아님 단계에서는 진행 행동을 고른다', () => {
    const s = game(['ai-easy', 'ai-normal'], { peek: true });
    expect(decideAction(s, 'ai-easy')).toEqual({ type: 'startPlay' });
  });
});

describe('컴퓨터끼리 끝까지', () => {
  const cases: { size: BoardSize; kinds: SeatKind[]; extraTurn: boolean; peek: boolean }[] = [
    { size: '4x4', kinds: ['ai-easy', 'ai-normal'], extraTurn: true, peek: false },
    { size: '4x6', kinds: ['ai-normal', 'ai-easy', 'ai-normal'], extraTurn: false, peek: false },
    { size: '6x6', kinds: ['ai-easy', 'ai-easy', 'ai-normal', 'ai-normal'], extraTurn: true, peek: true },
    { size: '6x6', kinds: ['ai-easy', 'ai-easy'], extraTurn: false, peek: false },
  ];
  for (const c of cases) {
    it(`${c.size}, ${c.kinds.length}명, 한 번 더 ${c.extraTurn ? '켬' : '끔'}${c.peek ? ', 보여 주기' : ''}`, () => {
      for (const seed of [1, 2, 3, 4, 5, 42]) {
        const start = game(c.kinds, { size: c.size, extraTurn: c.extraTurn, peek: c.peek, theme: 'mixed' }, seed);
        const { state } = playOut(start, seededRandom(seed * 13));
        expect(state.phase).toBe('gameover');
        expect(state.players.reduce((n, p) => n + p.pairs.length, 0)).toBe(totalPairs(state));
        expect(state.cards.every((card) => card.matchedBy !== null)).toBe(true);
        expect(state.ranks).toHaveLength(c.kinds.length);
        expect(state.ranks).toContain(1);
        expect(Object.keys(state.seen)).toHaveLength(0);
      }
    });
  }

  it('보통은 쉬움보다 짝을 많이 찾는다 (여러 판 합계)', () => {
    let normal = 0;
    let easy = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const kinds: SeatKind[] = seed % 2 ? ['ai-normal', 'ai-easy'] : ['ai-easy', 'ai-normal'];
      const { state } = playOut(game(kinds, { size: '4x6' }, seed), seededRandom(seed));
      state.players.forEach((p) => (p.kind === 'ai-normal' ? (normal += p.pairs.length) : (easy += p.pairs.length)));
    }
    expect(normal).toBeGreaterThan(easy * 1.3);
  });

  it('보통 컴퓨터 혼자라면 기억 덕분에 운보다 훨씬 적게 뒤집고 끝낸다', () => {
    let total = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const { steps } = playOut(game(['ai-normal', 'ai-normal'], { size: '6x6' }, seed), seededRandom(seed));
      total += steps;
    }
    // 36장을 완전히 운으로 맞히면 수천 번이 걸린다.
    expect(total / 10).toBeLessThan(200);
  });
});
