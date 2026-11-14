import { useEffect, useRef } from 'react';
import { loadJson, saveJson } from './storage';

/**
 * 전적 기록: 사람 한 명이 컴퓨터와 겨룬 판의 승·패·무승부를 게임마다 센다.
 * (사람끼리 한 판이나 컴퓨터끼리 구경한 판은 세지 않는다. 혼자 하는 퍼즐은 '풀었다'를 승으로 센다.)
 */
export type Outcome = 'win' | 'loss' | 'draw';

export interface GameStats {
  wins: number;
  losses: number;
  draws: number;
}

export type AllStats = Record<string, GameStats>;

const KEY = 'family-boardgame.stats.v1';
const EMPTY: GameStats = { wins: 0, losses: 0, draws: 0 };
const count = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0);

export function loadStats(): AllStats {
  const raw = loadJson<Record<string, Partial<GameStats>>>(KEY);
  const out: AllStats = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, s] of Object.entries(raw)) {
    if (!s || typeof s !== 'object') continue;
    out[id] = { wins: count(s.wins), losses: count(s.losses), draws: count(s.draws) };
  }
  return out;
}

/** 결과 하나를 더한 새 기록 */
export function addOutcome(stats: AllStats, gameId: string, outcome: Outcome): AllStats {
  const s = stats[gameId] ?? EMPTY;
  return {
    ...stats,
    [gameId]: {
      wins: s.wins + (outcome === 'win' ? 1 : 0),
      losses: s.losses + (outcome === 'loss' ? 1 : 0),
      draws: s.draws + (outcome === 'draw' ? 1 : 0),
    },
  };
}

export function recordOutcome(gameId: string, outcome: Outcome): void {
  saveJson(KEY, addOutcome(loadStats(), gameId, outcome));
}

export function clearStats(): void {
  saveJson(KEY, {});
}

/** '3승 1패', '2승 1무 4패' (한 판도 안 했으면 빈 글자) */
export function statsText(s: GameStats | undefined): string {
  if (!s || s.wins + s.losses + s.draws === 0) return '';
  return [`${s.wins}승`, s.draws > 0 ? `${s.draws}무` : '', `${s.losses}패`].filter(Boolean).join(' ');
}

/**
 * 사람이 딱 한 명일 때 그 사람의 결과. 사람이 0명·2명 이상이면 null (세지 않는다).
 * winners: 1등인 사람들의 자리 번호 (비기면 빈 배열이거나 여러 명)
 */
export function soloOutcome(kinds: readonly string[], winners: readonly (number | null | undefined)[]): Outcome | null {
  const humans = kinds.map((k, i) => (k === 'human' ? i : -1)).filter((i) => i >= 0);
  if (humans.length !== 1 || kinds.length < 2) return null;
  const top = winners.filter((w): w is number => typeof w === 'number');
  if (top.length === 0) return 'draw';
  if (!top.includes(humans[0])) return 'loss';
  return top.length === 1 ? 'win' : 'draw';
}

/**
 * 판이 끝나는 순간(over가 false → true) 한 번만 결과를 적는다.
 * 이미 끝난 판을 다시 열었을 때는 적지 않는다.
 */
export function useRecordOutcome(gameId: string, over: boolean, outcome: () => Outcome | null): void {
  const was = useRef(over);
  const fn = useRef(outcome);
  fn.current = outcome;
  useEffect(() => {
    if (over && !was.current) {
      const result = fn.current();
      if (result) recordOutcome(gameId, result);
    }
    was.current = over;
  }, [gameId, over]);
}
