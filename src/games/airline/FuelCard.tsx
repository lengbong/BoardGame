import { useId } from 'react';
import './extras.css';
import { FinIcon } from './FinanceArt';
import { AUTO_OPTIONS, FUEL_SELL_RATE, MAX_TANK, TANK_LEVELS, buyFuelBlocker, fuelCost, sellFuelBlocker, tankBlocker, tankCap, tankOf, tankSpace } from './fuel';
import { fmtFine, fmtMoney } from './format';
import { oilTarget } from './rules';
import { MoreInfo } from './StaffArt';
import { mShort } from './time';
import type { AirlineAction, AirlineState, CompanyReport, MonthPoint } from './types';
import { ActButton } from './ui';

const notMine = '내 차례에만 할 수 있어요';
const tonText = (v: number) => `${Math.round(v).toLocaleString('ko-KR')}톤`;

/** 연료 탱크 그림: 원통에 사 둔 만큼 연료가 차 있다 */
export function TankGauge({ fill, level, size = 64 }: { fill: number; level: number; size?: number }) {
  const id = useId().replace(/:/g, '');
  const f = Math.max(0, Math.min(1, fill));
  const top = 14;
  const bottom = 76;
  const y = bottom - (bottom - top) * f;
  return (
    <svg className="al-tank" width={size} height={size * 1.4} viewBox="0 0 64 90" role="img" aria-label={level === 0 ? '연료 탱크 없음' : `연료 탱크 ${Math.round(f * 100)}% 참`}>
      <defs>
        <clipPath id={`tk-${id}`}>
          <path d="M8 14 v62 a24 7 0 0 0 48 0 v-62 a24 7 0 0 0 -48 0z" />
        </clipPath>
      </defs>
      {level === 0 ? (
        <g className="al-tank-empty">
          <path d="M8 14 v62 a24 7 0 0 0 48 0 v-62" strokeDasharray="4 4" />
          <ellipse cx={32} cy={14} rx={24} ry={7} strokeDasharray="4 4" />
          <path d="M32 36v20M22 46h20" />
        </g>
      ) : (
        <>
          <path className="al-tank-body" d="M8 14 v62 a24 7 0 0 0 48 0 v-62 a24 7 0 0 0 -48 0z" />
          <g clipPath={`url(#tk-${id})`}>
            <rect className="al-tank-fuel" x={0} y={y} width={64} height={90} />
            {f > 0.02 && <path className="al-tank-wave" d={`M0 ${y} q8 -3 16 0 t16 0 t16 0 t16 0`} />}
          </g>
          <ellipse className="al-tank-lid" cx={32} cy={14} rx={24} ry={7} />
          {[0.25, 0.5, 0.75].map((k) => (
            <path key={k} className="al-tank-tick" d={`M50 ${bottom - (bottom - top) * k} h6`} />
          ))}
          {/* 단계 표시 (지붕의 점) */}
          {Array.from({ length: MAX_TANK }, (_, i) => (
            <circle key={i} className={i < level ? 'al-tank-pip al-on' : 'al-tank-pip'} cx={32 - (MAX_TANK - 1) * 4 + i * 8} cy={14} r={2.2} />
          ))}
        </>
      )}
    </svg>
  );
}

/** 최근 유가 (지수) 꺾은선과 '보통 값' 선, 사 둔 연료의 평균 단가 선 */
export function OilChart({ months, oil, target, avg, t }: { months: readonly MonthPoint[]; oil: number; target: number; avg?: number; t: number }) {
  const pts = [...months.slice(-35).map((m) => ({ t: m.t, v: m.oil })), { t, v: oil }];
  const W = 300;
  const H = 74;
  const padL = 30;
  const padR = 8;
  const values = [...pts.map((p) => p.v), target, ...(avg ? [avg] : [])];
  const lo = Math.min(...values) * 0.92;
  const hi = Math.max(...values) * 1.06;
  const x = (i: number) => padL + ((W - padL - padR) * i) / Math.max(1, pts.length - 1);
  const y = (v: number) => 6 + (H - 22) * (1 - (v - lo) / Math.max(0.01, hi - lo));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)} ${H - 16} L${x(0).toFixed(1)} ${H - 16}Z`;
  const last = pts[pts.length - 1];
  return (
    <svg className="al-oil-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`최근 유가: 지금 ${oil.toFixed(2)}, 보통 값 ${target.toFixed(2)}`}>
      <text className="al-oil-axis" x={padL - 4} y={y(hi) + 4} textAnchor="end">
        {hi.toFixed(1)}
      </text>
      <text className="al-oil-axis" x={padL - 4} y={y(lo)} textAnchor="end">
        {lo.toFixed(1)}
      </text>
      <path className="al-oil-area" d={area} />
      <path className="al-oil-target" d={`M${padL} ${y(target)} H${W - padR}`} />
      <text className="al-oil-tlabel" x={W - padR} y={y(target) - 3} textAnchor="end">
        보통 값 {target.toFixed(2)}
      </text>
      {avg !== undefined && avg > 0 && (
        <>
          <path className="al-oil-avg" d={`M${padL} ${y(avg)} H${W - padR}`} />
          {/* 보통 값 글과 겹치면 선 아래에 쓴다 */}
          <text className="al-oil-alabel" x={W - padR - 92} y={Math.abs(y(avg) - y(target)) < 12 || y(avg) < y(target) ? y(avg) + 10 : y(avg) - 3} textAnchor="end">
            사 둔 값 {avg.toFixed(2)}
          </text>
        </>
      )}
      <path className="al-oil-line" d={line} />
      <circle className="al-oil-now" cx={x(pts.length - 1)} cy={y(last.v)} r={3.6} />
      <text className="al-oil-axis" x={padL} y={H - 3}>
        {mShort(pts[0].t)}
      </text>
      <text className="al-oil-axis" x={W - padR} y={H - 3} textAnchor="end">
        지금
      </text>
    </svg>
  );
}

interface FuelCardProps {
  state: AirlineState;
  viewer: number;
  canAct: boolean;
  perform: (a: AirlineAction) => void;
  /** 이번 달 어림 (지난달 기록이 없을 때 쓰는 연료) */
  next: CompanyReport | null;
}

export function FuelCard({ state, viewer, canAct, perform, next }: FuelCardProps) {
  const me = state.companies[viewer];
  const tank = tankOf(me);
  const cap = tankCap(me);
  const rep = state.report?.companies[viewer];
  const tons = rep?.fuelTons ?? next?.fuelTons ?? 0;
  const target = oilTarget(state);
  const ratio = state.oil / Math.max(0.01, target);
  const tone = ratio <= 0.95 ? 'good' : ratio >= 1.08 ? 'bad' : 'mid';
  const block = (b: string | null) => (canAct ? b : notMine);
  const space = tankSpace(me);
  const oneMonth = Math.floor(Math.min(space, tons));
  const fill = Math.floor(space);
  const nextLevel = TANK_LEVELS[tank.level + 1];
  const saved = rep?.tankSaved ?? 0;
  const used = rep?.tankUsed ?? 0;
  const half = Math.floor(tank.stock / 2);

  return (
    <section className="al-card al-fuel-card" data-testid="al-fuel">
      <h4 className="al-fin-title">
        <FinIcon kind="fuel" /> 연료 탱크 <small>{TANK_LEVELS[tank.level].name}</small>
      </h4>
      <div className="al-fuel-top">
        <TankGauge fill={cap > 0 ? tank.stock / cap : 0} level={tank.level} />
        <div className="al-fuel-nums">
          {tank.level > 0 ? (
            <>
              <span>
                <small>사 둔 연료</small>
                <b>{tonText(tank.stock)}</b>
                <small>/ {tonText(cap)}</small>
              </span>
              <span>
                <small>평균 단가</small>
                <b className={tank.stock > 0 && tank.avg < state.oil ? 'al-pos' : ''}>{tank.stock > 0 ? tank.avg.toFixed(2) : '—'}</b>
                <small>지금 유가 {state.oil.toFixed(2)}</small>
              </span>
            </>
          ) : (
            <span>
              <small>지금은 달마다 그달 값으로 연료를 사요</small>
              <b>유가 {state.oil.toFixed(2)}</b>
            </span>
          )}
          <span>
            <small>한 달에 쓰는 연료</small>
            <b>{tons > 0 ? `약 ${tonText(tons)}` : '—'}</b>
            {tank.level > 0 && tons > 0 && <small>탱크에 {(tank.stock / tons).toFixed(1)}달 치</small>}
          </span>
        </div>
      </div>
      <OilChart months={state.months} oil={state.oil} target={target} avg={tank.stock > 0 ? tank.avg : undefined} t={state.t} />
      <p className={`al-fuel-verdict al-fuel-${tone}`}>
        {Math.abs(ratio - 1) < 0.02 ? '지금 유가는 보통 값쯤이에요' : `지금 유가는 보통 값보다 ${Math.round(Math.abs(ratio - 1) * 100)}% ${ratio < 1 ? '싸요 — 사 두기 좋은 때예요' : '비싸요 — 사 둔 연료를 쓸 때예요'}`}
      </p>
      {tank.level > 0 && (
        <>
          <div className="al-loan-row">
            <span>사기</span>
            {oneMonth < fill && (
              <ActButton small blocker={block(buyFuelBlocker(state, viewer, oneMonth))} onClick={() => perform({ type: 'buyFuel', tons: oneMonth })} testId="al-fuel-month">
                한 달 치 · {fmtFine(fuelCost(state.oil, oneMonth))}
              </ActButton>
            )}
            <ActButton small blocker={block(buyFuelBlocker(state, viewer, fill))} onClick={() => perform({ type: 'buyFuel', tons: fill })} testId="al-fuel-fill">
              가득 · {fmtFine(fuelCost(state.oil, fill))}
            </ActButton>
          </div>
          <div className="al-loan-row">
            <span>팔기</span>
            <ActButton
              small
              blocker={block(sellFuelBlocker(state, viewer, half))}
              onClick={() => {
                if (window.confirm(`사 둔 연료 ${tonText(half)}을 지금 값의 ${Math.round(FUEL_SELL_RATE * 100)}%인 ${fmtFine(fuelCost(state.oil, half) * FUEL_SELL_RATE)}에 팔까요?`)) perform({ type: 'sellFuel', tons: half });
              }}
            >
              절반 · +{fmtFine(fuelCost(state.oil, half) * FUEL_SELL_RATE)}
            </ActButton>
          </div>
          <div className="al-loan-row al-fuel-auto" role="radiogroup" aria-label="연료 자동으로 사기">
            <span>자동 사기</span>
            {AUTO_OPTIONS.map((o) => (
              <button
                key={o.name}
                type="button"
                role="radio"
                aria-checked={tank.auto === o.ratio}
                className={`al-chip${tank.auto === o.ratio ? ' al-on' : ''}`}
                disabled={!canAct}
                onClick={() => perform({ type: 'setFuelAuto', ratio: o.ratio })}
              >
                {o.name}
              </button>
            ))}
          </div>
          {rep && used > 0 && (
            <p className="al-staff-state">
              <FinIcon kind="fuel" size={16} /> 지난달 탱크 연료 {tonText(used)}을 써서 그달 값보다{' '}
              <b className={saved >= 0 ? 'al-pos' : 'al-neg'}>{saved >= 0 ? `${fmtFine(saved)} 아꼈어요` : `${fmtFine(-saved)} 더 들었어요`}</b>
            </p>
          )}
        </>
      )}
      {nextLevel && (
        <div className="al-loan-row">
          <span>{tank.level === 0 ? '탱크 짓기' : '탱크 키우기'}</span>
          <ActButton small blocker={block(tankBlocker(state, viewer))} onClick={() => perform({ type: 'buildTank' })} testId="al-fuel-tank">
            {nextLevel.name} {tonText(nextLevel.cap)} · {fmtMoney(nextLevel.cost)}
          </ActButton>
        </div>
      )}
      <MoreInfo>
        탱크가 있으면 비행기가 먼저 사 둔 연료를 산 값 그대로 쓰고, 모자라면 그달 값으로 사요. 유가는 달마다 오르내리며 ‘보통 값’ 쪽으로 천천히 돌아가요. 실제 역사를 켜 두면 1973·1979년 석유 파동이나 2008년처럼 갑자기
        뛰기도 해요. 사 둔 연료는 회사 가치에 들어가고, 되팔면 그달 값의 {Math.round(FUEL_SELL_RATE * 100)}%만 받아요. 연료 헤지 계약이 있으면 탱크 연료를 먼저 쓰고 나머지를 고정 값으로 사요.
      </MoreInfo>
    </section>
  );
}
