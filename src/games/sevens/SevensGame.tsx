import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PassScreen } from '../../components/PassScreen';
import { FlyingCard, type FlyingCardSpec } from '../../components/PlayingCard';
import { withJosa } from '../../lib/korean';
import { sfx } from '../../lib/sound';
import { useMusic } from '../../lib/useMusic';
import { useTimers } from '../../lib/useTimers';
import { SEAT_COLORS } from '../common/players';
import type { Card } from '../common/playingCards';
import type { GameSettings } from '../common/settings';
import { decideAction } from './ai';
import { Board, type CenterFx } from './Board';
import { HandTray } from './HandTray';
import { Panel } from './Panel';
import { GameOver, RoundOver } from './Results';
import { MAX_PASSES, applyAction, passesLeft, playableCards, playerName } from './rules';
import { Seats, type SeatFx } from './Seats';
import { SEVENS_SONG } from './song';
import { svSound } from './sounds';
import { SEVENS_DELAYS, clearSavedSevensGame, saveSevensGame } from './storage';
import type { SevensAction, SevensSetup, SevensState } from './types';

interface SevensGameProps {
  setup: SevensSetup;
  initialState: SevensState;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

interface View {
  owner: number | null;
  faceUp: boolean;
  coverMode: boolean;
}

/** 지금 누구의 손패를 아래 칸에 보여 줄지 정한다. */
function computeView(state: SevensState, revealed: number | null): View {
  const humans = state.players.map((p, i) => (p.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  const open = state.options.handView === 'open';
  const coverMode = !open && humans.length >= 2;
  const sole = humans.length === 1 ? humans[0] : null;
  const current = state.players[state.current];
  if (state.phase === 'play' && current.kind === 'human') return { owner: state.current, faceUp: !coverMode || revealed === state.current, coverMode };
  if (sole !== null) return { owner: sole, faceUp: true, coverMode };
  if (!coverMode && humans.length > 0) {
    const n = state.players.length;
    for (let k = 1; k <= n; k++) {
      const i = (state.current + k) % n;
      if (state.players[i].kind === 'human') return { owner: i, faceUp: true, coverMode };
    }
  }
  return { owner: null, faceUp: false, coverMode };
}

type Pt = { x: number; y: number; w: number };
type Timed<T> = T & { until: number };

let fxSeq = 1;
const EMPTY: ReadonlySet<number> = new Set<number>();
const SEAT_CARD_W = 22;

export function SevensGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: SevensGameProps) {
  const [game, setGame] = useState<SevensState>(initialState);
  const [anim, setAnim] = useState<{ until: number; dealing: boolean } | null>(null);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [shakeId, setShakeId] = useState<number | null>(null);
  const [flyers, setFlyers] = useState<Timed<FlyingCardSpec>[]>([]);
  const [seatFx, setSeatFx] = useState<Timed<SeatFx>[]>([]);
  const [centerFx, setCenterFx] = useState<Timed<CenterFx> | null>(null);
  const [hidden, setHidden] = useState<Timed<{ id: number }>[]>([]);
  const [recent, setRecent] = useState<Timed<{ id: number }>[]>([]);
  const [dealKey, setDealKey] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const rects = useRef(new Map<string, DOMRect>());
  const lastView = useRef<View | null>(null);
  const prevGame = useRef<SevensState | null>(null);
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  const later = useTimers();
  const delays = SEVENS_DELAYS[settings.speed];
  const fx = delays.fx;
  useMusic(SEVENS_SONG, settings.music);

  const locked = anim !== null;
  const dealing = anim?.dealing ?? false;
  const active = game.phase === 'play';
  const current = game.players[game.current];
  const humanCount = game.players.filter((p) => p.kind === 'human').length;
  const view = computeView(game, revealed);
  const humanTurn = active && current.kind === 'human';
  const needsReveal = humanTurn && !view.faceUp;
  const interactive = humanTurn && view.faceUp && !locked;
  const playable = useMemo(() => (interactive ? playableCards(game) : []), [game, interactive]);
  const playableIds = useMemo(() => new Set(playable.map((c) => c.id)), [playable]);
  const canPass = interactive && playable.length === 0;
  const passEliminates = canPass && passesLeft(game, game.current) <= 0;
  const showPass = needsReveal && !locked;
  const hiddenIds = useMemo(() => new Set(hidden.map((h) => h.id)), [hidden]);
  const recentIds = useMemo(() => new Set(recent.map((h) => h.id)), [recent]);

  useEffect(() => {
    if (!anim) return;
    const t = window.setTimeout(() => setAnim(null), Math.max(0, anim.until - performance.now()));
    return () => window.clearTimeout(t);
  }, [anim]);

  // 끝난 연출 조각을 치운다. (타이머를 상태에 묶어 두어서 StrictMode에서도 안전)
  useEffect(() => {
    const times = [...flyers.map((f) => f.until), ...seatFx.map((f) => f.until), ...hidden.map((f) => f.until), ...recent.map((f) => f.until), centerFx?.until].filter(
      (t): t is number => t !== undefined,
    );
    if (times.length === 0) return;
    const t = window.setTimeout(
      () => {
        const now = performance.now() + 5;
        const alive = <T extends { until: number }>(list: T[]) => (list.some((x) => x.until <= now) ? list.filter((x) => x.until > now) : list);
        setFlyers(alive);
        setSeatFx(alive);
        setHidden(alive);
        setRecent(alive);
        setCenterFx((c) => (c && c.until <= now ? null : c));
      },
      Math.max(0, Math.min(...times) - performance.now()) + 10,
    );
    return () => window.clearTimeout(t);
  }, [flyers, seatFx, hidden, recent, centerFx]);

  // 차례가 바뀌면 손패를 다시 가린다.
  const prevTurn = useRef(game.turn);
  useEffect(() => {
    if (game.turn !== prevTurn.current) {
      setRevealed(null);
      setSel(null);
    }
    prevTurn.current = game.turn;
  }, [game.turn]);

  const reg = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) els.current.set(key, el);
      else els.current.delete(key);
    },
    [],
  );

  const local = useCallback((r: DOMRect | undefined | null): Pt | null => {
    const m = mainRef.current?.getBoundingClientRect();
    if (!r || !m || r.width === 0) return null;
    return { x: r.left + r.width / 2 - m.left, y: r.top + r.height / 2 - m.top, w: r.width };
  }, []);

  /** 상태가 바뀔 때마다: 저장 + 마지막 행동의 연출 */
  useLayoutEffect(() => {
    if (game.phase === 'gameover') clearSavedSevensGame();
    else saveSevensGame(setup, game);

    const before = prevGame.current;
    prevGame.current = game;
    if (before === game) return;
    if (before === null && !game.events.some((e) => e.type === 'deal')) return;

    const t0 = performance.now();
    const fly = delays.fly;
    const n = game.players.length;
    const beforeView = lastView.current ?? computeView(game, null);
    const afterView = computeView(game, revealedRef.current);
    const now = (key: string) => local(els.current.get(key)?.getBoundingClientRect());
    const was = (key: string) => local(rects.current.get(key));
    const seatPt = (i: number): Pt | null => {
      const p = now(`seat-${i}`) ?? was(`seat-${i}`);
      return p ? { ...p, w: SEAT_CARD_W } : null;
    };

    const newFlyers: Timed<FlyingCardSpec>[] = [];
    const newSeatFx: SeatFx[] = [];
    const newHidden: Timed<{ id: number }>[] = [];
    const newRecent: Timed<{ id: number }>[] = [];
    let newCenter: Timed<CenterFx> | null = null;
    let cursor = 0;
    let total = 0;
    let isDeal = false;
    const sound = (play: () => void, at: number) => (at <= 0 ? play() : later(play, at));
    const bubble = (player: number, text: string, tone: SeatFx['tone']) => {
      if (fx) newSeatFx.push({ id: fxSeq++, player, text, tone });
    };
    const flyer = (from: Pt | null, to: Pt | null, card: Card | null, delay: number) => {
      if (fly <= 0 || !from || !to) return false;
      newFlyers.push({ id: fxSeq++, x: from.x, y: from.y, tx: to.x, ty: to.y, card, delay, duration: fly, w0: from.w, w1: to.w, until: t0 + delay + fly + 60 });
      return true;
    };
    /** 카드 한 장을 판의 제자리로 날린다. 도착할 때까지 그 칸은 비워 둔다. */
    const toBoard = (card: Card, from: Pt | null, delay: number) => {
      const to = now(`cell-${card.id}`);
      if (flyer(from, to, card, delay)) newHidden.push({ id: card.id, until: t0 + delay + fly });
      newRecent.push({ id: card.id, until: t0 + delay + fly + 1600 });
    };
    const fromHand = (player: number, card: Card): Pt | null => {
      if (beforeView.owner === player && beforeView.faceUp) return was(`hand-${card.id}`) ?? seatPt(player);
      return seatPt(player);
    };

    for (const e of game.events) {
      switch (e.type) {
        case 'deal': {
          isDeal = true;
          setDealKey((k) => k + 1);
          sound(() => svSound.deal(), 0);
          const origin = now('board');
          if (origin) {
            for (let k = 0; k < 52; k++) {
              const pi = (game.dealer + k) % n;
              const toTray = afterView.owner === pi;
              const to = toTray ? now('tray-hand') : seatPt(pi);
              flyer({ ...origin, w: 44 }, to ? { ...to, w: toTray ? 56 : SEAT_CARD_W } : null, null, k * delays.deal);
            }
          }
          cursor = 52 * delays.deal + fly;
          total = Math.max(total, cursor + 100);
          break;
        }
        case 'play': {
          const from = e.auto ? seatPt(e.player) : fromHand(e.player, e.card);
          toBoard(e.card, from, cursor);
          cursor += fly;
          const rank = e.card.rank;
          sound(() => (rank === 7 ? svSound.open() : svSound.place(rank)), cursor);
          if (e.auto) bubble(e.player, '♦7로 시작!', 'info');
          total = Math.max(total, cursor + 80);
          break;
        }
        case 'pass':
          bubble(e.player, game.options.passLimit ? `통과 ${e.count}/${MAX_PASSES}` : '통과', 'pass');
          sound(() => svSound.pass(), cursor);
          total = Math.max(total, cursor + (fx ? 450 : 0));
          break;
        case 'eliminate': {
          bubble(e.player, '탈락!', 'out');
          sound(() => svSound.eliminate(), cursor);
          const gap = fly > 0 ? Math.max(50, fly * 0.18) : 0;
          e.cards.forEach((c, k) => toBoard(c, fromHand(e.player, c), cursor + k * gap));
          cursor += e.cards.length * gap + fly;
          total = Math.max(total, cursor + 200);
          break;
        }
        case 'finish':
          bubble(e.player, game.options.endMode === 'points' ? '🎉 다 냈다!' : `🎉 ${e.place}등!`, 'finish');
          sound(() => svSound.finish(), cursor + 100);
          total = Math.max(total, cursor + 600);
          break;
        case 'roundEnd': {
          const name = playerName(game.players[e.winner]);
          const text = game.phase === 'gameover' ? (game.options.endMode === 'points' ? `🏆 ${name} 우승!` : `🏆 ${name} 1등!`) : `${name} 승리! +${e.points}점`;
          if (fx) newCenter = { id: fxSeq++, text, tone: 'win', delay: cursor + 200, until: t0 + cursor + 1900 };
          sound(() => (game.phase === 'gameover' ? sfx.win() : svSound.finish()), cursor + 300);
          total = Math.max(total, cursor + (fx ? 1600 : 0));
          break;
        }
      }
    }

    if (newFlyers.length > 0) setFlyers((list) => [...list.filter((x) => x.until > t0), ...newFlyers]);
    if (newHidden.length > 0) setHidden((list) => [...list.filter((x) => x.until > t0), ...newHidden]);
    if (newRecent.length > 0) setRecent(newRecent);
    if (newSeatFx.length > 0) {
      const until = t0 + Math.max(1400, total + 800);
      setSeatFx((list) => [...list.filter((x) => x.until > t0), ...newSeatFx.map((f) => ({ ...f, until }))]);
    }
    const c = newCenter as Timed<CenterFx> | null;
    if (c) setCenterFx(c);

    const next = game.players[game.current];
    if (game.phase === 'play' && next.kind === 'human' && (!before || before.turn !== game.turn)) sound(() => sfx.turn(), total + 50);
    if (total > 0) setAnim({ until: performance.now() + total, dealing: isDeal });
  }, [game, setup, delays, fx, local, later]);

  // 그린 뒤 위치 기억 (다음 연출의 출발점)
  useLayoutEffect(() => {
    const m = new Map<string, DOMRect>();
    els.current.forEach((el, k) => m.set(k, el.getBoundingClientRect()));
    rects.current = m;
    lastView.current = view;
  });

  const perform = useCallback((action: SevensAction) => setGame((g) => applyAction(g, action)), []);

  // 컴퓨터 차례 (그리고 컴퓨터끼리 할 때 다음 판 시작)
  useEffect(() => {
    if (locked || game.phase === 'gameover') return;
    if (game.phase === 'roundover') {
      if (humanCount > 0) return;
      const t = window.setTimeout(() => perform({ type: 'nextRound' }), 2600);
      return () => window.clearTimeout(t);
    }
    if (current.kind === 'human') return;
    const t = window.setTimeout(() => {
      setGame((g) => {
        const p = g.players[g.current];
        if (p.kind === 'human' || g.phase !== 'play') return g;
        return applyAction(g, decideAction(g, p.kind));
      });
    }, delays.think);
    return () => window.clearTimeout(t);
  }, [game, locked, humanCount, current.kind, delays.think, perform]);

  const onCard = (cardId: number) => {
    if (!interactive) return;
    if (!playableIds.has(cardId)) {
      setShakeId(cardId);
      sfx.noMove();
      later(() => setShakeId((s) => (s === cardId ? null : s)), 450);
      return;
    }
    perform({ type: 'play', cardId });
  };

  const onPass = () => {
    if (canPass) perform({ type: 'pass' });
  };

  // 키보드: ←→ 고르기, Enter·Space 내기 (낼 카드가 없으면 Space 통과), Enter 카드 보기·다음 판
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      if (showPass || e.ctrlKey || e.metaKey || e.altKey) return;
      const onButton = t?.tagName === 'BUTTON';
      if (e.key === 'Enter' && game.phase === 'roundover' && humanCount > 0 && !locked && !onButton) {
        e.preventDefault();
        perform({ type: 'nextRound' });
        return;
      }
      if (!interactive) return;
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && playable.length > 0) {
        e.preventDefault();
        const i = playable.findIndex((c) => c.id === sel);
        const d = e.key === 'ArrowLeft' ? -1 : 1;
        const k = i < 0 ? (d > 0 ? 0 : playable.length - 1) : (i + d + playable.length) % playable.length;
        setSel(playable[k].id);
      } else if ((e.key === ' ' || e.key === 'Enter') && !onButton) {
        e.preventDefault();
        if (playable.length === 0) onPass();
        else if (sel !== null && playableIds.has(sel)) perform({ type: 'play', cardId: sel });
        else setSel(playable[0].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // 안내 문구
  const name = playerName(current);
  let hint: string;
  if (game.phase === 'gameover') hint = '게임이 끝났어요!';
  else if (game.phase === 'roundover') hint = '이번 판이 끝났어요.';
  else if (dealing) hint = '카드를 나눠 주는 중…';
  else if (!humanTurn) hint = `${withJosa(name, '이/가')} 생각 중이에요…`;
  else if (needsReveal) hint = `${name} 차례예요. '내 카드 보기'를 누르세요.`;
  else if (playable.length > 0) hint = playable.length === 1 ? '낼 수 있는 카드가 하나 있어요. 반짝이는 카드를 내세요!' : '반짝이는 카드나 판의 빛나는 칸을 골라 내세요.';
  else if (passEliminates) hint = '낼 카드가 없고 통과를 다 썼어요. 탈락이에요… 😢';
  else if (game.options.passLimit) hint = `낼 카드가 없어요. 통과하세요. (남은 통과 ${passesLeft(game, game.current)}번)`;
  else hint = '낼 카드가 없어요. 통과하세요.';

  const info = active && !humanTurn && !dealing ? `${name} 차례…` : '';

  return (
    <div className="sv-game">
      <div className="sv-main" ref={mainRef}>
        <Seats
          state={game}
          reg={reg}
          openHands={game.options.handView === 'open'}
          seatFx={seatFx}
          thinking={active && !humanTurn && !locked}
          dealKey={dealKey}
          dealStep={dealing ? delays.deal : 0}
          flyMs={dealing ? delays.fly : 0}
        />
        <div className="sv-board-wrap" ref={reg('board')}>
          <Board
            state={game}
            reg={reg}
            playable={playable}
            selectedId={sel}
            onPlay={onCard}
            onSelect={(id) => interactive && setSel(id)}
            hidden={hiddenIds.size > 0 ? hiddenIds : EMPTY}
            recentIds={recentIds}
            centerFx={centerFx}
            info={info}
          />
        </div>
        <HandTray
          state={game}
          owner={view.owner}
          faceUp={view.faceUp}
          interactive={interactive}
          isTurn={humanTurn && view.owner === game.current}
          playableIds={playableIds}
          selectedId={sel}
          shakeId={shakeId}
          hint={hint}
          reg={reg}
          canPass={canPass}
          passEliminates={passEliminates}
          onCard={onCard}
          onSelect={(id) => interactive && setSel(id)}
          onPass={onPass}
          dealKey={dealKey}
          dealStep={dealing ? delays.deal : 0}
          flyMs={dealing ? delays.fly : 0}
        />
        <div className="sv-fly-layer" aria-hidden="true">
          {flyers.map((f) => (
            <FlyingCard key={f.id} spec={f} />
          ))}
        </div>
        {showPass && <PassScreen name={name} color={SEAT_COLORS[current.seat].main} onReveal={() => setRevealed(game.current)} />}
      </div>

      <Panel
        state={game}
        hint={hint}
        settings={settings}
        onSettings={onSettings}
        onNewGame={() => {
          if (game.phase === 'gameover' || window.confirm('지금 게임을 그만두고 새 게임을 할까요?')) onChangeSetup();
        }}
        onExit={onExit}
      />

      {game.phase === 'roundover' && !locked && <RoundOver state={game} canContinue={humanCount > 0} onNext={() => perform({ type: 'nextRound' })} />}
      {game.phase === 'gameover' && !locked && <GameOver state={game} onRestart={onRestart} onChangeSetup={onChangeSetup} onExit={onExit} />}
    </div>
  );
}
