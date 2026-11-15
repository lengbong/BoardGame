import { SEAT_COLORS } from '../common/players';
import { MODEL, availableModels } from './aircraft';
import { coColors, distinctColors } from './brand';
import { defaultCabin, fixedCabin } from './cabin';
import { availableFreighters, isFreighter } from './freighters';
import { mLabel } from './time';
import type { AirlineSetup, BizModel, Cabin, Company, ModelDef, NewsItem, Rng } from './types';

/**
 * 사업 모델: 풀서비스·저가항공·화물 전문. 게임을 시작할 때 고르고, 나중에 돈과 몇 달을 들여 바꿀 수 있어요.
 *
 * - 풀서비스: 여러 등급 좌석·기내식·갈아타기·제휴·배 아래 화물까지 모두.
 * - 저가항공: 한 등급 촘촘한 좌석, 승무원·서비스·표 판매 비용이 싸고 비행기를 빨리 돌려요. 짐·좌석 지정·기내 판매로
 *   부가 수입(요즘일수록 많이)을 벌어요. 갈아타기·제휴·배 아래 화물은 없고 사업 손님은 덜 골라요.
 *   1978년 규제가 풀린 뒤로는 싼 표를 찾는 관광 손님이 새로 생겨요.
 * - 화물 전문: 손님 없이 화물기로 짐만 날라요.
 */

export const BIZ_MODELS: readonly BizModel[] = ['full', 'lcc', 'cargo'];

export const BIZ_INFO: Record<BizModel, { name: string; icon: string; desc: string }> = {
  full: { name: '풀서비스', icon: '🛫', desc: '여러 등급 좌석·기내식·갈아타기·제휴·배 아래 화물까지 모두 하는 항공사' },
  lcc: { name: '저가항공', icon: '🎒', desc: '한 등급 촘촘한 좌석과 싼 운임, 빨리 돌리는 비행기, 짐·좌석 값으로 버는 부가 수입. 갈아타기·제휴·화물은 없어요' },
  cargo: { name: '화물 전문', icon: '📦', desc: '손님 없이 화물기로 짐만 나르는 회사' },
};

export const bizModelOf = (c: Pick<Company, 'bizModel'>): BizModel => c.bizModel ?? 'full';

// ------------------------------------------------------------------ 저가항공

/** 저가항공은 비행기를 빨리 돌려 같은 시간에 더 많이 난다 (비행시간을 이만큼으로 센다) */
export const LCC_TURN = 0.87;
/** 라운지·마일리지가 없어 사업 손님이 덜 고른다 */
export const LCC_BIZ = 0.72;
/** 승무원·정비 수당, 기내 서비스 비용 배수 */
export const LCC_CREW = 0.78;
export const LCC_SERVICE = 0.55;
/** 저가항공이 나는 두 도시에 새로 생기는 관광 손님 (규제가 다 풀린 뒤) */
export const LCC_STIM = 0.55;

/** 규제가 풀리며 저가항공이 자란 정도 (1978년 0 → 2000년 1) */
export function lccEra(year: number): number {
  return Math.max(0, Math.min(1, (year - 1978) / 22));
}

const ANCILLARY: readonly (readonly [number, number])[] = [
  [1975, 0.01],
  [1990, 0.03],
  [2000, 0.05],
  [2010, 0.11],
  [2020, 0.15],
  [2040, 0.17],
];

/** 저가항공 손님 한 명의 부가 수입 (일반석 기본 운임에 견준 비율, 요즘일수록 많다) */
export function ancillaryRate(year: number): number {
  if (year <= ANCILLARY[0][0]) return ANCILLARY[0][1];
  for (let i = 1; i < ANCILLARY.length; i++) {
    const [y1, v1] = ANCILLARY[i];
    if (year <= y1) {
      const [y0, v0] = ANCILLARY[i - 1];
      return v0 + ((v1 - v0) * (year - y0)) / (y1 - y0);
    }
  }
  return ANCILLARY[ANCILLARY.length - 1][1];
}

/** 비행시간 배수 (저가항공은 빨리 돌린다) */
export function turnMult(c: Pick<Company, 'bizModel'>): number {
  return bizModelOf(c) === 'lcc' ? LCC_TURN : 1;
}

/** 저가항공 비용 배수: 승무원·서비스·표 판매 (인터넷 시대에는 표를 거의 직접 판다) */
const FULL_COST = { crew: 1, service: 1, sales: 1 } as const;

export function bizCostMults(c: Pick<Company, 'bizModel'>, year: number): { crew: number; service: number; sales: number } {
  if (bizModelOf(c) !== 'lcc') return FULL_COST;
  return { crew: LCC_CREW, service: LCC_SERVICE, sales: year >= 1995 ? 0.45 : 0.7 };
}

/** 사업 손님이 이 회사를 고르는 배수 */
export function bizChoiceMult(c: Pick<Company, 'bizModel'>): number {
  return bizModelOf(c) === 'lcc' ? LCC_BIZ : 1;
}

/** 저가항공이 날면 늘어나는 관광 손님 배수 */
export function leisureStimulus(year: number): number {
  return 1 + LCC_STIM * lccEra(year);
}

// ------------------------------------------------------------------ 기종과 좌석

/** 사업 모델에 맞는 기종인지 (화물 전문은 화물기만, 저가항공은 초음속기·화물기 빼고) */
export function fitsBizModel(model: BizModel, m: ModelDef): boolean {
  if (model === 'cargo') return isFreighter(m);
  if (model === 'lcc') return !isFreighter(m) && m.body !== 'sst';
  return true;
}

/** 이 회사가 이 기종을 쓸 수 없는 까닭 (쓸 수 있으면 null) */
export function bizModelFit(c: Pick<Company, 'bizModel'>, m: ModelDef): string | null {
  const model = bizModelOf(c);
  if (fitsBizModel(model, m)) return null;
  if (model === 'cargo') return '화물 전문 회사는 화물기만 써요';
  return isFreighter(m) ? '저가항공은 화물기를 쓰지 않아요' : '저가항공은 초음속기를 쓰지 않아요';
}

/** 이 회사가 그 해에 들일 수 있는 기종 (여객기·화물기) */
export function modelsFor(c: Pick<Company, 'bizModel'>, year: number): ModelDef[] {
  const model = bizModelOf(c);
  if (model === 'cargo') return availableFreighters(year);
  const pax = availableModels(year);
  return model === 'lcc' ? pax.filter((m) => m.body !== 'sst') : [...pax, ...availableFreighters(year)];
}

/**
 * 컴퓨터·경영 비서가 노선에 넣어 볼 기종: 풀서비스는 여객기만 (화물기는 사람이 직접 고른다),
 * 저가항공은 초음속기 빼고 여객기, 화물 전문은 화물기.
 */
export function planModelsFor(c: Pick<Company, 'bizModel'>, year: number): ModelDef[] {
  return bizModelOf(c) === 'full' ? availableModels(year) : modelsFor(c, year);
}

/** 저가항공의 좌석: 한 등급, 촘촘한 간격 */
export const LCC_CABIN: Cabin = { first: 0, business: 0, pitch: 0 };

/** 새로 들인 비행기의 좌석 배치 (저가항공은 한 등급 촘촘히) */
export function cabinFor(c: Pick<Company, 'bizModel'>, m: ModelDef): Cabin {
  if (bizModelOf(c) === 'lcc' && !fixedCabin(m) && !isFreighter(m)) return { ...LCC_CABIN };
  return defaultCabin(m);
}

/** 이 회사가 이 좌석 배치를 쓸 수 없는 까닭 (저가항공은 고급 좌석이 없다) */
export function bizCabinBlocker(c: Pick<Company, 'bizModel'>, cab: Cabin): string | null {
  if (bizModelOf(c) === 'lcc' && (cab.first > 0 || cab.business > 0)) return '저가항공은 한 등급(일반석)만 둬요';
  return null;
}

// ------------------------------------------------------------------ 바꾸기

/** 사업 모델을 바꾸는 데 걸리는 달 */
export const BIZ_CHANGE_MONTHS = 6;

/** 사업 모델을 바꾸는 값 (브랜드·교육·좌석 바꾸기, 억) */
export function bizChangeCost(c: Pick<Company, 'planes' | 'bizModel'>, to: BizModel): number {
  const pax = c.planes.filter((p) => !isFreighter(MODEL[p.model])).length;
  return Math.round(30 + 4 * c.planes.length + (to === 'lcc' || bizModelOf(c) === 'lcc' ? 3 * pax : 0));
}

/** 사업 모델을 바꿀 수 없는 까닭 (지금 모델을 고르면 바꾸기를 그만둔다) */
export function bizModelBlocker(c: Company, to: BizModel): string | null {
  if (!BIZ_INFO[to]) return '없는 사업 모델이에요';
  const next = c.bizModelNext;
  if (to === bizModelOf(c)) return next ? null : '지금 사업 모델이에요';
  if (next) return next.model === to ? `${mLabel(next.t)}에 바뀌어요` : `${BIZ_INFO[next.model].name}(으)로 바꾸는 중이에요`;
  const cost = bizChangeCost(c, to);
  if (c.cash < cost) return `돈이 모자라요 (${Math.round(cost).toLocaleString('ko-KR')}억 필요)`;
  return null;
}

/**
 * 바꾸기가 끝난 달: 모델을 바꾸고 맞지 않는 비행기는 노선에서 뺀다 (팔거나 돌려주면 돼요).
 * companies는 고쳐도 되는(복사한) 회사들. 바뀌었으면 소식 내용을 돌려준다.
 */
export function settleBizModel(companies: Company[], ci: number, t: number): Omit<NewsItem, 'id' | 't'> | null {
  const c = companies[ci];
  const next = c.bizModelNext;
  if (!next || next.t > t) return null;
  const to = next.model;
  c.bizModel = to;
  c.bizModelNext = null;
  let parked = 0;
  for (const p of c.planes) {
    const m = MODEL[p.model];
    if (!fitsBizModel(to, m)) {
      if (p.legs.length > 0) parked++;
      p.legs = [];
      continue;
    }
    if (to === 'lcc' && !isFreighter(m)) {
      p.cabin = cabinFor(c, m);
      p.meal = 1;
    } else if (to === 'full' && !isFreighter(m) && p.cabin.first === 0 && p.cabin.business === 0 && p.cabin.pitch === 0) {
      p.cabin = defaultCabin(m);
    }
  }
  if (to === 'lcc') {
    c.service = 1;
    if (c.partner !== null) {
      const other = companies[c.partner];
      if (other && other.partner === ci) other.partner = null;
      c.partner = null;
    }
  }
  return {
    icon: BIZ_INFO[to].icon,
    title: `${c.name}: 이제 ${BIZ_INFO[to].name}`,
    text: `${BIZ_INFO[to].desc}.${parked > 0 ? ` 맞지 않는 비행기 ${parked}대는 노선에서 뺐어요 — 팔거나 돌려주세요.` : ''}${c.airline ? ' (게임 속 이야기)' : ''}`,
    tone: 'info',
    for: c.kind === 'human' ? [ci] : undefined,
    company: ci,
  };
}

// ------------------------------------------------------------------ 새 게임

/** 컴퓨터 저가항공·화물 전문 회사의 지어낸 이름 (실제 항공사 이름은 쓰지 않는다) */
export const LCC_NAMES = ['알뜰하늘항공', '종이비행기항공', '콩새항공', '반딧불항공'] as const;
export const CARGO_NAMES = ['짐보따리화물', '두루미화물', '큰날개화물', '부엉이화물'] as const;

/**
 * 새 게임의 사업 모델: 자리마다 고른 대로 (고르지 않으면 풀서비스).
 * 사람이 함께하고 회사가 셋 이상이면, 컴퓨터 하나가 가끔 저가항공(1988년부터)이나 화물 전문이 된다 (지어낸 이름으로).
 * companies[k]는 active[k] 자리의 회사. 고친 회사들을 그대로 돌려준다.
 */
export function assignBizModels(companies: Company[], setup: AirlineSetup, year: number, rng: Rng): Company[] {
  const chosen = (c: Company) => setup.models?.[c.seat] ?? null;
  for (const c of companies) {
    const m = chosen(c);
    if (m && BIZ_INFO[m]) setBizModelAtStart(c, m);
  }
  const ais = companies.filter((c) => c.kind !== 'human' && !chosen(c));
  if (companies.length >= 3 && companies.some((c) => c.kind === 'human') && ais.length > 0 && rng() < 0.4) {
    const pick = ais[ais.length - 1];
    const model: BizModel = year >= 1988 && rng() < 0.6 ? 'lcc' : 'cargo';
    setBizModelAtStart(pick, model);
    pick.airline = null;
    pick.name = (model === 'lcc' ? LCC_NAMES : CARGO_NAMES)[pick.seat % 4];
    // 다른 회사와 겹치지 않는 색 (실제 항공사의 칠 색을 빌리지 않는다)
    const others = companies.filter((c) => c !== pick).map((c) => coColors(c).main);
    const cands = [SEAT_COLORS[pick.seat as 0].main, ...SPECIALIST_COLORS, ...[0, 1, 2, 3].map((i) => SEAT_COLORS[i as 0].main)];
    pick.color = cands.find((x) => others.every((o) => distinctColors(o, x))) ?? null;
  }
  return companies;
}

/** 저가항공·화물 전문 컴퓨터가 고를 수 있는 색 */
const SPECIALIST_COLORS = ['#e8590c', '#8e4ec6', '#12a594', '#d6409f', '#a18072', '#46a758'];

/** 시작할 때 사업 모델을 정한다 (도전 과제·역사 시나리오의 회사도) */
export function setBizModelAtStart(c: Company, model: BizModel): void {
  c.bizModel = model;
  c.bizModelNext = null;
  if (model === 'lcc') c.service = 1;
}
