import { withJosa } from '../../lib/korean';
import { shuffle } from '../../lib/random';
import { SEAT_COLORS } from '../common/players';
import { createSet, handPips, hasNumber, isDouble, tileLabel, tilePips } from './dominoes';
import type {
  DominoAction,
  DominoOptions,
  DominoSetup,
  DominoState,
  GameEvent,
  Player,
  RoundEndReason,
  Rng,
  SeatIndex,
  Side,
  Tile,
} from './types';

export const TARGET_SCORES = [50, 100, 150];

export const DEFAULT_OPTIONS: DominoOptions = {
  blockRule: false,
  winnerStarts: true,
  pipColors: false,
  handView: 'cover',
  endMode: 'single',
  targetScore: 100,
};

const MAX_LOG = 60;

type EventInput = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'id'> : never) : never;

export interface Move {
  tileId: number;
  side: Side;
}

/** 처음에 나눠 주는 개수: 2명이면 7개, 3~4명이면 5개 */
export function handSizeFor(players: number): number {
  return players === 2 ? 7 : 5;
}

export function playerName(player: Player): string {
  return player.name || SEAT_COLORS[player.seat].name;
}

function nameOf(s: DominoState, index: number): string {
  return playerName(s.players[index]);
}

function addLog(s: DominoState, seat: SeatIndex | null, text: string): void {
  s.log = [...s.log, { id: s.nextLogId, seat, text }].slice(-MAX_LOG);
  s.nextLogId += 1;
}

function emit(s: DominoState, event: EventInput): void {
  s.events.push({ ...event, id: s.nextEventId } as GameEvent);
  s.nextEventId += 1;
}

/** 상태를 통째로 복사해서 마음 놓고 고칠 수 있게 한다. (패 28개라 가볍다) */
function draft(state: DominoState): DominoState {
  const s = structuredClone(state);
  s.events = [];
  return s;
}

export function nextIndex(state: DominoState, from: number): number {
  return (from + 1) % state.players.length;
}

/** 줄의 두 열린 끝 숫자. 줄이 비어 있으면 null */
export function lineEnds(state: DominoState): { left: number; right: number } | null {
  if (state.line.length === 0) return null;
  return { left: state.line[0].left, right: state.line[state.line.length - 1].right };
}

/** 이 패를 놓을 수 있는 끝. 줄이 비어 있으면 ['right'] (첫 패는 어느 쪽이든 같다) */
export function sidesFor(state: DominoState, tile: Tile): Side[] {
  const ends = lineEnds(state);
  if (!ends) return ['right'];
  const sides: Side[] = [];
  if (hasNumber(tile, ends.left)) sides.push('left');
  if (hasNumber(tile, ends.right)) sides.push('right');
  return sides;
}

/** 두 끝에 모두 놓을 수 있고, 어느 끝에 놓느냐에 따라 결과가 달라서 골라야 하는지 */
export function needsSideChoice(state: DominoState, tile: Tile): boolean {
  const ends = lineEnds(state);
  return !!ends && ends.left !== ends.right && sidesFor(state, tile).length === 2;
}

/** 첫 패에서 왼쪽·오른쪽으로 뻗은 패 수 */
export function armLengths(state: DominoState): { left: number; right: number } {
  if (state.line.length === 0) return { left: 0, right: 0 };
  return { left: state.origin, right: state.line.length - 1 - state.origin };
}

/** 어느 끝에 놓아도 같을 때 고르는 쪽: 줄이 고르게 자라도록 짧은 쪽 */
export function balancedSide(state: DominoState): Side {
  const arms = armLengths(state);
  return arms.left < arms.right ? 'left' : 'right';
}

/** 패를 그 끝에 놓았을 때의 새 열린 끝 */
export function endsAfter(state: DominoState, tile: Tile, side: Side): { left: number; right: number } {
  const ends = lineEnds(state);
  if (!ends) return { left: tile.a, right: tile.b };
  if (side === 'left') return { left: tile.a === ends.left ? tile.b : tile.a, right: ends.right };
  return { left: ends.left, right: tile.a === ends.right ? tile.b : tile.a };
}

export function legalMoves(state: DominoState, player = state.current): Move[] {
  if (state.phase !== 'play') return [];
  const moves: Move[] = [];
  for (const t of state.players[player].hand) for (const side of sidesFor(state, t)) moves.push({ tileId: t.id, side });
  return moves;
}

export function hasLegalMove(state: DominoState, player = state.current): boolean {
  return state.players[player].hand.some((t) => sidesFor(state, t).length > 0);
}

/** 지금 차례인 사람이 낼 수 있는 패 */
export function playableTiles(state: DominoState, player = state.current): Tile[] {
  if (state.phase !== 'play') return [];
  return state.players[player].hand.filter((t) => sidesFor(state, t).length > 0);
}

/** 낼 패가 없고, 블록 규칙이 꺼져 있고, 뽑는 더미가 남아 있으면 뽑을 수 있다. */
export function canDraw(state: DominoState): boolean {
  return state.phase === 'play' && !state.options.blockRule && state.boneyard.length > 0 && !hasLegalMove(state);
}

/** 낼 패가 없고 뽑을 수도 없으면 (블록 규칙이거나 더미가 비었으면) 통과할 수 있다. */
export function canPass(state: DominoState): boolean {
  return state.phase === 'play' && !hasLegalMove(state) && (state.options.blockRule || state.boneyard.length === 0);
}

/** 아무도 낼 수 없고 뽑을 수도 없으면 막힌 판 */
export function isBlocked(state: DominoState): boolean {
  if (state.line.length === 0) return false;
  if (!state.options.blockRule && state.boneyard.length > 0) return false;
  return state.players.every((_, i) => !hasLegalMove(state, i));
}

function beginTurn(s: DominoState, index: number): void {
  s.current = index;
  s.phase = 'play';
  s.turn += 1;
  s.turnDraws = 0;
}

/** 패를 줄에 놓는다 (규칙 검사는 부른 쪽에서 한다). */
function placeTile(s: DominoState, player: number, tile: Tile, side: Side, auto: boolean): void {
  const p = s.players[player];
  const next = endsAfter(s, tile, side);
  const placed = { tile, order: s.line.length, player };
  if (s.line.length === 0) {
    s.line = [{ ...placed, left: next.left, right: next.right }];
    s.origin = 0;
  } else if (side === 'left') {
    s.line = [{ ...placed, left: next.left, right: s.line[0].left }, ...s.line];
    s.origin += 1;
  } else {
    s.line = [...s.line, { ...placed, left: s.line[s.line.length - 1].right, right: next.right }];
  }
  p.hand = p.hand.filter((t) => t.id !== tile.id);
  emit(s, { type: 'play', player, tile, side, auto });
}

/** 판을 시작할 패: 가장 높은 더블, 아무도 더블이 없으면 점이 가장 많은 패 */
export function findOpening(players: readonly Player[]): { player: number; tile: Tile; double: boolean } {
  for (let d = 6; d >= 0; d--) {
    for (let i = 0; i < players.length; i++) {
      const tile = players[i].hand.find((t) => t.a === d && t.b === d);
      if (tile) return { player: i, tile, double: true };
    }
  }
  let bestPlayer = -1;
  let bestTile: Tile | null = null;
  for (let i = 0; i < players.length; i++) {
    for (const t of players[i].hand) {
      if (!bestTile || tilePips(t) > tilePips(bestTile) || (tilePips(t) === tilePips(bestTile) && t.b > bestTile.b)) {
        bestPlayer = i;
        bestTile = t;
      }
    }
  }
  if (!bestTile) throw new Error('나눠 준 패가 없습니다.');
  return { player: bestPlayer, tile: bestTile, double: false };
}

/** 새 판: 패를 섞어 나눠 주고, 시작하는 사람을 정한다. */
function startRound(s: DominoState, rng: Rng): void {
  s.round += 1;
  const n = s.players.length;
  const size = handSizeFor(n);
  const set = shuffle(createSet(), rng);
  for (const p of s.players) {
    p.hand = [];
    p.lacks = [];
  }
  for (let k = 0; k < size; k++) for (let i = 0; i < n; i++) s.players[i].hand.push(set.pop()!);
  s.boneyard = set;
  s.line = [];
  s.origin = 0;
  s.roundResult = null;
  s.rankings = [];
  s.turnDraws = 0;
  emit(s, { type: 'deal' });
  const prefix = s.options.endMode === 'points' ? `${s.round}번째 판! ` : '';

  // 두 번째 판부터: 지난 판에 이긴 사람이 아무 패나 내며 시작
  if (s.options.winnerStarts && s.round > 1 && s.lastWinner !== null) {
    const w = s.lastWinner;
    s.starter = w;
    beginTurn(s, w);
    addLog(s, s.players[w].seat, `${prefix}지난 판에 이긴 ${withJosa(nameOf(s, w), '이/가')} 아무 패나 내며 시작해요.`);
    return;
  }

  const open = findOpening(s.players);
  s.starter = open.player;
  s.current = open.player;
  placeTile(s, open.player, open.tile, 'right', true);
  const who = withJosa(nameOf(s, open.player), '이/가');
  const label = `${tileLabel(open.tile)} 패를`;
  addLog(
    s,
    s.players[open.player].seat,
    open.double ? `${prefix}가장 높은 더블 ${label} 가진 ${who} 먼저 놓았어요.` : `${prefix}더블이 없어서 점이 가장 많은 ${label} 가진 ${who} 먼저 놓았어요.`,
  );
  afterPlay(s, open.player);
}

export function createGame(setup: DominoSetup, rng: Rng = Math.random): DominoState {
  const players: Player[] = [];
  setup.seats.forEach((seat, i) => {
    if (seat.kind === 'empty') return;
    players.push({
      seat: i as SeatIndex,
      kind: seat.kind,
      name: seat.name.trim() || SEAT_COLORS[i as SeatIndex].name,
      hand: [],
      score: 0,
      lacks: [],
    });
  });
  if (players.length < 2) throw new Error('플레이어가 2명 이상 필요합니다.');
  const s: DominoState = {
    players,
    options: { ...DEFAULT_OPTIONS, ...setup.options },
    round: 0,
    current: 0,
    line: [],
    origin: 0,
    boneyard: [],
    phase: 'play',
    turn: 0,
    turnDraws: 0,
    starter: 0,
    lastWinner: null,
    roundResult: null,
    rankings: [],
    events: [],
    nextEventId: 1,
    log: [],
    nextLogId: 1,
  };
  startRound(s, rng);
  return s;
}

/** 판 끝: 이긴 사람은 다른 사람들 손에 남은 점을 모두 가져간다. */
function finishRound(s: DominoState, reason: RoundEndReason, dominoPlayer: number | null): void {
  const pips = s.players.map((p) => handPips(p.hand));
  let winner: number | null = dominoPlayer;
  let tied: number[] = [];
  if (reason === 'blocked') {
    // 점이 가장 적은 사람 → 그래도 같으면 패가 적은 사람 → 그래도 같으면 무승부
    const min = Math.min(...pips);
    let cands = pips.map((v, i) => (v === min ? i : -1)).filter((i) => i >= 0);
    if (cands.length > 1) {
      const fewest = Math.min(...cands.map((i) => s.players[i].hand.length));
      cands = cands.filter((i) => s.players[i].hand.length === fewest);
    }
    if (cands.length === 1) winner = cands[0];
    else {
      winner = null;
      tied = cands;
    }
    emit(s, { type: 'blocked' });
    addLog(s, null, '아무도 낼 수 없어서 막혔어요!');
  }
  const points = winner === null ? 0 : pips.reduce((sum, v, i) => (i === winner ? sum : sum + v), 0);
  if (winner !== null) s.players[winner].score += points;
  s.roundResult = { reason, winner, tied, points, handPips: pips };
  s.lastWinner = winner;
  emit(s, { type: 'win', player: winner, points, reason });
  if (winner === null) addLog(s, null, '점과 패 수가 똑같아서 비겼어요. 아무도 점수를 얻지 못해요.');
  else if (reason === 'domino') addLog(s, s.players[winner].seat, `${withJosa(nameOf(s, winner), '이/가')} 패를 다 냈어요! (+${points}점)`);
  else addLog(s, s.players[winner].seat, `남은 점이 가장 적은 ${withJosa(nameOf(s, winner), '이/가')} 이겼어요! (+${points}점)`);

  const order = s.players.map((_, i) => i);
  if (s.options.endMode === 'single') {
    s.phase = 'gameover';
    s.rankings = order.sort((a, b) => {
      if (a === winner || b === winner) return a === winner ? -1 : 1;
      return pips[a] - pips[b] || s.players[a].hand.length - s.players[b].hand.length || a - b;
    });
  } else if (winner !== null && s.players[winner].score >= s.options.targetScore) {
    s.phase = 'gameover';
    s.rankings = order.sort((a, b) => s.players[b].score - s.players[a].score || (a === winner ? -1 : b === winner ? 1 : a - b));
  } else {
    s.phase = 'roundover';
    return;
  }
  if (winner === null) addLog(s, null, '🤝 이번 게임은 비겼어요!');
  else addLog(s, s.players[s.rankings[0]].seat, `🏆 ${withJosa(nameOf(s, s.rankings[0]), '이/가')} 우승했어요!`);
}

/** 패를 낸 뒤: 다 냈으면 판 끝, 막혔으면 판 끝, 아니면 다음 사람 */
function afterPlay(s: DominoState, me: number): void {
  if (s.players[me].hand.length === 0) finishRound(s, 'domino', me);
  else if (isBlocked(s)) finishRound(s, 'blocked', null);
  else beginTurn(s, nextIndex(s, me));
}

function play(state: DominoState, action: Extract<DominoAction, { type: 'play' }>): DominoState {
  if (state.phase !== 'play') return state;
  const me = state.current;
  const tile = state.players[me].hand.find((t) => t.id === action.tileId);
  if (!tile) return state;
  const sides = sidesFor(state, tile);
  if (sides.length === 0) return state;
  let side: Side;
  if (state.line.length === 0) side = 'right';
  else if (action.side) {
    if (!sides.includes(action.side)) return state;
    side = action.side;
  } else side = sides.length === 2 ? balancedSide(state) : sides[0];

  const s = draft(state);
  const first = s.line.length === 0;
  placeTile(s, me, tile, side, false);
  const where = first ? '첫 패' : side === 'left' ? '왼쪽 끝' : '오른쪽 끝';
  addLog(s, s.players[me].seat, `${nameOf(s, me)}: ${tileLabel(tile)}${isDouble(tile) ? ' 더블' : ''} (${where})`);
  afterPlay(s, me);
  return s;
}

function draw(state: DominoState): DominoState {
  if (!canDraw(state)) return state;
  const s = draft(state);
  const me = s.current;
  const p = s.players[me];
  const ends = lineEnds(s)!;
  const tile = s.boneyard.pop()!;
  p.hand = [...p.hand, tile];
  // 뽑았다는 것은 지금 두 끝 숫자가 없었다는 뜻. 새로 뽑은 패 때문에 다른 숫자에 대한 정보는 지운다.
  p.lacks = ends.left === ends.right ? [ends.left] : [Math.min(ends.left, ends.right), Math.max(ends.left, ends.right)];
  s.turnDraws += 1;
  emit(s, { type: 'draw', player: me, tileId: tile.id });
  const text = `${withJosa(nameOf(s, me), '이/가')} 낼 패가 없어서 ${s.turnDraws}개 뽑았어요.`;
  const last = s.log[s.log.length - 1];
  if (s.turnDraws > 1 && last) s.log = [...s.log.slice(0, -1), { ...last, text }];
  else addLog(s, p.seat, text);
  if (isBlocked(s)) finishRound(s, 'blocked', null);
  return s;
}

function pass(state: DominoState): DominoState {
  if (!canPass(state)) return state;
  const s = draft(state);
  const me = s.current;
  const p = s.players[me];
  const ends = lineEnds(s);
  if (ends) p.lacks = [...new Set([...p.lacks, ends.left, ends.right])].sort((a, b) => a - b);
  emit(s, { type: 'pass', player: me });
  addLog(s, p.seat, `${withJosa(nameOf(s, me), '은/는')} 낼 패가 없어서 통과해요. (똑똑)`);
  if (isBlocked(s)) finishRound(s, 'blocked', null);
  else beginTurn(s, nextIndex(s, me));
  return s;
}

/**
 * 행동을 적용한 새 상태를 돌려준다. 할 수 없는 행동이면 원래 상태를 그대로 돌려준다.
 * (state는 바꾸지 않는다)
 */
export function applyAction(state: DominoState, action: DominoAction, rng: Rng = Math.random): DominoState {
  switch (action.type) {
    case 'play':
      return play(state, action);
    case 'draw':
      return draw(state);
    case 'pass':
      return pass(state);
    case 'nextRound': {
      if (state.phase !== 'roundover') return state;
      const s = draft(state);
      startRound(s, rng);
      return s;
    }
  }
}
