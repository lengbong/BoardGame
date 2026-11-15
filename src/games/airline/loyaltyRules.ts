import { alliesOf } from './alliances';
import { withJosa } from '../../lib/korean';
import { BRAND_CHANGE_MONTHS, BRAND_INFO, BRAND_TIERS, brandBlocker, brandChangeCost, brandTier, lastYearAwards, newBrand, stepBrand } from './brandPosition';
import { DOWNGRADE_LOSS, LOYALTY_LEVELS, LOYALTY_NAME, emptyRegionMap, loyaltyBlocker, loyaltyLevel, maxLevel, newLoyalty, regionFlights, settleCost, stepMembers, totalMembers, upgradeFee } from './loyalty';
import { REGIONS } from './cities';
import { isQuarterEnd } from './time';
import type { AirlineState, Company, CompanyReport, NewsItem, RegionId, SeatIndex } from './types';
import type { LoyaltyAction, LoyaltyLevel, LoyaltyState } from './loyaltyTypes';

/*
 * 단골 프로그램·브랜드 자리의 행동과 달마다 바뀌는 것 (rules.ts는 여기로 넘기기만 한다). rules.ts를 부르지 않는다.
 */

export function isLoyaltyAction(a: { type: string }): a is LoyaltyAction {
  return a.type === 'setLoyalty' || a.type === 'setBrandPos';
}

const money = (v: number) => (Math.abs(v) < 10 ? `${(Math.round(v * 10) / 10).toLocaleString('ko-KR')}억` : `${Math.round(v).toLocaleString('ko-KR')}억`);

/** '12.3만 명' */
export function peopleText(n: number): string {
  const r = Math.round(n);
  if (r >= 10000) return `${(r / 10000).toFixed(r >= 1000000 ? 0 : 1)}만 명`;
  return `${r.toLocaleString('ko-KR')}명`;
}

function withLog(s: AirlineState, seat: SeatIndex | null, text: string): AirlineState {
  const log = [...s.log, { id: s.nextLogId, seat, text }];
  return { ...s, log: log.length > 80 ? log.slice(-80) : log, nextLogId: s.nextLogId + 1 };
}

function addNews(state: AirlineState, item: Omit<NewsItem, 'id' | 't'>): AirlineState {
  const news = [...state.news, { ...item, id: state.nextId, t: state.t }];
  return { ...state, news: news.length > 70 ? news.slice(-70) : news, nextId: state.nextId + 1 };
}

/** 회사 하나를 바꾼 새 상태 (나머지 회사는 그대로) */
function withCompany(state: AirlineState, ci: number, c: Company, what: 'level' | 'brand'): AirlineState {
  const companies = state.companies.slice();
  companies[ci] = c;
  return { ...state, companies, events: [{ id: state.nextEventId, type: 'loyalty', company: ci, what }], nextEventId: state.nextEventId + 1 };
}

const clampRep = (v: number) => Math.max(0, Math.min(100, v));

/** 단골 프로그램 단계 바꾸기·브랜드 자리 정하기 */
export function applyLoyaltyAction(state: AirlineState, action: LoyaltyAction, ci: number): AirlineState {
  const c0 = state.companies[ci];
  if (action.type === 'setLoyalty') {
    const level = action.level;
    if (loyaltyBlocker(state, ci, level)) return state;
    const cur = loyaltyLevel(c0);
    if (level === 0) {
      const settle = settleCost(c0);
      const had = totalMembers(c0.loyalty) > 0;
      const c: Company = { ...c0, cash: c0.cash - settle, loyalty: undefined, reputation: had ? clampRep(c0.reputation - 2) : c0.reputation };
      const s = withCompany(state, ci, c, 'level');
      return withLog(s, c0.seat, `${c0.name}: 💳 ${LOYALTY_NAME} 프로그램을 그만뒀어요${settle > 0 ? ` (남은 마일리지 정리 −${money(settle)})` : ''}`);
    }
    const fee = upgradeFee(c0, cur, level);
    let loyalty: LoyaltyState;
    if (!c0.loyalty) loyalty = newLoyalty(level, state.t);
    else if (level > cur) loyalty = { ...c0.loyalty, level };
    else {
      // 단계를 내리면 실망한 회원 일부가 바로 떠난다
      const members = emptyRegionMap();
      for (const r of REGIONS) members[r] = Math.round(c0.loyalty.members[r] * (1 - DOWNGRADE_LOSS));
      loyalty = { ...c0.loyalty, level, members };
    }
    const c: Company = { ...c0, cash: c0.cash - fee, loyalty };
    const s = withCompany(state, ci, c, 'level');
    const info = LOYALTY_LEVELS[level];
    const verb = cur === 0 ? '시작' : level > cur ? '올림' : '내림';
    return withLog(s, c0.seat, `${c0.name}: ${info.icon} ${LOYALTY_NAME} ${info.name} 단계 ${verb}${fee > 0 ? ` (−${money(fee)})` : ''}`);
  }
  // 브랜드 자리
  const pos = action.pos;
  if (brandBlocker(state, ci, pos)) return state;
  const b = c0.brandPos;
  if (!b) {
    const c: Company = { ...c0, brandPos: newBrand(pos, state.t) };
    return withLog(withCompany(state, ci, c, 'brand'), c0.seat, `${c0.name}: 브랜드는 ${BRAND_INFO[pos].icon} ${BRAND_INFO[pos].name}`);
  }
  if (pos === b.pos) {
    // 바꾸기를 그만둔다 (낸 돈은 돌려받지 못한다)
    const c: Company = { ...c0, brandPos: { ...b, next: null } };
    return withLog(withCompany(state, ci, c, 'brand'), c0.seat, `${c0.name}: 브랜드 바꾸기를 그만두고 ${BRAND_INFO[pos].name} 그대로`);
  }
  const cost = brandChangeCost(c0);
  const c: Company = { ...c0, cash: c0.cash - cost, brandPos: { ...b, next: { pos, t: state.t + BRAND_CHANGE_MONTHS } } };
  return withLog(withCompany(state, ci, c, 'brand'), c0.seat, `${c0.name}: 브랜드를 ${BRAND_INFO[pos].icon} ${withJosa(BRAND_INFO[pos].name, '으로/로')} 바꾸기 시작 (−${money(cost)}, 석 달 뒤)`);
}

/** 회원 수 문턱 (넘으면 사람 회사에 소식) */
const MEMBER_MILESTONES = [100000, 500000, 1000000, 3000000, 10000000];

/**
 * 달 결산(rules.ts의 runMonth) 뒤: 회원이 모이고 떠나고, 브랜드 힘이 움직이고, 문턱을 넘으면 소식.
 * runMonth가 이번 달을 위해 베낀 회사들의 loyalty·brandPos 자리에 새 값을 넣는다 (예전 값은 고치지 않는다).
 * 회사 객체 자체는 바꾸지 않는다: runMonth가 같은 회사 객체로 배당 등을 이어서 셈하기 때문.
 * reports: 이번 달 회사마다 결산
 */
export function loyaltyMonth(state: AirlineState, t: number, reports: readonly CompanyReport[]): AirlineState {
  if (!state.companies.some((c) => c.loyalty || c.brandPos)) return state;
  let s = state;
  const n = s.companies.length;
  const flightsCache = new Map<number, Record<RegionId, number>>();
  const flightsOf = (i: number) => {
    let f = flightsCache.get(i);
    if (!f) {
      f = regionFlights(s.companies[i]);
      flightsCache.set(i, f);
    }
    return f;
  };
  // 1) 운항을 멈춘 회사: 인수되었으면 회원 절반을 인수한 회사(프로그램이 있으면)가 넘겨받는다
  for (let ci = 0; ci < n; ci++) {
    const c = s.companies[ci];
    if (!c.out || (!c.loyalty && !c.brandPos)) continue;
    const j = c.mergedInto;
    const to = j !== undefined ? s.companies[j] : undefined;
    if (c.loyalty && to && !to.out && to.loyalty) {
      const members = { ...to.loyalty.members };
      for (const r of REGIONS) members[r] += Math.round(c.loyalty.members[r] * 0.5);
      to.loyalty = { ...to.loyalty, members };
    }
    c.loyalty = undefined;
    c.brandPos = undefined;
  }
  // 2) 회원과 브랜드
  const view = s;
  const news: Omit<NewsItem, 'id' | 't'>[] = [];
  const logs: [SeatIndex, string][] = [];
  for (let ci = 0; ci < n; ci++) {
    const c = view.companies[ci];
    if (c.out) continue;
    const rep = reports[ci];
    if (!rep) continue;
    // 사업 모델이 바뀌었으면 맞지 않는 단계·브랜드를 정리한다 (저가항공은 기본까지, 화물 전문은 없음)
    if (c.loyalty && c.loyalty.level > maxLevel(c)) {
      const max = maxLevel(c);
      c.loyalty = max === 0 ? undefined : { ...c.loyalty, level: max };
    }
    if (c.brandPos && c.bizModel === 'cargo') c.brandPos = undefined;
    const allies = alliesOf(view, ci);
    const human = c.kind === 'human';
    let before = 0;
    let after = 0;
    if (c.loyalty) {
      before = totalMembers(c.loyalty);
      let allyFlights: Record<RegionId, number> | null = null;
      if (allies.length > 0) {
        allyFlights = emptyRegionMap();
        for (const i of allies) {
          const f = flightsOf(i);
          for (const r of REGIONS) allyFlights[r] += f[r];
        }
      }
      const next = stepMembers(view, ci, t, rep, flightsOf(ci), allyFlights);
      after = totalMembers(next);
      c.loyalty = next;
      if (human) {
        const hit = MEMBER_MILESTONES.find((m) => before < m && after >= m);
        if (hit) {
          news.push({
            icon: '💳',
            title: `${c.name}: 단골 손님 ${peopleText(hit)} 넘었어요`,
            text: `${LOYALTY_NAME} 회원이 ${peopleText(after)}이 됐어요. 회원은 우리 비행기를 더 고르고, 운임이 조금 비싸도 덜 떠나요.`,
            tone: 'good',
            for: [ci],
            company: ci,
          });
        }
      }
    }
    if (c.brandPos) {
      const b0 = c.brandPos;
      const b = stepBrand(b0, c, t, rep, allies.length > 0, lastYearAwards(view, ci, t));
      const switched = !!b0.next && b.pos !== b0.pos;
      const info = BRAND_INFO[b.pos];
      // 알린 문턱: 바꾸면 새 브랜드는 남은 힘에서 다시 센다. 오르내림이 잦아도 같은 소식을 거듭 내지 않게 5만큼 여유를 둔다
      const told = switched ? brandTier(b.strength) : (b0.told ?? brandTier(b0.strength));
      const up = brandTier(b.strength);
      const down = brandTier(b.strength + 5);
      if (switched && human) {
        news.push({ icon: info.icon, title: `${c.name}: 이제 '${info.name}' 브랜드`, text: `새 브랜드로 바꿨어요. 쌓아 둔 브랜드 힘의 일부(${Math.round(b.strength)})만 남았으니, '${info.desc}'라는 모습을 꾸준히 보여 주세요.`, tone: 'info', for: [ci], company: ci });
      }
      if (!switched && up > told && (human || up === BRAND_TIERS.length)) {
        const tier = BRAND_TIERS[up - 1];
        news.push({
          icon: info.icon,
          title: `${c.name}: '${info.name}' 하면 떠오르는 회사`,
          text: `브랜드 힘이 ${tier.at} 넘게 올라 '${tier.name}'가 됐어요. ${info.effect}.`,
          tone: 'good',
          for: human ? [ci] : undefined,
          company: ci,
        });
      } else if (!switched && down < told && human) {
        news.push({
          icon: '🌫️',
          title: `${c.name}: '${info.name}' 브랜드가 흐려지고 있어요`,
          text: `내세운 모습과 실제가 어긋나 브랜드 힘이 ${Math.round(b.strength)}로 내려왔어요. 재무 화면 ‘단골·브랜드’에서 까닭을 살펴보세요.`,
          tone: 'bad',
          for: [ci],
          company: ci,
        });
      }
      c.brandPos = { ...b, told: switched ? told : up > told ? up : down < told ? down : told };
    }
    // 분기 끝: 사람 회사 진행 기록에 한 줄
    if (human && isQuarterEnd(t) && (c.loyalty || c.brandPos)) {
      const parts: string[] = [];
      if (c.loyalty) {
        const h = c.loyalty.hist;
        const q0 = h.length >= 4 ? h[h.length - 4] : 0;
        const d = after - q0;
        parts.push(`💳 단골 손님 ${peopleText(after)} (석 달 ${d >= 0 ? '+' : '−'}${peopleText(Math.abs(d))})`);
      }
      if (c.brandPos) parts.push(`${BRAND_INFO[c.brandPos.pos].icon} ${BRAND_INFO[c.brandPos.pos].name} 브랜드 힘 ${Math.round(c.brandPos.strength)}`);
      logs.push([c.seat, `${c.name}: ${parts.join(' · ')}`]);
    }
  }
  for (const item of news) s = addNews(s, item);
  for (const [seat, text] of logs) s = withLog(s, seat, text);
  return s;
}

/** 단계 이름 ('🥈 실버') */
export function levelLabel(level: 0 | LoyaltyLevel): string {
  return level === 0 ? '없음' : `${LOYALTY_LEVELS[level].icon} ${LOYALTY_LEVELS[level].name}`;
}
