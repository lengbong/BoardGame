import { withJosa } from '../../lib/korean';
import { randomInt, shuffle } from '../../lib/random';
import { SEAT_COLORS } from '../common/players';
import { createDeck, rankLabel } from '../common/playingCards';
import type { Card, CheatAction, CheatOptions, CheatSetup, CheatState, Claim, GameEvent, Player, PlayerStats, Rng, SeatIndex } from './types';

export const DEFAULT_OPTIONS: CheatOptions = {
  handView: 'cover',
  doubt: 'anyone',
  deal: 'all',
};

export const DECK_SIZE = 52;

/** 한 번에 낼 수 있는 카드 수 (같은 숫자는 4장뿐) */
export const MAX_PLAY = 4;

/** 사람 수마다 한 사람에게 나눠 주는 장수. 남는 카드는 아무도 모르게 빼 둔다 */
export const DEAL_COUNTS: Record<CheatOptions['deal'], Record<number, number>> = {
  // 2명이 모두 나누면 상대 카드를 다 알게 되므로 16장은 빼 둔다. 3명은 17장씩(1장 빼 둠), 4명은 13장씩
  all: { 2: 18, 3: 17, 4: 13 },
  quick: { 2: 10, 3: 9, 4: 8 },
};

const MAX_LOG = 80;

type EventInput = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'id'> : never) : never;

export function playerName(player: Player): string {
  return player.name || SEAT_COLORS[player.seat].name;
}

/** K 다음은 A */
export function nextRank(rank: number): number {
  return (rank % 13) + 1;
}

/** 우리말로 세는 장수: 한 장, 두 장, 세 장, 네 장 */
export function countWord(n: number): string {
  return ['', '한 장', '두 장', '세 장', '네 장'][n] ?? `${n}장`;
}

/** 말하는 내용: "7 두 장!" */
export function claimText(rank: number, count: number): string {
  return `${rankLabel(rank)} ${countWord(count)}!`;
}

/** '7을', 'A를' (숫자를 우리말로 읽었을 때 받침 기준: 에이, 투…, 잭·퀸·킹은 받침) */
export function rankWithObject(rank: number): string {
  const batchim = [3, 6, 7, 8, 10, 11, 12, 13].includes(rank);
  return `${rankLabel(rank)}${batchim ? '을' : '를'}`;
}

function emptyStats(): PlayerStats {
  return { plays: 0, lies: 0, caught: 0, doubts: 0, rightDoubts: 0, pickups: 0 };
}

function nameOf(s: CheatState, index: number): string {
  return playerName(s.players[index]);
}

function addLog(s: CheatState, seat: SeatIndex | null, text: string): void {
  s.log = [...s.log, { id: s.nextLogId, seat, text }].slice(-MAX_LOG);
  s.nextLogId += 1;
}

function emit(s: CheatState, event: EventInput): void {
  s.events.push({ ...event, id: s.nextEventId } as GameEvent);
  s.nextEventId += 1;
}

function draft(state: CheatState): CheatState {
  const s = structuredClone(state);
  s.events = [];
  return s;
}

/** 다음 자리 */
export function nextSeat(state: Pick<CheatState, 'players'>, from: number): number {
  return (from + 1) % state.players.length;
}

/** 카드를 낸 사람 다음부터 '거짓말!'을 외칠 수 있는 사람들 */
export function doubtQueue(state: Pick<CheatState, 'players' | 'options'>, claimant: number): number[] {
  const n = state.players.length;
  const all = Array.from({ length: n - 1 }, (_, k) => (claimant + 1 + k) % n);
  return state.options.doubt === 'next' ? all.slice(0, 1) : all;
}

/** 지금 무언가를 정해야 하는 사람: 카드를 낼 사람 또는 의심할지 정할 사람. 끝났으면 -1 */
export function actor(state: CheatState): number {
  if (state.phase === 'play') return state.current;
  if (state.phase === 'doubt') return state.doubters[0] ?? -1;
  return -1;
}

/** player가 앞으로 차례가 올 때마다 낼 숫자 (지금 숫자에서 몇 번째 뒤인지 기준) */
export function upcomingRanks(state: Pick<CheatState, 'players' | 'rank' | 'current' | 'phase'>, player: number, count = 3): number[] {
  const n = state.players.length;
  // play 단계면 current가 지금 rank를 낸다. doubt 단계면 rank는 current 다음 사람이 낼 숫자
  const base = state.phase === 'doubt' ? nextSeat(state, state.current) : state.current;
  const offset = (player - base + n) % n;
  const out: number[] = [];
  for (let k = 0; k < count; k++) out.push(((state.rank - 1 + offset + k * n) % 13) + 1);
  return out;
}

/** 거짓말인지: 낸 카드 중 하나라도 말한 숫자와 다르면 */
export function isLie(claim: Pick<Claim, 'cards' | 'rank'>): boolean {
  return claim.cards.some((c) => c.rank !== claim.rank);
}

/** 순위: 이긴 사람, 그다음은 손에 남은 카드가 적은 순서 (같으면 자리 순서) */
export function rankings(state: CheatState): number[] {
  const order = state.players.map((_, i) => i);
  return order.sort((a, b) => {
    if (a === state.winner) return -1;
    if (b === state.winner) return 1;
    return state.players[a].hand.length - state.players[b].hand.length || a - b;
  });
}

export function createGame(setup: CheatSetup, rng: Rng = Math.random): CheatState {
  const players: Player[] = [];
  setup.seats.forEach((seat, i) => {
    if (seat.kind === 'empty') return;
    players.push({
      seat: i as SeatIndex,
      kind: seat.kind,
      name: seat.name.trim() || SEAT_COLORS[i as SeatIndex].name,
      hand: [],
      stats: emptyStats(),
    });
  });
  if (players.length < 2) throw new Error('플레이어가 2명 이상 필요합니다.');
  const options: CheatOptions = { ...DEFAULT_OPTIONS, ...setup.options };
  const n = players.length;
  const per = DEAL_COUNTS[options.deal][n] ?? Math.floor(DECK_SIZE / n);
  const deck = shuffle(createDeck(), rng);
  const first = randomInt(n, rng);
  for (let k = 0; k < per * n; k++) players[(first + k) % n].hand.push(deck[k]);
  const aside = deck.slice(per * n);

  const s: CheatState = {
    players,
    options,
    phase: 'play',
    first,
    current: first,
    rank: 1,
    pile: [],
    claim: null,
    doubters: [],
    verdict: null,
    aside,
    winner: null,
    plays: 0,
    turn: 1,
    events: [],
    nextEventId: 1,
    log: [],
    nextLogId: 1,
  };
  emit(s, { type: 'deal', first, counts: players.map((p) => p.hand.length) });
  addLog(s, null, `카드를 ${per}장씩 나눠 줬어요.${aside.length > 0 ? ` (${aside.length}장은 아무도 모르게 빼 뒀어요)` : ''}`);
  addLog(s, players[first].seat, `${withJosa(nameOf(s, first), '이/가')} A부터 내요!`);
  return s;
}

function play(state: CheatState, action: Extract<CheatAction, { type: 'play' }>): CheatState {
  if (state.phase !== 'play') return state;
  const ids = action.cardIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_PLAY || new Set(ids).size !== ids.length) return state;
  const me = state.current;
  const hand = state.players[me].hand;
  if (!ids.every((id) => hand.some((c) => c.id === id))) return state;

  const s = draft(state);
  const p = s.players[me];
  const cards = ids.map((id) => p.hand.find((c) => c.id === id)!);
  p.hand = p.hand.filter((c) => !ids.includes(c.id));
  s.plays += 1;
  const claim: Claim = { id: s.plays, player: me, rank: s.rank, count: cards.length, cards };
  s.pile.push(...cards.map((card) => ({ card, by: me })));
  s.claim = claim;
  p.stats.plays += 1;
  if (isLie(claim)) p.stats.lies += 1;
  emit(s, { type: 'play', player: me, count: cards.length, rank: claim.rank, cardIds: ids });
  addLog(s, p.seat, `${nameOf(s, me)}: "${claimText(claim.rank, claim.count)}"${p.hand.length === 0 ? ' (마지막 카드!)' : ''}`);
  s.rank = nextRank(s.rank);
  s.phase = 'doubt';
  s.doubters = doubtQueue(s, me);
  s.verdict = null;
  s.turn += 1;
  return s;
}

/** 의심이 끝나고 다음 사람이 낼 차례로 (또는 마지막 카드가 통과되어 끝) */
function afterClaim(s: CheatState, claimant: number): void {
  s.claim = null;
  s.doubters = [];
  if (s.players[claimant].hand.length === 0) {
    s.phase = 'gameover';
    s.winner = claimant;
    emit(s, { type: 'win', player: claimant });
    addLog(s, s.players[claimant].seat, `🏆 ${withJosa(nameOf(s, claimant), '이/가')} 카드를 다 냈어요! 우승!`);
    return;
  }
  s.phase = 'play';
  s.current = nextSeat(s, claimant);
  s.turn += 1;
}

function doubt(state: CheatState, player: number): CheatState {
  if (state.phase !== 'doubt' || !state.claim || state.doubters[0] !== player) return state;
  const s = draft(state);
  const claim = s.claim!;
  const claimant = claim.player;
  const lie = isLie(claim);
  const taker = lie ? claimant : player;
  const taken = s.pile.length;
  const doubterName = nameOf(s, player);
  const claimantName = nameOf(s, claimant);

  emit(s, { type: 'doubt', doubter: player, claimant });
  addLog(s, s.players[player].seat, `${doubterName}: "거짓말!" 🤨`);
  emit(s, { type: 'reveal', claimant, lie, cards: claim.cards, rank: claim.rank });

  s.players[player].stats.doubts += 1;
  if (lie) {
    s.players[player].stats.rightDoubts += 1;
    s.players[claimant].stats.caught += 1;
    addLog(s, s.players[claimant].seat, `🤥 거짓말 들통! ${withJosa(claimantName, '이/가')} 더미 ${taken}장을 가져가요.`);
  } else {
    addLog(s, s.players[claimant].seat, `😇 진짜 ${rankLabel(claim.rank)}였어요! ${withJosa(doubterName, '이/가')} 더미 ${taken}장을 가져가요.`);
  }
  s.players[taker].hand.push(...s.pile.map((pc) => pc.card));
  s.players[taker].stats.pickups += 1;
  s.pile = [];
  emit(s, { type: 'pickup', player: taker, count: taken });
  s.verdict = { claim, result: lie ? 'lie' : 'truth', doubter: player, taker, taken };
  afterClaim(s, claimant);
  return s;
}

function pass(state: CheatState, player: number): CheatState {
  if (state.phase !== 'doubt' || !state.claim || state.doubters[0] !== player) return state;
  const s = draft(state);
  s.doubters = s.doubters.slice(1);
  emit(s, { type: 'pass', player });
  if (s.doubters.length > 0) {
    s.turn += 1;
    return s;
  }
  const claim = s.claim!;
  emit(s, { type: 'accepted', player: claim.player });
  s.verdict = { claim, result: 'accepted', doubter: null, taker: null, taken: 0 };
  afterClaim(s, claim.player);
  return s;
}

/**
 * 행동을 적용한 새 상태를 돌려준다. 할 수 없는 행동이면 원래 상태를 그대로 돌려준다.
 * (state는 바꾸지 않는다)
 */
export function applyAction(state: CheatState, action: CheatAction): CheatState {
  switch (action.type) {
    case 'play':
      return play(state, action);
    case 'doubt':
      return doubt(state, action.player);
    case 'pass':
      return pass(state, action.player);
  }
}

/** 카드가 모두 제자리에 있는지 (불러오기 검사·테스트용) */
export function allCards(state: CheatState): Card[] {
  return [...state.aside, ...state.pile.map((pc) => pc.card), ...state.players.flatMap((p) => p.hand)];
}
