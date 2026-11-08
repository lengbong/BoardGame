import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../../lib/sound';
import { useTimers } from '../../lib/useTimers';
import { SEAT_COLORS } from '../common/players';
import type { Speed } from '../common/speed';
import { decideAction } from './ai';
import { CenterPanel } from './CenterPanel';
import { applyAction, playerName, rollDie, selectableSquares, totalAssets } from './rules';
import { WORLD_DELAYS, clearSavedWorldGame, saveWorldGame, type WorldSettings } from './storage';
import type { WorldAction, WorldSetup, WorldState } from './types';
import { WorldBoard } from './WorldBoard';
import { CityDetail, CreditsModal, SidePanel } from './WorldPanels';

interface WorldGameProps {
  setup: WorldSetup;
  initialState: WorldState;
  settings: WorldSettings;
  onSettings: (settings: WorldSettings) => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

interface Animation {
  before: WorldState;
  after: WorldState;
  playerIndex: number;
  path: number[];
  step: number;
}

const MEDALS = ['🥇', '🥈', '🥉', '4등'];

function coins(n: number): string {
  return `${n.toLocaleString('ko-KR')}코인`;
}

/** 행동 결과에 맞는 효과음 */
function playSound(before: WorldState, after: WorldState, action: WorldAction): void {
  if (after.phase === 'gameover') return sfx.win();
  if (after.players.some((p, i) => p.bankrupt && !before.players[i].bankrupt)) return sfx.capture();
  if (after.phase === 'card' && before.phase !== 'card') return sfx.card();
  if (action.type === 'buy' || action.type === 'build') return sfx.coin();
  const payer = before.current;
  if (after.players[payer].cash < before.players[payer].cash) return sfx.pay();
}

export function WorldGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: WorldGameProps) {
  const [game, setGame] = useState<WorldState>(initialState);
  const [anim, setAnim] = useState<Animation | null>(null);
  const [rollingFaces, setRollingFaces] = useState<[number, number] | null>(null);
  const [inspect, setInspect] = useState<number | null>(null);
  const [showCredits, setShowCredits] = useState(false);
  const busy = useRef(false);
  const later = useTimers();
  const delays = WORLD_DELAYS[settings.speed];
  const turbo = settings.speed === 'turbo';

  const shown = anim ? anim.before : game;
  const current = game.players[game.current];
  const idle = !anim && rollingFaces === null;
  const interactive = idle && current.kind === 'human' && game.phase !== 'gameover';

  useEffect(() => {
    if (game.phase === 'gameover') clearSavedWorldGame();
    else saveWorldGame(setup, game);
  }, [game, setup]);

  /** 상태를 바꾸고, 말이 움직였다면 한 칸씩 보여 준 뒤에 반영한다. */
  const commit = useCallback(
    (before: WorldState, after: WorldState, action: WorldAction) => {
      if (after === before) {
        busy.current = false;
        return;
      }
      if (after.lastMove && after.lastMove.path.length > 0) {
        setAnim({ before, after, playerIndex: after.lastMove.playerIndex, path: after.lastMove.path, step: 0 });
        return;
      }
      playSound(before, after, action);
      setGame(after);
      busy.current = false;
    },
    [],
  );

  const perform = useCallback(
    (action: WorldAction) => {
      if (busy.current) return;
      busy.current = true;
      if (action.type !== 'roll') {
        commit(game, applyAction(game, action), action);
        return;
      }
      sfx.roll();
      const dice: [number, number] = [rollDie(), rollDie()];
      const flips = Math.max(1, Math.round(delays.dice / 70));
      for (let i = 0; i < flips; i++) {
        later(() => setRollingFaces([rollDie(), rollDie()]), i * 70);
      }
      later(() => {
        setRollingFaces(null);
        commit(game, applyAction(game, action, dice), action);
      }, delays.dice);
    },
    [game, commit, delays.dice, later],
  );

  // 말 이동 애니메이션
  useEffect(() => {
    if (!anim) return;
    if (!turbo) sfx.step();
    const t = window.setTimeout(() => {
      if (anim.step < anim.path.length - 1) {
        setAnim({ ...anim, step: anim.step + 1 });
        return;
      }
      playSound(anim.before, anim.after, { type: 'roll' });
      setGame(anim.after);
      setAnim(null);
      busy.current = false;
    }, delays.step);
    return () => window.clearTimeout(t);
  }, [anim, delays.step, turbo]);

  // 컴퓨터 차례
  useEffect(() => {
    if (!idle || game.phase === 'gameover' || current.kind === 'human') return;
    const level = current.kind;
    const t = window.setTimeout(() => perform(decideAction(game, level)), delays.think);
    return () => window.clearTimeout(t);
  }, [game, idle, current.kind, delays.think, perform]);

  // 키보드: Space 주사위, Enter 카드 확인
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return;
      if (!interactive || inspect !== null || showCredits) return;
      if ((e.key === ' ' || e.key === 'Enter') && game.phase === 'rolling') {
        e.preventDefault();
        perform({ type: 'roll' });
      } else if (e.key === 'Enter' && game.phase === 'card') {
        e.preventDefault();
        perform({ type: 'card' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [interactive, inspect, showCredits, game.phase, perform]);

  const tokenOverride = anim ? { playerIndex: anim.playerIndex, position: anim.path[anim.step] } : null;
  const diceFaces = rollingFaces ?? (anim ? anim.after.dice : game.dice);
  const selectable = interactive ? selectableSquares(game) : [];
  const setSpeed = (speed: Speed) => onSettings({ ...settings, speed });

  return (
    <div className="world-game">
      <div className="world-board-wrap">
        <WorldBoard
          state={shown}
          tokenOverride={tokenOverride}
          selectable={selectable}
          onSelect={(index) => perform({ type: 'select', index })}
          onInspect={setInspect}
        >
          <CenterPanel
            state={anim ? anim.before : game}
            diceFaces={diceFaces}
            diceRolling={rollingFaces !== null}
            interactive={interactive}
            onAction={perform}
          />
        </WorldBoard>
      </div>

      <SidePanel
        state={game}
        speed={settings.speed}
        muted={settings.muted}
        onSpeed={setSpeed}
        onToggleMute={() => onSettings({ ...settings, muted: !settings.muted })}
        onCredits={() => setShowCredits(true)}
        onNewGame={() => {
          if (game.phase === 'gameover' || window.confirm('지금 게임을 그만두고 새 게임을 할까요?')) onChangeSetup();
        }}
        onExit={onExit}
      />

      {inspect !== null && <CityDetail state={game} index={inspect} onClose={() => setInspect(null)} />}
      {showCredits && <CreditsModal onClose={() => setShowCredits(false)} />}

      {game.phase === 'gameover' && !anim && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="world-result-title">
          <div className="result-card" data-testid="world-result">
            <h2 id="world-result-title">🏆 게임 끝!</h2>
            <ol className="result-list">
              {game.rankings.map((pi, rank) => {
                const p = game.players[pi];
                return (
                  <li key={pi}>
                    <span className="medal">{MEDALS[rank]}</span>
                    <span className="dot" style={{ background: SEAT_COLORS[p.seat].main }} />
                    <strong>{playerName(p)}</strong>
                    <span className="result-assets">{p.bankrupt ? '파산' : `총자산 ${coins(totalAssets(game, pi))}`}</span>
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
