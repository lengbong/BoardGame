import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL } from './aircraft';
import { dist } from './cities';
import { createGame, runQuarter } from './rules';
import {
  SALES_RATE,
  SST_PREMIUM,
  TAX_RATE,
  baseFare,
  computeQuarter,
  creditLimit,
  distanceFactor,
  estimateRoute,
  maxFreq,
  pairDemand,
  planeFixed,
  routeCost,
  splitMarket,
  type Offer,
} from './simulate';
import { qOf } from './time';
import type { AirlineSetup, AirlineState } from './types';

function base(era: 1963 | 1983 | 2003 = 2003): AirlineState {
  const setup: AirlineSetup = {
    seats: [
      { kind: 'human', name: '' },
      { kind: 'human', name: '' },
      { kind: 'empty', name: '' },
      { kind: 'empty', name: '' },
    ],
    options: { era, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'normal' },
    hubs: ['seoul', 'tokyo', null, null],
  };
  return createGame(setup, seededRandom(1));
}

const offer = (company: number, model: string, freq: number, fare = 0, age = 0): Offer => ({ company, fare, planes: [{ model: MODEL[model], freq, age }] });
const total = (d: { biz: number; leisure: number }) => d.biz + d.leisure;

describe('손님 수요', () => {
  it('두 도시 순서와 상관없이 같고, 시대가 지날수록 늘어난다', () => {
    const s = base();
    expect(total(pairDemand(s, 'seoul', 'tokyo'))).toBeCloseTo(total(pairDemand(s, 'tokyo', 'seoul')), 6);
    const s63 = { ...s, q: qOf(1963, 2) };
    const s23 = { ...s, q: qOf(2023, 2) };
    expect(total(pairDemand(s23, 'seoul', 'tokyo'))).toBeGreaterThan(total(pairDemand(s, 'seoul', 'tokyo')));
    expect(total(pairDemand(s, 'seoul', 'tokyo'))).toBeGreaterThan(total(pairDemand(s63, 'seoul', 'tokyo')) * 5);
    // 큰 두 도시 > 작은 두 도시
    expect(total(pairDemand(s, 'london', 'newyork'))).toBeGreaterThan(total(pairDemand(s, 'male', 'colombo')) * 3);
  });

  it('관광 성수기: 하와이는 겨울, 아테네는 여름에 관광 손님이 많다', () => {
    const s = base();
    const at = (q: number, a: string, b: string) => pairDemand({ ...s, q }, a, b).leisure;
    expect(at(qOf(2005, 1), 'tokyo', 'honolulu')).toBeGreaterThan(at(qOf(2005, 3), 'tokyo', 'honolulu') * 1.4);
    expect(at(qOf(2005, 3), 'london', 'athens')).toBeGreaterThan(at(qOf(2005, 1), 'london', 'athens') * 1.4);
    // 사업 손님은 계절을 타지 않는다 (해마다 조금씩 느는 것만)
    const b1 = pairDemand({ ...s, q: qOf(2005, 1) }, 'london', 'frankfurt').biz;
    const b3 = pairDemand({ ...s, q: qOf(2005, 3) }, 'london', 'frankfurt').biz;
    expect(Math.abs(b3 / b1 - 1)).toBeLessThan(0.03);
  });

  it('아주 가까우면 기차·차를 타서 덜 날고, 아주 멀면 덜 간다', () => {
    expect(distanceFactor(200)).toBeLessThan(distanceFactor(1000));
    expect(distanceFactor(15000)).toBeLessThan(distanceFactor(3000));
    expect(baseFare(9000, qOf(2003, 1))).toBeGreaterThan(baseFare(1000, qOf(2003, 1)) * 4);
    // 옛날 표는 더 비쌌다
    expect(baseFare(5000, qOf(1963, 1))).toBeGreaterThan(baseFare(5000, qOf(2003, 1)) * 2);
  });

  it('서울 올림픽 분기에는 서울을 오가는 손님이 크게 는다', () => {
    const s = base(1983);
    const before = total(pairDemand({ ...s, q: qOf(1987, 3) }, 'seoul', 'tokyo'));
    const during = total(pairDemand({ ...s, q: qOf(1988, 3) }, 'seoul', 'tokyo'));
    expect(during / before).toBeGreaterThan(1.5);
  });
});

describe('손님 나누기', () => {
  it('좌석보다 많이 태우지 않고, 자주 날수록 손님이 는다', () => {
    const s = base();
    const few = splitMarket(s, 'seoul', 'tokyo', [offer(0, 'b737-800', 4)])[0];
    const many = splitMarket(s, 'seoul', 'tokyo', [offer(0, 'b737-800', 20)])[0];
    expect(many.biz + many.leisure).toBeGreaterThan(few.biz + few.leisure);
    for (const r of [few, many]) expect(r.biz + r.leisure).toBeLessThanOrEqual(r.seats + 1e-6);
  });

  it('싸게 팔면 손님을 더 가져가고, 새롭고 편한 비행기가 낡은 것보다 유리하다', () => {
    const s = base();
    const [cheap, dear] = splitMarket(s, 'seoul', 'sydney', [offer(0, 'a330-300', 3, -20), offer(1, 'a330-300', 3, 20)]);
    expect(cheap.share).toBeGreaterThan(dear.share);
    const [fresh, old] = splitMarket(s, 'seoul', 'sydney', [offer(0, 'a330-300', 3, 0, 0), offer(1, 'a330-300', 3, 0, 18)]);
    expect(fresh.share).toBeGreaterThan(old.share);
  });

  it('좌석이 모자란 회사의 남은 손님 일부는 자리가 있는 회사로 간다', () => {
    const s = base();
    const alone = splitMarket(s, 'london', 'newyork', [offer(1, 'b777-200', 2)])[0];
    const [tiny, big] = splitMarket(s, 'london', 'newyork', [offer(0, 'f27', 1), offer(1, 'b777-200', 2)]);
    expect(tiny.biz + tiny.leisure).toBeCloseTo(tiny.seats, 6);
    // 작은 비행기가 있어도 큰 비행기 손님은 혼자일 때보다 크게 줄지 않는다
    expect(big.biz + big.leisure).toBeGreaterThan((alone.biz + alone.leisure) * 0.85);
  });

  it('초음속기는 표가 비싸고 사업 손님을 빨리 데려간다', () => {
    const s = { ...base(1983), q: qOf(1978, 2) };
    const [sst] = splitMarket(s, 'paris', 'newyork', [offer(0, 'concorde', 7)]);
    const fare = baseFare(dist('paris', 'newyork'), s.q);
    const perPax = (sst.revenue * 10000) / (2 * (sst.biz + sst.leisure));
    expect(perPax).toBeGreaterThan(fare * SST_PREMIUM);
    expect(sst.biz).toBeGreaterThan(sst.leisure);
  });

  it('호텔이 있으면 그 도시 노선에서 관광 손님을 더 모은다', () => {
    const s = base();
    const before = splitMarket(s, 'seoul', 'bangkok', [offer(0, 'a330-300', 5), offer(1, 'a330-300', 5)]);
    s.companies[0].businesses.push({ city: 'bangkok', kind: 'hotel', cost: 100 });
    const after = splitMarket(s, 'seoul', 'bangkok', [offer(0, 'a330-300', 5), offer(1, 'a330-300', 5)]);
    expect(after[0].leisure).toBeGreaterThan(before[0].leisure);
  });
});

describe('비용과 이익', () => {
  it('연료비는 유가에 비례하고, 낡은 비행기는 더 비싸게 난다', () => {
    const s = base();
    const planes = (age: number) => [{ model: MODEL['b737-800'], freq: 10, age, fixed: 0 }];
    const cheap = routeCost({ ...s, oil: 1 }, 0, 'seoul', 'tokyo', planes(0), 1000, 100);
    const dear = routeCost({ ...s, oil: 2 }, 0, 'seoul', 'tokyo', planes(0), 1000, 100);
    expect(dear.fuel).toBeCloseTo(cheap.fuel * 2, 6);
    const old = routeCost({ ...s, oil: 1 }, 0, 'seoul', 'tokyo', planes(20), 1000, 100);
    expect(old.crew).toBeGreaterThan(cheap.crew * 1.3);
    expect(old.fuel).toBeGreaterThan(cheap.fuel);
    expect(cheap.sales).toBeCloseTo(100 * SALES_RATE, 6);
  });

  it('긴 노선은 한 주에 덜 왕복하고, 빠른 비행기는 더 자주 왕복한다', () => {
    const d = dist('paris', 'newyork');
    expect(maxFreq(MODEL['b747-200'], d)).toBeLessThan(maxFreq(MODEL['b747-200'], dist('paris', 'london') + 600));
    expect(maxFreq(MODEL.concorde, d)).toBeGreaterThan(maxFreq(MODEL['b747-200'], d) * 1.5);
  });

  it('어림한 노선 결과는 실제 분기 계산과 같다', () => {
    let s = base();
    const c = s.companies[0];
    c.branches.push('tokyo');
    c.routes.push({ id: 50, a: 'seoul', b: 'tokyo', fare: 10, since: s.q, stats: null });
    c.planes.push({ id: 51, model: 'a321', leased: true, rent: 29, deposit: 0, since: s.q, legs: [{ route: 50, freq: 12 }] });
    s.nextId = 60;
    const est = estimateRoute(s, 0, 'seoul', 'tokyo', [{ model: 'a321', freq: 12, fixed: planeFixed(c.planes[0]) }], 10);
    const out = computeQuarter(s);
    const st = out.routeStats[0].get(50)!;
    expect(st.revenue).toBeCloseTo(est.revenue, 6);
    expect(st.profit).toBeCloseTo(est.profit, 6);
    s = runQuarter(s, seededRandom(2));
    expect(s.companies[0].routes[0].stats!.pax).toBe(Math.round(est.paxWeek * 26));
  });

  it('이익이 날 때만 법인세를 내고, 대출 한도는 내 비행기 가치에 따라 는다', () => {
    const s = base();
    s.companies[0].branches.push('tokyo');
    s.companies[0].routes.push({ id: 50, a: 'seoul', b: 'tokyo', fare: 0, since: s.q, stats: null });
    s.companies[0].planes.push({ id: 51, model: 'b737-800', leased: false, rent: 0, deposit: 0, since: s.q, legs: [{ route: 50, freq: 20 }] });
    s.nextId = 60;
    const r = computeQuarter(s).reports;
    expect(r[0].tax).toBeCloseTo(Math.max(0, (r[0].profit + r[0].tax) * TAX_RATE), 6);
    expect(r[0].tax).toBeGreaterThan(0);
    expect(r[1].tax).toBe(0);
    expect(r[1].profit).toBeLessThan(0);
    expect(creditLimit(s, 0)).toBeGreaterThan(creditLimit(s, 1));
  });
});
