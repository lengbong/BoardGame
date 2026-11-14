import { useState } from 'react';
import { IconPicker } from '../../components/IconPicker';
import { SeatPicker } from '../../components/SeatPicker';
import { SpeedPicker } from '../../components/SpeedPicker';
import { activeSeatCount } from '../common/players';
import { CityArt } from './art/cities';
import { GlobeLogo } from './art/tiles';
import type { SavedWorldGame, WorldSettings } from './storage';
import type { EndMode, WorldSetup as Setup } from './types';

interface WorldSetupProps {
  initialSetup: Setup;
  saved: SavedWorldGame | null;
  settings: WorldSettings;
  onSettings: (settings: WorldSettings) => void;
  onStart: (setup: Setup) => void;
  onResume: () => void;
  onBack: () => void;
}

const HERO_CITIES = ['seoul', 'paris', 'cairo', 'tokyo', 'newyork', 'sydney'];

const END_MODES: { value: EndMode; title: string; desc: string }[] = [
  { value: 'rounds', title: '정해진 라운드까지', desc: '라운드가 끝나면 총자산(돈 + 땅 + 건물)이 많은 순서로 순위를 정해요.' },
  { value: 'first-bankrupt', title: '한 명이 파산하면 끝', desc: '누군가 파산하는 순간 끝나고, 남은 사람은 총자산으로 순위를 정해요.' },
  { value: 'last-standing', title: '끝까지 (한 명 남을 때까지)', desc: '마지막 한 명이 남을 때까지 해요. 1시간 넘게 걸릴 수 있어요.' },
];

export function WorldSetup({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: WorldSetupProps) {
  const [setup, setSetup] = useState<Setup>(initialSetup);
  const count = activeSeatCount(setup.seats);
  const opt = setup.options;
  const setOpt = (patch: Partial<Setup['options']>) => setSetup({ ...setup, options: { ...opt, ...patch } });

  return (
    <div className="setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="world-hero">
        <div className="world-hero-strip" aria-hidden="true">
          {HERO_CITIES.map((id) => (
            <CityArt key={id} id={id} className="world-hero-art" />
          ))}
        </div>
        <div className="world-hero-title">
          <GlobeLogo className="world-hero-globe" />
          <div>
            <h1>지구 한 바퀴</h1>
            <p>세계 22개 도시를 여행하며 땅을 사고 건물을 지어요. 다른 사람이 내 도시에 오면 통행료를 받아요!</p>
          </div>
        </div>
      </header>

      {saved && (
        <section className="resume-card">
          <div>
            <strong>하던 게임이 있어요.</strong>
            <span>
              {' '}
              {saved.state.players.map((p) => p.name).join(' · ')} — {saved.state.round}라운드 —{' '}
              {new Date(saved.savedAt).toLocaleString('ko-KR')}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="world-resume">
            이어하기
          </button>
        </section>
      )}

      <section className="setup-section">
        <h2>누가 할까요?</h2>
        <SeatPicker seats={setup.seats} onChange={(seats) => setSetup({ ...setup, seats })} />
      </section>

      <section className="setup-section">
        <h2>게임 설정</h2>
        <div className="world-options">
          <IconPicker
            caption="시작할 때 돈"
            small
            value={opt.startCash}
            options={[1000, 1500, 2000].map((v) => ({ value: v, short: `${v.toLocaleString('ko-KR')}코인` }))}
            onChange={(v) => setOpt({ startCash: v })}
          />
          <IconPicker
            caption="출발 칸 월급"
            small
            value={opt.salary}
            options={[100, 150, 200, 300].map((v) => ({ value: v, short: `${v}코인` }))}
            onChange={(v) => setOpt({ salary: v })}
          />
        </div>

        <h3 className="sub-title">언제 끝낼까요?</h3>
        <div className="rule-grid end-modes">
          {END_MODES.map((m) => (
            <div key={m.value}>
              <label className="rule-item">
                <input type="radio" name="end-mode" checked={opt.endMode === m.value} onChange={() => setOpt({ endMode: m.value })} />
                <span>
                  <strong>{m.title}</strong>
                  <small>{m.desc}</small>
                </span>
              </label>
              {m.value === 'rounds' && (
                <div className="rule-extra">
                  <IconPicker
                    caption="라운드 수"
                    inline
                    small
                    dimmed={opt.endMode !== 'rounds'}
                    value={opt.maxRounds}
                    options={[10, 15, 20, 30].map((r) => ({ value: r, short: `${r}라운드` }))}
                    onChange={(r) => setOpt({ endMode: 'rounds', maxRounds: r })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="setup-section setup-footer">
        <SpeedPicker caption="컴퓨터·애니메이션 속도" value={settings.speed} onChange={(speed) => onSettings({ ...settings, speed })} inline />
        <button type="button" className="btn btn-primary btn-large" disabled={count < 2} onClick={() => onStart(setup)} data-testid="world-start">
          게임 시작
        </button>
      </section>

      <details className="how-to">
        <summary>놀이 방법</summary>
        <ol>
          <li>주사위 2개를 굴려 나온 수만큼 시계 방향으로 가요. 같은 숫자(더블)가 나오면 한 번 더! (세 번 연속이면 여권 분실)</li>
          <li>주인 없는 도시에 오면 땅을 살 수 있어요. 돈이 넉넉하면 집·빌딩·호텔까지 한 번에 지을 수도 있어요.</li>
          <li>내 도시에 다시 오면 건물을 더 올릴 수 있어요. 건물이 높을수록 통행료가 비싸져요.</li>
          <li>다른 사람 도시에 가면 통행료를 내요. 돈이 모자라면 건물과 땅을 반값에 팔고, 그래도 모자라면 파산!</li>
          <li>🧳 여행 카드: 돈을 받거나 내고, 이동하거나, 나중에 쓸 카드를 받아요.</li>
          <li>🛂 여권 분실: 2번 쉬어요. 더블이 나오거나 여권 재발급 카드가 있으면 바로 나가요.</li>
          <li>🎉 세계 축제: 내 도시 하나를 골라 통행료를 2배로 만들어요.</li>
          <li>✈️ 비행기: 원하는 칸으로 바로 날아가요. 출발 칸을 지나면 월급도 받아요.</li>
        </ol>
      </details>
    </div>
  );
}
