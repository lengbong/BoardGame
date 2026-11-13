import { useEffect, useRef, type CSSProperties } from 'react';
import { TeamCap } from './art';
import { inningLabel, isHomerun, resultShort, targetOf } from './rules';
import type { BaseballState, Guess, Side } from './types';

/** 방금 친 줄의 연출: start(ms) 뒤에 줄이 나타나고 lamp(ms) 간격으로 불이 켜진다 */
export interface RowFx {
  id: number;
  player: Side;
  index: number;
  start: number;
  lamp: number;
}

interface ScoreboardProps {
  state: BaseballState;
  /** 숨긴 숫자를 모두 보여 줄지 (끝났을 때) */
  reveal: boolean;
  fx: RowFx | null;
  /** 사람이 한 명이면 그 사람 편 (머리띠에 '나' 표시) */
  me: Side | null;
}

function Lamps({ count, lit, kind, delay, step }: { count: number; lit: number; kind: 's' | 'b'; delay: number | null; step: number }) {
  return (
    <span className={`bb-lamps bb-lamps-${kind}`} aria-hidden="true">
      <b>{kind === 's' ? 'S' : 'B'}</b>
      {Array.from({ length: count }, (_, i) => (
        <i
          key={i}
          className={i < lit ? 'bb-lamp bb-lamp-on' : 'bb-lamp'}
          style={i < lit && delay !== null ? ({ '--lamp-d': `${delay + i * step}ms` } as CSSProperties) : undefined}
        />
      ))}
    </span>
  );
}

function Row({ state, side, guess, index, fx }: { state: BaseballState; side: Side; guess: Guess; index: number; fx: RowFx | null }) {
  const length = state.options.length;
  const animate = fx && fx.player === side && fx.index === index ? fx : null;
  const homer = isHomerun(guess, length);
  const out = guess.strikes + guess.balls === 0;
  const start = animate?.start ?? 0;
  const lampStart = animate ? start + 180 : null;
  const step = animate?.lamp ?? 0;
  const label = resultShort(guess.strikes, guess.balls, length);
  const doneAt = (lampStart ?? 0) + (guess.strikes + guess.balls) * step;
  return (
    <li
      className={['bb-row', animate ? 'bb-row-new' : '', homer ? 'bb-row-homer' : '', out ? 'bb-row-out' : ''].join(' ')}
      style={animate ? ({ '--row-d': `${start}ms`, '--done-d': `${doneAt}ms` } as CSSProperties) : undefined}
      aria-label={`${inningLabel(state, side, index)}: ${guess.digits.join(' ')}, ${label}`}
    >
      <span className="bb-inning">{inningLabel(state, side, index)}</span>
      <span className="bb-digits">
        {guess.digits.map((d, i) => (
          <span key={i} className="bb-digit" style={animate ? ({ '--dig-d': `${start + i * 60}ms` } as CSSProperties) : undefined}>
            {d}
          </span>
        ))}
      </span>
      <span className="bb-lamp-box">
        <Lamps count={length} lit={guess.strikes} kind="s" delay={lampStart} step={step} />
        <Lamps count={length} lit={guess.balls} kind="b" delay={lampStart === null ? null : lampStart + guess.strikes * step} step={step} />
      </span>
      <span className={`bb-res${homer ? ' bb-res-homer' : out ? ' bb-res-out' : ''}`}>{homer ? 'HOME RUN' : out ? 'OUT' : label}</span>
    </li>
  );
}

function Column({ state, side, reveal, fx, me }: { state: BaseballState; side: Side; reveal: boolean; fx: RowFx | null; me: Side | null }) {
  const p = state.players[side];
  const solo = state.options.mode === 'solo';
  const target = state.players[targetOf(state, side)];
  const secret = target.secret;
  const listRef = useRef<HTMLOListElement>(null);
  const count = p.guesses.length;
  const batting = state.phase === 'play' && state.current === side;

  // 새 줄이 생기면 맨 아래로
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  return (
    <section className={`bb-col bb-col-${side}${batting ? ' bb-col-batting' : ''}`} data-testid={`bb-col-${side}`}>
      <header className="bb-col-head">
        <span className="bb-col-team">
          {solo ? '🧢' : <TeamCap side={side} size={30} />}
          <strong>{p.name}</strong>
          {me === side && !solo && <span className="bb-me">나</span>}
          {batting && <span className="bb-at-bat">공격 중</span>}
        </span>
        <span className="bb-col-target">
          <small>{solo ? `${target.name}가 숨긴 숫자` : `${target.name}의 숫자`}</small>
          <span className="bb-secret">
            {Array.from({ length: state.options.length }, (_, i) => (
              <span key={i} className={reveal && secret ? 'bb-secret-digit bb-secret-open' : 'bb-secret-digit'} style={{ '--i': i } as CSSProperties}>
                {reveal && secret ? secret[i] : '?'}
              </span>
            ))}
          </span>
        </span>
      </header>
      <ol className="bb-rows" ref={listRef}>
        {p.guesses.map((g, i) => (
          <Row key={i} state={state} side={side} guess={g} index={i} fx={fx} />
        ))}
        {count === 0 && <li className="bb-row-empty">{state.phase === 'secret' ? '비밀 숫자를 정하는 중…' : '아직 친 숫자가 없어요'}</li>}
      </ol>
    </section>
  );
}

/** 야구장 전광판: 편마다 친 숫자와 스트라이크·볼 불 */
export function Scoreboard({ state, reveal, fx, me }: ScoreboardProps) {
  const sides: Side[] = state.options.mode === 'solo' ? [0] : [0, 1];
  return (
    <div className={`bb-board bb-board-${sides.length === 1 ? 'solo' : 'duel'}`} data-testid="bb-board">
      <div className="bb-board-title" aria-hidden="true">
        <span className="bb-bulbs" />
        <span>⚾ 숫자야구 전광판</span>
        <span className="bb-bulbs" />
      </div>
      <div className="bb-cols">
        {sides.map((side) => (
          <Column key={side} state={state} side={side} reveal={reveal} fx={fx} me={me} />
        ))}
      </div>
      <p className="bb-legend" aria-hidden="true">
        <span>
          <i className="bb-lamp bb-lamp-on bb-lamp-s" /> S 스트라이크: 숫자와 자리가 맞음
        </span>
        <span>
          <i className="bb-lamp bb-lamp-on bb-lamp-b" /> B 볼: 숫자만 맞음
        </span>
        <span>
          <b className="bb-legend-out">OUT</b> 하나도 없음
        </span>
      </p>
    </div>
  );
}
