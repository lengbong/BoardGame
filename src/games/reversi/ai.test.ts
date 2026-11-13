import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import type { DuelAiLevel, DuelKind } from '../common/duel';
import { chooseMove, decideAction, solveExact } from './ai';
import { DEFAULT_OPTIONS, applyAction, coordName, countDiscs, createGame, legalMoves } from './rules';
import type { BoardSize, Cell, Disc, ReversiState } from './types';

function game(kinds: [DuelKind, DuelKind], size: BoardSize = 8): ReversiState {
  return createGame({
    seats: [
      { kind: kinds[0], name: '' },
      { kind: kinds[1], name: '' },
    ],
    options: { ...DEFAULT_OPTIONS, size },
  });
}

function withBoard(rows: string[], current: Disc): ReversiState {
  const s = game(['ai-hard', 'ai-hard'], rows.length as BoardSize);
  s.board = rows.join('').split('').map((ch) => (ch === 'B' ? 0 : ch === 'W' ? 1 : -1)) as Cell[];
  s.counts = countDiscs(s.board);
  s.current = current;
  return s;
}

/** 시간 대신 호출 횟수로 흐르는 시계 (테스트가 컴퓨터 속도와 상관없이 늘 같게) */
function fakeClock() {
  let t = 0;
  return () => t++;
}

function playOut(kinds: [DuelAiLevel, DuelAiLevel], seed: number, size: BoardSize = 8): ReversiState {
  const rng = seededRandom(seed);
  let s = game(kinds, size);
  let guard = 0;
  while (s.phase === 'play' && guard++ < 200) {
    const level = kinds[s.current];
    const action = decideAction(s, level, rng, { timeMs: 12, now: fakeClock() });
    expect(legalMoves(s.board, s.size, s.current)).toContain(action.index);
    s = applyAction(s, action);
  }
  return s;
}

describe('뒤집기 컴퓨터', () => {
  it('모든 수준이 늘 둘 수 있는 곳에만 둔다 (무작위 판 여러 개)', () => {
    const rng = seededRandom(7);
    for (let g = 0; g < 4; g++) {
      let s = game(['human', 'human'], g % 2 === 0 ? 8 : 6);
      for (let k = 0; k < 40 && s.phase === 'play'; k++) {
        const legal = legalMoves(s.board, s.size, s.current);
        if (k % 5 === 0) {
          for (const level of ['ai-easy', 'ai-normal', 'ai-hard'] as const) {
            expect(legal).toContain(chooseMove(s, level, rng, { timeMs: 10, now: fakeClock() }));
          }
        }
        s = applyAction(s, { type: 'place', index: legal[Math.floor(rng() * legal.length)] });
      }
    }
  });

  it('끝난 게임에서는 둘 곳이 없다', () => {
    const s = playOut(['ai-easy', 'ai-easy'], 3, 6);
    expect(s.phase).toBe('gameover');
    expect(chooseMove(s, 'ai-hard')).toBeNull();
  });

  it('보통·어려움은 간단한 판에서 모서리를 잡는다', () => {
    // 흑은 A1(모서리)·D2·E3 등에 둘 수 있다. 모서리가 가장 좋다
    const s = withBoard(['........', '.W......', '..WWW...', '..WBB...', '...BW...', '........', '........', '........'], 0);
    expect(legalMoves(s.board, 8, 0)).toContain(0);
    expect(chooseMove(s, 'ai-normal', seededRandom(1))).toBe(0);
    expect(chooseMove(s, 'ai-hard', seededRandom(1), { timeMs: 60, now: fakeClock() })).toBe(0);
  });

  it('보통·어려움은 상대에게 모서리를 내주는 X칸을 피한다', () => {
    // 흑이 B2에 두면(C3를 뒤집음) 백이 A1을 잡는다
    const s = withBoard(['........', '........', '..W.....', '...BW...', '...BW...', '........', '........', '........'], 0);
    const legal = legalMoves(s.board, 8, 0);
    const xSquare = 9;
    expect(legal).toContain(xSquare);
    expect(legal.length).toBeGreaterThan(3);
    expect(chooseMove(s, 'ai-normal', seededRandom(2))).not.toBe(xSquare);
    expect(chooseMove(s, 'ai-hard', seededRandom(2), { timeMs: 60, now: fakeClock() })).not.toBe(xSquare);
  });

  it('어려움은 끝판을 끝까지 읽어 가장 좋은 수를 둔다', () => {
    // 무작위로 빈칸이 10개 남을 때까지 두고, 고른 수의 결과가 정답과 같은지 확인
    for (const seed of [11, 12, 13]) {
      const rng = seededRandom(seed);
      let s = game(['human', 'human']);
      while (s.phase === 'play' && s.board.filter((v) => v === -1).length > 10) {
        const legal = legalMoves(s.board, 8, s.current);
        s = applyAction(s, { type: 'place', index: legal[Math.floor(rng() * legal.length)] });
      }
      if (s.phase !== 'play') continue;
      const me = s.current;
      const value = (st: ReversiState) => (st.phase === 'gameover' ? st.counts[me] - st.counts[1 - me] : st.current === me ? solveExact(st) : -solveExact(st));
      const best = Math.max(...legalMoves(s.board, 8, me).map((i) => value(applyAction(s, { type: 'place', index: i }))));
      const pickIndex = chooseMove(s, 'ai-hard', rng, { timeMs: 5000 })!;
      expect(value(applyAction(s, { type: 'place', index: pickIndex }))).toBe(best);
    }
  });

  it('어려움은 생각 시간을 지킨다', () => {
    let s = game(['human', 'human']);
    const rng = seededRandom(5);
    for (let k = 0; k < 16; k++) {
      const legal = legalMoves(s.board, 8, s.current);
      s = applyAction(s, { type: 'place', index: legal[Math.floor(rng() * legal.length)] });
    }
    const t0 = performance.now();
    const move = chooseMove(s, 'ai-hard', rng, { timeMs: 120 });
    const spent = performance.now() - t0;
    expect(legalMoves(s.board, 8, s.current)).toContain(move);
    expect(spent).toBeLessThan(120 + 150);
  });

  it('쉬움은 시드가 같으면 같은 수, 여러 시드면 여러 가지 수를 둔다', () => {
    const s = game(['ai-easy', 'ai-easy']);
    const a = chooseMove(s, 'ai-easy', seededRandom(1));
    expect(chooseMove(s, 'ai-easy', seededRandom(1))).toBe(a);
    const seen = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => chooseMove(s, 'ai-easy', seededRandom(seed))));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('뒤집기 컴퓨터끼리 끝까지', () => {
  const pairs: [DuelAiLevel, DuelAiLevel][] = [
    ['ai-easy', 'ai-easy'],
    ['ai-easy', 'ai-normal'],
    ['ai-normal', 'ai-hard'],
    ['ai-hard', 'ai-easy'],
  ];
  for (const pair of pairs) {
    it(`${pair[0]} 대 ${pair[1]}`, () => {
      for (const seed of [1, 2]) {
        const s = playOut(pair, seed);
        expect(s.phase).toBe('gameover');
        expect(s.counts[0] + s.counts[1]).toBeLessThanOrEqual(64);
        expect(s.winner).toBe(s.counts[0] === s.counts[1] ? null : s.counts[0] > s.counts[1] ? 0 : 1);
      }
    });
  }

  it('6×6 판에서도 끝까지 둔다', () => {
    for (const seed of [4, 5]) {
      const s = playOut(['ai-normal', 'ai-hard'], seed, 6);
      expect(s.phase).toBe('gameover');
    }
  });

  it('강한 쪽이 대체로 이긴다 (어려움 > 쉬움, 보통 > 쉬움)', () => {
    let hardWins = 0;
    let normalWins = 0;
    for (const seed of [21, 22, 23, 24]) {
      const a = playOut(seed % 2 === 0 ? ['ai-hard', 'ai-easy'] : ['ai-easy', 'ai-hard'], seed);
      if (a.winner === (seed % 2 === 0 ? 0 : 1)) hardWins++;
      const b = playOut(seed % 2 === 0 ? ['ai-normal', 'ai-easy'] : ['ai-easy', 'ai-normal'], seed);
      if (b.winner === (seed % 2 === 0 ? 0 : 1)) normalWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(3);
    expect(normalWins).toBeGreaterThanOrEqual(3);
  });

  it('좌표 기록이 남는다', () => {
    const s = playOut(['ai-easy', 'ai-normal'], 9, 6);
    expect(s.log.some((l) => /[A-F][1-6]/.test(l.text))).toBe(true);
    expect(coordName(s.moves[0].index, 6)).toMatch(/^[A-F][1-6]$/);
  });
});
