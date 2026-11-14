import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { CARDS, GOALS, GOAL_IDS, RES, TOKENS, card, costTotal, goalMet } from './cards';
import {
  BAG_BEES,
  BAG_PER_RES,
  DEFAULT_OPTIONS,
  HIVE_BEES,
  MARKET_SIZE,
  STORAGE_LIMIT,
  applyAction,
  autoDiscard,
  createGame,
  discardNeed,
  effectiveCost,
  emptyTokens,
  findWinners,
  isOnSale,
  legalActions,
  lineCells,
  payment,
  production,
  scoreOf,
  shortfall,
  tokenTotal,
} from './rules';
import type { GardenOptions, GardenSetup, GardenState, SeatKind, Token, TokenCount } from './types';

const ID = Object.fromEntries(CARDS.map((c) => [c.name, c.id])) as Record<string, number>;

function setup(kinds: SeatKind[], options: Partial<GardenOptions> = {}): GardenSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: kinds[i] ? `P${i}` : '' })) as GardenSetup['seats'],
    options: { ...DEFAULT_OPTIONS, ...options },
  };
}

/** 2인 게임, 0번 자리부터 */
function game(options: Partial<GardenOptions> = {}, n = 2): GardenState {
  const s = createGame(setup(Array.from({ length: n }, () => 'human' as SeatKind), options), seededRandom(3));
  s.first = 0;
  s.current = 0;
  s.log = [];
  return s;
}

const toks = (t: Partial<TokenCount>): TokenCount => ({ ...emptyTokens(), ...t });

/** 판 위의 모든 토큰 수 (주머니 + 텃밭 + 바구니 + 벌통) */
function tokenCensus(s: GardenState): number {
  return tokenTotal(s.bag) + s.field.filter((t) => t !== null).length + s.players.reduce((a, p) => a + tokenTotal(p.tokens), 0) + s.hive;
}

describe('식물 카드와 상장', () => {
  it('48장: 계절마다 16장, 자원마다 4장씩 만들고 이름이 모두 다르다', () => {
    expect(CARDS).toHaveLength(48);
    expect(new Set(CARDS.map((c) => c.name)).size).toBe(48);
    for (const season of [1, 2, 3]) {
      const list = CARDS.filter((c) => c.season === season);
      expect(list).toHaveLength(16);
      for (const r of RES) expect(list.filter((c) => c.produce === r)).toHaveLength(4);
    }
  });

  it('값은 2~8개, 봄 0~1점 · 여름 1~3점 · 가을 3~5점', () => {
    for (const c of CARDS) {
      expect(costTotal(c.cost)).toBeGreaterThanOrEqual(2);
      expect(costTotal(c.cost)).toBeLessThanOrEqual(8);
      // 값은 두 가지 이상의 자원을 섞는다
      expect(RES.filter((r) => c.cost[r] > 0).length).toBeGreaterThanOrEqual(2);
      const [lo, hi] = c.season === 1 ? [0, 1] : c.season === 2 ? [1, 3] : [3, 5];
      expect(c.points).toBeGreaterThanOrEqual(lo);
      expect(c.points).toBeLessThanOrEqual(hi);
    }
    // 덤이 있는 식물은 몇 장뿐
    expect(CARDS.filter((c) => c.bonus).length).toBe(6);
  });

  it('상장 조건을 바르게 센다', () => {
    const cs = (names: string[]) => names.map((n) => card(ID[n]));
    expect(goalMet('flowers4', cs(['개나리', '진달래', '튤립']))).toBe(false);
    expect(goalMet('flowers4', cs(['개나리', '진달래', '튤립', '장미']))).toBe(true);
    expect(goalMet('allKinds', cs(['개나리', '상추', '쑥', '매화나무']))).toBe(true);
    expect(goalMet('allKinds', cs(['개나리', '상추', '쑥', '박하']))).toBe(false);
    // 같은 자원(💧)을 만드는 식물 4장
    expect(goalMet('sameRes4', cs(['개나리', '시금치', '쑥갓', '캐모마일']))).toBe(true);
    expect(goalMet('veggieHerb', cs(['상추', '시금치', '쑥갓', '쑥']))).toBe(false);
    expect(goalMet('veggieHerb', cs(['상추', '시금치', '쑥갓', '쑥', '박하']))).toBe(true);
    expect(GOALS.seasons.progress(cs(['개나리', '진달래', '장미', '국화', '인삼']))).toEqual({ have: 5, need: 6 });
    expect(goalMet('autumn3', cs(['국화', '인삼', '무']))).toBe(true);
    expect(GOAL_IDS).toHaveLength(8);
  });
});

describe('게임 준비', () => {
  it('시장 6장은 모두 봄, 더미는 봄 → 여름 → 가을 순서', () => {
    const s = createGame(setup(['human', 'ai-easy', 'empty', 'ai-normal']), seededRandom(9));
    expect(s.players.map((p) => p.seat)).toEqual([0, 1, 3]);
    expect(s.market).toHaveLength(MARKET_SIZE);
    expect(s.market.every((id) => card(id).season === 1)).toBe(true);
    const seasons = s.deck.map((id) => card(id).season);
    expect(seasons).toEqual([...seasons].sort());
    expect(s.deck).toHaveLength(48 - MARKET_SIZE);
    expect(s.ribbons).toHaveLength(3);
    expect(new Set(s.ribbons.map((r) => r.goal)).size).toBe(3);
    expect(s.field.every((t) => t !== null)).toBe(true);
    expect(tokenTotal(s.bag)).toBe(BAG_PER_RES * 4 + BAG_BEES - 9);
    expect(s.hive).toBe(HIVE_BEES);
    expect(s.current).toBe(s.first);
  });

  it('상장을 끄면 상장이 없다', () => {
    const s = createGame(setup(['human', 'human'], { ribbons: false }), seededRandom(1));
    expect(s.ribbons).toEqual([]);
  });

  it('상태는 JSON으로 저장했다가 그대로 되살릴 수 있다', () => {
    const s = createGame(setup(['human', 'ai-normal', 'ai-easy']), seededRandom(5));
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('거두기', () => {
  it('가로·세로 줄의 칸 번호', () => {
    expect(lineCells('r0')).toEqual([0, 1, 2]);
    expect(lineCells('r2')).toEqual([6, 7, 8]);
    expect(lineCells('c1')).toEqual([1, 4, 7]);
  });

  it('줄의 토큰 3개를 가져오고 빈칸은 주머니에서 채운다 (토큰 수는 그대로)', () => {
    const s = game();
    s.field = ['water', 'sun', 'seed', 'compost', 'bee', 'water', 'sun', 'seed', 'compost'];
    const before = tokenCensus(s);
    const bag = tokenTotal(s.bag);
    const t = applyAction(s, { type: 'harvest', line: 'c1' }, seededRandom(1));
    expect(t.players[0].tokens).toEqual(toks({ sun: 1, bee: 1, seed: 1 }));
    expect(t.field.every((x) => x !== null)).toBe(true);
    expect(tokenTotal(t.bag)).toBe(bag - 3);
    expect(tokenCensus(t)).toBe(before);
    expect(t.current).toBe(1);
    expect(t.events.map((e) => e.type)).toEqual(['harvest', 'refill']);
  });

  it('주머니가 비면 빈칸은 비어 있고, 빈 줄은 거둘 수 없다', () => {
    const s = game();
    s.bag = emptyTokens();
    s.field = ['water', null, null, 'sun', 'sun', 'sun', 'seed', 'seed', 'seed'];
    const t = applyAction(s, { type: 'harvest', line: 'r0' });
    expect(t.players[0].tokens.water).toBe(1);
    expect(t.field.slice(0, 3)).toEqual([null, null, null]);
    const u = applyAction(t, { type: 'harvest', line: 'r0' });
    expect(u).toBe(t);
    expect(legalActions(t).some((a) => a.type === 'harvest' && a.line === 'r0')).toBe(false);
  });

  it('바구니가 10개를 넘으면 넘친 만큼 돌려놓아야 차례가 끝난다', () => {
    const s = game();
    s.players[0].tokens = toks({ water: 4, sun: 4 });
    s.field = ['seed', 'seed', 'bee', 'water', 'water', 'water', 'sun', 'sun', 'sun'];
    const t = applyAction(s, { type: 'harvest', line: 'r0' });
    expect(t.phase).toBe('discard');
    expect(t.current).toBe(0);
    expect(discardNeed(t)).toBe(1);
    // 개수가 틀리거나 없는 토큰은 안 된다
    expect(applyAction(t, { type: 'discard', tokens: { water: 2 } })).toBe(t);
    expect(applyAction(t, { type: 'discard', tokens: { compost: 1 } })).toBe(t);
    expect(applyAction(t, { type: 'harvest', line: 'r1' })).toBe(t);
    const bag = t.bag.water;
    const u = applyAction(t, { type: 'discard', tokens: { water: 1 } });
    expect(tokenTotal(u.players[0].tokens)).toBe(STORAGE_LIMIT);
    expect(u.bag.water).toBe(bag + 1);
    expect(u.phase).toBe('play');
    expect(u.current).toBe(1);
  });

  it('자동 돌려놓기는 가장 많은 자원부터, 꿀벌은 지킨다', () => {
    const s = game();
    s.phase = 'discard';
    s.players[0].tokens = toks({ water: 6, sun: 3, bee: 3 });
    expect(autoDiscard(s)).toEqual({ water: 2 });
  });
});

describe('값 치르기', () => {
  it('심은 식물의 생산만큼 값이 깎이고 0 밑으로는 내려가지 않는다', () => {
    const p = { garden: [ID['개나리'], ID['시금치'], ID['튤립']], tokens: emptyTokens() };
    expect(production(p)).toEqual({ water: 2, sun: 1, seed: 0, compost: 0 });
    expect(effectiveCost(p, card(ID['캐모마일']))).toEqual({ water: 0, sun: 2, seed: 0, compost: 0 });
  });

  it('모자란 자원은 꿀벌로 메우고, 꿀벌도 모자라면 살 수 없다', () => {
    const c = card(ID['진달래']); // 💧1 🪱2
    expect(payment({ garden: [], tokens: toks({ water: 1, compost: 1, bee: 1 }) }, c, false)?.paid).toEqual(toks({ water: 1, compost: 1, bee: 1 }));
    expect(payment({ garden: [], tokens: toks({ water: 1, compost: 1 }) }, c, false)).toBeNull();
    expect(shortfall({ garden: [], tokens: toks({ water: 1 }) }, c, false)).toMatchObject({ total: 2, short: 2 });
  });

  it('떨이는 모자란 자원을 먼저 하나 깎아 꿀벌을 아낀다', () => {
    const c = card(ID['진달래']); // 💧1 🪱2
    const p = { garden: [], tokens: toks({ water: 1, compost: 1, bee: 1 }) };
    const pay = payment(p, c, true)!;
    expect(pay.saleUsed).toBe('compost');
    expect(pay.paid).toEqual(toks({ water: 1, compost: 1 }));
    // 직접 고를 수도 있다
    expect(payment(p, c, true, 'water')!.paid).toEqual(toks({ compost: 1, bee: 1 }));
    expect(shortfall({ garden: [], tokens: toks({ water: 1, compost: 1 }) }, c, true).short).toBe(0);
  });

  it('시장 줄 맨 끝 두 장만 떨이, 끄면 떨이가 없다', () => {
    const s = game();
    expect(s.market.map((id) => isOnSale(s, id))).toEqual([false, false, false, false, true, true]);
    const off = game({ sale: false });
    expect(off.market.some((id) => isOnSale(off, id))).toBe(false);
  });
});

describe('심기와 꽃시장', () => {
  it('산 자리 뒤의 카드가 앞으로 밀리고 새 카드가 줄 앞에 들어온다', () => {
    const s = game();
    const m = [...s.market];
    const top = s.deck[0];
    const target = m[2];
    s.players[0].tokens = toks({ bee: 8 });
    const bagBees = s.bag.bee;
    const t = applyAction(s, { type: 'plant', cardId: target });
    expect(t.market).toEqual([top, m[0], m[1], m[3], m[4], m[5]]);
    expect(t.players[0].garden).toEqual([target]);
    const spent = costTotal(card(target).cost);
    expect(t.players[0].tokens.bee).toBe(8 - spent);
    expect(t.bag.bee).toBe(bagBees + spent);
    expect(t.events.map((e) => e.type)).toContain('enter');
  });

  it('내 온실의 식물을 심을 수 있고, 남의 온실 식물은 안 된다', () => {
    const s = game();
    s.players[0].greenhouse = [ID['장미']];
    s.players[1].greenhouse = [ID['라벤더']];
    s.players[0].tokens = toks({ sun: 2, compost: 5, bee: 3 });
    expect(applyAction(s, { type: 'plant', cardId: ID['라벤더'] })).toBe(s);
    const t = applyAction(s, { type: 'plant', cardId: ID['장미'] });
    expect(t.players[0].greenhouse).toEqual([]);
    expect(t.players[0].garden).toEqual([ID['장미']]);
    expect(scoreOf(t, 0)).toBe(3);
  });

  it('살 수 없는 식물은 심을 수 없다', () => {
    const s = game();
    const t = applyAction(s, { type: 'plant', cardId: s.market[0] });
    expect(t).toBe(s);
  });

  it('온실에 맡기면 꿀벌 1마리, 온실은 2칸까지, 벌통이 비면 꿀벌 없이', () => {
    let s = game();
    s.hive = 1;
    const a = s.market[5];
    s = applyAction(s, { type: 'reserve', cardId: a });
    expect(s.players[0].greenhouse).toEqual([a]);
    expect(s.players[0].tokens.bee).toBe(1);
    expect(s.hive).toBe(0);
    expect(s.market).toHaveLength(6);
    s.current = 0;
    s = applyAction(s, { type: 'reserve', cardId: s.market[0] });
    expect(s.players[0].greenhouse).toHaveLength(2);
    expect(s.players[0].tokens.bee).toBe(1);
    s.current = 0;
    expect(applyAction(s, { type: 'reserve', cardId: s.market[0] })).toBe(s);
    expect(legalActions(s).some((a) => a.type === 'reserve')).toBe(false);
  });

  it('덤: 물뿌리개 💧2, 새집 🐝1, 허수아비는 채소마다 1점', () => {
    const s = game();
    s.players[0].tokens = toks({ bee: 10 });
    s.market[0] = ID['수선화'];
    const water = applyAction(s, { type: 'plant', cardId: ID['수선화'] });
    expect(water.players[0].tokens.water).toBe(2);

    const b = game();
    b.players[0].tokens = toks({ bee: 10 });
    b.market[0] = ID['자두나무'];
    const hive = b.hive;
    const bee = applyAction(b, { type: 'plant', cardId: ID['자두나무'] });
    expect(bee.hive).toBe(hive - 1);
    expect(bee.players[0].tokens.bee).toBe(10 - 6 + 1);

    const c = game();
    c.players[0].garden = [ID['상추'], ID['시금치']];
    c.players[0].tokens = toks({ bee: 10 });
    c.market[0] = ID['옥수수'];
    const crow = applyAction(c, { type: 'plant', cardId: ID['옥수수'] });
    expect(crow.players[0].bonusPoints).toBe(3);
    expect(scoreOf(crow, 0)).toBe(1 + 3);
  });

  it('상장은 먼저 이룬 사람만 받는다 (+3점)', () => {
    const s = game();
    s.ribbons = [{ goal: 'flowers4', owner: null }];
    s.players[0].garden = [ID['개나리'], ID['진달래'], ID['민들레']];
    s.players[1].garden = [ID['제비꽃'], ID['튤립'], ID['수선화']];
    s.players[0].tokens = toks({ bee: 10 });
    s.players[1].tokens = toks({ bee: 10 });
    s.market[0] = ID['장미'];
    s.market[1] = ID['해바라기'];
    const t = applyAction(s, { type: 'plant', cardId: ID['장미'] });
    expect(t.ribbons[0].owner).toBe(0);
    expect(scoreOf(t, 0)).toBe(3 + 3);
    expect(t.events.some((e) => e.type === 'ribbon')).toBe(true);
    const u = applyAction(t, { type: 'plant', cardId: ID['해바라기'] });
    expect(u.ribbons[0].owner).toBe(0);
    expect(scoreOf(u, 1)).toBe(1 + 2);
  });
});

describe('라운드와 끝내기', () => {
  it('라운드가 끝나면 줄 맨 끝 식물이 시들고 새 식물이 들어온다', () => {
    const s = game();
    s.field = Array.from({ length: 9 }, () => 'water' as Token);
    const m = [...s.market];
    const top = s.deck[0];
    const a = applyAction(s, { type: 'harvest', line: 'r0' });
    expect(a.market).toEqual(m);
    expect(a.round).toBe(1);
    const b = applyAction(a, { type: 'harvest', line: 'r1' });
    expect(b.wilted).toEqual([m[5]]);
    expect(b.market).toEqual([top, ...m.slice(0, 5)]);
    expect(b.round).toBe(2);
    expect(b.current).toBe(0);
    expect(b.events.map((e) => e.type)).toEqual(expect.arrayContaining(['wilt', 'enter', 'round']));
  });

  it('목표 점수에 닿으면 그 라운드를 마치고 끝난다 (모두 같은 횟수)', () => {
    const s = game({ target: 12 }, 3);
    s.players[1].garden = [ID['국화'], ID['사과나무']];
    s.players[1].tokens = toks({ bee: 10 });
    s.market[0] = ID['단풍나무'];
    s.current = 1;
    s.field = Array.from({ length: 9 }, () => 'sun' as Token);
    const t = applyAction(s, { type: 'plant', cardId: ID['단풍나무'] });
    expect(t.endTriggered).toBe(true);
    expect(t.phase).toBe('play');
    expect(t.current).toBe(2);
    const u = applyAction(t, { type: 'harvest', line: 'r0' });
    expect(u.phase).toBe('gameover');
    expect(u.winners).toEqual([1]);
  });

  it('라운드 마지막 사람이 닿으면 바로 끝난다', () => {
    const s = game({ target: 12 });
    s.current = 1;
    s.players[1].garden = [ID['국화'], ID['사과나무']];
    s.players[1].tokens = toks({ bee: 10 });
    s.market[0] = ID['단풍나무'];
    const t = applyAction(s, { type: 'plant', cardId: ID['단풍나무'] });
    expect(t.phase).toBe('gameover');
    expect(applyAction(t, { type: 'harvest', line: 'r0' })).toBe(t);
  });

  it('점수가 같으면 식물이 적은 사람, 그래도 같으면 함께 우승', () => {
    const s = game();
    s.players[0].garden = [ID['장미']];
    s.players[1].garden = [ID['나팔꽃'], ID['튤립']];
    expect(findWinners(s)).toEqual([0]);
    s.players[1].garden = [ID['라벤더']];
    expect(findWinners(s)).toEqual([0, 1]);
  });

  it('할 일이 없을 때만 쉴 수 있고, 모두 쉬면 끝난다', () => {
    const s = game();
    expect(applyAction(s, { type: 'pass' })).toBe(s);
    s.field = Array.from({ length: 9 }, () => null);
    s.bag = emptyTokens();
    s.players.forEach((p) => (p.greenhouse = [ID['국화'], ID['인삼']]));
    expect(legalActions(s)).toEqual([{ type: 'pass' }]);
    const t = applyAction(applyAction(s, { type: 'pass' }), { type: 'pass' });
    expect(t.phase).toBe('gameover');
  });

  it('꽃시장과 더미가 모두 비면 라운드를 마치고 끝난다', () => {
    const s = game();
    s.deck = [];
    s.market = [s.market[0]];
    s.field = Array.from({ length: 9 }, () => 'seed' as Token);
    const t = applyAction(applyAction(s, { type: 'harvest', line: 'r0' }), { type: 'harvest', line: 'r1' });
    expect(t.market).toEqual([]);
    expect(t.phase).toBe('gameover');
  });

  it('토큰은 어떤 행동을 해도 생기거나 사라지지 않는다', () => {
    let s = createGame(setup(['human', 'human', 'human']), seededRandom(11));
    const total = tokenCensus(s);
    const rng = seededRandom(12);
    for (let k = 0; k < 120 && s.phase !== 'gameover'; k++) {
      if (s.phase === 'discard') s = applyAction(s, { type: 'discard', tokens: autoDiscard(s) }, rng);
      else {
        const legal = legalActions(s);
        s = applyAction(s, legal[Math.floor(rng() * legal.length)], rng);
      }
      expect(tokenCensus(s)).toBe(total);
      for (const p of s.players) for (const t of TOKENS) expect(p.tokens[t]).toBeGreaterThanOrEqual(0);
    }
  });
});
