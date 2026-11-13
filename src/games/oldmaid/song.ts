import type { Bar, Song } from '../../lib/music';

/**
 * 도둑잡기 배경음악 — 직접 작곡한 살금살금 장난스러운 곡 (라단조, 116 BPM).
 * 짧게 튕기는 멜로디(피치카토 느낌)와 반음씩 기어오르는 꾸밈음으로 '몰래 살금살금'을 표현했다.
 */
const _ = null;

const Dm = [57, 62, 65];
const Gm = [55, 58, 62];
const A7 = [55, 57, 61, 64];
const Bb = [53, 58, 62];
const F = [53, 57, 60];
const C = [55, 60, 64];
const E7 = [56, 59, 62, 64];

const BARS: Bar[] = [
  // A: 발끝으로 살금살금
  { chord: Dm, bass: 38, melody: [62, _, 65, _, 69, 68, 69, _] },
  { chord: Dm, bass: 38, melody: [70, _, 69, _, 65, _, 62, _] },
  { chord: Gm, bass: 43, melody: [67, _, 70, _, 74, 73, 74, _] },
  { chord: A7, bass: 45, melody: [73, _, 76, _, 73, _, 69, _] },
  { chord: Dm, bass: 38, melody: [74, _, 72, _, 70, _, 69, _] },
  { chord: Bb, bass: 46, melody: [70, 69, 70, _, 74, _, 70, _] },
  { chord: Gm, bass: 43, chord2: A7, bass2: 45, melody: [67, _, 70, _, 69, _, 73, _] },
  { chord: Dm, bass: 38, melody: [74, _, 69, _, 62, _, _, _] },
  // B: 두리번두리번, 그리고 깜짝!
  { chord: F, bass: 41, melody: [72, _, 72, _, 77, _, 76, 74] },
  { chord: C, bass: 48, melody: [76, _, 72, _, 67, _, 72, _] },
  { chord: Dm, bass: 38, melody: [74, _, 74, _, 77, _, 76, 74] },
  { chord: A7, bass: 45, melody: [73, _, 69, _, 64, _, 69, _] },
  { chord: Bb, bass: 46, melody: [70, _, 72, _, 74, _, 77, _] },
  { chord: Gm, bass: 43, melody: [79, _, 77, _, 74, _, 70, _] },
  { chord: E7, bass: 40, chord2: A7, bass2: 45, melody: [68, _, 71, _, 73, _, 76, _] },
  { chord: Dm, bass: 38, melody: [74, 73, 74, _, 62, _, _, _] },
];

export const OLDMAID_SONG: Song = {
  bpm: 116,
  bars: BARS,
  lead: 'triangle',
  leadVolume: 0.3,
  // 짧게 끊어서 현을 뜯는 느낌
  leadLength: 0.35,
  drums: 'soft',
  arpVolume: 0.05,
};
