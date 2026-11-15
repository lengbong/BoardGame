import { useEffect, useRef, useState, type ReactNode } from 'react';
import { tone } from '../../lib/sound';
import { useTimers } from '../../lib/useTimers';
import type { Speed } from '../common/speed';
import { endKey } from './achievements';
import { ScenarioArt, monthsLong } from './ScenarioPicker';
import { currentStage, endOf, fastOf, goalLabel, goalStatus, scenarioOf, stageViews, starText, type ScenarioDef } from './scenarios';
import { loadScenarioStore, recordScenarioEnd, type ScenarioBest } from './scenarioSave';
import { AIRLINE_DELAYS } from './storage';
import { mLabel } from './time';
import type { AirlineState } from './types';
import { Meter } from './ui';
import './scenarios.css';

/** 단계를 이뤘을 때: 짧은 팡파르 */
function stageSound(): void {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.32, 'triangle', 0.07));
  tone(1319, 0.42, 0.55, 'sine', 0.04);
}

// ------------------------------------------------------------------ 오른쪽 패널: 단계 목표 칸

/** 오른쪽 패널의 목표 칸: 단계 목록(✓·지금·아직), 지금 단계 목표마다 막대, 별 받는 조건 */
export function ScenarioGoalBox({ state }: { state: AirlineState }) {
  const sc = scenarioOf(state);
  if (!sc) return null;
  const { def, p } = sc;
  const views = stageViews(state, def, p);
  const left = Math.max(0, p.deadline - state.t + 1);
  const fastLeft = fastOf(def) - state.t + 1;
  const bonus = goalStatus(state, p.company, def.bonus.goal);
  const cur = currentStage(p);
  return (
    <div className="al-sc-box" data-testid="al-sc-box">
      <b className="al-sc-box-title">
        {def.emoji} {def.title}
      </b>
      <ol className="al-sc-steps" aria-label="단계 목표">
        {views.map((v) => (
          <li key={v.index} className={v.doneAt !== null ? 'al-done' : v.current ? 'al-cur' : ''} aria-current={v.current ? 'step' : undefined}>
            <span className="al-sc-step-dot" aria-hidden="true">
              {v.doneAt !== null ? '✓' : v.index + 1}
            </span>
            <span className="al-sc-step-main">
              <span className="al-sc-step-title">
                {v.stage.title}
                {v.doneAt !== null && <small> · {mLabel(v.doneAt)}</small>}
                <span className="al-sr">{v.doneAt !== null ? ' (이뤘어요)' : v.current ? ' (지금 단계)' : ' (아직)'}</span>
              </span>
              {v.current && (
                <span className="al-sc-goals">
                  {v.goals.map((g, i) => (
                    <span key={i} className={`al-sc-goal${g.ok ? ' al-ok' : ''}`}>
                      <span className="al-sc-goal-label">
                        {g.ok ? '✅' : '▫️'} {g.label}
                      </span>
                      <span className="al-sc-goal-bar">
                        <Meter value={g.ratio} tone={g.ok ? 'good' : 'accent'} label={`${g.label}: ${g.text}`} />
                        <small>{g.text}</small>
                      </span>
                    </span>
                  ))}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
      <span className="al-sc-starline">
        <span title="마지막 단계까지 해내면">
          <i className="al-sc-stars">★</i> {cur}/{def.stages.length}단계
        </span>
        <span className={fastLeft > 0 ? '' : 'al-sc-miss'} title={`${mLabel(fastOf(def))}까지 해내면`}>
          <i className="al-sc-stars">★</i> {fastLeft > 0 ? `${fastLeft}달 안에` : '빠른 별은 지났어요'}
        </span>
        <span className={bonus.ok ? 'al-sc-hit' : ''} title={`${def.bonus.text} (지금 ${bonus.text})`}>
          <i className="al-sc-stars">★</i> {def.bonus.text} {bonus.ok ? '✓' : ''}
        </span>
      </span>
      <small className="al-muted">
        기한 {mLabel(p.deadline)} (남은 {left}달)
      </small>
    </div>
  );
}

// ------------------------------------------------------------------ 단계를 이룬 이야기 창

interface Pop {
  key: string;
  kind: 'intro' | 'stage';
  def: ScenarioDef;
  stage: number;
  t: number;
}

function ScenarioPopup({ pop, state, onClose, calm }: { pop: Pop; state: AirlineState; onClose: () => void; calm: boolean }) {
  const btn = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    btn.current?.focus();
    // 창이 떠 있는 동안 키는 이 창만 받는다 (Enter로 달을 넘기지 않게)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        close.current();
      }
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  const { def } = pop;
  const next = def.stages[pop.stage + 1];
  const st = def.stages[pop.stage];
  return (
    <div className="overlay al-sc-pop-overlay" role="dialog" aria-modal="true" aria-labelledby="al-sc-pop-title">
      <div className={`al-sc-pop${calm ? ' al-calm' : ''}`} data-testid="al-sc-pop">
        <ScenarioArt def={def} big />
        {pop.kind === 'intro' ? (
          <>
            <p className="al-sc-pop-kicker">📜 역사 시나리오 · {def.era}</p>
            <h2 id="al-sc-pop-title">
              {def.emoji} {def.title}
            </h2>
            <p>{def.story}</p>
            <ol className="al-sc-pop-stages">
              {def.stages.map((s, i) => (
                <li key={i}>
                  <b>
                    {i + 1}단계 {s.title}
                  </b>{' '}
                  <small>{s.goals.map(goalLabel).join(' · ')}</small>
                </li>
              ))}
            </ol>
            <p className="al-muted">
              ⌛ {mLabel(endOf(def))}까지 · ★ 해내기 · ★ {mLabel(fastOf(def))}까지 · ★ {def.bonus.text}
            </p>
          </>
        ) : (
          <>
            <p className="al-sc-pop-kicker">
              🎉 {pop.stage + 1}단계를 이뤘어요! · {mLabel(pop.t)}
            </p>
            <h2 id="al-sc-pop-title">{st.title}</h2>
            <p>{st.story}</p>
            {next && (
              <p className="al-sc-pop-next">
                다음 <b>{pop.stage + 2}단계 ‘{next.title}’</b>: {next.goals.map(goalLabel).join(' · ')}
              </p>
            )}
            <p className="al-muted">
              남은 기한 {Math.max(0, endOf(def) - state.t + 1)}달 · 빠른 별은 {mLabel(fastOf(def))}까지
            </p>
          </>
        )}
        <button type="button" ref={btn} className="btn btn-primary" onClick={onClose} data-testid="al-sc-pop-close">
          {pop.kind === 'intro' ? '시작해요!' : '계속하기'} <kbd>Enter</kbd>
        </button>
      </div>
    </div>
  );
}

/**
 * 게임 화면에서: 시나리오를 시작할 때 이야기 창, 단계를 이룰 때마다 이야기 창 (달 결산 연출이 끝난 뒤,
 * 분기 결산 창이 닫힌 다음에). 마지막 단계는 결과 화면이 보여 준다.
 */
export function useScenarioPopups(game: AirlineState, speed: Speed, blocked: boolean): ReactNode {
  const [queue, setQueue] = useState<Pop[]>([]);
  const seen = useRef<(number | null)[] | null>(null);
  const later = useTimers();
  useEffect(() => {
    const sc = scenarioOf(game);
    if (!sc || sc.p.company < 0 || game.companies[sc.p.company]?.kind !== 'human') return;
    const prev = seen.current;
    seen.current = sc.p.done;
    if (prev === null) {
      // 처음 열 때: 막 시작한 판이면 이야기 창
      if (game.t === game.startT && game.turnPos === 0 && sc.p.done.every((d) => d === null)) {
        later(() => setQueue((q) => [...q, { key: `intro-${game.startT}`, kind: 'intro', def: sc.def, stage: -1, t: game.t }]), 450);
      }
      return;
    }
    if (prev === sc.p.done || game.phase === 'gameover') return;
    const fresh = sc.p.done.map((d, i) => (d !== null && prev[i] === null ? i : -1)).filter((i) => i >= 0);
    if (fresh.length === 0) return;
    later(() => {
      stageSound();
      setQueue((q) => [...q, ...fresh.map((i) => ({ key: `stage-${i}-${sc.p.done[i]}`, kind: 'stage' as const, def: sc.def, stage: i, t: sc.p.done[i]! }))]);
    }, AIRLINE_DELAYS[speed].sim + 300);
  }, [game, speed, later]);
  const top = queue[0];
  if (!top || blocked || game.phase === 'gameover') return null;
  return <ScenarioPopup key={top.key} pop={top} state={game} calm={!AIRLINE_DELAYS[speed].fx} onClose={() => setQueue((q) => q.slice(1))} />;
}

// ------------------------------------------------------------------ 결과 화면

/** 게임이 끝나기 전의 가장 좋은 기록 (같은 끝은 한 번만 기록하고, 다시 열어도 '새 기록'을 그대로 보여 준다) */
const beforeByEnd = new Map<string, ScenarioBest | null>();

function useScenarioRecord(state: AirlineState): { before: ScenarioBest | null; after: ScenarioBest | null } {
  const [rec, setRec] = useState<{ before: ScenarioBest | null; after: ScenarioBest | null }>({ before: null, after: null });
  useEffect(() => {
    const p = state.scenario;
    if (!p || state.phase !== 'gameover') return;
    const key = endKey(state);
    if (!beforeByEnd.has(key)) beforeByEnd.set(key, loadScenarioStore().best[p.id] ?? null);
    const after = recordScenarioEnd(state).best[p.id] ?? null;
    setRec({ before: beforeByEnd.get(key) ?? null, after });
  }, [state]);
  return rec;
}

/** 결과 화면: 받은 별, 별마다 이룬 것, 단계마다 이룬 달, 가장 좋은 기록 */
export function ScenarioResult({ state }: { state: AirlineState }) {
  const sc = scenarioOf(state);
  const rec = useScenarioRecord(state);
  if (!sc) return null;
  const { def, p } = sc;
  const won = !!state.result?.success;
  const stars = won ? (p.stars ?? 1) : 0;
  const finishedAt = p.done[p.done.length - 1];
  const human = state.companies[p.company]?.kind === 'human';
  const isNew = human && won && rec.after !== null && (rec.before === null || rec.after.stars > rec.before.stars || (rec.after.stars === rec.before.stars && (rec.after.months ?? 999) < (rec.before.months ?? 999)));
  const rows: { ok: boolean; text: string }[] = [
    { ok: won, text: won ? `마지막 단계까지 해냈어요 (${mLabel(finishedAt ?? state.t)})` : `${def.stages.length}단계 가운데 ${currentStage(p)}단계까지 이뤘어요` },
    { ok: won && finishedAt !== null && finishedAt !== undefined && finishedAt <= fastOf(def), text: `${mLabel(fastOf(def))}까지 해내기` },
    { ok: won && !!p.bonus, text: def.bonus.text },
  ];
  return (
    <div className="al-sc-result" data-testid="al-sc-result">
      <p className="al-sc-result-stars" aria-label={`별 ${stars}개`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={i < stars ? 'al-on' : ''} style={{ animationDelay: `${0.35 + i * 0.25}s` }} aria-hidden="true">
            ★
          </span>
        ))}
      </p>
      {isNew && <p className="al-sc-new">🎊 새 기록!</p>}
      <ul className="al-sc-result-rows">
        {rows.map((r, i) => (
          <li key={i} className={r.ok ? 'al-ok' : ''}>
            <span aria-hidden="true">{r.ok ? '★' : '☆'}</span> {r.text}
            <span className="al-sr">{r.ok ? ' (받았어요)' : ' (못 받았어요)'}</span>
          </li>
        ))}
      </ul>
      <ol className="al-sc-result-stages">
        {def.stages.map((st, i) => (
          <li key={i} className={p.done[i] !== null ? 'al-ok' : ''}>
            <b>
              {p.done[i] !== null ? '✓' : '✗'} {i + 1}단계 {st.title}
            </b>
            <small>{p.done[i] !== null ? mLabel(p.done[i]!) : st.goals.map((g) => `${goalLabel(g)} (${goalStatus(state, p.company, g).text})`).join(' · ')}</small>
          </li>
        ))}
      </ol>
      {human && rec.after && rec.after.stars > 0 && (
        <p className="al-muted al-sc-result-best">
          가장 좋은 기록 {starText(rec.after.stars)}
          {rec.after.months ? ` · ${monthsLong(rec.after.months)} 만에` : ''} · 성공 {rec.after.wins}/{rec.after.plays}판
        </p>
      )}
    </div>
  );
}
