import { useState, type CSSProperties } from 'react';
import { SeatPicker } from '../../components/SeatPicker';
import type { GameSettings } from '../common/settings';
import { activeSeatCount } from '../common/players';
import { SPEEDS, SPEED_LABELS, type Speed } from '../common/speed';
import { CardBack, CardFace, Picture } from './CardArt';
import type { SavedMemoryGame } from './storage';
import { BOARD_SIZES, THEMES, THEME_IDS, THEME_LABELS, pictureInfo, themePictures } from './themes';
import type { MemoryOptions, MemorySetup, ThemeId } from './types';

interface MemorySetupProps {
  initialSetup: MemorySetup;
  saved: SavedMemoryGame | null;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onStart: (setup: MemorySetup) => void;
  onResume: () => void;
  onBack: () => void;
}

/** 그림 묶음 고르기 카드에 보여 줄 그림 3개 */
const THEME_SAMPLES: Record<ThemeId, string[]> = {
  animals: ['a-rabbit', 'a-penguin', 'a-elephant'],
  food: ['f-strawberry', 'f-banana', 'f-carrot'],
  vehicles: ['v-bus', 'v-rocket', 'v-sailboat'],
  mixed: ['a-lion', 'f-cherry', 'v-balloon'],
};

const THEME_DESC: Record<ThemeId, string> = {
  animals: '토끼, 펭귄, 코끼리 … 18가지',
  food: '딸기, 바나나, 당근 … 18가지',
  vehicles: '버스, 로켓, 돛단배 … 18가지',
  mixed: '세 묶음 54가지에서 골고루',
};

const RULES: { key: 'extraTurn' | 'peek' | 'showNames'; title: string; desc: string }[] = [
  { key: 'extraTurn', title: '맞히면 한 번 더', desc: '짝을 맞히면 그 사람이 한 번 더 뒤집어요. 끄면 맞혀도 다음 사람 차례예요.' },
  { key: 'peek', title: '처음에 잠깐 모두 보여 주기', desc: '시작할 때 몇 초 동안 모든 카드를 보여 줘요. 어린 친구와 할 때 좋아요.' },
  { key: 'showNames', title: '카드에 이름 쓰기', desc: '그림 아래에 "토끼", "사과"처럼 이름을 작게 써 줘요. 글자를 익히기에도 좋아요.' },
];

/** 머리 그림: 짝이 맞은 토끼 두 장, 뒷면, 사과, 뒷면 */
const HERO: (string | null)[] = ['a-rabbit', null, 'f-apple', null, 'a-rabbit'];

export function MemorySetupScreen({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: MemorySetupProps) {
  const [setup, setSetup] = useState<MemorySetup>(initialSetup);
  const count = activeSeatCount(setup.seats);
  const opt = setup.options;
  const setOpt = (patch: Partial<MemoryOptions>) => setSetup({ ...setup, options: { ...opt, ...patch } });
  const gallery = themePictures(opt.theme);

  return (
    <div className="setup mm-setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="mm-hero">
        <div className="mm-hero-cards" aria-hidden="true">
          {HERO.map((pic, i) => (
            <span key={i} className={`mm-hero-card${pic ? ' is-up' : ''}`} style={{ '--i': i } as CSSProperties} data-mm-theme="animals">
              {pic ? <CardFace pic={pic} showName={false} /> : <CardBack />}
            </span>
          ))}
        </div>
        <div>
          <h1>짝 맞추기</h1>
          <p>뒤집힌 그림 카드를 두 장씩 뒤집어 같은 그림을 찾아요. 짝을 맞히면 한 번 더! 기억력 좋은 사람이 이겨요.</p>
        </div>
      </header>

      {saved && (
        <section className="resume-card">
          <div>
            <strong>하던 게임이 있어요.</strong>
            <span>
              {' '}
              {saved.state.players.map((p) => p.name).join(' · ')} — {THEME_LABELS[saved.state.options.theme]} {saved.state.options.size.replace('x', '×')} — 짝{' '}
              {saved.state.players.reduce((n, p) => n + p.pairs.length, 0)}/{saved.state.cards.length / 2} —{' '}
              {new Date(saved.savedAt).toLocaleString('ko-KR')}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="mm-resume">
            이어하기
          </button>
        </section>
      )}

      <section className="setup-section">
        <h2>누가 할까요?</h2>
        <SeatPicker seats={setup.seats} onChange={(seats) => setSetup({ ...setup, seats })} />
      </section>

      <section className="setup-section">
        <h2>판 크기</h2>
        <div className="mm-choice-row" role="radiogroup" aria-label="판 크기">
          {BOARD_SIZES.map((b) => (
            <label key={b.value} className={`mm-choice${opt.size === b.value ? ' is-on' : ''}`}>
              <input type="radio" name="mm-size" checked={opt.size === b.value} onChange={() => setOpt({ size: b.value })} data-testid={`mm-size-${b.value}`} />
              <span className="mm-size-icon" style={{ gridTemplateColumns: `repeat(${b.cols}, 9px)` }} aria-hidden="true">
                {Array.from({ length: b.rows * b.cols }, (_, i) => (
                  <span key={i} />
                ))}
              </span>
              <strong>{b.label}</strong>
              <small>{b.desc}</small>
            </label>
          ))}
        </div>

        <h3 className="sub-title">그림 카드</h3>
        <div className="mm-choice-row mm-theme-row" role="radiogroup" aria-label="그림 카드">
          {THEME_IDS.map((t) => (
            <label key={t} className={`mm-choice${opt.theme === t ? ' is-on' : ''}`}>
              <input type="radio" name="mm-theme" checked={opt.theme === t} onChange={() => setOpt({ theme: t })} data-testid={`mm-theme-${t}`} />
              <span className="mm-theme-pics" aria-hidden="true">
                {THEME_SAMPLES[t].map((pic) => (
                  <span key={pic} className="mm-theme-pic" style={{ background: pictureInfo(pic)?.theme.tint }}>
                    <Picture pic={pic} />
                  </span>
                ))}
              </span>
              <strong>{THEME_LABELS[t]}</strong>
              <small>{THEME_DESC[t]}</small>
            </label>
          ))}
        </div>
      </section>

      <section className="setup-section">
        <h2>규칙</h2>
        <div className="rule-grid">
          {RULES.map((r) => (
            <label key={r.key} className="rule-item">
              <input type="checkbox" checked={opt[r.key]} onChange={(e) => setOpt({ [r.key]: e.target.checked })} data-testid={`mm-rule-${r.key}`} />
              <span>
                <strong>{r.title}</strong>
                <small>{r.desc}</small>
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
        <button type="button" className="btn btn-primary btn-large" disabled={count < 2} onClick={() => onStart(setup)} data-testid="mm-start">
          게임 시작
        </button>
      </section>

      <details className="how-to">
        <summary>놀이 방법</summary>
        <ol>
          <li>카드를 모두 뒷면으로 펼쳐 놓아요. 같은 그림 카드가 두 장씩 숨어 있어요.</li>
          <li>내 차례에 카드 두 장을 한 장씩 뒤집어요.</li>
          <li>두 장이 같은 그림이면 짝을 찾은 거예요! 그 짝을 가져가고, 한 번 더 뒤집어요.</li>
          <li>다른 그림이면 모두 잠깐 보고 나서 다시 뒷면으로 덮어요. 그다음 사람 차례예요. 어디에 무슨 그림이 있었는지 잘 기억해 두세요!</li>
          <li>짝을 모두 찾으면 끝! 짝을 가장 많이 모은 사람이 이겨요. 짝 수가 같으면 함께 우승이에요.</li>
          <li>컴퓨터도 공개된 카드만 보고 기억해요. 쉬움은 금방 잊어버리고, 보통은 꽤 잘 기억해요.</li>
          <li>조작: 카드를 클릭하거나, 화살표 키로 고르고 Enter·Space로 뒤집어요. 짝이 아닐 때 아무 카드나 누르거나 Enter를 누르면 바로 넘어가요.</li>
        </ol>
      </details>

      <details className="how-to mm-gallery">
        <summary>그림 카드 모두 보기 ({THEME_LABELS[opt.theme]} {gallery.length}가지)</summary>
        {(opt.theme === 'mixed' ? THEMES : THEMES.filter((t) => t.id === opt.theme)).map((t) => (
          <div key={t.id} className="mm-gallery-group">
            {opt.theme === 'mixed' && <h3 className="sub-title">{t.name}</h3>}
            <ul className="mm-gallery-grid">
              {t.pictures.map((p) => (
                <li key={p.id} className="mm-gallery-card">
                  <CardFace pic={p.id} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </details>
    </div>
  );
}
