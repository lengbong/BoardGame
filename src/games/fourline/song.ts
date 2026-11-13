import type { Bar, Song } from '../../lib/music';

/**
 * 사목 배경음악: 통통 튀는 신나는 가장조 곡 (124 BPM).
 * 이 프로젝트에서 직접 작곡했다. 한 마디 = 8분음표 8개.
 */
const _ = null;
const A = [57, 61, 64];
const D = [57, 62, 66];
const E = [56, 59, 64];
const Fsm = [57, 61, 66];
const Bm = [59, 62, 66];

const BARS: Bar[] = [
  { chord: A, bass: 45, melody: [76, _, 73, 76, 81, _, 76, _] },
  { chord: D, bass: 38, melody: [78, _, 74, 78, 81, _, 78, _] },
  { chord: E, bass: 40, melody: [80, _, 76, 80, 83, 81, 80, 78] },
  { chord: A, bass: 45, melody: [76, _, 69, _, 73, _, _, _] },
  { chord: Fsm, bass: 42, melody: [73, 73, _, 76, 78, _, 81, _] },
  { chord: D, bass: 38, melody: [81, _, 78, _, 74, 76, 78, _] },
  { chord: Bm, bass: 47, chord2: E, bass2: 40, melody: [74, 76, 78, _, 80, _, 83, _] },
  { chord: A, bass: 45, melody: [81, _, 76, _, 69, _, _, _] },
  { chord: D, bass: 38, melody: [74, _, 78, 81, _, 78, 74, _] },
  { chord: A, bass: 45, melody: [73, _, 76, 81, _, 76, 73, _] },
  { chord: Bm, bass: 47, melody: [71, 74, 78, _, 83, _, 81, 78] },
  { chord: E, bass: 40, melody: [80, _, 76, _, 71, _, 76, _] },
  { chord: Fsm, bass: 42, melody: [81, _, 78, _, 73, _, 78, 81] },
  { chord: D, bass: 38, melody: [83, _, 81, 78, 74, _, 78, _] },
  { chord: E, bass: 40, melody: [76, 78, 80, _, 83, _, 80, _] },
  { chord: A, bass: 45, melody: [81, _, _, 76, 81, _, _, _] },
];

export const FOURLINE_SONG: Song = {
  bpm: 124,
  bars: BARS,
  lead: 'square',
  leadVolume: 0.085,
  leadLength: 0.8,
  drums: 'full',
  arpVolume: 0.1,
};
