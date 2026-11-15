import type { BodyType, ModelDef } from './types';

/**
 * 화물기: 실제로 있던 화물 전용 기종 (값은 모두 근삿값).
 * 짐(톤)은 흔히 싣는 최대 짐, 항속은 짐을 가득 실었을 때의 어림이에요.
 * 운항비는 객실 승무원이 없어 바탕 여객기보다 싸게, 연료는 무거운 짐 때문에 조금 더 들게 어림했어요.
 * 기종표(MODELS)에는 넣지 않고 MODEL(id로 찾기)에만 넣는다 — 여객기 목록·좌석 계산이 화물기를 만나지 않게.
 */
type Row = [
  id: string,
  name: string,
  maker: string,
  base: string,
  body: BodyType,
  engines: number,
  cargo: number,
  range: number,
  speed: number,
  intro: number,
  end: number,
  price: number,
  burn: number,
  hourCost: number,
  runway: 1 | 2 | 3 | 4,
  family: string,
  note: string,
];

const ROWS: Row[] = [
  ['dc8-55f', 'DC-8-55F', 'Douglas', 'dc8-50', 'quad', 4, 40, 6800, 880, 1963, 1972, 820, 7.8, 260, 3, 'DC-8', '옆문이 크게 열리는 초기 제트 화물기'],
  ['b707-320c', '707-320C', 'Boeing', 'b707', 'quad', 4, 40, 6500, 900, 1963, 1979, 840, 7.7, 260, 3, '707', '손님과 짐을 바꿔 실을 수 있는 707'],
  ['b727-100c', '727-100C', 'Boeing', 'b727-100', 'trijet', 3, 18, 3500, 870, 1966, 1972, 430, 4.8, 190, 2, '727', '밤에는 짐, 낮에는 손님을 싣던 727'],
  ['b747-200f', '747-200F', 'Boeing', 'b747-200', 'jumbo', 4, 110, 7900, 910, 1972, 1991, 2250, 14.8, 560, 3, '747', '코가 위로 열리는 점보 화물기'],
  ['dc10-30f', 'DC-10-30F', 'McDonnell Douglas', 'dc10', 'widetri', 3, 70, 6800, 900, 1973, 1988, 1450, 10.2, 420, 3, 'DC-10·MD-11', '세 발 엔진 넓은 동체 화물기'],
  ['b757-200f', '757-200F', 'Boeing', 'b757', 'narrow', 2, 39, 5800, 850, 1987, 2004, 880, 4.5, 230, 2, '757·767', '특송 회사가 많이 쓴 좁은 동체 화물기'],
  ['md11f', 'MD-11F', 'McDonnell Douglas', 'md11', 'widetri', 3, 90, 7300, 900, 1991, 2000, 1700, 9.4, 410, 3, 'DC-10·MD-11', '오래 사랑받은 세 발 엔진 장거리 화물기'],
  ['b747-400f', '747-400F', 'Boeing', 'b747-400', 'jumbo', 4, 112, 8200, 910, 1993, 2009, 2650, 13.0, 550, 3, '747', '대양을 건너는 대표 점보 화물기'],
  ['a300-600f', 'A300-600F', 'Airbus', 'a300-600', 'wide', 2, 48, 4800, 850, 1994, 2007, 1200, 6.7, 320, 2, 'A300·A310', '중거리 넓은 동체 화물기'],
  ['b767-300f', '767-300F', 'Boeing', 'b767-300', 'wide', 2, 52, 6000, 850, 1995, 2040, 1450, 6.7, 320, 2, '757·767', '특송 회사가 많이 쓰는 중형 화물기'],
  ['b777f', '777F', 'Boeing', 'b777-200', 'wide', 2, 102, 9000, 900, 2009, 2040, 2550, 8.0, 430, 3, '777', '연료를 아끼는 쌍발 대형 화물기'],
  ['a330-200f', 'A330-200F', 'Airbus', 'a330-300', 'wide', 2, 65, 7400, 870, 2010, 2020, 1650, 6.5, 350, 3, 'A330·A340', '중장거리 쌍발 화물기'],
  ['b747-8f', '747-8F', 'Boeing', 'b747-400', 'jumbo', 4, 134, 8100, 910, 2011, 2023, 3100, 13.6, 580, 3, '747', '가장 많이 싣는 점보 화물기'],
  ['b737-800bcf', '737-800BCF', 'Boeing', 'b737-800', 'narrow', 2, 23, 3700, 840, 2018, 2040, 520, 3.0, 170, 2, '737', '여객기를 고쳐 만든 작은 화물기 (작은 공항·짧은 노선)'],
];

/** 화물기 목록 (id로 찾을 때는 aircraft.ts의 MODEL) */
export const FREIGHTERS: readonly ModelDef[] = ROWS.map(([id, name, maker, base, body, engines, cargo, range, speed, intro, end, price, burn, hourCost, runway, family, note]) => ({
  id,
  name,
  maker,
  body,
  engines,
  seats: 0,
  range,
  speed,
  intro,
  end,
  price,
  burn,
  hourCost,
  runway,
  comfort: 3,
  family,
  note,
  cargo,
  base,
}));

/** 화물기인지 (좌석 없이 짐만 싣는다) */
export function isFreighter(m: Pick<ModelDef, 'cargo' | 'seats'>): boolean {
  return (m.cargo ?? 0) > 0 && m.seats === 0;
}

/** 그 해에 새로 사거나 리스할 수 있는 화물기 */
export function availableFreighters(year: number): ModelDef[] {
  return FREIGHTERS.filter((m) => m.intro <= year && year <= m.end);
}

/** 크기를 견주는 좌석 수 (화물기는 짐 1톤을 좌석 3개쯤으로) — 공항 이용료·정비사·평균 나이처럼 크기로 재는 곳에 쓴다 */
export function sizeSeats(m: Pick<ModelDef, 'cargo' | 'seats'>): number {
  return m.seats > 0 ? m.seats : (m.cargo ?? 0) * 3;
}

/** '180석' 또는 '화물 112톤' */
export function capacityText(m: Pick<ModelDef, 'cargo' | 'seats'>): string {
  return isFreighter(m) ? `화물 ${m.cargo}톤` : `${m.seats}석`;
}
