import type { CSSProperties } from 'react';
import { useState } from 'react';
import { PlayingCardBack, PlayingCardFace } from '../../components/PlayingCard';
import { SeatPicker } from '../../components/SeatPicker';
import { activeSeatCount } from '../common/players';
import { makeCard, makeJoker } from '../common/playingCards';
import type { GameSettings } from '../common/settings';
import { SPEEDS, SPEED_LABELS, type Speed } from '../common/speed';
import type { SavedOldMaidGame } from './storage';
import type { HandView, OldMaidSetup } from './types';

interface SetupProps {
  initialSetup: OldMaidSetup;
  saved: SavedOldMaidGame | null;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onStart: (setup: OldMaidSetup) => void;
  onResume: () => void;
  onBack: () => void;
}

const HERO = [makeCard('heart', 7), makeCard('spade', 7), makeJoker(), makeCard('diamond', 12), makeCard('club', 12)];

const HAND_VIEWS: { value: HandView; title: string; desc: string }[] = [
  {
    value: 'cover',
    title: '차례 넘김 화면 (손패 가리기)',
    desc: '사람이 2명 이상이면 내 차례에 "내 카드 보기"를 눌러야 손패가 보여요. 다른 사람은 그동안 눈을 감아 주세요.',
  },
  { value: 'open', title: '모두 공개 (배우기용)', desc: '모든 손패를 펼쳐 보여요. 조커가 어디 있는지 보면서 규칙을 익힐 때 좋아요.' },
];

export function OldMaidSetupScreen({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: SetupProps) {
  const [setup, setSetup] = useState<OldMaidSetup>(initialSetup);
  const count = activeSeatCount(setup.seats);
  const humans = setup.seats.filter((s) => s.kind === 'human').length;
  const opt = setup.options;

  return (
    <div className="setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="om-hero">
        <div className="om-hero-fan" aria-hidden="true">
          {HERO.map((c, i) => (
            <span key={c.id} className={`om-hero-card${c.suit === null ? ' om-hero-joker' : ''}`} style={{ '--i': i - 2 } as CSSProperties}>
              <PlayingCardFace card={c} />
            </span>
          ))}
          <span className="om-hero-card om-hero-back">
            <PlayingCardBack />
          </span>
        </div>
        <div>
          <h1>도둑잡기</h1>
          <p>옆 사람 카드를 한 장씩 뽑아 같은 숫자 두 장을 버려요. 마지막까지 도둑(조커)을 들고 있는 사람이 져요!</p>
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
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="om-resume">
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
              <input
                type="radio"
                name="om-hand-view"
                checked={opt.handView === m.value}
                onChange={() => setSetup({ ...setup, options: { ...opt, handView: m.value } })}
                data-testid={`om-view-${m.value}`}
              />
              <span>
                <strong>{m.title}</strong>
                <small>{m.desc}</small>
              </span>
            </label>
          ))}
        </div>
        {opt.handView === 'cover' && humans < 2 && <p className="om-note">사람이 1명이면 가릴 필요가 없어서 내 카드가 항상 보여요.</p>}
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
        <button type="button" className="btn btn-primary btn-large" disabled={count < 2} onClick={() => onStart(setup)} data-testid="om-start">
          게임 시작
        </button>
      </section>

      <details className="how-to">
        <summary>놀이 방법</summary>
        <ol>
          <li>카드 52장에 조커(도둑) 1장을 더해 모두 나눠 가져요.</li>
          <li>먼저 손에 든 카드 중 같은 숫자 두 장(무늬는 달라도 돼요)을 모두 버려요. 저절로 버려져요.</li>
          <li>내 차례가 되면 다음 사람의 카드를 뒷면만 보고 한 장 뽑아요. 뽑은 카드와 같은 숫자가 내 손에 있으면 두 장을 버려요.</li>
          <li>카드를 다 털면 빠져요. 먼저 빠질수록 높은 등수예요.</li>
          <li>조커는 짝이 없어요. 마지막까지 조커를 들고 있는 사람이 도둑! 🦹</li>
          <li>🔀 섞기를 누르면 내 카드 순서가 섞여서 다른 사람이 조커 자리를 알 수 없어요. 컴퓨터도 뽑을 때마다 섞어요.</li>
          <li>조작: 카드는 클릭, ←→로 고르고 Space나 Enter로 뽑기, 숫자키 1~9로 바로 고르기, S로 섞기.</li>
        </ol>
      </details>
    </div>
  );
}
