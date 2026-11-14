import { useState, type CSSProperties } from 'react';
import { IconPicker } from '../../components/IconPicker';
import { SeatPicker } from '../../components/SeatPicker';
import { SpeedPicker } from '../../components/SpeedPicker';
import { activeSeatCount } from '../common/players';
import { ROUND_CHOICES, TIME_CHOICES } from './rules';
import type { SavedTilesGame, TilesSettings } from './storage';
import { TileFace } from './TileArt';
import type { EndMode, HandView, Tile, TilesOptions, TilesSetup as Setup } from './types';

interface TilesSetupProps {
  initialSetup: Setup;
  saved: SavedTilesGame | null;
  settings: TilesSettings;
  onSettings: (settings: TilesSettings) => void;
  onStart: (setup: Setup) => void;
  onResume: () => void;
  onBack: () => void;
}

const HERO: Tile[][] = [
  [
    { id: -1, color: 'red', value: 7, joker: false },
    { id: -2, color: 'red', value: 8, joker: false },
    { id: -3, color: 'red', value: 9, joker: false },
  ],
  [
    { id: -4, color: 'blue', value: 5, joker: false },
    { id: -5, color: 'black', value: 5, joker: false },
    { id: -6, color: null, value: 0, joker: true },
    { id: -7, color: 'green', value: 5, joker: false },
  ],
];

const HAND_VIEWS: { value: HandView; title: string; desc: string }[] = [
  {
    value: 'cover',
    title: '차례 넘김 화면 (타일 가리기)',
    desc: '사람이 2명 이상이면 내 차례에 "내 타일 보기"를 눌러야 타일이 보여요. 다른 사람은 그동안 눈을 감아 주세요.',
  },
  { value: 'open', title: '모두 공개 (배우기용)', desc: '컴퓨터 타일까지 모두 보여요. 아이와 함께 규칙을 익힐 때 좋아요.' },
];

const REARRANGE: { value: boolean; title: string; desc: string }[] = [
  { value: true, title: '정통 규칙', desc: '판 위의 타일을 뜯어서 다시 조합할 수 있어요. 차례가 끝날 때 판의 모든 줄이 올바르면 돼요.' },
  { value: false, title: '간단 규칙 (어린이용)', desc: '판의 줄은 그대로 두고, 내 타일로 새 줄을 만들거나 기존 줄에 붙이기만 해요.' },
];

const END_MODES: { value: EndMode; title: string; desc: string }[] = [
  { value: 'single', title: '한 판 승부', desc: '타일을 먼저 다 낸 사람이 우승! 나머지는 남은 타일 점수가 적은 순서로 순위를 정해요.' },
  { value: 'rounds', title: '여러 판', desc: '판마다 이긴 사람은 다른 사람들의 남은 타일 점수를 받고, 나머지는 자기 남은 점수만큼 잃어요. 합계로 순위!' },
];

export function TilesSetup({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: TilesSetupProps) {
  const [setup, setSetup] = useState<Setup>(initialSetup);
  const count = activeSeatCount(setup.seats);
  const humans = setup.seats.filter((s) => s.kind === 'human').length;
  const opt = setup.options;
  const setOpt = (patch: Partial<TilesOptions>) => setSetup({ ...setup, options: { ...opt, ...patch } });

  return (
    <div className="setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="tl-hero">
        <div className="tl-hero-sets" aria-hidden="true">
          {HERO.map((set, i) => (
            <div key={i} className="tl-hero-set" style={{ '--i': i } as CSSProperties}>
              {set.map((t) => (
                <TileFace key={t.id} tile={t} jokerValue={t.joker ? 5 : undefined} />
              ))}
            </div>
          ))}
        </div>
        <div>
          <h1>숫자 타일 줄세우기</h1>
          <p>같은 색 연속 숫자(7·8·9)나 같은 숫자 다른 색(5·5·5)으로 줄을 만들어 내 타일을 먼저 다 내면 이겨요!</p>
        </div>
      </header>

      {saved && (
        <section className="resume-card">
          <div>
            <strong>하던 게임이 있어요.</strong>
            <span>
              {' '}
              {saved.state.players.map((p) => p.name).join(' · ')}
              {saved.state.options.endMode === 'rounds' ? ` — ${saved.state.round}번째 판` : ''} — {new Date(saved.savedAt).toLocaleString('ko-KR')}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="tl-resume">
            이어하기
          </button>
        </section>
      )}

      <section className="setup-section">
        <h2>누가 할까요?</h2>
        <SeatPicker seats={setup.seats} onChange={(seats) => setSetup({ ...setup, seats })} />
      </section>

      <section className="setup-section">
        <h2>타일 보기</h2>
        <div className="rule-grid">
          {HAND_VIEWS.map((m) => (
            <label key={m.value} className="rule-item">
              <input type="radio" name="tl-hand-view" checked={opt.handView === m.value} onChange={() => setOpt({ handView: m.value })} />
              <span>
                <strong>{m.title}</strong>
                <small>{m.desc}</small>
              </span>
            </label>
          ))}
        </div>
        {opt.handView === 'cover' && humans < 2 && <p className="tl-note">사람이 1명이면 가릴 필요가 없어서 내 타일이 항상 보여요.</p>}
      </section>

      <section className="setup-section">
        <h2>규칙</h2>
        <div className="rule-grid">
          {REARRANGE.map((m) => (
            <label key={String(m.value)} className="rule-item">
              <input type="radio" name="tl-rearrange" checked={opt.rearrange === m.value} onChange={() => setOpt({ rearrange: m.value })} />
              <span>
                <strong>{m.title}</strong>
                <small>{m.desc}</small>
              </span>
            </label>
          ))}
          <label className="rule-item">
            <input type="checkbox" checked={opt.initialMeld} onChange={(e) => setOpt({ initialMeld: e.target.checked })} />
            <span>
              <strong>첫 등록 30점</strong>
              <small>처음 낼 때는 내 타일만으로 합이 30 이상인 줄을 내야 해요. 그 전에는 판의 타일을 건드릴 수 없어요.</small>
            </span>
          </label>
          <div>
            <label className="rule-item">
              <input type="checkbox" checked={opt.turnTime > 0} onChange={(e) => setOpt({ turnTime: e.target.checked ? TIME_CHOICES[0] : 0 })} />
              <span>
                <strong>차례 시간 제한</strong>
                <small>시간이 다 되면 판이 올바를 때는 그대로 완료, 아니면 되돌리고 타일을 1개 가져와요. (사람만)</small>
              </span>
            </label>
            <div className="rule-extra">
              <IconPicker
                caption="제한 시간"
                inline
                small
                dimmed={opt.turnTime === 0}
                value={opt.turnTime || TIME_CHOICES[0]}
                options={TIME_CHOICES.map((v) => ({ value: v, short: `${v / 60}분` }))}
                onChange={(v) => setOpt({ turnTime: v })}
              />
            </div>
          </div>
        </div>

        <h3 className="sub-title">언제 끝낼까요?</h3>
        <div className="rule-grid">
          {END_MODES.map((m) => (
            <div key={m.value}>
              <label className="rule-item">
                <input type="radio" name="tl-end-mode" checked={opt.endMode === m.value} onChange={() => setOpt({ endMode: m.value })} />
                <span>
                  <strong>{m.title}</strong>
                  <small>{m.desc}</small>
                </span>
              </label>
              {m.value === 'rounds' && (
                <div className="rule-extra">
                  <IconPicker
                    caption="판 수"
                    inline
                    small
                    dimmed={opt.endMode !== 'rounds'}
                    value={opt.rounds}
                    options={ROUND_CHOICES.map((v) => ({ value: v, short: `${v}판` }))}
                    onChange={(v) => setOpt({ endMode: 'rounds', rounds: v })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="setup-section setup-footer">
        <SpeedPicker caption="컴퓨터 속도" value={settings.speed} onChange={(speed) => onSettings({ ...settings, speed })} inline />
        <button type="button" className="btn btn-primary btn-large" disabled={count < 2} onClick={() => onStart(setup)} data-testid="tl-start">
          게임 시작
        </button>
      </section>

      <details className="how-to">
        <summary>놀이 방법</summary>
        <ol>
          <li>타일은 1~13 숫자가 4가지 색으로 2벌씩, 조커 2개까지 모두 106개예요. 14개씩 나눠 가져요.</li>
          <li>줄은 두 가지: 같은 색 연속 숫자 3개 이상(빨강 7·8·9), 또는 같은 숫자 색이 모두 다른 3~4개(5·5·5).</li>
          <li>조커는 아무 타일이나 대신해요. 판 위의 조커 아래 작은 숫자가 대신하는 숫자예요.</li>
          <li>내 차례: 타일을 눌러 고르고(여러 개 가능), 줄 끝의 ＋를 누르면 거기에 붙고, "새 줄 만들기"를 누르면 새 줄이 돼요. 끌어다 놓아도 돼요.</li>
          <li>다 놓았으면 "완료". 판의 모든 줄이 올바라야 해요. 낼 게 없으면 "1개 가져오기"로 차례를 마쳐요.</li>
          <li>정통 규칙에서는 판에 있던 타일도 뜯어서 다시 조합할 수 있어요. 단, 판의 타일을 내 칸으로 가져올 수는 없어요.</li>
          <li>첫 등록: 처음 낼 때는 내 타일만으로 합 30점 이상! (규칙을 켰을 때)</li>
          <li>타일을 먼저 다 내면 이겨요. 남은 타일 점수: 숫자 그대로, 조커는 30점.</li>
          <li>색마다 모양이 있어요: 빨강 ●, 파랑 ◆, 초록 잎, 검정 ★. 조작: Enter 완료, Esc 고른 것 취소, N 새 줄.</li>
        </ol>
      </details>
    </div>
  );
}
