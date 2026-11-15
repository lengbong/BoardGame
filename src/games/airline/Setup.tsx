import { useState } from 'react';
import { ChoiceIcon, ICON_DUO, ICON_LINE, IconPicker, type IconChoice } from '../../components/IconPicker';
import { SeatPicker } from '../../components/SeatPicker';
import { SpeedPicker } from '../../components/SpeedPicker';
import { useMusic } from '../../lib/useMusic';
import { SEAT_COLORS, activeSeatCount } from '../common/players';
import type { GameSettings } from '../common/settings';
import { HeroArt, LandmarkIcon } from './Art';
import { PlaneImage } from './PlaneImage';
import { CHALLENGES } from './challenges';
import { SEASON_NAMES } from './calendar';
import { CITY, REGIONS, REGION_INFO, airportClass, citySize } from './cities';
import { fmtMoney } from './format';
import { DEFAULT_NAMES, GOAL_VALUES, START_MONEY, companyName, hubCandidates } from './rules';
import { companyValue } from './simulate';
import type { SavedAirlineGame } from './storage';
import { mLabel } from './time';
import { AirlinePicker, AirlinePhoto, airlineYears } from './AirlinePicker';
import { gameHub } from './brand';
import { CreditsModal } from './CreditsModal';
import { FameCard } from './AchievementsView';
import { REAL_AIRLINE, airlinesAt } from './realAirlines';
import { AIRLINE_TITLE } from './song';
import type { AiStyle, AirlineOptions, AirlineSetup, MoneyLevel, NameMode, StartEra } from './types';
import { IataBadge } from './ui';
import { BizModelSetup, humanModels } from './BizModelCard';
import { Meter } from './ui';
import { RightsSetup } from './RightsSetup';
import { LoyaltyHowTo } from './LoyaltyCard';
import { RivalsSetup } from './RivalsCard';
import { ScenarioModeIcon, ScenarioPicker } from './ScenarioPicker';
import { SCENARIO } from './scenarios';

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
  { value: 'scenario', short: '역사 시나리오', label: '실제 항공 역사의 한 시대에 정해진 회사로 시작해 단계 목표를 이루고 별 받기', icon: <ScenarioModeIcon /> },
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

function StyleIcon({ n }: { n: number }) {
  return (
    <ChoiceIcon>
      {Array.from({ length: 3 }, (_, i) => (
        <path key={i} d={`M${6 + i * 8} 24 l4 -${6 + i * 5} l4 ${6 + i * 5}z`} {...(i < n ? ICON_DUO : ICON_LINE)} />
      ))}
    </ChoiceIcon>
  );
}

const STYLE_CHOICES: IconChoice<AiStyle>[] = [
  { value: 'relaxed', short: '느긋', label: '컴퓨터가 천천히 넓히고 돈을 넉넉히 남겨요 (처음 하는 사람에게)', icon: <StyleIcon n={1} /> },
  { value: 'normal', short: '보통', label: '컴퓨터가 알맞게 넓혀요. 경영 비서를 따라 하면 해 볼 만해요', icon: <StyleIcon n={2} /> },
  { value: 'fierce', short: '치열', label: '컴퓨터가 빠르게 넓히고 돈을 아끼지 않아요', icon: <StyleIcon n={3} /> },
];

function NameIcon({ real }: { real: boolean }) {
  return (
    <ChoiceIcon>
      <rect x="5" y="9" width="22" height="14" rx="3" {...ICON_DUO} />
      {real ? <path d="M10 19v-6h3a2 2 0 0 1 0 4h-3M17 13h5M19.5 13v6" {...ICON_LINE} /> : <path d="M11 19l2-6 2 6M12 17h2M19 13v6M19 13h3M19 16h2" {...ICON_LINE} />}
    </ChoiceIcon>
  );
}

const HISTORY_CHOICES: IconChoice<'on' | 'off'>[] = [
  { value: 'on', short: '🌍 켜기', label: '냉전·국교와 석유 파동·9·11·코로나 같은 실제 사건을 따라요' },
  { value: 'off', short: '끄기', label: '실제 역사 없이 자유롭게' },
];

const NAME_CHOICES: IconChoice<NameMode>[] = [
  { value: 'real', short: '실제 항공사', label: '그 해에 날던 실제 항공사 이름으로 (로고는 쓰지 않아요)', icon: <NameIcon real /> },
  { value: 'fictional', short: '가상 항공사', label: '노을항공·바람길항공 같은 지어낸 이름으로', icon: <NameIcon real={false} /> },
];

export function AirlineSetupScreen({ initialSetup, saved, settings, onSettings, onStart, onResume, onBack }: SetupProps) {
  const [setup, setSetup] = useState<AirlineSetup>(initialSetup);
  const [choosing, setChoosing] = useState<number | null>(null);
  const [pickingAirline, setPickingAirline] = useState<number | null>(null);
  const [credits, setCredits] = useState(false);
  useMusic(AIRLINE_TITLE, settings.music);
  const opt = setup.options;
  const real = opt.names === 'real';
  const setOpt = (patch: Partial<AirlineOptions>) => setSetup((s) => ({ ...s, options: { ...s.options, ...patch } }));
  const challenge = opt.mode === 'challenge';
  const scenario = opt.mode === 'scenario';
  const solo = challenge || scenario;
  const humanIdx = setup.seats.findIndex((s) => s.kind === 'human');
  const count = activeSeatCount(setup.seats);
  const hubs = setup.hubs.map((h) => (h && hubCandidates(opt.era).includes(h) ? h : null));
  // 그 해에 날던 항공사만, 사람 자리만, 겹치지 않게
  const flying = new Set(airlinesAt(opt.era).map((a) => a.id));
  const airlines = [0, 1, 2, 3].map((i) => {
    const id = setup.airlines?.[i] ?? null;
    if (!real || !id || !flying.has(id) || setup.seats[i]?.kind !== 'human') return null;
    return setup.airlines.findIndex((x, j) => x === id && setup.seats[j]?.kind === 'human') === i ? id : null;
  });
  const canStart = scenario ? !!opt.scenario && !!SCENARIO[opt.scenario] : challenge ? !!opt.challenge : count >= 2;

  const start = () => {
    if (solo) {
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
    onStart({ ...setup, hubs, airlines, models: humanModels(setup) });
  };

  const setAirline = (seat: number, id: string | null) => {
    const nextAir = [...airlines];
    nextAir[seat] = id;
    // 본사는 그 항공사의 본거지로 (다른 사람이 쓰면 가까운 도시)
    const nextHubs = [...hubs];
    if (id) {
      const taken = hubs.filter((h, i) => h && i !== seat) as string[];
      nextHubs[seat] = gameHub(REAL_AIRLINE[id], hubCandidates(opt.era), taken);
    } else nextHubs[seat] = null;
    setSetup((s) => ({ ...s, airlines: nextAir, hubs: nextHubs }));
    setPickingAirline(null);
  };
  const humanName = (i: number) => {
    const a = airlines[i];
    return a ? REAL_AIRLINE[a].name : setup.seats[i].name.trim() || `${SEAT_COLORS[i as 0].name} 자리`;
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
            세계 여러 도시에 지점을 내고, 실제 기종의 비행기를 사거나 빌려 노선을 열어요. 운임과 운항 횟수를 정하고, 라이벌 항공사와 손님을 나눠 가지며 달마다 회사를 키우는 경영 게임이에요.
          </p>
        </div>
      </header>

      {saved && (
        <section className="resume-card">
          <div>
            <strong>하던 게임이 있어요.</strong>
            <span>
              {' '}
              {mLabel(saved.state.t)} — {saved.state.companies.map((c, i) => `${c.name} ${fmtMoney(companyValue(saved.state, i))}`).join(' · ')} — {new Date(saved.savedAt).toLocaleString('ko-KR')}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="al-resume">
            이어하기
          </button>
        </section>
      )}

      <FameCard />

      <section className="setup-section">
        <h2>어떻게 할까요?</h2>
        <IconPicker caption="게임 방식" value={opt.mode} options={MODE_CHOICES} onChange={(mode) => setOpt({ mode })} testId="al-mode" />
      </section>

      {scenario ? (
        <ScenarioPicker setup={setup} onSetup={setSetup} />
      ) : !challenge ? (
        <>
          <section className="setup-section">
            <h2>누가 할까요?</h2>
            <SeatPicker seats={setup.seats} onChange={(seats) => setSetup((s) => ({ ...s, seats }))} />
            <p className="al-note">
              {real
                ? '실제 항공사로 하면 아래에서 고른 항공사 이름을 써요. 모든 회사의 숫자가 공개되어 차례 넘김 화면 없이 함께 해요.'
                : `이름을 비워 두면 ${DEFAULT_NAMES.map((n, i) => `${SEAT_COLORS[i as 0].name} ‘${n}’`).join(', ')}로 불러요. 이름 뒤에는 ‘항공’이 붙어요. 모든 회사의 숫자가 공개되어 차례 넘김 화면 없이 함께 해요.`}
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
            <IconPicker caption="컴퓨터 성향" value={opt.aiStyle} options={STYLE_CHOICES} onChange={(aiStyle) => setOpt({ aiStyle })} testId="al-aistyle" />
            <RivalsSetup opt={opt} setOpt={setOpt} />
            <IconPicker caption="실제 역사" value={opt.history === false ? 'off' : 'on'} options={HISTORY_CHOICES} onChange={(v) => setOpt({ history: v === 'on' })} testId="al-history" />
            <p className="al-note">
              {opt.history === false
                ? '역사 사건 없이 무작위 사건만 일어나고, 어느 나라든 오갈 수 있어요.'
                : '냉전과 국교(막힌 하늘길, 소련 비행기)를 따르고, 석유 파동·걸프 전쟁·9·11·사스·금융 위기·코로나19 같은 실제 사건이 그 해에 일어나요.'}
            </p>
            <RightsSetup opt={opt} setOpt={setOpt} />
          </section>

          <section className="setup-section">
            <h2>항공사</h2>
            <IconPicker caption="항공사 이름" value={opt.names} options={NAME_CHOICES} onChange={(names) => setOpt({ names })} testId="al-names" />
            {real ? (
              <>
                <p className="al-note">
                  사람은 {opt.era}년에 날던 실제 항공사를 하나씩 골라요 (같은 항공사는 한 사람만). 컴퓨터는 남은 항공사 가운데 여러 지역에서 저절로 맡아요. 실제 회사의 이름·두 글자 부호·칠 색만 빌리고 로고는 쓰지 않으며, 게임 속 경영·사건은 모두 지어낸 이야기예요.
                </p>
                <ul className="al-hub-seats al-airline-seats">
                  {setup.seats.map((seat, i) => {
                    if (seat.kind === 'empty') return null;
                    const a = airlines[i] ? REAL_AIRLINE[airlines[i]!] : null;
                    return (
                      <li key={i}>
                        <span className="al-hub-who" style={{ borderColor: SEAT_COLORS[i as 0].main }}>
                          {seat.kind === 'human' ? `${SEAT_COLORS[i as 0].name} · 사람` : `${SEAT_COLORS[i as 0].name} · 컴퓨터`}
                        </span>
                        {seat.kind === 'human' ? (
                          <button
                            type="button"
                            className={`btn btn-small al-airline-btn${pickingAirline === i ? ' btn-selected' : ''}`}
                            onClick={() => setPickingAirline(pickingAirline === i ? null : i)}
                            data-testid={`al-airline-btn-${i}`}
                          >
                            {a ? (
                              <>
                                <IataBadge airline={a} small /> {a.name} <small className="al-muted">{airlineYears(a)}</small>
                              </>
                            ) : (
                              '🎲 저절로 (눌러서 고르기)'
                            )}
                          </button>
                        ) : (
                          <span className="al-muted">그 해에 날던 항공사 가운데 저절로</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {pickingAirline !== null && setup.seats[pickingAirline]?.kind === 'human' && (
                  <AirlinePicker
                    era={opt.era}
                    value={airlines[pickingAirline]}
                    takenBy={Object.fromEntries(airlines.map((id, j) => [id, j]).filter(([id, j]) => id && j !== pickingAirline).map(([id, j]) => [id as string, humanName(j as number)]))}
                    takenHubs={hubs.filter((h, j) => h && j !== pickingAirline) as string[]}
                    onPick={(id) => setAirline(pickingAirline, id)}
                  />
                )}
                {airlines.some(Boolean) && (
                  <ul className="al-picked-airlines">
                    {airlines.map((id, i) => {
                      if (!id) return null;
                      const a = REAL_AIRLINE[id];
                      return (
                        <li key={i}>
                          <AirlinePhoto airline={a} width={120} />
                          <span>
                            <IataBadge airline={a} small /> <b>{a.name}</b>
                            <small className="al-muted">
                              {' '}
                              · 본거지 {CITY[a.hub]?.name ?? a.hub}
                              {hubs[i] && hubs[i] !== a.hub ? ` (게임 본사 ${CITY[hubs[i]!].name})` : ''}
                            </small>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            ) : (
              <p className="al-note">지어낸 이름의 항공사로 해요. 이름은 위 자리 칸에 적을 수 있어요.</p>
            )}
          </section>

          <section className="setup-section">
            <h2>본사 도시</h2>
            <p className="al-note">회사마다 다른 도시에 본사를 둬요. 본사 공항은 슬롯이 두 배이고, 본사를 오가는 노선은 갈아타는 손님 덕분에 손님이 조금 더 많아요. 컴퓨터와 고르지 않은 자리는 저절로 골라요.</p>
            <ul className="al-hub-seats">
              {setup.seats.map((seat, i) =>
                seat.kind === 'empty' ? null : (
                  <li key={i}>
                    <span className="al-hub-who" style={{ borderColor: SEAT_COLORS[i as 0].main }}>
                      {!real ? companyName(seat.name, i) : seat.kind === 'human' && airlines[i] ? REAL_AIRLINE[airlines[i]!].name : `${SEAT_COLORS[i as 0].name} · ${seat.kind === 'human' ? '사람' : '컴퓨터'}`}
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
                      <span className="al-muted">{real ? '맡은 항공사의 본거지로' : '컴퓨터가 고를게요'}</span>
                    )}
                  </li>
                ),
              )}
            </ul>
            {choosing !== null && <HubChooser era={opt.era} taken={hubs.filter((h, i) => h && i !== choosing) as string[]} value={hubs[choosing]} onPick={(c) => setHub(choosing, c)} />}
          </section>

          <BizModelSetup setup={setup} onChange={(models) => setSetup((s) => ({ ...s, models }))} />
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
        <div className="al-footer-options">
          <SpeedPicker caption="컴퓨터·애니메이션 속도" value={settings.speed} onChange={(speed) => onSettings({ ...settings, speed })} inline />
          <button type="button" className="btn" onClick={() => onSettings({ ...settings, music: !settings.music })} data-testid="al-music">
            {settings.music ? '🎵 음악 켜짐' : '🎵 음악 꺼짐'}
          </button>
        </div>
        <button type="button" className="btn btn-primary btn-large" disabled={!canStart} onClick={start} data-testid="al-start">
          {scenario ? '시나리오 시작' : challenge ? '도전 시작' : '게임 시작'}
        </button>
      </section>

      <HowTo />
      <p className="al-credits-link">
        <button type="button" className="btn btn-small btn-ghost" onClick={() => setCredits(true)} data-testid="al-credits-open">
          📷 사진 출처
        </button>
      </p>
      {credits && <CreditsModal onClose={() => setCredits(false)} />}
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
                        <small className="al-muted">{SEASON_NAMES[c.season]}</small>
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
          <b>한 차례 = 한 달</b>: 회사마다 돌아가며 이번 달 경영을 하고 <kbd>Enter</kbd>로 마쳐요. 모두 마치면 한 달 동안 비행기가 날고 짧은 <b>달 결산</b>이 떠요. 석 달마다 <b>분기 결산</b>, 12월에는 <b>한 해 결산과 경영 평가</b>가 나와요. 할 일이 없으면 <b>⏩ 분기 끝까지 맡기기</b>나 <b>⏭ 일이 생길 때까지</b>로 달을 넘겨요 (결정할 일·큰 사건·돈 걱정·라이벌 소식이 생기면 멈춰요).
        </li>
        <li>
          <b>지점 → 노선 → 비행기</b>: 지도에서 도시를 눌러 <b>지점</b>을 열고, 지점이 있는 두 도시 사이에 <b>노선</b>을 열어요. 비행기는 <b>리스</b>(바로 받고 달마다 값의 1.2% 남짓을 냄, 보증금은 돌려줄 때 돌려받음)하거나 <b>주문</b>(값을 먼저 내고 3~12달 뒤에 받음, 막 나온 인기 기종일수록 오래 기다리지만 처음 2년은 15% 싸요)하거나 <b>중고 시장</b>에서 바로 사요. 같은 계열 비행기가 많으면 정비·승무원비가 줄어요.
          <span className="al-howto-planes" aria-hidden="true">
            <PlaneImage model="atr72" paint={{ main: '#30a46c', dark: '#1f7a4d', shape: 'star' }} className="al-plane-chip al-plane-chip-big" />
            <PlaneImage model="a320" paint={{ main: '#e5484d', dark: '#b4282e', shape: 'circle' }} className="al-plane-chip al-plane-chip-big" />
            <PlaneImage model="b747-400" paint={{ main: '#3e63dd', dark: '#2a47a8', shape: 'diamond' }} className="al-plane-chip al-plane-chip-big" />
            <PlaneImage model="concorde" paint={{ main: '#f5b400', dark: '#c28a00', shape: 'leaf' }} className="al-plane-chip al-plane-chip-big" />
          </span>
        </li>
        <li>
          <b>한 대로 여러 노선</b>: 비행기 한 대는 한 주에 98시간까지 날아요. 한 노선에 다 쓰지 않으면 남는 시간으로 다른 노선도 날 수 있어요. 비행기 화면의 <b>가동률</b> 막대를 채워 보세요.
        </li>
        <li>
          <b>비행기마다 달라요</b>: 멀리 못 가는 비행기, 작은 공항에 못 내리는 큰 비행기가 있어요. 공항마다 한 주에 쓸 수 있는 운항 횟수(<b>슬롯</b>)도 정해져 있어요. 새 기종은 연료를 덜 먹고 손님이 좋아해요.
        </li>
        <li>
          <b>갈아타는 손님</b>: 곧장 가는 노선이 없는 두 도시 손님은 본사(허브)처럼 노선이 모이는 도시에서 한 번 갈아타고 가기도 해요. 좌석은 두 구간 모두 차지하고 운임은 거리만큼 나눠요. 다른 회사와 <b>제휴(코드셰어)</b>하면 서로의 노선을 이어 태워요.
        </li>
        <li>
          <b>손님 나누기</b>: 두 도시 사이 손님은 도시 크기·사업과 관광·거리·계절·시대에 따라 정해져요. 같은 두 도시를 여러 회사가 날면, <b>운임이 싸고 자주 날고 편한 비행기를 띄우고 평판·광고가 좋은</b> 회사가 손님을 더 가져가요. 좌석보다 많이 태울 수는 없어요.
        </li>
        <li>
          <b>돈</b>: 운임 수입에서 연료비·직원 임금·운항 수당과 정비·공항·서비스·판매 수수료·리스료·지점 유지비·광고·이자·세금을 빼면 달 이익이에요. 리스료·이자·유지비는 달마다 나가요. 돈이 모자라면 은행에서 빌리고, 넉 달 내내 모자라면 <b>운항을 멈추고</b> 게임에서 빠져요.
        </li>
        <li>
          <b>결정할 일과 목표</b>: 아홉 달에서 한 해에 한 번쯤 임금 협상·연료 계약·새 기종 제안 같은 <b>결정할 일</b>이 와요. 고르면 생길 일을 미리 보여 줘요. 해마다 작은 <b>올해 목표</b> 셋을 받고, 해가 끝나면 <b>S~D 경영 평가</b>를 받아요.
        </li>
        <li>
          <b>경영 비서</b>: 지도 아래 비서가 지난달 숫자를 보고 할 만한 일을 골라 주고, ‘적용’ 한 번으로 해 줘요. 첫해에는 리스 보증금이 없어요.
        </li>
        <li>
          <b>계절과 운항 현장</b>: 손님은 달마다 달라요 — 하와이·방콕은 겨울, 지중해는 여름, 설·추석·여름방학·연말엔 여행이 늘어요 (지도 위 날짜 옆에 이번 달 손님 분위기가 나와요). 날씨(동아시아 태풍 7~9월, 북쪽 폭설 12~2월, 남아시아 몬순 6~9월, 안개)와 낡은 비행기·정비·혼잡 때문에 <b>지연·결항·회항·기체 점검</b>이 생겨요. 재무 화면의 <b>정비 수준</b>·<b>예비 승무원</b>과, 노선에 넣지 않은 <b>예비기</b>로 줄일 수 있어요. 정시 운항률은 평판과 손님에 영향을 줘요. 모두 게임 속 이야기이고 사고는 없어요.
        </li>
        <li>
          <b>💺 등급별 운임</b>: 노선마다 <b>일등석·비즈니스석·일반석·화물</b> 운임을 따로 정해요 (−30~+30%). 고급 좌석을 찾는 손님은 사업 손님일수록, 멀리 갈수록, 요즘일수록 많아요. 비즈니스석은 1979년 무렵 생겼고 그
          전에는 일등석이 흔했어요. 너무 비싸거나 자리가 차면 아래 등급으로 내려가고, 일반석이 차면 남은 고급 좌석에 일반석 값으로 앉아요. 노선 화면 ‘등급별 운임’의 <b>💡 추천 운임</b>이 이익이 가장 큰 값을
          찾아 줘요.
        </li>
        <li>
          <b>🎒 사업 모델과 📦 화물</b>: 회사마다 <b>풀서비스</b>·<b>저가항공</b>(한 등급 촘촘한 좌석, 싼 비용, 빠른 회전, 짐·좌석 값 부가 수입 — 갈아타기·제휴·화물은 없고, 1978년 규제가 풀린 뒤 싼 표 관광 손님이 늘어요)·<b>화물 전문</b>(화물기만) 가운데
          하나로 시작하고, 재무 화면에서 돈과 여섯 달을 들여 바꿀 수 있어요. 짐은 도시 경제·무역 도시·거리·시대로 정해지고 10~12월에 가장 많으며 기름값이 오르면 줄어요. 넓은 동체 여객기는 배 아래 짐칸에 짐을 많이
          싣고, 707-320C부터 747-8F까지 실제 화물기(수치는 근삿값)도 들일 수 있어요.
        </li>
        <li>
          <b>👥 직원과 조직</b>: 비행기를 띄우려면 <b>조종사·객실 승무원·정비사·지상직</b>이 있어야 해요. 필요한 사람 수는 비행시간·좌석·비행기 나이·지점·손님 수로 정해지고, 뽑으면 바로 오지 않아요 (조종사 4~5달, 정비사 2~3달, 객실 승무원 1~2달, 지상직 1달 — 훈련원이 있으면 더 빨라요). 모자라면 15%까지는 초과 근무로 버티지만 그 넘게는 <b>결항</b>이 나요. <b>임금 수준</b>·초과 근무·회사 성장이 <b>조직 만족도</b>를 움직이고, 만족도가 정시 운항·서비스에 닿으며 너무 낮으면 <b>파업</b>이 날 수 있어요. 인사 화면에서 뽑고, 내보내고, 임금을 정해요.
        </li>
        <li>
          <b>🕑 운항 시간표</b>: 노선의 주간 운항을 <b>아침(06–10)·낮(10–16)·저녁(16–21)·밤(21–02)</b>에 나눠요. 사업 손님은 아침·저녁, 관광 손님은 낮을 좋아하고, 장거리는 밤에 떠도 괜찮아요. 큰 공항은 아침·저녁 슬롯이 붐비고, 런던·취리히처럼 <b>밤 운항을 막는 공항</b>도 있어요. 노선 화면의 운항 시간표에서 바꾸고, 비행기 화면의 <b>하루 운항표</b>에서 비행기마다 하루 일정을 볼 수 있어요.
        </li>
        <li>
          <b>실제 항공사와 사진</b>: ‘실제 항공사’로 하면 시작하는 해에 날던 항공사(대한항공·팬암·루프트한자…)를 골라 그 본거지에서 시작해요. 이름·두 글자 부호(IATA)·칠 색만 빌려 쓰고 로고는 쓰지 않으며, 게임 속 경영과 사건은 모두 지어낸 이야기예요. 기종·도시·항공사 사진은 위키미디어 공용의 자유 라이선스 사진이고, 지은이와 라이선스는 ‘📷 사진 출처’에서 볼 수 있어요.
        </li>
        <LoyaltyHowTo />
        <li>
          <b>세계는 움직여요</b>: 해마다 새 기종이 나오고 옛 기종은 생산이 끝나요. 도시가 자라고 공항이 커지며, 기름값·경기·여행 붐·올림픽·엑스포 같은 사건이 손님과 비용을 바꿔요.
        </li>
        <li>
          <b>이기기</b>: 정해진 해까지 회사 가치(현금 + 내 비행기·호텔 가치 + 리스 보증금·주문한 비행기 − 빚) 1등, 또는 여러 지역 취항과 가치 목표를 먼저 이루기, 또는 도전 과제 성공, 또는 역사 시나리오의 단계 목표를 차례로 이뤄 별(★ 3개까지) 받기!
        </li>
        <li>
          조작: 화면 <kbd>1</kbd> 지도 · <kbd>2</kbd> 비행기 · <kbd>3</kbd> 노선 · <kbd>4</kbd> 재무 · <kbd>5</kbd> 인사 · <kbd>6</kbd> 보고서 · <kbd>7</kbd> 뉴스, 이번 달 마치기 <kbd>Enter</kbd>, 닫기 <kbd>Esc</kbd>, 지도 확대 <kbd>+</kbd> <kbd>−</kbd> <kbd>0</kbd>. 처음이면 지도 아래 <b>🧑‍💼 경영 비서</b>의 첫 노선 ‘노선 열기’부터 눌러 보세요!
        </li>
      </ol>
    </details>
  );
}
