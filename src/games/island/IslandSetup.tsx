import { useState } from 'react';
import { ChoiceIcon, ICON_DUO, IconPicker, type IconChoice } from '../../components/IconPicker';
import { SeatPicker } from '../../components/SeatPicker';
import { SpeedPicker } from '../../components/SpeedPicker';
import { activeSeatCount } from '../common/players';
import type { GameSettings } from '../common/settings';
import { BuildIcon, FlagIcon, HeroIsland, NumberToken, ResourceIcon } from './Art';
import { BUILD_INFO, BUILD_KINDS, COSTS, FLAG_MIN, HAND_LIMIT, RESOURCES, RES_INFO, playerName, points } from './rules';
import type { SavedIslandGame } from './storage';
import type { IslandOptions, IslandSetup, TargetPoints } from './types';

interface SetupProps {
  initialSetup: IslandSetup;
  saved: SavedIslandGame | null;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onStart: (setup: IslandSetup) => void;
  onResume: () => void;
  onBack: () => void;
}

/** 목표 점수 아이콘: 깃대에 별이 하나·둘·셋 */
function TargetIcon({ stars }: { stars: number }) {
  return (
    <ChoiceIcon>
      <path d="M7 4 V28" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
      <path d="M8 5 H25 L21 11 L25 17 H8 Z" {...ICON_DUO} />
      {Array.from({ length: stars }, (_, i) => (
        <circle key={i} cx={12 + i * 4.5} cy={11} r={1.6} fill="currentColor" />
      ))}
    </ChoiceIcon>
  );
}

const TARGET_CHOICES: IconChoice<TargetPoints>[] = [
  { value: 8, short: '8점', label: '8점 (짧게)', icon: <TargetIcon stars={1} /> },
  { value: 10, short: '10점', label: '10점 (보통)', icon: <TargetIcon stars={2} /> },
  { value: 12, short: '12점', label: '12점 (길게)', icon: <TargetIcon stars={3} /> },
];

export function IslandSetupScreen({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: SetupProps) {
  const [setup, setSetup] = useState<IslandSetup>(initialSetup);
  const count = activeSeatCount(setup.seats);
  const opt = setup.options;
  const setOpt = (patch: Partial<IslandOptions>) => setSetup({ ...setup, options: { ...opt, ...patch } });

  return (
    <div className="setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="is-hero">
        <HeroIsland />
        <div>
          <h1>섬마을 개척</h1>
          <p>
            주사위 두 개를 굴려 쓸 눈을 하나 고르면, 그 숫자의 숲·돌산·밭·어장에서 자원이 나와요. 나무·돌·곡식·물고기를 모아 길과 집, 마을회관, 등대를 지어 섬마을을 키워요. 먼저 {opt.target}점을 모으면 승리!
          </p>
        </div>
      </header>

      {saved && (
        <section className="resume-card">
          <div>
            <strong>하던 게임이 있어요.</strong>
            <span>
              {' '}
              {saved.state.players.map((p, i) => `${playerName(p)} ${points(saved.state, i)}점`).join(' · ')}
              {saved.state.phase === 'setup' ? ' — 처음 집 놓는 중' : ` — ${saved.state.round}바퀴째`} — {new Date(saved.savedAt).toLocaleString('ko-KR')}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="is-resume">
            이어하기
          </button>
        </section>
      )}

      <section className="setup-section">
        <h2>누가 할까요?</h2>
        <SeatPicker seats={setup.seats} onChange={(seats) => setSetup({ ...setup, seats })} />
        <p className="is-note">누가 먼저 할지는 주사위로 정해요. 자원은 모두에게 보여서 차례 넘김 화면 없이 함께 해요.</p>
      </section>

      <section className="setup-section">
        <h2>규칙</h2>
        <IconPicker caption="목표 점수" inline value={opt.target} options={TARGET_CHOICES} onChange={(target) => setOpt({ target })} testId="is-target" />
        <div className="rule-grid is-rule-grid">
          <label className="rule-item">
            <input type="checkbox" checked={opt.market} onChange={(e) => setOpt({ market: e.target.checked })} data-testid="is-opt-market" />
            <span>
              <strong>🧺 장터</strong>
              <small>앞면으로 놓인 자원 4개 중 하나와 내 자원 1개를 차례마다 한 번 맞바꿀 수 있어요. 내가 준 자원은 장터에 남아요.</small>
            </span>
          </label>
          <label className="rule-item">
            <input type="checkbox" checked={opt.harvest} onChange={(e) => setOpt({ harvest: e.target.checked })} data-testid="is-opt-harvest" />
            <span>
              <strong>🌾 풍년 규칙 (두 눈 모두, 빨리 끝나요)</strong>
              <small>고르지 않고 두 눈과 같은 숫자의 땅이 모두 자원을 내요. 자원이 많이 나와서 판이 절반쯤으로 짧아져요.</small>
            </span>
          </label>
          <label className="rule-item">
            <input type="checkbox" checked={opt.helper} onChange={(e) => setOpt({ helper: e.target.checked })} data-testid="is-opt-helper" />
            <span>
              <strong>🌱 초보 도움</strong>
              <small>지을 수 있는 자리가 반짝이고 ⭐ 추천 자리를 보여 줘요. 모자란 자원과 지을 수 있는 것도 알려 줘요.</small>
            </span>
          </label>
        </div>
      </section>

      <section className="setup-section setup-footer">
        <SpeedPicker caption="컴퓨터·애니메이션 속도" value={settings.speed} onChange={(speed) => onSettings({ ...settings, speed })} inline />
        <button type="button" className="btn btn-primary btn-large" disabled={count < 2} onClick={() => onStart(setup)} data-testid="is-start">
          게임 시작
        </button>
      </section>

      <details className="how-to is-how-to">
        <summary>놀이 방법</summary>
        <ol>
          <li>
            <b>처음 집 놓기</b>: 순서대로 집 1채와 길 1개를 놓고, 마지막 사람부터 거꾸로 한 번 더 놓아요. 두 번째 집에 닿은 땅마다 자원을 하나씩 받고 시작해요.
          </li>
          <li>
            <b>골라 쓰는 주사위</b>: 내 차례에 주사위 두 개를 굴리고, <b>두 눈 중 하나를 골라요</b>. 고른 숫자가 적힌 땅만 자원을 내요. 누가 무엇을 받는지 미리 보여 주니, 나는 많이 받고 남은 덜 받는 눈을 골라 보세요! 같은 눈 두 개(예: 4·4)면 고르지 않고 그 땅이 <b>두 번</b> 내요. (풍년 규칙을 켜면 두 눈의 땅이 모두 내요.)
            <span className="is-howto-row" aria-hidden="true">
              <svg viewBox="-20 -20 40 40" width={38} height={38}>
                <NumberToken n={3} cx={0} cy={0} />
              </svg>
              숫자 아래 점은 주사위 눈과 같아요.
            </span>
          </li>
          <li>
            <b>자원 받기</b>: 그 땅의 모서리에 건물이 있으면 주인이 받아요. 집은 1개, 마을회관은 2개. 남의 차례에도 받아요!
            <span className="is-howto-row" aria-hidden="true">
              {RESOURCES.map((r) => (
                <span key={r} className="is-howto-res">
                  <ResourceIcon res={r} size={22} /> {RES_INFO[r].name}
                </span>
              ))}
            </span>
            숲 → 나무, 돌산 → 돌, 밭 → 곡식, 갯벌·어장 → 물고기. 등대 언덕에서는 아무것도 나지 않아요.
          </li>
          <li>
            <b>짓기</b>: 길은 내 길이나 건물에 이어서, 집은 내 길이 닿은 모서리에 (다른 건물과 변 두 칸 이상 떨어지게). 마을회관은 내 집을 키운 것, 등대는 바닷가 내 집에 하나만 세워요.
            <span className="is-howto-costs">
              {BUILD_KINDS.map((k) => (
                <span key={k} className="is-howto-cost">
                  <BuildIcon kind={k} color="#e5484d" dark="#a52a2f" shape="circle" size={40} />
                  <b>{BUILD_INFO[k].name}</b>
                  <span>
                    {RESOURCES.filter((r) => COSTS[k][r] > 0).map((r) => (
                      <span key={r} className="is-howto-pay">
                        <ResourceIcon res={r} size={22} />
                        {COSTS[k][r] > 1 && `×${COSTS[k][r]}`}
                      </span>
                    ))}
                  </span>
                  <small>{k === 'road' ? '점수 없음' : k === 'house' ? '1점' : k === 'hall' ? '2점 · 2개씩' : '+2점 · 은행 2:1'}</small>
                </span>
              ))}
            </span>
          </li>
          <li>
            <b>바꾸기</b>: 은행에서 같은 자원 3개를 아무 자원 1개로 바꿔요 (등대가 있으면 2개). 장터를 켜면 차례마다 한 번 장터의 자원과 1:1로 맞바꿀 수 있어요.
          </li>
          <li>
            <FlagIcon size={18} /> <b>바다 축제 깃발</b> (+2점): 내 건물이 닿은 서로 다른 땅이 {FLAG_MIN}칸 이상이고 가장 많으면 받아요. 가진 사람보다 <b>더 많아야</b> 빼앗아 와요.
          </li>
          <li>
            <b>손 제한</b>: 차례를 마칠 때 자원이 {HAND_LIMIT}개보다 많으면 {HAND_LIMIT}개가 되도록 골라서 내려놓아요. 남으면 바꾸거나 지어 두세요!
          </li>
          <li>
            <b>승리</b>: 내 차례를 마칠 때 목표 점수만큼 모았으면 이겨요. (집 1점, 마을회관 2점, 등대 2점, 축제 깃발 2점)
          </li>
          <li>
            조작: 주사위 <kbd>Space</kbd> · 쓸 눈 고르기 <kbd>1</kbd>·<kbd>2</kbd> · 짓기 <kbd>B</kbd> (그다음 <kbd>1</kbd>~<kbd>4</kbd>) · 바꾸기 <kbd>T</kbd> · 차례 마치기 <kbd>Enter</kbd> · 취소 <kbd>Esc</kbd>. 반짝이는 자리는 Tab으로 옮겨 Enter로 골라도 돼요.
          </li>
        </ol>
      </details>
    </div>
  );
}
