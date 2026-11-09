import { analyzeSet } from './sets';
import type { TableSet, Tile, TilesState } from './types';

/**
 * 사람이 차례 중에 판을 고치는 동안의 작업 상태.
 * '완료'를 누르면 table을 그대로 제출한다.
 */
export interface Work {
  table: TableSet[];
  rack: Tile[];
  /** 차례를 시작할 때 내 타일 칸에 있던 타일 id (판에서 되돌려 받을 수 있는 타일) */
  ownIds: number[];
  /** 차례를 시작할 때 판에 있던 줄 id */
  oldSetIds: number[];
  nextTempId: number;
}

export type Target = number | 'new' | 'rack';

export function startWork(state: TilesState): Work {
  const rack = state.players[state.current].rack;
  return {
    table: state.table.map((s) => ({ id: s.id, tiles: [...s.tiles] })),
    rack: [...rack],
    ownIds: rack.map((t) => t.id),
    oldSetIds: state.table.map((s) => s.id),
    nextTempId: -1,
  };
}

/** 판에 있던 타일인지 (이번 차례에 내 타일 칸에서 꺼낸 게 아닌지) */
export function isTableTile(work: Work, id: number): boolean {
  return !work.ownIds.includes(id);
}

/**
 * 고른 타일들을 target으로 옮긴다.
 * - 'new': 새 줄을 만든다
 * - 'rack': 내 타일 칸으로 되돌린다 (이번 차례에 꺼낸 내 타일만)
 * - 숫자: 그 줄에 붙인다
 * 옮길 수 없는 타일은 그대로 둔다.
 */
export function moveTiles(work: Work, ids: number[], target: Target): Work {
  const moving = ids.filter((id) => (target === 'rack' ? !isTableTile(work, id) : true));
  if (moving.length === 0) return work;
  const pick = new Set(moving);
  const taken: Tile[] = [];
  const rack = work.rack.filter((t) => {
    if (pick.has(t.id)) {
      taken.push(t);
      return false;
    }
    return true;
  });
  let table = work.table.map((s) => ({
    id: s.id,
    tiles: s.tiles.filter((t) => {
      if (pick.has(t.id)) {
        taken.push(t);
        return false;
      }
      return true;
    }),
  }));
  let nextTempId = work.nextTempId;
  if (target === 'rack') {
    rack.push(...taken);
  } else if (target === 'new') {
    table.push({ id: nextTempId, tiles: taken });
    nextTempId -= 1;
  } else {
    const dest = table.find((s) => s.id === target);
    if (!dest) return work;
    dest.tiles = analyzeSet([...dest.tiles, ...taken]).arranged;
  }
  table = table.filter((s) => s.tiles.length > 0).map((s) => ({ id: s.id, tiles: analyzeSet(s.tiles).arranged }));
  return { ...work, table, rack, nextTempId };
}

/** 이번 차례에 판에 낸 내 타일 수 */
export function playedCount(work: Work): number {
  return work.ownIds.length - work.rack.length;
}
