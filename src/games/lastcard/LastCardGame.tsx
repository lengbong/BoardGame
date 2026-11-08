import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { withJosa } from '../../lib/korean';
import { startMusic, stopMusic } from '../../lib/music';
import { sfx } from '../../lib/sound';
import { useTimers } from '../../lib/useTimers';
import type { Speed } from '../common/speed';
import { decideAction } from './ai';
import { CARD_COLORS, COLOR_INFO } from './cards';
import { HandTray } from './HandTray';
import { Panel } from './Panel';
import { GameOver, RoundOver } from './Results';
import { HAND_SIZE, applyAction, canCall, playableCards, playerName } from './rules';
import { LASTCARD_DELAYS, clearSavedLastCardGame, saveLastCardGame, type LastCardSettings } from './storage';
import { Table, type CenterFx, type Flyer, type SeatFx, type TableRefs } from './Table';
import type { CardColor, LastCardAction, LastCardSetup, LastCardState } from './types';

interface LastCardGameProps {
  setup: LastCardSetup;
  initialState: LastCardState;
  settings: LastCardSettings;
  onSettings: (settings: LastCardSettings) => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

interface View {
  /** 아래 손패 칸에 보여 줄 사람 */
  owner: number | null;
  faceUp: boolean;
  /** 사람이 2명 이상이고 손패를 가리는 모드 */
  coverMode: boolean;
}

/** 지금 누구의 손패를 아래 칸에 보여 줄지 정한다. */
function computeView(state: LastCardState, revealed: number | null): View {
  const humans = state.players.map((p, i) => (p.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  const open = state.options.handView === 'open';
  const coverMode = !open && humans.length >= 2;
  const sole = humans.length === 1 ? humans[0] : null;
  const active = state.phase === 'play' || state.phase === 'drawn';
  const current = state.players[state.current];
  if (!active) return { owner: sole, faceUp: true, coverMode };
  if (current.kind === 'human') return { owner: state.current, faceUp: !coverMode || revealed === state.current, coverMode };
  if (sole !== null) return { owner: sole, faceUp: true, coverMode };
  return { owner: state.current, faceUp: open, coverMode };
}

let fxSeq = 1;
const EMPTY = new Set<number>();

export function LastCardGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: LastCardGameProps) {
  const [game, setGame] = useState<LastCardState>(initialState);
  /** 연출이 끝날 때까지 입력을 막는다. dealing: 카드를 나눠 주는 중 */
  const [anim, setAnim] = useState<{ until: number; dealing: boolean } | null>(null);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [colorPick, setColorPick] = useState<number | null>(null);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [seatFx, setSeatFx] = useState<SeatFx[]>([]);
  const [centerFx, setCenterFx] = useState<CenterFx | null>(null);
  const [playFrom, setPlayFrom] = useState<{ cardId: number; x: number; y: number } | null>(null);
  const [recentIds, setRecentIds] = useState<ReadonlySet<number>>(EMPTY);
  const [shakeId, setShakeId] = useState<number | null>(null);
  const [dealKey, setDealKey] = useState(0);
  const refs = useRef<TableRefs>({ table: null, deck: null, discard: null, tray: null, seats: {} });
  const prevGame = useRef<LastCardState | null>(null);
  const prevCurrent = useRef(initialState.current);
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  const later = useTimers();
  const delays = LASTCARD_DELAYS[settings.speed];

  const locked = anim !== null;
  const dealing = anim?.dealing ?? false;
  const active = game.phase === 'play' || game.phase === 'drawn';
  const current = game.players[game.current];
  const humanCount = game.players.filter((p) => p.kind === 'human').length;
  const view = computeView(game, revealed);
  const humanTurn = active && current.kind === 'human';
  const interactive = humanTurn && view.faceUp && !locked;
  const playableIds = useMemo(
    () => (interactive ? new Set(playableCards(game).map((c) => c.id)) : EMPTY),
    [game, interactive],
  );
  const canDraw = interactive && game.phase === 'play';
  const canPass = interactive && game.phase === 'drawn';
  const canCallNow = interactive && canCall(game);
  const needsReveal = humanTurn && !view.faceUp;

  // 배경음악
  useEffect(() => {
    if (settings.music) startMusic('party');
    else stopMusic();
  }, [settings.music]);
  useEffect(() => () => stopMusic(), []);

  // 연출 시간이 지나면 입력을 다시 받는다. (StrictMode에서도 안전하도록 effect로 관리)
  useEffect(() => {
    if (!anim) return;
    const t = window.setTimeout(() => setAnim(null), Math.max(0, anim.until - performance.now()));
    return () => window.clearTimeout(t);
  }, [anim]);

  // 차례가 다른 사람에게 넘어가면 손패를 다시 가리고, 색 고르기 창을 닫는다.
  useEffect(() => {
    if (game.current !== prevCurrent.current) setRevealed(null);
    prevCurrent.current = game.current;
    setColorPick(null);
  }, [game.turn, game.current]);

  /** 표 안에서 요소의 가운데 좌표 */
  const centerOf = useCallback((el: HTMLElement | null, yRatio = 0.5) => {
    const table = refs.current.table;
    if (!el || !table) return null;
    const t = table.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - t.left, y: r.top + r.height * yRatio - t.top };
  }, []);

  /** 상태가 바뀔 때마다: 저장 + 마지막 행동의 연출 (그리기 전에 위치를 재고 연출을 시작한다) */
  useLayoutEffect(() => {
    if (game.phase === 'gameover') clearSavedLastCardGame();
    else saveLastCardGame(setup, game);

    const before = prevGame.current;
    prevGame.current = game;
    if (before === game) return;
    if (before === null && !game.events.some((e) => e.type === 'deal')) return;

    const r = refs.current;
    const fly = delays.fly;
    const fx = delays.fx;
    const n = game.players.length;
    const beforeView = before ? computeView(before, revealedRef.current) : null;
    const afterView = computeView(game, null);
    const deck = centerOf(r.deck);
    const handPos = (player: number, owner: number | null | undefined) =>
      player === owner && r.tray ? centerOf(r.tray, 0.62) : centerOf(r.seats[player] ?? null);

    const newFlyers: Flyer[] = [];
    const newSeatFx: SeatFx[] = [];
    let cfx: CenterFx | null = null;
    let cursor = 0;
    let total = 0;
    let isDeal = false;
    const seat = (player: number, text: string, tone: SeatFx['tone']) => {
      if (fx) newSeatFx.push({ id: fxSeq++, player, text, tone });
    };
    const sound = (play: () => void, at: number) => (at <= 0 ? play() : later(play, at));

    for (const e of game.events) {
      switch (e.type) {
        case 'deal': {
          isDeal = true;
          setDealKey((k) => k + 1);
          sfx.shuffle();
          const count = HAND_SIZE * n;
          if (fly > 0 && deck) {
            for (let k = 0; k < count; k++) {
              const to = handPos((game.starter + k) % n, afterView.owner);
              if (to) newFlyers.push({ id: fxSeq++, x: deck.x, y: deck.y, tx: to.x - deck.x, ty: to.y - deck.y, delay: k * delays.deal });
            }
          }
          total = Math.max(total, count * delays.deal + fly + 100);
          break;
        }
        case 'play': {
          sfx.cardPlay();
          const from = handPos(e.player, beforeView?.owner);
          const to = centerOf(r.discard);
          setPlayFrom(fly > 0 && from && to ? { cardId: e.card.id, x: from.x - to.x, y: from.y - to.y } : null);
          cursor = fly;
          total = Math.max(total, fly);
          break;
        }
        case 'draw': {
          const shown = Math.min(e.count, 8);
          const gap = Math.max(40, fly * 0.25);
          sound(() => sfx.cardDraw(e.count), cursor);
          if (e.reason !== 'normal') {
            seat(e.player, e.reason === 'forgot' ? `깜빡! +${e.count}` : `+${e.count}`, 'draw');
            if (e.count >= 2) sound(() => sfx.penalty(), cursor + 120);
          }
          const to = handPos(e.player, afterView.owner);
          if (fly > 0 && deck && to) {
            for (let k = 0; k < shown; k++) {
              newFlyers.push({ id: fxSeq++, x: deck.x, y: deck.y, tx: to.x - deck.x, ty: to.y - deck.y, delay: cursor + k * gap });
            }
          }
          cursor += shown * gap;
          total = Math.max(total, cursor + fly);
          break;
        }
        case 'skip':
          seat(e.player, '🚫 쉬어요', 'skip');
          sound(() => sfx.skip(), cursor);
          break;
        case 'reverse':
          cfx = { id: fxSeq++, text: e.direction === 1 ? '↻ 방향 바뀜!' : '↺ 방향 바뀜!' };
          sound(() => sfx.reverse(), cursor);
          break;
        case 'color':
          cfx = { id: fxSeq++, text: `${COLOR_INFO[e.color].name}!`, color: COLOR_INFO[e.color].main };
          sound(() => sfx.wild(), cursor);
          break;
        case 'call':
          seat(e.player, '한 장 남았다!', 'call');
          sound(() => sfx.shout(), Math.max(0, cursor - 100));
          break;
        case 'stack':
          seat(e.player, `+${e.total} 쌓임!`, 'stack');
          sound(() => sfx.penalty(), cursor);
          break;
        case 'pass':
          seat(e.player, '통과', 'pass');
          break;
        case 'reshuffle':
          cfx = { id: fxSeq++, text: '🔀 카드를 다시 섞었어요' };
          sound(() => sfx.shuffle(), cursor);
          break;
        case 'win':
          seat(e.player, '다 냈다!', 'win');
          sound(() => (game.phase === 'gameover' ? sfx.win() : sfx.finish()), cursor + 150);
          total = Math.max(total, cursor + 700);
          break;
      }
    }

    // 아래 칸에 보이는 손패에 새로 들어온 카드 표시
    if (before && before.round === game.round && afterView.owner !== null) {
      const had = new Set(before.players[afterView.owner].hand.map((c) => c.id));
      const added = game.players[afterView.owner].hand.filter((c) => !had.has(c.id)).map((c) => c.id);
      if (added.length > 0) {
        setRecentIds(new Set(added));
        later(() => setRecentIds(EMPTY), 1800 + total);
      }
    }

    // 사람 차례가 오면 알림음
    const nextPlayer = game.players[game.current];
    if ((game.phase === 'play' || game.phase === 'drawn') && nextPlayer.kind === 'human' && (!before || before.turn !== game.turn) && !isDeal) {
      sound(() => sfx.turn(), total + 50);
    }

    setFlyers(newFlyers);
    if (newFlyers.length > 0) later(() => setFlyers([]), total + 200);
    if (fx) {
      setSeatFx(newSeatFx);
      if (newSeatFx.length > 0) later(() => setSeatFx([]), Math.max(1500, total + 900));
      if (cfx) {
        setCenterFx(cfx);
        const id = cfx.id;
        later(() => setCenterFx((c) => (c && c.id === id ? null : c)), 1300);
      }
    }
    if (total > 0) setAnim({ until: performance.now() + total, dealing: isDeal });
  }, [game, setup, delays, centerOf, later]);

  const perform = useCallback((action: LastCardAction) => {
    setGame((g) => applyAction(g, action));
  }, []);

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
      // 가장 최신 상태를 보고 정한다. 그사이 사람 차례가 되었으면 아무것도 하지 않는다.
      setGame((g) => {
        const p = g.players[g.current];
        if (p.kind === 'human' || (g.phase !== 'play' && g.phase !== 'drawn')) return g;
        return applyAction(g, decideAction(g, p.kind));
      });
    }, delays.think);
    return () => window.clearTimeout(t);
  }, [game, locked, humanCount, current.kind, delays.think, perform]);

  const onCard = (cardId: number) => {
    if (!interactive) return;
    const card = game.players[game.current].hand.find((c) => c.id === cardId);
    if (!card) return;
    if (!playableIds.has(cardId)) {
      setShakeId(cardId);
      sfx.noMove();
      later(() => setShakeId((s) => (s === cardId ? null : s)), 450);
      return;
    }
    if (card.color === null) setColorPick(cardId);
    else perform({ type: 'play', cardId });
  };

  const pickColor = (color: CardColor) => {
    if (colorPick === null || !interactive) return;
    perform({ type: 'play', cardId: colorPick, color });
    setColorPick(null);
  };

  // 키보드: Space 뽑기/넘기기, Enter 카드 보기·다음 판, 1~4 색 고르기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if (colorPick !== null) {
        if (/^[1-4]$/.test(e.key)) pickColor(CARD_COLORS[Number(e.key) - 1]);
        else if (e.key === 'Escape') setColorPick(null);
        return;
      }
      if (target?.tagName === 'BUTTON') return;
      if (e.key === 'Enter' && game.phase === 'roundover' && humanCount > 0 && !locked) {
        e.preventDefault();
        perform({ type: 'nextRound' });
      } else if ((e.key === 'Enter' || e.key === ' ') && needsReveal) {
        e.preventDefault();
        setRevealed(game.current);
      } else if (e.key === ' ' && (canPass || canDraw)) {
        e.preventDefault();
        perform({ type: canPass ? 'pass' : 'draw' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // 안내 문구
  let hint: string;
  const name = playerName(current);
  if (game.phase === 'gameover') hint = '게임이 끝났어요!';
  else if (game.phase === 'roundover') hint = '이번 판이 끝났어요.';
  else if (dealing) hint = '카드를 나눠 주는 중…';
  else if (!humanTurn) hint = `${withJosa(name, '이/가')} 생각 중이에요…`;
  else if (needsReveal) hint = `${name} 차례예요. '내 카드 보기'를 누르세요.`;
  else if (game.pendingDraw > 0)
    hint = playableIds.size > 0 ? `+${game.pendingDraw}! 반짝이는 카드로 이어 내거나 ${game.pendingDraw}장을 받으세요.` : `낼 카드가 없어요. ${game.pendingDraw}장을 받으세요.`;
  else if (game.phase === 'drawn') hint = '뽑은 카드를 낼 수 있어요! 내거나 넘기세요.';
  else if (playableIds.size > 0) hint = '반짝이는 카드를 골라 내세요.';
  else hint = '낼 카드가 없어요. 카드를 뽑으세요.';

  const setSpeed = (speed: Speed) => onSettings({ ...settings, speed });
  const dealStep = dealing ? delays.deal : 0;

  return (
    <div className="lc-game">
      <div className="lc-main">
        <Table
          state={game}
          refs={refs}
          openHands={game.options.handView === 'open'}
          canDraw={canDraw}
          onDraw={() => canDraw && perform({ type: 'draw' })}
          flyers={flyers}
          seatFx={seatFx}
          centerFx={centerFx}
          playFrom={playFrom}
          flyMs={delays.fly}
          dealKey={dealKey}
          dealStep={dealStep}
          turnHint={active && !humanTurn && !dealing ? `${name} 차례…` : ''}
        />
        <HandTray
          state={game}
          refs={refs}
          owner={view.owner}
          faceUp={view.faceUp}
          interactive={interactive}
          covered={needsReveal}
          playableIds={playableIds}
          recentIds={recentIds}
          shakeId={shakeId}
          colorPickFor={colorPick}
          canDraw={canDraw}
          canPass={canPass}
          canCallNow={canCallNow}
          dealKey={dealKey}
          dealStep={dealStep}
          hint={hint}
          onReveal={() => setRevealed(game.current)}
          onCard={onCard}
          onDraw={() => perform({ type: 'draw' })}
          onPass={() => perform({ type: 'pass' })}
          onCall={() => perform({ type: 'call' })}
          onPickColor={pickColor}
          onCancelColor={() => setColorPick(null)}
        />
      </div>

      <Panel
        state={game}
        hint={hint}
        speed={settings.speed}
        muted={settings.muted}
        music={settings.music}
        onSpeed={setSpeed}
        onToggleMute={() => onSettings({ ...settings, muted: !settings.muted })}
        onToggleMusic={() => onSettings({ ...settings, music: !settings.music })}
        onNewGame={() => {
          if (game.phase === 'gameover' || window.confirm('지금 게임을 그만두고 새 게임을 할까요?')) onChangeSetup();
        }}
        onExit={onExit}
      />

      {game.phase === 'roundover' && !locked && (
        <RoundOver state={game} canContinue={humanCount > 0} onNext={() => perform({ type: 'nextRound' })} />
      )}
      {game.phase === 'gameover' && !locked && (
        <GameOver state={game} onRestart={onRestart} onChangeSetup={onChangeSetup} onExit={onExit} />
      )}
    </div>
  );
}
