import type { Bar, Song } from '../../lib/music';

/**
 * 스도쿠 배경음악 「고요한 칸」 — 직접 작곡 (라장조, 88 BPM, 북 없음).
 * 생각을 방해하지 않도록 느리고 부드러운 사인파 멜로디, 긴 음과 쉼표가 많다.
 */
const _ = null;

// 라장조 화음 (가운데 도 아래 음역)
const D = [50, 54, 57];
const Dadd9 = [52, 54, 57];
const Bm = [50, 54, 59];
const G = [50, 55, 59];
const Gmaj7 = [54, 55, 59];
const A = [49, 52, 57];
const Asus = [50, 52, 57];
const Em = [52, 55, 59];
const Fsm = [49, 54, 57];

const BARS: Bar[] = [
  // 1~4: 천천히 올라갔다 내려오는 물음
  { chord: D, bass: 38, melody: [66, _, 69, _, 74, _, 73, 71] },
  { chord: Bm, bass: 47, melody: [69, _, _, _, 66, _, 64, _] },
  { chord: Gmaj7, bass: 43, melody: [67, _, 71, _, 74, _, 76, 74] },
  { chord: Asus, bass: 45, chord2: A, bass2: 45, melody: [73, _, _, _, 69, _, _, _] },
  // 5~8: 같은 물음을 조금 높게, 그리고 쉬어 가는 대답
  { chord: D, bass: 38, melody: [66, _, 69, _, 74, _, 78, _] },
  { chord: Fsm, bass: 42, melody: [76, _, 73, _, 69, _, 73, _] },
  { chord: G, bass: 43, chord2: A, bass2: 45, melody: [71, _, 74, _, 73, _, 71, 69] },
  { chord: Dadd9, bass: 38, melody: [69, _, _, _, 62, _, _, _] },
  // 9~12: 단조 쪽으로 살짝 생각에 잠김
  { chord: Em, bass: 40, melody: [71, _, 67, _, 64, _, 67, 71] },
  { chord: Bm, bass: 47, melody: [74, _, 71, _, 66, _, _, _] },
  { chord: G, bass: 43, melody: [67, _, 71, _, 74, _, 79, _] },
  { chord: Dadd9, bass: 38, melody: [78, _, 76, _, 74, _, _, _] },
  // 13~16: 천천히 내려와 처음으로 돌아감
  { chord: Gmaj7, bass: 43, melody: [79, _, 78, _, 76, _, 74, _] },
  { chord: Fsm, bass: 42, chord2: Bm, bass2: 47, melody: [73, _, 69, _, 71, _, 74, _] },
  { chord: Em, bass: 40, chord2: Asus, bass2: 45, melody: [76, _, 74, _, 73, _, 71, _] },
  { chord: D, bass: 38, melody: [74, _, _, _, 69, _, 66, _] },
];

export const SUDOKU_SONG: Song = {
  bpm: 88,
  bars: BARS,
  lead: 'sine',
  leadVolume: 0.22,
  leadLength: 2.6,
  drums: 'none',
  arpVolume: 0.05,
};
