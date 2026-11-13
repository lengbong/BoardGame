import { useState } from 'react';
import { DuelPicker } from '../../components/DuelPicker';
import type { DuelSide } from '../common/duel';
import type { GameSettings } from '../common/settings';
import { Bridge, Jelly, SIDE_COLORS } from './JellyArt';
import { loadRecords, type SavedMalangGame } from './storage';
import type { GameMode, MalangOptions, MalangSetup, StartSpeed } from './types';

interface SetupProps {
  initialSetup: MalangSetup;
  saved: SavedMalangGame | null;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onStart: (setup: MalangSetup) => void;
  onResume: () => void;
  onBack: () => void;
}

function SideIcon({ c }: { c: number }) {
  return (
    <svg viewBox="0 0 1 1" aria-hidden="true">
      <Jelly c={c} x={0} y={0} mood="happy" />
    </svg>
  );
}

const SIDES: [DuelSide, DuelSide] = [
  { label: '딸기', color: SIDE_COLORS[0], icon: <SideIcon c={0} /> },
  { label: '소다', color: SIDE_COLORS[1], icon: <SideIcon c={2} /> },
];

const MODES: { value: GameMode; title: string; desc: string }[] = [
  { value: 'versus', title: '⚔️ 대결', desc: '연쇄로 상대에게 방해 젤리를 보내요. 컴퓨터와 하거나, 둘이서 한 키보드로 함께 해요.' },
  { value: 'solo', title: '🎯 혼자 하기', desc: '끝없이 쌓으며 점수와 연쇄 기록에 도전해요. 많이 터뜨릴수록 빨라져요.' },
];

const SPEEDS: { value: StartSpeed; label: string }[] = [
  { value: 'slow', label: '느리게' },
  { value: 'normal', label: '보통' },
  { value: 'fast', label: '빠르게' },
];

/** 머리 그림: 젤리가 이어져 터지기 직전인 작은 판 */
function HeroArt() {
  return (
    <div className="mp-hero-art" aria-hidden="true">
      <svg viewBox="0 0 4 4.4">
        <rect x={0} y={0.4} width={4} height={4} rx={0.25} fill="rgba(255,255,255,0.12)" />
        <Bridge x={0} y={3.4} dir="h" c={1} />
        <Bridge x={0} y={2.4} dir="v" c={1} />
        <Bridge x={2} y={3.4} dir="h" c={2} />
        <Bridge x={3} y={2.4} dir="v" c={2} />
        <Jelly c={1} x={0} y={2.4} />
        <Jelly c={1} x={0} y={3.4} mood="happy" />
        <Jelly c={1} x={1} y={3.4} />
        <Jelly c={2} x={2} y={3.4} />
        <Jelly c={2} x={3} y={3.4} mood="happy" />
        <Jelly c={2} x={3} y={2.4} />
        <Jelly c={9} x={2} y={2.4} mood="sleep" />
        <g className="mp-hero-drop">
          <Jelly c={1} x={1} y={0.6} mood="happy" />
          <Jelly c={3} x={1} y={1.6} />
        </g>
      </svg>
      <span className="mp-hero-chain">2연쇄!</span>
    </div>
  );
}

export function MalangSetupScreen({ initialSetup, saved, onStart, onResume, onBack }: SetupProps) {
  const [setup, setSetup] = useState<MalangSetup>(initialSetup);
  const [records] = useState(loadRecords);
  const opt = setup.options;
  const solo = opt.mode === 'solo';
  const setOpt = (patch: Partial<MalangOptions>) => setSetup({ ...setup, options: { ...opt, ...patch } });
  const humans = setup.seats.filter((s) => s.kind === 'human').length;

  return (
    <div className="setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="mp-hero">
        <HeroArt />
        <div>
          <h1>말랑 팡팡</h1>
          <p>두 개씩 떨어지는 젤리를 돌리고 옮겨서 같은 색 4개를 이으면 팡! 터진 자리에 떨어진 젤리가 또 이어지면 연쇄예요.</p>
        </div>
      </header>

      {saved && (
        <section className="resume-card">
          <div>
            <strong>하던 게임이 있어요.</strong>
            <span>
              {' '}
              {saved.state.players.map((p) => p.name).join(' · ')} — {new Date(saved.savedAt).toLocaleString('ko-KR')}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="mp-resume-saved">
            이어하기
          </button>
        </section>
      )}

      <section className="setup-section">
        <h2>어떻게 할까요?</h2>
        <div className="rule-grid">
          {MODES.map((m) => (
            <label key={m.value} className="rule-item">
              <input type="radio" name="mp-mode" checked={opt.mode === m.value} onChange={() => setOpt({ mode: m.value })} data-testid={`mp-mode-${m.value}`} />
              <span>
                <strong>{m.title}</strong>
                <small>{m.desc}</small>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="setup-section">
        <h2>누가 할까요?</h2>
        {solo ? (
          <div className="mp-solo-name">
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
            <p className="mp-note">🏅 최고 점수 {records.soloScore.toLocaleString('ko-KR')}점 · 가장 긴 연쇄 {records.bestChain}연쇄</p>
          </div>
        ) : (
          <>
            <DuelPicker seats={setup.seats} sides={SIDES} onChange={(seats) => setSetup({ ...setup, seats })} firstNote="" />
            <p className="mp-note">
              {humans === 2
                ? '👫 한 키보드로 둘이서: 왼쪽은 A·D 움직이기, W·Q 돌리기, S 빨리, Space 떨어뜨리기 / 오른쪽은 방향키, ↑·/ 돌리기, Enter 떨어뜨리기'
                : humans === 0
                  ? '🍿 컴퓨터끼리 하는 것을 구경해요.'
                  : '컴퓨터 쉬움은 보이면 바로 터뜨리고, 보통은 2연쇄부터, 어려움은 큰 연쇄를 모아서 한꺼번에 터뜨려요.'}
            </p>
          </>
        )}
      </section>

      <section className="setup-section">
        <h2>규칙</h2>
        <div className="mp-choice-row">
          <span>젤리 색</span>
          {([4, 5] as const).map((n) => (
            <button key={n} type="button" className={`btn${opt.colors === n ? ' btn-selected' : ''}`} onClick={() => setOpt({ colors: n })} data-testid={`mp-colors-${n}`}>
              {n}가지 {n === 4 ? '(보통)' : '(어려움)'}
            </button>
          ))}
        </div>
        <div className="mp-choice-row">
          <span>처음 빠르기</span>
          {SPEEDS.map((sp) => (
            <button key={sp.value} type="button" className={`btn${opt.startSpeed === sp.value ? ' btn-selected' : ''}`} onClick={() => setOpt({ startSpeed: sp.value })}>
              {sp.label}
            </button>
          ))}
        </div>
        {!solo && (
          <div className="mp-choice-row">
            <span>판 수</span>
            {([1, 2] as const).map((n) => (
              <button key={n} type="button" className={`btn${opt.winsNeeded === n ? ' btn-selected' : ''}`} onClick={() => setOpt({ winsNeeded: n })}>
                {n === 1 ? '한 판' : '2판 먼저 이기기'}
              </button>
            ))}
          </div>
        )}
        <label className="rule-item">
          <input type="checkbox" checked={opt.ghost} onChange={(e) => setOpt({ ghost: e.target.checked })} />
          <span>
            <strong>떨어질 자리 미리 보기</strong>
            <small>조각을 내리면 젤리가 어디에 놓일지 흐린 동그라미로 보여 줘요.</small>
          </span>
        </label>
      </section>

      <section className="setup-section setup-footer">
        <span className="mp-note">시작하면 3·2·1 뒤에 젤리가 떨어져요. P 또는 Esc로 언제든 멈출 수 있어요.</span>
        <button type="button" className="btn btn-primary btn-large" onClick={() => onStart(setup)} data-testid="mp-start">
          게임 시작
        </button>
      </section>

      <details className="how-to">
        <summary>놀이 방법</summary>
        <ol>
          <li>젤리가 두 개씩 붙어서 떨어져요. 좌우로 옮기고 돌려서 원하는 자리에 놓아요.</li>
          <li>같은 색 젤리가 가로·세로로 4개 이상 이어지면 팡! 하고 터져요.</li>
          <li>터진 자리로 위의 젤리가 떨어져 또 4개가 이어지면 연쇄! 연쇄가 길수록 점수가 훨씬 커져요.</li>
          <li>대결에서는 점수만큼 상대 판에 회색 방해 젤리가 떨어져요. 방해 젤리는 옆에서 젤리가 터질 때 함께 없어져요.</li>
          <li>나에게 올 방해 젤리(판 위의 아이콘: 작은 젤리 1개, 큰 젤리 6개, 구름 30개)는 내 연쇄로 먼저 막을 수 있어요.</li>
          <li>왼쪽에서 세 번째 줄 맨 위(✕)까지 젤리가 차면 져요.</li>
          <li>작전: 바로 터뜨리지 말고 같은 색을 3개씩 모아 계단처럼 쌓아 두면, 하나만 터뜨려도 여러 연쇄가 이어져요!</li>
          <li>색마다 이마에 무늬(● 잎 ◆ ★ ♥)가 있어서 색을 구별하기 어려워도 할 수 있어요.</li>
        </ol>
      </details>
    </div>
  );
}
