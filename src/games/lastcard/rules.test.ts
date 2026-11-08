import { describe, expect, it } from 'vitest';
import { decideAction } from './ai';
import { cardPoints, createDeck, handPoints, shuffle, sortHand } from './cards';
import { DEFAULT_OPTIONS, applyAction, canCall, createGame, matches, nextIndex, playableCards, topCard } from './rules';
import type { Card, CardColor, CardKind, LastCardOptions, LastCardSetup, LastCardState, SeatKind } from './types';

/** 시드 고정 난수 (mulberry32) */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const zero = () => 0;

function setup(kinds: SeatKind[], options: Partial<LastCardOptions> = {}): LastCardSetup {
  return {
    seats: kinds.map((kind, i) => ({ kind, name: `P${i}` })) as LastCardSetup['seats'],
    options: { ...DEFAULT_OPTIONS, ...options },
  };
}

let nextId = 1000;
function card(color: CardColor | null, kind: CardKind | number): Card {
  if (typeof kind === 'number') return { id: nextId++, kind: 'number', color, value: kind };
  return { id: nextId++, kind, color, value: -1 };
}
const wild = () => card(null, 'wild');
const wild4 = () => card(null, 'wild4');

/**
 * 원하는 손패와 맨 위 카드로 게임을 만든다. 0번 사람 차례.
 * 뽑을 카드 더미는 drawPile로 정할 수 있다 (배열 끝이 맨 위).
 */
function game(
  hands: Card[][],
  top: Card,
  opts: Partial<LastCardOptions> = {},
  drawPile?: Card[],
): LastCardState {
  const kinds: SeatKind[] = ['human', 'human', 'human', 'human'].map((k, i) => (i < hands.length ? k : 'empty')) as SeatKind[];
  const s = createGame(setup(kinds, opts), zero);
  s.players.forEach((p, i) => (p.hand = hands[i]));
  s.discard = [top];
  s.activeColor = top.color ?? 'red';
  s.current = 0;
  s.events = [];
  if (drawPile) s.drawPile = drawPile;
  return s;
}

function totalCards(s: LastCardState): number {
  return s.drawPile.length + s.discard.length + s.players.reduce((n, p) => n + p.hand.length, 0);
}

describe('카드 더미', () => {
  it('108장이고 id가 모두 다르다', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(108);
    expect(new Set(deck.map((c) => c.id)).size).toBe(108);
  });

  it('색마다 25장, 색 바꾸기와 +4가 4장씩', () => {
    const deck = createDeck();
    for (const color of ['red', 'yellow', 'green', 'blue'] as const) {
      const cs = deck.filter((c) => c.color === color);
      expect(cs).toHaveLength(25);
      expect(cs.filter((c) => c.kind === 'number' && c.value === 0)).toHaveLength(1);
      expect(cs.filter((c) => c.kind === 'number' && c.value === 7)).toHaveLength(2);
      for (const kind of ['skip', 'reverse', 'draw2'] as const) expect(cs.filter((c) => c.kind === kind)).toHaveLength(2);
    }
    expect(deck.filter((c) => c.kind === 'wild')).toHaveLength(4);
    expect(deck.filter((c) => c.kind === 'wild4')).toHaveLength(4);
  });

  it('점수: 숫자는 그 수, 기능 카드 20, 색 바꾸기 50', () => {
    expect(cardPoints(card('red', 7))).toBe(7);
    expect(cardPoints(card('red', 'skip'))).toBe(20);
    expect(cardPoints(card('red', 'draw2'))).toBe(20);
    expect(cardPoints(wild())).toBe(50);
    expect(cardPoints(wild4())).toBe(50);
    expect(handPoints(createDeck())).toBe(4 * (90 + 120) + 8 * 50);
  });

  it('섞어도 카드는 그대로이고 원본은 바뀌지 않는다', () => {
    const deck = createDeck();
    const mixed = shuffle(deck, seeded(3));
    expect(mixed.map((c) => c.id).sort((a, b) => a - b)).toEqual(deck.map((c) => c.id));
    expect(deck[0].id).toBe(0);
  });

  it('손패 정렬: 색 → 숫자 → 기능, 색 바꾸기는 끝', () => {
    const sorted = sortHand([wild(), card('blue', 3), card('red', 'skip'), card('red', 9), card('red', 1)]);
    expect(sorted.map((c) => `${c.color}-${c.kind}-${c.value}`)).toEqual([
      'red-number-1',
      'red-number-9',
      'red-skip--1',
      'blue-number-3',
      'null-wild--1',
    ]);
  });
});

describe('게임 시작', () => {
  it('7장씩 나눠 주고 숫자 카드 한 장을 펼친다', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createGame(setup(['human', 'ai-normal', 'ai-easy', 'empty']), seeded(seed));
      expect(s.players).toHaveLength(3);
      expect(s.players.every((p) => p.hand.length === 7)).toBe(true);
      expect(s.discard).toHaveLength(1);
      expect(topCard(s).kind).toBe('number');
      expect(s.activeColor).toBe(topCard(s).color);
      expect(totalCards(s)).toBe(108);
      expect(s.phase).toBe('play');
      expect(s.round).toBe(1);
    }
  });

  it('2명보다 적으면 시작할 수 없다', () => {
    expect(() => createGame(setup(['human', 'empty', 'empty', 'empty']))).toThrow();
  });

  it('이름이 비어 있으면 자리 색 이름을 쓴다', () => {
    const st = setup(['human', 'human', 'empty', 'empty']);
    st.seats[0].name = '  ';
    expect(createGame(st, zero).players[0].name).toBe('빨강');
  });
});

describe('낼 수 있는 카드', () => {
  it('같은 색, 같은 숫자, 같은 기능, 색 바꾸기', () => {
    const s = game([[], []], card('red', 5));
    expect(matches(s, card('red', 9))).toBe(true);
    expect(matches(s, card('blue', 5))).toBe(true);
    expect(matches(s, card('blue', 6))).toBe(false);
    expect(matches(s, card('blue', 'skip'))).toBe(false);
    expect(matches(s, wild())).toBe(true);
    expect(matches(s, wild4())).toBe(true);

    const t = game([[], []], card('green', 'reverse'));
    expect(matches(t, card('blue', 'reverse'))).toBe(true);
    expect(matches(t, card('blue', 'skip'))).toBe(false);
  });

  it('색 바꾸기 뒤에는 정한 색을 따른다', () => {
    const s = game([[], []], wild());
    s.activeColor = 'yellow';
    expect(matches(s, card('yellow', 2))).toBe(true);
    expect(matches(s, card('red', 2))).toBe(false);
  });

  it('누적 중에는 +2 위에 +2·+4, +4 위에는 +4만', () => {
    const s = game([[], []], card('red', 'draw2'), { stacking: true });
    s.pendingDraw = 2;
    expect(matches(s, card('blue', 'draw2'))).toBe(true);
    expect(matches(s, wild4())).toBe(true);
    expect(matches(s, card('red', 3))).toBe(false);
    expect(matches(s, wild())).toBe(false);

    const t = game([[], []], wild4(), { stacking: true });
    t.pendingDraw = 4;
    expect(matches(t, wild4())).toBe(true);
    expect(matches(t, card('red', 'draw2'))).toBe(false);
  });
});

describe('카드 내기', () => {
  it('숫자 카드를 내면 다음 사람 차례', () => {
    const r5 = card('red', 5);
    const s = game([[r5, card('blue', 1), card('blue', 2)], [card('green', 1)], [card('green', 2)]], card('red', 3));
    const after = applyAction(s, { type: 'play', cardId: r5.id });
    expect(after.current).toBe(1);
    expect(topCard(after).id).toBe(r5.id);
    expect(after.players[0].hand).toHaveLength(2);
    expect(after.events.map((e) => e.type)).toEqual(['play']);
    expect(after.turn).toBe(s.turn + 1);
  });

  it('낼 수 없는 카드는 무시하고 원래 상태를 그대로 돌려준다', () => {
    const b6 = card('blue', 6);
    const s = game([[b6, card('blue', 1)], [card('green', 1)]], card('red', 3));
    expect(applyAction(s, { type: 'play', cardId: b6.id })).toBe(s);
    expect(applyAction(s, { type: 'play', cardId: 99999 })).toBe(s);
    expect(applyAction(s, { type: 'pass' })).toBe(s);
    expect(applyAction(s, { type: 'nextRound' })).toBe(s);
  });

  it('행동을 적용해도 원래 상태는 바뀌지 않는다', () => {
    const r5 = card('red', 5);
    const s = game([[r5, card('blue', 1), card('blue', 2)], [card('green', 1)]], card('red', 3));
    const snapshot = JSON.stringify(s);
    applyAction(s, { type: 'play', cardId: r5.id });
    applyAction(s, { type: 'draw' });
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('건너뛰기: 다음 사람을 건너뛴다', () => {
    const skip = card('red', 'skip');
    const s = game([[skip, card('blue', 1), card('blue', 2)], [card('green', 1)], [card('green', 2)]], card('red', 3));
    const after = applyAction(s, { type: 'play', cardId: skip.id });
    expect(after.current).toBe(2);
    expect(after.events.some((e) => e.type === 'skip' && e.player === 1)).toBe(true);
  });

  it('방향 바꾸기: 3명 이상이면 반대 방향으로 간다', () => {
    const rev = card('red', 'reverse');
    const s = game([[rev, card('blue', 1), card('blue', 2)], [card('green', 1)], [card('green', 2)]], card('red', 3));
    const after = applyAction(s, { type: 'play', cardId: rev.id });
    expect(after.direction).toBe(-1);
    expect(after.current).toBe(2);
    expect(nextIndex(after, 2)).toBe(1);
  });

  it('방향 바꾸기: 2명이면 한 번 더 한다', () => {
    const rev = card('red', 'reverse');
    const s = game([[rev, card('blue', 1), card('blue', 2)], [card('green', 1)]], card('red', 3));
    const after = applyAction(s, { type: 'play', cardId: rev.id });
    expect(after.current).toBe(0);
    expect(after.turn).toBe(s.turn + 1);
  });

  it('+2: 다음 사람이 2장 받고 쉰다', () => {
    const d2 = card('red', 'draw2');
    const s = game([[d2, card('blue', 1), card('blue', 2)], [card('green', 1)], [card('green', 2)]], card('red', 3));
    const after = applyAction(s, { type: 'play', cardId: d2.id });
    expect(after.players[1].hand).toHaveLength(3);
    expect(after.current).toBe(2);
    expect(totalCards(after)).toBe(totalCards(s));
  });

  it('색 바꾸기: 색을 정해야 하고, 정한 색이 지금 색이 된다', () => {
    const w = wild();
    const s = game([[w, card('blue', 1), card('blue', 2)], [card('green', 1)]], card('red', 3));
    expect(applyAction(s, { type: 'play', cardId: w.id })).toBe(s);
    const after = applyAction(s, { type: 'play', cardId: w.id, color: 'blue' });
    expect(after.activeColor).toBe('blue');
    expect(after.events.some((e) => e.type === 'color' && e.color === 'blue')).toBe(true);
    expect(after.current).toBe(1);
  });

  it('+4: 색을 바꾸고 다음 사람이 4장 받고 쉰다', () => {
    const w4 = wild4();
    const s = game([[w4, card('blue', 1), card('blue', 2)], [card('green', 1)], [card('green', 2)]], card('red', 3));
    const after = applyAction(s, { type: 'play', cardId: w4.id, color: 'green' });
    expect(after.activeColor).toBe('green');
    expect(after.players[1].hand).toHaveLength(5);
    expect(after.current).toBe(2);
  });
});

describe('+2·+4 누적', () => {
  it('+2를 받은 사람이 +2를 이어 내면 다음 사람에게 4장이 넘어간다', () => {
    const a = card('red', 'draw2');
    const b = card('blue', 'draw2');
    const s = game(
      [[a, card('red', 1), card('red', 2)], [b, card('green', 1), card('green', 2)], [card('yellow', 5), card('yellow', 6)]],
      card('red', 3),
      { stacking: true },
    );
    const s1 = applyAction(s, { type: 'play', cardId: a.id });
    expect(s1.current).toBe(1);
    expect(s1.pendingDraw).toBe(2);
    expect(s1.players[1].hand).toHaveLength(3);
    expect(playableCards(s1).map((c) => c.id)).toEqual([b.id]);

    const s2 = applyAction(s1, { type: 'play', cardId: b.id });
    expect(s2.current).toBe(2);
    expect(s2.pendingDraw).toBe(4);
    expect(playableCards(s2)).toEqual([]);

    const s3 = applyAction(s2, { type: 'draw' });
    expect(s3.players[2].hand).toHaveLength(6);
    expect(s3.pendingDraw).toBe(0);
    expect(s3.current).toBe(0);
    expect(s3.phase).toBe('play');
  });

  it('+2 위에 +4를 이어 낼 수 있다', () => {
    const a = card('red', 'draw2');
    const w4 = wild4();
    const s = game([[a, card('red', 1), card('red', 2)], [w4, card('green', 1), card('green', 2)], [card('yellow', 5)]], card('red', 3), {
      stacking: true,
    });
    const s1 = applyAction(s, { type: 'play', cardId: a.id });
    const s2 = applyAction(s1, { type: 'play', cardId: w4.id, color: 'yellow' });
    expect(s2.pendingDraw).toBe(6);
    expect(s2.activeColor).toBe('yellow');
  });
});

describe('카드 뽑기', () => {
  it('뽑은 카드를 낼 수 없으면 자동으로 다음 사람 차례', () => {
    const s = game([[card('blue', 1)], [card('green', 1)]], card('red', 3), {}, [card('yellow', 8)]);
    const after = applyAction(s, { type: 'draw' });
    expect(after.players[0].hand).toHaveLength(2);
    expect(after.current).toBe(1);
    expect(after.phase).toBe('play');
  });

  it('뽑은 카드를 낼 수 있으면 내거나 넘길 수 있다', () => {
    const r8 = card('red', 8);
    const b1 = card('blue', 1);
    const s = game([[b1], [card('green', 1)]], card('red', 3), {}, [r8]);
    const drawn = applyAction(s, { type: 'draw' });
    expect(drawn.phase).toBe('drawn');
    expect(drawn.drawnCardId).toBe(r8.id);
    expect(drawn.current).toBe(0);
    // 뽑은 카드만 낼 수 있다
    expect(playableCards(drawn).map((c) => c.id)).toEqual([r8.id]);
    expect(applyAction(drawn, { type: 'play', cardId: b1.id })).toBe(drawn);

    const passed = applyAction(drawn, { type: 'pass' });
    expect(passed.current).toBe(1);
    expect(passed.players[0].hand).toHaveLength(2);

    const played = applyAction(drawn, { type: 'play', cardId: r8.id, call: true });
    expect(topCard(played).id).toBe(r8.id);
    expect(played.players[0].hand).toHaveLength(1);
  });

  it('뽑을 카드가 없으면 버린 카드를 섞어서 채운다', () => {
    const under = [card('green', 4), card('yellow', 9), card('blue', 2)];
    const s = game([[card('blue', 1)], [card('green', 1)]], card('red', 3), {}, []);
    s.discard = [...under, card('red', 3)];
    const after = applyAction(s, { type: 'draw' }, seeded(1));
    expect(after.events[0].type).toBe('reshuffle');
    expect(after.discard).toHaveLength(1);
    expect(topCard(after).color).toBe('red');
    expect(after.drawPile).toHaveLength(2);
    expect(after.players[0].hand).toHaveLength(2);
  });

  it('카드가 하나도 없으면 그냥 넘어간다', () => {
    const s = game([[card('blue', 1)], [card('green', 1)]], card('red', 3), {}, []);
    const after = applyAction(s, { type: 'draw' });
    expect(after.current).toBe(1);
    expect(after.players[0].hand).toHaveLength(1);
    expect(after.events.map((e) => e.type)).toEqual(['pass']);
  });
});

describe('한 장 외치기', () => {
  const pile = () => [card('yellow', 1), card('yellow', 2), card('yellow', 3)];

  it('카드가 2장일 때만 외칠 수 있다', () => {
    const s = game([[card('red', 1), card('red', 2)], [card('green', 1)]], card('red', 3));
    expect(canCall(s)).toBe(true);
    const called = applyAction(s, { type: 'call' });
    expect(called.called).toBe(true);
    expect(called.events.map((e) => e.type)).toEqual(['call']);
    expect(canCall(called)).toBe(false);

    const t = game([[card('red', 1), card('red', 2), card('red', 4)], [card('green', 1)]], card('red', 3));
    expect(canCall(t)).toBe(false);
    expect(applyAction(t, { type: 'call' })).toBe(t);
  });

  it('외치고 내면 벌칙이 없다', () => {
    const r1 = card('red', 1);
    const s = game([[r1, card('red', 2)], [card('green', 1)]], card('red', 3), {}, pile());
    const after = applyAction(applyAction(s, { type: 'call' }), { type: 'play', cardId: r1.id });
    expect(after.players[0].hand).toHaveLength(1);
  });

  it('내면서 같이 외칠 수도 있다 (컴퓨터용)', () => {
    const r1 = card('red', 1);
    const s = game([[r1, card('red', 2)], [card('green', 1)]], card('red', 3), {}, pile());
    const after = applyAction(s, { type: 'play', cardId: r1.id, call: true });
    expect(after.players[0].hand).toHaveLength(1);
    expect(after.events.map((e) => e.type)).toEqual(['call', 'play']);
  });

  it('깜빡하면 2장을 받는다', () => {
    const r1 = card('red', 1);
    const s = game([[r1, card('red', 2)], [card('green', 1)]], card('red', 3), {}, pile());
    const after = applyAction(s, { type: 'play', cardId: r1.id });
    expect(after.players[0].hand).toHaveLength(3);
    expect(after.events.some((e) => e.type === 'draw' && e.reason === 'forgot' && e.count === 2)).toBe(true);
    expect(after.current).toBe(1);
  });

  it('외치기 규칙을 끄면 자동으로 외친다', () => {
    const r1 = card('red', 1);
    const s = game([[r1, card('red', 2)], [card('green', 1)]], card('red', 3), { callRule: false }, pile());
    expect(canCall(s)).toBe(false);
    const after = applyAction(s, { type: 'play', cardId: r1.id });
    expect(after.players[0].hand).toHaveLength(1);
    expect(after.events.some((e) => e.type === 'call')).toBe(true);
  });

  it('외친 것은 그 차례에만 유효하다', () => {
    const s = game([[card('red', 1), card('red', 2)], [card('green', 1)]], card('red', 3), {}, [card('yellow', 8)]);
    const called = applyAction(s, { type: 'call' });
    const drawn = applyAction(called, { type: 'draw' });
    expect(drawn.current).toBe(1);
    expect(drawn.called).toBe(false);
  });
});

describe('판 끝내기', () => {
  it('한 판 승부: 카드를 다 내면 우승, 나머지는 남은 점수가 적은 순서', () => {
    const last = card('red', 9);
    const s = game(
      [[last], [card('green', 1), wild()], [card('green', 2)], [card('blue', 'skip')]],
      card('red', 3),
    );
    const after = applyAction(s, { type: 'play', cardId: last.id });
    expect(after.phase).toBe('gameover');
    expect(after.rankings).toEqual([0, 2, 3, 1]);
    expect(after.roundResult).toEqual({ winner: 0, points: 51 + 2 + 20, handPoints: [0, 51, 2, 20] });
    expect(after.players[0].score).toBe(73);
    expect(applyAction(after, { type: 'draw' })).toBe(after);
  });

  it('마지막 카드가 +2면 다음 사람이 받고 끝난다', () => {
    const d2 = card('red', 'draw2');
    const s = game([[d2], [card('green', 1)]], card('red', 3), {}, [card('blue', 5), card('blue', 6)]);
    const after = applyAction(s, { type: 'play', cardId: d2.id });
    expect(after.phase).toBe('gameover');
    expect(after.players[1].hand).toHaveLength(3);
    expect(after.roundResult!.points).toBe(1 + 5 + 6);
  });

  it('점수 모으기: 목표에 못 미치면 다음 판, 시작하는 사람이 바뀐다', () => {
    const last = card('red', 9);
    const s = game([[last], [card('green', 1)], [card('green', 2)]], card('red', 3), { endMode: 'points', targetScore: 200 });
    s.starter = 0;
    const over = applyAction(s, { type: 'play', cardId: last.id });
    expect(over.phase).toBe('roundover');
    expect(over.players[0].score).toBe(3);
    expect(applyAction(over, { type: 'draw' })).toBe(over);

    const next = applyAction(over, { type: 'nextRound' }, seeded(5));
    expect(next.round).toBe(s.round + 1);
    expect(next.phase).toBe('play');
    expect(next.starter).toBe(1);
    expect(next.current).toBe(1);
    expect(next.players.every((p) => p.hand.length === 7)).toBe(true);
    expect(next.players[0].score).toBe(3);
    expect(totalCards(next)).toBe(108);
  });

  it('점수 모으기: 이긴 사람이 목표 점수에 닿으면 점수 순으로 순위', () => {
    const last = card('red', 9);
    const s = game([[last], [wild(), wild4()], [card('green', 2)]], card('red', 3), { endMode: 'points', targetScore: 200 });
    s.players[0].score = 50;
    s.players[2].score = 160;
    const after = applyAction(s, { type: 'play', cardId: last.id });
    expect(after.players[0].score).toBe(152);
    expect(after.phase).toBe('roundover');

    s.players[0].score = 100;
    const won = applyAction(s, { type: 'play', cardId: last.id });
    expect(won.phase).toBe('gameover');
    expect(won.players[0].score).toBe(202);
    expect(won.rankings).toEqual([0, 2, 1]);
  });
});

describe('끝까지 해 보기', () => {
  function playOut(seed: number, kinds: SeatKind[], opts: Partial<LastCardOptions> = {}) {
    const rng = seeded(seed);
    let s = createGame(setup(kinds, opts), rng);
    let steps = 0;
    while (s.phase !== 'gameover' && steps < 5000) {
      const p = s.players[s.current];
      const level = p.kind === 'ai-easy' ? 'ai-easy' : 'ai-normal';
      const next = applyAction(s, decideAction(s, level, rng), rng);
      expect(next).not.toBe(s);
      expect(totalCards(next)).toBe(108);
      s = next;
      steps++;
    }
    return { s, steps };
  }

  it('컴퓨터끼리 해도 언제나 끝난다 (기본 규칙)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { s } = playOut(seed, ['ai-normal', 'ai-easy', 'ai-normal', 'ai-easy']);
      expect(s.phase).toBe('gameover');
      expect(s.players[s.rankings[0]].hand).toHaveLength(0);
    }
  });

  it('누적 규칙과 외치기 없음, 2명', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { s } = playOut(seed, ['ai-easy', 'empty', 'ai-normal', 'empty'], { stacking: true, callRule: false });
      expect(s.phase).toBe('gameover');
    }
  });

  it('점수 모으기 (여러 판)', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { s } = playOut(seed, ['ai-normal', 'ai-easy', 'ai-normal', 'empty'], { endMode: 'points', targetScore: 200, stacking: true });
      expect(s.phase).toBe('gameover');
      expect(s.players[s.rankings[0]].score).toBeGreaterThanOrEqual(200);
    }
  });
});
