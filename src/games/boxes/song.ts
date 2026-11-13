import type { Bar, Song } from '../../lib/music';

/**
 * 점과 상자 배경음악: 공책·교실 느낌의 가볍고 밝은 곡 (라장조, 112 BPM, 16마디).
 * 이 게임을 위해 새로 지은 멜로디. 실로폰처럼 짧게 끊어 치고, 북은 살짝만.
 */

const _ = null;

// 라장조 화음
const D = [54, 57, 62];
const G = [55, 59, 62];
const A = [57, 61, 64];
const Bm = [54, 59, 62];
const Em = [55, 59, 64];

const BARS: Bar[] = [
  { chord: D, bass: 50, melody: [74, _, 76, 78, 81, _, 78, _] },
  { chord: G, bass: 43, melody: [79, _, 78, 76, 74, _, 71, _] },
  { chord: A, bass: 45, melody: [76, _, 78, 76, 73, _, 69, _] },
  { chord: D, bass: 50, melody: [74, 74, 76, _, 78, _, _, _] },
  { chord: Bm, bass: 47, melody: [78, _, 81, 83, 81, _, 78, _] },
  { chord: G, bass: 43, melody: [79, _, 76, _, 74, 76, 79, _] },
  { chord: Em, bass: 40, chord2: A, bass2: 45, melody: [78, 76, 74, 76, 78, _, 76, _] },
  { chord: D, bass: 50, melody: [74, _, 69, _, 74, _, _, _] },
  { chord: G, bass: 43, melody: [83, _, 83, 81, 79, _, 76, _] },
  { chord: D, bass: 50, melody: [81, _, 81, 79, 78, _, 74, _] },
  { chord: Em, bass: 40, melody: [79, _, 78, 76, 71, _, 76, 79] },
  { chord: A, bass: 45, melody: [81, _, 76, _, 73, _, 76, _] },
  { chord: Bm, bass: 47, melody: [78, 81, 83, _, 86, _, 83, 81] },
  { chord: G, bass: 43, melody: [79, _, 76, 79, 83, _, 81, _] },
  { chord: Em, bass: 40, chord2: A, bass2: 45, melody: [79, 78, 76, 78, 81, _, 73, _] },
  { chord: D, bass: 50, melody: [74, _, 78, _, 74, _, _, _] },
];

export const boxesSong: Song = {
  bpm: 112,
  bars: BARS,
  lead: 'triangle',
  leadVolume: 0.26,
  leadLength: 1.1,
  drums: 'soft',
  arpVolume: 0.06,
};
