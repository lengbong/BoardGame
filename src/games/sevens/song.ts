import type { Bar, Song } from '../../lib/music';

/**
 * 칠 이어놓기 배경음악 — 직접 작곡한 느긋한 스윙풍 곡 (바장조, 96 BPM).
 * 7화음(maj7, m7, 7)과 '길게-짧게' 끊는 리듬으로 흔들흔들 여유 있는 느낌을 냈다.
 */
const _ = null;

const Fmaj7 = [53, 57, 60, 64];
const Dm7 = [57, 60, 62, 65];
const Gm7 = [55, 58, 62, 65];
const C7 = [55, 58, 60, 64];
const D7 = [54, 57, 60, 62];
const Bbmaj7 = [58, 62, 65, 69];
const Am7 = [55, 57, 60, 64];

const BARS: Bar[] = [
  { chord: Fmaj7, bass: 41, melody: [69, _, _, 72, 77, _, 76, _] },
  { chord: Dm7, bass: 38, melody: [74, _, 72, _, 69, _, _, _] },
  { chord: Gm7, bass: 43, melody: [70, _, _, 74, 77, _, 74, _] },
  { chord: C7, bass: 48, melody: [76, _, 74, 72, 70, _, 67, _] },
  { chord: Fmaj7, bass: 41, melody: [69, _, _, 72, 77, _, 79, _] },
  { chord: D7, bass: 38, melody: [78, _, 74, _, 72, _, 69, _] },
  { chord: Gm7, bass: 43, chord2: C7, bass2: 48, melody: [70, _, 74, _, 76, _, 72, _] },
  { chord: Fmaj7, bass: 41, melody: [77, _, _, _, 72, _, _, _] },
  { chord: Bbmaj7, bass: 46, melody: [74, _, _, 77, 81, _, 79, _] },
  { chord: Am7, bass: 45, melody: [79, _, 76, _, 72, _, _, _] },
  { chord: Gm7, bass: 43, melody: [77, _, _, 74, 70, _, 74, _] },
  { chord: C7, bass: 48, melody: [76, _, 79, _, 76, _, 72, _] },
  { chord: Fmaj7, bass: 41, melody: [72, _, _, 69, 72, _, 77, _] },
  { chord: Dm7, bass: 38, melody: [76, _, 74, _, 72, _, 69, _] },
  { chord: Gm7, bass: 43, chord2: C7, bass2: 48, melody: [70, _, 72, _, 74, _, 76, _] },
  { chord: Fmaj7, bass: 41, melody: [77, _, 72, _, 69, _, _, _] },
];

export const SEVENS_SONG: Song = {
  bpm: 96,
  bars: BARS,
  lead: 'triangle',
  leadVolume: 0.24,
  leadLength: 1.4,
  drums: 'soft',
  arpVolume: 0.055,
};
