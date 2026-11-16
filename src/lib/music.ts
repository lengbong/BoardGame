import { closeBus, compile, createBus, scoreSeconds, ScorePlayer, type Bus, type Score } from './orchestra';
import { getAudioContext, noiseBuffer } from './sound';

/**
 * 직접 작곡한 짧은 배경음악들 (각 16마디 반복).
 * - travel: 여행풍 (다장조, 112 BPM) — 지구 한 바퀴
 * - party: 통통 튀는 카드놀이풍 (사장조, 128 BPM) — 한 장 남았다!
 * - puzzle: 차분한 퍼즐풍 (바장조, 100 BPM) — 숫자 타일 줄세우기
 * WebAudio로 실시간 합성하므로 음원 파일이 필요 없다.
 *
 * 새 게임은 자기 폴더에 Song 객체를 만들어 startMusic(song)으로 틀 수 있다. (예: games/sudoku/song.ts)
 * 금관·현악·팀파니가 있는 큰 곡은 orchestra.ts의 Score로 쓰고 같은 startMusic으로 튼다.
 * 짧은 팡파르는 playJingle(score): 배경음악이 잠깐 멈췄다가 팡파르가 끝나면 다음 마디부터 이어진다.
 * 자주 나오는 팡파르는 playJingle(score, { duck: 0.25 }): 배경음악을 멈추지 않고 작게 깔아 둔다.
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
let playing: Playable | null = null;
let timer: number | null = null;
let step = 0;
let nextTime = 0;
/** 오케스트라 곡을 연주하는 중이면 */
let player: ScorePlayer | null = null;
let songBus: Bus | null = null;
/** 옛 곡(8분음표 곡)이 팡파르 때문에 멈춰 있으면 */
let heldOld = false;
let currentVolume = 0.16;
/** 팡파르가 끝나는 시각. 그때까지 배경음악은 쉰다. */
let quietUntil = 0;
let jingleBus: Bus | null = null;
let unlockArmed = false;

/** 배경음악으로 틀 수 있는 것: 기존 곡 이름, 8분음표 곡(Song), 오케스트라 악보(Score) */
export type Playable = SongId | Song | Score;

function isScore(x: Playable): x is Score {
  return typeof x === 'object' && 'kind' in x && x.kind === 'orchestra';
}

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

/** 브라우저가 소리를 막아 두었으면 첫 클릭·키 입력 때 풀어 준다 */
function unlockOnGesture(ac: AudioContext): void {
  if (ac.state === 'running' || unlockArmed) return;
  unlockArmed = true;
  const unlock = () => {
    void ac.resume();
    unlockArmed = false;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

function fadeOut(g: AudioParam, now: number, seconds: number): void {
  g.cancelScheduledValues(now);
  g.setValueAtTime(Math.max(g.value, 0.0001), now);
  g.exponentialRampToValueAtTime(0.0001, now + seconds);
}

function fadeIn(g: AudioParam, now: number, from: number, volume: number, seconds: number): void {
  g.cancelScheduledValues(now);
  g.setValueAtTime(0.0001, now);
  g.setValueAtTime(0.0001, from);
  g.exponentialRampToValueAtTime(volume, from + seconds);
}

/** 곡 이름(기존 곡), 게임 폴더에서 만든 Song 객체, 오케스트라 악보(Score)를 반복 재생한다. 같은 곡이 이미 나오고 있으면 그대로 둔다. */
export function startMusic(songId: Playable = 'travel', volume = 0.16): void {
  const ac = getAudioContext();
  if (!ac) return;
  unlockOnGesture(ac);
  if (timer !== null) {
    if (playing === songId) return;
    stopSong();
  }
  if (playing !== songId) step = 0;
  playing = songId;
  currentVolume = isScore(songId) ? (songId.volume ?? volume) : volume;
  // 팡파르가 나오는 중이면 끝난 뒤에 시작한다
  const from = Math.max(ac.currentTime, quietUntil);
  if (isScore(songId)) {
    const bus = createBus(ac, 0.0001);
    fadeIn(bus.master.gain, ac.currentTime, from, currentVolume, 1.2);
    const p = new ScorePlayer(compile(songId), bus, from + 0.1);
    master = bus.master;
    player = p;
    songBus = bus;
    timer = window.setInterval(() => {
      const now = ac.currentTime;
      if (p.isHeld) {
        if (now < quietUntil) return;
        p.resume(now + 0.05);
        fadeIn(bus.master.gain, now, now, currentVolume, 1.5);
      }
      // 화면이 바쁠 때 끊기지 않게 조금 넉넉히 앞당겨 예약한다
      p.pump(now + 0.35, now - 0.03);
    }, 40);
    return;
  }
  const song = typeof songId === 'string' ? SONGS[songId] : songId;
  const EIGHTH = 60 / song.bpm / 2;
  master = ac.createGain();
  master.gain.setValueAtTime(0.0001, ac.currentTime);
  if (from > ac.currentTime) master.gain.setValueAtTime(0.0001, from);
  master.gain.exponentialRampToValueAtTime(volume, from + 1.2);
  master.connect(ac.destination);
  nextTime = from + 0.1;
  const out = master;
  timer = window.setInterval(() => {
    if (heldOld) {
      if (ac.currentTime < quietUntil) return;
      heldOld = false;
      nextTime = ac.currentTime + 0.05;
      fadeIn(out.gain, ac.currentTime, ac.currentTime, currentVolume, 1.5);
    }
    // 탭이 백그라운드였다가 돌아오면 밀린 음을 한꺼번에 내지 않고 건너뛴다.
    if (nextTime < ac.currentTime - 0.05) nextTime = ac.currentTime + 0.05;
    while (nextTime < ac.currentTime + 0.2) {
      scheduleStep(ac, out, song, step, nextTime);
      step += 1;
      nextTime += EIGHTH;
    }
  }, 40);
}

/** 배경음악만 끈다 (팡파르는 그대로) */
function stopSong(): void {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
  const ac = getAudioContext();
  if (master && ac) {
    const g = master;
    const bus = songBus;
    fadeOut(g.gain, ac.currentTime, 0.4);
    window.setTimeout(() => (bus ? closeBus(bus) : g.disconnect()), 600);
  }
  master = null;
  player = null;
  songBus = null;
  heldOld = false;
}

/** 배경음악과 나오고 있는 팡파르를 모두 끈다 */
export function stopMusic(): void {
  stopSong();
  const ac = getAudioContext();
  if (jingleBus && ac) {
    const bus = jingleBus;
    fadeOut(bus.master.gain, ac.currentTime, 0.3);
    window.setTimeout(() => closeBus(bus), 500);
  }
  jingleBus = null;
  quietUntil = 0;
}

export interface JingleOptions {
  /** 소리 크기 (악보에 volume이 있으면 그것) */
  volume?: number;
  /**
   * 배경음악을 멈추지 않고 이만큼(0~1)으로 줄여 겹친다. 자주 나오는 팡파르(새 노선 취항)용.
   * 없으면 배경음악을 멈췄다가 팡파르가 끝나면 다음 마디부터 다시 (분기 결산, 게임 끝).
   */
  duck?: number;
}

/** 배경음악 소리를 잠깐 줄였다가 end초부터 다시 키운다 */
function duckSong(g: AudioParam, now: number, end: number, volume: number, level: number): void {
  const low = Math.max(volume * level, 0.0001);
  g.cancelScheduledValues(now);
  g.setValueAtTime(Math.max(g.value, 0.0001), now);
  g.linearRampToValueAtTime(low, now + 0.15);
  g.setValueAtTime(low, end);
  g.linearRampToValueAtTime(volume, end + 1);
}

/**
 * 짧은 팡파르를 한 번 연주한다 (분기 결산, 게임 끝, 새 노선 취항).
 * 나오던 배경음악은 소리를 줄여 멈추고, 팡파르가 끝나면 다음 마디부터 다시 커진다.
 * duck을 주면 멈추지 않고 작게 깔아 둔다. (다른 팡파르 때문에 이미 쉬는 중이면 그대로 쉬다가 이 팡파르 뒤에 이어진다)
 */
export function playJingle(score: Score, options: JingleOptions = {}): void {
  const ac = getAudioContext();
  if (!ac) return;
  unlockOnGesture(ac);
  const now = ac.currentTime;
  const start = now + 0.12;
  const seconds = scoreSeconds(score);
  const end = start + seconds;
  const resting = now < quietUntil;
  if (options.duck !== undefined && !resting) {
    if (master && timer !== null) duckSong(master.gain, now, end, currentVolume, options.duck);
  } else {
    if (master && timer !== null) {
      fadeOut(master.gain, now, 0.25);
      if (player) player.hold(now);
      else if (!heldOld) {
        heldOld = true;
        step = Math.ceil(step / STEPS_PER_BAR) * STEPS_PER_BAR;
      }
    }
    quietUntil = end + 0.3;
  }
  if (jingleBus) {
    const old = jingleBus;
    fadeOut(old.master.gain, now, 0.2);
    window.setTimeout(() => closeBus(old), 400);
  }
  const bus = createBus(ac, score.volume ?? options.volume ?? 0.2);
  new ScorePlayer(compile(score), bus, start).pump(Infinity);
  jingleBus = bus;
  window.setTimeout(
    () => {
      closeBus(bus);
      if (jingleBus === bus) jingleBus = null;
    },
    (seconds + 4) * 1000,
  );
}

export function isMusicPlaying(): boolean {
  return timer !== null;
}
