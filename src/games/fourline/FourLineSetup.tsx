import { useState } from 'react';
import { DuelPicker } from '../../components/DuelPicker';
import { SpeedPicker } from '../../components/SpeedPicker';
import type { GameSettings } from '../common/settings';
import { FOURLINE_SIDES, Stone } from './StoneArt';
import { SIDE_LABELS } from './rules';
import type { SavedFourLineGame } from './storage';
import type { FourLineOptions, FourLineSetup as Setup, Side } from './types';

interface FourLineSetupProps {
  initialSetup: Setup;
  saved: SavedFourLineGame | null;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onStart: (setup: Setup) => void;
  onResume: () => void;
  onBack: () => void;
}

/** 이름이 있으면 "이름(빨강)", 없으면 "빨강" */
function sideTag(saved: SavedFourLineGame, side: Side): string {
  const name = saved.state.players[side].name.trim();
  return name ? `${name}(${SIDE_LABELS[side]})` : SIDE_LABELS[side];
}

/** 머리 그림: 작은 판 (5열 × 4줄, 아래가 마지막 줄). 빨강이 대각선 셋, 노랑 돌 하나가 떨어지는 중 */
const HERO: (Side | null)[][] = [
  [null, null, null, null, null],
  [null, null, null, 0, null],
  [null, 1, 0, 1, null],
  [1, 0, 1, 0, null],
];

function HeroBoard() {
  let holes = 'M0 0H50V40H0Z';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) holes += ` M${c * 10 + 1.4} ${r * 10 + 5}a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0 -7.2 0Z`;
  return (
    <div className="fl-hero-art" aria-hidden="true">
      <div className="fl-hero-board">
        <span className="fl-hero-drop">
          <Stone side={1} />
        </span>
        {HERO.map((row, r) =>
          row.map((v, c) =>
            v === null ? null : (
              <span key={`${r}-${c}`} className="fl-hero-stone" style={{ left: `${c * 20}%`, top: `${r * 25}%` }}>
                <Stone side={v} />
              </span>
            ),
          ),
        )}
        <svg viewBox="0 0 50 40" className="fl-hero-plate">
          <path d={holes} fill="#b07a45" fillRule="evenodd" />
        </svg>
      </div>
    </div>
  );
}

export function FourLineSetup({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: FourLineSetupProps) {
  const [setup, setSetup] = useState<Setup>(initialSetup);
  const opt = setup.options;
  const setOpt = (patch: Partial<FourLineOptions>) => setSetup({ ...setup, options: { ...opt, ...patch } });
  const vsComputer = setup.seats.filter((s) => s.kind === 'human').length === 1;

  return (
    <div className="setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="fl-hero">
        <HeroBoard />
        <div>
          <h1>사목</h1>
          <p>세워진 판에 돌을 떨어뜨려 가로·세로·대각선으로 4개를 먼저 이으면 이겨요!</p>
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
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="fl-resume">
            이어하기
          </button>
        </section>
      )}

      <section className="setup-section">
        <h2>누가 할까요?</h2>
        <DuelPicker seats={setup.seats} sides={FOURLINE_SIDES} onChange={(seats) => setSetup({ ...setup, seats })} />
        <p className="fl-note">왼쪽 자리가 빨강(●)으로 먼저 둬요. 노랑 돌에는 ★가 그려져 있어요.</p>
      </section>

      <section className="setup-section">
        <h2>도움 기능</h2>
        <div className="rule-grid fl-rules">
          <label className="rule-item">
            <input type="checkbox" checked={opt.hints} onChange={(e) => setOpt({ hints: e.target.checked })} />
            <span>
              <strong>수 알려 주기</strong>
              <small>내 차례에 바로 이길 수 있는 곳(초록)과 꼭 막아야 할 곳(주황)을 동그라미로 알려 줘요. 게임 중에도 켜고 끌 수 있어요.</small>
            </span>
          </label>
          <label className={`rule-item${vsComputer ? '' : ' fl-disabled'}`}>
            <input type="checkbox" checked={opt.undo && vsComputer} disabled={!vsComputer} onChange={(e) => setOpt({ undo: e.target.checked })} />
            <span>
              <strong>무르기</strong>
              <small>{vsComputer ? '컴퓨터와 할 때 내가 둔 마지막 수를 되돌릴 수 있어요.' : '사람 한 명이 컴퓨터와 할 때만 쓸 수 있어요.'}</small>
            </span>
          </label>
        </div>
      </section>

      <section className="setup-section setup-footer">
        <SpeedPicker caption="컴퓨터·애니메이션 속도" value={settings.speed} onChange={(speed) => onSettings({ ...settings, speed })} inline />
        <button
          type="button"
          className="btn btn-primary btn-large"
          onClick={() => onStart({ ...setup, options: { ...opt, undo: opt.undo && vsComputer } })}
          data-testid="fl-start"
        >
          게임 시작
        </button>
      </section>

      <details className="how-to">
        <summary>놀이 방법</summary>
        <ol>
          <li>판은 7줄(열)·6칸 높이로 세워져 있어요. 빨강이 먼저, 번갈아 한 개씩 돌을 떨어뜨려요.</li>
          <li>돌은 그 줄의 맨 아래 빈칸까지 쏙 떨어져요. 꽉 찬 줄에는 넣을 수 없어요.</li>
          <li>가로·세로·대각선 어느 쪽이든 내 돌 4개를 먼저 이으면 이겨요!</li>
          <li>판이 다 찰 때까지 아무도 못 이으면 비겨요.</li>
          <li>작전: 가운데 줄에 두면 넷을 이을 길이 많아요. 상대가 셋을 이으면 바로 막으세요!</li>
          <li>빨강 돌에는 ●, 노랑 돌에는 ★가 그려져 있어서 색을 구별하기 어려워도 할 수 있어요.</li>
          <li>조작: 줄을 클릭하거나 숫자키 1~7, 또는 ←→로 고르고 Enter(↓). 무르기는 U.</li>
        </ol>
      </details>
    </div>
  );
}
