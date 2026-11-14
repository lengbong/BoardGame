import type { Bar, Song } from '../../lib/music';

/**
 * 기차로 전국 일주 배경음악 — 직접 작곡한 신나는 기차 여행 곡 (라장조, 116 BPM).
 * 앞부분은 같은 음을 '칙칙 칙-폭' 하고 되풀이하는 기차 바퀴 리듬, 뒷부분은 창밖 풍경처럼 높이 올라갔다가
 * 마지막 마디에서 기적 소리처럼 높은 레로 끝난다.
 */
const _ = null;

const D = [57, 62, 66];
const G = [55, 59, 62];
const A = [57, 61, 64];
const Bm = [54, 59, 62];
const Em = [55, 59, 64];
const Fsm = [54, 57, 61];

const BARS: Bar[] = [
  // A: 칙칙 칙-폭, 출발!
  { chord: D, bass: 38, melody: [74, 74, _, 74, 78, _, 76, 74] },
  { chord: D, bass: 38, melody: [69, _, 71, _, 74, _, _, _] },
  { chord: G, bass: 43, melody: [71, 71, _, 71, 74, _, 73, 71] },
  { chord: A, bass: 45, melody: [69, _, 66, _, 64, _, _, _] },
  { chord: D, bass: 38, melody: [74, 74, _, 74, 78, _, 81, _] },
  { chord: Bm, bass: 47, melody: [83, _, 81, _, 78, _, 74, _] },
  { chord: G, bass: 43, chord2: A, bass2: 45, melody: [76, _, 78, _, 79, 78, 76, _] },
  { chord: D, bass: 38, melody: [74, _, _, _, 69, _, 74, _] },
  // B: 창밖 풍경
  { chord: G, bass: 43, melody: [79, _, 79, _, 83, _, 81, 79] },
  { chord: D, bass: 38, melody: [78, _, 74, _, 69, _, 74, _] },
  { chord: Em, bass: 40, melody: [76, _, 76, _, 79, _, 78, 76] },
  { chord: A, bass: 45, melody: [73, _, 69, _, 64, _, 69, 73] },
  { chord: Bm, bass: 47, melody: [74, 74, _, 74, 78, 78, _, 78] },
  { chord: Fsm, bass: 42, melody: [81, _, 78, _, 73, _, 78, _] },
  { chord: G, bass: 43, chord2: A, bass2: 45, melody: [79, _, 76, _, 81, _, 85, _] },
  { chord: D, bass: 38, melody: [86, _, _, 81, 74, _, _, _] },
];

export const RAILS_SONG: Song = {
  bpm: 116,
  bars: BARS,
  lead: 'square',
  leadVolume: 0.085,
  leadLength: 0.75,
  drums: 'full',
  arpVolume: 0.055,
};
