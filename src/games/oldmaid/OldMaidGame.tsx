import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PassScreen } from '../../components/PassScreen';
import { FlyingCard, type FlyingCardSpec } from '../../components/PlayingCard';
import { withJosa } from '../../lib/korean';
import { sfx } from '../../lib/sound';
import { useMusic } from '../../lib/useMusic';
import { useTimers } from '../../lib/useTimers';
import { SEAT_COLORS } from '../common/players';
import { cardLabel, isJoker, rankLabel, type Card } from '../common/playingCards';
import type { GameSettings } from '../common/settings';
import { decideAction } from './ai';
import { HandTray } from './HandTray';
import { Panel } from './Panel';
import { GameOver } from './Results';
import { DECK_SIZE, applyAction, drawTarget, findPairs, playerName } from './rules';
import { OLDMAID_SONG } from './song';
import { omSound } from './sounds';
import { OLDMAID_DELAYS, clearSavedOldMaidGame, saveOldMaidGame } from './storage';
import { Table, pileTilt, type CenterFx, type SeatFx } from './Table';
import type { OldMaidAction, OldMaidSetup, OldMaidState } from './types';
import { soloOutcome, useRecordOutcome } from '../../lib/stats';

interface OldMaidGameProps {
  setup: OldMaidSetup;
  initialState: OldMaidState;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

interface View {
  /** 아래 칸에 손패를 보여 줄 사람 */
  owner: number | null;
  faceUp: boolean;
  /** 사람이 2명 이상이고 손패를 가리는 모드 */
  coverMode: boolean;
}

/** 지금 누구의 손패를 아래 칸에 보여 줄지 정한다. confirming: 방금 뽑은 카드를 확인 중인 사람 */
function computeView(state: OldMaidState, revealed: number | null, confirming: number | null): View {
  const humans = state.players.map((p, i) => (p.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  const open = state.options.handView === 'open';
  const coverMode = !open && humans.length >= 2;
  if (confirming !== null) return { owner: confirming, faceUp: true, coverMode };
  const current = state.players[state.current];
  if (state.phase === 'play' && current.kind === 'human') return { owner: state.current, faceUp: !coverMode || revealed === state.current, coverMode };
  if (humans.length === 1) return { owner: humans[0], faceUp: true, coverMode };
  if (!coverMode && humans.length > 0) {
    // 모두 공개: 다음에 할 사람의 손패
    const n = state.players.length;
    for (let k = 1; k <= n; k++) {
      const i = (state.current + k) % n;
      if (state.players[i].kind === 'human') return { owner: i, faceUp: true, coverMode };
    }
  }
  return { owner: null, faceUp: false, coverMode };
}

/** '스페이드 7을' / '하트 A를' (숫자를 우리말로 읽었을 때 받침 기준) */
function cardWithObject(card: Card): string {
  if (isJoker(card)) return '조커를';
  const batchim = [3, 6, 7, 8, 10].includes(card.rank);
  return `${cardLabel(card)}${batchim ? '을' : '를'}`;
}

type Pt = { x: number; y: number; w: number };
/** 연출 조각마다 사라질 시각 (performance.now 기준) */
type Timed<T> = T & { until: number };

let fxSeq = 1;
const EMPTY: ReadonlySet<number> = new Set<number>();
const SEAT_CARD_W = 30;
const PILE_CARD_W = 46;

export function OldMaidGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: OldMaidGameProps) {
  const [game, setGame] = useState<OldMaidState>(initialState);
  /** 연출이 끝날 때까지 입력을 막는다. dealing: 카드를 나눠 주는 중 */
  const [anim, setAnim] = useState<{ until: number; dealing: boolean } | null>(null);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [picking, setPicking] = useState<number | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [flyers, setFlyers] = useState<Timed<FlyingCardSpec>[]>([]);
  const [seatFx, setSeatFx] = useState<Timed<SeatFx>[]>([]);
  const [centerFx, setCenterFx] = useState<Timed<CenterFx> | null>(null);
  const [hidden, setHidden] = useState<Timed<{ ids: ReadonlySet<number> }> | null>(null);
  const [pileHold, setPileHold] = useState<Timed<{ count: number }> | null>(null);
  const [shuffling, setShuffling] = useState<Timed<{ player: number; delay: number }>[]>([]);
  const [recent, setRecent] = useState<Timed<{ id: number }> | null>(null);
  const [dealKey, setDealKey] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const rects = useRef(new Map<string, DOMRect>());
  const lastView = useRef<View | null>(null);
  const prevGame = useRef<OldMaidState | null>(null);
  const pickInfo = useRef<{ player: number; rect: DOMRect | null } | null>(null);
  const uiRef = useRef({ revealed, confirming });
  uiRef.current = { revealed, confirming };
  const later = useTimers();
  const delays = OLDMAID_DELAYS[settings.speed];
  useMusic(OLDMAID_SONG, settings.music);
  useRecordOutcome('oldmaid', game.phase === 'gameover', () => soloOutcome(game.players.map((p) => p.kind), game.players.map((_, i) => i).filter((i) => i !== game.thief)) === 'loss' ? 'loss' : soloOutcome(game.players.map((p) => p.kind), [0]) === null ? null : 'win');

  const locked = anim !== null;
  const dealing = anim?.dealing ?? false;
  const current = game.players[game.current];
  const view = computeView(game, revealed, confirming);
  const target = drawTarget(game);
  const humanTurn = game.phase === 'play' && current.kind === 'human';
  const revealedNow = humanTurn && view.owner === game.current && view.faceUp && confirming === null;
  const needsReveal = humanTurn && view.coverMode && confirming === null && revealed !== game.current;
  const interactive = revealedNow && !locked && picking === null;
  const showPass = needsReveal && !locked;
  const ownerPlayer = view.owner !== null ? game.players[view.owner] : null;
  const canShuffle =
    ownerPlayer !== null && ownerPlayer.kind === 'human' && view.faceUp && game.phase === 'play' && ownerPlayer.hand.length >= 2 && !locked && picking === null;
  const fx = delays.fx;
  const shuffleDelays = useMemo(() => new Map(shuffling.map((s) => [s.player, s.delay])), [shuffling]);

  // 끝난 연출 조각을 치운다. (타이머를 상태에 묶어 두어서 StrictMode에서도 안전)
  useEffect(() => {
    const times = [
      ...flyers.map((f) => f.until),
      ...seatFx.map((f) => f.until),
      ...shuffling.map((f) => f.until),
      centerFx?.until,
      hidden?.until,
      pileHold?.until,
      recent?.until,
    ].filter((t): t is number => t !== undefined);
    if (times.length === 0) return;
    const t = window.setTimeout(
      () => {
        const now = performance.now() + 5;
        const alive = <T extends { until: number }>(list: T[]) => (list.some((x) => x.until <= now) ? list.filter((x) => x.until > now) : list);
        const single = <T extends { until: number }>(v: T | null) => (v && v.until <= now ? null : v);
        setFlyers(alive);
        setSeatFx(alive);
        setShuffling(alive);
        setCenterFx(single);
        setHidden(single);
        setPileHold(single);
        setRecent(single);
      },
      Math.max(0, Math.min(...times) - performance.now()) + 10,
    );
    return () => window.clearTimeout(t);
  }, [flyers, seatFx, shuffling, centerFx, hidden, pileHold, recent]);

  // 연출 시간이 지나면 입력을 다시 받는다.
  useEffect(() => {
    if (!anim) return;
    const t = window.setTimeout(() => setAnim(null), Math.max(0, anim.until - performance.now()));
    return () => window.clearTimeout(t);
  }, [anim]);

  // 차례가 바뀌면 손패를 다시 가리고 고른 카드를 지운다.
  const prevTurn = useRef(game.turn);
  useEffect(() => {
    if (game.turn !== prevTurn.current) {
      setRevealed(null);
      setSel(null);
    }
    prevTurn.current = game.turn;
  }, [game.turn]);

  useEffect(() => {
    if (game.phase === 'gameover') setConfirming(null);
  }, [game.phase]);

  const reg = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) els.current.set(key, el);
      else els.current.delete(key);
    },
    [],
  );

  /** 화면 좌표를 날아가는 층(om-main) 기준 좌표로 */
  const local = useCallback((r: DOMRect | undefined | null): Pt | null => {
    const m = mainRef.current?.getBoundingClientRect();
    if (!r || !m || r.width === 0) return null;
    return { x: r.left + r.width / 2 - m.left, y: r.top + r.height / 2 - m.top, w: r.width };
  }, []);

  /** 상태가 바뀔 때마다: 저장 + 마지막 행동의 연출 (그리기 전에 위치를 재고 연출을 시작한다) */
  useLayoutEffect(() => {
    if (game.phase === 'gameover') clearSavedOldMaidGame();
    else saveOldMaidGame(setup, game);

    const before = prevGame.current;
    prevGame.current = game;
    if (before === game) return;
    const pick = pickInfo.current;
    pickInfo.current = null;
    if (before === null && !game.events.some((e) => e.type === 'deal')) return;

    const fly = delays.fly;
    const n = game.players.length;
    const open = game.options.handView === 'open';
    const beforeView = lastView.current ?? computeView(game, null, null);
    const afterView = computeView(game, uiRef.current.revealed, uiRef.current.confirming);
    const now = (key: string) => local(els.current.get(key)?.getBoundingClientRect());
    const was = (key: string) => local(rects.current.get(key));
    const seatPt = (i: number): Pt | null => {
      const p = now(`seat-${i}`) ?? was(`seat-${i}`);
      return p ? { ...p, w: SEAT_CARD_W } : null;
    };
    const pile = now('pile');
    const pilePt: Pt | null = pile ? { ...pile, w: PILE_CARD_W } : null;

    const t0 = performance.now();
    const newFlyers: Timed<FlyingCardSpec>[] = [];
    const removals = new Map<number, number>();
    const newSeatFx: SeatFx[] = [];
    const newShuffles: { player: number; delay: number }[] = [];
    let newCenter: (CenterFx & { delay: number }) | null = null;
    const hide = new Set<number>();
    let hideUntil = 0;
    let hold = 0;
    let cursor = 0;
    let pairAt = 0;
    let total = 0;
    let isDeal = false;
    const sound = (play: () => void, at: number) => (at <= 0 ? play() : later(play, at));
    const bubble = (player: number, text: string, tone: SeatFx['tone']) => {
      if (fx) newSeatFx.push({ id: fxSeq++, player, text, tone });
    };
    const center = (text: string, tone: CenterFx['tone'], at: number) => {
      if (fx) newCenter = { id: fxSeq++, text, tone, delay: Math.max(0, at) };
    };
    const flyer = (from: Pt | null, to: Pt | null, card: Card | null, opts: { delay: number; flip?: boolean; hide?: boolean; rotate?: number }) => {
      if (fly <= 0 || !from || !to) return null;
      const spec: Timed<FlyingCardSpec> = { id: fxSeq++, x: from.x, y: from.y, tx: to.x, ty: to.y, card, duration: fly, w0: from.w, w1: to.w, until: 0, ...opts };
      newFlyers.push(spec);
      return spec;
    };

    const pairEvt = game.events.find((e) => e.type === 'pair');
    for (const e of game.events) {
      switch (e.type) {
        case 'deal': {
          isDeal = true;
          setDealKey((k) => k + 1);
          sound(() => omSound.deal(), 0);
          const origin = now('center');
          if (origin) {
            for (let k = 0; k < DECK_SIZE; k++) {
              const pi = (e.first + k) % n;
              const toTray = afterView.owner === pi;
              const to = toTray ? now('tray-hand') : seatPt(pi);
              flyer({ ...origin, w: 44 }, to ? { ...to, w: toTray ? 56 : SEAT_CARD_W } : null, null, { delay: k * delays.deal });
            }
          }
          total = Math.max(total, DECK_SIZE * delays.deal + fly + 120);
          break;
        }
        case 'pairs': {
          const ownerFace = beforeView.owner === e.player && beforeView.faceUp;
          const gap = fly > 0 ? Math.max(45, fly * 0.16) : 0;
          e.cards.forEach((c, j) => {
            const from = ownerFace ? was(`tray-${c.id}`) : seatPt(e.player);
            flyer(from, pilePt, c, { delay: pairAt + j * gap, rotate: pileTilt(c).r });
          });
          hold += e.cards.length;
          bubble(e.player, `짝 ${e.cards.length / 2}쌍!`, 'pair');
          sound(() => omSound.pairs(e.cards.length / 2), pairAt);
          pairAt += Math.min(e.cards.length, 10) * gap + 160;
          total = Math.max(total, pairAt + fly);
          break;
        }
        case 'draw': {
          const human = pick && pick.player === e.player ? pick : null;
          const fromOwner = beforeView.owner === e.from && beforeView.faceUp;
          const toOwner = afterView.owner === e.player && afterView.faceUp;
          const from = human ? local(human.rect) : fromOwner ? was(`tray-${e.card.id}`) : seatPt(e.from);
          let to: Pt | null;
          if (toOwner && pairEvt?.type === 'pair') {
            const m = was(`tray-${pairEvt.cards[0].id}`);
            to = m ? { x: m.x + 24, y: m.y - 16, w: m.w } : null;
          } else if (toOwner) {
            to = now(`tray-${e.card.id}`);
          } else {
            to = seatPt(e.player);
          }
          const showFace = open || toOwner || fromOwner;
          const spec = flyer(from, to, showFace ? e.card : null, {
            delay: cursor,
            flip: !open && toOwner && !fromOwner,
            hide: !open && fromOwner && !toOwner,
          });
          sound(() => omSound.draw(), cursor);
          cursor += fly;
          if (spec && toOwner && !pairEvt) {
            hide.add(e.card.id);
            hideUntil = cursor;
          }
          if (spec && pairEvt) removals.set(spec.id, cursor + (toOwner ? delays.hold : 120));
          if (toOwner && !pairEvt) setRecent({ id: e.card.id, until: t0 + cursor + 2600 });
          if (isJoker(e.card) && !open) {
            if (toOwner) {
              center('앗! 도둑(조커)을 뽑았어요 😱', 'joker', cursor);
              sound(() => omSound.gotJoker(), cursor);
            } else if (fromOwner) {
              center('조커가 넘어갔어요! 🤭', 'joker', cursor);
              sound(() => omSound.sneaky(), cursor);
            }
          }
          total = Math.max(total, cursor);
          break;
        }
        case 'pair': {
          const ownerFace = afterView.owner === e.player && afterView.faceUp;
          const at = cursor + (fly > 0 ? (ownerFace ? delays.hold : 140) : 0);
          const src = ownerFace ? was(`tray-${e.cards[0].id}`) : seatPt(e.player);
          if (ownerFace && src && fly > 0) {
            // 손에 있던 짝 카드는 날아갈 때까지 그 자리에 그대로 보인다.
            const ghost: Timed<FlyingCardSpec> = { id: fxSeq++, x: src.x, y: src.y, tx: src.x, ty: src.y, card: e.cards[0], delay: 0, duration: 1, w0: src.w, w1: src.w, until: 0 };
            newFlyers.push(ghost);
            removals.set(ghost.id, at);
          }
          e.cards.forEach((c, j) => {
            const from = j === 1 && ownerFace && src ? { x: src.x + 24, y: src.y - 16, w: src.w } : src;
            flyer(from, pilePt, c, { delay: at + j * 70, rotate: pileTilt(c).r });
          });
          hold += 2;
          bubble(e.player, `${rankLabel(e.cards[0].rank)} 짝!`, 'pair');
          sound(() => omSound.pair(), at);
          cursor = at + fly;
          total = Math.max(total, cursor);
          break;
        }
        case 'shuffle': {
          const start = cursor;
          if (fx) {
            newShuffles.push({ player: e.player, delay: start });
            cursor += 280;
          }
          sound(() => omSound.shuffle(), start);
          total = Math.max(total, cursor);
          break;
        }
        case 'out':
          bubble(e.player, `🎉 ${e.place}등!`, 'out');
          sound(() => omSound.out(), cursor + 80);
          total = Math.max(total, cursor + 500);
          break;
        case 'thief':
          center(`🃏 도둑은 ${playerName(game.players[e.player])}!`, 'thief', cursor + 150);
          sound(() => omSound.thief(), cursor + 150);
          total = Math.max(total, cursor + 1900);
          break;
      }
    }

    if (hide.size > 0) setHidden({ ids: hide, until: t0 + hideUntil + 20 });
    if (hold > 0) setPileHold({ count: hold, until: t0 + total + 10 });
    if (newFlyers.length > 0) {
      for (const f of newFlyers) f.until = t0 + (removals.get(f.id) ?? total + 200);
      setFlyers((list) => [...list.filter((x) => x.until > t0), ...newFlyers]);
    }
    if (newSeatFx.length > 0) {
      const until = t0 + Math.max(1500, total + 900);
      setSeatFx((list) => [...list.filter((x) => x.until > t0), ...newSeatFx.map((f) => ({ ...f, until }))]);
    }
    if (newShuffles.length > 0) setShuffling(newShuffles.map((x) => ({ ...x, until: t0 + x.delay + 600 })));
    const c = newCenter as (CenterFx & { delay: number }) | null;
    if (c) setCenterFx({ ...c, until: t0 + c.delay + 1700 });

    // 사람 차례가 오면 알림음
    const next = game.players[game.current];
    if (game.phase === 'play' && next.kind === 'human' && (!before || before.turn !== game.turn) && uiRef.current.confirming === null) {
      sound(() => sfx.turn(), total + 50);
    }
    if (total > 0) setAnim({ until: performance.now() + total, dealing: isDeal });
  }, [game, setup, delays, fx, local, later]);

  // 그린 뒤 위치 기억 (다음 연출의 출발점)
  useLayoutEffect(() => {
    const m = new Map<string, DOMRect>();
    els.current.forEach((el, k) => m.set(k, el.getBoundingClientRect()));
    rects.current = m;
    lastView.current = view;
  });

  const perform = useCallback((action: OldMaidAction) => setGame((g) => applyAction(g, action)), []);

  // 짝 버리기와 컴퓨터 차례 (그 순간의 최신 상태를 보고 정한다)
  useEffect(() => {
    if (locked || picking !== null || confirming !== null || game.phase === 'gameover') return;
    if (game.phase === 'deal') {
      const t = window.setTimeout(() => setGame((g) => (g.phase === 'deal' ? applyAction(g, { type: 'discardPairs' }) : g)), delays.hold + 500);
      return () => window.clearTimeout(t);
    }
    if (current.kind === 'human') return;
    const t = window.setTimeout(() => {
      setGame((g) => {
        const p = g.players[g.current];
        if (g.phase !== 'play' || p.kind === 'human') return g;
        return applyAction(g, decideAction(g, p.kind));
      });
    }, delays.think);
    return () => window.clearTimeout(t);
  }, [game, locked, picking, confirming, current.kind, delays]);

  const onPick = (index: number) => {
    if (!interactive || target < 0 || index < 0 || index >= game.players[target].hand.length) return;
    const me = game.current;
    const cover = view.coverMode;
    setPicking(index);
    setSel(index);
    if (delays.suspense > 0) omSound.suspense();
    later(() => {
      pickInfo.current = { player: me, rect: els.current.get(`pick-${index}`)?.getBoundingClientRect() ?? null };
      setPicking(null);
      if (cover) setConfirming(me);
      setGame((g) => applyAction(g, { type: 'draw', index }));
    }, delays.suspense);
  };

  const onHover = (index: number | null) => {
    if (!interactive || index === sel) return;
    setSel(index);
    if (index !== null && fx) omSound.hover();
  };

  const onShuffle = () => {
    if (canShuffle && view.owner !== null) perform({ type: 'shuffle', player: view.owner });
  };

  const onConfirm = () => {
    setConfirming(null);
    setRevealed(null);
  };

  // 키보드: ←→ 고르기, Space·Enter 뽑기, 1~9 바로 고르기, S 섞기, Enter 확인
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      if (showPass || e.ctrlKey || e.metaKey || e.altKey) return;
      const onButton = t?.tagName === 'BUTTON';
      if ((e.key === 's' || e.key === 'S' || e.key === 'ㄴ') && canShuffle) {
        e.preventDefault();
        onShuffle();
        return;
      }
      if (confirming !== null) {
        if ((e.key === 'Enter' || e.key === ' ') && !onButton && !locked) {
          e.preventDefault();
          onConfirm();
        }
        return;
      }
      if (!interactive) return;
      const len = target >= 0 ? game.players[target].hand.length : 0;
      if (len === 0) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const d = e.key === 'ArrowLeft' ? -1 : 1;
        setSel(sel === null ? (d > 0 ? 0 : len - 1) : (sel + d + len) % len);
        if (fx) omSound.hover();
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        setSel(e.key === 'Home' ? 0 : len - 1);
      } else if (/^[1-9]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (i >= len) return;
        if (sel === i) onPick(i);
        else setSel(i);
      } else if ((e.key === ' ' || e.key === 'Enter') && !onButton) {
        e.preventDefault();
        if (sel !== null && sel < len) onPick(sel);
        else setSel(Math.floor((len - 1) / 2));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // 처음에 버릴 짝 (나눠 준 뒤 잠깐 반짝)
  const willPair = useMemo(() => {
    if (game.phase !== 'deal' || dealing || view.owner === null || !view.faceUp) return EMPTY;
    return new Set(findPairs(game.players[view.owner].hand).pairs.map((c) => c.id));
  }, [game, dealing, view.owner, view.faceUp]);

  // 안내 문구
  const name = playerName(current);
  const targetName = target >= 0 ? playerName(game.players[target]) : '';
  const holdsJoker = revealedNow && current.hand.some(isJoker);
  let hint: string;
  if (game.phase === 'gameover') hint = '게임이 끝났어요!';
  else if (game.phase === 'deal') hint = dealing ? '카드를 나눠 주는 중…' : '같은 숫자 두 장은 짝이라서 버려요!';
  else if (confirming !== null) {
    const ld = game.lastDraw;
    const card = ld ? [...game.discard, ...game.players[ld.player].hand].find((c) => c.id === ld.cardId) : undefined;
    if (!ld || ld.player !== confirming || !card) hint = '다 봤으면 넘기세요.';
    else if (ld.paired) hint = `${rankLabel(card.rank)} 짝을 맞춰서 버렸어요! 🎉 다 봤으면 넘기세요.`;
    else if (isJoker(card)) hint = '앗, 도둑(조커)을 뽑았어요! 😱 섞기로 숨기고 넘기세요.';
    else hint = `${cardWithObject(card)} 뽑았어요. 다 봤으면 넘기세요.`;
  } else if (picking !== null) hint = '두근두근… 무슨 카드일까요?';
  else if (!humanTurn) hint = `${withJosa(name, '이/가')} ${targetName}의 카드를 고르는 중이에요…`;
  else if (needsReveal) hint = `${name} 차례예요. '내 카드 보기'를 누르세요.`;
  else hint = `${targetName}의 카드 중 한 장을 골라 뽑으세요!${holdsJoker ? ' (조커는 내 손에 있어요 🤫)' : ''}`;

  let info = '';
  if (game.phase === 'deal') info = dealing ? '카드를 나눠 주는 중…' : '짝을 찾는 중… 🔍';
  else if (game.phase === 'play') info = `${withJosa(name, '이/가')} ${targetName}의 카드를 뽑아요`;

  const lastDraw = game.lastDraw;
  const passNote =
    lastDraw && lastDraw.from === game.current ? `${withJosa(playerName(game.players[lastDraw.player]), '이/가')} 내 카드를 한 장 뽑아 갔어요.` : undefined;

  return (
    <div className="om-game">
      <div className="om-main" ref={mainRef}>
        <Table
          state={game}
          openHands={game.options.handView === 'open'}
          reg={reg}
          target={target}
          showPick={revealedNow}
          pickEnabled={interactive}
          sel={sel}
          picking={picking}
          onPick={onPick}
          onHover={onHover}
          seatFx={seatFx}
          centerFx={centerFx}
          shuffling={shuffleDelays}
          pileHold={pileHold?.count ?? 0}
          dealKey={dealKey}
          dealStep={dealing ? delays.deal : 0}
          flyMs={dealing ? delays.fly : 0}
          info={info}
          thinking={game.phase === 'play' && !humanTurn && !locked}
        />
        <HandTray
          state={game}
          owner={view.owner}
          faceUp={view.faceUp}
          isTurn={humanTurn && view.owner === game.current}
          hint={hint}
          reg={reg}
          hidden={hidden?.ids ?? EMPTY}
          recentId={recent?.id ?? null}
          willPair={willPair}
          shuffleDelay={view.owner !== null ? shuffleDelays.get(view.owner) : undefined}
          canShuffle={canShuffle}
          onShuffle={onShuffle}
          confirming={confirming !== null}
          onConfirm={onConfirm}
          dealKey={dealKey}
          dealStep={dealing ? delays.deal : 0}
          flyMs={dealing ? delays.fly : 0}
        />
        <div className="om-fly-layer" aria-hidden="true">
          {flyers.map((f) => (
            <FlyingCard key={f.id} spec={f} />
          ))}
        </div>
        {showPass && <PassScreen name={name} color={SEAT_COLORS[current.seat].main} note={passNote} onReveal={() => setRevealed(game.current)} />}
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

      {game.phase === 'gameover' && !locked && <GameOver state={game} onRestart={onRestart} onChangeSetup={onChangeSetup} onExit={onExit} />}
    </div>
  );
}
