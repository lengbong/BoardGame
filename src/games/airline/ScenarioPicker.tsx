import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ChoiceIcon, ICON_DUO, ICON_LINE } from '../../components/IconPicker';
import { MODEL } from './aircraft';
import { BIZ_INFO } from './bizmodel';
import { CITY } from './cities';
import { PlaneImage } from './PlaneImage';
import { RIGHTS_MODE_INFO } from './rights';
import { DEFAULT_NAMES } from './rules';
import { SCENARIOS, endOf, goalLabel, hubName, money, starRules, starText, startOf, type ScenarioDef } from './scenarios';
import { loadScenarioStore, type ScenarioBest } from './scenarioSave';
import { mLabel } from './time';
import type { AirlineSetup } from './types';
import './scenarios.css';

/** 설정 화면 '게임 방식'의 역사 시나리오 그림: 펼친 두루마리 */
export function ScenarioModeIcon() {
  return (
    <ChoiceIcon>
      <path d="M8 7h16v18H8z" {...ICON_DUO} />
      <path d="M6 6.5a2 2 0 0 1 4 0v19a2 2 0 0 1-4 0zM22 6.5a2 2 0 0 1 4 0v19a2 2 0 0 1-4 0zM12 12h8M12 16h8M12 20h5" {...ICON_LINE} />
    </ChoiceIcon>
  );
}

const STYLE_NAME = { relaxed: '느긋', normal: '보통', fierce: '치열' } as const;

/** 시나리오 카드 그림: 그 시대 하늘색 위에 대표 기종 (직접 그린 비행기 그림) */
export function ScenarioArt({ def, big }: { def: ScenarioDef; big?: boolean }) {
  const style = { '--al-sc-sky1': def.sky[0], '--al-sc-sky2': def.sky[1] } as CSSProperties;
  const m = MODEL[def.art];
  return (
    <span className={`al-sc-art${big ? ' al-sc-art-big' : ''}`} style={style} aria-hidden="true">
      <svg className="al-sc-art-bg" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice">
        <circle cx="128" cy="22" r="11" fill="#fff6d6" opacity="0.9" />
        <path d="M14 30c4-6 12-6 15-1 3-3 9-2 10 3H12c0-1 1-2 2-2z" fill="#fff" opacity="0.85" />
        <path d="M92 46c3-4 9-4 11 0 2-2 7-1 7 2H90c0-1 1-2 2-2z" fill="#fff" opacity="0.7" />
        <path d="M0 78c22-8 40-8 60-3s44 6 64-1 28-6 36-4v20H0z" fill="var(--al-sc-hill)" />
        <path d="M0 84c30-5 56-4 84 0s52 3 76-1v7H0z" fill="var(--al-sc-hill2)" />
      </svg>
      {m && <PlaneImage model={def.art} paint={{ main: def.livery[0], dark: def.livery[1] }} className="al-sc-art-plane" alt="" />}
      <span className="al-sc-art-year">{def.year}</span>
    </span>
  );
}

/** '3년 2달' */
export function monthsLong(m: number): string {
  const y = Math.floor(m / 12);
  const r = m % 12;
  return [y > 0 ? `${y}년` : '', r > 0 ? `${r}달` : ''].filter(Boolean).join(' ') || '1달';
}

function Difficulty({ n }: { n: number }) {
  return (
    <span className="al-sc-diff" aria-label={`어려움 ${n} / 3`} title={`어려움 ${n} / 3`}>
      어려움{' '}
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= n ? 'al-on' : ''} />
      ))}
    </span>
  );
}

function BestLine({ best }: { best: ScenarioBest | undefined }) {
  if (!best) return <span className="al-sc-best al-muted">아직 안 해 봤어요</span>;
  if (best.stars === 0) return <span className="al-sc-best al-muted">{best.plays}번 해 봤어요 · 아직 성공 못 했어요</span>;
  return (
    <span className="al-sc-best" aria-label={`내 기록 별 ${best.stars}개`}>
      내 기록 <b className="al-sc-stars">{starText(best.stars)}</b>
      {best.months ? <small> · {monthsLong(best.months)} 만에</small> : null}
    </span>
  );
}

/** 처음 비행기 '707 ×2 · F27 ×3' */
function fleetText(def: { fleet?: { model: string }[] }): string {
  const count = new Map<string, number>();
  for (const f of def.fleet ?? []) count.set(f.model, (count.get(f.model) ?? 0) + 1);
  return [...count].map(([id, n]) => `${MODEL[id]?.name ?? id}${n > 1 ? ` ×${n}` : ''}`).join(' · ') || '없음';
}

function routeCount(def: { fleet?: { route?: [string, string] }[] }): number {
  return new Set((def.fleet ?? []).filter((f) => f.route).map((f) => [...f.route!].sort().join('|'))).size;
}

function Detail({ def }: { def: ScenarioDef }) {
  const kindName = (k: string) => (k === 'ai-easy' ? '쉬움' : '보통');
  return (
    <div className="al-sc-detail" data-testid="al-sc-detail">
      <div className="al-sc-detail-head">
        <ScenarioArt def={def} big />
        <div>
          <h3>
            {def.emoji} {def.title} <small className="al-sc-era">{def.era}</small>
          </h3>
          <p>{def.story}</p>
        </div>
      </div>
      <div className="al-sc-cols">
        <section>
          <h4>🏢 우리 회사</h4>
          <ul>
            <li>
              {mLabel(startOf(def))} · 본사 <b>{hubName(def)}</b>
            </li>
            <li>
              {BIZ_INFO[def.model ?? 'full'].icon} {BIZ_INFO[def.model ?? 'full'].name} · 자금 {money(def.cash)}
              {def.debt ? ` · 빚 ${money(def.debt)}` : ''}
            </li>
            <li>
              ✈️ {fleetText(def)} · 노선 {routeCount(def)}개
            </li>
          </ul>
          <h4>🛫 라이벌과 규칙</h4>
          <ul>
            {def.rivals.map((r, i) => (
              <li key={i}>
                {CITY[r.hub]?.name ?? r.hub} 본사{r.name ? ` ‘${r.name}’` : ''} · {BIZ_INFO[r.model ?? 'full'].name} · 컴퓨터 {kindName(r.kind)}
                {r.fleet?.length ? ` · 비행기 ${r.fleet.length}대` : ''}
              </li>
            ))}
            <li className="al-muted">
              운수권 {RIGHTS_MODE_INFO[def.rights].name} · 실제 역사 {def.history ? '켜짐' : '꺼짐'} · 컴퓨터 성향 {STYLE_NAME[def.aiStyle]}
            </li>
          </ul>
        </section>
        <section>
          <h4>🎯 단계 목표</h4>
          <ol className="al-sc-detail-stages">
            {def.stages.map((st, i) => (
              <li key={i}>
                <b>
                  {i + 1}단계 {st.title}
                </b>
                <small>{st.goals.map(goalLabel).join(' · ')}</small>
              </li>
            ))}
          </ol>
          <p className="al-sc-deadline">⌛ 기한: {mLabel(endOf(def))}까지</p>
          <h4>⭐ 별 받기</h4>
          <ul className="al-sc-star-rules">
            {starRules(def).map((t, i) => (
              <li key={i}>
                <span className="al-sc-stars" aria-hidden="true">
                  ★
                </span>{' '}
                {t}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <ul className="al-sc-tips">
        {def.tips.map((t, i) => (
          <li key={i}>💡 {t}</li>
        ))}
      </ul>
    </div>
  );
}

/** 설정 화면: 역사 시나리오 고르기 (회사 이름 + 카드 목록 + 고른 시나리오 자세히) */
export function ScenarioPicker({ setup, onSetup }: { setup: AirlineSetup; onSetup: (s: AirlineSetup) => void }) {
  const [store] = useState(() => loadScenarioStore());
  const list = useRef<HTMLUListElement>(null);
  const value = setup.options.scenario ?? null;
  const humanIdx = Math.max(0, setup.seats.findIndex((s) => s.kind === 'human'));
  const pick = (id: string) => onSetup({ ...setup, options: { ...setup.options, scenario: id } });
  const sel = SCENARIOS.find((d) => d.id === value) ?? null;
  const done = SCENARIOS.filter((d) => (store.best[d.id]?.stars ?? 0) > 0).length;
  const stars = SCENARIOS.reduce((sum, d) => sum + (store.best[d.id]?.stars ?? 0), 0);

  // 방향키로 카드 사이를 옮겨 고른다 (라디오 묶음처럼)
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const j = (i + step + SCENARIOS.length) % SCENARIOS.length;
    pick(SCENARIOS[j].id);
    list.current?.querySelectorAll<HTMLButtonElement>('button[role="radio"]')[j]?.focus();
  };

  return (
    <section className="setup-section al-sc-setup">
      <h2>역사 시나리오 고르기</h2>
      <p className="al-note">
        실제 항공 역사의 한 시대에 정해진 회사로 시작해 <b>단계 목표</b>를 차례로 이뤄요. 빨리, 잘 해낼수록 별을 더 받아요 (★ 3개까지). 회사와 이야기는 게임을 위해 지었고, 라이벌로 나오는 실제 항공사의 경영도 모두 게임 속 이야기예요.
        {done > 0 && (
          <>
            {' '}
            지금까지 <b>{done}</b>개 성공 · 별 <b>{stars}</b>개.
          </>
        )}
      </p>
      <label className="al-field al-name-field">
        <span>내 회사 이름</span>
        <input
          type="text"
          maxLength={8}
          value={setup.seats[humanIdx]?.name ?? ''}
          placeholder={DEFAULT_NAMES[0]}
          onChange={(e) => {
            const seats = [...setup.seats] as AirlineSetup['seats'];
            seats[humanIdx] = { kind: 'human', name: e.target.value };
            onSetup({ ...setup, seats });
          }}
        />
      </label>
      <ul className="al-sc-cards" role="radiogroup" aria-label="역사 시나리오" ref={list}>
        {SCENARIOS.map((d, i) => {
          const on = value === d.id;
          return (
            <li key={d.id}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on || (!sel && i === 0) ? 0 : -1}
                className={`al-sc-card${on ? ' al-on' : ''}`}
                onClick={() => pick(d.id)}
                onKeyDown={(e) => onKey(e, i)}
                data-testid={`al-sc-${d.id}`}
              >
                <ScenarioArt def={d} />
                <span className="al-sc-card-text">
                  <span className="al-sc-era">{d.era}</span>
                  <b>
                    {d.emoji} {d.title}
                  </b>
                  <small>
                    {mLabel(startOf(d))} · 본사 {hubName(d)} · {BIZ_INFO[d.model ?? 'full'].icon} {BIZ_INFO[d.model ?? 'full'].name}
                  </small>
                  <span className="al-sc-meta">
                    <Difficulty n={d.stars} />
                    <BestLine best={store.best[d.id]} />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {sel ? <Detail def={sel} /> : <p className="al-note al-sc-pick-hint">👆 카드를 눌러 시나리오를 골라요. 고르면 이야기와 단계 목표가 보여요.</p>}
    </section>
  );
}
