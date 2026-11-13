import { withJosa } from '../../lib/korean';
import { shuffle } from '../../lib/random';
import { SEAT_COLORS } from '../common/players';
import { boardDims, pictureName, themePictures } from './themes';
import type { GameEvent, MemoryAction, MemoryCard, MemoryOptions, MemorySetup, MemoryState, Player, Rng, SeatIndex, ThemeId, BoardSize } from './types';

export const DEFAULT_OPTIONS: MemoryOptions = {
  size: '4x4',
  theme: 'animals',
  extraTurn: true,
  peek: false,
  showNames: true,
};

const MAX_LOG = 60;

type EventInput = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'id'> : never) : never;

export function playerName(player: Player): string {
  return player.name || SEAT_COLORS[player.seat].name;
}

/** 낱말 뒤에 '와/과'를 받침에 맞게 붙인다. (예: 케이블카와, 당근과) */
export function withAnd(word: string): string {
  return withJosa(word, '와/과');
}

function nameOf(s: MemoryState, index: number): string {
  return playerName(s.players[index]);
}

function addLog(s: MemoryState, seat: SeatIndex | null, text: string): void {
  s.log = [...s.log, { id: s.nextLogId, seat, text }].slice(-MAX_LOG);
  s.nextLogId += 1;
}

function emit(s: MemoryState, event: EventInput): void {
  s.events.push({ ...event, id: s.nextEventId } as GameEvent);
  s.nextEventId += 1;
}

/** 상태를 복사해서 마음 놓고 고칠 수 있게 한다. (카드 36장이라 가볍다) */
function draft(state: MemoryState): MemoryState {
  const s = structuredClone(state);
  s.events = [];
  return s;
}

/**
 * 판 크기와 그림 묶음으로 카드를 만들어 섞는다. 그림마다 정확히 두 장, id는 0부터 자리 순서.
 * 그림이 필요한 짝보다 많으면 무작위로 골라 쓴다.
 */
export function createDeck(size: BoardSize, theme: ThemeId, rng: Rng = Math.random): MemoryCard[] {
  const { pairs } = boardDims(size);
  const pics = shuffle(themePictures(theme), rng).slice(0, pairs);
  if (pics.length < pairs) throw new Error('그림이 모자라요.');
  const faces = shuffle([...pics, ...pics], rng);
  return faces.map((pic, id) => ({ id, pic, matchedBy: null }));
}

export function createGame(setup: MemorySetup, rng: Rng = Math.random): MemoryState {
  const options: MemoryOptions = { ...DEFAULT_OPTIONS, ...setup.options };
  const players: Player[] = [];
  setup.seats.forEach((seat, i) => {
    if (seat.kind === 'empty') return;
    players.push({ seat: i as SeatIndex, kind: seat.kind, name: seat.name.trim() || SEAT_COLORS[i as SeatIndex].name, pairs: [] });
  });
  if (players.length < 2) throw new Error('플레이어가 2명 이상 필요합니다.');
  const { rows, cols } = boardDims(options.size);
  const cards = createDeck(options.size, options.theme, rng);
  const starter = Math.min(players.length - 1, Math.floor(rng() * players.length));
  const s: MemoryState = {
    players,
    options,
    rows,
    cols,
    cards,
    faceUp: [],
    seen: {},
    reveals: 0,
    current: starter,
    phase: options.peek ? 'peek' : 'play',
    turn: 1,
    attempt: 1,
    streak: 0,
    ranks: [],
    events: [],
    nextEventId: 1,
    log: [],
    nextLogId: 1,
  };
  emit(s, { type: 'deal' });
  if (options.peek) addLog(s, null, '카드를 잠깐 모두 보여 줄게요. 잘 기억해 두세요!');
  addLog(s, players[starter].seat, `${withJosa(playerName(players[starter]), '이/가')} 먼저 시작해요.`);
  return s;
}

/** 아직 짝을 못 찾은 카드 수 */
export function remainingPairs(state: MemoryState): number {
  return state.cards.filter((c) => c.matchedBy === null).length / 2;
}

export function totalPairs(state: MemoryState): number {
  return state.cards.length / 2;
}

/** 지금 이 카드를 뒤집을 수 있는지 (차례인 사람 기준) */
export function canFlip(state: MemoryState, cardId: number): boolean {
  if (state.phase !== 'play' || state.faceUp.length >= 2) return false;
  const card = state.cards[cardId];
  return !!card && card.id === cardId && card.matchedBy === null && !state.faceUp.includes(cardId);
}

/** 뒤집을 수 있는 카드 id 목록 */
export function flippableIds(state: MemoryState): number[] {
  if (state.phase !== 'play' || state.faceUp.length >= 2) return [];
  return state.cards.filter((c) => c.matchedBy === null && !state.faceUp.includes(c.id)).map((c) => c.id);
}

/**
 * 짝 수로 등수를 매긴다 (1등부터). 짝 수가 같으면 같은 등수이고 다음 등수는 건너뛴다. 예: 5,5,3 → 1,1,3
 */
export function computeRanks(pairCounts: number[]): number[] {
  return pairCounts.map((n) => 1 + pairCounts.filter((m) => m > n).length);
}

/** 등수 순서로 늘어놓은 players 인덱스 (같은 등수는 자리 순서) */
export function rankingOrder(state: MemoryState): number[] {
  const ranks = state.ranks.length === state.players.length ? state.ranks : computeRanks(state.players.map((p) => p.pairs.length));
  return state.players.map((_, i) => i).sort((a, b) => ranks[a] - ranks[b] || a - b);
}

/** 1등인 사람들 (여럿이면 공동 우승) */
export function winners(state: MemoryState): number[] {
  const ranks = computeRanks(state.players.map((p) => p.pairs.length));
  return state.players.map((_, i) => i).filter((i) => ranks[i] === 1);
}

function nextTurn(s: MemoryState): void {
  s.current = (s.current + 1) % s.players.length;
  s.turn += 1;
  s.attempt += 1;
  s.streak = 0;
  emit(s, { type: 'turn', player: s.current });
}

function finish(s: MemoryState): void {
  s.phase = 'gameover';
  s.ranks = computeRanks(s.players.map((p) => p.pairs.length));
  emit(s, { type: 'end' });
  const top = winners(s);
  const most = s.players[top[0]].pairs.length;
  if (top.length === 1) addLog(s, s.players[top[0]].seat, `🏆 ${withJosa(nameOf(s, top[0]), '이/가')} 짝 ${most}개로 우승했어요!`);
  else addLog(s, null, `🏆 ${top.map((i) => nameOf(s, i)).join(' · ')} 공동 우승! (짝 ${most}개씩)`);
}

function flip(state: MemoryState, cardId: number): MemoryState {
  if (!canFlip(state, cardId)) return state;
  const s = draft(state);
  const me = s.current;
  const card = s.cards[cardId];
  s.faceUp.push(cardId);
  s.seen[cardId] = { pic: card.pic, at: s.reveals };
  s.reveals += 1;
  emit(s, { type: 'flip', player: me, cardId, pic: card.pic });
  if (s.faceUp.length < 2) return s;

  const [a, b] = s.faceUp as [number, number];
  const seat = s.players[me].seat;
  const name = nameOf(s, me);
  if (s.cards[a].pic === s.cards[b].pic) {
    const pic = s.cards[a].pic;
    s.cards[a].matchedBy = me;
    s.cards[b].matchedBy = me;
    s.players[me].pairs.push(pic);
    delete s.seen[a];
    delete s.seen[b];
    s.faceUp = [];
    s.streak += 1;
    const over = s.cards.every((c) => c.matchedBy !== null);
    const again = !over && s.options.extraTurn;
    emit(s, { type: 'match', player: me, cardIds: [a, b], pic, again });
    addLog(s, seat, `${withJosa(name, '이/가')} ${pictureName(pic)} 짝을 찾았어요!${again ? ' 한 번 더!' : ''}`);
    if (over) finish(s);
    else if (again) s.attempt += 1;
    else nextTurn(s);
  } else {
    s.phase = 'mismatch';
    emit(s, { type: 'mismatch', player: me, cardIds: [a, b] });
    addLog(s, seat, `${name}: ${withAnd(pictureName(s.cards[a].pic))} ${pictureName(s.cards[b].pic)}, 짝이 아니에요.`);
  }
  return s;
}

/**
 * 행동을 적용한 새 상태를 돌려준다. 할 수 없는 행동이면 원래 상태를 그대로 돌려준다.
 * (state는 바꾸지 않는다)
 */
export function applyAction(state: MemoryState, action: MemoryAction): MemoryState {
  switch (action.type) {
    case 'flip':
      return flip(state, action.cardId);
    case 'hide': {
      if (state.phase !== 'mismatch') return state;
      const s = draft(state);
      emit(s, { type: 'hide', cardIds: s.faceUp });
      s.faceUp = [];
      s.phase = 'play';
      nextTurn(s);
      return s;
    }
    case 'startPlay': {
      if (state.phase !== 'peek') return state;
      const s = draft(state);
      // 모두 함께 슬쩍 본 것이므로 컴퓨터 기억에도 '슬쩍 봄'으로 남긴다.
      for (const c of s.cards) s.seen[c.id] = { pic: c.pic, at: s.reveals, glance: true };
      s.phase = 'play';
      emit(s, { type: 'peekEnd' });
      addLog(s, s.players[s.current].seat, `이제 시작! ${nameOf(s, s.current)} 차례예요.`);
      return s;
    }
  }
}
