import { PLANE_SQUARE, SQUARES, STUCK_SQUARE, buildCost } from './board';
import { buildOptions, buyOptions, ownedSquares, rentAt, selectableSquares } from './rules';
import type { Rng, WorldAction, WorldState } from './types';

export type AiLevel = 'ai-easy' | 'ai-normal';

/** 남겨 둘 비상금: 상대 도시 중 가장 비싼 통행료의 일부 */
function reserve(state: WorldState): number {
  let maxRent = 0;
  state.properties.forEach((prop, i) => {
    if (prop && prop.owner !== null && prop.owner !== state.current) maxRent = Math.max(maxRent, rentAt(state, i));
  });
  return Math.max(150, Math.round(maxRent * 0.6));
}

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

/** 비행기로 갈 칸의 점수 (높을수록 좋음) */
function planeScore(state: WorldState, index: number): number {
  const me = state.current;
  const player = state.players[me];
  const sq = SQUARES[index];
  let score = index < PLANE_SQUARE ? state.options.salary : 0; // 출발 칸을 지나면 월급
  switch (sq.kind) {
    case 'city': {
      const prop = state.properties[index]!;
      if (prop.owner === null) score += player.cash >= sq.price! ? 60 + sq.price! * 0.5 : -10;
      else if (prop.owner === me) score += prop.level < 3 && player.cash >= buildCost(sq) ? 30 + buildCost(sq) * 0.4 : 0;
      else score -= rentAt(state, index);
      break;
    }
    case 'card':
      score += 20;
      break;
    case 'tax':
      score -= sq.tax!;
      break;
    case 'festival':
      score += ownedSquares(state, me).length > 0 ? 50 : 0;
      break;
    case 'stuck':
      score -= 300;
      break;
    default:
      break;
  }
  return score;
}

/** 컴퓨터가 지금 할 행동을 정한다. */
export function decideAction(state: WorldState, level: AiLevel, rng: Rng = Math.random): WorldAction {
  const player = state.players[state.current];
  const easy = level === 'ai-easy';

  switch (state.phase) {
    case 'rolling':
      return { type: 'roll' };
    case 'card':
      return { type: 'card' };
    case 'buy': {
      const options = buyOptions(state).filter((o) => o.affordable);
      if (easy) {
        if (rng() < 0.25) return { type: 'decline' };
        const cheap = options.filter((o) => o.levels <= 1);
        return { type: 'buy', levels: pick(cheap, rng).levels };
      }
      const keep = reserve(state);
      const ok = options.filter((o) => player.cash - o.cost >= keep);
      if (ok.length === 0) {
        // 비상금이 모자라도 싼 땅은 사 둔다
        return options[0] && player.cash - options[0].cost >= 50 && options[0].cost <= 120
          ? { type: 'buy', levels: 0 }
          : { type: 'decline' };
      }
      return { type: 'buy', levels: ok[ok.length - 1].levels };
    }
    case 'build': {
      const options = buildOptions(state).filter((o) => o.affordable);
      if (easy) return rng() < 0.5 && options.length > 0 ? { type: 'build', levels: options[0].levels } : { type: 'decline' };
      const keep = reserve(state);
      const ok = options.filter((o) => player.cash - o.cost >= keep);
      return ok.length > 0 ? { type: 'build', levels: ok[ok.length - 1].levels } : { type: 'decline' };
    }
    case 'select-festival': {
      const mine = selectableSquares(state);
      if (easy) return { type: 'select', index: pick(mine, rng) };
      const best = mine.reduce((a, b) => (rentAt({ ...state, festivalSquare: b }, b) > rentAt({ ...state, festivalSquare: a }, a) ? b : a));
      return { type: 'select', index: best };
    }
    case 'select-plane': {
      const targets = selectableSquares(state).filter((i) => i !== STUCK_SQUARE);
      if (easy) return { type: 'select', index: pick(targets, rng) };
      const best = targets.reduce((a, b) => (planeScore(state, b) > planeScore(state, a) ? b : a));
      return { type: 'select', index: best };
    }
    default:
      return { type: 'roll' };
  }
}
