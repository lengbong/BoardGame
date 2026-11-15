import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { MODEL } from './aircraft';
import { MAX_MEMBERS, allianceOf, alliesOf, joinAlliance, leaveAlliance, pruneAlliances } from './alliances';
import { defaultCabin } from './cabin';
import { allianceScore } from './choices';
import { actor, applyAction, createGame, proposeBlocker } from './rules';
import { computeMonth, networks } from './simulate';
import { isValidState, parseSaved } from './storage';
import { defaultTimes } from './timetable';
import type { AirlineSetup, AirlineState, SeatKind } from './types';

function setup(kinds: SeatKind[], hubs: (string | null)[] = ['seoul', 'london', 'newyork', 'sydney']): AirlineSetup {
  return {
    seats: [0, 1, 2, 3].map((i) => ({ kind: kinds[i] ?? 'empty', name: '' })) as AirlineSetup['seats'],
    options: { era: 2003, mode: 'years', years: 20, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'normal', names: 'fictional' },
    hubs,
    airlines: [null, null, null, null],
  };
}

function addRoute(s: AirlineState, ci: number, a: string, b: string, model: string, freq: number): void {
  const c = s.companies[ci];
  for (const city of [a, b]) if (!c.branches.includes(city)) c.branches.push(city);
  const rid = s.nextId++;
  c.routes.push({ id: rid, a, b, fare: 0, since: s.t, stats: null, times: defaultTimes(a, b, 2003) });
  c.planes.push({ id: s.nextId++, model, leased: true, rent: 3, deposit: 0, since: s.t, legs: [{ route: rid, freq }], cabin: defaultCabin(MODEL[model]), meal: 3, cond: 80 });
}

const four = () => createGame(setup(['human', 'human', 'human', 'human']), seededRandom(2));

describe('항공 동맹', () => {
  it('둘이 만들고 셋까지 들어오며, 나가다 혼자 남으면 동맹이 없어진다', () => {
    let s = four();
    s = joinAlliance(s, 0, 1);
    expect(allianceOf(s, 0)?.members).toEqual([0, 1]);
    const name = allianceOf(s, 0)!.name;
    s = joinAlliance(s, 2, 0);
    expect(allianceOf(s, 2)?.members).toEqual([0, 1, 2]);
    expect(MAX_MEMBERS).toBe(3);
    expect(joinAlliance(s, 3, 1)).toBe(s);
    s = leaveAlliance(s, 1);
    expect(allianceOf(s, 0)?.members).toEqual([0, 2]);
    expect(allianceOf(s, 0)?.name).toBe(name);
    s = leaveAlliance(s, 2);
    expect(allianceOf(s, 0)).toBeNull();
    expect(s.alliances).toEqual([]);
  });

  it('세 회사 동맹은 한 네트워크라서 동맹 회사끼리 갈아타는 손님을 함께 태운다', () => {
    let s = four();
    addRoute(s, 0, 'seoul', 'tokyo', 'a330-300', 14);
    addRoute(s, 2, 'seoul', 'newyork', 'b777-300', 7);
    const pair = (st: AirlineState) => computeMonth(st).xfers.filter((x) => x.companies.includes(0) && x.companies.includes(2));
    expect(pair(s)).toHaveLength(0);
    s = joinAlliance(joinAlliance(s, 0, 1), 2, 1);
    expect(networks(s)[0].sort()).toEqual([0, 1, 2]);
    expect(pair(s).length).toBeGreaterThan(0);
  });

  it('동맹 마일리지: 동맹 회사가 많을수록 손님이 조금 늘고, 동맹 회사의 라운지도 반쯤 효과가 있다', () => {
    let s = four();
    // 좌석이 넉넉해야 손님이 는 것이 보인다
    addRoute(s, 0, 'seoul', 'osaka', 'b747-400', 14);
    const alone = computeMonth(s).reports[0].pax;
    s = joinAlliance(s, 0, 1);
    const two = computeMonth(s).reports[0].pax;
    s = joinAlliance(s, 2, 0);
    const three = computeMonth(s).reports[0].pax;
    expect(two).toBeGreaterThan(alone);
    expect(three).toBeGreaterThan(two);
    // 동맹 회사가 서울에 라운지를 지으면 우리 사업 손님도 조금 는다
    s.companies[1].branches.push('seoul');
    const before = computeMonth(s).reports[0].ticket;
    s.companies[1].facilities = [{ city: 'seoul', kind: 'lounge', cost: 50 }];
    expect(computeMonth(s).reports[0].ticket).toBeGreaterThan(before);
  });

  it('동맹이 있으면 초대하고, 다른 동맹 회사에는 제안할 수 없고, 다 차면 막힌다', () => {
    let s = createGame(setup(['human', 'ai-normal', 'ai-normal', 'ai-normal']), seededRandom(2));
    for (const city of ['tokyo', 'paris', 'bangkok', 'singapore', 'dubai']) for (const c of s.companies) c.branches.push(city);
    s = joinAlliance(s, 0, 1);
    expect(allianceScore(s, 0, 2)).toBeGreaterThan(-99);
    // 컴퓨터 회사 2가 우리 동맹 초대를 받아들인다
    const invited = applyAction(s, { type: 'propose', to: 2 });
    expect(allianceOf(invited, 2)?.members.sort()).toEqual([0, 1, 2]);
    expect(proposeBlocker(invited, 0, 3)).toMatch(/다 찼어요/);
    // 다른 동맹에 있는 회사에는 제안할 수 없다
    let t = joinAlliance(joinAlliance(s, 2, 3), 0, 1);
    t = { ...t, companies: t.companies.map((c) => ({ ...c, lastProposal: -99 })) };
    expect(proposeBlocker(t, 0, 2)).toMatch(/다른 동맹/);
  });

  it('사람 회사가 든 동맹에 컴퓨터가 가입을 신청하면 그 사람이 정한다', () => {
    let s = createGame(setup(['human', 'ai-normal', 'ai-normal']), seededRandom(2));
    for (const city of ['tokyo', 'paris', 'bangkok', 'singapore', 'dubai']) for (const c of s.companies) c.branches.push(city);
    s = joinAlliance(s, 0, 1);
    for (let k = 0; k < 10 && actor(s) !== 2; k++) s = applyAction(s, { type: 'endTurn' }, seededRandom(k));
    expect(actor(s)).toBe(2);
    s = applyAction(s, { type: 'propose', to: 1 });
    expect(s.companies[0].choice?.scenario).toBe('alliance');
    expect(allianceOf(s, 2)).toBeNull();
  });

  it('저가항공은 동맹에 들지 않는다', () => {
    const s = four();
    s.companies[1].bizModel = 'lcc';
    expect(proposeBlocker(s, 0, 1)).toMatch(/저가항공/);
    expect(allianceScore(s, 0, 1)).toBe(-99);
  });

  it('운항을 멈춘 회사는 동맹에서 빠진다', () => {
    let s = four();
    s = joinAlliance(joinAlliance(s, 0, 1), 2, 0);
    s.companies[2].out = true;
    s = pruneAlliances(s);
    expect(allianceOf(s, 0)?.members).toEqual([0, 1]);
    expect(alliesOf(s, 0)).toEqual([1]);
  });

  it('예전 저장의 1:1 제휴는 불러올 때 동맹이 되고, 한 회사가 두 동맹에 든 저장은 거른다', () => {
    const s = four();
    const old = JSON.parse(JSON.stringify(s));
    old.companies[0].partner = 1;
    old.companies[1].partner = 0;
    delete old.alliances;
    const back = parseSaved({ setup: setup(['human', 'human', 'human', 'human']), state: old, savedAt: 1 });
    expect(back).not.toBeNull();
    expect(allianceOf(back!.state, 0)?.members).toEqual([0, 1]);
    expect(back!.state.companies.every((c) => c.partner === null)).toBe(true);
    const twice = JSON.parse(JSON.stringify(s));
    twice.alliances = [
      { id: 1, name: 'A', members: [0, 1], since: 0 },
      { id: 2, name: 'B', members: [1, 2], since: 0 },
    ];
    expect(isValidState(twice)).toBe(false);
  });
});
