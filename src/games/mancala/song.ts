import type { Bar, Song } from '../../lib/music';

/**
 * 만칼라 배경음악 "씨앗 뿌리는 날" — 이 프로젝트에서 직접 작곡한 곡.
 * 라장조 5음계(레·미·파#·라·시)만 쓰는 따뜻하고 소박한 마림바풍 (100 BPM, 16마디).
 * 멜로디는 짧게 끊어 나무 건반을 두드리는 느낌을 낸다.
 */

const D = [57, 62, 66];
const Bm = [54, 59, 62];
const G = [55, 59, 62];
const A = [57, 61, 64];
const Em = [55, 59, 64];
const Fsm = [54, 57, 61];
const _ = null;

const BARS: Bar[] = [
  { chord: D, bass: 38, melody: [74, _, 76, 78, 81, _, 78, _] },
  { chord: Bm, bass: 47, melody: [76, _, 74, 71, 74, _, _, 71] },
  { chord: G, bass: 43, melody: [69, _, 71, 74, 76, 74, 71, _] },
  { chord: A, bass: 45, melody: [69, _, _, 66, 69, _, 64, _] },
  { chord: D, bass: 38, melody: [74, 74, 76, _, 81, _, 83, 81] },
  { chord: Bm, bass: 47, melody: [78, _, 76, _, 74, 76, 78, _] },
  { chord: G, bass: 43, chord2: A, bass2: 45, melody: [76, _, 74, 71, 69, _, 71, 74] },
  { chord: D, bass: 38, melody: [74, _, 69, _, 66, _, _, _] },
  { chord: G, bass: 43, melody: [83, _, 81, 78, 81, _, 83, _] },
  { chord: Fsm, bass: 42, melody: [81, _, 78, 76, 78, _, 76, 73] },
  { chord: Em, bass: 40, melody: [76, _, 71, _, 74, 76, 71, _] },
  { chord: Bm, bass: 47, melody: [78, _, 74, _, 71, _, 69, 71] },
  { chord: G, bass: 43, melody: [74, _, 76, 78, 81, _, 86, _] },
  { chord: A, bass: 45, melody: [83, 81, 78, _, 76, _, 78, _] },
  { chord: G, bass: 43, chord2: A, bass2: 45, melody: [76, 74, 71, 74, 76, _, 69, _] },
  { chord: D, bass: 38, melody: [74, _, _, 69, 74, _, _, _] },
];

export const MANCALA_SONG: Song = {
  bpm: 100,
  bars: BARS,
  lead: 'sine',
  leadVolume: 0.34,
  leadLength: 1.1,
  drums: 'soft',
  arpVolume: 0.06,
};
