import type { Bar, Song } from '../../lib/music';

/**
 * 뒤집기 배경음악: 차분하고 생각에 잠기는 레 도리아 선법 곡 (92 BPM, 부드러운 북).
 * 이 프로젝트에서 직접 작곡했다. 한 마디 = 8분음표 8개.
 */
const _ = null;
const Dm = [57, 62, 65];
const G = [55, 59, 62];
const C = [55, 60, 64];
const Am = [57, 60, 64];
const F = [57, 60, 65];

const BARS: Bar[] = [
  { chord: Dm, bass: 38, melody: [69, _, 74, _, 76, 77, 76, _] },
  { chord: G, bass: 43, melody: [74, _, 71, _, 67, _, 69, 71] },
  { chord: Dm, bass: 38, melody: [72, _, 69, _, 65, _, 64, 65] },
  { chord: Am, bass: 45, melody: [64, _, _, _, 69, _, _, _] },
  { chord: Dm, bass: 38, melody: [69, _, 74, _, 76, 77, 79, _] },
  { chord: C, bass: 48, melody: [79, _, 76, _, 72, _, 76, _] },
  { chord: G, bass: 43, chord2: Am, bass2: 45, melody: [77, 76, 74, _, 71, _, 72, _] },
  { chord: Dm, bass: 38, melody: [74, _, _, _, 69, _, _, _] },
  { chord: F, bass: 41, melody: [72, _, 77, _, 81, _, 79, 77] },
  { chord: C, bass: 48, melody: [76, _, 79, _, 72, _, _, _] },
  { chord: G, bass: 43, melody: [71, _, 74, _, 79, _, 77, 76] },
  { chord: Am, bass: 45, melody: [76, _, 72, _, 69, _, _, _] },
  { chord: Dm, bass: 38, melody: [77, _, 76, 74, _, 69, 74, _] },
  { chord: G, bass: 43, melody: [71, _, 74, _, 79, _, _, 77] },
  { chord: C, bass: 48, chord2: Am, bass2: 45, melody: [76, 74, 72, _, 69, _, 71, _] },
  { chord: Dm, bass: 38, melody: [74, _, _, _, _, _, 69, _] },
];

export const REVERSI_SONG: Song = {
  bpm: 92,
  bars: BARS,
  lead: 'sine',
  leadVolume: 0.3,
  leadLength: 2.4,
  drums: 'soft',
  arpVolume: 0.06,
};
