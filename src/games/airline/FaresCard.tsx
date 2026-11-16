import { useState } from 'react';
import './v4.css';
import { BIZ_INFO, bizModelOf } from './bizmodel';
import { CARGO_MIN_D, RATE_K } from './cargo';
import { classFareMult } from './classes';
import { FARE_RANGE, applyFares, recommendFares, type FareAdvice, type FareKey } from './fares';
import { fuelSurchargeKm } from './fuel';
import { fareText, fmtMoney, fmtPax, manwon, pct, signedMoney } from './format';
import { baseFare, marketFare, routeFares, type RouteEstimate } from './simulate';
import { dist } from './cities';
import { FinIcon } from './FinanceArt';
import { MoreInfo } from './StaffArt';
import type { AirlineAction, AirlineState, CompanyReport, Route } from './types';
import { ActButton, LoadMeter, Stepper } from './ui';

const notMine = '내 차례에만 할 수 있어요';

const KEY_NAME: Record<FareKey, string> = { f: '일등석', c: '비즈니스석', y: '일반석', k: '화물' };
const KEY_ICON: Record<FareKey, string> = { f: '👑', c: '💼', y: '💺', k: '📦' };
/** '+10%' · '0%' · '−5%' (좁은 칸에) */
const pctText = (v: number) => (v > 0 ? `+${v}%` : v < 0 ? `−${-v}%` : '0%');

interface FaresCardProps {
  state: AirlineState;
  viewer: number;
  canAct: boolean;
  perform: (a: AirlineAction) => void;
  apply: (fn: (s: AirlineState) => AirlineState) => void;
  route: Route;
  est: RouteEstimate;
}

/**
 * 노선의 등급별 운임 카드: 일등석·비즈니스석·일반석·화물마다 좌석(짐칸)·손님·탑승률·한 장 값·운임 조정·달 수입,
 * 그리고 이익 어림이 가장 큰 '추천 운임'.
 */
export function FaresCard({ state, viewer, canAct, perform, apply, route, est }: FaresCardProps) {
  const me = state.companies[viewer];
  const model = bizModelOf(me);
  const d = dist(route.a, route.b);
  // 한 장 값은 유류할증(등급과 상관없이 같은 값)을 더한, 손님이 실제로 내는 값
  const surcharge = fuelSurchargeKm(state) * d;
  const base = baseFare(d, state.q);
  const mult = classFareMult(d);
  const fares = routeFares(route);
  const [advice, setAdvice] = useState<{ t: number; route: number; a: FareAdvice } | null>(null);
  const shown = advice && advice.route === route.id && advice.t === state.t ? advice.a : null;
  const last = route.stats;
  const rows: { key: FareKey; seats: number; pax: number; rev: number; price: number; unit: string; lastLf: number | null }[] = [];
  const lastLf = (k: 0 | 1 | 2) => (last?.cls && last.cls.seats[k] > 0 ? last.cls.pax[k] / last.cls.seats[k] : null);
  if (est.cls.seats[0] > 0) rows.push({ key: 'f', seats: est.cls.seats[0], pax: est.cls.pax[0], rev: est.cls.rev[0], price: base * mult.f * (1 + fares.f / 100) + surcharge, unit: '석', lastLf: lastLf(0) });
  if (est.cls.seats[1] > 0) rows.push({ key: 'c', seats: est.cls.seats[1], pax: est.cls.pax[1], rev: est.cls.rev[1], price: base * mult.c * (1 + fares.c / 100) + surcharge, unit: '석', lastLf: lastLf(1) });
  if (est.cls.seats[2] > 0) rows.push({ key: 'y', seats: est.cls.seats[2], pax: est.cls.pax[2], rev: est.cls.rev[2], price: base * (1 + fares.y / 100) + surcharge, unit: '석', lastLf: lastLf(2) });
  if (est.cargoCap > 0) {
    const rate = marketFare(state, Math.max(CARGO_MIN_D, d)) * RATE_K;
    rows.push({ key: 'k', seats: est.cargoCap, pax: est.cargoT, rev: est.cargoRev, price: rate * (1 + fares.k / 100), unit: '톤', lastLf: last?.cargo && last.cargo.cap > 0 ? last.cargo.t / last.cargo.cap : null });
  }
  const set = (k: FareKey, v: number) => perform(k === 'y' ? { type: 'setFare', route: route.id, fare: v } : { type: 'setFare', route: route.id, fare: v, cls: k });
  const changed = shown ? (['y', 'c', 'f', 'k'] as const).filter((k) => shown.keys.includes(k) && shown.fares[k] !== fares[k]) : [];

  return (
    <section className="al-card al-fares" data-testid="al-fares-card">
      <h4 className="al-fin-title">
        <FinIcon kind="ticket" /> 등급별 운임 <small>{model === 'full' ? '좌석 등급·화물마다 따로 정해요' : BIZ_INFO[model].name}</small>
      </h4>
      {surcharge >= 0.5 && (
        <p className="al-muted al-fares-sur" data-testid="al-fares-surcharge">
          ⛽ 유가가 보통보다 높아 이 노선 표 한 장에 유류할증 <b>{manwon(surcharge)}</b>이 붙어요 (모든 항공사 같고, 한 장 값에 들어 있어요)
        </p>
      )}
      {rows.length === 0 ? (
        <p className="al-muted">비행기를 넣으면 등급마다 좌석·손님·수입을 보여 줘요.</p>
      ) : (
        <ul className="al-fares-rows">
          {rows.map((x) => {
            const lf = x.seats > 0 ? Math.min(1, x.pax / x.seats) : 0;
            const [lo, hi] = FARE_RANGE[x.key];
            return (
              <li key={x.key} className="al-fares-row" data-testid={`al-fare-row-${x.key}`}>
                <span className="al-fares-name">
                  <span aria-hidden="true">{KEY_ICON[x.key]}</span> <b>{KEY_NAME[x.key]}</b>
                </span>
                <span className="al-fares-lf" title={x.lastLf !== null ? `지난달 ${pct(x.lastLf)}` : undefined}>
                  <LoadMeter lf={lf} />
                  <small>{pct(lf)}</small>
                </span>
                <b className="al-fares-rev" title="이번 달 어림 수입">
                  {fmtMoney(x.rev)}
                </b>
                <small className="al-fares-sub al-muted">
                  {x.key === 'k'
                    ? `${Math.round(x.pax).toLocaleString('ko-KR')} / ${Math.round(x.seats).toLocaleString('ko-KR')}톤`
                    : `${fmtPax(x.pax)} / ${Math.round(x.seats).toLocaleString('ko-KR')}석`}
                  {' · '}
                  {x.key === 'k' ? '톤당' : '한 장'} {manwon(x.price)}
                  {x.lastLf !== null && ` · 지난달 ${pct(x.lastLf)}`}
                </small>
                <span className="al-fares-step">
                  <Stepper value={fares[x.key]} min={lo} max={hi} step={5} disabled={!canAct} label={`${KEY_NAME[x.key]} 운임 조정`} format={pctText} onChange={(v) => set(x.key, v)} />
                </span>
              </li>
            );
          })}
          {est.ancillary > 0 && (
            <li className="al-fares-row">
              <span className="al-fares-name">
                <span aria-hidden="true">🎒</span> <b>부가 수입</b>
              </span>
              <small className="al-fares-lf al-muted">짐·좌석 지정·기내 판매</small>
              <b className="al-fares-rev">{fmtMoney(est.ancillary)}</b>
            </li>
          )}
        </ul>
      )}
      {rows.length > 0 && (
        <div className="al-fares-rec">
          <button
            type="button"
            className="btn btn-small"
            onClick={() => setAdvice({ t: state.t, route: route.id, a: recommendFares(state, viewer, route) })}
            data-testid="al-fares-recommend"
          >
            💡 추천 운임
          </button>
          {shown &&
            (changed.length === 0 ? (
              <small className="al-muted">지금 운임이 가장 좋아 보여요.</small>
            ) : (
              <>
                <span className="al-chips">
                  {changed.map((k) => (
                    <span key={k} className="al-chip-static">
                      {KEY_NAME[k]} {fareText(fares[k])} → <b>{fareText(shown.fares[k])}</b>
                    </span>
                  ))}
                  <span className="al-chip-static al-pos">달 이익 {signedMoney(shown.profit - shown.now)}</span>
                </span>
                <ActButton
                  small
                  primary
                  blocker={canAct ? null : notMine}
                  onClick={() => {
                    const target = Object.fromEntries(changed.map((k) => [k, shown.fares[k]]));
                    apply((s) => applyFares(s, route.id, target));
                    setAdvice(null);
                  }}
                  testId="al-fares-apply"
                >
                  이대로 바꾸기
                </ActButton>
              </>
            ))}
        </div>
      )}
      <MoreInfo label="등급별 운임은 어떻게 달라요?">
        고급 좌석을 찾는 손님은 사업 손님일수록, 멀리 갈수록, 요즘일수록 많아요. 비즈니스석은 1979년 무렵 생겼고, 그 전에는 고급 좌석 손님이 일등석을 찾아요. 일등석 손님은 값에 덜 민감하고 비즈니스석 손님은 조금 더
        민감해요. 너무 비싸면 일부는 아래 등급으로, 일부는 다른 회사로 가요. 자리가 모자라면 아래 등급으로 내려가고, 일반석이 차면 남은 고급 좌석에 일반석 값으로 앉아요. 화물은 넓은 동체 여객기 배 아래 짐칸과
        화물기에 싣고 10~12월에 가장 많아요. 저가항공은 짐칸 화물을 받지 않아요. 유가가 보통보다 높으면 모든 항공사 표와 화물 운임에 거리만큼 유류할증이 똑같이 붙어요.
      </MoreInfo>
    </section>
  );
}

/** 달 결산 알림에 덧붙이는 한 줄: 고급 좌석 손님·화물·부가 수입 */
export function MonthClassLine({ r }: { r: CompanyReport }) {
  const prem = (r.paxF ?? 0) + (r.paxC ?? 0);
  const parts: string[] = [];
  if (prem > 0) parts.push(`💼 고급 좌석 ${fmtPax(prem)} (${fmtMoney((r.revF ?? 0) + (r.revC ?? 0))})`);
  if ((r.cargoT ?? 0) > 0) parts.push(`📦 화물 ${Math.round(r.cargoT).toLocaleString('ko-KR')}톤 (${fmtMoney(r.cargo ?? 0)})`);
  if ((r.ancillary ?? 0) > 0) parts.push(`🎒 부가 수입 ${fmtMoney(r.ancillary)}`);
  if (parts.length === 0) return null;
  return <p className="al-mt-classes">{parts.join(' · ')}</p>;
}

