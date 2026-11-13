import { useState } from 'react';
import type { CSSProperties } from 'react';
import { DuelPicker } from '../../components/DuelPicker';
import { SpeedPicker } from '../../components/SpeedPicker';
import type { GameSettings } from '../common/settings';
import { DiscFace, REVERSI_SIDES } from './DiscArt';
import { SIDE_LABELS } from './rules';
import type { SavedReversiGame } from './storage';
import type { BoardSize, Disc, ReversiOptions, ReversiSetup as Setup } from './types';

interface ReversiSetupProps {
  initialSetup: Setup;
  saved: SavedReversiGame | null;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onStart: (setup: Setup) => void;
  onResume: () => void;
  onBack: () => void;
}

const SIZES: { value: BoardSize; title: string; desc: string }[] = [
  { value: 8, title: '8×8 정식 판', desc: '64칸에서 하는 보통 뒤집기예요. 한 판에 10~20분쯤 걸려요.' },
  { value: 6, title: '6×6 작은 판 (어린이용)', desc: '36칸이라 금방 끝나요. 규칙을 처음 배울 때 좋아요.' },
];

/** 머리 그림: 초록 판 위에서 돌이 하나씩 뒤집히는 모습 */
/** 이름이 있으면 "이름(흑)", 없으면 "흑" */
function sideTag(saved: SavedReversiGame, side: Disc): string {
  const name = saved.state.players[side].name.trim();
  return name ? `${name}(${SIDE_LABELS[side]})` : SIDE_LABELS[side];
}

const HERO: (Disc | null)[] = [null, 1, 0, null, 0, 0, 1, 1, 1, 0, 0, 1, null, 1, 0, null];

export function ReversiSetup({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: ReversiSetupProps) {
  const [setup, setSetup] = useState<Setup>(initialSetup);
  const opt = setup.options;
  const setOpt = (patch: Partial<ReversiOptions>) => setSetup({ ...setup, options: { ...opt, ...patch } });
  const humans = setup.seats.filter((s) => s.kind === 'human').length;
  const vsComputer = humans === 1;

  return (
    <div className="setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="rv-hero">
        <div className="rv-hero-board" aria-hidden="true">
          {HERO.map((side, i) => (
            <span key={i} className="rv-hero-cell">
              {side !== null && (
                <span className={`rv-hero-disc${i === 5 || i === 9 ? ' rv-hero-flip' : ''}`} style={{ '--i': i } as CSSProperties}>
                  <DiscFace side={side} />
                </span>
              )}
            </span>
          ))}
        </div>
        <div>
          <h1>뒤집기</h1>
          <p>상대 돌을 내 돌 사이에 끼우면 내 색으로 뒤집혀요. 판이 다 찼을 때 돌이 많은 쪽이 이겨요!</p>
        </div>
      </header>

      {saved && (
        <section className="resume-card">
          <div>
            <strong>하던 게임이 있어요.</strong>
            <span>
              {' '}
              {sideTag(saved, 0)} {saved.state.counts[0]} : {saved.state.counts[1]} {sideTag(saved, 1)} · {saved.state.size}×{saved.state.size} —{' '}
              {new Date(saved.savedAt).toLocaleString('ko-KR')}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="rv-resume">
            이어하기
          </button>
        </section>
      )}

      <section className="setup-section">
        <h2>누가 할까요?</h2>
        <DuelPicker seats={setup.seats} sides={REVERSI_SIDES} onChange={(seats) => setSetup({ ...setup, seats })} />
        <p className="rv-note">왼쪽 자리가 흑을 잡고 먼저 둬요. 가운데 ⇄ 버튼으로 순서를 바꿀 수 있어요.</p>
      </section>

      <section className="setup-section">
        <h2>판 크기</h2>
        <div className="rule-grid rv-rules">
          {SIZES.map((s) => (
            <label key={s.value} className="rule-item">
              <input type="radio" name="rv-size" checked={opt.size === s.value} onChange={() => setOpt({ size: s.value })} data-testid={`rv-size-${s.value}`} />
              <span>
                <strong>{s.title}</strong>
                <small>{s.desc}</small>
              </span>
            </label>
          ))}
        </div>

        <h3 className="sub-title">도움 기능</h3>
        <div className="rule-grid rv-rules">
          <label className="rule-item">
            <input type="checkbox" checked={opt.hints} onChange={(e) => setOpt({ hints: e.target.checked })} />
            <span>
              <strong>둘 수 있는 곳 표시</strong>
              <small>내 차례에 둘 수 있는 칸에 작은 점을 찍고, 마우스를 올리면 뒤집힐 돌을 알려 줘요. 게임 중에도 켜고 끌 수 있어요.</small>
            </span>
          </label>
          <label className={`rule-item${vsComputer ? '' : ' rv-disabled'}`}>
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
          data-testid="rv-start"
        >
          게임 시작
        </button>
      </section>

      <details className="how-to">
        <summary>놀이 방법</summary>
        <ol>
          <li>가운데 네 칸에 흑돌 2개, 백돌 2개를 엇갈려 놓고 시작해요. 흑이 먼저 둬요.</li>
          <li>내 돌을 놓아서 상대 돌을 내 돌 두 개 사이에 끼우면(가로·세로·대각선), 끼인 돌이 모두 내 색으로 뒤집혀요.</li>
          <li>한 번에 여러 방향을 뒤집을 수 있어요. 하나도 뒤집지 못하는 칸에는 둘 수 없어요.</li>
          <li>둘 곳이 하나도 없으면 "둘 곳이 없어서 넘어가요" 하고 차례가 저절로 상대에게 넘어가요.</li>
          <li>판이 다 차거나 둘 다 둘 곳이 없으면 끝! 내 색 돌이 더 많은 쪽이 이겨요.</li>
          <li>작전: 네 귀퉁이(모서리)는 절대 뒤집히지 않아서 아주 좋아요. 모서리 바로 옆 칸은 상대에게 모서리를 내줄 수 있으니 조심!</li>
          <li>조작: 칸을 클릭하거나, 방향키로 고르고 Enter. 무르기는 U.</li>
        </ol>
      </details>
    </div>
  );
}
