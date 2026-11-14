import { describe, expect, it } from 'vitest';
import { seededRandom } from '../lib/random';
import type { Seats } from '../games/common/players';
import * as race from '../games/race/rules';
import { chooseMove as raceMove } from '../games/race/ai';
import * as world from '../games/world/rules';
import { decideAction as worldAct } from '../games/world/ai';
import * as lc from '../games/lastcard/rules';
import { decideAction as lcAct } from '../games/lastcard/ai';
import * as tiles from '../games/tiles/rules';
import { planMove as tilesPlan } from '../games/tiles/ai';
import * as sevens from '../games/sevens/rules';
import { decideAction as svAct } from '../games/sevens/ai';

type L = 'ai-easy' | 'ai-normal';
const seats = (g: number): Seats => {
  const normalFirst = g % 2 === 0;
  return [0, 1, 2, 3].map((i) => ({ kind: (i % 2 === 0) === normalFirst ? 'ai-normal' : 'ai-easy', name: '' })) as Seats;
};
/** 보통 2명 + 쉬움 2명이 겨뤄서 보통이 1등한 비율 (자리는 판마다 바꾼다. 실력 차가 없으면 0.5) */
function tally(_name: string, games: number, play: (g: number) => { kinds: string[]; winner: number }): number {
  let normal = 0;
  for (let g = 0; g < games; g++) {
    const r = play(g);
    if (r.kinds[r.winner] === 'ai-normal') normal++;
  }
  return normal / games;
}

/**
 * 컴퓨터 실력 점검: 운이 크게 작용하는 4인 게임에서도 '보통'이 '쉬움'보다 자주 1등을 하는지.
 * (2인 게임과 나머지 게임은 각 게임의 ai.test.ts에서 따로 확인한다)
 * 잰 값: 말판 경주 82%, 지구 한 바퀴 98%, 한 장 남았다! 68%, 숫자 타일 95%, 칠 이어놓기 59%
 */
describe('컴퓨터 실력: 보통이 쉬움보다 자주 이긴다', () => {
  const rate: Record<string, number> = {};
  it('다섯 게임을 여러 판 돌려 본다', () => {
  const RACE_RULES = (race as unknown as Record<string, unknown>).CLASSIC_RULES ?? (race as unknown as Record<string, unknown>).DEFAULT_RULES;
  rate['말판 경주'] = tally('말판 경주', 200, (g) => {
    const rng = seededRandom(g + 1);
    let s = race.createGame({ seats: seats(g), rules: RACE_RULES as never }, rng);
    let n = 0;
    while (s.rankings.length === 0 && n++ < 40000) {
      if (s.phase === 'rolling') s = race.applyRoll(s, race.rollDieValue(rng));
      else if (s.phase === 'passing') s = race.advanceTurn(s);
      else s = race.applyMove(s, raceMove(s, race.legalMoves(s), s.players[s.current].kind as L, rng));
    }
    return { kinds: s.players.map((p) => p.kind), winner: s.rankings[0] };
  });
  rate['지구 한 바퀴'] = tally('지구 한 바퀴', 80, (g) => {
    const rng = seededRandom(g + 1);
    let s = world.createGame({ seats: seats(g), options: world.DEFAULT_OPTIONS }, rng);
    let n = 0;
    while (s.phase !== 'gameover' && n++ < 60000) s = world.applyAction(s, worldAct(s, s.players[s.current].kind as L, rng), [world.rollDie(rng), world.rollDie(rng)]);
    return { kinds: s.players.map((p) => p.kind), winner: s.rankings[0] };
  });
  rate['한 장 남았다!'] = tally('한 장 남았다!', 200, (g) => {
    const rng = seededRandom(g + 1);
    let s = lc.createGame({ seats: seats(g), options: lc.DEFAULT_OPTIONS }, rng);
    let n = 0;
    while (s.phase !== 'gameover' && n++ < 8000) s = lc.applyAction(s, lcAct(s, s.players[s.current].kind as L, rng), rng);
    return { kinds: s.players.map((p) => p.kind), winner: s.rankings[0] };
  });
  rate['숫자 타일'] = tally('숫자 타일', 60, (g) => {
    const rng = seededRandom(g + 1);
    let s = tiles.createGame({ seats: seats(g), options: tiles.DEFAULT_OPTIONS }, rng);
    let n = 0;
    while (s.phase !== 'gameover' && n++ < 4000) s = tiles.applyAction(s, tilesPlan(s, s.players[s.current].kind as L, rng), rng);
    return { kinds: s.players.map((p) => p.kind), winner: s.rankings[0] };
  });
  rate['칠 이어놓기'] = tally('칠 이어놓기', 200, (g) => {
    const rng = seededRandom(g + 1);
    let s = sevens.createGame({ seats: seats(g), options: sevens.DEFAULT_OPTIONS }, rng);
    let n = 0;
    while (s.phase !== 'gameover' && n++ < 8000) s = sevens.applyAction(s, svAct(s, s.players[s.current].kind as L, rng), rng);
    return { kinds: s.players.map((p) => p.kind), winner: s.rankings[0] };
  });
    expect(rate['말판 경주']).toBeGreaterThan(0.65);
    expect(rate['지구 한 바퀴']).toBeGreaterThan(0.8);
    expect(rate['한 장 남았다!']).toBeGreaterThan(0.55);
    expect(rate['숫자 타일']).toBeGreaterThan(0.8);
    expect(rate['칠 이어놓기']).toBeGreaterThan(0.52);
  }, 120_000);
});
