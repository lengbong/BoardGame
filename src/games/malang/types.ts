import type { DuelKind, DuelSeats } from '../common/duel';

export type { DuelAiLevel, DuelKind } from '../common/duel';

/** 판 크기: 가로 6칸, 세로 12칸 (0번 줄이 맨 위) */
export const W = 6;
export const H = 12;

/** 젤리 색 번호 0~4. 방해 젤리는 9 */
export const GARBAGE = 9;

/** 여기(3번째 줄의 맨 위 칸)가 막히면 진다 */
export const DEATH_X = 2;

/** solo: 혼자 하기, versus: 둘이 대결 (사람·컴퓨터 자유) */
export type GameMode = 'solo' | 'versus';

export type StartSpeed = 'slow' | 'normal' | 'fast';

export interface MalangOptions {
  mode: GameMode;
  /** 젤리 색 가짓수 */
  colors: 4 | 5;
  startSpeed: StartSpeed;
  /** 떨어질 자리를 흐리게 미리 보여 준다 */
  ghost: boolean;
  /** 대결: 몇 판을 먼저 이기면 끝나는지 (1 또는 2) */
  winsNeeded: 1 | 2;
}

export interface MalangSetup {
  /** solo에서는 0번 자리 이름만 쓴다 */
  seats: DuelSeats;
  options: MalangOptions;
}

/** 판 위의 젤리 한 개. id는 화면에서 같은 젤리를 이어서 그리려고 쓴다 */
export interface Blob {
  id: number;
  /** 색 번호 (방해 젤리는 GARBAGE) */
  c: number;
}

/** 조종 중인 두 개짜리 젤리. 축 젤리(x, y)와 붙은 젤리(r 방향) */
export type Rot = 0 | 1 | 2 | 3;

export interface Piece {
  x: number;
  y: number;
  /** 붙은 젤리 방향: 0 위, 1 오른쪽, 2 아래, 3 왼쪽 */
  r: Rot;
  /** [축, 붙은 젤리] 색 */
  colors: [number, number];
  ids: [number, number];
  /** 0~1: 다음 칸까지 내려온 정도 (부드럽게 그리기용) */
  fall: number;
  /** 바닥에 닿은 채로 흐른 시간 (ms) */
  lockT: number;
  /** 바닥에서 움직여서 굳는 시간을 늘린 횟수 */
  resets: number;
  /** 이 조각이 몇 번째 조각인지 (컴퓨터가 새 조각을 알아보려고) */
  serial: number;
}

/** 젤리가 떨어지는 연출 */
export interface Fall {
  id: number;
  x: number;
  from: number;
  to: number;
}

/** 한 번 터질 때 정보 (연출과 점수) */
export interface PopInfo {
  ids: number[];
  /** 몇 연쇄째인지 (1부터) */
  chain: number;
  /** 이번에 얻은 점수 */
  score: number;
  /** 연쇄 글자를 띄울 자리 (칸 좌표) */
  x: number;
  y: number;
}

/**
 * spawn: 새 조각이 나오기 직전, move: 조종 중, settle: 젤리가 떨어지는 중, pop: 터지는 중,
 * garbage: 방해 젤리가 떨어지는 중, dead: 졌음(꽉 참)
 */
export type PlayerPhase = 'spawn' | 'move' | 'settle' | 'pop' | 'garbage' | 'dead';

export interface PlayerStats {
  pieces: number;
  popped: number;
  maxChain: number;
  garbageSent: number;
  garbageReceived: number;
  allClears: number;
}

export interface PlayerState {
  kind: DuelKind;
  name: string;
  /** W × H 칸. index = y × W + x */
  grid: (Blob | null)[];
  piece: Piece | null;
  phase: PlayerPhase;
  /** 지금 단계에서 흐른 시간 (ms) */
  timer: number;
  falls: Fall[];
  /** 떨어지는 연출 전체 시간 (ms) */
  fallDur: number;
  pop: PopInfo | null;
  /** 지금 이어지는 연쇄 수 (연쇄가 끝나면 0) */
  chain: number;
  score: number;
  /** 아직 방해 젤리로 바꾸지 않은 점수 */
  carry: number;
  /** 나에게 떨어질 방해 젤리 수 */
  pending: number;
  /** 다음 조각 차례 (game.queue에서 몇 번째) */
  queueIndex: number;
  /** ↓를 누르고 있는지 */
  soft: boolean;
  /** 혼자 하기 레벨 (1부터) */
  level: number;
  nextId: number;
  serial: number;
  stats: PlayerStats;
}

/** 화면 연출·소리용 사건 (화면이 매 프레임 가져가고 비운다) */
export type GameEvent =
  | { type: 'move'; player: number }
  | { type: 'rotate'; player: number }
  | { type: 'land'; player: number }
  | { type: 'hardDrop'; player: number }
  | { type: 'pop'; player: number; chain: number; count: number; score: number }
  | { type: 'allClear'; player: number }
  | { type: 'send'; player: number; to: number; amount: number }
  | { type: 'offset'; player: number; amount: number }
  | { type: 'garbage'; player: number; amount: number }
  | { type: 'levelUp'; player: number; level: number }
  | { type: 'dead'; player: number }
  | { type: 'round'; winner: number | null }
  | { type: 'start' };

/** countdown: 3·2·1, play: 하는 중, roundover: 한 판이 끝남, over: 모두 끝남 */
export type GamePhase = 'countdown' | 'play' | 'roundover' | 'over';

export interface MalangState {
  options: MalangOptions;
  players: PlayerState[];
  phase: GamePhase;
  /** countdown·roundover 단계에서 흐른 시간 (ms) */
  phaseT: number;
  /** 이번 판을 한 시간 (ms) */
  time: number;
  /** 두 사람이 똑같이 받는 조각 순서 [축, 붙은 젤리] */
  queue: [number, number][];
  /** 조각·방해 젤리 자리를 정하는 난수 상태 */
  rng: number;
  round: number;
  wins: number[];
  /** 이번 판에 이긴 사람 (비기면 null) */
  roundWinner: number | null;
  /** 모두 끝났을 때 이긴 사람 (혼자 하기·비김은 null) */
  winner: number | null;
  events: GameEvent[];
}

export type Input = 'left' | 'right' | 'cw' | 'ccw' | 'drop';
