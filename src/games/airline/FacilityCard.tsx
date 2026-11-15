import './extras.css';
import { CITY } from './cities';
import { FACILITY_INFO, FACILITY_KINDS, FACILITY_REFUND, facilitiesOf, facilitiesUpkeep, facilityBlocker, facilityCost, facilityUpkeep, hasFacility } from './facilities';
import { FinIcon } from './FinanceArt';
import { fmtFine, fmtMoney } from './format';
import { slotCapacity, slotsUsed } from './simulate';
import { MoreInfo } from './StaffArt';
import type { AirlineAction, AirlineState, FacilityKind } from './types';
import { ActButton } from './ui';

const notMine = '내 차례에만 할 수 있어요';

/** 시설 그림 (라운지 소파 · 정비 기지 격납고 · 터미널 지붕) */
export function FacilityIcon({ kind, size = 22 }: { kind: FacilityKind; size?: number }) {
  const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <svg className={`al-sicon al-fac-icon al-fac-${kind}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {kind === 'lounge' && (
        <>
          <path d="M4 12.5V10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5" {...S} />
          <path d="M3 13a1.6 1.6 0 0 1 3.2 0v1.5h11.6V13a1.6 1.6 0 0 1 3.2 0v4.5H3z" {...S} />
          <path d="M5 17.5V20M19 17.5V20" {...S} />
        </>
      )}
      {kind === 'base' && (
        <>
          <path d="M2.5 20V11a9.5 7 0 0 1 19 0v9" {...S} />
          <path d="M7 20v-6h10v6M2 20h20" {...S} />
          <path d="M12 6.5v2" {...S} />
        </>
      )}
      {kind === 'terminal' && (
        <>
          <path d="M3 10.5c3-3 15-3 18 0" {...S} />
          <path d="M4.5 10v9.5M19.5 10v9.5M2.5 19.5h19M8.5 19.5v-5h7v5" {...S} />
          <path d="M8 13h.01M12 13h.01M16 13h.01" {...S} strokeWidth={2.4} />
        </>
      )}
    </svg>
  );
}

/** 지도 도시 칸: 이 공항의 시설 (짓기·운영 중) */
export function FacilityRow({ state, viewer, city, canAct, perform }: { state: AirlineState; viewer: number; city: string; canAct: boolean; perform: (a: AirlineAction) => void }) {
  const me = state.companies[viewer];
  return (
    <div className="al-biz-row al-fac-row" aria-label="공항 시설">
      {FACILITY_KINDS.map((k) => {
        const info = FACILITY_INFO[k];
        if (hasFacility(me, city, k)) {
          return (
            <span key={k} className="tag al-fac-tag" title={info.desc}>
              <FacilityIcon kind={k} size={15} /> {info.name} 운영 중
            </span>
          );
        }
        const why = facilityBlocker(state, viewer, city, k);
        if (why === '공항이 더 커야 지을 수 있어요') return null;
        return (
          <ActButton key={k} small blocker={canAct ? why : notMine} onClick={() => perform({ type: 'buildFacility', city, kind: k })} title={info.desc} testId={`al-fac-${k}`}>
            {info.icon} {info.name} {fmtMoney(facilityCost(city, k, state.q))}
          </ActButton>
        );
      })}
    </div>
  );
}

/** 재무 화면: 가진 시설과 본사에 지을 수 있는 시설 */
export function FacilityCard({ state, viewer, canAct, perform }: { state: AirlineState; viewer: number; canAct: boolean; perform: (a: AirlineAction) => void }) {
  const me = state.companies[viewer];
  const list = facilitiesOf(me);
  const hub = me.hub;
  const used = slotsUsed(me, hub);
  const cap = slotCapacity(state, viewer, hub);
  return (
    <section className="al-card al-fac-card" data-testid="al-facilities">
      <h4 className="al-fin-title">
        <FinIcon kind="building" /> 공항 시설 <small>{list.length > 0 ? `${list.length}곳 · 달 유지비 ${fmtFine(facilitiesUpkeep(me, state.q))}` : '아직 없어요'}</small>
      </h4>
      {list.length > 0 && !canAct && <small className="al-why">{notMine}</small>}
      {FACILITY_KINDS.map((kind) => {
        // 종류별로 묶어 설명은 한 번만, 도시는 작은 칸으로 늘어놓는다 (시설이 많아도 짧게)
        const items = list.filter((f) => f.kind === kind).sort((a, b) => CITY[a.city].name.localeCompare(CITY[b.city].name, 'ko'));
        if (items.length === 0) return null;
        const info = FACILITY_INFO[kind];
        const upkeep = items.reduce((s, f) => s + facilityUpkeep(f.city, f.kind, state.q), 0);
        return (
          <div key={kind} className="al-fac-group" data-testid={`al-fac-group-${kind}`}>
            <div className="al-fac-ghead">
              <FacilityIcon kind={kind} size={22} />
              <b>{info.name}</b>
              <small className="al-muted">
                {items.length}곳 · 달 {fmtFine(upkeep)}
              </small>
            </div>
            <small className="al-muted al-fac-gdesc">{info.desc}</small>
            <ul className="al-fac-chips">
              {items.map((f) => (
                <li key={`${f.city}-${f.kind}`}>
                  <span className="al-fac-city" title={CITY[f.city].name}>
                    <b>{CITY[f.city].name}</b>
                    <small className="al-muted">달 {fmtFine(facilityUpkeep(f.city, f.kind, state.q))}</small>
                  </span>
                  <ActButton
                    small
                    quiet
                    blocker={canAct ? null : notMine}
                    onClick={() => {
                      if (window.confirm(`${CITY[f.city].name} ${info.name}을(를) ${fmtMoney(f.cost * FACILITY_REFUND)}에 팔까요?`)) perform({ type: 'sellFacility', city: f.city, kind: f.kind });
                    }}
                    title={`${CITY[f.city].name} ${info.name} 팔기`}
                  >
                    팔기 +{fmtMoney(f.cost * FACILITY_REFUND)}
                  </ActButton>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <h5 className="al-fin-sub">
        본사 {CITY[hub].name}에 짓기{' '}
        <small>
          슬롯 {used}/{cap}회
        </small>
      </h5>
      <FacilityRow state={state} viewer={viewer} city={hub} canAct={canAct} perform={perform} />
      <MoreInfo>
        시설은 지점이 있는 공항에 지어요 (지도에서 도시를 누르면 그 공항에도 지을 수 있어요). 라운지는 그 도시를 오가는 사업 손님과 거기서 갈아타는 손님을 끌고, 정비 기지는 C점검을 싸고 빠르게, 전용 터미널은 큰 공항의 슬롯을 늘리고 갈아타는
        시간을 줄여요. 시설은 회사 가치에 지은 값의 60%로 들어가고, 팔면 절반을 돌려받아요.
      </MoreInfo>
    </section>
  );
}
