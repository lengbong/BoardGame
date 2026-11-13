import type { Bar, Song } from '../../lib/music';

/*
 * 배 찾기 배경음악: 직접 작곡한 뱃노래풍 행진곡 (라단조, 108 BPM).
 * 닻을 올리고 노를 젓는 느낌으로 한 마디에 두 번씩 북이 울리고,
 * 4마디마다 딸림화음(가장조)으로 긴장했다가 라단조로 돌아온다.
 */

const Dm = [57, 62, 65];
const Gm = [55, 58, 62];
const A = [57, 61, 64];
const Bb = [58, 62, 65];
const C = [55, 60, 64];
const F = [57, 60, 65];
const _ = null;

const BARS: Bar[] = [
  // 1부: 출항
  { chord: Dm, bass: 38, melody: [69, _, 74, _, 74, 76, 77, 74] },
  { chord: C, bass: 48, melody: [76, _, 72, _, 72, 74, 76, 72] },
  { chord: Dm, bass: 38, melody: [74, _, 77, _, 81, _, 79, 77] },
  { chord: A, bass: 45, melody: [76, _, _, 73, 69, _, _, _] },
  { chord: Dm, bass: 38, melody: [69, _, 74, _, 74, 76, 77, 79] },
  { chord: F, bass: 41, melody: [81, _, 79, 77, 72, _, 77, _] },
  { chord: Gm, bass: 43, chord2: A, bass2: 45, melody: [79, 77, 76, 74, 73, 74, 76, _] },
  { chord: Dm, bass: 38, melody: [74, _, 69, _, 74, _, _, _] },
  // 2부: 거친 바다
  { chord: Bb, bass: 46, melody: [77, _, 77, _, 77, 79, 77, 74] },
  { chord: F, bass: 41, melody: [72, _, 72, _, 72, 74, 72, 69] },
  { chord: Gm, bass: 43, melody: [70, _, 74, _, 79, _, 77, 76] },
  { chord: A, bass: 45, melody: [76, _, 73, _, 69, _, 73, 76] },
  { chord: Dm, bass: 38, melody: [77, _, 76, 74, 81, _, 77, _] },
  { chord: C, bass: 48, melody: [79, _, 77, 76, 72, _, 76, 79] },
  { chord: Bb, bass: 46, chord2: A, bass2: 45, melody: [77, 76, 74, 77, 76, _, 73, _] },
  { chord: Dm, bass: 38, melody: [74, _, _, _, 69, _, 62, _] },
];

export const SHIPS_SONG: Song = {
  bpm: 108,
  bars: BARS,
  lead: 'square',
  leadVolume: 0.085,
  leadLength: 1.3,
  drums: 'full',
  arpVolume: 0.07,
};
