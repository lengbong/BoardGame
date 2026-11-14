import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { withJosa } from '../../lib/korean';
import { sfx } from '../../lib/sound';
import { soloOutcome, useRecordOutcome } from '../../lib/stats';
import { useMusic } from '../../lib/useMusic';
import { useTimers } from '../../lib/useTimers';
import type { GameSettings } from '../common/settings';
import { decideAction, type AiLevel } from './ai';
import { PlantPicture, TokenIcon } from './Art';
import { FieldBed, Market, Plot, RibbonBoard, type CardInfo, type PlotFx, type Selection } from './Board';
import { GOALS, RES, RES_EMOJI, RES_LABEL, TOKENS, card } from './cards';
import { Panel } from './Panel';
import { GameOver } from './Results';
import {
  GREENHOUSE_SIZE,
  LINES,
  STORAGE_LIMIT,
  applyAction,
  autoDiscard,
  canPlant,
  discardNeed,
  effectiveCost,
  isOnSale,
  lineLabel,
  lineTokens,
  payment,
  playerName,
  shortfall,
  tokenTotal,
  tokensText,
} from './rules';
import { GARDEN_SONG } from './song';
import { gdSound } from './sounds';
import { GARDEN_DELAYS, clearSavedGardenGame, saveGardenGame } from './storage';
import type { GardenAction, GardenSetup, GardenState, LineId, Token, TokenCount } from './types';

interface GardenGameProps {
  setup: GardenSetup;
  initialState: GardenState;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

type Pt = { x: number; y: number };
type Timed<T> = T & { until: number };

interface Flyer {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  delay: number;
  duration: number;
  token?: Token;
  cardId?: number;
}

interface Toast {
  id: number;
  text: string;
  tone: 'ribbon' | 'goal' | 'round';
}

type Zone = 'field' | 'market';

let fxSeq = 1;
const NO_IDS: ReadonlySet<number> = new Set<number>();
const NO_DROPS: ReadonlyMap<number, number> = new Map<number, number>();

export function GardenGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: GardenGameProps) {
  const [game, setGame] = useState<GardenState>(initialState);
  const [anim, setAnim] = useState<{ until: number } | null>(null);
  const [sel, setSel] = useState<Selection>(null);
  const [hoverLine, setHoverLine] = useState<LineId | null>(null);
  const [zone, setZone] = useState<Zone | null>(null);
  const [back, setBack] = useState<Partial<TokenCount>>({});
  const [flyers, setFlyers] = useState<Timed<Flyer>[]>([]);
  const [plotFx, setPlotFx] = useState<PlotFx[]>([]);
  const [toast, setToast] = useState<Timed<Toast> | null>(null);
  const [wiltGhost, setWiltGhost] = useState<Timed<{ cardId: number; key: number }> | null>(null);
  const [entering, setEntering] = useState<Timed<{ ids: ReadonlySet<number> }> | null>(null);
  const [drops, setDrops] = useState<Timed<{ map: ReadonlyMap<number, number> }> | null>(null);
  const [pulse, setPulse] = useState<Timed<{ goal: string }> | null>(null);
  const [slideDelay, setSlideDelay] = useState(0);
  const [refillDelay, setRefillDelay] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const rects = useRef(new Map<string, DOMRect>());
  const prevGame = useRef<GardenState | null>(null);
  const later = useTimers();
  const delays = GARDEN_DELAYS[settings.speed];
  useMusic(GARDEN_SONG, settings.music);
  useRecordOutcome('garden', game.phase === 'gameover', () =>
    soloOutcome(
      game.players.map((p) => p.kind),
      game.winners,
    ),
  );

  const over = game.phase === 'gameover';
  const locked = anim !== null;
  const cur = game.current;
  const curPlayer = game.players[cur];
  const humanTurn = !over && curPlayer.kind === 'human';
  const ready = humanTurn && !locked;
  const canAct = ready && game.phase === 'play';
  const discarding = ready && game.phase === 'discard';
  const need = discardNeed(game);

  // ------------------------------------------------------------ 연출 조각 정리
  useEffect(() => {
    const times = [...flyers.map((f) => f.until), ...plotFx.map((f) => f.until), toast?.until, wiltGhost?.until, entering?.until, drops?.until, pulse?.until].filter(
      (t): t is number => t !== undefined,
    );
    if (times.length === 0) return;
    const t = window.setTimeout(
      () => {
        const now = performance.now() + 5;
        const alive = <T extends { until: number }>(list: T[]) => (list.some((x) => x.until <= now) ? list.filter((x) => x.until > now) : list);
        const single = <T extends { until: number }>(v: T | null) => (v && v.until <= now ? null : v);
        setFlyers(alive);
        setPlotFx(alive);
        setToast(single);
        setWiltGhost(single);
        setEntering(single);
        setDrops(single);
        setPulse(single);
      },
      Math.max(0, Math.min(...times) - performance.now()) + 10,
    );
    return () => window.clearTimeout(t);
  }, [flyers, plotFx, toast, wiltGhost, entering, drops, pulse]);

  useEffect(() => {
    if (!anim) return;
    const t = window.setTimeout(() => setAnim(null), Math.max(0, anim.until - performance.now()));
    return () => window.clearTimeout(t);
  }, [anim]);

  // 차례·단계가 바뀌면 고른 것을 지운다
  useEffect(() => {
    setSel(null);
    setBack({});
    setZone(null);
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
    return { x: r.left + r.width / 2 - m.left, y: r.top + r.height / 2 - m.top };
  }, []);

  // ------------------------------------------------------------ 상태가 바뀔 때: 저장 + 연출
  useLayoutEffect(() => {
    if (game.phase === 'gameover') clearSavedGardenGame();
    else saveGardenGame(setup, game);

    const before = prevGame.current;
    prevGame.current = game;
    if (before === null || before === game) return;

    const fly = delays.fly;
    const fx = delays.fx;
    const step = fly > 0 ? 80 : 0;
    const now = (key: string) => local(els.current.get(key)?.getBoundingClientRect());
    const was = (key: string) => local(rects.current.get(key)) ?? now(key);
    const t0 = performance.now();
    const newFlyers: Timed<Flyer>[] = [];
    const newFx: PlotFx[] = [];
    const sound = (play: () => void, at: number) => (at <= 0 ? play() : later(play, at));
    const flyer = (from: Pt | null, to: Pt | null, what: { token?: Token; cardId?: number }, delay: number) => {
      if (fly <= 0 || !from || !to) return;
      const duration = what.cardId !== undefined ? fly + 120 : fly;
      newFlyers.push({ id: fxSeq++, x: from.x, y: from.y, tx: to.x, ty: to.y, delay, duration, until: t0 + delay + duration + 40, ...what });
    };
    const bubble = (player: number, text: string, tone: PlotFx['tone'], at: number, life = 1500) => {
      if (!fx) return;
      newFx.push({ id: fxSeq++, player, text, tone, delay: at, until: t0 + at + life });
    };
    const showToast = (text: string, tone: Toast['tone'], at: number, life = 1700) => {
      if (!fx) return;
      later(() => setToast({ id: fxSeq++, text, tone, until: performance.now() + life }), Math.max(0, at));
    };

    let total = 0;
    let marketAt = 0;
    let afterAction = fly > 0 ? fly + delays.pause : delays.pause;
    const enteredIds = new Set<number>();
    let wilted: number | null = null;
    for (const e of game.events) {
      switch (e.type) {
        case 'harvest': {
          const to = now(`plot-${e.player}-tokens`);
          e.cells.forEach((c, k) => flyer(was(`cell-${c}`), to, { token: e.tokens[k] }, k * step));
          sound(() => gdSound.clink(e.tokens.length), 0);
          bubble(e.player, `🧺 ${tokensText(e.tokens)}`, 'harvest', 0);
          afterAction = (fly > 0 ? fly + e.cells.length * step : 0) + delays.pause;
          total = Math.max(total, afterAction);
          break;
        }
        case 'refill': {
          const at = fly > 0 ? Math.round(fly * 0.7) : 0;
          setRefillDelay(at);
          const map = new Map<number, number>();
          for (const c of e.cells) map.set(c, fxSeq++);
          setDrops({ map, until: t0 + at + 700 });
          if (fx) sound(() => gdSound.refill(), at + 120);
          break;
        }
        case 'plant': {
          const from = was(`card-${e.cardId}`);
          flyer(from, now(`plot-${e.player}-garden`), { cardId: e.cardId }, 0);
          sound(() => gdSound.plant(), 0);
          bubble(e.player, `🌱 ${card(e.cardId).name}${e.saleUsed ? ' (떨이)' : ''}`, 'plant', 0);
          afterAction = (fly > 0 ? fly + 120 : 0) + delays.pause;
          total = Math.max(total, afterAction);
          break;
        }
        case 'reserve': {
          flyer(was(`card-${e.cardId}`), now(`plot-${e.player}-gh`), { cardId: e.cardId }, 0);
          sound(() => gdSound.reserve(), 0);
          bubble(e.player, `🏡 ${card(e.cardId).name} 맡기기`, 'reserve', 0);
          if (e.bee) {
            flyer(now('hive'), now(`plot-${e.player}-tokens`), { token: 'bee' }, step * 2);
            sound(() => gdSound.bee(), step * 2 + 80);
          }
          afterAction = (fly > 0 ? fly + 120 + step * 2 : 0) + delays.pause;
          total = Math.max(total, afterAction);
          break;
        }
        case 'gain': {
          const src = e.reason === 'bee' ? now('hive') : now('bag');
          const to = now(`plot-${e.player}-tokens`);
          let k = 0;
          for (const t of TOKENS) for (let j = 0; j < (e.tokens[t] ?? 0); j++) flyer(src, to, { token: t }, fly + k++ * step);
          sound(() => (e.reason === 'bee' ? gdSound.bee() : gdSound.water()), fly);
          bubble(e.player, e.reason === 'bee' ? '🏠 새집 🐝' : '🚿 물뿌리개 💧💧', 'info', fly);
          total = Math.max(total, fly * 2 + k * step);
          break;
        }
        case 'points': {
          const at = fly > 0 ? fly : 0;
          bubble(e.player, e.reason === 'ribbon' ? `🏵️ +${e.amount}` : e.reason === 'scarecrow' ? `🎃 +${e.amount}` : `🌼 +${e.amount}점`, e.reason === 'ribbon' ? 'ribbon' : 'points', at, 1800);
          if (e.reason !== 'ribbon') sound(() => gdSound.points(e.amount), at + 60);
          break;
        }
        case 'ribbon': {
          const at = (fly > 0 ? fly : 0) + 150;
          if (fx) later(() => setPulse({ goal: e.goal, until: performance.now() + 1600 }), at);
          sound(() => gdSound.ribbon(), at);
          showToast(`🏵️ ${withJosa(playerName(game.players[e.player]), '이/가')} '${GOALS[e.goal].title}' 상장을 받았어요!`, 'ribbon', at, 1900);
          total = Math.max(total, at + (fx ? 1300 : 200));
          break;
        }
        case 'enter':
          enteredIds.add(e.cardId);
          break;
        case 'wilt':
          wilted = e.cardId;
          break;
        case 'discard': {
          const from = now(`plot-${e.player}-tokens`);
          let k = 0;
          for (const t of TOKENS) for (let j = 0; j < (e.tokens[t] ?? 0); j++) flyer(from, now('bag'), { token: t }, k++ * step);
          sound(() => gdSound.discard(), 0);
          bubble(e.player, `↩️ ${tokensText(e.tokens)}`, 'info', 0);
          afterAction = (fly > 0 ? fly + k * step : 0) + delays.pause;
          total = Math.max(total, afterAction);
          break;
        }
        case 'pass':
          bubble(e.player, '😴 쉬어요', 'info', 0);
          total = Math.max(total, delays.pause + 300);
          break;
        case 'endTriggered': {
          const at = afterAction;
          sound(() => gdSound.bell(), at);
          showToast(`🎯 ${withJosa(playerName(game.players[e.player]), '이/가')} ${game.options.target}점에 닿았어요! 이번 라운드까지만 해요.`, 'goal', at, 2200);
          total = Math.max(total, at + (fx ? 1200 : 100));
          break;
        }
        case 'round':
          showToast(`🌅 ${e.round}라운드`, 'round', afterAction + (fly > 0 ? 300 : 0), 1200);
          break;
        case 'gameover':
          sound(() => gdSound.win(), Math.max(total, afterAction) + 100);
          total = Math.max(total, afterAction + (fx ? 900 : 100));
          break;
      }
    }

    // 꽃시장: 행동 연출 뒤에 밀리고(시들고), 새 식물이 들어온다
    if (wilted !== null) {
      marketAt = afterAction;
      const at = marketAt;
      if (fx) setWiltGhost({ cardId: wilted, key: fxSeq++, until: t0 + at + 1100 });
      sound(() => gdSound.wilt(), at);
      total = Math.max(total, at + delays.slide + (fx ? 500 : 0));
    } else if (game.events.some((e) => e.type === 'plant' || e.type === 'reserve')) {
      marketAt = fly > 0 ? Math.round(fly * 0.5) : 0;
    }
    setSlideDelay(marketAt);
    if (enteredIds.size > 0) {
      if (fx) setEntering({ ids: enteredIds, until: t0 + marketAt + delays.slide + 900 });
      sound(() => gdSound.enter(), marketAt + delays.slide);
      total = Math.max(total, marketAt + delays.slide + 200);
    }

    if (newFlyers.length > 0) setFlyers((list) => [...list.filter((x) => x.until > t0), ...newFlyers]);
    if (newFx.length > 0) setPlotFx((list) => [...list.filter((x) => x.until > t0), ...newFx]);

    // 사람 차례가 오면 알림음
    const nextHuman = game.phase !== 'gameover' && game.players[game.current].kind === 'human';
    if (nextHuman && (before.current !== game.current || before.phase !== game.phase)) sound(() => sfx.turn(), total + 50);
    if (total > 0) setAnim({ until: performance.now() + total });
  }, [game, setup, delays, local, later]);

  // 그린 뒤 위치 기억 (다음 연출의 출발점)
  useLayoutEffect(() => {
    const m = new Map<string, DOMRect>();
    els.current.forEach((el, k) => m.set(k, el.getBoundingClientRect()));
    rects.current = m;
  });

  // ------------------------------------------------------------ 컴퓨터 차례
  useEffect(() => {
    if (locked || over || curPlayer.kind === 'human') return;
    const wait = game.phase === 'discard' ? Math.round(delays.think * 0.5) : delays.think;
    const t = window.setTimeout(() => {
      setGame((g) => {
        if (g.phase === 'gameover' || g.current !== cur || g.players[g.current].kind === 'human') return g;
        return applyAction(g, decideAction(g, g.players[g.current].kind as AiLevel));
      });
    }, wait);
    return () => window.clearTimeout(t);
  }, [game, locked, over, cur, curPlayer.kind, delays]);

  // ------------------------------------------------------------ 사람의 행동
  const perform = useCallback(
    (a: GardenAction) =>
      setGame((g) => {
        if (g.phase === 'gameover' || g.players[g.current].kind !== 'human') return g;
        return applyAction(g, a);
      }),
    [],
  );

  const info = useCallback(
    (id: number): CardInfo | null => {
      if (!humanTurn) return null;
      const c = card(id);
      const fromMarket = game.market.includes(id);
      if (!fromMarket && !curPlayer.greenhouse.includes(id)) return null;
      const due = effectiveCost(curPlayer, c);
      let price = RES.reduce((a, r) => a + due[r], 0);
      if (fromMarket && isOnSale(game, id) && price > 0) price -= 1;
      return { canBuy: canPlant(game, cur, id), price };
    },
    [game, humanTurn, curPlayer, cur],
  );

  const affordable = canAct ? [...game.market, ...curPlayer.greenhouse].filter((id) => canPlant(game, cur, id)) : [];
  const zoneItems: { field: LineId[]; market: number[] } = { field: LINES, market: [...game.market, ...curPlayer.greenhouse] };

  const pickCard = (id: number) => {
    if (!canAct) return;
    gdSound.select();
    setSel((s) => (s?.kind === 'card' && s.id === id ? null : { kind: 'card', id }));
    setZone('market');
  };
  const quickPlant = (id: number) => {
    if (!canAct) return;
    if (canPlant(game, cur, id)) perform({ type: 'plant', cardId: id });
    else {
      setSel({ kind: 'card', id });
      gdSound.noMove();
    }
  };
  const harvest = (line: LineId) => {
    if (!canAct || lineTokens(game, line).length === 0) return;
    perform({ type: 'harvest', line });
  };
  const plantSelected = () => {
    if (!canAct || sel?.kind !== 'card') return;
    if (canPlant(game, cur, sel.id)) perform({ type: 'plant', cardId: sel.id });
    else gdSound.noMove();
  };
  const reserveSelected = () => {
    if (!canAct || sel?.kind !== 'card') return;
    if (game.market.includes(sel.id) && curPlayer.greenhouse.length < GREENHOUSE_SIZE) perform({ type: 'reserve', cardId: sel.id });
    else gdSound.noMove();
  };
  const backTotal = tokenTotal(back);
  const addBack = (t: Token, d: number) => {
    if (!discarding) return;
    const n = (back[t] ?? 0) + d;
    if (n < 0 || n > curPlayer.tokens[t] || (d > 0 && backTotal >= need)) return;
    gdSound.select();
    setBack({ ...back, [t]: n });
  };
  const confirmBack = () => {
    if (!discarding || backTotal !== need) return;
    perform({ type: 'discard', tokens: back });
  };

  // 키보드: ↑↓ 텃밭·꽃시장, ←→ 고르기, Enter 하기, R 맡기기, Esc 취소, 1~6 시장 카드. 돌려놓기: 1~5 담기, Backspace 빼기, A 자동, Enter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const onButton = t?.tagName === 'BUTTON' || t?.getAttribute('role') === 'button';
      if (discarding) {
        const k = Number(e.key);
        if (k >= 1 && k <= 5) {
          e.preventDefault();
          addBack(TOKENS[k - 1], 1);
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          const last = [...TOKENS].reverse().find((x) => (back[x] ?? 0) > 0);
          if (last) addBack(last, -1);
        } else if (e.code === 'KeyA') {
          e.preventDefault();
          setBack(autoDiscard(game));
        } else if (e.key === 'Enter' && !onButton) {
          e.preventDefault();
          confirmBack();
        } else if (e.key === 'Escape') setBack({});
        return;
      }
      if (!canAct) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const z: Zone = zone === null ? (e.key === 'ArrowUp' ? 'market' : 'field') : zone === 'field' ? 'market' : 'field';
        setZone(z);
        if (z === 'field') setSel({ kind: 'line', line: LINES.find((l) => lineTokens(game, l).length > 0) ?? 'r0' });
        else if (zoneItems.market.length > 0) setSel({ kind: 'card', id: affordable[0] ?? zoneItems.market[0] });
        gdSound.select();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const d = e.key === 'ArrowLeft' ? -1 : 1;
        const z: Zone = zone ?? 'field';
        setZone(z);
        if (z === 'field') {
          const i = sel?.kind === 'line' ? LINES.indexOf(sel.line) : -1;
          setSel({ kind: 'line', line: LINES[(i + d + LINES.length) % LINES.length] });
        } else {
          const list = zoneItems.market;
          if (list.length === 0) return;
          const i = sel?.kind === 'card' ? list.indexOf(sel.id) : -1;
          setSel({ kind: 'card', id: list[(i + d + list.length) % list.length] });
        }
        gdSound.select();
      } else if (e.key === 'Enter' && !onButton) {
        e.preventDefault();
        if (sel?.kind === 'line') harvest(sel.line);
        else if (sel?.kind === 'card') plantSelected();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        reserveSelected();
      } else if (e.key === 'Escape') {
        setSel(null);
        setZone(null);
      } else if (/^[1-6]$/.test(e.key)) {
        const id = game.market[Number(e.key) - 1 - (6 - game.market.length)];
        if (id !== undefined) {
          e.preventDefault();
          pickCard(id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ------------------------------------------------------------ 안내 문구와 행동 상자
  const name = playerName(curPlayer);
  let hint: string;
  if (over) hint = `${game.winners.map((w) => playerName(game.players[w])).join(', ')} 우승! 박람회가 끝났어요.`;
  else if (locked) hint = game.log.at(-1)?.text ?? '…';
  else if (discarding) hint = `바구니가 넘쳐요! 돌려놓을 토큰 ${need}개를 골라요.`;
  else if (canAct) hint = sel ? '고른 것을 확인하고 버튼을 눌러요.' : '세 가지 중 하나를 해요.';
  else if (game.phase === 'discard') hint = `${withJosa(name, '이/가')} 돌려놓을 토큰을 고르고 있어요…`;
  else hint = `${withJosa(name, '이/가')} 생각하고 있어요…`;

  let action: ReactNode = null;
  if (discarding) {
    action = (
      <div className="gd-act gd-act-discard" data-testid="gd-discard">
        <p className="gd-act-title">
          ↩️ 돌려놓기 <b>{backTotal}</b>/{need}
        </p>
        <div className="gd-back-grid">
          {TOKENS.map((t, k) => (
            <div key={t} className="gd-back-item">
              <TokenIcon token={t} size={26} />
              <span>
                {curPlayer.tokens[t] - (back[t] ?? 0)}
                {(back[t] ?? 0) > 0 && <em> ↩{back[t]}</em>}
              </span>
              <button type="button" className="btn gd-mini-btn" onClick={() => addBack(t, 1)} disabled={curPlayer.tokens[t] - (back[t] ?? 0) <= 0 || backTotal >= need} aria-label={`${RES_LABEL[t]} 하나 돌려놓기 (${k + 1})`} data-testid={`gd-back-${t}`}>
                ↩ <kbd>{k + 1}</kbd>
              </button>
              <button type="button" className="btn gd-mini-btn" onClick={() => addBack(t, -1)} disabled={(back[t] ?? 0) <= 0} aria-label={`${RES_LABEL[t]} 다시 넣기`}>
                되돌리기
              </button>
            </div>
          ))}
        </div>
        <div className="gd-act-buttons">
          <button type="button" className="btn" onClick={() => setBack(autoDiscard(game))}>
            자동으로 고르기 <kbd>A</kbd>
          </button>
          <button type="button" className="btn btn-primary" onClick={confirmBack} disabled={backTotal !== need} data-testid="gd-back-confirm">
            돌려놓기 <kbd>Enter</kbd>
          </button>
        </div>
      </div>
    );
  } else if (canAct && sel?.kind === 'card') {
    const c = card(sel.id);
    const fromMarket = game.market.includes(sel.id);
    const sale = fromMarket && isOnSale(game, sel.id);
    const pay = payment(curPlayer, c, sale);
    const sf = shortfall(curPlayer, c, sale);
    const ghFull = curPlayer.greenhouse.length >= GREENHOUSE_SIZE;
    action = (
      <div className="gd-act gd-act-card" data-testid="gd-card-box">
        <div className="gd-act-cardhead">
          <PlantPicture art={c.art} size={40} />
          <div>
            <strong>{c.name}</strong>
            <small>
              꽃 점수 {c.points} · {RES_EMOJI[c.produce]} 생산{fromMarket ? (sale ? ' · 🏷️ 떨이' : '') : ' · 🏡 내 온실'}
            </small>
          </div>
        </div>
        {pay ? (
          <p className="gd-pay">
            낼 토큰: {tokenTotal(pay.paid) === 0 ? <b>공짜! 🎉</b> : <span className="gd-pay-tokens">{TOKENS.flatMap((t) => Array.from({ length: pay.paid[t] }, (_, j) => <TokenIcon key={`${t}${j}`} token={t} size={20} />))}</span>}
            {pay.saleUsed && <small> (떨이로 {RES_EMOJI[pay.saleUsed]} 1개 덜 내요)</small>}
          </p>
        ) : (
          <p className="gd-pay gd-pay-short">
            모자라요:{' '}
            {RES.filter((r) => sf.missing[r] > 0).map((r) => (
              <span key={r} className="gd-miss">
                <TokenIcon token={r} size={18} />
                {sf.missing[r]}
              </span>
            ))}
            {curPlayer.tokens.bee > 0 && <small> (🐝 {curPlayer.tokens.bee}마리로 메워도 {sf.short}개 모자라요)</small>}
          </p>
        )}
        <div className="gd-act-buttons">
          <button type="button" className="btn btn-primary" onClick={plantSelected} disabled={!pay} data-testid="gd-plant">
            🌱 심기 <kbd>Enter</kbd>
          </button>
          {fromMarket && (
            <button type="button" className="btn" onClick={reserveSelected} disabled={ghFull} title={ghFull ? '온실이 꽉 찼어요 (2칸)' : '온실에 맡기고 꿀벌 1마리 받기'} data-testid="gd-reserve">
              🏡 맡기기 <kbd>R</kbd>
            </button>
          )}
        </div>
        {fromMarket && ghFull && <p className="gd-why">온실이 꽉 찼어요 (2칸). 온실 식물을 심으면 자리가 생겨요.</p>}
        {fromMarket && !ghFull && <p className="gd-why">맡기면 {game.hive > 0 ? `벌통에서 🐝 1마리를 받아요 (남은 꿀벌 ${game.hive})` : '벌통이 비어서 꿀벌은 없어요'}.</p>}
      </div>
    );
  } else if (canAct && sel?.kind === 'line') {
    const toks = lineTokens(game, sel.line);
    action = (
      <div className="gd-act gd-act-line">
        <p className="gd-act-title">
          🧺 {lineLabel(sel.line)}: <span className="gd-pay-tokens">{toks.map((t, i) => <TokenIcon key={i} token={t} size={22} />)}</span>
        </p>
        <div className="gd-act-buttons">
          <button type="button" className="btn btn-primary" onClick={() => harvest(sel.line)} disabled={toks.length === 0} data-testid="gd-harvest">
            거두기 <kbd>Enter</kbd>
          </button>
        </div>
        {tokenTotal(curPlayer.tokens) + toks.length > STORAGE_LIMIT && <p className="gd-why">바구니가 {STORAGE_LIMIT}개를 넘으면 넘친 만큼 돌려놓아야 해요.</p>}
      </div>
    );
  } else if (canAct) {
    action = (
      <ul className="gd-act gd-act-tips">
        <li>
          <b>🧺 거두기</b>
          <span>
            텃밭 줄 끝 <span className="gd-key">▶</span>
            <span className="gd-key">▼</span>를 눌러 토큰 3개 가져오기
          </span>
        </li>
        <li>
          <b>🌱 심기</b>
          <span>{affordable.length > 0 ? `반짝이는 식물 ${affordable.length}장을 지금 심을 수 있어요` : '아직 살 수 있는 식물이 없어요. 먼저 거둬요!'}</span>
        </li>
        <li>
          <b>🏡 맡기기</b>
          <span>
            식물을 눌러 온실에 맡기고 🐝 받기 (온실 {curPlayer.greenhouse.length}/{GREENHOUSE_SIZE} · 벌통 🐝{game.hive})
          </span>
        </li>
        <li className="gd-keys-tip">
          <kbd>↑</kbd>
          <kbd>↓</kbd> 텃밭·시장 <kbd>←</kbd>
          <kbd>→</kbd> 고르기 <kbd>Enter</kbd> 하기
        </li>
      </ul>
    );
  }

  const focusLine = canAct ? (hoverLine ?? (sel?.kind === 'line' ? sel.line : null)) : null;
  const selectedId = canAct && sel?.kind === 'card' ? sel.id : null;
  const thinking = !humanTurn && !locked && !over;
  const n = game.players.length;
  const humans = game.players.map((p, i) => (p.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  const viewer = humanTurn ? cur : humans.length === 1 ? humans[0] : null;

  return (
    <div className="gd-game" style={{ '--gd-slide': `${delays.slide}ms`, '--gd-slide-delay': `${slideDelay}ms`, '--gd-refill-delay': `${refillDelay}ms` } as CSSProperties}>
      <div className="gd-main" ref={mainRef}>
        <Market
          state={game}
          reg={reg}
          active={canAct}
          info={info}
          selected={selectedId}
          entering={entering?.ids ?? NO_IDS}
          wiltGhost={wiltGhost}
          onPick={pickCard}
          onQuick={quickPlant}
        />
        <div className="gd-lower">
          <div className="gd-left">
            <FieldBed
              state={game}
              reg={reg}
              active={canAct}
              focus={focusLine}
              drops={drops?.map ?? NO_DROPS}
              onHover={setHoverLine}
              onHarvest={harvest}
              onSelect={(line) => {
                setSel({ kind: 'line', line });
                setZone('field');
              }}
            />
            <RibbonBoard state={game} viewer={viewer} pulse={pulse?.goal ?? null} />
          </div>
          <div className={`gd-plots gd-plots-${n}`}>
            {game.players.map((_, i) => (
              <Plot
                key={i}
                state={game}
                index={i}
                reg={reg}
                isCurrent={i === cur && !over}
                thinking={thinking && i === cur}
                active={canAct && i === cur}
                info={info}
                selected={selectedId}
                fx={plotFx.filter((f) => f.player === i)}
                onPick={pickCard}
                onQuick={quickPlant}
              />
            ))}
          </div>
        </div>
        <div className="gd-fly-layer" aria-hidden="true">
          {flyers.map((f) => (
            <div
              key={f.id}
              className={`gd-flyer${f.cardId !== undefined ? ' gd-flyer-card' : ''}`}
              style={{ left: f.x, top: f.y, '--dx': `${f.tx - f.x}px`, '--dy': `${f.ty - f.y}px`, animationDuration: `${f.duration}ms`, animationDelay: `${f.delay}ms` } as CSSProperties}
            >
              {f.token && <TokenIcon token={f.token} size={30} />}
              {f.cardId !== undefined && (
                <span className={`gd-fly-card gd-season-${card(f.cardId).season}`}>
                  <PlantPicture art={card(f.cardId).art} size={44} />
                  <b>{card(f.cardId).name}</b>
                </span>
              )}
            </div>
          ))}
        </div>
        {toast && (
          <div key={toast.id} className={`gd-toast gd-toast-${toast.tone}`} role="status">
            {toast.text}
          </div>
        )}
        <p className="gd-sr" aria-live="polite">
          {game.log.at(-1)?.text ?? ''}
        </p>
      </div>

      <Panel
        state={game}
        hint={hint}
        action={action}
        settings={settings}
        onSettings={onSettings}
        onNewGame={() => {
          if (over || window.confirm('지금 게임을 그만두고 새 게임을 할까요?')) onChangeSetup();
        }}
        onExit={onExit}
      />

      {over && !locked && <GameOver state={game} onRestart={onRestart} onChangeSetup={onChangeSetup} onExit={onExit} />}
    </div>
  );
}
