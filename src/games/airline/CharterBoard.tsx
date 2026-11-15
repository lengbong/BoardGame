import { useState } from 'react';
import './extras.css';
import { MODEL } from './aircraft';
import { MONTH_HOURS, charterBlocker, charterProfit, myCharters, openCharters, tripsFor } from './charters';
import { CITY, dist } from './cities';
import { FleetIcon } from './FleetArt';
import { fmtMoney, km, signedMoney } from './format';
import { legHours } from './simulate';
import { MoreInfo } from './StaffArt';
import { mLabel, monthsText } from './time';
import type { AirlineAction, AirlineState } from './types';
import { ActButton, CoName } from './ui';

const notMine = '내 차례에만 할 수 있어요';

/** 전세기 의뢰 게시판: 의뢰마다 쉬는 비행기를 골라 맡긴다 */
export function CharterBoard({ state, viewer, canAct, perform }: { state: AirlineState; viewer: number; canAct: boolean; perform: (a: AirlineAction) => void }) {
  const me = state.companies[viewer];
  const offers = openCharters(state);
  const mine = myCharters(state, viewer);
  const taken = (state.charters ?? []).filter((o) => o.by !== undefined && o.by !== viewer && o.t === state.t);
  const idle = me.planes.filter((p) => p.legs.length === 0);
  const [open, setOpen] = useState<number | null>(null);
  const lastRev = state.report?.companies[viewer]?.charterRev ?? 0;

  return (
    <section className="al-card al-charter" data-testid="al-charters">
      <h4 className="al-fin-title">
        <FleetIcon kind="plane" /> 전세기 의뢰 <small>쉬는 비행기 {idle.length}대 · 의뢰 {offers.length}건</small>
      </h4>
      {mine.length > 0 && (
        <ul className="al-charter-list al-charter-mine">
          {mine.map((o) => {
            const p = me.planes.find((x) => x.id === o.plane);
            return (
              <li key={o.id}>
                <span className="al-charter-icon" aria-hidden="true">
                  {o.icon}
                </span>
                <span className="al-charter-main">
                  <b>
                    {o.title} · 이번 달 다녀와요
                  </b>
                  <small className="al-muted">
                    {CITY[o.a].name} ⇄ {CITY[o.b].name} · {o.pax}명 · {p ? `${MODEL[p.model].name} ${tripsFor(o, p)}번 왕복` : ''}
                  </small>
                </span>
                <b className="al-pos">+{fmtMoney(o.pay)}</b>
              </li>
            );
          })}
        </ul>
      )}
      {offers.length === 0 ? (
        <p className="al-muted">지금 올라온 의뢰가 없어요. 달마다 새 의뢰가 올라와요.</p>
      ) : (
        <ul className="al-charter-list">
          {offers.map((o) => {
            const d = dist(o.a, o.b);
            const fits = idle
              .map((p) => ({ p, why: charterBlocker(state, viewer, o.id, p.id), profit: charterProfit(state, viewer, o, p) }))
              .sort((x, y) => Number(x.why !== null) - Number(y.why !== null) || y.profit - x.profit);
            const best = fits.find((f) => f.why === null);
            const branchWhy = !me.branches.includes(o.a) && !me.branches.includes(o.b) ? `${CITY[o.a].name}이나 ${CITY[o.b].name}에 지점이 있어야 해요` : null;
            return (
              <li key={o.id} className={best ? 'al-charter-ok' : ''}>
                <span className="al-charter-icon" aria-hidden="true">
                  {o.icon}
                </span>
                <span className="al-charter-main">
                  <b>{o.title}</b>
                  <small className="al-muted">
                    {CITY[o.a].name} ⇄ {CITY[o.b].name} · {km(d)} · 한 달 동안 {o.pax.toLocaleString('ko-KR')}명 · {o.expires === state.t ? '이번 달까지' : `${monthsText(o.expires - state.t + 1)} 남음 (${mLabel(o.expires)}까지)`}
                  </small>
                  {best && <small className="al-pos">가장 남는 비행기: {MODEL[best.p.model].name} {tripsFor(o, best.p)}번 왕복 · 이익 약 {signedMoney(best.profit)}</small>}
                  {!best && <small className="al-why">{branchWhy ?? (idle.length === 0 ? '쉬는 비행기가 없어요' : (fits[0]?.why ?? '맞는 비행기가 없어요'))}</small>}
                </span>
                <span className="al-charter-pay">
                  <b>{fmtMoney(o.pay)}</b>
                  {best && (
                    <button type="button" className="al-link al-small" onClick={() => setOpen(open === o.id ? null : o.id)} aria-expanded={open === o.id}>
                      비행기 고르기
                    </button>
                  )}
                </span>
                {open === o.id && (
                  <ul className="al-charter-planes">
                    {fits
                      .filter((f, i) => fits.findIndex((g) => g.p.model === f.p.model && g.why === f.why) === i)
                      .slice(0, 6)
                      .map(({ p, why, profit }) => (
                      <li key={p.id}>
                        <span>
                          {MODEL[p.model].name}
                          {idle.filter((x) => x.model === p.model).length > 1 && <small> ×{idle.filter((x) => x.model === p.model).length}</small>} <small className="al-muted">{MODEL[p.model].seats}석 · {tripsFor(o, p)}번 왕복 · {Math.round(tripsFor(o, p) * 2 * legHours(MODEL[p.model], d))}/{Math.round(MONTH_HOURS)}시간</small>
                        </span>
                        <b className={profit >= 0 ? 'al-pos' : 'al-neg'}>{signedMoney(profit)}</b>
                        <ActButton small blocker={canAct ? why : notMine} onClick={() => perform({ type: 'charter', offer: o.id, plane: p.id })} testId={`al-charter-${o.id}-${p.id}`}>
                          맡기
                        </ActButton>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {taken.length > 0 && (
        <p className="al-muted al-charter-taken">
          이번 달 다른 회사가 맡은 의뢰:{' '}
          {taken.map((o) => (
            <span key={o.id}>
              {o.icon} {o.title} (<CoName c={state.companies[o.by!]} noIata />){' '}
            </span>
          ))}
        </p>
      )}
      {lastRev > 0 && <p className="al-staff-state">지난달 전세기 보수 +{fmtMoney(lastRev)}</p>}
      <MoreInfo>
        의뢰는 먼저 맡는 회사가 가져가요. 쉬는 비행기로 그달 안에 손님을 데려갔다가 데려오고, 손님 ÷ 좌석만큼 왕복해요 — 너무 큰 비행기는 빈 좌석에 연료를 태우고, 너무 작은 비행기는 여러 번 오가야 해요. 출발지나 도착지에 지점이
        있어야 하고, 전세기로 나간 비행기는 그달 예비기가 되지 못해요. 보수는 부대 수입, 비용은 연료·운항 수당·공항 이용료에 들어가요.
      </MoreInfo>
    </section>
  );
}
