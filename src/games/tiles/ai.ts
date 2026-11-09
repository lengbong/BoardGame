import { checkCommit, needsMeld } from './rules';
import { analyzeSet } from './sets';
import { MELD_POINTS, TILE_COLORS } from './tiles';
import type { Rng, TableSet, Tile, TilesAction, TilesState } from './types';

export type AiLevel = 'ai-easy' | 'ai-normal';

/** 내 타일로 만들 수 있는 줄 후보 (색-숫자 열쇠 + 필요한 조커 수) */
interface Candidate {
  keys: string[];
  jokers: number;
  size: number;
  points: number;
}

const keyOf = (t: Tile) => `${t.color}-${t.value}`;

function fakeTiles(keys: string[], jokers: number): Tile[] {
  const tiles: Tile[] = keys.map((k, i) => {
    const [color, value] = k.split('-');
    return { id: -1000 - i, color: color as Tile['color'], value: Number(value), joker: false };
  });
  for (let j = 0; j < jokers; j++) tiles.push({ id: -2000 - j, color: null, value: 0, joker: true });
  return tiles;
}

function makeCandidates(counts: Map<string, number>, jokers: number): Candidate[] {
  const list: Candidate[] = [];
  const has = (c: string, v: number) => (counts.get(`${c}-${v}`) ?? 0) > 0;
  const add = (keys: string[], j: number) => {
    const a = analyzeSet(fakeTiles(keys, j));
    if (a.valid) list.push({ keys, jokers: j, size: keys.length + j, points: a.points });
  };
  // 같은 숫자 줄
  for (let v = 1; v <= 13; v++) {
    const colors = TILE_COLORS.filter((c) => has(c, v));
    for (let mask = 1; mask < 1 << colors.length; mask++) {
      const sub = colors.filter((_, i) => mask & (1 << i));
      for (let j = 0; j <= jokers; j++) {
        const size = sub.length + j;
        if (size >= 3 && size <= 4) add(sub.map((c) => `${c}-${v}`), j);
      }
    }
  }
  // 연속 줄
  for (const c of TILE_COLORS) {
    for (let s = 1; s <= 11; s++) {
      let missing = 0;
      const keys: string[] = [];
      for (let e = s; e <= 13; e++) {
        if (has(c, e)) keys.push(`${c}-${e}`);
        else missing += 1;
        if (missing > jokers) break;
        if (e - s + 1 >= 3 && keys.length > 0) add([...keys], missing);
      }
    }
  }
  return list.sort((a, b) => b.size - a.size || b.points - a.points);
}

/**
 * 내 타일만으로 겹치지 않게 만들 수 있는 줄 조합 중 가장 좋은 것을 찾는다.
 * needPoints가 있으면 그 점수를 넘기는 조합을 먼저 찾는다.
 */
export function rackCombo(rack: Tile[], needPoints: number, nodeLimit: number): { sets: Tile[][]; points: number } {
  const counts = new Map<string, number>();
  const jokerTiles = rack.filter((t) => t.joker);
  for (const t of rack) if (!t.joker) counts.set(keyOf(t), (counts.get(keyOf(t)) ?? 0) + 1);
  const cands = makeCandidates(counts, jokerTiles.length);

  const score = (tiles: number, points: number) => (points >= needPoints ? 1_000_000 : 0) + tiles * 1000 + points;
  let best: Candidate[] = [];
  let bestScore = score(0, 0);
  const chosen: Candidate[] = [];
  let nodes = 0;
  const rec = (start: number, tiles: number, points: number, jokersLeft: number) => {
    nodes += 1;
    const sc = score(tiles, points);
    if (sc > bestScore) {
      bestScore = sc;
      best = [...chosen];
    }
    for (let k = start; k < cands.length && nodes < nodeLimit; k++) {
      const c = cands[k];
      if (c.jokers > jokersLeft || !c.keys.every((key) => counts.get(key)! > 0)) continue;
      for (const key of c.keys) counts.set(key, counts.get(key)! - 1);
      chosen.push(c);
      rec(k, tiles + c.size, points + c.points, jokersLeft - c.jokers);
      chosen.pop();
      for (const key of c.keys) counts.set(key, counts.get(key)! + 1);
    }
  };
  rec(0, 0, 0, jokerTiles.length);

  // 실제 타일로 바꾸기
  const byKey = new Map<string, Tile[]>();
  for (const t of rack) if (!t.joker) byKey.set(keyOf(t), [...(byKey.get(keyOf(t)) ?? []), t]);
  const jokers = [...jokerTiles];
  const sets = best.map((c) => [...c.keys.map((k) => byKey.get(k)!.pop()!), ...jokers.splice(0, c.jokers)]);
  return { sets, points: best.reduce((sum, c) => sum + c.points, 0) };
}

function removeFrom(hand: Tile[], tiles: Tile[]): void {
  for (const t of tiles) {
    const i = hand.findIndex((h) => h.id === t.id);
    if (i >= 0) hand.splice(i, 1);
  }
}

/** 판의 줄 끝이나 옆에 내 타일을 붙인다. */
function extend(table: TableSet[], hand: Tile[], jokersOk: boolean): boolean {
  let changed = false;
  let progress = true;
  while (progress) {
    progress = false;
    for (const t of [...hand]) {
      if (t.joker && !jokersOk) continue;
      const set = table.find((s) => analyzeSet([...s.tiles, t]).valid);
      if (set) {
        set.tiles = analyzeSet([...set.tiles, t]).arranged;
        removeFrom(hand, [t]);
        progress = changed = true;
      }
    }
  }
  return changed;
}

/** 긴 연속 줄 가운데에 같은 숫자를 넣어 두 줄로 나눈다. (예: 3~9 + 6 → 3~6, 6~9) */
function splitInsert(table: TableSet[], hand: Tile[], newId: () => number): boolean {
  for (const t of hand) {
    if (t.joker) continue;
    for (const set of table) {
      const a = analyzeSet(set.tiles);
      if (a.kind !== 'run' || a.arranged.find((x) => !x.joker)!.color !== t.color) continue;
      const idx = a.values.indexOf(t.value);
      if (idx < 0) continue;
      const left = a.arranged.slice(0, idx + 1);
      const right = [t, ...a.arranged.slice(idx + 1)];
      if (analyzeSet(left).valid && analyzeSet(right).valid) {
        set.tiles = analyzeSet(left).arranged;
        table.push({ id: newId(), tiles: analyzeSet(right).arranged });
        removeFrom(hand, [t]);
        return true;
      }
    }
  }
  return false;
}

/** 판에서 빼도 줄이 그대로 올바른 타일 (긴 연속 줄의 양 끝, 4개짜리 같은 숫자 줄) */
function spares(table: TableSet[]): { set: TableSet; tile: Tile }[] {
  const list: { set: TableSet; tile: Tile }[] = [];
  for (const set of table) {
    const a = analyzeSet(set.tiles);
    if (!a.valid || set.tiles.length < 4) continue;
    const options = a.kind === 'run' ? [a.arranged[0], a.arranged[a.arranged.length - 1]] : a.arranged;
    for (const tile of options) {
      if (tile.joker) continue;
      if (analyzeSet(set.tiles.filter((x) => x.id !== tile.id)).valid) list.push({ set, tile });
    }
  }
  return list;
}

/** 판의 남는 타일을 빌려 와서 내 타일과 새 줄을 만든다. */
function borrow(table: TableSet[], hand: Tile[], newId: () => number): boolean {
  const sp = spares(table);
  const plain = hand.filter((t) => !t.joker);
  const tryMake = (mine: Tile[], borrowed: { set: TableSet; tile: Tile }[]) => {
    const tiles = [...mine, ...borrowed.map((b) => b.tile)];
    if (!analyzeSet(tiles).valid) return false;
    // 같은 줄에서 두 개를 빌리면 남은 줄도 올바른지 다시 본다.
    const after = new Map<TableSet, Tile[]>();
    for (const b of borrowed) after.set(b.set, (after.get(b.set) ?? b.set.tiles).filter((x) => x.id !== b.tile.id));
    for (const rest of after.values()) if (!analyzeSet(rest).valid) return false;
    for (const [set, rest] of after) set.tiles = analyzeSet(rest).arranged;
    table.push({ id: newId(), tiles: analyzeSet(tiles).arranged });
    removeFrom(hand, mine);
    return true;
  };
  for (let i = 0; i < plain.length; i++) {
    for (let j = i + 1; j < plain.length; j++) {
      for (const s of sp) if (tryMake([plain[i], plain[j]], [s])) return true;
    }
  }
  for (const h of plain) {
    for (let a = 0; a < sp.length; a++) {
      for (let b = a + 1; b < sp.length; b++) if (sp[a].tile.id !== sp[b].tile.id && tryMake([h], [sp[a], sp[b]])) return true;
    }
  }
  return false;
}

/** 컴퓨터가 이번 차례에 할 행동 */
export function planMove(state: TilesState, level: AiLevel, rng: Rng = Math.random): TilesAction {
  if (state.phase === 'roundover') return { type: 'nextRound' };
  const me = state.players[state.current];
  const normal = level === 'ai-normal';
  const meld = needsMeld(state);
  let tempId = -1;
  const newId = () => tempId--;

  const table: TableSet[] = state.table.map((s) => ({ id: s.id, tiles: [...s.tiles] }));
  const hand = [...me.rack];

  const combo = rackCombo(hand, meld ? MELD_POINTS : 0, normal ? 20_000 : 300);
  if (meld && combo.points < MELD_POINTS) return { type: 'draw' };
  // 쉬움: 가끔은 만들 수 있는 줄을 다 내지 않는다.
  const sets = !normal && !meld && combo.sets.length > 1 && rng() < 0.4 ? combo.sets.slice(0, 1) : combo.sets;
  for (const set of sets) {
    table.push({ id: newId(), tiles: analyzeSet(set).arranged });
    removeFrom(hand, set);
  }

  if (!meld) {
    const jokersOk = () => hand.length <= 3 || hand.every((t) => t.joker);
    extend(table, hand, normal && jokersOk());
    if (normal && state.options.rearrange) {
      for (let guard = 0; guard < 40; guard++) {
        if (!(splitInsert(table, hand, newId) || borrow(table, hand, newId) || extend(table, hand, jokersOk()))) break;
      }
    }
  }

  if (hand.length === me.rack.length) return { type: 'draw' };
  const check = checkCommit(state, table);
  if (check.ok) return { type: 'commit', table };

  // 혹시 계산이 어긋났으면 내 타일로 만든 새 줄만 낸다.
  const simple = [...state.table, ...sets.map((tiles, i) => ({ id: -100 - i, tiles }))];
  if (sets.length > 0 && checkCommit(state, simple).ok) return { type: 'commit', table: simple };
  return { type: 'draw' };
}
