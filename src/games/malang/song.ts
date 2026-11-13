import type { Bar, Song } from '../../lib/music';

/**
 * 말랑 팡팡 배경음악 — 직접 작곡한 통통 튀는 곡 (라장조, 140 BPM).
 * 짧게 끊어 치는 멜로디로 젤리가 말랑말랑 튀는 느낌을 내고, 뒤쪽은 한 옥타브 올라가며 신나게.
 */
const _ = null;

const D = [57, 62, 66];
const Bm = [59, 62, 66];
const G = [55, 59, 62];
const A = [57, 61, 64];
const Fsm = [57, 61, 66];
const Em = [55, 59, 64];

const BARS: Bar[] = [
  // A: 말랑말랑
  { chord: D, bass: 38, melody: [74, _, 78, _, 81, _, 78, 74] },
  { chord: Bm, bass: 47, melody: [76, _, 74, 71, _, 71, 74, _] },
  { chord: G, bass: 43, melody: [71, 74, 79, _, 78, _, 76, _] },
  { chord: A, bass: 45, melody: [76, _, 73, _, 69, _, _, _] },
  { chord: D, bass: 38, melody: [74, _, 78, _, 81, 83, 81, 78] },
  { chord: Fsm, bass: 42, melody: [81, _, 78, _, 73, _, 78, _] },
  { chord: G, bass: 43, chord2: A, bass2: 45, melody: [79, 78, 76, 74, 73, 74, 76, _] },
  { chord: D, bass: 38, melody: [74, _, 69, _, 74, _, _, _] },
  // B: 팡팡 연쇄
  { chord: G, bass: 43, melody: [83, _, 83, 81, 79, _, 83, _] },
  { chord: D, bass: 38, melody: [81, _, 81, 79, 78, _, 81, _] },
  { chord: Em, bass: 40, melody: [79, _, 76, _, 71, _, 76, 79] },
  { chord: A, bass: 45, melody: [81, _, 76, _, 73, _, 76, _] },
  { chord: Bm, bass: 47, melody: [78, _, 83, _, 86, _, 83, 78] },
  { chord: G, bass: 43, melody: [79, _, 76, _, 71, _, 74, _] },
  { chord: Em, bass: 40, chord2: A, bass2: 45, melody: [76, 78, 79, 81, 79, _, 73, _] },
  { chord: D, bass: 38, melody: [74, _, 78, _, 81, _, _, _] },
];

export const MALANG_SONG: Song = {
  bpm: 140,
  bars: BARS,
  lead: 'square',
  leadVolume: 0.08,
  leadLength: 0.7,
  drums: 'full',
  arpVolume: 0.06,
};
