import { companyValue, regionsServed } from './simulate';
import { quarterOf, qOf, yearOf } from './time';
import type { AirlineState, CompanyReport } from './types';

/**
 * 도전 과제: 혼자서 정해진 조건을 기한 안에 이루기. (라이벌 항공사는 과제마다 정해져 있다)
 * 모두 이 게임을 위해 새로 지은 이야기예요.
 */
export interface ChallengeFleet {
  model: string;
  /** 시작할 때 나이 (년) */
  age: number;
  leased?: boolean;
  /** 이 노선에 배정해서 시작 */
  route?: [string, string];
  freq?: number;
  /** 운임 조정 % */
  fare?: number;
}

export interface ChallengeDef {
  id: string;
  emoji: string;
  title: string;
  story: string;
  goal: string;
  year: number;
  hub: string;
  cash: number;
  debt?: number;
  /** 은행이 처음 믿어 주는 한도 (없으면 시작 자금의 절반) */
  credit?: number;
  years: number;
  fleet?: ChallengeFleet[];
  branches?: string[];
  rivals: { kind: 'ai-easy' | 'ai-normal'; hub: string }[];
  /** 시작 유가 */
  oil?: number;
  /** 별 1~3 (어려움) */
  stars: number;
}

export interface ChallengeCheck {
  done: boolean;
  failed: boolean;
  progress: string;
  ratio: number;
  streak: number;
}

export const CHALLENGES: readonly ChallengeDef[] = [
  {
    id: 'rescue',
    emoji: '🛠️',
    title: '적자 회사 살리기',
    story: '빚이 많고 낡은 비행기만 남은 부산의 작은 항공사를 넘겨받았어요. 기름 먹는 하마 같은 비행기를 바꾸고 회사를 살려 봐요!',
    goal: '5년 안에 4분기 연속 흑자 + 회사 가치 1,000억 넘기기',
    year: 2003,
    hub: 'busan',
    cash: 400,
    debt: 900,
    credit: 1600,
    years: 5,
    branches: ['busan', 'tokyo', 'osaka', 'jeju', 'shanghai'],
    fleet: [
      { model: 'b727-200', age: 25, route: ['busan', 'tokyo'], freq: 10 },
      { model: 'b737-200', age: 24, route: ['busan', 'osaka'], freq: 14 },
      { model: 'b737-200', age: 23, route: ['busan', 'jeju'], freq: 20, fare: -10 },
      { model: 'md82', age: 17, leased: true, route: ['busan', 'shanghai'], freq: 9 },
    ],
    rivals: [
      { kind: 'ai-normal', hub: 'seoul' },
      { kind: 'ai-normal', hub: 'osaka' },
    ],
    stars: 2,
  },
  {
    id: 'pacific',
    emoji: '🌊',
    title: '태평양 하늘길 1등',
    story: '1983년 서울. 아시아와 아메리카 사이 하늘길이 막 커지기 시작했어요. 도쿄와 로스앤젤레스의 라이벌보다 먼저 태평양을 잡아요!',
    goal: '10년 안에 한 분기 동안 태평양을 건너는 손님을 어느 라이벌보다 많이, 3만 명 넘게 태우기',
    year: 1983,
    hub: 'seoul',
    cash: 3000,
    years: 10,
    rivals: [
      { kind: 'ai-normal', hub: 'tokyo' },
      { kind: 'ai-normal', hub: 'losangeles' },
      { kind: 'ai-easy', hub: 'hongkong' },
    ],
    stars: 3,
  },
  {
    id: 'oilstorm',
    emoji: '⛽',
    title: '기름값 폭풍 견디기',
    story: '1973년 프랑크푸르트. 곧 기름값이 두 배 가까이 뛸 거라는 소문이 돌아요. 연료를 아끼는 비행기로 6년을 버텨 봐요.',
    goal: '1978년이 끝날 때 노선 4개 이상을 날면서 회사 가치 1등',
    year: 1973,
    hub: 'frankfurt',
    cash: 2500,
    years: 6,
    rivals: [
      { kind: 'ai-normal', hub: 'london' },
      { kind: 'ai-normal', hub: 'paris' },
      { kind: 'ai-easy', hub: 'rome' },
    ],
    stars: 3,
  },
  {
    id: 'sixregions',
    emoji: '🌍',
    title: '여섯 지역을 잇다',
    story: '1963년 런던. 제트기 시대가 열렸어요. 아직 멀리 못 나는 비행기로 지점을 징검다리 삼아 세계 여섯 지역에 모두 취항해요.',
    goal: '12년 안에 여섯 지역 모두에 비행기 띄우기',
    year: 1963,
    hub: 'london',
    cash: 3000,
    years: 12,
    rivals: [
      { kind: 'ai-easy', hub: 'newyork' },
      { kind: 'ai-easy', hub: 'tokyo' },
    ],
    stars: 1,
  },
  {
    id: 'resort',
    emoji: '🏝️',
    title: '휴양지 전문 항공사',
    story: '싱가포르에서 휴양지만 골라 나는 항공사를 차렸어요. 발리·방콕·몰디브·하와이… 계절마다 몰리는 관광 손님을 잡아요.',
    goal: '8년 안에 한 분기에 휴양지(관광 매력 8 이상, 사업 손님 적은 곳) 노선 손님 20만 명',
    year: 2003,
    hub: 'singapore',
    cash: 2200,
    years: 8,
    rivals: [
      { kind: 'ai-normal', hub: 'hongkong' },
      { kind: 'ai-normal', hub: 'sydney' },
    ],
    stars: 2,
  },
  {
    id: 'concorde',
    emoji: '🚀',
    title: '초음속의 꿈',
    story: '1976년 파리. 소리보다 빠른 콩코드가 막 하늘에 올랐어요. 비싸고 연료도 많이 먹지만, 바쁜 사업 손님은 시간을 돈으로 사요.',
    goal: '8년 안에 콩코드 2대 이상을 띄우고, 콩코드 노선 4분기 연속 흑자',
    year: 1976,
    hub: 'paris',
    cash: 7000,
    years: 8,
    rivals: [
      { kind: 'ai-normal', hub: 'london' },
      { kind: 'ai-normal', hub: 'newyork' },
    ],
    stars: 3,
  },
  {
    id: 'olympic',
    emoji: '🏅',
    title: '서울 올림픽 하늘길',
    story: '1985년, 3년 뒤 서울에서 올림픽이 열려요. 세계 손님을 맞을 하늘길을 미리 깔아 두어요!',
    goal: '1988년 3분기(올림픽)에 서울을 오가는 우리 손님 12만 명',
    year: 1985,
    hub: 'seoul',
    cash: 2500,
    years: 4,
    rivals: [
      { kind: 'ai-normal', hub: 'tokyo' },
      { kind: 'ai-easy', hub: 'hongkong' },
    ],
    stars: 2,
  },
  {
    id: 'topdog',
    emoji: '🏆',
    title: '사막에서 세계 1등으로',
    story: '2003년 두바이. 아직 작은 사막 공항이지만 곧 세계를 잇는 길목이 될 거예요. 런던·싱가포르·뉴욕의 강한 라이벌을 모두 앞질러요.',
    goal: '15년 안에 회사 가치 1등 + 1조(10,000억) 넘기기',
    year: 2003,
    hub: 'dubai',
    cash: 2500,
    years: 15,
    rivals: [
      { kind: 'ai-normal', hub: 'london' },
      { kind: 'ai-normal', hub: 'singapore' },
      { kind: 'ai-normal', hub: 'newyork' },
    ],
    stars: 3,
  },
];

export const CHALLENGE: Record<string, ChallengeDef> = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));

/** 기한 (이 분기까지 이루어야 한다) */
export function challengeDeadline(def: ChallengeDef): number {
  if (def.id === 'olympic') return qOf(1988, 3);
  return qOf(def.year + def.years, 1) - 1;
}

const man = (n: number) => `${(n / 10000).toFixed(1)}만`;

/**
 * 분기가 끝난 뒤 도전 과제를 확인한다.
 * state는 그 분기의 결과(현금·비행기)가 들어간 상태, q는 끝난 분기.
 */
export function checkChallenge(def: ChallengeDef, state: AirlineState, ci: number, reports: readonly CompanyReport[], q: number, streak: number, _startValue: number): ChallengeCheck {
  const report = reports[ci];
  const deadline = challengeDeadline(def);
  const c = state.companies[ci];
  const late = q >= deadline;
  if (c.out) return { done: false, failed: true, progress: '회사가 파산했어요', ratio: 0, streak: 0 };
  const value = companyValue(state, ci);
  const res = (done: boolean, progress: string, ratio: number, nextStreak = streak): ChallengeCheck => ({
    done,
    failed: !done && late,
    progress,
    ratio: Math.max(0, Math.min(1, ratio)),
    streak: nextStreak,
  });
  switch (def.id) {
    case 'rescue': {
      const s = report.profit > 0 ? streak + 1 : 0;
      const ok = s >= 4 && value >= 1000;
      return res(ok, `흑자 ${s}분기 연속 (4 필요) · 회사 가치 ${Math.round(value).toLocaleString()}억 (1,000억 넘기기)`, Math.min(s, 4) / 8 + Math.max(0, Math.min(0.5, (value + 700) / 3400)), s);
    }
    case 'pacific': {
      const mine = report.pacificPax;
      const rival = Math.max(0, ...reports.filter((_, i) => i !== ci).map((r) => r.pacificPax));
      const ok = mine > rival && mine >= 30000;
      return res(ok, `태평양 손님 ${man(mine)}명 (3만 필요) · 가장 많은 라이벌 ${man(rival)}명`, Math.min(1, mine / 30000) * 0.6 + (mine > rival ? 0.4 : 0.4 * (rival > 0 ? mine / rival : 0)));
    }
    case 'oilstorm': {
      const values = state.companies.map((_, i) => companyValue(state, i));
      const rank = values.filter((v) => v > value).length + 1;
      const flying = c.routes.filter((r) => c.planes.some((p) => p.route === r.id && p.freq > 0)).length;
      const ok = late && rank === 1 && flying >= 4;
      const span = deadline - qOf(def.year, 1);
      return res(ok, `회사 가치 ${rank}등 · 나는 노선 ${flying}개 (4개 필요) · ${yearOf(deadline)}년 말까지 버티기`, (rank === 1 ? 0.3 : 0.1) + Math.min(flying, 4) / 20 + ((q - qOf(def.year, 1)) / span) * 0.5);
    }
    case 'sixregions': {
      const n = regionsServed(c).size;
      return res(n >= 6, `취항한 지역 ${n} / 6`, n / 6);
    }
    case 'resort': {
      const pax = report.resortPax;
      return res(pax >= 200000, `휴양지 노선 손님 ${man(pax)}명 (20만 필요)`, pax / 200000);
    }
    case 'concorde': {
      const flying = c.planes.filter((p) => p.model === 'concorde' && p.route !== null && p.freq > 0).length;
      const s = flying >= 2 && report.sstProfit > 0 ? streak + 1 : 0;
      return res(s >= 4, `콩코드 ${flying}대 운항 (2대 필요) · 콩코드 흑자 ${s}분기 연속 (4 필요)`, Math.min(flying, 2) / 4 + Math.min(s, 4) / 8, s);
    }
    case 'olympic': {
      const pax = report.hubPax;
      const isOlympic = yearOf(q) === 1988 && quarterOf(q) === 3;
      return res(isOlympic && pax >= 120000, `서울을 오간 손님 ${man(pax)}명 (올림픽 분기에 12만 필요)`, pax / 120000);
    }
    case 'topdog': {
      const values = state.companies.map((_, i) => companyValue(state, i));
      const rank = values.filter((v) => v > value).length + 1;
      const ok = rank === 1 && value >= 10000;
      return res(ok, `회사 가치 ${Math.round(value).toLocaleString()}억 · ${rank}등 (1등 + 1조 필요)`, Math.min(1, value / 10000) * 0.6 + (rank === 1 ? 0.4 : 0.1));
    }
  }
  return res(false, '', 0);
}
