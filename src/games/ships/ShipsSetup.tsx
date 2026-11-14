import { useState } from 'react';
import { DuelPicker } from '../../components/DuelPicker';
import { SpeedPicker } from '../../components/SpeedPicker';
import type { DuelSide } from '../common/duel';
import type { GameSettings } from '../common/settings';
import { FLEETS } from './fleet';
import { SIDES } from './rules';
import { ShipHull, ShipIcon, SideIcon } from './ShipArt';
import type { SavedShipsGame } from './storage';
import type { RevealMode, SeaSize, ShipsOptions, ShipsSetup as Setup } from './types';

interface ShipsSetupProps {
  initialSetup: Setup;
  saved: SavedShipsGame | null;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onStart: (setup: Setup) => void;
  onResume: () => void;
  onBack: () => void;
}

const PICKER_SIDES: [DuelSide, DuelSide] = [
  { ...SIDES[0], icon: <SideIcon /> },
  { ...SIDES[1], icon: <SideIcon /> },
];

const SIZES: { value: SeaSize; title: string; desc: string }[] = [
  { value: 10, title: '10×10 넓은 바다 (기본)', desc: '항공모함 5칸, 전함 4칸, 순양함 3칸, 잠수함 3칸, 구축함 2칸 — 모두 5척' },
  { value: 8, title: '8×8 작은 바다 (어린이용)', desc: '항공모함 없이 전함 4칸, 순양함 3칸, 잠수함 3칸, 구축함 2칸 — 모두 4척. 금방 끝나요.' },
];

const RULES: { key: 'noTouch' | 'extraTurn'; title: string; desc: string }[] = [
  { key: 'noTouch', title: '배끼리 붙이지 않기', desc: '배와 배 사이에 한 칸 이상 바다를 두어요. 대각선으로 닿아도 안 돼요.' },
  { key: 'extraTurn', title: '맞히면 한 번 더', desc: '명중하거나 격침하면 한 번 더 쏴요. 빗나갈 때까지 계속!' },
];

const REVEALS: { value: RevealMode; title: string; desc: string }[] = [
  { value: 'cover', title: '차례 넘김 화면 (바다 가리기)', desc: '사람 둘이 할 때 차례마다 화면을 가려서, 서로의 배를 못 보게 해요.' },
  { value: 'open', title: '모두 공개 (배우기용)', desc: '상대 배 자리가 흐리게 보여요. 아이와 규칙을 익힐 때 좋아요.' },
];

function Hero() {
  return (
    <svg className="sh-hero-art" viewBox="0 0 260 150" aria-hidden="true">
      <defs>
        <linearGradient id="sh-hero-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f9bd3" />
          <stop offset="1" stopColor="#1b5d8f" />
        </linearGradient>
        <pattern id="sh-hero-waves" width="26" height="13" patternUnits="userSpaceOnUse">
          <path d="M0 6 Q3.25 3 6.5 6 T13 6 M13 12 Q16.25 9 19.5 12 T26 12" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" fill="none" />
        </pattern>
      </defs>
      <rect width="260" height="150" rx="14" fill="url(#sh-hero-sea)" />
      <rect className="sh-hero-waves" x="-26" width="312" height="150" fill="url(#sh-hero-waves)" />
      <path
        d={Array.from({ length: 13 }, (_, i) => `M${10 + i * 20} 10 V140`).join(' ') + ' ' + Array.from({ length: 7 }, (_, i) => `M10 ${10 + i * 21.6} H250`).join(' ')}
        stroke="rgba(255,255,255,0.16)"
        strokeWidth="0.8"
      />
      <g className="sh-hero-ship" transform="translate(28 30) scale(2.1)">
        <ShipHull id="battleship" />
      </g>
      <g className="sh-hero-ship sh-hero-ship2" transform="translate(150 96) scale(2.1)">
        <ShipHull id="submarine" />
      </g>
      <g className="sh-hero-ship sh-hero-ship3" transform="translate(222 40) rotate(90) scale(2.1)">
        <ShipHull id="destroyer" />
      </g>
      <g transform="translate(78 108)">
        <circle className="sh-hero-ripple" r="14" />
        <circle className="sh-hero-ripple sh-hero-ripple2" r="14" />
        <circle r="5" fill="#fff" />
        <circle r="9" fill="none" stroke="#fff" strokeWidth="1.6" opacity="0.6" />
      </g>
      <g transform="translate(188 53)" className="sh-hero-boom">
        <polygon
          points={Array.from({ length: 16 }, (_, i) => {
            const a = (i * Math.PI) / 8;
            const r = i % 2 === 0 ? 17 : 8;
            return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
          }).join(' ')}
          fill="#ffb02e"
          stroke="#e03b24"
          strokeWidth="2"
        />
        <circle r="6" fill="#fff3b0" />
      </g>
      <text x="16" y="142" fill="#fff" fontSize="13" fontWeight="800" opacity="0.85">
        C7 명중!
      </text>
    </svg>
  );
}

export function ShipsSetup({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: ShipsSetupProps) {
  const [setup, setSetup] = useState<Setup>(initialSetup);
  const opt = setup.options;
  const humans = setup.seats.filter((s) => s.kind === 'human').length;
  const setOpt = (patch: Partial<ShipsOptions>) => setSetup({ ...setup, options: { ...opt, ...patch } });

  return (
    <div className="setup sh-scope">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="sh-hero">
        <Hero />
        <div>
          <h1>배 찾기</h1>
          <p>바다에 배를 숨기고 번갈아 좌표를 불러 상대 배를 찾아요. 상대 배를 먼저 모두 가라앉히면 이겨요!</p>
        </div>
      </header>

      {saved && (
        <section className="resume-card">
          <div>
            <strong>하던 게임이 있어요.</strong>
            <span>
              {' '}
              {saved.state.players.map((p) => p.name).join(' 대 ')} — {saved.state.options.size}×{saved.state.options.size} 바다
              {saved.state.phase === 'battle' ? `, ${saved.state.shots}발 쏨` : ', 배 숨기는 중'} — {new Date(saved.savedAt).toLocaleString('ko-KR')}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="sh-resume">
            이어하기
          </button>
        </section>
      )}

      <section className="setup-section">
        <h2>누가 할까요?</h2>
        <DuelPicker seats={setup.seats} sides={PICKER_SIDES} onChange={(seats) => setSetup({ ...setup, seats })} firstNote="먼저 쏴요" />
        <p className="sh-note">
          {humans === 2
            ? '사람 둘: 한 사람씩 몰래 배를 숨기고, 차례마다 화면을 넘겨요.'
            : humans === 1
              ? '컴퓨터는 배를 무작위로 숨기고, 내 바다와 상대 바다가 함께 보여요.'
              : '컴퓨터끼리 겨루는 모습을 구경해요. 두 바다가 모두 보여요.'}
        </p>
      </section>

      <section className="setup-section">
        <h2>바다 크기</h2>
        <div className="rule-grid">
          {SIZES.map((s) => (
            <label key={s.value} className="rule-item">
              <input type="radio" name="sh-size" checked={opt.size === s.value} onChange={() => setOpt({ size: s.value })} />
              <span>
                <strong>{s.title}</strong>
                <small>{s.desc}</small>
                <span className="sh-fleet-preview" aria-hidden="true">
                  {FLEETS[s.value].map((spec) => (
                    <ShipIcon key={spec.id} id={spec.id} cell={12} />
                  ))}
                </span>
              </span>
            </label>
          ))}
        </div>

        <h3 className="sub-title">규칙</h3>
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

        <h3 className="sub-title">바다 보기</h3>
        <div className="rule-grid">
          {REVEALS.map((m) => (
            <label key={m.value} className="rule-item">
              <input type="radio" name="sh-reveal" checked={opt.reveal === m.value} onChange={() => setOpt({ reveal: m.value })} />
              <span>
                <strong>{m.title}</strong>
                <small>{m.desc}</small>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="setup-section setup-footer">
        <SpeedPicker caption="컴퓨터·애니메이션 속도" value={settings.speed} onChange={(speed) => onSettings({ ...settings, speed })} inline />
        <button type="button" className="btn btn-primary btn-large" onClick={() => onStart(setup)} data-testid="sh-start">
          게임 시작
        </button>
      </section>

      <details className="how-to">
        <summary>놀이 방법</summary>
        <ol>
          <li>
            먼저 내 바다에 배를 숨겨요. 배를 끌어다 놓거나, 배를 누른 뒤 바다 칸을 눌러요. <kbd>R</kbd>·오른쪽 클릭·↻ 버튼으로 가로/세로를 바꾸고,
            "무작위로 놓기"로 한 번에 놓을 수도 있어요. 배는 서로 겹치면 안 돼요.
          </li>
          <li>
            10×10 바다에는 5척(항공모함 5칸, 전함 4칸, 순양함 3칸, 잠수함 3칸, 구축함 2칸), 8×8 작은 바다에는 항공모함을 뺀 4척을 숨겨요. 작은
            바다는 칸이 적어서 금방 찾을 수 있어 어린이에게 좋아요.
          </li>
          <li>왼쪽 자리부터 번갈아 상대 바다의 칸 하나를 골라 포탄을 쏴요. 좌표는 열(A, B, C…)과 행(1, 2, 3…)으로 불러요. 예: "C7!"</li>
          <li>배가 없으면 💦 물보라(하얀 점), 배를 맞히면 🔥 명중(불꽃과 X), 배의 모든 칸을 맞히면 격침! 가라앉은 배는 모양이 드러나요.</li>
          <li>상대 배를 먼저 모두 가라앉히면 이겨요. 끝나면 두 바다를 나란히 펼쳐 보여 줘요.</li>
          <li>
            변형 규칙: "배끼리 붙이지 않기"를 켜면 배 사이에 한 칸씩 띄워야 해요(대각선 포함). "맞히면 한 번 더"를 켜면 맞힐 때마다 한 번 더 쏴요.
          </li>
          <li>
            조작: 쏠 칸은 클릭, 또는 <kbd>방향키</kbd>로 조준하고 <kbd>Enter</kbd>. 배 놓을 때는 <kbd>방향키</kbd> + <kbd>Enter</kbd>,{' '}
            <kbd>R</kbd> 돌리기, 숫자키로 배 고르기.
          </li>
          <li>컴퓨터: 쉬움은 아무 데나, 보통은 맞힌 곳 주변을 노리고, 어려움은 배가 있을 확률이 가장 높은 칸을 계산해서 쏴요.</li>
        </ol>
      </details>
    </div>
  );
}
