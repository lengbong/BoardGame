import './industry.css';
import { useState, type ReactNode } from 'react';
import { ChoiceIcon, ICON_DUO, ICON_LINE, IconPicker, type IconChoice } from '../../components/IconPicker';
import { CITY } from './cities';
import { CRISIS_MONTHS } from './rules';
import { FATE, MAX_ACTIVE, PROTECT_MONTHS, YOUNG_MONTHS, aliveCount, industryOn, realHistoryOn } from './industry';
import { MoreInfo } from './StaffArt';
import { mLabel } from './time';
import { CoName } from './ui';
import type { AirlineOptions, AirlineState, IndustryKind } from './types';

/** 연표 한 줄의 그림 글자 */
const KIND_ICON: Record<IndustryKind, string> = {
  enter: '🆕',
  cease: '🛬',
  merge: '🤝',
  rename: '🔁',
  rescue: '⚖️',
  crisis: '🌧️',
  survive: '💪',
  world: '🌍',
};

/** 설정 화면의 '시장 변화' 그림: 줄지어 나는 비행기 셋, 끄면 빗금 */
function IndustryChoiceIcon({ on }: { on: boolean }) {
  return (
    <ChoiceIcon>
      <path d="M4 22l5-1 3-4h2l-1 4 4-1 1-2h1.5l-.5 3-6 1.5 1 4h-2l-3-4-5 .5z" {...ICON_DUO} />
      <path d="M15 12l4-.8 2.4-3.2h1.6l-.8 3.2 3.2-.8.8-1.6h1.2l-.4 2.4-4.8 1.2.8 3.2h-1.6l-2.4-3.2-4 .4z" {...ICON_DUO} />
      <path d="M22 6.5h6M25 3.5v6" {...ICON_LINE} />
      {!on && <path d="M6 6l20 20" {...ICON_LINE} />}
    </ChoiceIcon>
  );
}

const INDUSTRY_CHOICES: IconChoice<'on' | 'off'>[] = [
  { value: 'on', short: '켜기', label: '새 회사가 생기고, 돈이 바닥난 회사는 인수되거나 법정 관리를 받거나 문을 닫아요 (실제 항공사는 실제 역사 무렵에)', icon: <IndustryChoiceIcon on /> },
  { value: 'off', short: '끄기', label: '처음 회사들끼리만 겨뤄요 (돈이 바닥나면 운항을 멈추는 것만)', icon: <IndustryChoiceIcon on={false} /> },
];

/** 설정 화면 '규칙'에 붙는 시장 변화 켜기·끄기 (기본 켜기) */
export function IndustrySetup({ opt, setOpt }: { opt: AirlineOptions; setOpt: (patch: Partial<AirlineOptions>) => void }): ReactNode {
  // 세계 항공사 모드는 실제 항공사가 모두 나오고 역사대로 생기고 사라진다 (world.ts): 이 설정이 없다
  if (opt.world) return null;
  const on = opt.industry !== false;
  const real = opt.names === 'real' && opt.history !== false;
  return (
    <div className="al-ind-setup">
      <IconPicker caption="시장 변화" value={on ? 'on' : 'off'} options={INDUSTRY_CHOICES} onChange={(v) => setOpt({ industry: v === 'on' })} testId="al-industry" />
      <p className="al-note">
        {on
          ? `🆕 빈자리가 생기거나 장사가 잘되면 새 회사(저가항공·화물 전문·새 항공사)가 생겨 동시에 ${MAX_ACTIVE}곳까지 날아요. 돈이 바닥난 컴퓨터 회사는 다른 회사가 사들이거나(우리에게 인수 제안이 오기도 해요) 법정 관리로 한 번 다시 날아요.${real ? ' 실제 항공사는 실제 역사 무렵(팬암 1991, TWA 2001 …)에 위기를 맞고, 그 해에 생긴 항공사(에미레이트 1985, 아시아나 1988 …)가 들어와요.' : ''} 사람 회사는 인수되지 않아요.`
          : '처음 회사들끼리만 겨뤄요. 돈이 4달 모자란 회사는 그대로 운항을 멈춰요.'}
      </p>
    </div>
  );
}

/** 지금 눈여겨볼 회사들 (역사의 위기·법정 관리·돈 걱정·팔리길 기다림·새 회사) */
function watchList(state: AirlineState): { ci: number; text: string; tone: 'bad' | 'warn' | 'info' | 'good' }[] {
  const out: { ci: number; text: string; tone: 'bad' | 'warn' | 'info' | 'good' }[] = [];
  state.companies.forEach((c, ci) => {
    if (c.out) return;
    const fate = c.airline ? FATE[c.airline] : undefined;
    const storm = c.mods.find((m) => m.label.startsWith('📉'));
    if (storm && fate) out.push({ ci, text: `${storm.label} — 실제 역사에서는 ${fate.year}년 ${fate.kind === 'cease' ? '문을 닫았어요' : '다른 회사에 합쳐졌어요'}`, tone: 'bad' });
    if (c.sale) out.push({ ci, text: `${state.companies[c.sale.buyer]?.name ?? '다른 회사'}에 팔리길 기다려요`, tone: 'warn' });
    if (c.rescued !== undefined && state.t - c.rescued <= PROTECT_MONTHS) out.push({ ci, text: `⚖️ 법정 관리 중 (${mLabel(c.rescued)}부터) — 한 번 더 무너지면 문을 닫아요`, tone: 'warn' });
    else if (c.crisis > 0) out.push({ ci, text: `돈이 모자란 지 ${c.crisis}달 (${CRISIS_MONTHS}달이면 위험)`, tone: 'warn' });
    if (c.born !== undefined && state.t - c.born < YOUNG_MONTHS) out.push({ ci, text: `🆕 ${mLabel(c.born)}에 생긴 새 회사 (본사 ${CITY[c.hub].name})`, tone: 'good' });
  });
  return out;
}

/** 뉴스 화면의 '업계 소식' 카드: 지금 나는 회사 수, 눈여겨볼 회사, 업계 연표 */
export function IndustryCard({ state }: { state: AirlineState }) {
  const [all, setAll] = useState(false);
  const log = state.industry ?? [];
  if (state.options.world || (!industryOn(state) && log.length === 0)) return null;
  const watch = watchList(state);
  const shown = [...log].reverse().slice(0, all ? log.length : 6);
  const alive = aliveCount(state);
  return (
    <section className="al-card al-ind" data-testid="al-industry-card" aria-labelledby="al-ind-title">
      <h3 className="al-ind-title" id="al-ind-title">
        <span aria-hidden="true">🏢</span> 업계 소식
        <small className="al-muted">
          지금 나는 회사 {alive}/{MAX_ACTIVE}
          {industryOn(state) ? '' : ' · 시장 변화 꺼짐'}
        </small>
      </h3>
      {watch.length > 0 && (
        <ul className="al-ind-watch" aria-label="눈여겨볼 회사">
          {watch.map((w, k) => (
            <li key={k} className={`al-ind-tone-${w.tone}`}>
              <CoName c={state.companies[w.ci]} noIata /> <span>{w.text}</span>
            </li>
          ))}
        </ul>
      )}
      {shown.length === 0 ? (
        <p className="al-muted al-ind-empty">아직 업계에 큰 일이 없어요. 새 회사가 생기거나 문을 닫는 회사가 있으면 여기에 적혀요.</p>
      ) : (
        <ol className="al-ind-log" aria-label="업계 연표 (최근 것부터)">
          {shown.map((e, k) => (
            <li key={`${e.t}-${k}`}>
              <span className="al-ind-when">{mLabel(e.t)}</span>
              <span aria-hidden="true">{KIND_ICON[e.kind] ?? '•'}</span>
              <span className="al-ind-text">{e.text}</span>
            </li>
          ))}
        </ol>
      )}
      {log.length > 6 && (
        <button type="button" className="btn btn-small btn-ghost al-ind-more" onClick={() => setAll(!all)} aria-expanded={all}>
          {all ? '최근 것만' : `연표 모두 보기 (${log.length})`}
        </button>
      )}
      <MoreInfo label="새 회사·파산·인수는 어떻게 일어나요?">
        <ul className="al-ind-help">
          <li>동시에 {MAX_ACTIVE}곳까지 날아요. 문을 닫은 회사가 남긴 빈자리는 반년쯤 지나면 새 회사가 노리고, 장사가 잘되는 시절(규제가 풀린 1978년 뒤·저가항공 붐)에도 가끔 새 회사가 생겨요. 하늘이 붐빌수록 덜 생겨요.</li>
          <li>돈이 {CRISIS_MONTHS}달 내내 모자란 컴퓨터 회사는 ① 돈이 넉넉한 사람 회사에 인수 제안(결정할 일) ② 다른 컴퓨터가 싸게 인수 ③ 법정 관리(빚을 줄이고 손해 노선·쉬는 비행기 정리, 한 번만) ④ 운항 중단 순서로 정해져요. 사람 회사는 그대로 운항을 멈추고, 인수되지는 않아요.</li>
          <li>새로 생긴 회사는 {YOUNG_MONTHS / 12}년 동안 컴퓨터가 주식으로 사들이지 않고, 회사를 합친 컴퓨터는 몇 해 동안 다른 회사를 사냥하지 않아요.</li>
          {realHistoryOn(state) && (
            <li>실제 항공사는 실제 역사의 그 해 18달 전부터 손님이 줄고 비용이 늘어요. 그 달에 돈이 모자라거나 적자면 역사대로 문을 닫거나 합쳐지고, 튼튼하면 살아남아요. 그 해에 생긴 실제 항공사는 자리가 있으면 들어와요 (경영은 모두 게임 속 이야기).</li>
          )}
        </ul>
      </MoreInfo>
    </section>
  );
}
