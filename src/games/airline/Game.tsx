import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { withJosa } from '../../lib/korean';
import { sfx } from '../../lib/sound';
import { soloOutcome, useRecordOutcome } from '../../lib/stats';
import { useMusic } from '../../lib/useMusic';
import { useTimers } from '../../lib/useTimers';
import type { GameSettings } from '../common/settings';
import { coColors, realOf } from './brand';
import { aiManage, type AiLevel } from './ai';
import { CompanyBadge, SEAT_SHAPES } from './Art';
import { ChoiceModal } from './ChoiceModal';
import { CITY, pairKey } from './cities';
import { FinanceView } from './FinanceView';
import { FleetView } from './FleetView';
import { fmtMoney, signedMoney } from './format';
import { InfoPanel } from './InfoPanel';
import { MapView, type Pulse, type Selection } from './MapView';
import { Panel } from './Panel';
import { NewsView, ReportView } from './ReportView';
import { GameOver, QuarterReport } from './Results';
import { RoutesView, type Planner } from './RoutesView';
import { actor, applyAction, autoStopReason, idlePlanes, rankings } from './rules';
import { companyValue, monthDemandMult, routeFreq } from './simulate';
import { AIRLINE_SONG } from './song';
import { alSound } from './sounds';
import { AIRLINE_DELAYS, clearSavedAirlineGame, saveAirlineGame } from './storage';
import { mLabel, monthOf, qLabel } from './time';
import { MonthToast } from './MonthToast';
import type { AirlineAction, AirlineSetup, AirlineState, QuarterReport as Report } from './types';
import { IataBadge, Kbd } from './ui';

type Tab = 'map' | 'fleet' | 'routes' | 'finance' | 'report' | 'news';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'map', icon: '🗺️', label: '지도' },
  { id: 'fleet', icon: '🛩️', label: '비행기' },
  { id: 'routes', icon: '🧭', label: '노선' },
  { id: 'finance', icon: '💰', label: '재무' },
  { id: 'report', icon: '📈', label: '보고서' },
  { id: 'news', icon: '📰', label: '뉴스' },
];

interface GameProps {
  setup: AirlineSetup;
  initialState: AirlineState;
  settings: GameSettings;
  onSettings: (s: GameSettings) => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

let fxSeq = 1;

/** 지난 상태와 비교해 새로 생긴 지점·노선 (지도에서 반짝) */
function diffPulses(prev: AirlineState, next: AirlineState): { pulses: Pulse[]; summary: Map<number, string[]> } {
  const pulses: Pulse[] = [];
  const summary = new Map<number, string[]>();
  next.companies.forEach((c, ci) => {
    const p = prev.companies[ci];
    if (!p || p === c) return;
    const parts: string[] = [];
    const newBranches = c.branches.filter((b) => !p.branches.includes(b));
    for (const b of newBranches) pulses.push({ id: fxSeq++, kind: 'city', key: b, company: ci });
    const oldPairs = new Set(p.routes.map((r) => pairKey(r.a, r.b)));
    const newRoutes = c.routes.filter((r) => !oldPairs.has(pairKey(r.a, r.b)));
    for (const r of newRoutes) pulses.push({ id: fxSeq++, kind: 'route', key: pairKey(r.a, r.b), company: ci });
    if (newBranches.length) parts.push(`지점 ${newBranches.map((b) => CITY[b].name).join('·')}`);
    if (newRoutes.length) parts.push(`새 노선 ${newRoutes.map((r) => `${CITY[r.a].name}–${CITY[r.b].name}`).join(', ')}`);
    const dPlanes = c.planes.length - p.planes.length;
    if (dPlanes !== 0) parts.push(`비행기 ${dPlanes > 0 ? '+' : ''}${dPlanes}대`);
    const closed = p.routes.length + newRoutes.length - c.routes.length;
    if (closed > 0) parts.push(`노선 ${closed}개 닫음`);
    if (parts.length) summary.set(ci, parts);
  });
  return { pulses, summary };
}

export function AirlineGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: GameProps) {
  const [game, setGame] = useState<AirlineState>(initialState);
  const [tab, setTab] = useState<Tab>('map');
  const [selected, setSelected] = useState<Selection>(null);
  const [routeFocus, setRouteFocus] = useState<number | null>(null);
  const [planner, setPlanner] = useState<Planner | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [toast, setToast] = useState<{ id: number; report: Report } | null>(null);
  /** 사람 회사마다 자동 진행 (quarter: 분기 끝까지, event: 결정할 일이 생길 때까지) */
  const [auto, setAuto] = useState<Record<number, { mode: 'quarter' | 'event'; since: number; q: number }>>({});
  const [flying, setFlying] = useState(false);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [banner, setBanner] = useState<{ id: number; text: string; color: string | null } | null>(null);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const [zoomCmd, setZoomCmd] = useState<{ n: number; kind: 'in' | 'out' | 'reset' } | undefined>(undefined);
  const [showResult, setShowResult] = useState(true);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const seenChoice = useRef<number | null>(null);
  const prevGame = useRef<AirlineState | null>(null);
  const managedKey = useRef<string>('');
  const lastHuman = useRef<number | null>(null);
  const later = useTimers();
  const delays = AIRLINE_DELAYS[settings.speed];
  useMusic(AIRLINE_SONG, settings.music);

  const kinds = game.companies.map((c) => c.kind);
  useRecordOutcome('airline', game.phase === 'gameover', () => soloOutcome(kinds, game.result && game.result.winners.length > 0 ? game.result.winners : [-1]));

  const act = actor(game);
  const actorCo = act >= 0 ? game.companies[act] : null;
  if (actorCo?.kind === 'human') lastHuman.current = act;
  const humans = game.companies.map((c, i) => (c.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  const viewer = actorCo?.kind === 'human' ? act : (lastHuman.current ?? humans[0] ?? Math.max(0, act));
  const me = game.companies[viewer];
  const locked = flying || report !== null;
  const canAct = game.phase === 'manage' && act === viewer && actorCo?.kind === 'human' && !locked;

  // 내 차례에 새 결정 사건이 있으면 한 번 열어 준다
  const pendingChoice = canAct ? me.choice : null;
  useEffect(() => {
    if (!pendingChoice || seenChoice.current === pendingChoice.id) return;
    seenChoice.current = pendingChoice.id;
    setChoiceOpen(true);
  }, [pendingChoice]);

  // 알림은 잠깐 보였다가 사라진다
  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), Math.max(1200, delays.turn * 2));
    return () => window.clearTimeout(t);
  }, [banner, delays.turn]);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (pulses.length === 0) return;
    const t = window.setTimeout(() => setPulses([]), 2600);
    return () => window.clearTimeout(t);
  }, [pulses]);

  /** 상태가 바뀔 때마다: 저장, 지도 반짝임, 소리, 분기 결산 */
  useLayoutEffect(() => {
    if (game.phase === 'gameover') clearSavedAirlineGame();
    else saveAirlineGame(setup, game);
    const prev = prevGame.current;
    prevGame.current = game;
    if (!prev || prev === game) return;
    const { pulses: p, summary } = diffPulses(prev, game);
    if (p.length > 0 && delays.fx) setPulses(p);
    const prevActor = actor(prev);
    const monthEnd = game.events.some((e) => e.type === 'month');
    const quarterEnd = game.events.some((e) => e.type === 'quarter');
    // 컴퓨터가 한 일 요약
    if (prevActor >= 0 && prev.companies[prevActor].kind !== 'human' && summary.has(prevActor) && !monthEnd) {
      const c = game.companies[prevActor];
      setBanner({ id: fxSeq++, text: `${c.name}: ${summary.get(prevActor)!.join(' · ')}`, color: coColors(c).main });
      if (summary.get(prevActor)!.some((s) => s.startsWith('새 노선'))) alSound.chime();
    }
    // 사람이 한 행동 소리
    if (prevActor >= 0 && prev.companies[prevActor].kind === 'human') {
      for (const e of game.events) {
        if (e.type === 'branch' || e.type === 'build') alSound.bell();
        else if (e.type === 'route') alSound.chime();
        else if (e.type === 'plane') alSound.stamp();
        else if (e.type === 'sell') e.amount > 0 ? alSound.coins() : alSound.pay();
        else if (e.type === 'money') e.what === 'borrow' ? alSound.coins() : alSound.pay();
        else if (e.type === 'assign') alSound.takeoff();
        else if (e.type === 'order') alSound.stamp();
        else if (e.type === 'choice') alSound.bell();
        else if (e.type === 'alliance') e.ok ? alSound.chime() : alSound.nope();
      }
    }
    for (const e of game.events) {
      if (e.type === 'bankrupt') {
        alSound.bankrupt();
        setBanner({ id: fxSeq++, text: `🛑 ${game.companies[e.company].name} 운항 중단`, color: '#a52a2f' });
      }
    }
    if (monthEnd) {
      setFlying(true);
      const humanLeft = game.companies.some((c) => c.kind === 'human' && !c.out);
      const rep = game.report;
      const qRep = quarterEnd ? game.qReport : null;
      const yearEnd = !!qRep && !!qRep.companies[viewer]?.review;
      // 자동 진행 중(결정할 일이 생길 때까지)에는 분기 결산 창 대신 알림만 (해가 끝나면 창을 연다)
      const quietQuarter = !!auto[viewer] && auto[viewer].mode === 'event' && !yearEnd;
      later(() => {
        setFlying(false);
        if (game.phase === 'gameover') {
          alSound.win();
          return;
        }
        if (qRep && humanLeft && !quietQuarter) {
          alSound.report((qRep.companies[viewer]?.profit ?? 0) >= 0);
          setToast(null);
          setReport(qRep);
          if (yearEnd) setAuto((a) => (a[viewer] ? Object.fromEntries(Object.entries(a).filter(([k]) => Number(k) !== viewer)) : a));
          return;
        }
        if (rep && humanLeft) {
          alSound.coins();
          setToast({ id: fxSeq++, report: rep });
          return;
        }
        if (qRep) {
          const lead = rankings(game)[0];
          setBanner({ id: fxSeq++, text: `📊 ${qLabel(qRep.q)} 결산 — 1등 ${game.companies[lead].name} ${fmtMoney(companyValue(game, lead))}`, color: null });
        }
      }, delays.sim);
      return;
    }
    const turn = game.events.find((e) => e.type === 'turn');
    if (turn && turn.type === 'turn') {
      const c = game.companies[turn.company];
      if (c.kind === 'human') {
        sfx.turn();
        setBanner({ id: fxSeq++, text: `${c.name} 차례예요! ✈️`, color: coColors(c).main });
      }
    }
  }, [game, setup, delays, later, viewer, auto]);

  // 컴퓨터 차례: 생각하고 → 경영하고 → 잠깐 보여 준 뒤 차례를 마친다
  useEffect(() => {
    if (game.phase !== 'manage' || locked) return;
    const ci = actor(game);
    if (ci < 0) return;
    const c = game.companies[ci];
    if (c.kind === 'human') return;
    const key = `${game.t}-${game.turnPos}`;
    if (managedKey.current !== key) {
      const t = window.setTimeout(() => {
        managedKey.current = key;
        const next = aiManage(game, ci, c.kind as AiLevel);
        setGame(next === game ? applyAction(game, { type: 'endTurn' }) : next);
      }, delays.think);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setGame((g) => (actor(g) === ci && `${g.t}-${g.turnPos}` === key ? applyAction(g, { type: 'endTurn' }) : g)), delays.turn + delays.step);
    return () => window.clearTimeout(t);
  }, [game, locked, delays]);

  // 자동 진행: 내 차례에 멈출 까닭이 없으면 잠깐 뒤에 이번 달을 마친다
  const myAuto = auto[viewer];
  useEffect(() => {
    if (!myAuto || !canAct || choiceOpen) return;
    const stopAuto = (why: string) => {
      setAuto((a) => Object.fromEntries(Object.entries(a).filter(([k]) => Number(k) !== viewer)));
      setNotice({ id: fxSeq++, text: `⏸ 자동 진행 멈춤: ${why}` });
      alSound.select();
    };
    if (myAuto.mode === 'quarter' && game.q !== myAuto.q) {
      stopAuto('분기가 끝났어요');
      return;
    }
    const why = autoStopReason(game, viewer, myAuto.since);
    if (why) {
      stopAuto(why);
      return;
    }
    const t = window.setTimeout(() => setGame((g) => (actor(g) === viewer ? applyAction(g, { type: 'endTurn' }) : g)), Math.max(120, delays.turn));
    return () => window.clearTimeout(t);
  }, [myAuto, canAct, choiceOpen, game, viewer, delays.turn]);

  const startAuto = (mode: 'quarter' | 'event') => {
    if (!canAct) return;
    const why = autoStopReason(game, viewer, game.nextId);
    if (why) {
      setNotice({ id: fxSeq++, text: `먼저 살펴볼 일이 있어요: ${why}` });
      alSound.nope();
      return;
    }
    setAuto((a) => ({ ...a, [viewer]: { mode, since: game.nextId, q: game.q } }));
  };
  const stopAuto = () => setAuto((a) => Object.fromEntries(Object.entries(a).filter(([k]) => Number(k) !== viewer)));

  // ------------------------------------------------------------ 사람의 행동
  const say = useCallback((text: string) => setNotice({ id: fxSeq++, text }), []);

  const perform = useCallback(
    (a: AirlineAction) => {
      if (!canAct) return;
      const next = applyAction(game, a);
      if (next === game) {
        alSound.nope();
        say('지금은 할 수 없어요.');
        return;
      }
      setGame(next);
    },
    [canAct, game, say],
  );

  const apply = useCallback(
    (fn: (s: AirlineState) => AirlineState) => {
      if (!canAct) return;
      const next = fn(game);
      if (next === game) {
        alSound.nope();
        say('지금은 할 수 없어요.');
        return;
      }
      setGame(next);
    },
    [canAct, game, say],
  );

  const endTurn = useCallback(() => {
    if (!canAct) return;
    alSound.select();
    setPlanner(null);
    setGame(applyAction(game, { type: 'endTurn' }));
  }, [canAct, game]);

  const planRoute = (from: string, to?: string) => {
    const mine = game.companies[viewer];
    let p: Planner;
    if (mine.branches.includes(from)) p = { from, to: to ?? null };
    else if (to && mine.branches.includes(to)) p = { from: to, to: from };
    else p = { from: mine.hub, to: from };
    setPlanner(p);
    setTab('routes');
  };
  const editRoute = (id: number) => {
    setPlanner(null);
    setRouteFocus(id);
    setTab('routes');
  };
  const showCity = (id: string) => {
    setSelected({ kind: 'city', id });
    setTab('map');
  };

  // 키보드
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) && (t as HTMLInputElement).type !== 'range' && (t as HTMLInputElement).type !== 'checkbox';
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (choiceOpen) return;
      if (report) {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          setReport(null);
        }
        return;
      }
      if (typing) return;
      // 탭 단추에 초점이 있을 때는 Enter로 분기를 마쳐도 된다 (이미 고른 탭을 또 누를 일은 없으니까)
      const onButton = (t?.tagName === 'BUTTON' && t.getAttribute('role') !== 'tab') || t?.getAttribute('role') === 'button';
      const idx = ['1', '2', '3', '4', '5', '6'].indexOf(e.key);
      if (idx >= 0) {
        setTab(TABS[idx].id);
        return;
      }
      if (e.key === 'Enter' && !onButton) {
        e.preventDefault();
        endTurn();
      } else if (e.key === 'Escape') {
        setSelected(null);
        setPlanner(null);
      } else if (tab === 'map' && (e.key === '+' || e.key === '=')) setZoomCmd((z) => ({ n: (z?.n ?? 0) + 1, kind: 'in' }));
      else if (tab === 'map' && (e.key === '-' || e.key === '_')) setZoomCmd((z) => ({ n: (z?.n ?? 0) + 1, kind: 'out' }));
      else if (tab === 'map' && e.key === '0') setZoomCmd((z) => ({ n: (z?.n ?? 0) + 1, kind: 'reset' }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ------------------------------------------------------------ 안내
  let hint: ReactNode;
  const idle = idlePlanes(me).length;
  const empty = me.routes.filter((r) => routeFreq(me, r.id) === 0).length;
  if (game.phase === 'gameover') hint = game.result?.reason ?? '게임이 끝났어요.';
  else if (flying) hint = `✈️ ${mLabel(game.report?.t ?? game.t)} 한 달 동안 비행기들이 날고 있어요…`;
  else if (report) hint = '분기 결산을 보고 있어요. Enter로 넘겨요.';
  else if (!actorCo || actorCo.kind !== 'human') hint = `${withJosa(actorCo?.name ?? '', '이/가')} 경영하고 있어요…`;
  else if (myAuto) hint = myAuto.mode === 'quarter' ? '⏩ 분기 끝까지 맡겨 두었어요. 일이 생기면 멈춰요.' : '⏩ 결정할 일이 생길 때까지 자동으로 넘기고 있어요.';
  else if (notice) hint = <span className="al-notice">{notice.text}</span>;
  else if (me.crisis > 0) hint = '⚠ 돈이 모자라요! 손해 보는 노선을 닫고 쉬는 비행기를 팔거나 대출을 받아요. 이번에도 모자라면 운항을 멈춰야 해요.';
  else if (me.choice)
    hint = (
      <>
        결정할 일이 있어요: <b>{me.choice.title}</b>{' '}
        <button type="button" className="al-link" onClick={() => setChoiceOpen(true)}>
          고르기
        </button>
      </>
    );
  else if (me.planes.length === 0 && me.routes.length === 0)
    hint = (
      <>
        지도 아래 <b>🧑‍💼 경영 비서</b>가 권하는 첫 노선을 ‘노선 열기’로 열거나, 지도에서 도시를 눌러 직접 시작해 보세요.
      </>
    );
  else if (idle > 0) hint = `쉬는 비행기 ${idle}대가 있어요. 노선 화면(3)에서 넣어 주세요.`;
  else if (empty > 0) hint = `비행기 없는 노선이 ${empty}개 있어요. 노선 화면에서 비행기를 넣어요.`;
  else
    hint = (
      <>
        할 일을 다 했으면 이번 달을 마쳐요. <Kbd>Enter</Kbd>
      </>
    );

  const myColor = coColors(me);
  // 이번 달 손님 분위기 (우리 노선, 없으면 본사에서 큰 도시로)
  const moodText = (() => {
    const m0 = monthOf(game.t) - 1;
    const pairs = me.routes.length ? me.routes.map((r) => [r.a, r.b] as const) : [[me.hub, me.hub === 'london' ? 'paris' : 'london'] as const];
    const v = pairs.reduce((sum, [a, b]) => sum + monthDemandMult(a, b, m0), 0) / pairs.length;
    return v >= 1.1 ? '손님 많은 달 ▲' : v <= 0.92 ? '손님 적은 달 ▼' : '손님 보통';
  })();
  const value = companyValue(game, viewer);
  const rank = rankings(game).indexOf(viewer) + 1;
  const lastProfit = game.report?.companies[viewer]?.profit;

  let content: ReactNode;
  if (tab === 'map')
    content = (
      <div className="al-map-tab">
        <MapView state={game} viewer={viewer} selected={selected} onSelect={setSelected} pulses={pulses} flying={flying} fx={delays.fx} zoomCmd={zoomCmd} />
        <InfoPanel
          state={game}
          viewer={viewer}
          canAct={canAct}
          perform={perform}
          setState={(s) => apply(() => s)}
          onPlanRoute={planRoute}
          onEditRoute={editRoute}
          onSelect={setSelected}
          selected={selected}
          onOpenChoice={() => setChoiceOpen(true)}
          onAuto={() => startAuto('event')}
        />
      </div>
    );
  else if (tab === 'fleet') content = <FleetView state={game} viewer={viewer} canAct={canAct} perform={perform} onEditRoute={editRoute} onGoRoutes={() => setTab('routes')} />;
  else if (tab === 'routes')
    content = (
      <RoutesView
        state={game}
        viewer={viewer}
        canAct={canAct}
        perform={perform}
        apply={apply}
        focus={routeFocus}
        onFocus={setRouteFocus}
        planner={planner}
        onPlanner={setPlanner}
        onShowCity={showCity}
      />
    );
  else if (tab === 'finance') content = <FinanceView state={game} viewer={viewer} canAct={canAct} perform={perform} />;
  else if (tab === 'report') content = <ReportView state={game} viewer={viewer} />;
  else content = <NewsView state={game} onCity={showCity} viewer={viewer} />;

  return (
    <div className="al-game">
      <div className="al-main">
        <header className="al-topbar">
          <div className="al-date" title="지금 분기">
            <b data-testid="al-date">{mLabel(game.t)}</b>
            <small title="이번 달 우리 노선 손님이 한 해 평균과 견주어 얼마나 많은지">{moodText}</small>
          </div>
          <div className="al-me" style={{ '--al-co': myColor.main } as CSSProperties}>
            <CompanyBadge color={myColor.main} shape={SEAT_SHAPES[me.seat]} size={22} />
            {realOf(me) && <IataBadge airline={realOf(me)!} small />}
            <span className="al-me-name">
              <b>{me.name}</b>
              <small>
                {rank}등 · 가치 {fmtMoney(value)}
              </small>
            </span>
            <span className="al-me-cash">
              <small>현금</small>
              <b className={me.cash < 0 ? 'al-neg' : ''} data-testid="al-cash">
                {fmtMoney(me.cash)}
              </b>
            </span>
            {lastProfit !== undefined && (
              <span className="al-me-cash">
                <small>지난달</small>
                <b className={lastProfit < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(lastProfit)}</b>
              </span>
            )}
          </div>
          <nav className="al-tabs" role="tablist" aria-label="화면">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`al-tab${tab === t.id ? ' al-on' : ''}`}
                onClick={() => setTab(t.id)}
                data-testid={`al-tab-${t.id}`}
                title={`${t.label} (${i + 1})`}
              >
                <span aria-hidden="true">{t.icon}</span>
                <span className="al-tab-label">{t.label}</span>
                {t.id === 'fleet' && idle > 0 && <span className="al-tab-badge">{idle}</span>}
                <kbd className="al-tab-kbd">{i + 1}</kbd>
              </button>
            ))}
          </nav>
        </header>
        <div className="al-stage">
          <div className="al-content">{content}</div>
          {flying && delays.fx && (
            <div className="al-sim" role="status" style={{ '--al-sim': `${delays.sim}ms` } as CSSProperties}>
              ✈️ {mLabel(game.report?.t ?? game.t)} 운항 중… <span className="al-sim-bar" />
            </div>
          )}
          {toast && !report && !flying && <MonthToast key={toast.id} state={game} report={toast.report} viewer={viewer} onClose={() => setToast(null)} onDetail={() => {
            setToast(null);
            setTab('report');
          }} />}
          {banner && (
            <div className="al-banner" key={banner.id} style={{ '--al-pc': banner.color ?? 'var(--accent)' } as CSSProperties} role="status">
              {banner.text}
            </div>
          )}
        </div>
        <p className="al-sr" aria-live="polite">
          {game.log.at(-1)?.text ?? ''}
        </p>
      </div>

      <Panel
        state={game}
        viewer={viewer}
        hint={hint}
        canEnd={canAct}
        busy={flying ? '✈️ 운항 중…' : !canAct && game.phase === 'manage' && actorCo?.kind !== 'human' ? `${actorCo?.name} 경영 중…` : null}
        onEndTurn={endTurn}
        auto={myAuto?.mode ?? null}
        onAuto={startAuto}
        onStopAuto={stopAuto}
        settings={settings}
        onSettings={onSettings}
        onNewGame={() => {
          if (game.phase === 'gameover' || window.confirm('지금 게임을 그만두고 새 게임을 할까요? (하던 게임은 저장되어 있어요)')) onChangeSetup();
        }}
        onExit={onExit}
      />

      {choiceOpen && !report && !flying && me.choice && (
        <ChoiceModal
          state={game}
          viewer={viewer}
          canAct={canAct}
          onChoose={(option) => {
            perform({ type: 'choose', option });
            setChoiceOpen(false);
          }}
          onLater={() => setChoiceOpen(false)}
        />
      )}
      {report && !flying && (
        <QuarterReport
          state={game}
          report={report}
          viewer={viewer}
          onClose={() => setReport(null)}
          onDetail={() => {
            setReport(null);
            setTab('report');
          }}
        />
      )}
      {game.phase === 'gameover' && !flying && showResult && game.result && (
        <GameOver state={game} onRestart={onRestart} onChangeSetup={onChangeSetup} onExit={onExit} onLook={() => setShowResult(false)} />
      )}
      {game.phase === 'gameover' && !showResult && (
        <button type="button" className="btn btn-primary al-reopen" onClick={() => setShowResult(true)}>
          🏆 결과 다시 보기
        </button>
      )}
    </div>
  );
}
