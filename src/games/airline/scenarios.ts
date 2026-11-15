import { MODEL } from './aircraft';
import { CITY, dist, pairKey } from './cities';
import { isFreighter } from './freighters';
import { polity } from './politics';
import { companyValue, regionsServed, routeFreq } from './simulate';
import { mLabel, mOf, yearOfM } from './time';
import type { ChallengeDef } from './challenges';
import type { RightsMode } from './rightsTypes';
import type { ScenarioProgress } from './scenarioTypes';
import type { AiStyle, AirlineState, BodyType, Company, ModelDef } from './types';

/**
 * 역사 시나리오: 실제 항공 역사의 한 시대(제트기·점보기·석유 파동·규제 완화·화물 붐·하늘 개방·저가항공 붐)에
 * 정해 둔 회사로 시작해, 단계 목표를 차례로 이루는 혼자 하기 놀이. 도전 과제(challenges.ts)의 시작 틀
 * (본사·돈·빚·처음 비행기와 노선·라이벌)을 그대로 쓰고, 단계 목표·별·시대 규칙(운수권·실제 역사·컴퓨터 성향)을 더한다.
 *
 * 시대의 큰 흐름(언제 어떤 비행기가 나왔는지, 석유 파동, 미국 규제 완화, 하늘 개방 협정)은 실제 역사를 어림해
 * 따랐지만, 회사와 이야기는 모두 이 게임을 위해 지은 것이에요. 실제 항공사 이름이 라이벌로 나와도 게임 속 이야기예요.
 * 사건은 '실제 역사' 설정이 이미 가진 것만 쓰고 새로 더하지 않는다.
 *
 * 순수 함수만 둔다 (rules.ts를 부르지 않는다).
 */

// ------------------------------------------------------------------ 목표

/** 비행기 종류 (목표에서 세는 것) */
export type PlaneKind = 'any' | 'jet' | 'prop' | 'wide' | 'jumbo' | 'freighter' | 'bigFreighter' | 'thrifty' | 'thirsty';

export type ScenarioGoal =
  /** 띄우는 노선 n개 (intl: 나라 밖으로 가는 노선만, minKm: 이만큼 넘는 노선만) */
  | { kind: 'routes'; n: number; intl?: boolean; minKm?: number }
  /** 비행기 n대 (fly: 노선에 띄우는 비행기만) */
  | { kind: 'planes'; n: number; type: PlaneKind; fly?: boolean }
  /** 그 종류 비행기를 max대까지만 (0이면 모두 정리) */
  | { kind: 'fewPlanes'; max: number; type: PlaneKind }
  | { kind: 'regions'; n: number }
  /** 본사 나라 밖의 나라 n곳에 취항 */
  | { kind: 'countries'; n: number }
  | { kind: 'value'; v: number }
  /** 회사 가치 r등 안 */
  | { kind: 'rank'; r: number }
  | { kind: 'debt'; max: number }
  /** 최근 석 달 손님 */
  | { kind: 'pax3'; n: number }
  /** 최근 석 달 실은 화물 (톤) */
  | { kind: 'cargo3'; t: number }
  /** 최근 석 달 우리 노선에서 갈아탄 손님 */
  | { kind: 'xfer3'; n: number }
  /** 라이벌도 나는 노선 가운데 우리가 손님을 절반 넘게 태우는 노선 n개 */
  | { kind: 'contested'; n: number }
  /** n분기 잇달아 흑자 */
  | { kind: 'streak'; n: number }
  /** from년부터 한 해(1~12월)를 흑자로 마치기 */
  | { kind: 'yearProfit'; from: number }
  | { kind: 'reputation'; n: number };

export interface GoalStatus {
  /** '제트기 2대 들이기' */
  label: string;
  /** '1 / 2' */
  text: string;
  ok: boolean;
  /** 0~1 (막대) */
  ratio: number;
}

export interface ScenarioStage {
  title: string;
  /** 이 단계를 마치면 뜨는 이야기 */
  story: string;
  goals: ScenarioGoal[];
}

export interface ScenarioDef extends ChallengeDef {
  /** 시대 이름 (카드 띠) */
  era: string;
  /** 카드 그림에 그리는 대표 기종 */
  art: string;
  /** 카드 하늘 색 [위, 아래] */
  sky: [string, string];
  /** 카드 비행기 칠 [몸통 줄, 꼬리] */
  livery: [string, string];
  rights: RightsMode;
  history: boolean;
  aiStyle: AiStyle;
  stages: ScenarioStage[];
  /** 이 달(포함)까지 [해, 달] — 이때까지 못 이루면 실패 */
  end: [number, number];
  /** 이 달(포함)까지 마치면 별 하나 더 */
  fast: [number, number];
  /** 마칠 때 이 목표도 이루고 있으면 별 하나 더 */
  bonus: { text: string; goal: ScenarioGoal };
  /** 도움말 */
  tips: string[];
}

// ------------------------------------------------------------------ 숫자 글

/** '1,234억' · '1.2조' */
export function money(v: number): string {
  const r = Math.round(v);
  if (Math.abs(r) >= 10000) return `${(r / 10000).toFixed(1).replace(/\.0$/, '')}조`;
  return `${r.toLocaleString('ko-KR')}억`;
}

/** '12만' · '3,500' */
export function people(n: number): string {
  const r = Math.round(n);
  if (r >= 10000) return `${(r / 10000).toFixed(r >= 100000 ? 0 : 1).replace(/\.0$/, '')}만`;
  return r.toLocaleString('ko-KR');
}

// ------------------------------------------------------------------ 시나리오 목록

export const SCENARIOS: readonly ScenarioDef[] = [
  {
    id: 'jetage',
    emoji: '✈️',
    title: '제트 시대의 시작',
    era: '1960년대 · 제트기 시대',
    art: 'b707',
    sky: ['#8fc7ef', '#f6e7c1'],
    livery: ['#d64545', '#9e2b2b'],
    story:
      '1963년 도쿄. 하늘에는 아직 프로펠러기가 많지만, 두 배 가까이 빠른 제트기가 막 나오기 시작했어요. 이듬해에는 도쿄에서 올림픽도 열려요. 낡은 프로펠러기 세 대뿐인 작은 회사를 바다 건너까지 나는 제트기 항공사로 바꿔 봐요!',
    goal: '제트기를 들이고, 바다 건너 먼 하늘길을 열고, 프로펠러기와 작별해요',
    year: 1963,
    month: 1,
    hub: 'tokyo',
    cash: 1400,
    debt: 300,
    credit: 1500,
    years: 8,
    branches: ['tokyo', 'osaka', 'seoul'],
    fleet: [
      { model: 'f27', age: 4, route: ['tokyo', 'osaka'], freq: 21 },
      { model: 'f27', age: 3, route: ['tokyo', 'seoul'], freq: 10 },
      { model: 'f27', age: 5, route: ['osaka', 'seoul'], freq: 10 },
    ],
    rivals: [
      { kind: 'ai-normal', hub: 'hongkong', cash: 2200, branches: ['taipei', 'bangkok'], fleet: [{ model: 'caravelle', age: 2, route: ['hongkong', 'taipei'], freq: 10 }, { model: 'caravelle', age: 1, route: ['hongkong', 'bangkok'], freq: 7 }] },
      { kind: 'ai-easy', hub: 'losangeles', cash: 2500, branches: ['honolulu', 'sanfrancisco'], fleet: [{ model: 'b707', age: 1, route: ['losangeles', 'honolulu'], freq: 7 }, { model: 'f27', age: 3, route: ['losangeles', 'sanfrancisco'], freq: 14 }] },
    ],
    stars: 1,
    rights: 'simple',
    history: true,
    aiStyle: 'normal',
    stages: [
      {
        title: '제트기를 만나요',
        story: '첫 제트기가 도착했어요! 프로펠러기보다 두 배 가까이 빨라서 손님들이 깜짝 놀라요. 이제 제트기로 더 먼 곳까지 가 봐요.',
        goals: [{ kind: 'planes', n: 2, type: 'jet' }],
      },
      {
        title: '바다 건너 제트 하늘길',
        story: '제트기가 바다를 훌쩍 건너요. 먼 나라 손님들이 우리 비행기를 타고 도쿄로 와요. 이제 낡은 프로펠러기를 정리할 때예요.',
        goals: [
          { kind: 'routes', n: 2, minKm: 4000 },
          { kind: 'regions', n: 4 },
        ],
      },
      {
        title: '프로펠러기와 작별',
        story: '마지막 프로펠러기가 박물관으로 떠났어요. 이제 우리는 바다 건너까지 나는 어엿한 제트기 항공사예요!',
        goals: [
          { kind: 'fewPlanes', max: 0, type: 'prop' },
          { kind: 'planes', n: 12, type: 'jet', fly: true },
          { kind: 'value', v: 8000 },
        ],
      },
    ],
    end: [1970, 12],
    fast: [1967, 6],
    bonus: { text: '회사 가치 1등으로 마치기', goal: { kind: 'rank', r: 1 } },
    tips: ['도쿄–서울은 공항이 작아 카라벨 같은 작은 제트기만 내려요.', '707·DC-8은 큰 공항(3등급)이 있는 먼 도시로 보내요.', '1964년 10월 도쿄 올림픽 때는 도쿄 손님이 크게 늘어요.'],
  },
  {
    id: 'jumbo',
    emoji: '🐘',
    title: '큰 비행기의 시대',
    era: '1970년대 · 점보기와 허브',
    art: 'b747-100',
    sky: ['#9ccaf0', '#e9eef7'],
    livery: ['#2f6fd6', '#1f4a94'],
    story:
      '1970년 암스테르담. 손님 400명을 한꺼번에 싣는 747 점보기가 막 하늘에 올랐고, 우리 회사에도 첫 점보기가 도착했어요. 넓은 동체기로 여러 도시 손님을 우리 공항에 모아 갈아태우는 ‘허브’를 만들어, 런던·파리·프랑크푸르트의 라이벌보다 큰 항공사가 돼 봐요.',
    goal: '넓은 동체기를 늘리고, 갈아타는 손님을 모으고, 네 지역을 잇는 큰 항공사가 돼요',
    year: 1970,
    month: 1,
    hub: 'amsterdam',
    cash: 3000,
    debt: 600,
    credit: 2500,
    years: 10,
    branches: ['amsterdam', 'newyork', 'toronto', 'london', 'paris', 'rome'],
    fleet: [
      { model: 'b747-100', age: 0, leased: true, route: ['amsterdam', 'newyork'], freq: 7 },
      { model: 'dc8-63', age: 2, route: ['amsterdam', 'newyork'], freq: 4 },
      { model: 'dc8-63', age: 3, route: ['amsterdam', 'toronto'], freq: 5 },
      { model: 'dc9', age: 2, route: ['amsterdam', 'london'], freq: 21 },
      { model: 'dc9', age: 2, route: ['amsterdam', 'paris'], freq: 14 },
      { model: 'dc9', age: 3, route: ['amsterdam', 'rome'], freq: 7 },
    ],
    rivals: [
      { kind: 'ai-normal', hub: 'london', cash: 3000, branches: ['newyork', 'paris'], fleet: [{ model: 'b707', age: 5, route: ['london', 'newyork'], freq: 10 }, { model: 'b707', age: 4, route: ['london', 'newyork'], freq: 4 }, { model: 'b727-100', age: 3, route: ['london', 'paris'], freq: 21 }] },
      { kind: 'ai-normal', hub: 'paris', cash: 3000, branches: ['newyork', 'rome'], fleet: [{ model: 'b707', age: 4, route: ['paris', 'newyork'], freq: 10 }, { model: 'caravelle', age: 8, route: ['paris', 'rome'], freq: 14 }] },
      { kind: 'ai-easy', hub: 'frankfurt', cash: 2500, branches: ['london'], fleet: [{ model: 'b727-100', age: 4, route: ['frankfurt', 'london'], freq: 14 }] },
    ],
    stars: 2,
    rights: 'simple',
    history: true,
    aiStyle: 'normal',
    stages: [
      {
        title: '넓은 동체기 무리',
        story: '통로가 두 줄인 넓은 동체기가 두 대나 우리 하늘을 날아요! 좌석이 많아 손님 한 명을 태우는 값이 싸졌어요. 이제 여러 도시 손님을 암스테르담에 모아 큰 비행기를 가득 채워 봐요.',
        goals: [{ kind: 'planes', n: 2, type: 'wide', fly: true }],
      },
      {
        title: '갈아타는 공항',
        story: '유럽 곳곳의 손님이 암스테르담에서 갈아타고 대서양을 건너요. 우리 공항이 진짜 ‘허브’가 됐어요!',
        goals: [{ kind: 'xfer3', n: 40000 }],
      },
      {
        title: '네 지역을 잇는 큰 항공사',
        story: '암스테르담에서 세계 네 지역으로 가는 비행기가 떠요. 큰 비행기의 시대를 이끄는 큰 항공사가 됐어요!',
        goals: [
          { kind: 'regions', n: 4 },
          { kind: 'value', v: 35000 },
        ],
      },
    ],
    end: [1979, 12],
    fast: [1976, 6],
    bonus: { text: '회사 가치 1등으로 마치기', goal: { kind: 'rank', r: 1 } },
    tips: ['747·DC-10·L-1011·A300이 넓은 동체기예요. 비싸니 리스로 들이면 바로 띄울 수 있어요.', '여러 유럽 도시와 뉴욕을 모두 암스테르담에 이으면 갈아타는 손님이 늘어요.', '1973년 가을에는 석유 파동이 와요.'],
  },
  {
    id: 'oilshock',
    emoji: '🛢️',
    title: '석유 파동 버티기',
    era: '1973년 · 석유 파동',
    art: 'a300b4',
    sky: ['#f2b880', '#f8e6c8'],
    livery: ['#e07b1f', '#a8560f'],
    story:
      '1973년 여름 마드리드. 우리 회사에는 707·카라벨처럼 기름을 많이 먹는 비행기와 큰 빚이 있어요. 그런데 가을이면 기름값이 크게 뛸 거라는 이야기가 들려요. 연료를 아끼는 비행기로 바꾸고 빚을 줄여 폭풍을 버텨 봐요!',
    goal: '연료를 아끼는 비행기로 바꾸고, 기름값이 비싼 해를 흑자로 마치고, 빚을 줄여요',
    year: 1973,
    month: 7,
    hub: 'madrid',
    cash: 900,
    debt: 1500,
    credit: 2600,
    years: 6,
    branches: ['madrid', 'newyork', 'mexicocity', 'london', 'paris', 'barcelona', 'rome'],
    fleet: [
      { model: 'b707', age: 9, route: ['madrid', 'newyork'], freq: 7 },
      { model: 'b707', age: 8, route: ['madrid', 'mexicocity'], freq: 4 },
      { model: 'caravelle', age: 11, route: ['madrid', 'barcelona'], freq: 21 },
      { model: 'caravelle', age: 10, route: ['madrid', 'paris'], freq: 14 },
      { model: 'caravelle', age: 9, route: ['madrid', 'london'], freq: 10 },
      { model: 'b727-100', age: 6, route: ['madrid', 'rome'], freq: 10 },
    ],
    rivals: [
      { kind: 'ai-normal', hub: 'london', cash: 2800, branches: ['newyork', 'madrid'], fleet: [{ model: 'b707', age: 6, route: ['london', 'newyork'], freq: 10 }, { model: 'b727-200', age: 2, route: ['london', 'madrid'], freq: 10 }] },
      { kind: 'ai-normal', hub: 'rome', cash: 2800, branches: ['paris', 'newyork'], fleet: [{ model: 'dc8-63', age: 4, route: ['rome', 'newyork'], freq: 7 }, { model: 'dc9', age: 3, route: ['rome', 'paris'], freq: 14 }] },
    ],
    stars: 2,
    rights: 'simple',
    history: true,
    aiStyle: 'normal',
    stages: [
      {
        title: '연료를 아끼는 비행기',
        story: '새 비행기들은 손님 한 명을 태울 때 기름을 훨씬 덜 먹어요. 기름값이 뛰어도 이제 버틸 힘이 생겼어요.',
        goals: [{ kind: 'planes', n: 4, type: 'thrifty', fly: true }],
      },
      {
        title: '폭풍 속 흑자',
        story: '기름값이 비싼 해였는데도 한 해를 흑자로 마쳤어요! 은행과 손님들이 우리 회사를 다시 믿기 시작해요.',
        goals: [{ kind: 'yearProfit', from: 1974 }],
      },
      {
        title: '빚을 줄인 튼튼한 회사',
        story: '빚을 크게 줄였어요. 석유 파동을 이겨 낸 튼튼한 항공사, 다음 폭풍이 와도 걱정 없어요!',
        goals: [
          { kind: 'debt', max: 300 },
          { kind: 'value', v: 7000 },
        ],
      },
    ],
    end: [1978, 12],
    fast: [1976, 6],
    bonus: { text: '기름 먹는 비행기(707·카라벨·727-100 등) 모두 정리', goal: { kind: 'fewPlanes', max: 0, type: 'thirsty' } },
    tips: ['석유 파동이 오기 전에 연료 탱크에 기름을 사 두면 아껴요 (재무 화면).', '737·DC-9·A300 같은 비행기가 손님 한 명당 기름을 덜 먹어요.', '손해 보는 노선은 줄이고 낡은 비행기는 팔아 빚을 갚아요.'],
  },
  {
    id: 'dereg',
    emoji: '🎟️',
    title: '하늘길 자유화',
    era: '1978년 · 미국 규제 완화',
    art: 'b737-200',
    sky: ['#a7d3f2', '#fde2c4'],
    livery: ['#12a594', '#0b7468'],
    story:
      '1978년 샌프란시스코. 미국에서 곧 항공 규제가 풀려 누구나 노선과 운임을 정할 수 있게 된대요. 우리는 비행기 두 대뿐인 작은 저가항공! 커다란 풀서비스 항공사들 사이에서 싼 운임과 빠른 회전으로 손님을 모아 봐요.',
    goal: '노선을 늘리고, 손님을 많이 모아, 큰 항공사와 겨루는 노선에서 손님을 더 많이 태워요',
    year: 1978,
    month: 7,
    hub: 'sanfrancisco',
    cash: 800,
    credit: 900,
    years: 9,
    model: 'lcc',
    branches: ['sanfrancisco', 'losangeles'],
    fleet: [
      { model: 'b737-200', age: 8, leased: true, route: ['sanfrancisco', 'losangeles'], freq: 28, fare: -15 },
      { model: 'b737-200', age: 7, leased: true, route: ['sanfrancisco', 'losangeles'], freq: 21, fare: -15 },
    ],
    rivals: [
      {
        kind: 'ai-normal',
        hub: 'newyork',
        cash: 3500,
        branches: ['losangeles', 'sanfrancisco', 'chicago', 'miami'],
        fleet: [
          { model: 'b747-100', age: 6, route: ['newyork', 'losangeles'], freq: 7 },
          { model: 'dc10', age: 4, route: ['newyork', 'sanfrancisco'], freq: 7 },
          { model: 'b727-200', age: 6, route: ['newyork', 'chicago'], freq: 14 },
          { model: 'b727-200', age: 5, route: ['newyork', 'miami'], freq: 14 },
        ],
      },
      {
        kind: 'ai-normal',
        hub: 'chicago',
        cash: 3200,
        branches: ['losangeles', 'sanfrancisco', 'miami'],
        fleet: [
          { model: 'b727-200', age: 7, route: ['chicago', 'losangeles'], freq: 10 },
          { model: 'b727-200', age: 6, route: ['chicago', 'sanfrancisco'], freq: 10 },
          { model: 'dc10', age: 5, route: ['chicago', 'miami'], freq: 7 },
        ],
      },
    ],
    stars: 3,
    rights: 'simple',
    history: true,
    aiStyle: 'normal',
    stages: [
      {
        title: '새 노선 넓히기',
        story: '규제가 풀려 어디든 날 수 있어요! 싼 운임 소문이 퍼져 처음 비행기를 타 보는 손님들이 우리 공항에 줄을 서요.',
        goals: [{ kind: 'routes', n: 4 }],
      },
      {
        title: '손님이 몰려와요',
        story: '석 달 동안 손님이 이렇게 많이! 큰 항공사들이 우리 운임을 보고 깜짝 놀랐어요.',
        goals: [{ kind: 'pax3', n: 200000 }],
      },
      {
        title: '큰 항공사와 겨뤄 이겨요',
        story: '큰 항공사와 같은 노선을 날아도 손님들이 우리 비행기를 더 많이 골라요. 작은 저가항공이 하늘길 자유화의 주인공이 됐어요!',
        goals: [
          { kind: 'contested', n: 2 },
          { kind: 'value', v: 3000 },
        ],
      },
    ],
    end: [1987, 6],
    fast: [1984, 12],
    bonus: { text: '8분기 잇달아 흑자', goal: { kind: 'streak', n: 8 } },
    tips: ['저가항공은 좌석이 촘촘하고 비행기를 빨리 돌려요. 가까운 큰 도시끼리 자주 띄워요.', '규제가 풀린 1978년 10월부터 아메리카 손님이 늘어요.', '1979년에는 기름값이 다시 뛰어요. 연료를 아끼는 737이 좋아요.'],
  },
  {
    id: 'cargo',
    emoji: '📦',
    title: '화물 하늘길',
    era: '1980년대 · 무역 붐',
    art: 'b747-200f',
    sky: ['#9fc4e6', '#efe2cf'],
    livery: ['#8a5a2b', '#5e3c1b'],
    story:
      '1985년 홍콩. 공장에서 만든 물건이 배와 비행기를 타고 세계로 쏟아져 나가요. 우리는 손님 없이 짐만 나르는 작은 화물 항공사! 낡은 707 화물기 두 대로 시작해 아시아의 짐을 세계로 실어 날라 봐요.',
    goal: '화물기를 늘리고, 짐을 많이 나르고, 네 지역을 잇는 흑자 회사가 돼요',
    year: 1985,
    month: 1,
    hub: 'hongkong',
    cash: 1600,
    debt: 400,
    credit: 1800,
    years: 9,
    model: 'cargo',
    branches: ['hongkong', 'tokyo', 'singapore'],
    fleet: [
      { model: 'b707-320c', age: 16, route: ['hongkong', 'tokyo'], freq: 7 },
      { model: 'b707-320c', age: 15, route: ['hongkong', 'singapore'], freq: 7 },
    ],
    rivals: [
      { kind: 'ai-normal', hub: 'tokyo', cash: 3500, branches: ['hongkong', 'singapore'], fleet: [{ model: 'b747-200', age: 6, route: ['tokyo', 'hongkong'], freq: 7 }, { model: 'dc10', age: 7, route: ['tokyo', 'singapore'], freq: 7 }] },
      { kind: 'ai-normal', hub: 'singapore', cash: 3200, branches: ['hongkong'], fleet: [{ model: 'b747-200', age: 5, route: ['singapore', 'hongkong'], freq: 7 }] },
      { kind: 'ai-easy', hub: 'taipei', cash: 1800, name: '두루미화물', model: 'cargo', branches: ['tokyo'], fleet: [{ model: 'b707-320c', age: 14, route: ['taipei', 'tokyo'], freq: 7 }] },
    ],
    stars: 2,
    rights: 'simple',
    history: true,
    aiStyle: 'normal',
    stages: [
      {
        title: '화물기 무리',
        story: '화물기가 여섯 대가 됐어요! 밤마다 짐을 가득 싣고 아시아 하늘을 날아요.',
        goals: [{ kind: 'planes', n: 6, type: 'freighter', fly: true }],
      },
      {
        title: '짐이 산더미',
        story: '석 달 동안 나른 짐이 산더미처럼 쌓였어요. 공장과 가게들이 우리 회사를 먼저 찾아요.',
        goals: [{ kind: 'cargo3', t: 100000 }],
      },
      {
        title: '세계로 가는 짐',
        story: '홍콩의 짐이 네 지역으로 날아가고, 한 해 내내 흑자예요. 아시아에서 가장 믿음직한 화물 항공사가 됐어요!',
        goals: [
          { kind: 'regions', n: 4 },
          { kind: 'streak', n: 4 },
          { kind: 'value', v: 20000 },
        ],
      },
    ],
    end: [1992, 12],
    fast: [1989, 6],
    bonus: { text: '석 달 동안 화물 25만 톤 나르기', goal: { kind: 'cargo3', t: 250000 } },
    tips: ['짐은 무역 도시(홍콩·도쿄·싱가포르·프랑크푸르트·뉴욕…)끼리, 10~12월에 가장 많아요.', '747-200F·DC-10-30F 같은 넓은 동체 화물기가 많이 실어요.', '라이벌 여객기도 배 아래 짐칸에 화물을 실어요.'],
  },
  {
    id: 'openskies',
    emoji: '🕊️',
    title: '하늘 개방 시대',
    era: '1990년대 · 하늘 개방 협정',
    art: 'b777-200',
    sky: ['#86c5ee', '#d9f0ea'],
    livery: ['#2f9a6e', '#1d6b4b'],
    story:
      '1996년 싱가포르. 나라와 나라가 ‘하늘 개방 협정’을 하나둘 맺으며 날 수 있는 횟수 제한이 사라지고 있어요. 운수권을 따내고 열린 하늘길을 먼저 잡아, 싱가포르를 세계를 잇는 갈아타기 공항으로 만들어 봐요!',
    goal: '여러 나라에 취항하고, 다섯 지역을 잇고, 갈아타는 손님이 많은 1등 항공사가 돼요',
    year: 1996,
    month: 1,
    hub: 'singapore',
    cash: 2400,
    debt: 500,
    credit: 2400,
    years: 10,
    branches: ['singapore', 'kualalumpur', 'bangkok', 'jakarta', 'hongkong'],
    fleet: [
      { model: 'b737-300', age: 6, route: ['singapore', 'kualalumpur'], freq: 21 },
      { model: 'b737-300', age: 5, route: ['singapore', 'jakarta'], freq: 14 },
      { model: 'a310', age: 8, route: ['singapore', 'bangkok'], freq: 10 },
      { model: 'a310', age: 7, route: ['singapore', 'hongkong'], freq: 7 },
    ],
    rivals: [
      { kind: 'ai-normal', hub: 'hongkong', cash: 3500, branches: ['singapore', 'bangkok'], fleet: [{ model: 'b747-400', age: 4, route: ['hongkong', 'singapore'], freq: 7 }, { model: 'a330-300', age: 1, route: ['hongkong', 'bangkok'], freq: 10 }] },
      { kind: 'ai-normal', hub: 'bangkok', cash: 3000, branches: ['singapore', 'hongkong'], fleet: [{ model: 'a300-600', age: 5, route: ['bangkok', 'singapore'], freq: 10 }, { model: 'a300-600', age: 6, route: ['bangkok', 'hongkong'], freq: 7 }] },
      { kind: 'ai-easy', hub: 'sydney', cash: 3000, branches: ['singapore'], fleet: [{ model: 'b767-300', age: 4, route: ['sydney', 'singapore'], freq: 7 }] },
    ],
    stars: 3,
    rights: 'real',
    history: true,
    aiStyle: 'normal',
    stages: [
      {
        title: '열린 하늘로',
        story: '싱가포르에서 여덟 나라로 비행기가 떠요. 하늘 개방 협정을 맺은 나라는 횟수 걱정 없이 마음껏 날 수 있어요.',
        goals: [{ kind: 'countries', n: 8 }],
      },
      {
        title: '다섯 지역을 잇다',
        story: '아시아에서 유럽·중동·대양주까지! 세계 다섯 지역 손님이 싱가포르를 거쳐 가요.',
        goals: [{ kind: 'regions', n: 5 }],
      },
      {
        title: '세계의 갈아타기 공항',
        story: '석 달 동안 수많은 손님이 싱가포르에서 갈아탔어요. 하늘 개방 시대의 1등 항공사가 됐어요!',
        goals: [
          { kind: 'xfer3', n: 60000 },
          { kind: 'rank', r: 1 },
        ],
      },
    ],
    end: [2005, 12],
    fast: [2002, 6],
    bonus: { text: '나라 밖 24개 나라에 취항하기', goal: { kind: 'countries', n: 24 } },
    tips: ['‘실제처럼’ 운수권: 외국과 외국 사이 노선은 신청해야 날 수 있어요 (노선 화면).', '하늘 개방 협정을 맺은 나라(미국 1995, 한국·말레이시아 1998 …)는 횟수 제한이 없어요.', '1997년 여름 아시아 외환 위기로 한동안 손님이 줄어요.'],
  },
  {
    id: 'lccboom',
    emoji: '🎒',
    title: '새 천년의 저가항공',
    era: '2000년대 · 저가항공 붐',
    art: 'b737-800',
    sky: ['#9bd2f5', '#fff0c9'],
    livery: ['#e8590c', '#a63f06'],
    story:
      '2003년 바르셀로나. 인터넷으로 표를 사고 짐 값을 따로 받는 저가항공이 유럽 하늘을 바꾸고 있어요. 유럽 나라끼리는 하늘이 활짝 열려 있지요. 737 세 대로 시작해 런던·파리의 큰 항공사보다 손님을 더 많이 태워 봐요!',
    goal: '노선을 넓히고, 손님을 아주 많이 태우고, 큰 항공사와 겨루는 노선에서 손님을 더 많이 태워요',
    year: 2003,
    month: 1,
    hub: 'barcelona',
    cash: 900,
    credit: 900,
    years: 10,
    model: 'lcc',
    branches: ['barcelona', 'london', 'paris', 'rome'],
    fleet: [
      { model: 'b737-800', age: 3, leased: true, route: ['barcelona', 'london'], freq: 21 },
      { model: 'b737-800', age: 2, leased: true, route: ['barcelona', 'paris'], freq: 21 },
      { model: 'b737-800', age: 2, leased: true, route: ['barcelona', 'rome'], freq: 14 },
    ],
    rivals: [
      {
        kind: 'ai-normal',
        hub: 'london',
        cash: 4000,
        branches: ['paris', 'newyork', 'barcelona'],
        fleet: [
          { model: 'b777-200', age: 4, route: ['london', 'newyork'], freq: 14 },
          { model: 'a320', age: 6, route: ['london', 'paris'], freq: 28 },
          { model: 'a320', age: 5, route: ['london', 'barcelona'], freq: 14 },
        ],
      },
      {
        kind: 'ai-normal',
        hub: 'paris',
        cash: 3800,
        branches: ['rome', 'newyork', 'barcelona'],
        fleet: [
          { model: 'a340-300', age: 5, route: ['paris', 'newyork'], freq: 10 },
          { model: 'a320', age: 6, route: ['paris', 'rome'], freq: 21 },
          { model: 'a321', age: 4, route: ['paris', 'barcelona'], freq: 14 },
        ],
      },
      { kind: 'ai-easy', hub: 'milan', cash: 900, name: '콩새항공', model: 'lcc', branches: ['london'], fleet: [{ model: 'a320', age: 4, leased: true, route: ['milan', 'london'], freq: 21 }] },
    ],
    stars: 2,
    rights: 'simple',
    history: true,
    aiStyle: 'normal',
    stages: [
      {
        title: '유럽 곳곳으로',
        story: '노선이 여덟 개! 주말마다 싼 표로 바닷가와 옛 도시를 찾는 여행객이 우리 비행기를 가득 채워요.',
        goals: [{ kind: 'routes', n: 8 }],
      },
      {
        title: '백만 손님',
        story: '석 달 동안 손님이 백만 명이 넘었어요! 바르셀로나 공항이 우리 비행기로 북적여요.',
        goals: [{ kind: 'pax3', n: 1000000 }],
      },
      {
        title: '큰 항공사와 겨뤄 이겨요',
        story: '비행기 30대의 저가항공이 큰 항공사와 같은 노선에서 손님을 더 많이 태워요. 새 천년 하늘의 주인공이에요!',
        goals: [
          { kind: 'planes', n: 30, type: 'any', fly: true },
          { kind: 'contested', n: 3 },
          { kind: 'value', v: 20000 },
        ],
      },
    ],
    end: [2010, 12],
    fast: [2007, 6],
    bonus: { text: '평판 65 넘기기', goal: { kind: 'reputation', n: 65 } },
    tips: ['저가항공은 가까운 큰 도시와 휴양지를 자주 잇는 게 좋아요.', '유럽 나라끼리는 하늘 개방 협정이라 횟수 제한이 없어요.', '2008년 가을 금융 위기 때는 손님이 줄어요.'],
  },
];

export const SCENARIO: Record<string, ScenarioDef> = Object.fromEntries(SCENARIOS.map((d) => [d.id, d]));

/** 시작하는 달 */
export const startOf = (def: ScenarioDef) => mOf(def.year, def.month ?? 1);
/** 끝나는 달 (이 달 결산이 마지막) */
export const endOf = (def: ScenarioDef) => mOf(def.end[0], def.end[1]);
/** 별 하나 더 받는 마지막 달 */
export const fastOf = (def: ScenarioDef) => mOf(def.fast[0], def.fast[1]);

// ------------------------------------------------------------------ 목표 살피기

const WIDE: ReadonlySet<BodyType> = new Set<BodyType>(['wide', 'widetri', 'jumbo', 'double']);

/** 좌석 하나에 드는 연료 (kg/km). 이보다 적으면 '아끼는', 많으면 '많이 먹는' 비행기 */
export const THRIFTY_BURN = 0.037;
export const THIRSTY_BURN = 0.04;

export function planeKindOf(m: ModelDef, kind: PlaneKind): boolean {
  const freighter = isFreighter(m);
  switch (kind) {
    case 'any':
      return true;
    case 'freighter':
      return freighter;
    case 'bigFreighter':
      return freighter && WIDE.has(m.body);
    case 'jet':
      return !freighter && m.body !== 'prop';
    case 'prop':
      return !freighter && m.body === 'prop';
    case 'wide':
      return !freighter && WIDE.has(m.body);
    case 'jumbo':
      return !freighter && (m.body === 'jumbo' || m.body === 'double');
    case 'thrifty':
      return !freighter && m.burn / m.seats <= THRIFTY_BURN;
    case 'thirsty':
      return !freighter && m.burn / m.seats > THIRSTY_BURN;
  }
}

export const PLANE_KIND_NAME: Record<PlaneKind, string> = {
  any: '비행기',
  jet: '제트기',
  prop: '프로펠러기',
  wide: '넓은 동체기',
  jumbo: '점보기',
  freighter: '화물기',
  bigFreighter: '넓은 동체 화물기',
  thrifty: '연료를 아끼는 비행기',
  thirsty: '기름 먹는 비행기',
};

function countPlanes(c: Company, kind: PlaneKind, fly: boolean): number {
  let n = 0;
  for (const p of c.planes) {
    const m = MODEL[p.model];
    if (!m || !planeKindOf(m, kind)) continue;
    if (fly && !p.legs.some((l) => l.freq > 0)) continue;
    n++;
  }
  return n;
}

/** 최근 석 달 숫자 합 (달 결산 장부, 시나리오를 시작한 뒤만) */
function recent3(state: AirlineState, ci: number, key: 'pax' | 'cargoT' | 'xferPax'): number {
  let sum = 0;
  for (const l of state.ledger.slice(-3)) sum += l.companies[ci]?.[key] ?? 0;
  return sum;
}

/** 본사 나라 밖의 나라 (띄우는 노선이 닿는 곳) */
export function foreignCountries(state: Pick<AirlineState, 't'>, c: Company): Set<string> {
  const year = yearOfM(state.t);
  const home = polity(c.hub, year);
  const out = new Set<string>();
  for (const r of c.routes) {
    if (routeFreq(c, r.id) <= 0) continue;
    for (const city of [r.a, r.b]) {
      const p = polity(city, year);
      if (p !== home) out.add(p);
    }
  }
  return out;
}

/** 라이벌도 나는 두 도시 노선 가운데 지난달 우리 손님 몫이 절반 넘는 노선 수 */
export function contestedWins(state: AirlineState, ci: number): number {
  const rival = new Set<string>();
  state.companies.forEach((o, i) => {
    if (i === ci || o.out) return;
    for (const r of o.routes) if (routeFreq(o, r.id) > 0) rival.add(pairKey(r.a, r.b));
  });
  const c = state.companies[ci];
  let n = 0;
  for (const r of c.routes) {
    if (routeFreq(c, r.id) <= 0 || !rival.has(pairKey(r.a, r.b))) continue;
    if ((r.stats?.share ?? 0) > 0.5) n++;
  }
  return n;
}

function valueRank(state: AirlineState, ci: number): number {
  const mine = companyValue(state, ci);
  return state.companies.filter((c, i) => i !== ci && !c.out && companyValue(state, i) > mine).length + 1;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const up = (have: number, need: number, label: string, text: string): GoalStatus => ({ label, text, ok: have >= need, ratio: clamp01(need > 0 ? have / need : 1) });

/** 목표 글 (진행 없이) */
export function goalLabel(g: ScenarioGoal): string {
  switch (g.kind) {
    case 'routes':
      return g.minKm ? `${g.minKm.toLocaleString('ko-KR')}km 넘는 노선 ${g.n}개 띄우기` : g.intl ? `나라 밖 노선 ${g.n}개 띄우기` : `노선 ${g.n}개 띄우기`;
    case 'planes':
      return `${PLANE_KIND_NAME[g.type]} ${g.n}대 ${g.fly ? '띄우기' : '들이기'}`;
    case 'fewPlanes':
      return g.max === 0 ? `${PLANE_KIND_NAME[g.type]} 모두 정리하기` : `${PLANE_KIND_NAME[g.type]} ${g.max}대까지 줄이기`;
    case 'regions':
      return `${g.n}개 지역에 취항하기`;
    case 'countries':
      return `나라 밖 ${g.n}개 나라에 취항하기`;
    case 'value':
      return `회사 가치 ${money(g.v)} 넘기기`;
    case 'rank':
      return g.r === 1 ? '회사 가치 1등' : `회사 가치 ${g.r}등 안에 들기`;
    case 'debt':
      return g.max <= 0 ? '빚 모두 갚기' : `빚 ${money(g.max)} 아래로 줄이기`;
    case 'pax3':
      return `석 달 동안 손님 ${people(g.n)}명 태우기`;
    case 'cargo3':
      return `석 달 동안 화물 ${people(g.t)}톤 나르기`;
    case 'xfer3':
      return `석 달 동안 갈아탄 손님 ${people(g.n)}명`;
    case 'contested':
      return `라이벌과 겨루는 노선 ${g.n}개에서 손님 절반 넘게 태우기`;
    case 'streak':
      return `${g.n}분기 잇달아 흑자`;
    case 'yearProfit':
      return `${g.from}년부터 한 해를 흑자로 마치기`;
    case 'reputation':
      return `평판 ${g.n} 넘기기`;
  }
}

/** 목표 하나를 지금 상태에서 살핀다 */
export function goalStatus(state: AirlineState, ci: number, g: ScenarioGoal): GoalStatus {
  const c = state.companies[ci];
  const label = goalLabel(g);
  switch (g.kind) {
    case 'routes': {
      let n = 0;
      const year = yearOfM(state.t);
      for (const r of c.routes) {
        if (routeFreq(c, r.id) <= 0) continue;
        if (g.minKm && dist(r.a, r.b) <= g.minKm) continue;
        if (g.intl && polity(r.a, year) === polity(r.b, year)) continue;
        n++;
      }
      return up(n, g.n, label, `${n} / ${g.n}개`);
    }
    case 'planes': {
      const n = countPlanes(c, g.type, !!g.fly);
      return up(n, g.n, label, `${n} / ${g.n}대`);
    }
    case 'fewPlanes': {
      const n = countPlanes(c, g.type, false);
      return { label, text: `지금 ${n}대`, ok: n <= g.max, ratio: n <= g.max ? 1 : clamp01(1 / (1 + n - g.max)) };
    }
    case 'regions': {
      const n = regionsServed(c).size;
      return up(n, g.n, label, `${n} / ${g.n}곳`);
    }
    case 'countries': {
      const n = foreignCountries(state, c).size;
      return up(n, g.n, label, `${n} / ${g.n}곳`);
    }
    case 'value': {
      const v = c.out ? 0 : companyValue(state, ci);
      return up(v, g.v, label, `${money(v)} / ${money(g.v)}`);
    }
    case 'rank': {
      const r = c.out ? state.companies.length : valueRank(state, ci);
      return { label, text: `지금 ${r}등`, ok: !c.out && r <= g.r, ratio: c.out ? 0 : r <= g.r ? 1 : clamp01(g.r / r) };
    }
    case 'debt': {
      const d = Math.max(0, c.debt);
      return { label, text: `지금 ${money(d)}`, ok: d <= g.max, ratio: d <= g.max ? 1 : clamp01((g.max + 300) / (d + 300)) };
    }
    case 'pax3': {
      const n = recent3(state, ci, 'pax');
      return up(n, g.n, label, `${people(n)} / ${people(g.n)}명`);
    }
    case 'cargo3': {
      const n = recent3(state, ci, 'cargoT');
      return up(n, g.t, label, `${people(n)} / ${people(g.t)}톤`);
    }
    case 'xfer3': {
      const n = recent3(state, ci, 'xferPax');
      return up(n, g.n, label, `${people(n)} / ${people(g.n)}명`);
    }
    case 'contested': {
      const n = contestedWins(state, ci);
      return up(n, g.n, label, `${n} / ${g.n}개`);
    }
    case 'streak': {
      const n = c.stats.profitStreak;
      return up(n, g.n, label, `${Math.min(n, g.n)} / ${g.n}분기`);
    }
    case 'yearProfit': {
      const years = state.years.filter((y) => y.year >= g.from && y.companies[ci]);
      const best = years.reduce((m, y) => Math.max(m, y.companies[ci].profit), -Infinity);
      const ok = best > 0;
      // 아직이면 올해 지금까지의 이익
      const year = yearOfM(state.t);
      let ytd = 0;
      for (const l of state.ledger) if (yearOfM(l.t) === year) ytd += l.companies[ci]?.profit ?? 0;
      const text = ok ? `${years.find((y) => y.companies[ci].profit > 0)!.year}년 흑자 ✓` : year >= g.from ? `올해 지금까지 ${ytd >= 0 ? '+' : ''}${money(ytd)}` : `${g.from}년을 기다려요`;
      return { label, text, ok, ratio: ok ? 1 : year < g.from ? 0 : ytd > 0 ? 0.6 : 0.25 };
    }
    case 'reputation': {
      const n = Math.round(c.reputation);
      return up(n, g.n, label, `${n} / ${g.n}`);
    }
  }
}

export interface StageView {
  stage: ScenarioStage;
  index: number;
  /** 이룬 달 (아직이면 null) */
  doneAt: number | null;
  /** 지금 하고 있는 단계인지 */
  current: boolean;
  goals: GoalStatus[];
}

/** 지금 해야 할 단계 번호 (모두 마쳤으면 단계 수) */
export function currentStage(p: Pick<ScenarioProgress, 'done'>): number {
  const i = p.done.findIndex((d) => d === null);
  return i < 0 ? p.done.length : i;
}

/** 화면에 보여 줄 단계들 (지금 단계는 목표마다 진행) */
export function stageViews(state: AirlineState, def: ScenarioDef, p: ScenarioProgress): StageView[] {
  const cur = currentStage(p);
  return def.stages.map((stage, index) => ({
    stage,
    index,
    doneAt: p.done[index] ?? null,
    current: index === cur && state.phase !== 'gameover',
    goals: stage.goals.map((g) => goalStatus(state, p.company, g)),
  }));
}

/** 이 단계 목표를 모두 이뤘는지 */
export function stageMet(state: AirlineState, ci: number, stage: ScenarioStage): boolean {
  return stage.goals.every((g) => goalStatus(state, ci, g).ok);
}

/** 마친 달과 덤 목표로 별을 센다: 해내면 ★, 빨리 하면 ★, 덤 목표까지 하면 ★ */
export function starsFor(def: ScenarioDef, finishedAt: number, bonus: boolean): number {
  return 1 + (finishedAt <= fastOf(def) ? 1 : 0) + (bonus ? 1 : 0);
}

/** 별 받는 방법 세 줄 */
export function starRules(def: ScenarioDef): string[] {
  return ['마지막 단계까지 해내기', `${mLabel(fastOf(def))}까지 해내기`, def.bonus.text];
}

/** '★★☆' */
export function starText(n: number): string {
  const k = Math.max(0, Math.min(3, Math.round(n)));
  return '★'.repeat(k) + '☆'.repeat(3 - k);
}

/** 이 시나리오의 진행 (없거나 모르는 시나리오면 null) */
export function scenarioOf(state: Pick<AirlineState, 'scenario'>): { def: ScenarioDef; p: ScenarioProgress } | null {
  const p = state.scenario;
  if (!p) return null;
  const def = SCENARIO[p.id];
  return def ? { def, p } : null;
}

/** 본사 도시 이름 */
export const hubName = (def: ScenarioDef) => CITY[def.hub]?.name ?? def.hub;
