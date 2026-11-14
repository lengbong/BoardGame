import { burst, sfx, tone } from '../../lib/sound';
import type { BuildKind, Resource } from './types';

/** 자원마다 '퐁' 소리의 높이 */
const RES_PITCH: Record<Resource, number> = { wood: 523, stone: 440, grain: 659, fish: 784 };

/** 섬마을 개척 효과음 (모두 합성음) */
export const isSound = {
  /** 주사위 두 개가 나무 쟁반에서 달그락 */
  roll() {
    for (let i = 0; i < 9; i++) burst(i * 0.05 + Math.random() * 0.02, 0.045, 1500 + Math.random() * 1800, 5, 0.28);
    burst(0.5, 0.07, 900, 3, 0.3);
    tone(160, 0.5, 0.08, 'sine', 0.12, 110);
    burst(0.62, 0.06, 1100, 3, 0.22);
  },
  /** 자원을 받을 때 퐁퐁 (여러 개면 차례로) */
  gain(list: Resource[]) {
    list.slice(0, 8).forEach((r, i) => tone(RES_PITCH[r], i * 0.06, 0.1, 'sine', 0.07, RES_PITCH[r] * 1.5));
  },
  /** 나무를 똑똑 두드리는 소리 (짓기) */
  knock(times = 2) {
    for (let i = 0; i < times; i++) {
      burst(i * 0.13, 0.05, 700, 4, 0.4);
      tone(190, i * 0.13, 0.07, 'triangle', 0.16, 130);
    }
  },
  build(kind: BuildKind) {
    if (kind === 'road') {
      isSound.knock(1);
      return;
    }
    isSound.knock(2);
    if (kind === 'house') [523, 659].forEach((f, i) => tone(f, 0.28 + i * 0.08, 0.14, 'triangle', 0.08));
    if (kind === 'hall') [523, 659, 784].forEach((f, i) => tone(f, 0.28 + i * 0.08, 0.16, 'triangle', 0.09));
    if (kind === 'lighthouse') {
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.28 + i * 0.09, 0.3, 'sine', 0.07));
      tone(392, 0.28, 0.6, 'sine', 0.05);
    }
  },
  /** 바꾸기: 파도가 쏴아 밀려왔다 빠지는 소리 */
  swish() {
    burst(0, 0.32, 350, 0.9, 0.22, 2200);
    burst(0.26, 0.4, 2200, 0.9, 0.16, 420);
  },
  /** 축제 깃발: 갈매기 끼룩끼룩 */
  gull() {
    tone(1480, 0, 0.17, 'triangle', 0.07, 1050);
    tone(1650, 0.22, 0.2, 'triangle', 0.07, 1120);
    tone(1500, 0.48, 0.28, 'sawtooth', 0.02, 980);
    [659, 784, 988].forEach((f, i) => tone(f, 0.75 + i * 0.09, 0.2, 'triangle', 0.08));
  },
  /** 손 제한으로 내려놓기: 툭 */
  discard() {
    tone(220, 0, 0.14, 'sine', 0.12, 150);
    burst(0, 0.08, 500, 2, 0.2);
  },
  select() {
    tone(980, 0, 0.04, 'triangle', 0.05);
  },
  nope() {
    sfx.noMove();
  },
  win() {
    sfx.win();
  },
};
