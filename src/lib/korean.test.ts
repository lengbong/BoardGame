import { describe, expect, it } from 'vitest';
import { withJosa } from './korean';

describe('조사 붙이기', () => {
  it('받침에 맞춰 이/가, 은/는, 을/를을 붙인다', () => {
    expect(withJosa('빨강', '이/가')).toBe('빨강이');
    expect(withJosa('노랑', '은/는')).toBe('노랑은');
    expect(withJosa('하마', '이/가')).toBe('하마가');
    expect(withJosa('토끼', '을/를')).toBe('토끼를');
  });

  it('와/과는 받침이 없으면 와, 있으면 과', () => {
    expect(withJosa('케이블카', '와/과')).toBe('케이블카와');
    expect(withJosa('당근', '와/과')).toBe('당근과');
  });

  it('으로/로는 ㄹ 받침 뒤에서도 로', () => {
    expect(withJosa('서울', '으로/로')).toBe('서울로');
    expect(withJosa('부산', '으로/로')).toBe('부산으로');
    expect(withJosa('파리', '으로/로')).toBe('파리로');
  });

  it('한글이 아니면 둘 다 보여 준다', () => {
    expect(withJosa('AI', '이/가')).toBe('AI이(가)');
  });
});
