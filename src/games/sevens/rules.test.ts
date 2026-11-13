import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { SUITS, makeCard, type Card } from '../common/playingCards';
import { decideAction } from './ai';
import {
  DEFAULT_OPTIONS,
  MAX_PASSES,
  START_CARD,
  applyAction,
  canPlace,
  createGame,
  emptyBoard,
  isPlaced,
  nextPlaying,
  openSlots,
  passesLeft,
  placedCount,
  playableCards,
} from './rules';
import type { Board, SeatKind, SevensOptions, SevensSetup, SevensState } from './types';

function setup(kinds: SeatKind[], options: Partial<SevensOptions> = {}): SevensSetup {
  return {
    seats: kinds.map((kind, i) => ({ kind, name: `P${i}` })) as SevensSetup['seats'],
    options: { ...DEFAULT_OPTIONS, ...options },
  };
}

const S = (rank: number) => makeCard('spade', rank);
const H = (rank: number) => makeCard('heart', rank);
const D = (rank: number) => makeCard('diamond', rank);
const C = (rank: number) => makeCard('club', rank);

/** 판에 놓인 카드 목록으로 판을 만든다 */
function board(cards: Card[]): Board {
  const b = emptyBoard();
  for (const c of cards) b[c.suit!][c.rank] = { by: 0, dumped: false };
  return b;
}

/** 원하는 손패와 판으로 게임을 만든다. 0번 사람 차례. */
function game(hands: Card[][], placed: Card[] = [D(7)], options: Partial<SevensOptions> = {}): SevensState {
  const kinds = (['human', 'human', 'human', 'human'] as SeatKind[]).map((k, i) => (i < hands.length ? k : 'empty')) as SeatKind[];
  const s = createGame(setup(kinds, options), seededRandom(1));
  s.players.forEach((p, i) => (p.hand = hands[i]));
  s.board = board(placed);
  s.current = 0;
  s.events = [];
  return s;
}

function totalCards(s: SevensState): number {
  return placedCount(s.board) + s.players.reduce((n, p) => n + p.hand.length, 0);
}

describe('나눠 주기와 시작', () => {
  it('52장을 모두 나눠 주고, 사람 수가 나누어떨어지지 않아도 된다', () => {
    const s = createGame(setup(['ai-easy', 'ai-easy', 'ai-easy']), seededRandom(4));
    expect(totalCards(s)).toBe(52);
    const counts = s.players.map((p, i) => p.hand.length + (s.board.diamond[7]?.by === i ? 1 : 0)).sort();
    expect(counts).toEqual([17, 17, 18]);
  });

  it('♦7을 가진 사람이 저절로 놓고, 다음 사람 차례로 시작한다', () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = createGame(setup(['ai-easy', 'human', 'ai-normal', 'human']), seededRandom(seed));
      const starter = s.board.diamond[7]!.by;
      expect(placedCount(s.board)).toBe(1);
      expect(s.players.every((p) => !p.hand.some((c) => c.id === START_CARD.id))).toBe(true);
      expect(s.current).toBe((starter + 1) % 4);
      expect(s.events.map((e) => e.type)).toEqual(['deal', 'play']);
      expect(s.events[1]).toMatchObject({ player: starter, auto: true });
    }
  });

  it('손패는 무늬별·숫자순으로 정리되어 있다', () => {
    const s = createGame(setup(['ai-easy', 'ai-easy']), seededRandom(8));
    for (const p of s.players) {
      const keys = p.hand.map((c) => SUITS.indexOf(c.suit!) * 100 + c.rank);
      expect(keys).toEqual([...keys].sort((a, b) => a - b));
    }
  });
});

describe('낼 수 있는 카드', () => {
  it('7은 언제나, 나머지는 같은 무늬 바로 옆 숫자가 판에 있을 때만', () => {
    const b = board([D(7), D(8), S(7)]);
    expect(canPlace(b, H(7))).toBe(true);
    expect(canPlace(b, D(6))).toBe(true);
    expect(canPlace(b, D(9))).toBe(true);
    expect(canPlace(b, D(10))).toBe(false);
    expect(canPlace(b, S(8))).toBe(true);
    expect(canPlace(b, H(8))).toBe(false);
    expect(canPlace(b, D(8))).toBe(false);
  });

  it('A와 K 끝에서 넘어가지 않는다', () => {
    const b = board([S(7), S(6), S(5), S(4), S(3), S(2), S(1), H(13)]);
    expect(canPlace(b, S(13))).toBe(false);
    expect(canPlace(b, H(12))).toBe(true);
    expect(canPlace(b, H(1))).toBe(false);
  });

  it('빈칸 목록과 지금 차례 사람의 낼 수 있는 카드', () => {
    expect(openSlots(board([D(7)])).length).toBe(3 + 2);
    const s = game([[D(8), H(9), C(7)], [D(6)]]);
    expect(playableCards(s).map((c) => c.id).sort()).toEqual([C(7).id, D(8).id].sort());
  });

  it('낼 수 없는 카드나 남의 카드는 낼 수 없다', () => {
    const s = game([[D(9), H(9)], [D(6)]]);
    expect(applyAction(s, { type: 'play', cardId: D(9).id })).toBe(s);
    expect(applyAction(s, { type: 'play', cardId: D(6).id })).toBe(s);
  });

  it('카드를 내면 판에 놓이고 다음 사람 차례', () => {
    const s = applyAction(game([[D(8), H(2)], [D(6)], [C(3)]]), { type: 'play', cardId: D(8).id });
    expect(isPlaced(s.board, 'diamond', 8)).toBe(true);
    expect(s.board.diamond[8]).toEqual({ by: 0, dumped: false });
    expect(s.players[0].hand).toEqual([H(2)]);
    expect(s.current).toBe(1);
    expect(s.events[0]).toMatchObject({ type: 'play', player: 0 });
  });
});

describe('통과와 탈락', () => {
  it('낼 카드가 있으면 통과할 수 없다', () => {
    const s = game([[D(8)], [D(6)]]);
    expect(applyAction(s, { type: 'pass' })).toBe(s);
  });

  it('낼 카드가 없으면 통과하고 횟수를 센다', () => {
    const s = applyAction(game([[H(2), S(3)], [D(6)]]), { type: 'pass' });
    expect(s.players[0].passes).toBe(1);
    expect(passesLeft(s, 0)).toBe(2);
    expect(s.events[0]).toMatchObject({ type: 'pass', player: 0, count: 1 });
    expect(s.current).toBe(1);
  });

  it('4번째 통과를 해야 하면 탈락하고 카드를 모두 제자리에 내려놓는다', () => {
    const s0 = game([[H(2), S(3), C(12)], [D(6), S(9)], [H(4)]]);
    s0.players[0].passes = MAX_PASSES;
    const s = applyAction(s0, { type: 'pass' });
    expect(s.players[0].status).toBe('out');
    expect(s.players[0].hand).toEqual([]);
    expect(s.players[0].dumpedPoints).toBe(2 + 3 + 12);
    for (const c of [H(2), S(3), C(12)]) expect(s.board[c.suit!][c.rank]).toEqual({ by: 0, dumped: true });
    expect(s.outOrder).toEqual([0]);
    expect(s.events[0]).toMatchObject({ type: 'eliminate', player: 0 });
    expect(s.current).toBe(1);
    // 탈락한 사람은 차례에서 빠진다.
    expect(nextPlaying(s, 2)).toBe(1);
  });

  it('내려놓은 카드 옆에도 이어 낼 수 있다', () => {
    const s0 = game([[H(2)], [H(3), S(9)], [H(9)]]);
    s0.players[0].passes = MAX_PASSES;
    const s = applyAction(s0, { type: 'pass' });
    expect(playableCards(s).map((c) => c.id)).toEqual([H(3).id]);
  });

  it('통과 제한을 끄면 몇 번이든 통과할 수 있다', () => {
    const s0 = game([[H(2)], [D(6), S(2)], [C(3)]], [D(7)], { passLimit: false });
    s0.players[0].passes = 10;
    const s = applyAction(s0, { type: 'pass' });
    expect(s.players[0].status).toBe('playing');
    expect(s.players[0].passes).toBe(11);
    expect(passesLeft(s, 0)).toBe(Infinity);
  });
});

describe('한 판 끝내기', () => {
  it('카드를 다 내면 그 순서가 순위이고, 남은 사람은 계속한다', () => {
    const s = applyAction(game([[D(8)], [D(6), S(2)], [C(3), H(4)]]), { type: 'play', cardId: D(8).id });
    expect(s.players[0].status).toBe('finished');
    expect(s.finishOrder).toEqual([0]);
    expect(s.events.find((e) => e.type === 'finish')).toMatchObject({ player: 0, place: 1 });
    expect(s.phase).toBe('play');
    expect(s.current).toBe(1);
  });

  it('한 사람만 남으면 끝: 다 낸 순서 → 남은 사람 → 늦게 탈락한 사람 순', () => {
    const s0 = game([[D(8)], [], [C(2), H(4)], []]);
    s0.players[1].status = 'out';
    s0.players[3].status = 'out';
    s0.outOrder = [3, 1];
    const s = applyAction(s0, { type: 'play', cardId: D(8).id });
    expect(s.phase).toBe('gameover');
    expect(s.rankings).toEqual([0, 2, 1, 3]);
    expect(s.roundResult?.winner).toBe(0);
  });

  it('탈락으로 한 사람만 남아도 끝난다', () => {
    const s0 = game([[H(2)], [D(6)]]);
    s0.players[0].passes = MAX_PASSES;
    const s = applyAction(s0, { type: 'pass' });
    expect(s.phase).toBe('gameover');
    expect(s.rankings).toEqual([1, 0]);
  });
});

describe('점수 모으기', () => {
  it('누군가 카드를 다 내면 판이 끝나고, 남의 남은 카드 점수(탈락은 내려놓은 카드)를 가져간다', () => {
    const s0 = game([[D(8)], [S(12), H(1)], [C(3)], [H(9)]], [D(7)], { endMode: 'points', targetScore: 200 });
    s0.players[3].status = 'out';
    s0.players[3].hand = [];
    s0.players[3].dumpedPoints = 20;
    const s = applyAction(s0, { type: 'play', cardId: D(8).id });
    expect(s.phase).toBe('roundover');
    expect(s.roundResult).toMatchObject({ winner: 0, points: 13 + 3 + 20, handPoints: [0, 13, 3, 20] });
    expect(s.players[0].score).toBe(36);
    expect(s.roundResult?.order[0]).toBe(0);
  });

  it('다음 판은 다시 나눠 주고 ♦7부터, 통과 횟수도 처음부터', () => {
    const s0 = game([[D(8)], [S(12)], [C(3)]], [D(7)], { endMode: 'points' });
    s0.players[1].passes = 2;
    const s1 = applyAction(s0, { type: 'play', cardId: D(8).id });
    expect(applyAction(s1, { type: 'pass' })).toBe(s1);
    const s2 = applyAction(s1, { type: 'nextRound' }, seededRandom(5));
    expect(s2.phase).toBe('play');
    expect(s2.round).toBe(s1.round + 1);
    expect(s2.dealer).toBe((s1.dealer + 1) % 3);
    expect(totalCards(s2)).toBe(52);
    expect(placedCount(s2.board)).toBe(1);
    expect(s2.players.every((p) => p.passes === 0 && p.status === 'playing')).toBe(true);
    expect(s2.players[0].score).toBe(15);
  });

  it('목표 점수에 닿으면 우승, 점수 순으로 순위', () => {
    const s0 = game([[D(8)], [S(12)], [C(3)]], [D(7)], { endMode: 'points', targetScore: 100 });
    s0.players[0].score = 90;
    s0.players[1].score = 95;
    const s = applyAction(s0, { type: 'play', cardId: D(8).id });
    expect(s.phase).toBe('gameover');
    expect(s.players[0].score).toBe(105);
    expect(s.rankings).toEqual([0, 1, 2]);
  });

  it('판이 진행 중일 때 다음 판을 시작할 수 없다', () => {
    const s = game([[D(8)], [S(12)]]);
    expect(applyAction(s, { type: 'nextRound' })).toBe(s);
  });
});

describe('컴퓨터끼리 끝까지', () => {
  const seeds = [1, 2, 3, 5, 8, 13, 21, 34];
  for (const endMode of ['single', 'points'] as const) {
    for (const n of [2, 3, 4]) {
      it(`${endMode === 'single' ? '한 판' : '점수 모으기'} ${n}명: 여러 시드로 끝까지 진행된다`, () => {
        for (const seed of seeds) {
          const rng = seededRandom(seed * 7 + n);
          const kinds = (['ai-normal', 'ai-easy', 'ai-normal', 'ai-easy'] as SeatKind[]).map((k, i) => (i < n ? k : 'empty')) as SeatKind[];
          let s = createGame(setup(kinds, { endMode, targetScore: 100, passLimit: seed % 3 !== 0 }), rng);
          let steps = 0;
          while (s.phase !== 'gameover' && steps < 5000) {
            const p = s.players[s.current];
            const next = applyAction(s, decideAction(s, p.kind === 'human' ? 'ai-normal' : p.kind, rng), rng);
            expect(next).not.toBe(s);
            s = next;
            if (s.phase === 'play') expect(totalCards(s)).toBe(52);
            steps += 1;
          }
          expect(s.phase).toBe('gameover');
          expect(new Set(s.rankings).size).toBe(n);
          if (endMode === 'points') expect(s.players[s.rankings[0]].score).toBeGreaterThanOrEqual(100);
        }
      });
    }
  }
});
