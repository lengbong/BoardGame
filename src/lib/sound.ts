/** 외부 파일 없이 WebAudio로 간단한 효과음을 만든다. */
let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}

function audio(): AudioContext | null {
  if (muted) return null;
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

export const sfx = {
  roll() {
    for (let i = 0; i < 5; i++) tone(300 + Math.random() * 400, i * 0.06, 0.04, 'square', 0.05);
  },
  step() {
    tone(660, 0, 0.05, 'triangle', 0.08);
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
    [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.22, 'triangle', 0.14));
  },
  noMove() {
    tone(220, 0, 0.18, 'sine', 0.1, 180);
  },
};
