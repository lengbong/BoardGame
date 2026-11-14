import { describe, expect, it } from 'vitest';
import { parseRoute } from './useHashRoute';

describe('주소에서 게임 읽기', () => {
  it("'#/게임'만 게임으로 읽는다", () => {
    expect(parseRoute('#/omok')).toBe('omok');
    expect(parseRoute('#/lastcard')).toBe('lastcard');
    expect(parseRoute('')).toBeNull();
    expect(parseRoute('#')).toBeNull();
    expect(parseRoute('#omok')).toBeNull();
    expect(parseRoute('#/omok/extra')).toBeNull();
    expect(parseRoute('#/<script>')).toBeNull();
  });
});
