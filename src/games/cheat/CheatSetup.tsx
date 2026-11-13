import type { CSSProperties } from 'react';
import { useState } from 'react';
import { PlayingCardBack } from '../../components/PlayingCard';
import { SeatPicker } from '../../components/SeatPicker';
import { activeSeatCount } from '../common/players';
import type { GameSettings } from '../common/settings';
import { SPEEDS, SPEED_LABELS, type Speed } from '../common/speed';
import { DEAL_COUNTS } from './rules';
import type { SavedCheatGame } from './storage';
import type { CheatOptions, CheatSetup, DealSize, DoubtRule, HandView } from './types';

interface SetupProps {
  initialSetup: CheatSetup;
  saved: SavedCheatGame | null;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onStart: (setup: CheatSetup) => void;
  onResume: () => void;
  onBack: () => void;
}

const HAND_VIEWS: { value: HandView; title: string; desc: string }[] = [
  {
    value: 'cover',
    title: '차례 넘김 화면 (손패 가리기)',
    desc: '사람이 2명 이상이면 내가 카드를 내거나 의심할 때마다 "내 카드 보기"를 눌러요. 다른 사람은 그동안 눈을 감아 주세요.',
  },
  { value: 'open', title: '모두 공개 (배우기용)', desc: '모든 손패를 펼쳐 보여요. 누가 거짓말을 하는지 보면서 규칙을 익힐 때 좋아요. 컴퓨터도 다 보여요!' },
];

const DOUBT_RULES: { value: DoubtRule; title: string; desc: string }[] = [
  { value: 'anyone', title: '누구나 "거짓말!"', desc: '카드를 내면 다음 사람부터 차례로 모두가 의심할 기회가 있어요. 제일 신나요!' },
  { value: 'next', title: '다음 사람만 "거짓말!"', desc: '바로 다음 사람만 의심할 수 있어요. 사람끼리 할 때 화면을 덜 넘겨도 돼요.' },
];

function dealDesc(deal: DealSize): string {
  const c = DEAL_COUNTS[deal];
  return `2명 ${c[2]}장 · 3명 ${c[3]}장 · 4명 ${c[4]}장씩`;
}

const DEALS: { value: DealSize; title: string }[] = [
  { value: 'all', title: '보통 게임' },
  { value: 'quick', title: '빨리 하기' },
];

export function CheatSetupScreen({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: SetupProps) {
  const [setup, setSetup] = useState<CheatSetup>(initialSetup);
  const count = activeSeatCount(setup.seats);
  const humans = setup.seats.filter((s) => s.kind === 'human').length;
  const opt = setup.options;
  const setOpt = (patch: Partial<CheatOptions>) => setSetup({ ...setup, options: { ...opt, ...patch } });

  return (
    <div className="setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="ch-hero">
        <div className="ch-hero-art" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="ch-hero-card" style={{ '--i': i - 1 } as CSSProperties}>
              <PlayingCardBack />
            </span>
          ))}
          <span className="ch-hero-bubble">“7 세 장!”</span>
          <span className="ch-hero-face">🤥</span>
        </div>
        <div>
          <h1>거짓말쟁이</h1>
          <p>A, 2, 3 … 순서대로 그 숫자라고 말하며 카드를 뒷면으로 내요. 거짓말이어도 괜찮아요, 들키지만 않으면! 손에 든 카드를 먼저 다 내면 이겨요.</p>
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
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="ch-resume">
            이어하기
          </button>
        </section>
      )}

      <section className="setup-section">
        <h2>누가 할까요?</h2>
        <SeatPicker seats={setup.seats} onChange={(seats) => setSetup({ ...setup, seats })} />
      </section>

      <section className="setup-section">
        <h2>규칙</h2>
        <h3 className="sub-title">거짓말을 외칠 수 있는 사람</h3>
        <div className="rule-grid">
          {DOUBT_RULES.map((m) => (
            <label key={m.value} className="rule-item">
              <input type="radio" name="ch-doubt" checked={opt.doubt === m.value} onChange={() => setOpt({ doubt: m.value })} data-testid={`ch-doubt-${m.value}`} />
              <span>
                <strong>{m.title}</strong>
                <small>{m.desc}</small>
              </span>
            </label>
          ))}
        </div>
        <h3 className="sub-title">카드 수</h3>
        <div className="rule-grid">
          {DEALS.map((m) => (
            <label key={m.value} className="rule-item">
              <input type="radio" name="ch-deal" checked={opt.deal === m.value} onChange={() => setOpt({ deal: m.value })} data-testid={`ch-deal-${m.value}`} />
              <span>
                <strong>{m.title}</strong>
                <small>
                  {dealDesc(m.value)}. 남은 카드는 아무도 모르게 빼 둬요.
                </small>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="setup-section">
        <h2>손패 보기</h2>
        <div className="rule-grid">
          {HAND_VIEWS.map((m) => (
            <label key={m.value} className="rule-item">
              <input type="radio" name="ch-hand-view" checked={opt.handView === m.value} onChange={() => setOpt({ handView: m.value })} data-testid={`ch-view-${m.value}`} />
              <span>
                <strong>{m.title}</strong>
                <small>{m.desc}</small>
              </span>
            </label>
          ))}
        </div>
        {opt.handView === 'cover' && humans < 2 && <p className="ch-note">사람이 1명이면 가릴 필요가 없어서 내 카드가 항상 보여요.</p>}
        {opt.handView === 'cover' && humans >= 3 && opt.doubt === 'anyone' && (
          <p className="ch-note">사람이 많으면 의심할 때마다 화면을 넘겨야 해요. '다음 사람만'을 고르면 훨씬 덜 넘겨요.</p>
        )}
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
        <button type="button" className="btn btn-primary btn-large" disabled={count < 2} onClick={() => onStart(setup)} data-testid="ch-start">
          게임 시작
        </button>
      </section>

      <details className="how-to">
        <summary>놀이 방법</summary>
        <ol>
          <li>카드를 똑같이 나눠 가져요. 처음 사람은 A, 다음 사람은 2, 그다음은 3 … K 다음은 다시 A예요.</li>
          <li>내 차례에는 그 숫자라고 말하며 카드 1~4장을 뒷면으로 내요. (예: “7 두 장!”)</li>
          <li>그 숫자가 없으면? 다른 카드를 내면서 거짓말을 해요! 진짜 카드에 한 장을 몰래 섞어도 돼요.</li>
          <li>거짓말 같으면 “거짓말이야!”를 외쳐요. 카드를 뒤집어서 거짓말이면 낸 사람이, 진짜면 외친 사람이 가운데 더미를 모두 가져가요.</li>
          <li>손에 든 카드를 먼저 다 내면 이겨요. 단, 마지막 카드가 거짓말로 들키면 더미를 가져가야 해요.</li>
          <li>작전: 내 차례마다 낼 숫자는 정해져 있어요. 그 숫자 카드는 아껴 두고, 금방 쓰지 않을 카드로 거짓말하세요. 같은 숫자는 4장뿐이니 내 손에 많으면 상대 거짓말을 잡을 수 있어요!</li>
          <li>컴퓨터는 남의 카드를 몰래 보지 않아요. 자기 카드와 자기가 낸 카드만 보고 추리해요.</li>
          <li>조작: 카드를 눌러 고르고 Enter로 내기 (←→ 옮기기, Space 고르기, A 지금 숫자 모두 고르기) · 거짓말! D, 믿어요 Space.</li>
        </ol>
      </details>
    </div>
  );
}
