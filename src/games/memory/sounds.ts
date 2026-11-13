import { burst, tone } from '../../lib/sound';

/** 짝 맞추기 효과음 (모두 합성음) */
export const memorySfx = {
  /** 카드를 휙 뒤집는 소리 */
  flip() {
    burst(0, 0.09, 1400, 1.3, 0.2, 3200);
    tone(880, 0.04, 0.06, 'sine', 0.05, 1320);
  },
  /** 짝을 찾았을 때 반짝이는 차임 */
  match(streak = 1) {
    const lift = Math.min(streak - 1, 4) * 2; // 연달아 맞히면 조금씩 높아진다
    const up = (midi: number) => 440 * Math.pow(2, (midi + lift - 69) / 12);
    [72, 76, 79, 84].forEach((m, i) => tone(up(m), i * 0.07, 0.22, 'triangle', 0.11));
    tone(up(91), 0.28, 0.35, 'sine', 0.05);
    tone(up(96), 0.34, 0.3, 'sine', 0.03);
  },
  /** 짝이 아닐 때 부드러운 '뿌웅' */
  mismatch() {
    tone(330, 0, 0.16, 'sine', 0.11, 300);
    tone(247, 0.15, 0.26, 'sine', 0.11, 220);
  },
  /** 짝이 내 자리에 쏙 들어갈 때 */
  collect() {
    tone(1047, 0, 0.08, 'sine', 0.06, 1568);
    burst(0, 0.05, 2400, 2, 0.1);
  },
  /** 처음 보여 주기가 끝나고 카드를 덮을 때 */
  coverAll() {
    for (let i = 0; i < 6; i++) burst(i * 0.05, 0.07, 1200 + i * 120, 1.4, 0.13, 2600);
  },
};
