import { withJosa } from '../../lib/korean';
import { SEAT_COLORS, type SeatIndex } from '../common/players';
import {
  BOARD_LENGTH,
  LEVEL_NAMES,
  MAX_LEVEL,
  PLANE_SQUARE,
  SQUARES,
  START,
  STUCK_SQUARE,
  STUCK_TURNS,
  buildCost,
  propertyValue,
  rentFor,
} from './board';
import { CARDS, CARD_IDS } from './cards';
import type { Property, Rng, WPlayer, WorldAction, WorldOptions, WorldSetup, WorldState } from './types';

export const DEFAULT_OPTIONS: WorldOptions = {
  startCash: 1500,
  salary: 200,
  endMode: 'rounds',
  maxRounds: 20,
};

const MAX_LOG = 80;

// ---------------------------------------------------------------- 도우미

function clone(state: WorldState): WorldState {
  return structuredClone(state);
}

function log(d: WorldState, seat: SeatIndex | null, text: string): void {
  d.log.push({ id: d.nextLogId++, seat, text });
  if (d.log.length > MAX_LOG) d.log.splice(0, d.log.length - MAX_LOG);
}

function coins(n: number): string {
  return `${n.toLocaleString('ko-KR')}코인`;
}

/** 게임 상태에 저장되는 난수 (mulberry32) */
function nextRandom(d: WorldState): number {
  d.seed = (d.seed + 0x6d2b79f5) >>> 0;
  let t = d.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shuffleDeck(d: WorldState): void {
  const deck = [...CARD_IDS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(d) * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  d.deck = deck;
  d.deckIndex = 0;
}

export function playerName(p: WPlayer): string {
  return p.name || SEAT_COLORS[p.seat].name;
}

export function isActive(p: WPlayer): boolean {
  return !p.bankrupt;
}

export function ownedSquares(state: WorldState, playerIndex: number): number[] {
  return state.properties.flatMap((prop, i) => (prop && prop.owner === playerIndex ? [i] : []));
}

export function rentAt(state: WorldState, index: number): number {
  const prop = state.properties[index];
  if (!prop) return 0;
  return rentFor(SQUARES[index], prop.level, state.festivalSquare === index);
}

export function totalAssets(state: WorldState, playerIndex: number): number {
  const p = state.players[playerIndex];
  if (p.bankrupt) return 0;
  return ownedSquares(state, playerIndex).reduce(
    (sum, i) => sum + propertyValue(SQUARES[i], state.properties[i]!.level),
    p.cash,
  );
}

// ---------------------------------------------------------------- 시작

export function createGame(setup: WorldSetup, rng: Rng = Math.random): WorldState {
  const seated: WPlayer[] = [];
  setup.seats.forEach((seat, i) => {
    if (seat.kind === 'empty') return;
    seated.push({
      seat: i as SeatIndex,
      kind: seat.kind,
      name: seat.name.trim() || SEAT_COLORS[i as SeatIndex].name,
      cash: setup.options.startCash,
      position: START,
      stuckTurns: 0,
      bankrupt: false,
      escapeCards: 0,
      freePasses: 0,
    });
  });
  if (seated.length < 2) throw new Error('플레이어가 2명 이상 필요합니다.');

  // 첫 차례를 정하고, 그 사람이 0번이 되도록 순서를 돌린다 (라운드 계산을 공평하게).
  const first = Math.min(seated.length - 1, Math.floor(rng() * seated.length));
  const players = [...seated.slice(first), ...seated.slice(0, first)];

  const d: WorldState = {
    players,
    properties: SQUARES.map((sq) => (sq.kind === 'city' ? ({ owner: null, level: 0 } satisfies Property) : null)),
    options: { ...setup.options },
    current: 0,
    phase: 'rolling',
    dice: null,
    doublesInRow: 0,
    extraRoll: false,
    round: 1,
    festivalSquare: null,
    pendingCard: null,
    deck: [],
    deckIndex: 0,
    seed: Math.floor(rng() * 4294967296) >>> 0,
    bankruptOrder: [],
    rankings: [],
    log: [],
    nextLogId: 1,
    lastMove: null,
  };
  shuffleDeck(d);
  log(d, players[0].seat, `${playerName(players[0])}부터 시작합니다. 모두 ${coins(setup.options.startCash)}씩 가지고 출발!`);
  return d;
}

// ---------------------------------------------------------------- 이동

function moveForward(d: WorldState, pi: number, steps: number): void {
  const p = d.players[pi];
  const path: number[] = [];
  for (let i = 0; i < steps; i++) {
    p.position = (p.position + 1) % BOARD_LENGTH;
    path.push(p.position);
    if (p.position === START) paySalary(d, pi);
  }
  d.lastMove = { playerIndex: pi, path };
}

function moveBackward(d: WorldState, pi: number, steps: number): void {
  const p = d.players[pi];
  const path: number[] = [];
  for (let i = 0; i < steps; i++) {
    p.position = (p.position - 1 + BOARD_LENGTH) % BOARD_LENGTH;
    path.push(p.position);
  }
  d.lastMove = { playerIndex: pi, path };
}

/** 순간이동. salary가 true면 앞으로 가다가 출발 칸을 지나는 경우 월급을 준다. */
function jumpTo(d: WorldState, pi: number, target: number, salary: boolean): void {
  const p = d.players[pi];
  const passesStart = target <= p.position || target === START;
  p.position = target;
  d.lastMove = { playerIndex: pi, path: [target] };
  if (salary && passesStart) paySalary(d, pi);
}

function paySalary(d: WorldState, pi: number): void {
  const p = d.players[pi];
  p.cash += d.options.salary;
  log(d, p.seat, `${playerName(p)}: 출발 칸을 지나 월급 ${coins(d.options.salary)}!`);
}

function sendToStuck(d: WorldState, pi: number): void {
  const p = d.players[pi];
  p.position = STUCK_SQUARE;
  p.stuckTurns = STUCK_TURNS;
  d.lastMove = { playerIndex: pi, path: [STUCK_SQUARE] };
  d.extraRoll = false;
  log(d, p.seat, `🛂 ${playerName(p)}: 여권 분실! ${STUCK_TURNS}번 쉬어요.`);
}

// ---------------------------------------------------------------- 돈

/** 돈을 낸다. 모자라면 건물·땅을 팔고, 그래도 모자라면 파산. */
function charge(d: WorldState, pi: number, amount: number, creditor: number | null, reason: string): void {
  const p = d.players[pi];
  if (amount <= 0 || p.bankrupt) return;
  if (p.cash < amount) liquidate(d, pi, amount);
  const to = creditor === null ? '' : ` → ${playerName(d.players[creditor])}`;
  if (p.cash >= amount) {
    p.cash -= amount;
    if (creditor !== null) d.players[creditor].cash += amount;
    log(d, p.seat, `${playerName(p)}: ${reason} ${coins(amount)}${to}`);
    return;
  }
  const paid = p.cash;
  p.cash = 0;
  if (creditor !== null) d.players[creditor].cash += paid;
  p.bankrupt = true;
  p.stuckTurns = 0;
  d.bankruptOrder.push(pi);
  d.properties.forEach((prop, i) => {
    if (prop && prop.owner === pi) {
      prop.owner = null;
      prop.level = 0;
      if (d.festivalSquare === i) d.festivalSquare = null;
    }
  });
  log(d, p.seat, `💥 ${playerName(p)} 파산! (${reason} ${coins(amount)}을 낼 수 없어요)`);
  checkGameEnd(d);
}

function liquidate(d: WorldState, pi: number, needed: number): void {
  const p = d.players[pi];
  let raised = 0;
  while (p.cash < needed) {
    const mine = ownedSquares(d, pi);
    const built = mine.filter((i) => d.properties[i]!.level > 0).sort((a, b) => buildCost(SQUARES[a]) - buildCost(SQUARES[b]));
    let refund: number;
    if (built.length > 0) {
      const i = built[0];
      d.properties[i]!.level -= 1;
      refund = Math.floor(buildCost(SQUARES[i]) / 2);
    } else if (mine.length > 0) {
      const i = mine.sort((a, b) => SQUARES[a].price! - SQUARES[b].price!)[0];
      d.properties[i] = { owner: null, level: 0 };
      if (d.festivalSquare === i) d.festivalSquare = null;
      refund = Math.floor(SQUARES[i].price! / 2);
    } else {
      break;
    }
    p.cash += refund;
    raised += refund;
  }
  if (raised > 0) log(d, p.seat, `${playerName(p)}: 돈이 모자라 건물·땅을 팔아 ${coins(raised)}을 마련했어요.`);
}

// ---------------------------------------------------------------- 차례

function checkGameEnd(d: WorldState): void {
  const active = d.players.filter(isActive).length;
  if (active <= 1 || d.options.endMode === 'first-bankrupt') endGame(d);
}

function endGame(d: WorldState): void {
  const alive = d.players
    .map((_, i) => i)
    .filter((i) => !d.players[i].bankrupt)
    .sort((a, b) => totalAssets(d, b) - totalAssets(d, a));
  d.rankings = [...alive, ...[...d.bankruptOrder].reverse()];
  d.phase = 'gameover';
  d.pendingCard = null;
  const winner = d.players[d.rankings[0]];
  log(d, winner.seat, `🏆 ${playerName(winner)} 우승! (총자산 ${coins(totalAssets(d, d.rankings[0]))})`);
}

function nextTurn(d: WorldState): void {
  const n = d.players.length;
  let next = d.current;
  for (let step = 1; step <= n; step++) {
    const j = (d.current + step) % n;
    if (!d.players[j].bankrupt) {
      next = j;
      break;
    }
  }
  if (next <= d.current) {
    if (d.options.endMode === 'rounds' && d.round >= d.options.maxRounds) {
      log(d, null, `${d.options.maxRounds}라운드가 끝났어요! 총자산으로 순위를 정해요.`);
      endGame(d);
      return;
    }
    d.round += 1;
  }
  d.current = next;
  d.phase = 'rolling';
  d.doublesInRow = 0;
  d.extraRoll = false;
  d.pendingCard = null;
}

/** 한 행동이 끝났을 때: 더블이면 같은 사람이 한 번 더, 아니면 다음 사람 */
function finishAction(d: WorldState): void {
  if (d.phase === 'gameover') return;
  const p = d.players[d.current];
  d.pendingCard = null;
  if (!p.bankrupt && d.extraRoll && p.stuckTurns === 0) {
    d.extraRoll = false;
    d.phase = 'rolling';
    log(d, p.seat, '더블! 한 번 더 굴려요.');
    return;
  }
  nextTurn(d);
}

// ---------------------------------------------------------------- 도착

function ownsAnyCity(d: WorldState, pi: number): boolean {
  return ownedSquares(d, pi).length > 0;
}

function resolveLanding(d: WorldState): void {
  const pi = d.current;
  const p = d.players[pi];
  const sq = SQUARES[p.position];
  const name = playerName(p);

  switch (sq.kind) {
    case 'start':
      return finishAction(d);
    case 'city': {
      const prop = d.properties[sq.index]!;
      if (prop.owner === null) {
        if (p.cash >= sq.price!) {
          d.phase = 'buy';
          return;
        }
        log(d, p.seat, `${name}: ${sq.name}에 왔지만 돈이 모자라 살 수 없어요.`);
        return finishAction(d);
      }
      if (prop.owner === pi) {
        if (prop.level < MAX_LEVEL && p.cash >= buildCost(sq)) {
          d.phase = 'build';
          return;
        }
        log(d, p.seat, `${name}: 내 도시 ${sq.name}에 도착했어요.`);
        return finishAction(d);
      }
      const rent = rentAt(d, sq.index);
      if (p.freePasses > 0) {
        p.freePasses -= 1;
        log(d, p.seat, `🎫 ${name}: 무료 통행권으로 ${sq.name} 통행료 ${coins(rent)}을 안 냈어요!`);
      } else {
        charge(d, pi, rent, prop.owner, `${sq.name} 통행료`);
      }
      return finishAction(d);
    }
    case 'card': {
      if (d.deckIndex >= d.deck.length) shuffleDeck(d);
      d.pendingCard = d.deck[d.deckIndex++];
      d.phase = 'card';
      log(d, p.seat, `${name}: 여행 카드 「${CARDS[d.pendingCard].title}」`);
      return;
    }
    case 'tax':
      charge(d, pi, sq.tax!, null, sq.name);
      return finishAction(d);
    case 'stuck':
      p.stuckTurns = STUCK_TURNS;
      d.extraRoll = false;
      log(d, p.seat, `🛂 ${name}: 여권 분실! ${STUCK_TURNS}번 쉬어요.`);
      return finishAction(d);
    case 'festival':
      if (ownsAnyCity(d, pi)) {
        d.phase = 'select-festival';
        return;
      }
      log(d, p.seat, `${name}: 세계 축제에 왔지만 축제를 열 도시가 없어요.`);
      return finishAction(d);
    case 'plane':
      d.phase = 'select-plane';
      return;
  }
}

// ---------------------------------------------------------------- 행동 (UI·컴퓨터가 부르는 함수)

export function applyRoll(state: WorldState, a: number, b: number): WorldState {
  if (state.phase !== 'rolling') return state;
  const d = clone(state);
  const pi = d.current;
  const p = d.players[pi];
  const doubles = a === b;
  d.dice = [a, b];
  d.lastMove = null;
  log(d, p.seat, `${playerName(p)}: 🎲 ${a} + ${b} = ${a + b}${doubles ? ' (더블!)' : ''}`);

  if (p.stuckTurns > 0) {
    if (p.escapeCards > 0) {
      p.escapeCards -= 1;
      p.stuckTurns = 0;
      log(d, p.seat, `📘 ${playerName(p)}: 여권 재발급 카드로 바로 출발!`);
    } else if (doubles) {
      p.stuckTurns = 0;
      d.doublesInRow = 0;
      d.extraRoll = false;
      log(d, p.seat, `${playerName(p)}: 더블이 나와서 여권 분실 칸을 탈출!`);
      moveForward(d, pi, a + b);
      resolveLanding(d);
      return d;
    } else {
      p.stuckTurns -= 1;
      log(
        d,
        p.seat,
        p.stuckTurns > 0
          ? `${playerName(p)}: 아직 여권이 없어요. ${p.stuckTurns}번 더 쉬어요.`
          : `${playerName(p)}: 여권을 다시 받았어요! 다음 차례에 출발해요.`,
      );
      d.extraRoll = false;
      finishAction(d);
      return d;
    }
  }

  d.doublesInRow = doubles ? d.doublesInRow + 1 : 0;
  if (d.doublesInRow >= 3) {
    log(d, p.seat, `더블이 세 번 연속! 너무 서두르다 여권을 잃어버렸어요.`);
    sendToStuck(d, pi);
    finishAction(d);
    return d;
  }
  d.extraRoll = doubles;
  moveForward(d, pi, a + b);
  resolveLanding(d);
  return d;
}

export interface BuyOption {
  levels: number;
  cost: number;
  affordable: boolean;
}

/** buy 단계: 땅만(0) ~ 호텔까지(3) 각각의 가격 */
export function buyOptions(state: WorldState): BuyOption[] {
  if (state.phase !== 'buy') return [];
  const p = state.players[state.current];
  const sq = SQUARES[p.position];
  return [0, 1, 2, 3].map((levels) => {
    const cost = sq.price! + buildCost(sq) * levels;
    return { levels, cost, affordable: p.cash >= cost };
  });
}

/** build 단계: 지금보다 1단계 ~ 호텔까지 각각의 비용 */
export function buildOptions(state: WorldState): BuyOption[] {
  if (state.phase !== 'build') return [];
  const p = state.players[state.current];
  const sq = SQUARES[p.position];
  const level = state.properties[sq.index]!.level;
  const options: BuyOption[] = [];
  for (let target = level + 1; target <= MAX_LEVEL; target++) {
    const cost = buildCost(sq) * (target - level);
    options.push({ levels: target, cost, affordable: p.cash >= cost });
  }
  return options;
}

/** 도시를 산다. levels: 함께 지을 건물 단계 (0 = 땅만) */
export function applyBuy(state: WorldState, levels: number): WorldState {
  const option = buyOptions(state).find((o) => o.levels === levels);
  if (!option || !option.affordable) return state;
  const d = clone(state);
  const p = d.players[d.current];
  const sq = SQUARES[p.position];
  p.cash -= option.cost;
  d.properties[sq.index] = { owner: d.current, level: levels };
  const what = levels === 0 ? '땅' : `땅과 ${LEVEL_NAMES[levels]}`;
  log(d, p.seat, `${playerName(p)}: ${sq.name}의 ${withJosa(what, '을/를')} 샀어요. (${coins(option.cost)})`);
  finishAction(d);
  return d;
}

/** 내 도시에 건물을 짓는다. targetLevel: 지은 뒤의 단계 */
export function applyBuild(state: WorldState, targetLevel: number): WorldState {
  const option = buildOptions(state).find((o) => o.levels === targetLevel);
  if (!option || !option.affordable) return state;
  const d = clone(state);
  const p = d.players[d.current];
  const sq = SQUARES[p.position];
  d.properties[sq.index]!.level = targetLevel;
  p.cash -= option.cost;
  log(d, p.seat, `${playerName(p)}: ${sq.name}에 ${withJosa(LEVEL_NAMES[targetLevel], '을/를')} 지었어요. (${coins(option.cost)})`);
  finishAction(d);
  return d;
}

/** 사지 않거나 짓지 않고 넘어간다. */
export function applyDecline(state: WorldState): WorldState {
  if (state.phase !== 'buy' && state.phase !== 'build') return state;
  const d = clone(state);
  const p = d.players[d.current];
  const sq = SQUARES[p.position];
  log(d, p.seat, `${playerName(p)}: ${sq.name}${state.phase === 'buy' ? '은(는) 사지 않았어요.' : '에 건물을 짓지 않았어요.'}`);
  finishAction(d);
  return d;
}

/** 여행 카드 내용을 확인하고 실행한다. */
export function applyCard(state: WorldState): WorldState {
  if (state.phase !== 'card' || !state.pendingCard) return state;
  const d = clone(state);
  const pi = d.current;
  const p = d.players[pi];
  const card = d.pendingCard!;
  d.pendingCard = null;
  d.lastMove = null;
  const name = playerName(p);

  const gain = (n: number, why: string) => {
    p.cash += n;
    log(d, p.seat, `${name}: ${why} +${coins(n)}`);
  };

  switch (card) {
    case 'lottery':
      gain(150, '복권 당첨');
      break;
    case 'photo':
      gain(100, '사진 공모전 상금');
      break;
    case 'refund':
      gain(50, '세금 환급');
      break;
    case 'birthday':
      d.players.forEach((q, qi) => {
        if (qi !== pi && !q.bankrupt && d.phase !== 'gameover') charge(d, qi, 30, pi, '생일 축하금');
      });
      break;
    case 'speeding':
      charge(d, pi, 60, null, '과속 벌금');
      break;
    case 'hospital':
      charge(d, pi, 100, null, '병원비');
      break;
    case 'souvenir':
      d.players.forEach((q, qi) => {
        if (qi !== pi && !q.bankrupt && !p.bankrupt && d.phase !== 'gameover') charge(d, pi, 20, qi, '기념품 값');
      });
      break;
    case 'repair': {
      const levels = ownedSquares(d, pi).reduce((sum, i) => sum + d.properties[i]!.level, 0);
      if (levels > 0) charge(d, pi, levels * 25, null, `건물 수리비 (${levels}단계)`);
      else log(d, p.seat, `${name}: 고칠 건물이 없어요.`);
      break;
    }
    case 'go-start':
      jumpTo(d, pi, START, true);
      break;
    case 'go-plane':
      jumpTo(d, pi, PLANE_SQUARE, true);
      d.phase = 'select-plane';
      return d;
    case 'go-stuck':
      sendToStuck(d, pi);
      break;
    case 'back3':
      moveBackward(d, pi, 3);
      resolveLanding(d);
      return d;
    case 'next-city': {
      let steps = 1;
      while (SQUARES[(p.position + steps) % BOARD_LENGTH].kind !== 'city') steps++;
      moveForward(d, pi, steps);
      resolveLanding(d);
      return d;
    }
    case 'escape':
      p.escapeCards += 1;
      log(d, p.seat, `${name}: 여권 재발급 카드를 챙겼어요.`);
      break;
    case 'free-pass':
      p.freePasses += 1;
      log(d, p.seat, `${name}: 무료 통행권을 챙겼어요.`);
      break;
    case 'festival':
      if (ownsAnyCity(d, pi)) {
        d.phase = 'select-festival';
        return d;
      }
      log(d, p.seat, `${name}: 축제를 열 도시가 없어요.`);
      break;
  }
  finishAction(d);
  return d;
}

/** 지금 판에서 고를 수 있는 칸 (축제 도시 / 비행기 목적지) */
export function selectableSquares(state: WorldState): number[] {
  if (state.phase === 'select-festival') return ownedSquares(state, state.current);
  if (state.phase === 'select-plane') return SQUARES.map((s) => s.index).filter((i) => i !== PLANE_SQUARE);
  return [];
}

export function applySelect(state: WorldState, index: number): WorldState {
  if (!selectableSquares(state).includes(index)) return state;
  const d = clone(state);
  const pi = d.current;
  const p = d.players[pi];
  if (d.phase === 'select-festival') {
    d.festivalSquare = index;
    log(d, p.seat, `🎉 ${playerName(p)}: ${SQUARES[index].name}에서 세계 축제를 열어요! 통행료 2배!`);
    finishAction(d);
    return d;
  }
  log(d, p.seat, `✈️ ${playerName(p)}: ${withJosa(SQUARES[index].name, '으로/로')} 날아가요.`);
  jumpTo(d, pi, index, true);
  resolveLanding(d);
  return d;
}

export function rollDie(rng: Rng = Math.random): number {
  return Math.min(6, Math.floor(rng() * 6) + 1);
}

/** 행동 하나를 적용한다. roll이면 dice가 필요하다. */
export function applyAction(state: WorldState, action: WorldAction, dice?: [number, number]): WorldState {
  switch (action.type) {
    case 'roll':
      return dice ? applyRoll(state, dice[0], dice[1]) : state;
    case 'buy':
      return applyBuy(state, action.levels);
    case 'build':
      return applyBuild(state, action.levels);
    case 'decline':
      return applyDecline(state);
    case 'card':
      return applyCard(state);
    case 'select':
      return applySelect(state, action.index);
  }
}
