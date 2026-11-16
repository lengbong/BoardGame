import { describe, expect, it } from 'vitest';
import { axisMoney, fmtFine, fmtMoney, fmtPax, km, manwon, signedMoney } from './format';

describe('돈·숫자 글', () => {
  it('아주 작은 손해는 반올림해도 ‘-0’으로 보이지 않는다', () => {
    expect(fmtMoney(-0.3)).toBe('0억');
    expect(fmtMoney(-0.0001)).toBe('0억');
    expect(fmtFine(-0.00001)).toBe('0만 원');
    expect(fmtFine(-0.004)).toBe('-40만 원');
    expect(signedMoney(-0.3)).toBe('0억');
    expect(fmtPax(-0.2)).toBe('0명');
    expect(km(-0.2)).toBe('0km');
    expect(manwon(-0.2)).toBe('0만 원');
    expect(axisMoney(-0.2)).toBe('0');
  });

  it('보통 돈은 그대로 읽기 좋게', () => {
    expect(fmtMoney(1234.4)).toBe('1,234억');
    expect(fmtMoney(-12.6)).toBe('-13억');
    expect(fmtMoney(15000)).toBe('1.5조');
    expect(fmtFine(0.32)).toBe('3,200만 원');
    expect(fmtFine(2.44)).toBe('2.4억');
  });
});
