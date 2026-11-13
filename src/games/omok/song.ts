import type { Bar, Song } from '../../lib/music';

/**
 * 오목 배경음악 — 직접 작곡한 차분한 곡 (사장조 5음계, 84 BPM).
 * 가야금을 뜯듯 짧게 끊는 멜로디와 여유 있는 쉼표로 수를 생각하기 좋은 분위기를 만들었다.
 */
const _ = null;

const G = [55, 59, 62];
const Em = [55, 59, 64];
const C = [55, 60, 64];
const D = [54, 57, 62];
const Am = [57, 60, 64];

const BARS: Bar[] = [
  { chord: G, bass: 43, melody: [74, _, _, 71, 74, _, 76, _] },
  { chord: Em, bass: 40, melody: [79, _, 76, _, 74, _, _, _] },
  { chord: C, bass: 48, melody: [72, _, 74, _, 76, _, 79, _] },
  { chord: D, bass: 38, melody: [78, _, 76, _, 74, _, _, _] },
  { chord: G, bass: 43, melody: [71, _, 74, _, 79, _, 81, 79] },
  { chord: Em, bass: 40, melody: [76, _, _, 74, 71, _, _, _] },
  { chord: Am, bass: 45, chord2: D, bass2: 38, melody: [69, _, 72, _, 74, _, 78, _] },
  { chord: G, bass: 43, melody: [79, _, _, _, 74, _, _, _] },
  { chord: C, bass: 48, melody: [76, _, 79, _, 84, _, 81, _] },
  { chord: G, bass: 43, melody: [79, _, 76, _, 74, _, _, _] },
  { chord: Am, bass: 45, melody: [72, _, 76, _, 81, _, 79, 76] },
  { chord: D, bass: 38, melody: [74, _, _, _, 78, _, 81, _] },
  { chord: Em, bass: 40, melody: [83, _, 81, _, 79, _, 76, _] },
  { chord: C, bass: 48, melody: [79, _, 76, _, 72, _, _, _] },
  { chord: Am, bass: 45, chord2: D, bass2: 38, melody: [74, _, 76, _, 78, _, 81, _] },
  { chord: G, bass: 43, melody: [79, _, _, _, _, _, _, _] },
];

export const OMOK_SONG: Song = {
  bpm: 84,
  bars: BARS,
  lead: 'triangle',
  leadVolume: 0.3,
  leadLength: 0.55,
  drums: 'none',
  arpVolume: 0.04,
};
