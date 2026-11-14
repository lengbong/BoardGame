import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../../lib/sound';
import { useTimers } from '../../lib/useTimers';
import { chooseMove } from './ai';
import { SEAT_COLORS } from './board';
import { Board, type PieceOverride } from './Board';
import { Panel } from './Panel';
import { advanceTurn, applyMove, applyRoll, legalMoves, rollDieValue } from './rules';
import { SPEED_DELAYS, clearSavedGame, saveGame, type Settings, type Speed } from './storage';
import type { GameSetup, GameState, Move } from './types';
import { soloOutcome, useRecordOutcome } from '../../lib/stats';

interface RaceGameProps {
  setup: GameSetup;
  initialState: GameState;
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

interface Animation {
  before: GameState;
  after: GameState;
  move: Move;
  path: number[];
  step: number;
}

const MEDALS = ['🥇', '🥈', '🥉', '4등'];

export function RaceGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: RaceGameProps) {
  const [game, setGame] = useState<GameState>(initialState);
  useRecordOutcome('race', game.phase === 'gameover', () => soloOutcome(game.players.map((p) => p.kind), [game.rankings[0]]));
  const [anim, setAnim] = useState<Animation | null>(null);
  const [rollingFace, setRollingFace] = useState<number | null>(null);
  const busy = useRef(false);
  const later = useTimers();
  const delays = SPEED_DELAYS[settings.speed];
  const turbo = settings.speed === 'turbo';

  const shown = anim ? anim.before : game;
  const current = game.players[game.current];
  const isHumanTurn = current.kind === 'human' && game.phase !== 'gameover';
  const idle = !anim && rollingFace === null;
  const canRoll = idle && isHumanTurn && game.phase === 'rolling';

  const movable = useMemo(() => {
    const map = new Map<number, Move>();
    if (idle && isHumanTurn && game.phase === 'choosing') {
      for (const m of legalMoves(game)) map.set(m.pieceIndex, m);
    }
    return map;
  }, [game, idle, isHumanTurn]);

  // 진행 상황 저장 (새로고침해도 이어하기)
  useEffect(() => {
    if (game.phase === 'gameover') {
      clearSavedGame();
    } else {
      saveGame(setup, game);
    }
  }, [game, setup]);

  // 상태 변화에 따른 효과음
  useEffect(() => {
    if (game.phase === 'gameover') sfx.win();
    else if (game.phase === 'passing') sfx.noMove();
  }, [game.phase, game.nextLogId]);

  const roll = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    sfx.roll();
    const value = rollDieValue();
    const flips = Math.max(1, Math.round(delays.dice / 70));
    for (let i = 0; i < flips; i++) {
      later(() => setRollingFace(1 + Math.floor(Math.random() * 6)), i * 70);
    }
    later(() => {
      setRollingFace(null);
      setGame((g) => applyRoll(g, value));
      busy.current = false;
    }, delays.dice);
  }, [delays.dice, later]);

  const move = useCallback(
    (m: Move) => {
      if (busy.current) return;
      const after = applyMove(game, m);
      if (after === game) return;
      busy.current = true;
      const path = m.enters ? [0] : Array.from({ length: after.lastMove!.to - m.from }, (_, i) => m.from + 1 + i);
      setAnim({ before: game, after, move: after.lastMove!, path, step: 0 });
    },
    [game],
  );

  // 말 이동 애니메이션: 한 칸씩 옮긴다.
  useEffect(() => {
    if (!anim) return;
    if (anim.step === 0 && anim.move.enters) sfx.enter();
    else if (!turbo) sfx.step();
  }, [anim, turbo]);

  useEffect(() => {
    if (!anim) return;
    const t = window.setTimeout(() => {
      if (anim.step < anim.path.length - 1) {
        setAnim({ ...anim, step: anim.step + 1 });
        return;
      }
      if (anim.move.captures.length > 0) sfx.capture();
      else if (anim.move.finishes) sfx.finish();
      setGame(anim.after);
      setAnim(null);
      busy.current = false;
    }, delays.step);
    return () => window.clearTimeout(t);
  }, [anim, delays.step]);

  // 컴퓨터 차례와 "움직일 말 없음" 자동 진행
  useEffect(() => {
    if (!idle || game.phase === 'gameover') return;
    if (game.phase === 'passing') {
      const t = window.setTimeout(() => setGame((g) => advanceTurn(g)), delays.pass);
      return () => window.clearTimeout(t);
    }
    if (current.kind === 'human') return;
    const level = current.kind;
    const t = window.setTimeout(() => {
      if (game.phase === 'rolling') roll();
      else if (game.phase === 'choosing') move(chooseMove(game, legalMoves(game), level));
    }, delays.think);
    return () => window.clearTimeout(t);
  }, [game, idle, current.kind, delays.pass, delays.think, roll, move]);

  // 키보드: Space/Enter 주사위, 1~4 말 선택
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return;
      if ((e.key === ' ' || e.key === 'Enter') && canRoll) {
        e.preventDefault();
        roll();
      } else if (/^[1-4]$/.test(e.key)) {
        const m = movable.get(Number(e.key) - 1);
        if (m) move(m);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canRoll, movable, roll, move]);

  const override: PieceOverride | null = anim
    ? { playerIndex: anim.move.playerIndex, pieceIndex: anim.move.pieceIndex, progress: anim.path[anim.step] }
    : null;

  let hint: string;
  if (game.phase === 'gameover') hint = '게임이 끝났어요!';
  else if (rollingFace !== null) hint = '데구루루…';
  else if (anim) hint = '말이 움직이는 중…';
  else if (game.phase === 'passing') hint = game.log[game.log.length - 1]?.text ?? '';
  else if (!isHumanTurn) hint = '컴퓨터가 생각 중이에요…';
  else if (game.phase === 'rolling') hint = '주사위를 굴리세요. (Space 키)';
  else hint = '반짝이는 말을 클릭하세요. (숫자키 1~4)';

  const setSpeed = (speed: Speed) => onSettings({ ...settings, speed });

  return (
    <div className="race-game">
      <div className="board-wrap">
        <Board state={shown} movable={movable} onMove={move} override={override} />
      </div>
      <Panel
        state={game}
        diceFace={rollingFace ?? game.dice}
        diceRolling={rollingFace !== null}
        canRoll={canRoll}
        hint={hint}
        speed={settings.speed}
        muted={settings.muted}
        onRoll={roll}
        onSpeed={setSpeed}
        onToggleMute={() => onSettings({ ...settings, muted: !settings.muted })}
        onNewGame={() => {
          if (game.phase === 'gameover' || window.confirm('지금 게임을 그만두고 새 게임을 할까요?')) onChangeSetup();
        }}
        onExit={onExit}
      />

      {game.phase === 'gameover' && !anim && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="result-title">
          <div className="result-card" data-testid="result">
            <h2 id="result-title">🏆 게임 끝!</h2>
            <ol className="result-list">
              {game.rankings.map((pi, rank) => {
                const p = game.players[pi];
                return (
                  <li key={pi}>
                    <span className="medal">{MEDALS[rank]}</span>
                    <span className="dot" style={{ background: SEAT_COLORS[p.seat].main }} />
                    <strong>{p.name}</strong>
                    {p.kind !== 'human' && <span className="tag">컴퓨터</span>}
                  </li>
                );
              })}
            </ol>
            <div className="result-actions">
              <button type="button" className="btn btn-primary" onClick={onRestart}>
                같은 설정으로 다시 하기
              </button>
              <button type="button" className="btn" onClick={onChangeSetup}>
                설정 바꾸기
              </button>
              <button type="button" className="btn" onClick={onExit}>
                처음 화면
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
