import type { Bar, Song } from '../../lib/music';

/**
 * 섬마을 개척 배경음악 — 직접 작곡한 산들바람 부는 섬 노래 (라장조, 108 BPM).
 * 앞부분은 엇박으로 살랑이는 파도 같은 멜로디, 뒷부분은 높이 올라가 갈매기처럼 맴돌다가 바닷가로 내려온다.
 */
const _ = null;

const D = [54, 57, 62];
const G = [55, 59, 62];
const A = [57, 61, 64];
const A7 = [55, 57, 61, 64];
const Bm = [54, 59, 62];
const Em = [55, 59, 64];

const BARS: Bar[] = [
  // A: 살랑살랑 파도
  { chord: D, bass: 38, melody: [66, _, 69, 74, _, 73, 71, _] },
  { chord: G, bass: 43, melody: [71, _, 67, _, 71, 74, _, _] },
  { chord: A, bass: 45, melody: [73, _, 69, 76, _, 74, 73, _] },
  { chord: D, bass: 38, melody: [74, _, _, 69, 66, _, _, _] },
  { chord: Bm, bass: 47, melody: [71, _, 74, 78, _, 76, 74, _] },
  { chord: G, bass: 43, melody: [76, _, 74, 71, _, 67, 69, _] },
  { chord: Em, bass: 40, chord2: A, bass2: 45, melody: [67, 69, 71, _, 73, _, 76, _] },
  { chord: D, bass: 38, melody: [74, _, _, _, 62, 66, 69, _] },
  // B: 갈매기처럼 높이
  { chord: G, bass: 43, melody: [79, _, 78, 76, _, 74, 76, _] },
  { chord: D, bass: 42, melody: [78, _, 74, _, 69, _, 74, _] },
  { chord: Em, bass: 40, melody: [76, _, 79, 76, _, 71, 74, _] },
  { chord: A, bass: 45, melody: [73, _, 69, _, 64, _, 69, 73] },
  { chord: Bm, bass: 47, melody: [74, _, 78, _, 81, 79, 78, _] },
  { chord: G, bass: 43, melody: [79, _, 76, 74, _, 71, 74, _] },
  { chord: Em, bass: 40, chord2: A7, bass2: 45, melody: [71, 73, 74, 76, 73, _, 69, _] },
  { chord: D, bass: 38, melody: [74, _, 69, 66, 62, _, _, _] },
];

export const ISLAND_SONG: Song = {
  bpm: 108,
  bars: BARS,
  lead: 'triangle',
  leadVolume: 0.26,
  leadLength: 1.1,
  drums: 'soft',
  arpVolume: 0.06,
};
