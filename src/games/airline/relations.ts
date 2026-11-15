import { withJosa } from '../../lib/korean';
import { AWARD_INFO } from './awards';
import { alliesOf, areAllied } from './alliances';
import { CITY, pairKey } from './cities';
import { PERSONA, assignPersonas, hash01, personaDef, personaOf, quoteOf, rivalSalt, rivalsOn, strHash, type QuoteKind } from './personality';
import { companyValue, routeIndex } from './simulate';
import { stakeOf } from './stocks';
import { monthOf, yearOfM } from './time';
import type { AirlineAction, AirlineState, Company, NewsItem, Route } from './types';
import type { RivalAction, RivalBook, RivalNote, RivalOffer, Truce } from './rivalTypes';

/*
 * 라이벌과의 관계 (−100…+100). 컴퓨터 회사 i가 회사 j를 보는 마음 rel[i][j] (사람 회사는 마음을 적지 않는다).
 *
 * 움직이는 일 (달마다 결산 때, rules.ts의 runMonth가 rivalsMonth를 부른다):
 * - 상대가 우리 노선에 새로 들어오면 −6 (허브 전략가는 본사 노선이면 −10), 우리가 들어가 만나게 돼도 −2
 * - 같은 노선에서 상대가 10%p 넘게 싸게 팔면 노선마다 −0.5~−1.5 (한 달에 −3까지, 운임 승부사는 더 서운해하고 서비스 장인은 덜)
 * - 우리 주식을 사면: 반기는 성격(알뜰한 살림꾼·새 길 개척자)은 25%까지 +, 나머지는 − (30% 넘으면 모두 경계)
 * - 같은 동맹이 되면 +10, 동맹이면 달마다 +1.5 (70까지), 동맹이 깨지면 −8
 * - 휴전 중이면 달마다 +1.5, 끝까지 지키면 +6. 먼저 끝내면 −20
 * - 연말 시상식: 서비스 장인은 서비스상·정시 운항상을 받은 회사를 존경(+6), 올해의 항공사는 축하(+3)하거나 분해해요(확장가·승부사 −3)
 * - 달마다 4%씩 '보통'(0) 쪽으로 돌아간다 (동맹이면 40쯤에서 머문다)
 * 성격마다 좋은 일(warmth)·나쁜 일(temper)에 마음이 움직이는 크기가 달라요.
 *
 * 사람의 외교 (applyRivalAction): 인사 방문(선물, 여섯 달에 한 번), 노선 휴전 제안(여섯 달, 성격·사이에 따라 받아들인다),
 * 컴퓨터가 보낸 휴전 제안에 답하기, 휴전 먼저 끝내기. 휴전 중에는 두 회사 모두 그 노선 일반석 운임을 휴전 때 값 아래로 내릴 수 없다
 * (rules.ts의 applyAction이 truceBlocks로 막는다).
 * 무작위는 rng 대신 판 씨앗으로 만든 수(hash01)를 써서 다른 일의 무작위 순서를 바꾸지 않는다.
 */

export const REL_MAX = 100;
/** 달마다 보통 쪽으로 돌아가는 비율 */
export const REL_DECAY = 0.96;
/** 인사 방문 간격 (달) */
export const VISIT_GAP = 6;
/** 인사 방문으로 오르는 사이 (성격의 warmth를 곱한다) */
export const VISIT_GAIN = 10;
/** 휴전 기간 (달) */
export const TRUCE_MONTHS = 6;
/** 휴전을 다시 청할 수 있는 간격 (달) */
export const ASK_GAP = 3;
/** 한 회사가 한 번에 맺을 수 있는 휴전 수 */
export const MAX_TRUCES = 3;
/** 이만큼 더 싸게 팔면 서운해한다 (%p) */
export const UNDERCUT_GAP = 10;
/** 사이가 이 아래면 휴전 이야기를 들어 주지 않는다 */
export const NO_TALK = -60;
/** 휴전을 먼저 끝내면 */
export const END_TRUCE = -20;

/** 사이 말 (위에서부터) */
export const REL_BANDS: readonly { min: number; word: string; icon: string; tone: 'good' | 'info' | 'warn' | 'bad' }[] = [
  { min: 60, word: '단짝', icon: '💞', tone: 'good' },
  { min: 25, word: '사이좋음', icon: '😊', tone: 'good' },
  { min: -25, word: '보통', icon: '🙂', tone: 'info' },
  { min: -60, word: '껄끄러움', icon: '😤', tone: 'warn' },
  { min: -Infinity, word: '불꽃 라이벌', icon: '🔥', tone: 'bad' },
];

export function relBand(v: number): number {
  return REL_BANDS.findIndex((b) => v >= b.min);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** 돈 글 (rules.ts의 fmtMoney와 같다: rules.ts를 부르지 않으려고 따로 둔다) */
export function fmtMoney(v: number): string {
  const r = Math.round(v);
  if (Math.abs(r) >= 10000) return `${(r / 10000).toFixed(Math.abs(r) >= 100000 ? 0 : 1).replace(/\.0$/, '')}조`;
  return `${r.toLocaleString('ko-KR')}억`;
}
const round1 = (v: number) => Math.round(v * 10) / 10;
const alive = (state: Pick<AirlineState, 'companies'>, ci: number) => !!state.companies[ci] && !state.companies[ci].out;
const grid = (n: number, v: number) => Array.from({ length: n }, () => Array<number>(n).fill(v));
const cityName = (key: string) => key.split('|').map((x) => CITY[x]?.name ?? x).join('–');
export const pairText = cityName;

// ------------------------------------------------------------------ 읽기

/** 컴퓨터 회사 i가 회사 j를 보는 마음 (없으면 0) */
export function relOf(state: Pick<AirlineState, 'rivals'>, i: number, j: number): number {
  const v = state.rivals?.rel?.[i]?.[j];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

type View = Pick<AirlineState, 'options' | 'companies' | 'startT' | 'rivals'>;

/** 두 회사 사이 (한쪽만 컴퓨터면 그 회사의 마음, 둘 다면 둘의 가운데) */
export function bondOf(state: View, x: number, y: number): number {
  const ax = personaOf(state, x) !== null;
  const ay = personaOf(state, y) !== null;
  if (ax && ay) return (relOf(state, x, y) + relOf(state, y, x)) / 2;
  if (ax) return relOf(state, x, y);
  if (ay) return relOf(state, y, x);
  return 0;
}

/** 이 사람이 보는 라이벌들 (성격이 있는 컴퓨터 회사, 운항 중) */
export function rivalsFor(state: View, viewer: number): number[] {
  if (!rivalsOn(state)) return [];
  return state.companies.map((_, i) => i).filter((i) => i !== viewer && alive(state, i) && personaOf(state, i) !== null);
}

/** 이 두 회사 사이 최근 까닭 (새것부터) */
export function notesFor(state: Pick<AirlineState, 'rivals'>, by: number, to: number, limit = 3): RivalNote[] {
  return (state.rivals?.notes ?? []).filter((n) => n.by === by && n.to === to).slice(-limit).reverse();
}

/** 진행 중인 휴전 (x·y 순서는 상관없다) */
export function truceOn(state: Pick<AirlineState, 'rivals' | 't'>, x: number, y: number, key: string): Truce | undefined {
  return (state.rivals?.truces ?? []).find((tr) => tr.key === key && tr.until > state.t && ((tr.a === x && tr.b === y) || (tr.a === y && tr.b === x)));
}

/** 이 회사가 맺은 휴전들 */
export function trucesOf(state: Pick<AirlineState, 'rivals' | 't'>, ci: number): Truce[] {
  return (state.rivals?.truces ?? []).filter((tr) => tr.until > state.t && (tr.a === ci || tr.b === ci));
}

/** 이 회사가 이 두 도시에서 지켜야 하는 운임 바닥 (휴전이 없으면 null) */
export function truceFloor(state: Pick<AirlineState, 'rivals' | 't'>, ci: number, key: string): number | null {
  let floor: number | null = null;
  for (const tr of state.rivals?.truces ?? []) {
    if (tr.key !== key || tr.until <= state.t) continue;
    if (tr.a === ci) floor = Math.max(floor ?? -Infinity, tr.floorA);
    else if (tr.b === ci) floor = Math.max(floor ?? -Infinity, tr.floorB);
  }
  return floor;
}

/** 이 노선에서 지켜야 하는 운임 바닥 (화면용) */
export function truceFloorFor(state: AirlineState, ci: number, route: Pick<Route, 'a' | 'b'>): number | null {
  if (!state.rivals?.truces.length) return null;
  return truceFloor(state, ci, pairKey(route.a, route.b));
}

/**
 * 휴전 중인 노선의 일반석 운임을 바닥 아래로 내리는 행동인지 (rules.ts의 applyAction이 막는다).
 * 휴전이 없으면 바로 false라 가볍다.
 */
export function truceBlocks(state: AirlineState, ci: number, action: AirlineAction): boolean {
  if (action.type !== 'setFare' || action.cls || !state.rivals?.truces.length) return false;
  const r = state.companies[ci].routes.find((x) => x.id === action.route);
  if (!r) return false;
  const floor = truceFloor(state, ci, pairKey(r.a, r.b));
  return floor !== null && action.fare < floor && action.fare < r.fare + 1e-9;
}

/** 이 회사에 온 휴전 제안 */
export function offersFor(state: Pick<AirlineState, 'rivals' | 't'>, ci: number): RivalOffer[] {
  return (state.rivals?.offers ?? []).filter((o) => o.to === ci && o.until >= state.t);
}

/** 두 회사가 함께 나는 노선 (내 노선 기준, 둘 다 비행기가 떠 있는 것) */
export interface SharedRoute {
  key: string;
  mine: Route;
  theirs: Route;
}

/** 비행기가 떠 있는 노선 번호들 */
export function flyingIds(c: Company): Set<number> {
  const ids = new Set<number>();
  for (const p of c.planes) for (const l of p.legs) if (l.freq > 0) ids.add(l.route);
  return ids;
}

export function sharedRoutes(state: Pick<AirlineState, 'companies'>, ci: number, to: number): SharedRoute[] {
  const a = state.companies[ci];
  const b = state.companies[to];
  if (!a || !b || a.out || b.out) return [];
  const fa = flyingIds(a);
  const fb = flyingIds(b);
  const idx = routeIndex(b);
  const out: SharedRoute[] = [];
  for (const r of a.routes) {
    if (!fa.has(r.id)) continue;
    const key = pairKey(r.a, r.b);
    const t = idx.get(key);
    if (t && fb.has(t.id)) out.push({ key, mine: r, theirs: t });
  }
  return out;
}

// ------------------------------------------------------------------ 장부

function isBook(v: RivalBook | undefined, n: number): v is RivalBook {
  return !!v && Array.isArray(v.rel) && v.rel.length === n && Array.isArray(v.persona) && v.persona.length === n && Array.isArray(v.visit) && v.visit.length === n && Array.isArray(v.ask) && v.ask.length === n;
}

/** 새 장부 (성격은 판 씨앗대로, 사이는 모두 보통) */
export function emptyBook(state: Pick<AirlineState, 'companies' | 'startT'>): RivalBook {
  const n = state.companies.length;
  return { persona: assignPersonas(state).slice(), rel: grid(n, 0), notes: [], truces: [], offers: [], visit: grid(n, -999), ask: grid(n, -999) };
}

/** 고쳐 쓸 수 있게 장부를 베낀다 (없거나 모양이 틀리면 새 장부) */
function copyBook(state: AirlineState): RivalBook {
  const n = state.companies.length;
  const b = isBook(state.rivals, n) ? state.rivals : emptyBook(state);
  return {
    ...b,
    persona: b.persona.slice(),
    rel: b.rel.map((r) => r.slice()),
    notes: b.notes.slice(),
    truces: b.truces.slice(),
    offers: b.offers.slice(),
    visit: b.visit.map((r) => r.slice()),
    ask: b.ask.map((r) => r.slice()),
  };
}

function pushNote(book: RivalBook, note: RivalNote): void {
  // 여섯 달 안에 같은 까닭이 있으면 하나로 합친다 (목록이 같은 말로 차지 않게)
  for (let k = book.notes.length - 1; k >= 0; k--) {
    const n = book.notes[k];
    if (note.t - n.t >= 6) break;
    if (n.by === note.by && n.to === note.to && n.text === note.text) {
      book.notes.splice(k, 1);
      book.notes.push({ ...note, d: round1(n.d + note.d) });
      return;
    }
  }
  book.notes.push({ ...note, d: round1(note.d) });
  if (book.notes.length > 60) book.notes.splice(0, book.notes.length - 60);
}

/** 성격에 따라 마음을 움직인다 (좋은 일은 warmth, 나쁜 일은 temper를 곱한다). 실제로 움직인 값 */
function feel(state: View, book: RivalBook, t: number, i: number, j: number, d: number, text: string | null): number {
  const p = personaDef(state, i);
  if (!p || i === j) return 0;
  const v = d >= 0 ? d * p.warmth : d * p.temper;
  book.rel[i][j] = round1(clamp(book.rel[i][j] + v, -REL_MAX, REL_MAX));
  // 까닭은 사람 회사에 보여 줄 것만 적는다 (컴퓨터끼리는 마음만 움직인다)
  if (text && state.companies[j]?.kind === 'human') pushNote(book, { by: i, to: j, t, d: v, text });
  return v;
}

function addNews(state: AirlineState, item: Omit<NewsItem, 'id' | 't'>): AirlineState {
  const news = [...state.news, { ...item, id: state.nextId, t: state.t }];
  return { ...state, news: news.length > 70 ? news.slice(-70) : news, nextId: state.nextId + 1 };
}

function addLog(state: AirlineState, seat: number | null, text: string): AirlineState {
  const log = [...state.log, { id: state.nextLogId, seat: seat as AirlineState['log'][number]['seat'], text }];
  return { ...state, log: log.length > 80 ? log.slice(-80) : log, nextLogId: state.nextLogId + 1 };
}

// ------------------------------------------------------------------ 달마다

/** 사이 말이 바뀌었을 때 뉴스 제목 */
function bandText(from: number, to: number): string {
  if (to === 0) return '단짝이 됐어요';
  if (to === 4) return '불꽃 라이벌이 됐어요';
  const up = to < from;
  if (to === 1) return up ? '사이가 좋아졌어요' : '사이가 조금 식었어요';
  if (to === 2) return up ? '사이가 조금 풀렸어요' : '사이가 보통으로 돌아왔어요';
  return up ? '불꽃이 조금 사그라들었어요' : '사이가 껄끄러워졌어요';
}

/**
 * 한 달 결산 뒤 관계를 셈한다 (runMonth가 부른다). t: 결산한 달.
 * 이번 달에 연 노선(since === t)·운임·주식·동맹·휴전·시상식을 보고 마음을 움직이고, 휴전 제안과 사이가 바뀐 소식을 낸다.
 */
export function rivalsMonth(state: AirlineState, t: number): AirlineState {
  if (!rivalsOn(state)) return state;
  const n = state.companies.length;
  const prev = isBook(state.rivals, n) ? state.rivals : null;
  const book = copyBook(state);
  const view: AirlineState = { ...state, rivals: book };
  const salt = rivalSalt(state);
  const cos = state.companies;
  const ais = cos.map((_, i) => i).filter((i) => alive(state, i) && personaOf(view, i) !== null);
  const fly = cos.map((c) => {
    const ids = flyingIds(c);
    const m = new Map<string, Route>();
    for (const r of c.routes) if (ids.has(r.id)) m.set(pairKey(r.a, r.b), r);
    return m;
  });
  const idx = cos.map((c) => routeIndex(c));
  const said = prev?.said?.length === n ? prev.said.map((r) => r.slice()) : book.rel.map((r) => r.map((v) => relBand(v)));
  const before = book.rel.map((r) => r.slice());
  const pals = new Set(prev?.pals ?? []);
  const nowPals: string[] = [];
  const bump = (i: number, j: number, d: number, text: string | null) => feel(view, book, t, i, j, d, text);
  const awards = monthOf(t) === 12 ? (state.awards ?? []).find((a) => a.year === yearOfM(t)) : undefined;

  // 1) 보통 쪽으로 조금 돌아간다
  for (const i of ais) for (let j = 0; j < n; j++) if (j !== i) book.rel[i][j] = round1(book.rel[i][j] * REL_DECAY);

  // 2) 이번 달에 일어난 일
  for (const i of ais) {
    const p = personaDef(view, i)!;
    const hub = cos[i].hub;
    for (let j = 0; j < n; j++) {
      if (j === i || !alive(state, j)) continue;
      // 상대가 우리 노선에 새로 들어왔다
      let entry = 0;
      for (const r of cos[j].routes) {
        if (r.since !== t || entry <= -12) continue;
        const key = pairKey(r.a, r.b);
        const mine = idx[i].get(key);
        if (!mine || mine.since >= t) continue;
        const hubRoute = p.id === 'hub' && (r.a === hub || r.b === hub);
        entry += bump(i, j, hubRoute ? -10 : -6, `우리 ${hubRoute ? '본사 ' : ''}노선 ${cityName(key)}에 들어왔어요`);
      }
      // 우리가 상대 노선에 들어가 만나게 됐다
      for (const r of cos[i].routes) {
        if (r.since !== t) continue;
        const key = pairKey(r.a, r.b);
        const theirs = idx[j].get(key);
        if (theirs && theirs.since < t) bump(i, j, -2, `${cityName(key)} 노선에서 만나게 됐어요`);
      }
      // 같은 노선에서 더 싸게 판다
      let cut = 0;
      for (const [key, mine] of fly[i]) {
        const theirs = fly[j].get(key);
        if (!theirs || cut <= -3 * p.fareTemper) continue;
        const gap = mine.fare - theirs.fare;
        if (gap < UNDERCUT_GAP || truceOn(view, i, j, key)) continue;
        // 10%p 싸면 −0.5, 20%p 넘게 싸면 −1.5 (한 달에 모두 −3까지)
        const d = Math.max(-Math.min(1.5, (gap - 5) / 10) * p.fareTemper, -3 * p.fareTemper - cut);
        cut += d;
        bump(i, j, d, `${cityName(key)}에서 우리보다 ${gap}%p 싸게 팔아요`);
      }
      // 우리 주식을 샀다
      const cur = stakeOf(state, i, j);
      const was = prev?.seen?.[i]?.[j] ?? cur;
      const diff = cur - was;
      if (diff >= 1) {
        if (p.stakeFriendly && cur <= 25) bump(i, j, 0.5 * diff, `우리 주식 ${Math.round(diff)}%를 사 줘서 든든해요`);
        else bump(i, j, -0.6 * diff, `우리 주식 ${Math.round(diff)}%를 사들였어요`);
        if (cur > 30) bump(i, j, -0.4 * (cur - Math.max(was, 30)), null);
      }
      // 동맹
      const pairId = `${Math.min(i, j)}|${Math.max(i, j)}`;
      const allied = areAllied(state, i, j);
      if (allied && !nowPals.includes(pairId)) nowPals.push(pairId);
      const wasAllied = prev?.pals ? pals.has(pairId) : allied;
      if (allied && !wasAllied) bump(i, j, 10, '같은 동맹이 됐어요');
      else if (!allied && wasAllied) bump(i, j, -8, '동맹이 끝났어요');
      if (allied && book.rel[i][j] < 70) bump(i, j, 1.5, null);
      // 휴전 중
      if (book.truces.some((tr) => tr.until > t && ((tr.a === i && tr.b === j) || (tr.a === j && tr.b === i)))) bump(i, j, 1.5, null);
      // 연말 시상식
      for (const a of awards?.items ?? []) {
        if (a.company !== j) continue;
        const info = AWARD_INFO[a.kind];
        if (p.id === 'service' && (a.kind === 'service' || a.kind === 'punctual')) bump(i, j, 6, `${info.name}을 받아서 존경스러워요`);
        else if (a.kind === 'airline') bump(i, j, p.id === 'expander' || p.id === 'fare' ? -3 : 3, p.id === 'expander' || p.id === 'fare' ? '올해의 항공사를 놓쳐서 분해요' : '올해의 항공사를 축하해요');
      }
    }
  }

  let s: AirlineState = { ...state, rivals: book };

  // 3) 휴전: 노선을 닫았거나 회사가 멈췄으면 조용히 끝, 기간을 다 채우면 고마워한다
  const keep: Truce[] = [];
  for (const tr of book.truces) {
    if (!alive(state, tr.a) || !alive(state, tr.b) || !idx[tr.a].has(tr.key) || !idx[tr.b].has(tr.key)) continue;
    if (tr.until > t + 1) {
      keep.push(tr);
      continue;
    }
    bump(tr.a, tr.b, 6, `${cityName(tr.key)} 휴전을 끝까지 지켰어요`);
    if (cos[tr.b].kind === 'human') {
      s = addNews(s, {
        icon: '🕊️',
        title: `${withJosa(cos[tr.a].name, '와/과')} ${cityName(tr.key)} 휴전을 끝까지 지켰어요`,
        text: `여섯 달 약속이 끝나 이제 운임을 마음대로 정할 수 있어요. ${quoteOf(view, tr.a, 'kept')}`,
        tone: 'good',
        for: [tr.b],
        company: tr.a,
      });
    }
  }
  book.truces = keep;

  // 4) 휴전 제안: 사이가 좋은 컴퓨터가 운임 다툼 중인 노선에서 가끔 먼저 청한다 (사람이 라이벌 카드에서 정한다)
  book.offers = book.offers.filter((o) => o.until > t && alive(state, o.from) && alive(state, o.to) && fly[o.from].has(o.key) && fly[o.to].has(o.key) && !truceOn({ ...s, t }, o.from, o.to, o.key));
  for (const a of ais) {
    const p = personaDef(view, a)!;
    for (let b = 0; b < n; b++) {
      if (cos[b].kind !== 'human' || !alive(state, b) || book.rel[a][b] < 30 || (p.truce < 0 && book.rel[a][b] < 55)) continue;
      if (t - book.ask[a][b] < 6 || book.offers.some((o) => o.from === a && o.to === b)) continue;
      if (book.truces.filter((tr) => tr.until > t && tr.b === b).length >= MAX_TRUCES) continue;
      let best: { key: string; v: number } | null = null;
      for (const [key, mine] of fly[a]) {
        const theirs = fly[b].get(key);
        if (!theirs || book.truces.some((tr) => tr.key === key && tr.until > t && ((tr.a === a && tr.b === b) || (tr.a === b && tr.b === a)))) continue;
        const gap = Math.abs(mine.fare - theirs.fare);
        const low = mine.fare <= -10 && theirs.fare <= -10;
        if (gap < UNDERCUT_GAP && !low) continue;
        const v = gap + (low ? 10 : 0);
        if (!best || v > best.v) best = { key, v };
      }
      if (!best || hash01(salt, t, a, b, 31) >= 0.3) continue;
      book.ask[a][b] = t;
      book.offers.push({ id: s.nextId, from: a, to: b, key: best.key, until: t + 2 });
      s = { ...s, nextId: s.nextId + 1 };
      s = addNews(s, {
        icon: '🕊️',
        title: `${cos[a].name}의 휴전 제안: ${cityName(best.key)}`,
        text: `${withJosa(cos[a].name, '이/가')} 여섯 달 동안 서로 이 노선 일반석 운임을 내리지 말자고 해요. 뉴스 화면 ‘라이벌’ 카드에서 정해요. ${quoteOf(view, a, 'offer')}`,
        tone: 'info',
        for: [b],
        company: a,
      });
    }
  }

  // 5) 사이 말이 바뀌면 소식 (경계에서 3 넘게 지나야: 오르내림이 잦지 않게)
  for (const i of ais) {
    for (let j = 0; j < n; j++) {
      if (j === i || !alive(state, j)) continue;
      const v = book.rel[i][j];
      const band = relBand(v);
      const old = said[i]?.[j] ?? relBand(before[i][j]);
      if (band === old) continue;
      // 좋아졌으면 지금 칸의 아래 끝, 나빠졌으면 바로 위 칸의 아래 끝에서 3 넘게 지나야
      const edge = band < old ? REL_BANDS[band].min : REL_BANDS[band - 1].min;
      if (Math.abs(v - edge) < 3) continue;
      said[i][j] = band;
      if (cos[j].kind !== 'human') continue;
      const up = band < old;
      const why = book.notes.filter((x) => x.by === i && x.to === j && x.t === t).sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0];
      s = addNews(s, {
        icon: up ? '💬' : '🔥',
        title: `${withJosa(cos[i].name, '와/과')} ${bandText(old, band)}${band === 0 || band === 4 ? '' : ` (${REL_BANDS[band].word})`}`,
        text: `${why ? `${why.text}. ` : ''}${quoteOf(view, i, up ? 'up' : 'down')}`,
        tone: up ? 'good' : 'info',
        for: [j],
        company: i,
      });
    }
  }

  book.said = said;
  book.seen = cos.map((_, i) => cos.map((__, j) => stakeOf(state, i, j)));
  book.pals = nowPals.sort();
  return { ...s, rivals: book };
}

// ------------------------------------------------------------------ 외교 (사람)

/** 인사 방문(선물) 값: 회사 가치의 0.4% (10억~80억) */
export function visitCost(state: AirlineState, ci: number): number {
  return clamp(Math.round(companyValue(state, ci) * 0.004), 10, 80);
}

/** 인사 방문으로 오르는 사이 */
export function visitGain(state: View, ci: number, to: number): number {
  const p = personaDef(state, to);
  if (!p) return 0;
  return round1(VISIT_GAIN * p.warmth * (relOf(state, to, ci) >= 50 ? 0.5 : 1));
}

function targetBlocker(state: AirlineState, ci: number, to: number): string | null {
  if (!rivalsOn(state)) return '라이벌 성격을 끈 판이에요';
  const t = state.companies[to];
  if (!t || to === ci) return '라이벌 회사를 골라요';
  if (t.out) return '운항을 멈춘 회사예요';
  if (personaOf(state, to) === null) return '컴퓨터 회사와만 할 수 있어요';
  return null;
}

/** 다음에 갈 수 있을 때까지 남은 달 (0이면 지금) */
export function visitWait(state: AirlineState, ci: number, to: number): number {
  const last = state.rivals?.visit?.[ci]?.[to] ?? -999;
  return Math.max(0, VISIT_GAP - (state.t - last));
}

export function visitBlocker(state: AirlineState, ci: number, to: number): string | null {
  const why = targetBlocker(state, ci, to);
  if (why) return why;
  const wait = visitWait(state, ci, to);
  if (wait > 0) return `${wait}달 뒤에 다시 갈 수 있어요`;
  if (relOf(state, to, ci) >= 90) return '이미 아주 사이좋아요';
  const cost = visitCost(state, ci);
  if (state.companies[ci].cash < cost) return `돈이 모자라요 (${fmtMoney(cost)})`;
  return null;
}

/** 휴전을 받아들일 마음 (판 씨앗으로 만든 흔들림은 빼고) */
export function truceScore(state: AirlineState, ci: number, to: number, key: string): number {
  const p = personaDef(state, to);
  if (!p) return -99;
  let v = relOf(state, to, ci) + p.truce;
  const mine = routeIndex(state.companies[ci]).get(key);
  const theirs = routeIndex(state.companies[to]).get(key);
  // 그 노선에서 손해를 보고 있거나 우리보다 비싸게 팔고 있으면 쉬고 싶어 한다
  if (theirs?.stats && theirs.stats.profit < 0) v += 12;
  if (mine && theirs && mine.fare <= theirs.fare - 5) v += 8;
  const style = state.options.aiStyle ?? 'normal';
  if (style === 'fierce') v -= 8;
  else if (style === 'relaxed') v += 8;
  return v;
}

/** 휴전 제안에 대한 대답 미리 보기 (yes는 꼭 받아들이고 no는 꼭 거절한다) */
export function truceOutlook(state: AirlineState, ci: number, to: number, key: string): 'yes' | 'maybe' | 'no' {
  const v = truceScore(state, ci, to, key);
  return v >= 18 ? 'yes' : v < 2 ? 'no' : 'maybe';
}

/** 실제 대답 (점수 ± 판 씨앗 흔들림 8이 10 넘으면 받아들인다) */
export function truceAccepts(state: AirlineState, ci: number, to: number, key: string): boolean {
  const wobble = hash01(rivalSalt(state), state.t, ci, to, strHash(key)) * 16 - 8;
  return truceScore(state, ci, to, key) + wobble >= 10;
}

export function truceBlocker(state: AirlineState, ci: number, to: number, routeId: number): string | null {
  const why = targetBlocker(state, ci, to);
  if (why) return why;
  const shared = sharedRoutes(state, ci, to);
  if (shared.length === 0) return '함께 나는 노선이 없어요';
  const sh = shared.find((x) => x.mine.id === routeId);
  if (!sh) return '함께 나는 노선을 골라요';
  if (truceOn(state, ci, to, sh.key)) return '이미 휴전 중이에요';
  if (offersFor(state, ci).some((o) => o.from === to && o.key === sh.key)) return '이 노선은 받은 제안이 있어요';
  if (trucesOf(state, ci).length >= MAX_TRUCES) return `휴전은 한 번에 ${MAX_TRUCES}개까지예요`;
  const last = state.rivals?.ask?.[ci]?.[to] ?? -999;
  if (state.t - last < ASK_GAP) return `${ASK_GAP - (state.t - last)}달 뒤에 다시 청할 수 있어요`;
  if (relOf(state, to, ci) <= NO_TALK) return '사이가 너무 껄끄러워요 (먼저 인사 방문해 봐요)';
  return null;
}

/** 휴전을 먼저 끝낼 수 있는지 */
export function endTruceBlocker(state: AirlineState, ci: number, to: number, key: string): string | null {
  if (!rivalsOn(state)) return '라이벌 성격을 끈 판이에요';
  return truceOn(state, ci, to, key) ? null : '휴전 중이 아니에요';
}

export function isRivalAction(a: { type: string }): a is RivalAction {
  return a.type === 'rivalVisit' || a.type === 'rivalTruce' || a.type === 'rivalAnswer' || a.type === 'rivalEndTruce';
}

function say(state: AirlineState, to: number, kind: QuoteKind): string {
  return `${state.companies[to].name}: ${quoteOf(state, to, kind)}`;
}

/** 사람의 외교 행동 (rules.ts는 여기로 넘기기만 한다). 못 하면 그대로 돌려준다 */
export function applyRivalAction(state: AirlineState, action: RivalAction, ci: number): AirlineState {
  const me = state.companies[ci];
  const t = state.t;
  switch (action.type) {
    case 'rivalVisit': {
      const to = action.to;
      if (visitBlocker(state, ci, to)) return state;
      const cost = visitCost(state, ci);
      const book = copyBook(state);
      const gain = visitGain(state, ci, to);
      book.rel[to][ci] = round1(clamp(book.rel[to][ci] + gain, -REL_MAX, REL_MAX));
      pushNote(book, { by: to, to: ci, t, d: gain, text: '인사 방문과 선물을 받았어요' });
      book.visit[ci][to] = t;
      const companies = state.companies.slice();
      companies[ci] = { ...me, cash: me.cash - cost };
      const s: AirlineState = { ...state, companies, rivals: book, events: [] };
      return addLog(s, me.seat, `🎁 ${me.name}: ${state.companies[to].name}에 인사 방문 (−${fmtMoney(cost)}) — ${say(s, to, 'gift')}`);
    }
    case 'rivalTruce': {
      const to = action.to;
      if (truceBlocker(state, ci, to, action.route)) return state;
      const sh = sharedRoutes(state, ci, to).find((x) => x.mine.id === action.route)!;
      const book = copyBook(state);
      book.ask[ci][to] = t;
      const ok = truceAccepts(state, ci, to, sh.key);
      if (ok) {
        book.truces.push({ a: to, b: ci, key: sh.key, since: t, until: t + TRUCE_MONTHS, floorA: sh.theirs.fare, floorB: sh.mine.fare });
        const p = PERSONA[personaOf(state, to)!];
        const gain = round1(5 * p.warmth);
        book.rel[to][ci] = round1(clamp(book.rel[to][ci] + gain, -REL_MAX, REL_MAX));
        pushNote(book, { by: to, to: ci, t, d: gain, text: `${cityName(sh.key)} 휴전을 맺었어요` });
        book.offers = book.offers.filter((o) => !(o.key === sh.key && ((o.from === to && o.to === ci) || (o.from === ci && o.to === to))));
      } else pushNote(book, { by: to, to: ci, t, d: 0, text: `${cityName(sh.key)} 휴전은 거절했어요` });
      const s: AirlineState = { ...state, rivals: book, events: [] };
      return addLog(s, me.seat, `🕊️ ${me.name}: ${state.companies[to].name}에 ${cityName(sh.key)} 휴전 제안 — ${ok ? '받아들였어요' : '거절했어요'}. ${say(s, to, ok ? 'truceYes' : 'truceNo')}`);
    }
    case 'rivalAnswer': {
      if (!rivalsOn(state)) return state;
      const offer = offersFor(state, ci).find((o) => o.id === action.offer);
      if (!offer) return state;
      const to = offer.from;
      const sh = sharedRoutes(state, ci, to).find((x) => x.key === offer.key);
      const book = copyBook(state);
      book.offers = book.offers.filter((o) => o.id !== offer.id);
      const p = PERSONA[personaOf(state, to) ?? 'saver'];
      let ok = false;
      if (action.accept && sh && !truceOn(state, ci, to, offer.key) && trucesOf(state, ci).length < MAX_TRUCES) {
        ok = true;
        book.truces.push({ a: to, b: ci, key: offer.key, since: t, until: t + TRUCE_MONTHS, floorA: sh.theirs.fare, floorB: sh.mine.fare });
        const gain = round1(4 * p.warmth);
        book.rel[to][ci] = round1(clamp(book.rel[to][ci] + gain, -REL_MAX, REL_MAX));
        pushNote(book, { by: to, to: ci, t, d: gain, text: `${cityName(offer.key)} 휴전 제안을 받아 줬어요` });
      } else if (!action.accept) {
        const loss = round1(-3 * p.temper);
        book.rel[to][ci] = round1(clamp(book.rel[to][ci] + loss, -REL_MAX, REL_MAX));
        pushNote(book, { by: to, to: ci, t, d: loss, text: `${cityName(offer.key)} 휴전 제안을 거절했어요` });
      }
      const s: AirlineState = { ...state, rivals: book, events: [] };
      if (action.accept && !ok) return addLog(s, me.seat, `🕊️ ${me.name}: ${state.companies[to].name}의 ${cityName(offer.key)} 휴전 제안 — 함께 나는 노선이 바뀌어 맺지 못했어요`);
      return addLog(s, me.seat, `🕊️ ${me.name}: ${state.companies[to].name}의 ${cityName(offer.key)} 휴전 제안 ${ok ? '받아들이기' : '거절하기'} — ${say(s, to, ok ? 'truceYes' : 'offerNo')}`);
    }
    case 'rivalEndTruce': {
      const to = action.to;
      if (endTruceBlocker(state, ci, to, action.key)) return state;
      const book = copyBook(state);
      book.truces = book.truces.filter((tr) => !(tr.key === action.key && ((tr.a === to && tr.b === ci) || (tr.a === ci && tr.b === to))));
      const p = PERSONA[personaOf(state, to) ?? 'saver'];
      const loss = round1(END_TRUCE * p.temper);
      book.rel[to][ci] = round1(clamp(book.rel[to][ci] + loss, -REL_MAX, REL_MAX));
      pushNote(book, { by: to, to: ci, t, d: loss, text: `${cityName(action.key)} 휴전을 먼저 끝냈어요` });
      const s: AirlineState = { ...state, rivals: book, events: [] };
      return addLog(s, me.seat, `🕊️ ${me.name}: ${state.companies[to].name}와 맺은 ${cityName(action.key)} 휴전을 먼저 끝냈어요 — ${say(s, to, 'broken')}`);
    }
  }
}

// ------------------------------------------------------------------ 동맹 (choices.ts의 allianceScore에 더한다)

/**
 * 동맹 제안을 반기는 마음: 양쪽(동맹이면 그 회사들)의 컴퓨터 회사마다 상대편 사람 회사를 보는 마음 ÷ 25 의 가운데.
 * 사이가 +50이면 +2, −50이면 −2. 사이가 보통(0)이거나 성격을 끈 판이면 0 (예전 점수 그대로).
 * 컴퓨터끼리의 동맹은 예전 점수 그대로 (컴퓨터끼리의 마음은 노선·운임 다툼에만 쓴다: 사이좋은 성격이 동맹을 몰아 받아 너무 세지지 않게).
 * 성격은 동맹을 제안하는 빈도(allyRate: aiPersonality.ts)만 바꾼다.
 */
export function allianceMood(state: View & Pick<AirlineState, 'alliances'>, from: number, to: number): number {
  if (!rivalsOn(state)) return 0;
  const sideA = [from, ...alliesOf(state, from)];
  const sideB = [to, ...alliesOf(state, to)];
  let sum = 0;
  let k = 0;
  for (const [side, other] of [
    [sideA, sideB],
    [sideB, sideA],
  ] as const) {
    const people = other.filter((y) => state.companies[y]?.kind === 'human');
    if (people.length === 0) continue;
    for (const x of side) {
      if (!personaDef(state, x)) continue;
      const feelAvg = people.reduce((acc, y) => acc + relOf(state, x, y), 0) / people.length;
      sum += feelAvg / 25;
      k++;
    }
  }
  return k > 0 ? sum / k : 0;
}

// ------------------------------------------------------------------ 저장 (storage.ts)

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** 설정의 라이벌 성격 켜기·끄기 (올바를 때만 키를 둔다) */
export function parseRivalsOption(o: Record<string, unknown>): { personas?: boolean } {
  return typeof o.personas === 'boolean' ? { personas: o.personas } : {};
}

/** 라이벌 장부가 올바른지 (없으면 올바름) */
export function isValidRivalsState(s: AirlineState): boolean {
  const v = s.rivals as unknown;
  if (v === undefined) return true;
  const n = s.companies.length;
  if (!isObj(v)) return false;
  const matrix = (m: unknown, ok: (x: unknown) => boolean) => Array.isArray(m) && m.length === n && m.every((row) => Array.isArray(row) && row.length === n && row.every(ok));
  if (!Array.isArray(v.persona) || v.persona.length !== n || !v.persona.every((p) => p === null || (typeof p === 'string' && p in PERSONA))) return false;
  if (!matrix(v.rel, (x) => isNum(x) && Math.abs(x as number) <= REL_MAX)) return false;
  if (!matrix(v.visit, isInt) || !matrix(v.ask, isInt)) return false;
  if (v.seen !== undefined && !matrix(v.seen, isNum)) return false;
  if (v.said !== undefined && !matrix(v.said, (x) => isInt(x) && (x as number) >= 0 && (x as number) < REL_BANDS.length)) return false;
  if (v.pals !== undefined && !(Array.isArray(v.pals) && v.pals.every((x) => typeof x === 'string'))) return false;
  const idx = (x: unknown) => isInt(x) && (x as number) >= 0 && (x as number) < n;
  const okKey = (k: unknown) => typeof k === 'string' && k.includes('|') && k.length < 60;
  if (!Array.isArray(v.notes) || v.notes.length > 200 || !v.notes.every((x) => isObj(x) && idx(x.by) && idx(x.to) && isInt(x.t) && isNum(x.d) && typeof x.text === 'string')) return false;
  if (!Array.isArray(v.truces) || v.truces.length > 40 || !v.truces.every((x) => isObj(x) && idx(x.a) && idx(x.b) && okKey(x.key) && isInt(x.since) && isInt(x.until) && isNum(x.floorA) && isNum(x.floorB))) return false;
  if (!Array.isArray(v.offers) || v.offers.length > 40 || !v.offers.every((x) => isObj(x) && isInt(x.id) && idx(x.from) && idx(x.to) && okKey(x.key) && isInt(x.until))) return false;
  return true;
}
