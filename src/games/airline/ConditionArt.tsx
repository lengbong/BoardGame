import './extras.css';
import { CHECK_POLICIES, checkAtOf, checkCost, condOf, condTone, fleetCond, inCheck, monthlyWear, monthsToCheck } from './condition';
import { FinIcon } from './FinanceArt';
import { fmtMoney } from './format';
import { checkBlocker } from './rules';
import { planeAge, planeHours } from './simulate';
import { MoreInfo } from './StaffArt';
import type { AirlineAction, AirlineState, Company, Plane } from './types';
import { ActButton } from './ui';

const notMine = '내 차례에만 할 수 있어요';

/** 기체 상태 막대: 0~100%, 점검 시점에 금 */
export function CondBar({ cond, at, width = 64 }: { cond: number; at: number; width?: number }) {
  const tone = condTone(cond, at);
  const h = 8;
  return (
    <svg className={`al-cond-bar al-cond-${tone}`} width={width} height={h + 4} viewBox={`0 0 ${width} ${h + 4}`} role="img" aria-label={`기체 상태 ${Math.round(cond)}%, 점검 시점 ${at}%`}>
      <rect className="al-cond-track" x={0} y={2} width={width} height={h} rx={h / 2} />
      <rect className="al-cond-fill" x={0} y={2} width={Math.max(h, (width * Math.max(0, Math.min(100, cond))) / 100)} height={h} rx={h / 2} />
      <path className="al-cond-mark" d={`M${(width * at) / 100} 0v${h + 4}`} />
    </svg>
  );
}

/** 비행기 한 대의 상태 줄 (비행기 화면): 막대·숫자·다음 점검 */
export function PlaneCondition({ state, c, p }: { state: AirlineState; c: Company; p: Plane }) {
  const at = checkAtOf(c);
  const cond = condOf(p);
  const wear = p.legs.length > 0 ? monthlyWear(planeHours(c, p), planeAge(state, p), c.maint) : 0;
  const left = monthsToCheck(cond, at, wear);
  return (
    <span className="al-pl-cond" title={`기체 상태 ${Math.round(cond)}% · ${at}% 아래로 내려가면 C점검`}>
      <FinIcon kind="wrench" size={13} /> 상태 <b className={`al-cond-num al-cond-${condTone(cond, at)}`}>{Math.round(cond)}%</b>
      <CondBar cond={cond} at={at} width={54} />
      {inCheck(p, state.t) ? (
        <span className="al-flag al-flag-warn">이번 달 C점검 중</span>
      ) : left === null ? null : left === 0 ? (
        <small className="al-neg">점검 대기</small>
      ) : (
        <small className="al-muted">점검까지 약 {left}달</small>
      )}
    </span>
  );
}

/** 비행기 화면의 C점검 단추 (보내기 / 미루기) */
export function CheckButton({ state, viewer, p, canAct, perform }: { state: AirlineState; viewer: number; p: Plane; canAct: boolean; perform: (a: AirlineAction) => void }) {
  if (inCheck(p, state.t)) {
    return (
      <ActButton small blocker={canAct ? null : notMine} onClick={() => perform({ type: 'checkPlane', plane: p.id, on: false })} title="이번 달은 띄우고 점검은 다음으로 미뤄요 (상태는 계속 닳아요)">
        점검 미루기
      </ActButton>
    );
  }
  const why = checkBlocker(state, viewer, p.id);
  if (why === '아직 상태가 좋아요') return null;
  return (
    <ActButton small blocker={canAct ? why : notMine} onClick={() => perform({ type: 'checkPlane', plane: p.id, on: true })} title="이번 달 정비고에 넣어 상태를 되돌려요 (그달은 쉬어요)">
      C점검 · {fmtMoney(checkCost(p))}
    </ActButton>
  );
}

/** 재무 화면 '운항 관리'에 붙는 C점검 시점 고르기와 요약 */
export function CheckPolicy({ state, viewer, canAct, perform }: { state: AirlineState; viewer: number; canAct: boolean; perform: (a: AirlineAction) => void }) {
  const me = state.companies[viewer];
  const at = checkAtOf(me);
  const now = me.planes.filter((p) => inCheck(p, state.t));
  const nowCost = now.reduce((s, p) => s + checkCost(p), 0);
  const avg = fleetCond(me);
  const last = state.report?.companies[viewer];
  return (
    <div className="al-check-policy">
      <div className="al-loan-row al-reserve-row" role="radiogroup" aria-label="C점검 시점">
        <span>
          <FinIcon kind="wrench" size={16} /> C점검 시점
        </span>
        {CHECK_POLICIES.map((o) => (
          <button key={o.at} type="button" role="radio" aria-checked={at === o.at} className={`al-chip${at === o.at ? ' al-on' : ''}`} disabled={!canAct} title={o.desc} onClick={() => perform({ type: 'setCheckAt', at: o.at })}>
            {o.name} (상태 {o.at}%)
          </button>
        ))}
      </div>
      {me.planes.length > 0 && (
        <div className="al-spare">
          <FinIcon kind="shield" size={20} />
          <span>
            평균 기체 상태 <b className={`al-cond-num al-cond-${condTone(avg, at)}`}>{Math.round(avg)}%</b>{' '}
            <small className="al-muted">
              {now.length > 0 ? `이번 달 C점검 ${now.length}대 · 약 ${fmtMoney(nowCost)}` : '이번 달 C점검 없음'}
              {last?.checks ? ` · 지난달 ${last.checks}대` : ''}
            </small>
          </span>
          <CondBar cond={avg} at={at} width={90} />
          <small>{Math.round(avg)}%</small>
        </div>
      )}
      <MoreInfo label="기체 상태와 C점검">
        비행기는 날수록 상태가 닳아요 (오래된 비행기·정비를 아끼면 더 빨리). 상태가 낮으면 갑작스러운 고장·지연·결항이 잦고 평판도 떨어지며, 팔 때 값도 덜 받아요. 상태가 점검 시점 아래로 내려가면 그달은 정비고에 들어가
        C점검을 받아요 — 쉬는 비행기(예비기)가 있으면 대신 날고, 없으면 그 비행기 노선 횟수가 그달 줄어요. 점검이 끝나면 새 비행기는 97%까지 돌아오지만 해마다 덜 돌아와서, 아주 낡은 비행기는 점검이 잦아져요. 비행기 화면에서
        한 대씩 점검을 보내거나 미룰 수 있어요.
      </MoreInfo>
    </div>
  );
}
