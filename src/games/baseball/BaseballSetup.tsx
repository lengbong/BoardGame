import { useState, type CSSProperties } from 'react';
import { DuelPicker } from '../../components/DuelPicker';
import type { GameSettings } from '../common/settings';
import { SPEEDS, SPEED_LABELS, type Speed } from '../common/speed';
import { BASEBALL_SIDES, BallArt } from './art';
import { loadRecords, recordKey, type SavedBaseballGame } from './storage';
import type { BaseballOptions, BaseballSetup, CodeLength, GameMode } from './types';

interface SetupProps {
  initialSetup: BaseballSetup;
  saved: SavedBaseballGame | null;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onStart: (setup: BaseballSetup) => void;
  onResume: () => void;
  onBack: () => void;
}

const MODES: { value: GameMode; title: string; desc: string }[] = [
  { value: 'duel', title: '⚔️ 둘이서 대결', desc: '서로 비밀 숫자를 숨기고 번갈아 쳐요. 상대 숫자를 먼저 맞히면 이겨요. 컴퓨터와도 할 수 있어요.' },
  { value: 'solo', title: '🎯 혼자 맞히기', desc: '컴퓨터가 숨긴 숫자를 몇 번 만에 맞히는지 도전해요. 최고 기록이 남아요.' },
];

/** 머리 그림: 작은 전광판 */
function HeroBoard() {
  // 숨긴 숫자 1 6 5를 맞혀 가는 모습
  const rows: { d: string; s: number; b: number }[] = [
    { d: '123', s: 1, b: 0 },
    { d: '456', s: 0, b: 2 },
    { d: '165', s: 3, b: 0 },
  ];
  return (
    <div className="bb-hero-board" aria-hidden="true">
      {rows.map((r, i) => (
        <div key={i} className="bb-hero-row" style={{ '--i': i } as CSSProperties}>
          <span className="bb-hero-digits">
            {r.d.split('').map((c, k) => (
              <span key={k}>{c}</span>
            ))}
          </span>
          <span className="bb-hero-lamps">
            {[0, 1, 2].map((k) => (
              <i key={`s${k}`} className={k < r.s ? 'bb-lamp bb-lamp-on bb-lamp-s' : 'bb-lamp'} />
            ))}
            <em />
            {[0, 1, 2].map((k) => (
              <i key={`b${k}`} className={k < r.b ? 'bb-lamp bb-lamp-on bb-lamp-b' : 'bb-lamp'} />
            ))}
          </span>
        </div>
      ))}
      <span className="bb-hero-ball">
        <BallArt size={46} />
      </span>
    </div>
  );
}

export function BaseballSetupScreen({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: SetupProps) {
  const [setup, setSetup] = useState<BaseballSetup>(initialSetup);
  const [records] = useState(loadRecords);
  const opt = setup.options;
  const solo = opt.mode === 'solo';
  const setOpt = (patch: Partial<BaseballOptions>) => setSetup({ ...setup, options: { ...opt, ...patch } });
  const best = records[recordKey(opt)];

  return (
    <div className="setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="bb-hero">
        <HeroBoard />
        <div>
          <h1>숫자야구</h1>
          <p>숨긴 숫자를 스트라이크·볼 힌트로 추리해서 맞혀요. 숫자와 자리가 맞으면 스트라이크, 숫자만 맞으면 볼!</p>
        </div>
      </header>

      {saved && (
        <section className="resume-card">
          <div>
            <strong>하던 게임이 있어요.</strong>
            <span>
              {' '}
              {saved.state.options.mode === 'solo' ? `혼자 맞히기 (${saved.state.players[0].guesses.length}번 침)` : `${saved.state.players[0].name} · ${saved.state.players[1].name}`} —{' '}
              {new Date(saved.savedAt).toLocaleString('ko-KR')}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="bb-resume">
            이어하기
          </button>
        </section>
      )}

      <section className="setup-section">
        <h2>어떻게 할까요?</h2>
        <div className="rule-grid">
          {MODES.map((m) => (
            <label key={m.value} className="rule-item">
              <input type="radio" name="bb-mode" checked={opt.mode === m.value} onChange={() => setOpt({ mode: m.value })} data-testid={`bb-mode-${m.value}`} />
              <span>
                <strong>{m.title}</strong>
                <small>{m.desc}</small>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="setup-section">
        <h2>{solo ? '누가 할까요?' : '누가 할까요? (왼쪽이 먼저 쳐요)'}</h2>
        {solo ? (
          <div className="bb-solo-name">
            <label>
              이름
              <input
                type="text"
                value={setup.seats[0].name}
                maxLength={8}
                placeholder="나"
                onChange={(e) => setSetup({ ...setup, seats: [{ ...setup.seats[0], name: e.target.value }, setup.seats[1]] })}
              />
            </label>
            <p className="bb-note">
              🏅 이 설정의 최고 기록: <b>{best ? `${best}번 만에 맞히기` : '아직 없어요'}</b>
            </p>
          </div>
        ) : (
          <>
            <DuelPicker seats={setup.seats} sides={BASEBALL_SIDES} onChange={(seats) => setSetup({ ...setup, seats })} firstNote="먼저 (초)" />
            <p className="bb-note">사람 둘이 하면 비밀 숫자를 정할 때만 화면을 넘겨요. 친 숫자와 결과는 모두가 함께 봐요.</p>
          </>
        )}
      </section>

      <section className="setup-section">
        <h2>숫자</h2>
        <div className="bb-choice-row">
          <span>자릿수</span>
          {([3, 4] as CodeLength[]).map((n) => (
            <button key={n} type="button" className={`btn${opt.length === n ? ' btn-selected' : ''}`} onClick={() => setOpt({ length: n })} data-testid={`bb-len-${n}`}>
              {n}자리 {n === 3 ? '(처음이라면)' : '(더 어렵게)'}
            </button>
          ))}
        </div>
        <div className="rule-grid bb-rules">
          <label className="rule-item">
            <input type="checkbox" checked={opt.zero} onChange={(e) => setOpt({ zero: e.target.checked })} />
            <span>
              <strong>0도 쓰기</strong>
              <small>{opt.zero ? '0~9 열 개의 숫자를 써요. 경우의 수가 늘어나 조금 더 어려워요.' : '1~9 아홉 개의 숫자만 써요.'}</small>
            </span>
          </label>
          <label className="rule-item">
            <input type="checkbox" checked={opt.helper} onChange={(e) => setOpt({ helper: e.target.checked })} />
            <span>
              <strong>추리 도우미</strong>
              <small>답일 수 있는 숫자가 몇 개 남았는지, 넣은 숫자가 앞의 결과와 맞지 않는지 알려 주고, 아웃 숫자를 메모에 ✕로 적어 줘요.</small>
            </span>
          </label>
          {!solo && (
            <label className="rule-item">
              <input type="checkbox" checked={opt.fairFinish} onChange={(e) => setOpt({ fairFinish: e.target.checked })} />
              <span>
                <strong>마지막 기회</strong>
                <small>먼저 치는 편이 맞혀도 나중 편에게 한 번 더 기회를 줘요. 둘 다 맞히면 무승부! (끄면 먼저 맞힌 쪽이 바로 이겨요)</small>
              </span>
            </label>
          )}
        </div>
      </section>

      <section className="setup-section setup-footer">
        <label className="speed-select">
          컴퓨터·애니메이션 속도
          <select value={settings.speed} onChange={(e) => onSettings({ ...settings, speed: e.target.value as Speed })}>
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {SPEED_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-primary btn-large" onClick={() => onStart(setup)} data-testid="bb-start">
          게임 시작
        </button>
      </section>

      <details className="how-to">
        <summary>놀이 방법</summary>
        <ol>
          <li>서로 같은 숫자가 없는 {opt.length}자리 비밀 숫자를 몰래 정해요. (예: 3 7 2)</li>
          <li>번갈아 상대 숫자를 짐작해서 쳐요. 숫자와 자리가 모두 맞으면 <b>스트라이크(S)</b>, 숫자는 있는데 자리가 다르면 <b>볼(B)</b>이에요.</li>
          <li>예: 비밀 숫자가 3 7 2일 때 3 2 5를 치면 3은 스트라이크, 2는 볼 → 1스트라이크 1볼. 하나도 없으면 아웃!</li>
          <li>{opt.length}스트라이크가 되면 홈런! 상대 숫자를 먼저 맞히면 이겨요.</li>
          <li>작전: 아웃이 나온 숫자는 메모에 ✕로 지워요. 숫자를 하나씩 바꿔 치면 어느 숫자가 맞는지 알 수 있어요.</li>
          <li>컴퓨터는 상대 숫자를 몰래 보지 않아요. 쉬움은 오래된 결과를 잊어버리고, 어려움은 아주 꼼꼼하게 추리해요.</li>
          <li>조작: 숫자 단추나 키보드 숫자, 지우기는 Backspace(모두 지우기 Esc), 치기는 Enter, 메모는 메모 칸이나 Shift+숫자.</li>
        </ol>
      </details>
    </div>
  );
}
