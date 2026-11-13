import { pick } from '../../lib/random';
import { neighbors4, neighbors8, randomFleet } from './fleet';
import { knowledgeFor } from './rules';
import { HIT, MISS, UNKNOWN, type DuelAiLevel, type Knowledge, type PlacedShip, type Rng, type SeaSize, type ShipsAction, type ShipsState } from './types';

/*
 * 컴퓨터 플레이어.
 * decideShot은 쏘는 사람이 아는 정보(Knowledge)만 받는다. 상대 배 위치는 받지 않으므로
 * 숨긴 정보를 몰래 볼 수 없다.
 *  - 쉬움: 아직 안 쏜 칸 아무 데나
 *  - 보통: 찾기/노리기. 맞히면 위아래양옆을 쏘고, 두 칸이 이어지면 그 줄을 따라간다.
 *          찾을 때는 바둑판 무늬(한 칸 건너)로 쏘고, 남은 가장 작은 배도 못 들어가는 칸은 건너뛴다.
 *  - 어려움: 남은 배들이 놓일 수 있는 모든 자리를 세어 확률이 가장 높은 칸을 쏜다.
 *            가라앉지 않은 명중 칸이 있으면 그 칸을 지나는 자리만 센다. 붙이지 않기 규칙도 따진다.
 */

/** 컴퓨터가 쓸 함대 배치 (무작위, 규칙을 지킨다) */
export function computerFleet(size: SeaSize, noTouch: boolean, rng: Rng): PlacedShip[] {
  return randomFleet(size, noTouch, rng);
}

/** 지금 쏘는 컴퓨터의 행동. 상태에서 쏘는 사람이 아는 것만 꺼내서 decideShot에 넘긴다. */
export function decideAction(state: ShipsState, level: DuelAiLevel, rng: Rng = Math.random): ShipsAction {
  return { type: 'fire', cell: decideShot(knowledgeFor(state, state.current), level, rng) };
}

export function decideShot(k: Knowledge, level: DuelAiLevel, rng: Rng = Math.random): number {
  const unknown = unknownCells(k);
  if (unknown.length === 0) return -1;
  let cell: number | undefined;
  if (level === 'ai-easy') cell = pick(unknown, rng);
  else if (level === 'ai-normal') cell = normalShot(k, rng);
  else cell = hardShot(k, rng);
  // 혹시라도 쏜 칸을 고르면 안 쏜 칸으로 바꾼다.
  return cell !== undefined && k.marks[cell] === UNKNOWN ? cell : pick(unknown, rng)!;
}

// ------------------------------------------------------------------ 공통 도구

export function unknownCells(k: Knowledge): number[] {
  const out: number[] = [];
  for (let c = 0; c < k.marks.length; c++) if (k.marks[c] === UNKNOWN) out.push(c);
  return out;
}

function sunkCellSet(k: Knowledge): Set<number> {
  const set = new Set<number>();
  for (const s of k.sunk) for (const c of s.cells) set.add(c);
  return set;
}

/** 맞혔지만 아직 가라앉지 않은 배의 칸 */
export function unsunkHits(k: Knowledge): number[] {
  const sunk = sunkCellSet(k);
  const out: number[] = [];
  for (let c = 0; c < k.marks.length; c++) if (k.marks[c] === HIT && !sunk.has(c)) out.push(c);
  return out;
}

/** 붙이지 않기 규칙에서 가라앉은 배 둘레 (배가 있을 수 없다) */
function nearSunk(k: Knowledge): Set<number> {
  const set = new Set<number>();
  if (!k.noTouch) return set;
  for (const s of k.sunk) for (const c of s.cells) for (const n of neighbors8(c, k.size)) set.add(n);
  return set;
}

/**
 * 배가 없다고 확실히 아는 칸: 물보라 칸, 그리고 붙이지 않기 규칙이면
 * 가라앉은 배 둘레와 명중 칸의 대각선 칸 (곧은 배는 대각선으로 이어지지 않으니 다른 배가 붙어 있는 셈).
 */
export function knownEmpty(k: Knowledge): Set<number> {
  const set = new Set<number>();
  for (let c = 0; c < k.marks.length; c++) if (k.marks[c] === MISS) set.add(c);
  if (!k.noTouch) return set;
  for (const c of nearSunk(k)) set.add(c);
  for (const h of unsunkHits(k)) {
    const orth = new Set(neighbors4(h, k.size));
    for (const n of neighbors8(h, k.size)) if (!orth.has(n)) set.add(n);
  }
  return set;
}

// ------------------------------------------------------------------ 보통: 찾기/노리기

/** 가로·세로로 이어진 명중 칸(2칸 이상) 줄의 양 끝 다음 칸들. 가장 긴 줄부터. */
function lineEnds(k: Knowledge, hits: number[], allowed: (c: number) => boolean): number[] {
  const n = k.size;
  const hitSet = new Set(hits);
  const runs: { len: number; ends: number[] }[] = [];
  for (const h of hits) {
    const x = h % n;
    const y = Math.floor(h / n);
    // 가로 줄의 시작 칸이면
    if (!(x > 0 && hitSet.has(h - 1)) && x < n - 1 && hitSet.has(h + 1)) {
      let end = h;
      while (end % n < n - 1 && hitSet.has(end + 1)) end += 1;
      const ends: number[] = [];
      if (x > 0) ends.push(h - 1);
      if (end % n < n - 1) ends.push(end + 1);
      runs.push({ len: end - h + 1, ends });
    }
    // 세로 줄의 시작 칸이면
    if (!(y > 0 && hitSet.has(h - n)) && y < n - 1 && hitSet.has(h + n)) {
      let end = h;
      while (Math.floor(end / n) < n - 1 && hitSet.has(end + n)) end += n;
      const ends: number[] = [];
      if (y > 0) ends.push(h - n);
      if (Math.floor(end / n) < n - 1) ends.push(end + n);
      runs.push({ len: (end - h) / n + 1, ends });
    }
  }
  runs.sort((a, b) => b.len - a.len);
  for (const run of runs) {
    const open = run.ends.filter(allowed);
    if (open.length > 0) {
      // 같은 길이의 다른 줄 끝도 함께 후보로
      const same = runs.filter((r) => r.len === run.len).flatMap((r) => r.ends.filter(allowed));
      return [...new Set(same)];
    }
  }
  return [];
}

/** cell을 지나는 가로 또는 세로 빈칸 줄에 길이 len인 배가 들어갈 수 있는지 */
function fits(cell: number, len: number, size: number, open: (c: number) => boolean): boolean {
  const x = cell % size;
  const y = Math.floor(cell / size);
  let run = 1;
  for (let i = x - 1; i >= 0 && open(y * size + i); i--) run++;
  for (let i = x + 1; i < size && open(y * size + i); i++) run++;
  if (run >= len) return true;
  run = 1;
  for (let j = y - 1; j >= 0 && open(j * size + x); j--) run++;
  for (let j = y + 1; j < size && open(j * size + x); j++) run++;
  return run >= len;
}

function normalShot(k: Knowledge, rng: Rng): number | undefined {
  const size = k.size;
  const empty = nearSunk(k);
  const allowed = (c: number) => k.marks[c] === UNKNOWN && !empty.has(c);
  const hits = unsunkHits(k);
  if (hits.length > 0) {
    const ends = lineEnds(k, hits, allowed);
    if (ends.length > 0) return pick(ends, rng);
    const around = [...new Set(hits.flatMap((h) => neighbors4(h, size)))].filter(allowed);
    if (around.length > 0) return pick(around, rng);
  }
  const minLen = k.remaining.length > 0 ? Math.min(...k.remaining) : 1;
  const candidates: number[] = [];
  for (let c = 0; c < size * size; c++) if (allowed(c) && fits(c, minLen, size, allowed)) candidates.push(c);
  const parity = candidates.filter((c) => ((c % size) + Math.floor(c / size)) % 2 === 0);
  if (parity.length > 0) return pick(parity, rng);
  if (candidates.length > 0) return pick(candidates, rng);
  const anyAllowed = unknownCells(k).filter(allowed);
  return pick(anyAllowed.length > 0 ? anyAllowed : unknownCells(k), rng);
}

// ------------------------------------------------------------------ 어려움: 확률 지도

export interface DensityMap {
  /** 모든 자리를 셌을 때 칸마다 배가 지나가는 자리 수 */
  hunt: number[];
  /** 가라앉지 않은 명중 칸을 지나는 자리만 (지나는 명중 칸이 많을수록 크게) */
  target: number[];
  /** 가라앉지 않은 명중 칸이 있는지 */
  targeting: boolean;
}

const HIT_WEIGHT = 24;

/** 남은 배들이 놓일 수 있는 모든 자리를 세어 확률 지도를 만든다. */
export function densityMap(k: Knowledge): DensityMap {
  const size = k.size;
  const total = size * size;
  const sunk = sunkCellSet(k);
  const near = nearSunk(k);
  const hits = new Set(unsunkHits(k));
  const blocked = (c: number) => k.marks[c] === MISS || sunk.has(c) || near.has(c);
  const hunt = new Array<number>(total).fill(0);
  const target = new Array<number>(total).fill(0);
  const cells: number[] = [];
  for (const len of k.remaining) {
    for (let dir = 0; dir < 2; dir++) {
      const maxX = dir === 0 ? size - len : size - 1;
      const maxY = dir === 1 ? size - len : size - 1;
      for (let y = 0; y <= maxY; y++) {
        for (let x = 0; x <= maxX; x++) {
          cells.length = 0;
          let ok = true;
          for (let i = 0; i < len; i++) {
            const c = dir === 0 ? y * size + x + i : (y + i) * size + x;
            if (blocked(c)) {
              ok = false;
              break;
            }
            cells.push(c);
          }
          if (!ok) continue;
          // 붙이지 않기 규칙: 이 자리 둘레에 다른 배의 명중 칸이 있으면 불가능한 자리
          if (k.noTouch) {
            const inside = new Set(cells);
            if (cells.some((c) => neighbors8(c, size).some((nb) => !inside.has(nb) && hits.has(nb)))) continue;
          }
          let covered = 0;
          for (const c of cells) if (hits.has(c)) covered++;
          const weight = covered > 0 ? Math.pow(HIT_WEIGHT, covered) : 0;
          for (const c of cells) {
            if (k.marks[c] !== UNKNOWN) continue;
            hunt[c] += 1;
            target[c] += weight;
          }
        }
      }
    }
  }
  return { hunt, target, targeting: hits.size > 0 };
}

function hardShot(k: Knowledge, rng: Rng): number | undefined {
  const map = densityMap(k);
  let best: number[] = [];
  let bestT = 0;
  let bestH = 0;
  for (let c = 0; c < map.hunt.length; c++) {
    if (k.marks[c] !== UNKNOWN) continue;
    const t = map.targeting ? map.target[c] : 0;
    const h = map.hunt[c];
    if (t === 0 && h === 0) continue;
    if (best.length === 0 || t > bestT || (t === bestT && h > bestH)) {
      best = [c];
      bestT = t;
      bestH = h;
    } else if (t === bestT && h === bestH) best.push(c);
  }
  if (best.length > 0) return pick(best, rng);
  // 맞는 자리가 하나도 없으면(있을 수 없는 일) 배가 없다고 확실한 칸만 빼고 아무 데나
  const empty = knownEmpty(k);
  const rest = unknownCells(k).filter((c) => !empty.has(c));
  return pick(rest.length > 0 ? rest : unknownCells(k), rng);
}
