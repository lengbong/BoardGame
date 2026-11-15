import { MODEL, availableModels, capacityText, isFreighter, leadTime } from './aircraft';
import { PRESET_INFO, cabinOf, presetBlocker, presetCabin, presetOf, refitCost } from './cabin';
import { Planner, bestTimes, suggestRoutes, openSuggestion } from './ai';
import { ACADEMY_COST, STAFF_GROUPS, STAFF_INFO, hireCost, hireTime, staffCap, staffNeed, staffPipe } from './staff';
import { weather } from './calendar';
import { CITIES, CITY, REGIONS, airportClass, citySize, dist } from './cities';
import { tradeOf } from './cargo';
import { goalProgress } from './goals';
import { CRISIS_MONTHS, MAX_ROUTES, applyAction, bestFreq, branchBlocker, buyBlocker, creditLimit, fmtFine, fmtMoney, idlePlanes, planeById, routeById, usedBlocker } from './rules';
import {
  MAINT_COST,
  MAINT_NAMES,
  WEEK_HOURS,
  spareCover,
  draftsOf,
  estimateExisting,
  legFreq,
  maxFreq,
  newLeaseFixed,
  orderPrice,
  planeAge,
  planeHours,
} from './simulate';
import { monthOf, yearOf } from './time';
import type { AirlineState, CabinPreset, Company } from './types';

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
    if (!cand && c.model === 'cargo') {
      // 화물 전문인데 본사에서 짐이 적으면: 무역 도시에 지점부터
      const year = yearOf(state.q);
      const trade = CITIES.filter((x) => !c.branches.includes(x.id) && !branchBlocker(state, ci, x.id)).sort((x, y) => tradeOf(y.id) * citySize(y, year) - tradeOf(x.id) * citySize(x, year))[0];
      if (trade) {
        out.push({
          key: `tradehub-${trade.id}`,
          icon: '📦',
          title: `무역 도시 ${trade.name}에 지점 열기`,
          detail: `${cityName(c.hub)}에서는 화물기로 남을 노선이 마땅치 않아요. 짐이 많이 오가는 ${trade.name}에 지점을 열면 그곳을 잇는 화물 노선을 권할게요.`,
          label: '지점 열기',
          apply: (s2) => afterAct(s2, ci, { type: 'openBranch', city: trade.id }),
          weight: 880,
        });
      }
    }
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
  const fullRoutes: { route: number; model: string; gain: number }[] = [];
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
      if (lease && lease.gain > 0.3 && up === r.fare) fullRoutes.push({ route: r.id, model: lease.model, gain: lease.gain });
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
        if (lease && lease.gain > 0.3) fullRoutes.push({ route: r.id, model: lease.model, gain: lease.gain });
        out.push({
          key: `fareup-${r.id}`,
          icon: '💹',
          title: `${routeName(c, r.id)} 운임 올리기`,
          detail: `좌석이 꽉 찼어요 (${Math.round(st.lf * 100)}%). 운임을 ${signed(up)}%로 올리면 달 이익 약 +${fmtMoney(gainFare)}.`,
          gain: gainFare,
          label: `운임 ${signed(up)}%`,
          apply: (s) => afterAct(s, ci, { type: 'setFare', route: r.id, fare: up }),
          weight: 150 + gainFare * 2,
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
          weight: 150 + gainFreq * 2,
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
          weight: 145 + gainFare * 2,
        });
      }
    }
  }

  // 4¼. 꽉 찬 노선의 작은 비행기를 더 큰 리스기로 바꾸기 (노선 수 한도에 닿아도 자랄 수 있게)
  {
    const fullIds = new Set(c.routes.filter((r) => r.stats && r.stats.lf > 0.95 && r.fare >= 20).map((r) => r.id));
    const small = c.planes
      .filter((p) => p.legs.length === 1 && fullIds.has(p.legs[0].route))
      .sort((x, y) => MODEL[x.model].seats - MODEL[y.model].seats)
      .slice(0, 3);
    for (const p of small) {
      const rep = replacementFor(state, ci, p.id);
      if (!rep || rep.gain <= 2 || MODEL[rep.model].seats <= MODEL[p.model].seats * 1.15) continue;
      out.push({
        key: `upgrade-${p.id}`,
        icon: '⬆️',
        title: `${routeName(c, p.legs[0].route)}: ${MODEL[p.model].name} → ${MODEL[rep.model].name}`,
        detail: `좌석이 꽉 찼어요. ${MODEL[p.model].name}(${capacityText(MODEL[p.model])})${p.leased ? '를 돌려주고' : '를 팔고'} 더 큰 ${MODEL[rep.model].name}(${capacityText(MODEL[rep.model])})를 리스해 띄우면 달 이익 약 +${fmtMoney(rep.gain)}.`,
        gain: rep.gain,
        label: '큰 비행기로',
        apply: (s2) => replacePlane(s2, ci, p.id, rep.model),
        weight: 200 + rep.gain,
      });
      break;
    }
  }

  // 4½. 꽉 찬 노선에 리스로는 남는 게 적으면 새 비행기를 주문해 두기 (리스보다 싸고, 오면 그 노선에 넣는다)
  if (fullRoutes.length > 0) {
    const f = fullRoutes.sort((x, y) => y.gain - x.gain)[0];
    const m = MODEL[f.model];
    const rep2 = state.report?.companies[ci];
    const costs = rep2 ? rep2.fuel + rep2.crew + rep2.airport + rep2.service + rep2.sales + rep2.lease + rep2.fleet + rep2.branch + rep2.ads + rep2.interest + rep2.staff : 0;
    const price = orderPrice(state, m, c);
    const lead = leadTime(m, yearOf(state.q));
    const waiting = c.orders.length;
    if (lead <= 12 && waiting < 2 + Math.floor(c.planes.length / 8) && c.cash - price > costs * 2 + 150 && !buyBlocker(state, ci, m.id, false)) {
      out.push({
        key: `orderfull-${m.id}`,
        icon: '🛒',
        title: `${m.name} 주문해서 ${routeName(c, f.route)}에 보태기`,
        detail: `좌석이 꽉 찬 노선이 ${fullRoutes.length}개예요. 리스로는 남는 게 적지만, ${fmtMoney(price)}에 주문하면 ${lead}달 뒤에 와서 리스료 없이 손님을 더 태워요.`,
        label: '주문하기',
        apply: (s2) => afterAct(s2, ci, { type: 'buy', model: m.id }),
        weight: 180 + f.gain * 4,
      });
    }
  }

  // 4¾. 등급 운임·화물 운임: 큰 노선 몇 개에서 자리가 아주 차거나 비면 (한 달에 하나만)
  {
    const big = [...c.routes].filter((r) => r.stats && (r.stats.cls || r.stats.cargo)).sort((x, y) => (y.stats?.revenue ?? 0) - (x.stats?.revenue ?? 0)).slice(0, 5);
    let done = false;
    for (const r of big) {
      if (done) break;
      const st = r.stats!;
      const tries: { cls: 'c' | 'f' | 'k'; name: string; lf: number; cur: number }[] = [];
      if (st.cls && st.cls.seats[1] > 0) tries.push({ cls: 'c', name: '비즈니스', lf: st.cls.pax[1] / st.cls.seats[1], cur: r.fareC ?? 0 });
      if (st.cls && st.cls.seats[0] > 0) tries.push({ cls: 'f', name: '일등석', lf: st.cls.pax[0] / st.cls.seats[0], cur: r.fareF ?? 0 });
      if (st.cargo && st.cargo.cap > 0) tries.push({ cls: 'k', name: '화물', lf: st.cargo.t / st.cargo.cap, cur: r.fareK ?? 0 });
      for (const x of tries) {
        const next = x.lf > 0.97 ? Math.min(30, x.cur + 10) : x.lf < 0.5 ? Math.max(-30, x.cur - 10) : x.cur;
        if (next === x.cur) continue;
        const now = estimateExisting(state, ci, r).profit;
        const e = estimateExisting(state, ci, r, x.cls === 'c' ? { fareC: next } : x.cls === 'f' ? { fareF: next } : { fareK: next });
        const gain = e.profit - now;
        if (gain < 0.5) continue;
        out.push({
          key: `cls-${x.cls}-${r.id}`,
          icon: x.cls === 'k' ? '📦' : x.cls === 'f' ? '👑' : '💼',
          title: `${routeName(c, r.id)} ${x.name} 운임 ${next > x.cur ? '올리기' : '내리기'}`,
          detail: `${x.name} ${x.cls === 'k' ? '짐칸' : '좌석'}이 ${Math.round(x.lf * 100)}% 찼어요. ${next > 0 ? '+' : ''}${next}%로 바꾸면 달 이익 약 +${fmtMoney(gain)}.`,
          gain,
          label: `${x.name} ${next > 0 ? '+' : ''}${next}%`,
          apply: (s2) => afterAct(s2, ci, { type: 'setClassFare', route: r.id, cls: x.cls, fare: next }),
          weight: 150 + gain * 2,
        });
        done = true;
        break;
      }
    }
  }

  // 4⅞. 좌석 배치: 사업 손님이 많은 먼 노선에 이코노미뿐인 비행기, 관광 노선에 빈 윗등급 좌석 (풀서비스만, 한 달에 하나)
  if (c.model === 'full') {
    const year = yearOf(state.q);
    const cands = c.planes.filter((p) => p.legs.length === 1 && p.refit !== state.t && !isFreighter(MODEL[p.model]) && MODEL[p.model].body !== 'sst').slice(0, 24);
    let best: { p: (typeof cands)[number]; preset: CabinPreset; gain: number } | null = null;
    for (const p of cands) {
      const m = MODEL[p.model];
      const r = routeById(c, p.legs[0].route);
      if (!r || !r.stats) continue;
      const cab = cabinOf(p);
      const cur = presetOf(m, cab, year);
      const premEmpty = r.stats.cls && r.stats.cls.seats[0] + r.stats.cls.seats[1] > 0 && (r.stats.cls.pax[0] + r.stats.cls.pax[1]) / (r.stats.cls.seats[0] + r.stats.cls.seats[1]) < 0.4;
      const ecoOnly = cab.f + cab.c === 0;
      const options: CabinPreset[] = premEmpty ? ['eco'] : ecoOnly && dist(r.a, r.b) > 2500 ? ['two', 'three'] : cur === 'two' && dist(r.a, r.b) > 7000 && m.seats >= 250 ? ['three'] : [];
      for (const preset of options) {
        if (presetBlocker(m, preset, year, c.model)) continue;
        const now = estimateExisting(state, ci, r).profit;
        const planes = draftsOf(state, c, r.id).map((d, i) => (c.planes.filter((x) => legFreq(x, r.id) > 0)[i]?.id === p.id ? { ...d, cabin: presetCabin(m, preset, year) } : d));
        const gain = estimateExisting(state, ci, r, { planes }).profit - now;
        // 한 달 쉬는 값과 바꾸는 값을 1년이면 되찾을 만큼
        if (gain * 12 > refitCost(m) + Math.max(0, now) + 6 && (!best || gain > best.gain)) best = { p, preset, gain };
      }
    }
    if (best) {
      const m = MODEL[best.p.model];
      out.push({
        key: `cabin-${best.p.id}`,
        icon: '💺',
        title: `${m.name} 좌석을 ‘${PRESET_INFO[best.preset].name}’으로`,
        detail: `${routeName(c, best.p.legs[0].route)} 손님에 더 맞는 배치예요. 바꾸는 데 ${fmtMoney(refitCost(m))}이 들고 이번 달은 쉬지만, 그 뒤로 달 이익이 약 +${fmtMoney(best.gain)} 늘어요.`,
        gain: best.gain,
        label: '좌석 바꾸기',
        apply: (s2) => afterAct(s2, ci, { type: 'setCabin', plane: best!.p.id, preset: best!.preset }),
        weight: 120 + best.gain * 2,
      });
    }
  }

  // 4⁹⁄₁₀. 짐칸이 꽉 찬 무역 노선에는 화물기 (풀서비스·화물 전문)
  if (c.model !== 'lcc' && yearOf(state.q) >= 1965) {
    const busy = [...c.routes].filter((r) => r.stats?.cargo && r.stats.cargo.cap > 0 && r.stats.cargo.t / r.stats.cargo.cap > 0.95).sort((x, y) => (y.stats!.cargo!.rev ?? 0) - (x.stats!.cargo!.rev ?? 0))[0];
    if (busy) {
      const before = estimateExisting(state, ci, busy).profit;
      const d = dist(busy.a, busy.b);
      const year = yearOf(state.q);
      let pick: { model: string; freq: number; gain: number } | null = null;
      for (const m of availableModels(year)) {
        if (!isFreighter(m) || m.range < d || airportClass(CITY[busy.a], year) < m.runway || airportClass(CITY[busy.b], year) < m.runway) continue;
        if (buyBlocker(state, ci, m.id, true)) continue;
        for (const freq of [2, 4]) {
          if (freq > maxFreq(m, d)) continue;
          const pl = planner(state, ci);
          const gain = estimateExisting(state, ci, busy, { planes: pl.draftOf(busy.id, null, 0, { model: m.id, freq, fixed: newLeaseFixed(state, m) }) }).profit - before;
          if (!pick || gain > pick.gain) pick = { model: m.id, freq, gain };
        }
      }
      if (pick && pick.gain > 2) {
        const pk = pick;
        out.push({
          key: `freighter-${busy.id}`,
          icon: '📦',
          title: `${routeName(c, busy.id)}에 ${MODEL[pk.model].name} 화물기`,
          detail: `짐칸이 꽉 차서 화물을 놓치고 있어요. ${MODEL[pk.model].name}(${MODEL[pk.model].cargo}톤)를 리스해 주 ${pk.freq}회 띄우면 달 이익 약 +${fmtMoney(pk.gain)}.`,
          gain: pk.gain,
          label: '화물기 리스',
          apply: (s2) => leaseAndAssign(s2, ci, pk.model, busy.id, pk.freq),
          weight: 160 + pk.gain * 2,
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

  // 6. 새 노선 (노선 수 한도에 닿으면 가장 못한 노선과 바꾸기)
  if (c.routes.length > 0 && c.planes.length > 0) {
    const cand = suggestRoutes(state, ci, 1)[0];
    const reserve = Math.max(60, (state.report?.companies[ci]?.ticket ?? 0) * 0.45);
    const full = c.routes.length >= MAX_ROUTES;
    const worst = full
      ? [...c.routes].filter((r) => r.stats && state.t - r.since >= 6).sort((x, y) => (x.stats?.profit ?? 0) - (y.stats?.profit ?? 0))[0]
      : undefined;
    if (full && cand && worst && cand.profit > (worst.stats?.profit ?? 0) + 4 && c.cash - cand.capital > reserve) {
      const freed = c.planes.find((p) => p.legs.length === 1 && p.legs[0].route === worst.id && MODEL[p.model].range >= dist(cand.a, cand.b));
      out.push({
        key: `swaproute-${cand.a}-${cand.b}`,
        icon: '🔀',
        title: `노선 바꾸기: ${routeName(c, worst.id)} → ${cityName(cand.a)}–${cityName(cand.b)}`,
        detail: `노선은 ${MAX_ROUTES}개까지예요. 지난달 ${fmtMoney(worst.stats?.profit ?? 0)}를 번 ${routeName(c, worst.id)}를 닫고 ${cityName(cand.a)}–${cityName(cand.b)}를 열면 달 이익 약 ${fmtMoney(cand.profit)} 어림${freed ? ` (그 노선의 ${MODEL[freed.model].name}를 옮겨요)` : ''}.`,
        gain: cand.profit - (worst.stats?.profit ?? 0),
        label: '노선 바꾸기',
        apply: (s2) => {
          const closed = applyAction(s2, { type: 'closeRoute', route: worst.id });
          if (closed === s2) return s2;
          const opened = openSuggestion(closed, ci, cand, freed ? freed.id : 'lease');
          return opened === closed ? s2 : opened;
        },
        weight: 130 + cand.profit - (worst.stats?.profit ?? 0),
      });
    } else if (!full && cand && cand.profit > 3 && c.cash - cand.capital > reserve) {
      // 시간이 많이 남는 내 비행기가 있으면 그 비행기로, 같은 기종 중고가 있고 돈이 넉넉하면 중고로, 아니면 리스로
      const d = dist(cand.a, cand.b);
      const year = yearOf(state.q);
      const own = c.planes
        .map((p) => ({ p, m: MODEL[p.model], spare: WEEK_HOURS - planeHours(c, p) }))
        .filter((x) => x.m.range >= d && airportClass(CITY[cand.a], year) >= x.m.runway && airportClass(CITY[cand.b], year) >= x.m.runway && x.spare >= 2 * (d / x.m.speed + 0.75) * Math.min(cand.freq, 5))
        .sort((x, y) => y.spare - x.spare)[0];
      const used = state.market.find((u) => u.model === cand.model.id && u.age <= 14);
      const useUsed = !own && used && c.cash - used.price > reserve * 2.5 && !usedBlocker(state, ci, used.id);
      const how: 'lease' | 'used' | number = own ? own.p.id : useUsed ? 'used' : 'lease';
      const howText = own ? `남는 시간이 있는 ${own.m.name}로` : useUsed ? `${cand.model.name} 중고(${fmtMoney(used!.price)})로` : `${cand.model.name} 리스로`;
      out.push({
        key: `route-${cand.a}-${cand.b}`,
        icon: '🗺️',
        title: `새 노선: ${cityName(cand.a)}–${cityName(cand.b)}`,
        detail: `${howText} 주 ${cand.freq}회쯤, 달 이익 약 ${fmtMoney(cand.profit)} 어림${cand.needBranch.length ? ` (지점 ${cand.needBranch.map(cityName).join('·')} 함께)` : ''}.`,
        gain: cand.profit,
        label: '노선 열기',
        apply: (s2) => {
          const next = openSuggestion(s2, ci, cand, how);
          return next === s2 && how !== 'lease' ? openSuggestion(s2, ci, cand, 'lease') : next;
        },
        weight: 150 + cand.profit,
      });
    }
  }

  // 6¼. 직원: 모자라거나 곧 모자랄 그룹은 미리 뽑기, 만족도가 낮으면 임금
  const need = staffNeed(state, c);
  const cap = staffCap(need, c);
  const flyingN = Math.max(1, c.planes.filter((p) => p.legs.length > 0).length);
  {
    const hires: { g: (typeof STAFF_GROUPS)[number]; n: number; fast: boolean }[] = [];
    let urgent = false;
    for (const g of STAFF_GROUPS) {
      const st = c.staff[g];
      const supply = st.have + staffPipe(c, g);
      const lead = hireTime(c, g, false);
      const perPlane = c.planes.length > 0 ? need[g] / flyingN : { pilot: 11, cabin: 20, tech: 6, ground: 4 }[g];
      const buffer = { pilot: 0.15, cabin: 0.1, tech: 0.08, ground: 0.05 }[g];
      const dueSoon = c.orders.filter((o) => o.due <= state.t + lead).length;
      const target = Math.ceil(need[g] * (1 + buffer) + perPlane * (lead / 3 + dueSoon) + (g === 'pilot' ? 2 : 0));
      // 조금 모자란 것은 기다렸다가 한꺼번에 (자주 누르지 않게)
      if (need[g] <= 0 || supply >= target * 0.92) continue;
      const short = st.have < need[g];
      if (short && (g === 'pilot' || g === 'cabin')) urgent = true;
      hires.push({ g, n: Math.min(400, Math.ceil(target * 1.05) - supply), fast: short && STAFF_INFO[g].fast < STAFF_INFO[g].hire });
    }
    if (hires.length > 0) {
      const cost = hires.reduce((sum, h) => sum + hireCost(state, c, h.g, h.n, h.fast), 0);
      const months = Math.max(...hires.map((h) => hireTime(c, h.g, h.fast)));
      out.push({
        key: 'hire',
        icon: '👥',
        title: `직원 뽑기: ${hires.map((h) => `${STAFF_INFO[h.g].name} ${h.n}명`).join(' · ')}`,
        detail: `${urgent ? (cap < 1 ? '일손이 모자라 결항이 나고 있어요. ' : '초과 근무로 버티는 중이에요. ') : '앞으로 늘 비행기 몫까지 미리 뽑아 두면 좋아요. '}길게는 ${months}달 걸리고 모두 ${fmtFine(cost)} 들어요.`,
        label: '모두 뽑기',
        apply: (s2) => {
          const pl = planner(s2, ci);
          for (const h of hires) pl.act({ type: 'hire', group: h.g, n: h.n, fast: h.fast });
          return pl.s;
        },
        weight: urgent ? (cap < 1 ? 700 : 420) : 210,
      });
    }
  }
  if (c.morale < 45) {
    out.push({
      key: 'pay',
      icon: '💸',
      title: '조종사·승무원 임금 올리기',
      detail: `조직 만족도가 ${Math.round(c.morale)}이에요. 낮으면 지연이 늘고 서비스가 덜 친절해지고, 30 아래로 떨어지면 파업이 날 수 있어요. 임금 수준을 5% 올려 보세요.`,
      label: '임금 +5%',
      apply: (s2) => {
        const pl = planner(s2, ci);
        for (const g of ['pilot', 'cabin'] as const) pl.act({ type: 'setPay', group: g, level: Math.min(1.3, Math.round((pl.c.staff[g].pay + 0.05) * 100) / 100) });
        return pl.s;
      },
      weight: c.morale < 32 ? 600 : 230,
    });
  }
  if (!c.academy && c.planes.length >= 14 && c.cash > ACADEMY_COST * 2.5) {
    out.push({ key: 'academy', icon: '🎓', title: '우리 훈련원 세우기', detail: `${fmtMoney(ACADEMY_COST)}으로 세우면 조종사를 3달(보통 5달) 만에 키우고 뽑는 돈이 40% 줄어요. 조직 만족도도 조금 올라요.`, label: '세우기', apply: (s2) => afterAct(s2, ci, { type: 'buildAcademy' }), weight: 95 });
  }

  // 6⅓. 시간표: 손님이 좋아하는 시간대로 (큰 노선 몇 개만)
  const bigRoutes = [...c.routes].filter((r) => r.stats && r.stats.revenue > 0).sort((x, y) => (y.stats?.revenue ?? 0) - (x.stats?.revenue ?? 0)).slice(0, 4);
  for (const r of bigRoutes) {
    const b = bestTimes(state, ci, r.id);
    if (!b || b.gain < 0.8) continue;
    out.push({
      key: `times-${r.id}`,
      icon: '🕘',
      title: `${routeName(c, r.id)} 시간대 바꾸기`,
      detail: `아침 ${b.times[0]} · 낮 ${b.times[1]} · 저녁 ${b.times[2]} · 밤 ${b.times[3]} 비율로 나누면 손님이 좋아하는 때에 떠서 달 이익 약 +${fmtMoney(b.gain)}.`,
      gain: b.gain,
      label: '시간대 바꾸기',
      apply: (s2) => afterAct(s2, ci, { type: 'setTimes', route: r.id, times: b.times }),
      weight: 140 + b.gain,
    });
    break;
  }

  // 6½. 운항 현장: 지연·결항이 잦으면 정비와 예비기
  const repM = state.report?.companies[ci];
  if (repM && repM.flights > 0) {
    const cancelRate = repM.cancelled / repM.flights;
    // 날씨 한 달로 흔들리지 않게 최근 석 달로 본다
    const recent = state.ledger.slice(-3).map((l) => l.companies[ci]).filter((x) => x && x.flights > 0);
    const cancel3 = recent.reduce((a, x) => a + x.cancelled, 0) / Math.max(1, recent.reduce((a, x) => a + x.flights, 0));
    if (c.maint >= 4 && c.onTime > 0.9 && cancel3 < 0.015) {
      const next = c.maint - 1;
      const save = repM.crew * (1 - MAINT_COST[next] / MAINT_COST[c.maint]);
      if (save > 1) {
        out.push({
          key: 'maintdown',
          icon: '🔧',
          title: `정비 수준을 ‘${MAINT_NAMES[next]}’로 낮추기`,
          detail: `최근 정시 운항률 ${Math.round(c.onTime * 100)}%, 결항 ${(cancel3 * 100).toFixed(1)}%로 안정됐어요. 한 단계 낮추면 승무원·정비비가 달 약 ${fmtMoney(save)} 줄어요.`,
          gain: save,
          label: '정비 낮추기',
          apply: (s) => afterAct(s, ci, { type: 'setMaint', level: next }),
          weight: 120 + save,
        });
      }
    }
    if ((c.onTime < 0.8 || cancel3 > 0.03) && c.maint < 5) {
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

  // 6¾. 돈이 넉넉하면 많이 리스한 기종을 주문해 두기 (도착하면 리스기를 돌려줘 리스료를 아낀다)
  {
    const leased = c.planes.filter((p) => p.leased);
    const rep2 = state.report?.companies[ci];
    const costs = rep2 ? rep2.fuel + rep2.crew + rep2.airport + rep2.service + rep2.sales + rep2.lease + rep2.fleet + rep2.branch + rep2.ads + rep2.interest + rep2.staff : 0;
    if (leased.length >= 2 && c.orders.length < 3) {
      const count = new Map<string, number>();
      for (const p of leased) count.set(p.model, (count.get(p.model) ?? 0) + 1);
      const [model] = [...count.entries()].sort((x, y) => y[1] - x[1])[0];
      const m = MODEL[model];
      const price = orderPrice(state, m, c);
      const lead = leadTime(m, yearOf(state.q));
      if (lead <= 9 && c.cash - price > costs * 3 + 200 && !buyBlocker(state, ci, model, false)) {
        out.push({
          key: `order-${model}`,
          icon: '🛒',
          title: `${m.name} 한 대 주문해 두기`,
          detail: `리스기 ${count.get(model)}대가 달마다 리스료를 내고 있어요. ${fmtMoney(price)}에 주문하면 ${lead}달 뒤에 와요. 오면 리스기 하나를 돌려주면 리스료(달 ${fmtMoney(leased.find((p) => p.model === model)!.rent)})를 아껴요.`,
          label: '주문하기',
          apply: (s2) => afterAct(s2, ci, { type: 'buy', model }),
          weight: 170,
        });
      }
    }
    // 주문한 비행기가 와서 쉬고 있으면 같은 계열 리스기 노선을 넘겨받게
    const idleOwn = idlePlanes(c).find((p) => !p.leased);
    if (idleOwn) {
      const lease = c.planes.find((x) => x.leased && x.legs.length > 0 && MODEL[x.model].family === MODEL[idleOwn.model].family);
      if (lease) {
        out.push({
          key: `swap-${idleOwn.id}`,
          icon: '🔁',
          title: `새 ${MODEL[idleOwn.model].name}로 리스기 바꾸기`,
          detail: `쉬는 내 비행기가 리스기 ${MODEL[lease.model].name}의 노선을 넘겨받고, 리스기는 돌려줘요 (리스료 달 ${fmtMoney(lease.rent)} 아낌).`,
          label: '바꾸기',
          apply: (s2) => {
            const pl = planner(s2, ci);
            const legs = planeById(pl.c, lease.id)?.legs.map((l) => ({ ...l })) ?? [];
            if (!pl.act({ type: 'sell', plane: lease.id })) return s2;
            for (const l of legs) {
              const f = Math.min(l.freq, bestFreq(pl.s, ci, idleOwn.id, l.route));
              if (f >= 1) pl.act({ type: 'assign', plane: idleOwn.id, route: l.route, freq: f });
            }
            return pl.s;
          },
          weight: 520,
        });
      }
    }
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
  // 손님 노선에는 여객기를, 화물기만 나는 노선에는 화물기를 (화물기 보태기는 따로 권한다)
  const cargoOnly = c.planes.some((p) => legFreq(p, r.id) > 0) && c.planes.filter((p) => legFreq(p, r.id) > 0).every((p) => isFreighter(MODEL[p.model]));
  for (const m of availableModels(year)) {
    if (isFreighter(m) !== cargoOnly) continue;
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
  const freighter = isFreighter(MODEL[p.model]);
  for (const m of availableModels(year)) {
    if (isFreighter(m) !== freighter) continue;
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
