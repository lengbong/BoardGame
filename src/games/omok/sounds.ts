import { burst, sfx, tone } from '../../lib/sound';

/** 오목 효과음 (모두 합성음) */
export const okSound = {
  /** 돌을 판에 딱 놓는 소리 */
  place(black: boolean) {
    burst(0, 0.03, black ? 2600 : 3000, 2.2, 0.42);
    tone(black ? 180 : 210, 0, 0.07, 'triangle', 0.16, 110);
  },
  /** 금수 자리 */
  forbidden() {
    tone(220, 0, 0.12, 'square', 0.04);
    tone(196, 0.12, 0.18, 'square', 0.04);
  },
  /** 꼭 막아야 할 때 (수 알려 주기를 켰을 때만) */
  warn() {
    tone(1175, 0, 0.08, 'sine', 0.06);
    tone(1175, 0.14, 0.08, 'sine', 0.06);
  },
  undo() {
    tone(660, 0, 0.08, 'triangle', 0.08, 440);
  },
  win() {
    sfx.win();
  },
  lose() {
    [523, 466, 415, 392].forEach((f, i) => tone(f, i * 0.16, 0.18, 'triangle', 0.1));
  },
  draw() {
    tone(523, 0, 0.15, 'triangle', 0.1);
    tone(523, 0.18, 0.3, 'triangle', 0.1);
  },
};
