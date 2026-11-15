import './loyalty.css';
import { withJosa } from '../../lib/korean';
import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { useElementWidth } from '../../lib/useElementWidth';
import { alliesOf } from './alliances';
import {
  AWARD_BOOST,
  BRAND_CHANGE_MONTHS,
  BRAND_COOLDOWN,
  BRAND_INFO,
  BRAND_POSITIONS,
  BRAND_SWITCH_KEEP,
  BRAND_TIERS,
  allFits,
  brandBlocker,
  brandChangeCost,
  brandEffectText,
  brandTier,
} from './brandPosition';
import { REGIONS, REGION_INFO } from './cities';
import { AWARD_INFO } from './awards';
import {
  LOYALTY_FROM,
  LOYALTY_LEVELS,
  LOYALTY_LEVEL_LIST,
  LOYALTY_NAME,
  SETTLE_MONTHS,
  cutRegions,
  loyaltyBlocker,
  loyaltyLevel,
  loyaltyUpkeep,
  memberFlow,
  memberPull,
  settleCost,
  totalMembers,
  upgradeFee,
} from './loyalty';
import { peopleText } from './loyaltyRules';
import { MoreInfo } from './StaffArt';
import { mLabel } from './time';
import type { AirlineAction, AirlineState, QuarterReport } from './types';
import type { BrandPos } from './loyaltyTypes';

const notMine = '내 차례에만 할 수 있어요';

const money = (v: number) => (Math.abs(v) < 10 ? `${(Math.round(v * 10) / 10).toLocaleString('ko-KR')}억` : `${Math.round(v).toLocaleString('ko-KR')}억`);
const pctText = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

// ------------------------------------------------------------------ 손그림 아이콘

/** 별이 찍힌 회원 카드 */
export function LoyaltyIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="al-ly-icon">
      <rect x="2.5" y="5" width="19" height="14" rx="2.6" fill="var(--surface-2)" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 9h19" stroke="var(--accent)" strokeWidth="2" />
      <path d="M15.8 11.6l.75 1.5 1.65.24-1.2 1.17.28 1.64-1.48-.78-1.48.78.28-1.64-1.2-1.17 1.65-.24z" fill="var(--accent)" />
      <path d="M5.5 16h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** 리본 달린 브랜드 배지 */
export function BrandIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="al-ly-icon">
      <path d="M8 13.5L6 22l3.4-1.8L12 22.6l-.6-7.2M16 13.5l2 8.5-3.4-1.8L12 22.6" fill="var(--surface-2)" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="12" cy="9.5" r="6.8" fill="var(--surface-2)" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="9.5" r="4.2" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeDasharray="2.2 1.4" />
    </svg>
  );
}

// ------------------------------------------------------------------ 회원 그래프

/** 최근 24달 값 (회원 수·브랜드 힘): 2px 선과 옅은 면, 마우스를 올리면 그달 값 */
function HistChart({ hist, lastT, name, fmt, top: fixedTop, height = 120 }: { hist: number[]; lastT: number; name: string; fmt: (v: number) => string; top?: number; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(240, useElementWidth(ref) || 320);
  const [hover, setHover] = useState<number | null>(null);
  const m = { l: 46, r: 12, t: 10, b: 22 };
  const w = width - m.l - m.r;
  const h = height - m.t - m.b;
  const n = hist.length;
  const max = Math.max(1, ...hist);
  const step = niceStep(max);
  const top = fixedTop ?? Math.ceil(max / step) * step;
  const x = (i: number) => m.l + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v: number) => m.t + h - (v / top) * h;
  const tAt = (i: number) => lastT - (n - 1 - i);
  const line = hist.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const area = n > 0 ? `${line}L${x(n - 1).toFixed(1)} ${y(0)}L${x(0).toFixed(1)} ${y(0)}Z` : '';
  const ticks = [0, top / 2, top];
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left - m.l) / (w || 1)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  return (
    <div className="al-chart al-ly-chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={`최근 ${n}달 ${name}: 지금 ${fmt(hist[n - 1] ?? 0)}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={m.l + w} y1={y(t)} y2={y(t)} className={t === 0 ? 'al-axis' : 'al-grid'} />
            <text x={m.l - 6} y={y(t) + 4} textAnchor="end" className="al-tick">
              {fixedTop ? Math.round(t) : shortPeople(t)}
            </text>
          </g>
        ))}
        {n > 1 && (
          <>
            <text x={x(0)} y={height - 6} textAnchor="start" className="al-tick">
              {shortMonth(tAt(0))}
            </text>
            <text x={x(n - 1)} y={height - 6} textAnchor="end" className="al-tick">
              {shortMonth(tAt(n - 1))}
            </text>
          </>
        )}
        <path d={area} className="al-ly-area" />
        <path d={line} className="al-line al-ly-line" />
        {n > 0 && <circle cx={x(n - 1)} cy={y(hist[n - 1])} r={4.5} className="al-ly-dot" />}
        {hover !== null && (
          <g pointerEvents="none" className="al-cross">
            <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + h} />
            <circle cx={x(hover)} cy={y(hist[hover])} r={4.5} className="al-ly-dot" />
          </g>
        )}
        <rect x={m.l} y={m.t} width={w} height={h} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hover !== null && (
        <div className="al-tooltip" style={{ left: Math.min(width - 150, Math.max(0, x(hover) + 10)), top: m.t }}>
          <b>{mLabel(tAt(hover))}</b>
          <ul>
            <li>
              <span>{name}</span>
              <b>{fmt(hist[hover])}</b>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

function niceStep(max: number): number {
  const raw = max / 2;
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= raw) return k * p;
  return 10 * p;
}

function shortPeople(v: number): string {
  if (v >= 10000) return `${Math.round((v / 10000) * 10) / 10}만`;
  return Math.round(v).toLocaleString('ko-KR');
}

function shortMonth(t: number): string {
  return `${String(Math.floor(t / 12) % 100).padStart(2, '0')}년 ${(t % 12) + 1}월`;
}

// ------------------------------------------------------------------ 브랜드 막대

/** 브랜드 힘 0~100과 문턱 눈금 */
function StrengthBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="al-ly-strength" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={`브랜드 힘 ${Math.round(v)}`}>
      <span className="al-ly-strength-fill" style={{ width: `${v}%` }} />
      {BRAND_TIERS.map((t) => (
        <span key={t.at} className={`al-ly-tick${v >= t.at ? ' al-on' : ''}`} style={{ left: `${t.at}%` }} title={`${t.at}: ${t.name}`} />
      ))}
    </div>
  );
}

/** 얼마나 어울려요 −1~1 (가운데가 0, 오른쪽 초록·왼쪽 빨강) */
function FitBar({ fit, label }: { fit: number; label: string }) {
  const f = Math.max(-1, Math.min(1, fit));
  const left = f >= 0 ? 50 : 50 + f * 50;
  const width = Math.abs(f) * 50;
  return (
    <span className="al-ly-fit" role="meter" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(f * 100)} aria-label={label}>
      <span className={`al-ly-fit-fill ${f >= 0 ? 'al-ly-pos' : 'al-ly-neg'}`} style={{ left: `${left}%`, width: `${width}%` }} />
      <span className="al-ly-fit-zero" />
    </span>
  );
}

function fitWord(fit: number): string {
  if (fit >= 0.6) return '아주 잘 어울려요';
  if (fit >= 0.3) return '잘 어울려요';
  if (fit > 0.05) return '조금 어울려요';
  if (fit > -0.05) return '그저 그래요';
  return '어긋나요';
}

// ------------------------------------------------------------------ 카드

/** 재무 화면의 단골·브랜드 카드: 단골 프로그램(단계·회원 그래프·지역 막대)과 브랜드 자리(어울림 막대·까닭) */
export function LoyaltyCard({ state, viewer, canAct, perform }: { state: AirlineState; viewer: number; canAct: boolean; perform: (a: AirlineAction) => void }) {
  const c = state.companies[viewer];
  const L = c.loyalty;
  const level = loyaltyLevel(c);
  const allied = alliesOf(state, viewer).length > 0;
  const rep = state.report?.companies[viewer];
  const fits = useMemo(() => allFits(c, state.t, rep, allied), [c, state.t, rep, allied]);
  const total = totalMembers(L);
  const prev = L && L.hist.length >= 2 ? L.hist[L.hist.length - 2] : 0;
  const pull = memberPull(c);
  const flow = L ? memberFlow(state, viewer, state.t) : null;
  const cuts = L ? cutRegions(c) : [];
  const maxRegion = L ? Math.max(1, ...REGIONS.map((r) => L.members[r])) : 1;
  const block = (b: string | null) => (canAct ? b : notMine);
  const cargo = c.bizModel === 'cargo';
  const b = c.brandPos;
  const cur: BrandPos | null = b?.pos ?? null;
  const shownFit = cur ? fits[cur] : null;
  const settle = settleCost(c);
  // 지난달 값 (이번 달에 시작했으면 아직 없다)
  const lastCost = L && L.since < state.t ? (rep?.loyalty ?? 0) : 0;

  const pickLevel = (lv: 0 | 1 | 2 | 3) => {
    if (lv === 0 && total > 0 && !window.confirm(`${LOYALTY_NAME} 프로그램을 그만둘까요? 회원 ${peopleText(total)}이 모두 떠나고 평판이 조금 내려가요.${settle > 0 ? ` 남은 마일리지 정리에 ${money(settle)}이 들어요.` : ''}`)) return;
    if (lv > 0 && lv < level && !window.confirm(`단계를 내릴까요? 실망한 회원 10%가 바로 떠나요.`)) return;
    perform({ type: 'setLoyalty', level: lv });
  };
  const pickBrand = (pos: BrandPos) => {
    if (b && pos !== b.pos && !window.confirm(`브랜드를 ${withJosa(BRAND_INFO[pos].name, '으로/로')} 바꿀까요? ${money(brandChangeCost(c))}이 들고 ${BRAND_CHANGE_MONTHS}달 뒤에 바뀌며, 브랜드 힘은 ${Math.round(BRAND_SWITCH_KEEP * 100)}%만 남아요.`)) return;
    perform({ type: 'setBrandPos', pos });
  };

  if (cargo) {
    return (
      <section className="al-card al-ly" data-testid="al-loyalty">
        <h4 className="al-fin-title">
          <LoyaltyIcon /> 단골 손님과 브랜드
        </h4>
        <p className="al-muted">화물 전문 회사는 손님이 없어서 단골 프로그램과 손님 브랜드가 없어요.</p>
      </section>
    );
  }

  return (
    <section className="al-card al-ly" data-testid="al-loyalty">
      <h4 className="al-fin-title">
        <LoyaltyIcon /> 단골 손님과 브랜드{' '}
        <small>
          {L ? `회원 ${peopleText(total)}` : '프로그램 없음'} · {b ? `${BRAND_INFO[b.pos].icon} ${BRAND_INFO[b.pos].name} ${Math.round(b.strength)}` : '브랜드를 정하지 않았어요'}
        </small>
      </h4>
      <div className="al-ly-cols">
        {/* ---------------------------------------------------------- 단골 프로그램 */}
        <div className="al-ly-col">
          <h5 className="al-fin-sub">
            <LoyaltyIcon size={16} /> {LOYALTY_NAME} <small>{level ? `${LOYALTY_LEVELS[level].icon} ${LOYALTY_LEVELS[level].name} 단계` : '아직 없어요'}</small>
          </h5>
          <div className="al-ly-levels" role="radiogroup" aria-label="단골 프로그램 단계">
            {([0, ...LOYALTY_LEVEL_LIST] as (0 | 1 | 2 | 3)[]).map((lv) => {
              const why = block(loyaltyBlocker(state, viewer, lv));
              const on = lv === level;
              const info = lv === 0 ? null : LOYALTY_LEVELS[lv];
              const fee = lv > level ? upgradeFee(c, level, lv) : 0;
              return (
                <button
                  key={lv}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`al-ly-level${on ? ' al-on' : ''}${!on && !why ? ' al-can' : ''}`}
                  disabled={on || !!why}
                  title={why ?? (info ? `${info.perk} · 달 운영비 ${money(loyaltyUpkeep(c, lv as 1 | 2 | 3))} + 마일리지` : '프로그램 없이')}
                  onClick={() => pickLevel(lv)}
                  data-testid={`al-loyalty-${lv}`}
                >
                  <span className="al-ly-level-icon" aria-hidden="true">
                    {info ? info.icon : '✖️'}
                  </span>
                  <b>{info ? info.name : '없음'}</b>
                  <small>{info ? info.perk : level ? '그만두기' : '프로그램 없이'}</small>
                  <small className={why && !on ? 'al-why' : 'al-muted'}>{on ? '지금 단계' : why ? why : lv === 0 ? (settle > 0 ? `정리 ${money(settle)}` : '공짜') : fee > 0 ? `${money(fee)}` : '내리기 (공짜)'}</small>
                </button>
              );
            })}
          </div>
          {!L ? (
            <p className="al-note">
              💡 회원은 우리 비행기를 더 고르고(특히 사업 손님) 운임이 조금 비싸도 덜 떠나요. 회원은 몇 달에 걸쳐 천천히 모이고, 달마다 운영비와 마일리지 값이 들어요. 다른 회사와 함께 나는 노선이 많을수록 이득이고, 혼자 나는 노선뿐이면 손해일 수 있어요.
              {state.q < LOYALTY_FROM * 4 ? ` (${LOYALTY_FROM}년부터)` : ''}
            </p>
          ) : (
            <>
              <ul className="al-staff-kpi al-ly-kpi">
                <li>
                  <span>
                    <small>회원</small>
                    <b>{peopleText(total)}</b>
                    <small className={total >= prev ? 'al-pos' : 'al-neg'}>
                      지난달 {total >= prev ? '+' : '−'}
                      {peopleText(Math.abs(total - prev))}
                    </small>
                  </span>
                </li>
                <li>
                  <span>
                    <small>회원 몫</small>
                    <b>{pctText(pull.pen, 0)}</b>
                    <small className="al-muted">단골 손님 가운데 (최대 {pctText(LOYALTY_LEVELS[L.level].cap, 0)})</small>
                  </span>
                </li>
                <li>
                  <span>
                    <small>손님 끌기</small>
                    <b>사업 +{pctText(pull.biz)}</b>
                    <small className="al-muted">관광 +{pctText(pull.leisure)}</small>
                  </span>
                </li>
                <li>
                  <span>
                    <small>{lastCost > 0 ? '지난달 값' : '이번 달부터'}</small>
                    <b className="al-neg">−{money(lastCost > 0 ? lastCost : loyaltyUpkeep(c))}</b>
                    <small className="al-muted">운영비 {money(loyaltyUpkeep(c))} + 마일리지</small>
                  </span>
                </li>
              </ul>
              {L.hist.length >= 2 ? <HistChart hist={L.hist} lastT={state.t - 1} name="회원" fmt={peopleText} /> : <p className="al-muted al-small">다음 달 결산부터 회원 그래프가 그려져요.</p>}
              <ul className="al-ly-regions" aria-label="지역마다 회원">
                {REGIONS.filter((r) => L.members[r] > 0 || L.base[r] > 0).map((r) => (
                  <li key={r} className={cuts.includes(r) ? 'al-ly-cut' : ''}>
                    <span className="al-ly-rname">
                      {REGION_INFO[r].emoji} {REGION_INFO[r].short}
                    </span>
                    <span className="al-ly-rbar" aria-hidden="true">
                      <span style={{ width: `${(L.members[r] / maxRegion) * 100}%` }} />
                    </span>
                    <span className="al-ly-rval">
                      {peopleText(L.members[r])} <small className="al-muted">({pctText(L.pen[r], 0)})</small>
                    </span>
                  </li>
                ))}
              </ul>
              {(flow!.why.length > 0 || cuts.length > 0) && (
                <ul className="al-ly-why">
                  {cuts.map((r) => (
                    <li key={r} className="al-neg">
                      ✂️ {REGION_INFO[r].name} 노선을 줄여 그 지역 회원이 떠나요
                    </li>
                  ))}
                  {flow!.why.map((x) => (
                    <li key={x.text} className={x.good ? 'al-pos' : 'al-neg'}>
                      {x.text}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <MoreInfo label="단골 프로그램 규칙">
            회원은 그 지역에 닿는 우리 손님 가운데 천천히 모여요(기본 45%·실버 60%·골드 72%까지). 광고로 많이 알려진 지역, 평판이 좋을 때, 💳 마일리지 두 배 캠페인 동안, 동맹 회사에도 프로그램이 있으면(동맹 회사 비행기로도 적립)
            더 빨리 모여요. 정시 운항률이 82%보다 낮거나 평판이 50보다 낮으면, 그 지역 노선을 크게 줄이면 더 빨리 떠나요. 회원은 우리 비행기를 더 고르고(사업 손님 최대 +{Math.round(LOYALTY_LEVELS[3].biz * 100)}%) 운임이 비싸도 덜
            떠나요. 돈: 단계를 올리는 값, 달마다 운영비(비행기 수만큼)와 마일리지 값(회원이 탄 운임의 {LOYALTY_LEVELS[1].reward * 100}~{(LOYALTY_LEVELS[3].reward * 100).toFixed(1)}%), 손익표의 ‘광고·단골 프로그램’에 들어요. 골드는 우리 라운지가 있으면
            운영비가 20% 줄어요. 그만두면 회원이 모두 떠나고 남은 마일리지를 정리하는 값(지난달 값의 {SETTLE_MONTHS}배)을 내요. 동맹 마일리지(회사마다 손님 +1.5%)는 그대로이고, 우리 프로그램과 겹쳐 세지 않아요. 저가항공은 기본 단계까지예요.
          </MoreInfo>
        </div>

        {/* ---------------------------------------------------------- 브랜드 */}
        <div className="al-ly-col">
          <h5 className="al-fin-sub">
            <BrandIcon size={16} /> 브랜드 <small>{b ? `힘 ${Math.round(b.strength)}${brandTier(b.strength) ? ` · ${BRAND_TIERS[brandTier(b.strength) - 1].name}` : ''}` : '우리 회사 하면 떠오르는 것'}</small>
          </h5>
          <div className="al-ly-brands" role="radiogroup" aria-label="브랜드 자리">
            {BRAND_POSITIONS.map((pos) => {
              const info = BRAND_INFO[pos];
              const on = cur === pos;
              const pending = b?.next?.pos === pos;
              const why = block(brandBlocker(state, viewer, pos));
              const f = fits[pos].fit;
              return (
                <button
                  key={pos}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`al-ly-brand${on ? ' al-on' : ''}${pending ? ' al-ly-pending' : ''}${!on && !why ? ' al-can' : ''}`}
                  disabled={!!why || (on && !b?.next)}
                  title={why ?? `${info.desc} — ${info.effect}`}
                  onClick={() => pickBrand(pos)}
                  data-testid={`al-brand-${pos}`}
                >
                  <span className="al-ly-brand-head">
                    <span aria-hidden="true">{info.icon}</span> <b>{info.name}</b>
                  </span>
                  <FitBar fit={f} label={`${info.name}: ${fitWord(f)} (${Math.round(f * 100)})`} />
                  <small className={on ? '' : 'al-muted'}>{pending ? `${mLabel(b!.next!.t)}에 바뀌어요` : on ? (b?.next ? '누르면 바꾸기 그만두기' : '지금 브랜드') : fitWord(f)}</small>
                </button>
              );
            })}
          </div>
          {b && b.next && <p className="al-note">🔄 {mLabel(b.next.t)}에 {withJosa(BRAND_INFO[b.next.pos].name, '으로/로')} 바뀌어요. 그때 브랜드 힘은 {Math.round(BRAND_SWITCH_KEEP * 100)}%만 남아요.</p>}
          {!b ? (
            <p className="al-note">💡 네 가지 가운데 하나를 내세워요. 처음 정하는 것은 공짜예요. 막대는 지금 우리 숫자와 얼마나 어울리는지예요 — 어울리는 것을 고르면 브랜드 힘이 빨리 쌓여요.</p>
          ) : (
            <>
              <div className="al-ly-strength-row">
                <StrengthBar value={b.strength} />
                <b>{Math.round(b.strength)}</b>
              </div>
              <ul className="al-ly-tiers" aria-hidden="true">
                {BRAND_TIERS.map((t) => (
                  <li key={t.at} className={b.strength >= t.at ? 'al-on' : ''} style={{ left: `${t.at}%` }}>
                    {t.at}
                  </li>
                ))}
              </ul>
              <p className="al-ly-effect">
                지금 효과: <b>{b.strength >= 1 ? brandEffectText(b) : '아직 없어요'}</b>
              </p>
              {b.hist.length >= 2 && <HistChart hist={b.hist} lastT={state.t - 1} name="브랜드 힘" fmt={(v) => `${Math.round(v)}`} top={100} height={96} />}
              {shownFit && (
                <>
                  <div className="al-ly-fit-row">
                    <span>
                      {BRAND_INFO[b.pos].icon} {withJosa(BRAND_INFO[b.pos].name, '와/과')} 우리 숫자
                    </span>
                    <FitBar fit={shownFit.fit} label={`얼마나 어울려요 ${Math.round(shownFit.fit * 100)}`} />
                    <b className={shownFit.fit >= 0.05 ? 'al-pos' : shownFit.fit <= -0.05 ? 'al-neg' : ''}>{fitWord(shownFit.fit)}</b>
                  </div>
                  <ul className="al-ly-reasons">
                    {shownFit.reasons.slice(0, 5).map((r) => (
                      <li key={r.text} className={r.v > 0 ? 'al-pos' : r.v < 0 ? 'al-neg' : 'al-muted'}>
                        <span aria-hidden="true">{r.v > 0 ? '✓' : r.v < 0 ? '✗' : '·'}</span> {r.text}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
          <MoreInfo label="브랜드 규칙">
            달마다 실제 숫자로 ‘얼마나 어울려요’를 재요. 어울리면 브랜드 힘(0~100)이 천천히 쌓이고(광고로 많이 알려진 회사일수록 빨리), 어긋나면 더 빨리 깎여요. ⏱️ 믿음직한 정시는 정시 운항률·결항·정비·비행기 나이, 🍽️ 따뜻한 서비스는
            기내식·평판·좌석 간격·라운지·직원 만족도, 🏷️ 알뜰한 운임은 일반석 운임·저가항공·촘촘한 좌석, 🌐 넓은 노선망은 지역·노선 수·갈아타는 손님·동맹을 봐요. 바꾸려면 {money(brandChangeCost(c))}과 {BRAND_CHANGE_MONTHS}달이 들고 힘이{' '}
            {Math.round(BRAND_SWITCH_KEEP * 100)}%만 남아요 (한 번 정하면 {BRAND_COOLDOWN}달 동안 못 바꿔요). 연말 시상식에서 맞는 상({BRAND_POSITIONS.map((p) => `${AWARD_INFO[BRAND_INFO[p].award].icon} ${AWARD_INFO[BRAND_INFO[p].award].name}`).join('·')})을 받으면 1월에 힘이 +{AWARD_BOOST}.
          </MoreInfo>
        </div>
      </div>
      <MoreInfo label="평판·광고·단골·브랜드는 어떻게 달라요?">
        ⭐ <b>평판</b>은 지금 우리 비행이 얼마나 좋은지예요 (기내식·비행기·정시, 몇 달 만에 움직여요). 📣 <b>광고</b>는 우리 회사를 아는 사람이 얼마나 많은지예요. 💳 <b>단골 손님</b>은 우리를 계속 타 주는 회원이에요 (천천히 모이고 천천히
        떠나요). 🏷️ <b>브랜드</b>는 ‘우리 회사 하면 떠오르는 것’이에요 (내세운 모습대로 살면 쌓여요). 넷은 서로 돕지만 따로 쌓여요.
      </MoreInfo>
    </section>
  );
}

// ------------------------------------------------------------------ 달 결산 알림 한 줄 · 놀이 방법

/** 달 결산 알림(MonthToast)에 붙는 한 줄: 회원 수와 늘어난 만큼, 브랜드 힘 */
export function LoyaltyToastLine({ state, report, viewer }: { state: AirlineState; report: QuarterReport; viewer: number }) {
  const c = state.companies[viewer];
  if (!c || (!c.loyalty && !c.brandPos)) return null;
  const parts: string[] = [];
  const L = c.loyalty;
  if (L && L.hist.length > 0) {
    const now = L.hist[L.hist.length - 1];
    const before = L.hist.length >= 2 ? L.hist[L.hist.length - 2] : 0;
    const d = now - before;
    parts.push(`💳 단골 ${peopleText(now)} (${d >= 0 ? '+' : '−'}${peopleText(Math.abs(d))})`);
  }
  const b = c.brandPos;
  if (b && b.hist.length > 0) {
    const now = b.hist[b.hist.length - 1];
    const before = b.hist.length >= 2 ? b.hist[b.hist.length - 2] : now;
    parts.push(`${BRAND_INFO[b.pos].icon} 브랜드 ${now}${now > before ? ' ▲' : now < before ? ' ▼' : ''}`);
  }
  if (parts.length === 0) return null;
  const cost = report.companies[viewer]?.loyalty ?? 0;
  return (
    <p className="al-ly-toast" data-testid="al-loyalty-toast">
      {parts.join(' · ')}
      {cost > 0 && <small className="al-muted"> · 프로그램 값 {money(cost)}</small>}
    </p>
  );
}

/** 설정 화면 '놀이 방법'의 한 줄 */
export function LoyaltyHowTo() {
  return (
    <li>
      <b>💳 단골 손님과 🏷️ 브랜드</b>: 재무 화면 ‘단골 손님과 브랜드’에서 {LOYALTY_FROM}년부터 <b>{LOYALTY_NAME}</b> 프로그램을 시작해요 (기본 → 실버 → 골드). 회원은 몇 달에 걸쳐 지역마다 모이고, 우리 비행기를 더 고르며(특히 사업 손님) 운임이 조금 비싸도 덜 떠나요.
      대신 달마다 운영비와 마일리지 값이 들고, 늦는 비행이 잦거나 그 지역 노선을 줄이면 떠나요 — 다른 회사와 겨루는 노선이 많을수록 이득이에요. <b>브랜드</b>는 ⏱️ 믿음직한 정시 · 🍽️ 따뜻한 서비스 · 🏷️ 알뜰한 운임 · 🌐 넓은 노선망 가운데 하나를
      내세우고, 실제 숫자가 그 모습과 어울리면 브랜드 힘이 쌓여 맞는 손님이 조금 더 와요.
    </li>
  );
}
