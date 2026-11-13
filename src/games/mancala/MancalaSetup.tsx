import { useState } from 'react';
import { DuelPicker } from '../../components/DuelPicker';
import { SpeedPicker } from '../../components/SpeedPicker';
import type { GameSettings } from '../common/settings';
import { HeroBoard } from './Board';
import { SEED_COUNTS, sideName } from './rules';
import { DUEL_SIDES } from './SideIcon';
import type { SavedMancalaGame } from './storage';
import type { MancalaOptions, MancalaSetup as Setup } from './types';

interface MancalaSetupProps {
  initialSetup: Setup;
  saved: SavedMancalaGame | null;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onStart: (setup: Setup) => void;
  onResume: () => void;
  onBack: () => void;
}

const SEED_DESC: Record<number, string> = {
  3: '빨리 끝나요 (36개)',
  4: '보통 (48개)',
  5: '길게 (60개)',
  6: '아주 길게 (72개)',
};

export function MancalaSetup({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: MancalaSetupProps) {
  const [setup, setSetup] = useState<Setup>(initialSetup);
  const opt = setup.options;
  const setOpt = (patch: Partial<MancalaOptions>) => setSetup({ ...setup, options: { ...opt, ...patch } });
  const humans = setup.seats.filter((s) => s.kind === 'human').length;

  return (
    <div className="setup mc-setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="mc-hero">
        <HeroBoard />
        <div>
          <h1>만칼라</h1>
          <p>구멍의 씨앗을 한 알씩 뿌려 내 창고에 더 많이 모아요. 창고에서 끝나면 한 번 더, 빈 구멍에서 끝나면 건너편 씨앗을 가져와요!</p>
        </div>
      </header>

      {saved && (
        <section className="resume-card">
          <div>
            <strong>하던 게임이 있어요.</strong>
            <span>
              {' '}
              {sideName(saved.state, 0)} {saved.state.board[6]} : {saved.state.board[13]} {sideName(saved.state, 1)} —{' '}
              {new Date(saved.savedAt).toLocaleString('ko-KR')}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="mc-resume">
            이어하기
          </button>
        </section>
      )}

      <section className="setup-section">
        <h2>누가 할까요?</h2>
        <DuelPicker seats={setup.seats} sides={DUEL_SIDES} onChange={(seats) => setSetup({ ...setup, seats })} />
        <p className="mc-note">
          {humans === 1
            ? '사람이 1명이면 그 사람 구멍이 항상 판 아래쪽에 와요.'
            : humans === 2
              ? '두 사람이 할 때는 왼쪽 자리(먼저 하는 편)가 판 아래쪽이에요. 숨길 것이 없어서 화면을 가리지 않아요.'
              : '컴퓨터끼리 두는 모습을 구경할 수 있어요.'}
        </p>
      </section>

      <section className="setup-section">
        <h2>구멍마다 씨앗 몇 개?</h2>
        <div className="mc-seed-options" role="radiogroup" aria-label="구멍마다 씨앗 수">
          {SEED_COUNTS.map((n) => (
            <label key={n} className={`mc-seed-option${opt.seeds === n ? ' is-selected' : ''}`}>
              <input type="radio" name="mc-seeds" checked={opt.seeds === n} onChange={() => setOpt({ seeds: n })} />
              <span className="mc-seed-dots" aria-hidden="true">
                {Array.from({ length: n }, (_, i) => (
                  <i key={i} style={{ background: ['#e0464e', '#f2b025', '#3b8fe0', '#2fae74', '#9461d9', '#f2784b'][i] }} />
                ))}
              </span>
              <strong>{n}개</strong>
              <small>{SEED_DESC[n]}</small>
            </label>
          ))}
        </div>

        <h3 className="sub-title">규칙</h3>
        <div className="rule-grid">
          <label className="rule-item">
            <input type="checkbox" checked={opt.captureEmpty} onChange={(e) => setOpt({ captureEmpty: e.target.checked })} />
            <span>
              <strong>건너편이 비어도 가져오기</strong>
              <small>비어 있던 내 구멍에서 끝났는데 건너편이 비어 있어도, 마지막 씨앗 한 알을 창고로 가져와요. (끄면 정통 규칙: 건너편에 씨앗이 있을 때만)</small>
            </span>
          </label>
          <label className="rule-item">
            <input type="checkbox" checked={opt.sweep === 'emptier'} onChange={(e) => setOpt({ sweep: e.target.checked ? 'emptier' : 'owner' })} />
            <span>
              <strong>남은 씨앗은 먼저 빈 쪽이 가져가기</strong>
              <small>한쪽 구멍이 모두 비면 판에 남은 씨앗을 모두 그 사람이 가져가요. (끄면 정통 규칙: 남은 씨앗은 그 구멍 주인의 창고로)</small>
            </span>
          </label>
          <label className="rule-item">
            <input type="checkbox" checked={opt.undo} onChange={(e) => setOpt({ undo: e.target.checked })} />
            <span>
              <strong>무르기 (컴퓨터와 할 때)</strong>
              <small>내가 둔 수를 되돌릴 수 있어요. 컴퓨터가 그 뒤에 둔 수도 함께 돌아가요.</small>
            </span>
          </label>
          <label className="rule-item">
            <input type="checkbox" checked={setup.hints} onChange={(e) => setSetup({ ...setup, hints: e.target.checked })} />
            <span>
              <strong>도움말: 마지막 씨앗 위치 보기</strong>
              <small>내 구멍에 마우스를 올리거나 키보드로 고르면 마지막 씨앗이 떨어질 곳과 "한 번 더", "가져오기"를 미리 보여 줘요.</small>
            </span>
          </label>
        </div>
      </section>

      <section className="setup-section setup-footer">
        <SpeedPicker caption="컴퓨터·애니메이션 속도" value={settings.speed} onChange={(speed) => onSettings({ ...settings, speed })} inline />
        <button type="button" className="btn btn-primary btn-large" onClick={() => onStart(setup)} data-testid="mc-start">
          게임 시작
        </button>
      </section>

      <details className="how-to">
        <summary>놀이 방법</summary>
        <ol>
          <li>판에는 내 구멍 6개(내 쪽 줄)와 내 오른쪽 끝의 큰 창고가 있어요. 처음에 구멍마다 씨앗을 똑같이 넣어요.</li>
          <li>내 차례에 씨앗이 있는 내 구멍 하나를 골라요. 씨앗을 모두 집어 오른쪽(시계 반대 방향)으로 한 칸에 한 알씩 넣어요.</li>
          <li>내 창고에도 한 알 넣지만, 상대 창고는 건너뛰어요. 씨앗이 많으면 판을 한 바퀴 돌아 처음 구멍에도 넣어요.</li>
          <li>마지막 씨앗이 내 창고에 들어가면 <strong>한 번 더!</strong></li>
          <li>마지막 씨앗이 비어 있던 내 구멍에 떨어지고 건너편 상대 구멍에 씨앗이 있으면, 둘 다 내 창고로 <strong>가져와요</strong>.</li>
          <li>어느 한쪽 구멍 6개가 모두 비면 끝! 남은 씨앗은 그 구멍 주인의 창고로 가요. 창고에 씨앗이 더 많은 사람이 이겨요. (같으면 비김)</li>
          <li>조작: 반짝이는 구멍을 클릭하거나 숫자키 1~6 (내 쪽에서 보아 왼쪽부터), 또는 ←→로 고르고 Enter. 무르기 U, 도움말 H.</li>
        </ol>
      </details>
    </div>
  );
}
