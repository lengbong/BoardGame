import { SCENARIO, currentStage, endOf, goalStatus, scenarioOf, stageMet, starText, starsFor } from './scenarios';
import { mLabel } from './time';
import type { ChallengeDef } from './challenges';
import type { AirlineState, GameResult, NewsItem, SeatIndex } from './types';

/*
 * 역사 시나리오의 시작과 달마다 단계 살피기 (rules.ts는 여기로 넘기기만 한다). rules.ts를 부르지 않는다.
 * 회사·라이벌·처음 비행기는 rules.ts의 도전 과제 시작 틀이 만들고, 여기서는 이야기와 진행만 더한다.
 */

function addNews(state: AirlineState, item: Omit<NewsItem, 'id' | 't'>): AirlineState {
  const news = [...state.news, { ...item, id: state.nextId, t: state.t }];
  return { ...state, news: news.length > 70 ? news.slice(-70) : news, nextId: state.nextId + 1 };
}

function addLog(state: AirlineState, seat: SeatIndex | null, text: string): AirlineState {
  const log = [...state.log, { id: state.nextLogId, seat, text }];
  return { ...state, log: log.length > 80 ? log.slice(-80) : log, nextLogId: state.nextLogId + 1 };
}

/** 시나리오 이야기와 진행을 넣는다 (회사·비행기는 이미 있다) */
export function startScenario(state: AirlineState, base: ChallengeDef): AirlineState {
  const def = SCENARIO[base.id];
  if (!def) return state;
  const real = state.companies.some((c) => c.airline);
  const s = addNews(state, {
    icon: def.emoji,
    title: `역사 시나리오: ${def.title}`,
    text: `${def.story} 단계: ${def.stages.map((st, i) => `${i + 1}) ${st.title}`).join(' → ')}. 기한 ${mLabel(endOf(def))}.${real ? ' (라이벌의 실제 항공사 이름만 빌렸고, 경영과 이야기는 게임 속 이야기예요)' : ''}`,
    tone: 'big',
    company: 0,
  });
  return { ...s, scenario: { id: def.id, company: 0, deadline: endOf(def), done: def.stages.map(() => null) } };
}

/**
 * 달 결산 뒤: 지금 단계 목표를 모두 이뤘으면 다음 단계로 (한 달에 여러 단계도), 마지막 단계면 성공과 별,
 * 기한이 지났거나 회사가 운항을 멈추면 실패. result가 있으면 게임이 끝난다.
 */
export function scenarioMonthEnd(state: AirlineState, t: number): { state: AirlineState; result: GameResult | null } {
  const sc = scenarioOf(state);
  if (!sc) return { state, result: null };
  const { def, p } = sc;
  const ci = p.company;
  const c = state.companies[ci];
  let s = state;
  if (!c || c.out) {
    s = { ...s, scenario: { ...p, stars: 0, bonus: false } };
    s = addNews(s, { icon: '⌛', title: `시나리오 실패: ${def.title}`, text: '돈이 모자라 운항을 멈췄어요. 다음에는 손해 보는 노선을 일찍 줄여 봐요.', tone: 'bad' });
    return { state: s, result: { winners: [], reason: '회사가 운항을 멈췄어요', success: false } };
  }
  const done = [...p.done];
  let k = currentStage(p);
  while (k < def.stages.length && stageMet(s, ci, def.stages[k])) {
    done[k] = t;
    const st = def.stages[k];
    s = addNews(s, { icon: def.emoji, title: `${def.title} ${k + 1}단계: ${st.title}`, text: st.story, tone: 'big', for: [ci], company: ci });
    s = addLog(s, c.seat, `${def.emoji} ${k + 1}단계 ‘${st.title}’ 이룸 (${mLabel(t)})`);
    k++;
  }
  s = { ...s, scenario: { ...p, done } };
  if (k >= def.stages.length) {
    const bonus = goalStatus(s, ci, def.bonus.goal).ok;
    const stars = starsFor(def, t, bonus);
    s = { ...s, scenario: { ...p, done, stars, bonus } };
    s = addNews(s, { icon: '🏆', title: `시나리오 성공: ${def.title} ${starText(stars)}`, text: `${mLabel(t)}에 마지막 단계까지 해냈어요!`, tone: 'big', for: [ci], company: ci });
    return { state: s, result: { winners: [ci], reason: `마지막 단계까지 해냈어요 ${starText(stars)}`, success: true } };
  }
  if (t >= p.deadline) {
    s = { ...s, scenario: { ...p, done, stars: 0, bonus: false } };
    s = addNews(s, { icon: '⌛', title: `시나리오 실패: ${def.title}`, text: `${def.stages.length}단계 가운데 ${k}단계까지 이뤘어요. 다시 해 볼까요?`, tone: 'bad' });
    return { state: s, result: { winners: [], reason: '기한 안에 마지막 단계를 이루지 못했어요', success: false } };
  }
  return { state: s, result: null };
}
