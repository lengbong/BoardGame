import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { SEAT_COLORS } from '../common/players';
import { ACHIEVEMENTS, START_ERAS, TIER_INFO, unlockedCount, type AchStore, type AchTier, type AchievementDef } from './achievements';
import { CompanyBadge, SEAT_SHAPES } from './Art';
import { AchBadge, HallArt } from './BadgeArt';
import { BIZ_INFO } from './bizmodel';
import { CHALLENGE, CHALLENGES } from './challenges';
import { SCENARIO, SCENARIOS } from './scenarios';
import { CITY } from './cities';
import { fameVersion, loadAchStore, loadHof, resetFame, subscribeFame } from './fameStore';
import { fmtMoney, fmtPax, km } from './format';
import { HOF_SIZE, RECORD_KINDS, type FameEntry, type HofStore, type RecordKind } from './hallOfFame';
import { REAL_AIRLINE } from './realAirlines';
import { IataBadge, Meter } from './ui';
import type { WinMode } from './types';
import './fame.css';

/** 저장된 업적·명예의 전당 (바뀌면 다시 그린다) */
export function useFame(): { ach: AchStore; hof: HofStore } {
  const v = useSyncExternalStore(subscribeFame, fameVersion, fameVersion);
  return useMemo(() => ({ ach: loadAchStore(), hof: loadHof() }), [v]);
}

export const RECORD_INFO: Record<RecordKind, { icon: string; name: string; fmt: (v: number) => string }> = {
  fleet: { icon: '✈️', name: '가장 큰 비행기 무리', fmt: (v) => `${v.toLocaleString('ko-KR')}대` },
  yearPax: { icon: '🧳', name: '한 해 가장 많은 손님', fmt: fmtPax },
  yearProfit: { icon: '💰', name: '한 해 가장 큰 이익', fmt: fmtMoney },
  trophies: { icon: '🏆', name: '한 게임 가장 많은 트로피', fmt: (v) => `${v}개` },
  network: { icon: '🗺️', name: '가장 긴 노선망', fmt: km },
  cities: { icon: '🏙️', name: '가장 많은 지점', fmt: (v) => `${v}곳` },
  totalPax: { icon: '👥', name: '한 게임에 태운 손님', fmt: fmtPax },
};

export const dateText = (at: number) => new Date(at).toLocaleDateString('ko-KR');

export function monthsText(m: number): string {
  const y = Math.floor(m / 12);
  const r = m % 12;
  return [y > 0 ? `${y}년` : '', r > 0 ? `${r}달` : ''].filter(Boolean).join(' ') || '1달';
}

function modeText(mode: WinMode, challenge: string | null, scenario?: string): string {
  if (mode === 'scenario') return scenario && SCENARIO[scenario] ? `${SCENARIO[scenario].emoji} ${SCENARIO[scenario].title}` : '📜 역사 시나리오';
  if (mode === 'challenge') return challenge && CHALLENGE[challenge] ? `${CHALLENGE[challenge].emoji} ${CHALLENGE[challenge].title}` : '도전 과제';
  return mode === 'goal' ? '🎯 목표 먼저' : '📅 정해진 해까지';
}

/** 회사 이름표 (자리 모양 꼬리 + 실제 항공사면 두 글자 부호) */
export function FameName({ name, seat, airline }: { name: string; seat: number; airline: string | null }) {
  const real = airline ? REAL_AIRLINE[airline] : undefined;
  const color = real ? real.colors[0] : SEAT_COLORS[(seat & 3) as 0].main;
  return (
    <span className="al-coname">
      <CompanyBadge color={color} shape={SEAT_SHAPES[seat & 3]} size={16} />
      {real && <IataBadge airline={real} small />}
      <b>{name}</b>
    </span>
  );
}

// ------------------------------------------------------------------ 업적 진열장

function Steps({ def, ach }: { def: AchievementDef; ach: AchStore }) {
  if (!def.steps) return null;
  const [n, total] = def.steps(ach.progress);
  return (
    <span className="al-ach-steps">
      <Meter value={n / total} tone="accent" label={`${def.name} ${n}/${total}`} />
      <small>
        {n}/{total}
      </small>
      {def.id === 'win-eras' &&
        START_ERAS.map((e) => (
          <small key={e} className={`al-ach-chip${ach.progress.eras.includes(e) ? ' al-on' : ''}`}>
            {e}
          </small>
        ))}
      {def.id === 'challenge-all' &&
        CHALLENGES.map((c) => (
          <small key={c.id} className={`al-ach-chip${ach.progress.challenges.includes(c.id) ? ' al-on' : ''}`} title={c.title}>
            {c.emoji}
          </small>
        ))}
      {def.id === 'scenario-all' &&
        SCENARIOS.map((c) => (
          <small key={c.id} className={`al-ach-chip${ach.progress.scenarios?.includes(c.id) ? ' al-on' : ''}`} title={c.title}>
            {c.emoji}
          </small>
        ))}
    </span>
  );
}

export function AchCard({ def, ach }: { def: AchievementDef; ach: AchStore }) {
  const rec = ach.items[def.id];
  const secret = !rec && def.hidden;
  return (
    <li className={`al-ach-card${rec ? ' al-on' : ''}`} data-testid={`al-ach-${def.id}`}>
      <AchBadge def={def} unlocked={!!rec} size={52} decorative />
      <span className="al-ach-text">
        <b>{secret ? '???' : def.name}</b>
        <small>{secret ? '숨은 업적이에요. 이루면 무엇인지 보여요!' : def.desc}</small>
        {rec ? (
          <>
            <small className="al-ach-who" title="처음 이룬 회사">
              🏅 <FameName name={rec.by} seat={rec.seat} airline={rec.airline} />
            </small>
            <small className="al-ach-when">
              게임 속 {rec.year}년 · {dateText(rec.at)}
            </small>
          </>
        ) : (
          <Steps def={def} ach={ach} />
        )}
      </span>
    </li>
  );
}

function AchievementGallery({ ach }: { ach: AchStore }) {
  const [filter, setFilter] = useState<'all' | 'got' | 'left'>('all');
  const got = unlockedCount(ach);
  const tiers: AchTier[] = [1, 2, 3];
  const keep = (d: AchievementDef) => (filter === 'all' ? true : filter === 'got' ? !!ach.items[d.id] : !ach.items[d.id]);
  return (
    <div className="al-ach-gallery" data-testid="al-ach-gallery">
      <div className="al-ach-progress">
        <b>
          🎖️ 모은 배지 {got} / {ACHIEVEMENTS.length}
        </b>
        <span className="al-ach-bar" role="meter" aria-valuemin={0} aria-valuemax={ACHIEVEMENTS.length} aria-valuenow={got} aria-label="모은 배지">
          <span style={{ width: `${(got / ACHIEVEMENTS.length) * 100}%` }} />
        </span>
        <span className="al-sort" role="group" aria-label="보기">
          {(
            [
              ['all', '모두'],
              ['got', '이룬 것'],
              ['left', '남은 것'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className={`al-chip${filter === id ? ' al-on' : ''}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </span>
      </div>
      <p className="al-muted al-fame-note">업적은 이 컴퓨터에 판을 넘어 쌓이고, 사람 회사만 이룰 수 있어요. 처음 이룬 회사 이름이 남아요.</p>
      {tiers.map((t) => {
        const list = ACHIEVEMENTS.filter((d) => d.tier === t);
        const shown = list.filter(keep);
        if (shown.length === 0) return null;
        return (
          <section key={t} className="al-ach-tier">
            <h3>
              <span className="al-ach-tier-dot" style={{ background: TIER_INFO[t].color }} aria-hidden="true" />
              {TIER_INFO[t].name} 배지 <small>{t === 1 ? '처음 해 보는 일' : t === 2 ? '꽤 애써야 하는 일' : '아주 어려운 일'} · {list.filter((d) => ach.items[d.id]).length}/{list.length}</small>
            </h3>
            <ul className="al-ach-grid">
              {shown.map((d) => (
                <AchCard key={d.id} def={d} ach={ach} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ 명예의 전당

export function HallList({ hof, highlight }: { hof: HofStore; highlight?: string }) {
  if (hof.games.length === 0) return <p className="al-muted al-hof-empty">아직 끝까지 마친 게임이 없어요. 게임을 끝까지 하면 사람 회사의 최종 회사 가치가 여기에 올라요!</p>;
  return (
    <ol className="al-hof-list" data-testid="al-hof-list">
      {hof.games.map((e: FameEntry, i) => (
        <li key={`${e.k}-${e.seat}`} className={`${e.k === highlight ? 'al-on' : ''}${i < 3 ? ` al-hof-top${i + 1}` : ''}`}>
          <span className="al-hof-rank" aria-label={`${i + 1}위`}>
            {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
          </span>
          <span className="al-hof-main">
            <span className="al-hof-name">
              <FameName name={e.name} seat={e.seat} airline={e.airline} />
              {e.won && <small className="al-hof-won">{e.mode === 'challenge' ? '도전 성공' : e.mode === 'scenario' ? '시나리오 성공' : '우승'}</small>}
            </span>
            <small className="al-muted">
              {e.startYear}년 시작 · {monthsText(e.months)} · {modeText(e.mode, e.challenge, e.scenario)} · {BIZ_INFO[e.model].icon} {BIZ_INFO[e.model].name}
              {e.hub && CITY[e.hub] ? ` · 본사 ${CITY[e.hub].name}` : ''} · {e.place}등 · {dateText(e.at)}
            </small>
          </span>
          <b className="al-hof-value">{fmtMoney(e.value)}</b>
        </li>
      ))}
    </ol>
  );
}

export function RecordGrid({ hof, highlight }: { hof: HofStore; highlight?: string }) {
  return (
    <ul className="al-rec-grid" data-testid="al-rec-grid">
      {RECORD_KINDS.map((k) => {
        const r = hof.records[k];
        return (
          <li key={k} className={`al-rec${r && r.k === highlight ? ' al-on' : ''}${r ? '' : ' al-rec-empty'}`}>
            <span className="al-rec-icon" aria-hidden="true">
              {RECORD_INFO[k].icon}
            </span>
            <span className="al-rec-main">
              <small>{RECORD_INFO[k].name}</small>
              <b>{r ? RECORD_INFO[k].fmt(r.value) : '—'}</b>
              {r ? (
                <>
                  <small>
                    <FameName name={r.name} seat={r.seat} airline={r.airline} />
                  </small>
                  <small className="al-muted">{r.year ? `${r.year}년` : `${r.startYear}년 시작 게임`}</small>
                </>
              ) : (
                <small className="al-muted">아직 기록이 없어요</small>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ------------------------------------------------------------------ 창

type FameTab = 'ach' | 'hof';

/** 명예의 전당 · 업적 창 (설정 화면·재무 화면·결과 화면에서 연다) */
export function FameOverlay({ onClose, tab: firstTab = 'ach', highlight }: { onClose: () => void; tab?: FameTab; highlight?: string }) {
  const { ach, hof } = useFame();
  const [tab, setTab] = useState<FameTab>(firstTab);
  const [confirm, setConfirm] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    return () => opener?.focus?.();
  }, []);
  useEffect(() => {
    // 창이 열려 있는 동안 게임 화면 단축키(Enter·숫자·Esc)는 막는다
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close.current();
      } else if (e.key === 'Enter' || /^[0-9+=_-]$/.test(e.key)) e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  const empty = unlockedCount(ach) === 0 && hof.games.length === 0 && Object.keys(hof.records).length === 0;
  const tabs: { id: FameTab; label: string }[] = [
    { id: 'ach', label: `🎖️ 업적 ${unlockedCount(ach)}/${ACHIEVEMENTS.length}` },
    { id: 'hof', label: `🏛️ 명예의 전당 ${hof.games.length}/${HOF_SIZE}` },
  ];
  const onTabKey = (e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = tab === 'ach' ? 'hof' : 'ach';
    setTab(next);
    document.getElementById(`al-fame-tab-${next}`)?.focus();
  };
  // 결과 화면 같은 다른 창 안에서 열어도 화면 전체를 덮도록 body에 그린다
  return createPortal(
    <div
      className="overlay al-fame-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="al-fame-title"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="result-card al-fame" onClick={(e) => e.stopPropagation()} data-testid="al-fame">
        <header className="al-fame-head">
          <HallArt size={60} />
          <div>
            <h2 id="al-fame-title">명예의 전당 · 업적</h2>
            <p className="al-muted">우리 가족이 하늘길 항공사에서 이룬 일과 가장 큰 회사들이에요.</p>
          </div>
        </header>
        <div className="al-fame-tabs" role="tablist" aria-label="명예의 전당 보기" onKeyDown={onTabKey}>
          {tabs.map((t) => (
            <button
              key={t.id}
              id={`al-fame-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls="al-fame-panel"
              tabIndex={tab === t.id ? 0 : -1}
              className={`al-fame-tab${tab === t.id ? ' al-on' : ''}`}
              onClick={() => setTab(t.id)}
              data-testid={`al-fame-tab-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="al-fame-body" id="al-fame-panel" role="tabpanel" aria-labelledby={`al-fame-tab-${tab}`} tabIndex={0}>
          {tab === 'ach' ? (
            <AchievementGallery ach={ach} />
          ) : (
            <>
              <h3 className="al-fame-h3">🏛️ 회사 가치 순위 (가장 큰 {HOF_SIZE}개)</h3>
              <HallList hof={hof} highlight={highlight} />
              <h3 className="al-fame-h3">📏 모든 게임 기록</h3>
              <RecordGrid hof={hof} highlight={highlight} />
              <p className="al-muted al-fame-note">끝까지 마친 게임만, 사람 회사만 올라요. 그만둔 게임은 세지 않아요.</p>
            </>
          )}
        </div>
        <footer className="al-fame-foot">
          {confirm ? (
            <span className="al-fame-confirm" role="alert">
              업적과 명예의 전당을 모두 지울까요? 되돌릴 수 없어요.
              <button
                type="button"
                className="btn btn-small al-fame-danger"
                onClick={() => {
                  resetFame();
                  setConfirm(false);
                }}
                data-testid="al-fame-reset-yes"
              >
                모두 지우기
              </button>
              <button type="button" className="btn btn-small" onClick={() => setConfirm(false)}>
                그만두기
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn-small btn-ghost" disabled={empty} onClick={() => setConfirm(true)} data-testid="al-fame-reset">
              🗑️ 기록 지우기
            </button>
          )}
          <button ref={closeBtn} type="button" className="btn btn-primary" onClick={onClose} data-testid="al-fame-close">
            닫기 <kbd>Esc</kbd>
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
