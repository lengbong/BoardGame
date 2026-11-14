import { MODEL, availableModels } from './aircraft';
import { CITIES, CITY, REGIONS, airportClass, citySize, dist, pairKey } from './cities';
import {
  applyAction,
  assignBlocker,
  bestFreq,
  branchBlocker,
  buyBlocker,
  idlePlanes,
  planeById,
  routeBlocker,
  routeById,
  routeOnPair,
} from './rules';
import {
  baseFare,
  branchCost,
  branchUpkeep,
  creditLimit,
  estimateExisting,
  estimateRoute,
  leaseDeposit,
  leaseRent,
  maxFreq,
  modelPrice,
  pairDemand,
  planeAge,
  regionsServed,
  routeIndex,
  sellPrice,
  slotCapacity,
  slotsUsed,
  type DraftPlane,
} from './simulate';
import { yearOf } from './time';
import type { AirlineAction, AirlineState, Company, ModelDef, RegionId, Rng } from './types';

export type AiLevel = 'ai-easy' | 'ai-normal';

/**
 * 컴퓨터 항공사. 한 분기 경영을 행동 목록으로 정한다 (끝에 endTurn은 넣지 않는다).
 * 쉬움: 본사에서 손님이 많은 도시로 천천히 노선을 늘리고, 운임은 그대로, 잘 안 되는 노선만 닫는다.
 * 보통: 후보 노선마다 손님·경쟁·기종을 따져 이익을 어림하고, 운임·횟수를 고치고, 낡은 비행기를 바꾸고,
 *       광고·대출을 관리하고, 목표(여섯 지역)를 쫓는다.
 */
export function planTurn(state: AirlineState, ci: number, level: AiLevel, rng: Rng = Math.random): AirlineAction[] {
  const ai = new Planner(state, ci, level, rng);
  ai.run();
  return ai.actions;
}

/** 이 회사의 분기 경영을 모두 한 상태 (차례 마치기 전) */
export function aiManage(state: AirlineState, ci: number, level: AiLevel, rng: Rng = Math.random): AirlineState {
  const ai = new Planner(state, ci, level, rng);
  ai.run();
  return ai.s;
}

export interface Candidate {
  a: string;
  b: string;
  model: ModelDef;
  freq: number;
  fare: number;
  profit: number;
  /** 새로 드는 돈 (지점 + 계약금이나 값) */
  capital: number;
  needBranch: string[];
  score: number;
}

class Planner {
  s: AirlineState;
  actions: AirlineAction[] = [];
  private readonly normal: boolean;
  private opened = 0;

  constructor(
    state: AirlineState,
    private readonly ci: number,
    level: AiLevel,
    private readonly rng: Rng,
  ) {
    this.s = state;
    this.normal = level === 'ai-normal';
  }

  get c(): Company {
    return this.s.companies[this.ci];
  }

  get year(): number {
    return yearOf(this.s.q);
  }

  /** 행동을 해 보고 되면 기록한다 */
  act(a: AirlineAction): boolean {
    const next = applyAction(this.s, a, this.rng);
    if (next === this.s) return false;
    this.s = next;
    this.actions.push(a);
    return true;
  }

  /** 지난 분기 비용 합 (현금 여유 계산) */
  private lastCosts(): number {
    const r = this.s.report?.companies[this.ci];
    if (!r) return 0;
    return r.fuel + r.crew + r.airport + r.service + r.sales + r.lease + r.fleet + r.branch + r.ads + r.interest;
  }

  private reserve(): number {
    return Math.max(60, this.lastCosts() * (this.normal ? 0.25 : 0.4));
  }

  private creditLeft(): number {
    return creditLimit(this.s, this.ci) - this.c.debt;
  }

  run(): void {
    if (this.c.out) return;
    this.emergency();
    this.tuneRoutes();
    if (this.normal) this.closeUnusedBranches();
    this.useIdlePlanes();
    if (this.normal) {
      this.manageLoans(true);
      this.expand(3);
      this.addCapacity();
      this.renewFleet();
      this.setAds();
      this.setService();
      this.manageLoans(false);
    } else {
      this.easyExpand();
      this.easyAds();
      if (this.c.cash > 1500 && this.c.debt > 0) this.act({ type: 'repay', amount: Math.min(this.c.debt, this.c.cash - 1000) });
    }
  }

  // ---------------------------------------------------------------- 위기

  private emergency(): void {
    const c = this.c;
    if (c.cash >= 0 && c.crisis === 0) return;
    for (const r of REGIONS) if (c.ads[r] > 0) this.act({ type: 'setAds', region: r, amount: 0 });
    // 손해 보는 노선을 닫고 쉬는 비행기를 판다
    for (const r of [...this.c.routes]) {
      if (r.stats && r.stats.profit < 0) this.act({ type: 'closeRoute', route: r.id });
    }
    for (const p of idlePlanes(this.c)) {
      if (!p.leased || this.c.cash > p.rent) this.act({ type: 'sell', plane: p.id });
    }
    if (this.c.cash < 50) {
      const need = Math.min(this.creditLeft(), 50 - this.c.cash);
      if (need >= 1) this.act({ type: 'borrow', amount: Math.floor(need) });
    }
  }

  // ---------------------------------------------------------------- 노선 고치기

  private tuneRoutes(): void {
    for (const r0 of [...this.c.routes]) {
      const r = routeById(this.c, r0.id);
      if (!r) continue;
      const planes = this.c.planes.filter((p) => p.route === r.id);
      const st = r.stats;
      if (planes.length === 0) {
        if (this.s.q - r.since >= 2) this.act({ type: 'closeRoute', route: r.id });
        continue;
      }
      if (!this.normal) {
        // 쉬움: 꽉 차면 조금 올리고, 많이 비면 조금 내린다
        if (st && st.lf >= 0.95 && r.fare < 15) this.act({ type: 'setFare', route: r.id, fare: r.fare + 5 });
        else if (st && st.lf < 0.6 && r.fare > -15) this.act({ type: 'setFare', route: r.id, fare: r.fare - 5 });
        if (st && st.lossStreak >= 4) this.act({ type: 'closeRoute', route: r.id });
        continue;
      }
      // 운임: 몇 가지를 어림해 보고 가장 이익이 큰 쪽으로 (한 번에 10%p까지만)
      let bestFare = r.fare;
      let bestProfit = estimateExisting(this.s, this.ci, r).profit;
      const lf = st?.lf ?? 0.8;
      const fareSteps = lf > 0.97 ? [r.fare + 5, r.fare + 10] : lf < 0.6 ? [r.fare - 10, r.fare - 5] : [r.fare - 5, r.fare + 5];
      for (const f of fareSteps) {
        if (f < -25 || f > 25) continue;
        const e = estimateExisting(this.s, this.ci, r, { fare: f });
        if (e.profit > bestProfit + 0.5) {
          bestProfit = e.profit;
          bestFare = f;
        }
      }
      if (bestFare !== r.fare) this.act({ type: 'setFare', route: r.id, fare: bestFare });
      // 횟수: 좌석이 많이 비거나 꽉 찰 때만 비행기마다 줄이거나 늘려 본다
      const tuneFreq = !st || st.lf < 0.75 || st.lf > 0.97 || (this.s.q + r.id) % 4 === 0;
      for (const p of tuneFreq ? planes : []) {
        const cur = planeById(this.c, p.id);
        if (!cur || cur.route !== r.id) continue;
        const route = routeById(this.c, r.id)!;
        const max = bestFreq(this.s, this.ci, cur.id, route.id);
        if (max <= 0) continue;
        const options = [...new Set([max, Math.round(max * 0.75), Math.round(max * 0.5), cur.freq])].filter((f) => f >= 1 && f <= max);
        let pick = cur.freq;
        let best = -Infinity;
        for (const f of options) {
          const draft = this.draftOf(route.id, cur.id, f);
          const e = estimateExisting(this.s, this.ci, route, { planes: draft });
          if (e.profit > best + 0.5) {
            best = e.profit;
            pick = f;
          }
        }
        if (pick !== cur.freq) this.act({ type: 'setFreq', plane: cur.id, freq: pick });
      }
      // 계속 손해면 닫는다 (비행기는 다른 곳에 쓴다)
      const after = estimateExisting(this.s, this.ci, routeById(this.c, r.id)!);
      const leaseOfRoute = this.c.planes.filter((p) => p.route === r.id).reduce((sum, p) => sum + p.rent, 0);
      if (st && st.lossStreak >= 2 && after.profit < -leaseOfRoute * 0.5) this.act({ type: 'closeRoute', route: r.id });
    }
  }

  /** 노선도 부대사업도 없는 지점은 유지비만 드니 닫는다 (본사는 빼고) */
  private closeUnusedBranches(): void {
    for (const city of [...this.c.branches]) {
      if (city === this.c.hub) continue;
      if (this.c.routes.some((r) => r.a === city || r.b === city)) continue;
      if (this.c.businesses.some((b) => b.city === city)) continue;
      this.act({ type: 'closeBranch', city });
    }
  }

  /** 노선의 비행기들 (한 대의 횟수만 바꿔서) */
  private draftOf(routeId: number, planeId: number | null, freq: number, extra?: DraftPlane): DraftPlane[] {
    const out: DraftPlane[] = this.c.planes
      .filter((p) => p.route === routeId)
      .map((p) => ({ model: p.model, freq: p.id === planeId ? freq : p.freq, age: planeAge(this.s, p), leased: p.leased, rent: p.rent }));
    if (extra) out.push(extra);
    return out;
  }

  // ---------------------------------------------------------------- 쉬는 비행기

  private useIdlePlanes(): void {
    for (const p0 of idlePlanes(this.c)) {
      const p = planeById(this.c, p0.id);
      if (!p) continue;
      const m = MODEL[p.model];
      // 이미 있는 노선에 보태 보기
      let best: { route: number; freq: number; gain: number } | null = null;
      for (const r of this.c.routes) {
        const f = bestFreq(this.s, this.ci, p.id, r.id);
        if (f <= 0) continue;
        const before = estimateExisting(this.s, this.ci, r).profit;
        const opts = this.normal ? [f, Math.max(1, Math.round(f * 0.6))] : [f];
        for (const freq of opts) {
          const after = estimateExisting(this.s, this.ci, r, {
            planes: this.draftOf(r.id, null, 0, { model: m.id, freq, age: planeAge(this.s, p), leased: p.leased, rent: p.rent }),
          }).profit;
          const gain = after - before - p.rent;
          if (!best || gain > best.gain) best = { route: r.id, freq, gain };
        }
      }
      if (best && best.gain > -p.rent * 0.3) {
        this.act({ type: 'assign', plane: p.id, route: best.route, freq: best.freq });
        continue;
      }
      // 새 노선에 써 보기
      const cand = this.bestCandidates(6, m).find((x) => x.model.id === m.id && x.profit > 0);
      if (cand && this.openCandidate(cand, p.id)) continue;
      // 쓸 데가 없으면 판다 (리스는 돌려준다)
      if (!p.leased || this.c.cash > p.rent * 2) this.act({ type: 'sell', plane: p.id });
    }
  }

  // ---------------------------------------------------------------- 넓히기

  /** 기종 고르기에 쓸 만한 것 (지금 살 수 있는 것) */
  private models(): ModelDef[] {
    return availableModels(this.year);
  }

  /** 이 노선에 띄울 수 있는 기종인지 (공항·거리) */
  private fits(m: ModelDef, a: string, b: string): boolean {
    if (m.range < dist(a, b)) return false;
    return airportClass(CITY[a], this.year) >= m.runway && airportClass(CITY[b], this.year) >= m.runway;
  }

  /** 공항마다 남은 슬롯 (같은 상태면 다시 세지 않는다) */
  private slotMemo: { state: AirlineState; left: Map<string, number> } | null = null;

  private slotsLeft(city: string): number {
    if (!this.slotMemo || this.slotMemo.state !== this.s) this.slotMemo = { state: this.s, left: new Map() };
    let v = this.slotMemo.left.get(city);
    if (v === undefined) {
      v = slotCapacity(this.s, this.ci, city) - slotsUsed(this.c, city);
      this.slotMemo.left.set(city, v);
    }
    return v;
  }

  /** 후보 노선들 (이익 어림 순) */
  bestCandidates(limit: number, only?: ModelDef): Candidate[] {
    const c = this.c;
    const served = regionsServed(c);
    const goalMode = this.s.options.mode === 'goal' || this.s.challenge?.id === 'sixregions';
    const year = this.year;
    const origins = [...c.branches].sort((x, y) => (x === c.hub ? -1 : y === c.hub ? 1 : citySize(CITY[y], year) - citySize(CITY[x], year))).slice(0, 8);
    const models = only ? [only] : this.models();
    const maxRange = Math.max(0, ...models.map((m) => m.range));
    const quick: { a: string; b: string; v: number }[] = [];
    const seen = new Set<string>();
    for (const a of origins) {
      if (this.slotsLeft(a) < 2) continue;
      for (const city of CITIES) {
        const b = city.id;
        if (b === a) continue;
        const key = pairKey(a, b);
        if (seen.has(key) || routeOnPair(c, a, b)) continue;
        seen.add(key);
        const d = dist(a, b);
        if (d < 300 || d > maxRange) continue;
        // 쉬움은 너무 먼 노선은 겁내요
        if (!this.normal && d > 6500) continue;
        if (this.slotsLeft(b) < 2) continue;
        const dem = pairDemand(this.s, a, b);
        let v = (dem.biz * 1.7 + dem.leisure) * baseFare(d, this.s.q);
        // 다른 회사가 이미 많이 날면 덜
        let rivals = 0;
        for (let i = 0; i < this.s.companies.length; i++) {
          const x = this.s.companies[i];
          if (i !== this.ci && !x.out && routeIndex(x).has(key)) rivals++;
        }
        v /= 1 + rivals * 0.6;
        if (!c.branches.includes(b)) v *= 0.85;
        if (goalMode && (!served.has(CITY[a].region) || !served.has(CITY[b].region))) v *= 1.8;
        quick.push({ a, b, v });
      }
    }
    quick.sort((x, y) => y.v - x.v);
    const out: Candidate[] = [];
    for (const q of quick.slice(0, this.normal ? 12 : 5)) {
      const cand = this.evaluatePair(q.a, q.b, models, goalMode && (!served.has(CITY[q.a].region) || !served.has(CITY[q.b].region)));
      if (cand) out.push(cand);
    }
    out.sort((x, y) => y.score - x.score);
    return out.slice(0, limit);
  }

  /** 두 도시에 가장 알맞은 기종·횟수 */
  private evaluatePair(a: string, b: string, models: ModelDef[], newRegion: boolean): Candidate | null {
    const d = dist(a, b);
    const needBranch = [a, b].filter((x) => !this.c.branches.includes(x));
    const branchMoney = needBranch.reduce((sum, x) => sum + branchCost(x, this.s.q), 0);
    const upkeep = needBranch.reduce((sum, x) => sum + branchUpkeep(x, this.s.q), 0);
    let best: Candidate | null = null;
    const slotLimit = Math.min(this.slotsLeft(a), this.slotsLeft(b));
    const dem = pairDemand(this.s, a, b);
    // 우리가 태울 만한 주간 손님 (대략)
    const reach = (dem.biz + dem.leisure) * 0.7;
    for (const m of models) {
      if (!this.fits(m, a, b)) continue;
      const max = Math.min(maxFreq(m, d), slotLimit);
      if (max < 1) continue;
      // 한 주에 한 번만 날아도 손님보다 좌석이 훨씬 많으면 너무 큰 비행기
      if (m.seats > reach * 1.3 && models.length > 1) continue;
      const rent = leaseRent(this.s, m);
      const fit = Math.max(1, Math.min(max, Math.round(reach / m.seats)));
      const freqs = this.normal ? [...new Set([max, fit, Math.max(1, Math.round((max + fit) / 2))])] : [...new Set([max, fit])];
      for (const freq of freqs) {
        const fare = 0;
        const e = estimateRoute(this.s, this.ci, a, b, [{ model: m.id, freq, leased: true, rent }], fare);
        const profit = e.profit - upkeep;
        const capital = branchMoney + leaseDeposit(this.s, m);
        // 이익에 더해 좌석이 덜 비는 쪽, 목표 지역이면 더 높게
        let score = profit * (0.7 + 0.3 * Math.min(1, e.lf / 0.8));
        if (newRegion) score += Math.max(30, e.revenue * 0.25);
        // 쉬움은 좌석이 얼마나 찰지 덜 따지고 이익만 본다
        if (!this.normal) score = profit;
        if (!best || score > best.score) best = { a, b, model: m, freq, fare, profit, capital, needBranch, score };
      }
    }
    return best;
  }

  /** 후보대로 지점·노선을 열고 비행기를 들여 띄운다 (plane이 있으면 그 비행기로) */
  openCandidate(cand: Candidate, plane?: number, how: 'auto' | 'buy' | 'lease' = 'auto'): boolean {
    for (const city of cand.needBranch) {
      if (branchBlocker(this.s, this.ci, city)) return false;
    }
    if (routeBlocker(this.s, this.ci, cand.a, cand.b) && !cand.needBranch.length) return false;
    const before = this.s;
    const beforeActions = this.actions.length;
    for (const city of cand.needBranch) this.act({ type: 'openBranch', city });
    if (!this.act({ type: 'openRoute', a: cand.a, b: cand.b })) {
      this.s = before;
      this.actions.length = beforeActions;
      return false;
    }
    const route = routeOnPair(this.c, cand.a, cand.b)!;
    let planeId = plane;
    if (planeId === undefined) {
      const price = modelPrice(this.s, cand.model);
      const buy =
        how === 'buy' || (how === 'auto' && this.normal && this.c.cash - price > this.reserve() * 3 && this.c.debt < creditLimit(this.s, this.ci) * 0.3);
      const ok = buy ? this.act({ type: 'buy', model: cand.model.id }) : this.act({ type: 'lease', model: cand.model.id });
      if (!ok) {
        this.s = before;
        this.actions.length = beforeActions;
        return false;
      }
      planeId = this.c.planes[this.c.planes.length - 1].id;
    }
    const f = Math.min(cand.freq, bestFreq(this.s, this.ci, planeId, route.id));
    if (f < 1 || !this.act({ type: 'assign', plane: planeId, route: route.id, freq: f })) {
      this.s = before;
      this.actions.length = beforeActions;
      return false;
    }
    this.opened++;
    return true;
  }

  /** 이번 차례에 본 후보 목록 (한 번만 셈한다) */
  private candList: Candidate[] | null = null;

  private candidates(): Candidate[] {
    if (!this.candList) this.candList = this.bestCandidates(6);
    return this.candList;
  }

  private expand(max: number): void {
    const list = [...this.candidates()];
    // 가끔은 두 번째 후보부터 (판마다 조금 다르게)
    if (list.length > 1 && this.rng() < 0.2) [list[0], list[1]] = [list[1], list[0]];
    const usedCities = new Set<string>();
    for (const cand of list) {
      if (this.opened >= max) break;
      const budget = this.c.cash - this.reserve();
      if (budget < 30) break;
      if (routeOnPair(this.c, cand.a, cand.b)) continue;
      // 앞에서 같은 도시를 썼으면 슬롯·경쟁이 바뀌었으니 다시 어림한다
      let c2: Candidate | null = cand;
      if (usedCities.has(cand.a) || usedCities.has(cand.b)) c2 = this.evaluatePair(cand.a, cand.b, [cand.model], false);
      if (!c2 || c2.profit <= 5 || c2.capital > budget) continue;
      if (this.openCandidate(c2)) {
        usedCities.add(cand.a);
        usedCities.add(cand.b);
      }
    }
  }

  private easyExpand(): void {
    if (this.c.cash < 300) return;
    // 비행기가 적을 때는 본사에서만, 조금 커지면 지점끼리도
    const fromHub = this.c.planes.length < 4;
    const cands = this.bestCandidates(5).filter((x) => (!fromHub || x.a === this.c.hub || x.b === this.c.hub) && x.profit > 0);
    if (cands.length === 0) return;
    const pick = cands[Math.floor(this.rng() * Math.min(2, cands.length))];
    this.openCandidate(pick);
  }

  /** 꽉 찬 노선에 비행기를 보탠다 */
  private addCapacity(): void {
    let added = 0;
    const routes = [...this.c.routes].filter((r) => r.stats && r.stats.lf > 0.9 && r.stats.profit > 0).sort((x, y) => y.stats!.profit - x.stats!.profit);
    for (const r of routes) {
      if (added >= 2) break;
      const budget = this.c.cash - this.reserve();
      if (budget < 30) break;
      const route = routeById(this.c, r.id)!;
      const before = estimateExisting(this.s, this.ci, route).profit;
      let best: { m: ModelDef; freq: number; gain: number } | null = null;
      // 지금 비행기와 크기가 비슷한 기종만 본다
      const seatsNow = this.c.planes.filter((p) => p.route === route.id).map((p) => MODEL[p.model].seats);
      const avg = seatsNow.length > 0 ? seatsNow.reduce((x, y) => x + y, 0) / seatsNow.length : 150;
      for (const m of this.models()) {
        if (m.seats < avg * 0.45 || m.seats > avg * 1.6) continue;
        if (!this.fits(m, route.a, route.b)) continue;
        const max = Math.min(maxFreq(m, dist(route.a, route.b)), this.slotsLeft(route.a), this.slotsLeft(route.b));
        if (max < 1) continue;
        const rent = leaseRent(this.s, m);
        const after = estimateExisting(this.s, this.ci, route, { planes: this.draftOf(route.id, null, 0, { model: m.id, freq: max, leased: true, rent }) }).profit;
        const gain = after - before;
        if (gain > 8 && (!best || gain > best.gain)) best = { m, freq: max, gain };
      }
      if (!best || leaseDeposit(this.s, best.m) > budget) continue;
      if (!this.act({ type: 'lease', model: best.m.id })) continue;
      const pid = this.c.planes[this.c.planes.length - 1].id;
      const f = Math.min(best.freq, bestFreq(this.s, this.ci, pid, route.id));
      if (f >= 1) this.act({ type: 'assign', plane: pid, route: route.id, freq: f });
      added++;
    }
  }

  /** 낡거나 연료를 많이 먹는 비행기를 새 기종으로 바꾼다 */
  private renewFleet(): void {
    let done = 0;
    const old = [...this.c.planes]
      .filter((p) => p.route !== null && (planeAge(this.s, p) >= 20 || (MODEL[p.model].end < this.year && planeAge(this.s, p) >= 12)))
      .sort((x, y) => planeAge(this.s, y) - planeAge(this.s, x));
    for (const p of old) {
      if (done >= 2) break;
      const r = routeById(this.c, p.route!);
      if (!r) continue;
      const before = estimateExisting(this.s, this.ci, r).profit;
      let best: { m: ModelDef; freq: number; profit: number } | null = null;
      for (const m of this.models()) {
        if (!this.fits(m, r.a, r.b)) continue;
        const max = maxFreq(m, dist(r.a, r.b));
        const freq = Math.min(max, p.freq + Math.max(0, slotCapacity(this.s, this.ci, r.a) - slotsUsed(this.c, r.a)));
        if (freq < 1) continue;
        const rent = leaseRent(this.s, m);
        const draft = this.c.planes
          .filter((x) => x.route === r.id && x.id !== p.id)
          .map((x) => ({ model: x.model, freq: x.freq, age: planeAge(this.s, x), leased: x.leased, rent: x.rent }));
        draft.push({ model: m.id, freq: Math.min(freq, p.freq), age: 0, leased: true, rent });
        const prof = estimateExisting(this.s, this.ci, r, { planes: draft }).profit;
        if (!best || prof > best.profit) best = { m, freq: Math.min(freq, p.freq), profit: prof };
      }
      if (!best || best.profit < before + 5) continue;
      const price = modelPrice(this.s, best.m);
      const buy = this.c.cash + (p.leased ? 0 : sellPrice(this.s, p)) - price > this.reserve() * 3;
      if (buyBlocker(this.s, this.ci, best.m.id, !buy)) continue;
      if (!this.act({ type: 'sell', plane: p.id })) continue;
      if (!this.act({ type: buy ? 'buy' : 'lease', model: best.m.id })) continue;
      const pid = this.c.planes[this.c.planes.length - 1].id;
      const f = Math.min(best.freq, bestFreq(this.s, this.ci, pid, r.id));
      if (f >= 1) this.act({ type: 'assign', plane: pid, route: r.id, freq: f });
      done++;
    }
  }

  // ---------------------------------------------------------------- 광고·서비스·대출

  private setAds(): void {
    const rep = this.s.report?.companies[this.ci];
    if (!rep) return;
    const total = Math.max(0, rep.ticket * 0.025);
    const sumPax = REGIONS.reduce((s, r) => s + rep.regionPax[r], 0);
    for (const region of REGIONS) {
      const want = sumPax > 0 ? Math.round((total * rep.regionPax[region]) / sumPax) : 0;
      const cur = this.c.ads[region];
      if (Math.abs(want - cur) > Math.max(2, cur * 0.2)) this.act({ type: 'setAds', region: region as RegionId, amount: Math.min(want, 300) });
    }
  }

  private easyAds(): void {
    const rep = this.s.report?.companies[this.ci];
    const region = CITY[this.c.hub].region;
    const want = rep ? Math.min(100, Math.round(rep.ticket * 0.01)) : 0;
    if (Math.abs(want - this.c.ads[region]) > 3) this.act({ type: 'setAds', region, amount: want });
  }

  private setService(): void {
    const rep = this.s.report?.companies[this.ci];
    const profitable = !!rep && rep.profit > 0;
    const want = profitable && this.c.reputation < 55 ? 4 : profitable ? 3 : 3;
    if (want !== this.c.service) this.act({ type: 'setService', level: want });
  }

  /** before: 넓히기 전에 빌릴지, 아니면 남는 돈으로 갚을지 */
  private manageLoans(before: boolean): void {
    const c = this.c;
    const limit = creditLimit(this.s, this.ci);
    if (before) {
      // 좋은 후보가 있는데 돈이 모자라면 한도의 60%까지 빌린다
      if (c.debt > limit * 0.6) return;
      const need = this.reserve() + 150 - c.cash;
      if (need <= 0) return;
      const cands = this.candidates();
      if (cands.length === 0 || cands[0].profit < 20) return;
      const amount = Math.floor(Math.min(need + 100, limit * 0.6 - c.debt));
      if (amount >= 20) this.act({ type: 'borrow', amount });
      return;
    }
    const spare = c.cash - this.reserve() * 4 - 200;
    if (c.debt > 0 && spare > 20) this.act({ type: 'repay', amount: Math.floor(Math.min(c.debt, spare)) });
  }
}

/** 사람에게 보여 줄 추천 노선 (보통 컴퓨터처럼 어림한 것, 이익 순) */
export function suggestRoutes(state: AirlineState, ci: number, limit = 5, from?: string): Candidate[] {
  const ai = new Planner(state, ci, 'ai-normal', () => 0.5);
  const list = ai.bestCandidates(limit * 3);
  return list.filter((c) => c.profit > 0 && (!from || c.a === from || c.b === from)).slice(0, limit);
}

/** 추천 노선을 한 번에 열기: 지점 → 노선 → 리스(또는 사기) → 띄우기. 못 하면 그대로 돌려준다 */
export function openSuggestion(state: AirlineState, ci: number, cand: Candidate, buy: boolean): AirlineState {
  const ai = new Planner(state, ci, 'ai-normal', () => 0.5);
  const ok = ai.openCandidate(cand, undefined, buy ? 'buy' : 'lease');
  return ok ? ai.s : state;
}

/** 컴퓨터 한 분기 (경영 + 차례 마치기) */
export function aiTurn(state: AirlineState, rng: Rng = Math.random): AirlineState {
  const ci = state.order[state.turnPos];
  const c = state.companies[ci];
  const level: AiLevel = c.kind === 'ai-easy' ? 'ai-easy' : 'ai-normal';
  const managed = aiManage(state, ci, level, rng);
  return applyAction(managed, { type: 'endTurn' }, rng);
}

export { assignBlocker };
