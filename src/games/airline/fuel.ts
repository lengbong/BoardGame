import { historicOil } from './events';
import { mOf, yearOfM } from './time';
import type { AirlineState, Company, FuelTank } from './types';

/**
 * 연료 탱크 (Airline Manager·Airline Tycoon처럼): 유가가 쌀 때 연료를 사 두면
 * 달마다 비행기가 먼저 탱크 연료를 (산 값의 평균으로) 쓰고, 모자라면 그달 값으로 산다.
 * 연료는 톤으로 센다. 1톤 값 = FUEL_TON × 유가 지수 (억 원).
 */

/** 유가 지수 1일 때 연료 1톤 값 (억) = simulate.ts의 FUEL_PRICE(1kg에 0.13만 원) × 1000kg (테스트가 둘이 같은지 본다) */
export const FUEL_TON = 0.013;

/**
 * 그 시대의 '보통' 유가 지수: 달마다 유가가 이 값 쪽으로 천천히 돌아간다.
 * 운임은 이 값일 때에 맞춰져 있어서, 유가가 이보다 높으면 유류할증이 붙는다.
 */
export function normalOil(state: Pick<AirlineState, 't' | 'options' | 'challenge'>): number {
  if (state.challenge?.id === 'oilstorm' && state.t >= mOf(1973, 10)) return 1.9;
  return state.options.history !== false ? historicOil(yearOfM(state.t)) : 1;
}

/** 손님 한 명이 1km 가는 데 드는 연료 (kg): 업계 평균 어림 (2027년 판 전체가 0.023쯤) */
export const PAX_BURN = 0.023;
/** 유가가 오른 만큼의 연료비 가운데 유류할증으로 손님에게 넘기는 몫 */
export const FUEL_PASS = 0.6;

/**
 * 유류할증 (손님 한 명이 1km 갈 때 더 내는 값, 만 원): 유가가 보통 값보다 높으면 모든 항공사 표에 똑같이,
 * 실제 유류할증처럼 거리만큼 붙는다. 업계 평균 연료로 늘어난 연료비의 60%쯤이라 기름값이 뛰면 여전히 손해지만
 * 버틸 수는 있고, 연료를 덜 먹는 비행기·꽉 찬 비행기일수록 덜 손해 본다.
 * 유가 고정 계약과 상관없이 시장 유가로 정한다.
 */
export function fuelSurchargeKm(state: Pick<AirlineState, 't' | 'oil' | 'options' | 'challenge'>): number {
  const normal = normalOil(state);
  const oil = state.oil ?? normal;
  if (!(normal > 0) || oil <= normal) return 0;
  // FUEL_TON(억/톤) × 10 = 1kg 값 (만 원)
  return FUEL_PASS * (oil - normal) * PAX_BURN * FUEL_TON * 10;
}

/** 1,000km마다 붙는 유류할증 글 ('3.2만 원'), 붙지 않으면 null */
export function surchargeText(state: Pick<AirlineState, 't' | 'oil' | 'options' | 'challenge'>): string | null {
  const v = fuelSurchargeKm(state) * 1000;
  if (v < 0.05) return null;
  return `${v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString('ko-KR')}만 원`;
}

/** 표 한 장에 붙는 유류할증 (만 원, 편도 d km) */
export const fuelSurcharge = (state: Pick<AirlineState, 't' | 'oil' | 'options' | 'challenge'>, d: number): number => fuelSurchargeKm(state) * d;

/** 사 둔 연료를 되팔 때는 그달 값의 이만큼만 받는다 */
export const FUEL_SELL_RATE = 0.9;

export interface TankLevel {
  name: string;
  /** 담을 수 있는 연료 (톤) */
  cap: number;
  /** 이 단계로 키우는 값 (억) */
  cost: number;
}

/** 탱크 단계 (0은 탱크 없음: 그달 값으로만 산다) */
export const TANK_LEVELS: readonly TankLevel[] = [
  { name: '탱크 없음', cap: 0, cost: 0 },
  { name: '작은 탱크', cap: 2000, cost: 15 },
  { name: '공항 탱크', cap: 8000, cost: 40 },
  { name: '큰 탱크', cap: 25000, cost: 100 },
  { name: '연료 기지', cap: 70000, cost: 220 },
  { name: '대형 연료 기지', cap: 180000, cost: 450 },
];
export const MAX_TANK = TANK_LEVELS.length - 1;

/** 자동으로 사기: '보통 값'에 견준 유가가 이 비율 아래면 탱크를 채운다 */
export const AUTO_OPTIONS: readonly { ratio: number | null; name: string }[] = [
  { ratio: null, name: '끄기' },
  { ratio: 1, name: '보통 값보다 쌀 때' },
  { ratio: 0.92, name: '8% 넘게 쌀 때' },
  { ratio: 0.85, name: '15% 넘게 쌀 때' },
];

export const emptyTank = (): FuelTank => ({ level: 0, stock: 0, avg: 0, auto: null });

export const tankOf = (c: Company): FuelTank => c.fuel ?? emptyTank();

export const tankCap = (c: Company): number => TANK_LEVELS[tankOf(c).level]?.cap ?? 0;

/** 탱크에 더 담을 수 있는 연료 (톤) */
export const tankSpace = (c: Company): number => Math.max(0, tankCap(c) - tankOf(c).stock);

/** 지금 연료 1톤 값 (억) */
export const tonPrice = (oil: number): number => FUEL_TON * oil;

/** 연료 tons톤을 지금 사는 값 (억) */
export const fuelCost = (oil: number, tons: number): number => tonPrice(oil) * tons;

/** 사 둔 연료의 장부 가치 (산 값 그대로) */
export const stockValue = (c: Company): number => {
  const t = tankOf(c);
  return t.stock * t.avg * FUEL_TON;
};

/** 탱크를 지은 값의 합 (회사 가치: 60%만 친다) */
export function tankInvested(c: Company): number {
  let v = 0;
  for (let lv = 1; lv <= tankOf(c).level; lv++) v += TANK_LEVELS[lv].cost;
  return v;
}

/** 회사 가치에 더하는 연료·탱크 */
export const tankWorth = (c: Company): number => stockValue(c) + tankInvested(c) * 0.6;

/** 탱크 연료를 쓰고 모자라면 그달 값으로 살 때: 연료 tons톤의 값과 탱크에서 쓴 톤, 아낀 돈 */
export function burnFuel(tank: FuelTank | undefined, tons: number, oil: number): { cost: number; used: number; saved: number } {
  const stock = tank?.stock ?? 0;
  const used = Math.max(0, Math.min(stock, tons));
  const avg = tank?.avg ?? 0;
  const cost = (used * avg + (tons - used) * oil) * FUEL_TON;
  return { cost, used, saved: used * (oil - avg) * FUEL_TON };
}

/** 연료를 더 담은 뒤의 탱크 (평균 단가를 다시 셈한다) */
export function addFuel(tank: FuelTank, tons: number, oil: number): FuelTank {
  const stock = tank.stock + tons;
  const avg = stock > 0 ? (tank.stock * tank.avg + tons * oil) / stock : 0;
  return { ...tank, stock: Math.round(stock * 10) / 10, avg: Math.round(avg * 10000) / 10000 };
}

/** 지난달(없으면 이번 달 어림) 쓴 연료 (톤) */
export function monthlyTons(state: Pick<AirlineState, 'report'>, ci: number, estimate?: number): number {
  const r = state.report?.companies[ci];
  return r?.fuelTons ?? estimate ?? 0;
}

// ------------------------------------------------------------------ 할 수 있는지

const fmt = (v: number) => (v >= 10 ? `${Math.round(v).toLocaleString('ko-KR')}억` : `${(Math.round(v * 10) / 10).toLocaleString('ko-KR')}억`);

export function tankBlocker(state: AirlineState, ci: number): string | null {
  const c = state.companies[ci];
  const t = tankOf(c);
  if (t.level >= MAX_TANK) return '가장 큰 탱크예요';
  const cost = TANK_LEVELS[t.level + 1].cost;
  if (c.cash < cost) return `돈이 모자라요 (${fmt(cost)} 필요)`;
  return null;
}

export function buyFuelBlocker(state: AirlineState, ci: number, tons: number): string | null {
  const c = state.companies[ci];
  if (tankOf(c).level === 0) return '먼저 연료 탱크를 지어요';
  if (!(tons >= 1)) return '살 만큼을 정해요';
  if (tons > tankSpace(c) + 0.5) return tankSpace(c) < 1 ? '탱크가 가득 찼어요' : `탱크에 ${Math.floor(tankSpace(c)).toLocaleString('ko-KR')}톤만 더 들어가요`;
  const cost = fuelCost(state.oil, tons);
  if (c.cash < cost) return `돈이 모자라요 (${fmt(cost)} 필요)`;
  return null;
}

export function sellFuelBlocker(state: AirlineState, ci: number, tons: number): string | null {
  const c = state.companies[ci];
  if (!(tons >= 1)) return '팔 만큼을 정해요';
  if (tankOf(c).stock < 1) return '사 둔 연료가 없어요';
  if (tons > tankOf(c).stock + 0.5) return '사 둔 연료보다 많아요';
  return null;
}

/**
 * 자동으로 사기: 유가가 '보통 값' × 비율 아래면 탱크를 채운다.
 * 노선을 늘릴 돈까지 연료에 묶이지 않게, 지난달 비용의 한 달 반(적어도 50억)을 남기고 그 위 돈의 절반까지만 쓴다.
 * 산 톤을 돌려준다 (안 사면 0).
 */
export function autoBuyTons(c: Company, oil: number, target: number, lastCosts: number): number {
  const t = tankOf(c);
  if (t.level === 0 || t.auto === null || c.out) return 0;
  if (oil > target * t.auto + 1e-9) return 0;
  const space = tankSpace(c);
  if (space < 1) return 0;
  const spend = (c.cash - Math.max(50, lastCosts * 1.5)) * 0.5;
  if (spend <= 0) return 0;
  const tons = Math.floor(Math.min(space, spend / tonPrice(oil)));
  return tons >= 1 ? tons : 0;
}
