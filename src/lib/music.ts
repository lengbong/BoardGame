import { getAudioContext, noiseBuffer } from './sound';

/**
 * 직접 작곡한 짧은 배경음악들 (각 16마디 반복).
 * - travel: 여행풍 (다장조, 112 BPM) — 지구 한 바퀴
 * - party: 통통 튀는 카드놀이풍 (사장조, 128 BPM) — 한 장 남았다!
 * - puzzle: 차분한 퍼즐풍 (바장조, 100 BPM) — 숫자 타일 줄세우기
 * WebAudio로 실시간 합성하므로 음원 파일이 필요 없다.
 *
 * 새 게임은 자기 폴더에 Song 객체를 만들어 startMusic(song)으로 틀 수 있다. (예: games/sudoku/song.ts)
 */

const STEPS_PER_BAR = 8;

/**
 * 한 마디 = 8분음표 8개. 음 높이는 MIDI 번호 (60 = 가운데 도).
 * chord2/bass2가 있으면 마디 뒤쪽 절반(5~8번째 8분음표)은 그 화음으로 바뀐다.
 */
export type Bar = { chord: number[]; bass: number; melody: (number | null)[]; chord2?: number[]; bass2?: number };

export type SongId = 'travel' | 'party' | 'puzzle';

export interface Song {
  bpm: number;
  bars: Bar[];
  /** 멜로디 음색과 크기 */
  lead: OscillatorType;
  leadVolume: number;
  /** 멜로디 음 길이 (8분음표 배수) */
  leadLength: number;
  /** 북·하이햇: full(기본) / soft(작게, 킥은 마디 첫 박만) / none */
  drums?: 'full' | 'soft' | 'none';
  /** 분산화음 크기 (기본 0.09, 0이면 끔) */
  arpVolume?: number;
}

const C = [60, 64, 67];
const Am = [57, 60, 64];
const F = [57, 60, 65];
const G = [55, 59, 62];
const Em = [55, 59, 64];
const Dm = [57, 62, 65];
const _ = null;

const TRAVEL: Bar[] = [
  { chord: C, bass: 48, melody: [76, _, 79, _, 81, 79, 76, _] },
  { chord: Am, bass: 45, melody: [72, _, 76, _, 74, 72, 69, _] },
  { chord: F, bass: 41, melody: [69, _, 72, _, 77, 76, 72, _] },
  { chord: G, bass: 43, melody: [74, _, _, 71, 67, _, _, _] },
  { chord: C, bass: 48, melody: [76, _, 79, _, 84, 83, 81, 79] },
  { chord: Em, bass: 40, melody: [79, _, 76, _, 71, _, 76, _] },
  { chord: F, bass: 41, chord2: G, bass2: 43, melody: [77, 76, 74, 72, 71, 72, 74, _] },
  { chord: C, bass: 48, melody: [72, _, _, _, 67, _, 72, _] },
  { chord: F, bass: 41, melody: [81, _, 81, 79, 77, _, 81, _] },
  { chord: G, bass: 43, melody: [79, _, 77, 76, 74, _, 79, _] },
  { chord: Em, bass: 40, melody: [76, _, 79, _, 83, 81, 79, _] },
  { chord: Am, bass: 45, melody: [81, _, 76, _, 72, _, 76, _] },
  { chord: Dm, bass: 38, melody: [77, _, 74, _, 69, _, 74, 77] },
  { chord: G, bass: 43, melody: [79, _, 83, _, 86, _, 83, _] },
  { chord: C, bass: 48, melody: [84, 83, 81, 79, 76, _, 79, _] },
  { chord: G, bass: 43, melody: [74, _, 67, _, 71, _, 74, _] },
];

// 사장조에서 더 쓰는 화음 (G, Em, Am은 위와 같다)
const C2 = [55, 60, 64];
const D = [54, 57, 62];
const Bm = [54, 59, 62];

const PARTY: Bar[] = [
  { chord: G, bass: 43, melody: [74, _, 71, 74, 79, _, 78, 76] },
  { chord: Em, bass: 40, melody: [76, _, 71, 76, 79, _, 76, _] },
  { chord: C2, bass: 48, melody: [72, 74, 76, _, 79, _, 76, 74] },
  { chord: D, bass: 38, melody: [74, _, _, 69, 74, _, _, _] },
  { chord: G, bass: 43, melody: [74, _, 71, 74, 79, _, 81, 83] },
  { chord: Em, bass: 40, melody: [83, _, 81, 79, 76, _, 79, _] },
  { chord: C2, bass: 48, chord2: D, bass2: 38, melody: [76, 74, 72, 74, 76, _, 78, _] },
  { chord: G, bass: 43, melody: [79, _, 74, _, 67, _, _, _] },
  { chord: C2, bass: 48, melody: [76, _, 76, 74, 72, _, 76, _] },
  { chord: D, bass: 38, melody: [78, _, 78, 76, 74, _, 78, _] },
  { chord: Bm, bass: 47, melody: [78, _, 74, _, 71, _, 74, 78] },
  { chord: Em, bass: 40, melody: [79, _, 76, _, 71, _, 76, 79] },
  { chord: Am, bass: 45, melody: [81, _, 79, 76, 72, _, 76, _] },
  { chord: D, bass: 38, melody: [78, _, 81, _, 86, _, 81, 78] },
  { chord: G, bass: 43, chord2: Em, bass2: 40, melody: [79, 78, 76, 74, 76, _, 79, _] },
  { chord: D, bass: 38, melody: [74, _, 78, _, 81, _, 78, 74] },
];

// 바장조 화음
const FM = [53, 57, 60];
const Dm2 = [53, 57, 62];
const Bb = [53, 58, 62];
const Gm = [55, 58, 62];

const PUZZLE: Bar[] = [
  { chord: FM, bass: 41, melody: [72, _, 69, _, 65, _, 69, 72] },
  { chord: Dm2, bass: 38, melody: [74, _, 72, _, 69, _, 65, _] },
  { chord: Bb, bass: 46, melody: [70, _, 74, _, 77, _, 74, 72] },
  { chord: C2, bass: 48, melody: [72, _, _, _, 67, _, _, _] },
  { chord: FM, bass: 41, melody: [72, _, 69, 72, 77, _, 76, 74] },
  { chord: Am, bass: 45, melody: [72, _, 69, _, 64, _, 69, _] },
  { chord: Bb, bass: 46, chord2: C2, bass2: 48, melody: [70, 69, 67, 69, 70, _, 72, _] },
  { chord: FM, bass: 41, melody: [69, _, 65, _, _, _, _, _] },
  { chord: Dm2, bass: 38, melody: [74, _, 74, 76, 77, _, 74, _] },
  { chord: Gm, bass: 43, melody: [74, _, 70, _, 67, _, 70, 74] },
  { chord: C2, bass: 48, melody: [76, _, 72, _, 67, _, 72, 76] },
  { chord: FM, bass: 41, melody: [77, _, 72, _, 69, _, 72, _] },
  { chord: Bb, bass: 46, melody: [74, _, 77, _, 81, _, 77, 74] },
  { chord: Am, bass: 45, melody: [76, _, 72, _, 69, _, 72, _] },
  { chord: Gm, bass: 43, chord2: C2, bass2: 48, melody: [70, 72, 74, 72, 70, _, 67, _] },
  { chord: FM, bass: 41, melody: [65, _, 69, _, 72, _, _, _] },
];

const SONGS: Record<SongId, Song> = {
  travel: { bpm: 112, bars: TRAVEL, lead: 'triangle', leadVolume: 0.32, leadLength: 1.8 },
  party: { bpm: 128, bars: PARTY, lead: 'square', leadVolume: 0.09, leadLength: 0.9 },
  puzzle: { bpm: 100, bars: PUZZLE, lead: 'triangle', leadVolume: 0.26, leadLength: 1.6 },
};

const ARP = [0, 2, 1, 2, 0, 2, 1, 2];

function freq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

let master: GainNode | null = null;
let playing: SongId | Song | null = null;
let timer: number | null = null;
let step = 0;
let nextTime = 0;

function note(ac: AudioContext, out: AudioNode, midi: number, t: number, dur: number, type: OscillatorType, vol: number, attack = 0.01): void {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq(midi), t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function hat(ac: AudioContext, out: AudioNode, t: number, vol: number): void {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  src.connect(hp).connect(g).connect(out);
  src.start(t, Math.random() * 0.5, 0.06);
}

function kick(ac: AudioContext, out: AudioNode, t: number): void {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.2);
}

function scheduleStep(ac: AudioContext, out: AudioNode, song: Song, s: number, t: number): void {
  const EIGHTH = 60 / song.bpm / 2;
  const bar = song.bars[Math.floor(s / STEPS_PER_BAR) % song.bars.length];
  const i = s % STEPS_PER_BAR;
  const secondHalf = i >= 4 && bar.chord2;
  const chord = secondHalf ? bar.chord2! : bar.chord;
  const bass = secondHalf ? bar.bass2! : bar.bass;

  // 멜로디 (마림바 느낌)
  const m = bar.melody[i];
  if (m !== null) {
    note(ac, out, m, t, EIGHTH * song.leadLength, song.lead, song.leadVolume);
    note(ac, out, m + 12, t, EIGHTH * 0.9, 'sine', 0.06);
  }
  // 분산화음
  const arpVolume = song.arpVolume ?? 0.09;
  if (arpVolume > 0) note(ac, out, chord[ARP[i] % chord.length] + 12, t, EIGHTH * 0.9, 'sine', arpVolume);
  // 베이스: 1, 3박 근음, 4박 5도
  if (i === 0 || i === 4) note(ac, out, bass, t, EIGHTH * 1.7, 'triangle', 0.34, 0.005);
  if (i === 6) note(ac, out, bass + 7, t, EIGHTH * 0.9, 'triangle', 0.22, 0.005);
  // 리듬
  const drums = song.drums ?? 'full';
  if (drums === 'full') {
    if (i === 0 || i === 4) kick(ac, out, t);
    if (i % 2 === 1) hat(ac, out, t, 0.12);
  } else if (drums === 'soft') {
    if (i === 0) kick(ac, out, t);
    if (i === 3 || i === 7) hat(ac, out, t, 0.05);
  }
  // 마디 첫 박에 부드러운 패드
  if (i === 0 || (i === 4 && bar.chord2)) {
    for (const n of chord) note(ac, out, n, t, EIGHTH * (bar.chord2 ? 3.8 : 7.8), 'sine', 0.035, 0.12);
  }
}

/** 곡 이름(기존 곡) 또는 게임 폴더에서 만든 Song 객체를 반복 재생한다. 같은 곡이 이미 나오고 있으면 그대로 둔다. */
export function startMusic(songId: SongId | Song = 'travel', volume = 0.16): void {
  const ac = getAudioContext();
  if (!ac) return;
  if (timer !== null) {
    if (playing === songId) return;
    stopMusic();
  }
  if (playing !== songId) step = 0;
  playing = songId;
  const song = typeof songId === 'string' ? SONGS[songId] : songId;
  const EIGHTH = 60 / song.bpm / 2;
  master = ac.createGain();
  master.gain.setValueAtTime(0.0001, ac.currentTime);
  master.gain.exponentialRampToValueAtTime(volume, ac.currentTime + 1.2);
  master.connect(ac.destination);
  nextTime = ac.currentTime + 0.1;
  const out = master;
  timer = window.setInterval(() => {
    // 탭이 백그라운드였다가 돌아오면 밀린 음을 한꺼번에 내지 않고 건너뛴다.
    if (nextTime < ac.currentTime - 0.05) nextTime = ac.currentTime + 0.05;
    while (nextTime < ac.currentTime + 0.2) {
      scheduleStep(ac, out, song, step, nextTime);
      step += 1;
      nextTime += EIGHTH;
    }
  }, 40);
}

export function stopMusic(): void {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
  const ac = getAudioContext();
  if (master && ac) {
    const g = master;
    g.gain.cancelScheduledValues(ac.currentTime);
    g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.4);
    window.setTimeout(() => g.disconnect(), 600);
  }
  master = null;
}

export function isMusicPlaying(): boolean {
  return timer !== null;
}
