import type { AirlineState, Company } from './types';
import type { PersonaId } from './rivalTypes';

/**
 * 라이벌 경영진 성격 (게임 속 이야기).
 *
 * - 컴퓨터 회사마다 경영진 성격이 하나씩 있어요. 사람 이름은 쓰지 않고 성격 이름과 직접 그린 동물 그림(RivalsCard.tsx)만 보여 줘요.
 *   실제 항공사 이름으로 놀아도 성격은 지어낸 이야기예요.
 * - 성격은 '어떻게' 경영하는지(넓히는 빠르기, 남의 노선에 들어가기, 운임 다툼, 기내식, 새·중고 비행기, 동맹·주식)를 바꾸고,
 *   게임 전체의 컴퓨터 성향(느긋·보통·치열)은 '얼마나 세게' 하는지를 그대로 정해요. 둘을 함께 써요.
 * - 성격은 판마다 정해진 대로 나눠요 (회사 이름·본사·시작한 달로 만든 씨앗, rng를 쓰지 않아요).
 *   같은 판의 컴퓨터 회사들은 서로 다른 성격이에요. 저가항공은 서비스 장인·허브 전략가가 되지 않아요.
 * - 컴퓨터가 쓰는 손잡이(knob)는 aiPersonality.ts, 관계는 relations.ts.
 */

export interface PersonaDef {
  id: PersonaId;
  /** 성격 이름 */
  name: string;
  /** 동물 그림 이름 (RivalsCard.tsx의 그림) */
  animal: string;
  /** 한마디 */
  motto: string;
  /** 어떻게 경영하는지 (카드에 보여 준다) */
  desc: string;
  /** 짧은 특징 (카드의 작은 표) */
  traits: readonly string[];
  // ---- 컴퓨터 경영 손잡이 (aiPersonality.ts)
  /** 남겨 두는 현금 배수 */
  reserve: number;
  /** 분기마다 더 여는 새 노선 수 (보통 컴퓨터, 0.34면 세 분기에 하나쯤, 돈이 넉넉할 때만) */
  routes: number;
  /** 같은 두 도시를 나는 라이벌 하나마다 노선 매력을 깎는 정도 (원래 0.6) */
  rivalW: number;
  /** 일반석 운임 바닥·천장에 더하는 값 (%p) */
  fareFloor: number;
  fareCap: number;
  /** 기내식 단계에 더하는 값 */
  meal: number;
  /** 사는 중고 비행기의 가장 많은 나이 (−1이면 중고를 사지 않는다, 원래 14) */
  usedAge: number;
  /** 이 나이가 넘은 비행기를 바꾼다 (원래 20) */
  renewAge: number;
  /** 큰 비행기(+)·작은 비행기(−)를 좋아하는 정도 */
  size: number;
  /** 동맹 제안을 하는 빈도 배수 (받아들일지는 성격이 아니라 사이로 정한다: relations.ts) */
  allyRate: number;
  /** 배당을 보고 주식을 사는 수익률 문턱 배수 (작을수록 잘 산다) */
  invest: number;
  // ---- 관계 (relations.ts)
  /** 나쁜 일에 마음이 상하는 정도 */
  temper: number;
  /** 좋은 일에 마음이 풀리는 정도 */
  warmth: number;
  /** 같은 노선에서 더 싸게 팔면 서운한 정도 */
  fareTemper: number;
  /** 휴전을 받아들이는 쪽으로 기우는 정도 */
  truce: number;
  /** 사이가 아주 나빠지면: routes 상대 노선에 들어가기, fares 같은 노선에서 더 싸게 팔기, none 그냥 겨루기 */
  retaliate: 'routes' | 'fares' | 'none';
  /** 우리 주식을 사 주면 반가워한다 (아니면 경계한다) */
  stakeFriendly: boolean;
}

export const PERSONA_IDS: readonly PersonaId[] = ['expander', 'saver', 'service', 'hub', 'fare', 'pioneer'];

export const PERSONA: Record<PersonaId, PersonaDef> = {
  expander: {
    id: 'expander',
    name: '공격적인 확장가',
    animal: '호랑이',
    motto: '하늘은 넓고 갈 곳은 많아요!',
    desc: '돈이 넉넉하면 노선을 더 빨리 늘리고 붐비는 노선에도 거침없이 들어와요. 새 비행기를 좋아하고 낡은 비행기는 일찍 바꿔요.',
    traits: ['넓히기 빠름', '남의 노선에도 들어옴', '새 비행기'],
    reserve: 1.05,
    routes: 0.34,
    rivalW: 0.45,
    fareFloor: 0,
    fareCap: 0,
    meal: 0,
    usedAge: 8,
    renewAge: 18,
    size: 0.3,
    allyRate: 0.7,
    invest: 1.4,
    temper: 0.9,
    warmth: 0.9,
    fareTemper: 1,
    truce: -10,
    retaliate: 'routes',
    stakeFriendly: false,
  },
  saver: {
    id: 'saver',
    name: '알뜰한 살림꾼',
    animal: '다람쥐',
    motto: '아낀 한 푼이 모여 비행기가 돼요.',
    desc: '돈을 넉넉히 남기고 값싼 중고 비행기를 즐겨 사요. 운임 다툼은 돈 낭비라며 휴전을 좋아하고, 남는 돈은 배당 주식에 넣어요.',
    traits: ['돈을 넉넉히', '중고 비행기', '휴전 좋아함'],
    reserve: 1.1,
    routes: 0,
    rivalW: 0.6,
    fareFloor: 5,
    fareCap: 0,
    meal: -1,
    usedAge: 18,
    renewAge: 23,
    size: 0,
    allyRate: 1,
    invest: 0.7,
    temper: 1,
    warmth: 1.25,
    fareTemper: 1,
    truce: 25,
    retaliate: 'none',
    stakeFriendly: true,
  },
  service: {
    id: 'service',
    name: '서비스 장인',
    animal: '두루미',
    motto: '손님 한 분 한 분이 귀한 손님이에요.',
    desc: '기내식을 한 단계 더 좋게 하고 새 비행기만 들이며 운임은 넉넉히 받아요. 싸게 팔기 다툼은 하지 않고, 서비스상·정시 운항상을 받은 회사를 존경해요.',
    traits: ['기내식 한 단계 위', '새 비행기만', '운임 높게'],
    reserve: 1.1,
    routes: 0,
    rivalW: 0.6,
    fareFloor: 10,
    fareCap: 5,
    meal: 1,
    usedAge: -1,
    renewAge: 16,
    size: 0.4,
    allyRate: 1.2,
    invest: 1,
    temper: 1,
    warmth: 1.1,
    fareTemper: 0.6,
    truce: 15,
    retaliate: 'none',
    stakeFriendly: false,
  },
  hub: {
    id: 'hub',
    name: '허브 전략가',
    animal: '부엉이',
    motto: '모든 길은 우리 허브로 통해요.',
    desc: '본사에서 뻗는 노선을 먼저 열어 갈아타는 손님을 모으고, 돈을 아끼지 않고 키워요. 동맹을 즐겨 맺지만, 본사 노선에 들어오면 무척 서운해해요.',
    traits: ['본사 노선 먼저', '돈을 아끼지 않음', '동맹 좋아함'],
    reserve: 0.9,
    routes: 0.17,
    rivalW: 0.6,
    fareFloor: 0,
    fareCap: 0,
    meal: 0,
    usedAge: 14,
    renewAge: 20,
    size: 0,
    allyRate: 1.4,
    invest: 1,
    temper: 1,
    warmth: 1,
    fareTemper: 1,
    truce: 5,
    retaliate: 'none',
    stakeFriendly: false,
  },
  fare: {
    id: 'fare',
    name: '운임 승부사',
    animal: '여우',
    motto: '더 싸게, 더 자주!',
    desc: '운임을 낮게 매기고 같은 노선 라이벌보다 조금 더 싸게 팔아요. 작은 비행기를 자주 띄우고, 휴전은 잘 받아들이지 않아요.',
    traits: ['운임 낮게', '작은 비행기 자주', '운임 다툼'],
    reserve: 1,
    routes: 0,
    rivalW: 0.6,
    fareFloor: 0,
    fareCap: 0,
    meal: 0,
    usedAge: 14,
    renewAge: 20,
    size: -0.2,
    allyRate: 0.8,
    invest: 1,
    temper: 1,
    warmth: 0.85,
    fareTemper: 1.4,
    truce: -20,
    retaliate: 'fares',
    stakeFriendly: false,
  },
  pioneer: {
    id: 'pioneer',
    name: '새 길 개척자',
    animal: '알바트로스',
    motto: '아무도 안 가 본 하늘길이 제일 좋아요.',
    desc: '라이벌이 없는 노선과 먼 노선을 찾아 열어요. 남의 노선에는 잘 들어가지 않고 사이좋게 지내지만, 자기 노선에 들어오면 서운해해요.',
    traits: ['빈 하늘길 찾기', '먼 노선', '사이좋게'],
    reserve: 1,
    routes: 0,
    rivalW: 0.7,
    fareFloor: 0,
    fareCap: 5,
    meal: 0,
    usedAge: 14,
    renewAge: 20,
    size: 0.3,
    allyRate: 1.3,
    invest: 1,
    temper: 1.2,
    warmth: 1.2,
    fareTemper: 1,
    truce: 15,
    retaliate: 'none',
    stakeFriendly: true,
  },
};

/** 라이벌 성격과 관계를 쓰는 판인지 (설정에서 끌 수 있고, 없으면 켜짐) */
export function rivalsOn(state: Pick<AirlineState, 'options'>): boolean {
  return state.options.personas !== false;
}

/** 글자를 수로 (같은 글이면 늘 같은 수) */
export function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * 상태에서 만드는 0~1 사이 수: 같은 판·같은 값이면 늘 같다.
 * 라이벌 일에 주사위(rng)를 쓰지 않아 다른 무작위(사건·날씨·운항)의 순서를 바꾸지 않는다.
 */
export function hash01(...xs: number[]): number {
  let h = 0x2545f491;
  for (const x of xs) {
    h = Math.imul(h ^ (x | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}

/** 판마다 다른 씨앗 (시작한 달과 회사 이름·본사로) */
export function rivalSalt(state: Pick<AirlineState, 'startT' | 'companies'>): number {
  return strHash(`rivals|${state.startT}|${state.companies.map((c) => `${c.name}@${c.hub}`).join(',')}`);
}

/** 이 사업 모델에 어울리는 성격인지 (저가항공은 서비스 장인·허브 전략가가 아니고, 화물 전문은 서비스 장인이 아니다) */
function fits(c: Pick<Company, 'bizModel'>, id: PersonaId): boolean {
  if (c.bizModel === 'lcc') return id !== 'service' && id !== 'hub';
  if (c.bizModel === 'cargo') return id !== 'service';
  return true;
}

const assignMemo = new WeakMap<readonly Company[], (PersonaId | null)[]>();

/**
 * 판마다 정해진 성격 나누기: 여섯 성격을 판 씨앗으로 섞고, 컴퓨터 회사마다 차례로 사업 모델에 맞는 첫 성격을 준다.
 * (같은 판이면 늘 같고, 컴퓨터 회사끼리 겹치지 않는다)
 */
export function assignPersonas(state: Pick<AirlineState, 'startT' | 'companies'>): (PersonaId | null)[] {
  const hit = assignMemo.get(state.companies);
  if (hit) return hit;
  const salt = rivalSalt(state);
  const deck = [...PERSONA_IDS];
  for (let k = deck.length - 1; k > 0; k--) {
    const j = Math.floor(hash01(salt, k, 77) * (k + 1));
    [deck[k], deck[j]] = [deck[j], deck[k]];
  }
  const out = state.companies.map((c) => {
    if (c.kind === 'human') return null;
    const k = deck.findIndex((id) => fits(c, id));
    if (k < 0) return deck.length ? deck.shift()! : 'saver';
    return deck.splice(k, 1)[0];
  });
  assignMemo.set(state.companies, out);
  return out;
}

/** 이 회사의 경영진 성격 (사람 회사이거나 성격을 끈 판이면 null). 장부에 적힌 것이 먼저, 없으면 판 씨앗으로 */
export function personaOf(state: Pick<AirlineState, 'options' | 'companies' | 'startT' | 'rivals'>, ci: number): PersonaId | null {
  if (!rivalsOn(state)) return null;
  const c = state.companies[ci];
  if (!c || c.kind === 'human') return null;
  const stored = state.rivals?.persona?.[ci];
  if (stored && PERSONA[stored]) return stored;
  return assignPersonas(state)[ci] ?? null;
}

export function personaDef(state: Pick<AirlineState, 'options' | 'companies' | 'startT' | 'rivals'>, ci: number): PersonaDef | null {
  const id = personaOf(state, ci);
  return id ? PERSONA[id] : null;
}

// ------------------------------------------------------------------ 한마디 (뉴스·카드)

export type QuoteKind = 'gift' | 'truceYes' | 'truceNo' | 'up' | 'down' | 'entry' | 'kept' | 'broken' | 'offer' | 'offerNo' | 'award' | 'ended';

/** 성격마다 짧고 다정한 한마디 (놀리거나 깎아내리는 말은 쓰지 않는다) */
export const QUOTES: Record<PersonaId, Record<QuoteKind, string>> = {
  expander: {
    gift: '선물 고마워요! 그래도 노선 넓히기는 안 멈출 거예요.',
    truceYes: '좋아요, 이 노선에서는 잠깐 쉬어 갈게요.',
    truceNo: '지금은 달려야 할 때예요. 다음에 이야기해요!',
    up: '함께 크는 것도 나쁘지 않네요!',
    down: '이 하늘길은 우리도 양보 못 해요!',
    entry: '우리 노선에 오셨군요? 정정당당하게 겨뤄요!',
    kept: '약속을 잘 지켜 줘서 고마워요.',
    broken: '약속이 끝나서 아쉬워요. 이제 다시 힘껏 겨뤄요!',
    offer: '이 노선에서 서로 지치지 말고 잠깐 쉬어요.',
    offerNo: '알겠어요, 그럼 계속 달려 봐요!',
    award: '축하해요! 내년엔 우리가 받을 거예요.',
    ended: '좋은 승부였어요. 또 만나요!',
  },
  saver: {
    gift: '어머, 이런 걸 다… 아껴서 잘 쓸게요!',
    truceYes: '운임 다툼은 돈 낭비예요. 대찬성이에요!',
    truceNo: '지금은 계산이 안 맞아요. 다음에 봐요.',
    up: '든든한 이웃이 생겨서 좋아요!',
    down: '우리 손님을 자꾸 데려가서 조금 서운해요.',
    entry: '같은 노선이네요. 아껴 가며 겨뤄 봐요!',
    kept: '약속을 지켜 줘서 돈도 마음도 아꼈어요.',
    broken: '약속이 끝나 버렸네요. 장부에 적어 둘게요!',
    offer: '서로 싸게 팔면 둘 다 손해예요. 잠깐 쉬어요!',
    offerNo: '그럼 할 수 없죠. 알뜰하게 겨뤄요!',
    award: '상 받은 걸 축하해요! 비결을 배우고 싶어요.',
    ended: '좋은 이웃이었어요. 또 만나요!',
  },
  service: {
    gift: '정성 어린 선물이네요. 정말 고마워요!',
    truceYes: '좋아요. 운임 대신 서비스로 겨뤄요.',
    truceNo: '지금은 손님들께 할 일이 많아서요. 다음에 봬요.',
    up: '서로 배울 점이 많은 회사예요.',
    down: '손님을 위해서라면 우리도 지지 않아요.',
    entry: '어서 오세요. 더 좋은 서비스로 맞이할게요!',
    kept: '약속을 끝까지 지켜 주셔서 감사해요.',
    broken: '약속이 끝나 아쉬워요. 서비스로 다시 만나요!',
    offer: '운임 다툼보다 서비스 겨루기가 손님께 좋아요.',
    offerNo: '알겠어요. 늘 정성을 다할게요.',
    award: '멋진 서비스예요. 진심으로 존경해요!',
    ended: '즐거운 겨루기였어요. 또 뵈어요!',
  },
  hub: {
    gift: '고마워요! 우리 허브에 언제든 들러요.',
    truceYes: '좋아요. 이 노선은 서로 지켜 줘요.',
    truceNo: '이 노선은 우리 허브의 길이라 양보가 어려워요.',
    up: '노선망이 잘 이어지는 사이가 됐어요!',
    down: '우리 허브 길목에 자꾸 들어오면 곤란해요!',
    entry: '우리 허브 노선이네요. 갈아타는 손님은 우리가 더 모을 거예요!',
    kept: '약속 덕분에 허브가 평화로웠어요.',
    broken: '약속이 끝났네요. 허브는 우리가 지킬게요!',
    offer: '이 노선에서 다투지 말고 손님을 잘 이어 줘요.',
    offerNo: '알겠어요. 허브에서 만나요!',
    award: '축하해요! 우리 허브에도 그 기운을 나눠 줘요.',
    ended: '좋은 이웃 허브였어요!',
  },
  fare: {
    gift: '고마워요! 그래도 운임은 우리가 더 쌀 걸요?',
    truceYes: '좋아요, 이번만 운임 다툼을 쉬어요.',
    truceNo: '싸게 팔기는 우리 특기라서 쉴 수 없어요!',
    up: '좋은 맞수예요. 함께 손님을 늘려 봐요!',
    down: '이 노선에서는 운임으로 지지 않을 거예요!',
    entry: '반가워요! 누가 더 싸게 모실지 겨뤄 봐요.',
    kept: '약속을 지켜 줘서 고마워요. 덕분에 숨 돌렸어요.',
    broken: '약속이 끝났으니 다시 할인 시작이에요!',
    offer: '서로 너무 내렸어요. 잠깐 쉬어 가요!',
    offerNo: '좋아요, 그럼 계속 겨뤄요!',
    award: '축하해요! 다음엔 우리가 받을래요.',
    ended: '재미있는 운임 승부였어요!',
  },
  pioneer: {
    gift: '고마워요! 새 하늘길 이야기도 나눠요.',
    truceYes: '좋아요. 서로의 길을 지켜 줘요.',
    truceNo: '지금은 새 길을 찾느라 바빠요. 다음에 이야기해요.',
    up: '함께 넓은 하늘을 나는 친구가 됐어요!',
    down: '우리가 먼저 연 길인데… 조금 서운해요.',
    entry: '우리가 연 하늘길에 오셨네요. 사이좋게 날아요!',
    kept: '약속을 지켜 줘서 하늘이 더 넓어 보여요.',
    broken: '약속이 끝나 아쉬워요. 그래도 하늘은 넓어요!',
    offer: '이 길에서 다투지 말고 각자 새 길을 찾아봐요.',
    offerNo: '알겠어요. 다른 하늘에서 만나요!',
    award: '축하해요! 멋진 비행이었어요.',
    ended: '함께 날아서 즐거웠어요!',
  },
};

/** 한마디 (실제 항공사 이름이면 '(게임 속 이야기)'를 붙인다) */
export function quoteOf(state: Pick<AirlineState, 'options' | 'companies' | 'startT' | 'rivals'>, ci: number, kind: QuoteKind): string {
  const id = personaOf(state, ci);
  if (!id) return '';
  return `“${QUOTES[id][kind]}”${state.companies[ci].airline ? ' (게임 속 이야기)' : ''}`;
}
