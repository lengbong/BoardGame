import './v4.css';
import { SEAT_COLORS } from '../common/players';
import { BIZ_CHANGE_MONTHS, BIZ_INFO, BIZ_MODELS, LCC_BIZ, LCC_CREW, LCC_SERVICE, ancillaryRate, bizChangeCost, bizCostMults, bizModelBlocker, bizModelOf, lccEra } from './bizmodel';
import { fmtMoney } from './format';
import { FinIcon } from './FinanceArt';
import { MoreInfo } from './StaffArt';
import { mLabel, yearOf } from './time';
import type { AirlineAction, AirlineSetup, AirlineState, BizModel, CompanyReport } from './types';
import { ActButton } from './ui';

const notMine = '내 차례에만 할 수 있어요';

// ------------------------------------------------------------------ 설정 화면

/** 사람 자리의 사업 모델만 남긴다 (컴퓨터는 저절로) */
export function humanModels(setup: AirlineSetup): (BizModel | null)[] {
  return [0, 1, 2, 3].map((i) => (setup.seats[i]?.kind === 'human' ? (setup.models?.[i] ?? null) : null));
}

/** 설정 화면: 사람 자리마다 사업 모델 고르기 */
export function BizModelSetup({ setup, onChange }: { setup: AirlineSetup; onChange: (models: (BizModel | null)[]) => void }) {
  const models = humanModels(setup);
  const era = setup.options.era;
  const set = (i: number, m: BizModel) => {
    const next = [...models];
    next[i] = m === 'full' ? null : m;
    onChange(next);
  };
  return (
    <section className="setup-section" data-testid="al-biz-setup">
      <h2>사업 모델</h2>
      <p className="al-note">
        회사마다 풀서비스·저가항공·화물 전문 가운데 하나로 시작해요 (나중에 재무 화면에서 돈과 {BIZ_CHANGE_MONTHS}달을 들여 바꿀 수 있어요). 컴퓨터는 대개 풀서비스이고, 사람과 함께 셋 넘게 겨루면 가끔 하나가
        저가항공(1988년부터)이나 화물 전문이 돼요.
      </p>
      <ul className="al-biz-choices" aria-label="사업 모델 설명">
        {BIZ_MODELS.map((m) => (
          <li key={m} className="al-biz-choice" style={{ cursor: 'default' }}>
            <span className="al-biz-icon" aria-hidden="true">
              {BIZ_INFO[m].icon}
            </span>
            <b>{BIZ_INFO[m].name}</b>
            <small>{BIZ_INFO[m].desc}</small>
            {m === 'lcc' && era < 1978 && <small className="al-why">1978년 규제가 풀리기 전에는 싼 표 손님이 적어요</small>}
          </li>
        ))}
      </ul>
      <ul className="al-biz-seats">
        {setup.seats.map((seat, i) =>
          seat.kind !== 'human' ? null : (
            <li key={i}>
              <span className="al-hub-who" style={{ borderColor: SEAT_COLORS[i as 0].main }}>
                {SEAT_COLORS[i as 0].name} · 사람
              </span>
              <span className="al-sort" role="radiogroup" aria-label={`${SEAT_COLORS[i as 0].name} 자리 사업 모델`}>
                {BIZ_MODELS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={(models[i] ?? 'full') === m}
                    className={`al-chip${(models[i] ?? 'full') === m ? ' al-on' : ''}`}
                    onClick={() => set(i, m)}
                    data-testid={`al-biz-${i}-${m}`}
                  >
                    {BIZ_INFO[m].icon} {BIZ_INFO[m].name}
                  </button>
                ))}
              </span>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------------ 재무 화면

/** 재무 화면 카드: 지금 사업 모델과 바꾸기 */
export function BizModelCard({ state, viewer, canAct, perform }: { state: AirlineState; viewer: number; canAct: boolean; perform: (a: AirlineAction) => void }) {
  const me = state.companies[viewer];
  const model = bizModelOf(me);
  const year = yearOf(state.q);
  const next = me.bizModelNext;
  const lcc = bizCostMults({ bizModel: 'lcc' }, year);
  return (
    <section className="al-card al-biz-card" data-testid="al-biz-card">
      <h4 className="al-fin-title">
        <FinIcon kind="building" /> 사업 모델{' '}
        <small>
          {BIZ_INFO[model].icon} {BIZ_INFO[model].name}
        </small>
      </h4>
      <p className="al-muted">{BIZ_INFO[model].desc}.</p>
      {model === 'lcc' && (
        <ul className="al-biz-facts">
          <li className="al-chip-static">승무원·정비 수당 ×{LCC_CREW}</li>
          <li className="al-chip-static">기내 서비스 ×{LCC_SERVICE}</li>
          <li className="al-chip-static">표 판매 수수료 ×{lcc.sales}</li>
          <li className="al-chip-static">비행기 빨리 돌리기 +15%</li>
          <li className="al-chip-static">부가 수입: 손님마다 운임의 {Math.round(ancillaryRate(year) * 100)}%</li>
          <li className="al-chip-static">사업 손님 ×{LCC_BIZ}</li>
          <li className="al-chip-static">싼 표 관광 손님 +{Math.round(lccEra(year) * 55)}%</li>
        </ul>
      )}
      {model === 'cargo' && <p className="al-muted">화물기만 들일 수 있어요. 비행기 화면 ‘새 비행기’에서 ‘📦 화물기’를 눌러 보세요.</p>}
      {next && (
        <p className="al-biz-pending">
          {BIZ_INFO[next.model].icon} {BIZ_INFO[next.model].name}(으)로 바꾸는 중 — {mLabel(next.t)}에 바뀌어요
        </p>
      )}
      <ul className="al-biz-choices">
        {BIZ_MODELS.filter((m) => m !== model).map((m) => {
          const why = canAct ? bizModelBlocker(me, m) : notMine;
          return (
            <li key={m}>
              <div className="al-biz-choice">
                <span className="al-biz-icon" aria-hidden="true">
                  {BIZ_INFO[m].icon}
                </span>
                <b>{BIZ_INFO[m].name}</b>
                <small>{BIZ_INFO[m].desc}</small>
                {!(next && next.model === m) && (
                  <ActButton small blocker={why} onClick={() => perform({ type: 'setBizModel', model: m })} testId={`al-bizmodel-${m}`}>
                    바꾸기 · {fmtMoney(bizChangeCost(me, m))} · {BIZ_CHANGE_MONTHS}달
                  </ActButton>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {next && (
        <ActButton small blocker={canAct ? null : notMine} onClick={() => perform({ type: 'setBizModel', model })}>
          바꾸기 그만두기 (낸 돈은 돌려받지 못해요)
        </ActButton>
      )}
      <MoreInfo label="바꾸면 어떻게 돼요?">
        바꾸는 값(브랜드·교육·좌석 바꾸기)을 먼저 내고 {BIZ_CHANGE_MONTHS}달 뒤에 바뀌어요. 저가항공이 되면 모든 여객기가 한 등급 촘촘한 좌석이 되고 제휴가 끝나요. 화물 전문이 되면 여객기는, 저가항공이 되면
        화물기·초음속기는 노선에서 빠지니 팔거나 돌려주세요.
      </MoreInfo>
    </section>
  );
}

/** 손익표의 들어온 돈 나누기: 여객 운임·화물·부가 수입·부대사업 */
export const INCOME_PARTS: { key: string; name: string; get: (r: CompanyReport) => number }[] = [
  { key: 'ticket', name: '여객 운임', get: (r) => r.ticket - (r.cargo ?? 0) - (r.ancillary ?? 0) },
  { key: 'cargo', name: '화물 수입', get: (r) => r.cargo ?? 0 },
  { key: 'ancillary', name: '부가 수입', get: (r) => r.ancillary ?? 0 },
  { key: 'side', name: '부대사업·전세기 수입', get: (r) => r.side },
];
