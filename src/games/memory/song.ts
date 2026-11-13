import type { Bar, Song } from '../../lib/music';

/**
 * 짝 맞추기 배경음악 — 직접 작곡한 곡 "까꿍 카드" (라장조, 120 BPM, 16마디)
 * 통통 튀는 짧은 음과 쉼표로 '뒤집었다 덮었다' 하는 느낌을 냈다.
 * 앞 8마디는 묻고 대답하는 가락, 9~12마디는 깡충 뛰는 가락, 끝 4마디는 신나게 올라갔다 돌아온다.
 */

// 라장조 화음 (가운데 도 근처)
const D = [54, 57, 62];
const G = [55, 59, 62];
const A = [52, 57, 61];
const Bm = [54, 59, 62];
const Em = [52, 55, 59];
const FsM = [54, 57, 61];
const _ = null;

const BARS: Bar[] = [
  // 묻는 가락
  { chord: D, bass: 38, melody: [78, 79, 81, _, 78, _, 74, _] },
  { chord: G, bass: 43, melody: [79, 81, 83, _, 79, _, 76, _] },
  { chord: A, bass: 45, melody: [76, 78, 79, 81, 79, _, 76, _] },
  { chord: D, bass: 38, melody: [78, _, 74, _, 69, _, _, 73] },
  // 대답하는 가락
  { chord: D, bass: 38, melody: [74, 78, 81, _, 86, _, 81, _] },
  { chord: Bm, bass: 47, melody: [83, _, 81, 78, 74, _, 78, _] },
  { chord: G, bass: 43, chord2: A, bass2: 45, melody: [79, 79, 81, 79, 76, _, 73, _] },
  { chord: D, bass: 38, melody: [74, _, 81, _, 74, _, _, _] },
  // 깡충깡충
  { chord: G, bass: 43, melody: [83, _, 79, _, 83, _, 86, _] },
  { chord: FsM, bass: 42, melody: [85, _, 81, _, 78, _, 81, _] },
  { chord: Em, bass: 40, melody: [79, 78, 76, _, 83, _, 79, _] },
  { chord: A, bass: 45, melody: [76, _, 73, _, 69, 71, 73, _] },
  // 신나게 올라갔다가 처음으로
  { chord: D, bass: 38, melody: [74, 76, 78, 74, 81, _, 78, _] },
  { chord: G, bass: 43, melody: [79, 81, 83, 79, 86, _, 83, _] },
  { chord: Em, bass: 40, chord2: A, bass2: 45, melody: [81, 79, 78, 76, 73, _, 76, _] },
  { chord: D, bass: 38, melody: [74, _, 78, _, 74, _, 76, _] },
];

export const MEMORY_SONG: Song = {
  bpm: 120,
  bars: BARS,
  lead: 'square',
  leadVolume: 0.075,
  leadLength: 0.8,
  drums: 'soft',
  arpVolume: 0.07,
};
