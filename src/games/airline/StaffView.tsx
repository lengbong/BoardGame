import { useState } from 'react';
import { fmtFine, fmtMoney, pct } from './format';
import { academyBlocker, fireBlocker, hireBlocker } from './rules';
import {
  ACADEMY_COST,
  ACADEMY_UPKEEP,
  OVERTIME,
  PAY_MAX,
  PAY_MIN,
  STAFF_GROUPS,
  STAFF_INFO,
  coverage,
  fireCost,
  hireCost,
  hireTime,
  moraleTarget,
  overtime,
  payroll,
  salary,
  staffCap,
  staffNeed,
  staffPipe,
  staffTotal,
  strikeChance,
} from './staff';
import { mLabel, monthsText } from './time';
import type { AirlineAction, AirlineState, StaffGroup } from './types';
import { ActButton, Meter, Stepper } from './ui';

interface StaffViewProps {
  state: AirlineState;
  viewer: number;
  canAct: boolean;
  perform: (a: AirlineAction) => void;
}

const notMine = '내 차례에만 할 수 있어요';

const GROUP_TIP: Record<StaffGroup, string> = {
  pilot: '비행시간에 따라 늘어요. 한 편에 두 사람, 한 달에 70시간쯤 날아요. 뽑아서 훈련하는 데 오래 걸려요.',
  cabin: '비행시간과 좌석 수(50석마다 한 사람)에 따라 늘어요.',
  tech: '비행기 크기·나이와 뜨고 내리는 횟수에 따라 늘어요. 모자라면 지연이 늘어요.',
  ground: '지점과 손님 수에 따라 늘어요. 공항 카운터·판매·사무를 맡아요.',
};

/** 👥 인사: 직원 그룹마다 필요한 사람·지금 사람·뽑는 중, 임금 수준, 조직 만족도, 훈련원 */
export function StaffView({ state, viewer, canAct, perform }: StaffViewProps) {
  const me = state.companies[viewer];
  const need = staffNeed(state, me);
  const cov = coverage(need, me);
  const cap = staffCap(need, me);
  const ot = overtime(need, me);
  const mt = moraleTarget(state, me);
  const strike = strikeChance(me);
  const pay = payroll(state, me, need);
  const total = staffTotal(me);
  const block = (b: string | null) => (canAct ? b : notMine);
  const rep = state.report?.companies[viewer];
  const parts: { label: string; v: number }[] = [
    { label: '임금 수준', v: mt.pay },
    { label: '초과 근무', v: mt.overtime },
    { label: '회사 성장', v: mt.growth },
    { label: '훈련원', v: mt.academy },
    { label: '서운한 일', v: mt.shock },
  ].filter((x) => Math.round(x.v) !== 0);
  const moraleTone = me.morale < 30 ? 'bad' : me.morale < 45 ? 'warn' : 'good';

  return (
    <div className="al-staff">
      <section className="al-card al-staff-sum">
        <h4>
          👥 직원 {total.toLocaleString('ko-KR')}명 <small>이번 달 임금 어림 {fmtMoney(pay)}</small>
        </h4>
        <div className="al-ops-kpi al-staff-kpi">
          <div>
            <span>조직 만족도</span>
            <b className={me.morale < 45 ? 'al-neg' : ''} data-testid="al-morale">
              {Math.round(me.morale)} <small>→ {Math.round(mt.value)}</small>
            </b>
          </div>
          <div>
            <span>뜰 수 있는 운항</span>
            <b className={cap < 1 ? 'al-neg' : ''}>{pct(cap)}</b>
          </div>
          <div>
            <span>초과 근무</span>
            <b className={ot > OVERTIME ? 'al-neg' : ''}>{ot > 0 ? `+${Math.round(ot * 100)}%` : '없음'}</b>
          </div>
          <div>
            <span>파업 걱정</span>
            <b className={strike > 0 ? 'al-neg' : ''}>{strike > 0 ? `달 ${Math.round(strike * 100)}%` : '없음'}</b>
          </div>
          {rep && (
            <div>
              <span>지난달 일손 부족 결항</span>
              <b className={rep.staffCancelled > 0 ? 'al-neg' : ''}>{rep.staffCancelled}편</b>
            </div>
          )}
        </div>
        <Meter value={me.morale / 100} tone={moraleTone} label={`조직 만족도 ${Math.round(me.morale)}`} />
        <p className="al-staff-parts">
          <span className="al-muted">만족도가 향하는 곳 {Math.round(mt.value)} = 기본 62</span>
          {parts.map((x) => (
            <span key={x.label} className={`tag ${x.v > 0 ? 'al-pos' : 'al-neg'}`}>
              {x.label} {x.v > 0 ? '+' : '−'}
              {Math.abs(Math.round(x.v))}
            </span>
          ))}
        </p>
        <p className="al-muted al-tip">
          만족도는 달마다 조금씩 이 값으로 움직여요. 만족도가 높으면 정시 운항과 서비스 평판이 좋아지고, 30 아래로 떨어지면 파업이 날 수 있어요. 일손이 모자라면 15%까지는 초과 근무로 버티지만(임금 1.5배, 만족도 ↓) 그 넘게 모자라면 결항이 나요.
        </p>
      </section>

      <div className="al-staff-groups">
        {STAFF_GROUPS.map((g) => (
          <GroupCard key={g} state={state} viewer={viewer} group={g} need={need[g]} cov={cov[g]} block={block} perform={perform} />
        ))}
      </div>

      <section className="al-card al-academy">
        <h4>🎓 훈련원 {me.academy ? <small className="al-pos">운영 중 · 달 유지비 {fmtFine(ACADEMY_UPKEEP)}</small> : <small>{fmtMoney(ACADEMY_COST)} · 달 유지비 {fmtFine(ACADEMY_UPKEEP)}</small>}</h4>
        <p>
          회사 훈련원이 있으면 새로 뽑은 사람이 더 빨리 일을 시작하고(조종사 {STAFF_INFO.pilot.hire}→{STAFF_INFO.pilot.academy}달, 정비사 {STAFF_INFO.tech.hire}→{STAFF_INFO.tech.academy}달), 뽑는 돈이 40% 줄고, 조직 만족도가 4 올라요.
        </p>
        {!me.academy && (
          <ActButton blocker={block(academyBlocker(state, viewer))} onClick={() => perform({ type: 'buildAcademy' })} testId="al-academy">
            훈련원 세우기 (−{fmtMoney(ACADEMY_COST)})
          </ActButton>
        )}
        <p className="al-muted al-tip">비행기가 열 대를 넘어 해마다 사람을 많이 뽑는 회사에 알맞아요.</p>
      </section>
    </div>
  );
}

function GroupCard({
  state,
  viewer,
  group,
  need,
  cov,
  block,
  perform,
}: {
  state: AirlineState;
  viewer: number;
  group: StaffGroup;
  need: number;
  cov: number;
  block: (b: string | null) => string | null;
  perform: (a: AirlineAction) => void;
}) {
  const me = state.companies[viewer];
  const s = me.staff[group];
  const info = STAFF_INFO[group];
  const pipe = staffPipe(me, group);
  const gap = Math.max(0, Math.ceil(need * 1.05) - s.have - pipe);
  const [n, setN] = useState(Math.max(1, gap));
  const [fast, setFast] = useState(false);
  const [fireN, setFireN] = useState(Math.max(1, Math.floor(Math.max(0, s.have - need * 1.1))));
  const months = hireTime(me, group, fast);
  const cost = hireCost(state, me, group, n, fast);
  const wage = salary(state, group);
  const extra = s.have - need;
  const tone = cov < 1 / (1 + OVERTIME) ? 'bad' : cov < 1 ? 'warn' : 'good';
  const step = n >= 100 ? 10 : n >= 20 ? 5 : 1;
  return (
    <section className="al-card al-staff-group" data-testid={`al-staff-${group}`}>
      <h4>
        <span aria-hidden="true">{info.icon}</span> {info.name}{' '}
        <small>
          필요 {need.toLocaleString('ko-KR')} · 지금 {s.have.toLocaleString('ko-KR')}
          {pipe > 0 ? ` · 뽑는 중 ${pipe}` : ''}
        </small>
      </h4>
      <Meter value={need > 0 ? Math.min(1, s.have / need) : 1} tone={tone} label={`${info.name} 채운 정도 ${Math.round(cov * 100)}%`} />
      <p className={`al-staff-state ${extra < 0 ? 'al-neg' : 'al-muted'}`}>
        {need <= 0 ? '아직 필요 없어요' : extra < 0 ? `${-extra}명 모자라요 (${Math.round(cov * 100)}%)` : extra > need * 0.15 ? `${extra}명 여유 — 늘릴 비행기 몫이에요 (너무 많으면 임금만 나가요)` : `넉넉해요 (+${extra}명)`}
      </p>
      {s.pipe.length > 0 && (
        <ul className="al-staff-pipe">
          {s.pipe.map((p, i) => (
            <li key={i}>
              🎓 {p.n}명 훈련 중 · {mLabel(p.ready)}부터 ({monthsText(Math.max(0, p.ready - state.t))} 뒤)
            </li>
          ))}
        </ul>
      )}
      <div className="al-staff-hire">
        <Stepper value={n} min={1} max={400} step={step} label={`${info.name} 뽑을 사람 수`} format={(v) => `${v}명`} onChange={setN} />
        <span className="al-staff-speed" role="radiogroup" aria-label="뽑는 빠르기">
          <button type="button" role="radio" aria-checked={!fast} className={`al-chip${!fast ? ' al-on' : ''}`} onClick={() => setFast(false)}>
            보통 {hireTime(me, group, false)}달
          </button>
          <button type="button" role="radio" aria-checked={fast} className={`al-chip${fast ? ' al-on' : ''}`} onClick={() => setFast(true)} disabled={hireTime(me, group, true) === hireTime(me, group, false)}>
            서둘러 {hireTime(me, group, true)}달
          </button>
        </span>
        <ActButton small primary blocker={block(hireBlocker(state, viewer, group, n, fast))} onClick={() => perform({ type: 'hire', group, n, fast })} testId={`al-hire-${group}`}>
          뽑기 −{fmtFine(cost)}
        </ActButton>
      </div>
      <p className="al-muted al-tip">
        {mLabel(state.t + months)}부터 일해요. 훈련하는 동안은 임금의 절반이 나가요. {GROUP_TIP[group]}
      </p>
      <label className="al-staff-pay">
        <span>
          임금 수준 <b>{Math.round(s.pay * 100)}%</b> <small className="al-muted">한 사람 달 {fmtFine(wage * s.pay)}</small>
        </span>
        <input
          type="range"
          min={PAY_MIN}
          max={PAY_MAX}
          step={0.05}
          value={s.pay}
          disabled={!!block(null)}
          onChange={(e) => perform({ type: 'setPay', group, level: Number(e.target.value) })}
          aria-label={`${info.name} 임금 수준`}
          data-testid={`al-pay-${group}`}
        />
      </label>
      {s.have > 0 && (
        <div className="al-staff-fire">
          <Stepper value={Math.min(fireN, s.have)} min={1} max={s.have} step={fireN >= 20 ? 5 : 1} label={`${info.name} 내보낼 사람 수`} format={(v) => `${v}명`} onChange={setFireN} />
          <ActButton
            small
            blocker={block(fireBlocker(state, viewer, group, Math.min(fireN, s.have)))}
            onClick={() => {
              const k = Math.min(fireN, s.have);
              if (window.confirm(`${info.name} ${k}명을 내보낼까요? 석 달 치 임금(${fmtFine(fireCost(state, me, group, k))})을 주고, 남은 사람들의 만족도가 떨어져요.`)) perform({ type: 'fire', group, n: k });
            }}
          >
            내보내기
          </ActButton>
        </div>
      )}
    </section>
  );
}
