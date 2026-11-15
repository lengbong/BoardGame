import { mOf } from './time';

/*
 * 실제 항공사의 역사 (값은 어림): 보통 판(시장 변화, industry.ts)과 세계 항공사 모드(world.ts)가 함께 쓰는 한 가지 표.
 * - 보통 판은 그 해 18달 전부터 위기를 겪고, 그 달에 약하면 이대로 되고 튼튼하면 살아남는다.
 * - 세계 항공사 모드는 그 달에 이대로 된다.
 * realAirlines.ts의 defunct(이 해부터 시작 명단에서 빠진다)와 맞춰 둔다: 운명의 해이거나 그다음 해.
 */


export interface AirlineFate {
  /** 실제 항공사 id (realAirlines.ts) */
  id: string;
  year: number;
  month: number;
  /** cease: 문을 닫는다, merge: 다른 회사에 합쳐진다, rename: 이름을 바꾼다 */
  kind: 'cease' | 'merge' | 'rename';
  /** 합친 회사나 새 이름의 실제 항공사 id */
  into?: string;
  /** 목록에 없는 회사에 합쳐졌으면 그 이름 */
  intoName?: string;
  /** 까닭 (실제 역사를 짧게) */
  why: string;
}

export const AIRLINE_FATES: readonly AirlineFate[] = [
  { id: 'boac', year: 1974, month: 4, kind: 'rename', into: 'britishairways', why: '영국유럽항공(BEA)과 합쳐 영국항공이 됐어요.' },
  { id: 'airlanka', year: 1999, month: 1, kind: 'rename', into: 'srilankan', why: '에어랑카가 이름을 스리랑카항공으로 바꿨어요.' },
  { id: 'lan', year: 2016, month: 5, kind: 'rename', into: 'latam', why: '브라질 TAM과 합쳐 라탐항공이 됐어요.' },
  { id: 'panam', year: 1991, month: 12, kind: 'cease', why: '석유 파동과 규제 완화 뒤 빚이 쌓이고, 걸프 전쟁으로 손님이 줄었어요.' },
  { id: 'twa', year: 2001, month: 4, kind: 'merge', into: 'american', why: '오랜 적자와 빚에 시달렸어요.' },
  { id: 'swissair', year: 2001, month: 10, kind: 'cease', why: '다른 항공사 주식을 너무 많이 사들여 빚이 커졌어요.' },
  { id: 'varig', year: 2006, month: 7, kind: 'cease', why: '빚과 경영난이 오래 이어졌어요.' },
  { id: 'northwest', year: 2010, month: 1, kind: 'merge', into: 'delta', why: '9·11 뒤 손님이 줄어 오랫동안 회생 절차를 밟았어요.' },
  { id: 'alitalia', year: 2021, month: 10, kind: 'cease', why: '오랜 적자에 코로나19까지 겹쳤어요.' },
  { id: 'hawaiian', year: 2024, month: 9, kind: 'merge', intoName: '알래스카항공', why: '코로나19 뒤 손님이 늦게 돌아와 알래스카항공과 합치기로 했어요.' },
  { id: 'asiana', year: 2024, month: 12, kind: 'merge', into: 'korean', why: '빚이 쌓여 새 주인을 찾다가 대한항공이 사들이기로 했어요.' },
];

export const FATE: Record<string, AirlineFate> = Object.fromEntries(AIRLINE_FATES.map((f) => [f.id, f]));
/** 운명의 달 (t 번호) */
export const fateT = (f: AirlineFate) => mOf(f.year, f.month);

/** 이 실제 항공사가 이 달(t)에 맞는 운명 (없으면 null) */
export function fateIn(airline: string, t: number): AirlineFate | null {
  const f = FATE[airline];
  return f && fateT(f) === t ? f : null;
}

/** 앞 회사가 판에서 날고 있으면 들어오지 않는 뒤 회사 (이름을 바꾸거나, 문을 닫은 뒤 뒤를 이은 회사) */
export const PREDECESSOR: Record<string, string> = {
  britishairways: 'boac',
  srilankan: 'airlanka',
  latam: 'lan',
  swiss: 'swissair',
  ita: 'alitalia',
};

/** 실제 항공사가 날기 시작한 달 (없으면 그 해 1월) */
export const ENTRY_MONTH: Record<string, number> = {
  airnewzealand: 4,
  korean: 3,
  egyptair: 10,
  singapore: 10,
  malaysia: 10,
  aeromexico: 6,
  gulfair: 1,
  britishairways: 4,
  kenya: 2,
  airlanka: 9,
  emirates: 10,
  asiana: 12,
  airchina: 7,
  chinaeastern: 6,
  vietnam: 4,
  qatar: 1,
  srilankan: 1,
  swiss: 4,
  latam: 5,
  ita: 10,
};
export const entryMonth = (id: string) => ENTRY_MONTH[id] ?? 1;
/** 실제 항공사가 날기 시작하는 달 (t 번호) */
export const entryT = (id: string, founded: number) => mOf(founded, entryMonth(id));
