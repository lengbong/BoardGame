import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import {
  DEFAULT_OPTIONS,
  allCodes,
  applyAction,
  candidatesFor,
  conflictsWith,
  createGame,
  inningLabel,
  isConsistent,
  isValidCode,
  judge,
  randomCode,
  resultShort,
  resultText,
} from './rules';
import type { BaseballOptions, BaseballSetup, BaseballState, DuelKind, Guess, Side } from './types';

function setup(kinds: [DuelKind, DuelKind], options: Partial<BaseballOptions> = {}): BaseballSetup {
  return { seats: [{ kind: kinds[0], name: 'A' }, { kind: kinds[1], name: 'B' }], options: { ...DEFAULT_OPTIONS, ...options } };
}

/** 사람 둘이 비밀 숫자를 정한 뒤의 게임 */
function duel(a: number[], b: number[], options: Partial<BaseballOptions> = {}): BaseballState {
  let s = createGame(setup(['human', 'human'], { length: a.length as 3 | 4, ...options }), seededRandom(1));
  s = applyAction(s, { type: 'secret', player: 0, digits: a });
  s = applyAction(s, { type: 'secret', player: 1, digits: b });
  return s;
}

const g = (digits: number[], strikes: number, balls: number): Guess => ({ digits, strikes, balls });

describe('판정', () => {
  it('스트라이크는 자리까지 맞음, 볼은 숫자만 맞음', () => {
    expect(judge([1, 2, 3], [1, 2, 3])).toEqual({ strikes: 3, balls: 0 });
    expect(judge([1, 2, 3], [3, 1, 2])).toEqual({ strikes: 0, balls: 3 });
    expect(judge([1, 2, 3], [1, 3, 9])).toEqual({ strikes: 1, balls: 1 });
    expect(judge([1, 2, 3], [4, 5, 6])).toEqual({ strikes: 0, balls: 0 });
    expect(judge([0, 4, 7, 9], [9, 4, 0, 1])).toEqual({ strikes: 1, balls: 2 });
  });

  it('판정은 두 숫자를 바꿔도 같다', () => {
    const rng = seededRandom(5);
    for (let k = 0; k < 100; k++) {
      const a = randomCode({ length: 4, zero: true }, rng);
      const b = randomCode({ length: 4, zero: true }, rng);
      expect(judge(a, b)).toEqual(judge(b, a));
    }
  });

  it('결과 읽기', () => {
    expect(resultText(0, 0, 3)).toBe('아웃!');
    expect(resultText(3, 0, 3)).toBe('홈런!');
    expect(resultText(1, 2, 3)).toBe('1스트라이크 2볼');
    expect(resultText(0, 2, 4)).toBe('2볼');
    expect(resultText(2, 0, 4)).toBe('2스트라이크');
    expect(resultShort(1, 1, 3)).toBe('1S 1B');
    expect(resultShort(0, 0, 3)).toBe('아웃');
    expect(resultShort(4, 0, 4)).toBe('홈런');
  });
});

describe('숫자', () => {
  it('자릿수, 쓸 수 있는 숫자, 겹치지 않기를 검사한다', () => {
    const o3 = { length: 3, zero: false } as const;
    expect(isValidCode([1, 2, 3], o3)).toBe(true);
    expect(isValidCode([1, 1, 3], o3)).toBe(false);
    expect(isValidCode([0, 2, 3], o3)).toBe(false);
    expect(isValidCode([0, 2, 3], { length: 3, zero: true })).toBe(true);
    expect(isValidCode([1, 2], o3)).toBe(false);
    expect(isValidCode([1, 2, 10], o3)).toBe(false);
    expect(isValidCode([1, 2, 3.5], o3)).toBe(false);
    expect(isValidCode('123', o3)).toBe(false);
  });

  it('모든 숫자의 개수: 3자리 1~9는 504개, 4자리 0~9는 5040개', () => {
    expect(allCodes(3, false)).toHaveLength(504);
    expect(allCodes(3, true)).toHaveLength(720);
    expect(allCodes(4, false)).toHaveLength(3024);
    expect(allCodes(4, true)).toHaveLength(5040);
    expect(allCodes(3, false).every((c) => isValidCode(c, { length: 3, zero: false }))).toBe(true);
  });

  it('무작위 숫자는 언제나 올바르다', () => {
    const rng = seededRandom(9);
    for (let k = 0; k < 200; k++) {
      expect(isValidCode(randomCode({ length: 3, zero: false }, rng), { length: 3, zero: false })).toBe(true);
      expect(isValidCode(randomCode({ length: 4, zero: true }, rng), { length: 4, zero: true })).toBe(true);
    }
  });

  it('후보: 결과와 맞는 숫자만 남고, 비밀 숫자는 늘 남는다', () => {
    const secret = [3, 7, 5];
    const guesses = [[1, 2, 3], [4, 5, 6], [7, 8, 9]].map((d) => ({ digits: d, ...judge(secret, d) }));
    const cands = candidatesFor(guesses, { length: 3, zero: false });
    expect(cands.some((c) => c.join('') === '375')).toBe(true);
    expect(cands.every((c) => isConsistent(c, guesses))).toBe(true);
    expect(cands.length).toBeLessThan(504);
  });

  it('앞 결과와 맞지 않는 숫자를 알려 준다', () => {
    const guesses = [g([1, 2, 3], 0, 0), g([4, 5, 6], 1, 0)];
    expect(conflictsWith([1, 5, 7], guesses)).toEqual([0]);
    expect(conflictsWith([7, 5, 8], guesses)).toEqual([]);
    expect(conflictsWith([7, 8, 9], guesses)).toEqual([1]);
  });
});

describe('시작과 비밀 숫자', () => {
  it('사람이 있으면 차례로 숫자를 정하고, 다 정하면 시작한다', () => {
    let s = createGame(setup(['human', 'human']), seededRandom(1));
    expect(s.phase).toBe('secret');
    expect(s.setting).toBe(0);
    // 차례가 아닌 사람, 잘못된 숫자는 안 된다
    expect(applyAction(s, { type: 'secret', player: 1, digits: [1, 2, 3] })).toBe(s);
    expect(applyAction(s, { type: 'secret', player: 0, digits: [1, 1, 3] })).toBe(s);
    s = applyAction(s, { type: 'secret', player: 0, digits: [1, 2, 3] });
    expect(s.setting).toBe(1);
    expect(s.phase).toBe('secret');
    s = applyAction(s, { type: 'secret', player: 1, digits: [4, 5, 6] });
    expect(s.phase).toBe('play');
    expect(s.current).toBe(0);
    expect(s.events.map((e) => e.type)).toEqual(['secret', 'start']);
  });

  it('컴퓨터는 처음에 바로 숫자를 정한다', () => {
    const s = createGame(setup(['human', 'ai-hard']), seededRandom(2));
    expect(s.players[1].secret).not.toBeNull();
    expect(s.setting).toBe(0);
    const w = createGame(setup(['ai-easy', 'ai-normal']), seededRandom(3));
    expect(w.phase).toBe('play');
    expect(w.players.every((p) => p.secret !== null)).toBe(true);
  });

  it('혼자 맞히기: 컴퓨터가 숫자를 숨기고 바로 시작한다', () => {
    const s = createGame(setup(['human', 'human'], { mode: 'solo', length: 4, zero: true }), seededRandom(4));
    expect(s.phase).toBe('play');
    expect(s.players[0].kind).toBe('human');
    expect(s.players[0].secret).toBeNull();
    expect(isValidCode(s.players[1].secret, { length: 4, zero: true })).toBe(true);
    expect(inningLabel(s, 0, 2)).toBe('3번째');
  });

  it('이름을 비워 두면 편 이름으로 부른다', () => {
    const s = createGame({ seats: [{ kind: 'human', name: ' ' }, { kind: 'ai-easy', name: '' }], options: DEFAULT_OPTIONS }, seededRandom(1));
    expect(s.players.map((p) => p.name)).toEqual(['파랑팀', '빨강팀']);
  });
});

describe('맞히기', () => {
  it('번갈아 치고, 결과가 기록된다', () => {
    let s = duel([1, 2, 3], [4, 5, 6]);
    s = applyAction(s, { type: 'guess', digits: [4, 6, 9] });
    expect(s.players[0].guesses).toEqual([g([4, 6, 9], 1, 1)]);
    expect(s.current).toBe(1);
    expect(s.events[0]).toMatchObject({ type: 'guess', player: 0, index: 0, strikes: 1, balls: 1 });
    s = applyAction(s, { type: 'guess', digits: [7, 8, 9] });
    expect(s.players[1].guesses[0]).toEqual(g([7, 8, 9], 0, 0));
    expect(s.current).toBe(0);
    expect(inningLabel(s, 0, 0)).toBe('1회초');
    expect(inningLabel(s, 1, 0)).toBe('1회말');
  });

  it('잘못된 숫자는 칠 수 없다', () => {
    const s = duel([1, 2, 3], [4, 5, 6]);
    expect(applyAction(s, { type: 'guess', digits: [4, 4, 5] })).toBe(s);
    expect(applyAction(s, { type: 'guess', digits: [4, 5] })).toBe(s);
  });

  it('나중 사람이 맞히면 바로 이긴다', () => {
    let s = duel([1, 2, 3], [4, 5, 6]);
    s = applyAction(s, { type: 'guess', digits: [7, 8, 9] });
    s = applyAction(s, { type: 'guess', digits: [1, 2, 3] });
    expect(s.phase).toBe('gameover');
    expect(s.winner).toBe(1);
    expect(s.events.map((e) => e.type)).toEqual(['guess', 'homerun', 'end']);
  });

  it('먼저 친 사람이 맞히면 나중 사람에게 마지막 기회: 못 맞히면 먼저 친 사람 승리', () => {
    let s = duel([1, 2, 3], [4, 5, 6]);
    s = applyAction(s, { type: 'guess', digits: [4, 5, 6] });
    expect(s.phase).toBe('play');
    expect(s.lastChance).toBe(true);
    expect(s.current).toBe(1);
    expect(s.events.map((e) => e.type)).toEqual(['guess', 'homerun', 'lastChance']);
    s = applyAction(s, { type: 'guess', digits: [1, 2, 4] });
    expect(s.phase).toBe('gameover');
    expect(s.winner).toBe(0);
  });

  it('마지막 기회에 맞히면 무승부', () => {
    let s = duel([1, 2, 3], [4, 5, 6]);
    s = applyAction(s, { type: 'guess', digits: [4, 5, 6] });
    s = applyAction(s, { type: 'guess', digits: [1, 2, 3] });
    expect(s.phase).toBe('gameover');
    expect(s.winner).toBeNull();
    expect(s.hits).toEqual([0, 1]);
  });

  it('마지막 기회를 끄면 먼저 맞힌 사람이 바로 이긴다', () => {
    let s = duel([1, 2, 3], [4, 5, 6], { fairFinish: false });
    s = applyAction(s, { type: 'guess', digits: [4, 5, 6] });
    expect(s.phase).toBe('gameover');
    expect(s.winner).toBe(0);
  });

  it('혼자 맞히기: 계속 치다가 맞히면 끝', () => {
    let s = createGame(setup(['human', 'human'], { mode: 'solo' }), seededRandom(4));
    s.players[1].secret = [3, 6, 9];
    s = applyAction(s, { type: 'guess', digits: [1, 2, 3] });
    s = applyAction(s, { type: 'guess', digits: [4, 5, 6] });
    expect(s.current).toBe(0);
    expect(s.players[0].guesses).toHaveLength(2);
    s = applyAction(s, { type: 'guess', digits: [3, 6, 9] });
    expect(s.phase).toBe('gameover');
    expect(s.winner).toBe(0);
  });

  it('혼자 맞히기에서 답 보기', () => {
    let s = createGame(setup(['human', 'human'], { mode: 'solo' }), seededRandom(4));
    s = applyAction(s, { type: 'giveUp' });
    expect(s.phase).toBe('gameover');
    expect(s.gaveUp).toBe(true);
    expect(s.winner).toBeNull();
    // 둘이서 할 때는 답 보기가 없다
    const d = duel([1, 2, 3], [4, 5, 6]);
    expect(applyAction(d, { type: 'giveUp' })).toBe(d);
  });

  it('원래 상태는 바뀌지 않는다', () => {
    const s = duel([1, 2, 3], [4, 5, 6]);
    const copy = structuredClone(s);
    applyAction(s, { type: 'guess', digits: [4, 5, 6] });
    expect(s).toEqual(copy);
  });
});

describe('메모', () => {
  it('숫자마다 있다·없다를 적고 지울 수 있다', () => {
    let s = duel([1, 2, 3], [4, 5, 6]);
    s = applyAction(s, { type: 'note', player: 1, digit: 7, mark: 2 });
    expect(s.players[1].notes[7]).toBe(2);
    s = applyAction(s, { type: 'note', player: 1, digit: 7, mark: 0 });
    expect(s.players[1].notes[7]).toBe(0);
    expect(applyAction(s, { type: 'note', player: 0, digit: 10, mark: 1 })).toBe(s);
  });

  it('도우미: 아웃이면 그 숫자를 ✕, 숫자를 다 찾으면 나머지를 ✕로 적는다 (직접 적은 칸은 그대로)', () => {
    let s = duel([1, 2, 3], [4, 5, 6]);
    s = applyAction(s, { type: 'note', player: 0, digit: 7, mark: 1 });
    s = applyAction(s, { type: 'guess', digits: [7, 8, 9] });
    expect(s.players[0].notes[7]).toBe(1);
    expect(s.players[0].notes[8]).toBe(2);
    expect(s.players[0].notes[9]).toBe(2);
    s = applyAction(s, { type: 'guess', digits: [9, 8, 7] });
    s = applyAction(s, { type: 'guess', digits: [6, 4, 5] });
    const notes = s.players[0].notes;
    expect([notes[4], notes[5], notes[6]]).toEqual([1, 1, 1]);
    expect([notes[1], notes[2], notes[3]]).toEqual([2, 2, 2]);
  });

  it('도우미를 끄면 저절로 적지 않는다', () => {
    let s = duel([1, 2, 3], [4, 5, 6], { helper: false });
    s = applyAction(s, { type: 'guess', digits: [7, 8, 9] });
    expect(s.players[0].notes.every((m) => m === 0)).toBe(true);
  });
});

describe('끝까지', () => {
  it('언젠가는 누군가 맞힌다 (무작위로 쳐도)', () => {
    const rng = seededRandom(11);
    for (let k = 0; k < 5; k++) {
      let s = duel(randomCode({ length: 3, zero: false }, rng), randomCode({ length: 3, zero: false }, rng));
      let n = 0;
      while (s.phase === 'play' && n < 3000) {
        s = applyAction(s, { type: 'guess', digits: randomCode(s.options, rng) });
        n++;
      }
      expect(s.phase).toBe('gameover');
      const counts = s.players.map((p) => p.guesses.length);
      // 먼저 친 쪽이 같거나 한 번 더 쳤다
      expect(counts[0] - counts[1]).toBeGreaterThanOrEqual(0);
      expect(counts[0] - counts[1]).toBeLessThanOrEqual(1);
      if (s.winner !== null) expect(s.hits).toContain(s.winner as Side);
    }
  });
});
