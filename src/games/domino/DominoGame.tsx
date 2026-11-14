import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { PassScreen } from '../../components/PassScreen';
import { withJosa } from '../../lib/korean';
import { sfx } from '../../lib/sound';
import { useMusic } from '../../lib/useMusic';
import { useTimers } from '../../lib/useTimers';
import { SEAT_COLORS } from '../common/players';
import type { GameSettings } from '../common/settings';
import { decideAction } from './ai';
import { DominoBack } from './DominoArt';
import { sortHand } from './dominoes';
import { DominoTable, tileKey, type PlayFrom, type TableFx } from './DominoTable';
import { HandTray } from './HandTray';
import { Panel } from './Panel';
import { GameOver, RoundOver } from './Results';
import { applyAction, balancedSide, canDraw, canPass, handSizeFor, lineEnds, needsSideChoice, playableTiles, playerName } from './rules';
import { SeatStrip, type SeatFx } from './SeatStrip';
import { DOMINO_SONG } from './song';
import { dominoSfx } from './sounds';
import { DOMINO_DELAYS, clearSavedDominoGame, saveDominoGame } from './storage';
import type { DominoAction, DominoSetup, DominoState, Side } from './types';
import { soloOutcome, useRecordOutcome } from '../../lib/stats';

interface DominoGameProps {
  setup: DominoSetup;
  initialState: DominoState;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
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
function computeView(state: DominoState, revealed: number | null): View {
  const humans = state.players.map((p, i) => (p.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  const open = state.options.handView === 'open';
  const coverMode = !open && humans.length >= 2;
  const sole = humans.length === 1 ? humans[0] : null;
  const current = state.players[state.current];
  if (state.phase !== 'play') return { owner: sole, faceUp: true, coverMode };
  if (current.kind === 'human') return { owner: state.current, faceUp: !coverMode || revealed === state.current, coverMode };
  if (sole !== null) return { owner: sole, faceUp: true, coverMode };
  return { owner: state.current, faceUp: open, coverMode };
}

/** 뽑는 더미에서 손패로 날아가는 패 뒷면 */
interface Flyer {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  delay: number;
}

let fxSeq = 1;
const EMPTY = new Set<number>();
const isDrawKey = (e: KeyboardEvent) => e.code === 'KeyD' || e.key === 'd' || e.key === 'D' || e.key === 'ㅇ';

export function DominoGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: DominoGameProps) {
  const [game, setGame] = useState<DominoState>(initialState);
  /** 연출이 끝날 때까지 입력을 막는다. dealing: 패를 나눠 주는 중 */
  const [anim, setAnim] = useState<{ until: number; dealing: boolean } | null>(null);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [activeSide, setActiveSide] = useState<Side>('left');
  const [cursorId, setCursorId] = useState<number | null>(null);
  const [cursorActive, setCursorActive] = useState(false);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [autoDraw, setAutoDraw] = useState(false);
  const [playFrom, setPlayFrom] = useState<PlayFrom | null>(null);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [seatFx, setSeatFx] = useState<SeatFx[]>([]);
  const [tableFx, setTableFx] = useState<TableFx | null>(null);
  const [recentIds, setRecentIds] = useState<ReadonlySet<number>>(EMPTY);
  const [shakeId, setShakeId] = useState<number | null>(null);
  const [dealKey, setDealKey] = useState(0);

  const mainRef = useRef<HTMLDivElement | null>(null);
  const feltRef = useRef<HTMLDivElement | null>(null);
  const boneyardRef = useRef<HTMLElement | null>(null);
  const trayRef = useRef<HTMLElement | null>(null);
  const seatRefs = useRef<Record<number, HTMLElement | null>>({});
  const handEls = useRef(new Map<number, HTMLElement>());
  /** 사람이 패를 낼 때 그 패가 있던 화면 위치 (날아가는 연출의 시작점) */
  const lastPlayRect = useRef<{ tileId: number; x: number; y: number } | null>(null);
  const prevGame = useRef<DominoState | null>(null);
  const prevCurrent = useRef(initialState.current);
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  const later = useTimers();
  const delays = DOMINO_DELAYS[settings.speed];

  useMusic(DOMINO_SONG, settings.music);
  useRecordOutcome('domino', game.phase === 'gameover', () => soloOutcome(game.players.map((p) => p.kind), [game.rankings[0]]));

  const locked = anim !== null;
  const dealing = anim?.dealing ?? false;
  const active = game.phase === 'play';
  const current = game.players[game.current];
  const humanCount = game.players.filter((p) => p.kind === 'human').length;
  const view = computeView(game, revealed);
  const humanTurn = active && current.kind === 'human';
  const interactive = humanTurn && view.faceUp && !locked;
  const needsReveal = humanTurn && !view.faceUp;
  const pipColors = game.options.pipColors;

  const hand = useMemo(() => (view.owner !== null && view.faceUp ? sortHand(game.players[view.owner].hand) : []), [game, view.owner, view.faceUp]);
  const playableIds = useMemo(() => (interactive ? new Set(playableTiles(game).map((t) => t.id)) : EMPTY), [game, interactive]);
  const canDrawNow = interactive && canDraw(game);
  const canPassNow = interactive && canPass(game);
  const pendingTile = interactive && pendingId !== null ? (hand.find((t) => t.id === pendingId) ?? null) : null;
  const findPlayable = (id: number | null) => (id === null ? undefined : hand.find((t) => t.id === id && playableIds.has(t.id)));
  const previewTile = interactive ? (pendingTile ?? findPlayable(hoverId) ?? (cursorActive ? findPlayable(cursorId) : undefined) ?? null) : null;

  // 연출 시간이 지나면 입력을 다시 받는다. (StrictMode에서도 안전하도록 effect로 관리)
  useEffect(() => {
    if (!anim) return;
    const t = window.setTimeout(() => setAnim(null), Math.max(0, anim.until - performance.now()));
    return () => window.clearTimeout(t);
  }, [anim]);

  // 차례가 바뀌면 손패를 다시 가리고, 끝 고르기·연달아 뽑기를 멈춘다.
  useEffect(() => {
    if (game.current !== prevCurrent.current) setRevealed(null);
    prevCurrent.current = game.current;
    setPendingId(null);
    setAutoDraw(false);
  }, [game.turn, game.current]);

  // 내 차례가 되면 키보드 커서를 낼 수 있는 첫 패에 둔다.
  useEffect(() => {
    if (!interactive) return;
    setCursorId((cur) => {
      if (cur !== null && playableIds.has(cur)) return cur;
      const first = hand.find((t) => playableIds.has(t.id)) ?? hand[0];
      return first ? first.id : null;
    });
  }, [interactive, game.turn, hand, playableIds]);

  /** 상태가 바뀔 때마다: 저장 + 마지막 행동의 연출 (그리기 전에 위치를 재고 연출을 시작한다) */
  useLayoutEffect(() => {
    if (game.phase === 'gameover') clearSavedDominoGame();
    else saveDominoGame(setup, game);

    const before = prevGame.current;
    prevGame.current = game;
    // 보기 설정만 바뀐 경우(점 색깔)에는 연출을 다시 하지 않는다.
    if (before === game || (before !== null && before.events === game.events)) return;
    if (before === null && !game.events.some((e) => e.type === 'deal')) return;

    const fly = delays.fly;
    const fx = delays.fx;
    const n = game.players.length;
    const beforeView = before ? computeView(before, revealedRef.current) : null;
    const afterView = computeView(game, null);
    const mainBox = mainRef.current?.getBoundingClientRect() ?? null;
    const feltBox = feltRef.current?.getBoundingClientRect() ?? null;
    const centerIn = (el: HTMLElement | null | undefined, box: DOMRect | null) => {
      if (!el || !box) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
    };
    const seatPos = (i: number, box: DOMRect | null) => centerIn(seatRefs.current[i], box);
    const handPos = (i: number, owner: number | null | undefined, box: DOMRect | null) => (i === owner && trayRef.current ? centerIn(trayRef.current, box) : seatPos(i, box));

    const newFlyers: Flyer[] = [];
    const newSeatFx: SeatFx[] = [];
    let tfx: TableFx | null = null;
    let cursor = 0;
    let total = 0;
    let isDeal = false;
    let newPlay: PlayFrom | null = null;
    const seat = (player: number, text: string, tone: SeatFx['tone']) => {
      if (fx) newSeatFx.push({ id: fxSeq++, player, text, tone });
    };
    const sound = (play: () => void, at: number) => (at <= 0 ? play() : later(play, at));

    for (const e of game.events) {
      switch (e.type) {
        case 'deal': {
          isDeal = true;
          setDealKey((k) => k + 1);
          dominoSfx.wash();
          if (fly > 0) cursor = handSizeFor(n) * n * delays.deal + 250;
          total = Math.max(total, cursor);
          break;
        }
        case 'play': {
          const rect = lastPlayRect.current;
          let from: { x: number; y: number } | null = null;
          if (rect && rect.tileId === e.tile.id && feltBox) from = { x: rect.x - feltBox.left, y: rect.y - feltBox.top };
          else from = e.auto ? seatPos(e.player, feltBox) : handPos(e.player, beforeView?.owner, feltBox);
          lastPlayRect.current = null;
          if (fly > 0 && from) newPlay = { key: tileKey(game.round, e.tile.id), x: from.x, y: from.y, delay: cursor };
          sound(() => dominoSfx.clack(), cursor + fly * 0.9);
          cursor += fly;
          total = Math.max(total, cursor + (fly > 0 ? 80 : 0));
          break;
        }
        case 'draw': {
          sound(() => dominoSfx.draw(), cursor);
          const from = centerIn(boneyardRef.current, mainBox);
          const to = handPos(e.player, afterView.owner, mainBox);
          if (fly > 0 && from && to) newFlyers.push({ id: fxSeq++, x: from.x, y: from.y, tx: to.x - from.x, ty: to.y - from.y, delay: cursor });
          if (e.player !== afterView.owner || !afterView.faceUp) seat(e.player, `뽑기 ${game.turnDraws}`, 'draw');
          if (e.player === afterView.owner) setCursorId(e.tileId);
          total = Math.max(total, cursor + fly);
          break;
        }
        case 'pass':
          seat(e.player, '통과 (똑똑)', 'pass');
          sound(() => dominoSfx.pass(), cursor);
          total = Math.max(total, cursor + (fx ? 550 : 0));
          break;
        case 'blocked':
          tfx = { id: fxSeq++, text: '🚧 막혔어요! 아무도 낼 수 없어요', tone: 'blocked' };
          sound(() => dominoSfx.blocked(), cursor + 120);
          total = Math.max(total, cursor + (fx ? 1900 : 300));
          break;
        case 'win': {
          const w = e.player;
          if (w !== null) {
            seat(w, e.reason === 'domino' ? '다 냈다! 🎉' : '이겼다!', 'win');
            if (e.reason === 'domino' && !tfx) tfx = { id: fxSeq++, text: `${withJosa(playerName(game.players[w]), '이/가')} 패를 다 냈어요!`, tone: 'win' };
          }
          sound(() => (w === null ? sfx.noMove() : game.phase === 'gameover' ? sfx.win() : dominoSfx.roundWin()), cursor + 250);
          total = Math.max(total, cursor + (fx ? 1100 : 250));
          break;
        }
      }
    }

    setPlayFrom(newPlay);

    // 아래 칸에 보이는 손패에 새로 들어온 패 표시
    if (before && before.round === game.round && afterView.owner !== null) {
      const had = new Set(before.players[afterView.owner].hand.map((t) => t.id));
      const added = game.players[afterView.owner].hand.filter((t) => !had.has(t.id)).map((t) => t.id);
      if (added.length > 0) {
        setRecentIds((prev) => new Set([...prev, ...added]));
        later(() => setRecentIds(EMPTY), 1800 + total);
      }
    }

    // 사람 차례가 오면 알림음
    const nextPlayer = game.players[game.current];
    if (game.phase === 'play' && nextPlayer.kind === 'human' && (!before || before.turn !== game.turn)) sound(() => sfx.turn(), total + 60);

    setFlyers(newFlyers);
    if (newFlyers.length > 0) later(() => setFlyers([]), total + 300);
    if (fx) {
      setSeatFx(newSeatFx);
      if (newSeatFx.length > 0) later(() => setSeatFx([]), Math.max(1500, total + 900));
      if (tfx) {
        setTableFx(tfx);
        const id = tfx.id;
        later(() => setTableFx((c) => (c && c.id === id ? null : c)), 1900);
      }
    }
    if (total > 0) setAnim({ until: performance.now() + total, dealing: isDeal });
  }, [game, setup, delays, later]);

  const perform = useCallback((action: DominoAction) => {
    setGame((g) => applyAction(g, action));
  }, []);

  // 컴퓨터 차례 (그리고 컴퓨터끼리 할 때 다음 판 시작)
  useEffect(() => {
    if (locked || game.phase === 'gameover') return;
    if (game.phase === 'roundover') {
      if (humanCount > 0) return;
      const t = window.setTimeout(() => perform({ type: 'nextRound' }), 2800);
      return () => window.clearTimeout(t);
    }
    if (current.kind === 'human') return;
    const wait = game.turnDraws > 0 ? delays.drawGap : delays.think;
    const t = window.setTimeout(() => {
      // 가장 최신 상태를 보고 정한다. 그사이 사람 차례가 되었으면 아무것도 하지 않는다.
      setGame((g) => {
        const p = g.players[g.current];
        if (p.kind === 'human' || g.phase !== 'play') return g;
        return applyAction(g, decideAction(g, p.kind));
      });
    }, wait);
    return () => window.clearTimeout(t);
  }, [game, locked, humanCount, current.kind, delays.think, delays.drawGap, perform]);

  // 사람: 뽑기를 한 번 누르면 낼 패가 나올 때까지 이어서 뽑는다.
  useEffect(() => {
    if (!autoDraw || !humanTurn || locked) return;
    if (!canDraw(game)) {
      setAutoDraw(false);
      return;
    }
    const t = window.setTimeout(() => perform({ type: 'draw' }), Math.max(60, delays.drawGap * 0.6));
    return () => window.clearTimeout(t);
  }, [autoDraw, humanTurn, locked, game, delays.drawGap, perform]);

  const playTile = (tileId: number, side?: Side) => {
    const el = handEls.current.get(tileId);
    if (el) {
      const r = el.getBoundingClientRect();
      lastPlayRect.current = { tileId, x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    setPendingId(null);
    setHoverId(null);
    perform({ type: 'play', tileId, side });
  };

  const shake = (tileId: number) => {
    setShakeId(tileId);
    sfx.noMove();
    later(() => setShakeId((s) => (s === tileId ? null : s)), 450);
  };

  const onTile = (tileId: number) => {
    if (!interactive) return;
    setCursorId(tileId);
    const tile = hand.find((t) => t.id === tileId);
    if (!tile) return;
    if (!playableIds.has(tileId)) {
      shake(tileId);
      return;
    }
    if (pendingId === tileId) {
      setPendingId(null);
      return;
    }
    if (needsSideChoice(game, tile)) {
      setPendingId(tileId);
      setActiveSide(balancedSide(game));
      dominoSfx.select();
      return;
    }
    playTile(tileId);
  };

  const onSlot = (side: Side) => {
    if (!interactive || !previewTile) return;
    playTile(previewTile.id, side);
  };

  const onDraw = () => {
    if (!canDrawNow) return;
    setAutoDraw(true);
    perform({ type: 'draw' });
  };

  const onPass = () => {
    if (canPassNow) perform({ type: 'pass' });
  };

  // 키보드: ←/→·숫자 패 고르기, Enter 놓기, D 뽑기, Space 통과, Esc 취소, Enter 다음 판
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if (e.altKey || e.ctrlKey || e.metaKey || needsReveal) return;
      const onButton = target?.tagName === 'BUTTON';
      // Space는 이 게임의 단축키라서, 컴퓨터 차례에 눌러도 페이지가 스크롤되지 않게 한다.
      if (e.key === ' ' && !onButton) e.preventDefault();
      if (game.phase === 'roundover') {
        if (e.key === 'Enter' && humanCount > 0 && !locked && !onButton) {
          e.preventDefault();
          perform({ type: 'nextRound' });
        }
        return;
      }
      if (!interactive) return;
      // 키보드로 패를 고르기 시작하면, 마우스로 눌렀던 손패 버튼의 포커스는 놓는다 (Enter가 커서를 따르도록).
      const focused = document.activeElement as HTMLElement | null;
      if (focused?.classList.contains('dm-hand-tile') && (e.key.startsWith('Arrow') || /^[1-9]$/.test(e.key))) focused.blur();
      if (/^[1-9]$/.test(e.key)) {
        const t = hand[Number(e.key) - 1];
        if (t) {
          setPendingId(null);
          setCursorId(t.id);
          setCursorActive(true);
        }
        return;
      }
      if (pendingTile) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          setActiveSide(e.key === 'ArrowLeft' ? 'left' : 'right');
          dominoSfx.select();
        } else if (e.key === 'Enter' && !onButton) {
          e.preventDefault();
          playTile(pendingTile.id, activeSide);
        } else if (e.key === 'Escape') {
          setPendingId(null);
        }
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (hand.length === 0) return;
        const idx = Math.max(0, hand.findIndex((t) => t.id === cursorId));
        const next = (idx + (e.key === 'ArrowLeft' ? -1 : 1) + hand.length) % hand.length;
        setCursorId(hand[next].id);
        setCursorActive(true);
      } else if (e.key === 'Enter' && !onButton) {
        e.preventDefault();
        setCursorActive(true);
        if (cursorId !== null) onTile(cursorId);
      } else if (isDrawKey(e)) {
        if (canDrawNow) {
          e.preventDefault();
          onDraw();
        }
      } else if (e.key === ' ' && !onButton) {
        e.preventDefault();
        if (canPassNow) onPass();
        else if (canDrawNow) onDraw();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // 안내 문구
  let hint: string;
  const name = playerName(current);
  const ends = lineEnds(game);
  if (game.phase === 'gameover') hint = '게임이 끝났어요!';
  else if (game.phase === 'roundover') hint = '이번 판이 끝났어요.';
  else if (dealing) hint = '패를 섞어서 나눠 주는 중…';
  else if (!humanTurn) hint = `${withJosa(name, '이/가')} 생각 중이에요…`;
  else if (needsReveal) hint = `${name} 차례예요. '내 패 보기'를 누르세요.`;
  else if (locked) hint = `${name} 차례예요.`;
  else if (pendingTile) hint = `두 끝에 다 맞아요! 어느 끝에 놓을까요? 반짝이는 자리를 누르거나 ←/→ 다음 Enter.`;
  else if (!ends) hint = '아무 패나 골라 첫 패를 놓으세요.';
  else if (playableIds.size > 0) hint = `끝 숫자 ${ends.left}·${ends.right}에 맞는 반짝이는 패를 골라 놓으세요.`;
  else if (canDrawNow) hint = `${ends.left}·${ends.right}에 맞는 패가 없어요. 뽑는 더미에서 뽑으세요.`;
  else if (canPassNow) hint = game.options.blockRule ? '낼 패가 없어요. 블록 규칙이라 통과해요.' : '낼 패가 없고 더미도 비었어요. 통과하세요.';
  else hint = '잠깐만요…';

  const dealStep = dealing ? delays.deal : 0;
  const showFaces = game.options.handView === 'open' || game.phase !== 'play';
  const lastLog = game.log[game.log.length - 1]?.text;

  return (
    <div className="dm-game">
      <div className="dm-main" ref={mainRef}>
        <SeatStrip
          state={game}
          showFaces={showFaces}
          owner={view.owner}
          pipColors={pipColors}
          seatRefs={seatRefs}
          boneyardRef={boneyardRef}
          canDraw={canDrawNow}
          onDraw={onDraw}
          seatFx={seatFx}
          dealKey={dealKey}
          dealStep={dealStep}
        />
        <DominoTable
          state={game}
          pipColors={pipColors}
          feltRef={feltRef}
          interactive={interactive}
          preview={previewTile}
          choosing={pendingTile !== null}
          activeSide={pendingTile ? activeSide : null}
          onSlot={onSlot}
          playFrom={playFrom}
          flyMs={delays.fly}
          fx={tableFx}
          turnHint={active && !humanTurn && !dealing ? `${name} 차례…` : ''}
        />
        <HandTray
          state={game}
          owner={view.owner}
          faceUp={view.faceUp}
          interactive={interactive}
          pipColors={pipColors}
          playableIds={playableIds}
          cursorId={cursorId}
          showCursor={cursorActive}
          pendingId={pendingTile ? pendingTile.id : null}
          activeSide={activeSide}
          recentIds={recentIds}
          shakeId={shakeId}
          dealKey={dealKey}
          dealStep={dealStep}
          hint={hint}
          canDraw={canDrawNow}
          canPass={canPassNow}
          handEls={handEls}
          trayRef={trayRef}
          onTile={(id) => {
            setCursorActive(false);
            onTile(id);
          }}
          onHover={setHoverId}
          onDraw={onDraw}
          onPass={onPass}
          onSide={(side) => pendingTile && playTile(pendingTile.id, side)}
          onCancel={() => setPendingId(null)}
        />
        {flyers.map((f) => (
          <span
            key={f.id}
            className="dm-flyer"
            style={{ left: f.x, top: f.y, '--tx': `${f.tx}px`, '--ty': `${f.ty}px`, animationDelay: `${f.delay}ms`, animationDuration: `${delays.fly}ms` } as CSSProperties}
          >
            <DominoBack />
          </span>
        ))}
        {needsReveal && !locked && (
          <PassScreen name={name} color={SEAT_COLORS[current.seat].main} what="내 패" note={lastLog} onReveal={() => setRevealed(game.current)} />
        )}
      </div>

      <Panel
        state={game}
        hint={hint}
        settings={settings}
        onSettings={onSettings}
        pipColors={pipColors}
        onTogglePipColors={() => setGame((g) => ({ ...g, options: { ...g.options, pipColors: !g.options.pipColors } }))}
        onNewGame={() => {
          if (game.phase === 'gameover' || window.confirm('지금 게임을 그만두고 새 게임을 할까요?')) onChangeSetup();
        }}
        onExit={onExit}
      />

      {game.phase === 'roundover' && !locked && (
        <RoundOver state={game} pipColors={pipColors} canContinue={humanCount > 0} onNext={() => perform({ type: 'nextRound' })} />
      )}
      {game.phase === 'gameover' && !locked && (
        <GameOver state={game} pipColors={pipColors} onRestart={onRestart} onChangeSetup={onChangeSetup} onExit={onExit} />
      )}
    </div>
  );
}
