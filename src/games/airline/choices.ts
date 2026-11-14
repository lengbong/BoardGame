import { withJosa } from '../../lib/korean';
import { availableModels, MODEL } from './aircraft';
import { CITIES, CITY, REGION_INFO, airportClass, citySize, dist, pairKey } from './cities';
import { FIXED_EVENTS } from './events';
import { companyValue, isIdle, orderPrice, slotCapacity, slotsUsed } from './simulate';
import { mOf, yearOf } from './time';
import type { AirlineState, Choice, ChoiceOption, Company, Rng } from './types';

/**
 * 결정 사건: 회사마다 아홉 달에서 한 해에 한 번쯤, 고를 수 있는 일이 생긴다.
 * 모두 이 게임을 위해 지은 이야기이고 전쟁·정치·재난·질병은 다루지 않는다.
 * 고르면 무엇이 어떻게 바뀌는지 숫자로 미리 보여 준다.
 */

interface Ctx {
  state: AirlineState;
  ci: number;
  c: Company;
  year: number;
  q: number;
  /** 지금 달 */
  t: number;
  /** 회사 크기에 맞춘 돈 단위 (억) */
  s: number;
  rng: Rng;
}

type Draft = Omit<Choice, 'id'>;

interface Scenario {
  id: string;
  when: (x: Ctx) => boolean;
  build: (x: Ctx) => Draft | null;
}

const round = (v: number) => Math.max(5, Math.round(v / 5) * 5);
const pct = (m: number) => `${m > 1 ? '+' : '−'}${Math.round(Math.abs(m - 1) * 100)}%`;
const years = (months: number) => (months % 12 === 0 ? `${months / 12}년` : `${months}달`);

/** 회사 크기에 맞춘 결정 사건 돈 단위 */
export function choiceScale(state: AirlineState, ci: number): number {
  return round(Math.max(40, Math.min(1500, companyValue(state, ci) * 0.03)));
}

const decline = (label = '괜찮아요', desc = '아무 일도 없어요'): ChoiceOption => ({ label, desc, effects: [], cost: 0, ai: 0.2 });

function pickOne<T>(items: readonly T[], rng: Rng): T | undefined {
  return items.length ? items[Math.floor(rng() * items.length)] : undefined;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'wage',
    when: (x) => x.c.planes.length >= 3,
    build: (x) => ({
      scenario: 'wage',
      icon: '🧑‍✈️',
      title: '조종사·승무원 임금 협상',
      text: '조종사와 승무원 모임이 임금을 올려 달라고 해요. 어떻게 할까요?',
      options: [
        { label: '넉넉히 올려 주기', desc: `승무원·정비비 ${pct(1.06)} (${years(36)}) · 평판 +5`, cost: 0, ai: 0.8, effects: [{ kind: 'mod', mod: { kind: 'crew', value: 1.06, until: x.t + 36, label: '임금 인상' } }, { kind: 'rep', amount: 5 }] },
        { label: '조금만 올리기', desc: `승무원·정비비 ${pct(1.03)} (${years(36)})`, cost: 0, ai: 1, effects: [{ kind: 'mod', mod: { kind: 'crew', value: 1.03, until: x.t + 36, label: '임금 조금 인상' } }] },
        { label: '거절하기', desc: '평판 −8 · 일하는 분위기가 나빠져 여섯 달 동안 손님 −8%', cost: 0, ai: 0.3, effects: [{ kind: 'rep', amount: -8 }, { kind: 'mod', mod: { kind: 'demand', value: 0.92, until: x.t + 6, label: '협상 결렬' } }] },
      ],
    }),
  },
  {
    id: 'hedge',
    when: (x) => x.c.planes.length >= 2,
    build: (x) => {
      const oil = x.state.oil;
      const good = oil <= 1.05;
      return {
        scenario: 'hedge',
        icon: '⛽',
        title: '연료 값 미리 정하기',
        text: `기름 회사가 지금 유가(지수 ${oil.toFixed(2)})로 연료 값을 미리 정해 두자고 해요. 기름값이 오르면 이득, 내리면 손해예요.`,
        options: [
          { label: '1년 동안 정하기', desc: `수수료 ${round(x.s * 0.4)}억 · 열두 달 동안 유가 ${oil.toFixed(2)}로 고정`, cost: round(x.s * 0.4), ai: good ? 1.2 : 0.1, effects: [{ kind: 'mod', mod: { kind: 'fuelHedge', value: oil, until: x.t + 12, label: `유가 ${oil.toFixed(2)} 고정` } }] },
          { label: '반년만 정하기', desc: `수수료 ${round(x.s * 0.2)}억 · 여섯 달 동안 유가 ${oil.toFixed(2)}로 고정`, cost: round(x.s * 0.2), ai: good ? 0.9 : 0.15, effects: [{ kind: 'mod', mod: { kind: 'fuelHedge', value: oil, until: x.t + 6, label: `유가 ${oil.toFixed(2)} 고정` } }] },
          decline('안 해요', '유가가 오르내리는 대로 내요'),
        ],
      };
    },
  },
  {
    id: 'slots',
    when: (x) => x.c.branches.some((b) => airportClass(CITY[b], x.year) >= 3 && slotsUsed(x.c, b) >= slotCapacity(x.state, x.ci, b) * 0.45),
    build: (x) => {
      const cands = x.c.branches.filter((b) => airportClass(CITY[b], x.year) >= 3 && slotsUsed(x.c, b) >= slotCapacity(x.state, x.ci, b) * 0.45);
      const city = cands.includes(x.c.hub) ? x.c.hub : pickOne(cands, x.rng);
      if (!city) return null;
      const full = slotsUsed(x.c, city) / Math.max(1, slotCapacity(x.state, x.ci, city));
      return {
        scenario: 'slots',
        icon: '🛫',
        title: `${CITY[city].name} 공항 시간대 경매`,
        text: `붐비는 ${CITY[city].name} 공항이 남는 이착륙 시간대(슬롯)를 경매에 붙였어요. 지금 내 슬롯을 ${Math.round(full * 100)}% 쓰고 있어요.`,
        options: [
          { label: '많이 사기', desc: `${round(x.s * 1.2)}억 · ${CITY[city].name} 내 슬롯 +50% (계속)`, cost: round(x.s * 1.2), ai: full > 0.75 ? 1.3 : 0.4, effects: [{ kind: 'mod', mod: { kind: 'slot', value: 1.5, until: x.t + 1200, city, label: `${CITY[city].name} 슬롯 +50%` } }] },
          { label: '조금 사기', desc: `${round(x.s * 0.6)}억 · ${CITY[city].name} 내 슬롯 +25% (계속)`, cost: round(x.s * 0.6), ai: full > 0.6 ? 1 : 0.3, effects: [{ kind: 'mod', mod: { kind: 'slot', value: 1.25, until: x.t + 1200, city, label: `${CITY[city].name} 슬롯 +25%` } }] },
          decline('안 사요'),
        ],
      };
    },
  },
  {
    id: 'olympic',
    when: (x) => FIXED_EVENTS.some((e) => mOf(e.year, e.months[0]) > x.t && mOf(e.year, e.months[0]) - x.t <= 18),
    build: (x) => {
      const e = FIXED_EVENTS.find((f) => mOf(f.year, f.months[0]) > x.t && mOf(f.year, f.months[0]) - x.t <= 18)!;
      const has = x.c.branches.includes(e.city);
      const until = mOf(e.year + 1, 1);
      return {
        scenario: 'olympic',
        icon: e.kind === 'expo' ? '🎡' : '🏅',
        title: `${e.title} 공식 항공사 입찰`,
        text: `${e.year}년 ${e.title}가 공식 항공사를 찾고 있어요. 뽑히면 ${CITY[e.city].name}을 오가는 우리 노선에 손님이 몰려요.${has ? '' : ` (아직 ${CITY[e.city].name}에 지점이 없어요)`}`,
        options: [
          { label: '입찰하기', desc: `${round(x.s * 1.5)}억 · ${e.year}년이 끝날 때까지 ${CITY[e.city].name} 노선 손님 +25% · 평판 +4`, cost: round(x.s * 1.5), ai: has ? 1.4 : 0.1, effects: [{ kind: 'mod', mod: { kind: 'demand', value: 1.25, until, city: e.city, label: `${e.title} 공식 항공사` } }, { kind: 'rep', amount: 4 }] },
          decline('안 해요'),
        ],
      };
    },
  },
  {
    id: 'maker',
    when: (x) => availableModels(x.year).some((m) => x.year - m.intro <= 2),
    build: (x) => {
      const m = pickOne(availableModels(x.year).filter((mm) => x.year - mm.intro <= 2), x.rng);
      if (!m) return null;
      const price = Math.round(orderPrice(x.state, m, x.c) * 0.8);
      return {
        scenario: 'maker',
        icon: '🛩️',
        title: `제작사의 ${m.name} 할인 제안`,
        text: `${m.maker}가 새 기종 ${m.name}(${m.seats}석, ${m.range.toLocaleString()}km)을 먼저 사 주면 20% 깎아 주겠대요.`,
        options: [
          { label: '1대 주문하기', desc: `${price.toLocaleString()}억 (20% 할인) · 인도까지 몇 달 걸려요`, cost: price, ai: 0.9, effects: [{ kind: 'order', model: m.id, discount: 0.2 }] },
          { label: '할인권만 받기', desc: `1년 동안 ${m.name}을 주문하면 10% 할인`, cost: 0, ai: 0.6, effects: [{ kind: 'mod', mod: { kind: 'discount', value: 0.9, until: x.t + 12, model: m.id, label: `${m.name} 10% 할인권` } }] },
          decline('괜찮아요'),
        ],
      };
    },
  },
  {
    id: 'safety',
    when: (x) => x.c.planes.length >= 2,
    build: (x) => ({
      scenario: 'safety',
      icon: '🛠️',
      title: '안전 점검 투자',
      text: '정비팀이 비행기를 더 꼼꼼히 점검하자고 해요. 돈은 들지만 손님이 믿고 타요.',
      options: [
        { label: '꼼꼼히 점검하기', desc: `${round(x.s * 0.8)}억 · 평판 +6 · 정비비 −3% (${years(24)})`, cost: round(x.s * 0.8), ai: 0.9, effects: [{ kind: 'rep', amount: 6 }, { kind: 'mod', mod: { kind: 'crew', value: 0.97, until: x.t + 24, label: '꼼꼼한 정비' } }] },
        { label: '기본만 하기', desc: `${round(x.s * 0.3)}억 · 평판 +2`, cost: round(x.s * 0.3), ai: 0.7, effects: [{ kind: 'rep', amount: 2 }] },
        { label: '다음에 하기', desc: '평판 −4', cost: 0, ai: 0.2, effects: [{ kind: 'rep', amount: -4 }] },
      ],
    }),
  },
  {
    id: 'catering',
    when: (x) => x.c.planes.length >= 2,
    build: (x) => ({
      scenario: 'catering',
      icon: '🍱',
      title: '기내식 업체 바꾸기',
      text: '기내식 업체 두 곳이 제안을 보냈어요.',
      options: [
        { label: '싼 업체로', desc: `기내 서비스비 −20% (${years(36)}) · 평판 −4`, cost: 0, ai: 0.8, effects: [{ kind: 'mod', mod: { kind: 'service', value: 0.8, until: x.t + 36, label: '싼 기내식' } }, { kind: 'rep', amount: -4 }] },
        { label: '고급 업체로', desc: `기내 서비스비 +25% (${years(36)}) · 평판 +6`, cost: 0, ai: 0.7, effects: [{ kind: 'mod', mod: { kind: 'service', value: 1.25, until: x.t + 36, label: '고급 기내식' } }, { kind: 'rep', amount: 6 }] },
        decline('지금 그대로', '바뀌는 것 없어요'),
      ],
    }),
  },
  {
    id: 'fair',
    when: () => true,
    build: (x) => {
      const region = CITY[x.c.hub].region;
      return {
        scenario: 'fair',
        icon: '🎪',
        title: `${REGION_INFO[region].name} 여행 박람회`,
        text: `${REGION_INFO[region].name}에서 큰 여행 박람회가 열려요. 부스를 차려 우리 회사를 알릴까요?`,
        options: [
          { label: '큰 부스', desc: `${round(x.s * 0.5)}억 · ${REGION_INFO[region].name}에서 알려진 정도 +25%`, cost: round(x.s * 0.5), ai: 0.8, effects: [{ kind: 'awareness', region, amount: 0.25 }] },
          { label: '작은 부스', desc: `${round(x.s * 0.2)}억 · 알려진 정도 +10%`, cost: round(x.s * 0.2), ai: 0.9, effects: [{ kind: 'awareness', region, amount: 0.1 }] },
          decline('안 가요'),
        ],
      };
    },
  },
  {
    id: 'subsidy',
    when: (x) => smallCities(x).length > 0,
    build: (x) => {
      const city = pickOne(smallCities(x), x.rng);
      if (!city) return null;
      const pay = Math.max(2, Math.round((x.s * 0.25) / 3));
      return {
        scenario: 'subsidy',
        icon: '🤝',
        title: `${CITY[city].name}의 노선 보조금`,
        text: `${CITY[city].name}에서 우리 비행기가 와 주면 2년 동안 달마다 ${pay}억을 주겠대요. ${CITY[city].name}을 오가는 노선을 날고 있을 때만 받아요.`,
        options: [
          { label: '받아들이기', desc: `${CITY[city].name} 노선을 나는 동안 달마다 +${pay}억 (2년)`, cost: 0, ai: 0.9, effects: [{ kind: 'mod', mod: { kind: 'subsidy', value: pay, until: x.t + 24, city, label: `${CITY[city].name} 보조금` } }] },
          decline('거절하기'),
        ],
      };
    },
  },
  {
    id: 'academy',
    when: (x) => x.c.planes.length >= 4,
    build: (x) => ({
      scenario: 'academy',
      icon: '🎓',
      title: '조종사 학교 세우기',
      text: '우리 회사만의 조종사·정비사 학교를 세우면 오랫동안 사람 구하는 돈이 줄어요.',
      options: [
        { label: '세우기', desc: `${round(x.s * 1)}억 · 승무원·정비비 −4% (${years(48)})`, cost: round(x.s * 1), ai: 0.9, effects: [{ kind: 'mod', mod: { kind: 'crew', value: 0.96, until: x.t + 48, label: '조종사 학교' } }] },
        decline('안 해요'),
      ],
    }),
  },
  {
    id: 'lounge',
    when: (x) => x.c.routes.filter((r) => r.a === x.c.hub || r.b === x.c.hub).length >= 2,
    build: (x) => ({
      scenario: 'lounge',
      icon: '🛋️',
      title: `${CITY[x.c.hub].name} 공항 라운지`,
      text: `본사 ${CITY[x.c.hub].name} 공항에 사업 손님이 쉬어 갈 라운지를 열 수 있어요.`,
      options: [
        { label: '열기', desc: `${round(x.s * 0.6)}억 · ${CITY[x.c.hub].name} 노선 사업 손님 +8% (${years(48)})`, cost: round(x.s * 0.6), ai: 0.9, effects: [{ kind: 'mod', mod: { kind: 'demand', value: 1.08, until: x.t + 48, city: x.c.hub, seg: 'biz', label: '본사 라운지' } }] },
        decline('안 해요'),
      ],
    }),
  },
  {
    id: 'loyalty',
    when: (x) => x.year >= 1981 && x.c.routes.length >= 3,
    build: (x) => ({
      scenario: 'loyalty',
      icon: '💳',
      title: '단골 손님 제도',
      text: '탈 때마다 점수를 쌓아 주는 단골 손님 제도를 만들면 손님이 우리 회사를 더 자주 골라요.',
      options: [
        { label: '만들기', desc: `${round(x.s * 0.8)}억 · 모든 노선 손님 +5% · 기내 서비스비 +5% (${years(48)})`, cost: round(x.s * 0.8), ai: 1, effects: [{ kind: 'mod', mod: { kind: 'demand', value: 1.05, until: x.t + 48, label: '단골 손님 제도' } }, { kind: 'mod', mod: { kind: 'service', value: 1.05, until: x.t + 48, label: '단골 손님 혜택' } }] },
        decline('안 해요'),
      ],
    }),
  },
  {
    id: 'online',
    when: (x) => x.year >= 1996 && !x.c.mods.some((m) => m.kind === 'sales' && m.until > x.t),
    build: (x) => ({
      scenario: 'online',
      icon: '💻',
      title: '인터넷 예약 만들기',
      text: '손님이 인터넷으로 직접 표를 사게 하면 표 판매 수수료가 줄어요.',
      options: [
        { label: '만들기', desc: `${round(x.s * 1.2)}억 · 표 판매 수수료 −30% (계속)`, cost: round(x.s * 1.2), ai: 1.1, effects: [{ kind: 'mod', mod: { kind: 'sales', value: 0.7, until: x.t + 1200, label: '인터넷 예약' } }] },
        decline('나중에'),
      ],
    }),
  },
  {
    id: 'retrofit',
    when: (x) => x.year >= 1985 && x.c.planes.length >= 4,
    build: (x) => {
      const cost = round(x.s * 0.08 * x.c.planes.length);
      return {
        scenario: 'retrofit',
        icon: '🔧',
        title: '엔진 손질로 연료 아끼기',
        text: `엔진 회사가 우리 비행기 ${x.c.planes.length}대의 엔진을 손봐 주겠대요.`,
        options: [
          { label: '모두 손보기', desc: `${cost}억 · 연료 −5% (${years(48)})`, cost, ai: 0.9, effects: [{ kind: 'mod', mod: { kind: 'fuel', value: 0.95, until: x.t + 48, label: '엔진 손질' } }] },
          decline('안 해요'),
        ],
      };
    },
  },
  {
    id: 'film',
    when: (x) => x.c.planes.length >= 1,
    build: (x) => ({
      scenario: 'film',
      icon: '🎬',
      title: '영화 촬영 협찬',
      text: '영화사가 우리 비행기에서 영화를 찍고 싶대요.',
      options: [
        { label: '협찬하기', desc: `협찬금 +${round(x.s * 0.3)}억 · 평판 +3`, cost: 0, ai: 1.2, effects: [{ kind: 'cash', amount: round(x.s * 0.3) }, { kind: 'rep', amount: 3 }] },
        decline('거절하기'),
      ],
    }),
  },
  {
    id: 'outsource',
    when: (x) => x.c.planes.length >= 5,
    build: (x) => ({
      scenario: 'outsource',
      icon: '🔩',
      title: '정비 맡기기',
      text: '정비 전문 회사가 우리 비행기 정비를 맡겠대요. 싸지만 손님들은 조금 불안해해요.',
      options: [
        { label: '맡기기', desc: `승무원·정비비 −6% (${years(48)}) · 평판 −3`, cost: 0, ai: 0.8, effects: [{ kind: 'mod', mod: { kind: 'crew', value: 0.94, until: x.t + 48, label: '정비 외주' } }, { kind: 'rep', amount: -3 }] },
        decline('직접 하기', '바뀌는 것 없어요'),
      ],
    }),
  },
  {
    id: 'tourboard',
    when: (x) => funCities(x).length > 0,
    build: (x) => {
      const city = pickOne(funCities(x), x.rng);
      if (!city) return null;
      return {
        scenario: 'tourboard',
        icon: '🗺️',
        title: `${CITY[city].name} 관광청 공동 광고`,
        text: `${CITY[city].name} 관광청이 광고비를 반씩 내서 함께 광고하자고 해요.`,
        options: [
          { label: '함께 하기', desc: `${round(x.s * 0.3)}억 · ${CITY[city].name} 노선 관광 손님 +15% (1년)`, cost: round(x.s * 0.3), ai: 1, effects: [{ kind: 'mod', mod: { kind: 'demand', value: 1.15, until: x.t + 12, city, seg: 'leisure', label: `${CITY[city].name} 공동 광고` } }] },
          decline('안 해요'),
        ],
      };
    },
  },
  {
    id: 'charter',
    when: (x) => x.c.planes.some(isIdle),
    build: (x) => {
      const p = x.c.planes.find(isIdle)!;
      return {
        scenario: 'charter',
        icon: '🧳',
        title: '전세기 부탁',
        text: `큰 여행 모임이 쉬고 있는 우리 ${MODEL[p.model].name}을 한 번 빌리고 싶대요.`,
        options: [
          { label: '빌려주기', desc: `전세 요금 +${round(x.s * 0.4)}억`, cost: 0, ai: 1.3, effects: [{ kind: 'cash', amount: round(x.s * 0.4) }] },
          decline('거절하기'),
        ],
      };
    },
  },
];

/** 보조금을 줄 만한 작은 도시 (본사 지역, 아직 지점이 없는 곳, 너무 멀지 않은 곳) */
function smallCities(x: Ctx): string[] {
  const region = CITY[x.c.hub].region;
  return CITIES.filter(
    (c) =>
      c.region === region &&
      !x.c.branches.includes(c.id) &&
      citySize(c, x.year) <= 4.5 &&
      airportClass(c, x.year) >= 1 &&
      dist(c.id, x.c.hub) >= 300 &&
      dist(c.id, x.c.hub) <= 5000,
  ).map((c) => c.id);
}

/** 결정 사건 종류 (테스트·화면용) */
export const SCENARIO_IDS: readonly string[] = SCENARIOS.map((sc) => sc.id);

/** 관광지이면서 우리 노선이 닿은 도시 */
function funCities(x: Ctx): string[] {
  const set = new Set<string>();
  for (const r of x.c.routes) for (const city of [r.a, r.b]) if (CITY[city].fun >= 7) set.add(city);
  return [...set];
}

/** 이번에 이 회사에 올 결정 사건 (없으면 null) */
export function makeChoice(state: AirlineState, ci: number, rng: Rng): Draft | null {
  const c = state.companies[ci];
  const ctx: Ctx = { state, ci, c, year: yearOf(state.q), q: state.q, t: state.t, s: choiceScale(state, ci), rng };
  const pool = SCENARIOS.filter((sc) => sc.when(ctx));
  // 섞어서 처음으로 만들어지는 것
  for (let tries = 0; tries < 6 && pool.length; tries++) {
    const k = Math.floor(rng() * pool.length);
    const draft = pool[k].build(ctx);
    if (draft) return draft;
    pool.splice(k, 1);
  }
  return null;
}

/** 제휴했을 때 서로 좋은 정도 (받는 쪽 to가 보기에). 0보다 크면 받아들인다 */
export function allianceScore(state: AirlineState, from: number, to: number): number {
  const a = state.companies[from];
  const b = state.companies[to];
  if (!a || !b || a.out || b.out || from === to) return -99;
  if (a.partner !== null || b.partner !== null) return -99;
  const shared = a.branches.filter((x) => b.branches.includes(x)).length;
  const bPairs = new Set(b.routes.map((r) => pairKey(r.a, r.b)));
  const overlap = a.routes.filter((r) => bPairs.has(pairKey(r.a, r.b))).length;
  const va = companyValue(state, from);
  const vb = companyValue(state, to);
  const small = va < vb * 0.3 ? 2 : 0;
  const sameHubRegion = CITY[a.hub].region === CITY[b.hub].region ? 1.5 : 0;
  return Math.min(5, shared) * 1 - overlap * 1.5 - small - sameHubRegion + 0.5;
}

/** 제휴 제안 사건 (사람 회사가 받는다) */
export function allianceChoice(state: AirlineState, from: number, _to: number): Draft {
  const a = state.companies[from];
  return {
    scenario: 'alliance',
    icon: '🤝',
    title: `${a.name}의 제휴 제안`,
    text: `${withJosa(a.name, '이/가')} 공동 운항(코드셰어)을 하자고 해요 (본사 ${CITY[a.hub].name}). 제휴하면 서로의 노선을 이어 갈아타는 손님을 함께 태우고, 둘 다 지점이 있는 도시에서 손님이 조금 늘어요.`,
    from,
    options: [
      { label: '받아들이기', desc: '제휴 시작 (언제든 끝낼 수 있어요)', cost: 0, ai: 1, effects: [{ kind: 'alliance', with: from }] },
      decline('거절하기'),
    ],
  };
}

/** 컴퓨터가 고르는 선택지 번호 */
export function aiChoose(choice: Choice, cash: number, reserve: number, easy: boolean, rng: Rng): number {
  const ok = choice.options.map((o, i) => ({ o, i })).filter(({ o }) => o.cost <= Math.max(0, cash - reserve));
  if (ok.length === 0) return choice.options.length - 1;
  if (easy) return ok[Math.floor(rng() * ok.length)].i;
  ok.sort((x, y) => y.o.ai - x.o.ai);
  return ok[0].i;
}

/** 다음 결정 사건까지 (9~12달) */
export function nextChoiceGap(rng: Rng): number {
  return 9 + Math.floor(rng() * 4);
}
