import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { withJosa } from '../../lib/korean';
import { startMusic, stopMusic } from '../../lib/music';
import { sfx } from '../../lib/sound';
import { useTimers } from '../../lib/useTimers';
import { SEAT_COLORS } from '../common/players';
import type { Speed } from '../common/speed';
import { planMove } from './ai';
import { Board } from './Board';
import { Panel } from './Panel';
import { Rack } from './Rack';
import { GameOver, RoundOver } from './Results';
import { applyAction, checkCommit, needsMeld, playerName } from './rules';
import { TILES_DELAYS, clearSavedTilesGame, saveTilesGame, type TilesSettings } from './storage';
import { MELD_POINTS } from './tiles';
import type { TilesAction, TilesSetup, TilesState } from './types';
import { isTableTile, moveTiles, playedCount, startWork, type Target, type Work } from './work';
import { soloOutcome, useRecordOutcome } from '../../lib/stats';

interface TilesGameProps {
  setup: TilesSetup;
  initialState: TilesState;
  settings: TilesSettings;
  onSettings: (settings: TilesSettings) => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

interface View {
  owner: number | null;
  faceUp: boolean;
  coverMode: boolean;
}

/** 아래 타일 칸에 누구의 타일을 보여 줄지 (한 장 남았다!와 같은 방식) */
function computeView(state: TilesState, revealed: number | null): View {
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

const EMPTY = new Set<number>();
let seq = 1;

function formatTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function TilesGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: TilesGameProps) {
  const [game, setGame] = useState<TilesState>(initialState);
  useRecordOutcome('tiles', game.phase === 'gameover', () => soloOutcome(game.players.map((p) => p.kind), [game.rankings[0]]));
  /** 이번 차례에 고치고 있는 판 (turn이 바뀌면 버린다) */
  const [edit, setEdit] = useState<{ turn: number; work: Work } | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<number>>(EMPTY);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<number>>(EMPTY);
  const [recent, setRecent] = useState<ReadonlySet<number>>(EMPTY);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [bubbles, setBubbles] = useState<Record<number, { id: number; text: string }>>({});
  const [message, setMessage] = useState<{ id: number; text: string } | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const dragIds = useRef<number[] | null>(null);
  const prevGame = useRef<TilesState | null>(null);
  const prevCurrent = useRef(initialState.current);
  const later = useTimers();
  const delays = TILES_DELAYS[settings.speed];

  const active = game.phase === 'play';
  const current = game.players[game.current];
  const humanCount = game.players.filter((p) => p.kind === 'human').length;
  const view = computeView(game, revealed);
  const humanTurn = active && current.kind === 'human';
  const interactive = humanTurn && view.faceUp;
  const needsReveal = humanTurn && !view.faceUp;
  const meldTurn = active && needsMeld(game);

  const baseWork = useMemo(() => startWork(game), [game]);
  const work = interactive ? (edit && edit.turn === game.turn ? edit.work : baseWork) : null;
  const dirty = !!edit && edit.turn === game.turn;
  const check = useMemo(() => (work ? checkCommit(game, work.table) : null), [game, work]);
  const played = work ? playedCount(work) : 0;
  const ownPlayed = useMemo(() => {
    if (!work) return EMPTY;
    const own = new Set(work.ownIds);
    return new Set(work.table.flatMap((s) => s.tiles.filter((t) => own.has(t.id)).map((t) => t.id)));
  }, [work]);

  // 배경음악
  useEffect(() => {
    if (settings.music) startMusic('puzzle');
    else stopMusic();
  }, [settings.music]);
  useEffect(() => () => stopMusic(), []);

  const say = useCallback(
    (text: string) => {
      const id = seq++;
      setMessage({ id, text });
      later(() => setMessage((m) => (m && m.id === id ? null : m)), 2600);
    },
    [later],
  );

  // 차례가 바뀌면: 고른 것 비우기, 다른 사람 차례면 타일 다시 가리기
  useEffect(() => {
    if (game.current !== prevCurrent.current) setRevealed(null);
    prevCurrent.current = game.current;
    setSelected(EMPTY);
    setMessage(null);
  }, [game.turn, game.current]);

  // 시간 제한: 내 타일이 보이는 순간부터 잰다
  useEffect(() => {
    if (interactive && game.options.turnTime > 0) {
      const start = Date.now();
      setNow(start);
      setDeadline(start + game.options.turnTime * 1000);
    } else {
      setDeadline(null);
    }
  }, [interactive, game.turn, game.options.turnTime]);
  useEffect(() => {
    if (deadline === null) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [deadline]);

  const perform = useCallback((action: TilesAction) => {
    setGame((g) => applyAction(g, action));
    setEdit(null);
    setSelected(EMPTY);
  }, []);

  // 시간이 다 되면: 판이 올바르면 그대로 완료, 아니면 되돌리고 1개 가져오기
  useEffect(() => {
    if (deadline === null || now < deadline || !work) return;
    setDeadline(null);
    const id = seq++;
    setToast({ id, text: '⏰ 시간이 다 됐어요!' });
    later(() => setToast((x) => (x && x.id === id ? null : x)), 1800);
    sfx.noMove();
    perform(check?.ok ? { type: 'commit', table: work.table } : { type: 'draw' });
  }, [now, deadline, work, check, perform, later]);

  // 상태가 바뀔 때마다: 저장 + 방금 한 일 보여 주기
  useEffect(() => {
    if (game.phase === 'gameover') clearSavedTilesGame();
    else saveTilesGame(setup, game);
    const before = prevGame.current;
    prevGame.current = game;
    if (!before || before === game) return;

    const move = game.lastMove;
    if (move && before.turn !== game.turn && before.lastMove !== move) {
      const who = game.players[move.player];
      const name = playerName(who);
      const id = seq++;
      let text: string;
      if (move.played.length > 0) {
        text = move.meldPoints !== null ? `첫 등록! +${move.played.length}개` : `+${move.played.length}개 냈어요`;
        move.played.forEach((_, i) => later(() => sfx.cardPlay(), Math.min(i, 6) * 70));
        if (delays.glow > 0) {
          setFresh(new Set(move.played));
          later(() => setFresh((f) => (f === EMPTY ? f : EMPTY)), delays.glow);
        }
        if (who.kind !== 'human') {
          setToast({ id, text: move.meldPoints !== null ? `${name}: 첫 등록 성공! (${move.meldPoints}점)` : `${name}: 타일 ${move.played.length}개를 냈어요` });
          later(() => setToast((x) => (x && x.id === id ? null : x)), 1800);
        }
      } else {
        text = move.drew ? '1개 가져옴' : '넘어감';
        sfx.cardDraw(1);
      }
      setBubbles((b) => ({ ...b, [move.player]: { id, text } }));
      later(() => setBubbles((b) => (b[move.player]?.id === id ? (({ [move.player]: _, ...rest }) => rest)(b) : b)), 2200);
    }

    // 아래 칸에 보이는 사람에게 새로 들어온 타일 표시
    const owner = computeView(game, null).owner;
    if (owner !== null && before.round === game.round) {
      const had = new Set(before.players[owner].rack.map((t) => t.id));
      const added = game.players[owner].rack.filter((t) => !had.has(t.id)).map((t) => t.id);
      if (added.length > 0) {
        setRecent(new Set(added));
        later(() => setRecent(EMPTY), 2500);
      }
    }

    if (game.phase === 'gameover') sfx.win();
    else if (game.phase === 'roundover') sfx.finish();
    else if (game.players[game.current].kind === 'human' && before.turn !== game.turn) later(() => sfx.turn(), 200);
  }, [game, setup, delays.glow, later]);

  // 컴퓨터 차례 (그리고 컴퓨터끼리 할 때 다음 판 시작)
  useEffect(() => {
    if (game.phase === 'gameover') return;
    if (game.phase === 'roundover') {
      if (humanCount > 0) return;
      const t = window.setTimeout(() => perform({ type: 'nextRound' }), 2600);
      return () => window.clearTimeout(t);
    }
    if (current.kind === 'human') return;
    const t = window.setTimeout(() => {
      setGame((g) => {
        const p = g.players[g.current];
        if (p.kind === 'human' || g.phase !== 'play') return g;
        return applyAction(g, planMove(g, p.kind));
      });
    }, delays.think);
    return () => window.clearTimeout(t);
  }, [game, humanCount, current.kind, delays.think, perform]);

  /** 이 타일을 집을 수 있는지 */
  const canPick = (id: number) => {
    if (!work) return false;
    if (!isTableTile(work, id)) return true;
    return game.options.rearrange && !meldTurn;
  };

  const canDrop = (target: Target, ids: Iterable<number> = selected) => {
    if (!work) return false;
    const list = [...ids];
    if (list.length === 0) return false;
    if (target === 'new') return true;
    if (target === 'rack') return list.some((id) => !isTableTile(work, id) && !work.rack.some((t) => t.id === id));
    if (meldTurn && work.oldSetIds.includes(target)) return false;
    const set = work.table.find((s) => s.id === target);
    return !!set && !list.every((id) => set.tiles.some((t) => t.id === id));
  };

  const onTile = (id: number) => {
    if (!work) return;
    if (!canPick(id)) {
      say(meldTurn ? '첫 등록 전에는 판에 있던 타일을 옮길 수 없어요.' : '간단 규칙에서는 판에 있던 타일을 옮길 수 없어요.');
      sfx.noMove();
      return;
    }
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    sfx.step();
  };

  const dropTo = (target: Target, ids: number[] = [...selected]) => {
    if (!work || ids.length === 0) return;
    if (typeof target === 'number' && meldTurn && work.oldSetIds.includes(target)) {
      say('첫 등록 때는 내 타일로 새 줄만 만들 수 있어요.');
      sfx.noMove();
      return;
    }
    const next = moveTiles(work, ids, target);
    if (next === work) {
      if (target === 'rack') say('판에 있던 타일은 내 칸으로 가져올 수 없어요.');
      return;
    }
    setEdit({ turn: game.turn, work: next });
    setSelected(EMPTY);
    sfx.cardPlay();
  };

  const onDragStart = (id: number) => {
    if (!canPick(id)) return;
    const ids = selected.has(id) ? [...selected] : [id];
    dragIds.current = ids;
    if (!selected.has(id)) setSelected(new Set([id]));
  };

  const commit = () => {
    if (work && check?.ok) perform({ type: 'commit', table: work.table });
  };

  // 키보드: Enter 완료·타일 보기·다음 판, Esc 고른 것 취소, N 새 줄
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return;
      if (e.key === 'Enter') {
        if (game.phase === 'roundover' && humanCount > 0) perform({ type: 'nextRound' });
        else if (needsReveal) setRevealed(game.current);
        else commit();
      } else if (e.key === 'Escape') {
        setSelected(EMPTY);
      } else if ((e.key === 'n' || e.key === 'N' || e.key === 'ㅜ') && selected.size > 0) {
        dropTo('new');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // 안내 문구
  const name = playerName(current);
  let hint: string;
  if (game.phase === 'gameover') hint = '게임이 끝났어요!';
  else if (game.phase === 'roundover') hint = '이번 판이 끝났어요.';
  else if (!humanTurn) hint = `${withJosa(name, '이/가')} 생각 중이에요…`;
  else if (needsReveal) hint = `${name} 차례예요. '내 타일 보기'를 누르세요.`;
  else if (message) hint = message.text;
  else if (selected.size > 0) hint = `${selected.size}개 골랐어요. 줄 끝의 ＋를 누르면 거기에 붙고, '새 줄 만들기'를 누르면 새 줄이 돼요.`;
  else if (played === 0)
    hint = meldTurn
      ? `첫 등록: 내 타일로 합이 ${MELD_POINTS}점 이상 되는 줄을 만들어 내세요. 낼 게 없으면 '1개 가져오기'.`
      : '타일을 골라 판에 놓으세요. 낼 게 없으면 1개 가져오세요.';
  else if (check?.ok) hint = meldTurn ? `✓ 첫 등록 ${check.meldPoints}점! '완료'를 누르세요.` : "✓ 좋아요! '완료'를 누르세요.";
  else hint = check && !check.ok ? check.reason : '';

  const meldInfo = meldTurn && humanTurn && played > 0 && check?.meldPoints != null ? `첫 등록 ${check.meldPoints} / ${MELD_POINTS}점` : null;
  const remaining = deadline !== null ? deadline - now : null;
  const color = SEAT_COLORS[current.seat];
  const status = (
    <>
      <span className="dot" style={{ background: color.main }} />
      <strong>{name}</strong>
      <span>{active ? '차례' : ''}</span>
      {meldInfo && <span className="tl-chip tl-chip-meld">{meldInfo}</span>}
      <span className="tl-status-spacer" />
      {remaining !== null && (
        <span className={`tl-chip tl-timer${remaining <= 10_000 ? ' tl-timer-low' : ''}`} data-testid="tl-timer">
          ⏱ {formatTime(remaining)}
        </span>
      )}
      <span className="tl-chip">더미 {game.pool.length}개</span>
      {game.options.endMode === 'rounds' && (
        <span className="tl-chip">
          {game.round} / {game.options.rounds}판
        </span>
      )}
    </>
  );

  const rackOwner = view.owner === null ? null : game.players[view.owner];
  const rackTiles = work ? work.rack : rackOwner ? rackOwner.rack : [];
  const setSpeed = (speed: Speed) => onSettings({ ...settings, speed });

  return (
    <div className="tl-game">
      <div className="tl-main">
        <Board
          sets={work ? work.table : game.table}
          interactive={!!work}
          selected={selected}
          fresh={fresh}
          ownPlayed={ownPlayed}
          canPick={canPick}
          canDrop={(t) => canDrop(t, dragIds.current ?? selected)}
          onTile={onTile}
          onDrop={(t) => {
            dropTo(t, dragIds.current ?? [...selected]);
            dragIds.current = null;
          }}
          onDragStart={onDragStart}
          onDragEnd={() => (dragIds.current = null)}
          status={status}
          toast={toast}
        />
        <Rack
          player={rackOwner}
          tiles={rackTiles}
          faceUp={view.faceUp}
          interactive={!!work}
          covered={needsReveal}
          selected={selected}
          recent={recent}
          sort={settings.sort}
          hint={hint}
          canDropBack={!!work && canDrop('rack', dragIds.current ?? selected)}
          canUndo={dirty && !!work}
          canDraw={!!work}
          drawLabel={dirty ? '되돌리고 1개 가져오기' : game.pool.length > 0 ? '1개 가져오기' : '넘어가기'}
          canCommit={!!check?.ok}
          onSort={(sort) => onSettings({ ...settings, sort })}
          onTile={onTile}
          onDropBack={() => {
            dropTo('rack', dragIds.current ?? [...selected]);
            dragIds.current = null;
          }}
          onDragStart={onDragStart}
          onDragEnd={() => (dragIds.current = null)}
          onUndo={() => {
            setEdit(null);
            setSelected(EMPTY);
          }}
          onDraw={() => perform({ type: 'draw' })}
          onCommit={commit}
          onReveal={() => setRevealed(game.current)}
        />
      </div>

      <Panel
        state={game}
        hint={hint}
        openHands={game.options.handView === 'open'}
        bubbles={bubbles}
        speed={settings.speed}
        muted={settings.muted}
        music={settings.music}
        onSpeed={setSpeed}
        onToggleMute={() => onSettings({ ...settings, muted: !settings.muted })}
        onToggleMusic={() => onSettings({ ...settings, music: !settings.music })}
        onNewGame={() => {
          if (game.phase === 'gameover' || window.confirm('지금 게임을 그만두고 새 게임을 할까요?')) onChangeSetup();
        }}
        onExit={onExit}
      />

      {game.phase === 'roundover' && <RoundOver state={game} canContinue={humanCount > 0} onNext={() => perform({ type: 'nextRound' })} />}
      {game.phase === 'gameover' && <GameOver state={game} onRestart={onRestart} onChangeSetup={onChangeSetup} onExit={onExit} />}
    </div>
  );
}
