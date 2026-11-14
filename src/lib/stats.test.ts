import { describe, expect, it } from 'vitest';
import { addOutcome, soloOutcome, statsText } from './stats';

describe('전적 기록', () => {
  it('사람이 한 명일 때만 센다', () => {
    expect(soloOutcome(['human', 'ai-normal'], [0])).toBe('win');
    expect(soloOutcome(['human', 'ai-normal'], [1])).toBe('loss');
    expect(soloOutcome(['human', 'ai-normal'], [null])).toBe('draw');
    expect(soloOutcome(['human', 'human'], [0])).toBeNull();
    expect(soloOutcome(['ai-easy', 'ai-hard'], [0])).toBeNull();
    expect(soloOutcome(['ai-easy', 'human', 'ai-easy'], [1])).toBe('win');
  });

  it('공동 1등은 무승부', () => {
    expect(soloOutcome(['human', 'ai-easy', 'ai-easy'], [0, 2])).toBe('draw');
    expect(soloOutcome(['human', 'ai-easy', 'ai-easy'], [1, 2])).toBe('loss');
  });

  it('결과를 더하고 글로 보여 준다', () => {
    let s = addOutcome({}, 'omok', 'win');
    s = addOutcome(s, 'omok', 'win');
    s = addOutcome(s, 'omok', 'loss');
    expect(s.omok).toEqual({ wins: 2, losses: 1, draws: 0 });
    expect(statsText(s.omok)).toBe('2승 1패');
    expect(statsText(addOutcome(s, 'omok', 'draw').omok)).toBe('2승 1무 1패');
    expect(statsText(undefined)).toBe('');
  });
});
