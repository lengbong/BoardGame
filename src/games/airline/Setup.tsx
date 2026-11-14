import { useState } from 'react';
import { ChoiceIcon, ICON_DUO, ICON_LINE, IconPicker, type IconChoice } from '../../components/IconPicker';
import { SeatPicker } from '../../components/SeatPicker';
import { SpeedPicker } from '../../components/SpeedPicker';
import { SEAT_COLORS, activeSeatCount } from '../common/players';
import type { GameSettings } from '../common/settings';
import { HeroArt, LandmarkIcon, PlaneArt } from './Art';
import { CHALLENGES } from './challenges';
import { CITY, REGIONS, REGION_INFO, SEASON_INFO, airportClass, citySize } from './cities';
import { fmtMoney } from './format';
import { DEFAULT_NAMES, GOAL_VALUES, START_MONEY, companyName, hubCandidates } from './rules';
import { companyValue } from './simulate';
import type { SavedAirlineGame } from './storage';
import { qLabel } from './time';
import type { AirlineOptions, AirlineSetup, MoneyLevel, StartEra } from './types';
import { Meter } from './ui';

interface SetupProps {
  initialSetup: AirlineSetup;
  saved: SavedAirlineGame | null;
  settings: GameSettings;
  onSettings: (s: GameSettings) => void;
  onStart: (setup: AirlineSetup) => void;
  onResume: () => void;
  onBack: () => void;
}

function EraIcon({ era }: { era: StartEra }) {
  return (
    <ChoiceIcon>
      {era === 1963 && (
        <>
          <path d="M3 18h22l3-2-3-2H5z" {...ICON_DUO} />
          <path d="M8 14l-3-6h3l5 6M13 18l-4 7h3l6-7" {...ICON_LINE} />
        </>
      )}
      {era === 1983 && (
        <>
          <path d="M3 19h22c3 0 4-1 4-2s-1-3-6-3H8c-2-3-4-4-6-4l1 9z" {...ICON_DUO} />
          <path d="M14 14c1-3 4-4 7-3" {...ICON_LINE} />
        </>
      )}
      {era === 2003 && (
        <>
          <path d="M3 17h23l3-1.5-3-1.5H6L3 9z" {...ICON_DUO} />
          <path d="M14 17l-4 8h3l7-8M4 9l3-1" {...ICON_LINE} />
          <circle cx="24" cy="7" r="3" {...ICON_LINE} />
        </>
      )}
    </ChoiceIcon>
  );
}

const ERA_CHOICES: IconChoice<StartEra>[] = [
  { value: 1963, short: '1963년', label: '1963년: 제트기 시대의 시작', icon: <EraIcon era={1963} /> },
  { value: 1983, short: '1983년', label: '1983년: 점보와 넓은 동체의 시대', icon: <EraIcon era={1983} /> },
  { value: 2003, short: '2003년', label: '2003년: 연료를 아끼는 새 비행기 시대', icon: <EraIcon era={2003} /> },
];

const ERA_TEXT: Record<StartEra, string> = {
  1963: '707·DC-8·카라벨 같은 초기 제트기로 시작해요. 표가 비싸고 손님은 적지만, 점보·콩코드·새 기종이 차례로 나와요. 서울·두바이 같은 도시는 아직 작아요.',
  1983: '747 점보와 넓은 동체기의 시대. 서울·싱가포르가 빠르게 자라고, 1988년 서울 올림픽이 다가와요.',
  2003: '777·A330·737-800으로 시작해 787·A350·A380이 나와요. 두바이·베이징·상하이가 아주 크게 자라요.',
};

function ModeIcon({ kind }: { kind: 'years' | 'goal' | 'challenge' }) {
  return (
    <ChoiceIcon>
      {kind === 'years' && (
        <>
          <circle cx="16" cy="17" r="10" {...ICON_DUO} />
          <path d="M16 11v6l4 3M12 3h8" {...ICON_LINE} />
        </>
      )}
      {kind === 'goal' && (
        <>
          <circle cx="16" cy="16" r="11" {...ICON_LINE} />
          <circle cx="16" cy="16" r="6" {...ICON_DUO} />
          <circle cx="16" cy="16" r="1.5" fill="currentColor" />
        </>
      )}
      {kind === 'challenge' && (
        <>
          <path d="M9 4h14v6a7 7 0 0 1-14 0z" {...ICON_DUO} />
          <path d="M9 6H4c0 4 2 6 5 6M23 6h5c0 4-2 6-5 6M16 17v5M11 27h10l-1-5h-8z" {...ICON_LINE} />
        </>
      )}
    </ChoiceIcon>
  );
}

const MODE_CHOICES: IconChoice<AirlineOptions['mode']>[] = [
  { value: 'years', short: '정해진 해까지', label: '정해진 해가 지나면 회사 가치 1등이 이겨요', icon: <ModeIcon kind="years" /> },
  { value: 'goal', short: '목표 먼저', label: '여러 지역 취항 + 회사 가치 목표를 먼저 이루면 이겨요', icon: <ModeIcon kind="goal" /> },
  { value: 'challenge', short: '도전 과제', label: '혼자서 정해진 조건을 기한 안에 이루기', icon: <ModeIcon kind="challenge" /> },
];

const YEAR_CHOICES: IconChoice<10 | 20 | 30>[] = [
  { value: 10, short: '10년' },
  { value: 20, short: '20년' },
  { value: 30, short: '30년' },
];

const GOAL_CHOICES: IconChoice<number>[] = GOAL_VALUES.map((v) => ({ value: v, short: fmtMoney(v) }));
const REGION_CHOICES: IconChoice<number>[] = [4, 5, 6].map((v) => ({ value: v, short: `${v}개 지역`, label: `여섯 지역 가운데 ${v}곳에 비행기 띄우기` }));

function MoneyIcon({ n }: { n: number }) {
  return (
    <ChoiceIcon>
      {Array.from({ length: n }, (_, i) => (
        <ellipse key={i} cx={16} cy={24 - i * 5} rx={9} ry={3.4} {...ICON_DUO} />
      ))}
    </ChoiceIcon>
  );
}

const MONEY_CHOICES: IconChoice<MoneyLevel>[] = [
  { value: 'rich', short: `넉넉 ${fmtMoney(START_MONEY.rich.cash)}`, label: `넉넉하게 ${fmtMoney(START_MONEY.rich.cash)}`, icon: <MoneyIcon n={4} /> },
  { value: 'normal', short: `보통 ${fmtMoney(START_MONEY.normal.cash)}`, label: `보통 ${fmtMoney(START_MONEY.normal.cash)}`, icon: <MoneyIcon n={3} /> },
  { value: 'tight', short: `빠듯 ${fmtMoney(START_MONEY.tight.cash)}`, label: `빠듯하게 ${fmtMoney(START_MONEY.tight.cash)}`, icon: <MoneyIcon n={2} /> },
];

export function AirlineSetupScreen({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: SetupProps) {
  const [setup, setSetup] = useState<AirlineSetup>(initialSetup);
  const [choosing, setChoosing] = useState<number | null>(null);
  const opt = setup.options;
  const setOpt = (patch: Partial<AirlineOptions>) => setSetup((s) => ({ ...s, options: { ...s.options, ...patch } }));
  const challenge = opt.mode === 'challenge';
  const humanIdx = setup.seats.findIndex((s) => s.kind === 'human');
  const count = activeSeatCount(setup.seats);
  const hubs = setup.hubs.map((h) => (h && hubCandidates(opt.era).includes(h) ? h : null));
  const canStart = challenge ? !!opt.challenge : count >= 2;

  const start = () => {
    if (challenge) {
      const name = setup.seats[Math.max(0, humanIdx)]?.name ?? '';
      onStart({
        ...setup,
        seats: [
          { kind: 'human', name },
          { kind: 'empty', name: '' },
          { kind: 'empty', name: '' },
          { kind: 'empty', name: '' },
        ],
      });
      return;
    }
    onStart({ ...setup, hubs });
  };

  const setHub = (seat: number, city: string | null) => {
    const next = [...hubs];
    for (let i = 0; i < next.length; i++) if (next[i] === city) next[i] = null;
    next[seat] = city;
    setSetup((s) => ({ ...s, hubs: next }));
    setChoosing(null);
  };

  return (
    <div className="setup al-setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="al-hero">
        <HeroArt />
        <div>
          <h1>하늘길 항공사</h1>
          <p>
            세계 여러 도시에 지점을 내고, 실제 기종의 비행기를 사거나 빌려 노선을 열어요. 운임과 운항 횟수를 정하고, 라이벌 항공사와 손님을 나눠 가지며 분기마다 회사를 키우는 경영 게임이에요.
          </p>
        </div>
      </header>

      {saved && (
        <section className="resume-card">
          <div>
            <strong>하던 게임이 있어요.</strong>
            <span>
              {' '}
              {qLabel(saved.state.q)} — {saved.state.companies.map((c, i) => `${c.name} ${fmtMoney(companyValue(saved.state, i))}`).join(' · ')} — {new Date(saved.savedAt).toLocaleString('ko-KR')}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="al-resume">
            이어하기
          </button>
        </section>
      )}

      <section className="setup-section">
        <h2>어떻게 할까요?</h2>
        <IconPicker caption="게임 방식" value={opt.mode} options={MODE_CHOICES} onChange={(mode) => setOpt({ mode })} testId="al-mode" />
      </section>

      {!challenge ? (
        <>
          <section className="setup-section">
            <h2>누가 할까요?</h2>
            <SeatPicker seats={setup.seats} onChange={(seats) => setSetup((s) => ({ ...s, seats }))} />
            <p className="al-note">
              이름을 비워 두면 {DEFAULT_NAMES.map((n, i) => `${SEAT_COLORS[i as 0].name} ‘${n}’`).join(', ')}로 불러요. 이름 뒤에는 ‘항공’이 붙어요. 모든 회사의 숫자가 공개되어 차례 넘김 화면 없이 함께 해요.
            </p>
          </section>

          <section className="setup-section">
            <h2>규칙</h2>
            <IconPicker caption="시작하는 해" value={opt.era} options={ERA_CHOICES} onChange={(era) => setOpt({ era })} testId="al-era" />
            <p className="al-note">{ERA_TEXT[opt.era]}</p>
            <div className="al-rule-row">
              {opt.mode === 'years' ? (
                <IconPicker caption="게임 길이" small inline value={opt.years} options={YEAR_CHOICES} onChange={(years) => setOpt({ years })} testId="al-years" />
              ) : (
                <>
                  <IconPicker caption="목표 회사 가치" small inline value={opt.goalValue} options={GOAL_CHOICES} onChange={(goalValue) => setOpt({ goalValue })} testId="al-goal" />
                  <IconPicker caption="취항할 지역 수" small inline value={opt.goalRegions} options={REGION_CHOICES} onChange={(goalRegions) => setOpt({ goalRegions })} testId="al-regions" />
                </>
              )}
            </div>
            <IconPicker caption="시작 자금" value={opt.money} options={MONEY_CHOICES} onChange={(money) => setOpt({ money })} testId="al-money" />
          </section>

          <section className="setup-section">
            <h2>본사 도시</h2>
            <p className="al-note">회사마다 다른 도시에 본사를 둬요. 본사 공항은 슬롯이 두 배이고, 본사를 오가는 노선은 갈아타는 손님 덕분에 손님이 조금 더 많아요. 컴퓨터와 고르지 않은 자리는 저절로 골라요.</p>
            <ul className="al-hub-seats">
              {setup.seats.map((seat, i) =>
                seat.kind === 'empty' ? null : (
                  <li key={i}>
                    <span className="al-hub-who" style={{ borderColor: SEAT_COLORS[i as 0].main }}>
                      {companyName(seat.name, i)}
                    </span>
                    {seat.kind === 'human' ? (
                      <button type="button" className={`btn btn-small${choosing === i ? ' btn-selected' : ''}`} onClick={() => setChoosing(choosing === i ? null : i)} data-testid={`al-hub-btn-${i}`}>
                        {hubs[i] ? (
                          <>
                            <LandmarkIcon kind={CITY[hubs[i]!].landmark} size={18} /> {CITY[hubs[i]!].name}
                          </>
                        ) : (
                          '🎲 저절로 (눌러서 고르기)'
                        )}
                      </button>
                    ) : (
                      <span className="al-muted">컴퓨터가 고를게요</span>
                    )}
                  </li>
                ),
              )}
            </ul>
            {choosing !== null && <HubChooser era={opt.era} taken={hubs.filter((h, i) => h && i !== choosing) as string[]} value={hubs[choosing]} onPick={(c) => setHub(choosing, c)} />}
          </section>
        </>
      ) : (
        <section className="setup-section">
          <h2>도전 과제 고르기</h2>
          <label className="al-field al-name-field">
            <span>내 회사 이름</span>
            <input
              type="text"
              maxLength={8}
              value={setup.seats[Math.max(0, humanIdx)]?.name ?? ''}
              placeholder={DEFAULT_NAMES[0]}
              onChange={(e) => {
                const seats = [...setup.seats] as AirlineSetup['seats'];
                const idx = Math.max(0, humanIdx);
                seats[idx] = { kind: 'human', name: e.target.value };
                setSetup((s) => ({ ...s, seats }));
              }}
            />
          </label>
          <ul className="al-challenges" role="radiogroup" aria-label="도전 과제">
            {CHALLENGES.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={opt.challenge === c.id}
                  className={`al-challenge${opt.challenge === c.id ? ' al-on' : ''}`}
                  onClick={() => setOpt({ challenge: c.id })}
                  data-testid={`al-ch-${c.id}`}
                >
                  <span className="al-ch-emoji" aria-hidden="true">
                    {c.emoji}
                  </span>
                  <span className="al-ch-text">
                    <b>
                      {c.title} <span className="al-ch-stars">{'★'.repeat(c.stars)}{'☆'.repeat(3 - c.stars)}</span>
                    </b>
                    <small>
                      {c.year}년 · 본사 {CITY[c.hub].name} · 자금 {fmtMoney(c.cash)}
                      {c.debt ? ` · 빚 ${fmtMoney(c.debt)}` : ''} · 라이벌 {c.rivals.length}곳
                    </small>
                    <span>{c.story}</span>
                    <em>🎯 {c.goal}</em>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="setup-section setup-footer">
        <SpeedPicker caption="컴퓨터·애니메이션 속도" value={settings.speed} onChange={(speed) => onSettings({ ...settings, speed })} inline />
        <button type="button" className="btn btn-primary btn-large" disabled={!canStart} onClick={start} data-testid="al-start">
          {challenge ? '도전 시작' : '게임 시작'}
        </button>
      </section>

      <HowTo />
    </div>
  );
}

function HubChooser({ era, taken, value, onPick }: { era: StartEra; taken: string[]; value: string | null; onPick: (c: string | null) => void }) {
  const cands = hubCandidates(era);
  return (
    <div className="al-hub-chooser" data-testid="al-hub-chooser">
      <button type="button" className="btn btn-small" onClick={() => onPick(null)}>
        🎲 저절로 고르기
      </button>
      {REGIONS.map((r) => {
        const list = cands.filter((id) => CITY[id].region === r);
        if (list.length === 0) return null;
        return (
          <div key={r} className="al-hub-region">
            <h4>
              {REGION_INFO[r].emoji} {REGION_INFO[r].name}
            </h4>
            <ul>
              {list.map((id) => {
                const c = CITY[id];
                const size = citySize(c, era);
                const grow = citySize(c, era + 20) - size;
                const off = taken.includes(id);
                return (
                  <li key={id}>
                    <button type="button" className={`al-hub-city${value === id ? ' al-on' : ''}`} disabled={off} onClick={() => onPick(id)} title={c.desc} data-testid={`al-hub-${id}`}>
                      <LandmarkIcon kind={c.landmark} size={26} />
                      <span className="al-hc-text">
                        <b>{c.name}</b>
                        <small>
                          크기 {size.toFixed(1)}
                          {grow > 1.5 ? ' ↗' : ''} · 사업 {Math.round(c.biz * 100)}% · 공항 {airportClass(c, era)}등급
                        </small>
                        <Meter value={size / 10} tone="blue" label={`크기 ${size.toFixed(1)}`} />
                        <small className="al-muted">{SEASON_INFO[c.season].name}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function HowTo() {
  return (
    <details className="how-to al-how-to">
      <summary>놀이 방법</summary>
      <ol>
        <li>
          <b>한 차례 = 한 분기(3개월)</b>: 회사마다 돌아가며 이번 분기 경영을 하고 <kbd>Enter</kbd>로 마쳐요. 모두 마치면 석 달 동안 비행기가 날고, <b>분기 결산</b>이 나와요.
        </li>
        <li>
          <b>지점 → 노선 → 비행기</b>: 지도에서 도시를 눌러 <b>지점</b>을 열고, 지점이 있는 두 도시 사이에 <b>노선</b>을 열어요. 비행기를 <b>사거나</b>(값을 다 냄) <b>리스</b>(계약금만 내고 분기마다 빌린 값을 냄)해서 노선에 넣고 한 주에 몇 번 왕복할지 정해요.
          <span className="al-howto-planes" aria-hidden="true">
            <PlaneArt body="prop" engines={2} color="#30a46c" shape="star" width={70} />
            <PlaneArt body="narrow" engines={2} color="#e5484d" shape="circle" width={70} />
            <PlaneArt body="jumbo" engines={4} color="#3e63dd" shape="diamond" width={70} />
            <PlaneArt body="sst" engines={4} color="#f5b400" shape="leaf" width={70} />
          </span>
        </li>
        <li>
          <b>비행기마다 달라요</b>: 멀리 못 가는 비행기, 작은 공항에 못 내리는 큰 비행기가 있어요. 공항마다 한 주에 쓸 수 있는 운항 횟수(<b>슬롯</b>)도 정해져 있어요. 새 기종은 연료를 덜 먹고 손님이 좋아해요.
        </li>
        <li>
          <b>손님 나누기</b>: 두 도시 사이 손님은 도시 크기·사업과 관광·거리·계절·시대에 따라 정해져요. 같은 두 도시를 여러 회사가 날면, <b>운임이 싸고 자주 날고 편한 비행기를 띄우고 평판·광고가 좋은</b> 회사가 손님을 더 가져가요. 좌석보다 많이 태울 수는 없어요.
        </li>
        <li>
          <b>돈</b>: 운임 수입에서 연료비·승무원과 정비·공항·서비스·판매 수수료·리스료·지점 유지비·광고·이자·세금을 빼면 분기 이익이에요. 돈이 모자라면 은행에서 빌리고, 두 분기 내내 모자라면 <b>파산</b>해요.
        </li>
        <li>
          <b>세계는 움직여요</b>: 해마다 새 기종이 나오고 옛 기종은 생산이 끝나요. 도시가 자라고 공항이 커지며, 기름값·경기·여행 붐·올림픽·엑스포 같은 사건이 손님과 비용을 바꿔요.
        </li>
        <li>
          <b>이기기</b>: 정해진 해까지 회사 가치(현금 + 내 비행기·호텔 가치 − 빚) 1등, 또는 여러 지역 취항과 가치 목표를 먼저 이루기, 또는 도전 과제 성공!
        </li>
        <li>
          조작: 화면 <kbd>1</kbd> 지도 · <kbd>2</kbd> 비행기 · <kbd>3</kbd> 노선 · <kbd>4</kbd> 재무 · <kbd>5</kbd> 보고서 · <kbd>6</kbd> 뉴스, 이번 분기 마치기 <kbd>Enter</kbd>, 닫기 <kbd>Esc</kbd>, 지도 확대 <kbd>+</kbd> <kbd>−</kbd> <kbd>0</kbd>. 처음이면 지도 아래 <b>💡 추천 노선</b>의 ‘리스로 열기’부터 눌러 보세요!
        </li>
      </ol>
    </details>
  );
}
