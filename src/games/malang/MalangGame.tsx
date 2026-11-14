import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { recordOutcome, soloOutcome } from '../../lib/stats';
import { useMusic } from '../../lib/useMusic';
import type { GameSettings } from '../common/settings';
import { aiTick, newBrain, type AiBrain } from './ai';
import { Board, type Popup } from './Board';
import { applyInput, idx, nextRound, roundText, setSoftDrop, step, upcoming } from './engine';
import { GarbageIcon, PairPreview, SIDE_COLORS, garbageIcons } from './JellyArt';
import { Panel } from './Panel';
import { Results } from './Results';
import { MALANG_SONG } from './song';
import { mpSound } from './sounds';
import { clearSavedMalangGame, loadRecords, saveMalangGame, saveRecords } from './storage';
import type { DuelAiLevel, GameEvent, Input, MalangSetup, MalangState, PlayerState } from './types';

interface MalangGameProps {
  setup: MalangSetup;
  initialState: MalangState;
  /** 저장해 둔 판을 이어 하면 잠깐 멈춘 채로 시작한다 */
  resumed: boolean;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

type Action = Input | 'soft';
interface Binding {
  player: number;
  action: Action;
}

/** 누르고 있으면 되풀이: 처음 기다림, 되풀이 간격 (ms) */
const DAS = 170;
const REPEAT = 48;

/** 사람 한 명: 방향키와 WASD 모두 */
const SINGLE: Record<string, Action> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowDown: 'soft',
  KeyS: 'soft',
  ArrowUp: 'cw',
  KeyX: 'cw',
  KeyW: 'cw',
  KeyZ: 'ccw',
  KeyQ: 'ccw',
  Space: 'drop',
};

/** 사람 둘: 왼쪽은 WASD, 오른쪽은 방향키 */
const DUO: Record<string, Binding> = {
  KeyA: { player: 0, action: 'left' },
  KeyD: { player: 0, action: 'right' },
  KeyS: { player: 0, action: 'soft' },
  KeyW: { player: 0, action: 'cw' },
  KeyQ: { player: 0, action: 'ccw' },
  Space: { player: 0, action: 'drop' },
  ArrowLeft: { player: 1, action: 'left' },
  ArrowRight: { player: 1, action: 'right' },
  ArrowDown: { player: 1, action: 'soft' },
  ArrowUp: { player: 1, action: 'cw' },
  Slash: { player: 1, action: 'ccw' },
  Period: { player: 1, action: 'ccw' },
  Enter: { player: 1, action: 'drop' },
  NumpadEnter: { player: 1, action: 'drop' },
  ShiftRight: { player: 1, action: 'drop' },
  Numpad0: { player: 1, action: 'drop' },
};

interface Orb {
  id: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  until: number;
  big: boolean;
}

let fxSeq = 1;

function isDanger(p: PlayerState): boolean {
  return p.phase !== 'dead' && (p.grid[idx(2, 2)] !== null || p.grid[idx(3, 2)] !== null);
}

export function MalangGame({ setup, initialState, resumed, settings, onSettings, onRestart, onChangeSetup, onExit }: MalangGameProps) {
  const stateRef = useRef<MalangState>(initialState);
  const [, setFrame] = useState(0);
  const [paused, setPausedState] = useState(resumed);
  const pausedRef = useRef(paused);
  const brains = useRef<AiBrain[]>([newBrain(), newBrain()]);
  const held = useRef(new Map<string, { player: number; action: 'left' | 'right'; next: number }>());
  const popups = useRef<(Popup & { until: number })[][]>([[], []]);
  const shakes = useRef<({ id: number; power: number; until: number } | null)[]>([null, null]);
  const orbs = useRef<Orb[]>([]);
  const banner = useRef<{ text: string; until: number } | null>(null);
  const boardEls = useRef<(HTMLDivElement | null)[]>([null, null]);
  const trayEls = useRef<(HTMLDivElement | null)[]>([null, null]);
  const mainRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);
  const nextDanger = useRef(0);
  const [records, setRecords] = useState(loadRecords);
  const [newRecord, setNewRecord] = useState(false);
  const [showResult, setShowResult] = useState(true);
  useMusic(MALANG_SONG, settings.music && !paused);

  const s = stateRef.current;
  const humans = s.players.map((p, i) => (p.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  const versus = s.options.mode === 'versus';

  const setPaused = useCallback(
    (v: boolean) => {
      pausedRef.current = v;
      setPausedState(v);
      held.current.clear();
      stateRef.current.players.forEach((_, i) => setSoftDrop(stateRef.current, i, false));
      const st = stateRef.current;
      if (v && st.phase !== 'over') saveMalangGame(setup, st);
      mpSound.pause();
    },
    [setup],
  );

  const binding = useCallback(
    (code: string): Binding | null => {
      if (humans.length === 1) {
        const a = SINGLE[code];
        return a ? { player: humans[0], action: a } : null;
      }
      if (humans.length === 2) return DUO[code] ?? null;
      return null;
    },
    [humans.join()],
  );

  const doAction = useCallback((b: Binding, now: number) => {
    const st = stateRef.current;
    if (b.action === 'soft') setSoftDrop(st, b.player, true);
    else {
      applyInput(st, b.player, b.action);
      if (b.action === 'left' || b.action === 'right') return now + DAS;
    }
    return 0;
  }, []);

  const goNextRound = useCallback(() => {
    if (stateRef.current.phase !== 'roundover') return;
    stateRef.current = nextRound(stateRef.current);
    brains.current = [newBrain(), newBrain()];
    popups.current = [[], []];
    lastCount.current = 0;
  }, []);

  /** 판 위 어느 칸의 화면 좌표 (날아가는 방해 젤리용) */
  const centerOf = (el: HTMLElement | null): { x: number; y: number } | null => {
    const m = mainRef.current?.getBoundingClientRect();
    const r = el?.getBoundingClientRect();
    if (!m || !r || r.width === 0) return null;
    return { x: r.left + r.width / 2 - m.left, y: r.top + r.height / 2 - m.top };
  };

  const handleEvents = useCallback(
    (events: GameEvent[], now: number) => {
      const st = stateRef.current;
      const human = (i: number) => st.players[i]?.kind === 'human';
      const popup = (player: number, text: string, tone: Popup['tone'], x: number, y: number, life = 1100) => {
        // 연쇄 글자는 새 것이 나오면 앞의 것을 지운다 (겹치지 않게)
        const chainTone = tone === 'chain' || tone === 'big';
        const keep = popups.current[player].filter((u) => u.until > now && !(chainTone && (u.tone === 'chain' || u.tone === 'big')));
        popups.current[player] = [...keep, { id: fxSeq++, text, tone, x, y, until: now + life }];
      };
      const shake = (player: number, power: number) => {
        shakes.current[player] = { id: fxSeq++, power, until: now + 420 };
      };
      for (const e of events) {
        switch (e.type) {
          case 'start':
            mpSound.count(true);
            banner.current = { text: '시작!', until: now + 700 };
            break;
          case 'move':
            if (human(e.player)) mpSound.move();
            break;
          case 'rotate':
            if (human(e.player)) mpSound.rotate();
            break;
          case 'land':
            mpSound.land();
            break;
          case 'hardDrop':
            mpSound.hardDrop();
            shake(e.player, 0.6);
            break;
          case 'pop': {
            mpSound.pop(e.chain);
            const pop = st.players[e.player].pop;
            const text = e.chain >= 2 ? `${e.chain}연쇄!` : '팡!';
            popup(e.player, text, e.chain >= 3 ? 'big' : 'chain', pop?.x ?? 2.5, pop?.y ?? 6, e.chain >= 3 ? 1400 : 1000);
            if (e.chain >= 4) shake(e.player, 1);
            break;
          }
          case 'allClear':
            mpSound.allClear();
            popup(e.player, '싹 비웠다!', 'clear', 2.5, 5, 1800);
            break;
          case 'send': {
            mpSound.send(e.amount);
            const from = centerOf(boardEls.current[e.player]);
            const to = centerOf(trayEls.current[e.to]);
            if (from && to && settings.speed !== 'turbo') orbs.current = [...orbs.current, { id: fxSeq++, x0: from.x, y0: from.y, x1: to.x, y1: to.y, until: now + 650, big: e.amount >= 12 }];
            break;
          }
          case 'offset':
            mpSound.offset();
            popup(e.player, '막았다!', 'info', 2.5, 1.5, 900);
            break;
          case 'garbage':
            mpSound.garbage(e.amount);
            shake(e.player, Math.min(2.2, 0.6 + e.amount / 12));
            break;
          case 'levelUp':
            mpSound.levelUp();
            popup(e.player, `레벨 ${e.level}!`, 'info', 2.5, 3, 1300);
            break;
          case 'dead':
            break;
          case 'round': {
            const solo = st.options.mode === 'solo';
            const loserHuman = solo || (e.winner !== null && st.players[1 - e.winner].kind === 'human' && st.players[e.winner].kind !== 'human');
            if (e.winner === null && !solo) mpSound.pause();
            else if (loserHuman) mpSound.lose();
            else mpSound.win();
            if (st.phase === 'over') {
              clearSavedMalangGame();
              const result = solo ? null : soloOutcome(st.players.map((p) => p.kind), [st.winner]);
              if (result) recordOutcome('malang', result);
              const r = loadRecords();
              let fresh = false;
              const chain = Math.max(...st.players.filter((p) => p.kind === 'human').map((p) => p.stats.maxChain), 0);
              if (chain > r.bestChain) r.bestChain = chain;
              if (solo) {
                if (st.players[0].score > r.soloScore) {
                  r.soloScore = st.players[0].score;
                  fresh = st.players[0].score > 0;
                }
              } else if (st.winner !== null && st.players[st.winner].kind === 'human' && st.players[1 - st.winner].kind !== 'human') {
                const lv = st.players[1 - st.winner].kind;
                r.cpuWins = { ...r.cpuWins, [lv]: (r.cpuWins[lv] ?? 0) + 1 };
              }
              saveRecords(r);
              setRecords(r);
              setNewRecord(fresh);
            }
            break;
          }
        }
      }
    },
    [settings.speed],
  );

  // 매 프레임: 누르고 있는 키, 컴퓨터, 시간 진행, 연출
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let saveAt = last + 3000;
    const loop = (now: number) => {
      const dt = Math.min(80, now - last);
      last = now;
      const st = stateRef.current;
      if (!pausedRef.current) {
        if (st.phase === 'countdown') {
          const n = 3 - Math.floor(st.phaseT / 1000);
          if (n >= 1 && n !== lastCount.current) {
            lastCount.current = n;
            mpSound.count(false);
          }
        }
        for (const h of held.current.values()) {
          if (now >= h.next) {
            applyInput(st, h.player, h.action);
            h.next = now + REPEAT;
          }
        }
        st.players.forEach((p, i) => {
          if (p.kind !== 'human') aiTick(st, i, p.kind as DuelAiLevel, brains.current[i], dt);
        });
        step(st, dt);
        if (st.events.length > 0) handleEvents(st.events.splice(0), now);
        if (st.phase === 'roundover' && st.phaseT > 4500) goNextRound();
        if (now >= saveAt) {
          if (st.phase === 'play' || st.phase === 'countdown') saveMalangGame(setup, st);
          saveAt = now + 3000;
        }
        if (st.phase === 'play' && now >= nextDanger.current && st.players.some((p) => p.kind === 'human' && isDanger(p))) {
          mpSound.danger();
          nextDanger.current = now + 1600;
        }
      }
      orbs.current = orbs.current.filter((o) => o.until > now);
      popups.current = popups.current.map((list) => (list.some((u) => u.until <= now) ? list.filter((u) => u.until > now) : list));
      shakes.current = shakes.current.map((x) => (x && x.until > now ? x : null));
      if (banner.current && banner.current.until <= now) banner.current = null;
      setFrame((f) => (f + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [setup, handleEvents, goNextRound]);

  // 다른 창으로 가면 잠깐 멈춘다. 화면을 떠날 때는 저장
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && !pausedRef.current && stateRef.current.phase !== 'over') setPaused(true);
    };
    const onBlur = () => {
      if (!pausedRef.current && (stateRef.current.phase === 'play' || stateRef.current.phase === 'countdown')) setPaused(true);
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('blur', onBlur);
      const st = stateRef.current;
      if (st.phase !== 'over') saveMalangGame(setup, st);
    };
  }, [setup, setPaused]);

  // 키보드
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const st = stateRef.current;
      if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        if (st.phase !== 'over') setPaused(!pausedRef.current);
        return;
      }
      if (st.phase === 'roundover' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        if (!pausedRef.current) goNextRound();
        return;
      }
      const b = binding(e.code);
      if (!b) return;
      e.preventDefault();
      if (pausedRef.current || e.repeat) return;
      const next = doAction(b, performance.now());
      if (next > 0 && (b.action === 'left' || b.action === 'right')) {
        // 반대쪽을 누르고 있었으면 그쪽은 그만
        for (const [code, h] of held.current) if (h.player === b.player) held.current.delete(code);
        held.current.set(e.code, { player: b.player, action: b.action, next });
      }
    };
    const up = (e: KeyboardEvent) => {
      const b = binding(e.code);
      if (!b) return;
      if (b.action === 'soft') setSoftDrop(stateRef.current, b.player, false);
      held.current.delete(e.code);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [binding, doAction, goNextRound, setPaused]);

  // 화면 단추 (터치)
  const touch = (player: number, action: Action) => ({
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault();
      if (pausedRef.current) return;
      const next = doAction({ player, action }, performance.now());
      if (next > 0 && (action === 'left' || action === 'right')) held.current.set(`touch-${player}`, { player, action, next });
    },
    onPointerUp: () => {
      if (action === 'soft') setSoftDrop(stateRef.current, player, false);
      held.current.delete(`touch-${player}`);
    },
    onPointerLeave: () => {
      if (action === 'soft') setSoftDrop(stateRef.current, player, false);
      held.current.delete(`touch-${player}`);
    },
  });

  // ------------------------------------------------------------ 그리기
  const column = (p: PlayerState, i: number) => {
    const color = versus ? SIDE_COLORS[i] : '#ff8a3d';
    const icons = garbageIcons(p.pending);
    const danger = isDanger(p);
    return (
      <section key={i} className={`mp-col${p.phase === 'dead' ? ' mp-col-dead' : ''}`} style={{ '--side': color } as CSSProperties} data-testid={`mp-col-${i}`}>
        <header className="mp-col-head">
          <span className="mp-avatar">{p.name.slice(0, 1)}</span>
          <strong className="mp-name">{p.name}</strong>
          {p.kind !== 'human' && <span className="mp-tag">{p.kind === 'ai-easy' ? '컴퓨터·쉬움' : p.kind === 'ai-normal' ? '컴퓨터·보통' : '컴퓨터·어려움'}</span>}
          {versus && s.options.winsNeeded > 1 && (
            <span className="mp-wins" aria-label={`${s.wins[i]}판 이김`}>
              {Array.from({ length: s.options.winsNeeded }, (_, k) => (
                <i key={k} className={k < s.wins[i] ? 'mp-win-on' : ''}>
                  ★
                </i>
              ))}
            </span>
          )}
          <span className="mp-score" data-testid={`mp-score-${i}`}>
            {p.score.toLocaleString('ko-KR')}
          </span>
        </header>
        {versus && (
          <div className={`mp-tray${p.pending > 0 ? ' mp-tray-on' : ''}`} ref={(el) => {
              trayEls.current[i] = el;
            }} aria-label={`나에게 올 방해 젤리 ${p.pending}개`} data-testid={`mp-tray-${i}`}>
            {icons.map((size, k) => (
              <GarbageIcon key={`${k}-${size}`} size={size} />
            ))}
            {p.pending > 0 && <span className="mp-tray-n">{p.pending}</span>}
          </div>
        )}
        <div ref={(el) => {
            boardEls.current[i] = el;
          }} className="mp-board-wrap">
          <Board
            player={p}
            ghost={s.options.ghost && p.kind === 'human'}
            popups={popups.current[i] ?? []}
            danger={danger}
            shake={shakes.current[i] ? { id: shakes.current[i]!.id, power: shakes.current[i]!.power } : null}
            label={`${p.name}의 판`}
          />
          {p.phase === 'dead' && <div className="mp-ko">{s.roundWinner === null && versus ? '비김' : '앗, 꽉 찼어요!'}</div>}
        </div>
        {p.kind === 'human' && humans.length === 2 && touchPad(i)}
      </section>
    );
  };

  /** 화면 단추 한 줄 (터치 화면에서만 보인다) */
  const touchPad = (i: number, wide = false) => (
          <div className={`mp-touch${wide ? ' mp-touch-wide' : ''}`} aria-label="화면 단추">
            <button type="button" {...touch(i, 'left')} aria-label="왼쪽">
              ◀
            </button>
            <button type="button" {...touch(i, 'ccw')} aria-label="왼쪽으로 돌리기">
              ⟲
            </button>
            <button type="button" {...touch(i, 'soft')} aria-label="빨리 내리기">
              ▼
            </button>
            <button type="button" {...touch(i, 'drop')} aria-label="바로 떨어뜨리기">
              ⤓
            </button>
            <button type="button" {...touch(i, 'cw')} aria-label="오른쪽으로 돌리기">
              ⟳
            </button>
            <button type="button" {...touch(i, 'right')} aria-label="오른쪽">
              ▶
            </button>
          </div>
  );

  const nexts = (i: number) => {
    const [n1, n2] = upcoming(s, i, 2);
    return (
      <div className="mp-next" style={{ '--side': versus ? SIDE_COLORS[i] : '#ff8a3d' } as CSSProperties} data-testid={`mp-next-${i}`}>
        <span>다음</span>
        <PairPreview colors={n1} />
        <PairPreview colors={n2} small />
      </div>
    );
  };

  const seconds = Math.floor(s.time / 1000);
  const timeText = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const count = s.phase === 'countdown' ? 3 - Math.floor(s.phaseT / 1000) : 0;

  return (
    <div className={`mp-game mp-mode-${s.options.mode}`}>
      <div className="mp-main" ref={mainRef}>
        <div className="mp-arena">
          {column(s.players[0], 0)}
          <div className="mp-middle">
            {nexts(0)}
            <div className="mp-clock" aria-label="걸린 시간">
              <small>{versus ? `${s.round}판` : `레벨 ${s.players[0].level}`}</small>
              <b>{timeText}</b>
            </div>
            {versus ? (
              nexts(1)
            ) : (
              <div className="mp-solo-info">
                <span>
                  가장 긴 연쇄 <b>{s.players[0].stats.maxChain}</b>
                </span>
                <span>
                  터뜨린 젤리 <b>{s.players[0].stats.popped}</b>
                </span>
                <span>
                  최고 점수 <b>{records.soloScore.toLocaleString('ko-KR')}</b>
                </span>
              </div>
            )}
          </div>
          {versus && column(s.players[1], 1)}
        </div>

        {humans.length === 1 && touchPad(humans[0], true)}

        <div className="mp-orbs" aria-hidden="true">
          {orbs.current.map((o) => (
            <span
              key={o.id}
              className={`mp-orb${o.big ? ' mp-orb-big' : ''}`}
              style={{ '--x0': `${o.x0}px`, '--y0': `${o.y0}px`, '--x1': `${o.x1}px`, '--y1': `${o.y1}px` } as CSSProperties}
            />
          ))}
        </div>

        {count > 0 && !paused && (
          <div className="mp-overlay mp-count" key={count} aria-live="polite">
            <span>{count}</span>
          </div>
        )}
        {banner.current && !paused && (
          <div className="mp-overlay mp-count mp-go">
            <span>{banner.current.text}</span>
          </div>
        )}
        {s.phase === 'roundover' && !paused && (
          <div className="mp-overlay mp-round" data-testid="mp-round">
            <div className="mp-round-card">
              <h2>{roundText(s)}</h2>
              <p className="mp-round-score">
                <span style={{ color: SIDE_COLORS[0] }}>{s.players[0].name}</span> {s.wins[0]} : {s.wins[1]}{' '}
                <span style={{ color: SIDE_COLORS[1] }}>{s.players[1].name}</span>
              </p>
              <button type="button" className="btn btn-primary btn-large" onClick={goNextRound} data-testid="mp-next-round">
                다음 판 <kbd>Enter</kbd>
              </button>
            </div>
          </div>
        )}
        {paused && s.phase !== 'over' && (
          <div className="mp-overlay mp-pause" role="dialog" aria-modal="true" aria-label="잠깐 멈춤" data-testid="mp-pause">
            <div className="mp-round-card">
              <div className="mp-pause-art" aria-hidden="true">
                <PairPreview colors={[3, 4]} />
              </div>
              <h2>{resumed && s.time === initialState.time ? '하던 게임이에요' : '잠깐 쉬는 중'}</h2>
              <p>준비되면 계속해요. (P 또는 Esc)</p>
              <div className="result-actions">
                <button type="button" className="btn btn-primary btn-large" onClick={() => setPaused(false)} data-testid="mp-resume">
                  계속하기
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

      <Panel
        mode={s.options.mode}
        players={s.players.map((p) => ({ name: p.name, kind: p.kind, chain: p.stats.maxChain, sent: p.stats.garbageSent }))}
        humans={humans.length}
        phase={s.phase}
        paused={paused}
        round={s.round}
        records={records}
        settings={settings}
        onSettings={onSettings}
        onPause={() => s.phase !== 'over' && setPaused(!paused)}
        onNewGame={() => {
          if (s.phase === 'over' || window.confirm('지금 게임을 그만두고 새 게임을 할까요?')) onChangeSetup();
        }}
        onExit={onExit}
        extra={
          s.phase === 'over' && !showResult ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowResult(true)}>
              결과 다시 보기
            </button>
          ) : null
        }
      />

      {s.phase === 'over' && s.phaseT > 1200 && showResult && (
        <Results state={s} records={records} newRecord={newRecord} onRestart={onRestart} onChangeSetup={onChangeSetup} onExit={onExit} onClose={() => setShowResult(false)} />
      )}
    </div>
  );
}
