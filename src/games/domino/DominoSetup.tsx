import { useState, type CSSProperties } from 'react';
import { SeatPicker } from '../../components/SeatPicker';
import { activeSeatCount } from '../common/players';
import type { GameSettings } from '../common/settings';
import { SPEEDS, SPEED_LABELS, type Speed } from '../common/speed';
import { DominoBack, DominoFace } from './DominoArt';
import { PIP_COLORS } from './dominoes';
import { TARGET_SCORES, handSizeFor } from './rules';
import type { SavedDominoGame } from './storage';
import type { DominoOptions, DominoSetup as Setup, EndMode, HandView } from './types';

interface DominoSetupProps {
  initialSetup: Setup;
  saved: SavedDominoGame | null;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onStart: (setup: Setup) => void;
  onResume: () => void;
  onBack: () => void;
}

/** 제목 그림: 탁자 위에 이어 놓은 패 몇 개 */
const HERO: { a: number; b: number; x: number; y: number; r: number }[] = [
  { a: 2, b: 6, x: 0, y: 30, r: 0 },
  { a: 6, b: 6, x: 81, y: 10, r: 90 },
  { a: 6, b: 4, x: 123, y: 30, r: 0 },
  { a: 4, b: 1, x: 204, y: 30, r: 90 },
];

const HAND_VIEWS: { value: HandView; title: string; desc: string }[] = [
  {
    value: 'cover',
    title: '차례 넘김 화면 (손패 가리기)',
    desc: '사람이 2명 이상이면 내 차례에 "내 패 보기"를 눌러야 손패가 보여요. 다른 사람은 그동안 눈을 감아 주세요.',
  },
  { value: 'open', title: '모두 공개 (배우기용)', desc: '컴퓨터 손패까지 모두 앞면으로 보여요. 아이와 함께 규칙을 익힐 때 좋아요.' },
];

const RULES: { key: 'blockRule' | 'winnerStarts' | 'pipColors'; title: string; desc: string }[] = [
  {
    key: 'blockRule',
    title: '블록 규칙',
    desc: '낼 패가 없을 때 뽑는 더미에서 뽑지 않고 그냥 통과해요. 더 빨리 끝나고, 막히는 판이 많아져요.',
  },
  {
    key: 'winnerStarts',
    title: '이긴 사람이 다음 판 시작',
    desc: '두 번째 판부터는 지난 판에 이긴 사람이 아무 패나 골라 먼저 놓아요. 끄면 판마다 가장 높은 더블로 시작해요.',
  },
  {
    key: 'pipColors',
    title: '점 색깔 (숫자마다 다른 색)',
    desc: '1은 파랑, 2는 초록, 3은 빨강 … 숫자마다 점 색이 달라서 같은 숫자를 찾기 쉬워요. 게임 중에도 바꿀 수 있어요.',
  },
];

const END_MODES: { value: EndMode; title: string; desc: string }[] = [
  { value: 'single', title: '한 판 승부', desc: '한 판에서 이긴 사람이 우승! 나머지는 손에 남은 점이 적은 순서로 순위를 정해요.' },
  { value: 'points', title: '점수 모으기', desc: '판마다 이긴 사람이 다른 사람 손에 남은 점을 모두 가져가요. 목표 점수를 먼저 모으면 우승!' },
];

export function DominoSetup({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: DominoSetupProps) {
  const [setup, setSetup] = useState<Setup>(initialSetup);
  const count = activeSeatCount(setup.seats);
  const humans = setup.seats.filter((s) => s.kind === 'human').length;
  const opt = setup.options;
  const setOpt = (patch: Partial<DominoOptions>) => setSetup({ ...setup, options: { ...opt, ...patch } });

  return (
    <div className="setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="dm-hero">
        <div className="dm-hero-art" aria-hidden="true">
          {HERO.map((t, i) => (
            <span
              key={i}
              className={`dm-hero-tile${t.r ? ' dm-hero-v' : ''}`}
              style={{ left: t.x, top: t.y, '--i': i } as CSSProperties}
            >
              <DominoFace a={t.a} b={t.b} vertical={t.r === 90} colors={opt.pipColors} />
            </span>
          ))}
          <span className="dm-hero-tile dm-hero-v dm-hero-back" style={{ left: 254, top: 0, '--i': 4 } as CSSProperties}>
            <DominoBack />
          </span>
        </div>
        <div>
          <h1>도미노</h1>
          <p>끝 숫자가 같은 패를 이어 붙여요. 내 패를 먼저 다 내면 이기고, 다른 사람 손에 남은 점이 내 점수가 돼요!</p>
        </div>
      </header>

      {saved && (
        <section className="resume-card">
          <div>
            <strong>하던 게임이 있어요.</strong>
            <span>
              {' '}
              {saved.state.players.map((p) => p.name).join(' · ')}
              {saved.state.options.endMode === 'points' ? ` — ${saved.state.round}번째 판` : ''} — {new Date(saved.savedAt).toLocaleString('ko-KR')}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="dm-resume">
            이어하기
          </button>
        </section>
      )}

      <section className="setup-section">
        <h2>누가 할까요?</h2>
        <SeatPicker seats={setup.seats} onChange={(seats) => setSetup({ ...setup, seats })} />
        {count >= 2 && (
          <p className="dm-note">
            {count}명이면 처음에 {handSizeFor(count)}개씩 나눠 가지고, 남은 {28 - handSizeFor(count) * count}개는 뽑는 더미가 돼요.
          </p>
        )}
      </section>

      <section className="setup-section">
        <h2>손패 보기</h2>
        <div className="rule-grid">
          {HAND_VIEWS.map((m) => (
            <label key={m.value} className="rule-item">
              <input type="radio" name="dm-hand-view" checked={opt.handView === m.value} onChange={() => setOpt({ handView: m.value })} />
              <span>
                <strong>{m.title}</strong>
                <small>{m.desc}</small>
              </span>
            </label>
          ))}
        </div>
        {opt.handView === 'cover' && humans < 2 && <p className="dm-note">사람이 1명이면 가릴 필요가 없어서 내 패가 항상 보여요.</p>}
      </section>

      <section className="setup-section">
        <h2>규칙</h2>
        <div className="rule-grid">
          {RULES.map((r) => (
            <label key={r.key} className="rule-item">
              <input type="checkbox" checked={opt[r.key]} onChange={(e) => setOpt({ [r.key]: e.target.checked })} />
              <span>
                <strong>
                  {r.title}
                  {r.key === 'pipColors' && (
                    <span className="dm-color-sample" aria-hidden="true">
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <span key={n} style={{ background: PIP_COLORS[n] }} />
                      ))}
                    </span>
                  )}
                </strong>
                <small>{r.desc}</small>
              </span>
            </label>
          ))}
        </div>

        <h3 className="sub-title">언제 끝낼까요?</h3>
        <div className="rule-grid">
          {END_MODES.map((m) => (
            <label key={m.value} className="rule-item">
              <input type="radio" name="dm-end-mode" checked={opt.endMode === m.value} onChange={() => setOpt({ endMode: m.value })} />
              <span>
                <strong>
                  {m.title}
                  {m.value === 'points' && (
                    <select
                      className="inline-select"
                      value={opt.targetScore}
                      onChange={(e) => setOpt({ endMode: 'points', targetScore: Number(e.target.value) })}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="목표 점수"
                      data-testid="dm-target"
                    >
                      {TARGET_SCORES.map((v) => (
                        <option key={v} value={v}>
                          {v}점
                        </option>
                      ))}
                    </select>
                  )}
                </strong>
                <small>{m.desc}</small>
              </span>
            </label>
          ))}
        </div>
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
        <button type="button" className="btn btn-primary btn-large" disabled={count < 2} onClick={() => onStart(setup)} data-testid="dm-start">
          게임 시작
        </button>
      </section>

      <details className="how-to">
        <summary>놀이 방법</summary>
        <ol>
          <li>도미노 패는 28개예요. 패마다 칸이 두 개 있고, 칸마다 0~6개의 점이 있어요. 두 칸의 점이 같은 패를 더블이라고 해요.</li>
          <li>2명이면 7개씩, 3~4명이면 5개씩 나눠 가져요. 남은 패는 엎어서 뽑는 더미로 둬요.</li>
          <li>첫 판은 가장 높은 더블(6·6, 없으면 5·5 …)을 가진 사람이 그 패를 먼저 놓아요. 아무도 더블이 없으면 점이 가장 많은 패로 시작해요.</li>
          <li>차례가 되면 줄의 양 끝 중 한 곳에, 끝 숫자와 같은 숫자가 있는 패를 맞대어 놓아요. 더블은 줄과 엇갈리게 놓여요.</li>
          <li>두 끝에 다 맞으면 어느 끝에 놓을지 골라요. 낼 패가 없으면 낼 수 있는 패가 나올 때까지 뽑는 더미에서 뽑아요. 더미가 비었으면 통과해요.</li>
          <li>
            패를 먼저 다 낸 사람이 그 판의 승자예요! 다른 사람들 손에 남은 점을 모두 더해서 점수로 가져가요.
          </li>
          <li>
            아무도 낼 수 없어서 막히면, 손에 남은 점이 가장 적은 사람이 이기고 다른 사람들 손에 남은 점을 모두 가져가요. (점이 같으면 패가 적은 사람이 이기고, 그래도 같으면 비겨요.)
          </li>
          <li>줄이 길어지면 탁자 끝에서 구부러져 뱀처럼 이어져요. 점 색깔을 켜면 같은 숫자를 찾기가 쉬워요.</li>
          <li>조작: 패는 클릭하거나 ←/→·숫자키로 고르고 Enter로 놓아요. 끝 고르기는 ←/→, 뽑기는 D, 통과는 Space.</li>
        </ol>
      </details>
    </div>
  );
}
