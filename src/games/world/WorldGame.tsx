import { useCallback, useEffect, useRef, useState } from 'react';
import { startMusic, stopMusic } from '../../lib/music';
import { sfx } from '../../lib/sound';
import { useTimers } from '../../lib/useTimers';
import { SEAT_COLORS } from '../common/players';
import type { Speed } from '../common/speed';
import { decideAction } from './ai';
import { Pawn } from './art/tiles';
import { CenterPanel } from './CenterPanel';
import { Confetti } from '../../components/Confetti';
import type { Floater } from './Effects';
import { applyAction, playerName, rollDie, selectableSquares, totalAssets } from './rules';
import { WORLD_DELAYS, clearSavedWorldGame, saveWorldGame, type WorldSettings } from './storage';
import type { WorldAction, WorldSetup, WorldState } from './types';
import { WorldBoard } from './WorldBoard';
import { CityAtlas, CityDetail, SidePanel } from './WorldPanels';

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
  action: WorldAction;
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
  if (after.players.some((p, i) => p.bankrupt && !before.players[i].bankrupt)) return sfx.bankrupt();
  if (after.phase === 'card' && before.phase !== 'card') return sfx.card();
  if (action.type === 'buy') return sfx.coin();
  if (action.type === 'build') return sfx.build();
  const me = before.current;
  const diff = after.players[me].cash - before.players[me].cash;
  if (diff < 0) return sfx.pay();
  if (diff > 0) return sfx.income();
}

let floaterSeq = 1;

export function WorldGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: WorldGameProps) {
  const [game, setGame] = useState<WorldState>(initialState);
  const [anim, setAnim] = useState<Animation | null>(null);
  const [rolling, setRolling] = useState<[number, number] | null>(null);
  const [rollId, setRollId] = useState(0);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [pops, setPops] = useState<ReadonlySet<number>>(new Set());
  const [banner, setBanner] = useState<{ id: number; playerIndex: number } | null>(null);
  const [inspect, setInspect] = useState<number | null>(null);
  const [showAtlas, setShowAtlas] = useState(false);
  const busy = useRef(false);
  const prevGame = useRef(game);
  const bannerUntil = useRef(0);
  const later = useTimers();
  const delays = WORLD_DELAYS[settings.speed];

  const shown = anim ? anim.before : game;
  const current = game.players[game.current];
  const idle = !anim && rolling === null;
  const interactive = idle && current.kind === 'human' && game.phase !== 'gameover';

  // 배경음악
  useEffect(() => {
    if (settings.music) startMusic();
    else stopMusic();
  }, [settings.music]);
  useEffect(() => () => stopMusic(), []);

  // 저장 + 화면 효과 (돈 숫자, 칸 반짝임, 차례 배너)
  useEffect(() => {
    if (game.phase === 'gameover') clearSavedWorldGame();
    else saveWorldGame(setup, game);

    const before = prevGame.current;
    prevGame.current = game;
    if (before === game) return;

    const newFloaters: Floater[] = [];
    game.players.forEach((p, i) => {
      const diff = p.cash - before.players[i].cash;
      if (diff !== 0) newFloaters.push({ id: floaterSeq++, playerIndex: i, amount: diff, square: p.position });
    });
    if (newFloaters.length > 0) {
      setFloaters((f) => [...f, ...newFloaters]);
      later(() => setFloaters((f) => f.filter((x) => !newFloaters.includes(x))), 1700);
    }

    const changed = new Set<number>();
    game.properties.forEach((prop, i) => {
      const old = before.properties[i];
      if (prop && old && (prop.owner !== old.owner || prop.level !== old.level) && prop.owner !== null) changed.add(i);
    });
    if (game.festivalSquare !== null && game.festivalSquare !== before.festivalSquare) changed.add(game.festivalSquare);
    if (changed.size > 0) {
      setPops(changed);
      later(() => setPops(new Set()), 1000);
    }

    if (delays.banner && game.phase !== 'gameover' && game.current !== before.current) {
      const id = floaterSeq++;
      setBanner({ id, playerIndex: game.current });
      bannerUntil.current = performance.now() + 1100;
      sfx.turn();
      later(() => setBanner((b) => (b && b.id === id ? null : b)), 1300);
    }
  }, [game, setup, later, delays.banner]);

  /** 상태를 바꾸고, 말이 움직였다면 한 칸씩 보여 준 뒤에 반영한다. */
  const commit = useCallback((before: WorldState, after: WorldState, action: WorldAction) => {
    if (after === before) {
      busy.current = false;
      return;
    }
    if (after.lastMove && after.lastMove.path.length > 0) {
      if (after.lastMove.path.length === 1 && action.type === 'select') sfx.plane();
      setAnim({ before, after, action, playerIndex: after.lastMove.playerIndex, path: after.lastMove.path, step: 0 });
      return;
    }
    playSound(before, after, action);
    setGame(after);
    busy.current = false;
  }, []);

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
      setRolling(dice);
      setRollId((n) => n + 1);
      later(() => {
        setRolling(null);
        commit(game, applyAction(game, action, dice), action);
      }, delays.dice + 60);
    },
    [game, commit, delays.dice, later],
  );

  // 말 이동: 한 칸씩 깡충
  useEffect(() => {
    if (!anim) return;
    if (settings.speed !== 'turbo') sfx.hop(anim.step);
    const t = window.setTimeout(() => {
      if (anim.step < anim.path.length - 1) {
        setAnim({ ...anim, step: anim.step + 1 });
        return;
      }
      playSound(anim.before, anim.after, anim.action);
      setGame(anim.after);
      setAnim(null);
      busy.current = false;
    }, delays.step);
    return () => window.clearTimeout(t);
  }, [anim, delays.step, settings.speed]);

  // 컴퓨터 차례 (차례 배너가 지나간 뒤에 움직이도록 기다린다)
  useEffect(() => {
    if (!idle || game.phase === 'gameover' || current.kind === 'human') return;
    const level = current.kind;
    const wait = Math.max(delays.think, bannerUntil.current - performance.now() + 150);
    const t = window.setTimeout(() => perform(decideAction(game, level)), wait);
    return () => window.clearTimeout(t);
  }, [game, idle, current.kind, delays.think, perform]);

  // 키보드: Space 주사위, Enter 카드 확인
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return;
      if (!interactive || inspect !== null || showAtlas) return;
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
  }, [interactive, inspect, showAtlas, game.phase, perform]);

  const tokenOverride = anim ? { playerIndex: anim.playerIndex, position: anim.path[anim.step] } : null;
  const dice = rolling ?? (anim ? anim.after.dice : game.dice);
  const selectable = interactive ? selectableSquares(game) : [];
  const setSpeed = (speed: Speed) => onSettings({ ...settings, speed });

  const deltas: Record<number, { id: number; amount: number }> = {};
  for (const f of floaters) deltas[f.playerIndex] = { id: f.id, amount: f.amount };

  return (
    <div className="world-game">
      <div className="world-board-wrap">
        <WorldBoard
          state={shown}
          tokenOverride={tokenOverride}
          hopKey={anim ? anim.step + rollId * 100 : 0}
          hopDuration={delays.step}
          selectable={selectable}
          popSquares={pops}
          floaters={floaters}
          onSelect={(index) => perform({ type: 'select', index })}
          onInspect={setInspect}
        >
          <CenterPanel
            state={shown}
            dice={dice}
            rollId={rollId}
            diceDuration={delays.dice}
            interactive={interactive}
            banner={banner}
            onAction={perform}
          />
        </WorldBoard>
      </div>

      <SidePanel
        state={game}
        deltas={deltas}
        speed={settings.speed}
        muted={settings.muted}
        music={settings.music}
        onSpeed={setSpeed}
        onToggleMute={() => onSettings({ ...settings, muted: !settings.muted })}
        onToggleMusic={() => onSettings({ ...settings, music: !settings.music })}
        onAtlas={() => setShowAtlas(true)}
        onNewGame={() => {
          if (game.phase === 'gameover' || window.confirm('지금 게임을 그만두고 새 게임을 할까요?')) onChangeSetup();
        }}
        onExit={onExit}
      />

      {showAtlas && (
        <CityAtlas
          state={game}
          onClose={() => setShowAtlas(false)}
          onPick={(i) => {
            setShowAtlas(false);
            setInspect(i);
          }}
        />
      )}
      {inspect !== null && <CityDetail state={game} index={inspect} onClose={() => setInspect(null)} />}

      {game.phase === 'gameover' && !anim && (
        <div className="overlay result-overlay" role="dialog" aria-modal="true" aria-labelledby="world-result-title">
          <Confetti />
          <div className="result-card world-result pop-in" data-testid="world-result">
            <div className="trophy" aria-hidden="true">
              🏆
            </div>
            <h2 id="world-result-title">{playerName(game.players[game.rankings[0]])} 우승!</h2>
            <ol className="result-list">
              {game.rankings.map((pi, rank) => {
                const p = game.players[pi];
                const c = SEAT_COLORS[p.seat];
                return (
                  <li key={pi} style={{ animationDelay: `${0.25 + rank * 0.15}s` }}>
                    <span className="medal">{MEDALS[rank]}</span>
                    <Pawn color={c.main} dark={c.dark} className="result-pawn" />
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
