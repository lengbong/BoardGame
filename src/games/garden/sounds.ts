import { burst, sfx, tone } from '../../lib/sound';

/** 꽃밭 가꾸기 효과음 (모두 합성음) */
export const gdSound = {
  /** 토큰을 거둘 때: 사기 칩이 짤랑 */
  clink(count: number) {
    for (let i = 0; i < Math.min(count, 4); i++) {
      const f = 2100 + ((i * 337) % 600);
      tone(f, i * 0.075, 0.07, 'triangle', 0.07, f * 0.92);
      tone(f * 1.5, i * 0.075 + 0.01, 0.05, 'sine', 0.03);
      burst(i * 0.075, 0.03, 5200, 2, 0.12);
    }
  },
  /** 빈칸이 다시 채워질 때: 퐁 */
  refill() {
    tone(520, 0, 0.09, 'sine', 0.06, 780);
  },
  /** 심기: 흙을 덮는 사각사각 + 새싹이 쑥 */
  plant() {
    burst(0, 0.22, 1600, 0.9, 0.22, 500);
    burst(0.12, 0.16, 900, 0.9, 0.16, 400);
    tone(392, 0.2, 0.12, 'triangle', 0.09);
    tone(523, 0.3, 0.12, 'triangle', 0.09);
    tone(659, 0.4, 0.22, 'triangle', 0.09);
  },
  /** 온실에 맡기기: 유리 딸랑 */
  reserve() {
    tone(1319, 0, 0.18, 'sine', 0.07);
    tone(1760, 0.08, 0.26, 'sine', 0.05);
  },
  /** 꿀벌을 받을 때: 붕붕 */
  bee() {
    tone(196, 0, 0.32, 'sawtooth', 0.025, 233);
    tone(233, 0.1, 0.3, 'sawtooth', 0.02, 208);
  },
  /** 물뿌리개: 쪼르르 */
  water() {
    for (let i = 0; i < 5; i++) tone(900 + i * 140, i * 0.05, 0.06, 'sine', 0.05, 700 + i * 120);
  },
  /** 시장 끝 식물이 시들 때: 휘이~ */
  wilt() {
    tone(660, 0, 0.55, 'sine', 0.06, 330);
    burst(0.05, 0.3, 700, 0.8, 0.08, 300);
  },
  /** 새 식물이 시장에 들어올 때 */
  enter() {
    tone(988, 0, 0.06, 'triangle', 0.05);
    tone(1319, 0.05, 0.08, 'triangle', 0.04);
  },
  /** 점수를 얻을 때: 반짝 */
  points(amount: number) {
    const n = Math.min(amount, 5);
    for (let i = 0; i < n; i++) tone(1047 + i * 131, i * 0.06, 0.12, 'sine', 0.06);
  },
  /** 상장: 빠바밤! */
  ribbon() {
    [523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.12, 'square', 0.04));
    tone(1047, 0.28, 0.5, 'triangle', 0.12);
    tone(784, 0.28, 0.5, 'triangle', 0.06);
    tone(1319, 0.42, 0.4, 'sine', 0.05);
  },
  /** 바구니가 넘쳐 돌려놓기 */
  discard() {
    tone(330, 0, 0.12, 'triangle', 0.08, 220);
  },
  /** 카드·줄 고르기 */
  select() {
    tone(1200, 0, 0.035, 'triangle', 0.045);
  },
  /** 목표 점수에 닿았을 때: 딩동 */
  bell() {
    tone(988, 0, 0.35, 'sine', 0.09);
    tone(784, 0.22, 0.5, 'sine', 0.09);
  },
  noMove() {
    sfx.noMove();
  },
  win() {
    sfx.win();
  },
};
