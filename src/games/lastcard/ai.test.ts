import { describe, expect, it } from 'vitest';
import { bestColor, decideAction } from './ai';
import { DEFAULT_OPTIONS, createGame } from './rules';
import type { Card, CardColor, CardKind, LastCardSetup, LastCardState } from './types';

let nextId = 2000;
function card(color: CardColor | null, kind: CardKind | number): Card {
  if (typeof kind === 'number') return { id: nextId++, kind: 'number', color, value: kind };
  return { id: nextId++, kind, color, value: -1 };
}

function game(hands: Card[][], top: Card, stacking = false): LastCardState {
  const seats = (['ai-normal', 'ai-normal', 'ai-normal', 'ai-normal'] as const).map((kind, i) => ({
    kind: i < hands.length ? kind : 'empty',
    name: `C${i}`,
  })) as LastCardSetup['seats'];
  const s = createGame({ seats, options: { ...DEFAULT_OPTIONS, stacking } }, () => 0);
  s.players.forEach((p, i) => (p.hand = hands[i]));
  s.discard = [top];
  s.activeColor = top.color ?? 'red';
  s.current = 0;
  return s;
}

describe('컴퓨터 플레이어', () => {
  it('낼 카드가 없으면 뽑는다', () => {
    const s = game([[card('blue', 1)], [card('green', 1)]], card('red', 3));
    expect(decideAction(s, 'ai-normal')).toEqual({ type: 'draw' });
    expect(decideAction(s, 'ai-easy')).toEqual({ type: 'draw' });
  });

  it('마지막 카드를 낼 수 있으면 바로 낸다', () => {
    const last = card('red', 9);
    const s = game([[last], [card('green', 1)]], card('red', 3));
    expect(decideAction(s, 'ai-normal')).toMatchObject({ type: 'play', cardId: last.id });
  });

  it('색 바꾸기보다 같은 색 카드를 먼저 낸다', () => {
    const r = card('red', 2);
    const s = game([[card(null, 'wild'), r, card('blue', 4)], [card('green', 1), card('green', 2), card('green', 3)]], card('red', 3));
    expect(decideAction(s, 'ai-normal')).toMatchObject({ type: 'play', cardId: r.id });
  });

  it('다음 사람 카드가 거의 없으면 공격 카드를 낸다', () => {
    const skip = card('red', 'skip');
    const s = game([[card('red', 5), skip, card('red', 7)], [card('green', 1)], [card('green', 2), card('green', 3), card('green', 4)]], card('red', 3));
    expect(decideAction(s, 'ai-normal')).toMatchObject({ type: 'play', cardId: skip.id });
  });

  it('색 바꾸기는 손에 가장 많은 색으로 정한다', () => {
    const w = card(null, 'wild');
    const s = game([[w, card('blue', 1), card('blue', 2), card('green', 5)], [card('green', 1)]], card('red', 3));
    expect(decideAction(s, 'ai-normal')).toMatchObject({ type: 'play', cardId: w.id, color: 'blue' });
    expect(bestColor([card('yellow', 1), card('yellow', 2), card(null, 'wild')])).toBe('yellow');
  });

  it('카드가 2장이면 보통 컴퓨터는 꼭 외친다', () => {
    const s = game([[card('red', 1), card('red', 2)], [card('green', 1)]], card('red', 3));
    expect(decideAction(s, 'ai-normal')).toMatchObject({ type: 'play', call: true });
  });

  it('쌓인 +2가 있으면 이어 낼 카드를 낸다', () => {
    const d2 = card('blue', 'draw2');
    const s = game([[card('red', 1), d2, card('red', 4)], [card('green', 1)]], card('red', 'draw2'), true);
    s.pendingDraw = 2;
    expect(decideAction(s, 'ai-normal')).toMatchObject({ type: 'play', cardId: d2.id });
  });

  it('판이 끝났으면 다음 판을 시작한다', () => {
    const s = game([[card('red', 1)], [card('green', 1)]], card('red', 3));
    s.phase = 'roundover';
    expect(decideAction(s, 'ai-easy')).toEqual({ type: 'nextRound' });
  });
});
