import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { PassScreen } from '../../components/PassScreen';
import { withJosa } from '../../lib/korean';
import { sfx } from '../../lib/sound';
import { useMusic } from '../../lib/useMusic';
import { useTimers } from '../../lib/useTimers';
import type { GameSettings } from '../common/settings';
import { decideAction } from './ai';
import { Board, type ShotFx } from './Board';
import { SHIP_INFO, cellName, shipCells } from './fleet';
import { Panel } from './Panel';
import { Placement } from './Placement';
import { Results } from './Results';
import { SIDES, afloatShips, applyAction, canFire, isShipSunk, other, shipAt, sunkShips } from './rules';
import { SHIPS_SONG } from './song';
import { shipsSfx } from './sounds';
import { SHIPS_DELAYS, clearSavedShipsGame, saveShipsGame } from './storage';
import { HIT, type PlacedShip, type ShipsSetup, type ShipsState, type ShotResult, type Side } from './types';
import { soloOutcome, useRecordOutcome } from '../../lib/stats';

interface ShipsGameProps {
  setup: ShipsSetup;
  initialState: ShipsState;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

type Role = 'mine' | 'target' | 'watch' | 'blank';

interface Banner {
  id: number;
  owner: Side;
  tone: ShotResult;
  text: string;
  coord: string;
  extra: boolean;
  fly: number;
  /** 알림이 떠 있는 시간(ms) */
  life: number;
}

/** 차례 넘김 화면에 보여 줄 말: 상대가 지난 차례에 어디를 쐈는지 (맞히면 한 번 더면 여러 발) */
function passNote(game: ShipsState): string {
  const size = game.options.size;
  const shooter = game.players[other(game.current)];
  const history = shooter.history;
  if (history.length === 0) return '먼저 쏘는 차례예요. 상대 바다에서 쏠 칸을 골라요.';
  // 차례는 빗나가야 끝나므로, 맨 끝 물보라 앞의 연속 명중이 같은 차례다.
  let from = history.length - 1;
  if (game.options.extraTurn) while (from > 0 && shooter.marks[history[from - 1]] === HIT) from--;
  const fleet = game.players[game.current].fleet;
  const parts = history.slice(from).map((cell) => {
    const ship = shipAt(fleet, cell, size);
    const name = cellName(cell, size);
    if (!ship) return `${name} 물보라`;
    return isShipSunk(ship, shooter.marks, size) && shipCells(ship, size).every((c) => history.indexOf(c) <= history.indexOf(cell))
      ? `${name} 격침(${SHIP_INFO[ship.id].name})`
      : `${name} 명중`;
  });
  return `${withJosa(shooter.name, '이/가')} 쏜 곳: ${parts.join(' · ')}`;
}

const BANNER_ICON: Record<ShotResult, string> = { miss: '💦', hit: '💥', sunk: '🔥' };

function Legend() {
  return (
    <ul className="sh-legend" aria-label="그림 설명">
      <li>
        <svg viewBox="-5 -5 10 10" aria-hidden="true">
          <circle r={3.1} className="sh-legend-ring" />
          <circle r={1.6} fill="#fff" stroke="#5b9fd0" strokeWidth={0.5} />
        </svg>
        물보라 (빗나감)
      </li>
      <li>
        <svg viewBox="-5 -5 10 10" aria-hidden="true">
          <path d="M0 -4.6 C1.2 -2.8 3.6 -2.2 3.4 0.6 C3.3 2.8 1.8 4 0 4 C-1.8 4 -3.3 2.8 -3.4 0.6 C-3.5 -1.2 -2 -1.6 -1.6 -3 Z" fill="#ff8a1f" stroke="#c81d25" strokeWidth={0.6} />
          <path d="M-3 -3 L3 3 M3 -3 L-3 3" stroke="#5a0b0b" strokeWidth={1} strokeLinecap="round" />
        </svg>
        명중
      </li>
      <li>
        <svg viewBox="-5 -5 10 10" aria-hidden="true">
          <circle r={2.8} fill="#3a3d42" />
          <path d="M-2.6 -2.6 L2.6 2.6 M2.6 -2.6 L-2.6 2.6" stroke="#ff6b4a" strokeWidth={1} strokeLinecap="round" />
        </svg>
        격침 (배 모양이 드러나요)
      </li>
    </ul>
  );
}

export function ShipsGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: ShipsGameProps) {
  const [game, setGame] = useState<ShipsState>(initialState);
  /** 연출이 끝나는 시각 (그때까지 입력과 컴퓨터를 멈춘다) */
  const [anim, setAnim] = useState<number | null>(null);
  const humans = ([0, 1] as Side[]).filter((i) => initialState.players[i].kind === 'human');
  const mode: 'watch' | 'solo' | 'hotseat' = humans.length === 0 ? 'watch' : humans.length === 1 ? 'solo' : 'hotseat';
  const coverMode = mode === 'hotseat' && game.options.reveal === 'cover';
  /** 사람 둘일 때 지금 화면에 보이는 사람 */
  const [viewer, setViewer] = useState<Side | null>(() => (mode === 'solo' ? humans[0] : mode === 'hotseat' && !coverMode ? initialState.current : null));
  const [placeRevealed, setPlaceRevealed] = useState<Side | null>(null);
  const [fx, setFx] = useState<{ owner: Side; fx: ShotFx } | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const size = game.options.size;
  /** 편마다 따로 기억하는 조준 칸 (사람 둘일 때 서로의 조준이 섞이지 않게) */
  const [aims, setAims] = useState<[number, number]>(() => {
    const c = Math.floor(size / 2) * size + Math.floor(size / 2) - 1;
    return [c, c];
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(true);
  const prevGame = useRef<ShipsState | null>(null);
  const later = useTimers();
  const delays = SHIPS_DELAYS[settings.speed];

  useMusic(SHIPS_SONG, settings.music);
  useRecordOutcome('ships', game.phase === 'gameover', () => soloOutcome(game.players.map((p) => p.kind), [game.winner]));

  const locked = anim !== null;
  const current = game.players[game.current];
  const shownViewer: Side | null = mode === 'solo' ? humans[0] : mode === 'hotseat' ? viewer : null;
  const needPlacePass = coverMode && game.phase === 'place' && game.placing !== null && placeRevealed !== game.placing;
  const needBattlePass = coverMode && game.phase === 'battle' && !locked && viewer !== game.current;
  const humanTurn = game.phase === 'battle' && current.kind === 'human' && shownViewer === game.current && !needBattlePass;
  const canShoot = humanTurn && !locked;
  const aimSide = game.current;
  const aim = aims[aimSide];
  const setAim = useCallback(
    (next: number | ((c: number) => number)) =>
      setAims((a) => {
        const value = typeof next === 'function' ? next(a[aimSide]) : next;
        if (value === a[aimSide]) return a;
        const copy: [number, number] = [a[0], a[1]];
        copy[aimSide] = value;
        return copy;
      }),
    [aimSide],
  );

  // 연출 시간이 지나면 다시 움직인다.
  useEffect(() => {
    if (anim === null) return;
    const t = window.setTimeout(() => setAnim(null), Math.max(0, anim - performance.now()));
    return () => window.clearTimeout(t);
  }, [anim]);

  // 사람 둘이 화면을 가리지 않고 할 때는 차례가 바뀌면 바로 그 사람 화면으로
  useEffect(() => {
    if (mode === 'hotseat' && !coverMode && !locked && game.phase === 'battle' && viewer !== game.current) setViewer(game.current);
  }, [mode, coverMode, locked, game.phase, game.current, viewer]);

  /** 상태가 바뀔 때마다: 저장 + 마지막 행동의 연출과 소리 */
  useLayoutEffect(() => {
    if (game.phase === 'gameover') clearSavedShipsGame();
    else saveShipsGame(setup, game);
    const before = prevGame.current;
    prevGame.current = game;
    if (!before || before === game) return;

    const at = (fn: () => void, ms: number) => (ms <= 0 ? fn() : later(fn, ms));
    let total = 0;
    for (const e of game.events) {
      switch (e.type) {
        case 'placed':
          shipsSfx.horn();
          break;
        case 'shot': {
          const owner = other(e.shooter);
          const impact = delays[e.result];
          setFx({ owner, fx: { id: e.id, cell: e.cell, result: e.result, cells: e.cells, ship: e.ship, fly: delays.fly, impact } });
          shipsSfx.cannon();
          at(() => (e.result === 'miss' ? shipsSfx.splash() : shipsSfx.explosion()), delays.fly);
          if (e.result === 'sunk') at(() => shipsSfx.sink(), delays.fly + 220);
          if (delays.fx) {
            const text = e.result === 'miss' ? '물보라!' : e.result === 'hit' ? '명중!' : `격침! ${SHIP_INFO[e.ship!].name}`;
            const extra = game.events.some((x) => x.type === 'extra');
            const life = impact + 650;
            setBanner({ id: e.id, owner, tone: e.result, text, coord: cellName(e.cell, size), extra, fly: delays.fly, life });
            later(() => setBanner((b) => (b && b.id === e.id ? null : b)), delays.fly + life);
          }
          total = delays.fly + impact;
          if (coverMode && game.phase === 'battle' && game.current !== e.shooter) total += delays.pass;
          break;
        }
        case 'win':
          at(() => sfx.win(), total + 150);
          total += delays.fx ? 900 : 250;
          break;
        default:
          break;
      }
    }
    // 사람 차례가 오면 알림음
    if (game.phase === 'battle' && game.players[game.current].kind === 'human' && (before.phase !== 'battle' || before.current !== game.current)) {
      at(() => sfx.turn(), total + 60);
    }
    if (total > 0) setAnim(performance.now() + total);
  }, [game, setup, delays, size, coverMode, later]);

  // 컴퓨터 차례: 생각하는 시간을 두고, 그 순간의 최신 상태를 보고 쏜다.
  useEffect(() => {
    if (locked || game.phase !== 'battle' || current.kind === 'human') return;
    const t = window.setTimeout(() => {
      setGame((g) => {
        const p = g.players[g.current];
        if (g.phase !== 'battle' || p.kind === 'human') return g;
        return applyAction(g, decideAction(g, p.kind, Math.random));
      });
    }, delays.think);
    return () => window.clearTimeout(t);
  }, [game, locked, current.kind, delays.think]);

  const fire = useCallback(
    (cell: number) => {
      if (!canShoot) return;
      if (!canFire(game, cell)) {
        sfx.noMove();
        setNotice(`${cellName(cell, size)}은(는) 이미 쏜 곳이에요. 다른 칸을 고르세요.`);
        return;
      }
      setNotice(null);
      // 그사이 차례가 컴퓨터로 넘어갔으면 사람의 클릭으로 대신 쏘지 않는다.
      setGame((g) => (g.players[g.current].kind === 'human' ? applyAction(g, { type: 'fire', cell }) : g));
    },
    [canShoot, game, size],
  );

  const placeFleet = (fleet: PlacedShip[]) => {
    if (game.placing === null) return;
    const player = game.placing;
    setGame((g) => applyAction(g, { type: 'place', player, fleet }));
  };

  // 키보드: 방향키로 조준, Enter·Space로 쏘기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if (!humanTurn) return;
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        setAim((c) => {
          const x = c % size;
          const y = Math.floor(c / size);
          if (e.key === 'ArrowLeft') return y * size + Math.max(0, x - 1);
          if (e.key === 'ArrowRight') return y * size + Math.min(size - 1, x + 1);
          if (e.key === 'ArrowUp') return Math.max(0, y - 1) * size + x;
          return Math.min(size - 1, y + 1) * size + x;
        });
      } else if ((e.key === 'Enter' || e.key === ' ') && target?.tagName !== 'BUTTON') {
        e.preventDefault();
        fire(aim);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [humanTurn, size, aim, fire, setAim]);

  // ------------------------------------------------------------ 안내 문구
  let hint: string;
  if (game.phase === 'place') {
    const placer = game.players[game.placing ?? 0];
    hint = needPlacePass ? `${placer.name}에게 화면을 넘겨 주세요.` : `${placer.name}: 내 바다에 배를 숨기세요. 다 놓으면 '준비 완료'!`;
  } else if (game.phase === 'gameover') {
    hint = `${game.players[game.winner ?? 0].name} 승리! 상대 배를 모두 가라앉혔어요.`;
  } else if (needBattlePass) {
    hint = `${current.name} 차례예요. 화면을 넘겨 주세요.`;
  } else if (locked) {
    hint = '포탄이 날아가요…';
  } else if (current.kind !== 'human') {
    hint = `${withJosa(current.name, '이/가')} 조준하고 있어요…`;
  } else if (humanTurn) {
    hint = '상대 바다에서 쏠 칸을 고르세요. 클릭하거나 방향키로 조준하고 Enter!';
  } else {
    hint = `${current.name} 차례예요.`;
  }

  // ------------------------------------------------------------ 판 그리기
  const renderBoard = (owner: Side, role: Role) => {
    const side = SIDES[owner];
    const p = game.players[owner];
    const shooter = game.players[other(owner)];
    const sunk = role === 'blank' ? [] : sunkShips(game, owner);
    const sunkIds = new Set(sunk.map((s) => s.id));
    const afloat = afloatShips(game, owner).length;
    const isTarget = role === 'target';
    const boardFx = role !== 'blank' && fx?.owner === owner ? fx.fx : null;
    const myBanner = role !== 'blank' && banner?.owner === owner ? banner : null;
    const active = isTarget && canShoot;
    let title: string;
    let sub: string;
    if (role === 'mine') {
      title = `내 바다 · ${p.name}`;
      sub = game.phase === 'battle' && game.current !== owner ? '⚠ 상대가 조준 중' : `${afloat}척 떠 있어요`;
    } else if (role === 'target') {
      title = `${p.name}의 바다`;
      sub = active ? '🎯 여기를 쏴요' : `${afloat}척 남음`;
    } else if (role === 'watch') {
      title = `${p.name}의 바다`;
      sub = `${afloat}/${p.fleet.length}척 떠 있어요`;
    } else {
      title = '바다';
      sub = '';
    }
    const ships = role === 'mine' || role === 'watch' ? p.fleet : [];
    const ghosts = isTarget && game.options.reveal === 'open' ? afloatShips(game, owner) : [];
    const lastCell = role === 'blank' ? null : (shooter.history.at(-1) ?? null);
    return (
      <div
        key={`${owner}-${role === 'blank' ? 'blank' : 'board'}`}
        className={`sh-board-card sh-role-${role}${active ? ' sh-board-active' : ''}`}
        style={{ borderColor: role === 'blank' ? undefined : side.color, '--side': side.color } as CSSProperties}
        data-testid={role === 'target' ? 'sh-target' : role === 'mine' ? 'sh-mine' : undefined}
      >
        <header className="sh-board-head" style={{ background: role === 'blank' ? undefined : side.color }}>
          <strong>{title}</strong>
          {sub && <span>{sub}</span>}
        </header>
        <div className="sh-board-body">
          <Board
            size={size}
            ariaLabel={`${title}. ${sub}`}
            ships={ships}
            sunkIds={sunkIds}
            wrecks={isTarget ? sunk : undefined}
            ghosts={ghosts}
            marks={role === 'blank' ? [] : shooter.marks}
            lastCell={lastCell}
            fx={boardFx}
            cursor={active ? aim : null}
            cursorKind="aim"
            interactive={active}
            onCellDown={(cell, e) => {
              if (e.button !== 0) return;
              setAim(cell);
              fire(cell);
            }}
            onHover={(cell) => {
              if (cell !== null) setAim(cell);
            }}
          />
          {myBanner && (
            <div
              key={myBanner.id}
              className={`sh-banner sh-banner-${myBanner.tone}`}
              style={{ '--fly': `${myBanner.fly}ms`, '--life': `${myBanner.life}ms` } as CSSProperties}
              aria-hidden="true"
            >
              <span className="sh-banner-icon">{BANNER_ICON[myBanner.tone]}</span>
              <span className="sh-banner-text">
                <small>{myBanner.coord}</small>
                {myBanner.text}
              </span>
              {myBanner.extra && <span className="sh-banner-extra">한 번 더!</span>}
            </div>
          )}
        </div>
        {isTarget && (
          <footer className="sh-board-foot">
            {notice ? (
              <span className="sh-notice">{notice}</span>
            ) : active ? (
              <span>
                조준 <b className="sh-aim-name">{cellName(aim, size)}</b> · 클릭하거나 <kbd>방향키</kbd> + <kbd>Enter</kbd>로 쏘기
              </span>
            ) : (
              <span>{hint}</span>
            )}
          </footer>
        )}
      </div>
    );
  };

  let boards: [Side, Role][];
  if (game.phase === 'gameover' || mode === 'watch') boards = [
    [0, 'watch'],
    [1, 'watch'],
  ];
  else if (shownViewer !== null && !needBattlePass) boards = [
    [shownViewer, 'mine'],
    [other(shownViewer), 'target'],
  ];
  else boards = [
    [0, 'blank'],
    [1, 'blank'],
  ];

  const placer = game.placing;
  const lastLog = game.log.at(-1)?.text ?? '';

  return (
    <div className="sh-game sh-scope">
      <div className="sh-main">
        {game.phase === 'place' && placer !== null ? (
          needPlacePass ? (
            <div className={`sh-boards sh-boards-${mode}`}>{boards.map(([o]) => renderBoard(o, 'blank'))}</div>
          ) : (
            <Placement
              key={placer}
              size={size}
              noTouch={game.options.noTouch}
              name={game.players[placer].name}
              color={SIDES[placer].color}
              onDone={placeFleet}
            />
          )
        ) : (
          <div className={`sh-boards sh-boards-${boards[1][1]}`}>{boards.map(([o, r]) => renderBoard(o, r))}</div>
        )}
        {game.phase !== 'place' && <Legend />}

        {needPlacePass && placer !== null && (
          <PassScreen
            name={game.players[placer].name}
            color={SIDES[placer].color}
            what="내 바다"
            note="상대가 보지 않게 몰래 배를 숨겨요."
            onReveal={() => setPlaceRevealed(placer)}
          />
        )}
        {needBattlePass && (
          <PassScreen
            name={current.name}
            color={SIDES[game.current].color}
            what="내 바다"
            note={passNote(game)}
            onReveal={() => {
              setViewer(game.current);
              setFx(null);
              setBanner(null);
            }}
          />
        )}
        <p className="sh-sr" aria-live="polite">
          {lastLog}
        </p>
      </div>

      <Panel
        state={game}
        hint={hint}
        settings={settings}
        onSettings={onSettings}
        onNewGame={() => {
          if (game.phase === 'gameover' || window.confirm('지금 게임을 그만두고 새 게임을 할까요?')) onChangeSetup();
        }}
        onExit={onExit}
        extra={
          game.phase === 'gameover' && !showResult ? (
            <button type="button" className="btn btn-primary sh-show-result" onClick={() => setShowResult(true)}>
              결과 다시 보기
            </button>
          ) : null
        }
      />

      {game.phase === 'gameover' && !locked && showResult && (
        <Results state={game} onRestart={onRestart} onChangeSetup={onChangeSetup} onExit={onExit} onClose={() => setShowResult(false)} />
      )}
    </div>
  );
}
