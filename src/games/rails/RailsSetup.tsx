import { useState } from 'react';
import { ChoiceIcon, ICON_DUO, IconPicker, type IconChoice } from '../../components/IconPicker';
import { SeatPicker } from '../../components/SeatPicker';
import { SpeedPicker } from '../../components/SpeedPicker';
import { activeSeatCount } from '../common/players';
import type { GameSettings } from '../common/settings';
import { MiniKorea, StampBadge, SymbolIcon, TicketFace, TrainIcon } from './art';
import { CITY, COLOR_INFO, ROUTE_POINTS, STAMPS, TICKET_COLORS } from './map';
import { FINAL_TRAINS, TOUR_BONUS } from './rules';
import type { SavedRailsGame } from './storage';
import type { HandView, PlanStart, RailsOptions, RailsSetup, TrainCount } from './types';

interface SetupProps {
  initialSetup: RailsSetup;
  saved: SavedRailsGame | null;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onStart: (setup: RailsSetup) => void;
  onResume: () => void;
  onBack: () => void;
}

const HAND_VIEWS: { value: HandView; title: string; desc: string }[] = [
  {
    value: 'cover',
    title: '차례 넘김 화면 (가리기)',
    desc: '사람이 2명 이상이면 차례마다 "내 표와 계획 보기"를 눌러요. 다른 사람은 그동안 눈을 감아 주세요.',
  },
  { value: 'open', title: '모두 공개 (배우기용)', desc: '차례인 사람의 표와 여행 계획을 늘 보여 줘요. 컴퓨터 것도 보여요! 함께 배우며 할 때 좋아요.' },
];

const PLAN_STARTS: { value: PlanStart; title: string; desc: string }[] = [
  { value: 'basic', title: '기본', desc: '처음에 여행 계획 3장을 보고 2장 이상 가져요.' },
  { value: 'kids', title: '어린이', desc: '처음에 여행 계획을 2장만 보고 1장 이상 가져요. 신경 쓸 계획이 적어서 쉬워요.' },
];

function TrainsIcon({ many }: { many: boolean }) {
  return (
    <ChoiceIcon>
      <rect x={3} y={13} width={9} height={8} rx={2} {...ICON_DUO} />
      <rect x={14} y={13} width={9} height={8} rx={2} {...ICON_DUO} />
      {many && <rect x={25} y={13} width={5} height={8} rx={2} {...ICON_DUO} />}
      <path d="M2 25 H30" fill="none" stroke="currentColor" strokeWidth={2} />
    </ChoiceIcon>
  );
}

const TRAIN_CHOICES: IconChoice<TrainCount>[] = [
  { value: 30, short: '30칸', label: '기차 30칸 (보통)', icon: <TrainsIcon many={false} /> },
  { value: 40, short: '40칸', label: '기차 40칸 (긴 게임)', icon: <TrainsIcon many /> },
];

/** 머리 그림: 작은 지도 위를 달리는 기차와 기차표 */
function HeroArt() {
  return (
    <div className="rl-hero-art" aria-hidden="true">
      <span className="rl-hero-map">
        <MiniKorea a="seoul" b="busan" size={150} />
      </span>
      <svg viewBox="0 0 200 60" className="rl-hero-train">
        <path d="M0 50 H200" stroke="#6b4a2b" strokeWidth={3} />
        {Array.from({ length: 14 }, (_, i) => (
          <rect key={i} x={i * 15 + 2} y={47} width={8} height={7} rx={1} fill="#8a6a48" />
        ))}
        <g className="rl-hero-cars">
          {['#3e63dd', '#f5b400', '#30a46c'].map((c, i) => (
            <g key={c} transform={`translate(${12 + i * 38} 26)`}>
              <rect width={34} height={18} rx={4} fill={c} stroke="rgba(0,0,0,0.35)" />
              <rect x={4} y={4} width={26} height={6} rx={2} fill="#fff" opacity={0.85} />
              <circle cx={8} cy={20} r={4} fill="#2b2724" />
              <circle cx={26} cy={20} r={4} fill="#2b2724" />
            </g>
          ))}
          <g transform="translate(128 14)">
            <rect x={0} y={12} width={30} height={18} rx={4} fill="#e5484d" stroke="rgba(0,0,0,0.35)" />
            <rect x={18} y={2} width={18} height={28} rx={4} fill="#e5484d" stroke="rgba(0,0,0,0.35)" />
            <rect x={22} y={6} width={10} height={8} rx={2} fill="#fff" opacity={0.9} />
            <rect x={5} y={4} width={6} height={9} rx={2} fill="#5a3a22" />
            <circle cx={8} cy={32} r={4} fill="#2b2724" />
            <circle cx={28} cy={32} r={4} fill="#2b2724" />
          </g>
          <g className="rl-hero-smoke">
            <circle cx={136} cy={10} r={5} />
            <circle cx={128} cy={2} r={6.5} />
            <circle cx={118} cy={-4} r={5} />
          </g>
        </g>
      </svg>
      <span className="rl-hero-ticket rl-hero-ticket-a">
        <TicketFace kind="blue" />
      </span>
      <span className="rl-hero-ticket rl-hero-ticket-b">
        <TicketFace kind="wild" />
      </span>
    </div>
  );
}

export function RailsSetupScreen({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: SetupProps) {
  const [setup, setSetup] = useState<RailsSetup>(initialSetup);
  const count = activeSeatCount(setup.seats);
  const humans = setup.seats.filter((s) => s.kind === 'human').length;
  const opt = setup.options;
  const setOpt = (patch: Partial<RailsOptions>) => setSetup({ ...setup, options: { ...opt, ...patch } });

  return (
    <div className="setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="rl-hero">
        <HeroArt />
        <div>
          <h1>기차로 전국 일주</h1>
          <p>기차표를 모아 우리나라 도시 사이에 기찻길을 깔아요. 몰래 정한 여행 계획의 두 도시를 내 기찻길로 잇고, 관광 도장도 모아요!</p>
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
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="rl-resume">
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
        <h3 className="sub-title">처음 여행 계획</h3>
        <div className="rule-grid">
          {PLAN_STARTS.map((m) => (
            <label key={m.value} className="rule-item">
              <input type="radio" name="rl-plan-start" checked={opt.planStart === m.value} onChange={() => setOpt({ planStart: m.value })} data-testid={`rl-plan-${m.value}`} />
              <span>
                <strong>{m.title}</strong>
                <small>{m.desc}</small>
              </span>
            </label>
          ))}
        </div>
        <div className="rl-setup-row">
          <IconPicker caption="한 사람의 기차" value={opt.trains} options={TRAIN_CHOICES} onChange={(trains) => setOpt({ trains })} testId="rl-trains" />
          <p className="rl-note">
            40칸은 길게 하고 싶을 때 (2~3명에게 알맞아요). 누군가의 기차가 {FINAL_TRAINS}칸 이하로 남으면 모두 한 번씩 더 하고 끝나요.
          </p>
        </div>
        <div className="rule-grid rl-rule-check">
          <label className="rule-item">
            <input type="checkbox" checked={opt.stamps} onChange={(e) => setOpt({ stamps: e.target.checked })} data-testid="rl-stamps" />
            <span>
              <strong>🏅 관광 도장</strong>
              <small>명소가 있는 8개 도시에 처음 기찻길을 이으면 큰 도장 +3점, 나중에 와도 작은 도장 +1점.</small>
            </span>
          </label>
        </div>
      </section>

      <section className="setup-section">
        <h2>표와 계획 보기</h2>
        <div className="rule-grid">
          {HAND_VIEWS.map((m) => (
            <label key={m.value} className="rule-item">
              <input type="radio" name="rl-hand-view" checked={opt.handView === m.value} onChange={() => setOpt({ handView: m.value })} data-testid={`rl-view-${m.value}`} />
              <span>
                <strong>{m.title}</strong>
                <small>{m.desc}</small>
              </span>
            </label>
          ))}
        </div>
        {opt.handView === 'cover' && humans < 2 && <p className="rl-note">사람이 1명이면 가릴 필요가 없어서 내 표와 계획이 늘 보여요.</p>}
      </section>

      <section className="setup-section setup-footer">
        <SpeedPicker caption="컴퓨터·애니메이션 속도" value={settings.speed} onChange={(speed) => onSettings({ ...settings, speed })} inline />
        <button type="button" className="btn btn-primary btn-large" disabled={count < 2} onClick={() => onStart(setup)} data-testid="rl-start">
          출발!
        </button>
      </section>

      <details className="how-to">
        <summary>놀이 방법</summary>
        <div className="rl-howto">
          <div className="rl-howto-step">
            <span className="rl-howto-art rl-howto-cards">
              {(['red', 'blue', 'wild'] as const).map((k) => (
                <span key={k} className="rl-card rl-howto-card">
                  <TicketFace kind={k} />
                </span>
              ))}
            </span>
            <p>
              <b>1. 기차표</b> — 표는 여섯 색이고 색마다 모양이 있어요 (
              {TICKET_COLORS.map((c) => (
                <span key={c} className="rl-inline-sym">
                  <SymbolIcon kind={c} size={13} />
                  {COLOR_INFO[c].name}
                </span>
              ))}
              ). <b>만능 고속열차표</b>는 어떤 색 대신으로도 쓸 수 있는데, 창구에는 나오지 않고 더미에서만 나와요. 처음에 표 4장을 받아요.
            </p>
          </div>
          <div className="rl-howto-step">
            <span className="rl-howto-art">
              <MiniKorea a="mokpo" b="gangneung" size={64} />
            </span>
            <p>
              <b>2. 여행 계획</b> — 두 도시가 적힌 비밀 카드예요. 끝날 때 두 도시가 <b>내 기찻길로 이어져 있으면 +점수, 아니면 −점수</b>! 처음에 3장을 보고 2장 이상 가져요.
            </p>
          </div>
          <div className="rl-howto-step">
            <span className="rl-howto-art rl-howto-emoji">🎫🛤️🗺️</span>
            <div>
              <p>
                <b>3. 내 차례에는 셋 중 하나만 해요.</b>
              </p>
              <ol>
                <li>
                  <b>표 받기</b>: 창구(앞면 5장)나 더미에서 표 2장을 받아요. 한 장 받을 때마다 창구가 다시 채워져요.
                </li>
                <li>
                  <b>기찻길 깔기</b>: 빈 길 하나를 골라 그 길 칸 수만큼 <b>같은 색 표</b>를 내요. 회색 길은 아무 한 색으로나 깔 수 있어요. 바로 점수를 받아요:{' '}
                  {[1, 2, 3, 4, 5].map((n) => `${n}칸 ${ROUTE_POINTS[n]}점`).join(' · ')}.
                </li>
                <li>
                  <b>여행 계획 뽑기</b>: 계획 3장을 보고 1장 이상 가져요.
                </li>
              </ol>
            </div>
          </div>
          <div className="rl-howto-step">
            <span className="rl-howto-art rl-howto-stamps">
              {STAMPS.slice(0, 4).map((s) => (
                <StampBadge key={s.city} icon={s.icon} size={28} first />
              ))}
            </span>
            <p>
              <b>4. 관광 도장</b> — {STAMPS.map((s) => `${CITY[s.city].name} ${s.name}`).join(', ')}. 그 도시에 닿는 기찻길을 처음 깐 사람은 큰 도장(+3), 나중에 온 사람도 작은 도장(+1)을 받아요.
            </p>
          </div>
          <div className="rl-howto-step">
            <span className="rl-howto-art">
              <TrainIcon color="#e5484d" size={30} />
            </span>
            <p>
              <b>5. 끝과 점수</b> — 누군가의 기차가 {FINAL_TRAINS}칸 이하로 남으면 그 사람을 포함해 모두 한 번씩 더 하고 끝나요. 기찻길 점수 + 여행 계획(±) + 도장 + <b>전국 일주 상</b>(하나로 이어진 내 기찻길이 가장 많은 도시에 닿은 사람 +{TOUR_BONUS}, 같으면 모두)을 더해요.
            </p>
          </div>
          <p className="rl-howto-tip">
            💡 작전: 계획에 필요한 길이 막히기 전에 먼저 깔아 두세요. 다른 사람이 같은 곳을 노리는 것 같으면 서둘러요! 길은 한 줄뿐이라 먼저 깐 사람이 주인이에요.
          </p>
          <p className="rl-howto-tip">
            ⌨️ 조작: 창구 표 <kbd>1</kbd>~<kbd>5</kbd> · 더미 <kbd>D</kbd> · 계획 뽑기 <kbd>P</kbd> · 길을 눌러(또는 <kbd>Tab</kbd>으로 골라 <kbd>Enter</kbd>) 깔기, 낼 표 고르기 <kbd>←</kbd>
            <kbd>→</kbd>, 닫기 <kbd>Esc</kbd>
          </p>
        </div>
      </details>
    </div>
  );
}
