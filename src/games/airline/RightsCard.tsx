import { useId, useState } from 'react';
import './rights.css';
import { MoreInfo } from './StaffArt';
import {
  CARRIER_LIMIT,
  EUROPE_OPEN,
  RIGHTS_MODE_INFO,
  RIGHTS_TIERS,
  RIGHT_LAPSE,
  RIGHT_STEP,
  RIGHT_WAIT,
  WIDEN_YEAR,
  applyRightsBlocker,
  approvalChance,
  myPairs,
  rightsFee,
  rightsInfoFor,
  money,
  rightsMode,
  splitRightsList,
  type RightsInfo,
} from './rights';
import { mLabel, yearOf } from './time';
import type { AirlineAction, AirlineState } from './types';
import { ActButton, Meter } from './ui';

const notMine = '내 차례에만 할 수 있어요';

/** 여권 도장 모양 아이콘 */
export function RightsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="al-rt-icon">
      <rect x="4" y="2.5" width="16" height="19" rx="2.5" fill="var(--surface-2)" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="10" r="4.2" fill="none" stroke="var(--accent)" strokeWidth="1.6" />
      <path d="M7.8 10h8.4M12 5.8c1.6 1.5 1.6 6.9 0 8.4M12 5.8c-1.6 1.5-1.6 6.9 0 8.4" fill="none" stroke="var(--accent)" strokeWidth="1" />
      <path d="M8 17.5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** 남은 횟수 글 */
function leftText(info: RightsInfo): string {
  if (info.free === 'domestic') return '나라 안 노선 — 운수권이 필요 없어요';
  if (info.free === 'home') return '본국을 오가는 노선 — 횟수 제한 없음';
  if (!Number.isFinite(info.allow)) return '횟수 제한 없음';
  if (info.full) return `자리가 찼어요 (항공사 ${CARRIER_LIMIT[info.tier as 0 | 1]}곳까지)`;
  if (info.allow <= 0) return '운수권이 없어요 — 신청해야 날 수 있어요';
  return `주 ${info.allow}회 가운데 ${Math.max(0, info.left)}회 남음`;
}

/** 신청 버튼에 붙는 글 */
function applyLabel(state: AirlineState): string {
  const mode = rightsMode(state);
  if (mode === 'off') return '';
  return `주 ${RIGHT_STEP[mode]}회 더 신청 · ${money(rightsFee(state))}`;
}

/** 신청 버튼에 마우스를 올리면 */
function applyTitle(state: AirlineState, viewer: number, info: RightsInfo): string {
  const mode = rightsMode(state);
  if (mode === 'off') return '';
  return `정부에 운수권을 더 신청해요. 받아들여질 확률 ${Math.round(approvalChance(state, viewer, info.key) * 100)}% · ${RIGHT_WAIT[mode]}달 뒤 결산 때 정해져요`;
}

/** 노선 고치기·새 노선 찾기에 붙는 한 줄: 두 나라 사이 남은 주간 횟수와 신청 버튼 */
export function RightsLine({ state, viewer, a, b, canAct, perform }: { state: AirlineState; viewer: number; a: string; b: string; canAct: boolean; perform: (x: AirlineAction) => void }) {
  if (rightsMode(state) === 'off') return null;
  const info = rightsInfoFor(state, viewer, a, b);
  if (info.domestic) return null;
  const limited = Number.isFinite(info.allow);
  const tight = limited && info.left <= 0;
  const why = applyRightsBlocker(state, viewer, info.key);
  return (
    <div className={`al-rt-line${tight ? ' al-rt-tight' : ''}`} data-testid="al-rights-line">
      <RightsIcon size={18} />
      <span className="al-rt-line-text">
        <b>{info.label}</b> <span className="al-rt-tier">{RIGHTS_TIERS[info.tier].icon} {RIGHTS_TIERS[info.tier].name}</span>
        <span className={tight ? 'al-neg' : limited ? '' : 'al-pos'}> · {leftText(info)}</span>
        {limited && info.allow > 0 && <Meter value={info.used / info.allow} tone={tight ? 'bad' : info.left <= 3 ? 'warn' : 'blue'} label={`운수권 ${info.used}/${info.allow}회`} />}
        {info.pending && <small className="al-muted"> · 신청한 주 {info.pending.add}회는 {mLabel(info.pending.due)} 결산 때 정해져요</small>}
      </span>
      {limited && !info.pending && (
        <span className="al-rt-apply">
          <ActButton small blocker={canAct ? why : notMine} quiet onClick={() => perform({ type: 'applyRights', key: info.key })} testId="al-rights-apply" title={applyTitle(state, viewer, info)}>
            {applyLabel(state)}
          </ActButton>
          <small className="al-muted">될 확률 {Math.round(approvalChance(state, viewer, info.key) * 100)}%</small>
        </span>
      )}
    </div>
  );
}

/** 새 노선 찾기의 도시 목록에 붙는 작은 표 (운수권이 모자랄 때만) */
export function RightsFlag({ state, viewer, a, b }: { state: AirlineState; viewer: number; a: string; b: string }) {
  if (rightsMode(state) === 'off') return null;
  const info = rightsInfoFor(state, viewer, a, b);
  if (!Number.isFinite(info.allow)) return null;
  if (info.left <= 0) return <span className="al-flag al-rt-flag" title="이 두 나라 사이 운수권을 다 썼거나 없어요">🛂 운수권 없음</span>;
  // 넉넉하면 표를 달지 않는다 (목록이 어지럽지 않게)
  if (info.left > 7) return null;
  return <span className="al-flag al-flag-warn al-rt-flag" title="이 두 나라 사이 운수권으로 더 띄울 수 있는 주간 왕복">🛂 주 {info.left}회</span>;
}

/** 지금 시대의 협정 설명 */
function eraText(state: AirlineState): string {
  const year = yearOf(state.q);
  if (year < WIDEN_YEAR) return `지금은 ${RIGHTS_TIERS[0].name} 시대예요. ${WIDEN_YEAR}년부터 협정이 넓어져요.`;
  if (year < 1995) return `지금은 ${RIGHTS_TIERS[1].name} 시대예요. 1995년 무렵부터 나라마다 ${RIGHTS_TIERS[2].name}을 맺기 시작해요.`;
  return `${RIGHTS_TIERS[2].name}을 맺은 두 나라 사이는 횟수 제한이 없어요${year >= EUROPE_OPEN ? ' (유럽 나라끼리도)' : ''}. 아직 맺지 않은 나라는 ${RIGHTS_TIERS[1].name} 그대로예요.`;
}

/** 운수권 카드의 한 줄: 두 나라 · 남은 횟수 막대 · 신청 버튼(또는 신청 중) */
function RightsRow({ state, viewer, info, canAct, perform }: { state: AirlineState; viewer: number; info: RightsInfo; canAct: boolean; perform: (a: AirlineAction) => void }) {
  const why = applyRightsBlocker(state, viewer, info.key);
  const tight = info.left <= 0;
  return (
    <li className={tight ? 'al-rt-tight' : ''}>
      <span className="al-rt-name">
        <b>{info.label}</b>
        <small className="al-muted">
          {RIGHTS_TIERS[info.tier].icon} {RIGHTS_TIERS[info.tier].name}
          {info.extra > 0 ? ` · 더 받은 주 ${info.extra}회` : ''}
        </small>
      </span>
      <span className="al-rt-use">
        {info.allow > 0 && <Meter value={info.used / info.allow} tone={tight ? 'bad' : info.left <= 3 ? 'warn' : 'blue'} label={`운수권 ${info.used}/${info.allow}회`} />}
        <small className={tight ? 'al-neg' : ''}>{info.allow > 0 ? `${info.used}/${info.allow}회` : leftText(info)}</small>
      </span>
      {info.pending ? (
        <small className="al-muted">⏳ 주 {info.pending.add}회 신청 중 · {mLabel(info.pending.due)}</small>
      ) : (
        <ActButton small blocker={canAct ? why : notMine} quiet onClick={() => perform({ type: 'applyRights', key: info.key })} title={why ?? applyTitle(state, viewer, info)}>
          {applyLabel(state)}
        </ActButton>
      )}
    </li>
  );
}

/** 재무 화면의 운수권 카드: 우리가 나는 두 나라마다 남은 주간 횟수와 신청.
 *  다 쓴 곳·신청 중인 곳과 빠듯한 몇 곳만 보이고, 넉넉한 나머지는 '더 보기'로 접어 둔다 (노선이 많으면 카드가 끝없이 길어져서) */
export function RightsCard({ state, viewer, canAct, perform }: { state: AirlineState; viewer: number; canAct: boolean; perform: (a: AirlineAction) => void }) {
  const [showAll, setShowAll] = useState(false);
  const listId = useId();
  const mode = rightsMode(state);
  if (mode === 'off') {
    return (
      <section className="al-card al-rights" data-testid="al-rights">
        <h4 className="al-fin-title">
          <RightsIcon /> 운수권과 항공 협정
        </h4>
        <p className="al-muted">이 판은 운수권 규칙을 껐어요. 나라 관계(실제 역사)만 지키면 어느 나라든 마음껏 날아요.</p>
      </section>
    );
  }
  const pairs = myPairs(state, viewer);
  const limited = pairs.filter((x) => Number.isFinite(x.allow));
  const free = pairs.filter((x) => !Number.isFinite(x.allow));
  const { top, rest } = splitRightsList(limited);
  const row = (info: RightsInfo) => <RightsRow key={info.key} state={state} viewer={viewer} info={info} canAct={canAct} perform={perform} />;
  return (
    <section className="al-card al-rights" data-testid="al-rights">
      <h4 className="al-fin-title">
        <RightsIcon /> 운수권과 항공 협정 <small>{RIGHTS_MODE_INFO[mode].name}</small>
      </h4>
      <p className="al-note">{eraText(state)}</p>
      {limited.length === 0 ? (
        <p className="al-muted">{pairs.length === 0 ? '아직 나라와 나라를 잇는 노선이 없어요.' : '지금 나는 국제선은 모두 횟수 제한 없이 날아요.'}</p>
      ) : (
        <>
          {/* 펼쳐도 보이던 줄은 제자리에 두고 나머지를 밑에 붙인다 */}
          <ul className="al-rt-list" id={listId}>
            {(showAll ? [...top, ...rest] : top).map(row)}
          </ul>
          {rest.length > 0 && (
            <button type="button" className="al-more-btn al-rt-more" aria-expanded={showAll} aria-controls={listId} onClick={() => setShowAll(!showAll)} data-testid="al-rights-more">
              {showAll ? '▴ 접기' : `▾ 나머지 ${rest.length}곳 더 보기 · 모두 주 ${Math.min(...rest.map((x) => x.left))}회 이상 남음`}
            </button>
          )}
        </>
      )}
      {free.length > 0 && (
        <p className="al-rt-free">
          <small className="al-muted">제한 없이 나는 곳: </small>
          {free.map((x) => (
            <span key={x.key} className="al-chip-static">
              {x.free === 'home' ? '🏠' : '🕊️'} {x.label}
            </span>
          ))}
        </p>
      )}
      <MoreInfo label="운수권 규칙">
        나라와 나라를 잇는 노선은 두 나라가 맺은 항공 협정이 정한 주간 왕복 횟수 안에서만 날아요. 그 두 나라 사이를 나는 우리 노선을 모두 더해서 세요 (나라 안 노선은 자유).
        {mode === 'simple'
          ? ` 간단히: ${WIDEN_YEAR}년부터 본국을 오가는 노선은 자유이고, 외국과 외국 사이만 기본 주 21회(옛날에는 7회)예요.`
          : ` 실제처럼: 본국을 오가는 노선은 기본 주 7회(${WIDEN_YEAR}년부터 21회), 외국과 외국 사이는 신청해야만 날아요. 옛 협정 동안은 두 나라 사이를 나는 우리 게임 항공사가 ${CARRIER_LIMIT[0]}곳(넓힌 협정은 ${CARRIER_LIMIT[1]}곳)까지예요.`}{' '}
        신청하면 {RIGHT_WAIT[mode]}달 뒤 결산 때 정해지고(평판이 좋고 본국 노선일수록 잘 돼요), 더 받은 횟수를 {RIGHT_LAPSE}달 동안 쓰지 않으면 돌려줘요. 하늘 개방 협정을 맺은 두 나라
        사이는 제한이 없어요. 냉전·국교로 막힌 하늘길(실제 역사)은 운수권으로도 열 수 없어요. 협정 이름과 해는 게임을 위한 어림이에요.
      </MoreInfo>
    </section>
  );
}
