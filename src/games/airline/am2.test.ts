import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL } from './aircraft';
import { MEDIA_INFO } from './ads';
import { BUSINESS_INFO, BUSINESS_KINDS } from './business';
import { CITY } from './cities';
import { applyAction, buildBlocker, campaignBlocker, campaignCost, createGame } from './rules';
import { splitMarket } from './simulate';
import type { AirlineSetup, AirlineState } from './types';

function game(era: 1963 | 1983 | 2003 = 2003): AirlineState {
  const setup: AirlineSetup = {
    seats: [
      { kind: 'human', name: '' },
      { kind: 'human', name: '' },
      { kind: 'empty', name: '' },
      { kind: 'empty', name: '' },
    ],
    options: { era, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'rich', challenge: null, aiStyle: 'normal', names: 'fictional' },
    hubs: ['seoul', 'tokyo', null, null],
    airlines: [null, null, null, null],
  };
  const s = createGame(setup, seededRandom(1));
  s.companies[0].cash = 1e5;
  return s;
}

describe('부대사업', () => {
  it('여덟 가지 사업은 이름·그림·설명이 있고, 세우는 값이 양수다', () => {
    expect(BUSINESS_KINDS.length).toBe(8);
    for (const k of BUSINESS_KINDS) {
      const info = BUSINESS_INFO[k];
      expect(info.name.length).toBeGreaterThan(0);
      expect(info.desc.length).toBeGreaterThan(5);
      expect(info.cost(CITY.seoul, 8)).toBeGreaterThan(0);
    }
  });

  it('도시에 맞는 사업만 세운다 (스키장은 산 가까이, 리조트는 관광지, 백화점은 큰 도시)', () => {
    let s = game();
    for (const city of ['jeju', 'zurich', 'guam']) s = applyAction(s, { type: 'openBranch', city });
    expect(buildBlocker(s, 0, 'zurich', 'ski')).toBeNull();
    expect(buildBlocker(s, 0, 'guam', 'ski')).toContain('산');
    expect(buildBlocker(s, 0, 'jeju', 'resort')).toBeNull();
    expect(buildBlocker(s, 0, 'seoul', 'store')).toBeNull();
    expect(buildBlocker(s, 0, 'guam', 'store')).toContain('큰 도시');
    expect(buildBlocker(s, 0, 'busan', 'bus')).toContain('지점');
    const cash = s.companies[0].cash;
    s = applyAction(s, { type: 'build', city: 'zurich', kind: 'ski' });
    expect(s.companies[0].businesses.some((b) => b.kind === 'ski' && b.city === 'zurich')).toBe(true);
    expect(s.companies[0].cash).toBeLessThan(cash);
    expect(buildBlocker(s, 0, 'zurich', 'ski')).toBe('이미 있어요');
  });

  it('부대사업은 그 도시 노선의 손님을 늘린다', () => {
    let s = game();
    s = applyAction(s, { type: 'openBranch', city: 'jeju' });
    const run = (t: AirlineState) => splitMarket(t, 'seoul', 'jeju', [{ company: 0, fare: 0, planes: [{ model: MODEL.a320, freq: 14, age: 0 }] }])[0];
    const before = run(s);
    s = applyAction(s, { type: 'build', city: 'jeju', kind: 'resort' });
    expect(run(s).leisure).toBeGreaterThan(before.leisure);
  });
});

describe('광고 매체·캠페인', () => {
  it('신문은 사업 손님, 여행 잡지는 관광 손님을 더 데려온다', () => {
    let s = game();
    s = applyAction(s, { type: 'openBranch', city: 'osaka' });
    s.companies[0].awareness.eastasia = 0.8;
    const plane = { model: MODEL.a320, freq: 14, age: 0 };
    const rival = { model: MODEL.a320, freq: 14, age: 0 };
    const run = (t: AirlineState) => splitMarket(t, 'seoul', 'osaka', [{ company: 0, fare: 0, planes: [plane] }, { company: 1, fare: 0, planes: [rival] }])[0];
    const paper = run(applyAction(s, { type: 'setMedia', region: 'eastasia', media: 'newspaper' }));
    const mag = run(applyAction(s, { type: 'setMedia', region: 'eastasia', media: 'magazine' }));
    expect(paper.biz).toBeGreaterThan(mag.biz);
    expect(mag.leisure).toBeGreaterThan(paper.leisure);
  });

  it('인터넷 광고는 1998년부터 고를 수 있다', () => {
    const old = game(1983);
    expect(applyAction(old, { type: 'setMedia', region: 'eastasia', media: 'internet' })).toBe(old);
    const now = game(2003);
    const t = applyAction(now, { type: 'setMedia', region: 'eastasia', media: 'internet' });
    expect(t.companies[0].adMedia?.eastasia).toBe('internet');
    expect(MEDIA_INFO.internet.from).toBe(1998);
  });

  it('캠페인은 한 분기에 하나, 값을 내면 손님 효과나 알려진 정도가 생긴다', () => {
    let s = game();
    expect(campaignBlocker(s, 0, 'sale')).toBe('지역을 골라요');
    const cash = s.companies[0].cash;
    s = applyAction(s, { type: 'campaign', kind: 'star', region: 'europe' });
    expect(s.companies[0].awareness.europe).toBeGreaterThanOrEqual(0.2);
    expect(s.companies[0].cash).toBeCloseTo(cash - campaignCost(s, 'star'), 6);
    expect(campaignBlocker(s, 0, 'lucky')).toContain('한 분기에 하나');
    expect(applyAction(s, { type: 'campaign', kind: 'lucky' })).toBe(s);
    // 같은 분기의 다음 달에도 못 하고, 다음 분기에는 다시 할 수 있다
    const nextMonth = (t: AirlineState) => {
      const u = applyAction(applyAction(t, { type: 'endTurn' }), { type: 'endTurn' });
      return { ...u, turnPos: u.order.indexOf(0) };
    };
    s = nextMonth(s);
    expect(campaignBlocker(s, 0, 'lucky')).toContain('한 분기에 하나');
    while (s.t % 3 !== 0) s = nextMonth(s);
    s = applyAction(s, { type: 'campaign', kind: 'miles' });
    const mod = s.companies[0].mods.find((m) => m.label.includes('마일리지'));
    expect(mod?.kind).toBe('demand');
    expect(mod?.seg).toBe('biz');
    expect(mod!.until).toBe(s.t + 6);
  });
});
