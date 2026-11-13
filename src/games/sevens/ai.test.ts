import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { makeCard, type Card } from '../common/playingCards';
import { decideAction, evaluatePlay } from './ai';
import { DEFAULT_OPTIONS, MAX_PASSES, applyAction, canPlace, createGame, emptyBoard, playableCards } from './rules';
import type { Board, SevensOptions, SevensSetup, SevensState } from './types';

const S = (rank: number) => makeCard('spade', rank);
const H = (rank: number) => makeCard('heart', rank);
const D = (rank: number) => makeCard('diamond', rank);
const C = (rank: number) => makeCard('club', rank);

function board(cards: Card[]): Board {
  const b = emptyBoard();
  for (const c of cards) b[c.suit!][c.rank] = { by: 1, dumped: false };
  return b;
}

function game(hands: Card[][], placed: Card[], options: Partial<SevensOptions> = {}): SevensState {
  const seats = (['ai-normal', 'ai-normal', 'ai-normal', 'ai-normal'] as const).map((kind, i) => ({
    kind: i < hands.length ? kind : 'empty',
    name: `C${i}`,
  })) as SevensSetup['seats'];
  const s = createGame({ seats, options: { ...DEFAULT_OPTIONS, ...options } }, seededRandom(1));
  s.players.forEach((p, i) => (p.hand = hands[i]));
  s.board = board(placed);
  s.current = 0;
  return s;
}

describe('칠 이어놓기 컴퓨터', () => {
  it('낼 카드가 없으면 통과한다', () => {
    const s = game([[H(2), S(12)], [D(8)]], [D(7)]);
    expect(decideAction(s, 'ai-easy')).toEqual({ type: 'pass' });
    expect(decideAction(s, 'ai-normal')).toEqual({ type: 'pass' });
  });

  it('쉬움·보통 모두 언제나 낼 수 있는 카드만 낸다', () => {
    const rng = seededRandom(11);
    for (let seed = 1; seed <= 15; seed++) {
      const seats = (['ai-normal', 'ai-easy', 'ai-normal', seed % 2 ? 'empty' : 'ai-easy'] as const).map((kind) => ({ kind, name: '' })) as SevensSetup['seats'];
      let s = createGame({ seats, options: DEFAULT_OPTIONS }, seededRandom(seed));
      for (let k = 0; k < 25 && s.phase === 'play'; k++) {
        const level = k % 2 === 0 ? 'ai-easy' : 'ai-normal';
        const a = decideAction(s, level, rng);
        if (a.type === 'play') {
          const card = s.players[s.current].hand.find((c) => c.id === a.cardId)!;
          expect(canPlace(s.board, card)).toBe(true);
        } else {
          expect(a.type).toBe('pass');
          expect(playableCards(s)).toHaveLength(0);
        }
        s = applyAction(s, a, rng);
      }
    }
  });

  it('마지막 카드는 바로 낸다', () => {
    const s = game([[D(8)], [D(6)]], [D(7)]);
    expect(decideAction(s, 'ai-normal')).toEqual({ type: 'play', cardId: D(8).id });
  });

  it('보통: 내 카드로 이어지는 카드를 먼저 내고, 남에게 길을 여는 카드는 쥐고 있는다', () => {
    // ♠8을 내면 내 ♠9가 열리고, ♥8을 내면 남의 ♥9~K가 열린다.
    const s = game([[S(8), S(9), H(8), C(2)], [H(9), H(10)]], [D(7), S(7), H(7)]);
    expect(evaluatePlay(s, S(8))).toBeGreaterThan(evaluatePlay(s, H(8)));
    for (let k = 0; k < 10; k++) expect(decideAction(s, 'ai-normal', seededRandom(k))).toEqual({ type: 'play', cardId: S(8).id });
  });

  it('보통: 긴 줄을 가진 무늬의 7부터 연다', () => {
    const s = game([[S(7), S(8), S(9), S(10), H(7), C(1)], [H(6), H(8)]], [D(7)]);
    expect(evaluatePlay(s, S(7))).toBeGreaterThan(evaluatePlay(s, H(7)));
    expect(decideAction(s, 'ai-normal', seededRandom(2))).toEqual({ type: 'play', cardId: S(7).id });
  });

  it('보통: 남을 막는 내 줄(뒤에 내 카드가 줄줄이 이어짐)은 통과 여유가 있으면 아껴 두고, 통과가 없으면 쓴다', () => {
    // ♠8·9·10은 나만 가진 줄이고 그 뒤 ♠J~K는 남의 카드. ♣A는 아무 길도 열지 않는다.
    const s = game([[S(8), S(9), S(10), C(1), H(2)], [S(11), S(12), S(13)]], [D(7), S(7), C(7), C(6), C(5), C(4), C(3), C(2)]);
    expect(decideAction(s, 'ai-normal', seededRandom(1))).toEqual({ type: 'play', cardId: C(1).id });
    s.players[0].passes = MAX_PASSES;
    expect(decideAction(s, 'ai-normal', seededRandom(1))).toEqual({ type: 'play', cardId: S(8).id });
  });

  it('보통: 통과를 다 썼으면 다음 차례에 낼 카드가 더 많이 남는 쪽을 더 쳐 준다', () => {
    // ♣6을 내면 다음에 ♣5·♥8을 낼 수 있고, ♥8을 내면 ♣6 하나만 남는다.
    const s = game([[C(6), C(5), H(8), S(1)], [D(9)]], [D(7), C(7), H(7)]);
    const gapFresh = evaluatePlay(s, C(6)) - evaluatePlay(s, H(8));
    s.players[0].passes = MAX_PASSES;
    const gapLimit = evaluatePlay(s, C(6)) - evaluatePlay(s, H(8));
    expect(gapFresh).toBeGreaterThan(0);
    expect(gapLimit).toBeGreaterThan(gapFresh);
    expect(decideAction(s, 'ai-normal', seededRandom(3))).toEqual({ type: 'play', cardId: C(6).id });
  });
});
