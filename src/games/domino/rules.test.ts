import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { createSet, handPips, isDouble } from './dominoes';
import {
  DEFAULT_OPTIONS,
  applyAction,
  canDraw,
  canPass,
  createGame,
  findOpening,
  isBlocked,
  legalMoves,
  lineEnds,
  needsSideChoice,
  sidesFor,
} from './rules';
import { isValidState } from './storage';
import type { DominoOptions, DominoSetup, DominoState, PlacedTile, SeatKind, Tile } from './types';

const SET = createSet();
/** a·b 패 (순서 상관없이) */
function T(a: number, b: number): Tile {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return SET.find((t) => t.a === lo && t.b === hi)!;
}

function setup(count: number, options: Partial<DominoOptions> = {}, kind: SeatKind = 'human'): DominoSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: i < count ? kind : 'empty', name: `P${i}` })) as DominoSetup['seats'],
    options: { ...DEFAULT_OPTIONS, ...options },
  };
}

/**
 * 원하는 손패와 줄로 게임을 만든다. 0번 사람 차례.
 * line은 [왼쪽 숫자, 오른쪽 숫자] 순서로 이어진 패들. boneyard를 안 주면 남은 패가 모두 더미가 된다.
 */
function game(hands: [number, number][][], line: [number, number][], options: Partial<DominoOptions> = {}, boneyard?: [number, number][]): DominoState {
  const s = createGame(setup(hands.length, options), seededRandom(1));
  s.players.forEach((p, i) => {
    p.hand = hands[i].map(([a, b]) => T(a, b));
    p.lacks = [];
  });
  s.line = line.map(([l, r], i): PlacedTile => ({ tile: T(l, r), left: l, right: r, order: i, player: 0 }));
  s.origin = 0;
  const used = new Set([...s.players.flatMap((p) => p.hand.map((t) => t.id)), ...s.line.map((p) => p.tile.id)]);
  s.boneyard = boneyard ? boneyard.map(([a, b]) => T(a, b)) : SET.filter((t) => !used.has(t.id));
  s.current = 0;
  s.phase = 'play';
  s.events = [];
  s.turnDraws = 0;
  return s;
}

function allIds(s: DominoState): number[] {
  return [...s.players.flatMap((p) => p.hand.map((t) => t.id)), ...s.line.map((p) => p.tile.id), ...s.boneyard.map((t) => t.id)];
}

function chainOk(s: DominoState): boolean {
  return s.line.every((p, i) => {
    const t = p.tile;
    const matchesTile = (p.left === t.a && p.right === t.b) || (p.left === t.b && p.right === t.a);
    return matchesTile && (i === 0 || s.line[i - 1].right === p.left);
  });
}

describe('패 세트', () => {
  it('더블식스 세트는 서로 다른 패 28개이고 더블이 7개다', () => {
    expect(SET).toHaveLength(28);
    expect(new Set(SET.map((t) => `${t.a}-${t.b}`)).size).toBe(28);
    expect(new Set(SET.map((t) => t.id)).size).toBe(28);
    expect(SET.every((t) => t.a <= t.b && t.a >= 0 && t.b <= 6)).toBe(true);
    expect(SET.filter(isDouble)).toHaveLength(7);
    expect(handPips(SET)).toBe(168);
    // 숫자마다 그 숫자가 들어간 패가 7개씩
    for (let n = 0; n <= 6; n++) expect(SET.filter((t) => t.a === n || t.b === n)).toHaveLength(7);
  });
});

describe('나눠 주기와 시작', () => {
  it('2명이면 7개씩(더미 14개), 3~4명이면 5개씩(더미 13·8개) 나눠 준다', () => {
    const cases: [number, number, number][] = [
      [2, 7, 14],
      [3, 5, 13],
      [4, 5, 8],
    ];
    for (const [n, size, rest] of cases) {
      for (const seed of [1, 2, 3]) {
        const s = createGame(setup(n), seededRandom(seed));
        expect(s.boneyard).toHaveLength(rest);
        // 첫 패를 낸 사람만 하나 적다.
        s.players.forEach((p, i) => expect(p.hand).toHaveLength(i === s.starter ? size - 1 : size));
        expect(s.line).toHaveLength(1);
        const ids = allIds(s);
        expect(ids).toHaveLength(28);
        expect(new Set(ids).size).toBe(28);
      }
    }
  });

  it('첫 판은 가장 높은 더블을 가진 사람이 자동으로 놓고, 다음 사람 차례가 된다', () => {
    for (const seed of [4, 5, 6, 7, 8]) {
      const s = createGame(setup(4), seededRandom(seed));
      const first = s.line[0].tile;
      expect(isDouble(first)).toBe(true);
      // 나눠 준 패(첫 패 포함) 중에 이보다 높은 더블은 없다.
      const dealt = [...s.players.flatMap((p) => p.hand), first];
      expect(dealt.filter((t) => isDouble(t) && t.a > first.a)).toHaveLength(0);
      expect(s.line[0].player).toBe(s.starter);
      expect(s.current).toBe((s.starter + 1) % 4);
      expect(s.events.some((e) => e.type === 'play' && e.auto)).toBe(true);
    }
  });

  it('아무도 더블이 없으면 점이 가장 많은 패로 시작한다', () => {
    const s = game(
      [
        [
          [0, 1],
          [3, 5],
        ],
        [
          [4, 6],
          [2, 3],
        ],
      ],
      [],
    );
    expect(findOpening(s.players)).toMatchObject({ player: 1, tile: T(4, 6), double: false });
    s.players[0].hand.push(T(1, 1));
    expect(findOpening(s.players)).toMatchObject({ player: 0, tile: T(1, 1), double: true });
  });

  it('두 번째 판부터는 지난 판에 이긴 사람이 아무 패로 시작한다 (규칙 선택)', () => {
    const s = game([[[2, 4]], [[1, 1], [6, 6]]], [[4, 3]], { endMode: 'points', targetScore: 150 });
    const after = applyAction(s, { type: 'play', tileId: T(2, 4).id, side: 'left' });
    expect(after.phase).toBe('roundover');
    expect(after.lastWinner).toBe(0);
    const next = applyAction(after, { type: 'nextRound' }, seededRandom(9));
    expect(next.round).toBe(after.round + 1);
    expect(next.line).toHaveLength(0);
    expect(next.current).toBe(0);
    expect(legalMoves(next)).toHaveLength(7);
    const pickTile = next.players[0].hand[3];
    const played = applyAction(next, { type: 'play', tileId: pickTile.id });
    expect(played.line).toHaveLength(1);
    expect(played.line[0].tile.id).toBe(pickTile.id);
    expect(played.current).toBe(1);
  });

  it('규칙을 끄면 다음 판도 가장 높은 더블로 자동 시작한다', () => {
    const s = game([[[2, 4]], [[1, 1], [6, 6]]], [[4, 3]], { endMode: 'points', targetScore: 150, winnerStarts: false });
    const after = applyAction(s, { type: 'play', tileId: T(2, 4).id, side: 'left' });
    const next = applyAction(after, { type: 'nextRound' }, seededRandom(9));
    expect(next.line).toHaveLength(1);
    expect(isDouble(next.line[0].tile)).toBe(true);
  });
});

describe('패 놓기', () => {
  it('두 끝 중 맞는 끝에만 놓을 수 있다', () => {
    const s = game(
      [
        [
          [3, 6],
          [5, 1],
          [2, 4],
        ],
        [[0, 0]],
      ],
      [
        [3, 4],
        [4, 5],
      ],
    );
    expect(lineEnds(s)).toEqual({ left: 3, right: 5 });
    expect(legalMoves(s)).toEqual([
      { tileId: T(3, 6).id, side: 'left' },
      { tileId: T(1, 5).id, side: 'right' },
    ]);
    // 안 맞는 패나 안 맞는 끝은 무시
    expect(applyAction(s, { type: 'play', tileId: T(2, 4).id })).toBe(s);
    expect(applyAction(s, { type: 'play', tileId: T(3, 6).id, side: 'right' })).toBe(s);
    // 다른 사람 패는 낼 수 없다
    expect(applyAction(s, { type: 'play', tileId: T(0, 0).id })).toBe(s);
  });

  it('왼쪽에 놓으면 패를 돌려서 맞는 숫자가 줄 쪽을 보고, 줄은 이어진다', () => {
    const s = game([[[3, 6], [1, 5], [0, 2]], [[0, 0], [2, 2]]], [[3, 4], [4, 5]]);
    const a = applyAction(s, { type: 'play', tileId: T(3, 6).id, side: 'left' });
    expect(a.line[0]).toMatchObject({ left: 6, right: 3 });
    expect(a.origin).toBe(1);
    expect(lineEnds(a)).toEqual({ left: 6, right: 5 });
    expect(a.current).toBe(1);
    expect(chainOk(a)).toBe(true);
    expect(s.line).toHaveLength(2); // 원래 상태는 그대로
  });

  it('더블은 같은 숫자 끝에 놓이고 끝 숫자는 그대로다', () => {
    const s = game([[[5, 5], [0, 1]], [[2, 2]]], [[3, 5]]);
    expect(sidesFor(s, T(5, 5))).toEqual(['right']);
    const a = applyAction(s, { type: 'play', tileId: T(5, 5).id });
    expect(a.line[1]).toMatchObject({ left: 5, right: 5 });
    expect(lineEnds(a)).toEqual({ left: 3, right: 5 });
  });

  it('두 끝에 모두 맞으면 고를 수 있고, 고른 끝에 따라 결과가 다르다', () => {
    const s = game([[[3, 5], [0, 1]], [[2, 2]]], [[3, 4], [4, 5]]);
    expect(needsSideChoice(s, T(3, 5))).toBe(true);
    const left = applyAction(s, { type: 'play', tileId: T(3, 5).id, side: 'left' });
    const right = applyAction(s, { type: 'play', tileId: T(3, 5).id, side: 'right' });
    expect(lineEnds(left)).toEqual({ left: 5, right: 5 });
    expect(lineEnds(right)).toEqual({ left: 3, right: 3 });
  });

  it('두 끝 숫자가 같으면 고를 필요 없이 짧은 쪽에 붙는다', () => {
    const s = game([[[4, 2], [0, 1]], [[6, 6]]], [[4, 0], [0, 0], [0, 3], [3, 4]]);
    s.origin = 2; // 왼쪽 팔이 더 길다 → 오른쪽에 붙는다
    expect(needsSideChoice(s, T(2, 4))).toBe(false);
    const a = applyAction(s, { type: 'play', tileId: T(2, 4).id });
    expect(a.line[a.line.length - 1].tile.id).toBe(T(2, 4).id);
    s.origin = 0; // 오른쪽 팔이 더 길다 → 왼쪽에 붙는다
    const b = applyAction(s, { type: 'play', tileId: T(2, 4).id });
    expect(b.line[0].tile.id).toBe(T(2, 4).id);
  });

  it('상태는 JSON으로 저장할 수 있고, 저장 검사는 망가진 상태를 걸러 낸다', () => {
    const s = createGame(setup(3, { endMode: 'points' }), seededRandom(11));
    const copy = JSON.parse(JSON.stringify(s));
    expect(copy).toEqual(s);
    expect(isValidState(copy)).toBe(true);
    const dup = structuredClone(s);
    dup.players[0].hand[0] = dup.players[1].hand[0]; // 같은 패가 두 번
    expect(isValidState(dup)).toBe(false);
    const broken = game([[[3, 6]], [[0, 0]]], [[3, 4], [5, 6]]); // 이어지지 않는 줄
    expect(isValidState(broken)).toBe(false);
    expect(isValidState({ ...s, players: [s.players[0]] })).toBe(false);
    expect(isValidState(null)).toBe(false);
  });
});

describe('뽑기와 통과', () => {
  it('낼 패가 있으면 뽑을 수도 통과할 수도 없다', () => {
    const s = game([[[3, 6], [0, 1]], [[2, 2]]], [[3, 4]]);
    expect(canDraw(s)).toBe(false);
    expect(canPass(s)).toBe(false);
    expect(applyAction(s, { type: 'draw' })).toBe(s);
    expect(applyAction(s, { type: 'pass' })).toBe(s);
  });

  it('낼 수 있는 패가 나올 때까지 한 개씩 뽑고, 차례는 그대로다', () => {
    const s = game([[[0, 1]], [[2, 2]]], [[3, 4]], {}, [
      [5, 6],
      [3, 6],
      [0, 5],
      [1, 2],
    ]); // 더미 맨 위(끝)부터 1·2, 0·5, 3·6 순서로 나온다
    let g = applyAction(s, { type: 'draw' });
    expect(g.players[0].hand).toHaveLength(2);
    expect(g.current).toBe(0);
    expect(g.turnDraws).toBe(1);
    expect(g.players[0].lacks).toEqual([3, 4]);
    expect(canDraw(g)).toBe(true);
    g = applyAction(g, { type: 'draw' });
    g = applyAction(g, { type: 'draw' }); // 3·6이 나와서 낼 수 있다
    expect(g.players[0].hand.map((t) => t.id)).toContain(T(3, 6).id);
    expect(canDraw(g)).toBe(false);
    expect(applyAction(g, { type: 'draw' })).toBe(g);
    expect(g.log[g.log.length - 1].text).toContain('3개 뽑았어요');
    const played = applyAction(g, { type: 'play', tileId: T(3, 6).id });
    expect(played.current).toBe(1);
  });

  it('더미가 비었고 낼 패가 없으면 통과한다', () => {
    const s = game([[[0, 1]], [[4, 2]]], [[3, 4]], {}, []);
    expect(canDraw(s)).toBe(false);
    expect(canPass(s)).toBe(true);
    const g = applyAction(s, { type: 'pass' });
    expect(g.current).toBe(1);
    expect(g.players[0].lacks).toEqual([3, 4]);
    expect(g.events.some((e) => e.type === 'pass')).toBe(true);
  });

  it('블록 규칙이면 더미가 남아 있어도 뽑지 않고 통과한다', () => {
    const s = game([[[0, 1]], [[4, 2]]], [[3, 4]], { blockRule: true });
    expect(s.boneyard.length).toBeGreaterThan(0);
    expect(canDraw(s)).toBe(false);
    expect(applyAction(s, { type: 'draw' })).toBe(s);
    expect(canPass(s)).toBe(true);
    expect(applyAction(s, { type: 'pass' }).current).toBe(1);
  });
});

describe('판 끝과 점수', () => {
  it('패를 다 내면 다른 사람들 손에 남은 점을 모두 얻는다', () => {
    const s = game(
      [
        [[3, 6]],
        [
          [5, 5],
          [0, 1],
        ],
        [[2, 4]],
      ],
      [[3, 4]],
    );
    const g = applyAction(s, { type: 'play', tileId: T(3, 6).id });
    expect(g.phase).toBe('gameover');
    expect(g.roundResult).toMatchObject({ reason: 'domino', winner: 0, points: 11 + 6, handPips: [0, 11, 6] });
    expect(g.players[0].score).toBe(17);
    expect(g.rankings).toEqual([0, 2, 1]);
  });

  it('아무도 낼 수 없으면 막힌 판: 남은 점이 가장 적은 사람이 다른 사람 점을 가져간다', () => {
    // 0번이 6·3을 내면 끝이 6과 6 → 아무도 6이 없고 더미도 비었다.
    const s = game(
      [
        [
          [6, 3],
          [0, 1],
        ],
        [[2, 4]],
        [
          [5, 5],
          [0, 0],
        ],
      ],
      [
        [6, 2],
        [2, 3],
      ],
      {},
      [],
    );
    expect(isBlocked(s)).toBe(false);
    const g = applyAction(s, { type: 'play', tileId: T(3, 6).id, side: 'right' });
    expect(lineEnds(g)).toEqual({ left: 6, right: 6 });
    expect(g.roundResult).toMatchObject({ reason: 'blocked', winner: 0, handPips: [1, 6, 10], points: 16 });
    expect(g.events.some((e) => e.type === 'blocked')).toBe(true);
  });

  it('막힌 판에서 점이 같으면 패가 적은 사람이, 그래도 같으면 무승부', () => {
    const base = (hand1: [number, number][]) =>
      game(
        [
          [
            [6, 3],
            [1, 2],
          ],
          hand1,
        ],
        [
          [6, 2],
          [2, 3],
        ],
        {},
        [],
      );
    // 0번 남은 점 3 (1개), 1번 남은 점 3 (2개) → 0번 승
    const a = applyAction(base([[0, 1], [0, 2]]), { type: 'play', tileId: T(3, 6).id, side: 'right' });
    expect(a.roundResult).toMatchObject({ winner: 0, points: 3 });
    // 둘 다 점 3, 1개 → 무승부
    const b = applyAction(base([[0, 3]]), { type: 'play', tileId: T(3, 6).id, side: 'right' });
    expect(b.roundResult).toMatchObject({ winner: null, points: 0, tied: [0, 1] });
    expect(b.phase).toBe('gameover');
    expect(b.players.every((p) => p.score === 0)).toBe(true);
  });

  it('블록 규칙에서는 더미가 남아 있어도 모두 못 내면 막힌다', () => {
    const s = game([[[6, 3], [1, 2]], [[0, 1]]], [[6, 2], [2, 3]], { blockRule: true });
    expect(s.boneyard.length).toBeGreaterThan(0);
    const g = applyAction(s, { type: 'play', tileId: T(3, 6).id, side: 'right' });
    expect(g.roundResult?.reason).toBe('blocked');
  });

  it('점수 모으기: 목표 점수 전에는 판이 이어지고, 목표에 닿으면 우승', () => {
    const s = game([[[3, 6]], [[6, 6], [5, 5]]], [[3, 4]], { endMode: 'points', targetScore: 50 });
    const g = applyAction(s, { type: 'play', tileId: T(3, 6).id });
    expect(g.phase).toBe('roundover');
    expect(g.players[0].score).toBe(22);
    expect(applyAction(g, { type: 'play', tileId: 0 })).toBe(g);

    const near = game([[[3, 6]], [[6, 6], [5, 5]]], [[3, 4]], { endMode: 'points', targetScore: 50 });
    near.players[0].score = 30;
    near.players[1].score = 45;
    const done = applyAction(near, { type: 'play', tileId: T(3, 6).id });
    expect(done.phase).toBe('gameover');
    expect(done.players[0].score).toBe(52);
    expect(done.rankings).toEqual([0, 1]);
  });

  it('다음 판을 시작하면 패를 새로 나누고 점수는 그대로다', () => {
    const s = game([[[3, 6]], [[6, 6], [5, 5]]], [[3, 4]], { endMode: 'points', targetScore: 100, winnerStarts: false });
    const g = applyAction(s, { type: 'play', tileId: T(3, 6).id });
    const next = applyAction(g, { type: 'nextRound' }, seededRandom(3));
    expect(next.phase).toBe('play');
    expect(next.players[0].score).toBe(22);
    expect(next.players.every((p) => p.lacks.length === 0)).toBe(true);
    expect(new Set(allIds(next)).size).toBe(28);
    expect(next.boneyard).toHaveLength(14);
  });

});
