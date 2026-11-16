import { shownCompanies } from './rules';
import type { CSSProperties } from 'react';
import './extras.css';
import { coColors } from './brand';
import { FinIcon } from './FinanceArt';
import { fmtMoney } from './format';
import { marketCap, valuationMult } from './simulate';
import { MoreInfo } from './StaffArt';
import {
  HUMAN_CAP,
  MAX_HELD,
  MERGE_AT,
  STAKE_STEPS,
  buyCost,
  buyStakeBlocker,
  buyoutCost,
  dividendOutlook,
  issueBlocker,
  issueCash,
  mergeBlocker,
  pricePerPct,
  sellStakeBlocker,
  sellValue,
  shareholders,
  stakeOf,
} from './stocks';
import type { AirlineAction, AirlineState } from './types';
import { ActButton, CoName } from './ui';

const notMine = '내 차례에만 할 수 있어요';

/** 범례에 이름을 다 쓰는 주주 회사 수 (나머지는 '외 N곳'으로 묶는다) */
const OWN_SHOWN = 5;

/** 몫(%) 글: 0.1 단위로 쌓이므로 끝자리가 있으면 소수 한 자리 */
const pctText = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return `${Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1)}%`;
};

/** 누가 이 회사 주식을 얼마나 가졌는지: 회사 색 막대(큰 몫부터)와 그 아래 이름·몫 범례, 나머지는 창업자·일반 주주 */
function OwnershipBar({ state, i, viewer }: { state: AirlineState; i: number; viewer: number }) {
  const { holders, founder } = shareholders(state, i);
  const named = holders.slice(0, OWN_SHOWN).map((h) => ({ ...h, c: state.companies[h.j] }));
  const others = holders.slice(OWN_SHOWN);
  const othersPct = others.reduce((s, h) => s + h.pct, 0);
  const segs = [...named.map((p) => ({ key: `c${p.j}`, v: p.pct, fill: coColors(p.c).main })), ...(othersPct > 0 ? [{ key: 'others', v: othersPct, fill: 'var(--text-muted)' }] : [])];
  const label = [...named.map((p) => `${p.c.name} ${pctText(p.pct)}`), ...(othersPct > 0 ? [`외 ${others.length}곳 ${pctText(othersPct)}`] : []), `창업자·일반 주주 ${pctText(founder)}`].join(', ');
  let x = 0;
  return (
    <>
      <svg className="al-own-bar" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label={`주주: ${label}`}>
        <rect className="al-own-rest" x={0} y={0} width={100} height={10} rx={3} />
        {segs.map((p) => {
          const r = <rect key={p.key} className="al-own-part" x={x} y={0} width={p.v} height={10} style={{ fill: p.fill } as CSSProperties} />;
          x += p.v;
          return r;
        })}
        <path className="al-own-mark" d={`M${MERGE_AT} 0V10`} />
        <path className="al-own-cap" d={`M${MAX_HELD} 0V10`} />
      </svg>
      <ul className="al-hc-legend al-own-legend" aria-hidden="true">
        {named.map((p) => (
          <li key={p.j}>
            <CoName c={p.c} noIata bold={p.j === viewer} />
            {p.j === viewer && <span className="al-muted">(우리)</span>}
            <b>{pctText(p.pct)}</b>
          </li>
        ))}
        {othersPct > 0 && (
          <li title={others.map((h) => `${state.companies[h.j].name} ${pctText(h.pct)}`).join(', ')}>
            <i className="al-sw al-own-sw-others" /> 외 {others.length}곳 <b>{pctText(othersPct)}</b>
          </li>
        )}
        <li>
          <i className="al-sw al-own-sw-rest" /> 창업자·일반 주주 <b>{pctText(founder)}</b>
        </li>
      </ul>
    </>
  );
}

/** 재무 화면 '주식' 카드: 회사마다 주가·시가 총액·주주, 사기·팔기·인수, 우리 회사 증자 */
export function StockCard({ state, viewer, canAct, perform }: { state: AirlineState; viewer: number; canAct: boolean; perform: (a: AirlineAction) => void }) {
  const me = state.companies[viewer];
  const block = (b: string | null) => (canAct ? b : notMine);
  // 세계 항공사 모드: 가치 순 위쪽 열두 곳과 내가 주식을 가진 회사만 보인다
  const pool = state.options.world ? [...new Set([...shownCompanies(state, viewer, 12), ...state.companies.map((_, i) => i).filter((i) => stakeOf(state, i, viewer) > 0)])] : state.companies.map((_, i) => i);
  const rows = pool.map((i) => ({ c: state.companies[i], i })).filter(({ c, i }) => !c.out || i === viewer);
  const merged = state.companies.filter((c) => c.mergedInto !== undefined && (!state.options.world || c.mergedInto === viewer));
  return (
    <section className="al-card al-stock-card" data-testid="al-stocks">
      <h4 className="al-fin-title">
        <FinIcon kind="chart" /> 주식 <small>1%의 값 · 분기마다 이익의 20% 배당</small>
      </h4>
      <ul className="al-stock-list">
        {rows.map(({ c, i }) => {
          const mine = stakeOf(state, i, viewer);
          const self = i === viewer;
          const mult = valuationMult(state, i);
          return (
            <li key={i} className={self ? 'al-stock-self' : ''}>
              <div className="al-stock-head">
                <CoName c={c} bold={self} />
                <span className="al-stock-price">
                  <b>{fmtMoney(pricePerPct(state, i))}</b>
                  <small className="al-muted">
                    시가 총액 {fmtMoney(marketCap(state, i))} · 배수 <span className={mult >= 1 ? 'al-pos' : 'al-neg'}>×{mult.toFixed(2)}</span>
                  </small>
                </span>
              </div>
              <OwnershipBar state={state} i={i} viewer={viewer} />
              {self ? (
                <div className="al-loan-row">
                  <span>증자</span>
                  <ActButton small blocker={block(issueBlocker(state, viewer))} onClick={() => perform({ type: 'issueShares' })} title="새 주식을 10% 찍어 팔아 돈을 마련해요 (다른 회사들 몫이 조금 줄어요)">
                    새 주식 10% · +{fmtMoney(issueCash(state, viewer))}
                  </ActButton>
                </div>
              ) : (
                <>
                  <small className="al-muted al-stock-mine">
                    우리 몫 <b>{mine.toFixed(0)}%</b>
                    {mine > 0 && ` · 다음 배당 어림 ${fmtMoney(dividendOutlook(state, i, viewer))}`}
                    {c.kind === 'human' && ` · 사람 회사는 ${HUMAN_CAP}%까지`}
                  </small>
                  <div className="al-loan-row">
                    <span>사기</span>
                    {STAKE_STEPS.map((pct) => (
                      <ActButton key={pct} small quiet blocker={block(buyStakeBlocker(state, viewer, i, pct))} onClick={() => perform({ type: 'buyStake', company: i, pct })} testId={`al-buy-${i}-${pct}`}>
                        {pct}% · {fmtMoney(buyCost(state, i, pct))}
                      </ActButton>
                    ))}
                  </div>
                  {mine > 0 && (
                    <div className="al-loan-row">
                      <span>팔기</span>
                      <ActButton small quiet blocker={block(sellStakeBlocker(state, viewer, i, Math.min(5, mine)))} onClick={() => perform({ type: 'sellStake', company: i, pct: Math.min(5, mine) })}>
                        {Math.min(5, mine).toFixed(0)}% · +{fmtMoney(sellValue(state, i, Math.min(5, mine)))}
                      </ActButton>
                      <ActButton small quiet blocker={block(sellStakeBlocker(state, viewer, i, mine))} onClick={() => perform({ type: 'sellStake', company: i, pct: mine })}>
                        모두 · +{fmtMoney(sellValue(state, i, mine))}
                      </ActButton>
                    </div>
                  )}
                  {c.kind !== 'human' && mine >= MERGE_AT - 15 && (
                    <div className="al-loan-row">
                      <span>인수</span>
                      <ActButton
                        small
                        primary
                        blocker={block(mergeBlocker(state, viewer, i))}
                        onClick={() => {
                          if (window.confirm(`${c.name}을(를) 인수해 합칠까요? 남은 주식을 ${fmtMoney(buyoutCost(state, viewer, i))}에 사들이고, 노선·비행기·직원·빚을 모두 넘겨받아요.`)) perform({ type: 'merge', company: i });
                        }}
                        testId={`al-merge-${i}`}
                      >
                        합치기 · {fmtMoney(buyoutCost(state, viewer, i))}
                      </ActButton>
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
      {merged.length > 0 && (
        <p className="al-muted">
          인수되어 합쳐진 회사:{' '}
          {merged.map((c) => (
            <span key={c.seat}>
              {c.name} → {state.companies[c.mergedInto!].name}{' '}
            </span>
          ))}
        </p>
      )}
      <MoreInfo>
        주가는 회사 자산 가치에 지난 한 해 이익에 따른 배수(×0.6~2)를 곱한 시가 총액의 1%예요. 막대 아래에 주주 회사와 몫이 큰 순서로 적혀 있어요. 다른 회사들이 가질 수 있는 몫은 합쳐서 {MAX_HELD}%까지이고(막대의 흐린 금), 많이 사들일수록 값이 올라요. 흑자 분기마다 이익의 20%를 주주 회사들에게 몫만큼
        배당해요. 컴퓨터 회사는 {MERGE_AT}% 넘게 가지면(막대의 진한 금) 남은 주식을 사들여 합칠 수 있어요 — 다른 주주 회사 몫은 주가대로, 창업자 몫은 반값에. 사람 회사는 인수할 수 없어요. 가진 주식은 회사 가치에 시가로 들어가요.
        {me.lastIssue !== undefined && ' 증자는 한 해에 한 번이에요.'}
      </MoreInfo>
    </section>
  );
}
