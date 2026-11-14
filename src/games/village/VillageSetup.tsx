import { useState, type ReactNode } from 'react';
import { ChoiceIcon, IconPicker, type IconChoice } from '../../components/IconPicker';
import { SeatPicker } from '../../components/SeatPicker';
import { SpeedPicker } from '../../components/SpeedPicker';
import { activeSeatCount, type SeatIndex } from '../common/players';
import type { GameSettings } from '../common/settings';
import { playerName } from './rules';
import type { SavedVillageGame } from './storage';
import { Pennant, TileArt } from './TileArt';
import { TILES, TILE_COUNT_WITH_JANGSEUNG, deckList, rotPt } from './tiles';
import type { Rot, VillageOptions, VillageSetup } from './types';

interface SetupProps {
  initialSetup: VillageSetup;
  saved: SavedVillageGame | null;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onStart: (setup: VillageSetup) => void;
  onResume: () => void;
  onBack: () => void;
}

const tid = (id: string) => TILES.findIndex((t) => t.id === id);

interface MiniTile {
  id: string;
  x: number;
  y: number;
  r: Rot;
  flag?: { seg: number; seat: SeatIndex };
}

/** 조각 몇 장으로 만든 작은 지도 그림 */
export function MiniMap({ tiles, size = 56, children, label }: { tiles: MiniTile[]; size?: number; children?: ReactNode; label?: string }) {
  const xs = tiles.map((t) => t.x);
  const ys = tiles.map((t) => t.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX + 1;
  const h = Math.max(...ys) - minY + 1;
  return (
    <svg className="vl-mini" viewBox={`${minX * 100 - 2} ${minY * 100 - 2} ${w * 100 + 6} ${h * 100 + 7}`} width={w * size} height={h * size} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {tiles.map((t, i) => (
        <rect key={`s${i}`} x={t.x * 100 + 2} y={t.y * 100 + 3} width={100} height={100} rx={3} fill="rgba(90,60,25,0.25)" />
      ))}
      {tiles.map((t, i) => (
        <g key={i} transform={`translate(${t.x * 100} ${t.y * 100})`}>
          <TileArt t={tid(t.id)} r={t.r} />
        </g>
      ))}
      {tiles.map((t, i) => {
        if (!t.flag) return null;
        const a = rotPt(TILES[tid(t.id)].segs[t.flag.seg].anchor, t.r);
        return (
          <g key={`f${i}`} transform={`translate(${t.x * 100 + a[0]} ${t.y * 100 + a[1]})`}>
            <Pennant seat={t.flag.seat} scale={1.6} />
          </g>
        );
      })}
      {children}
    </svg>
  );
}

const HERO: MiniTile[] = [
  { id: 'paddy-full', x: 0, y: -1, r: 0, flag: { seg: 0, seat: 0 } },
  { id: 'paddy-corner', x: 1, y: -1, r: 3 },
  { id: 'road-curve', x: -1, y: 0, r: 0 },
  { id: 'start', x: 0, y: 0, r: 0 },
  { id: 'road-house', x: 1, y: 0, r: 1 },
  { id: 'spring', x: 0, y: 1, r: 3 },
  { id: 'stream-fish', x: 1, y: 1, r: 1, flag: { seg: 0, seat: 3 } },
];

function FlagIcon({ n }: { n: number }) {
  return (
    <ChoiceIcon>
      {Array.from({ length: Math.min(n, 3) }, (_, i) => (
        <g key={i} transform={`translate(${6 + i * 8} ${27 - (i % 2) * 2})`}>
          <path d="M0 0 V-20" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          <path d="M1 -20 L10 -16 L1 -12 Z" fill="currentColor" fillOpacity={0.35} stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
        </g>
      ))}
    </ChoiceIcon>
  );
}

function HandIcon({ n }: { n: number }) {
  return (
    <ChoiceIcon>
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={n === 1 ? 9 : 3 + i * 14} y={9} width={13} height={13} rx={2.5} fill="currentColor" fillOpacity={0.2} stroke="currentColor" strokeWidth={2} />
      ))}
    </ChoiceIcon>
  );
}

const FLAG_CHOICES: IconChoice<4 | 6>[] = [
  { value: 6, short: '6개', label: '깃발 6개 (기본)', icon: <FlagIcon n={3} /> },
  { value: 4, short: '4개', label: '깃발 4개 (아껴 쓰기)', icon: <FlagIcon n={2} /> },
];

const HAND_CHOICES: IconChoice<1 | 2>[] = [
  { value: 2, short: '2장', label: '손에 2장 들고 고르기 (기본)', icon: <HandIcon n={2} /> },
  { value: 1, short: '1장 (빠르게)', label: '손에 1장 (빠른 게임)', icon: <HandIcon n={1} /> },
];

function Step({ pic, children }: { pic: ReactNode; children: ReactNode }) {
  return (
    <li className="vl-step">
      <div className="vl-step-pic">{pic}</div>
      <div className="vl-step-text">{children}</div>
    </li>
  );
}

export function VillageSetupScreen({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: SetupProps) {
  const [setup, setSetup] = useState<VillageSetup>(initialSetup);
  const count = activeSeatCount(setup.seats);
  const opt = setup.options;
  const setOpt = (patch: Partial<VillageOptions>) => setSetup({ ...setup, options: { ...opt, ...patch } });
  const jsCount = TILE_COUNT_WITH_JANGSEUNG - deckList(false).length;

  return (
    <div className="setup vl-setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="vl-hero">
        <div className="vl-hero-art">
          <MiniMap tiles={HERO} size={58} label="마을 지도 그림: 논, 초가집으로 가는 길, 샘에서 흐르는 냇물" />
        </div>
        <div>
          <h1>우리 마을 지도</h1>
          <p>
            길·냇물·논이 그려진 땅 조각을 한 장씩 이어 붙여 옛 마을 지도를 함께 그려요. 내 깃발을 꽂은 길과 냇물과 논이 완성되면 점수! 장승을 세우면 덤 점수도 있어요.
          </p>
        </div>
      </header>

      {saved && (
        <section className="resume-card">
          <div>
            <strong>하던 게임이 있어요.</strong>
            <span>
              {' '}
              {saved.state.players.map((p) => `${playerName(p)} ${p.score}점`).join(' · ')} — 남은 조각 {saved.state.stack.length}장 — {new Date(saved.savedAt).toLocaleString('ko-KR')}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="vl-resume">
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
        <div className="vl-pickers">
          <IconPicker caption="한 사람의 깃발" value={opt.flags} options={FLAG_CHOICES} onChange={(flags) => setOpt({ flags })} testId="vl-opt-flags" />
          <IconPicker caption="손에 드는 조각" value={opt.hand} options={HAND_CHOICES} onChange={(hand) => setOpt({ hand })} testId="vl-opt-hand" />
        </div>
        <div className="rule-grid vl-rule-grid">
          <label className="rule-item">
            <input type="checkbox" checked={opt.jangseung} onChange={(e) => setOpt({ jangseung: e.target.checked })} data-testid="vl-opt-jangseung" />
            <span>
              <strong>장승 조각 넣기 ({jsCount}장)</strong>
              <small>장승 조각을 놓는 순간, 맞닿은 이웃 조각에 길·냇물·논이 몇 종류 있는지 세어 1~3점을 바로 받아요. 깃발이 필요 없어요.</small>
            </span>
          </label>
          <label className="rule-item">
            <input type="checkbox" checked={opt.showSpots} onChange={(e) => setOpt({ showSpots: e.target.checked })} />
            <span>
              <strong>놓을 수 있는 자리 반짝이기</strong>
              <small>고른 조각을 놓을 수 있는 자리가 노랗게 반짝여요. 익숙해지면 끄고 직접 찾아보세요. 게임 중에도 바꿀 수 있어요.</small>
            </span>
          </label>
        </div>
        <p className="vl-note">
          조각 {deckList(opt.jangseung).length}장 + 처음 조각 1장 · 손에 {opt.hand}장을 모두에게 보이게 들고, 그중 하나를 골라 놓아요.
        </p>
      </section>

      <section className="setup-section setup-footer">
        <SpeedPicker caption="컴퓨터·애니메이션 속도" value={settings.speed} onChange={(speed) => onSettings({ ...settings, speed })} inline />
        <button type="button" className="btn btn-primary btn-large" disabled={count < 2} onClick={() => onStart(setup)} data-testid="vl-start">
          게임 시작
        </button>
      </section>

      <details className="how-to vl-how-to">
        <summary>놀이 방법</summary>
        <ol className="vl-steps">
          <Step
            pic={
              <MiniMap
                tiles={[
                  { id: 'start', x: 0, y: 0, r: 0 },
                  { id: 'road-house', x: 1, y: 0, r: 1 },
                ]}
                size={70}
              />
            }
          >
            <strong>조각을 이어 붙여요.</strong> 손에 든 조각(모두에게 보여요) 중 하나를 골라 지도에 놓아요. 맞닿는 모서리는 <b>길은 길, 냇물은 냇물, 논둑은 논둑, 들은 들</b>끼리 같아야 해요.
            R이나 오른쪽 클릭으로 돌려요. 놓고 나면 더미에서 한 장을 새로 뽑아요.
          </Step>
          <Step
            pic={
              <MiniMap
                tiles={[
                  { id: 'road-house', x: 0, y: 0, r: 3, flag: { seg: 0, seat: 1 } },
                  { id: 'road-straight', x: 1, y: 0, r: 1 },
                  { id: 'road-house', x: 2, y: 0, r: 1 },
                ]}
                size={58}
              />
            }
          >
            <strong>깃발을 꽂아요.</strong> 방금 놓은 조각의 길·냇물·논 중 <b>아직 아무 깃발도 없는 곳</b>에 내 깃발을 하나 꽂을 수 있어요. (깃발은 6개, 완성되면 돌아와요)
          </Step>
          <Step
            pic={
              <MiniMap
                tiles={[
                  { id: 'spring', x: 0, y: 0, r: 3 },
                  { id: 'stream-fish', x: 1, y: 0, r: 1 },
                  { id: 'pond', x: 2, y: 0, r: 1 },
                ]}
                size={58}
              />
            }
          >
            <strong>완성하면 점수!</strong> 길은 양 끝이 집·장터·갈림길·장승 등에서 끝나면 <b>칸마다 1점</b>. 냇물은 샘이나 연못에서 끝나면 <b>칸마다 1점 + 물고기 🐟마다 2점</b>(그림은 3칸 + 물고기 2마리 = 7점).
          </Step>
          <Step
            pic={
              <MiniMap
                tiles={[
                  { id: 'paddy-edge', x: 0, y: 0, r: 2 },
                  { id: 'paddy-corner-crow', x: 0, y: 1, r: 0 },
                  { id: 'paddy-edge', x: 1, y: 1, r: 3 },
                ]}
                size={58}
              />
            }
          >
            <strong>논은 논둑으로 다 둘러싸이면 완성.</strong> <b>칸마다 2점 + 허수아비마다 2점</b>. 깃발이 가장 많은 사람이 점수를 받고, 같으면 모두 받아요. 내 지형을 남의 지형에 이어 붙여 같이 먹을 수도 있어요!
          </Step>
          <Step
            pic={
              <MiniMap
                tiles={[
                  { id: 'js-cross', x: 0, y: 0, r: 0 },
                  { id: 'road-straight', x: 0, y: -1, r: 0 },
                  { id: 'paddy-edge', x: 0, y: 1, r: 0 },
                  { id: 'spring', x: -1, y: 0, r: 3 },
                ]}
                size={50}
              />
            }
          >
            <strong>장승은 놓자마자 점수.</strong> 이웃 조각과 맞닿은 모서리에 길·냇물·논이 몇 종류 있는지 세어 1~3점 (그림은 3점). 들은 점수가 없어요.
          </Step>
          <li className="vl-step vl-step-plain">
            <div className="vl-step-text">
              <strong>끝.</strong> 더미가 다 떨어지고 모두 손의 조각을 놓을 수 없으면 끝나요. 완성되지 않은 지형은 <b>점수의 반</b>(내림)을 깃발이 많은 사람이 받아요. 점수가 가장 많은 사람이 이겨요!
              손에 든 조각을 어디에도 놓을 수 없으면 하나를 버리고 새로 뽑아요.
            </div>
          </li>
          <li className="vl-step vl-step-plain">
            <div className="vl-step-text">
              <strong>조작.</strong> <kbd>1</kbd>·<kbd>2</kbd> 조각 고르기, <kbd>R</kbd>·오른쪽 클릭 돌리기, 반짝이는 자리 누르기(또는 화살표) → 한 번 더 누르거나 <kbd>Enter</kbd> 놓기. 깃발: <kbd>F</kbd> 고르기, <kbd>Enter</kbd> 꽂기,{' '}
              <kbd>Space</kbd> 건너뛰기. 지도는 끌어서 옮기고 휠·<kbd>+</kbd>·<kbd>−</kbd>로 확대, <kbd>0</kbd> 전체 보기.
            </div>
          </li>
        </ol>
      </details>
    </div>
  );
}
