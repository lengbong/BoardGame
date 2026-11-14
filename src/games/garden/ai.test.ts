import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { affordableCards, cardValue, decideAction, type AiLevel } from './ai';
import { CARDS, card } from './cards';
import { DEFAULT_OPTIONS, STORAGE_LIMIT, applyAction, createGame, emptyTokens, legalActions, scoreOf, tokenTotal } from './rules';
import type { GardenAction, GardenOptions, GardenSetup, GardenState, SeatKind, Token, TokenCount } from './types';

const ID = Object.fromEntries(CARDS.map((c) => [c.name, c.id])) as Record<string, number>;
const toks = (t: Partial<TokenCount>): TokenCount => ({ ...emptyTokens(), ...t });

function setup(kinds: SeatKind[], options: Partial<GardenOptions> = {}): GardenSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as GardenSetup['seats'],
    options: { ...DEFAULT_OPTIONS, ...options },
  };
}

function game(kinds: SeatKind[] = ['ai-normal', 'ai-normal']): GardenState {
  const s = createGame(setup(kinds), seededRandom(4));
  s.first = 0;
  s.current = 0;
  return s;
}

function isLegal(s: GardenState, a: GardenAction): boolean {
  if (s.phase === 'discard') return a.type === 'discard' && applyAction(s, a) !== s;
  return legalActions(s).some((x) => JSON.stringify(x) === JSON.stringify(a)) || (a.type === 'plant' && applyAction(s, a) !== s);
}

/** 컴퓨터끼리 끝까지 한다 */
function playOut(kinds: SeatKind[], seed: number, options: Partial<GardenOptions> = {}): GardenState {
  const rng = seededRandom(seed);
  let s = createGame(setup(kinds, options), rng);
  for (let step = 0; step < 2000 && s.phase !== 'gameover'; step++) {
    const a = decideAction(s, s.players[s.current].kind as AiLevel, rng);
    const next = applyAction(s, a, rng);
    if (next === s) throw new Error(`올바르지 않은 행동: ${JSON.stringify(a)}`);
    s = next;
  }
  return s;
}

describe('컴퓨터: 올바른 행동만', () => {
  it('쉬움·보통 모두 게임 내내 올바른 행동만 한다', () => {
    for (const level of ['ai-easy', 'ai-normal'] as AiLevel[]) {
      const rng = seededRandom(level === 'ai-easy' ? 21 : 22);
      let s = createGame(setup([level, level, level]), rng);
      for (let step = 0; step < 400 && s.phase !== 'gameover'; step++) {
        const a = decideAction(s, level, rng);
        expect(isLegal(s, a)).toBe(true);
        s = applyAction(s, a, rng);
      }
    }
  });

  it('할 일이 없으면 쉰다', () => {
    const s = game();
    s.field = Array.from({ length: 9 }, () => null);
    s.bag = emptyTokens();
    s.players[0].greenhouse = [ID['국화'], ID['인삼']];
    expect(decideAction(s, 'ai-normal')).toEqual({ type: 'pass' });
    expect(decideAction(s, 'ai-easy')).toEqual({ type: 'pass' });
  });

  it('바구니가 넘치면 정확히 넘친 만큼, 꿀벌은 지키고 필요 없는 자원부터 돌려놓는다', () => {
    const s = game();
    s.phase = 'discard';
    s.market = [ID['장미'], ID['라벤더'], ID['로즈메리'], ID['해바라기'], ID['나팔꽃'], ID['복숭아나무']];
    s.players[0].tokens = toks({ water: 6, sun: 2, compost: 2, bee: 2 });
    const a = decideAction(s, 'ai-normal');
    expect(a.type).toBe('discard');
    if (a.type !== 'discard') return;
    expect(tokenTotal(a.tokens)).toBe(2);
    expect(a.tokens.bee ?? 0).toBe(0);
    expect(a.tokens.water).toBe(2);
    const e = decideAction(s, 'ai-easy', seededRandom(1));
    expect(e.type === 'discard' && tokenTotal(e.tokens)).toBe(2);
  });
});

describe('컴퓨터: 뻔히 좋은 수', () => {
  it('쉬움도 살 수 있으면 산다', () => {
    const s = game(['ai-easy', 'ai-easy']);
    s.players[0].tokens = toks({ bee: 3 });
    s.market[5] = ID['상추'];
    expect(decideAction(s, 'ai-easy', seededRandom(2)).type).toBe('plant');
  });

  it('보통은 목표 점수에 닿는 식물이 있으면 바로 산다', () => {
    const s = game();
    s.players[0].garden = [ID['국화'], ID['사과나무']];
    s.players[0].tokens = toks({ water: 5, seed: 2 });
    s.market = [ID['상추'], ID['쑥갓'], ID['단풍나무'], ID['냉이'], ID['달래'], ID['쑥']];
    expect(decideAction(s, 'ai-normal')).toEqual({ type: 'plant', cardId: ID['단풍나무'] });
  });

  it('마지막 라운드에는 점수가 가장 큰 식물을 산다', () => {
    const s = game();
    s.endTriggered = true;
    s.players[0].tokens = toks({ bee: 10 });
    s.market = [ID['상추'], ID['쑥갓'], ID['장미'], ID['냉이'], ID['라벤더'], ID['로즈메리']];
    const a = decideAction(s, 'ai-normal');
    expect(a.type).toBe('plant');
    if (a.type === 'plant') expect(card(a.cardId).points).toBe(3);
  });

  it('보통은 노리는 식물을 살 수 있게 해 주는 줄을 거둔다', () => {
    const s = game();
    s.market = [ID['장미'], ID['라벤더'], ID['로즈메리'], ID['무궁화'], ID['복숭아나무'], ID['국화']];
    s.players[0].tokens = toks({ sun: 2, compost: 3 });
    // 장미: ☀️2 🪱5 → 🪱 2개가 모자란다. 가로 2줄에 거름이 둘
    s.field = ['water', 'seed', 'water', 'compost', 'compost', 'seed', 'water', 'water', 'seed'];
    expect(decideAction(s, 'ai-normal')).toEqual({ type: 'harvest', line: 'r1' });
  });

  it('보통은 상대가 지금 살 수 있는 값진 식물을 온실에 맡아 둔다', () => {
    const s = game();
    s.market = [ID['상추'], ID['쑥갓'], ID['사과나무'], ID['냉이'], ID['달래'], ID['쑥']];
    s.players[0].garden = [ID['캐모마일'], ID['박하'], ID['매화나무']];
    s.players[0].tokens = toks({ sun: 3 });
    s.players[1].tokens = toks({ sun: 6, compost: 2 });
    s.field = Array.from({ length: 9 }, () => 'water' as Token);
    expect(decideAction(s, 'ai-normal')).toEqual({ type: 'reserve', cardId: ID['사과나무'] });
  });

  it('상장을 마저 채우는 식물을 더 값지게 본다', () => {
    const s = game();
    s.ribbons = [{ goal: 'trees3', owner: null }];
    s.players[0].garden = [ID['매화나무'], ID['무궁화']];
    expect(cardValue(s, 0, card(ID['자두나무']))).toBeGreaterThan(cardValue(s, 0, card(ID['나팔꽃'])) + 2);
    expect(affordableCards(s, 0)).toEqual([]);
  });
});

describe('컴퓨터끼리 끝까지', () => {
  it('2~4명, 여러 시드에서 끝까지 가고 우승자가 있다', () => {
    const tables: SeatKind[][] = [
      ['ai-normal', 'ai-easy'],
      ['ai-easy', 'ai-normal', 'ai-normal'],
      ['ai-normal', 'ai-normal', 'ai-easy', 'ai-normal'],
      ['ai-easy', 'ai-easy', 'ai-easy', 'ai-easy'],
    ];
    tables.forEach((kinds, k) => {
      for (let seed = 1; seed <= 6; seed++) {
        const s = playOut(kinds, seed * 13 + k);
        expect(s.phase).toBe('gameover');
        expect(s.winners.length).toBeGreaterThan(0);
        const best = Math.max(...s.players.map((_, i) => scoreOf(s, i)));
        for (const w of s.winners) expect(scoreOf(s, w)).toBe(best);
        for (const p of s.players) expect(tokenTotal(p.tokens)).toBeLessThanOrEqual(STORAGE_LIMIT);
      }
    });
  });

  it('변형 규칙(목표 12·18점, 떨이·상장 끄기)으로도 끝까지 간다', () => {
    const a = playOut(['ai-normal', 'ai-normal'], 7, { target: 12, sale: false });
    const b = playOut(['ai-normal', 'ai-easy', 'ai-normal'], 8, { target: 18, ribbons: false });
    expect(a.phase).toBe('gameover');
    expect(b.phase).toBe('gameover');
    expect(Math.max(...b.players.map((_, i) => scoreOf(b, i)))).toBeGreaterThanOrEqual(18);
  });

  it('보통이 쉬움보다 자주 이긴다', () => {
    let normal = 0;
    let easy = 0;
    const games = 120;
    for (let seed = 1; seed <= games; seed++) {
      const normalFirst = seed % 2 === 1;
      const s = playOut(normalFirst ? ['ai-normal', 'ai-easy'] : ['ai-easy', 'ai-normal'], 500 + seed);
      const ni = normalFirst ? 0 : 1;
      if (s.winners.includes(ni)) normal++;
      if (s.winners.includes(1 - ni)) easy++;
    }
    expect(normal).toBeGreaterThan(easy * 2.5);
  });
});
