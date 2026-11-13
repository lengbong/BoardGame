import { burst, sfx, tone } from '../../lib/sound';

/** 거짓말쟁이 효과음 (모두 합성음) */
export const chSound = {
  deal() {
    sfx.shuffle();
  },
  /** 카드 고르기 */
  select(on: boolean) {
    tone(on ? 1100 : 760, 0, 0.04, 'triangle', 0.05);
  },
  /** 카드를 뒷면으로 탁 내려놓으며 말하기: 뿅뿅 */
  play(count: number) {
    for (let i = 0; i < Math.min(count, 4); i++) burst(i * 0.06, 0.05, 2600, 1.4, 0.26);
    tone(523, 0.05, 0.08, 'square', 0.035);
    tone(659, 0.13, 0.12, 'square', 0.035);
  },
  /** 믿어요 */
  pass() {
    tone(784, 0, 0.07, 'sine', 0.05);
  },
  /** "거짓말!": 두둥 */
  doubt() {
    tone(110, 0, 0.18, 'sawtooth', 0.08, 82);
    tone(110, 0.22, 0.25, 'sawtooth', 0.08, 82);
    tone(880, 0.05, 0.3, 'square', 0.035, 1320);
  },
  /** 카드 뒤집기 전 두근두근 */
  drumroll() {
    for (let i = 0; i < 9; i++) tone(150, i * 0.055, 0.05, 'sine', 0.16, 110);
  },
  /** 거짓말이 들켰을 때: 삐요옹 */
  caught() {
    [784, 698, 622, 554].forEach((f, i) => tone(f, i * 0.1, 0.12, 'square', 0.045));
    tone(392, 0.42, 0.45, 'sawtooth', 0.05, 196);
  },
  /** 진짜였을 때: 딩동댕 */
  truth() {
    [659, 831, 988].forEach((f, i) => tone(f, i * 0.1, 0.18, 'triangle', 0.11));
  },
  /** 더미를 가져갈 때 */
  pickup(count: number) {
    sfx.cardDraw(Math.min(6, Math.max(1, Math.ceil(count / 3))));
  },
  win() {
    sfx.win();
  },
};
