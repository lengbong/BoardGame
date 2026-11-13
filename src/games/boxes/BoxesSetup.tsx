import { useState } from 'react';
import { SeatPicker } from '../../components/SeatPicker';
import { activeSeatCount, type Seats } from '../common/players';
import type { GameSettings } from '../common/settings';
import { SPEEDS, SPEED_LABELS, type Speed } from '../common/speed';
import { Board } from './Board';
import { BOARD_SIZES, applyAction, createGame, playerName, recommendedSize } from './rules';
import type { SavedBoxesGame } from './storage';
import type { BoxesOptions, BoxesSetup as Setup, BoxesState } from './types';

interface BoxesSetupProps {
  initialSetup: Setup;
  saved: SavedBoxesGame | null;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onStart: (setup: Setup) => void;
  onResume: () => void;
  onBack: () => void;
}

const SIZE_DESC: Record<number, string> = {
  3: '금방 끝나요. 처음 배울 때 좋아요.',
  4: '둘이서 하기 딱 좋은 크기예요.',
  5: '3~4명이 하거나 조금 길게 하고 싶을 때.',
  6: '사슬이 길어져서 수 싸움이 재미있어요.',
};

const RULES: { key: 'noExtraTurn' | 'warnings'; title: string; desc: string }[] = [
  {
    key: 'noExtraTurn',
    title: '상자를 만들어도 한 번 더 안 하기',
    desc: '어린아이와 할 때 좋은 간단 규칙이에요. 상자를 완성하면 점수만 얻고 차례가 넘어가요.',
  },
  {
    key: 'warnings',
    title: '위험한 선 알려 주기',
    desc: '사람 차례에 상자의 세 번째 선을 그으려 하면 ⚠ 표시가 나와요. 다음 사람이 그 상자를 가져갈 수 있거든요.',
  },
];

/** 설정 화면 머리 그림: 세 사람이 하던 작은 판 */
function heroState(): BoxesState {
  const s = createGame(
    {
      seats: [
        { kind: 'human', name: '' },
        { kind: 'human', name: '' },
        { kind: 'empty', name: '' },
        { kind: 'human', name: '' },
      ],
      options: { size: 3, noExtraTurn: false, warnings: false },
    },
    () => 0,
  );
  const moves = [0, 12, 3, 13, 4, 7, 17, 2, 18, 5, 15, 21, 9, 14, 10];
  return moves.reduce((st, edge) => applyAction(st, { type: 'line', edge }), s);
}

const HERO = heroState();

export function BoxesSetup({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: BoxesSetupProps) {
  const [setup, setSetup] = useState<Setup>(initialSetup);
  const count = activeSeatCount(setup.seats);
  const opt = setup.options;
  const setOpt = (patch: Partial<BoxesOptions>) => setSetup({ ...setup, options: { ...opt, ...patch } });
  const recommended = recommendedSize(Math.max(2, count));

  // 사람 수가 바뀌면, 판 크기를 직접 바꾸지 않은 경우(추천 크기 그대로)에만 새 추천 크기로 따라간다.
  const changeSeats = (seats: Seats) => {
    const before = recommendedSize(Math.max(2, activeSeatCount(setup.seats)));
    const after = recommendedSize(Math.max(2, activeSeatCount(seats)));
    const size = opt.size === before ? after : opt.size;
    setSetup({ seats, options: { ...opt, size } });
  };

  return (
    <div className="setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="bx-hero">
        <div className="bx-hero-paper" aria-hidden="true">
          <Board state={HERO} mini className="bx-hero-board" />
        </div>
        <div>
          <h1>점과 상자</h1>
          <p>점 사이에 선을 하나씩 그어요. 네 번째 선을 그어 상자를 완성하면 내 것이 되고 한 번 더! 상자를 가장 많이 모은 사람이 이겨요.</p>
        </div>
      </header>

      {saved && (
        <section className="resume-card">
          <div>
            <strong>하던 게임이 있어요.</strong>
            <span>
              {' '}
              {saved.state.players.map((p) => `${playerName(p)} ${p.score}`).join(' · ')} — {saved.state.size}×{saved.state.size} 판 —{' '}
              {new Date(saved.savedAt).toLocaleString('ko-KR')}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="bx-resume">
            이어하기
          </button>
        </section>
      )}

      <section className="setup-section">
        <h2>누가 할까요?</h2>
        <SeatPicker seats={setup.seats} onChange={changeSeats} />
      </section>

      <section className="setup-section">
        <h2>판 크기</h2>
        <div className="rule-grid bx-size-grid">
          {BOARD_SIZES.map((n) => (
            <label key={n} className="rule-item">
              <input type="radio" name="bx-size" checked={opt.size === n} onChange={() => setOpt({ size: n })} data-testid={`bx-size-${n}`} />
              <span>
                <strong>
                  {n}×{n} <em className="bx-size-sub">상자 {n * n}개</em>
                  {n === recommended && <em className="tag bx-tag-rec">{count >= 3 ? '3~4명 추천' : '2명 추천'}</em>}
                </strong>
                <small>{SIZE_DESC[n]}</small>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="setup-section">
        <h2>규칙</h2>
        <div className="rule-grid">
          {RULES.map((r) => (
            <label key={r.key} className="rule-item">
              <input type="checkbox" checked={opt[r.key]} onChange={(e) => setOpt({ [r.key]: e.target.checked })} data-testid={`bx-rule-${r.key}`} />
              <span>
                <strong>{r.title}</strong>
                <small>{r.desc}</small>
              </span>
            </label>
          ))}
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
        <button type="button" className="btn btn-primary btn-large" disabled={count < 2} onClick={() => onStart(setup)} data-testid="bx-start">
          게임 시작
        </button>
      </section>

      <details className="how-to">
        <summary>놀이 방법</summary>
        <ol>
          <li>차례가 되면 이웃한 두 점 사이에 가로선이나 세로선을 하나 그어요. 점 사이 아무 데나 누르면 가장 가까운 선이 그어져요.</li>
          <li>상자의 네 번째 선을 그으면 그 상자는 내 것! 내 색으로 칠해지고 내 모양과 이름 첫 글자가 찍혀요. 그리고 한 번 더 그어요.</li>
          <li>선 하나로 상자 두 개를 한꺼번에 완성할 수도 있어요.</li>
          <li>조심! 상자의 세 번째 선을 그으면 다음 사람이 그 상자를 가져가요. 처음에는 세 번째 선이 아닌 안전한 선을 골라요.</li>
          <li>안전한 선이 다 떨어지면 누군가는 상자를 내줘야 해요. 그때는 가장 적게 내주는 곳을 골라요.</li>
          <li>고수의 비법: 긴 줄을 먹을 때 마지막 두 상자를 일부러 남겨 주면, 상대가 그 둘을 먹고 다음 긴 줄을 열어 줘야 해요.</li>
          <li>모든 선을 다 그으면 끝! 상자를 가장 많이 모은 사람이 이기고, 같으면 같은 등수예요.</li>
          <li>조작: 마우스로 클릭하거나, 화살표 키로 선을 고르고 Enter(또는 Space)로 그어요.</li>
        </ol>
      </details>
    </div>
  );
}
