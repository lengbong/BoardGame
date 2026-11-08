import { describe, expect, it } from 'vitest';
import { GOAL, TRACK, YARD, absoluteSquare, homeColumnCells, isSafeSquare, progressToPoint } from './board';
import { chooseMove } from './ai';
import {
  CLASSIC_RULES,
  EASY_RULES,
  advanceTurn,
  applyMove,
  applyRoll,
  createGame,
  legalMoves,
  rollDieValue,
} from './rules';
import type { GameSetup, GameState, RuleOptions, SeatKind } from './types';

const fixedRng = (value: number) => () => value;

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

function setup(kinds: SeatKind[], rules: Partial<RuleOptions> = {}): GameSetup {
  return {
    seats: kinds.map((kind, i) => ({ kind, name: `P${i}` })) as GameSetup['seats'],
    rules: { ...CLASSIC_RULES, ...rules },
  };
}

/** 빨강(0번)과 노랑(2번) 2인 게임, 빨강 차례로 시작 */
function twoPlayer(rules: Partial<RuleOptions> = {}, pieces?: { red?: number[]; yellow?: number[] }): GameState {
  const state = createGame(setup(['human', 'empty', 'human', 'empty'], rules), fixedRng(0));
  if (pieces?.red) state.players[0].pieces = [...pieces.red];
  if (pieces?.yellow) state.players[1].pieces = [...pieces.yellow];
  return state;
}

describe('board', () => {
  it('트랙은 52칸이고 모두 서로 다른 칸이다', () => {
    expect(TRACK).toHaveLength(52);
    expect(new Set(TRACK.map((p) => `${p.x},${p.y}`)).size).toBe(52);
  });

  it('연속한 트랙 칸은 서로 이웃해 있다', () => {
    for (let i = 0; i < 52; i++) {
      const a = TRACK[i];
      const b = TRACK[(i + 1) % 52];
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBeLessThanOrEqual(2);
    }
  });

  it('각 색의 마지막 트랙 칸 다음에 결승 통로가 이어진다', () => {
    for (const seat of [0, 1, 2, 3] as const) {
      const last = progressToPoint(seat, 0, 50);
      const firstHome = homeColumnCells(seat)[0];
      expect(Math.abs(last.x - firstHome.x) + Math.abs(last.y - firstHome.y)).toBe(1);
    }
  });

  it('시작칸과 별칸은 안전칸이다', () => {
    expect(isSafeSquare(0)).toBe(true);
    expect(isSafeSquare(13)).toBe(true);
    expect(isSafeSquare(8)).toBe(true);
    expect(isSafeSquare(1)).toBe(false);
  });

  it('주사위 값은 1~6', () => {
    expect(rollDieValue(fixedRng(0))).toBe(1);
    expect(rollDieValue(fixedRng(0.9999999))).toBe(6);
  });
});

describe('createGame', () => {
  it('비운 자리는 빼고 플레이어를 만든다', () => {
    const state = createGame(setup(['human', 'empty', 'ai-normal', 'empty']), fixedRng(0));
    expect(state.players.map((p) => p.seat)).toEqual([0, 2]);
    expect(state.players[0].pieces).toEqual([YARD, YARD, YARD, YARD]);
    expect(state.phase).toBe('rolling');
  });

  it('플레이어가 1명이면 오류', () => {
    expect(() => createGame(setup(['human', 'empty', 'empty', 'empty']))).toThrow();
  });
});

describe('출발', () => {
  it('정통 규칙: 6이 아니면 출발할 수 없고 차례가 넘어간다', () => {
    let s = applyRoll(twoPlayer(), 3);
    expect(s.phase).toBe('passing');
    expect(s.passKeepsTurn).toBe(false);
    s = advanceTurn(s);
    expect(s.current).toBe(1);
    expect(s.phase).toBe('rolling');
  });

  it('정통 규칙: 6이면 출발하고 한 번 더 굴린다', () => {
    let s = applyRoll(twoPlayer(), 6);
    expect(s.phase).toBe('choosing');
    const moves = legalMoves(s);
    expect(moves).toHaveLength(4);
    expect(moves[0].enters).toBe(true);
    s = applyMove(s, moves[0]);
    expect(s.players[0].pieces[0]).toBe(0);
    expect(s.current).toBe(0);
    expect(s.phase).toBe('rolling');
  });

  it('쉬운 규칙: 아무 수나 출발할 수 있다', () => {
    const s = applyRoll(twoPlayer({ needSixToEnter: false }), 2);
    expect(s.phase).toBe('choosing');
    expect(legalMoves(s)[0].to).toBe(0);
  });
});

describe('이동과 결승', () => {
  it('트랙을 따라 전진한다', () => {
    let s = applyRoll(twoPlayer({}, { red: [10, YARD, YARD, YARD] }), 4);
    s = applyMove(s, legalMoves(s)[0]);
    expect(s.players[0].pieces[0]).toBe(14);
    expect(s.current).toBe(1);
  });

  it('50칸을 지나면 결승 통로로 들어간다', () => {
    let s = applyRoll(twoPlayer({}, { red: [48, YARD, YARD, YARD] }), 5);
    s = applyMove(s, legalMoves(s)[0]);
    expect(s.players[0].pieces[0]).toBe(53);
  });

  it('정확한 수로만 골인: 넘치는 수는 움직일 수 없다', () => {
    const s = applyRoll(twoPlayer({}, { red: [54, GOAL, GOAL, GOAL] }), 3);
    expect(s.phase).toBe('passing');
  });

  it('넘쳐도 골인 규칙이면 골인한다', () => {
    const s = applyRoll(twoPlayer({ exactFinish: false }, { red: [54, YARD, YARD, YARD] }), 5);
    const moves = legalMoves(s).filter((m) => m.pieceIndex === 0);
    expect(moves[0].to).toBe(GOAL);
    expect(moves[0].finishes).toBe(true);
  });

  it('골인하면 한 번 더 굴린다', () => {
    let s = applyRoll(twoPlayer({}, { red: [53, 10, YARD, YARD] }), 3);
    s = applyMove(s, legalMoves(s).find((m) => m.pieceIndex === 0)!);
    expect(s.players[0].pieces[0]).toBe(GOAL);
    expect(s.current).toBe(0);
    expect(s.phase).toBe('rolling');
  });
});

describe('잡기', () => {
  // 노랑(2번 자리)의 진행도 p는 절대 칸 (26 + p) % 52.
  // 빨강 진행도 5 = 절대 칸 5 → 노랑 진행도 31.
  it('상대 말이 있는 칸에 도착하면 잡는다', () => {
    expect(absoluteSquare(2, 31)).toBe(5);
    let s = applyRoll(twoPlayer({}, { red: [2, YARD, YARD, YARD], yellow: [31, YARD, YARD, YARD] }), 3);
    const move = legalMoves(s)[0];
    expect(move.captures).toHaveLength(1);
    s = applyMove(s, move);
    expect(s.players[1].pieces[0]).toBe(YARD);
    expect(s.current).toBe(0); // 잡으면 한 번 더
  });

  it('안전칸에서는 잡히지 않는다', () => {
    // 절대 칸 8은 별칸. 노랑 진행도 34 = 절대 칸 8.
    expect(absoluteSquare(2, 34)).toBe(8);
    let s = applyRoll(twoPlayer({}, { red: [5, YARD, YARD, YARD], yellow: [34, YARD, YARD, YARD] }), 3);
    expect(legalMoves(s)[0].captures).toHaveLength(0);
    s = applyMove(s, legalMoves(s)[0]);
    expect(s.players[1].pieces[0]).toBe(34);
  });

  it('안전칸 규칙을 끄면 별칸에서도 잡힌다', () => {
    const s = applyRoll(
      twoPlayer({ safeSquares: false }, { red: [5, YARD, YARD, YARD], yellow: [34, YARD, YARD, YARD] }),
      3,
    );
    expect(legalMoves(s)[0].captures).toHaveLength(1);
  });

  it('결승 통로 안의 말은 잡히지 않는다', () => {
    const s = applyRoll(twoPlayer({}, { red: [2, YARD, YARD, YARD], yellow: [52, YARD, YARD, YARD] }), 3);
    expect(legalMoves(s)[0].captures).toHaveLength(0);
  });
});

describe('한 번 더 규칙', () => {
  it('6이 세 번 연속 나오면 차례가 끝난다', () => {
    let s = twoPlayer({}, { red: [10, YARD, YARD, YARD] });
    for (let i = 0; i < 2; i++) {
      s = applyRoll(s, 6);
      s = applyMove(s, legalMoves(s).find((m) => m.pieceIndex === 0)!);
      expect(s.current).toBe(0);
    }
    s = applyRoll(s, 6);
    expect(s.phase).toBe('passing');
    s = advanceTurn(s);
    expect(s.current).toBe(1);
  });

  it('3연속 6 규칙을 끄면 계속 굴린다', () => {
    let s = twoPlayer({ threeSixesEndsTurn: false }, { red: [0, YARD, YARD, YARD] });
    for (let i = 0; i < 3; i++) {
      s = applyRoll(s, 6);
      expect(s.phase).toBe('choosing');
      s = applyMove(s, legalMoves(s).find((m) => m.pieceIndex === 0)!);
    }
    expect(s.current).toBe(0);
  });

  it('6 보너스를 끄면 6이 나와도 차례가 넘어간다', () => {
    let s = applyRoll(twoPlayer({ bonusOnSix: false }, { red: [10, YARD, YARD, YARD] }), 6);
    s = applyMove(s, legalMoves(s).find((m) => m.pieceIndex === 0)!);
    expect(s.current).toBe(1);
  });

  it('움직일 말이 없어도 6이면 한 번 더 굴린다', () => {
    let s = applyRoll(twoPlayer({}, { red: [53, GOAL, GOAL, GOAL] }), 6);
    expect(s.phase).toBe('passing');
    expect(s.passKeepsTurn).toBe(true);
    s = advanceTurn(s);
    expect(s.current).toBe(0);
    expect(s.phase).toBe('rolling');
  });
});

describe('순위', () => {
  it('2인 게임은 한 명이 모두 골인하면 끝난다', () => {
    let s = applyRoll(twoPlayer({}, { red: [55, GOAL, GOAL, GOAL] }), 1);
    s = applyMove(s, legalMoves(s)[0]);
    expect(s.phase).toBe('gameover');
    expect(s.rankings).toEqual([0, 1]);
  });

  it('3인 이상은 끝까지 순위를 정한다', () => {
    let s = createGame(setup(['human', 'human', 'human', 'empty']), fixedRng(0));
    s.players[0].pieces = [55, GOAL, GOAL, GOAL];
    s = applyRoll(s, 1);
    s = applyMove(s, legalMoves(s)[0]);
    expect(s.phase).toBe('rolling');
    expect(s.rankings).toEqual([0]);
    expect(s.current).toBe(1);
  });

  it('1등이 나오면 끝 규칙', () => {
    let s = createGame(setup(['human', 'human', 'human', 'empty'], { stopAtFirstWinner: true }), fixedRng(0));
    s.players[0].pieces = [55, GOAL, GOAL, GOAL];
    s.players[2].pieces = [40, 30, YARD, YARD];
    s = applyRoll(s, 1);
    s = applyMove(s, legalMoves(s)[0]);
    expect(s.phase).toBe('gameover');
    expect(s.rankings).toEqual([0, 2, 1]);
  });

  it('골인한 플레이어는 차례에서 빠진다', () => {
    let s = createGame(setup(['human', 'human', 'human', 'empty']), fixedRng(0));
    s.players[1].pieces = [GOAL, GOAL, GOAL, GOAL];
    s.rankings = [1];
    s = applyRoll(s, 2);
    s = advanceTurn(s);
    expect(s.current).toBe(2);
  });
});

describe('전체 게임 시뮬레이션', () => {
  for (const [label, rules] of [
    ['정통', CLASSIC_RULES],
    ['쉬운', EASY_RULES],
  ] as const) {
    it(`${label} 규칙으로 컴퓨터 4명이 끝까지 게임을 마친다`, () => {
      for (let seed = 1; seed <= 30; seed++) {
        const rng = seeded(seed);
        let s = createGame(
          {
            seats: [
              { kind: 'ai-normal', name: 'A' },
              { kind: 'ai-easy', name: 'B' },
              { kind: 'ai-normal', name: 'C' },
              { kind: 'ai-easy', name: 'D' },
            ],
            rules,
          },
          rng,
        );
        let steps = 0;
        while (s.phase !== 'gameover') {
          if (++steps > 20000) throw new Error(`seed ${seed}: 게임이 끝나지 않음`);
          if (s.phase === 'rolling') s = applyRoll(s, rollDieValue(rng));
          else if (s.phase === 'passing') s = advanceTurn(s);
          else {
            const player = s.players[s.current];
            s = applyMove(s, chooseMove(s, legalMoves(s), player.kind === 'ai-easy' ? 'ai-easy' : 'ai-normal', rng));
          }
        }
        expect([...s.rankings].sort()).toEqual([0, 1, 2, 3]);
        const finished = s.players.filter((p) => p.pieces.every((x) => x === GOAL)).length;
        expect(finished).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
