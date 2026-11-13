import { withJosa } from '../../lib/korean';
import { randomInt, shuffle } from '../../lib/random';
import { SEAT_COLORS } from '../common/players';
import { SUITS, cardShortLabel, createDeck, handPoints, makeCard, sortCards } from '../common/playingCards';
import type { Board, Card, GameEvent, Player, Rng, SeatIndex, SevensAction, SevensOptions, SevensSetup, SevensState, Suit } from './types';

/** 통과는 한 판에 3번까지 (통과 제한 규칙) */
export const MAX_PASSES = 3;
export const TARGET_SCORES = [100, 200, 300];

/** ♦7을 가진 사람이 이 카드를 놓으며 시작한다. */
export const START_CARD: Card = makeCard('diamond', 7);

export const DEFAULT_OPTIONS: SevensOptions = {
  passLimit: true,
  handView: 'cover',
  endMode: 'single',
  targetScore: 200,
};

const MAX_LOG = 60;

type EventInput = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'id'> : never) : never;

export function playerName(player: Player): string {
  return player.name || SEAT_COLORS[player.seat].name;
}

function nameOf(s: SevensState, index: number): string {
  return playerName(s.players[index]);
}

function addLog(s: SevensState, seat: SeatIndex | null, text: string): void {
  s.log = [...s.log, { id: s.nextLogId, seat, text }].slice(-MAX_LOG);
  s.nextLogId += 1;
}

function emit(s: SevensState, event: EventInput): void {
  s.events.push({ ...event, id: s.nextEventId } as GameEvent);
  s.nextEventId += 1;
}

function draft(state: SevensState): SevensState {
  const s = structuredClone(state);
  s.events = [];
  return s;
}

export function emptyBoard(): Board {
  const row = () => Array.from({ length: 14 }, () => null);
  return { spade: row(), heart: row(), diamond: row(), club: row() };
}

export function isPlaced(board: Board, suit: Suit, rank: number): boolean {
  return rank >= 1 && rank <= 13 && board[suit][rank] !== null;
}

/** 판에 놓을 수 있는 카드인지: 7이거나, 같은 무늬로 바로 위나 아래 숫자가 판에 있다. */
export function canPlace(board: Board, card: Card): boolean {
  if (card.suit === null || isPlaced(board, card.suit, card.rank)) return false;
  if (card.rank === 7) return true;
  return isPlaced(board, card.suit, card.rank - 1) || isPlaced(board, card.suit, card.rank + 1);
}

/** 판에서 지금 카드를 놓을 수 있는 빈칸들 */
export function openSlots(board: Board): { suit: Suit; rank: number }[] {
  const slots: { suit: Suit; rank: number }[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) if (canPlace(board, makeCard(suit, rank))) slots.push({ suit, rank });
  }
  return slots;
}

export function placedCount(board: Board): number {
  return SUITS.reduce((n, suit) => n + board[suit].filter((c) => c !== null).length, 0);
}

/** 지금 차례인 사람이 낼 수 있는 카드 */
export function playableCards(state: SevensState): Card[] {
  if (state.phase !== 'play') return [];
  return state.players[state.current].hand.filter((c) => canPlace(state.board, c));
}

/** 아직 하는 중인 사람들 */
export function playingPlayers(state: SevensState): number[] {
  return state.players.map((p, i) => (p.status === 'playing' ? i : -1)).filter((i) => i >= 0);
}

/** from 다음 자리부터 돌면서 아직 하는 중인 첫 사람 (from 자신은 빼고). 없으면 -1 */
export function nextPlaying(state: SevensState, from: number): number {
  const n = state.players.length;
  for (let k = 1; k < n; k++) {
    const i = (from + k) % n;
    if (state.players[i].status === 'playing') return i;
  }
  return -1;
}

/** 통과를 몇 번 더 할 수 있는지 (제한이 없으면 Infinity) */
export function passesLeft(state: SevensState, index: number): number {
  return state.options.passLimit ? Math.max(0, MAX_PASSES - state.players[index].passes) : Infinity;
}

function startRound(s: SevensState, rng: Rng): void {
  s.round += 1;
  s.board = emptyBoard();
  s.finishOrder = [];
  s.outOrder = [];
  s.roundResult = null;
  const n = s.players.length;
  const deck = shuffle(createDeck(), rng);
  for (const p of s.players) {
    p.hand = [];
    p.passes = 0;
    p.status = 'playing';
    p.dumpedPoints = 0;
  }
  deck.forEach((card, k) => s.players[(s.dealer + k) % n].hand.push(card));
  for (const p of s.players) p.hand = sortCards(p.hand);

  const starter = s.players.findIndex((p) => p.hand.some((c) => c.id === START_CARD.id));
  const p = s.players[starter];
  p.hand = p.hand.filter((c) => c.id !== START_CARD.id);
  s.board.diamond[7] = { by: starter, dumped: false };
  s.phase = 'play';
  emit(s, { type: 'deal', starter });
  emit(s, { type: 'play', player: starter, card: START_CARD, auto: true });
  if (s.options.endMode === 'points') addLog(s, null, `${s.round}번째 판을 시작해요!`);
  addLog(s, p.seat, `${withJosa(nameOf(s, starter), '이/가')} ♦7을 가지고 있어서 먼저 놓았어요.`);
  s.current = nextPlaying(s, starter);
  s.turn += 1;
}

export function createGame(setup: SevensSetup, rng: Rng = Math.random): SevensState {
  const players: Player[] = [];
  setup.seats.forEach((seat, i) => {
    if (seat.kind === 'empty') return;
    players.push({
      seat: i as SeatIndex,
      kind: seat.kind,
      name: seat.name.trim() || SEAT_COLORS[i as SeatIndex].name,
      hand: [],
      passes: 0,
      status: 'playing',
      dumpedPoints: 0,
      score: 0,
    });
  });
  if (players.length < 2) throw new Error('플레이어가 2명 이상 필요합니다.');
  const s: SevensState = {
    players,
    options: { ...DEFAULT_OPTIONS, ...setup.options },
    board: emptyBoard(),
    phase: 'play',
    round: 0,
    dealer: randomInt(players.length, rng),
    current: 0,
    turn: 0,
    finishOrder: [],
    outOrder: [],
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

function finish(s: SevensState, index: number): void {
  const p = s.players[index];
  p.status = 'finished';
  s.finishOrder.push(index);
  const place = s.finishOrder.length;
  emit(s, { type: 'finish', player: index, place });
  const who = withJosa(nameOf(s, index), '이/가');
  addLog(s, p.seat, s.options.endMode === 'points' ? `🎉 ${who} 카드를 다 냈어요!` : `🎉 ${who} 카드를 다 냈어요! (${place}등)`);
}

/** 통과를 다 써서 탈락: 손에 든 카드를 모두 제자리에 내려놓는다. */
function eliminate(s: SevensState, index: number): void {
  const p = s.players[index];
  const cards = sortCards(p.hand);
  for (const c of cards) s.board[c.suit!][c.rank] = { by: index, dumped: true };
  p.dumpedPoints = handPoints(cards);
  p.hand = [];
  p.status = 'out';
  s.outOrder.push(index);
  emit(s, { type: 'eliminate', player: index, cards });
  addLog(s, p.seat, `${withJosa(nameOf(s, index), '은/는')} 통과를 다 써서 탈락! 카드 ${cards.length}장을 모두 판에 내려놓아요.`);
}

function finishPointsRound(s: SevensState, winner: number): void {
  const handPts = s.players.map((p) => (p.status === 'out' ? p.dumpedPoints : handPoints(p.hand)));
  const gained = handPts.reduce((sum, v, i) => (i === winner ? sum : sum + v), 0);
  s.players[winner].score += gained;
  const order = s.players
    .map((_, i) => i)
    .sort((a, b) => (a === winner ? -1 : b === winner ? 1 : handPts[a] - handPts[b] || a - b));
  s.roundResult = { winner, points: gained, handPoints: handPts, order };
  emit(s, { type: 'roundEnd', winner, points: gained });
  addLog(s, s.players[winner].seat, `${withJosa(nameOf(s, winner), '이/가')} 이번 판을 이겼어요! (+${gained}점)`);
  if (s.players[winner].score >= s.options.targetScore) {
    s.phase = 'gameover';
    s.rankings = s.players
      .map((_, i) => i)
      .sort((a, b) => s.players[b].score - s.players[a].score || (a === winner ? -1 : b === winner ? 1 : a - b));
    addLog(s, s.players[s.rankings[0]].seat, `🏆 ${withJosa(nameOf(s, s.rankings[0]), '이/가')} 우승했어요!`);
  } else {
    s.phase = 'roundover';
  }
}

/** 판이 끝났는지 확인하고, 끝났으면 결과를 정한다. */
function checkRoundEnd(s: SevensState): boolean {
  const playing = playingPlayers(s);
  if (s.options.endMode === 'points') {
    if (s.finishOrder.length === 0 && playing.length > 1) return false;
    const winner = s.finishOrder[0] ?? playing[0] ?? s.outOrder[s.outOrder.length - 1];
    finishPointsRound(s, winner);
    return true;
  }
  if (playing.length > 1) return false;
  // 순위: 다 낸 순서 → 마지막까지 남은 사람 → 탈락한 사람 (늦게 탈락할수록 앞)
  const order = [...s.finishOrder, ...playing, ...[...s.outOrder].reverse()];
  const handPts = s.players.map((p) => (p.status === 'out' ? p.dumpedPoints : handPoints(p.hand)));
  s.phase = 'gameover';
  s.rankings = order;
  s.roundResult = { winner: order[0], points: 0, handPoints: handPts, order };
  emit(s, { type: 'roundEnd', winner: order[0], points: 0 });
  addLog(s, s.players[order[0]].seat, `🏆 ${withJosa(nameOf(s, order[0]), '이/가')} 1등이에요!`);
  return true;
}

function advance(s: SevensState, from: number): void {
  s.current = nextPlaying(s, from);
  s.turn += 1;
}

function play(state: SevensState, cardId: number): SevensState {
  if (state.phase !== 'play') return state;
  const me = state.current;
  const card = state.players[me].hand.find((c) => c.id === cardId);
  if (!card || !canPlace(state.board, card)) return state;
  const s = draft(state);
  const p = s.players[me];
  p.hand = p.hand.filter((c) => c.id !== cardId);
  s.board[card.suit!][card.rank] = { by: me, dumped: false };
  emit(s, { type: 'play', player: me, card });
  addLog(s, p.seat, `${nameOf(s, me)}: ${cardShortLabel(card)}`);
  if (p.hand.length === 0) finish(s, me);
  if (!checkRoundEnd(s)) advance(s, me);
  return s;
}

function pass(state: SevensState): SevensState {
  if (state.phase !== 'play') return state;
  // 낼 수 있는 카드가 있으면 꼭 내야 한다.
  if (playableCards(state).length > 0) return state;
  const s = draft(state);
  const me = s.current;
  const p = s.players[me];
  if (s.options.passLimit && p.passes >= MAX_PASSES) {
    eliminate(s, me);
  } else {
    p.passes += 1;
    emit(s, { type: 'pass', player: me, count: p.passes });
    addLog(s, p.seat, s.options.passLimit ? `${nameOf(s, me)}: 통과 (${p.passes}/${MAX_PASSES})` : `${nameOf(s, me)}: 통과`);
  }
  if (!checkRoundEnd(s)) advance(s, me);
  return s;
}

/**
 * 행동을 적용한 새 상태를 돌려준다. 할 수 없는 행동이면 원래 상태를 그대로 돌려준다.
 * (state는 바꾸지 않는다)
 */
export function applyAction(state: SevensState, action: SevensAction, rng: Rng = Math.random): SevensState {
  switch (action.type) {
    case 'play':
      return play(state, action.cardId);
    case 'pass':
      return pass(state);
    case 'nextRound': {
      if (state.phase !== 'roundover') return state;
      const s = draft(state);
      s.dealer = (s.dealer + 1) % s.players.length;
      startRound(s, rng);
      return s;
    }
  }
}
