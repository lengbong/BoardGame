import { loadJson, removeKey, saveJson } from '../../lib/storage';
import { checkAchievements, parseAchStore, type AchStore, type Unlock } from './achievements';
import { parseHof, recordGameEnd, type HofStore } from './hallOfFame';
import type { AirlineState } from './types';

/**
 * 업적·명예의 전당 저장 (게임 저장과 따로, 이 브라우저에 판을 넘어 남는다).
 * 화면은 subscribeFame으로 바뀜을 듣는다.
 */
export const ACH_KEY = 'family-boardgame.airline.achievements.v1';
export const HOF_KEY = 'family-boardgame.airline.halloffame.v1';

/** localStorage가 막힌 곳(사생활 보호 모드 등)에서도 이 화면이 열려 있는 동안은 기억한다 (같은 업적을 달마다 다시 알리지 않게) */
let memAch: AchStore | null = null;
let memHof: HofStore | null = null;

export function loadAchStore(): AchStore {
  const raw = loadJson<unknown>(ACH_KEY);
  return raw === null && memAch ? memAch : parseAchStore(raw);
}

export function loadHof(): HofStore {
  const raw = loadJson<unknown>(HOF_KEY);
  return raw === null && memHof ? memHof : parseHof(raw);
}

const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version += 1;
  for (const fn of listeners) fn();
}

export function subscribeFame(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** 바뀔 때마다 하나씩 느는 번호 (useSyncExternalStore) */
export function fameVersion(): number {
  return version;
}

export function saveAchStore(store: AchStore): void {
  memAch = store;
  saveJson(ACH_KEY, store);
  notify();
}

export function saveHof(hof: HofStore): void {
  memHof = hof;
  saveJson(HOF_KEY, hof);
  notify();
}

/** 업적과 명예의 전당을 모두 지운다 */
export function resetFame(): void {
  memAch = null;
  memHof = null;
  removeKey(ACH_KEY);
  removeKey(HOF_KEY);
  notify();
}

/**
 * 한 달이 끝날 때마다·게임이 끝날 때 부른다: 새로 이룬 업적을 저장하고 돌려준다 (알림용).
 * 게임이 끝났으면 명예의 전당과 기록에도 넣는다 (같은 끝은 한 번만).
 */
export function trackFame(state: AirlineState, now = Date.now()): Unlock[] {
  if (!state.companies.some((c) => c.kind === 'human')) return [];
  const before = loadAchStore();
  const { store, unlocks } = checkAchievements(state, before, now);
  let changed = false;
  if (store !== before) {
    memAch = store;
    saveJson(ACH_KEY, store);
    changed = true;
  }
  if (state.phase === 'gameover') {
    const hof = loadHof();
    const r = recordGameEnd(hof, state, now);
    if (r.hof !== hof) {
      memHof = r.hof;
      saveJson(HOF_KEY, r.hof);
      changed = true;
    }
  }
  if (changed) notify();
  return unlocks;
}
