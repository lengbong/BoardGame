import type { Advice } from './advisor';
import { BIZ_INFO, bizModelOf, lccEra } from './bizmodel';
import { CARGO_FARE_MAX, CARGO_FARE_MIN } from './cargo';
import { CLASS_FARE_MAX, CLASS_FARE_MIN } from './classes';
import { CITY } from './cities';
import { fareText, fmtMoney } from './format';
import { applyAction } from './rules';
import { estimateExisting, legFreq, routeFares, type Fares } from './simulate';
import { yearOf } from './time';
import type { AirlineState, Route } from './types';

/**
 * 경영 비서의 4판 조언: 등급별 운임(고급 좌석이 꽉 차거나 많이 빌 때)·화물 운임, 사업 모델 안내.
 * advisor.ts가 다른 조언과 함께 무게 순으로 고른다.
 */

const KEY_NAME = { f: '일등석', c: '비즈니스석', k: '화물' } as const;

const routeName = (r: Route) => `${CITY[r.a]?.name ?? r.a}–${CITY[r.b]?.name ?? r.b}`;

export function classAdvice(state: AirlineState, ci: number): Advice[] {
  const c = state.companies[ci];
  const out: Advice[] = [];
  // 1. 등급·화물 운임: 수입이 큰 노선마다 비즈니스석·일등석·화물 운임을 ±5·10%씩 어림해 보고, 이익이 늘면 한꺼번에 바꾸기
  const routes = c.routes
    .filter((r) => r.stats && (r.stats.cls || r.stats.cargo) && c.planes.some((p) => legFreq(p, r.id) > 0))
    .sort((x, y) => (y.stats?.revenue ?? 0) - (x.stats?.revenue ?? 0))
    .slice(0, 16);
  const changes: { r: Route; fares: Partial<Fares>; text: string; gain: number }[] = [];
  for (const r of routes) {
    const st = r.stats!;
    const cur = routeFares(r);
    const has = { f: (st.cls?.seats[0] ?? 0) > 0, c: (st.cls?.seats[1] ?? 0) > 0, k: (st.cargo?.cap ?? 0) > 0 };
    let best: Partial<Fares> = {};
    const now = estimateExisting(state, ci, r).profit;
    let bestProfit = now;
    for (const k of ['c', 'f', 'k'] as const) {
      if (!has[k]) continue;
      const [lo, hi] = k === 'k' ? [CARGO_FARE_MIN, CARGO_FARE_MAX] : [CLASS_FARE_MIN, CLASS_FARE_MAX];
      const base = best[k] ?? cur[k];
      for (const v of [base - 10, base - 5, base + 5, base + 10]) {
        if (v < lo || v > hi) continue;
        const f: Partial<Fares> = { ...best, [k]: v };
        const p = estimateExisting(state, ci, r, { fares: f }).profit;
        if (p > bestProfit + 0.05) {
          bestProfit = p;
          best = f;
        }
      }
    }
    const gain = bestProfit - now;
    if (gain < 0.2) continue;
    const text = (['c', 'f', 'k'] as const)
      .filter((k) => best[k] !== undefined)
      .map((k) => `${KEY_NAME[k]} ${fareText(cur[k])}→${fareText(best[k]!)}`)
      .join(', ');
    changes.push({ r, fares: best, text, gain });
  }
  if (changes.length > 0) {
    changes.sort((x, y) => y.gain - x.gain);
    const total = changes.reduce((sum, x) => sum + x.gain, 0);
    const lfs = changes
      .slice(0, 2)
      .map((x) => `${routeName(x.r)} (${x.text})`)
      .join(' · ');
    out.push({
      key: 'cls-fares',
      icon: '💺',
      title: changes.length > 1 ? `등급별 운임 맞추기 (노선 ${changes.length}개)` : `${routeName(changes[0].r)} 등급별 운임 맞추기`,
      detail: `고급 좌석·화물칸이 꽉 차거나 비는 노선의 등급별 운임을 고치면 달 이익 약 +${fmtMoney(total)}: ${lfs}${changes.length > 2 ? ' …' : ''}. 노선 화면 ‘등급별 운임’의 💡 추천 운임으로 더 자세히 맞출 수 있어요.`,
      gain: total,
      label: '운임 맞추기',
      apply: (s) => {
        let t = s;
        for (const x of changes) for (const k of ['c', 'f', 'k'] as const) if (x.fares[k] !== undefined) t = applyAction(t, { type: 'setFare', route: x.r.id, fare: x.fares[k]!, cls: k });
        return t;
      },
      weight: 170 + total * 2,
    });
  }
  // 2. 사업 모델 안내 (첫해, 저가항공·화물 전문일 때 한 번)
  const model = bizModelOf(c);
  const year = yearOf(state.q);
  if (model !== 'full' && state.t - state.startT < 3 && c.routes.length <= 1) {
    out.push({
      key: `biz-${model}`,
      icon: BIZ_INFO[model].icon,
      title: model === 'lcc' ? '저가항공은 가깝고 손님 많은 노선부터' : '화물 전문은 무역 도시 사이 먼 노선부터',
      detail:
        model === 'lcc'
          ? `한 등급 촘촘한 좌석과 싼 비용으로 5,000km 안쪽 관광 노선에서 강해요. 운임을 조금 낮춰도 버틸 수 있어요.${lccEra(year) < 0.3 ? ' 아직 규제가 다 풀리지 않아 싼 표 손님이 적어요.' : ''}`
          : '홍콩·프랑크푸르트·싱가포르·두바이·도쿄·서울·시카고처럼 짐이 많은 도시 사이가 좋아요. 화물은 10~12월에 가장 많고 기름값이 오르면 줄어요.',
      weight: 85,
    });
  }
  return out;
}
