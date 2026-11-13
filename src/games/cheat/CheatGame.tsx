import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { PassScreen } from '../../components/PassScreen';
import { FlyingCard, type FlyingCardSpec } from '../../components/PlayingCard';
import { withJosa } from '../../lib/korean';
import { sfx } from '../../lib/sound';
import { useMusic } from '../../lib/useMusic';
import { useTimers } from '../../lib/useTimers';
import { SEAT_COLORS } from '../common/players';
import { rankLabel, sortCards, type Card } from '../common/playingCards';
import type { GameSettings } from '../common/settings';
import { decideDoubt, decidePlay, type AiLevel } from './ai';
import { HandTray } from './HandTray';
import { Panel } from './Panel';
import { GameOver } from './Results';
import { MAX_PLAY, actor, applyAction, claimText, countWord, playerName, rankWithObject, upcomingRanks } from './rules';
import { CHEAT_SONG } from './song';
import { chSound } from './sounds';
import { CHEAT_DELAYS, clearSavedCheatGame, saveCheatGame } from './storage';
import { Table, type CenterFx, type RevealFx, type SeatFx } from './Table';
import type { CheatAction, CheatSetup, CheatState, Verdict } from './types';

interface CheatGameProps {
  setup: CheatSetup;
  initialState: CheatState;
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
  /** 차례 넘김 화면이 필요하다 */
  needPass: boolean;
}

/** 지금 누구의 손패를 아래 칸에 보여 줄지 정한다 */
function computeView(state: CheatState, revealed: number | null): View {
  const humans = state.players.map((p, i) => (p.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  const coverMode = state.options.handView === 'cover' && humans.length >= 2;
  const act = actor(state);
  if (act >= 0 && state.players[act].kind === 'human') {
    const needPass = coverMode && revealed !== act;
    return { owner: act, faceUp: !needPass, coverMode, needPass };
  }
  if (humans.length === 1) return { owner: humans[0], faceUp: true, coverMode, needPass: false };
  if (!coverMode && humans.length > 0) {
    const n = state.players.length;
    for (let k = 1; k <= n; k++) {
      const i = (state.current + k) % n;
      if (state.players[i].kind === 'human') return { owner: i, faceUp: true, coverMode, needPass: false };
    }
  }
  return { owner: null, faceUp: false, coverMode, needPass: false };
}

/** 바로 앞에 낸 카드가 어떻게 되었는지 한 줄로 */
function verdictText(state: CheatState, v: Verdict | null): string {
  if (!v) return '';
  const who = playerName(state.players[v.claim.player]);
  const said = `${who}의 “${claimText(v.claim.rank, v.claim.count)}”`;
  if (v.result === 'accepted') return `${said} → 모두 믿었어요.`;
  const taker = playerName(state.players[v.taker!]);
  return v.result === 'lie' ? `${said} → 거짓말 들통! ${withJosa(taker, '이/가')} ${v.taken}장을 가져갔어요.` : `${said} → 진짜였어요! ${withJosa(taker, '이/가')} ${v.taken}장을 가져갔어요.`;
}

type Pt = { x: number; y: number; w: number };
type Timed<T> = T & { until: number };

let fxSeq = 1;
const EMPTY: ReadonlySet<number> = new Set<number>();
const SEAT_CARD_W = 28;
const PILE_CARD_W = 54;
const DEAL_STEP = 22;

export function CheatGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: CheatGameProps) {
  const [game, setGame] = useState<CheatState>(initialState);
  const [anim, setAnim] = useState<{ until: number; dealing: boolean } | null>(null);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<number>>(EMPTY);
  const [cursor, setCursor] = useState<number | null>(null);
  const [flyers, setFlyers] = useState<Timed<FlyingCardSpec>[]>([]);
  const [seatFx, setSeatFx] = useState<Timed<SeatFx>[]>([]);
  const [centerFx, setCenterFx] = useState<Timed<CenterFx> | null>(null);
  const [reveal, setReveal] = useState<Timed<RevealFx> | null>(null);
  /** 더미 장수 고치기: 아직 날아가는 중인 카드(-), 아직 가져가기 전인 카드(+) */
  const [pileAdjust, setPileAdjust] = useState<Timed<{ delta: number }> | null>(null);
  const [hidden, setHidden] = useState<Timed<{ ids: ReadonlySet<number> }> | null>(null);
  const [recent, setRecent] = useState<Timed<{ ids: ReadonlySet<number> }> | null>(null);
  const [dealKey, setDealKey] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const rects = useRef(new Map<string, DOMRect>());
  const lastView = useRef<View | null>(null);
  const prevGame = useRef<CheatState | null>(null);
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  const later = useTimers();
  const delays = CHEAT_DELAYS[settings.speed];
  useMusic(CHEAT_SONG, settings.music);

  const locked = anim !== null;
  const dealing = anim?.dealing ?? false;
  const act = actor(game);
  const actorPlayer = act >= 0 ? game.players[act] : null;
  const view = computeView(game, revealed);
  const humanActs = actorPlayer?.kind === 'human';
  const ready = humanActs && view.owner === act && view.faceUp && !locked;
  const canPlay = ready && game.phase === 'play';
  const judging = ready && game.phase === 'doubt';
  const showPass = view.needPass && !locked;
  const fx = delays.fx;

  // 끝난 연출 조각을 치운다.
  useEffect(() => {
    const times = [...flyers.map((f) => f.until), ...seatFx.map((f) => f.until), centerFx?.until, reveal?.until, pileAdjust?.until, hidden?.until, recent?.until].filter(
      (t): t is number => t !== undefined,
    );
    if (times.length === 0) return;
    const t = window.setTimeout(
      () => {
        const now = performance.now() + 5;
        const alive = <T extends { until: number }>(list: T[]) => (list.some((x) => x.until <= now) ? list.filter((x) => x.until > now) : list);
        const single = <T extends { until: number }>(v: T | null) => (v && v.until <= now ? null : v);
        setFlyers(alive);
        setSeatFx(alive);
        setCenterFx(single);
        setReveal(single);
        setPileAdjust(single);
        setHidden(single);
        setRecent(single);
      },
      Math.max(0, Math.min(...times) - performance.now()) + 10,
    );
    return () => window.clearTimeout(t);
  }, [flyers, seatFx, centerFx, reveal, pileAdjust, hidden, recent]);

  // 연출 시간이 지나면 입력을 다시 받는다.
  useEffect(() => {
    if (!anim) return;
    const t = window.setTimeout(() => setAnim(null), Math.max(0, anim.until - performance.now()));
    return () => window.clearTimeout(t);
  }, [anim]);

  // 차례가 바뀌면 고른 카드를 지운다. 컴퓨터가 정하는 동안에는 손패를 다시 가린다.
  useEffect(() => {
    setSelected(EMPTY);
    setCursor(null);
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

  const local = useCallback((r: DOMRect | undefined | null): Pt | null => {
    const m = mainRef.current?.getBoundingClientRect();
    if (!r || !m || r.width === 0) return null;
    return { x: r.left + r.width / 2 - m.left, y: r.top + r.height / 2 - m.top, w: r.width };
  }, []);

  /** 상태가 바뀔 때마다: 저장 + 마지막 행동의 연출 */
  useLayoutEffect(() => {
    if (game.phase === 'gameover') clearSavedCheatGame();
    else saveCheatGame(setup, game);

    const before = prevGame.current;
    prevGame.current = game;
    if (before === game) return;
    if (before === null && !game.events.some((e) => e.type === 'deal')) return;

    const fly = delays.fly;
    const n = game.players.length;
    const open = game.options.handView === 'open';
    const beforeView = lastView.current ?? computeView(game, null);
    const afterView = computeView(game, revealedRef.current);
    const now = (key: string) => local(els.current.get(key)?.getBoundingClientRect());
    const was = (key: string) => local(rects.current.get(key));
    const seatPt = (i: number): Pt | null => {
      const p = now(`seat-${i}`) ?? was(`seat-${i}`);
      return p ? { ...p, w: SEAT_CARD_W } : null;
    };
    const pileRaw = now('pile') ?? was('pile');
    const pilePt: Pt | null = pileRaw ? { ...pileRaw, w: PILE_CARD_W } : null;

    const t0 = performance.now();
    const newFlyers: Timed<FlyingCardSpec>[] = [];
    const sound = (play: () => void, at: number) => (at <= 0 ? play() : later(play, at));
    const bubble = (player: number, text: string, tone: SeatFx['tone'], at: number, life: number) => {
      if (fx) later(() => setSeatFx((list) => [...list, { id: fxSeq++, player, text, tone, until: performance.now() + life }]), Math.max(0, at));
    };
    const center = (text: string, tone: CenterFx['tone'], at: number, life = 1600) => {
      if (fx) later(() => setCenterFx({ id: fxSeq++, text, tone, until: performance.now() + life }), Math.max(0, at));
    };
    const flyer = (from: Pt | null, to: Pt | null, card: Card | null, opts: { delay: number; hide?: boolean; rotate?: number }) => {
      if (fly <= 0 || !from || !to) return;
      newFlyers.push({ id: fxSeq++, x: from.x, y: from.y, tx: to.x, ty: to.y, card, duration: fly, w0: from.w, w1: to.w, until: t0 + opts.delay + fly + 30, ...opts });
    };

    let total = 0;
    let cursorAt = 0;
    let isDeal = false;
    for (const e of game.events) {
      switch (e.type) {
        case 'deal': {
          isDeal = true;
          setDealKey((k) => k + 1);
          sound(() => chSound.deal(), 0);
          const most = Math.max(...e.counts);
          total = Math.max(total, fx ? most * n * DEAL_STEP + 400 : 0);
          break;
        }
        case 'play': {
          const fromFace = beforeView.owner === e.player && beforeView.faceUp;
          const hand = before?.players[e.player].hand ?? [];
          e.cardIds.forEach((id, j) => {
            const card = hand.find((c) => c.id === id) ?? null;
            const from = fromFace ? was(`tray-${id}`) : seatPt(e.player);
            const showFace = (fromFace || open) && card;
            flyer(from, pilePt ? { ...pilePt, x: pilePt.x + 14 + j * 12, y: pilePt.y - 10 } : null, showFace ? card : null, { delay: j * 70, hide: !!showFace, rotate: ((id * 37) % 23) / 3 - 4 });
          });
          if (fly > 0) setPileAdjust({ delta: -e.count, until: t0 + fly + e.count * 70 });
          bubble(e.player, `“${claimText(e.rank, e.count)}”`, 'claim', 0, Math.max(1300, fly + delays.claim + 900));
          sound(() => chSound.play(e.count), 0);
          total = Math.max(total, fly + e.count * 70 + delays.claim);
          break;
        }
        case 'pass':
          bubble(e.player, '믿어요 👍', 'pass', 0, 900);
          sound(() => chSound.pass(), 0);
          total = Math.max(total, delays.pass);
          break;
        case 'accepted':
          break;
        case 'doubt':
          bubble(e.doubter, '거짓말! 🤨', 'doubt', 0, 2200);
          sound(() => chSound.doubt(), 0);
          cursorAt = fx ? 500 : 80;
          // 가져가기 전까지 더미를 그대로 보여 준다.
          if (before) setPileAdjust({ delta: before.pile.length, until: t0 + 60_000 });
          break;
        case 'reveal': {
          const id = fxSeq++;
          // 타이머 안에서 쓰는 시각은 지금 값으로 고정해 둔다 (cursorAt은 뒤에서 바뀐다)
          const start = cursorAt;
          const flipAt = start + (fx ? 650 : 120);
          const end = flipAt + delays.reveal;
          later(() => setReveal({ id, cards: e.cards, rank: e.rank, lie: e.lie, flipped: false, until: performance.now() + (end - start) }), start);
          later(() => setReveal((r) => (r && r.id === id ? { ...r, flipped: true } : r)), flipAt);
          if (fx) sound(() => chSound.drumroll(), start);
          sound(() => (e.lie ? chSound.caught() : chSound.truth()), flipAt + 150);
          center(e.lie ? '거짓말 들통! 🤥' : '진짜였어요! 😇', e.lie ? 'lie' : 'truth', flipAt + 150, delays.reveal + 200);
          bubble(e.claimant, e.lie ? '들켰다! 😱' : '진짜라니까! 😎', e.lie ? 'caught' : 'truth', flipAt + 150, delays.reveal + 300);
          cursorAt = end;
          break;
        }
        case 'pickup': {
          const toFace = afterView.owner === e.player && afterView.faceUp;
          const to = toFace ? now('tray-hand') : seatPt(e.player);
          const k = Math.min(e.count, 8);
          for (let j = 0; j < k; j++) flyer(pilePt, to ? { ...to, w: toFace ? 60 : SEAT_CARD_W } : null, null, { delay: cursorAt + j * 50 });
          const startAt = cursorAt;
          later(() => setPileAdjust(null), startAt);
          sound(() => chSound.pickup(e.count), startAt);
          if (toFace && before) {
            const had = new Set(before.players[e.player].hand.map((c) => c.id));
            const ids = new Set(game.players[e.player].hand.filter((c) => !had.has(c.id)).map((c) => c.id));
            if (fly > 0) setHidden({ ids, until: t0 + startAt + fly + k * 50 });
            setRecent({ ids, until: t0 + startAt + fly + 3200 });
          }
          cursorAt = startAt + (fly > 0 ? fly + k * 50 + 150 : 100);
          total = Math.max(total, cursorAt);
          break;
        }
        case 'win': {
          const at = Math.max(cursorAt, total);
          center(`🏆 ${playerName(game.players[e.player])} 우승!`, 'win', at, 2000);
          bubble(e.player, '다 냈다! 🎉', 'win', at, 2000);
          sound(() => chSound.win(), at + 100);
          total = Math.max(total, at + (fx ? 1800 : 300));
          break;
        }
      }
    }
    total = Math.max(total, cursorAt);

    if (newFlyers.length > 0) setFlyers((list) => [...list.filter((x) => x.until > t0), ...newFlyers]);

    // 사람이 무언가 정할 차례가 오면 알림음
    const nextAct = actor(game);
    if (nextAct >= 0 && game.players[nextAct].kind === 'human' && (!before || actor(before) !== nextAct)) sound(() => sfx.turn(), total + 50);
    if (total > 0) setAnim({ until: performance.now() + total, dealing: isDeal });
  }, [game, setup, delays, fx, local, later]);

  // 그린 뒤 위치 기억 (다음 연출의 출발점)
  useLayoutEffect(() => {
    const m = new Map<string, DOMRect>();
    els.current.forEach((el, k) => m.set(k, el.getBoundingClientRect()));
    rects.current = m;
    lastView.current = view;
  });

  const perform = useCallback((a: CheatAction) => setGame((g) => applyAction(g, a)), []);

  // 컴퓨터 차례 (그 순간의 최신 상태를 보고 정한다)
  useEffect(() => {
    if (locked || game.phase === 'gameover' || act < 0 || game.players[act].kind === 'human') return;
    const wait = game.phase === 'play' ? delays.think : delays.doubtThink;
    const t = window.setTimeout(() => {
      setGame((g) => {
        const a = actor(g);
        if (a !== act || g.phase === 'gameover' || g.players[a].kind === 'human') return g;
        const level = g.players[a].kind as AiLevel;
        if (g.phase === 'play') return applyAction(g, { type: 'play', cardIds: decidePlay(g, level) });
        return applyAction(g, { type: decideDoubt(g, a, level) ? 'doubt' : 'pass', player: a });
      });
    }, wait);
    return () => window.clearTimeout(t);
  }, [game, locked, act, delays]);

  // ------------------------------------------------------------ 사람의 행동
  const ownerHand = view.owner !== null ? sortCards(game.players[view.owner].hand, 'rank') : [];

  const toggle = (id: number) => {
    if (!canPlay) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < MAX_PLAY) next.add(id);
    else return;
    chSound.select(next.has(id));
    setSelected(next);
  };

  const selectMatches = () => {
    if (!canPlay) return;
    const ids = ownerHand.filter((c) => c.rank === game.rank).map((c) => c.id);
    if (ids.length === 0) return;
    chSound.select(true);
    setSelected(new Set(ids.slice(0, MAX_PLAY)));
  };

  const playSelected = () => {
    if (!canPlay || selected.size === 0) return;
    const cardIds = [...selected];
    setSelected(EMPTY);
    setCursor(null);
    setGame((g) => (g.phase === 'play' && g.players[g.current].kind === 'human' ? applyAction(g, { type: 'play', cardIds }) : g));
  };

  const judge = (yes: boolean) => {
    if (!judging) return;
    perform({ type: yes ? 'doubt' : 'pass', player: act });
  };

  // 키보드: ←→ 고르기, Space 고르기/믿어요, A 지금 숫자 모두, Enter 내기, Esc 다시 고르기, D 거짓말!
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      if (showPass || e.ctrlKey || e.metaKey || e.altKey) return;
      const onButton = t?.tagName === 'BUTTON';
      if (judging) {
        if (e.code === 'KeyD') {
          e.preventDefault();
          judge(true);
        } else if ((e.key === ' ' || e.key === 'Enter') && !onButton) {
          e.preventDefault();
          judge(false);
        }
        return;
      }
      if (!canPlay) return;
      const len = ownerHand.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const d = e.key === 'ArrowLeft' ? -1 : 1;
        setCursor(cursor === null ? (d > 0 ? 0 : len - 1) : (cursor + d + len) % len);
      } else if (e.key === ' ' && !onButton) {
        e.preventDefault();
        if (cursor !== null && ownerHand[cursor]) toggle(ownerHand[cursor].id);
        else setCursor(0);
      } else if (e.code === 'KeyA') {
        e.preventDefault();
        selectMatches();
      } else if (e.key === 'Enter' && !onButton) {
        e.preventDefault();
        playSelected();
      } else if (e.key === 'Escape') {
        setSelected(EMPTY);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ------------------------------------------------------------ 안내 문구
  const actName = actorPlayer ? playerName(actorPlayer) : '';
  const claim = game.claim;
  const claimant = claim ? game.players[claim.player] : null;
  let hint: string;
  if (game.phase === 'gameover') hint = `${playerName(game.players[game.winner ?? 0])} 우승! 게임이 끝났어요.`;
  else if (dealing) hint = '카드를 나눠 주는 중…';
  else if (locked && reveal) hint = '카드를 뒤집어 봐요… 두근두근!';
  else if (locked) hint = claim && claimant ? `${playerName(claimant)}: “${claimText(claim.rank, claim.count)}”` : `${actName} 차례예요.`;
  else if (view.needPass) hint = `${actName} 차례예요. '내 카드 보기'를 누르세요.`;
  else if (canPlay) hint = `“${rankLabel(game.rank)}”라고 말하며 낼 카드를 1~${MAX_PLAY}장 골라요. ${rankLabel(game.rank)} 카드가 없으면 다른 카드로 거짓말!`;
  else if (judging && claimant && claim)
    hint = `${playerName(claimant)}: “${claimText(claim.rank, claim.count)}” 정말일까요? 거짓말 같으면 '거짓말이야!'`;
  else if (game.phase === 'doubt') hint = `${withJosa(actName, '이/가')} 의심할지 생각하고 있어요…`;
  else hint = `${withJosa(actName, '이/가')} ${rankWithObject(game.rank)} 낼 카드를 고르고 있어요…`;

  // 가운데 상자
  let box: ReactNode;
  if (game.phase === 'gameover') {
    box = <p className="ch-box-info">{verdictText(game, game.verdict)}</p>;
  } else if (judging && claim && claimant) {
    const me = game.players[act];
    const inHand = me.hand.filter((c) => c.rank === claim.rank).length;
    const inPile = game.pile.filter((pc) => pc.by === act && pc.card.rank === claim.rank).length;
    const sure = inHand + inPile + claim.count > 4;
    box = (
      <div className="ch-prompt" data-testid="ch-prompt">
        <p className="ch-prompt-q">
          <b style={{ color: SEAT_COLORS[claimant.seat].dark }}>{withJosa(playerName(claimant), '이/가')}</b> {rankWithObject(claim.rank)} <b>{countWord(claim.count)}</b> 냈대요. 정말일까요?
        </p>
        <p className="ch-prompt-mine">
          내 손의 {rankLabel(claim.rank)}: <b>{inHand}장</b>
          {inPile > 0 && ` · 내가 더미에 낸 ${rankLabel(claim.rank)}: ${inPile}장`}
        </p>
        {sure && (
          <p className="ch-prompt-sure">
            💡 {rankLabel(claim.rank)} 카드는 4장뿐인데 내가 {inHand + inPile}장을 알아요. {countWord(claim.count)}은 있을 수 없어요!
          </p>
        )}
        {claimant.hand.length === 0 && <p className="ch-prompt-warn">⚠ 마지막 카드예요! 믿으면 {withJosa(playerName(claimant), '이/가')} 이겨요.</p>}
        <div className="ch-prompt-actions">
          <button type="button" className="btn ch-btn-doubt" onClick={() => judge(true)} data-testid="ch-doubt">
            🤥 거짓말이야! <kbd>D</kbd>
          </button>
          <button type="button" className="btn ch-btn-pass" onClick={() => judge(false)} data-testid="ch-pass">
            👍 믿어요 <kbd>Space</kbd>
          </button>
        </div>
      </div>
    );
  } else {
    const info = game.phase === 'doubt' ? `🤔 ${withJosa(actName, '이/가')} 의심할지 생각 중…` : canPlay ? '👇 아래에서 낼 카드를 골라요' : `${actName} 차례`;
    box = (
      <div className="ch-box-info">
        {game.verdict && game.phase === 'play' && <p className="ch-box-last">{verdictText(game, game.verdict)}</p>}
        {!locked && <p>{info}</p>}
      </div>
    );
  }

  const passNote =
    game.phase === 'doubt' && claim && claimant
      ? `${playerName(claimant)}: “${claimText(claim.rank, claim.count)}” 의심할지 정해요.`
      : verdictText(game, game.verdict) || undefined;

  const pileCount = Math.max(0, game.pile.length + (pileAdjust?.delta ?? 0));
  const upcoming = view.owner !== null && game.phase !== 'gameover' ? upcomingRanks(game, view.owner, 3) : [];

  return (
    <div className="ch-game">
      <div className="ch-main" ref={mainRef}>
        <Table
          state={game}
          openHands={game.options.handView === 'open'}
          reg={reg}
          seatFx={seatFx}
          centerFx={centerFx}
          reveal={reveal}
          box={box}
          pileCount={pileCount}
          actor={act}
          thinking={!humanActs && !locked && game.phase !== 'gameover'}
          dealKey={dealKey}
          dealStep={dealing && fx ? DEAL_STEP : 0}
        />
        <HandTray
          state={game}
          owner={view.owner}
          faceUp={view.faceUp}
          canPlay={canPlay}
          hint={hint}
          reg={reg}
          selected={selected}
          cursor={cursor}
          onToggle={toggle}
          onSelectMatches={selectMatches}
          onClear={() => setSelected(EMPTY)}
          onPlay={playSelected}
          hidden={hidden?.ids ?? EMPTY}
          recent={recent?.ids ?? EMPTY}
          upcoming={upcoming}
          dealKey={dealKey}
          dealStep={dealing && fx ? DEAL_STEP : 0}
        />
        <div className="ch-fly-layer" aria-hidden="true">
          {flyers.map((f) => (
            <FlyingCard key={f.id} spec={f} />
          ))}
        </div>
        {showPass && actorPlayer && <PassScreen name={actName} color={SEAT_COLORS[actorPlayer.seat].main} note={passNote} onReveal={() => setRevealed(act)} />}
        <p className="ch-sr" aria-live="polite">
          {game.log.at(-1)?.text ?? ''}
        </p>
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
