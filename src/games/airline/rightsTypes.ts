/**
 * 운수권·항공 협정의 타입 (rights.ts). 저장 판 번호는 그대로(4판)이고 새 값은 모두 선택이에요:
 * 없으면(예전 저장·다른 판의 저장) 운수권 규칙을 끈 채로 예전 그대로 놀아요.
 */

/** 운수권: 끄기 / 간단히 / 실제처럼 */
export type RightsMode = 'off' | 'simple' | 'real';

/** 더 받은 운수권: 두 나라(key = '나라|나라') 사이 주간 왕복 횟수 */
export interface TrafficRight {
  key: string;
  /** 기본 횟수에 더 받은 주간 왕복 */
  add: number;
  since: number;
  /** 더 받은 횟수까지 쓴 마지막 달 (오래 안 쓰면 돌려준다) */
  used: number;
}

/** 운수권 신청 (due 달 결산 때 정부가 정한다) */
export interface RightApp {
  key: string;
  add: number;
  due: number;
  fee: number;
}

/** 운수권 장부 (회사 번호 순서) */
export interface RightsBook {
  held: TrafficRight[][];
  apps: RightApp[][];
}

/** 두 나라 사이 운수권을 더 신청한다 */
export type RightsAction = { type: 'applyRights'; key: string };

export type RightsEvent = { id: number; type: 'rights'; company: number; key: string };
