import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ShapeIcon } from '../../components/shapes';
import { withJosa } from '../../lib/korean';
import { sfx } from '../../lib/sound';
import { useMusic } from '../../lib/useMusic';
import { useTimers } from '../../lib/useTimers';
import { SEAT_COLORS } from '../common/players';
import type { GameSettings } from '../common/settings';
import { decideAction } from './ai';
import { Board, type Toast } from './Board';
import { CardFace } from './CardArt';
import { Panel, SEAT_SHAPES } from './Panel';
import { GameOver } from './Results';
import { applyAction, canFlip, playerName } from './rules';
import { MEMORY_SONG } from './song';
import { memorySfx } from './sounds';
import { MEMORY_DELAYS, PEEK_MS, clearSavedMemoryGame, saveMemoryGame } from './storage';
import { pictureName } from './themes';
import type { MemoryAction, MemorySetup, MemoryState } from './types';

interface MemoryGameProps {
  setup: MemorySetup;
  initialState: MemoryState;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

/** 짝을 맞힌 카드가 내 자리로 날아가는 연출 (화면 좌표) */
interface Flyer {
  id: number;
  pic: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tx: number;
  ty: number;
  s: number;
  rot: number;
  delay: number;
}

const EMPTY: ReadonlySet<number> = new Set();
let seq = 1;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };

export function MemoryGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: MemoryGameProps) {
  const [game, setGame] = useState<MemoryState>(initialState);
  /** 연출이 끝날 때까지 입력을 막는다 */
  const [anim, setAnim] = useState<{ until: number } | null>(null);
  const [holding, setHolding] = useState<ReadonlySet<number>>(EMPTY);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [pileLag, setPileLag] = useState<number[]>(() => initialState.players.map(() => 0));
  const [bump, setBump] = useState<Record<number, number>>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const [cursor, setCursor] = useState(() => initialState.cards.find((c) => c.matchedBy === null)?.id ?? 0);
  const [dealing, setDealing] = useState(false);
  const [covering, setCovering] = useState(false);
  const [peekEnd, setPeekEnd] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pileRefs = useRef<Record<number, HTMLElement | null>>({});
  const prevGame = useRef<MemoryState | null>(null);
  const mismatchAt = useRef(0);
  const later = useTimers();
  const reduced = useMemo(prefersReducedMotion, []);
  const delays = MEMORY_DELAYS[settings.speed];
  const flipMs = reduced ? 0 : delays.flip;
  const fx = delays.fx && !reduced;
  const dealMs = 380 + initialState.cards.length * 16;

  useMusic(MEMORY_SONG, settings.music);

  const locked = anim !== null;
  const over = game.phase === 'gameover';
  const current = game.players[game.current];
  const color = SEAT_COLORS[current.seat];
  const humanTurn = game.phase === 'play' && current.kind === 'human';
  const interactive = humanTurn && !locked;
  const humans = game.players.filter((p) => p.kind === 'human').length;

  const perform = useCallback((action: MemoryAction) => setGame((g) => applyAction(g, action)), []);

  // 연출 시간이 지나면 입력을 다시 받는다.
  useEffect(() => {
    if (!anim) return;
    const t = window.setTimeout(() => setAnim(null), Math.max(0, anim.until - performance.now()));
    return () => window.clearTimeout(t);
  }, [anim]);

  /** 상태가 바뀔 때마다: 저장 + 마지막 행동의 연출 */
  useLayoutEffect(() => {
    if (game.phase === 'gameover') clearSavedMemoryGame();
    else saveMemoryGame(setup, game);

    const before = prevGame.current;
    prevGame.current = game;
    if (before === game) return;

    let total = 0;
    const sound = (play: () => void, at: number) => (at <= 0 ? play() : later(play, at));
    const showToast = (text: string, tone: Toast['tone'], at: number) => {
      if (!fx) return;
      const t: Toast = { id: seq++, text, tone };
      later(() => {
        setToast(t);
        later(() => setToast((c) => (c && c.id === t.id ? null : c)), 1300);
      }, at);
    };

    for (const e of game.events) {
      switch (e.type) {
        case 'deal': {
          if (before !== null) break;
          sfx.shuffle();
          if (fx) {
            setDealing(true);
            total = Math.max(total, dealMs);
          }
          break;
        }
        case 'flip':
          memorySfx.flip();
          break;
        case 'match': {
          const [a, b] = e.cardIds;
          const player = e.player;
          const hold = flipMs + delays.hold;
          sound(() => memorySfx.match(Math.max(1, game.streak)), Math.max(0, flipMs - 60));
          showToast(e.again ? `${pictureName(e.pic)} 짝! 한 번 더!` : `${pictureName(e.pic)} 짝!`, 'match', flipMs);
          setHolding(new Set([a, b]));
          if (fx) {
            setPileLag((l) => l.map((v, i) => (i === player ? v + 1 : v)));
            later(() => {
              const pile = pileRefs.current[player]?.querySelector('.mm-pile') ?? pileRefs.current[player];
              const target = pile?.getBoundingClientRect();
              const made: Flyer[] = [];
              [a, b].forEach((id, k) => {
                const el = cardRefs.current[id];
                if (!el || !target) return;
                const r = el.getBoundingClientRect();
                const tx = target.right + 6 - (r.left + r.width / 2);
                const ty = target.top + target.height / 2 - (r.top + r.height / 2);
                made.push({ id: seq++, pic: game.cards[id].pic, x: r.left, y: r.top, w: r.width, h: r.height, tx, ty, s: 24 / r.width, rot: k ? 16 : -12, delay: k * 70 });
              });
              setHolding(EMPTY);
              setFlyers((f) => [...f, ...made]);
              later(() => {
                setFlyers((f) => f.filter((x) => !made.includes(x)));
                setPileLag((l) => l.map((v, i) => (i === player ? Math.max(0, v - 1) : v)));
                setBump((m) => ({ ...m, [player]: (m[player] ?? 0) + 1 }));
                memorySfx.collect();
              }, delays.fly + 80);
            }, hold);
          } else {
            later(() => setHolding(EMPTY), hold + 40);
          }
          total = Math.max(total, hold + 60);
          break;
        }
        case 'mismatch':
          mismatchAt.current = performance.now();
          sound(() => memorySfx.mismatch(), flipMs + 40);
          break;
        case 'hide':
          memorySfx.flip();
          break;
        case 'turn': {
          const p = game.players[e.player];
          if (p.kind === 'human' && game.phase === 'play') sound(() => sfx.turn(), Math.max(total, flipMs) + 80);
          if (fx && humans >= 2 && p.kind === 'human') showToast(`${playerName(p)} 차례예요`, 'info', Math.max(total, flipMs));
          break;
        }
        case 'peekEnd': {
          memorySfx.coverAll();
          const dur = flipMs + game.cards.length * 14 + 80;
          if (!reduced) {
            setCovering(true);
            later(() => setCovering(false), dur);
          }
          total = Math.max(total, dur);
          break;
        }
        case 'end': {
          // 마지막 짝이 날아간 뒤에 축하 소리와 결과 화면
          const tail = fx ? delays.fly + 300 : 200;
          sound(() => sfx.win(), total + tail - 180);
          total += tail;
          break;
        }
      }
    }
    if (total > 0) setAnim({ until: performance.now() + total });
  }, [game, setup, delays, flipMs, fx, reduced, humans, dealMs, later]);

  // 카드 펼치기 연출이 끝나면 표시를 지운다. (처음 그릴 때 시작하므로 따로 effect로 관리한다)
  useEffect(() => {
    if (!dealing) return;
    const t = window.setTimeout(() => setDealing(false), dealMs);
    return () => window.clearTimeout(t);
  }, [dealing, dealMs]);

  // 처음에 모두 보여 주기: 시간이 지나면 저절로 덮는다.
  useEffect(() => {
    if (game.phase !== 'peek') {
      setPeekEnd(null);
      return;
    }
    const ms = PEEK_MS[game.options.size] * delays.peek;
    setPeekEnd(Date.now() + ms);
    setNow(Date.now());
    const t = window.setTimeout(() => perform({ type: 'startPlay' }), ms);
    const iv = window.setInterval(() => setNow(Date.now()), 250);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(iv);
    };
  }, [game.phase, game.options.size, delays.peek, perform]);

  // 짝이 아니면 잠깐 보여 준 뒤 덮는다.
  useEffect(() => {
    if (game.phase !== 'mismatch') return;
    const t = window.setTimeout(() => perform({ type: 'hide' }), flipMs + delays.hide);
    return () => window.clearTimeout(t);
  }, [game, flipMs, delays.hide, perform]);

  // 컴퓨터 차례: 생각하는 시간을 두고, 그 순간의 최신 상태를 보고 한 장씩 뒤집는다.
  useEffect(() => {
    if (locked || game.phase !== 'play' || current.kind === 'human') return;
    const wait = game.faceUp.length === 0 ? delays.think : Math.round(delays.think * 0.7) + flipMs;
    const t = window.setTimeout(() => {
      setGame((g) => {
        const p = g.players[g.current];
        if (g.phase !== 'play' || p.kind === 'human') return g;
        return applyAction(g, decideAction(g, p.kind));
      });
    }, wait);
    return () => window.clearTimeout(t);
  }, [game, locked, current.kind, delays.think, flipMs]);

  /** 짝이 아닌 두 장을 보는 중에 누르면 바로 덮고 넘어간다. */
  const skipMismatch = useCallback(() => {
    if (game.phase !== 'mismatch' || humans === 0) return;
    if (performance.now() - mismatchAt.current < flipMs + 200) return;
    perform({ type: 'hide' });
  }, [game.phase, humans, flipMs, perform]);

  const onCard = (id: number) => {
    setCursor(id);
    if (game.phase === 'mismatch') {
      skipMismatch();
      return;
    }
    if (!interactive) return;
    if (!canFlip(game, id)) {
      if (game.cards[id]?.matchedBy === null) sfx.noMove();
      return;
    }
    perform({ type: 'flip', cardId: id });
  };

  // 키보드: 화살표로 고르기, Enter·Space로 뒤집기 (보여 주기 중이면 시작, 짝이 아닐 때는 넘어가기)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if (e.altKey || e.ctrlKey || e.metaKey || over) return;
      const isCard = !!target?.classList.contains('mm-card');
      if (target?.tagName === 'BUTTON' && !isCard) return;
      const move = ARROWS[e.key];
      if (move) {
        e.preventDefault();
        const { rows, cols } = game;
        const r = (Math.floor(cursor / cols) + move[0] + rows) % rows;
        const c = ((cursor % cols) + move[1] + cols) % cols;
        const next = r * cols + c;
        setCursor(next);
        cardRefs.current[next]?.focus();
        return;
      }
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (game.phase === 'peek') {
        e.preventDefault();
        perform({ type: 'startPlay' });
      } else if (!isCard) {
        // 카드에 포커스가 있으면 버튼이 알아서 눌린다.
        e.preventDefault();
        if (game.phase === 'mismatch') skipMismatch();
        else {
          onCard(cursor);
          cardRefs.current[cursor]?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // 안내 문구
  const name = playerName(current);
  const peekLeft = peekEnd ? Math.max(1, Math.ceil((peekEnd - now) / 1000)) : 0;
  let hint: string;
  let short: string;
  if (over) {
    hint = '게임이 끝났어요!';
    short = '끝!';
  } else if (game.phase === 'peek') {
    hint = '카드를 잘 봐 두세요! 곧 모두 뒤집혀요.';
    short = `잘 봐 두세요! ${peekLeft}초`;
  } else if (game.phase === 'mismatch') {
    hint = humans > 0 ? '짝이 아니에요. 어디에 무엇이 있는지 기억해 두세요! (카드를 누르면 바로 넘어가요)' : '짝이 아니에요. 잘 기억해 두세요!';
    short = '짝이 아니에요';
  } else if (!humanTurn) {
    hint = `${withJosa(name, '이/가')} 생각 중이에요…`;
    short = game.faceUp.length === 0 ? '생각 중…' : '한 장 더…';
  } else if (game.faceUp.length === 0) {
    hint = game.streak > 0 ? '한 번 더! 카드 두 장을 뒤집어 같은 그림을 찾으세요.' : '카드 두 장을 뒤집어 같은 그림을 찾으세요.';
    short = game.streak > 0 ? '한 번 더! 첫 번째 카드' : '첫 번째 카드를 골라요';
  } else {
    hint = `${pictureName(game.cards[game.faceUp[0]].pic)}! 짝은 어디 있었을까요? 한 장 더 뒤집어요.`;
    short = '두 번째 카드를 골라요';
  }

  return (
    <div className="mm-game" data-speed={settings.speed}>
      <div className="mm-main">
        <div className={`mm-turnbar${over ? ' is-over' : ''}`} style={{ '--pc': color.main, '--pl': color.light } as CSSProperties}>
          <span className="mm-turnbar-who" key={game.turn}>
            <ShapeIcon shape={SEAT_SHAPES[current.seat]} color={color.main} size={18} />
            <strong>{over ? '게임 끝' : name}</strong>
            {!over && <span>{game.phase === 'peek' ? '먼저 시작' : '차례'}</span>}
            {!over && current.kind !== 'human' && <span className="tag">컴퓨터</span>}
          </span>
          {!over && game.phase !== 'peek' && (
            <span className="mm-flipdots" aria-label={`이번에 뒤집은 카드 ${game.faceUp.length}장`}>
              {[0, 1].map((k) => (
                <span key={k} className={k < game.faceUp.length ? 'is-on' : ''} />
              ))}
            </span>
          )}
          <span className="mm-turnbar-hint">{short}</span>
          {game.phase === 'peek' ? (
            <button type="button" className="btn btn-primary btn-small" onClick={() => perform({ type: 'startPlay' })} data-testid="mm-peek-done">
              다 봤어요 <kbd>Enter</kbd>
            </button>
          ) : (
            humanTurn && (
              <span className="mm-keys">
                <kbd>←↑↓→</kbd> 고르기 <kbd>Enter</kbd> 뒤집기
              </span>
            )
          )}
        </div>
        <Board
          state={game}
          holding={holding}
          interactive={interactive}
          cursor={cursor}
          cardRefs={cardRefs}
          dealing={dealing}
          covering={covering}
          flipMs={flipMs}
          turnColor={over ? 'var(--border)' : color.main}
          toast={toast}
          onCard={onCard}
          onCursor={setCursor}
        />
      </div>

      <Panel
        state={game}
        hint={hint}
        pileLag={pileLag}
        pileRefs={pileRefs}
        bump={bump}
        settings={settings}
        onSettings={onSettings}
        onNewGame={() => {
          if (over || window.confirm('지금 게임을 그만두고 새 게임을 할까요?')) onChangeSetup();
        }}
        onExit={onExit}
      />

      {flyers.map((f) => (
        <div
          key={f.id}
          className="mm-flyer"
          style={
            {
              left: f.x,
              top: f.y,
              width: f.w,
              height: f.h,
              '--tx': `${f.tx}px`,
              '--ty': `${f.ty}px`,
              '--s': f.s,
              '--rot': `${f.rot}deg`,
              animationDuration: `${delays.fly}ms`,
              animationDelay: `${f.delay}ms`,
            } as CSSProperties
          }
          aria-hidden="true"
        >
          <CardFace pic={f.pic} showName={false} />
        </div>
      ))}

      {over && !locked && flyers.length === 0 && <GameOver state={game} onRestart={onRestart} onChangeSetup={onChangeSetup} onExit={onExit} />}
    </div>
  );
}
