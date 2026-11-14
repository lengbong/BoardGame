import { useEffect, useRef } from 'react';
import { Confetti } from '../../components/Confetti';
import { advise } from './advisor';
import { CHALLENGE } from './challenges';
import { CITY } from './cities';
import { fmtMoney, fmtPax, pct, signedMoney } from './format';
import { GRADE_INFO } from './goals';
import { rankings } from './rules';
import { companyValue, regionsServed } from './simulate';
import { qLabel } from './time';
import type { AirlineState, QuarterReport as Report } from './types';
import { AirlinePhoto } from './AirlinePicker';
import { realOf } from './brand';
import { CoName, Kbd } from './ui';

const MEDALS = ['🥇', '🥈', '🥉', '4등'];


/** 분기가 끝날 때마다(석 달 합) 나오는 결산표. 12월에는 한 해 결산과 경영 평가도 */
export function QuarterReport({ state, report, viewer, onClose, onDetail }: { state: AirlineState; report: Report; viewer: number; onClose: () => void; onDetail: () => void }) {
  const me = state.companies[viewer];
  const r = report.companies[viewer];
  const prevPoint = state.history.length >= 2 ? state.history[state.history.length - 2] : null;
  const prev = prevPoint ? prevPoint.value[viewer] : r.value;
  const year = (() => {
    const rv = r.review;
    const y = rv ? state.years.find((x) => x.year === rv.year) : undefined;
    return y && y.companies[viewer] ? { year: y.year, r: y.companies[viewer] } : null;
  })();
  const order = rankings(state);
  const rank = order.indexOf(viewer) + 1;
  const mine = report.routes.filter((x) => x.company === viewer).sort((a, b) => b.profit - a.profit);
  const best = mine[0];
  const worst = mine.length > 1 ? mine[mine.length - 1] : null;
  const news = state.news.filter((n) => report.news.includes(n.id));
  const lf = r.seats > 0 ? r.pax / r.seats : 0;
  const costs = r.fuel + r.crew + r.airport + r.service + r.sales + r.lease + r.fleet + r.branch + r.ads + r.interest + r.disrupt + r.tax;
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => btn.current?.focus(), []);
  const review = r.review;
  const goals = r.goals ?? [];
  const tips = me.out ? [] : advise(state, viewer, 3).filter((a) => a.key !== 'choice');

  let tip = '';
  if (me.out) tip = '회사가 문을 닫았어요. 다른 회사들의 경쟁을 끝까지 지켜볼 수 있어요.';
  else if (me.crisis > 0) tip = '⚠ 돈이 모자라요! 몇 달 더 모자라면 운항을 멈춰야 해요. 손해 보는 노선을 닫고, 쉬는 비행기를 팔고, 대출을 받아 보세요.';
  else if (r.pax === 0) tip = '아직 나는 비행기가 없어요. 🧑‍💼 경영 비서가 권하는 노선이나 노선 화면에서 비행기를 띄워 보세요.';
  else if (lf < 0.55) tip = '빈 좌석이 많아요. 운임을 내리거나, 횟수를 줄이거나, 작은 비행기로 바꿔 보세요.';
  else if (lf > 0.95) tip = '좌석이 꽉 찼어요! 운임을 올리거나 비행기를 더 넣으면 더 벌 수 있어요.';
  else if (r.profit > 0) tip = '좋아요! 번 돈으로 새 노선을 열어 회사를 키워 보세요.';

  return (
    <div className="overlay al-qr-overlay" role="dialog" aria-modal="true" aria-labelledby="al-qr-title">
      <div className="result-card al-qr" data-testid="al-quarter-report">
        <h2 id="al-qr-title">📊 {qLabel(report.q)} 결산 <small className="al-muted">석 달 합</small></h2>
        <p className="al-qr-co">
          <CoName c={me} bold /> · {rank}등
        </p>
        <div className="al-qr-big">
          <div>
            <span>분기 이익</span>
            <b className={r.profit < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(r.profit)}</b>
          </div>
          <div>
            <span>회사 가치</span>
            <b>{fmtMoney(r.value)}</b>
            <small className={r.value - prev < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(r.value - prev)}</small>
          </div>
          <div>
            <span>손님</span>
            <b>{fmtPax(r.pax)}</b>
            <small>탑승률 {pct(lf)}</small>
          </div>
        </div>
        <div className="al-qr-bars" aria-hidden="true">
          <span className="al-c-rev" style={{ width: `${(r.ticket + r.side) / Math.max(1, r.ticket + r.side, costs) * 100}%` }} />
          <span className="al-c-fuel" style={{ width: `${(costs / Math.max(1, r.ticket + r.side, costs)) * 100}%` }} />
        </div>
        <p className="al-qr-sub">
          수입 {fmtMoney(r.ticket + r.side)} · 비용 {fmtMoney(costs)} (연료 {fmtMoney(r.fuel)}) · 정시 운항률 {r.flights > 0 ? pct(r.onTime) : '—'} · 결항 {r.cancelled}편
        </p>
        {year && (
          <div className="al-qr-year" data-testid="al-year-report">
            <b>📆 {year.year}년 한 해 결산</b>
            <span>
              수입 {fmtMoney(year.r.ticket + year.r.side)} · 이익 <b className={year.r.profit < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(year.r.profit)}</b> · 손님 {fmtPax(year.r.pax)} · 탑승률 {pct(year.r.seats > 0 ? year.r.pax / year.r.seats : 0)} · 정시율 {year.r.flights > 0 ? pct(year.r.onTime) : '—'}
            </span>
          </div>
        )}
        {review && (
          <div className="al-review" data-testid="al-review">
            <span className="al-grade al-grade-big" style={{ background: GRADE_INFO[review.grade].color }} aria-label={`${review.year}년 경영 평가 ${review.grade}`}>
              {review.grade}
            </span>
            <div>
              <b>
                {review.year}년 경영 평가 · {GRADE_INFO[review.grade].word}
              </b>
              <p>{review.text}</p>
              {goals.length > 0 && (
                <ul className="al-review-goals">
                  {goals.map((g) => (
                    <li key={g.kind}>
                      {g.done ? '✅' : '❌'} {g.text}
                      {g.done && <small className="al-pos"> +{fmtMoney(g.reward.cash)} · 평판 +{g.reward.rep}</small>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        {r.xferPax > 0 && (
          <p className="al-qr-sub">
            🔁 갈아탄 손님 {fmtPax(r.xferPax)} — 본사(허브)를 거쳐 두 노선을 이어 탔어요.
          </p>
        )}
        {(best || worst) && (
          <ul className="al-qr-routes">
            {best && (
              <li>
                👍 가장 잘 된 노선: {CITY[best.a].name}–{CITY[best.b].name} <b className="al-pos">{signedMoney(best.profit)}</b>
              </li>
            )}
            {worst && (
              <li>
                {worst.profit < 0 ? '👎' : '🙂'} 가장 덜 된 노선: {CITY[worst.a].name}–{CITY[worst.b].name}{' '}
                <b className={worst.profit < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(worst.profit)}</b>
              </li>
            )}
          </ul>
        )}
        {news.length > 0 && (
          <ul className="al-qr-news">
            {news.slice(0, 4).map((n) => (
              <li key={n.id}>
                {n.icon} <b>{n.title}</b>
              </li>
            ))}
          </ul>
        )}
        {tip && <p className={`al-qr-tip${me.crisis > 0 ? ' al-qr-warn' : ''}`}>{tip}</p>}
        {tips.length > 0 && (
          <div className="al-qr-advice">
            <b>🧑‍💼 비서의 한마디</b>
            <ul>
              {tips.map((t) => (
                <li key={t.key}>
                  {t.icon} {t.title}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="result-actions">
          <button ref={btn} type="button" className="btn btn-primary" onClick={onClose} data-testid="al-qr-close">
            다음 달로 <Kbd>Enter</Kbd>
          </button>
          <button type="button" className="btn" onClick={onDetail}>
            보고서 자세히
          </button>
        </div>
      </div>
    </div>
  );
}

interface GameOverProps {
  state: AirlineState;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
  onLook: () => void;
}

export function GameOver({ state, onRestart, onChangeSetup, onExit, onLook }: GameOverProps) {
  const result = state.result!;
  const order = rankings(state);
  const humans = state.companies.filter((c) => c.kind === 'human');
  const winner = result.winners.length > 0 ? state.companies[result.winners[0]] : null;
  const challenge = state.challenge ? CHALLENGE[state.challenge.id] : null;
  const humanWon = winner?.kind === 'human';
  const humanLost = humans.length >= 1 && !humanWon;
  const title = challenge ? (result.success ? '도전 성공!' : '도전 실패') : winner ? `${winner.name} 우승!` : '게임 끝';

  return (
    <div className="overlay al-result-overlay" role="dialog" aria-modal="true" aria-labelledby="al-result-title">
      {!humanLost && <Confetti />}
      <div className="result-card al-result" data-testid="al-result">
        <div className="trophy" aria-hidden="true">
          {challenge ? (result.success ? challenge.emoji : '⌛') : humanLost ? '🛬' : '🏆'}
        </div>
        <h2 id="al-result-title">{title}</h2>
        <p className="al-result-sub">
          {result.reason}
          {challenge && <> · {challenge.title}</>}
        </p>
        {challenge && state.challenge && <p className="al-muted">{state.challenge.progress}</p>}
        <ol className="al-rank-list">
          {order.map((i, rank) => {
            const c = state.companies[i];
            return (
              <li key={i} className={result.winners.includes(i) ? 'al-rank-winner' : ''} style={{ animationDelay: `${0.25 + rank * 0.15}s` }}>
                <span className="medal">{c.out ? '🛑' : MEDALS[rank]}</span>
                {realOf(c) && (
                  <span className="al-rank-photo">
                    <AirlinePhoto airline={realOf(c)!} width={80} />
                  </span>
                )}
                <span className="al-rank-name">
                  <CoName c={c} bold />
                  <small>
                    {CITY[c.hub].name} · 비행기 {c.planes.length}대 · 노선 {c.routes.length}개 · 지역 {regionsServed(c).size}/6 · 태운 손님 {fmtPax(c.stats.pax)}
                  </small>
                </span>
                <b className="al-rank-value">{c.out ? '운항 중단' : fmtMoney(companyValue(state, i))}</b>
              </li>
            );
          })}
        </ol>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} data-testid="al-restart">
            같은 설정으로 다시 하기
          </button>
          <button type="button" className="btn" onClick={onChangeSetup}>
            설정 바꾸기
          </button>
          <button type="button" className="btn" onClick={onLook}>
            지도·보고서 보기
          </button>
          <button type="button" className="btn" onClick={onExit}>
            처음 화면
          </button>
        </div>
      </div>
    </div>
  );
}
