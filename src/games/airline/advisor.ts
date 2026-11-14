import { MODEL, availableModels } from './aircraft';
import { Planner, suggestRoutes, openSuggestion } from './ai';
import { weather } from './calendar';
import { CITY, REGIONS, airportClass, dist } from './cities';
import { goalProgress } from './goals';
import { CRISIS_MONTHS, bestFreq, buyBlocker, creditLimit, fmtMoney, idlePlanes, planeById, routeById } from './rules';
import {
  MAINT_NAMES,
  WEEK_HOURS,
  spareCover,
  draftsOf,
  estimateExisting,
  legFreq,
  maxFreq,
  newLeaseFixed,
  planeAge,
  planeHours,
} from './simulate';
import { monthOf, yearOf } from './time';
import type { AirlineState, Company } from './types';

/**
 * 경영 비서: 지난달 숫자를 보고 할 만한 일을 3~5개 골라 준다.
 * apply가 있으면 한 번에 해 볼 수 있다 (못 하게 되었으면 상태를 그대로 돌려준다).
 */
export interface Advice {
  key: string;
  icon: string;
  title: string;
  detail: string;
  /** 어림한 달 이익 변화 (억) */
  gain?: number;
  /** 적용 버튼 글 */
  label?: string;
  apply?: (s: AirlineState) => AirlineState;
  /** 클수록 먼저 보여 준다 */
  weight: number;
}

function cityName(id: string): string {
  return CITY[id]?.name ?? id;
}

function routeName(c: Company, routeId: number): string {
  const r = routeById(c, routeId);
  return r ? `${cityName(r.a)}–${cityName(r.b)}` : '노선';
}

function planner(s: AirlineState, ci: number): Planner {
  return new Planner(s, ci, 'ai-normal', () => 0.5);
}

/** 이 회사에게 지금 권할 일들 (많아야 5개) */
export function advise(state: AirlineState, ci: number, max = 5): Advice[] {
  const c = state.companies[ci];
  if (!c || c.out || state.phase !== 'manage') return [];
  const out: Advice[] = [];
  const first = state.t - state.startT < 12;

  // 0. 결정할 일
  if (c.choice) {
    out.push({ key: 'choice', icon: c.choice.icon, title: `결정할 일: ${c.choice.title}`, detail: '고르지 않으면 차례를 마칠 때 마지막 안으로 정해져요.', weight: 1000 });
  }

  // 1. 첫 노선 (아직 비행기가 없을 때)
  if (c.routes.length === 0 || c.planes.length === 0) {
    const cand = suggestRoutes(state, ci, 1)[0];
    if (cand) {
      out.push({
        key: `first-${cand.a}-${cand.b}`,
        icon: '🛫',
        title: `첫 노선: ${cityName(cand.a)}–${cityName(cand.b)}`,
        detail: `${cand.model.name}을 리스해 주 ${cand.freq}회 띄우면 달 이익 약 ${fmtMoney(cand.profit)}을 기대해요.${first && c.kind === 'human' ? ' 첫해에는 리스 보증금이 없어요.' : ''}`,
        gain: cand.profit,
        label: '노선 열기',
        apply: (s) => openSuggestion(s, ci, cand),
        weight: 900,
      });
    }
  }

  // 2. 쉬는 비행기
  for (const p of idlePlanes(c).slice(0, 2)) {
    const pl = planner(state, ci);
    const best = pl.bestExistingLeg(p.id, false);
    const m = MODEL[p.model];
    if (best && best.gain > 0) {
      out.push({
        key: `idle-${p.id}`,
        icon: '😴',
        title: `쉬는 ${m.name}를 ${routeName(c, best.route)}에`,
        detail: `주 ${best.freq}회 띄우면 달 이익이 약 ${fmtMoney(best.gain)} 늘어요. 쉬는 비행기도 보험·보관비가 나가요.`,
        gain: best.gain,
        label: '띄우기',
        apply: (s) => afterAct(s, ci, { type: 'assign', plane: p.id, route: best.route, freq: best.freq }),
        weight: 500 + best.gain,
      });
    } else {
      out.push({
        key: `idle-sell-${p.id}`,
        icon: '😴',
        title: `쉬는 ${m.name} ${p.leased ? '돌려주기' : '팔기'}`,
        detail: p.leased ? '띄울 노선이 마땅치 않아요. 돌려주면 리스료가 나가지 않아요 (위약금 한 달 치).' : '띄울 노선이 마땅치 않아요. 팔면 현금이 생겨요.',
        label: p.leased ? '돌려주기' : '팔기',
        apply: (s) => afterAct(s, ci, { type: 'sell', plane: p.id }),
        weight: 300,
      });
    }
  }

  // 3. 비행시간이 많이 남는 비행기
  let spareDone = 0;
  for (const p of c.planes) {
    if (spareDone >= 1 || p.legs.length === 0) continue;
    const spare = WEEK_HOURS - planeHours(c, p);
    if (spare < 20) continue;
    const best = planner(state, ci).bestExistingLeg(p.id, true);
    if (!best || best.gain < 2) continue;
    spareDone++;
    out.push({
      key: `spare-${p.id}`,
      icon: '⏱️',
      title: `${MODEL[p.model].name}의 남는 ${Math.round(spare)}시간 쓰기`,
      detail: `한 주에 ${Math.round(spare)}시간이 비어요. ${routeName(c, best.route)}도 주 ${best.freq}회 날면 달 이익 약 +${fmtMoney(best.gain)}.`,
      gain: best.gain,
      label: '노선 보태기',
      apply: (s) => afterAct(s, ci, { type: 'assign', plane: p.id, route: best.route, freq: best.freq }),
      weight: 400 + best.gain,
    });
  }

  // 4. 노선마다: 운임·횟수·닫기
  for (const r of c.routes) {
    const st = r.stats;
    if (!st || c.planes.every((p) => legFreq(p, r.id) === 0)) continue;
    const now = estimateExisting(state, ci, r);
    if (st.lossStreak >= 4 && now.profit < 0) {
      out.push({
        key: `close-${r.id}`,
        icon: '✂️',
        title: `${routeName(c, r.id)} 닫기`,
        detail: `${st.lossStreak}달 내리 적자예요 (지난달 ${fmtMoney(st.profit)}). 닫으면 비행기를 다른 곳에 쓸 수 있어요.`,
        gain: -now.profit,
        label: '노선 닫기',
        apply: (s) => afterAct(s, ci, { type: 'closeRoute', route: r.id }),
        weight: 350 - now.profit,
      });
      continue;
    }
    if (st.lf > 0.95) {
      const up = Math.min(30, r.fare + 10);
      const e = estimateExisting(state, ci, r, { fare: up });
      const gainFare = e.profit - now.profit;
      // 비행기를 하나 더 리스하면?
      const lease = bestLeaseFor(state, ci, r.id);
      if (lease && lease.gain > gainFare && lease.gain > 3) {
        out.push({
          key: `add-${r.id}`,
          icon: '➕',
          title: `${routeName(c, r.id)}에 ${MODEL[lease.model].name} 보태기`,
          detail: `탑승률 ${Math.round(st.lf * 100)}% — 손님을 놓치고 있어요. 리스해서 주 ${lease.freq}회 보태면 달 이익 약 +${fmtMoney(lease.gain)}.`,
          gain: lease.gain,
          label: '리스해서 보태기',
          apply: (s) => leaseAndAssign(s, ci, lease.model, r.id, lease.freq),
          weight: 300 + lease.gain,
        });
      } else if (gainFare > 1 && up !== r.fare) {
        out.push({
          key: `fareup-${r.id}`,
          icon: '💹',
          title: `${routeName(c, r.id)} 운임 올리기`,
          detail: `좌석이 꽉 찼어요 (${Math.round(st.lf * 100)}%). 운임을 ${signed(up)}%로 올리면 달 이익 약 +${fmtMoney(gainFare)}.`,
          gain: gainFare,
          label: `운임 ${signed(up)}%`,
          apply: (s) => afterAct(s, ci, { type: 'setFare', route: r.id, fare: up }),
          weight: 250 + gainFare,
        });
      }
    } else if (st.lf < 0.6) {
      const down = Math.max(-30, r.fare - 10);
      const e = estimateExisting(state, ci, r, { fare: down });
      const gainFare = e.profit - now.profit;
      // 횟수를 줄이면? (가장 많이 나는 비행기 하나를 줄여 본다)
      const planes = c.planes.filter((p) => legFreq(p, r.id) > 0).sort((x, y) => legFreq(y, r.id) - legFreq(x, r.id));
      const p = planes[0];
      const cur = p ? legFreq(p, r.id) : 0;
      const less = Math.max(1, Math.round(cur * 0.6));
      let gainFreq = -Infinity;
      if (p && less < cur) {
        const pl = planner(state, ci);
        gainFreq = estimateExisting(state, ci, r, { planes: pl.draftOf(r.id, p.id, less) }).profit - now.profit;
      }
      if (gainFreq > gainFare && gainFreq > 1 && p) {
        out.push({
          key: `freqdown-${r.id}`,
          icon: '📉',
          title: `${routeName(c, r.id)} 횟수 줄이기`,
          detail: `탑승률이 ${Math.round(st.lf * 100)}%예요. ${MODEL[p.model].name}를 주 ${cur}회 → ${less}회로 줄이면 달 이익 약 +${fmtMoney(gainFreq)}, 남는 시간은 다른 노선에 쓸 수 있어요.`,
          gain: gainFreq,
          label: `주 ${less}회로`,
          apply: (s) => afterAct(s, ci, { type: 'assign', plane: p.id, route: r.id, freq: less }),
          weight: 220 + gainFreq,
        });
      } else if (gainFare > 1 && down !== r.fare) {
        out.push({
          key: `faredown-${r.id}`,
          icon: '🏷️',
          title: `${routeName(c, r.id)} 운임 내리기`,
          detail: `탑승률이 ${Math.round(st.lf * 100)}%예요. 운임을 ${signed(down)}%로 내리면 손님이 늘어 달 이익 약 +${fmtMoney(gainFare)}.`,
          gain: gainFare,
          label: `운임 ${signed(down)}%`,
          apply: (s) => afterAct(s, ci, { type: 'setFare', route: r.id, fare: down }),
          weight: 200 + gainFare,
        });
      }
    }
  }

  // 5. 낡은 비행기
  const old = c.planes.filter((p) => p.legs.length > 0 && planeAge(state, p) >= 18).sort((x, y) => planeAge(state, y) - planeAge(state, x))[0];
  if (old) {
    const rep = replacementFor(state, ci, old.id);
    if (rep && rep.gain > 2) {
      out.push({
        key: `renew-${old.id}`,
        icon: '🔧',
        title: `낡은 ${MODEL[old.model].name} 바꾸기`,
        detail: `${Math.round(planeAge(state, old))}년 된 비행기는 정비비·연료가 많이 들고 손님도 덜 좋아해요. ${MODEL[rep.model].name} 리스로 바꾸면 달 이익 약 +${fmtMoney(rep.gain)}. 미리 새 비행기를 주문해 두면 더 싸요.`,
        gain: rep.gain,
        label: '리스기로 바꾸기',
        apply: (s) => replacePlane(s, ci, old.id, rep.model),
        weight: 180 + rep.gain,
      });
    }
  }

  // 6. 새 노선
  if (c.routes.length > 0 && c.planes.length > 0) {
    const cand = suggestRoutes(state, ci, 1)[0];
    const reserve = Math.max(60, (state.report?.companies[ci]?.ticket ?? 0) * 0.45);
    if (cand && cand.profit > 3 && c.cash - cand.capital > reserve) {
      out.push({
        key: `route-${cand.a}-${cand.b}`,
        icon: '🗺️',
        title: `새 노선: ${cityName(cand.a)}–${cityName(cand.b)}`,
        detail: `${cand.model.name} 리스로 주 ${cand.freq}회, 달 이익 약 ${fmtMoney(cand.profit)} 어림${cand.needBranch.length ? ` (지점 ${cand.needBranch.map(cityName).join('·')} 함께)` : ''}.`,
        gain: cand.profit,
        label: '노선 열기',
        apply: (s) => openSuggestion(s, ci, cand),
        weight: 150 + cand.profit,
      });
    }
  }

  // 6½. 운항 현장: 지연·결항이 잦으면 정비와 예비기
  const repM = state.report?.companies[ci];
  if (repM && repM.flights > 0) {
    const cancelRate = repM.cancelled / repM.flights;
    if ((c.onTime < 0.8 || cancelRate > 0.03) && c.maint < 5) {
      const next = c.maint + 1;
      out.push({
        key: 'maint',
        icon: '🔧',
        title: `정비 수준을 ‘${MAINT_NAMES[next]}’로 올리기`,
        detail: `지난달 정시 운항률 ${Math.round(repM.onTime * 100)}%, 결항 ${repM.cancelled}편이에요. 정비를 꼼꼼히 하면 승무원·정비비가 조금 늘지만 지연·결항·기체 점검이 줄고 평판이 올라요.`,
        label: '정비 올리기',
        apply: (s) => afterAct(s, ci, { type: 'setMaint', level: next }),
        weight: 240,
      });
    }
    const flying = c.planes.filter((p) => p.legs.length > 0).length;
    if (flying >= 12 && spareCover(c) === 0 && cancelRate > 0.015) {
      out.push({
        key: 'spare',
        icon: '🛟',
        title: '예비기 한 대 두기',
        detail: `비행기가 ${flying}대인데 쉬는 예비기가 없어요. 노선에 넣지 않은 비행기가 한두 대 있으면 기체 점검으로 빠진 비행기 대신 날아서 결항이 줄어요.`,
        weight: 120,
      });
    }
  }
  const m0 = monthOf(state.t) - 1;
  if ((m0 === 5 || m0 === 4) && c.routes.some((r) => weather(r.a, 7).cause === 'typhoon' || weather(r.b, 7).cause === 'typhoon')) {
    out.push({ key: 'typhoon', icon: '🌀', title: '7~9월은 태풍철이에요', detail: '동아시아 바닷가 공항은 태풍으로 하루 이틀 닫힐 수 있어요. 예비기와 정비를 챙기고, 결항이 나도 손님은 다른 날로 옮겨 타요.', weight: 80 });
  }
  if ((m0 === 10 || m0 === 11) && c.routes.some((r) => weather(r.a, 0).cause === 'snow' || weather(r.b, 0).cause === 'snow')) {
    out.push({ key: 'snow', icon: '❄️', title: '12~2월은 눈이 많이 와요', detail: '북쪽 공항은 폭설로 지연·결항이 늘어요. 정비 수준과 예비 승무원을 넉넉히 하면 덜 흔들려요.', weight: 80 });
  }

  // 7. 돈
  const rep = state.report?.companies[ci];
  const limit = creditLimit(state, ci);
  if (c.cash < 30 && c.debt < limit - 50) {
    const amount = Math.floor(Math.min(limit - c.debt, 150));
    out.push({
      key: 'borrow',
      icon: '🏦',
      title: '현금이 모자라요',
      detail: `현금이 ${fmtMoney(c.cash)}뿐이에요. 달 끝에 돈이 모자라면 저절로 빚이 생기고, ${CRISIS_MONTHS}달 이어지면 운항을 멈춰야 해요. ${fmtMoney(amount)}을 빌려 두세요.`,
      label: `${fmtMoney(amount)} 빌리기`,
      apply: (s) => afterAct(s, ci, { type: 'borrow', amount }),
      weight: 800,
    });
  } else if (c.debt > 0 && rep && c.cash > rep.ticket * 1.8 + 200) {
    const amount = Math.floor(Math.min(c.debt, c.cash - rep.ticket * 1.2 - 100));
    if (amount >= 20) {
      out.push({
        key: 'repay',
        icon: '💰',
        title: '빚 갚기',
        detail: `돈이 넉넉해요. ${fmtMoney(amount)}을 갚으면 달 이자 약 ${fmtMoney((amount * state.rate) / 1200)}을 아껴요.`,
        gain: (amount * state.rate) / 1200,
        label: `${fmtMoney(amount)} 갚기`,
        apply: (s) => afterAct(s, ci, { type: 'repay', amount }),
        weight: 60,
      });
    }
  }

  // 8. 광고 (이익이 나는데 광고를 안 할 때)
  if (rep && rep.profit > 0 && REGIONS.every((r) => c.ads[r] === 0) && c.planes.length >= 2) {
    const region = CITY[c.hub].region;
    const amount = Math.min(60, Math.max(2, Math.round(rep.ticket * 0.015)));
    out.push({
      key: 'ads',
      icon: '📣',
      title: '본사 지역에 광고하기',
      detail: `광고는 그 지역에서 우리 회사를 알려 손님을 끌어와요 (쌓이는 데 몇 달 걸려요). 달마다 ${fmtMoney(amount)}부터 시작해 보세요.`,
      label: `광고 ${fmtMoney(amount)}`,
      apply: (s) => afterAct(s, ci, { type: 'setAds', region, amount }),
      weight: 70,
    });
  }

  // 9. 연간 목표 알림 (11·12월)
  if (monthOf(state.t) >= 11) {
    const g = c.goals.find((x) => x.done === null && goalProgress(state, ci, x) < 1 && goalProgress(state, ci, x) > 0.5);
    if (g) out.push({ key: `goal-${g.kind}`, icon: '🎯', title: `올해 목표가 눈앞이에요: ${g.text}`, detail: `지금 ${Math.round(goalProgress(state, ci, g) * 100)}%. 이루면 ${fmtMoney(g.reward.cash)}과 평판 +${g.reward.rep}.`, weight: 90 });
  }

  // 할 일이 별로 없으면: 자동 진행 안내
  if (c.routes.length >= 3 && !c.choice && out.filter((a) => a.apply).length <= 1) {
    out.push({ key: 'auto', icon: '⏩', title: '한동안 맡겨 두기', detail: '지금은 크게 고칠 곳이 없어요. ‘결정할 일이 생길 때까지 자동 진행’을 누르면 결정할 일·큰 사건·돈 걱정·라이벌 소식이 생길 때까지 달을 넘겨요.', label: '자동 진행', weight: 30 });
  }

  // 같은 노선 권고가 겹치지 않게 하고 무게 순으로
  out.sort((x, y) => y.weight - x.weight);
  const seen = new Set<string>();
  const picked: Advice[] = [];
  for (const a of out) {
    if (seen.has(a.title)) continue;
    seen.add(a.title);
    picked.push(a);
    if (picked.length >= max) break;
  }
  return picked;
}

function signed(v: number): string {
  return v > 0 ? `+${v}` : `${v}`;
}

/** 행동 하나를 해 본다 (안 되면 그대로) */
function afterAct(s: AirlineState, ci: number, action: Parameters<Planner['act']>[0]): AirlineState {
  const pl = planner(s, ci);
  pl.act(action);
  return pl.s;
}

/** 이 노선에 리스로 한 대 보탤 때 가장 좋은 기종 */
function bestLeaseFor(state: AirlineState, ci: number, routeId: number): { model: string; freq: number; gain: number } | null {
  const c = state.companies[ci];
  const r = routeById(c, routeId);
  if (!r) return null;
  const year = yearOf(state.q);
  const d = dist(r.a, r.b);
  const before = estimateExisting(state, ci, r).profit;
  const pl = planner(state, ci);
  let best: { model: string; freq: number; gain: number } | null = null;
  for (const m of availableModels(year)) {
    if (m.range < d || airportClass(CITY[r.a], year) < m.runway || airportClass(CITY[r.b], year) < m.runway) continue;
    if (buyBlocker(state, ci, m.id, true)) continue;
    const freq = Math.max(1, Math.round(maxFreq(m, d) * 0.6));
    const after = estimateExisting(state, ci, r, { planes: pl.draftOf(r.id, null, 0, { model: m.id, freq, fixed: newLeaseFixed(state, m) }) }).profit;
    const gain = after - before;
    if (!best || gain > best.gain) best = { model: m.id, freq, gain };
  }
  return best;
}

function leaseAndAssign(s: AirlineState, ci: number, model: string, routeId: number, freq: number): AirlineState {
  const pl = planner(s, ci);
  if (!pl.act({ type: 'lease', model })) return s;
  const pid = pl.c.planes[pl.c.planes.length - 1].id;
  const f = Math.min(freq, bestFreq(pl.s, ci, pid, routeId));
  if (f < 1 || !pl.act({ type: 'assign', plane: pid, route: routeId, freq: f })) return s;
  return pl.s;
}

/** 낡은 비행기를 바꿀 리스 기종 (첫 노선 기준) */
function replacementFor(state: AirlineState, ci: number, planeId: number): { model: string; gain: number } | null {
  const c = state.companies[ci];
  const p = planeById(c, planeId);
  if (!p || p.legs.length === 0) return null;
  const leg = p.legs[0];
  const r = routeById(c, leg.route);
  if (!r) return null;
  const year = yearOf(state.q);
  const d = dist(r.a, r.b);
  const before = estimateExisting(state, ci, r).profit;
  const onRoute = c.planes.filter((x) => legFreq(x, r.id) > 0);
  const drafts = draftsOf(state, c, r.id);
  let best: { model: string; gain: number } | null = null;
  for (const m of availableModels(year)) {
    if (m.range < d || airportClass(CITY[r.a], year) < m.runway || airportClass(CITY[r.b], year) < m.runway) continue;
    if (buyBlocker(state, ci, m.id, true)) continue;
    const draft = drafts.filter((_, i) => onRoute[i]?.id !== p.id);
    draft.push({ model: m.id, freq: Math.min(leg.freq, maxFreq(m, d)), fixed: newLeaseFixed(state, m) });
    const gain = estimateExisting(state, ci, r, { planes: draft }).profit - before;
    if (!best || gain > best.gain) best = { model: m.id, gain };
  }
  return best;
}

function replacePlane(s: AirlineState, ci: number, planeId: number, model: string): AirlineState {
  const pl = planner(s, ci);
  const p = planeById(pl.c, planeId);
  if (!p) return s;
  const legs = p.legs.map((l) => ({ ...l }));
  if (!pl.act({ type: 'lease', model })) return s;
  const pid = pl.c.planes[pl.c.planes.length - 1].id;
  if (!pl.act({ type: 'sell', plane: planeId })) return s;
  for (const l of legs) {
    const f = Math.min(l.freq, bestFreq(pl.s, ci, pid, l.route));
    if (f >= 1) pl.act({ type: 'assign', plane: pid, route: l.route, freq: f });
  }
  return pl.s;
}
