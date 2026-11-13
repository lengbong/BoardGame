import { withJosa } from '../../lib/korean';
import { DEATH_X, GARBAGE, H, W } from './types';
import type { Blob, Fall, GameEvent, Input, MalangOptions, MalangSetup, MalangState, Piece, PlayerState, Rot, StartSpeed } from './types';

/**
 * 말랑 팡팡 규칙 엔진 (실시간).
 * 화면은 매 프레임 step(state, 흐른 시간)을 부르고, 키를 누르면 applyInput을 부른다.
 * 상태는 모두 JSON으로 저장할 수 있는 값이다 (이어하기).
 */

export const DEFAULT_OPTIONS: MalangOptions = {
  mode: 'versus',
  colors: 4,
  startSpeed: 'normal',
  ghost: true,
  winsNeeded: 1,
};

export const SIDE_NAMES = ['딸기', '소다'] as const;

/** 시간 (ms) */
export const COUNTDOWN = 3000;
export const SPAWN_DELAY = 140;
export const LOCK_DELAY = 500;
export const MAX_LOCK_RESETS = 12;
export const POP_TIME = 520;
/** ↓를 누르고 있을 때 떨어지는 빠르기 (칸/초) */
export const SOFT_SPEED = 22;
/** 한 번에 떨어지는 방해 젤리 최대 수 (5줄) */
export const MAX_GARBAGE_DROP = 30;
/** 방해 젤리 1개를 보내는 데 드는 점수 */
export const GARBAGE_RATE = 60;
/** 이 시간이 지나면 방해 젤리가 점점 쉽게 만들어진다 (끝나지 않는 대결을 막기) */
export const MARGIN_TIME = 96_000;
/** 판을 모두 비웠을 때 보너스 */
export const ALL_CLEAR_SCORE = 1200;
export const ALL_CLEAR_GARBAGE = 18;
/** 혼자 하기: 이만큼 터뜨릴 때마다 레벨이 오른다 */
export const POPS_PER_LEVEL = 24;

export const BASE_SPEED: Record<StartSpeed, number> = { slow: 0.85, normal: 1.4, fast: 2.3 };

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export const idx = (x: number, y: number) => y * W + x;

// ---------------------------------------------------------------- 난수 (상태에 저장되는 mulberry32)
export function nextRandom(s: { rng: number }): number {
  const a = (s.rng + 0x6d2b79f5) >>> 0;
  s.rng = a;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function randomInt(s: { rng: number }, n: number): number {
  return Math.min(n - 1, Math.floor(nextRandom(s) * n));
}

/** 조각 순서를 count개 이상 만들어 둔다 */
export function ensureQueue(state: MalangState, count: number): void {
  while (state.queue.length < count) state.queue.push([randomInt(state, state.options.colors), randomInt(state, state.options.colors)]);
}

/** player의 다음 조각들 (0: 다음, 1: 그다음) */
export function upcoming(state: MalangState, player: number, n = 2): [number, number][] {
  const p = state.players[player];
  ensureQueue(state, p.queueIndex + n);
  return state.queue.slice(p.queueIndex, p.queueIndex + n);
}

// ---------------------------------------------------------------- 판 다루기
export function pieceCells(piece: Pick<Piece, 'x' | 'y' | 'r'>): [[number, number], [number, number]] {
  return [
    [piece.x, piece.y],
    [piece.x + DX[piece.r], piece.y + DY[piece.r]],
  ];
}

/** 칸이 비어 있는지 (판 위쪽 바깥은 비어 있다고 본다) */
export function isFree(grid: readonly (Blob | null)[], x: number, y: number): boolean {
  if (x < 0 || x >= W || y >= H) return false;
  return y < 0 || grid[idx(x, y)] === null;
}

function fits(grid: readonly (Blob | null)[], piece: Pick<Piece, 'x' | 'y' | 'r'>): boolean {
  return pieceCells(piece).every(([x, y]) => isFree(grid, x, y));
}

/** 떨어지는 시간: 멀리 떨어질수록 조금 더 오래 (중력처럼) */
export function fallTime(distance: number): number {
  return distance <= 0 ? 0 : Math.round(70 + 45 * Math.sqrt(distance));
}

/** 빈칸을 메우며 젤리를 아래로 내린다. 움직인 젤리의 연출 정보를 돌려준다 */
export function applyGravity(grid: (Blob | null)[]): Fall[] {
  const falls: Fall[] = [];
  for (let x = 0; x < W; x++) {
    let write = H - 1;
    for (let y = H - 1; y >= 0; y--) {
      const b = grid[idx(x, y)];
      if (!b) continue;
      if (write !== y) {
        grid[idx(x, write)] = b;
        grid[idx(x, y)] = null;
        falls.push({ id: b.id, x, from: y, to: write });
      }
      write -= 1;
    }
  }
  return falls;
}

/** 같은 색 젤리가 4개 이상 이어진 덩어리들 (칸 번호 목록) */
export function findGroups(grid: readonly (Blob | null)[]): number[][] {
  const seen = new Uint8Array(W * H);
  const groups: number[][] = [];
  for (let i = 0; i < W * H; i++) {
    const b = grid[i];
    if (!b || b.c === GARBAGE || seen[i]) continue;
    const group: number[] = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length > 0) {
      const k = stack.pop()!;
      group.push(k);
      const x = k % W;
      const y = (k - x) / W;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const n = idx(nx, ny);
        if (seen[n] || grid[n]?.c !== b.c) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if (group.length >= 4) groups.push(group);
  }
  return groups;
}

/** 연쇄 점수 배율 */
export function chainPower(chain: number): number {
  if (chain <= 1) return 0;
  if (chain === 2) return 8;
  if (chain === 3) return 16;
  return 32 + 16 * (chain - 4);
}

const COLOR_BONUS = [0, 0, 3, 6, 12, 24];

export function groupBonus(size: number): number {
  if (size <= 4) return 0;
  if (size >= 11) return 10;
  return size - 3;
}

/** 한 번 터질 때 점수: 10 × 터진 수 × (연쇄 + 여러 색 + 큰 덩어리 보너스) */
export function popScore(chain: number, groups: { size: number; color: number }[]): number {
  const count = groups.reduce((s, g) => s + g.size, 0);
  const colors = new Set(groups.map((g) => g.color)).size;
  const bonus = chainPower(chain) + COLOR_BONUS[colors] + groups.reduce((s, g) => s + groupBonus(g.size), 0);
  return 10 * count * Math.min(999, Math.max(1, bonus));
}

/** 조각을 바로 내렸을 때 두 젤리가 놓일 자리 (미리 보기용) */
export function ghostCells(grid: readonly (Blob | null)[], piece: Piece): { x: number; y: number; c: number }[] {
  const p = { ...piece };
  while (fits(grid, { ...p, y: p.y + 1 })) p.y += 1;
  const cells = pieceCells(p).map(([x, y], i) => ({ x, y, c: piece.colors[i] }));
  // 따로 떨어진다: 아래쪽 젤리부터 자기 줄 맨 위로
  cells.sort((a, b) => b.y - a.y);
  const tops = new Map<number, number>();
  const out: { x: number; y: number; c: number }[] = [];
  for (const cell of cells) {
    let y = tops.get(cell.x) ?? cell.y;
    if (!tops.has(cell.x)) {
      while (isFree(grid, cell.x, y + 1)) y += 1;
    }
    if (y >= 0) out.push({ x: cell.x, y, c: cell.c });
    tops.set(cell.x, y - 1);
  }
  return out;
}

// ---------------------------------------------------------------- 상태 만들기
function newPlayer(kind: PlayerState['kind'], name: string): PlayerState {
  return {
    kind,
    name,
    grid: Array.from({ length: W * H }, () => null),
    piece: null,
    phase: 'spawn',
    timer: 0,
    falls: [],
    fallDur: 0,
    pop: null,
    chain: 0,
    score: 0,
    carry: 0,
    pending: 0,
    queueIndex: 0,
    soft: false,
    level: 1,
    nextId: 1,
    serial: 0,
    stats: { pieces: 0, popped: 0, maxChain: 0, garbageSent: 0, garbageReceived: 0, allClears: 0 },
  };
}

export function createGame(setup: MalangSetup, seed: number = Math.floor(Math.random() * 2 ** 31)): MalangState {
  const options: MalangOptions = { ...DEFAULT_OPTIONS, ...setup.options };
  const nameOf = (i: 0 | 1) => setup.seats[i].name.trim() || SIDE_NAMES[i];
  const players =
    options.mode === 'solo'
      ? [newPlayer('human', setup.seats[0].name.trim() || '나')]
      : [newPlayer(setup.seats[0].kind, nameOf(0)), newPlayer(setup.seats[1].kind, nameOf(1))];
  const state: MalangState = {
    options,
    players,
    phase: 'countdown',
    phaseT: 0,
    time: 0,
    queue: [],
    rng: seed >>> 0,
    round: 1,
    wins: players.map(() => 0),
    roundWinner: null,
    winner: null,
    events: [],
  };
  ensureQueue(state, 8);
  return state;
}

/** 다음 판: 판을 비우고 새 조각 순서로 다시 3·2·1 */
export function nextRound(state: MalangState): MalangState {
  if (state.phase !== 'roundover') return state;
  const s = structuredClone(state);
  s.players = s.players.map((p) => newPlayer(p.kind, p.name));
  s.queue = [];
  ensureQueue(s, 8);
  s.round += 1;
  s.phase = 'countdown';
  s.phaseT = 0;
  s.time = 0;
  s.roundWinner = null;
  s.events = [];
  return s;
}

// ---------------------------------------------------------------- 빠르기
export function fallSpeed(state: MalangState, p: PlayerState): number {
  const base = BASE_SPEED[state.options.startSpeed];
  if (state.options.mode === 'solo') return base * Math.min(3, 1 + 0.12 * (p.level - 1));
  return base * Math.min(2.5, 1 + 0.08 * Math.floor(state.time / 20_000));
}

/** 방해 젤리 1개에 드는 점수 (시간이 오래 지나면 줄어든다) */
export function garbageRate(time: number): number {
  if (time < MARGIN_TIME) return GARBAGE_RATE;
  const steps = 1 + Math.floor((time - MARGIN_TIME) / 16_000);
  return Math.max(12, Math.round(GARBAGE_RATE * 0.8 ** steps));
}

// ---------------------------------------------------------------- 조작
function emit(state: MalangState, e: GameEvent): void {
  state.events.push(e);
}

function onGroundReset(p: PlayerState): void {
  const piece = p.piece!;
  if (piece.lockT > 0 && piece.resets < MAX_LOCK_RESETS) {
    piece.lockT = 0;
    piece.resets += 1;
  }
}

/** 조각을 돌린다. 막히면 옆이나 위로 한 칸 밀어 보고, 좁은 틈이면 반 바퀴 돈다 */
export function rotatePiece(grid: readonly (Blob | null)[], piece: Piece, dir: 1 | -1): Piece | null {
  const r2 = ((piece.r + dir + 4) % 4) as Rot;
  const tries: Pick<Piece, 'x' | 'y' | 'r'>[] = [
    { x: piece.x, y: piece.y, r: r2 },
    { x: piece.x - DX[r2], y: piece.y - DY[r2], r: r2 },
  ];
  const r3 = ((piece.r + 2) % 4) as Rot;
  tries.push({ x: piece.x, y: piece.y, r: r3 }, { x: piece.x - DX[r3], y: piece.y - DY[r3], r: r3 });
  for (const t of tries) if (fits(grid, t)) return { ...piece, ...t };
  return null;
}

export function applyInput(state: MalangState, player: number, input: Input): boolean {
  if (state.phase !== 'play') return false;
  const p = state.players[player];
  if (!p || p.phase !== 'move' || !p.piece) return false;
  const piece = p.piece;
  if (input === 'left' || input === 'right') {
    const nx = piece.x + (input === 'left' ? -1 : 1);
    if (!fits(p.grid, { ...piece, x: nx })) return false;
    piece.x = nx;
    onGroundReset(p);
    emit(state, { type: 'move', player });
    return true;
  }
  if (input === 'cw' || input === 'ccw') {
    const next = rotatePiece(p.grid, piece, input === 'cw' ? 1 : -1);
    if (!next) return false;
    p.piece = next;
    onGroundReset(p);
    emit(state, { type: 'rotate', player });
    return true;
  }
  // 바로 떨어뜨리기
  let rows = 0;
  while (fits(p.grid, { ...piece, y: piece.y + 1 })) {
    piece.y += 1;
    rows += 1;
  }
  if (state.options.mode === 'solo') p.score += rows * 2;
  emit(state, { type: 'hardDrop', player });
  lockPiece(state, player);
  return true;
}

export function setSoftDrop(state: MalangState, player: number, on: boolean): void {
  const p = state.players[player];
  if (p) p.soft = on;
}

// ---------------------------------------------------------------- 단계 진행
function lockPiece(state: MalangState, player: number): void {
  const p = state.players[player];
  const piece = p.piece!;
  pieceCells(piece).forEach(([x, y], i) => {
    if (y >= 0) p.grid[idx(x, y)] = { id: piece.ids[i], c: piece.colors[i] };
  });
  p.piece = null;
  p.stats.pieces += 1;
  p.falls = applyGravity(p.grid);
  p.fallDur = Math.max(0, ...p.falls.map((f) => fallTime(f.to - f.from)));
  p.phase = 'settle';
  p.timer = 0;
  emit(state, { type: 'land', player });
}

function spawn(state: MalangState, player: number): void {
  const p = state.players[player];
  if (p.grid[idx(DEATH_X, 0)] !== null) {
    p.phase = 'dead';
    p.piece = null;
    emit(state, { type: 'dead', player });
    return;
  }
  ensureQueue(state, p.queueIndex + 3);
  const [a, b] = state.queue[p.queueIndex];
  p.queueIndex += 1;
  p.serial += 1;
  p.piece = { x: DEATH_X, y: 0, r: 0, colors: [a, b], ids: [p.nextId, p.nextId + 1], fall: 0, lockT: 0, resets: 0, serial: p.serial };
  p.nextId += 2;
  p.phase = 'move';
  p.timer = 0;
}

function opponent(state: MalangState, player: number): PlayerState | null {
  return state.options.mode === 'versus' ? state.players[1 - player] : null;
}

/** 방해 젤리를 보낸다: 먼저 나에게 올 것을 지우고(상쇄), 남으면 상대에게 */
function sendGarbage(state: MalangState, player: number, amount: number): void {
  const p = state.players[player];
  const opp = opponent(state, player);
  if (!opp || amount <= 0) return;
  const cancel = Math.min(p.pending, amount);
  if (cancel > 0) {
    p.pending -= cancel;
    emit(state, { type: 'offset', player, amount: cancel });
  }
  const rest = amount - cancel;
  if (rest > 0) {
    opp.pending += rest;
    p.stats.garbageSent += rest;
    emit(state, { type: 'send', player, to: 1 - player, amount: rest });
  }
}

/** 터질 덩어리를 찾아 터뜨리기 시작한다. 없으면 false */
function startPop(state: MalangState, player: number): boolean {
  const p = state.players[player];
  const groups = findGroups(p.grid);
  if (groups.length === 0) return false;
  p.chain += 1;
  const popped = new Set<number>(groups.flat());
  // 터지는 젤리 옆의 방해 젤리도 함께 없어진다
  for (const k of [...popped]) {
    const x = k % W;
    const y = (k - x) / W;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const n = idx(nx, ny);
      if (p.grid[n]?.c === GARBAGE) popped.add(n);
    }
  }
  const score = popScore(
    p.chain,
    groups.map((g) => ({ size: g.length, color: p.grid[g[0]]!.c })),
  );
  const first = groups[0];
  const cx = first.reduce((s, k) => s + (k % W), 0) / first.length;
  const cy = first.reduce((s, k) => s + Math.floor(k / W), 0) / first.length;
  const count = groups.reduce((s, g) => s + g.length, 0);
  p.pop = { ids: [...popped].map((k) => p.grid[k]!.id), chain: p.chain, score, x: cx, y: cy };
  p.score += score;
  p.stats.popped += count;
  p.stats.maxChain = Math.max(p.stats.maxChain, p.chain);
  emit(state, { type: 'pop', player, chain: p.chain, count, score });
  if (state.options.mode === 'versus') {
    const rate = garbageRate(state.time);
    const total = score + p.carry;
    const amount = Math.floor(total / rate);
    p.carry = total - amount * rate;
    sendGarbage(state, player, amount);
  }
  p.phase = 'pop';
  p.timer = 0;
  return true;
}

/** 방해 젤리를 판 위에서 떨어뜨린다 */
function dropGarbage(state: MalangState, player: number): void {
  const p = state.players[player];
  const n = Math.min(p.pending, MAX_GARBAGE_DROP);
  p.pending -= n;
  p.stats.garbageReceived += n;
  const per = Array.from({ length: W }, () => Math.floor(n / W));
  const cols = Array.from({ length: W }, (_, i) => i);
  for (let k = 0; k < n % W; k++) {
    const j = k + randomInt(state, W - k);
    [cols[k], cols[j]] = [cols[j], cols[k]];
    per[cols[k]] += 1;
  }
  const falls: Fall[] = [];
  for (let x = 0; x < W; x++) {
    let top = H - 1;
    while (top >= 0 && p.grid[idx(x, top)] !== null) top -= 1;
    for (let j = 0; j < per[x] && top >= 0; j++, top--) {
      const b: Blob = { id: p.nextId++, c: GARBAGE };
      p.grid[idx(x, top)] = b;
      falls.push({ id: b.id, x, from: -1 - j, to: top });
    }
  }
  p.falls = falls;
  p.fallDur = Math.max(0, ...falls.map((f) => fallTime(f.to - f.from)));
  p.phase = 'garbage';
  p.timer = 0;
  emit(state, { type: 'garbage', player, amount: n });
}

/** 연쇄가 끝났을 때: 보너스, 레벨, 방해 젤리, 다음 조각 */
function endResolve(state: MalangState, player: number): void {
  const p = state.players[player];
  if (p.chain > 0 && p.grid.every((b) => b === null)) {
    p.stats.allClears += 1;
    emit(state, { type: 'allClear', player });
    if (state.options.mode === 'solo') p.score += ALL_CLEAR_SCORE;
    else sendGarbage(state, player, ALL_CLEAR_GARBAGE);
  }
  p.chain = 0;
  if (state.options.mode === 'solo') {
    const level = 1 + Math.floor(p.stats.popped / POPS_PER_LEVEL);
    if (level > p.level) {
      p.level = level;
      emit(state, { type: 'levelUp', player, level });
    }
  }
  const opp = opponent(state, player);
  // 상대가 연쇄하는 동안에는 방해 젤리를 기다려 준다
  if (p.pending > 0 && opp && opp.chain === 0) {
    dropGarbage(state, player);
    return;
  }
  p.phase = 'spawn';
  p.timer = 0;
  spawnCheck(state, player);
}

/** spawn 단계에 들어가자마자 막혔는지 본다 */
function spawnCheck(state: MalangState, player: number): void {
  const p = state.players[player];
  if (p.grid[idx(DEATH_X, 0)] !== null) {
    p.phase = 'dead';
    emit(state, { type: 'dead', player });
  }
}

function stepPlayer(state: MalangState, player: number, dt: number): void {
  const p = state.players[player];
  p.timer += dt;
  switch (p.phase) {
    case 'spawn':
      if (p.timer >= SPAWN_DELAY) spawn(state, player);
      break;
    case 'move': {
      const piece = p.piece!;
      const speed = p.soft ? SOFT_SPEED : fallSpeed(state, p);
      piece.fall += (speed * dt) / 1000;
      while (piece.fall >= 1) {
        if (fits(p.grid, { ...piece, y: piece.y + 1 })) {
          piece.y += 1;
          piece.fall -= 1;
          if (p.soft && state.options.mode === 'solo') p.score += 1;
        } else {
          piece.fall = 0;
          break;
        }
      }
      const grounded = !fits(p.grid, { ...piece, y: piece.y + 1 });
      if (grounded) {
        piece.fall = 0;
        piece.lockT += dt;
        if (piece.lockT >= (p.soft ? LOCK_DELAY / 5 : LOCK_DELAY)) lockPiece(state, player);
      } else if (piece.lockT > 0) {
        piece.lockT = 0;
      }
      break;
    }
    case 'settle':
    case 'garbage':
      if (p.timer >= p.fallDur) {
        p.falls = [];
        const wasGarbage = p.phase === 'garbage';
        if (wasGarbage) {
          p.phase = 'spawn';
          p.timer = 0;
          spawnCheck(state, player);
        } else if (!startPop(state, player)) {
          endResolve(state, player);
        }
      }
      break;
    case 'pop':
      if (p.timer >= POP_TIME) {
        const ids = new Set(p.pop?.ids ?? []);
        for (let i = 0; i < W * H; i++) if (p.grid[i] && ids.has(p.grid[i]!.id)) p.grid[i] = null;
        p.pop = null;
        p.falls = applyGravity(p.grid);
        p.fallDur = Math.max(0, ...p.falls.map((f) => fallTime(f.to - f.from)));
        p.phase = 'settle';
        p.timer = 0;
      }
      break;
    case 'dead':
      break;
  }
}

/** 이긴 사람 이름이 들어간 판 결과 문구 */
export function roundText(state: MalangState): string {
  if (state.options.mode === 'solo') return '게임 끝!';
  if (state.roundWinner === null) return '비겼어요!';
  return `${withJosa(state.players[state.roundWinner].name, '이/가')} 이겼어요!`;
}

/**
 * 시간을 dt(ms)만큼 진행한다. 상태를 그대로 고친다 (매 프레임 복사하지 않으려고).
 * 한 번에 너무 많이 진행하지 않게 50ms씩 나눠서 처리한다.
 */
export function step(state: MalangState, dt: number): void {
  let left = Math.max(0, dt);
  while (left > 0) {
    const d = Math.min(50, left);
    left -= d;
    if (state.phase === 'countdown') {
      state.phaseT += d;
      if (state.phaseT >= COUNTDOWN) {
        state.phase = 'play';
        state.phaseT = 0;
        emit(state, { type: 'start' });
      }
      continue;
    }
    if (state.phase !== 'play') {
      state.phaseT += d;
      continue;
    }
    state.time += d;
    state.players.forEach((_, i) => stepPlayer(state, i, d));
    const dead = state.players.map((p, i) => (p.phase === 'dead' ? i : -1)).filter((i) => i >= 0);
    if (dead.length === 0) continue;
    if (state.options.mode === 'solo') {
      state.phase = 'over';
      state.phaseT = 0;
      state.roundWinner = null;
      emit(state, { type: 'round', winner: null });
      return;
    }
    const winner = dead.length === 2 ? null : 1 - dead[0];
    state.roundWinner = winner;
    if (winner !== null) state.wins[winner] += 1;
    state.phaseT = 0;
    const done = winner !== null && state.wins[winner] >= state.options.winsNeeded;
    state.phase = done ? 'over' : 'roundover';
    if (done) state.winner = winner;
    emit(state, { type: 'round', winner });
    return;
  }
}
