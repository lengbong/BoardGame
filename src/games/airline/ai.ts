import { MODEL, availableModels, leadTime } from './aircraft';
import { MAX_ROUTES } from './limits';
import { aiChoose, allianceScore } from './choices';
import { CITIES, CITY, REGIONS, airportClass, citySize, dist, pairKey } from './cities';
import {
  applyAction,
  bestFreq,
  branchBlocker,
  buyBlocker,
  depositFor,
  fleetCount,
  idlePlanes,
  planeById,
  proposeBlocker,
  routeBlocker,
  routeById,
  routeOnPair,
  usedBlocker,
} from './rules';
import {
  WEEK_HOURS,
  baseFare,
  branchCost,
  branchUpkeep,
  creditLimit,
  draftsOf,
  estimateExisting,
  estimateRoute,
  fixedShare,
  legFreq,
  maxFreq,
  newLeaseFixed,
  orderPrice,
  planeFixed,
  pairDemand,
  planeAge,
  planeHours,
  regionsServed,
  routeIndex,
  slotCapacity,
  slotsUsed,
  type DraftPlane,
} from './simulate';
import { yearOf } from './time';
import type { AirlineAction, AirlineState, Company, ModelDef, RegionId, Rng } from './types';

export type AiLevel = 'ai-easy' | 'ai-normal';

/** 어림(달 값)을 예전 분기 기준 문턱과 견줄 때 곱하는 수 */
const Q = 3;

/**
 * 컴퓨터 항공사. 한 분기 경영을 행동 목록으로 정한다 (끝에 endTurn은 넣지 않는다).
 * 쉬움: 본사에서 손님이 많은 도시로 천천히 노선을 늘리고, 운임은 조심스럽게, 잘 안 되는 노선만 닫는다.
 * 보통: 후보 노선마다 손님·경쟁·기종을 따져 이익을 어림하고, 운임·횟수를 고치고, 남는 비행시간을 쓰고,
 *       새 비행기를 미리 주문하고, 낡은 비행기를 바꾸고, 광고·대출·제휴·결정 사건을 챙기고, 목표(여섯 지역)를 쫓는다.
 * 성향(느긋·보통·치열)에 따라 한 분기에 여는 노선 수와 남겨 두는 돈이 다르다.
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
  /** 새로 드는 돈 (지점 + 보증금) */
  capital: number;
  needBranch: string[];
  score: number;
}

export class Planner {
  s: AirlineState;
  actions: AirlineAction[] = [];
  readonly normal: boolean;
  private opened = 0;

  constructor(
    state: AirlineState,
    readonly ci: number,
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

  get style() {
    return this.s.options.aiStyle ?? 'normal';
  }

  /** 행동을 해 보고 되면 기록한다 */
  act(a: AirlineAction): boolean {
    const next = applyAction(this.s, a, this.rng);
    if (next === this.s) return false;
    this.s = next;
    this.actions.push(a);
    return true;
  }

  /** 지난달 비용 합 (현금 여유 계산) */
  private lastCosts(): number {
    const r = this.s.report?.companies[this.ci];
    if (!r) return 0;
    return r.fuel + r.crew + r.airport + r.service + r.sales + r.lease + r.fleet + r.branch + r.ads + r.interest + r.disrupt;
  }

  /** 남겨 둘 현금 (석 달 치 비용의 일부) */
  reserve(): number {
    const styleMult = this.style === 'relaxed' ? 1.6 : this.style === 'fierce' ? 0.8 : 1;
    return Math.max(60, this.lastCosts() * Q * (this.normal ? 0.25 : 0.4) * styleMult);
  }

  /** 이 회사가 크게 계획을 세우는 달 (석 달에 한 번, 회사마다 다른 달) */
  get planning(): boolean {
    return (this.s.t + this.ci) % 3 === 0 || this.c.routes.length === 0 || this.c.planes.length === 0;
  }

  /** 이번 분기에 이미 연 노선 수 */
  private openedThisQuarter(): number {
    const from = this.s.q * 3;
    return this.c.routes.filter((r) => r.since >= from).length;
  }

  private creditLeft(): number {
    return creditLimit(this.s, this.ci) - this.c.debt;
  }

  /** 이번 분기에 새로 열 수 있는 노선 수 (성향·첫해 속도) */
  private maxNewRoutes(): number {
    const yearsIn = (this.s.q - this.s.startQ) / 4;
    if (!this.normal) return 1;
    if (this.style === 'relaxed') return yearsIn < 2 ? ((this.s.q - this.s.startQ) % 2 === 0 ? 1 : 0) : 1;
    if (this.style === 'normal') return yearsIn < 1 ? 1 : 2;
    return 3;
  }

  run(): void {
    if (this.c.out) return;
    this.decide();
    this.emergency();
    if (!this.planning) {
      // 계획 달이 아니면 가볍게: 쉬는 비행기, 아주 차거나 빈 노선의 운임, 광고
      this.quickFares();
      this.useIdlePlanes();
      if (this.normal) this.setAds();
      return;
    }
    this.tuneRoutes();
    if (this.normal) this.closeUnusedBranches();
    this.useIdlePlanes();
    if (this.normal) {
      this.useSpareHours();
      this.manageLoans(true);
      this.expand(this.maxNewRoutes() - this.openedThisQuarter());
      this.addCapacity();
      this.renewFleet();
      this.orderAhead();
      this.setAds();
      this.setService();
      this.setOps();
      this.maybePropose();
      this.manageLoans(false);
    } else {
      this.easyExpand();
      this.easyAds();
      if (this.c.cash > 1500 && this.c.debt > 0) this.act({ type: 'repay', amount: Math.min(this.c.debt, this.c.cash - 1000) });
    }
  }

  /** 아주 꽉 차거나 많이 빈 노선만 운임을 한 칸 고친다 */
  private quickFares(): void {
    const cap = this.style === 'relaxed' ? 10 : this.normal ? 25 : 15;
    for (const r of this.c.routes) {
      const st = r.stats;
      if (!st || st.pax <= 0) continue;
      if (st.lf > 0.985 && r.fare + 5 <= cap) this.act({ type: 'setFare', route: r.id, fare: r.fare + 5 });
      else if (st.lf < 0.5 && r.fare - 5 >= -25) this.act({ type: 'setFare', route: r.id, fare: r.fare - 5 });
    }
  }

  /** 정비 수준·예비 승무원: 비행기가 낡거나 지연이 잦으면 꼼꼼히, 돈이 급하면 아끼기 */
  private setOps(): void {
    const c = this.c;
    const age = c.planes.length ? c.planes.reduce((sum, p) => sum + planeAge(this.s, p), 0) / c.planes.length : 0;
    let maint = 3;
    if (c.crisis > 0 || c.cash < this.reserve()) maint = 2;
    else if (c.onTime < 0.8 || age > 14) maint = 4;
    if (maint !== c.maint) this.act({ type: 'setMaint', level: maint });
    const reserve = c.crisis > 0 ? 0 : c.onTime < 0.78 ? 2 : 1;
    if (reserve !== c.crewReserve) this.act({ type: 'setCrewReserve', level: reserve });
  }

  // ---------------------------------------------------------------- 결정 사건

  private decide(): void {
    const ch = this.c.choice;
    if (!ch) return;
    const k = aiChoose(ch, this.c.cash, this.reserve(), !this.normal, this.rng);
    if (!this.act({ type: 'choose', option: k })) this.act({ type: 'choose', option: ch.options.length - 1 });
  }

  private maybePropose(): void {
    if (this.c.partner !== null || this.s.q - this.s.startQ < 8 || this.rng() > 0.12) return;
    let best = -1;
    let score = 1;
    this.s.companies.forEach((t, ti) => {
      if (ti === this.ci || t.out || t.partner !== null) return;
      const sc = allianceScore(this.s, this.ci, ti);
      if (sc > score) {
        score = sc;
        best = ti;
      }
    });
    if (best >= 0 && !proposeBlocker(this.s, this.ci, best)) this.act({ type: 'propose', to: best });
  }

  // ---------------------------------------------------------------- 위기

  private emergency(): void {
    const c = this.c;
    if (c.cash >= 0 && c.crisis === 0) return;
    for (const r of REGIONS) if (c.ads[r] > 0) this.act({ type: 'setAds', region: r, amount: 0 });
    for (const r of [...this.c.routes]) {
      if (r.stats && r.stats.profit < 0) this.act({ type: 'closeRoute', route: r.id });
    }
    for (const o of [...this.c.orders]) if (this.c.cash < 0) this.act({ type: 'cancelOrder', order: o.id });
    for (const p of idlePlanes(this.c)) this.act({ type: 'sell', plane: p.id });
    if (this.c.cash < 50) {
      const need = Math.min(this.creditLeft(), 50 - this.c.cash);
      if (need >= 1) this.act({ type: 'borrow', amount: Math.floor(need) });
    }
  }

  // ---------------------------------------------------------------- 노선 고치기

  /** 이 노선의 비행기들 (한 대의 횟수만 바꾸거나 한 대를 보태서) */
  draftOf(routeId: number, planeId: number | null, freq: number, extra?: DraftPlane): DraftPlane[] {
    const out: DraftPlane[] = [];
    for (const p of this.c.planes) {
      const f = legFreq(p, routeId);
      if (f <= 0 && p.id !== planeId) continue;
      const nf = p.id === planeId ? freq : f;
      if (nf <= 0) continue;
      out.push({ model: p.model, freq: nf, age: planeAge(this.s, p), fixed: f > 0 ? fixedShare(this.c, p, routeId) : 0 });
    }
    if (extra) out.push(extra);
    return out;
  }

  private tuneRoutes(): void {
    const fareCap = this.style === 'relaxed' ? 10 : 25;
    for (const r0 of [...this.c.routes]) {
      const r = routeById(this.c, r0.id);
      if (!r) continue;
      const planes = this.c.planes.filter((p) => legFreq(p, r.id) > 0);
      const st = r.stats;
      if (planes.length === 0) {
        if (this.s.t - r.since >= 6) this.act({ type: 'closeRoute', route: r.id });
        continue;
      }
      if (!this.normal) {
        if (st && st.lf >= 0.95 && r.fare < 15) this.act({ type: 'setFare', route: r.id, fare: r.fare + 5 });
        else if (st && st.lf < 0.6 && r.fare > -15) this.act({ type: 'setFare', route: r.id, fare: r.fare - 5 });
        if (st && st.lossStreak >= 10) this.act({ type: 'closeRoute', route: r.id });
        continue;
      }
      // 운임: 몇 가지를 어림해 보고 가장 이익이 큰 쪽으로 (좌석이 아주 차거나 비지 않으면 두 분기에 한 번)
      let bestFare = r.fare;
      const lf = st?.lf ?? 0.8;
      const extreme = lf > 0.97 || lf < 0.6;
      const steps = !extreme && (this.s.q + r.id) % 2 === 1 ? [] : lf > 0.97 ? [r.fare + 5, r.fare + 10] : lf < 0.6 ? [r.fare - 10, r.fare - 5] : [r.fare - 5, r.fare + 5];
      let bestProfit = steps.length ? this.estimate(r.id) : 0;
      for (const f of steps) {
        if (f < -25 || f > fareCap) continue;
        const e = estimateExisting(this.s, this.ci, r, { fare: f });
        if (e.profit > bestProfit + 0.2) {
          bestProfit = e.profit;
          bestFare = f;
        }
      }
      if (bestFare !== r.fare) this.act({ type: 'setFare', route: r.id, fare: bestFare });
      // 횟수: 좌석이 많이 비거나 꽉 찰 때만 비행기마다 줄이거나 늘려 본다
      const tuneFreq = !st || st.lf < 0.75 || st.lf > 0.97 || (this.s.q + r.id) % 4 === 0;
      for (const p of tuneFreq ? planes : []) {
        const cur = planeById(this.c, p.id);
        const route = routeById(this.c, r.id);
        if (!cur || !route) continue;
        const now = legFreq(cur, route.id);
        if (now <= 0) continue;
        const max = Math.max(now, bestFreq(this.s, this.ci, cur.id, route.id));
        const lfNow = st?.lf ?? 0.8;
        const raw = lfNow > 0.97 ? [now, max] : lfNow < 0.75 ? [now, Math.round(now * 0.75), Math.round(now * 0.5)] : [now, max, Math.round(now * 0.75)];
        const options = [...new Set(raw)].filter((f) => f >= 1 && f <= max);
        if (options.length < 2) continue;
        let pick = now;
        let best = -Infinity;
        for (const f of options) {
          const e = estimateExisting(this.s, this.ci, route, { planes: this.draftOf(route.id, cur.id, f) });
          if (e.profit > best + 0.2) {
            best = e.profit;
            pick = f;
          }
        }
        if (pick !== now) this.act({ type: 'assign', plane: cur.id, route: route.id, freq: pick });
      }
      // 계속 손해면 닫는다 (비행기는 다른 곳에 쓴다)
      const now = routeById(this.c, r.id);
      if (!now) continue;
      if (!st || st.lossStreak < 5) continue;
      const after = this.estimate(now.id);
      const fixed = this.c.planes.reduce((sum, p) => sum + (legFreq(p, r.id) > 0 ? fixedShare(this.c, p, r.id) : 0), 0);
      if (after < -fixed * 0.5) this.act({ type: 'closeRoute', route: r.id });
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

  // ---------------------------------------------------------------- 쉬는 비행기와 남는 비행시간

  /** 이 비행기를 이미 있는 노선에 보탤 때 가장 좋은 곳 (marginal: 고정비는 이미 내므로 빼고 셈한다) */
  bestExistingLeg(planeId: number, marginal: boolean): { route: number; freq: number; gain: number } | null {
    const p = planeById(this.c, planeId);
    if (!p) return null;
    const m = MODEL[p.model];
    let best: { route: number; freq: number; gain: number } | null = null;
    for (const r of this.c.routes) {
      if (legFreq(p, r.id) > 0) continue;
      // 좌석이 남는 노선에 더 띄워 봐야 소용없다
      if (r.stats && r.stats.lf < 0.8 && this.c.planes.some((x) => legFreq(x, r.id) > 0)) continue;
      const f = bestFreq(this.s, this.ci, p.id, r.id);
      if (f <= 0) continue;
      const before = this.estimate(r.id);
      const opts = this.normal ? [...new Set([f, Math.max(1, Math.round(f * 0.6))])] : [f];
      for (const freq of opts) {
        const fixed = marginal ? 0 : planeFixed(p);
        const after = estimateExisting(this.s, this.ci, r, { planes: this.draftOf(r.id, null, 0, { model: m.id, freq, age: planeAge(this.s, p), fixed }) }).profit;
        const gain = after - before;
        if (!best || gain > best.gain) best = { route: r.id, freq, gain };
      }
    }
    return best;
  }

  private useIdlePlanes(): void {
    // 보통 컴퓨터는 비행기가 많으면 내 비행기 몇 대를 예비기로 남겨 둔다 (기체 점검·결항을 메운다)
    const flying = this.c.planes.filter((p) => p.legs.length > 0).length;
    let spares = this.normal ? Math.floor(flying * 0.05) : 0;
    for (const p0 of idlePlanes(this.c)) {
      const p = planeById(this.c, p0.id);
      if (!p) continue;
      const m = MODEL[p.model];
      if (spares > 0 && !p.leased && planeAge(this.s, p) < 22) {
        spares--;
        continue;
      }
      const best = this.bestExistingLeg(p.id, false);
      if (best && best.gain > -planeFixed(p) * 0.3) {
        this.act({ type: 'assign', plane: p.id, route: best.route, freq: best.freq });
        continue;
      }
      // 새 노선에 써 보기
      const cand = this.c.routes.length < MAX_ROUTES ? this.bestCandidates(6, m).find((x) => x.model.id === m.id && x.profit > 0) : undefined;
      if (cand && this.openCandidate(cand, p.id)) continue;
      // 내 비행기가 갈 곳이 없으면 같은 계열 리스기 자리와 바꾼다 (리스료를 아낀다)
      if (!p.leased && this.swapWithLease(p.id)) continue;
      // 쓸 데가 없으면 판다 (리스는 돌려준다)
      this.act({ type: 'sell', plane: p.id });
    }
  }

  /** 쉬는 내 비행기가 비슷한 리스기의 노선을 넘겨받고, 리스기는 돌려준다 */
  private swapWithLease(planeId: number): boolean {
    const p = planeById(this.c, planeId);
    if (!p) return false;
    const m = MODEL[p.model];
    const lease = this.c.planes.find((x) => x.leased && x.legs.length > 0 && MODEL[x.model].family === m.family && Math.abs(MODEL[x.model].seats - m.seats) < m.seats * 0.3);
    if (!lease) return false;
    const legs = lease.legs.map((l) => ({ ...l }));
    if (!this.act({ type: 'sell', plane: lease.id })) return false;
    let moved = false;
    for (const l of legs) {
      const f = Math.min(l.freq, bestFreq(this.s, this.ci, p.id, l.route));
      if (f >= 1 && this.act({ type: 'assign', plane: p.id, route: l.route, freq: f })) moved = true;
    }
    return moved;
  }

  /** 비행시간이 많이 남는 비행기를 다른 노선에도 띄운다 (가장 많이 남는 몇 대만 살핀다) */
  private useSpareHours(): void {
    const spare = this.c.planes
      .filter((p) => p.legs.length > 0)
      .map((p) => ({ id: p.id, left: WEEK_HOURS - planeHours(this.c, p) }))
      .filter((x) => x.left >= 14)
      .sort((x, y) => y.left - x.left)
      .slice(0, 3);
    for (const x of spare) {
      const best = this.bestExistingLeg(x.id, true);
      if (best && best.gain > 3 / Q) this.act({ type: 'assign', plane: x.id, route: best.route, freq: best.freq });
    }
  }

  /** 지금 노선 그대로의 이익 어림 (같은 상태면 다시 셈하지 않는다) */
  private estMemo: { state: AirlineState; v: Map<number, number> } | null = null;

  estimate(routeId: number): number {
    if (!this.estMemo || this.estMemo.state !== this.s) this.estMemo = { state: this.s, v: new Map() };
    let v = this.estMemo.v.get(routeId);
    if (v === undefined) {
      const r = routeById(this.c, routeId);
      v = r ? estimateExisting(this.s, this.ci, r).profit : 0;
      this.estMemo.v.set(routeId, v);
    }
    return v;
  }

  // ---------------------------------------------------------------- 넓히기

  private models(): ModelDef[] {
    return availableModels(this.year);
  }

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
  bestCandidates(limit: number, only?: ModelDef, from?: string): Candidate[] {
    const c = this.c;
    const served = regionsServed(c);
    const goalMode = this.s.options.mode === 'goal' || this.s.challenge?.id === 'sixregions';
    const year = this.year;
    const origins = from
      ? [from]
      : [...c.branches].sort((x, y) => (x === c.hub ? -1 : y === c.hub ? 1 : citySize(CITY[y], year) - citySize(CITY[x], year))).slice(0, 8);
    const models = only ? [only] : this.models();
    const maxRange = Math.max(0, ...models.map((m) => m.range));
    const quick: { a: string; b: string; v: number; d: number }[] = [];
    const seen = new Set<string>();
    const hubRoutes = c.routes.filter((r) => r.a === c.hub || r.b === c.hub).length;
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
        if (!this.normal && d > 6500) continue;
        if (this.slotsLeft(b) < 2) continue;
        const dem = pairDemand(this.s, a, b);
        let v = (dem.biz * 1.7 + dem.leisure) * baseFare(d, this.s.q);
        let rivals = 0;
        for (let i = 0; i < this.s.companies.length; i++) {
          const x = this.s.companies[i];
          if (i !== this.ci && !x.out && routeIndex(x).has(key)) rivals++;
        }
        v /= 1 + rivals * 0.6;
        if (!c.branches.includes(b)) v *= 0.85;
        // 본사에서 나가는 노선은 갈아타는 손님이 더해진다
        if (this.normal && (a === c.hub || b === c.hub)) v *= 1 + Math.min(0.25, hubRoutes * 0.03);
        if (goalMode && (!served.has(CITY[a].region) || !served.has(CITY[b].region))) v *= 1.8;
        quick.push({ a, b, v, d });
      }
    }
    quick.sort((x, y) => y.v - x.v);
    // 먼 노선일수록 표값이 커서 앞에 오기 쉬우니, 거리마다 몇 개씩 고루 따져 본다
    const bands = this.normal ? [5, 5, 4] : [3, 2, 1];
    const pick: typeof quick = [];
    const used = [0, 0, 0];
    for (const q of quick) {
      const band = q.d < 2000 ? 0 : q.d < 5000 ? 1 : 2;
      if (used[band] >= bands[band]) continue;
      used[band]++;
      pick.push(q);
    }
    const out: Candidate[] = [];
    for (const q of pick) {
      const cand = this.evaluatePair(q.a, q.b, models, goalMode && (!served.has(CITY[q.a].region) || !served.has(CITY[q.b].region)));
      if (cand) out.push(cand);
    }
    out.sort((x, y) => y.score - x.score);
    return out.slice(0, limit);
  }

  /** 두 도시에 가장 알맞은 기종·횟수 */
  evaluatePair(a: string, b: string, models: ModelDef[], newRegion: boolean): Candidate | null {
    const d = dist(a, b);
    const needBranch = [a, b].filter((x) => !this.c.branches.includes(x));
    const branchMoney = needBranch.reduce((sum, x) => sum + branchCost(x, this.s.q), 0);
    const upkeep = needBranch.reduce((sum, x) => sum + branchUpkeep(x, this.s.q), 0);
    let best: Candidate | null = null;
    const slotLimit = Math.min(this.slotsLeft(a), this.slotsLeft(b));
    const dem = pairDemand(this.s, a, b);
    const reach = (dem.biz + dem.leisure) * 0.7;
    const hubBonus = this.normal && (a === this.c.hub || b === this.c.hub) ? 1.06 : 1;
    // 1단계: 기종마다 알맞은 횟수 하나로 어림한다
    const first: { m: ModelDef; max: number; fit: number; score: number }[] = [];
    const tryOne = (m: ModelDef, freq: number) => {
      const e = estimateRoute(this.s, this.ci, a, b, [{ model: m.id, freq, fixed: newLeaseFixed(this.s, m) }], 0);
      const profit = e.profit * hubBonus - upkeep;
      const capital = branchMoney + depositFor(this.s, this.ci, m.id);
      let score = profit * (0.7 + 0.3 * Math.min(1, e.lf / 0.8));
      if (newRegion) score += Math.max(30 / Q, e.revenue * 0.25);
      if (!this.normal) score = profit;
      if (!best || score > best.score) best = { a, b, model: m, freq, fare: 0, profit, capital, needBranch, score };
      return score;
    };
    for (const m of models) {
      if (!this.fits(m, a, b)) continue;
      const max = Math.min(maxFreq(m, d), slotLimit);
      if (max < 1) continue;
      if (m.seats > reach * 1.3 && models.length > 1) continue;
      const fit = Math.max(1, Math.min(max, Math.round(reach / m.seats)));
      first.push({ m, max, fit, score: tryOne(m, fit) });
    }
    // 2단계: 좋은 기종 몇 개만 다른 횟수도 본다
    first.sort((x, y) => y.score - x.score);
    for (const x of first.slice(0, this.normal ? 2 : 1)) {
      const freqs = this.normal ? [x.max, Math.max(1, Math.round((x.max + x.fit) / 2))] : [x.max];
      for (const f of new Set(freqs)) if (f !== x.fit) tryOne(x.m, f);
    }
    return best;
  }

  /** 후보대로 지점·노선을 열고 비행기를 들여 띄운다 (plane이 있으면 그 비행기로) */
  openCandidate(cand: Candidate, plane?: number, how: 'auto' | 'lease' | 'used' = 'auto'): boolean {
    for (const city of cand.needBranch) if (branchBlocker(this.s, this.ci, city)) return false;
    if (!cand.needBranch.length && routeBlocker(this.s, this.ci, cand.a, cand.b)) return false;
    const before = this.s;
    const beforeActions = this.actions.length;
    const undo = () => {
      this.s = before;
      this.actions.length = beforeActions;
      return false;
    };
    for (const city of cand.needBranch) this.act({ type: 'openBranch', city });
    if (!this.act({ type: 'openRoute', a: cand.a, b: cand.b })) return undo();
    const route = routeOnPair(this.c, cand.a, cand.b)!;
    let planeId = plane;
    if (planeId === undefined) {
      // 같은 기종 중고가 싸게 나와 있고 돈이 넉넉하면 중고로, 아니면 리스로
      const used = this.s.market.find((u) => u.model === cand.model.id && u.age <= 14);
      const canUsed = used && !usedBlocker(this.s, this.ci, used.id) && (how === 'used' || (how === 'auto' && this.normal && this.c.cash - used.price > this.reserve() * 2));
      const ok = canUsed ? this.act({ type: 'buyUsed', listing: used!.id }) : this.act({ type: 'lease', model: cand.model.id });
      if (!ok) return undo();
      planeId = this.c.planes[this.c.planes.length - 1].id;
    }
    const f = Math.min(cand.freq, bestFreq(this.s, this.ci, planeId, route.id));
    if (f < 1 || !this.act({ type: 'assign', plane: planeId, route: route.id, freq: f })) return undo();
    this.opened++;
    return true;
  }

  /** 이번 차례에 본 후보 목록 (한 번만 셈한다) */
  private candList: Candidate[] | null = null;

  private candidates(): Candidate[] {
    if (this.c.routes.length >= MAX_ROUTES) return [];
    if (!this.candList) this.candList = this.bestCandidates(6);
    return this.candList;
  }

  private expand(max: number): void {
    if (max <= 0 || this.c.cash - this.reserve() < 30) return;
    const list = [...this.candidates()];
    if (list.length > 1 && this.rng() < 0.2) [list[0], list[1]] = [list[1], list[0]];
    const usedCities = new Set<string>();
    for (const cand of list) {
      if (this.opened >= max) break;
      const budget = this.c.cash - this.reserve();
      if (budget < 30) break;
      if (routeOnPair(this.c, cand.a, cand.b)) continue;
      let c2: Candidate | null = cand;
      if (usedCities.has(cand.a) || usedCities.has(cand.b)) c2 = this.evaluatePair(cand.a, cand.b, [cand.model], false);
      if (!c2 || c2.profit <= 5 / Q || c2.capital > budget) continue;
      if (this.openCandidate(c2)) {
        usedCities.add(cand.a);
        usedCities.add(cand.b);
      }
    }
  }

  private easyExpand(): void {
    if (this.c.cash < 300 || this.c.routes.length >= MAX_ROUTES) return;
    const fromHub = this.c.planes.length < 4;
    const all = this.bestCandidates(5).filter((x) => x.profit > 0);
    const hubOnly = all.filter((x) => x.a === this.c.hub || x.b === this.c.hub);
    const cands = fromHub && hubOnly.length > 0 ? hubOnly : all;
    if (cands.length === 0) return;
    const pick = cands[Math.floor(this.rng() * Math.min(2, cands.length))];
    this.openCandidate(pick, undefined, 'lease');
  }

  /** 꽉 찬 노선에 비행기를 보탠다 */
  private addCapacity(): void {
    let added = 0;
    const routes = [...this.c.routes].filter((r) => r.stats && r.stats.lf > 0.9 && r.stats.profit > 0).sort((x, y) => y.stats!.profit - x.stats!.profit);
    for (const r of routes.slice(0, 4)) {
      if (added >= 2) break;
      const budget = this.c.cash - this.reserve();
      if (budget < 30) break;
      const route = routeById(this.c, r.id)!;
      const before = this.estimate(route.id);
      let best: { m: ModelDef; freq: number; gain: number } | null = null;
      const seatsNow = this.c.planes.filter((p) => legFreq(p, route.id) > 0).map((p) => MODEL[p.model].seats);
      const avg = seatsNow.length > 0 ? seatsNow.reduce((x, y) => x + y, 0) / seatsNow.length : 150;
      for (const m of this.models()) {
        if (m.seats < avg * 0.45 || m.seats > avg * 1.6) continue;
        if (!this.fits(m, route.a, route.b)) continue;
        const max = Math.min(maxFreq(m, dist(route.a, route.b)), this.slotsLeft(route.a), this.slotsLeft(route.b));
        if (max < 1) continue;
        const after = estimateExisting(this.s, this.ci, route, { planes: this.draftOf(route.id, null, 0, { model: m.id, freq: max, fixed: newLeaseFixed(this.s, m) }) }).profit;
        const gain = after - before;
        if (gain > 8 / Q && (!best || gain > best.gain)) best = { m, freq: max, gain };
      }
      if (!best || depositFor(this.s, this.ci, best.m.id) > budget) continue;
      if (!this.act({ type: 'lease', model: best.m.id })) continue;
      const pid = this.c.planes[this.c.planes.length - 1].id;
      const f = Math.min(best.freq, bestFreq(this.s, this.ci, pid, route.id));
      if (f >= 1) this.act({ type: 'assign', plane: pid, route: route.id, freq: f });
      added++;
    }
  }

  /** 낡거나 연료를 많이 먹는 비행기를 새 기종 리스로 바꾼다 */
  private renewFleet(): void {
    let done = 0;
    const old = [...this.c.planes]
      .filter((p) => p.legs.length > 0 && (planeAge(this.s, p) >= 20 || (MODEL[p.model].end < this.year && planeAge(this.s, p) >= 12)))
      .sort((x, y) => planeAge(this.s, y) - planeAge(this.s, x));
    for (const p of old) {
      if (done >= 2) break;
      const leg = p.legs[0];
      const r = routeById(this.c, leg.route);
      if (!r) continue;
      const before = estimateExisting(this.s, this.ci, r).profit;
      let best: { m: ModelDef; profit: number } | null = null;
      for (const m of this.models()) {
        if (!this.fits(m, r.a, r.b)) continue;
        const draft = draftsOf(this.s, this.c, r.id).filter((_, i) => this.c.planes.filter((x) => legFreq(x, r.id) > 0)[i]?.id !== p.id);
        draft.push({ model: m.id, freq: Math.min(leg.freq, maxFreq(m, dist(r.a, r.b))), fixed: newLeaseFixed(this.s, m) });
        const prof = estimateExisting(this.s, this.ci, r, { planes: draft }).profit;
        if (!best || prof > best.profit) best = { m, profit: prof };
      }
      if (!best || best.profit < before + 5 / Q) continue;
      if (buyBlocker(this.s, this.ci, best.m.id, true)) continue;
      const legs = p.legs.map((l) => ({ ...l }));
      if (!this.act({ type: 'sell', plane: p.id })) continue;
      if (!this.act({ type: 'lease', model: best.m.id })) continue;
      const pid = this.c.planes[this.c.planes.length - 1].id;
      for (const l of legs) {
        const f = Math.min(l.freq, bestFreq(this.s, this.ci, pid, l.route));
        if (f >= 1) this.act({ type: 'assign', plane: pid, route: l.route, freq: f });
      }
      done++;
    }
  }

  /** 돈이 넉넉하면 많이 리스한 기종을 미리 주문해 둔다 (도착하면 리스기와 바꾼다) */
  private orderAhead(): void {
    if (this.c.orders.length >= 3) return;
    const leased = this.c.planes.filter((p) => p.leased);
    if (leased.length < 2) return;
    const count = new Map<string, number>();
    for (const p of leased) count.set(p.model, (count.get(p.model) ?? 0) + 1);
    const [model] = [...count.entries()].sort((x, y) => y[1] - x[1])[0];
    const m = MODEL[model];
    const price = orderPrice(this.s, m, this.c);
    if (this.c.cash - price < this.reserve() * 4 + 200) return;
    if (fleetCount(this.c) >= 58 || leadTime(m, this.year) > 9) return;
    this.act({ type: 'buy', model });
  }

  // ---------------------------------------------------------------- 광고·서비스·대출

  private setAds(): void {
    const rep = this.s.report?.companies[this.ci];
    if (!rep) return;
    const total = Math.max(0, rep.ticket * (this.style === 'fierce' ? 0.03 : 0.025));
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
    const want = profitable && this.c.reputation < 55 ? 4 : 3;
    if (want !== this.c.service) this.act({ type: 'setService', level: want });
  }

  private manageLoans(before: boolean): void {
    const c = this.c;
    const limit = creditLimit(this.s, this.ci);
    if (before) {
      if (this.style === 'relaxed' || c.debt > limit * 0.6) return;
      const need = this.reserve() + 150 - c.cash;
      if (need <= 0) return;
      const cands = this.candidates();
      if (cands.length === 0 || cands[0].profit < 20 / Q) return;
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
  const list = ai.bestCandidates(limit * 3, undefined, from);
  return list.filter((c) => c.profit > 0).slice(0, limit);
}

/**
 * 추천 노선을 한 번에 열기: 지점 → 노선 → 리스(또는 중고, 또는 내 비행기 번호) → 띄우기.
 * 못 하면 그대로 돌려준다
 */
export function openSuggestion(state: AirlineState, ci: number, cand: Candidate, how: 'lease' | 'used' | number = 'lease'): AirlineState {
  const ai = new Planner(state, ci, 'ai-normal', () => 0.5);
  const ok = typeof how === 'number' ? ai.openCandidate(cand, how) : ai.openCandidate(cand, undefined, how);
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
