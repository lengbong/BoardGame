import { useState } from 'react';
import { SeatPicker } from '../../components/SeatPicker';
import { SpeedPicker } from '../../components/SpeedPicker';
import { activeSeatCount } from '../common/players';
import { CLASSIC_RULES, EASY_RULES } from './rules';
import type { SavedGame, Settings } from './storage';
import type { GameSetup, RuleOptions } from './types';

interface SetupProps {
  initialSetup: GameSetup;
  saved: SavedGame | null;
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onStart: (setup: GameSetup) => void;
  onResume: () => void;
  onBack: () => void;
}


const RULE_TEXT: { key: keyof RuleOptions; title: string; desc: string }[] = [
  { key: 'needSixToEnter', title: '6이 나와야 출발', desc: '끄면 아무 수나 나와도 대기실에서 말을 꺼낼 수 있어요.' },
  { key: 'bonusOnSix', title: '6이 나오면 한 번 더', desc: '6이 나오면 말을 움직이고 주사위를 한 번 더 굴려요.' },
  { key: 'threeSixesEndsTurn', title: '6이 세 번 연속이면 차례 끝', desc: '6이 세 번 연속 나오면 욕심쟁이! 차례가 넘어가요.' },
  { key: 'bonusOnCaptureOrFinish', title: '잡거나 골인하면 한 번 더', desc: '상대 말을 잡거나 내 말이 골인하면 한 번 더 굴려요.' },
  { key: 'safeSquares', title: '안전칸 (★)', desc: '시작칸과 별칸에 있는 말은 잡히지 않아요.' },
  { key: 'exactFinish', title: '정확한 수로만 골인', desc: '끄면 남은 칸보다 큰 수가 나와도 골인할 수 있어요.' },
  { key: 'stopAtFirstWinner', title: '1등이 나오면 끝', desc: '켜면 1등이 나오는 순간 게임이 끝나요. 끄면 끝까지 순위를 정해요.' },
];


function sameRules(a: RuleOptions, b: RuleOptions): boolean {
  return (Object.keys(a) as (keyof RuleOptions)[]).every((k) => a[k] === b[k]);
}

export function Setup({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: SetupProps) {
  const [setup, setSetup] = useState<GameSetup>(initialSetup);
  const count = activeSeatCount(setup.seats);

  const setRule = (key: keyof RuleOptions, value: boolean) => setSetup({ ...setup, rules: { ...setup.rules, [key]: value } });

  return (
    <div className="setup">
      <header className="setup-header">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← 게임 목록
        </button>
        <div>
          <h1>말판 경주</h1>
          <p>주사위를 굴려 내 말 4개를 먼저 가운데 골인 지점까지 보내면 이겨요!</p>
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
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="resume">
            이어하기
          </button>
        </section>
      )}

      <section className="setup-section">
        <h2>누가 할까요?</h2>
        <SeatPicker seats={setup.seats} onChange={(seats) => setSetup({ ...setup, seats })} />
      </section>

      <section className="setup-section">
        <div className="section-title-row">
          <h2>규칙</h2>
          <div className="preset-buttons">
            <button
              type="button"
              className={`btn btn-small${sameRules(setup.rules, CLASSIC_RULES) ? ' btn-selected' : ''}`}
              onClick={() => setSetup({ ...setup, rules: CLASSIC_RULES })}
            >
              정통 규칙
            </button>
            <button
              type="button"
              className={`btn btn-small${sameRules(setup.rules, EASY_RULES) ? ' btn-selected' : ''}`}
              onClick={() => setSetup({ ...setup, rules: EASY_RULES })}
            >
              쉬운 규칙 (어린이용)
            </button>
          </div>
        </div>
        <div className="rule-grid">
          {RULE_TEXT.map((r) => (
            <label key={r.key} className="rule-item">
              <input type="checkbox" checked={setup.rules[r.key]} onChange={(e) => setRule(r.key, e.target.checked)} />
              <span>
                <strong>{r.title}</strong>
                <small>{r.desc}</small>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="setup-section setup-footer">
        <SpeedPicker caption="컴퓨터·애니메이션 속도" value={settings.speed} onChange={(speed) => onSettings({ ...settings, speed })} inline />
        <button
          type="button"
          className="btn btn-primary btn-large"
          disabled={count < 2}
          onClick={() => onStart(setup)}
          data-testid="start"
        >
          게임 시작
        </button>
      </section>

      <details className="how-to">
        <summary>놀이 방법</summary>
        <ol>
          <li>차례가 되면 주사위를 굴려요. (마우스 클릭 또는 Space 키)</li>
          <li>나온 수만큼 내 말 하나를 시계 방향으로 움직여요. 움직일 수 있는 말은 반짝여요. (클릭 또는 숫자키 1~4)</li>
          <li>대기실의 말은 내 색 시작칸으로 나와요. (정통 규칙에서는 6이 나와야 해요)</li>
          <li>상대 말이 있는 칸에 도착하면 그 말을 잡아서 대기실로 돌려보내요. ★ 안전칸에서는 잡을 수 없어요.</li>
          <li>판을 한 바퀴 돌면 내 색 결승 통로로 들어가 가운데까지 가면 골인!</li>
          <li>말 4개를 모두 골인시키면 이겨요.</li>
        </ol>
      </details>
    </div>
  );
}
