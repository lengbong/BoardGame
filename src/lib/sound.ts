/** 외부 파일 없이 WebAudio로 효과음을 만든다. */
let ctx: AudioContext | null = null;
let muted = false;
let noise: AudioBuffer | null = null;

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}

/** 공용 AudioContext (배경음악도 같이 쓴다). 브라우저가 막으면 null */
export function getAudioContext(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function audio(): AudioContext | null {
  return muted ? null : getAudioContext();
}

export function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (!noise || noise.sampleRate !== ac.sampleRate) {
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', volume = 0.15, endFreq?: number): void {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** 짧은 잡음 (주사위 달그락, 카드 넘기는 소리) */
function burst(start: number, duration: number, freq: number, q: number, volume: number, sweepTo?: number): void {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + start;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq, t0);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t0 + duration);
  filter.Q.value = q;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t0, Math.random() * 0.5, duration + 0.05);
}

export const sfx = {
  roll() {
    for (let i = 0; i < 7; i++) burst(i * 0.055 + Math.random() * 0.02, 0.05, 1800 + Math.random() * 1600, 6, 0.35);
    burst(0.42, 0.08, 1200, 4, 0.3);
  },
  step() {
    tone(660, 0, 0.05, 'triangle', 0.08);
  },
  /** 말이 한 칸 뛸 때. n이 클수록 조금씩 높아진다 */
  hop(n = 0) {
    const f = 520 + Math.min(n, 12) * 28;
    tone(f, 0, 0.09, 'sine', 0.09, f * 1.5);
  },
  enter() {
    tone(523, 0, 0.1, 'triangle');
    tone(784, 0.09, 0.14, 'triangle');
  },
  capture() {
    tone(700, 0, 0.35, 'sawtooth', 0.08, 120);
  },
  finish() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.15, 'triangle', 0.12));
  },
  win() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.13, i === 6 ? 0.6 : 0.22, 'triangle', 0.14));
    [262, 330, 392].forEach((f) => tone(f, 0.78, 0.7, 'sine', 0.06));
  },
  noMove() {
    tone(220, 0, 0.18, 'sine', 0.1, 180);
  },
  coin() {
    tone(988, 0, 0.08, 'square', 0.05);
    tone(1319, 0.07, 0.22, 'square', 0.05);
    tone(2637, 0.07, 0.18, 'sine', 0.03);
  },
  build() {
    [392, 523, 659].forEach((f, i) => tone(f, i * 0.07, 0.12, 'triangle', 0.1));
    burst(0.02, 0.12, 300, 1.5, 0.25);
  },
  pay() {
    tone(523, 0, 0.1, 'triangle', 0.1);
    tone(392, 0.09, 0.18, 'triangle', 0.1);
  },
  income() {
    tone(784, 0, 0.08, 'triangle', 0.09);
    tone(1047, 0.07, 0.16, 'triangle', 0.09);
  },
  card() {
    burst(0, 0.18, 800, 1.2, 0.25, 3000);
    tone(880, 0.18, 0.08, 'sine', 0.08);
    tone(1175, 0.26, 0.14, 'sine', 0.08);
  },
  turn() {
    tone(1047, 0, 0.25, 'sine', 0.05);
    tone(1568, 0.06, 0.3, 'sine', 0.035);
  },
  plane() {
    burst(0, 0.7, 400, 0.8, 0.18, 2400);
  },
  bankrupt() {
    [392, 370, 349, 262].forEach((f, i) => tone(f, i * 0.22, i === 3 ? 0.6 : 0.24, 'sawtooth', 0.06));
  },
  /** 카드를 탁 내려놓는 소리 */
  cardPlay() {
    burst(0, 0.06, 2600, 1.4, 0.32);
    tone(196, 0, 0.07, 'triangle', 0.1, 120);
  },
  /** 카드를 스르륵 뽑는 소리. n장이면 n번 */
  cardDraw(n = 1) {
    for (let i = 0; i < Math.min(n, 6); i++) burst(i * 0.07, 0.11, 900, 1.1, 0.16, 2800);
  },
  shuffle() {
    for (let i = 0; i < 12; i++) burst(i * 0.035 + Math.random() * 0.01, 0.045, 1800 + Math.random() * 1800, 3, 0.18);
  },
  /** '한 장 남았다!' 외치는 소리 */
  shout() {
    [784, 988, 1175].forEach((f, i) => tone(f, i * 0.07, 0.12, 'square', 0.045));
    tone(1568, 0.21, 0.3, 'triangle', 0.1);
  },
  skip() {
    tone(587, 0, 0.1, 'square', 0.04);
    tone(392, 0.1, 0.2, 'square', 0.04);
  },
  reverse() {
    tone(380, 0, 0.22, 'sine', 0.1, 900);
    tone(900, 0.18, 0.22, 'sine', 0.08, 380);
  },
  /** 색 바꾸기 */
  wild() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.05, 0.16, 'sine', 0.08));
  },
  /** 카드를 여러 장 받거나 벌칙을 받을 때 */
  penalty() {
    tone(330, 0, 0.16, 'sawtooth', 0.05, 250);
    tone(250, 0.15, 0.3, 'sawtooth', 0.05, 160);
  },
};
