import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Dice3D } from '../../components/Dice3D';
import { withJosa } from '../../lib/korean';
import { sfx } from '../../lib/sound';
import { soloOutcome, useRecordOutcome } from '../../lib/stats';
import { useMusic } from '../../lib/useMusic';
import { useTimers } from '../../lib/useTimers';
import { SEAT_COLORS } from '../common/players';
import type { GameSettings } from '../common/settings';
import { decideAction, recommendSpot, type AiLevel } from './ai';
import { ResourceIcon } from './Art';
import { Board, DICE_SPOT, marketSlotPos, type Placing } from './Board';
import { CORNERS, EDGES, HEXES, VIEW } from './board';
import { Dock, type DockTab } from './Dock';
import { Panel } from './Panel';
import { GameOver } from './Results';
import { BUILD_INFO, BUILD_KINDS, HAND_LIMIT, RES_INFO, actor, applyAction, buildBlocker, emptyRes, hexesWithNumber, playerName, points, totalRes, validSpots } from './rules';
import { ISLAND_SONG } from './song';
import { isSound } from './sounds';
import { ISLAND_DELAYS, clearSavedIslandGame, saveIslandGame } from './storage';
import type { BuildKind, IslandAction, IslandSetup, IslandState, Resource, ResourceCount } from './types';

interface IslandGameProps {
  setup: IslandSetup;
  initialState: IslandState;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

type Pt = { x: number; y: number };
type Timed<T> = T & { id: number; until: number };
interface Flyer {
  x: number;
  y: number;
  dx: number;
  dy: number;
  res: Resource;
  delay: number;
  dur: number;
}
interface Floater {
  x: number;
  y: number;
  text: string;
  tone: 'point' | 'info' | 'flag';
  delay: number;
}
interface Pending {
  player: number;
  res: Resource;
  amount: number;
}
interface Banner {
  text: string;
  color: string | null;
}

let fxSeq = 1;
const EMPTY_SET: ReadonlySet<number> = new Set<number>();

/** 아래 칸에 자원을 보여 줄 사람: 지금 사람 차례면 그 사람, 컴퓨터 차례면 (사람이 한 명일 때) 그 사람 */
function viewerOf(state: IslandState): number {
  const cur = state.current;
  if (state.players[cur].kind === 'human') return cur;
  const humans = state.players.map((p, i) => (p.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  return humans.length === 1 ? humans[0] : cur;
}

/** 판 테두리 안에서 섬 그림 비율을 지키는 크기 */
function useStageSize(ref: RefObject<HTMLDivElement | null>): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      const ratio = VIEW.w / VIEW.h;
      const w = Math.min(W, H * ratio);
      setSize({ w: Math.floor(w), h: Math.floor(w / ratio) });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** 컴퓨터 한 걸음 (그 순간의 최신 상태를 보고 정한다) */
function aiStep(g: IslandState, who: number): IslandState {
  if (actor(g) !== who || g.players[who].kind === 'human') return g;
  const level = g.players[who].kind as AiLevel;
  const next = applyAction(g, decideAction(g, level));
  if (next !== g) return next;
  // 혹시 못 하는 행동을 골랐다면 멈추지 않게
  if (g.phase === 'main') return applyAction(g, { type: 'endTurn' });
  if (g.phase === 'roll') return applyAction(g, { type: 'roll' });
  return g;
}

export function IslandGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: IslandGameProps) {
  const [game, setGame] = useState<IslandState>(initialState);
  const [anim, setAnim] = useState<{ until: number } | null>(null);
  const [tab, setTab] = useState<DockTab>('build');
  const [placingKind, setPlacingKind] = useState<BuildKind | null>(null);
  const [give, setGive] = useState<Resource | null>(null);
  const [discardSel, setDiscardSel] = useState<ResourceCount>(emptyRes);
  const [diceView, setDiceView] = useState<{ value: [number, number] | null; rollId: number }>({ value: initialState.dice, rollId: 0 });
  const [hot, setHot] = useState<ReadonlySet<number>>(EMPTY_SET);
  const [previewDie, setPreviewDie] = useState<0 | 1 | null>(null);
  const [flyers, setFlyers] = useState<Timed<Flyer>[]>([]);
  const [floaters, setFloaters] = useState<Timed<Floater>[]>([]);
  const [pending, setPending] = useState<Timed<Pending>[]>([]);
  const [banner, setBanner] = useState<Timed<Banner> | null>(null);
  const [notice, setNotice] = useState<Timed<{ text: string }> | null>(null);
  const [marketFlash, setMarketFlash] = useState<number | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const prevGame = useRef<IslandState | null>(null);
  const turnLog = useRef<{ player: number; startPoints: number; parts: string[] } | null>(null);
  const later = useTimers();
  const stage = useStageSize(frameRef);
  const delays = ISLAND_DELAYS[settings.speed];
  const fx = delays.fx;
  useMusic(ISLAND_SONG, settings.music);
  useRecordOutcome('island', game.phase === 'gameover', () => soloOutcome(game.players.map((p) => p.kind), [game.winner]));

  const locked = anim !== null;
  const act = actor(game);
  const actorPlayer = act >= 0 ? game.players[act] : null;
  const humanActs = actorPlayer?.kind === 'human';
  const canAct = humanActs && !locked;
  const viewer = viewerOf(game);
  const helper = game.options.helper;

  // 끝난 연출 조각을 치운다.
  useEffect(() => {
    const times = [...flyers.map((f) => f.until), ...floaters.map((f) => f.until), ...pending.map((f) => f.until), banner?.until, notice?.until].filter(
      (t): t is number => t !== undefined,
    );
    if (times.length === 0) return;
    const t = window.setTimeout(
      () => {
        const now = performance.now() + 5;
        const alive = <T extends { until: number }>(list: T[]) => (list.some((x) => x.until <= now) ? list.filter((x) => x.until > now) : list);
        const single = <T extends { until: number }>(v: T | null) => (v && v.until <= now ? null : v);
        setFlyers(alive);
        setFloaters(alive);
        setPending(alive);
        setBanner(single);
        setNotice(single);
      },
      Math.max(0, Math.min(...times) - performance.now()) + 10,
    );
    return () => window.clearTimeout(t);
  }, [flyers, floaters, pending, banner, notice]);

  // 연출 시간이 지나면 입력을 다시 받는다.
  useEffect(() => {
    if (!anim) return;
    const t = window.setTimeout(() => setAnim(null), Math.max(0, anim.until - performance.now()));
    return () => window.clearTimeout(t);
  }, [anim]);

  // 차례가 바뀌면 고르던 것을 지운다.
  useEffect(() => {
    setPlacingKind(null);
    setGive(null);
    setDiscardSel(emptyRes());
  }, [game.turn]);
  useEffect(() => {
    if (game.phase !== 'discard') setDiscardSel(emptyRes());
    if (game.phase !== 'choose') setPreviewDie(null);
  }, [game.phase]);
  // 지은 뒤에 더 지을 수 없으면 고르기를 끝낸다 (길은 이어서 여러 개 놓을 수 있게 남겨 둔다)
  useEffect(() => {
    if (placingKind && (game.phase !== 'main' || act < 0 || buildBlocker(game, act, placingKind) !== null)) setPlacingKind(null);
    if (give && (game.phase !== 'main' || act < 0 || game.players[act].res[give] === 0)) setGive(null);
  }, [game, placingKind, give, act]);

  const reg = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) els.current.set(key, el);
      else els.current.delete(key);
    },
    [],
  );

  const toScreen = useCallback((x: number, y: number): Pt | null => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(x, y).matrixTransform(m);
    return { x: p.x, y: p.y };
  }, []);

  const elCenter = useCallback((key: string): Pt | null => {
    const r = els.current.get(key)?.getBoundingClientRect();
    if (!r || r.width === 0) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, []);

  /** 상태가 바뀔 때마다: 저장 + 마지막 행동의 연출 */
  useLayoutEffect(() => {
    if (game.phase === 'gameover') clearSavedIslandGame();
    else saveIslandGame(setup, game);

    const before = prevGame.current;
    prevGame.current = game;
    if (before === game) return;
    if (!turnLog.current || before === null) turnLog.current = { player: game.current, startPoints: points(game, game.current), parts: [] };
    if (before === null && !game.events.some((e) => e.type === 'start')) return;

    const d = delays;
    const t0 = performance.now();
    const viewerNow = viewerOf(game);
    const newFlyers: Timed<Flyer>[] = [];
    const newFloaters: Timed<Floater>[] = [];
    const newPending: Timed<Pending>[] = [];
    const run = (fn: () => void, at: number) => (at <= 0 ? fn() : later(fn, at));
    const resTarget = (player: number, res: Resource) => (player === viewerNow ? elCenter(`hand-${res}`) : null) ?? elCenter(`pres-${player}-${res}`);
    const fly = (from: Pt | null, to: Pt | null, res: Resource, delay: number) => {
      if (!fx || d.fly <= 0 || !from || !to) return false;
      newFlyers.push({ id: fxSeq++, x: from.x, y: from.y, dx: to.x - from.x, dy: to.y - from.y, res, delay, dur: d.fly, until: t0 + delay + d.fly + 40 });
      return true;
    };
    const float = (at: Pt | null, text: string, tone: Floater['tone'], delay: number, life = 1400) => {
      if (!fx || !at) return;
      newFloaters.push({ id: fxSeq++, x: at.x, y: at.y, text, tone, delay, until: t0 + delay + life });
    };
    const showBanner = (text: string, color: string | null, at: number) => {
      if (!fx) return;
      run(() => setBanner({ id: fxSeq++, text, color, until: performance.now() + d.banner }), at);
    };
    const tl = turnLog.current!;

    let cursor = 0;
    let total = 0;
    for (const e of game.events) {
      switch (e.type) {
        case 'start':
          showBanner('🏝️ 섬에 도착했어요!', null, 0);
          total = Math.max(total, fx ? 600 : 0);
          break;
        case 'roll': {
          setDiceView((v) => ({ value: e.dice, rollId: v.rollId + 1 }));
          isSound.roll();
          const glowAt = d.dice;
          tl.parts.push(`🎲 ${e.dice[0]}·${e.dice[1]}`);
          if (game.phase === 'choose') {
            // 골라 쓰는 주사위: 주사위가 멈추면 고르기를 기다린다
            cursor = glowAt;
            total = Math.max(total, cursor);
            break;
          }
          run(() => setHot(new Set(e.hexes)), glowAt);
          run(() => setHot(EMPTY_SET), glowAt + d.glow + d.fly + 900);
          const tray = toScreen(DICE_SPOT.x, DICE_SPOT.y - 40);
          if (e.dice[0] === e.dice[1]) float(tray, '같은 눈! 두 배 ✨', 'info', glowAt, 1800);
          if (!game.events.some((x) => x.type === 'produce')) float(tray, '아무도 못 받았어요', 'info', glowAt + 200, 1600);
          cursor = glowAt + d.glow;
          total = Math.max(total, cursor);
          break;
        }
        case 'choose': {
          isSound.select();
          setHot(new Set(e.hexes));
          run(() => setHot(EMPTY_SET), d.glow + d.fly + 900);
          const tray = toScreen(DICE_SPOT.x, DICE_SPOT.y - 40);
          float(tray, `👉 ${e.number}`, 'info', 0, 1300);
          if (!game.events.some((x) => x.type === 'produce')) float(tray, '아무도 못 받았어요', 'info', 300, 1600);
          cursor = d.glow;
          total = Math.max(total, cursor);
          tl.parts.push(`👉${e.number}`);
          break;
        }
        case 'produce':
        case 'startGain': {
          const start = e.type === 'startGain' ? cursor + (fx ? 200 : 0) : cursor;
          const landed: Resource[] = [];
          let k = 0;
          for (const g of e.gains) {
            const from = toScreen(HEXES[g.hex].x, HEXES[g.hex].y);
            const to = resTarget(g.player, g.res);
            let flew = false;
            for (let j = 0; j < Math.min(g.amount, 4); j++) {
              flew = fly(from, to, g.res, start + k * d.stagger) || flew;
              k++;
            }
            if (flew) newPending.push({ id: fxSeq++, player: g.player, res: g.res, amount: g.amount, until: t0 + start + (k - 1) * d.stagger + d.fly });
            landed.push(g.res);
          }
          run(() => isSound.gain(landed), start + (fx ? d.fly * 0.85 : 0));
          total = Math.max(total, start + (fx ? d.fly + k * d.stagger : 0));
          break;
        }
        case 'build': {
          isSound.build(e.kind);
          const pos = e.kind === 'road' ? { x: EDGES[e.at].x, y: EDGES[e.at].y } : { x: CORNERS[e.at].x, y: CORNERS[e.at].y };
          if (e.points > 0) float(toScreen(pos.x, pos.y - 26), `+${e.points}점`, 'point', 120);
          total = Math.max(total, fx ? 420 : 0);
          if (game.phase !== 'setup') tl.parts.push(`${BUILD_INFO[e.kind].emoji}`);
          break;
        }
        case 'bank': {
          isSound.swish();
          const at = resTarget(e.player, e.get);
          float(at, `${RES_INFO[e.give].emoji}${e.count} → ${RES_INFO[e.get].emoji}1`, 'info', 0, 1300);
          total = Math.max(total, fx ? 380 : 0);
          tl.parts.push('🏦');
          break;
        }
        case 'market': {
          isSound.swish();
          const slot = marketSlotPos(e.slot);
          const slotPt = toScreen(slot.x, slot.y);
          fly(resTarget(e.player, e.give), slotPt, e.give, 0);
          fly(slotPt, resTarget(e.player, e.get), e.get, fx ? 120 : 0);
          setMarketFlash(e.slot);
          run(() => setMarketFlash(null), fx ? d.fly + 500 : 300);
          total = Math.max(total, fx ? d.fly + 160 : 0);
          tl.parts.push('🧺');
          break;
        }
        case 'flag': {
          run(() => isSound.gull(), 250);
          const name = playerName(game.players[e.player]);
          showBanner(`🚩 ${name} 바다 축제 깃발! +2점`, SEAT_COLORS[game.players[e.player].seat].main, 250);
          total = Math.max(total, fx ? 1100 : 0);
          tl.parts.push('🚩');
          break;
        }
        case 'discard':
          isSound.discard();
          break;
        case 'turn': {
          // 지난 차례 요약
          const prev = tl.player;
          if (prev !== e.player && before && before.phase !== 'setup') {
            const gained = points(game, prev) - tl.startPoints;
            const parts = tl.parts.length > 0 ? tl.parts.join(' ') : '';
            setSummary(`지난 차례 · ${playerName(game.players[prev])}: ${parts}${gained > 0 ? ` · +${gained}점` : ''}`);
          }
          turnLog.current = { player: e.player, startPoints: points(game, e.player), parts: [] };
          const p = game.players[e.player];
          const at = Math.max(total, 80);
          showBanner(p.kind === 'human' ? `${playerName(p)} 차례! 🎲` : `${playerName(p)} 차례`, SEAT_COLORS[p.seat].main, at);
          if (p.kind === 'human') run(() => sfx.turn(), at);
          total = Math.max(total, fx ? at + 350 : 0);
          break;
        }
        case 'win':
          run(() => isSound.win(), total + 150);
          total += fx ? 1300 : 250;
          break;
      }
    }

    if (newFlyers.length > 0) setFlyers((list) => [...list.filter((x) => x.until > t0), ...newFlyers]);
    if (newFloaters.length > 0) setFloaters((list) => [...list.filter((x) => x.until > t0), ...newFloaters]);
    if (newPending.length > 0) setPending((list) => [...list.filter((x) => x.until > t0), ...newPending]);
    if (total > 0) setAnim({ until: performance.now() + total });
  }, [game, setup, delays, fx, later, toScreen, elCenter]);

  const perform = useCallback((a: IslandAction) => setGame((g) => (g.players[g.current]?.kind === 'human' ? applyAction(g, a) : g)), []);

  // 컴퓨터 차례
  useEffect(() => {
    if (locked || game.phase === 'gameover' || act < 0 || game.players[act].kind === 'human') return;
    const wait = game.phase === 'roll' ? delays.think * 0.8 : game.phase === 'choose' ? delays.think * 1.3 : delays.think;
    const t = window.setTimeout(() => setGame((g) => aiStep(g, act)), wait);
    return () => window.clearTimeout(t);
  }, [game, locked, act, delays]);

  // ------------------------------------------------------------ 사람의 행동
  const say = (text: string) => setNotice({ id: fxSeq++, text, until: performance.now() + 2600 });

  const placing: Placing | null = useMemo(() => {
    if (!canAct) return null;
    if (game.phase === 'setup') {
      const kind: BuildKind = game.setupHouse === null ? 'house' : 'road';
      return { kind, spots: validSpots(game, act, kind), recommended: helper ? recommendSpot(game, act, kind) : null, strong: helper };
    }
    if (game.phase === 'main' && placingKind && buildBlocker(game, act, placingKind) === null) {
      return { kind: placingKind, spots: validSpots(game, act, placingKind), recommended: helper ? recommendSpot(game, act, placingKind) : null, strong: helper };
    }
    return null;
  }, [canAct, game, act, placingKind, helper]);

  const pickSpot = useCallback(
    (at: number) => {
      if (!placing) return;
      perform({ type: 'build', kind: placing.kind, at });
    },
    [placing, perform],
  );

  const chooseBuild = (kind: BuildKind) => {
    setTab('build');
    if (!canAct || game.phase !== 'main') return;
    if (placingKind === kind) {
      setPlacingKind(null);
      return;
    }
    const why = buildBlocker(game, act, kind);
    if (why) {
      isSound.nope();
      say(`${BUILD_INFO[kind].name}: ${why}`);
      return;
    }
    isSound.select();
    setPlacingKind(kind);
  };

  const roll = () => {
    if (canAct && game.phase === 'roll') perform({ type: 'roll' });
  };
  const chooseDie = (die: 0 | 1) => {
    if (canAct && game.phase === 'choose') perform({ type: 'choose', die });
  };
  const endTurn = () => {
    if (canAct && game.phase === 'main') perform({ type: 'endTurn' });
  };
  const bankTrade = (get: Resource) => {
    if (canAct && game.phase === 'main' && give) perform({ type: 'bank', give, get });
  };
  const marketTrade = (slot: number) => {
    if (canAct && game.phase === 'main' && give) perform({ type: 'market', give, slot });
  };
  const confirmDiscard = () => {
    if (canAct && game.phase === 'discard' && totalRes(discardSel) === game.discardNeed) perform({ type: 'discard', res: discardSel });
  };

  // 키보드: Space 굴리기, B 짓기, T 바꾸기, 1~4 지을 것, Enter 차례 마치기·내려놓기, Esc 취소
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const onButton = t?.tagName === 'BUTTON' || t?.getAttribute('role') === 'button';
      if (e.key === ' ' && !onButton) {
        if (game.phase === 'roll') {
          e.preventDefault();
          roll();
        }
      } else if (e.key === 'Enter' && !onButton) {
        e.preventDefault();
        if (game.phase === 'discard') confirmDiscard();
        else endTurn();
      } else if (e.code === 'KeyB') {
        setTab('build');
      } else if (e.code === 'KeyT') {
        setTab('trade');
        setPlacingKind(null);
      } else if (e.key === 'Escape') {
        setPlacingKind(null);
        setGive(null);
      } else if ((e.key === '1' || e.key === '2') && game.phase === 'choose') {
        chooseDie(e.key === '1' ? 0 : 1);
      } else if (['1', '2', '3', '4'].includes(e.key) && tab === 'build' && game.phase === 'main') {
        chooseBuild(BUILD_KINDS[Number(e.key) - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ------------------------------------------------------------ 보여 줄 자원 수 (날아오는 중인 것은 아직 빼고)
  const shownRes = game.players.map((p, i) => {
    const r = { ...p.res };
    for (const x of pending) if (x.player === i) r[x.res] = Math.max(0, r[x.res] - x.amount);
    return r;
  });

  // ------------------------------------------------------------ 안내 문구
  const actName = actorPlayer ? playerName(actorPlayer) : '';
  let hint: ReactNode;
  if (game.phase === 'gameover') hint = `${playerName(game.players[game.winner ?? 0])} 우승! 게임이 끝났어요.`;
  else if (!humanActs) {
    hint =
      game.phase === 'setup'
        ? `${withJosa(actName, '이/가')} 처음 ${game.setupHouse === null ? '집' : '길'} 자리를 고르고 있어요…`
        : game.phase === 'roll'
          ? `${withJosa(actName, '이/가')} 주사위를 굴려요…`
          : game.phase === 'choose'
            ? `${withJosa(actName, '이/가')} 어느 눈을 쓸지 고르고 있어요…`
            : `${withJosa(actName, '이/가')} 생각하고 있어요…`;
  } else if (notice) hint = <span className="is-notice">{notice.text}</span>;
  else if (game.phase === 'setup') {
    const second = game.setupStep >= game.players.length;
    hint =
      game.setupHouse === null
        ? `반짝이는 모서리를 눌러 ${second ? '두 번째' : '첫'} 집을 놓아요.${helper ? ' ⭐는 추천 자리예요.' : ''}`
        : '방금 놓은 집에 붙여 길을 놓아요.';
  } else if (game.phase === 'roll') hint = <>주사위를 굴려요! <kbd>Space</kbd></>;
  else if (game.phase === 'choose') hint = <>어느 눈을 쓸까요? 주사위나 아래 칸을 눌러요. <kbd>1</kbd> <kbd>2</kbd></>;
  else if (game.phase === 'discard') hint = `자원이 ${HAND_LIMIT}개보다 많아요. ${game.discardNeed}개를 골라 내려놓아요.`;
  else if (points(game, act) >= game.options.target) hint = <>🎉 목표 점수! 차례를 마치면 이겨요. <kbd>Enter</kbd></>;
  else if (placing) hint = `반짝이는 자리를 눌러 ${withJosa(BUILD_INFO[placing.kind].name, '을/를')} 지어요. (Esc 취소)`;
  else {
    const can = BUILD_KINDS.filter((k) => buildBlocker(game, act, k) === null).map((k) => BUILD_INFO[k].name);
    const over = totalRes(game.players[act].res) > HAND_LIMIT;
    hint = (
      <>
        {over && `⚠ 마칠 때 ${HAND_LIMIT}개만 남겨요. `}
        {can.length > 0 ? `지을 수 있어요: ${can.join(', ')}. ` : helper ? '모자란 자원은 바꾸기(T)로 채워요. ' : ''}
        다 했으면 <kbd>Enter</kbd>
      </>
    );
  }

  const trayStyle = {
    left: `${((DICE_SPOT.x - VIEW.x) / VIEW.w) * 100}%`,
    top: `${((DICE_SPOT.y - VIEW.y) / VIEW.h) * 100}%`,
    '--is-dice': `${Math.round(Math.max(34, Math.min(60, stage.w * 0.068)))}px`,
  } as CSSProperties;
  const diceColor = actorPlayer ? SEAT_COLORS[actorPlayer.seat].main : '#e5484d';
  const shownDice = diceView.value;
  const preview = game.phase === 'choose' && game.dice && previewDie !== null ? new Set(hexesWithNumber(game, game.dice[previewDie])) : EMPTY_SET;
  let diceLabel = '🎲 🎲';
  if (game.dice && game.phase === 'choose') diceLabel = locked ? '…' : '어느 눈?';
  else if (game.dice && (game.phase === 'main' || game.phase === 'discard'))
    diceLabel = game.chosenDie !== null ? `👉 ${game.dice[game.chosenDie]}` : `${game.dice[0]} · ${game.dice[1]}`;

  return (
    <div className="is-game">
      <div className="is-main">
        <div className="is-frame" ref={frameRef}>
          <div className="is-stage" style={{ width: stage.w, height: stage.h }}>
            <Board state={game} placing={placing} hot={hot} preview={preview} marketFlash={marketFlash} onPick={pickSpot} svgRef={svgRef} viewer={viewer} />
            <div className="is-dice-tray" style={trayStyle} aria-live="polite">
              <div className="is-dice-pair">
                {([0, 1] as const).map((die) => {
                  const choosing = canAct && game.phase === 'choose';
                  const chosen = game.chosenDie;
                  const cls = chosen === null || (game.phase !== 'main' && game.phase !== 'discard') ? '' : chosen === die ? ' is-die-chosen' : ' is-die-faded';
                  return (
                    <button
                      key={die}
                      type="button"
                      className={`is-die-btn${cls}`}
                      disabled={!choosing}
                      onClick={() => chooseDie(die)}
                      onMouseEnter={() => choosing && setPreviewDie(die)}
                      onMouseLeave={() => setPreviewDie(null)}
                      aria-label={shownDice ? `${shownDice[die]} 쓰기` : '주사위'}
                      data-testid={`is-die-${die}`}
                    >
                      <Dice3D value={shownDice?.[die] ?? null} rollId={diceView.rollId} duration={delays.dice} accent={diceColor} />
                    </button>
                  );
                })}
              </div>
              <span className="is-dice-label">{diceLabel}</span>
            </div>
            {banner && (
              <div className="is-banner" key={banner.id} style={{ '--pc': banner.color ?? 'var(--accent)' } as CSSProperties}>
                {banner.text}
              </div>
            )}
          </div>
        </div>
        <Dock
          state={game}
          viewer={viewer}
          shownRes={shownRes[viewer]}
          canAct={canAct}
          tab={tab}
          onTab={(t) => {
            setTab(t);
            if (t === 'trade') setPlacingKind(null);
          }}
          placing={placingKind}
          onChooseBuild={chooseBuild}
          give={give}
          onGive={(r) => {
            if (r) isSound.select();
            setGive(r);
          }}
          onBank={bankTrade}
          onMarket={marketTrade}
          discardSel={discardSel}
          onDiscardSel={setDiscardSel}
          onDiscard={confirmDiscard}
          onRoll={roll}
          onEndTurn={endTurn}
          onChoose={chooseDie}
          onPreview={(die) => setPreviewDie(canAct ? die : null)}
          reg={reg}
          helper={helper}
        />
        <p className="is-sr" aria-live="polite">
          {game.log.at(-1)?.text ?? ''}
        </p>
      </div>

      <Panel
        state={game}
        hint={hint}
        summary={summary}
        shownRes={shownRes}
        reg={reg}
        settings={settings}
        onSettings={onSettings}
        onNewGame={() => {
          if (game.phase === 'gameover' || window.confirm('지금 게임을 그만두고 새 게임을 할까요?')) onChangeSetup();
        }}
        onExit={onExit}
      />

      <div className="is-fly-layer" aria-hidden="true">
        {flyers.map((f) => (
          <span
            key={f.id}
            className="is-flyer"
            style={{ left: f.x, top: f.y, '--dx': `${f.dx}px`, '--dy': `${f.dy}px`, '--dur': `${f.dur}ms`, '--delay': `${f.delay}ms` } as CSSProperties}
          >
            <span className="is-flyer-y">
              <span className="is-flyer-icon">
                <ResourceIcon res={f.res} size={22} />
              </span>
            </span>
          </span>
        ))}
        {floaters.map((f) => (
          <span key={f.id} className={`is-floater is-floater-${f.tone}`} style={{ left: f.x, top: f.y, '--delay': `${f.delay}ms` } as CSSProperties}>
            {f.text}
          </span>
        ))}
      </div>

      {game.phase === 'gameover' && !locked && <GameOver state={game} onRestart={onRestart} onChangeSetup={onChangeSetup} onExit={onExit} />}
    </div>
  );
}

