import type { Bar, Song } from '../../lib/music';

/**
 * 꽃밭 가꾸기 배경음악 — 직접 작곡한 밝은 들판풍 곡 (바장조, 104 BPM).
 * 앞부분은 피리처럼 느긋하게 노래하고, 뒷부분은 새가 지저귀듯 짧게 주고받다가 처음 음으로 돌아온다.
 */
const _ = null;

const F = [53, 57, 60];
const Bb = [53, 58, 62];
const C = [52, 55, 60];
const C7 = [52, 55, 58, 60];
const Dm = [53, 57, 62];
const Gm = [55, 58, 62];
const Am = [52, 57, 60];

const BARS: Bar[] = [
  // A: 들판을 걷는 피리
  { chord: F, bass: 41, melody: [72, _, 69, 70, 72, _, 77, _] },
  { chord: Bb, bass: 46, melody: [74, _, 72, 70, 69, _, 70, _] },
  { chord: F, bass: 41, melody: [69, _, 65, 67, 69, 72, 70, 69] },
  { chord: C, bass: 48, melody: [67, _, _, 64, 67, _, _, _] },
  { chord: F, bass: 41, melody: [72, _, 69, 70, 72, _, 77, 79] },
  { chord: Dm, bass: 38, melody: [81, _, 79, 77, 74, _, 77, _] },
  { chord: Bb, bass: 46, chord2: C7, bass2: 48, melody: [74, 72, 70, 69, 67, _, 70, _] },
  { chord: F, bass: 41, melody: [69, _, 65, _, 65, _, _, _] },
  // B: 새들이 주고받는 노래
  { chord: Bb, bass: 46, melody: [74, 77, 74, _, 70, _, 74, _] },
  { chord: F, bass: 41, melody: [72, 77, 72, _, 69, _, 72, _] },
  { chord: Gm, bass: 43, melody: [70, _, 74, 72, 70, _, 67, _] },
  { chord: C, bass: 48, melody: [72, _, _, 76, 79, _, 76, _] },
  { chord: Am, bass: 45, melody: [76, _, 72, 69, 72, _, 76, _] },
  { chord: Dm, bass: 38, melody: [77, _, 74, 69, 74, _, 77, 81] },
  { chord: Bb, bass: 46, chord2: C7, bass2: 48, melody: [79, _, 77, 76, 74, _, 72, 76] },
  { chord: F, bass: 41, melody: [77, _, 72, _, 77, _, _, _] },
];

export const GARDEN_SONG: Song = {
  bpm: 104,
  bars: BARS,
  lead: 'sine',
  leadVolume: 0.3,
  leadLength: 0.85,
  drums: 'soft',
  arpVolume: 0.06,
};
