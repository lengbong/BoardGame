import { burst, sfx, tone } from '../../lib/sound';

/** 칠 이어놓기 효과음 (모두 합성음) */
export const svSound = {
  deal() {
    sfx.shuffle();
  },
  /** 판에 카드를 놓을 때: 숫자가 높을수록 조금 높은 소리 */
  place(rank: number) {
    burst(0, 0.05, 2600, 1.4, 0.26);
    const f = 392 * Math.pow(2, (rank - 7) / 12);
    tone(f, 0.01, 0.12, 'triangle', 0.09);
  },
  /** 7로 새 줄을 열 때 */
  open() {
    burst(0, 0.05, 2600, 1.4, 0.26);
    [523, 659, 784].forEach((f, i) => tone(f, 0.02 + i * 0.06, 0.16, 'sine', 0.08));
  },
  /** 통과: 똑똑 */
  pass() {
    burst(0, 0.04, 700, 3, 0.35);
    burst(0.13, 0.04, 640, 3, 0.3);
  },
  /** 탈락: 카드가 우르르 + 내려가는 소리 */
  eliminate() {
    for (let i = 0; i < 6; i++) burst(i * 0.06, 0.05, 2200 + i * 80, 1.4, 0.18);
    [392, 349, 311, 262].forEach((f, i) => tone(f, 0.1 + i * 0.16, 0.18, 'triangle', 0.08));
  },
  finish() {
    sfx.finish();
  },
  win() {
    sfx.win();
  },
};
