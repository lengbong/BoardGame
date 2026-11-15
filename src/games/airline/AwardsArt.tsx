import type { CSSProperties } from 'react';
import './extras.css';
import { AWARD_INFO, AWARD_KINDS, trophyCount } from './awards';
import { coColors } from './brand';
import type { AirlineState, AwardKind } from './types';
import { CoName } from './ui';

const MEDAL: Record<AwardKind, { fill: string; ribbon: string }> = {
  airline: { fill: '#e2b13c', ribbon: '#c0392b' },
  punctual: { fill: '#5b8def', ribbon: '#2c4f9e' },
  service: { fill: '#e57fa6', ribbon: '#a23a64' },
  growth: { fill: '#3fb07a', ribbon: '#1f7048' },
  hub: { fill: '#9b7be0', ribbon: '#5a3fa0' },
};

/** 상 메달 (리본 + 둥근 메달 + 부문 그림) */
export function AwardMedal({ kind, size = 34, dim }: { kind: AwardKind; size?: number; dim?: boolean }) {
  const m = MEDAL[kind];
  return (
    <svg className={`al-medal${dim ? ' al-medal-dim' : ''}`} width={size} height={size * 1.2} viewBox="0 0 40 48" role="img" aria-label={AWARD_INFO[kind].name}>
      <path d="M12 2h7l-3 16h-7z" fill={m.ribbon} />
      <path d="M28 2h-7l3 16h7z" fill={m.ribbon} opacity={0.8} />
      <circle cx={20} cy={30} r={14} fill={m.fill} />
      <circle cx={20} cy={30} r={10.5} fill="none" stroke="#fff" strokeOpacity={0.6} strokeWidth={1.4} />
      <g fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {kind === 'airline' && <path d="M15 24h10v4a5 5 0 0 1-10 0zM20 33v3M16.5 37h7M15 25.5h-2a2.5 2.5 0 0 0 2.5 3M25 25.5h2a2.5 2.5 0 0 1-2.5 3" />}
        {kind === 'punctual' && <path d="M20 23.5a6.5 6.5 0 1 0 0.01 0M20 26.5v3.8l2.6 1.6" />}
        {kind === 'service' && <path d="M13.5 34h13M15 34a5 5 0 0 1 10 0M20 27.5v1.4" />}
        {kind === 'growth' && <path d="M14 35l4.5-4.5 3 3 5-6M23 27.5h3.5V31" />}
        {kind === 'hub' && <path d="M14 27h9.5l-2.5-2.5M26 33h-9.5l2.5 2.5" />}
      </g>
    </svg>
  );
}

/** 연말 시상식 (그해 받은 상 모두, 내 회사는 굵게) */
export function AwardCeremony({ state, year, viewer }: { state: AirlineState; year: number; viewer: number }) {
  const y = (state.awards ?? []).find((x) => x.year === year);
  if (!y || y.items.length === 0) return null;
  const mine = y.items.filter((a) => a.company === viewer).length;
  return (
    <section className="al-ceremony" data-testid="al-awards">
      <h4>
        🏆 {year}년 하늘길 시상식 {mine > 0 && <small className="al-pos">우리 회사 {mine}관왕!</small>}
      </h4>
      <ul>
        {y.items.map((a) => {
          const c = state.companies[a.company];
          return (
            <li key={a.kind} className={a.company === viewer ? 'al-on' : ''} style={{ '--al-co': coColors(c).main } as CSSProperties}>
              <AwardMedal kind={a.kind} size={28} />
              <span className="al-ceremony-main">
                <b>{AWARD_INFO[a.kind].name}</b>
                <span>
                  <CoName c={c} /> <small className="al-muted">{a.text}</small>
                </span>
              </span>
              {a.company === viewer && <small className="al-pos al-ceremony-gain">평판 +{AWARD_INFO[a.kind].rep}</small>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** 트로피 진열장: 이 회사가 지금까지 받은 상 (받지 못한 부문은 흐리게) */
export function TrophyShelf({ state, ci }: { state: AirlineState; ci: number }) {
  const count = trophyCount(state.awards, ci);
  const total = [...count.values()].reduce((s, n) => s + n, 0);
  return (
    <div className="al-shelf" aria-label={`받은 상 ${total}개`}>
      {AWARD_KINDS.map((k) => (
        <span key={k} className="al-shelf-item" title={`${AWARD_INFO[k].name}: ${AWARD_INFO[k].desc}`}>
          <AwardMedal kind={k} size={24} dim={!count.get(k)} />
          <small>{count.get(k) ? `×${count.get(k)}` : '—'}</small>
        </span>
      ))}
    </div>
  );
}
