import { useEffect, useRef, useState, type ReactNode } from 'react';
import { tone } from '../../lib/sound';
import { useTimers } from '../../lib/useTimers';
import type { Speed } from '../common/speed';
import { ACHIEVEMENT, ACHIEVEMENTS, endKey, unlockedCount, unlockedIn, type Unlock } from './achievements';
import { AchBadge, HallArt } from './BadgeArt';
import { trackFame } from './fameStore';
import { FinIcon } from './FinanceArt';
import { fmtMoney } from './format';
import { HOF_SIZE, fameRanks, newRecords } from './hallOfFame';
import { FameName, FameOverlay, RECORD_INFO, useFame } from './FameGallery';
import { AIRLINE_DELAYS } from './storage';
import type { AirlineState } from './types';
import './fame.css';

/** 업적을 이뤘을 때: 반짝이는 짧은 오르막 소리 */
function fameSound(): void {
  [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.08, 0.28, 'triangle', 0.06));
  tone(2093, 0.34, 0.5, 'sine', 0.035);
}

const TOAST_MS: Record<Speed, number> = { normal: 7000, fast: 5200, turbo: 3600 };

/** 새 업적 알림 (막지 않는 작은 창, 여러 개면 한꺼번에) */
function FameToast({ items, speed, showWho, onClose, onOpen }: { items: Unlock[]; speed: Speed; showWho: boolean; onClose: () => void; onOpen: () => void }) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const t = window.setTimeout(() => close.current(), TOAST_MS[speed]);
    return () => window.clearTimeout(t);
  }, [speed]);
  // 어려운(금·은) 배지부터 보여 준다
  const shown = [...items].sort((a, b) => ACHIEVEMENT[b.id].tier - ACHIEVEMENT[a.id].tier).slice(0, 3);
  const more = items.length - shown.length;
  return (
    <div className={`al-fame-toast${AIRLINE_DELAYS[speed].fx ? '' : ' al-calm'}`} role="status" aria-live="polite" data-testid="al-fame-toast">
      <div className="al-fame-toast-head">
        <b>🎖️ {items.length > 1 ? `업적 ${items.length}개를 이뤘어요!` : '업적을 이뤘어요!'}</b>
        <button type="button" className="al-link al-small" onClick={onOpen} data-testid="al-fame-toast-open">
          모두 보기
        </button>
        <button type="button" className="btn btn-ghost btn-small al-mt-close" onClick={onClose} aria-label="업적 알림 닫기">
          ✕
        </button>
      </div>
      <ul>
        {shown.map((u, i) => {
          const def = ACHIEVEMENT[u.id];
          return (
            <li key={u.id} style={{ animationDelay: `${0.12 + i * 0.12}s` }}>
              <AchBadge def={def} unlocked size={40} decorative />
              <span>
                <b>{def.name}</b>
                <small>
                  {def.desc}
                  {showWho && <> · {u.record.by}</>}
                </small>
              </span>
            </li>
          );
        })}
      </ul>
      {more > 0 && <p className="al-fame-toast-more">그리고 {more}개 더!</p>}
    </div>
  );
}

/**
 * 게임 화면에서 한 줄로 쓰는 업적 지킴이: 한 달이 끝날 때마다(그리고 게임이 끝날 때) 업적을 살피고,
 * 새로 이루면 운항 연출이 끝난 뒤 알림을 띄운다. 게임이 끝나면 명예의 전당에도 넣는다.
 */
export function useFameTracker(game: AirlineState, speed: Speed): ReactNode {
  const [toast, setToast] = useState<{ id: number; items: Unlock[] } | null>(null);
  const [open, setOpen] = useState(false);
  const later = useTimers();
  const checked = useRef<AirlineState | null>(null);
  useEffect(() => {
    if (checked.current === game) return;
    const first = checked.current === null;
    checked.current = game;
    // 처음 열 때(이어하기)와 한 달이 끝날 때, 게임이 끝날 때만 살핀다
    if (!first && game.phase !== 'gameover' && !game.events.some((e) => e.type === 'month')) return;
    const unlocks = trackFame(game);
    // 게임이 끝나며 이룬 업적은 결과 화면에서 보여 준다
    if (unlocks.length === 0 || game.phase === 'gameover') return;
    later(
      () => {
        fameSound();
        setToast((t) => ({ id: (t?.id ?? 0) + 1, items: [...(t?.items ?? []), ...unlocks] }));
      },
      first ? 600 : AIRLINE_DELAYS[speed].sim + 250,
    );
  }, [game, speed, later]);
  const showWho = game.companies.filter((c) => c.kind === 'human').length > 1;
  return (
    <>
      {toast && game.phase !== 'gameover' && (
        <FameToast
          key={toast.id}
          items={toast.items}
          speed={speed}
          showWho={showWho}
          onClose={() => setToast(null)}
          onOpen={() => {
            setToast(null);
            setOpen(true);
          }}
        />
      )}
      {open && <FameOverlay onClose={() => setOpen(false)} />}
    </>
  );
}

/** 재무 화면 트로피 진열장 옆: 모은 업적 배지 (판을 넘어 쌓인 것) */
export function AchievementStrip() {
  const { ach } = useFame();
  const [open, setOpen] = useState(false);
  const got = ACHIEVEMENTS.filter((d) => ach.items[d.id]).sort((a, b) => ach.items[b.id].at - ach.items[a.id].at || b.tier - a.tier);
  return (
    <>
      <h5 className="al-fin-sub">
        <FinIcon kind="star" size={16} /> 업적 배지{' '}
        <small>
          {got.length}/{ACHIEVEMENTS.length} · 판을 넘어 쌓여요
        </small>
      </h5>
      <div className="al-ach-strip" data-testid="al-ach-strip">
        {got.length === 0 ? (
          <span className="al-muted">아직 모은 배지가 없어요. 첫 노선을 열어 볼까요?</span>
        ) : (
          <span className="al-ach-strip-badges">
            {got.slice(0, 7).map((d) => (
              <span key={d.id} title={`${d.name}: ${d.desc} (${ach.items[d.id].by})`}>
                <AchBadge def={d} unlocked size={30} />
              </span>
            ))}
            {got.length > 7 && <small className="al-muted">+{got.length - 7}</small>}
          </span>
        )}
        <button type="button" className="btn btn-small" onClick={() => setOpen(true)} data-testid="al-ach-strip-open">
          🏛️ 업적·명예의 전당
        </button>
      </div>
      {open && <FameOverlay onClose={() => setOpen(false)} />}
    </>
  );
}

/** 결과 화면: 이 게임에서 새로 이룬 업적과 명예의 전당 순위 */
export function FameResult({ state }: { state: AirlineState }) {
  const { ach, hof } = useFame();
  const [open, setOpen] = useState(false);
  const humans = state.companies.filter((c) => c.kind === 'human');
  if (humans.length === 0) return null;
  const ids = unlockedIn(ach, state);
  const ranks = fameRanks(hof, state);
  const recs = newRecords(hof, state);
  const key = endKey(state);
  const entered = ranks.filter((r) => r.rank !== null);
  return (
    <section className="al-fame-result" data-testid="al-fame-result">
      <div className="al-fame-result-hof">
        <HallArt size={44} />
        <div>
          {entered.length > 0 ? (
            entered.map((r) => (
              <p key={r.ci} data-testid="al-fame-rank">
                <b>{state.companies[r.ci].name}</b> — 🏛️ 명예의 전당 <b className="al-fame-rankno">{r.rank}위</b>에 올랐어요!
              </p>
            ))
          ) : (
            <p className="al-muted">
              이번 게임은 명예의 전당({HOF_SIZE}위 안)에 들지 못했어요.
              {hof.games.length >= HOF_SIZE && <> {HOF_SIZE}위는 {fmtMoney(hof.games[HOF_SIZE - 1].value)}예요.</>}
            </p>
          )}
          {recs.length > 0 && (
            <p className="al-fame-recs" title={recs.map((k) => `${RECORD_INFO[k].name} ${RECORD_INFO[k].fmt(hof.records[k]!.value)}`).join(' · ')}>
              📏 새 기록 {recs.length}개:{' '}
              {recs
                .map((k) => (recs.length <= 2 ? `${RECORD_INFO[k].icon} ${RECORD_INFO[k].name} ${RECORD_INFO[k].fmt(hof.records[k]!.value)}` : `${RECORD_INFO[k].icon} ${RECORD_INFO[k].fmt(hof.records[k]!.value)}`))
                .join(' · ')}
            </p>
          )}
        </div>
      </div>
      <div className="al-fame-result-ach">
        <b>
          🎖️ 새 업적 {ids.length}개 <small className="al-muted">· 모두 {unlockedCount(ach)}/{ACHIEVEMENTS.length}</small>
        </b>
        {ids.length === 0 ? (
          <p className="al-muted">이번 게임에서 새로 이룬 업적은 없어요.</p>
        ) : ids.length > 8 ? (
          // 많으면 배지만 (이름은 마우스를 올리거나 명예의 전당에서)
          <ul className="al-fame-new al-fame-new-icons" data-testid="al-fame-new">
            {[...ids]
              .sort((a, b) => ACHIEVEMENT[b].tier - ACHIEVEMENT[a].tier)
              .map((id) => (
                <li key={id} title={`${ACHIEVEMENT[id].name}: ${ACHIEVEMENT[id].desc}`}>
                  <AchBadge def={ACHIEVEMENT[id]} unlocked size={36} />
                </li>
              ))}
          </ul>
        ) : (
          <ul className="al-fame-new" data-testid="al-fame-new">
            {ids.map((id) => {
              const d = ACHIEVEMENT[id];
              const rec = ach.items[id];
              return (
                <li key={id} title={d.desc}>
                  <AchBadge def={d} unlocked size={34} decorative />
                  <span>
                    <b>{d.name}</b>
                    {humans.length > 1 && <FameName name={rec.by} seat={rec.seat} airline={rec.airline} />}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <button type="button" className="btn btn-small" onClick={() => setOpen(true)} data-testid="al-fame-result-open">
        🏛️ 명예의 전당 보기
      </button>
      {open && <FameOverlay onClose={() => setOpen(false)} tab={entered.length > 0 || recs.length > 0 ? 'hof' : 'ach'} highlight={key} />}
    </section>
  );
}

/** 설정 화면 카드: 🏛️ 명예의 전당 · 업적 */
export function FameCard() {
  const { ach, hof } = useFame();
  const [open, setOpen] = useState(false);
  const got = unlockedCount(ach);
  const top = hof.games[0];
  return (
    <section className="al-fame-card" data-testid="al-fame-card">
      <HallArt size={54} />
      <div className="al-fame-card-text">
        <b>🏛️ 명예의 전당 · 업적</b>
        <span className="al-muted">
          배지 {got}/{ACHIEVEMENTS.length}
          {top ? (
            <>
              {' '}
              · 1위 {top.name} {fmtMoney(top.value)}
            </>
          ) : (
            ' · 게임을 끝까지 하면 가장 큰 회사가 여기에 올라요'
          )}
        </span>
      </div>
      <button type="button" className="btn" onClick={() => setOpen(true)} data-testid="al-fame-open">
        열어 보기
      </button>
      {open && <FameOverlay onClose={() => setOpen(false)} />}
    </section>
  );
}
