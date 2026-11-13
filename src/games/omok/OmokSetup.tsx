import { useState } from 'react';
import { DuelPicker } from '../../components/DuelPicker';
import type { GameSettings } from '../common/settings';
import { SPEEDS, SPEED_LABELS, type Speed } from '../common/speed';
import { SIDE_LABELS } from './rules';
import { OMOK_SIDES, StoneShape } from './StoneArt';
import type { SavedOmokGame } from './storage';
import type { BoardSize, OmokOptions, OmokSetup, RuleSet, Stone } from './types';

interface SetupProps {
  initialSetup: OmokSetup;
  saved: SavedOmokGame | null;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onStart: (setup: OmokSetup) => void;
  onResume: () => void;
  onBack: () => void;
}

const RULES: { value: RuleSet; title: string; desc: string }[] = [
  { value: 'no33', title: '쌍삼 금지 (기본)', desc: '흑백 모두 열린 삼 두 개를 한 번에 만드는 수(3·3)는 둘 수 없어요. 학교에서 흔히 하는 규칙이에요.' },
  { value: 'free', title: '자유', desc: '금지된 수가 없어요. 다섯 개 이상 이으면 누구든 이겨요. 처음 배울 때 좋아요.' },
  { value: 'renju', title: '렌주 (대회 규칙)', desc: '먼저 두는 흑이 유리해서 흑만 쌍삼·쌍사·여섯 개 이상을 둘 수 없고, 흑은 정확히 다섯이어야 이겨요.' },
];

/** 이름이 있으면 "이름(흑)", 없으면 "흑" */
function sideTag(saved: SavedOmokGame, side: Stone): string {
  const name = saved.state.players[side].name.trim();
  return name ? `${name}(${SIDE_LABELS[side]})` : SIDE_LABELS[side];
}

/** 머리 그림: 작은 판에 대각선 다섯 */
function HeroBoard() {
  const n = 7;
  const stones: [number, number, Stone][] = [
    [1, 1, 0],
    [2, 2, 0],
    [3, 3, 0],
    [4, 4, 0],
    [1, 2, 1],
    [2, 4, 1],
    [4, 2, 1],
    [5, 3, 1],
    [3, 5, 1],
  ];
  return (
    <svg className="ok-hero-art" viewBox={`-0.7 -0.7 ${n + 0.4} ${n + 0.4}`} aria-hidden="true">
      <rect x={-0.7} y={-0.7} width={n + 0.4} height={n + 0.4} rx={0.4} fill="url(#ok-wood)" />
      {Array.from({ length: n }, (_, k) => (
        <g key={k} stroke="#6b4a2b" strokeWidth={0.05}>
          <line x1={0} y1={k} x2={n - 1} y2={k} />
          <line x1={k} y1={0} x2={k} y2={n - 1} />
        </g>
      ))}
      {stones.map(([x, y, s], i) => (
        <g key={i} className="ok-hero-stone" style={{ animationDelay: `${i * 0.12}s` }}>
          <StoneShape side={s} cx={x} cy={y} r={0.44} />
        </g>
      ))}
      <g className="ok-hero-drop">
        <StoneShape side={0} cx={5} cy={5} r={0.44} />
      </g>
      <line x1={1} y1={1} x2={5} y2={5} className="ok-winline ok-hero-line" />
    </svg>
  );
}

export function OmokSetupScreen({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: SetupProps) {
  const [setup, setSetup] = useState<OmokSetup>(initialSetup);
  const opt = setup.options;
  const setOpt = (patch: Partial<OmokOptions>) => setSetup({ ...setup, options: { ...opt, ...patch } });
  const vsComputer = setup.seats.filter((s) => s.kind === 'human').length === 1;

  return (
    <div className="setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="ok-hero">
        <HeroBoard />
        <div>
          <h1>오목</h1>
          <p>흑과 백이 번갈아 바둑판에 돌을 놓아요. 가로·세로·대각선으로 다섯 개를 먼저 이으면 이겨요!</p>
        </div>
      </header>

      {saved && (
        <section className="resume-card">
          <div>
            <strong>하던 게임이 있어요.</strong>
            <span>
              {' '}
              {sideTag(saved, 0)} · {sideTag(saved, 1)} — {saved.state.moves.length}수째 — {new Date(saved.savedAt).toLocaleString('ko-KR')}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="ok-resume">
            이어하기
          </button>
        </section>
      )}

      <section className="setup-section">
        <h2>누가 할까요?</h2>
        <DuelPicker seats={setup.seats} sides={OMOK_SIDES} onChange={(seats) => setSetup({ ...setup, seats })} />
        <p className="ok-note">왼쪽 자리가 흑으로 먼저 둬요. 컴퓨터 어려움은 사를 연달아 두어 이기는 길까지 찾아요.</p>
      </section>

      <section className="setup-section">
        <h2>규칙</h2>
        <div className="ok-rule-list">
          {RULES.map((r) => (
            <label key={r.value} className="rule-item">
              <input type="radio" name="ok-rule" checked={opt.rule === r.value} onChange={() => setOpt({ rule: r.value })} data-testid={`ok-rule-${r.value}`} />
              <span>
                <strong>{r.title}</strong>
                <small>{r.desc}</small>
              </span>
            </label>
          ))}
        </div>
        <div className="ok-choice-row">
          <span>판 크기</span>
          {([15, 13] as BoardSize[]).map((n) => (
            <button key={n} type="button" className={`btn${opt.size === n ? ' btn-selected' : ''}`} onClick={() => setOpt({ size: n })} data-testid={`ok-size-${n}`}>
              {n}줄 {n === 15 ? '(정식)' : '(작게, 빨리)'}
            </button>
          ))}
        </div>
      </section>

      <section className="setup-section">
        <h2>도움 기능</h2>
        <div className="rule-grid">
          <label className="rule-item">
            <input type="checkbox" checked={opt.hints} onChange={(e) => setOpt({ hints: e.target.checked })} />
            <span>
              <strong>수 알려 주기</strong>
              <small>바로 이길 곳(초록), 꼭 막아야 할 곳(주황), 조심할 곳(노랑)을 동그라미로 알려 줘요. 게임 중에도 H로 켜고 꺼요.</small>
            </span>
          </label>
          <label className="rule-item">
            <input type="checkbox" checked={opt.numbers} onChange={(e) => setOpt({ numbers: e.target.checked })} />
            <span>
              <strong>수 번호 보이기</strong>
              <small>돌에 몇 번째로 둔 돌인지 숫자를 써 줘요. 끝난 뒤 다시 살펴볼 때 좋아요. (N)</small>
            </span>
          </label>
          <label className={`rule-item${vsComputer ? '' : ' ok-disabled'}`}>
            <input type="checkbox" checked={opt.undo && vsComputer} disabled={!vsComputer} onChange={(e) => setOpt({ undo: e.target.checked })} />
            <span>
              <strong>무르기</strong>
              <small>{vsComputer ? '컴퓨터와 할 때 내가 둔 마지막 수를 되돌릴 수 있어요. (U)' : '사람 한 명이 컴퓨터와 할 때만 쓸 수 있어요.'}</small>
            </span>
          </label>
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
        <button type="button" className="btn btn-primary btn-large" onClick={() => onStart({ ...setup, options: { ...opt, undo: opt.undo && vsComputer } })} data-testid="ok-start">
          게임 시작
        </button>
      </section>

      <details className="how-to">
        <summary>놀이 방법</summary>
        <ol>
          <li>흑이 먼저, 흑과 백이 번갈아 줄이 만나는 점(교차점)에 돌을 하나씩 놓아요.</li>
          <li>가로·세로·대각선 어느 쪽이든 내 돌 다섯 개를 먼저 나란히 이으면 이겨요.</li>
          <li>양쪽이 비어 있는 셋(열린 삼)은 다음에 막을 수 없는 넷이 되니 바로 한쪽 끝을 막아야 해요.</li>
          <li>작전: 사(넷)와 열린 삼을 한 번에 만들면 상대가 둘 다 막을 수 없어요!</li>
          <li>쌍삼 금지 규칙에서는 열린 삼 두 개를 한 번에 만드는 수를 둘 수 없어요. 그런 자리는 빨간 ✕로 보여 줘요.</li>
          <li>조작: 교차점을 클릭하거나 방향키로 고르고 Enter. 무르기 U, 수 알려 주기 H, 수 번호 N.</li>
        </ol>
      </details>
    </div>
  );
}
