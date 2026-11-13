import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ShapeIcon } from '../../components/shapes';
import { withJosa } from '../../lib/korean';
import { useMusic } from '../../lib/useMusic';
import { sfx } from '../../lib/sound';
import { useTimers } from '../../lib/useTimers';
import { SEAT_COLORS } from '../common/players';
import type { GameSettings } from '../common/settings';
import { decideAction } from './ai';
import { PENS } from './art';
import { Board } from './Board';
import { ARROW_KEYS, centerLine, lineLabel, moveCursor } from './cursor';
import { Panel } from './Panel';
import { Results } from './Results';
import { applyAction, captureLines, givesCount, playerName, safeLines, winners } from './rules';
import { boxesSong } from './song';
import { boxesSfx } from './sounds';
import { BOXES_DELAYS, clearSavedBoxesGame, saveBoxesGame } from './storage';
import type { BoxesSetup, BoxesState } from './types';

interface BoxesGameProps {
  setup: BoxesSetup;
  initialState: BoxesState;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

interface Toast {
  id: number;
  text: string;
  color: string;
}

let toastSeq = 1;

export function BoxesGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: BoxesGameProps) {
  const [game, setGame] = useState<BoxesState>(initialState);
  const [cursor, setCursor] = useState<number>(() => {
    const last = initialState.history[initialState.history.length - 1];
    return last ?? centerLine(initialState.size);
  });
  /** 키보드로 고르는 중인지 (커서 테두리를 보여 준다) */
  const [kbd, setKbd] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [showResult, setShowResult] = useState(initialState.phase === 'gameover');
  const prevGame = useRef<BoxesState | null>(null);
  const later = useTimers();
  const delays = BOXES_DELAYS[settings.speed];
  useMusic(boxesSong, settings.music);

  const active = game.phase === 'play';
  const current = game.players[game.current];
  const humanTurn = active && current.kind === 'human';

  // 상태가 바뀔 때마다: 저장 + 마지막 행동의 소리·연출
  useEffect(() => {
    if (game.phase === 'gameover') clearSavedBoxesGame();
    else saveBoxesGame(setup, game);

    const before = prevGame.current;
    prevGame.current = game;
    if (before === null || before === game) return;
    const draw = delays.draw;
    for (const e of game.events) {
      switch (e.type) {
        case 'line':
          boxesSfx.pencil();
          // 상자를 완성하지 않고 세 번째 변을 그었으면 "앗" 소리
          if (!game.events.some((x) => x.type === 'box') && givesCount(before, e.edge) > 0) boxesSfx.oops();
          break;
        case 'box':
          later(() => boxesSfx.box(e.boxes.length), draw * 0.85);
          break;
        case 'again': {
          later(() => boxesSfx.again(), draw * 0.85);
          if (delays.fx) {
            const p = game.players[e.player];
            const t: Toast = { id: toastSeq++, text: `${playerName(p)} 한 번 더!`, color: SEAT_COLORS[p.seat].main };
            setToast(t);
            later(() => setToast((x) => (x && x.id === t.id ? null : x)), 1200);
          }
          break;
        }
        case 'turn':
          if (game.players[e.player].kind === 'human') later(() => sfx.turn(), draw + 120);
          break;
        case 'end': {
          setToast(null);
          const solo = winners(game).length === 1;
          later(() => (solo ? sfx.win() : sfx.finish()), draw + 250);
          later(() => setShowResult(true), draw + (delays.fx ? 1100 : 300));
          break;
        }
      }
    }
  }, [game, setup, delays, later]);

  // 컴퓨터 차례: 생각하는 시간 뒤에 그 순간의 최신 상태를 보고 둔다. 상자를 이어 먹을 때는 조금 빠르게.
  useEffect(() => {
    if (game.phase !== 'play' || current.kind === 'human') return;
    const chained = game.events.some((e) => e.type === 'again');
    const wait = Math.max(chained ? delays.chain : delays.think, delays.draw + 60);
    const t = window.setTimeout(() => {
      setGame((g) => {
        const p = g.players[g.current];
        if (g.phase !== 'play' || p.kind === 'human') return g;
        return applyAction(g, decideAction(g, p.kind));
      });
    }, wait);
    return () => window.clearTimeout(t);
  }, [game, current.kind, delays]);

  const drawLine = useCallback(
    (edge: number) => {
      if (!humanTurn) return;
      if (game.lines[edge] !== -1) {
        sfx.noMove();
        return;
      }
      setCursor(edge);
      setGame((g) => (g.phase === 'play' && g.players[g.current].kind === 'human' ? applyAction(g, { type: 'line', edge }) : g));
    },
    [humanTurn, game.lines],
  );

  // 키보드: 화살표로 선 고르기, Enter·Space로 긋기
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if (ev.altKey || ev.ctrlKey || ev.metaKey || !humanTurn || showResult) return;
      const dir = ARROW_KEYS[ev.key];
      if (dir) {
        ev.preventDefault();
        if (kbd) setCursor((c) => moveCursor(game.size, c, dir));
        setKbd(true);
        return;
      }
      if (ev.key === 'Enter' || ev.key === ' ') {
        if (target && ['BUTTON', 'SUMMARY', 'A'].includes(target.tagName)) return;
        ev.preventDefault();
        if (!kbd) setKbd(true);
        else drawLine(cursor);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [humanTurn, showResult, kbd, cursor, game.size, drawLine]);

  // 안내 문구
  const name = playerName(current);
  let hint: ReactNode;
  if (game.phase === 'gameover') {
    hint = '게임이 끝났어요! 상자를 가장 많이 모은 사람이 이겼어요.';
  } else if (!humanTurn) {
    hint = `${withJosa(name, '이/가')} 생각 중이에요…`;
  } else {
    const again = game.events.some((e) => e.type === 'again');
    const caps = captureLines(game).length;
    let text: string;
    if (caps > 0) text = again ? '한 번 더! 또 완성할 수 있는 상자가 있어요.' : '네 번째 선을 그으면 상자를 가져갈 수 있어요!';
    else if (again) text = '상자를 완성했어요! 한 번 더 그어요.';
    else if (safeLines(game).length > 0) text = '이웃한 두 점 사이를 눌러 선을 그어요. 상자의 세 번째 선은 조심!';
    else text = '이제 어디에 그어도 상자를 내줘요. 가장 적게 내주는 곳을 골라요.';
    hint = (
      <>
        {text}
        <span className="bx-keys">
          <kbd>←↑↓→</kbd> 선 고르기 · <kbd>Enter</kbd> 긋기
        </span>
      </>
    );
  }

  const color = SEAT_COLORS[current.seat];
  const showCursor = humanTurn && kbd;

  return (
    <div className="bx-game">
      <div className="bx-main">
        <div className="bx-stage">
          <Board
            state={game}
            interactive={humanTurn}
            onLine={(e) => {
              setKbd(false);
              drawLine(e);
            }}
            cursor={showCursor ? cursor : null}
            drawMs={delays.draw}
            fx={delays.fx}
            warnings={game.options.warnings}
            label={`${game.size}×${game.size} 점과 상자 판${showCursor ? `, 고른 선: ${lineLabel(game.size, cursor)}${game.lines[cursor] !== -1 ? ' (이미 그음)' : ''}` : ''}`}
          />
          {active && (
            <div className="bx-turn-chip" style={{ '--pc': color.main } as CSSProperties} aria-hidden="true">
              <ShapeIcon shape={PENS[current.seat].shape} color={color.main} size={14} />
              {name} 차례{current.kind !== 'human' ? '…' : ''}
            </div>
          )}
          {toast && (
            <div key={toast.id} className="bx-toast" style={{ '--pc': toast.color } as CSSProperties} role="status">
              {toast.text}
            </div>
          )}
          {showCursor && (
            <p className="bx-sr-only" aria-live="polite">
              {lineLabel(game.size, cursor)}
              {game.lines[cursor] !== -1 ? ', 이미 그은 선' : ''}
            </p>
          )}
        </div>
      </div>

      <Panel
        state={game}
        hint={
          game.phase === 'gameover' && !showResult ? (
            <>
              {hint}{' '}
              <button type="button" className="btn btn-small" onClick={() => setShowResult(true)}>
                결과 보기
              </button>
            </>
          ) : (
            hint
          )
        }
        settings={settings}
        onSettings={onSettings}
        onNewGame={() => {
          if (game.phase === 'gameover' || window.confirm('지금 게임을 그만두고 새 게임을 할까요?')) onChangeSetup();
        }}
        onExit={onExit}
      />

      {game.phase === 'gameover' && showResult && (
        <Results state={game} onRestart={onRestart} onChangeSetup={onChangeSetup} onExit={onExit} onClose={() => setShowResult(false)} />
      )}
    </div>
  );
}
