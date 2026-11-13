import { burst, sfx, tone } from '../../lib/sound';

/** 말랑 팡팡 효과음 (모두 합성음) */
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export const mpSound = {
  move() {
    tone(880, 0, 0.025, 'square', 0.018);
  },
  rotate() {
    tone(1180, 0, 0.04, 'triangle', 0.045, 1500);
  },
  /** 젤리가 바닥에 닿음: 말랑 */
  land() {
    tone(260, 0, 0.09, 'sine', 0.13, 150);
    burst(0, 0.04, 500, 1.2, 0.08);
  },
  hardDrop() {
    burst(0, 0.07, 280, 1, 0.3);
    tone(140, 0, 0.12, 'sine', 0.2, 80);
  },
  /** 팡! 연쇄가 길수록 높아진다 */
  pop(chain: number) {
    const base = 67 + SCALE[Math.min(chain - 1, SCALE.length - 1)];
    tone(midi(base), 0, 0.09, 'sine', 0.16, midi(base) * 0.6);
    tone(midi(base + 7), 0.06, 0.1, 'triangle', 0.1);
    tone(midi(base + 12), 0.12, 0.16, 'triangle', 0.08);
    burst(0, 0.05, 2400, 2, 0.12);
    if (chain >= 3) tone(midi(base + 19), 0.2, 0.25, 'sine', 0.07);
  },
  /** 방해 젤리를 보냄: 휘익 */
  send(amount: number) {
    burst(0, 0.35, 500, 1, 0.12 + Math.min(0.15, amount / 200), 3000);
  },
  /** 내게 올 방해 젤리를 막음 */
  offset() {
    [1319, 1568, 1976].forEach((f, i) => tone(f, i * 0.05, 0.1, 'sine', 0.05));
  },
  /** 방해 젤리가 쿵쿵 떨어짐 */
  garbage(amount: number) {
    const n = Math.min(6, 1 + Math.floor(amount / 6));
    for (let i = 0; i < n; i++) {
      burst(i * 0.07, 0.08, 220, 0.9, 0.3);
      tone(110 - i * 6, i * 0.07, 0.1, 'sine', 0.18, 60);
    }
  },
  allClear() {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.07, 0.2, 'triangle', 0.1));
  },
  levelUp() {
    [659, 784, 988, 1319].forEach((f, i) => tone(f, i * 0.06, 0.12, 'square', 0.04));
  },
  /** 3·2·1 */
  count(last: boolean) {
    tone(last ? 1047 : 660, 0, last ? 0.35 : 0.14, 'triangle', 0.12);
  },
  /** 위험할 때 콩콩 */
  danger() {
    tone(988, 0, 0.06, 'square', 0.025);
    tone(988, 0.12, 0.06, 'square', 0.025);
  },
  lose() {
    [523, 466, 415, 349].forEach((f, i) => tone(f, i * 0.16, 0.18, 'triangle', 0.1));
    tone(175, 0.66, 0.5, 'sawtooth', 0.05, 90);
  },
  win() {
    sfx.win();
  },
  pause() {
    tone(784, 0, 0.08, 'sine', 0.08);
    tone(523, 0.08, 0.12, 'sine', 0.08);
  },
};
