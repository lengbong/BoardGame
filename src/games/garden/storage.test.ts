import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { DEFAULT_OPTIONS, applyAction, createGame } from './rules';
import { parseOptions, validateSavedState } from './storage';
import type { GardenSetup } from './types';

const setup: GardenSetup = {
  seats: [
    { kind: 'human', name: '지우' },
    { kind: 'ai-normal', name: '' },
    { kind: 'ai-easy', name: '' },
    { kind: 'empty', name: '' },
  ],
  options: DEFAULT_OPTIONS,
};

describe('저장 검사', () => {
  it('옵션은 모르는 값이면 기본값으로', () => {
    expect(parseOptions(undefined)).toEqual({ target: 15, sale: true, ribbons: true });
    expect(parseOptions({ target: 18, sale: false, ribbons: false })).toEqual({ target: 18, sale: false, ribbons: false });
    expect(parseOptions({ target: 99 }).target).toBe(15);
  });

  it('진행 중인 게임은 JSON을 거쳐도 올바른 저장으로 인정한다', () => {
    let s = createGame(setup, seededRandom(2));
    s = applyAction(s, { type: 'harvest', line: 'r0' }, seededRandom(3));
    expect(validateSavedState(JSON.parse(JSON.stringify(s)))).toBe(true);
  });

  it('카드가 겹치거나 토큰 수가 틀린 저장은 버린다', () => {
    const s = createGame(setup, seededRandom(2));
    const dup = structuredClone(s);
    dup.players[0].garden.push(dup.market[0]);
    expect(validateSavedState(dup)).toBe(false);
    const extra = structuredClone(s);
    extra.players[0].tokens.water += 1;
    expect(validateSavedState(extra)).toBe(false);
    const over = structuredClone(s);
    over.phase = 'gameover';
    expect(validateSavedState(over)).toBe(false);
    expect(validateSavedState(null)).toBe(false);
  });
});
