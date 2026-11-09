import { describe, expect, it } from 'vitest';
import { planMove, rackCombo } from './ai';
import { DEFAULT_OPTIONS, applyAction, checkCommit, createGame } from './rules';
import type { SeatKind, Tile, TileColor, TilesOptions, TilesSetup, TilesState } from './types';

let nextId = 3000;
const t = (color: TileColor, value: number): Tile => ({ id: nextId++, color, value, joker: false });
const J = (): Tile => ({ id: nextId++, color: null, value: 0, joker: true });
const r = (v: number) => t('red', v);
const b = (v: number) => t('blue', v);
const g = (v: number) => t('green', v);
const k = (v: number) => t('black', v);

function game(racks: Tile[][], table: Tile[][] = [], opts: Partial<TilesOptions> = {}, melded = true): TilesState {
  const seats = (['ai-normal', 'ai-normal', 'ai-normal', 'ai-normal'] as SeatKind[]).map((kind, i) => ({
    kind: i < racks.length ? kind : 'empty',
    name: `C${i}`,
  })) as TilesSetup['seats'];
  const s = createGame({ seats, options: { ...DEFAULT_OPTIONS, ...opts } }, () => 0);
  s.players.forEach((p, i) => {
    p.rack = racks[i];
    p.melded = melded;
  });
  s.table = table.map((tiles, i) => ({ id: 100 + i, tiles }));
  s.current = 0;
  return s;
}

function rackAfter(s: TilesState): Tile[] {
  const action = planMove(s, 'ai-normal');
  expect(action.type).toBe('commit');
  const after = applyAction(s, action);
  expect(after).not.toBe(s);
  return after.players[0].rack;
}

describe('내 타일로 줄 만들기', () => {
  it('겹치지 않게 가장 많은 타일을 쓰는 조합을 찾는다', () => {
    // 빨강 3 4 5 6 + 파랑 6 + 초록 6 → 3~5 와 6 6 6 이 최선 (6개 모두)
    const rack = [r(3), r(4), r(5), r(6), b(6), g(6), k(1)];
    const combo = rackCombo(rack, 0, 20000);
    expect(combo.sets.flat()).toHaveLength(6);
  });

  it('조커를 빈자리에 쓴다', () => {
    const combo = rackCombo([r(3), J(), r(5), k(9)], 0, 20000);
    expect(combo.sets).toHaveLength(1);
    expect(combo.sets[0]).toHaveLength(3);
  });

  it('첫 등록은 30점을 먼저 맞춘다', () => {
    const combo = rackCombo([r(1), r(2), r(3), b(11), g(11), k(11)], 30, 20000);
    expect(combo.points).toBeGreaterThanOrEqual(30);
  });
});

describe('컴퓨터 플레이어', () => {
  it('첫 등록 점수가 모자라면 가져온다', () => {
    const s = game([[r(1), r(2), r(3), b(9)], [k(1)]], [], {}, false);
    expect(planMove(s, 'ai-normal')).toEqual({ type: 'draw' });
  });

  it('첫 등록을 할 수 있으면 한다', () => {
    const s = game([[r(10), b(10), g(10), k(2)], [k(1)]], [], {}, false);
    const action = planMove(s, 'ai-normal');
    expect(action.type).toBe('commit');
    if (action.type === 'commit') expect(checkCommit(s, action.table).ok).toBe(true);
  });

  it('판의 줄 끝에 붙인다', () => {
    const s = game([[b(4), k(9)], [k(1)]], [[b(1), b(2), b(3)]]);
    expect(rackAfter(s).map((x) => x.value)).toEqual([9]);
  });

  it('긴 연속 줄을 나눠서 가운데에 넣는다 (정통 규칙)', () => {
    const s = game([[r(6), k(12)], [k(1)]], [[r(3), r(4), r(5), r(6), r(7), r(8), r(9)]]);
    expect(rackAfter(s).map((x) => x.value)).toEqual([12]);
  });

  it('판의 남는 타일을 빌려서 새 줄을 만든다 (정통 규칙)', () => {
    // 판: 파랑 5 6 7 8 → 8을 빌려서 빨강 8, 초록 8과 같은 숫자 줄
    const s = game([[r(8), g(8), k(12)], [k(1)]], [[b(5), b(6), b(7), b(8)]]);
    expect(rackAfter(s).map((x) => x.value)).toEqual([12]);
  });

  it('간단 규칙에서는 나누거나 빌리지 않는다', () => {
    const s = game([[r(8), g(8), k(12)], [k(1)]], [[b(5), b(6), b(7), b(8)]], { rearrange: false });
    expect(planMove(s, 'ai-normal')).toEqual({ type: 'draw' });
  });

  it('낼 게 없으면 가져온다', () => {
    const s = game([[r(1), b(5), k(12)], [k(1)]], [[g(7), g(8), g(9)]]);
    expect(planMove(s, 'ai-normal')).toEqual({ type: 'draw' });
    expect(planMove(s, 'ai-easy')).toEqual({ type: 'draw' });
  });

  it('판이 끝났으면 다음 판을 시작한다', () => {
    const s = game([[r(1)], [k(1)]]);
    s.phase = 'roundover';
    expect(planMove(s, 'ai-easy')).toEqual({ type: 'nextRound' });
  });
});
