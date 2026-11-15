import { useMemo, useState, type ReactNode } from 'react';
import { MODEL } from './aircraft';
import { isFreighter } from './freighters';
import {
  MEAL_COST,
  MEAL_ICONS,
  MEAL_NAMES,
  PITCH_INCH,
  PITCH_NAMES,
  abreast,
  cabinPresets,
  cabinSeats,
  canBusiness,
  canFirst,
  economySeats,
  fixedCabin,
  maxBusiness,
  maxFirst,
  sameCabin,
} from './cabin';
import { fmtMoney, signedMoney } from './format';
import { cabinChangeBlocker, cabinTargets, refitCost } from './rules';
import { cabinOutlook } from './simulate';
import { FinIcon } from './FinanceArt';
import { FleetIcon } from './FleetArt';
import { MoreInfo } from './StaffArt';
import type { AirlineAction, AirlineState, Cabin, ModelDef, Pitch, Plane } from './types';
import { ActButton, Stepper } from './ui';

// ------------------------------------------------------------------ 좌석 배치도

const CLASS_COLOR = { first: '#c9a227', business: '#3e63dd', economy: '#8a99ad' } as const;

/** 한 줄 좌석을 통로로 나눈 묶음 (예: 9 → 3·3·3) */
function blocks(n: number): number[] {
  const table: Record<number, number[]> = { 1: [1], 2: [1, 1], 3: [1, 2], 4: [2, 2], 5: [2, 3], 6: [3, 3], 7: [2, 3, 2], 8: [2, 4, 2], 9: [3, 3, 3], 10: [3, 4, 3] };
  return table[n] ?? [n];
}

interface SeatMapProps {
  model: ModelDef;
  cabin: Cabin;
  /** 비교용 (바꾸기 전 좌석 수) */
  compact?: boolean;
}

/** 위에서 본 객실: 왼쪽이 앞. 일등석(금색) · 비즈니스석(파랑) · 일반석(회색) */
export function SeatMap({ model, cabin, compact }: SeatMapProps) {
  const ab = abreast(model);
  const y = economySeats(model, cabin);
  const fixed = fixedCabin(model);
  const groups: { kind: keyof typeof CLASS_COLOR; seats: number; across: number; pitch: number; size: number }[] = fixed
    ? [{ kind: 'business', seats: model.seats, across: 4, pitch: 1.25, size: 1 }]
    : [
        { kind: 'first', seats: cabin.first, across: ab.first || 4, pitch: 2.4, size: 1 },
        { kind: 'business', seats: cabin.business, across: ab.business, pitch: 1.7, size: 1 },
        { kind: 'economy', seats: y, across: ab.economy, pitch: [0.95, 1.05, 1.22][cabin.pitch], size: 1 },
      ];
  const across = Math.max(...groups.map((g) => g.across));
  const aisleCount = blocks(across).length - 1;
  const rowW = across + aisleCount * 0.9;
  const rows = groups.map((g) => (g.seats > 0 ? Math.ceil(g.seats / g.across) : 0));
  const lengthUnits = groups.reduce((s, g, i) => s + rows[i] * g.pitch, 0) + groups.filter((_, i) => rows[i] > 0).length * 0.8;
  const nose = rowW * 0.9;
  const tail = rowW * 1.1;
  const W = nose + lengthUnits + tail;
  const H = rowW + 1.6;
  const seats: ReactNode[] = [];
  let x = nose + 0.4;
  groups.forEach((g, gi) => {
    if (rows[gi] === 0) return;
    const bl = blocks(g.across);
    const blockW = (rowW - (bl.length - 1) * 0.9) / g.across;
    let left = g.seats;
    for (let r = 0; r < rows[gi]; r++) {
      const inRow = Math.min(g.across, left);
      left -= inRow;
      let col = 0;
      let yy = 0.8;
      bl.forEach((n, bi) => {
        for (let k = 0; k < n; k++) {
          if (col < inRow) {
            const sw = Math.min(g.pitch, blockW * g.size) * 0.84;
            const sh = Math.min(blockW * 0.86, sw * 1.1);
            seats.push(<rect key={`${gi}-${r}-${col}`} x={x + (g.pitch - sw) / 2} y={yy + (blockW - sh) / 2} width={sw} height={sh} rx={Math.min(sw, sh) * 0.28} fill={CLASS_COLOR[g.kind]} />);
          }
          col++;
          yy += blockW;
        }
        if (bi < bl.length - 1) yy += 0.9;
      });
      x += g.pitch;
    }
    x += 0.8;
  });
  const body = `M${nose} 0.3 H${W - tail} Q${W - tail * 0.2} ${H * 0.3} ${W} ${H / 2} Q${W - tail * 0.2} ${H * 0.7} ${W - tail} ${H - 0.3} H${nose} Q0 ${H - 0.3} 0 ${H / 2} Q0 0.3 ${nose} 0.3Z`;
  return (
    <svg className={`al-seatmap${compact ? ' al-seatmap-small' : ''}`} viewBox={`-0.5 -0.5 ${W + 1} ${H + 1}`} preserveAspectRatio="xMinYMid meet" role="img" aria-label={`좌석 배치도: 일등석 ${cabin.first}, 비즈니스석 ${cabin.business}, 일반석 ${y}`}>
      <path d={body} className="al-seatmap-body" />
      <path d={`M${nose * 0.35} ${H * 0.36} Q${nose * 0.6} ${H * 0.3} ${nose * 0.75} ${H * 0.36} V${H * 0.64} Q${nose * 0.6} ${H * 0.7} ${nose * 0.35} ${H * 0.64}Z`} className="al-seatmap-cockpit" />
      {seats}
    </svg>
  );
}

// ------------------------------------------------------------------ 편집 창

interface CabinEditorProps {
  state: AirlineState;
  viewer: number;
  plane: Plane;
  canAct: boolean;
  perform: (a: AirlineAction) => void;
  onClose: () => void;
}

const notMine = '내 차례에만 할 수 있어요';

export function CabinEditor({ state, viewer, plane, canAct, perform, onClose }: CabinEditorProps) {
  const me = state.companies[viewer];
  const m = MODEL[plane.model];
  const [draft, setDraft] = useState<Cabin>(plane.cabin);
  const [all, setAll] = useState(false);
  const same = me.planes.filter((p) => p.model === plane.model);
  const fixed = fixedCabin(m);
  const changed = !sameCabin(draft, plane.cabin);
  const targets = cabinTargets(me, plane, draft, all);
  const cost = targets.reduce((s, p) => s + refitCost(state, p, draft), 0);
  const free = (plane.got ?? plane.since) === state.t;
  const blocker = !canAct ? notMine : changed || all ? cabinChangeBlocker(state, viewer, plane.id, draft, all) : '지금과 같은 배치예요';
  const outlook = useMemo(() => cabinOutlook(state, viewer, plane.id, draft, plane.meal), [state, viewer, plane.id, draft, plane.meal]);
  const seats = cabinSeats(m, draft);
  const y = economySeats(m, draft);
  const set = (k: keyof Cabin, v: number) => setDraft((d) => ({ ...d, [k]: v }));
  const mealOutlook = (lv: number) => cabinOutlook(state, viewer, plane.id, plane.cabin, lv);

  if (isFreighter(m)) {
    return (
      <div className="al-cabin" data-testid={`al-cabin-${plane.id}`}>
        <div className="al-cabin-head">
          <h5 className="al-fl-cabin-title">
            <FleetIcon kind="box" size={16} /> {m.name} · 화물 {m.cargo}톤
          </h5>
          <button type="button" className="btn btn-small btn-ghost" onClick={onClose}>
            닫기
          </button>
        </div>
        <p className="al-muted">화물기는 좌석이 없고 짐만 실어요. 화물 운임은 노선 화면의 ‘등급별 운임’에서 정해요.</p>
      </div>
    );
  }

  return (
    <div className="al-cabin" data-testid={`al-cabin-${plane.id}`}>
      <div className="al-cabin-head">
        <h5 className="al-fl-cabin-title">
          <FleetIcon kind="seat" size={16} /> {m.name} 좌석 배치 <small className="al-muted">· {seats}석</small>
        </h5>
        <button type="button" className="btn btn-small btn-ghost" onClick={onClose}>
          닫기
        </button>
      </div>
      <SeatMap model={m} cabin={draft} />
      <div className="al-seat-legend">
        {!fixed && (
          <>
            <span>
              <i style={{ background: CLASS_COLOR.first }} /> 일등석 {draft.first}
            </span>
            <span>
              <i style={{ background: CLASS_COLOR.business }} /> 비즈니스석 {draft.business}
            </span>
            <span>
              <i style={{ background: CLASS_COLOR.economy }} /> 일반석 {y} ({PITCH_INCH[draft.pitch]}인치)
            </span>
          </>
        )}
        {fixed && <span>초음속기는 한 등급(모두 고급 좌석)이라 배치를 바꿀 수 없어요.</span>}
      </div>
      {!fixed && (
        <>
          <div className="al-sort al-cabin-presets" role="group" aria-label="미리 정한 배치">
            {cabinPresets(m).map((pr) => (
              <button key={pr.id} type="button" className={`al-chip${sameCabin(pr.cabin, draft) ? ' al-on' : ''}`} title={pr.desc} onClick={() => setDraft(pr.cabin)}>
                {pr.name} <small>{cabinSeats(m, pr.cabin)}석</small>
              </button>
            ))}
          </div>
          <div className="al-cabin-controls">
            <label>
              <span>일등석</span>
              <Stepper value={draft.first} min={0} max={maxFirst(m, draft)} step={2} onChange={(v) => set('first', v)} disabled={!canFirst(m)} label="일등석" />
              {!canFirst(m) && <small className="al-muted">큰 비행기만</small>}
            </label>
            <label>
              <span>비즈니스석</span>
              <Stepper value={draft.business} min={0} max={maxBusiness(m, draft)} step={m.seats >= 230 ? 4 : 2} onChange={(v) => set('business', v)} disabled={!canBusiness(m)} label="비즈니스석" />
            </label>
            <div className="al-cabin-pitch" role="radiogroup" aria-label="일반석 간격">
              <span>일반석 간격</span>
              {([0, 1, 2] as Pitch[]).map((pt) => (
                <button key={pt} type="button" role="radio" aria-checked={draft.pitch === pt} className={`al-chip${draft.pitch === pt ? ' al-on' : ''}`} onClick={() => set('pitch', pt)}>
                  {PITCH_NAMES[pt]} <small>{PITCH_INCH[pt]}″</small>
                </button>
              ))}
            </div>
          </div>
          <div className="al-cabin-outlook al-fl-outlook">
            {plane.legs.length > 0 ? (
              <>
                <span className="al-fl-out-box">
                  <small>지금 (한 달 노선 이익)</small>
                  <b>{signedMoney(Math.round(outlook.now))}</b>
                  <small className="al-muted">{outlook.seatsNow}석</small>
                </span>
                <svg className="al-fl-out-arrow" width={28} height={16} viewBox="0 0 28 16" aria-hidden="true">
                  <path d="M2 8h22M18 3l6 5-6 5" />
                </svg>
                <span className={`al-fl-out-box ${outlook.next >= outlook.now ? 'al-fl-out-up' : 'al-fl-out-down'}`}>
                  <small>이 배치면</small>
                  <b className={outlook.next >= outlook.now ? 'al-good' : 'al-bad'}>{signedMoney(Math.round(outlook.next))}</b>
                  <small className="al-muted">{outlook.seatsNext}석</small>
                </span>
              </>
            ) : (
              <span className="al-muted">노선에 넣으면 배치에 따른 이익 변화를 미리 보여 줘요.</span>
            )}
          </div>
          <MoreInfo label="고급 좌석과 간격은 어떻게 달라요?">
            고급 좌석은 사업 손님에게 비싸게 팔리고(먼 길일수록), 손님이 우리를 더 골라요. 대신 한 자리가 일반석 여러 개만큼 넓어서 전체 좌석이 줄어요. 일반석이 넓으면 편안해서 손님과 평판이 오르고, 촘촘하면
            좌석이 늘지만 덜 좋아해요.
          </MoreInfo>
          <div className="al-cabin-apply">
            {same.length > 1 && (
              <label className="al-check">
                <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> {m.name} {same.length}대 모두
              </label>
            )}
            <ActButton primary small blocker={blocker} onClick={() => perform({ type: 'setCabin', plane: plane.id, cabin: draft, all })} testId={`al-cabin-apply-${plane.id}`}>
              배치 바꾸기 {cost > 0 ? `· ${fmtMoney(cost)}` : '· 무료'}
              {targets.length > 1 ? ` (${targets.length}대)` : ''}
            </ActButton>
            <small className="al-muted">{free ? '받은 달이라 공짜로 바꿀 수 있어요.' : `받은 달이 지나면 바꿀 때마다 새 값의 2%가 들어요.`}</small>
          </div>
        </>
      )}
      <h5 className="al-meal-title al-fl-cabin-title">
        <FinIcon kind="meal" size={16} /> 기내식
      </h5>
      <div className="al-service-row" role="radiogroup" aria-label="기내식">
        {[1, 2, 3, 4, 5].map((lv) => {
          const o = plane.legs.length > 0 ? mealOutlook(lv) : null;
          return (
            <button
              key={lv}
              type="button"
              role="radio"
              aria-checked={plane.meal === lv}
              className={`al-svc${plane.meal === lv ? ' al-on' : ''}`}
              disabled={!canAct}
              onClick={() => perform({ type: 'setMeal', plane: plane.id, level: lv, all })}
              title={o ? `노선 이익 ${signedMoney(Math.round(o.next))} (평판 변화 빼고)` : undefined}
            >
              <span aria-hidden="true">{MEAL_ICONS[lv]}</span>
              <b>{lv}</b>
              <small>{MEAL_NAMES[lv]}</small>
              <small className="al-muted">비용 ×{MEAL_COST[lv]}</small>
            </button>
          );
        })}
      </div>
      <p className="al-muted al-tip">
        기내식은 언제든 공짜로 바꿀 수 있어요.{same.length > 1 && all ? ` (체크하면 ${same.length}대 모두 바뀌어요)` : ''}
      </p>
      <MoreInfo>좋을수록 손님 한 명당 비용이 늘지만 손님이 우리를 더 고르고 평판이 올라요. 단계마다 아래 ‘비용 ×’는 기본 식사에 견준 손님 한 명당 비용이에요.</MoreInfo>
    </div>
  );
}

/** 좌석만 짧게 (예: '93석 (비즈 17 · 일반 76, 보통)') — 기내식은 따로 아이콘과 함께 쓴다 */
export function cabinSeatText(plane: Plane): string {
  const m = MODEL[plane.model];
  if (isFreighter(m)) return `화물 ${m.cargo}톤`;
  if (fixedCabin(m)) return `${m.seats}석 (한 등급)`;
  const c = plane.cabin;
  const parts = [c.first > 0 ? `일등 ${c.first}` : '', c.business > 0 ? `비즈 ${c.business}` : '', `일반 ${economySeats(m, c)}`].filter(Boolean);
  return `${cabinSeats(m, c)}석 (${parts.join(' · ')}, ${PITCH_NAMES[c.pitch]})`;
}

/** 비행기 카드에 쓰는 한 줄 요약 */
export function cabinSummary(plane: Plane): string {
  const m = MODEL[plane.model];
  if (isFreighter(m)) return `화물 ${m.cargo}톤`;
  if (fixedCabin(m)) return `${m.seats}석 (한 등급) · ${MEAL_ICONS[plane.meal]} ${MEAL_NAMES[plane.meal]}`;
  const c = plane.cabin;
  const parts = [c.first > 0 ? `일등 ${c.first}` : '', c.business > 0 ? `비즈 ${c.business}` : '', `일반 ${economySeats(m, c)}`].filter(Boolean);
  return `${cabinSeats(m, c)}석 (${parts.join(' · ')}, ${PITCH_NAMES[c.pitch]}) · ${MEAL_ICONS[plane.meal]} ${MEAL_NAMES[plane.meal]}`;
}
