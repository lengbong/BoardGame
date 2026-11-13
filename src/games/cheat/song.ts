import type { Bar, Song } from '../../lib/music';

/**
 * 거짓말쟁이 배경음악 — 직접 작곡한 시치미 뚝 떼는 곡 (마단조, 120 BPM).
 * 앞부분은 반음씩 미끄러지는 '음흉한' 멜로디, 뒷부분은 장조로 밝아지며 '아닌 척' 둘러대는 느낌을 냈다.
 */
const _ = null;

const Em = [55, 59, 64];
const Am = [57, 60, 64];
const B7 = [54, 57, 59, 63];
const C = [55, 60, 64];
const D = [54, 57, 62];
const G = [55, 59, 62];

const BARS: Bar[] = [
  // A: 살금살금 시치미
  { chord: Em, bass: 40, melody: [64, _, 67, 66, 64, _, 59, _] },
  { chord: Em, bass: 40, melody: [60, 59, 60, _, 64, _, _, _] },
  { chord: Am, bass: 45, melody: [69, _, 72, 71, 69, _, 64, _] },
  { chord: B7, bass: 47, melody: [66, 63, 66, _, 71, _, _, _] },
  { chord: Em, bass: 40, melody: [64, _, 67, 66, 64, _, 71, _] },
  { chord: C, bass: 48, melody: [72, _, 71, 69, 67, _, 64, _] },
  { chord: Am, bass: 45, chord2: B7, bass2: 47, melody: [69, 67, 66, 64, 63, _, 66, _] },
  { chord: Em, bass: 40, melody: [64, _, 59, _, 64, _, _, _] },
  // B: "진짜라니까~" 둘러대기
  { chord: G, bass: 43, melody: [67, _, 71, _, 74, 74, 72, 71] },
  { chord: D, bass: 38, melody: [69, _, 66, _, 62, _, 66, _] },
  { chord: C, bass: 48, melody: [67, _, 72, _, 76, 76, 74, 72] },
  { chord: B7, bass: 47, melody: [71, _, 66, _, 63, _, 66, _] },
  { chord: Em, bass: 40, melody: [76, _, 74, 71, 67, _, 71, _] },
  { chord: Am, bass: 45, melody: [72, _, 69, _, 64, _, 69, _] },
  { chord: C, bass: 48, chord2: B7, bass2: 47, melody: [67, 69, 71, 72, 71, _, 63, _] },
  { chord: Em, bass: 40, melody: [64, _, _, 59, 64, _, _, _] },
];

export const CHEAT_SONG: Song = {
  bpm: 120,
  bars: BARS,
  lead: 'triangle',
  leadVolume: 0.28,
  leadLength: 0.6,
  drums: 'soft',
  arpVolume: 0.05,
};
