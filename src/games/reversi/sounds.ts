import { burst, sfx, tone } from '../../lib/sound';

/** 뒤집기 효과음 (WebAudio 합성음) */
export const reversiSfx = {
  /** 돌을 판에 딱 놓는 소리 */
  place(delay = 0) {
    burst(delay, 0.035, 3400, 2.2, 0.34);
    tone(1250, delay, 0.05, 'sine', 0.07, 820);
    tone(240, delay, 0.06, 'triangle', 0.08, 160);
  },
  /** 돌이 차례로 뒤집히는 물결: delays(초)마다 조금씩 높아지는 똑딱 소리 */
  flips(delays: number[]) {
    delays.slice(0, 18).forEach((d, i) => {
      const f = 700 + Math.min(i, 12) * 45;
      tone(f, d, 0.07, 'triangle', 0.05, f * 1.25);
      burst(d, 0.025, 2600 + i * 80, 3, 0.12);
    });
  },
  /** 둘 곳이 없어서 넘어갈 때 */
  pass() {
    tone(523, 0, 0.16, 'sine', 0.08, 494);
    tone(392, 0.16, 0.3, 'sine', 0.08, 349);
  },
  undo() {
    tone(660, 0, 0.08, 'sine', 0.06, 520);
    tone(520, 0.07, 0.12, 'sine', 0.06, 392);
  },
  win() {
    sfx.win();
  },
  draw() {
    sfx.finish();
  },
  lose() {
    [392, 349, 330, 262].forEach((f, i) => tone(f, i * 0.16, i === 3 ? 0.45 : 0.18, 'triangle', 0.08));
  },
};
