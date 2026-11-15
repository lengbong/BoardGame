import './rivals.css';
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { withJosa } from '../../lib/korean';
import { loadJson, saveJson } from '../../lib/storage';
import { ChoiceIcon, ICON_DUO, ICON_LINE, IconPicker, type IconChoice } from '../../components/IconPicker';
import { allianceOf } from './alliances';
import { coColors } from './brand';
import { pairKey } from './cities';
import { OutlookBars } from './FinanceArt';
import { PERSONA, personaOf, quoteOf, rivalsOn } from './personality';
import {
  ASK_GAP,
  MAX_TRUCES,
  REL_BANDS,
  TRUCE_MONTHS,
  VISIT_GAP,
  endTruceBlocker,
  fmtMoney,
  notesFor,
  offersFor,
  pairText,
  relBand,
  relOf,
  rivalsFor,
  sharedRoutes,
  truceAccepts,
  truceBlocker,
  truceFloor,
  truceOutlook,
  trucesOf,
  visitBlocker,
  visitCost,
  visitGain,
} from './relations';
import { NewsView } from './ReportView';
import { allianceOutlook, proposeBlocker } from './rules';
import { alSound } from './sounds';
import { MoreInfo } from './StaffArt';
import type { AiStyle, AirlineAction, AirlineOptions, AirlineState, Route } from './types';
import type { PersonaId } from './rivalTypes';
import { ActButton, CoName } from './ui';

const notMine = '내 차례에만 할 수 있어요';
const STYLE_NAME: Record<AiStyle, string> = { relaxed: '느긋', normal: '보통', fierce: '치열' };
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(Math.trunc(v))}`;
/** 까닭 옆 숫자: 1보다 작으면 소수 한 자리 */
const signedNote = (v: number) => (Math.abs(v) >= 1 || v === 0 ? signed(Math.round(v)) : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`);
const fareText = (v: number) => (v === 0 ? '기본 운임' : `${v > 0 ? '+' : '−'}${Math.abs(v)}%`);

// ------------------------------------------------------------------ 동물 그림 (직접 그린 마스코트, 사람 얼굴이 아니에요)

function Face({ id }: { id: PersonaId }) {
  const ink = '#3a2a1e';
  switch (id) {
    case 'expander':
      // 호랑이
      return (
        <g>
          <circle cx="16" cy="17" r="7" fill="#f29a3a" stroke={ink} strokeWidth="1.2" />
          <circle cx="48" cy="17" r="7" fill="#f29a3a" stroke={ink} strokeWidth="1.2" />
          <circle cx="16" cy="17" r="3.4" fill="#fbe3c4" />
          <circle cx="48" cy="17" r="3.4" fill="#fbe3c4" />
          <ellipse cx="32" cy="36" rx="21" ry="19" fill="#f29a3a" stroke={ink} strokeWidth="1.2" />
          <ellipse cx="32" cy="44" rx="11.5" ry="8.5" fill="#fff6e8" />
          <path d="M32 18v6M26 19.5l1.8 5M38 19.5l-1.8 5M11.5 33h6M12 38.5h5M52.5 33h-6M52 38.5h-5" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="25" cy="33" r="2.7" fill={ink} />
          <circle cx="39" cy="33" r="2.7" fill={ink} />
          <circle cx="25.9" cy="32.1" r="0.9" fill="#fff" />
          <circle cx="39.9" cy="32.1" r="0.9" fill="#fff" />
          <path d="M28.8 40h6.4L32 43.4z" fill="#7a3f2c" />
          <path d="M32 43.4v2M32 45.4q-3 2.4-5.2 0M32 45.4q3 2.4 5.2 0" stroke={ink} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'saver':
      // 다람쥐
      return (
        <g>
          <ellipse cx="19" cy="16" rx="5" ry="7" fill="#b5763f" stroke={ink} strokeWidth="1.2" />
          <ellipse cx="45" cy="16" rx="5" ry="7" fill="#b5763f" stroke={ink} strokeWidth="1.2" />
          <ellipse cx="19" cy="17" rx="2.2" ry="3.6" fill="#f1b9a4" />
          <ellipse cx="45" cy="17" rx="2.2" ry="3.6" fill="#f1b9a4" />
          <ellipse cx="32" cy="36" rx="20" ry="18.5" fill="#c98a4b" stroke={ink} strokeWidth="1.2" />
          <circle cx="21" cy="43" r="8" fill="#f3d9b8" />
          <circle cx="43" cy="43" r="8" fill="#f3d9b8" />
          <path d="M32 18.5v9M24.5 21q-3 5-6 8M39.5 21q3 5 6 8" stroke="#6b4423" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <circle cx="25" cy="32" r="3" fill={ink} />
          <circle cx="39" cy="32" r="3" fill={ink} />
          <circle cx="26" cy="31" r="1" fill="#fff" />
          <circle cx="40" cy="31" r="1" fill="#fff" />
          <ellipse cx="32" cy="39.5" rx="2.6" ry="2" fill="#4a2b18" />
          <path d="M32 41.5v1.8M32 43.3q-2.6 2-4.6 0M32 43.3q2.6 2 4.6 0" stroke={ink} strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <rect x="30.4" y="44.2" width="3.2" height="3.6" rx="0.8" fill="#fff" stroke={ink} strokeWidth="0.8" />
        </g>
      );
    case 'service':
      // 두루미 (옆모습)
      return (
        <g>
          <ellipse cx="38" cy="62" rx="20" ry="9" fill="#fff" stroke="#8a8f96" strokeWidth="1.2" />
          <path d="M27 31C25 41 24 51 24 64h14c-1-12-2-24 0-32z" fill="#2c2c2e" />
          <circle cx="33" cy="24" r="10.5" fill="#fff" stroke="#8a8f96" strokeWidth="1.2" />
          <ellipse cx="31.5" cy="15" rx="5.2" ry="3" fill="#e0393e" />
          <path d="M23.5 27q3 6 8.5 6.5" stroke="#2c2c2e" strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="36" cy="22.5" r="1.9" fill={ink} />
          <circle cx="36.6" cy="21.9" r="0.6" fill="#fff" />
          <path d="M42.5 21.5L59 24.6 42.5 27z" fill="#c9b26a" stroke="#8b7a3c" strokeWidth="1" strokeLinejoin="round" />
        </g>
      );
    case 'hub':
      // 부엉이
      return (
        <g>
          <path d="M14 22l5-12 6.5 10zM50 22l-5-12-6.5 10z" fill="#7a5234" stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />
          <ellipse cx="32" cy="38" rx="20" ry="20.5" fill="#9a6b45" stroke={ink} strokeWidth="1.2" />
          <circle cx="24" cy="33" r="9" fill="#f1dfc0" />
          <circle cx="40" cy="33" r="9" fill="#f1dfc0" />
          <circle cx="24" cy="33" r="5.2" fill="#f6c445" stroke={ink} strokeWidth="0.8" />
          <circle cx="40" cy="33" r="5.2" fill="#f6c445" stroke={ink} strokeWidth="0.8" />
          <circle cx="24" cy="33" r="2.6" fill={ink} />
          <circle cx="40" cy="33" r="2.6" fill={ink} />
          <circle cx="25" cy="32" r="0.9" fill="#fff" />
          <circle cx="41" cy="32" r="0.9" fill="#fff" />
          <path d="M29.8 39h4.4L32 44.5z" fill="#e2a33b" stroke={ink} strokeWidth="0.8" strokeLinejoin="round" />
          <path d="M25 49q2 2.2 4 0M31 49q2 2.2 4 0M37 49q2 2.2 4 0M28 53.5q2 2.2 4 0M34 53.5q2 2.2 4 0" stroke="#e9d4b0" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'fare':
      // 여우
      return (
        <g>
          <path d="M12 8l15 12-12 8zM52 8L37 20l12 8z" fill="#e8742d" stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M15.5 13.5l7.5 6.5-6 4zM48.5 13.5L41 20l6 4z" fill="#fff1e2" />
          <path d="M9 26Q32 13 55 26Q51 45 32 57Q13 45 9 26z" fill="#e8742d" stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M13 32Q22 44 32 44Q42 44 51 32Q47 47 32 56.5Q17 47 13 32z" fill="#fff6ec" />
          <ellipse cx="24" cy="31.5" rx="2.8" ry="2.1" fill={ink} />
          <ellipse cx="40" cy="31.5" rx="2.8" ry="2.1" fill={ink} />
          <circle cx="24.9" cy="30.9" r="0.7" fill="#fff" />
          <circle cx="40.9" cy="30.9" r="0.7" fill="#fff" />
          <circle cx="32" cy="50.5" r="2.5" fill={ink} />
          <path d="M28.5 46q3.5 2 7 0" stroke={ink} strokeWidth="1.1" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'pioneer':
      // 알바트로스
      return (
        <g>
          <path d="M1 60Q15 42 29 51v13H1zM63 60Q49 42 35 51v13h28z" fill="#6b7a88" stroke="#3e4852" strokeWidth="1.1" />
          <ellipse cx="32" cy="59" rx="12" ry="9" fill="#fff" stroke="#8a8f96" strokeWidth="1" />
          <circle cx="32" cy="29" r="17" fill="#fff" stroke="#8a8f96" strokeWidth="1.2" />
          <path d="M17 24.5Q23.5 19.5 29.5 25.5M47 24.5Q40.5 19.5 34.5 25.5" stroke="#55606b" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <circle cx="25" cy="28" r="2.4" fill={ink} />
          <circle cx="39" cy="28" r="2.4" fill={ink} />
          <circle cx="25.8" cy="27.3" r="0.8" fill="#fff" />
          <circle cx="39.8" cy="27.3" r="0.8" fill="#fff" />
          <path d="M27 33.5Q32 30.5 37 33.5L35 47Q32 51 29 47z" fill="#f4c0a0" stroke="#b9805f" strokeWidth="1" strokeLinejoin="round" />
          <circle cx="32" cy="47.5" r="2" fill="#d0956f" />
        </g>
      );
  }
}

const BG: Record<PersonaId, string> = { expander: '#fde7c8', saver: '#f3e3cf', service: '#dceef6', hub: '#eadfcd', fare: '#fde2cf', pioneer: '#dbe9f5' };

/** 라이벌 경영진 그림 (동물 마스코트 + 회사 색 테) */
export function RivalAvatar({ persona, color, size = 56 }: { persona: PersonaId; color: string; size?: number }) {
  const clip = useId();
  return (
    <svg className="al-rv-avatar" viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={`${PERSONA[persona].animal} 그림 (${PERSONA[persona].name})`}>
      <defs>
        <clipPath id={clip}>
          <circle cx="32" cy="32" r="29" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="29" fill={BG[persona]} />
      <g clipPath={`url(#${clip})`}>
        <Face id={persona} />
      </g>
      <circle cx="32" cy="32" r="30" fill="none" stroke={color} strokeWidth="3.4" />
    </svg>
  );
}

// ------------------------------------------------------------------ 사이 막대

/** −100…+100 사이 막대: 가운데에서 왼쪽(나쁨)·오른쪽(좋음)으로 채우고, 말과 얼굴 표로도 보여 준다 */
export function RelationBar({ value, label }: { value: number; label: string }) {
  const band = REL_BANDS[relBand(value)];
  const v = Math.max(-100, Math.min(100, value));
  const left = v >= 0 ? 50 : 50 + v / 2;
  const width = Math.abs(v) / 2;
  return (
    <div className={`al-rv-rel al-rv-tone-${band.tone}`}>
      <span className="al-rv-bar" role="meter" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={`${label}: ${band.word} (${signed(v)})`}>
        <span className="al-rv-fill" style={{ left: `${left}%`, width: `${width}%` }} />
        <span className="al-rv-mid" aria-hidden="true" />
        <span className="al-rv-dot" style={{ left: `${50 + v / 2}%` }} aria-hidden="true" />
      </span>
      <span className="al-rv-word">
        <span aria-hidden="true">{band.icon}</span> <b>{band.word}</b> <small>{signed(v)}</small>
      </span>
    </div>
  );
}

// ------------------------------------------------------------------ 한 라이벌

function RivalCard({ state, viewer, ci, canAct, perform }: { state: AirlineState; viewer: number; ci: number; canAct: boolean; perform: (a: AirlineAction) => void }) {
  const c = state.companies[ci];
  const id = personaOf(state, ci)!;
  const p = PERSONA[id];
  const color = coColors(c).main;
  const rel = relOf(state, ci, viewer);
  const notes = notesFor(state, ci, viewer, 2);
  const shared = sharedRoutes(state, viewer, ci);
  const truces = trucesOf(state, viewer).filter((tr) => tr.a === ci || tr.b === ci);
  const offers = offersFor(state, viewer).filter((o) => o.from === ci);
  // 휴전을 청할 수 있는 노선 (이미 휴전 중이거나 받은 제안이 있는 노선은 빼고)
  const free = shared.filter((x) => !truces.some((tr) => tr.key === x.key) && !offers.some((o) => o.key === x.key));
  // 기본으로 고르는 노선: 운임 차이가 가장 큰 노선
  const best = [...free].sort((x, y) => Math.abs(y.mine.fare - y.theirs.fare) - Math.abs(x.mine.fare - x.theirs.fare))[0];
  const [pick, setPick] = useState<number | null>(null);
  const chosen = free.find((x) => x.mine.id === pick) ?? best;
  const [bubble, setBubble] = useState<{ t: number; text: string } | null>(null);
  const selId = useId();

  const visitWhy = canAct ? visitBlocker(state, viewer, ci) : notMine;
  const truceWhy = !canAct ? notMine : chosen ? truceBlocker(state, viewer, ci, chosen.mine.id) : shared.length > 0 ? '함께 나는 노선이 모두 휴전·제안 중이에요' : truceBlocker(state, viewer, ci, -1);
  const look = chosen ? truceOutlook(state, viewer, ci, chosen.key) : null;
  const allyWhy = canAct ? proposeBlocker(state, viewer, ci) : notMine;
  const allyLook = allianceOutlook(state, viewer, ci);
  // 그 회사 동맹에 사람 회사가 있으면 그 사람이 정한다 (rules.ts의 propose)
  const humanSide = !!allianceOf(state, ci)?.members.some((m) => m !== viewer && state.companies[m].kind === 'human');
  const say = (kind: Parameters<typeof quoteOf>[2]) => setBubble({ t: state.t, text: quoteOf(state, ci, kind) });

  return (
    <article className="al-rv-card" style={{ '--rv-co': color } as CSSProperties} data-testid={`al-rival-${ci}`}>
      <header className="al-rv-head">
        <RivalAvatar persona={id} color={color} />
        <div className="al-rv-who">
          <CoName c={c} bold />
          <span className="al-rv-persona">
            <b title={p.desc}>{p.name}</b>
            <small className="al-muted" title="게임 전체의 컴퓨터 성향 (설정)">
              {' '}
              · 성향 {STYLE_NAME[state.options.aiStyle ?? 'normal']}
            </small>
          </span>
          <small className="al-rv-motto">“{p.motto}”</small>
        </div>
      </header>
      {bubble && bubble.t === state.t && (
        <p className="al-rv-bubble" role="status">
          {bubble.text}
        </p>
      )}
      <RelationBar value={rel} label={`${withJosa(c.name, '와/과')} 우리 사이`} />
      <ul className="al-rv-traits" aria-label="경영 특징">
        {p.traits.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      {notes.length > 0 ? (
        <ul className="al-rv-notes" aria-label="최근 까닭">
          {notes.map((n, k) => (
            <li key={k}>
              <b className={n.d > 0 ? 'al-pos' : n.d < 0 ? 'al-neg' : 'al-muted'}>{signedNote(n.d)}</b> {n.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="al-rv-notes al-muted">아직 별일 없어요.</p>
      )}
      {offers.map((o) => (
        <div key={o.id} className="al-rv-offer" data-testid="al-rival-offer">
          <span>
            🕊️ <b>휴전 제안</b>: {pairText(o.key)} {TRUCE_MONTHS}달
          </span>
          <span className="al-rv-offer-btns">
            <ActButton
              small
              primary
              blocker={canAct ? (trucesOf(state, viewer).length >= MAX_TRUCES ? `휴전은 한 번에 ${MAX_TRUCES}개까지예요` : null) : notMine}
              onClick={() => {
                alSound.chime();
                say('truceYes');
                perform({ type: 'rivalAnswer', offer: o.id, accept: true });
              }}
            >
              받아들이기
            </ActButton>
            <ActButton
              small
              blocker={canAct ? null : notMine}
              quiet
              onClick={() => {
                say('offerNo');
                perform({ type: 'rivalAnswer', offer: o.id, accept: false });
              }}
            >
              거절하기
            </ActButton>
          </span>
        </div>
      ))}
      {truces.map((tr) => {
        const floor = truceFloor(state, viewer, tr.key);
        return (
          <div key={tr.key} className="al-rv-truce">
            <span>
              🕊️ <b>{pairText(tr.key)}</b> 휴전 · {tr.until - state.t}달 남음
              <small className="al-muted"> · 우리 일반석 운임 {fareText(floor ?? 0)} 아래로 내리지 않기</small>
            </span>
            <ActButton
              small
              quiet
              blocker={canAct ? endTruceBlocker(state, viewer, ci, tr.key) : notMine}
              onClick={() => {
                if (!window.confirm(`${pairText(tr.key)} 휴전을 먼저 끝낼까요? ${c.name}이(가) 많이 서운해해요.`)) return;
                alSound.nope();
                say('broken');
                perform({ type: 'rivalEndTruce', to: ci, key: tr.key });
              }}
            >
              먼저 끝내기
            </ActButton>
          </div>
        );
      })}
      <div className="al-rv-actions">
        <ActButton
          small
          blocker={visitWhy}
          testId={`al-rival-visit-${ci}`}
          title={`선물을 들고 인사를 가요: 사이 +${visitGain(state, viewer, ci)} (${VISIT_GAP}달에 한 번)`}
          onClick={() => {
            alSound.bell();
            say('gift');
            perform({ type: 'rivalVisit', to: ci });
          }}
        >
          🎁 인사 방문 · {fmtMoney(visitCost(state, viewer))}
        </ActButton>
        <span className="al-rv-truce-ask">
          {free.length > 1 && (
            <>
              <label htmlFor={selId} className="al-sr">
                휴전할 노선
              </label>
              <select id={selId} className="al-rv-select" value={chosen?.mine.id ?? ''} onChange={(e) => setPick(Number(e.target.value))}>
                {free.map((x) => (
                  <option key={x.mine.id} value={x.mine.id}>
                    {pairText(x.key)} (우리 {fareText(x.mine.fare)} · 상대 {fareText(x.theirs.fare)})
                  </option>
                ))}
              </select>
            </>
          )}
          <ActButton
            small
            blocker={truceWhy}
            testId={`al-rival-truce-${ci}`}
            title={`${TRUCE_MONTHS}달 동안 두 회사 모두 이 노선 일반석 운임을 지금보다 내리지 않기로 해요`}
            onClick={() => {
              if (!chosen) return;
              const yes = truceAccepts(state, viewer, ci, chosen.key);
              if (yes) alSound.chime();
              else alSound.nope();
              say(yes ? 'truceYes' : 'truceNo');
              perform({ type: 'rivalTruce', to: ci, route: chosen.mine.id });
            }}
          >
            🕊️ 휴전 제안{chosen && free.length === 1 ? `: ${pairText(chosen.key)}` : ''}
          </ActButton>
          {look && !truceWhy && (
            <small className="al-muted al-outlook-text">
              <OutlookBars level={look === 'yes' ? 3 : look === 'maybe' ? 2 : 1} />
              {look === 'yes' ? '받아들일 것 같아요' : look === 'maybe' ? '반반이에요' : '거절할 것 같아요'}
            </small>
          )}
        </span>
        <span className="al-rv-ally">
          <ActButton small blocker={allyWhy} testId={`al-rival-ally-${ci}`} onClick={() => perform({ type: 'propose', to: ci })}>
            🤝 {allianceOf(state, viewer) ? '동맹에 초대' : allianceOf(state, ci) ? '동맹 가입 신청' : '동맹 제안'}
          </ActButton>
          {!allyWhy &&
            (humanSide ? (
              <small className="al-muted">사람이 정해요</small>
            ) : (
              <small className="al-muted al-outlook-text">
                <OutlookBars level={allyLook === 'yes' ? 3 : allyLook === 'maybe' ? 2 : 1} />
                {allyLook === 'yes' ? '받아들일 것 같아요' : allyLook === 'maybe' ? '반반이에요' : '거절할 것 같아요'}
              </small>
            ))}
        </span>
      </div>
    </article>
  );
}

// ------------------------------------------------------------------ 라이벌 카드 (뉴스 화면 위)

/** 뉴스 화면의 '라이벌' 카드: 컴퓨터 회사마다 경영진 성격·사이·최근 까닭·외교 버튼 */
export function RivalsCard({ state, viewer, canAct, perform }: { state: AirlineState; viewer: number; canAct: boolean; perform: (a: AirlineAction) => void }) {
  // 접어 두기 (이 브라우저에만 기억한다)
  const [folded, setFolded] = useState(() => loadJson<boolean>(FOLD_KEY) === true);
  const bodyId = useId();
  const list = rivalsFor(state, viewer);
  if (state.companies[viewer]?.kind !== 'human' || list.length === 0) return null;
  const real = list.some((i) => state.companies[i].airline);
  const offers = offersFor(state, viewer).length;
  const toggle = () => {
    setFolded(!folded);
    saveJson(FOLD_KEY, !folded);
  };
  return (
    <section className={`al-card al-rv${folded ? ' al-rv-folded' : ''}`} data-testid="al-rivals" aria-labelledby="al-rv-title">
      <h3 className="al-rv-title" id="al-rv-title">
        <RivalsIcon /> 라이벌 경영진 <small className="al-muted">{real ? '성격과 한마디는 게임 속 이야기예요' : '컴퓨터 회사마다 성격이 달라요'}</small>
        <button type="button" className="btn btn-small btn-ghost al-rv-fold" aria-expanded={!folded} aria-controls={bodyId} onClick={toggle} data-testid="al-rivals-fold">
          {folded ? `펼치기${offers ? ` · 휴전 제안 ${offers}` : ''}` : '접기'}
        </button>
      </h3>
      {folded ? (
        <ul className="al-rv-mini" id={bodyId}>
          {list.map((ci) => {
            const c = state.companies[ci];
            const v = relOf(state, ci, viewer);
            const band = REL_BANDS[relBand(v)];
            return (
              <li key={ci}>
                <RivalAvatar persona={personaOf(state, ci)!} color={coColors(c).main} size={30} />
                <span className="al-rv-mini-name">{c.name}</span>
                <span className={`al-rv-mini-rel al-rv-tone-${band.tone}`}>
                  <span aria-hidden="true">{band.icon}</span> {band.word}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="al-rv-grid" id={bodyId}>
          {list.map((ci) => (
            <RivalCard key={ci} state={state} viewer={viewer} ci={ci} canAct={canAct} perform={perform} />
          ))}
        </div>
      )}
      {!folded && <MoreInfo label="성격과 사이는 어떻게 움직여요?">
        <ul className="al-rv-help">
          {list.map((ci) => {
            const pd = PERSONA[personaOf(state, ci)!];
            return (
              <li key={ci}>
                <b>{state.companies[ci].name} · {pd.name}</b> ({pd.animal}): {pd.desc}
              </li>
            );
          })}
          <li>내가 라이벌 노선에 들어가거나(−6), 같은 노선에서 10%p 넘게 싸게 팔면 사이가 나빠져요. 주식을 많이 사들여도 경계해요 (알뜰한 살림꾼·새 길 개척자는 반겨요).</li>
          <li>같은 동맹이면 달마다 좋아지고, 휴전을 끝까지 지키면 고마워해요. 연말 시상식 상도 성격에 따라 축하하거나 분해해요.</li>
          <li>사이가 좋으면 동맹 제안을 잘 받아 주고 우리 노선을 피하며, 가끔 먼저 휴전을 청해요. 아주 나쁘면 우리 노선에 일부러 들어오거나(공격적인 확장가) 더 싸게 팔아요(운임 승부사).</li>
          <li>
            🎁 인사 방문은 {VISIT_GAP}달에 한 번, 🕊️ 휴전은 {TRUCE_MONTHS}달 동안 두 회사 모두 그 노선 일반석 운임을 휴전 때보다 내리지 않기로 해요 (한 번에 {MAX_TRUCES}개까지, 거절당하면 {ASK_GAP}달 뒤에
            다시). 사이는 달마다 조금씩 보통으로 돌아가요.
          </li>
        </ul>
      </MoreInfo>}
    </section>
  );
}

const FOLD_KEY = 'family-boardgame.airline.rivals-folded.v1';

/** 뉴스 화면: 라이벌 카드 + 하늘길 뉴스 (Game.tsx가 부른다) */
export function NewsWithRivals({ state, viewer, canAct, perform, onCity }: { state: AirlineState; viewer: number; canAct: boolean; perform: (a: AirlineAction) => void; onCity: (id: string) => void }) {
  if (!rivalsOn(state)) return <NewsView state={state} onCity={onCity} viewer={viewer} />;
  return (
    <div className="al-rv-news">
      <RivalsCard state={state} viewer={viewer} canAct={canAct} perform={perform} />
      <NewsView state={state} onCity={onCity} viewer={viewer} />
    </div>
  );
}

/** 두 비행기가 마주 보는 작은 그림 */
export function RivalsIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="al-rv-icon">
      <path d="M2 9.5l4.5-1 2.5-4h1.6l-1 4.2 3-.6.9-1.6h1l-.4 2.3-1.3.3-3.1.7 1 4.1H9.9L7.5 10l-4.6.6z" fill="var(--accent)" />
      <path d="M22 14.5l-4.5 1-2.5 4h-1.6l1-4.2-3 .6-.9 1.6h-1l.4-2.3 1.3-.3 3.1-.7-1-4.1h1.6l2.4 3.9 4.6-.6z" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

// ------------------------------------------------------------------ 운임 화면의 휴전 알림

/** 이 노선이 휴전 중이면 한 줄 (운임을 어디까지 내릴 수 있는지) */
export function TruceNote({ state, viewer, route }: { state: AirlineState; viewer: number; route: Pick<Route, 'a' | 'b'> }) {
  const key = pairKey(route.a, route.b);
  const tr = trucesOf(state, viewer).find((x) => x.key === key);
  if (!tr) return null;
  const other = tr.a === viewer ? tr.b : tr.a;
  const floor = truceFloor(state, viewer, key) ?? 0;
  return (
    <p className="al-rv-truce-note" role="note" data-testid="al-truce-note">
      🕊️ {withJosa(state.companies[other].name, '와/과')} 휴전 중 ({tr.until - state.t}달 남음): 일반석 운임을 <b>{fareText(floor)}</b> 아래로 내릴 수 없어요. 뉴스 화면 라이벌 카드에서 먼저 끝낼 수
      있어요.
    </p>
  );
}

// ------------------------------------------------------------------ 설정

function PersonaChoiceIcon({ on }: { on: boolean }) {
  return (
    <ChoiceIcon>
      <circle cx="16" cy="16" r="10" {...ICON_DUO} />
      <circle cx="12.5" cy="14.5" r="1.4" fill="currentColor" />
      <circle cx="19.5" cy="14.5" r="1.4" fill="currentColor" />
      <path d="M12 19.5q4 3 8 0" {...ICON_LINE} />
      {!on && <path d="M6 6l20 20" {...ICON_LINE} />}
    </ChoiceIcon>
  );
}

const PERSONA_CHOICES: IconChoice<'on' | 'off'>[] = [
  { value: 'on', short: '켜기', label: '컴퓨터 회사마다 경영진 성격(확장가·살림꾼·서비스 장인…)이 있고, 사이가 좋아지거나 나빠져요', icon: <PersonaChoiceIcon on /> },
  { value: 'off', short: '끄기', label: '성격과 관계 없이 모든 컴퓨터가 똑같이 경영해요', icon: <PersonaChoiceIcon on={false} /> },
];

/** 설정 화면 '규칙'에 붙는 라이벌 성격 켜기·끄기 (기본 켜기) */
export function RivalsSetup({ opt, setOpt }: { opt: AirlineOptions; setOpt: (patch: Partial<AirlineOptions>) => void }): ReactNode {
  const on = opt.personas !== false;
  return (
    <div className="al-rv-setup">
      <IconPicker caption="라이벌 성격" value={on ? 'on' : 'off'} options={PERSONA_CHOICES} onChange={(v) => setOpt({ personas: v === 'on' })} testId="al-personas" />
      <p className="al-note">
        {on
          ? '🐯 컴퓨터 회사마다 경영진 성격이 달라 넓히는 빠르기·운임·기내식·비행기 고르기가 달라요. 인사 방문과 노선 휴전으로 사이를 좋게 할 수 있어요 (뉴스 화면).'
          : '컴퓨터 회사들이 성격 없이 똑같은 방식으로 경영해요.'}
      </p>
    </div>
  );
}
