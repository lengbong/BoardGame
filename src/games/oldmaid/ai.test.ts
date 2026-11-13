import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { makeCard, makeJoker, type Card } from '../common/playingCards';
import { decideAction, jokerSpotFor, knownJokerIndex } from './ai';
import { DEFAULT_OPTIONS, createGame } from './rules';
import type { OldMaidOptions, OldMaidSetup, OldMaidState } from './types';

const S = (rank: number) => makeCard('spade', rank);
const H = (rank: number) => makeCard('heart', rank);
const D = (rank: number) => makeCard('diamond', rank);
const J = () => makeJoker();
const zero = () => 0;

function game(hands: Card[][], options: Partial<OldMaidOptions> = {}): OldMaidState {
  const seats = (['ai-normal', 'ai-normal', 'ai-normal', 'ai-normal'] as const).map((kind, i) => ({
    kind: i < hands.length ? kind : 'empty',
    name: `C${i}`,
  })) as OldMaidSetup['seats'];
  const s = createGame({ seats, options: { ...DEFAULT_OPTIONS, ...options } }, seededRandom(1));
  s.players.forEach((p, i) => (p.hand = hands[i]));
  s.phase = 'play';
  s.current = 0;
  s.jokerKnownBy = [];
  return s;
}

describe('도둑잡기 컴퓨터', () => {
  it('나눠 준 직후에는 짝을 버린다', () => {
    const seats = (['ai-easy', 'ai-normal', 'empty', 'empty'] as const).map((kind) => ({ kind, name: '' })) as OldMaidSetup['seats'];
    const s = createGame({ seats, options: DEFAULT_OPTIONS }, seededRandom(2));
    expect(decideAction(s, 'ai-easy')).toEqual({ type: 'discardPairs' });
    expect(decideAction(s, 'ai-normal')).toEqual({ type: 'discardPairs' });
  });

  it('언제나 다음 사람 손패 안의 자리를 고르고, 뽑은 뒤 섞는다', () => {
    const s = game([[S(2), H(4)], [D(5), J(), S(9)], [H(9)]]);
    const rng = seededRandom(7);
    for (let k = 0; k < 50; k++) {
      for (const level of ['ai-easy', 'ai-normal'] as const) {
        const a = decideAction(s, level, rng);
        expect(a.type).toBe('draw');
        if (a.type !== 'draw') continue;
        expect(a.index).toBeGreaterThanOrEqual(0);
        expect(a.index).toBeLessThan(3);
        expect(a.shuffle).toBe(true);
      }
    }
  });

  it('보통: 조커 자리를 본 것으로 알면 피한다', () => {
    const s = game([[S(2), H(4)], [J(), D(5), S(9)], [H(9)]]);
    s.jokerKnownBy = [1, 0];
    expect(knownJokerIndex(s, 0, 1)).toBe(0);
    for (let k = 0; k < 30; k++) {
      const a = decideAction(s, 'ai-normal', seededRandom(k));
      expect(a).toMatchObject({ type: 'draw' });
      expect((a as { index: number }).index).not.toBe(0);
    }
  });

  it('보통: 모르는 조커는 몰래 보지 않는다 (뒷면만 보고 고른다)', () => {
    const s = game([[S(2), H(4)], [J(), D(5), S(9)], [H(9)]]);
    expect(knownJokerIndex(s, 0, 1)).toBe(-1);
    // 난수 0이면 맨 왼쪽(조커)을 그대로 고른다.
    expect(decideAction(s, 'ai-normal', zero)).toMatchObject({ type: 'draw', index: 0 });
  });

  it('쉬움: 조커 자리를 알아도 신경 쓰지 않는다', () => {
    const s = game([[S(2), H(4)], [J(), D(5)]]);
    s.jokerKnownBy = [0, 1];
    expect(decideAction(s, 'ai-easy', zero)).toMatchObject({ type: 'draw', index: 0 });
  });

  it('보통: 모두 공개 모드에서는 짝이 맞는 카드를 고른다', () => {
    const s = game([[S(2), H(4)], [J(), D(5), D(4), S(9)], [H(9)]], { handView: 'open' });
    for (let k = 0; k < 20; k++) expect(decideAction(s, 'ai-normal', seededRandom(k))).toMatchObject({ index: 2 });
  });

  it('남은 카드가 조커 한 장뿐이면 그것을 뽑는다', () => {
    const s = game([[S(2), H(4)], [J()]]);
    s.jokerKnownBy = [0, 1];
    expect(decideAction(s, 'ai-normal', seededRandom(3))).toMatchObject({ type: 'draw', index: 0 });
  });

  it('조커는 내 카드를 뽑아 가는 사람이 덜 뽑는 쪽에 숨긴다', () => {
    const s = game([[S(2), H(4)], [D(5), S(9)], [H(9), S(7)]]);
    // 0번 카드를 뽑아 가는 사람은 2번 (2는 0에게서 뽑는다)
    s.picks[2] = [5, 4, 0];
    expect(jokerSpotFor(s, 0, zero)).toBeGreaterThan(0.9);
    s.picks[2] = [0, 3, 3];
    expect(jokerSpotFor(s, 0, zero)).toBeLessThan(0.1);
    s.picks[2] = [0, 0, 1];
    // 기록이 거의 없으면 아무 데나
    expect(jokerSpotFor(s, 0, () => 0.37)).toBeCloseTo(0.37);
  });
});
