import { withJosa } from '../../lib/korean';
import type { DuelSide } from '../common/duel';
import { FLEETS, SHIP_INFO, cellName, isValidFleet, randomFleet, shipCells } from './fleet';
import {
  HIT,
  MISS,
  UNKNOWN,
  type Knowledge,
  type LogEntry,
  type Mark,
  type PlacedShip,
  type Rng,
  type ShipsAction,
  type ShipsEvent,
  type ShipsOptions,
  type ShipsPlayer,
  type ShipsSetup,
  type ShipsState,
  type Side,
} from './types';

export const DEFAULT_OPTIONS: ShipsOptions = {
  size: 10,
  noTouch: false,
  extraTurn: false,
  reveal: 'cover',
};

/** 두 편: 왼쪽(파랑 함대)이 먼저 쏜다. */
export const SIDES: [DuelSide, DuelSide] = [
  { label: '파랑 함대', color: '#2f6fd0' },
  { label: '주황 함대', color: '#d9661f' },
];

const MAX_LOG = 80;

type EventInput = ShipsEvent extends infer E ? (E extends ShipsEvent ? Omit<E, 'id'> : never) : never;

export function other(side: Side): Side {
  return side === 0 ? 1 : 0;
}

function addLog(s: ShipsState, side: Side | null, text: string): void {
  s.log = [...s.log, { id: s.nextLogId, side, text } satisfies LogEntry].slice(-MAX_LOG);
  s.nextLogId += 1;
}

function emit(s: ShipsState, event: EventInput): void {
  s.events.push({ ...event, id: s.nextEventId } as ShipsEvent);
  s.nextEventId += 1;
}

function draft(state: ShipsState): ShipsState {
  const s = structuredClone(state);
  s.events = [];
  return s;
}

export function emptyMarks(size: number): Mark[] {
  return new Array<Mark>(size * size).fill(UNKNOWN);
}

/** 사람이 아직 배를 놓지 않은 첫 자리 (없으면 null) */
function nextPlacer(s: ShipsState): Side | null {
  if (!s.players[0].ready) return 0;
  if (!s.players[1].ready) return 1;
  return null;
}

function startBattle(s: ShipsState): void {
  s.phase = 'battle';
  s.placing = null;
  s.current = 0;
  emit(s, { type: 'start' });
  addLog(s, null, `전투 시작! ${withJosa(s.players[0].name, '이/가')} 먼저 쏴요.`);
}

/** 새 게임. 컴퓨터 자리는 바로 무작위로 배를 놓는다. 사람이 있으면 배 놓기부터 시작한다. */
export function createGame(setup: ShipsSetup, rng: Rng = Math.random): ShipsState {
  const options: ShipsOptions = { ...DEFAULT_OPTIONS, ...setup.options };
  const size = options.size;
  const players = setup.seats.map((seat, i): ShipsPlayer => {
    const human = seat.kind === 'human';
    return {
      kind: seat.kind,
      name: seat.name.trim() || SIDES[i].label,
      fleet: human ? [] : randomFleet(size, options.noTouch, rng),
      ready: !human,
      marks: emptyMarks(size),
      history: [],
    };
  }) as [ShipsPlayer, ShipsPlayer];
  const s: ShipsState = {
    options,
    players,
    phase: 'place',
    placing: null,
    current: 0,
    shots: 0,
    winner: null,
    events: [],
    nextEventId: 1,
    log: [],
    nextLogId: 1,
  };
  const placer = nextPlacer(s);
  if (placer === null) startBattle(s);
  else {
    s.placing = placer;
    addLog(s, placer, `${withJosa(players[placer].name, '이/가')} 배를 숨기고 있어요.`);
  }
  return s;
}

/** owner의 배 가운데 상대가 모든 칸을 맞혀서 가라앉은 배 */
export function sunkShips(state: ShipsState, owner: Side): PlacedShip[] {
  const marks = state.players[other(owner)].marks;
  const size = state.options.size;
  return state.players[owner].fleet.filter((ship) => shipCells(ship, size).every((c) => marks[c] === HIT));
}

export function isShipSunk(ship: PlacedShip, marks: readonly Mark[], size: number): boolean {
  return shipCells(ship, size).every((c) => marks[c] === HIT);
}

/** owner의 배 가운데 아직 떠 있는 배 */
export function afloatShips(state: ShipsState, owner: Side): PlacedShip[] {
  const sunk = new Set(sunkShips(state, owner).map((s) => s.id));
  return state.players[owner].fleet.filter((s) => !sunk.has(s.id));
}

export function shipAt(fleet: readonly PlacedShip[], cell: number, size: number): PlacedShip | null {
  return fleet.find((s) => shipCells(s, size).includes(cell)) ?? null;
}

export function canFire(state: ShipsState, cell: number): boolean {
  const size = state.options.size;
  return (
    state.phase === 'battle' &&
    Number.isInteger(cell) &&
    cell >= 0 &&
    cell < size * size &&
    state.players[state.current].marks[cell] === UNKNOWN
  );
}

export interface ShotStats {
  shots: number;
  hits: number;
  /** 0~100 (쏜 적이 없으면 0) */
  accuracy: number;
}

export function playerStats(state: ShipsState, side: Side): ShotStats {
  const p = state.players[side];
  const shots = p.history.length;
  const hits = p.history.filter((c) => p.marks[c] === HIT).length;
  return { shots, hits, accuracy: shots === 0 ? 0 : Math.round((hits / shots) * 100) };
}

/**
 * shooter가 아는 것만 모은다: 자기가 쏜 결과, 가라앉아 공개된 상대 배, 아직 떠 있는 배들의 길이.
 * 컴퓨터는 이 정보만 보고 쏠 곳을 정한다.
 */
export function knowledgeFor(state: ShipsState, shooter: Side): Knowledge {
  const size = state.options.size;
  const sunk = sunkShips(state, other(shooter));
  const sunkIds = new Set(sunk.map((s) => s.id));
  return {
    size,
    noTouch: state.options.noTouch,
    marks: [...state.players[shooter].marks],
    sunk: sunk.map((s) => ({ length: SHIP_INFO[s.id].length, cells: shipCells(s, size) })),
    remaining: FLEETS[size].filter((spec) => !sunkIds.has(spec.id)).map((spec) => spec.length),
  };
}

function place(state: ShipsState, player: Side, fleet: PlacedShip[]): ShipsState {
  if (state.phase !== 'place' || state.placing !== player) return state;
  const { size, noTouch } = state.options;
  if (!isValidFleet(fleet, size, noTouch)) return state;
  const s = draft(state);
  s.players[player].fleet = FLEETS[size].map((spec) => {
    const ship = fleet.find((f) => f.id === spec.id)!;
    return { id: ship.id, x: ship.x, y: ship.y, dir: ship.dir };
  });
  s.players[player].ready = true;
  emit(s, { type: 'placed', player });
  addLog(s, player, `${withJosa(s.players[player].name, '이/가')} 배를 다 숨겼어요.`);
  const next = nextPlacer(s);
  if (next === null) startBattle(s);
  else {
    s.placing = next;
    addLog(s, next, `${withJosa(s.players[next].name, '이/가')} 배를 숨기고 있어요.`);
  }
  return s;
}

function fire(state: ShipsState, cell: number): ShipsState {
  if (!canFire(state, cell)) return state;
  const s = draft(state);
  const size = s.options.size;
  const shooter = s.current;
  const target = other(shooter);
  const me = s.players[shooter];
  const where = `${me.name}: ${cellName(cell, size)}`;
  const ship = shipAt(s.players[target].fleet, cell, size);
  me.marks[cell] = ship ? HIT : MISS;
  me.history.push(cell);
  s.shots += 1;

  if (!ship) {
    emit(s, { type: 'shot', shooter, cell, result: 'miss', ship: null, cells: [] });
    addLog(s, shooter, `${where} 물보라 (빗나감)`);
    s.current = target;
    return s;
  }

  const sunk = isShipSunk(ship, me.marks, size);
  const name = SHIP_INFO[ship.id].name;
  if (sunk) {
    emit(s, { type: 'shot', shooter, cell, result: 'sunk', ship: ship.id, cells: shipCells(ship, size) });
    addLog(s, shooter, `${where} 격침! ${withJosa(name, '을/를')} 가라앉혔어요.`);
  } else {
    emit(s, { type: 'shot', shooter, cell, result: 'hit', ship: null, cells: [] });
    addLog(s, shooter, `${where} 명중!`);
  }

  if (sunkShips(s, target).length === s.players[target].fleet.length) {
    s.phase = 'gameover';
    s.winner = shooter;
    emit(s, { type: 'win', player: shooter });
    addLog(s, shooter, `${withJosa(me.name, '이/가')} 상대 배를 모두 가라앉혔어요! 승리!`);
    return s;
  }

  if (s.options.extraTurn) {
    emit(s, { type: 'extra', player: shooter });
    addLog(s, shooter, `${me.name}: 맞혔으니 한 번 더!`);
  } else {
    s.current = target;
  }
  return s;
}

/** 행동을 적용한 새 상태. 할 수 없는 행동이면 원래 상태를 그대로 돌려준다. */
export function applyAction(state: ShipsState, action: ShipsAction): ShipsState {
  switch (action.type) {
    case 'place':
      return place(state, action.player, action.fleet);
    case 'fire':
      return fire(state, action.cell);
  }
}
