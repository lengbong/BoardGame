import { withJosa } from '../../lib/korean';
import { SEAT_COLORS } from '../common/players';
import { COLOR_INFO, cardLabel, createDeck, handPoints, isWild, shuffle } from './cards';
import type {
  Card,
  DrawReason,
  GameEvent,
  LastCardAction,
  LastCardOptions,
  LastCardSetup,
  LastCardState,
  Player,
  Rng,
  SeatIndex,
} from './types';

export const HAND_SIZE = 7;
export const TARGET_SCORES = [200, 300, 500];

export const DEFAULT_OPTIONS: LastCardOptions = {
  stacking: false,
  callRule: true,
  handView: 'cover',
  endMode: 'single',
  targetScore: 300,
};

const MAX_LOG = 60;

type EventInput = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'id'> : never) : never;

export function playerName(player: Player): string {
  return player.name || SEAT_COLORS[player.seat].name;
}

function nameOf(s: LastCardState, index: number): string {
  return playerName(s.players[index]);
}

function addLog(s: LastCardState, seat: SeatIndex | null, text: string): void {
  s.log = [...s.log, { id: s.nextLogId, seat, text }].slice(-MAX_LOG);
  s.nextLogId += 1;
}

function emit(s: LastCardState, event: EventInput): void {
  s.events.push({ ...event, id: s.nextEventId } as GameEvent);
  s.nextEventId += 1;
}

/** 상태를 통째로 복사해서 마음 놓고 고칠 수 있게 한다. (카드 108장이라 충분히 가볍다) */
function draft(state: LastCardState): LastCardState {
  const s = structuredClone(state);
  s.events = [];
  return s;
}

export function topCard(state: LastCardState): Card {
  return state.discard[state.discard.length - 1];
}

/** from에서 진행 방향으로 steps번째 사람 */
export function nextIndex(state: LastCardState, from: number, steps = 1): number {
  const n = state.players.length;
  return (((from + state.direction * steps) % n) + n) % n;
}

/** 카드를 지금 낼 수 있는지 (차례·단계는 따지지 않음) */
export function matches(state: LastCardState, card: Card): boolean {
  const top = topCard(state);
  if (state.pendingDraw > 0) {
    // 누적 중에는 +2 위에 +2나 +4, +4 위에는 +4만 이어 낼 수 있다.
    if (top.kind === 'draw2') return card.kind === 'draw2' || card.kind === 'wild4';
    if (top.kind === 'wild4') return card.kind === 'wild4';
    return false;
  }
  if (isWild(card)) return true;
  if (card.color === state.activeColor) return true;
  if (card.kind === 'number') return top.kind === 'number' && top.value === card.value;
  return card.kind === top.kind;
}

/** 지금 차례인 사람이 낼 수 있는 카드 */
export function playableCards(state: LastCardState): Card[] {
  if (state.phase !== 'play' && state.phase !== 'drawn') return [];
  const hand = state.players[state.current].hand;
  if (state.phase === 'drawn') return hand.filter((c) => c.id === state.drawnCardId && matches(state, c));
  return hand.filter((c) => matches(state, c));
}

/** '한 장!'을 외칠 수 있는지: 한 장 외치기 규칙이 켜져 있고, 내 차례에 카드가 2장일 때 */
export function canCall(state: LastCardState): boolean {
  return (
    state.options.callRule &&
    (state.phase === 'play' || state.phase === 'drawn') &&
    !state.called &&
    state.players[state.current].hand.length === 2
  );
}

function beginTurn(s: LastCardState, index: number): void {
  s.current = index;
  s.phase = 'play';
  s.called = false;
  s.drawnCardId = null;
  s.turn += 1;
}

/** 카드를 count장 뽑는다. 더미가 비면 버린 카드를 섞어서 채운다. 실제로 뽑은 장수를 돌려준다. */
function drawInto(s: LastCardState, index: number, count: number, reason: DrawReason, rng: Rng): number {
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (s.drawPile.length === 0) {
      if (s.discard.length <= 1) break;
      const top = s.discard.pop()!;
      s.drawPile = shuffle(s.discard, rng);
      s.discard = [top];
      emit(s, { type: 'reshuffle' });
      addLog(s, null, '버린 카드를 섞어서 뽑을 카드를 다시 채웠어요.');
    }
    s.players[index].hand.push(s.drawPile.pop()!);
    drawn += 1;
  }
  if (drawn > 0) emit(s, { type: 'draw', player: index, count: drawn, reason });
  return drawn;
}

/** 새 판: 카드를 섞어 7장씩 나눠 주고, 숫자 카드 한 장을 펼쳐 놓는다. */
function startRound(s: LastCardState, starter: number, rng: Rng): void {
  s.round += 1;
  const deck = shuffle(createDeck(), rng);
  for (const p of s.players) p.hand = [];
  for (let k = 0; k < HAND_SIZE; k++) {
    for (let i = 0; i < s.players.length; i++) s.players[(starter + i) % s.players.length].hand.push(deck.pop()!);
  }
  let first = deck.pop()!;
  while (first.kind !== 'number') {
    deck.unshift(first);
    first = deck.pop()!;
  }
  s.drawPile = deck;
  s.discard = [first];
  s.activeColor = first.color!;
  s.direction = 1;
  s.pendingDraw = 0;
  s.roundResult = null;
  s.starter = starter;
  beginTurn(s, starter);
  emit(s, { type: 'deal' });
  const who = withJosa(nameOf(s, starter), '이/가');
  if (s.options.endMode === 'points') addLog(s, s.players[starter].seat, `${s.round}번째 판! ${who} 먼저 시작해요.`);
  else addLog(s, s.players[starter].seat, `${who} 먼저 시작해요.`);
}

export function createGame(setup: LastCardSetup, rng: Rng = Math.random): LastCardState {
  const players: Player[] = [];
  setup.seats.forEach((seat, i) => {
    if (seat.kind === 'empty') return;
    players.push({
      seat: i as SeatIndex,
      kind: seat.kind,
      name: seat.name.trim() || SEAT_COLORS[i as SeatIndex].name,
      hand: [],
      score: 0,
    });
  });
  if (players.length < 2) throw new Error('플레이어가 2명 이상 필요합니다.');
  const starter = Math.min(players.length - 1, Math.floor(rng() * players.length));
  const s: LastCardState = {
    players,
    options: { ...DEFAULT_OPTIONS, ...setup.options },
    round: 0,
    starter,
    current: starter,
    direction: 1,
    drawPile: [],
    discard: [],
    activeColor: 'red',
    pendingDraw: 0,
    drawnCardId: null,
    called: false,
    phase: 'play',
    turn: 0,
    roundResult: null,
    rankings: [],
    events: [],
    nextEventId: 1,
    log: [],
    nextLogId: 1,
  };
  startRound(s, starter, rng);
  return s;
}

function finishRound(s: LastCardState, winner: number): void {
  const points = s.players.map((p) => handPoints(p.hand));
  const gained = points.reduce((sum, v, i) => (i === winner ? sum : sum + v), 0);
  s.players[winner].score += gained;
  s.roundResult = { winner, points: gained, handPoints: points };
  s.pendingDraw = 0;
  s.called = false;
  s.drawnCardId = null;
  emit(s, { type: 'win', player: winner, points: gained });
  const name = nameOf(s, winner);
  addLog(s, s.players[winner].seat, `${withJosa(name, '이/가')} 카드를 다 냈어요! (+${gained}점)`);

  const order = s.players.map((_, i) => i);
  if (s.options.endMode === 'single') {
    s.phase = 'gameover';
    s.rankings = order.sort((a, b) => {
      if (a === winner || b === winner) return a === winner ? -1 : 1;
      return points[a] - points[b] || s.players[a].hand.length - s.players[b].hand.length || a - b;
    });
  } else if (s.players[winner].score >= s.options.targetScore) {
    s.phase = 'gameover';
    s.rankings = order.sort((a, b) => s.players[b].score - s.players[a].score || (a === winner ? -1 : b === winner ? 1 : a - b));
  } else {
    s.phase = 'roundover';
    return;
  }
  addLog(s, s.players[s.rankings[0]].seat, `🏆 ${withJosa(nameOf(s, s.rankings[0]), '이/가')} 우승했어요!`);
}

function shout(s: LastCardState, index: number): void {
  emit(s, { type: 'call', player: index });
  addLog(s, s.players[index].seat, `${nameOf(s, index)}: "한 장 남았다!"`);
}

function play(state: LastCardState, action: Extract<LastCardAction, { type: 'play' }>, rng: Rng): LastCardState {
  if (state.phase !== 'play' && state.phase !== 'drawn') return state;
  const me = state.current;
  const card = state.players[me].hand.find((c) => c.id === action.cardId);
  if (!card || !playableCards(state).includes(card)) return state;
  if (isWild(card) && !action.color) return state;

  const s = draft(state);
  const p = s.players[me];
  const seat = p.seat;
  const name = nameOf(s, me);
  if (action.call && canCall(s)) {
    s.called = true;
    shout(s, me);
  }

  p.hand = p.hand.filter((c) => c.id !== card.id);
  s.discard.push(card);
  s.activeColor = card.color ?? action.color!;
  s.drawnCardId = null;
  emit(s, { type: 'play', player: me, card });
  if (isWild(card)) {
    emit(s, { type: 'color', player: me, color: s.activeColor });
    addLog(s, seat, `${name}: ${cardLabel(card)} → ${COLOR_INFO[s.activeColor].name}`);
  } else {
    addLog(s, seat, `${name}: ${cardLabel(card)}`);
  }

  // 한 장 남았을 때 외치기
  if (p.hand.length === 1 && !s.called) {
    if (s.options.callRule) {
      addLog(s, seat, `${withJosa(name, '이/가')} '한 장!'을 깜빡해서 2장을 받아요.`);
      drawInto(s, me, 2, 'forgot', rng);
    } else {
      shout(s, me);
    }
  }

  const amount = card.kind === 'draw2' ? 2 : card.kind === 'wild4' ? 4 : 0;
  const victim = nextIndex(s, me);

  if (p.hand.length === 0) {
    // 마지막 카드가 +2·+4라도 다음 사람은 카드를 받는다. (점수에 들어감)
    if (amount > 0) {
      const total = s.pendingDraw + amount;
      s.pendingDraw = 0;
      drawInto(s, victim, total, s.options.stacking && total > amount ? 'stack' : card.kind === 'draw2' ? 'draw2' : 'wild4', rng);
    }
    finishRound(s, me);
    return s;
  }

  const victimName = nameOf(s, victim);
  switch (card.kind) {
    case 'skip':
      emit(s, { type: 'skip', player: victim });
      addLog(s, s.players[victim].seat, `${withJosa(victimName, '은/는')} 한 번 쉬어요.`);
      beginTurn(s, nextIndex(s, me, 2));
      break;
    case 'reverse':
      s.direction = s.direction === 1 ? -1 : 1;
      emit(s, { type: 'reverse', direction: s.direction });
      if (s.players.length === 2) {
        // 2명일 때는 건너뛰기와 같다.
        emit(s, { type: 'skip', player: victim });
        addLog(s, seat, `방향이 바뀌어서 ${withJosa(name, '이/가')} 한 번 더 해요.`);
        beginTurn(s, me);
      } else {
        addLog(s, null, `방향이 바뀌었어요. (${s.direction === 1 ? '시계 방향' : '시계 반대 방향'})`);
        beginTurn(s, nextIndex(s, me));
      }
      break;
    case 'draw2':
    case 'wild4':
      if (s.options.stacking) {
        s.pendingDraw += amount;
        emit(s, { type: 'stack', player: victim, total: s.pendingDraw });
        addLog(
          s,
          s.players[victim].seat,
          `+${s.pendingDraw} 쌓였어요! ${withJosa(victimName, '은/는')} 이어 내거나 ${s.pendingDraw}장을 받아야 해요.`,
        );
        beginTurn(s, victim);
      } else {
        drawInto(s, victim, amount, card.kind, rng);
        emit(s, { type: 'skip', player: victim });
        addLog(s, s.players[victim].seat, `${withJosa(victimName, '이/가')} ${amount}장을 받고 한 번 쉬어요.`);
        beginTurn(s, nextIndex(s, me, 2));
      }
      break;
    default:
      beginTurn(s, victim);
  }
  return s;
}

function draw(state: LastCardState, rng: Rng): LastCardState {
  if (state.phase !== 'play') return state;
  const s = draft(state);
  const me = s.current;
  const seat = s.players[me].seat;
  const name = nameOf(s, me);

  if (s.pendingDraw > 0) {
    const total = s.pendingDraw;
    s.pendingDraw = 0;
    const got = drawInto(s, me, total, 'stack', rng);
    addLog(s, seat, `${withJosa(name, '이/가')} 쌓인 카드 ${got}장을 받았어요.`);
    beginTurn(s, nextIndex(s, me));
    return s;
  }

  const got = drawInto(s, me, 1, 'normal', rng);
  if (got === 0) {
    emit(s, { type: 'pass', player: me });
    addLog(s, seat, `뽑을 카드가 없어서 ${withJosa(name, '이/가')} 넘어가요.`);
    beginTurn(s, nextIndex(s, me));
    return s;
  }
  const card = s.players[me].hand[s.players[me].hand.length - 1];
  if (matches(s, card)) {
    s.phase = 'drawn';
    s.drawnCardId = card.id;
    addLog(s, seat, `${withJosa(name, '이/가')} 1장 뽑았어요.`);
  } else {
    addLog(s, seat, `${withJosa(name, '이/가')} 1장 뽑았지만 낼 카드가 없어요.`);
    beginTurn(s, nextIndex(s, me));
  }
  return s;
}

/**
 * 행동을 적용한 새 상태를 돌려준다. 할 수 없는 행동이면 원래 상태를 그대로 돌려준다.
 * (state는 바꾸지 않는다)
 */
export function applyAction(state: LastCardState, action: LastCardAction, rng: Rng = Math.random): LastCardState {
  switch (action.type) {
    case 'play':
      return play(state, action, rng);
    case 'draw':
      return draw(state, rng);
    case 'pass': {
      if (state.phase !== 'drawn') return state;
      const s = draft(state);
      emit(s, { type: 'pass', player: s.current });
      addLog(s, s.players[s.current].seat, `${withJosa(nameOf(s, s.current), '은/는')} 내지 않고 넘어가요.`);
      beginTurn(s, nextIndex(s, s.current));
      return s;
    }
    case 'call': {
      if (!canCall(state)) return state;
      const s = draft(state);
      s.called = true;
      shout(s, s.current);
      return s;
    }
    case 'nextRound': {
      if (state.phase !== 'roundover') return state;
      const s = draft(state);
      startRound(s, (s.starter + 1) % s.players.length, rng);
      return s;
    }
  }
}
