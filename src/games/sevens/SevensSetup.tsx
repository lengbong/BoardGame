import type { CSSProperties } from 'react';
import { useState } from 'react';
import { IconPicker } from '../../components/IconPicker';
import { PlayingCardBack, PlayingCardFace } from '../../components/PlayingCard';
import { SeatPicker } from '../../components/SeatPicker';
import { SpeedPicker } from '../../components/SpeedPicker';
import { activeSeatCount } from '../common/players';
import { makeCard } from '../common/playingCards';
import type { GameSettings } from '../common/settings';
import { MAX_PASSES, TARGET_SCORES } from './rules';
import type { SavedSevensGame } from './storage';
import type { EndMode, HandView, SevensOptions, SevensSetup } from './types';

interface SetupProps {
  initialSetup: SevensSetup;
  saved: SavedSevensGame | null;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onStart: (setup: SevensSetup) => void;
  onResume: () => void;
  onBack: () => void;
}

/** 머리 그림: 7 네 장을 가운데 두고 위아래로 이어진 줄 */
const HERO_ROWS = [
  [makeCard('spade', 6), makeCard('spade', 7), makeCard('spade', 8)],
  [makeCard('heart', 7), makeCard('heart', 8), makeCard('heart', 9)],
  [makeCard('diamond', 5), makeCard('diamond', 6), makeCard('diamond', 7)],
  [makeCard('club', 7)],
];

const HAND_VIEWS: { value: HandView; title: string; desc: string }[] = [
  {
    value: 'cover',
    title: '차례 넘김 화면 (손패 가리기)',
    desc: '사람이 2명 이상이면 내 차례에 "내 카드 보기"를 눌러야 손패가 보여요. 다른 사람은 그동안 눈을 감아 주세요.',
  },
  { value: 'open', title: '모두 공개 (배우기용)', desc: '컴퓨터 손패까지 모두 펼쳐 보여요. 아이와 함께 규칙을 익힐 때 좋아요.' },
];

const END_MODES: { value: EndMode; title: string; desc: string }[] = [
  { value: 'single', title: '한 판', desc: '카드를 먼저 다 낸 순서대로 순위를 정해요. 마지막 한 사람이 남을 때까지 해요.' },
  { value: 'points', title: '점수 모으기', desc: '누군가 카드를 다 내면 판이 끝나고, 다른 사람 손에 남은 카드 점수(A=1 … K=13)를 가져가요. 목표 점수를 먼저 모으면 우승!' },
];

export function SevensSetupScreen({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: SetupProps) {
  const [setup, setSetup] = useState<SevensSetup>(initialSetup);
  const count = activeSeatCount(setup.seats);
  const humans = setup.seats.filter((s) => s.kind === 'human').length;
  const opt = setup.options;
  const setOpt = (patch: Partial<SevensOptions>) => setSetup({ ...setup, options: { ...opt, ...patch } });

  return (
    <div className="setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="sv-hero">
        <div className="sv-hero-board" aria-hidden="true">
          {HERO_ROWS.map((row, r) => (
            <div key={r} className="sv-hero-row">
              {[5, 6, 7, 8, 9].map((rank, k) => {
                const card = row.find((c) => c.rank === rank);
                return card ? (
                  <span key={rank} className="sv-hero-card" style={{ '--d': r * 3 + k } as CSSProperties}>
                    <PlayingCardFace card={card} variant="mini" />
                  </span>
                ) : (
                  <span key={rank} className="sv-hero-slot" />
                );
              })}
            </div>
          ))}
          <span className="sv-hero-back">
            <PlayingCardBack />
          </span>
        </div>
        <div>
          <h1>칠 이어놓기</h1>
          <p>7을 가운데 놓고 같은 무늬로 위아래 숫자를 이어 내요. 낼 카드가 없으면 통과! 손에 든 카드를 먼저 다 내면 이겨요.</p>
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
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="sv-resume">
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
              <input type="radio" name="sv-hand-view" checked={opt.handView === m.value} onChange={() => setOpt({ handView: m.value })} />
              <span>
                <strong>{m.title}</strong>
                <small>{m.desc}</small>
              </span>
            </label>
          ))}
        </div>
        {opt.handView === 'cover' && humans < 2 && <p className="sv-note">사람이 1명이면 가릴 필요가 없어서 내 카드가 항상 보여요.</p>}
      </section>

      <section className="setup-section">
        <h2>규칙</h2>
        <div className="rule-grid">
          <label className="rule-item">
            <input type="checkbox" checked={opt.passLimit} onChange={(e) => setOpt({ passLimit: e.target.checked })} data-testid="sv-pass-limit" />
            <span>
              <strong>통과 {MAX_PASSES}번 제한</strong>
              <small>통과는 한 판에 {MAX_PASSES}번까지! 4번째로 통과해야 하면 탈락하고, 손에 든 카드를 모두 판의 제자리에 내려놓아요.</small>
            </span>
          </label>
        </div>

        <h3 className="sub-title">언제 끝낼까요?</h3>
        <div className="rule-grid">
          {END_MODES.map((m) => (
            <div key={m.value}>
              <label className="rule-item">
                <input type="radio" name="sv-end-mode" checked={opt.endMode === m.value} onChange={() => setOpt({ endMode: m.value })} data-testid={`sv-end-${m.value}`} />
                <span>
                  <strong>{m.title}</strong>
                  <small>{m.desc}</small>
                </span>
              </label>
              {m.value === 'points' && (
                <div className="rule-extra">
                  <IconPicker
                    caption="목표 점수"
                    inline
                    small
                    dimmed={opt.endMode !== 'points'}
                    value={opt.targetScore}
                    options={TARGET_SCORES.map((v) => ({ value: v, short: `${v}점` }))}
                    onChange={(v) => setOpt({ endMode: 'points', targetScore: v })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="setup-section setup-footer">
        <SpeedPicker caption="컴퓨터·애니메이션 속도" value={settings.speed} onChange={(speed) => onSettings({ ...settings, speed })} inline />
        <button type="button" className="btn btn-primary btn-large" disabled={count < 2} onClick={() => onStart(setup)} data-testid="sv-start">
          게임 시작
        </button>
      </section>

      <details className="how-to">
        <summary>놀이 방법</summary>
        <ol>
          <li>카드 52장을 모두 나눠 가져요. (사람 수에 따라 한 장씩 더 받는 사람이 있어도 괜찮아요)</li>
          <li>♦7(다이아 7)을 가진 사람이 먼저 판 가운데에 놓으며 시작해요. 저절로 놓여요.</li>
          <li>내 차례에는 카드 한 장을 판에 내요. 7은 언제든 새 줄을 열 수 있고, 다른 카드는 같은 무늬 줄의 끝에 바로 이어지는 숫자(한 칸 위나 아래)만 낼 수 있어요.</li>
          <li>낼 수 있는 카드가 있으면 꼭 내야 해요. 낼 카드가 없으면 통과!</li>
          <li>통과 {MAX_PASSES}번 제한을 켜면, 4번째 통과를 해야 할 때 탈락하고 손에 든 카드를 모두 판의 제자리에 내려놓아요. 탈락한 사람은 카드를 다 낸 사람들보다 뒤 순위예요.</li>
          <li>손에 든 카드를 먼저 다 내면 이겨요! 남을 막는 카드는 아껴 두고, 내 카드로 이어지는 카드부터 내는 게 요령이에요.</li>
          <li>조작: 카드나 판의 빛나는 칸을 클릭, ←→로 고르고 Enter·Space로 내기, 낼 카드가 없으면 Space로 통과.</li>
        </ol>
      </details>
    </div>
  );
}
