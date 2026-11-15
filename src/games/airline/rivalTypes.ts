/**
 * 라이벌 경영진 성격과 관계의 타입 (personality.ts · relations.ts).
 * 저장 판 번호는 그대로(4판)이고 새 값은 모두 선택이에요:
 * 없으면(예전 저장) 성격은 판마다 정해진 대로 다시 나눠 주고, 관계는 '보통'(0)에서 시작해요.
 */

/** 경영진 성격 (사람 이름 없이 성격 이름과 동물 그림만) */
export type PersonaId = 'expander' | 'saver' | 'service' | 'hub' | 'fare' | 'pioneer';

/** 관계가 바뀐 까닭 한 줄 (by: 컴퓨터 회사, to: 상대 회사, d: 바뀐 값) */
export interface RivalNote {
  by: number;
  to: number;
  t: number;
  d: number;
  text: string;
}

/** 노선 휴전: until 달까지 두 회사 모두 그 노선 일반석 운임을 바닥(floor) 아래로 내리지 않는다 */
export interface Truce {
  /** 컴퓨터 회사 */
  a: number;
  /** 상대 회사 */
  b: number;
  /** 두 도시 (pairKey) */
  key: string;
  since: number;
  until: number;
  floorA: number;
  floorB: number;
}

/** 컴퓨터 회사가 보낸 휴전 제안 (사람이 라이벌 카드에서 정한다) */
export interface RivalOffer {
  id: number;
  from: number;
  to: number;
  key: string;
  until: number;
}

/** 라이벌 장부 (회사 번호 순서) */
export interface RivalBook {
  /** 회사마다 경영진 성격 (사람 회사는 null) */
  persona: (PersonaId | null)[];
  /** rel[i][j]: 컴퓨터 회사 i가 회사 j를 보는 마음 −100…+100 (사람 회사의 줄은 0) */
  rel: number[][];
  /** 최근 까닭 (새것이 뒤) */
  notes: RivalNote[];
  truces: Truce[];
  offers: RivalOffer[];
  /** 마지막으로 인사 방문한 달 visit[사람][컴퓨터] (없으면 아주 옛날) */
  visit: number[][];
  /** 마지막으로 휴전을 청한 달 ask[청한 회사][받은 회사] */
  ask: number[][];
  /** 지난달 본 주식 몫 stakes[i][j] (새로 산 몫을 찾는다) */
  seen?: number[][];
  /** 지난달 같은 동맹이던 두 회사 ('i|j') */
  pals?: string[];
  /** 마지막으로 소식을 낸 사이 말 칸 said[i][j] (오르내림이 잦지 않게) */
  said?: number[][];
}

/** 사람 회사의 외교: 인사 방문(선물) · 노선 휴전 제안 · 컴퓨터가 보낸 휴전 제안에 답하기 · 휴전 먼저 끝내기 */
export type RivalAction =
  | { type: 'rivalVisit'; to: number }
  | { type: 'rivalTruce'; to: number; route: number }
  | { type: 'rivalAnswer'; offer: number; accept: boolean }
  | { type: 'rivalEndTruce'; to: number; key: string };
