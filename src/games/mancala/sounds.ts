import { burst, tone } from '../../lib/sound';

/** 만칼라 효과음: 나무 구멍에 조약돌이 똑똑 떨어지는 소리 (모두 합성음) */

const PENTA = [0, 2, 4, 7, 9];

function freq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** 마림바처럼 들리는 짧은 음: 사인파 + 아주 짧은 높은 배음 */
function mallet(midi: number, start: number, volume = 0.08, length = 0.22): void {
  const f = freq(midi);
  tone(f, start, length, 'sine', volume);
  tone(f * 3.98, start, 0.04, 'sine', volume * 0.22);
  tone(f * 2, start, length * 0.5, 'triangle', volume * 0.18);
}

export const mcSfx = {
  /** 구멍에서 씨앗을 한 움큼 집어 올릴 때 (달그락) */
  pickup(count: number) {
    const n = Math.min(6, Math.max(2, count));
    for (let i = 0; i < n; i++) burst(i * 0.028 + Math.random() * 0.01, 0.04, 1700 + Math.random() * 1500, 5, 0.1);
  },
  /** 씨앗 한 알이 떨어질 때. n번째 씨앗일수록 5음계로 조금씩 높아진다. 창고는 더 깊은 소리 */
  drop(n: number, store: boolean) {
    const deg = n % 10;
    const midi = 76 + PENTA[deg % 5] + 12 * Math.floor(deg / 5);
    burst(0, 0.03, store ? 1300 : 2900 + Math.random() * 500, 6, store ? 0.26 : 0.2);
    if (store) {
      tone(185, 0, 0.14, 'triangle', 0.1, 150);
      mallet(midi - 12, 0.005, 0.05, 0.18);
    } else {
      mallet(midi, 0.004, 0.045, 0.12);
    }
  },
  /** 건너편 씨앗을 가져올 때: 휙 쓸어 담는 소리 + 우르르 */
  capture(count: number) {
    burst(0, 0.32, 450, 1.1, 0.16, 2600);
    const n = Math.min(9, count);
    for (let i = 0; i < n; i++) burst(0.22 + i * 0.04 + Math.random() * 0.012, 0.035, 1800 + i * 140, 6, 0.18);
    [69, 72, 76].forEach((m, i) => mallet(m, 0.2 + i * 0.07, 0.07, 0.25));
  },
  /** 창고에서 끝나 한 번 더 */
  extra() {
    [72, 76, 79, 84].forEach((m, i) => mallet(m, i * 0.075, 0.09, i === 3 ? 0.45 : 0.2));
  },
  /** 끝날 때 남은 씨앗을 창고로 쓸어 담을 때 */
  sweep() {
    burst(0, 0.5, 600, 0.9, 0.12, 1800);
    for (let i = 0; i < 10; i++) burst(0.1 + i * 0.05 + Math.random() * 0.02, 0.035, 1600 + Math.random() * 1600, 6, 0.12);
  },
  /** 우승: 마림바 5음계 오르막과 화음 */
  win() {
    [67, 69, 72, 74, 76, 79, 81, 84].forEach((m, i) => mallet(m, i * 0.09, 0.09, i === 7 ? 0.8 : 0.22));
    [60, 64, 67, 72].forEach((m) => mallet(m, 0.78, 0.05, 1.1));
  },
  /** 비김: 부드러운 두 화음 */
  draw() {
    [72, 76, 79].forEach((m) => mallet(m, 0, 0.06, 0.6));
    [74, 77, 81].forEach((m) => mallet(m - 2, 0.45, 0.06, 0.9));
  },
};
