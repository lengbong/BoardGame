import type { Bar, Song } from '../../lib/music';

/**
 * 우리 마을 지도 배경음악 — 직접 작곡한 느긋한 마을 노래 (사장조 오음 음계: 솔 라 시 레 미, 96 BPM).
 * 앞부분은 들길을 걷듯 한 걸음씩 오르내리고, 뒷부분은 냇물처럼 높이 흘렀다가 마을 어귀로 돌아온다.
 * 피리 같은 사인파 멜로디에 가야금처럼 퉁기는 분산화음을 얹었다.
 */
const _ = null;

const G = [55, 59, 62];
const Em = [52, 55, 59];
const C = [55, 60, 64];
const D = [54, 57, 62];
const Am = [57, 60, 64];
const Bm = [54, 59, 62];

const BARS: Bar[] = [
  // A: 들길 걷기
  { chord: G, bass: 43, melody: [74, _, 76, 74, 71, _, 69, _] },
  { chord: Em, bass: 40, melody: [67, _, 69, 71, 74, _, _, _] },
  { chord: C, bass: 48, melody: [76, _, 79, 76, 74, _, 71, _] },
  { chord: D, bass: 38, melody: [69, _, 71, 69, 67, _, 64, _] },
  { chord: G, bass: 43, melody: [74, _, 76, 79, 81, _, 79, 76] },
  { chord: Em, bass: 40, melody: [79, _, 76, 74, 71, _, 74, _] },
  { chord: Am, bass: 45, chord2: D, bass2: 38, melody: [69, 71, 74, 76, 74, _, 71, 69] },
  { chord: G, bass: 43, melody: [67, _, _, _, 62, _, 67, _] },
  // B: 냇물 따라
  { chord: C, bass: 48, melody: [76, _, 76, 79, 76, _, 74, _] },
  { chord: G, bass: 43, melody: [74, _, 71, 74, 67, _, _, _] },
  { chord: Em, bass: 40, melody: [71, _, 74, _, 76, 79, 76, 74] },
  { chord: D, bass: 38, melody: [69, _, _, 71, 74, _, _, _] },
  { chord: C, bass: 48, melody: [79, _, 81, 79, 76, _, 74, 76] },
  { chord: Bm, bass: 47, chord2: Em, bass2: 40, melody: [74, _, 71, _, 69, _, 67, 69] },
  { chord: Am, bass: 45, chord2: D, bass2: 38, melody: [71, _, 74, _, 69, 71, 69, 67] },
  { chord: G, bass: 43, melody: [67, _, 62, _, 67, _, _, _] },
];

export const VILLAGE_SONG: Song = {
  bpm: 96,
  bars: BARS,
  lead: 'sine',
  leadVolume: 0.3,
  leadLength: 1.7,
  drums: 'soft',
  arpVolume: 0.06,
};
