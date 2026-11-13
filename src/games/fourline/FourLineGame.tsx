import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { withJosa } from '../../lib/korean';
import { sfx } from '../../lib/sound';
import { useMusic } from '../../lib/useMusic';
import { useTimers } from '../../lib/useTimers';
import type { DuelAiLevel } from '../common/duel';
import type { GameSettings } from '../common/settings';
import { HARD_TIME_MS, decideAction } from './ai';
import { Board } from './Board';
import { Panel } from './Panel';
import { Results } from './Results';
import { COLS, applyAction, canUndo, landingRow, other, playerName, undo, winningColumns } from './rules';
import { FOURLINE_SONG } from './song';
import { fourLineSfx } from './sounds';
import { FOURLINE_DELAYS, clearSavedFourLineGame, dropTiming, saveFourLineGame } from './storage';
import type { FourLineSetup, FourLineState } from './types';

interface FourLineGameProps {
  setup: FourLineSetup;
  initialState: FourLineState;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

export function FourLineGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: FourLineGameProps) {
  const [game, setGame] = useState<FourLineState>(initialState);
  /** 연출이 끝날 때까지 입력과 컴퓨터를 멈춘다 */
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const gameRef = useRef(game);
  gameRef.current = game;
  const prevGame = useRef<FourLineState | null>(null);
  const later = useTimers();
  const delays = FOURLINE_DELAYS[settings.speed];
  useMusic(FOURLINE_SONG, settings.music);

  const locked = lockUntil !== null;
  const active = game.phase === 'play';
  const current = game.players[game.current];
  const humanCount = game.players.filter((p) => p.kind === 'human').length;
  const humanTurn = active && current.kind === 'human';
  const interactive = humanTurn && !locked;
  const showUndo = game.options.undo && humanCount === 1;
  const undoable = showUndo && canUndo(game);
  const hints = useMemo(
    () =>
      interactive && game.options.hints
        ? { win: winningColumns(game.board, game.current), block: winningColumns(game.board, other(game.current)) }
        : null,
    [interactive, game],
  );

  useEffect(() => {
    if (lockUntil === null) return;
    const t = window.setTimeout(() => setLockUntil(null), Math.max(0, lockUntil - performance.now()));
    return () => window.clearTimeout(t);
  }, [lockUntil]);

  /** 상태가 바뀔 때마다: 저장 + 소리 연출 */
  useEffect(() => {
    if (game.phase === 'gameover') clearSavedFourLineGame();
    else saveFourLineGame(setup, game);

    const before = prevGame.current;
    prevGame.current = game;
    if (before === null || before === game) return;

    const sound = (play: () => void, at: number) => (at <= 0 ? play() : later(play, at));
    let total = 0;
    for (const e of game.events) {
      if (e.type === 'drop') {
        const t = dropTiming(delays.fall, e.row);
        if (delays.fx) fourLineSfx.slide();
        fourLineSfx.thud(t.impact / 1000, e.row);
        total = t.total;
      } else if (e.type === 'win') {
        const humanLost = game.players[e.player].kind !== 'human' && humanCount === 1;
        sound(() => fourLineSfx.line(), total);
        sound(() => (humanLost ? fourLineSfx.lose() : fourLineSfx.win()), total + 450);
        total += delays.win;
      } else if (e.type === 'draw') {
        sound(() => fourLineSfx.draw(), total + 100);
        total += Math.round(delays.win * 0.6);
      } else if (e.type === 'undo') {
        fourLineSfx.undo();
      }
    }
    if (game.phase === 'play' && game.players[game.current].kind === 'human' && before.turn !== game.turn) {
      sound(() => sfx.turn(), total + 30);
    }
    if (total > 0) setLockUntil(performance.now() + total);
  }, [game, setup, delays, later, humanCount]);

  // 컴퓨터 차례
  useEffect(() => {
    if (locked || game.phase !== 'play' || current.kind === 'human') return;
    const hard = current.kind === 'ai-hard';
    const wait = hard ? Math.max(60, delays.think - HARD_TIME_MS) : delays.think;
    const t = window.setTimeout(() => {
      const g = gameRef.current;
      if (g.phase !== 'play' || g.players[g.current].kind === 'human') return;
      const action = decideAction(g, g.players[g.current].kind as DuelAiLevel, Math.random, { timeMs: HARD_TIME_MS });
      setGame((cur) => (cur === g ? applyAction(cur, action) : cur));
    }, wait);
    return () => window.clearTimeout(t);
  }, [game, locked, current.kind, delays.think]);

  const drop = useCallback(
    (col: number) => {
      if (!interactive) return;
      if (landingRow(game.board, col) < 0) {
        sfx.noMove();
        return;
      }
      setGame((g) => applyAction(g, { type: 'drop', col }));
    },
    [interactive, game.board],
  );

  const doUndo = useCallback(() => {
    if (!undoable) return;
    setLockUntil(null);
    setGame((g) => undo(g));
  }, [undoable]);

  const toggleHints = () => setGame((g) => ({ ...g, options: { ...g.options, hints: !g.options.hints }, events: [] }));

  // 키보드: 1~7 바로 떨어뜨리기, ←→ 고르기, Enter·Space·↓ 떨어뜨리기, U 무르기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[1-7]$/.test(e.key)) {
        e.preventDefault();
        const col = Number(e.key) - 1;
        setSelected(col);
        setKeyboard(true);
        drop(col);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        setKeyboard(true);
        setSelected((s) => {
          const next = s === null ? 3 : Math.min(COLS - 1, Math.max(0, s + (e.key === 'ArrowLeft' ? -1 : 1)));
          if (next !== s) fourLineSfx.tick();
          return next;
        });
      } else if ((e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') && target?.tagName !== 'BUTTON') {
        if (selected !== null && interactive) {
          e.preventDefault();
          drop(selected);
        } else if (selected === null && interactive && e.key !== ' ') {
          e.preventDefault();
          setKeyboard(true);
          setSelected(3);
        }
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        toggleHints();
      } else if (e.key === 'u' || e.key === 'U') {
        if (undoable) {
          e.preventDefault();
          doUndo();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const name = playerName(game, game.current);
  let hint: string;
  if (game.phase === 'gameover') hint = '게임이 끝났어요!';
  else if (!humanTurn) hint = `${withJosa(name, '이/가')} 생각 중이에요…`;
  else if (locked) hint = '돌이 떨어지는 중…';
  else if (hints && hints.win.length > 0) hint = '초록 동그라미가 있는 줄에 두면 바로 이겨요!';
  else if (hints && hints.block.length > 0) hint = '주황 동그라미 줄을 막지 않으면 져요!';
  else hint = '줄을 골라 돌을 떨어뜨리세요. (클릭 또는 숫자키 1~7)';
  if (humanTurn && !locked && humanCount === 2) hint = `${name} 차례예요. ${hint}`;

  return (
    <div className="fl-game">
      <div className="fl-board-area">
        <Board
          state={game}
          interactive={interactive}
          selected={selected}
          showCursor={keyboard && interactive}
          hints={hints}
          fall={delays.fx ? delays.fall : 0}
          onDrop={(c) => {
            setKeyboard(false);
            drop(c);
          }}
          onHover={(c) => {
            if (c !== null) {
              setKeyboard(false);
              setSelected(c);
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
        showUndo={showUndo}
        canUndo={undoable}
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
