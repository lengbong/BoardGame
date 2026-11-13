import type { Bar, Song } from '../../lib/music';

/**
 * 도미노 배경음악: 느긋한 카페풍 라틴 그루브 (라장조, 108 BPM).
 * 7화음(maj7·m7·7)을 촘촘하게 쌓고, 멜로디는 엇박에서 시작하는 싱커페이션으로 보사노바 느낌을 낸다.
 * 이 프로젝트에서 새로 지은 곡이다.
 */

// 화음 (가운데 도 근처에 촘촘하게)
const Dmaj7 = [57, 61, 62, 66];
const Bm7 = [57, 59, 62, 66];
const Em7 = [55, 59, 62, 64];
const A7 = [55, 57, 61, 64];
const Fsm7 = [57, 61, 64, 66];
const Gmaj7 = [54, 59, 62, 67];
const E7 = [56, 59, 62, 64];
const D6 = [57, 59, 62, 66];
const _ = null;

const BARS: Bar[] = [
  { chord: Dmaj7, bass: 38, melody: [78, _, 76, 73, _, 69, _, 71] },
  { chord: Bm7, bass: 47, melody: [_, 74, _, 71, 69, _, 66, _] },
  { chord: Em7, bass: 40, melody: [67, _, 71, 74, _, 76, _, 74] },
  { chord: A7, bass: 45, melody: [73, _, _, 69, _, 67, 64, _] },
  { chord: Dmaj7, bass: 38, melody: [66, _, 69, 73, _, 76, _, 78] },
  { chord: Fsm7, bass: 42, melody: [_, 76, _, 73, 69, _, 73, _] },
  { chord: Gmaj7, bass: 43, chord2: A7, bass2: 45, melody: [71, 74, _, 78, 76, _, 73, _] },
  { chord: Dmaj7, bass: 38, melody: [74, _, _, _, 69, _, _, _] },
  { chord: Gmaj7, bass: 43, melody: [_, 79, _, 78, 74, _, 71, _] },
  { chord: Fsm7, bass: 42, melody: [73, _, 76, _, 81, _, 78, _] },
  { chord: Em7, bass: 40, melody: [_, 79, 78, 76, _, 71, _, 74] },
  { chord: A7, bass: 45, melody: [76, _, 73, _, 67, _, 69, _] },
  { chord: Bm7, bass: 47, melody: [_, 74, _, 78, 81, _, 78, _] },
  { chord: E7, bass: 40, melody: [80, _, 76, _, 74, _, 71, _] },
  { chord: Em7, bass: 40, chord2: A7, bass2: 45, melody: [_, 71, 74, _, 79, _, 76, 73] },
  { chord: D6, bass: 38, chord2: A7, bass2: 45, melody: [74, _, 66, _, 69, _, _, _] },
];

export const DOMINO_SONG: Song = {
  bpm: 108,
  bars: BARS,
  lead: 'triangle',
  leadVolume: 0.24,
  leadLength: 1.3,
  drums: 'soft',
  arpVolume: 0.06,
};
