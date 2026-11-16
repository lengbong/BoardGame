import { MAX_PLANES } from './limits';
import { marketCap, yearProfit, type ValueState } from './simulate';
import type { AirlineState } from './types';

/**
 * 주식과 인수합병 (Airlines Manager·Airline Tycoon 2처럼).
 * - 회사마다 주가 = 시가 총액 ÷ 100 (1%의 값). 시가 총액은 자산 가치 × 한 해 이익에 따른 배수
 * - 다른 회사가 가질 수 있는 몫은 합쳐서 70%까지 (30%는 창업자·일반 주주가 내놓지 않는다)
 * - 많이 사들일수록 남은 주식이 귀해져 값이 오른다
 * - 분기마다 흑자 회사는 이익의 20%를 주주 회사들에게 몫만큼 배당한다
 * - 사람 회사는 인수할 수 없다 (한 회사가 49%까지만). 컴퓨터 회사는 51% 넘게 가지면 나머지를 반값에 사들여 합친다
 */

/** 다른 회사들이 합쳐서 가질 수 있는 몫 (%) */
export const MAX_HELD = 70;
/** 사람 회사를 한 회사가 가질 수 있는 몫 (%) */
export const HUMAN_CAP = 49;
/** 인수할 수 있는 몫 (%) */
export const MERGE_AT = 51;
/** 팔 때는 주가의 이만큼 */
export const SELL_RATE = 0.97;
/** 분기 이익 가운데 배당하는 몫 */
export const PAYOUT = 0.2;
/** 증자: 시가 총액의 이만큼을 새 주식으로 (값의 95%를 받는다), 한 해에 한 번 */
export const ISSUE_SHARE = 0.1;
export const ISSUE_MONTHS = 12;
/** 인수할 때 남은 주식을 사들이는 값 (주가에 견준 비율) */
export const BUYOUT_RATE = 0.5;

export const STAKE_STEPS = [1, 5, 10] as const;

/** 회사 i의 주식 가운데 j가 가진 몫 (%) */
export function stakeOf(state: Pick<AirlineState, 'stakes'>, i: number, j: number): number {
  return state.stakes?.[i]?.[j] ?? 0;
}

/** 회사 i의 주식 가운데 다른 회사들이 가진 몫 합 (%) */
export function heldTotal(state: Pick<AirlineState, 'stakes'>, i: number): number {
  return (state.stakes?.[i] ?? []).reduce((s, x, j) => s + (j === i ? 0 : x), 0);
}

/** 회사 i의 주주 회사들 (몫이 큰 순)과 창업자·일반 주주 몫 (%) */
export function shareholders(state: Pick<AirlineState, 'stakes'>, i: number): { holders: { j: number; pct: number }[]; founder: number } {
  const holders = (state.stakes?.[i] ?? [])
    .map((pct, j) => ({ j, pct }))
    .filter((h) => h.j !== i && h.pct > 0)
    .sort((a, b) => b.pct - a.pct || a.j - b.j);
  return { holders, founder: Math.max(0, Math.round((100 - heldTotal(state, i)) * 10) / 10) };
}

/** 1%의 지금 값 (억): 많이 사들일수록 비싸진다 */
export function pricePerPct(state: ValueState, i: number): number {
  return (marketCap(state, i) / 100) * (1 + (0.5 * heldTotal(state, i)) / 100);
}

/** 이 몫을 사는 값 (사는 동안 값이 오르는 것을 한 칸씩 더한다) */
export function buyCost(state: ValueState, i: number, pct: number): number {
  const base = marketCap(state, i) / 100;
  const held = heldTotal(state, i);
  let cost = 0;
  for (let k = 0; k < pct; k++) cost += base * (1 + (0.5 * (held + k + 0.5)) / 100);
  return cost;
}

/** 이 몫을 팔아 받는 돈 */
export function sellValue(state: ValueState, i: number, pct: number): number {
  return (marketCap(state, i) / 100) * pct * SELL_RATE;
}

/** 이 몫을 지금 가진 회사 j가 받는 다음 배당 어림 (지난 석 달 이익 기준) */
export function dividendOutlook(state: AirlineState, i: number, j: number): number {
  const last3 = (state.ledger ?? []).slice(-3).reduce((s, l) => s + (l.companies[i]?.profit ?? 0), 0);
  return Math.max(0, last3) * PAYOUT * (stakeOf(state, i, j) / 100);
}

/** 한 해 배당 수익률 (지난 열두 달 이익으로 어림) */
export function dividendYield(state: ValueState, i: number): number {
  const cap = marketCap(state, i);
  return cap > 0 ? (Math.max(0, yearProfit(state, i)) * PAYOUT) / cap : 0;
}

/** 새 판의 빈 주식 표 (n × n) */
export const emptyStakes = (n: number): number[][] => Array.from({ length: n }, () => Array.from({ length: n }, () => 0));

/** 주식 표를 바꾼 새 표 (없으면 빈 표에서) */
export function withStake(stakes: number[][] | undefined, n: number, i: number, j: number, pct: number): number[][] {
  const out = (stakes ?? emptyStakes(n)).map((row) => [...row]);
  while (out.length < n) out.push(Array.from({ length: n }, () => 0));
  for (const row of out) while (row.length < n) row.push(0);
  out[i][j] = Math.max(0, Math.round((out[i][j] + pct) * 10) / 10);
  return out;
}

const fmt = (v: number) => (Math.abs(v) >= 10000 ? `${(v / 10000).toFixed(1).replace(/\.0$/, '')}조` : `${Math.round(v).toLocaleString('ko-KR')}억`);

export function buyStakeBlocker(state: AirlineState, j: number, i: number, pct: number): string | null {
  const buyer = state.companies[j];
  const target = state.companies[i];
  if (!target || i === j) return '다른 회사를 골라요';
  if (target.out) return '운항을 멈춘 회사예요';
  if (!Number.isInteger(pct) || pct < 1) return '몫을 정해요';
  if (heldTotal(state, i) + pct > MAX_HELD + 1e-9) return `창업자·주주가 ${100 - MAX_HELD}%는 내놓지 않아요 (남은 ${Math.max(0, MAX_HELD - heldTotal(state, i)).toFixed(0)}%)`;
  if (target.kind === 'human' && stakeOf(state, i, j) + pct > HUMAN_CAP + 1e-9) return `사람 회사는 ${HUMAN_CAP}%까지만 가질 수 있어요`;
  const cost = buyCost(state, i, pct);
  if (buyer.cash < cost) return `돈이 모자라요 (${fmt(cost)} 필요)`;
  return null;
}

export function sellStakeBlocker(state: AirlineState, j: number, i: number, pct: number): string | null {
  if (!state.companies[i] || i === j) return '다른 회사를 골라요';
  if (!(pct > 0)) return '몫을 정해요';
  if (stakeOf(state, i, j) < pct - 1e-9) return '그만큼 가지고 있지 않아요';
  return null;
}

/** 증자로 받는 돈 */
export function issueCash(state: ValueState, i: number): number {
  return marketCap(state, i) * ISSUE_SHARE * 0.95;
}

export function issueBlocker(state: AirlineState, i: number): string | null {
  const c = state.companies[i];
  if (c.lastIssue !== undefined && state.t - c.lastIssue < ISSUE_MONTHS) return `증자는 한 해에 한 번이에요 (${ISSUE_MONTHS - (state.t - c.lastIssue)}달 뒤)`;
  if (marketCap(state, i) < 100) return '회사가 너무 작아요';
  return null;
}

/** 인수할 때 남은 주식을 사들이는 값 (다른 주주 회사 몫은 주가대로, 창업자·일반 주주 몫은 반값) */
export function buyoutCost(state: AirlineState, j: number, i: number): number {
  const per = marketCap(state, i) / 100;
  let cost = 0;
  const held = heldTotal(state, i);
  for (let k = 0; k < state.companies.length; k++) if (k !== i && k !== j) cost += stakeOf(state, i, k) * per;
  cost += (100 - held) * per * BUYOUT_RATE;
  return cost;
}

export function mergeBlocker(state: AirlineState, j: number, i: number): string | null {
  const target = state.companies[i];
  if (!target || i === j) return '다른 회사를 골라요';
  if (target.out) return '운항을 멈춘 회사예요';
  if (target.kind === 'human') return '사람 회사는 인수할 수 없어요';
  if (stakeOf(state, i, j) < MERGE_AT - 1e-9) return `${MERGE_AT}% 넘게 가져야 인수할 수 있어요 (지금 ${stakeOf(state, i, j).toFixed(0)}%)`;
  const fleet = (k: number) => state.companies[k].planes.length + state.companies[k].orders.length;
  if (fleet(i) + fleet(j) > MAX_PLANES) return `합치면 비행기가 ${MAX_PLANES}대를 넘어요`;
  const cost = buyoutCost(state, j, i);
  if (state.companies[j].cash < cost) return `돈이 모자라요 (${fmt(cost)} 필요)`;
  return null;
}
