import { MODEL, leadTime } from './aircraft';
import { MAX_ROUTES } from './limits';
import { CAMPAIGN_INFO, MEDIA_INFO, mediaOf } from './ads';
import { cabinPresets, sameCabin } from './cabin';
import { MAX_MEMBERS, allianceOf } from './alliances';
import { charterBlocker, charterPlaneIds, charterProfit, openCharters } from './charters';
import { checkAtOf, inCheck } from './condition';
import { countFacility, facilityBlocker, facilityCost } from './facilities';
import { TANK_LEVELS, tankBlocker, tankOf, tonPrice } from './fuel';
import { bizModelOf, planModelsFor } from './bizmodel';
import { quickValue, reachFor, skipDistance, tuneClassFares } from './aiClasses';
import { isFreighter, sizeSeats } from './freighters';
import { tradeOf } from './cargo';
import { makerPolitics, routePolitics } from './politics';
import { ACADEMY_COST, STAFF_GROUPS, hireCost, hireTime, staffNeed, staffPipe } from './staff';
import { aiChoose, allianceScore } from './choices';
import { CITIES, CITY, REGIONS, airportClass, citySize, dist, pairKey } from './cities';
import {
  applyAction,
  bestFreq,
  branchBlocker,
  buildBlocker,
  buyBlocker,
  campaignCost,
  depositFor,
  fireBlocker,
  fleetCount,
  historyOn,
  hireBlocker,
  idlePlanes,
  planeById,
  proposeBlocker,
  routeBlocker,
  routeById,
  routeOnPair,
  timesBlocker,
  usedBlocker,
} from './rules';
import {
  WEEK_HOURS,
  branchCost,
  branchUpkeep,
  businessCost,
  creditLimit,
  draftsOf,
  estimateExisting,
  estimateRoute,
  fixedShare,
  legFreq,
  legHours,
  MAX_FREQ,
  maxFreq,
  newLeaseFixed,
  orderPrice,
  planeFixed,
  pairDemand,
  planeAge,
  planeHours,
  regionsServed,
  routeFreq,
  routeIndex,
  slotCapacity,
  slotsUsed,
  spareCover,
  type DraftPlane,
} from './simulate';
import { monthOf, yearOf } from './time';
import type { AdMedia, AirlineAction, AirlineState, BusinessKind, Cabin, CampaignKind, Company, FacilityKind, ModelDef, RegionId, Rng } from './types';

export type AiLevel = 'ai-easy' | 'ai-normal';

/** 어림(달 값)을 예전 분기 기준 문턱과 견줄 때 곱하는 수 */
const Q = 3;

/**
 * 비행기가 이보다 적으면 갓 시작한 회사로 보고 새 노선을 너그럽게 연다.
 * (노선 수로 재면 비행기 한 대가 도는 작은 노선 몇 개만으로 끝나 버려서 비행기 수로 잰다)
 */
const STARTUP_PLANES = 4;

/** 한 차례에 쓸 곳을 찾아 주는 쉬는 비행기 수 */
const IDLE_PER_TURN = 30;

/** 오래 제자리인 작은 회사가 길을 트려고 받아들이는 새 노선의 달 손해 (억) */
const STUCK_LOSS = 4;

/** 그 뒤 새 노선은 이 회사 노선이 보통 버는 달 이익의 이만큼은 벌어야 연다 (많아야 원래 문턱) */
const OPEN_SHARE = 0.15;

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
  /** 새로 들이지 않고 이미 나는 이 비행기의 남는 시간으로 띄운다 (없으면 새로 리스·중고) */
  plane?: number;
}

/** 남는 비행시간이 있는 비행기 (주간 남는 시간, 나이) */
interface SparePlane {
  id: number;
  left: number;
  age: number;
}

export class Planner {
  s: AirlineState;
  actions: AirlineAction[] = [];
  readonly normal: boolean;
  private opened = 0;
  /**
   * 새 노선 후보를 이미 나는 비행기의 남는 비행시간으로도 따져 볼지.
   * 보통 컴퓨터가 직접 경영할 때(run)만 켠다. 사람에게 보여 주는 추천 노선은 새 비행기를 들이는 기준 그대로.
   */
  private fillSpare = false;

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
    return r.fuel + r.crew + r.airport + r.service + r.sales + r.lease + r.fleet + r.branch + r.ads + r.interest + r.disrupt + r.staff;
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
    this.fillSpare = this.normal;
    this.decide();
    this.emergency();
    this.manageStaff();
    this.takeCharters();
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
      this.addSharedPlane();
      this.renewFleet();
      this.orderAhead();
      this.setAds();
      this.configureCabins();
      this.setMeals();
      this.buildBusinesses();
      this.buildFacilities();
      this.setOps();
      this.manageFuel();
      this.tuneTimes();
      this.maybePropose();
      this.manageLoans(false);
    } else {
      this.easyExpand();
      this.easyAds();
      if (this.c.cash > 1500 && this.c.debt > 0) this.act({ type: 'repay', amount: Math.min(this.c.debt, this.c.cash - 1000) });
    }
  }

  /**
   * 직원: 필요한 사람에 앞으로 늘 비행기 몫을 더해 미리 뽑는다 (조종사는 다섯 달 걸린다).
   * 보통 컴퓨터는 만족도가 낮으면 임금을 올리고, 비행기가 많으면 훈련원을 세운다.
   */
  private manageStaff(): void {
    const c = this.c;
    const need = staffNeed(this.s, c);
    const flying = Math.max(1, c.planes.filter((p) => p.legs.length > 0).length);
    // 분기마다 늘 비행기 수: 첫해는 성향대로, 그 뒤로는 지난 한 해 실제로 들인 만큼만 (그보다 많이는 아니게).
    // 늘지 않는 작은 회사가 오지 않을 비행기 몫 사람을 계속 쌓아 두고 임금만 내지 않게.
    const assumed = this.normal ? Math.max(1, this.maxNewRoutes()) : 0.5;
    const recent = c.planes.filter((p) => p.since >= this.s.t - 12).length / 4;
    const growth = this.s.t - this.s.startT >= 12 ? Math.min(assumed, Math.max(0.25, recent)) : assumed;
    for (const g of STAFF_GROUPS) {
      const st = c.staff[g];
      const supply = st.have + staffPipe(c, g);
      const perPlane = c.planes.length > 0 ? need[g] / flying : { pilot: 11, cabin: 20, tech: 6, ground: 4 }[g];
      const lead = hireTime(c, g, false);
      const dueSoon = c.orders.filter((o) => o.due <= this.s.t + lead).length;
      const buffer = { pilot: 0.15, cabin: 0.1, tech: 0.08, ground: 0.05 }[g];
      const target = Math.ceil(need[g] * (1 + buffer) + perPlane * (growth * (lead / 3) + dueSoon) + (g === 'pilot' ? 4 : 0));
      if (supply < target) {
        const n = Math.min(400, target - supply);
        const fast = st.have < need[g];
        if (n >= 1 && !hireBlocker(this.s, this.ci, g, n, fast) && c.cash - hireCost(this.s, c, g, n, fast) > 20) this.act({ type: 'hire', group: g, n, fast });
      } else if (this.normal && this.planning && c.planes.length >= 1 && this.s.t - this.s.startT >= 12 && st.have > target * 1.3 + 4 && st.pipe.length === 0) {
        // 사람이 많이 남을 때만 (시작한 첫해·비행기가 없을 때는 내보내지 않는다).
        // 남은 사람들이 크게 서운하지 않게 한 번에 그 직군의 15%까지만 조금씩.
        const n = Math.min(Math.floor(st.have - target * 1.15), Math.ceil(st.have * 0.15));
        if (n >= 3 && !fireBlocker(this.s, this.ci, g, n)) this.act({ type: 'fire', group: g, n });
      }
    }
    if (!this.normal) return;
    // 임금: 만족도가 낮으면 운항 인력부터 올리고, 아주 높으면 천천히 내린다
    for (const g of ['pilot', 'cabin'] as const) {
      const pay = c.staff[g].pay;
      if (c.morale < 50 && pay < 1.15) this.act({ type: 'setPay', group: g, level: Math.round((pay + 0.05) * 100) / 100 });
      else if (c.morale > 78 && pay > 1) this.act({ type: 'setPay', group: g, level: Math.round((pay - 0.05) * 100) / 100 });
    }
    if (this.planning && !c.academy && c.planes.length >= 18 && c.cash > this.reserve() * 3 + ACADEMY_COST) this.act({ type: 'buildAcademy' });
  }

  /** 시간대: 계획하는 달마다 노선 두세 개씩 더 나은 시간대로 */
  private tuneTimes(): void {
    const routes = this.c.routes.filter((r) => (r.id + this.s.q) % 4 === 0).slice(0, 3);
    for (const r of routes) {
      const b = bestTimes(this.s, this.ci, r.id);
      if (b && b.gain > 0.5) this.act({ type: 'setTimes', route: r.id, times: b.times });
    }
  }

  /** 아주 꽉 차거나 많이 빈 노선만 운임을 한 칸 고친다 */
  private quickFares(): void {
    const lcc = bizModelOf(this.c) === 'lcc';
    const cap = lcc ? 10 : this.style === 'relaxed' ? 10 : this.normal ? 25 : 15;
    const floor = lcc ? -30 : -25;
    for (const r of this.c.routes) {
      const st = r.stats;
      if (!st || st.pax <= 0) continue;
      if (st.lf > 0.985 && r.fare + 5 <= cap) this.act({ type: 'setFare', route: r.id, fare: r.fare + 5 });
      else if (st.lf < 0.5 && r.fare - 5 >= floor) this.act({ type: 'setFare', route: r.id, fare: r.fare - 5 });
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
    // C점검 시점: 돈이 급하면 늦게. 지연·결항이 잦아도 일찍 점검하는 건 예비기가 점검 동안 대신 날 때만
    // (비행기 몇 대뿐인 회사는 점검하는 달마다 그 노선이 비어 버린다)
    const at = c.crisis > 0 || c.cash < this.reserve() ? 35 : c.onTime < 0.8 && spareCover(c) >= 0.5 ? 65 : 50;
    if (at !== checkAtOf(c)) this.act({ type: 'setCheckAt', at });
  }

  /**
   * 연료 탱크: 한 달에 쓰는 연료의 두 달 치(치열 석 달, 느긋 한 달 반)쯤 담을 크기까지 키우고,
   * 유가가 '보통 값'보다 꽤 싸면 저절로 채우게 해 둔다 (치열할수록 덜 싸도 산다).
   */
  private manageFuel(): void {
    const tons = this.s.report?.companies[this.ci]?.fuelTons ?? 0;
    if (tons <= 0) return;
    const months = this.style === 'fierce' ? 3 : this.style === 'relaxed' ? 1.5 : 2;
    const t = tankOf(this.c);
    const next = TANK_LEVELS[t.level + 1];
    // 노선을 늘리는 쪽이 훨씬 많이 버니, 돈이 아주 넉넉할 때만 짓는다
    if (next && TANK_LEVELS[t.level].cap < tons * months && !tankBlocker(this.s, this.ci) && this.c.cash - next.cost > this.reserve() * 8 + 400) this.act({ type: 'buildTank' });
    const want = this.style === 'fierce' ? 0.95 : this.style === 'relaxed' ? 0.85 : 0.9;
    if (tankOf(this.c).level > 0 && tankOf(this.c).auto !== want) this.act({ type: 'setFuelAuto', ratio: want });
  }

  // ---------------------------------------------------------------- 결정 사건

  private decide(): void {
    const ch = this.c.choice;
    if (!ch) return;
    const k = aiChoose(ch, this.c.cash, this.reserve(), !this.normal, this.rng);
    if (!this.act({ type: 'choose', option: k })) this.act({ type: 'choose', option: ch.options.length - 1 });
  }

  private maybePropose(): void {
    const al = allianceOf(this.s, this.ci);
    if ((al && al.members.length >= MAX_MEMBERS) || this.s.q - this.s.startQ < 8 || this.rng() > 0.12) return;
    let best = -1;
    let score = 1;
    this.s.companies.forEach((t, ti) => {
      if (ti === this.ci || t.out) return;
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
    // 이번 달 C점검은 미룬다 (점검 값을 아끼고 비행기를 띄운다)
    for (const p of [...this.c.planes]) if (this.c.cash < 0 && inCheck(p, this.s.t)) this.act({ type: 'checkPlane', plane: p.id, on: false });
    // 사 둔 연료를 팔아 급한 돈을 마련한다
    const stock = tankOf(this.c).stock;
    if (this.c.cash < 0 && stock >= 1) this.act({ type: 'sellFuel', tons: Math.floor(Math.min(stock, (-this.c.cash + 20) / (tonPrice(this.s.oil) * 0.9))) || Math.floor(stock) });
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
    const lcc = bizModelOf(this.c) === 'lcc';
    const fareCap = lcc ? 10 : this.style === 'relaxed' ? 10 : 25;
    const fareFloor = lcc ? -30 : -25;
    for (const r0 of [...this.c.routes]) {
      const r = routeById(this.c, r0.id);
      if (!r) continue;
      const planes = this.c.planes.filter((p) => legFreq(p, r.id) > 0);
      const st = r.stats;
      if (planes.length === 0) {
        if (this.s.t - r.since >= 6) this.act({ type: 'closeRoute', route: r.id });
        continue;
      }
      // 비즈니스석·일등석·화물 운임 (aiClasses.ts)
      tuneClassFares(this, r.id, (this.s.q + r.id) % 12 === 0);
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
        if (f < fareFloor || f > fareCap) continue;
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
    // 쓸 곳을 찾지 못한 기종(내 것·리스 따로)은 같은 차례에 다시 찾지 않는다.
    // 손님이 크게 줄어 노선을 많이 닫은 뒤에는 쉬는 비행기가 백 대 넘게 생겨, 같은 기종마다 같은 계산을 되풀이하느라 한 차례가 0.5초 가까이 걸렸다.
    const useless = new Set<string>();
    // 한 차례에 살펴보는 쉬는 비행기 수 (나머지는 다음 달에). 큰 사건 뒤 노선망을 한꺼번에 되살리면
    // 한 차례에 노선 80개를 여느라 화면이 멈춘 듯했다. 몇 달에 걸쳐 되살리는 편이 실제와도 비슷하다
    let budget = IDLE_PER_TURN;
    const chartered = charterPlaneIds(this.s, this.ci);
    for (const p0 of idlePlanes(this.c)) {
      const p = planeById(this.c, p0.id);
      if (!p || chartered.has(p.id)) continue;
      const m = MODEL[p.model];
      if (spares > 0 && !p.leased && planeAge(this.s, p) < 22) {
        spares--;
        continue;
      }
      if (budget-- <= 0) break;
      const key = `${p.model}|${p.leased}`;
      if (!useless.has(key)) {
        const best = this.bestExistingLeg(p.id, false);
        if (best && best.gain > -planeFixed(p) * 0.3) {
          this.act({ type: 'assign', plane: p.id, route: best.route, freq: best.freq });
          continue;
        }
        // 새 노선에 써 보기
        const cand = this.c.routes.length < MAX_ROUTES ? this.bestCandidates(6, m).find((x) => x.model.id === m.id && x.profit > 0) : undefined;
        if (cand && this.openCandidate(cand, p.id)) continue;
        useless.add(key);
      }
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
    const lease = this.c.planes.find((x) => x.leased && x.legs.length > 0 && MODEL[x.model].family === m.family && isFreighter(MODEL[x.model]) === isFreighter(m) && Math.abs(sizeSeats(MODEL[x.model]) - sizeSeats(m)) < sizeSeats(m) * 0.3);
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

  /**
   * 전세기 의뢰: 쉬는 비행기로 남는 의뢰가 있으면 맡는다 (한 차례에 두 건까지, 쉬움은 많이 남을 때만).
   * 쉬는 비행기는 예비기이기도 해서, 보수의 일부는 남아야 맡는다.
   */
  private takeCharters(): void {
    const offers = openCharters(this.s);
    if (offers.length === 0) return;
    for (let k = 0; k < 2; k++) {
      let best: { offer: number; plane: number; profit: number } | null = null;
      const busy = charterPlaneIds(this.s, this.ci);
      for (const o of openCharters(this.s)) {
        for (const p of this.c.planes) {
          if (p.legs.length > 0 || busy.has(p.id) || charterBlocker(this.s, this.ci, o.id, p.id)) continue;
          const profit = charterProfit(this.s, this.ci, o, p);
          const need = Math.max(2, o.pay * (this.normal ? 0.15 : 0.3));
          if (profit > need && (!best || profit > best.profit)) best = { offer: o.id, plane: p.id, profit };
        }
      }
      if (!best || !this.act({ type: 'charter', offer: best.offer, plane: best.plane })) return;
    }
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

  private modelMemo: ModelDef[] | null = null;

  /** 살 수 있는 기종 (냉전 중 막힌 제작국 기종은 뺀다) */
  private models(): ModelDef[] {
    if (!this.modelMemo) {
      const history = historyOn(this.s);
      // 사업 모델에 맞는 기종 (풀서비스 컴퓨터는 여객기만 노선 후보로 본다: bizmodel.ts)
      this.modelMemo = planModelsFor(this.c, this.year).filter((m) => !history || !makerPolitics(this.c.hub, m, this.year));
    }
    return this.modelMemo;
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
    const quick: { a: string; b: string; v: number; d: number }[] = [];
    const seen = new Set<string>();
    const hubRoutes = c.routes.filter((r) => r.a === c.hub || r.b === c.hub).length;
    const history = historyOn(this.s);
    for (const a of origins) {
      if (this.slotsLeft(a) < 2) continue;
      // 이 공항 활주로에 내릴 수 있는 기종만 본다 (작은 공항에서 못 띄우는 장거리 기종의 거리로 후보 자리를 채우지 않게)
      const fromA = models.filter((m) => airportClass(CITY[a], year) >= m.runway);
      const maxRange = Math.max(0, ...fromA.map((m) => m.range));
      for (const city of CITIES) {
        const b = city.id;
        if (b === a) continue;
        const key = pairKey(a, b);
        if (seen.has(key) || routeOnPair(c, a, b)) continue;
        seen.add(key);
        const d = dist(a, b);
        if (d < 300 || d > maxRange) continue;
        if (history && routePolitics(c.hub, a, b, year)) continue;
        if (!fromA.some((m) => this.fits(m, a, b))) continue;
        if (!this.normal && d > 6500) continue;
        if (skipDistance(c, d)) continue;
        if (this.slotsLeft(b) < 2) continue;
        let v = quickValue(this.s, c, a, b, d);
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
    /** spare: 이미 나는 비행기로 띄우면 리스료·보증금이 새로 들지 않는다 */
    const tryOne = (m: ModelDef, freq: number, spare?: SparePlane) => {
      const e = estimateRoute(this.s, this.ci, a, b, [{ model: m.id, freq, age: spare?.age ?? 0, fixed: spare ? 0 : newLeaseFixed(this.s, m) }], 0);
      const profit = e.profit * hubBonus - upkeep;
      const capital = branchMoney + (spare ? 0 : depositFor(this.s, this.ci, m.id));
      let score = profit * (0.7 + 0.3 * Math.min(1, e.lf / 0.8));
      if (newRegion) score += Math.max(30 / Q, e.revenue * 0.25);
      if (!this.normal) score = profit;
      if (!best || score > best.score) best = { a, b, model: m, freq, fare: 0, profit, capital, needBranch, score, plane: spare?.id };
      return score;
    };
    for (const m of models) {
      if (!this.fits(m, a, b)) continue;
      const max = Math.min(maxFreq(m, d), slotLimit);
      if (max < 1) continue;
      // 한 편에 싣는 양(좌석·화물 톤)에 견준 손님·짐 (aiClasses.ts)
      const rf = isFreighter(m) ? reachFor(this.s, m, a, b) : { unit: m.seats, reach };
      if (rf.unit > rf.reach * 1.3 && models.length > 1) continue;
      const fit = Math.max(1, Math.min(max, Math.round(rf.reach / rf.unit)));
      first.push({ m, max, fit, score: tryOne(m, fit) });
    }
    // 2단계: 좋은 기종 몇 개만 다른 횟수도 본다
    first.sort((x, y) => y.score - x.score);
    for (const x of first.slice(0, this.normal ? 2 : 1)) {
      const freqs = this.normal ? [x.max, Math.max(1, Math.round((x.max + x.fit) / 2))] : [x.max];
      for (const f of new Set(freqs)) if (f !== x.fit) tryOne(x.m, f);
    }
    // 3단계: 이미 나는 비행기의 남는 비행시간으로. 손님이 적어 주 몇 번이면 되는 노선은
    // 비행기 한 대를 새로 리스하면 리스료를 못 벌지만, 한 대로 여러 노선을 돌면 이익이 난다.
    if (this.fillSpare) {
      for (const m of models) {
        const spare = this.sparePlanes().get(m.id);
        if (!spare || !this.fits(m, a, b)) continue;
        const max = Math.min(MAX_FREQ, slotLimit, Math.floor(spare.left / (2 * legHours(m, d)) + 1e-9));
        if (max < 1) continue;
        const rf = isFreighter(m) ? reachFor(this.s, m, a, b) : { unit: m.seats, reach };
        const fit = Math.max(1, Math.min(max, Math.round(rf.reach / rf.unit)));
        for (const f of new Set([fit, max])) tryOne(m, f, spare);
      }
    }
    return best;
  }

  /** 기종마다 남는 비행시간이 가장 많은 (노선을 나는) 비행기. 같은 상태면 다시 세지 않는다 */
  private spareMemo: { state: AirlineState; byModel: Map<string, SparePlane> } | null = null;

  private sparePlanes(): Map<string, SparePlane> {
    if (!this.spareMemo || this.spareMemo.state !== this.s) {
      const byModel = new Map<string, SparePlane>();
      for (const p of this.c.planes) {
        if (p.legs.length === 0) continue;
        const left = WEEK_HOURS - planeHours(this.c, p);
        const cur = byModel.get(p.model);
        if (!cur || left > cur.left) byModel.set(p.model, { id: p.id, left, age: planeAge(this.s, p) });
      }
      this.spareMemo = { state: this.s, byModel };
    }
    return this.spareMemo.byModel;
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
    // 후보가 이미 나는 비행기의 남는 시간으로 어림한 것이면 그 비행기로 (스스로 고를 때만)
    let planeId = plane ?? (how === 'auto' ? cand.plane : undefined);
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

  /**
   * 이 후보를 열려면 넘어야 하는 달 이익 어림 (새 지점 유지비까지 뺀 값).
   * - 비행기가 몇 대 없는 갓 시작한 회사는 본사 유지비와 직원 임금을 어차피 내고 있으니,
   *   노선 자체가 비행 비용과 리스료를 벌면(새 지점 유지비는 아직 못 벌어도) 연다.
   *   손님이 적은 지역(1960년대 동남아처럼)에서도 첫해부터 노선망을 짜기 시작하고,
   *   외딴 본사(요하네스버그·뭄바이처럼)도 큰 도시에 지점을 내 거기서 노선을 늘릴 길이 생긴다.
   * - 그 뒤 문턱은 회사 크기에 맞춘다: 이 회사 노선이 보통 버는 이익의 일부, 많아야 원래 문턱(달 5/3).
   *   노선마다 많이 버는 큰 회사는 그대로이고, 노선 하나가 달 2~3쯤 버는 작은 회사는
   *   그만한 크기의 노선도 열어서 노선망과 갈아타는 손님을 키운다 (예전에는 노선 4개에서 15년 멈췄다).
   */
  private minOpenProfit(cand: Candidate): number {
    if (this.c.planes.length < STARTUP_PLANES) {
      const upkeep = cand.needBranch.reduce((sum, city) => sum + branchUpkeep(city, this.s.q), 0);
      // 두 해 넘게 노선 한두 개에 머문 작은 회사는 돈이 넉넉하면 조금 손해 보는 노선도 열어 길을 튼다
      // (외딴 본사는 첫 장거리 노선이 문턱 언저리라, 문턱을 넘느냐가 판마다 운에 달려 있었다)
      const stuck = this.s.t - this.s.startT >= 24 && this.c.routes.length <= 2 && this.c.cash > 1000;
      return -upkeep - (stuck ? STUCK_LOSS : 0);
    }
    return this.minGain(5 / Q);
  }

  /** 회사 크기에 맞춘 문턱: 원래 문턱(base)과 이 회사 노선이 보통 버는 달 이익의 일부 가운데 작은 쪽 */
  private minGain(base: number): number {
    return Math.min(base, OPEN_SHARE * this.typicalRouteProfit());
  }

  /** 이 회사 노선 하나가 보통 버는 달 이익 (지난달 노선 이익의 가운데 값, 손해는 0으로). 아직 실적이 없으면 무한대 */
  private typicalRouteProfit(): number {
    const profits = this.c.routes.filter((r) => r.stats).map((r) => Math.max(0, r.stats!.profit));
    if (profits.length === 0) return Infinity;
    profits.sort((x, y) => x - y);
    return profits[Math.floor(profits.length / 2)];
  }

  private expand(max: number): void {
    if (max <= 0 || this.c.cash - this.reserve() < 30) return;
    // 화물 전문인데 갈 곳이 마땅치 않으면 짐이 많은 무역 도시에 지점부터
    if (bizModelOf(this.c) === 'cargo' && this.c.routes.length < 2 && !this.candidates().some((x) => x.profit > 0)) {
      const year = this.year;
      const city = CITIES.filter((x) => !this.c.branches.includes(x.id) && !branchBlocker(this.s, this.ci, x.id)).sort((x, y) => tradeOf(y.id) * citySize(y, year) - tradeOf(x.id) * citySize(x, year))[0];
      if (city && this.act({ type: 'openBranch', city: city.id })) this.candList = null;
    }
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
      if (!c2 || c2.profit <= this.minOpenProfit(c2) || c2.capital > budget) continue;
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
      const onRoute = this.c.planes.filter((p) => legFreq(p, route.id) > 0).map((p) => MODEL[p.model]);
      const cargoOnly = onRoute.length > 0 && onRoute.every(isFreighter);
      const seatsNow = onRoute.map(sizeSeats);
      const avg = seatsNow.length > 0 ? seatsNow.reduce((x, y) => x + y, 0) / seatsNow.length : 150;
      for (const m of this.models()) {
        if (isFreighter(m) !== cargoOnly) continue;
        if (sizeSeats(m) < avg * 0.45 || sizeSeats(m) > avg * 1.6) continue;
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

  /**
   * 꽉 찬 노선 여러 개에 비행기 한 대를 나눠 띄운다.
   * 손님이 적은 노선은 하나만으로는 새 비행기 리스료를 못 벌어 addCapacity가 보태지 않지만,
   * 한 대가 꽉 찬 노선 몇 개를 주 몇 번씩 돌면 번다. 실제로 리스해 이익이 가장 많이 느는 노선부터
   * 횟수를 나눠 주고, 늘어난 이익 합이 리스료보다 넉넉히 크지 않으면 되돌린다.
   */
  private addSharedPlane(): void {
    const full = this.c.routes
      .filter((r) => r.stats && r.stats.lf > 0.9 && r.stats.profit > 0)
      .sort((x, y) => y.stats!.profit - x.stats!.profit)
      .slice(0, 8);
    if (full.length < 2) return;
    // 꽉 찬 노선을 지금 나는 기종 (많이 쓰는 것부터 둘)
    const count = new Map<string, number>();
    for (const r of full) for (const p of this.c.planes) if (legFreq(p, r.id) > 0) count.set(p.model, (count.get(p.model) ?? 0) + 1);
    const models = [...count.entries()].sort((x, y) => y[1] - x[1]).slice(0, 2).map(([id]) => MODEL[id]);
    for (const m of models) {
      if (depositFor(this.s, this.ci, m.id) > this.c.cash - this.reserve() - 30) continue;
      const before = this.s;
      const beforeActions = this.actions.length;
      if (!this.act({ type: 'lease', model: m.id })) continue;
      const plane = this.c.planes[this.c.planes.length - 1];
      let gain = 0;
      for (let legs = 0; legs < 4; legs++) {
        let best: { route: number; freq: number; gain: number } | null = null;
        for (const r0 of full) {
          const r = routeById(this.c, r0.id);
          if (!r || legFreq(planeById(this.c, plane.id)!, r.id) > 0) continue;
          const max = bestFreq(this.s, this.ci, plane.id, r.id);
          if (max < 1) continue;
          const now = this.estimate(r.id);
          for (const f of new Set([1, 2, Math.max(1, Math.round(max / 2)), max])) {
            if (f > max) continue;
            const after = estimateExisting(this.s, this.ci, r, { planes: this.draftOf(r.id, null, 0, { model: m.id, freq: f, age: 0, fixed: 0 }) }).profit;
            if (after - now > 0.05 && (!best || after - now > best.gain)) best = { route: r.id, freq: f, gain: after - now };
          }
        }
        if (!best || !this.act({ type: 'assign', plane: plane.id, route: best.route, freq: best.freq })) break;
        gain += best.gain;
      }
      if (gain - planeFixed(plane) > this.minGain(8 / Q)) return;
      this.s = before;
      this.actions.length = beforeActions;
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

  /** 지역 손님 가운데 사업 손님이 많으면 신문, 관광 손님이 많으면 여행 잡지, 아니면 TV(인터넷이 나오면 인터넷) */
  private setMedia(): void {
    const year = this.year;
    for (const region of REGIONS) {
      if (this.c.ads[region] <= 0) continue;
      let biz = 0;
      let all = 0;
      for (const r of this.c.routes) {
        if (CITY[r.a].region !== region && CITY[r.b].region !== region) continue;
        const d = pairDemand(this.s, r.a, r.b);
        biz += d.biz;
        all += d.biz + d.leisure;
      }
      const share = all > 0 ? biz / all : 0.4;
      const want: AdMedia = share > 0.52 ? 'newspaper' : share < 0.3 ? 'magazine' : year >= MEDIA_INFO.internet.from ? 'internet' : 'tv';
      if (mediaOf(this.c, region) !== want) this.act({ type: 'setMedia', region, media: want });
    }
  }

  /** 치열한 회사는 돈이 넉넉하면 해마다 7월에 캠페인 */
  private maybeCampaign(): void {
    if (this.style !== 'fierce' || monthOf(this.s.t) !== 7) return;
    const kind: CampaignKind = this.year >= CAMPAIGN_INFO.miles.from ? 'miles' : 'lucky';
    if (this.c.cash - this.reserve() < campaignCost(this.s, kind) * 5) return;
    this.act({ type: 'campaign', kind });
  }

  private setAds(): void {
    this.setMedia();
    this.maybeCampaign();
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

  /** 돈이 넉넉하면 해마다 4월에, 노선이 많은 도시에 부대사업 하나 */
  private buildBusinesses(): void {
    if (monthOf(this.s.t) !== 4 || this.style === 'relaxed') return;
    const count = new Map<string, number>();
    for (const r of this.c.routes) for (const x of [r.a, r.b]) count.set(x, (count.get(x) ?? 0) + routeFreq(this.c, r.id));
    const cities = [...count.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([city]) => city);
    const prefer: BusinessKind[] = ['resort', 'hotel', 'bus', 'agency', 'ski', 'park', 'store', 'restaurant'];
    for (const city of cities) {
      for (const kind of prefer) {
        if (buildBlocker(this.s, this.ci, city, kind)) continue;
        const cost = businessCost(city, kind, this.s.q);
        if (this.c.cash - this.reserve() < cost * 4) continue;
        if (kind === 'hotel' && CITY[city].fun < 6) continue;
        if (this.act({ type: 'build', city, kind })) return;
      }
    }
  }

  /**
   * 공항 시설 (해마다 10월, 돈이 넉넉할 때 하나씩):
   * 본사 슬롯이 거의 찼으면 전용 터미널, 비행기가 열다섯 대 넘으면 정비 기지,
   * 사업 손님이 많은 본사·큰 거점에는 라운지.
   */
  private buildFacilities(): void {
    if (monthOf(this.s.t) !== 10 || this.style === 'relaxed') return;
    const c = this.c;
    const spare = (cost: number) => c.cash - this.reserve() * 4 - 200 > cost * 2;
    const tryBuild = (city: string, kind: FacilityKind) => {
      if (facilityBlocker(this.s, this.ci, city, kind)) return false;
      if (!spare(facilityCost(city, kind, this.s.q))) return false;
      return this.act({ type: 'buildFacility', city, kind });
    };
    if (slotsUsed(c, c.hub) > slotCapacity(this.s, this.ci, c.hub) * 0.85 && tryBuild(c.hub, 'terminal')) return;
    if (c.planes.length >= 15 && countFacility(c, 'base') === 0 && tryBuild(c.hub, 'base')) return;
    // 라운지: 본사부터, 그다음 노선이 많은 사업 도시
    const count = new Map<string, number>();
    for (const r of c.routes) for (const x of [r.a, r.b]) count.set(x, (count.get(x) ?? 0) + routeFreq(c, r.id));
    const cities = [c.hub, ...[...count.entries()].sort((x, y) => y[1] - x[1]).map(([city]) => city)].filter((x, i, a) => a.indexOf(x) === i && CITY[x].biz >= 0.45);
    for (const city of cities.slice(0, 4)) if (c.planes.length >= 6 && tryBuild(city, 'lounge')) return;
  }

  /** 비행기가 나는 노선들의 평균 거리와 사업 손님 비율 (왕복 수 가중) */
  private planeMix(planeId: number): { d: number; biz: number } | null {
    const p = planeById(this.c, planeId);
    if (!p || p.legs.length === 0) return null;
    let w = 0;
    let d = 0;
    let biz = 0;
    for (const l of p.legs) {
      const r = routeById(this.c, l.route);
      if (!r) continue;
      const dem = pairDemand(this.s, r.a, r.b);
      const tot = dem.biz + dem.leisure;
      w += l.freq;
      d += dist(r.a, r.b) * l.freq;
      biz += (tot > 0 ? dem.biz / tot : 0.4) * l.freq;
    }
    return w > 0 ? { d: d / w, biz: biz / w } : null;
  }

  /** 새로 받은 비행기는 (공짜로 바꿀 수 있을 때) 노선 이익이 가장 큰 좌석 배치로 */
  private configureCabins(): void {
    if (bizModelOf(this.c) !== 'full') return;
    for (const p0 of this.c.planes) {
      if ((p0.got ?? p0.since) !== this.s.t || p0.legs.length === 0 || isFreighter(MODEL[p0.model])) continue;
      const presets = cabinPresets(MODEL[p0.model]);
      if (presets.length === 0) continue;
      const profitWith = (cabin: Cabin) => {
        let sum = 0;
        for (const l of p0.legs) {
          const route = routeById(this.c, l.route);
          if (!route) continue;
          const planes: DraftPlane[] = [];
          for (const q of this.c.planes) {
            const f = legFreq(q, route.id);
            if (f > 0) planes.push({ model: q.model, freq: f, age: planeAge(this.s, q), fixed: fixedShare(this.c, q, route.id), cabin: q.id === p0.id ? cabin : q.cabin, meal: q.meal });
          }
          sum += estimateExisting(this.s, this.ci, route, { planes }).profit;
        }
        return sum;
      };
      const now = profitWith(p0.cabin);
      let best: { cabin: Cabin; profit: number } = { cabin: p0.cabin, profit: now };
      for (const pr of presets) {
        if (sameCabin(pr.cabin, p0.cabin)) continue;
        const v = profitWith(pr.cabin);
        if (v > best.profit + Math.abs(now) * 0.01 + 0.5) best = { cabin: pr.cabin, profit: v };
      }
      if (!sameCabin(best.cabin, p0.cabin)) this.act({ type: 'setCabin', plane: p0.id, cabin: best.cabin });
    }
  }

  /** 기내식: 짧은 노선은 간식, 먼 노선은 좋은 식사 (평판이 낮고 돈을 벌면 한 단계 더) */
  private setMeals(): void {
    const rep = this.s.report?.companies[this.ci];
    const boost = !!rep && rep.profit > 0 && this.c.reputation < 55 ? 1 : 0;
    for (const p0 of this.c.planes) {
      const mix = isFreighter(MODEL[p0.model]) ? null : this.planeMix(p0.id);
      if (!mix) continue;
      const want = bizModelOf(this.c) === 'lcc' ? 1 : Math.min(5, (mix.d < 1200 ? 2 : mix.d < 4500 ? 3 : 4) + boost);
      if (want !== p0.meal) this.act({ type: 'setMeal', plane: p0.id, level: want });
    }
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

const TIME_OPTIONS: [number, number, number, number][] = [
  [4, 1, 4, 0],
  [3, 2, 4, 0],
  [3, 3, 3, 0],
  [2, 4, 3, 0],
  [2, 2, 3, 2],
  [1, 2, 3, 3],
];

/** 이 노선에 가장 좋은 시간대 나누기 (밤 운항 금지·시간대 슬롯 안에서). 지금보다 나은 것이 없으면 null */
export function bestTimes(state: AirlineState, ci: number, routeId: number): { times: [number, number, number, number]; gain: number } | null {
  const c = state.companies[ci];
  const r = routeById(c, routeId);
  if (!r || c.planes.every((p) => legFreq(p, r.id) === 0)) return null;
  const now = estimateExisting(state, ci, r).profit;
  let best: { times: [number, number, number, number]; gain: number } | null = null;
  for (const t of TIME_OPTIONS) {
    if (t.every((x, i) => x === r.times[i]) || timesBlocker(state, ci, r.id, t)) continue;
    const gain = estimateExisting(state, ci, r, { times: t }).profit - now;
    if (!best || gain > best.gain) best = { times: t, gain };
  }
  return best && best.gain > 0.05 ? best : null;
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
