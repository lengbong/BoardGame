import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { PassScreen } from '../../components/PassScreen';
import { withJosa } from '../../lib/korean';
import { sfx } from '../../lib/sound';
import { soloOutcome, useRecordOutcome } from '../../lib/stats';
import { useMusic } from '../../lib/useMusic';
import { useTimers } from '../../lib/useTimers';
import { SEAT_COLORS } from '../common/players';
import type { GameSettings } from '../common/settings';
import { aiStep, cheapestPath, type AiLevel } from './ai';
import { SymbolIcon, TicketBack, TicketFace } from './art';
import { Board, type ClaimFx, type FloatFx } from './Board';
import { CITY, COLOR_INFO, PLAN, ROUTES, ROUTE_POINTS, STAMP_AT, STAMP_FIRST_POINTS, STAMP_LATER_POINTS, routeMid, routeName } from './map';
import { Panel } from './Panel';
import { GameOver } from './Results';
import {
  actor,
  affordableRoutes,
  applyAction,
  canPass,
  canTakeAny,
  claimProblem,
  completedPlans,
  isConnected,
  largestNetwork,
  paymentCards,
  paymentOptions,
  playerName,
  type Payment,
} from './rules';
import { RAILS_SONG } from './song';
import { rlSound } from './sounds';
import { Station } from './Station';
import { RAILS_DELAYS, clearSavedRailsGame, saveRailsGame } from './storage';
import type { CardKind, RailsAction, RailsSetup, RailsState } from './types';

interface RailsGameProps {
  setup: RailsSetup;
  initialState: RailsState;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

interface View {
  /** 표와 계획을 보여 줄 사람 */
  owner: number | null;
  /** 사람이 2명 이상이고 가리는 모드 */
  coverMode: boolean;
  /** 차례 넘김 화면이 필요하다 */
  needPass: boolean;
}

/** 지금 누구의 표와 계획을 보여 줄지 정한다 */
function computeView(state: RailsState, revealed: number | null): View {
  const humans = state.players.map((p, i) => (p.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  const coverMode = state.options.handView === 'cover' && humans.length >= 2;
  const act = actor(state);
  if (act >= 0 && state.players[act].kind === 'human') {
    const needPass = coverMode && revealed !== act;
    return { owner: needPass ? null : act, coverMode, needPass };
  }
  // 컴퓨터끼리만 하거나 모두 공개면 차례인 사람 것을 보여 준다
  if ((state.options.handView === 'open' || humans.length === 0) && act >= 0) return { owner: act, coverMode, needPass: false };
  if (humans.length === 1) return { owner: humans[0], coverMode, needPass: false };
  if (!coverMode && humans.length > 0) return { owner: humans[0], coverMode, needPass: false };
  return { owner: null, coverMode, needPass: false };
}

type Timed<T> = T & { until: number };

interface FlyerSpec {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  kind: CardKind | null;
  delay: number;
  duration: number;
  w0: number;
  w1: number;
}

let fxSeq = 1;
const NO_ROUTES: ReadonlySet<number> = new Set<number>();
const NO_KINDS: ReadonlySet<CardKind> = new Set<CardKind>();
const NO_CITIES: string[] = [];

export function RailsGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: RailsGameProps) {
  const [game, setGame] = useState<RailsState>(initialState);
  const [anim, setAnim] = useState<{ until: number } | null>(null);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [hoverRoute, setHoverRoute] = useState<number | null>(null);
  const [selRoute, setSelRoute] = useState<number | null>(null);
  const [payIdx, setPayIdx] = useState(0);
  const [hoverPlan, setHoverPlan] = useState<number | null>(null);
  const [hoverColor, setHoverColor] = useState<CardKind | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  const [flyers, setFlyers] = useState<Timed<FlyerSpec>[]>([]);
  const [floats, setFloats] = useState<FloatFx[]>([]);
  const [claimFx, setClaimFx] = useState<ClaimFx | null>(null);
  const [windowKeys, setWindowKeys] = useState<number[]>([0, 0, 0, 0, 0]);
  const [recent, setRecent] = useState<Timed<{ kinds: ReadonlySet<CardKind> }> | null>(null);
  const [notice, setNotice] = useState<Timed<{ text: string }> | null>(null);
  const [banner, setBanner] = useState<Timed<{ text: string; tone: 'final' | 'plan' | 'info' }> | null>(null);
  const [showNet, setShowNet] = useState<number | null>(null);
  const [resultHidden, setResultHidden] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const rects = useRef(new Map<string, DOMRect>());
  const lastView = useRef<View | null>(null);
  const prevGame = useRef<RailsState | null>(null);
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  const later = useTimers();
  const delays = RAILS_DELAYS[settings.speed];
  useMusic(RAILS_SONG, settings.music);
  useRecordOutcome('rails', game.phase === 'gameover', () =>
    soloOutcome(
      game.players.map((p) => p.kind),
      game.winners,
    ),
  );

  const locked = anim !== null;
  const act = actor(game);
  const actorPlayer = act >= 0 ? game.players[act] : null;
  const view = computeView(game, revealed);
  const humanActs = actorPlayer?.kind === 'human';
  const ready = humanActs && view.owner === act && !locked;
  const myPlay = ready && game.phase === 'play';
  const choosing = ready && game.phase === 'plans';
  const canTake = myPlay && canTakeAny(game);
  const canDrawPlans = myPlay && game.drawn === 0 && game.planDeck.length > 0;
  const showPass = view.needPass && !locked;
  const fx = delays.fx;

  // 끝난 연출 조각을 치운다.
  useEffect(() => {
    const times = [...flyers.map((f) => f.until), ...floats.map((f) => f.until), recent?.until, notice?.until, banner?.until].filter((t): t is number => t !== undefined);
    if (times.length === 0) return;
    const t = window.setTimeout(
      () => {
        const now = performance.now() + 5;
        const alive = <T extends { until: number }>(list: T[]) => (list.some((x) => x.until <= now) ? list.filter((x) => x.until > now) : list);
        const single = <T extends { until: number }>(v: T | null) => (v && v.until <= now ? null : v);
        setFlyers(alive);
        setFloats(alive);
        setRecent(single);
        setNotice(single);
        setBanner(single);
      },
      Math.max(0, Math.min(...times) - performance.now()) + 10,
    );
    return () => window.clearTimeout(t);
  }, [flyers, floats, recent, notice, banner]);

  useEffect(() => {
    if (!anim) return;
    const t = window.setTimeout(() => setAnim(null), Math.max(0, anim.until - performance.now()));
    return () => window.clearTimeout(t);
  }, [anim]);

  // 차례가 바뀌면 고른 것을 지운다. 사람 차례가 아니면 다시 가린다.
  useEffect(() => {
    setSelRoute(null);
    setPicked(new Set());
  }, [game.turn]);
  useEffect(() => {
    if (!humanActs) setRevealed(null);
  }, [humanActs, game.turn]);

  const reg = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) els.current.set(key, el);
      else els.current.delete(key);
    },
    [],
  );

  /** 화면 위치(px, 게임 화면 기준) */
  const local = useCallback((r: DOMRect | undefined | null) => {
    const m = rootRef.current?.getBoundingClientRect();
    if (!r || !m || r.width === 0) return null;
    return { x: r.left + r.width / 2 - m.left, y: r.top + r.height / 2 - m.top, w: r.width };
  }, []);

  /** 지도 좌표 → 화면 위치(px, 게임 화면 기준) */
  const mapPoint = useCallback((x: number, y: number) => {
    const svg = svgRef.current;
    const m = rootRef.current?.getBoundingClientRect();
    const ctm = svg?.getScreenCTM();
    if (!svg || !m || !ctm) return null;
    const p = new DOMPoint(x, y).matrixTransform(ctm);
    return { x: p.x - m.left, y: p.y - m.top, scale: ctm.a };
  }, []);

  const flash = useCallback((text: string) => {
    sfx.noMove();
    setNotice({ text, until: performance.now() + 2600 });
  }, []);

  /** 상태가 바뀔 때마다: 저장 + 마지막 행동의 연출 */
  useLayoutEffect(() => {
    if (game.phase === 'gameover') clearSavedRailsGame();
    else saveRailsGame(setup, game);

    const before = prevGame.current;
    prevGame.current = game;
    if (before === null || before === game) return;

    const fly = delays.fly;
    const beforeView = lastView.current ?? computeView(before, revealedRef.current);
    const now = (key: string) => local(els.current.get(key)?.getBoundingClientRect());
    const was = (key: string) => local(rects.current.get(key)) ?? now(key);
    const t0 = performance.now();
    const newFlyers: Timed<FlyerSpec>[] = [];
    const sound = (play: () => void, at: number) => (at <= 0 ? play() : later(play, at));
    const flyer = (from: { x: number; y: number } | null, to: { x: number; y: number } | null, kind: CardKind | null, delay: number, w0: number, w1: number) => {
      if (fly <= 0 || !from || !to) return;
      newFlyers.push({ id: fxSeq++, x: from.x, y: from.y, tx: to.x, ty: to.y, kind, delay, duration: fly, w0, w1, until: t0 + delay + fly + 40 });
    };
    const float = (x: number, y: number, text: string, tone: FloatFx['tone'], at: number) => {
      if (!fx) return;
      const f: FloatFx = { id: fxSeq++, x, y, text, tone, until: 0 };
      later(() => setFloats((list) => [...list, { ...f, until: performance.now() + 1700 }]), Math.max(0, at));
    };
    const sees = (player: number) => beforeView.owner === player || (game.options.handView === 'open' && !beforeView.needPass);

    let total = 0;
    let cursor = 0;
    for (const e of game.events) {
      switch (e.type) {
        case 'take': {
          const mine = beforeView.owner === e.player;
          const from = e.from === 'window' ? was(`win-${e.index}`) : was('deck');
          const to = mine ? (now(`hand-${e.card}`) ?? now('hand')) : now(`player-${e.player}`);
          flyer(from, to, e.from === 'window' || mine ? e.card : null, 0, 52, mine ? 34 : 20);
          sound(() => (e.from === 'window' ? rlSound.slip() : rlSound.deck()), 0);
          if (mine) setRecent({ kinds: new Set([e.card]), until: t0 + fly + 1400 });
          // 사람이 첫 장을 받을 때는 기다리지 않고 바로 두 장째를 받을 수 있게 (컴퓨터나 차례 끝은 날아가는 모습을 끝까지 보여 준다)
          if (game.players[e.player].kind !== 'human' || actor(game) !== e.player) total = Math.max(total, fly + 60);
          break;
        }
        case 'refill':
          setWindowKeys((keys) => keys.map((k, i) => (i === e.index ? k + 1 : k)));
          break;
        case 'reshuffle':
          if (fx) setBanner({ text: `🔀 버린 표 ${e.count}장을 섞어서 더미에 넣었어요`, tone: 'info', until: t0 + 1800 });
          sound(() => rlSound.reshuffle(), 0);
          break;
        case 'claim': {
          const r = ROUTES[e.route];
          const mid = routeMid(r);
          const midPx = mapPoint(mid.x, mid.y);
          const mine = beforeView.owner === e.player;
          e.paid.slice(0, 5).forEach((kind, j) => {
            const from = mine ? was(`hand-${kind}`) : was(`player-${e.player}`);
            flyer(from, midPx, kind, j * 70, mine ? 34 : 24, 16);
          });
          const carsAt = fly > 0 ? fly + Math.min(4, e.paid.length) * 70 : 0;
          const step = delays.car;
          if (step > 0) setClaimFx({ route: e.route, key: fxSeq++, step, delay: carsAt });
          const done = carsAt + r.length * step;
          sound(() => rlSound.chug(r.length, step || 60), carsAt);
          sound(() => rlSound.whistle(), done);
          float(mid.x, mid.y - 8, `+${e.points}`, 'points', done);
          cursor = done + (fx ? 250 : 0);
          total = Math.max(total, cursor + delays.after);
          break;
        }
        case 'stamp': {
          const c = CITY[e.city];
          float(c.x, c.y - 18, `🏅+${e.points}`, 'stamp', cursor);
          sound(() => rlSound.stamp(e.first), cursor);
          if (fx && e.first) setBanner({ text: `🏅 ${withJosa(playerName(game.players[e.player]), '이/가')} ${c.name} ${STAMP_AT[e.city].name} 첫 도장을 받았어요! (+${e.points})`, tone: 'info', until: t0 + cursor + 2000 });
          cursor += fx ? 380 : 0;
          total = Math.max(total, cursor + delays.after);
          break;
        }
        case 'planDone': {
          if (!sees(e.player)) break;
          const plan = PLAN[e.plan];
          sound(() => rlSound.planDone(), cursor);
          if (fx) {
            later(() => setBanner({ text: `🎉 여행 계획 완성! ${CITY[plan.a].name} → ${CITY[plan.b].name} (끝나면 +${plan.points}점)`, tone: 'plan', until: performance.now() + 2200 }), cursor);
            const ca = CITY[plan.a];
            const cb = CITY[plan.b];
            float(ca.x, ca.y - 16, '✓', 'plan', cursor);
            float(cb.x, cb.y - 16, '✓', 'plan', cursor);
          }
          cursor += fx ? 500 : 0;
          total = Math.max(total, cursor + delays.after);
          break;
        }
        case 'planOffer':
          sound(() => rlSound.plans(), 0);
          break;
        case 'planKeep':
          sound(() => rlSound.select(true), 0);
          total = Math.max(total, fx ? 250 : 0);
          break;
        case 'finalRound':
          sound(() => rlSound.bell(), cursor);
          later(() => setBanner({ text: `🔔 ${withJosa(playerName(game.players[e.player]), '이/가')} 기차를 거의 다 썼어요! 모두 한 번씩만 더 해요`, tone: 'final', until: performance.now() + 2600 }), cursor);
          total = Math.max(total, cursor + (fx ? 1400 : 300));
          break;
        case 'pass':
          if (fx) setBanner({ text: `${playerName(game.players[e.player])}: 할 수 있는 일이 없어서 넘겨요`, tone: 'info', until: t0 + 1500 });
          total = Math.max(total, fx ? 700 : 0);
          break;
        case 'gameover':
          total = Math.max(total, cursor + (fx ? 900 : 200));
          break;
        case 'deal':
          break;
      }
    }

    if (newFlyers.length > 0) setFlyers((list) => [...list.filter((x) => x.until > t0), ...newFlyers]);

    // 사람이 무언가 정할 차례가 오면 알림음
    const nextAct = actor(game);
    if (nextAct >= 0 && game.players[nextAct].kind === 'human' && actor(before) !== nextAct) sound(() => sfx.turn(), total + 50);
    if (total > 0) setAnim({ until: performance.now() + total });
  }, [game, setup, delays, fx, local, mapPoint, later]);

  // 그린 뒤 위치 기억 (다음 연출의 출발점)
  useLayoutEffect(() => {
    const m = new Map<string, DOMRect>();
    els.current.forEach((el, k) => m.set(k, el.getBoundingClientRect()));
    rects.current = m;
    lastView.current = view;
  });

  // 컴퓨터 차례 (그 순간의 최신 상태를 보고 정한다)
  useEffect(() => {
    if (locked || game.phase === 'gameover' || act < 0 || game.players[act].kind === 'human') return;
    const wait = game.phase === 'plans' ? delays.think * 0.8 : game.drawn > 0 ? delays.think * 0.55 : delays.think;
    const t = window.setTimeout(() => {
      setGame((g) => {
        const a = actor(g);
        if (a !== act || g.phase === 'gameover' || g.players[a].kind === 'human') return g;
        return aiStep(g, g.players[a].kind as AiLevel);
      });
    }, wait);
    return () => window.clearTimeout(t);
  }, [game, locked, act, delays]);

  // ------------------------------------------------------------ 사람의 행동
  const perform = useCallback((a: RailsAction) => {
    setGame((g) => {
      const next = applyAction(g, a);
      return next;
    });
  }, []);

  const notMyTurnReason = (): string => {
    if (game.phase === 'gameover') return '게임이 끝났어요.';
    if (locked) return '잠깐만요, 움직이는 중이에요.';
    if (!humanActs) return `지금은 ${playerName(actorPlayer!)} 차례예요.`;
    if (game.phase === 'plans') return '먼저 여행 계획을 골라 주세요.';
    return '';
  };

  const takeWindow = (i: number) => {
    if (!myPlay) return flash(notMyTurnReason() || '지금은 표를 받을 수 없어요.');
    if (!game.window[i]) return flash('빈 칸이에요.');
    setSelRoute(null);
    perform({ type: 'take', from: 'window', index: i });
  };
  const takeDeck = () => {
    if (!myPlay) return flash(notMyTurnReason() || '지금은 표를 받을 수 없어요.');
    if (game.deck.length + game.discard.length === 0) return flash('더미에 표가 없어요.');
    setSelRoute(null);
    perform({ type: 'take', from: 'deck' });
  };
  const drawPlans = () => {
    if (!myPlay) return flash(notMyTurnReason() || '지금은 계획을 뽑을 수 없어요.');
    if (game.drawn > 0) return flash('표를 한 장 더 받아야 차례가 끝나요.');
    if (game.planDeck.length === 0) return flash('여행 계획 더미가 비었어요.');
    setSelRoute(null);
    perform({ type: 'drawPlans' });
  };
  const togglePick = (id: number) => {
    if (!choosing) return;
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    rlSound.select(next.has(id));
    setPicked(next);
  };
  const confirmPlans = () => {
    if (!choosing || !game.offer) return;
    if (picked.size < game.offer.minKeep) return flash(`${game.offer.minKeep}장 이상 골라야 해요.`);
    perform({ type: 'keepPlans', keep: game.offer.plans.filter((id) => picked.has(id)) });
    setPicked(new Set());
    setHoverPlan(null);
  };

  // 고른 길: 값 치르는 방법들
  const selected = selRoute !== null ? ROUTES[selRoute] : null;
  const payer = view.owner;
  const payOptions: Payment[] = useMemo(() => (selected && payer !== null ? paymentOptions(game.players[payer].hand, selected) : []), [selected, payer, game]);
  const selProblem = selected
    ? !myPlay
      ? notMyTurnReason() || null
      : game.drawn > 0
        ? '표를 한 장 더 받아야 차례가 끝나요.'
        : claimProblem(game, act, selected.id)
    : null;

  /** 길을 누르면 깔기 창을 열고, 열린 길을 한 번 더 누르면(또는 Enter) 깐다 */
  const selectRoute = (id: number) => {
    if (selRoute === id) {
      if (!selProblem && myPlay && game.owners[id] === null) confirmClaim();
      else setSelRoute(null);
      return;
    }
    setSelRoute(id);
    setPayIdx(0);
  };
  const confirmClaim = () => {
    if (!selected || selProblem || !myPlay) {
      if (selProblem) flash(selProblem);
      return;
    }
    const pay = payOptions[Math.min(payIdx, payOptions.length - 1)];
    if (!pay) return;
    setSelRoute(null);
    setHoverRoute(null);
    perform({ type: 'claim', route: selected.id, color: pay.color, wilds: pay.wilds });
  };

  // 키보드
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      if (showPass || e.ctrlKey || e.metaKey || e.altKey) return;
      const onButton = t?.tagName === 'BUTTON';
      if (e.key === 'Escape') {
        setSelRoute(null);
        return;
      }
      if (choosing && game.offer) {
        const n = Number(e.key);
        if (n >= 1 && n <= game.offer.plans.length) {
          e.preventDefault();
          togglePick(game.offer.plans[n - 1]);
        } else if (e.key === 'Enter' && !onButton) {
          e.preventDefault();
          confirmPlans();
        }
        return;
      }
      if (selected) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const len = Math.max(1, payOptions.length);
          setPayIdx((i) => (i + (e.key === 'ArrowLeft' ? -1 : 1) + len) % len);
          return;
        }
        if (e.key === 'Enter' && !onButton && t?.getAttribute('role') !== 'button') {
          e.preventDefault();
          confirmClaim();
          return;
        }
      }
      if (game.phase !== 'play') return;
      const n = Number(e.key);
      if (n >= 1 && n <= 5) {
        e.preventDefault();
        takeWindow(n - 1);
      } else if (e.code === 'KeyD') {
        e.preventDefault();
        takeDeck();
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        drawPlans();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ------------------------------------------------------------ 지도 강조
  const affordable = useMemo(() => (myPlay && game.drawn === 0 ? new Set(affordableRoutes(game, act)) : NO_ROUTES), [myPlay, game, act]);
  const focusPlan = hoverPlan !== null ? PLAN[hoverPlan] : null;
  const focusCities = focusPlan ? [focusPlan.a, focusPlan.b] : NO_CITIES;
  const focusRoutes = useMemo(() => {
    if (!focusPlan || view.owner === null) return NO_ROUTES;
    const p = game.players[view.owner];
    if (isConnected(p.routes, focusPlan.a, focusPlan.b)) return new Set(p.routes);
    const path = cheapestPath(game, view.owner, focusPlan.a, focusPlan.b);
    return path ? new Set(path.open) : NO_ROUTES;
  }, [focusPlan, view.owner, game]);
  const netShown = game.phase === 'gameover' && showNet !== null ? { player: showNet, cities: largestNetwork(game.players[showNet].routes).cities } : null;

  // ------------------------------------------------------------ 안내 문구
  const actName = actorPlayer ? playerName(actorPlayer) : '';
  let hint: string;
  if (game.phase === 'gameover') hint = `${game.winners.map((i) => playerName(game.players[i])).join(', ')} 우승! 여행이 끝났어요.`;
  else if (view.needPass) hint = `${actName} 차례예요. '내 표와 계획 보기'를 누르세요.`;
  else if (choosing && game.offer)
    hint = game.offer.initial
      ? `여행 계획 ${game.offer.plans.length}장 중 ${game.offer.minKeep}장 이상 골라 가져요. (숫자키 1~${game.offer.plans.length}, Enter)`
      : `새 여행 계획 중 ${game.offer.minKeep}장 이상 가져요. 남은 것은 더미 아래로 돌아가요.`;
  else if (myPlay && game.drawn > 0) hint = '표를 한 장 더 받아요. (창구 1~5 또는 더미 D)';
  else if (myPlay) hint = '할 일을 하나 골라요!';
  else if (game.phase === 'plans') hint = `${withJosa(actName, '이/가')} 여행 계획을 고르고 있어요…`;
  else if (locked && humanActs) hint = `${actName} 차례예요.`;
  else hint = `${withJosa(actName, '이/가')} 생각하고 있어요…`;

  let actions: ReactNode = null;
  if (myPlay && canPass(game)) {
    actions = (
      <ul className="rl-actions">
        <li className="rl-act-ok rl-act-wrap">
          표·계획 더미가 비고 깔 수 있는 길도 없어요.{' '}
          <button type="button" className="btn btn-small" onClick={() => perform({ type: 'pass' })} data-testid="rl-pass">
            🙅 넘기기
          </button>
        </li>
      </ul>
    );
  } else if (myPlay) {
    const n = affordable.size;
    const noTrains = !ROUTES.some((r) => game.owners[r.id] === null && r.length <= game.players[act].trains);
    actions =
      game.drawn > 0 ? (
        <ul className="rl-actions" data-testid="rl-actions-more">
          <li className="rl-act-ok">
            🎫 <b>한 장 더 받기</b> · 창구 <kbd>1</kbd>~<kbd>5</kbd> 더미 <kbd>D</kbd>
          </li>
        </ul>
      ) : (
        <ul className="rl-actions" data-testid="rl-actions">
          <li className={canTake ? 'rl-act-ok' : 'rl-act-no'}>
            🎫 <b>표 2장 받기</b> · 창구 <kbd>1</kbd>~<kbd>5</kbd> 더미 <kbd>D</kbd>
          </li>
          <li className={n > 0 ? 'rl-act-ok' : 'rl-act-no'}>
            🛤️ <b>기찻길 깔기</b> · {n > 0 ? `반짝이는 길 ${n}개` : noTrains ? '기차가 모자라요' : '표가 모자라요'}
          </li>
          <li className={canDrawPlans ? 'rl-act-ok' : 'rl-act-no'}>
            🗺️ <b>여행 계획 뽑기</b> <kbd>P</kbd>
            {!canDrawPlans ? ' · 더미가 비었어요' : game.finalTurns !== null ? ' · 지금 뽑으면 손해!' : ''}
          </li>
        </ul>
      );
  }

  const lastLog = game.log.at(-1)?.text;
  const hiddenNote =
    game.phase === 'gameover' ? '여행이 끝났어요! 모두의 여행 계획은 점수표에서 볼 수 있어요.' : humanActs ? `${actName} 차례예요.` : `${actName} 차례예요. 사람들의 표와 계획은 가려 두었어요.`;

  // 마우스를 올린 길 안내
  const tipRoute = hoverRoute !== null && hoverRoute !== selRoute ? ROUTES[hoverRoute] : null;
  const tipPos = tipRoute ? mapPoint(routeMid(tipRoute).x, routeMid(tipRoute).y) : null;
  const selPos = selected ? mapPoint(routeMid(selected).x, routeMid(selected).y) : null;
  const routeStatus = (rid: number): string => {
    const owner = game.owners[rid];
    if (owner !== null) return `${playerName(game.players[owner])}의 기찻길`;
    if (!myPlay) return '';
    if (game.drawn > 0) return '표를 한 장 더 받아야 해요';
    return claimProblem(game, act, rid) ?? '깔 수 있어요! 눌러서 깔기';
  };

  /** 이 길을 깔면 받을 도장·이어질 계획 */
  const claimExtras = (rid: number): string[] => {
    if (payer === null) return [];
    const r = ROUTES[rid];
    const p = game.players[payer];
    const out: string[] = [];
    if (game.options.stamps)
      for (const city of [r.a, r.b]) {
        const st = STAMP_AT[city];
        if (!st || p.stamps.some((m) => m.city === city)) continue;
        const first = game.stampFirst[city] === null;
        out.push(`🏅 ${CITY[city].name} ${st.name} ${first ? '첫 ' : ''}도장 +${first ? STAMP_FIRST_POINTS : STAMP_LATER_POINTS}`);
      }
    const before = new Set(completedPlans(game, payer));
    for (const id of p.plans) {
      if (before.has(id)) continue;
      if (isConnected([...p.routes, rid], PLAN[id].a, PLAN[id].b)) out.push(`🎉 계획 완성: ${CITY[PLAN[id].a].name}→${CITY[PLAN[id].b].name}`);
    }
    return out;
  };

  const cardRow = (pay: Payment, route = selected!) => {
    const cards = paymentCards(route, pay);
    const counts = new Map<CardKind, number>();
    for (const c of cards) counts.set(c, (counts.get(c) ?? 0) + 1);
    return [...counts].map(([k, n]) => (
      <span key={k} className="rl-pay-chip">
        <span className="rl-card rl-mini-card">
          <TicketFace kind={k} />
        </span>
        ×{n}
      </span>
    ));
  };

  return (
    <div className="rl-game" ref={rootRef}>
      <div className="rl-main">
        <div className="rl-board-wrap" onClick={(e) => e.target === e.currentTarget && setSelRoute(null)}>
          <Board
            state={game}
            svgRef={svgRef}
            affordable={locked ? NO_ROUTES : affordable}
            hoverRoute={hoverRoute}
            selectedRoute={selRoute}
            focusCities={focusCities}
            focusRoutes={focusRoutes}
            focusColor={hoverColor === 'wild' ? null : hoverColor}
            claimFx={claimFx}
            floats={floats}
            showNetwork={netShown}
            interactive
            onHoverRoute={setHoverRoute}
            onSelectRoute={selectRoute}
          />
          {banner && (
            <div key={banner.until} className={`rl-banner rl-banner-${banner.tone}`} role="status">
              {banner.text}
            </div>
          )}
        </div>
        <Station
          state={game}
          owner={view.owner}
          canTake={canTake}
          takeReason={notMyTurnReason() || null}
          canDrawPlans={canDrawPlans}
          drawPlansReason={canDrawPlans ? null : notMyTurnReason() || (game.drawn > 0 ? '표를 한 장 더 받아야 해요' : '여행 계획 더미가 비었어요')}
          choosing={choosing}
          picked={picked}
          hiddenNote={hiddenNote}
          windowKeys={windowKeys}
          recent={recent?.kinds ?? NO_KINDS}
          reg={reg}
          onTakeWindow={takeWindow}
          onTakeDeck={takeDeck}
          onDrawPlans={drawPlans}
          onTogglePick={togglePick}
          onConfirmPlans={confirmPlans}
          onHoverPlan={setHoverPlan}
          onHoverColor={setHoverColor}
        />
        {showPass && actorPlayer && (
          <PassScreen name={actName} color={SEAT_COLORS[actorPlayer.seat].main} what="내 표와 계획" note={lastLog} onReveal={() => setRevealed(act)} />
        )}
      </div>

      <Panel
        state={game}
        hint={hint}
        actions={actions}
        notice={notice?.text ?? null}
        reg={reg}
        settings={settings}
        onSettings={onSettings}
        onNewGame={() => {
          if (game.phase === 'gameover' || window.confirm('지금 게임을 그만두고 새 게임을 할까요?')) onChangeSetup();
        }}
        onExit={onExit}
      />

      {tipRoute && tipPos && !showPass && (
        <div className="rl-tip" style={{ left: tipPos.x, top: tipPos.y } as CSSProperties} aria-hidden="true">
          <b>{routeName(tipRoute)}</b>
          <span>
            <SymbolIcon kind={tipRoute.color} size={13} /> {tipRoute.sea ? '배 · ' : ''}
            {COLOR_INFO[tipRoute.color].name} {tipRoute.length}칸 · {ROUTE_POINTS[tipRoute.length]}점
          </span>
          {routeStatus(tipRoute.id) && <em>{routeStatus(tipRoute.id)}</em>}
        </div>
      )}

      {selected && selPos && !showPass && (
        <div
          className={`rl-pop${selPos.y > (rootRef.current?.clientHeight ?? 9999) - 300 ? ' rl-pop-up' : ''}`}
          style={{ left: Math.min(Math.max(selPos.x, 150), (rootRef.current?.clientWidth ?? 9999) - 150), top: selPos.y } as CSSProperties}
          role="dialog" aria-label={`${routeName(selected)} 기찻길`} data-testid="rl-pop">
          <h3>
            {routeName(selected)}{' '}
            <small>
              <SymbolIcon kind={selected.color} size={13} /> {selected.sea ? '배 노선 · ' : ''}
              {COLOR_INFO[selected.color].name} {selected.length}칸 · {ROUTE_POINTS[selected.length]}점
            </small>
          </h3>
          {game.owners[selected.id] !== null ? (
            <p className="rl-pop-problem">{routeStatus(selected.id)}이에요.</p>
          ) : selProblem ? (
            <p className="rl-pop-problem">{selProblem}</p>
          ) : (
            <>
              {payOptions.length > 1 && <p className="rl-pop-note">어떤 표로 낼까요? (←→)</p>}
              <div className="rl-pay-options" role="radiogroup" aria-label="낼 표">
                {payOptions.map((o, i) => (
                  <button
                    key={`${o.color}-${o.wilds}`}
                    type="button"
                    role="radio"
                    aria-checked={i === payIdx}
                    className={`rl-pay${i === payIdx ? ' rl-pay-on' : ''}`}
                    onClick={() => setPayIdx(i)}
                    data-testid={`rl-pay-${i}`}
                  >
                    {cardRow(o)}
                  </button>
                ))}
              </div>
              {claimExtras(selected.id).map((x) => (
                <p key={x} className="rl-pop-extra">
                  {x}
                </p>
              ))}
            </>
          )}
          <div className="rl-pop-actions">
            {!selProblem && game.owners[selected.id] === null && (
              <button type="button" className="btn btn-primary" onClick={confirmClaim} data-testid="rl-claim">
                🛤️ 깔기 <kbd>Enter</kbd>
              </button>
            )}
            <button type="button" className="btn" onClick={() => setSelRoute(null)}>
              닫기 <kbd>Esc</kbd>
            </button>
          </div>
        </div>
      )}

      <div className="rl-fly-layer" aria-hidden="true">
        {flyers.map((f) => (
          <span
            key={f.id}
            className="rl-flyer"
            style={
              {
                '--fx': `${f.x}px`,
                '--fy': `${f.y}px`,
                '--tx': `${f.tx}px`,
                '--ty': `${f.ty}px`,
                '--s1': f.w1 / f.w0,
                width: `${f.w0}px`,
                animationDelay: `${f.delay}ms`,
                animationDuration: `${f.duration}ms`,
              } as CSSProperties
            }
          >
            {f.kind ? <TicketFace kind={f.kind} /> : <TicketBack />}
          </span>
        ))}
      </div>
      <p className="rl-sr" aria-live="polite">
        {lastLog ?? ''}
      </p>

      {game.phase === 'gameover' && !locked && !resultHidden && (
        <GameOver
          state={game}
          animate={fx}
          onShowNetwork={setShowNet}
          onHideResult={() => setResultHidden(true)}
          onRestart={onRestart}
          onChangeSetup={onChangeSetup}
          onExit={onExit}
        />
      )}
      {game.phase === 'gameover' && !locked && resultHidden && (
        <button type="button" className="btn btn-primary rl-result-again" onClick={() => setResultHidden(false)} data-testid="rl-result-again">
          🏆 점수 다시 보기
        </button>
      )}
    </div>
  );
}
