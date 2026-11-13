import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { DRAWN_PICTURES } from './CardArt';
import { DEFAULT_OPTIONS, applyAction, canFlip, computeRanks, createDeck, createGame, flippableIds, rankingOrder, remainingPairs, winners, withAnd } from './rules';
import { BOARD_SIZES, THEMES, THEME_IDS, boardDims, pictureName, themePictures } from './themes';
import type { BoardSize, MemoryOptions, MemorySetup, MemoryState, SeatKind } from './types';

const zero = () => 0;

function setup(kinds: SeatKind[], options: Partial<MemoryOptions> = {}): MemorySetup {
  const four = [...kinds, 'empty', 'empty', 'empty'].slice(0, 4) as SeatKind[];
  return {
    seats: four.map((kind, i) => ({ kind, name: `P${i}` })) as MemorySetup['seats'],
    options: { ...DEFAULT_OPTIONS, ...options },
  };
}

/** 0번 사람 차례로 시작하는 게임 (rng=0이면 첫 사람이 시작) */
function game(kinds: SeatKind[] = ['human', 'human'], options: Partial<MemoryOptions> = {}, seed = 1): MemoryState {
  const rng = seededRandom(seed);
  const s = createGame(setup(kinds, options), rng);
  s.current = 0;
  s.events = [];
  return s;
}

/** 같은 그림인 카드 두 장 / 다른 그림인 카드 두 장 */
function pairOf(s: MemoryState, pic = s.cards[0].pic): [number, number] {
  const ids = s.cards.filter((c) => c.pic === pic && c.matchedBy === null).map((c) => c.id);
  return [ids[0], ids[1]];
}
function nonPair(s: MemoryState): [number, number] {
  const a = s.cards.find((c) => c.matchedBy === null)!;
  const b = s.cards.find((c) => c.matchedBy === null && c.pic !== a.pic)!;
  return [a.id, b.id];
}

function flipTwo(s: MemoryState, [a, b]: [number, number]): MemoryState {
  return applyAction(applyAction(s, { type: 'flip', cardId: a }), { type: 'flip', cardId: b });
}

describe('카드 묶음 만들기', () => {
  const sizes: BoardSize[] = ['4x4', '4x6', '6x6'];
  for (const size of sizes) {
    it(`${size}: 모든 그림 묶음에서 그림마다 정확히 두 장, id는 겹치지 않는다`, () => {
      for (const theme of THEME_IDS) {
        const { rows, cols, pairs } = boardDims(size);
        const deck = createDeck(size, theme, seededRandom(size.length * 31 + theme.length));
        expect(deck).toHaveLength(rows * cols);
        expect(new Set(deck.map((c) => c.id)).size).toBe(deck.length);
        deck.forEach((c, i) => expect(c.id).toBe(i));
        const counts = new Map<string, number>();
        for (const c of deck) counts.set(c.pic, (counts.get(c.pic) ?? 0) + 1);
        expect(counts.size).toBe(pairs);
        expect([...counts.values()].every((n) => n === 2)).toBe(true);
        const allowed = new Set(themePictures(theme));
        expect(deck.every((c) => allowed.has(c.pic) && c.matchedBy === null)).toBe(true);
      }
    });
  }

  it('그림 묶음마다 18가지 이상, 이름은 모두 한글이고 서로 다르다', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(3);
    for (const t of THEMES) {
      expect(t.pictures.length).toBeGreaterThanOrEqual(18);
      expect(new Set(t.pictures.map((p) => p.id)).size).toBe(t.pictures.length);
    }
    const all = THEMES.flatMap((t) => t.pictures);
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
    // 골고루 섞기에서도 헷갈리지 않게 이름이 겹치지 않는다.
    expect(new Set(all.map((p) => p.name)).size).toBe(all.length);
    expect(all.every((p) => /^[가-힣·]+$/.test(p.name))).toBe(true);
    expect(pictureName('a-rabbit')).toBe('토끼');
    // 이름이 있는 그림은 모두 직접 그린 그림이 있다 (그림만 있고 이름이 없는 것도 없다).
    expect([...DRAWN_PICTURES].sort()).toEqual(all.map((p) => p.id).sort());
  });

  it('같은 시드면 같은 판, 다른 시드면 다른 판', () => {
    const a = createDeck('6x6', 'animals', seededRandom(5)).map((c) => c.pic);
    const b = createDeck('6x6', 'animals', seededRandom(5)).map((c) => c.pic);
    const c = createDeck('6x6', 'animals', seededRandom(6)).map((c) => c.pic);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('판 크기 표가 맞다', () => {
    expect(BOARD_SIZES.map((b) => b.rows * b.cols)).toEqual([16, 24, 36]);
  });
});

describe('게임 시작', () => {
  it('빈 자리는 빼고, 이름이 없으면 색 이름으로 부른다', () => {
    const st = setup(['human', 'empty', 'ai-easy', 'ai-normal']);
    st.seats[0].name = '  ';
    const s = createGame(st, zero);
    expect(s.players.map((p) => p.seat)).toEqual([0, 2, 3]);
    expect(s.players[0].name).toBe('빨강');
    expect(s.players.map((p) => p.kind)).toEqual(['human', 'ai-easy', 'ai-normal']);
    expect(s.phase).toBe('play');
    expect(s.cards).toHaveLength(16);
    expect(s.events.some((e) => e.type === 'deal')).toBe(true);
  });

  it('2명보다 적으면 시작할 수 없다', () => {
    expect(() => createGame(setup(['human']), zero)).toThrow();
  });

  it('처음에 모두 보여 주기: peek 단계로 시작하고, startPlay로 시작하면 모두 슬쩍 본 것으로 기록된다', () => {
    const s = game(['human', 'ai-normal'], { peek: true });
    expect(s.phase).toBe('peek');
    expect(canFlip(s, 0)).toBe(false);
    expect(applyAction(s, { type: 'flip', cardId: 0 })).toBe(s);
    const t = applyAction(s, { type: 'startPlay' });
    expect(t.phase).toBe('play');
    expect(Object.keys(t.seen)).toHaveLength(16);
    expect(t.seen[3]).toEqual({ pic: t.cards[3].pic, at: 0, glance: true });
    expect(applyAction(t, { type: 'startPlay' })).toBe(t);
  });
});

describe('뒤집기', () => {
  it('첫 장: 앞면이 되고 공개 기록에 남는다', () => {
    const s = game();
    const t = applyAction(s, { type: 'flip', cardId: 5 });
    expect(t.faceUp).toEqual([5]);
    expect(t.seen[5]).toEqual({ pic: t.cards[5].pic, at: 0 });
    expect(t.reveals).toBe(1);
    expect(t.events).toEqual([expect.objectContaining({ type: 'flip', player: 0, cardId: 5, pic: t.cards[5].pic })]);
    expect(t.current).toBe(0);
    // 원래 상태는 그대로
    expect(s.faceUp).toEqual([]);
    expect(s.seen).toEqual({});
  });

  it('짝이 맞으면 그 사람이 가져가고, 한 번 더 한다', () => {
    const s = game();
    const [a, b] = pairOf(s);
    const t = flipTwo(s, [a, b]);
    expect(t.cards[a].matchedBy).toBe(0);
    expect(t.cards[b].matchedBy).toBe(0);
    expect(t.players[0].pairs).toEqual([s.cards[a].pic]);
    expect(t.faceUp).toEqual([]);
    expect(t.seen[a]).toBeUndefined();
    expect(t.current).toBe(0);
    expect(t.turn).toBe(s.turn);
    expect(t.attempt).toBe(s.attempt + 1);
    expect(t.streak).toBe(1);
    expect(t.events.find((e) => e.type === 'match')).toMatchObject({ player: 0, cardIds: [a, b], again: true });
    expect(t.log[t.log.length - 1].text).toContain(`${pictureName(s.cards[a].pic)} 짝을 찾았어요! 한 번 더!`);
    expect(remainingPairs(t)).toBe(7);
  });

  it('"맞히면 한 번 더"를 끄면 맞혀도 다음 사람 차례', () => {
    const s = game(['human', 'human', 'human'], { extraTurn: false });
    const t = flipTwo(s, pairOf(s));
    expect(t.players[0].pairs).toHaveLength(1);
    expect(t.current).toBe(1);
    expect(t.turn).toBe(s.turn + 1);
    expect(t.events.find((e) => e.type === 'match')).toMatchObject({ again: false });
    expect(t.events.some((e) => e.type === 'turn' && e.player === 1)).toBe(true);
  });

  it('짝이 아니면 잠깐 보였다가 hide로 뒤집히고 다음 사람 차례', () => {
    const s = game(['human', 'ai-normal']);
    const [a, b] = nonPair(s);
    const t = flipTwo(s, [a, b]);
    expect(t.phase).toBe('mismatch');
    expect(t.faceUp).toEqual([a, b]);
    expect(t.current).toBe(0);
    expect(t.events.some((e) => e.type === 'mismatch')).toBe(true);
    expect(t.log[t.log.length - 1].text).toBe(`P0: ${withAnd(pictureName(s.cards[a].pic))} ${pictureName(s.cards[b].pic)}, 짝이 아니에요.`);
    expect(withAnd('케이블카')).toBe('케이블카와');
    expect(withAnd('당근')).toBe('당근과');
    // 보이는 동안에는 더 뒤집을 수 없다.
    const c = t.cards.find((x) => x.id !== a && x.id !== b)!.id;
    expect(applyAction(t, { type: 'flip', cardId: c })).toBe(t);
    const u = applyAction(t, { type: 'hide' });
    expect(u.phase).toBe('play');
    expect(u.faceUp).toEqual([]);
    expect(u.current).toBe(1);
    expect(u.turn).toBe(t.turn + 1);
    expect(u.streak).toBe(0);
    // 뒤집혀도 공개 기록은 남는다.
    expect(u.seen[a].pic).toBe(s.cards[a].pic);
    expect(u.seen[b].pic).toBe(s.cards[b].pic);
    expect(u.events.find((e) => e.type === 'hide')).toMatchObject({ cardIds: [a, b] });
  });

  it('차례는 마지막 사람 다음에 처음 사람으로 돌아온다', () => {
    let s = game(['human', 'human', 'human']);
    for (let k = 0; k < 3; k++) s = applyAction(flipTwo(s, nonPair(s)), { type: 'hide' });
    expect(s.current).toBe(0);
    expect(s.turn).toBe(4);
  });

  it('할 수 없는 뒤집기는 무시한다 (짝 찾은 카드, 앞면 카드, 없는 카드)', () => {
    const s = game();
    const [a, b] = pairOf(s);
    const t = flipTwo(s, [a, b]);
    expect(applyAction(t, { type: 'flip', cardId: a })).toBe(t);
    const c = t.cards.find((x) => x.matchedBy === null)!.id;
    const u = applyAction(t, { type: 'flip', cardId: c });
    expect(applyAction(u, { type: 'flip', cardId: c })).toBe(u);
    expect(applyAction(u, { type: 'flip', cardId: -1 })).toBe(u);
    expect(applyAction(u, { type: 'flip', cardId: 99 })).toBe(u);
    expect(applyAction(u, { type: 'flip', cardId: 1.5 })).toBe(u);
    expect(canFlip(u, a)).toBe(false);
    expect(flippableIds(u)).not.toContain(a);
    expect(flippableIds(u)).not.toContain(c);
    expect(flippableIds(u)).toHaveLength(13);
  });

  it('hide는 짝이 아닐 때만, startPlay는 보여 주기 중에만 된다', () => {
    const s = game();
    expect(applyAction(s, { type: 'hide' })).toBe(s);
    expect(applyAction(s, { type: 'startPlay' })).toBe(s);
  });

  it('상태는 JSON으로 저장했다가 불러와도 이어서 할 수 있다', () => {
    const s = applyAction(game(), { type: 'flip', cardId: 2 });
    const loaded = JSON.parse(JSON.stringify(s)) as MemoryState;
    expect(loaded.seen[2].pic).toBe(s.cards[2].pic);
    const other = loaded.cards.find((c) => c.id !== 2 && c.pic === s.cards[2].pic)!.id;
    const t = applyAction(loaded, { type: 'flip', cardId: other });
    expect(t.players[0].pairs).toEqual([s.cards[2].pic]);
  });
});

describe('끝내기와 순위', () => {
  it('마지막 짝을 찾으면 끝나고, 많이 모은 사람이 1등', () => {
    let s = game(['human', 'human'], { extraTurn: true });
    // 0번이 5짝, 1번이 3짝을 가져가게 한다.
    const pics = [...new Set(s.cards.map((c) => c.pic))];
    for (let k = 0; k < pics.length; k++) {
      s.current = k < 5 ? 0 : 1;
      s = flipTwo(s, pairOf(s, pics[k]));
    }
    expect(s.phase).toBe('gameover');
    expect(s.players.map((p) => p.pairs.length)).toEqual([5, 3]);
    expect(s.ranks).toEqual([1, 2]);
    expect(winners(s)).toEqual([0]);
    expect(rankingOrder(s)).toEqual([0, 1]);
    expect(s.events.find((e) => e.type === 'match')).toMatchObject({ again: false });
    expect(s.events.some((e) => e.type === 'end')).toBe(true);
    expect(s.log[s.log.length - 1].text).toContain('우승');
    // 끝난 뒤에는 아무것도 못 한다.
    expect(applyAction(s, { type: 'flip', cardId: 0 })).toBe(s);
    expect(flippableIds(s)).toEqual([]);
  });

  it('짝 수가 같으면 공동 우승', () => {
    let s = game(['human', 'human', 'human']);
    const pics = [...new Set(s.cards.map((c) => c.pic))];
    const owner = [0, 0, 0, 2, 2, 2, 1, 1];
    pics.forEach((pic, k) => {
      s.current = owner[k];
      s = flipTwo(s, pairOf(s, pic));
    });
    expect(s.ranks).toEqual([1, 3, 1]);
    expect(winners(s)).toEqual([0, 2]);
    expect(rankingOrder(s)).toEqual([0, 2, 1]);
    expect(s.log[s.log.length - 1].text).toContain('공동 우승');
  });

  it('등수 매기기: 같은 수는 같은 등수, 다음 등수는 건너뛴다', () => {
    expect(computeRanks([5, 5, 3])).toEqual([1, 1, 3]);
    expect(computeRanks([2, 4, 4, 0])).toEqual([3, 1, 1, 4]);
    expect(computeRanks([3, 3, 3, 3])).toEqual([1, 1, 1, 1]);
    expect(computeRanks([0, 8])).toEqual([2, 1]);
  });
});
