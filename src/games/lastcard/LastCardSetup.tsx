import { useState } from 'react';
import { SeatPicker } from '../../components/SeatPicker';
import { SpeedPicker } from '../../components/SpeedPicker';
import { activeSeatCount } from '../common/players';
import { CardBack, CardFace } from './CardArt';
import { TARGET_SCORES } from './rules';
import type { LastCardSettings, SavedLastCardGame } from './storage';
import type { Card, EndMode, HandView, LastCardOptions, LastCardSetup as Setup } from './types';

interface LastCardSetupProps {
  initialSetup: Setup;
  saved: SavedLastCardGame | null;
  settings: LastCardSettings;
  onSettings: (settings: LastCardSettings) => void;
  onStart: (setup: Setup) => void;
  onResume: () => void;
  onBack: () => void;
}

const HERO_CARDS: Card[] = [
  { id: -1, kind: 'number', color: 'red', value: 7 },
  { id: -2, kind: 'skip', color: 'yellow', value: -1 },
  { id: -3, kind: 'wild', color: null, value: -1 },
  { id: -4, kind: 'draw2', color: 'green', value: -1 },
  { id: -5, kind: 'number', color: 'blue', value: 3 },
];

const HAND_VIEWS: { value: HandView; title: string; desc: string }[] = [
  {
    value: 'cover',
    title: '차례 넘김 화면 (손패 가리기)',
    desc: '사람이 2명 이상이면 내 차례에 "내 카드 보기"를 눌러야 손패가 보여요. 다른 사람은 그동안 눈을 감아 주세요.',
  },
  { value: 'open', title: '모두 공개 (배우기용)', desc: '컴퓨터 손패까지 모두 펼쳐 보여요. 아이와 함께 규칙을 익힐 때 좋아요.' },
];

const RULES: { key: 'stacking' | 'callRule'; title: string; desc: string }[] = [
  {
    key: 'callRule',
    title: '"한 장!" 외치기',
    desc: '카드가 2장일 때 📣 한 장! 버튼을 누르고 내야 해요. 깜빡하면 2장을 받아요. 끄면 자동으로 외쳐 줘요.',
  },
  {
    key: 'stacking',
    title: '+2·+4 누적',
    desc: '+2를 받으면 +2나 +4를, +4를 받으면 +4를 이어 내서 다음 사람에게 넘길 수 있어요. 못 내는 사람이 쌓인 장수를 모두 받아요.',
  },
];

const END_MODES: { value: EndMode; title: string; desc: string }[] = [
  { value: 'single', title: '한 판 승부', desc: '카드를 먼저 다 낸 사람이 우승! 나머지는 남은 카드 점수가 적은 순서로 순위를 정해요.' },
  { value: 'points', title: '점수 모으기', desc: '판마다 이긴 사람이 다른 사람 손에 남은 카드 점수를 가져가요. 목표 점수를 먼저 모으면 우승!' },
];

export function LastCardSetup({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: LastCardSetupProps) {
  const [setup, setSetup] = useState<Setup>(initialSetup);
  const count = activeSeatCount(setup.seats);
  const humans = setup.seats.filter((s) => s.kind === 'human').length;
  const opt = setup.options;
  const setOpt = (patch: Partial<LastCardOptions>) => setSetup({ ...setup, options: { ...opt, ...patch } });

  return (
    <div className="setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="lc-hero">
        <div className="lc-hero-fan" aria-hidden="true">
          {HERO_CARDS.map((c, i) => (
            <span key={c.id} className="lc-hero-card" style={{ '--i': i - 2 } as React.CSSProperties}>
              <CardFace card={c} />
            </span>
          ))}
          <span className="lc-hero-card lc-hero-back">
            <CardBack />
          </span>
        </div>
        <div>
          <h1>한 장 남았다!</h1>
          <p>같은 색이나 같은 숫자 카드를 내려놓아 손에 든 카드를 먼저 다 내면 이겨요. 한 장 남으면 "한 장!"을 외치세요!</p>
        </div>
      </header>

      {saved && (
        <section className="resume-card">
          <div>
            <strong>하던 게임이 있어요.</strong>
            <span>
              {' '}
              {saved.state.players.map((p) => p.name).join(' · ')}
              {saved.state.options.endMode === 'points' ? ` — ${saved.state.round}번째 판` : ''} — {new Date(saved.savedAt).toLocaleString('ko-KR')}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="lc-resume">
            이어하기
          </button>
        </section>
      )}

      <section className="setup-section">
        <h2>누가 할까요?</h2>
        <SeatPicker seats={setup.seats} onChange={(seats) => setSetup({ ...setup, seats })} />
      </section>

      <section className="setup-section">
        <h2>손패 보기</h2>
        <div className="rule-grid">
          {HAND_VIEWS.map((m) => (
            <label key={m.value} className="rule-item">
              <input type="radio" name="lc-hand-view" checked={opt.handView === m.value} onChange={() => setOpt({ handView: m.value })} />
              <span>
                <strong>{m.title}</strong>
                <small>{m.desc}</small>
              </span>
            </label>
          ))}
        </div>
        {opt.handView === 'cover' && humans < 2 && (
          <p className="lc-note">사람이 1명이면 가릴 필요가 없어서 내 카드가 항상 보여요.</p>
        )}
      </section>

      <section className="setup-section">
        <h2>규칙</h2>
        <div className="rule-grid">
          {RULES.map((r) => (
            <label key={r.key} className="rule-item">
              <input type="checkbox" checked={opt[r.key]} onChange={(e) => setOpt({ [r.key]: e.target.checked })} />
              <span>
                <strong>{r.title}</strong>
                <small>{r.desc}</small>
              </span>
            </label>
          ))}
        </div>

        <h3 className="sub-title">언제 끝낼까요?</h3>
        <div className="rule-grid">
          {END_MODES.map((m) => (
            <label key={m.value} className="rule-item">
              <input type="radio" name="lc-end-mode" checked={opt.endMode === m.value} onChange={() => setOpt({ endMode: m.value })} />
              <span>
                <strong>
                  {m.title}
                  {m.value === 'points' && (
                    <select
                      className="inline-select"
                      value={opt.targetScore}
                      onChange={(e) => setOpt({ endMode: 'points', targetScore: Number(e.target.value) })}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="목표 점수"
                    >
                      {TARGET_SCORES.map((v) => (
                        <option key={v} value={v}>
                          {v}점
                        </option>
                      ))}
                    </select>
                  )}
                </strong>
                <small>{m.desc}</small>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="setup-section setup-footer">
        <SpeedPicker caption="컴퓨터·애니메이션 속도" value={settings.speed} onChange={(speed) => onSettings({ ...settings, speed })} inline />
        <button type="button" className="btn btn-primary btn-large" disabled={count < 2} onClick={() => onStart(setup)} data-testid="lc-start">
          게임 시작
        </button>
      </section>

      <details className="how-to">
        <summary>놀이 방법</summary>
        <ol>
          <li>카드를 7장씩 나눠 가져요. 가운데 펼친 카드와 같은 색이거나 같은 숫자(같은 기호)인 카드를 한 장 낼 수 있어요.</li>
          <li>낼 카드가 없으면 더미에서 1장을 뽑아요. 뽑은 카드를 낼 수 있으면 바로 내도 되고, 그냥 넘겨도 돼요.</li>
          <li>🚫 건너뛰기: 다음 사람이 한 번 쉬어요. ⇄ 방향 바꾸기: 도는 방향이 반대로 바뀌어요. (2명일 때는 한 번 더!)</li>
          <li>+2: 다음 사람이 2장을 받고 쉬어요. 색 바꾸기: 아무 때나 내고 다음 색을 정해요. +4: 색을 정하고 다음 사람이 4장을 받고 쉬어요.</li>
          <li>카드가 2장일 때 한 장을 내기 전에 📣 한 장! 버튼을 눌러요. 깜빡하면 벌칙으로 2장을 받아요.</li>
          <li>손에 든 카드를 먼저 다 내면 이겨요! 남은 카드 점수: 숫자는 그 수, 기능 카드 20점, 색 바꾸기 카드 50점.</li>
          <li>카드 색마다 모양이 있어요: 빨강 ●, 노랑 ★, 초록 잎, 파랑 ◆. 색을 구별하기 어려우면 모양을 보세요.</li>
          <li>조작: 카드는 클릭, 뽑기·넘기기는 Space, 색 고르기는 숫자키 1~4.</li>
        </ol>
      </details>
    </div>
  );
}
