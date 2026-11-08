import { describe, expect, it } from 'vitest';
import { decideAction } from './ai';
import { BOARD_LENGTH, PLANE_SQUARE, SQUARES, STUCK_SQUARE, buildCost, rentFor, squareGridPosition } from './board';
import {
  DEFAULT_OPTIONS,
  applyAction,
  applyBuild,
  applyBuy,
  applyCard,
  applyDecline,
  applyRoll,
  applySelect,
  buyOptions,
  createGame,
  rollDie,
  totalAssets,
} from './rules';
import type { SeatKind } from '../common/players';
import type { CardId, EndMode, WorldOptions, WorldState } from './types';

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function game(kinds: SeatKind[] = ['human', 'human', 'empty', 'empty'], options: Partial<WorldOptions> = {}): WorldState {
  return createGame(
    {
      seats: kinds.map((kind, i) => ({ kind, name: `P${i}` })) as never,
      options: { ...DEFAULT_OPTIONS, ...options },
    },
    () => 0,
  );
}

/** 현재 플레이어를 특정 칸 바로 앞에 두고 굴린다 */
function landOn(state: WorldState, target: number, a = 1, b = 2): WorldState {
  const s = structuredClone(state);
  s.players[s.current].position = (target - (a + b) + BOARD_LENGTH) % BOARD_LENGTH;
  return applyRoll(s, a, b);
}

function withCard(state: WorldState, card: CardId): WorldState {
  const s = structuredClone(state);
  s.deck = [card];
  s.deckIndex = 0;
  return s;
}

describe('판', () => {
  it('32칸이고 도시 22개, 여행 카드 4칸', () => {
    expect(SQUARES).toHaveLength(32);
    expect(SQUARES.filter((s) => s.kind === 'city')).toHaveLength(22);
    expect(SQUARES.filter((s) => s.kind === 'card')).toHaveLength(4);
    SQUARES.forEach((s, i) => expect(s.index).toBe(i));
  });

  it('칸 위치는 9×9 테두리에 겹치지 않게 놓인다', () => {
    const cells = SQUARES.map((s) => squareGridPosition(s.index));
    expect(new Set(cells.map((c) => `${c.row},${c.col}`)).size).toBe(32);
    for (const c of cells) expect(c.row === 0 || c.row === 8 || c.col === 0 || c.col === 8).toBe(true);
  });

  it('통행료는 건물 단계가 높을수록, 축제면 2배', () => {
    const paris = SQUARES[28];
    expect(rentFor(paris, 0, false)).toBeLessThan(rentFor(paris, 1, false));
    expect(rentFor(paris, 3, true)).toBe(rentFor(paris, 3, false) * 2);
  });
});

describe('주사위와 이동', () => {
  it('주사위 합만큼 이동하고 도시에 도착하면 살지 묻는다', () => {
    const s = applyRoll(game(), 1, 2);
    expect(s.players[0].position).toBe(3);
    expect(s.phase).toBe('buy');
    expect(s.lastMove?.path).toEqual([1, 2, 3]);
  });

  it('출발 칸을 지나면 월급을 받는다', () => {
    const s0 = game();
    s0.players[0].position = 30;
    const s = applyRoll(s0, 2, 3); // 30 → 3
    expect(s.players[0].position).toBe(3);
    expect(s.players[0].cash).toBe(DEFAULT_OPTIONS.startCash + DEFAULT_OPTIONS.salary);
  });

  it('더블이면 한 번 더, 세 번 연속이면 여권 분실 칸', () => {
    let s = landOn(game(), 4, 2, 2); // 하노이
    s = applyDecline(s);
    expect(s.current).toBe(0);
    expect(s.phase).toBe('rolling');
    s = applyDecline(landOn(s, 10, 3, 3));
    expect(s.current).toBe(0);
    s = applyRoll(s, 1, 1);
    expect(s.players[0].position).toBe(STUCK_SQUARE);
    expect(s.players[0].stuckTurns).toBe(2);
    expect(s.current).toBe(1);
  });
});

describe('도시 사기와 통행료', () => {
  it('땅만 사거나 건물까지 함께 살 수 있다', () => {
    let s = landOn(game(), 28); // 파리 280
    const options = buyOptions(s);
    expect(options.map((o) => o.cost)).toEqual([280, 420, 560, 700]);
    s = applyBuy(s, 2);
    expect(s.properties[28]).toEqual({ owner: 0, level: 2 });
    expect(s.players[0].cash).toBe(1500 - 560);
    expect(s.current).toBe(1);
  });

  it('돈이 모자라면 살 수 없다', () => {
    const s0 = game();
    s0.players[0].cash = 50;
    const s = landOn(s0, 28);
    expect(s.phase).toBe('rolling');
    expect(s.properties[28]!.owner).toBe(null);
  });

  it('남의 도시에 가면 통행료를 낸다', () => {
    const s0 = game();
    s0.properties[28] = { owner: 1, level: 1 };
    const s = landOn(s0, 28);
    const rent = rentFor(SQUARES[28], 1, false);
    expect(s.players[0].cash).toBe(1500 - rent);
    expect(s.players[1].cash).toBe(1500 + rent);
  });

  it('무료 통행권이 있으면 통행료를 안 낸다', () => {
    const s0 = game();
    s0.properties[28] = { owner: 1, level: 3 };
    s0.players[0].freePasses = 1;
    const s = landOn(s0, 28);
    expect(s.players[0].cash).toBe(1500);
    expect(s.players[0].freePasses).toBe(0);
  });

  it('내 도시에 다시 오면 건물을 올릴 수 있다', () => {
    const s0 = game();
    s0.properties[28] = { owner: 0, level: 1 };
    let s = landOn(s0, 28);
    expect(s.phase).toBe('build');
    s = applyBuild(s, 3);
    expect(s.properties[28]!.level).toBe(3);
    expect(s.players[0].cash).toBe(1500 - buildCost(SQUARES[28]) * 2);
  });
});

describe('특수 칸', () => {
  it('여권 분실: 2번 쉬고 3번째 차례에 움직인다', () => {
    let s = landOn(game(), STUCK_SQUARE);
    expect(s.players[0].stuckTurns).toBe(2);
    s = applyRoll(s, 1, 2); // P1 차례
    s = applyDecline(s);
    s = applyRoll(s, 1, 3); // P0: 쉬기 1
    expect(s.players[0].position).toBe(STUCK_SQUARE);
    s = applyDecline(applyRoll(s, 2, 3)); // P1
    s = applyRoll(s, 2, 4); // P0: 쉬기 2
    expect(s.players[0].stuckTurns).toBe(0);
    expect(s.players[0].position).toBe(STUCK_SQUARE);
  });

  it('여권 분실 중 더블이면 바로 탈출한다', () => {
    const s0 = game();
    s0.players[0].position = STUCK_SQUARE;
    s0.players[0].stuckTurns = 2;
    const s = applyRoll(s0, 2, 2);
    expect(s.players[0].position).toBe(12);
    expect(s.players[0].stuckTurns).toBe(0);
  });

  it('세계 축제: 내 도시를 골라 통행료 2배', () => {
    const s0 = game();
    s0.properties[3] = { owner: 0, level: 0 };
    let s = landOn(s0, 16);
    expect(s.phase).toBe('select-festival');
    expect(applySelect(s, 4)).toBe(s); // 내 도시가 아니면 무시
    s = applySelect(s, 3);
    expect(s.festivalSquare).toBe(3);
  });

  it('비행기: 원하는 칸으로 날아가고 출발을 지나면 월급', () => {
    let s = landOn(game(), PLANE_SQUARE);
    expect(s.phase).toBe('select-plane');
    s = applySelect(s, 3);
    expect(s.players[0].position).toBe(3);
    expect(s.players[0].cash).toBe(1500 + 200);
    expect(s.phase).toBe('buy');
  });

  it('세금 칸에서는 돈을 낸다', () => {
    const s = landOn(game(), 5);
    expect(s.players[0].cash).toBe(1500 - 50);
  });
});

describe('여행 카드', () => {
  it('돈 받기', () => {
    let s = landOn(withCard(game(), 'lottery'), 2, 1, 1); // 출발 칸에서 1+1 (월급 없이)
    expect(s.phase).toBe('card');
    expect(s.pendingCard).toBe('lottery');
    s = applyCard(s);
    expect(s.players[0].cash).toBe(1650);
  });

  it('생일: 모두에게 받기', () => {
    const s = applyCard(landOn(withCard(game(['human', 'human', 'human', 'empty']), 'birthday'), 2, 1, 1));
    expect(s.players[0].cash).toBe(1560);
    expect(s.players[1].cash).toBe(1470);
  });

  it('뒤로 3칸', () => {
    const s = applyCard(landOn(withCard(game(), 'back3'), 11));
    expect(s.players[0].position).toBe(STUCK_SQUARE);
    expect(s.players[0].stuckTurns).toBe(2);
  });

  it('다음 도시로 이동', () => {
    const s = applyCard(landOn(withCard(game(), 'next-city'), 27));
    expect(s.players[0].position).toBe(28);
    expect(s.phase).toBe('buy');
  });

  it('여권 재발급 카드는 갇혔을 때 자동으로 쓴다', () => {
    let s = applyCard(landOn(withCard(game(), 'escape'), 2));
    expect(s.players[0].escapeCards).toBe(1);
    s = structuredClone(s);
    s.current = 0;
    s.phase = 'rolling';
    s.players[0].position = STUCK_SQUARE;
    s.players[0].stuckTurns = 2;
    s = applyRoll(s, 1, 2);
    expect(s.players[0].position).toBe(11);
    expect(s.players[0].escapeCards).toBe(0);
  });

  it('비행기 칸으로 가는 카드', () => {
    const s = applyCard(landOn(withCard(game(), 'go-plane'), 18));
    expect(s.players[0].position).toBe(PLANE_SQUARE);
    expect(s.phase).toBe('select-plane');
  });
});

describe('파산과 게임 끝', () => {
  it('돈이 모자라면 건물을 팔고, 그래도 모자라면 파산', () => {
    const s0 = game();
    s0.properties[31] = { owner: 1, level: 3 }; // 뉴욕 호텔: 875
    s0.players[0].cash = 100;
    s0.properties[1] = { owner: 0, level: 1 };
    const s = landOn(s0, 31);
    expect(s.players[0].bankrupt).toBe(true);
    expect(s.properties[1]).toEqual({ owner: null, level: 0 });
    expect(s.phase).toBe('gameover');
    expect(s.rankings).toEqual([1, 0]);
  });

  it('건물을 팔아서 낼 수 있으면 파산하지 않는다', () => {
    const s0 = game();
    s0.properties[3] = { owner: 1, level: 0 }; // 이스탄불 통행료 14
    s0.players[0].cash = 5;
    s0.properties[31] = { owner: 0, level: 2 };
    const s = landOn(s0, 3);
    expect(s.players[0].bankrupt).toBe(false);
    expect(s.properties[31]!.level).toBe(1);
  });

  it('라운드 제한이 끝나면 총자산으로 순위', () => {
    let s = game(['human', 'human', 'empty', 'empty'], { endMode: 'rounds', maxRounds: 1 });
    s.players[1].cash = 3000;
    s = applyDecline(landOn(s, 3)); // P0
    expect(s.current).toBe(1);
    s = applyDecline(landOn(s, 4)); // P1 → 라운드 끝
    expect(s.phase).toBe('gameover');
    expect(s.rankings[0]).toBe(1);
  });

  it('한 명 파산하면 끝 모드', () => {
    const s0 = game(['human', 'human', 'human', 'empty'], { endMode: 'first-bankrupt' });
    s0.properties[31] = { owner: 1, level: 3 };
    s0.players[0].cash = 10;
    const s = landOn(s0, 31);
    expect(s.phase).toBe('gameover');
    expect(s.rankings[s.rankings.length - 1]).toBe(0);
  });
});

describe('전체 게임 시뮬레이션', () => {
  const modes: [EndMode, number][] = [
    ['rounds', 20],
    ['first-bankrupt', 0],
    ['last-standing', 0],
  ];
  for (const [endMode, maxRounds] of modes) {
    it(`컴퓨터 4명이 '${endMode}' 모드로 끝까지 게임을 마친다`, () => {
      const rounds: number[] = [];
      for (let seed = 1; seed <= 25; seed++) {
        const rng = seeded(seed);
        let s = createGame(
          {
            seats: [
              { kind: 'ai-normal', name: 'A' },
              { kind: 'ai-easy', name: 'B' },
              { kind: 'ai-normal', name: 'C' },
              { kind: 'ai-easy', name: 'D' },
            ],
            options: { ...DEFAULT_OPTIONS, endMode, maxRounds: maxRounds || 20 },
          },
          rng,
        );
        let steps = 0;
        while (s.phase !== 'gameover') {
          if (++steps > 50000) throw new Error(`seed ${seed}: 게임이 끝나지 않음 (round ${s.round})`);
          const p = s.players[s.current];
          const action = decideAction(s, p.kind === 'ai-easy' ? 'ai-easy' : 'ai-normal', rng);
          const next = applyAction(s, action, [rollDie(rng), rollDie(rng)]);
          if (next === s) throw new Error(`seed ${seed}: 행동이 적용되지 않음 ${JSON.stringify(action)} in ${s.phase}`);
          s = next;
          // 돈이 음수가 되면 안 된다
          for (const pl of s.players) expect(pl.cash).toBeGreaterThanOrEqual(0);
        }
        expect([...s.rankings].sort()).toEqual([0, 1, 2, 3]);
        expect(totalAssets(s, s.rankings[0])).toBeGreaterThanOrEqual(0);
        rounds.push(s.round);
      }
      const avg = rounds.reduce((a, b) => a + b, 0) / rounds.length;
      console.log(`${endMode}: 평균 ${avg.toFixed(1)}라운드 (최소 ${Math.min(...rounds)}, 최대 ${Math.max(...rounds)})`);
      if (endMode === 'rounds') expect(Math.max(...rounds)).toBe(20);
    });
  }
});
