import { TILE_COLORS } from './tiles';
import type { TableSet, Tile } from './types';

export interface SetAnalysis {
  valid: boolean;
  kind: 'group' | 'run' | null;
  /** 보여 줄 순서 (연속 줄은 작은 수부터, 같은 숫자 줄은 색 순서) */
  arranged: Tile[];
  /** arranged 순서대로 각 타일이 나타내는 숫자 (조커는 대신하는 숫자) */
  values: number[];
  /** 줄의 점수 (첫 등록 계산용) */
  points: number;
  /** 올바르지 않을 때 이유 */
  reason?: string;
}

const colorIndex = (t: Tile) => (t.joker ? 9 : TILE_COLORS.indexOf(t.color!));

function displayOrder(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => Number(a.joker) - Number(b.joker) || a.value - b.value || colorIndex(a) - colorIndex(b));
}

/** 같은 숫자 줄: 3~4개, 숫자가 모두 같고 색은 모두 달라야 한다. */
function asGroup(plain: Tile[], jokers: Tile[]): SetAnalysis | null {
  const v = plain[0].value;
  if (!plain.every((t) => t.value === v)) return null;
  if (new Set(plain.map((t) => t.color)).size !== plain.length) return null;
  const n = plain.length + jokers.length;
  if (n > 4) return null;
  const arranged = [...plain].sort((a, b) => colorIndex(a) - colorIndex(b)).concat(jokers);
  return { valid: true, kind: 'group', arranged, values: arranged.map(() => v), points: v * n };
}

/** 연속 줄: 3개 이상, 색이 모두 같고 숫자가 이어져야 한다. (13 다음에 1은 올 수 없음) */
function asRun(plain: Tile[], jokers: Tile[]): SetAnalysis | null {
  const color = plain[0].color;
  if (!plain.every((t) => t.color === color)) return null;
  const sorted = [...plain].sort((a, b) => a.value - b.value);
  for (let i = 1; i < sorted.length; i++) if (sorted[i].value === sorted[i - 1].value) return null;
  const min = sorted[0].value;
  const max = sorted[sorted.length - 1].value;
  const gaps = max - min + 1 - sorted.length;
  if (gaps > jokers.length) return null;
  const len = plain.length + jokers.length;
  if (len > 13) return null;
  // 남는 조커는 큰 쪽 끝에 먼저 붙이고, 13을 넘으면 작은 쪽에 붙인다.
  const extra = jokers.length - gaps;
  const high = Math.min(extra, 13 - max);
  const start = min - (extra - high);
  if (start < 1) return null;
  const byValue = new Map(sorted.map((t) => [t.value, t]));
  const arranged: Tile[] = [];
  const values: number[] = [];
  let j = 0;
  for (let v = start; v < start + len; v++) {
    arranged.push(byValue.get(v) ?? jokers[j++]);
    values.push(v);
  }
  return { valid: true, kind: 'run', arranged, values, points: values.reduce((a, b) => a + b, 0) };
}

/** 줄 하나가 올바른지 살펴보고, 보기 좋은 순서와 점수를 돌려준다. */
export function analyzeSet(tiles: Tile[]): SetAnalysis {
  const fail = (reason: string): SetAnalysis => {
    const arranged = displayOrder(tiles);
    return { valid: false, kind: null, arranged, values: arranged.map((t) => t.value), points: 0, reason };
  };
  if (tiles.length < 3) return fail('3개 이상이어야 해요');
  const jokers = tiles.filter((t) => t.joker);
  const plain = tiles.filter((t) => !t.joker);
  if (plain.length === 0) return fail('숫자 타일이 있어야 해요');

  // 숫자 타일이 하나뿐이면 두 가지 다 될 수 있다. 그때는 연속 줄로 본다.
  const run = asRun(plain, jokers);
  if (run) return run;
  const group = asGroup(plain, jokers);
  if (group) return group;

  const sameValue = plain.every((t) => t.value === plain[0].value);
  const sameColor = plain.every((t) => t.color === plain[0].color);
  if (sameValue) {
    if (tiles.length > 4) return fail('같은 숫자 줄은 4개까지예요');
    return fail('같은 숫자 줄은 색이 모두 달라야 해요');
  }
  if (sameColor) {
    if (new Set(plain.map((t) => t.value)).size !== plain.length) return fail('같은 숫자가 두 번 있어요');
    if (tiles.length > 13) return fail('13개까지만 이을 수 있어요');
    return fail('숫자가 이어지지 않아요');
  }
  return fail('같은 숫자(색은 모두 다르게)나 같은 색 연속 숫자여야 해요');
}

export function isValidTable(table: TableSet[]): boolean {
  return table.every((s) => analyzeSet(s.tiles).valid);
}
