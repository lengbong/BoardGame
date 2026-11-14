import type { Bar, Song } from '../../lib/music';

/**
 * 하늘길 항공사 배경음악 — 직접 작곡한 '구름 위 순항' (내림나장조, 100 BPM).
 * 앞부분은 활주로를 달려 떠오르듯 차근차근 올라가고, 뒷부분은 구름 위에서 넓게 맴돌다가 착륙하듯 내려온다.
 */
const _ = null;

// 내림나장조 화음 (MIDI)
const Bb = [58, 62, 65];
const Eb = [58, 63, 67];
const F = [57, 60, 65];
const Gm = [55, 58, 62];
const Cm = [55, 60, 63];
const Dm = [57, 62, 65];
const F7 = [57, 60, 63, 65];
const Ebmaj = [58, 62, 63, 67];

const BARS: Bar[] = [
  // A: 활주로에서 떠오르기
  { chord: Bb, bass: 46, melody: [70, _, 72, 74, _, 77, _, 74] },
  { chord: Eb, bass: 51, melody: [75, _, 74, 72, _, 70, 67, _] },
  { chord: Cm, bass: 48, melody: [72, _, 75, 79, _, 77, 75, _] },
  { chord: F, bass: 53, melody: [77, _, _, 72, 69, _, 72, _] },
  { chord: Gm, bass: 55, melody: [74, _, 77, 82, _, 81, 79, _] },
  { chord: Ebmaj, bass: 51, melody: [79, _, 75, _, 72, 74, 75, _] },
  { chord: Cm, bass: 48, chord2: F7, bass2: 53, melody: [77, 75, 74, 72, _, 69, 72, _] },
  { chord: Bb, bass: 46, melody: [70, _, _, _, 65, _, 70, _] },
  // B: 구름 위에서 넓게
  { chord: Eb, bass: 51, melody: [79, _, _, 82, _, 79, 77, _] },
  { chord: Bb, bass: 50, melody: [77, _, 74, _, 70, _, 74, _] },
  { chord: Cm, bass: 48, melody: [75, _, 79, _, 84, _, 82, 79] },
  { chord: Dm, bass: 50, melody: [81, _, 77, _, 74, _, 77, _] },
  { chord: Gm, bass: 55, melody: [79, _, 82, 86, _, 84, 82, _] },
  { chord: Eb, bass: 51, melody: [82, _, 79, 75, _, 77, 79, _] },
  { chord: Cm, bass: 48, chord2: F7, bass2: 53, melody: [77, 79, 77, 75, 72, _, 74, _] },
  { chord: Bb, bass: 46, melody: [70, _, 74, 77, 82, _, _, _] },
];

export const AIRLINE_SONG: Song = {
  bpm: 100,
  bars: BARS,
  lead: 'sine',
  leadVolume: 0.24,
  leadLength: 1.4,
  drums: 'soft',
  arpVolume: 0.05,
};
