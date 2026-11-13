import { useEffect, useMemo, useRef, useState } from 'react';
import { withJosa } from '../../lib/korean';
import { sfx } from '../../lib/sound';
import { useMusic } from '../../lib/useMusic';
import { useTimers } from '../../lib/useTimers';
import type { GameSettings } from '../common/settings';
import { decideMove } from './ai';
import { Board } from './Board';
import { Panel } from './Panel';
import { Results } from './Results';
import { FORBIDDEN_TEXT, applyAction, canUndo, coordName, forbiddenAt, hintSpots, nearbyEmpty, playerName, undo } from './rules';
import { OMOK_SONG } from './song';
import { okSound } from './sounds';
import { OMOK_DELAYS, clearSavedOmokGame, saveOmokGame } from './storage';
import type { Cell, DuelAiLevel, OmokOptions, OmokSetup, OmokState } from './types';

interface OmokGameProps {
  setup: OmokSetup;
  initialState: OmokState;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

const NONE: ReadonlySet<number> = new Set<number>();

export function OmokGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: OmokGameProps) {
  const [game, setGame] = useState<OmokState>(initialState);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(true);
  const prevGame = useRef<OmokState | null>(null);
  const later = useTimers();
  const delays = OMOK_DELAYS[settings.speed];
  useMusic(OMOK_SONG, settings.music);

  const size = game.size;
  const rule = game.options.rule;
  const locked = lockUntil !== null;
  const active = game.phase === 'play';
  const current = game.players[game.current];
  const humanCount = game.players.filter((p) => p.kind === 'human').length;
  const humanTurn = active && current.kind === 'human';
  const interactive = humanTurn && !locked;
  const showUndo = game.options.undo && humanCount === 1;
  const undoable = showUndo && canUndo(game) && !locked;

  // 지금 차례 사람이 둘 수 없는 금수 자리 (돌 근처만 살펴본다)
  const forbidden = useMemo(() => {
    if (!humanTurn || rule === 'free' || (rule === 'renju' && game.current === 1)) return NONE;
    const b = [...game.board] as Cell[];
    return new Set(nearbyEmpty(b, size, 2).filter((i) => forbiddenAt(b, size, i, game.current, rule)));
  }, [game.board, game.current, humanTurn, rule, size]);

  const hints = useMemo(() => (game.options.hints && humanTurn ? hintSpots([...game.board] as Cell[], size, game.current, rule) : null), [game.board, game.current, game.options.hints, humanTurn, rule, size]);

  // 연출 시간이 지나면 다시 움직인다
  useEffect(() => {
    if (lockUntil === null) return;
    const t = window.setTimeout(() => setLockUntil(null), Math.max(0, lockUntil - performance.now()));
    return () => window.clearTimeout(t);
  }, [lockUntil]);

  /** 상태가 바뀔 때마다: 저장 + 소리 */
  useEffect(() => {
    if (game.phase === 'gameover') clearSavedOmokGame();
    else saveOmokGame(setup, game);
    const before = prevGame.current;
    prevGame.current = game;
    if (!before || before === game) return;

    const sound = (play: () => void, at: number) => (at <= 0 ? play() : later(play, at));
    let total = 0;
    for (const e of game.events) {
      if (e.type === 'place') {
        okSound.place(e.player === 0);
        total = Math.max(total, delays.place);
        setNotice(null);
      } else if (e.type === 'win') {
        const humanLost = game.players[e.player].kind !== 'human' && humanCount === 1;
        sound(() => (humanLost ? okSound.lose() : okSound.win()), delays.place + 100);
        total = Math.max(total, delays.win);
      } else if (e.type === 'draw') {
        sound(() => okSound.draw(), 200);
        total = Math.max(total, 600);
      } else if (e.type === 'undo') {
        okSound.undo();
        setShowResult(true);
      }
    }
    if (game.phase === 'play' && game.players[game.current].kind === 'human' && before.current !== game.current && humanCount > 0) {
      sound(() => sfx.turn(), total + 40);
    }
    if (total > 0) setLockUntil(performance.now() + total);
  }, [game, setup, delays, later, humanCount]);

  // 수 알려 주기를 켰을 때 꼭 막아야 하면 알림음
  useEffect(() => {
    if (hints && hints.win.length === 0 && hints.block.length > 0 && !locked) okSound.warn();
  }, [hints, locked]);

  // 컴퓨터 차례: 생각하는 시간을 둔 뒤 그 순간의 최신 상태를 보고 둔다
  useEffect(() => {
    if (locked || game.phase !== 'play' || current.kind === 'human') return;
    const t = window.setTimeout(() => {
      setGame((g) => {
        const p = g.players[g.current];
        if (g.phase !== 'play' || p.kind === 'human') return g;
        return applyAction(g, { type: 'place', index: decideMove(g, p.kind as DuelAiLevel) });
      });
    }, delays.think);
    return () => window.clearTimeout(t);
  }, [game, locked, current.kind, delays.think]);

  const place = (i: number) => {
    if (!interactive) return;
    if (game.board[i] !== -1) return;
    const f = forbiddenAt([...game.board] as Cell[], size, i, game.current, rule);
    if (f) {
      okSound.forbidden();
      setNotice(`${coordName(i, size)}: ${FORBIDDEN_TEXT[f]}`);
      return;
    }
    setGame((g) => (g.phase === 'play' && g.players[g.current].kind === 'human' ? applyAction(g, { type: 'place', index: i }) : g));
  };

  const setOption = (patch: Partial<OmokOptions>) => setGame((g) => ({ ...g, options: { ...g.options, ...patch }, events: [] }));

  const doUndo = () => {
    if (!undoable) return;
    setGame((g) => undo(g));
  };

  // 키보드: 방향키로 고르고 Enter·Space로 두기, U 무르기, H 수 알려 주기, N 수 번호
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'KeyU') {
        doUndo();
        return;
      }
      if (e.code === 'KeyH') {
        setOption({ hints: !game.options.hints });
        return;
      }
      if (e.code === 'KeyN') {
        setOption({ numbers: !game.options.numbers });
        return;
      }
      if (!interactive) return;
      const center = Math.floor(size / 2) * size + Math.floor(size / 2);
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        setKeyboard(true);
        setCursor((c) => {
          const cur = c ?? game.lastMove ?? center;
          const r = Math.floor(cur / size);
          const col = cur % size;
          if (e.key === 'ArrowLeft') return r * size + Math.max(0, col - 1);
          if (e.key === 'ArrowRight') return r * size + Math.min(size - 1, col + 1);
          if (e.key === 'ArrowUp') return Math.max(0, r - 1) * size + col;
          return Math.min(size - 1, r + 1) * size + col;
        });
      } else if ((e.key === 'Enter' || e.key === ' ') && t?.tagName !== 'BUTTON') {
        e.preventDefault();
        setKeyboard(true);
        if (cursor === null) setCursor(game.lastMove ?? center);
        else place(cursor);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // 안내 문구
  let hint: string;
  if (game.phase === 'gameover') hint = game.winner === null ? '판이 꽉 찼어요. 비겼어요!' : `${withJosa(playerName(game, game.winner), '이/가')} 다섯 줄을 만들었어요!`;
  else if (notice) hint = notice;
  else if (!humanTurn) hint = `${withJosa(playerName(game, game.current), '이/가')} 생각하고 있어요…`;
  else if (hints && hints.win.length > 0) hint = '초록 동그라미에 두면 바로 이겨요!';
  else if (hints && hints.block.length > 0) hint = '주황 동그라미를 꼭 막아야 해요! 상대가 다섯을 만들려고 해요.';
  else if (hints && hints.watch.length > 0) hint = '노란 동그라미를 조심하세요. 상대가 열린 사를 만들 수 있어요.';
  else hint = `${playerName(game, game.current)} 차례예요. 놓을 자리를 누르세요.`;

  return (
    <div className="ok-game">
      <div className="ok-main">
        <Board
          state={game}
          interactive={interactive}
          cursor={cursor}
          keyboard={keyboard}
          side={game.current}
          hints={hints}
          forbidden={forbidden}
          showNumbers={game.options.numbers}
          showWin={game.phase === 'gameover'}
          onHover={(i) => {
            setKeyboard(false);
            setCursor(i);
          }}
          onPlace={place}
        />
        <p className="ok-sr" aria-live="polite">
          {game.log.at(-1)?.text ?? ''}
        </p>
      </div>

      <Panel
        state={game}
        hint={hint}
        notice={!!notice}
        thinking={active && !humanTurn && !locked}
        settings={settings}
        onSettings={onSettings}
        showUndo={showUndo}
        canUndo={undoable}
        onUndo={doUndo}
        onToggleHints={() => setOption({ hints: !game.options.hints })}
        onToggleNumbers={() => setOption({ numbers: !game.options.numbers })}
        onNewGame={() => {
          if (game.phase === 'gameover' || window.confirm('지금 게임을 그만두고 새 게임을 할까요?')) onChangeSetup();
        }}
        onExit={onExit}
        extra={
          game.phase === 'gameover' && !showResult ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowResult(true)}>
              결과 다시 보기
            </button>
          ) : null
        }
      />

      {game.phase === 'gameover' && !locked && showResult && (
        <Results state={game} canUndo={undoable} onUndo={doUndo} onRestart={onRestart} onChangeSetup={onChangeSetup} onExit={onExit} onClose={() => setShowResult(false)} />
      )}
    </div>
  );
}
