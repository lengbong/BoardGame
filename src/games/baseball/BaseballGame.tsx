import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { PassScreen } from '../../components/PassScreen';
import { withJosa } from '../../lib/korean';
import { sfx } from '../../lib/sound';
import { useMusic } from '../../lib/useMusic';
import { useTimers } from '../../lib/useTimers';
import type { GameSettings } from '../common/settings';
import { decideGuess } from './ai';
import { BallArt, TEAM_COLORS } from './art';
import { BatBox } from './BatBox';
import { Panel } from './Panel';
import { Results } from './Results';
import {
  applyAction,
  candidatesFor,
  codeText,
  conflictsWith,
  digitPool,
  inningLabel,
  randomCode,
  resultText,
} from './rules';
import { Scoreboard, type RowFx } from './Scoreboard';
import { BASEBALL_SONG } from './song';
import { bbSound } from './sounds';
import { BASEBALL_DELAYS, clearSavedBaseballGame, loadRecords, recordKey, saveBaseballGame, saveRecord } from './storage';
import type { BaseballSetup, BaseballState, DuelAiLevel, NoteMark, Side } from './types';
import { soloOutcome, useRecordOutcome } from '../../lib/stats';

interface BaseballGameProps {
  setup: BaseballSetup;
  initialState: BaseballState;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
}

type PitchKind = 'hit' | 'miss' | 'homer';
type BannerTone = 'count' | 'out' | 'homer' | 'last' | 'start';

const SOLO_COLOR = '#2f8f4e';

/** 후보 목록은 이만큼 이하일 때만 보여 준다 */
const SHOW_CANDIDATES = 12;

export function BaseballGame({ setup, initialState, settings, onSettings, onRestart, onChangeSetup, onExit }: BaseballGameProps) {
  const [game, setGame] = useState<BaseballState>(initialState);
  const [entry, setEntry] = useState<number[]>([]);
  /** 연출이 끝나는 시각 (그때까지 입력과 컴퓨터를 멈춘다) */
  const [anim, setAnim] = useState<number | null>(null);
  const [rowFx, setRowFx] = useState<RowFx | null>(null);
  const [pitch, setPitch] = useState<{ id: number; kind: PitchKind; ms: number } | null>(null);
  const [banner, setBanner] = useState<{ id: number; text: string; tone: BannerTone } | null>(null);
  /** 사람 둘이 비밀 숫자를 정할 때 지금 화면을 본 사람 */
  const [revealed, setRevealed] = useState<Side | null>(null);
  const [peek, setPeek] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [showCands, setShowCands] = useState(false);
  const [showResult, setShowResult] = useState(true);
  const [records, setRecords] = useState(loadRecords);
  const [newRecord, setNewRecord] = useState(false);
  const prevGame = useRef<BaseballState | null>(null);
  const later = useTimers();
  const delays = BASEBALL_DELAYS[settings.speed];
  useMusic(BASEBALL_SONG, settings.music);
  useRecordOutcome('baseball', game.phase === 'gameover', () => game.options.mode === 'solo' ? (game.gaveUp ? 'loss' : 'win') : soloOutcome(game.players.map((p) => p.kind), [game.winner]));

  const opts = game.options;
  const len = opts.length;
  const solo = opts.mode === 'solo';
  const pool = digitPool(opts.zero);
  const humanSides = ([0, 1] as Side[]).filter((i) => game.players[i].kind === 'human' && !(solo && i === 1));
  const single: Side | null = humanSides.length === 1 ? humanSides[0] : null;
  const hotseat = humanSides.length === 2;
  const locked = anim !== null;
  const current = game.players[game.current];
  const setter = game.phase === 'secret' ? game.setting : null;
  const needPass = hotseat && setter !== null && revealed !== setter;
  const humanTurn = game.phase === 'play' && current.kind === 'human';
  const canInput = (setter !== null && !needPass) || (humanTurn && !locked);
  /** 타석(숫자 칸)을 보여 줄 사람 */
  const boxOwner: Side | null = game.phase === 'secret' ? (needPass ? null : setter) : humanTurn ? game.current : game.phase === 'play' ? single : null;
  const colorOf = (side: Side) => (solo ? SOLO_COLOR : TEAM_COLORS[side].main);
  const best = records[recordKey(opts)];

  // 차례가 바뀌면 넣던 숫자와 안내를 지운다.
  const turnKey = `${game.phase}-${game.setting}-${game.current}-${game.players[0].guesses.length}-${game.players[1].guesses.length}`;
  useEffect(() => {
    setEntry([]);
    setNotice(null);
    setShowCands(false);
    setPeek(false);
  }, [turnKey]);

  // 연출 시간이 지나면 다시 움직인다.
  useEffect(() => {
    if (anim === null) return;
    const t = window.setTimeout(() => setAnim(null), Math.max(0, anim - performance.now()));
    return () => window.clearTimeout(t);
  }, [anim]);

  /** 상태가 바뀔 때마다: 저장 + 마지막 행동의 연출과 소리 */
  useLayoutEffect(() => {
    if (game.phase === 'gameover') clearSavedBaseballGame();
    else saveBaseballGame(setup, game);
    const before = prevGame.current;
    prevGame.current = game;
    if (!before || before === game) return;

    const at = (fn: () => void, ms: number) => (ms <= 0 ? fn() : later(fn, ms));
    const showBanner = (id: number, text: string, tone: BannerTone, ms: number, life: number) => {
      if (!delays.fx) return;
      at(() => setBanner({ id, text, tone }), ms);
      later(() => setBanner((b) => (b && b.id === id ? null : b)), ms + life);
    };
    let total = 0;
    for (const e of game.events) {
      switch (e.type) {
        case 'secret':
          bbSound.lock();
          break;
        case 'start':
          showBanner(e.id, solo ? '⚾ 맞혀 보세요!' : '⚾ 플레이 볼!', 'start', 120, 1100);
          at(() => sfx.turn(), 120);
          total = Math.max(total, delays.fx ? 900 : 0);
          break;
        case 'guess': {
          const homer = e.strikes === len;
          const out = e.strikes + e.balls === 0;
          const kind: PitchKind = homer ? 'homer' : out ? 'miss' : 'hit';
          const ms = delays.pitch;
          if (ms > 0) {
            setPitch({ id: e.id, kind, ms });
            later(() => setPitch((p) => (p && p.id === e.id ? null : p)), ms + (homer ? 1100 : 500));
            bbSound.pitch();
          }
          at(() => (homer ? bbSound.homerun() : out ? bbSound.mitt() : bbSound.bat()), ms);
          setRowFx({ id: e.id, player: e.player, index: e.index, start: ms, lamp: delays.lamp });
          const lampStart = ms + 180;
          for (let k = 0; k < e.strikes; k++) at(() => bbSound.strikeLamp(k), lampStart + k * delays.lamp);
          for (let k = 0; k < e.balls; k++) at(() => bbSound.ballLamp(k), lampStart + (e.strikes + k) * delays.lamp);
          const done = lampStart + (e.strikes + e.balls) * delays.lamp;
          if (out) at(() => bbSound.out(), done + 60);
          const text = homer ? '홈런!!!' : resultText(e.strikes, e.balls, len);
          showBanner(e.id, text, homer ? 'homer' : out ? 'out' : 'count', done, delays.banner + (homer ? 500 : 0));
          total = done + (delays.fx ? delays.banner + (homer ? 500 : 0) : 150);
          break;
        }
        case 'lastChance':
          at(() => bbSound.lastChance(), total);
          showBanner(e.id, `🔥 ${game.players[e.player].name} 마지막 기회!`, 'last', total, 1300);
          total += delays.fx ? 1300 : 200;
          break;
        case 'end': {
          const happy = solo ? !game.gaveUp : e.winner !== null;
          at(() => (happy ? bbSound.win() : bbSound.draw()), total + 80);
          total += delays.fx ? 700 : 200;
          if (solo && e.winner === 0) {
            setNewRecord(saveRecord(game.options, game.players[0].guesses.length));
            setRecords(loadRecords());
          }
          break;
        }
        default:
          break;
      }
    }
    // 사람 둘 이상이 번갈아 할 때, 사람 차례가 오면 알림음
    if (!solo && game.phase === 'play' && game.players[game.current].kind === 'human' && before.phase === 'play' && before.current !== game.current) {
      at(() => sfx.turn(), total + 60);
    }
    if (total > 0) setAnim(performance.now() + total);
  }, [game, setup, delays, len, solo, later]);

  // 컴퓨터 차례: 생각하는 시간을 두고, 그 순간의 최신 상태를 보고 친다.
  useEffect(() => {
    if (locked || game.phase !== 'play' || current.kind === 'human') return;
    const t = window.setTimeout(() => {
      setGame((g) => {
        const p = g.players[g.current];
        if (g.phase !== 'play' || p.kind === 'human') return g;
        return applyAction(g, { type: 'guess', digits: decideGuess(g, p.kind as DuelAiLevel) });
      });
    }, delays.think);
    return () => window.clearTimeout(t);
  }, [game, locked, current.kind, delays.think]);

  // ------------------------------------------------------------ 입력
  const fail = useCallback((text: string) => {
    setNotice(text);
    setShake((n) => n + 1);
    bbSound.error();
  }, []);

  const pressDigit = (d: number) => {
    if (!canInput || entry.length >= len) return;
    if (!pool.includes(d)) return fail('0은 쓸 수 없어요. 1~9만 써요.');
    if (entry.includes(d)) return fail(`${d}은(는) 벌써 넣었어요. 같은 숫자는 한 번만 써요.`);
    bbSound.key();
    setNotice(null);
    setEntry([...entry, d]);
  };

  const back = () => {
    if (!canInput || entry.length === 0) return;
    bbSound.erase();
    setNotice(null);
    setEntry(entry.slice(0, -1));
  };

  const clear = () => {
    if (!canInput || entry.length === 0) return;
    bbSound.erase();
    setNotice(null);
    setEntry([]);
  };

  const submit = () => {
    if (!canInput || entry.length !== len) return;
    const digits = entry;
    if (setter !== null) {
      setGame((g) => (g.phase === 'secret' && g.setting === setter ? applyAction(g, { type: 'secret', player: setter, digits }) : g));
    } else {
      setGame((g) => (g.phase === 'play' && g.players[g.current].kind === 'human' ? applyAction(g, { type: 'guess', digits }) : g));
    }
    setEntry([]);
  };

  const noteOwner: Side | null = game.phase === 'play' && boxOwner !== null ? boxOwner : null;
  const toggleNote = (d: number) => {
    if (noteOwner === null || !pool.includes(d)) return;
    const mark = ((game.players[noteOwner].notes[d] + 1) % 3) as NoteMark;
    bbSound.note();
    setGame((g) => applyAction(g, { type: 'note', player: noteOwner, digit: d, mark }));
  };

  const giveUp = () => {
    if (game.phase !== 'play' || !solo) return;
    if (window.confirm('숨긴 숫자를 보고 이번 판을 끝낼까요?')) setGame((g) => applyAction(g, { type: 'giveUp' }));
  };

  // 키보드: 숫자 넣기, Backspace 지우기, Esc 모두 지우기, Enter 치기, Shift+숫자 메모
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      if (needPass || e.ctrlKey || e.metaKey || e.altKey) return;
      const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
      const digit = m ? Number(m[1]) : /^[0-9]$/.test(e.key) ? Number(e.key) : null;
      if (digit !== null) {
        e.preventDefault();
        if (e.shiftKey) toggleNote(digit);
        else pressDigit(digit);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        back();
      } else if (e.key === 'Escape') {
        clear();
      } else if (e.key === 'Enter' && t?.tagName !== 'BUTTON') {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ------------------------------------------------------------ 추리 도우미
  const ownerGuesses = noteOwner !== null ? game.players[noteOwner].guesses : null;
  const candidates = useMemo(() => (opts.helper && ownerGuesses ? candidatesFor(ownerGuesses, opts) : null), [opts, ownerGuesses]);

  let entryNotice = notice;
  if (!entryNotice && ownerGuesses && entry.length === len && game.phase === 'play') {
    const again = ownerGuesses.findIndex((g) => g.digits.join() === entry.join());
    if (again >= 0) entryNotice = `${inningLabel(game, noteOwner!, again)}에 벌써 쳐 본 숫자예요.`;
  }

  let helper: ReactNode = null;
  if (candidates && ownerGuesses && noteOwner !== null) {
    const conflicts = entry.length === len ? conflictsWith(entry, ownerGuesses) : [];
    const first = conflicts[0];
    helper = (
      <div className="bb-helper" data-testid="bb-helper">
        <p className="bb-helper-count">
          🔎 답일 수 있는 숫자 <b data-testid="bb-cands">{candidates.length}</b>개
          {candidates.length <= SHOW_CANDIDATES && candidates.length > 1 && (
            <button type="button" className="btn btn-small" onClick={() => setShowCands((v) => !v)}>
              {showCands ? '숨기기' : '보기'}
            </button>
          )}
        </p>
        {showCands && candidates.length <= SHOW_CANDIDATES && <p className="bb-helper-list">{candidates.map((c) => c.join('')).join(' · ')}</p>}
        {first !== undefined && (
          <p className="bb-helper-warn">
            ⚠ {inningLabel(game, noteOwner, first)} 결과({codeText(ownerGuesses[first].digits)} →{' '}
            {resultText(ownerGuesses[first].strikes, ownerGuesses[first].balls, len)})와 맞지 않는 숫자예요.
            {conflicts.length > 1 && ` (외 ${conflicts.length - 1}개)`}
          </p>
        )}
        {entry.length === len && conflicts.length === 0 && ownerGuesses.length > 0 && <p className="bb-helper-ok">👍 지금까지의 결과와 모두 맞아요.</p>}
      </div>
    );
  }

  // ------------------------------------------------------------ 안내 문구
  let hint: string;
  if (game.phase === 'secret') {
    const name = game.players[setter ?? 0].name;
    hint = needPass ? `${name}에게 화면을 넘겨 주세요.` : `${name}: 상대가 보지 않게 ${len}자리 숫자를 정하세요.`;
  } else if (game.phase === 'gameover') {
    if (solo) hint = game.gaveUp ? `답은 ${codeText(game.players[1].secret ?? [])}였어요.` : `${game.players[0].guesses.length}번 만에 맞혔어요!`;
    else hint = game.winner === null ? '무승부! 둘 다 같은 횟수에 맞혔어요.' : `${game.players[game.winner].name} 승리!`;
  } else if (locked) {
    hint = '공이 날아가요…';
  } else if (!humanTurn) {
    hint = `${withJosa(current.name, '이/가')} 생각하고 있어요…`;
  } else if (solo) {
    hint = '숫자를 넣고 치기! 스트라이크·볼을 보고 답을 좁혀 가요.';
  } else {
    hint = game.lastChance ? `${current.name}: 마지막 기회! 맞히면 무승부예요.` : `${current.name} 차례예요. 상대 숫자를 추리해서 쳐 보세요!`;
  }

  // ------------------------------------------------------------ 타석
  let batBox: ReactNode = null;
  if (boxOwner !== null) {
    const owner = game.players[boxOwner];
    const myTurn = game.phase === 'secret' || (humanTurn && game.current === boxOwner);
    let title: ReactNode;
    let extra: ReactNode = null;
    if (game.phase === 'secret') {
      title = `🤫 ${owner.name}: 비밀 숫자 정하기`;
      extra = (
        <button
          type="button"
          className="btn btn-small"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            bbSound.key();
            setNotice(null);
            setEntry(randomCode(opts));
          }}
          data-testid="bb-random"
        >
          🎲 아무 숫자나
        </button>
      );
    } else {
      const n = owner.guesses.length;
      title = myTurn
        ? solo
          ? `${n + 1}번째 · 숫자를 맞혀 보세요`
          : `${game.lastChance ? '🔥 마지막 기회! ' : ''}${inningLabel(game, boxOwner, n)} · ${owner.name} 공격`
        : `${current.name} 공격 중… 기다려요`;
      if (!solo && owner.secret) {
        extra =
          single !== null ? (
            <span className="bb-my-secret">
              내 숫자 <b>{codeText(owner.secret)}</b>
            </span>
          ) : (
            <button
              type="button"
              className="btn btn-small bb-peek"
              onPointerDown={() => setPeek(true)}
              onPointerUp={() => setPeek(false)}
              onPointerLeave={() => setPeek(false)}
              onPointerCancel={() => setPeek(false)}
              onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && setPeek(true)}
              onKeyUp={() => setPeek(false)}
              onBlur={() => setPeek(false)}
              title="누르고 있는 동안만 보여요"
            >
              👁 내 숫자 {peek ? <b>{codeText(owner.secret)}</b> : <span>꾹 누르기</span>}
            </button>
          );
      }
    }
    batBox = (
      <BatBox
        title={title}
        color={colorOf(boxOwner)}
        length={len}
        zero={opts.zero}
        entry={entry}
        enabled={canInput && myTurn}
        submitLabel={game.phase === 'secret' ? '🔒 정하기' : '⚾ 치기!'}
        onDigit={pressDigit}
        onBack={back}
        onClear={clear}
        onSubmit={submit}
        notes={game.phase === 'play' ? owner.notes : null}
        onNote={toggleNote}
        notice={entryNotice}
        helper={game.phase === 'play' ? helper : null}
        extra={extra}
        shake={shake}
      />
    );
  } else if (game.phase === 'play') {
    batBox = (
      <section className="bb-bat bb-bat-watch" style={{ '--team': colorOf(game.current) } as CSSProperties}>
        <p>
          <BallArt size={28} className="bb-watch-ball" /> {hint}
        </p>
      </section>
    );
  }

  const lastLog = game.log.at(-1)?.text ?? '';

  return (
    <div className="bb-game">
      <div className="bb-main">
        <Scoreboard state={game} reveal={game.phase === 'gameover'} fx={rowFx} me={single} />
        {batBox}

        {pitch && (
          <div key={pitch.id} className={`bb-pitch bb-pitch-${pitch.kind}`} style={{ '--pitch': `${pitch.ms}ms` } as CSSProperties} aria-hidden="true">
            <span className="bb-pitch-ball">
              <BallArt size={44} />
            </span>
            <span className="bb-pitch-pow">{pitch.kind === 'miss' ? '퍽!' : '딱!'}</span>
          </div>
        )}
        {banner && (
          <div key={banner.id} className={`bb-banner bb-banner-${banner.tone}`} aria-hidden="true">
            {banner.text}
          </div>
        )}
        {needPass && setter !== null && (
          <PassScreen
            name={game.players[setter].name}
            color={colorOf(setter)}
            what="내 화면"
            note="상대가 보지 않게 몰래 비밀 숫자를 정해요."
            onReveal={() => setRevealed(setter)}
          />
        )}
        <p className="bb-sr" aria-live="polite">
          {lastLog}
        </p>
      </div>

      <Panel
        state={game}
        hint={hint}
        thinking={game.phase === 'play' && !humanTurn && !locked}
        best={best}
        settings={settings}
        onSettings={onSettings}
        onGiveUp={giveUp}
        onNewGame={() => {
          if (game.phase === 'gameover' || window.confirm('지금 게임을 그만두고 새 게임을 할까요?')) onChangeSetup();
        }}
        onExit={onExit}
        extra={
          game.phase === 'gameover' && !showResult ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowResult(true)}>
              결과 다시 보기
            </button>
          ) : null
        }
      />

      {game.phase === 'gameover' && !locked && showResult && (
        <Results
          state={game}
          newRecord={newRecord}
          best={best}
          onRestart={onRestart}
          onChangeSetup={onChangeSetup}
          onExit={onExit}
          onClose={() => setShowResult(false)}
        />
      )}
    </div>
  );
}
