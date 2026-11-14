import { useState } from 'react';
import { IconPicker } from '../../components/IconPicker';
import { SeatPicker } from '../../components/SeatPicker';
import { SpeedPicker } from '../../components/SpeedPicker';
import { activeSeatCount } from '../common/players';
import type { GameSettings } from '../common/settings';
import { HiveIcon, Rosette, TokenIcon } from './Art';
import { CARDS } from './cards';
import { PlantCardView } from './PlantCard';
import { playerName } from './rules';
import type { SavedGardenGame } from './storage';
import type { GardenOptions, GardenSetup, TargetScore, Token } from './types';

interface SetupProps {
  initialSetup: GardenSetup;
  saved: SavedGardenGame | null;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onStart: (setup: GardenSetup) => void;
  onResume: () => void;
  onBack: () => void;
}

const TARGETS: TargetScore[] = [12, 15, 18];
const TARGET_NOTE: Record<TargetScore, string> = { 12: '짧게', 15: '보통', 18: '길게' };

const byName = (name: string) => CARDS.find((c) => c.name === name)!;

/** 머리 그림: 텃밭 한 줄을 거두고, 씨앗 봉투 식물 두 장, 상장 하나 */
function HeroArt() {
  const field: Token[] = ['water', 'sun', 'seed', 'bee', 'compost', 'water', 'sun', 'seed', 'compost'];
  return (
    <div className="gd-hero-art" aria-hidden="true">
      <div className="gd-hero-field">
        {field.map((t, i) => (
          <span key={i} className={i >= 3 && i < 6 ? 'gd-hero-hot' : ''} style={{ animationDelay: `${i * 0.06}s` }}>
            <TokenIcon token={t} size={26} />
          </span>
        ))}
      </div>
      <div className="gd-hero-cards">
        <PlantCardView card={byName('해바라기')} className="gd-hero-card gd-hero-card-a" />
        <PlantCardView card={byName('튤립')} sale className="gd-hero-card gd-hero-card-b" />
      </div>
      <span className="gd-hero-rosette">
        <Rosette goal="flowers4" size={52} />
      </span>
    </div>
  );
}

function Tok({ t }: { t: Token }) {
  return <TokenIcon token={t} size={18} className="gd-inline-token" />;
}

export function GardenSetupScreen({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: SetupProps) {
  const [setup, setSetup] = useState<GardenSetup>(initialSetup);
  const count = activeSeatCount(setup.seats);
  const opt = setup.options;
  const setOpt = (patch: Partial<GardenOptions>) => setSetup({ ...setup, options: { ...opt, ...patch } });

  return (
    <div className="setup gd-setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="gd-hero">
        <HeroArt />
        <div>
          <h1>꽃밭 가꾸기</h1>
          <p>동네 꽃 박람회가 열렸어요! 텃밭에서 물·햇빛·씨앗·거름을 거두어 꽃시장에서 식물을 사 심어요. 심은 식물은 자원을 만들어 다음 식물을 싸게 해 줘요. 꽃 점수를 가장 많이 모으면 이겨요.</p>
        </div>
      </header>

      {saved && (
        <section className="resume-card">
          <div>
            <strong>하던 게임이 있어요.</strong>
            <span>
              {' '}
              {saved.state.players.map((p) => playerName(p)).join(' · ')} — {saved.state.round}라운드 —{' '}
              {new Date(saved.savedAt).toLocaleString('ko-KR')}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="gd-resume">
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
        <IconPicker
          caption="목표 점수 (먼저 닿으면 그 라운드까지)"
          inline
          small
          value={opt.target}
          options={TARGETS.map((v) => ({ value: v, short: `${v}점`, label: `${v}점 (${TARGET_NOTE[v]})` }))}
          onChange={(v) => setOpt({ target: v })}
          testId="gd-target"
        />
        <div className="rule-grid gd-rule-grid">
          <label className="rule-item">
            <input type="checkbox" checked={opt.sale} onChange={(e) => setOpt({ sale: e.target.checked })} data-testid="gd-opt-sale" />
            <span>
              <strong>🏷️ 떨이</strong>
              <small>꽃시장 줄 맨 끝 두 장은 자원을 1개 덜 내요. 곧 시들 식물을 싸게 살 기회!</small>
            </span>
          </label>
          <label className="rule-item">
            <input type="checkbox" checked={opt.ribbons} onChange={(e) => setOpt({ ribbons: e.target.checked })} data-testid="gd-opt-ribbons" />
            <span>
              <strong>🏵️ 박람회 상장</strong>
              <small>상장 3개를 펼쳐 놓아요. 조건을 가장 먼저 이룬 사람이 3점을 받아요. 처음 배울 때는 꺼도 좋아요.</small>
            </span>
          </label>
        </div>
      </section>

      <section className="setup-section setup-footer">
        <SpeedPicker caption="컴퓨터·애니메이션 속도" value={settings.speed} onChange={(speed) => onSettings({ ...settings, speed })} inline />
        <button type="button" className="btn btn-primary btn-large" disabled={count < 2} onClick={() => onStart(setup)} data-testid="gd-start">
          게임 시작
        </button>
      </section>

      <details className="how-to gd-how-to">
        <summary>놀이 방법</summary>
        <p className="gd-how-goal">
          🌼 식물을 심어 <b>꽃 점수</b>를 모아요. 누군가 목표 점수(기본 15점)에 닿으면 그 라운드를 끝까지 마치고(모두 같은 횟수), 점수가 가장 높은 사람이 이겨요. 점수가 같으면 식물을 더 적게 심은 사람이 이겨요.
        </p>
        <div className="gd-how-actions">
          <div>
            <h3>🧺 거두기</h3>
            <p>
              3×3 텃밭에서 <b>가로줄이나 세로줄</b> 하나를 골라 토큰 3개를 모두 가져와요. 빈칸은 주머니에서 다시 채워요.
            </p>
            <p className="gd-how-tokens">
              <Tok t="water" /> 물 <Tok t="sun" /> 햇빛 <Tok t="seed" /> 씨앗 <Tok t="compost" /> 거름 <Tok t="bee" /> 꿀벌(아무 자원 대신)
            </p>
          </div>
          <div>
            <h3>🌱 심기</h3>
            <p>꽃시장이나 내 온실의 식물을 사서 심어요. 카드 아래 토큰이 값이에요. 낸 토큰은 주머니로 돌아가요.</p>
            <p>
              심은 식물은 카드 왼쪽 아래 자원을 <b>계속 만들어서</b> 다음 식물 값을 그만큼 깎아 줘요. 예: <Tok t="water" />을 만드는 식물이 2장이면 <Tok t="water" /> 값이 2개 싸져요.
            </p>
          </div>
          <div>
            <h3>🏡 온실에 맡기기</h3>
            <p>
              꽃시장 식물 하나를 내 온실(2칸)에 맡아 두고 벌통에서 <HiveIcon size={18} /> <Tok t="bee" /> 꿀벌 1마리를 받아요. 온실은 모두에게 보이고, 나만 심을 수 있어요.
            </p>
          </div>
        </div>
        <ol>
          <li>꽃시장은 한 줄 6장이에요. 새 식물은 왼쪽으로 들어오고, 한 장이 팔리면 뒤의 식물이 앞으로 밀려요.</li>
          <li>🏷️ 오른쪽 끝 두 장은 떨이: 자원 1개를 덜 내요. 라운드가 끝날 때마다 맨 끝 식물이 🥀 시들고 새 식물이 들어와요.</li>
          <li>계절: 봄 식물(싸고 0~1점)이 먼저 나오고, 여름, 가을 식물(비싸고 3~5점)이 차례로 나와요. 처음엔 싼 식물로 생산을 늘리는 게 좋아요!</li>
          <li>🏵️ 박람회 상장 3개: 꽃 4장, 나무 3장처럼 조건을 가장 먼저 이룬 사람이 바로 3점을 받아요.</li>
          <li>덤이 있는 식물: 🚿 물뿌리개(💧 2개 받기) · 🏠 새집(🐝 1마리 받기) · 🎃 허수아비(내 채소 1장마다 1점).</li>
          <li>바구니: 차례가 끝날 때 토큰은 10개까지만 둘 수 있어요. 넘치면 골라서 주머니에 돌려놓아요.</li>
          <li>조작: 텃밭 줄 끝 화살표(▶ ▼)를 누르면 거두기, 식물을 누르면 고르기(두 번 누르면 바로 심기). 키보드: ↑↓ 텃밭·꽃시장 오가기, ←→ 고르기, Enter 거두기·심기, R 맡기기, Esc 취소.</li>
        </ol>
      </details>
    </div>
  );
}
