import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { withJosa } from '../../lib/korean';
import { sfx } from '../../lib/sound';
import { soloOutcome, useRecordOutcome } from '../../lib/stats';
import { useMusic } from '../../lib/useMusic';
import { useTimers } from '../../lib/useTimers';
import { SEAT_COLORS } from '../common/players';
import type { GameSettings } from '../common/settings';
import { decideAction, type AiLevel } from './ai';
import { keyX, keyY } from './board';
import { Dock } from './Dock';
import { CELL, MapView, type FadingFlag, type Float, type Ghost, type Glow } from './MapView';
import { Panel } from './Panel';
import { Results } from './Results';
import { applyAction, flagChoices, gridOf, mustDiscard, playerName, spotsFor } from './rules';
import { VILLAGE_SONG } from './song';
import { vlSound } from './sounds';
import { VILLAGE_DELAYS, clearSavedVillageGame, saveVillageGame } from './storage';
import { FEATURE_NAMES, TILES, rotPt } from './tiles';
import type { Node, Rot, VillageAction, VillageSetup, VillageState } from './types';

interface VillageGameProps {
  setup: VillageSetup;
  initialState: VillageState;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

type Timed<T> = T & { until: number };

let fxSeq = 1;
const GOLD = '#f2b632';

/** 지형의 가운데쯤 (깃발 자리들의 평균) */
function centroid(state: VillageState, nodes: readonly Node[]): [number, number] {
  let sx = 0;
  let sy = 0;
  for (const [i, s] of nodes) {
    const p = state.board[i];
    const a = rotPt(TILES[p.t].segs[s].anchor, p.r);
    sx += p.x * CELL + a[0];
    sy += p.y * CELL + a[1];
  }
  return [sx / nodes.length, sy / nodes.length - 10];
}

export function VillageGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: VillageGameProps) {
  const [game, setGame] = useState<VillageState>(initialState);
  const [sel, setSel] = useState(0);
  const [rot, setRot] = useState<Rot>(0);
  const [hover, setHover] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [flagSel, setFlagSel] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [glows, setGlows] = useState<Timed<Glow>[]>([]);
  const [floats, setFloats] = useState<Timed<Float>[]>([]);
  const [fading, setFading] = useState<Timed<FadingFlag>[]>([]);
  const [drop, setDrop] = useState<Timed<{ index: number }> | null>(null);
  const [newFlag, setNewFlag] = useState<Timed<{ index: number }> | null>(null);
  const [fitKey, setFitKey] = useState(0);
  const [showResult, setShowResult] = useState(true);
  const [banner, setBanner] = useState<Timed<{ id: number; text: string; color: string }> | null>(null);
  const prevGame = useRef<VillageState | null>(null);
  const latest = useRef(game);
  latest.current = game;
  const later = useTimers();
  const delays = VILLAGE_DELAYS[settings.speed];
  useMusic(VILLAGE_SONG, settings.music);
  useRecordOutcome('village', game.phase === 'gameover', () => soloOutcome(game.players.map((p) => p.kind), game.winners));

  const grid = useMemo(() => gridOf(game), [game]);
  const frontier = useMemo(() => grid.frontier(), [grid]);
  const frontierSet = useMemo(() => new Set(frontier), [frontier]);
  const cur = game.players[game.current];
  const active = game.phase !== 'gameover';
  const humanTurn = active && cur.kind === 'human';
  const locked = lockUntil !== null;
  const canAct = humanTurn && !locked;
  const placing = canAct && game.phase === 'place';
  const flagging = canAct && game.phase === 'flag';
  const stuck = useMemo(() => humanTurn && mustDiscard(game), [humanTurn, game]);
  const selIndex = Math.max(0, Math.min(sel, cur.hand.length - 1));
  const selTile: number | undefined = cur.hand[selIndex];

  /** 손 조각마다 놓을 수 있는 자리 */
  const handSpots = useMemo(() => (humanTurn && game.phase === 'place' ? cur.hand.map((t) => spotsFor(grid, t)) : []), [humanTurn, game.phase, cur.hand, grid]);
  const spots = placing ? (handSpots[selIndex] ?? null) : null;
  const choices = useMemo(() => (game.phase === 'flag' ? flagChoices(game, grid) : null), [game, grid]);

  // 차례가 바뀌면 고른 것을 지운다. 놓을 곳이 있는 조각을 먼저 고른다.
  useEffect(() => {
    setPending(null);
    setFlagSel(null);
    setNotice(null);
    setRot(0);
    const first = handSpots.findIndex((m) => m.size > 0);
    setSel(first >= 0 ? first : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.turn]);

  // 안내 문구는 잠시 뒤 사라진다
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(t);
  }, [notice]);

  // 연출 시간이 지나면 다시 움직인다
  useEffect(() => {
    if (lockUntil === null) return;
    const t = window.setTimeout(() => setLockUntil(null), Math.max(0, lockUntil - performance.now()));
    return () => window.clearTimeout(t);
  }, [lockUntil]);

  // 끝난 연출 조각을 치운다
  useEffect(() => {
    const times = [...glows.map((g) => g.until), ...floats.map((f) => f.until), ...fading.map((f) => f.until), drop?.until, newFlag?.until, banner?.until].filter(
      (t): t is number => t !== undefined,
    );
    if (times.length === 0) return;
    const t = window.setTimeout(
      () => {
        const now = performance.now() + 5;
        const alive = <T extends { until: number }>(list: T[]) => (list.some((x) => x.until <= now) ? list.filter((x) => x.until > now) : list);
        setGlows(alive);
        setFloats(alive);
        setFading(alive);
        setDrop((d) => (d && d.until <= now ? null : d));
        setNewFlag((d) => (d && d.until <= now ? null : d));
        setBanner((d) => (d && d.until <= now ? null : d));
      },
      Math.max(0, Math.min(...times) - performance.now()) + 10,
    );
    return () => window.clearTimeout(t);
  }, [glows, floats, fading, drop, newFlag, banner]);

  /** 상태가 바뀔 때마다: 저장 + 마지막 행동의 연출 */
  useLayoutEffect(() => {
    if (game.phase === 'gameover') clearSavedVillageGame();
    else saveVillageGame(setup, game);
    const before = prevGame.current;
    prevGame.current = game;
    if (before === game) return;
    const fx = delays.fx;
    const t0 = performance.now();
    const sound = (play: () => void, at: number) => (at <= 0 ? play() : later(play, at));
    const seatColor = (player: number) => SEAT_COLORS[game.players[player].seat].main;
    const seatInk = (player: number) => SEAT_COLORS[game.players[player].seat].dark;
    const addFloat = (x: number, y: number, text: string, color: string, at: number, life = 1700) =>
      later(() => setFloats((l) => [...l, { id: fxSeq++, x, y, text, color, until: performance.now() + life }]), Math.max(0, at));
    const addGlow = (nodes: readonly Node[], color: string, tone: Glow['tone'], at: number, life: number) =>
      later(() => setGlows((l) => [...l, { id: fxSeq++, nodes, color, tone, until: performance.now() + life }]), Math.max(0, at));

    let total = 0;
    let at = 0;
    for (const e of game.events) {
      switch (e.type) {
        case 'start':
          if (before === null) setFitKey((k) => k + 1);
          break;
        case 'place': {
          sound(() => vlSound.tap(), 0);
          if (fx) setDrop({ index: e.index, until: t0 + delays.drop + 50 });
          setFitKey((k) => k + 1);
          total = Math.max(total, delays.drop, delays.camera * 0.6);
          at = Math.max(at, delays.drop);
          break;
        }
        case 'jangseung': {
          const p = game.board[e.index];
          addFloat(p.x * CELL + 50, p.y * CELL + 30, e.points > 0 ? `장승 +${e.points}` : '장승 0', e.points > 0 ? seatInk(e.player) : '#8a7d6b', at);
          sound(() => vlSound.jangseung(e.points), at);
          at += fx ? 500 : 80;
          total = Math.max(total, at);
          break;
        }
        case 'flag':
          setNewFlag({ index: e.index, until: t0 + 700 });
          sound(() => vlSound.flag(), 0);
          total = Math.max(total, fx ? 380 : 60);
          at = Math.max(at, fx ? 300 : 40);
          break;
        case 'complete': {
          const [cx, cy] = centroid(game, e.nodes);
          const scored = e.winners.length > 0;
          const color = scored ? seatColor(e.winners[0]) : GOLD;
          addGlow(e.nodes, scored ? color : GOLD, 'complete', at, delays.flash);
          const text = scored ? `+${e.points}${e.winners.length > 1 ? ` ×${e.winners.length}` : ''}` : `${FEATURE_NAMES[e.kind]} 완성!`;
          addFloat(cx, cy, text, scored ? seatInk(e.winners[0]) : '#8a6a1f', at + 120, Math.max(1200, delays.flash + 300));
          sound(() => vlSound.complete(e.kind, scored), at);
          if (e.returned.length > 0) {
            const startAt = at;
            later(
              () =>
                setFading((l) => [
                  ...l,
                  ...e.returned.map((r) => ({ id: fxSeq++, index: r.index, seg: r.seg, seat: game.players[r.player].seat, until: performance.now() + Math.max(500, delays.flash) })),
                ]),
              startAt,
            );
          }
          at += delays.stagger;
          total = Math.max(total, at + delays.flash * 0.7);
          break;
        }
        case 'discard':
          setNotice(`${playerName(game.players[e.player])}: 놓을 곳이 없어서 ${withJosa(TILES[e.t].name, '을/를')} 버리고 새로 뽑았어요.`);
          sound(() => vlSound.discard(), 0);
          total = Math.max(total, fx ? 700 : 100);
          break;
        case 'pass':
          setNotice(`${playerName(game.players[e.player])}: 놓을 수 있는 조각이 없어서 지나가요.`);
          break;
        case 'final': {
          const color = seatColor(e.winners[0]);
          addGlow(e.nodes, color, 'final', at, delays.flash);
          const [cx, cy] = centroid(game, e.nodes);
          addFloat(cx, cy, `+${e.points}`, seatInk(e.winners[0]), at + 80, Math.max(1100, delays.flash + 200));
          sound(() => vlSound.final(), at);
          at += Math.round(delays.stagger * 0.6);
          total = Math.max(total, at + delays.flash * 0.6);
          break;
        }
        case 'gameover':
          sound(() => vlSound.win(), at + 250);
          total = Math.max(total, at + (fx ? 1400 : 400));
          break;
        default:
          break;
      }
    }
    // 사람 차례가 오면 알림음
    if (game.phase === 'place' && game.players[game.current].kind === 'human' && (!before || before.turn !== game.turn) && game.events.some((e) => e.type !== 'discard')) {
      sound(() => sfx.turn(), total + 60);
      const p = game.players[game.current];
      const text = `${playerName(p)} 차례예요!`;
      const color = SEAT_COLORS[p.seat].dark;
      const turn = game.turn;
      // 그사이 벌써 놓았으면 알리지 않는다
      if (fx) later(() => latest.current.turn === turn && latest.current.phase === 'place' && setBanner({ id: fxSeq++, text, color, until: performance.now() + 1500 }), total);
    }
    if (total > 0) setLockUntil(performance.now() + total);
  }, [game, setup, delays, later]);

  // 컴퓨터 차례 (그 순간의 최신 상태를 보고 정한다)
  useEffect(() => {
    if (locked || !active || cur.kind === 'human') return;
    const wait = game.phase === 'flag' ? delays.flagThink : delays.think;
    const turn = game.turn;
    const phase = game.phase;
    const t = window.setTimeout(() => {
      setGame((g) => {
        if (g.turn !== turn || g.phase !== phase || g.phase === 'gameover' || g.players[g.current].kind === 'human') return g;
        const a = decideAction(g, g.players[g.current].kind as AiLevel);
        return a ? applyAction(g, a) : g;
      });
    }, wait);
    return () => window.clearTimeout(t);
  }, [game, locked, active, cur.kind, delays]);

  const act = useCallback((a: VillageAction) => setGame((g) => (g.players[g.current].kind === 'human' ? applyAction(g, a) : g)), []);

  // ------------------------------------------------------------ 사람의 행동
  const fitsAt = (key: number, r: Rot) => selTile !== undefined && grid.fits(selTile, keyX(key), keyY(key), r);

  const selectTile = (i: number) => {
    if (!placing || i < 0 || i >= cur.hand.length) return;
    vlSound.tick();
    setSel(i);
    setNotice(null);
    const next = handSpots[i];
    if (pending !== null) {
      const rots = next?.get(pending);
      if (rots && rots.length > 0) setRot(rots.includes(rot) ? rot : rots[0]);
      else setPending(null);
    }
  };

  const rotate = () => {
    if (!placing || stuck) return;
    if (pending !== null && spots) {
      const rots = spots.get(pending) ?? [];
      if (rots.length <= 1) {
        setNotice('이 자리에는 지금 방향으로만 맞아요.');
        sfx.noMove();
        return;
      }
      const k = rots.indexOf(rot);
      setRot(rots[(k + 1) % rots.length]);
    } else setRot(((rot + 1) % 4) as Rot);
    vlSound.rotate();
  };

  const choose = (key: number) => {
    const rots = spots?.get(key);
    if (!rots) return;
    setPending(key);
    if (!rots.includes(rot)) setRot(rots[0]);
    setNotice(null);
    vlSound.tick();
  };

  const confirm = () => {
    if (!placing || stuck || selTile === undefined) return;
    if (pending === null) {
      setNotice('먼저 반짝이는 자리를 눌러 골라요.');
      return;
    }
    if (!fitsAt(pending, rot)) {
      setNotice('이 방향으로는 모서리가 맞지 않아요. R로 돌려 보세요.');
      sfx.noMove();
      return;
    }
    const a: VillageAction = { type: 'place', hand: selIndex, x: keyX(pending), y: keyY(pending), r: rot };
    setPending(null);
    setHover(null);
    act(a);
  };

  const clickCell = (key: number) => {
    if (!humanTurn || locked) return;
    if (game.phase === 'flag') {
      setNotice('먼저 깃발을 꽂을 곳을 고르거나 건너뛰어요.');
      return;
    }
    if (stuck) {
      setNotice('놓을 곳이 없어요. 아래에서 버릴 조각을 골라요.');
      return;
    }
    if (pending === key) {
      confirm();
      return;
    }
    if (spots?.has(key)) {
      choose(key);
      return;
    }
    if (frontierSet.has(key)) {
      const other = handSpots.findIndex((m, i) => i !== selIndex && m.has(key));
      setNotice(
        other >= 0
          ? `이 조각은 여기에 맞지 않아요. ${other + 1}번 조각은 놓을 수 있어요!`
          : '모서리가 맞지 않아요. 길은 길끼리, 냇물은 냇물끼리, 논둑은 논둑끼리, 들은 들끼리 닿아야 해요.',
      );
      sfx.noMove();
      return;
    }
    if (grid.get(keyX(key), keyY(key)) === undefined) setNotice('이미 놓인 조각 바로 옆에만 놓을 수 있어요.');
  };

  /** 화살표로 반짝이는 자리 사이를 옮긴다 */
  const moveCursor = (dx: number, dy: number) => {
    if (!placing || !spots || spots.size === 0) return;
    const keys = [...spots.keys()];
    const from = pending ?? hover;
    let next: number | undefined;
    if (from === null || !frontierSet.has(from)) {
      // 방금 놓은 조각에서 가장 가까운 곳
      const last = game.board[game.board.length - 1];
      next = keys.reduce((a, b) => (Math.hypot(keyX(a) - last.x, keyY(a) - last.y) <= Math.hypot(keyX(b) - last.x, keyY(b) - last.y) ? a : b));
    } else {
      const fx = keyX(from);
      const fy = keyY(from);
      let best = Infinity;
      for (const k of keys) {
        if (k === from) continue;
        const ax = keyX(k) - fx;
        const ay = keyY(k) - fy;
        const along = ax * dx + ay * dy;
        if (along <= 0) continue;
        const side = Math.abs(ax * dy) + Math.abs(ay * dx);
        const score = along + side * 2.2;
        if (score < best) {
          best = score;
          next = k;
        }
      }
    }
    if (next !== undefined) choose(next);
  };

  const plant = (seg: number) => {
    if (!flagging) return;
    const c = choices?.find((x) => x.seg === seg);
    if (!c) return;
    if (!c.ok) {
      setNotice(c.reason ?? '여기에는 깃발을 꽂을 수 없어요.');
      sfx.noMove();
      return;
    }
    setFlagSel(null);
    act({ type: 'flag', seg });
  };

  const skip = () => {
    if (!flagging) return;
    setFlagSel(null);
    act({ type: 'skipFlag' });
  };

  const discard = (i: number) => {
    if (!canAct || !stuck) return;
    act({ type: 'discard', hand: i });
  };

  const okChoices = choices?.filter((c) => c.ok) ?? [];

  // 키보드: 1/2 조각 고르기, R 돌리기, 화살표 자리 옮기기, Enter 놓기, Esc 취소 / F 깃발 고르기, Enter 꽂기, Space 건너뛰기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey || !canAct) return;
      // 손 조각 단추에 포커스가 있어도 Enter는 '놓기'로 쓴다
      const onButton = t?.tagName === 'BUTTON' && !t.classList.contains('vl-hand-tile');
      if (game.phase === 'flag') {
        if (e.code === 'KeyF') {
          e.preventDefault();
          if (okChoices.length === 0) return;
          const k = okChoices.findIndex((c) => c.seg === flagSel);
          setFlagSel(okChoices[(k + 1) % okChoices.length].seg);
          vlSound.tick();
        } else if (e.key === 'Enter' && !onButton) {
          e.preventDefault();
          if (flagSel !== null) plant(flagSel);
          else setNotice('F로 꽂을 곳을 고르거나, Space로 건너뛰어요.');
        } else if (e.key === ' ' && !onButton) {
          e.preventDefault();
          skip();
        } else if (/^[1-4]$/.test(e.key)) {
          const c = okChoices[Number(e.key) - 1];
          if (c) plant(c.seg);
        } else if (e.key === 'Escape') setFlagSel(null);
        return;
      }
      if (game.phase !== 'place') return;
      if (stuck) {
        if (/^[1-2]$/.test(e.key) && Number(e.key) <= cur.hand.length) setNotice(`${e.key}번 조각을 버리려면 아래의 '버리기'를 눌러요.`);
        return;
      }
      if (e.key === '1' || e.key === '2') {
        selectTile(Number(e.key) - 1);
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        rotate();
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (d) moveCursor(d[0], d[1]);
      } else if (e.key === 'Enter' && !onButton) {
        e.preventDefault();
        if (pending === null) moveCursor(1, 0);
        else confirm();
      } else if (e.key === 'Escape') {
        setPending(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ------------------------------------------------------------ 지도에 보여 줄 것
  const ghostKey = placing && !stuck ? (pending ?? (hover !== null && frontierSet.has(hover) ? hover : null)) : null;
  let ghost: Ghost | null = null;
  if (ghostKey !== null && selTile !== undefined) {
    const x = keyX(ghostKey);
    const y = keyY(ghostKey);
    ghost = { t: selTile, x, y, r: rot, ok: grid.fits(selTile, x, y, rot), mismatches: grid.mismatches(selTile, x, y, rot) };
  }

  const previewSeg = flagging ? flagSel : null;
  const preview: Glow[] = [];
  if (previewSeg !== null && choices) {
    const c = choices.find((x) => x.seg === previewSeg);
    if (c) preview.push({ id: -1, nodes: c.feature.nodes, color: SEAT_COLORS[cur.seat].main, tone: 'preview' });
  }

  const flagPick =
    game.phase === 'flag' && game.placed !== null && choices && cur.kind === 'human'
      ? { index: game.placed, choices, selected: flagSel, seat: cur.seat }
      : null;

  // ------------------------------------------------------------ 안내 문구
  const name = playerName(cur);
  let hint: string;
  if (!active) {
    const names = game.winners.map((w) => playerName(game.players[w])).join(', ');
    hint = `${names} ${game.winners.length > 1 ? '공동 ' : ''}우승! 지도가 완성됐어요.`;
  } else if (!humanTurn) hint = game.phase === 'flag' ? `${withJosa(name, '이/가')} 깃발을 꽂을지 생각하고 있어요…` : `${withJosa(name, '이/가')} 조각을 놓을 자리를 찾고 있어요…`;
  else if (locked) hint = '잠깐만요…';
  else if (game.phase === 'flag')
    hint = '방금 놓은 조각에 깃발을 꽂을까요? 완성되면 깃발이 많은 사람이 점수를 받아요.';
  else if (stuck) hint = '손에 든 조각을 놓을 곳이 없어요. 하나를 버리고 새로 뽑아요.';
  else if (pending !== null) hint = '여기에 놓을까요? 한 번 더 누르거나 Enter! 방향은 R로 바꿔요.';
  else if (spots && spots.size === 0) hint = '이 조각은 놓을 곳이 없어요. 다른 조각을 골라요.';
  else hint = '조각을 골라 반짝이는 자리에 놓아요. 맞닿는 모서리가 같아야 해요.';

  const spotCounts = humanTurn && game.phase === 'place' ? handSpots.map((m) => m.size) : cur.hand.map(() => -1);
  const thinking = active && !humanTurn && !locked;

  return (
    <div className="vl-game">
      <div className="vl-main">
        <MapView
          board={game.board}
          seats={game.players.map((p) => p.seat)}
          frontier={frontier}
          spots={spots}
          showSpots={game.options.showSpots}
          placing={placing && !stuck}
          ghost={ghost}
          pending={pending}
          lastIndex={game.board.length > 1 ? game.board.length - 1 : null}
          dropIndex={drop?.index ?? null}
          newFlag={newFlag?.index ?? null}
          flagPick={flagging ? flagPick : null}
          glows={[...glows, ...preview]}
          floats={floats}
          fading={fading}
          fitKey={fitKey}
          cameraMs={delays.camera}
          onHover={setHover}
          onCell={clickCell}
          onRotate={rotate}
          onFlag={plant}
          onFlagHover={(seg) => flagging && setFlagSel(seg)}
          banner={game.phase === 'place' ? banner : null}
        />
        <Dock
          state={game}
          canAct={canAct}
          sel={selIndex}
          rot={rot}
          spotCounts={spotCounts}
          pending={pending !== null}
          canConfirm={pending !== null && fitsAt(pending, rot)}
          stuck={stuck}
          flagChoices={choices}
          flagSel={flagSel}
          notice={notice}
          onSelect={selectTile}
          onRotate={rotate}
          onConfirm={confirm}
          onCancel={() => setPending(null)}
          onDiscard={discard}
          onFlagHover={(seg) => flagging && setFlagSel(seg)}
          onFlag={plant}
          onSkip={skip}
          onShowResult={() => setShowResult(true)}
        />
        <p className="vl-sr" aria-live="polite">
          {game.log.at(-1)?.text ?? ''}
        </p>
      </div>

      <Panel
        state={game}
        hint={hint}
        thinking={thinking}
        settings={settings}
        onSettings={onSettings}
        onToggleSpots={() => setGame((g) => ({ ...g, options: { ...g.options, showSpots: !g.options.showSpots }, events: [] }))}
        onNewGame={() => {
          if (game.phase === 'gameover' || window.confirm('지금 게임을 그만두고 새 게임을 할까요?')) onChangeSetup();
        }}
        onExit={onExit}
      />

      {game.phase === 'gameover' && !locked && showResult && (
        <Results state={game} onRestart={onRestart} onChangeSetup={onChangeSetup} onExit={onExit} onViewMap={() => setShowResult(false)} />
      )}
    </div>
  );
}

