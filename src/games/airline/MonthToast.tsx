import { useEffect } from 'react';
import { fmtMoney, fmtPax, pct, signedMoney } from './format';
import { causeInfo } from './ReportView';
import { CITY } from './cities';
import { mLabel } from './time';
import type { AirlineState, QuarterReport } from './types';

/**
 * 달마다 나오는 짧은 결산 (막지 않는 알림): 손님·수입·이익·탑승률·정시율과 큰 일 한두 가지.
 * 몇 초 뒤 저절로 사라지고, 다음 달 결산이 오면 바뀐다.
 */
export function MonthToast({ state, report, viewer, onClose, onDetail }: { state: AirlineState; report: QuarterReport; viewer: number; onClose: () => void; onDetail: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onClose, 9000);
    return () => window.clearTimeout(t);
  }, [onClose]);
  const r = report.companies[viewer];
  if (!r) return null;
  const lf = r.seats > 0 ? r.pax / r.seats : 0;
  const news = state.news.filter((n) => report.news.includes(n.id) && (n.for?.includes(viewer) || n.tone === 'big' || n.tone === 'bad')).slice(-2);
  const worst = report.ops.find((o) => o.company === viewer && (o.cancelled > 0 || o.grounded > 0));
  return (
    <div className="al-month-toast" role="status" aria-live="polite" data-testid="al-month-toast">
      <div className="al-mt-head">
        <b>📅 {mLabel(report.t)} 결산</b>
        <button type="button" className="al-link al-small" onClick={onDetail}>
          자세히
        </button>
        <button type="button" className="btn btn-ghost btn-small al-mt-close" onClick={onClose} aria-label="닫기">
          ✕
        </button>
      </div>
      <dl className="al-mt-grid">
        <div>
          <dt>손님</dt>
          <dd>{fmtPax(r.pax)}</dd>
        </div>
        <div>
          <dt>수입</dt>
          <dd>{fmtMoney(r.ticket + r.side)}</dd>
        </div>
        <div>
          <dt>이익</dt>
          <dd className={r.profit < 0 ? 'al-neg' : 'al-pos'}>{signedMoney(r.profit)}</dd>
        </div>
        <div>
          <dt>탑승률</dt>
          <dd>{pct(lf)}</dd>
        </div>
        <div>
          <dt>정시율</dt>
          <dd>{r.flights > 0 ? pct(r.onTime) : '—'}</dd>
        </div>
      </dl>
      {(worst || news.length > 0) && (
        <ul className="al-mt-news">
          {worst && (
            <li>
              {causeInfo(worst.cause).icon} {CITY[worst.a].name}–{CITY[worst.b].name}: 결항 {worst.cancelled}편{worst.grounded ? ` · 점검 ${worst.grounded}대` : ''}
            </li>
          )}
          {news.map((n) => (
            <li key={n.id}>
              {n.icon} {n.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
