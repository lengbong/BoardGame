import { flippableIds } from './rules';
import type { MemoryAction, MemoryState, Rng, SeenInfo } from './types';

export type AiLevel = 'ai-easy' | 'ai-normal';

/**
 * 컴퓨터가 볼 수 있는 것만 모은 정보. 아직 공개된 적 없는 카드의 그림은 여기에 없다.
 * 컴퓨터의 판단(decideFlip)은 이것만 받으므로 몰래 그림을 볼 수 없다.
 */
export interface AiView {
  /** 지금 뒤집을 수 있는 (뒷면인, 짝을 못 찾은) 카드 id */
  hidden: number[];
  /** 지금 앞면이 보이는 카드 (모두가 보고 있다) */
  faceUp: { id: number; pic: string }[];
  /** 공개된 적 있는 카드 기록 (짝을 못 찾은 카드만) */
  seen: Record<number, SeenInfo>;
  /** 지금까지 공개된 횟수 (기억이 얼마나 오래됐는지 잴 때 쓴다) */
  reveals: number;
  /** 컴퓨터 자신의 자리 (컴퓨터마다 기억이 다르게) */
  me: number;
}

/** 게임 상태에서 공개된 정보만 골라 낸다. state.cards의 그림은 읽지 않는다. */
export function aiView(state: MemoryState): AiView {
  const hidden = flippableIds(state);
  const live = new Set(state.cards.filter((c) => c.matchedBy === null).map((c) => c.id));
  const seen: Record<number, SeenInfo> = {};
  for (const [key, info] of Object.entries(state.seen)) {
    const id = Number(key);
    if (live.has(id)) seen[id] = { ...info };
  }
  return {
    hidden,
    // 앞면인 카드는 뒤집을 때 seen에 기록되므로 거기서 그림을 가져온다.
    faceUp: state.faceUp.filter((id) => seen[id]).map((id) => ({ id, pic: seen[id].pic })),
    seen,
    reveals: state.reveals,
    me: state.players[state.current]?.seat ?? 0,
  };
}

/** 정수 몇 개로 0~1 사이 값을 만든다 (같은 입력이면 늘 같은 값). 기억을 잊을지 정할 때 쓴다. */
export function memoryNoise(a: number, b: number, c: number, d: number): number {
  let h = 0x9e3779b9 ^ Math.imul(a + 1, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ Math.imul(b + 7, 0xc2b2ae35), 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15) ^ Math.imul(c + 13, 0x165667b1), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16) ^ Math.imul(d + 29, 0xd3a2646c), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 기억 모형: 얼마 전에 본 카드를 아직 기억할 확률. age는 그 뒤로 공개된 카드 수 (나이가 많을수록 줄어든다) */
export function rememberChance(level: AiLevel, age: number, glance = false): number {
  if (level === 'ai-easy') {
    const p = age <= 2 ? 0.85 : age <= 5 ? 0.55 : age <= 8 ? 0.3 : 0.1;
    return glance ? p * 0.15 : p;
  }
  const p = age <= 4 ? 0.96 : age <= 10 ? 0.86 : age <= 18 ? 0.72 : 0.55;
  return glance ? p * 0.35 : p;
}

/** 쉬움은 가장 최근에 본 몇 장만, 보통은 꽤 많이 기억하려고 한다. */
const MEMORY_SLOTS: Record<AiLevel, number> = { 'ai-easy': 6, 'ai-normal': 14 };

/**
 * 컴퓨터가 지금 기억하고 있는 카드 (id → 그림). 오직 view.seen만 읽는다.
 * 기억 하나하나에 '얼마나 오래 갈지'를 한 번만 정해 두므로(카드·본 때·컴퓨터마다 고정된 값),
 * 한 번 잊은 카드는 다시 공개될 때까지 계속 잊은 채로 있다. 다시 굴려서 우연히 떠올리는 일은 없다.
 * 나이는 이번 시도를 시작할 때 기준으로 재서, 첫 장을 뒤집었다고 기억이 흔들리지 않는다.
 */
export function recall(view: AiView, level: AiLevel): Map<number, string> {
  const hidden = new Set(view.hidden);
  const base = view.reveals - view.faceUp.length;
  const entries = Object.entries(view.seen)
    .map(([key, info]) => ({ id: Number(key), info, luck: memoryNoise(Number(key), info.at, view.me, 1) }))
    .filter((e) => hidden.has(e.id))
    .sort((x, y) => y.info.at - x.info.at || x.luck - y.luck)
    .slice(0, MEMORY_SLOTS[level]);
  const memory = new Map<number, string>();
  for (const { id, info } of entries) {
    const age = Math.max(0, base - 1 - info.at);
    if (memoryNoise(id, info.at, view.me, level === 'ai-easy' ? 2 : 3) < rememberChance(level, age, info.glance)) memory.set(id, info.pic);
  }
  return memory;
}

function pickOne<T>(items: T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

/** 기억 속에서 같은 그림 두 장 (둘 다 뒷면) */
function knownPairs(memory: Map<number, string>): [number, number][] {
  const byPic = new Map<string, number[]>();
  for (const [id, pic] of memory) byPic.set(pic, [...(byPic.get(pic) ?? []), id]);
  return [...byPic.values()].filter((ids) => ids.length >= 2).map((ids) => [ids[0], ids[1]] as [number, number]);
}

/**
 * 다음에 뒤집을 카드를 고른다. 공개된 정보(view)만 받는다.
 * - 보통: 기억 속 짝이 있으면 바로 맞히고, 없으면 처음 보는 카드를 먼저 뒤집어 본 뒤
 *   그 짝을 기억하면 맞힌다. 짝을 모르면 기억 속 카드(틀릴 게 뻔한 카드) 대신 처음 보는 카드를 뒤집는다.
 * - 쉬움: 최근 몇 장만 어렴풋이 기억하고, 알아도 가끔 그냥 아무 카드나 뒤집는다.
 * 뒷면인 카드(view.hidden)만 고르므로 이미 짝을 찾았거나 앞면인 카드는 절대 고르지 않는다.
 */
export function decideFlip(view: AiView, level: AiLevel, rng: Rng = Math.random): number {
  if (view.hidden.length === 0) throw new Error('뒤집을 카드가 없어요.');
  const memory = recall(view, level);
  const unseen = view.hidden.filter((id) => !(id in view.seen));
  const forgotten = view.hidden.filter((id) => !memory.has(id));

  if (view.faceUp.length === 0) {
    const pairs = knownPairs(memory);
    if (level === 'ai-easy') {
      if (pairs.length > 0 && rng() < 0.8) return pickOne(pairs, rng)[0];
      if (unseen.length > 0 && rng() < 0.5) return pickOne(unseen, rng);
      return pickOne(view.hidden, rng);
    }
    if (pairs.length > 0) return pickOne(pairs, rng)[0];
    if (unseen.length > 0) return pickOne(unseen, rng);
    if (forgotten.length > 0) return pickOne(forgotten, rng);
    return pickOne(view.hidden, rng);
  }

  // 둘째 장: 첫 장의 짝을 기억하면 그것을 뒤집는다.
  const first = view.faceUp[0];
  const others = view.hidden.filter((id) => id !== first.id);
  const partner = others.find((id) => memory.get(id) === first.pic);
  if (level === 'ai-easy') {
    if (partner !== undefined && rng() < 0.9) return partner;
    return pickOne(others, rng);
  }
  if (partner !== undefined) return partner;
  const freshOthers = unseen.filter((id) => id !== first.id);
  if (freshOthers.length > 0) return pickOne(freshOthers, rng);
  const forgottenOthers = forgotten.filter((id) => id !== first.id);
  if (forgottenOthers.length > 0) return pickOne(forgottenOthers, rng);
  return pickOne(others, rng);
}

/** 지금 상태에서 컴퓨터가 할 행동. 화면에서 쓰는 짧은 길 (aiView → decideFlip) */
export function decideAction(state: MemoryState, level: AiLevel, rng: Rng = Math.random): MemoryAction {
  if (state.phase === 'peek') return { type: 'startPlay' };
  if (state.phase === 'mismatch') return { type: 'hide' };
  return { type: 'flip', cardId: decideFlip(aiView(state), level, rng) };
}
