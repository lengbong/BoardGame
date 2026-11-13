import { withJosa } from '../../lib/korean';
import { randomInt, shuffle } from '../../lib/random';
import { SEAT_COLORS } from '../common/players';
import { createDeck, isJoker, rankLabel } from '../common/playingCards';
import type { Card, GameEvent, OldMaidAction, OldMaidOptions, OldMaidSetup, OldMaidState, Player, Rng, SeatIndex } from './types';

export const DEFAULT_OPTIONS: OldMaidOptions = {
  handView: 'cover',
};

/** 카드 52장 + 조커 1장 */
export const DECK_SIZE = 53;

const MAX_LOG = 60;

type EventInput = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'id'> : never) : never;

export function playerName(player: Player): string {
  return player.name || SEAT_COLORS[player.seat].name;
}

function nameOf(s: OldMaidState, index: number): string {
  return playerName(s.players[index]);
}

function addLog(s: OldMaidState, seat: SeatIndex | null, text: string): void {
  const last = s.log[s.log.length - 1];
  if (last && last.text === text && last.seat === seat) return;
  s.log = [...s.log, { id: s.nextLogId, seat, text }].slice(-MAX_LOG);
  s.nextLogId += 1;
}

function emit(s: OldMaidState, event: EventInput): void {
  s.events.push({ ...event, id: s.nextEventId } as GameEvent);
  s.nextEventId += 1;
}

/** 상태를 통째로 복사해서 마음 놓고 고칠 수 있게 한다. (카드 53장이라 가볍다) */
function draft(state: OldMaidState): OldMaidState {
  const s = structuredClone(state);
  s.events = [];
  return s;
}

/** 아직 카드가 남은 사람들 */
export function activePlayers(state: OldMaidState): number[] {
  return state.players.map((p, i) => (p.hand.length > 0 ? i : -1)).filter((i) => i >= 0);
}

/** from 다음 자리부터 돌면서 카드가 남은 첫 사람 (from 자신은 빼고). 없으면 -1 */
export function nextActive(state: OldMaidState, from: number): number {
  const n = state.players.length;
  for (let k = 1; k < n; k++) {
    const i = (from + k) % n;
    if (state.players[i].hand.length > 0) return i;
  }
  return -1;
}

/** from 앞 자리로 거슬러 가면서 카드가 남은 첫 사람 (from 자신은 빼고). 없으면 -1 */
export function prevActive(state: OldMaidState, from: number): number {
  const n = state.players.length;
  for (let k = 1; k < n; k++) {
    const i = (((from - k) % n) + n) % n;
    if (state.players[i].hand.length > 0) return i;
  }
  return -1;
}

/** 지금 차례인 사람이 카드를 뽑을 상대 (다음 사람). 뽑을 때가 아니면 -1 */
export function drawTarget(state: OldMaidState): number {
  return state.phase === 'play' ? nextActive(state, state.current) : -1;
}

/** 조커를 든 사람 (없으면 -1) */
export function jokerHolder(state: OldMaidState): number {
  return state.players.findIndex((p) => p.hand.some(isJoker));
}

/**
 * 손패에서 같은 숫자 두 장씩을 골라낸다. 손에 든 순서는 그대로 둔다.
 * 3장이면 2장만 버리고 1장은 남고, 4장이면 모두 버린다. 조커는 짝이 없다.
 */
export function findPairs(hand: readonly Card[]): { kept: Card[]; pairs: Card[] } {
  const kept: Card[] = [];
  const pairs: Card[] = [];
  for (const c of hand) {
    const j = isJoker(c) ? -1 : kept.findIndex((k) => !isJoker(k) && k.rank === c.rank);
    if (j >= 0) {
      pairs.push(kept[j], c);
      kept.splice(j, 1);
    } else {
      kept.push(c);
    }
  }
  return { kept, pairs };
}

/** 최종 순위: 먼저 카드를 다 턴 순서, 마지막이 도둑 */
export function rankings(state: OldMaidState): number[] {
  return state.thief === null ? [...state.finished] : [...state.finished, state.thief];
}

export function createGame(setup: OldMaidSetup, rng: Rng = Math.random): OldMaidState {
  const players: Player[] = [];
  setup.seats.forEach((seat, i) => {
    if (seat.kind === 'empty') return;
    players.push({
      seat: i as SeatIndex,
      kind: seat.kind,
      name: seat.name.trim() || SEAT_COLORS[i as SeatIndex].name,
      hand: [],
      place: 0,
    });
  });
  if (players.length < 2) throw new Error('플레이어가 2명 이상 필요합니다.');
  const n = players.length;
  const deck = shuffle(createDeck({ joker: true }), rng);
  const first = randomInt(n, rng);
  deck.forEach((card, k) => players[(first + k) % n].hand.push(card));

  const s: OldMaidState = {
    players,
    options: { ...DEFAULT_OPTIONS, ...setup.options },
    phase: 'deal',
    first,
    current: first,
    turn: 0,
    discard: [],
    finished: [],
    thief: null,
    jokerKnownBy: [],
    picks: players.map(() => [0, 0, 0]),
    lastDraw: null,
    events: [],
    nextEventId: 1,
    log: [],
    nextLogId: 1,
  };
  s.jokerKnownBy = [jokerHolder(s)];
  emit(s, { type: 'deal', first });
  addLog(s, null, `카드 ${DECK_SIZE}장을 모두 나눠 줬어요. 같은 숫자 두 장은 버려요!`);
  return s;
}

function markOut(s: OldMaidState, index: number): void {
  if (s.finished.includes(index)) return;
  s.finished.push(index);
  const place = s.finished.length;
  s.players[index].place = place;
  emit(s, { type: 'out', player: index, place });
  addLog(s, s.players[index].seat, `🎉 ${withJosa(nameOf(s, index), '이/가')} 카드를 다 털었어요! (${place}등)`);
}

/** 카드가 남은 사람이 1명 이하면 끝: 그 사람이 도둑 */
function checkEnd(s: OldMaidState): boolean {
  const active = activePlayers(s);
  if (active.length > 1) return false;
  s.phase = 'gameover';
  s.thief = active.length === 1 ? active[0] : null;
  if (s.thief !== null) {
    emit(s, { type: 'thief', player: s.thief });
    const name = nameOf(s, s.thief);
    addLog(s, s.players[s.thief].seat, `🃏 ${withJosa(name, '이/가')} 마지막까지 조커를 들고 있었어요. 도둑은 ${name}!`);
  }
  return true;
}

function shuffleHand(s: OldMaidState, index: number, rng: Rng, jokerSpot?: number): void {
  const p = s.players[index];
  p.hand = shuffle(p.hand, rng);
  const ji = p.hand.findIndex(isJoker);
  if (ji >= 0) {
    if (jokerSpot !== undefined && Number.isFinite(jokerSpot) && p.hand.length > 1) {
      const [joker] = p.hand.splice(ji, 1);
      const pos = Math.round(Math.min(1, Math.max(0, jokerSpot)) * p.hand.length);
      p.hand.splice(pos, 0, joker);
    }
    // 섞었으니 조커 자리는 이제 든 사람만 안다.
    s.jokerKnownBy = [index];
  }
  emit(s, { type: 'shuffle', player: index });
}

function discardPairs(state: OldMaidState): OldMaidState {
  if (state.phase !== 'deal') return state;
  const s = draft(state);
  const n = s.players.length;
  for (let k = 0; k < n; k++) {
    const i = (s.first + k) % n;
    const p = s.players[i];
    const { kept, pairs } = findPairs(p.hand);
    p.hand = kept;
    if (pairs.length > 0) {
      s.discard.push(...pairs);
      emit(s, { type: 'pairs', player: i, cards: pairs });
      addLog(s, p.seat, `${nameOf(s, i)}: 짝 ${pairs.length / 2}쌍을 버렸어요.`);
    } else {
      addLog(s, p.seat, `${nameOf(s, i)}: 버릴 짝이 없어요.`);
    }
  }
  s.phase = 'play';
  for (let k = 0; k < n; k++) {
    const i = (s.first + k) % n;
    if (s.players[i].hand.length === 0) markOut(s, i);
  }
  if (checkEnd(s)) return s;
  s.current = s.players[s.first].hand.length > 0 ? s.first : nextActive(s, s.first);
  s.turn += 1;
  addLog(s, s.players[s.current].seat, `${nameOf(s, s.current)}부터 다음 사람 카드를 한 장씩 뽑아요.`);
  return s;
}

function draw(state: OldMaidState, action: Extract<OldMaidAction, { type: 'draw' }>, rng: Rng): OldMaidState {
  if (state.phase !== 'play') return state;
  const me = state.current;
  const from = nextActive(state, me);
  if (from < 0) return state;
  const len = state.players[from].hand.length;
  if (!Number.isInteger(action.index) || action.index < 0 || action.index >= len) return state;

  const s = draft(state);
  const giver = s.players[from];
  const taker = s.players[me];
  const [card] = giver.hand.splice(action.index, 1);

  // 어느 쪽을 뽑았는지 기록 (모두가 보는 정보)
  const rel = len === 1 ? 0.5 : action.index / (len - 1);
  s.picks[me][rel < 1 / 3 ? 0 : rel > 2 / 3 ? 2 : 1] += 1;
  emit(s, { type: 'draw', player: me, from, index: action.index, card });

  // 조커가 옮겨 가는 것을 본 사람: 내준 사람, 뽑은 사람, 원래 자리를 알던 사람
  if (isJoker(card)) s.jokerKnownBy = [...new Set([...s.jokerKnownBy, from, me])];

  const who = withJosa(nameOf(s, me), '이/가');
  const fromName = nameOf(s, from);
  const j = isJoker(card) ? -1 : taker.hand.findIndex((c) => !isJoker(c) && c.rank === card.rank);
  if (j >= 0) {
    const [match] = taker.hand.splice(j, 1);
    s.discard.push(match, card);
    emit(s, { type: 'pair', player: me, cards: [match, card] });
    addLog(s, taker.seat, `${who} ${fromName}의 카드를 뽑아 ${rankLabel(card.rank)} 짝을 맞췄어요!`);
  } else {
    taker.hand.push(card);
    addLog(s, taker.seat, `${who} ${fromName}의 카드를 한 장 뽑았어요.`);
  }
  s.lastDraw = { player: me, from, cardId: card.id, paired: j >= 0 };

  if (action.shuffle && taker.hand.length > 1) shuffleHand(s, me, rng, action.jokerSpot);

  // 뽑힌 사람이 먼저 빠지고, 마지막 짝을 맞춘 사람이 그다음
  if (giver.hand.length === 0) markOut(s, from);
  if (taker.hand.length === 0) markOut(s, me);
  if (checkEnd(s)) return s;
  s.current = nextActive(s, me);
  s.turn += 1;
  return s;
}

/**
 * 행동을 적용한 새 상태를 돌려준다. 할 수 없는 행동이면 원래 상태를 그대로 돌려준다.
 * (state는 바꾸지 않는다)
 */
export function applyAction(state: OldMaidState, action: OldMaidAction, rng: Rng = Math.random): OldMaidState {
  switch (action.type) {
    case 'discardPairs':
      return discardPairs(state);
    case 'draw':
      return draw(state, action, rng);
    case 'shuffle': {
      if (state.phase !== 'play') return state;
      const p = state.players[action.player];
      if (!p || p.hand.length < 2) return state;
      const s = draft(state);
      shuffleHand(s, action.player, rng);
      addLog(s, p.seat, `${withJosa(nameOf(s, action.player), '이/가')} 카드를 섞었어요.`);
      return s;
    }
  }
}
