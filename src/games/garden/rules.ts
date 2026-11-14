import { withJosa } from '../../lib/korean';
import { randomInt, shuffle } from '../../lib/random';
import { SEAT_COLORS } from '../common/players';
import { CARDS, GOALS, GOAL_IDS, RES, RES_EMOJI, RIBBON_POINTS, TOKENS, card, goalMet } from './cards';
import type {
  GameEvent,
  GardenAction,
  GardenOptions,
  GardenSetup,
  GardenState,
  LineId,
  Player,
  PlantCard,
  Res,
  ResCount,
  Rng,
  SeatIndex,
  Token,
  TokenCount,
} from './types';

export const DEFAULT_OPTIONS: GardenOptions = { target: 15, sale: true, ribbons: true };

/** 주머니: 자원마다 11개 + 꿀벌 2마리 */
export const BAG_PER_RES = 11;
export const BAG_BEES = 2;
/** 벌통의 꿀벌 */
export const HIVE_BEES = 6;
/** 차례가 끝날 때 바구니에 둘 수 있는 토큰 수 */
export const STORAGE_LIMIT = 10;
export const MARKET_SIZE = 6;
/** 시장 끝에서 떨이가 되는 장수 */
export const SALE_SLOTS = 2;
export const GREENHOUSE_SIZE = 2;
export const RIBBON_COUNT = 3;
export const LINES: LineId[] = ['r0', 'r1', 'r2', 'c0', 'c1', 'c2'];

const MAX_LOG = 90;

type EventInput = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'id'> : never) : never;

export const emptyTokens = (): TokenCount => ({ water: 0, sun: 0, seed: 0, compost: 0, bee: 0 });
export const tokenTotal = (t: Partial<TokenCount>): number => TOKENS.reduce((a, k) => a + (t[k] ?? 0), 0);

export function playerName(player: Pick<Player, 'name' | 'seat'>): string {
  return player.name || SEAT_COLORS[player.seat].name;
}

/** 줄 이름: '가로 2줄', '세로 1줄' */
export function lineLabel(line: LineId): string {
  return `${line[0] === 'r' ? '가로' : '세로'} ${Number(line[1]) + 1}줄`;
}

/** 줄에 들어 있는 칸 번호 (0~8, 가로줄 순서) */
export function lineCells(line: LineId): number[] {
  const k = Number(line[1]);
  return line[0] === 'r' ? [k * 3, k * 3 + 1, k * 3 + 2] : [k, k + 3, k + 6];
}

export function lineTokens(state: Pick<GardenState, 'field'>, line: LineId): Token[] {
  return lineCells(line)
    .map((i) => state.field[i])
    .filter((t): t is Token => t !== null);
}

export function tokensText(tokens: readonly Token[] | Partial<TokenCount>): string {
  const list: Token[] = Array.isArray(tokens) ? [...tokens] : TOKENS.flatMap((k) => Array.from({ length: (tokens as Partial<TokenCount>)[k] ?? 0 }, () => k));
  return list.map((t) => RES_EMOJI[t]).join('');
}

// ------------------------------------------------------------------ 점수와 생산

export function gardenCards(player: Pick<Player, 'garden'>): PlantCard[] {
  return player.garden.map(card);
}

/** 심은 식물이 만드는 자원 (식물을 살 때 그만큼 덜 낸다) */
export function production(player: Pick<Player, 'garden'>): ResCount {
  const out: ResCount = { water: 0, sun: 0, seed: 0, compost: 0 };
  for (const id of player.garden) out[card(id).produce] += 1;
  return out;
}

export function ribbonCount(state: Pick<GardenState, 'ribbons'>, index: number): number {
  return state.ribbons.filter((r) => r.owner === index).length;
}

export interface ScoreParts {
  plants: number;
  ribbons: number;
  bonus: number;
  total: number;
}

export function scoreParts(state: Pick<GardenState, 'players' | 'ribbons'>, index: number): ScoreParts {
  const p = state.players[index];
  const plants = p.garden.reduce((a, id) => a + card(id).points, 0);
  const ribbons = ribbonCount(state, index) * RIBBON_POINTS;
  return { plants, ribbons, bonus: p.bonusPoints, total: plants + ribbons + p.bonusPoints };
}

export function scoreOf(state: Pick<GardenState, 'players' | 'ribbons'>, index: number): number {
  return scoreParts(state, index).total;
}

// ------------------------------------------------------------------ 값 치르기

/** 꽃시장의 떨이 자리인지 (줄 맨 끝 두 장) */
export function isOnSale(state: Pick<GardenState, 'market' | 'options'>, cardId: number): boolean {
  if (!state.options.sale) return false;
  const i = state.market.indexOf(cardId);
  return i >= 0 && i >= state.market.length - SALE_SLOTS;
}

/** 생산으로 깎은 뒤의 값 */
export function effectiveCost(player: Pick<Player, 'garden'>, c: PlantCard): ResCount {
  const prod = production(player);
  const out = { ...c.cost };
  for (const r of RES) out[r] = Math.max(0, c.cost[r] - prod[r]);
  return out;
}

export interface Payment {
  /** 실제로 내는 토큰 (꿀벌 포함) */
  paid: TokenCount;
  /** 떨이로 하나 덜 낸 자원 */
  saleUsed: Res | null;
  /** 내야 하는 자원 (생산·떨이를 뺀 값) */
  due: ResCount;
}

/**
 * 이 식물을 심을 때 낼 토큰을 정한다. 가진 자원을 먼저 쓰고 모자라는 만큼 꿀벌로 낸다.
 * 떨이면 자원 하나를 덜 내는데, discount를 고르지 않으면 꿀벌을 아끼는 쪽으로 저절로 고른다.
 * 모자라서 살 수 없으면 null.
 */
export function payment(player: Pick<Player, 'garden' | 'tokens'>, c: PlantCard, onSale: boolean, discount?: Res): Payment | null {
  const due = effectiveCost(player, c);
  let saleUsed: Res | null = null;
  if (onSale) {
    const owed = RES.filter((r) => due[r] > 0);
    if (owed.length > 0) {
      if (discount && due[discount] > 0) saleUsed = discount;
      else {
        // 가장 많이 모자란 자원을 깎는다 (꿀벌을 아낀다). 모자란 게 없으면 가장 많이 내는 자원.
        let best = owed[0];
        let bestKey = -Infinity;
        for (const r of owed) {
          const key = (due[r] - player.tokens[r]) * 100 + due[r];
          if (key > bestKey) {
            bestKey = key;
            best = r;
          }
        }
        saleUsed = best;
      }
      due[saleUsed] -= 1;
    }
  }
  const paid = emptyTokens();
  let bees = 0;
  for (const r of RES) {
    paid[r] = Math.min(due[r], player.tokens[r]);
    bees += due[r] - paid[r];
  }
  if (bees > player.tokens.bee) return null;
  paid.bee = bees;
  return { paid, saleUsed, due };
}

/** 자원마다 모자란 개수 (꿀벌을 쓰기 전). 꿀벌이 이만큼을 메워 줄 수 있다. */
export function shortfall(player: Pick<Player, 'garden' | 'tokens'>, c: PlantCard, onSale: boolean): { missing: ResCount; total: number; short: number } {
  const due = effectiveCost(player, c);
  const missing: ResCount = { water: 0, sun: 0, seed: 0, compost: 0 };
  for (const r of RES) missing[r] = Math.max(0, due[r] - player.tokens[r]);
  if (onSale) {
    // 떨이는 모자란 자원을 먼저 깎는다 (payment와 같은 선택)
    let best: Res | null = null;
    for (const r of RES) if (missing[r] > 0 && (best === null || missing[r] > missing[best])) best = r;
    if (best) missing[best] -= 1;
  }
  const total = RES.reduce((a, r) => a + missing[r], 0);
  return { missing, total, short: Math.max(0, total - player.tokens.bee) };
}

/** 지금 차례인 사람이 이 식물을 심을 수 있는 곳 (시장 / 내 온실 / 없음) */
export function cardSource(state: GardenState, index: number, cardId: number): 'market' | 'greenhouse' | null {
  if (state.market.includes(cardId)) return 'market';
  if (state.players[index].greenhouse.includes(cardId)) return 'greenhouse';
  return null;
}

export function canPlant(state: GardenState, index: number, cardId: number): boolean {
  const src = cardSource(state, index, cardId);
  if (!src) return false;
  return payment(state.players[index], card(cardId), src === 'market' && isOnSale(state, cardId)) !== null;
}

/** 지금 할 수 있는 행동 (discard 단계 제외) */
export function legalActions(state: GardenState): GardenAction[] {
  if (state.phase !== 'play') return [];
  const out: GardenAction[] = [];
  const i = state.current;
  const p = state.players[i];
  for (const line of LINES) if (lineTokens(state, line).length > 0) out.push({ type: 'harvest', line });
  for (const id of [...state.market, ...p.greenhouse]) if (canPlant(state, i, id)) out.push({ type: 'plant', cardId: id });
  if (p.greenhouse.length < GREENHOUSE_SIZE) for (const id of state.market) out.push({ type: 'reserve', cardId: id });
  if (out.length === 0) out.push({ type: 'pass' });
  return out;
}

/** 바구니가 넘쳐서 돌려놓아야 하는 개수 */
export function discardNeed(state: GardenState): number {
  if (state.phase !== 'discard') return 0;
  return Math.max(0, tokenTotal(state.players[state.current].tokens) - STORAGE_LIMIT);
}

// ------------------------------------------------------------------ 준비

function nameOf(s: GardenState, index: number): string {
  return playerName(s.players[index]);
}

function addLog(s: GardenState, seat: SeatIndex | null, text: string): void {
  s.log = [...s.log, { id: s.nextLogId, seat, text }].slice(-MAX_LOG);
  s.nextLogId += 1;
}

function emit(s: GardenState, event: EventInput): void {
  s.events.push({ ...event, id: s.nextEventId } as GameEvent);
  s.nextEventId += 1;
}

/** 주머니에서 무작위로 하나 꺼낸다 (비었으면 null) */
function draw(bag: TokenCount, rng: Rng): Token | null {
  const total = tokenTotal(bag);
  if (total === 0) return null;
  let r = randomInt(total, rng);
  for (const t of TOKENS) {
    if (r < bag[t]) {
      bag[t] -= 1;
      return t;
    }
    r -= bag[t];
  }
  return null;
}

/** 빈칸을 주머니에서 채운다. 채운 칸 번호를 돌려준다. */
function refill(s: GardenState, rng: Rng): number[] {
  const filled: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (s.field[i] !== null) continue;
    const t = draw(s.bag, rng);
    if (t === null) break;
    s.field[i] = t;
    filled.push(i);
  }
  return filled;
}

/** 봄 더미를 여름 위에, 여름을 가을 위에 쌓는다 (계절마다 따로 섞음) */
export function buildDeck(rng: Rng): number[] {
  const bySeason = (season: number) =>
    shuffle(
      CARDS.filter((x) => x.season === season).map((x) => x.id),
      rng,
    );
  return [...bySeason(1), ...bySeason(2), ...bySeason(3)];
}

export function createGame(setup: GardenSetup, rng: Rng = Math.random): GardenState {
  const players: Player[] = [];
  setup.seats.forEach((seat, i) => {
    if (seat.kind === 'empty') return;
    players.push({
      seat: i as SeatIndex,
      kind: seat.kind,
      name: seat.name.trim(),
      tokens: emptyTokens(),
      garden: [],
      greenhouse: [],
      bonusPoints: 0,
    });
  });
  const deck = buildDeck(rng);
  const market = deck.splice(0, MARKET_SIZE);
  const goals = setup.options.ribbons ? shuffle(GOAL_IDS, rng).slice(0, RIBBON_COUNT) : [];
  const first = randomInt(players.length, rng);
  const s: GardenState = {
    players,
    options: { ...setup.options },
    phase: 'play',
    first,
    current: first,
    round: 1,
    turn: 1,
    field: Array.from({ length: 9 }, () => null),
    bag: { water: BAG_PER_RES, sun: BAG_PER_RES, seed: BAG_PER_RES, compost: BAG_PER_RES, bee: BAG_BEES },
    hive: HIVE_BEES,
    deck,
    market,
    wilted: [],
    ribbons: goals.map((goal) => ({ goal, owner: null })),
    endTriggered: false,
    passes: 0,
    winners: [],
    events: [],
    nextEventId: 1,
    log: [],
    nextLogId: 1,
  };
  refill(s, rng);
  addLog(s, null, `🌷 동네 꽃 박람회가 열렸어요! ${s.options.target}점에 먼저 닿으면 그 라운드를 마치고 끝나요.`);
  addLog(s, players[first].seat, `${withJosa(nameOf(s, first), '이/가')} 먼저 해요.`);
  return s;
}

// ------------------------------------------------------------------ 행동

function draft(state: GardenState): GardenState {
  const s = structuredClone(state);
  s.events = [];
  return s;
}

/** 시장에서 한 장이 빠지면 뒤(들어오는 쪽)의 카드가 앞으로 밀리고, 새 카드가 들어온다 */
function takeFromMarket(s: GardenState, cardId: number): number {
  const slot = s.market.indexOf(cardId);
  s.market.splice(slot, 1);
  const next = s.deck.shift();
  if (next !== undefined) {
    s.market.unshift(next);
    emit(s, { type: 'enter', cardId: next });
  }
  return slot;
}

function checkRibbons(s: GardenState, index: number): void {
  const cards = gardenCards(s.players[index]);
  for (const r of s.ribbons) {
    if (r.owner !== null || !goalMet(r.goal, cards)) continue;
    r.owner = index;
    emit(s, { type: 'ribbon', player: index, goal: r.goal });
    emit(s, { type: 'points', player: index, amount: RIBBON_POINTS, reason: 'ribbon' });
    addLog(s, s.players[index].seat, `🏵️ ${withJosa(nameOf(s, index), '이/가')} '${GOALS[r.goal].title}' 상장을 받았어요! (+${RIBBON_POINTS}점)`);
  }
}

function plant(s: GardenState, cardId: number, discount: Res | undefined): boolean {
  const i = s.current;
  const p = s.players[i];
  const src = cardSource(s, i, cardId);
  if (!src) return false;
  const c = card(cardId);
  const sale = src === 'market' && isOnSale(s, cardId);
  const pay = payment(p, c, sale, discount);
  if (!pay) return false;
  for (const t of TOKENS) {
    p.tokens[t] -= pay.paid[t];
    s.bag[t] += pay.paid[t];
  }
  let slot: number;
  if (src === 'market') {
    slot = s.market.indexOf(cardId);
    // 'plant' 이벤트를 먼저 내고, 새로 들어오는 카드는 그 뒤에
    emit(s, { type: 'plant', player: i, cardId, from: src, slot, paid: pay.paid, saleUsed: pay.saleUsed });
    takeFromMarket(s, cardId);
  } else {
    slot = p.greenhouse.indexOf(cardId);
    p.greenhouse.splice(slot, 1);
    emit(s, { type: 'plant', player: i, cardId, from: src, slot, paid: pay.paid, saleUsed: pay.saleUsed });
  }
  p.garden.push(cardId);
  const paidText = tokenTotal(pay.paid) > 0 ? `${tokensText(pay.paid)}을 내고 ` : '공짜로 ';
  const saleText = pay.saleUsed ? ` (떨이 ${RES_EMOJI[pay.saleUsed]} -1)` : '';
  const pts = c.points > 0 ? ` +${c.points}점` : '';
  addLog(s, p.seat, `${nameOf(s, i)}: ${paidText}${withJosa(c.name, '을/를')} 심었어요${saleText}.${pts}`);
  if (c.points > 0) emit(s, { type: 'points', player: i, amount: c.points, reason: 'plant' });

  if (c.bonus === 'water2') {
    const n = Math.min(2, s.bag.water);
    if (n > 0) {
      s.bag.water -= n;
      p.tokens.water += n;
      emit(s, { type: 'gain', player: i, tokens: { water: n }, reason: 'water2' });
      addLog(s, p.seat, `🚿 물뿌리개: ${withJosa(nameOf(s, i), '이/가')} 💧 ${n}개를 받았어요.`);
    }
  } else if (c.bonus === 'bee') {
    if (s.hive > 0) {
      s.hive -= 1;
      p.tokens.bee += 1;
      emit(s, { type: 'gain', player: i, tokens: { bee: 1 }, reason: 'bee' });
      addLog(s, p.seat, `🏠 새집: ${withJosa(nameOf(s, i), '이/가')} 🐝 꿀벌을 받았어요.`);
    }
  } else if (c.bonus === 'scarecrow') {
    const n = gardenCards(p).filter((x) => x.kind === 'veggie').length;
    p.bonusPoints += n;
    emit(s, { type: 'points', player: i, amount: n, reason: 'scarecrow' });
    addLog(s, p.seat, `🎃 허수아비: 채소 ${n}장이라서 ${withJosa(nameOf(s, i), '이/가')} ${n}점을 더 받았어요.`);
  }
  checkRibbons(s, i);
  return true;
}

function reserve(s: GardenState, cardId: number): boolean {
  const i = s.current;
  const p = s.players[i];
  if (!s.market.includes(cardId) || p.greenhouse.length >= GREENHOUSE_SIZE) return false;
  const slot = s.market.indexOf(cardId);
  const bee = s.hive > 0;
  emit(s, { type: 'reserve', player: i, cardId, slot, bee });
  takeFromMarket(s, cardId);
  p.greenhouse.push(cardId);
  if (bee) {
    s.hive -= 1;
    p.tokens.bee += 1;
  }
  addLog(s, p.seat, `${nameOf(s, i)}: ${withJosa(card(cardId).name, '을/를')} 온실에 맡겼어요.${bee ? ' 🐝 꿀벌 1마리!' : ' (벌통이 비었어요)'}`);
  return true;
}

function harvest(s: GardenState, line: LineId, rng: Rng): boolean {
  const i = s.current;
  const p = s.players[i];
  const cells = lineCells(line).filter((c) => s.field[c] !== null);
  if (cells.length === 0) return false;
  const tokens = cells.map((c) => s.field[c] as Token);
  for (const c of cells) s.field[c] = null;
  for (const t of tokens) p.tokens[t] += 1;
  emit(s, { type: 'harvest', player: i, line, cells, tokens });
  addLog(s, p.seat, `${nameOf(s, i)}: ${lineLabel(line)}에서 ${tokensText(tokens)}을 거뒀어요.`);
  const filled = refill(s, rng);
  if (filled.length > 0) emit(s, { type: 'refill', cells: filled });
  return true;
}

/** 이긴 사람: 점수가 가장 높고, 같으면 식물이 적은 사람. 그래도 같으면 함께 우승 */
export function findWinners(state: Pick<GardenState, 'players' | 'ribbons'>): number[] {
  const order = rankings(state);
  const top = order[0];
  const key = (i: number) => [scoreOf(state, i), -state.players[i].garden.length];
  const [ts, tp] = key(top);
  return order.filter((i) => {
    const [a, b] = key(i);
    return a === ts && b === tp;
  });
}

/** 순위 (점수 높은 순, 같으면 식물 적은 순, 그래도 같으면 자리 순) */
export function rankings(state: Pick<GardenState, 'players' | 'ribbons'>): number[] {
  return state.players
    .map((_, i) => i)
    .sort((a, b) => scoreOf(state, b) - scoreOf(state, a) || state.players[a].garden.length - state.players[b].garden.length || a - b);
}

function finishGame(s: GardenState, reason: string): void {
  s.phase = 'gameover';
  s.winners = findWinners(s);
  emit(s, { type: 'gameover', winners: s.winners });
  addLog(s, null, reason);
  const names = s.winners.map((w) => nameOf(s, w)).join(', ');
  addLog(s, s.winners.length === 1 ? s.players[s.winners[0]].seat : null, s.winners.length === 1 ? `🏆 ${names} 우승!` : `🏆 ${names} 함께 우승!`);
}

/** 한 사람의 차례를 마친다: 목표 점수 확인 → 다음 사람 (라운드 끝이면 시장의 맨 끝 카드가 시든다) */
function endTurn(s: GardenState): void {
  const i = s.current;
  const n = s.players.length;
  if (!s.endTriggered && scoreOf(s, i) >= s.options.target) {
    s.endTriggered = true;
    emit(s, { type: 'endTriggered', player: i });
    const left = (s.first - i - 1 + n) % n;
    addLog(
      s,
      s.players[i].seat,
      `🎯 ${withJosa(nameOf(s, i), '이/가')} ${s.options.target}점에 닿았어요! ${left > 0 ? '이번 라운드까지만 하고 끝나요.' : ''}`.trim(),
    );
  }
  const next = (i + 1) % n;
  s.phase = 'play';
  if (next === s.first) {
    if (s.endTriggered) return finishGame(s, '🏁 마지막 라운드가 끝났어요.');
    if (s.passes >= n) return finishGame(s, '🏁 아무도 할 수 있는 일이 없어서 박람회를 마쳐요.');
    // 라운드 끝: 줄 맨 끝 식물이 시들고, 모두 한 칸씩 밀리고, 새 식물이 들어온다
    const gone = s.market.pop();
    if (gone !== undefined) {
      s.wilted.push(gone);
      emit(s, { type: 'wilt', cardId: gone });
    }
    const fresh = s.deck.shift();
    if (fresh !== undefined) {
      s.market.unshift(fresh);
      emit(s, { type: 'enter', cardId: fresh });
    }
    if (gone !== undefined) addLog(s, null, `🥀 ${withJosa(card(gone).name, '이/가')} 시들었어요.${fresh !== undefined ? ` 새로 ${withJosa(card(fresh).name, '이/가')} 들어왔어요.` : ''}`);
    if (s.market.length === 0 && s.deck.length === 0) return finishGame(s, '🏁 꽃시장의 식물이 모두 떨어져서 박람회를 마쳐요.');
    s.round += 1;
    emit(s, { type: 'round', round: s.round });
  }
  s.current = next;
  s.turn += 1;
}

/** 행동 하나를 마친 뒤: 바구니가 넘치면 돌려놓기, 아니면 차례 끝 */
function afterAction(s: GardenState): void {
  if (tokenTotal(s.players[s.current].tokens) > STORAGE_LIMIT) {
    s.phase = 'discard';
    s.turn += 1;
    return;
  }
  endTurn(s);
}

/** 행동을 적용한 새 상태. 할 수 없는 행동이면 원래 상태를 그대로 돌려준다. */
export function applyAction(state: GardenState, action: GardenAction, rng: Rng = Math.random): GardenState {
  if (state.phase === 'gameover') return state;
  if (state.phase === 'discard') {
    if (action.type !== 'discard') return state;
    const p = state.players[state.current];
    const need = tokenTotal(p.tokens) - STORAGE_LIMIT;
    const back = action.tokens;
    if (TOKENS.some((t) => (back[t] ?? 0) < 0 || !Number.isInteger(back[t] ?? 0) || (back[t] ?? 0) > p.tokens[t])) return state;
    if (tokenTotal(back) !== need) return state;
    const s = draft(state);
    const q = s.players[s.current];
    for (const t of TOKENS) {
      q.tokens[t] -= back[t] ?? 0;
      s.bag[t] += back[t] ?? 0;
    }
    emit(s, { type: 'discard', player: s.current, tokens: back });
    addLog(s, q.seat, `${nameOf(s, s.current)}: 바구니가 넘쳐서 ${tokensText(back)}을 주머니에 돌려놓았어요.`);
    endTurn(s);
    return s;
  }

  const s = draft(state);
  let ok = false;
  switch (action.type) {
    case 'harvest':
      ok = LINES.includes(action.line) && harvest(s, action.line, rng);
      break;
    case 'plant':
      ok = plant(s, action.cardId, action.discount);
      break;
    case 'reserve':
      ok = reserve(s, action.cardId);
      break;
    case 'pass': {
      const legal = legalActions(state);
      ok = legal.length === 1 && legal[0].type === 'pass';
      if (ok) {
        s.passes += 1;
        emit(s, { type: 'pass', player: s.current });
        addLog(s, s.players[s.current].seat, `${withJosa(nameOf(s, s.current), '은/는')} 할 수 있는 일이 없어서 쉬어요.`);
        endTurn(s);
      }
      return ok ? s : state;
    }
    default:
      return state;
  }
  if (!ok) return state;
  s.passes = 0;
  afterAction(s);
  return s;
}

/** 넘친 토큰을 자동으로 고른다: 가장 많이 가진 자원부터, 꿀벌은 맨 나중에 */
export function autoDiscard(state: GardenState): Partial<TokenCount> {
  const p = state.players[state.current];
  let need = tokenTotal(p.tokens) - STORAGE_LIMIT;
  const left = { ...p.tokens };
  const back: Partial<TokenCount> = {};
  while (need > 0) {
    let pickRes: Token = 'bee';
    let most = 0;
    for (const r of RES) {
      if (left[r] > most) {
        most = left[r];
        pickRes = r;
      }
    }
    if (most === 0) pickRes = 'bee';
    left[pickRes] -= 1;
    back[pickRes] = (back[pickRes] ?? 0) + 1;
    need -= 1;
  }
  return back;
}

/** 진행 기록·화면에서 쓰는 '다음 차례' 정보 */
export function isLastRound(state: GardenState): boolean {
  return state.endTriggered && state.phase !== 'gameover';
}

/** 이 라운드에서 아직 차례가 남은 사람 수 (지금 사람 포함) */
export function turnsLeftInRound(state: GardenState): number {
  const n = state.players.length;
  return ((state.first - state.current + n - 1) % n) + 1;
}
