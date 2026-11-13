import type { Bar, Song } from '../../lib/music';

/**
 * 숫자야구 배경음악 — 직접 작곡한 야구장 오르간풍 응원곡 (다장조, 132 BPM).
 * 같은 음을 두 번씩 콕콕 찍는 앞부분은 '한 번 쳐 봐!', 뒤쪽의 엇박 멜로디는 관중의 박수를 떠올리게 했다.
 */
const _ = null;

const C = [55, 60, 64];
const Am = [57, 60, 64];
const F = [53, 57, 60];
const G = [55, 59, 62];
const G7 = [53, 55, 59, 62];
const Dm = [57, 62, 65];
const D7 = [54, 57, 60, 62];
const E7 = [56, 59, 62, 64];

const BARS: Bar[] = [
  // A: 타석에 들어서며
  { chord: C, bass: 48, melody: [72, _, 72, 74, 76, _, 72, _] },
  { chord: C, bass: 48, melody: [79, _, 76, _, 72, _, 67, _] },
  { chord: F, bass: 41, melody: [77, _, 77, 76, 74, _, 72, _] },
  { chord: G, bass: 43, melody: [74, _, 71, _, 67, _, _, _] },
  { chord: Am, bass: 45, melody: [72, _, 72, 74, 76, _, 81, _] },
  { chord: Dm, bass: 38, melody: [77, _, 76, 74, 72, _, 69, _] },
  { chord: G, bass: 43, chord2: G7, bass2: 43, melody: [67, 69, 71, 72, 74, 76, 77, 79] },
  { chord: C, bass: 48, melody: [84, _, 79, _, 72, _, _, _] },
  // B: 관중석의 박수
  { chord: F, bass: 41, melody: [69, 72, 77, _, 77, _, 76, 77] },
  { chord: C, bass: 48, melody: [79, _, 76, _, 72, _, 76, _] },
  { chord: D7, bass: 38, melody: [74, 78, 81, _, 81, _, 79, 78] },
  { chord: G, bass: 43, melody: [79, _, 74, _, 71, _, 67, _] },
  { chord: C, bass: 48, chord2: E7, bass2: 40, melody: [76, _, 79, _, 80, _, 83, _] },
  { chord: Am, bass: 45, melody: [84, _, 81, _, 76, _, 72, _] },
  { chord: F, bass: 41, chord2: G, bass2: 43, melody: [77, _, 76, _, 74, _, 71, _] },
  { chord: C, bass: 48, melody: [72, _, 79, _, 84, _, _, _] },
];

export const BASEBALL_SONG: Song = {
  bpm: 132,
  bars: BARS,
  // 사각파를 작게: 야구장 전자 오르간 느낌
  lead: 'square',
  leadVolume: 0.085,
  leadLength: 1.1,
  drums: 'full',
  arpVolume: 0.06,
};
