import { burst, sfx, tone } from '../../lib/sound';

/** 도둑잡기 효과음 (모두 합성음) */
export const omSound = {
  /** 카드 나눠 주기 */
  deal() {
    sfx.shuffle();
  },
  /** 뽑을 카드 위에 손을 올렸을 때 작게 똑 */
  hover() {
    tone(1250, 0, 0.035, 'sine', 0.025);
  },
  /** 카드를 고르고 뒤집기 전: 두근두근 */
  suspense() {
    tone(105, 0, 0.13, 'sine', 0.24, 70);
    tone(105, 0.2, 0.13, 'sine', 0.22, 70);
    tone(523, 0.04, 0.42, 'triangle', 0.035, 880);
  },
  draw() {
    sfx.cardDraw();
  },
  /** 짝을 맞춰 버릴 때 */
  pair() {
    burst(0, 0.05, 2600, 1.4, 0.2);
    tone(659, 0.02, 0.09, 'triangle', 0.11);
    tone(988, 0.1, 0.18, 'triangle', 0.11);
  },
  /** 처음에 짝을 여러 개 버릴 때 (n쌍) */
  pairs(n: number) {
    for (let i = 0; i < Math.min(n, 6); i++) {
      burst(i * 0.08, 0.04, 2400, 1.4, 0.12);
      tone(620 + i * 70, i * 0.08, 0.08, 'triangle', 0.07);
    }
  },
  /** 내가 조커를 뽑았을 때: 어이쿠 */
  gotJoker() {
    [392, 370, 349].forEach((f, i) => tone(f, i * 0.12, 0.1, 'square', 0.04));
    tone(262, 0.38, 0.4, 'sawtooth', 0.05, 180);
  },
  /** 내 조커를 남이 뽑아 갔을 때: 흐흐흐 */
  sneaky() {
    [659, 622, 659, 622, 587].forEach((f, i) => tone(f, i * 0.08, 0.06, 'square', 0.03));
  },
  shuffle() {
    sfx.shuffle();
  },
  /** 카드를 다 털었을 때 */
  out() {
    sfx.finish();
  },
  /** 도둑 발표: 살금살금 내려가다가 '뿅' */
  thief() {
    [523, 494, 466, 440, 415].forEach((f, i) => tone(f, i * 0.15, 0.12, 'triangle', 0.1));
    tone(208, 0.8, 0.5, 'sawtooth', 0.05, 104);
    tone(1047, 1.25, 0.18, 'sine', 0.08, 1568);
  },
};
