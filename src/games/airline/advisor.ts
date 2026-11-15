import { MODEL, leadTime } from './aircraft';
import { classAdvice } from './advisorClasses';
import { planModelsFor } from './bizmodel';
import { Planner, bestTimes, suggestRoutes, openSuggestion } from './ai';
import { ACADEMY_COST, STAFF_GROUPS, STAFF_INFO, hireCost, hireTime, staffCap, staffNeed, staffPipe } from './staff';
import { weather } from './calendar';
import { CITY, REGIONS, airportClass, dist, pairKey } from './cities';
import { goalProgress } from './goals';
import { CRISIS_MONTHS, MAX_ROUTES, applyAction, assignBlocker, bestFreq, buyBlocker, checkBlocker, creditLimit, fmtFine, fmtMoney, idlePlanes, oilTarget, planeById, routeById, usedBlocker } from './rules';
import { FUEL_TON, TANK_LEVELS, tankBlocker, tankCap, tankOf, tankSpace, tonPrice } from './fuel';
import { condOf, inCheck, restoredCond } from './condition';
import { companyCheckCost, facilityBlocker, facilityCost } from './facilities';
import { charterBlocker, charterPlaneIds, charterProfit, openCharters } from './charters';
import { withJosa } from '../../lib/korean';
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
  slotCapacity,
  slotsUsed,
} from './simulate';
import { monthOf, yearOf } from './time';
import type { Candidate } from './ai';
import type { AirlineState, CharterOffer, Company, Plane } from './types';

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

function pairName(a: string, b: string): string {
  return `${cityName(a)}–${cityName(b)}`;
}

/** 쉬는 비행기를 띄울 때 쉴 때보다 이만큼(억)만 더 벌어도 권한다 (리스료·보험료는 쉬어도 나간다) */
const IDLE_MIN_GAIN = 1;
/** 새 비행기를 들여 여는 새 노선은 달 이익이 이만큼(억)은 넘어야 권한다 */
const NEW_ROUTE_MIN = 3;

/** 새 노선을 여는 권유 (경영 비서 목록에 늘 한 자리를 남겨 둔다). 권할 노선이 없을 때의 까닭 알림(noroute)도 그 자리를 쓴다 */
export function isRouteAdvice(a: Pick<Advice, 'key'>): boolean {
  return /^(first|route|swaproute|noroute)(-|$)/.test(a.key);
}

/** 적용이 안 됐을 때의 까닭 (applyAdvice가 한 번 적용하는 동안만 쓴다) */
let blocked: string | null = null;
const note = (why: string) => {
  blocked = why;
};

function planner(s: AirlineState, ci: number): Planner {
  const pl = new Planner(s, ci, 'ai-normal', () => 0.5);
  pl.onBlock = note;
  return pl;
}

/** 권유를 적용해 본다. 안 되면 상태는 그대로이고 why에 까닭이 담긴다 */
export function applyAdvice(a: Advice, s: AirlineState): { state: AirlineState; why: string | null } {
  if (!a.apply) return { state: s, why: null };
  blocked = null;
  const next = a.apply(s);
  const why = blocked;
  blocked = null;
  return next === s ? { state: s, why: why ?? '지금은 할 수 없어요' } : { state: next, why: null };
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

  // 권할 새 노선이 없을 때 그 까닭 (목록 끝에 한 줄로 알린다)
  let noRouteWhy: string | null = null;

  // 1. 첫 노선 (아직 비행기가 없을 때)
  if (c.routes.length === 0 || c.planes.length === 0) {
    const cand = suggestRoutes(state, ci, 1)[0];
    if (!cand) noRouteWhy = whyNoRoute(state, ci, undefined);
    else {
      out.push({
        key: `first-${cand.a}-${cand.b}`,
        icon: '🛫',
        title: `첫 노선: ${cityName(cand.a)}–${cityName(cand.b)}`,
        detail: `${cand.model.name}을 리스해 주 ${cand.freq}회 띄우면 달 이익 약 ${fmtMoney(cand.profit)}을 기대해요.${first && c.kind === 'human' ? ' 첫해에는 리스 보증금이 없어요.' : ''}`,
        gain: cand.profit,
        label: '노선 열기',
        apply: (s) => openSuggestion(s, ci, cand, 'lease', note),
        weight: 900,
      });
    }
  }

  // 2. 쉬는 비행기 (이번 달 전세기로 나가는 비행기는 쉬는 게 아니라 팔거나 노선에 넣을 수 없다)
  const chartered = charterPlaneIds(state, ci);
  const idle = idlePlanes(c).filter((p) => !chartered.has(p.id));
  // 쉬는 비행기마다 띄울 만한 노선은 한 번만 따진다
  const bestLegs = new Map<number, BestLeg>();
  const legOf = (id: number): BestLeg => {
    if (!bestLegs.has(id)) bestLegs.set(id, planner(state, ci).bestExistingLeg(id, false));
    return bestLegs.get(id)!;
  };
  // 비행기가 많으면 띄울 곳 없는 쉬는 내 비행기 몇 대는 예비기로 둔다 (팔거나 리스기와 바꾸지 않는다)
  const keep = spareKeep(state, c, idle, legOf);
  const keepIds = new Set(keep.map((p) => p.id));
  const free = idle.filter((p) => !keepIds.has(p.id));
  // 쉬는 내 비행기가 노선을 넘겨받을 수 있는 리스기가 있으면, 팔지 말고 리스기를 돌려주는 게 낫다 (아래 ‘리스기 바꾸기’)
  const swaps = swapPairs(state, ci, free);
  // 나머지 쉬는 비행기는 이미 있는 노선에 보태거나 새 노선을 연다. 리스료·보험료는 쉬어도 나가니
  // 쉴 때보다 1억이라도 더 벌면 띄우고, 띄울 곳이 정말 없을 때만 팔기(돌려주기)를 권한다
  const idlePairs = new Set<string>();
  {
    // 이미 다른 쉬는 비행기에게 권한 노선 (같은 노선을 두 번 권하지 않는다)
    const idleRoutes = new Set<number>();
    const wide = planner(state, ci);
    wide.wide = true;
    // 띄울 곳이 없던 기종 (같은 기종·리스 여부는 다시 찾지 않는다)
    const hopeless = new Set<string>();
    let shown = 0;
    let looked = 0;
    for (const p of free) {
      if (shown >= 2 || looked >= 4) break;
      if (swaps.some((x) => x.own === p.id)) continue;
      const kind = `${p.model}|${p.leased}`;
      if (hopeless.has(kind)) continue;
      looked++;
      const m = MODEL[p.model];
      // 둘 다 리스료·보험료를 뺀, 쉴 때보다 더 버는 돈으로 견준다
      const ex = planner(state, ci).bestExistingLeg(p.id, true);
      const nr = wide.idleCandidates(p.id, 4).find((x) => !idlePairs.has(pairKey(x.a, x.b)));
      const exTaken = ex !== null && idleRoutes.has(ex.route);
      const exGain = ex && !exTaken ? ex.gain : -Infinity;
      const nrGain = nr ? nr.profit : -Infinity;
      if (ex && !exTaken && exGain >= IDLE_MIN_GAIN && exGain >= nrGain) {
        shown++;
        idleRoutes.add(ex.route);
        out.push({
          key: `idle-${p.id}`,
          icon: '😴',
          title: `쉬는 ${m.name}를 ${routeName(c, ex.route)}에`,
          detail: `주 ${ex.freq}회 띄우면 쉴 때보다 달 이익이 약 ${fmtMoney(exGain)} 늘어요. 쉬는 비행기도 리스료·보험료가 나가요.`,
          gain: exGain,
          label: '띄우기',
          apply: (s) => afterAct(s, ci, { type: 'assign', plane: p.id, route: ex.route, freq: ex.freq }),
          weight: 500 + exGain,
        });
      } else if (nr && nrGain >= IDLE_MIN_GAIN) {
        shown++;
        idlePairs.add(pairKey(nr.a, nr.b));
        const rentNote = p.leased && p.rent > nrGain ? ` 리스기라 돌려주면 리스료(달 ${fmtMoney(p.rent)})가 안 나가니, 그쪽이 더 나을 수도 있어요.` : ' 쉬는 비행기도 리스료·보험료가 나가요.';
        out.push({
          key: `route-plane${p.id}-${nr.a}-${nr.b}`,
          icon: '🗺️',
          title: `새 노선: ${pairName(nr.a, nr.b)} (쉬는 ${m.name})`,
          detail: `쉬는 비행기를 주 ${nr.freq}회 띄우면 쉴 때보다 달 이익이 약 ${fmtMoney(nrGain)} 늘어요${nr.needBranch.length ? ` (지점 ${nr.needBranch.map(cityName).join('·')} 함께)` : ''}.${rentNote}`,
          gain: nrGain,
          label: '노선 열기',
          apply: (s) => openSuggestion(s, ci, nr, p.id, note),
          weight: 500 + nrGain,
        });
      } else if (exTaken && ex.gain >= IDLE_MIN_GAIN) {
        // 띄울 곳은 있는데 앞의 비행기에게 이미 권했다: 그 권유를 먼저 해 보면 된다
        continue;
      } else {
        shown++;
        hopeless.add(kind);
        out.push({
          key: `idle-sell-${p.id}`,
          icon: '😴',
          title: `쉬는 ${m.name} ${p.leased ? '돌려주기' : '팔기'}`,
          detail: `이미 있는 노선에도, 새 노선에도 띄워서 달 ${fmtMoney(IDLE_MIN_GAIN)}이 남는 곳이 없어요. ${p.leased ? '돌려주면 리스료가 나가지 않아요 (위약금 한 달 치).' : '팔면 현금이 생겨요.'}`,
          label: p.leased ? '돌려주기' : '팔기',
          apply: (s) => afterAct(s, ci, { type: 'sell', plane: p.id }),
          weight: 300,
        });
      }
    }
  }
  if (keep.length > 0) {
    const flyingNow = c.planes.filter((p) => p.legs.length > 0).length;
    const one = MODEL[keep[0].model].name;
    out.push({
      key: 'keepspare',
      icon: '🛟',
      title: keep.length === 1 ? `쉬는 ${withJosa(one, '은/는')} 예비기로 두기` : `쉬는 비행기 ${keep.length}대는 예비기로 두기`,
      detail: `비행기가 ${flyingNow}대 날고 있어요. 띄울 노선이 마땅치 않은 ${withJosa(keep.map((p) => MODEL[p.model].name).join('·'), '은/는')} 팔거나 리스기와 바꾸지 말고 예비기로 두세요. 기체 점검이나 고장으로 빠진 비행기 대신 날고, 결항이 줄어요.`,
      weight: 200,
    });
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
        detail: `좌석이 꽉 찼어요. ${MODEL[p.model].name}(${MODEL[p.model].seats}석)${p.leased ? '를 돌려주고' : '를 팔고'} 더 큰 ${MODEL[rep.model].name}(${MODEL[rep.model].seats}석)를 리스해 띄우면 달 이익 약 +${fmtMoney(rep.gain)}.`,
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
    if (!idleOwnOf(c, m.id, keepIds) && lead <= 12 && waiting < 2 + Math.floor(c.planes.length / 8) && c.cash - price > costs * 2 + 150 && !buyBlocker(state, ci, m.id, false)) {
      out.push({
        key: `orderfull-${m.id}`,
        icon: '🛒',
        title: `${m.name} 주문해서 ${routeName(c, f.route)}에 보태기`,
        detail: `좌석이 꽉 찬 노선이 ${fullRoutes.length}개예요. 리스로는 남는 게 적지만, ${fmtMoney(price)}에 주문하면 ${lead}달 뒤에 와서 리스료 없이 손님을 더 태워요.${spareNote(keep, m.id)}`,
        label: '주문하기',
        apply: (s2) => afterAct(s2, ci, { type: 'buy', model: m.id }),
        weight: 180 + f.gain * 4,
      });
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
  // 후보는 모든 지점에서 찾는다 (suggestRoutes). 쉬는 비행기로 이미 권한 노선은 빼고
  if (c.routes.length > 0 && c.planes.length > 0) {
    const cand = suggestRoutes(state, ci, 3).find((x) => !idlePairs.has(pairKey(x.a, x.b)));
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
          const opened = openSuggestion(closed, ci, cand, freed ? freed.id : 'lease', note);
          return opened === closed ? s2 : opened;
        },
        weight: 130 + cand.profit - (worst.stats?.profit ?? 0),
      });
    } else if (!full && cand && cand.profit > NEW_ROUTE_MIN && c.cash - cand.capital > reserve) {
      // 시간이 많이 남는 내 비행기가 있으면 그 비행기로, 같은 기종 중고가 있고 돈이 넉넉하면 중고로, 아니면 리스로
      // (이번 달 전세기로 나가는 비행기는 노선에 넣을 수 없다)
      const d = dist(cand.a, cand.b);
      const year = yearOf(state.q);
      const own = c.planes
        .filter((p) => !chartered.has(p.id))
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
          const next = openSuggestion(s2, ci, cand, how, note);
          return next === s2 && how !== 'lease' ? openSuggestion(s2, ci, cand, 'lease', note) : next;
        },
        weight: 150 + cand.profit,
      });
    } else noRouteWhy = whyNoRoute(state, ci, cand, { full, reserve });
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
  //      같은 계열의 쉬는 내 비행기가 있으면 주문보다 그 비행기로 리스기를 바꾸는 게 먼저다 (예비기로 둔 비행기는 빼고)
  {
    const leased = c.planes.filter((p) => p.leased);
    const rep2 = state.report?.companies[ci];
    const costs = rep2 ? rep2.fuel + rep2.crew + rep2.airport + rep2.service + rep2.sales + rep2.lease + rep2.fleet + rep2.branch + rep2.ads + rep2.interest + rep2.staff : 0;
    if (leased.length >= 2 && c.orders.length < 3) {
      const count = new Map<string, number>();
      for (const p of leased) count.set(p.model, (count.get(p.model) ?? 0) + 1);
      const top = [...count.entries()].filter(([model]) => !idleOwnOf(c, model, keepIds)).sort((x, y) => y[1] - x[1])[0];
      const model = top?.[0];
      const m = model ? MODEL[model] : undefined;
      const price = m ? orderPrice(state, m, c) : 0;
      const lead = m ? leadTime(m, yearOf(state.q)) : 99;
      if (model && m && lead <= 9 && c.cash - price > costs * 3 + 200 && !buyBlocker(state, ci, model, false)) {
        out.push({
          key: `order-${model}`,
          icon: '🛒',
          title: `${m.name} 한 대 주문해 두기`,
          detail: `리스기 ${count.get(model)}대가 달마다 리스료를 내고 있어요. ${fmtMoney(price)}에 주문하면 ${lead}달 뒤에 와요. 오면 리스기 하나를 돌려주면 리스료(달 ${fmtMoney(leased.find((p) => p.model === model)!.rent)})를 아껴요.${spareNote(keep, model)}`,
          label: '주문하기',
          apply: (s2) => afterAct(s2, ci, { type: 'buy', model }),
          weight: 170,
        });
      }
    }
    // 쉬는 내 비행기(주문해서 막 온 비행기 포함)가 리스기 노선을 넘겨받고, 리스기는 돌려준다
    if (swaps.length > 0) {
      const own = planeById(c, swaps[0].own)!;
      const lease = planeById(c, swaps[0].lease)!;
      const n = swaps.length;
      const rent = swaps.reduce((sum, x) => sum + (planeById(c, x.lease)?.rent ?? 0), 0);
      const fresh = state.t - (own.got ?? own.since) <= 1;
      out.push({
        key: `swap-${own.id}`,
        icon: '🔁',
        title:
          n === 1
            ? `${fresh ? '새' : '쉬는'} ${withJosa(MODEL[own.model].name, '으로/로')} 리스기 바꾸기`
            : `쉬는 내 비행기 ${n}대로 리스기 ${n}대 바꾸기`,
        detail:
          n === 1
            ? `쉬는 내 ${withJosa(MODEL[own.model].name, '이/가')} 리스기 ${MODEL[lease.model].name}의 노선을 넘겨받고, 리스기는 돌려줘요. 리스료를 달 ${fmtMoney(rent)} 아껴요 (돌려줄 때 위약금 한 달 치). 쉬게 두거나 파는 것보다 나아요.`
            : `쉬는 내 비행기 ${n}대가 같은 계열 리스기의 노선을 넘겨받고, 리스기는 돌려줘요. 리스료를 달 ${fmtMoney(rent)} 아껴요 (돌려줄 때 위약금 한 달 치). 쉬게 두거나 파는 것보다 나아요.`,
        gain: rent,
        label: '바꾸기',
        apply: (s2) => {
          let next = s2;
          for (const x of swaps) next = swapLease(next, ci, x.own, x.lease) ?? next;
          if (next === s2 && !blocked) note('리스기의 노선을 다 넘겨받을 수 없어요');
          return next;
        },
        weight: 520 + rent,
      });
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

  // 7-9. 전세기: 쉬는 비행기로 남는 의뢰가 있으면
  {
    let best: { offer: CharterOffer; plane: number; profit: number } | null = null;
    for (const o of openCharters(state)) {
      for (const p of c.planes) {
        if (p.legs.length > 0 || charterBlocker(state, ci, o.id, p.id)) continue;
        const profit = charterProfit(state, ci, o, p);
        if (profit > 1 && (!best || profit > best.profit)) best = { offer: o, plane: p.id, profit };
      }
    }
    if (best) {
      const o = best.offer;
      const plane = best.plane;
      out.push({
        key: `charter-${o.id}`,
        icon: o.icon,
        title: `전세기: ${o.title} ${cityName(o.a)}⇄${cityName(o.b)} ${o.pax}명`,
        detail: `쉬는 ${MODEL[c.planes.find((p) => p.id === plane)!.model].name}로 이번 달 다녀오면 보수 ${fmtMoney(o.pay)}에 이익 약 ${fmtMoney(best.profit)}이에요. 그달은 예비기가 하나 줄어요.`,
        gain: best.profit,
        label: '맡기',
        apply: (s2) => afterAct(s2, ci, { type: 'charter', offer: o.id, plane }),
        weight: 150 + best.profit * 2,
      });
    }
  }

  // 8-0. 기체 상태: 아주 닳은 비행기는 점검 시점과 상관없이 점검을 권한다
  const worn = c.planes.filter((p) => p.legs.length > 0 && !inCheck(p, state.t) && condOf(p) < 28).sort((a, b) => condOf(a) - condOf(b))[0];
  if (worn && !checkBlocker(state, ci, worn.id)) {
    out.push({
      key: `check-${worn.id}`,
      icon: '🔧',
      title: `${MODEL[worn.model].name} 기체 상태 ${Math.round(condOf(worn))}%: C점검 보내기`,
      detail: `많이 닳아 고장·지연·결항이 잦아요. 이번 달 정비고에 넣으면 약 ${fmtMoney(companyCheckCost(c, worn))}이 들고 그달은 쉬지만${spareCover(c) > 0 ? ' (예비기가 대신 날아요)' : ''}, 상태가 ${restoredCond(planeAge(state, worn))}%로 돌아와요.`,
      label: 'C점검',
      apply: (s2) => afterAct(s2, ci, { type: 'checkPlane', plane: worn.id, on: true }),
      weight: 165,
    });
  }

  // 8-0-1. 공항 시설: 본사 슬롯이 거의 찼으면 전용 터미널, 아니면 자리 잡은 회사에 본사 라운지
  {
    const used = slotsUsed(c, c.hub);
    const cap = slotCapacity(state, ci, c.hub);
    const hubName = cityName(c.hub);
    if (used >= cap * 0.9 && !facilityBlocker(state, ci, c.hub, 'terminal') && c.cash > facilityCost(c.hub, 'terminal', state.q) * 2) {
      out.push({
        key: 'terminal',
        icon: '🏛️',
        title: `${hubName} 슬롯이 거의 찼어요: 전용 터미널 짓기`,
        detail: `본사 슬롯을 ${used}/${cap}회 쓰고 있어요. ${fmtMoney(facilityCost(c.hub, 'terminal', state.q))}으로 전용 터미널을 지으면 슬롯이 25% 늘고, 붐빔으로 생기는 지연이 줄고, 갈아타는 손님이 늘어요.`,
        label: '터미널 짓기',
        apply: (s2) => afterAct(s2, ci, { type: 'buildFacility', city: c.hub, kind: 'terminal' }),
        weight: 175,
      });
    } else if (c.planes.length >= 6 && !facilityBlocker(state, ci, c.hub, 'lounge') && c.cash > facilityCost(c.hub, 'lounge', state.q) * 6 && CITY[c.hub].biz >= 0.4) {
      out.push({
        key: 'lounge',
        icon: '🛋️',
        title: `${hubName}에 라운지 짓기`,
        detail: `${fmtMoney(facilityCost(c.hub, 'lounge', state.q))}으로 본사 라운지를 지으면 본사를 오가는 사업 손님이 6%, 본사에서 갈아타는 사업 손님이 10% 늘고 평판이 조금 올라요.`,
        label: '라운지 짓기',
        apply: (s2) => afterAct(s2, ci, { type: 'buildFacility', city: c.hub, kind: 'lounge' }),
        weight: 100,
      });
    }
  }

  // 8-1. 연료 탱크: 연료를 많이 쓰면 탱크를, 탱크가 있고 유가가 싸면 채우기를
  const fuelRep = state.report?.companies[ci];
  const tons = fuelRep?.fuelTons ?? 0;
  if (fuelRep && tons > 0 && fuelRep.fuel >= 15) {
    const tank = tankOf(c);
    const aim = oilTarget(state);
    const first = TANK_LEVELS[1];
    if (tank.level === 0 && !tankBlocker(state, ci) && c.cash > first.cost * 4 + 50) {
      out.push({
        key: 'tank',
        icon: '⛽',
        title: '연료 탱크 짓기',
        detail: `지난달 연료비가 ${fmtMoney(fuelRep.fuel)}였어요. ${first.name}(${first.cap.toLocaleString('ko-KR')}톤, ${fmtMoney(first.cost)})를 지으면 유가가 쌀 때 사 두었다가 비쌀 때 써요.`,
        label: '탱크 짓기',
        apply: (s2) => afterAct(s2, ci, { type: 'buildTank' }),
        weight: 110,
      });
    } else if (tank.level > 0 && state.oil <= aim * 0.95 && tankSpace(c) >= Math.min(tankCap(c) * 0.3, tons * 0.5)) {
      const buy = Math.floor(Math.min(tankSpace(c), (c.cash - 50) / tonPrice(state.oil)));
      if (buy >= 1) {
        const save = (aim - state.oil) * FUEL_TON * buy;
        out.push({
          key: 'fuelbuy',
          icon: '⛽',
          title: `유가가 보통보다 ${Math.round((1 - state.oil / aim) * 100)}% 싸요: 연료 채우기`,
          detail: `지금 ${buy.toLocaleString('ko-KR')}톤(${fmtFine(buy * tonPrice(state.oil))})을 사 두면 보통 값에 견주어 약 ${fmtFine(save)}을 아껴요.`,
          gain: save,
          label: '채우기',
          apply: (s2) => afterAct(s2, ci, { type: 'buyFuel', tons: buy }),
          weight: 120 + save,
        });
      }
    }
  }

  // 9. 연간 목표 알림 (11·12월)
  if (monthOf(state.t) >= 11) {
    const g = c.goals.find((x) => x.done === null && goalProgress(state, ci, x) < 1 && goalProgress(state, ci, x) > 0.5);
    if (g) out.push({ key: `goal-${g.kind}`, icon: '🎯', title: `올해 목표가 눈앞이에요: ${g.text}`, detail: `지금 ${Math.round(goalProgress(state, ci, g) * 100)}%. 이루면 ${fmtMoney(g.reward.cash)}과 평판 +${g.reward.rep}.`, weight: 90 });
  }

  // 10. 등급별 운임·화물 운임·사업 모델 (advisorClasses.ts)
  out.push(...classAdvice(state, ci));

  // 할 일이 별로 없으면: 자동 진행 안내
  if (c.routes.length >= 3 && !c.choice && out.filter((a) => a.apply).length <= 1) {
    out.push({ key: 'auto', icon: '⏩', title: '한동안 맡겨 두기', detail: '지금은 크게 고칠 곳이 없어요. ‘결정할 일이 생길 때까지 자동 진행’을 누르면 결정할 일·큰 사건·돈 걱정·라이벌 소식이 생길 때까지 달을 넘겨요.', label: '자동 진행', weight: 30 });
  }

  // 새 노선을 하나도 권하지 못했으면 왜 그런지 한 줄로 알린다
  if (noRouteWhy && !out.some(isRouteAdvice)) {
    out.push({ key: 'noroute', icon: '🗺️', title: '지금은 권할 새 노선이 없어요', detail: noRouteWhy, weight: 20 });
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
  // 새 노선 권유(또는 권할 노선이 없는 까닭)는 다른 권유에 밀려나지 않게 한 자리를 남겨 둔다
  if (!picked.some(isRouteAdvice)) {
    const route = out.find((a) => isRouteAdvice(a) && !seen.has(a.title));
    if (route) {
      if (picked.length >= max) {
        // 가장 가벼운 권유를 내린다 (결정할 일은 남긴다)
        for (let i = picked.length - 1; i >= 0; i--) {
          if (picked[i].key === 'choice') continue;
          picked.splice(i, 1);
          break;
        }
      }
      if (picked.length < max) picked.push(route);
    }
  }
  return picked;
}

/** 새 노선을 권하지 못한 까닭 (경영 비서 목록에 한 줄로 보여 준다) */
function whyNoRoute(state: AirlineState, ci: number, cand: Candidate | undefined, opts: { full?: boolean; reserve?: number } = {}): string {
  const c = state.companies[ci];
  const later = '도시와 공항은 해마다 커지고 새 기종도 나오니, 그때 다시 찾아 드릴게요. 지도에서 도시를 눌러 직접 살펴볼 수도 있어요.';
  if (opts.full) return `노선이 ${MAX_ROUTES}개로 꽉 찼고, 지금 노선을 닫고 바꿀 만큼 나은 새 노선이 없어요.`;
  if (cand && cand.profit > NEW_ROUTE_MIN && opts.reserve !== undefined) {
    return `${pairName(cand.a, cand.b)} 노선은 달 약 ${fmtMoney(cand.profit)}을 벌 만하지만, 지점·보증금으로 ${fmtMoney(cand.capital)}을 쓰면 남겨 둘 돈(${fmtMoney(opts.reserve)})보다 현금이 적어져요.`;
  }
  if (cand) return `가장 나은 후보인 ${pairName(cand.a, cand.b)} 노선도 비행기를 새로 리스해 띄우면 달 약 ${fmtMoney(cand.profit)}밖에 남지 않아요. 남은 도시는 아직 손님이 적거나, 공항이 작아 띄울 수 있는 기종이 닿지 않아요. ${later}`;
  const open = c.branches.filter((b) => slotCapacity(state, ci, b) - slotsUsed(c, b) >= 2).length;
  if (c.branches.length > 0 && open === 0) return `지점 공항의 슬롯이 모두 찼어요. 본사에 전용 터미널을 짓거나 손님이 적은 노선의 횟수를 줄이면 자리가 생겨요.`;
  return `남은 도시는 아직 손님이 적거나, 공항이 작아 띄울 수 있는 기종이 닿지 않아요. ${later}`;
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

type BestLeg = ReturnType<Planner['bestExistingLeg']>;

/** 이만큼 날고 있으면 쉬는 비행기를 예비기로 둘 만하다 (예비기 권유와 같은 기준) */
const SPARE_FLEET = 12;

/**
 * 예비기로 둘 쉬는 내 비행기. 날고 있는 비행기가 많으면 8%쯤(적어도 한 대)을 둔다 (spareCover가 그만큼에서 다 찬다).
 * 띄울 만한 노선이 있는 비행기는 띄우는 게 나으니 빼고, 젊은 비행기부터 고른다. 점검 중인 비행기는 예비기가 못 된다.
 */
function spareKeep(state: AirlineState, c: Company, idle: Plane[], legOf: (id: number) => BestLeg): Plane[] {
  const flying = c.planes.filter((p) => p.legs.length > 0).length;
  if (flying < SPARE_FLEET) return [];
  const need = Math.max(1, Math.round(flying * 0.08));
  const cands = idle
    .filter((p) => !p.leased && !inCheck(p, state.t))
    .sort((x, y) => planeAge(state, x) - planeAge(state, y))
    .slice(0, need + 3);
  const out: Plane[] = [];
  for (const p of cands) {
    if (out.length >= need) break;
    const best = legOf(p.id);
    if (best && best.gain > 0) continue;
    out.push(p);
  }
  return out;
}

/** 주문 권유에 붙이는 말: 같은 계열 예비기는 그대로 둔다 */
function spareNote(keep: Plane[], model: string): string {
  const sp = keep.find((p) => MODEL[p.model].family === MODEL[model].family);
  return sp ? ` 쉬는 ${withJosa(MODEL[sp.model].name, '은/는')} 예비기로 그대로 둬요.` : '';
}

/** 이 기종과 같은 계열의 쉬는 내 비행기가 있는지 (전세기로 나간 비행기도: 다음 달엔 쉰다). skip: 예비기로 둔 비행기 */
function idleOwnOf(c: Company, model: string, skip: ReadonlySet<number>): boolean {
  const fam = MODEL[model]?.family;
  return idlePlanes(c).some((p) => !p.leased && !skip.has(p.id) && MODEL[p.model].family === fam);
}

/**
 * 쉬는 내 비행기가 노선을 넘겨받을 리스기 짝들.
 * 같은 계열이고 좌석이 비슷한 리스기 가운데 실제로 노선을 거의 그대로(좌석×횟수 85% 넘게) 넘겨받을 수 있는 것만 고른다.
 */
function swapPairs(state: AirlineState, ci: number, idle: Plane[]): { own: number; lease: number }[] {
  const c = state.companies[ci];
  const out: { own: number; lease: number }[] = [];
  const taken = new Set<number>();
  // 큰 사건 뒤에는 쉬는 비행기가 수십 대일 수 있어, 앞의 몇 대만 따져 본다 (나머지는 바꾼 뒤 다음에)
  let budget = 6;
  for (const own of idle) {
    if (out.length >= 3 || budget <= 0) break;
    if (own.leased || inCheck(own, state.t)) continue;
    budget--;
    const om = MODEL[own.model];
    const cands = c.planes
      .filter((x) => x.leased && !taken.has(x.id) && x.legs.length > 0 && MODEL[x.model].family === om.family && om.seats >= MODEL[x.model].seats * 0.85)
      // 같은 기종 먼저, 그다음 리스료가 비싼 것
      .sort((x, y) => Number(y.model === own.model) - Number(x.model === own.model) || y.rent - x.rent)
      .slice(0, 4);
    for (const lease of cands) {
      if (swapLease(state, ci, own.id, lease.id)) {
        out.push({ own: own.id, lease: lease.id });
        taken.add(lease.id);
        break;
      }
    }
  }
  return out;
}

/** 쉬는 내 비행기가 리스기 노선을 넘겨받고 리스기를 돌려준다. 노선을 거의 그대로 넘겨받지 못하면 null */
function swapLease(s: AirlineState, ci: number, ownId: number, leaseId: number): AirlineState | null {
  const pl = planner(s, ci);
  const own = planeById(pl.c, ownId);
  const lease = planeById(pl.c, leaseId);
  if (!own || !lease || !lease.leased || own.legs.length > 0 || lease.legs.length === 0) return null;
  const legs = lease.legs.map((l) => ({ ...l }));
  const before = legs.reduce((sum, l) => sum + l.freq, 0) * MODEL[lease.model].seats;
  if (!pl.act({ type: 'sell', plane: leaseId })) return null;
  let after = 0;
  for (const l of legs) {
    const f = Math.min(l.freq, bestFreq(pl.s, ci, ownId, l.route));
    if (f < 1 || !pl.act({ type: 'assign', plane: ownId, route: l.route, freq: f })) return null;
    after += f * MODEL[own.model].seats;
  }
  return after >= before * 0.85 ? pl.s : null;
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
  for (const m of planModelsFor(c, year)) {
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
  if (f < 1) {
    const why = assignBlocker(pl.s, ci, pid, routeId, 1);
    if (why) note(why);
    return s;
  }
  if (!pl.act({ type: 'assign', plane: pid, route: routeId, freq: f })) return s;
  return pl.s;
}

/** 낡은 비행기를 바꿀 리스 기종 (첫 노선 기준) */
export function replacementFor(state: AirlineState, ci: number, planeId: number): { model: string; gain: number } | null {
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
  for (const m of planModelsFor(c, year)) {
    if (m.range < d || airportClass(CITY[r.a], year) < m.runway || airportClass(CITY[r.b], year) < m.runway) continue;
    if (buyBlocker(state, ci, m.id, true)) continue;
    const draft = drafts.filter((_, i) => onRoute[i]?.id !== p.id);
    draft.push({ model: m.id, freq: Math.min(leg.freq, maxFreq(m, d)), fixed: newLeaseFixed(state, m) });
    const gain = estimateExisting(state, ci, r, { planes: draft }).profit - before;
    if (!best || gain > best.gain) best = { model: m.id, gain };
  }
  return best;
}

export function replacePlane(s: AirlineState, ci: number, planeId: number, model: string): AirlineState {
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
