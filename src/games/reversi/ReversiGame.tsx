import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { withJosa } from '../../lib/korean';
import { sfx } from '../../lib/sound';
import { useMusic } from '../../lib/useMusic';
import { useTimers } from '../../lib/useTimers';
import type { DuelAiLevel } from '../common/duel';
import type { GameSettings } from '../common/settings';
import { HARD_TIME_MS, decideAction } from './ai';
import { Board, type FlipTiming } from './Board';
import { Panel } from './Panel';
import { Results } from './Results';
import { applyAction, canUndo, distance, flipsFor, legalMoves, other, playerName, undo } from './rules';
import { REVERSI_SONG } from './song';
import { reversiSfx } from './sounds';
import { REVERSI_DELAYS, clearSavedReversiGame, saveReversiGame } from './storage';
import type { ReversiSetup, ReversiState } from './types';
import { soloOutcome, useRecordOutcome } from '../../lib/stats';

interface ReversiGameProps {
  setup: ReversiSetup;
  initialState: ReversiState;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

const EMPTY = new Set<number>();
let bannerSeq = 1;

export function ReversiGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: ReversiGameProps) {
  const [game, setGame] = useState<ReversiState>(initialState);
  /** 연출이 끝날 때까지 입력과 컴퓨터를 멈춘다 */
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ id: number; title: string; sub: string } | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const gameRef = useRef(game);
  gameRef.current = game;
  const prevGame = useRef<ReversiState | null>(null);
  const later = useTimers();
  const delays = REVERSI_DELAYS[settings.speed];
  useMusic(REVERSI_SONG, settings.music);
  useRecordOutcome('reversi', game.phase === 'gameover', () => soloOutcome(game.players.map((p) => p.kind), [game.winner]));

  const locked = lockUntil !== null;
  const active = game.phase === 'play';
  const current = game.players[game.current];
  const humanCount = game.players.filter((p) => p.kind === 'human').length;
  const humanTurn = active && current.kind === 'human';
  const interactive = humanTurn && !locked;
  const legal = useMemo(() => (humanTurn ? new Set(legalMoves(game.board, game.size, game.current)) : EMPTY), [game, humanTurn]);
  const showUndo = game.options.undo && humanCount === 1;
  const undoable = showUndo && canUndo(game);
  const timing: FlipTiming | null = delays.fx ? { place: delays.place, step: delays.step, flip: delays.flip } : null;

  // 연출 시간이 지나면 다시 움직인다
  useEffect(() => {
    if (lockUntil === null) return;
    const t = window.setTimeout(() => setLockUntil(null), Math.max(0, lockUntil - performance.now()));
    return () => window.clearTimeout(t);
  }, [lockUntil]);

  /** 상태가 바뀔 때마다: 저장 + 소리·알림 연출 */
  useEffect(() => {
    if (game.phase === 'gameover') clearSavedReversiGame();
    else saveReversiGame(setup, game);

    const before = prevGame.current;
    prevGame.current = game;
    if (before === null || before === game) return;

    const sound = (play: () => void, at: number) => (at <= 0 ? play() : later(play, at));
    let total = 0;
    for (const e of game.events) {
      if (e.type === 'place') {
        reversiSfx.place();
        if (delays.fx) {
          const ds = e.flips.map((f) => distance(e.index, f, game.size));
          const maxD = Math.max(1, ...ds);
          const times = [...new Set(ds)].sort((a, b) => a - b).map((d) => (delays.place + (d - 1) * delays.step + delays.flip * 0.45) / 1000);
          reversiSfx.flips(times);
          total = delays.place + (maxD - 1) * delays.step + delays.flip;
        } else {
          reversiSfx.flips([0.05]);
        }
      } else if (e.type === 'pass') {
        const id = bannerSeq++;
        const skipped = playerName(game, e.player);
        const again = playerName(game, other(e.player));
        const show = () => {
          if (gameRef.current !== game) return; // 그사이 무르기를 했으면 알리지 않는다
          setBanner({ id, title: `${withJosa(skipped, '은/는')} 둘 곳이 없어서 넘어가요`, sub: `${again} 차례가 한 번 더 와요` });
          reversiSfx.pass();
        };
        if (total <= 0) show();
        else later(show, total);
        later(() => setBanner((b) => (b && b.id === id ? null : b)), total + delays.pass);
        total += delays.pass;
      } else if (e.type === 'end') {
        const humanLost = e.winner !== null && game.players[e.winner].kind !== 'human' && humanCount === 1;
        sound(() => (e.winner === null ? reversiSfx.draw() : humanLost ? reversiSfx.lose() : reversiSfx.win()), total + 150);
        total += 500;
      } else if (e.type === 'undo') {
        reversiSfx.undo();
        setBanner(null);
      }
    }
    const next = game.players[game.current];
    if (game.phase === 'play' && next.kind === 'human' && (before.turn !== game.turn || before.current !== game.current) && humanCount > 0) {
      sound(() => sfx.turn(), total + 40);
    }
    if (total > 0) setLockUntil(performance.now() + total);
  }, [game, setup, delays, later, humanCount]);

  // 컴퓨터 차례: 생각하는 시간을 둔 뒤 그 순간의 최신 상태를 보고 둔다
  useEffect(() => {
    if (locked || game.phase !== 'play' || current.kind === 'human') return;
    const level = current.kind as DuelAiLevel;
    const hard = level === 'ai-hard';
    // 어려움은 탐색 자체에 시간이 걸리므로 그만큼 덜 기다린다
    const wait = hard ? Math.max(60, delays.think - HARD_TIME_MS) : delays.think;
    const t = window.setTimeout(() => {
      const g = gameRef.current;
      if (g.phase !== 'play' || g.players[g.current].kind === 'human') return;
      const action = decideAction(g, g.players[g.current].kind as DuelAiLevel, Math.random, { timeMs: HARD_TIME_MS });
      setGame((cur) => (cur === g ? applyAction(cur, action) : cur));
    }, wait);
    return () => window.clearTimeout(t);
  }, [game, locked, current.kind, delays.think]);

  const place = useCallback(
    (index: number) => {
      if (!interactive) return;
      if (!legal.has(index)) {
        if (game.board[index] === -1) sfx.noMove();
        return;
      }
      setGame((g) => applyAction(g, { type: 'place', index }));
    },
    [interactive, legal, game.board],
  );

  const doUndo = useCallback(() => {
    if (!undoable) return;
    setLockUntil(null);
    setGame((g) => undo(g));
  }, [undoable]);

  const toggleHints = () => setGame((g) => ({ ...g, options: { ...g.options, hints: !g.options.hints }, events: [] }));

  // 키보드: 방향키로 칸 고르기, Enter·Space로 두기, U 무르기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = game.size;
      const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        toggleHints();
      } else if (e.key === 'u' || e.key === 'U') {
        if (undoable) {
          e.preventDefault();
          doUndo();
        }
      } else if (moves[e.key] && active) {
        e.preventDefault();
        setKeyboard(true);
        setFocus((f) => {
          if (f === null) {
            const first = humanTurn ? legalMoves(game.board, n, game.current)[0] : undefined;
            return first ?? (n / 2 - 1) * n + (n / 2 - 1);
          }
          const [dr, dc] = moves[e.key];
          const r = Math.min(n - 1, Math.max(0, Math.floor(f / n) + dr));
          const c = Math.min(n - 1, Math.max(0, (f % n) + dc));
          return r * n + c;
        });
      } else if ((e.key === 'Enter' || e.key === ' ') && target?.tagName !== 'BUTTON') {
        if (focus !== null && keyboard && active) {
          e.preventDefault();
          place(focus);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const target = keyboard ? focus : hover;
  const preview = useMemo(() => {
    if (!interactive || !game.options.hints || target === null || !legal.has(target)) return EMPTY;
    return new Set(flipsFor(game.board, game.size, target, game.current));
  }, [interactive, game, target, legal]);

  // 안내 문구
  const name = playerName(game, game.current);
  let hint: string;
  if (game.phase === 'gameover') hint = '게임이 끝났어요!';
  else if (banner) hint = `${banner.title}. ${banner.sub}.`;
  else if (!humanTurn) hint = `${withJosa(name, '이/가')} 생각 중이에요…`;
  else if (locked) hint = '돌이 뒤집히는 중…';
  else if (game.options.hints) hint = `점이 찍힌 ${legal.size}곳 중에 골라 두세요. 마우스를 올리면 뒤집힐 돌이 반짝여요.`;
  else hint = `상대 돌을 끼울 수 있는 곳에 두세요. (둘 수 있는 곳 ${legal.size}군데)`;
  if (humanTurn && !locked && !banner && humanCount === 2) hint = `${name} 차례예요. ${hint}`;

  return (
    <div className="rv-game">
      <div className="rv-board-area">
        <Board
          state={game}
          interactive={interactive}
          legal={legal}
          showHints={game.options.hints}
          focus={target}
          showCursor={keyboard && interactive}
          preview={preview}
          timing={timing}
          banner={banner}
          onPlace={(i) => {
            setKeyboard(false);
            place(i);
          }}
          onHover={(i) => {
            setHover(i);
            if (i !== null) {
              setKeyboard(false);
              setFocus(i);
            }
          }}
        />
      </div>

      <Panel
        state={game}
        hint={hint}
        thinking={active && !humanTurn && !locked}
        settings={settings}
        onSettings={onSettings}
        canUndo={undoable}
        showUndo={showUndo}
        onUndo={doUndo}
        onToggleHints={toggleHints}
        onNewGame={() => {
          if (game.phase === 'gameover' || window.confirm('지금 게임을 그만두고 새 게임을 할까요?')) onChangeSetup();
        }}
        onExit={onExit}
      />

      {game.phase === 'gameover' && !locked && (
        <Results state={game} canUndo={undoable} onUndo={doUndo} onRestart={onRestart} onChangeSetup={onChangeSetup} onExit={onExit} />
      )}
    </div>
  );
}
