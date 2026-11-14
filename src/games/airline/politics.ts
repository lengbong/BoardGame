import { CITY } from './cities';
import type { ModelDef } from './types';

/**
 * 나라 사이 관계 (에어 매니지먼트처럼 냉전과 외교가 하늘길을 막는다).
 * 실제 역사에서 직항이 없었거나 끊겼던 때를 어림해 적었어요. 게임에서는
 * - 회사 본사 나라와 두 도시 나라, 두 도시 나라끼리 관계가 막혀 있으면 노선·지점을 열 수 없고,
 * - 막히기 시작하면 그 노선은 운항을 멈추며,
 * - 냉전 동안에는 소련 비행기와 서방 비행기를 서로 사지 못한다.
 * 설정에서 '실제 역사'를 끄면 모두 열린다.
 */

/** 도시가 그 해에 속한 나라 (식민지·통일·해체를 반영) */
export function polity(city: string, year: number): string {
  if (city === 'hongkong') return year < 1997 ? '영국령 홍콩' : '홍콩';
  if (city === 'hochiminh') return year < 1976 ? '남베트남' : '베트남';
  if (city === 'moscow') return year < 1992 ? '소련' : '러시아';
  const country = CITY[city]?.country ?? city;
  // 하와이·괌도 미국과 같은 외교를 따른다
  if (country === '미국 하와이' || country === '미국령') return '미국';
  return country;
}

const WEST_EUROPE = ['영국', '프랑스', '독일', '네덜란드', '스위스', '이탈리아', '스페인', '그리스'];
const AMERICA = ['미국', '캐나다', '멕시코', '브라질', '아르헨티나'];
const WEST = [...WEST_EUROPE, ...AMERICA, '한국', '일본', '대만', '오스트레일리아', '뉴질랜드', '남베트남'];

interface Closure {
  a: readonly string[];
  b: readonly string[];
  /** 이 해부터 (포함) */
  from: number;
  /** 이 해부터 다시 열린다 */
  to: number;
  why: string;
}

const CLOSURES: readonly Closure[] = [
  // 중국: 1949년 뒤 서방과 직항이 거의 없다가 1970년대에 하나씩 열림
  { a: ['중국'], b: ['미국'], from: 1949, to: 1979, why: '미국과 중국은 아직 국교가 없어요' },
  { a: ['중국'], b: ['한국'], from: 1949, to: 1992, why: '한국과 중국은 아직 국교가 없어요' },
  { a: ['중국'], b: ['대만'], from: 1949, to: 2008, why: '중국과 대만 사이에는 아직 직항이 없어요' },
  { a: ['중국'], b: ['일본'], from: 1949, to: 1974, why: '일본과 중국 사이 하늘길이 아직 열리지 않았어요' },
  { a: ['중국'], b: WEST_EUROPE.filter((x) => x !== '프랑스' && x !== '영국'), from: 1949, to: 1973, why: '냉전으로 중국과 서유럽 사이 하늘길이 거의 없어요' },
  { a: ['중국'], b: ['오스트레일리아', '뉴질랜드', '캐나다', '멕시코', '브라질', '아르헨티나'], from: 1949, to: 1974, why: '냉전으로 중국과의 하늘길이 아직 없어요' },
  { a: ['중국'], b: ['인도네시아'], from: 1967, to: 1990, why: '인도네시아와 중국의 국교가 끊겼어요' },
  { a: ['중국'], b: ['남베트남', '필리핀', '태국', '말레이시아', '싱가포르'], from: 1949, to: 1975, why: '냉전으로 중국과의 하늘길이 아직 없어요' },
  { a: ['중국'], b: ['영국령 홍콩'], from: 1949, to: 1978, why: '중국 본토와 홍콩 사이 하늘길이 아직 없어요' },
  // 소련: 아에로플로트는 여러 나라를 날았지만 막힌 곳도 있었다
  { a: ['소련'], b: ['미국'], from: 1949, to: 1968, why: '냉전으로 미국과 소련 사이에 아직 직항이 없어요' },
  { a: ['소련'], b: ['미국'], from: 1982, to: 1987, why: '대한항공 007편 사건 뒤 미국이 소련 비행기를 막았어요' },
  { a: ['소련'], b: ['한국'], from: 1949, to: 1990, why: '한국과 소련은 아직 국교가 없어요' },
  { a: ['소련'], b: ['대만', '남베트남'], from: 1949, to: 1992, why: '소련과 국교가 없는 곳이에요' },
  { a: ['소련'], b: ['남아프리카 공화국'], from: 1949, to: 1991, why: '소련과 남아프리카 공화국은 국교가 없어요' },
  // 베트남: 통일 뒤 서방과 끊겼다가 1990년대에 다시
  { a: ['베트남'], b: ['미국'], from: 1976, to: 1995, why: '베트남 전쟁 뒤 미국과 베트남은 국교가 없어요' },
  { a: ['베트남'], b: ['한국'], from: 1976, to: 1992, why: '베트남 전쟁 뒤 한국과 베트남은 국교가 없어요' },
  { a: ['베트남'], b: ['중국'], from: 1979, to: 1992, why: '중국과 베트남 사이 전쟁 뒤로 하늘길이 끊겼어요' },
  // 남아프리카 공화국: 인종 차별 정책(아파르트헤이트)에 대한 제재
  { a: ['남아프리카 공화국'], b: ['케냐', '나이지리아', '이집트', '모로코', '인도', '스리랑카'], from: 1963, to: 1992, why: '인종 차별 정책 때문에 남아프리카 공화국 비행기를 받지 않아요' },
  { a: ['남아프리카 공화국'], b: ['미국'], from: 1986, to: 1991, why: '인종 차별 정책 제재로 미국이 남아프리카 공화국 비행기를 막았어요' },
  { a: ['남아프리카 공화국'], b: ['오스트레일리아'], from: 1987, to: 1992, why: '인종 차별 정책 제재로 직항이 끊겼어요' },
  // 한국–대만: 한중 수교 뒤 대만이 한국 노선을 끊었다가 다시 이음
  { a: ['한국'], b: ['대만'], from: 1992, to: 2004, why: '한중 수교 뒤 한국과 대만 사이 하늘길이 끊겼어요' },
  // 러시아: 우크라이나 전쟁 뒤 서방과 하늘길이 닫힘
  { a: ['러시아'], b: WEST.filter((x) => x !== '남베트남'), from: 2022, to: 9999, why: '우크라이나 전쟁 뒤 서방과 러시아 사이 하늘길이 닫혔어요' },
];

export interface Block {
  why: string;
  /** 다시 열리는 해 (9999면 아직 모름) */
  until: number;
}

/** 두 나라 사이가 막혔으면 까닭 */
export function relationBlock(pa: string, pb: string, year: number): Block | null {
  if (pa === pb) return null;
  for (const c of CLOSURES) {
    if (year < c.from || year >= c.to) continue;
    if ((c.a.includes(pa) && c.b.includes(pb)) || (c.a.includes(pb) && c.b.includes(pa))) return { why: c.why, until: c.to };
  }
  return null;
}

/** 본사가 hub인 회사가 a–b 노선을 열 수 없는 까닭 (나라 관계) */
export function routePolitics(hub: string, a: string, b: string, year: number): Block | null {
  const ph = polity(hub, year);
  const pa = polity(a, year);
  const pb = polity(b, year);
  return relationBlock(ph, pa, year) ?? relationBlock(ph, pb, year) ?? relationBlock(pa, pb, year);
}

/** 본사가 hub인 회사가 city에 지점을 열 수 없는 까닭 */
export function branchPolitics(hub: string, city: string, year: number): Block | null {
  return relationBlock(polity(hub, year), polity(city, year), year);
}

export function blockText(b: Block): string {
  return b.until >= 9999 ? `${b.why} (언제 열릴지 몰라요)` : `${b.why} (${b.until}년부터 열려요)`;
}

// ------------------------------------------------------------------ 비행기 사기 (냉전)

/** 소련(·러시아)에서 만든 비행기 */
export const EAST_MAKERS: readonly string[] = ['Antonov', 'Ilyushin', 'Tupolev', 'Yakovlev'];

/** 냉전 동안 소련 비행기를 쓰던 나라 */
const EAST_BUYERS: readonly string[] = ['소련', '러시아', '중국', '베트남', '이집트', '인도'];
/** 냉전 동안 서방 비행기를 살 수 없던 나라 (중국은 1972년부터 샀다) */
const WEST_BANNED: readonly { who: string; until: number }[] = [
  { who: '소련', until: 1992 },
  { who: '중국', until: 1972 },
  { who: '베트남', until: 1993 },
];
/** 냉전이 끝나 누구나 소련제를 사는 해 */
export const COLD_WAR_END = 1992;

/** 본사가 hub인 회사가 이 기종을 살 수 없는 까닭 (나라 관계) */
export function makerPolitics(hub: string, m: ModelDef, year: number): string | null {
  const home = polity(hub, year);
  const east = EAST_MAKERS.includes(m.maker);
  if (east && year < COLD_WAR_END && !EAST_BUYERS.includes(home)) return `냉전 중에는 소련 비행기를 살 수 없어요 (${COLD_WAR_END}년부터)`;
  if (!east && m.maker !== '가상 설계') {
    const ban = WEST_BANNED.find((x) => x.who === home && year < x.until);
    if (ban) return `냉전 중에는 서방 비행기를 살 수 없어요 (${ban.until}년부터)`;
  }
  return null;
}

// ------------------------------------------------------------------ 뉴스

const listName = (xs: readonly string[]) => (xs.length > 3 ? '서방 여러 나라' : xs.join('·'));

/** 그 해 1월에 알릴 외교 소식: 다시 열린 하늘길, 새로 막힌 하늘길 */
export function politicalNews(year: number, startYear: number): { icon: string; title: string; text: string; tone: 'good' | 'bad' }[] {
  const out: { icon: string; title: string; text: string; tone: 'good' | 'bad' }[] = [];
  for (const c of CLOSURES) {
    if (c.to === year && c.from < year && year > startYear) {
      out.push({ icon: '🕊️', title: `하늘길이 열렸어요: ${listName(c.a)} ↔ ${listName(c.b)}`, text: `막혔던 직항을 이제 열 수 있어요. (${c.why.replace(/어요$/, '었어요')})`, tone: 'good' });
    }
    if (c.from === year && year > startYear) {
      out.push({ icon: '🚫', title: `하늘길이 막혔어요: ${listName(c.a)} ↔ ${listName(c.b)}`, text: `${c.why}. 이 나라들 사이 노선은 운항을 멈춰요.`, tone: 'bad' });
    }
  }
  return out;
}
