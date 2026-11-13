import { withJosa } from '../../lib/korean';
import { shuffle } from '../../lib/random';
import type { BaseballAction, BaseballOptions, BaseballPlayer, BaseballSetup, BaseballState, GameEvent, Guess, NoteMark, Rng, Side } from './types';

export const DEFAULT_OPTIONS: BaseballOptions = {
  mode: 'duel',
  length: 3,
  zero: false,
  fairFinish: true,
  helper: true,
};

/** 편 이름 (이름을 비워 두면 이것으로 부른다) */
export const SIDE_LABELS: Record<Side, string> = { 0: '파랑팀', 1: '빨강팀' };

/** 혼자 맞히기에서 숫자를 숨기는 컴퓨터 이름 */
export const HOST_NAME = '컴퓨터';

const MAX_LOG = 80;

type EventInput = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'id'> : never) : never;

export function other(side: Side): Side {
  return side === 0 ? 1 : 0;
}

/** 쓸 수 있는 숫자: 0~9 또는 1~9 */
export function digitPool(zero: boolean): number[] {
  return zero ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5, 6, 7, 8, 9];
}

/** 자릿수가 맞고, 쓸 수 있는 숫자만, 서로 다른 숫자인지 */
export function isValidCode(digits: unknown, options: Pick<BaseballOptions, 'length' | 'zero'>): digits is number[] {
  if (!Array.isArray(digits) || digits.length !== options.length) return false;
  const min = options.zero ? 0 : 1;
  if (!digits.every((d) => Number.isInteger(d) && d >= min && d <= 9)) return false;
  return new Set(digits).size === digits.length;
}

/** 스트라이크: 숫자와 자리가 모두 맞음, 볼: 숫자는 있지만 자리가 다름 */
export function judge(secret: readonly number[], guess: readonly number[]): { strikes: number; balls: number } {
  let strikes = 0;
  let common = 0;
  for (let i = 0; i < guess.length; i++) {
    if (secret[i] === guess[i]) strikes += 1;
    if (secret.includes(guess[i])) common += 1;
  }
  return { strikes, balls: common - strikes };
}

const codeCache = new Map<string, number[][]>();

/** 만들 수 있는 모든 비밀 숫자 (3자리 1~9: 504개, 4자리 0~9: 5040개) */
export function allCodes(length: number, zero: boolean): number[][] {
  const key = `${length}-${zero}`;
  const cached = codeCache.get(key);
  if (cached) return cached;
  const pool = digitPool(zero);
  const out: number[][] = [];
  const walk = (prefix: number[]) => {
    if (prefix.length === length) {
      out.push(prefix);
      return;
    }
    for (const d of pool) if (!prefix.includes(d)) walk([...prefix, d]);
  };
  walk([]);
  codeCache.set(key, out);
  return out;
}

/** code가 비밀 숫자라면 지금까지 친 결과가 모두 그대로 나왔을지 */
export function isConsistent(code: readonly number[], guesses: readonly Guess[]): boolean {
  return guesses.every((g) => {
    const r = judge(code, g.digits);
    return r.strikes === g.strikes && r.balls === g.balls;
  });
}

/** 지금까지의 결과로 보아 아직 비밀 숫자일 수 있는 것들 */
export function candidatesFor(guesses: readonly Guess[], options: Pick<BaseballOptions, 'length' | 'zero'>): number[][] {
  return allCodes(options.length, options.zero).filter((c) => isConsistent(c, guesses));
}

/** digits를 비밀 숫자로 보면 결과가 달라지는 앞의 결과들 (몇 번째인지, 0부터) */
export function conflictsWith(digits: readonly number[], guesses: readonly Guess[]): number[] {
  const out: number[] = [];
  guesses.forEach((g, i) => {
    const r = judge(digits, g.digits);
    if (r.strikes !== g.strikes || r.balls !== g.balls) out.push(i);
  });
  return out;
}

export function randomCode(options: Pick<BaseballOptions, 'length' | 'zero'>, rng: Rng = Math.random): number[] {
  return shuffle(digitPool(options.zero), rng).slice(0, options.length);
}

export function isHomerun(guess: Pick<Guess, 'strikes'>, length: number): boolean {
  return guess.strikes === length;
}

/** 전광판·기록용 짧은 결과: '아웃', '홈런', '1S 2B' */
export function resultShort(strikes: number, balls: number, length: number): string {
  if (strikes === length) return '홈런';
  if (strikes + balls === 0) return '아웃';
  return `${strikes}S ${balls}B`;
}

/** 말로 읽는 결과: '아웃!', '홈런!', '1스트라이크 2볼' */
export function resultText(strikes: number, balls: number, length: number): string {
  if (strikes === length) return '홈런!';
  if (strikes + balls === 0) return '아웃!';
  const parts: string[] = [];
  if (strikes > 0) parts.push(`${strikes}스트라이크`);
  if (balls > 0) parts.push(`${balls}볼`);
  return parts.join(' ');
}

export function codeText(digits: readonly number[]): string {
  return digits.join(' ');
}

export function playerName(state: BaseballState, side: Side): string {
  return state.players[side].name;
}

/**
 * 몇 번째 공격인지: 둘이서는 '3회초'(먼저 치는 편) / '3회말'(나중 편), 혼자서는 '3번째'.
 * index는 그 사람이 친 순서 (0부터)
 */
export function inningLabel(state: Pick<BaseballState, 'options'>, side: Side, index: number): string {
  if (state.options.mode === 'solo') return `${index + 1}번째`;
  return `${index + 1}회${side === 0 ? '초' : '말'}`;
}

/** 지금 치는 사람이 맞혀야 할 숫자를 가진 사람 (혼자 맞히기는 늘 컴퓨터) */
export function targetOf(state: Pick<BaseballState, 'options'>, side: Side): Side {
  return state.options.mode === 'solo' ? 1 : other(side);
}

function emptyNotes(): NoteMark[] {
  return Array.from({ length: 10 }, () => 0 as NoteMark);
}

function addLog(s: BaseballState, side: Side | null, text: string): void {
  s.log = [...s.log, { id: s.nextLogId, side, text }].slice(-MAX_LOG);
  s.nextLogId += 1;
}

function emit(s: BaseballState, event: EventInput): void {
  s.events.push({ ...event, id: s.nextEventId } as GameEvent);
  s.nextEventId += 1;
}

/** 상태를 통째로 복사해서 마음 놓고 고칠 수 있게 한다 (작아서 가볍다) */
function draft(state: BaseballState): BaseballState {
  const s = structuredClone(state);
  s.events = [];
  return s;
}

/** 아직 비밀 숫자를 정하지 않은 사람 (먼저 치는 편부터). 없으면 null */
function nextSetter(s: BaseballState): Side | null {
  for (const side of [0, 1] as Side[]) if (s.players[side].secret === null && s.players[side].kind === 'human' && !(s.options.mode === 'solo' && side === 0)) return side;
  return null;
}

function startPlay(s: BaseballState): void {
  s.phase = 'play';
  s.setting = null;
  s.current = 0;
  emit(s, { type: 'start' });
  if (s.options.mode === 'solo') {
    addLog(s, null, `⚾ ${HOST_NAME}가 ${s.options.length}자리 숫자를 숨겼어요. 맞혀 보세요!`);
  } else {
    addLog(s, null, `⚾ 플레이 볼! ${withJosa(s.players[0].name, '이/가')} 먼저 쳐요.`);
  }
}

export function createGame(setup: BaseballSetup, rng: Rng = Math.random): BaseballState {
  const options: BaseballOptions = { ...DEFAULT_OPTIONS, ...setup.options };
  const solo = options.mode === 'solo';
  const nameOf = (side: Side) => setup.seats[side].name.trim() || SIDE_LABELS[side];
  const players: [BaseballPlayer, BaseballPlayer] = solo
    ? [
        { kind: 'human', name: setup.seats[0].name.trim() || '나', secret: null, guesses: [], notes: emptyNotes() },
        { kind: 'ai-normal', name: HOST_NAME, secret: randomCode(options, rng), guesses: [], notes: emptyNotes() },
      ]
    : [
        { kind: setup.seats[0].kind, name: nameOf(0), secret: null, guesses: [], notes: emptyNotes() },
        { kind: setup.seats[1].kind, name: nameOf(1), secret: null, guesses: [], notes: emptyNotes() },
      ];
  if (!solo) {
    // 컴퓨터는 처음에 바로 숫자를 정한다.
    for (const p of players) if (p.kind !== 'human') p.secret = randomCode(options, rng);
  }
  const s: BaseballState = {
    options,
    players,
    phase: 'secret',
    setting: null,
    current: 0,
    lastChance: false,
    hits: [],
    winner: null,
    gaveUp: false,
    events: [],
    nextEventId: 1,
    log: [],
    nextLogId: 1,
  };
  s.setting = nextSetter(s);
  if (s.setting === null) startPlay(s);
  else addLog(s, null, `🤫 ${options.length}자리 비밀 숫자를 정해요. 같은 숫자는 두 번 쓸 수 없어요.`);
  return s;
}

function setSecret(state: BaseballState, action: Extract<BaseballAction, { type: 'secret' }>): BaseballState {
  if (state.phase !== 'secret' || state.setting !== action.player || !isValidCode(action.digits, state.options)) return state;
  const s = draft(state);
  s.players[action.player].secret = [...action.digits];
  emit(s, { type: 'secret', player: action.player });
  addLog(s, action.player, `${withJosa(s.players[action.player].name, '이/가')} 비밀 숫자를 정했어요.`);
  s.setting = nextSetter(s);
  if (s.setting === null) startPlay(s);
  return s;
}

/** 추리 도우미: 결과로 확실히 알게 된 것을 메모에 적는다 (사람이 이미 적은 칸은 그대로) */
function autoNotes(p: BaseballPlayer, guess: Guess, options: BaseballOptions): void {
  const total = guess.strikes + guess.balls;
  if (total === 0) {
    for (const d of guess.digits) if (p.notes[d] === 0) p.notes[d] = 2;
  } else if (total === options.length) {
    for (const d of digitPool(options.zero)) if (p.notes[d] === 0) p.notes[d] = guess.digits.includes(d) ? 1 : 2;
  }
}

function finish(s: BaseballState, winner: Side | null): void {
  s.phase = 'gameover';
  s.winner = winner;
  s.lastChance = false;
  emit(s, { type: 'end', winner });
  if (s.options.mode === 'solo') {
    if (winner === 0) addLog(s, 0, `🏆 ${s.players[0].guesses.length}번 만에 맞혔어요!`);
  } else if (winner === null) {
    addLog(s, null, '🤝 둘 다 같은 횟수에 맞혔어요. 무승부!');
  } else {
    addLog(s, winner, `🏆 ${withJosa(s.players[winner].name, '이/가')} 이겼어요!`);
  }
}

function guess(state: BaseballState, action: Extract<BaseballAction, { type: 'guess' }>): BaseballState {
  if (state.phase !== 'play' || !isValidCode(action.digits, state.options)) return state;
  const me = state.current;
  const secret = state.players[targetOf(state, me)].secret;
  if (!secret) return state;
  const s = draft(state);
  const p = s.players[me];
  const { strikes, balls } = judge(secret, action.digits);
  const g: Guess = { digits: [...action.digits], strikes, balls };
  p.guesses.push(g);
  emit(s, { type: 'guess', player: me, index: p.guesses.length - 1, strikes, balls });
  addLog(s, me, `${inningLabel(s, me, p.guesses.length - 1)} ${p.name}: ${codeText(g.digits)} → ${resultText(strikes, balls, s.options.length)}`);
  if (s.options.helper) autoNotes(p, g, s.options);

  if (isHomerun(g, s.options.length)) {
    s.hits.push(me);
    emit(s, { type: 'homerun', player: me });
    if (s.options.mode === 'solo') finish(s, 0);
    else if (s.lastChance) finish(s, null);
    else if (me === 0 && s.options.fairFinish) {
      s.lastChance = true;
      s.current = 1;
      emit(s, { type: 'lastChance', player: 1 });
      addLog(s, 1, `🔥 ${s.players[1].name}에게 마지막 기회! 이번에 맞히면 무승부예요.`);
    } else finish(s, me);
    return s;
  }

  if (s.lastChance) finish(s, other(me));
  else if (s.options.mode === 'duel') s.current = other(me);
  return s;
}

/**
 * 행동을 적용한 새 상태를 돌려준다. 할 수 없는 행동이면 원래 상태를 그대로 돌려준다.
 * (state는 바꾸지 않는다)
 */
export function applyAction(state: BaseballState, action: BaseballAction): BaseballState {
  switch (action.type) {
    case 'secret':
      return setSecret(state, action);
    case 'guess':
      return guess(state, action);
    case 'note': {
      const { player, digit, mark } = action;
      if (state.phase === 'gameover' || (player !== 0 && player !== 1) || !Number.isInteger(digit) || digit < 0 || digit > 9) return state;
      if (mark !== 0 && mark !== 1 && mark !== 2) return state;
      if (state.players[player].notes[digit] === mark) return state;
      const s = draft(state);
      s.players[player].notes[digit] = mark;
      return s;
    }
    case 'giveUp': {
      if (state.phase !== 'play' || state.options.mode !== 'solo') return state;
      const s = draft(state);
      s.gaveUp = true;
      emit(s, { type: 'giveUp' });
      addLog(s, null, `🙈 답은 ${codeText(s.players[1].secret ?? [])}였어요.`);
      finish(s, null);
      return s;
    }
  }
}
