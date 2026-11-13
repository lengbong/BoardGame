import { ALL_DIGITS, BOX_OF, CELLS, COL_OF, PEERS, ROW_OF, UNITS, bitCount, isPeer } from './grid';

/**
 * 사람처럼 푸는 풀이기. 난이도 매기기와 힌트 설명에 쓴다.
 * 1단계: 하나만 남은 칸(naked single), 여기밖에 없는 칸(hidden single)
 * 2단계: 가리키기·가두기(pointing/claiming), 두 칸 두 숫자·세 칸 세 숫자(naked pair/triple)
 * 3단계: 숨은 짝·숨은 세 쌍, 네 칸 네 숫자, X-윙, XY-윙, 황새치(swordfish)
 * 이걸로도 못 풀면 4단계 (더 어려운 방법이나 시험해 보기가 필요)
 */
export type Technique =
  | 'nakedSingle'
  | 'hiddenSingle'
  | 'pointing'
  | 'claiming'
  | 'nakedPair'
  | 'nakedTriple'
  | 'hiddenPair'
  | 'hiddenTriple'
  | 'nakedQuad'
  | 'xWing'
  | 'swordfish'
  | 'xyWing';

export type LogicLevel = 1 | 2 | 3 | 4;

export const TECHNIQUE_INFO: Record<Technique, { level: 1 | 2 | 3; name: string }> = {
  nakedSingle: { level: 1, name: '하나만 남은 칸' },
  hiddenSingle: { level: 1, name: '여기밖에 없는 칸' },
  pointing: { level: 2, name: '한 줄로 몰린 후보' },
  claiming: { level: 2, name: '한 칸으로 몰린 후보' },
  nakedPair: { level: 2, name: '두 칸 두 숫자' },
  nakedTriple: { level: 2, name: '세 칸 세 숫자' },
  hiddenPair: { level: 3, name: '숨은 짝' },
  hiddenTriple: { level: 3, name: '숨은 세 쌍' },
  nakedQuad: { level: 3, name: '네 칸 네 숫자' },
  xWing: { level: 3, name: 'X-윙' },
  swordfish: { level: 3, name: '황새치(스워드피시)' },
  xyWing: { level: 3, name: 'XY-윙' },
};

/** 묶음 번호 → 화면에 쓰는 이름 */
export function unitName(unit: number): string {
  return unit < 9 ? '가로줄' : unit < 18 ? '세로줄' : '3×3 칸';
}

/** k개 고르기. fn이 true를 돌려주면 바로 멈추고 true */
function someCombo(items: readonly number[], k: number, fn: (picked: number[]) => boolean): boolean {
  const picked: number[] = [];
  const go = (start: number): boolean => {
    if (picked.length === k) return fn(picked);
    for (let a = start; a <= items.length - (k - picked.length); a++) {
      picked.push(items[a]);
      if (go(a + 1)) return true;
      picked.pop();
    }
    return false;
  };
  return go(0);
}

const lowBitIndex = (m: number) => 31 - Math.clz32(m & -m);

export interface SingleFound {
  cell: number;
  digit: number;
  technique: 'nakedSingle' | 'hiddenSingle';
  /** hidden single이면 그 숫자가 한 곳뿐인 묶음 */
  unit?: number;
}

/** 후보 숫자를 들고 논리로만 푸는 판 */
export class LogicBoard {
  readonly values = new Int8Array(CELLS);
  readonly cands = new Int16Array(CELLS);
  remaining = 0;
  broken = false;

  constructor(grid: readonly number[]) {
    for (let i = 0; i < CELLS; i++) {
      const v = grid[i] | 0;
      this.values[i] = v;
      if (!v) this.remaining++;
    }
    for (let i = 0; i < CELLS; i++) {
      if (this.values[i]) continue;
      let used = 0;
      for (const p of PEERS[i]) if (this.values[p]) used |= 1 << (this.values[p] - 1);
      this.cands[i] = ALL_DIGITS & ~used;
      if (this.cands[i] === 0) this.broken = true;
    }
  }

  place(i: number, d: number): void {
    const b = 1 << (d - 1);
    if (this.values[i] || !(this.cands[i] & b)) {
      this.broken = true;
      return;
    }
    this.values[i] = d;
    this.cands[i] = 0;
    this.remaining--;
    for (const p of PEERS[i]) {
      if (this.values[p]) {
        if (this.values[p] === d) this.broken = true;
        continue;
      }
      if (this.cands[p] & b) {
        this.cands[p] &= ~b;
        if (this.cands[p] === 0) this.broken = true;
      }
    }
  }

  private eliminate(i: number, mask: number): boolean {
    if (this.values[i] || !(this.cands[i] & mask)) return false;
    this.cands[i] &= ~mask;
    if (this.cands[i] === 0) this.broken = true;
    return true;
  }

  /** 판을 바꾸지 않고 single 하나를 찾는다. prefer 칸을 먼저 본다. */
  findSingle(prefer = -1): SingleFound | null {
    if (prefer >= 0 && !this.values[prefer]) {
      const m = this.cands[prefer];
      if (bitCount(m) === 1) return { cell: prefer, digit: lowBitIndex(m) + 1, technique: 'nakedSingle' };
      const units = [18 + BOX_OF[prefer], ROW_OF[prefer], 9 + COL_OF[prefer]];
      for (const u of units) {
        for (let d = 1; d <= 9; d++) {
          const b = 1 << (d - 1);
          if (!(m & b)) continue;
          if (UNITS[u].every((j) => j === prefer || !(this.cands[j] & b))) {
            return { cell: prefer, digit: d, technique: 'hiddenSingle', unit: u };
          }
        }
      }
    }
    for (let i = 0; i < CELLS; i++) {
      if (!this.values[i] && bitCount(this.cands[i]) === 1) {
        return { cell: i, digit: lowBitIndex(this.cands[i]) + 1, technique: 'nakedSingle' };
      }
    }
    // 3×3 칸 → 가로줄 → 세로줄 순서 (3×3 칸이 아이들에게 가장 찾기 쉽다)
    for (const u of [18, 19, 20, 21, 22, 23, 24, 25, 26, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]) {
      const found = this.hiddenSingleIn(u);
      if (found) return found;
    }
    return null;
  }

  private hiddenSingleIn(u: number): SingleFound | null {
    const unit = UNITS[u];
    for (let d = 1; d <= 9; d++) {
      const b = 1 << (d - 1);
      let at = -1;
      let n = 0;
      for (const i of unit) {
        if (this.values[i] === d) {
          n = -1;
          break;
        }
        if (this.cands[i] & b) {
          n++;
          at = i;
        }
      }
      if (n === 1) return { cell: at, digit: d, technique: 'hiddenSingle', unit: u };
    }
    return null;
  }

  /** 하나만 남은 칸을 모두 채운다. 채운 칸 수 */
  nakedSingles(): number {
    let n = 0;
    for (let i = 0; i < CELLS; i++) {
      if (this.values[i] || bitCount(this.cands[i]) !== 1) continue;
      this.place(i, lowBitIndex(this.cands[i]) + 1);
      n++;
      if (this.broken) return n;
    }
    return n;
  }

  /** 묶음 안에서 한 곳뿐인 숫자를 모두 채운다. 채운 칸 수 */
  hiddenSingles(): number {
    let n = 0;
    for (let u = 0; u < 27; u++) {
      for (;;) {
        const found = this.hiddenSingleIn(u);
        if (!found) break;
        this.place(found.cell, found.digit);
        n++;
        if (this.broken) return n;
      }
    }
    return n;
  }

  /** 3×3 칸 안의 후보가 한 줄에만 있으면 그 줄의 바깥 칸에서 지운다. */
  pointing(): boolean {
    for (let bx = 0; bx < 9; bx++) {
      const unit = UNITS[18 + bx];
      for (let d = 1; d <= 9; d++) {
        const b = 1 << (d - 1);
        let rows = 0;
        let cols = 0;
        let count = 0;
        for (const i of unit) {
          if (this.cands[i] & b) {
            rows |= 1 << ROW_OF[i];
            cols |= 1 << COL_OF[i];
            count++;
          }
        }
        if (count < 2) continue;
        if (bitCount(rows) === 1) {
          let changed = false;
          for (const i of UNITS[lowBitIndex(rows)]) if (BOX_OF[i] !== bx && this.eliminate(i, b)) changed = true;
          if (changed) return true;
        }
        if (bitCount(cols) === 1) {
          let changed = false;
          for (const i of UNITS[9 + lowBitIndex(cols)]) if (BOX_OF[i] !== bx && this.eliminate(i, b)) changed = true;
          if (changed) return true;
        }
      }
    }
    return false;
  }

  /** 줄 안의 후보가 한 3×3 칸에만 있으면 그 칸의 다른 줄에서 지운다. */
  claiming(): boolean {
    for (let u = 0; u < 18; u++) {
      const unit = UNITS[u];
      for (let d = 1; d <= 9; d++) {
        const b = 1 << (d - 1);
        let boxes = 0;
        let count = 0;
        for (const i of unit) {
          if (this.cands[i] & b) {
            boxes |= 1 << BOX_OF[i];
            count++;
          }
        }
        if (count < 2 || bitCount(boxes) !== 1) continue;
        const inLine = new Set(unit);
        let changed = false;
        for (const i of UNITS[18 + lowBitIndex(boxes)]) if (!inLine.has(i) && this.eliminate(i, b)) changed = true;
        if (changed) return true;
      }
    }
    return false;
  }

  /** 묶음 안 k칸의 후보를 합친 게 딱 k개면 다른 칸에서 그 숫자들을 지운다. */
  nakedSubset(k: number): boolean {
    for (let u = 0; u < 27; u++) {
      const unit = UNITS[u];
      const empties = unit.filter((i) => !this.values[i]);
      if (empties.length <= k) continue;
      const pool = empties.filter((i) => bitCount(this.cands[i]) >= 2 && bitCount(this.cands[i]) <= k);
      if (pool.length < k) continue;
      const hit = someCombo(pool, k, (cells) => {
        let union = 0;
        for (const i of cells) union |= this.cands[i];
        if (bitCount(union) !== k) return false;
        let changed = false;
        for (const i of empties) if (!cells.includes(i) && this.eliminate(i, union)) changed = true;
        return changed;
      });
      if (hit) return true;
    }
    return false;
  }

  /** 묶음 안에서 k개 숫자가 딱 k칸에만 들어갈 수 있으면 그 칸의 다른 후보를 지운다. */
  hiddenSubset(k: number): boolean {
    for (let u = 0; u < 27; u++) {
      const unit = UNITS[u];
      let emptyCount = 0;
      for (const i of unit) if (!this.values[i]) emptyCount++;
      if (emptyCount <= k) continue;
      const pos = new Array<number>(10).fill(0);
      const digits: number[] = [];
      for (let d = 1; d <= 9; d++) {
        const b = 1 << (d - 1);
        for (let p = 0; p < 9; p++) if (this.cands[unit[p]] & b) pos[d] |= 1 << p;
        const n = bitCount(pos[d]);
        if (n >= 2 && n <= k) digits.push(d);
      }
      if (digits.length < k) continue;
      const hit = someCombo(digits, k, (ds) => {
        let union = 0;
        let keep = 0;
        for (const d of ds) {
          union |= pos[d];
          keep |= 1 << (d - 1);
        }
        if (bitCount(union) !== k) return false;
        let changed = false;
        for (let p = 0; p < 9; p++) if (union & (1 << p) && this.eliminate(unit[p], ALL_DIGITS & ~keep)) changed = true;
        return changed;
      });
      if (hit) return true;
    }
    return false;
  }

  /** 물고기 무늬: k=2 X-윙, k=3 황새치 */
  fish(k: number): boolean {
    for (let d = 1; d <= 9; d++) {
      const b = 1 << (d - 1);
      for (const byRow of [true, false]) {
        const cover = new Array<number>(9).fill(0);
        const lines: number[] = [];
        for (let line = 0; line < 9; line++) {
          for (let x = 0; x < 9; x++) {
            const i = byRow ? line * 9 + x : x * 9 + line;
            if (this.cands[i] & b) cover[line] |= 1 << x;
          }
          const n = bitCount(cover[line]);
          if (n >= 2 && n <= k) lines.push(line);
        }
        if (lines.length < k) continue;
        const hit = someCombo(lines, k, (base) => {
          let union = 0;
          for (const l of base) union |= cover[l];
          if (bitCount(union) !== k) return false;
          let changed = false;
          for (let x = 0; x < 9; x++) {
            if (!(union & (1 << x))) continue;
            for (let line = 0; line < 9; line++) {
              if (base.includes(line)) continue;
              const i = byRow ? line * 9 + x : x * 9 + line;
              if (this.eliminate(i, b)) changed = true;
            }
          }
          return changed;
        });
        if (hit) return true;
      }
    }
    return false;
  }

  /** XY-윙: 가운데 {a,b}, 날개 {a,c}·{b,c} → 두 날개를 모두 보는 칸에서 c를 지운다. */
  xyWing(): boolean {
    for (let p = 0; p < CELLS; p++) {
      const mp = this.cands[p];
      if (this.values[p] || bitCount(mp) !== 2) continue;
      const wings = PEERS[p].filter((x) => !this.values[x] && bitCount(this.cands[x]) === 2 && bitCount(this.cands[x] & mp) === 1);
      for (let a = 0; a < wings.length; a++) {
        for (let c = a + 1; c < wings.length; c++) {
          const x = wings[a];
          const y = wings[c];
          const mx = this.cands[x];
          const my = this.cands[y];
          if (mx === my || bitCount(mp | mx | my) !== 3) continue;
          const z = mx & my;
          let changed = false;
          for (const i of PEERS[x]) if (i !== p && i !== y && isPeer(i, y) && this.eliminate(i, z)) changed = true;
          if (changed) return true;
        }
      }
    }
    return false;
  }

  /** maxLevel까지의 방법 중 하나로 후보를 지워 본다. 쓴 방법 (없으면 null) */
  eliminateStep(maxLevel: number): Technique | null {
    if (maxLevel >= 2) {
      if (this.pointing()) return 'pointing';
      if (this.claiming()) return 'claiming';
      if (this.nakedSubset(2)) return 'nakedPair';
      if (this.nakedSubset(3)) return 'nakedTriple';
    }
    if (maxLevel >= 3) {
      if (this.hiddenSubset(2)) return 'hiddenPair';
      if (this.fish(2)) return 'xWing';
      if (this.xyWing()) return 'xyWing';
      if (this.hiddenSubset(3)) return 'hiddenTriple';
      if (this.nakedSubset(4)) return 'nakedQuad';
      if (this.fish(3)) return 'swordfish';
    }
    return null;
  }
}

export interface GradeResult {
  /** maxLevel까지의 방법으로 끝까지 풀었는지 */
  solved: boolean;
  /** 풀었으면 쓴 방법 중 가장 어려운 단계, 못 풀었으면 maxLevel + 1 (그보다 어렵다는 뜻) */
  level: LogicLevel;
  /** 방법마다 쓴 횟수 */
  counts: Partial<Record<Technique, number>>;
}

/** 사람의 방법으로 풀어 보고 난이도 단계를 매긴다. */
export function gradePuzzle(grid: readonly number[], maxLevel: 1 | 2 | 3 = 3): GradeResult {
  const board = new LogicBoard(grid);
  const counts: Partial<Record<Technique, number>> = {};
  const bump = (t: Technique, n = 1) => (counts[t] = (counts[t] ?? 0) + n);
  let level = 1;
  while (board.remaining > 0 && !board.broken) {
    const naked = board.nakedSingles();
    if (naked > 0) {
      bump('nakedSingle', naked);
      continue;
    }
    const hidden = board.hiddenSingles();
    if (hidden > 0) {
      bump('hiddenSingle', hidden);
      continue;
    }
    const t = board.eliminateStep(maxLevel);
    if (!t) break;
    bump(t);
    level = Math.max(level, TECHNIQUE_INFO[t].level);
  }
  const solved = board.remaining === 0 && !board.broken;
  return { solved, level: (solved ? level : maxLevel + 1) as LogicLevel, counts };
}

export interface LogicalStep extends SingleFound {
  /** 이 칸을 찾기 전에 후보를 줄이려고 쓴 방법들 */
  via: Technique[];
}

/** 지금 판에서 사람의 방법으로 채울 수 있는 칸 하나를 찾는다 (힌트용). 못 찾으면 null */
export function findLogicalStep(values: readonly number[], prefer = -1): LogicalStep | null {
  const board = new LogicBoard(values);
  if (board.broken) return null;
  const via: Technique[] = [];
  for (let guard = 0; guard < 200; guard++) {
    const single = board.findSingle(prefer);
    if (single) return { ...single, via };
    const t = board.eliminateStep(3);
    if (!t || board.broken) return null;
    if (!via.includes(t)) via.push(t);
  }
  return null;
}
