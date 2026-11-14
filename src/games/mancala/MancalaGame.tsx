import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { withJosa } from '../../lib/korean';
import { sfx } from '../../lib/sound';
import { useMusic } from '../../lib/useMusic';
import { useTimers } from '../../lib/useTimers';
import { DUEL_KIND_LABEL, type DuelAiLevel } from '../common/duel';
import type { GameSettings } from '../common/settings';
import { decideAction } from './ai';
import { buildTimeline, type Callout, type Flyer, type Frame, type Hand, type SoundCue } from './animation';
import { Board } from './Board';
import { cellCenter, listsFromBoard, listsMatch } from './layout';
import { Panel } from './Panel';
import { Results } from './Results';
import { applyAction, legalMoves, ownerOf, pitNumber, pitOf, previewMove, sideName, storeOf } from './rules';
import { SideIcon } from './SideIcon';
import { SIDE_INFO } from './sides';
import { MANCALA_SONG } from './song';
import { mcSfx } from './sounds';
import { MANCALA_DELAYS, clearSavedMancalaGame, loadMancalaSetup, saveMancalaGame, saveMancalaSetup } from './storage';
import type { MancalaAction, MancalaSetup, MancalaState, MoveResult, Side } from './types';
import { soloOutcome, useRecordOutcome } from '../../lib/stats';

interface MancalaGameProps {
  setup: MancalaSetup;
  initialState: MancalaState;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onRestart: (setup: MancalaSetup) => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function humanSides(state: MancalaState): Side[] {
  return ([0, 1] as Side[]).filter((s) => state.players[s].kind === 'human');
}

function playCue(cue: SoundCue): void {
  switch (cue.type) {
    case 'pickup':
      mcSfx.pickup(cue.count);
      break;
    case 'drop':
      mcSfx.drop(cue.n, cue.store);
      break;
    case 'capture':
      mcSfx.capture(cue.count);
      break;
    case 'extra':
      mcSfx.extra();
      break;
    case 'sweep':
      mcSfx.sweep();
      break;
  }
}

/** 도움말 문구: 고른 구멍에서 마지막 씨앗이 어디에 떨어지는지 */
function previewText(state: MancalaState, pit: number, r: MoveResult): string {
  const n = state.board[pit];
  if (r.gameOver) return `${pitNumber(pit)}번 구멍(${n}개)을 뿌리면 한쪽 구멍이 모두 비어서 게임이 끝나요.`;
  if (r.extra) return `${pitNumber(pit)}번 구멍(${n}개) → 마지막 씨앗이 내 창고에 들어가요. 한 번 더!`;
  if (r.capture) return `${pitNumber(pit)}번 구멍(${n}개) → 빈 구멍에서 끝나서 건너편 씨앗까지 ${r.capture.count}개를 가져와요!`;
  const owner = ownerOf(r.last);
  const where = owner === state.current ? `내 ${pitNumber(r.last)}번 구멍` : `${sideName(state, owner)}의 ${pitNumber(r.last)}번 구멍`;
  return `${pitNumber(pit)}번 구멍(${n}개) → 마지막 씨앗은 ${where}에 떨어져요.`;
}

interface PlateProps {
  state: MancalaState;
  side: Side;
  store: number;
  turn: boolean;
  position: 'top' | 'bottom';
}

/** 판 위·아래의 이름표: 누구 쪽 줄인지, 창고에 몇 개인지 */
function Plate({ state, side, store, turn, position }: PlateProps) {
  const info = SIDE_INFO[side];
  return (
    <div className={`mc-plate mc-plate-${position}${turn ? ' is-turn' : ''}`} style={{ '--pc': info.main, '--pl': info.light } as CSSProperties} data-testid={`mc-plate-${side}`}>
      <span className="mc-plate-icon">
        <SideIcon side={side} size={26} />
      </span>
      <strong className="mc-plate-name">{sideName(state, side)}</strong>
      <span className="mc-plate-kind">{DUEL_KIND_LABEL[state.players[side].kind]}</span>
      {turn && <span className="mc-plate-turn">차례</span>}
      <span className="mc-plate-store">
        창고 <b>{store}</b>
      </span>
    </div>
  );
}

export function MancalaGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: MancalaGameProps) {
  const [game, setGame] = useState<MancalaState>(initialState);
  const gameRef = useRef(game);
  const [lists, setLists] = useState<number[][]>(() => listsFromBoard(initialState.board));
  const listsRef = useRef(lists);
  listsRef.current = lists;
  const [hand, setHand] = useState<Hand | null>(null);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [callout, setCallout] = useState<Callout | null>(null);
  const [busy, setBusyState] = useState(false);
  const busyRef = useRef(false);
  const [hover, setHover] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hints, setHints] = useState(setup.hints);
  /** 무르기: 사람이 두기 직전의 상태와 그때 씨앗 목록 (씨앗 색이 그대로 돌아오게) */
  const [undoStack, setUndoStack] = useState<{ state: MancalaState; lists: number[][] }[]>([]);
  const restoreLists = useRef<number[][] | null>(null);
  const [showResult, setShowResult] = useState(false);
  const prevGame = useRef<MancalaState | null>(null);
  const gen = useRef(0);
  const later = useTimers();
  const delays = MANCALA_DELAYS[settings.speed];
  const reduced = useMemo(prefersReducedMotion, []);

  useMusic(MANCALA_SONG, settings.music);
  useRecordOutcome('mancala', game.phase === 'gameover', () => soloOutcome(game.players.map((p) => p.kind), [game.result?.winner]));

  const humans = humanSides(game);
  const bottom: Side = humans.length === 1 ? humans[0] : 0;
  const top: Side = bottom === 0 ? 1 : 0;
  const active = game.phase === 'play';
  const current = game.players[game.current];
  const humanTurn = active && current.kind === 'human';
  const interactive = humanTurn && !busy;
  const playable = useMemo<ReadonlySet<number>>(() => new Set(interactive ? legalMoves(game) : []), [game, interactive]);
  const undoEnabled = game.options.undo && humans.length === 1;
  const canUndo = undoEnabled && !busy && undoStack.length > 0;
  const names: [string, string] = [sideName(game, 0), sideName(game, 1)];
  const shownCounts = lists.map((l) => l.length);

  const setBusy = useCallback((v: boolean) => {
    busyRef.current = v;
    setBusyState(v);
  }, []);

  /** 상태가 바뀔 때마다: 저장 + 마지막 수의 연출 (씨앗 한 알씩 옮기기, 가져오기, 한 번 더, 끝 정리) */
  useLayoutEffect(() => {
    if (game.phase === 'gameover') clearSavedMancalaGame();
    else saveMancalaGame(setup, game);

    const before = prevGame.current;
    prevGame.current = game;
    if (before === game) return;
    gen.current += 1;
    const myGen = gen.current;

    const sequential = before !== null && game.turn === before.turn + 1 && game.events.length > 0;
    if (!sequential) {
      // 처음·이어하기·무르기: 연출 없이 판을 맞춘다.
      const keep = restoreLists.current;
      restoreLists.current = null;
      setLists(keep && listsMatch(keep, game.board) ? keep : listsFromBoard(game.board));
      setHand(null);
      setFlyers([]);
      setCallout(null);
      setBusy(false);
      return;
    }

    const finish = () => {
      setBusy(false);
      if (game.phase === 'gameover') {
        if (game.result?.winner === null) mcSfx.draw();
        else mcSfx.win();
        return;
      }
      const next = game.players[game.current];
      if (next.kind === 'human' && game.lastMove?.side !== game.current) sfx.turn();
    };
    const showCallout = (c: Callout) => {
      setCallout(c);
      later(() => setCallout((cur) => (cur && cur.key === c.key ? null : cur)), 1300);
    };

    const tl = buildTimeline(listsRef.current, game.events, { step: delays.step, fly: delays.fly, pause: delays.pause });
    const finalLists = listsMatch(tl.final, game.board) ? tl.final : listsFromBoard(game.board);

    if (delays.step === 0 || reduced) {
      // 아주 빠르게(또는 움직임 줄이기): 한 번에 옮기고 소리만 짧게
      setLists(finalLists);
      setHand(null);
      setFlyers([]);
      const cues = tl.frames.map((f) => f.sound).filter((c): c is SoundCue => !!c);
      const special = cues.find((c) => c.type === 'capture' || c.type === 'extra' || c.type === 'sweep');
      playCue(special ?? { type: 'drop', n: 0, store: false });
      if (delays.fx) {
        const last = [...tl.frames].reverse().find((f) => f.callout)?.callout;
        if (last) showCallout(last);
      }
      finish();
      return;
    }

    setBusy(true);
    const applyFrame = (f: Frame) => {
      if (f.lists) setLists(f.lists);
      if (f.hand !== undefined) setHand(f.hand);
      if (f.flyers) setFlyers(f.flyers);
      if (f.callout && delays.fx) showCallout(f.callout);
      if (f.sound) playCue(f.sound);
    };
    for (const f of tl.frames) {
      if (f.at <= 0) applyFrame(f);
      else later(() => gen.current === myGen && applyFrame(f), f.at);
    }
    later(() => {
      if (gen.current !== myGen) return;
      setLists(finalLists);
      setHand(null);
      setFlyers([]);
      finish();
    }, tl.total + 40);
  }, [game, setup, delays, reduced, later, setBusy]);

  /** 수를 둔다. 연출 중이거나 둘 수 없는 수면 false */
  const perform = useCallback(
    (action: MancalaAction, byHuman: boolean) => {
      const g = gameRef.current;
      if (busyRef.current || g.phase !== 'play') return false;
      const next = applyAction(g, action);
      if (next === g) return false;
      if (byHuman && g.options.undo && humanSides(g).length === 1) {
        const saved = { state: g, lists: listsRef.current };
        setUndoStack((st) => [...st.slice(-80), saved]);
      }
      busyRef.current = true;
      gameRef.current = next;
      setGame(next);
      return true;
    },
    [],
  );

  // 컴퓨터 차례: 생각하는 시간을 둔 뒤 그 순간의 최신 상태를 보고 둔다.
  useEffect(() => {
    if (busy || game.phase !== 'play') return;
    const p = game.players[game.current];
    if (p.kind === 'human') return;
    const chained = game.lastMove?.extra && game.lastMove.side === game.current;
    const t = window.setTimeout(
      () => {
        const g = gameRef.current;
        if (g !== game || busyRef.current) return;
        perform(decideAction(g, p.kind as DuelAiLevel), false);
      },
      chained ? delays.think * 0.6 : delays.think,
    );
    return () => window.clearTimeout(t);
  }, [game, busy, delays.think, perform]);

  // 차례가 바뀌면 키보드 선택을 지운다.
  useEffect(() => {
    setCursor(null);
  }, [game.turn]);

  // 끝나면 잠깐 판을 보여 준 뒤 결과 화면
  useEffect(() => {
    if (game.phase !== 'gameover' || busy) {
      setShowResult(false);
      return;
    }
    const t = window.setTimeout(() => setShowResult(true), delays.step === 0 ? 350 : 1000);
    return () => window.clearTimeout(t);
  }, [game.phase, busy, delays.step]);

  const onPit = (pit: number) => {
    if (!interactive) return;
    if (!playable.has(pit)) {
      sfx.noMove();
      return;
    }
    setCursor(null);
    perform({ type: 'sow', pit }, true);
  };

  const undo = () => {
    if (!undoEnabled || busyRef.current || undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(undoStack.slice(0, -1));
    restoreLists.current = prev.lists;
    gameRef.current = prev.state;
    setGame(prev.state);
    setShowResult(false);
    setCursor(null);
    mcSfx.pickup(4);
  };

  const toggleHints = () => {
    const v = !hints;
    setHints(v);
    saveMancalaSetup({ ...loadMancalaSetup(), hints: v });
  };

  // 키보드: 1~6 구멍 고르기, ←→ 고르기 + Enter, U 무르기, H 도움말
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'u' || e.key === 'U') {
        undo();
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        toggleHints();
        return;
      }
      if (!interactive) return;
      if (/^[1-6]$/.test(e.key)) {
        e.preventDefault();
        onPit(pitOf(game.current, Number(e.key) - 1));
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const order = [...playable].sort((a, b) => cellCenter(a, bottom).x - cellCenter(b, bottom).x);
        if (order.length === 0) return;
        const idx = cursor !== null ? order.indexOf(cursor) : -1;
        const dir = e.key === 'ArrowLeft' ? -1 : 1;
        const next = idx < 0 ? (dir < 0 ? order[order.length - 1] : order[0]) : order[(idx + dir + order.length) % order.length];
        setCursor(next);
        const el = document.querySelector<SVGGElement>(`[data-pit="${next}"]`);
        el?.focus({ preventScroll: true });
        return;
      }
      if ((e.key === 'Enter' || e.key === ' ') && target?.tagName !== 'BUTTON') {
        if (cursor !== null && playable.has(cursor)) {
          e.preventDefault();
          onPit(cursor);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const focusPit = hover !== null && playable.has(hover) ? hover : cursor !== null && playable.has(cursor) ? cursor : null;
  const preview = useMemo(() => (focusPit !== null ? previewMove(game, focusPit) : null), [game, focusPit]);

  // 안내 문구
  const name = sideName(game, game.current);
  const mover = game.lastMove?.side ?? game.current;
  let hint: ReactNode;
  if (game.phase === 'gameover') hint = busy ? '남은 씨앗을 정리하는 중…' : '게임이 끝났어요!';
  else if (busy) hint = `${withJosa(sideName(game, mover), '이/가')} 씨앗을 뿌리는 중…`;
  else if (!humanTurn) hint = `${withJosa(name, '이/가')} 생각 중이에요…`;
  else {
    const extra = game.lastMove?.extra && game.lastMove.side === game.current;
    hint = (
      <>
        <span>
          {extra ? '한 번 더! ' : ''}반짝이는 내 구멍을 골라 씨앗을 뿌려요.
        </span>
        <span className="mc-hint-keys">
          클릭 · <kbd>1</kbd>~<kbd>6</kbd> · <kbd>←</kbd>
          <kbd>→</kbd> + <kbd>Enter</kbd>
        </span>
        {hints && preview && focusPit !== null && <span className="mc-hint-preview">💡 {previewText(game, focusPit, preview)}</span>}
      </>
    );
  }

  const turnSide: Side | null = busy && game.lastMove ? game.lastMove.side : active ? game.current : null;
  const stores: [number, number] = [shownCounts[storeOf(0)], shownCounts[storeOf(1)]];

  return (
    <div className="mc-game">
      <div className="mc-main">
        <Plate state={game} side={top} store={stores[top]} turn={turnSide === top} position="top" />
        <div className="mc-board-wrap">
          <Board
            lists={lists}
            bottom={bottom}
            current={active ? game.current : null}
            playable={playable}
            focus={focusPit}
            preview={hints ? preview : null}
            lastMove={game.lastMove}
            hand={hand}
            flyers={flyers}
            callout={callout}
            keySide={interactive ? game.current : null}
            names={names}
            onPit={onPit}
            onHover={setHover}
            onFocusPit={setCursor}
          />
        </div>
        <Plate state={game} side={bottom} store={stores[bottom]} turn={turnSide === bottom} position="bottom" />
      </div>

      <Panel
        state={game}
        shownCounts={shownCounts}
        animating={busy}
        hint={hint}
        settings={settings}
        onSettings={onSettings}
        hints={hints}
        onToggleHints={toggleHints}
        showUndo={undoEnabled}
        canUndo={canUndo}
        onUndo={undo}
        onNewGame={() => {
          if (game.phase === 'gameover' || window.confirm('지금 게임을 그만두고 새 게임을 할까요?')) onChangeSetup();
        }}
        onExit={onExit}
      />

      {showResult && game.phase === 'gameover' && game.result && (
        <Results
          state={game}
          canUndo={canUndo}
          onUndo={undo}
          onRestart={() => onRestart({ ...setup, hints })}
          onChangeSetup={onChangeSetup}
          onExit={onExit}
        />
      )}
    </div>
  );
}

